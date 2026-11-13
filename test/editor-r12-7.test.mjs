// regression tests of R12.7, the range of cells of a table, on both platforms with trusted input.
// with a range of cells selected, Cut, Copy, Paste, Delete, and Duplicate act on the range as the
// Delete key does, and the range stays selected after a clear. an undo in the Rows field undoes
// the count of the table, and a column grip released at its start widths writes nothing

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test/pages/editor-tables.html';

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
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
const tables = (page) => page.evaluate(`Reveal.getCurrentSlide().querySelectorAll('table').length`);
let saves = 0;

// the editor on the tables page served over HTTP in a window of 1600 by 1000 px, on slide 2
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
  await frames(page);
  return page;
}

// the center of the cell of the current slide that holds text
async function cell(page, text) {
  return page.evaluate(`(() => {
    const c = [...Reveal.getCurrentSlide().querySelectorAll('td, th')].find((c) => c.textContent.includes(${js(text)}));
    const r = c.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
}

// the cells from the cell of from to the cell of to selected as a block, by a click and a Shift-click
async function range(page, from, to) {
  await click(page, await cell(page, from));
  await frames(page);
  await click(page, await cell(page, to), { modifiers: 'Shift' });
  await frames(page);
}

// whether cells are selected as a block, i.e. the outline of the block is shown and no cell has a caret
const inBlock = (page) => page.evaluate(`(() => {
  const o = document.querySelector('.beeson-table-bars .cell.block');
  return !!o && !o.hidden && document.activeElement?.localName !== 'td';
})()`);

// a clipboard event of type fired at the focus with a DataTransfer that holds data, and what the
// editor wrote onto the DataTransfer
async function fire(page, type, data = {}) {
  return page.evaluate(`(() => {
    const dt = new DataTransfer();
    for (const [k, v] of Object.entries(${js(data)})) dt.setData(k, v);
    const ev = new ClipboardEvent(${js(type)}, { clipboardData: dt, bubbles: true, cancelable: true });
    (document.activeElement || document.body).dispatchEvent(ev);
    return { prevented: ev.defaultPrevented, plain: dt.getData('text/plain'), html: dt.getData('text/html') };
  })()`);
}

// the cells from Moon to 2.53e-5 cleared, with the other cells of the table kept
const CLEARED = [
  ['<tr><td>Moon</td><td>\\(0.01215\\)</td><td>Earth and Moon</td></tr>', '<tr><td></td><td></td><td>Earth and Moon</td></tr>'],
  ['<tr><td>Europa</td><td>2.53e-5</td><td>Jupiter</td></tr>', '<tr><td></td><td></td><td>Jupiter</td></tr>'],
];

// the cells from Moon to 2.53e-5 filled with a b and c d
const FILLED = [
  ['<tr><td>Moon</td><td>\\(0.01215\\)</td><td>Earth and Moon</td></tr>', '<tr><td>a</td><td>b</td><td>Earth and Moon</td></tr>'],
  ['<tr><td>Europa</td><td>2.53e-5</td><td>Jupiter</td></tr>', '<tr><td>c</td><td>d</td><td>Jupiter</td></tr>'],
];

// roundTrip checks the edits byte for byte, the source after an undo, the edit again after a
// redo, and an open of the saved edit without problems
async function roundTrip(page, edits) {
  const edited = await render(page);
  await byteExact(page, edits);
  await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r12-7-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
}

for (const platform of PLATFORMS) {
  test(`Edit > Delete on a range of cells clears the cells and keeps the table (${platform})`, async (t) => {
    const page = await load(t, platform);
    await range(page, 'Moon', '2.53e-5');
    assert.equal(await inBlock(page), true);
    await exec(page, 'element.delete');
    await frames(page);
    assert.equal(await tables(page), 1, 'Delete removed the table');
    assert.equal(await undoLabel(page), 'Undo Delete');
    assert.equal(await inBlock(page), true, 'the range is not selected after Delete');
    await roundTrip(page, CLEARED);
  });

  test(`Cut on a range of cells copies and clears the cells (${platform})`, async (t) => {
    const page = await load(t, platform);
    await range(page, 'Moon', '2.53e-5');
    const out = await fire(page, 'cut');
    await frames(page);
    assert.equal(out.prevented, true);
    assert.equal(await tables(page), 1, 'Cut removed the table');
    assert.equal(out.plain, 'Moon\t\\(0.01215\\)\nEuropa\t2.53e-5');
    assert.equal(await undoLabel(page), 'Undo Cut');
    await roundTrip(page, CLEARED);
  });

  test(`Cut of the Edit menu on a range of cells clears the cells (${platform})`, async (t) => {
    const page = await load(t, platform);
    await range(page, 'Moon', '2.53e-5');
    await exec(page, 'edit.cut');
    await frames(page);
    assert.equal(await tables(page), 1, 'Edit > Cut removed the table');
    await byteExact(page, CLEARED);
  });

  test(`Duplicate is dimmed on a range of cells, and its key does not copy the table (${platform})`, async (t) => {
    const page = await load(t, platform);
    await range(page, 'Moon', '2.53e-5');
    assert.equal((await state(page, 'edit.duplicate')).enabled, false);
    await press(page, 'Mod+D');
    await frames(page);
    assert.equal(await tables(page), 1, 'the key of Duplicate copied the table');
    await byteExact(page);
  });

  test(`Copy of a range of cells gives the cells as tab-separated text and a table (${platform})`, async (t) => {
    const page = await load(t, platform);
    await range(page, 'Moon', 'Jupiter');
    const out = await fire(page, 'copy');
    assert.equal(out.prevented, true);
    assert.equal(out.plain, 'Moon\t\\(0.01215\\)\tEarth and Moon\nEuropa\t2.53e-5\tJupiter');
    assert.ok(!out.html.includes('<!--beeson-->'), 'the copy holds the table as an element of the editor');
    assert.ok(!out.html.includes('Titan') && !out.html.includes('Body'), 'the copy holds cells outside the range');
    assert.match(out.html, /<table[^>]*>[\s\S]*<td>Moon<\/td>[\s\S]*<td>Jupiter<\/td>[\s\S]*<\/table>/);
    assert.equal(await inBlock(page), true);
    await byteExact(page);
  });

  test(`a paste of tab-separated text onto a range of cells fills them from its first cell (${platform})`, async (t) => {
    const page = await load(t, platform);
    await range(page, 'Moon', '2.53e-5');
    const out = await fire(page, 'paste', { 'text/plain': 'a\tb\nc\td' });
    await frames(page);
    assert.equal(out.prevented, true);
    assert.equal(await tables(page), 1, 'the paste added a table');
    assert.equal(await undoLabel(page), 'Undo Paste');
    assert.equal(await inBlock(page), true, 'the pasted cells are not selected');
    await roundTrip(page, FILLED);
  });

  test(`Paste of the Edit menu onto a range of cells fills them from its first cell (${platform})`, async (t) => {
    const page = await load(t, platform);
    await range(page, 'Moon', '2.53e-5');
    await exec(page, 'edit.paste', 'a\tb\nc\td');
    await frames(page);
    assert.equal(await tables(page), 1, 'Edit > Paste added a table');
    await byteExact(page, FILLED);
  });

  test(`Backspace on a range of cells keeps the range selected (${platform})`, async (t) => {
    const page = await load(t, platform);
    await range(page, 'Moon', 'Jupiter');
    await press(page, 'Shift+ArrowDown');
    await frames(page);
    await press(page, 'Backspace');
    await frames(page);
    assert.equal(await undoLabel(page), 'Undo Clear Cells');
    assert.equal(await inBlock(page), true, 'the range is a caret after Backspace');
    await press(page, 'Mod+Z');
    await frames(page);
    assert.equal(await inBlock(page), true, 'the range is a caret after an undo of the clear');
    await press(page, 'Mod+Shift+Z');
    await frames(page);
    assert.equal(await inBlock(page), true, 'the range is a caret after a redo of the clear');
  });

  test(`an undo in the Rows field after a commit undoes the count of the table (${platform})`, async (t) => {
    const page = await load(t, platform);
    if (!(await page.evaluate(`window.BeesonEditor.state('shell.format').checked`))) await exec(page, 'shell.format');
    await click(page, await cell(page, 'Europa'));
    await frames(page);
    const field = '#beeson-edit-num-rows';
    await page.waitFor(`!!document.querySelector(${js(field)})`);
    await click(page, field);
    // a key without the editing command of the browser does not select the text in headless Chrome
    await page.evaluate(`document.querySelector(${js(field)}).select()`);
    await type(page, '6');
    await press(page, 'Enter');
    await frames(page);
    const rows = () => page.evaluate(`Reveal.getCurrentSlide().querySelector('table').rows.length`);
    const value = () => page.evaluate(`document.querySelector(${js(field)}).value`);
    assert.equal(await rows(), 6);
    assert.equal(await page.evaluate('document.activeElement.id'), 'beeson-edit-num-rows');
    const count = `Reveal.getCurrentSlide().querySelector('table').rows.length`;
    await press(page, 'Mod+Z');
    await page.waitFor(`${count} === 4`).catch(() => {});
    assert.equal(await rows(), 4, 'the undo in the field did not undo the table');
    assert.equal(await value(), '4');
    await byteExact(page);
    await press(page, 'Mod+Shift+Z');
    await page.waitFor(`${count} === 6`).catch(() => {});
    assert.equal(await rows(), 6);
    assert.equal(await value(), '6');
    // a blur after the redo does not add an entry to the history
    await page.evaluate('document.activeElement.blur()');
    await frames(page);
    assert.equal(await rows(), 6);
    assert.equal(await undoLabel(page), 'Undo Set Row Count');
    assert.equal((await state(page, 'edit.redo')).enabled, false);
    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
  });

  test(`a column grip released at its start widths writes nothing (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await cell(page, 'Moon'));
    await frames(page);
    const grip = await page.evaluate(`(() => {
      const r = document.querySelector('.beeson-table-bars .grips [data-grip="0"]').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    const mouse = (kind, x, extra = {}) => page.send('Input.dispatchMouseEvent', { type: kind, x, y: grip.y, ...extra });
    await mouse('mouseMoved', grip.x);
    await mouse('mousePressed', grip.x, { button: 'left', buttons: 1, clickCount: 1 });
    for (const dx of [5, 10, 20, 30, 40, -20, -40]) await mouse('mouseMoved', grip.x + dx, { button: 'left', buttons: 1 });
    await mouse('mouseReleased', grip.x - 40, { button: 'left', clickCount: 1 });
    await frames(page);
    await byteExact(page);
    assert.equal((await state(page, 'edit.undo')).enabled, false, 'the drag added an entry to the history');
  });
}
