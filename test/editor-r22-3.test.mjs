// the lag of the zoom slider of the status bar: a drag of its thumb across 30 steps, each timed
// from the dispatch of its pointer event to the frame painted after it, on the title slide and on
// a slide with a backdrop and three blocks selected, and the zoom, the scroll, the frames of the
// selection, the rulers, the guides, and the percentage after the drag, which equal those of the
// same zooms set one by one through the stage and those of the base. a pinch sent as a wheel with
// Ctrl is timed in the same way, and laid out by reveal.js after it

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { launch } from '../scripts/chrome.mjs';
import { editorPage } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const STEPS = 30;
// the bounds of a step in ms, i.e. a median under 0.6 of a frame and a slowest step under 2.4
// frames on the title slide, and under one frame and 3.6 frames with the selection. the base
// takes 20 to 30 ms at the median and 29 to 36 ms at the slowest step on the title slide, and 33
// to 52 ms and 52 to 62 ms with the selection, on a Mac with other tests running. a fluent drag
// takes under half of each bound, and its slowest steps are the two or three at which reveal.js
// is laid out again, once the zoom has doubled
const BOUNDS = { title: { median: 10, slowest: 40 }, selected: { median: 16, slowest: 60 } };
// as in perf.test.mjs, the timing of a shared runner of GitHub does not stand for a laptop
const TIMED = { skip: process.env.CI ? 'the timing of a shared runner does not stand for a laptop' : false };

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser?.close();
});

async function open(t, platform) {
  const page = await editorPage(browser, { query: `edit&still&edit-platform=${platform}`, page: { width: 1600, height: 1000 } });
  t.after(() => page.close());
  return page;
}

const frames = (page) => page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true))))');
const mouse = (page, type, x, y, extra = {}) => page.send('Input.dispatchMouseEvent', { type, x, y, ...extra });

// the time of each pointer move from its dispatch to the frame painted after it, which a message
// posted from the frame callback is received after. the time from the creation of the event would
// add the wait for the next frame, which Chrome dispatches a move at
const PROBE = `(() => {
  const p = window.probe = { times: [], wait: null };
  const timed = () => {
    const t0 = performance.now();
    p.wait = new Promise((done) => requestAnimationFrame(() => {
      const c = new MessageChannel();
      c.port1.onmessage = () => done(p.times.push(performance.now() - t0));
      c.port2.postMessage(0);
    }));
  };
  addEventListener('pointermove', timed, true);
  addEventListener('wheel', timed, true);
  return true;
})()`;

// slide 3 of the demo deck, with its backdrop, its heading, its paragraph, and its list selected
// with Shift-clicks, the rulers on, and two guides
async function loaded(page) {
  await page.evaluate(`(async () => {
    Reveal.slide(2);
    document.querySelector('.reveal section.present').setAttribute('data-guides', 'x480 y270');
    // the setting is kept in the storage of the browser from an earlier test, and the guides are shown with the rulers
    if (!window.BeesonEditor.state('view.rulers').checked) await window.BeesonEditor.exec('view.rulers');
  })()`);
  await frames(page);
  const points = await page.evaluate(`[...document.querySelectorAll('.reveal section.present > h2, .reveal section.present > p, .reveal section.present > ul')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + 10, y: r.top + Math.min(r.height / 2, 20) }; })`);
  for (const [i, p] of points.entries()) {
    await mouse(page, 'mouseMoved', p.x, p.y);
    await mouse(page, 'mousePressed', p.x, p.y, { button: 'left', buttons: 1, clickCount: 1, modifiers: i ? 8 : 0 });
    await mouse(page, 'mouseReleased', p.x, p.y, { button: 'left', clickCount: 1, modifiers: i ? 8 : 0 });
  }
  await frames(page);
  assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 3);
}

