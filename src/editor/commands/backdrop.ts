// a backdrop as an element of the canvas: its commands, the pan of its window by a drag and by the
// arrow keys, the resize of its box by a grip with the drawing kept in place, the red marks of the
// edges at which its drawing is cut, its menu, and the gallery of Media > Backdrop…. a backdrop is
// drawn by the theme, hence a change of its drawing or of its labels is drawn again by
// Beeson.remount, and a tile of the gallery by Beeson.preview, so that the orbit engine is not
// copied into the editor

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { frameOf } from '../canvas/hit.ts';
import type { Handle } from '../canvas/snap.ts';
import { view as frameView } from '../canvas/frames.ts';
import { begin, editing, extentOf, markCuts, orbitOf, setView, syncBackdrops, windowAttrs } from '../canvas/mask.ts';
import { injectStyle, make } from '../ui/dom.ts';

type View = { cx: number; cy: number; half: number };
type Box = { left: number; top: number; width: number; height: number };
export type Live = { el: HTMLElement; view: View; done: boolean; tracing: boolean; ready: Promise<void>; fit(): void; reset(): void; start(): void; complete(): void; destroy(): void };
type Hooks = { backdrops?: Live[]; remount?(el: HTMLElement): Live; preview?(el: HTMLElement): Live; fitWindow?(el: HTMLElement, box?: Box): Promise<View | null> };
const hooks = (): Hooks => (window as unknown as { Beeson?: Hooks }).Beeson ?? {};

// the attributes that say what is drawn, which a change of drawing replaces, apart from the window
// and the motion
export const DRAWING = ['data-scene', 'data-strands', 'data-strands-select', 'data-strands-color', 'data-strands-ramp', 'data-strands-colormap', 'data-strands-shade', 'data-heads'];
export const SCENES: Record<string, string> = { nest: 'Nest', tubes: 'Tubes', wideRibbon: 'Wide Ribbon' };
// the labels of a named scene, with the text and the offsets of the demo deck
export const LABELS = [
  { at: 'L1', name: 'L1', text: '\\(\\LL{1}\\)', dy: '-34' },
  { at: 'L2', name: 'L2', text: '\\(\\LL{2}\\)', dy: '-34' },
  { at: 'moon', name: 'Moon', text: 'Moon', dy: '36' },
  { at: 'earth', name: 'Earth', text: 'Earth', dy: '36' },
];
export const COLORMAPS = ['viridis', 'plasma', 'Blues_r'];
// the factor of a zoom of the window
const ZOOM = 1.25;
// the least size of a box resized by a grip, in slide px
const LEAST = 40;
// the screen px that a press moves before it is a drag
const CLICK = 3;

const locked = (el: Element) => el.hasAttribute('data-locked');
const open = (app: App, el: Element) => !!app.pairing?.elements.get(el)?.open;

// the selected backdrop
export function selectedBackdrop(app: App): HTMLElement | null {
  const el = app.selection.only();
  return el?.matches('.backdrop') && el.isConnected && open(app, el) ? (el as HTMLElement) : null;
}

// the backdrop of the current slide in the file, the first one if there are more
export function slideBackdrop(app: App): HTMLElement | null {
  return [...(app.current()?.querySelectorAll<HTMLElement>(':scope > .backdrop') ?? [])].find((el) => open(app, el)) ?? null;
}

// the backdrop of the current slide under target, outside its labels
export function backdropAt(app: App, target: Element): HTMLElement | null {
  const el = target.closest<HTMLElement>('.backdrop');
  return el && !target.closest('.lab') && app.current()?.contains(el) && open(app, el) ? el : null;
}

export const liveOf = (el: Element | null): Live | null => (el ? ((orbitOf(el) as unknown as Live | null) ?? null) : null);

const given = (arg: unknown): HTMLElement | null => {
  const el = (arg as { el?: unknown } | undefined)?.el;
  return el instanceof HTMLElement && el.isConnected ? el : null;
};
// the backdrop that a command acts on: the one given, the one selected, or the one of the slide
const targetOf = (app: App, arg: unknown) => given(arg) ?? selectedBackdrop(app) ?? slideBackdrop(app);
const valueOf = (arg: unknown) => (arg as { value?: unknown } | undefined)?.value;

