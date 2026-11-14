// regression tests of R17.10 on both platforms with trusted keys: Alt with an arrow adds a row or a
// column with the caret in a cell on Windows and Linux, where the text does not use these keys, and
// the caret goes into the new cell. on a Mac, Option with an arrow is left to the text. Alt with Left or
// Right does not reach the browser, which would go back or forward in its history

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test/pages/editor-r13-3.html';

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
const wait = (page, ms = 150) => page.evaluate(`new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), ${ms}))`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);

// the editor on slide 2 of test/pages/editor-r13-3.html, whose table holds A1 to C4 in 4 rows of
// 3 cells
async function load(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${DECK}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate('Reveal.slide(1)');
  await wait(page, 300);
  return page;
}

const TABLE = `document.querySelector('.reveal section.present table')`;
const size = (page) => page.evaluate(`[${TABLE}.rows.length, ${TABLE}.rows[0].cells.length]`);
const texts = (page) => page.evaluate(`[...${TABLE}.rows].map((tr) => [...tr.cells].map((c) => c.textContent.trim()))`);
// the row and column of the cell of the caret, or null, the cell selected as a range, and the
// elements selected
const where = (page) => page.evaluate(`(() => {
  const c = document.activeElement?.closest?.('td, th');
  const at = c ? [[...${TABLE}.rows].indexOf(c.parentElement), [...c.parentElement.cells].indexOf(c)] : null;
  return { at, range: !!document.querySelector('.beeson-table-bars .cell.range:not([hidden])'), selected: window.BeesonEditor.selection().map((e) => e.tagName) };
})()`);

