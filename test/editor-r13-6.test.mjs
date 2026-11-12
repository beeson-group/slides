// regression tests of R13.6 on both platforms with trusted input: the caret after an undo and a
// redo of Remove Bullet, the name of the outdent of Backspace, and Backspace at the start of a first
// item with a nested list. after each edit the text is checked byte for byte after an undo, the edit again
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
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
let saves = 0;

async function load(t, platform, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/index.html?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('index.html', 'utf8');
  page.platform = platform;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// command sends Mod+Z or Mod+Shift+Z with the editing command of the browser, which a key event of
// the DevTools protocol runs only when the command is named
async function command(page, name) {
  const modifiers = (page.platform === 'mac' ? 4 : 2) | (name === 'redo' ? 8 : 0);
  const base = { key: name === 'redo' ? 'Z' : 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base, commands: [name] });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await frames(page);
  await frames(page);
}

const find = (selector, needle = '') => `[...document.querySelectorAll(${js(selector)})].find((el) => el.getBoundingClientRect().width && el.textContent.includes(${js(needle)}))`;

// the client point 2 px inside the left edge of the character at offset k of needle
const pointOf = (page, selector, needle, k = 0) => page.evaluate(`(() => {
  const el = ${find(selector, needle)};
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const i = n.data.indexOf(${js(needle)});
    if (i < 0) continue;
    const r = document.createRange();
    r.setStart(n, i + ${k});
    r.setEnd(n, i + ${k} + 1);
    const b = r.getBoundingClientRect();
    return { x: b.left + 2, y: b.top + b.height / 2 };
  }
})()`);

const ITEM = '.reveal section.present ul > li';

// finding 1: after an undo or a redo of Remove Bullet, the focus was on body and the typing was lost
for (const platform of PLATFORMS) {
  for (const [n, needle] of [
    [2, 'Each step is'],
    [4, 'Dark and light mode'],
  ]) {
    test(`after an undo and a redo of Remove Bullet on slide ${n + 1}, the next key goes into the text (${platform})`, async (t) => {
      const page = await load(t, platform, n);
      await click(page, await pointOf(page, ITEM, needle));
      await press(page, 'Home');
      await press(page, 'Backspace');
      assert.equal(await undoLabel(page), 'Undo Remove Bullet');
      const unlisted = await render(page);
      assert.ok(unlisted.includes(`<p class="fragment" data-fragment-index="1">${needle}`), 'the item is not made a paragraph');
      await command(page, 'undo');
      await byteExact(page);
      await type(page, 'Q');
      assert.ok((await render(page)).includes(`<li class="fragment" data-fragment-index="1">Q${needle}`), `the Q is not the first character of the item, the focus is in ${await page.evaluate('document.activeElement.localName')}`);
      await command(page, 'undo');
      await byteExact(page);
      // a typing clears the redos, hence the bullet is taken off again for the redo
      await click(page, await pointOf(page, ITEM, needle));
      await press(page, 'Home');
      await press(page, 'Backspace');
      await command(page, 'undo');
      await command(page, 'redo');
      assert.equal(await render(page), unlisted);
      await type(page, 'W');
      const typed = await render(page);
      assert.ok(typed.includes(`<p class="fragment" data-fragment-index="1">W${needle}`), `the W is not the first character of the paragraph, the focus is in ${await page.evaluate('document.activeElement.localName')}`);
      const { text } = await saveAndReopen(page, `r13-6-${++saves}.html`);
      assert.equal(text, typed);
      assert.deepEqual(errors(page), []);
    });
  }
}

// roundTrip checks page.source byte for byte after undos undos, the edit after as many redos, and
// an open of the saved edit without problems
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r13-6-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
}

// the part of the file from the h2 of slide 5 to its figure
const listPart = (text) => {
  const at = text.indexOf('<h2>Figures are first');
  return text.slice(at, text.indexOf('<figure class="zone">', at));
};

// the item "You might..." of slide 5 made the first item of a list nested in "Dark and light..."
async function nested(t, platform) {
  const page = await load(t, platform, 4);
  await click(page, await pointOf(page, ITEM, 'You might'));
  await press(page, 'Home');
  await press(page, 'Tab');
  assert.match(listPart(await render(page)), /for-light<\/code>\.\n {6}<ul>\n {8}<li class="fragment" data-fragment-index="2">You might/);
  return page;
}

// finding 4: Backspace at the start of a nested first item outdents it, and was named Join Paragraphs
for (const platform of PLATFORMS) {
  test(`Backspace at the start of a nested first item is named as the outdent, Decrease Indent Level (${platform})`, async (t) => {
    const page = await nested(t, platform);
    await click(page, await pointOf(page, ITEM, 'You might'));
    await press(page, 'Home');
    await press(page, 'Backspace');
    assert.equal(await undoLabel(page), 'Undo Decrease Indent Level');
    // the outdent takes back the Tab
    await byteExact(page);
    await page.evaluate('window.BeesonEditor.undo()');
    assert.match(listPart(await render(page)), /for-light<\/code>\.\n {6}<ul>\n {8}<li class="fragment" data-fragment-index="2">You might/);
    await page.evaluate('window.BeesonEditor.redo()');
    await byteExact(page);
  });
}

// finding 5: Backspace at the start of a first item with a nested list did nothing
for (const platform of PLATFORMS) {
  test(`Backspace at the start of a first item with a nested list takes its dash off and keeps the nested items in the list (${platform})`, async (t) => {
    const page = await nested(t, platform);
    await click(page, await pointOf(page, ITEM, 'Dark and light'));
    await press(page, 'Home');
    await press(page, 'Backspace');
    const part = listPart(await render(page));
    assert.match(part, /frameless\.<\/p>\n {2}<p class="fragment" data-fragment-index="1">Dark and light mode: [^<]*<code>for-dark<\/code> and <code>for-light<\/code>\.<\/p>\n {2}<ul style="translate: 0px 20px">\n {4}<li class="fragment" data-fragment-index="2">You might[^<]*<\/li>\n {4}<li class="fragment" data-fragment-index="3">You should/, part);
    assert.equal(await undoLabel(page), 'Undo Remove Bullet');
    await type(page, 'W');
    assert.ok(listPart(await render(page)).includes('<p class="fragment" data-fragment-index="1">WDark'), 'the caret is not at the start of the paragraph');
    await page.evaluate('window.BeesonEditor.undo()');
    await roundTrip(page, 2);
  });
}
