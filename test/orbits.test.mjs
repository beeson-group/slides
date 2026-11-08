// checks of the orbit engine and the scenes, run with `npm test` under type stripping

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MU, lagrange, lyapunovFamily, pathOf, pointOn, spaced, toCrossing, trace } from '../src/orbits.ts';
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

// the points of an arc of radius r px about the origin, from 0 to the angle span in rad
const arc = (count, r, span) => Float32Array.from({ length: 2 * count }, (_, k) => {
  const a = (span * Math.floor(k / 2)) / (count - 1);
  return k % 2 ? r * Math.sin(a) : r * Math.cos(a);
});
const offCircle = (r, [x, y]) => Math.abs(Math.hypot(x, y) - r);

test('a strand of sparse points is drawn as a smooth curve through them, on the arc they sample', () => {
  // 13 points 30 deg apart on a circle of 200 px, whose chords are 6.8 px inside the circle at their middles
  for (const span of [Math.PI, 2 * Math.PI]) {
    const path = pathOf(arc(13, 200, span));
    assert.ok(path.ctl, 'the segments are curves');
    for (let j = 0; j < 12; j++) {
      assert.ok(!Number.isNaN(path.ctl[4 * j]), `segment ${j} is a curve`);
      assert.ok(offCircle(200, pointOn(path, j, 0)) < 1e-3, 'the curve passes through the points');
      // an end of an open arc is a little flatter than the circle
      assert.ok(offCircle(200, pointOn(path, j, 0.5)) < (span < 6 && (j === 0 || j === 11) ? 2 : 0.6), `segment ${j}`);
    }
  }
  // a closed strand turns smoothly at its first point, i.e. its first and last curves share the tangent there
  const { px, ctl } = pathOf(arc(13, 200, 2 * Math.PI));
  const out = [ctl[0] - px[0], ctl[1] - px[1]], into = [px[0] - ctl[46], px[1] - ctl[47]];
  assert.ok(Math.abs(out[0] * into[1] - out[1] * into[0]) / Math.hypot(...out) / Math.hypot(...into) < 1e-3);
  // a strand whose last point misses its first by 0.2 px is closed as well, hence its first curve
  // leaves the first point along the same tangent
  const gap = arc(13, 200, 2 * Math.PI);
  gap[24] += 0.2;
  const near = pathOf(gap).ctl;
  assert.ok(Math.hypot(near[0] - ctl[0], near[1] - ctl[1]) < 1e-3);
});

test('a strand of dense points is drawn straight, with the points within 0.1 px of a line left out', () => {
  const px = arc(2001, 200, Math.PI), path = pathOf(px);
  assert.equal(path.ctl, null);
  assert.ok(path.keep.length < 200, `${path.keep.length} of 2001 points kept`);
  assert.deepEqual([path.keep[0], path.keep.at(-1)], [0, 2000]);
  // every point is within 0.1 px of the segment between the kept points around it
  for (let m = 1; m < path.keep.length; m++) {
    const a = path.keep[m - 1], b = path.keep[m];
    const [ax, ay, bx, by] = [px[2 * a], px[2 * a + 1], px[2 * b], px[2 * b + 1]];
    for (let k = a + 1; k < b; k++) {
      const d = Math.abs((bx - ax) * (py(px, k) - ay) - (by - ay) * (px[2 * k] - ax)) / Math.hypot(bx - ax, by - ay);
      assert.ok(d <= 0.1 + 1e-4, `point ${k} is ${d} px off`);
    }
  }
});
const py = (px, k) => px[2 * k + 1];

// the calls of moveTo, lineTo, and bezierCurveTo made in trace(), and the point reached
function record(path, j, f) {
  const calls = [];
  const pen = { moveTo: (...a) => calls.push(['M', ...a]), lineTo: (...a) => calls.push(['L', ...a]), bezierCurveTo: (...a) => calls.push(['C', ...a]) };
  trace(pen, path, j, f);
  return { calls, end: calls.at(-1).slice(-2) };
}

test('a traced strand ends at its head, on a curve and on a straight run with its points left out', () => {
  for (const path of [pathOf(arc(13, 200, Math.PI)), pathOf(arc(2001, 200, Math.PI))]) {
    const n = path.px.length / 2;
    for (const [j, f] of [[0, 0.3], [5, 0.5], [n - 2, 0.9], [Math.floor(n / 2) + 1, 0.25]]) {
      const head = pointOn(path, j, f), { calls, end } = record(path, j, f);
      assert.ok(Math.hypot(end[0] - head[0], end[1] - head[1]) < 1e-3, `j = ${j}, f = ${f}`);
      assert.equal(calls.filter((c) => c[0] === 'M').length, 1, 'one path');
    }
    // a whole strand ends at its last point
    const { end } = record(path, n - 1, 0);
    assert.deepEqual(end, [path.px[2 * n - 2], path.px[2 * n - 1]]);
  }
  // the curve of a segment is cut at the head, and its part up to the head follows the curve
  const path = pathOf(arc(13, 200, Math.PI)), { calls } = record(path, 4, 0.6), cut = calls.at(-1);
  const [x0, y0] = pointOn(path, 4, 0), [x3, y3] = [cut[5], cut[6]];
  const bez = (t) => [0, 1].map((k) => (1 - t) ** 3 * [x0, y0][k] + 3 * (1 - t) ** 2 * t * cut[1 + k] + 3 * (1 - t) * t * t * cut[3 + k] + t ** 3 * [x3, y3][k]);
  for (const t of [0.25, 0.5, 0.75]) {
    const [x, y] = bez(t), [u, v] = pointOn(path, 4, 0.6 * t);
    assert.ok(Math.hypot(x - u, y - v) < 1e-3);
  }
});
