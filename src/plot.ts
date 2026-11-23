import { plotTex, prefetch, setPlotText } from './drawn-text.ts';

type Pair = [number, number];
type Anchor = 'start' | 'middle' | 'end';
type Kind = 'points' | 'trace' | 'label' | 'events';

export type Tick = { at: number; text: string };
export type Scale = 'linear' | 'asinh';
export type Axis = { range: Pair; ticks: Tick[]; title: string; scale: Scale; unit: number };
type Item = { id: string | null; tone: string; cls: string[]; delay: number };
export type Region = Item & { points: Pair[]; opacity: number; iris: number; from: Pair | null };
export type Curve = Item & { points: Pair[] | null; circle: [number, number, number] | null; width: number; dash: number[] | null; wipe: number };
export type Label = Item & { at: Pair; text: string; anchor: Anchor; dx: number; dy: number };
export type Margin = [number, number, number, number];
export type Panel = { id: string; x: Axis; y: Axis; equal: boolean; axes: boolean; title: string; regions: Region[]; curves: Curve[]; labels: Label[]; size: number; margin: Margin };
export type PanelPatch = Partial<Pick<Panel, 'x' | 'y' | 'title' | 'regions' | 'curves' | 'labels'>>;
export type Mark = Item & { id: string; panel: string; kind: Kind; size: number; width: number; hollow: boolean; ghost: boolean; fade: number; anchor: Anchor; dx: number; dy: number };
export type PlotEvent = { frame: number; at: Pair; text: string };
export type LabelData = { at: Pair[]; text: string[] };
export type TraceData = { points: Pair[]; ghost: number; tones: string[] | null };
export type MarkData = number[][] | TraceData | LabelData | PlotEvent[];
export type Tab = { name: string; label: string; values: number[]; times: number[] | null; data: Record<string, MarkData>; active: string[][] | null; panels: Record<string, PanelPatch> };
export type Plot = { parameter: { label: string; digits: number }; duration: number; hold: number; fade: number; layout: 'row' | 'column' | null; panels: Panel[]; marks: Mark[]; tabs: Tab[] };

const KINDS: Kind[] = ['points', 'trace', 'label', 'events'];
const PATCH = ['x', 'y', 'title', 'regions', 'curves', 'labels'];
const MARGIN: Margin = [52, 20, 84, 76];
const WRITTEN = new WeakMap<object, string>();

function written<T extends object>(o: T, path: string): T {
  WRITTEN.set(o, path);
  return o;
}

const pathOf = (o: object | undefined, key: string): string | null => {
  const at = o ? WRITTEN.get(o) : undefined;
  return at === undefined ? null : `${at}.${key}`;
};

function fail(path: string, what: string): never {
  throw new Error(`${path}: ${what}`);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown, path: string, fallback?: number): number {
  if (v === undefined && fallback !== undefined) return fallback;
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, 'a number is expected');
  return v;
}

function str(v: unknown, path: string, fallback?: string): string {
  if (v === undefined && fallback !== undefined) return fallback;
  if (typeof v !== 'string') fail(path, 'a string is expected');
  return v;
}

function list(v: unknown, path: string, fallback?: unknown[]): unknown[] {
  if (v === undefined && fallback !== undefined) return fallback;
  if (!Array.isArray(v)) fail(path, 'a list is expected');
  return v;
}

function pair(v: unknown, path: string): Pair {
  const a = list(v, path);
  if (a.length !== 2) fail(path, 'a pair [x, y] is expected');
  return [num(a[0], `${path}[0]`), num(a[1], `${path}[1]`)];
}

const pairs = (v: unknown, path: string): Pair[] => list(v, path).map((p, i) => pair(p, `${path}[${i}]`));

function anchor(v: unknown, path: string): Anchor {
  const a = str(v, path, 'middle');
  if (a !== 'start' && a !== 'middle' && a !== 'end') fail(path, 'start, middle, or end is expected');
  return a;
}

function item(o: Record<string, unknown>, path: string, tone: string): Item {
  const cls = str(o.class, `${path}.class`, '').split(/\s+/).filter(Boolean);
  const delay = seconds(o.delay, `${path}.delay`);
  return { id: o.id === undefined ? null : str(o.id, `${path}.id`), tone: str(o.tone, `${path}.tone`, tone), cls, delay };
}

function seconds(v: unknown, path: string): number {
  const s = num(v, path, 0);
  if (!(s >= 0)) fail(path, 'a number of seconds, at least 0, is expected');
  return s;
}

function axis(v: unknown, path: string): Axis {
  if (!isObject(v)) fail(path, 'an axis { range, ticks, title } is expected');
  const range = pair(v.range, `${path}.range`);
  if (!(range[1] > range[0])) fail(`${path}.range`, 'the second end must be larger than the first');
  const scale = str(v.scale, `${path}.scale`, 'linear');
  if (scale !== 'linear' && scale !== 'asinh') fail(`${path}.scale`, 'linear or asinh is expected');
  const unit = num(v.unit, `${path}.unit`, 1);
  if (!(unit > 0)) fail(`${path}.unit`, 'a positive number is expected');
  const ticks = list(v.ticks, `${path}.ticks`, []).map((t, i): Tick => {
    const p = `${path}.ticks[${i}]`;
    if (typeof t === 'number') return { at: num(t, p), text: formatNumber(t) };
    if (!isObject(t)) fail(p, 'a number or a tick { at, text } is expected');
    const at = num(t.at, `${p}.at`);
    const tick = { at, text: str(t.text, `${p}.text`, formatNumber(at)) };
    return t.text === undefined ? tick : written(tick, p);
  });
  return written({ range, ticks, title: str(v.title, `${path}.title`, ''), scale, unit }, path);
}

export function scaled(a: Axis, v: number): number {
  return a.scale === 'asinh' ? Math.asinh(v / a.unit) : v;
}

function regions(v: unknown, path: string): Region[] {
  return list(v, path, []).map((r, i) => {
    const p = `${path}[${i}]`;
    if (!isObject(r)) fail(p, 'a region is expected');
    const from = r.from === undefined ? null : pair(r.from, `${p}.from`);
    return { ...item(r, p, 'violet'), points: pairs(r.points, `${p}.points`), opacity: num(r.opacity, `${p}.opacity`, 0.12), iris: seconds(r.iris, `${p}.iris`), from };
  });
}

