// checks of the surfaces: the effective potential of src/surfaces.ts and its libration points, and the
// surface of the demo deck in Chrome, stepped through its states live and in the print view

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { effectivePotential, levelCurves, librationPoints, sample, surfaceFunction } from '../src/surfaces.ts';

const MU = 0.05;
const { sum } = effectivePotential(MU);

// the roots of the quintics of Szebehely, Theory of Orbits, 1967, section 4.5, at mu = 0.05, found by
// bisection in double precision
const KNOWN = {
  L1: [0.7152253503677874, 0],
  L2: [1.2280936671005072, 0],
  L3: [-1.020826334325222, 0],
  L4: [0.45, Math.sqrt(3) / 2],
  L5: [0.45, -Math.sqrt(3) / 2],
};

// the gradient and the Hessian of f at (x, y), by central differences of step h
function derivatives(f, x, y, h = 1e-4) {
  const fx = (f(x + h, y) - f(x - h, y)) / (2 * h), fy = (f(x, y + h) - f(x, y - h)) / (2 * h);
  const fxx = (f(x + h, y) - 2 * f(x, y) + f(x - h, y)) / h ** 2, fyy = (f(x, y + h) - 2 * f(x, y) + f(x, y - h)) / h ** 2;
  const fxy = (f(x + h, y + h) - f(x + h, y - h) - f(x - h, y + h) + f(x - h, y - h)) / (4 * h ** 2);
  return { gradient: Math.hypot(fx, fy), det: fxx * fyy - fxy ** 2, trace: fxx + fyy };
}

test('the libration points at mu = 0.05 are the roots of the quintics of Szebehely', () => {
  for (const { name, x, y } of librationPoints(MU)) {
    const [kx, ky] = KNOWN[name];
    assert.ok(Math.abs(x - kx) < 1e-12 && Math.abs(y - ky) < 1e-12, `${name} at (${x}, ${y}), known (${kx}, ${ky})`);
  }
});

test('the libration points are three saddles and two maxima of the effective potential, at any mass ratio', () => {
  for (const mu of [0.001, 0.01215, 0.05, 0.3, 0.5]) {
    const f = effectivePotential(mu).sum;
    for (const { name, x, y, kind } of librationPoints(mu)) {
      const { gradient, det, trace } = derivatives(f, x, y);
      assert.ok(gradient < 1e-6, `the gradient at ${name} is ${gradient} at mu = ${mu}`);
      const found = det < 0 ? 'saddle' : trace < 0 ? 'maximum' : 'minimum';
      assert.equal(found, kind, `${name} at mu = ${mu}`);
    }
  }
});

test('the effective potential is symmetric about the x axis', () => {
  for (let x = -1.5; x <= 1.5; x += 0.0625) {
    for (let y = 0.03125; y <= 1.5; y += 0.0625) assert.equal(sum(x, y), sum(x, -y));
  }
});

test('the zero-velocity curve at the Jacobi constant of L1 passes through L1', () => {
  const n = 200, box = [-1.5, 1.5], d = 3 / n;
  const g = sample(sum, box, box, n, n, -3.2);
  const [L1] = librationPoints(MU);
  // the distance from L1 to the nearest point of the curves at C
  const nearest = (C) => Math.min(...levelCurves(g, box, box, n, n, -C / 2).flatMap((c) => {
    const out = [];
    for (let i = 0; i < c.length; i += 2) out.push(Math.hypot(c[i] - L1.x, c[i + 1] - L1.y));
    return out;
  }));
  const C1 = -2 * sum(L1.x, 0);

  assert.ok(nearest(C1) < d, `the curve at C1 is ${nearest(C1)} from L1, and a cell is ${d} wide`);
  assert.ok(nearest(C1 + 0.1) > 3 * d, 'the curve at a larger C, with the neck at L1 closed, is not near L1');
  assert.ok(nearest(C1 - 0.1) > 3 * d, 'the curve at a smaller C, with the neck at L1 open, is not near L1');
});

