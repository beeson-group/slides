// tests of R27.1 on both platforms, connection lines as the connectors of PowerPoint: an end of a
// line drawn or dragged onto an element is glued to it, written as data-anchor on the element and
// data-from or data-to on the svg, and it follows every change of the box of the element in the
// same entry of the history. a move of the whole line, a delete of the element, and a copy
// without the element take the glue off, and a copy with the element glues the copy to the copies.
// the Line pane names each glued end. each edit is checked byte for byte after an undo and a redo

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test/pages/editor-r27-1.html';
const SOURCE = readFileSync(DECK, 'utf8');
const SLIDE = '.reveal .slides > section.present';
const PANEL = '#beeson-edit-panel-format';
const [EMPTY, GLUED, GROUPED, STACK] = [0, 1, 2, 3];

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
const sleep = (ms) => new Promise((d) => setTimeout(d, ms));
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}, ${js(arg ?? null)} ?? undefined)).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const free = (platform) => (platform === 'mac' ? 'Meta' : 'Alt');
const copyKey = (platform) => (platform === 'mac' ? 'Alt' : 'Ctrl');
// a function of the page called with the arguments
const call = (page, fn, ...args) => page.evaluate(`(${fn})(${args.map(js).join(', ')})`);

async function load(t, platform, slide = EMPTY, text = SOURCE) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${DECK}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(text)})`)).problems, []);
  page.source = text;
  await page.evaluate(`Reveal.slide(${slide})`);
  await sleep(150);
  return page;
}

// the point on the screen of a point in slide px
function screenOf(p) {
  const s = document.querySelector('.reveal .slides');
  const r = s.getBoundingClientRect();
  const k = r.width / s.offsetWidth;
  return { x: r.left + p.x * k, y: r.top + p.y * k };
}
const screen = (page, x, y) => call(page, screenOf, { x, y });
const scale = (page) => page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'); return s.getBoundingClientRect().width / s.offsetWidth; })()`);

// the lines of the current slide: their glue and their two ends in slide px, rounded
function linesNow(slide) {
  return [...document.querySelector(slide).querySelectorAll('svg.line')].map((svg) => {
    const [tx, ty] = (svg.style.translate || '0px 0px').split(/\s+/).map((v) => parseFloat(v) || 0);
    const c = svg.querySelector(':scope > line, :scope > path');
    let a, b;
    if (c.localName === 'line') {
      a = { x: +c.getAttribute('x1'), y: +c.getAttribute('y1') };
      b = { x: +c.getAttribute('x2'), y: +c.getAttribute('y2') };
    } else {
      const n = c.getTotalLength();
      a = c.getPointAtLength(0);
      b = c.getPointAtLength(n);
    }
    return { from: svg.getAttribute('data-from'), to: svg.getAttribute('data-to'), ends: [a.x + tx, a.y + (ty || 0), b.x + tx, b.y + (ty || 0)].map(Math.round) };
  });
}
const lines = (page) => call(page, linesNow, SLIDE);

// the names of data-anchor on the slide, in document order, with the kind of each element
const anchors = (page) => page.evaluate(`[...document.querySelector(${js(SLIDE)}).querySelectorAll('[data-anchor]')].map((el) => el.getAttribute('data-anchor') + ' ' + el.localName)`);

