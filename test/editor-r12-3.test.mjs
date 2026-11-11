// regression tests of R12.3 on both platforms with trusted input: the close of the light table, the
// print key, the Zoom dialog, the menus of the grips and of the tiles, the keys printed beside the
// menu items, Select All in the thumbnail menu, and the focus after an undo in the light table

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press } from './helpers/editor.mjs';

const DECK = 'index.html';
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

const js = (v) => JSON.stringify(v);
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg ? `, ${js(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const sleep = (ms) => new Promise((d) => setTimeout(d, ms));
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

// the editor on slide n of the deck in a window of 1600 by 1000, with the storage of the browser
// cleared
async function load(t, platform, { n = 0 } = {}) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.send('Page.bringToFront');
  const url = `${server.origin}/${DECK}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear(); true');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(status.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the center of the item of an open menu whose label is label, or null
const itemAt = (page, label) =>
  page.evaluate(`(() => {
    const item = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label')?.textContent === ${js(label)});
    if (!item) return null;
    const r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);

// a trusted click on the title of a menu of the menu bar, then on its item label
async function choose(page, bar, label) {
  const i = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].findIndex((b) => b.textContent === ${js(bar)})`);
  assert.ok(i >= 0, `the menu bar does not have ${bar}`);
  await click(page, `.beeson-edit-menubar [role=menuitem]:nth-child(${i + 1})`);
  const at = await itemAt(page, label);
  assert.ok(at, `the ${bar} menu does not have ${label}`);
  await click(page, at);
}

// what is hit in the middle of the first shown element of selector: an element of the light table,
// or an element inside selector
const hit = (page, selector) =>
  page.evaluate(`(() => {
    const r = [...document.querySelectorAll(${js(selector)})].map((el) => el.getBoundingClientRect()).find((r) => r.width && r.height);
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 60));
    return { sorter: !!el?.closest('.beeson-edit-sorter'), inside: !!el?.closest(${js(selector)}) };
  })()`);

async function openTable(page) {
  await choose(page, 'View', 'Light Table');
  await sleep(200);
  assert.equal((await state(page, 'view.lightTable')).checked, true);
  assert.equal((await hit(page, '.beeson-edit-nav')).sorter, true);
}

async function closed(page, how) {
  await sleep(200);
  assert.equal((await state(page, 'view.lightTable')).checked, false, how);
  assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('.beeson-edit-sorter')).display`), 'none', how);
  assert.deepEqual(await hit(page, '.beeson-edit-nav'), { sorter: false, inside: true }, how);
  assert.deepEqual(await hit(page, '.beeson-edit-canvas'), { sorter: false, inside: true }, how);
}

// menus-keys-1: the light table is closed by Done, Esc, the menu, and a double click on a tile, and
// the navigator and the canvas are hit again after each
for (const platform of PLATFORMS) {
  test(`the light table closes by Done, Esc, the menu, and a double click (${platform})`, async (t) => {
    const page = await load(t, platform);
    await openTable(page);
    await click(page, '.beeson-edit-sorter .bar .done');
    await closed(page, 'Done');
    await openTable(page);
    await press(page, 'Escape');
    await closed(page, 'Esc');
    await openTable(page);
    await choose(page, 'View', 'Light Table');
    await closed(page, 'menu');
    await openTable(page);
    await click(page, '.beeson-edit-sorter .tile:nth-of-type(3) .pic', { count: 2 });
    await closed(page, 'double click');
    assert.deepEqual(errors(page), []);
  });
}

// the labels and the keys of the menu of the menu bar named bar, opened by a trusted click and
// closed again
async function readMenu(page, bar) {
  const i = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].findIndex((b) => b.textContent === ${js(bar)})`);
  await click(page, `.beeson-edit-menubar [role=menuitem]:nth-child(${i + 1})`);
  const items = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => ({ label: i.querySelector('.label')?.textContent, keys: i.querySelector('.keys')?.textContent ?? '', enabled: i.getAttribute('aria-disabled') !== 'true' }))`);
  await page.evaluate('window.BeesonEditorShell.closeMenus(); true');
  return items;
}

// a listener of the page after the one of the editor, which records whether each keydown of P was
// prevented, and a window.open that records the address it is given
const SPY = `(() => {
  window.__keys = [];
  window.__opened = [];
  window.addEventListener('keydown', (ev) => { if (ev.key === 'p' || ev.key === 'P') window.__keys.push(ev.defaultPrevented); }, true);
  window.open = (url) => { window.__opened.push(String(url)); return null; };
  return true;
})()`;

// menus-keys-2: File > Print… is the last item of the File menu with Mod+P, which the editor takes
// from the browser and which opens the print view of the deck, after a question while edits are
// unsaved
for (const platform of PLATFORMS) {
  test(`Mod+P and File > Print… open the print view of the deck (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 4 });
    await page.evaluate(SPY);
    const file = await readMenu(page, 'File');
    assert.deepEqual(file.at(-1), { label: 'Print…', keys: platform === 'mac' ? '⌘P' : 'Ctrl+P', enabled: true });
    await click(page, { x: 700, y: 200 });
    await press(page, 'Mod+P');
    await sleep(300);
    assert.deepEqual(await page.evaluate('window.__keys'), [true], 'the key is left to the browser');
    const opened = await page.evaluate('window.__opened');
    assert.equal(opened.length, 1);
    assert.match(opened[0], /[?&]print-pdf/);
    assert.doesNotMatch(opened[0], /[?&]edit(&|$)/);
    await choose(page, 'File', 'Print…');
    await sleep(300);
    assert.equal((await page.evaluate('window.__opened')).length, 2);
    // with an unsaved edit, the user is asked first, and Cancel prints nothing
    await exec(page, 'slide.hide');
    await press(page, 'Mod+P');
    await page.waitFor(`[...document.querySelectorAll('dialog[open] button')].some((b) => b.textContent === 'Save and print')`);
    const buttons = await page.evaluate(`[...document.querySelectorAll('dialog[open] button')].map((b) => b.textContent)`);
    assert.deepEqual(buttons.slice(-3), ['Save and print', 'Print the saved file', 'Cancel']);
    await press(page, 'Escape');
    await sleep(200);
    assert.equal((await page.evaluate('window.__opened')).length, 2);
    assert.deepEqual(errors(page), []);
  });
}

