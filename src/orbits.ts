// orbits of the CR3BP of the Earth–Moon system, computed with a short propagator and corrector and
// traced on two canvases of a `.backdrop` element. the engine is ported from orbits.ts of Claudio
// Vestini's website (MIT) and reduced to the families drawn on the slides. all quantities are
// nondimensional, in the rotating frame

import { scene } from './scenes.ts';
import { fitView, mix, strandsFor } from './strands.ts';
import type { Dot } from './strands.ts';

export type Member = { s: Float64Array; path: number[]; times: number[]; t: number };
export type Tone = 'orange' | 'violet' | 'text' | 'hero' | 'line';
// pts is a list of alternating x and y values. times are the flight times of the points, and T is
// the last of them. alpha, when set, replaces the opacity of the tone. ink, when set, replaces the
// color of the tone with the color at the fraction at between the two colors of the pair of the
// palette --strand-1 to --strand-8 in theme/beeson.css, i.e. --strand-1 and --strand-2 for pair 0
// a strand of a file may also set its weight, i.e. its width in line widths, the size of its head
// in line widths in place of the size of its backdrop, and a glow, a soft halo of its own color
export type Strand = { pts: Float64Array; times: Float32Array; T: number; tone?: Tone; alpha?: number; ink?: { pair: number; at: number }; weight?: number; head?: number; glow?: boolean };

export const MU = 0.01215;
// the distance to a body within which the step is shortened in step()
const NEAR = 0.15;
// seconds in which the longest flight of a scene is traced, when data-duration is not set
const DURATION = 12;
// seconds per revolution of a looping mark
const LOOP = 9;
// the radii of the heads of a trace for each value of the attribute data-heads, in line widths
const HEADS: Record<string, number> = { full: 2.2, small: 0.55, none: 0 };
// the heads of a backdrop drawn from a file of polylines, when data-heads is not set
const FILE_HEADS = 'none';
// the number of colors of the palette of theme/beeson.css, in pairs
const PALETTE = 8;

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

export const POINTS = {
  L1: (): [number, number] => [lagrange(1), 0],
  L2: (): [number, number] => [lagrange(2), 0],
  moon: (): [number, number] => [1 - MU, 0],
  earth: (): [number, number] => [-MU, 0],
};
type Point = keyof typeof POINTS;
const isPoint = (v: string | undefined): v is Point => v !== undefined && v in POINTS;

