// the data editor of a plot and the Surface pane, on both platforms: the sheets of the JSON block of
// a plot, the cells written to the block alone, a value that cannot be read shown in red and not
// written, the rows added and deleted, a drag that turns a surface, Use Current View, a drag from
// the edge of a surface that moves it, and a camera written to the surfaces that share it. each
// edit is checked byte for byte, after an undo and a redo, against the scope rule, and after a save
// and an open of the saved text

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { addRow, check, deleteRow, literal, setCell, sheetsOf } from '../src/editor/plotdata.ts';
import { byteExact, center, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const PANEL = '#beeson-edit-panel-format';
const WINDOW = '.beeson-plotdata';
const PLOT_SLIDE = 8;
const SURFACE_SLIDE = 11;

// the JSON block of test/pages/plot-loop.html, with a trace given with a ghost and an events mark
const LOOP = `{
  "duration": 1,
  "panels": [{ "id": "p", "x": { "range": [0, 1] }, "y": { "range": [-1, 1] } }],
  "marks": [
    { "id": "dot", "panel": "p", "kind": "points" },
    { "id": "path", "panel": "p", "kind": "trace" },
    { "id": "event", "panel": "p", "kind": "events" },
    { "id": "note", "panel": "p", "kind": "label" }
  ],
  "tabs": [{
    "name": "one",
    "label": "$\\\\mu$ one",
    "values": [0, 0.5, 1],
    "times": [0, 0.4, 1],
    "data": {
      "dot": [[0, 0], [0.5, 0.5], [1, 1]],
      "path": { "points": [[0, 0], [0.5, 1], [1, -1]], "ghost": 2 },
      "event": [{ "frame": 2, "at": [1, -1], "text": "end" }],
      "note": { "at": [0.5, 0], "text": "a note" }
    }
  }]
}`;

test('the sheets of a block are a sheet per tab, a sheet per events mark, and the axes', () => {
  const sheets = sheetsOf(LOOP);
  assert.deepEqual(sheets.map((s) => s.name), ['mu one', 'mu one: event', 'Axes']);
  const [tab, events, axes] = sheets;
  assert.deepEqual(tab.columns, ['Value', 'Time (s)', 'dot x', 'dot y', 'path x', 'path y', 'note x (all)', 'note y (all)', 'note text (all)']);
  assert.deepEqual(tab.rows.map((r) => r.map((c) => c?.text ?? null)), [
    ['0', '0', '0', '0', '0', '0', '0.5', '0', 'a note'],
    ['0.5', '0.4', '0.5', '0.5', '0.5', '1', null, null, null],
    ['1', '1', '1', '1', '1', '-1', null, null, null],
  ]);
  assert.deepEqual(events.rows.map((r) => r.map((c) => c?.text)), [["2", "1", "-1", "end"]]);
  assert.deepEqual(axes.rowNames, ['p']);
  assert.deepEqual(axes.rows[0].map((c) => c.text), ['0', '1', '-1', '1']);
  assert.equal(axes.arrays, null);
});

test('a cell is written as typed into its place, and every other byte is kept', () => {
  const [tab, events] = sheetsOf(LOOP);
  const dotY = tab.rows[1][3];
  const r = setCell(LOOP, dotY, '0.25');
  assert.equal(r.error, null);
  assert.equal(r.text, LOOP.replace('[0.5, 0.5]', '[0.5, 0.25]'));
  // a number is written as typed when it is JSON, and else in its shortest form
  assert.equal(literal(dotY, '1e-3'), '1e-3');
  assert.equal(literal(dotY, '.5'), '0.5');
  assert.equal(literal(dotY, '+2'), '2');
  assert.equal(literal(dotY, '−1'), '-1');
  assert.equal(literal(dotY, 'abc'), null);
  assert.equal(literal(dotY, ''), null);
  const text = setCell(LOOP, events.rows[0][3], 'the "end"');
  assert.equal(text.text, LOOP.replace('"text": "end"', '"text": "the \\"end\\""'));
});

test('a value that the theme cannot read is refused with the fault', () => {
  const [tab, , axes] = sheetsOf(LOOP);
  assert.equal(setCell(LOOP, tab.rows[0][2], 'abc').error, 'abc is not a number');
  assert.match(setCell(LOOP, axes.rows[0][0], '2').error, /panels\[0\]\.x\.range: the second end must be larger than the first/);
  assert.match(setCell(LOOP, tab.rows[1][1], '2').error, /times that increase from 0 are expected/);
  assert.equal(check(LOOP), null);
  assert.match(check(LOOP.slice(0, -2)), /offset/);
});

test('a row is added to every array of a sheet with the separator of its items, and deleted again', () => {
  const [tab, events] = sheetsOf(LOOP);
  const added = addRow(LOOP, tab, 1);
  assert.equal(added.error, null);
  let expected = LOOP.replace('[0, 0.5, 1]', '[0, 0.5, 0.75, 1]').replace('[0, 0.4, 1]', '[0, 0.4, 0.7, 1]');
  expected = expected.replace('[[0, 0], [0.5, 0.5], [1, 1]]', '[[0, 0], [0.5, 0.5], [0.5, 0.5], [1, 1]]');
  expected = expected.replace('[[0, 0], [0.5, 1], [1, -1]]', '[[0, 0], [0.5, 1], [0.5, 1], [1, -1]]');
  assert.equal(added.text, expected);
  // after the last row, a value is one step past the last
  assert.match(addRow(LOOP, tab, 2).text, /"values": \[0, 0\.5, 1, 1\.5\]/);
  const back = deleteRow(added.text, sheetsOf(added.text)[0], 2);
  assert.equal(back.text, LOOP);
  // the ghost of a trace is moved back from a frame that is deleted, and a sheet keeps one row
  const short = deleteRow(LOOP, tab, 2);
  assert.match(short.error ?? '', /event/);
  const noEvent = LOOP.replace('"frame": 2', '"frame": 0');
  const cut = deleteRow(noEvent, sheetsOf(noEvent)[0], 2);
  assert.equal(cut.error, null);
  assert.match(cut.text, /"ghost": 1/);
  const one = '{ "panels": [{ "id": "p", "x": { "range": [0, 1] }, "y": { "range": [0, 1] } }], "marks": [], "tabs": [{ "name": "a", "values": [0], "data": {} }] }';
  assert.match(deleteRow(one, sheetsOf(one)[0], 0).error, /must keep at least one row/);
  // the events of a mark are rows, which may all be deleted and added again
  const none = deleteRow(LOOP, events, 0);
  assert.equal(none.error, null);
  assert.match(none.text, /"event": \[\]/);
  assert.match(addRow(none.text, sheetsOf(none.text)[1], 0).text, /"event": \[\{ "frame": 0, "at": \[0, 0\], "text": "" \}\]/);
});

test('a block with CRLF line ends keeps them', () => {
  const crlf = LOOP.replace(/\n/g, '\r\n');
  const [tab] = sheetsOf(crlf);
  assert.equal(setCell(crlf, tab.rows[2][0], '2').text, crlf.replace('[0, 0.5, 1]', '[0, 0.5, 2]'));
  assert.equal(deleteRow(addRow(crlf, tab, 0).text, sheetsOf(addRow(crlf, tab, 0).text)[0], 1).text, crlf);
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

// the editor on a slide of a deck served over HTTP, where a save is written into the origin private
// file system, with the Format tab of the inspector shown
async function deckPage(platform, slide, deck = LAYOUTS) {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.send('Page.bringToFront');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
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

// the text rendered once it is the source with edits, e.g. after a command run by a key
async function until(page, edits) {
  let expected = page.source;
  for (const [a, b] of edits) expected = expected.replace(a, () => b);
  await page.waitFor(`window.BeesonEditor.render() === ${JSON.stringify(expected)}`).catch(() => {});
  await byteExact(page, edits);
}

// the edit checked byte for byte, then after an undo, which gives the file with the edits before,
// and again after a redo
async function roundTrip(page, edits, label, before = []) {
  await until(page, edits);
  await inScope(page);
  if (label) assert.equal((await state(page, 'edit.undo')).label, `Undo ${label}`);
  await undo(page);
  await byteExact(page, before);
  await redo(page);
  await byteExact(page, edits);
}

let saves = 0;
async function saved(page, edits) {
  const { text } = await saveAndReopen(page, `plot-${++saves}.html`);
  page.source = text;
  await byteExact(page);
  assert.ok(edits.every(([, b]) => text.includes(b)));
}

const shown = (page) => page.evaluate(`(() => { const w = document.querySelector(${JSON.stringify(WINDOW)}); return !!w && !w.hidden; })()`);
const cell = (r, c) => `${WINDOW} input[data-r="${r}"][data-c="${c}"]`;
const focusCell = (page, r, c) => page.evaluate(`(() => { const i = document.querySelector(${JSON.stringify(cell(r, c))}); i.focus(); i.select(); return true; })()`);
const grid = (page) => page.evaluate(`[...document.querySelectorAll('${WINDOW} tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.querySelector('input')?.value ?? null))`);
const status = (page) => page.evaluate(`(() => { const s = document.querySelector('${WINDOW} .state'); return { text: s.textContent, bad: s.classList.contains('bad') }; })()`);
const bad = (page) => page.evaluate(`document.querySelectorAll('${WINDOW} td.bad').length`);
const plotHtml = (page) => page.evaluate(`document.querySelector('.reveal section.present .plot .plot-body').innerHTML`);

const ONE = '{ "name": "one", "values": [0, 1], "data": { "dot": [[0, 0], [1, 1]], "path": [[0, 0], [1, 0]] } }';

// the data editor opened on the plot of the plate by its key
async function openData(page) {
  await click(page, '.reveal section.present .plot');
  assert.equal(await page.evaluate(`document.querySelector('${PANEL} .ed-panes').dataset.pane`), 'plot');
  assert.match(await page.evaluate(`document.querySelector('${PANEL}').textContent`), /The block plate-plot holds 2 tabs of 2, 2 frames over 2 panels\./);
  await press(page, 'Mod+Shift+D');
  await page.waitFor(`!!document.querySelector('${WINDOW}:not([hidden])')`);
}

for (const platform of PLATFORMS) {
  test(`Edit Plot Data opens the data editor by its key, and a cell is written to the block alone (${platform})`, async () => {
    const page = await deckPage(platform, PLOT_SLIDE);
    assert.deepEqual(await state(page, 'plot.editData'), { id: 'plot.editData', label: 'Edit Plot Data…', enabled: false, checked: null });
    await openData(page);
    assert.equal(await page.evaluate(`document.querySelector('${WINDOW} .title').textContent`), 'Plot Data of plate-plot');
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('${WINDOW} .sheets button')].map((b) => b.textContent)`), ['one', 'two', 'Axes']);
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('${WINDOW} thead th')].map((th) => th.textContent)`), ['', 't', 'dot x', 'dot y', 'path x', 'path y']);
    assert.deepEqual(await grid(page), [['0', '0', '0', '0', '0'], ['1', '1', '1', '1', '0']]);
    // the plot is drawn from the text typed, which is written once the cell is left
    const drawn = await plotHtml(page);
    await focusCell(page, 1, 1);
    await type(page, '0.5');
    await frames(page);
    assert.notEqual(await plotHtml(page), drawn);
    await byteExact(page);
    await press(page, 'Enter');
    const edit = [ONE, ONE.replace('[1, 1]]', '[0.5, 1]]')];
    await roundTrip(page, [edit], 'Edit Plot Data');
    assert.deepEqual(await grid(page), [['0', '0', '0', '0', '0'], ['1', '0.5', '1', '1', '0']]);
    // an undo is shown in the window and on the plot
    await undo(page);
    assert.deepEqual(await grid(page), [['0', '0', '0', '0', '0'], ['1', '1', '1', '1', '0']]);
    assert.equal(await plotHtml(page), drawn);
    await redo(page);
    // the menu item and the button of the Plot pane run the same command
    assert.equal((await page.evaluate(`[...document.querySelectorAll('${PANEL} button')].find((b) => b.textContent === 'Edit Plot Data…').dataset.command`)), 'plot.editData');
    await saved(page, [edit]);
    assert.deepEqual(errors(page), []);
  });

  test(`a value that cannot be read is shown in red and is not written (${platform})`, async () => {
    const page = await deckPage(platform, PLOT_SLIDE);
    await openData(page);
    await focusCell(page, 0, 1);
    await type(page, 'abc');
    assert.equal(await bad(page), 1);
    assert.deepEqual(await status(page), { text: 'abc is not a number', bad: true });
    await press(page, 'Enter');
    await frames(page);
    await byteExact(page);
    assert.equal(await bad(page), 1);
    // a range whose ends are reversed is refused by the format of a plot
    await click(page, `${WINDOW} .sheets button:nth-child(3)`);
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('${WINDOW} tbody th')].map((th) => th.textContent)`), ['left', 'right']);
    await focusCell(page, 0, 0);
    await type(page, '2');
    assert.match((await status(page)).text, /panels\[0\]\.x\.range: the second end must be larger than the first/);
    await press(page, 'Tab');
    await frames(page);
    await byteExact(page);
    assert.equal(await bad(page), 1);
    // the first Esc takes back the text typed, and the next one closes the window
    await focusCell(page, 0, 0);
    await press(page, 'Escape');
    assert.equal(await page.evaluate(`document.querySelector('${cell(0, 0)}').value`), '0');
    assert.equal(await bad(page), 0);
    await press(page, 'Escape');
    assert.equal(await shown(page), false);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`rows are added and deleted in every array of a sheet (${platform})`, async () => {
    const page = await deckPage(platform, PLOT_SLIDE);
    await openData(page);
    await focusCell(page, 0, 0);
    await click(page, `${WINDOW} button[data-command="plot.addRow"]`);
    const added = [ONE, '{ "name": "one", "values": [0, 0.5, 1], "data": { "dot": [[0, 0], [0, 0], [1, 1]], "path": [[0, 0], [0, 0], [1, 0]] } }'];
    await roundTrip(page, [added], 'Add Row');
    assert.equal((await grid(page)).length, 3);
    await focusCell(page, 1, 2);
    await click(page, `${WINDOW} button[data-command="plot.deleteRow"]`);
    await roundTrip(page, [], 'Delete Row', [added]);
    assert.equal((await grid(page)).length, 2);
    // the axes do not take rows
    await click(page, `${WINDOW} .sheets button:nth-child(3)`);
    assert.equal((await state(page, 'plot.addRow')).enabled, false);
    assert.equal(await page.evaluate(`document.querySelector('${WINDOW} button[data-command="plot.addRow"]').disabled`), true);
    await saved(page, []);
    assert.deepEqual(errors(page), []);
  });

  test(`a drag turns a surface without moving it, and Use Current View writes its camera (${platform})`, async () => {
    const page = await deckPage(platform, SURFACE_SLIDE);
    const camera = () => page.evaluate(`Beeson.surfaces.find((s) => document.querySelector('.reveal section.present').contains(s.el)).view()`);
    assert.deepEqual((await camera()).written, { azimuth: -60, elevation: 32, zoom: 1, turn: 90, zscale: 1 });
    await drag(page, '.reveal section.present .surface', { dx: 80, dy: 30 });
    await frames(page);
    const turned = await camera();
    assert.ok(Math.abs(turned.azimuth + 60) > 10, `the azimuth is ${turned.azimuth}`);
    assert.ok(turned.elevation > 32);
    await byteExact(page);
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} .ed-panes').dataset.pane`), 'surface');
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} input[name="azimuth"]').value`), '-60');
    await click(page, `${PANEL} button[data-command="surface.useView"]`);
    const az = Math.round(turned.azimuth), el = Math.round(turned.elevation);
    const tag = '<div class="surface" data-function="effective-potential" data-mu="0.05">';
    const edit = [tag, tag.replace('>', ` data-azimuth="${az}" data-elevation="${el}">`)];
    await roundTrip(page, [edit], 'Use Current View');
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} input[name="azimuth"]').value`), String(az));
    assert.equal(Math.round((await camera()).azimuth), az);
    // an undo puts the camera of the deck back
    await undo(page);
    await frames(page);
    assert.equal(Math.round((await camera()).azimuth), -60);
    await redo(page);
    // a field writes its attribute at Return, and Turn and Z Scale are written as numbers
    await click(page, `${PANEL} input[name="azimuth"]`);
    await page.evaluate(`document.querySelector('${PANEL} input[name="azimuth"]').select()`);
    await type(page, '200');
    await press(page, 'Enter');
    const field = [tag, tag.replace('>', ` data-azimuth="-160" data-elevation="${el}">`)];
    await roundTrip(page, [field], 'Surface Azimuth', [edit]);
    await exec(page, 'surface.zscale', { value: 0.5 });
    const scaled = [tag, tag.replace('>', ` data-azimuth="-160" data-elevation="${el}" data-zscale="0.5">`)];
    await roundTrip(page, [scaled], 'Surface Z Scale', [field]);
    assert.equal((await camera()).written.zscale, 0.5);
    // a right-click on the surface opens the menu of an element, with Use Current View
    const at = await center(page, '.reveal section.present .surface');
    await click(page, at, { button: 'right' });
    assert.ok(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu [role="menuitem"]')].some((i) => i.textContent.includes('Use Current View'))`));
    await press(page, 'Escape');
    await saved(page, [scaled]);
    assert.deepEqual(errors(page), []);
  });

  test(`a drag from the edge of a surface moves it (${platform})`, async () => {
    const page = await deckPage(platform, SURFACE_SLIDE);
    await click(page, '.reveal section.present .surface');
    const r = await page.evaluate(`(() => { const r = document.querySelector('.reveal section.present .surface').getBoundingClientRect(); return { left: r.left, top: r.top, height: r.height }; })()`);
    const before = await page.evaluate(`Beeson.surfaces.find((s) => document.querySelector('.reveal section.present').contains(s.el)).view().azimuth`);
    await drag(page, { x: r.left + 3, y: r.top + r.height / 2 }, { dx: -40 });
    await frames(page);
    const tag = '<div class="surface" data-function="effective-potential" data-mu="0.05">';
    const moved = (await render(page)).match(/<div class="surface" data-function="effective-potential" data-mu="0.05" style="translate: -(\d+)px 0px">/);
    assert.ok(moved && Number(moved[1]) > 20, 'the surface is not moved to the left');
    await roundTrip(page, [[tag, moved[0]]], 'Move');
    assert.equal(await page.evaluate(`Beeson.surfaces.find((s) => document.querySelector('.reveal section.present').contains(s.el)).view().azimuth`), before);
    assert.deepEqual(errors(page), []);
  });

  test(`Use Current View writes the camera to the surface of the next slide that shares it (${platform})`, async () => {
    const page = await deckPage(platform, 0, 'index.html');
    const first = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('.surface'))`);
    await page.evaluate(`Reveal.slide(${first})`);
    await frames(page);
    await drag(page, '.reveal section.present .surface', { dx: -60, dy: 20 });
    await frames(page);
    assert.match(await page.evaluate(`document.querySelector('${PANEL}').textContent`), new RegExp(`The surface on slide ${first + 2} has the same attributes`));
    const v = await page.evaluate(`Beeson.surfaces.find((s) => document.querySelector('.reveal section.present').contains(s.el)).view()`);
    await exec(page, 'surface.useView');
    const az = Math.round(v.azimuth), el = Math.round(v.elevation);
    const one = '<div class="surface" data-function="effective-potential" data-mu="0.05">';
    const two = '<div class="surface" data-function="effective-potential" data-mu="0.05" data-stage="sum">';
    const edits = [[one, one.replace('>', ` data-azimuth="${az}" data-elevation="${el}">`)], [two, two.replace('>', ` data-azimuth="${az}" data-elevation="${el}">`)]];
    await roundTrip(page, edits, 'Use Current View');
    // the surface of the next slide is shown under the camera written
    await page.evaluate(`Reveal.slide(${first + 1})`);
    await frames(page);
    const next = await page.evaluate(`Beeson.surfaces.find((s) => document.querySelector('.reveal section.present').contains(s.el)).view()`);
    assert.deepEqual([Math.round(next.azimuth), Math.round(next.elevation)], [az, el]);
    await saved(page, edits);
    assert.deepEqual(errors(page), []);
  });
}
