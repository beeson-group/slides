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