function curves(v: unknown, path: string): Curve[] {
  return list(v, path, []).map((c, i) => {
    const p = `${path}[${i}]`;
    if (!isObject(c)) fail(p, 'a curve is expected');
    let circle: [number, number, number] | null = null;
    if (c.circle !== undefined) {
      const a = list(c.circle, `${p}.circle`);
      if (a.length !== 3) fail(`${p}.circle`, 'a circle [cx, cy, r] is expected');
      circle = [num(a[0], `${p}.circle[0]`), num(a[1], `${p}.circle[1]`), num(a[2], `${p}.circle[2]`)];
    } else if (c.points === undefined) fail(p, 'points or circle is expected');
    const dash = c.dash === undefined ? null : list(c.dash, `${p}.dash`).map((d, j) => num(d, `${p}.dash[${j}]`));
    return { ...item(c, p, 'subtle'), points: circle ? null : pairs(c.points, `${p}.points`), circle, width: num(c.width, `${p}.width`, 2), dash, wipe: seconds(c.wipe, `${p}.wipe`) };
  });
}

function labels(v: unknown, path: string): Label[] {
  return list(v, path, []).map((l, i) => {
    const p = `${path}[${i}]`;
    if (!isObject(l)) fail(p, 'a label is expected');
    return written({ ...item(l, p, 'subtle'), at: pair(l.at, `${p}.at`), text: str(l.text, `${p}.text`), anchor: anchor(l.anchor, `${p}.anchor`), dx: num(l.dx, `${p}.dx`, 0), dy: num(l.dy, `${p}.dy`, 0) }, p);
  });
}

function panel(v: unknown, path: string): Panel {
  if (!isObject(v)) fail(path, 'a panel is expected');
  let margin: Margin = [...MARGIN];
  if (v.margin !== undefined) {
    const m = list(v.margin, `${path}.margin`).map((x, i) => num(x, `${path}.margin[${i}]`));
    if (m.length !== 4) fail(`${path}.margin`, 'a margin [top, right, bottom, left] is expected');
    margin = [m[0], m[1], m[2], m[3]];
  }
  const size = num(v.size, `${path}.size`, 1);
  if (!(size > 0)) fail(`${path}.size`, 'a positive number is expected');
  return written({
    id: str(v.id, `${path}.id`),
    x: axis(v.x, `${path}.x`),
    y: axis(v.y, `${path}.y`),
    equal: v.equal === true,
    axes: v.axes !== false,
    title: str(v.title, `${path}.title`, ''),
    regions: regions(v.regions, `${path}.regions`),
    curves: curves(v.curves, `${path}.curves`),
    labels: labels(v.labels, `${path}.labels`),
    size,
    margin,
  }, path);
}

function patch(v: unknown, path: string): PanelPatch {
  if (!isObject(v)) fail(path, 'a panel is expected');
  for (const key of Object.keys(v)) if (!PATCH.includes(key)) fail(`${path}.${key}`, `one of ${PATCH.join(', ')} is expected`);
  const out: PanelPatch = {};
  if (v.x !== undefined) out.x = axis(v.x, `${path}.x`);
  if (v.y !== undefined) out.y = axis(v.y, `${path}.y`);
  if (v.title !== undefined) out.title = str(v.title, `${path}.title`);
  if (v.regions !== undefined) out.regions = regions(v.regions, `${path}.regions`);
  if (v.curves !== undefined) out.curves = curves(v.curves, `${path}.curves`);
  if (v.labels !== undefined) out.labels = labels(v.labels, `${path}.labels`);
  return written(out, path);
}

function markData(m: Mark, v: unknown, frames: number, path: string): MarkData {
  const perFrame = (n: number) => n === 1 || n === frames || fail(path, `${n} frames are given, and the tab has ${frames} values`);
  if (m.kind === 'points') {
    const a = list(v, path).map((f, i) => list(f, `${path}[${i}]`).map((x, j) => num(x, `${path}[${i}][${j}]`)));
    perFrame(a.length);
    a.forEach((f, i) => f.length % 2 === 0 || fail(`${path}[${i}]`, 'pairs of x and y are expected'));
    return a;
  }
  if (m.kind === 'trace') {
    const given = isObject(v) ? v : { points: v };
    const points = pairs(given.points, isObject(v) ? `${path}.points` : path);
    perFrame(points.length);
    const ghost = num(given.ghost, `${path}.ghost`, points.length - 1);
    if (!Number.isInteger(ghost) || ghost < 0 || ghost > points.length - 1) fail(`${path}.ghost`, `a frame from 0 to ${points.length - 1} is expected`);
    const tones = given.tones === undefined ? null : list(given.tones, `${path}.tones`).map((t, i) => str(t, `${path}.tones[${i}]`));
    if (tones && tones.length !== points.length) fail(`${path}.tones`, `${tones.length} tones are given, and the trace has ${points.length} points`);
    return { points, ghost, tones };
  }
  if (m.kind === 'label') {
    if (!isObject(v)) fail(path, 'a label { at, text } is expected');
    const at = Array.isArray(v.at) && Array.isArray(v.at[0]) ? pairs(v.at, `${path}.at`) : [pair(v.at, `${path}.at`)];
    const text = Array.isArray(v.text) ? written(v.text.map((t, i) => str(t, `${path}.text[${i}]`)), `${path}.text`) : [str(v.text, `${path}.text`)];
    perFrame(at.length);
    perFrame(text.length);
    return written({ at, text }, path);
  }
  return list(v, path).map((e, i) => {
    const p = `${path}[${i}]`;
    if (!isObject(e)) fail(p, 'an event { frame, at, text } is expected');
    const frame = num(e.frame, `${p}.frame`);
    if (frame < 0 || frame > frames - 1) fail(`${p}.frame`, `a frame from 0 to ${frames - 1} is expected`);
    return written({ frame, at: pair(e.at, `${p}.at`), text: str(e.text, `${p}.text`, '') }, p);
  });
}

