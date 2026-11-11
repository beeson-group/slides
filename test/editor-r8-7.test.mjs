// regression tests of R8.7 on both platforms and in both modes, with trusted input. the box of a
// figure is its frame, i.e. its shown picture with the caption that it holds, as the frame with its
// grips is drawn, in the X and Y fields, the readouts, Align, Distribute, the snap, Zoom to
// Selection, a group, and Size and Position…. the figures are a pair of images and one image, in a
// zone of a content slide and in the plate of a figure slide. after each command the file is
// checked byte for byte after an undo and the edit again after a redo

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { byteExact, click, drag, press, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const MODES = ['dark', 'light'];
const DECK = 'test/pages/editor-r8-5.html';
const ZONE_PAIR = 0, ZONE_ONE = 1, PLATE_PAIR = 2, PLATE_ONE = 3;
const FIGURES = [ZONE_PAIR, ZONE_ONE, PLATE_PAIR, PLATE_ONE];
const NAMES = ['a pair in a zone', 'one image in a zone', 'a pair in a plate', 'one image in a plate'];
const IMG = '.reveal section.present img';
const HEADING = '.reveal section.present > h2';
const FRAME = '.beeson-overlay > .beeson-frame.selected';
const PANEL = '#beeson-edit-panel-format';
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const SOURCE = readFileSync(DECK, 'utf8');
const SLIDE = { width: 1920, height: 1080 };

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
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const near = (a, b, by = 1) => Math.abs(a - b) <= by;
const show = (b) => `${Math.round(b.left)}, ${Math.round(b.top)}, ${Math.round(b.width)} × ${Math.round(b.height)}`;

const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => [el.localName, ...[...el.classList].filter((c) => /^(zone|plate|caption|for-dark|for-light)$/.test(c))].join('.'))`);

// the upper left corner of the slide on the screen, and the screen px per slide px in k
const SCALE = `(() => { const s = document.querySelector('.reveal .slides'); const r = s.getBoundingClientRect(); return { left: r.left, top: r.top, k: r.width / s.offsetWidth }; })()`;
const scaleOf = (page) => page.evaluate(SCALE);

// the box of the first shown element of selector, or of the frame of the selected element el, in slide px
// the frame of a figure with a caption, or of a group that holds one, is drawn CAPTIONED px outside
// it, and measured without them
const CAPTIONED = 8;
const inset = (el) => `(${el}.querySelector(':scope > figcaption, :scope > .caption') ? ${CAPTIONED} : 0)`;
const boxIn = (page, selector) => page.evaluate(`(() => {
  const f = ${SCALE};
  const sel = window.BeesonEditor.selection();
  const d = ${js(selector)} === ${js(FRAME)} && sel.length === 1 ? ${inset('sel[0]')} : ${js(selector)}.endsWith('.union') ? Math.max(0, ...sel.map((e) => ${inset('e')})) : 0;
  const r = [...document.querySelectorAll(${js(selector)})].filter((e) => !e.hidden).map((e) => e.getBoundingClientRect()).find((r) => r.width);
  return r ? { left: (r.left + d - f.left) / f.k, top: (r.top + d - f.top) / f.k, width: (r.width - 2 * d) / f.k, height: (r.height - 2 * d) / f.k } : null;
})()`);
const frameOfFigure = (page) => page.evaluate(`(() => {
  const f = ${SCALE};
  const sel = window.BeesonEditor.selection(), i = sel.findIndex((el) => el.matches('figure, .plate')), d = ${inset('sel[i]')};
  const r = [...document.querySelectorAll(${js(FRAME)})][i].getBoundingClientRect();
  return { left: (r.left + d - f.left) / f.k, top: (r.top + d - f.top) / f.k, width: (r.width - 2 * d) / f.k, height: (r.height - 2 * d) / f.k };
})()`);
const right = (b) => b.left + b.width;
const bottom = (b) => b.top + b.height;
const cx = (b) => b.left + b.width / 2;
const cy = (b) => b.top + b.height / 2;
const toScreen = (f, x, y) => ({ x: f.left + x * f.k, y: f.top + y * f.k });

async function load(t, platform, mode, n, deck = DECK) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  // without this, headless Chrome cancels the file chooser, and the cancel races the file of choose
  await page.send('Page.setInterceptFileChooserDialog', { enabled: true });
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  if ((await page.evaluate('Beeson.theme.get()')) !== mode) await page.evaluate('Beeson.theme.toggle()');
  page.source = deck === DECK ? SOURCE : readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  page.figure = n === PLATE_PAIR || n === PLATE_ONE ? 'div.plate' : 'figure.zone';
  return page;
}

// the figure selected by a click on its picture
async function pick(page) {
  await page.evaluate('document.activeElement instanceof HTMLElement && document.activeElement.blur()');
  for (let i = 0; i < 3 && (await selected(page)).length; i++) await exec(page, 'selection.clear');
  await frames(page);
  await click(page, IMG);
  await frames(page);
  assert.deepEqual(await selected(page), [page.figure], 'the figure is not selected by a click on its picture');
}

// the edit is in the scope rule wherever the text before it is
function inScope(edited, source) {
  const now = textProblems(edited, THEME);
  for (const p of textProblems(source, THEME)) {
    const i = now.indexOf(p);
    if (i >= 0) now.splice(i, 1);
  }
  assert.deepEqual(now, [], 'the edit writes outside the scope rule');
}

// the edit, the file byte for byte after an undo, the edit again after a redo, and the file again
// after a second undo, from which the next command starts
async function roundTrip(page, edited) {
  assert.notEqual(edited, page.source, 'the command does not change the file');
  inScope(edited, page.source);
  await undo(page);
  await frames(page);
  await byteExact(page);
  await redo(page);
  await frames(page);
  assert.equal(await render(page), edited, 'a redo does not write the edit again');
  await undo(page);
  await frames(page);
  await byteExact(page);
}

const showTab = async (page, name) => {
  await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].find((b) => b.textContent === ${js(name)})?.click()`);
  await frames(page);
};
async function fieldValue(page, id) {
  await showTab(page, 'Arrange');
  return Number(await page.evaluate(`document.querySelector('#beeson-edit-num-${id}')?.value`));
}
async function typeField(page, id, value) {
  await showTab(page, 'Arrange');
  const input = `#beeson-edit-num-${id}`;
  assert.equal(await page.evaluate(`!!document.querySelector('${input}') && !document.querySelector('${input}').disabled`), true, `the field ${id} is not enabled`);
  await page.evaluate(`(() => { const i = document.querySelector('${input}'); i.focus(); i.select(); })()`);
  await type(page, String(value));
  await press(page, 'Enter');
  await frames(page);
}

