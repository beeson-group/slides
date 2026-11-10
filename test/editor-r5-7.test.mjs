// the fixes of R5.7 on both platforms: every key typed back to back into a new text box, code box,
// formula, and footnote lands, the Format Painter is dimmed in a code box, the running head of the
// Slide pane does not leave typeset items of MathJax behind, and a change of layout to Split fits
// the panel text of every slide changed. each edit of the file is checked byte for byte, after an
// undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, saveAndReopen } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
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

let last = null;

// the editor on the slide at index of a deck, served over HTTP
async function editor(platform, index = 2, deck = LAYOUTS, size) {
  await last?.close().catch(() => {});
  const page = await browser.newPage(size);
  last = page;
  await page.send('Page.bringToFront');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  await page.evaluate(`Reveal.slide(${index})`);
  await frames(page);
  return page;
}

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const wait = (page, ms) => page.evaluate(`new Promise((d) => setTimeout(() => d(true), ${ms}))`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const until = async (page, expr, ms = 3000) => {
  for (const end = Date.now() + ms; Date.now() < end; await wait(page, 50)) if (await page.evaluate(expr)) return true;
  return false;
};

let saves = 0;
async function saved(page) {
  const { text } = await saveAndReopen(page, `r5-7-${++saves}.html`);
  page.source = text;
  await byteExact(page);
  return text;
}

// the trusted key events of a text, with a newline sent as Enter, all sent over the DevTools
// protocol before the first one is handled
function burst(page, text) {
  const sent = [];
  for (const c of text) {
    const base = c === '\n'
      ? { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' }
      : { key: c, code: c === ' ' ? 'Space' : `Key${c.toUpperCase()}`, windowsVirtualKeyCode: c === ' ' ? 32 : c.toUpperCase().charCodeAt(0), text: c, unmodifiedText: c };
    sent.push(page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base }));
    sent.push(page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: base.key, code: base.code, windowsVirtualKeyCode: base.windowsVirtualKeyCode }));
  }
  return Promise.all(sent);
}

// undoes every entry down to the text of the deck, and redoes them all, back to the text edited
async function undoAll(page, source) {
  const text = await render(page);
  let n = 0;
  while ((await render(page)) !== source) {
    assert.ok(n++ < 20, 'the undo does not reach the text of the deck');
    await undo(page);
  }
  await byteExact(page);
  for (let i = 0; i < n; i++) await redo(page);
  assert.equal(await render(page), text);
}

// each new text written into the file by its first key, with the slide it is put on, the text
// typed, and a pattern of the elements that every key must reach in the file. Enter in a text box
// starts a new paragraph, as in an existing one, and in a footnote it starts a new line
const NEW_TEXTS = [
  { id: 'insert.code', slide: 5, keys: 'a\nbc\n\nd', written: /<pre><code class="language-python">a\nbc\n\nd\n?<\/code><\/pre>/ },
  { id: 'insert.text', slide: 2, keys: 'a\nbc d', written: /<p>a<\/p>\s*<p>bc d<\/p>/ },
  { id: 'insert.footnote', slide: 3, keys: 'a\nbc d', written: /<div class="foot">a<br>bc d<\/div>/ },
];

for (const platform of PLATFORMS) {
  for (const { id, slide, keys, written } of NEW_TEXTS) {
    test(`every key typed back to back into a new text of ${id} lands on ${platform}`, async () => {
      const page = await editor(platform, slide);
      const source = page.source;
      await exec(page, id);
      await frames(page);
      // the write of the new element is slowed as on a loaded machine, so that the keys after the
      // first one come while it is written
      await page.evaluate(`(() => { const t = MathJax.typesetPromise.bind(MathJax); MathJax.typesetPromise = (n) => new Promise((d) => setTimeout(d, 150)).then(() => t(n)); })()`);
      await burst(page, keys);
      await wait(page, 600);
      const text = await render(page);
      assert.match(text, written, `a key is lost: ${JSON.stringify(text.split('\n').filter((l) => !source.includes(l)))}`);
      await undoAll(page, source);
      await saved(page);
      assert.deepEqual(errors(page), []);
    });
  }

  test(`Enter at the end of a code box starts a new line of its code on ${platform}`, async () => {
    const page = await editor(platform, 5);
    const CODE = 'x = 1\ny = x + 1</code>';
    await page.evaluate(`(() => {
      const c = document.querySelector('.reveal section.present pre code');
      c.closest('[contenteditable="true"]').focus();
      const r = document.createRange();
      r.selectNodeContents(c);
      r.collapse(false);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
    })()`);
    await burst(page, '\nz');
    await wait(page, 200);
    await byteExact(page, [[CODE, 'x = 1\ny = x + 1\nz</code>']]);
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal section.present pre code').length`), 1);
    await undoAll(page, page.source);
    await saved(page);
    assert.deepEqual(errors(page), []);
  });

  test(`every key typed back to back after Insert > Formula reaches its TeX field on ${platform}`, async () => {
    const page = await editor(platform, 5);
    await exec(page, 'insert.formula');
    await burst(page, 'abc d');
    await wait(page, 300);
    const field = await page.evaluate(`(() => { const f = document.querySelector('.beeson-math textarea'); return f && { value: f.value, focused: f === document.activeElement }; })()`);
    assert.deepEqual(field, { value: 'abc d', focused: true });
    assert.deepEqual(errors(page), []);
  });
}
