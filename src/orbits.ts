import { builtIn } from './backdrops.ts';
import { typesetLabels } from './drawn-text.ts';
import { colormapColor, fitView, load, mix, shadeOf, trajectoriesFor } from './trajectories.ts';
import type { Colormap, Dot, TrajectoryData } from './trajectories.ts';

export type Member = { s: Float64Array; path: number[]; times: number[]; t: number };
export type Tone = 'orange' | 'violet' | 'text' | 'hero' | 'line';
export type Trajectory = { pts: Float64Array; times: Float32Array; T: number; tone?: Tone; color?: string | [string, string]; alpha?: number; ink?: { pair: number; at: number; shade?: boolean; map?: Colormap }; craft?: boolean; weight?: number; head?: number; glow?: boolean; fade?: number };
const FADE_BANDS = 12;

const alphaOf = (s: Trajectory): number => s.alpha ?? (s.tone === 'orange' || s.tone === 'violet' ? 0.42 : s.tone === 'text' ? 0.8 : s.tone === 'line' ? 0.36 : 1);
const widthOf = (s: Trajectory): number => (s.tone === 'hero' ? 2.2 : s.tone === 'text' ? 1.3 : 1) * (s.weight ?? 1);

const colorOf = (s: Trajectory): string => (s.color ? `color ${JSON.stringify(s.color)}` : s.ink ? `ink ${JSON.stringify(s.ink)}` : s.tone === 'orange' || s.tone === 'hero' ? 'accent' : s.tone === 'violet' ? 'violet' : s.tone === 'text' || s.tone === 'line' ? 'text' : 'stroke');

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
const NEAR = 0.15;
const DURATION = 12;
const LOOP = 9;
const HEADS: Record<string, number> = { full: 2.2, small: 0.55, none: 0 };
const PALETTE = 8;
const TOLERANCE = 0.1;

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

export function ramp(a: number, b: number, factor: number): number[] {
  const out: number[] = [];
  for (let x = a; x < b; x *= factor) out.push(x);
  return out;
}

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

export function open(path: number[], times: number[]): Trajectory {
  const n = times.length, pts = new Float64Array(2 * n);
  for (let i = 0; i < n; i++) {
    pts[2 * i] = path[3 * i]; pts[2 * i + 1] = path[3 * i + 1];
  }
  return { pts, times: Float32Array.from(times), T: times[n - 1] };
}

export type Path = { px: Float32Array; keep: Uint32Array; ctl: Float32Array | null };

type Pen = Pick<CanvasRenderingContext2D, 'moveTo' | 'lineTo' | 'bezierCurveTo'>;

const curved = (ctl: Float32Array | null, j: number): ctl is Float32Array => ctl !== null && !Number.isNaN(ctl[4 * j]);

export function pathOf(px: Float32Array, tolerance = TOLERANCE): Path {
  const n = px.length / 2;
  const closed = n > 3 && Math.hypot(px[0] - px[2 * n - 2], px[1] - px[2 * n - 1]) < 0.5;
  const mark = new Uint8Array(n);
  mark[0] = mark[n - 1] = 1;
  let ctl: Float32Array | null = null;
  for (let j = 0; j < n - 1; j++) {
    const x1 = px[2 * j], y1 = px[2 * j + 1], x2 = px[2 * j + 2], y2 = px[2 * j + 3];
    let x0 = 2 * x1 - x2, y0 = 2 * y1 - y2, x3 = 2 * x2 - x1, y3 = 2 * y2 - y1;
    if (j > 0) { x0 = px[2 * j - 2]; y0 = px[2 * j - 1]; } else if (closed) { x0 = px[2 * n - 4]; y0 = px[2 * n - 3]; }
    if (j < n - 2) { x3 = px[2 * j + 4]; y3 = px[2 * j + 5]; } else if (closed) { x3 = px[2]; y3 = px[3]; }
    const d1 = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2), d2 = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2), d3 = Math.sqrt((x3 - x2) ** 2 + (y3 - y2) ** 2);
    if (!(d1 > 1e-6 && d2 > 1e-6 && d3 > 1e-6)) continue;
    const s1 = Math.sqrt(d1), s2 = Math.sqrt(d2), s3 = Math.sqrt(d3);
    const a = 2 * d1 + 3 * s1 * s2 + d2, b = 3 * s1 * (s1 + s2);
    const e = 2 * d3 + 3 * s3 * s2 + d2, g = 3 * s3 * (s3 + s2);
    const c1x = (d1 * x2 - d2 * x0 + a * x1) / b, c1y = (d1 * y2 - d2 * y0 + a * y1) / b;
    const c2x = (d3 * x1 - d2 * x3 + e * x2) / g, c2y = (d3 * y1 - d2 * y3 + e * y2) / g;
    const off = Math.max(Math.abs((c1x - x1) * (y2 - y1) - (c1y - y1) * (x2 - x1)), Math.abs((c2x - x1) * (y2 - y1) - (c2y - y1) * (x2 - x1))) / d2;
    if (0.75 * off <= tolerance) continue;
    if (!ctl) ctl = new Float32Array(4 * (n - 1)).fill(NaN);
    ctl.set([c1x, c1y, c2x, c2y], 4 * j);
    mark[j] = mark[j + 1] = 1;
  }
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

