// an animated 2D plot in a `.plot` element, drawn as SVG from an inline JSON block named by the
// attribute data-plot. the format is documented in the README. the plot is played in a loop while
// its slide is shown, and the fragments of its slide reveal its panels and marks with
// data-plot-show and switch its tab with data-plot-tab. text in the JSON is set in a small markup,
// in which $...$ is math with italic letters, sub- and superscripts, and TeX names of symbols

type Pair = [number, number];
type Anchor = 'start' | 'middle' | 'end';
type Kind = 'points' | 'trace' | 'label' | 'events';

// a tick at a value of its axis, labeled with text in the markup
export type Tick = { at: number; text: string };
export type Scale = 'linear' | 'asinh';
export type Axis = { range: Pair; ticks: Tick[]; title: string; scale: Scale; unit: number };
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
  const scale = str(v.scale, `${path}.scale`, 'linear');
  if (scale !== 'linear' && scale !== 'asinh') fail(`${path}.scale`, 'linear or asinh is expected');
  const unit = num(v.unit, `${path}.unit`, 1);
  if (!(unit > 0)) fail(`${path}.unit`, 'a positive number is expected');
  const ticks = list(v.ticks, `${path}.ticks`, []).map((t, i): Tick => {
    const p = `${path}.ticks[${i}]`;
    if (typeof t === 'number') return { at: num(t, p), text: formatNumber(t) };
    if (!isObject(t)) fail(p, 'a number or a tick { at, text } is expected');
    const at = num(t.at, `${p}.at`);
    return { at, text: str(t.text, `${p}.text`, formatNumber(at)) };
  });
  return { range, ticks, title: str(v.title, `${path}.title`, ''), scale, unit };
}

/** The coordinate of the value v along an axis, i.e. v on a linear scale and asinh(v / unit) on an asinh scale. */
export function scaled(a: Axis, v: number): number {
  return a.scale === 'asinh' ? Math.asinh(v / a.unit) : v;
}

function regions(v: unknown, path: string): Region[] {
  return list(v, path, []).map((r, i) => {
    const p = `${path}[${i}]`;
    if (!isObject(r)) fail(p, 'a region is expected');
    return { ...item(r, p, 'violet'), points: pairs(r.points, `${p}.points`), opacity: num(r.opacity, `${p}.opacity`, 0.12) };
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
    return { ...item(c, p, 'subtle'), points: circle ? null : pairs(c.points, `${p}.points`), circle, width: num(c.width, `${p}.width`, 2), dash };
  });
}

function labels(v: unknown, path: string): Label[] {
  return list(v, path, []).map((l, i) => {
    const p = `${path}[${i}]`;
    if (!isObject(l)) fail(p, 'a label is expected');
    return { ...item(l, p, 'subtle'), at: pair(l.at, `${p}.at`), text: str(l.text, `${p}.text`), anchor: anchor(l.anchor, `${p}.anchor`), dx: num(l.dx, `${p}.dx`, 0), dy: num(l.dy, `${p}.dy`, 0) };
  });
}

