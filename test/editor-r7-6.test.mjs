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

// the ids of the buttons of the toolbar, in their order
const toolbarIds = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-top [data-command]')].map((b) => b.dataset.command)`);
const KEY = `beeson-edit-toolbar:/${LAYOUTS}`;
const kept = (page) => page.evaluate(`JSON.parse(localStorage.getItem(${js(KEY)}) ?? 'null')`);

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

  test(`a drag of the zoom slider near its tick at 100% snaps to 100% (${platform})`, async (t) => {
    const page = await load(t, platform);
    const slider = '.beeson-edit-bottom .slider input';
    const thumb = async () => {
      const r = await boxOf(page, slider);
      const v = Number(await page.evaluate(`document.querySelector(${js(slider)}).value`));
      return { x: r.x + 7 + ((r.w - 14) * v) / 1000, y: r.y + r.h / 2 };
    };
    const tick = await center(page, '.beeson-edit-bottom .slider .tick');
    const readout = () => page.evaluate(`document.querySelector('.beeson-edit-top [data-command="toolbar.zoom"] .readout').textContent`);
    assert.equal(await readout(), 'Fit');
    // a drag that ends 3 px past the tick gives 100%, with the thumb on the tick
    let from = await thumb();
    await drag(page, from, { dx: tick.x + 3 - from.x, dy: 0, steps: 12 });
    await frames(page);
    assert.equal(await readout(), '100%');
    assert.ok(Math.abs((await thumb()).x - tick.x) < 1, `the thumb is at ${(await thumb()).x} and the tick at ${tick.x}`);
    // a drag that ends 12 px past the tick does not snap
    from = await thumb();
    await drag(page, from, { dx: 12, dy: 0, steps: 6 });
    await frames(page);
    assert.ok(Number((await readout()).replace('%', '')) > 110, await readout());
    // the arrow keys move the slider past the tick
    await page.evaluate(`document.querySelector(${js(slider)}).focus()`);
    for (let i = 0; i < 3; i++) await press(page, 'ArrowLeft');
    assert.notEqual(await readout(), '100%');
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`Customize Toolbar adds and removes items by drags, sets Show, keeps the layout for the deck, and the default set restores it (${platform})`, async (t) => {
    let page = await load(t, platform);
    const defaults = await toolbarIds(page);
    assert.deepEqual(defaults.slice(0, 3), ['toolbar.view', 'toolbar.zoom', 'edit.undo']);
    await openBar(page, 'View');
    const labels = await menuLabels(page);
    assert.equal(labels[labels.length - 1], 'Customize Toolbar…');
    await choose(page, 'Customize Toolbar…');
    assert.equal(await page.evaluate(`!document.querySelector('.beeson-edit-customize').hidden`), true);
    const items = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-customize .palette .item')].map((i) => i.dataset.item)`);
    for (const id of ['toolbar.view', 'insert.table', 'file.present', 'find.open', 'arrange.lock', 'separator', 'space']) assert.ok(items.includes(id), `the sheet has no item ${id}`);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-customize .foot .show').textContent`), 'Icon and Text');
    // a button of the toolbar does not run its command while the sheet is open
    await click(page, '.beeson-edit-top [data-command="slide.gallery"]');
    assert.equal(await render(page), page.source);

    // Find dragged from the sheet onto the left half of Redo is put before it
    const find = await center(page, '.beeson-edit-customize .item[data-item="find.open"]');
    const redo = await boxOf(page, '.beeson-edit-top [data-command="edit.redo"]');
    await drag(page, find, { dx: redo.x + 6 - find.x, dy: redo.y + redo.h / 2 - find.y, steps: 14 });
    await frames(page);
    let ids = await toolbarIds(page);
    assert.equal(ids[ids.indexOf('edit.redo') - 1], 'find.open');
    // Table dragged from the toolbar into the sheet is taken off
    const table = await center(page, '.beeson-edit-top [data-command="insert.table"]');
    await drag(page, table, { dx: 0, dy: 260, steps: 10 });
    await frames(page);
    ids = await toolbarIds(page);
    assert.ok(!ids.includes('insert.table'));
    assert.ok(ids.includes('find.open'));

    // Show Icon Only hides the labels, and the layout is kept for this deck
    await click(page, '.beeson-edit-customize .foot .show');
    await frames(page);
    assert.deepEqual(await menuLabels(page), ['Icon and Text', 'Icon Only', 'Text Only']);
    await choose(page, 'Icon Only');
    const label = () => page.evaluate(`getComputedStyle(document.querySelector('.beeson-edit-top [data-command="file.present"] .label')).display`);
    const glyph = () => page.evaluate(`getComputedStyle(document.querySelector('.beeson-edit-top [data-command="file.present"] .beeson-icon')).display`);
    assert.equal(await label(), 'none');
    let saved = await kept(page);
    assert.equal(saved.show, 'icon');
    assert.ok(saved.items.includes('find.open') && !saved.items.includes('insert.table'));
    await click(page, '.beeson-edit-customize .foot .done');
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-customize').hidden`), true);
    // the new button runs its command once the sheet is closed
    await click(page, '.beeson-edit-top [data-command="find.open"]');
    await page.waitFor(`!document.querySelector('.beeson-find').hidden`);
    await press(page, 'Escape');
    assert.equal(await render(page), page.source);
    assert.equal((await page.evaluate('window.BeesonEditor.status()')).dirty, false);

    // the layout is shown again when the deck is opened again, and not on another deck
    const layout = await toolbarIds(page);
    await page.close();
    const other = await load(t, platform, { deck: 'index.html', clear: false });
    assert.deepEqual((await toolbarIds(other)).slice(0, 3), ['toolbar.view', 'toolbar.zoom', 'edit.undo']);
    assert.ok(!(await toolbarIds(other)).includes('find.open'));
    await other.close();
    page = await load(t, platform, { clear: false });
    assert.deepEqual(await toolbarIds(page), layout);
    assert.equal(await label(), 'none');

    // Text Only hides the icons, and the default set dragged into the toolbar restores it
    await exec(page, 'view.customizeToolbar');
    await click(page, '.beeson-edit-customize .foot .show');
    await choose(page, 'Text Only');
    assert.equal(await glyph(), 'none');
    assert.notEqual(await label(), 'none');
    const row = await center(page, '.beeson-edit-customize .default');
    const bar = await boxOf(page, '.beeson-edit-top');
    await drag(page, row, { dx: bar.x + bar.w / 2 - row.x, dy: bar.y + bar.h / 2 - row.y, steps: 12 });
    await frames(page);
    await click(page, '.beeson-edit-customize .foot .done');
    await frames(page);
    assert.deepEqual(await toolbarIds(page), defaults);
    saved = await kept(page);
    assert.deepEqual(saved, { items: null, show: 'text' });
    // with Icon and Text and the default set, nothing is kept
    await exec(page, 'view.customizeToolbar');
    await click(page, '.beeson-edit-customize .foot .show');
    await choose(page, 'Icon and Text');
    await press(page, 'Escape');
    assert.equal(await kept(page), null);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`Customize Toolbar works from the keyboard: Return adds an item, Delete takes one off, and Esc closes the sheet (${platform})`, async (t) => {
    const page = await load(t, platform);
    const defaults = await toolbarIds(page);
    await exec(page, 'view.customizeToolbar');
    assert.equal(await page.evaluate(`document.activeElement.matches('.beeson-edit-customize .item')`), true);
    await page.evaluate(`document.querySelector('.beeson-edit-customize .item[data-item="arrange.lock"]').focus()`);
    await press(page, 'Enter');
    let ids = await toolbarIds(page);
    // an item added from the keyboard is put before the space, i.e. after Present
    assert.equal(ids[ids.indexOf('file.present') + 1], 'arrange.lock');
    await page.evaluate(`document.querySelector('.beeson-edit-top [data-command="arrange.lock"]').focus()`);
    await press(page, 'Delete');
    assert.deepEqual(await toolbarIds(page), defaults);
    await page.evaluate(`document.querySelector('.beeson-edit-top [data-command="edit.undo"]').focus()`);
    await press(page, 'Backspace');
    assert.ok(!(await toolbarIds(page)).includes('edit.undo'));
    // Return on the default set puts it back
    await page.evaluate(`document.querySelector('.beeson-edit-customize .default').focus()`);
    await press(page, 'Enter');
    assert.deepEqual(await toolbarIds(page), defaults);
    await press(page, 'Escape');
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-customize').hidden`), true);
    assert.equal(await kept(page), null);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`the state of accessibility in the status bar opens the docked pane, where a fix turns it to Good to go (${platform})`, async (t) => {
    const text = readFileSync(LAYOUTS, 'utf8').replace(PAPER, BARE);
    const page = await load(t, platform, { text, change: `document.querySelector('.reveal img.paper').removeAttribute('alt')` });
    const status = '.beeson-edit-bottom .a11y';
    await page.waitFor(`!document.querySelector(${js(status)}).hidden && document.querySelector(${js(status)}).textContent === 'Accessibility: Investigate'`);
    const canvas = await boxOf(page, '.beeson-edit-canvas');
    await click(page, status);
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelector(${js(status)}).getAttribute('aria-pressed')`), 'true');
    // the pane is docked between the canvas and the inspector, which keeps its place
    const pane = await boxOf(page, '.beeson-edit-a11y');
    const inspector = await boxOf(page, '.beeson-edit-inspector');
    const shrunk = await boxOf(page, '.beeson-edit-canvas');
    assert.ok(Math.abs(pane.right - inspector.x) <= 1, `the pane ends at ${pane.right} and the inspector starts at ${inspector.x}`);
    assert.ok(Math.abs(shrunk.right - pane.x) <= 1, `the canvas ends at ${shrunk.right} and the pane starts at ${pane.x}`);
    assert.ok(Math.abs(shrunk.w + pane.w - canvas.w) <= 1);
    assert.ok(pane.y < shrunk.y + 1 && pane.bottom >= shrunk.bottom, 'the pane runs the height of the canvas');
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-a11y').getAttribute('role')`), 'complementary');
    // Add Alt Text writes the alt, and the state turns to Good to go
    await click(page, '.beeson-edit-a11y .item .fix');
    await frames(page);
    await choose(page, 'Add Alt Text');
    await page.waitFor(`document.activeElement?.matches('.beeson-edit-a11y .alt input')`);
    await type(page, 'A paper figure');
    await press(page, 'Enter');
    await page.waitFor(`!document.querySelector('.beeson-edit-a11y .item')`);
    await page.waitFor(`document.querySelector(${js(status)}).textContent === 'Accessibility: Good to go'`);
    // the close button of the pane hides it, and the canvas takes its width back
    await click(page, '.beeson-edit-a11y .title .close');
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-a11y').hidden`), true);
    assert.equal((await boxOf(page, '.beeson-edit-canvas')).w, canvas.w);
    assert.equal(await page.evaluate(`document.querySelector(${js(status)}).getAttribute('aria-pressed')`), 'false');
    // an undo and a redo with the pane closed are seen in the state
    await press(page, 'Mod+Z');
    await page.waitFor(`document.querySelector(${js(status)}).textContent === 'Accessibility: Investigate'`);
    await press(page, platform === 'mac' ? 'Mod+Shift+Z' : 'Mod+Y');
    await page.waitFor(`document.querySelector(${js(status)}).textContent === 'Accessibility: Good to go'`);
    await roundTrip(page, [[BARE, '<img class="paper" src="../../demo/figure-light.png" alt="A paper figure">']]);
    assert.deepEqual(errors(page), []);
  });
}
