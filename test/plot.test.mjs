// checks of the plot element of src/plot.ts, i.e. the parser of the JSON block, the interpolation
// between frames, the loop, and the markup of the labels

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber, framesAt, loopFrame, nearest, parseMarkup, parsePlot, traceTo, valueAt } from '../src/plot.ts';

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
  assert.deepEqual(plot.panels[0].x, { range: [0, 1], ticks: [], title: '' });
  assert.equal(plot.panels[0].axes, true);
  assert.equal(plot.marks[0].tone, 'accent');
  assert.equal(plot.tabs[0].label, 'a');
  assert.equal(plot.tabs[0].active, null);
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