function panel(v: unknown, path: string): Panel {
  if (!isObject(v)) fail(path, 'a panel is expected');
  return {
    id: str(v.id, `${path}.id`),
    x: axis(v.x, `${path}.x`),
    y: axis(v.y, `${path}.y`),
    equal: v.equal === true,
    axes: v.axes !== false,
    title: str(v.title, `${path}.title`, ''),
    regions: regions(v.regions, `${path}.regions`),
    curves: curves(v.curves, `${path}.curves`),
    labels: labels(v.labels, `${path}.labels`),
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

const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  pm: '±', mp: '∓', infty: '∞', cdot: '·', times: '×', approx: '≈', le: '≤', ge: '≥', ne: '≠', to: '→', in: '∈',
};

export type Run = { text: string; italic: boolean; shift: 'sub' | 'sup' | null };

/** Splits a text of the markup into runs, i.e. pieces of one style. */
export function parseMarkup(src: string): Run[] {
  const runs: Run[] = [];
  const push = (text: string, italic: boolean, shift: Run['shift']) => {
    const last = runs.at(-1);
    if (last && last.italic === italic && last.shift === shift) last.text += text;
    else runs.push({ text, italic, shift });
  };
  const parts = src.split('$');
  parts.forEach((part, k) => {
    if (k % 2 === 0) { if (part) push(part, false, null); return; }
    math(part, false, null);
  });
  // a group in braces, a command, or one character, starting at i
  function group(s: string, i: number): [string, number] {
    if (s[i] === '{') {
      let depth = 0, j = i;
      for (; j < s.length; j++) {
        if (s[j] === '{') depth++;
        else if (s[j] === '}' && --depth === 0) break;
      }
      return [s.slice(i + 1, j), j + 1];
    }
    if (s[i] === '\\') {
      const m = /^\\[A-Za-z]+/.exec(s.slice(i));
      if (m) return [m[0], i + m[0].length];
    }
    return [s[i] ?? '', i + 1];
  }
  function math(s: string, upright: boolean, shift: Run['shift']): void {
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === '\\') {
        const m = /^\\([A-Za-z]+)/.exec(s.slice(i));
        if (!m) { push(s[i + 1] ?? '', false, shift); i += 2; continue; }
        i += m[0].length;
        if (m[1] === 'mathrm' || m[1] === 'text') {
          const [g, j] = group(s, i);
          i = j;
          math(g, true, shift);
        } else {
          const sym = SYMBOLS[m[1]] ?? m[0];
          push(sym, !upright && /^[a-z]+$/.test(m[1]) && /[α-ω]/.test(sym), shift);
        }
      } else if (c === '_' || c === '^') {
        const [g, j] = group(s, i + 1);
        i = j;
        math(g, upright, c === '_' ? 'sub' : 'sup');
      } else if (c === '{' || c === '}') {
        i++;
      } else {
        push(c === '-' ? MINUS : c, !upright && /[A-Za-zα-ω]/.test(c), shift);
        i++;
      }
    }
  }
  return runs;
}

/** Fills el with the runs of a text of the markup. */
export function setMarkup(el: HTMLElement, src: string): void {
  el.replaceChildren(...parseMarkup(src).map((r) => {
    let node: Node = document.createTextNode(r.text);
    if (r.italic) { const i = document.createElement('i'); i.append(node); node = i; }
    if (r.shift) { const s = document.createElement(r.shift); s.append(node); node = s; }
    return node;
  }));
}

const SVG = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  parent?.append(el);
  return el;
}

// a circle as a closed polyline, for an axis on which it is not an ellipse
const circlePoints = ([cx, cy, r]: [number, number, number]): Pair[] =>
  Array.from({ length: 181 }, (_, i) => [cx + r * Math.cos((i * Math.PI) / 90), cy + r * Math.sin((i * Math.PI) / 90)]);

// a tone is the name of a custom property of the theme, e.g. accent or data-3, or a CSS color
const toneColor = (tone: string) => (/^[a-z][a-z0-9-]*$/.test(tone) ? `var(--${tone})` : tone);

const words = (s: string | undefined | null) => (s ?? '').split(/\s+/).filter(Boolean);

// the box of a panel in px, with the scaled coordinates x0 and y0 of the lower left corner
type Box = { x: number; y: number; w: number; h: number; x0: number; y0: number; sx: number; sy: number; panel: Panel };

const MARGIN = { left: 76, right: 20, top: 52, bottom: 84 };
const GAP = 56;

let serial = 0;

const reduced = () => typeof window === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches;

const CACHE = new WeakMap<HTMLElement, PlotView>();

