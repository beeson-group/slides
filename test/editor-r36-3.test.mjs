// tests of R36.3 on both platforms, a turn of a line with a glued end. as a connection line of
// Keynote, a line glued at one end or at both is not turned: while every selected element is such a
// line, the field Angle of the Arrange pane, the quarter turns, and Reset Rotation are dimmed and do
// nothing, and the field reads "Detach the line to turn it". once each end is detached in the
// section Connections of the Line pane, the line is turned by the field, and a selection with
// another element is turned as it was without this rule

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
// slide 0 holds a curved arrow glued from a1 to a2, i.e. the two rounded rectangles, and a loose
// line under them, and slide 1 the same arrow turned by 20 degrees in the file
const DECK = 'test/pages/editor-r36-3.html';
const SOURCE = readFileSync(DECK, 'utf8');
const [GLUED, TURNED] = [0, 1];
const SLIDE = '.reveal .slides > section.present';
const PANEL = '#beeson-edit-panel-format';
const ANGLE = '#beeson-edit-num-angle';
const WHY = 'Detach the line to turn it';
const TURNS = ['arrange.setRotation', 'arrange.resetRotation', 'arrange.rotateLeft', 'arrange.rotateRight'];

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
const sleep = (ms) => new Promise((d) => setTimeout(d, ms));
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}, ${js(arg ?? null)} ?? undefined)).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const call = (page, fn, ...args) => page.evaluate(`(${fn})(${args.map(js).join(', ')})`);

async function load(t, platform, slide = GLUED) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${DECK}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(SOURCE)})`)).problems, []);
  await page.evaluate(`Reveal.slide(${slide})`);
  await sleep(150);
  return page;
}

// the point on the screen of a point in slide px
function screenOf(p) {
  const s = document.querySelector('.reveal .slides');
  const r = s.getBoundingClientRect();
  const k = r.width / s.offsetWidth;
  return { x: r.left + p.x * k, y: r.top + p.y * k };
}
const screen = (page, x, y) => call(page, screenOf, { x, y });
// points in slide px on the glued arrow at its middle and at a quarter of its length, away from the
// grip of its bend, on the loose line, and on the box a1
const ON_ARROW = [853, 454];
const ON_QUARTER = [686, 475];
const ON_LOOSE = [900, 950];
const ON_BOX = [399, 500];

// the glue and the angle of each line of the slide
const lines = (page) => page.evaluate(`[...document.querySelector(${js(SLIDE)}).querySelectorAll('svg.line')].map((svg) => ({ from: svg.getAttribute('data-from'), to: svg.getAttribute('data-to'), rotate: svg.style.rotate }))`);

// a click on the first point and a click with Shift on each other point
async function select(page, ...points) {
  for (const [i, [x, y]] of points.entries()) await click(page, await screen(page, x, y), { modifiers: i ? 'Shift' : '' });
  await frames(page);
  await sleep(100);
  assert.equal((await page.evaluate('window.BeesonEditor.selection()')).length, points.length);
}

// the pane of a name, through its tab where the selection has more than one pane
async function showTab(page, name) {
  await page.evaluate(`[...document.querySelectorAll('.ed-tabs button')].find((b) => b.textContent.trim() === ${js(name)})?.click()`);
  await frames(page);
}
async function arrangeTab(page) {
  await showTab(page, 'Arrange');
  await page.waitFor(`document.querySelector(${js(ANGLE)}) !== null`);
}

// the field Angle: whether its input is disabled and its control dimmed, its title, and its value
const angleField = (page) => page.evaluate(`(() => {
  const input = document.querySelector(${js(ANGLE)});
  const box = input.closest('.ed-num');
  return { disabled: input.disabled, dimmed: box.classList.contains('off'), title: box.title, value: input.value };
})()`);

// an angle typed into the field and entered with Tab
async function typeAngle(page, deg) {
  await click(page, ANGLE);
  await page.evaluate(`document.querySelector(${js(ANGLE)}).select()`);
  await type(page, String(deg));
  await press(page, 'Tab');
  await sleep(150);
}

// the quarter turns in the menu of the element at x, y in slide px, each with whether it is dimmed
async function menuTurns(page, x, y) {
  await click(page, await screen(page, x, y), { button: 'right' });
  await sleep(100);
  const items = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => [i.querySelector('.label')?.textContent ?? i.textContent.trim(), i.getAttribute('aria-disabled') === 'true'])`);
  await page.evaluate('window.BeesonEditorShell.closeMenus()');
  return Object.fromEntries(items.filter(([label]) => /^Rotate (Left|Right) 90°$/.test(label)));
}

