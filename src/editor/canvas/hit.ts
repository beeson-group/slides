// what a pointer press on the slide hits: the movable element under it, the band of 6 screen px
// outside a block, i.e. inside its hover frame, which selects the block as a box, and the image or
// video inside a figure. the boxes of the slide are read here, in slide pixels from the upper left
// of the slide, from the live scale and box of the slides of reveal.js

import type { App } from '../app.ts';
import { HOST } from '../app.ts';
import type { Box } from './snap.ts';
import { stored } from '../ui/dom.ts';

// the outermost of these elements under the pointer is moved, outside the notes and the backdrop
export const MOVABLE = 'h1, h2, h3, p, ul, ol, dl, table, pre, blockquote, div.math, .caption, .foot, img, video, figure, .zone, .plate, .qr, tycho-viewer, .shape';
// an element without text to edit, dragged by itself. a tycho-viewer is turned by a drag, hence it
// is moved by its handle or its border only
export const BY_ITSELF = 'img, video, figure, .zone, .plate, .qr, .shape';
export const OUTSIDE = 'aside.notes, .backdrop';
// the elements whose width the editor writes, by the scope rule of the plan
export const RESIZABLE = 'img, video, .qr, tycho-viewer, .shape';

// whether el is turned by a rotation, which leaves out a table and its cells, as PowerPoint and
// Keynote do not turn a table
export const turnable = (el: Element): boolean => !el.hasAttribute('data-locked') && !el.closest('table');

// the text blocks whose width their grips set, as a text box of Keynote and PowerPoint, with the
// height set by their wrapped text
export const TEXT_SIZED = 'h1, h2, h3, p, ul, ol, div.math, .caption';
// the pictures and shapes whose height the editor writes as well, which a resize stretches
export const STRETCHED = 'img, video, .shape';
// a figure whose size is set by its layout. its grips resize the image, video, or QR code that it
// holds, and a figure that does not hold one is drawn without grips
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
// contain, the box of the picture inside the element, else the box of the element. the mask of
// canvas/mask.ts, a scale with a clip-path inset, is cut out of it, and a flip mirrors it
export function visualRect(el: Element): Box {
  const r = el.getBoundingClientRect();
  const box = { left: r.left, top: r.top, width: r.width, height: r.height };
  const natural = el instanceof HTMLImageElement ? [el.naturalWidth, el.naturalHeight] : el instanceof HTMLVideoElement ? [el.videoWidth, el.videoHeight] : null;
  if (!natural || !natural[0] || !natural[1] || !r.width || !r.height) return box;
  const style = getComputedStyle(el);
  const inset = /^inset\(\s*([\d.]+)%\s*\)$/.exec(style.clipPath)?.[1];
  const q = inset ? parseFloat(inset) / 100 : 0;
  const clip = { left: r.left + q * r.width, top: r.top + q * r.height, right: r.right - q * r.width, bottom: r.bottom - q * r.height };
  const cut = (b: Box): Box => {
    const left = Math.max(b.left, clip.left), top = Math.max(b.top, clip.top);
    return { left, top, width: Math.max(0, Math.min(b.left + b.width, clip.right) - left), height: Math.max(0, Math.min(b.top + b.height, clip.bottom) - top) };
  };
  if (style.objectFit !== 'contain' && style.objectFit !== 'scale-down') return cut(box);
  let s = Math.min(r.width / natural[0], r.height / natural[1]);
  if (style.objectFit === 'scale-down') s = Math.min(s, 1);
  const w = natural[0] * s, h = natural[1] * s;
  // object-position is computed as two lengths or percentages, e.g. "100% 50%", and a length is
  // in the pixels of the element before its scale
  const k = (el as HTMLElement).offsetWidth ? r.width / (el as HTMLElement).offsetWidth : 1;
  const [px, py] = style.objectPosition.split(/\s+/);
  const at = (v: string | undefined, room: number) => (!v ? room / 2 : v.endsWith('%') ? (parseFloat(v) / 100) * room : (parseFloat(v) || 0) * k);
  let left = r.left + at(px, r.width - w), top = r.top + at(py, r.height - h);
  const [sx, sy = sx] = style.scale.split(/\s+/).map(parseFloat);
  if (sx < 0) left = r.left + r.right - left - w;
  if (sy < 0) top = r.top + r.bottom - top - h;
  return cut({ left, top, width: w, height: h });
}

