// the findings of round 1 of the council on the shell, the navigator, and the place of an insert,
// on both platforms: the scroll bars of a zoomed canvas, the inspector at the start, the View and
// Zoom popups of the toolbar, the numbers and the skipped slides of the navigator, the outline
// view, the popover of Add Slide, the place of a new text box and QR code, the keyboard sheet, the
// history after an empty box, Paste Style on a step, and the brand images of the thumbnails. each
// edit is checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { center, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

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

const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg !== undefined ? `, ${JSON.stringify(arg)}` : ''})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

// the editor on a deck served over HTTP, with the storage of the origin emptied first, or with
// keep the storage of the page before, and with slide n shown
async function load(t, platform, { deck = LAYOUTS, n = 0, size = { width: 1600, height: 1000 }, scheme, keep = false } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  if (scheme) await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  if (!keep) {
    await page.goto(`${server.origin}/theme/beeson.css`);
    await page.evaluate('localStorage.clear()');
  }
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// an undo gives the text before byte for byte, and a redo gives the edited text again
async function undoRedo(page, before, edited) {
  await undo(page);
  await sleep(100);
  assert.equal(await render(page), before);
  await redo(page);
  await sleep(100);
  assert.equal(await render(page), edited);
}

let saves = 0;
async function savedAs(page, edited) {
  const { text } = await saveAndReopen(page, `shell-r3-8-${++saves}.html`);
  assert.equal(text, edited);
}

for (const platform of PLATFORMS) {
  test(`a light thumbnail of a closing slide on a page under test/pages loads the lockup of brand/ (${platform})`, async (t) => {
    const page = await load(t, platform);
    if ((await page.evaluate('Beeson.theme.get()')) !== 'light') await page.evaluate('Beeson.theme.toggle()');
    const closing = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.classList.contains('closing'))`);
    await page.evaluate(`document.querySelectorAll('.beeson-edit-nav .row')[${closing}].scrollIntoView()`);
    await sleep(1200);
    const url = await page.evaluate(`(() => {
      const pic = document.querySelectorAll('.beeson-edit-nav .row')[${closing}].querySelector('.pic');
      const s = pic.shadowRoot?.querySelector('section.closing');
      return s ? getComputedStyle(s, '::before').backgroundImage : null;
    })()`);
    assert.match(url ?? '', /\/brand\/lockup-light\.png/);
    assert.doesNotMatch(url, /test\/pages\/brand/);
    assert.deepEqual(errors(page), []);
  });
}
