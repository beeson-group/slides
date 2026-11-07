// the JSON of an animated 2D plot, i.e. its parser and the interpolation between its frames

type Pair = [number, number];
type Anchor = 'start' | 'middle' | 'end';
type Kind = 'points' | 'trace' | 'label' | 'events';

export type Axis = { range: Pair; ticks: number[]; title: string };
// an element of a panel or a mark. id names it in data-plot-show and in the active list of a tab,
// and the classes of cls are the targets of a data-highlight of the slide
type Item = { id: string | null; tone: string; cls: string[] };
export type Region = Item & { points: Pair[]; opacity: number };
export type Curve = Item & { points: Pair[] | null; circle: [number, number, number] | null; width: number; dash: number[] | null };
export type Label = Item & { at: Pair; text: string; anchor: Anchor; dx: number; dy: number };
export type Panel = { id: string; x: Axis; y: Axis; equal: boolean; axes: boolean; title: string; regions: Region[]; curves: Curve[]; labels: Label[] };
export type Mark = Item & { id: string; panel: string; kind: Kind; size: number; width: number; hollow: boolean; anchor: Anchor; dx: number; dy: number };
export type PlotEvent = { frame: number; at: Pair; text: string };
// a label mark with one position or one text is held there for every frame
export type LabelData = { at: Pair[]; text: string[] };
export type MarkData = number[][] | Pair[] | LabelData | PlotEvent[];
export type Tab = { name: string; label: string; values: number[]; data: Record<string, MarkData>; active: string[][] | null };
export type Plot = { parameter: { label: string; digits: number }; duration: number; hold: number; layout: 'row' | 'column' | null; panels: Panel[]; marks: Mark[]; tabs: Tab[] };

const KINDS: Kind[] = ['points', 'trace', 'label', 'events'];

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
  return { id: o.id === undefined ? null : str(o.id, `${path}.id`), tone: str(o.tone, `${path}.tone`, tone), cls };
}

function axis(v: unknown, path: string): Axis {
  if (!isObject(v)) fail(path, 'an axis { range, ticks, title } is expected');
  const range = pair(v.range, `${path}.range`);
  if (!(range[1] > range[0])) fail(`${path}.range`, 'the second end must be larger than the first');
  return { range, ticks: list(v.ticks, `${path}.ticks`, []).map((t, i) => num(t, `${path}.ticks[${i}]`)), title: str(v.title, `${path}.title`, '') };
}

function panel(v: unknown, path: string): Panel {
  if (!isObject(v)) fail(path, 'a panel is expected');
  const regions = list(v.regions, `${path}.regions`, []).map((r, i) => {
    const p = `${path}.regions[${i}]`;
    if (!isObject(r)) fail(p, 'a region is expected');
    return { ...item(r, p, 'violet'), points: pairs(r.points, `${p}.points`), opacity: num(r.opacity, `${p}.opacity`, 0.12) };
  });
  const curves = list(v.curves, `${path}.curves`, []).map((c, i) => {
    const p = `${path}.curves[${i}]`;
    if (!isObject(c)) fail(p, 'a curve is expected');
    let circle: [number, number, number] | null = null;
    if (c.circle !== undefined) {
      const a = list(c.circle, `${p}.circle`);
      if (a.length !== 3) fail(`${p}.circle`, 'a circle [cx, cy, r] is expected');
      circle = [num(a[0], `${p}.circle[0]`), num(a[1], `${p}.circle[1]`), num(a[2], `${p}.circle[2]`)];
    } else if (c.points === undefined) fail(p, 'points or circle is expected');
    const dash = c.dash === undefined ? null : list(c.dash, `${p}.dash`).map((d, j) => num(d, `${p}.dash[${j}]`));
    return { ...item(c, p, 'subtle'), points: circle ? null : pairs(c.points, `${p}.points`), circle, width: num(c.width, `${p}.width`, 2), dash };
  });
  const labels = list(v.labels, `${path}.labels`, []).map((l, i) => {
    const p = `${path}.labels[${i}]`;
    if (!isObject(l)) fail(p, 'a label is expected');
    return { ...item(l, p, 'subtle'), at: pair(l.at, `${p}.at`), text: str(l.text, `${p}.text`), anchor: anchor(l.anchor, `${p}.anchor`), dx: num(l.dx, `${p}.dx`, 0), dy: num(l.dy, `${p}.dy`, 0) };
  });
  return {
    id: str(v.id, `${path}.id`),
    x: axis(v.x, `${path}.x`),
    y: axis(v.y, `${path}.y`),
    equal: v.equal === true,
    axes: v.axes !== false,
    title: str(v.title, `${path}.title`, ''),
    regions,
    curves,
    labels,
  };
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
    const a = pairs(v, path);
    perFrame(a.length);
    return a;
  }
  if (m.kind === 'label') {
    if (!isObject(v)) fail(path, 'a label { at, text } is expected');
    const at = Array.isArray(v.at) && Array.isArray(v.at[0]) ? pairs(v.at, `${path}.at`) : [pair(v.at, `${path}.at`)];
    const text = Array.isArray(v.text) ? v.text.map((t, i) => str(t, `${path}.text[${i}]`)) : [str(v.text, `${path}.text`)];
    perFrame(at.length);
    perFrame(text.length);
    return { at, text };
  }
  return list(v, path).map((e, i) => {
    const p = `${path}[${i}]`;
    if (!isObject(e)) fail(p, 'an event { frame, at, text } is expected');
    const frame = num(e.frame, `${p}.frame`);
    if (frame < 0 || frame > frames - 1) fail(`${p}.frame`, `a frame from 0 to ${frames - 1} is expected`);
    return { frame, at: pair(e.at, `${p}.at`), text: str(e.text, `${p}.text`, '') };
  });
}

