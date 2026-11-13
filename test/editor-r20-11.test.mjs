// regression tests of R20.11 on both platforms with trusted input. the layer commands of
// commands/order.ts stay fast on a slide with many children (F1) and keep a caption in its place
// (F2). a new text box, formula, or figure is drawn in front of the shapes of its slide, and Send
// to Back of a shape draws the words of the text column over it. Reset Slide keeps the place of a
// line. Reset Rotation of a group gives the file back after many turns and a nudge (F12, O4, N3),
// and Esc during a drag does not revive an older turn (F13) or change the selection (F14)

import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, type } from './helpers/editor.mjs';

const SOURCE = readFileSync('test-deck.html', 'utf8');
const DECK = 'test/pages/editor-r20-11.html';
const DECK_SOURCE = readFileSync(DECK, 'utf8');
const slideOf = (text, has) => [...text.matchAll(/<section[\s\S]*?<\/section>/g)].findIndex((m) => has(m[0]));
const STEPS = slideOf(SOURCE, (s) => s.includes('Show your steps one at a time'));
const FIGURES = slideOf(SOURCE, (s) => s.includes('Figures are first class citizens'));
const [UNDER, ROOM, LINED] = [0, 1, 2];
const PLATFORMS = ['mac', 'other'];
const KEYS = {
  mac: { front: 'Mod+Shift+F', forward: 'Mod+Alt+Shift+F', backward: 'Mod+Alt+Shift+B', back: 'Mod+Shift+B', group: 'Alt+Mod+G' },
  other: { front: 'Mod+Shift+ArrowUp', forward: 'Mod+ArrowUp', backward: 'Mod+ArrowDown', back: 'Mod+Shift+ArrowDown', group: 'Mod+G' },
};
const LIST_KEY = { mac: 'Mod+Shift+L', other: 'Alt+F10' };
const ROW = '.beeson-edit-objects .row';
const S = '.reveal section.present';
const IMG = `${S} figure img.for-light`;

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
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg ? `, ${js(arg)}` : ''})).then(() => true)`);
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((e) => e.localName).join(',')`);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const mouse = (page, type, x, y, extra = {}) => page.send('Input.dispatchMouseEvent', { type, x, y, ...extra });
const ms = async (f) => {
  const t0 = performance.now();
  await f();
  return Math.round(performance.now() - t0);
};

