import type { App } from '../app.ts';
import { translateText, type TagEdit, type Translate } from '../tags.ts';
import { frameOf } from './hit.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';

export const MASK_STYLE = ['object-fit', 'object-position', 'clip-path'] as const;
const BACKDROP_ZOOM = 4;
const DETENT = 0.03;
const LEAST = 20;

const CSS = `
html.beeson-masking .beeson-overlay { visibility: hidden; }
.beeson-mask-layer { position: fixed; inset: 0; z-index: 52; pointer-events: none; }
.beeson-mask-stage { position: fixed; pointer-events: auto; cursor: grab; touch-action: none; }
html.beeson-mask-panning, html.beeson-mask-panning * { cursor: grabbing !important; user-select: none !important; }
.beeson-mask-stage svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.beeson-mask-window { position: absolute; box-sizing: border-box; border: 1px dashed #3a3a3c; outline: 1px dashed rgba(255, 255, 255, 0.85); outline-offset: -2px; pointer-events: none; }
.beeson-mask-window i { position: absolute; display: none; width: 7px; height: 7px; margin: -4px 0 0 -4px; background: #1d1d1f; outline: 1px solid #fff; }
.beeson-mask-window i::after { content: ""; position: absolute; inset: -6px; }
.beeson-mask-stage.sizing { cursor: move; }
.beeson-mask-stage.sizing .beeson-mask-window i { display: block; pointer-events: auto; }
.beeson-mask-window i:is([data-handle=nw], [data-handle=se]) { cursor: nwse-resize; }
.beeson-mask-window i:is([data-handle=ne], [data-handle=sw]) { cursor: nesw-resize; }
.beeson-mask-window i:is([data-handle=n], [data-handle=s]) { cursor: ns-resize; }
.beeson-mask-window i:is([data-handle=e], [data-handle=w]) { cursor: ew-resize; }
.beeson-mask-cut { position: fixed; background: #e03131; box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.7); pointer-events: none; }
.beeson-mask-cut span { position: absolute; padding: 1px 6px; border-radius: 4px; background: #e03131; color: #fff; font: 600 11px/16px var(--ed-font, system-ui, sans-serif); white-space: nowrap; }
dialog.beeson-mask-bar { position: fixed; inset: auto; margin: 0; z-index: 53; display: flex; align-items: center; gap: 8px; box-sizing: border-box; height: 44px; padding: 6px 7px 6px 12px; border: 1px solid var(--ed-menu-line); border-radius: 22px; background: var(--ed-menu); color: var(--ed-text); font: 13px/1.25 var(--ed-font); box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22), 0 1px 3px rgba(0, 0, 0, 0.12); -webkit-backdrop-filter: blur(24px) saturate(1.6); backdrop-filter: blur(24px) saturate(1.6); user-select: none; -webkit-user-select: none; outline: none; }
dialog.beeson-mask-bar .what { color: var(--ed-muted); font-weight: 500; white-space: nowrap; }
dialog.beeson-mask-bar .what[hidden], dialog.beeson-mask-bar .modes[hidden] { display: none; }
dialog.beeson-mask-bar .modes { display: flex; gap: 2px; }
dialog.beeson-mask-bar button.mode { width: 30px; padding: 0; display: grid; place-items: center; background: transparent; color: var(--ed-text); }
dialog.beeson-mask-bar button.mode:disabled { opacity: 0.4; }
dialog.beeson-mask-bar button { height: 30px; padding: 0 13px; border: 0; border-radius: 15px; background: var(--ed-pressed); color: var(--ed-text); font: 500 13px/30px var(--ed-font); white-space: nowrap; cursor: default; }
dialog.beeson-mask-bar button[hidden] { display: none; }
dialog.beeson-mask-bar button[aria-pressed=true] { background: color-mix(in srgb, var(--ed-select) 22%, transparent); color: var(--ed-select); }
dialog.beeson-mask-bar button.done { background: var(--ed-select); color: var(--ed-on-select); padding: 0 16px; }
dialog.beeson-mask-bar button:focus-visible, dialog.beeson-mask-bar input:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 1px; }
dialog.beeson-mask-bar input[type=range] { width: 150px; accent-color: var(--ed-select); }
dialog.beeson-mask-bar output { min-width: 42px; color: var(--ed-muted); font-variant-numeric: tabular-nums; text-align: right; }
`;

type Box = { left: number; top: number; width: number; height: number };

type Fit = { w: number; h: number; bw: number; bh: number; zc: number; dx: number; dy: number; pos: [string | undefined, string | undefined]; pin: boolean };

type ImageState = { z: number; ox: number; oy: number; sx: number; sy: number };

const num = (v: string | undefined): number | null => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : null;
};
const round = (v: number, digits: number) => String(Number(v.toFixed(digits)));