// the edge or center of box b that Align puts at that of the box ref, by the side aligned to
const ALIGNED = {
  left: (b, ref) => [b.left, ref.left],
  center: (b, ref) => [cx(b), cx(ref)],
  right: (b, ref) => [right(b), right(ref)],
  top: (b, ref) => [b.top, ref.top],
  middle: (b, ref) => [cy(b), cy(ref)],
  bottom: (b, ref) => [bottom(b), bottom(ref)],
};
const WHOLE = { left: 0, top: 0, width: SLIDE.width, height: SLIDE.height };

// the readout of the frames, next to the pointer or the frame
const readout = (page) => page.evaluate(`(() => { const r = document.querySelector('.beeson-overlay > .beeson-offset'); return r && !r.hidden ? r.textContent : null; })()`);

// whether a vertical guide is drawn at x, in slide px
const guideAt = (page, f, x) => page.evaluate(`[...document.querySelectorAll('.beeson-overlay > .beeson-guide.v')].some((g) => !g.hidden && Math.abs(g.getBoundingClientRect().left - ${f.left + x * f.k}) < 1.5)`);

// a point on the text of the heading on the screen
const headingPoint = (page) => page.evaluate(`(() => { const r = document.querySelector(${js(HEADING)}).getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);

const release = (page, x, y, modifiers = 0) => page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, modifiers });

for (const platform of PLATFORMS) {
  for (const mode of MODES) {
    test(`the X and Y fields, Size and Position…, Align, and Distribute take the frame of a figure, on ${platform} in ${mode} mode`, async (t) => {
      for (const n of FIGURES) {
        const page = await load(t, platform, mode, n);
        const where = `${NAMES[n]} on ${platform} in ${mode} mode`;
        await pick(page);
        const frame = await boxIn(page, FRAME);
        assert.equal(await fieldValue(page, 'x'), Math.round(frame.left), `X of ${where}, whose frame is at ${show(frame)}`);
        assert.equal(await fieldValue(page, 'y'), Math.round(frame.top), `Y of ${where}, whose frame is at ${show(frame)}`);
        await exec(page, 'arrange.sizeAndPosition');
        await frames(page);
        assert.equal(await fieldValue(page, 'x'), Math.round(frame.left), `X after Size and Position… of ${where}`);

        for (const side of Object.keys(ALIGNED)) {
          await exec(page, `arrange.align.${side}`);
          await frames(page);
          const now = await boxIn(page, FRAME);
          const [at, to] = ALIGNED[side](now, WHOLE);
          assert.ok(near(at, to), `Align ${side} of ${where} puts its frame at ${show(now)}`);
          assert.deepEqual(await selected(page), [page.figure], `Align ${side} of ${where} changes the selection`);
          const edited = await render(page);
          // a frame at the edge already is not moved
          if (edited !== page.source) await roundTrip(page, edited);
          const back = await boxIn(page, FRAME);
          assert.ok(near(back.left, frame.left) && near(back.top, frame.top), `an undo of Align ${side} of ${where} leaves the frame at ${show(back)}`);
        }
        for (const axis of ['horizontal', 'vertical']) {
          await exec(page, `arrange.distribute.${axis}`);
          await frames(page);
          const now = await boxIn(page, FRAME);
          const [at, to] = axis === 'horizontal' ? [cx(now), SLIDE.width / 2] : [cy(now), SLIDE.height / 2];
          assert.ok(near(at, to), `Distribute ${axis} of ${where} puts its frame at ${show(now)}`);
          await roundTrip(page, await render(page));
        }
        await typeField(page, 'x', 100);
        await typeField(page, 'y', 140);
        const typed = await boxIn(page, FRAME);
        assert.ok(near(typed.left, 100) && near(typed.top, 140), `a typed X and Y of ${where} put its frame at ${show(typed)}`);
        assert.equal(await fieldValue(page, 'x'), 100);
        assert.equal(await fieldValue(page, 'y'), 140);
        // the two fields are two entries of the history
        const edited = await render(page);
        await undo(page);
        await frames(page);
        await roundTrip(page, await render(page));
        await redo(page);
        await redo(page);
        await frames(page);
        assert.equal(await render(page), edited);
        assert.deepEqual(errors(page), []);
        // closed before the next page, which would offer its unsaved edits on a card
        await page.close();
      }
    });

    test(`Align and Distribute of a figure with other elements take its frame, on ${platform} in ${mode} mode`, async (t) => {
      for (const n of FIGURES) {
        const page = await load(t, platform, mode, n);
        const where = `${NAMES[n]} on ${platform} in ${mode} mode`;
        await pick(page);
        const frame = await boxIn(page, FRAME);
        const h = await boxIn(page, HEADING);
        await click(page, await headingPoint(page), { modifiers: 'Shift' });
        await frames(page);
        assert.deepEqual((await selected(page)).sort(), [page.figure, 'h2'].sort());
        for (const side of ['right', 'bottom']) {
          const ref = { left: 0, top: 0, width: Math.max(right(h), right(frame)), height: Math.max(bottom(h), bottom(frame)) };
          await exec(page, `arrange.align.${side}`);
          await frames(page);
          const now = await frameOfFigure(page);
          const heading = await boxIn(page, HEADING);
          const [at, to] = ALIGNED[side](now, ref);
          assert.ok(near(at, to), `Align ${side} of ${where} with the heading puts its frame at ${show(now)}, and not at ${Math.round(to)}`);
          assert.ok(near(ALIGNED[side](heading, ref)[0], to), `Align ${side} of ${where} with the heading puts the heading at ${show(heading)}`);
          await roundTrip(page, await render(page));
        }
        if (n === ZONE_PAIR || n === ZONE_ONE) {
          // the heading, a paragraph, and the figure spaced evenly between the outer two
          await click(page, '.reveal section.present > p', { modifiers: 'Shift' });
          await frames(page);
          assert.equal((await selected(page)).length, 3);
          const p = await boxIn(page, '.reveal section.present > p');
          const span = [Math.min(h.top, p.top, frame.top), Math.max(bottom(h), bottom(p), bottom(frame))];
          await exec(page, 'arrange.distribute.vertical');
          await frames(page);
          const boxes = [await boxIn(page, HEADING), await boxIn(page, '.reveal section.present > p'), await frameOfFigure(page)].sort((a, b) => a.top - b.top);
          const gaps = [boxes[1].top - bottom(boxes[0]), boxes[2].top - bottom(boxes[1])];
          assert.ok(near(gaps[0], gaps[1]), `Distribute Vertically of ${where} leaves the gaps ${gaps.map(Math.round).join(' and ')}`);
          assert.ok(near(boxes[0].top, span[0]) && near(Math.max(...boxes.map(bottom)), span[1]), `Distribute Vertically of ${where} spaces the three over ${Math.round(boxes[0].top)} to ${Math.round(Math.max(...boxes.map(bottom)))}, and not over the frames from ${span.map(Math.round).join(' to ')}`);
          await roundTrip(page, await render(page));
        }
        assert.deepEqual(errors(page), []);
        // closed before the next page, which would offer its unsaved edits on a card
        await page.close();
      }
    });

    test(`the readouts of a drag and a nudge, Zoom to Selection, and a group take the frame of a figure, on ${platform} in ${mode} mode`, async (t) => {
      for (const n of FIGURES) {
        const page = await load(t, platform, mode, n);
        const where = `${NAMES[n]} on ${platform} in ${mode} mode`;
        await pick(page);
        const frame = await boxIn(page, FRAME);
        const f = await scaleOf(page);

        await press(page, 'ArrowRight');
        await frames(page);
        const nudged = await boxIn(page, FRAME);
        assert.equal(await readout(page), `x: ${Math.round(nudged.left)} px  y: ${Math.round(nudged.top)} px`, `the readout of a nudge of ${where}, whose frame is at ${show(nudged)}`);
        await roundTrip(page, await render(page));

        // a drag without the snap, with ⌘ on a Mac and Alt elsewhere
        const at = toScreen(f, cx(frame), cy(frame));
        const d = { x: 41, y: 27 };
        const free = platform === 'mac' ? 'Meta' : 'Alt';
        await drag(page, at, { dx: d.x * f.k, dy: d.y * f.k, hold: true, modifiers: free });
        const shown = await readout(page);
        await release(page, at.x + d.x * f.k, at.y + d.y * f.k, platform === 'mac' ? 4 : 1);
        await frames(page);
        assert.equal(shown, `x: ${Math.round(frame.left + d.x)} px  y: ${Math.round(frame.top + d.y)} px`, `the readout of a drag of ${where} from its frame at ${show(frame)}`);
        await roundTrip(page, await render(page));

        await exec(page, 'zoom.selection');
        await frames(page);
        const off = await page.evaluate(`(() => {
          const v = window.BeesonEditorShell.stage.viewport;
          const r = document.querySelector(${js(FRAME)}).getBoundingClientRect();
          return { x: r.left + r.width / 2 - (v.left + v.width / 2), y: r.top + r.height / 2 - (v.top + v.height / 2) };
        })()`);
        assert.ok(Math.abs(off.x) < 2 && Math.abs(off.y) < 2, `Zoom to Selection leaves the frame of ${where} off the center of the canvas by ${Math.round(off.x)}, ${Math.round(off.y)}`);
        await page.evaluate('window.BeesonEditorShell.stage.setZoom(null)');
        await frames(page);

        const h = await boxIn(page, HEADING);
        await click(page, await headingPoint(page), { modifiers: 'Shift' });
        await exec(page, 'arrange.group');
        await frames(page);
        const union = { left: Math.min(h.left, frame.left), top: Math.min(h.top, frame.top), right: Math.max(right(h), right(frame)), bottom: Math.max(bottom(h), bottom(frame)) };
        const drawn = await boxIn(page, '.beeson-overlay > .beeson-frame.union');
        assert.ok(near(drawn.left, union.left) && near(drawn.top, union.top) && near(right(drawn), union.right) && near(bottom(drawn), union.bottom), `the frame of a group of ${where} is at ${show(drawn)}`);
        assert.equal(await fieldValue(page, 'x'), Math.round(union.left), `X of a group of ${where}`);
        assert.equal(await fieldValue(page, 'y'), Math.round(union.top), `Y of a group of ${where}`);
        assert.deepEqual(errors(page), []);
        // closed before the next page, which would offer its unsaved edits on a card
        await page.close();
      }
    });

    test(`a drag snaps the frame of a figure, and another element to it, on ${platform} in ${mode} mode`, async (t) => {
      for (const n of FIGURES) {
        const page = await load(t, platform, mode, n);
        const where = `${NAMES[n]} on ${platform} in ${mode} mode`;
        await pick(page);
        const frame = await boxIn(page, FRAME);
        const f = await scaleOf(page);

        // the center of the frame dragged to 2 px right of the center of the slide, nearer than any other line
        const at = toScreen(f, cx(frame), cy(frame));
        const dx = SLIDE.width / 2 + 2 - cx(frame);
        await drag(page, at, { dx: dx * f.k, dy: 0, hold: true });
        const guide = await guideAt(page, f, SLIDE.width / 2);
        const all = await page.evaluate(`[...document.querySelectorAll('.beeson-overlay > .beeson-guide')].filter((g) => !g.hidden).map((g) => { const r = g.getBoundingClientRect(); return g.classList.contains('v') ? 'x ' + Math.round((r.left - ${f.left}) / ${f.k}) : 'y ' + Math.round((r.top - ${f.top}) / ${f.k}); }).join(', ')`);
        await release(page, at.x + dx * f.k, at.y);
        await frames(page);
        const now = await boxIn(page, FRAME);
        assert.ok(near(cx(now), SLIDE.width / 2, 0.6), `a drag of ${where} to the center of the slide puts the center of its frame at ${Math.round(cx(now))}, with the guides ${all}`);
        assert.ok(guide, `a drag of ${where} to the center of the slide draws no guide at its center`);
        await roundTrip(page, await render(page));

        // the heading selected as a block and dragged by its handle to 2 px right of the center
        // of the frame
        const h = await boxIn(page, HEADING);
        await click(page, await headingPoint(page));
        await press(page, 'Escape');
        await frames(page);
        assert.deepEqual(await selected(page), ['h2'], 'Esc in the heading does not select it');
        const from = await page.evaluate(`(() => { const r = document.querySelector('.beeson-handle').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        const hx = cx(frame) + 2 - cx(h);
        await drag(page, from, { dx: hx * f.k, dy: 0, hold: true });
        const line = await guideAt(page, f, cx(frame));
        await release(page, from.x + hx * f.k, from.y);
        await frames(page);
        const moved = await boxIn(page, HEADING);
        assert.ok(near(cx(moved), cx(frame), 0.6), `a drag of the heading to the center of the frame of ${where} at ${Math.round(cx(frame))} puts its center at ${Math.round(cx(moved))}`);
        assert.ok(line, `a drag of the heading to the center of the frame of ${where} draws no guide there`);
        await roundTrip(page, await render(page));
        assert.deepEqual(errors(page), []);
        // closed before the next page, which would offer its unsaved edits on a card
        await page.close();
      }
    });
  }
}

