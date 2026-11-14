// the TikZ figures of a deck in Chrome, drawn by src/tikz.ts from the output of the fixture
// test/pages/figures/two.js, which is written by hand so that these tests do not need TeX: the SVG
// of the mode of the deck in its box, the SVG again after a flip, the ids of each drawn instance,
// the error in place of a figure without an output, and the parts as steps in the show and in the
// print view

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';

const DECK = 'test/pages/tikz.html';

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser?.close();
});

// the errors of a page, apart from the failed load of the output of the figure named missing
const errors = (page) => page.errors.filter((e) => !e.includes('missing'));

const open = async (t, query = '', hash = '') => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(deckUrl(DECK, query, hash));
  await page.waitFor(deckSettled);
  return page;
};

// each TikZ figure of the current slide: the ids of its SVG, its colors, the boxes of the figure,
// of its SVG, and of its drawing in slide px, and its error
const figures = `[...Reveal.getCurrentSlide().querySelectorAll('.tikz')].map((el) => {
  const svg = el.querySelector(':scope > svg');
  const rect = (node) => { if (!node) return null; const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height }; };
  return {
    ids: svg ? [...svg.querySelectorAll('[id]')].map((node) => node.id) : [],
    colors: svg ? [...new Set(svg.outerHTML.match(/#[0-9a-f]{6}/gi))].map((c) => c.toLowerCase()).sort() : [],
    box: rect(el),
    svg: rect(svg),
    drawing: rect(svg?.querySelector('g')),
    error: el.querySelector('.tikz-error')?.textContent ?? null,
  };
})`;

const near = (a, b, what) => assert.ok(Math.abs(a - b) <= 1, `${what}: ${a} against ${b}`);

test('a TikZ figure is drawn from its output in the mode of the deck, centered in its box at its size, and again after a flip', { timeout: 60000 }, async (t) => {
  const page = await open(t, 'theme=light', '/1');
  // the figure is drawn once the deck is settled, without a wait of its own
  const [light] = await page.evaluate(figures);
  assert.ok(light.ids.length > 0, 'the figure is not drawn');
  for (const id of light.ids) assert.match(id, /^tikz-two-light-/);
  assert.deepEqual(light.colors, ['#141413', '#1f5fd0', '#55554f', '#c8571e']);
  assert.equal(light.error, null);
  // the output of 300 by 200 px is at the center of its box of 600 by 400 px, and it is not enlarged
  near(light.box.width, 600, 'the width of the box');
  near(light.box.height, 400, 'the height of the box');
  near(light.svg.width, 300, 'the width of the figure');
  near(light.svg.height, 200, 'the height of the figure');
  near(light.svg.x, light.box.x, 'the center of the figure in x');
  near(light.svg.y, light.box.y, 'the center of the figure in y');

  await page.evaluate(`Beeson.theme.set('dark')`);
  await page.waitFor(`document.querySelector('.tikz > svg [id]').id.startsWith('tikz-two-dark-')`);
  const [dark] = await page.evaluate(figures);
  for (const id of dark.ids) assert.match(id, /^tikz-two-dark-/);
  assert.deepEqual(dark.colors, ['#4f9df5', '#a6a6a0', '#f08050', '#f2f2ef']);
  near(dark.svg.width, 300, 'the width of the figure after the flip');
  assert.deepEqual(errors(page), []);
});

test('reveal.js is started at once by Beeson.start, before the outputs of the figures are loaded, and a settled deck has its figures drawn', { timeout: 60000 }, async (t) => {
  const page = await open(t, '', '/1');
  assert.equal(await page.evaluate('window.startedAtOnce'), true);
  assert.equal(await page.evaluate(`document.querySelectorAll('.tikz > svg').length`), 3);
  assert.deepEqual(errors(page), []);
});

