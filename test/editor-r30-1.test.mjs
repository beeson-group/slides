// tests of R30.1, the list of a split button that is folded into More, on both platforms with
// trusted input. in a narrow window the toolbar folds its last groups into the button More, and a
// folded split button whose arrow has a list is a submenu of More with the items of this list, as a
// folded item with a menu is in Keynote. the submenu opens at a hover or the right arrow and closes
// at the left arrow and Esc. each item of the submenu runs its command with its check mark, its key,
// and its dimmed state as in the list of the arrow

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press } from './helpers/editor.mjs';

const DECK = 'test/pages/editor-r22-2.html';
const PLATFORMS = ['mac', 'other'];
const MORE = '.beeson-edit-top .more-groups';
const LAYER = '.beeson-edit-play';
// the slides of the deck
const BACKDROP = 1, STEPS = 2;
const TOOLBAR_KEY = `beeson-edit-toolbar:/${DECK}`;

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
const wait = (page, ms) => page.evaluate(`new Promise((d) => setTimeout(() => d(true), ${ms}))`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const layer = (page) => page.evaluate(`!!document.querySelector('${LAYER}')`);
const rafs = (page) => page.evaluate('Beeson.backdrops.filter((b) => b.raf).length');
const menus = (page) => page.evaluate(`document.querySelectorAll('.beeson-edit-menu').length`);

// the editor on the deck at slide n in a window of width px. the storage of the browser is cleared
// before the load and then given the pairs of stored. with motion, a backdrop is traced
async function load(t, platform, { n = 0, width = 760, stored = {}, motion = false, step = 1000 } = {}) {
  const page = await browser.newPage({ width, height: 700, motion });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${DECK}?edit${motion ? '' : '&still'}&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${js(stored)})) localStorage.setItem(k, v); true`);
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(readFileSync(DECK, 'utf8'))})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`if (window.BeesonEditor.preview) window.BeesonEditor.preview.step = ${step}`);
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

async function resize(page, width) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 700, deviceScaleFactor: 1, mobile: false });
  await frames(page);
  await frames(page);
}

// the rows of the open menu k, the root first: a rule as '-', and an item with its command, label,
// key, check mark, dimmed state, and whether it opens a submenu
const rows = (page, k = -1) => page.evaluate(`[...[...document.querySelectorAll('.beeson-edit-menu')].at(${k}).querySelectorAll(':scope > .item, :scope > .rule')].map((i) => i.matches('.rule') ? '-' : {
  command: i.dataset.command ?? null,
  label: i.querySelector('.label').textContent.trim(),
  keys: i.querySelector('.keys').textContent,
  checked: i.getAttribute('aria-checked'),
  dimmed: i.getAttribute('aria-disabled') === 'true',
  sub: i.getAttribute('aria-haspopup') === 'menu',
})`);
const labels = async (page, k = -1) => (await rows(page, k)).map((r) => (r === '-' ? '-' : r.label));
// the label of the highlighted row of the open menu k
const highlighted = (page, k = -1) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu')].at(${k}).querySelector('.item.hi .label')?.textContent.trim() ?? null`);
// the center of the first row of the open menu k that matches the test fn
const rowAt = (page, k, fn) => page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-edit-menu')[${k}].querySelectorAll('.item')].find(${fn}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

