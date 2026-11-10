// the tables of the editor: the model of src/editor/table.ts under node, and on either platform
// with trusted input the Insert Table grid, Tab and the arrow keys between the cells, the rows and
// columns added and deleted, the header row, the numbers at the right, the context menu of a cell,
// a paste of tab-separated text or of an HTML table, onto the slide or into a cell, a range of
// cells selected by a drag, a Shift-click, and the keys, the cells merged and unmerged, the widths
// of the columns, and Auto-Align. after each edit the text is in the scope rule, an undo gives the
// file byte for byte, a redo gives the edit, and a save is opened again without problems. a paste
// is a synthetic event with a DataTransfer of its own, since the clipboard of the system is shared
// with the other tests run at the same time

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { columnName, emptyRows, grow, isNumeric, layoutCells, numericColumns, parseTabular, spotsIn, tableHtml } from '../src/editor/table.ts';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS_DECK = 'test/pages/editor-layouts.html';
// a table with a rowspan and a colspan on its first slide, and a plain table on its second
const TABLES_DECK = 'test/pages/editor-tables.html';
// the index of the slide of the equations in index.html, a content slide without a table
const EQUATIONS = 3;
const STYLE = { step: '  ', eol: '\n' };
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));

test('numbers are told from words, and a column of numbers is set at the right below its header', () => {
  for (const t of ['42', '-3.5', '1,200', '$9.99', '12 %', '(10.00)', '3.2e-4', '−7', '+1']) assert.ok(isNumeric(t), t);
  for (const t of ['', 'Halo', '1.2.3', '12 km', 'e5', '-', '1.2e']) assert.ok(!isNumeric(t), t);
  assert.deepEqual(numericColumns([['Family', 'Period'], ['Lyapunov', '2.69'], ['Halo', '']]), [false, true]);
  assert.deepEqual(numericColumns([['A', 'B'], ['', 'x']]), [false, false]);
});

test('tab-separated text is read as rows of cells, with quoted cells and short rows padded', () => {
  assert.deepEqual(parseTabular('a\tb\n1\t2\r\n3\t4\n'), [['a', 'b'], ['1', '2'], ['3', '4']]);
  assert.deepEqual(parseTabular('"x\ty"\t"say ""hi"""\nz'), [['x\ty', 'say "hi"'], ['z', '']]);
  assert.equal(parseTabular('one line\ntwo lines'), null);
  assert.equal(parseTabular('\t'), null);
});

test('a table is written with an explicit tbody, a header row of th, and numbers at the right', () => {
  assert.equal(tableHtml(emptyRows(2, 2), STYLE, '  '), '<table>\n    <tbody>\n      <tr><th></th><th></th></tr>\n      <tr><td></td><td></td></tr>\n    </tbody>\n  </table>');
  assert.equal(
    tableHtml([['Body', 'μ'], ['Moon', '0.01215'], ['a < b', '1']], { step: '\t', eol: '\r\n' }, '\t'),
    '<table>\r\n\t\t<tbody>\r\n\t\t\t<tr><th>Body</th><th style="text-align: right">μ</th></tr>\r\n\t\t\t<tr><td>Moon</td><td style="text-align: right">0.01215</td></tr>\r\n\t\t\t<tr><td>a &lt; b</td><td style="text-align: right">1</td></tr>\r\n\t\t</tbody>\r\n\t</table>',
  );
  assert.deepEqual([0, 1, 25, 26, 27, 701, 702].map(columnName), ['A', 'B', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
});

test('the cells of a table are laid out with their colspan and rowspan, and a range grows over merged cells', () => {
  // the table of merged cells of TABLES_DECK: Halo over two rows, Distant retrograde over two columns
  const cell = (name, rows = 1, cols = 1) => ({ name, rows, cols });
  const g = layoutCells([
    [cell('Family'), cell('Period'), cell('Jacobi')],
    [cell('Halo', 2), cell('14.8'), cell('3.05')],
    [cell('6.6'), cell('3.04')],
    [cell('DRO', 1, 2), cell('2.92')],
  ], (c) => c);
  assert.equal(g.width, 3);
  assert.deepEqual(g.grid.map((r) => r.map((s) => s.cell.name)), [['Family', 'Period', 'Jacobi'], ['Halo', '14.8', '3.05'], ['Halo', '6.6', '3.04'], ['DRO', 'DRO', '2.92']]);
  assert.deepEqual(g.spots[2].map((s) => [s.row, s.col]), [[2, 1], [2, 2]]);
  // a range from 6.6 to Distant retrograde grows to Halo, which reaches into it
  assert.deepEqual(grow(g, { r0: 2, c0: 1, r1: 3, c1: 1 }), { r0: 1, c0: 0, r1: 3, c1: 1 });
  assert.deepEqual(spotsIn(g, { r0: 1, c0: 0, r1: 3, c1: 1 }).map((s) => s.cell.name), ['Halo', '14.8', '6.6', 'DRO']);
  // a rowspan of 0 or past the last row reaches the last row
  assert.equal(layoutCells([[cell('a', 0)], [], [cell('b')]], (c) => c).spots[0][0].rows, 3);
  assert.equal(layoutCells([[cell('a', 9)], [cell('b')]], (c) => c).grid[1][1].cell.name, 'b');
});

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

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const settle = (page) => page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(window.BeesonEditor.status()))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const js = (v) => JSON.stringify(v);

async function open(platform, deck = 'index.html') {
  const page = await browser.newPage();
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(status.problems, []);
  page.platform = platform;
  return page;
}

async function show(page, at) {
  const h = typeof at === 'number' ? at : await page.evaluate(`Reveal.getIndices(document.querySelector(${js(at)}).closest('section')).h`);
  await page.evaluate(`Reveal.slide(${h})`);
  await sleep(150);
}

// the center of a cell of the table of the current slide, by row and column
const cellSelector = (r, c) => `.reveal section.present table tr:nth-child(${r + 1}) > :nth-child(${c + 1})`;
const at = (page, selector) => page.evaluate(`(() => { const r = document.querySelector(${js(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

// the row and the column of the cell of the focus, or null outside a table
const focusCell = (page) => page.evaluate(`(() => {
  const c = document.activeElement?.closest?.('td, th');
  if (!c) return null;
  return [[...c.closest('table').rows].indexOf(c.parentElement), [...c.parentElement.cells].indexOf(c)];
})()`);

const selected = (page) => page.evaluate('String(window.getSelection())');

// a paste event with data of its own, as the browser sends it for the paste key
const paste = (page, data) =>
  page.evaluate(`(() => {
    const data = new DataTransfer();
    for (const [type, text] of Object.entries(${js(data)})) data.setData(type, text);
    (document.activeElement ?? document.body).dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  })()`);

// the time for the edits of a paste, which are run after the event
const settled = async (page) => {
  await sleep(120);
  return settle(page);
};

let saves = 0;
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the edit did not change the text');
  // the problems of the scope rule that the file did not have before
  const added = textProblems(edited, THEME);
  for (const p of textProblems(page.source, THEME)) if (added.includes(p)) added.splice(added.indexOf(p), 1);
  assert.deepEqual(added, [], 'the edit is out of the scope rule');
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  assert.equal((await settle(page)).undo, false, `the edit is more than ${undos} entries of the history`);
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `table-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  return edited;
}

const THREE = '<table>\n    <tbody>\n      <tr><th></th><th></th><th></th></tr>\n      <tr><td></td><td></td><td></td></tr>\n      <tr><td></td><td></td><td></td></tr>\n    </tbody>\n  </table>';

// the text rendered with the translate taken off a new table, which placeTable of
// commands/table.ts gives it on a slide whose text column is full
const placed = async (page) => (await render(page)).replace(/<table style="translate: -?\d+px -?\d+px">/, '<table>');

// the table of a text cut out with the line it is on, which gives the deck before the insert
const without = (text, table) => text.replace(`\n  ${table}`, '');

const LAYOUT_ROWS = [
  '<tr><th>Family</th><th>Period</th></tr>',
  '<tr><td>Lyapunov</td><td>\\(2.69\\)</td></tr>',
  '<tr class="fragment" data-fragment-index="1"><td>Halo</td><td>\\(3.41\\)</td></tr>',
];
const layoutTable = (rows) => `<table>\n${rows.map((r) => `    ${r}\n`).join('')}  </table>`;

// the white space before the first row of a table without a tbody tag is in the table, before the
// tbody of the page, and a row inserted into that tbody was written on the line of the row before
test('a row inserted into a table without a tbody tag is written on a line of its own', async (t) => {
  const page = await open('mac', LAYOUTS_DECK);
  t.after(() => page.close?.());
  const tbody = `document.querySelector('.reveal .slides table').tBodies[0]`;
  await page.evaluate(`window.BeesonEditor.doc.insert('<tr><td>Axial</td><td></td></tr>', ${tbody}, null)`);
  await page.evaluate(`window.BeesonEditor.doc.insert('<tr><td>Vertical</td><td></td></tr>', ${tbody}, ${tbody}.rows[1])`);
  await byteExact(page, [[layoutTable(LAYOUT_ROWS), layoutTable([LAYOUT_ROWS[0], '<tr><td>Vertical</td><td></td></tr>', ...LAYOUT_ROWS.slice(1), '<tr><td>Axial</td><td></td></tr>'])]]);
  await page.evaluate('window.BeesonEditor.undo()');
  await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
});

// for the same reason, a row inserted before the first row, or the first row removed, wrote the
// white space of the first row twice
test('the first row of a table without a tbody tag is replaced without its white space twice', async (t) => {
  const page = await open('mac', LAYOUTS_DECK);
  t.after(() => page.close?.());
  const tbody = `document.querySelector('.reveal .slides table').tBodies[0]`;
  await page.evaluate(`window.BeesonEditor.doc.insert('<tr><td>Axial</td><td></td></tr>', ${tbody}, ${tbody}.rows[0])`);
  await byteExact(page, [[layoutTable(LAYOUT_ROWS), layoutTable(['<tr><td>Axial</td><td></td></tr>', ...LAYOUT_ROWS])]]);
  await page.evaluate('window.BeesonEditor.undo()');
  await page.evaluate(`window.BeesonEditor.doc.remove(${tbody}.rows[0])`);
  await byteExact(page, [[layoutTable(LAYOUT_ROWS), layoutTable(LAYOUT_ROWS.slice(1))]]);
  await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
});

// a key with Option and the editing command that Chrome on a Mac sends with it, e.g. moveWordRight,
// which press() does not send
async function optionKey(page, name, command) {
  const [key, keyCode] = { ArrowLeft: ['ArrowLeft', 37], ArrowUp: ['ArrowUp', 38], ArrowRight: ['ArrowRight', 39], ArrowDown: ['ArrowDown', 40] }[name];
  const base = { key, code: key, windowsVirtualKeyCode: keyCode, modifiers: 1 };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base, commands: [command] });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

