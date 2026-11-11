// regression tests of R11.3 on both platforms with trusted input: the scale and the axes of a
// panel in the Plot pane, a cleared number cell of the Plot Data window, the delete of a tab that a
// step names, the drag of a group row of the object list, and the keys of the Plot Data window.
// after each edit of the file the text is checked when rendered, byte for byte after an undo, again
// after a redo, and after a save and an open of the saved text

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { byteExact, center, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const GROUPS = 'test/pages/editor-r11-3.html';
const PLATFORMS = ['mac', 'other'];
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const PANEL = '#beeson-edit-panel-format';
const WINDOW = '.beeson-plotdata';
const PLOT_SLIDE = 8;

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
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

// the editor on slide n of deck, served over HTTP, with the storage of the browser cleared and the
// Format pane shown
async function load(t, platform, { deck = LAYOUTS, n = PLOT_SLIDE } = {}) {
  const page = await browser.newPage();
  t.after(() => page.close().catch(() => {}));
  await page.send('Page.bringToFront');
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear(); true');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(status.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${n})`);
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
  await page.waitFor(`window.BeesonEditor.render() === ${js(expected)}`).catch(() => {});
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
  const { text } = await saveAndReopen(page, `r11-3-${++saves}.html`);
  page.source = text;
  await byteExact(page);
}

// the JSON block of the plot of the plate of the layouts deck, edited by pairs of texts
const SOURCE = readFileSync(LAYOUTS, 'utf8');
const PLATE = SOURCE.slice(SOURCE.indexOf('id="plate-plot">{'), SOURCE.indexOf('}</script>', SOURCE.indexOf('id="plate-plot">{')));
const plate = (...pairs) => [[PLATE, pairs.reduce((t, [a, b]) => {
  assert.equal(t.split(a).length, 2, `${a} does not occur once in the plate`);
  return t.replace(a, () => b);
}, PLATE)]];
const LEFT = '{ "id": "left", "x": { "range": [0, 1] }, "y": { "range": [0, 1] } }';

const cell = (r, c) => `${WINDOW} input[data-r="${r}"][data-c="${c}"]`;
const focusCell = (page, r, c) => page.evaluate(`(() => { const i = document.querySelector(${js(cell(r, c))}); i.focus(); i.select(); return true; })()`);
const grid = (page) => page.evaluate(`[...document.querySelectorAll('${WINDOW} tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.querySelector('input')?.value ?? null))`);
const bad = (page) => page.evaluate(`[...document.querySelectorAll('${WINDOW} td.bad input')].map((i) => i.dataset.r + ',' + i.dataset.c)`);
const sheets = (page) => page.evaluate(`[...document.querySelectorAll('${WINDOW} .sheets button[role="tab"]')].map((b) => b.textContent)`);
const status = (page) => page.evaluate(`document.querySelector('${WINDOW} .state').textContent`);
const isOpen = (page) => page.evaluate(`!!document.querySelector('${WINDOW}:not([hidden])')`);

async function openData(page) {
  await click(page, '.reveal section.present .plot');
  await press(page, 'Mod+Shift+D');
  await page.waitFor(`!!document.querySelector('${WINDOW}:not([hidden])')`);
}

for (const platform of PLATFORMS) {
  // in Keynote, the scale of an axis is set in the Axis pane, and the axes are shown or hidden in
  // the Chart pane. in the format of a plot, the scale of an axis is linear or asinh with a unit,
  // and a panel is drawn without axes with "axes": false
  test(`the Plot pane sets the scale and the unit of an axis and hides the axes of a panel (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, '.reveal section.present .plot');
    await frames(page);
    const axes = () => page.evaluate(`document.querySelectorAll('.reveal section.present .plot .plot-axes').length`);
    assert.equal(await axes(), 2);
    await click(page, `${PANEL} [data-name="plot-0-x-scale"] button:nth-child(2)`);
    const asinh = [LEFT, LEFT.replace('"x": { "range": [0, 1] }', '"x": { "range": [0, 1], "scale": "asinh" }')];
    await roundTrip(page, plate(asinh), 'Axis Scale');
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} [data-name="plot-0-x-scale"] button:nth-child(2)').getAttribute('aria-pressed')`), 'true');
    await click(page, `${PANEL} input[name="plot-0-x-unit"]`);
    await page.evaluate(`document.querySelector('${PANEL} input[name="plot-0-x-unit"]').select()`);
    await type(page, '0.1');
    await press(page, 'Enter');
    const unit = [LEFT, LEFT.replace('"x": { "range": [0, 1] }', '"x": { "range": [0, 1], "scale": "asinh", "unit": 0.1 }')];
    await roundTrip(page, plate(unit), 'Axis Unit', plate(asinh));
    // a unit that is not positive is refused
    await page.evaluate(`document.querySelector('${PANEL} input[name="plot-0-x-unit"]').select()`);
    await type(page, '-1');
    await press(page, 'Enter');
    await frames(page);
    await byteExact(page, plate(unit));
    await click(page, `${PANEL} [data-name="plot-0-axes"]`);
    const hidden = [LEFT, LEFT.replace('"x": { "range": [0, 1] }', '"x": { "range": [0, 1], "scale": "asinh", "unit": 0.1 }').replace(' } }', ' }, "axes": false }')];
    await roundTrip(page, plate(hidden), 'Show Axes', plate(unit));
    assert.equal(await axes(), 1);
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} [data-name="plot-0-axes"] input').checked`), false);
    await click(page, `${PANEL} [data-name="plot-0-axes"]`);
    await roundTrip(page, plate(unit), 'Show Axes', plate(hidden));
    assert.equal(await axes(), 2);
    // Linear takes the scale out of the block
    await click(page, `${PANEL} [data-name="plot-0-x-scale"] button:nth-child(1)`);
    const linear = [LEFT, LEFT.replace('"x": { "range": [0, 1] }', '"x": { "range": [0, 1], "unit": 0.1 }')];
    await roundTrip(page, plate(linear), 'Axis Scale', plate(unit));
    await saved(page);
    assert.deepEqual(errors(page), []);
  });
}

