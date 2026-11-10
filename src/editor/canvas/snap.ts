// the snap engine of a drag, without the DOM: the edges and centers of a dragged box are snapped
// to those of the other elements, of the slide, and of the boxes of the layouts, and to equal gaps
// between neighbors, within a threshold. a resize snaps the edges that its handle moves. every box
// is in slide pixels of the 1920 by 1080 design size

import type { App } from '../app.ts';

export type Box = { left: number; top: number; width: number; height: number };
export type Axis = 'x' | 'y';
// a line at `at` on axis, drawn from `from` to `to` along the other axis
export type Guide = { axis: Axis; at: number; from: number; to: number; kind: 'element' | 'slide' | 'layout' };
// equal gaps along axis, each from `from` to `to`, drawn at `at` on the other axis
export type Spacing = { axis: Axis; gaps: { from: number; to: number; at: number }[] };
// the shift that snaps a box, in slide pixels, and the guides and gaps that it then lines up with
export type Snap = { dx: number; dy: number; guides: Guide[]; spacing: Spacing[] };
export type Targets = {
  // the other elements of the slide, which are also the neighbors of the equal gaps
  boxes: Box[];
  // boxes whose edges are lines but which are not neighbors, e.g. the zone around an image
  frames?: Box[];
  slide: { width: number; height: number };
  layout?: { x: number[]; y: number[] };
};
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

// the edges of the layouts of theme/beeson.css: the margins, the right edges of the narrow,
// content, and wide columns, the left edge of a zone, the running head, the top of the text, the
// bottom of a zone, and the bottom of the footnote
export const LAYOUT_GUIDES: { x: number[]; y: number[] } = { x: [120, 880, 1120, 1200, 1800], y: [44, 120, 920, 1030] };

// two lines closer than this, in slide pixels, are one
const SAME = 0.5;
// the smallest width or height of a resized box, in slide pixels
const MIN = 16;
// the distance of a mark of equal size from the box that it measures, in slide pixels
const SIZE_MARK = 14;

type Line = { at: number; kind: Guide['kind']; box: Box | null };

const start = (b: Box, axis: Axis) => (axis === 'x' ? b.left : b.top);
const size = (b: Box, axis: Axis) => (axis === 'x' ? b.width : b.height);
const end = (b: Box, axis: Axis) => start(b, axis) + size(b, axis);
const other = (axis: Axis): Axis => (axis === 'x' ? 'y' : 'x');
const edgesOf = (b: Box, axis: Axis) => [start(b, axis), start(b, axis) + size(b, axis) / 2, end(b, axis)];

function linesOf(targets: Targets, axis: Axis): Line[] {
  const extent = axis === 'x' ? targets.slide.width : targets.slide.height;
  const lines: Line[] = [0, extent / 2, extent].map((at) => ({ at, kind: 'slide', box: null }));
  for (const at of targets.layout?.[axis] ?? []) lines.push({ at, kind: 'layout', box: null });
  for (const box of [...targets.boxes, ...(targets.frames ?? [])]) for (const at of edgesOf(box, axis)) lines.push({ at, kind: 'element', box });
  return lines;
}

// the nearest line to one of edges within threshold, as the shift onto it
function nearest(edges: number[], lines: Line[], threshold: number): { shift: number; d: number } | null {
  let best: { shift: number; d: number } | null = null;
  for (const edge of edges) {
    for (const line of lines) {
      const d = Math.abs(line.at - edge);
      if (d <= threshold && (!best || d < best.d)) best = { shift: line.at - edge, d };
    }
  }
  return best;
}

// every line on axis that one of edges of box lies on. a line of an element is drawn across box
// and that element, and a line of the slide or of a layout across the whole slide
function guidesAt(box: Box, axis: Axis, edges: number[], lines: Line[], targets: Targets): Guide[] {
  const across = other(axis);
  const extent = across === 'x' ? targets.slide.width : targets.slide.height;
  const out = new Map<string, Guide>();
  for (const line of lines) {
    if (!edges.some((e) => Math.abs(line.at - e) < SAME)) continue;
    const key = `${line.kind === 'element' ? 'element' : 'full'}:${Math.round(line.at * 2)}`;
    const span = line.box
      ? { from: Math.min(start(box, across), start(line.box, across)), to: Math.max(end(box, across), end(line.box, across)) }
      : { from: 0, to: extent };
    const had = out.get(key);
    if (had) Object.assign(had, { from: Math.min(had.from, span.from), to: Math.max(had.to, span.to) });
    else out.set(key, { axis, at: line.at, kind: line.kind, ...span });
  }
  const full = [...out.values()].filter((g) => g.kind !== 'element');
  return [...out.values()].filter((g) => g.kind === 'element' && !full.some((f) => Math.abs(f.at - g.at) < SAME)).concat(full);
}