// the name of the drawing of el, i.e. its scene or the name of its file
export function drawingName(el: Element): string {
  const scene = el.getAttribute('data-scene');
  if (scene !== null) return SCENES[scene] ?? scene;
  const file = el.getAttribute('data-strands') ?? '';
  return file.split('/').pop()?.replace(/\.(js|json)$/, '') || 'Backdrop';
}

const round = (v: number) => Number(v.toFixed(8));

// the window of el written as attributes, with the ones not given read from its drawing, so that a
// fitted backdrop of a file gets all three. only the changed attributes are written
function writeWindow(app: App, el: HTMLElement, view: Partial<View>, label = 'window'): void {
  const now = app.doc.tagState(el).attrs;
  const v = { ...(liveOf(el)?.view ?? { cx: +(now['data-cx'] ?? 0), cy: +(now['data-cy'] ?? 0), half: +(now['data-half'] ?? 0.5) }), ...view };
  const out = windowAttrs(v);
  const attrs: Record<string, string> = {};
  for (const [k, name] of [['cx', 'data-cx'], ['cy', 'data-cy'], ['half', 'data-half']] as const) {
    const text = view[k] !== undefined ? String(round(view[k] as number)) : out[name];
    if (now[name] !== text && (view[k] !== undefined || now[name] === undefined)) attrs[name] = text;
  }
  if (Object.keys(attrs).length) app.doc.setTag(el, { attrs }, label);
  syncBackdrops();
}

// the window fitted to the box of el by the theme, or null
const fitted = async (el: HTMLElement, box?: Box): Promise<View | null> => (await hooks().fitWindow?.(el, box)) ?? null;

// the preview that is traced, which an edit or a change of slide completes
let previewed: Live | null = null;
function endPreview(): void {
  const o = previewed;
  previewed = null;
  if (o?.tracing) o.complete();
}

// the attributes of a drawing of a library entry, with every other drawing attribute taken off
const drawingEdit = (attrs: Record<string, string>): Record<string, string | null> => Object.fromEntries(DRAWING.map((n) => [n, attrs[n] ?? null]));

// an entry of the gallery: the drawing attributes, the window and the size of the box it was
// written for, and a name
type Entry = { key: string; name: string; attrs: Record<string, string>; view: View | null; size: [number, number] | null };

// the windows of the named scenes in the demo deck, with the size of their boxes
const BUILT_IN: Entry[] = [
  { key: 'nest', name: 'Nest', attrs: { 'data-scene': 'nest' }, view: { cx: 0.97, cy: 0, half: 0.5 }, size: [720, 1080] },
  { key: 'tubes', name: 'Tubes', attrs: { 'data-scene': 'tubes' }, view: { cx: 0.42, cy: 0, half: 0.6 }, size: [1920, 1080] },
  { key: 'wideRibbon', name: 'Wide Ribbon', attrs: { 'data-scene': 'wideRibbon' }, view: { cx: 0.2, cy: 0, half: 1.3 }, size: [1920, 1080] },
];

// the named scenes, and each other drawing of the deck, keyed by its drawing attributes
export function library(app: App): Entry[] {
  const out = [...BUILT_IN];
  const keys = new Set(out.map((e) => JSON.stringify(e.attrs)));
  for (const el of app.slides().querySelectorAll<HTMLElement>('.backdrop')) {
    if (!open(app, el)) continue;
    const now = app.doc.tagState(el).attrs;
    const attrs = Object.fromEntries(DRAWING.filter((n) => now[n] !== undefined).map((n) => [n, now[n]]));
    const key = JSON.stringify(attrs);
    if (!Object.keys(attrs).length || keys.has(key)) continue;
    keys.add(key);
    const view = now['data-half'] === undefined ? null : { cx: +(now['data-cx'] ?? 0), cy: +(now['data-cy'] ?? 0), half: +now['data-half'] };
    out.push({ key: `deck-${out.length}`, name: drawingName(el), attrs, view, size: [el.offsetWidth, el.offsetHeight] });
  }
  return out;
}

// the window of an entry kept on the box of el when the box has the size of the box of the entry,
// and else fitted to the box of el
async function windowFor(entry: Entry, el: HTMLElement): Promise<View | null> {
  if (entry.view && entry.size && Math.abs(entry.size[0] - el.offsetWidth) < 1 && Math.abs(entry.size[1] - el.offsetHeight) < 1) return entry.view;
  return fitted(el);
}