/** Checks a plot read from JSON and fills in the defaults. The Error thrown on a fault gives the path of the first fault. */
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
    let active: string[][] | null = null;
    if (t.active !== undefined) {
      active = list(t.active, `${p}.active`).map((f, j) => (typeof f === 'string' ? [f] : list(f, `${p}.active[${j}]`).map((s, k) => str(s, `${p}.active[${j}][${k}]`))));
      if (active.length !== values.length) fail(`${p}.active`, `${active.length} frames are given, and the tab has ${values.length} values`);
    }
    return { name, label: str(t.label, `${p}.label`, name), values, data, active };
  });
  if (!tabs.length) fail('tabs', 'at least one tab is expected');
  const parameter = isObject(v.parameter) ? v.parameter : {};
  const layout = v.layout === undefined ? null : str(v.layout, 'layout');
  if (layout !== null && layout !== 'row' && layout !== 'column') fail('layout', 'row or column is expected');
  return {
    parameter: { label: str(parameter.label, 'parameter.label', ''), digits: num(parameter.digits, 'parameter.digits', 3) },
    duration: num(v.duration, 'duration', 8),
    hold: num(v.hold, 'hold', 1),
    layout,
    panels,
    marks,
    tabs,
  };
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** The value at the fractional frame u, linear between two frames. */
export function valueAt(values: number[], u: number): number {
  const n = values.length;
  if (n === 1) return values[0];
  const v = clamp(u, 0, n - 1), i = Math.min(n - 2, Math.floor(v)), f = v - i;
  return values[i] + f * (values[i + 1] - values[i]);
}

/** The entry of the frame nearest to u. */
export function nearest<T>(frames: T[], u: number): T {
  return frames[clamp(Math.round(u), 0, frames.length - 1)];
}

/** The coordinates at the fractional frame u, linear between two frames of the same length and the nearest frame otherwise. */
export function framesAt(frames: number[][], u: number): number[] {
  const n = frames.length;
  if (n === 1) return frames[0];
  const v = clamp(u, 0, n - 1), i = Math.min(n - 2, Math.floor(v)), f = v - i;
  const a = frames[i], b = frames[i + 1];
  if (a.length !== b.length) return nearest(frames, v);
  return a.map((x, k) => x + f * (b[k] - x));
}

/** The path of a trace from its first frame to the fractional frame u, which ends between two frames. */
export function traceTo(path: Pair[], u: number): Pair[] {
  const n = path.length, v = clamp(u, 0, n - 1), i = Math.floor(v), f = v - i;
  const out = path.slice(0, i + 1);
  if (f > 0 && i < n - 1) out.push([path[i][0] + f * (path[i + 1][0] - path[i][0]), path[i][1] + f * (path[i + 1][1] - path[i][1])]);
  return out;
}

/** The fractional frame at t seconds into a loop that runs over n frames in duration seconds and then holds the last frame for hold seconds. */
export function loopFrame(t: number, n: number, duration: number, hold: number): number {
  if (n < 2) return 0;
  const tau = ((t % (duration + hold)) + duration + hold) % (duration + hold);
  return Math.min(1, tau / duration) * (n - 1);
}

const MINUS = '−';

/** A number for a tick or a readout, with a minus sign in place of the hyphen. */
export function formatNumber(x: number, digits?: number): string {
  const s = digits === undefined ? String(Number(x.toPrecision(6))) : x.toFixed(digits);
  return s.replace(/^-(?=.*[1-9])/, MINUS).replace(/^-/, '');
}