export function parsePlot(input: unknown): Plot {
  const v = typeof input === 'string' ? (JSON.parse(input) as unknown) : input;
  if (!isObject(v)) fail('plot', 'an object is expected');
  const panels = list(v.panels, 'panels').map((p, i) => panel(p, `panels[${i}]`));
  if (!panels.length) fail('panels', 'at least one panel is expected');
  const ids = new Set(panels.map((p) => p.id));
  if (ids.size !== panels.length) fail('panels', 'the ids of the panels must differ');
  const marks = list(v.marks, 'marks', []).map((m, i): Mark => {
    const p = `marks[${i}]`;
    if (!isObject(m)) fail(p, 'a mark is expected');
    const kind = str(m.kind, `${p}.kind`) as Kind;
    if (!KINDS.includes(kind)) fail(`${p}.kind`, `one of ${KINDS.join(', ')} is expected`);
    const at = str(m.panel, `${p}.panel`);
    if (!ids.has(at)) fail(`${p}.panel`, `the panel ${at} is not declared`);
    const base = item(m, p, 'accent');
    return {
      ...base,
      id: str(m.id, `${p}.id`),
      panel: at,
      kind,
      tone: base.tone,
      size: num(m.size, `${p}.size`, kind === 'events' ? 16 : 10),
      width: num(m.width, `${p}.width`, 3),
      hollow: m.hollow === true,
      ghost: m.ghost !== false,
      fade: seconds(m.fade, `${p}.fade`),
      anchor: anchor(m.anchor, `${p}.anchor`),
      dx: num(m.dx, `${p}.dx`, 0),
      dy: num(m.dy, `${p}.dy`, 0),
    };
  });
  const tabs = list(v.tabs, 'tabs').map((t, i): Tab => {
    const p = `tabs[${i}]`;
    if (!isObject(t)) fail(p, 'a tab is expected');
    const name = str(t.name, `${p}.name`);
    const values = list(t.values, `${p}.values`).map((x, j) => num(x, `${p}.values[${j}]`));
    if (!values.length) fail(`${p}.values`, 'at least one value is expected');
    const raw = t.data === undefined ? {} : t.data;
    if (!isObject(raw)) fail(`${p}.data`, 'an object of mark ids is expected');
    const data: Record<string, MarkData> = {};
    for (const key of Object.keys(raw)) {
      const m = marks.find((mark) => mark.id === key) ?? fail(`${p}.data.${key}`, 'the mark is not declared');
      data[key] = markData(m, raw[key], values.length, `${p}.data.${key}`);
    }
    let times: number[] | null = null;
    if (t.times !== undefined) {
      const given = list(t.times, `${p}.times`).map((x, j) => num(x, `${p}.times[${j}]`));
      if (given.length !== values.length) fail(`${p}.times`, `${given.length} times are given, and the tab has ${values.length} values`);
      if (given[0] !== 0 || given.some((x, j) => j > 0 && !(x > given[j - 1]))) fail(`${p}.times`, 'times that increase from 0 are expected');
      times = given;
    }
    let active: string[][] | null = null;
    if (t.active !== undefined) {
      active = list(t.active, `${p}.active`).map((f, j) => (typeof f === 'string' ? [f] : list(f, `${p}.active[${j}]`).map((s, k) => str(s, `${p}.active[${j}][${k}]`))));
      if (active.length !== values.length) fail(`${p}.active`, `${active.length} frames are given, and the tab has ${values.length} values`);
    }
    const given = t.panels === undefined ? {} : t.panels;
    if (!isObject(given)) fail(`${p}.panels`, 'an object of panel ids is expected');
    const patches: Record<string, PanelPatch> = {};
    for (const key of Object.keys(given)) {
      if (!ids.has(key)) fail(`${p}.panels.${key}`, `the panel ${key} is not declared`);
      patches[key] = patch(given[key], `${p}.panels.${key}`);
    }
    return written({ name, label: str(t.label, `${p}.label`, name), values, times, data, active, panels: patches }, p);
  });
  if (!tabs.length) fail('tabs', 'at least one tab is expected');
  const parameter = isObject(v.parameter) ? v.parameter : {};
  const layout = v.layout === undefined ? null : str(v.layout, 'layout');
  if (layout !== null && layout !== 'row' && layout !== 'column') fail('layout', 'row or column is expected');
  return {
    parameter: written({ label: str(parameter.label, 'parameter.label', ''), digits: num(parameter.digits, 'parameter.digits', 3) }, 'parameter'),
    duration: num(v.duration, 'duration', 8),
    hold: num(v.hold, 'hold', 1),
    fade: num(v.fade, 'fade', 0.5),
    layout,
    panels,
    marks,
    tabs,
  };
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export function valueAt(values: number[], u: number): number {
  const n = values.length;
  if (n === 1) return values[0];
  const v = clamp(u, 0, n - 1), i = Math.min(n - 2, Math.floor(v)), f = v - i;
  return values[i] + f * (values[i + 1] - values[i]);
}

export function nearest<T>(frames: T[], u: number): T {
  return frames[clamp(Math.round(u), 0, frames.length - 1)];
}

export function framesAt(frames: number[][], u: number): number[] {
  const n = frames.length;
  if (n === 1) return frames[0];
  const v = clamp(u, 0, n - 1), i = Math.min(n - 2, Math.floor(v)), f = v - i;
  const a = frames[i], b = frames[i + 1];
  if (a.length !== b.length) return nearest(frames, v);
  return a.map((x, k) => x + f * (b[k] - x));
}

export function traceTo(path: Pair[], u: number): Pair[] {
  const n = path.length, v = clamp(u, 0, n - 1), i = Math.floor(v), f = v - i;
  const out = path.slice(0, i + 1);
  if (f > 0 && i < n - 1) out.push([path[i][0] + f * (path[i + 1][0] - path[i][0]), path[i][1] + f * (path[i + 1][1] - path[i][1])]);
  return out;
}

export function passLength(n: number, duration: number, times: number[] | null): number {
  return times ? times[n - 1] : duration;
}

export function timeAt(u: number, n: number, duration: number, times: number[] | null): number {
  if (n < 2) return 0;
  const v = clamp(u, 0, n - 1);
  if (!times) return (v / (n - 1)) * duration;
  const i = Math.min(n - 2, Math.floor(v));
  return times[i] + (v - i) * (times[i + 1] - times[i]);
}

export function frameAt(tau: number, n: number, duration: number, times: number[] | null): number {
  if (n < 2) return 0;
  if (!times) return clamp(tau / duration, 0, 1) * (n - 1);
  if (!(tau > 0)) return 0;
  if (tau >= times[n - 1]) return n - 1;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (times[m] <= tau) lo = m;
    else hi = m;
  }
  return lo + (tau - times[lo]) / (times[lo + 1] - times[lo]);
}

export function loopFrame(t: number, n: number, duration: number, hold: number, times: number[] | null = null): number {
  if (n < 2) return 0;
  const period = passLength(n, duration, times) + hold;
  const tau = ((t % period) + period) % period;
  return frameAt(tau, n, duration, times);
}

export function loopFade(t: number, length: number, hold: number, fade: number): number {
  const f = Math.min(fade, length), period = length + hold;
  if (!(f > 0) || !(period > 0) || t < 0) return 1;
  const pass = Math.floor(t / period), tau = t - pass * period;
  const a = pass > 0 && tau < f ? tau / f : 1;
  return a * a * (3 - 2 * a);
}

const MINUS = '−';

export function formatNumber(x: number, digits?: number): string {
  const s = digits === undefined ? String(Number(x.toPrecision(6))) : x.toFixed(digits);
  return s.replace(/^-(?=.*[1-9])/, MINUS).replace(/^-/, '');
}

const panelTexts = (p: PanelPatch) => [p.title, p.x?.title, p.y?.title, ...[...(p.x?.ticks ?? []), ...(p.y?.ticks ?? []), ...(p.labels ?? [])].map((t) => t.text)];