// the offset of the caret in the text of the cell of the focus
const caretOffset = (page) => page.evaluate(`(() => {
  const r = window.getSelection().getRangeAt(0).cloneRange();
  r.setStart(document.activeElement.closest('td, th'), 0);
  return r.toString().length;
})()`);

// on a Mac, Option with an arrow moves the caret by a word or a paragraph in every text field, the
// cells of Keynote included, and Option with Right Arrow in a cell added a column
test('Option and Right Arrow in the text of a cell move the caret by a word (mac)', async (t) => {
  const page = await open('mac', LAYOUTS_DECK);
  t.after(() => page.close?.());
  await show(page, '.reveal .slides table');
  await click(page, cellSelector(0, 0));
  await press(page, 'End');
  await type(page, ' of orbits');
  await press(page, 'Home');
  await optionKey(page, 'ArrowRight', 'moveWordRight');
  await settle(page);
  assert.equal(await page.evaluate(`document.querySelector('.reveal section.present table').rows[0].cells.length`), 2, 'a column is added');
  assert.deepEqual(await focusCell(page), [0, 0]);
  assert.equal(await caretOffset(page), 'Family'.length);
  assert.deepEqual(errors(page), []);
});

for (const platform of ['mac', 'other']) {
  test(`Insert Table from the grid writes a 3 by 3 table with a tbody and a header row (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await show(page, EQUATIONS);
    await click(page, '.beeson-edit-top [data-command="insert.table"]');
    await page.waitFor(`!!document.querySelector('dialog.beeson-table-picker[open]')`);
    assert.equal(await page.evaluate('document.activeElement.className'), 'grid');
    // the cell of row 3 and column 3 of the grid of 10 columns
    const cell = await at(page, 'dialog.beeson-table-picker .grid > :nth-child(23)');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cell.x, y: cell.y });
    assert.equal(await page.evaluate(`document.querySelector('.beeson-table-picker .size').textContent`), '3 × 3 Table');
    assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-table-picker .grid > .on').length`), 9);
    await click(page, cell);
    await settled(page);
    assert.equal(await page.evaluate(`!!document.querySelector('dialog.beeson-table-picker')`), false);
    const edited = await placed(page);
    assert.ok(edited.includes(`\n  ${THREE}\n`), `the table is not written:\n${edited.slice(edited.indexOf('Equations'), edited.indexOf('Equations') + 1600)}`);
    assert.equal(without(edited, THREE), page.source);
    assert.deepEqual(await focusCell(page), [0, 0]);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Insert Table');
    // the bars of the table are shown around it, with column A and row 1 marked
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-table-bars .bar > .on')].map((d) => d.textContent)`), ['A', '1']);
    await roundTrip(page);
  });

  test(`the keys of the Insert Table grid choose a size, and Escape closes it (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await show(page, EQUATIONS);
    await page.evaluate(`window.BeesonEditor.exec('insert.table')`);
    await page.waitFor(`!!document.querySelector('dialog.beeson-table-picker[open]')`);
    await press(page, 'Escape');
    assert.equal(await page.evaluate(`!!document.querySelector('dialog.beeson-table-picker')`), false);
    assert.equal(await render(page), page.source);
    await page.evaluate(`window.BeesonEditor.exec('insert.table')`);
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowLeft']) await press(page, key);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-table-picker .size').textContent`), '1 × 4 Table');
    await press(page, 'ArrowRight');
    await press(page, 'Enter');
    await settled(page);
    const table = '<table>\n    <tbody>\n      <tr><th></th><th></th></tr>\n      <tr><td></td><td></td></tr>\n      <tr><td></td><td></td></tr>\n      <tr><td></td><td></td></tr>\n    </tbody>\n  </table>';
    assert.equal(without(await placed(page), table), page.source);
    await roundTrip(page);
  });

  test(`Tab and Shift+Tab go between the cells, and Tab in the last cell writes a new row (${platform})`, async (t) => {
    const page = await open(platform, LAYOUTS_DECK);
    t.after(() => page.close?.());
    await show(page, '.reveal .slides table');
    await click(page, cellSelector(0, 0));
    assert.deepEqual(await focusCell(page), [0, 0]);
    await press(page, 'Tab');
    assert.deepEqual(await focusCell(page), [0, 1]);
    assert.equal(await selected(page), 'Period');
    await press(page, 'Tab');
    assert.deepEqual(await focusCell(page), [1, 0]);
    assert.equal(await selected(page), 'Lyapunov');
    await press(page, 'Shift+Tab');
    assert.deepEqual(await focusCell(page), [0, 1]);
    await press(page, 'Shift+Tab');
    await press(page, 'Shift+Tab');
    assert.deepEqual(await focusCell(page), [0, 0], 'Shift+Tab in the first cell leaves it');
    assert.equal(await render(page), page.source);
    await click(page, cellSelector(2, 0));
    await press(page, 'Tab');
    assert.deepEqual(await focusCell(page), [2, 1]);
    await press(page, 'Tab');
    await settle(page);
    assert.deepEqual(await focusCell(page), [3, 0]);
    await byteExact(page, [[layoutTable(LAYOUT_ROWS), layoutTable([...LAYOUT_ROWS, '<tr><td></td><td></td></tr>'])]]);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Add Row');
    // the text typed into the new row is a second entry, and both are undone to the deck
    await type(page, 'Axial');
    await settle(page);
    await byteExact(page, [[layoutTable(LAYOUT_ROWS), layoutTable([...LAYOUT_ROWS, '<tr><td>Axial</td><td></td></tr>'])]]);
    await roundTrip(page, 2);
  });

  test(`an arrow key at the edge of a cell goes to the cell beside it (${platform})`, async (t) => {
    const page = await open(platform, LAYOUTS_DECK);
    t.after(() => page.close?.());
    await show(page, '.reveal .slides table');
    // the cells of the header row hold text, and those of the second column math
    await click(page, cellSelector(0, 0));
    await press(page, 'End');
    await press(page, 'ArrowLeft');
    assert.deepEqual(await focusCell(page), [0, 0], 'an arrow inside the text moves the caret');
    await press(page, 'ArrowRight');
    await press(page, 'ArrowRight');
    assert.deepEqual(await focusCell(page), [0, 1]);
    await press(page, 'ArrowLeft');
    assert.deepEqual(await focusCell(page), [0, 0]);
    await press(page, 'ArrowDown');
    assert.deepEqual(await focusCell(page), [1, 0]);
    await press(page, 'ArrowUp');
    assert.deepEqual(await focusCell(page), [0, 0]);
    await press(page, 'ArrowDown');
    await press(page, 'ArrowDown');
    assert.deepEqual(await focusCell(page), [2, 0]);
    await press(page, 'ArrowDown');
    assert.deepEqual(await focusCell(page), [2, 0], 'Down in the last row stays in the table');
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`rows and columns are added and deleted at the cell of the caret, one entry each (${platform})`, async (t) => {
    const table = layoutTable(LAYOUT_ROWS);
    const steps = [
      // a row above the header row is a header row, and a row below it is a row of td
      [0, 1, 'table.rowAbove', [`<tr><th></th><th></th></tr>`, ...LAYOUT_ROWS], [0, 1]],
      [0, 1, 'table.rowBelow', [LAYOUT_ROWS[0], '<tr><td></td><td></td></tr>', ...LAYOUT_ROWS.slice(1)], [1, 1]],
      [1, 0, 'table.columnBefore', ['<tr><th></th><th>Family</th><th>Period</th></tr>', '<tr><td></td><td>Lyapunov</td><td>\\(2.69\\)</td></tr>', '<tr class="fragment" data-fragment-index="1"><td></td><td>Halo</td><td>\\(3.41\\)</td></tr>'], [1, 0]],
      [1, 1, 'table.columnAfter', ['<tr><th>Family</th><th>Period</th><th></th></tr>', '<tr><td>Lyapunov</td><td>\\(2.69\\)</td><td></td></tr>', '<tr class="fragment" data-fragment-index="1"><td>Halo</td><td>\\(3.41\\)</td><td></td></tr>'], [1, 2]],
      [1, 0, 'table.deleteRow', [LAYOUT_ROWS[0], LAYOUT_ROWS[2]], [1, 0]],
      [2, 1, 'table.deleteColumn', ['<tr><th>Family</th></tr>', '<tr><td>Lyapunov</td></tr>', '<tr class="fragment" data-fragment-index="1"><td>Halo</td></tr>'], [2, 0]],
    ];
    for (const [r, c, id, rows, focus] of steps) {
      const page = await open(platform, LAYOUTS_DECK);
      await show(page, '.reveal .slides table');
      await click(page, cellSelector(r, c));
      assert.equal(await page.evaluate(`window.BeesonEditor.state(${js(id)}).enabled`), true, id);
      await page.evaluate(`window.BeesonEditor.exec(${js(id)})`);
      await settle(page);
      await byteExact(page, [[table, layoutTable(rows)]]);
      assert.deepEqual(await focusCell(page), focus, `the caret after ${id}`);
      await roundTrip(page);
      // a page left open behind the next one is drawn slowly
      await page.close();
    }
  });

  // as in Keynote, Option with an arrow adds a row or a column while the cell is selected as a block,
  // after Esc in its text, and the new cell is then the selected block
  test(`the keys of the rows and columns add and delete them at the cell selected as a block (${platform})`, async (t) => {
    const page = await open(platform, LAYOUTS_DECK);
    t.after(() => page.close?.());
    const table = layoutTable(LAYOUT_ROWS);
    const empty = '<tr><td></td><td></td></tr>';
    const marked = () => page.evaluate(`[...document.querySelectorAll('.beeson-table-bars .bar > .on')].map((d) => d.textContent)`);
    const block = () => page.evaluate(`!!document.querySelector('.beeson-table-bars .cell.block:not([hidden])')`);
    await show(page, '.reveal .slides table');
    await click(page, cellSelector(1, 0));
    // in the text of a cell the keys add nothing
    await press(page, 'Alt+ArrowDown');
    await press(page, 'Alt+ArrowUp');
    await settle(page);
    assert.equal(await render(page), page.source);
    assert.equal(await block(), false);
    await press(page, 'Escape');
    await settle(page);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('table.rowBelow').enabled`), true);
    assert.equal(await focusCell(page), null);
    assert.deepEqual(await marked(), ['A', '2']);
    assert.equal(await block(), true);
    await press(page, 'Alt+ArrowDown');
    await settle(page);
    assert.deepEqual(await marked(), ['A', '3']);
    await press(page, 'Alt+ArrowDown');
    await settle(page);
    await byteExact(page, [[table, layoutTable([LAYOUT_ROWS[0], LAYOUT_ROWS[1], empty, empty, LAYOUT_ROWS[2]])]]);
    assert.deepEqual(await marked(), ['A', '4']);
    assert.equal(await focusCell(page), null, 'the new cell is selected as a block, not its text');
    assert.equal(await block(), true);
    await press(page, 'Alt+ArrowUp');
    await settle(page);
    await byteExact(page, [[table, layoutTable([LAYOUT_ROWS[0], LAYOUT_ROWS[1], empty, empty, empty, LAYOUT_ROWS[2]])]]);
    assert.deepEqual(await marked(), ['A', '4']);
    for (let i = 0; i < 3; i++) await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
    // the undo removed the cell selected as a block, hence it is selected again
    await click(page, cellSelector(1, 0));
    await press(page, 'Escape');
    await press(page, 'Alt+ArrowRight');
    await settle(page);
    await byteExact(page, [[table, layoutTable(['<tr><th>Family</th><th></th><th>Period</th></tr>', '<tr><td>Lyapunov</td><td></td><td>\\(2.69\\)</td></tr>', '<tr class="fragment" data-fragment-index="1"><td>Halo</td><td></td><td>\\(3.41\\)</td></tr>'])]]);
    assert.deepEqual(await marked(), ['B', '2']);
    await press(page, 'Alt+ArrowLeft');
    await settle(page);
    assert.deepEqual(await marked(), ['B', '2']);
    assert.equal(await page.evaluate(`document.querySelector('.reveal section.present table').rows[0].cells.length`), 4);
    if (platform === 'mac') {
      await press(page, 'Ctrl+Mod+Backspace');
      await press(page, 'Ctrl+Mod+Backspace');
      await settle(page);
      await byteExact(page);
      await press(page, 'Mod+Alt+Backspace');
      await settle(page);
      await byteExact(page, [[table, layoutTable([LAYOUT_ROWS[0], LAYOUT_ROWS[2]])]]);
      assert.deepEqual(await marked(), ['B', '2']);
      await page.evaluate('window.BeesonEditor.undo()');
    } else {
      await page.evaluate('window.BeesonEditor.undo()');
      await page.evaluate('window.BeesonEditor.undo()');
    }
    await byteExact(page);
    // a click puts the caret into the text of a cell again, where the keys add nothing
    await click(page, cellSelector(0, 0));
    await press(page, 'Alt+ArrowDown');
    await settle(page);
    assert.equal(await render(page), page.source);
    // a row added with a key is one entry, undone byte for byte and saved without problems
    await press(page, 'Escape');
    await press(page, 'Alt+ArrowDown');
    await settle(page);
    const edited = await render(page);
    assert.ok(edited.includes(layoutTable([LAYOUT_ROWS[0], empty, ...LAYOUT_ROWS.slice(1)])));
    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
    await page.evaluate('window.BeesonEditor.redo()');
    assert.equal(await render(page), edited);
    const { text } = await saveAndReopen(page, `table-keys-${platform}.html`);
    assert.equal(text, edited);
    assert.deepEqual(errors(page), []);
  });

  test(`Header Row and Numbers at the Right are switches of the table (${platform})`, async (t) => {
    let page = await open(platform, LAYOUTS_DECK);
    t.after(() => page.close?.());
    const table = layoutTable(LAYOUT_ROWS);
    await show(page, '.reveal .slides table');
    await click(page, cellSelector(1, 1));
    assert.equal(await page.evaluate(`window.BeesonEditor.state('table.header').checked`), true);
    await page.evaluate(`window.BeesonEditor.exec('table.header')`);
    await settle(page);
    await byteExact(page, [[table, layoutTable(['<tr><td>Family</td><td>Period</td></tr>', ...LAYOUT_ROWS.slice(1)])]]);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('table.header').checked`), false);
    assert.deepEqual(await focusCell(page), [1, 1]);
    await roundTrip(page);
    await page.close();
    page = await open(platform, LAYOUTS_DECK);
    await show(page, '.reveal .slides table');
    await click(page, cellSelector(1, 1));
    // the cells of math are numbers
    assert.equal(await page.evaluate(`window.BeesonEditor.state('table.numbersRight').checked`), false);
    await page.evaluate(`window.BeesonEditor.exec('table.numbersRight')`);
    await settle(page);
    const right = (s) => s.replace(/<(t[dh])>(Period|\\\(\d\.\d\d\\\))</g, '<$1 style="text-align: right">$2<');
    await byteExact(page, [[table, layoutTable(LAYOUT_ROWS.map(right))]]);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('table.numbersRight').checked`), true);
    await roundTrip(page);
  });

  test(`a right-click on a cell opens the menu of the cell, whose items act on it (${platform})`, async (t) => {
    const page = await open(platform, LAYOUTS_DECK);
    t.after(() => page.close?.());
    await show(page, '.reveal .slides table');
    await click(page, cellSelector(1, 0));
    await click(page, cellSelector(2, 1), { button: 'right' });
    await page.waitFor(`!!document.querySelector('.beeson-edit-menu.cell')`);
    const labels = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu.cell .item .label')].map((l) => l.textContent)`);
    for (const label of ['Add Row Above', 'Add Row Below', 'Add Column Before', 'Add Column After', 'Delete Row', 'Delete Column', 'Header Row', 'Delete Table']) {
      assert.ok(labels.some((l) => l.startsWith(label)), `${label} is not in the menu: ${labels.join(', ')}`);
    }
    assert.deepEqual(await focusCell(page), [2, 1]);
    const item = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-menu.cell .item')].find((b) => b.querySelector('.label').textContent === 'Delete Row'); const r = b.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
    await click(page, item);
    await settle(page);
    await byteExact(page, [[layoutTable(LAYOUT_ROWS), layoutTable(LAYOUT_ROWS.slice(0, 2))]]);
    await roundTrip(page);
  });

  test(`the Table pane of the inspector shows the cell of the caret and adds a row below it (${platform})`, async (t) => {
    const page = await open(platform, LAYOUTS_DECK);
    t.after(() => page.close?.());
    const panel = '#beeson-edit-panel-format';
    if (!(await page.evaluate(`window.BeesonEditor.state('shell.format').checked`))) await page.evaluate(`window.BeesonEditor.exec('shell.format')`);
    await show(page, '.reveal .slides table');
    await click(page, cellSelector(1, 0));
    await settle(page);
    assert.equal(await page.evaluate(`document.querySelector('${panel} .ed-panes')?.dataset.pane`), 'table');
    assert.equal(await page.evaluate(`document.querySelector('${panel} .ed-note')?.textContent`), '3 rows, 2 columns, cell A2');
    const below = await page.evaluate(`(() => { const r = document.querySelector('${panel} button[title="Add Row Below"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await click(page, below);
    await settle(page);
    await byteExact(page, [[layoutTable(LAYOUT_ROWS), layoutTable([LAYOUT_ROWS[0], LAYOUT_ROWS[1], '<tr><td></td><td></td></tr>', LAYOUT_ROWS[2]])]]);
    assert.deepEqual(await focusCell(page), [2, 0]);
    assert.equal(await page.evaluate(`document.querySelector('${panel} .ed-note')?.textContent`), '4 rows, 2 columns, cell A3');
    await roundTrip(page);
  });

  test(`a paste of tab-separated text onto the slide writes a table, numbers at the right (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await show(page, EQUATIONS);
    assert.equal(await page.evaluate('window.BeesonEditor.status().problems.length'), 0);
    await paste(page, { 'text/plain': 'Family\tPeriod\nLyapunov\t2.69\nHalo\t3.41\n' });
    await settled(page);
    const table = '<table>\n    <tbody>\n      <tr><th>Family</th><th style="text-align: right">Period</th></tr>\n      <tr><td>Lyapunov</td><td style="text-align: right">2.69</td></tr>\n      <tr><td>Halo</td><td style="text-align: right">3.41</td></tr>\n    </tbody>\n  </table>';
    const edited = await placed(page);
    assert.ok(edited.includes(table), `the table is not written:\n${edited.slice(edited.indexOf('Equations'), edited.indexOf('Equations') + 1600)}`);
    assert.equal(without(edited, table), page.source);
    // the new table is selected, and its bars are shown without a cell marked
    assert.equal(await page.evaluate(`window.BeesonEditor.state('table.delete').enabled`), true);
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-table-bars:not([hidden]) .bar > div')].length`), 5);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Paste Table');
    await roundTrip(page);
  });

  test(`a paste of lines without a tab is left to the paste of a text (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await show(page, EQUATIONS);
    await paste(page, { 'text/plain': 'one\ntwo' });
    await settled(page);
    assert.ok(!(await render(page)).includes('<table>'), 'plain lines are written as a table');
  });

  test(`a paste of an HTML table onto the slide writes its cells (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await show(page, EQUATIONS);
    const html = '<meta charset="utf-8"><table style="border:1px"><thead><tr><th>Body</th><th colspan="2">Mass</th></tr></thead><tbody><tr><td>Earth</td><td>5.97</td><td>e24 kg</td></tr><tr><td>Moon <b>&amp;</b> Luna</td><td>0.073</td><td>e24 kg</td></tr></tbody></table>';
    await paste(page, { 'text/html': html, 'text/plain': 'Body\tMass\nEarth\t5.97\te24 kg\nMoon & Luna\t0.073\te24 kg' });
    await settled(page);
    const table = '<table>\n    <tbody>\n      <tr><th>Body</th><th style="text-align: right">Mass</th><th></th></tr>\n      <tr><td>Earth</td><td style="text-align: right">5.97</td><td>e24 kg</td></tr>\n      <tr><td>Moon &amp; Luna</td><td style="text-align: right">0.073</td><td>e24 kg</td></tr>\n    </tbody>\n  </table>';
    assert.equal(without(await placed(page), table), page.source);
    await roundTrip(page);
  });

  test(`a paste of tab-separated text into a cell fills the cells from it on, with rows added (${platform})`, async (t) => {
    const page = await open(platform, LAYOUTS_DECK);
    t.after(() => page.close?.());
    await show(page, '.reveal .slides table');
    await click(page, cellSelector(2, 0));
    await paste(page, { 'text/plain': 'Axial\t4.0\nVertical\t4.4' });
    await settled(page);
    await byteExact(page, [[layoutTable(LAYOUT_ROWS), layoutTable([
      ...LAYOUT_ROWS.slice(0, 2),
      '<tr class="fragment" data-fragment-index="1"><td>Axial</td><td>4.0</td></tr>',
      '<tr><td>Vertical</td><td>4.4</td></tr>',
    ])]]);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Paste');
    await roundTrip(page);
  });
}

