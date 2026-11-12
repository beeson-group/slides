// regression tests of R18.2 on both platforms with trusted input: Backspace and Delete in an empty
// paragraph next to a locked list, the caret after an undo and a redo of Return on an empty nested
// item, and the id of a list cut by List None. each edit is undone to the file byte for byte

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const LOCKED = 'test/pages/editor-r16-4.html';
const DECK = 'test/pages/editor-r18-2.html';

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
const wait = (page, ms = 300) => page.evaluate(`new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), ${ms}))`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
const exec = (page, id) => page.evaluate(`window.BeesonEditor.exec(${js(id)})`);
let saves = 0;

async function load(t, platform, deck, slide) {
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
  await page.evaluate(`Reveal.slide(${slide})`);
  await wait(page);
  return page;
}

// the edit checked against base after an undo, again after a redo, and after a save and an open
async function roundTrip(page, base) {
  const edited = await render(page);
  assert.notEqual(edited, base, 'the action does not change the file');
  await undo(page);
  assert.equal(await render(page), base, 'the undo does not give the file back byte for byte');
  await redo(page);
  assert.equal(await render(page), edited, 'the redo does not write the edit again');
  const { text } = await saveAndReopen(page, `r18-2-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  return edited;
}

// every entry undone, which must give the file of the page back byte for byte
async function undoAll(page) {
  for (let n = 0; n < 20 && (await state(page)).enabled; n++) await undo(page);
  assert.equal(await render(page), page.source, 'the undo of every entry does not give the file back byte for byte');
}
const state = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo')`);

const SLIDE = '.reveal .slides section.present';
const find = (needle) => `[...document.querySelectorAll('${SLIDE} li')].findLast((el) => el.getBoundingClientRect().width && el.textContent.includes(${js(needle)}))`;

// the caret put at the end of the item that holds needle, or with all true its text selected
const caretIn = (page, needle, all = false) => page.evaluate(`(() => {
  const li = ${find(needle)};
  const n = [...li.childNodes].find((c) => c.nodeType === 3 && c.data.trim());
  li.closest('[contenteditable="true"]').focus();
  if (${all}) getSelection().setBaseAndExtent(n, 0, n, n.length);
  else getSelection().collapse(n, n.length);
})()`);

// the caret put into the empty paragraph of the current slide
const caretInEmpty = (page) => page.evaluate(`(() => {
  const p = [...document.querySelectorAll('${SLIDE} > p')].find((p) => !p.textContent.trim());
  p.closest('[contenteditable="true"]').focus();
  getSelection().collapse(p, 0);
})()`);

// the caret put into the empty item of the current slide
const caretInEmptyItem = (page) => page.evaluate(`(() => {
  const li = [...document.querySelectorAll('${SLIDE} li')].find((li) => !li.textContent.trim());
  li.closest('[contenteditable="true"]').focus();
  getSelection().collapse(li, 0);
})()`);

// one trusted key press of a letter with its text, as a keyboard types it, with Shift for a
// capital
async function key(page, ch) {
  const base = { key: ch, code: `Key${ch.toUpperCase()}`, windowsVirtualKeyCode: ch.toUpperCase().charCodeAt(0), modifiers: ch === ch.toUpperCase() ? 8 : 0 };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: ch, unmodifiedText: ch });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await wait(page, 600);
}

// the key ch, typed after the file is base, must add one character to base at the bar of where,
// a part of base with a bar at the caret, e.g. '<p>|</p>'
async function typedAt(page, base, where, ch) {
  await key(page, ch);
  const text = await render(page);
  const at = base.indexOf(where.replace('|', ''));
  assert.ok(at >= 0, `${where} is not in the file`);
  const i = at + where.indexOf('|');
  let d = 0;
  while (d < text.length && text[d] === base[d]) d++;
  const got = text.length === base.length ? 'nowhere' : js(text.slice(Math.max(0, d - 30), d + 30));
  assert.ok(text === base.slice(0, i) + ch + base.slice(i), `the key ${ch} is not typed at ${js(where)} but ${got}`);
}


