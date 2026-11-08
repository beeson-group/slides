// backdrops drawn from a file of polylines next to the deck, named in the attribute data-strands of
// a `.backdrop`. the format of the file is described in the README under "Backdrops"

import type { Strand, Tone } from './orbits.ts';

// one polyline of a file, e.g. one member of a family in one frame. t or theta, when given, is the
// clock of each point, e.g. the time or the true anomaly. the look of the strand is set with tone,
// a color of the theme, color, a CSS color or a pair of them for the dark and the light mode in
// place of the color of the tone, alpha, its opacity, weight, its width in line widths, head, the
// radius of its head in line widths, start, the clock at which its trace begins, and glow. the
// other keys are free
export type StrandRecord = {
  points: [number, number][];
  t?: number[];
  theta?: number[];
  tone?: Tone;
  color?: string | [string, string];
  alpha?: number;
  weight?: number;
  head?: number;
  start?: number;
  glow?: boolean;
  [key: string]: unknown;
};
export type StrandFile = { families: StrandRecord[]; bodies: Record<string, unknown>[] };
// a body drawn as a dot, with the fraction of the total mass that sets its radius when it is known
export type Dot = { x: number; y: number; mass?: number };
// the window of a backdrop: its center and its half height, in the units of the file
export type View = { cx: number; cy: number; half: number };
// a box in slide pixels
export type Box = { left: number; top: number; width: number; height: number };

// the fraction of the drawing held in the window of a fitted backdrop, with each strand weighted
// equally along its length. it is the fraction of tubes held in the window of the closing slide of
// the demo deck
export const FILL = 0.93;
// the margin in slide pixels between a drawing and an edge of its box inside the slide
const MARGIN = 40;
// the opacity of a strand colored from the palette, a little above the 0.42 of the tones orange and
// violet, since a member of a family is not overlaid by a dense tube
const INK_ALPHA = 0.6;

const isPair = (p: unknown): p is [number, number] =>
  Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isColorString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isColor = (v: unknown): v is string | [string, string] =>
  isColorString(v) || (Array.isArray(v) && v.length === 2 && v.every(isColorString));
// the tones of a record of a file. hero and line are the tones of the named scenes only
const TONES = ['orange', 'violet', 'text'];

// the records and bodies of a parsed file. throws an Error that says what is malformed
export function parse(data: unknown): StrandFile {
  const records = isObject(data) ? data.families : undefined;
  if (!Array.isArray(records)) throw new Error('it does not have a list "families"');
  records.forEach((r: unknown, i) => {
    if (!isObject(r) || !Array.isArray(r.points) || r.points.length < 2 || !r.points.every(isPair)) {
      throw new Error(`its record ${i} does not have a list "points" of at least two [x, y] pairs`);
    }
    for (const key of ['t', 'theta']) {
      const clock = r[key];
      if (
        clock !== undefined &&
        (!Array.isArray(clock) || clock.length !== r.points.length || !clock.every(Number.isFinite))
      ) {
        throw new Error(`the list "${key}" of its record ${i} does not have one number per point`);
      }
    }
    if (r.tone !== undefined && !TONES.includes(r.tone as string)) {
      throw new Error(`the "tone" of its record ${i} is not orange, violet, or text`);
    }
    if (r.color !== undefined && !isColor(r.color)) {
      throw new Error(`the "color" of its record ${i} is not a CSS color or a pair of them for the dark and the light mode`);
    }
    if (r.alpha !== undefined && !(typeof r.alpha === 'number' && r.alpha > 0 && r.alpha <= 1)) {
      throw new Error(`the "alpha" of its record ${i} is not a number above 0 and up to 1`);
    }
    for (const key of ['weight', 'head', 'start']) {
      const v = r[key];
      if (v !== undefined && !(typeof v === 'number' && Number.isFinite(v) && v >= 0)) {
        throw new Error(`the "${key}" of its record ${i} is not a number of zero or more`);
      }
    }
    if (r.glow !== undefined && typeof r.glow !== 'boolean') {
      throw new Error(`the "glow" of its record ${i} is not true or false`);
    }
  });
  const bodies = isObject(data) && Array.isArray(data.bodies) ? data.bodies.filter(isObject) : [];
  return { families: records as StrandRecord[], bodies };
}

const TERM = /^\s*([^=<>\s]+)\s*(<=|>=|=|<|>)\s*(.*?)\s*$/;

// the records chosen by spec, the value of data-strands-select. spec is a list of groups separated
// by semicolons, and a record is chosen when it passes every term of a group. the terms of a group
// are separated by commas, and a term is key=a, or key=a|b for either value, or key<v, key<=v,
// key>v, or key>=v for a number. throws an Error on a term of another form
export function select(records: StrandRecord[], spec: string | undefined): StrandRecord[] {
  if (!spec?.trim()) return records;
  const groups = spec.split(';').map(group);
  return records.filter((r) => groups.some((tests) => tests.every((test) => test(r))));
}