for (const platform of PLATFORMS) {
  // a cleared range of numbers was written as 0, which draws a point at zero. parsePlot of
  // src/plot.ts refuses null and a frame of a trace without its point, hence an empty number cell
  // keeps its number and is shown as invalid, as a typed text that is not a number is
  test(`a range of numbers cleared with Delete keeps its numbers, marked invalid (${platform})`, async (t) => {
    const page = await load(t, platform);
    await openData(page);
    const before = await grid(page);
    await focusCell(page, 0, 1);
    await press(page, 'Shift+ArrowDown');
    await press(page, 'Shift+ArrowRight');
    await press(page, 'Delete');
    await frames(page);
    await byteExact(page);
    assert.equal((await state(page, 'edit.undo')).enabled, false);
    assert.deepEqual(await grid(page), before);
    assert.deepEqual(await bad(page), ['0,1', '0,2', '1,1', '1,2']);
    assert.match(await status(page), /cannot be left empty/);
    // a number typed into a cell marked invalid is written, and the mark is taken off
    await focusCell(page, 0, 1);
    await type(page, '0.5');
    await press(page, 'Enter');
    await roundTrip(page, plate(['"dot": [[0, 0], [1, 1]], "path": [[0, 0], [1, 0]]', '"dot": [[0.5, 0], [1, 1]], "path": [[0, 0], [1, 0]]']), 'Edit Plot Data');
    assert.deepEqual(await bad(page), ['0,2', '1,1', '1,2']);
    // a single cell emptied by Backspace is not written either
    await focusCell(page, 1, 3);
    await press(page, 'Backspace');
    await press(page, 'Enter');
    await frames(page);
    assert.ok((await bad(page)).includes('1,3'));
    assert.equal(await render(page), page.source.replace(PLATE, () => plate(['"dot": [[0, 0]', '"dot": [[0.5, 0]'])[0][1]));
    await saved(page);
    assert.deepEqual(errors(page), []);
  });
}

const CARD = 'dialog.beeson-edit-card[open]';
const STEP = '<span class="fragment" data-plot-tab="two"></span>';
const TAB_TWO = ',\n      { "name": "two", "values": [0, 1], "data": { "dot": [[1, 0], [0, 1]], "path": [[0, 0], [1, 1]] } }';