// for each glued end of the current slide, its distance in slide px from its place in the box of
// its element, i.e. the box of the style of a shape turned by its rotate, or the box seen of any
// other element
function offsets(slide) {
  const s = document.querySelector('.reveal .slides');
  const r = s.getBoundingClientRect();
  const k = r.width / s.offsetWidth;
  const root = document.querySelector(slide);
  const place = (v) => {
    const [name, fx, fy] = v.split(/\s+/);
    const el = root.querySelector(`[data-anchor="${name}"]`);
    if (!el) return null;
    let box, deg = 0;
    if (el.matches('.shape')) {
      const [tx, ty] = (el.style.translate || '0px 0px').split(/\s+/).map((v) => parseFloat(v) || 0);
      box = { left: tx, top: ty || 0, width: parseFloat(el.style.width), height: parseFloat(el.style.height) };
      deg = parseFloat(el.style.rotate) || 0;
    } else {
      const b = el.getBoundingClientRect();
      box = { left: (b.left - r.left) / k, top: (b.top - r.top) / k, width: b.width / k, height: b.height / k };
    }
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    const x = box.left + +fx * box.width - cx, y = box.top + +fy * box.height - cy;
    const a = (deg * Math.PI) / 180;
    return { x: cx + x * Math.cos(a) - y * Math.sin(a), y: cy + x * Math.sin(a) + y * Math.cos(a) };
  };
  const out = [];
  for (const svg of root.querySelectorAll('svg.line')) {
    const [tx, ty] = (svg.style.translate || '0px 0px').split(/\s+/).map((v) => parseFloat(v) || 0);
    const c = svg.querySelector(':scope > line, :scope > path');
    const n = c.localName === 'path' ? c.getTotalLength() : 0;
    const a = c.localName === 'line' ? { x: +c.getAttribute('x1'), y: +c.getAttribute('y1') } : c.getPointAtLength(0);
    const b = c.localName === 'line' ? { x: +c.getAttribute('x2'), y: +c.getAttribute('y2') } : c.getPointAtLength(n);
    for (const [attr, p] of [['data-from', a], ['data-to', b]]) {
      const v = svg.getAttribute(attr);
      if (!v) continue;
      const at = place(v);
      out.push(at ? Math.round(Math.hypot(p.x + tx - at.x, p.y + (ty || 0) - at.y)) : -1);
    }
  }
  return out;
}
const glued = async (page, count) => {
  const d = await call(page, offsets, SLIDE);
  assert.equal(d.length, count, `the slide does not have ${count} glued ends: ${js(d)}`);
  assert.ok(d.every((v) => v >= 0 && v <= 1), `a glued end is off its place in the box of its element: ${js(d)}`);
};

// an undo gives back the text before, and a redo the text after
async function undoRedo(page, before, after) {
  await undo(page);
  await frames(page);
  assert.equal(await render(page), before, 'one undo does not give the file back');
  await redo(page);
  await frames(page);
  assert.equal(await render(page), after, 'a redo does not write the edit again');
}

// the start tag of the svg of the first line in a text
const lineTag = (text) => /<svg class="line"[^>]*>/.exec(text)?.[0];

// F78. two rounded rectangles, a curved arrow drawn from the right edge of the first to the left edge
// of the second, and a nudge of the first by 120 slide px with Shift and the arrow key. the tail of
// the arrow stays at the middle of the right edge of the box
for (const platform of PLATFORMS) {
  test(`F78: a curved arrow drawn between two boxes follows a nudge of the first box (${platform})`, async (t) => {
    const page = await load(t, platform, EMPTY);
    await exec(page, 'insert.shape.rounded', { box: { left: 279, top: 463, width: 241, height: 148 } });
    await exec(page, 'insert.shape.rounded', { box: { left: 1186, top: 463, width: 241, height: 148 } });
    await exec(page, 'insert.curve');
    const k = await scale(page);
    await drag(page, await screen(page, 520, 537), { dx: (1186 - 520) * k, dy: 0, steps: 12 });
    await sleep(100);
    const [drawn] = await lines(page);
    assert.deepEqual(drawn.ends, [520, 537, 1186, 537], 'the arrow is not drawn between the edges');
    assert.deepEqual(await anchors(page), ['a1 div', 'a2 div'], 'the two boxes are not named');
    assert.equal(drawn.from, 'a1 1 0.5', 'the tail is not glued to the middle of the right edge of the first box');
    assert.equal(drawn.to, 'a2 0 0.5', 'the head is not glued to the middle of the left edge of the second box');
    const before = await render(page);
    await click(page, await screen(page, 399, 537));
    await frames(page);
    for (let i = 0; i < 12; i++) await press(page, 'Shift+ArrowRight');
    await sleep(100);
    const box = await page.evaluate(`document.querySelector(${js(`${SLIDE} > .shape`)}).style.translate`);
    assert.equal(box, '399px 463px', 'the box is not nudged by 120 px');
    const [moved] = await lines(page);
    assert.deepEqual(moved.ends.slice(0, 2), [640, 537], 'the tail of the arrow is left behind by the box');
    assert.deepEqual(moved.ends.slice(2), [1186, 537], 'the head of the arrow is moved');
    await glued(page, 2);
    await undoRedo(page, before, await render(page));
    assert.deepEqual(errors(page), []);
  });
}

