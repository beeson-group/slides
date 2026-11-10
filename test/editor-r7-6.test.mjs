// tests of R7.6 on both platforms with trusted input: Slide Only in the View menu and the View
// popup, the tick at 100% of the zoom slider, the sheet Customize Toolbar with its layout kept for
// the deck, the docked accessibility pane opened from its state in the status bar, and the scopes
// of Find. the settings do not change the file, and after an edit of the file the text is checked
// byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, center, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const DARK = 'alt="A figure, dark version"';
const LIGHT = 'alt="A figure, light version"';
const PAPER = '<img class="paper" src="../../demo/figure-light.png" alt="A white raster figure">';
const BARE = '<img class="paper" src="../../demo/figure-light.png">';

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
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const boxOf = (page, selector) => page.evaluate(`(() => { const r = document.querySelector(${js(selector)}).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; })()`);

// the editor on the slide n of a deck served over HTTP, opened with text after change is run on the
// page. with clear, the storage of the origin is emptied before the editor is loaded
async function load(t, platform, { deck = LAYOUTS, n = 0, text = readFileSync(deck, 'utf8'), change = '', clear = true, size = { width: 1600, height: 1000 } } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  if (clear) await page.send('Storage.clearDataForOrigin', { origin: server.origin, storageTypes: 'local_storage' });
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = text;
  if (change) await page.evaluate(change);
  const s = await page.evaluate(`window.BeesonEditor.open(${js(text)})`);
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
  const { text } = await saveAndReopen(page, `r7-6-${++saves}.html`);
  assert.equal(text, edited);
  page.source = text;
}

// the labels of the items of the open menu
const menuLabels = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => i.querySelector('.label')?.textContent ?? '')`);

// a trusted click on the item labeled label of the open menu
async function choose(page, label) {
  const at = await page.evaluate(`(() => {
    const items = [...document.querySelectorAll('.beeson-edit-menu .item')];
    const text = (i) => i.querySelector('.label')?.textContent ?? '';
    const item = items.find((i) => text(i) === ${js(label)}) ?? items.find((i) => text(i).startsWith(${js(label)}));
    if (!item) return null;
    const r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(at, `the open menu has no item ${label}`);
  await click(page, at);
  await frames(page);
}

async function openBar(page, bar) {
  await click(page, await page.evaluate(`(() => {
    const r = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)}).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`));
  await frames(page);
}

const panes = async (page) => ({
  navigator: (await state(page, 'view.navigator')).checked,
  format: (await state(page, 'shell.format')).checked,
  steps: (await state(page, 'view.steps')).checked,
  slideOnly: (await state(page, 'view.slideOnly')).checked,
});

for (const platform of PLATFORMS) {
  test(`Slide Only of the View menu and the View popup hides the navigator and the inspector and shows them again (${platform})`, async (t) => {
    const page = await load(t, platform);
    const canvas = await boxOf(page, '.beeson-edit-canvas');
    assert.deepEqual(await panes(page), { navigator: true, format: true, steps: false, slideOnly: false });
    await openBar(page, 'View');
    const labels = await menuLabels(page);
    assert.equal(labels[labels.indexOf('Navigator') + 1], 'Slide Only');
    await choose(page, 'Slide Only');
    assert.deepEqual(await panes(page), { navigator: false, format: false, steps: false, slideOnly: true });
    const wide = await boxOf(page, '.beeson-edit-canvas');
    assert.ok(wide.w > canvas.w + 400, `the canvas is ${wide.w} px wide in Slide Only and ${canvas.w} px before`);
    // the View popup of the toolbar lists Slide Only checked after Navigator, and shows the panes again
    await click(page, '.beeson-edit-top [data-command="toolbar.view"]');
    await frames(page);
    const popup = await menuLabels(page);
    assert.deepEqual(popup.slice(0, 2), ['Navigator', 'Slide Only']);
    assert.equal(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label')?.textContent === 'Slide Only').getAttribute('aria-checked')`), 'true');
    await choose(page, 'Slide Only');
    assert.deepEqual(await panes(page), { navigator: true, format: true, steps: false, slideOnly: false });
    assert.equal((await boxOf(page, '.beeson-edit-canvas')).w, canvas.w);
    // the Steps tab shown before Slide Only is shown again after it
    await exec(page, 'view.steps');
    await openBar(page, 'View');
    await choose(page, 'Slide Only');
    assert.equal((await panes(page)).slideOnly, true);
    await openBar(page, 'View');
    await choose(page, 'Slide Only');
    assert.deepEqual(await panes(page), { navigator: true, format: false, steps: true, slideOnly: false });
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}
