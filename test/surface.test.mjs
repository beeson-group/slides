// checks of the surfaces: the effective potential of src/surfaces.ts and its libration points

import { test } from 'node:test';
import assert from 'node:assert/strict';
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
