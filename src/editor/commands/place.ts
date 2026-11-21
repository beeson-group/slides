import type { App } from '../app.ts';
import { CONTAINER, snapBoxOf } from '../canvas/hit.ts';
import { inkBox, meets, promptBox, slideBox, takenBox, type Box } from './insert.ts';
import { keepPlaces } from '../canvas/drag.ts';

const SHOWN_CHILD = '.r-stack > :not(.beeson-off, [data-generated])';
export const FLOW_KIDS = [':scope > :not(.r-stack)', ':scope > .col > *', ':scope > .text-column > :not(.r-stack)', ':scope > .title-text > *', ':scope > .sec > *', `:scope > ${SHOWN_CHILD} > *`, `:scope > .text-column > ${SHOWN_CHILD} > *`].join(', ');

const FIGURE = `${CONTAINER}, img, video, .qr, .tikz, .surface, .plot, tycho-viewer, svg.line`;
const SKIP = 'aside.notes, script, style, .backdrop, .col, .text-column, .title-text, [data-generated]:not(.run)';
const ROOM = 24;
const STEP = 20;
export const MARGIN = 120;

const steps = (from: number, to: number, edges: number[]) => {
  const out = edges.filter((v) => v >= from && v <= to);
  for (let v = from; v <= to; v += STEP) out.push(v);
  return out;
};

const WORDS = 'h1, h2, h3, h4, p, ul, ol, dl, blockquote, div.math';

export const wordBox = (app: App, el: Element): Box | null =>
  !el.getClientRects().length ? null : el.matches(WORDS) ? inkBox(app, el) ?? promptBox(app, el) : takenBox(app, el);

const CELL = 20;
const COPY = 4;
export function drawnCells(app: App, backdrop: Element): Box[] {
  const cells = new Map<number, Box>();
  const slides = app.slides() as HTMLElement;
  const s = slides.getBoundingClientRect();
  const k = slides.offsetWidth ? s.width / slides.offsetWidth : 1;
  const copy = document.createElement('canvas');
  for (const c of backdrop.querySelectorAll('canvas')) {
    const r = c.getBoundingClientRect();
    if (!c.width || !c.height || !r.width) continue;
    copy.width = Math.ceil(r.width / k / COPY);
    copy.height = Math.ceil(r.height / k / COPY);
    const ctx = copy.getContext('2d', { willReadFrequently: true });
    let data: Uint8ClampedArray | undefined;
    try {
      ctx?.clearRect(0, 0, copy.width, copy.height);
      ctx?.drawImage(c, 0, 0, copy.width, copy.height);
      data = ctx?.getImageData(0, 0, copy.width, copy.height).data;
    } catch {
      continue;
    }
    if (!data) continue;
    const left = (r.left - s.left) / k, top = (r.top - s.top) / k;
    const dx = r.width / k / copy.width, dy = r.height / k / copy.height;
    for (let y = 0; y < copy.height; y++) {
      for (let x = 0; x < copy.width; x++) {
        if (!data[(y * copy.width + x) * 4 + 3]) continue;
        const x0 = left + x * dx, y0 = top + y * dy;
        for (let j = Math.floor(y0 / CELL); j <= Math.floor((y0 + dy - 0.01) / CELL); j++) {
          for (let i = Math.floor(x0 / CELL); i <= Math.floor((x0 + dx - 0.01) / CELL); i++) {
            cells.set(j * 1000 + i, { left: i * CELL, top: j * CELL, right: (i + 1) * CELL, bottom: (j + 1) * CELL });
          }
        }
      }
    }
  }
  return [...cells.values()];
}

export const framed = (el: Element) => el.matches(WORDS) && el.getClientRects().length > 0 && !!el.parentElement?.matches('section.title, section.closing');

const boxOf = (app: App, el: Element, words = false): Box | null => {
  if (!el.getClientRects().length) return null;
  if (!el.matches(FIGURE)) return el.matches('.run, .foot') ? slideBox(app, el) : words ? wordBox(app, el) : takenBox(app, el);
  const b = snapBoxOf(app, el);
  return { left: b.left, top: b.top, right: b.left + b.width, bottom: b.top + b.height };
};

