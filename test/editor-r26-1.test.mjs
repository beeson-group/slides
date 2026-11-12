// Preview of R26.1 on both platforms. a preview runs until the last strand of a staggered backdrop
// is traced, for Trace Backdrop, Play Slide, and a backdrop that is a step in Play Steps, and the
// wait of a loop still ends. a backdrop hidden in the layer that the editor shows is not traced on
// the canvas. Play Slide, Trace Backdrop, and Play Steps are dimmed in Chapters Table, which stops a
// preview that plays. the layer of Play Steps follows the slide through a zoom, a scroll, the View
// button, and Rulers, and Esc that stops a preview keeps the selection, while Deselect and its other
// key still work during a preview

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press } from './helpers/editor.mjs';

const DECK = 'test/pages/editor-r26-1.html';
const PLATFORMS = ['mac', 'other'];
const MAIN = '.beeson-edit-top [data-command="preview.slide"]';
const VIEW = '.beeson-edit-top [data-command="toolbar.view"]';
const LAYER = '.beeson-edit-play';
// the slides of the deck
const STAGGER = 0, STEPPED = 1, LOOP = 2, HIDDEN = 3, STEPS = 4;

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

let last = null;

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => el.matches('.backdrop') ? 'backdrop' : el.localName)`);
const rafs = (page) => page.evaluate('Beeson.backdrops.filter((b) => b.raf).length');
const layer = (page) => page.evaluate(`!!document.querySelector('${LAYER}')`);
const pressed = (page) => page.evaluate(`document.querySelector('${MAIN}').getAttribute('aria-pressed') === 'true'`);
const centerOf = (page, selector) => page.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const mouse = (page, type, x, y, extra = {}) => page.send('Input.dispatchMouseEvent', { type, x, y, ...extra });

// the editor on the deck at slide n, with a step delay of step ms. with motion, the page does not
// ask for reduced motion and the URL is without still, so that a backdrop is traced
async function previewPage(platform, n, { motion = false, step = 1000 } = {}) {
  await last?.close().catch(() => {});
  const page = await browser.newPage({ width: 1600, height: 1000, ...(motion ? { motion: true } : {}) });
  last = page;
  await page.goto(`${server.origin}/${DECK}?edit${motion ? '' : '&still'}&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`window.BeesonEditor.preview.step = ${step}`);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the drawing of the backdrop of slide n on the canvas
const orbitOf = (n) => `Beeson.backdrops.find((b) => b.el === document.querySelectorAll('.reveal .slides > section')[${n}].querySelector('.backdrop'))`;

// the seconds from the start of the trace of the backdrop of slide n to the end of its last strand,
// with strand i started i times data-stagger seconds late
async function spanOf(page, n) {
  await page.waitFor(`(${orbitOf(n)})?.strands.length > 1`);
  return page.evaluate(`(() => {
    const b = ${orbitOf(n)};
    const T = Math.max(...b.strands.map((s) => s.T));
    return Math.max(...b.strands.map((s, i) => (s.times.at(-1) / T) * b.duration + i * b.stagger));
  })()`);
}

// runs the command id and records in the page, in ms from the run, when the layer of the steps is
// added and taken down, when the trace of the backdrop of slide n on the canvas ends and whether
// each of its strands was traced to its end then, and when Preview is no longer pressed
async function watch(page, id, n) {
  await page.evaluate(`(() => {
    const w = window.__w = { on: null, off: null, end: null, whole: null, released: null };
    const b = ${n === null ? 'null' : orbitOf(n)};
    const t0 = performance.now();
    let started = false, seen = false;
    const tick = () => {
      const t = performance.now() - t0;
      const l = !!document.querySelector('${LAYER}');
      if (l && w.on === null) w.on = t;
      if (!l && w.on !== null && w.off === null) w.off = t;
      if (b?.raf) started = true;
      if (b && started && !b.raf && w.end === null) {
        w.end = t;
        w.whole = b.strands.every((s, i) => b.idx[i] === s.times.length - 1);
      }
      if (document.querySelector('${MAIN}').getAttribute('aria-pressed') === 'true') seen = true;
      else if (seen && w.released === null) w.released = t;
      if (w.released === null) requestAnimationFrame(tick);
    };
    window.BeesonEditor.exec(${JSON.stringify(id)});
    requestAnimationFrame(tick);
  })()`);
}