export function scaleOf(el: Element): { x: number; y: number } {
  const parts = ((el as HTMLElement).style?.scale ?? '').trim().split(/\s+/).map(num);
  const x = parts[0] ?? 1;
  return { x: x || 1, y: parts[1] ?? x ?? 1 };
}

export function scaleText(x: number, y: number): string | null {
  if (Math.abs(x - 1) < 1e-6 && Math.abs(y - 1) < 1e-6) return null;
  if (Math.abs(x - y) < 1e-6 && x > 0) return round(x, 4);
  return `${round(x, 4)} ${round(y, 4)}`;
}

export const pinned = (el: Element): boolean => {
  const s = (el as HTMLElement).style;
  return !!s && !!s.width && !!s.height && !!s.objectFit;
};

export const masked = (el: Element): boolean => {
  const s = (el as HTMLElement).style;
  const own = (n: string) => !!s.getPropertyValue(n) && !(n === 'object-fit' && s.objectFit === 'contain');
  return !!s && (MASK_STYLE.some(own) || Math.abs(Math.abs(scaleOf(el).x) - 1) > 1e-6);
};

const at = (v: string | undefined, room: number) => (!v ? room / 2 : v.endsWith('%') ? ((num(v) ?? 50) / 100) * room : (num(v) ?? 0));

function fitOf(img: HTMLImageElement, pin = pinned(img)): Fit | null {
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const s = img.style;
  const kept = { fit: s.objectFit, position: s.objectPosition };
  s.objectFit = pin ? 'contain' : '';
  s.objectPosition = '';
  const cs = getComputedStyle(img);
  const pad = (a: string, b: string) => (num(cs.getPropertyValue(a)) ?? 0) + (num(cs.getPropertyValue(b)) ?? 0);
  const w = img.offsetWidth - pad('padding-left', 'padding-right'), h = img.offsetHeight - pad('padding-top', 'padding-bottom');
  const fit = cs.objectFit;
  const [px, py] = cs.objectPosition.split(/\s+/);
  s.objectFit = kept.fit;
  s.objectPosition = kept.position;
  if (!nw || !nh || !(w > 0) || !(h > 0)) return null;
  const contain = Math.min(w / nw, h / nh), cover = Math.max(w / nw, h / nh);
  const k = fit === 'contain' || fit === 'scale-down' ? contain : fit === 'cover' ? cover : fit === 'none' ? 1 : 0;
  const bw = k ? nw * k : w, bh = k ? nh * k : h;
  const zc = Math.max(1, Math.max(w / bw, h / bh));
  return { w, h, bw, bh, zc, dx: at(px, w - bw) + bw / 2 - w / 2, dy: at(py, h - bh) + bh / 2 - h / 2, pos: [px, py], pin };
}

function imageState(img: HTMLImageElement, f: Fit): ImageState {
  const sc = scaleOf(img);
  const m = Math.abs(sc.x), sx = Math.sign(sc.x) || 1, sy = Math.sign(sc.y) || 1;
  const cover = img.style.objectFit === 'cover';
  const k = cover ? f.zc : 1;
  const size = { w: f.bw * k, h: f.bh * k };
  const [px, py] = getComputedStyle(img).objectPosition.split(/\s+/);
  const lx = at(px, f.w - size.w) + size.w / 2 - f.w / 2, ly = at(py, f.h - size.h) + size.h / 2 - f.h / 2;
  return { z: m * k, ox: sx * m * lx, oy: sy * m * ly, sx, sy };
}

function clampImage(f: Fit, st: ImageState): ImageState {
  const lim = (size: number, box: number) => Math.abs(size - box) / 2;
  const cx = lim(st.z * f.bw, f.w), cy = lim(st.z * f.bh, f.h);
  return { ...st, ox: Math.max(-cx, Math.min(cx, st.ox)), oy: Math.max(-cy, Math.min(cy, st.oy)) };
}

function positionText(f: Fit, size: { w: number; h: number }, lx: number, ly: number): string {
  const axis = (box: number, s: number, l: number) => {
    const left = box / 2 + l - s / 2, room = box - s;
    if (Math.abs(room) > 0.5) return `${round((left / room) * 100, 2)}%`;
    return Math.abs(left) < 0.05 ? '50%' : `${round(left, 1)}px`;
  };
  return `${axis(f.w, size.w, lx)} ${axis(f.h, size.h, ly)}`;
}

