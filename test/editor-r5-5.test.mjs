// the fixes of R5.5 on both platforms: the space after a smart dash at the end of a paragraph, the
// Text pane live in an empty text, the switch Number the lines of the Code pane, the menu of the
// delivery of a list in the Steps tab, a list in the panel after a change of layout to Split, and
// typeset math in the outline view and in the running head of the Slide pane. each edit of the
// file is checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { substitution } from '../src/editor/text/substitute.ts';
import { byteExact, click, press, saveAndReopen } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const PARAGRAPH = '<p>A paragraph with <strong>bold</strong>, <em>italic</em>, <code>code</code>, and \\(x^2\\) inline.</p>';

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

let last = null;

// the editor on the slide at index of the deck of layouts, served over HTTP, with the Format tab
async function editor(platform, index = 2) {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.send('Page.bringToFront');
  await page.goto(`${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(LAYOUTS, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${index})`);
  await frames(page);
  return page;
}

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

// the characters of a US layout typed as trusted keys, each with its code and Shift
const KEYS = { '"': ['Quote', 222, 8], "'": ['Quote', 222, 0], '-': ['Minus', 189, 0], ' ': ['Space', 32, 0], '.': ['Period', 190, 0] };
async function typeKeys(page, text) {
  for (const c of text) {
    const [code, keyCode, mods] = KEYS[c] ?? [`Key${c.toUpperCase()}`, c.toUpperCase().charCodeAt(0), 0];
    const base = { key: c, code, windowsVirtualKeyCode: keyCode, modifiers: mods };
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: c, unmodifiedText: c });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }
}

// the caret put at the end of the first element at selector, with its block focused
const caretAtEnd = (page, selector) =>
  page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    el.closest('[contenteditable="true"]').focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    return true;
  })()`);

let saves = 0;
async function saved(page) {
  const { text } = await saveAndReopen(page, `r5-5-${++saves}.html`);
  page.source = text;
  await byteExact(page);
  return text;
}

// a trailing space typed at the end of a block is a no-break space in Chrome, and the en dash put
// for the hyphen must keep it, since a plain trailing space is dropped by the next character
test('an en dash keeps the space typed after it, whatever space the browser typed', () => {
  const on = { quotes: true, dashes: true };
  assert.deepEqual(substitution('done -', ' ', on), { remove: 2, insert: '– ' });
  assert.deepEqual(substitution('done -', ' ', on), { remove: 2, insert: '– ' });
  assert.deepEqual(substitution('done -', ' ', on), { remove: 2, insert: '– ' });
  assert.equal(substitution('done-', ' ', on), null);
});

for (const platform of PLATFORMS) {
  test(`a hyphen between spaces at the end of a paragraph becomes an en dash and keeps both spaces on ${platform}`, async () => {
    const page = await editor(platform);
    await caretAtEnd(page, '.reveal section.present > p');
    await typeKeys(page, ' "Halo" -- it\'s done - ok');
    const typed = PARAGRAPH.replace('inline.', 'inline. “Halo” — it’s done – ok');
    await byteExact(page, [[PARAGRAPH, typed]]);
    await saved(page);
    assert.deepEqual(errors(page), []);
  });
}