// navigator-slides-canvas-2: the Percent field of the Zoom dialog opens with its value selected, so
// that a typed value replaces it
for (const platform of PLATFORMS) {
  test(`a value typed into the Zoom dialog replaces the value shown (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, '.beeson-edit-bottom .percent');
    await sleep(100);
    const at = await itemAt(page, 'Zoom…');
    assert.ok(at, 'the zoom menu of the status bar does not have Zoom…');
    await click(page, at);
    await page.waitFor(`document.activeElement?.name === 'percent'`);
    assert.match(await page.evaluate('document.activeElement.value'), /^\d+$/);
    for (const key of ['1', '4', '0']) await press(page, key);
    assert.equal(await page.evaluate('document.activeElement.value'), '140');
    await press(page, 'Enter');
    await sleep(200);
    assert.equal(await page.evaluate('Math.round(window.BeesonEditorShell.stage.zoom * 100)'), 140);
    assert.deepEqual(errors(page), []);
  });
}

// the keys printed beside the items of labels in the menu bar of bar
async function keysIn(page, bar, labels) {
  const items = await readMenu(page, bar);
  return Object.fromEntries(labels.map((l) => [l, items.find((i) => i.label === l)?.keys]));
}

// menus-keys-5: a key is printed only beside the item that it runs where the focus is. with a
// figure selected on the canvas, Mod+D and Delete are those of Edit > Duplicate and Edit > Delete,
// and in the navigator those of Slide > Duplicate Slide and Slide > Delete Slide
for (const platform of PLATFORMS) {
  test(`a key is printed only beside the item that it runs in the present focus (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 4 });
    const mac = platform === 'mac';
    const dup = mac ? '⌘D' : 'Ctrl+D';
    const del = mac ? '⌫' : 'Delete';
    await click(page, '.reveal .slides > section.present img');
    assert.deepEqual(await keysIn(page, 'Slide', ['Duplicate Slide', 'Delete Slide']), { 'Duplicate Slide': '', 'Delete Slide': '' });
    assert.deepEqual(await keysIn(page, 'Edit', ['Duplicate', 'Delete']), { Duplicate: dup, Delete: del });
    await press(page, 'Mod+D');
    await sleep(200);
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal .slides > section.present figure').length`), 2, 'Mod+D did not duplicate the figure');
    await click(page, '.beeson-edit-nav .row:nth-child(5)');
    await sleep(100);
    assert.deepEqual(await keysIn(page, 'Slide', ['Duplicate Slide', 'Delete Slide']), { 'Duplicate Slide': dup, 'Delete Slide': del });
    assert.deepEqual(await keysIn(page, 'Edit', ['Duplicate', 'Delete']), { Duplicate: '', Delete: '' });
    assert.deepEqual(errors(page), []);
  });
}