// the items of the open context menu, each with its text and whether it is dimmed
const menuItems = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].filter((i) => i.getClientRects().length).map((i) => ({ text: i.textContent.trim().replace(/\\s+/g, ' '), off: i.classList.contains('disabled') || i.getAttribute('aria-disabled') === 'true' }))`);
const KIND_ITEMS = ['Replace Image…', 'Edit Alt Text…', 'Edit Mask'];

for (const platform of PLATFORMS) {
  for (const mode of MODES) {
    test(`the context menu of a locked figure shows Replace Image…, Edit Alt Text…, and Edit Mask dimmed, on ${platform} in ${mode} mode`, async (t) => {
      for (const n of FIGURES) {
        const page = await load(t, platform, mode, n);
        const where = `${NAMES[n]} on ${platform} in ${mode} mode`;
        await pick(page);
        await click(page, IMG, { button: 'right' });
        await frames(page);
        const open = await menuItems(page);
        for (const name of KIND_ITEMS) assert.equal(open.find((i) => i.text.startsWith(name))?.off, false, `${name} is not live in the menu of ${where}`);
        await press(page, 'Escape');
        await exec(page, 'arrange.lock');
        await frames(page);
        const locked = await render(page);
        await click(page, IMG, { button: 'right' });
        await frames(page);
        const items = await menuItems(page);
        for (const name of KIND_ITEMS) assert.equal(items.find((i) => i.text.startsWith(name))?.off, true, `${name} is not shown dimmed in the menu of ${where} once it is locked, among ${items.map((i) => i.text).join(', ')}`);
        await press(page, 'Escape');
        await frames(page);
        await roundTrip(page, locked);
        assert.deepEqual(errors(page), []);
        await page.close();
      }
    });
  }
}

const STEPPED = 5;
const ADD = 'Add as Last Step';

for (const platform of PLATFORMS) {
  for (const mode of MODES) {
    test(`a figure whose images are a step is not offered Add as Last Step, and one that is not a step is, on ${platform} in ${mode} mode`, async (t) => {
      const page = await load(t, platform, mode, STEPPED);
      page.figure = 'figure.zone';
      await pick(page);
      assert.equal((await state(page, 'steps.add')).enabled, false, 'Add as Last Step is enabled on a figure whose images are a step');
      await click(page, IMG, { button: 'right' });
      await frames(page);
      const item = (await menuItems(page)).find((i) => i.text.startsWith(ADD));
      assert.ok(!item || item.off, `the menu of a figure whose images are a step offers ${ADD}`);
      await press(page, 'Escape');
      await page.close();

      // a figure without a step takes it on its tag
      const other = await load(t, platform, mode, ZONE_ONE);
      await pick(other);
      assert.equal((await state(other, 'steps.add')).enabled, true, `${ADD} is dimmed on a figure without a step`);
      await exec(other, 'steps.add');
      await frames(other);
      const edited = await render(other);
      assert.equal(edited, SOURCE.replace('<figure class="zone">\n        <img src="../../demo/figure-light.png" alt="A figure in both modes">', '<figure class="zone fragment" data-fragment-index="1">\n        <img src="../../demo/figure-light.png" alt="A figure in both modes">'));
      assert.equal((await state(other, 'steps.add')).enabled, false, `${ADD} is enabled on a figure that it made a step`);
      await roundTrip(other, edited);
      assert.deepEqual(errors(other), []);
    });
  }
}

for (const platform of PLATFORMS) {
  test(`Show with Slide on a figure whose images are a step takes the step off both images, on ${platform}`, async (t) => {
    for (const mode of MODES) {
      const page = await load(t, platform, mode, STEPPED);
      page.figure = 'figure.zone';
      await pick(page);
      assert.equal((await state(page, 'steps.remove')).enabled, true, 'Show with Slide is dimmed on a figure whose images are a step');
      await exec(page, 'steps.remove');
      await frames(page);
      const edited = await render(page);
      const tags = [...edited.matchAll(/<img class="for-(dark|light)[^"]*" [^>]*data-id="curves"[^>]*>/g)].map((m) => m[0]);
      assert.equal(tags.length, 2);
      for (const tag of tags) assert.ok(!/fragment/.test(tag), `Show with Slide leaves the step on ${tag}`);
      assert.equal((await state(page, 'steps.add')).enabled, true, `${ADD} is dimmed once the figure is not a step`);
      await roundTrip(page, edited);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });
}

// a trusted press of the command modifier with a letter, sent with the editing command that the
// browser makes of it. Chrome on a Mac turns ⌘X into Cut in its Edit menu, and Chrome on Windows
// and Linux turns Ctrl+X into Cut in the page, and over the DevTools protocol a key without its
// command is not turned into one on a Mac
async function pressEdit(page, platform, letter, command) {
  const base = { key: letter, code: `Key${letter.toUpperCase()}`, windowsVirtualKeyCode: letter.toUpperCase().charCodeAt(0), modifiers: platform === 'mac' ? 4 : 2 };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base, commands: [command] });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await page.evaluate('new Promise((d) => setTimeout(d, 100))');
  await frames(page);
}

const EMPTY = 4;
const count = (text, part) => text.split(part).length - 1;

for (const platform of PLATFORMS) {
  for (const mode of MODES) {
    test(`Cut, Copy, and Paste of a figure by their keys, on ${platform} in ${mode} mode`, async (t) => {
      for (const n of [ZONE_PAIR, PLATE_ONE]) {
        const page = await load(t, platform, mode, n);
        const where = `${NAMES[n]} on ${platform} in ${mode} mode`;
        await page.send('Browser.grantPermissions', { origin: server.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
        await pick(page);
        const caption = n === ZONE_PAIR ? 'A caption under the pair.' : 'A caption of the one image in a plate.';
        const img = n === ZONE_PAIR ? '<img class="for-dark"' : '<img src="../../demo/figure-light.png" alt="A plate in both modes">';

        await pressEdit(page, platform, 'x', 'cut');
        const cut = await render(page);
        assert.equal(count(slideOf(cut, n), img), 0, `the key of Cut leaves ${where}`);
        assert.deepEqual(await selected(page), [], `the key of Cut leaves ${where} selected`);
        await undo(page);
        await frames(page);
        await byteExact(page);
        assert.deepEqual(await selected(page), [page.figure], `an undo of a Cut of ${where} does not select it again`);
        await redo(page);
        await frames(page);
        assert.equal(await render(page), cut);
        await undo(page);
        await frames(page);

        await pressEdit(page, platform, 'c', 'copy');
        await byteExact(page);
        await page.evaluate(`Reveal.slide(${EMPTY})`);
        await frames(page);
        await exec(page, 'selection.clear');
        await pressEdit(page, platform, 'v', 'paste');
        const pasted = await render(page);
        assert.equal(count(slideOf(pasted, EMPTY), img), 1, `the keys of Copy and Paste do not put ${where} on another slide`);
        assert.equal(count(slideOf(pasted, EMPTY), caption), n === ZONE_PAIR ? 1 : 0, `the keys of Copy and Paste of ${where} do not bring the caption that it holds`);
        // a plate pasted onto a content slide is made a zone
        assert.deepEqual(await selected(page), [n === ZONE_PAIR ? 'figure.zone' : 'div.zone'], `the figure pasted from ${where} is not selected`);
        await roundTrip(page, pasted);
        assert.deepEqual(errors(page), []);
        await page.close();
      }
    });
  }
}

// the text of slide n
function slideOf(text, n) {
  const at = [...text.matchAll(/<section[ >]/g)][n].index;
  return text.slice(at, text.indexOf('</section>', at));
}

// the file chosen for an insert of a picture, given to the file chooser of the page
async function choose(page, id, file) {
  const chosen = exec(page, id);
  await page.waitFor(`!!document.querySelector('input.beeson-media-input')`);
  const { result } = await page.send('Runtime.evaluate', { expression: `document.querySelector('input.beeson-media-input')` });
  await page.send('DOM.setFileInputFiles', { files: [resolve(file)], objectId: result.objectId });
  await chosen;
}

// each insert whose kind the placeholder of an empty slot offers, as its name, its run, and the
// start of the tag of its element in the file
const SLOTTED = [
  ['Insert > Table', (page) => exec(page, 'insert.table', { rows: 3, columns: 3 }), 'table', '<table'],
  ['Insert > QR Code', (page) => exec(page, 'insert.qr'), '.qr', '<div class="qr"'],
  ['Insert > Image', (page) => choose(page, 'insert.image', 'demo/figure-light.png'), 'img', '<img'],
  ['Insert > Video', (page) => choose(page, 'insert.video', 'demo/clip-dark.mp4'), 'video', '<video'],
];
const SLOT_OF = { figure: '.plate', split: '.zone' };
const TAG_OF = { figure: '<div class="plate">', split: '<div class="zone">' };
const holders = (page) => page.evaluate(`[...document.querySelectorAll('.reveal section.present > :is(.zone, .plate)')].map((s) => !!s.querySelector(':scope > .beeson-placeholder'))`);
const holds = (page, slot, el) => page.evaluate(`[...document.querySelectorAll('.reveal section.present > ${slot}')].map((s) => !!s.querySelector(':scope > ${el}'))`);
const settle = async (page) => {
  await page.evaluate('new Promise((d) => setTimeout(d, 300))');
  await frames(page);
};

// gap 5 of R8.7: Insert > Table and Insert > QR Code put their element over the empty slot of a
// new figure or split slide, with the placeholder of the slot drawn through it. each insert that
// the placeholder offers fills the slot, as the icon of its kind does, and the placeholder is gone
for (const platform of PLATFORMS) {
  for (const layout of ['figure', 'split']) {
    test(`every insert of a kind of the placeholder fills the empty slot of a new ${layout} slide, on ${platform}`, async (t) => {
      const page = await load(t, platform, 'dark', 0);
      const slot = SLOT_OF[layout];
      for (const [what, run, el, tag] of SLOTTED) {
        await exec(page, `slide.new.${layout}`);
        await frames(page);
        // the caret of the new slide is in its title, and the second Esc leaves its block
        await press(page, 'Escape');
        await press(page, 'Escape');
        await frames(page);
        const n = await page.evaluate('Reveal.getIndices().h');
        const before = await render(page);
        assert.deepEqual(await holders(page), [true], `the new ${layout} slide does not show the placeholder of its slot`);
        await run(page);
        await settle(page);
        const edited = await render(page);
        assert.deepEqual(await holds(page, slot, el), [true], `${what} does not put its element into the ${slot} of a new ${layout} slide`);
        assert.ok(new RegExp(`${TAG_OF[layout]}\\s*${tag}`).test(slideOf(edited, n)), `${what} does not write its element into the ${slot} of the file:\n${slideOf(edited, n)}`);
        assert.deepEqual(await holders(page), [false], `${what} leaves the placeholder of the ${slot} of a new ${layout} slide`);
        inScope(edited, before);
        await undo(page);
        await settle(page);
        assert.equal(await render(page), before, `an undo of ${what} does not give the file back`);
        assert.deepEqual(await holders(page), [true], `an undo of ${what} does not show the placeholder again`);
        await redo(page);
        await settle(page);
        assert.equal(await render(page), edited, `a redo of ${what} does not write it again`);
        assert.deepEqual(await holds(page, slot, el), [true], `a redo of ${what} does not put its element into the ${slot}`);
        assert.deepEqual(await holders(page), [false], `a redo of ${what} shows the placeholder again`);
      }
      assert.deepEqual(errors(page), []);
    });
  }
}

// on a slide with two empty slots, an insert fills the first, and the icon of a slot fills its slot
const TWO = 'test/pages/editor-two-slots.html';
for (const platform of PLATFORMS) {
  test(`an insert fills the first of two empty slots and an icon fills its own, on ${platform}`, async (t) => {
    const page = await load(t, platform, 'dark', 0, TWO);
    const runs = [
      ...SLOTTED.map(([what, run, el, tag]) => [what, run, el, tag, [true, false]]),
      ['the QR icon of the second slot', (page) => click(page, '.reveal section.present > .zone:last-of-type .beeson-placeholder button[data-insert="qr"]'), '.qr', '<div class="qr"', [false, true]],
    ];
    for (const [what, run, el, tag, into] of runs) {
      await exec(page, 'selection.clear');
      await frames(page);
      assert.deepEqual(await holders(page), [true, true]);
      await run(page);
      await settle(page);
      const edited = await render(page);
      assert.deepEqual(await holds(page, '.zone', el), into, `${what} does not fill the slot ${into.indexOf(true) + 1} of two`);
      assert.deepEqual(await holders(page), into.map((x) => !x), `${what} does not take off the placeholder of the slot it fills only`);
      const zones = [...slideOf(edited, 0).matchAll(/<div class="zone"[^>]*>([\s\S]*?)<\/div>\n/g)].map((m) => m[1].trimStart().startsWith(tag));
      assert.deepEqual(zones, into, `${what} does not write its element into the slot ${into.indexOf(true) + 1} of the file:\n${slideOf(edited, 0)}`);
      inScope(edited, page.source);
      await undo(page);
      await settle(page);
      await byteExact(page);
      await redo(page);
      await settle(page);
      assert.equal(await render(page), edited, `a redo of ${what} does not write it again`);
      await undo(page);
      await settle(page);
      await byteExact(page);
    }
    assert.deepEqual(errors(page), []);
  });
}
