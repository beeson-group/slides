// regression tests of R19.8 on both platforms, after the findings D19 to D21 of the fourth review
// of round 7: a group with a member turned by itself is turned and reset back to the grouped file,
// a drag of the rotate handle cancelled by Esc does not change the place that a later reset gives
// back, and Esc cancels a drag of a row of the Object List and of a thumbnail of the navigator

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

// the paragraph and the figure of the figures slide made one group with the key of Group
async function groupOnFigures(page, platform) {
  await click(page, IMG);
  const p = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(':scope > p').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
  await click(page, p, { modifiers: 'Shift' });
  await press(page, platform === 'mac' ? 'Alt+Mod+G' : 'Mod+G');
  await frames(page);
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

// the label of the entry that Undo takes back, or undefined
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo')?.label`);

// the figure of the figures slide turned by 20 degrees by itself, then grouped with the paragraph
async function groupTurnedFigure(page, platform) {
  await click(page, IMG);
  await typeField(page, 'angle', 20);
  await groupOnFigures(page, platform);
}

// Esc pressed during a drag of the rotate handle by 40 degrees, then the release
async function cancelledTurn(page) {
  const at = await dragRotor(page, 40, true);
  await press(page, 'Escape');
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', buttons: 0, clickCount: 1 });
  await frames(page);
}

for (const platform of PLATFORMS) {
  // D19: the figure turned by 20 degrees and grouped read translate: 27px 5px, and 26px 6px after
  // the turns to 30 and 75 and Reset Rotation
  test(`a group with a member turned by itself, turned by the field or by its rotate handle and reset, gives back the grouped file (${platform})`, async (t) => {
    const page = await load(t, platform);
    await groupTurnedFigure(page, platform);
    const grouped = await render(page);
    assert.match(grouped, /<figure class="zone" style="rotate: 20deg[^"]*" data-group/);
    await typeField(page, 'angle', 30);
    await typeField(page, 'angle', 75);
    const turned = await render(page);
    await exec(page, 'arrange.resetRotation');
    await frames(page);
    assert.equal(await render(page), grouped, 'Reset Rotation after the typed 30 and 75');
    await undoes(page, turned, 'Reset Rotation');
    await undo(page);
    await undo(page);
    await undo(page);
    assert.equal(await render(page), grouped);
    await dragRotor(page, 30);
    await dragRotor(page, 45);
    await exec(page, 'arrange.resetRotation');
    await frames(page);
    assert.equal(await render(page), grouped, 'Reset Rotation after the turns by the rotate handle');
    assert.deepEqual(errors(page), []);
  });

  // D20: Esc in a drag of the rotate handle after a typed 30 left translate: 1px -1px after Reset
  // Rotation
  for (const own of [false, true]) {
    test(`a drag of the rotate handle cancelled by Esc does not change the place that Reset Rotation gives back${own ? ', with a member turned by itself' : ''} (${platform})`, async (t) => {
      const page = await load(t, platform);
      if (own) await groupTurnedFigure(page, platform);
      else await groupOnFigures(page, platform);
      const grouped = await render(page);
      await typeField(page, 'angle', 30);
      const thirty = await render(page);
      const label = await undoLabel(page);
      await cancelledTurn(page);
      assert.equal(await render(page), thirty, 'the text after Esc');
      assert.equal(await undoLabel(page), label);
      await exec(page, 'arrange.resetRotation');
      await frames(page);
      assert.equal(await render(page), grouped, 'Reset Rotation after the cancelled drag');
      await undoes(page, thirty, 'Reset Rotation');
      assert.deepEqual(errors(page), []);
    });
  }

  // D21: after Esc the drop line was still shown, and the release wrote the Reorder
  test(`Esc during a drag of a row of the Object List cancels it, and the release leaves the order and the file (${platform})`, async (t) => {
    const page = await load(t, platform);
    await press(page, platform === 'mac' ? 'Mod+Shift+L' : 'Alt+F10');
    await frames(page);
    const ROW = '.beeson-edit-objects .row';
    const names = () => page.evaluate(`[...document.querySelectorAll(${js(ROW)})].map((r) => r.querySelector('.name')?.textContent)`);
    const state = () => page.evaluate(`(() => { const d = document.querySelector('.beeson-edit-objects .drop'); return { drop: !!d && !d.hidden, dragged: document.querySelectorAll('.beeson-edit-objects .row.dragged').length }; })()`);
    const rows = await names();
    assert.ok(rows.length >= 3, `the rows are ${js(rows)}`);
    const box = (n) => page.evaluate(`(() => { const r = document.querySelectorAll(${js(ROW)})[${n}].getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2, bottom: r.bottom }; })()`);
    const a = await box(0), z = await box(rows.length - 1);
    const label = await undoLabel(page);
    await drag(page, a, { dy: z.bottom + 10 - a.y, steps: 8, hold: true });
    assert.deepEqual(await state(), { drop: true, dragged: 1 }, 'the drag of the row did not start');
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await state(), { drop: false, dragged: 0 }, 'the drag after Esc');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: a.x, y: z.bottom + 10, button: 'left', clickCount: 1 });
    await frames(page);
    assert.deepEqual(await names(), rows);
    assert.equal(await undoLabel(page), label);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  // a guard: the navigator already ends the drag of a thumbnail at Esc
  test(`Esc during a drag of a thumbnail of the navigator cancels it, and the release leaves the file (${platform})`, async (t) => {
    const page = await load(t, platform);
    const THUMB = '.beeson-edit-nav .rows .row';
    const n = await page.evaluate(`document.querySelectorAll(${js(THUMB)}).length`);
    assert.ok(n >= 4, `the navigator shows ${n} thumbnails`);
    const box = (i) => page.evaluate(`(() => { const r = document.querySelectorAll(${js(THUMB)})[${i}].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; })()`);
    const a = await box(1), z = await box(3);
    const label = await undoLabel(page);
    await drag(page, a, { dy: z.y + z.h / 2 - a.y, steps: 8, hold: true });
    await press(page, 'Escape');
    await frames(page);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: a.x, y: z.y + z.h / 2, button: 'left', clickCount: 1 });
    await frames(page);
    assert.equal(await undoLabel(page), label);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}