async function chooseSheet(page, name) {
  await click(page, await page.evaluate(`(() => { const r = [...document.querySelectorAll('${WINDOW} .sheets button[role="tab"]')].find((b) => b.textContent === ${js(name)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
}

for (const platform of PLATFORMS) {
  // a tab named by data-plot-tab of a step could not be deleted. Delete Tab now asks, naming the
  // step, and takes the attribute off the step in the same entry of the history
  test(`a tab that a step shows is deleted after a confirmation that names the step, with the step, as one entry (${platform})`, async (t) => {
    const page = await load(t, platform);
    await openData(page);
    await chooseSheet(page, 'two');
    await click(page, `${WINDOW} button[data-command="plot.deleteTab"]`);
    await page.waitFor(`!!document.querySelector('${CARD}')`);
    assert.match(await page.evaluate(`document.querySelector('${CARD}').textContent`), /step 2/);
    // Esc keeps the tab and the step
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('${CARD}')`);
    await byteExact(page);
    assert.deepEqual(await sheets(page), ['one', 'two', 'Axes']);
    await click(page, `${WINDOW} button[data-command="plot.deleteTab"]`);
    await page.waitFor(`!!document.querySelector('${CARD}')`);
    await click(page, `${CARD} button.primary`);
    await page.waitFor(`!document.querySelector('${CARD}')`);
    const deleted = [[STEP, '<span class="fragment"></span>'], ...plate([TAB_TWO, ''])];
    await roundTrip(page, deleted, 'Delete Tab');
    assert.deepEqual(await sheets(page), ['one', 'Axes']);
    assert.equal(await page.evaluate(`document.querySelector('.reveal section.present [data-plot-tab]')`), null);
    await saved(page);
    assert.deepEqual(errors(page), []);
  });
}

const OBJECTS = '.beeson-edit-objects';
const ROW = `${OBJECTS} .row`;
const LIST_KEY = { mac: 'Mod+Shift+L', other: 'Alt+F10' };
// the rows of the object list as level, name, and selection, e.g. '1 Group *'
const rows = (page) =>
  page.evaluate(`[...document.querySelectorAll(${js(ROW)})].map((r) => r.getAttribute('aria-level') + ' ' + r.querySelector('.name').textContent + (r.getAttribute('aria-selected') === 'true' ? ' *' : ''))`);
const rowBox = (page, n) =>
  page.evaluate(`(() => { const r = document.querySelectorAll(${js(ROW)})[${n}].getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2, top: r.top, bottom: r.bottom }; })()`);
const GROUPED = readFileSync(GROUPS, 'utf8');
const figure = (name) => {
  const end = GROUPED.indexOf(`<figcaption class="caption">${name}</figcaption>\n      </figure>`);
  return GROUPED.slice(GROUPED.lastIndexOf('      <figure', end), GROUPED.indexOf('</figure>', end) + '</figure>\n'.length);
};
// the deck of groups with its figures in the order of names, from back to front
const ordered = (...names) => {
  const first = GROUPED.indexOf(figure('A'));
  const last = GROUPED.indexOf(figure('C')) + figure('C').length;
  return GROUPED.slice(0, first) + names.map(figure).join('') + GROUPED.slice(last);
};

