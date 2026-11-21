import type { App } from '../app.ts';
import { HOST } from '../app.ts';
import type { Box } from './snap.ts';
import { gripOf, parseStroke, pointsOf, reach, type Point } from './stroke.ts';
import { stored } from '../ui/dom.ts';
import { LABEL } from '../text/labels.ts';

export const MOVABLE = 'h1, h2, h3, p, ul, ol, dl, table, pre, blockquote, div.math, .caption, .foot, img, video, figure, .figure-box, .plate, .qr, .tikz, tycho-viewer, .shape';
export const BY_ITSELF = 'img, video, figure, .figure-box, .plate, .qr, .tikz, .shape';
export const OUTSIDE = 'aside.notes, .backdrop';
export const RESIZABLE = 'img, video, .qr, tycho-viewer, .shape, .tikz';

export const turnable = (el: Element): boolean => !el.hasAttribute('data-locked') && !el.closest('table') && !el.matches('.backdrop');

export const TEXT_SIZED = 'h1, h2, h3, p, ul, ol, div.math, .caption';
export const STRETCHED = 'img, video, tycho-viewer, .shape, .tikz';
export const BOXED = 'tycho-viewer, .tikz';
export const CONTAINER = 'figure, .figure-box, .plate';
export const BAND = 6;

export type Frame = { left: number; top: number; scale: number };

export function frameOf(app: App): Frame {
  const slides = app.slides() as HTMLElement;
  const r = slides.getBoundingClientRect();
  const scale = slides.offsetWidth ? r.width / slides.offsetWidth : (app.deck()?.getScale() ?? 1);
  return { left: r.left, top: r.top, scale: scale || 1 };
}

export const toSlide = (f: Frame, r: Box): Box => ({ left: (r.left - f.left) / f.scale, top: (r.top - f.top) / f.scale, width: r.width / f.scale, height: r.height / f.scale });
export const toScreen = (f: Frame, b: Box): Box => ({ left: f.left + b.left * f.scale, top: f.top + b.top * f.scale, width: b.width * f.scale, height: b.height * f.scale });

export function visualRect(el: Element): Box {
  const r = el.getBoundingClientRect();
  const box = { left: r.left, top: r.top, width: r.width, height: r.height };
  const natural = el instanceof HTMLImageElement ? [el.naturalWidth, el.naturalHeight] : el instanceof HTMLVideoElement ? [el.videoWidth, el.videoHeight] : null;
  if (!natural || !natural[0] || !natural[1] || !r.width || !r.height) return box;
  const style = getComputedStyle(el);
  const inset = /^inset\(\s*([\d.]+)%(?:\s+round\s+50%)?\s*\)$/.exec(style.clipPath)?.[1];
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
  const k = (el as HTMLElement).offsetWidth ? r.width / (el as HTMLElement).offsetWidth : 1;
  const [px, py] = style.objectPosition.split(/\s+/);
  const at = (v: string | undefined, room: number) => (!v ? room / 2 : v.endsWith('%') ? (parseFloat(v) / 100) * room : (parseFloat(v) || 0) * k);
  let left = r.left + at(px, r.width - w), top = r.top + at(py, r.height - h);
  const [sx, sy = sx] = style.scale.split(/\s+/).map(parseFloat);
  if (sx < 0) left = r.left + r.right - left - w;
  if (sy < 0) top = r.top + r.bottom - top - h;
  return cut({ left, top, width: w, height: h });
}

function pictureIn(el: Element): { width: number; height: number; dx: number; dy: number } {
  const style = getComputedStyle(el);
  const h = el instanceof HTMLElement ? el : null;
  const box = { width: h ? h.offsetWidth : parseFloat(style.width) || 0, height: h ? h.offsetHeight : parseFloat(style.height) || 0, dx: 0, dy: 0 };
  const natural = el instanceof HTMLImageElement ? [el.naturalWidth, el.naturalHeight] : el instanceof HTMLVideoElement ? [el.videoWidth, el.videoHeight] : null;
  if (!natural || !natural[0] || !natural[1] || !box.width || !box.height || (style.objectFit !== 'contain' && style.objectFit !== 'scale-down')) return box;
  let s = Math.min(box.width / natural[0], box.height / natural[1]);
  if (style.objectFit === 'scale-down') s = Math.min(s, 1);
  const w = natural[0] * s, ht = natural[1] * s;
  const [px, py] = style.objectPosition.split(/\s+/);
  const at = (v: string | undefined, room: number) => (!v ? room / 2 : v.endsWith('%') ? (parseFloat(v) / 100) * room : parseFloat(v) || 0);
  return { width: w, height: ht, dx: at(px, box.width - w) + w / 2 - box.width / 2, dy: at(py, box.height - ht) + ht / 2 - box.height / 2 };
}

