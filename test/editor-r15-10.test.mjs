// the place of a new table of R15.10, on both platforms. with a free place, the table is put there,
// inside the margins of the slide. without one, it is put at the center of the slide, or at the
// place nearest to the center that is off every figure, video, plot, QR code, and table.
// each insert is checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { saveAndReopen } from './helpers/editor.mjs';

const DECK = 'index.html';
const LAYOUTS = 'test/pages/editor-layouts.html';
// slide 5 of index.html, with a figure in its zone and without a free place, and the figure slide
// of editor-layouts.html with a video in its plate
const FIGURES = 4;
const VIDEO = 7;
const PLATFORMS = ['mac', 'other'];
// the margin of the layouts at the left and the right of a slide, in slide px
const MARGIN = 120;

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
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

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
const meets = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
// a box as its left, top, width, and height, rounded to slide px
const round = (b) => [b.left, b.top, b.right - b.left, b.bottom - b.top].map(Math.round);
const inside = (b) => b.left >= MARGIN - 1 && b.right <= 1920 - MARGIN + 1 && b.top >= -1 && b.bottom <= 1081;

async function load(t, platform, n, deck = DECK) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

const insertTable = async (page) => {
  await exec(page, 'insert.table', { rows: 3, columns: 3 });
  await frames(page);
};

// the rendered text differs from before, an undo gives before and a redo the edited text byte for
// byte, and the saved text is opened again without problems
async function checkEdit(page, before, name) {
  const edited = await render(page);
  assert.notEqual(edited, before);
  await undo(page);
  assert.equal(await render(page), before);
  await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, name);
  assert.equal(text, edited);
}

for (const platform of PLATFORMS) {
  // probe 13 and requirement 3 of the juror of round 6. slide 5 does not have a free place for a
  // table of 3 by 3, which was put at 48, 808, left of the margin and over the last list item
  test(`a new table on slide 5 is put inside the margins at the middle of the slide, off the figure, and a second table off the first (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    const before = await render(page);
    const [figure] = await boxes(page, ':scope > figure.zone');
    assert.ok(figure, 'slide 5 does not have a figure in its zone');
    await insertTable(page);
    const [table] = await boxes(page, ':scope > table');
    assert.ok(table, 'no table was inserted');
    assert.ok(inside(table), `the table at ${js(round(table))} is not inside the margins of the slide`);
    assert.ok(!meets(table, figure), `the table at ${js(round(table))} lies over the figure at ${js(round(figure))}`);
    assert.ok(Math.abs((table.top + table.bottom) / 2 - 540) <= 1, `the table at ${js(round(table))} is not at the middle of the slide`);
    // the place nearest to the center of the slide that keeps the room of the bars of the table to
    // the figure, 48 slide px at every size of the window
    assert.deepEqual(round(table), [654, 433, 498, 213]);
    await checkEdit(page, before, `r15-10-table-${platform}.html`);
    await insertTable(page);
    const tables = await boxes(page, ':scope > table');
    assert.equal(tables.length, 2);
    assert.ok(inside(tables[1]), `the second table at ${js(round(tables[1]))} is not inside the margins`);
    assert.ok(!meets(tables[1], tables[0]), `the second table at ${js(round(tables[1]))} lies over the first at ${js(round(tables[0]))}`);
    assert.ok(!meets(tables[1], figure), `the second table at ${js(round(tables[1]))} lies over the figure`);
    assert.deepEqual(errors(page), []);
  });

  // a table keeps its free place under the code box of slide 6 and at the center of the free zone
  // of slide 4
  test(`a new table on a slide with a free place is put there as before (${platform})`, async (t) => {
    for (const [n, place] of [[5, [120, 715, 498, 213]], [3, [1251, 414, 498, 213]]]) {
      const page = await load(t, platform, n);
      const before = await render(page);
      await insertTable(page);
      const [table] = await boxes(page, ':scope > table');
      assert.ok(table, 'no table was inserted');
      assert.deepEqual(round(table), place, `the table on slide ${n + 1} moved from its free place`);
      await checkEdit(page, before, `r15-10-free-${n}-${platform}.html`);
      assert.deepEqual(errors(page), []);
    }
  });

  // gap 7 of the juror of round 6, from state 426. a new table on the figure slide with a video was
  // put at 1368, 811, over 19 px of the box of the video
  test(`a new table on the figure slide with a video does not cover the video (${platform})`, async (t) => {
    const page = await load(t, platform, VIDEO, LAYOUTS);
    const before = await render(page);
    const [video] = await boxes(page, '.plate > video');
    assert.ok(video, 'the figure slide does not have a video');
    await insertTable(page);
    const [table] = await boxes(page, ':scope > table');
    assert.ok(table, 'no table was inserted');
    assert.ok(!meets(table, video), `the table at ${js(round(table))} lies over the video at ${js(round(video))}`);
    assert.ok(inside(table), `the table at ${js(round(table))} is not inside the margins of the slide`);
    const number = await page.evaluate(`(() => {
      const n = document.querySelector('.reveal .slide-number');
      const slide = document.querySelector('.reveal .slides > section.present');
      const s = slide.getBoundingClientRect(), k = s.width / slide.offsetWidth, r = n?.getBoundingClientRect();
      return r && r.width ? { left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k } : null;
    })()`);
    if (number) assert.ok(!meets(table, number), `the table at ${js(round(table))} lies over the slide number at ${js(round(number))}`);
    await checkEdit(page, before, `r15-10-video-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });
}