// every turn of the selected glued line refused: the commands, the field with its reason, and the
// items of the menu of the line at the point at dimmed, no handle of a turn shown, and the file
// untouched after each command and after a typed angle, without an entry of the history. the Tab
// after the typed angle reaches the canvas, which selects the next object
async function refused(page, at = ON_QUARTER) {
  for (const id of TURNS) assert.equal((await state(page, id)).enabled, false, `${id} is enabled on a glued line`);
  const field = await angleField(page);
  assert.equal(field.disabled, true, 'the field Angle is not dimmed on a glued line');
  assert.equal(field.dimmed, true, 'the control of the field Angle is not dimmed');
  assert.equal(field.title, WHY, 'the field Angle does not give the reason');
  if (at) assert.deepEqual(await menuTurns(page, ...at), { 'Rotate Left 90°': true, 'Rotate Right 90°': true }, 'a quarter turn of the menu of the line is not dimmed');
  assert.equal(await page.evaluate(`[...document.querySelectorAll('.beeson-rotor')].some((r) => r.getClientRects().length > 0)`), false, 'a handle of a turn is shown on a glued line');
  const before = await render(page);
  const undoable = (await state(page, 'edit.undo')).enabled;
  for (const id of TURNS) {
    await exec(page, id, id === 'arrange.setRotation' ? { deg: 30 } : undefined);
    await sleep(50);
    assert.equal(await render(page), before, `${id} changed the file of a glued line`);
  }
  await typeAngle(page, 30);
  assert.equal(await render(page), before, 'a typed angle changed the file of a glued line');
  assert.equal((await state(page, 'edit.undo')).enabled, undoable, 'a refused turn made an entry of the history');
}

