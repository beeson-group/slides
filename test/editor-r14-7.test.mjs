// regression tests of R14.7 on both platforms with trusted input: a list style on a span of
// paragraphs made from a list, and the space after the caret kept by Return and by a paste of
// several lines. after each edit the text is checked byte for byte after an undo, the edit again
// after a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen, type } from './helpers/editor.mjs';

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
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
const exec = (page, id) => page.evaluate(`window.BeesonEditor.exec(${js(id)})`);
let saves = 0;

async function load(t, platform, n = 4) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/test-deck.html?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('test-deck.html', 'utf8');
  page.platform = platform;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks page.source byte for byte after undos undos, the edit after as many redos, and
// an open of the saved edit without problems
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  for (let i = 0; i < undos; i++) await undo(page);
  await byteExact(page);
  for (let i = 0; i < undos; i++) await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r14-7-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  return edited;
}

const find = (selector, needle = '') => `[...document.querySelectorAll(${js(selector)})].find((el) => el.getBoundingClientRect().width && el.textContent.includes(${js(needle)}))`;

// the client point of the character at offset k of needle, 2 px inside its left edge with edge
const pointOf = (page, selector, needle, k = 0, edge = false) => page.evaluate(`(() => {
  const el = ${find(selector, needle)};
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const i = n.data.indexOf(${js(needle)});
    if (i < 0) continue;
    const r = document.createRange();
    r.setStart(n, i + ${k});
    r.setEnd(n, i + ${k} + 1);
    const b = r.getBoundingClientRect();
    return { x: ${edge} ? b.left + 2 : b.left + b.width / 2, y: b.top + b.height / 2 };
  }
})()`);

const ITEM = '.reveal section.present ul > li, .reveal section.present ol > li';
const PARA = '.reveal section.present > p';
const HEAD = '.reveal section.present > h2';

// caretAtEnd puts the caret at the end of the own text of item i of the slide, counted in page
// order, i.e. before a nested list of the item
const caretAtEnd = (page, i) => page.evaluate(`(() => {
  const li = document.querySelectorAll(${js(ITEM)})[${i}];
  const w = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
  let last = null;
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.data.trim() && n.parentElement.closest('li') === li) last = n;
  li.closest('[contenteditable="true"]').focus();
  getSelection().collapse(last, last.length);
})()`);

// caretIn gives the tag and the text of the element of the focus of the window, the active element,
// and whether the window is collapsed
const caretIn = (page) => page.evaluate(`(() => {
  const s = getSelection();
  const n = s.focusNode;
  const el = n && (n.nodeType === 1 ? n : n.parentElement);
  return { tag: el?.localName ?? null, text: el?.textContent.trim().slice(0, 29) ?? null, editing: !!el?.closest('[contenteditable="true"]'), active: document.activeElement.localName, collapsed: s.isCollapsed };
})()`);

// the part of the file from the h2 of slide 5 to its figure
const listPart = (text) => {
  const at = text.indexOf('<h2>Figures are first');
  return text.slice(at, text.indexOf('<figure class="zone">', at));
};

// the kinds of the blocks of the text column of slide 5, as parent>tag:start
const kinds = (page) => page.evaluate(`[...document.querySelectorAll('.reveal section.present ul > li, .reveal section.present ol > li, .reveal section.present > p')].map((e) => e.parentElement.localName + '>' + e.localName + ':' + e.textContent.slice(0, 8)).join(' | ')`);

for (const platform of PLATFORMS) {
  // D16: Numbers and Dashes after Paragraphs on a span of items reached only the last paragraph
  for (const [id, tag] of [['text.list.ol', 'ol'], ['text.list.ul', 'ul']]) {
    test(`${tag === 'ol' ? 'Numbers' : 'Arrows'} after Paragraphs on a span of items acts on every paragraph of the span (${platform})`, async (t) => {
      const page = await load(t, platform);
      await click(page, await pointOf(page, ITEM, 'toggle', 2));
      await press(page, 'Mod+A');
      await exec(page, 'text.list.none');
      assert.equal(await kinds(page), 'section>p:Export y | section>p:Dark and | section>p:You migh | section>p:You shou');
      await exec(page, id);
      assert.equal(await kinds(page), `section>p:Export y | ${tag}>li:Dark and | ${tag}>li:You migh | ${tag}>li:You shou`);
      await press(page, 'Mod+I');
      const part = listPart(await render(page));
      assert.equal(part.match(new RegExp(`<${tag}`, 'g'))?.length, 1, `the list style does not make one list: ${part}`);
      assert.equal(part.match(/<em>/g)?.length, 3, `Italic after the list style does not format each item: ${part}`);
      await roundTrip(page, 3);
    });
  }
}

