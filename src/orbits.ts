// orbits of the CR3BP of the Earth–Moon system, computed with a short propagator and corrector and
// traced on two canvases of a `.backdrop` element. the engine is ported from orbits.ts of Claudio
// Vestini's website (MIT) and reduced to the families drawn on the slides. all quantities are
// nondimensional, in the rotating frame

import { scene, seconds } from './scenes.ts';
import { colormapColor, fitView, mix, shadeOf, strandsFor } from './strands.ts';
import type { Colormap, Dot } from './strands.ts';

export type Member = { s: Float64Array; path: number[]; times: number[]; t: number };
export type Tone = 'orange' | 'violet' | 'text' | 'hero' | 'line';
// pts is a list of alternating x and y values. times are the flight times of the points, and T is
// the last of them. color, when set, is a CSS color or a pair of them for the dark and the light
// mode in place of the color of the tone. alpha, when set, replaces the opacity of the tone. ink,
// when set, replaces the color of the tone with the color at the fraction at between the two
// colors of the pair of the palette --strand-1 to --strand-8 in theme/beeson.css, i.e. --strand-1
// and --strand-2 for pair 0, or with shade the shade at the fraction at of the first color of the
// pair, or with map the color at the fraction at between the ends of the colormap map. craft, when
// true, marks the path of a spacecraft, whose head is drawn without data-heads. a strand of a file
// may also set its weight, i.e. its width in line widths, the radius of its head in line widths in
// place of the size of its backdrop, a glow, a soft halo of its own color, and a fade, the seconds
// of its clock from its first point after which its opacity falls to zero at its last point, as the
// square of the time left, in FADE_BANDS bands of equal time
export type Strand = { pts: Float64Array; times: Float32Array; T: number; tone?: Tone; color?: string | [string, string]; alpha?: number; ink?: { pair: number; at: number; shade?: boolean; map?: Colormap }; craft?: boolean; weight?: number; head?: number; glow?: boolean; fade?: number };
const FADE_BANDS = 12;

