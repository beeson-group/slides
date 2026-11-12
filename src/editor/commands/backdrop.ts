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
import { select, type StrandRecord } from '../../strands.ts';

type View = { cx: number; cy: number; half: number };
type Box = { left: number; top: number; width: number; height: number };
export type Live = { el: HTMLElement; view: View; done: boolean; tracing: boolean; ready: Promise<void>; records?: StrandRecord[] | null; fit(): void; reset(): void; start(): void; complete(): void; destroy(): void };
type Hooks = { backdrops?: Live[]; remount?(el: HTMLElement): Live; preview?(el: HTMLElement): Live; fitWindow?(el: HTMLElement, box?: Box): Promise<View | null> };
const hooks = (): Hooks => (window as unknown as { Beeson?: Hooks }).Beeson ?? {};

// the attributes that say what is drawn, which a change of drawing replaces, apart from the window
// and the motion
export const DRAWING = ['data-scene', 'data-strands', 'data-strands-select', 'data-strands-color', 'data-strands-ramp', 'data-strands-colormap', 'data-strands-shade', 'data-heads'];
// the names of the drawings in the list of Media > Backdrop… and wherever a drawing is named, for the
// owner to confirm. a drawing of a file is named by its file, and a drawing of demo/broucke-sample.js
// by the numbers of the Broucke families it selects, which are chosen in the entry Broucke Families
export const NAMES = {
  nest: 'Lyapunov Families',
  tubes: 'Cislunar Manifolds',
  wideRibbon: 'Earth Manifolds',
  logo: 'Beeson Logo',
  logoPart: 'Part of the Beeson Logo',
  broucke: 'Broucke Families',
  family: (numbers: string[]) => `${numbers.length === 1 ? 'Family' : 'Families'} ${numbers.length > 1 ? `${numbers.slice(0, -1).join(', ')} and ${numbers.at(-1)}` : numbers[0]}`,
  inertial: 'Inertial',
  both: 'Both Frames',
  none: 'No Records',
};
export const SCENES: Record<string, string> = { nest: NAMES.nest, tubes: NAMES.tubes, wideRibbon: NAMES.wideRibbon };
// the files of the template that the list draws from, and the families of demo/broucke-sample.js
const LOGO_FILE = 'brand/transfer.js';
const BROUCKE_FILE = 'demo/broucke-sample.js';
const BROUCKE_FAMILIES = ['7', '11'];
const FRAMES = ['pulsating', 'inertial'];
// the attributes of the motion of a drawing in the demo deck, which an entry of the list writes
const MOTION = ['data-duration', 'data-stagger'];
// the labels of a named scene, with the text and the offsets of the demo deck
export const LABELS = [
  { at: 'L1', name: 'L1', text: '\\(\\LL{1}\\)', dy: '-34' },
  { at: 'L2', name: 'L2', text: '\\(\\LL{2}\\)', dy: '-34' },
  { at: 'moon', name: 'Moon', text: 'Moon', dy: '36' },
  { at: 'earth', name: 'Earth', text: 'Earth', dy: '36' },
];
export const COLORMAPS = ['viridis', 'plasma', 'Blues_r'];
const COLORMAP_NAMES: Record<string, string> = { viridis: 'Viridis', plasma: 'Plasma', Blues_r: 'Blues (Reversed)' };
// the name of a value of data-strands-colormap, or Palette for none. a value that is not a name of
// COLORMAPS alone is shown as it is written
export const colormapName = (value: string | null): string => (value === null ? 'Palette' : COLORMAP_NAMES[value] ?? value);
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

const isFile = (path: string, file: string) => path === file || path.endsWith(`/${file}`);

// a term of data-strands-select, as the theme reads it in src/strands.ts
const TERM = /^\s*([^=<>\s]+)\s*(<=|>=|=|<|>)\s*(.*?)\s*$/;
const OPS: Record<string, string> = { '=': '', '<': 'Below', '<=': 'at Most', '>': 'Above', '>=': 'at Least' };
const title = (w: string) => (w.length > 1 ? w[0].toUpperCase() + w.slice(1) : w);
const valuesOf = (v: string) => [...new Set(v.split('|').map((s) => s.trim()))].sort();

