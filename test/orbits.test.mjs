// checks of the orbit engine and the scenes, run by `node --test test/` with type stripping

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lagrange, lyapunovFamily, spaced, toCrossing } from '../src/orbits.ts';
import { SCENE_NAMES, scene } from '../src/scenes.ts';

const H = 0.004;
// the fewest strands each scene is expected to hold. the L2 family of nest stops after 7 of its 12
// members, where the continuation of the audition engine stops too
const FEWEST = { nest: 24, dro: 9, l1: 26, l2: 20, lyapunovs: 32, mark: 1, manifold: 13 };

test('the collinear points L1 and L2 match the Earth–Moon values', () => {
  assert.ok(Math.abs(lagrange(1) - 0.8369) < 5e-4);
  assert.ok(Math.abs(lagrange(2) - 1.1557) < 5e-4);
});

test('every scene computes with the expected number of strands', () => {
  assert.deepEqual([...SCENE_NAMES].sort(), Object.keys(FEWEST).sort());
  for (const name of SCENE_NAMES) assert.ok(scene(name).length >= FEWEST[name], `${name}: ${scene(name).length} strands`);
});

test('each periodic strand closes on its first point', () => {
  for (const name of SCENE_NAMES) {
    const strands = name === 'manifold' ? scene(name).slice(0, 1) : scene(name);
    for (const s of strands) {
      const n = s.pts.length;
      assert.ok(Math.hypot(s.pts[0] - s.pts[n - 2], s.pts[1] - s.pts[n - 1]) < 1e-5, name);
    }
  }
});

// the closure above holds by the mirror construction, hence the corrected state is also flown for
// a full period
test('a corrected Lyapunov member returns to its state after one period', () => {
  for (const m of lyapunovFamily(1, spaced(0.006, 0.17, 26, 1.35), H)) {
    const r = toCrossing(m.s, H, 1.2 * m.t, 4 * m.t);
    assert.ok(r.hit);
    assert.ok(Math.abs(r.t - 2 * m.t) < 1e-4);
    assert.ok(Math.hypot(...[0, 1, 3, 4].map((i) => r.s[i] - m.s[i])) < 1e-4);
  }
});

test('the Lyapunov periods grow with the amplitude', () => {
  for (const name of ['l1', 'l2']) {
    const T = scene(name).map((s) => s.T);
    for (let i = 1; i < T.length; i++) assert.ok(T[i] > T[i - 1], `${name} member ${i}`);
  }
});

test('the manifold strands leave the orbit toward the Moon and toward the Earth', () => {
  const [orbit, ...strands] = scene('manifold');
  const ends = strands.map((s) => s.pts[s.pts.length - 2]);
  const xmin = Math.min(...orbit.pts.filter((_, i) => i % 2 === 0));
  const xmax = Math.max(...orbit.pts.filter((_, i) => i % 2 === 0));
  assert.ok(ends.some((x) => x < xmin - 0.2), 'a strand toward the Earth');
  assert.ok(ends.some((x) => x > xmax + 0.1), 'a strand toward the Moon');
  for (const s of strands) assert.ok(s.times[0] >= 0 && s.times[0] < orbit.T);
});

test('a scene computes in under 150 ms', async () => {
  // a fresh module instance, so that the cache of the scenes above is empty
  const fresh = await import(`../src/scenes.ts?fresh=${Date.now()}`);
  const t = performance.now();
  fresh.scene('nest');
  assert.ok(performance.now() - t < 150);
});