function group(spec: string): ((r: StrandRecord) => boolean)[] {
  return spec.split(',').map((term): ((r: StrandRecord) => boolean) => {
    const m = TERM.exec(term);
    if (!m || m[3] === '') throw new Error(`"${term.trim()}" is not a term key=value, key<number, or key>number`);
    const [, key, op, value] = m;
    if (op === '=') {
      const values = value.split('|').map((v) => v.trim());
      return (r) => values.includes(String(r[key]));
    }
    const v = Number(value);
    if (!Number.isFinite(v)) throw new Error(`"${value}" in "${term.trim()}" is not a number`);
    return (r) => {
      const x = r[key];
      if (typeof x !== 'number') return false;
      return op === '<' ? x < v : op === '<=' ? x <= v : op === '>' ? x > v : x >= v;
    };
  });
}

// the strands of the records chosen from file. with color, the key of data-strands-color, each value
// of this key takes a pair of colors of the palette, in the order of its first record in the file.
// with ramp, the key of data-strands-ramp, a strand is colored from the first color of its pair at the
// smallest value of ramp among the chosen records of its pair to the second at the largest. the
// clock of a strand is moved by the start of its record, and the look of the record is copied
export function strandsOf(file: StrandFile, chosen: StrandRecord[], color?: string, ramp?: string): Strand[] {
  const order = color ? [...new Set(file.families.map((r) => String(r[color])))] : [];
  const pairOf = (r: StrandRecord) => (color ? order.indexOf(String(r[color])) : 0);
  const range = new Map<number, [number, number]>();
  if (ramp) {
    for (const r of chosen) {
      const v = r[ramp];
      if (typeof v !== 'number') continue;
      const [lo, hi] = range.get(pairOf(r)) ?? [v, v];
      range.set(pairOf(r), [Math.min(lo, v), Math.max(hi, v)]);
    }
  }
  return chosen.map((r) => {
    const n = r.points.length,
      pts = new Float64Array(2 * n),
      times = new Float32Array(n);
    const clock = r.t ?? r.theta;
    let length = 0;
    for (let i = 0; i < n; i++) {
      pts[2 * i] = r.points[i][0];
      pts[2 * i + 1] = r.points[i][1];
      // without a clock, a strand is traced at a uniform speed along its length
      if (i > 0 && !clock) length += Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]);
      times[i] = (clock ? clock[i] - clock[0] : length) + (r.start ?? 0);
    }
    const strand: Strand = { pts, times, T: times[n - 1] };
    if (color || ramp) {
      const pair = pairOf(r),
        [lo, hi] = range.get(pair) ?? [0, 0],
        v = ramp ? r[ramp] : undefined;
      strand.ink = { pair, at: typeof v === 'number' && hi > lo ? (v - lo) / (hi - lo) : 0 };
      strand.alpha = INK_ALPHA;
    }
    if (r.tone) strand.tone = r.tone;
    if (r.color !== undefined) strand.color = r.color;
    if (r.alpha !== undefined) strand.alpha = r.alpha;
    if (r.weight !== undefined) strand.weight = r.weight;
    if (r.head !== undefined) strand.head = r.head;
    if (r.glow) strand.glow = true;
    return strand;
  });
}

// the bodies of the chosen records that are fixed in their frame. a body record of the file is matched
// to a record when every number, string, or boolean of the body record is equal to the value of the
// same key in the record, if the record has this key. the positions are read from the object of the
// body record named by the frame of the record, or from the body record itself. a body, e.g. m1 at
// one mu, is drawn only when it is at one position in all the chosen records, hence the primary and
// the secondary are drawn in the rotating-pulsating frame, and not at their many places at theta = 0
// in the inertial frame. m1 and m2 are given the masses 1 - mu and mu
export function bodiesOf(file: StrandFile, chosen: StrandRecord[]): Dot[] {
  const places = new Map<string, Set<string>>(),
    dots = new Map<string, Dot>();
  for (const r of chosen) {
    for (const body of file.bodies) {
      const own = Object.entries(body).filter(([, v]) => ['number', 'string', 'boolean'].includes(typeof v));
      if (!own.every(([k, v]) => !(k in r) || r[k] === v)) continue;
      const at = r.frame === undefined ? body : body[String(r.frame)];
      if (!isObject(at)) continue;
      const mu = typeof body.mu === 'number' ? body.mu : typeof r.mu === 'number' ? r.mu : undefined;
      for (const [name, p] of Object.entries(at)) {
        if (!isPair(p)) continue;
        const who = `${name} ${mu} ${r.frame}`;
        places.set(who, (places.get(who) ?? new Set()).add(`${p[0]},${p[1]}`));
        const mass = mu === undefined ? undefined : name === 'm1' ? 1 - mu : name === 'm2' ? mu : undefined;
        dots.set(who, { x: p[0], y: p[1], mass });
      }
    }
  }
  return [...dots].filter(([who]) => places.get(who)?.size === 1).map(([, dot]) => dot);
}