/** One animated plot per `.plot` element. */
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
  private tabButtons: HTMLButtonElement[] = [];
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
  private eventFrames: { frame: number; names: string[] }[] = [];
  private shown = new Set<string>();
  private steps = new Set<string>();
  private stepTab: string | null = null;

  constructor(el: HTMLElement) {
    this.el = el;
    CACHE.set(el, this);
    // a slide is cloned with its plot for each step in the print view of reveal.js
    for (const old of el.querySelectorAll(':scope > .plot-body, :scope > .plot-error')) old.remove();
    try {
      const id = el.dataset.plot ?? '';
      const block = id ? document.getElementById(id) : null;
      if (!block) throw new Error(`the JSON block with the id "${id}" is not found`);
      this.spec = parsePlot(block.textContent ?? '');
    } catch (error) {
      const message = `plot ${el.dataset.plot ?? ''}: ${(error as Error).message}`;
      const box = document.createElement('div');
      box.className = 'plot-error';
      box.textContent = message;
      el.append(box);
      console.error(message);
      return;
    }
    const only = words(el.dataset.plotPanels);
    this.panels = only.length ? this.spec.panels.filter((p) => only.includes(p.id)) : this.spec.panels;
    const start = this.spec.tabs.findIndex((t) => t.name === el.dataset.plotTab);
    this.tab = Math.max(0, start);
    this.build();
  }

  private get plot(): Plot {
    return this.spec as Plot;
  }

  private get frames(): number {
    return this.plot.tabs[this.tab].values.length;
  }

  private build(): void {
    const plot = this.plot;
    this.body = document.createElement('div');
    this.body.className = 'plot-body';
    if (plot.tabs.length > 1) {
      const bar = document.createElement('div');
      bar.className = 'plot-tabs';
      bar.setAttribute('role', 'tablist');
      this.tabButtons = plot.tabs.map((t, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'tab');
        setMarkup(b, t.label);
        b.addEventListener('click', () => { b.blur(); this.setTab(i); });
        bar.append(b);
        return b;
      });
      this.body.append(bar);
    }
    this.area = document.createElement('div');
    this.area.className = 'plot-area';
    this.svgEl = svg('svg', { 'aria-hidden': 'true' });
    this.overlay = document.createElement('div');
    this.overlay.className = 'plot-labels';
    this.area.append(this.svgEl, this.overlay);
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
    // a drag on the scrubber is not a swipe of the deck
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
      this.u = clamp((ev.clientX - r.left) / r.width, 0, 1) * (this.frames - 1);
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
      setMarkup(name, plot.parameter.label);
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
    this.tabButtons.forEach((b, i) => b.setAttribute('aria-selected', String(i === this.tab)));
  }

  /** Lays the panels out in the size of the element, which is measured in slide pixels. */
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

  private layout(): void {
    const n = this.panels.length, row = (this.plot.layout ?? (this.W >= this.H ? 'row' : 'column')) === 'row';
    const cw = row ? (this.W - GAP * (n - 1)) / n : this.W, ch = row ? this.H : (this.H - GAP * (n - 1)) / n;
    this.boxes.clear();
    this.panels.forEach((p, i) => {
      const cx = row ? i * (cw + GAP) : 0, cy = row ? 0 : i * (ch + GAP);
      let x = cx + MARGIN.left, y = cy + MARGIN.top, w = cw - MARGIN.left - MARGIN.right, h = ch - MARGIN.top - MARGIN.bottom;
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

  // the pixel of a coordinate along an axis, i.e. of a value after its scale
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

  // the coordinates of a point of the data, in which the marks are interpolated between frames, so
  // that a mark between two frames is on the straight line drawn between them
  private toAxes(b: Box, [x, y]: Pair): Pair {
    return [scaled(b.panel.x, x), scaled(b.panel.y, y)];
  }

  private path(b: Box, pts: Pair[]): string {
    return this.pathS(b, pts.map((p) => this.toAxes(b, p)));
  }

  private pathS(b: Box, pts: Pair[]): string {
    return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${this.XS(b, x).toFixed(1)} ${this.YS(b, y).toFixed(1)}`).join('');
  }

  private label(text: string, left: number, top: number, a: Anchor, cls: string, names: string[], tone?: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `plot-label ${cls}`.trim();
    setMarkup(el, text);
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
    this.gate(node, names);
    if (it.id) this.emphasized.push({ node, id: it.id });
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
      // the marks are clipped a little outside the axes, so that a point on an axis is drawn whole
      for (const [suffix, pad] of [['', 0], ['-marks', 14]] as const) {
        const clip = svg('clipPath', { id: `plot-${this.uid}-${p.id}${suffix}` }, defs);
        svg('rect', { x: b.x - pad, y: b.y - pad, width: b.w + 2 * pad, height: b.h + 2 * pad }, clip);
      }
      const statics = svg('g', { 'clip-path': `url(#plot-${this.uid}-${p.id})` }, g);
      for (const r of p.regions) {
        const node = svg('path', { class: 'plot-region', d: `${this.path(b, r.points)}Z`, 'fill-opacity': r.opacity }, statics);
        this.styleItem(node, r, [p.id, r.id]);
      }
      for (const c of p.curves) {
        const attrs: Record<string, string | number> = { class: 'plot-curve', 'stroke-width': c.width };
        if (c.dash) attrs['stroke-dasharray'] = c.dash.join(' ');
        const linear = p.x.scale === 'linear' && p.y.scale === 'linear';
        const node = c.circle && linear
          ? svg('ellipse', { ...attrs, cx: this.X(b, c.circle[0]), cy: this.Y(b, c.circle[1]), rx: c.circle[2] * b.sx, ry: c.circle[2] * b.sy }, statics)
          : svg('path', { ...attrs, d: this.path(b, c.circle ? circlePoints(c.circle) : (c.points ?? [])) }, statics);
        this.styleItem(node, c, [p.id, c.id]);
      }
      if (p.axes) {
        const axes = svg('g', { class: 'plot-axes' }, g);
        svg('path', { d: `M${b.x} ${b.y}V${b.y + b.h}H${b.x + b.w}` }, axes);
        for (const t of p.x.ticks) {
          const X = this.X(b, t.at);
          svg('path', { d: `M${X} ${b.y + b.h}v10` }, axes);
          this.label(t.text, X, b.y + b.h + 32, 'middle', 'plot-tick', [p.id]);
        }
        for (const t of p.y.ticks) {
          const Y = this.Y(b, t.at);
          svg('path', { d: `M${b.x} ${Y}h-10` }, axes);
          this.label(t.text, b.x - 18, Y, 'end', 'plot-tick', [p.id]);
        }
        if (p.x.title) this.label(p.x.title, b.x + b.w / 2, b.y + b.h + 70, 'middle', 'plot-title', [p.id]);
        if (p.y.title) this.label(p.y.title, b.x, b.y - 30, 'middle', 'plot-title', [p.id]);
      }
      if (p.title) this.label(p.title, b.x + b.w, b.y - 30, 'end', 'plot-title', [p.id]);
      for (const l of p.labels) {
        const node = this.label(l.text, this.X(b, l.at[0]) + l.dx, this.Y(b, l.at[1]) + l.dy, l.anchor, '', []);
        this.styleItem(node, l, [p.id, l.id]);
      }
      svg('g', { class: 'plot-marks', 'data-panel': p.id, 'clip-path': `url(#plot-${this.uid}-${p.id}-marks)` }, g);
    }
  }

  // the nodes of the marks of the current tab, with one drawer per mark that sets them at a frame
  private buildMarks(): void {
    for (const g of this.svgEl.querySelectorAll('.plot-marks')) g.replaceChildren();
    for (const old of this.overlay.querySelectorAll('.plot-mark')) old.remove();
    this.gated = this.gated.filter((e) => e.node.isConnected);
    this.drawers = [];
    this.eventFrames = [];
    const tab = this.plot.tabs[this.tab];
    for (const m of this.plot.marks) {
      const b = this.boxes.get(m.panel), data = tab.data[m.id];
      const g = this.svgEl.querySelector(`.plot-marks[data-panel="${m.panel}"]`);
      if (!b || !g || data === undefined) continue;
      const group = svg('g', {}, g);
      this.styleItem(group, m, [m.panel, m.id]);
      if (m.kind === 'points') {
        const frames = (data as number[][]).map((f) => f.map((v, k) => scaled(k % 2 ? b.panel.y : b.panel.x, v)));
        const dots: SVGCircleElement[] = [];
        this.drawers.push((u) => {
          const at = framesAt(frames, u);
          while (dots.length < at.length / 2) dots.push(svg('circle', { r: m.size / 2, class: m.hollow ? 'plot-hollow' : 'plot-dot', 'stroke-width': m.width }, group));
          dots.forEach((d, k) => {
            const on = 2 * k < at.length;
            d.style.display = on ? '' : 'none';
            if (on) { d.setAttribute('cx', this.XS(b, at[2 * k]).toFixed(1)); d.setAttribute('cy', this.YS(b, at[2 * k + 1]).toFixed(1)); }
          });
        });
      } else if (m.kind === 'trace') {
        const pts = (data as Pair[]).map((q) => this.toAxes(b, q));
        svg('path', { class: 'plot-ghost', d: this.pathS(b, pts), 'stroke-width': m.width }, group);
        const done = svg('path', { class: 'plot-trace', 'stroke-width': m.width }, group);
        const head = svg('circle', { class: 'plot-dot', r: m.size / 2 }, group);
        this.drawers.push((u) => {
          const p = traceTo(pts, u), [x, y] = p[p.length - 1];
          done.setAttribute('d', this.pathS(b, p));
          head.setAttribute('cx', this.XS(b, x).toFixed(1));
          head.setAttribute('cy', this.YS(b, y).toFixed(1));
        });
      } else if (m.kind === 'label') {
        const d = data as LabelData, at = d.at.map((q) => this.toAxes(b, q));
        const el = this.label(d.text[0], 0, 0, m.anchor, 'plot-mark', [m.panel, m.id], m.tone);
        el.classList.add(...m.cls);
        let shown = d.text[0];
        this.drawers.push((u) => {
          const [x, y] = at.length === 1 ? at[0] : (framesAt(at, u) as Pair);
          this.place(el, this.XS(b, x) + m.dx, this.YS(b, y) + m.dy, m.anchor);
          const text = nearest(d.text, u);
          if (text !== shown) { setMarkup(el, text); shown = text; }
        });
      } else {
        const events = data as PlotEvent[];
        const nodes = events.map((e) => {
          const X = this.X(b, e.at[0]), Y = this.Y(b, e.at[1]);
          const ring = svg('circle', { class: 'plot-ring', cx: X, cy: Y, r: m.size / 2, 'stroke-width': m.width }, group);
          const text = e.text ? this.label(e.text, X + m.dx, Y + m.dy, m.anchor, 'plot-mark', [m.panel, m.id], m.tone) : null;
          text?.classList.add(...m.cls);
          this.eventFrames.push({ frame: e.frame, names: [m.panel, m.id] });
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
    this.value.textContent = formatNumber(valueAt(tab.values, u), this.plot.parameter.digits);
    const at = `${(n > 1 ? u / (n - 1) : 0) * 100}%`;
    this.fill.style.width = at;
    this.knob.style.left = at;
    if (tab.active) {
      const on = nearest(tab.active, u), all = new Set(tab.active.flat());
      for (const { node, id } of this.emphasized) {
        node.classList.toggle('plot-on', on.includes(id));
        node.classList.toggle('plot-off', all.has(id) && !on.includes(id));
      }
    } else for (const { node } of this.emphasized) node.classList.remove('plot-on', 'plot-off');
  }

  private hidden(names: string[]): boolean {
    return names.some((s) => this.steps.has(s) && !this.shown.has(s));
  }

  private applyGates(): void {
    for (const { node, names } of this.gated) node.classList.toggle('plot-hidden', this.hidden(names));
    const n = this.frames;
    this.ticks.replaceChildren(...this.eventFrames.filter((e) => !this.hidden(e.names)).map((e) => {
      const t = document.createElement('div');
      t.className = 'plot-tick-mark';
      t.style.left = `${(n > 1 ? e.frame / (n - 1) : 0) * 100}%`;
      return t;
    }));
  }

  /** Reads the fragments of the slide: the names of data-plot-show, and the tab of the last visible data-plot-tab. */
  syncSteps(): void {
    if (!this.spec) return;
    const slide = this.el.closest('section');
    const frags = slide ? [...slide.querySelectorAll<HTMLElement>('.fragment')] : [];
    this.steps = new Set(frags.flatMap((f) => words(f.dataset.plotShow)));
    const visible = frags.filter((f) => f.classList.contains('visible'));
    this.shown = new Set(visible.flatMap((f) => words(f.dataset.plotShow)));
    const tabbed = visible.filter((f) => f.dataset.plotTab).sort((a, b) => +(a.dataset.fragmentIndex ?? 0) - +(b.dataset.fragmentIndex ?? 0));
    const name = tabbed.at(-1)?.dataset.plotTab ?? this.el.dataset.plotTab ?? null;
    if (name !== this.stepTab) {
      this.stepTab = name;
      const i = this.plot.tabs.findIndex((t) => t.name === name);
      if (i >= 0 && i !== this.tab) { this.setTab(i); return; }
    }
    this.applyGates();
  }

  /** Shows the tab i, from its first frame while the plot is played, and at its still frame otherwise. */
  setTab(i: number): void {
    if (!this.spec || i === this.tab) return;
    this.tab = i;
    this.markTabs();
    this.u = this.raf ? 0 : this.stillFrame();
    this.t0 = performance.now();
    if (this.W) this.buildMarks();
  }

  /** The frame of a still, from data-plot-frame, where a negative frame is counted from the end. The default is the last frame. */
  private stillFrame(): number {
    const f = Number(this.el.dataset.plotFrame ?? -1), n = this.frames;
    return clamp(Number.isFinite(f) ? (f < 0 ? n + f : f) : n - 1, 0, n - 1);
  }

  /** Draws the still frame, without the animation. */
  still(): void {
    if (!this.spec) return;
    this.pause();
    this.u = this.stillFrame();
    this.draw();
  }

  /** Starts the loop from the first frame, unless data-plot-paused is set or the motion is reduced. */
  start(): void {
    if (!this.spec) return;
    if (this.el.hasAttribute('data-plot-paused') || reduced()) { this.still(); return; }
    this.u = 0;
    this.play();
  }

  play(): void {
    if (!this.spec || this.raf) return;
    const { duration } = this.plot, n = this.frames;
    // a pass that ended is played again from the first frame
    if (this.u >= n - 1) this.u = 0;
    this.t0 = performance.now() - (n > 1 ? this.u / (n - 1) : 0) * duration * 1000;
    const tick = (now: number) => {
      this.u = loopFrame((now - this.t0) / 1000, this.frames, this.plot.duration, this.plot.hold);
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    this.setPlaying(true);
  }

  pause(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.setPlaying(false);
  }

  get playing(): boolean {
    return this.raf !== 0;
  }

  /** The fractional frame shown. */
  get frame(): number {
    return this.u;
  }
}

/** One PlotView per `.plot` element under root, reused when an element was mounted before. */
export function mountPlots(root: ParentNode): PlotView[] {
  return [...root.querySelectorAll<HTMLElement>('.plot')].map((el) => CACHE.get(el) ?? new PlotView(el));
}
