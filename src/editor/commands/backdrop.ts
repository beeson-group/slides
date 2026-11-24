import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { frameOf } from '../canvas/hit.ts';
import type { Handle } from '../canvas/snap.ts';
import { setPreview, view as frameView } from '../canvas/frames.ts';
import { begin, editing, markCuts, orbitOf, syncBackdrops, windowAttrs } from '../canvas/mask.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { selectIn } from '../text/elements.ts';
import { select, type TrajectoryData } from '../../trajectories.ts';
import { SYSTEMS, systemOf } from '../../poincare.ts';
import { ALPHAS, PLANES, planeOf, shownTori, toriSpec } from '../../tori.ts';
import { modelOf } from '../steps.ts';

type View = { cx: number; cy: number; half: number };
type Box = { left: number; top: number; width: number; height: number };
export type Live = { el: HTMLElement; view: View; extent: { x0: number; x1: number; y0: number; y1: number } | null; setWindow(view: View | null): void; done: boolean; tracing: boolean; ready: Promise<void>; fileTrajectories?: TrajectoryData[] | null; fit(): void; reset(): void; start(): void; complete(): void; destroy(): void };
type Hooks = { backdrops?: Live[]; remount?(el: HTMLElement): Live; preview?(el: HTMLElement): Live; fitWindow?(el: HTMLElement, box?: Box): Promise<View | null> };
const hooks = (): Hooks => (window as unknown as { Beeson?: Hooks }).Beeson ?? {};

export const DRAWING = ['data-backdrop', 'data-system', 'data-plane', 'data-tori', 'data-trajectories', 'data-trajectories-select', 'data-trajectories-color', 'data-trajectories-ramp', 'data-trajectories-colormap', 'data-trajectories-shade', 'data-heads'];
export const NAMES = {
  tubes: 'Cislunar Manifolds',
  wideRibbon: 'Earth Manifolds',
  poincare: 'Poincaré Sections',
  tori: 'Invariant Tori',
  saddle: 'Saddle Manifolds',
  normalForm: 'Normal Form',
  logo: 'Beeson Logo',
  logoPart: 'Part of the Beeson Logo',
  broucke: 'Broucke Families',
  custom: 'Custom',
};
export const BUILT_IN: Record<string, string> = { tubes: NAMES.tubes, wideRibbon: NAMES.wideRibbon, poincare: NAMES.poincare, tori: NAMES.tori, saddle: NAMES.saddle, normalForm: NAMES.normalForm };
const DOTTED = ['poincare', 'tori', 'normalForm'];
const LABELED = ['tubes', 'wideRibbon'];
export const labeledDrawing = (el: Element | null): boolean => !!el && !el.hasAttribute('data-trajectories') && LABELED.includes(el.getAttribute('data-backdrop') ?? '');
export const dottedDrawing = (el: Element | null): string | null => {
  const name = el && !el.hasAttribute('data-trajectories') ? el.getAttribute('data-backdrop') : null;
  return name !== null && DOTTED.includes(name) ? name : null;
};
export const SYSTEM_NAMES: Record<string, string> = {
  'earth-moon-l2': 'Earth–Moon L2',
  'sun-earth-l1': 'Sun–Earth L1',
  'bicircular-l1-horizontal': 'Bicircular L1 (Horizontal)',
  'bicircular-l1-vertical': 'Bicircular L1 (Vertical)',
};
export const PLANE_NAMES: Record<string, string> = { xy: 'x, y', xz: 'x, z' };
export { ALPHAS, PLANES, SYSTEMS };
export const systemPick = (el: Element | null): string => systemOf(el?.getAttribute('data-system'));
export const planePick = (el: Element | null): string => planeOf(el?.getAttribute('data-plane'));
export const toriPick = (el: Element | null): boolean[] => {
  const shown = shownTori(el?.getAttribute('data-tori'), ALPHAS.map(Number));
  return ALPHAS.map((_, n) => shown.includes(n));
};
const LOGO_FILE = 'brand/transfer.js';
const BROUCKE_FILE = 'demo/broucke-sample.js';
const MOTION = ['data-duration', 'data-stagger'];
export const LABELS = [
  { at: 'L1', name: 'L1', text: '\\(\\mathcal{L}_{1}\\)', dy: '-34' },
  { at: 'L2', name: 'L2', text: '\\(\\mathcal{L}_{2}\\)', dy: '-34' },
  { at: 'moon', name: 'Moon', text: 'Moon', dy: '36' },
  { at: 'earth', name: 'Earth', text: 'Earth', dy: '36' },
];
export const COLORMAPS = ['viridis', 'plasma', 'magma', 'Blues_r'];
const COLORMAP_NAMES: Record<string, string> = { viridis: 'Viridis', plasma: 'Plasma', magma: 'Magma', Blues_r: 'Blues (Reversed)' };
export const colormapName = (value: string | null): string => (value === null ? 'Palette' : COLORMAP_NAMES[value] ?? value);
const ZOOM = 1.25;
const LEAST = 40;
const CLICK = 3;