// the window of the box in which FILL of the strands is held, centered on the middle of the
// drawing. the drawing may run off the slide, but an edge of the box inside the slide is kept
// MARGIN slide pixels clear of it, as asked in AGENTS.md of every backdrop. null without strands
export function fitView(strands: Strand[], box: Box, slide: { width: number; height: number }): View | null {
  // the midpoints of the segments, with weights that sum to 1 on each strand
  const xs: number[] = [],
    ys: number[] = [],
    ws: number[] = [];
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const s of strands) {
    const p = s.pts,
      n = p.length / 2;
    let length = 0;
    for (let i = 1; i < n; i++) length += Math.hypot(p[2 * i] - p[2 * i - 2], p[2 * i + 1] - p[2 * i - 1]);
    for (let i = 0; i < n; i++) {
      x0 = Math.min(x0, p[2 * i]);
      x1 = Math.max(x1, p[2 * i]);
      y0 = Math.min(y0, p[2 * i + 1]);
      y1 = Math.max(y1, p[2 * i + 1]);
    }
    for (let i = 1; i < n; i++) {
      const d = Math.hypot(p[2 * i] - p[2 * i - 2], p[2 * i + 1] - p[2 * i - 1]);
      xs.push((p[2 * i] + p[2 * i - 2]) / 2);
      ys.push((p[2 * i + 1] + p[2 * i - 1]) / 2);
      ws.push(length > 0 ? d / length : 1 / (n - 1));
    }
  }
  if (!ws.length || !(box.width > 0) || !(box.height > 0)) return null;
  const total = ws.reduce((a, b) => a + b, 0);
  const quantile = (v: number[], q: number) => {
    const order = v.map((_, i) => i).sort((a, b) => v[a] - v[b]);
    let held = 0;
    for (const i of order) {
      held += ws[i];
      if (held >= q * total) return v[i];
    }
    return v[order[order.length - 1]];
  };
  const lo = (1 - FILL) / 2,
    hi = 1 - lo;
  const qx = [quantile(xs, lo), quantile(xs, hi)],
    qy = [quantile(ys, lo), quantile(ys, hi)];
  let cx = (qx[0] + qx[1]) / 2,
    cy = (qy[0] + qy[1]) / 2;
  const aspect = box.width / box.height;
  const held = (half: number) => {
    let k = 0;
    for (let i = 0; i < ws.length; i++)
      if (Math.abs(xs[i] - cx) <= half * aspect && Math.abs(ys[i] - cy) <= half) k += ws[i];
    return k / total;
  };
  // the half height that holds FILL, by bisection, since held grows with it
  let a = 0,
    b = Math.max(Math.max(cx - x0, x1 - cx) / aspect, Math.max(cy - y0, y1 - cy), 1e-9);
  for (let i = 0; i < 50; i++) {
    const m = (a + b) / 2;
    if (held(m) >= FILL) b = m;
    else a = m;
  }
  let half = b;
  const inner = {
    left: box.left > 0.5,
    right: box.left + box.width < slide.width - 0.5,
    top: box.top > 0.5,
    bottom: box.top + box.height < slide.height - 0.5,
  };
  // the margin is MARGIN / k in the units of the file, with k = box.height / (2 half) the scale in
  // slide pixels, hence the margin is half times g
  const g = (2 * MARGIN) / box.height;
  // along an axis, the span from the edge of the drawing at an inner side, or else from the quantile
  // at this side, must fit in the window with a margin at each inner side
  const need = (span: number, sides: number, width: number) => span / Math.max(width - sides * g, 1e-9);
  half = Math.max(
    half,
    need((inner.right ? x1 : qx[1]) - (inner.left ? x0 : qx[0]), +inner.left + +inner.right, 2 * aspect),
    need((inner.top ? y1 : qy[1]) - (inner.bottom ? y0 : qy[0]), +inner.top + +inner.bottom, 2),
  );
  const m = half * g,
    w = half * aspect;
  const clamp = (v: number, low: number, high: number) => Math.min(Math.max(v, low), high);
  cx = clamp(cx, inner.right ? x1 + m - w : -Infinity, inner.left ? x0 - m + w : Infinity);
  cy = clamp(cy, inner.top ? y1 + m - half : -Infinity, inner.bottom ? y0 - m + half : Infinity);
  return { cx, cy, half };
}