// the rows of the table of merged cells of TABLES_DECK, and the table of rows in its indentation
const MERGED_ROWS = [
  '<tr><th>Family</th><th>Period</th><th>Jacobi</th></tr>',
  '<tr><td rowspan="2">Halo</td><td style="text-align: right">14.8</td><td style="text-align: right">3.05</td></tr>',
  '<tr><td style="text-align: right">6.6</td><td style="text-align: right">3.04</td></tr>',
  '<tr><td colspan="2">Distant retrograde</td><td style="text-align: right">2.92</td></tr>',
];
const tbodyTable = (rows) => `<table>\n    <tbody>\n${rows.map((r) => `      ${r}\n`).join('')}    </tbody>\n  </table>`;
const R = '<td style="text-align: right">';

// the cells were counted with colspan only, hence a row or a column added at a cell next to a
// rowspan was written with a cell too many, or at the wrong column
for (const platform of ['mac', 'other']) {
  test(`a row added in a table with a rowspan grows the rowspan and gets a cell less (${platform})`, async (t) => {
    const page = await open(platform, TABLES_DECK);
    t.after(() => page.close?.());
    await show(page, 0);
    await click(page, cellSelector(1, 1));
    await page.evaluate(`window.BeesonEditor.exec('table.rowBelow')`);
    await settle(page);
    await byteExact(page, [[tbodyTable(MERGED_ROWS), tbodyTable([
      MERGED_ROWS[0],
      MERGED_ROWS[1].replace('rowspan="2"', 'rowspan="3"'),
      `<tr>${R}</td>${R}</td></tr>`,
      ...MERGED_ROWS.slice(2),
    ])]]);
    await roundTrip(page);
  });

  test(`a column added in a table with a rowspan is put at its column in each row (${platform})`, async (t) => {
    const page = await open(platform, TABLES_DECK);
    t.after(() => page.close?.());
    await show(page, 0);
    // the cell 6.6 is the first cell of its row and in the second column
    await click(page, cellSelector(2, 0));
    await page.evaluate(`window.BeesonEditor.exec('table.columnAfter')`);
    await settle(page);
    await byteExact(page, [[tbodyTable(MERGED_ROWS), tbodyTable([
      '<tr><th>Family</th><th>Period</th><th></th><th>Jacobi</th></tr>',
      `<tr><td rowspan="2">Halo</td>${R}14.8</td><td></td>${R}3.05</td></tr>`,
      `<tr>${R}6.6</td><td></td>${R}3.04</td></tr>`,
      `<tr><td colspan="2">Distant retrograde</td><td></td>${R}2.92</td></tr>`,
    ])]]);
    await roundTrip(page);
  });
}