const locked = (el: Element) => el.hasAttribute('data-locked');
const open = (app: App, el: Element) => !!app.pairing?.elements.get(el)?.open;

export function selectedBackdrop(app: App): HTMLElement | null {
  const el = app.selection.only();
  return el?.matches('.backdrop') && el.isConnected && open(app, el) ? (el as HTMLElement) : null;
}

export function slideBackdrop(app: App): HTMLElement | null {
  return [...(app.current()?.querySelectorAll<HTMLElement>(':scope > .backdrop') ?? [])].find((el) => open(app, el)) ?? null;
}

export function backdropAt(app: App, target: Element): HTMLElement | null {
  const el = target.closest<HTMLElement>('.backdrop');
  return el && !target.closest('.label') && app.current()?.contains(el) && open(app, el) ? el : null;
}

export function labelAt(el: HTMLElement, view: View, clientX?: number, clientY?: number): [number, number] {
  const r = el.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  const s = w ? r.width / w : 1, k = h / 2 / view.half;
  const px = clientX === undefined ? w / 2 : (clientX - r.left) / s, py = clientY === undefined ? h / 2 : (clientY - r.top) / s;
  const digits = Math.max(0, Math.ceil(Math.log10(k)));
  return [view.cx + (px - w / 2) / k, view.cy - (py - h / 2) / k].map((v) => Number(v.toFixed(digits)) || 0) as [number, number];
}

export const liveOf = (el: Element | null): Live | null => (el ? ((orbitOf(el) as unknown as Live | null) ?? null) : null);

const given = (arg: unknown): HTMLElement | null => {
  const el = (arg as { el?: unknown } | undefined)?.el;
  return el instanceof HTMLElement && el.isConnected ? el : null;
};
const targetOf = (app: App, arg: unknown) => given(arg) ?? selectedBackdrop(app) ?? slideBackdrop(app);
const valueOf = (arg: unknown) => (arg as { value?: unknown } | undefined)?.value;

const isFile = (path: string, file: string) => path === file || path.endsWith(`/${file}`);

export type Pick = { family: string; frame: string; branch?: string };
export const FAMILIES = ['7', '11', '7/11'];
export const FRAMES = ['Rotating', 'Inertial'];
export const BRANCHES = ['Periapsis', 'Apoapsis'];
const SPECS: Record<string, string> = {
  '7 Rotating Periapsis': 'family=7,branch=periapsis,frame=pulsating',
  '7 Rotating Apoapsis': 'family=7,branch=apoapsis,frame=rotating',
  '7 Inertial Periapsis': 'family=7,branch=periapsis,frame=inertial-m2',
  '7 Inertial Apoapsis': 'family=7,branch=apoapsis,frame=inertial-m2',
  '11 Rotating': 'family=11,frame=pulsating',
  '11 Inertial': 'family=11,frame=inertial',
  '7/11 Rotating': 'frame=pulsating',
  '7/11 Inertial': 'frame=inertial',
};
const keyOf = (p: Pick) => [p.family, p.frame, p.branch].filter(Boolean).join(' ');

const TERM = /^\s*([^=<>\s]+)\s*(<=|>=|=|<|>)\s*(.*?)\s*$/;
const normal = (spec: string | null): string => (spec ?? '').split(';').map((g) => g.split(',').map((t) => {
  const m = TERM.exec(t);
  return m ? `${m[1]}${m[2]}${m[2] === '=' ? [...new Set(m[3].split('|').map((v) => v.trim()))].sort().join('|') : m[3]}` : t.trim();
}).filter(Boolean).sort().join(',')).filter(Boolean).sort().join(';');

const fileTrajectoriesByFile = new Map<string, TrajectoryData[]>();
function fileTrajectoriesOf(el: Element | null | undefined): TrajectoryData[] | null {
  if (!el || !isBroucke(el)) return null;
  const url = urlOf(el.getAttribute('data-trajectories') ?? '');
  const live = liveOf(el)?.fileTrajectories;
  if (live) fileTrajectoriesByFile.set(url, live);
  return fileTrajectoriesByFile.get(url) ?? null;
}

