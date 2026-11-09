// checks of the plot element of src/plot.ts, i.e. the parser of the JSON block, the interpolation
// between frames, the loop, and the markup of the labels. a plot of a test deck is played and
// printed in Chrome

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { cells, formatNumber, frameAt, framesAt, loopFade, loopFrame, nearest, parseMarkup, parsePlot, scaled, timeAt, traceTo, valueAt } from '../src/plot.ts';

const minimal = () => ({
  panels: [{ id: 'p', x: { range: [0, 1] }, y: { range: [0, 1] } }],
  marks: [{ id: 'm', panel: 'p', kind: 'points' }],
  tabs: [{ name: 'a', values: [0, 1], data: { m: [[0, 0], [1, 1]] } }],
});

test('a plot is read with its defaults', () => {
  const plot = parsePlot(JSON.stringify(minimal()));
  assert.equal(plot.duration, 8);
  assert.equal(plot.hold, 1);
  assert.equal(plot.fade, 0.5);
  assert.equal(plot.layout, null);
  assert.deepEqual(plot.panels[0].x, { range: [0, 1], ticks: [], title: '', scale: 'linear', unit: 1 });
  assert.equal(plot.panels[0].axes, true);
  assert.equal(plot.panels[0].size, 1);
  assert.deepEqual(plot.panels[0].margin, [52, 20, 84, 76]);
  assert.equal(plot.marks[0].tone, 'accent');
  assert.equal(plot.tabs[0].label, 'a');
  assert.equal(plot.tabs[0].active, null);
  assert.equal(plot.tabs[0].times, null);
  assert.deepEqual(plot.tabs[0].panels, {});
});