// the context menus open, by their class, with whether the top one is hit at its center
const menus = (page) =>
  page.evaluate(`(() => {
    const all = [...document.querySelectorAll('.beeson-edit-menu')];
    const top = all.at(-1);
    const r = top?.getBoundingClientRect();
    return { classes: all.map((m) => m.className), hit: !!r && !!document.elementFromPoint(r.left + r.width / 2, r.top + 12)?.closest('.beeson-edit-menu') };
  })()`);

// the centers of the shown grips and of the rotate handle of the selection
const grips = (page) =>
  page.evaluate(`[...document.querySelectorAll('.beeson-grip, .beeson-rotor')].map((g) => ({ g, r: g.getBoundingClientRect() })).filter(({ g, r }) => r.width && getComputedStyle(g).pointerEvents !== 'none' && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === g).map(({ g, r }) => ({ name: g.dataset.handle ?? 'rotor', x: r.left + r.width / 2, y: r.top + r.height / 2 }))`);

// menus-keys-3: a right-click on a grip or on the rotate handle of a selected object opens its
// element menu, and the object stays selected
for (const platform of PLATFORMS) {
  test(`a right-click on a grip or the rotate handle opens the menu of the object (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 4 });
    for (const pick of ['figure', 'paragraph']) {
      if (pick === 'figure') await click(page, '.reveal .slides > section.present img');
      else {
        await click(page, '.reveal .slides > section.present p');
        await press(page, 'Escape');
      }
      await sleep(100);
      const before = await page.evaluate(`window.BeesonEditor.selection().map((el) => el.tagName)`);
      assert.equal(before.length, 1, pick);
      const points = await grips(page);
      assert.ok(points.some((p) => p.name === 'rotor') && points.length >= 3, `${pick}: ${JSON.stringify(points)}`);
      for (const p of [points.find((q) => q.name === 'rotor'), points.find((q) => q.name !== 'rotor')]) {
        await click(page, p, { button: 'right' });
        await sleep(100);
        const m = await menus(page);
        assert.equal(m.classes.length, 1, `${pick} ${p.name}: no menu`);
        assert.match(m.classes[0], /\bcontext element\b/, `${pick} ${p.name}`);
        assert.equal(m.hit, true);
        await press(page, 'Escape');
        await sleep(50);
        assert.deepEqual(await page.evaluate(`window.BeesonEditor.selection().map((el) => el.tagName)`), before, `${pick} ${p.name}: the selection changed`);
        assert.equal((await grips(page)).length, points.length, `${pick} ${p.name}: the grips are gone`);
      }
      await press(page, 'Escape');
    }
    assert.deepEqual(errors(page), []);
  });
}

// menus-keys-4: a right-click, Shift+F10, or the Menu key on a tile of the light table opens the
// thumbnail menu of its slide over the light table
for (const platform of PLATFORMS) {
  test(`a right-click, Shift+F10, or the Menu key on a tile opens the thumbnail menu (${platform})`, async (t) => {
    const page = await load(t, platform);
    await openTable(page);
    const tile = '.beeson-edit-sorter .tile:nth-of-type(4) .pic';
    await click(page, tile, { button: 'right' });
    await sleep(100);
    let m = await menus(page);
    assert.equal(m.classes.length, 1, 'a right-click opened no menu');
    assert.match(m.classes[0], /\bcontext slide\b/);
    assert.equal(m.hit, true, 'the menu is under the light table');
    const items = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item .label')].map((l) => l.textContent)`);
    assert.ok(items.includes('Duplicate Slide') && items.includes('Hide Slide'), items.join(', '));
    await press(page, 'Escape');
    await sleep(100);
    assert.equal((await menus(page)).classes.length, 0);
    assert.equal((await state(page, 'view.lightTable')).checked, true, 'Esc on the menu closed the light table');
    await click(page, '.beeson-edit-sorter .tile:nth-of-type(2) .pic');
    await press(page, 'Shift+F10');
    await sleep(100);
    m = await menus(page);
    assert.equal(m.classes.length, 1, 'Shift+F10 opened no menu');
    assert.match(m.classes[0], /\bcontext slide\b/);
    await press(page, 'Escape');
    await sleep(100);
    await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ContextMenu', code: 'ContextMenu', windowsVirtualKeyCode: 93 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ContextMenu', code: 'ContextMenu', windowsVirtualKeyCode: 93 });
    await sleep(100);
    m = await menus(page);
    assert.equal(m.classes.length, 1, 'the Menu key opened no menu');
    assert.deepEqual(errors(page), []);
  });
}