export function imageStyle(f: Fit, st: ImageState, oval = false): Record<string, string | null> {
  const flip = scaleText(st.sx, st.sy);
  const out: Record<string, string | null> = { scale: flip, 'clip-path': null, 'object-fit': f.pin ? 'contain' : null, 'object-position': null };
  const lx = (st.sx * st.ox) / st.z, ly = (st.sy * st.oy) / st.z;
  const home = Math.abs(lx - f.dx) < 0.25 && Math.abs(ly - f.dy) < 0.25;
  if (Math.abs(st.z - 1) < 1e-3) {
    if (!home) out['object-position'] = positionText(f, { w: f.bw, h: f.bh }, lx, ly);
    return out;
  }
  if (f.zc > 1.001 && Math.abs(st.z - f.zc) < 1e-3 * f.zc) {
    const size = { w: f.bw * st.z, h: f.bh * st.z };
    const cx = st.sx * st.ox, cy = st.sy * st.oy;
    out['object-fit'] = 'cover';
    const hx = at(f.pos[0], f.w - size.w) + size.w / 2 - f.w / 2, hy = at(f.pos[1], f.h - size.h) + size.h / 2 - f.h / 2;
    if (Math.abs(cx - hx) >= 0.25 || Math.abs(cy - hy) >= 0.25) out['object-position'] = positionText(f, size, cx, cy);
    return out;
  }
  out.scale = scaleText(st.sx * st.z, st.sy * st.z);
  out['clip-path'] = `inset(${round(((1 - 1 / st.z) / 2) * 100, 3)}%${oval ? ' round 50%' : ''})`;
  if (!home) out['object-position'] = positionText(f, { w: f.bw, h: f.bh }, lx, ly);
  return out;
}

export function styleEdit(app: App, el: Element, style: Record<string, string | null>): TagEdit | null {
  const now = app.doc.tagState(el).style;
  const changed = Object.entries(style).filter(([n, v]) => (now[n] ?? null) !== v);
  return changed.length ? { style: Object.fromEntries(changed) } : null;
}

function syncLive(app: App, el: Element): void {
  const now = app.doc.tagState(el).style, s = (el as HTMLElement).style;
  for (const n of [...MASK_STYLE, 'scale', 'width', 'height', 'translate']) {
    const v = now[n];
    if (v === undefined) s.removeProperty(n);
    else s.setProperty(n, v);
  }
  if (!s.length && el.getAttribute('style') === '' && app.doc.tagState(el).attrs.style === undefined) el.removeAttribute('style');
}

type Extent = { x0: number; x1: number; y0: number; y1: number };
type Orbit = { el: HTMLElement; view: { cx: number; cy: number; half: number }; fittedToTrajectories: boolean; extent: Extent | null; setWindow(view: { cx: number; cy: number; half: number } | null): void };

const orbits = (): Orbit[] => (window as unknown as { Beeson?: { backdrops?: Orbit[] } }).Beeson?.backdrops ?? [];

export const orbitOf = (el: Element): Orbit | null => orbits().find((o) => o.el === el) ?? null;

export function syncBackdrops(): void {
  for (const o of orbits()) {
    if (!o.el.isConnected) continue;
    const d = o.el.dataset;
    const want = { cx: +(d.cx ?? 0), cy: +(d.cy ?? 0), half: +(d.half ?? 0.5) };
    const v = o.view, fitted = o.fittedToTrajectories;
    if (d.half === undefined && d.trajectories !== undefined) {
      if (!fitted) o.setWindow(null);
    } else if (fitted || v.cx !== want.cx || v.cy !== want.cy || v.half !== want.half) o.setWindow(want);
  }
}

export type Edge = 'top' | 'right' | 'bottom' | 'left';

export function cutEdges(extent: { x0: number; x1: number; y0: number; y1: number }, view: { cx: number; cy: number; half: number }, box: Box, slide: { width: number; height: number }): Edge[] {
  const aspect = box.width / box.height, out: Edge[] = [];
  const inside = { left: box.left > 0.5, top: box.top > 0.5, right: box.left + box.width < slide.width - 0.5, bottom: box.top + box.height < slide.height - 0.5 };
  if (inside.top && extent.y1 > view.cy + view.half) out.push('top');
  if (inside.right && extent.x1 > view.cx + view.half * aspect) out.push('right');
  if (inside.bottom && extent.y0 < view.cy - view.half) out.push('bottom');
  if (inside.left && extent.x0 < view.cx - view.half * aspect) out.push('left');
  return out;
}

export function markCuts(app: App, el: HTMLElement, view: { cx: number; cy: number; half: number }, extent: Extent | null, layer: HTMLElement, old: HTMLElement[]): HTMLElement[] {
  const f = frameOf(app);
  const r = el.getBoundingClientRect();
  const section = el.closest('section') as HTMLElement | null;
  const box = { left: (r.left - f.left) / f.scale, top: (r.top - f.top) / f.scale, width: r.width / f.scale, height: r.height / f.scale };
  const edges = extent ? cutEdges(extent, view, box, { width: section?.offsetWidth || 1920, height: section?.offsetHeight || 1080 }) : [];
  for (const c of old) c.remove();
  return edges.map((edge) => {
    const mark = make('div', 'beeson-mask-cut');
    mark.dataset.edge = edge;
    const v = edge === 'left' || edge === 'right';
    const x = edge === 'right' ? r.right - 2 : r.left - (v ? 1 : 0), y = edge === 'bottom' ? r.bottom - 2 : r.top - (v ? 0 : 1);
    Object.assign(mark.style, { left: `${x}px`, top: `${y}px`, width: v ? '3px' : `${r.width}px`, height: v ? `${r.height}px` : '3px' });
    const note = make('span', '', 'The drawing is cut here');
    Object.assign(note.style, v ? { top: '50%', [edge === 'left' ? 'left' : 'right']: '14px', transform: 'translateY(-50%)' } : { left: '50%', [edge === 'top' ? 'top' : 'bottom']: '14px', transform: 'translateX(-50%)' });
    mark.append(note);
    layer.append(mark);
    return mark;
  });
}