// the neighbors of box on axis, i.e. the boxes beside it that overlap it on the other axis, the
// nearest first, before it and after it
function neighbors(box: Box, axis: Axis, boxes: Box[]): { before: Box[]; after: Box[] } {
  const across = other(axis);
  const overlaps = (b: Box) => start(b, across) < end(box, across) && end(b, across) > start(box, across);
  const beside = boxes.filter(overlaps);
  const before = beside.filter((b) => end(b, axis) <= start(box, axis) + SAME).sort((a, b) => end(b, axis) - end(a, axis));
  const after = beside.filter((b) => start(b, axis) >= end(box, axis) - SAME).sort((a, b) => start(a, axis) - start(b, axis));
  return { before, after };
}

// the starts of box on axis at which its gap to a neighbor equals the gap next to it: the middle
// between a neighbor before and one after, and the place after or before a pair of neighbors at the
// gap of the pair
function spacingStarts(box: Box, axis: Axis, boxes: Box[]): number[] {
  const { before, after } = neighbors(box, axis, boxes);
  const out: number[] = [];
  const [a, b] = before;
  const [c, d] = after;
  if (a && c) out.push((end(a, axis) + start(c, axis) - size(box, axis)) / 2);
  if (a && b && end(b, axis) <= start(a, axis)) out.push(end(a, axis) + (start(a, axis) - end(b, axis)));
  if (c && d && start(d, axis) >= end(c, axis)) out.push(start(c, axis) - (start(d, axis) - end(c, axis)) - size(box, axis));
  return out;
}

// the gaps of box to its neighbors on axis that equal another gap of the row, with that gap, or
// null when no two gaps are equal
function spacingOf(box: Box, axis: Axis, boxes: Box[]): Spacing | null {
  const { before, after } = neighbors(box, axis, boxes);
  const across = other(axis);
  const gap = (from: Box, to: Box) => ({ from: end(from, axis), to: start(to, axis), at: (Math.max(start(from, across), start(to, across)) + Math.min(end(from, across), end(to, across))) / 2 });
  const [a, b] = before;
  const [c, d] = after;
  const near: ReturnType<typeof gap>[] = [];
  if (a) near.push(gap(a, box));
  if (c) near.push(gap(box, c));
  const far: ReturnType<typeof gap>[] = [];
  if (a && b && end(b, axis) <= start(a, axis)) far.push(gap(b, a));
  if (c && d && start(d, axis) >= end(c, axis)) far.push(gap(c, d));
  const width = (g: { from: number; to: number }) => g.to - g.from;
  for (const g of near) {
    const equal = [...near, ...far].filter((h) => h !== g && Math.abs(width(h) - width(g)) < SAME && width(g) > 0);
    if (equal.length) return { axis, gaps: [g, ...equal].sort((p, q) => p.from - q.from) };
  }
  return null;
}

// the shift of box onto the nearest line or equal gap within threshold, in slide pixels, on each
// axis that axes lets snap, with the guides and the equal gaps of the shifted box
export function snapMove(box: Box, targets: Targets, threshold: number, axes: { x: boolean; y: boolean } = { x: true, y: true }): Snap {
  const shift: Record<Axis, number> = { x: 0, y: 0 };
  const lines = { x: linesOf(targets, 'x'), y: linesOf(targets, 'y') };
  for (const axis of ['x', 'y'] as Axis[]) {
    if (!axes[axis]) continue;
    let best = nearest(edgesOf(box, axis), lines[axis], threshold);
    for (const at of spacingStarts(box, axis, targets.boxes)) {
      const d = Math.abs(at - start(box, axis));
      if (d <= threshold && (!best || d < best.d)) best = { shift: at - start(box, axis), d };
    }
    if (best) shift[axis] = best.shift;
  }
  const moved = { ...box, left: box.left + shift.x, top: box.top + shift.y };
  const guides: Guide[] = [];
  const spacing: Spacing[] = [];
  for (const axis of ['x', 'y'] as Axis[]) {
    if (!axes[axis]) continue;
    guides.push(...guidesAt(moved, axis, edgesOf(moved, axis), lines[axis], targets));
    const s = spacingOf(moved, axis, targets.boxes);
    if (s) spacing.push(s);
  }
  return { dx: shift.x, dy: shift.y, guides, spacing };
}

// the axis that a drag with Shift moves along: the axis of its larger offset, as in Keynote
export const lockedAxis = (dx: number, dy: number): Axis => (Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y');

// the sign of each edge that a handle moves: -1 the start, 1 the end, and 0 neither
const SIDES: Record<Handle, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
  nw: { x: -1, y: -1 }, n: { x: 0, y: -1 }, ne: { x: 1, y: -1 }, e: { x: 1, y: 0 },
  se: { x: 1, y: 1 }, s: { x: 0, y: 1 }, sw: { x: -1, y: 1 }, w: { x: -1, y: 0 },
};

