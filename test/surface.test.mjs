// checks of the surfaces: the effective potential of src/surfaces.ts and its libration points, and the
// surface of the demo deck in Chrome, stepped through its stages live and in the print view

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
  assert.equal(f.stages.cut({ c: '3.39' }).level, -1.695);
  assert.equal(f.stages.cut({}).level, sum(librationPoints(MU)[0].x, 0));
  assert.deepEqual(Object.keys(f.stages), ['flat', 'wells', 'bowl', 'sum', 'extrema', 'cut']);
  assert.equal(surfaceFunction('nothing', {}), null);
});

// the stage of the surface and a digest of its canvas, on the slide of the surface or on each of its
// pages in the print view
const surfaces = `Promise.all([...document.querySelectorAll('.surface')].filter((s) => s.getClientRects().length).map(async (s) => {
  const canvas = s.querySelector('canvas'), ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let drawn = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) drawn++;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return { stage: s.dataset.shown, drawn: drawn / (data.length / 4), digest: [...digest.slice(0, 8)].join('.') };
}))`;

test('the surface of the demo deck is drawn at each of its stages, live and in the print view', { timeout: 120000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const stages = ['flat', 'wells', 'bowl', 'sum', 'extrema', 'cut'];

  const page = await browser.newPage();
  await page.goto(deckUrl('index.html', 'still'));
  await page.waitFor(deckSettled);
  const h = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('.surface'))`);
  const live = [];
  for (let f = -1; f < stages.length - 1; f++) {
    await page.evaluate(`Reveal.slide(${h}, 0, ${f})`);
    live.push(...(await page.evaluate(surfaces)));
  }
  // a drag turns the surface, and the slide is not changed by it as by a swipe
  const turned = await page.evaluate(`(async () => {
    const s = document.querySelector('.surface'), r = s.getBoundingClientRect();
    const drag = (type, x) => s.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', isPrimary: true, clientX: x, clientY: r.top + r.height / 2, bubbles: true }));
    drag('pointerdown', r.left + 500);
    drag('pointermove', r.left + 300);
    drag('pointerup', r.left + 300);
    return { h: Reveal.getIndices().h, surface: (await ${surfaces})[0] };
  })()`);
  assert.equal(turned.h, h);
  assert.notEqual(turned.surface.digest, live.at(-1).digest);
  await page.evaluate(`Reveal.slide(${h}, 0, ${stages.length - 2})`);

  assert.deepEqual(page.errors, []);
  assert.deepEqual(live.map((s) => s.stage), stages);
  for (const s of live) assert.ok(s.drawn > 0.1, `${(100 * s.drawn).toFixed(1)}% of the canvas is drawn at the stage ${s.stage}`);
  assert.equal(new Set(live.map((s) => s.digest)).size, stages.length);

  const print = await browser.newPage();
  await printView(print, deckUrl('index.html', 'print-pdf&still'));
  const pages = await print.evaluate(surfaces);
  assert.deepEqual(print.errors, []);
  // the last page is the step that restores the dimmed fragments, at the last stage
  assert.deepEqual(pages.map((s) => s.stage), [...stages, 'cut']);
  assert.equal(new Set(pages.map((s) => s.digest)).size, stages.length);
  // the pixels are not compared one by one, since a canvas read back a few times is moved to the
  // processor by Chrome, and the copy of the WebGL image is then rounded differently
  pages.forEach((s, i) => {
    const slide = live[Math.min(i, live.length - 1)];
    assert.ok(Math.abs(s.drawn - slide.drawn) < 0.002, `the page of the stage ${s.stage} is drawn over ${s.drawn}, and the slide over ${slide.drawn}`);
  });
});