export function windowAttrs(view: { cx: number; cy: number; half: number }): Record<string, string> {
  const digits = Math.min(8, Math.max(3, 3 - Math.floor(Math.log10(view.half))));
  return { 'data-cx': round(view.cx, digits), 'data-cy': round(view.cy, digits), 'data-half': String(Number(view.half.toPrecision(4))) };
}

const toSlider = (z: number, lo: number, hi: number) => Math.round((Math.log(z / lo) / Math.log(hi / lo)) * 1000);
const fromSlider = (v: number, lo: number, hi: number) => lo * Math.pow(hi / lo, v / 1000);

type Session = {
  kind: 'image' | 'backdrop';
  el: HTMLElement;
  zoom(): number;
  range: [number, number];
  setZoom(z: number): void;
  pan(dx: number, dy: number): void;
  draw(): void;
  reset(): void;
  edit(): Promise<void>;
  cancel(): void;
  fill?(): void;
  filled?(): boolean | null;
  sizable?: boolean;
  grab?(): void;
  stretch?(handle: string | null, dx: number, dy: number): void;
};

type Edges = { l: number; t: number; r: number; b: number };

const translateOf = (v: string): Translate => {
  const [x, y] = v.split(/\s+/).map((p) => num(p) ?? 0);
  return { x: x ?? 0, y: y ?? 0 };
};

let session: Session | null = null;

export const editing = (): Element | null => session?.el ?? null;

const angleOf = (el: Element): number => parseFloat(getComputedStyle(el).rotate) || 0;

class MaskUi {
  readonly layer = make('div', 'beeson-mask-layer');
  readonly stage = make('div', 'beeson-mask-stage');
  readonly svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  readonly window = make('div', 'beeson-mask-window');
  readonly bar = make('dialog', 'beeson-mask-bar') as HTMLDialogElement;
  readonly what = make('span', 'what');
  readonly modes = make('span', 'modes');
  readonly image = make('button', 'mode');
  readonly mask = make('button', 'mode');
  readonly fill = make('button', 'fill', 'Fill');
  readonly reset = make('button', '', 'Reset');
  readonly slider = make('input');
  readonly value = make('output');
  readonly done = make('button', 'done', 'Done');
  cuts: HTMLElement[] = [];

  constructor() {
    this.stage.append(this.svg, this.window);
    const handles: [string, string, string][] = [['nw', '0', '0'], ['n', '50%', '0'], ['ne', '100%', '0'], ['e', '100%', '50%'], ['se', '100%', '100%'], ['s', '50%', '100%'], ['sw', '0', '100%'], ['w', '0', '50%']];
    for (const [name, x, y] of handles) {
      const i = make('i');
      i.dataset.handle = name;
      Object.assign(i.style, { left: x, top: y });
      this.window.append(i);
    }
    for (const [b, name, title] of [[this.image, 'image', 'Edit Image'], [this.mask, 'crop', 'Edit Mask']] as const) {
      b.type = 'button';
      b.title = title;
      b.setAttribute('aria-label', title);
      b.append(icon(name, 18));
      this.modes.append(b);
    }
    this.modes.setAttribute('role', 'group');
    this.layer.append(this.stage);
    this.slider.type = 'range';
    this.slider.min = '0';
    this.slider.max = '1000';
    this.fill.type = this.reset.type = this.done.type = 'button';
    this.fill.title = 'Scale the picture to fill its box';
    this.reset.title = 'The picture as it was before this edit';
    this.done.title = 'Apply the mask (Return)';
    this.bar.tabIndex = -1;
    this.bar.append(this.what, this.modes, this.fill, this.slider, this.value, this.reset, this.done);
  }
}

let ui: MaskUi | null = null;
let mode: 'image' | 'mask' = 'image';

function setMode(m: 'image' | 'mask'): void {
  mode = m;
  if (!ui) return;
  ui.image.setAttribute('aria-pressed', String(m === 'image'));
  ui.mask.setAttribute('aria-pressed', String(m === 'mask'));
  ui.stage.classList.toggle('sizing', m === 'mask');
}

function windowOf(el: HTMLElement, scale: number): Box {
  const r = el.getBoundingClientRect();
  const w = el.offsetWidth * scale, h = el.offsetHeight * scale;
  return { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - h / 2, width: w, height: h };
}