export const MU = 0.01215;
// the distance to a body within which the step is shortened in step()
const NEAR = 0.15;
// seconds in which the longest flight of a backdrop is traced, unless the element sets its own in
// data-duration or a scene in src/scenes.ts
const DURATION = 12;
// seconds per revolution of a looping mark
const LOOP = 9;
// the radii of the heads of a trace for each value of the attribute data-heads, in line widths.
// without data-heads, a head of full size is drawn on each strand of a spacecraft alone
const HEADS: Record<string, number> = { full: 2.2, small: 0.55, none: 0 };
// the number of colors of the palette of theme/beeson.css, in pairs
const PALETTE = 8;
// the distance in canvas pixels within which the path drawn for a strand follows its points. a
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
export function closed(m: Member): Strand {
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

// a strand from a recorded flight of x, y, z triples
export function open(path: number[], times: number[]): Strand {
  const n = times.length, pts = new Float64Array(2 * n);
  for (let i = 0; i < n; i++) {
    pts[2 * i] = path[3 * i]; pts[2 * i + 1] = path[3 * i + 1];
  }
  return { pts, times: Float32Array.from(times), T: times[n - 1] };
}

// a strand as drawn on a canvas. px holds its points in canvas pixels, keep the indices of the
// points of its path in increasing order, and ctl four numbers per segment, the two inner control
// points of the cubic Bézier curve of the segment, or NaN for a segment drawn straight. ctl is null
// when every segment is drawn straight
export type Path = { px: Float32Array; keep: Uint32Array; ctl: Float32Array | null };

type Pen = Pick<CanvasRenderingContext2D, 'moveTo' | 'lineTo' | 'bezierCurveTo'>;

const curved = (ctl: Float32Array | null, j: number): ctl is Float32Array => ctl !== null && !Number.isNaN(ctl[4 * j]);

// the path of the points px, in canvas pixels. a segment is drawn as the curve of the centripetal
// Catmull–Rom spline through the points of [Yuksel et al. 2011](https://doi.org/10.1016/j.cad.2010.08.008)
// where this curve departs from the chord by more than tolerance, i.e. where the points are too
// sparse for the turn of the strand. on a closed strand, whose last point is within half a pixel
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
    // the neighbors of the segment, the points across the joint on a closed strand, or the
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

// adds to pen the path of a strand from its point from, its first by default, to the fraction f of
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

// one drawing per `.backdrop` element. the strands are drawn on the base canvas, and the heads and
// the pointer glow on the head canvas
export class Orbits {
  readonly el: HTMLElement;
  private strands: Strand[];
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
  // true when the window is fitted to the strands of a file, i.e. without data-half
  private fitted: boolean;
  // the box and the slide for which the window was last fitted, in slide pixels
  private fittedFor = '';
  private loaded: boolean;
  // true when start() was called before the strands of a file were loaded
  private pending = false;
  private headSize: number;
  // seconds in which the longest strand is traced
  readonly duration: number;
  // seconds between the starts of two strands one after the other, from data-stagger
  private stagger: number;
  // true when a head is drawn on every strand, and false when on the strands of a spacecraft alone
  private everyHead: boolean;
  // the colors of the strands with an ink, resolved in redraw() for the current mode
  private inks: string[] = [];
  // copies of the canvases, traced in the colors of the old mode during a flip, or null
  private ghosted: { base: HTMLCanvasElement; head: HTMLCanvasElement; c: Colors; inks: string[] } | null = null;
  // resolved when the strands are in place, at once for a named scene and after the load of a file
  readonly ready: Promise<void>;

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
    const file = el.dataset.strands !== undefined;
    this.strands = file ? [] : scene(el.dataset.scene ?? '');
    this.dots = file ? [] : null;
    this.loaded = !file;
    this.fitted = file && el.dataset.half === undefined;
    this.headSize = HEADS[el.dataset.heads ?? 'full'] ?? HEADS.full;
    this.everyHead = el.dataset.heads !== undefined;
    const given = Number(el.dataset.duration);
    this.duration = (given > 0 ? given : undefined) ?? (file ? undefined : seconds(el.dataset.scene ?? '')) ?? DURATION;
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
    this.labels = [...el.querySelectorAll<HTMLElement>('.lab')];
    this.Tmax = Math.max(...this.strands.map((s) => s.T));
    this.idx = this.strands.map(() => 0);
    CACHE.set(el, this);
    this.fit();
    this.ready = file ? strandsFor(el).then(({ strands, dots }) => this.install(strands, dots)) : Promise.resolve();
  }

  private install(strands: Strand[], dots: Dot[]): void {
    this.strands = strands;
    this.dots = dots;
    this.Tmax = Math.max(...strands.map((s) => s.T));
    this.idx = strands.map(() => 0);
    this.loaded = true;
    this.fittedFor = '';
    this.pathsFor = '';
    this.fit();
    if (this.pending) {
      this.pending = false;
      this.start();
    }
  }

  // the window in the units of the strands: its center and its half height
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
    this.ghosted = { base, head, c: this.colors(), inks: [...this.inks] };
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

  // the colors of the strands with an ink in the current mode. a color of the palette is serialized
  // by the canvas as #rrggbb or rgba(), which mix() reads, and a strand is given the stroke color
  // when its colors are missing or of another form
  private paint(ctx: CanvasRenderingContext2D, c: Colors): void {
    if (!this.strands.some((s) => s.ink)) { this.inks = []; return; }
    const cs = getComputedStyle(this.el);
    const color = (name: string) => {
      const value = cs.getPropertyValue(name).trim();
      if (!value) return '';
      ctx.fillStyle = '#000000';
      ctx.fillStyle = value;
      return String(ctx.fillStyle);
    };
    const palette = Array.from({ length: PALETTE }, (_, i) => color(`--strand-${i + 1}`));
    // the shades and the ends of a colormap keep their contrast against the background of the slide
    const bg = color('--bg') || undefined;
    this.inks = this.strands.map((s) => {
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
    if (this.fitted && this.strands.length) {
      const section = this.el.closest('section');
      const box = { left: this.el.offsetLeft, top: this.el.offsetTop, width: w, height: h };
      const slide = { width: section?.offsetWidth || w, height: section?.offsetHeight || h };
      const key = [box.left, box.top, w, h, slide.width, slide.height].join();
      if (key !== this.fittedFor) {
        const view = fitView(this.strands, box, slide);
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
      this.paths = this.strands.map((s) => {
        const n = s.times.length, out = new Float32Array(2 * n);
        for (let i = 0; i < n; i++) { out[2 * i] = this.X(s.pts[2 * i]); out[2 * i + 1] = this.Y(s.pts[2 * i + 1]); }
        return pathOf(out);
      });
      this.pathsFor = key;
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

  // the color, opacity, width, and glow of strand i: those of its tone, then its own ink, alpha,
  // weight, and glow where it has them
  private pen(ctx: CanvasRenderingContext2D, c: Colors, i: number, inks = this.inks): void {
    const s = this.strands[i], tone = s.tone;
    ctx.strokeStyle = s.color ? (typeof s.color === 'string' ? s.color : s.color[c.light ? 1 : 0]) : s.ink ? inks[i] : tone === 'orange' || tone === 'hero' ? c.accent : tone === 'violet' ? c.violet : tone === 'text' || tone === 'line' ? c.text : c.stroke;
    ctx.globalAlpha = s.alpha ?? (tone === 'orange' || tone === 'violet' ? 0.42 : tone === 'text' ? 0.8 : tone === 'line' ? 0.36 : 1);
    ctx.lineWidth = (tone === 'hero' ? 2.2 : tone === 'text' ? 1.3 : 1) * (s.weight ?? 1) * this.lw;
    ctx.lineJoin = 'round';
    ctx.shadowBlur = s.glow ? 6 * this.lw : 0;
    if (s.glow) ctx.shadowColor = ctx.strokeStyle;
  }

  // strokes strand i up to the fraction f of its segment from point j to j + 1. up to its fade, the
  // strand is stroked in one path, since two strokes of one strand at an opacity below 1 overlap or
  // leave a gap at their joint. beyond its fade, it is stroked in bands of equal time, which begin
  // and end at its points, at an opacity that falls to zero at its last point
  private stroke(ctx: CanvasRenderingContext2D, i: number, j: number, f: number): void {
    const s = this.strands[i], path = this.paths[i];
    const part = (a: number, b: number, g: number) => {
      ctx.beginPath();
      trace(ctx, path, b, g, a);
      ctx.stroke();
    };
    const fadeAt = s.times[0] + (s.fade ?? Infinity), span = s.T - fadeAt;
    let a = 0;
    while (a < j && s.times[a + 1] <= fadeAt) a++;
    if (a === j || !(span > 0)) return part(0, j, f);
    if (a > 0) part(0, a, 0);
    const base = ctx.globalAlpha;
    for (let b = 0; b < FADE_BANDS && a < j; b++) {
      const until = fadeAt + ((b + 1) * span) / FADE_BANDS;
      let c = a;
      while (c < j && s.times[c + 1] <= until) c++;
      if (b === FADE_BANDS - 1) c = j;
      if (c > a) {
        ctx.globalAlpha = base * (1 - (b + 0.5) / FADE_BANDS) ** 2;
        part(a, c, c === j ? f : 0);
      }
      a = c;
    }
    ctx.globalAlpha = base;
  }

  // the last point drawn of strand i
  private drawn(i: number): number {
    return this.done ? this.strands[i].times.length - 1 : this.idx[i];
  }

  // true between the start and the end of a trace that is not a loop
  private get midTrace(): boolean {
    return !this.loop && this.t0 !== null && !this.finished;
  }

  // the fraction of the segment of strand i from point j to j + 1 reached at the flight time tau
  private fraction(i: number, j: number, tau: number): number {
    const t = this.strands[i].times, dt = t[j + 1] - t[j];
    return dt > 0 ? Math.min(1, Math.max(0, (tau - t[j]) / dt)) : 1;
  }

  // draws the bodies and the strands on the base canvas for the current mode
  redraw(): void {
    if (!this.W) return;
    const ctx = this.base.getContext('2d');
    if (!ctx) return;
    const c = this.colors(), now = performance.now();
    this.paint(ctx, c);
    this.draw(ctx, c, now);
    this.paintHead(now, c);
  }

  // draws the bodies and every strand, a finished strand whole and a strand in its trace up to its
  // head at the time now. the strands are stroked in the order of their file or scene at every
  // frame, the order of the still, hence the last frame of a trace is its still apart from the heads
  private draw(ctx: CanvasRenderingContext2D, c: Colors, now: number, inks = this.inks): void {
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.clearRect(0, 0, this.W, this.H);
    this.bodies(ctx, c);
    const tracing = this.midTrace;
    this.strands.forEach((s, i) => {
      const n = s.times.length, j = this.drawn(i);
      if (j < n - 1) {
        const tau = this.clock(i, now);
        if (!tracing || !(tau > s.times[0])) return;
        this.pen(ctx, c, i, inks);
        this.stroke(ctx, i, j, this.fraction(i, j, tau));
        return;
      }
      this.pen(ctx, c, i, inks);
      this.stroke(ctx, i, n - 1, 0);
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  reset(): void {
    this.unghost();
    this.stop();
    this.pending = false;
    this.t0 = null;
    this.finished = false;
    this.idx = this.strands.map(() => 0);
    this.redraw();
  }

  start(): void {
    if (Orbits.reduced()) { this.complete(); return; }
    if (!this.loaded) { this.pending = true; return; }
    if (this.raf || (this.finished && !this.loop)) return;
    this.t0 = performance.now();
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
    this.base.remove();
    this.head.remove();
    CACHE.delete(this.el);
  }

  // tints the drawn strands within r slide pixels of the client point in the accent color, or
  // clears the tint when clientX is null
  glow(clientX: number | null, clientY = 0, r = 60): void {
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

  private loopHead(ctx: CanvasRenderingContext2D, c: Colors, now: number): void {
    const s = this.strands[0], p = this.paths[0].px, n = s.times.length;
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
    const [X, Y] = this.at(0, j, tau);
    ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(X, Y, 3 * this.lw, 0, 2 * Math.PI); ctx.fill();
  }

  // the flight time reached by strand i at the time now, which is negative before its start
  private clock(i: number, now: number): number {
    return (((now - (this.t0 ?? now)) / 1000 - i * this.stagger) / this.duration) * this.Tmax;
  }

  // the radius of the head of strand i in line widths: the one of its record, or the one of the
  // backdrop on the path of a spacecraft, or on every strand with data-heads set
  private headOf(i: number): number {
    const s = this.strands[i];
    return s.head ?? (this.everyHead || s.craft ? this.headSize : 0);
  }

  // true when a head is drawn on at least one strand during a trace
  get headed(): boolean {
    return this.strands.some((_, i) => this.headOf(i) > 0);
  }

  // the seconds into the trace at which its first head is drawn, e.g. after the tubes of a transfer
  get headAfter(): number {
    if (!(this.Tmax > 0)) return 0;
    const first = Math.min(...this.strands.map((s, i) => (this.headOf(i) > 0 ? (s.times[0] / this.Tmax) * this.duration + i * this.stagger : Infinity)));
    return Number.isFinite(first) ? first : 0;
  }

  private heads(ctx: CanvasRenderingContext2D, c: Colors, now: number): void {
    if (!this.headed) return;
    ctx.fillStyle = c.accent;
    this.strands.forEach((s, i) => {
      const j = this.idx[i], tau = this.clock(i, now), size = this.headOf(i);
      // the head of a strand is not drawn before times[0] of this strand
      if (!size || j >= s.times.length - 1 || tau < s.times[0]) return;
      const [X, Y] = this.at(i, j, tau);
      ctx.beginPath(); ctx.arc(X, Y, size * this.lw, 0, 2 * Math.PI); ctx.fill();
    });
  }

  private glowing(ctx: CanvasRenderingContext2D, c: Colors): void {
    const g = this.pointer;
    if (!g) return;
    const r2 = g.r * g.r;
    ctx.strokeStyle = c.accent; ctx.globalAlpha = 0.35; ctx.lineWidth = this.lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    this.strands.forEach((_, i) => {
      const { px: p, ctl } = this.paths[i], last = this.drawn(i);
      // the segment from point j - 1 to j, along its curve where it has one
      const to = (j: number) => {
        if (curved(ctl, j - 1)) ctx.bezierCurveTo(ctl[4 * j - 4], ctl[4 * j - 3], ctl[4 * j - 2], ctl[4 * j - 1], p[2 * j], p[2 * j + 1]);
        else ctx.lineTo(p[2 * j], p[2 * j + 1]);
      };
      let pen = false;
      for (let j = 0; j <= last; j++) {
        const dx = p[2 * j] - g.x, dy = p[2 * j + 1] - g.y;
        if (dx * dx + dy * dy <= r2) {
          if (pen) to(j);
          else if (j > 0) { ctx.moveTo(p[2 * j - 2], p[2 * j - 1]); to(j); }
          else ctx.moveTo(p[0], p[1]);
          pen = true;
        } else if (pen) {
          to(j);
          pen = false;
        }
      }
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // the point of strand i at the flight time tau, on its segment from point j to j + 1
  private at(i: number, j: number, tau: number): [number, number] {
    return pointOn(this.paths[i], j, j < this.strands[i].times.length - 1 ? this.fraction(i, j, tau) : 0);
  }

  private frame(now: number): void {
    if (this.loop || !this.W) { this.paintHead(now); return; }
    const ctx = this.base.getContext('2d');
    if (!ctx) return;
    let flying = 0;
    this.strands.forEach((s, i) => {
      const n = s.times.length, tau = this.clock(i, now);
      let j = this.idx[i];
      while (j < n - 1 && s.times[j + 1] <= tau) j++;
      this.idx[i] = j;
      if (j < n - 1) flying++;
    });
    if (flying === 0) this.finished = true;
    const c = this.colors(), ghost = this.ghosted, gtx = ghost?.base.getContext('2d');
    this.draw(ctx, c, now);
    if (ghost && gtx) this.draw(gtx, ghost.c, now, ghost.inks);
    this.paintHead(now, c);
  }
}

// one Orbits per `.backdrop` under root, reused when an element was mounted before
export function mount(root: ParentNode): Orbits[] {
  const out: Orbits[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('.backdrop')) out.push(CACHE.get(el) ?? new Orbits(el));
  return out;
}