test('two instances of a figure have unique ids, and an output larger than its box is shown smaller as a whole', { timeout: 60000 }, async (t) => {
  const page = await open(t, '', '/2');
  const [boxed, small] = await page.evaluate(figures);
  const ids = await page.evaluate(`[...document.querySelectorAll('[id]')].map((node) => node.id)`);
  assert.equal(new Set(ids).size, ids.length, 'an id is drawn twice');
  assert.ok(boxed.ids.length > 0 && small.ids.length > 0);
  assert.ok(boxed.ids.every((id) => !small.ids.includes(id)));
  // every reference of an SVG is to an id of the same SVG
  const foreign = await page.evaluate(`[...document.querySelectorAll('.tikz > svg')].flatMap((svg) => {
    const own = new Set([...svg.querySelectorAll('[id]')].map((node) => node.id));
    return [...svg.outerHTML.matchAll(/(?:href=['"]#|url\\(#)([^'")]+)/g)].map((m) => m[1]).filter((id) => !own.has(id));
  })`);
  assert.deepEqual(foreign, []);
  // a figure box without a size in the style of its figure keeps the output at its size
  near(boxed.svg.width, 300, 'the width of the figure in the figure box');
  near(boxed.drawing.x, boxed.box.x, 'the center of the figure in the figure box');
  // in a box of 150 by 50 px, the drawing is shown at a quarter of its size, inside the box
  near(small.box.width, 150, 'the width of the small box');
  near(small.drawing.width, boxed.drawing.width / 4, 'the width of the smaller figure');
  near(small.drawing.height, boxed.drawing.height / 4, 'the height of the smaller figure');
  near(small.drawing.x, small.box.x, 'the center of the smaller figure');
  assert.ok(small.svg.width <= 150.5 && small.svg.height <= 50.5, `the smaller figure is ${small.svg.width} by ${small.svg.height} px`);
  assert.deepEqual(errors(page), []);
});

test('a figure without its output shows an error in its place, which npm run check lists', { timeout: 60000 }, async (t) => {
  const page = await open(t, '', '/3');
  const [missing] = await page.evaluate(figures);
  assert.equal(missing.error, 'figure missing is not compiled: run npm run tex');
  assert.deepEqual(missing.ids, []);
  assert.match(readFileSync('scripts/check.mjs', 'utf8'), /querySelectorAll\('\.tikz-error'\)\]\.map\(\(error\) => error\.textContent\)/);
  assert.deepEqual(errors(page), []);
});

// the parts of the figure of the slide 1 that are hidden, by the class of src/tikz.ts and by their
// opacity once the fade of a step has ended
const hidden = `new Promise((done) => setTimeout(() => done([...Reveal.getCurrentSlide().querySelectorAll('.tikz > svg g[data-part]')]
  .filter((g) => g.classList.contains('tikz-later') || getComputedStyle(g).opacity === '0')
  .map((g) => g.dataset.part)), 500))`;

test('a part with a step is hidden until its step and shown from it on, and a part without a step is shown from the start', { timeout: 60000 }, async (t) => {
  const page = await open(t, '', '/1');
  assert.deepEqual(await page.evaluate(hidden), ['a', 'b']);
  // the step of a part is a fragment of its slide without content, hence it is not given the step that restores the dimmed fragments
  assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelectorAll('.fragment').length`), 2);
  await page.evaluate('Reveal.next()');
  assert.deepEqual(await page.evaluate(hidden), ['b']);
  await page.evaluate('Reveal.next()');
  assert.deepEqual(await page.evaluate(hidden), []);
  await page.evaluate('Reveal.prev()');
  assert.deepEqual(await page.evaluate(hidden), ['b']);
  // a flip of the mode draws the figure again with the parts of the step
  await page.evaluate(`Beeson.theme.set('light')`);
  await page.waitFor(`document.querySelector('.tikz > svg [id]').id.startsWith('tikz-two-light-')`);
  assert.deepEqual(await page.evaluate(hidden), ['b']);
  assert.deepEqual(errors(page), []);
});

test('every part is shown when the slide of its figure is entered backwards', { timeout: 60000 }, async (t) => {
  const page = await open(t, '', '/2');
  await page.evaluate('Reveal.prev()');
  assert.equal(await page.evaluate('Reveal.getIndices().h'), 1);
  assert.deepEqual(await page.evaluate(hidden), []);
  assert.deepEqual(errors(page), []);
});

test('the print view has a page for each step of a part, with the parts of the step and ids of its own', { timeout: 60000 }, async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await printView(page, deckUrl(DECK, 'print-pdf'));
  const pages = await page.evaluate(`[...document.querySelectorAll('.pdf-page')].map((p) => [...p.querySelectorAll('.tikz > svg g[data-part]')]
    .filter((g) => g.classList.contains('tikz-later')).map((g) => g.dataset.part).join(' ') || (p.querySelector('.tikz > svg') ? 'all' : '-'))`);
  // the slides 0, 1 at its three steps, 2, and 3 with the error of a missing output
  assert.deepEqual(pages, ['-', 'a b', 'b', 'all', 'all', '-']);
  const ids = await page.evaluate(`[...document.querySelectorAll('[id]')].map((node) => node.id)`);
  assert.equal(new Set(ids).size, ids.length, 'an id is drawn twice in the print view');
  assert.deepEqual(errors(page), []);
});