// the picture of el inside its own box, in CSS px of el without its scale and rotation: its size,
// and the offset of its center from the center of the box
function pictureIn(el: Element): { width: number; height: number; dx: number; dy: number } {
  const h = el as HTMLElement;
  const box = { width: h.offsetWidth, height: h.offsetHeight, dx: 0, dy: 0 };
  const natural = el instanceof HTMLImageElement ? [el.naturalWidth, el.naturalHeight] : el instanceof HTMLVideoElement ? [el.videoWidth, el.videoHeight] : null;
  const style = getComputedStyle(el);
  if (!natural || !natural[0] || !natural[1] || !box.width || !box.height || (style.objectFit !== 'contain' && style.objectFit !== 'scale-down')) return box;
  let s = Math.min(box.width / natural[0], box.height / natural[1]);
  if (style.objectFit === 'scale-down') s = Math.min(s, 1);
  const w = natural[0] * s, ht = natural[1] * s;
  const [px, py] = style.objectPosition.split(/\s+/);
  const at = (v: string | undefined, room: number) => (!v ? room / 2 : v.endsWith('%') ? (parseFloat(v) / 100) * room : parseFloat(v) || 0);
  return { width: w, height: ht, dx: at(px, box.width - w) + w / 2 - box.width / 2, dy: at(py, box.height - ht) + ht / 2 - box.height / 2 };
}

// the captions that the figure el holds and shows
const captionEls = (el: Element): HTMLElement[] =>
  el.matches(CONTAINER) ? [...el.querySelectorAll<HTMLElement>(':scope > figcaption, :scope > .caption')].filter((c) => c.offsetWidth && c.offsetHeight) : [];

// the boxes on the screen of the captions that the figure el holds and shows
export function captionsOf(el: Element): DOMRect[] {
  return captionEls(el).map((c) => c.getBoundingClientRect()).filter((r) => r.width && r.height);
}

// the frame of the figure el with a caption, which its rotate turns with its picture as one
// object: the box on the screen of its picture and captions in the axes of the figure, without its
// rotation, about the center of the frame as it is seen, the angle of the figure, and the box of
// the picture so taken. a picture turned by itself in the file is taken at its angle in the frame
export function figureFrame(el: Element): { box: Box; deg: number; picture: Box } {
  const scale = scaleAt(el);
  const deg = parseFloat(getComputedStyle(el).rotate) || 0;
  const pic = pictureOf(el);
  const own = pic === el ? 0 : parseFloat(getComputedStyle(pic).rotate) || 0;
  const picture = orientedBox(pic, scale, deg + own);
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const a = (deg * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const parts = [{ x: picture.left + picture.width / 2, y: picture.top + picture.height / 2, w: picture.width, h: picture.height, d: own }, ...captionEls(el).map((c) => {
    const b = c.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: c.offsetWidth * scale, h: c.offsetHeight * scale, d: 0 };
  })];
  // each part about the center of the figure turned back, with its corners at its angle in the frame
  const points = parts.flatMap(({ x, y, w, h, d }) => {
    const u = (x - cx) * cos + (y - cy) * sin, v = (y - cy) * cos - (x - cx) * sin;
    const b = (d * Math.PI) / 180;
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => ({ x: u + (i * w * Math.cos(b) - j * h * Math.sin(b)) / 2, y: v + (i * w * Math.sin(b) + j * h * Math.cos(b)) / 2 }));
  });
  const left = Math.min(...points.map((p) => p.x)), top = Math.min(...points.map((p) => p.y));
  const width = Math.max(...points.map((p) => p.x)) - left, height = Math.max(...points.map((p) => p.y)) - top;
  const u = left + width / 2, v = top + height / 2;
  return { box: { left: cx + u * cos - v * sin - width / 2, top: cy + u * sin + v * cos - height / 2, width, height }, deg, picture };
}

// the screen pixels per slide pixel of the slides that hold el
export function scaleAt(el: Element): number {
  const slides = el.closest('.slides') as HTMLElement | null;
  return slides?.offsetWidth ? slides.getBoundingClientRect().width / slides.offsetWidth : 1;
}