export function pointOn(path: Path, j: number, f: number): [number, number] {
  const p = path.px, n = p.length / 2;
  if (j >= n - 1) return [p[2 * n - 2], p[2 * n - 1]];
  const x1 = p[2 * j], y1 = p[2 * j + 1], x2 = p[2 * j + 2], y2 = p[2 * j + 3];
  if (!curved(path.ctl, j)) return [x1 + f * (x2 - x1), y1 + f * (y2 - y1)];
  const c = path.ctl, k = 4 * j, g = 1 - f;
  const w0 = g * g * g, w1 = 3 * g * g * f, w2 = 3 * g * f * f, w3 = f * f * f;
  return [w0 * x1 + w1 * c[k] + w2 * c[k + 2] + w3 * x2, w0 * y1 + w1 * c[k + 1] + w2 * c[k + 3] + w3 * y2];
}

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

export function labelPoint(at: string | undefined): [number, number] | null {
  if (isPoint(at)) return POINTS[at]();
  const xy = (at ?? '').trim().split(/\s+/).map(Number);
  return xy.length === 2 && xy.every(Number.isFinite) ? [xy[0], xy[1]] : null;
}

type Colors = { stroke: string; body: string; accent: string; violet: string; text: string; light: boolean };

const CACHE = new WeakMap<HTMLElement, Orbits>();

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
  private pathsFor = '';
  private pointer: { x: number; y: number; r: number } | null = null;
  private dots: Dot[] | null;
  private fitted: boolean;
  private fittedFor = '';
  private loaded: boolean;
  private pending = false;
  private headSize: number;
  readonly duration: number;
  private stagger: number;
  private everyHead: boolean;
  private inks: string[] = [];
  private ghosted: { base: HTMLCanvasElement; head: HTMLCanvasElement; trail: HTMLCanvasElement | null; c: Colors; inks: string[] } | null = null;
  private cached = 0;
  private upTo: number[] = [];
  private bands: (Uint32Array | null)[] = [];
  private trail: HTMLCanvasElement | null = null;
  readonly ready: Promise<void>;
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
    for (const old of el.querySelectorAll(':scope > canvas.orbits-base, :scope > canvas.orbits-head')) old.remove();
    this.base = document.createElement('canvas');
    this.head = document.createElement('canvas');
    this.base.className = 'orbits-base';
    this.head.className = 'orbits-head';
    for (const c of [this.base, this.head]) c.setAttribute('aria-hidden', 'true');
    el.prepend(this.head);
    el.prepend(this.base);
    this.labels = [...el.querySelectorAll<HTMLElement>('.label')];
    typesetLabels(this.labels);
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
    this.W = 0;
    this.fit();
    if (this.pending) {
      this.pending = false;
      this.start();
    }
  }

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

  get view(): { cx: number; cy: number; half: number } {
    return { cx: this.cx, cy: this.cy, half: this.half };
  }

  get fittedToTrajectories(): boolean {
    return this.fitted;
  }

  setWindow(view: { cx: number; cy: number; half: number } | null): void {
    if (view) {
      this.fitted = false;
      ({ cx: this.cx, cy: this.cy, half: this.half } = view);
    } else {
      this.fitted = this.el.dataset.trajectories !== undefined;
      this.fittedFor = '';
    }
    this.fit();
  }

  get extent(): { x0: number; x1: number; y0: number; y1: number } | null {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const { pts } of this.trajectories) {
      for (let i = 0; i + 1 < pts.length; i += 2) {
        if (pts[i] < x0) x0 = pts[i];
        if (pts[i] > x1) x1 = pts[i];
        if (pts[i + 1] < y0) y0 = pts[i + 1];
        if (pts[i + 1] > y1) y1 = pts[i + 1];
      }
    }
    return x0 <= x1 ? { x0, x1, y0, y1 } : null;
  }

  get done(): boolean {
    return this.finished || this.loop;
  }

  get tracing(): boolean {
    return this.raf !== 0;
  }

  get canvases(): HTMLCanvasElement[] {
    return [this.base, this.head];
  }

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
      const point = labelPoint(lab.dataset.at);
      if (!point) continue;
      const [x, y] = point;
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

  private pen(ctx: CanvasRenderingContext2D, c: Colors, i: number, inks = this.inks): void {
    const s = this.trajectories[i], tone = s.tone;
    ctx.strokeStyle = s.color ? (typeof s.color === 'string' ? s.color : s.color[c.light ? 1 : 0]) : s.ink ? inks[i] : tone === 'orange' || tone === 'hero' ? c.accent : tone === 'violet' ? c.violet : tone === 'text' || tone === 'line' ? c.text : c.stroke;
    ctx.globalAlpha = alphaOf(s);
    ctx.lineWidth = widthOf(s) * this.lw;
    ctx.lineJoin = 'round';
    ctx.shadowBlur = s.glow ? 6 * this.lw : 0;
    if (s.glow) ctx.shadowColor = ctx.strokeStyle;
  }

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

  private drawn(i: number): number {
    return this.done ? this.trajectories[i].times.length - 1 : this.idx[i];
  }

  private get midTrace(): boolean {
    return !this.loop && this.t0 !== null && !this.finished;
  }

  private fraction(i: number, j: number, tau: number): number {
    const t = this.trajectories[i].times, dt = t[j + 1] - t[j];
    return dt > 0 ? Math.min(1, Math.max(0, (tau - t[j]) / dt)) : 1;
  }

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

  private loopHead(ctx: CanvasRenderingContext2D, c: Colors, now: number): void {
    const count = this.dots === null ? Math.min(1, this.trajectories.length) : this.trajectories.length;
    for (let i = 0; i < count && this.paths[i]; i++) {
      const s = this.trajectories[i], p = this.paths[i].px, n = s.times.length;
      const tau = this.raf && this.t0 !== null ? ((((now - this.t0) / 1000) % LOOP) / LOOP) * s.T : this.finished ? 0.37 * s.T : 0;
      let j = 0;
      while (j < n - 1 && s.times[j + 1] <= tau) j++;
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

  private clock(i: number, now: number): number {
    return (((now - (this.t0 ?? now)) / 1000 - i * this.stagger) / this.duration) * this.Tmax;
  }

  private headOf(i: number): number {
    const s = this.trajectories[i];
    return s.head ?? (this.everyHead || s.craft ? this.headSize : 0);
  }

  get headed(): boolean {
    return this.trajectories.some((_, i) => this.headOf(i) > 0);
  }

  get span(): number {
    if (!(this.Tmax > 0)) return this.duration;
    return Math.max(...this.trajectories.map((s, i) => (s.times[s.times.length - 1] / this.Tmax) * this.duration + i * this.stagger));
  }

  get period(): number {
    return this.loop ? LOOP : 0;
  }

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
      if (!size || j >= s.times.length - 1 || tau < s.times[0]) return;
      const [X, Y] = this.at(i, j, tau);
      ctx.beginPath(); ctx.arc(X, Y, size * this.lw, 0, 2 * Math.PI); ctx.fill();
    });
  }

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

export function mount(root: ParentNode): Orbits[] {
  const out: Orbits[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('.backdrop')) out.push(CACHE.get(el) ?? new Orbits(el));
  return out;
}
