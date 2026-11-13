// regression tests of R16.1 on both platforms, after the findings G1 to G3 of the second review of
// round 7: a figure whose picture has a rotate of its own is made upright by a typed 0 and by Reset
// Rotation, the readout of a drag or a nudge of a turned element gives the corner of the fields X
// and Y, and a typed Width or Height of a turned group keeps its X and Y

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, type } from './helpers/editor.mjs';

const DECK = 'index.html';
// the index of the figures slide in index.html
const FIGURES = 4;
const IMG = 'section.present figure img.for-light';
const PLATFORMS = ['mac', 'other'];
const STOCK = readFileSync(DECK, 'utf8');
// the demo deck in the form that the editor saved before round 7, with both images of the figure
// turned by 20 degrees
const LEGACY = STOCK.replace('light version">', 'light version" style="rotate: 20deg">').replace('dark version">', 'dark version" style="rotate: 20deg">');

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
const exec = (page, id) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)})).then(() => true)`);
const enabled = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)}).enabled`);

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

// the editor on the demo deck at the figures slide, opened from text, with the script prep run on
// the page before the open
async function load(t, platform, text = STOCK, prep = '') {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&theme=light&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  if (prep) await page.evaluate(prep);
  page.source = text;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(text)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${FIGURES})`);
  await frames(page);
  return page;
}

// one undo gives the text before, and one redo the edited text, byte for byte
async function undoes(page, before, what) {
  const edited = await render(page);
  assert.notEqual(edited, before, `${what} did not change the text`);
  await undo(page);
  assert.equal(await render(page), before, `an undo of ${what}`);
  await redo(page);
  assert.equal(await render(page), edited, `a redo of ${what}`);
  return edited;
}

// the start tags of the figure and of its two images in the text, and the computed angles of the three
async function figureState(page) {
  const text = await render(page);
  const start = text.indexOf('<figure class="zone"');
  const tags = text.slice(start, text.indexOf('</figure>', start)).match(/<(figure|img)\b[^>]*>/g);
  const turned = await page.evaluate(`(() => { const f = document.querySelector('section.present figure'); return [f, ...f.querySelectorAll('img')].map((el) => getComputedStyle(el).rotate); })()`);
  return { tags, turned };
}

// the figure and both of its images upright, in the text and on the page, with the fields of the
// upright figure rest and Reset Rotation dimmed
async function assertUpright(page, rest) {
  const s = await figureState(page);
  for (const tag of s.tags) assert.doesNotMatch(tag, /rotate/, `a part of the figure is turned: ${js(s.tags)}`);
  assert.deepEqual(s.turned, ['none', 'none', 'none'], `the figure and its images are drawn at ${js(s.turned)}`);
  assert.equal(await fieldValue(page, 'angle'), 0);
  const f = await fields(page);
  for (const k of ['x', 'y', 'w', 'h']) assert.ok(near(f[k], rest[k], 1), `the fields ${js(f)} against the upright figure ${js(rest)}`);
  assert.equal(await enabled(page, 'arrange.resetRotation'), false);
}

// the x and y of the readout of a move, at the frame or at the pointer, or null where it is hidden
async function readout(page) {
  const text = await page.evaluate(`(() => { const o = document.querySelector('.beeson-offset'); return o && !o.hidden && o.getClientRects().length ? o.textContent : ''; })()`);
  const m = /x:\s*(-?\d+)\s*px\s+y:\s*(-?\d+)\s*px/.exec(text);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

// a nudge by ArrowRight, whose readout gives the fields X and Y after it
async function assertNudgeReadout(page, what) {
  await page.evaluate('document.activeElement?.blur()');
  await press(page, 'ArrowRight');
  await frames(page);
  const r = await readout(page);
  const f = await fields(page);
  assert.ok(r && near(r.x, f.x, 1) && near(r.y, f.y, 1), `the readout of a nudge of ${what} is ${js(r)}, and the fields read ${js(f)}`);
}

// a drag from the point at by -100 and 30 screen px, whose readout before the release gives the
// fields X and Y after the release
async function assertDragReadout(page, at, what) {
  await drag(page, at, { dx: -100, dy: 30, hold: true });
  const r = await readout(page);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x - 100, y: at.y + 30, button: 'left', clickCount: 1 });
  await frames(page);
  const f = await fields(page);
  assert.ok(r && near(r.x, f.x, 1) && near(r.y, f.y, 1), `the readout of a drag of ${what} is ${js(r)}, and the fields read ${js(f)}`);
}

const centerOf = (page, selector) => page.evaluate(`(() => { const r = document.querySelector(${js(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

// the paragraph and the figure of the figures slide made one group with the key of Group
async function groupOnFigures(page, platform) {
  await click(page, IMG);
  const p = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(':scope > p').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
  await click(page, p, { modifiers: 'Shift' });
  await press(page, platform === 'mac' ? 'Alt+Mod+G' : 'Mod+G');
  await frames(page);
}

// a drag of the shown rotate handle by deg degrees about the center of the frame of the selection
async function dragRotor(page, deg) {
  const o = await page.evaluate(`(() => {
    const mid = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const shown = (el) => !el.hidden && el.getClientRects().length > 0;
    return { c: mid([...document.querySelectorAll('.beeson-frame.selected')].find(shown)), r: mid([...document.querySelectorAll('.beeson-rotor')].find(shown)) };
  })()`);
  const mouse = (type, x, y, extra) => page.send('Input.dispatchMouseEvent', { type, x, y, ...extra });
  const radius = Math.hypot(o.r.x - o.c.x, o.r.y - o.c.y), from = Math.atan2(o.r.y - o.c.y, o.r.x - o.c.x);
  await mouse('mouseMoved', o.r.x, o.r.y, {});
  await mouse('mousePressed', o.r.x, o.r.y, { button: 'left', buttons: 1, clickCount: 1 });
  let at = o.r;
  for (let i = 1; i <= 10; i++) {
    const a = from + ((deg * Math.PI) / 180) * (i / 10);
    at = { x: o.c.x + radius * Math.cos(a), y: o.c.y + radius * Math.sin(a) };
    await mouse('mouseMoved', at.x, at.y, { button: 'left', buttons: 1 });
  }
  await mouse('mouseReleased', at.x, at.y, { button: 'left', buttons: 0, clickCount: 1 });
  await frames(page);
}

// the fields of the upright figure of the demo deck
async function uprightFields(t, platform) {
  const page = await load(t, platform);
  await click(page, IMG);
  const rest = await fields(page);
  await page.close();
  return rest;
}

for (const platform of PLATFORMS) {
  // G1: a typed 0 left the figure at rotate: 340deg with its images at 20deg, X and Y at 956 and
  // -31, and Reset Rotation dimmed
  test(`a figure whose images are turned in the file is made upright by a typed 0 and by Reset Rotation (${platform})`, async (t) => {
    const rest = await uprightFields(t, platform);
    const page = await load(t, platform, LEGACY, `document.querySelectorAll('figure.zone > img').forEach((i) => i.setAttribute('style', 'rotate: 20deg'))`);
    await click(page, IMG);
    assert.equal(await fieldValue(page, 'angle'), 20, 'the angle of the figure at the open');
    assert.equal(await enabled(page, 'arrange.resetRotation'), true);

    await typeField(page, 'angle', 0);
    await assertUpright(page, rest);
    await undoes(page, LEGACY, 'a typed 0');
    await undo(page);
    assert.equal(await fieldValue(page, 'angle'), 20, 'the angle of the figure after the undo');

    await typeField(page, 'angle', 30);
    const s = await figureState(page);
    assert.match(s.tags[0], /rotate: 30deg/, `the figure is not turned by 30 degrees: ${js(s.tags)}`);
    for (const tag of s.tags.slice(1)) assert.doesNotMatch(tag, /rotate/, `an image keeps its angle: ${js(s.tags)}`);
    assert.equal(await fieldValue(page, 'angle'), 30);
    const thirty = await undoes(page, LEGACY, 'a typed 30');
    assert.equal(await enabled(page, 'arrange.resetRotation'), true);
    await exec(page, 'arrange.resetRotation');
    await frames(page);
    await assertUpright(page, rest);
    await undoes(page, thirty, 'Reset Rotation');
    assert.deepEqual(errors(page), []);
  });

  // G1: the rotate handle of the figure also gives the angle of its images to the figure
  test(`a figure whose images are turned in the file is turned by its rotate handle as one object (${platform})`, async (t) => {
    const page = await load(t, platform, LEGACY, `document.querySelectorAll('figure.zone > img').forEach((i) => i.setAttribute('style', 'rotate: 20deg'))`);
    await click(page, IMG);
    await dragRotor(page, 40);
    const deg = await fieldValue(page, 'angle');
    assert.ok(deg >= 55 && deg <= 65, `the figure is turned to ${deg} degrees`);
    const s = await figureState(page);
    assert.match(s.tags[0], new RegExp(`rotate: ${deg}deg`), `the figure is not turned by ${deg} degrees: ${js(s.tags)}`);
    for (const tag of s.tags.slice(1)) assert.doesNotMatch(tag, /rotate/, `an image keeps its angle: ${js(s.tags)}`);
    assert.deepEqual(s.turned.slice(1), ['none', 'none']);
    await undoes(page, LEGACY, 'a turn by the rotate handle');
    assert.deepEqual(errors(page), []);
  });

  // G1: on the demo deck, a picture turned alone to 50 and its figure then typed to 0 left the
  // figure at rotate: 310deg with the images at 50deg
  test(`a figure whose picture was turned alone by a second click is made upright by a typed 0 (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, IMG);
    const rest = await fields(page);
    await click(page, IMG);
    await typeField(page, 'angle', 50);
    let s = await figureState(page);
    assert.doesNotMatch(s.tags[0], /rotate/, `the figure is turned with its picture selected alone: ${js(s.tags)}`);
    for (const tag of s.tags.slice(1)) assert.match(tag, /rotate: 50deg/, `a picture selected alone is not turned alone: ${js(s.tags)}`);
    const fifty = await undoes(page, STOCK, 'a typed 50 of the picture');

    await click(page, 'section.present > h2');
    await press(page, 'Escape');
    await click(page, IMG);
    await frames(page);
    assert.equal(await page.evaluate('window.BeesonEditor.selection()[0]?.localName'), 'figure');
    assert.equal(await fieldValue(page, 'angle'), 50);
    await typeField(page, 'angle', 0);
    await assertUpright(page, rest);
    await undoes(page, fifty, 'a typed 0 of the figure');
    s = await figureState(page);
    assert.deepEqual(s.turned, ['none', 'none', 'none']);
    assert.deepEqual(errors(page), []);
  });

  // G2: at 30 degrees, a nudge of the figure read x 1023 and y 68 against the fields 1201 and 160,
  // and a drag read x 843 and y 120 against 1021 and 212
  test(`the readout of a nudge and of a drag of a turned figure and text gives the fields X and Y (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, IMG);
    for (const deg of [0, 30]) {
      await typeField(page, 'angle', deg);
      await assertNudgeReadout(page, `the figure at ${deg} degrees`);
      await assertDragReadout(page, await centerOf(page, IMG), `the figure at ${deg} degrees`);
    }
    await click(page, 'section.present > h2');
    await press(page, 'Escape');
    await frames(page);
    await typeField(page, 'angle', 30);
    await assertNudgeReadout(page, 'the heading at 30 degrees');
    assert.deepEqual(errors(page), []);
  });

  test(`the readout of a nudge and of a drag of a turned group gives the fields X and Y of its frame (${platform})`, async (t) => {
    const page = await load(t, platform);
    await groupOnFigures(page, platform);
    for (const deg of [0, 30]) {
      await typeField(page, 'angle', deg);
      await assertNudgeReadout(page, `the group at ${deg} degrees`);
      await assertDragReadout(page, await centerOf(page, IMG), `the group at ${deg} degrees`);
    }
    assert.deepEqual(errors(page), []);
  });

  // G3: at 180 degrees, W 1500 moved the group from X 120 and Y 160 to X 300 and Y 277, and H 700
  // moved it to X 551 and Y 334
  test(`a typed Width or Height of a turned group keeps its X and Y (${platform})`, async (t) => {
    const page = await load(t, platform);
    await groupOnFigures(page, platform);
    for (const deg of [30, 90, 180]) {
      await typeField(page, 'angle', deg);
      const rest = await fields(page);
      for (const [id, v] of [['width', 1500], ['height', 700]]) {
        const before = await render(page);
        await typeField(page, id, v);
        const f = await fields(page);
        assert.ok(near(f.x, rest.x, 1) && near(f.y, rest.y, 1), `a typed ${id} at ${deg} degrees moved the group from ${js(rest)} to ${js(f)}`);
        assert.ok(near(f[id === 'width' ? 'w' : 'h'], v, 1), `a typed ${id} of ${v} at ${deg} degrees reads ${js(f)}`);
        await undoes(page, before, `a typed ${id} at ${deg} degrees`);
      }
      await typeField(page, 'width', rest.w);
      await typeField(page, 'height', rest.h);
    }
    assert.deepEqual(errors(page), []);
  });
}