// the box on the screen of the picture of the figure el as it is seen, upright around the picture
// where the picture or the figure is turned
export function pictureReach(el: Element): Box {
  const pic = pictureOf(el);
  const deg = pictureTurn(el);
  if (!deg) return visualRect(pic);
  const b = orientedBox(pic, scaleAt(el), deg);
  const a = (deg * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const width = b.width * c + b.height * s, height = b.width * s + b.height * c;
  return { left: b.left + (b.width - width) / 2, top: b.top + (b.height - height) / 2, width, height };
}

// the angle in degrees that the picture of el is turned by, with the figure around it
export function pictureTurn(el: Element): number {
  const pic = pictureOf(el);
  return (parseFloat(getComputedStyle(el).rotate) || 0) + (pic === el ? 0 : parseFloat(getComputedStyle(pic).rotate) || 0);
}

// the box on the screen of the figure el before its picture is turned, i.e. its frame without its
// rotation where the figure is turned as one object, else the picture without its rotation over
// the upright captions, and the box of the picture so taken. the fields W and H of a figure
// selected as one object give this size at every angle
export function unturnedRect(el: Element): { box: Box; picture: Box } {
  const deg = pictureTurn(el);
  if (!deg) return { box: frameRect(el), picture: pictureReach(el) };
  const whole = captionsOf(el).length ? figureFrame(el) : null;
  if (whole?.deg) return whole;
  const picture = orientedBox(pictureOf(el), scaleAt(el), deg);
  const all = [{ left: picture.left, top: picture.top, right: picture.left + picture.width, bottom: picture.top + picture.height }, ...captionsOf(el)];
  const left = Math.min(...all.map((r) => r.left)), top = Math.min(...all.map((r) => r.top));
  return { box: { left, top, width: Math.max(...all.map((r) => r.right)) - left, height: Math.max(...all.map((r) => r.bottom)) - top }, picture };
}

// the box of el on the screen at its frame, as Keynote and PowerPoint take the box of an object in
// every field and command: a figure that holds a picture at the picture and over the caption that it
// holds, upright around both where the figure is turned, and another element at its box seen
export function frameRect(el: Element): Box {
  const caps = captionsOf(el);
  if (!caps.length) return visualRect(el.matches(RESIZABLE) || el.matches(CONTAINER) ? pictureOf(el) : el);
  const whole = figureFrame(el);
  if (whole.deg) {
    const a = (whole.deg * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)), b = whole.box;
    const width = b.width * c + b.height * s, height = b.width * s + b.height * c;
    return { left: b.left + (b.width - width) / 2, top: b.top + (b.height - height) / 2, width, height };
  }
  const box = pictureReach(el);
  const left = Math.min(box.left, ...caps.map((r) => r.left)), top = Math.min(box.top, ...caps.map((r) => r.top));
  const right = Math.max(box.left + box.width, ...caps.map((r) => r.right)), bottom = Math.max(box.top + box.height, ...caps.map((r) => r.bottom));
  return { left, top, width: right - left, height: bottom - top };
}

// the size of the picture of el in slide pixels, without its scale and rotation, which the fields
// W and H of the Arrange pane give: the picture of an image or a video fitted into its box, and the
// box of any other element
export function pictureSize(el: Element): { w: number; h: number } {
  const p = pictureIn(el);
  return { w: p.width, h: p.height };
}

// the box of the picture of el on the screen, without the rotation by deg of el or of the figure
// around it, about the center of the picture as it is seen. scale is the screen pixels per slide
// pixel. an element that is not rotated has the box of visualRect
export function orientedBox(el: Element, scale: number, deg: number): Box {
  if (!deg) return visualRect(el);
  const r = el.getBoundingClientRect();
  const p = pictureIn(el);
  const a = (deg * Math.PI) / 180;
  // a flip mirrors the picture in the box of el
  const [sx, sy = sx] = getComputedStyle(el).scale.split(/\s+/).map(parseFloat);
  const dx = sx < 0 ? -p.dx : p.dx, dy = sy < 0 ? -p.dy : p.dy;
  const cx = r.left + r.width / 2 + (dx * Math.cos(a) - dy * Math.sin(a)) * scale;
  const cy = r.top + r.height / 2 + (dx * Math.sin(a) + dy * Math.cos(a)) * scale;
  return { left: cx - (p.width * scale) / 2, top: cy - (p.height * scale) / 2, width: p.width * scale, height: p.height * scale };
}

