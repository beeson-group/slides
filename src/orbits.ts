// orbits of the CR3BP of the Earth–Moon system, computed with a short propagator and corrector and
// traced on two canvases of a `.backdrop` element. the engine is ported from orbits.ts of Claudio
// Vestini's website (MIT) and reduced to the families drawn on the slides. all quantities are
// nondimensional, in the rotating frame

import { builtIn } from './backdrops.ts';
import { colormapColor, fitView, load, mix, shadeOf, trajectoriesFor } from './trajectories.ts';
import type { Colormap, Dot, TrajectoryData } from './trajectories.ts';

export type Member = { s: Float64Array; path: number[]; times: number[]; t: number };
export type Tone = 'orange' | 'violet' | 'text' | 'hero' | 'line';
// pts is a list of alternating x and y values. times are the flight times of the points, and T is
// the last of them. color, when set, is a CSS color or a pair of them for the dark and the light
// mode in place of the color of the tone. alpha, when set, replaces the opacity of the tone. ink,
// when set, replaces the color of the tone with the color at the fraction at between the two
// colors of the pair of the palette --trajectory-1 to --trajectory-8 in theme/beeson.css, i.e. --trajectory-1
// and --trajectory-2 for pair 0, or with shade the shade at the fraction at of the first color of the
// pair, or with map the color at the fraction at between the ends of the colormap map. craft, when
// true, marks the path of a spacecraft, whose head is drawn without data-heads. a trajectory of a file
// may also set its weight, i.e. its width in line widths, the radius of its head in line widths in
// place of the size of its backdrop, a glow, a soft halo of its own color, and a fade, the seconds
// of its clock from its first point after which its opacity falls to zero at its last point, as the
// square of the time left, in FADE_BANDS bands of equal time
export type Trajectory = { pts: Float64Array; times: Float32Array; T: number; tone?: Tone; color?: string | [string, string]; alpha?: number; ink?: { pair: number; at: number; shade?: boolean; map?: Colormap }; craft?: boolean; weight?: number; head?: number; glow?: boolean; fade?: number };
const FADE_BANDS = 12;

// the opacity of trajectory s, and its width in line widths
const alphaOf = (s: Trajectory): number => s.alpha ?? (s.tone === 'orange' || s.tone === 'violet' ? 0.42 : s.tone === 'text' ? 0.8 : s.tone === 'line' ? 0.36 : 1);
const widthOf = (s: Trajectory): number => (s.tone === 'hero' ? 2.2 : s.tone === 'text' ? 1.3 : 1) * (s.weight ?? 1);

// a name for the color of trajectory s. two trajectories of one name are drawn in one color in either mode
const colorOf = (s: Trajectory): string => (s.color ? `color ${JSON.stringify(s.color)}` : s.ink ? `ink ${JSON.stringify(s.ink)}` : s.tone === 'orange' || s.tone === 'hero' ? 'accent' : s.tone === 'violet' ? 'violet' : s.tone === 'text' || s.tone === 'line' ? 'text' : 'stroke');

// the points of trajectory s at which the bands of its fade begin, i.e. the last point at or before the
// time of its fade and the last point before each later band, or null for a trajectory without a fade
function bandsOf(s: Trajectory): Uint32Array | null {
  const n = s.times.length, fadeAt = s.times[0] + (s.fade ?? Infinity), span = s.T - fadeAt;
  if (!(span > 0)) return null;
  const out = new Uint32Array(FADE_BANDS);
  let a = 0;
  while (a < n - 1 && s.times[a + 1] <= fadeAt) a++;
  out[0] = a;
  for (let b = 1; b < FADE_BANDS; b++) {
    const until = fadeAt + (b * span) / FADE_BANDS;
    while (a < n - 1 && s.times[a + 1] <= until) a++;
    out[b] = a;
  }
  return out;
}

export const MU = 0.01215;
// the distance to a body within which the step is shortened in step()
const NEAR = 0.15;
// seconds in which the longest flight of a backdrop is traced, unless the element sets its own in
// data-duration
const DURATION = 12;
// seconds per revolution of a looping mark
const LOOP = 9;
// the radii of the heads of a trace for each value of the attribute data-heads, in line widths.
// without data-heads, a head of full size is drawn on each trajectory of a spacecraft alone
const HEADS: Record<string, number> = { full: 2.2, small: 0.55, none: 0 };
// the number of colors of the palette of theme/beeson.css, in pairs
const PALETTE = 8;
// the distance in canvas pixels within which the path drawn for a trajectory follows its points. a
// segment whose smooth curve departs further from its chord is drawn as the curve, and a point
// closer than this to the line through its kept neighbors is left out of the path
const TOLERANCE = 0.1;

// writes the time derivative of the state s into a. returns the smaller of the distance to the Moon
// and 0.4 times the distance to the Earth, which is used in step() to shorten the step
export function accel(s: Float64Array, a: Float64Array): number {
  const x = s[0], y = s[1], z = s[2];
  const dx1 = x + MU, dx2 = x - 1 + MU;
  const r1 = Math.sqrt(dx1 * dx1 + y * y + z * z), r2 = Math.sqrt(dx2 * dx2 + y * y + z * z);
  const k1 = (1 - MU) / (r1 * r1 * r1), k2 = MU / (r2 * r2 * r2);
  a[0] = s[3]; a[1] = s[4]; a[2] = s[5];
  a[3] = 2 * s[4] + x - k1 * dx1 - k2 * dx2;
  a[4] = -2 * s[3] + y - k1 * y - k2 * y;
  a[5] = -k1 * z - k2 * z;
  return r2 < r1 ? r2 : r1 * 0.4;
}

const K1 = new Float64Array(6), K2 = new Float64Array(6), K3 = new Float64Array(6), K4 = new Float64Array(6);
const MID = new Float64Array(6);
// one RK4 step of s in place, of length h scaled down near either body, and returns the step taken
export function step(s: Float64Array, h: number): number {
  const near = accel(s, K1);
  const dt = h * Math.min(1, near / NEAR);
  for (let i = 0; i < 6; i++) MID[i] = s[i] + 0.5 * dt * K1[i];
  accel(MID, K2);
  for (let i = 0; i < 6; i++) MID[i] = s[i] + 0.5 * dt * K2[i];
  accel(MID, K3);
  for (let i = 0; i < 6; i++) MID[i] = s[i] + dt * K3[i];
  accel(MID, K4);
  for (let i = 0; i < 6; i++) s[i] += (dt / 6) * (K1[i] + 2 * K2[i] + 2 * K3[i] + K4[i]);
  return dt;
}