const watched = async (page, timeout = 15000) => {
  await page.waitFor('window.__w.released !== null', timeout);
  return page.evaluate('window.__w');
};

// the box of an element in the viewport, rounded to the px
const box = (page, selector) => page.evaluate(`(() => {
  const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect();
  return r ? [r.left, r.top, r.width, r.height].map(Math.round) : null;
})()`);

// the boxes of the layer, of the slide drawn in it, and of the slides of the canvas, and the clip of
// the layer with the clip that the viewport of the canvas gives
const placed = (page) => page.evaluate(`(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round); };
  const l = document.querySelector('${LAYER}');
  if (!l) return null;
  const stage = document.querySelector('.reveal .slides');
  const s = stage.getBoundingClientRect(), v = window.BeesonEditorShell.stage.viewport;
  const cut = [v.top - s.top, s.right - v.right, s.bottom - v.bottom, v.left - s.left].map((d) => Math.round(Math.max(0, d)));
  const d = (/inset\\(([^)]*)\\)/.exec(l.style.clipPath)?.[1] ?? '0px').split(' ').map((x) => Math.round(parseFloat(x)));
  const clip = [d[0], d[1] ?? d[0], d[2] ?? d[0], d[3] ?? d[1] ?? d[0]];
  return { layer: r(l), shot: r(l.querySelector('.shot').shadowRoot.querySelector('.slides')), slides: r(stage), clip, cut };
})()`);

