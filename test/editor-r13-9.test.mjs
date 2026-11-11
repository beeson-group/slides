// the Plot Data window of the editor, on both platforms: Undo and Redo pressed in a cell after Enter
// act on the history of the editor, and not on the text of the field. the keys are sent with the
// editing command that a real keyboard gives them, which a field would otherwise take

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const WINDOW = '.beeson-plotdata';
const PLOT_SLIDE = 8;
const MOD = { mac: 4, other: 2 };
const SHIFT = 8;

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

const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const cell = (r, c) => `${WINDOW} input[data-r="${r}"][data-c="${c}"]`;
const grid = (page) => page.evaluate(`[...document.querySelectorAll('${WINDOW} tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.querySelector('input')?.value ?? null))`);
const focus = (page) => page.evaluate(`(() => { const a = document.activeElement; return a?.closest('${WINDOW}') && a.dataset.r ? a.dataset.r + ',' + a.dataset.c : null; })()`);

let last = null;

async function deckPage(platform) {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.send('Page.bringToFront');
  await page.goto(`${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(LAYOUTS, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  await page.evaluate(`Reveal.slide(${PLOT_SLIDE})`);
  await frames(page);
  return page;
}

// a key with the modifier of the platform and with the editing command of a real keyboard
async function chord(page, platform, key, code, keyCode, shift, command) {
  const base = { key, code, windowsVirtualKeyCode: keyCode, modifiers: MOD[platform] | (shift ? SHIFT : 0), commands: [command] };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await frames(page);
}
const undoKey = (page, platform) => chord(page, platform, 'z', 'KeyZ', 90, false, 'undo');
const redoKey = (page, platform) => (platform === 'mac' ? chord(page, platform, 'Z', 'KeyZ', 90, true, 'redo') : chord(page, platform, 'y', 'KeyY', 89, false, 'redo'));

for (const platform of PLATFORMS) {
  test(`Undo and Redo in a cell of the Plot Data window after Enter act on the value that Enter wrote (${platform})`, async () => {
    const page = await deckPage(platform);
    await click(page, '.reveal section.present .plot');
    await press(page, 'Mod+Shift+D');
    await page.waitFor(`!!document.querySelector('${WINDOW}:not([hidden])')`);
    assert.deepEqual(await grid(page), [['0', '0', '0', '0', '0'], ['1', '1', '1', '1', '0']]);
    await page.evaluate(`(() => { const i = document.querySelector(${JSON.stringify(cell(0, 1))}); i.focus(); i.select(); return true; })()`);
    await type(page, '0.5');
    await press(page, 'Enter');
    await page.waitFor(`window.BeesonEditor.render() !== ${JSON.stringify(page.source)}`);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Edit Plot Data');
    assert.deepEqual(await grid(page), [['0', '0.5', '0', '0', '0'], ['1', '1', '1', '1', '0']]);
    assert.equal(await focus(page), '1,1', 'Enter moves to the cell below');
    // the undo takes the value off the file and off the window, and the focus stays in its cell
    await undoKey(page, platform);
    await page.waitFor(`window.BeesonEditor.render() === ${JSON.stringify(page.source)}`).catch(() => {});
    await byteExact(page);
    assert.deepEqual(await grid(page), [['0', '0', '0', '0', '0'], ['1', '1', '1', '1', '0']]);
    assert.equal(await focus(page), '1,1');
    assert.equal((await state(page, 'edit.redo')).label, 'Redo Edit Plot Data');
    await redoKey(page, platform);
    await page.waitFor(`window.BeesonEditor.render() !== ${JSON.stringify(page.source)}`).catch(() => {});
    assert.deepEqual(await grid(page), [['0', '0.5', '0', '0', '0'], ['1', '1', '1', '1', '0']]);
    assert.equal(await focus(page), '1,1');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Edit Plot Data');
    assert.deepEqual(errors(page), []);
  });

  // the press on the menu bar leaves the focus in the cell, and Paste of the Edit menu fills the
  // cells from the focused one, as the key does
  test(`Paste of the Edit menu in a cell of the Plot Data window fills the cells as the key does (${platform})`, async () => {
    const page = await deckPage(platform);
    await click(page, '.reveal section.present .plot');
    await press(page, 'Mod+Shift+D');
    await page.waitFor(`!!document.querySelector('${WINDOW}:not([hidden])')`);
    await page.evaluate(`(() => { const i = document.querySelector(${JSON.stringify(cell(0, 1))}); i.focus(); i.select(); return true; })()`);
    await page.evaluate(`Promise.resolve(window.BeesonEditor.exec('edit.paste', '0.25\\t0.75')).then(() => true)`);
    await page.waitFor(`window.BeesonEditor.render() !== ${JSON.stringify(page.source)}`).catch(() => {});
    await frames(page);
    assert.deepEqual(await grid(page), [['0', '0.25', '0.75', '0', '0'], ['1', '1', '1', '1', '0']]);
    assert.deepEqual(errors(page), []);
  });

  test(`Undo in a cell with a typed text that is not written yet is left to the field (${platform})`, async () => {
    const page = await deckPage(platform);
    await click(page, '.reveal section.present .plot');
    await press(page, 'Mod+Shift+D');
    await page.waitFor(`!!document.querySelector('${WINDOW}:not([hidden])')`);
    await page.evaluate(`(() => { const i = document.querySelector(${JSON.stringify(cell(0, 1))}); i.focus(); i.select(); return true; })()`);
    await type(page, '0.5');
    await press(page, 'Enter');
    await page.waitFor(`window.BeesonEditor.render() !== ${JSON.stringify(page.source)}`);
    const written = await page.evaluate('window.BeesonEditor.render()');
    // a text typed into the cell below is taken back by the field, and the value above stays written
    await type(page, '7');
    await undoKey(page, platform);
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), written);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Edit Plot Data');
    assert.deepEqual(errors(page), []);
  });
}