// the letters of the columns and the numbers of the rows marked in the bars, whether the outline is
// drawn as cells selected as a block, and the cell of the caret
const marked = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-table-bars .bar > .on')].map((d) => d.textContent)`);
const asBlock = (page) => page.evaluate(`!!document.querySelector('.beeson-table-bars .cell.block:not([hidden])')`);

const PLAIN_ROWS = [
  '<tr><th>Body</th><th>Mass ratio</th><th>System</th></tr>',
  '<tr><td>Moon</td><td>\\(0.01215\\)</td><td>Earth and Moon</td></tr>',
  '<tr><td>Europa</td><td>2.53e-5</td><td>Jupiter</td></tr>',
  '<tr><td>Titan</td><td>2.37e-4</td><td>Saturn</td></tr>',
];

for (const platform of ['mac', 'other']) {
  test(`a drag across cells and a Shift-click select a range of cells, which the keys move and extend (${platform})`, async (t) => {
    const page = await open(platform, TABLES_DECK);
    t.after(() => page.close?.());
    await show(page, 1);
    const from = await at(page, cellSelector(1, 0));
    const to = await at(page, cellSelector(2, 1));
    await drag(page, from, { dx: to.x - from.x, dy: to.y - from.y });
    await settle(page);
    assert.deepEqual(await marked(page), ['A', 'B', '2', '3']);
    assert.ok(await asBlock(page));
    assert.equal(await focusCell(page), null);
    assert.equal(await selected(page), '');
    await click(page, cellSelector(3, 2), { modifiers: 'Shift' });
    await settle(page);
    assert.deepEqual(await marked(page), ['A', 'B', 'C', '2', '3', '4']);
    await press(page, 'Shift+ArrowLeft');
    await settle(page);
    assert.deepEqual(await marked(page), ['A', 'B', '2', '3', '4']);
    await press(page, 'Shift+ArrowUp');
    await press(page, 'Shift+ArrowUp');
    await settle(page);
    assert.deepEqual(await marked(page), ['A', 'B', '2']);
    // an arrow selects the one cell beside the focus, and stops at the edge of the table
    await press(page, 'ArrowRight');
    await press(page, 'ArrowRight');
    await settle(page);
    assert.deepEqual(await marked(page), ['C', '2']);
    await press(page, 'ArrowRight');
    await settle(page);
    assert.deepEqual(await marked(page), ['C', '2'], 'the arrow moved the table');
    assert.equal(await render(page), page.source);
    // Return puts the caret into the focus
    await press(page, 'Enter');
    await settle(page);
    assert.deepEqual(await focusCell(page), [1, 2]);
    // a Shift-click from the caret selects the cells between
    await click(page, cellSelector(3, 0), { modifiers: 'Shift' });
    await settle(page);
    assert.deepEqual(await marked(page), ['A', 'B', 'C', '2', '3', '4']);
    assert.equal(await focusCell(page), null);
    // a click into a cell puts the caret there again
    await click(page, cellSelector(2, 0));
    await settle(page);
    assert.deepEqual(await focusCell(page), [2, 0]);
    assert.ok(!(await asBlock(page)));
    assert.deepEqual(errors(page), []);
  });

  test(`a range of cells grows over a merged cell, and Select Row and Select Column select its lines (${platform})`, async (t) => {
    const page = await open(platform, TABLES_DECK);
    t.after(() => page.close?.());
    await show(page, 0);
    // from 6.6 down to Distant retrograde, which takes in Halo above it
    const from = await at(page, cellSelector(2, 0));
    const to = await at(page, cellSelector(3, 0));
    await drag(page, from, { dx: to.x - from.x, dy: to.y - from.y });
    await settle(page);
    assert.deepEqual(await marked(page), ['A', 'B', '2', '3', '4']);
    await click(page, cellSelector(1, 1));
    await page.evaluate(`window.BeesonEditor.exec('table.selectColumn')`);
    await settle(page);
    assert.deepEqual(await marked(page), ['A', 'B', '1', '2', '3', '4']);
    await click(page, cellSelector(2, 1));
    await page.evaluate(`window.BeesonEditor.exec('table.selectRow')`);
    await settle(page);
    assert.deepEqual(await marked(page), ['A', 'B', 'C', '2', '3']);
    // the menu of a cell in the range keeps the range, and its rows are added below it
    await click(page, cellSelector(2, 1), { button: 'right' });
    await settle(page);
    assert.deepEqual(await marked(page), ['A', 'B', 'C', '2', '3']);
    const items = await page.evaluate(`[...document.querySelectorAll('[role=menu][aria-label="cell menu"] [role=menuitem]')].map((r) => r.textContent)`);
    assert.ok(items.some((s) => s.startsWith('Select Row')) && items.some((s) => s.startsWith('Select Column')), items.join());
    await press(page, 'Escape');
    assert.deepEqual(errors(page), []);
  });

  test(`Delete clears the text of the cells selected as a block (${platform})`, async (t) => {
    const page = await open(platform, TABLES_DECK);
    t.after(() => page.close?.());
    await show(page, 1);
    await click(page, cellSelector(2, 1));
    await page.evaluate(`window.BeesonEditor.exec('table.selectColumn')`);
    await settle(page);
    await press(page, 'Backspace');
    await settled(page);
    await byteExact(page, [[tbodyTable(PLAIN_ROWS), tbodyTable(PLAIN_ROWS.map((r) => r.replace(/(<t[dh]>[^<]*<\/t[dh]>)<t([dh])>[^<]*<\/t[dh]>/, '$1<t$2></t$2>')))]]);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Clear Cells');
    assert.equal(await page.evaluate('document.querySelectorAll(".reveal section.present table").length'), 1);
    await roundTrip(page);
  });
}