export const captionEls = (el: Element): HTMLElement[] =>
  el.matches(CONTAINER) ? [...el.querySelectorAll<HTMLElement>(':scope > figcaption, :scope > .caption')].filter((c) => c.offsetWidth && c.offsetHeight) : [];

export function captionsOf(el: Element): DOMRect[] {
  return captionEls(el).map((c) => c.getBoundingClientRect()).filter((r) => r.width && r.height);
}

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

export function scaleAt(el: Element): number {
  const slides = el.closest('.slides') as HTMLElement | null;
  return slides?.offsetWidth ? slides.getBoundingClientRect().width / slides.offsetWidth : 1;
}

export function pictureReach(el: Element): Box {
  const pic = pictureOf(el);
  const deg = pictureTurn(el);
  if (!deg) return visualRect(pic);
  const b = orientedBox(pic, scaleAt(el), deg);
  const a = (deg * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const width = b.width * c + b.height * s, height = b.width * s + b.height * c;
  return { left: b.left + (b.width - width) / 2, top: b.top + (b.height - height) / 2, width, height };
}

export function pictureTurn(el: Element): number {
  const pic = pictureOf(el);
  return (parseFloat(getComputedStyle(el).rotate) || 0) + (pic === el ? 0 : parseFloat(getComputedStyle(pic).rotate) || 0);
}

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

export function pictureSize(el: Element): { w: number; h: number } {
  const p = pictureIn(el);
  return { w: p.width, h: p.height };
}

export function orientedBox(el: Element, scale: number, deg: number): Box {
  if (!deg) return visualRect(el);
  const r = el.getBoundingClientRect();
  const p = pictureIn(el);
  const a = (deg * Math.PI) / 180;
  const [sx, sy = sx] = getComputedStyle(el).scale.split(/\s+/).map(parseFloat);
  const dx = sx < 0 ? -p.dx : p.dx, dy = sy < 0 ? -p.dy : p.dy;
  const cx = r.left + r.width / 2 + (dx * Math.cos(a) - dy * Math.sin(a)) * scale;
  const cy = r.top + r.height / 2 + (dx * Math.sin(a) + dy * Math.cos(a)) * scale;
  return { left: cx - (p.width * scale) / 2, top: cy - (p.height * scale) / 2, width: p.width * scale, height: p.height * scale };
}

export function aspectOf(el: Element): number | null {
  if (isTextSized(el)) return null;
  const p = pictureIn(el);
  return p.width && p.height ? p.width / p.height : null;
}

export const isTextSized = (el: Element): boolean => el.matches(TEXT_SIZED) && !el.matches(RESIZABLE);

export const kindOf = (el: Element): string => (el.matches('img') ? 'image' : el.matches('video') ? 'video' : el.matches('.qr') ? 'qr' : el.matches('.shape') ? 'shape' : el.matches('.tikz') ? 'tikz' : 'viewer');

export function constrained(el: Element): boolean {
  if (!el.matches(STRETCHED)) return aspectOf(el) !== null;
  return (stored(`beeson-edit-constrain-${kindOf(el)}`) ?? (el.matches('.shape, .tikz') ? 'off' : 'on')) === 'on';
}

export function cssWidth(el: Element, w: number): number {
  const s = getComputedStyle(el);
  if (s.boxSizing === 'border-box') return w;
  const n = (v: string) => parseFloat(v) || 0;
  return w - n(s.paddingLeft) - n(s.paddingRight) - n(s.borderLeftWidth) - n(s.borderRightWidth);
}

export function sizedOf(el: Element): Element[] {
  if (el.matches(RESIZABLE) || isTextSized(el)) return [el];
  if (!el.matches(CONTAINER)) return [];
  const held = [...el.querySelectorAll(RESIZABLE)].filter((m) => m.parentElement?.closest(MOVABLE) === el);
  return held.filter((m) => m.getBoundingClientRect().width > 0).length === 1 ? held : [];
}

export function twinOf(app: App, el: Element): Element | null {
  const first = (of: Element): Element | null => {
    const mode = of.classList.contains('for-dark') ? 'for-light' : of.classList.contains('for-light') ? 'for-dark' : null;
    if (!mode || !of.matches(STRETCHED) || !of.parentElement) return null;
    return [...of.parentElement.children].find((c) => c !== of && c.localName === of.localName && c.classList.contains(mode)) ?? null;
  };
  const twin = first(el);
  return twin && first(twin) === el && app.pairing?.elements.get(twin)?.open ? twin : null;
}

export function withTwins(app: App, els: Element[]): Element[] {
  return els.flatMap((el) => {
    const twin = twinOf(app, el);
    return twin && !els.includes(twin) ? [el, twin] : [el];
  });
}

export function pictureOf(el: Element): Element {
  return sizedOf(el).find((m) => m !== el && m.getBoundingClientRect().width > 0) ?? el;
}

export function movableOf(app: App, target: Element | null): Element | null {
  const slide = app.current();
  const pairing = app.pairing;
  if (!target || !slide || !pairing || !slide.contains(target)) return null;
  const label = target.closest(LABEL);
  if (label) return pairing.elements.get(label)?.open ? label : null;
  if (target.closest(OUTSIDE)) return null;
  let el = target.closest(MOVABLE);
  while (el) {
    const up = el.parentElement?.closest(MOVABLE) ?? null;
    if (!up || !slide.contains(up)) break;
    el = up;
  }
  return el && slide.contains(el) && pairing.elements.get(el)?.open ? el : null;
}

export function pickOf(app: App, target: Element | null): Element | null {
  const el = movableOf(app, target);
  const only = app.selection.only();
  return only && only !== el && !!el?.contains(only) && !!target && only.contains(target) ? only : el;
}

export const HIDDEN = '.beeson-off';
export const STACKED_AWAY = '.r-stack > .beeson-off';

export function movablesOf(app: App, hidden = HIDDEN): Element[] {
  const slide = app.current();
  if (!slide) return [];
  return [...slide.querySelectorAll(MOVABLE)].filter((el) => movableOf(app, el) === el && !el.closest(hidden) && el.getBoundingClientRect().width > 0);
}

export const LINE = 'svg.line';
export const strokeOf = (svg: Element): Element | null => svg.querySelector(':scope > line, :scope > path');

export function linesOf(app: App, hidden = HIDDEN): Element[] {
  const slide = app.current();
  if (!slide) return [];
  return [...slide.querySelectorAll(LINE)].filter((svg) => !!app.pairing?.elements.get(svg)?.open && svg.getClientRects().length > 0 && !svg.closest(OUTSIDE) && !svg.closest(hidden));
}

export function lineStroke(svg: Element): { pts: Point[]; mid: Point } {
  const r = svg.getBoundingClientRect();
  const w = Number(svg.getAttribute('width')) || r.width || 1, h = Number(svg.getAttribute('height')) || r.height || 1;
  const at = (p: Point) => ({ x: r.left + (p.x * r.width) / w, y: r.top + (p.y * r.height) / h });
  const s = parseStroke(strokeOf(svg));
  const pts = s ? pointsOf(s) : [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }, { x: 0, y: 0 }];
  const mid = (s && gripOf(s)) ?? { x: s ? (s.x1 + s.x2) / 2 : w / 2, y: s ? (s.y1 + s.y2) / 2 : h / 2 };
  return { pts: pts.map(at), mid: at(mid) };
}