test('the cut of the effective potential is at -C/2, with C from data-C or else at L1', () => {
  const f = surfaceFunction('effective-potential', { mu: '0.05' });
  assert.equal(f.states.cut({ c: '3.39' }).level, -1.695);
  assert.equal(f.states.cut({}).level, sum(librationPoints(MU)[0].x, 0));
  assert.deepEqual(Object.keys(f.states), ['zero', 'gravitational', 'centrifugal', 'effective', 'extrema', 'cut']);
  assert.equal(surfaceFunction('nothing', {}), null);
});

// the state of the surface and a digest of its canvas, on the slide of the surface or on each of its
// pages in the print view, for the surfaces of the slides headed title
const TITLE = 'Explain concepts, visually';
const surfaces = (title = TITLE) => `Promise.all([...document.querySelectorAll('.surface')].filter((s) => s.getClientRects().length && s.closest('section').querySelector('h2')?.textContent === ${JSON.stringify(title)}).map(async (s) => {
  const canvas = s.querySelector('canvas'), ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let drawn = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) drawn++;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return { state: s.dataset.shown, drawn: drawn / (data.length / 4), digest: [...digest.slice(0, 8)].join('.') };
}))`;

test('the surface of the demo deck is drawn at each of its states, live and in the print view', { timeout: 120000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const states = ['zero', 'gravitational', 'centrifugal', 'effective', 'extrema', 'cut'];

  const page = await browser.newPage();
  await page.goto(deckUrl('test-deck.html', 'still'));
  await page.waitFor(deckSettled);
  const h = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('.surface'))`);
  // the label of each point shown is at the point, also after a turn of the camera
  const live = [], astray = [];
  const labeled = async (where) => {
    for (const m of (await page.evaluate(`Beeson.surfaces[0].probe()`)).points) {
      if (m.fade > 0 && !(m.label < 1)) astray.push(`the label of ${m.name} is ${m.label?.toFixed(1)} px from its point ${where}`);
    }
  };
  for (let f = -1; f < states.length - 1; f++) {
    await page.evaluate(`Reveal.slide(${h}, 0, ${f})`);
    live.push(...(await page.evaluate(surfaces())));
    await labeled(`at the state ${states[f + 1]}`);
  }
  // a drag turns the surface, and the slide is not changed by it as by a swipe
  const turned = await page.evaluate(`(async () => {
    const s = document.querySelector('.surface'), r = s.getBoundingClientRect();
    const drag = (type, x) => s.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', isPrimary: true, clientX: x, clientY: r.top + r.height / 2, bubbles: true }));
    drag('pointerdown', r.left + 500);
    drag('pointermove', r.left + 300);
    drag('pointerup', r.left + 300);
    return { h: Reveal.getIndices().h, surface: (await ${surfaces()})[0] };
  })()`);
  assert.equal(turned.h, h);
  assert.notEqual(turned.surface.digest, live.at(-1).digest);
  await labeled('after a drag');
  await page.evaluate(`Reveal.slide(${h}, 0, ${states.length - 2})`);

  assert.deepEqual(page.errors, []);
  assert.deepEqual(astray, []);
  assert.deepEqual(live.map((s) => s.state), states);
  for (const s of live) assert.ok(s.drawn > 0.1, `${(100 * s.drawn).toFixed(1)}% of the canvas is drawn at the state ${s.state}`);
  assert.equal(new Set(live.map((s) => s.digest)).size, states.length);

  const print = await browser.newPage();
  await printView(print, deckUrl('test-deck.html', 'print-pdf&still'));
  const pages = await print.evaluate(surfaces());
  assert.deepEqual(print.errors, []);
  // the last page is the step that restores the dimmed fragments, at the last state
  assert.deepEqual(pages.map((s) => s.state), [...states, 'cut']);
  assert.equal(new Set(pages.map((s) => s.digest)).size, states.length);
  // the pixels are not compared one by one, since a canvas read back a few times is moved to the
  // processor by Chrome, and the copy of the WebGL image is then rounded differently
  pages.forEach((s, i) => {
    const slide = live[Math.min(i, live.length - 1)];
    assert.ok(Math.abs(s.drawn - slide.drawn) < 0.002, `the page of the state ${s.state} is drawn over ${s.drawn}, and the slide over ${slide.drawn}`);
  });
});

// a change of state takes 1.4 s, or 2.6 s when the cutting plane is slid. a quick step is taken
// 0.4 s after the last one, while the surface is still being changed, as when a talk is stepped back
// in a hurry, and a settled step is taken once the change has ended
test('the points of the surface are drawn on it or hidden at every step, forward to cut and back to gravitational', { timeout: 120000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('test-deck.html'));
  await page.waitFor(deckSettled);
  const h = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('.surface'))`);
  const probe = `Beeson.surfaces.find((s) => s.el.closest('section') === Reveal.getCurrentSlide()).probe()`;
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  // each state with the index of the fragment that sets it
  const forward = [['gravitational', 0], ['centrifugal', 1], ['effective', 2], ['extrema', 3], ['cut', 4]];
  const backward = [['extrema', 3], ['effective', 2], ['centrifugal', 1], ['gravitational', 0]];
  const TOLERANCE = 0.02;
  const floating = [], buried = [];
  const look = (where, p) => {
    for (const m of p.points) {
      if (m.fade <= 0) continue;
      const dz = m.z - m.surface;
      if (dz > TOLERANCE) floating.push(`${m.name} ${dz.toFixed(2)} above the surface ${where}`);
      if (dz < -TOLERANCE) buried.push(`${m.name} ${(-dz).toFixed(2)} under the surface ${where}`);
    }
  };
  const walk = async (steps, pace) => {
    for (const [state, f] of steps) {
      await page.evaluate(`Reveal.slide(${h}, 0, ${f})`);
      for (let ms = 0; ; ms += 130) {
        const p = await page.evaluate(probe);
        assert.equal(p.state, state);
        look(`${ms} ms after the ${pace} step to ${state}`, p);
        if (pace === 'quick' ? ms >= 390 : p.settled) {
          if (pace === 'settled') {
            const shown = state === 'extrema' || state === 'cut';
            for (const m of p.points) assert.equal(m.fade, shown ? 1 : 0, `the fade of ${m.name} at the end of the step to ${state}`);
            for (const m of p.points) if (shown) assert.ok(m.label < 1, `the label of ${m.name} is ${m.label} px from its point at the end of the step to ${state}`);
          }
          break;
        }
        await wait(130);
      }
    }
  };

  await page.evaluate(`Reveal.slide(${h}, 0, -1)`);
  await page.waitFor(`(${probe}).settled`);
  await walk(forward, 'settled');
  await walk(backward, 'quick');
  await walk(forward.slice(1), 'quick');
  await walk(backward, 'settled');

  assert.deepEqual(page.errors, []);
  assert.deepEqual(floating, []);
  assert.deepEqual(buried, []);
});