// a drag from one cell of the current slide to another, by row and column
async function dragCells(page, [r0, c0], [r1, c1]) {
  const from = await at(page, cellSelector(r0, c0));
  const to = await at(page, cellSelector(r1, c1));
  await drag(page, from, { dx: to.x - from.x, dy: to.y - from.y });
  await settle(page);
}

for (const platform of ['mac', 'other']) {
  test(`Merge Cells writes the range as one cell with a colspan and a rowspan and the text of each cell on a line (${platform})`, async (t) => {
    const page = await open(platform, TABLES_DECK);
    t.after(() => page.close?.());
    await show(page, 1);
    // Moon and the formula above Europa and 2.53e-5
    await dragCells(page, [1, 0], [2, 1]);
    assert.equal((await page.evaluate(`window.BeesonEditor.state('table.unmerge')`)).enabled, false);
    if (platform === 'mac') await press(page, 'Ctrl+Mod+M');
    else await page.evaluate(`window.BeesonEditor.exec('table.merge')`);
    await settled(page);
    await byteExact(page, [[tbodyTable(PLAIN_ROWS), tbodyTable([
      PLAIN_ROWS[0],
      '<tr><td colspan="2" rowspan="2">Moon<br>\\(0.01215\\)<br>Europa<br>2.53e-5</td><td>Earth and Moon</td></tr>',
      '<tr><td>Jupiter</td></tr>',
      PLAIN_ROWS[3],
    ])]]);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Merge Cells');
    // the merged cell stays selected as a block, and is the range of Unmerge Cells
    assert.deepEqual(await marked(page), ['A', 'B', '2', '3']);
    assert.ok(await asBlock(page));
    assert.equal(await page.evaluate(`document.querySelector('.reveal section.present td[rowspan] mjx-container') !== null`), true);
    await roundTrip(page);
  });

  test(`Unmerge Cells splits each merged cell of the range into empty cells of its tag and alignment (${platform})`, async (t) => {
    const page = await open(platform, TABLES_DECK);
    t.after(() => page.close?.());
    await show(page, 0);
    // the column of Halo grows over Distant retrograde, which reaches into the second column
    await click(page, cellSelector(1, 0));
    await page.evaluate(`window.BeesonEditor.exec('table.selectColumn')`);
    await settle(page);
    assert.equal((await page.evaluate(`window.BeesonEditor.state('table.unmerge')`)).enabled, true);
    await page.evaluate(`window.BeesonEditor.exec('table.unmerge')`);
    await settled(page);
    await byteExact(page, [[tbodyTable(MERGED_ROWS), tbodyTable([
      MERGED_ROWS[0],
      `<tr><td>Halo</td>${R}14.8</td>${R}3.05</td></tr>`,
      `<tr><td></td>${R}6.6</td>${R}3.04</td></tr>`,
      `<tr><td>Distant retrograde</td><td></td>${R}2.92</td></tr>`,
    ])]]);
    assert.deepEqual(await marked(page), ['A', 'B', '1', '2', '3', '4']);
    assert.equal((await page.evaluate(`window.BeesonEditor.state('table.unmerge')`)).enabled, false);
    await roundTrip(page);
  });

  test(`a merged cell of an aligned column keeps its style, and a row left empty is taken out (${platform})`, async (t) => {
    const page = await open(platform, TABLES_DECK);
    t.after(() => page.close?.());
    await show(page, 0);
    // 14.8 and 3.05 over 6.6 and 3.04: the second row is then empty and taken out, and Halo with it
    // a row shorter
    await dragCells(page, [1, 1], [2, 1]);
    await page.evaluate(`window.BeesonEditor.exec('table.merge')`);
    await settled(page);
    await byteExact(page, [[tbodyTable(MERGED_ROWS), tbodyTable([
      MERGED_ROWS[0],
      `<tr><td>Halo</td><td style="text-align: right" colspan="2">14.8<br>3.05<br>6.6<br>3.04</td></tr>`,
      MERGED_ROWS[3],
    ])]]);
    await roundTrip(page);
  });

  test(`a merged cell of a header row is a th (${platform})`, async (t) => {
    const page = await open(platform, TABLES_DECK);
    t.after(() => page.close?.());
    await show(page, 0);
    // Period and Jacobi of the header row are one th
    await dragCells(page, [0, 1], [0, 2]);
    await page.evaluate(`window.BeesonEditor.exec('table.merge')`);
    await settled(page);
    await byteExact(page, [[tbodyTable(MERGED_ROWS), tbodyTable(['<tr><th>Family</th><th colspan="2">Period<br>Jacobi</th></tr>', ...MERGED_ROWS.slice(1)])]]);
    await roundTrip(page);
  });
}