function drawn(fileTrajectories: TrajectoryData[], spec: string | null): Set<TrajectoryData> {
  try {
    return new Set(select(fileTrajectories, spec ?? undefined));
  } catch {
    return new Set();
  }
}
const sameSet = <T>(a: Set<T>, b: Set<T>) => a.size === b.size && [...a].every((x) => b.has(x));

function sameSelection(a: string | null, b: string | null, el?: Element | null): boolean {
  const fileTrajectories = fileTrajectoriesOf(el);
  if (!fileTrajectories) return normal(a) === normal(b);
  const x = drawn(fileTrajectories, a);
  return sameSet(x, drawn(fileTrajectories, b)) && (x.size > 0 || normal(a) === normal(b));
}

function pickOf(spec: string | null, el?: Element | null): Pick | null {
  const key = Object.keys(SPECS).find((k) => sameSelection(SPECS[k], spec, el));
  if (!key) return null;
  const [family, frame, branch] = key.split(' ');
  return { family, frame, branch };
}

export const brouckePick = (el: Element | null): Pick | null => (el && isBroucke(el) ? pickOf(el.getAttribute('data-trajectories-select'), el) : null);

function nameOf(attrs: Record<string, string | undefined>, el?: Element): string {
  const builtIn = attrs['data-backdrop'];
  if (builtIn !== undefined) return BUILT_IN[builtIn] ?? builtIn;
  const file = attrs['data-trajectories'] ?? '';
  const spec = attrs['data-trajectories-select'] ?? '';
  if (isFile(file, LOGO_FILE)) return spec.trim() ? NAMES.logoPart : NAMES.logo;
  if (isFile(file, BROUCKE_FILE)) {
    const p = pickOf(spec, el);
    return p ? `Broucke ${p.family} (${[p.frame, p.branch].filter(Boolean).join(', ')})` : `Broucke (${NAMES.custom})`;
  }
  return file.split('/').pop()?.replace(/\.(js|json)$/, '') || 'Backdrop';
}

export const isBroucke = (el: Element | null): boolean => !!el && isFile(el.getAttribute('data-trajectories') ?? '', BROUCKE_FILE);

export function drawingName(el: Element): string {
  return nameOf(Object.fromEntries([...el.attributes].map((a) => [a.name, a.value])), el);
}

export const entryName = (el: Element): string => (isBroucke(el) ? NAMES.broucke : drawingName(el));

export type StartStep = { step: number; label: string; els: Element[] };

export function startSteps(app: App, el: Element | null): StartStep[] {
  const m = el ? modelOf(app, el.closest('section')) : null;
  if (!el || !m) return [];
  const out: StartStep[] = [];
  m.plan.groups.forEach((g, k) => {
    const els = g.filter((i) => !m.locked[i] && !m.els[i].contains(el) && !el.contains(m.els[i])).map((i) => m.els[i]);
    if (!els.length) return;
    out.push({ step: k, label: `Step ${k + 1}`, els });
  });
  return out;
}

export const startStep = (app: App, el: Element | null): StartStep | null => startSteps(app, el).find((o) => o.els.some((e) => e.hasAttribute('data-backdrop-play'))) ?? null;
export const WITH_THE_SLIDE = 'With the Slide';

const round = (v: number) => Number(v.toFixed(8));

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

const fitted = async (el: HTMLElement, box?: Box): Promise<View | null> => (await hooks().fitWindow?.(el, box)) ?? null;

export const spanOf = (o: Live): number => (o as Live & { span?: number }).span ?? 20;

let previewed: Live | null = null;
let unhide: (() => void) | null = null;
function endPreview(): void {
  const o = previewed;
  previewed = null;
  unhide?.();
  if (o?.tracing) o.complete();
}
function hideSelection(app: App, o: Live): void {
  const until = performance.now() + spanOf(o) * 1000 + 100;
  const timer = window.setInterval(() => { if (!o.tracing || performance.now() > until) unhide?.(); }, 50);
  unhide = () => {
    unhide = null;
    clearInterval(timer);
    setPreview(app, 'pane', false);
    app.invalidate();
  };
  setPreview(app, 'pane', true, endPreview);
  app.invalidate();
}

const drawingEdit = (attrs: Record<string, string>): Record<string, string | null> => Object.fromEntries(DRAWING.map((n) => [n, attrs[n] ?? null]));