// a box of width w and height h, anchored at the edge or corner of `from` across from handle, or at
// its center
function anchored(from: Box, handle: Handle, w: number, h: number, center: boolean): Box {
  const { x, y } = SIDES[handle];
  const cx = from.left + from.width / 2, cy = from.top + from.height / 2;
  const left = center || x === 0 ? cx - w / 2 : x === 1 ? from.left : from.left + from.width - w;
  const top = center || y === 0 ? cy - h / 2 : y === 1 ? from.top : from.top + from.height - h;
  return { left, top, width: w, height: h };
}

// the box of a resize of `from` by handle, for the pointer offset dx, dy in slide pixels. with an
// aspect, i.e. the ratio of width to height, the ratio is kept, and a corner follows the projection
// of the offset on its diagonal. without one, only the width changes, since the editor writes only a
// width. with center, the box is resized about its center
export function resizeBox(from: Box, handle: Handle, dx: number, dy: number, o: { aspect: number | null; center: boolean }): Box {
  const { x, y } = SIDES[handle];
  const k = o.center ? 2 : 1;
  let w = from.width;
  let h = from.height;
  if (o.aspect) {
    const a = o.aspect;
    if (x && y) w = from.width * (1 + (k * (x * dx * from.width + y * dy * from.height)) / (from.width ** 2 + from.height ** 2));
    else if (x) w = from.width + k * x * dx;
    else h = from.height + k * y * dy;
    if (x) h = w / a;
    else w = h * a;
    if (w < MIN || h < MIN) [w, h] = a >= 1 ? [MIN * a, MIN] : [MIN, MIN / a];
  } else if (x) w = Math.max(MIN, from.width + k * x * dx);
  return anchored(from, handle, w, h, o.center);
}

// the marks of equal size of box on axis: the extent of box and of each other box of the same width,
// or height, drawn as the marks of an equal gap beside each, or null when no other box matches
function sizesOf(box: Box, axis: Axis, boxes: Box[]): Spacing | null {
  const across = other(axis);
  const same = boxes.filter((b) => Math.abs(size(b, axis) - size(box, axis)) < SAME);
  if (!same.length) return null;
  const mark = (b: Box) => ({ from: start(b, axis), to: end(b, axis), at: start(b, across) - SIZE_MARK });
  return { axis, gaps: [box, ...same].map(mark) };
}

// box, the result of resizeBox, snapped: the edge that handle moves nearest to a line within
// threshold is put on it, or the size of the box nearest to that of another box is made equal to
// it, with the aspect and the anchor of resizeBox kept. the guides of the edges that moved and the
// marks of equal size are returned with it
export function snapResize(from: Box, handle: Handle, box: Box, targets: Targets, threshold: number, o: { aspect: number | null; center: boolean }): { box: Box; guides: Guide[]; sizes: Spacing[] } {
  const sides = SIDES[handle];
  const axes = (['x', 'y'] as Axis[]).filter((axis) => sides[axis] && (o.aspect || axis === 'x'));
  const moving = (b: Box, axis: Axis): number[] => {
    const sign = sides[axis];
    if (!axes.includes(axis)) return [];
    return o.center ? [start(b, axis), end(b, axis)] : [sign === 1 ? end(b, axis) : start(b, axis)];
  };
  const lines = { x: linesOf(targets, 'x'), y: linesOf(targets, 'y') };
  // the snap as the size that the box takes on an axis, and the distance that its edge moves for it
  let best: { axis: Axis; span: number; d: number } | null = null;
  const offer = (axis: Axis, span: number, d: number) => {
    if (d <= threshold && (!best || d < best.d)) best = { axis, span, d };
  };
  for (const axis of axes) {
    for (const edge of moving(box, axis)) {
      for (const line of lines[axis]) {
        const span = o.center ? 2 * Math.abs(line.at - (start(box, axis) + size(box, axis) / 2)) : Math.abs(line.at - (edge === end(box, axis) ? start(box, axis) : end(box, axis)));
        offer(axis, span, Math.abs(line.at - edge));
      }
    }
    for (const b of targets.boxes) offer(axis, size(b, axis), Math.abs(size(b, axis) - size(box, axis)) / (o.center ? 2 : 1));
  }
  let out = box;
  const snapped = best as { axis: Axis; span: number } | null;
  if (snapped) {
    let w = box.width, h = box.height;
    if (snapped.axis === 'x') {
      w = Math.max(MIN, snapped.span);
      if (o.aspect) h = w / o.aspect;
    } else {
      h = Math.max(MIN, snapped.span);
      if (o.aspect) w = h * o.aspect;
    }
    out = anchored(from, handle, w, h, o.center);
  }
  const guides: Guide[] = [];
  const sizes: Spacing[] = [];
  for (const axis of axes) {
    guides.push(...guidesAt(out, axis, moving(out, axis), lines[axis], targets));
    const s = sizesOf(out, axis, targets.boxes);
    if (s) sizes.push(s);
  }
  return { box: out, guides, sizes };
}

export function install(_app: App): void {
  // the engine is pure, and canvas/drag.ts calls it
}
