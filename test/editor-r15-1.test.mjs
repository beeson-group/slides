// regression tests of R15.1 on both platforms, after finding 1 and finding 5 of the judge opus in
// round 6: a figure with a caption is turned as one object, with its frame, its grips, and its
// rotate handle turned with it, and its grips still resize it. the fields X and Y of a turned
// figure, text, or group give its unturned box, a turned figure is checked against the texts by
// its turned picture, and a group selected with another object is drawn as one frame

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const DECK = 'test-deck.html';
// the index of the figures slide in index.html
const FIGURES = 4;
const IMG = 'section.present figure img.for-light';
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
const near = (a, b, d) => Math.abs(a - b) <= d;
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const mouse = (page, type, x, y, extra = {}) => page.send('Input.dispatchMouseEvent', { type, x, y, ...extra });

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
const fields = async (page) => ({ x: await fieldValue(page, 'x'), y: await fieldValue(page, 'y'), w: await fieldValue(page, 'width'), h: await fieldValue(page, 'height') });

async function load(t, platform) {
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
  await page.evaluate(`Reveal.slide(${FIGURES})`);
  await frames(page);
  return page;
}

// an undo gives the text before and a redo the edited text byte for byte, and the saved text is
// opened again without problems
async function checkEdit(page, name, before) {
  const edited = await render(page);
  assert.notEqual(edited, before);
  await undo(page);
  assert.equal(await render(page), before);
  await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, name);
  assert.equal(text, edited);
}

// the shown frames of the selection, the grips at their centers with their cursors, and the
// center of the rotate handle, in CSS px of the viewport
const overlay = (page) => page.evaluate(`(() => {
  const shown = (el) => !el.hidden && el.getClientRects().length > 0;
  const mid = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const frames = [...document.querySelectorAll('.beeson-frame.selected, .beeson-frame.union')].filter(shown).map((f) => ({ union: f.classList.contains('union'), width: f.offsetWidth, height: f.offsetHeight, rotate: f.style.rotate, center: mid(f) }));
  const grips = Object.fromEntries([...document.querySelectorAll('.beeson-grip')].filter(shown).map((g) => [g.dataset.handle, { ...mid(g), cursor: getComputedStyle(g).cursor }]));
  const rotor = [...document.querySelectorAll('.beeson-rotor')].find(shown);
  const slides = document.querySelector('.reveal .slides');
  return { frames, grips, rotor: rotor ? mid(rotor) : null, scale: slides.getBoundingClientRect().width / slides.offsetWidth };
})()`);
const angle = (a, b) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const sameAngle = (a, b, d = 1.5) => Math.abs(((a - b + 540) % 360) - 180) <= d;

// the frame of the figure, its grips, and its rotate handle all turned by deg, with the frame as
// large as the fields W and H give it, and each grip with the cursor of its turned direction
async function assertTurnedFrame(page, deg, size) {
  const o = await overlay(page);
  assert.equal(o.frames.length, 1, `the frames are ${js(o.frames)}`);
  const [f] = o.frames;
  assert.equal(f.rotate, `${deg}deg`, `the frame is ${js(f)}, not turned by ${deg}°`);
  // the frame is drawn 8 px outside the box of the figure
  assert.ok(near(f.width, size.w * o.scale + 16, 3) && near(f.height, size.h * o.scale + 16, 3), `the frame ${js(f)} against the fields ${js(size)} at the scale ${o.scale}`);
  const g = o.grips;
  for (const h of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) assert.ok(g[h], `the grip ${h} is not drawn: ${js(g)}`);
  assert.ok(sameAngle(angle(g.nw, g.ne), deg), `the top edge from ${js(g.nw)} to ${js(g.ne)} is not turned by ${deg}°`);
  assert.ok(sameAngle(angle(g.nw, g.sw), deg + 90), `the left edge from ${js(g.nw)} to ${js(g.sw)} is not turned by ${deg}°`);
  assert.ok(near(dist(g.nw, g.ne), f.width, 3) && near(dist(g.nw, g.sw), f.height, 3), `the grips ${js(g)} are not at the corners of the frame ${js(f)}`);
  assert.ok(o.rotor && sameAngle(angle(g.n, o.rotor), deg - 90, 3), `the rotate handle at ${js(o.rotor)} is not above the grip n at ${js(g.n)} on the turned frame`);
  // the cursor of a grip at its direction turned by deg, to the nearest eighth of a turn
  const CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
  const DIRS = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 };
  for (const [h, d] of Object.entries(DIRS)) {
    const want = CURSORS[Math.round((((d + deg) % 360) + 360) % 360 / 45) % 4];
    assert.equal(g[h].cursor, want, `the grip ${h} at ${deg}° has the cursor ${g[h].cursor}`);
  }
}