// integrates from s0 until the coordinate axis (y by default) changes sign for the count-th time
// after tmin, or until tmax. the crossing state is moved onto the plane to first order
export function toCrossing(s0: Float64Array, h: number, tmin: number, tmax: number, path?: number[], times?: number[], count = 1, axis = 1): { s: Float64Array; t: number; hit: boolean } {
  const s = Float64Array.from(s0);
  let t = 0;
  const record = () => {
    if (path) path.push(s[0], s[1], s[2]);
    if (times) times.push(t);
  };
  record();
  let prev = s[axis], left = count;
  for (let n = 0; n < 100000; n++) {
    t += step(s, h);
    if (t > tmin && (s[axis] === 0 || s[axis] > 0 !== prev > 0) && --left === 0) {
      const dtc = -s[axis] / s[axis + 3];
      const a = new Float64Array(6);
      accel(s, a);
      for (let i = 0; i < 6; i++) s[i] += dtc * a[i];
      t += dtc;
      record();
      return { s, t, hit: true };
    }
    prev = s[axis];
    record();
    if (t > tmax) return { s, t, hit: false };
  }
  return { s, t, hit: false };
}

// integrates from s0 for the time tmax, recording every point, and stops early when stop(s) holds
export function propagate(s0: Float64Array, h: number, tmax: number, path: number[], times: number[], stop?: (s: Float64Array) => boolean, t0 = 0): Float64Array {
  const s = Float64Array.from(s0);
  let t = 0;
  path.push(s[0], s[1], s[2]);
  times.push(t0);
  while (t < tmax) {
    t += step(s, h);
    path.push(s[0], s[1], s[2]);
    times.push(t0 + t);
    if (stop && stop(s)) break;
  }
  return s;
}

// Newton correction of a symmetric orbit. the entries free of s0 are adjusted until the entries
// target of the state at the crossing vanish within 1e-6. returns null when a crossing is not found
// or a Newton step is larger than 0.1, which is the symptom of a singular Jacobian
export function correct(s0: Float64Array, free: number[], target: number[], h: number, tmin: number, tmax: number, iters: number, count = 1, axis = 1): Member | null {
  const s = Float64Array.from(s0);
  let path: number[] = [], times: number[] = [];
  for (let it = 0; it < iters; it++) {
    path = []; times = [];
    const base = toCrossing(s, h, tmin, tmax, path, times, count, axis);
    if (!base.hit) return null;
    const f = target.map((i) => base.s[i]);
    if (f.every((v) => Math.abs(v) < 1e-6)) return { s, path, times, t: base.t };
    const J: number[][] = [];
    for (let j = 0; j < free.length; j++) {
      const d = 1e-6;
      const sp = Float64Array.from(s);
      sp[free[j]] += d;
      const r = toCrossing(sp, h, tmin, tmax, undefined, undefined, count, axis);
      if (!r.hit) return null;
      J.push(target.map((i, k) => (r.s[i] - f[k]) / d));
    }
    const dx: number[] = [];
    if (free.length === 1) dx.push(f[0] / J[0][0]);
    else {
      const a = J[0][0], b = J[1][0], c = J[0][1], d = J[1][1], det = a * d - b * c;
      dx.push((d * f[0] - b * f[1]) / det, (-c * f[0] + a * f[1]) / det);
    }
    if (!dx.every((v) => Math.abs(v) < 0.1)) return null;
    for (let j = 0; j < free.length; j++) s[free[j]] -= dx[j];
  }
  path = []; times = [];
  const r = toCrossing(s, h, tmin, tmax, path, times, count, axis);
  return r.hit ? { s, path, times, t: r.t } : null;
}

// a family continued over the values of the state entry p. each member is seeded with a linear
// extrapolation from the two previous ones, or with guess(v) when the correction from this
// extrapolation fails. a member with a jump of more than a third in its half period is off the
// branch, and the family is ended there. the first skip members are the ramp from the seed and are
// left out
export function family(guess: (v: number) => Float64Array, p: number, values: number[], free: number[], target: number[], h: number, tmin: (v: number) => number, tmax: (v: number) => number, skip: number, count = 1, axis = 1): Member[] {
  const out: Member[] = [];
  let prev: Member | null = null, prev2: Member | null = null;
  const accept = (r: Member | null) => (r && (!prev || Math.abs(r.t - prev.t) < prev.t / 3) ? r : null);
  for (const v of values) {
    let r: Member | null = null;
    if (prev && prev2) {
      const s0 = Float64Array.from(prev.s);
      s0[p] = v;
      for (const i of free) s0[i] = prev.s[i] + ((prev.s[i] - prev2.s[i]) / (prev.s[p] - prev2.s[p])) * (v - prev.s[p]);
      r = accept(correct(s0, free, target, h, tmin(v), tmax(v), 6, count, axis));
    }
    if (!r) r = accept(correct(guess(v), free, target, h, tmin(v), tmax(v), 8, count, axis));
    if (!r) break;
    out.push(r);
    prev2 = prev;
    prev = r;
  }
  return out.slice(skip);
}

// a geometric ramp from a up to b
export function ramp(a: number, b: number, factor: number): number[] {
  const out: number[] = [];
  for (let x = a; x < b; x *= factor) out.push(x);
  return out;
}

// count values from a to b, crowded toward a with the exponent p
export function spaced(a: number, b: number, count: number, p: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(a + (b - a) * Math.pow(i / (count - 1), p));
  return out;
}

// x of the collinear point L1, L2, or L3 at the mass ratio mu, by Newton on the force balance along
// the x axis, from the leading terms of the series of each point in mu
export function lagrange(n: 1 | 2 | 3, mu = MU): number {
  let x = n === 1 ? 1 - mu - Math.cbrt(mu / 3) : n === 2 ? 1 - mu + Math.cbrt(mu / 3) : -1 - (5 * mu) / 12;
  for (let i = 0; i < 30; i++) {
    const d1 = x + mu, d2 = x - 1 + mu;
    const f = x - ((1 - mu) * Math.sign(d1)) / (d1 * d1) - (mu * Math.sign(d2)) / (d2 * d2);
    const df = 1 + (2 * (1 - mu)) / Math.abs(d1 * d1 * d1) + (2 * mu) / Math.abs(d2 * d2 * d2);
    x -= f / df;
  }
  return x;
}

// the Lyapunov family at L1 or L2 over the amplitudes given, outward from the Moon. the seed is the
// linearized in-plane motion at the point
export function lyapunovFamily(n: 1 | 2, amplitudes: number[], h: number, start = 0.003): Member[] {
  const xL = lagrange(n);
  const d1 = Math.abs(xL + MU), d2 = Math.abs(xL - 1 + MU);
  const c2 = (1 - MU) / (d1 * d1 * d1) + MU / (d2 * d2 * d2);
  const w2 = (2 - c2 + Math.sqrt(9 * c2 * c2 - 8 * c2)) / 2;
  const guess = (x0: number) => {
    const s = new Float64Array(6);
    s[0] = x0;
    s[4] = ((xL - x0) * (w2 + 1 + 2 * c2)) / 2;
    return s;
  };
  const sign = n === 1 ? -1 : 1;
  const lead = ramp(start, amplitudes[0], 1.2);
  const values = lead.concat(amplitudes).map((A) => xL + sign * A);
  return family(guess, 0, values, [4], [3], h, () => 0.3, () => 6, lead.length);
}