// the groups of spec, a value of data-strands-select, each as the pairs of a family and a frame of
// demo/broucke-sample.js that it selects and its other terms sorted. groups with the same other terms
// are merged, and a group without a pair is left out, thus two values that draw the same records by
// family and frame have the same groups
function groupsOf(spec: string | null): { pairs: string[]; rest: string[] }[] {
  const merged = new Map<string, Set<string>>();
  for (const group of spec?.trim() ? spec.split(';') : ['']) {
    let fams = BROUCKE_FAMILIES, frames = FRAMES;
    const rest = new Set<string>();
    for (const t of group.split(',').filter((t) => t.trim())) {
      const m = TERM.exec(t);
      if (m && m[2] === '=' && m[1] === 'family') fams = fams.filter((f) => valuesOf(m[3]).includes(f));
      else if (m && m[2] === '=' && m[1] === 'frame') frames = frames.filter((f) => valuesOf(m[3]).includes(f));
      else rest.add(m ? `${m[1]}${m[2]}${m[2] === '=' ? valuesOf(m[3]).join('|') : m[3]}` : t.trim());
    }
    const key = [...rest].sort().join(',');
    const pairs = merged.get(key) ?? new Set<string>();
    for (const f of fams) for (const fr of frames) pairs.add(`${f} ${fr}`);
    merged.set(key, pairs);
  }
  return [...merged].filter(([, p]) => p.size).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([key, p]) => ({ pairs: [...p].sort(), rest: key ? key.split(',') : [] }));
}

// a term of data-strands-select in words, e.g. Thin 1 for thin=1
function termWords(term: string): string {
  const m = TERM.exec(term);
  if (!m) return term;
  return [title(m[1]), OPS[m[2]], m[2] === '=' ? m[3].split('|').map(title).join(' or ') : m[3]].filter(Boolean).join(' ');
}

// the name of the Broucke families that spec, a value of data-strands-select, selects, in the Family
// popup of the Backdrop pane: the families of each set of frames, followed by the frames and the
// other terms in words, e.g. Family 7 and Family 11 (Inertial). two values get one name only when
// sameSelection holds for them
export function familyName(spec: string | null): string {
  const groups = groupsOf(spec).map(({ pairs, rest }) => {
    const parts = new Map<string, string[]>();
    for (const f of BROUCKE_FAMILIES) {
      const frames = FRAMES.filter((fr) => pairs.includes(`${f} ${fr}`)).join('|');
      if (frames) parts.set(frames, [...(parts.get(frames) ?? []), f]);
    }
    return [...parts].map(([frames, numbers]) => {
      const words = [frames === 'inertial' ? NAMES.inertial : frames === 'pulsating' ? '' : NAMES.both, ...rest.map(termWords)].filter(Boolean);
      return `${NAMES.family(numbers)}${words.length ? ` (${words.join(', ')})` : ''}`;
    }).join(' and ');
  });
  return groups.join(' or ') || NAMES.none;
}

// the records of the file of the Broucke drawing el as the theme read them, or null before the file
// is loaded or when it is missing. they are kept by the URL of the file for a backdrop drawn again
const recordsByFile = new Map<string, StrandRecord[]>();
function recordsOf(el: Element | null | undefined): StrandRecord[] | null {
  if (!el || !isBroucke(el)) return null;
  const url = urlOf(el.getAttribute('data-strands') ?? '');
  const live = liveOf(el)?.records;
  if (live) recordsByFile.set(url, live);
  return recordsByFile.get(url) ?? null;
}

// the records of records that spec draws, none for a value that the theme does not draw
function drawn(records: StrandRecord[], spec: string | null): Set<StrandRecord> {
  try {
    return new Set(select(records, spec ?? undefined));
  } catch {
    return new Set();
  }
}
const sameSet = <T>(a: Set<T>, b: Set<T>) => a.size === b.size && [...a].every((x) => b.has(x));

