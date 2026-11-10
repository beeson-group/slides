// what a pointer press on the slide hits: the movable element under it, the band of 6 screen px
// outside a block, i.e. inside its hover frame, which selects the block as a box, and the image or
// video inside a figure. the boxes of the slide are read here, in slide pixels from the upper left
// of the slide, from the live scale and box of the slides of reveal.js

import type { App } from '../app.ts';
import { HOST } from '../app.ts';
import type { Box } from './snap.ts';

// the outermost of these elements under the pointer is moved, outside the notes and the backdrop
export const MOVABLE = 'h1, h2, h3, p, ul, ol, dl, table, pre, blockquote, div.math, .caption, .foot, img, video, figure, .zone, .plate, .qr, tycho-viewer';
// an element without text to edit, dragged by itself. a tycho-viewer is turned by a drag, hence it
// is moved by its handle or its border only
export const BY_ITSELF = 'img, video, figure, .zone, .plate, .qr';
export const OUTSIDE = 'aside.notes, .backdrop';
// the elements whose width the editor writes, by the scope rule of the plan
export const RESIZABLE = 'img, video, .qr, tycho-viewer';
// a figure whose size is set by its layout, drawn with handles that cannot be dragged
export const CONTAINER = 'figure, .zone, .plate';
// the band outside a block in which a press selects the block, in screen pixels
export const BAND = 6;

// the origin of the slide on the screen and the screen pixels per slide pixel
export type Frame = { left: number; top: number; scale: number };

export function frameOf(app: App): Frame {
  const slides = app.slides() as HTMLElement;
  const r = slides.getBoundingClientRect();
  const scale = slides.offsetWidth ? r.width / slides.offsetWidth : (app.deck()?.getScale() ?? 1);
  return { left: r.left, top: r.top, scale: scale || 1 };
}

export const toSlide = (f: Frame, r: Box): Box => ({ left: (r.left - f.left) / f.scale, top: (r.top - f.top) / f.scale, width: r.width / f.scale, height: r.height / f.scale });
export const toScreen = (f: Frame, b: Box): Box => ({ left: f.left + b.left * f.scale, top: f.top + b.top * f.scale, width: b.width * f.scale, height: b.height * f.scale });

// the box of el on the screen as it is seen: for an image or a video fitted with object-fit
// contain, the box of the picture inside the element, else the box of the element
export function visualRect(el: Element): Box {
  const r = el.getBoundingClientRect();
  const box = { left: r.left, top: r.top, width: r.width, height: r.height };
  const natural = el instanceof HTMLImageElement ? [el.naturalWidth, el.naturalHeight] : el instanceof HTMLVideoElement ? [el.videoWidth, el.videoHeight] : null;
  if (!natural || !natural[0] || !natural[1] || !r.width || !r.height) return box;
  const style = getComputedStyle(el);
  if (style.objectFit !== 'contain' && style.objectFit !== 'scale-down') return box;
  let s = Math.min(r.width / natural[0], r.height / natural[1]);
  if (style.objectFit === 'scale-down') s = Math.min(s, 1);
  const w = natural[0] * s, h = natural[1] * s;
  // object-position is computed as two lengths or percentages, e.g. "100% 50%"
  const [px, py] = style.objectPosition.split(/\s+/);
  const at = (v: string | undefined, room: number) => (!v ? room / 2 : v.endsWith('%') ? (parseFloat(v) / 100) * room : parseFloat(v) || 0);
  return { left: r.left + at(px, r.width - w), top: r.top + at(py, r.height - h), width: w, height: h };
}

// the ratio of width to height that a resize of el keeps: the picture of an image or a video, and
// the box of a QR code. a tycho viewer keeps its height, hence it does not have one
export function aspectOf(el: Element): number | null {
  if (el.matches('tycho-viewer')) return null;
  const r = visualRect(el);
  return r.width && r.height ? r.width / r.height : null;
}

// the element that a drag at target would move, or null
export function movableOf(app: App, target: Element | null): Element | null {
  const slide = app.current();
  const pairing = app.pairing;
  if (!target || !slide || !pairing || !slide.contains(target) || target.closest(OUTSIDE)) return null;
  let el = target.closest(MOVABLE);
  while (el) {
    const up = el.parentElement?.closest(MOVABLE) ?? null;
    if (!up || !slide.contains(up)) break;
    el = up;
  }
  return el && slide.contains(el) && pairing.elements.get(el)?.open ? el : null;
}

// the movable elements of the current slide that are shown, in document order
export function movablesOf(app: App): Element[] {
  const slide = app.current();
  if (!slide) return [];
  return [...slide.querySelectorAll(MOVABLE)].filter((el) => movableOf(app, el) === el && el.getBoundingClientRect().width > 0);
}

// the image or video of a figure under target, which a click into a selected figure selects
export function mediaIn(figure: Element, target: Element | null): Element | null {
  const media = target?.closest('img, video') ?? null;
  return media && media !== figure && figure.contains(media) && media.parentElement?.closest(MOVABLE) === figure ? media : null;
}

// the figure around an image or video that was selected inside it, or null
export function containerOf(app: App, el: Element): Element | null {
  const up = el.parentElement?.closest(MOVABLE) ?? null;
  return up && app.current()?.contains(up) ? up : null;
}

// whether a press at target is on the canvas, i.e. on the slide in the viewport of reveal.js, or at
// the point at on the pasteboard around it in the canvas cell of the shell, without its scroll bars,
// and not on the notes or the chrome of the editor
export function onCanvas(target: Element | null, app?: App, at?: { x: number; y: number }): boolean {
  if (!target || target.closest('aside.notes')) return false;
  if (target.closest('.reveal')) return true;
  const stage = app?.stage;
  if (!stage || !at || target !== stage.el) return false;
  const v = stage.viewport;
  return at.x >= v.left && at.x < v.right && at.y >= v.top && at.y < v.bottom;
}

// the block whose band holds the point x, y in screen pixels, the nearest edge first
export function bandAt(app: App, x: number, y: number): Element | null {
  let best: { el: Element; d: number } | null = null;
  for (const el of movablesOf(app)) {
    const r = el.getBoundingClientRect();
    const outside = x < r.left || x > r.right || y < r.top || y > r.bottom;
    const inFrame = x >= r.left - BAND && x <= r.right + BAND && y >= r.top - BAND && y <= r.bottom + BAND;
    if (!outside || !inFrame) continue;
    const d = Math.max(r.left - x, x - r.right, r.top - y, y - r.bottom);
    if (!best || d < best.d) best = { el, d };
  }
  return best?.el ?? null;
}

// whether el holds a text that is edited in place
export const hasText = (el: Element): boolean => el.matches(HOST) || !!el.querySelector(HOST);

export function install(_app: App): void {
  // the functions above are called by the selection, the frames, and the drag
}