// the distant retrograde orbits over the distances given of the crossing on the Earth side of the
// Moon. the seed is the Keplerian speed in the rotating frame
export function droFamily(distances: number[], h: number): Member[] {
  const guess = (x0: number) => {
    const d = 1 - MU - x0;
    const s = new Float64Array(6);
    s[0] = x0;
    s[4] = Math.sqrt(MU / d) + d;
    return s;
  };
  const tmin = (x0: number) => {
    const d = 1 - MU - x0;
    return (0.4 * Math.PI) / (Math.sqrt(MU / (d * d * d)) + 1);
  };
  const lead = ramp(0.02, distances[0], 1.12);
  const values = lead.concat(distances).map((d) => 1 - MU - d);
  return family(guess, 0, values, [4], [3], h, tmin, (x0) => 10 * tmin(x0), lead.length);
}

// the whole orbit from its half, mirrored in the x axis
export function closed(m: Member): Trajectory {
  const n = m.times.length, T = m.t, N = 2 * n - 1;
  const pts = new Float64Array(2 * N), tt = new Float32Array(N);
  for (let i = 0; i < n; i++) {
    pts[2 * i] = m.path[3 * i]; pts[2 * i + 1] = m.path[3 * i + 1]; tt[i] = m.times[i];
  }
  let k = n;
  for (let i = n - 2; i >= 0; i--, k++) {
    pts[2 * k] = m.path[3 * i]; pts[2 * k + 1] = -m.path[3 * i + 1]; tt[k] = 2 * T - m.times[i];
  }
  return { pts, times: tt, T: 2 * T };
}

// a trajectory from a recorded flight of x, y, z triples
export function open(path: number[], times: number[]): Trajectory {
  const n = times.length, pts = new Float64Array(2 * n);
  for (let i = 0; i < n; i++) {
    pts[2 * i] = path[3 * i]; pts[2 * i + 1] = path[3 * i + 1];
  }
  return { pts, times: Float32Array.from(times), T: times[n - 1] };
}

// a trajectory as drawn on a canvas. px holds its points in canvas pixels, keep the indices of the
// points of its path in increasing order, and ctl four numbers per segment, the two inner control
// points of the cubic Bézier curve of the segment, or NaN for a segment drawn straight. ctl is null
// when every segment is drawn straight
export type Path = { px: Float32Array; keep: Uint32Array; ctl: Float32Array | null };

type Pen = Pick<CanvasRenderingContext2D, 'moveTo' | 'lineTo' | 'bezierCurveTo'>;

const curved = (ctl: Float32Array | null, j: number): ctl is Float32Array => ctl !== null && !Number.isNaN(ctl[4 * j]);

// the path of the points px, in canvas pixels. a segment is drawn as the curve of the centripetal
// Catmull–Rom spline through the points of [Yuksel et al. 2011](https://doi.org/10.1016/j.cad.2010.08.008)
// where this curve departs from the chord by more than tolerance, i.e. where the points are too
// sparse for the turn of the trajectory. on a closed trajectory, whose last point is within half a pixel
// of its first, the spline is continued across this point. the points of the straight runs are
// thinned by Douglas–Peucker within tolerance
export function pathOf(px: Float32Array, tolerance = TOLERANCE): Path {
  const n = px.length / 2;
  const closed = n > 3 && Math.hypot(px[0] - px[2 * n - 2], px[1] - px[2 * n - 1]) < 0.5;
  const mark = new Uint8Array(n);
  mark[0] = mark[n - 1] = 1;
  let ctl: Float32Array | null = null;
  for (let j = 0; j < n - 1; j++) {
    const x1 = px[2 * j], y1 = px[2 * j + 1], x2 = px[2 * j + 2], y2 = px[2 * j + 3];
    // the neighbors of the segment, the points across the joint on a closed trajectory, or the
    // reflections of the far end at an end of an open one
    let x0 = 2 * x1 - x2, y0 = 2 * y1 - y2, x3 = 2 * x2 - x1, y3 = 2 * y2 - y1;
    if (j > 0) { x0 = px[2 * j - 2]; y0 = px[2 * j - 1]; } else if (closed) { x0 = px[2 * n - 4]; y0 = px[2 * n - 3]; }
    if (j < n - 2) { x3 = px[2 * j + 4]; y3 = px[2 * j + 5]; } else if (closed) { x3 = px[2]; y3 = px[3]; }
    const d1 = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2), d2 = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2), d3 = Math.sqrt((x3 - x2) ** 2 + (y3 - y2) ** 2);
    if (!(d1 > 1e-6 && d2 > 1e-6 && d3 > 1e-6)) continue;
    // with the exponent 1/2 of the centripetal spline, d^(2a) is d and d^a is s
    const s1 = Math.sqrt(d1), s2 = Math.sqrt(d2), s3 = Math.sqrt(d3);
    const a = 2 * d1 + 3 * s1 * s2 + d2, b = 3 * s1 * (s1 + s2);
    const e = 2 * d3 + 3 * s3 * s2 + d2, g = 3 * s3 * (s3 + s2);
    const c1x = (d1 * x2 - d2 * x0 + a * x1) / b, c1y = (d1 * y2 - d2 * y0 + a * y1) / b;
    const c2x = (d3 * x1 - d2 * x3 + e * x2) / g, c2y = (d3 * y1 - d2 * y3 + e * y2) / g;
    // a cubic stays within 3/4 of the larger distance of its inner control points from its chord
    const off = Math.max(Math.abs((c1x - x1) * (y2 - y1) - (c1y - y1) * (x2 - x1)), Math.abs((c2x - x1) * (y2 - y1) - (c2y - y1) * (x2 - x1))) / d2;
    if (0.75 * off <= tolerance) continue;
    if (!ctl) ctl = new Float32Array(4 * (n - 1)).fill(NaN);
    ctl.set([c1x, c1y, c2x, c2y], 4 * j);
    mark[j] = mark[j + 1] = 1;
  }
  // between two marked points the segments are straight
  const stack: number[] = [];
  for (let a = 0, b = 1; b < n; b++) {
    if (!mark[b]) continue;
    if (b > a + 1) stack.push(a, b);
    a = b;
  }
  const t2 = tolerance * tolerance;
  while (stack.length) {
    const b = stack.pop() as number, a = stack.pop() as number;
    const ax = px[2 * a], ay = px[2 * a + 1], dx = px[2 * b] - ax, dy = px[2 * b + 1] - ay, L = dx * dx + dy * dy;
    let worst = t2, at = -1;
    for (let k = a + 1; k < b; k++) {
      const qx = px[2 * k] - ax, qy = px[2 * k + 1] - ay;
      const u = L > 0 ? Math.min(1, Math.max(0, (qx * dx + qy * dy) / L)) : 0;
      const d = (qx - u * dx) ** 2 + (qy - u * dy) ** 2;
      if (d > worst) { worst = d; at = k; }
    }
    if (at < 0) continue;
    mark[at] = 1;
    if (at > a + 1) stack.push(a, at);
    if (b > at + 1) stack.push(at, b);
  }
  let count = 0;
  for (let k = 0; k < n; k++) count += mark[k];
  const keep = new Uint32Array(count);
  for (let k = 0, m = 0; k < n; k++) if (mark[k]) keep[m++] = k;
  return { px, keep, ctl };
}