function drawStage(app: App, el: HTMLElement, outer: Box, picture: Box | null, deg: number): void {
  if (!ui) return;
  const v = app.stage?.viewport;
  ui.layer.style.clipPath = v ? `inset(${v.top}px ${innerWidth - v.right}px ${innerHeight - v.bottom}px ${v.left}px)` : '';
  const win = windowOf(el, frameOf(app).scale);
  const cx = win.left + win.width / 2, cy = win.top + win.height / 2;
  const right = Math.max(outer.left + outer.width, win.left + win.width), bottom = Math.max(outer.top + outer.height, win.top + win.height);
  const w = 2 * Math.max(cx - Math.min(outer.left, win.left), right - cx), h = 2 * Math.max(cy - Math.min(outer.top, win.top), bottom - cy);
  const ox = cx - w / 2, oy = cy - h / 2;
  Object.assign(ui.stage.style, { left: `${ox}px`, top: `${oy}px`, width: `${w}px`, height: `${h}px`, rotate: deg ? `${deg}deg` : '' });
  Object.assign(ui.window.style, { left: `${win.left - ox}px`, top: `${win.top - oy}px`, width: `${win.width}px`, height: `${win.height}px` });
  const slide = app.current();
  const wash = (slide && getComputedStyle(slide).getPropertyValue('--bg').trim()) || '#fff';
  ui.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  ui.svg.innerHTML = picture
    ? `<defs><mask id="beeson-mask-out"><rect width="${w}" height="${h}" fill="#fff"/><rect x="${win.left - ox}" y="${win.top - oy}" width="${win.width}" height="${win.height}" fill="#000"/></mask></defs><rect x="${picture.left - ox}" y="${picture.top - oy}" width="${picture.width}" height="${picture.height}" fill="${wash}" fill-opacity="0.62" mask="url(#beeson-mask-out)"/>`
    : '';
  placeBar(app, win);
}

function placeBar(app: App, win: Box): void {
  if (!ui) return;
  const bar = ui.bar;
  const v = app.stage?.viewport ?? new DOMRect(0, 0, innerWidth, innerHeight);
  const bw = bar.offsetWidth || 420, bh = bar.offsetHeight || 44;
  const below = win.top + win.height + 14, above = win.top - 14 - bh;
  const top = below + bh <= v.bottom - 8 ? below : above >= v.top + 8 ? above : Math.max(v.top + 8, Math.min(win.top + win.height - bh - 14, v.bottom - bh - 8));
  const left = Math.max(v.left + 8, Math.min(win.left + win.width / 2 - bw / 2, v.right - bw - 8));
  Object.assign(bar.style, { left: `${left}px`, top: `${top}px` });
}

function syncBar(): void {
  if (!ui || !session) return;
  const z = session.zoom();
  const [lo, hi] = session.range;
  ui.slider.dataset.lo = String(lo);
  ui.slider.dataset.hi = String(hi);
  ui.slider.value = String(toSlider(z, lo, hi));
  ui.value.textContent = `${Math.round(z * 100)}%`;
  const filled = session.filled?.() ?? null;
  ui.fill.hidden = filled === null;
  ui.fill.setAttribute('aria-pressed', String(!!filled));
}

