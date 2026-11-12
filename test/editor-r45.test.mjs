// regression tests of R45, two defects found by the last review of the editor. on a Mac, a press
// with Ctrl is a secondary click, which opens the context menu and does not move the element under
// it at a slip of the pointer. an undo asked for while a change is still made, e.g. while a dropped
// picture is sized, takes this change, and not the entry before it

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press } from './helpers/editor.mjs';

const DECK = 'test/pages/editor-r8-5.html';
// the slide of the deck with one image in a zone
const ZONE_ONE = 1;
const IMG = '.reveal section.present img';

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
const exec = (page, id) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)})).then(() => true)`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

async function load(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${DECK}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(readFileSync(DECK, 'utf8'))})`)).problems, []);
  await page.evaluate(`Reveal.slide(${ZONE_ONE})`);
  await frames(page);
  return page;
}

test('on a Mac, a press with Ctrl and a slip of the pointer on a figure does not move it', async (t) => {
  const page = await load(t, 'mac');
  const source = await render(page);
  const label = await undoLabel(page);
  // the slip is away from the menu, which Chrome on a Mac opens at the press, to the lower right
  await drag(page, IMG, { dx: -6, dy: -4, steps: 3, modifiers: 'Ctrl' });
  await frames(page);
  await press(page, 'Escape');
  await frames(page);
  assert.equal(await undoLabel(page), label, 'the press is an entry of the history');
  assert.equal(await render(page), source, 'the figure is moved');
  assert.deepEqual(errors(page), []);
});

test('an undo asked for while a dropped picture is added takes the picture, and not the entry before it', async (t) => {
  const page = await load(t, 'mac');
  await click(page, IMG);
  await frames(page);
  await exec(page, 'arrange.lock');
  await frames(page);
  const locked = await render(page);
  assert.match(locked, /data-locked/);
  // an undo at the first turn in which the picture is in the text of the deck
  await page.evaluate(`(() => {
    window.__undone = new Promise((done) => {
      const look = () => (window.BeesonEditor.render().includes('media/clip-dark.png') ? done(Promise.resolve(window.BeesonEditor.undo()).then(() => true)) : setTimeout(look, 0));
      look();
    });
    return true;
  })()`);
  const at = await page.evaluate(`(() => { const r = document.querySelector(${js(IMG)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const data = { items: [], files: [resolve('demo/clip-dark.png')], dragOperationsMask: 1 };
  for (const type of ['dragEnter', 'dragOver', 'drop']) await page.send('Input.dispatchDragEvent', { type, x: at.x, y: at.y, data });
  await page.evaluate('window.__undone');
  await frames(page);
  assert.equal(await render(page), locked, 'the undo does not give the file from before the drop');
  await page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
  await frames(page);
  const again = await render(page);
  assert.ok(again.includes('media/clip-dark.png') && again.includes('data-locked'), 'a redo does not add the picture again');
  assert.deepEqual(errors(page), []);
});