// rule 1. an end drawn onto an element is glued at the pointer, or at the middle of the nearest edge
// within 16 slide px of it. a text in the flow, a line, and a drag with the free key do not glue, and
// a text moved as a box does. the element under a dragged end is outlined
for (const platform of PLATFORMS) {
  test(`rule 1: the ends of a drawn line are glued at the pointer or at the middle of an edge (${platform})`, async (t) => {
    const page = await load(t, platform, GLUED);
    const k = await scale(page);
    // from inside the first box, away from its edges, to 10 px under the middle of the top edge of the
    // ellipse
    await exec(page, 'insert.arrow');
    const a = await screen(page, 330, 520);
    await drag(page, a, { dx: (1306 - 330) * k, dy: (810 - 520) * k, steps: 12, hold: true });
    const outline = await call(page, (sel) => {
      const o = document.querySelector('.beeson-glue-target');
      const el = document.querySelector(sel);
      if (!o || o.hidden || !o.getClientRects().length) return null;
      const r = o.getBoundingClientRect(), e = el.getBoundingClientRect();
      const probe = document.createElement('div');
      probe.style.color = 'var(--ed-select)';
      document.body.append(probe);
      const accent = getComputedStyle(probe).color;
      probe.remove();
      return { d: Math.max(Math.abs(r.left - e.left), Math.abs(r.top - e.top), Math.abs(r.right - e.right), Math.abs(r.bottom - e.bottom)), color: getComputedStyle(o).borderTopColor, accent };
    }, `${SLIDE} > .shape.ellipse`);
    assert.ok(outline, 'the element under the dragged end is not outlined');
    assert.ok(outline.d <= 3, `the outline is not at the box of the ellipse: ${outline.d}`);
    assert.equal(outline.color, outline.accent, 'the outline is not in the accent color');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: a.x + (1306 - 330) * k, y: a.y + (810 - 520) * k, button: 'left', clickCount: 1 });
    await sleep(100);
    assert.equal(await page.evaluate('document.querySelectorAll(".beeson-glue-target:not([hidden])").length'), 0, 'the outline stays after the release');
    const drawn = (await lines(page)).at(-1);
    assert.equal(drawn.to, 'a3 0.5 0', 'the head is not put at the middle of the top edge of the ellipse');
    assert.deepEqual(drawn.ends.slice(2), [1306, 800]);
    const [name, fx, fy] = (drawn.from ?? '').split(' ');
    assert.equal(name, 'a1', 'the tail is not glued to the first box');
    assert.ok(Math.abs(+fx * 241 + 279 - drawn.ends[0]) <= 1 && Math.abs(+fy * 148 + 463 - drawn.ends[1]) <= 1, `the tail is not glued at the pointer: ${drawn.from} ${drawn.ends}`);
    assert.ok(!['0.5', '0', '1'].includes(fx) || !['0.5', '0', '1'].includes(fy), 'the tail is put at an edge');
    assert.deepEqual(await anchors(page), ['a1 div', 'a2 div', 'a3 div']);
    await glued(page, 4);
    const after = await render(page);
    await undo(page);
    assert.equal(await render(page), SOURCE, 'one undo does not take the line and its glue off');
    await redo(page);
    assert.equal(await render(page), after);

    // with the free key, neither end is glued
    await exec(page, 'insert.line');
    await drag(page, await screen(page, 400, 540), { dx: (1300 - 400) * k, dy: (880 - 540) * k, steps: 12, modifiers: free(platform) });
    await sleep(100);
    const loose = (await lines(page)).at(-1);
    assert.deepEqual([loose.from, loose.to], [null, null], 'an end drawn with the free key is glued');
    // a text in the flow and another line do not take glue, and a text moved as a box does
    await exec(page, 'insert.line');
    await drag(page, await screen(page, 300, 270), { dx: (900 - 300) * k, dy: (950 - 270) * k, steps: 12 });
    await sleep(100);
    const onLine = (await lines(page)).at(-1);
    assert.deepEqual([onLine.from, onLine.to], [null, null], 'a text in the flow or a line takes glue');
    await exec(page, 'insert.line');
    const moved = await call(page, (sel) => { const p = [...document.querySelectorAll(sel)].at(-1).getBoundingClientRect(); return { x: p.left + p.width / 2, y: p.top + p.height / 2 }; }, `${SLIDE} > p`);
    const at = await screen(page, 1000, 300);
    await drag(page, at, { dx: moved.x - at.x, dy: moved.y - at.y, steps: 12 });
    await sleep(100);
    const onWords = (await lines(page)).at(-1);
    assert.equal(onWords.from, null);
    assert.match(onWords.to ?? '', /^a4 /, 'a text moved as a box does not take glue');
    // the moved words come before the shapes in the file
    assert.deepEqual(await anchors(page), ['a4 p', 'a1 div', 'a2 div', 'a3 div']);
    await saveAndReopen(page);
    assert.deepEqual(errors(page), []);
  });
}

