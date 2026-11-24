import { Orbits } from './orbits.ts';
import { builtInFile, colormapAt, colormapEnds } from './trajectories.ts';
import type { Colors, Extent, Kind } from './dotkind.ts';
import { poincare } from './poincare.ts';
import { tori } from './tori.ts';
import { normalForm } from './normal-form.ts';

export type View = { cx: number; cy: number; half: number };
type Box = { width: number; height: number };
type AnyKind = Kind<unknown, unknown>;

const KINDS: Record<string, AnyKind> = { poincare: poincare as unknown as AnyKind, tori: tori as unknown as AnyKind, normalForm: normalForm as unknown as AnyKind };
export const DOTTED = Object.keys(KINDS);

const SECONDS_BETWEEN_FRAMES = 1 / 31;
const FAINTEST_CONTRAST = 1.6;
const SHARPEST = 3;
const PRINT_SHARPNESS = 2;
const HEIGHT_OUTSIDE_A_SLIDE = 420;

const given = new Map<string, unknown>();
const files = new Map<string, Promise<unknown>>();

export function register(name: string, data: unknown): void {
  given.set(name, data);
}

function load(name: string): Promise<unknown> {
  let out = files.get(name);
  if (!out) {
    out = new Promise((done) => {
      const script = document.createElement('script');
      script.src = builtInFile(name);
      const missing = (reason: string) => {
        console.warn(`beeson: the backdrop of ${script.src} is not drawn, since the file ${reason}`);
        done(null);
      };
      script.onload = () => (given.has(name) ? done(given.get(name)) : missing('does not call Beeson.drawing'));
      script.onerror = () => missing('was not found');
      document.head.append(script);
    });
    files.set(name, out);
  }
  return out;
}

export function fittedView(extent: Extent, margin: number, box: Box): View {
  const scale = Math.min(Math.max(1, box.width - 2 * margin) / (extent.x1 - extent.x0), Math.max(1, box.height - 2 * margin) / (extent.y1 - extent.y0));
  return { cx: (extent.x0 + extent.x1) / 2, cy: (extent.y0 + extent.y1) / 2, half: box.height / 2 / scale };
}

function colorsOf(el: HTMLElement, g: CanvasRenderingContext2D): Colors {
  const css = getComputedStyle(el);
  const tone = (name: string) => {
    const value = css.getPropertyValue(name).trim();
    if (!value) return '';
    g.fillStyle = '#000000';
    g.fillStyle = value;
    return String(g.fillStyle);
  };
  const light = el.ownerDocument.documentElement.dataset.theme === 'light';
  const ground = tone('--bg');
  const ends = new Map<string, [number, number]>();
  const tones = new Map<string, string>();
  return {
    light,
    ground,
    text: tone('--text'),
    mark: tone('--data-7'),
    tone(name) {
      let out = tones.get(name);
      if (out === undefined) tones.set(name, (out = tone(name)));
      return out;
    },
    map(name, at, trim = [0, 1]) {
      const key = `${name} ${trim.join()}`;
      let e = ends.get(key);
      if (!e) {
        e = light ? trim : colormapEnds({ name, lo: trim[0], hi: trim[1] }, ground || undefined, FAINTEST_CONTRAST);
        ends.set(key, e);
      }
      return colormapAt(name, e[0] + (e[1] - e[0]) * Math.min(1, Math.max(0, at)));
    },
  };
}

const CACHE = new WeakMap<HTMLElement, Dots>();

export class Dots {
  readonly el: HTMLElement;
  readonly ready: Promise<void>;
  private kind: AnyKind;
  private canvas: HTMLCanvasElement;
  private state: unknown = null;
  private duration: number;
  private cx = 0;
  private cy = 0;
  private half = 1;
  private fitted: boolean;
  private fittedFor = '';
  private w = 0;
  private h = 0;
  private sharpness = 1;
  private raf = 0;
  private t0: number | null = null;
  private finished = false;
  private pending = false;
  private colors: Colors | null = null;
  private mode = '';

  static of(el: HTMLElement): Dots | undefined {
    return CACHE.get(el);
  }

  static draws(el: HTMLElement): boolean {
    return el.dataset.trajectories === undefined && Object.prototype.hasOwnProperty.call(KINDS, el.dataset.backdrop ?? '');
  }

  constructor(el: HTMLElement) {
    this.el = el;
    this.kind = KINDS[el.dataset.backdrop ?? ''];
    this.duration = Math.max(0, Number(el.dataset.duration) || 0);
    this.fitted = el.dataset.half === undefined;
    if (!this.fitted) {
      this.cx = +(el.dataset.cx ?? 0);
      this.cy = +(el.dataset.cy ?? 0);
      this.half = +(el.dataset.half ?? 1);
    }
    for (const old of el.querySelectorAll(':scope > canvas.dots')) old.remove();
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'dots';
    this.canvas.setAttribute('aria-hidden', 'true');
    el.prepend(this.canvas);
    CACHE.set(el, this);
    const name = this.kind.file(el);
    if (name === null) this.install({});
    else if (given.has(name)) this.install(given.get(name));
    this.ready = this.state === null && name !== null ? load(name).then((data) => this.install(data)) : Promise.resolve();
  }

