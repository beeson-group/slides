// the selection on the canvas, driven with trusted input: a click on the border of a block or on a
// figure selects it, Shift and the command modifier add and remove, a marquee and Select All select
// several elements, Esc, Return, and Tab move between the states, a drag of several elements and a
// resize by a handle are one entry of the history each, and a press on the chrome keeps the
// selection

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { launch } from '../scripts/chrome.mjs';
import { click, drag, editorPage, press } from './helpers/editor.mjs';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// the slide of the demo deck with a paragraph and a figure in a zone
async function figureSlide(page) {
  await page.evaluate(`(() => { const img = document.querySelector('.reveal .slides section .zone > img'); Reveal.slide(Reveal.getIndices(img.closest('section')).h); })()`);
  await sleep(200);
}

// the boxes of the solid frames shown, in CSS pixels of the viewport
const shownFrames = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-frame.selected')].filter((f) => !f.hidden && f.getBoundingClientRect().width).map((f) => { const r = f.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; })`);
const boxOf = (page, selector) => page.evaluate(`(() => { const r = [...document.querySelectorAll(${JSON.stringify(selector)})].map((el) => el.getBoundingClientRect()).find((r) => r.width); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; })()`);
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

const P = '.reveal section.present > p';
const ZONE = '.reveal section.present .zone';
const IMG = '.reveal section.present .zone > img';
// the selectors whose element has a solid frame, among those given
async function framed(page, selectors) {
  const frames = await shownFrames(page);
  const out = [];
  for (const s of selectors) {
    const box = await boxOf(page, s);
    if (frames.some((f) => around(f, box))) out.push(s);
  }
  return out;
}
const caretIn = (page, selector) => page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); const s = getSelection(); return document.activeElement === el && !!s.rangeCount && el.contains(s.anchorNode); })()`);
// a point in the empty margin left of the paragraph, in CSS pixels of the viewport
const margin = async (page) => {
  const p = await boxOf(page, P);
  return { x: p.left - 60, y: p.top + 4 };
};

for (const platform of ['mac', 'other']) {
  const query = `edit&still&edit-platform=${platform}`;

  test(`${platform}: a click on the border of a paragraph selects it without a caret, and a click into it puts the caret there`, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await editorPage(browser, { query });
    await figureSlide(page);
    const p = await boxOf(page, P);
    await click(page, { x: p.right + 3, y: (p.top + p.bottom) / 2 });
    assert.deepEqual(await framed(page, [P]), [P], 'the paragraph is not selected by a click on its border');
    assert.equal(await caretIn(page, P), false, 'a click on the border puts a caret into the paragraph');
    await click(page, P);
    assert.equal(await caretIn(page, P), true, 'a click into the paragraph does not put the caret there');
    assert.deepEqual(page.errors, []);
  });

  test(`${platform}: Shift-click adds an element and removes it again, and a marquee selects the elements it touches`, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await editorPage(browser, { query });
    await figureSlide(page);
    const p = await boxOf(page, P);
    await click(page, { x: p.right + 3, y: (p.top + p.bottom) / 2 });
    await click(page, IMG, { modifiers: 'Shift' });
    assert.deepEqual(await framed(page, [P, ZONE]), [P, ZONE], 'Shift-click does not add the figure');
    await click(page, IMG, { modifiers: 'Shift' });
    assert.deepEqual(await framed(page, [P, ZONE]), [P], 'a second Shift-click does not remove the figure');
    await click(page, IMG, { modifiers: 'Mod' });
    assert.deepEqual(await framed(page, [P, ZONE]), [P, ZONE], 'the command modifier does not add the figure');
    // a marquee from the margin to the list touches the paragraph and the list, not the heading
    await click(page, await margin(page));
    assert.equal((await shownFrames(page)).length, 0, 'a click on an empty point keeps the selection');
    const ul = await boxOf(page, '.reveal section.present > ul');
    const from = await margin(page);
    await drag(page, from, { dx: p.left + 40 - from.x, dy: ul.top + 10 - from.y });
    assert.deepEqual(await framed(page, ['.reveal section.present > h2', P, '.reveal section.present > ul', ZONE]), [P, '.reveal section.present > ul']);
    assert.deepEqual(page.errors, []);
  });

  test(`${platform}: Select All selects every movable element of the slide, and Esc goes from a text to its block to nothing`, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await editorPage(browser, { query });
    await figureSlide(page);
    const all = ['h2', 'p', 'ul', '.zone'].map((s) => `.reveal section.present > ${s}`);
    await click(page, await margin(page));
    await press(page, 'Mod+A');
    assert.deepEqual(await framed(page, all), all, `${platform === 'mac' ? '⌘A' : 'Ctrl+A'} does not select every element`);
    await click(page, P);
    assert.equal(await caretIn(page, P), true);
    await press(page, 'Escape');
    assert.equal(await caretIn(page, P), false, 'Esc does not leave the text');
    assert.deepEqual(await framed(page, all), [P], 'Esc does not select the block of the text');
    await press(page, 'Escape');
    assert.equal((await shownFrames(page)).length, 0, 'a second Esc does not clear the selection');
    assert.deepEqual(page.errors, []);
  });
}

test('Return enters the text of a selected block, Tab walks the elements, and a click on a toolbar button keeps the selection', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  await figureSlide(page);
  const [h2, p, ul] = ['h2', 'p', 'ul'].map((s) => `.reveal section.present > ${s}`);
  await click(page, await margin(page));
  await press(page, 'Tab');
  assert.deepEqual(await framed(page, [h2, p, ul]), [h2], 'Tab does not select the first element');
  await press(page, 'Tab');
  assert.deepEqual(await framed(page, [h2, p, ul]), [p], 'Tab does not select the next element');
  await press(page, 'Shift+Tab');
  assert.deepEqual(await framed(page, [h2, p, ul]), [h2], 'Shift+Tab does not select the element before');
  await press(page, 'Tab');
  const autosave = await page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-edit-header button')].find((b) => b.textContent === 'Autosave').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, autosave);
  assert.deepEqual(await framed(page, [h2, p, ul]), [p], 'a click on Autosave clears the selection');
  await press(page, 'Enter');
  assert.equal(await caretIn(page, p), true, 'Return does not put the caret into the paragraph');
  assert.deepEqual(page.errors, []);
});

// the translate of the elements, in slide pixels, as written in their style
const translates = (page, selectors) => page.evaluate(`${JSON.stringify(selectors)}.map((s) => [...document.querySelectorAll(s)].find((el) => el.getBoundingClientRect().width).style.translate)`);

test('a drag of two elements writes two translate declarations, undone as one entry', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  // Alt is the free modifier of a drag on Windows and Linux, and the copy modifier on a Mac
  const page = await editorPage(browser, { query: 'edit&still&edit-platform=other' });
  await figureSlide(page);
  const p = await boxOf(page, P);
  await click(page, { x: p.right + 3, y: (p.top + p.bottom) / 2 });
  await click(page, IMG, { modifiers: 'Shift' });
  await drag(page, IMG, { dx: -30, dy: 40, modifiers: 'Alt' });
  const [tp, tz] = await translates(page, [P, ZONE]);
  assert.match(tp, /^-?\d+px \d+px$/);
  assert.equal(tp, tz, 'the two elements are not moved by the same offset');
  const text = await page.evaluate('window.BeesonEditor.render()');
  assert.ok(text.includes(`<p style="translate: ${tp}">Export`), 'the translate of the paragraph is not written');
  assert.ok(text.includes(`<figure class="zone" style="translate: ${tz}">`), 'the translate of the figure is not written');
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source, 'one undo does not undo the drag of both');
  assert.deepEqual(page.errors, []);
});

const QR = '.reveal section.present .qr';
const layouts = (browser, options = {}) => editorPage(browser, { deck: 'test/pages/editor-layouts.html', ...options });

for (const size of [{ width: 1920, height: 1080 }, { width: 1280, height: 800 }]) {
  test(`${size.width}×${size.height}: a corner drag of an image keeps its aspect and writes width, and the readout shows the size`, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await editorPage(browser, { page: size });
    await figureSlide(page);
    await click(page, IMG);
    await click(page, IMG);
    const img = await boxOf(page, '.reveal section.present .zone > img');
    const before = await page.evaluate(`(() => { const img = [...document.querySelectorAll(${JSON.stringify(IMG)})].find((el) => el.getBoundingClientRect().width); return img.naturalWidth / img.naturalHeight; })()`);
    await drag(page, '.beeson-grip[data-handle="se"]', { dx: -80, dy: -10, modifiers: 'Meta', hold: true });
    const readout = await page.evaluate(`(() => { const o = document.querySelector('.beeson-offset'); return o && !o.hidden && getComputedStyle(o).display !== 'none' ? o.textContent : null; })()`);
    assert.match(readout ?? '', /^\d+ × \d+$/, 'the readout does not show the width and height');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 0, y: 0, button: 'left', clickCount: 1 });
    const width = await page.evaluate(`[...document.querySelectorAll(${JSON.stringify(IMG)})].find((el) => el.getBoundingClientRect().width).style.width`);
    assert.match(width, /^\d+px$/, 'the width is not written');
    const after = await boxOf(page, '.beeson-frame.selected:not([hidden])');
    const ratio = (after.right - after.left) / (after.bottom - after.top);
    assert.ok(Math.abs(ratio - before) / before < 0.03, `the aspect ${ratio} is not kept at ${before}`);
    assert.ok(after.right - after.left < img.right - img.left, 'the image is not made smaller');
    assert.deepEqual(page.errors, []);
  });

  test(`${size.width}×${size.height}: a drag of the left handle of a QR code writes width and translate, undone together`, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await layouts(browser, { page: size });
    await click(page, QR);
    const before = await boxOf(page, QR);
    await drag(page, '.beeson-grip[data-handle="w"]', { dx: -40, modifiers: 'Meta' });
    const [style, box] = [await page.evaluate(`document.querySelector(${JSON.stringify(QR)}).getAttribute('style')`), await boxOf(page, QR)];
    assert.match(style ?? '', /width: \d+px/, 'the width is not written');
    // the code is placed from the right and the bottom, hence its middle is kept by a translate down
    assert.match(style ?? '', /translate: 0px [1-9]\d*px/, 'the translate is not written');
    assert.ok(Math.abs(box.right - before.right) < 2, 'the right edge does not stay');
    assert.ok(box.left < before.left - 30, 'the left edge does not follow the handle');
    await page.evaluate('window.BeesonEditor.undo()');
    assert.equal(await page.evaluate(`document.querySelector(${JSON.stringify(QR)}).getAttribute('style') ?? ''`), '', 'one undo does not undo the width and the translate');
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
    assert.deepEqual(page.errors, []);
  });

  for (const platform of ['mac', 'other']) {
    test(`${size.width}×${size.height}, ${platform}: a drag snaps the left edge to x = 1200, and not with the free modifier`, async (t) => {
      const browser = await launch();
      t.after(() => browser.close());
      const page = await editorPage(browser, { query: `edit&still&edit-platform=${platform}`, page: size });
      await figureSlide(page);
      const scale = await page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'); return s.getBoundingClientRect().width / s.offsetWidth; })()`);
      const p = await boxOf(page, P);
      const left = (await page.evaluate(`document.querySelector(${JSON.stringify(P)}).offsetLeft`));
      // the left edge is dragged to 3 slide px right of the guide at 1200
      const dx = (1203 - left) * scale;
      const at = { x: p.right + 3, y: (p.top + p.bottom) / 2 };
      await drag(page, at, { dx });
      const snapped = await translates(page, [P]);
      assert.equal(parseFloat(snapped[0]) + left, 1200, `the left edge is not snapped to 1200: ${snapped[0]}`);
      await page.evaluate('window.BeesonEditor.undo()');
      await drag(page, at, { dx, modifiers: platform === 'mac' ? 'Meta' : 'Alt' });
      const free = await translates(page, [P]);
      assert.ok(Math.abs(parseFloat(free[0]) + left - 1203) <= 1, `the free drag is snapped: ${free[0]}`);
      assert.deepEqual(page.errors, []);
    });
  }
}

test('the width of a resized QR code is written into the file', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await layouts(browser);
  await click(page, QR);
  await drag(page, '.beeson-grip[data-handle="nw"]', { dx: -40, dy: -40, modifiers: 'Meta' });
  const width = await page.evaluate(`document.querySelector(${JSON.stringify(QR)}).style.width`);
  assert.ok((await page.evaluate('window.BeesonEditor.render()')).includes(`width: ${width}`));
});