// true when the values a and b of data-strands-select draw the same records of the file of el, or
// without its records, the same records of demo/broucke-sample.js by family and frame with the same
// other terms
export function sameSelection(a: string | null, b: string | null, el?: Element | null): boolean {
  const records = recordsOf(el);
  return records ? sameSet(drawn(records, a), drawn(records, b)) : JSON.stringify(groupsOf(a)) === JSON.stringify(groupsOf(b));
}

// the name of spec, a value of data-strands-select, for the backdrop el: No Records when it draws no
// record of the file of el, and the name of the families and frames of the records it draws when it
// draws every record of these, whatever its terms. thus two values that draw the same records get one
// name, and two that draw others never do
export function selectionName(spec: string | null, el?: Element | null): string {
  const records = recordsOf(el);
  if (!records) return familyName(spec);
  const chosen = drawn(records, spec);
  if (!chosen.size) return NAMES.none;
  const pairs = [...new Set([...chosen].map((r) => `family=${String(r.family)},frame=${String(r.frame)}`))];
  const whole = pairs.join(';');
  const known = groupsOf(whole)[0]?.pairs.length === pairs.length;
  return known && sameSet(drawn(records, whole), chosen) ? familyName(whole) : familyName(spec);
}

// the name of a drawing of the attributes attrs: the name of its scene, of the logo, or of the
// Broucke families it selects, or else the name of its file
function nameOf(attrs: Record<string, string | undefined>, el?: Element): string {
  const scene = attrs['data-scene'];
  if (scene !== undefined) return SCENES[scene] ?? scene;
  const file = attrs['data-strands'] ?? '';
  const spec = attrs['data-strands-select'] ?? '';
  if (isFile(file, LOGO_FILE)) return spec.trim() ? NAMES.logoPart : NAMES.logo;
  if (isFile(file, BROUCKE_FILE)) return `Broucke ${selectionName(spec, el)}`;
  return file.split('/').pop()?.replace(/\.(js|json)$/, '') || 'Backdrop';
}

// true when el draws demo/broucke-sample.js, i.e. is a backdrop of the entry Broucke Families
export const isBroucke = (el: Element | null): boolean => !!el && isFile(el.getAttribute('data-strands') ?? '', BROUCKE_FILE);

// the name of the drawing of el
export function drawingName(el: Element): string {
  return nameOf(Object.fromEntries([...el.attributes].map((a) => [a.name, a.value])), el);
}

// the name of the entry of el in the Drawing popup, which is Broucke Families for any family
export const entryName = (el: Element): string => (isBroucke(el) ? NAMES.broucke : drawingName(el));

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

// an entry of the gallery: the drawing attributes, the motion, the window and the size of the box
// it was written for, or a null window for a drawing fitted to its box, and a name. missing is true
// for a drawing of the deck whose file is not found
type Entry = { key: string; name: string; attrs: Record<string, string>; motion: Record<string, string>; view: View | null; size: [number, number] | null; missing?: boolean };

// the families of demo/broucke-sample.js in both of its frames, as values of data-strands-select
const FAMILY_SPECS = BROUCKE_FAMILIES.flatMap((n) => [`frame=pulsating,family=${n}`, `frame=inertial,family=${n}`]);
// the fixed choices of the Family popup: each family in each frame, then all the families of each
// frame, written as the backdrop of the demo deck writes them
const FIXED_SPECS = [...FAMILY_SPECS, ...FRAMES.map((fr) => `frame=${fr}`)];