// the ratio of width to height that a resize of el keeps: the picture of an image or a video, and
// the box of a QR code. a tycho viewer keeps its height and a text block its wrapped text, hence
// neither has one
export function aspectOf(el: Element): number | null {
  if (el.matches('tycho-viewer') || isTextSized(el)) return null;
  const p = pictureIn(el);
  return p.width && p.height ? p.width / p.height : null;
}

// whether el is a text block whose width is set by its grips
export const isTextSized = (el: Element): boolean => el.matches(TEXT_SIZED) && !el.matches(RESIZABLE);

// the kind of a picture, by which the switch Constrain Proportions is kept in the browser
export const kindOf = (el: Element): string => (el.matches('img') ? 'image' : el.matches('video') ? 'video' : el.matches('.qr') ? 'qr' : el.matches('.shape') ? 'shape' : 'viewer');

// whether a resize of the picture el keeps its aspect: the switch of its kind for an image or a
// video, on by default, off for a shape, and else whenever it has an aspect, since its height then follows its
// width. a QR code thus keeps its square, and a viewer keeps the height of its layout
export function constrained(el: Element): boolean {
  if (!el.matches(STRETCHED)) return aspectOf(el) !== null;
  return (stored(`beeson-edit-constrain-${kindOf(el)}`) ?? (el.matches('.shape') ? 'off' : 'on')) === 'on';
}

// the width in the style of el that gives it the border box of width w, in slide pixels
export function cssWidth(el: Element, w: number): number {
  const s = getComputedStyle(el);
  if (s.boxSizing === 'border-box') return w;
  const n = (v: string) => parseFloat(v) || 0;
  return w - n(s.paddingLeft) - n(s.paddingRight) - n(s.borderLeftWidth) - n(s.borderRightWidth);
}

// the elements whose width a resize of el writes: el itself, a text block, or the images, videos,
// and QR codes that a figure holds, e.g. the image of each mode. a figure that holds two shown
// pictures, or none, is not resized
export function sizedOf(el: Element): Element[] {
  if (el.matches(RESIZABLE) || isTextSized(el)) return [el];
  if (!el.matches(CONTAINER)) return [];
  const held = [...el.querySelectorAll(RESIZABLE)].filter((m) => m.parentElement?.closest(MOVABLE) === el);
  return held.filter((m) => m.getBoundingClientRect().width > 0).length === 1 ? held : [];
}

// the image or video of the other mode beside el, e.g. the for-light image of a for-dark one, which
// is given the place and the tag edits of el, so that a picture keeps its place, its size, its
// group, and its lock when the mode is flipped. the two are each other's first of their mode, so
// that a copy of one of them beside the pair is not taken for its twin
export function twinOf(app: App, el: Element): Element | null {
  const first = (of: Element): Element | null => {
    const mode = of.classList.contains('for-dark') ? 'for-light' : of.classList.contains('for-light') ? 'for-dark' : null;
    if (!mode || !of.matches(STRETCHED) || !of.parentElement) return null;
    return [...of.parentElement.children].find((c) => c !== of && c.localName === of.localName && c.classList.contains(mode)) ?? null;
  };
  const twin = first(el);
  return twin && first(twin) === el && app.pairing?.elements.get(twin)?.open ? twin : null;
}

// els with the twin of each image or video after it, for a change that takes the pair off
export function withTwins(app: App, els: Element[]): Element[] {
  return els.flatMap((el) => {
    const twin = twinOf(app, el);
    return twin && !els.includes(twin) ? [el, twin] : [el];
  });
}