type Entry = { key: string; name: string; attrs: Record<string, string>; motion: Record<string, string>; view: View | null; size: [number, number] | null; missing?: boolean };

function builtIn(app: App): Entry[] {
  const file = brouckeFiles(app).find((f) => found.get(urlOf(f)) !== false) ?? BROUCKE_FILE;
  return [
    { key: 'logo', name: NAMES.logo, attrs: { 'data-trajectories': LOGO_FILE }, motion: { 'data-duration': '20' }, view: { cx: -0.84, cy: 0, half: 1.128 }, size: [1920, 1080] },
    { key: 'tubes', name: NAMES.tubes, attrs: { 'data-backdrop': 'tubes' }, motion: {}, view: { cx: 0.42, cy: 0, half: 0.6 }, size: [1920, 1080] },
    { key: 'wideRibbon', name: NAMES.wideRibbon, attrs: { 'data-backdrop': 'wideRibbon' }, motion: {}, view: { cx: 0.2, cy: 0, half: 1.3 }, size: [1920, 1080] },
    { key: 'poincare', name: NAMES.poincare, attrs: { 'data-backdrop': 'poincare' }, motion: {}, view: null, size: null },
    { key: 'tori', name: NAMES.tori, attrs: { 'data-backdrop': 'tori' }, motion: {}, view: null, size: null },
    { key: 'saddle', name: NAMES.saddle, attrs: { 'data-backdrop': 'saddle' }, motion: {}, view: null, size: null },
    { key: 'normalForm', name: NAMES.normalForm, attrs: { 'data-backdrop': 'normalForm' }, motion: {}, view: null, size: null },
    {
      key: 'broucke', name: NAMES.broucke, view: null, size: null, motion: { 'data-duration': '3', 'data-stagger': '0.6' },
      attrs: { 'data-trajectories': file, 'data-trajectories-select': SPECS['7 Rotating Periapsis'], 'data-trajectories-color': 'family', 'data-trajectories-ramp': 'e', 'data-trajectories-colormap': 'viridis' },
    },
  ];
}

export const drawnBy = (entry: Entry, el: Element): boolean =>
  entry.key === 'broucke' ? isBroucke(el) : Object.entries(entry.attrs).every(([k, v]) => el.getAttribute(k) === v);

const seenBroucke: string[] = [];
function brouckeFiles(app: App): string[] {
  const now = [...app.slides().querySelectorAll<HTMLElement>('.backdrop')].filter((el) => open(app, el) && isBroucke(el)).map((el) => el.getAttribute('data-trajectories') ?? '');
  for (const f of now) if (!seenBroucke.includes(f)) seenBroucke.push(f);
  return [...new Set([...now, ...seenBroucke])];
}

const found = new Map<string, boolean>();
const urlOf = (path: string) => new URL(path, document.baseURI).href;
const fileOf = (e: Entry) => e.attrs['data-trajectories'];

async function probe(path: string): Promise<boolean> {
  const url = urlOf(path);
  const known = found.get(url);
  if (known !== undefined) return known;
  const preview = hooks().preview;
  if (!preview) return true;
  const el = make('div');
  el.setAttribute('data-trajectories', path);
  const o = preview(el);
  await o.ready;
  const ok = ((o as unknown as { trajectories?: unknown[] }).trajectories?.length ?? 0) > 0;
  o.destroy();
  found.set(url, ok);
  return ok;
}

export async function probeLibrary(app: App): Promise<void> {
  await Promise.all(brouckeFiles(app).map(probe));
  const files = new Set([...builtIn(app), ...deckEntries(app)].map(fileOf).filter((f): f is string => !!f));
  await Promise.all([...files].map(probe));
}

function deckEntries(app: App): Entry[] {
  const out: Entry[] = [];
  const built = builtIn(app);
  const keys = new Set(built.map((e) => JSON.stringify(e.attrs)));
  for (const el of app.slides().querySelectorAll<HTMLElement>('.backdrop')) {
    if (!open(app, el) || isBroucke(el) || dottedDrawing(el)) continue;
    const now = app.doc.tagState(el).attrs;
    const attrs = Object.fromEntries(DRAWING.filter((n) => now[n] !== undefined).map((n) => [n, now[n]]));
    const key = JSON.stringify(attrs);
    if (!Object.keys(attrs).length || keys.has(key)) continue;
    keys.add(key);
    const motion = Object.fromEntries(MOTION.filter((n) => now[n] !== undefined).map((n) => [n, now[n]]));
    const view = now['data-half'] === undefined ? null : { cx: +(now['data-cx'] ?? 0), cy: +(now['data-cy'] ?? 0), half: +now['data-half'] };
    out.push({ key: `deck-${built.length + out.length}`, name: nameOf(attrs), attrs, motion, view, size: [el.offsetWidth, el.offsetHeight] });
  }
  return out;
}

