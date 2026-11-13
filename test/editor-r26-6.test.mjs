// tests of R26.6 on both platforms with trusted input: the place of a new table on a slide without
// a free place, at the middle of the slide inside its margins with a second table beside the first
// (finding 64 of glm), and Distribute Rows Evenly in the cell menu, the Table pane, and Format >
// Table (a finding of gemini)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, saveAndReopen } from './helpers/editor.mjs';
import { declarationProblem } from '../src/editor/model/scope.ts';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test-deck.html';
// a table with a cell of two lines, and a table with a row drawn higher than its words
const ROWS = 'test/pages/editor-r26-6.html';
const HEIGHTS = 'test/pages/editor-r26-6-heights.html';
const PANEL = '#beeson-edit-panel-format';
// slide 5 of index.html, with a figure in its zone and without a free place for a table of 3 by 3
const FIGURES = 4;
// the margin of the layouts at the left and the right of a slide, and the room of the bars of a
// table at every size of the window, in slide px
const MARGIN = 120;
const ROOM = 48;

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
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const title = (page) => page.evaluate(`document.querySelector('.beeson-edit-menubar .state, .beeson-edit-header .state')?.textContent ?? null`);
const meets = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
// the gap in slide px between two boxes that do not meet, along the axis on which they are apart
const gap = (a, b) => Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
const round = (b) => [b.left, b.top, b.right - b.left, b.bottom - b.top].map(Math.round);
const inside = (b) => b.left >= MARGIN - 1 && b.right <= 1920 - MARGIN + 1 && b.top >= -1 && b.bottom <= 1081;

// the editor on slide n of deck, with the storage of the origin emptied
async function load(t, platform, deck = DECK, n = 0) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  await sleep(150);
  return page;
}

// the box in slide px of each shown element of selector on the current slide
const boxes = (page, selector) => page.evaluate(`(() => {
  const slide = document.querySelector('.reveal .slides > section.present');
  const s = slide.getBoundingClientRect();
  const k = s.width / slide.offsetWidth;
  return [...slide.querySelectorAll(${js(selector)})].filter((e) => e.getClientRects().length).map((e) => {
    const r = e.getBoundingClientRect();
    return { left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k };
  });
})()`);

