// checks of the plot element of src/plot.ts, i.e. the parser of the JSON block

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlot } from '../src/plot.ts';

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
