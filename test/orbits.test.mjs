// checks of the orbit engine and the scenes, run with `npm test` under type stripping

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MU, lagrange, lyapunovFamily, spaced, toCrossing } from '../src/orbits.ts';
import { SCENE_NAMES, scene, seconds } from '../src/scenes.ts';

const H = 0.004;
// the smallest number of strands expected in each scene. the L2 family of nest is ended after 7 of
// its 12 members
const FEWEST = { nest: 24, dro: 9, l1: 26, l2: 20, lyapunovs: 32, mark: 1, tubes: 114, halo: 74, rosette: 13, hill: 15, transfer: 500, ribbon: 181, wideRibbon: 241, spiral: 4, lace: 82, torus: 5, sheaf: 36 };
// the scenes with strands that are not periodic orbits
const FLIGHTS = ['tubes', 'transfer', 'hill', 'ribbon', 'wideRibbon', 'spiral', 'lace', 'torus', 'sheaf'];

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

test('the transfer is the one strand of a spacecraft in the scenes, hence a manifold is drawn without a head', () => {
  for (const name of SCENE_NAMES) assert.equal(scene(name).filter((s) => s.craft).length, name === 'transfer' ? 1 : 0, name);
  assert.equal(scene('transfer').find((s) => s.craft).tone, 'hero');
});

test('the torus is traced in 18 s, and every other scene in the 12 s of the engine', () => {
  assert.deepEqual(SCENE_NAMES.filter((name) => seconds(name) !== undefined).map((name) => [name, seconds(name)]), [['torus', 18]]);
});

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

test('a ribbon runs from its orbit around the Earth, with its stable tube the mirror image', () => {
  for (const name of ['ribbon', 'wideRibbon']) {
    const strands = scene(name), [orbit] = strands, orange = strands.filter((s) => s.tone === 'orange');
    const left = (s) => { let x = Infinity; for (let i = 0; i < s.pts.length; i += 2) x = Math.min(x, s.pts[i]); return x; };
    assert.equal(orbit.tone, 'text');
    assert.equal(strands.filter((s) => s.tone === 'violet').length, orange.length);
    for (const s of orange) {
      assert.ok(Math.hypot(s.pts[0] - lagrange(1), s.pts[1]) < 0.1, `${name} starts near L1`);
      assert.ok(left(s) < -0.3, `${name} passes the far side of the Earth`);
    }
  }
});

test('the band of the spiral stays near the distance of the Moon, and the flight starts near the Earth', () => {
  const [band, ...flight] = scene('spiral'), start = flight[flight.length - 1];
  assert.equal(band.tone, 'line');
  for (let i = 0; i < band.pts.length; i += 2) {
    const r = Math.hypot(band.pts[i] + MU, band.pts[i + 1]);
    assert.ok(r > 0.75 && r < 1.3, `radius ${r}`);
  }
  assert.ok(Math.hypot(start.pts[0] + MU, start.pts[1]) < 0.1);
});

test('the transfer is one unbroken path from a perigee through the neck at L1 to a close pass of the Moon', () => {
  const { pts, times } = scene('transfer').find((s) => s.tone === 'hero'), n = pts.length;
  assert.ok(Math.hypot(pts[0] + MU, pts[1]) < 0.4);
  assert.ok(pts[0] < lagrange(1));
  let far = 0;
  for (let i = 0; i < n; i += 2) far = Math.max(far, pts[i]);
  assert.ok(far > lagrange(2), 'the path goes around the L2 orbit');
  // above the surface of the Moon, of radius 0.0045
  const r = Math.hypot(pts[n - 2] - 1 + MU, pts[n - 1]);
  assert.ok(r > 0.0045 && r < 0.01, `perilune ${r}`);
  for (let i = 2; i < n; i += 2) assert.ok(Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]) < 0.05, `gap at point ${i / 2}`);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] >= times[i - 1], `time at point ${i}`);
});

test('the manifolds of the transfer grow from the orbit after it is traced and end before the flight starts', () => {
  const strands = scene('transfer'), orbit = strands.find((s) => s.tone === 'text'), hero = strands.find((s) => s.tone === 'hero');
  const manifolds = strands.filter((s) => s.tone === 'orange' || s.tone === 'violet');
  assert.ok(manifolds.filter((s) => s.tone === 'orange').length >= 300 && manifolds.filter((s) => s.tone === 'violet').length >= 100);
  for (const s of manifolds) {
    assert.ok(s.times[0] >= orbit.T - 1e-5 && s.T <= hero.times[0] + 1e-5);
    let d = 9;
    for (let i = 0; i < orbit.pts.length; i += 2) d = Math.min(d, Math.hypot(s.pts[0] - orbit.pts[i], s.pts[1] - orbit.pts[i + 1]));
    assert.ok(d < 2e-3, `first point ${d} off the orbit`);
  }
});

test('the path of the spacecraft is the only strand of the transfer marked as a craft', () => {
  const strands = scene('transfer');
  for (const s of strands) assert.equal(s.craft === true, s.tone === 'hero');
});

test('a scene is computed in under 150 ms', async () => {
  // a fresh module instance, so that the cache of the scenes above is empty
  const fresh = await import(`../src/scenes.ts?fresh=${Date.now()}`);
  const t = performance.now();
  fresh.scene('nest');
  assert.ok(performance.now() - t < 150);
});
