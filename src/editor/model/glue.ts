// connection lines, as the connectors of PowerPoint: each end of a line of commands/line.ts may be
// glued to an element of its slide, and it then follows every change of the box of the element.
// the element gets a name in data-anchor, unique on its slide, and the svg of the line names it in
// data-from for its start and data-to for its end, with the place of the end in the box of the
// element as two fractions from 0 to 1, e.g. data-to="a1 0 0.5" for the middle of the left edge.
// a group takes glue as one object, with its name on each member, hence data-anchor is a list of
// names as data-group is. the theme does not read these attributes. a name is written with the first end glued to its
// element and taken off with the last. a glued end is put at its place again at the end of each
// transaction of the history, and by record() of canvas/drag.ts for a change outside one, in the
// same entry as the change of the element

import type { App } from '../app.ts';
import { mergeEdit, type TagEdit, type Translate } from '../tags.ts';
import { injectStyle } from '../ui/dom.ts';
import { frameOf, LINE, movablesOf, pictureTurn, strokeOf, toScreen, toSlide, turnable, unturnedRect, type Frame } from '../canvas/hit.ts';
import { parseStroke, rebend, strokeText, type Box, type Point, type Stroke } from '../canvas/stroke.ts';
import { angleOf } from '../canvas/drag.ts';
import { groupFrame } from '../canvas/frames.ts';
import { groupOf } from './groups.ts';

export type End = 'from' | 'to';
// the elements of an object, i.e. an element or the members of a group, and the place of an end in
// its box
export type Glue = { els: Element[]; fx: number; fy: number };

// an end is put at the middle of an edge of the box within this distance of it, in slide px
export const REACH = 16;
// the elements that take glue, and the texts that take it once moved as a box
const TAKES = 'img, video, figure, .zone, .qr, .shape, table, div.math, tycho-viewer';
const TEXTS = 'h1, h2, h3, p, ul, ol, dl, pre, blockquote, .caption';
const MIDDLES: [number, number][] = [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]];

const STYLE = `
.beeson-glue-target { position: fixed; z-index: 52; pointer-events: none; box-sizing: border-box; border: 2px solid var(--ed-select, #7048e8); border-radius: 2px; }
.beeson-glue-target[hidden] { display: none; }
.beeson-glue-target i { position: absolute; width: 7px; height: 7px; margin: -4.5px 0 0 -4.5px; border-radius: 50%; background: var(--ed-select, #7048e8); border: 1px solid #fff; }
`;

const attrOf = (end: End) => (end === 'from' ? 'data-from' : 'data-to');
const namesOf = (el: Element): string[] => el.getAttribute('data-anchor')?.split(/\s+/).filter(Boolean) ?? [];
const withName = (name: string) => `[data-anchor~="${CSS.escape(name)}"]`;
const shown = (els: Element[]) => {
  const seen = els.filter((el) => el.getClientRects().length);
  return seen.length ? seen : els;
};
const num = (v: number) => String(Math.round(v * 1000) / 1000);