// the widths of the content of the cells of the first row of the current slide in slide px, their
// widths in the layout, and the scale of the slide on the screen
const firstRow = (page) => page.evaluate(`(() => {
  const table = document.querySelector('.reveal section.present table');
  const cells = [...table.rows[0].cells];
  return {
    content: cells.map((c) => parseFloat(getComputedStyle(c).width)),
    outer: cells.map((c) => c.offsetWidth),
    table: table.offsetWidth,
    scale: table.getBoundingClientRect().width / table.offsetWidth,
  };
})()`);
// the widths in px written into the style of the cells of the first row of the plain table
const writtenWidths = (text) => {
  const m = text.match(/<tr><th(?: style="width: (\d+)px")?>Body<\/th><th(?: style="width: (\d+)px")?>Mass ratio<\/th><th(?: style="width: (\d+)px")?>System<\/th><\/tr>/);
  assert.ok(m, 'the first row of the plain table is not in the text');
  return m.slice(1).map((w) => (w === undefined ? null : Number(w)));
};
const withWidths = (widths) => PLAIN_ROWS.with(0, `<tr>${['Body', 'Mass ratio', 'System'].map((name, i) => (widths[i] === null ? `<th>${name}</th>` : `<th style="width: ${widths[i]}px">${name}</th>`)).join('')}</tr>`);
const near = (a, b, what) => assert.ok(Math.abs(a - b) <= 1.5, `${what}: ${a} is not ${b}`);