// a drag of the rotate handle about the center of the figure by the turn of deg degrees, released
async function dragRotor(page, deg) {
  const o = await overlay(page);
  const c = o.frames[0].center;
  const r = Math.hypot(o.rotor.x - c.x, o.rotor.y - c.y), from = Math.atan2(o.rotor.y - c.y, o.rotor.x - c.x);
  await mouse(page, 'mouseMoved', o.rotor.x, o.rotor.y);
  await mouse(page, 'mousePressed', o.rotor.x, o.rotor.y, { button: 'left', buttons: 1, clickCount: 1 });
  let at = o.rotor;
  for (let i = 1; i <= 10; i++) {
    const a = from + ((deg * Math.PI) / 180) * (i / 10);
    at = { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
    await mouse(page, 'mouseMoved', at.x, at.y, { button: 'left', buttons: 1 });
  }
  await mouse(page, 'mouseReleased', at.x, at.y, { button: 'left', buttons: 0, clickCount: 1 });
  await frames(page);
}

// the texts of the figures slide that are outlined as an overflow, and the message of the state
const overflow = async (page) => ({
  outlined: await page.evaluate(`[...Reveal.getCurrentSlide().querySelectorAll('.beeson-overflow')].map((el) => el.localName)`),
  message: (await page.evaluate('window.BeesonEditor.status()')).message,
});

// the paragraph and the figure of the figures slide made one group with the key of Group
async function groupOnFigures(page, platform) {
  await click(page, IMG);
  const p = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(':scope > p').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
  await click(page, p, { modifiers: 'Shift' });
  await press(page, platform === 'mac' ? 'Alt+Mod+G' : 'Mod+G');
  await frames(page);
}

for (const platform of PLATFORMS) {
  // finding 1: at an angle of 30 typed into the field, the frame was the upright box of the
  // figure, about 908 slide px wide, with upright grips
  test(`a figure with a caption turned by the field Angle is turned as one object, with its frame, grips, and rotate handle (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, IMG);
    const rest = await fields(page);
    await typeField(page, 'angle', 30);
    assert.equal(await fieldValue(page, 'angle'), 30);
    const edited = await render(page);
    assert.match(edited, /<figure class="figure-box" style="[^"]*\brotate: 30deg[^"]*">/, 'the figure is not turned as one object');
    assert.doesNotMatch(edited, /<img [^>]*rotate/, 'a picture of the figure is turned by itself');
    const caption = await page.evaluate(`getComputedStyle(document.querySelector(${js(IMG)}).closest('figure')).rotate`);
    assert.equal(caption, '30deg');
    const size = await fields(page);
    assert.deepEqual({ w: size.w, h: size.h }, { w: rest.w, h: rest.h }, `W and H at 0° ${js(rest)} and at 30° ${js(size)}`);
    await assertTurnedFrame(page, 30, size);
    await checkEdit(page, `r15-1-angle-${platform}.html`, page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`a figure with a caption turned by its rotate handle is framed turned, and its corner grip resizes it with the corner across kept (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, IMG);
    await dragRotor(page, 40);
    const deg = await fieldValue(page, 'angle');
    assert.ok(deg >= 35 && deg <= 45, `the figure is turned to ${deg}°`);
    const turned = await render(page);
    assert.match(turned, new RegExp(`<figure class="figure-box" style="[^"]*\\brotate: ${deg}deg[^"]*">`), 'the figure is not turned as one object');
    const before = await fields(page);
    await assertTurnedFrame(page, deg, before);
    // the grip se dragged outward along the turned diagonal of the frame
    const o = await overlay(page);
    const { nw, se } = o.grips;
    const u = { x: (se.x - nw.x) / dist(nw, se), y: (se.y - nw.y) / dist(nw, se) };
    await mouse(page, 'mouseMoved', se.x, se.y);
    await mouse(page, 'mousePressed', se.x, se.y, { button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 10; i++) await mouse(page, 'mouseMoved', se.x + 6 * i * u.x, se.y + 6 * i * u.y, { button: 'left', buttons: 1 });
    await frames(page);
    const readout = await page.evaluate(`(() => { const o = document.querySelector('.beeson-offset'); return o && !o.hidden ? o.textContent : ''; })()`);
    await mouse(page, 'mouseReleased', se.x + 60 * u.x, se.y + 60 * u.y, { button: 'left', buttons: 0, clickCount: 1 });
    await frames(page);
    const after = await fields(page);
    assert.ok(after.w > before.w + 20 && after.h > before.h + 20, `the fields are ${js(after)} after the resize, against ${js(before)}`);
    const m = /w:\s*(\d+)\s*px\s*h:\s*(\d+)\s*px/.exec(readout);
    assert.ok(m && near(Number(m[1]), after.w, 1) && near(Number(m[2]), after.h, 1), `the readout ${js(readout)} against the fields ${js(after)}`);
    assert.equal(await fieldValue(page, 'angle'), deg);
    await assertTurnedFrame(page, deg, after);
    const kept = (await overlay(page)).grips.nw;
    assert.ok(dist(kept, nw) <= 3, `the corner nw moved from ${js(nw)} to ${js(kept)}`);
    await checkEdit(page, `r15-1-resize-${platform}.html`, turned);
    assert.deepEqual(errors(page), []);
  });

  // finding 1: X and Y read 1060 and 58 at 30°, against 1200 and 160 at 0°
  test(`X and Y of a turned figure and text are those of the unturned box, and a typed X or Y reads back (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, IMG);
    const rest = await fields(page);
    await typeField(page, 'angle', 30);
    const figure = await fields(page);
    assert.ok(near(figure.x, rest.x, 1) && near(figure.y, rest.y, 1), `the figure at 0° ${js(rest)} and at 30° ${js(figure)}`);
    let last = await render(page);
    for (const [id, v] of [['x', 1100], ['y', 100]]) {
      last = await render(page);
      await typeField(page, id, v);
      assert.equal(await fieldValue(page, id), v, `a typed ${id} of ${v}`);
    }
    assert.equal(await fieldValue(page, 'angle'), 30);
    await checkEdit(page, `r15-1-position-${platform}.html`, last);

    await click(page, 'section.present > h2');
    await press(page, 'Escape');
    await frames(page);
    const h2 = await fields(page);
    await typeField(page, 'angle', 30);
    const turnedH2 = await fields(page);
    assert.ok(near(turnedH2.x, h2.x, 1) && near(turnedH2.y, h2.y, 1), `the heading at 0° ${js(h2)} and at 30° ${js(turnedH2)}`);
    assert.deepEqual(errors(page), []);
  });

  test(`X and Y of a turned group are those of its unturned frame, and a typed X reads back (${platform})`, async (t) => {
    const page = await load(t, platform);
    await groupOnFigures(page, platform);
    const rest = await fields(page);
    await typeField(page, 'angle', 30);
    const group = await fields(page);
    assert.ok(near(group.x, rest.x, 1) && near(group.y, rest.y, 1), `the group at 0° ${js(rest)} and at 30° ${js(group)}`);
    const last = await render(page);
    await typeField(page, 'x', 200);
    assert.equal(await fieldValue(page, 'x'), 200);
    await checkEdit(page, `r15-1-group-x-${platform}.html`, last);
    assert.deepEqual(errors(page), []);
  });

  // finding 1: after the turn by 30 degrees, the title bar read "5 texts lie over a figure". an
  // overlap is reported only after a change of the layout or an insert, hence the layout of the
  // slide is changed and changed back before each look at the report
  test(`a figure turned by the field Angle or by its rotate handle is not reported over the texts that its picture does not cover (${platform})`, async (t) => {
    const page = await load(t, platform);
    const checked = async () => {
      await exec(page, 'slide.layout.wide');
      await exec(page, 'slide.layout.content');
      await frames(page);
      await click(page, IMG);
      return overflow(page);
    };
    await click(page, IMG);
    assert.deepEqual((await overflow(page)).outlined, []);
    await typeField(page, 'angle', 30);
    let s = await checked();
    assert.equal(await fieldValue(page, 'angle'), 30, 'the change of the layout took the angle off');
    assert.deepEqual(s.outlined, [], `at 30° by the field: ${js(s)}`);
    assert.doesNotMatch(s.message, /covers?/);
    await typeField(page, 'angle', 0);
    await dragRotor(page, 38);
    assert.ok((await fieldValue(page, 'angle')) > 30, 'the rotate handle did not turn the figure');
    s = await checked();
    assert.deepEqual(s.outlined, [], `after the rotate handle: ${js(s)}`);
    assert.doesNotMatch(s.message, /covers?/);
    // the turned figure moved over the paragraph is reported at the next check
    await typeField(page, 'x', 200);
    s = await checked();
    assert.ok(s.outlined.includes('p'), `the turned figure over the paragraph: ${js(s)}`);
    assert.match(s.message, /A picture covers \d+ texts?/);
    assert.deepEqual(errors(page), []);
  });

  // finding 5: the group of the paragraph and the figure with the heading was drawn as three frames
  test(`a group selected with another object is drawn as one frame, beside the frame of the other object (${platform})`, async (t) => {
    const page = await load(t, platform);
    await groupOnFigures(page, platform);
    const alone = (await overlay(page)).frames;
    assert.equal(alone.length, 1, `the group alone is drawn as ${js(alone)}`);
    const h2 = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(':scope > h2').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
    await click(page, h2, { modifiers: 'Shift' });
    await frames(page);
    assert.equal((await page.evaluate('window.BeesonEditor.selection().length')), 3);
    const both = (await overlay(page)).frames;
    assert.equal(both.length, 2, `the group with the heading is drawn as ${js(both)}`);
    const union = both.find((f) => f.union);
    assert.ok(union && near(union.width, alone[0].width, 2) && near(union.height, alone[0].height, 2), `the frame of the group ${js(union)} against ${js(alone[0])}`);
    assert.deepEqual(errors(page), []);
  });

  // item 5: a typed Height of 700 of a group turned by 180 degrees read 709, since the paragraph
  // rewrapped by the scale kept the upright top of its box, which is its bottom on the screen
  test(`a typed Height of a group turned by 180 degrees reads back as typed (${platform})`, async (t) => {
    const page = await load(t, platform);
    await groupOnFigures(page, platform);
    await typeField(page, 'angle', 180);
    const last = await render(page);
    await typeField(page, 'height', 700);
    assert.equal(await fieldValue(page, 'height'), 700);
    await checkEdit(page, `r15-1-group-height-${platform}.html`, last);
    assert.deepEqual(errors(page), []);
  });
}