// items 1, 2, and 4. a line glued at both ends, also turned in the file, and a line glued at one end
for (const platform of PLATFORMS) {
  test(`item 2: the turns of a line glued at both ends are dimmed and leave the file untouched (${platform})`, async (t) => {
    const page = await load(t, platform);
    await select(page, ON_ARROW);
    await arrangeTab(page);
    await refused(page);
    assert.equal(await render(page), SOURCE);
    assert.deepEqual(await lines(page), [{ from: 'a1 1 0.5', to: 'a2 0 0.5', rotate: '' }, { from: null, to: null, rotate: '' }]);
    await select(page, ON_ARROW);
    await showTab(page, 'Line');
    assert.match(await page.evaluate(`document.querySelector(${js(PANEL)}).innerText`), /Connections/, 'the section Connections is gone');
    assert.deepEqual(errors(page), []);
  });

  test(`item 2: Reset Rotation of a turned line glued at both ends is dimmed (${platform})`, async (t) => {
    const page = await load(t, platform, TURNED);
    // a marquee around the middle of the turned arrow, clear of the two boxes
    const from = await screen(page, 700, 300);
    const to = await screen(page, 1000, 620);
    await drag(page, from, { dx: to.x - from.x, dy: to.y - from.y, steps: 10 });
    await frames(page);
    assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((el) => el.localName)'), ['svg']);
    await arrangeTab(page);
    assert.equal((await angleField(page)).value, '20');
    assert.equal((await lines(page))[0].rotate, '20deg');
    await refused(page, null);
    assert.equal(await render(page), SOURCE);
    assert.deepEqual(errors(page), []);
  });

  test(`item 2: the turns of a line glued at one end are dimmed, and the line is turned after Detach (${platform})`, async (t) => {
    const page = await load(t, platform);
    await select(page, ON_ARROW);
    await exec(page, 'line.unglue.end');
    await sleep(100);
    assert.deepEqual((await lines(page))[0], { from: 'a1 1 0.5', to: null, rotate: '' });
    await arrangeTab(page);
    await refused(page);
    // Detach of the start leaves a loose line, which the field turns in one entry
    await select(page, ON_ARROW);
    await arrangeTab(page);
    await exec(page, 'line.unglue.start');
    await sleep(100);
    const loose = await render(page);
    assert.deepEqual((await lines(page))[0], { from: null, to: null, rotate: '' });
    assert.equal(await page.evaluate(`document.querySelector(${js(SLIDE)}).querySelectorAll('[data-anchor]').length`), 0);
    for (const id of ['arrange.setRotation', 'arrange.rotateLeft', 'arrange.rotateRight']) assert.equal((await state(page, id)).enabled, true, `${id} is dimmed after Detach`);
    const field = await angleField(page);
    assert.equal(field.disabled, false, 'the field Angle is dimmed after Detach');
    assert.equal(field.title, '');
    await typeAngle(page, 30);
    assert.equal((await lines(page))[0].rotate, '30deg', 'a typed angle does not turn the line after Detach');
    const turned = await render(page);
    assert.notEqual(turned, loose);
    await undo(page);
    assert.equal(await render(page), loose, 'one undo does not take the turn back');
    await redo(page);
    assert.equal(await render(page), turned, 'a redo does not turn the line again');
    assert.equal((await state(page, 'arrange.resetRotation')).enabled, true);
    const { text } = await saveAndReopen(page, `r36-3-${platform}.html`);
    assert.equal(text, turned);
    assert.deepEqual(errors(page), []);
  });
}

// items 2 and 4. a glued line selected with a box or with a loose line is turned by the field as
// it was without this rule
for (const platform of PLATFORMS) {
  for (const [name, other] of [['a box', ON_BOX], ['a loose line', ON_LOOSE]]) {
    test(`item 2: a glued line selected with ${name} is turned as before (${platform})`, async (t) => {
      const page = await load(t, platform);
      await select(page, ON_ARROW, other);
      await arrangeTab(page);
      for (const id of ['arrange.setRotation', 'arrange.rotateLeft', 'arrange.rotateRight']) assert.equal((await state(page, id)).enabled, true, `${id} is dimmed on a mixed selection`);
      const field = await angleField(page);
      assert.equal(field.disabled, false, 'the field Angle is dimmed on a mixed selection');
      assert.equal(field.title, '');
      await typeAngle(page, 30);
      assert.equal((await lines(page))[0].rotate, '30deg', 'the glued line is not turned with the other element');
      const turned = await render(page);
      assert.notEqual(turned, SOURCE);
      await undo(page);
      assert.equal(await render(page), SOURCE, 'one undo does not take the turn back');
      await redo(page);
      assert.equal(await render(page), turned, 'a redo does not turn the selection again');
      assert.deepEqual(errors(page), []);
    });
  }
}

// item 3. a drag of the whole glued line still takes the glue of both ends off, after which the
// field turns the line
for (const platform of PLATFORMS) {
  test(`item 3: a glued line dragged whole is let go and turned by the field (${platform})`, async (t) => {
    const page = await load(t, platform);
    await drag(page, await screen(page, ...ON_ARROW), { dx: 40, dy: 60, steps: 8 });
    await sleep(150);
    const [moved] = await lines(page);
    assert.deepEqual([moved.from, moved.to], [null, null], 'a drag of the whole line keeps the glue of an end');
    await arrangeTab(page);
    assert.equal((await angleField(page)).disabled, false);
    await typeAngle(page, 15);
    assert.equal((await lines(page))[0].rotate, '15deg');
    assert.deepEqual(errors(page), []);
  });
}