for (const platform of ['mac', 'other']) {
  test(`a drag of the border of two columns writes the widths of both into the cells of the first row (${platform})`, async (t) => {
    const page = await open(platform, TABLES_DECK);
    t.after(() => page.close?.());
    await show(page, 1);
    await click(page, cellSelector(2, 0));
    await settle(page);
    const before = await firstRow(page);
    await drag(page, '.beeson-table-bars .grip[data-grip="0"]', { dx: 20 });
    await settle(page);
    const text = await render(page);
    const [a, b, c] = writtenWidths(text);
    near(a, before.content[0] + 20 / before.scale, 'the left column');
    near(b, before.content[1] - 20 / before.scale, 'the right column');
    assert.equal(c, null);
    await byteExact(page, [[tbodyTable(PLAIN_ROWS), tbodyTable(withWidths([a, b, null]))]]);
    near((await firstRow(page)).table, before.table, 'the table');
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Resize Column');
    // the caret stays in its cell
    assert.deepEqual(await focusCell(page), [2, 0]);
    await roundTrip(page);
  });

  test(`a drag of a border stops where the words of a column leave it no narrower (${platform})`, async (t) => {
    const page = await open(platform, TABLES_DECK);
    t.after(() => page.close?.());
    await show(page, 1);
    await click(page, cellSelector(2, 0));
    await settle(page);
    const before = await firstRow(page);
    await drag(page, '.beeson-table-bars .grip[data-grip="0"]', { dx: 400 });
    await settle(page);
    const [a, b] = writtenWidths(await render(page));
    near((await firstRow(page)).table, before.table, 'the table');
    assert.ok(a > before.content[0] && b < before.content[1] && b >= 24, `${a} ${b}`);
    await roundTrip(page);
  });

  test(`a drag of the last border widens the last column, and Resize Column to Fit Content sets it on one line (${platform})`, async (t) => {
    const page = await open(platform, TABLES_DECK);
    t.after(() => page.close?.());
    await show(page, 1);
    await click(page, cellSelector(1, 2));
    await settle(page);
    const lines = () => page.evaluate(`(() => {
      const r = document.createRange();
      r.selectNodeContents(document.querySelector(${js(cellSelector(1, 2))}));
      return new Set([...r.getClientRects()].map((b) => Math.round(b.top))).size;
    })()`);
    assert.equal(await lines(), 1);
    const before = await firstRow(page);
    await drag(page, '.beeson-table-bars .grip[data-grip="2"]', { dx: -before.content[2] * before.scale * 0.6 });
    await settle(page);
    assert.ok(await lines() > 1, 'Earth and Moon is on one line in a narrow column');
    await page.evaluate(`window.BeesonEditor.exec('table.fitColumn')`);
    await settle(page);
    assert.equal(await lines(), 1);
    const [a, b, c] = writtenWidths(await render(page));
    assert.deepEqual([a, b], [null, null]);
    near(c, before.content[2], 'the fitted column');
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Resize Column to Fit Content');
    await roundTrip(page, 2);
  });

  test(`Distribute Columns Evenly makes the columns as wide as each other in the same width (${platform})`, async (t) => {
    const page = await open(platform, TABLES_DECK);
    t.after(() => page.close?.());
    await show(page, 1);
    await click(page, cellSelector(2, 0));
    const before = await firstRow(page);
    await page.evaluate(`window.BeesonEditor.exec('table.distributeColumns')`);
    await settle(page);
    const after = await firstRow(page);
    const each = before.outer.reduce((x, y) => x + y) / 3;
    for (const [i, w] of after.outer.entries()) near(w, each, `the column ${i}`);
    near(after.table, before.table, 'the table');
    assert.ok(writtenWidths(await render(page)).every((w) => w !== null));
    await roundTrip(page);
  });

  test(`Distribute Columns Evenly in a range of two columns keeps the third (${platform})`, async (t) => {
    const page = await open(platform, TABLES_DECK);
    t.after(() => page.close?.());
    await show(page, 1);
    const before = await firstRow(page);
    await dragCells(page, [2, 1], [3, 2]);
    await page.evaluate(`window.BeesonEditor.exec('table.distributeColumns')`);
    await settle(page);
    const after = await firstRow(page);
    near(after.outer[1], (before.outer[1] + before.outer[2]) / 2, 'the column B');
    near(after.outer[2], (before.outer[1] + before.outer[2]) / 2, 'the column C');
    near(after.outer[0], before.outer[0], 'the column A');
    assert.equal(writtenWidths(await render(page))[0], null);
    assert.ok(await asBlock(page));
    await roundTrip(page);
  });
}

