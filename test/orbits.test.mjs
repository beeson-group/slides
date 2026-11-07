// checks of the orbit engine and the scenes, run with `npm test` under type stripping

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MU, lagrange, lyapunovFamily, spaced, toCrossing } from '../src/orbits.ts';
import { SCENE_NAMES, scene } from '../src/scenes.ts';

const H = 0.004;
// the smallest number of strands expected in each scene. the L2 family of nest is ended after 7 of
// its 12 members
const FEWEST = { nest: 24, dro: 9, l1: 26, l2: 20, lyapunovs: 32, mark: 1, tubes: 114, halo: 74, rosette: 13, hill: 15, transfer: 25 };
// the scenes with strands that are not periodic orbits
const FLIGHTS = ['tubes', 'transfer', 'hill'];

test('the collinear points L1 and L2 are at the Earth–Moon values', () => {
  assert.ok(Math.abs(lagrange(1) - 0.8369) < 5e-4);
  assert.ok(Math.abs(lagrange(2) - 1.1557) < 5e-4);
});

test('every scene is computed with the expected number of strands', () => {
  assert.deepEqual([...SCENE_NAMES].sort(), Object.keys(FEWEST).sort());
  for (const name of SCENE_NAMES) assert.ok(scene(name).length >= FEWEST[name], `${name}: ${scene(name).length} strands`);
});

test('each periodic strand is closed on its first point', () => {
  for (const name of SCENE_NAMES.filter((n) => !FLIGHTS.includes(n))) {
    for (const s of scene(name)) {
      const n = s.pts.length;
      assert.ok(Math.hypot(s.pts[0] - s.pts[n - 2], s.pts[1] - s.pts[n - 1]) < 1e-5, name);
    }
  }
});

// the closure above holds by the mirror construction, hence the corrected state is also flown for
// a full period
test('the state of a corrected Lyapunov member is recovered after one period', () => {
  for (const m of lyapunovFamily(1, spaced(0.006, 0.17, 26, 1.35), H)) {
    const r = toCrossing(m.s, H, 1.2 * m.t, 4 * m.t);
    assert.ok(r.hit);
    assert.ok(Math.abs(r.t - 2 * m.t) < 1e-4);
    assert.ok(Math.hypot(...[0, 1, 3, 4].map((i) => r.s[i] - m.s[i])) < 1e-4);
  }
});

test('the Lyapunov periods are longer at a larger amplitude', () => {
  for (const name of ['l1', 'l2']) {
    const T = scene(name).map((s) => s.T);
    for (let i = 1; i < T.length; i++) assert.ok(T[i] > T[i - 1], `${name} member ${i}`);
  }
});

const distance = (s, x, y) => {
  let best = Infinity;
  for (let i = 0; i < s.pts.length; i += 2) best = Math.min(best, Math.hypot(s.pts[i] - x, s.pts[i + 1] - y));
  return best;
};

test('an unstable tube leaves its orbit, a stable tube arrives on it, and both run past the orbit', () => {
  const strands = scene('tubes'), orbits = strands.filter((s) => s.tone === 'text');
  assert.equal(orbits.length, 2);
  const near = (x, y) => Math.min(...orbits.map((o) => distance(o, x, y)));
  for (const s of strands.filter((t) => t.tone === 'orange')) assert.ok(near(s.pts[0], s.pts[1]) < 0.01);
  for (const s of strands.filter((t) => t.tone === 'violet')) assert.ok(near(s.pts.at(-2), s.pts.at(-1)) < 0.01);
  const reach = strands.filter((s) => s.tone === 'orange').map((s) => s.pts[s.pts.length - 2]);
  assert.ok(reach.some((x) => x < 0.5), 'a strand toward the Earth');
  assert.ok(reach.some((x) => x > 1.3), 'a strand past L2');
});

test('the transfer is one unbroken path from near the Earth to near the Moon', () => {
  const { pts, times } = scene('transfer').find((s) => s.tone === 'hero'), n = pts.length;
  assert.ok(Math.hypot(pts[0] + MU, pts[1]) < 0.3);
  assert.ok(Math.hypot(pts[n - 2] - 1 + MU, pts[n - 1]) < 0.05);
  for (let i = 2; i < n; i += 2) assert.ok(Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]) < 0.05, `gap at point ${i / 2}`);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] >= times[i - 1], `time at point ${i}`);
});

test('a scene is computed in under 150 ms', async () => {
  // a fresh module instance, so that the cache of the scenes above is empty
  const fresh = await import(`../src/scenes.ts?fresh=${Date.now()}`);
  const t = performance.now();
  fresh.scene('nest');
  assert.ok(performance.now() - t < 150);
});
