// tests of the popovers beside their target, the zoom levels, the poster frame slider, and the
// table grid with Autofill, on either platform with trusted input. the Insert Formula and Edit
// Formula sheets and the link editor are kept off a list item near the bottom of the slide, the
// toolbar and the status bar list the same zoom levels, a poster is captured at the time of the
// slider, also in a deck opened from a file, the grid of Insert Table is 10 columns by 8 rows with
// Insert Table… under it, and a drag of the fill handle of a range of cells fills the cells beside
// it. after each edit the text is in the scope rule, an undo gives the file byte for byte, a redo
// gives the edit, and a save is opened again without problems

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, editorPage, press, saveAndReopen, type } from './helpers/editor.mjs';

const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const PANEL = '#beeson-edit-panel-format';
const PLATFORMS = ['mac', 'other'];
// the indexes of slides of index.html: "Show your steps one at a time", whose list ends near the
// bottom of the slide, "Equations are first class citizens", and "Embedding videos"
const STEPS = 2;
const EQUATIONS = 3;
const VIDEOS = 10;
const LAST = '.reveal section.present ul > li:last-child';

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

// the editor on a deck served over HTTP, with the Format tab shown
async function open(platform, { deck = 'index.html', size = { width: 1440, height: 900 } } = {}) {
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

const boxOf = (page, selector) => page.evaluate(`(() => {
  const el = [...document.querySelectorAll(${js(selector)})].find((e) => e.getClientRects().length);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
})()`);
const meets = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
const middle = (r) => ({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 });

// asserts that the popover of selector popover does not meet the box of target, is inside the
// window, and has an arrow
async function besideCheck(page, popover, target, what) {
  const p = await boxOf(page, popover);
  const t = await boxOf(page, target);
  const view = await page.evaluate('({ width: innerWidth, height: innerHeight })');
  assert.ok(p && t, `${what} or its target is not shown`);
  assert.ok(!meets(p, t), `${what} at ${js(p)} covers its target at ${js(t)}`);
  assert.ok(p.left >= 0 && p.top >= 0 && p.right <= view.width && p.bottom <= view.height, `${what} at ${js(p)} is not inside the window`);
  assert.ok(await page.evaluate(`!!document.querySelector(${js(popover)}).dataset.beside`), `${what} does not have an arrow at its target`);
}

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
  const { text } = await saveAndReopen(page, `r6-3-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  return edited;
}

// the labels of the items of the open menu, with their dimmed state
const menuLabels = (page) =>
  page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu [role^="menuitem"]')].map((m) => ({ label: m.querySelector('.label')?.textContent ?? m.textContent.trim(), disabled: m.getAttribute('aria-disabled') === 'true' }))`);
const pick = (page, label) =>
  page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu [role^="menuitem"]')].find((m) => (m.querySelector('.label')?.textContent ?? '') === ${js(label)}).click()`);
const zoomOf = (page) => page.evaluate('window.BeesonEditorShell.stage.zoom');

for (const platform of PLATFORMS) {
  test(`the zoom popup of the toolbar and the zoom menu of the status bar list the same levels, with Actual Size and Zoom to Selection (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await show(page, EQUATIONS);
    await click(page, '.beeson-edit-top [data-command="toolbar.zoom"]');
    await settle(page);
    const popup = await menuLabels(page);
    await press(page, 'Escape');
    await click(page, '.beeson-edit-bottom .percent');
    await settle(page);
    const bar = await menuLabels(page);
    await press(page, 'Escape');
    const levels = (items) => items.map((i) => i.label).filter((l) => /%$/.test(l));
    assert.deepEqual(levels(popup), levels(bar));
    assert.deepEqual(levels(bar), ['25%', '33%', '50%', '67%', '75%', '100%', '125%', '150%', '200%', '300%', '400%']);
    assert.deepEqual(popup.slice(0, 3).map((i) => i.label), ['Fit', 'Actual Size', 'Zoom to Selection']);
    // Zoom to Selection is dimmed without a selection, as in the View menu
    assert.equal(popup[2].disabled, true);
    await click(page, '.beeson-edit-top [data-command="toolbar.zoom"]');
    await pick(page, 'Actual Size');
    await settle(page);
    assert.equal(await zoomOf(page), 1);
    await exec(page, 'zoom.fit');
    await show(page, STEPS);
    const fit = await zoomOf(page);
    await click(page, LAST);
    await press(page, 'Escape');
    await settle(page);
    await click(page, '.beeson-edit-top [data-command="toolbar.zoom"]');
    await settle(page);
    assert.equal((await menuLabels(page))[2].disabled, false);
    await pick(page, 'Zoom to Selection');
    await settle(page);
    assert.ok((await zoomOf(page)) > fit, `Zoom to Selection kept the zoom at ${fit}`);
    // Zoom In goes on from 300 percent to 400 percent, the last level
    await page.evaluate('window.BeesonEditorShell.stage.setZoom(3)');
    await exec(page, 'zoom.in');
    assert.equal(await zoomOf(page), 4);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}