// the demo slide whose surface points are picked out with data-surface-points, data-surface-accent,
// and data-surface-violet. its surface is at the state extrema from the fragment of index 4 on
const MARKED = 'Color the terms and the points';
const SADDLES = ['L1', 'L2', 'L3'], MAXIMA = ['L4', 'L5'];
// the opacity of a point left out of data-surface-points, UNLIT in src/surface.ts
const UNLIT = 0.18;

// the opacity lit and the tone of each point of the surface on the current slide, and the opacity of
// the label of the point
const marked = `(() => {
  const s = Beeson.surfaces.find((s) => s.el.closest('section') === Reveal.getCurrentSlide()), p = s.probe();
  const label = (name) => Number(s.el.querySelector('.label[data-at="' + name + '"]').style.opacity);
  return { state: p.state, settled: p.settled, points: Object.fromEntries(p.points.map((m) => [m.name, { lit: m.lit, tone: m.tone, label: label(m.name) }])) };
})()`;

// asserts that the points named in lit are at full opacity in tone, and the other points are dimmed
// to UNLIT in the color of the text. with every point in lit, every point is in the color of the text
function expectPoints(seen, lit, tone, where) {
  const every = lit.length === SADDLES.length + MAXIMA.length;
  for (const [name, m] of Object.entries(seen.points)) {
    const on = lit.includes(name);
    assert.ok(Math.abs(m.lit - (on ? 1 : UNLIT)) < 1e-3, `the lit of ${name} is ${m.lit} ${where}`);
    assert.equal(m.tone, on && !every ? tone : 'text', `the tone of ${name} ${where}`);
  }
}