export function library(app: App): Entry[] {
  const mark = (e: Entry) => ({ ...e, missing: (fileOf(e) ? found.get(urlOf(fileOf(e))) : true) === false });
  const deck = deckEntries(app).map(mark);
  const offered = new Set(deck.filter((e) => !e.missing).map((e) => e.name));
  return [...builtIn(app).map(mark).filter((e) => !e.missing || !offered.has(e.name)), ...deck];
}

async function windowFor(entry: Entry, el: HTMLElement): Promise<View | null> {
  if (entry.view && entry.size && Math.abs(entry.size[0] - el.offsetWidth) < 1 && Math.abs(entry.size[1] - el.offsetHeight) < 1) return entry.view;
  return fitted(el);
}

async function replaceDrawing(app: App, el: HTMLElement, entry: Entry): Promise<void> {
  const motion = Object.fromEntries(MOTION.map((n) => [n, entry.motion[n] ?? null]));
  const unset: Record<string, null> = entry.view ? {} : { 'data-cx': null, 'data-cy': null, 'data-half': null };
  app.doc.setTag(el, { attrs: { ...drawingEdit(entry.attrs), ...motion, ...unset } }, 'drawing');
  await dropLabels(app, el, entry);
  const v = entry.view && (await windowFor(entry, el));
  if (v) app.doc.setTag(el, { attrs: windowAttrs(v) }, 'window');
  syncBackdrops();
}

