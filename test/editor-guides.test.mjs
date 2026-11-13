// the rulers of canvas/rulers.ts, the guides of canvas/guides.ts, and the grid of canvas/grid.ts on
// both platforms, driven with trusted input: View > Rulers leaves room for the rulers, a drag out
// of the top ruler places a guide with its place shown during the drag, a figure snaps to it, a
// drag back onto the ruler removes it, the guides are copied and pasted between slides, cleared,
// hidden, and kept in the draft of the file over a reload, and View > Gridlines and Snap to Grid draw
// the grid and snap a figure to it at the spacing of Grid Settings. the file is checked byte for
// byte after each of them, with the guides of a slide in data-guides on its section

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { LAYOUT_GUIDES, snapAngle, snapMove, snapPoint } from '../src/editor/canvas/snap.ts';
import { rulerSteps } from '../src/editor/canvas/rulers.ts';
import { merged } from '../src/editor/canvas/guides.ts';
import { spacingOf } from '../src/editor/canvas/grid.ts';
import { byteExact, click, drag, press, selectFigure } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const SECTIONS = [...readFileSync(LAYOUTS, 'utf8').matchAll(/<section[\s\S]*?<\/section>/g)].map((m) => m[0]);
const MATH = SECTIONS.findIndex((s) => s.includes('<h2>Math, an ordered list, and a zone</h2>'));
const ZONE = '.reveal .slides section.present figure.zone';
// the section tag of the slide of the math, and the same tag with the guides of text
const MATH_TAG = '<section>\n  <h2>Math, an ordered list, and a zone</h2>';
const mathGuides = (text) => [MATH_TAG, MATH_TAG.replace('<section>', `<section data-guides="${text}">`)];
const SLIDE = { width: 1920, height: 1080 };

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

let last = null;

// the editor on slide n of the deck of layouts, or of text, with the storage of the browser
// cleared unless keep is set. with drafts, the page keeps its unsaved edits in this storage
async function guidesPage(platform, n = MATH, keep = false, text = readFileSync(LAYOUTS, 'utf8'), drafts = keep) {
  await last?.close().catch(() => {});
  const page = await browser.newPage({ drafts });
  last = page;
  const url = `${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  if (!keep) {
    await page.evaluate('localStorage.clear()');
    await page.goto(url);
  }
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = text;
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg !== undefined ? `, ${JSON.stringify(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const box = (page, selector) => page.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r && !document.querySelector(${JSON.stringify(selector)}).hidden ? { left: r.left, top: r.top, width: r.width, height: r.height } : null; })()`);
const scale = (page) => page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'); return s.getBoundingClientRect().width / s.offsetWidth; })()`);
const screen = (page, x, y) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides');
  const r = s.getBoundingClientRect(), k = r.width / s.offsetWidth;
  return { x: r.left + ${x} * k, y: r.top + ${y} * k };
})()`);
// the guides drawn on the canvas, as [axis, place in slide px]
const guides = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-hand-guide')].filter((g) => !g.hidden && !g.classList.contains('off')).map((g) => [g.dataset.axis, Number(g.dataset.at)])`);
const translateOf = (page, selector) => page.evaluate(`document.querySelector(${JSON.stringify(selector)}).style.translate`);
const free = (platform) => (platform === 'mac' ? 'Meta' : 'Alt');

