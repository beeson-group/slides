// the place of a new element on its slide, the one rule of every insert: the element stays where its
// layout puts it while it lies over nothing, and else it is moved to the free place nearest to it
// under the heading, as placeTable of table.ts places a new table. a free place is off every text
// and the chrome, i.e. the running head, the footnote line, and the slide number, and first off the
// figures as well, for which a new picture is drawn smaller. without a free place, the element is
// put at the center of the slide, where Keynote puts a new object

import type { App } from '../app.ts';
import { CONTAINER, snapBoxOf } from '../canvas/hit.ts';
import { meets, slideBox, takenBox, type Box } from './insert.ts';

// what a new element may lie over when nothing else is free: a figure or a drawing, but not a text
const FIGURE = `${CONTAINER}, img, video, .qr, .surface, .plot, tycho-viewer, svg.line`;
const SKIP = 'aside.notes, script, style, .backdrop, .col, .panel, .block, [data-generated]:not(.run)';
// the room around a new element, and the step of the grid on which a free place is looked for, in
// slide px
const ROOM = 24;
const STEP = 20;
// the margin of the layouts at the left and the right of a slide, in slide px
const MARGIN = 120;

const boxOf = (app: App, el: Element): Box | null => {
  if (!el.getClientRects().length) return null;
  if (!el.matches(FIGURE)) return el.matches('.run, .foot') ? slideBox(app, el) : takenBox(app, el);
  const b = snapBoxOf(app, el);
  return { left: b.left, top: b.top, right: b.left + b.width, bottom: b.top + b.height };
};

// the offset in slide px that puts el in free space, with the width in px of its picture when it is
// drawn smaller, or null when it stays
export function freePlace(app: App, el: Element, picture?: HTMLElement): { x: number; y: number; width?: number } | null {
  const slide = el.closest('section') as HTMLElement | null;
  if (!slide || !el.getClientRects().length) return null;
  const w = slide.offsetWidth || 1920;
  const h = slide.offsetHeight || 1080;
  const others: { box: Box; text: boolean }[] = [];
  const num = document.querySelector('.reveal .slide-number');
  for (const o of [...slide.querySelectorAll(':scope > *, :scope > .col > *, :scope > .panel > *, :scope > .block > *'), ...(num ? [num] : [])]) {
    if (o === el || o.contains(el) || el.contains(o) || o.matches(SKIP)) continue;
    const box = boxOf(app, o);
    if (box && box.right - box.left > 1 && box.bottom - box.top > 1) others.push({ box, text: !o.matches(FIGURE) });
  }
  const own = () => (el.matches(FIGURE) ? boxOf(app, el) : slideBox(app, el))!;
  const fits = (b: Box, all: boolean, room: number) => b.left >= 0 && b.top >= 0 && b.right <= w && b.bottom <= h &&
    !others.some((o) => (all || o.text) && meets({ left: b.left - room, top: b.top - room, right: b.right + room, bottom: b.bottom + room }, o.box));
  const b0 = own();
  if (fits(b0, true, 0)) return null;
  const head = slide.querySelector(':scope > h2, :scope > h1');
  const under = Math.max(ROOM, head ? (takenBox(app, head)?.bottom ?? 0) + ROOM : 0);
  // the places on a grid, and those flush with the room after each other element
  const steps = (from: number, to: number, edges: number[]) => {
    const out = edges.filter((v) => v >= from && v <= to);
    for (let v = from; v <= to; v += STEP) out.push(v);
    return out;
  };
  const nearest = (b: Box, all: boolean): Box | null => {
    const bw = b.right - b.left, bh = b.bottom - b.top;
    let best: Box | null = null;
    let near = Infinity;
    const side = bw + 2 * MARGIN <= w ? MARGIN : ROOM;
    const xs = steps(side, w - bw - side, others.map((o) => o.box.right + ROOM));
    for (const y of steps(under, h - bh - ROOM, others.map((o) => o.box.bottom + ROOM))) {
      for (const x of xs) {
        const at = { left: x, top: y, right: x + bw, bottom: y + bh };
        const d = Math.hypot(x - b.left, y - b.top);
        if (d < near && fits(at, all, ROOM)) {
          near = d;
          best = at;
        }
      }
    }
    return best;
  };
  const kept = picture?.style.width ?? '';
  const base = b0.right - b0.left;
  // an image or a video is drawn as small as a quarter before it lies over a figure, and a text box,
  // a formula, or a QR code only as small as a half, since a figure may lie under it
  const media = !!picture?.matches('img, video');
  const scales = (all: boolean) => (!picture ? [1] : all ? (media ? [1, 0.75, 0.5, 0.35, 0.25] : [1, 0.75, 0.5]) : media ? [0.5] : [1]);
  try {
    for (const all of [true, false]) {
      for (const k of scales(all)) {
        if (picture) picture.style.width = k === 1 ? kept : `${Math.round(base * k)}px`;
        const b = own();
        const p = nearest(b, all);
        if (p) return { x: Math.round(p.left - b.left), y: Math.round(p.top - b.top), ...(k < 1 ? { width: Math.round(base * k) } : {}) };
      }
    }
  } finally {
    if (picture) picture.style.width = kept;
  }
  return { x: Math.round((w - b0.left - b0.right) / 2), y: Math.round((h - b0.top - b0.bottom) / 2) };
}

// the translate of el in slide px
export function translateOf(el: Element): { x: number; y: number } {
  const [x, y] = ((el as HTMLElement).style?.translate ?? '').split(' ').map((v) => parseFloat(v) || 0);
  return { x: x ?? 0, y: y ?? 0 };
}

// a new element of the file put in free space by freePlace, with the width of its picture
export function placeNew(app: App, el: Element, picture?: HTMLElement): void {
  const f = freePlace(app, el, picture);
  if (!f) return;
  if (f.width && picture) app.doc.setTag(picture, { style: { width: `${f.width}px` } }, 'move');
  const t = translateOf(el);
  app.doc.setTag(el, { translate: { x: t.x + f.x, y: t.y + f.y } }, 'move');
}
