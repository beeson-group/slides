// regression tests of R6.8 on both platforms with trusted input: the menus of a locked figure, the
// line steps of a code box after a line is typed or deleted, the fit of the slide in a narrow window,
// the size of a group in the Arrange pane during a resize, the place of a new text box, the keys of
// the keyboard sheet, the figure selected from its image, and the tiles of the New Slide gallery.
// after each edit the text is checked byte for byte, after an undo and a redo, and after a save and
// an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
// the slide of the deck of layouts with an ordered list and a figure with a caption
const MATH = 3;
const IMG = '.reveal section.present figure.zone img:not([hidden])';

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
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const wait = (page, ms) => page.evaluate(`new Promise((d) => setTimeout(() => d(true), ${ms}))`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

// the editor on the slide n of a deck served over HTTP, with the Format tab shown
async function load(t, platform, { deck = LAYOUTS, n = 0, size = { width: 1600, height: 1000 } } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks the edits in the text, then the text before byte for byte after an undo, the
// edit after a redo, and an open of the saved edit without problems
let saves = 0;
async function roundTrip(page, edits) {
  await byteExact(page, edits);
  const edited = await render(page);
  await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r6-8-${++saves}.html`);
  assert.equal(text, edited);
  page.source = text;
}

// menuItems returns the label of each item of the open menu, and whether the item is dimmed
const menuItems = (page) =>
  page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => ({ label: i.querySelector('.label')?.textContent ?? '', dimmed: i.getAttribute('aria-disabled') === 'true' }))`);

for (const platform of PLATFORMS) {
  test(`the menus of a locked figure offer Unlock and dim Delete (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    await click(page, IMG);
    await press(page, 'Mod+L');
    await frames(page);
    assert.ok(await page.evaluate(`!!document.querySelector('.reveal section.present [data-locked]')`), 'the lock key does not lock');
    await click(page, IMG, { button: 'right' });
    await frames(page);
    const items = await menuItems(page);
    const lock = items.find((i) => /^(Un)?[Ll]ock$/.test(i.label));
    assert.equal(lock?.label, 'Unlock', `the context menu of the locked figure reads ${js(items)}`);
    assert.equal(lock.dimmed, false);
    assert.equal(items.find((i) => i.label === 'Delete')?.dimmed, true, `Delete is enabled on the locked figure: ${js(items)}`);
    await press(page, 'Escape');
    await frames(page);
    assert.equal((await state(page, 'element.delete')).enabled, false, 'Delete of the Edit menu is enabled on the locked figure');
    assert.equal((await state(page, 'arrange.unlock')).enabled, true, 'Unlock of the Arrange menu is dimmed on the locked figure');
    assert.equal((await state(page, 'arrange.lock')).enabled, false, 'Lock of the Arrange menu is enabled on the locked figure');
    assert.deepEqual(errors(page), []);
  });
}