// finding 64 of glm: on the full slide 5 a new table was put at 702, 843, at the lower right over
// the last list item, where the juror of round 6 ruled the middle of the slide
for (const platform of PLATFORMS) {
  test(`a new table on a slide without a free place is put at the middle of the slide inside the margins, and a second table beside the first (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, FIGURES);
    const base = await render(page);
    const [figure] = await boxes(page, ':scope > figure.zone');
    assert.ok(figure, 'slide 5 does not have a figure in its zone');
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await sleep(300);
    const [table] = await boxes(page, ':scope > table');
    assert.ok(table, 'no table was inserted');
    assert.ok(inside(table), `the table at ${js(round(table))} is not inside the margins of the slide`);
    assert.ok(Math.abs((table.top + table.bottom) / 2 - 540) <= 1, `the table at ${js(round(table))} is not at the middle of the slide`);
    assert.ok(!meets(table, figure), `the table at ${js(round(table))} lies over the figure at ${js(round(figure))}`);
    // the place nearest to the center of the slide that keeps the room of the bars to the figure
    assert.deepEqual(round(table), [654, 433, 498, 213]);
    // the report of the title bar is kept
    assert.match(await title(page), /A table covers \d+ texts?$/);
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await sleep(300);
    const tables = await boxes(page, ':scope > table');
    assert.equal(tables.length, 2);
    assert.ok(inside(tables[1]), `the second table at ${js(round(tables[1]))} is not inside the margins`);
    assert.ok(!meets(tables[1], tables[0]), `the second table at ${js(round(tables[1]))} lies over the first at ${js(round(tables[0]))}`);
    assert.ok(gap(tables[0], tables[1]) >= ROOM - 1, `the second table at ${js(round(tables[1]))} does not keep the room of the bars to the first at ${js(round(tables[0]))}`);
    assert.ok(!meets(tables[1], figure), `the second table at ${js(round(tables[1]))} lies over the figure`);
    const edited = await render(page);
    await undo(page);
    await undo(page);
    assert.equal(await render(page), base);
    await redo(page);
    await redo(page);
    assert.equal(await render(page), edited);
    const { text } = await saveAndReopen(page, `r26-6-tables-${platform}.html`);
    assert.equal(text, edited);
    assert.deepEqual(errors(page), []);
  });
}

// the heights in slide px of the rows of the table of the current slide, and of the table
const heights = (page) => page.evaluate(`(() => {
  const slides = document.querySelector('.reveal .slides');
  const k = slides.getBoundingClientRect().width / slides.offsetWidth;
  const table = Reveal.getCurrentSlide().querySelector('table');
  return { rows: [...table.rows].map((r) => r.getBoundingClientRect().height / k), table: table.getBoundingClientRect().height / k };
})()`);
const cell = (r, c) => `.reveal section.present table tr:nth-child(${r + 1}) > :nth-child(${c + 1})`;
const near = (a, b, what, tolerance = 1) => assert.ok(Math.abs(a - b) <= tolerance, `${what} is ${a} and not ${b}`);
// the heights written in the style of each row of the rendered text, or null
const written = (text) => [...text.matchAll(/<tr( style="[^"]*")?>/g)].map((m) => (m[1] ? Number(/height: (\d+)px/.exec(m[1])?.[1] ?? NaN) : null));

// an undo gives the text of the file, a redo the edit, and a save is opened again without problems
async function roundTrip(page, name) {
  const edited = await render(page);
  assert.notEqual(edited, page.source);
  assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Distribute Rows Evenly');
  await undo(page);
  assert.equal(await render(page), page.source);
  await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, name);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
}

test('the height of a row is in the scope rule in px', () => {
  assert.equal(declarationProblem('tr', [], 'height', '120px'), null);
  assert.match(declarationProblem('tr', [], 'height', '40%'), /height 40% on a tr/);
  assert.match(declarationProblem('td', [], 'height', '120px'), /height/);
});

for (const platform of PLATFORMS) {
  // a finding of gemini: the cell menu had Distribute Columns Evenly and not Distribute Rows Evenly
  test(`Distribute Rows Evenly of the cell menu gives every row the same height and keeps the height of the table (${platform})`, async (t) => {
    const page = await load(t, platform, HEIGHTS);
    const before = await heights(page);
    await click(page, cell(2, 1));
    await click(page, cell(2, 1), { button: 'right' });
    await page.waitFor(`!!document.querySelector('.beeson-edit-menu.cell')`);
    const labels = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu.cell .item .label')].map((l) => l.textContent)`);
    const i = labels.indexOf('Distribute Rows Evenly');
    assert.ok(i >= 0, `Distribute Rows Evenly is not in the menu: ${labels.join(', ')}`);
    assert.equal(labels[i + 1], 'Distribute Columns Evenly');
    const item = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-menu.cell .item')].find((b) => b.querySelector('.label').textContent === 'Distribute Rows Evenly'); const r = b.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
    await click(page, item);
    await sleep(200);
    await frames(page);
    const after = await heights(page);
    const each = before.table / before.rows.length;
    for (const [n, h] of after.rows.entries()) near(h, each, `the row ${n + 1}`, 1.5);
    near(after.table, before.table, 'the table', 2);
    assert.ok(written(await render(page)).every((h) => h !== null), 'a row does not have a written height');
    await roundTrip(page, `r26-6-menu-${platform}.html`);
  });

  test(`Distribute Rows Evenly of the Table pane gives every row the height of the row of two lines (${platform})`, async (t) => {
    const page = await load(t, platform, ROWS);
    if (!(await page.evaluate(`window.BeesonEditor.state('shell.format').checked`))) await exec(page, 'shell.format');
    const before = await heights(page);
    await click(page, cell(1, 0));
    await sleep(150);
    await frames(page);
    const button = await page.evaluate(`(() => { const b = document.querySelector('${PANEL} button[title^="Distribute Rows Evenly"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    assert.ok(button, 'the Table pane does not have Distribute Rows Evenly');
    await click(page, button);
    await sleep(200);
    await frames(page);
    const after = await heights(page);
    // a row is not drawn lower than its words, hence each row is as high as the row of two lines
    const high = Math.max(...before.rows);
    for (const [n, h] of after.rows.entries()) near(h, high, `the row ${n + 1}`, 1.5);
    await roundTrip(page, `r26-6-pane-${platform}.html`);
  });

  test(`Distribute Rows Evenly of Format > Table in a range of two rows keeps the other rows (${platform})`, async (t) => {
    const page = await load(t, platform, HEIGHTS);
    const items = await page.evaluate(`window.BeesonEditorShell.menuItems('Format', 'Table').map((i) => i.command ?? i.label ?? '|')`);
    assert.equal(items[items.indexOf('table.distributeColumns') - 1], 'table.distributeRows', items.join(' '));
    const before = await heights(page);
    const center = (sel) => page.evaluate(`(() => { const r = document.querySelector(${js(sel)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const from = await center(cell(1, 0));
    const to = await center(cell(2, 1));
    await drag(page, from, { dx: to.x - from.x, dy: to.y - from.y });
    await sleep(150);
    await exec(page, 'table.distributeRows');
    await sleep(200);
    await frames(page);
    const after = await heights(page);
    const each = (before.rows[1] + before.rows[2]) / 2;
    near(after.rows[1], each, 'the row 2', 1.5);
    near(after.rows[2], each, 'the row 3', 1.5);
    near(after.rows[0], before.rows[0], 'the row 1');
    near(after.rows[3], before.rows[3], 'the row 4');
    assert.deepEqual(written(await render(page)).map((h) => h !== null), [false, true, true, false]);
    await roundTrip(page, `r26-6-range-${platform}.html`);
  });
}