// the element whose picture stands for el in its frame and its resize: the shown image, video, or
// QR code of a figure, or el itself
export function pictureOf(el: Element): Element {
  return sizedOf(el).find((m) => m !== el && m.getBoundingClientRect().width > 0) ?? el;
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

// what a press at target selects: the movable element around it, thus the figure of a picture,
// since a picture with its caption is one object, as in Keynote. a picture selected by itself with
// a second click on it is kept while the press is on it
export function pickOf(app: App, target: Element | null): Element | null {
  const el = movableOf(app, target);
  const only = app.selection.only();
  return only && only !== el && !!el?.contains(only) && !!target && only.contains(target) ? only : el;
}

// the movable elements of the current slide that are shown, in document order
export function movablesOf(app: App): Element[] {
  const slide = app.current();
  if (!slide) return [];
  return [...slide.querySelectorAll(MOVABLE)].filter((el) => movableOf(app, el) === el && el.getBoundingClientRect().width > 0);
}

// a line or an arrow of commands/line.ts: an svg as large as the box of its line element, whose
// x1, y1, x2, and y2 are in px of the svg. the marquee selects it, and a drag snaps to its ends
export const LINE = 'svg.line';

// the shown lines of the current slide that are paired with the file
export function linesOf(app: App): Element[] {
  const slide = app.current();
  if (!slide) return [];
  return [...slide.querySelectorAll(LINE)].filter((svg) => !!app.pairing?.elements.get(svg)?.open && svg.getClientRects().length > 0 && !svg.closest(OUTSIDE));
}

// the two ends of the line of svg on the screen
export function lineEnds(svg: Element): [{ x: number; y: number }, { x: number; y: number }] {
  const r = svg.getBoundingClientRect();
  const w = Number(svg.getAttribute('width')) || r.width || 1, h = Number(svg.getAttribute('height')) || r.height || 1;
  const line = svg.querySelector('line');
  const n = (a: string) => parseFloat(line?.getAttribute(a) ?? '') || 0;
  const at = (x: number, y: number) => ({ x: r.left + (x * r.width) / w, y: r.top + (y * r.height) / h });
  return [at(n('x1'), n('y1')), at(n('x2'), n('y2'))];
}

// the shown line of the current slide whose stroke is within 6 px of the point x, y on the screen
export function lineAt(app: App, x: number, y: number): Element | null {
  return linesOf(app).reverse().find((svg) => {
    const [a, b] = lineEnds(svg);
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - a.x - t * dx, y - a.y - t * dy) <= 6;
  }) ?? null;
}

// the ends and the middle of each line of the current slide outside skip, in slide pixels, which a
// drag snaps to
export function linePoints(app: App, skip: Element[] = []): { x: number; y: number }[] {
  const f = frameOf(app);
  return linesOf(app).filter((svg) => !skip.includes(svg)).flatMap((svg) => {
    const [a, b] = lineEnds(svg).map((p) => ({ x: (p.x - f.left) / f.scale, y: (p.y - f.top) / f.scale }));
    return [a, b, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }];
  });
}

// the box that a drag of el snaps by, in slide pixels: the box of the ends of a line, whose edges
// and center are its ends and its middle, and the frame of any other element
export function snapBoxOf(app: App, el: Element): Box {
  const f = frameOf(app);
  if (!el.matches(LINE)) return toSlide(f, frameRect(el));
  const [a, b] = lineEnds(el);
  return toSlide(f, { left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) });
}

// whether the segment from a to b has a point in box, by the clip of Liang and Barsky
export function segmentTouches(a: { x: number; y: number }, b: { x: number; y: number }, box: Box): boolean {
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  const edges: [number, number][] = [[-dx, a.x - box.left], [dx, box.left + box.width - a.x], [-dy, a.y - box.top], [dy, box.top + box.height - a.y]];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
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

// the element that a move, a resize, the order, a group, a lock, and the clipboard act on for a
// selected el: the figure of a picture selected inside it, since a picture with its caption is one
// object, as in Keynote, where a drag of the picture moves the caption with it. a member of a group
// is moved by itself in PowerPoint, and Keynote is followed here
export function objectOf(app: App, el: Element): Element {
  const up = el.matches(RESIZABLE) ? containerOf(app, el) : null;
  return up && app.pairing?.elements.get(up)?.open ? up : el;
}

export const objectsOf = (app: App, els: readonly Element[]): Element[] => [...new Set(els.map((el) => objectOf(app, el)))];

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
