// checks of the plot element of src/plot.ts, i.e. the parser of the JSON block, the interpolation
// between frames, the loop, and the markup of the labels. the JSON block of the demo deck is parsed
// as well, and a plot of a test deck is played and printed in Chrome

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { cells, formatNumber, framesAt, loopFrame, nearest, parseMarkup, parsePlot, scaled, traceTo, valueAt } from '../src/plot.ts';

const minimal = () => ({
  panels: [{ id: 'p', x: { range: [0, 1] }, y: { range: [0, 1] } }],
  marks: [{ id: 'm', panel: 'p', kind: 'points' }],
  tabs: [{ name: 'a', values: [0, 1], data: { m: [[0, 0], [1, 1]] } }],
});

test('a plot is read with its defaults', () => {
  const plot = parsePlot(JSON.stringify(minimal()));
  assert.equal(plot.duration, 8);
  assert.equal(plot.hold, 1);
  assert.equal(plot.layout, null);
  assert.deepEqual(plot.panels[0].x, { range: [0, 1], ticks: [], title: '', scale: 'linear', unit: 1 });
  assert.equal(plot.panels[0].axes, true);
  assert.equal(plot.panels[0].size, 1);
  assert.deepEqual(plot.panels[0].margin, [52, 20, 84, 76]);
  assert.equal(plot.marks[0].tone, 'accent');
  assert.equal(plot.tabs[0].label, 'a');
  assert.equal(plot.tabs[0].active, null);
  assert.deepEqual(plot.tabs[0].panels, {});
});

test('an axis is read with its scale and the text of its ticks, and a tab replaces the keys of a panel', () => {
  const spec = minimal();
  spec.panels[0].x = { range: [-100, 100], scale: 'asinh', unit: 2, ticks: [-10, { at: 0, text: '$0$' }] };
  spec.panels[0].size = 2;
  spec.panels[0].margin = [0, 1, 2, 3];
  spec.tabs[0].panels = { p: { y: { range: [0, 5] }, title: 'b' } };
  const plot = parsePlot(spec);
  assert.deepEqual(plot.panels[0].x.ticks, [{ at: -10, text: '−10' }, { at: 0, text: '$0$' }]);
  assert.equal(plot.panels[0].x.scale, 'asinh');
  assert.equal(scaled(plot.panels[0].x, 4), Math.asinh(2));
  assert.equal(scaled(plot.panels[0].y, 4), 4);
  assert.equal(plot.panels[0].size, 2);
  assert.deepEqual(plot.panels[0].margin, [0, 1, 2, 3]);
  assert.deepEqual(Object.keys(plot.tabs[0].panels.p), ['y', 'title']);
  assert.deepEqual(plot.tabs[0].panels.p.y.range, [0, 5]);
});

test('the panels share a side in proportion to their sizes, with a gap between two panels', () => {
  assert.deepEqual(cells([1, 1], 1056, 56), [[0, 500], [556, 500]]);
  assert.deepEqual(cells([1, 3], 456, 56), [[0, 100], [156, 300]]);
  assert.deepEqual(cells([2], 300, 56), [[0, 300]]);
});

test('a fault in a plot is reported with its path', () => {
  const faults = [
    [(p) => delete p.panels, /^panels: a list is expected/],
    [(p) => (p.panels[0].x.range = [1, 0]), /^panels\[0\]\.x\.range: the second end must be larger/],
    [(p) => p.panels.push({ ...p.panels[0] }), /^panels: the ids of the panels must differ/],
    [(p) => (p.marks[0].panel = 'q'), /^marks\[0\]\.panel: the panel q is not declared/],
    [(p) => (p.marks[0].kind = 'bars'), /^marks\[0\]\.kind: one of points, trace, label, events is expected/],
    [(p) => (p.tabs[0].data.n = []), /^tabs\[0\]\.data\.n: the mark is not declared/],
    [(p) => (p.tabs[0].data.m = [[0, 0], [1, 1], [2, 2]]), /^tabs\[0\]\.data\.m: 3 frames are given, and the tab has 2 values/],
    [(p) => (p.tabs[0].data.m = [[0, 0, 1]]), /^tabs\[0\]\.data\.m\[0\]: pairs of x and y are expected/],
    [(p) => (p.tabs[0].active = [['m']]), /^tabs\[0\]\.active: 1 frames are given, and the tab has 2 values/],
    [(p) => { p.marks[0].kind = 'events'; p.tabs[0].data.m = [{ frame: 2, at: [0, 0] }]; }, /^tabs\[0\]\.data\.m\[0\]\.frame: a frame from 0 to 1 is expected/],
    [(p) => (p.panels[0].x.scale = 'log'), /^panels\[0\]\.x\.scale: linear or asinh is expected/],
    [(p) => (p.panels[0].x.unit = 0), /^panels\[0\]\.x\.unit: a positive number is expected/],
    [(p) => (p.panels[0].x.ticks = ['a']), /^panels\[0\]\.x\.ticks\[0\]: a number or a tick \{ at, text \} is expected/],
    [(p) => (p.panels[0].margin = [1, 2]), /^panels\[0\]\.margin: a margin \[top, right, bottom, left\] is expected/],
    [(p) => (p.panels[0].size = -1), /^panels\[0\]\.size: a positive number is expected/],
    [(p) => (p.tabs[0].panels = { q: {} }), /^tabs\[0\]\.panels\.q: the panel q is not declared/],
    [(p) => (p.tabs[0].panels = { p: { equal: true } }), /^tabs\[0\]\.panels\.p\.equal: one of x, y, title, regions, curves, labels is expected/],
  ];
  for (const [change, message] of faults) {
    const plot = minimal();
    change(plot);
    assert.throws(() => parsePlot(plot), { message });
  }
});