test('the points of a surface are dimmed and colored by data-surface-points, data-surface-accent, and data-surface-violet', { timeout: 120000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('test-deck.html', 'still'));
  await page.waitFor(deckSettled);
  const h = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('h2')?.textContent === ${JSON.stringify(MARKED)})`);

  // the fragment that sets extrema does not have the attributes, hence every point is lit
  await page.evaluate(`Reveal.slide(${h}, 0, 3)`);
  const all = await page.evaluate(marked);
  assert.equal(all.state, 'extrema');
  expectPoints(all, [...SADDLES, ...MAXIMA], 'text', 'at the step that sets extrema');

  await page.evaluate(`Reveal.slide(${h}, 0, 4)`);
  const saddles = await page.evaluate(marked);
  expectPoints(saddles, SADDLES, 'accent', 'at the step of the saddles');
  // a dimmed label is faded with its point. a lit label is at least at BEHIND of src/surface.ts, the
  // opacity of a point behind the surface
  for (const name of MAXIMA) assert.ok(saddles.points[name].label <= UNLIT + 1e-3, `the label of ${name} is at ${saddles.points[name].label}`);
  for (const name of SADDLES) assert.ok(saddles.points[name].label >= 0.3 - 1e-3, `the label of ${name} is at ${saddles.points[name].label}`);

  await page.evaluate(`Reveal.slide(${h}, 0, 5)`);
  expectPoints(await page.evaluate(marked), MAXIMA, 'violet', 'at the step of the maxima');
  await page.evaluate(`Reveal.slide(${h}, 0, 4)`);
  expectPoints(await page.evaluate(marked), SADDLES, 'accent', 'after the step back to the saddles');
  assert.deepEqual(page.errors, []);

  // without still, a step that changes only the points leaves the sheets settled. the points are not
  // changed in the frame of the step, and they reach their targets in a few time constants of 0.15 s.
  // the page is set to motion, since a runner may prefer reduced motion, under which the points jump
  const live = await browser.newPage({ motion: true });
  await live.goto(deckUrl('test-deck.html'));
  await live.waitFor(deckSettled);
  await live.evaluate(`Reveal.slide(${h}, 0, 3)`);
  await live.waitFor(`(${marked}).settled`);
  const step = await live.evaluate(`(() => { Reveal.slide(${h}, 0, 4); return ${marked}; })()`);
  assert.equal(step.state, 'extrema');
  assert.equal(step.settled, true);
  assert.equal(step.points.L4.lit, 1);
  assert.equal(step.points.L4.tone, 'text');
  assert.equal(step.points.L1.tone, 'accent');
  await new Promise((done) => setTimeout(done, 1500));
  expectPoints(await live.evaluate(marked), SADDLES, 'accent', '1.5 s after the live step of the saddles');
  assert.deepEqual(live.errors, []);
});

test('a surface takes the camera of the surface with the same attributes on the slide before', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('test-deck.html'));
  await page.waitFor(deckSettled);
  const index = (title) => `[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('h2')?.textContent === ${JSON.stringify(title)})`;
  const h = await page.evaluate(index(TITLE)), next = await page.evaluate(index(MARKED));
  assert.equal(next, h + 1);
  await page.evaluate(`Reveal.slide(${h}, 0, 3)`);
  const camera = (s) => `{ azimuth: ${s}.azimuth, elevation: ${s}.elevation, resume: ${s}.resume }`;
  // a diagonal drag turns the camera of the first surface in azimuth and elevation, and pauses its turn
  const handed = await page.evaluate(`(() => {
    const s = document.querySelector('.surface'), r = s.getBoundingClientRect();
    const drag = (type, x, y) => s.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true }));
    drag('pointerdown', r.left + 500, r.top + 300);
    drag('pointermove', r.left + 300, r.top + 400);
    drag('pointerup', r.left + 300, r.top + 400);
    const [a, b] = Beeson.surfaces;
    const before = ${camera('b')};
    Reveal.slide(${next});
    return { before, from: ${camera('a')}, to: ${camera('b')} };
  })()`);
  assert.notDeepEqual(handed.before, handed.from);
  assert.deepEqual(handed.to, handed.from);
  assert.deepEqual(page.errors, []);
});
