// regression tests of R18.5 on both platforms, after the finding C1 of the third review of round 7:
// in a deck in which only the image of one mode of a figure has a rotate, an undo of a typed Angle,
// of Reset Rotation, or of a turn by the rotate handle gives each image of the pair its own place
// back, and thus the opened text byte for byte

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, type } from './helpers/editor.mjs';

const DECK = 'index.html';
// the index of the figures slide in index.html
const FIGURES = 4;
const IMG = 'section.present figure img.for-light';
const PLATFORMS = ['mac', 'other'];
const STOCK = readFileSync(DECK, 'utf8');
// the demo deck with the image of the light mode of the figure turned by 20 degrees, and the
// image of the dark mode upright, as a deck edited by hand can have them
const ONE = STOCK.replace('light version">', 'light version" style="rotate: 20deg">');
const PREP = `document.querySelector('figure.zone > img.for-light').setAttribute('style', 'rotate: 20deg')`;

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

// a drag of the shown rotate handle by deg degrees about the center of the frame of the
// selection, with the button held at the end where hold is set
async function dragRotor(page, deg, hold = false) {
  const o = await page.evaluate(`(() => {
    const mid = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const shown = (el) => !el.hidden && el.getClientRects().length > 0;
    return { c: mid([...document.querySelectorAll('.beeson-frame.union, .beeson-frame.selected')].find(shown)), r: mid([...document.querySelectorAll('.beeson-rotor')].find(shown)) };
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
  await frames(page);
  if (!hold) await mouse('mouseReleased', at.x, at.y, { button: 'left', buttons: 0, clickCount: 1 });
  await frames(page);
  return at;
}

// the style attributes of the two images of the figure in the text, dark first
const styles = async (page) => [...(await render(page)).matchAll(/<img class="for-(?:dark|light)"[^>]*>/g)].map((m) => /style="([^"]*)"/.exec(m[0])?.[1] ?? null);

for (const platform of PLATFORMS) {
  // C1: after a typed 0 and one undo, the image of the dark mode read style="rotate: 20deg"
  test(`an undo of a typed Angle or of Reset Rotation on a figure with one turned image gives back the opened text (${platform})`, async (t) => {
    const page = await load(t, platform, ONE, PREP);
    await click(page, IMG);
    assert.equal(await fieldValue(page, 'angle'), 20);
    assert.deepEqual(await styles(page), [null, 'rotate: 20deg']);
    for (const deg of [0, 30]) {
      await typeField(page, 'angle', deg);
      await undoes(page, ONE, `a typed ${deg}`);
      await undo(page);
      assert.deepEqual(await styles(page), [null, 'rotate: 20deg'], `the images after an undo of a typed ${deg}`);
    }
    await exec(page, 'arrange.resetRotation');
    await frames(page);
    assert.equal(await fieldValue(page, 'angle'), 0);
    await undoes(page, ONE, 'Reset Rotation');
    await undo(page);
    assert.deepEqual(await styles(page), [null, 'rotate: 20deg'], 'the images after an undo of Reset Rotation');
    assert.equal(await fieldValue(page, 'angle'), 20);
    assert.deepEqual(errors(page), []);
  });

  test(`an undo of a turn by the rotate handle of a figure with one turned image gives back the opened text (${platform})`, async (t) => {
    const page = await load(t, platform, ONE, PREP);
    await click(page, IMG);
    await dragRotor(page, 40);
    assert.notEqual(await fieldValue(page, 'angle'), 20);
    await undoes(page, ONE, 'a turn by the rotate handle');
    await undo(page);
    assert.deepEqual(await styles(page), [null, 'rotate: 20deg'], 'the images after an undo of the turn');
    assert.deepEqual(errors(page), []);
  });
}
