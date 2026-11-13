// regression tests of R15.4 on both platforms with trusted input: a value under 1 refused by the
// field Start at, the start of a list cut off by Return kept in step with the count of the list
// before it, and a paste of several lines with blank lines into a list item. after each edit the
// text is checked byte for byte after an undo, the edit again after a redo, and after a save and
// an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const LISTS = 'test/pages/editor-r13-3.html';
const PLATFORMS = ['mac', 'other'];

let browser;
let server;
before(async () => {
  browser = await launch({ offline: false });
  server = await serve('.');
});
after(async () => {
  await browser?.close();
  server?.close();
});

const js = (v) => JSON.stringify(v);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
let saves = 0;

// the editor on slide n of deck, served over HTTP, with the storage of the origin emptied
async function load(t, platform, deck, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the edit checked against base after a number of undos, again after as many redos, and after a
// save and an open
async function roundTrip(page, base, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, base, 'the action does not change the file');
  for (let i = 0; i < undos; i++) await undo(page);
  assert.equal(await render(page), base, 'the undo does not give the file back byte for byte');
  for (let i = 0; i < undos; i++) await redo(page);
  assert.equal(await render(page), edited, 'the redo does not write the edit again');
  const { text } = await saveAndReopen(page, `r15-4-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  return edited;
}

const find = (selector, needle = '') => `[...document.querySelectorAll(${js(selector)})].find((el) => el.getBoundingClientRect().width && el.textContent.includes(${js(needle)}))`;
const ITEM = '.reveal section.present ol > li, .reveal section.present ul > li';

// the client point of the middle of the text needle in an item of the current slide
const pointOf = (page, needle) => page.evaluate(`(() => {
  const el = ${find(ITEM, needle)};
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const i = n.data.indexOf(${js(needle)});
    if (i < 0) continue;
    const r = document.createRange();
    r.setStart(n, i);
    r.setEnd(n, i + ${js(needle)}.length);
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }
})()`);

// the caret put at the end, or with end false at the start, of the item that holds needle
const caretIn = (page, needle, end = true) => page.evaluate(`(() => {
  const li = ${find(ITEM, needle)};
  const w = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
  const texts = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.data.trim()) texts.push(n);
  li.closest('[contenteditable="true"]').focus();
  const n = ${end} ? texts.at(-1) : texts[0];
  getSelection().collapse(n, ${end} ? n.length : 0);
})()`);

// the start of each numbered list of the current slide, as the page has it
const starts = (page) => page.evaluate(`[...document.querySelectorAll('.reveal section.present > ol')].map((ol) => ol.start)`);

// the tab of the inspector named name shown, with the Format pane open
async function showTab(page, name) {
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await frames(page);
  const at = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-inspector .ed-tabs button')].find((b) => b.textContent.trim() === ${js(name)}); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (at) await click(page, at);
  await frames(page);
}

const START = '.beeson-edit-inspector input[name="Start at"]';
const field = (page) => page.evaluate(`document.querySelector(${js(START)}).value`);

// value typed over the text of the field Start at, and Return
async function typeStart(page, value) {
  await click(page, START, { count: 3 });
  await type(page, value);
  await press(page, 'Enter');
  await frames(page);
}

for (const platform of PLATFORMS) {
  // D33: a 0 typed into Start at took the attribute start off and showed 1
  test(`the field Start at refuses a value under 1 and keeps the value before (${platform})`, async (t) => {
    const page = await load(t, platform, LISTS, 0);
    await click(page, await pointOf(page, 'Bravo'));
    await showTab(page, 'Text');
    await typeStart(page, '12');
    const twelve = await render(page);
    assert.equal(twelve, page.source.replace('<ol>', '<ol start="12">'));
    for (const value of ['0', '-3']) {
      await typeStart(page, value);
      assert.equal(await render(page), twelve, `a typed ${value} changes the file`);
      assert.equal(await field(page), '12', `the field does not go back to 12 after a typed ${value}`);
    }
    assert.equal(await undoLabel(page), 'Undo Start At');
    await undo(page);
    assert.equal(await render(page), page.source, 'a refused value adds an entry to the history');
    await redo(page);
    assert.equal(await render(page), twelve);
    await roundTrip(page, page.source);
  });
}

// the part of the file of the first slide of the deck of lists from Alpha to Echo
const cutPart = (text) => text.slice(text.indexOf('<li>Alpha'), text.indexOf('<li>Echo'));

// Return twice at the end of Bravo, which cuts the list of Alpha to Echo after Bravo
async function cutAfterBravo(page) {
  await caretIn(page, 'Bravo');
  await press(page, 'Enter');
  await press(page, 'Enter');
  const cut = await render(page);
  assert.match(cutPart(cut), /<li>Bravo<\/li>\n {2}<\/ol>\n {2}<p><\/p>\n {2}<ol start="3">\n {4}<li>Charlie<\/li>/);
  return cut;
}

for (const platform of PLATFORMS) {
  // D32: the list cut off by Return kept start="3" after an item was added to the list before it
  test(`the start of a list cut off by Return goes on with the count of the list before it, at an added and a removed item (${platform})`, async (t) => {
    const page = await load(t, platform, LISTS, 0);
    const cut = await cutAfterBravo(page);
    await caretIn(page, 'Alpha');
    await press(page, 'Enter');
    await type(page, 'Ab');
    const added = await render(page);
    assert.match(cutPart(added), /<li>Ab<\/li>\n {4}<li>Bravo<\/li>\n {2}<\/ol>\n {2}<p><\/p>\n {2}<ol start="4">\n {4}<li>Charlie<\/li>/, `the second list does not go on from 3: ${cutPart(added)}`);
    assert.deepEqual(await starts(page), [1, 4, 7]);
    await roundTrip(page, cut, 2);
    // Backspace at the start of Bravo joins it to Ab, which takes an item off the first list
    await caretIn(page, 'Bravo', false);
    await press(page, 'Backspace');
    const joined = await render(page);
    assert.match(cutPart(joined), /<li>AbBravo<\/li>\n {2}<\/ol>\n {2}<p><\/p>\n {2}<ol start="3">\n {4}<li>Charlie<\/li>/, `the second list does not go on from 2: ${cutPart(joined)}`);
    assert.deepEqual(await starts(page), [1, 3, 7]);
    await roundTrip(page, added);
  });

  test(`after an undo and a redo of the cut, the start of the second list still goes on with the first list (${platform})`, async (t) => {
    const page = await load(t, platform, LISTS, 0);
    const cut = await cutAfterBravo(page);
    await undo(page);
    await redo(page);
    assert.equal(await render(page), cut);
    await caretIn(page, 'Alpha');
    await press(page, 'Enter');
    assert.deepEqual(await starts(page), [1, 4, 7], 'the second list does not go on with the first list after a redo of the cut');
    await undo(page);
    assert.equal(await render(page), cut);
    assert.deepEqual(await starts(page), [1, 3, 7]);
  });

  test(`a start typed into Start at, or that the file had, is not changed at an edit of the list before it (${platform})`, async (t) => {
    const page = await load(t, platform, LISTS, 0);
    await cutAfterBravo(page);
    await click(page, await pointOf(page, 'Charlie'));
    await showTab(page, 'Text');
    await typeStart(page, '10');
    assert.ok((await render(page)).includes('<ol start="10">\n    <li>Charlie'));
    await caretIn(page, 'Alpha');
    await press(page, 'Enter');
    assert.deepEqual(await starts(page), [1, 10, 7], 'a typed start is changed');
    // the list of Seventh has start="7" in the file, which an item added before it does not change
    await caretIn(page, 'Delta');
    await press(page, 'Enter');
    assert.deepEqual(await starts(page), [1, 10, 7], 'the start of the file is changed');
  });
}

// the part of the file of slide 3 of the demo deck from its ul to its backdrop
const listPart = (text) => {
  const at = text.indexOf('<h2>Show your steps one at a time');
  return text.slice(text.indexOf('<ul>', at), text.indexOf('<div class="backdrop"', at));
};
const ITEM_2 = '<li class="fragment" data-fragment-index="2">';

for (const platform of PLATFORMS) {
  // D14: a blank line pasted into a list ended the list and split it in two around a paragraph
  for (const [name, text] of [['one blank line', ' one\n\ntwo'], ['two blank lines', ' one\n\n\ntwo'], ['a line of spaces', ' one\n  \ntwo']]) {
    test(`a paste of several lines with ${name} into a list item makes an item for each line with text, in the same list (${platform})`, async (t) => {
      const page = await load(t, platform, 'index.html', 2);
      await caretIn(page, 'Two elements with the same');
      await exec(page, 'edit.paste', text);
      await frames(page);
      const part = listPart(await render(page));
      assert.equal(part.match(/<ul>/g)?.length, 1, `the paste splits the list: ${part}`);
      assert.ok(!part.includes('<p'), `the paste writes a paragraph: ${part}`);
      assert.ok(part.includes(`${ITEM_2}Two elements with the same index are shown together. one</li>\n    ${ITEM_2}two</li>\n    <li class="fragment" data-fragment-index="3">When exporting`), `the lines are not items of the list: ${part}`);
      assert.equal(await undoLabel(page), 'Undo Paste');
      await roundTrip(page, page.source);
    });
  }

  test(`Return on an empty item still ends the list (${platform})`, async (t) => {
    const page = await load(t, platform, 'index.html', 2);
    await caretIn(page, 'Two elements with the same');
    await press(page, 'Enter');
    await press(page, 'Enter');
    await type(page, 'X');
    const part = listPart(await render(page));
    assert.match(part, /together\.<\/li>\n {2}<\/ul>\n {2}<p>X<\/p>\n {2}<ul>/, `Return on an empty item does not end the list: ${part}`);
  });
}