// caretBefore puts the caret before needle in the item of the slide that holds needle
const caretBefore = (page, needle) => page.evaluate(`(() => {
  const li = ${find(ITEM, needle)};
  const w = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const i = n.data.indexOf(${js(needle)});
    if (i < 0) continue;
    li.closest('[contenteditable="true"]').focus();
    getSelection().collapse(n, i);
    return;
  }
})()`);

const ITEM_2 = '<li class="fragment" data-fragment-index="2">';

for (const platform of PLATFORMS) {
  // D13: Return and a paste of several lines before a space dropped the space
  test(`Return before a space keeps the space at the start of the new item (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await caretBefore(page, ' with the same');
    await press(page, 'Enter');
    await type(page, 'X');
    const text = await render(page);
    assert.ok(text.includes(`${ITEM_2}Two elements</li>`), 'the first part is not written');
    assert.ok(text.includes(`${ITEM_2}X with the same index are shown together.</li>`), `the space after the caret is dropped: ${text.match(/>X[^<]*</)?.[0]}`);
    await roundTrip(page, 2);
  });

  test(`a paste of several lines before a space keeps the space after the last line (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await caretBefore(page, ' with the same');
    await page.evaluate(`window.BeesonEditor.exec('edit.paste', ' one\\ntwo\\nthree')`);
    await frames(page);
    const text = await render(page);
    assert.ok(text.includes(`${ITEM_2}Two elements one</li>`), 'the first line is not pasted at the caret');
    assert.ok(text.includes(`${ITEM_2}three with the same index are shown together.</li>`), `the space after the caret is dropped: ${text.match(/>three[^<]*</)?.[0]}`);
    await roundTrip(page, 1);
  });
}

for (const platform of PLATFORMS) {
  // D5: after an undo of Decrease Indent Level the caret was after the nested list
  for (const [name, keys] of [['Shift+Tab', ['Shift+Tab']], ['Backspace', ['Home', 'Backspace']]]) {
    test(`after an undo of the outdent of ${name}, typing lands where the caret was before the outdent (${platform})`, async (t) => {
      const page = await load(t, platform);
      await click(page, await pointOf(page, ITEM, 'You might', 4));
      await press(page, 'Home');
      await press(page, 'Tab');
      const nested = await render(page);
      for (const key of keys) await press(page, key);
      assert.notEqual(await render(page), nested, `${name} does not outdent the item`);
      await undo(page);
      assert.equal(await render(page), nested);
      await type(page, 'Q');
      assert.match(listPart(await render(page)), />QYou might have noticed/, `Q is not typed at the start of the item: ${(await render(page)).match(/[^>]{0,20}Q<\/li>|>[^<]{0,10}Q[^<]{0,10}/)?.[0]}`);
    });
  }
  // the place at the start of a nested item is also the end of the white space before the item in
  // its list, where the list commands do not act
  test(`after an undo of an outdent, the caret is in the nested item, and Shift+Tab takes it out again (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await pointOf(page, ITEM, 'You might', 4));
    await press(page, 'Home');
    await press(page, 'Tab');
    const nested = await render(page);
    await press(page, 'Shift+Tab');
    const out = await render(page);
    assert.notEqual(out, nested);
    await undo(page);
    assert.equal(await render(page), nested);
    const caret = await caretIn(page);
    assert.equal(caret.tag, 'li', `the caret is in a ${caret.tag}`);
    assert.match(caret.text, /^You might/);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('text.outdent').enabled`), true);
    await press(page, 'Shift+Tab');
    assert.equal(await render(page), out, 'Shift+Tab does not take the item out again');
    // a redo of the indent leaves the caret in the nested item as well
    await undo(page);
    await undo(page);
    await redo(page);
    assert.equal(await render(page), nested);
    assert.equal((await caretIn(page)).tag, 'li');
    assert.deepEqual(errors(page), []);
  });
}
