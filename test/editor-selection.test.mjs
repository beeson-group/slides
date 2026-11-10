// the selection on the canvas, driven with trusted input: a click on the border of a block or on a
// figure selects it, Shift and the command modifier add and remove, a marquee and Select All select
// several elements, Esc, Return, and Tab move between the states, a drag of several elements and a
// resize by a handle are one entry of the history each, and a press on the chrome keeps the
// selection

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { launch } from '../scripts/chrome.mjs';
import { click, drag, editorPage } from './helpers/editor.mjs';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// the slide of the demo deck with a paragraph and a figure in a zone
async function figureSlide(page) {
  await page.evaluate(`(() => { const img = document.querySelector('.reveal .slides section .zone > img'); Reveal.slide(Reveal.getIndices(img.closest('section')).h); })()`);
  await sleep(200);
}

// the boxes of the solid frames shown, in CSS pixels of the viewport
const shownFrames = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-frame.selected')].filter((f) => !f.hidden && f.getBoundingClientRect().width).map((f) => { const r = f.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; })`);
const boxOf = (page, selector) => page.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; })()`);
// whether frame is drawn around box, 0 to 8 px outside it
const around = (frame, box) => ['left', 'top'].every((k) => box[k] - frame[k] >= -1 && box[k] - frame[k] <= 9) && ['right', 'bottom'].every((k) => frame[k] - box[k] >= -1 && frame[k] - box[k] <= 9);

test('a click on a button of the status bar keeps the selected figure', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  await figureSlide(page);
  await click(page, '.reveal section.present .zone > img');
  const zone = await boxOf(page, '.reveal section.present .zone');
  assert.ok((await shownFrames(page)).some((f) => around(f, zone)), 'the figure is not selected by a click');
  const steps = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Steps'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, steps);
  // the pane of the steps narrows the slide, hence the figure is measured again
  await sleep(100);
  const after = await boxOf(page, '.reveal section.present .zone');
  assert.ok((await shownFrames(page)).some((f) => around(f, after)), 'the selection is cleared by a click on Steps');
  assert.deepEqual(page.errors, []);
});

test('during a drag of a figure, the solid frame is on the figure and not on the block selected before', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  await figureSlide(page);
  // the paragraph is selected as a block, by a click into it and Esc
  await page.evaluate(`document.querySelector('.reveal section.present p').focus()`);
  await page.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))`);
  const p = await boxOf(page, '.reveal section.present p');
  assert.ok((await shownFrames(page)).some((f) => around(f, p)), 'the paragraph is not selected');
  await drag(page, '.reveal section.present .zone > img', { dx: 40, dy: 30, modifiers: 'Alt', hold: true });
  const zone = await boxOf(page, '.reveal section.present .zone');
  const frames = await shownFrames(page);
  assert.equal(frames.some((f) => around(f, p)), false, 'the frame is left on the paragraph during the drag');
  assert.ok(frames.some((f) => around(f, zone)), 'the dragged figure does not have a frame');
  assert.deepEqual(page.errors, []);
});