for (const platform of PLATFORMS) {
  test(`Trace Backdrop of a staggered backdrop runs until its last strand is traced (${platform})`, async () => {
    const page = await previewPage(platform, STAGGER, { motion: true });
    const span = await spanOf(page, STAGGER);
    assert.ok(span > 2, `the trace of the test backdrop takes ${span} s`);
    await watch(page, 'preview.backdrop', STAGGER);
    const w = await watched(page);
    assert.ok(w.end !== null, 'the trace did not end');
    assert.ok(w.end >= span * 1000 - 150, `the trace ends at ${Math.round(w.end)} ms, before its last strand at ${Math.round(span * 1000)} ms`);
    assert.equal(w.whole, true, 'the trace snaps to the finished drawing');
    assert.ok(w.released >= w.end - 20 && w.released < span * 1000 + 1500, `Preview is released at ${Math.round(w.released)} ms`);
  });

  test(`Play Slide traces a staggered backdrop until its last strand before it plays the steps (${platform})`, async () => {
    const page = await previewPage(platform, STAGGER, { motion: true, step: 200 });
    const span = await spanOf(page, STAGGER);
    await watch(page, 'preview.slide', STAGGER);
    const w = await watched(page);
    assert.equal(w.whole, true, 'the trace snaps to the finished drawing');
    assert.ok(w.on !== null && w.on >= span * 1000 - 150, `the steps start at ${Math.round(w.on)} ms, before the last strand at ${Math.round(span * 1000)} ms`);
  });

  test(`Play Steps runs until the last strand of a staggered backdrop that is a step is traced (${platform})`, async () => {
    const page = await previewPage(platform, STEPPED, { motion: true, step: 300 });
    const span = await spanOf(page, STEPPED);
    await watch(page, 'preview.steps', null);
    const w = await watched(page);
    // the backdrop is traced from the first step on, one step delay after the start
    assert.ok(w.off !== null && w.off >= 300 + span * 1000 - 150, `the layer is taken down at ${Math.round(w.off)} ms, before the last strand at ${Math.round(300 + span * 1000)} ms`);
    assert.ok(w.off < 300 + span * 1000 + 2000, `the layer is taken down at ${Math.round(w.off)} ms`);
  });

  test(`Trace Backdrop of a staggered loop ends (${platform})`, async () => {
    const page = await previewPage(platform, LOOP, { motion: true });
    const span = await spanOf(page, LOOP);
    await watch(page, 'preview.backdrop', null);
    const w = await watched(page);
    // a loop is drawn whole, with its head looped, and its wait ends after data-duration at least
    assert.ok(w.released >= 1000 - 150 && w.released < span * 1000 + 1500, `the loop is released at ${Math.round(w.released)} ms, with the last strand at ${Math.round(span * 1000)} ms`);
  });

  test(`a backdrop hidden in the shown layer is not traced by Trace Backdrop or Play Slide (${platform})`, async () => {
    const page = await previewPage(platform, HIDDEN, { motion: true, step: 5000 });
    assert.equal(await page.evaluate(`document.querySelector('section.present > .backdrop').classList.contains('beeson-off')`), true, 'the backdrop is not hidden in the first layer');
    assert.equal((await state(page, 'preview.backdrop')).enabled, false, 'Trace Backdrop is enabled');
    assert.equal((await state(page, 'preview.slide')).enabled, true, 'Play Slide is dimmed on a slide with steps');
    await exec(page, 'preview.backdrop');
    await frames(page);
    assert.equal(await rafs(page), 0, 'Trace Backdrop traces the hidden backdrop');
    assert.equal(await pressed(page), false);
    await exec(page, 'preview.slide');
    await frames(page);
    assert.equal(await rafs(page), 0, 'Play Slide traces the hidden backdrop');
    assert.equal(await layer(page), true, 'Play Slide does not play the steps at once');
    await press(page, 'Escape');
  });

  test(`Play Slide, Trace Backdrop, and Play Steps are dimmed in Chapters Table, which stops a preview (${platform})`, async () => {
    const page = await previewPage(platform, STAGGER, { motion: true, step: 5000 });
    await exec(page, 'view.lightTable');
    await frames(page);
    assert.equal((await state(page, 'view.lightTable')).checked, true);
    for (const id of ['preview.slide', 'preview.backdrop', 'preview.steps']) assert.equal((await state(page, id)).enabled, false, `${id} in Chapters Table`);
    assert.equal(await page.evaluate(`document.querySelector('${MAIN}').disabled`), true, 'the main part of Preview is not dimmed');
    // the entries of the Play menu
    await click(page, await page.evaluate(`(() => {
      const t = [...document.querySelectorAll('.beeson-edit-header [aria-haspopup="menu"]')].find((b) => b.textContent === 'Play');
      const r = t.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`));
    await frames(page);
    const dim = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].filter((i) => ['Play Slide', 'Trace Backdrop', 'Play Steps'].includes(i.querySelector('.label')?.textContent.trim())).map((i) => i.getAttribute('aria-disabled'))`);
    assert.deepEqual(dim, ['true', 'true', 'true'], 'an entry of the Play menu is not dimmed');
    await press(page, 'Escape');
    await exec(page, 'view.lightTable');
    await frames(page);
    // a preview that plays is stopped when the table is opened
    for (const id of ['preview.steps', 'preview.backdrop', 'preview.slide']) {
      await exec(page, id);
      await frames(page);
      assert.equal(await pressed(page), true, `${id} does not play`);
      await exec(page, 'view.lightTable');
      await frames(page);
      await frames(page);
      assert.equal(await pressed(page), false, `${id} plays on in Chapters Table`);
      assert.equal(await layer(page), false, `the layer of ${id} is drawn over Chapters Table`);
      assert.equal(await rafs(page), 0, `the trace of ${id} runs on in Chapters Table`);
      await exec(page, 'view.lightTable');
      await frames(page);
    }
  });

  test(`the layer of Play Steps follows the slide through a zoom, a pinch, a scroll, the View button, and Rulers (${platform})`, async () => {
    const page = await previewPage(platform, STEPS, { step: 20000 });
    await exec(page, 'preview.steps');
    await frames(page);
    const follows = async (how) => {
      await frames(page);
      await frames(page);
      const p = await placed(page);
      assert.ok(p, `the preview stops at ${how}`);
      assert.equal(await pressed(page), true, `Preview is released at ${how}`);
      for (const k of [0, 1, 2, 3]) {
        assert.ok(Math.abs(p.layer[k] - p.slides[k]) <= 1, `the layer is at ${p.layer} and the slides at ${p.slides} after ${how}`);
        assert.ok(Math.abs(p.shot[k] - p.slides[k]) <= 1, `the slide of the layer is at ${p.shot} and the slides at ${p.slides} after ${how}`);
        assert.ok(Math.abs(p.clip[k] - p.cut[k]) <= 1, `the clip of the layer is ${p.clip} and the viewport cuts ${p.cut} after ${how}`);
      }
    };
    await follows('the start');
    await exec(page, 'zoom.in');
    await follows('zoom.in');
    const v = await page.evaluate('window.BeesonEditorShell.stage.viewport.toJSON()');
    const x = v.left + v.width / 2, y = v.top + v.height / 2;
    await mouse(page, 'mouseMoved', x, y);
    for (let i = 0; i < 6; i++) {
      await mouse(page, 'mouseWheel', x, y, { deltaX: 0, deltaY: -30, modifiers: 2 });
      await frames(page);
    }
    await follows('a pinch');
    await exec(page, 'zoom.in');
    await exec(page, 'zoom.in');
    await frames(page);
    const before = await box(page, '.reveal .slides');
    await mouse(page, 'mouseWheel', x, y, { deltaX: 0, deltaY: 300 });
    await page.waitFor(`Math.round(document.querySelector('.reveal .slides').getBoundingClientRect().top) !== ${before[1]}`, 2000);
    await follows('a scroll');
    await exec(page, 'zoom.fit');
    await follows('zoom.fit');
    await click(page, await centerOf(page, VIEW));
    await follows('a click on the View button');
    await exec(page, 'view.rulers');
    await follows('Rulers');
    await press(page, 'Escape');
    await frames(page);
    assert.equal(await layer(page), false);
  });

  test(`Esc that stops a preview keeps the selection, as Stop does (${platform})`, async () => {
    const page = await previewPage(platform, STEPS, { step: 5000 });
    await click(page, await centerOf(page, 'section.present h2'));
    await press(page, 'Escape');
    assert.deepEqual(await selected(page), ['h2']);
    for (const id of ['preview.steps', 'preview.slide']) {
      await exec(page, id);
      await frames(page);
      assert.equal(await layer(page), true, `${id} does not play`);
      await press(page, 'Escape');
      await frames(page);
      assert.equal(await layer(page), false, `Esc does not stop ${id}`);
      assert.deepEqual(await selected(page), ['h2'], `Esc that stops ${id} changes the selection`);
    }
    await page.evaluate(`Reveal.slide(${STAGGER})`);
    await frames(page);
    await exec(page, 'preview.selectBackdrop');
    assert.deepEqual(await selected(page), ['backdrop']);
    await exec(page, 'preview.steps');
    await frames(page);
    await press(page, 'Escape');
    await frames(page);
    assert.equal(await layer(page), false);
    assert.deepEqual(await selected(page), ['backdrop'], 'Esc that stops a preview drops the selected backdrop');
    // Esc without a preview still deselects
    await press(page, 'Escape');
    assert.deepEqual(await selected(page), []);
  });

  test(`Deselect and its key Mod+Shift+A work while a preview plays (${platform})`, async () => {
    const page = await previewPage(platform, STEPS, { step: 5000 });
    await click(page, await centerOf(page, 'section.present h2'));
    await press(page, 'Escape');
    assert.deepEqual(await selected(page), ['h2']);
    await exec(page, 'preview.steps');
    await frames(page);
    assert.equal(await layer(page), true);
    assert.equal((await state(page, 'selection.clear')).enabled, true, 'Deselect is dimmed while a preview plays');
    await press(page, 'Mod+Shift+A');
    await frames(page);
    assert.deepEqual(await selected(page), [], 'Mod+Shift+A does not deselect while a preview plays');
    assert.equal(await layer(page), true, 'Mod+Shift+A stops the preview');
    await press(page, 'Escape');
    await frames(page);
    assert.equal(await layer(page), false);
  });
}
