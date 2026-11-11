// the plots and the surfaces of the editor, on both platforms: Insert > Plot, the series, the
// ranges, the paste, and the tabs of the Plot Data window, the titles, the ranges, and the colors of
// the Plot pane, and the readout of the camera of a surface turned by a drag. each edit is checked
// byte for byte, after an undo and a redo, against the scope rule, and after a save and an open of
// the saved text

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { addSeries, addTab, clearCells, deleteSeries, deleteTab, moveSeries, parseTsv, pasteCells, setKey, sheetsOf } from '../src/editor/plotdata.ts';
import { byteExact, center, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const PANEL = '#beeson-edit-panel-format';
const WINDOW = '.beeson-plotdata';
const PLOT_SLIDE = 8;
const SPLIT_SLIDE = 10;
const SURFACE_SLIDE = 11;
const APPENDIX_SLIDE = 16;

const BLOCK = `{
  "panels": [{ "id": "p", "x": { "range": [0, 2] }, "y": { "range": [-1, 1] } }],
  "marks": [
    { "id": "a", "panel": "p", "kind": "trace" },
    { "id": "b", "panel": "p", "kind": "points" }
  ],
  "tabs": [
    { "name": "one", "values": [0, 1, 2], "data": { "a": [[0, 0], [1, 1], [2, 0]], "b": [[0, 1], [1, 0], [2, 1]] } },
    { "name": "two", "label": "Two", "values": [0, 1], "data": { "a": [[0, 0], [1, 1]], "b": [[1, 1], [0, 0]] } }
  ]
}`;

test('a series is added after the series of a column with the separators of the block, moved, and deleted again', () => {
  const [one] = sheetsOf(BLOCK);
  assert.deepEqual(one.series, [null, 'a', 'a', 'b', 'b']);
  const added = addSeries(BLOCK, one, 1);
  assert.equal(added.error, null);
  assert.equal(added.id, 'series-1');
  const expected = BLOCK
    .replace('"kind": "trace" },\n', '"kind": "trace" },\n    { "id": "series-1", "panel": "p", "kind": "trace", "tone": "data-1" },\n')
    .replace('[2, 0]], "b"', '[2, 0]], "series-1": [[0, -1], [1, 0], [2, 1]], "b"')
    .replace('[1, 1]], "b": [[1, 1]', '[1, 1]], "series-1": [[0, -1], [2, 1]], "b": [[1, 1]');
  assert.equal(added.text, expected);
  assert.deepEqual(sheetsOf(added.text)[0].columns.slice(1), ['a x', 'a y', 'series-1 x', 'series-1 y', 'b x', 'b y']);
  // a move swaps the marks and the data of every tab, and the separators keep their places
  const moved = moveSeries(added.text, 'series-1', 'a', false);
  assert.match(moved.text, /"marks": \[\n {4}\{ "id": "series-1", "panel": "p", "kind": "trace", "tone": "data-1" \},\n {4}\{ "id": "a",/);
  assert.match(moved.text, /"data": \{ "series-1": \[\[0, -1\], \[1, 0\], \[2, 1\]\], "a": \[\[0, 0\], \[1, 1\], \[2, 0\]\], "b"/);
  assert.equal(moveSeries(moved.text, 'series-1', 'a', true).text, added.text);
  assert.equal(deleteSeries(added.text, 'series-1').text, BLOCK);
  assert.equal(deleteSeries(moved.text, 'series-1').text, BLOCK);
  assert.match(addSeries(BLOCK, sheetsOf(BLOCK).at(-1), 0).error, /not added to the sheet Axes/);
});

test('a tab is copied after itself under a new name and deleted, and a plot keeps one tab', () => {
  const copy = addTab(BLOCK, 1);
  assert.equal(copy.name, 'two-1');
  assert.ok(copy.text.includes('"label": "Two", "values": [0, 1], "data": { "a": [[0, 0], [1, 1]], "b": [[1, 1], [0, 0]] } },\n    { "name": "two-1", "label": "two-1", "values"'));
  assert.deepEqual(sheetsOf(copy.text).filter((s) => s.tab !== null).map((s) => s.name), ['one', 'Two', 'two-1']);
  assert.equal(deleteTab(copy.text, 2).text, BLOCK);
  const single = deleteTab(BLOCK, 1).text;
  assert.match(deleteTab(single, 0).error, /keeps at least one tab/);
});

test('a range pasted from a spreadsheet fills the cells and grows a tab by rows and series, and a range is cleared', () => {
  assert.deepEqual(parseTsv('1\t2\r\n3\t4\r\n'), [['1', '2'], ['3', '4']]);
  // two rows from the last row: one row is added to every array of the tab
  const grown = pasteCells(BLOCK, 'tab:one', 2, 1, [['2', '0.5'], ['2.5', '-0.5']]);
  assert.equal(grown.error, null);
  const tab = sheetsOf(grown.text)[0];
  assert.deepEqual(tab.rows.map((r) => r.map((c) => c.text)), [['0', '0', '0', '0', '1'], ['1', '1', '1', '1', '0'], ['2', '2', '0.5', '2', '1'], ['3', '2.5', '-0.5', '2', '1']]);
  // a range wider than the tab adds a series
  const wide = pasteCells(BLOCK, 'tab:one', 0, 4, [['0.1', '0.2', '0.3']]);
  assert.deepEqual(sheetsOf(wide.text)[0].columns.slice(-2), ['series-1 x', 'series-1 y']);
  assert.deepEqual(sheetsOf(wide.text)[0].rows[0].slice(4).map((c) => c.text), ['0.1', '0.2', '0.3'])
  // a text that is not a number is refused
  assert.match(pasteCells(BLOCK, 'tab:one', 0, 1, [['x']]).error, /x is not a number/);
  // the axes do not grow
  assert.equal(pasteCells(BLOCK, 'axes', 0, 2, [['-3', '3', '9']]).text, BLOCK.replace('"y": { "range": [-1, 1] }', '"y": { "range": [-3, 3] }'));
  // a number cell is not cleared, since a plot does not draw a missing value
  const cleared = clearCells(BLOCK, [[tab.rows[1][3], tab.rows[1][4]]]);
  assert.equal(cleared.text, BLOCK);
  assert.deepEqual(cleared.kept, [tab.rows[1][3], tab.rows[1][4]]);
});

test('a key of the block is set, added at the end of its object, and taken out', () => {
  const titled = setKey(BLOCK, ['panels', 0, 'x'], 'title', '"$t$"');
  assert.equal(titled.text, BLOCK.replace('"x": { "range": [0, 2] }', '"x": { "range": [0, 2], "title": "$t$" }'));
  assert.equal(setKey(titled.text, ['panels', 0, 'x'], 'title', '"time"').text, BLOCK.replace('"x": { "range": [0, 2] }', '"x": { "range": [0, 2], "title": "time" }'));
  assert.equal(setKey(titled.text, ['panels', 0, 'x'], 'title', null).text, BLOCK);
  assert.match(setKey(BLOCK, ['marks', 1], 'tone', '"data-3"').text, /\{ "id": "b", "panel": "p", "kind": "points", "tone": "data-3" \}/);
  assert.match(setKey(BLOCK, ['marks', 1], 'kind', '"bar"').error, /one of points, trace/);
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

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

let last = null;

async function deckPage(platform, slide) {
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
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${slide})`);
  await frames(page);
  return page;
}

async function inScope(page) {
  const now = textProblems(await render(page), THEME);
  for (const p of textProblems(page.source, THEME)) {
    const i = now.indexOf(p);
    if (i >= 0) now.splice(i, 1);
  }
  assert.deepEqual(now, []);
}

// the edit checked byte for byte, then after an undo, which gives the file with the edits before,
// and again after a redo
async function roundTrip(page, edits, label, before = []) {
  let expected = page.source;
  for (const [a, b] of edits) expected = expected.replace(a, () => b);
  await page.waitFor(`window.BeesonEditor.render() === ${JSON.stringify(expected)}`).catch(() => {});
  await byteExact(page, edits);
  await inScope(page);
  assert.equal((await state(page, 'edit.undo')).label, `Undo ${label}`);
  await undo(page);
  await byteExact(page, before);
  await redo(page);
  await byteExact(page, edits);
}

let saves = 0;
async function saved(page) {
  const { text } = await saveAndReopen(page, `r10-1-${++saves}.html`);
  page.source = text;
  await byteExact(page);
}

const cell = (r, c) => `${WINDOW} input[data-r="${r}"][data-c="${c}"]`;
const focusCell = (page, r, c) => page.evaluate(`(() => { const i = document.querySelector(${JSON.stringify(cell(r, c))}); i.focus(); i.select(); return true; })()`);
const grid = (page) => page.evaluate(`[...document.querySelectorAll('${WINDOW} tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.querySelector('input')?.value ?? null))`);
const heads = (page) => page.evaluate(`[...document.querySelectorAll('${WINDOW} thead th')].slice(1).map((th) => th.textContent)`);
const sheets = (page) => page.evaluate(`[...document.querySelectorAll('${WINDOW} .sheets button[role="tab"]')].map((b) => b.textContent)`);
const picked = (page) => page.evaluate(`[...document.querySelectorAll('${WINDOW} td.sel input')].map((i) => i.dataset.r + ',' + i.dataset.c)`);
const status = (page) => page.evaluate(`document.querySelector('${WINDOW} .state').textContent`);
// a clipboard event at the focused cell, with the text of a paste, and the text put by a copy
const clipboard = (page, type, text = '') => page.evaluate(`(() => {
  const data = new DataTransfer();
  if (${JSON.stringify(text)}) data.setData('text/plain', ${JSON.stringify(text)});
  document.activeElement.dispatchEvent(new ClipboardEvent(${JSON.stringify(type)}, { clipboardData: data, bubbles: true, cancelable: true }));
  return data.getData('text/plain');
})()`);

async function openData(page) {
  await click(page, '.reveal section.present .plot');
  await press(page, 'Mod+Shift+D');
  await page.waitFor(`!!document.querySelector('${WINDOW}:not([hidden])')`);
}

// the JSON block of the plot of the plate of the layouts deck, whose marks are also those of the plot
// of a zone, hence an edit of the plate is written as a replacement of its whole block
const SOURCE = readFileSync(LAYOUTS, 'utf8');
const PLATE = SOURCE.slice(SOURCE.indexOf('id="plate-plot">{'), SOURCE.indexOf('}</script>', SOURCE.indexOf('id="plate-plot">{')));
const plate = (...pairs) => [[PLATE, pairs.reduce((t, [a, b]) => {
  assert.equal(t.split(a).length, 2, `${a} does not occur once in the plate`);
  return t.replace(a, () => b);
}, PLATE)]];
const MARKS = `    "marks": [
      { "id": "dot", "panel": "left", "kind": "points" },
      { "id": "path", "panel": "right", "kind": "trace" }
    ],`;
const ONE = '"dot": [[0, 0], [1, 1]], "path": [[0, 0], [1, 0]]';
const TWO = '"dot": [[1, 0], [0, 1]], "path": [[0, 0], [1, 1]]';
const MARK = { dot: '{ "id": "dot", "panel": "left", "kind": "points" }', path: '{ "id": "path", "panel": "right", "kind": "trace" }', 'series-1': '{ "id": "series-1", "panel": "left", "kind": "trace", "tone": "data-1" }' };
const DATA = [
  { dot: '"dot": [[0, 0], [1, 1]]', path: '"path": [[0, 0], [1, 0]]', 'series-1': '"series-1": [[0, 0], [1, 1]]' },
  { dot: '"dot": [[1, 0], [0, 1]]', path: '"path": [[0, 0], [1, 1]]', 'series-1': '"series-1": [[0, 0], [1, 1]]' },
];
const order = (...ids) => plate(
  [MARKS, `    "marks": [\n${ids.map((id) => `      ${MARK[id]}`).join(',\n')}\n    ],`],
  [ONE, ids.map((id) => DATA[0][id]).join(', ')],
  [TWO, ids.map((id) => DATA[1][id]).join(', ')],
);

for (const platform of PLATFORMS) {
  test(`Insert > Plot fills an empty zone with a plot of one line, opens its data, and is one entry (${platform})`, async () => {
    const page = await deckPage(platform, SPLIT_SLIDE);
    await exec(page, 'slide.new.split');
    await frames(page);
    page.source = await render(page);
    // Plot is in the Insert menu after Table, as Chart is in Keynote
    const items = await page.evaluate(`window.BeesonEditorShell.menuItems('Insert').filter((i) => i.command).map((i) => i.command)`);
    assert.equal(items[items.indexOf('insert.table') + 1], 'insert.plot');
    assert.equal((await state(page, 'insert.plot')).label, 'Plot');
    // the toolbar has Plot after Table, and else it is in the menu » of the toolbar
    const tools = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-top [data-command]')].map((b) => b.dataset.command)`);
    if (tools.includes('insert.plot')) {
      assert.equal(tools[tools.indexOf('insert.table') + 1], 'insert.plot');
      await click(page, `.beeson-edit-top [data-command="insert.plot"]`);
    } else {
      await exec(page, 'insert.plot');
    }
    await page.waitFor(`!!document.querySelector('${WINDOW}:not([hidden])')`);
    const id = await page.evaluate(`document.querySelector('.reveal section.present .plot').dataset.plot`);
    const json = [
      `<div class="plot zone" data-plot="${id}"></div>`,
      `  <script type="application/json" id="${id}">{`,
      '    "duration": 2,',
      '    "panels": [{ "id": "main", "x": { "range": [0, 1], "title": "$x$" }, "y": { "range": [0, 1], "title": "$y$" } }],',
      '    "marks": [{ "id": "line", "panel": "main", "kind": "trace" }],',
      '    "tabs": [{ "name": "data", "values": [0, 0.25, 0.5, 0.75, 1], "data": { "line": [[0, 0.1], [0.25, 0.45], [0.5, 0.6], [0.75, 0.7], [1, 0.9]] } }]',
      '  }</script>',
    ].join('\n');
    const empty = page.source.slice(page.source.lastIndexOf('<section class="split">'));
    const zone = empty.slice(0, empty.indexOf('</section>'));
    // the plot is drawn, selected, and its data are shown in the window
    assert.ok(await page.evaluate(`!!document.querySelector('.reveal section.present .plot .plot-body svg')`));
    assert.deepEqual(await page.evaluate(`window.BeesonEditor.selection().map((el) => el.dataset.plot)`), [id]);
    assert.equal(await page.evaluate(`document.querySelector('${WINDOW} .title').textContent`), `Plot Data of ${id}`);
    assert.deepEqual(await heads(page), ['Value', 'line x', 'line y']);
    assert.equal((await grid(page)).length, 5);
    await roundTrip(page, [[zone, zone.replace('<div class="zone"></div>', json)]], 'Insert Plot');
    await saved(page);
    assert.deepEqual(errors(page), []);
  });

  test(`Insert > Plot adds a zone on a slide without an empty one (${platform})`, async () => {
    const page = await deckPage(platform, APPENDIX_SLIDE);
    await exec(page, 'insert.plot');
    await page.waitFor(`!!document.querySelector('${WINDOW}:not([hidden])')`);
    const id = await page.evaluate(`document.querySelector('.reveal section.present .plot').dataset.plot`);
    const words = '  <p>A slide after the closing slide.</p>\n';
    const text = await render(page);
    assert.ok(text.includes(`${words}  <div class="plot zone" data-plot="${id}"></div>\n  <script type="application/json" id="${id}">{`));
    await inScope(page);
    await undo(page);
    await byteExact(page);
    assert.equal(await page.evaluate(`!!document.querySelector('${WINDOW}:not([hidden])')`), false);
    await redo(page);
    assert.equal(await render(page), text);
    assert.deepEqual(errors(page), []);
  });

  test(`a series is added, moved by a command and by a drag of its head, and deleted in the data window (${platform})`, async () => {
    const page = await deckPage(platform, PLOT_SLIDE);
    await openData(page);
    await focusCell(page, 0, 2);
    await click(page, `${WINDOW} button[data-command="plot.addSeries"]`);
    const added = order('dot', 'series-1', 'path');
    await roundTrip(page, added, 'Add Series');
    assert.deepEqual(await heads(page), ['t', 'dot x', 'dot y', 'series-1 x', 'series-1 y', 'path x', 'path y']);
    assert.equal(await page.evaluate('document.activeElement.dataset.c'), '3');
    await exec(page, 'plot.moveSeriesRight');
    const right = order('dot', 'path', 'series-1');
    await roundTrip(page, right, 'Move Series Right', added);
    assert.deepEqual(await heads(page), ['t', 'dot x', 'dot y', 'path x', 'path y', 'series-1 x', 'series-1 y']);
    // a drag of a head of the series onto the left half of dot puts it before dot
    const from = await center(page, `${WINDOW} thead th[data-series="series-1"]`);
    const to = await center(page, `${WINDOW} thead th[data-c="1"]`);
    await drag(page, from, { dx: to.x - from.x, dy: 0 });
    const first = order('series-1', 'dot', 'path');
    await roundTrip(page, first, 'Move Series', right);
    assert.deepEqual(await heads(page), ['t', 'series-1 x', 'series-1 y', 'dot x', 'dot y', 'path x', 'path y']);
    await focusCell(page, 0, 1);
    await click(page, `${WINDOW} button[data-command="plot.deleteSeries"]`);
    await roundTrip(page, [], 'Delete Series', first);
    // the values are not a series
    await focusCell(page, 0, 0);
    assert.equal((await state(page, 'plot.deleteSeries')).enabled, false);
    await saved(page);
    assert.deepEqual(errors(page), []);
  });

  test(`a range is selected by Shift, copied as text with tabs, pasted from a spreadsheet, and cleared (${platform})`, async () => {
    const page = await deckPage(platform, PLOT_SLIDE);
    await openData(page);
    await focusCell(page, 0, 1);
    await press(page, 'Shift+ArrowDown');
    await press(page, 'Shift+ArrowRight');
    assert.deepEqual(await picked(page), ['0,1', '0,2', '1,1', '1,2']);
    assert.equal(await status(page), '2 × 2 cells selected.');
    assert.equal(await clipboard(page, 'copy'), '0\t0\n1\t1');
    // a click with Shift picks the range up to its cell, and the focus stays in the first cell
    await click(page, cell(1, 4), { modifiers: 'Shift' });
    assert.equal((await picked(page)).length, 8);
    assert.equal(await page.evaluate('document.activeElement.dataset.c'), '1');
    // a paste of three rows from a spreadsheet adds a row
    await click(page, cell(0, 2));
    await clipboard(page, 'paste', '0.2\t0.3\n0.4\t0.5\n0.6\t0.7\n');
    const values = ['{ "name": "one", "values": [0, 1]', '{ "name": "one", "values": [0, 1, 2]'];
    const pasted = plate([ONE, '"dot": [[0, 0.2], [1, 0.4], [1, 0.6]], "path": [[0.3, 0], [0.5, 0], [0.7, 0]]'], values);
    await page.waitFor(`document.querySelectorAll('${WINDOW} tbody tr').length === 3`);
    assert.deepEqual(await grid(page), [['0', '0', '0.2', '0.3', '0'], ['1', '1', '0.4', '0.5', '0'], ['2', '1', '0.6', '0.7', '0']]);
    assert.deepEqual(await picked(page), ['0,2', '0,3', '1,2', '1,3', '2,2', '2,3']);
    await roundTrip(page, pasted, 'Paste');
    // Delete keeps the numbers of the range, marked invalid, since a plot does not draw a missing
    // value
    await focusCell(page, 0, 2);
    for (const key of ['Shift+ArrowDown', 'Shift+ArrowDown', 'Shift+ArrowRight']) await press(page, key);
    assert.equal(await status(page), '3 × 2 cells selected.');
    await press(page, 'Delete');
    await frames(page);
    await byteExact(page, pasted);
    assert.equal(await page.evaluate(`document.querySelectorAll('${WINDOW} td.bad').length`), 6);
    // a range picked by a drag over the cells
    await drag(page, cell(0, 1), { dx: (await center(page, cell(1, 2))).x - (await center(page, cell(0, 1))).x, dy: (await center(page, cell(1, 2))).y - (await center(page, cell(0, 1))).y });
    assert.deepEqual(await picked(page), ['0,1', '0,2', '1,1', '1,2']);
    await press(page, 'Escape');
    assert.deepEqual(await picked(page), []);
    await saved(page);
    assert.deepEqual(errors(page), []);
  });

  test(`the size of a range stays in the state of the data window while the editor is refreshed (${platform})`, async () => {
    const page = await deckPage(platform, PLOT_SLIDE);
    await openData(page);
    await focusCell(page, 0, 1);
    await press(page, 'Shift+ArrowDown');
    await press(page, 'Shift+ArrowRight');
    assert.equal(await status(page), '2 × 2 cells selected.');
    // a switch of the View menu refreshes every pane, as a late event of the selection does
    for (const id of ['view.rulers', 'view.rulers']) {
      await exec(page, id);
      await frames(page);
      assert.deepEqual(await picked(page), ['0,1', '0,2', '1,1', '1,2']);
      assert.equal(await status(page), '2 × 2 cells selected.');
    }
    assert.deepEqual(errors(page), []);
  });

  test(`a tab is added and deleted in the data window, and a tab named by a step is kept at Esc of its confirmation (${platform})`, async () => {
    const page = await deckPage(platform, PLOT_SLIDE);
    await openData(page);
    await click(page, `${WINDOW} button[data-command="plot.addTab"]`);
    const tabs = `{ "name": "one", "values": [0, 1], "data": { ${ONE} } },`;
    const copy = [[tabs, `${tabs}\n      { "name": "one-1", "values": [0, 1], "data": { ${ONE} } },`]];
    await roundTrip(page, copy, 'Add Tab');
    assert.deepEqual(await sheets(page), ['one', 'one-1', 'two', 'Axes']);
    assert.equal(await page.evaluate(`document.querySelector('${WINDOW} .sheets [aria-selected="true"]').textContent`), 'one-1');
    await click(page, `${WINDOW} button[data-command="plot.deleteTab"]`);
    await roundTrip(page, [], 'Delete Tab', copy);
    // the tab two is shown by a step of the slide
    await click(page, await page.evaluate(`(() => { const r = [...document.querySelectorAll('${WINDOW} .sheets button[role="tab"]')].find((b) => b.textContent === 'two').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
    // a confirmation names the step, and Esc keeps the tab
    await click(page, `${WINDOW} button[data-command="plot.deleteTab"]`);
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-card[open]')`);
    assert.match(await page.evaluate(`document.querySelector('dialog.beeson-edit-card[open]').textContent`), /tab two is named by step 2/);
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('dialog.beeson-edit-card[open]')`);
    await byteExact(page);
    await saved(page);
    assert.deepEqual(errors(page), []);
  });

  test(`the Plot pane sets the titles and the ranges of the axes and the data color of a series (${platform})`, async () => {
    const page = await deckPage(platform, PLOT_SLIDE);
    await click(page, '.reveal section.present .plot');
    await frames(page);
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-sec > h5')].map((h) => h.textContent)`), ['Data', 'Panel left', 'Panel right', 'Series Colors']);
    // the pane is taller than the window with the scales and the axes of two panels, hence a
    // control is scrolled into view before a click
    const field = async (name, text) => {
      await page.evaluate(`document.querySelector('${PANEL} input[name="${name}"]').scrollIntoView({ block: 'center' })`);
      await click(page, `${PANEL} input[name="${name}"]`);
      await page.evaluate(`document.querySelector('${PANEL} input[name="${name}"]').select()`);
      if (text) await type(page, text);
      else await press(page, 'Backspace');
      await press(page, 'Enter');
    };
    const left = '{ "id": "left", "x": { "range": [0, 1] }, "y": { "range": [0, 1] } }';
    const right = '{ "id": "right", "x": { "range": [0, 1] }, "y": { "range": [-1, 1] } }';
    await field('plot-0-x-title', '$t$ (days)');
    const title = [left, left.replace('"range": [0, 1] }', '"range": [0, 1], "title": "$t$ (days)" }')];
    const range = [right, right.replace('[-1, 1]', '[-2, 1]')];
    const tone = [MARK.dot, MARK.dot.replace(' }', ', "tone": "data-3" }')];
    const titled = plate(title);
    await roundTrip(page, titled, 'Axis Title');
    await field('plot-1-y-from', '-2');
    const ranged = plate(title, range);
    await roundTrip(page, ranged, 'Axis Range', titled);
    // a range whose ends are reversed is refused
    await field('plot-1-y-to', '-5');
    await frames(page);
    await byteExact(page, ranged);
    await page.evaluate(`document.querySelector('${PANEL} button[aria-label="dot in data color 3"]').scrollIntoView({ block: 'center' })`);
    await click(page, `${PANEL} button[aria-label="dot in data color 3"]`);
    const toned = plate(title, range, tone);
    await roundTrip(page, toned, 'Series Color', ranged);
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} button[aria-label="dot in data color 3"]').getAttribute('aria-pressed')`), 'true');
    // the series is drawn in the color picked
    assert.ok(await page.evaluate(`[...document.querySelectorAll('.reveal section.present .plot-body [style*="color"]')].some((el) => el.style.color === 'var(--data-3)')`))
    // an empty title is taken out of the block
    await field('plot-0-x-title', '');
    await roundTrip(page, plate(range, tone), 'Axis Title', toned);
    await saved(page);
    assert.deepEqual(errors(page), []);
  });

  test(`a drag on a surface shows its azimuth and elevation at the pointer, and the fields follow it (${platform})`, async () => {
    const page = await deckPage(platform, SURFACE_SLIDE);
    await click(page, '.reveal section.present .surface');
    await frames(page);
    const readout = () => page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-offset')].find((e) => !e.hidden); return r ? r.textContent : null; })()`);
    const fields = () => page.evaluate(`['azimuth', 'elevation'].map((n) => document.querySelector('${PANEL} input[name="' + n + '"]').value)`);
    assert.deepEqual(await fields(), ['-60', '32']);
    await drag(page, '.reveal section.present .surface', { dx: 80, dy: 30, hold: true });
    const shown = await readout();
    const m = /^(-?\d+)°  (\d+)°$/.exec(shown ?? '');
    assert.ok(m, `the readout is ${shown}`);
    assert.notEqual(m[1], '-60');
    assert.deepEqual(await fields(), [m[1], m[2]]);
    const at = await center(page, '.reveal section.present .surface');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x + 80, y: at.y + 30, button: 'left', clickCount: 1 });
    await frames(page);
    assert.equal(await readout(), null);
    // the fields keep the view of the drag, marked as not written, until Use Current View writes it
    assert.deepEqual(await fields(), [m[1], m[2]]);
    assert.ok(await page.evaluate(`document.querySelector('${PANEL} input[name="azimuth"]').closest('.ed-num').classList.contains('turned')`));
    await byteExact(page);
    await click(page, `${PANEL} button[data-command="surface.useView"]`);
    const tag = '<div class="surface" data-function="effective-potential" data-mu="0.05">';
    await roundTrip(page, [[tag, tag.replace('>', ` data-azimuth="${m[1]}" data-elevation="${m[2]}">`)]], 'Use Current View');
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} input[name="azimuth"]').closest('.ed-num').classList.contains('turned')`), false);
    assert.deepEqual(errors(page), []);
  });
}