for (const platform of PLATFORMS) {
  // C9: the paragraph was taken off, and the caret was put into the locked list, which takes no key
  test(`Backspace in an empty paragraph after a locked list leaves the paragraph and its caret in place (${platform})`, async (t) => {
    const page = await load(t, platform, LOCKED, 2);
    await page.evaluate(`(() => { const p = [...document.querySelectorAll('${SLIDE} > p')].find((p) => p.textContent.includes('Middle')); p.closest('[contenteditable="true"]').focus(); getSelection().selectAllChildren(p); })()`);
    await press(page, 'Backspace');
    await wait(page, 1200);
    const emptied = await render(page);
    assert.match(emptied, /<\/ul>\n {2}<p>(<br>)?<\/p>\n {2}<ul data-locked>/);
    await caretInEmpty(page);
    await press(page, 'Backspace');
    await wait(page);
    assert.equal(await render(page), emptied, 'Backspace changes the file');
    await key(page, 'q');
    const text = await render(page);
    assert.match(text, /<\/ul>\n {2}<p>q(<br>)?<\/p>\n {2}<ul data-locked>/, `the key q is not typed into the paragraph: ${js(text.slice(text.indexOf('<h2>Locked'), text.indexOf('</section>', text.indexOf('<h2>Locked'))))}`);
    await undoAll(page);
    assert.deepEqual(errors(page), []);
  });

  // the same with a forward Delete, on a paragraph that is empty in the file, since an emptied
  // paragraph keeps a br, at which Delete does not take it off
  test(`a forward Delete in an empty paragraph before a locked list leaves the paragraph and its caret in place (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, 2);
    await caretInEmpty(page);
    await press(page, 'Delete');
    await wait(page);
    assert.equal(await render(page), page.source, 'Delete changes the file');
    await typedAt(page, page.source, '<p>|</p>', 'q');
    await undoAll(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  // C8: the caret was put back by the restore of the item that holds the nested list, at the end of
  // the item before
  test(`after an undo and a redo of Return on an empty nested item, a typed key is written in the empty item (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, 0);
    await caretIn(page, 'Nsub');
    await press(page, 'Enter');
    await wait(page);
    const one = await render(page);
    assert.equal((one.match(/<li><\/li>/g) ?? []).length, 1, `Return does not add an empty nested item: ${js(one.slice(one.indexOf('<h2>A nested'), one.indexOf('</section>')))}`);
    await press(page, 'Enter');
    await wait(page);
    const two = await render(page);
    assert.notEqual(two, one, 'Return does not move the empty item out');
    assert.equal(await undoLabel(page), 'Undo New Paragraph');
    await press(page, 'Mod+Z');
    await wait(page);
    assert.equal(await render(page), one);
    await typedAt(page, one, '<li>|</li>', 'q');
    await undo(page);
    assert.equal(await render(page), one);
    await caretInEmptyItem(page);
    await press(page, 'Enter');
    await wait(page);
    assert.equal(await render(page), two);
    await press(page, 'Mod+Z');
    await wait(page);
    await press(page, 'Mod+Shift+Z');
    await wait(page);
    assert.equal(await render(page), two);
    await typedAt(page, two, '<li>|</li>', 'q');
    await undo(page);
    assert.equal(await render(page), two);
    await undoAll(page);
    assert.deepEqual(errors(page), []);
  });

  // C10: the list after the cut was written with every attribute of the list, its id included
  test(`List None on a middle item of a list with an id leaves the id on the first list alone (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, 1);
    await caretIn(page, 'Itwo');
    await exec(page, 'text.list.none');
    await wait(page);
    const text = await render(page);
    const part = text.slice(text.indexOf('<ol id="plan"'), text.indexOf('</section>', text.indexOf('<ol id="plan"')));
    assert.equal(part, '<ol id="plan" data-id="plan">\n    <li>Ione</li>\n  </ol>\n  <p>Itwo</p>\n  <ol data-id="plan" start="2">\n    <li>Ithree</li>\n  </ol>\n', `the id is written twice: ${js(part)}`);
    assert.equal(await page.evaluate(`document.querySelectorAll('#plan').length`), 1);
    await roundTrip(page, page.source);
  });
}