// the drawing of entry put on the current slide: in place of the drawing of the backdrop of the
// slide, or as a new backdrop at the ground of the slide, as one entry of the history
export async function applyEntry(app: App, entry: Entry): Promise<void> {
  const slide = app.current();
  if (!slide) return;
  const old = slideBackdrop(app);
  if (old) {
    await app.history.transact('Replace Backdrop', async () => {
      app.doc.setTag(old, { attrs: drawingEdit(entry.attrs) }, 'drawing');
      const v = await windowFor(entry, old);
      if (v) app.doc.setTag(old, { attrs: windowAttrs(v) }, 'window');
      syncBackdrops();
    });
    app.selection.set('elements', [old]);
    return;
  }
  await app.history.selecting('Add Backdrop', async () => {
    const view = entry.view ?? { cx: 0, cy: 0, half: 0.5 };
    const attrs = Object.entries({ ...entry.attrs, ...windowAttrs(view) }).map(([k, v]) => ` ${k}="${v.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join('');
    const [el] = await app.doc.insert(`<div class="backdrop"${attrs}></div>`, slide, slide.firstElementChild, 'add backdrop');
    const v = await windowFor(entry, el as HTMLElement);
    if (v) {
      const now = app.doc.tagState(el).attrs;
      const changed = Object.entries(windowAttrs(v)).filter(([k, x]) => now[k] !== x);
      if (changed.length) app.doc.setTag(el, { attrs: Object.fromEntries(changed) }, 'window');
    }
    syncBackdrops();
    app.selection.set('elements', [el]);
  });
}

// the gallery of Media > Backdrop…, a popover of a tile per entry of the library, drawn by the
// theme. a click on a tile applies its entry, and Escape or a press outside closes it
let gallery: { el: HTMLElement; tiles: Live[]; close(): void } | null = null;

const CSS = `
.beeson-backdrop-gallery { position: fixed; z-index: 60; display: grid; grid-template-columns: repeat(3, 160px); gap: 10px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow: auto; padding: 12px; box-sizing: border-box; border-radius: 12px; background: var(--ed-panel, #fff); box-shadow: 0 0 0 1px var(--ed-line, rgba(0, 0, 0, 0.15)), 0 12px 32px rgba(0, 0, 0, 0.25); color: var(--ed-text, #1d1d1f); font: 13px/1.3 var(--ed-font, system-ui, sans-serif); }
@media (max-width: 560px) { .beeson-backdrop-gallery { grid-template-columns: repeat(2, 1fr); } }
.beeson-backdrop-gallery h5 { grid-column: 1 / -1; margin: 0 0 2px; font: 600 13px/1.3 var(--ed-font, system-ui, sans-serif); }
.beeson-backdrop-gallery button { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 4px; border: 0; border-radius: 8px; background: none; color: inherit; font: inherit; text-align: center; cursor: default; }
.beeson-backdrop-gallery button:hover, .beeson-backdrop-gallery button:focus-visible { background: var(--ed-hover, rgba(0, 0, 0, 0.06)); outline: none; }
.beeson-backdrop-gallery .tile { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 6px; background: var(--bg); box-shadow: 0 0 0 1px var(--ed-line, rgba(0, 0, 0, 0.15)); }
.beeson-backdrop-gallery .tile canvas { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.beeson-backdrop-gallery .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beeson-backdrop-cuts { position: fixed; inset: 0; z-index: 51; pointer-events: none; }
html.beeson-masking .beeson-backdrop-cuts { display: none; }
`;

export function openGallery(app: App, anchor?: Element | null): void {
  gallery?.close();
  const el = make('div', 'beeson-backdrop-gallery');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Backdrops');
  el.append(make('h5', '', slideBackdrop(app) ? 'Replace the drawing of the backdrop' : 'Add a backdrop'));
  const tiles: Live[] = [];
  const close = () => {
    if (gallery?.el !== el) return;
    gallery = null;
    for (const t of tiles) t.destroy();
    el.remove();
    window.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('keydown', key, true);
  };
  const outside = (ev: PointerEvent) => {
    if (!(ev.target instanceof Node) || !el.contains(ev.target)) close();
  };
  const key = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape') return;
    ev.preventDefault();
    ev.stopPropagation();
    close();
  };
  document.body.append(el);
  for (const entry of library(app)) {
    const b = make('button');
    b.type = 'button';
    b.dataset.tile = entry.key;
    b.title = entry.name;
    const tile = make('div', 'tile');
    for (const [k, v] of Object.entries(entry.attrs)) tile.setAttribute(k, v);
    if (entry.view) for (const [k, v] of Object.entries(windowAttrs(entry.view))) tile.setAttribute(k, v);
    b.append(tile, make('span', 'name', entry.name));
    b.addEventListener('click', () => {
      close();
      void applyEntry(app, entry).catch((e) => app.fail(e));
    });
    el.append(b);
  }
  const r = anchor?.getBoundingClientRect();
  const w = el.offsetWidth, h = el.offsetHeight;
  const left = r && r.width ? Math.min(r.left, innerWidth - w - 16) : (innerWidth - w) / 2;
  const top = r && r.height ? Math.min(r.bottom + 6, innerHeight - h - 16) : (innerHeight - h) / 2;
  Object.assign(el.style, { left: `${Math.max(16, left)}px`, top: `${Math.max(16, top)}px` });
  // the tiles are drawn once the popover is laid out, in the mode of the deck
  for (const tile of el.querySelectorAll<HTMLElement>('.tile')) {
    const o = hooks().preview?.(tile);
    if (o) tiles.push(o);
  }
  gallery = { el, tiles, close };
  window.addEventListener('pointerdown', outside, true);
  window.addEventListener('keydown', key, true);
  el.querySelector('button')?.focus({ preventScroll: true });
}

// the pans of a run of arrow keys on one backdrop, each within PAUSE ms of the one before, are one
// entry of the history, as a run of nudges of commands/arrange.ts is
const PAUSE = 1000;
let run: { el: HTMLElement; at: number; entry: App['history']['last'] } | null = null;
let queue: Promise<void> = Promise.resolve();

// the window of the selected backdrop panned by dx, dy slide px, i.e. its drawing moved by them,
// and true, or false when a backdrop is not selected
export function nudgeBackdrop(app: App, dx: number, dy: number): boolean {
  const el = selectedBackdrop(app);
  if (!el || !liveOf(el)) return false;
  if (locked(el)) return true;
  const at = performance.now();
  queue = queue.then(async () => {
    const o = liveOf(el);
    if (!o || !el.isConnected) return;
    const v = o.view, per = el.offsetHeight / 2 / v.half;
    const write = () => writePan(app, el, { ...v, cx: v.cx - dx / per, cy: v.cy + dy / per });
    const last = run;
    if (last && last.el === el && at - last.at < PAUSE && last.entry && app.history.last === last.entry) await app.history.amend(last.entry, write);
    else await app.history.transact('Move Backdrop', write);
    run = { el, at, entry: app.history.last };
  }).catch((e) => app.fail(e));
  return true;
}

// the window to written as a pan, i.e. data-cx and data-cy, with the half height of a fitted
// backdrop of a file
function writePan(app: App, el: HTMLElement, to: View): void {
  const now = app.doc.tagState(el).attrs;
  const text = windowAttrs(to);
  const attrs: Record<string, string> = {};
  for (const n of ['data-cx', 'data-cy']) if (now[n] !== text[n]) attrs[n] = text[n];
  if (now['data-half'] === undefined) attrs['data-half'] = text['data-half'];
  if (Object.keys(attrs).length) app.doc.setTag(el, { attrs }, 'window');
  syncBackdrops();
}

const translateOf = (v: string | undefined): { x: number; y: number } => {
  const [x, y] = (v ?? '').split(/\s+/).map((p) => parseFloat(p) || 0);
  return { x: x ?? 0, y: y ?? 0 };
};

// a press on the selected backdrop el, which pans its window, or on its grip handle, which resizes
// its box with the drawing kept at its place and its scale on the slide. the release writes the
// change as one entry
export function pressBackdrop(app: App, ev: PointerEvent, el: HTMLElement, handle: Handle | null): void {
  const o = liveOf(el);
  if (!o || locked(el)) return;
  ev.preventDefault();
  ev.stopPropagation();
  endPreview();
  const f = frameOf(app);
  const v0 = o.view;
  const r = el.getBoundingClientRect();
  const b0 = { left: (r.left - f.left) / f.scale, top: (r.top - f.top) / f.scale, width: r.width / f.scale, height: r.height / f.scale };
  const per = b0.height / 2 / v0.half;
  const t0 = translateOf(app.doc.tagState(el).style.translate);
  const style0 = { translate: el.style.translate, width: el.style.width, height: el.style.height };
  let moved = false;
  let next: { view: View; box: Box | null } = { view: v0, box: null };
  const sx = ev.clientX, sy = ev.clientY;
  const move = (e: PointerEvent) => {
    if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < CLICK) return;
    moved = true;
    const dx = (e.clientX - sx) / f.scale, dy = (e.clientY - sy) / f.scale;
    if (!handle) {
      next = { view: { ...v0, cx: v0.cx - dx / per, cy: v0.cy + dy / per }, box: null };
      setView(o as never, next.view);
    } else {
      let L = b0.left, R = b0.left + b0.width, T = b0.top, B = b0.top + b0.height;
      if (handle.includes('w')) L = Math.min(R - LEAST, L + dx);
      if (handle.includes('e')) R = Math.max(L + LEAST, R + dx);
      if (handle.includes('n')) T = Math.min(B - LEAST, T + dy);
      if (handle.includes('s')) B = Math.max(T + LEAST, B + dy);
      [L, R, T, B] = [L, R, T, B].map(Math.round);
      const box = { left: L, top: T, width: R - L, height: B - T };
      const view = { half: box.height / 2 / per, cx: v0.cx + (L + R - 2 * b0.left - b0.width) / 2 / per, cy: v0.cy - (T + B - 2 * b0.top - b0.height) / 2 / per };
      next = { view, box };
      Object.assign(el.style, { translate: `${t0.x + L - b0.left}px ${t0.y + T - b0.top}px`, width: `${box.width}px`, height: `${box.height}px` });
      setView(o as never, view);
      frameView.readout = { text: `w: ${box.width} px  h: ${box.height} px`, x: e.clientX + 14, y: e.clientY + 18, at: 'pointer' };
    }
    app.invalidate('layout');
  };
  const up = () => {
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', up, true);
    window.removeEventListener('pointercancel', up, true);
    frameView.readout = null;
    if (!moved) return;
    const box = next.box;
    if (!box) {
      void app.history.transact('Move Backdrop', () => writePan(app, el, next.view)).then(() => app.invalidate('layout'));
      return;
    }
    Object.assign(el.style, style0);
    const t = { x: Math.round(t0.x + box.left - b0.left), y: Math.round(t0.y + box.top - b0.top) };
    const now = app.doc.tagState(el).attrs;
    const attrs = Object.fromEntries(Object.entries(windowAttrs(next.view)).filter(([k, x]) => now[k] !== x));
    void app.history.transact('Resize Backdrop', () => {
      app.doc.setTag(el, { attrs, translate: t.x || t.y ? t : null, style: { width: `${box.width}px`, height: `${box.height}px` }, order: { style: ['translate', 'width', 'height'] } }, 'resize');
      syncBackdrops();
    }).then(() => app.invalidate('layout'));
  };
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', up, true);
}

const backdropMenu = (order: number): Command['menu'] => ({ bar: 'Format', group: 'backdrop', order, submenu: 'Backdrop' });
const has = (app: App) => !!targetOf(app, undefined) && !editing();

export function commands(): Command[] {
  const field = (id: string, label: string, key: keyof View): Command => ({
    // arg { value, el }, from a field of the pane Backdrop
    id: `backdrop.${id}`,
    label: `Backdrop ${label}`,
    undoable: true,
    undo: label,
    enabled: (app) => !!liveOf(targetOf(app, undefined)),
    run: (app, arg) => {
      const el = targetOf(app, arg);
      const value = Number(valueOf(arg));
      if (!el || !Number.isFinite(value) || (key === 'half' && value <= 0)) return;
      endPreview();
      writeWindow(app, el, { [key]: value });
    },
  });
  const zoom = (id: string, label: string, by: number): Command => ({
    id: `backdrop.${id}`,
    label,
    undoable: true,
    enabled: (app) => !!liveOf(targetOf(app, undefined)),
    run: (app, arg) => {
      const el = targetOf(app, arg);
      const o = liveOf(el);
      if (!el || !o) return;
      endPreview();
      writeWindow(app, el, { half: Number((o.view.half * by).toPrecision(4)) });
    },
  });
  return [
    field('cx', 'Center X', 'cx'),
    field('cy', 'Center Y', 'cy'),
    field('half', 'Half Height', 'half'),
    zoom('zoomIn', 'Zoom In', 1 / ZOOM),
    zoom('zoomOut', 'Zoom Out', ZOOM),
    {
      id: 'backdrop.edit',
      label: 'Edit Window',
      menu: backdropMenu(1),
      context: ['element'],
      enabled: (app) => has(app) && !!liveOf(targetOf(app, undefined)),
      run: (app, arg) => {
        const el = targetOf(app, arg);
        if (el) begin(app, el);
      },
    },
    {
      // the window that fits the drawing to the box, as a backdrop of a file without data-half is
      // fitted
      id: 'backdrop.fitWindow',
      label: 'Fit Window',
      menu: backdropMenu(2),
      context: ['element'],
      undoable: true,
      enabled: has,
      run: async (app, arg) => {
        const el = targetOf(app, arg);
        if (!el) return;
        endPreview();
        const v = await fitted(el);
        if (!v) return;
        const now = app.doc.tagState(el).attrs;
        const changed = Object.entries(windowAttrs(v)).filter(([k, x]) => now[k] !== x);
        if (changed.length) app.doc.setTag(el, { attrs: Object.fromEntries(changed) }, 'window');
        syncBackdrops();
      },
    },
    {
      // traces the backdrop once, as the show traces it, and leaves it complete
      id: 'backdrop.preview',
      label: 'Preview',
      menu: backdropMenu(3),
      context: ['element'],
      enabled: (app) => has(app) && !!liveOf(targetOf(app, undefined)),
      run: (app, arg) => {
        const o = liveOf(targetOf(app, arg));
        if (!o) return;
        endPreview();
        previewed = o;
        o.reset();
        o.start();
      },
    },
    {
      // arg { value, el }: a named scene, or the key of an entry of the library. the window, the
      // labels, and the motion are kept
      id: 'backdrop.scene',
      label: 'Backdrop Drawing',
      undoable: true,
      undo: 'Change Drawing',
      enabled: (app) => !!targetOf(app, undefined),
      run: (app, arg) => {
        const el = targetOf(app, arg);
        const v = String(valueOf(arg) ?? '');
        const entry = library(app).find((e) => e.key === v);
        if (!el || !entry) return;
        endPreview();
        const attrs = drawingEdit(entry.attrs);
        const now = app.doc.tagState(el).attrs;
        const changed = Object.entries(attrs).filter(([k, x]) => (now[k] ?? null) !== x);
        if (changed.length) app.doc.setTag(el, { attrs: Object.fromEntries(changed) }, 'drawing');
      },
    },
    {
      // arg { value, el }: a colormap of the strands of a file, or null for the palette
      id: 'backdrop.colormap',
      label: 'Backdrop Colormap',
      undoable: true,
      undo: 'Colormap',
      enabled: (app) => !!targetOf(app, undefined)?.hasAttribute('data-strands'),
      run: (app, arg) => {
        const el = targetOf(app, arg);
        const v = valueOf(arg);
        const value = typeof v === 'string' && COLORMAPS.includes(v) ? v : null;
        if (el && el.getAttribute('data-strands-colormap') !== value) app.doc.setTag(el, { attrs: { 'data-strands-colormap': value } }, 'drawing');
      },
    },
    {
      // arg { at, el }: a label of a point of a named scene put on the backdrop, or taken off
      id: 'backdrop.label',
      label: 'Backdrop Label',
      undoable: true,
      undo: 'Label',
      enabled: (app) => !!targetOf(app, undefined)?.hasAttribute('data-scene'),
      run: async (app, arg) => {
        const el = targetOf(app, arg);
        const at = (arg as { at?: string } | undefined)?.at;
        const label = LABELS.find((l) => l.at === at);
        if (!el || !label) return;
        endPreview();
        const lab = [...el.querySelectorAll(':scope > .lab')].find((l) => l.getAttribute('data-at') === at && open(app, l));
        if (lab) await app.doc.remove(lab, 'label');
        else {
          // the labels are kept in the order of LABELS
          const after = LABELS.slice(LABELS.indexOf(label) + 1).map((l) => l.at);
          const before = [...el.querySelectorAll(':scope > .lab')].find((l) => after.includes(l.getAttribute('data-at') ?? '')) ?? null;
          await app.doc.insert(`<span class="lab" data-at="${label.at}" data-dy="${label.dy}">${label.text}</span>`, el, before, 'label');
        }
      },
    },
    {
      id: 'backdrop.live',
      label: 'Live',
      undoable: true,
      enabled: (app) => !!targetOf(app, undefined),
      checked: (app) => !!targetOf(app, undefined)?.hasAttribute('data-live'),
      run: (app, arg) => {
        const el = targetOf(app, arg);
        if (el) app.doc.setTag(el, { attrs: { 'data-live': el.hasAttribute('data-live') ? null : '' } }, 'motion');
      },
    },
    {
      // arg { value, el }: the seconds of the trace, or 0 for the default of the theme
      id: 'backdrop.duration',
      label: 'Backdrop Duration',
      undoable: true,
      undo: 'Duration',
      enabled: (app) => !!targetOf(app, undefined),
      run: (app, arg) => {
        const el = targetOf(app, arg);
        const value = Number(valueOf(arg));
        if (!el || !Number.isFinite(value) || value < 0) return;
        const text = value > 0 ? String(round(value)) : null;
        if (el.getAttribute('data-duration') !== text) app.doc.setTag(el, { attrs: { 'data-duration': text } }, 'motion');
      },
    },
    {
      id: 'backdrop.choose',
      label: 'Choose Backdrop…',
      enabled: (app) => !!app.current() && !editing(),
      run: (app, arg) => openGallery(app, arg instanceof Element ? arg : null),
    },
    {
      id: 'backdrop.select',
      label: 'Select Backdrop',
      enabled: (app) => !!slideBackdrop(app),
      run: (app) => {
        const el = slideBackdrop(app);
        if (el) app.selection.set('elements', [el]);
      },
    },
  ];
}

// the drawing of a backdrop made again by the theme after a change of its drawing attributes or of
// its labels, also at an undo
function watch(app: App): void {
  const pending = new Set<HTMLElement>();
  const WINDOW = ['data-cx', 'data-cy', 'data-half'];
  let queued = false;
  const flush = () => {
    queued = false;
    for (const el of pending) if (el.isConnected && liveOf(el)) hooks().remount?.(el);
    pending.clear();
    syncBackdrops();
    app.invalidate('content');
  };
  new MutationObserver((records) => {
    let moved = false;
    for (const r of records) {
      const t = r.target;
      if (!(t instanceof HTMLElement) || !t.matches('.backdrop')) continue;
      const labs = [...r.addedNodes, ...r.removedNodes].some((n) => n instanceof Element && n.matches('.lab'));
      // a window alone, e.g. of an undo or of a file opened again, is set without a new drawing
      if (r.type === 'attributes' && WINDOW.includes(r.attributeName ?? '')) moved = true;
      else if (r.type === 'attributes' || labs) pending.add(t);
    }
    if ((pending.size || moved) && !queued) {
      queued = true;
      queueMicrotask(flush);
    }
  }).observe(app.slides(), { subtree: true, childList: true, attributes: true, attributeFilter: [...DRAWING, ...WINDOW, 'data-dx', 'data-dy'] });
}

// the red marks of the edges at which the drawing of the selected backdrop is cut
function cuts(app: App): void {
  const layer = make('div', 'beeson-backdrop-cuts');
  document.body.append(layer);
  let marks: HTMLElement[] = [];
  const draw = () => {
    const el = selectedBackdrop(app);
    const o = liveOf(el);
    if (!el || !o || editing()) {
      for (const m of marks) m.remove();
      marks = [];
      return;
    }
    const v = app.stage?.viewport;
    if (v) layer.style.clipPath = `inset(${v.top}px ${innerWidth - v.right}px ${innerHeight - v.bottom}px ${v.left}px)`;
    marks = markCuts(app, el, o.view, extentOf(o as never), layer, marks);
  };
  app.selection.listen(draw);
  app.onRefresh(['layout', 'slide', 'content'], draw);
  app.listen('resize', draw);
  app.listen('history', draw);
}

export function install(app: App): void {
  injectStyle('backdrop', CSS);
  for (const c of commands()) app.commands.define(c);
  watch(app);
  cuts(app);
  // a preview ends at an edit, at a change of slide, and at a change of the selection
  app.listen('history', endPreview);
  app.listen('slide', () => {
    endPreview();
    gallery?.close();
  });
}