export function freePlace(app: App, el: Element, picture?: HTMLElement): { x: number; y: number; width?: number } | null {
  const slide = el.closest('section') as HTMLElement | null;
  if (!slide || !el.getClientRects().length) return null;
  const w = slide.offsetWidth || 1920;
  const h = slide.offsetHeight || 1080;
  const others: { box: Box; text: boolean; ground: boolean }[] = [];
  const num = document.querySelector('.reveal .slide-number');
  for (const o of [...slide.querySelectorAll(FLOW_KIDS), ...(num ? [num] : [])]) {
    if (o === el || o.contains(el) || el.contains(o) || o.matches(SKIP)) continue;
    const box = boxOf(app, o);
    if (box && box.right - box.left > 1 && box.bottom - box.top > 1) {
      const ground = o.matches('.plate') && box.right - box.left >= w - 1 && box.bottom - box.top >= h - 1;
      others.push({ box, text: !o.matches(FIGURE), ground });
    }
  }
  const own = () => (el.matches(FIGURE) ? boxOf(app, el) : slideBox(app, el))!;
  const fits = (b: Box, level: number, room: number) => b.left >= 0 && b.top >= 0 && b.right <= w && b.bottom <= h &&
    !others.some((o) => (level === 0 || o.text || (level === 1 && !o.ground)) && meets({ left: b.left - room, top: b.top - room, right: b.right + room, bottom: b.bottom + room }, o.box));
  const b0 = own();
  if (fits(b0, 0, 0)) return null;
  const head = slide.querySelector(':scope > h2, :scope > h1');
  const under = Math.max(ROOM, head ? (takenBox(app, head)?.bottom ?? 0) + ROOM : 0);
  const nearest = (b: Box, level: number): Box | null => {
    const bw = b.right - b.left, bh = b.bottom - b.top;
    let best: Box | null = null;
    let near = Infinity;
    const side = bw + 2 * MARGIN <= w ? MARGIN : ROOM;
    const xs = steps(side, w - bw - side, others.map((o) => o.box.right + ROOM));
    for (const y of steps(under, h - bh - ROOM, others.map((o) => o.box.bottom + ROOM))) {
      for (const x of xs) {
        const at = { left: x, top: y, right: x + bw, bottom: y + bh };
        const d = Math.hypot(x - b.left, y - b.top);
        if (d < near && fits(at, level, ROOM)) {
          near = d;
          best = at;
        }
      }
    }
    return best;
  };
  const width = picture?.style.width ?? '';
  const base = b0.right - b0.left;
  const media = !!picture?.matches('img, video');
  const scales = (all: boolean) => (!picture ? [1] : media ? (all ? [1, 0.75, 0.5, 0.35, 0.25] : [0.5]) : [1, 0.75, 0.5]);
  try {
    const ground = others.some((o) => o.ground);
    for (const level of ground ? [0, 1, 2] : [0, 2]) {
      for (const k of scales(level === 0)) {
        if (picture) picture.style.width = k === 1 ? width : `${Math.round(base * k)}px`;
        const b = own();
        const p = nearest(b, level);
        if (p) return { x: Math.round(p.left - b.left), y: Math.round(p.top - b.top), ...(k < 1 ? { width: Math.round(base * k) } : {}) };
      }
    }
  } finally {
    if (picture) picture.style.width = width;
  }
  return { x: Math.round((w - b0.left - b0.right) / 2), y: Math.round((h - b0.top - b0.bottom) / 2) };
}

const SOLID = 'figure, .figure-box, .plate, img, video, .qr, .tikz, .surface, .plot, tycho-viewer, table, .run, .foot';

type Pieces = { solids: Box[]; texts: Box[]; heads?: Box[]; chrome?: Box[] };