// a drag of the thumb from the left end of the slider to its right end in STEPS moves, each sent
// after the frame of the move before. returns the time of each move, and the zoom after the press
// and after each move
async function dragSlider(page) {
  await page.evaluate(PROBE);
  const r = await page.evaluate(`document.querySelector('.beeson-edit-bottom .zoom .slider').getBoundingClientRect().toJSON()`);
  const y = r.top + r.height / 2;
  const x0 = r.left + 8;
  const x1 = r.right - 8;
  await mouse(page, 'mouseMoved', x0, y);
  await mouse(page, 'mousePressed', x0, y, { button: 'left', buttons: 1, clickCount: 1 });
  await frames(page);
  await page.evaluate('window.probe.times = []');
  const zooms = [await page.evaluate('window.BeesonEditorShell.stage.zoom')];
  for (let i = 1; i <= STEPS; i++) {
    await page.evaluate('window.probe.wait = null');
    await mouse(page, 'mouseMoved', x0 + ((x1 - x0) * i) / STEPS, y, { button: 'left', buttons: 1 });
    await page.evaluate('window.probe.wait');
    zooms.push(await page.evaluate('window.BeesonEditorShell.stage.zoom'));
  }
  await mouse(page, 'mouseReleased', x1, y, { button: 'left', clickCount: 1 });
  await frames(page);
  return { times: await page.evaluate('window.probe.times'), zooms };
}

// a pinch of a trackpad as Chrome sends it, a wheel with Ctrl, in STEPS events at the center of the
// canvas, half of them in and half out, each sent after the frame of the one before
async function pinchWheel(page) {
  await page.evaluate(PROBE);
  const v = await page.evaluate('window.BeesonEditorShell.stage.viewport.toJSON()');
  const x = v.left + v.width / 2;
  const y = v.top + v.height / 2;
  await mouse(page, 'mouseMoved', x, y);
  await frames(page);
  await page.evaluate('window.probe.times = []');
  for (let i = 1; i <= STEPS; i++) {
    await page.evaluate('window.probe.wait = null');
    await mouse(page, 'mouseWheel', x, y, { deltaX: 0, deltaY: i <= STEPS / 2 ? -30 : 10, modifiers: 2 });
    await page.evaluate('window.probe.wait');
  }
  return page.evaluate('window.probe.times');
}

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

// the state that a user sees of the zoom: the zoom, the scroll of the canvas, the slide, the frames
// and the handles of the selection, the rulers, the guides, the percentage, and the thumb
const STATE = `(() => {
  const s = window.BeesonEditorShell.stage;
  const box = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 100) / 100).join(' '); };
  const shown = (sel) => [...document.querySelectorAll(sel)].filter((e) => !e.hidden && e.getClientRects().length).map(box);
  return {
    zoom: s.zoom,
    scroll: [s.el.scrollLeft, s.el.scrollTop],
    slide: box(document.querySelector('.reveal .slides')),
    frames: shown('.beeson-overlay *'),
    rulers: [...document.querySelectorAll('canvas.beeson-ruler')].map((c) => c.toDataURL()),
    guides: shown('.beeson-hand-guide'),
    percent: document.querySelector('.beeson-edit-bottom .zoom .percent').textContent,
    thumb: document.querySelector('.beeson-edit-bottom .zoom input').value,
  };
})()`;