// the point at the fraction f of the segment of path from its point j to j + 1
export function pointOn(path: Path, j: number, f: number): [number, number] {
  const p = path.px, n = p.length / 2;
  if (j >= n - 1) return [p[2 * n - 2], p[2 * n - 1]];
  const x1 = p[2 * j], y1 = p[2 * j + 1], x2 = p[2 * j + 2], y2 = p[2 * j + 3];
  if (!curved(path.ctl, j)) return [x1 + f * (x2 - x1), y1 + f * (y2 - y1)];
  const c = path.ctl, k = 4 * j, g = 1 - f;
  const w0 = g * g * g, w1 = 3 * g * g * f, w2 = 3 * g * f * f, w3 = f * f * f;
  return [w0 * x1 + w1 * c[k] + w2 * c[k + 2] + w3 * x2, w0 * y1 + w1 * c[k + 1] + w2 * c[k + 3] + w3 * y2];
}

// adds to pen the path of a trajectory from its point from, its first by default, to the fraction f of
// its segment from point j to j + 1, i.e. to the head of its trace, and to its last point with j its
// last index. a point from left out of keep is on a straight run, whose segments are not curved
export function trace(pen: Pen, path: Path, j: number, f: number, from = 0): void {
  const { px: p, keep, ctl } = path, n = p.length / 2;
  pen.moveTo(p[2 * from], p[2 * from + 1]);
  let last = from, lo = 0, hi = keep.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (keep[mid] <= from) lo = mid + 1;
    else hi = mid;
  }
  for (let k = lo; k < keep.length && keep[k] <= j; k++) {
    const v = keep[k];
    if (v === last + 1 && curved(ctl, last)) pen.bezierCurveTo(ctl[4 * last], ctl[4 * last + 1], ctl[4 * last + 2], ctl[4 * last + 3], p[2 * v], p[2 * v + 1]);
    else pen.lineTo(p[2 * v], p[2 * v + 1]);
    last = v;
  }
  if (j >= n - 1 || !(f > 0)) return;
  if (last === j && curved(ctl, j)) {
    // the part of the curve up to f, by de Casteljau
    const x1 = p[2 * j], y1 = p[2 * j + 1], k = 4 * j;
    const ax = x1 + f * (ctl[k] - x1), ay = y1 + f * (ctl[k + 1] - y1);
    const mx = ctl[k] + f * (ctl[k + 2] - ctl[k]), my = ctl[k + 1] + f * (ctl[k + 3] - ctl[k + 1]);
    const [ex, ey] = pointOn(path, j, f);
    pen.bezierCurveTo(ax, ay, ax + f * (mx - ax), ay + f * (my - ay), ex, ey);
  } else {
    const [x, y] = pointOn(path, j, f);
    pen.lineTo(x, y);
  }
}

export const POINTS = {
  L1: (): [number, number] => [lagrange(1), 0],
  L2: (): [number, number] => [lagrange(2), 0],
  moon: (): [number, number] => [1 - MU, 0],
  earth: (): [number, number] => [-MU, 0],
};
type Point = keyof typeof POINTS;
const isPoint = (v: string | undefined): v is Point => v !== undefined && v in POINTS;

// the colors of the theme in the mode of the deck, and whether the mode is light
type Colors = { stroke: string; body: string; accent: string; violet: string; text: string; light: boolean };

const CACHE = new WeakMap<HTMLElement, Orbits>();

// one drawing per `.backdrop` element. the trajectories are drawn on the base canvas, and the heads and
// the pointer glow on the head canvas
export class Orbits {
  readonly el: HTMLElement;
  private trajectories: Trajectory[];
  private cx: number;
  private cy: number;
  private half: number;
  private loop: boolean;
  private base: HTMLCanvasElement;
  private head: HTMLCanvasElement;
  private labels: HTMLElement[];
  private Tmax: number;
  private idx: number[];
  private t0: number | null = null;
  private raf = 0;
  private finished = false;
  private W = 0;
  private H = 0;
  private scale = 1;
  private lw = 1;
  private paths: Path[] = [];
  // the scale and window for which the paths were last computed
  private pathsFor = '';
  // the pointer in canvas pixels, and the glow radius there
  private pointer: { x: number; y: number; r: number } | null = null;
  // the bodies of a file of polylines, drawn in place of the Moon and the Earth, or null
  private dots: Dot[] | null;
  // true when the window is fitted to the trajectories of a file, i.e. without data-half
  private fitted: boolean;
  // the box and the slide for which the window was last fitted, in slide pixels
  private fittedFor = '';
  private loaded: boolean;
  // true when start() was called before the trajectories of a file were loaded
  private pending = false;
  private headSize: number;
  // seconds in which the longest trajectory is traced
  readonly duration: number;
  // seconds between the starts of two trajectories one after the other, from data-stagger
  private stagger: number;
  // true when a head is drawn on every trajectory, and false when on the trajectories of a spacecraft alone
  private everyHead: boolean;
  // the colors of the trajectories with an ink, resolved in redraw() for the current mode
  private inks: string[] = [];
  // copies of the canvases and of the trail, traced in the colors of the old mode during a flip, or
  // null
  private ghosted: { base: HTMLCanvasElement; head: HTMLCanvasElement; trail: HTMLCanvasElement | null; c: Colors; inks: string[] } | null = null;
  // during a trace, the trajectories before the index cached are drawn on the trail a piece per frame, and
  // the others are stroked whole at every frame, see order()
  private cached = 0;
  // the point of each trajectory before cached up to which it is drawn on the trail, a point of its path
  private upTo: number[] = [];
  // the first points of the bands of the fade of each trajectory, from bandsOf()
  private bands: (Uint32Array | null)[] = [];
  // a canvas outside the page with the bodies and the trajectories before cached up to upTo, copied onto
  // the base canvas at every frame of a trace, or null outside a trace
  private trail: HTMLCanvasElement | null = null;
  // resolved when the trajectories are in place, at once for a built-in backdrop and after the load of a file
  readonly ready: Promise<void>;
  // the trajectories of the file once it is loaded, which the editor reads to tell two selections apart
  fileTrajectories: TrajectoryData[] | null = null;

  static of(el: HTMLElement): Orbits | undefined {
    return CACHE.get(el);
  }

  static reduced(): boolean {
    if (typeof window === 'undefined') return true;
    const q = location.search;
    return matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.hasAttribute('data-still') || /[?&]still\b/.test(q) || /print-pdf/.test(q);
  }