export function piecesOf(app: App, el: Element): Pieces {
  const slide = el.closest('section') as HTMLElement;
  const w = slide.offsetWidth || 1920;
  const h = slide.offsetHeight || 1080;
  const out = { solids: [] as Box[], texts: [] as Box[], heads: [] as Box[], chrome: [] as Box[] };
  const add = (o: Element, box: Box | null) => {
    if (!box || box.right - box.left <= 1 || box.bottom - box.top <= 1) return;
    (o.matches(SOLID) || o.matches('.slide-number') ? out.solids : out.texts).push(box);
    if (o.matches('h1, h2')) out.heads.push(box);
    if (o.matches('.run, .foot, .slide-number')) out.chrome.push(box);
  };
  const num = document.querySelector('.reveal .slide-number');
  for (const o of [...slide.querySelectorAll(FLOW_KIDS), ...(num ? [num] : [])]) {
    if (o === el || o.contains(el) || el.contains(o) || o.matches(SKIP)) continue;
    const box = framed(o) ? slideBox(app, o) : boxOf(app, o, true);
    const all = o.matches('.plate') && o.getClientRects().length ? slideBox(app, o) : null;
    if (all && all.right - all.left >= w - 1 && all.bottom - all.top >= h - 1) {
      for (const c of o.children) if (c.getClientRects().length) out.solids.push(slideBox(app, c));
      out.solids = out.solids.filter((b) => b.right - b.left > 1 && b.bottom - b.top > 1);
    } else add(o, box);
  }
  return out;
}

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const grow = (b: Box, d: number): Box => ({ left: b.left - d, top: b.top - d, right: b.right + d, bottom: b.bottom + d });

export function centerPlace(w: number, h: number, bw: number, bh: number, pieces: Pieces, room: number, top: number): Box {
  const r8 = (v: number) => Math.round(v * 8) / 8;
  [bw, bh] = [r8(bw), r8(bh)];
  const snap = (all: Box[] = []) => all.map((b) => ({ left: r8(b.left), top: r8(b.top), right: r8(b.right), bottom: r8(b.bottom) }));
  const [solids, texts, heads, chrome] = [pieces.solids, pieces.texts, pieces.heads, pieces.chrome].map(snap);
  const at = (x: number, y: number): Box => ({ left: x, top: y, right: x + bw, bottom: y + bh });
  const center = at((w - bw) / 2, (h - bh) / 2);
  if (![...solids, ...texts].some((s) => meets(center, s))) return center;
  const side = bw + 2 * MARGIN <= w ? MARGIN : Math.max(0, (w - bw) / 2);
  const places = (gap: number): Box[] => {
    const xs = steps(side, w - bw - side, [center.left, w - bw - side, ...[...solids, ...texts].flatMap((s) => [s.left - bw - gap, s.right + gap])]);
    const ys = steps(top, h - bh - ROOM, [center.top, h - bh - ROOM, ...[...solids, ...texts].flatMap((s) => [s.top - bh - gap, s.bottom + gap])]);
    return ys.flatMap((y) => xs.map((x) => at(x, y)));
  };
  const far = (b: Box) => Math.hypot(b.left - center.left, b.top - center.top);
  const words = (b: Box) => [...texts, ...chrome].reduce((c, t) => c + overlap(b, t), 0);
  const unhead = (all: Box[]) => (all.some((b) => !heads.some((t) => meets(b, t))) ? all.filter((b) => !heads.some((t) => meets(b, t))) : all);
  const least = (all: Box[], cost: (b: Box) => number) => all.reduce<Box | null>((best, b) => (!best || cost(b) < cost(best) - 1 || (cost(b) <= cost(best) + 1 && far(b) < far(best)) ? b : best), null);
  for (const gap of [room, 0]) {
    const all = unhead(places(gap).filter((b) => !solids.some((s) => meets(grow(b, gap), s))).sort((a, b) => far(a) - far(b)));
    const best = all.find((b) => !texts.some((t) => meets(grow(b, room), t))) ?? all[0];
    if (best) return best;
  }
  const cost = (b: Box) => solids.reduce((c, s, i) => c + (pieces.chrome?.includes(pieces.solids[i]) ? 0 : overlap(b, s)), 0);
  const some = unhead(places(0));
  const low = least(some, cost);
  return least(some.filter((b) => low && cost(b) <= cost(low) + 1), words) ?? center;
}