// the drawings of the demo deck, with their windows and the size of their boxes, and the entry
// Broucke Families, which draws the first family with the colors and the motion of the backdrop of
// the demo deck, fitted to its box as it is. its file is the one of the first Broucke drawing of the
// deck whose file is found, if any, so that a deck in another folder finds it
function builtIn(app: App): Entry[] {
  const file = brouckeFiles(app).find((f) => found.get(urlOf(f)) !== false) ?? BROUCKE_FILE;
  return [
    { key: 'logo', name: NAMES.logo, attrs: { 'data-strands': LOGO_FILE }, motion: { 'data-duration': '20' }, view: { cx: -0.84, cy: 0, half: 1.128 }, size: [1920, 1080] },
    { key: 'nest', name: NAMES.nest, attrs: { 'data-scene': 'nest' }, motion: {}, view: { cx: 0.97, cy: 0, half: 0.5 }, size: [720, 1080] },
    { key: 'tubes', name: NAMES.tubes, attrs: { 'data-scene': 'tubes' }, motion: {}, view: { cx: 0.42, cy: 0, half: 0.6 }, size: [1920, 1080] },
    { key: 'wideRibbon', name: NAMES.wideRibbon, attrs: { 'data-scene': 'wideRibbon' }, motion: {}, view: { cx: 0.2, cy: 0, half: 1.3 }, size: [1920, 1080] },
    {
      key: 'broucke', name: NAMES.broucke, view: null, size: null, motion: { 'data-duration': '3', 'data-stagger': '0.6' },
      attrs: { 'data-strands': file, 'data-strands-select': FAMILY_SPECS[0], 'data-strands-color': 'family', 'data-strands-ramp': 'e', 'data-strands-colormap': 'viridis' },
    },
  ];
}

// true when the backdrop el is drawn by entry, which for Broucke Families is any of its families
export const drawnBy = (entry: Entry, el: Element): boolean =>
  entry.key === 'broucke' ? isBroucke(el) : Object.entries(entry.attrs).every(([k, v]) => el.getAttribute(k) === v);

// the choices of the Family popup of el, as values of data-strands-select with their names: the
// fixed choices, which are listed whatever the deck draws, then each other selection of the file in
// the deck, once per drawing. a choice is the value whose own terms give its name, e.g. frame=pulsating before begin=ray
export function families(app: App, el: Element): { spec: string | null; name: string }[] {
  const out: { spec: string | null; name: string }[] = [];
  const add = (spec: string | null) => {
    const name = selectionName(spec, el);
    const same = out.find((f) => sameSelection(f.spec, spec, el));
    if (!same) out.push({ spec, name });
    else if (familyName(same.spec) !== same.name && familyName(spec) === same.name) same.spec = spec;
  };
  FIXED_SPECS.forEach(add);
  for (const b of app.slides().querySelectorAll<HTMLElement>('.backdrop')) {
    if (open(app, b) && isBroucke(b)) add(app.doc.tagState(b).attrs['data-strands-select'] ?? null);
  }
  if (isBroucke(el)) add(el.getAttribute('data-strands-select'));
  return out;
}

// the files of the Broucke drawings of the deck, in the order of the deck, then each file of one that
// an earlier call saw, so that the entry Broucke Families keeps its file once no drawing has it
const seenBroucke: string[] = [];
function brouckeFiles(app: App): string[] {
  const now = [...app.slides().querySelectorAll<HTMLElement>('.backdrop')].filter((el) => open(app, el) && isBroucke(el)).map((el) => el.getAttribute('data-strands') ?? '');
  for (const f of now) if (!seenBroucke.includes(f)) seenBroucke.push(f);
  return [...new Set([...now, ...seenBroucke])];
}

// whether the file of strands at an absolute URL is found and has records, as the theme read it
const found = new Map<string, boolean>();
const urlOf = (path: string) => new URL(path, document.baseURI).href;
const fileOf = (e: Entry) => e.attrs['data-strands'];

// true when the file of strands at path is found next to the deck. the file is read by the theme as
// it reads the file of a backdrop, i.e. by a script element, and nothing is fetched by the editor
async function probe(path: string): Promise<boolean> {
  const url = urlOf(path);
  const known = found.get(url);
  if (known !== undefined) return known;
  const preview = hooks().preview;
  if (!preview) return true;
  const el = make('div');
  el.setAttribute('data-strands', path);
  const o = preview(el);
  await o.ready;
  const ok = ((o as unknown as { strands?: unknown[] }).strands?.length ?? 0) > 0;
  o.destroy();
  found.set(url, ok);
  return ok;
}

