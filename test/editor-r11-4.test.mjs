// the work of R11.4 on both platforms: the parts of the presenter display moved and resized while
// it is customized, as in Customize Presenter Display of Keynote (K52), the TeX popover of a
// formula by the keyboard, and a marquee held at the edge of a zoomed canvas. each edit of the file
// is checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const OUTLINE = 'test/pages/editor-outline.html';
const LAYOUTS = 'test/pages/editor-layouts.html';
// the slide of editor-layouts.html with a display, an ordered list, and a zone
const MATH = 3;
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
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const near = (a, b, by = 2) => Math.abs(a - b) <= by;
const sameRect = (a, b, by = 2) => !!a && !!b && near(a.left, b.left, by) && near(a.top, b.top, by) && near(a.width, b.width, by) && near(a.height, b.height, by);
const mouse = (page, type, x, y) => page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
// the box of the first element of selector on the screen, or null when it is not shown
const rectOf = (page, selector) => page.evaluate(`(() => { const e = document.querySelector(${js(selector)}); if (!e || !e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);
// the selected elements, a display as math
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => el.matches('div.math') ? 'math' : el.localName)`);

// the editor on a deck served over HTTP, with the storage of the origin emptied first, and with
// slide n shown
async function load(t, platform, { deck = OUTLINE, n = 0, size = { width: 1600, height: 1000 } } = {}) {
  const page = await browser.newPage(size);
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

// the rendered text is edited, an undo gives the text before and a redo the edited text byte for
// byte, and the saved text is opened again without problems
async function checkEdit(page, before, edited, name) {
  assert.equal(await render(page), edited);
  await undo(page);
  assert.equal(await render(page), before);
  await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, name);
  assert.equal(text, edited);
}

// the element of each part of the presenter display, and the frames drawn around the parts while
// the display is customized
const PART = { current: '.col.now', next: '.col.upcoming', notes: '.notes', clock: '.clock', timer: '.group.timer' };
const DISPLAY = 'dialog.beeson-edit-presenter[open]';
const LAYOUT_KEY = `localStorage.getItem('beeson-presenter-layout:' + location.pathname)`;
const PARTS_KEY = `localStorage.getItem('beeson-presenter-parts:' + location.pathname)`;
const partRect = (page, part) => rectOf(page, `${DISPLAY} ${PART[part]}`);
const frameRect = (page, part) => rectOf(page, `${DISPLAY} .layout .frame[data-part="${part}"]`);
const centerOf = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const gripOf = async (page, part) => {
  const r = await rectOf(page, `${DISPLAY} .layout .frame[data-part="${part}"] .grip`);
  assert.ok(r, `the frame of ${part} does not have a grip`);
  return centerOf(r);
};
const shotRatio = (page, which) => page.evaluate(`(() => { const r = document.querySelector('${DISPLAY} .shot.${which}').getBoundingClientRect(); return r.width / r.height; })()`);
const customizing = (page) => page.evaluate(`!!document.querySelector('${DISPLAY} .layout:not([hidden])')`);

// the customizing started by the button of the popover of Display Options, as in Keynote (K52)
async function customize(page) {
  if (await page.evaluate(`!!document.querySelector('${DISPLAY} .parts[hidden]')`)) await click(page, `${DISPLAY} .bar.top button[aria-label="Display Options"]`);
  const buttons = await page.evaluate(`[...document.querySelectorAll('${DISPLAY} .parts button')].map((b) => b.textContent)`);
  assert.deepEqual(buttons, ['Customize Presenter Display'], 'the popover does not have the button Customize Presenter Display');
  await click(page, `${DISPLAY} .parts button`);
  await frames(page);
}