export function plotTexts(plot: Plot): string[] {
  const marks = (tab: Tab) => plot.marks.flatMap((m) => {
    const data = tab.data[m.id];
    if (m.kind === 'label') return (data as LabelData | undefined)?.text ?? [];
    return m.kind === 'events' ? ((data as PlotEvent[] | undefined) ?? []).map((e) => e.text) : [];
  });
  const texts = [plot.parameter.label, ...plot.panels.flatMap(panelTexts), ...plot.tabs.flatMap((t) => [t.label, ...Object.values(t.panels).flatMap(panelTexts), ...marks(t)])];
  return [...new Set(texts.filter((s): s is string => !!s))];
}

const SVG = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  parent?.append(el);
  return el;
}

const circlePoints = ([cx, cy, r]: [number, number, number]): Pair[] =>
  Array.from({ length: 181 }, (_, i) => [cx + r * Math.cos((i * Math.PI) / 90), cy + r * Math.sin((i * Math.PI) / 90)]);

const toneColor = (tone: string) => (/^[a-z][a-z0-9-]*$/.test(tone) ? `var(--${tone})` : tone);

const words = (s: string | undefined | null) => (s ?? '').split(/\s+/).filter(Boolean);

function mark(el: HTMLElement, from: string | null): void {
  if (from) el.dataset.plotText = from;
  else delete el.dataset.plotText;
}

type Box = { x: number; y: number; w: number; h: number; x0: number; y0: number; sx: number; sy: number; panel: Panel };

const GAP = 56;

export function cells(sizes: number[], total: number, gap: number): Pair[] {
  const free = total - gap * (sizes.length - 1), sum = sizes.reduce((a, b) => a + b, 0);
  let at = 0;
  return sizes.map((size) => {
    const cell: Pair = [at, (free * size) / sum];
    at += cell[1] + gap;
    return cell;
  });
}

let serial = 0;

const reduced = () => typeof window === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches;

const CACHE = new WeakMap<HTMLElement, PlotView>();

export class PlotView {
  readonly el: HTMLElement;
  private spec: Plot | null = null;
  private panels: Panel[] = [];
  private tab = 0;
  private u = 0;
  private raf = 0;
  private t0 = 0;
  private W = 0;
  private H = 0;
  private uid = ++serial;
  private body!: HTMLElement;
  private area!: HTMLElement;
  private svgEl!: SVGSVGElement;
  private overlay!: HTMLElement;
  private tabButtons: { b: HTMLButtonElement; i: number }[] = [];
  private offered: number[] = [];
  private playButton!: HTMLButtonElement;
  private scrub!: HTMLElement;
  private fill!: HTMLElement;
  private knob!: HTMLElement;
  private ticks!: HTMLElement;
  private value!: HTMLElement;
  private boxes = new Map<string, Box>();
  private gated: { node: Element; names: string[] }[] = [];
  private emphasized: { node: Element; id: string }[] = [];
  private drawers: ((u: number) => void)[] = [];
  private fade = 1;
  private faders: SVGElement[] = [];
  private fadeLabels: HTMLElement[] = [];
  private held: (SVGElement | HTMLElement)[] = [];
  private pass = 0;
  private eventFrames: { frame: number; names: string[]; tone: string }[] = [];
  private emphasis = new Set<string>();
  private shown = new Set<string>();
  private steps = new Set<string>();
  private gone = new Set<string>();
  private stepTab: string | null = null;
  private cue: 'none' | 'held' | 'shown' = 'none';
  private live = false;
  private once = false;
  private resized = new ResizeObserver(() => this.fit());

  constructor(el: HTMLElement) {
    this.el = el;
    CACHE.set(el, this);
    this.load(null);
  }

  reload(text: string | null = null): void {
    const tab = this.spec?.tabs[this.tab].name;
    this.pause();
    this.spec = null;
    this.W = this.H = 0;
    this.tabButtons = [];
    this.load(text);
    if (!this.spec) return;
    const kept = this.plot.tabs.findIndex((t) => t.name === tab);
    if (this.offered.includes(kept)) this.tab = kept;
    this.markTabs();
    this.u = clamp(this.u, 0, this.frames - 1);
    this.fit();
  }

  private load(text: string | null): void {
    const el = this.el;
    for (const old of el.querySelectorAll(':scope > .plot-body, :scope > .plot-error')) old.remove();
    try {
      const id = el.dataset.plot ?? '';
      const block = id ? document.getElementById(id) : null;
      if (text === null && !block) throw new Error(`the JSON script with the id "${id}" is not found`);
      this.spec = parsePlot(text ?? block?.textContent ?? '');
    } catch (error) {
      const message = `plot ${el.dataset.plot ?? ''}: ${(error as Error).message}`;
      const box = document.createElement('div');
      box.className = 'plot-error';
      box.textContent = message;
      el.append(box);
      console.error(message);
      return;
    }
    prefetch(plotTexts(this.spec).map(plotTex));
    const only = words(el.dataset.plotPanels);
    this.panels = only.length ? this.spec.panels.filter((p) => only.includes(p.id)) : this.spec.panels;
    const names = words(el.dataset.plotTabs);
    this.offered = this.spec.tabs.map((_, i) => i).filter((i) => !names.length || names.includes(this.spec!.tabs[i].name));
    if (!this.offered.length) this.offered = [0];
    const start = this.spec.tabs.findIndex((t) => t.name === el.dataset.plotTab);
    this.tab = start >= 0 ? start : this.offered[0];
    this.emphasis = new Set(this.spec.tabs.flatMap((t) => t.active?.flat() ?? []));
    this.build();
  }

  private get plot(): Plot {
    return this.spec as Plot;
  }

  private get frames(): number {
    return this.plot.tabs[this.tab].values.length;
  }

  private get length(): number {
    return passLength(this.frames, this.plot.duration, this.plot.tabs[this.tab].times);
  }

  private timeOf(u: number): number {
    return timeAt(u, this.frames, this.plot.duration, this.plot.tabs[this.tab].times);
  }

  private frameOf(tau: number): number {
    return frameAt(tau, this.frames, this.plot.duration, this.plot.tabs[this.tab].times);
  }

  private build(): void {
    const plot = this.plot;
    this.body = document.createElement('div');
    this.body.className = 'plot-body';
    if (this.offered.length > 1) {
      const bar = document.createElement('div');
      bar.className = 'plot-tabs';
      bar.setAttribute('role', 'tablist');
      this.tabButtons = this.offered.map((i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'tab');
        setPlotText(b, plot.tabs[i].label);
        mark(b, pathOf(plot.tabs[i], 'label'));
        b.addEventListener('click', () => { b.blur(); this.setTab(i); });
        bar.append(b);
        return { b, i };
      });
      this.body.append(bar);
    }
    this.area = document.createElement('div');
    this.area.className = 'plot-area';
    this.svgEl = svg('svg', { 'aria-hidden': 'true' });
    this.overlay = document.createElement('div');
    this.overlay.className = 'plot-labels';
    this.area.append(this.svgEl, this.overlay);
    this.resized.disconnect();
    this.resized.observe(this.area);
    this.body.append(this.area);