for (const platform of PLATFORMS) {
  for (const [where, bound] of [['the title slide', BOUNDS.title], ['a slide with a backdrop and three blocks selected', BOUNDS.selected]]) {
    test(`a drag of the zoom slider on ${where} paints each of its ${STEPS} steps within the bounds (${platform})`, TIMED, async (t) => {
      const page = await open(t, platform);
      if (where !== 'the title slide') await loaded(page);
      const { times } = await dragSlider(page);
      assert.equal(times.length, STEPS);
      const m = median(times);
      const slowest = Math.max(...times);
      const text = `the steps take ${times.map((v) => v.toFixed(1)).join(', ')} ms`;
      t.diagnostic(`median ${m.toFixed(1)} ms, slowest ${slowest.toFixed(1)} ms: ${times.map((v) => v.toFixed(0)).join(' ')}`);
      assert.ok(m < bound.median, `the median step takes ${m.toFixed(1)} ms, over ${bound.median} ms. ${text}`);
      assert.ok(slowest < bound.slowest, `the slowest step takes ${slowest.toFixed(1)} ms, over ${bound.slowest} ms. ${text}`);
    });
  }

  test(`after a drag of the zoom slider, the canvas is drawn as the same zooms set through the stage draw it (${platform})`, async (t) => {
    const dragged = await open(t, platform);
    await loaded(dragged);
    const { zooms } = await dragSlider(dragged);
    assert.ok(zooms[STEPS] > 3, `the drag ends at the zoom ${zooms[STEPS]}`);
    const set = await open(t, platform);
    await loaded(set);
    for (const z of zooms) {
      await set.evaluate(`window.BeesonEditorShell.stage.setZoom(${z})`);
      await frames(set);
    }
    // the thumb of the slider is not moved by a zoom while the slider has the focus
    await set.evaluate(`document.querySelector('.beeson-edit-bottom .zoom input').focus()`);
    await frames(set);
    const want = await set.evaluate(STATE);
    const got = await dragged.evaluate(STATE);
    assert.ok(got.frames.length > 0, 'the selection is not framed');
    assert.equal(got.guides.length, 2);
    assert.deepEqual({ ...got, thumb: null }, { ...want, thumb: null });
    // the zoom, the scroll, the slide, and the guides of the base in a window of 1600 by 1000
    assert.deepEqual({ zoom: got.zoom, scroll: got.scroll, slide: got.slide, guides: got.guides, percent: got.percent, thumb: got.thumb }, {
      zoom: 3.86, scroll: [3188, 1677], slide: '-2937.6 -1545.9 7411.2 4168.8', guides: ['-1084.8 99 1 873', '218 -503.69 1094 1'], percent: '386%', thumb: '991',
    });
  });

  test(`a pinch as a wheel with Ctrl on a slide with a backdrop and three blocks selected paints each of its ${STEPS} steps within the bounds, and is laid out after it (${platform})`, TIMED, async (t) => {
    const page = await open(t, platform);
    await loaded(page);
    const times = await pinchWheel(page);
    // reveal.js is laid out at the zoom once the pinch has ended
    await page.evaluate('new Promise((done) => setTimeout(done, 400))');
    await frames(page);
    const got = await page.evaluate(STATE);
    assert.equal(await page.evaluate('Reveal.getScale()'), got.zoom);
    // the zoom, the scroll, the slide, and the guides in a window of 1600 by 1000. the pinch is held
    // at the zoom of 4 and then zoomed out by exp(-0.75), to 1.889, which is floored once to 1.88
    assert.deepEqual({ zoom: got.zoom, scroll: got.scroll, slide: got.slide, guides: got.guides, percent: got.percent }, {
      zoom: 1.88, scroll: [1290, 610], slide: '-1039.8 -478.7 3609.6 2030.4', guides: ['-137.39 99 1 873', '218 28.89 1094 1'], percent: '188%',
    });
    assert.ok(got.frames.length > 0, 'the selection is not framed');
    assert.equal(times.length, STEPS);
    const m = median(times);
    const slowest = Math.max(...times);
    const text = `the steps take ${times.map((v) => v.toFixed(1)).join(', ')} ms`;
    t.diagnostic(`median ${m.toFixed(1)} ms, slowest ${slowest.toFixed(1)} ms: ${times.map((v) => v.toFixed(0)).join(' ')}`);
    assert.ok(m < BOUNDS.selected.median, `the median step takes ${m.toFixed(1)} ms, over ${BOUNDS.selected.median} ms. ${text}`);
    assert.ok(slowest < BOUNDS.selected.slowest, `the slowest step takes ${slowest.toFixed(1)} ms, over ${BOUNDS.selected.slowest} ms. ${text}`);
  });
}