// the color at the fraction at from the color from to the color to, interpolated in OKLCH along the
// shorter arc of hue. both colors are #rrggbb or rgb(r, g, b), as serialized by a canvas, and the
// result is #rrggbb. null when either color is of another form
export function mix(from: string, to: string, at: number): string | null {
  const a = rgbOf(from),
    b = rgbOf(to);
  if (!a || !b) return null;
  const [L1, C1, h1] = lch(a),
    [L2, C2, h2] = lch(b);
  let dh = h2 - h1;
  if (dh > Math.PI) dh -= 2 * Math.PI;
  if (dh < -Math.PI) dh += 2 * Math.PI;
  const L = L1 + (L2 - L1) * at,
    C = C1 + (C2 - C1) * at,
    h = h1 + dh * at;
  return hex(rgbFromLab([L, C * Math.cos(h), C * Math.sin(h)]));
}

function rgbOf(color: string): [number, number, number] | null {
  const c = color.trim();
  let m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
  if (m) return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
  if (m) return [parseInt(m[1], 16) / 15, parseInt(m[2], 16) / 15, parseInt(m[3], 16) / 15];
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(c);
  if (m) return [+m[1] / 255, +m[2] / 255, +m[3] / 255];
  return null;
}

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

// lightness, chroma, and hue in rad of an sRGB color, by the OKLab matrices of Björn Ottosson
function lch([R, G, B]: [number, number, number]): [number, number, number] {
  const r = linear(R),
    g = linear(G),
    b = linear(B);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, Bb), Math.atan2(Bb, A)];
}

function rgbFromLab([L, A, B]: [number, number, number]): [number, number, number] {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const hex = (c: [number, number, number]) =>
  `#${c
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

// the data given by the script files that were run, by their absolute URLs
const given = new Map<string, unknown>();
const files = new Map<string, Promise<StrandFile | null>>();

// called in a script file of polylines, i.e. a JSON file wrapped in Beeson.strands( and );, which is
// read in a deck opened from the disk, where a JSON file cannot be fetched
export function register(data: unknown): void {
  const script = document.currentScript;
  if (script instanceof HTMLScriptElement && script.src) given.set(script.src, data);
}

function read(url: string, path: string): Promise<unknown> {
  if (!/\.js$/i.test(new URL(url).pathname)) {
    if (location.protocol === 'file:') {
      return Promise.reject(
        new Error(
          `a JSON file cannot be read in a deck opened from the disk. Wrap it in Beeson.strands( and ); and name the .js file in data-strands`,
        ),
      );
    }
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error(`it was answered with HTTP ${r.status}`);
      return r.json();
    });
  }
  if (given.has(url)) return Promise.resolve(given.get(url));
  return new Promise((done, fail) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () =>
      given.has(url) ? done(given.get(url)) : fail(new Error(`${path} does not call Beeson.strands`));
    script.onerror = () => fail(new Error('it was not found'));
    document.head.append(script);
  });
}

// the parsed file at path, relative to the deck, read once for all the backdrops that name it. a
// missing or malformed file is reported in one console warning and given as null
export function load(path: string): Promise<StrandFile | null> {
  const url = new URL(path, document.baseURI).href;
  let out = files.get(url);
  if (!out) {
    out = read(url, path)
      .then(parse)
      .catch((error: Error) => {
        console.warn(`beeson: the backdrop file ${path} is not drawn, since ${error.message}`);
        return null;
      });
    files.set(url, out);
  }
  return out;
}

// the strands and bodies of the backdrop el, from its attributes data-strands, data-strands-select,
// data-strands-color, and data-strands-ramp. never throws, and gives empty lists after a warning
export async function strandsFor(el: HTMLElement): Promise<{ strands: Strand[]; dots: Dot[] }> {
  const path = el.dataset.strands ?? '';
  const file = await load(path);
  if (!file) return { strands: [], dots: [] };
  try {
    const chosen = select(file.families, el.dataset.strandsSelect);
    if (!chosen.length)
      console.warn(`beeson: data-strands-select="${el.dataset.strandsSelect}" does not match a record of ${path}`);
    return {
      strands: strandsOf(file, chosen, el.dataset.strandsColor || undefined, el.dataset.strandsRamp || undefined),
      dots: bodiesOf(file, chosen),
    };
  } catch (error) {
    console.warn(`beeson: the backdrop of ${path} is not drawn, since ${(error as Error).message}`);
    return { strands: [], dots: [] };
  }
}
