// backdrops drawn from a file of polylines next to the deck, named in the attribute data-strands of
// a `.backdrop`. the format of the file is described in the README under "Backdrops"

import type { Strand, Tone } from './orbits.ts';

// one polyline of a file, e.g. one member of a family in one frame. t or theta, when given, is the
// clock of each point, e.g. the time or the true anomaly. craft, when true, marks the path of a
// spacecraft. the look of the strand is set with tone, a color of the theme, color, a CSS color or
// a pair of them for the dark and the light mode in place of the color of the tone, alpha, its
// opacity, weight, its width in line widths, head, the radius of its head in line widths, start,
// the clock at which its trace begins, fade, the seconds of its clock from its first point after
// which its opacity falls to zero at its last point, and glow. the other keys are free
export type StrandRecord = {
  points: [number, number][];
  t?: number[];
  theta?: number[];
  craft?: boolean;
  tone?: Tone;
  color?: string | [string, string];
  alpha?: number;
  weight?: number;
  head?: number;
  start?: number;
  fade?: number;
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
    for (const key of ['weight', 'head', 'start', 'fade']) {
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
// smallest value of ramp among the chosen records of its pair to the second at the largest. with
// shade, the key of data-strands-shade, which is used in place of ramp, a strand is drawn in a shade of
// the first color of its pair, from a lighter shade at the smallest value to a darker at the largest.
// with map, the colormap of data-strands-colormap, a strand is colored from map at its fraction along
// ramp instead, and shade is ignored. the clock of a strand is moved by the start of its record, and
// the look of the record is copied
export function strandsOf(file: StrandFile, chosen: StrandRecord[], color?: string, ramp?: string, shade?: string, map?: Colormap): Strand[] {
  if (map) shade = undefined;
  const along = shade ?? ramp;
  const order = color ? [...new Set(file.families.map((r) => String(r[color])))] : [];
  const pairOf = (r: StrandRecord) => (color ? order.indexOf(String(r[color])) : 0);
  const range = new Map<number, [number, number]>();
  if (along) {
    for (const r of chosen) {
      const v = r[along];
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
    if (r.craft === true) strand.craft = true;
    if (color || along || map) {
      const pair = pairOf(r),
        [lo, hi] = range.get(pair) ?? [0, 0],
        v = along ? r[along] : undefined;
      strand.ink = { pair, at: typeof v === 'number' && hi > lo ? (v - lo) / (hi - lo) : 0 };
      if (shade) strand.ink.shade = true;
      if (map) strand.ink.map = map;
      strand.alpha = map ? MAP_ALPHA : INK_ALPHA;
    }
    if (r.tone) strand.tone = r.tone;
    if (r.color !== undefined) strand.color = r.color;
    if (r.alpha !== undefined) strand.alpha = r.alpha;
    if (r.weight !== undefined) strand.weight = r.weight;
    if (r.head !== undefined) strand.head = r.head;
    if (r.fade !== undefined) strand.fade = r.fade;
    if (r.glow) strand.glow = true;
    return strand;
  });
}

// the distance in the units of a file within which two positions of a body are taken as one
const SAME = 1e-4;

// the bodies of the chosen records, drawn only when every chosen record puts the same bodies at the
// same positions within SAME, e.g. m1 and m2 of one mass ratio in the rotating-pulsating frame. none
// is drawn otherwise, e.g. in the inertial frame, where the bodies move, or for records of two mass
// ratios. a body record of the file is matched to a record when every number, string, or boolean of
// the body record is equal to the value of the same key in the record, if the record has this key.
// the positions are read from the object of the body record named by the frame of the record, or
// from the body record itself. m1 and m2 are given the masses 1 - mu and mu
export function bodiesOf(file: StrandFile, chosen: StrandRecord[]): Dot[] {
  const apart = (a: Dot, b: Dot) => Math.hypot(a.x - b.x, a.y - b.y) > SAME;
  let first: Map<string, Dot> | null = null;
  for (const r of chosen) {
    const own = new Map<string, Dot>();
    for (const body of file.bodies) {
      const keys = Object.entries(body).filter(([, v]) => ['number', 'string', 'boolean'].includes(typeof v));
      if (!keys.every(([k, v]) => !(k in r) || r[k] === v)) continue;
      const at = r.frame === undefined ? body : body[String(r.frame)];
      if (!isObject(at)) continue;
      const mu = typeof body.mu === 'number' ? body.mu : typeof r.mu === 'number' ? r.mu : undefined;
      for (const [name, p] of Object.entries(at)) {
        if (!isPair(p)) continue;
        const dot = { x: p[0], y: p[1], mass: mu === undefined ? undefined : name === 'm1' ? 1 - mu : name === 'm2' ? mu : undefined };
        const was = own.get(name);
        if (was && apart(was, dot)) return [];
        own.set(name, dot);
      }
    }
    const seen: Map<string, Dot> = first ?? own;
    if (own.size !== seen.size || [...own].some(([name, d]) => !seen.has(name) || apart(seen.get(name) as Dot, d))) return [];
    first = seen;
  }
  return first ? [...first.values()] : [];
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

// the change of OKLCH lightness from the middle shade to either end of the shades of a color
const SHADES = 0.16;
// the least WCAG contrast against the background of a shade drawn at INK_ALPHA, met by every color
// of the palette in theme/beeson.css
export const CONTRAST = 2.5;

// the WCAG contrast against the background bg of the color c drawn over it at the opacity alpha, as
// a canvas blends them, both in sRGB from 0 to 1
function contrastOver(c: [number, number, number], bg: [number, number, number], alpha = INK_ALPHA): number {
  const luminance = ([R, G, B]: number[]) => 0.2126 * linear(R) + 0.7152 * linear(G) + 0.0722 * linear(B);
  const a = luminance(c.map((v, i) => alpha * v + (1 - alpha) * bg[i])),
    b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// the shade at the fraction at of a color, from a lighter shade at 0 to a darker at 1, by a change of
// its OKLCH lightness at the same chroma and hue. with the background bg, the shades are moved away
// from bg until the end on its side keeps CONTRAST against it, e.g. lighter on a dark background.
// the colors are #rrggbb or rgb(r, g, b), and the result is #rrggbb. null when the color is of
// another form
export function shadeOf(color: string, at: number, bg?: string): string | null {
  const c = rgbOf(color);
  if (!c) return null;
  const [L, C, h] = lch(c);
  const shade = (l: number) => hex(rgbFromLab([l, C * Math.cos(h), C * Math.sin(h)]));
  let light = Math.min(0.95, L + SHADES),
    dark = Math.max(0.2, L - SHADES);
  const back = bg ? rgbOf(bg) : null;
  if (back) {
    // the contrast grows away from the background, hence the lightness at which the near end keeps
    // CONTRAST is found by bisection, and the far end is moved as much, within its bound
    const below = lch(back)[0] < L,
      near = below ? dark : light,
      far = below ? 0.95 : 0.2;
    const keeps = (l: number) => contrastOver(rgbOf(shade(l)) as [number, number, number], back) >= CONTRAST;
    if (!keeps(near) && keeps(far)) {
      let a = near,
        b = far;
      for (let i = 0; i < 30; i++) {
        const m = (a + b) / 2;
        if (keeps(m)) b = m;
        else a = m;
      }
      if (below) [dark, light] = [b, Math.min(0.95, light + b - near)];
      else [light, dark] = [b, Math.max(0.2, dark + b - near)];
    }
  }
  return shade(light + (dark - light) * at);
}

// the colormaps of matplotlib named in data-strands-colormap, as colors at even stops from 0 to 1.
// the stops were sampled from matplotlib's own viridis, plasma, and Blues_r at 17 stops each.
// interpolated linearly in sRGB, they stay within 0.6 of matplotlib in OKLab distance times 100 at
// every point, and they give the ends of colormapEnds() that matplotlib gives on --bg of the dark
// mode. ends are the default lower and upper ends, short of the yellow end of viridis and plasma and
// of the white end of Blues_r
export const COLORMAPS = {
  viridis: {
    stops: ['#440154', '#48186a', '#472d7b', '#424086', '#3b528b', '#33638d', '#2c728e', '#26818e', '#21908c', '#1f9f88', '#28ae80', '#3ebc74', '#5dc963', '#82d34c', '#abdc32', '#d5e21a', '#fde725'],
    ends: [0, 0.85],
  },
  plasma: {
    stops: ['#0d0887', '#310596', '#4c02a1', '#6600a7', '#7e03a8', '#9511a2', '#a92396', '#bb3587', '#cb4778', '#d9596a', '#e66c5c', '#f07f4f', '#f89441', '#fdab33', '#fdc328', '#f9dd25', '#f0f921'],
    ends: [0, 0.85],
  },
  Blues_r: {
    stops: ['#08306b', '#084084', '#08519c', '#1461a9', '#2171b5', '#3282be', '#4292c6', '#56a0ce', '#6baed6', '#84bcdb', '#9ecae1', '#b2d2e8', '#c6dbef', '#d2e3f3', '#deebf7', '#eaf3fb', '#f7fbff'],
    ends: [0, 0.683],
  },
} as const;
export type ColormapName = keyof typeof COLORMAPS;
// a colormap with its lower and upper ends in [0, 1], before they are moved for the background
export type Colormap = { name: ColormapName; lo: number; hi: number };

// the least WCAG contrast of an end of a colormap, drawn opaque, against the background, as in
// matplotlib figures drawn for the slides, whose dark end is cut in dark mode until it keeps 3:1
export const MAP_CONTRAST = 3;
// the opacity of a strand colored from a colormap. it is opaque, hence the color on the slide is the
// color of the matplotlib figures, and the MAP_CONTRAST of colormapEnds() holds as drawn
export const MAP_ALPHA = 1;

// the colormap of spec, the value of data-strands-colormap: a name of COLORMAPS, alone or followed by
// a lower and an upper end, e.g. viridis 0 0.85. throws an Error that says what is malformed
export function colormapOf(spec: string): Colormap {
  const [name, ...ends] = spec.trim().split(/\s+/);
  if (!Object.prototype.hasOwnProperty.call(COLORMAPS, name)) throw new Error(`"${name}" is not viridis, plasma, or Blues_r`);
  const map = COLORMAPS[name as ColormapName];
  if (!ends.length) return { name: name as ColormapName, lo: map.ends[0], hi: map.ends[1] };
  const [lo, hi] = ends.map(Number);
  if (ends.length !== 2 || !(lo >= 0 && lo < hi && hi <= 1)) {
    throw new Error(`"${ends.join(' ')}" is not a lower and an upper end with 0 <= lower < upper <= 1`);
  }
  return { name: name as ColormapName, lo, hi };
}

// the color of the colormap name at x from 0 to 1, as #rrggbb
export function colormapAt(name: ColormapName, x: number): string {
  const stops = COLORMAPS[name].stops,
    n = stops.length - 1;
  const u = Math.min(Math.max(x, 0), 1) * n,
    k = Math.min(Math.floor(u), n - 1);
  const a = rgbOf(stops[k]) as [number, number, number],
    b = rgbOf(stops[k + 1]) as [number, number, number];
  return hex(a.map((v, i) => v + (b[i] - v) * (u - k)) as [number, number, number]);
}

// the ends of map on the background bg. an end whose color, drawn opaque, is short of MAP_CONTRAST
// against bg is moved toward the other end in steps of 0.01 until it keeps it, e.g. the lower, dark
// end of viridis on a dark background and its upper, light end on a light one. the other end is kept
export function colormapEnds(map: Colormap, bg?: string): [number, number] {
  const back = bg ? rgbOf(bg) : null;
  if (!back) return [map.lo, map.hi];
  const keeps = (x: number) => contrastOver(rgbOf(colormapAt(map.name, x)) as [number, number, number], back, 1) >= MAP_CONTRAST;
  // the ends are rounded, since a sum of steps of 0.01 is not exact in binary
  const round = (x: number) => Math.round(x * 1e9) / 1e9;
  let lo = map.lo,
    hi = map.hi;
  for (let k = 1; !keeps(lo) && lo < hi; k++) lo = round(map.lo + k / 100);
  for (let k = 1; !keeps(hi) && hi > lo; k++) hi = round(map.hi - k / 100);
  return [Math.min(lo, hi), hi];
}

// the color of map at the fraction at from the lower to the upper end of colormapEnds() on bg
export function colormapColor(map: Colormap, at: number, bg?: string): string {
  const [lo, hi] = colormapEnds(map, bg);
  return colormapAt(map.name, lo + (hi - lo) * at);
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

// the colormap of the backdrop el from its attribute data-strands-colormap, or undefined without it.
// a malformed attribute is reported in a warning, and the strands are then colored from the palette
function colormapFor(el: HTMLElement): Colormap | undefined {
  const spec = el.dataset.strandsColormap;
  if (!spec?.trim()) return undefined;
  let map: Colormap;
  try {
    map = colormapOf(spec);
  } catch (error) {
    console.warn(`beeson: data-strands-colormap="${spec}" is not used, since ${(error as Error).message}. The strands are colored from the palette`);
    return undefined;
  }
  if (el.dataset.strandsShade)
    console.warn(`beeson: data-strands-shade="${el.dataset.strandsShade}" is ignored, since data-strands-colormap is given`);
  return map;
}

// the strands and bodies of the backdrop el, from its attributes data-strands, data-strands-select,
// data-strands-color, data-strands-ramp, data-strands-shade, and data-strands-colormap. never throws,
// and gives empty lists after a warning
export async function strandsFor(el: HTMLElement): Promise<{ strands: Strand[]; dots: Dot[] }> {
  const path = el.dataset.strands ?? '';
  const file = await load(path);
  if (!file) return { strands: [], dots: [] };
  try {
    const chosen = select(file.families, el.dataset.strandsSelect);
    if (!chosen.length)
      console.warn(`beeson: data-strands-select="${el.dataset.strandsSelect}" does not match a record of ${path}`);
    return {
      strands: strandsOf(
        file,
        chosen,
        el.dataset.strandsColor || undefined,
        el.dataset.strandsRamp || undefined,
        el.dataset.strandsShade || undefined,
        colormapFor(el),
      ),
      dots: bodiesOf(file, chosen),
    };
  } catch (error) {
    console.warn(`beeson: the backdrop of ${path} is not drawn, since ${(error as Error).message}`);
    return { strands: [], dots: [] };
  }
}