export async function applyEntry(app: App, entry: Entry): Promise<void> {
  const slide = app.current();
  if (!slide || entry.missing) return;
  const old = slideBackdrop(app);
  if (old) {
    await app.history.transact('Replace Backdrop', () => replaceDrawing(app, old, entry));
    app.selection.set('elements', [old]);
    return;
  }
  await app.history.selecting('Add Backdrop', async () => {
    const all = { ...entry.attrs, ...entry.motion, ...(entry.view ? windowAttrs(entry.view) : {}) };
    const attrs = Object.entries(all).map(([k, v]) => ` ${k}="${v.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join('');
    const [el] = await app.doc.insert(`<div class="backdrop"${attrs}></div>`, slide, slide.firstElementChild, 'add backdrop');
    const v = entry.view && (await windowFor(entry, el as HTMLElement));
    if (v) {
      const now = app.doc.tagState(el).attrs;
      const changed = Object.entries(windowAttrs(v)).filter(([k, x]) => now[k] !== x);
      if (changed.length) app.doc.setTag(el, { attrs: Object.fromEntries(changed) }, 'window');
    }
    syncBackdrops();
    app.selection.set('elements', [el]);
  });
}

async function dropLabels(app: App, el: HTMLElement, entry: Entry): Promise<void> {
  if (LABELED.includes(entry.attrs['data-backdrop'] ?? '')) return;
  for (const lab of [...el.querySelectorAll(':scope > .label')].filter((l) => open(app, l))) await app.doc.remove(lab, 'label');
}

let gallery: { el: HTMLElement; tiles: Live[]; close(): void } | null = null;
let asked = 0;

const CSS = `
.beeson-backdrop-gallery { position: fixed; z-index: 60; display: grid; grid-template-columns: repeat(3, 160px); gap: 10px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow: auto; padding: 12px; box-sizing: border-box; border-radius: 12px; background: var(--ed-panel, #fff); box-shadow: 0 0 0 1px var(--ed-line, rgba(0, 0, 0, 0.15)), 0 12px 32px rgba(0, 0, 0, 0.25); color: var(--ed-text, #1d1d1f); font: 13px/1.3 var(--ed-font, system-ui, sans-serif); }
@media (max-width: 560px) { .beeson-backdrop-gallery { grid-template-columns: repeat(2, 1fr); } }
.beeson-backdrop-gallery h5 { grid-column: 1 / -1; margin: 0 0 2px; font: 600 13px/1.3 var(--ed-font, system-ui, sans-serif); }
.beeson-backdrop-gallery button { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 4px; border: 0; border-radius: 8px; background: none; color: inherit; font: inherit; text-align: center; cursor: default; }
.beeson-backdrop-gallery button:hover:enabled, .beeson-backdrop-gallery button:focus-visible { background: var(--ed-hover, rgba(0, 0, 0, 0.06)); outline: none; }
.beeson-backdrop-gallery button:disabled { color: var(--ed-muted, #6e6e73); }
.beeson-backdrop-gallery button:disabled .tile { opacity: 0.4; }
.beeson-backdrop-gallery .tile { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 6px; background: var(--bg); box-shadow: 0 0 0 1px var(--ed-line, rgba(0, 0, 0, 0.15)); }
.beeson-backdrop-gallery .tile canvas { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.beeson-backdrop-gallery .name { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow-wrap: anywhere; }
.beeson-backdrop-gallery .reason { margin-top: -4px; font-size: 11px; }
.beeson-backdrop-cuts { position: fixed; inset: 0; z-index: 50; pointer-events: none; }
html.beeson-masking .beeson-backdrop-cuts { display: none; }
`;

export async function openGallery(app: App, anchor?: Element | null): Promise<void> {
  gallery?.close();
  const ask = ++asked;
  await probeLibrary(app);
  if (ask !== asked) return;
  const el = make('div', 'beeson-backdrop-gallery');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Backdrops');
  el.append(make('h5', '', slideBackdrop(app) ? 'Replace the backdrop' : 'Add a backdrop'));
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
    b.title = entry.missing ? `${fileOf(entry)} is not found next to the deck` : entry.name;
    b.disabled = !!entry.missing;
    const tile = make('div', 'tile');
    for (const [k, v] of Object.entries(entry.attrs)) tile.setAttribute(k, v);
    if (entry.view) for (const [k, v] of Object.entries(windowAttrs(entry.view))) tile.setAttribute(k, v);
    b.append(tile, make('span', 'name', entry.name));
    if (entry.missing) b.append(make('span', 'reason', 'File not found'));
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
  for (const tile of el.querySelectorAll<HTMLElement>('.tile')) {
    const o = hooks().preview?.(tile);
    if (o) tiles.push(o);
  }
  gallery = { el, tiles, close };
  window.addEventListener('pointerdown', outside, true);
  window.addEventListener('keydown', key, true);
  el.querySelector<HTMLButtonElement>('button:enabled')?.focus({ preventScroll: true });
}

const PAUSE = 1000;
let run: { el: HTMLElement; at: number; entry: App['history']['last'] } | null = null;
let queue: Promise<void> = Promise.resolve();

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
      o.setWindow(next.view);
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
      o.setWindow(view);
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
  const pick = (id: 'family' | 'frame' | 'branch', label: string): Command => ({
    id: `backdrop.${id}`,
    label: `Backdrop ${label}`,
    undoable: true,
    undo: label,
    enabled: (app) => isBroucke(targetOf(app, undefined)),
    run: (app, arg) => {
      const el = targetOf(app, arg);
      const v = String(valueOf(arg));
      if (!el || !isBroucke(el)) return;
      const now = brouckePick(el);
      if (now?.[id] === v) return;
      const next = id === 'family' ? { family: v, frame: now?.frame ?? 'Rotating', branch: v === '7' ? 'Periapsis' : undefined } : now && { ...now, [id]: v };
      const spec = next && SPECS[keyOf(next)];
      if (!spec) return;
      endPreview();
      app.doc.setTag(el, { attrs: { 'data-trajectories-select': spec } }, 'drawing');
    },
  });
  const choice = (id: string, label: string, drawing: string, attr: string, values: string[]): Command => ({
    id: `backdrop.${id}`,
    label: `Backdrop ${label}`,
    undoable: true,
    undo: label,
    enabled: (app) => dottedDrawing(targetOf(app, undefined)) === drawing,
    run: (app, arg) => {
      const el = targetOf(app, arg);
      const v = String(valueOf(arg));
      if (!el || dottedDrawing(el) !== drawing || !values.includes(v)) return;
      const text = v === values[0] ? null : v;
      if (el.getAttribute(attr) === text) return;
      endPreview();
      app.doc.setTag(el, { attrs: { [attr]: text } }, 'drawing');
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
        hideSelection(app, o);
      },
    },
    {
      id: 'backdrop.builtIn',
      label: 'Built-In Backdrop',
      undoable: true,
      undo: 'Change Backdrop',
      enabled: (app) => !!targetOf(app, undefined),
      run: async (app, arg) => {
        const el = targetOf(app, arg);
        const v = String(valueOf(arg) ?? '');
        const entry = library(app).find((e) => e.key === v);
        if (!el || !entry || entry.missing || (entry.key === 'broucke' && isBroucke(el)) || dottedDrawing(el) === entry.key) return;
        endPreview();
        const attrs = drawingEdit(entry.attrs);
        const now = app.doc.tagState(el).attrs;
        const changed = Object.entries(attrs).filter(([k, x]) => (now[k] ?? null) !== x);
        if (!changed.length) return;
        if (!labeledDrawing(el) || !LABELED.includes(entry.attrs['data-backdrop'] ?? '')) return replaceDrawing(app, el, entry);
        app.doc.setTag(el, { attrs: Object.fromEntries(changed) }, 'drawing');
      },
    },
    pick('family', 'Family'),
    pick('frame', 'Frame'),
    pick('branch', 'Branch'),
    choice('system', 'System', 'poincare', 'data-system', SYSTEMS),
    choice('plane', 'Plane', 'tori', 'data-plane', PLANES),
    {
      id: 'backdrop.torus',
      label: 'Backdrop Torus',
      undoable: true,
      undo: 'Torus',
      enabled: (app) => dottedDrawing(targetOf(app, undefined)) === 'tori',
      run: (app, arg) => {
        const el = targetOf(app, arg);
        const at = ALPHAS.indexOf(String(valueOf(arg)));
        if (!el || dottedDrawing(el) !== 'tori' || at < 0) return;
        const shown = toriPick(el);
        shown[at] = !shown[at];
        endPreview();
        app.doc.setTag(el, { attrs: { 'data-tori': toriSpec(shown) } }, 'drawing');
      },
    },
    {
      id: 'backdrop.tori',
      label: 'Backdrop All Tori',
      undoable: true,
      undo: 'All Tori',
      enabled: (app) => dottedDrawing(targetOf(app, undefined)) === 'tori',
      run: (app, arg) => {
        const el = targetOf(app, arg);
        if (!el || dottedDrawing(el) !== 'tori') return;
        const all = toriPick(el).every(Boolean);
        endPreview();
        app.doc.setTag(el, { attrs: { 'data-tori': toriSpec(ALPHAS.map(() => !all)) } }, 'drawing');
      },
    },
    {
      id: 'backdrop.colormap',
      label: 'Backdrop Colormap',
      undoable: true,
      undo: 'Colormap',
      enabled: (app) => !!targetOf(app, undefined)?.hasAttribute('data-trajectories'),
      run: (app, arg) => {
        const el = targetOf(app, arg);
        const v = valueOf(arg);
        const value = typeof v === 'string' && COLORMAPS.includes(v) ? v : null;
        if (el && el.getAttribute('data-trajectories-colormap') !== value) app.doc.setTag(el, { attrs: { 'data-trajectories-colormap': value } }, 'drawing');
      },
    },
    {
      id: 'backdrop.label',
      label: 'Backdrop Label',
      undoable: true,
      undo: 'Label',
      enabled: (app) => labeledDrawing(targetOf(app, undefined)),
      run: async (app, arg) => {
        const el = targetOf(app, arg);
        const at = (arg as { at?: string } | undefined)?.at;
        const label = LABELS.find((l) => l.at === at);
        if (!el || !label) return;
        endPreview();
        const lab = [...el.querySelectorAll(':scope > .label')].find((l) => l.getAttribute('data-at') === at && open(app, l));
        if (lab) await app.doc.remove(lab, 'label');
        else {
          const after = LABELS.slice(LABELS.indexOf(label) + 1).map((l) => l.at);
          const before = [...el.querySelectorAll(':scope > .label')].find((l) => after.includes(l.getAttribute('data-at') ?? '')) ?? null;
          await app.doc.insert(`<span class="label" data-at="${label.at}" data-dy="${label.dy}">${label.text}</span>`, el, before, 'label');
        }
      },
    },
    {
      id: 'backdrop.addLabel',
      label: 'Add Label',
      undoable: true,
      undo: 'Add Label',
      enabled: (app) => !!liveOf(targetOf(app, undefined)) && !dottedDrawing(targetOf(app, undefined)) && !locked(targetOf(app, undefined)!),
      run: async (app, arg) => {
        const el = targetOf(app, arg);
        const o = liveOf(el);
        if (!el || !o || dottedDrawing(el)) return;
        endPreview();
        const point = (arg as { x?: number; y?: number } | undefined) ?? {};
        const [x, y] = labelAt(el, o.view, point.x, point.y);
        const [lab] = await app.doc.insert(`<span class="label" data-at="${x} ${y}">Label</span>`, el, null, 'label');
        app.selection.set('text', [lab]);
        selectIn(lab, 0, 'Label'.length);
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
      id: 'backdrop.start',
      label: 'Backdrop Start',
      undoable: true,
      undo: 'Start',
      enabled: (app) => {
        const el = targetOf(app, undefined);
        return !!el && !locked(el) && startSteps(app, el).length > 0;
      },
      run: (app, arg) => {
        const el = targetOf(app, arg);
        const slide = el?.closest('section');
        if (!el || !slide) return;
        const v = valueOf(arg);
        const to = v === null || v === undefined ? null : startSteps(app, el).find((o) => o.step === Number(v));
        if (to === undefined) return;
        endPreview();
        const target = to ? (to.els.find((e) => e.hasAttribute('data-backdrop-play')) ?? to.els[0]) : null;
        for (const c of slide.querySelectorAll('[data-backdrop-play]')) if (c !== target && open(app, c)) app.doc.setTag(c, { attrs: { 'data-backdrop-play': null } }, 'motion');
        if (target && !target.hasAttribute('data-backdrop-play')) app.doc.setTag(target, { attrs: { 'data-backdrop-play': '' } }, 'motion');
      },
    },
    {
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
      label: 'Replace Backdrop…',
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

function watch(app: App): void {
  const pending = new Set<HTMLElement>();
  const boxed = new Set<HTMLElement>();
  const WINDOW = ['data-cx', 'data-cy', 'data-half'];
  let queued = false;
  let moved = false;
  const flush = () => {
    queued = false;
    for (const el of boxed) if (!pending.has(el)) liveOf(el)?.fit();
    boxed.clear();
    if (!pending.size && !moved) return;
    for (const el of pending) if (el.isConnected && liveOf(el)) hooks().remount?.(el);
    pending.clear();
    moved = false;
    syncBackdrops();
    app.invalidate('content');
  };
  new MutationObserver((mutations) => {
    for (const r of mutations) {
      const t = r.target;
      if (!(t instanceof HTMLElement) || !t.matches('.backdrop')) continue;
      const labs = [...r.addedNodes, ...r.removedNodes].some((n) => n instanceof Element && n.matches('.label'));
      if (r.type === 'attributes' && WINDOW.includes(r.attributeName ?? '')) moved = true;
      else if (r.attributeName === 'style') boxed.add(t);
      else if (r.type === 'attributes' || labs) pending.add(t);
    }
    if ((pending.size || boxed.size || moved) && !queued) {
      queued = true;
      queueMicrotask(flush);
    }
  }).observe(app.slides(), { subtree: true, childList: true, attributes: true, attributeFilter: [...DRAWING, ...WINDOW, 'data-dx', 'data-dy', 'style'] });
}

function cuts(app: App): void {
  const layer = make('div', 'beeson-backdrop-cuts');
  document.body.append(layer);
  let marks: HTMLElement[] = [];
  const HANDLE: Record<string, string> = { left: 'w', right: 'e', top: 'n', bottom: 's' };
  const grips = () => {
    const cut = new Set(marks.map((m) => HANDLE[m.dataset.edge ?? '']));
    for (const g of document.querySelectorAll<HTMLElement>('.beeson-overlay .beeson-grip')) g.classList.toggle('cut', cut.has(g.dataset.handle ?? ''));
  };
  const draw = () => {
    const el = selectedBackdrop(app);
    const o = liveOf(el);
    if (!el || !o || editing()) {
      for (const m of marks) m.remove();
      marks = [];
      grips();
      return;
    }
    const v = app.stage?.viewport;
    if (v) layer.style.clipPath = `inset(${v.top}px ${innerWidth - v.right}px ${innerHeight - v.bottom}px ${v.left}px)`;
    marks = markCuts(app, el, o.view, o.extent, layer, marks);
    grips();
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
  app.listen('history', endPreview);
  app.selection.listen(() => {
    if (previewed && !app.selection.has(previewed.el)) endPreview();
  });
  app.listen('slide', () => {
    endPreview();
    gallery?.close();
  });
  window.addEventListener('keydown', (ev) => {
    if (!unhide || ev.key !== 'Escape') return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    endPreview();
  }, true);
  window.addEventListener('pointerdown', (ev) => {
    const t = ev.target;
    if (unhide && !(t instanceof Element && t.closest('.beeson-edit-top, .beeson-edit-menu, .beeson-edit-inspector'))) unhide();
  }, true);
}