// rule 2. the glue is written into the tags only, as attributes of the editor: a deck without glue
// and a deck with glue are written byte for byte by an open and a save, and the attributes are in
// the scope rule
for (const platform of PLATFORMS) {
  test(`rule 2: an open and a save keep a deck with and without glue byte for byte (${platform})`, async (t) => {
    const page = await load(t, platform, GLUED);
    await exec(page, 'insert.shape.rounded', { box: { left: 600, top: 200, width: 200, height: 100 } });
    await undo(page);
    const { text } = await saveAndReopen(page, 'glued.html');
    assert.equal(text, SOURCE, 'a deck with glue is changed by an open and a save');
    const plain = SOURCE.replace(/ data-(?:anchor|from|to)="[^"]*"/g, '');
    const bare = await load(t, platform, GLUED, plain);
    await exec(bare, 'insert.shape.rounded', { box: { left: 600, top: 200, width: 200, height: 100 } });
    await undo(bare);
    const saved = await saveAndReopen(bare, 'bare.html');
    assert.equal(saved.text, plain, 'a deck without glue is changed by an open and a save');
    assert.deepEqual(errors(page), []);
  });
}

// rule 3. whenever a glued element gets another box, its ends follow in the same entry of the history
const FOLLOW = [
  ['a drag', async (page) => {
    await drag(page, await screen(page, 399, 500), { dx: 90, dy: 60, steps: 10 });
  }],
  ['a typed X and Y', async (page) => {
    await click(page, await screen(page, 399, 500));
    await exec(page, 'arrange.setPosition', { x: 200, y: 300 });
  }],
  ['a typed Width and Height', async (page) => {
    await click(page, await screen(page, 399, 500));
    await exec(page, 'arrange.setSize', { w: 320 });
    await exec(page, 'arrange.setSize', { h: 200 });
  }],
  ['a resize by a grip', async (page) => {
    await click(page, await screen(page, 399, 500));
    await frames(page);
    const grip = await page.evaluate(`(() => { const g = [...document.querySelectorAll('.beeson-grip')].find((g) => g.dataset.handle === 'e' && g.getClientRects().length); if (!g) return null; const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    assert.ok(grip, 'the east grip of the box is not shown');
    await drag(page, grip, { dx: 80, dy: 0, steps: 8 });
  }],
  ['a turn', async (page) => {
    await click(page, await screen(page, 399, 500));
    await exec(page, 'arrange.setRotation', { deg: 30 });
  }],
  ['Align Bottom', async (page) => {
    await click(page, await screen(page, 399, 500));
    await click(page, await screen(page, 1306, 880), { modifiers: 'Shift' });
    await exec(page, 'arrange.align.bottom');
  }],
  // a line glued to the text moved as a box, which Reset Slide puts back into the flow
  ['Reset Slide', async (page) => {
    await exec(page, 'slide.reset');
  }, async (page) => {
    await exec(page, 'insert.line');
    const words = await call(page, (sel) => { const p = [...document.querySelectorAll(sel)].at(-1).getBoundingClientRect(); return { x: p.left + p.width / 2, y: p.top + p.height / 2 }; }, `${SLIDE} > p`);
    const at = await screen(page, 1000, 300);
    await drag(page, at, { dx: words.x - at.x, dy: words.y - at.y, steps: 12 });
    await sleep(100);
    return 3;
  }],
];
for (const platform of PLATFORMS) {
  for (const [name, run, prepare] of FOLLOW) {
    test(`rule 3: the glued ends follow ${name} of an element, undone with it in one step (${platform})`, async (t) => {
      const page = await load(t, platform, GLUED);
      const count = (await prepare?.(page)) ?? 2;
      await glued(page, count);
      const base = await render(page);
      const was = (await lines(page)).map((l) => l.ends);
      await run(page);
      await sleep(150);
      assert.notEqual(await render(page), base, `${name} does not change the deck`);
      await glued(page, count);
      assert.notDeepEqual((await lines(page)).map((l) => l.ends), was, 'the line does not follow');
      const after = await render(page);
      // each change of the box is one entry with the line in it
      const steps = name === 'a typed Width and Height' ? 2 : 1;
      for (let i = 0; i < steps; i++) await undo(page);
      assert.equal(await render(page), base, 'the undo does not put the box and the line back');
      for (let i = 0; i < steps; i++) await redo(page);
      assert.equal(await render(page), after, 'the redo does not move the box and the line again');
      await glued(page, count);
      assert.deepEqual(errors(page), []);
    });
  }

  test(`rule 3: a glued end follows a move of the group of its element (${platform})`, async (t) => {
    const page = await load(t, platform, GROUPED);
    await glued(page, 2);
    await drag(page, await screen(page, 300, 660), { dx: 60, dy: 90, steps: 10 });
    await sleep(150);
    assert.notEqual(await page.evaluate(`document.querySelector(${js(`${SLIDE} > .shape`)}).style.translate`), '200px 400px', 'the group is not moved');
    await glued(page, 2);
    await undoRedo(page, SOURCE, await render(page));
    // and a nudge of the box at the other end
    await click(page, await screen(page, 1300, 460));
    for (let i = 0; i < 3; i++) await press(page, 'ArrowDown');
    await sleep(100);
    await glued(page, 2);
    assert.deepEqual(errors(page), []);
  });
}

// rule 4. a drag of a glued end off its element takes its glue off, a drop on another element
// glues it there, a move of the whole line takes both off, a delete of the element leaves the line
// without its glue, and a copy keeps the glue only with the elements
const endGrip = (page, which) => page.evaluate(`(() => { const g = [...document.querySelectorAll('.beeson-line-end')].find((g) => !g.hidden && g.dataset.end === ${js(which)}); if (!g) return null; const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
for (const platform of PLATFORMS) {
  test(`rule 4: a dragged end is glued off and on, and a moved line is let go (${platform})`, async (t) => {
    const page = await load(t, platform, GLUED);
    const k = await scale(page);
    await click(page, await screen(page, 853, 454));
    await frames(page);
    assert.equal((await page.evaluate('window.BeesonEditor.selection()')).length, 1);
    // the head dragged onto the ellipse, near the middle of its left edge
    let grip = await endGrip(page, '2');
    await drag(page, grip, { dx: (1190 - 1186) * k, dy: (875 - 537) * k, steps: 10 });
    await sleep(100);
    let [l] = await lines(page);
    assert.equal(l.to, 'a3 0 0.5', 'the head is not glued to the ellipse');
    assert.deepEqual(await anchors(page), ['a1 div', 'a3 div'], 'the name of the box let go is kept, or the ellipse is not named');
    await glued(page, 2);
    await undoRedo(page, SOURCE, await render(page));
    // the head dragged off to the empty slide
    grip = await endGrip(page, '2');
    await drag(page, grip, { dx: -200 * k, dy: 100 * k, steps: 10 });
    await sleep(100);
    [l] = await lines(page);
    assert.equal(l.to, null, 'the head dragged off the ellipse is still glued');
    assert.deepEqual(await anchors(page), ['a1 div']);
    // with the free key a drop on a box does not glue
    grip = await endGrip(page, '2');
    const target = await screen(page, 1306, 537);
    await drag(page, grip, { dx: target.x - grip.x, dy: target.y - grip.y, steps: 10, modifiers: free(platform) });
    await sleep(100);
    [l] = await lines(page);
    assert.equal(l.to, null, 'an end dropped with the free key is glued');

    // a move of the whole line by a drag lets both ends go
    const fresh = await load(t, platform, GLUED);
    await drag(fresh, await screen(fresh, 853, 454), { dx: 0, dy: -80 * k, steps: 10 });
    await sleep(100);
    [l] = await lines(fresh);
    assert.deepEqual([l.from, l.to], [null, null], 'a dragged line is still glued');
    assert.deepEqual(await anchors(fresh), [], 'the names of the boxes are kept without glue');
    await undoRedo(fresh, SOURCE, await render(fresh));
    // and by a nudge
    await undo(fresh);
    await click(fresh, await screen(fresh, 853, 454));
    await press(fresh, 'ArrowUp');
    await press(fresh, 'ArrowUp');
    await sleep(50);
    [l] = await lines(fresh);
    assert.deepEqual([l.from, l.to], [null, null], 'a nudged line is still glued');
    await undoRedo(fresh, SOURCE, await render(fresh));
    // and by a typed position
    await undo(fresh);
    await exec(fresh, 'arrange.setPosition', { y: 300 });
    [l] = await lines(fresh);
    assert.deepEqual([l.from, l.to], [null, null], 'a line moved by a typed position is still glued');
    await undoRedo(fresh, SOURCE, await render(fresh));
    assert.deepEqual(errors(page), []);
    assert.deepEqual(errors(fresh), []);
  });

  test(`rule 4: a delete of a glued box leaves the line, and a copy glues only to copied boxes (${platform})`, async (t) => {
    const page = await load(t, platform, GLUED);
    await click(page, await screen(page, 1306, 537));
    await exec(page, 'element.delete');
    await sleep(100);
    let [l] = await lines(page);
    assert.equal(l.to, null, 'the line is glued to a deleted box');
    assert.deepEqual(l.ends, [520, 537, 1186, 537], 'the line is moved by the delete');
    assert.equal(l.from, 'a1 1 0.5');
    await undoRedo(page, SOURCE, await render(page));
    await undo(page);

    // the line copied alone is pasted without glue
    await click(page, await screen(page, 853, 454));
    await exec(page, 'edit.copy');
    await exec(page, 'edit.paste');
    await sleep(100);
    let all = await lines(page);
    assert.equal(all.length, 3);
    assert.deepEqual([all[0].from, all[0].to], ['a1 1 0.5', 'a2 0 0.5']);
    const pasted = all.find((x, i) => i > 0 && x.ends[0] !== 700);
    assert.deepEqual([pasted.from, pasted.to], [null, null], 'a line copied without its boxes is pasted with glue');
    await undo(page);
    assert.equal(await render(page), SOURCE);

    // the two boxes and the line, by Copy and Paste, by Duplicate, and by a drag with the copy key
    for (const route of ['paste', 'duplicate', 'drag']) {
      await click(page, await screen(page, 399, 500));
      await click(page, await screen(page, 1306, 500), { modifiers: 'Shift' });
      await click(page, await screen(page, 853, 454), { modifiers: 'Shift' });
      assert.equal((await page.evaluate('window.BeesonEditor.selection()')).length, 3);
      if (route === 'paste') {
        await exec(page, 'edit.copy');
        await exec(page, 'edit.paste');
      } else if (route === 'duplicate') await exec(page, 'edit.duplicate');
      else await drag(page, await screen(page, 399, 500), { dx: 0, dy: 280 * (await scale(page)), steps: 10, modifiers: copyKey(platform) });
      await sleep(150);
      all = await lines(page);
      assert.equal(all.length, 3, `${route} does not copy the line`);
      const names = await anchors(page);
      assert.equal(new Set(names.map((n) => n.split(' ')[0])).size, names.length, `${route} writes a name twice on the slide: ${names}`);
      assert.equal(names.length, 4, `${route} does not name the copies: ${names}`);
      const copy = all.find((x) => x.from && x.from !== 'a1 1 0.5');
      assert.ok(copy, `${route} does not glue the copied line to the copies: ${js(all)}`);
      assert.ok(copy.to && copy.to !== 'a2 0 0.5');
      await glued(page, 4);
      await undo(page);
      assert.equal(await render(page), SOURCE, `one undo does not take the copies of ${route} off`);
    }

    // Duplicate Slide and a paste of the slide keep the glue of the copy
    for (const route of ['slide.duplicate', 'slide.paste']) {
      if (route === 'slide.paste') await exec(page, 'slide.copy');
      await exec(page, route);
      await sleep(200);
      assert.equal(await page.evaluate('Reveal.getIndices().h'), 2);
      assert.deepEqual(await anchors(page), ['a1 div', 'a2 div']);
      await glued(page, 2);
      await undo(page);
      await page.evaluate('Reveal.slide(1)');
      await sleep(100);
      assert.equal(await render(page), SOURCE);
    }
    assert.deepEqual(errors(page), []);
  });
}

// item 5. the Line pane names each glued end, with a button that takes its glue off
for (const platform of PLATFORMS) {
  test(`item 5: the Line pane names the glued ends and takes the glue off (${platform})`, async (t) => {
    const page = await load(t, platform, GLUED);
    await click(page, await screen(page, 853, 454));
    await frames(page);
    await sleep(100);
    const text = await page.evaluate(`document.querySelector(${js(PANEL)}).innerText`);
    assert.match(text, /Start: Rounded Rectangle: Goal/, 'the start is not named in the Line pane');
    assert.match(text, /End: Rounded Rectangle/, 'the end is not named in the Line pane');
    assert.equal((await state(page, 'line.unglue.end')).enabled, true);
    const button = await page.evaluate(`(() => { const b = document.querySelector(${js(`${PANEL} [data-command="line.unglue.end"]`)}); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    assert.ok(button, 'the end does not have a button that takes its glue off');
    await click(page, button);
    await sleep(100);
    const [l] = await lines(page);
    assert.deepEqual([l.from, l.to], ['a1 1 0.5', null]);
    assert.deepEqual(await anchors(page), ['a1 div']);
    assert.ok(lineTag(await render(page)).includes('data-from="a1 1 0.5"'));
    await undoRedo(page, SOURCE, await render(page));
    await undo(page);
    await exec(page, 'line.unglue.end');
    await frames(page);
    const after = await page.evaluate(`document.querySelector(${js(PANEL)}).innerText`);
    assert.doesNotMatch(after, /End: Rounded Rectangle/, 'the pane names an end let go');
    assert.deepEqual(errors(page), []);
  });
}

// repairs of R27.1 after its check

// a new line drawn from a to b in slide px
async function drawLine(page, a, b) {
  const k = await scale(page);
  await exec(page, 'insert.line');
  await drag(page, await screen(page, a.x, a.y), { dx: (b.x - a.x) * k, dy: (b.y - a.y) * k, steps: 12 });
  await sleep(100);
  return (await lines(page)).at(-1);
}

// rule 1. an end is glued to the element under the pointer, even where the middle of an edge of an
// element above it is within reach. the lower box spans y 600 to 720 and is first in the file, and
// the upper box spans y 472 to 592
for (const platform of PLATFORMS) {
  test(`rule 1: an end is glued to the element under the pointer before a nearer middle of another (${platform})`, async (t) => {
    const page = await load(t, platform, STACK);
    const low = await drawLine(page, { x: 1200, y: 460 }, { x: 450, y: 601 });
    assert.equal(low.to, 'a1 0.5 0', `the end inside the lower box is glued to another element: ${js(low)}`);
    assert.deepEqual(low.ends.slice(2), [450, 600]);
    assert.deepEqual(await anchors(page), ['a1 div']);
    await glued(page, 1);
    // on a fresh slide, since an end snaps to the end of another line
    const fresh = await load(t, platform, STACK);
    const high = await drawLine(fresh, { x: 1200, y: 480 }, { x: 450, y: 590 });
    assert.equal(high.to, 'a1 0.5 1', `the end inside the upper box is not glued to it: ${js(high)}`);
    assert.deepEqual(high.ends.slice(2), [450, 592]);
    assert.deepEqual(await anchors(fresh), ['a1 div']);
    assert.equal(await fresh.evaluate(`document.querySelector(${js(SLIDE)}).querySelector('[data-anchor]').style.translate`), '300px 472px');
    await glued(fresh, 1);
    assert.deepEqual(errors(page), []);
    assert.deepEqual(errors(fresh), []);
  });
}

// rule 1. a group takes glue as one object: an end at the middle of the right edge of the box of the
// group, between its two members, is glued to the group, whose members share the name, and it
// follows a move of the group. the Line pane names the group
for (const platform of PLATFORMS) {
  test(`rule 1: a group takes glue as one object at the middle of an edge of its box (${platform})`, async (t) => {
    const page = await load(t, platform, GROUPED);
    const l = await drawLine(page, { x: 900, y: 800 }, { x: 402, y: 560 });
    assert.equal(l.to, 'a3 1 0.5', `the end is not glued to the middle of the right edge of the group: ${js(l)}`);
    assert.deepEqual(l.ends.slice(2), [400, 560]);
    assert.deepEqual(await anchors(page), ['a1 a3 div', 'a3 div', 'a2 div'], 'the members of the group do not share a name');
    await frames(page);
    await sleep(100);
    assert.match(await page.evaluate(`document.querySelector(${js(PANEL)}).innerText`), /End: Group/, 'the Line pane does not name the group');
    const before = await render(page);
    await drag(page, await screen(page, 300, 660), { dx: 60, dy: 90, steps: 10 });
    await sleep(150);
    const box = await page.evaluate(`[...document.querySelectorAll(${js(`${SLIDE} > .shape[data-group]`)})].map((el) => { const [x, y] = el.style.translate.split(/\\s+/).map(parseFloat); return [x, y, x + parseFloat(el.style.width), y + parseFloat(el.style.height)]; })`);
    assert.notEqual(box[0][0], 200, 'the group is not moved');
    const right = Math.max(...box.map((b) => b[2])), middle = (Math.min(...box.map((b) => b[1])) + Math.max(...box.map((b) => b[3]))) / 2;
    const moved = (await lines(page)).at(-1);
    assert.deepEqual(moved.ends.slice(2), [Math.round(right), Math.round(middle)], 'the end does not follow the box of the group');
    await undoRedo(page, before, await render(page));
    assert.deepEqual(errors(page), []);
  });
}

// rule 2. a delete or a cut of a glued line takes the names off the elements that it was glued to
for (const platform of PLATFORMS) {
  test(`rule 2: a delete or a cut of a glued line takes the names off its elements (${platform})`, async (t) => {
    const page = await load(t, platform, GLUED);
    for (const command of ['element.delete', 'edit.cut']) {
      await click(page, await screen(page, 853, 454));
      await frames(page);
      assert.equal((await page.evaluate('window.BeesonEditor.selection()')).length, 1);
      await exec(page, command);
      await sleep(100);
      assert.equal((await lines(page)).length, 1, `${command} does not take the line off`);
      assert.deepEqual(await anchors(page), [], `${command} of the line leaves the names of its elements`);
      await undo(page);
      assert.equal(await render(page), SOURCE, `one undo does not put back the line and the names after ${command}`);
    }
    assert.deepEqual(errors(page), []);
  });
}

// item 5. the row of an end that is not glued is not shown, nor is the section without a glued end
const shownButtons = (page) => page.evaluate(`[...document.querySelectorAll(${js(`${PANEL} [data-command^="line.unglue"]`)})].filter((b) => b.getClientRects().length).map((b) => b.dataset.command)`);
for (const platform of PLATFORMS) {
  test(`item 5: the Line pane shows a row only for a glued end of one line (${platform})`, async (t) => {
    const page = await load(t, platform, GLUED);
    await click(page, await screen(page, 853, 454));
    await frames(page);
    await sleep(100);
    assert.deepEqual(await shownButtons(page), ['line.unglue.start', 'line.unglue.end']);
    await exec(page, 'line.unglue.end');
    await frames(page);
    assert.deepEqual(await shownButtons(page), ['line.unglue.start'], 'a button is shown for the end let go');
    // the loose line alone, and the two lines
    await click(page, await screen(page, 900, 950));
    await frames(page);
    await sleep(100);
    assert.equal((await page.evaluate('window.BeesonEditor.selection()')).length, 1);
    assert.deepEqual(await shownButtons(page), [], 'a button is shown for a line without glue');
    assert.doesNotMatch(await page.evaluate(`document.querySelector(${js(PANEL)}).innerText`), /Connections/, 'the section is shown for a line without glue');
    await click(page, await screen(page, 853, 454), { modifiers: 'Shift' });
    await frames(page);
    await sleep(100);
    assert.equal((await page.evaluate('window.BeesonEditor.selection()')).length, 2);
    assert.deepEqual(await shownButtons(page), [], 'a button is shown for two selected lines');
    assert.deepEqual(errors(page), []);
  });
}
