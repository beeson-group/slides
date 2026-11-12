// regression tests of R45, the defects found by the last review of the editor. on a Mac, a press
// with Ctrl is a secondary click, which opens the context menu and does not move the element under
// it at a slip of the pointer

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { drag, press } from './helpers/editor.mjs';

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