function imageSession(app: App, img: HTMLImageElement): Session | null {
  const fit0 = fitOf(img);
  if (!fit0) return null;
  let fit: Fit = fit0;
  let st = clampImage(fit, imageState(img, fit));
  const start = { ...st };
  const lo = 1, hi = Math.max(4, fit.zc * 2);
  const s = img.style;
  const box0 = { width: s.width, height: s.height, translate: s.translate };
  const cs0 = getComputedStyle(img), size0 = `${Math.round(num(cs0.width) ?? 0)} ${Math.round(num(cs0.height) ?? 0)} ${box0.translate}`;
  let resized = false;
  let grip: { win: Edges; pic: Edges; pw: number; ox: number; oy: number; cx: number; cy: number; cw: number; ch: number; t: Translate } | null = null;
  const natural = img.naturalWidth / img.naturalHeight;
  const preview = () => {
    if (img.classList.contains('oval')) s.setProperty('clip-path', 'none');
    else s.removeProperty('clip-path');
    if (fit.pin) s.setProperty('object-fit', 'contain');
    else s.removeProperty('object-fit');
    const sc = scaleText(st.sx * st.z, st.sy * st.z);
    if (sc) s.setProperty('scale', sc);
    else s.removeProperty('scale');
    s.setProperty('object-position', positionText(fit, { w: fit.bw, h: fit.bh }, (st.sx * st.ox) / st.z, (st.sy * st.oy) / st.z));
  };
  const set = (next: ImageState, hold = true) => {
    st = hold ? clampImage(fit, next) : next;
    preview();
    draw();
  };
  const draw = () => {
    const f = frameOf(app);
    const win = windowOf(img, f.scale);
    const k = f.scale;
    const cw = st.z * fit.bw * k, ch = st.z * fit.bh * k;
    const cx = win.left + win.width / 2 + st.ox * k, cy = win.top + win.height / 2 + st.oy * k;
    const ew = st.z * fit.w * k, eh = st.z * fit.h * k;
    const ex = win.left + win.width / 2 - ew / 2, ey = win.top + win.height / 2 - eh / 2;
    const l = Math.max(cx - cw / 2, ex), t = Math.max(cy - ch / 2, ey);
    const r = Math.min(cx + cw / 2, ex + ew), b = Math.min(cy + ch / 2, ey + eh);
    const picture = { left: l, top: t, width: Math.max(0, r - l), height: Math.max(0, b - t) };
    drawStage(app, img, picture, picture, angleOf(img));
    syncBar();
  };
  preview();
  const scaled = (z: number) => ({ ...st, z, ox: (st.ox * z) / st.z, oy: (st.oy * z) / st.z });
  const k = () => frameOf(app).scale;
  const rad = () => (angleOf(img) * Math.PI) / 180;
  const centerOf = () => {
    const r = img.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const resize = (g: NonNullable<typeof grip>, w: Edges) => {
    const a = rad(), sk = k();
    s.width = `${Math.round(g.cw + w.r - w.l - (g.win.r - g.win.l))}px`;
    s.height = `${Math.round(g.ch + w.b - w.t - (g.win.b - g.win.t))}px`;
    s.objectFit = 'contain';
    s.translate = `${g.t.x}px ${g.t.y}px`;
    const lx = (w.l + w.r) / 2, ly = (w.t + w.b) / 2, c = centerOf();
    const wx = g.cx + (lx * Math.cos(a) - ly * Math.sin(a)) * sk, wy = g.cy + (lx * Math.sin(a) + ly * Math.cos(a)) * sk;
    const t = { x: Math.round(g.t.x + (wx - c.x) / sk), y: Math.round(g.t.y + (wy - c.y) / sk) };
    s.translate = t.x || t.y ? `${t.x}px ${t.y}px` : '';
    resized = `${parseFloat(s.width)} ${parseFloat(s.height)} ${s.translate}` !== size0;
    if (resized) fit = fitOf(img, true) ?? fit;
    else {
      Object.assign(s, box0);
      fit = fit0;
    }
    const now = centerOf(), dx = (now.x - g.cx) / sk, dy = (now.y - g.cy) / sk;
    const ux = dx * Math.cos(a) + dy * Math.sin(a), uy = -dx * Math.sin(a) + dy * Math.cos(a);
    set({ ...st, z: Math.max(1, g.pw / fit.bw), ox: g.ox - ux, oy: g.oy - uy }, false);
  };
  return {
    kind: 'image',
    sizable: Math.abs(fit0.bw / fit0.bh - natural) < 0.01 * natural,
    grab: () => {
      const cs = getComputedStyle(img), c = centerOf();
      const pw = st.z * fit.bw, ph = st.z * fit.bh;
      grip = {
        win: { l: -fit.w / 2, t: -fit.h / 2, r: fit.w / 2, b: fit.h / 2 },
        pic: { l: st.ox - pw / 2, t: st.oy - ph / 2, r: st.ox + pw / 2, b: st.oy + ph / 2 },
        pw, ox: st.ox, oy: st.oy, cx: c.x, cy: c.y, cw: num(cs.width) ?? fit.w, ch: num(cs.height) ?? fit.h, t: translateOf(s.translate),
      };
    },
    stretch: (handle, dx, dy) => {
      const g = grip;
      if (!g) return;
      const a = -rad(), sk = k();
      const ux = (dx * Math.cos(a) - dy * Math.sin(a)) / sk, uy = (dx * Math.sin(a) + dy * Math.cos(a)) / sk;
      const out = { l: Math.min(g.pic.l, g.win.l), t: Math.min(g.pic.t, g.win.t), r: Math.max(g.pic.r, g.win.r), b: Math.max(g.pic.b, g.win.b) };
      const lim = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
      const w = { ...g.win };
      if (!handle) {
        const mx = lim(ux, out.l - g.win.l, out.r - g.win.r), my = lim(uy, out.t - g.win.t, out.b - g.win.b);
        Object.assign(w, { l: w.l + mx, r: w.r + mx, t: w.t + my, b: w.b + my });
      } else {
        if (handle.includes('w')) w.l = lim(g.win.l + ux, out.l, w.r - LEAST);
        if (handle.includes('e')) w.r = lim(g.win.r + ux, w.l + LEAST, out.r);
        if (handle.includes('n')) w.t = lim(g.win.t + uy, out.t, w.b - LEAST);
        if (handle.includes('s')) w.b = lim(g.win.b + uy, w.t + LEAST, out.b);
      }
      resize(g, w);
    },
    el: img,
    range: [lo, hi],
    zoom: () => st.z,
    setZoom: (z) => set(scaled(fit.zc > 1.001 && Math.abs(z - fit.zc) < DETENT * fit.zc ? fit.zc : Math.max(lo, Math.min(hi, z)))),
    pan: (dx, dy) => {
      const k = frameOf(app).scale;
      const a = (-angleOf(img) * Math.PI) / 180;
      const ux = dx * Math.cos(a) - dy * Math.sin(a), uy = dx * Math.sin(a) + dy * Math.cos(a);
      set({ ...st, ox: st.ox + ux / k, oy: st.oy + uy / k });
    },
    fill: () => {
      if (fit.zc > 1.001) set(scaled(fit.zc));
    },
    filled: () => (fit.zc > 1.001 ? Math.abs(st.z - fit.zc) < 1e-3 * fit.zc : null),
    draw,
    reset: () => {
      Object.assign(s, box0);
      fit = fit0;
      resized = false;
      set({ ...start });
    },
    cancel: () => syncLive(app, img),
    edit: async () => {
      const box = { width: s.width || null, height: s.height || null, translate: translateOf(s.translate) };
      syncLive(app, img);
      const style = imageStyle(fit, st, img.classList.contains('oval'));
      if (resized) Object.assign(style, { width: box.width, height: box.height });
      const edit: TagEdit = styleEdit(app, img, style) ?? {};
      const t = box.translate.x || box.translate.y ? box.translate : null;
      if (resized && (app.doc.tagState(img).style.translate ?? null) !== (t && translateText(t))) edit.translate = t;
      if (Object.keys(edit).length) await app.history.transact('Edit Mask', () => app.doc.setTag(img, edit, 'mask'));
    },
  };
}

function backdropSession(app: App, el: HTMLElement): Session | null {
  const o = orbitOf(el);
  if (!o || !el.offsetHeight) return null;
  const start = { ...o.view };
  let view = { ...start };
  const extent = o.extent;
  const lo = 1 / BACKDROP_ZOOM, hi = BACKDROP_ZOOM;
  const set = (next: typeof view) => {
    view = next;
    o.setWindow(view);
    draw();
  };
  const draw = () => {
    if (!ui) return;
    const r = el.getBoundingClientRect();
    drawStage(app, el, { left: r.left, top: r.top, width: r.width, height: r.height }, null, 0);
    ui.cuts = markCuts(app, el, view, extent, ui.layer, ui.cuts);
    syncBar();
  };
  return {
    kind: 'backdrop',
    el,
    range: [lo, hi],
    zoom: () => start.half / view.half,
    setZoom: (z) => set({ ...view, half: start.half / Math.max(lo, Math.min(hi, z)) }),
    pan: (dx, dy) => {
      const k = (el.offsetHeight / 2 / view.half) * frameOf(app).scale;
      set({ ...view, cx: view.cx - dx / k, cy: view.cy + dy / k });
    },
    draw,
    reset: () => set({ ...start }),
    cancel: () => syncBackdrops(),
    edit: async () => {
      const moved = Math.abs(view.cx - start.cx) + Math.abs(view.cy - start.cy) + Math.abs(view.half - start.half) > 1e-9;
      const now = app.doc.tagState(el).attrs;
      const changed = Object.entries(windowAttrs(view)).filter(([n, v]) => now[n] !== v);
      if (moved && changed.length) await app.history.transact('Edit Backdrop Window', () => app.doc.setTag(el, { attrs: Object.fromEntries(changed) }, 'window'));
      syncBackdrops();
    },
  };
}

export async function finish(app: App, apply: boolean): Promise<void> {
  const s = session;
  if (!s || !ui) return;
  session = null;
  document.documentElement.classList.remove('beeson-masking', 'beeson-mask-panning');
  ui.bar.close();
  ui.layer.remove();
  ui.bar.remove();
  for (const c of ui.cuts) c.remove();
  ui.cuts = [];
  try {
    if (apply) await s.edit();
    else s.cancel();
  } finally {
    app.invalidate('content');
    if (s.kind === 'image' && s.el.isConnected && !app.selection.has(s.el) && apply) app.selection.set('elements', [s.el]);
  }
}

export function begin(app: App, el: Element): boolean {
  if (session) void finish(app, true);
  if (!el.isConnected || !ui) return false;
  if (el instanceof HTMLImageElement) app.selection.set('elements', [el]);
  const s = el instanceof HTMLImageElement ? imageSession(app, el) : el.matches('.backdrop') ? backdropSession(app, el as HTMLElement) : null;
  if (!s) return false;
  session = s;
  ui.what.textContent = s.kind === 'image' ? 'Mask' : 'Window';
  ui.what.hidden = s.kind === 'image';
  ui.modes.hidden = s.kind !== 'image';
  ui.mask.disabled = !s.sizable;
  ui.mask.title = s.sizable ? 'Edit Mask' : 'The picture is stretched to its box, which Edit Mask cannot resize';
  setMode('image');
  ui.slider.setAttribute('aria-label', s.kind === 'image' ? 'Scale of the image' : 'Scale of the drawing');
  ui.bar.setAttribute('aria-label', s.kind === 'image' ? 'Edit Mask' : 'Edit Backdrop Window');
  document.documentElement.classList.add('beeson-masking');
  document.body.append(ui.layer, ui.bar);
  ui.bar.show();
  s.draw();
  s.draw();
  ui.bar.focus({ preventScroll: true });
  return true;
}

export function maskTarget(app: App, t: Element): Element | null {
  const img = t.closest('img');
  if (img && app.pairing?.elements.get(img)?.open) return img;
  const back = t.closest('.backdrop');
  if (back && app.pairing?.elements.get(back)?.open && orbitOf(back)) return back;
  return null;
}

export function install(app: App): void {
  injectStyle('mask', CSS);
  const u = (ui = new MaskUi());
  u.slider.addEventListener('input', () => {
    if (!session) return;
    const [lo, hi] = session.range;
    session.setZoom(Math.round(fromSlider(Number(u.slider.value), lo, hi) * 100) / 100);
  });
  u.fill.addEventListener('click', () => session?.fill?.());
  u.image.addEventListener('click', () => setMode('image'));
  u.mask.addEventListener('click', () => setMode('mask'));
  u.reset.addEventListener('click', () => session?.reset());
  u.done.addEventListener('click', () => void finish(app, true).catch((e) => app.fail(e)));
  u.bar.addEventListener('keydown', (ev) => {
    if (!session) return;
    const step = (ev.shiftKey ? 10 : 1) * frameOf(app).scale;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (ev.key === 'Escape' || (ev.key === 'Enter' && !(ev.target instanceof HTMLButtonElement))) {
      ev.preventDefault();
      ev.stopPropagation();
      void finish(app, ev.key === 'Enter').catch((e) => app.fail(e));
    } else if (arrows[ev.key] && !(ev.target instanceof HTMLInputElement)) {
      ev.preventDefault();
      if (mode === 'mask' && session.stretch) {
        session.grab?.();
        session.stretch(null, ...arrows[ev.key]);
      } else session.pan(...arrows[ev.key]);
    }
  });
  u.bar.addEventListener('cancel', (ev) => ev.preventDefault());
  let last: { x: number; y: number; id: number } | null = null;
  let press: { x: number; y: number; handle: string | null } | null = null;
  u.stage.addEventListener('pointerdown', (ev) => {
    if (!session || ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    last = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
    u.stage.setPointerCapture?.(ev.pointerId);
    if (mode === 'mask' && session.grab) {
      session.grab();
      press = { x: ev.clientX, y: ev.clientY, handle: ev.target instanceof HTMLElement ? (ev.target.closest<HTMLElement>('.beeson-mask-window i')?.dataset.handle ?? null) : null };
    } else document.documentElement.classList.add('beeson-mask-panning');
  });
  u.stage.addEventListener('mousedown', (ev) => ev.preventDefault());
  u.stage.addEventListener('pointermove', (ev) => {
    if (!session || !last || ev.pointerId !== last.id) return;
    const dx = ev.clientX - last.x, dy = ev.clientY - last.y;
    last = { ...last, x: ev.clientX, y: ev.clientY };
    if (press) session.stretch?.(press.handle, ev.clientX - press.x, ev.clientY - press.y);
    else if (dx || dy) session.pan(dx, dy);
  });
  const up = () => {
    last = null;
    press = null;
    document.documentElement.classList.remove('beeson-mask-panning');
    u.bar.focus({ preventScroll: true });
  };
  u.stage.addEventListener('pointerup', up);
  u.stage.addEventListener('pointercancel', up);
  u.stage.addEventListener('dblclick', (ev) => {
    ev.stopPropagation();
    void finish(app, true).catch((e) => app.fail(e));
  });
  window.addEventListener('pointerdown', (ev) => {
    if (!session) return;
    const t = ev.target instanceof Node ? ev.target : null;
    if (t && (u.stage.contains(t) || u.bar.contains(t))) return;
    void finish(app, true).catch((e) => app.fail(e));
  }, true);
  document.addEventListener('dblclick', (ev) => {
    if (session) return;
    const t = ev.target instanceof Element ? ev.target : null;
    if (!t || !app.current()?.contains(t) || app.hostOf(t)) return;
    const target = maskTarget(app, t);
    if (target && begin(app, target)) ev.preventDefault();
  });
  app.listen('slide', () => void finish(app, false));
  app.listen('history', () => {
    syncBackdrops();
    if (session) void finish(app, false);
  });
  app.selection.listen(() => {
    if (session?.kind === 'image' && !app.selection.has(session.el)) void finish(app, false);
  });
  app.listen('resize', () => session?.draw());
  app.onRefresh(['layout', 'slide'], () => session?.draw());
}