// a trusted press of Cmd or Ctrl with the key of the quote, which press() does not know
async function pressQuote(page, platform) {
  const base = { key: "'", code: 'Quote', windowsVirtualKeyCode: 222, modifiers: platform === 'mac' ? 4 : 2 };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

test('the steps of a ruler, the merge of guides, the spacing of the grid, and the snap to guides and to the grid', () => {
  assert.deepEqual(rulerSteps(0.5), { label: 100, minor: 10 });
  assert.deepEqual(rulerSteps(1), { label: 50, minor: 5 });
  assert.deepEqual(rulerSteps(0.2), { label: 250, minor: 25 });
  assert.deepEqual(merged({ x: [300, 100], y: [] }, { x: [100, 200], y: [5] }), { x: [100, 200, 300], y: [5] });
  assert.equal(spacingOf(' 40 '), 40);
  assert.equal(spacingOf('2'), null);
  assert.equal(spacingOf('x'), null);
  // a guide placed by hand is a line of the snap, as a guide of the kind guide
  const targets = { boxes: [], slide: SLIDE, layout: LAYOUT_GUIDES, guides: { x: [517], y: [] }, grid: null };
  const s = snapMove({ left: 512, top: 300, width: 100, height: 50 }, targets, 8);
  assert.equal(s.dx, 5);
  assert.ok(s.guides.some((g) => g.kind === 'guide' && g.at === 517));
  // the grid snaps an edge to a multiple of its spacing, and is not drawn as a guide
  const g = snapMove({ left: 233, top: 287, width: 80, height: 40 }, { boxes: [], slide: SLIDE, guides: { x: [], y: [] }, grid: 40 }, 8);
  assert.deepEqual([g.dx, g.dy], [7, -7]);
  assert.ok(g.guides.every((line) => line.kind !== 'grid'));
  // a point snaps to the nearest line on each axis
  const p = snapPoint({ x: 515, y: 997 }, { boxes: [], slide: SLIDE, guides: { x: [517], y: [] }, grid: 40 }, 8);
  assert.deepEqual([p.dx, p.dy], [2, 3]);
});

// the angle of a rotate drag from its raw absolute angle: held at a multiple of 45 within 4
// degrees, in steps of 15 with Shift, and to the whole degree with the free modifier
test('the angle of a rotate drag is held at the multiples of 45 degrees', () => {
  const free = { steps: false, free: false };
  const cases = [
    [41, free, 45, true], [49, free, 45, true], [40.4, free, 40, false], [49.6, free, 50, false],
    [316, free, 315, true], [357, free, 0, true], [-3, free, 0, true], [184, free, 180, true], [-50, free, 310, false], [721, free, 0, true],
    [37, { steps: true, free: false }, 30, false], [43, { steps: true, free: false }, 45, true],
    [43, { steps: false, free: true }, 43, false], [45, { steps: false, free: true }, 45, false], [43, { steps: true, free: true }, 45, true],
  ];
  for (const [raw, o, deg, held] of cases) assert.deepEqual(snapAngle(raw, o), { deg, held }, `${raw} with ${JSON.stringify(o)}`);
});

for (const platform of PLATFORMS) {
  test(`View > Rulers leaves room for the rulers, a guide dragged out of a ruler snaps a figure, and a drag back removes it, on ${platform}`, async () => {
    const page = await guidesPage(platform);
    const cell = await box(page, '.beeson-edit-canvas');
    assert.equal(await box(page, '.beeson-ruler'), null);
    await exec(page, 'view.rulers');
    await frames(page);
    assert.equal((await state(page, 'view.rulers')).checked, true);
    const top = await box(page, '.beeson-ruler[data-axis="x"]');
    const left = await box(page, '.beeson-ruler[data-axis="y"]');
    assert.deepEqual([top.top, top.height, left.left, left.width], [cell.top, 18, cell.left, 18]);
    // Cmd+R of Keynote on a Mac, which does not reload the page
    if (platform === 'mac') {
      await page.evaluate('window.beesonMark = 1');
      await press(page, 'Mod+R');
      await frames(page);
      assert.equal((await state(page, 'view.rulers')).checked, false);
      await press(page, 'Mod+R');
      await frames(page);
      assert.equal(await page.evaluate('window.beesonMark'), 1);
      assert.equal((await state(page, 'view.rulers')).checked, true);
    }
    // a guide dragged out of the left ruler, with its place shown during the drag
    const k = await scale(page);
    const at = await screen(page, 1013, 0);
    const from = { x: left.left + 9, y: left.top + 300 };
    await drag(page, from, { dx: at.x - from.x, dy: 40, hold: true });
    const readout = await page.evaluate(`document.querySelector('.beeson-guide-readout:not([hidden])')?.textContent`);
    assert.equal(readout, 'x 1013');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: from.y + 40, button: 'left', clickCount: 1 });
    await frames(page);
    assert.deepEqual(await guides(page), [['x', 1013]]);
    await byteExact(page, [mathGuides('x1013')]);
    await undo(page);
    await frames(page);
    assert.deepEqual(await guides(page), []);
    await byteExact(page);
    await page.evaluate('window.BeesonEditor.redo()');
    await frames(page);
    assert.deepEqual(await guides(page), [['x', 1013]]);
    // the left edge of the zone, at 1200, snaps to the guide when it is dragged near it, once the
    // figure is selected apart from its image
    await selectFigure(page, `${ZONE} > img`);
    const zone = await box(page, ZONE);
    await drag(page, { x: zone.left + zone.width / 2, y: zone.top + zone.height / 2 }, { dx: -183 * k, dy: 0, modifiers: 'Shift' });
    await frames(page);
    assert.equal(await translateOf(page, ZONE), '-187px');
    await undo(page);
    await byteExact(page, [mathGuides('x1013')]);
    // a drag of the guide back onto the ruler removes it
    const g = await box(page, '.beeson-hand-guide[data-axis="x"]');
    await drag(page, { x: g.left, y: g.top + 30 }, { dx: left.left + 9 - g.left, dy: 0 });
    await frames(page);
    assert.deepEqual(await guides(page), []);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`guides are copied, pasted, cleared, hidden, and kept over a reload, on ${platform}`, async () => {
    let page = await guidesPage(platform, MATH, false, undefined, true);
    // the guides are shown with the rulers
    await exec(page, 'view.rulers');
    await exec(page, 'view.guides.add', { x: [400], y: [300, 700] });
    await frames(page);
    assert.deepEqual((await guides(page)).sort(), [['x', 400], ['y', 300], ['y', 700]]);
    assert.equal((await state(page, 'slide.guides.paste')).enabled, false);
    await exec(page, 'slide.guides.copy');
    await page.evaluate(`Reveal.slide(${MATH + 1})`);
    await frames(page);
    assert.deepEqual(await guides(page), []);
    assert.equal((await state(page, 'view.guides.clear')).enabled, false);
    await exec(page, 'slide.guides.paste');
    await frames(page);
    assert.deepEqual((await guides(page)).sort(), [['x', 400], ['y', 300], ['y', 700]]);
    await exec(page, 'view.guides.clear');
    await frames(page);
    assert.deepEqual(await guides(page), []);
    // hidden rulers hide them
    await page.evaluate(`Reveal.slide(${MATH})`);
    await frames(page);
    await exec(page, 'view.rulers');
    await frames(page);
    assert.deepEqual(await guides(page), []);
    await exec(page, 'view.rulers');
    await frames(page);
    assert.deepEqual((await guides(page)).sort(), [['x', 400], ['y', 300], ['y', 700]]);
    await byteExact(page, [mathGuides('x400 y300 y700')]);
    // the guides are in the draft of the unsaved edits, which a reload offers, and not in the
    // storage of the browser
    assert.equal(await page.evaluate(`localStorage.getItem('beeson-edit-guides:' + location.pathname)`), null);
    await page.evaluate('new Promise((done) => setTimeout(done, 1500))');
    page = await guidesPage(platform, MATH, true);
    assert.equal((await page.evaluate('window.BeesonEditor.status()')).recover, true);
    const draft = await page.evaluate(`JSON.parse(Object.entries(localStorage).find(([k]) => k.startsWith('beeson-draft:'))[1]).text`);
    assert.equal(draft, page.source.replace(...mathGuides('x400 y300 y700')));
    await page.evaluate(`Reveal.slide(${MATH + 1})`);
    await frames(page);
    assert.deepEqual(await guides(page), []);
    assert.deepEqual(errors(page), []);
  });

  test(`View > Gridlines draws the grid, and Snap to Grid snaps a figure at the spacing of Grid Settings, on ${platform}`, async () => {
    const page = await guidesPage(platform);
    assert.equal(await box(page, '.beeson-grid'), null);
    await pressQuote(page, platform);
    await frames(page);
    assert.equal((await state(page, 'view.grid')).checked, true);
    const k = await scale(page);
    const grid = await box(page, '.beeson-grid');
    const slide = await box(page, '.reveal .slides');
    assert.ok(Math.abs(grid.left - slide.left) <= 1 && Math.abs(grid.top - slide.top) <= 1);
    const size = await page.evaluate(`getComputedStyle(document.querySelector('.beeson-grid')).backgroundSize`);
    assert.ok(Math.abs(parseFloat(size) - 40 * k) < 0.01);
    await byteExact(page);
    // with Snap to Grid, a drag of the zone by 33 slide px is snapped to 40
    await exec(page, 'view.grid.snap');
    assert.equal((await state(page, 'view.grid.snap')).checked, true);
    await selectFigure(page, `${ZONE} > img`);
    const zone = await box(page, ZONE);
    await drag(page, { x: zone.left + zone.width / 2, y: zone.top + zone.height / 2 }, { dx: 33 * k, dy: 0, modifiers: 'Shift' });
    await frames(page);
    assert.equal(await translateOf(page, ZONE), '40px');
    await undo(page);
    await byteExact(page);
    // Grid Settings sets the spacing in its sheet
    await exec(page, 'view.grid.settings');
    await page.waitFor(`!!document.querySelector('dialog.beeson-grid-sheet[open] input[name="spacing"]')`);
    await page.evaluate(`(() => { const i = document.querySelector('dialog.beeson-grid-sheet input[name="spacing"]'); i.value = '60'; })()`);
    await click(page, 'dialog.beeson-grid-sheet[open] .row button.primary');
    await frames(page);
    assert.ok(Math.abs(parseFloat(await page.evaluate(`getComputedStyle(document.querySelector('.beeson-grid')).backgroundSize`)) - 60 * k) < 0.01);
    const again = await box(page, ZONE);
    await drag(page, { x: again.left + again.width / 2, y: again.top + again.height / 2 }, { dx: 55 * k, dy: 0, modifiers: 'Shift' });
    await frames(page);
    assert.equal(await translateOf(page, ZONE), '60px');
    await undo(page);
    // the free modifier moves the zone without the snap
    await drag(page, { x: again.left + again.width / 2, y: again.top + again.height / 2 }, { dx: 33 * k, dy: 0, modifiers: `Shift+${free(platform)}` });
    await frames(page);
    assert.ok(Math.abs(parseFloat(await translateOf(page, ZONE)) - 33) <= 1);
    await undo(page);
    await byteExact(page);
    await pressQuote(page, platform);
    await frames(page);
    assert.equal(await box(page, '.beeson-grid'), null);
    assert.deepEqual(errors(page), []);
  });
}