// the deck text opened with the editor at slide n, from a file of the root where file is given
async function load(t, platform, text, n, file = null, theme = '') {
  if (file) {
    writeFileSync(file, text);
    t.after(() => rmSync(file, { force: true }));
  }
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${file ?? (text === DECK_SOURCE ? DECK : 'test-deck.html')}?edit&still${theme}&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = text;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(text)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the object list shown, and the point of its row whose name starts with which, or of the row at
// the index which
const showList = async (page, platform) => {
  await press(page, LIST_KEY[platform]);
  await frames(page);
};
const rowAt = (page, which) => page.evaluate(`(() => {
  const rows = [...document.querySelectorAll(${js(ROW)})];
  const r = (typeof ${js(which)} === 'number' ? rows[${js(which)}] : rows.find((x) => x.querySelector('.name').textContent.startsWith(${js(which)}))).getBoundingClientRect();
  return { x: r.left + 60, y: r.top + r.height / 2 };
})()`);
const rowNames = (page) => page.evaluate(`[...document.querySelectorAll(${js(ROW)})].map((r) => r.querySelector('.name').textContent)`);

// the top left corners of the elements of the selectors, in CSS px
const corners = (page, selectors) => page.evaluate(`${js(selectors)}.map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; })`);

// what is drawn at a point of the words of the element of a inside the box of the element of b,
// with the shapes taking the pointer, which the theme gives to the elements under them
const drawnAt = (page, a, b) => page.evaluate(`(() => {
  const el = document.querySelector(${js(a)});
  const box = document.querySelector(${js(b)}).getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(el);
  let at = null;
  for (const r of range.getClientRects()) {
    const x = Math.max(r.left, box.left) + 8, y = r.top + r.height / 2;
    if (!at && r.width > 4 && x < Math.min(r.right, box.right) - 4 && y > box.top + 2 && y < box.bottom - 2) at = { x, y };
  }
  if (!at) return 'no point of the words over the box';
  const style = document.createElement('style');
  style.textContent = '.reveal .slides section .shape { pointer-events: auto !important }';
  document.head.append(style);
  const hit = document.elementFromPoint(at.x, at.y);
  style.remove();
  return hit === el || el.contains(hit) ? 'words' : hit?.closest('.shape') ? 'shape' : hit?.localName ?? 'nothing';
})()`);

// the kind of what is drawn at the center of the element of selector, with the shapes taking the
// pointer
const drawnAtCenter = (page, selector) => page.evaluate(`(() => {
  const r = document.querySelector(${js(selector)}).getBoundingClientRect();
  const style = document.createElement('style');
  style.textContent = '.reveal .slides section .shape { pointer-events: auto !important }';
  document.head.append(style);
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  style.remove();
  return hit?.closest('.shape') ? 'shape' : hit?.closest('.math, .figure-box, p') ? 'new' : hit?.localName ?? 'nothing';
})()`);

// a drag of the element of selector onto the center of the shape of the slide, by the move handle
// of a text block, which a drag of its words would select, and else from its center
async function dragOntoShape(page, selector) {
  const mid = (s) => page.evaluate(`(() => { const r = [...document.querySelectorAll(${js(s)})].find((e) => !e.hidden && e.getClientRects().length)?.getBoundingClientRect(); return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const [from, to] = [await mid(selector), await mid(`${S} > .shape`)];
  const grip = (await mid('.beeson-handle')) ?? from;
  await drag(page, grip, { dx: to.x - from.x, dy: to.y - from.y });
  await frames(page);
  const now = await mid(selector);
  assert.ok(Math.abs(now.x - to.x) < 4 && Math.abs(now.y - to.y) < 4, `the drag did not put the element onto the shape: ${js([from, now, to])}`);
}

// the opened deck again after the undo of each entry, which are at most six
async function undoAll(page) {
  for (let i = 0; i < 6 && (await render(page)) !== page.source; i++) await undo(page);
  assert.equal(await render(page), page.source);
}

// a slide with a heading, n paragraphs in the flow, m translated figures, and a foot, put before
// the closing slide of source, and its index
function manyChildren(n, m, source = SOURCE, title = 'Many children') {
  const ps = Array.from({ length: n }, (_, i) => `  <p style="font-size: 22px; margin: 0">Paragraph number ${i} of a long slide.</p>`).join('\n');
  const figs = Array.from({ length: m }, (_, i) => `  <div class="figure-box" style="translate: ${-900 + i * 40}px ${-300 + i * 30}px"><img src="demo/figure-dark.png" alt="f${i}"></div>`).join('\n');
  const slide = `<section>\n  <h2>${title}</h2>\n${ps}\n${figs}\n  <div class="foot">A foot.</div>\n</section>\n\n`;
  const text = source.replace('<section class="closing">', `${slide}<section class="closing">`);
  return { text, n: slideOf(text, (s) => s.includes(title)) };
}

// the times in ms on the slide n, with the object list shown: the Arrange menu opened with the
// first figure selected, the four Order commands on it, Shift-clicks on the rows of the next four
// figures, and Bring to Front of the five. the slide is given back after each command
async function layerTimes(page, platform, n) {
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  const names = await rowNames(page);
  const figs = names.map((r, i) => [r, i]).filter(([r]) => /^(Figure|Image|Picture)/.test(r)).map(([, i]) => i);
  assert.ok(figs.length >= 5, js(names));
  await click(page, await rowAt(page, figs[0]));
  await frames(page);
  const at = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-menubar button')].find((x) => x.textContent === 'Arrange'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const menu = await ms(async () => {
    await click(page, at);
    await frames(page);
  });
  await page.evaluate('window.BeesonEditorShell.closeMenus()');
  await frames(page);
  const commands = {};
  for (const o of ['back', 'forward', 'front', 'backward']) {
    const base = await render(page);
    commands[o] = await ms(async () => {
      await press(page, KEYS[platform][o]);
      await frames(page);
    });
    if ((await render(page)) !== base) {
      await undo(page);
      await frames(page);
    }
    assert.equal(await render(page), base);
  }
  const shifts = [];
  for (const i of figs.slice(1, 5)) {
    const row = await rowAt(page, i);
    shifts.push(await ms(async () => {
      await click(page, row, { modifiers: 'Shift' });
      await frames(page);
    }));
  }
  assert.equal((await selected(page)).split(',').length, 5);
  const base = await render(page);
  const front = await ms(async () => {
    await press(page, KEYS[platform].front);
    await frames(page);
  });
  assert.notEqual(await render(page), base);
  await undo(page);
  await frames(page);
  assert.equal(await render(page), base);
  return { rows: names.length, menu, command: Math.max(...Object.values(commands)), shift: Math.max(...shifts), front };
}

// each time on a slide with 47 rows is bounded by RATIO times the same time on a slide with 9 rows,
// and SLACK ms for the pauses of a machine that other tests load at once. the bound thus scales
// with a slower machine. before the fix of F1, the menu took about 970 ms, a command 700 ms, a
// Shift-click 5 to 12 s, and Bring to Front of 5 about 45 s on the slide with 47 rows, i.e. over
// 100 times its time with 9 rows. the rows are 5.2 times as many, and on the runners of GitHub
// Bring to Front took 2 to 5.8 times as long, hence a bound of 4 times failed there
const RATIO = 8;
const SLACK = 150;

for (const platform of PLATFORMS) {
  // F1: every place among the siblings was tried for each moved element, by each of the four Order
  // commands at each refresh of the inspector
  test(`the Arrange menu, a layer command, and a Shift-click run without a pause on a slide with 47 rows (${platform})`, { timeout: 180000 }, async (t) => {
    const few = manyChildren(2, 5, SOURCE, 'Few children');
    const { text, n } = manyChildren(25, 20, few.text);
    const page = await load(t, platform, text, n, `.r20-11-many-${platform}.html`);
    await showList(page, platform);
    const names = await rowNames(page);
    assert.ok(names.filter((r) => !r.startsWith('Backdrop')).length >= 47, `the slide has ${names.length} rows`);
    assert.equal(names.filter((r) => /^(Figure|Image|Picture)/.test(r)).length, 20, js(names));
    // the slide with few rows is measured first, after which the code of the editor is warm
    await layerTimes(page, platform, few.n);
    const small = await layerTimes(page, platform, few.n);
    const large = await layerTimes(page, platform, n);
    // a time over its bound is measured again, twice at most, and the lowest one counts, since one
    // time on a machine that runs other tests at once holds the pauses of the machine too
    const TIMES = ['menu', 'command', 'shift', 'front'];
    const over = () => TIMES.filter((k) => large[k] >= RATIO * small[k] + SLACK);
    for (let again = 0; again < 2 && over().length; again++) {
      const next = await layerTimes(page, platform, n);
      for (const k of TIMES) large[k] = Math.min(large[k], next[k]);
    }
    t.diagnostic(`with ${small.rows} rows ${js(small)}, with ${large.rows} rows ${js(large)}`);
    for (const k of TIMES) {
      assert.ok(large[k] < RATIO * small[k] + SLACK, `${k} took ${large[k]} ms with ${large.rows} rows, and ${small[k]} ms with ${small.rows} rows`);
    }
    assert.deepEqual(errors(page), []);
  });

  // F2: Bring Forward and Bring to Front moved the tag of the caption after the list, and its words
  // from y 363 to y 642
  for (const o of ['forward', 'front']) {
    test(`Bring ${o === 'front' ? 'to Front' : 'Forward'} of a caption on a content slide keeps its words in their place (${platform})`, async (t) => {
      const page = await load(t, platform, SOURCE, STEPS);
      await showList(page, platform);
      await click(page, await rowAt(page, 'Text: Design the complete'));
      await frames(page);
      await exec(page, 'text.style.caption');
      await frames(page);
      const caption = `${S} > p.caption`;
      const was = await corners(page, [caption, `${S} > ul`]);
      const base = await render(page);
      await press(page, KEYS[platform][o]);
      await frames(page);
      const edited = await render(page);
      assert.notEqual(edited, base, 'the command does not change the file');
      assert.deepEqual(await corners(page, [caption, `${S} > ul`]), was, 'the caption or the list moved');
      assert.match(edited, /<p class="caption" style="[^"]*z-index: \d+[^"]*">Design the complete[\s\S]*?<ul>/, 'the caption is not kept before the list');
      await undo(page);
      assert.equal(await render(page), base);
      await redo(page);
      assert.equal(await render(page), edited);
      assert.deepEqual(errors(page), []);
    });
  }

  // a new element was written before the shape in the file, hence drawn under it once dragged onto it
  test(`a new text box dragged onto a shape is drawn in front of it (${platform})`, async (t) => {
    const page = await load(t, platform, DECK_SOURCE, ROOM);
    await click(page, '.beeson-edit-top [data-command="insert.text"]');
    await sleep(200);
    await type(page, 'Box over the shape');
    await sleep(300);
    assert.match(await render(page), /<p style="[^"]*z-index: \d+[^"]*">Box over the shape<\/p>/, 'the insert does not hold the layer of the text box');
    await press(page, 'Escape');
    await frames(page);
    const box = `${S} > p:nth-of-type(2)`;
    assert.equal(await page.evaluate(`document.querySelector(${js(box)}).textContent`), 'Box over the shape');
    await dragOntoShape(page, box);
    assert.equal(await drawnAtCenter(page, box), 'new');
    await undoAll(page);
    assert.deepEqual(errors(page), []);
  });

  test(`a new formula dragged onto a shape is drawn in front of it, and its undo gives the file back (${platform})`, async (t) => {
    const page = await load(t, platform, DECK_SOURCE, ROOM);
    await exec(page, 'insert.formula');
    await sleep(300);
    await type(page, 'x^2 + y^2 = r^2');
    await sleep(300);
    // a click on the pasteboard closes the TeX field and leaves the slide without a selection
    await click(page, { x: 8, y: 500 });
    await sleep(300);
    const inserted = await render(page);
    assert.match(inserted, /<div class="math" style="[^"]*z-index: \d+/, 'the insert does not hold the layer of the formula');
    const math = `${S} > .math`;
    await dragOntoShape(page, `${math} mjx-container`);
    assert.equal(await drawnAtCenter(page, `${math} mjx-container`), 'new');
    await undoAll(page);
    assert.deepEqual(errors(page), []);
  });

  test(`a new figure dragged onto a shape is drawn in front of it (${platform})`, { timeout: 60000 }, async (t) => {
    const page = await load(t, platform, DECK_SOURCE, ROOM);
    await page.send('Page.setInterceptFileChooserDialog', { enabled: true });
    await page.evaluate(`window.__done = window.BeesonEditor.exec('insert.image').then(() => true); 0`);
    await page.waitFor(`!!document.querySelector('input.beeson-media-input')`);
    const { result } = await page.send('Runtime.evaluate', { expression: `document.querySelector('input.beeson-media-input')` });
    await page.send('DOM.setFileInputFiles', { files: [resolve('demo/figure-light.png')], objectId: result.objectId });
    await page.waitFor('window.__done', 20000);
    await sleep(300);
    const img = `${S} > .figure-box img`;
    assert.ok(await page.evaluate(`!!document.querySelector(${js(img)})`), 'no figure was inserted');
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Insert Image');
    await dragOntoShape(page, img);
    assert.equal(await drawnAtCenter(page, img), 'new');
    await undoAll(page);
    assert.deepEqual(errors(page), []);
  });

  test(`Send to Back of a shape over the words of the text column draws the words over it and keeps the layout (${platform})`, async (t) => {
    const page = await load(t, platform, DECK_SOURCE, UNDER);
    const shape = `${S} > .shape`;
    const els = [`${S} > h2`, `${S} > p`, `${S} > ul`, shape];
    assert.equal(await drawnAt(page, `${S} > p`, shape), 'shape');
    const was = await corners(page, els);
    await showList(page, platform);
    await click(page, await rowAt(page, 'Rounded Rectangle'));
    await frames(page);
    await press(page, KEYS[platform].back);
    await frames(page);
    const edited = await render(page);
    assert.notEqual(edited, DECK_SOURCE);
    assert.deepEqual(await corners(page, els), was, 'the layout changed');
    assert.equal(await drawnAt(page, `${S} > p`, shape), 'words');
    assert.equal(await drawnAt(page, `${S} > ul`, shape), 'words');
    await undo(page);
    assert.equal(await render(page), DECK_SOURCE);
    assert.deepEqual(errors(page), []);
  });

  // Reset Slide took the translate off a line, which moved it to the upper left corner of its slide
  test(`Reset Slide leaves the place of a line (${platform})`, async (t) => {
    const page = await load(t, platform, DECK_SOURCE, LINED);
    const line = `${S} > svg.line`;
    const was = await corners(page, [line]);
    await exec(page, 'slide.reset');
    await frames(page);
    const edited = await render(page);
    assert.match(edited, /<p>A moved paragraph\.<\/p>/, 'Reset Slide does not take the translate off the paragraph');
    assert.match(edited, /<svg class="line" width="400" height="1" style="translate: 700px 600px">/);
    assert.deepEqual(await corners(page, [line]), was, 'the line moved');
    await undo(page);
    assert.equal(await render(page), DECK_SOURCE);
    assert.deepEqual(errors(page), []);
  });
}

// a typed value of a field of the Arrange pane
const PANEL = '#beeson-edit-panel-format';
async function typeField(page, id, value) {
  await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].find((b) => b.textContent === 'Arrange')?.click()`);
  await frames(page);
  await page.evaluate(`(() => { const i = document.querySelector('#beeson-edit-num-${id}'); i.focus(); i.select(); })()`);
  await type(page, String(value));
  await press(page, 'Enter');
  await frames(page);
}

// a drag of the shown rotate handle by deg degrees about the center of the frame of the selection
async function dragRotor(page, deg) {
  const o = await page.evaluate(`(() => {
    const mid = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const shown = (el) => !el.hidden && el.getClientRects().length > 0;
    return { c: mid([...document.querySelectorAll('.beeson-frame.union, .beeson-frame.selected')].find(shown)), r: mid([...document.querySelectorAll('.beeson-rotor')].find(shown)) };
  })()`);
  const radius = Math.hypot(o.r.x - o.c.x, o.r.y - o.c.y), from = Math.atan2(o.r.y - o.c.y, o.r.x - o.c.x);
  await mouse(page, 'mouseMoved', o.r.x, o.r.y);
  await mouse(page, 'mousePressed', o.r.x, o.r.y, { button: 'left', buttons: 1, clickCount: 1 });
  let at = o.r;
  for (let i = 1; i <= 10; i++) {
    const a = from + ((deg * Math.PI) / 180) * (i / 10);
    at = { x: o.c.x + radius * Math.cos(a), y: o.c.y + radius * Math.sin(a) };
    await mouse(page, 'mouseMoved', at.x, at.y, { button: 'left', buttons: 1 });
  }
  await frames(page);
  await mouse(page, 'mouseReleased', at.x, at.y, { button: 'left', buttons: 0, clickCount: 1 });
  await frames(page);
}

// the paragraph and the figure of the figures slide made one group, with the figure turned by 20
// degrees by itself first where own is set
async function groupOnFigures(page, platform, own) {
  await click(page, IMG);
  if (own) {
    await typeField(page, 'angle', 20);
    await click(page, IMG);
  }
  const p = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(':scope > p').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
  await click(page, p, { modifiers: 'Shift' });
  await press(page, KEYS[platform].group);
  await frames(page);
}

// the group selected anew by a click on the pasteboard and a click on the picture, since a click
// on a member of a selected group selects the member
async function reselect(page) {
  await click(page, { x: 8, y: 500 });
  await frames(page);
  await click(page, IMG);
  await frames(page);
}

// a step of a run of turns: f and an angle types the angle, h and a number of degrees drags the
// rotate handle by them, and nudge moves the group by 1 px to the right
async function step(page, s) {
  if (s.startsWith('f')) await typeField(page, 'angle', Number(s.slice(1)));
  else if (s.startsWith('h')) await dragRotor(page, Number(s.slice(1)));
  else if (s === 'nudge') {
    await reselect(page);
    await press(page, 'ArrowRight');
    await frames(page);
  }
}

// F12, O4, and N3: Reset Rotation after three or more turns of a group with a member turned by
// itself, or after a nudge between two turns, left a translate of 1 to 4 px on a member
const RUNS = [
  [true, ['f30', 'f75', 'f140']],
  [true, ['f30', 'f75', 'f140', 'f200', 'f260']],
  [true, ['h40', 'f110', 'h-30']],
  [false, ['f30', 'f75', 'f140', 'f200', 'f260']],
  [false, ['f30', 'nudge', 'f75']],
  [true, ['f30', 'nudge', 'f75', 'f140']],
];
for (const platform of PLATFORMS) {
  for (const [own, steps] of RUNS) {
    test(`Reset Rotation of a group${own ? ' with a member turned by itself' : ''} after ${steps.join(' ')} gives the file back (${platform})`, { timeout: 60000 }, async (t) => {
      const page = await load(t, platform, SOURCE, FIGURES, null, '&theme=light');
      await groupOnFigures(page, platform, own);
      assert.match(await render(page), /data-group="g1"/);
      // the file of the nudges of the run alone, without the turns
      const nudges = steps.filter((s) => s === 'nudge');
      for (const s of nudges) await step(page, s);
      const expected = await render(page);
      for (let i = 0; i < nudges.length; i++) await undo(page);
      await reselect(page);
      for (const s of steps) await step(page, s);
      await exec(page, 'arrange.resetRotation');
      await frames(page);
      assert.equal(await render(page), expected);
      assert.deepEqual(errors(page), []);
    });
  }

  // F13: the cancel of a move drag set the offset of a stale rest of the turn to the nudged one,
  // hence Reset Rotation dropped the nudge
  test(`a move drag cancelled by Esc does not change what Reset Rotation gives back after a nudge (${platform})`, { timeout: 60000 }, async (t) => {
    const results = [];
    for (const cancel of [false, true]) {
      const page = await load(t, platform, SOURCE, FIGURES, null, '&theme=light');
      await click(page, IMG);
      await typeField(page, 'angle', 30);
      // Esc leaves the field with the figure selected, and a click would select its picture
      await press(page, 'Escape');
      await frames(page);
      assert.equal(await selected(page), 'figure');
      await press(page, 'ArrowRight');
      await frames(page);
      const nudged = await render(page);
      if (cancel) {
        const c = await page.evaluate(`(() => { const r = document.querySelector(${js(IMG)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        await drag(page, c, { dx: 60, dy: 0, hold: true });
        await press(page, 'Escape');
        await mouse(page, 'mouseReleased', c.x + 60, c.y, { button: 'left', buttons: 0, clickCount: 1 });
        await frames(page);
        assert.equal(await render(page), nudged, 'the cancelled drag changed the file');
      }
      await exec(page, 'arrange.resetRotation');
      await frames(page);
      results.push(await render(page));
      assert.deepEqual(errors(page), []);
      // a page left open keeps its draft 1 s after its last edit, and on a slow machine this draft
      // was kept after the next page emptied the storage, whose dialog then took the click on IMG
      await page.close();
    }
    assert.match(results[0], /<figure class="figure-box" style="translate: [^"]+">/);
    assert.equal(results[1], results[0]);
  });

  // F14: Esc in a drag of a line end emptied the selection, and in a drag of a line selected with a
  // figure it left the line alone selected
  test(`Esc during a drag of a line end or of a line keeps the selection of the press (${platform})`, async (t) => {
    const page = await load(t, platform, SOURCE, FIGURES, null, '&theme=light');
    await exec(page, 'insert.line', { from: { x: 200, y: 900 }, to: { x: 700, y: 950 } });
    await frames(page);
    const base = await render(page);
    assert.equal(await selected(page), 'svg');
    const held = async (from, dx, dy) => {
      await drag(page, from, { dx, dy, hold: true });
      await press(page, 'Escape');
      await frames(page);
      const afterEsc = await selected(page);
      await mouse(page, 'mouseReleased', from.x + dx, from.y + dy, { button: 'left', buttons: 0, clickCount: 1 });
      await frames(page);
      return [afterEsc, await selected(page)];
    };
    const end = await page.evaluate(`(() => { const g = [...document.querySelectorAll('.beeson-line-end')].find((x) => x.getClientRects().length && x.dataset.end === '2'); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    assert.deepEqual(await held(end, 80, -60), ['svg', 'svg'], 'the selection after Esc in a drag of the line end');
    assert.equal(await render(page), base);
    await click(page, IMG);
    await frames(page);
    const mid = await page.evaluate(`(() => { const r = document.querySelector('${S} svg.line line').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await click(page, mid, { modifiers: 'Shift' });
    await frames(page);
    const both = await selected(page);
    assert.equal(both.split(',').length, 2);
    assert.deepEqual(await held(mid, 50, -40), [both, both], 'the selection after Esc in a drag of the line with the figure');
    assert.equal(await render(page), base);
    assert.deepEqual(errors(page), []);
  });
}