// the caret at the end of the text of the cell B2, as after a click into it
async function caretInB2(page) {
  const B2 = `[...${TABLE}.querySelectorAll('td')].find((c) => c.textContent.trim() === 'B2')`;
  const p = await page.evaluate(`(() => { const r = ${B2}.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, p);
  await wait(page);
  await page.evaluate(`(() => { const n = ${B2}.firstChild; getSelection().collapse(n, n.length); return true; })()`);
  assert.equal(await page.evaluate(`document.activeElement?.closest('td')?.textContent.trim() ?? null`), 'B2', 'the caret is not in the cell B2');
}

// the keys, the size of the table after each, its name in the history, the cell of the caret
// after it, and the cells of the table after a letter typed at the caret
const ROWS = [['A1', 'B1', 'C1'], ['A2', 'B2', 'C2'], ['A3', 'B3', 'C3'], ['A4', 'B4', 'C4']];
const ADDS = [
  ['Alt+ArrowUp', [5, 3], 'Add Row Above', [1, 1], [ROWS[0], ['', 'x', ''], ...ROWS.slice(1)]],
  ['Alt+ArrowDown', [5, 3], 'Add Row Below', [2, 1], [ROWS[0], ROWS[1], ['', 'x', ''], ...ROWS.slice(2)]],
  ['Alt+ArrowLeft', [4, 4], 'Add Column Before', [1, 1], ROWS.map((r, i) => [r[0], i === 1 ? 'x' : '', r[1], r[2]])],
  ['Alt+ArrowRight', [4, 4], 'Add Column After', [1, 2], ROWS.map((r, i) => [r[0], r[1], i === 1 ? 'x' : '', r[2]])],
];
const IDS = { 'Alt+ArrowUp': 'table.rowAbove', 'Alt+ArrowDown': 'table.rowBelow', 'Alt+ArrowLeft': 'table.columnBefore', 'Alt+ArrowRight': 'table.columnAfter' };
// after the undo of an add with the caret in a cell, from the menu as from a key, the caret is back
// in the cell B2 (R19.3)
const UNDONE = { at: [1, 1], range: false, selected: [] };

// item 1: with the caret in a cell, the keys did nothing on Windows and Linux, although the menu of
// the cell lists them
test('Alt with an arrow adds a row or a column with the caret in a cell, as one entry, and the caret goes into the new cell (other)', async (t) => {
  const page = await load(t, 'other');
  for (const [key, shape, label, at, cells] of ADDS) {
    // the place of the caret after the undo of the same command run from the menu
    await caretInB2(page);
    await page.evaluate(`window.BeesonEditor.exec(${js(IDS[key])})`);
    await wait(page);
    await undo(page);
    await wait(page);
    assert.deepEqual(await where(page), UNDONE, `after the undo of ${IDS[key]} from the menu`);
    await caretInB2(page);
    await press(page, key);
    await wait(page);
    assert.deepEqual(await size(page), shape, `the table after ${key}`);
    assert.equal(await undoLabel(page), `Undo ${label}`);
    assert.deepEqual(await where(page), { at, range: false, selected: [] }, `the caret after ${key}`);
    const added = await render(page);
    await undo(page);
    await wait(page);
    assert.equal(await render(page), page.source, `one undo of ${key} does not give the file back byte for byte`);
    assert.deepEqual(await where(page), UNDONE, `after the undo of ${key}`);
    await redo(page);
    assert.equal(await render(page), added, `the redo of ${key} does not add again`);
    await undo(page);
    // a letter typed after the key goes into the new cell
    await caretInB2(page);
    await press(page, key);
    await wait(page);
    await type(page, 'x');
    await wait(page);
    assert.deepEqual(await texts(page), cells, `the letter after ${key} is not typed in the new cell`);
    await undo(page);
    await undo(page);
    assert.equal(await render(page), page.source, `the undos after ${key} do not give the file back`);
  }
  // a key added row is saved and opened without a problem
  await caretInB2(page);
  await press(page, 'Alt+ArrowDown');
  await wait(page);
  const added = await render(page);
  const { text } = await saveAndReopen(page, 'r17-10-1.html');
  assert.equal(text, added);
  assert.deepEqual(errors(page), []);
});

test('Option with an arrow is left to the text with the caret in a cell, and the table stays as it is (mac)', async (t) => {
  const page = await load(t, 'mac');
  for (const [key] of ADDS) {
    await caretInB2(page);
    await press(page, key);
    await wait(page);
    assert.deepEqual(await size(page), [4, 3], `the table after ${key}`);
    assert.equal(await render(page), page.source, `${key} changes the file`);
  }
  assert.equal(await undoLabel(page), 'Undo');
  assert.deepEqual(errors(page), []);
});

// item 2: Alt with Left or Right is Back or Forward of a browser on Windows and Linux, hence the
// editor prevents it where it adds a column, with the caret in a cell and with the cell selected
const watchKeys = (page) => page.evaluate(`(() => { window.__keys = []; addEventListener('keydown', (ev) => { if (ev.altKey) window.__keys.push(ev.key + ' ' + ev.defaultPrevented); }, true); return true; })()`);
const watched = (page) => page.evaluate('window.__keys.splice(0)');

for (const platform of PLATFORMS) {
  test(`Alt with Left or Right does not reach the browser where it adds a column (${platform})`, async (t) => {
    const page = await load(t, platform);
    await watchKeys(page);
    // the page is the same document on the same slide, i.e. neither Back nor Forward was taken
    await page.evaluate('window.__stay = true');
    const where = () => page.evaluate('[window.__stay === true, history.length, Reveal.getIndices().h]');
    if (platform === 'other') {
      await caretInB2(page);
      const url = await where();
      await press(page, 'Alt+ArrowLeft');
      await press(page, 'Alt+ArrowRight');
      await wait(page);
      assert.deepEqual(await watched(page), ['ArrowLeft true', 'ArrowRight true'], 'with the caret in a cell');
      assert.deepEqual(await size(page), [4, 5]);
      assert.deepEqual(await where(), url);
      await undo(page);
      await undo(page);
    }
    // the cell selected as a range by Esc
    await caretInB2(page);
    await press(page, 'Escape');
    await wait(page);
    assert.equal(await page.evaluate(`!!document.querySelector('.beeson-table-bars .cell.range:not([hidden])')`), true, 'Esc does not select the cell');
    await watched(page);
    const url = await where();
    await press(page, 'Alt+ArrowLeft');
    await press(page, 'Alt+ArrowRight');
    await wait(page);
    assert.deepEqual(await watched(page), ['ArrowLeft true', 'ArrowRight true'], 'with the cell selected');
    assert.deepEqual(await size(page), [4, 5]);
    assert.deepEqual(await where(), url);
    assert.deepEqual(errors(page), []);
  });
}