test('a frame between two frames is interpolated, and frames of different lengths are not', () => {
  assert.equal(valueAt([0, 10, 30], 1.5), 20);
  assert.equal(valueAt([0, 10, 30], 5), 30);
  assert.deepEqual(framesAt([[0, 0], [2, 4]], 0.25), [0.5, 1]);
  assert.deepEqual(framesAt([[0, 0], [2, 4, 6, 8]], 0.25), [0, 0]);
  assert.deepEqual(framesAt([[0, 0], [2, 4, 6, 8]], 0.75), [2, 4, 6, 8]);
  assert.deepEqual(framesAt([[5, 6]], 3), [5, 6]);
  assert.equal(nearest(['a', 'b', 'c'], 1.4), 'b');
  assert.equal(nearest(['a', 'b', 'c'], -2), 'a');
});

test('a trace ends between two frames', () => {
  const path = [[0, 0], [1, 0], [1, 2]];
  assert.deepEqual(traceTo(path, 0), [[0, 0]]);
  assert.deepEqual(traceTo(path, 1.5), [[0, 0], [1, 0], [1, 1]]);
  assert.deepEqual(traceTo(path, 9), path);
});

test('the loop runs over the frames, holds the last one, and starts again', () => {
  // 11 frames in 2 s, held for 1 s
  assert.equal(loopFrame(0, 11, 2, 1), 0);
  assert.equal(loopFrame(1, 11, 2, 1), 5);
  assert.equal(loopFrame(2.5, 11, 2, 1), 10);
  assert.equal(loopFrame(4, 11, 2, 1), 5);
  assert.equal(loopFrame(7, 1, 2, 1), 0);
});

test('a label is set in runs of the markup', () => {
  assert.deepEqual(parseMarkup('$\\lambda_h = 3$'), [
    { text: 'λ', italic: true, shift: null },
    { text: 'h', italic: true, shift: 'sub' },
    { text: ' = 3', italic: false, shift: null },
  ]);
  assert.deepEqual(parseMarkup('$\\mathrm{L}_{12}$ family'), [
    { text: 'L', italic: false, shift: null },
    { text: '12', italic: false, shift: 'sub' },
    { text: ' family', italic: false, shift: null },
  ]);
  assert.deepEqual(parseMarkup('$-1$ and -1'), [{ text: '−1 and -1', italic: false, shift: null }]);
  assert.deepEqual(parseMarkup('$x^{2}$'), [
    { text: 'x', italic: true, shift: null },
    { text: '2', italic: false, shift: 'sup' },
  ]);
});

test('a number is written with a minus sign, and without the sign of a zero', () => {
  assert.equal(formatNumber(-2), '−2');
  assert.equal(formatNumber(0.05), '0.05');
  assert.equal(formatNumber(0.1 + 0.2), '0.3');
  assert.equal(formatNumber(-0.25, 1), '−0.3');
  assert.equal(formatNumber(-0.001, 2), '0.00');
});

test('the plot of the demo deck is valid', () => {
  const html = readFileSync('index.html', 'utf8');
  const block = html.match(/<script type="application\/json" id="multipliers">(.*?)<\/script>/s);
  assert.ok(block, 'the JSON block of the plot is in index.html');
  const plot = parsePlot(block[1]);
  assert.deepEqual(plot.tabs.map((t) => t.name), ['l1', 'l2']);
});

const state = `(() => {
  const view = Beeson.plots.find((p) => p.el.dataset.plot === 'data');
  return {
    playing: view.playing,
    frame: view.frame,
    hidden: [...view.el.querySelectorAll('.plot-panel')].map((g) => g.classList.contains('plot-hidden')),
    tab: view.el.querySelector('[aria-selected="true"]').textContent,
  };
})()`;

test('a plot is played while its slide is shown, and its steps show a panel and switch its tab', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('test/pages/plot-steps.html', '', '/1'));
  await page.waitFor(deckSettled);

  const first = await page.evaluate(state);
  assert.equal(first.playing, true);
  assert.deepEqual(first.hidden, [false, true]);
  assert.equal(first.tab, 'one');
  await page.waitFor(`${state}.frame > ${first.frame}`);

  await page.evaluate('Reveal.next()');
  assert.deepEqual((await page.evaluate(state)).hidden, [false, false]);
  await page.evaluate('Reveal.next()');
  assert.equal((await page.evaluate(state)).tab, 'two');

  await page.evaluate('Reveal.next()');
  assert.equal((await page.evaluate(state)).playing, false);
  const error = await page.evaluate(`document.querySelector('[data-plot="missing"] .plot-error').textContent`);
  assert.match(error, /the JSON block with the id "missing" is not found/);
  assert.deepEqual(page.errors.filter((e) => !e.includes('"missing"')), []);
});

test('a plot is printed at its last frame, with the panels and the tab of each step', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await printView(page, deckUrl('test/pages/plot-steps.html', 'print-pdf'));

  const pages = await page.evaluate(`[...document.querySelectorAll('.pdf-page [data-plot="data"]')].map((el) => ({
    hidden: [...el.querySelectorAll('.plot-panel')].map((g) => g.classList.contains('plot-hidden')),
    tab: el.querySelector('[aria-selected="true"]').textContent,
    value: el.querySelector('.plot-value').textContent,
  }))`);
  assert.deepEqual(pages, [
    { hidden: [false, true], tab: 'one', value: '1.00' },
    { hidden: [false, false], tab: 'one', value: '1.00' },
    { hidden: [false, false], tab: 'two', value: '1.00' },
  ]);
  assert.equal(await page.evaluate('Beeson.plots.some((p) => p.playing)'), false);
});
