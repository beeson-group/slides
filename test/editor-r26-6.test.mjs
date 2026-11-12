// tests of R26.6 on both platforms with trusted input: the place of a new table on a slide without
// a free place, at the middle of the slide inside its margins with a second table beside the first
// (finding 64 of glm)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'index.html';
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