  private install(data: unknown): void {
    if (data === null || data === undefined || CACHE.get(this.el) !== this) return;
    this.state = this.kind.prepare(data, this.el);
    this.fit();
    if (this.pending) {
      this.pending = false;
      this.start();
    }
  }

  get view(): View {
    return { cx: this.cx, cy: this.cy, half: this.half };
  }

  get fitsItself(): boolean {
    return true;
  }

  get fittedToDrawing(): boolean {
    return this.fitted;
  }

  get extent(): Extent | null {
    return this.state === null ? null : this.kind.extent(this.state);
  }

  get done(): boolean {
    return this.finished;
  }

  get tracing(): boolean {
    return this.raf !== 0;
  }

  get canvases(): HTMLCanvasElement[] {
    return [this.canvas];
  }

  get span(): number {
    return this.state === null ? 0 : this.kind.span(this.state, this.duration);
  }

  get period(): number {
    return 0;
  }

  viewFitted(box?: Box): View | null {
    const extent = this.extent;
    const b = box ?? { width: this.el.offsetWidth, height: this.el.offsetHeight };
    return extent && b.width > 0 && b.height > 0 ? fittedView(extent, this.kind.margin, b) : null;
  }

  setWindow(view: View | null): void {
    if (view) {
      this.fitted = false;
      ({ cx: this.cx, cy: this.cy, half: this.half } = view);
    } else {
      this.fitted = true;
      this.fittedFor = '';
    }
    this.fit();
  }

  fit(): void {
    const width = this.el.offsetWidth, height = this.el.offsetHeight, r = this.el.getBoundingClientRect();
    if (!width || !height || !r.width) return;
    const design = this.el.closest('section') ? 1 : HEIGHT_OUTSIDE_A_SLIDE / height;
    this.w = width * design;
    this.h = height * design;
    const printed = /print-pdf/.test(location.search) || !!window.Reveal?.isPrintView?.();
    this.sharpness = Math.min(SHARPEST, Math.max(printed ? PRINT_SHARPNESS : 0, (r.width / this.w) * Math.min(devicePixelRatio || 1, 2)));
    const W = Math.max(1, Math.round(this.w * this.sharpness)), H = Math.max(1, Math.round(this.h * this.sharpness));
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
    }
    const key = `${this.w}x${this.h}`;
    if (this.fitted && key !== this.fittedFor) {
      const view = this.viewFitted({ width: this.w, height: this.h });
      if (view) {
        ({ cx: this.cx, cy: this.cy, half: this.half } = view);
        this.fittedFor = key;
      }
    }
    this.redraw();
  }

  redraw(): void {
    if (!this.w) return;
    if (this.raf && this.t0 !== null) this.draw((performance.now() - this.t0) / 1000);
    else if (this.finished) this.draw(Infinity);
    else this.clear();
  }

  private clear(): void {
    const g = this.canvas.getContext('2d');
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private draw(seconds: number): void {
    const g = this.canvas.getContext('2d');
    if (!g || this.state === null || !this.w) return;
    const mode = this.el.ownerDocument.documentElement.dataset.theme ?? '';
    if (!this.colors || mode !== this.mode) {
      this.colors = colorsOf(this.el, g);
      this.mode = mode;
    }
    this.clear();
    g.setTransform(this.sharpness, 0, 0, this.sharpness, 0, 0);
    g.globalAlpha = 1;
    const scale = this.h / 2 / this.half;
    this.kind.draw({ g, state: this.state, colors: this.colors, scale, x0: this.w / 2 - this.cx * scale, y0: this.h / 2 + this.cy * scale }, seconds, this.duration);
  }

  reset(): void {
    this.stop();
    this.pending = false;
    this.t0 = null;
    this.finished = false;
    this.clear();
  }

  start(force = false): void {
    if (!force && Orbits.reduced()) {
      this.complete();
      return;
    }
    if (this.state === null) {
      this.pending = true;
      return;
    }
    if (this.raf || (this.finished && !this.kind.endless)) return;
    const span = this.span;
    this.t0 = performance.now() - (this.finished ? span * 1000 : 0);
    let drawn = -Infinity;
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      const seconds = (now - (this.t0 ?? now)) / 1000;
      if (seconds - drawn < SECONDS_BETWEEN_FRAMES) return;
      drawn = seconds;
      if (seconds >= span) this.finished = true;
      if (this.finished && !this.kind.endless) {
        this.stop();
        this.draw(Infinity);
      } else this.draw(seconds);
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
    this.canvas.remove();
    if (CACHE.get(this.el) === this) CACHE.delete(this.el);
  }

  glow(): void {}

  private stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
