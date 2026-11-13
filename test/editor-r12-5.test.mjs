// the work of R12.5 on both platforms: Align and Distribute of a whole group as one object, a
// typed width that keeps the upper left corner of a QR code, an undo or a redo that shows the slide
// that it changes, the cursor of a held grip, the rotate handle of a multi-selection, and the gap
// arrows of a drag drawn clear of the center guide. each edit of the file is checked byte for byte,
// after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';
import { snapMove } from '../src/editor/canvas/snap.ts';

const DECK = 'test-deck.html';
// the indexes of the figures slide and of the closing slide with its QR code in index.html
const FIGURES = 4;
const CLOSING = 12;
const PLATFORMS = ['mac', 'other'];

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
const near = (a, b, by = 2) => Math.abs(a - b) <= by;
const shown = (page) => page.evaluate('Reveal.getIndices().h');
// the box in slide pixels of the first shown element of selector on the current slide
const boxOf = (page, selector) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides').getBoundingClientRect(), k = s.width / 1920;
  const e = [...Reveal.getCurrentSlide().querySelectorAll(${js(selector)})].find((e) => e.getClientRects().length && e.getBoundingClientRect().width);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { left: (r.left - s.left) / k, top: (r.top - s.top) / k, width: r.width / k, height: r.height / k };
})()`);
// whether every selected element is on the shown slide
const selectionShown = (page) => page.evaluate('window.BeesonEditor.selection().every((el) => Reveal.getCurrentSlide().contains(el))');

const PANEL = '#beeson-edit-panel-format';
async function fieldValue(page, id) {
  await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].find((b) => b.textContent === 'Arrange')?.click()`);
  await frames(page);
  return Number(await page.evaluate(`document.querySelector('#beeson-edit-num-${id}')?.value`));
}
async function typeField(page, id, value) {
  await fieldValue(page, id);
  await page.evaluate(`(() => { const i = document.querySelector('#beeson-edit-num-${id}'); i.focus(); i.select(); })()`);
  await type(page, String(value));
  await press(page, 'Enter');
  await frames(page);
}
// the box in slide pixels of the picture of the figure of the current slide, fitted into its image
// box at its center, and with caption set the union of it and the caption
const figureBox = (page, caption = true) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides').getBoundingClientRect(), k = s.width / 1920;
  const img = Reveal.getCurrentSlide().querySelector('figure img.for-light'), i = img.getBoundingClientRect();
  const q = Math.min(i.width / img.naturalWidth, i.height / img.naturalHeight), w = img.naturalWidth * q, h = img.naturalHeight * q;
  const boxes = [{ left: i.left + (i.width - w) / 2, top: i.top + (i.height - h) / 2, right: i.left + (i.width + w) / 2, bottom: i.top + (i.height + h) / 2 }];
  if (${caption}) boxes.push(Reveal.getCurrentSlide().querySelector('figcaption').getBoundingClientRect());
  const left = Math.min(...boxes.map((b) => b.left)), top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.right)), bottom = Math.max(...boxes.map((b) => b.bottom));
  return { left: (left - s.left) / k, top: (top - s.top) / k, width: (right - left) / k, height: (bottom - top) / k };
})()`);

async function load(t, platform, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&theme=light&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// an undo gives the text before and a redo the edited text byte for byte, and the saved text is
// opened again without problems
async function checkEdit(page, name, before = page.source) {
  const edited = await render(page);
  assert.notEqual(edited, before);
  await undo(page);
  assert.equal(await render(page), before);
  await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, name);
  assert.equal(text, edited);
}

// the paragraph and the figure of the figures slide made a group by the key of Group, with the
// group selected
async function groupOnFigures(page) {
  await click(page, 'section.present figure img.for-light');
  const p = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(':scope > p').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
  await click(page, p, { modifiers: 'Shift' });
  assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((el) => el.localName).sort()'), ['figure', 'p']);
  await press(page, (await page.evaluate("new URLSearchParams(location.search).get('edit-platform')")) === 'mac' ? 'Alt+Mod+G' : 'Mod+G');
  assert.equal(await page.evaluate('Reveal.getCurrentSlide().querySelectorAll("[data-group]").length'), 2);
}

for (const platform of PLATFORMS) {
  test(`Align moves a whole group as one object (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await groupOnFigures(page);
    const grouped = await render(page);
    const p0 = await boxOf(page, ':scope > p'), f0 = await boxOf(page, ':scope > figure');
    // one whole group is aligned to the slide, as one object of Keynote is
    await exec(page, 'arrange.alignTo.selection');
    await exec(page, 'arrange.align.left');
    await frames(page);
    const p = await boxOf(page, ':scope > p'), f = await boxOf(page, ':scope > figure');
    assert.ok(near(f.left - p.left, f0.left - p0.left) && near(f.top - p.top, f0.top - p0.top), `the members kept their places: ${js({ p0, f0, p, f })}`);
    assert.ok(near(Math.min(p.left, f.left), 0), `the group is at the left edge of the slide: ${js({ p, f })}`);
    await checkEdit(page, `r12-5-align-${platform}.html`, grouped);
    assert.deepEqual(errors(page), []);
  });

  test(`Distribute moves a whole group as one object (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await groupOnFigures(page);
    const grouped = await render(page);
    const p0 = await boxOf(page, ':scope > p'), f0 = await boxOf(page, ':scope > figure');
    // the group, the heading, and the list spaced vertically with the group kept whole
    await click(page, 'section.present figure img.for-light');
    await click(page, 'section.present h2', { modifiers: 'Shift' });
    await click(page, 'section.present > ul > li', { modifiers: 'Shift' });
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 4);
    await exec(page, 'arrange.distribute.vertical');
    await frames(page);
    const p = await boxOf(page, ':scope > p'), f = await boxOf(page, ':scope > figure');
    assert.ok(near(f.left - p.left, f0.left - p0.left) && near(f.top - p.top, f0.top - p0.top), `the members kept their places: ${js({ p0, f0, p, f })}`);
    await checkEdit(page, `r12-5-distribute-${platform}.html`, grouped);
    assert.deepEqual(errors(page), []);
  });

  test(`a typed width keeps the upper left corner of the QR code of the closing slide (${platform})`, async (t) => {
    const page = await load(t, platform, CLOSING);
    await click(page, 'section.present .qr');
    assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((el) => el.matches(".qr"))'), [true]);
    const was = await boxOf(page, '.qr');
    await exec(page, 'arrange.setSize', { w: 240 });
    await frames(page);
    const now = await boxOf(page, '.qr');
    assert.ok(near(now.width, 240), `the width is 240: ${js(now)}`);
    assert.ok(near(now.left, was.left) && near(now.top, was.top), `the corner stays: ${js({ was, now })}`);
    await checkEdit(page, `r12-5-qr-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });

  for (const [what, act] of [
    ['Duplicate', (page) => press(page, 'Mod+D')],
    ['a duplicating drag', (page, platform) => drag(page, 'section.present figure img.for-light', { dx: -120, dy: 0, modifiers: platform === 'mac' ? 'Alt' : 'Ctrl' })],
    ['Delete', (page) => press(page, 'Backspace')],
    ['Lock', (page) => press(page, 'Mod+L')],
  ]) {
    test(`an undo and a redo of ${what} show the slide that they change (${platform})`, async (t) => {
      const page = await load(t, platform, FIGURES);
      await click(page, 'section.present figure img.for-light');
      await act(page, platform);
      await frames(page);
      const edited = await render(page);
      assert.notEqual(edited, page.source);
      await page.evaluate('Reveal.slide(1)');
      await frames(page);
      await undo(page);
      await frames(page);
      assert.equal(await render(page), page.source);
      assert.equal(await shown(page), FIGURES, 'the undo shows the slide of the change');
      assert.ok(await selectionShown(page), 'the selection is on the shown slide');
      await page.evaluate('Reveal.slide(7)');
      await frames(page);
      await redo(page);
      await frames(page);
      assert.equal(await render(page), edited);
      assert.equal(await shown(page), FIGURES, 'the redo shows the slide of the change');
      assert.ok(await selectionShown(page), 'the selection is on the shown slide');
      assert.deepEqual(errors(page), []);
    });
  }
  test(`a held corner grip keeps its diagonal cursor through the resize (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await click(page, 'section.present figure img.for-light');
    const grip = await page.evaluate(`(() => { const g = [...document.querySelectorAll('.beeson-grip[data-handle="se"]')].find((g) => g.getClientRects().length && !g.hidden); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const cursor = (x, y) => page.evaluate(`getComputedStyle(document.elementFromPoint(${x}, ${y})).cursor`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: grip.x, y: grip.y });
    assert.equal(await cursor(grip.x, grip.y), 'nwse-resize');
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: grip.x, y: grip.y, button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 8; i++) await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: grip.x - 15 * i, y: grip.y - 4 * i, button: 'left', buttons: 1 });
    await frames(page);
    assert.equal(await cursor(grip.x - 120, grip.y - 32), 'nwse-resize', 'the held grip keeps its cursor');
    // the readout of the resize of a figure selected as one object gives the height of the field H,
    // i.e. of the picture with its caption
    const readout = await page.evaluate(`document.querySelector('.beeson-offset').textContent`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: grip.x - 120, y: grip.y - 32, button: 'left', buttons: 0, clickCount: 1 });
    await frames(page);
    const [, w, h] = readout.match(/w: (\d+) px\s+h: (\d+) px/) ?? [];
    assert.ok(near(Number(w), await fieldValue(page, 'width'), 1) && near(Number(h), await fieldValue(page, 'height'), 1), `the readout ${readout} is not W ${await fieldValue(page, 'width')} and H ${await fieldValue(page, 'height')}`);
    await click(page, { x: grip.x - 120, y: grip.y - 32 });
    await frames(page);
    assert.notEqual(await cursor(grip.x - 120, grip.y - 32), 'nwse-resize');
    await checkEdit(page, `r12-5-grip-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });
  test(`a multiple selection is turned by its rotate handle, each element about its own center (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await click(page, 'section.present > p');
    await press(page, 'Escape');
    await click(page, 'section.present figure img.for-light', { modifiers: 'Shift' });
    assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((el) => el.localName)'), ['p', 'figure']);
    const centerOf = (selector) => page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(${js(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const p0 = await centerOf(':scope > p'), i0 = await centerOf('figure img.for-light'), q0 = await centerOf('figcaption');
    // the center on the screen of the picture with its caption, about which the figure is turned
    const s = await page.evaluate(`(() => { const r = document.querySelector('.reveal .slides').getBoundingClientRect(); return { left: r.left, top: r.top, k: r.width / 1920 }; })()`);
    const f = await figureBox(page), c = { x: s.left + (f.left + f.width / 2) * s.k, y: s.top + (f.top + f.height / 2) * s.k };
    const rotor = await page.evaluate(`(() => { const r = document.querySelector('.beeson-rotor'); if (!r || r.hidden || !r.getClientRects().length) return null; const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    assert.ok(rotor, 'the rotate handle is drawn');
    // a drag of the handle from above the center of the paragraph to its right, with Shift for
    // steps of 15 degrees, turns it by 90 degrees
    await drag(page, rotor, { dx: p0.x - rotor.x + (p0.y - rotor.y), dy: p0.y - rotor.y, steps: 12, modifiers: 'Shift' });
    await frames(page);
    // the figure is turned as one object, its picture and its caption about the center of both
    const angles = await page.evaluate(`[Reveal.getCurrentSlide().querySelector(':scope > p'), Reveal.getCurrentSlide().querySelector('figure.zone')].map((el) => el.style.rotate)`);
    assert.deepEqual(angles, ['90deg', '90deg']);
    const p1 = await centerOf(':scope > p'), i1 = await centerOf('figure img.for-light'), q1 = await centerOf('figcaption');
    const at = (o) => ({ x: c.x - (o.y - c.y), y: c.y + (o.x - c.x) });
    assert.ok(near(p1.x, p0.x) && near(p1.y, p0.y), `the paragraph kept its center: ${js({ p0, p1 })}`);
    assert.ok([[i1, at(i0)], [q1, at(q0)]].every(([a, b]) => near(a.x, b.x) && near(a.y, b.y)), `the figure kept the center of its picture with its caption: ${js({ c, i0, i1, q0, q1 })}`);
    await checkEdit(page, `r12-5-rotor-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });
  test(`the Height of a figure selected as one object gives its picture with its caption (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await click(page, 'section.present figure img.for-light');
    const f0 = await figureBox(page);
    assert.ok(f0.height > 800, `the frame holds the caption: ${js(f0)}`);
    for (const [id, v] of [['x', f0.left], ['y', f0.top], ['width', f0.width], ['height', f0.height]]) {
      assert.ok(near(await fieldValue(page, id), v, 1), `${id} reads ${await fieldValue(page, id)}, not ${Math.round(v)} of the frame`);
    }
    // a typed Height sets the picture so that the picture with its caption has this height
    await typeField(page, 'height', 700);
    const f1 = await figureBox(page);
    assert.ok(near(f1.height, 700, 3) && near(f1.left, f0.left) && near(f1.top, f0.top), `the frame is ${js(f1)}`);
    assert.ok(near(await fieldValue(page, 'height'), 700, 3), `Height reads ${await fieldValue(page, 'height')}`);
    await checkEdit(page, `r12-5-figure-height-${platform}.html`);
    // the picture alone, selected by a second click, gives its own height
    await click(page, { x: 10, y: 10 });
    await click(page, 'section.present figure img.for-light');
    await click(page, 'section.present figure img.for-light');
    assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((el) => el.localName)'), ['img']);
    const h = await fieldValue(page, 'height');
    const pic = await figureBox(page, false);
    assert.ok(near(h, pic.height, 2) && h < 700 - 50, `the picture alone reads ${h} against its box ${js(pic)}`);
    assert.deepEqual(errors(page), []);
  });
}

for (const platform of PLATFORMS) {
  test(`a turned group keeps the size of its frame and of its W and H fields (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await groupOnFigures(page);
    const grouped = await render(page);
    const w0 = await fieldValue(page, 'width'), h0 = await fieldValue(page, 'height');
    const frame = () => page.evaluate(`(() => { const f = document.querySelector('.beeson-frame.union.group'); return f.hidden ? null : { width: f.offsetWidth, height: f.offsetHeight, rotate: f.style.rotate }; })()`);
    const f0 = await frame();
    let before = grouped;
    for (const deg of [20, 45]) {
      if (deg === 45) before = await render(page);
      await typeField(page, 'angle', deg);
      const w = await fieldValue(page, 'width'), h = await fieldValue(page, 'height'), f = await frame();
      assert.ok(near(w, w0, 3) && near(h, h0, 3), `at ${deg} degrees W and H read ${w} by ${h}, not ${w0} by ${h0}`);
      assert.ok(near(f.width, f0.width, 3) && near(f.height, f0.height, 3) && f.rotate === `${deg}deg`, `at ${deg} degrees the frame is ${js(f)}, not ${js(f0)} turned`);
    }
    await checkEdit(page, `r12-5-turned-group-${platform}.html`, before);
    assert.deepEqual(errors(page), []);
  });
}

// the marks of equal gaps are drawn under the boxes, clear of the guide of their centers and of
// their lower edges, as PowerPoint draws them (P22), since a mark on a guide merges with it
test('the marks of equal gaps are drawn clear of the guides along the same axis', () => {
  const box = (left, top, width, height) => ({ left, top, width, height });
  const slide = { width: 1920, height: 1080 };
  for (const [moved, boxes] of [
    [box(446, 400, 100, 100), [box(100, 400, 200, 100), box(700, 400, 200, 100)]],
    [box(446, 420, 100, 60), [box(100, 400, 200, 100), box(700, 400, 200, 100)]],
  ]) {
    const snap = snapMove(moved, { boxes, slide }, 16);
    const gaps = snap.spacing.filter((s) => s.axis === 'x').flatMap((s) => s.gaps);
    assert.equal(gaps.length, 2);
    const lines = snap.guides.filter((g) => g.axis === 'y').map((g) => g.at);
    for (const g of gaps) {
      assert.ok(lines.every((at) => Math.abs(at - g.at) >= 7), `a mark at y ${g.at} is on a guide of ${js(lines)}`);
      assert.ok(g.at > Math.max(...boxes.map((b) => b.top + b.height), moved.top + moved.height) - 1, `a mark at y ${g.at} is not under the boxes`);
    }
  }
});
