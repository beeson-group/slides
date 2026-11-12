// regression test of R31.3 on both platforms with trusted input. a skeptic of R27.2: with the caret
// in a cell of a table, the Slide menu printed the key of Edit > Duplicate beside Duplicate Slide,
// where the key does not do anything, since Duplicate is dimmed in a cell

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const ROWS = 'test/pages/editor-r27-2.html';

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
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const count = (page) => page.evaluate(`document.querySelectorAll('.reveal .slides > section').length`);
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

async function load(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${ROWS}?edit&still&theme=light&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(readFileSync(ROWS, 'utf8'))})`);
  assert.deepEqual(s.problems, []);
  await frames(page);
  return page;
}

// the key printed beside the item of label in the menu bar of bar
async function keyIn(page, bar, label) {
  const i = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].findIndex((b) => b.textContent === ${js(bar)})`);
  await click(page, `.beeson-edit-menubar [role=menuitem]:nth-child(${i + 1})`);
  const items = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => ({ label: i.querySelector('.label')?.textContent, keys: i.querySelector('.keys')?.textContent ?? '' }))`);
  await page.evaluate('window.BeesonEditorShell.closeMenus(); true');
  return items.find((i) => i.label === label)?.keys;
}

for (const platform of PLATFORMS) {
  test(`with the caret in a cell, the Slide menu does not print the key of Duplicate, which is dimmed there (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, 'section.present td');
    await frames(page);
    assert.equal(await page.evaluate(`document.activeElement?.closest('td, th') !== null`), true, 'the caret is not in a cell');
    const slides = await count(page);
    await press(page, 'Mod+d');
    await frames(page);
    assert.equal(await count(page), slides, 'the key of Duplicate duplicates the slide from a cell, hence this test is out of date');
    await click(page, 'section.present td');
    await frames(page);
    assert.equal(await keyIn(page, 'Slide', 'Duplicate Slide'), '', 'the Slide menu prints a key beside Duplicate Slide that does not run it');
    assert.deepEqual(errors(page), []);
  });
}