export function lineEnds(svg: Element): [Point, Point] {
  const { pts } = lineStroke(svg);
  return [pts[0], pts[pts.length - 1]];
}

export const lineTouches = (svg: Element, box: Box): boolean => lineStroke(svg).pts.some((p, i, all) => i > 0 && segmentTouches(all[i - 1], p, box));

export function lineAt(app: App, x: number, y: number): Element | null {
  let best: Element | null = null;
  let near = 6;
  for (const svg of linesOf(app)) {
    const d = reach({ x, y }, lineStroke(svg).pts);
    if (d <= near) {
      near = d;
      best = svg;
    }
  }
  return best;
}

export function stackAt(app: App, x: number, y: number): Element[] {
  const out = linesOf(app).filter((svg) => reach({ x, y }, lineStroke(svg).pts) <= 6);
  for (const t of document.elementsFromPoint(x, y)) {
    const back = t.closest('.backdrop');
    const el = back && app.current()?.contains(back) && app.pairing?.elements.get(back)?.open ? back : movableOf(app, t);
    if (el && !out.includes(el)) out.push(el);
  }
  return out;
}

export function linePoints(app: App, skip: Element[] = []): Point[] {
  const f = frameOf(app);
  const slide = (p: Point) => ({ x: (p.x - f.left) / f.scale, y: (p.y - f.top) / f.scale });
  return linesOf(app).filter((svg) => !skip.includes(svg)).flatMap((svg) => {
    const { pts, mid } = lineStroke(svg);
    return [slide(pts[0]), slide(pts[pts.length - 1]), slide(mid)];
  });
}