test('a trace is drawn with its ghost unless ghost is false', () => {
  const spec = minimal();
  spec.marks = [{ id: 'm', panel: 'p', kind: 'trace' }, { id: 'n', panel: 'p', kind: 'trace', ghost: false }];
  spec.tabs[0].data = { m: [[0, 0], [1, 1]], n: [[1, 0], [0, 1]] };
  assert.deepEqual(parsePlot(spec).marks.map((m) => m.ghost), [true, false]);
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
    [(p) => (p.tabs[0].times = [0, 1, 2]), /^tabs\[0\]\.times: 3 times are given, and the tab has 2 values/],
    [(p) => (p.tabs[0].times = [0.5, 1]), /^tabs\[0\]\.times: times that increase from 0 are expected/],
    [(p) => (p.tabs[0].times = [0, 0]), /^tabs\[0\]\.times: times that increase from 0 are expected/],
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

test('the frames of a tab with times are shown at their times, and the loop runs over these times', () => {
  // 3 frames at 0, 0.5, and 2 s, held for 1 s, where the duration of 99 s is not used
  const times = [0, 0.5, 2];
  assert.equal(timeAt(0.5, 3, 99, times), 0.25);
  assert.equal(timeAt(1.5, 3, 99, times), 1.25);
  assert.equal(frameAt(1.25, 3, 99, times), 1.5);
  assert.equal(frameAt(5, 3, 99, times), 2);
  assert.equal(loopFrame(1.25, 3, 99, 1, times), 1.5);
  assert.equal(loopFrame(2.5, 3, 99, 1, times), 2);
  assert.equal(loopFrame(4.25, 3, 99, 1, times), 1.5);
  // without times, the frames are shown at even steps over the duration
  assert.equal(timeAt(1.5, 3, 4, null), 3);
  assert.equal(frameAt(3, 3, 4, null), 1.5);
});

test('the moving marks are held through the hold and faded in at the start of the next pass', () => {
  // passes of 2 s, each held for 1 s, with a fade of 0.5 s, over which the held frame is faded out
  // at 1 minus the opacity of the next pass
  assert.equal(loopFade(0, 2, 1, 0.5), 1);
  assert.equal(loopFade(2.4, 2, 1, 0.5), 1);
  assert.equal(loopFade(2.99, 2, 1, 0.5), 1);
  assert.equal(loopFade(3, 2, 1, 0.5), 0);
  assert.equal(loopFade(3.25, 2, 1, 0.5), 0.5);
  assert.equal(loopFade(3.5, 2, 1, 0.5), 1);
  // a fade longer than a pass is cut to the pass, and a fade of 0 keeps the marks
  assert.equal(loopFade(4, 2, 1, 4), 0.5);
  assert.equal(loopFade(3.1, 2, 1, 0), 1);
});

test('a trace is read as a list of points, or with the last frame of its faint line', () => {
  const plot = (path) => ({
    panels: [{ id: 'p', x: { range: [0, 1] }, y: { range: [0, 1] } }],
    marks: [{ id: 'm', panel: 'p', kind: 'trace' }],
    tabs: [{ name: 'a', values: [0, 0.5, 1], data: { m: path } }],
  });
  const points = [[0, 0], [0.5, 1], [1, 0]];
  assert.deepEqual(parsePlot(plot(points)).tabs[0].data.m, { points, ghost: 2 });
  assert.deepEqual(parsePlot(plot({ points, ghost: 1 })).tabs[0].data.m, { points, ghost: 1 });
  assert.deepEqual(parsePlot(plot({ points, ghost: 0 })).tabs[0].data.m, { points, ghost: 0 });
  assert.throws(() => parsePlot(plot({ points, ghost: 3 })), { message: /^tabs\[0\]\.data\.m\.ghost: a frame from 0 to 2 is expected/ });
  assert.throws(() => parsePlot(plot({ points, ghost: 0.5 })), { message: /^tabs\[0\]\.data\.m\.ghost: a frame from 0 to 2 is expected/ });
  assert.throws(() => parsePlot(plot({ points: points.slice(1) })), { message: /^tabs\[0\]\.data\.m: 2 frames are given, and the tab has 3 values/ });
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
  assert.deepEqual(parseMarkup('$\\mathcal{EH}^{+}$ and $\\mathcal{N}$'), [
    { text: 'ℰℋ', italic: false, shift: null },
    { text: '+', italic: false, shift: 'sup' },
    { text: ' and 𝒩', italic: false, shift: null },
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

// the state of the plot at every frame for 3 s: the pass, the opacity of the moving marks and of the
// copies of the held frame, the paths of the trace and of its copy, and the faint line
const crossfade = `(async () => {
  const view = Beeson.plots[0], samples = [];
  const d = (node) => node?.querySelector('.plot-trace')?.getAttribute('d') ?? null;
  const opacity = (node) => (node instanceof HTMLElement ? Number(/opacity\\(([\\d.e-]+)\\)/.exec(node.style.filter)?.[1] ?? 1) : Number(node.style.opacity || 1));
  for (const end = performance.now() + 3000; performance.now() < end; ) {
    await new Promise((done) => requestAnimationFrame(done));
    samples.push({
      pass: view.pass,
      fade: view.fade,
      live: view.faders.map(opacity),
      held: view.held.filter((n) => !(n instanceof HTMLElement)).map(opacity),
      liveText: view.fadeLabels.map(opacity),
      heldText: view.held.filter((n) => n instanceof HTMLElement).map(opacity),
      trace: d(view.faders.find((f) => f.querySelector('.plot-trace'))),
      heldTrace: d(view.held.find((f) => f.querySelector?.('.plot-trace'))),
    });
  }
  return { samples, ghost: view.el.querySelector('.plot-ghost')?.getAttribute('d') };
})()`;

test('at the restart of a loop, the held frame is faded out while the next pass is faded in', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ motion: true });
  await page.goto(deckUrl('test/pages/plot-loop.html'));
  await page.waitFor(deckSettled);
  const { samples, ghost } = await page.evaluate(crossfade);
  // the faint line of the trace ends at its second frame
  assert.equal((ghost.match(/[ML]/g) ?? []).length, 2);
  const fading = samples.filter((s) => s.held.length);
  assert.ok(fading.length > 3, `${fading.length} frames of a crossfade are drawn`);
  for (const s of samples) {
    // the opacity of the marks and of the held copies sums to 1 at every frame, hence the plot is
    // not empty at the restart
    assert.ok(s.live.every((a) => Math.abs(a - s.fade) < 1e-6), JSON.stringify(s));
    if (s.held.length) {
      assert.equal(s.held.length, s.live.length);
      assert.ok(s.held.every((a) => Math.abs(a + s.fade - 1) < 1e-6), JSON.stringify(s));
      assert.ok(s.pass > 0 && s.fade < 1);
      // a text of the held frame is gone before a text of the next pass is shown
      assert.equal(s.heldText.length, s.liveText.length);
      assert.ok(s.heldText.every((a) => Math.abs(a - Math.max(0, 1 - 2 * s.fade)) < 1e-6), JSON.stringify(s));
      assert.ok(s.liveText.every((a) => Math.abs(a - Math.max(0, 2 * s.fade - 1)) < 1e-6), JSON.stringify(s));
    } else assert.equal(s.fade, 1, JSON.stringify(s));
  }
  // the copy holds the whole path, while the next pass is traced from its first frame
  const full = samples.filter((s) => s.pass === 0).at(-1).trace;
  assert.equal((full.match(/L/g) ?? []).length, 2, 'the first pass is held at its last frame');
  assert.ok(fading.every((s) => s.heldTrace === full && s.trace.length < full.length), JSON.stringify(fading[0]));
  assert.deepEqual(page.errors, []);
});

const state = `(() => {
  const view = Beeson.plots.find((p) => p.el.dataset.plot === 'data');
  return {
    playing: view.playing,
    frame: view.frame,
    hidden: [...view.el.querySelectorAll('.plot-panel')].map((g) => g.classList.contains('plot-hidden')),
    tab: view.el.querySelector('[aria-selected="true"]').textContent,
    ghosts: view.el.querySelectorAll('.plot-ghost').length,
    traces: view.el.querySelectorAll('.plot-trace').length,
  };
})()`;

test('a plot is played while its slide is shown, and its steps show a panel and switch its tab', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ motion: true });
  await page.goto(deckUrl('test/pages/plot-steps.html', '', '/1'));
  await page.waitFor(deckSettled);

  const first = await page.evaluate(state);
  assert.equal(first.playing, true);
  assert.deepEqual(first.hidden, [false, true]);
  assert.equal(first.tab, 'one');
  // the trace bare is drawn without its ghost
  assert.equal(first.traces, 2);
  assert.equal(first.ghosts, 1);
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

const reveals = (id) => `(() => {
  const view = Beeson.plots.find((p) => p.el.id === '${id}');
  const buttons = [...view.el.querySelectorAll('.plot-tabs button')];
  const panels = [...view.el.querySelectorAll('.plot-panel')];
  const label = (text) => [...view.el.querySelectorAll('.plot-label')].find((l) => l.textContent === text);
  return {
    playing: view.playing,
    frame: view.frame,
    panels: panels.length,
    tabs: buttons.map((b) => [b.textContent, b.disabled, b.classList.contains('plot-hidden')]),
    tab: buttons.find((b) => b.getAttribute('aria-selected') === 'true')?.textContent ?? null,
    title: [...view.el.querySelectorAll('.plot-title')].map((t) => t.textContent),
    ticks: [...view.el.querySelectorAll('.plot-tick-mark')].map((t) => t.style.background),
    dimmed: ['a', 'b'].map((t) => label(t)?.classList.contains('plot-off') ?? null),
    dot: Number(view.el.querySelector('.plot-dot')?.getAttribute('cx')),
    at: ['−100', 'zero', '100'].map((t) => parseFloat(label(t)?.style.left)),
  };
})()`;

test('a plot is held until its cue, offers the tabs of its element and of the steps shown, and draws a tab with its own axis', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ motion: true });
  await page.goto(deckUrl('test/pages/plot-reveals.html'));
  await page.waitFor(deckSettled);

  const held = await page.evaluate(reveals('held'));
  assert.equal(held.playing, false);
  assert.equal(held.frame, 0);
  assert.equal(held.panels, 1);
  assert.deepEqual(held.tabs, []);
  // the dot at 10 on an axis from -100 to 100 in asinh is drawn between the ticks at asinh(10)
  const [lo, zero, hi] = held.at;
  assert.ok(Math.abs(zero - (lo + hi) / 2) < 1);
  assert.ok(Math.abs(held.dot - (zero + ((hi - zero) * Math.asinh(10)) / Math.asinh(100))) < 1);
  // a, active on the tab one, is emphasized, and b, active on the tab two only, is dimmed
  assert.deepEqual(held.dimmed, [false, true]);

  await page.evaluate('Reveal.next()');
  assert.equal((await page.evaluate(reveals('held'))).playing, true);
  await page.evaluate('Reveal.prev()');
  const back = await page.evaluate(reveals('held'));
  assert.equal(back.playing, false);
  assert.equal(back.frame, 0);

  await page.evaluate('Reveal.next(); Reveal.next()');
  const offered = await page.evaluate(reveals('offered'));
  assert.equal(offered.playing, true);
  assert.equal(offered.panels, 2);
  assert.deepEqual(offered.tabs, [['one', false, false], ['two', false, false], ['three', true, true]]);
  assert.deepEqual(offered.ticks, ['var(--violet)']);
  assert.equal((await page.evaluate(reveals('held'))).playing, false);

  await page.evaluate('Reveal.next()');
  assert.deepEqual((await page.evaluate(reveals('offered'))).tabs[2], ['three', false, false]);
  await page.evaluate('Reveal.next()');
  const third = await page.evaluate(reveals('offered'));
  assert.equal(third.tab, 'three');
  assert.ok(third.title.includes('y'));
  assert.ok(!third.title.includes('x'));
  assert.deepEqual(page.errors, []);
});

test('a held plot is printed at its still frame before its cue and at its last frame from the cue on', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await printView(page, deckUrl('test/pages/plot-reveals.html', 'print-pdf'));
  const values = await page.evaluate(`[...document.querySelectorAll('.pdf-page #held .plot-value')].map((v) => v.textContent)`);
  assert.deepEqual(values, ['0.00', '1.00']);
});

test('a curve of a plot keeps the color of a highlight when a tab is chosen', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('test/pages/plot-highlight.html'));
  await page.waitFor(deckSettled);
  const lit = `document.querySelector('#lit .plot-curve.edge').classList.contains('hl-accent')`;
  assert.equal(await page.evaluate(lit), false);
  await page.evaluate('Reveal.next()');
  assert.equal(await page.evaluate(lit), true);
  await page.evaluate(`document.querySelectorAll('#lit .plot-tabs button')[1].click()`);
  assert.equal(await page.evaluate(lit), true);
  assert.deepEqual(page.errors, []);
});