for (const platform of ['mac', 'other']) {
  const autoAlign = (page) => (platform === 'mac' ? press(page, 'Alt+Mod+U') : page.evaluate(`window.BeesonEditor.exec('table.autoAlign')`));

  test(`Auto-Align sets a column of numbers at the right in the style of its cells (${platform})`, async (t) => {
    const page = await open(platform, TABLES_DECK);
    t.after(() => page.close?.());
    await show(page, 1);
    await click(page, cellSelector(2, 0));
    await autoAlign(page);
    await settle(page);
    const right = (r) => r.replace(/<(t[dh])>((?:\\\(0\.01215\\\)|2\.53e-5|2\.37e-4|Mass ratio))</, '<$1 style="text-align: right">$2<');
    await byteExact(page, [[tbodyTable(PLAIN_ROWS), tbodyTable(PLAIN_ROWS.map(right))]]);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Auto-Align');
    assert.equal((await page.evaluate(`window.BeesonEditor.state('table.autoAlign')`)).enabled, false);
    await roundTrip(page);
  });

  test(`Auto-Align in a range sets only the cells of the range (${platform})`, async (t) => {
    const page = await open(platform, TABLES_DECK);
    t.after(() => page.close?.());
    await show(page, 1);
    // Europa and Titan with their numbers and systems
    await dragCells(page, [2, 0], [3, 2]);
    assert.deepEqual(await marked(page), ['A', 'B', 'C', '3', '4']);
    await autoAlign(page);
    await settle(page);
    await byteExact(page, [[tbodyTable(PLAIN_ROWS), tbodyTable([
      ...PLAIN_ROWS.slice(0, 2),
      '<tr><td>Europa</td><td style="text-align: right">2.53e-5</td><td>Jupiter</td></tr>',
      '<tr><td>Titan</td><td style="text-align: right">2.37e-4</td><td>Saturn</td></tr>',
    ])]]);
    assert.ok(await asBlock(page));
    await roundTrip(page);
  });

  test(`Auto-Align sets a word at the right at the left again, as the theme sets a text (${platform})`, async (t) => {
    const page = await open(platform, TABLES_DECK);
    t.after(() => page.close?.());
    await show(page, 2);
    await click(page, cellSelector(2, 0));
    await autoAlign(page);
    await settle(page);
    await byteExact(page, [[
      '<tr><th>Orbit</th><th>Period</th></tr>\n      <tr><td style="text-align: right">Halo</td><td>14.8</td></tr>\n      <tr><td>Lyapunov</td><td>2.69</td></tr>',
      `<tr><th>Orbit</th><th style="text-align: right">Period</th></tr>\n      <tr><td>Halo</td>${R}14.8</td></tr>\n      <tr><td>Lyapunov</td>${R}2.69</td></tr>`,
    ]]);
    await roundTrip(page);
  });
}