type Colors = { stroke: string; body: string; accent: string; violet: string; text: string };

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
  private px: Float32Array[] = [];
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
  // the seconds in which the longest strand is traced
  readonly duration: number;
  // the colors of the strands with an ink, resolved in redraw() for the current mode
  private inks: string[] = [];
  // resolved when the strands are in place, at once for a named scene and after the load of a file
  readonly ready: Promise<void>;

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
    this.headSize = HEADS[el.dataset.heads ?? (file ? FILE_HEADS : 'full')] ?? HEADS.full;
    this.duration = +(el.dataset.duration ?? 0) || DURATION;
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

  private colors(): Colors {
    const cs = getComputedStyle(this.el);
    return { stroke: cs.getPropertyValue('--stroke').trim(), body: cs.getPropertyValue('--body').trim(), accent: cs.getPropertyValue('--accent').trim(), violet: cs.getPropertyValue('--violet').trim(), text: cs.getPropertyValue('--text').trim() };
  }

  // the colors of the strands with an ink in the current mode. a color of the palette is serialized
  // by the canvas as #rrggbb or rgba(), which mix() reads, and a strand is given the stroke color
  // when its colors are missing or of another form
  private paint(ctx: CanvasRenderingContext2D, c: Colors): void {
    if (!this.strands.some((s) => s.ink)) { this.inks = []; return; }
    const cs = getComputedStyle(this.el);
    const palette = Array.from({ length: PALETTE }, (_, i) => {
      const value = cs.getPropertyValue(`--strand-${i + 1}`).trim();
      if (!value) return '';
      ctx.fillStyle = '#000000';
      ctx.fillStyle = value;
      return String(ctx.fillStyle);
    });
    this.inks = this.strands.map((s) => {
      if (!s.ink) return '';
      const k = (2 * s.ink.pair) % PALETTE;
      return mix(palette[k], palette[k + 1], s.ink.at) ?? c.stroke;
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
    this.px = this.strands.map((s) => {
      const n = s.times.length, out = new Float32Array(2 * n);
      for (let i = 0; i < n; i++) { out[2 * i] = this.X(s.pts[2 * i]); out[2 * i + 1] = this.Y(s.pts[2 * i + 1]); }
      return out;
    });
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
  private pen(ctx: CanvasRenderingContext2D, c: Colors, i: number): void {
    const s = this.strands[i], tone = s.tone;
    ctx.strokeStyle = s.ink ? this.inks[i] : tone === 'orange' || tone === 'hero' ? c.accent : tone === 'violet' ? c.violet : tone === 'text' || tone === 'line' ? c.text : c.stroke;
    ctx.globalAlpha = s.alpha ?? (tone === 'orange' || tone === 'violet' ? 0.42 : tone === 'text' ? 0.8 : tone === 'line' ? 0.36 : 1);
    ctx.lineWidth = (tone === 'hero' ? 2.2 : tone === 'text' ? 1.3 : 1) * (s.weight ?? 1) * this.lw;
    ctx.shadowBlur = s.glow ? 6 * this.lw : 0;
    if (s.glow) ctx.shadowColor = ctx.strokeStyle;
  }

  private segments(ctx: CanvasRenderingContext2D, i: number, from: number, to: number): void {
    const p = this.px[i];
    if (to <= from) return;
    ctx.beginPath(); ctx.moveTo(p[2 * from], p[2 * from + 1]);
    for (let j = from + 1; j <= to; j++) ctx.lineTo(p[2 * j], p[2 * j + 1]);
    ctx.stroke();
  }

  // the last point drawn of strand i
  private drawn(i: number): number {
    return this.done ? this.strands[i].times.length - 1 : this.idx[i];
  }

  redraw(): void {
    if (!this.W) return;
    const ctx = this.base.getContext('2d');
    if (!ctx) return;
    const c = this.colors();
    ctx.clearRect(0, 0, this.W, this.H);
    this.paint(ctx, c);
    ctx.lineWidth = this.lw; ctx.lineJoin = 'round'; ctx.strokeStyle = c.stroke;
    this.bodies(ctx, c);
    this.strands.forEach((_, i) => {
      this.pen(ctx, c, i);
      this.segments(ctx, i, 0, this.drawn(i));
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    this.paintHead(performance.now(), c);
  }

  reset(): void {
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
    this.stop();
    this.pending = false;
    this.finished = true;
    this.t0 = null;
    this.redraw();
  }

  destroy(): void {
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
    const ctx = this.head.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.W, this.H);
    if (this.loop) this.loopHead(ctx, c, now);
    else if (this.raf && this.t0 !== null && !this.finished) this.heads(ctx, c, now);
    if (this.pointer) this.glowing(ctx, c);
  }

  private loopHead(ctx: CanvasRenderingContext2D, c: Colors, now: number): void {
    const s = this.strands[0], p = this.px[0], n = s.times.length;
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

  // the radius of the head of strand i in line widths: its own, or the one of the backdrop
  private headOf(i: number): number {
    return this.strands[i].head ?? this.headSize;
  }

  // whether a head is drawn on any strand during the trace
  get headed(): boolean {
    return this.strands.some((_, i) => this.headOf(i) > 0);
  }

  // the seconds into the trace at which its first head is drawn, e.g. after the tubes of a transfer
  get headAfter(): number {
    const first = Math.min(...this.strands.filter((_, i) => this.headOf(i) > 0).map((s) => s.times[0]));
    return Number.isFinite(first) && this.Tmax > 0 ? (first / this.Tmax) * this.duration : 0;
  }

  // the clock of the trace at the time now, in the units of the strands
  private tau(now: number): number {
    return ((now - (this.t0 ?? now)) / 1000 / this.duration) * this.Tmax;
  }

  private heads(ctx: CanvasRenderingContext2D, c: Colors, now: number): void {
    if (!this.headed) return;
    const tau = this.tau(now);
    ctx.fillStyle = c.accent;
    this.strands.forEach((s, i) => {
      const j = this.idx[i], size = this.headOf(i);
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
      const p = this.px[i], last = this.drawn(i);
      let pen = false;
      for (let j = 0; j <= last; j++) {
        const dx = p[2 * j] - g.x, dy = p[2 * j + 1] - g.y;
        if (dx * dx + dy * dy <= r2) {
          if (pen) ctx.lineTo(p[2 * j], p[2 * j + 1]);
          else if (j > 0) { ctx.moveTo(p[2 * j - 2], p[2 * j - 1]); ctx.lineTo(p[2 * j], p[2 * j + 1]); }
          else ctx.moveTo(p[0], p[1]);
          pen = true;
        } else if (pen) {
          ctx.lineTo(p[2 * j], p[2 * j + 1]);
          pen = false;
        }
      }
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private at(i: number, j: number, tau: number): [number, number] {
    const s = this.strands[i], p = this.px[i], n = s.times.length;
    if (j >= n - 1) return [p[2 * (n - 1)], p[2 * (n - 1) + 1]];
    const f = Math.min(1, Math.max(0, (tau - s.times[j]) / (s.times[j + 1] - s.times[j])));
    return [p[2 * j] + f * (p[2 * j + 2] - p[2 * j]), p[2 * j + 1] + f * (p[2 * j + 3] - p[2 * j + 1])];
  }

  private frame(now: number): void {
    if (this.loop || !this.W) { this.paintHead(now); return; }
    const tau = this.tau(now);
    const ctx = this.base.getContext('2d');
    if (!ctx) return;
    const c = this.colors();
    ctx.lineWidth = this.lw; ctx.lineJoin = 'round'; ctx.strokeStyle = c.stroke;
    let flying = 0;
    this.strands.forEach((s, i) => {
      const n = s.times.length;
      let j = this.idx[i];
      while (j < n - 1 && s.times[j + 1] <= tau) j++;
      this.pen(ctx, c, i);
      this.segments(ctx, i, this.idx[i], j);
      this.idx[i] = j;
      if (j < n - 1) flying++;
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    if (flying === 0) this.finished = true;
    this.paintHead(now, c);
  }
}

// one Orbits per `.backdrop` under root, reused when an element was mounted before
export function mount(root: ParentNode): Orbits[] {
  const out: Orbits[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('.backdrop')) out.push(CACHE.get(el) ?? new Orbits(el));
  return out;
}