// the files of the entries of the library read, so that library() knows which are found
export async function probeLibrary(app: App): Promise<void> {
  // the file of Broucke Families is the first of these that is found
  await Promise.all(brouckeFiles(app).map(probe));
  const files = new Set([...builtIn(app), ...deckEntries(app)].map(fileOf).filter((f): f is string => !!f));
  await Promise.all([...files].map(probe));
}

// each drawing of the deck that is not an entry of builtIn, keyed by its drawing attributes. a
// drawing of the Broucke families is one of the entry Broucke Families
function deckEntries(app: App): Entry[] {
  const out: Entry[] = [];
  const built = builtIn(app);
  const keys = new Set(built.map((e) => JSON.stringify(e.attrs)));
  for (const el of app.slides().querySelectorAll<HTMLElement>('.backdrop')) {
    if (!open(app, el) || isBroucke(el)) continue;
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

// the entries of builtIn whose file is found next to the deck, then each other drawing of the deck,
// marked missing when its file is not found. a file not read yet counts as found
export function library(app: App): Entry[] {
  const state = (e: Entry) => (fileOf(e) ? found.get(urlOf(fileOf(e))) : true);
  return [...builtIn(app).filter((e) => state(e) !== false), ...deckEntries(app).map((e) => ({ ...e, missing: state(e) === false }))];
}

// the window of an entry kept on the box of el when the box has the size of the box of the entry,
// and else fitted to the box of el
async function windowFor(entry: Entry, el: HTMLElement): Promise<View | null> {
  if (entry.view && entry.size && Math.abs(entry.size[0] - el.offsetWidth) < 1 && Math.abs(entry.size[1] - el.offsetHeight) < 1) return entry.view;
  return fitted(el);
}

// the drawing, the motion, and the window of entry put on the backdrop el, with the labels of a named
// scene taken off for a drawing of a file. an entry without a window leaves the drawing fitted to its
// box by the theme
async function replaceDrawing(app: App, el: HTMLElement, entry: Entry): Promise<void> {
  const motion = Object.fromEntries(MOTION.map((n) => [n, entry.motion[n] ?? null]));
  const unset: Record<string, null> = entry.view ? {} : { 'data-cx': null, 'data-cy': null, 'data-half': null };
  app.doc.setTag(el, { attrs: { ...drawingEdit(entry.attrs), ...motion, ...unset } }, 'drawing');
  await dropLabels(app, el, entry);
  const v = entry.view && (await windowFor(entry, el));
  if (v) app.doc.setTag(el, { attrs: windowAttrs(v) }, 'window');
  syncBackdrops();
}

// the drawing of entry put on the current slide: in place of the drawing and the motion of the
// backdrop of the slide, or as a new backdrop at the ground of the slide, as one entry of the
// history. an entry without a window leaves the drawing fitted to its box by the theme
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

// the labels of the points of a named scene taken off el when entry is drawn from a file, since the
// theme would draw them at the points of the Earth and the Moon over the drawing of the file
async function dropLabels(app: App, el: HTMLElement, entry: Entry): Promise<void> {
  if (entry.attrs['data-scene'] !== undefined) return;
  for (const lab of [...el.querySelectorAll(':scope > .lab')].filter((l) => open(app, l))) await app.doc.remove(lab, 'label');
}

// the gallery of Media > Backdrop…, a popover of a tile per entry of the library, drawn by the
// theme. a click on a tile applies its entry, and Escape or a press outside closes it
let gallery: { el: HTMLElement; tiles: Live[]; close(): void } | null = null;
// the last gallery asked for, which is opened once the files of the library are read
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
.beeson-backdrop-cuts { position: fixed; inset: 0; z-index: 51; pointer-events: none; }
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
  // the tiles are drawn once the popover is laid out, in the mode of the deck
  for (const tile of el.querySelectorAll<HTMLElement>('.tile')) {
    const o = hooks().preview?.(tile);
    if (o) tiles.push(o);
  }
  gallery = { el, tiles, close };
  window.addEventListener('pointerdown', outside, true);
  window.addEventListener('keydown', key, true);
  el.querySelector<HTMLButtonElement>('button:enabled')?.focus({ preventScroll: true });
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
      // arg { value, el }: a named scene, or the key of an entry of the library. between two named
      // scenes, which are drawn in one frame, the window, the labels, and the motion are kept. a
      // drawing of a file is drawn in a frame of its own, hence where the old or the new drawing is
      // drawn from a file, the window and the motion of the entry are written as its tile in the
      // gallery writes them. Broucke Families on a backdrop of a family keeps its family
      id: 'backdrop.scene',
      label: 'Backdrop Drawing',
      undoable: true,
      undo: 'Change Drawing',
      enabled: (app) => !!targetOf(app, undefined),
      run: async (app, arg) => {
        const el = targetOf(app, arg);
        const v = String(valueOf(arg) ?? '');
        const entry = library(app).find((e) => e.key === v);
        if (!el || !entry || entry.missing || (entry.key === 'broucke' && isBroucke(el))) return;
        endPreview();
        const attrs = drawingEdit(entry.attrs);
        const now = app.doc.tagState(el).attrs;
        const changed = Object.entries(attrs).filter(([k, x]) => (now[k] ?? null) !== x);
        if (!changed.length) return;
        if (now['data-scene'] === undefined || entry.attrs['data-scene'] === undefined) return replaceDrawing(app, el, entry);
        app.doc.setTag(el, { attrs: Object.fromEntries(changed) }, 'drawing');
      },
    },
    {
      // arg { value, el }: a value of data-strands-select of the Family popup, or null for every
      // record of the file
      id: 'backdrop.family',
      label: 'Backdrop Family',
      undoable: true,
      undo: 'Family',
      enabled: (app) => isBroucke(targetOf(app, undefined)),
      run: (app, arg) => {
        const el = targetOf(app, arg);
        const v = valueOf(arg);
        const value = typeof v === 'string' ? v : null;
        if (!el || !isBroucke(el) || !families(app, el).some((f) => f.spec === value)) return;
        endPreview();
        if (!sameSelection(el.getAttribute('data-strands-select'), value, el)) app.doc.setTag(el, { attrs: { 'data-strands-select': value } }, 'drawing');
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
// its labels, and fitted to its box after a change of its style, e.g. by Reset Slide, also at an undo
function watch(app: App): void {
  const pending = new Set<HTMLElement>();
  const boxed = new Set<HTMLElement>();
  const WINDOW = ['data-cx', 'data-cy', 'data-half'];
  let queued = false;
  let moved = false;
  const flush = () => {
    queued = false;
    // a box alone, e.g. during a drag of a grip, keeps the window that is drawn
    for (const el of boxed) if (!pending.has(el)) liveOf(el)?.fit();
    boxed.clear();
    if (!pending.size && !moved) return;
    for (const el of pending) if (el.isConnected && liveOf(el)) hooks().remount?.(el);
    pending.clear();
    moved = false;
    syncBackdrops();
    app.invalidate('content');
  };
  new MutationObserver((records) => {
    for (const r of records) {
      const t = r.target;
      if (!(t instanceof HTMLElement) || !t.matches('.backdrop')) continue;
      const labs = [...r.addedNodes, ...r.removedNodes].some((n) => n instanceof Element && n.matches('.lab'));
      // a window alone, e.g. of an undo or of a file opened again, is set without a new drawing
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
  app.selection.listen(() => {
    if (previewed && !app.selection.has(previewed.el)) endPreview();
  });
  app.listen('slide', () => {
    endPreview();
    gallery?.close();
  });
}