export function snapBoxOf(app: App, el: Element): Box {
  const f = frameOf(app);
  if (!el.matches(LINE)) return toSlide(f, frameRect(el));
  const { pts } = lineStroke(el);
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const left = Math.min(...xs), top = Math.min(...ys);
  return toSlide(f, { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top });
}

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

export function holdsSeveral(el: Element): boolean {
  if (!el.matches(CONTAINER) || sizedOf(el).length) return false;
  const children = [...el.querySelectorAll(MOVABLE)].filter((m) => m.parentElement?.closest(MOVABLE) === el && m.getBoundingClientRect().width > 0);
  return children.length > 1;
}

export function mediaIn(figure: Element, target: Element | null): Element | null {
  const media = target?.closest('img, video') ?? null;
  if (media && media !== figure && figure.contains(media) && media.parentElement?.closest(MOVABLE) === figure) return media;
  if (!target || !figure.contains(target) || !holdsSeveral(figure)) return null;
  let el = target.closest(MOVABLE);
  while (el && el !== figure && el.parentElement?.closest(MOVABLE) !== figure) el = el.parentElement?.closest(MOVABLE) ?? null;
  return el && el !== figure ? el : null;
}

export function containerOf(app: App, el: Element): Element | null {
  const up = el.parentElement?.closest(MOVABLE) ?? null;
  return up && app.current()?.contains(up) ? up : null;
}

export function objectOf(app: App, el: Element): Element {
  const up = el.matches(RESIZABLE) ? containerOf(app, el) : null;
  return up && sizedOf(up).includes(el) && app.pairing?.elements.get(up)?.open ? up : el;
}

export function severalOf(app: App, el: Element): Element | null {
  const up = containerOf(app, el);
  return up && holdsSeveral(up) ? up : null;
}

export const objectsOf = (app: App, els: readonly Element[]): Element[] => [...new Set(els.map((el) => objectOf(app, el)))];

export function onCanvas(target: Element | null, app?: App, at?: { x: number; y: number }): boolean {
  if (!target || target.closest('aside.notes')) return false;
  if (target.closest('.reveal')) return true;
  const stage = app?.stage;
  if (!stage || !at || target !== stage.el) return false;
  const v = stage.viewport;
  return at.x >= v.left && at.x < v.right && at.y >= v.top && at.y < v.bottom;
}

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

export function innerBandAt(app: App, x: number, y: number): Element | null {
  for (const el of app.selection.elements()) {
    if (!severalOf(app, el)) continue;
    const r = el.getBoundingClientRect();
    const outside = x < r.left || x > r.right || y < r.top || y > r.bottom;
    if (outside && x >= r.left - BAND && x <= r.right + BAND && y >= r.top - BAND && y <= r.bottom + BAND) return el;
  }
  return null;
}

export const hasText = (el: Element): boolean => el.matches(HOST) || !!el.querySelector(HOST);