  constructor(el: HTMLElement) {
    this.el = el;
    const file = el.dataset.trajectories !== undefined;
    this.trajectories = file ? [] : builtIn(el.dataset.backdrop ?? '');
    this.dots = file ? [] : null;
    this.loaded = !file;
    this.fitted = file && el.dataset.half === undefined;
    this.headSize = HEADS[el.dataset.heads ?? 'full'] ?? HEADS.full;
    this.everyHead = el.dataset.heads !== undefined;
    const given = Number(el.dataset.duration);
    this.duration = given > 0 ? given : DURATION;
    this.stagger = Math.max(0, Number(el.dataset.stagger) || 0);
    this.cx = +(el.dataset.cx ?? 0);
    this.cy = +(el.dataset.cy ?? 0);
    this.half = +(el.dataset.half ?? 0.5);
    this.loop = el.hasAttribute('data-loop');
    // canvases cloned with a slide are blank, and a page per fragment is cloned in the print view
    // of reveal.js
    for (const old of el.querySelectorAll(':scope > canvas.orbits-base, :scope > canvas.orbits-head')) old.remove();
    this.base = document.createElement('canvas');
    this.head = document.createElement('canvas');
    this.base.className = 'orbits-base';
    this.head.className = 'orbits-head';
    for (const c of [this.base, this.head]) c.setAttribute('aria-hidden', 'true');
    el.prepend(this.head);
    el.prepend(this.base);
    this.labels = [...el.querySelectorAll<HTMLElement>('.label')];
    this.Tmax = Math.max(...this.trajectories.map((s) => s.T));
    this.idx = this.trajectories.map(() => 0);
    this.order();
    CACHE.set(el, this);
    this.fit();
    this.ready = file
      ? Promise.all([trajectoriesFor(el), load(el.dataset.trajectories ?? '')]).then(([{ trajectories, dots }, f]) => {
          this.fileTrajectories = f?.families ?? null;
          this.install(trajectories, dots);
        })
      : Promise.resolve();
  }

  private install(trajectories: Trajectory[], dots: Dot[]): void {
    this.trajectories = trajectories;
    this.dots = dots;
    this.Tmax = Math.max(...trajectories.map((s) => s.T));
    this.idx = trajectories.map(() => 0);
    this.order();
    this.loaded = true;
    this.fittedFor = '';
    this.pathsFor = '';
    this.fit();
    if (this.pending) {
      this.pending = false;
      this.start();
    }
  }

  // sets cached, the number of trajectories at the start of the order of the trajectories that are drawn in
  // pieces during a trace. a trajectory is drawn in pieces where the seams of the pieces are too faint to
  // be seen, i.e. it is a hairline without a glow at an opacity of 0.5 or less, and where the pieces
  // keep the order of the trajectories, i.e. every earlier trajectory of another color is traced before it
  // begins. two strokes of one color give the same pixels in either order
  private order(): void {
    const ends = new Map<string, number>();
    const seconds = (i: number, t: number) => (t / this.Tmax) * this.duration + i * this.stagger;
    let k = 0;
    for (; k < this.trajectories.length; k++) {
      const s = this.trajectories[k], color = colorOf(s), begin = seconds(k, s.times[0]);
      if (s.glow || alphaOf(s) > 0.5 || widthOf(s) > 1) break;
      if ([...ends].some(([other, end]) => other !== color && end > begin)) break;
      ends.set(color, Math.max(ends.get(color) ?? -Infinity, seconds(k, s.times[s.times.length - 1])));
    }
    this.cached = k;
    this.upTo = this.trajectories.map(() => 0);
    this.bands = this.trajectories.map(bandsOf);
    this.trail = null;
  }