for (const platform of PLATFORMS) {
  test(`while the presenter display is customized, each shown part is framed, moved by a drag, and resized by its corner, and Use Auto Layout puts it back (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 1 });
    await exec(page, 'play.customizePresenter');
    await page.waitFor(`!!document.querySelector(${js(DISPLAY)})`);
    // outside the customizing, a drag does not move a part
    const auto = {};
    for (const p of Object.keys(PART)) auto[p] = await partRect(page, p);
    await press(page, 'Escape');
    const shot0 = await rectOf(page, `${DISPLAY} .shot.next`);
    await drag(page, `${DISPLAY} .notes .text`, { dx: -200, dy: 60 });
    await drag(page, `${DISPLAY} .shot.next`, { dx: -200, dy: 60 });
    await frames(page);
    assert.ok(sameRect(await partRect(page, 'notes'), auto.notes), 'a drag moved the notes outside the customizing');
    assert.ok(sameRect(await rectOf(page, `${DISPLAY} .shot.next`), shot0), 'a drag moved the next slide outside the customizing');
    assert.equal(await customizing(page), false, 'the frames are drawn outside the customizing');

    await customize(page);
    assert.equal(await customizing(page), true, 'the button does not start the customizing');
    assert.equal(await page.evaluate(`!!document.querySelector('${DISPLAY} .parts:not([hidden])')`), false, 'the popover is still open while the display is customized');
    for (const p of Object.keys(PART)) {
      const f = await frameRect(page, p);
      const r = await partRect(page, p);
      assert.ok(f && r && near(f.left, r.left, 4) && near(f.top, r.top, 4) && near(f.width, r.width, 8) && near(f.height, r.height, 8), `the frame of ${p} is ${js(f)} around ${js(r)}`);
    }
    // a drag of the frame of the notes moves them, and the other parts stay
    const notes0 = await partRect(page, 'notes');
    const r0 = await partRect(page, 'current');
    await drag(page, centerOf(notes0), { dx: -300, dy: -40 });
    await frames(page);
    const notes1 = await partRect(page, 'notes');
    assert.ok(near(notes1.left, notes0.left - 300) && near(notes1.top, notes0.top - 40), `the notes moved from ${js(notes0)} to ${js(notes1)}`);
    assert.ok(sameRect(await partRect(page, 'current'), r0), 'the current slide moved with the notes');
    // a drag of the corner of the current slide resizes it, and its slide keeps its aspect ratio
    await drag(page, await gripOf(page, 'current'), { dx: -240, dy: 30 });
    await frames(page);
    const r1 = await partRect(page, 'current');
    assert.ok(near(r1.left, r0.left) && near(r1.top, r0.top), `the corner across from the grip moved from ${js(r0)} to ${js(r1)}`);
    assert.ok(near(r1.width, r0.width - 240), `the width of the current slide is ${r1.width}, not ${r0.width - 240}`);
    assert.ok(near(await shotRatio(page, 'current'), 16 / 9, 0.02), 'the current slide does not keep its aspect ratio');
    // the corners of the next slide and of the notes
    const n0 = await partRect(page, 'next');
    await drag(page, await gripOf(page, 'next'), { dx: -100, dy: 10 });
    await frames(page);
    const n1 = await partRect(page, 'next');
    assert.ok(near(n1.width, n0.width - 100), `the width of the next slide is ${n1.width}, not ${n0.width - 100}`);
    assert.ok(near(await shotRatio(page, 'next'), 16 / 9, 0.02), 'the next slide does not keep its aspect ratio');
    await drag(page, await gripOf(page, 'notes'), { dx: -50, dy: -30 });
    await frames(page);
    const notes2 = await partRect(page, 'notes');
    assert.ok(near(notes2.width, notes1.width - 50) && near(notes2.height, notes1.height - 30), `the notes are ${js(notes2)} after a resize of ${js(notes1)} by -50, -30`);
    // the clock is moved, and the text of the timer is made bigger by its corner
    const c0 = await partRect(page, 'clock');
    await drag(page, centerOf(c0), { dx: -500, dy: 300 });
    const c1 = await partRect(page, 'clock');
    assert.ok(near(c1.left, c0.left - 500) && near(c1.top, c0.top + 300), `the clock moved from ${js(c0)} to ${js(c1)}`);
    const t0 = await partRect(page, 'timer');
    await drag(page, await gripOf(page, 'timer'), { dx: 60, dy: 30 });
    const t1 = await partRect(page, 'timer');
    assert.ok(t1.height > t0.height + 15, `the timer is ${js(t1)} after a drag of its corner from ${js(t0)}`);
    // a part is kept inside the display
    await drag(page, centerOf(c1), { dx: -2000, dy: -2000 });
    const c2 = await partRect(page, 'clock');
    assert.ok(near(c2.left, 0) && near(c2.top, 0), `the clock is dragged out of the display to ${js(c2)}`);
    // the layout is kept in the storage as fractions of the display, and the file is not changed
    const stored = JSON.parse(await page.evaluate(LAYOUT_KEY));
    assert.deepEqual(Object.keys(stored).sort(), Object.keys(PART).sort());
    assert.ok(Object.values(stored).every((b) => Object.values(b).every((v) => v >= 0 && v <= 1)), `the layout ${js(stored)} is not in fractions`);
    assert.equal(await page.evaluate(PARTS_KEY), null);
    // the keys of the show stay live while the display is customized, and Esc ends the customizing
    assert.equal(await page.evaluate(`document.querySelector('${DISPLAY} .count').textContent`), '2 / 3');
    await press(page, 'ArrowRight');
    assert.equal(await page.evaluate(`document.querySelector('${DISPLAY} .count').textContent`), '3 / 3');
    await press(page, 'Escape');
    assert.equal(await customizing(page), false, 'Esc does not end the customizing');
    assert.ok(await page.evaluate(`!!document.querySelector(${js(DISPLAY)})`), 'Esc ends the display with the customizing');
    const placed = {};
    for (const p of Object.keys(PART)) placed[p] = await partRect(page, p);
    // the layout holds at another size of the window
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 800, deviceScaleFactor: 1, mobile: false });
    await frames(page);
    const small = await partRect(page, 'notes');
    const scaled = { left: (placed.notes.left * 1200) / 1600, top: (placed.notes.top * 800) / 1000, width: (placed.notes.width * 1200) / 1600, height: (placed.notes.height * 800) / 1000 };
    assert.ok(sameRect(small, scaled, 3), `the notes are ${js(small)} at 1200 × 800, after ${js(placed.notes)} at 1600 × 1000`);
    assert.ok(near(await shotRatio(page, 'current'), 16 / 9, 0.02));
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
    await frames(page);
    // outside the customizing, a drag does not move a part of the layout
    await drag(page, `${DISPLAY} .notes .text`, { dx: 200, dy: 60 });
    assert.ok(sameRect(await partRect(page, 'notes'), placed.notes), 'a drag moved the notes after the customizing');
    // the display is opened again with the layout, a part hidden is not framed, and Use Auto Layout
    // puts the parts back where they were
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector(${js(DISPLAY)})`);
    await exec(page, 'play.customizePresenter');
    await page.waitFor(`!!document.querySelector(${js(DISPLAY)})`);
    assert.ok(sameRect(await partRect(page, 'notes'), placed.notes), 'the layout is not kept for the deck');
    await click(page, `${DISPLAY} .parts label:nth-child(4)`);
    await customize(page);
    assert.equal(await frameRect(page, 'clock'), null, 'a hidden part is framed');
    assert.ok(await frameRect(page, 'notes'));
    const tools = await page.evaluate(`[...document.querySelectorAll('${DISPLAY} .layout button')].map((b) => b.textContent)`);
    assert.deepEqual(tools, ['Use Auto Layout', 'Done']);
    await click(page, `${DISPLAY} .layout button:first-of-type`);
    await frames(page);
    assert.equal(await page.evaluate(LAYOUT_KEY), null, 'Use Auto Layout does not clear the stored layout');
    for (const p of ['current', 'next', 'notes', 'timer']) {
      const r = await partRect(page, p);
      assert.ok(sameRect(r, auto[p]), `Use Auto Layout puts ${p} at ${js(r)}, not at ${js(auto[p])}`);
    }
    await click(page, `${DISPLAY} .layout button:last-of-type`);
    assert.equal(await customizing(page), false, 'Done does not end the customizing');
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector(${js(DISPLAY)})`);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}

// the TeX popover of a formula: the focus, Tab and Shift+Tab, Esc, Return on its button, and the
// keys of the editor after it closes
const SHEET = '.beeson-math';
const focusIn = (page, selector) => page.evaluate(`!!document.activeElement?.closest(${js(selector)})`);
const focused = (page) => page.evaluate(`(() => { const a = document.activeElement; return a?.localName === 'textarea' ? 'field' : a?.localName === 'button' ? a.textContent : a?.localName ?? null; })()`);
const sheetOpen = (page) => page.evaluate(`!!document.querySelector(${js(SHEET)})`);
// the TeX typed is typeset in the preview, and the button that applies it is lit
const typeset = (page) => page.waitFor(`(() => { const b = document.querySelector('${SHEET} button.primary'); return !!b && !b.disabled; })()`);

// Tab until the focus is on stop, the field or the label of a button, within six presses
async function tabTo(page, stop) {
  for (let i = 0; i < 6 && (await focused(page)) !== stop; i++) await press(page, 'Tab');
  assert.equal(await focused(page), stop, `Tab does not reach ${stop}`);
}

// a trusted Return with its character, which presses a focused button as a key of a user does
async function enter(page) {
  const base = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: '\r', unmodifiedText: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

const TEX = String.raw`\[\ddot x - \class{coriolis}{2\dot y} = -\frac{\partial \tilde U}{\partial x},\]`;
const LIVE_MATH = '.reveal section.present div.math mjx-container';

// the TeX popover opened by a double click on the display of slide MATH
async function openTex(page) {
  await click(page, LIVE_MATH, { count: 2 });
  await page.waitFor(`!!document.querySelector(${js(SHEET)}) && !!document.querySelector('${SHEET} .preview mjx-container')`);
  await frames(page);
}

for (const platform of PLATFORMS) {
  test(`the TeX popover of a formula takes the focus, keeps Tab and Shift+Tab inside it, and closes by Esc from each of its controls (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: LAYOUTS, n: MATH });
    await openTex(page);
    assert.equal(await focused(page), 'field', 'the focus is not in the TeX field when the popover opens');
    await typeset(page);
    // Tab and Shift+Tab reach the field and each button, and the focus stays inside the popover
    const reached = new Set(['field']);
    for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
      await press(page, key);
      assert.ok(await focusIn(page, SHEET), `the focus leaves the popover after ${key}`);
      reached.add(await focused(page));
    }
    assert.deepEqual([...reached].sort(), ['Apply', 'Cancel', 'field'], 'Tab does not reach each control of the popover');
    // Esc closes the popover without the change from the field and from each button
    for (const stop of ['field', 'Apply', 'Cancel']) {
      if (!(await sheetOpen(page))) await openTex(page);
      await page.evaluate(`document.querySelector('${SHEET} textarea').select()`);
      await type(page, 'y');
      await sleep(300);
      await typeset(page);
      await tabTo(page, stop);
      await press(page, 'Escape');
      await frames(page);
      assert.equal(await sheetOpen(page), false, `Esc with the focus on ${stop} does not close the popover`);
      assert.equal(await render(page), page.source, `Esc with the focus on ${stop} changes the formula`);
      assert.deepEqual(await selected(page), ['math'], `after Esc from ${stop}, the formula is not selected`);
    }
    // Return on Cancel closes the popover without the change
    await openTex(page);
    await page.evaluate(`document.querySelector('${SHEET} textarea').select()`);
    await type(page, 'y');
    await sleep(300);
    await typeset(page);
    await tabTo(page, 'Cancel');
    await enter(page);
    await frames(page);
    assert.equal(await sheetOpen(page), false, 'Return on Cancel does not close the popover');
    assert.equal(await render(page), page.source, 'Return on Cancel changes the formula');
    assert.deepEqual(errors(page), []);
  });

  test(`Return on Apply of the TeX popover applies the TeX, and the formula is then selected for the keys of the editor (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: LAYOUTS, n: MATH });
    await openTex(page);
    await page.evaluate(`document.querySelector('${SHEET} textarea').select()`);
    await type(page, String.raw`\ddot x = 0,`);
    await sleep(300);
    await typeset(page);
    await tabTo(page, 'Apply');
    await enter(page);
    await page.waitFor(`!document.querySelector(${js(SHEET)})`);
    await frames(page);
    const applied = page.source.replace(TEX, () => String.raw`\[\ddot x = 0,\]`);
    assert.equal(await render(page), applied, 'Return on Apply does not apply the TeX');
    assert.deepEqual(await selected(page), ['math'], 'the formula is not selected after the popover closes');
    // the arrow keys nudge the formula, without a click
    await press(page, 'ArrowRight');
    await sleep(1100);
    const nudged = await render(page);
    assert.match(nudged, /<div class="math fragment" data-fragment-index="1" data-keep style="translate: [^"]+">/, 'the arrow key does not nudge the formula');
    await checkEdit(page, applied, nudged, `r11-4-nudge-${platform}.html`);
    // after Esc from the popover, Delete removes the formula
    await page.evaluate(`Reveal.slide(${MATH})`);
    await frames(page);
    await openTex(page);
    await press(page, 'Escape');
    await frames(page);
    await press(page, 'Delete');
    await frames(page);
    const removed = await render(page);
    assert.ok(!removed.includes(String.raw`\ddot x = 0,`), 'Delete does not remove the formula after the popover closes');
    await checkEdit(page, nudged, removed, `r11-4-delete-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });

  test(`after Insert of a new formula from its TeX popover, the formula is selected for the keys of the editor (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: LAYOUTS, n: 4 });
    await exec(page, 'insert.formula');
    await page.waitFor(`!!document.querySelector('${SHEET} textarea') && document.activeElement === document.querySelector('${SHEET} textarea')`);
    await type(page, 'E = mc^2');
    await sleep(300);
    await typeset(page);
    await tabTo(page, 'Insert');
    await enter(page);
    await page.waitFor(`!document.querySelector(${js(SHEET)})`);
    await frames(page);
    const inserted = await render(page);
    assert.match(inserted, /<div class="math">\\\[E = mc\^2\\\]<\/div>/);
    assert.deepEqual(await selected(page), ['math'], 'the new formula is not selected');
    await press(page, 'Delete');
    await frames(page);
    assert.equal(await render(page), page.source, 'Delete does not remove the new formula');
    await undo(page);
    assert.equal(await render(page), inserted);
    await undo(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}

// a marquee from the empty slide held at the top edge of a zoomed canvas scrolls it, with the start
// corner of the marquee kept on its point of the slide, and selects what it covers at the release
const CANVAS = `(() => { const c = document.querySelector('.beeson-edit-canvas'), v = window.BeesonEditorShell.stage.viewport; return { x: c.scrollLeft, y: c.scrollTop, zoomed: c.classList.contains('zoomed'), left: v.left, top: v.top, width: v.width, height: v.height }; })()`;
for (const platform of PLATFORMS) {
  test(`a marquee held at the edge of a zoomed canvas scrolls it, and selects what it covers at the release (${platform})`, async (t) => {
    // a window 600 px high, in which the canvas at Actual Size scrolls the display out of view
    const page = await load(t, platform, { deck: LAYOUTS, n: MATH, size: { width: 1600, height: 600 } });
    await exec(page, 'zoom.actual');
    await frames(page);
    // an empty point of the slide under the list, with the canvas scrolled to put the point 300 px
    // right of its left edge and the slide y of 560 px, under the display, at its top edge or as near
    // as the canvas scrolls
    const start = { x: 640, y: 1000 };
    const at = await page.evaluate(`(() => {
      const c = document.querySelector('.beeson-edit-canvas'), st = window.BeesonEditorShell.stage, v = st.viewport;
      c.scrollLeft += st.toScreen(${js(start)}).x - v.left - 300;
      c.scrollTop += st.toScreen({ x: 0, y: 560 }).y - v.top;
      st.place();
      return st.toScreen(${js(start)});
    })()`);
    await frames(page);
    const before = await page.evaluate(CANVAS);
    assert.ok(before.zoomed, 'the canvas is not zoomed at Actual Size');
    const math0 = await rectOf(page, '.reveal section.present div.math');
    assert.ok(math0.top + math0.height < before.top, `the display is in view before the marquee, at ${js(math0)}`);
    // the marquee to 4 px under the top of the canvas, held there for a second with small moves
    const edge = before.top + 4;
    await drag(page, at, { dx: 0, dy: edge - at.y, hold: true });
    for (let i = 0; i < 12; i++) {
      await mouse(page, 'mouseMoved', at.x, edge - (i % 2));
      await sleep(100);
    }
    await mouse(page, 'mouseMoved', at.x, edge);
    await frames(page);
    const held = await page.evaluate(CANVAS);
    assert.ok(held.y < before.y - 50, `the canvas is scrolled from ${before.y} to ${held.y} while the marquee is held at its top edge`);
    // the start corner stays on its point of the slide, and the marquee reaches the pointer
    const corner = await page.evaluate(`window.BeesonEditorShell.stage.toScreen(${js(start)})`);
    const box = await rectOf(page, '.beeson-marquee');
    assert.ok(box && near(box.top + box.height, corner.y) && near(box.left, corner.x) && near(box.top, edge), `the marquee is ${js(box)}, from the start corner ${js(corner)} to the pointer at ${edge}`);
    // the elements covered by the marquee are selected at the release
    await mouse(page, 'mouseReleased', at.x, edge);
    await frames(page);
    const picked = await selected(page);
    assert.ok(picked.includes('ol'), `the marquee does not select the list: ${js(picked)}`);
    assert.ok(picked.includes('math'), `the marquee does not select the display, which it covers after the scroll: ${js(picked)}`);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}