export function translateOf(el: Element): { x: number; y: number } {
  const [x, y] = ((el as HTMLElement).style?.translate ?? '').split(' ').map((v) => parseFloat(v) || 0);
  return { x: x ?? 0, y: y ?? 0 };
}

export function placeNew(app: App, el: Element, picture?: HTMLElement): void {
  const f = freePlace(app, el, picture);
  if (!f) return;
  if (f.width && picture) app.doc.setTag(picture, { style: { width: `${f.width}px` } }, 'move');
  const t = translateOf(el);
  app.doc.setTag(el, { translate: { x: t.x + f.x, y: t.y + f.y } }, 'move');
}

export function keepBeside(app: App, outer: Element[]): (move: (el: Element, translate: { x: number; y: number }) => void) => void {
  return keepPlaces(app, outer.filter((el) => el.matches('section.figure .plate')), outer);
}

export function titlePlace(app: App, el: HTMLElement): { x: number; y: number; width?: number } {
  const slide = el.closest('section') as HTMLElement;
  const w = slide.offsetWidth || 1920, h = slide.offsetHeight || 1080;
  const others: Box[] = [];
  const num = document.querySelector('.reveal .slide-number');
  for (const o of [...slide.querySelectorAll(':scope > *, :scope > .title-text > *'), ...(num ? [num] : [])]) {
    if (o === el || o.matches(`${SKIP}, .title-text`)) continue;
    const b = framed(o) ? slideBox(app, o) : boxOf(app, o, true);
    if (b && b.right - b.left > 1 && b.bottom - b.top > 1) others.push(b);
  }
  const lockup = getComputedStyle(slide, '::before');
  if (lockup.content !== 'none' && lockup.position === 'absolute') {
    const left = parseFloat(lockup.left), top = parseFloat(lockup.top);
    others.push({ left, top, right: left + parseFloat(lockup.width), bottom: top + parseFloat(lockup.height) });
  }
  const cells = new Set([...slide.querySelectorAll(':scope > .backdrop')].flatMap((b) => drawnCells(app, b)).map((c) => (c.top / 20) * 1000 + c.left / 20));
  const inked = (b: Box) => {
    for (let j = Math.floor(b.top / 20); j * 20 < b.bottom; j++) for (let i = Math.floor(b.left / 20); i * 20 < b.right; i++) if (cells.has(j * 1000 + i)) return true;
    return false;
  };
  const width = el.style.width;
  const base = slideBox(app, el).right - slideBox(app, el).left;
  try {
    for (const ink of cells.size ? [true, false] : [false]) {
      for (const k of [1, 0.75, 0.5, 0.35]) {
        el.style.width = k === 1 ? width : `${Math.round(base * k)}px`;
        const b = slideBox(app, el);
        const bw = b.right - b.left, bh = b.bottom - b.top;
        const cx = (w - bw) / 2, cy = (h - bh) / 2;
        let best: Box | null = null;
        let near = Infinity;
        for (const y of steps(ROOM, h - 3 * bh - 3 * ROOM, [cy])) {
          for (const x of steps(MARGIN, w - bw - MARGIN, [cx])) {
            const at = { left: x, top: y, right: x + bw, bottom: y + bh };
            const d = Math.hypot(x - cx, y - cy);
            if (d < near && !others.some((o) => meets(grow(at, ROOM), o)) && !(ink && inked(at))) {
              near = d;
              best = at;
            }
          }
        }
        if (best) return { x: Math.round(best.left - b.left), y: Math.round(best.top - b.top), ...(k < 1 ? { width: Math.round(base * k) } : {}) };
      }
    }
  } finally {
    el.style.width = width;
  }
  const b = slideBox(app, el);
  return { x: Math.round((w - b.left - b.right) / 2), y: Math.round((h - b.top - b.bottom) / 2) };
}