  // the last point of the path of trajectory i at or before its point j
  private lastKept(i: number, j: number): number {
    const keep = this.paths[i].keep;
    let lo = 0, hi = keep.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (keep[mid] <= j) lo = mid;
      else hi = mid - 1;
    }
    return keep[lo];
  }

  // the window in the units of the trajectories: its center and its half height
  get view(): { cx: number; cy: number; half: number } {
    return { cx: this.cx, cy: this.cy, half: this.half };
  }

  get done(): boolean {
    return this.finished || this.loop;
  }

  // true while the backdrop is drawn again at every frame of the screen, i.e. during a trace or a
  // loop
  get tracing(): boolean {
    return this.raf !== 0;
  }

  get canvases(): HTMLCanvasElement[] {
    return [this.base, this.head];
  }

  // copies the canvases into the element into, whose client box is at origin, over the boxes of the
  // canvases. until unghost() is called, the trace is continued on the copies in the colors of the
  // mode at the call, while the canvases are redrawn in the next mode
  ghost(into: HTMLElement, origin: { left: number; top: number }): void {
    this.unghost();
    if (!this.W) return;
    const r = this.el.getBoundingClientRect();
    const [base, head] = this.canvases.map((from) => {
      const to = document.createElement('canvas');
      to.width = this.W;
      to.height = this.H;
      Object.assign(to.style, { position: 'absolute', left: `${r.left - origin.left}px`, top: `${r.top - origin.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      to.getContext('2d')?.drawImage(from, 0, 0);
      into.append(to);
      return to;
    });
    let trail: HTMLCanvasElement | null = null;
    if (this.trail) {
      trail = document.createElement('canvas');
      trail.width = this.W;
      trail.height = this.H;
      trail.getContext('2d')?.drawImage(this.trail, 0, 0);
    }
    this.ghosted = { base, head, trail, c: this.colors(), inks: [...this.inks] };
  }

  unghost(): void {
    this.ghosted?.base.remove();
    this.ghosted?.head.remove();
    this.ghosted = null;
  }

  private colors(): Colors {
    const cs = getComputedStyle(this.el);
    return { stroke: cs.getPropertyValue('--stroke').trim(), body: cs.getPropertyValue('--body').trim(), accent: cs.getPropertyValue('--accent').trim(), violet: cs.getPropertyValue('--violet').trim(), text: cs.getPropertyValue('--text').trim(), light: this.el.ownerDocument.documentElement.dataset.theme === 'light' };
  }

  // the colors of the trajectories with an ink in the current mode. a color of the palette is serialized
  // by the canvas as #rrggbb or rgba(), which mix() reads, and a trajectory is given the stroke color
  // when its colors are missing or of another form
  private paint(ctx: CanvasRenderingContext2D, c: Colors): void {
    if (!this.trajectories.some((s) => s.ink)) { this.inks = []; return; }
    const cs = getComputedStyle(this.el);
    const color = (name: string) => {
      const value = cs.getPropertyValue(name).trim();
      if (!value) return '';
      ctx.fillStyle = '#000000';
      ctx.fillStyle = value;
      return String(ctx.fillStyle);
    };
    const palette = Array.from({ length: PALETTE }, (_, i) => color(`--trajectory-${i + 1}`));
    // the shades and the ends of a colormap keep their contrast against the background of the slide
    const bg = color('--bg') || undefined;
    this.inks = this.trajectories.map((s) => {
      if (!s.ink) return '';
      if (s.ink.map) return colormapColor(s.ink.map, s.ink.at, bg);
      const k = (2 * s.ink.pair) % PALETTE;
      return (s.ink.shade ? shadeOf(palette[k], s.ink.at, bg) : mix(palette[k], palette[k + 1], s.ink.at)) ?? c.stroke;
    });
  }

  private X(x: number): number {
    return (x - this.cx) * this.scale + this.W / 2;
  }

  private Y(y: number): number {
    return -(y - this.cy) * this.scale + this.H / 2;
  }

  fit(): void {
    // the slide is scaled with a transform in reveal.js, hence the canvas is sized from the screen
    // rectangle and the labels are placed in the pixels of the slide
    const r = this.el.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    if (r.width === 0 || r.height === 0 || w === 0 || h === 0) return;
    this.unghost();
    if (this.fitted && this.trajectories.length) {
      const section = this.el.closest('section');
      const box = { left: this.el.offsetLeft, top: this.el.offsetTop, width: w, height: h };
      const slide = { width: section?.offsetWidth || w, height: section?.offsetHeight || h };
      const key = [box.left, box.top, w, h, slide.width, slide.height].join();
      if (key !== this.fittedFor) {
        const view = fitView(this.trajectories, box, slide);
        if (view) ({ cx: this.cx, cy: this.cy, half: this.half } = view);
        this.fittedFor = key;
      }
    }
    this.W = Math.max(1, Math.round(r.width * dpr));
    this.H = Math.max(1, Math.round(r.height * dpr));
    for (const c of [this.base, this.head]) { c.width = this.W; c.height = this.H; }
    this.scale = this.H / 2 / this.half;
    this.lw = Math.max(1, 0.7 * dpr * (r.height / h));
    const key = [this.W, this.H, this.cx, this.cy, this.half].join();
    if (key !== this.pathsFor) {
      this.paths = this.trajectories.map((s) => {
        const n = s.times.length, out = new Float32Array(2 * n);
        for (let i = 0; i < n; i++) { out[2 * i] = this.X(s.pts[2 * i]); out[2 * i + 1] = this.Y(s.pts[2 * i + 1]); }
        return pathOf(out);
      });
      this.pathsFor = key;
      this.upTo = this.upTo.map((j, i) => this.lastKept(i, j));
    }
    const k = h / 2 / this.half;
    for (const lab of this.labels) {
      const at = lab.dataset.at;
      if (!isPoint(at)) continue;
      const [x, y] = POINTS[at]();
      lab.style.left = `${w / 2 + (x - this.cx) * k + (+(lab.dataset.dx ?? 0) || 0)}px`;
      lab.style.top = `${h / 2 - (y - this.cy) * k + (+(lab.dataset.dy ?? 0) || 0)}px`;
    }
    this.pointer = null;
    this.redraw();
  }

  private bodies(ctx: CanvasRenderingContext2D, c: Colors): void {
    const shown = (name: string) => this.labels.some((l) => l.dataset.at === name);
    ctx.fillStyle = c.body;
    if (this.dots) {
      // a radius of 5 line widths for the Earth and of about 2.6 for the Moon, as below
      for (const d of this.dots) {
        const X = this.X(d.x), Y = this.Y(d.y);
        if (X < -10 || X > this.W + 10 || Y < -10 || Y > this.H + 10) continue;
        ctx.beginPath(); ctx.arc(X, Y, (2.2 + 2.8 * Math.cbrt(d.mass ?? 0.1)) * this.lw, 0, 2 * Math.PI); ctx.fill();
      }
      return;
    }
    for (const name of ['moon', 'earth'] as const) {
      if (name === 'earth' && !shown(name)) continue;
      const [x, y] = POINTS[name]();
      const X = this.X(x), Y = this.Y(y);
      if (X < -10 || X > this.W + 10 || Y < -10 || Y > this.H + 10) continue;
      ctx.beginPath(); ctx.arc(X, Y, (name === 'moon' ? 2.6 : 5) * this.lw, 0, 2 * Math.PI); ctx.fill();
    }
    for (const name of ['L1', 'L2'] as const) {
      if (!shown(name)) continue;
      const [x, y] = POINTS[name]();
      ctx.beginPath(); ctx.arc(this.X(x), this.Y(y), 1.6 * this.lw, 0, 2 * Math.PI); ctx.fill();
    }
  }

  // the color, opacity, width, and glow of trajectory i: those of its tone, then its own ink, alpha,
  // weight, and glow where it has them
  private pen(ctx: CanvasRenderingContext2D, c: Colors, i: number, inks = this.inks): void {
    const s = this.trajectories[i], tone = s.tone;
    ctx.strokeStyle = s.color ? (typeof s.color === 'string' ? s.color : s.color[c.light ? 1 : 0]) : s.ink ? inks[i] : tone === 'orange' || tone === 'hero' ? c.accent : tone === 'violet' ? c.violet : tone === 'text' || tone === 'line' ? c.text : c.stroke;
    ctx.globalAlpha = alphaOf(s);
    ctx.lineWidth = widthOf(s) * this.lw;
    ctx.lineJoin = 'round';
    ctx.shadowBlur = s.glow ? 6 * this.lw : 0;
    if (s.glow) ctx.shadowColor = ctx.strokeStyle;
  }

  // strokes trajectory i from its point from, its first by default, up to the fraction f of its segment
  // from point j to j + 1. up to its fade, the trajectory is stroked in one path, since two strokes of one
  // trajectory at an opacity below 1 overlap or leave a gap at their joint. beyond its fade, it is stroked
  // in bands of equal time, which begin and end at its points, at an opacity that falls to zero at its
  // last point. a stroke from a later point draws the pixels of the same bands beyond this point
  private stroke(ctx: CanvasRenderingContext2D, i: number, j: number, f: number, from = 0): void {
    const path = this.paths[i], ends = this.bands[i];
    const part = (a: number, b: number, g: number) => {
      if (b < from || (b === from && !(g > 0))) return;
      ctx.beginPath();
      trace(ctx, path, b, g, Math.max(a, from));
      ctx.stroke();
    };
    let a = ends ? Math.min(ends[0], j) : j;
    if (!ends || a === j) return part(0, j, f);
    if (a > 0) part(0, a, 0);
    const base = ctx.globalAlpha;
    for (let b = 0; b < FADE_BANDS && a < j; b++) {
      const c = b === FADE_BANDS - 1 ? j : Math.min(ends[b + 1], j);
      if (c > a) {
        ctx.globalAlpha = base * (1 - (b + 0.5) / FADE_BANDS) ** 2;
        part(a, c, c === j ? f : 0);
      }
      a = c;
    }
    ctx.globalAlpha = base;
  }

  // the last point drawn of trajectory i
  private drawn(i: number): number {
    return this.done ? this.trajectories[i].times.length - 1 : this.idx[i];
  }

  // true between the start and the end of a trace that is not a loop
  private get midTrace(): boolean {
    return !this.loop && this.t0 !== null && !this.finished;
  }

  // the fraction of the segment of trajectory i from point j to j + 1 reached at the flight time tau
  private fraction(i: number, j: number, tau: number): number {
    const t = this.trajectories[i].times, dt = t[j + 1] - t[j];
    return dt > 0 ? Math.min(1, Math.max(0, (tau - t[j]) / dt)) : 1;
  }

  // draws the bodies and the trajectories on the base canvas for the current mode
  redraw(): void {
    if (!this.W) return;
    const ctx = this.base.getContext('2d');
    if (!ctx) return;
    const c = this.colors(), now = performance.now();
    this.paint(ctx, c);
    this.trail = null;
    this.draw(ctx, c, now, this.inks, this.midTrace ? this.trailOf(c) : null);
    this.paintHead(now, c);
  }

  // draws the bodies and every trajectory, a finished trajectory whole and a trajectory in its trace up to its
  // head at the time now. the trajectories are stroked in the order of their file or built-in backdrop at every
  // frame, the order of the still, hence the last frame of a trace is its still apart from the heads.
  // with a trail, the trail is copied in place of the bodies, and each trajectory before cached is
  // stroked from its point of upTo on
  private draw(ctx: CanvasRenderingContext2D, c: Colors, now: number, inks = this.inks, trail: HTMLCanvasElement | null = null): void {
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.clearRect(0, 0, this.W, this.H);
    if (trail) ctx.drawImage(trail, 0, 0);
    else this.bodies(ctx, c);
    const tracing = this.midTrace;
    this.trajectories.forEach((s, i) => {
      const n = s.times.length, j = this.drawn(i), from = trail && i < this.cached ? this.upTo[i] : 0;
      if (from > 0 && from >= n - 1) return;
      if (j < n - 1) {
        const tau = this.clock(i, now);
        if (!tracing || !(tau > s.times[0])) return;
        this.pen(ctx, c, i, inks);
        this.stroke(ctx, i, j, this.fraction(i, j, tau), from);
        return;
      }
      this.pen(ctx, c, i, inks);
      this.stroke(ctx, i, n - 1, 0, from);
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  // the trail of the trace, laid with the bodies and the trajectories before cached up to upTo when it
  // is missing, or null without a trajectory before cached
  private trailOf(c: Colors): HTMLCanvasElement | null {
    if (!this.cached) return null;
    if (!this.trail) {
      const trail = document.createElement('canvas');
      trail.width = this.W;
      trail.height = this.H;
      const ctx = trail.getContext('2d');
      if (!ctx) return null;
      this.bodies(ctx, c);
      for (let i = 0; i < this.cached; i++) {
        if (!this.upTo[i]) continue;
        this.pen(ctx, c, i);
        this.stroke(ctx, i, this.upTo[i], 0);
      }
      this.trail = trail;
    }
    return this.trail;
  }

  // draws on the trails the pieces of the trajectories before cached that their heads have passed since
  // the last frame, i.e. from the point of upTo to the last point of the path passed, and moves upTo
  // there. a piece ends at a point of the path, since a stroke to a point left out of the path ends
  // at the point of the path before it
  private extend(c: Colors): void {
    const ctx = this.trailOf(c)?.getContext('2d'), ghost = this.ghosted, gtx = ghost?.trail?.getContext('2d');
    if (!ctx) return;
    for (let i = 0; i < this.cached; i++) {
      const to = this.lastKept(i, this.idx[i]), from = this.upTo[i];
      if (to <= from) continue;
      this.pen(ctx, c, i);
      this.stroke(ctx, i, to, 0, from);
      if (ghost && gtx) {
        this.pen(gtx, ghost.c, i, ghost.inks);
        this.stroke(gtx, i, to, 0, from);
      }
      this.upTo[i] = to;
    }
    for (const t of [ctx, gtx]) if (t) { t.globalAlpha = 1; t.shadowBlur = 0; }
  }

  reset(): void {
    this.unghost();
    this.stop();
    this.pending = false;
    this.t0 = null;
    this.finished = false;
    this.idx = this.trajectories.map(() => 0);
    this.upTo = this.trajectories.map(() => 0);
    this.redraw();
  }

  // with force, the backdrop is traced in a still deck too, e.g. in the print view for a recording of
  // scripts/record.mjs
  start(force = false): void {
    if (!force && Orbits.reduced()) { this.complete(); return; }
    if (!this.loaded) { this.pending = true; return; }
    if (this.raf || (this.finished && !this.loop)) return;
    this.t0 = performance.now();
    this.trail = null;
    const tick = (now: number) => {
      this.frame(now);
      this.raf = !this.finished || this.loop ? requestAnimationFrame(tick) : 0;
    };
    this.raf = requestAnimationFrame(tick);
  }

  complete(): void {
    this.unghost();
    this.stop();
    this.pending = false;
    this.finished = true;
    this.t0 = null;
    this.redraw();
  }

  destroy(): void {
    this.unghost();
    this.stop();
    this.pending = false;
    this.trail = null;
    this.base.remove();
    this.head.remove();
    CACHE.delete(this.el);
  }

  // tints the drawn trajectories within r slide pixels of the client point in the accent color, or
  // clears the tint when clientX is null
  glow(clientX: number | null, clientY = 0, r = 20): void {
    if (clientX === null || !this.W) this.pointer = null;
    else {
      const b = this.el.getBoundingClientRect();
      if (!b.width || !this.el.offsetWidth) return;
      this.pointer = { x: ((clientX - b.left) / b.width) * this.W, y: ((clientY - b.top) / b.height) * this.H, r: (r * this.W) / this.el.offsetWidth };
    }
    if (!this.raf) this.paintHead(performance.now());
  }

  private stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private paintHead(now: number, c: Colors = this.colors()): void {
    if (!this.W) return;
    this.headOn(this.head, now, c);
    if (this.ghosted) this.headOn(this.ghosted.head, now, this.ghosted.c);
  }

  private headOn(canvas: HTMLCanvasElement, now: number, c: Colors): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.W, this.H);
    if (this.loop) this.loopHead(ctx, c, now);
    else if (this.raf && this.t0 !== null && !this.finished) this.heads(ctx, c, now);
    if (this.pointer) this.glowing(ctx, c);
  }

  // the head of the first trajectory of a built-in backdrop, or of each trajectory of a file, which has no trajectories and no
  // paths before it is loaded
  private loopHead(ctx: CanvasRenderingContext2D, c: Colors, now: number): void {
    const count = this.dots === null ? Math.min(1, this.trajectories.length) : this.trajectories.length;
    for (let i = 0; i < count && this.paths[i]; i++) {
      const s = this.trajectories[i], p = this.paths[i].px, n = s.times.length;
      const tau = this.raf && this.t0 !== null ? ((((now - this.t0) / 1000) % LOOP) / LOOP) * s.T : this.finished ? 0.37 * s.T : 0;
      let j = 0;
      while (j < n - 1 && s.times[j + 1] <= tau) j++;
      // a trail over the last tenth of the period, brighter toward the head
      const back = 0.1 * s.T;
      ctx.lineWidth = this.lw * 1.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = c.accent;
      for (let k = j; k > 0 && s.times[k] > tau - back; k--) {
        const a = 1 - (tau - s.times[k]) / back;
        ctx.globalAlpha = 0.85 * a * a;
        ctx.beginPath(); ctx.moveTo(p[2 * (k - 1)], p[2 * (k - 1) + 1]); ctx.lineTo(p[2 * k], p[2 * k + 1]); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const [X, Y] = this.at(i, j, tau);
      ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(X, Y, 3 * this.lw, 0, 2 * Math.PI); ctx.fill();
    }
  }

  // the flight time reached by trajectory i at the time now, which is negative before its start
  private clock(i: number, now: number): number {
    return (((now - (this.t0 ?? now)) / 1000 - i * this.stagger) / this.duration) * this.Tmax;
  }

  // the radius of the head of trajectory i in line widths: the one given in its file, or the one of the
  // backdrop on the path of a spacecraft, or on every trajectory with data-heads set
  private headOf(i: number): number {
    const s = this.trajectories[i];
    return s.head ?? (this.everyHead || s.craft ? this.headSize : 0);
  }

  // true when a head is drawn on at least one trajectory during a trace
  get headed(): boolean {
    return this.trajectories.some((_, i) => this.headOf(i) > 0);
  }

  // the seconds into the trace at which its last trajectory is traced to its end, with trajectory i started
  // i times the stagger late
  get span(): number {
    if (!(this.Tmax > 0)) return this.duration;
    return Math.max(...this.trajectories.map((s, i) => (s.times[s.times.length - 1] / this.Tmax) * this.duration + i * this.stagger));
  }

  // the seconds after which the frames of a loop repeat, i.e. one revolution of its heads, or 0 for a
  // backdrop that is not a loop
  get period(): number {
    return this.loop ? LOOP : 0;
  }

  // the seconds into the trace at which its first head is drawn, e.g. at the start of a trajectory of a file
  get headAfter(): number {
    if (!(this.Tmax > 0)) return 0;
    const first = Math.min(...this.trajectories.map((s, i) => (this.headOf(i) > 0 ? (s.times[0] / this.Tmax) * this.duration + i * this.stagger : Infinity)));
    return Number.isFinite(first) ? first : 0;
  }

  private heads(ctx: CanvasRenderingContext2D, c: Colors, now: number): void {
    if (!this.headed) return;
    ctx.fillStyle = c.accent;
    this.trajectories.forEach((s, i) => {
      const j = this.idx[i], tau = this.clock(i, now), size = this.headOf(i);
      // the head of a trajectory is not drawn before times[0] of this trajectory
      if (!size || j >= s.times.length - 1 || tau < s.times[0]) return;
      const [X, Y] = this.at(i, j, tau);
      ctx.beginPath(); ctx.arc(X, Y, size * this.lw, 0, 2 * Math.PI); ctx.fill();
    });
  }

  // tints the drawn trajectories within the radius of the pointer. a segment of a trajectory is stroked when its
  // box, with its control points where it is curved, meets the box of the disc, and the stroke is
  // clipped to the disc, since the points of a trajectory may lie far apart on either side of it
  private glowing(ctx: CanvasRenderingContext2D, c: Colors): void {
    const g = this.pointer;
    if (!g) return;
    const reach = g.r + this.lw;
    ctx.save();
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, 2 * Math.PI);
    ctx.clip();
    ctx.strokeStyle = c.accent; ctx.globalAlpha = 0.35; ctx.lineWidth = this.lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    this.trajectories.forEach((_, i) => {
      const { px: p, ctl } = this.paths[i], last = this.drawn(i);
      let pen = false;
      for (let j = 1; j <= last; j++) {
        const bent = curved(ctl, j - 1);
        let lx = Math.min(p[2 * j - 2], p[2 * j]), hx = Math.max(p[2 * j - 2], p[2 * j]);
        let ly = Math.min(p[2 * j - 1], p[2 * j + 1]), hy = Math.max(p[2 * j - 1], p[2 * j + 1]);
        if (bent) {
          lx = Math.min(lx, ctl[4 * j - 4], ctl[4 * j - 2]); hx = Math.max(hx, ctl[4 * j - 4], ctl[4 * j - 2]);
          ly = Math.min(ly, ctl[4 * j - 3], ctl[4 * j - 1]); hy = Math.max(hy, ctl[4 * j - 3], ctl[4 * j - 1]);
        }
        if (lx > g.x + reach || hx < g.x - reach || ly > g.y + reach || hy < g.y - reach) {
          pen = false;
          continue;
        }
        if (!pen) ctx.moveTo(p[2 * j - 2], p[2 * j - 1]);
        if (bent) ctx.bezierCurveTo(ctl[4 * j - 4], ctl[4 * j - 3], ctl[4 * j - 2], ctl[4 * j - 1], p[2 * j], p[2 * j + 1]);
        else ctx.lineTo(p[2 * j], p[2 * j + 1]);
        pen = true;
      }
    });
    ctx.stroke();
    ctx.restore();
  }

  // the point of trajectory i at the flight time tau, on its segment from point j to j + 1
  private at(i: number, j: number, tau: number): [number, number] {
    return pointOn(this.paths[i], j, j < this.trajectories[i].times.length - 1 ? this.fraction(i, j, tau) : 0);
  }

  private frame(now: number): void {
    if (this.loop || !this.W) { this.paintHead(now); return; }
    const ctx = this.base.getContext('2d');
    if (!ctx) return;
    let flying = 0;
    this.trajectories.forEach((s, i) => {
      const n = s.times.length, tau = this.clock(i, now);
      let j = this.idx[i];
      while (j < n - 1 && s.times[j + 1] <= tau) j++;
      this.idx[i] = j;
      if (j < n - 1) flying++;
    });
    if (flying === 0) this.finished = true;
    const c = this.colors(), ghost = this.ghosted, gtx = ghost?.base.getContext('2d');
    if (this.finished) this.trail = null;
    else this.extend(c);
    this.draw(ctx, c, now, this.inks, this.trail);
    if (ghost && gtx) this.draw(gtx, ghost.c, now, ghost.inks, this.trail && ghost.trail);
    this.paintHead(now, c);
  }
}

// one Orbits per `.backdrop` under root, reused when an element was mounted before
export function mount(root: ParentNode): Orbits[] {
  const out: Orbits[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('.backdrop')) out.push(CACHE.get(el) ?? new Orbits(el));
  return out;
}