    const controls = document.createElement('div');
    controls.className = 'plot-bar';
    this.playButton = document.createElement('button');
    this.playButton.type = 'button';
    this.playButton.className = 'plot-play';
    this.playButton.addEventListener('click', () => {
      this.playButton.blur();
      if (this.raf) this.pause();
      else this.play();
    });
    this.scrub = document.createElement('div');
    this.scrub.className = 'plot-scrub';
    this.scrub.setAttribute('data-prevent-swipe', '');
    this.fill = document.createElement('div');
    this.fill.className = 'plot-fill';
    this.knob = document.createElement('div');
    this.knob.className = 'plot-knob';
    this.ticks = document.createElement('div');
    this.ticks.className = 'plot-ticks';
    this.scrub.append(this.ticks, this.fill, this.knob);
    const seek = (ev: PointerEvent) => {
      const r = this.scrub.getBoundingClientRect();
      if (!r.width) return;
      this.u = this.frameOf(clamp((ev.clientX - r.left) / r.width, 0, 1) * this.length);
      this.draw();
    };
    this.scrub.addEventListener('pointerdown', (ev) => {
      this.pause();
      this.scrub.setPointerCapture(ev.pointerId);
      seek(ev);
    });
    this.scrub.addEventListener('pointermove', (ev) => { if (this.scrub.hasPointerCapture(ev.pointerId)) seek(ev); });
    const readout = document.createElement('div');
    readout.className = 'plot-readout';
    if (plot.parameter.label) {
      const name = document.createElement('span');
      setPlotText(name, plot.parameter.label);
      mark(name, pathOf(plot.parameter, 'label'));
      readout.append(name, ' = ');
    }
    this.value = document.createElement('span');
    this.value.className = 'plot-value';
    readout.append(this.value);
    controls.append(this.playButton, this.scrub, readout);
    this.body.append(controls);
    this.el.append(this.body);
    this.setPlaying(false);
    this.markTabs();
  }

  private setPlaying(on: boolean): void {
    if (!this.spec) return;
    this.playButton.setAttribute('aria-label', on ? 'Pause' : 'Play');
    this.playButton.classList.toggle('playing', on);
  }

  private markTabs(): void {
    for (const { b, i } of this.tabButtons) b.setAttribute('aria-selected', String(i === this.tab));
  }

  fit(): void {
    if (!this.spec) return;
    const W = this.area.offsetWidth, H = this.area.offsetHeight;
    if (!W || !H) return;
    if (W === this.W && H === this.H) return;
    this.W = W;
    this.H = H;
    this.svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this.layout();
    this.drawStatic();
    this.buildMarks();
  }

  private panelsNow(): Panel[] {
    const patches = this.plot.tabs[this.tab].panels;
    return this.panels.map((p) => {
      const merged = { ...p, ...patches[p.id] };
      const at = WRITTEN.get(patches[p.id]?.title === undefined ? p : patches[p.id]);
      return at === undefined ? merged : written(merged, at);
    });
  }

  private layout(): void {
    const panels = this.panelsNow(), row = (this.plot.layout ?? (this.W >= this.H ? 'row' : 'column')) === 'row';
    const along = cells(panels.map((p) => p.size), row ? this.W : this.H, GAP);
    this.boxes.clear();
    panels.forEach((p, i) => {
      const [at, share] = along[i];
      const cx = row ? at : 0, cy = row ? 0 : at, cw = row ? share : this.W, ch = row ? this.H : share;
      const [top, right, bottom, left] = p.margin;
      let x = cx + left, y = cy + top, w = cw - left - right, h = ch - top - bottom;
      const x0 = scaled(p.x, p.x.range[0]), y0 = scaled(p.y, p.y.range[0]);
      const dx = scaled(p.x, p.x.range[1]) - x0, dy = scaled(p.y, p.y.range[1]) - y0;
      if (p.equal) {
        const s = Math.min(w / dx, h / dy);
        x += (w - s * dx) / 2;
        y += (h - s * dy) / 2;
        w = s * dx;
        h = s * dy;
      }
      this.boxes.set(p.id, { x, y, w, h, x0, y0, sx: w / dx, sy: h / dy, panel: p });
    });
  }

  private XS(b: Box, x: number): number {
    return b.x + (x - b.x0) * b.sx;
  }

  private YS(b: Box, y: number): number {
    return b.y + b.h - (y - b.y0) * b.sy;
  }

  private X(b: Box, x: number): number {
    return this.XS(b, scaled(b.panel.x, x));
  }

  private Y(b: Box, y: number): number {
    return this.YS(b, scaled(b.panel.y, y));
  }

  private toAxes(b: Box, [x, y]: Pair): Pair {
    return [scaled(b.panel.x, x), scaled(b.panel.y, y)];
  }

  private path(b: Box, pts: Pair[]): string {
    return this.pathS(b, pts.map((p) => this.toAxes(b, p)));
  }

  private pathS(b: Box, pts: Pair[]): string {
    return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${this.XS(b, x).toFixed(1)} ${this.YS(b, y).toFixed(1)}`).join('');
  }

  private label(text: string, from: string | null, left: number, top: number, a: Anchor, cls: string, names: string[], tone?: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `plot-label ${cls}`.trim();
    setPlotText(el, text);
    mark(el, from);
    this.place(el, left, top, a);
    if (tone) el.style.color = toneColor(tone);
    this.overlay.append(el);
    this.gate(el, names);
    return el;
  }

  private place(el: HTMLElement, left: number, top: number, a: Anchor): void {
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.transform = `translate(${a === 'start' ? 0 : a === 'end' ? -100 : -50}%, -50%)`;
  }

  private gate(node: Element, names: (string | null)[]): void {
    const n = names.filter((s): s is string => !!s);
    if (n.length) this.gated.push({ node, names: n });
  }

  private styleItem(node: Element, it: Item, names: (string | null)[]): void {
    (node as HTMLElement | SVGElement).style.color = toneColor(it.tone);
    node.classList.add(...it.cls);
    if (it.delay > 0) {
      node.classList.add('plot-delayed');
      (node as HTMLElement | SVGElement).style.setProperty('--plot-delay', `${it.delay}s`);
    }
    this.gate(node, names);
    if (it.id) {
      node.setAttribute('data-plot-id', it.id);
      this.emphasized.push({ node, id: it.id });
    }
  }

  private drawStatic(): void {
    this.svgEl.replaceChildren();
    this.overlay.replaceChildren();
    this.gated = [];
    this.emphasized = [];
    const defs = svg('defs', {}, this.svgEl);
    for (const b of this.boxes.values()) {
      const p = b.panel;
      const g = svg('g', { class: 'plot-panel' }, this.svgEl);
      this.gate(g, [p.id]);
      for (const [suffix, pad] of [['', 0], ['-marks', 14]] as const) {
        const clip = svg('clipPath', { id: `plot-${this.uid}-${p.id}${suffix}` }, defs);
        svg('rect', { x: b.x - pad, y: b.y - pad, width: b.w + 2 * pad, height: b.h + 2 * pad }, clip);
      }
      const statics = svg('g', { 'clip-path': `url(#plot-${this.uid}-${p.id})` }, g);
      p.regions.forEach((r, k) => {
        const d = `${this.path(b, r.points)}Z`;
        if (!(r.iris > 0)) {
          this.styleItem(svg('path', { class: 'plot-region', d, 'fill-opacity': r.opacity }, statics), r, [p.id, r.id]);
          return;
        }
        const id = `plot-${this.uid}-${p.id}-iris-${k}`;
        svg('path', { d }, svg('clipPath', { id }, defs));
        const xs = r.points.map((q) => clamp(this.X(b, q[0]), b.x, b.x + b.w)), ys = r.points.map((q) => clamp(this.Y(b, q[1]), b.y, b.y + b.h));
        const [fx, fy] = r.from ?? [r.points.reduce((s, q) => s + q[0], 0) / r.points.length, r.points.reduce((s, q) => s + q[1], 0) / r.points.length];
        const X = this.X(b, fx), Y = this.Y(b, fy);
        const R = Math.max(...[Math.min(...xs), Math.max(...xs)].flatMap((x) => [Math.min(...ys), Math.max(...ys)].map((y) => Math.hypot(x - X, y - Y))));
        const disk = svg('circle', { class: 'plot-region plot-iris', cx: X.toFixed(1), cy: Y.toFixed(1), r: (R + 2).toFixed(1), 'fill-opacity': r.opacity }, svg('g', { 'clip-path': `url(#${id})` }, statics));
        disk.style.transformOrigin = `${X.toFixed(1)}px ${Y.toFixed(1)}px`;
        disk.style.setProperty('--plot-iris', `${r.iris}s`);
        this.styleItem(disk, r, [p.id, r.id]);
      });
      for (const [k, c] of p.curves.entries()) {
        const attrs: Record<string, string | number> = { class: 'plot-curve', 'stroke-width': c.width };
        if (c.dash) attrs['stroke-dasharray'] = c.dash.join(' ');
        const linear = p.x.scale === 'linear' && p.y.scale === 'linear';
        const node = c.circle && linear
          ? svg('ellipse', { ...attrs, cx: this.X(b, c.circle[0]), cy: this.Y(b, c.circle[1]), rx: c.circle[2] * b.sx, ry: c.circle[2] * b.sy }, statics)
          : svg('path', { ...attrs, d: this.path(b, c.circle ? circlePoints(c.circle) : (c.points ?? [])) }, statics);
        let wiped: Element | null = null;
        if (c.wipe > 0 && c.dash) {
          const id = `plot-${this.uid}-${p.id}-wipe-${k}`, pad = 14;
          const mask = svg('mask', { id, maskUnits: 'userSpaceOnUse', x: b.x - pad, y: b.y - pad, width: b.w + 2 * pad, height: b.h + 2 * pad }, defs);
          wiped = mask.appendChild(node.cloneNode() as Element);
          for (const name of ['class', 'stroke-dasharray']) wiped.removeAttribute(name);
          for (const [name, value] of [['fill', 'none'], ['stroke', 'white'], ['stroke-width', String(c.width + 4)]]) wiped.setAttribute(name, value);
          node.setAttribute('mask', `url(#${id})`);
        } else if (c.wipe > 0) wiped = node;
        if (wiped) {
          wiped.setAttribute('pathLength', '1');
          wiped.classList.add('plot-wipe');
          (wiped as SVGElement).style.setProperty('--plot-wipe', `${c.wipe}s`);
          if (wiped !== node) {
            if (c.delay > 0) (wiped as SVGElement).style.setProperty('--plot-delay', `${c.delay}s`);
            this.gate(wiped, [p.id, c.id]);
          }
        }
        this.styleItem(node, c, [p.id, c.id]);
      }
      if (p.axes) {
        const axes = svg('g', { class: 'plot-axes' }, g);
        svg('path', { d: `M${b.x} ${b.y}V${b.y + b.h}H${b.x + b.w}` }, axes);
        for (const t of p.x.ticks) {
          const X = this.X(b, t.at);
          svg('path', { d: `M${X} ${b.y + b.h}v10` }, axes);
          this.label(t.text, pathOf(t, 'text'), X, b.y + b.h + 32, 'middle', 'plot-tick', [p.id]);
        }
        for (const t of p.y.ticks) {
          const Y = this.Y(b, t.at);
          svg('path', { d: `M${b.x} ${Y}h-10` }, axes);
          this.label(t.text, pathOf(t, 'text'), b.x - 18, Y, 'end', 'plot-tick', [p.id]);
        }
        if (p.x.title) this.label(p.x.title, pathOf(p.x, 'title'), b.x + b.w / 2, b.y + b.h + 70, 'middle', 'plot-title', [p.id]);
        if (p.y.title) this.label(p.y.title, pathOf(p.y, 'title'), b.x, b.y - 30, 'middle', 'plot-title', [p.id]);
      }
      if (p.title) this.label(p.title, pathOf(p, 'title'), b.x + b.w, b.y - 30, 'end', 'plot-title', [p.id]);
      for (const l of p.labels) {
        const node = this.label(l.text, pathOf(l, 'text'), this.X(b, l.at[0]) + l.dx, this.Y(b, l.at[1]) + l.dy, l.anchor, '', []);
        this.styleItem(node, l, [p.id, l.id]);
      }
      svg('g', { class: 'plot-marks', 'data-panel': p.id, 'clip-path': `url(#plot-${this.uid}-${p.id}-marks)` }, g);
    }
  }

  private buildMarks(): void {
    for (const g of this.svgEl.querySelectorAll('.plot-marks')) g.replaceChildren();
    for (const old of this.overlay.querySelectorAll('.plot-mark')) old.remove();
    this.gated = this.gated.filter((e) => e.node.isConnected);
    this.drawers = [];
    this.eventFrames = [];
    this.faders = [];
    this.fadeLabels = [];
    this.held = [];
    const tab = this.plot.tabs[this.tab];
    for (const m of this.plot.marks) {
      const b = this.boxes.get(m.panel), data = tab.data[m.id];
      const g = this.svgEl.querySelector(`.plot-marks[data-panel="${m.panel}"]`);
      if (!b || !g || data === undefined) continue;
      const group = svg('g', {}, g);
      this.styleItem(group, m, [m.panel, m.id]);
      const moving = m.kind === 'events' || (m.kind === 'label' ? (data as LabelData).at.length > 1 || (data as LabelData).text.length > 1 : (m.kind === 'trace' ? (data as TraceData).points : (data as unknown[])).length > 1);
      const fader = moving ? svg('g', {}, group) : group;
      if (moving) {
        fader.style.transition = 'none';
        this.faders.push(fader);
      }
      if (m.kind === 'points') {
        const frames = (data as number[][]).map((f) => f.map((v, k) => scaled(k % 2 ? b.panel.y : b.panel.x, v)));
        const dots: SVGCircleElement[] = [];
        this.drawers.push((u) => {
          const at = framesAt(frames, u);
          while (dots.length < at.length / 2) dots.push(svg('circle', { r: m.size / 2, class: m.hollow ? 'plot-hollow' : 'plot-dot', 'stroke-width': m.width }, fader));
          dots.forEach((d, k) => {
            const on = 2 * k < at.length;
            d.style.display = on ? '' : 'none';
            if (on) { d.setAttribute('cx', this.XS(b, at[2 * k]).toFixed(1)); d.setAttribute('cy', this.YS(b, at[2 * k + 1]).toFixed(1)); }
          });
        });
      } else if (m.kind === 'trace') {
        const { points, ghost, tones } = data as TraceData, pts = points.map((q) => this.toAxes(b, q));
        if (m.ghost && ghost > 0) svg('path', { class: 'plot-ghost', d: this.pathS(b, pts.slice(0, ghost + 1)), 'stroke-width': m.width }, group);
        if (fader !== group) group.append(fader);
        const head = svg('circle', { class: 'plot-dot', r: m.size / 2 }, fader);
        if (!tones && !(m.fade > 0)) {
          const done = svg('path', { class: 'plot-trace', 'stroke-width': m.width }, fader);
          fader.insertBefore(done, head);
          this.drawers.push((u) => {
            const p = traceTo(pts, u), [x, y] = p[p.length - 1];
            done.setAttribute('d', this.pathS(b, p));
            head.setAttribute('cx', this.XS(b, x).toFixed(1));
            head.setAttribute('cy', this.YS(b, y).toFixed(1));
          });
        } else {
          const parts: SVGLineElement[] = [], opacities: string[] = [];
          const tone = (i: number) => toneColor(tones ? tones[clamp(i, 0, tones.length - 1)] : m.tone);
          let full = 0, shown = 0, gone = 0, last = -1;
          this.drawers.push((u) => {
            const p = traceTo(pts, u), now = this.timeOf(u), n = p.length - 1;
            if (u < last) { full = Math.min(full, Math.max(0, n - 1)); gone = 0; }
            last = u;
            while (parts.length < n) {
              parts.push(fader.insertBefore(svg('line', { class: 'plot-trace', 'stroke-width': m.width }), head));
              opacities.push('');
            }
            for (let i = n; i < shown; i++) parts[i].style.display = 'none';
            for (let i = Math.min(full, shown); i < n; i++) {
              const line = parts[i];
              if (i >= shown) line.style.display = '';
              line.setAttribute('x1', this.XS(b, p[i][0]).toFixed(1));
              line.setAttribute('y1', this.YS(b, p[i][1]).toFixed(1));
              line.setAttribute('x2', this.XS(b, p[i + 1][0]).toFixed(1));
              line.setAttribute('y2', this.YS(b, p[i + 1][1]).toFixed(1));
              line.style.color = tone(i);
            }
            shown = n;
            full = Math.max(0, n - 1);
            if (m.fade > 0) {
              for (let i = gone; i < n; i++) {
                const o = (Math.round(20 * Math.max(0, 1 - (now - this.timeOf(Math.min(i + 0.5, u))) / m.fade)) * 0.03).toFixed(2);
                if (o !== opacities[i]) { parts[i].style.opacity = o; opacities[i] = o; }
                if (o === '0.00' && i === gone) gone++;
              }
            }
            const [x, y] = p[p.length - 1];
            head.setAttribute('cx', this.XS(b, x).toFixed(1));
            head.setAttribute('cy', this.YS(b, y).toFixed(1));
            head.style.color = tone(Math.round(u));
          });
        }
      } else if (m.kind === 'label') {
        const d = data as LabelData, at = d.at.map((q) => this.toAxes(b, q));
        const fromFrame = (k: number) => (WRITTEN.has(d.text) ? `${WRITTEN.get(d.text)}[${k}]` : pathOf(d, 'text'));
        const el = this.label(d.text[0], fromFrame(0), 0, 0, m.anchor, 'plot-mark', [m.panel, m.id], m.tone);
        el.classList.add(...m.cls);
        if (moving) this.fadeLabels.push(el);
        let shown = 0;
        this.drawers.push((u) => {
          const [x, y] = at.length === 1 ? at[0] : (framesAt(at, u) as Pair);
          this.place(el, this.XS(b, x) + m.dx, this.YS(b, y) + m.dy, m.anchor);
          const k = clamp(Math.round(u), 0, d.text.length - 1);
          if (k === shown) return;
          if (d.text[k] !== d.text[shown]) setPlotText(el, d.text[k]);
          mark(el, fromFrame(k));
          shown = k;
        });
      } else {
        const events = data as PlotEvent[];
        const nodes = events.map((e) => {
          const X = this.X(b, e.at[0]), Y = this.Y(b, e.at[1]);
          const ring = svg('circle', { class: 'plot-ring', cx: X, cy: Y, r: m.size / 2, 'stroke-width': m.width }, fader);
          const text = e.text ? this.label(e.text, pathOf(e, 'text'), X + m.dx, Y + m.dy, m.anchor, 'plot-mark', [m.panel, m.id], m.tone) : null;
          text?.classList.add(...m.cls);
          if (text) this.fadeLabels.push(text);
          this.eventFrames.push({ frame: e.frame, names: [m.panel, m.id], tone: m.tone });
          return { frame: e.frame, nodes: [ring, text].filter((n): n is SVGCircleElement | HTMLElement => !!n) };
        });
        this.drawers.push((u) => {
          for (const e of nodes) for (const n of e.nodes) n.classList.toggle('plot-later', u < e.frame - 1e-6);
        });
      }
    }
    this.applyGates();
    this.draw();
  }

  private draw(): void {
    if (!this.spec || !this.W) return;
    const tab = this.plot.tabs[this.tab], u = this.u, n = this.frames;
    for (const d of this.drawers) d(u);
    for (const f of this.faders) f.style.opacity = this.fade < 1 ? String(this.fade) : '';
    for (const el of this.fadeLabels) el.style.filter = this.fade < 1 ? `opacity(${Math.max(0, 2 * this.fade - 1)})` : '';
    for (const node of this.held) {
      if (node instanceof HTMLElement) node.style.filter = `opacity(${Math.max(0, 1 - 2 * this.fade)})`;
      else node.style.opacity = String(1 - this.fade);
    }
    this.value.textContent = formatNumber(valueAt(tab.values, u), this.plot.parameter.digits);
    const length = this.length;
    const at = `${(length > 0 ? this.timeOf(u) / length : 0) * 100}%`;
    this.fill.style.width = at;
    this.knob.style.left = at;
    if (tab.active) {
      const on = nearest(tab.active, u);
      for (const { node, id } of this.emphasized) {
        node.classList.toggle('plot-on', on.includes(id));
        node.classList.toggle('plot-off', this.emphasis.has(id) && !on.includes(id));
      }
    } else for (const { node } of this.emphasized) node.classList.remove('plot-on', 'plot-off');
  }

  private holdLast(): void {
    this.release();
    for (const d of this.drawers) d(this.frames - 1);
    for (const node of [...this.faders, ...this.fadeLabels]) {
      const copy = node.cloneNode(true) as SVGElement | HTMLElement;
      node.before(copy);
      this.held.push(copy);
      const gate = this.gated.find((g) => g.node === node);
      if (gate) this.gated.push({ node: copy, names: gate.names });
    }
  }

  private release(): void {
    if (!this.held.length) return;
    for (const node of this.held) node.remove();
    this.held = [];
    this.gated = this.gated.filter((g) => g.node.isConnected);
  }

  private hidden(names: string[]): boolean {
    return names.some((s) => (this.steps.has(s) && !this.shown.has(s)) || this.gone.has(s));
  }

  private applyGates(): void {
    for (const { node, names } of this.gated) node.classList.toggle('plot-hidden', this.hidden(names));
    for (const { b, i } of this.tabButtons) {
      const off = this.hidden([this.plot.tabs[i].name]);
      b.classList.toggle('plot-hidden', off);
      b.disabled = off;
    }
    const length = this.length;
    this.ticks.replaceChildren(...this.eventFrames.filter((e) => !this.hidden(e.names)).map((e) => {
      const t = document.createElement('div');
      t.className = 'plot-tick-mark';
      t.style.left = `${(length > 0 ? this.timeOf(e.frame) / length : 0) * 100}%`;
      t.style.background = toneColor(e.tone);
      return t;
    }));
  }

  syncSteps(): void {
    if (!this.spec) return;
    const slide = this.el.closest('section');
    const frags = slide ? [...slide.querySelectorAll<HTMLElement>('.fragment')] : [];
    this.steps = new Set(frags.flatMap((f) => words(f.dataset.plotShow)));
    const visible = frags.filter((f) => f.classList.contains('visible'));
    this.shown = new Set(visible.flatMap((f) => words(f.dataset.plotShow)));
    this.gone = new Set(visible.flatMap((f) => words(f.dataset.plotHide)));
    const cues = frags.filter((f) => f.hasAttribute('data-plot-play'));
    const cue = !cues.length ? 'none' : cues.some((f) => visible.includes(f)) ? 'shown' : 'held';
    const tabbed = visible.filter((f) => f.dataset.plotTab).sort((a, b) => +(a.dataset.fragmentIndex ?? 0) - +(b.dataset.fragmentIndex ?? 0));
    const top = tabbed.at(-1);
    const name = top?.dataset.plotTab ?? this.el.dataset.plotTab ?? null;
    const run = !!top?.hasAttribute('data-plot-once') && top.classList.contains('current-fragment') && this.live && !reduced();
    let tab = this.tab;
    if (name !== this.stepTab) {
      this.stepTab = name;
      const i = this.plot.tabs.findIndex((t) => t.name === name);
      if (i >= 0) tab = i;
    }
    const cued = cue !== this.cue;
    this.cue = cue;
    if (tab !== this.tab) {
      if (this.once) this.pause();
      this.setTab(tab, run);
      if (run) {
        this.once = true;
        this.play();
      }
    } else this.applyGates();
    if (cued && this.live) {
      if (cue === 'shown' && this.moves()) { this.pause(); this.u = 0; this.play(); }
      else this.still();
    }
  }

  setTab(i: number, first = false): void {
    if (!this.spec || i === this.tab) return;
    this.tab = i;
    this.markTabs();
    this.u = this.raf || first ? 0 : this.stillFrame();
    this.t0 = performance.now();
    this.fade = 1;
    this.pass = 0;
    this.release();
    if (!this.W) return;
    this.layout();
    this.drawStatic();
    this.buildMarks();
    this.el.dispatchEvent(new CustomEvent('beeson:plot-drawn', { bubbles: true }));
  }

  private stillFrame(): number {
    const f = Number(this.cue === 'shown' ? -1 : (this.el.dataset.plotFrame ?? -1)), n = this.frames;
    return clamp(Number.isFinite(f) ? (f < 0 ? n + f : f) : n - 1, 0, n - 1);
  }

  still(): void {
    if (!this.spec) return;
    this.pause();
    this.u = this.stillFrame();
    this.draw();
  }

  private moves(): boolean {
    return !this.el.hasAttribute('data-plot-paused') && !reduced();
  }

  start(): void {
    if (!this.spec) return;
    this.live = true;
    if (!this.moves() || this.cue === 'held') { this.still(); return; }
    this.u = 0;
    this.play();
  }

  leave(): void {
    this.live = false;
    this.pause();
  }

  play(): void {
    if (!this.spec || this.raf) return;
    if (this.u >= this.frames - 1) this.u = 0;
    this.t0 = performance.now() - this.timeOf(this.u) * 1000;
    this.pass = 0;
    const tick = (now: number) => {
      const t = (now - this.t0) / 1000, { duration, hold, fade } = this.plot, length = this.length;
      if (this.once && t >= length) {
        this.u = this.frames - 1;
        this.draw();
        this.pause();
        return;
      }
      const pass = length + hold > 0 ? Math.floor(t / (length + hold)) : 0;
      if (pass !== this.pass) {
        this.pass = pass;
        if (fade > 0) this.holdLast();
      }
      this.u = loopFrame(t, this.frames, duration, hold, this.plot.tabs[this.tab].times);
      this.fade = loopFade(t, length, hold, fade);
      if (this.fade >= 1) this.release();
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    this.setPlaying(true);
  }

  pause(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.once = false;
    this.setPlaying(false);
    if (this.fade < 1 || this.held.length) {
      this.fade = 1;
      this.release();
      this.draw();
    }
  }

  get playing(): boolean {
    return this.raf !== 0;
  }

  get timing(): { pass: number; hold: number; fade: number } | null {
    return this.spec ? { pass: this.length, hold: this.plot.hold, fade: this.plot.fade } : null;
  }

  get frame(): number {
    return this.u;
  }
}

export function mountPlots(root: ParentNode): PlotView[] {
  return [...root.querySelectorAll<HTMLElement>('.plot')].map((el) => CACHE.get(el) ?? new PlotView(el));
}
