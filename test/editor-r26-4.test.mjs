// the zoom of a pinch: a slow pinch of a trackpad, i.e. wheels with Ctrl and small deltas, which
// zooms by the product of its steps as a fast one does, and a wheel with Ctrl during the drag of a
// figure, which keeps the point grabbed under the pointer

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { launch } from '../scripts/chrome.mjs';
import { byteExact, click, editorPage } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser?.close();
});

async function open(t, platform, slide) {
  const page = await editorPage(browser, { query: `edit&still&edit-platform=${platform}`, page: { width: 1600, height: 1000 }, clear: true });
  t.after(() => page.close());
  await page.evaluate(`Reveal.slide(${slide})`);
  await frames(page);
  await wait(page, 150);
  return page;
}

const frames = (page) => page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true))))');
const wait = (page, ms) => page.evaluate(`new Promise((done) => setTimeout(() => done(true), ${ms}))`);
const mouse = (page, type, x, y, extra = {}) => page.send('Input.dispatchMouseEvent', { type, x, y, ...extra });
const zoomOf = (page) => page.evaluate('[window.BeesonEditorShell.stage.zoom, window.BeesonEditorShell.stage.scale]');

// 40 wheels with Ctrl at the center of the canvas, as Chrome sends a slow pinch, each in a frame of
// its own, and the zoom 400 ms after the last one, once the pinch is laid out
async function pinch(page, delta) {
  const v = await page.evaluate('window.BeesonEditorShell.stage.viewport.toJSON()');
  const x = v.left + v.width / 2;
  const y = v.top + v.height / 2;
  await mouse(page, 'mouseMoved', x, y);
  for (let k = 0; k < 40; k++) {
    await mouse(page, 'mouseWheel', x, y, { deltaX: 0, deltaY: delta, modifiers: 2 });
    await frames(page);
  }
  await wait(page, 400);
  await frames(page);
  return zoomOf(page);
}

for (const platform of PLATFORMS) {
  for (const delta of [-2, -3, 2, -6]) {
    test(`a slow pinch with wheels of ${delta} zooms by the product of its steps (${platform})`, async (t) => {
      const page = await open(t, platform, 2);
      const [fit, scale] = await zoomOf(page);
      assert.equal(fit, null);
      const ideal = scale * Math.exp((-delta * 40) / 200);
      const [zoom, now] = await pinch(page, delta);
      assert.notEqual(zoom, null, `the pinch left the zoom at Fit, ${scale}, instead of about ${ideal.toFixed(2)}`);
      // the zoom is a hundredth, floored once at the end of each frame
      assert.ok(Math.abs(zoom - ideal) <= 0.02, `the zoom is ${zoom} instead of about ${ideal.toFixed(2)}`);
      assert.equal(now, zoom);
    });
  }

  test(`a wheel with Ctrl during the drag of a figure keeps the point grabbed under the pointer (${platform})`, async (t) => {
    const page = await open(t, platform, 4);
    const IMG = '.reveal section.present figure.figure-box img.for-dark';
    const box = `(() => { const r = document.querySelector('${IMG}').getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, scale: window.BeesonEditorShell.stage.scale }; })()`;
    const figure = `document.querySelector('${IMG}').closest('figure')`;
    await click(page, IMG);
    await frames(page);
    const b0 = await page.evaluate(box);
    const px = b0.left + b0.width / 2;
    const py = b0.top + 40;
    // grab is the offset of the pointer from the left edge of the picture, in slide px
    const grab = (px - b0.left) / b0.scale;
    await mouse(page, 'mouseMoved', px, py);
    await mouse(page, 'mousePressed', px, py, { button: 'left', buttons: 1, clickCount: 1 });
    for (let k = 1; k <= 5; k++) {
      await mouse(page, 'mouseMoved', px - 10 * k, py, { button: 'left', buttons: 1 });
      await frames(page);
    }
    await mouse(page, 'mouseWheel', px - 50, py, { deltaX: 0, deltaY: -40, modifiers: 2, buttons: 1 });
    await frames(page);
    await wait(page, 300);
    // a pointer sends a move at the same point after a zoom
    await mouse(page, 'mouseMoved', px - 50, py, { button: 'left', buttons: 1 });
    await frames(page);
    const b1 = await page.evaluate(box);
    assert.ok(b1.scale > b0.scale + 0.05, `the wheel did not zoom in, at ${b1.scale}`);
    const at = px - 50 - grab * b1.scale;
    assert.ok(Math.abs(b1.left - at) <= 3, `the picture is at ${b1.left.toFixed(1)} px after the zoom instead of ${at.toFixed(1)}`);
    for (let k = 6; k <= 10; k++) {
      await mouse(page, 'mouseMoved', px - 10 * k, py, { button: 'left', buttons: 1 });
      await frames(page);
    }
    await mouse(page, 'mouseReleased', px - 100, py, { button: 'left', clickCount: 1 });
    await frames(page);
    await wait(page, 400);
    const b2 = await page.evaluate(box);
    const end = px - 100 - grab * b2.scale;
    assert.ok(Math.abs(b2.left - end) <= 3, `the picture is at ${b2.left.toFixed(1)} px at the release instead of ${end.toFixed(1)}`);
    // 50 px to the left at the scale of the press, and 50 px more at the scale of the zoom
    const x = Number(/translate:\s*(-?[\d.]+)px/.exec(await page.evaluate(`${figure}.getAttribute('style')`))?.[1]);
    const want = -50 / b0.scale - 50 / b1.scale;
    assert.ok(Math.abs(x - want) <= 4, `the translate is ${x} px instead of about ${want.toFixed(0)}`);
    await page.evaluate('window.BeesonEditor.exec("edit.undo")');
    await byteExact(page);
    await page.evaluate('window.BeesonEditor.exec("edit.redo")');
    assert.match(await page.evaluate(`${figure}.getAttribute('style')`), new RegExp(`translate: ${x}px`));
  });
}