for (const platform of PLATFORMS) {
  // a group row could not be dragged. it now moves its members in the order of the layers as one
  // object, and they keep their order among themselves
  test(`a group row is dragged as one object, whose members keep their order, as one entry (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: GROUPS, n: 0 });
    await press(page, LIST_KEY[platform]);
    await frames(page);
    assert.deepEqual(await rows(page), ['1 Group', '2 Figure: C', '2 Figure: A', '1 Figure: B', '1 Text: A group around a figure']);
    // the group behind B: C passes B, and A stays behind C
    let from = await rowBox(page, 0);
    let to = await rowBox(page, 3);
    await drag(page, { x: from.x, y: from.y }, { dy: to.bottom - 2 - from.y, steps: 8 });
    await frames(page);
    assert.deepEqual(await rows(page), ['1 Figure: B', '1 Group *', '2 Figure: C *', '2 Figure: A *', '1 Text: A group around a figure']);
    const behind = ordered('A', 'C', 'B');
    assert.equal(await render(page), behind);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Reorder');
    // the group in front of B again: both members pass B, in their order
    from = await rowBox(page, 1);
    to = await rowBox(page, 0);
    await drag(page, { x: from.x, y: from.y }, { dy: to.top + 2 - from.y, steps: 8 });
    await frames(page);
    assert.deepEqual(await rows(page), ['1 Group *', '2 Figure: C *', '2 Figure: A *', '1 Figure: B', '1 Text: A group around a figure']);
    const front = ordered('B', 'A', 'C');
    assert.equal(await render(page), front);
    await undo(page);
    assert.equal(await render(page), behind);
    await undo(page);
    assert.equal(await render(page), page.source);
    await redo(page);
    assert.equal(await render(page), behind);
    await redo(page);
    assert.equal(await render(page), front);
    await saved(page);
    assert.deepEqual(errors(page), []);
  });
}

// the focused element as the cell r,c of the window, a control of the window by its command or
// label, 'outside', or 'body'
const where = (page) => page.evaluate(`(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return 'body';
  if (!a.closest('${WINDOW}')) return 'outside';
  if (a.dataset.r !== undefined) return 'cell ' + a.dataset.r + ',' + a.dataset.c;
  return a.dataset.command ?? a.getAttribute('aria-label') ?? a.textContent;
})()`);
// the shown and enabled controls of the window, named as where names them
const controls = (page) => page.evaluate(`[...document.querySelectorAll('${WINDOW} button:not(:disabled), ${WINDOW} input:not(:disabled)')].filter((e) => e.getClientRects().length).map((a) => a.dataset.r !== undefined ? 'cell ' + a.dataset.r + ',' + a.dataset.c : a.dataset.command ?? a.getAttribute('aria-label') ?? a.textContent)`);

for (const platform of PLATFORMS) {
  // the Plot Data window was not probed for the keys of a dialog by R9.7, the package of the dialogs
  test(`the Plot Data window opens on its first cell, keeps Tab and Shift+Tab inside, closes at Esc, and gives the keys back to the slide (${platform})`, async (t) => {
    const page = await load(t, platform);
    await openData(page);
    assert.equal(await where(page), 'cell 0,0');
    const all = await controls(page);
    for (const key of ['Tab', 'Shift+Tab']) {
      const seen = new Set();
      for (let i = 0; i < all.length + 2; i++) {
        await press(page, key);
        const at = await where(page);
        assert.ok(at !== 'outside' && at !== 'body', `${key} ${i + 1} leaves the window`);
        seen.add(at);
      }
      assert.deepEqual(all.filter((c) => !seen.has(c)), [], `${key} does not reach every control`);
    }
    // the first Esc leaves a cell that is being edited, without a write, and the second one closes
    await focusCell(page, 1, 1);
    await type(page, '7');
    await press(page, 'Escape');
    assert.equal(await isOpen(page), true);
    assert.deepEqual((await grid(page))[1].slice(0, 2), ['1', '1']);
    await press(page, 'Escape');
    assert.equal(await isOpen(page), false);
    await byteExact(page);
    // the focus is given back to the slide, where the keys of the editor act on the plot
    assert.equal(await where(page), 'body');
    assert.deepEqual(await page.evaluate(`window.BeesonEditor.selection().map((el) => el.dataset.plot)`), ['plate-plot']);
    await press(page, 'Mod+Shift+D');
    await page.waitFor(`!!document.querySelector('${WINDOW}:not([hidden])')`);
    assert.equal(await where(page), 'cell 0,0');
    // Esc on a button of the window closes it as well
    await click(page, `${WINDOW} .sheets button[role="tab"]`);
    await focusCell(page, 0, 0);
    await press(page, 'Shift+Tab');
    assert.doesNotMatch(await where(page), /^cell/);
    await press(page, 'Escape');
    assert.equal(await isOpen(page), false);
    assert.equal(await where(page), 'body');
    assert.deepEqual(errors(page), []);
  });
}