// the rows of the list of the arrow of the split button of command in the toolbar
async function arrowRows(page, command) {
  await click(page, await page.evaluate(`(() => { const r = document.querySelector('.beeson-edit-top [data-command="${command}"]').parentElement.querySelector('.more').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
  await frames(page);
  const out = await rows(page, 0);
  await press(page, 'Escape');
  await frames(page);
  return out;
}

// a hover over the row of label of the open menu k, held until its submenu opens
async function hover(page, label, k = -1) {
  const at = await rowAt(page, k < 0 ? `document.querySelectorAll('.beeson-edit-menu').length - 1` : k, `(i) => i.querySelector('.label').textContent.trim() === ${js(label)}`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x - 4, y: at.y });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
  await wait(page, 300);
}

// a trusted Return with its text, which presses the button of the focus as a keyboard does
async function returnKey(page) {
  const base = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: '\r', unmodifiedText: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await frames(page);
}

// the down arrow in the open menu until the row of label is highlighted
async function downTo(page, label) {
  for (let i = 0; i < 20 && (await highlighted(page)) !== label; i++) await press(page, 'ArrowDown');
  assert.equal(await highlighted(page), label);
}

const glyphs = /[⌘⌥⇧⌃]/;

for (const platform of PLATFORMS) {
  test(`More lists each folded split button with a list as a submenu with the items of its arrow, and the other folded buttons as items (${platform})`, async (t) => {
    const page = await load(t, platform, { width: 1600, n: BACKDROP });
    const SPLITS = { 'insert.shape.rounded': 'Shape', 'insert.image': 'Media', 'preview.slide': 'Preview' };
    const lists = {};
    for (const id of Object.keys(SPLITS)) lists[id] = await arrowRows(page, id);
    await resize(page, 760);
    assert.ok(await page.evaluate(`!document.querySelector('.beeson-edit-top [data-command="preview.slide"]')`), 'Preview is not folded at 760 px');
    await click(page, MORE);
    await frames(page);
    const root = await rows(page, 0);
    assert.deepEqual(root.map((r) => (r === '-' ? '-' : r.label)), ['Table', 'Text', 'Formula', 'Shape', 'Media', '-', 'Preview', 'Present', '-', 'Save']);
    for (const r of root) if (r !== '-') assert.equal(r.sub, Object.values(SPLITS).includes(r.label), `${r.label} opens a submenu: ${r.sub}`);
    for (const [id, label] of Object.entries(SPLITS)) {
      await hover(page, label, 0);
      assert.equal(await menus(page), 2, `the submenu of ${label} is not opened by a hover`);
      assert.deepEqual(await rows(page, 1), lists[id], `the submenu of ${label} is not the list of its arrow`);
    }
    const keys = Object.values(lists).flat().filter((r) => r !== '-' && r.keys).map((r) => r.keys);
    if (platform === 'other') assert.ok(keys.every((k) => !glyphs.test(k)), `a key in the form of the Mac: ${keys}`);
    await press(page, 'Escape');
    assert.deepEqual(errors(page), []);
  });

  test(`the right arrow opens the submenu of Preview in More, the left arrow and Esc close it, and Return runs Play Steps (${platform})`, async (t) => {
    const page = await load(t, platform, { n: STEPS, step: 5000 });
    await page.evaluate(`document.querySelector('${MORE}').focus()`);
    await returnKey(page);
    await frames(page);
    await downTo(page, 'Preview');
    await press(page, 'ArrowRight');
    await frames(page);
    assert.equal(await menus(page), 2, 'the right arrow does not open the submenu of Preview');
    assert.deepEqual(await labels(page, 1), ['Play Slide', 'Trace Backdrop', 'Play Steps', '-', 'Select Backdrop', 'Add Backdrop…']);
    assert.equal(await highlighted(page, 1), 'Play Slide', 'the first item of the submenu is not highlighted');
    await press(page, 'ArrowLeft');
    assert.equal(await menus(page), 1, 'the left arrow does not close the submenu');
    assert.equal(await highlighted(page, 0), 'Preview');
    await press(page, 'ArrowRight');
    await press(page, 'Escape');
    assert.equal(await menus(page), 1, 'Esc does not close the submenu alone');
    assert.equal(await highlighted(page, 0), 'Preview');
    await press(page, 'ArrowRight');
    await downTo(page, 'Play Steps');
    await press(page, 'Enter');
    await frames(page);
    assert.equal(await menus(page), 0);
    assert.equal(await layer(page), true, 'Play Steps does not play the steps');
    assert.deepEqual(errors(page), []);
  });

  test(`while a preview plays, the item Play Slide of the submenu of Preview reads Stop and stops it (${platform})`, async (t) => {
    const page = await load(t, platform, { n: STEPS, step: 5000 });
    await page.evaluate(`window.BeesonEditor.exec('preview.steps')`);
    await frames(page);
    assert.equal(await layer(page), true);
    await click(page, MORE);
    await frames(page);
    assert.equal(await layer(page), true, 'a press on More stops the preview');
    await hover(page, 'Preview', 0);
    assert.equal(await menus(page), 2, 'the submenu of Preview is not opened by a hover');
    const sub = await rows(page, 1);
    assert.deepEqual(sub.map((r) => (r === '-' ? '-' : r.label)), ['Stop', 'Trace Backdrop', 'Play Steps', '-', 'Select Backdrop', 'Add Backdrop…']);
    assert.equal(sub[0].command, 'preview.slide');
    assert.equal(sub[0].dimmed, false);
    await click(page, await rowAt(page, 1, `(i) => i.dataset.command === 'preview.slide'`));
    await frames(page);
    assert.equal(await layer(page), false, 'Stop does not stop the preview');
    // after the preview the item reads Play Slide again
    await click(page, MORE);
    await hover(page, 'Preview', 0);
    assert.equal((await labels(page, 1))[0], 'Play Slide');
    await press(page, 'Escape');
    assert.deepEqual(errors(page), []);
  });

  test(`a click on Trace Backdrop in the submenu of Preview in More traces the backdrop (${platform})`, async (t) => {
    const page = await load(t, platform, { n: BACKDROP, motion: true });
    await click(page, MORE);
    await hover(page, 'Preview', 0);
    assert.equal(await menus(page), 2, 'the submenu of Preview is not opened by a hover');
    await click(page, await rowAt(page, 1, `(i) => i.dataset.command === 'preview.backdrop'`));
    await frames(page);
    assert.ok((await rafs(page)) > 0, 'the backdrop is not traced');
    assert.deepEqual(errors(page), []);
  });

  // the group of View is the first group of the default toolbar, which is never folded, hence this
  // test puts View after the space of a customized toolbar
  test(`a folded View is a submenu of More with Navigator first, before a rule, then the items of its arrow, with the keys of the platform (${platform})`, async (t) => {
    const items = ['edit.undo', 'edit.redo', 'separator', 'slide.gallery', 'space', 'toolbar.view', 'toolbar.zoom', 'separator', 'file.save', 'separator', 'shell.format', 'view.steps'];
    const page = await load(t, platform, { width: 1600, stored: { [TOOLBAR_KEY]: js({ items, show: 'both' }) } });
    const list = await arrowRows(page, 'toolbar.view');
    await resize(page, 420);
    assert.ok(await page.evaluate(`!document.querySelector('.beeson-edit-top [data-command="toolbar.view"]')`), 'View is not folded at 420 px');
    await click(page, MORE);
    await frames(page);
    const root = await rows(page, 0);
    const view = root.find((r) => r !== '-' && r.label === 'View');
    assert.ok(view?.sub, `View is not a submenu of More: ${js(root)}`);
    assert.ok(root.every((r) => r === '-' || r.label === 'View' || !r.sub), 'a folded button without a list opens a submenu');
    await hover(page, 'View', 0);
    const sub = await rows(page, 1);
    assert.deepEqual(sub.slice(2), list, 'the submenu of View is not the list of its arrow after Navigator');
    assert.equal(sub[1], '-');
    assert.equal(sub[0].label, 'Navigator');
    assert.equal(sub[0].checked, String((await state(page, 'view.navigator')).checked));
    const grid = sub.find((r) => r !== '-' && r.command === 'view.grid');
    assert.equal(grid.keys, platform === 'mac' ? "⌘'" : "Ctrl+'");
    // the right arrow opens the submenu, and Return runs Rulers
    await press(page, 'Escape');
    assert.equal(await menus(page), 1, 'Esc does not close the submenu alone');
    await press(page, 'Escape');
    assert.equal(await menus(page), 0);
    await page.evaluate(`document.querySelector('${MORE}').focus()`);
    await returnKey(page);
    await downTo(page, 'View');
    await press(page, 'ArrowRight');
    assert.equal(await menus(page), 2);
    assert.equal(await highlighted(page, 1), 'Navigator');
    const rulers = (await state(page, 'view.rulers')).checked;
    await downTo(page, 'Rulers');
    await press(page, 'Enter');
    await frames(page);
    assert.equal((await state(page, 'view.rulers')).checked, !rulers, 'Rulers is not run from the submenu');
    // a click on Navigator shows or hides the navigator as the main part of View does
    const nav = (await state(page, 'view.navigator')).checked;
    await click(page, MORE);
    await hover(page, 'View', 0);
    await click(page, await rowAt(page, 1, `(i) => i.dataset.command === 'view.navigator'`));
    await frames(page);
    assert.equal((await state(page, 'view.navigator')).checked, !nav, 'Navigator is not run from the submenu');
    assert.deepEqual(errors(page), []);
  });
}
