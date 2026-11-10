// regression tests of R7.1 on both platforms with trusted input: the readout of a resize of a group,
// the place of a new text box on a slide without room under its text, and the load of a deck in a
// second tab.
// after each edit the text is checked byte for byte, after an undo and a redo, and after a save and
// an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
// the slide of the deck of layouts with an ordered list and a figure with a caption
const MATH = 3;
const IMG = '.reveal section.present figure.zone img:not([hidden])';

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
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const wait = (page, ms) => page.evaluate(`new Promise((d) => setTimeout(() => d(true), ${ms}))`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

// the editor on the slide n of a deck served over HTTP, with the Format tab shown
async function load(t, platform, { deck = LAYOUTS, n = 0, size = { width: 1600, height: 1000 } } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks the edits in the text, then the text before byte for byte after an undo, the
// edit after a redo, and an open of the saved edit without problems
let saves = 0;
async function roundTrip(page, edits) {
  await byteExact(page, edits);
  const edited = await render(page);
  await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r7-1-${++saves}.html`);
  assert.equal(text, edited);
  page.source = text;
}

// fieldsOf returns the values of the fields Width and Height of the Arrange pane
const fieldsOf = (page) =>
  page.evaluate(`(() => { const v = (n) => document.querySelector('#beeson-edit-panel-format input[name="' + n + '"]')?.value ?? null; return { w: Number(v('Width')), h: Number(v('Height')) }; })()`);
// readoutOf returns the size in the readout at the pointer, or null while the readout is hidden
const readoutOf = (page) =>
  page.evaluate(`(() => { const t = document.querySelector('.beeson-offset:not([hidden])')?.textContent ?? ''; const m = t.match(/(\\d+) × (\\d+)/); return m ? { w: Number(m[1]), h: Number(m[2]), text: t } : null; })()`);

// item 1 of R7.1: in R6.8, a corner grip of a group of a figure and a paragraph moved by -120 by
// -90 px gave 1446 × 706 in the readout, the box asked for, while the members reached 1524 × 800,
// since the height of a zone is set by its layout
for (const platform of PLATFORMS) {
  test(`the readout of a resize of a group gives the size of W and H (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    await click(page, IMG);
    await press(page, 'Escape');
    await click(page, '.reveal section.present > p', { modifiers: 'Shift' });
    await exec(page, 'arrange.group');
    await frames(page);
    await page.evaluate(`[...document.querySelectorAll('#beeson-edit-panel-format button')].find((b) => b.textContent.trim() === 'Arrange')?.click()`);
    await frames(page);
    const start = await fieldsOf(page);
    const se = await page.evaluate(`(() => { const g = document.querySelector('.beeson-grip[data-group="1"][data-handle="se"]'); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await drag(page, se, { dx: -120, dy: -90, steps: 12, hold: true });
    await frames(page);
    const readout = await readoutOf(page);
    let f = await fieldsOf(page);
    assert.ok(readout, 'a readout is shown during the resize');
    assert.ok(f.w < start.w - 50, js({ start, f }));
    const near = (a, b) => Math.abs(a - b) <= 1;
    assert.ok(near(readout.w, f.w) && near(readout.h, f.h), `during the resize the readout reads ${readout.text} and the fields ${js(f)}`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: se.x - 120, y: se.y - 90, button: 'left', clickCount: 1 });
    await frames(page);
    f = await fieldsOf(page);
    assert.ok(near(readout.w, f.w) && near(readout.h, f.h), `after the resize the fields read ${js(f)}, and the last readout ${readout.text}`);
    assert.deepEqual(errors(page), []);
  });
}

// placedOf returns the box in slide px of the new text box, or of the paragraph Typed once it is
// written, the boxes of the footnotes of the current slide, the size of the slide, and the visible
// part of the slide in the canvas
const placedOf = (page) =>
  page.evaluate(`(() => {
    const slides = document.querySelector('.reveal .slides');
    const top = slides.getBoundingClientRect();
    const s = top.width / slides.offsetWidth;
    const box = (r) => ({ left: (r.left - top.left) / s, top: (r.top - top.top) / s, right: (r.right - top.left) / s, bottom: (r.bottom - top.top) / s });
    const sec = document.querySelector('.reveal section.present');
    const el = document.querySelector('.beeson-pending') ?? [...sec.querySelectorAll('p')].find((p) => p.textContent === 'Typed');
    const v = document.querySelector('.beeson-edit-canvas').getBoundingClientRect();
    const seen = box(new DOMRect(v.left, v.top, v.width, v.height));
    const w = sec.offsetWidth, h = sec.offsetHeight;
    const visible = { left: Math.max(0, seen.left), top: Math.max(0, seen.top), right: Math.min(w, seen.right), bottom: Math.min(h, seen.bottom) };
    return { box: box(el.getBoundingClientRect()), feet: [...sec.querySelectorAll('.foot')].map((f) => box(f.getBoundingClientRect())), w, h, visible };
  })()`);

// item 2 of R7.1: on a slide without room under its text column, a new text box was put under the
// lowest block, over the footnote or under the slide. it is put at the center of the visible part
// of the slide, as Keynote puts a new object, moved up off the footnote and into the slide
const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const SMALL = '.reveal section.present > p.small';
for (const platform of PLATFORMS) {
  for (const { name, y, zoom } of [
    { name: 'over the footnote', y: 880 },
    { name: 'under the slide', y: 1000 },
    { name: 'under the slide at Actual Size, scrolled to the upper left', y: 1000, zoom: true },
  ]) {
    test(`a new text box that would be ${name} is put at the center of the visible slide (${platform})`, async (t) => {
      const page = await load(t, platform, { n: 2 });
      // the small paragraph under the list is selected and moved down to the top y
      await click(page, SMALL);
      await press(page, 'Escape');
      await exec(page, 'arrange.setPosition', { y });
      await frames(page);
      assert.match(await page.evaluate(`document.querySelector(${js(SMALL)}).getAttribute('style') ?? ''`), /translate/);
      page.source = await render(page);
      if (zoom) {
        await exec(page, 'zoom.actual');
        await page.evaluate(`(() => { const c = document.querySelector('.beeson-edit-canvas'); c.scrollLeft = 0; c.scrollTop = 0; })()`);
        await frames(page);
      }
      await exec(page, 'insert.text');
      await frames(page);
      const check = (at, what) => {
        const { box, feet, w, h, visible } = at;
        assert.ok(box.left >= -1 && box.top >= -1 && box.right <= w + 1 && box.bottom <= h + 1, `the ${what} at ${js(box)} is off the slide of ${w} by ${h}`);
        for (const f of feet) assert.ok(!meets(box, f), `the ${what} at ${js(box)} is over the footnote at ${js(f)}`);
        // the center of the visible part, moved as little as it takes to keep the box in the slide
        const bw = box.right - box.left, bh = box.bottom - box.top;
        const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
        const cx = clamp((visible.left + visible.right) / 2, bw / 2, w - bw / 2);
        const cy = clamp((visible.top + visible.bottom) / 2, bh / 2, h - bh / 2);
        assert.ok(Math.abs((box.left + box.right) / 2 - cx) <= 2, `the ${what} at ${js(box)} is not centered at x ${cx} of the visible part ${js(visible)}`);
        // a box centered over a footnote is moved up until it is clear of the footnote
        const centered = { left: cx - bw / 2, right: cx + bw / 2, top: cy - bh / 2, bottom: cy + bh / 2 };
        const under = feet.filter((f) => meets(centered, f));
        if (!under.length) assert.ok(Math.abs((box.top + box.bottom) / 2 - cy) <= 2, `the ${what} at ${js(box)} is not centered at y ${cy} of the visible part ${js(visible)}`);
        else assert.ok(box.bottom >= Math.min(...under.map((f) => f.top)) - 40, `the ${what} at ${js(box)} is moved further up than the footnote at ${js(under)}`);
      };
      const empty = await placedOf(page);
      check(empty, 'empty box');
      await type(page, 'Typed');
      await wait(page, 300);
      const written = await placedOf(page);
      check(written, 'written box');
      assert.ok(Math.abs(written.box.left - empty.box.left) <= 1 && Math.abs(written.box.top - empty.box.top) <= 1, `the box is moved from ${js(empty.box)} to ${js(written.box)} when it is written`);
      const tag = (await render(page)).match(/<p style="translate: -?\d+px -?\d+px">Typed<\/p>/)?.[0];
      assert.ok(tag, 'the box is written with its offset');
      await roundTrip(page, [['A small paragraph.</p>\n', `A small paragraph.</p>\n  ${tag}\n`]]);
      assert.deepEqual(errors(page), []);
    });
  }
}

// frameOf returns the size in slide px of the one frame of a selected group, or null
const frameOf = (page) =>
  page.evaluate(`(() => { const slides = document.querySelector('.reveal .slides'); const s = slides.getBoundingClientRect().width / slides.offsetWidth; const f = document.querySelector('.beeson-frame.union.group:not([hidden])'); if (!f) return null; const r = f.getBoundingClientRect(); return { w: r.width / s, h: r.height / s }; })()`);

// item 4 of R7.1: in picture 178-group-resize of round 3, a group of the paragraph and the image
// of the slide of figures of index.html was resized, and the readout and the frame read 1443 px
// wide while W read 1434
const FIGURES = 4;
const DEMO_IMG = '.reveal section.present figure.zone img:not([hidden])';
for (const platform of PLATFORMS) {
  test(`the readout, the frame, and W and H give one size during and after a resize of a group (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: 'index.html', n: FIGURES });
    await click(page, '.reveal section.present > p');
    await press(page, 'Escape');
    await click(page, DEMO_IMG, { modifiers: 'Shift' });
    await exec(page, 'arrange.group');
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal section.present [data-group]').length`), 2, 'the paragraph and the image are not grouped');
    // a click on an empty point of the slide, then on the image, selects the group
    const empty = await page.evaluate(`(() => { const r = document.querySelector('.reveal section.present').getBoundingClientRect(); return { x: r.left + r.width * 0.3, y: r.top + r.height * 0.9 }; })()`);
    await click(page, empty);
    await click(page, DEMO_IMG);
    await frames(page);
    assert.ok(await frameOf(page), 'the group is not selected');
    await page.evaluate(`[...document.querySelectorAll('#beeson-edit-panel-format button')].find((b) => b.textContent.trim() === 'Arrange')?.click()`);
    await frames(page);
    const near = (a, b) => Math.abs(a - b) <= 1.5;
    const same = (what, a, b) => assert.ok(near(a.w, b.w) && near(a.h, b.h), `${what}: ${js(a)} and ${js(b)}`);
    same('before the resize, the frame and the fields', await frameOf(page), await fieldsOf(page));
    const se = await page.evaluate(`(() => { const g = document.querySelector('.beeson-grip[data-group="1"][data-handle="se"]'); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await drag(page, se, { dx: -120, dy: -90, steps: 12, hold: true });
    await frames(page);
    const readout = await readoutOf(page);
    assert.ok(readout, 'a readout is shown during the resize');
    const during = await fieldsOf(page);
    same('during the resize, the readout and the fields', readout, during);
    same('during the resize, the frame and the fields', await frameOf(page), during);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: se.x - 120, y: se.y - 90, button: 'left', clickCount: 1 });
    await frames(page);
    const done = await fieldsOf(page);
    same('after the resize, the last readout and the fields', readout, done);
    same('after the resize, the frame and the fields', await frameOf(page), done);
    assert.deepEqual(errors(page), []);
  });
}