// the name and the place of the glue of an end, or null
export function parseEnd(v: string | null): { name: string; fx: number; fy: number } | null {
  const m = /^\s*(\S+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*$/.exec(v ?? '');
  return m ? { name: m[1], fx: parseFloat(m[2]), fy: parseFloat(m[3]) } : null;
}

const slideOf = (el: Element): Element | null => el.closest('.reveal .slides section');
const translateOf = (el: Element): Translate | null => {
  const [x, y] = ((el as HTMLElement).style?.translate ?? '').split(/\s+/).map((v) => parseFloat(v));
  return Number.isFinite(x) && (x || y) ? { x, y: y || 0 } : null;
};

// the elements named name on slide that are shown, e.g. without the twin of an image in the other
// mode, or all of them when none is shown
export const anchorsOf = (slide: Element | null, name: string): Element[] => shown([...(slide?.querySelectorAll(withName(name)) ?? [])]);

// whether el takes glue: a shape, a picture or a figure, a table, a formula, a QR code, a video, and
// a text moved as a box, and not a backdrop, a plate, the chrome, or a line
export function takesGlue(el: Element): boolean {
  if (el.matches(`${LINE}, .backdrop, .plate, .foot`)) return false;
  return el.matches(TAKES) || (el.matches(TEXTS) && !!translateOf(el));
}

// the box of els in slide px before its turn, and the angle it is turned by: of an element, or the
// frame of a group, turned by the angle of its first member as align.ts frames it
function boxOf(f: Frame, els: Element[]): { box: Box; deg: number } {
  const top = shown(els).filter((el) => !els.some((o) => o !== el && o.contains(el)));
  if (top.length === 1) return { box: toSlide(f, unturnedRect(top[0]).box), deg: pictureTurn(top[0]) };
  const deg = top.every(turnable) ? angleOf(top[0]) : 0;
  return { box: toSlide(f, groupFrame(top, deg)), deg };
}

const turn = (box: Box, deg: number, p: Point, back = false): Point => {
  if (!deg) return p;
  const a = ((back ? -deg : deg) * Math.PI) / 180;
  const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
  return { x: cx + (p.x - cx) * Math.cos(a) - (p.y - cy) * Math.sin(a), y: cy + (p.x - cx) * Math.sin(a) + (p.y - cy) * Math.cos(a) };
};

// the point of the place fx, fy in the box of els, in slide px
export function placeIn(app: App, els: Element[], fx: number, fy: number): Point {
  const { box, deg } = boxOf(frameOf(app), els);
  return turn(box, deg, { x: box.left + fx * box.width, y: box.top + fy * box.height });
}

// the objects of the current slide that take glue outside skip, the topmost first: an element, or
// the members of a group as one object unless the group holds an element of skip
function objectsOf(app: App, skip: Element[]): Element[][] {
  const near = (a: Element, b: Element) => a === b || a.contains(b) || b.contains(a);
  const out: Element[][] = [];
  const seen = new Set<string>();
  for (const el of movablesOf(app).filter((el) => takesGlue(el) && !skip.some((s) => near(s, el))).reverse()) {
    const id = groupOf(el);
    const members = id ? [...(app.current()?.querySelectorAll(`[data-group~="${CSS.escape(id)}"]`) ?? [])] : [];
    if (id && seen.has(id)) continue;
    if (id && members.length > 1 && !members.some((m) => skip.some((s) => near(s, m)))) {
      seen.add(id);
      out.push(members);
    } else out.push([el]);
  }
  return out;
}

// the glue of an end at p in slide px: the topmost object of the current slide that takes glue under
// p, or else the object with the nearest middle of an edge within REACH, outside skip, with p at the
// middle of its nearest edge within REACH, or at p. at is the point that the end is put at
export function glueAt(app: App, p: Point, skip: Element[] = []): { glue: Glue; at: Point } | null {
  const f = frameOf(app);
  let best: { els: Element[]; box: Box; deg: number; q: Point; near: { fx: number; fy: number; d: number } } | null = null;
  for (const els of objectsOf(app, skip)) {
    const { box, deg } = boxOf(f, els);
    if (box.width <= 0 || box.height <= 0) continue;
    const q = turn(box, deg, p, true);
    const mids = MIDDLES.map(([fx, fy]) => ({ fx, fy, d: Math.hypot(box.left + fx * box.width - q.x, box.top + fy * box.height - q.y) }));
    const near = mids.reduce((a, b) => (b.d < a.d ? b : a));
    const inside = q.x >= box.left - 1 && q.x <= box.left + box.width + 1 && q.y >= box.top - 1 && q.y <= box.top + box.height + 1;
    if (inside) {
      best = { els, box, deg, q, near };
      break;
    }
    if (near.d <= REACH && (!best || near.d < best.near.d)) best = { els, box, deg, q, near };
  }
  if (!best) return null;
  const { els, box, deg, q, near } = best;
  const fx = near.d <= REACH ? near.fx : Math.min(1, Math.max(0, (q.x - box.left) / box.width));
  const fy = near.d <= REACH ? near.fy : Math.min(1, Math.max(0, (q.y - box.top) / box.height));
  const g = { els, fx: Number(num(fx)), fy: Number(num(fy)) };
  return { glue: g, at: turn(box, deg, { x: box.left + g.fx * box.width, y: box.top + g.fy * box.height }) };
}

// the outline of the element that an end dragged over it is glued to, with the middles of its edges
let outline: HTMLElement | null = null;
export function showTarget(app: App, els: Element[] | null): void {
  if (!outline) {
    injectStyle('glue', STYLE);
    outline = document.createElement('div');
    outline.className = 'beeson-glue-target';
    outline.innerHTML = '<i></i><i></i><i></i><i></i>';
    document.body.append(outline);
  }
  outline.hidden = !els;
  if (!els) return;
  const f = frameOf(app);
  const { box, deg } = boxOf(f, els);
  const s = toScreen(f, box);
  Object.assign(outline.style, { left: `${s.left}px`, top: `${s.top}px`, width: `${s.width}px`, height: `${s.height}px`, rotate: deg ? `${deg}deg` : '' });
  [...outline.children].forEach((dot, i) => Object.assign((dot as HTMLElement).style, { left: `${MIDDLES[i][0] * 100}%`, top: `${MIDDLES[i][1] * 100}%` }));
}

// a writer of attributes and of the translate of a start tag: app.doc.setTag inside a transaction,
// or a Patch
export type Writer = (el: Element, attrs: Record<string, string | null>, translate?: Translate | null) => void;

export const recorded = (app: App): Writer => (el, attrs, translate) => app.doc.setTag(el, { attrs, ...(translate !== undefined ? { translate } : {}) }, 'glue');

// the edit written on the page and into the tag edits without an entry of the history, as
// writePlace of canvas/drag.ts writes a place
function put(app: App, el: Element, edit: TagEdit): void {
  app.tagEdits.set(el, mergeEdit(app.tagEdits.get(el), edit));
  for (const [k, v] of Object.entries(edit.attrs ?? {})) {
    if (v === null) el.removeAttribute(k);
    else el.setAttribute(k, v);
  }
  if (edit.translate !== undefined) (el as HTMLElement).style.translate = edit.translate ? `${edit.translate.x}px ${edit.translate.y}px` : '';
  app.markDirty();
}

// writes made outside the history, kept with the values that they replaced, for the entry of the
// change that made them. the values after them are read at the undo, since later writes of the
// same run are added to it, e.g. the nudges of arrange.ts less than a second apart
export class Patch {
  private readonly before = new Map<Element, TagEdit>();
  private after = new Map<Element, TagEdit>();
  private readonly app: App;
  constructor(app: App) {
    this.app = app;
  }
  get empty(): boolean {
    return !this.before.size;
  }
  readonly write: Writer = (el, attrs, translate) => {
    if (!this.app.pairing?.elements.get(el) && !this.app.pairing?.inner.get(el)) return;
    const was = this.before.get(el) ?? { attrs: {} };
    for (const k of Object.keys(attrs)) if (!(k in was.attrs!)) was.attrs![k] = el.getAttribute(k);
    if (translate !== undefined && was.translate === undefined) was.translate = translateOf(el);
    this.before.set(el, was);
    put(this.app, el, { attrs, ...(translate !== undefined ? { translate } : {}) });
  };
  undo(): void {
    this.after = new Map([...this.before].map(([el, b]) => [el, { attrs: Object.fromEntries(Object.keys(b.attrs ?? {}).map((k) => [k, el.getAttribute(k)])), ...(b.translate !== undefined ? { translate: translateOf(el) } : {}) }]));
    for (const [el, b] of [...this.before].reverse()) put(this.app, el, b);
  }
  redo(): void {
    for (const [el, a] of this.after) put(this.app, el, a);
  }
}

// the stroke of the line svg in slide px, or null for a path that the editor does not write
const strokeAt = (svg: Element): Stroke | null => parseStroke(strokeOf(svg), translateOf(svg) ?? { x: 0, y: 0 });

export function writeStroke(write: Writer, svg: Element, s: Stroke): void {
  const t = strokeText(s);
  const b = t.box;
  write(svg, { width: String(b.width), height: String(b.height) }, b.left || b.top ? { x: b.left, y: b.top } : null);
  const child = strokeOf(svg);
  if (child) write(child, t.attrs);
}

const glued = (slide: Element | null): Element[] => [...(slide?.querySelectorAll(`${LINE}[data-from], ${LINE}[data-to]`) ?? [])];

// whether a line of slide names name
const named = (slide: Element | null, name: string): boolean =>
  glued(slide).some((svg) => (['from', 'to'] as End[]).some((e) => parseEnd(svg.getAttribute(attrOf(e)))?.name === name));

// the name of the object els, i.e. a name that only these elements have, or a new one unique on its
// slide added to each, e.g. a1
export function nameOf(write: Writer, els: Element[]): string {
  const slide = slideOf(els[0]);
  const own = namesOf(els[0]).find((n) => els.every((el) => namesOf(el).includes(n)) && [...(slide?.querySelectorAll(withName(n)) ?? [])].every((a) => els.includes(a)));
  if (own) return own;
  const taken = new Set([...(slide?.querySelectorAll('[data-anchor]') ?? [])].flatMap(namesOf));
  let i = 1;
  while (taken.has(`a${i}`)) i++;
  for (const el of els) write(el, { 'data-anchor': [...namesOf(el), `a${i}`].join(' ') });
  return `a${i}`;
}

// the name taken off the elements of slide once no line names it
function tidy(write: Writer, slide: Element | null, name: string): void {
  if (!slide || named(slide, name)) return;
  for (const el of slide.querySelectorAll(withName(name))) {
    const rest = namesOf(el).filter((n) => n !== name);
    write(el, { 'data-anchor': rest.length ? rest.join(' ') : null });
  }
}

// the end of svg glued to g, or let go with null
export function setEnd(write: Writer, svg: Element, end: End, g: Glue | null): void {
  const was = parseEnd(svg.getAttribute(attrOf(end)));
  const value = g ? `${nameOf(write, g.els)} ${num(g.fx)} ${num(g.fy)}` : null;
  if (value === svg.getAttribute(attrOf(end))) return;
  write(svg, { [attrOf(end)]: value });
  if (was) tidy(write, slideOf(svg), was.name);
}

// the elements of the object of the glue of an end, none for an end without glue
export function glueOf(svg: Element, end: End): Element[] {
  const g = parseEnd(svg.getAttribute(attrOf(end)));
  return g ? anchorsOf(slideOf(svg), g.name) : [];
}

// each glued end of the current slide put at its place in the box of its element, and the glue of
// an end whose element is gone taken off. a turned line, and an element that is not laid out, are
// left as they are
export function follow(app: App, write: Writer): void {
  const slide = app.current();
  for (const svg of glued(slide)) {
    if (!svg.isConnected || !app.pairing?.elements.get(svg)?.open) continue;
    const s = strokeAt(svg);
    if (!s || parseFloat((svg as HTMLElement).style.rotate)) continue;
    const e = { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 };
    for (const end of ['from', 'to'] as End[]) {
      const g = parseEnd(svg.getAttribute(attrOf(end)));
      if (!g) continue;
      const els = anchorsOf(slide, g.name);
      if (!els.length) {
        write(svg, { [attrOf(end)]: null });
        continue;
      }
      if (els.some((el) => !el.getClientRects().length)) continue;
      const p = placeIn(app, els, g.fx, g.fy);
      if (end === 'from') [e.x1, e.y1] = [Math.round(p.x), Math.round(p.y)];
      else [e.x2, e.y2] = [Math.round(p.x), Math.round(p.y)];
    }
    if (e.x1 !== s.x1 || e.y1 !== s.y1 || e.x2 !== s.x2 || e.y2 !== s.y2) writeStroke(write, svg, rebend(s, e));
  }
}

// the glue of the moved lines taken off at each end whose element was not moved with them, as a
// move of a whole connector in PowerPoint
function letGo(write: Writer, moved: Element[]): void {
  for (const svg of moved) {
    if (!svg.matches(LINE)) continue;
    for (const end of ['from', 'to'] as End[]) {
      const els = glueOf(svg, end);
      const along = els.length && els.every((el) => moved.some((m) => m === el || m.contains(el) || el.contains(m)));
      if (svg.hasAttribute(attrOf(end)) && !along) setEnd(write, svg, end, null);
    }
  }
}

// the patch of the last record() of canvas/drag.ts, to which the nudges of its run are added
let recent: Patch | null = null;

// the glue after a change of the places of moved, recorded with it by record() of canvas/drag.ts
export function afterMove(app: App, moved: Element[]): Patch {
  const p = new Patch(app);
  letGo(p.write, moved);
  follow(app, p.write);
  recent = p;
  return p;
}

// the glued ends followed again after a nudge of the run of the last record()
export function followAgain(app: App): void {
  if (recent) follow(app, recent.write);
}

// the copies of one copy of elements glued to each other as their originals are: an end named by
// a copied line keeps its glue to a copied element, under a name unique on the slide, and the glue
// to an element that was not copied is taken off, as is the name of a copy that no copied line names
export function relink(app: App, copies: Element[]): void {
  const write = recorded(app);
  const all = copies.flatMap((c) => [c, ...c.querySelectorAll('[data-anchor], svg.line')]);
  const marked = all.filter((el) => el.hasAttribute('data-anchor'));
  const names = new Set(marked.flatMap(namesOf));
  const used = new Set<string>();
  const ends: [Element, End, ReturnType<typeof parseEnd>][] = [];
  for (const svg of all.filter((el) => el.matches(LINE))) {
    for (const end of ['from', 'to'] as End[]) {
      const g = parseEnd(svg.getAttribute(attrOf(end)));
      if (!g) continue;
      if (names.has(g.name)) {
        used.add(g.name);
        ends.push([svg, end, g]);
      } else write(svg, { [attrOf(end)]: null });
    }
  }
  if (!marked.length) return;
  const slide = slideOf(copies[0]);
  const taken = new Set([...(slide?.querySelectorAll('[data-anchor]') ?? [])].filter((el) => !all.includes(el)).flatMap(namesOf));
  const to = new Map<string, string>();
  for (const n of used) {
    let m = n;
    for (let i = 1; taken.has(m); i++) m = `a${i}`;
    taken.add(m);
    to.set(n, m);
  }
  for (const el of marked) {
    const list = namesOf(el).flatMap((n) => to.get(n) ?? []);
    const m = list.length ? list.join(' ') : null;
    if (m !== el.getAttribute('data-anchor')) write(el, { 'data-anchor': m });
  }
  for (const [svg, end, g] of ends) if (g && to.get(g.name) !== g.name) write(svg, { [attrOf(end)]: `${to.get(g.name)} ${num(g.fx)} ${num(g.fy)}` });
}

// the glue followed at the end of each transaction of the history, in the same entry, and the names
// that a removed line glued to taken off with it
export function install(app: App): void {
  const remove = app.doc.remove.bind(app.doc);
  app.doc.remove = async (el, ...rest) => {
    const slide = slideOf(el);
    const svgs = [el, ...el.querySelectorAll(LINE)].filter((l) => l.matches(LINE));
    const names = svgs.flatMap((svg) => (['from', 'to'] as End[]).flatMap((end) => parseEnd(svg.getAttribute(attrOf(end)))?.name ?? []));
    await remove(el, ...rest);
    if (slide?.isConnected) for (const n of new Set(names)) tidy(recorded(app), slide, n);
  };
  app.history.onSettle(() => {
    const p = new Patch(app);
    follow(app, p.write);
    if (!p.empty) app.history.push({ label: 'glue', undo: () => p.undo(), redo: () => p.redo() });
  });
}
