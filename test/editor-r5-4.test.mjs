// regression tests of tables, media, and locked elements, on either platform with trusted input:
// a table inserted under the list of a full slide, the width of the Table pane, the text of merged
// cells, the controls of a locked element, and Capture Poster on a video of a deck opened from a
// file. after each edit the text is in the scope rule, an undo gives the file byte for byte, a
// redo gives the edit, and a save is opened again without problems

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen } from './helpers/editor.mjs';

const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const PANEL = '#beeson-edit-panel-format';
// the index of the slide "Figures are first class citizens, too" of index.html, whose list ends
// above the bottom of its figure
const FIGURES = 4;

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
const js = (v) => JSON.stringify(v);
const settle = (page) => page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(window.BeesonEditor.status()))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

// the editor on a deck served over HTTP, with the Format tab shown, in a window of size
async function open(platform, { deck = 'index.html', size } = {}) {
  const page = await browser.newPage(size);
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(status.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  return page;
}

async function show(page, h) {
  await page.evaluate(`Reveal.slide(${h})`);
  await sleep(150);
  await settle(page);
}

// the box of the first shown element of selector in CSS px of the viewport, or null
const boxOf = (page, selector) => page.evaluate(`(() => {
  const el = [...document.querySelectorAll(${js(selector)})].find((e) => e.getClientRects().length);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
})()`);

// the box of the text of the element of selector, without the white space of its box
const inkOf = (page, selector) => page.evaluate(`(() => {
  const range = document.createRange();
  range.selectNodeContents(document.querySelector(${js(selector)}));
  const r = range.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
})()`);

const inside = (a, b, what) => {
  const slack = 0.5;
  assert.ok(a.left >= b.left - slack && a.top >= b.top - slack && a.right <= b.right + slack && a.bottom <= b.bottom + slack, `${what}: ${js(a)} is not inside ${js(b)}`);
};
const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

let saves = 0;
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the edit did not change the text');
  const added = textProblems(edited, THEME);
  for (const p of textProblems(page.source, THEME)) if (added.includes(p)) added.splice(added.indexOf(p), 1);
  assert.deepEqual(added, [], 'the edit is out of the scope rule');
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  assert.equal((await settle(page)).undo, false, `the edit is more than ${undos} entries of the history`);
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r5-4-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  return edited;
}

// the window of the pictures of round 2 on the Mac, and a window of 1920 by 1080 elsewhere
const SIZES = { mac: { width: 1600, height: 1000 }, other: { width: 1920, height: 1080 } };

// state table-inserted of round 2: the table was put into the flow under the list, which its
// translate moves down, hence the bar of the columns covered the last line of the list, and the
// rows and the button Add Row ran past the bottom of the slide
for (const platform of ['mac', 'other']) {
  test(`a table inserted under the list of a full slide is put in its free space, with its controls in the canvas (${platform})`, async (t) => {
    const page = await open(platform, { size: SIZES[platform] });
    t.after(() => page.close?.());
    await show(page, FIGURES);
    const li = '.reveal section.present ul > li:last-child';
    await click(page, li);
    await press(page, 'Escape');
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await sleep(100);
    await settle(page);
    const slide = await boxOf(page, '.reveal section.present');
    const stage = await boxOf(page, '.beeson-edit-canvas');
    const table = await boxOf(page, '.reveal section.present table');
    const ink = await inkOf(page, li);
    const cols = await boxOf(page, '.beeson-table-bars .bar.cols');
    const figure = await boxOf(page, '.reveal section.present figure.zone');
    assert.ok(cols.top >= ink.bottom - 0.5, `the bar of the columns at ${cols.top} covers the list, whose text ends at ${ink.bottom}`);
    assert.ok(!meets(table, figure), 'the table covers the figure');
    inside(table, slide, 'the table');
    for (const name of ['Add Row', 'Add Column', 'Select Table']) inside(await boxOf(page, `.beeson-table-bars .round[title="${name}"]`), stage, name);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Insert Table');
    const edited = await roundTrip(page);
    assert.match(edited, /<table style="translate: 0px \d+px">/);
  });
}
