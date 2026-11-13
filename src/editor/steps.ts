// the Steps tab of the inspector: the steps of the current slide, i.e. which of its elements are
// reveal.js fragments and in which order, as the Animation Pane of PowerPoint and the Build Order of
// Keynote. each step is a card with a row per element shown at it, and the elements shown with the
// slide are listed under the cards. a row is dragged to another place in the order, and its step
// chip opens a menu of its step, its start, its effect, and Show Last. Preview Steps plays the steps
// of the slide in place. the number of the step of each element is drawn at its upper left on the
// slide. every change is a command of commands/steps.ts, written through app.doc as one entry of
// the history

import type { App } from './app.ts';
import type { Entry } from './history.ts';
import type { Pairing } from './render.ts';
import type { TagEdit, TagState } from './tags.ts';
import { stepViewers } from '../viewers.ts';
import { OFF, fragmentIndex, fragmentsOf, type Layers, itemsOf, planOf, remapKeep, showLayer, shownAt, startOf, stepAt, type Item, type Plan, type Start } from './layers.ts';
import { setPreview } from './canvas/frames.ts';
import { twinOf } from './canvas/hit.ts';
import { media as store } from './media/store.ts';
import { codeAt, dimLines, lineRect, linesOf, stepsOf } from './commands/code.ts';
import { numberField } from './inspector/controls.ts';
import { injectStyle, make } from './ui/dom.ts';
import { icon } from './ui/icons.ts';
import { chromeSelect, closeMenus, menuOpen, openMenu, type MenuItem } from './ui/menu.ts';

export type Ctx = {
  pairing(): Pairing | null;
  slide(): Element | null;
  edits: Map<Element, TagEdit>;
  markDirty(): void;
  layout(): void;
  // the slide of el is shown, for an undo from another slide
  show(el: Element): void;
  record(entry: Entry): void;
  // the TeX of an mjx-container, or null
  tex(el: Element): string | null;
  // the steps of the slide were changed, which may change its layers
  changed(): void;
};

// the elements of a slide that can be a step, outside the notes and the backdrop, and not inside
// another such element, e.g. an image inside a paragraph, which is shown with the paragraph. a
// heading and the footnote can be a step too, as any text box in PowerPoint, but One by one
// leaves them with the slide. a list is a step of its own only when it is shown all at once, and
// otherwise its items are the steps
const CANDIDATES = 'h1, h2, h3, p, li, ul.fragment, ol.fragment, table, pre, blockquote, div.math, figure, .zone, .plate, .qr, .tikz, tycho-viewer, .caption, .foot, img, video, svg.line, .shape';
export const WITH_SLIDE = 'h1, h2, h3, .foot';
const OUTSIDE = 'aside.notes, .backdrop';

export function candidates(slide: Element, pairing: Pairing): Element[] {
  return [...slide.querySelectorAll(CANDIDATES)].filter((el) => {
    if (!pairing.elements.get(el)?.open) return false;
    const up = el.parentElement?.closest(`${CANDIDATES}, ${OUTSIDE}, section`);
    return !up || up === slide;
  });
}

// the items of the step model of a slide: its candidates and every other fragment on it, e.g. a
// row of a table, a span in a paragraph, a backdrop, or a step of a plot, in document order, since
// their indexes are one order. a fragment that is not paired with a tag, e.g. a span in the text of
// a block, is locked, since its tag is not written
// a list of the slide is given in extra with its items, so that a change of its delivery sees both
export function stepElements(slide: Element, pairing: Pairing, extra: Element[] = []): Element[] {
  const listed = new Set([...candidates(slide, pairing), ...extra]);
  return [...slide.querySelectorAll('*')].filter((el) => listed.has(el) || (el.classList.contains('fragment') && !el.closest('aside.notes') && el.closest('section') === slide));
}

export function itemOf(state: TagState): Item {
  const raw = state.attrs['data-fragment-index'];
  const index = raw !== undefined && /^\s*-?\d+\s*$/.test(raw) ? Number(raw) : null;
  return { fragment: state.classes.includes('fragment'), index, final: 'data-final' in state.attrs };
}

// the effects of reveal.js that the Steps tab replaces, and the five that it writes: Fade In, the
// plain fragment, Play, Fade Out, Only at Its Step, and Dim, which semi-fade-out draws at the
// opacity of a ghost from its step on. Play is the class play of the theme on a video or a tycho
// viewer, which shows its poster or its first frame with the slide and starts it at its step, as
// the animation Play of PowerPoint
const EFFECT_CLASSES = ['fade-in', 'fade-out', 'fade-up', 'fade-down', 'fade-left', 'fade-right', 'fade-in-then-out', 'fade-in-then-semi-out', 'semi-fade-out', 'current-visible', 'play'];
export type Effect = 'in' | 'play' | 'out' | 'only' | 'dim';
export const EFFECTS: [Effect, string][] = [['in', 'Fade In'], ['play', 'Play'], ['out', 'Fade Out'], ['only', 'Only at Its Step'], ['dim', 'Dim']];

// the elements started at their step by the effect Play
export const PLAYED = 'video, tycho-viewer';

// the effects offered in the menu of a row, Play only for a video or a tycho viewer. with several
// rows selected, the command sets Play only on these
export const effectsFor = (el: Element | undefined): [Effect, string][] => EFFECTS.filter(([id]) => id !== 'play' || !!el?.matches(PLAYED));

// the effect of a fragment with its label. an effect that the tab does not write, e.g. fade-up,
// keeps its name
export function effectOf(classes: string[]): { id: Effect | null; label: string } {
  if (classes.includes('play')) return { id: 'play', label: 'Play' };
  if (classes.includes('fade-out')) return { id: 'out', label: 'Fade Out' };
  if (classes.includes('current-visible')) return { id: 'only', label: 'Only at Its Step' };
  if (classes.includes('semi-fade-out')) return { id: 'dim', label: 'Dim' };
  const other = EFFECT_CLASSES.find((c) => c !== 'fade-in' && classes.includes(c));
  if (other) return { id: null, label: other.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') };
  return { id: 'in', label: 'Fade In' };
}

// the classes of el in the file, or on the page for a fragment that is not paired with a tag
export const classesOf = (app: App, el: Element): string[] => (app.pairing?.elements.get(el)?.open ? app.doc.tagState(el).classes : [...el.classList]);

// a line step of a code box, i.e. a group of lines of data-line-numbers after the first. the
// highlight plugin of reveal.js appends a copy of the code to the pre for each of them, a fragment
// at the index of the code and at each next index, or without an index when the code has none. a
// line step is an item of the model at the place of its copy, with the code as its element, and
// it is locked, since it is set in the Code pane and its index is that of the code
export type LineStep = { code: Element; group: number; lines: string };

// the steps of the current slide as the model reads them. an image or a video of a dark and light
// pair is one item with its twin, since every tag edit of one is written on the other. the item is
// the one shown, or else the first, and twins maps it to the other
export type Model = { slide: Element; els: Element[]; items: Item[]; locked: boolean[]; lines: (LineStep | null)[]; plan: Plan; twins?: Map<Element, Element> };

const intOf = (v: string | undefined): number | null => (v !== undefined && /^\s*-?\d+\s*$/.test(v) ? Number(v) : null);

export function modelOf(app: App, slide: Element | null = app.current(), extra: Element[] = []): Model | null {
  const pairing = app.pairing;
  if (!slide || !pairing || !app.doc) return null;
  const twins = new Map<Element, Element>();
  const all = stepElements(slide, pairing, extra);
  const els = all.filter((el) => {
    const twin = twinOf(app, el);
    if (!twin || !all.includes(twin)) return true;
    if (twins.has(twin)) return false;
    const keep = el.getClientRects().length || !twin.getClientRects().length;
    if (keep) twins.set(el, twin);
    return keep;
  });
  const locked = els.map((el) => !pairing.elements.get(el)?.open);
  const items = els.map((el, i): Item => {
    if (!locked[i]) return itemOf(app.doc.tagState(el));
    const index = Number.parseFloat(fragmentIndex(el) ?? '');
    return { fragment: true, index: Number.isNaN(index) ? null : index, final: el.hasAttribute('data-final') };
  });
  const lines: (LineStep | null)[] = els.map(() => null);
  for (const code of slide.querySelectorAll('pre > code')) {
    if (code.closest('aside.notes') || code.closest('section') !== slide || codeAt(app, { el: code }) !== code) continue;
    const groups = stepsOf(app, code).groups;
    if (groups.length < 2) continue;
    const pre = code.parentElement as Element;
    const at = els.reduce((k, e, j) => (e === pre || pre.contains(e) || e.compareDocumentPosition(pre) & Node.DOCUMENT_POSITION_FOLLOWING ? j + 1 : k), 0);
    const r = intOf(app.doc.tagState(code).attrs['data-fragment-index']);
    const steps = groups.slice(1).map((g, k) => ({ code, group: k + 1, lines: g }));
    els.splice(at, 0, ...steps.map(() => code));
    locked.splice(at, 0, ...steps.map(() => true));
    lines.splice(at, 0, ...steps);
    items.splice(at, 0, ...steps.map((_, k): Item => ({ fragment: true, index: r === null ? null : r + k, final: false })));
  }
  return { slide, els, items, locked, lines, plan: planOf(items), twins };
}

// the position of el among the items of m, or of the item of its pair, apart from the line steps
// of a code
export const indexIn = (m: Model, el: Element): number => {
  const item = [...(m.twins ?? [])].find(([, twin]) => twin === el)?.[0] ?? el;
  return m.els.findIndex((x, k) => x === item && !m.lines[k]);
};

// the model of the slide of el, with the position of el among its items
export function modelAt(app: App, el: Element): (Model & { i: number }) | null {
  const m = modelOf(app, el.closest('section'));
  const i = m ? indexIn(m, el) : -1;
  return m && i >= 0 ? { ...m, i } : null;
}

// the line steps of the codes of m in their order, by code, as positions among its items
function lineRuns(m: Model): Map<Element, number[]> {
  const out = new Map<Element, number[]>();
  m.lines.forEach((l, i) => {
    if (l) out.set(l.code, [...(out.get(l.code) ?? []), i]);
  });
  return out;
}

// the index written on a code for its line steps after the items were written as after. the line
// steps of a code are at consecutive indexes from the index of the code. a code without an index
// keeps none while its line steps are the last steps of the slide, each alone, since reveal.js
// shows the fragments without an index after the others
function codeIndex(app: App, m: Model, plan: Plan, after: Item[], code: Element, run: number[]): number | null {
  const at = run.map((i) => after[i].index);
  if (at.some((x) => x === null)) throw new Error('The line steps of a code box are set in its Code pane, and each of them stays a step of the slide');
  if (at.some((x, k) => x !== (at[0] as number) + k)) throw new Error('The line steps of a code box are shown at steps one after another, and another step cannot be put between them');
  const G = plan.groups.length;
  const last = run.every((i, k) => plan.groups[G - run.length + k]?.length === 1 && plan.groups[G - run.length + k][0] === i);
  if (intOf(app.doc.tagState(code).attrs['data-fragment-index']) === null && last) return null;
  return at[0] as number;
}

// the delivery of a list, as in Keynote and in the Effect Options of PowerPoint: All at Once, i.e.
// As One Object, is the list as one fragment, and By Item, i.e. By Bullet or By Paragraph, is each
// item of the list a fragment of its own step. a list is delivered only at the top of a slide,
// i.e. not inside an item or a paragraph, and a nested list is shown with its item
export type Delivery = 'all' | 'item';
export const DELIVERIES: [Delivery, string][] = [['all', 'List All at Once'], ['item', 'List Item by Item']];

export const listItems = (list: Element): Element[] => [...list.children].filter((c) => c.localName === 'li');

// the list at the top of the slide around el, or el itself when it is one
export function listOf(el: Element | null): Element | null {
  for (let up = el; up && up.localName !== 'section'; up = up.parentElement) {
    if (!up.matches('ul, ol')) continue;
    const outer = up.parentElement?.closest(`${CANDIDATES}, ${OUTSIDE}, section`);
    if (outer?.localName === 'section') return up;
  }
  return null;
}

export function deliveryOf(app: App, list: Element): Delivery | null {
  if (classesOf(app, list).includes('fragment')) return 'all';
  return listItems(list).some((li) => classesOf(app, li).includes('fragment')) ? 'item' : null;
}

// the plan with the list delivered by. the list and its items are taken out of the plan, and put
// back at the first step of any of them: the list alone for all, or each item at a step of its own
// from there on, the later steps moved down. the first one joins the other elements of that step.
// a list that is not a step becomes the last steps, a list shown last stays last, and null shows
// the list with the slide
export function deliverPlan(plan: Plan, list: number, items: number[], by: Delivery | null): Plan {
  const members = new Set([list, ...items]);
  const k = plan.groups.findIndex((g) => g.some((x) => members.has(x)));
  const last = plan.finals.some((x) => members.has(x));
  const rest = plan.groups.map((g) => g.filter((x) => !members.has(x)));
  const groups = rest.filter((g) => g.length);
  const finals = plan.finals.filter((x) => !members.has(x));
  if (by === null) return { groups, finals };
  const heads = by === 'all' ? [list] : items;
  if (k < 0 && last) return { groups, finals: [...finals, ...heads].sort((a, b) => a - b) };
  const at = k < 0 ? groups.length : rest.slice(0, k).filter((g) => g.length).length;
  if (k >= 0 && rest[k].length) groups[at].push(heads[0]);
  else groups.splice(at, 0, [heads[0]]);
  groups.splice(at + 1, 0, ...heads.slice(1).map((i) => [i]));
  return { groups, finals };
}

// the delays of the steps of before carried to the steps of after, through standIn, the item of
// after that takes the place of an item of before. the first step of before that lands on a step
// of after gives it its delay
export function carryDelays(before: Plan, after: Plan, delays: Map<number, number>, standIn: Map<number, number>): Map<number, number> {
  const out = new Map<number, number>();
  const end = delays.get(-1);
  if (end !== undefined) out.set(-1, end);
  const seen = new Set<number>();
  for (const g of before.groups) {
    const d = delays.get(Math.min(...g));
    for (const x of g) {
      const k = after.groups.findIndex((h) => h.includes(standIn.get(x) ?? x));
      if (k < 0) continue;
      if (!seen.has(k) && d !== undefined && k > 0) out.set(Math.min(...after.groups[k]), d);
      seen.add(k);
      break;
    }
  }
  return out;
}

// a step that starts After Previous, as in PowerPoint, or After Build, as in Keynote, is shown by
// itself a delay after the step before it. reveal.js offers this as data-autoslide on a fragment,
// the milliseconds after which the next step is shown once the fragment is the current one. the
// delay is thus written on the first fragment of the step before, and read back as the start of
// the first item of the next step. a delay on the last step moves on to the next slide, and it is
// kept on the last step at -1. reveal.js reads 0 as no delay, hence the shortest delay is 0.1 s
export type StartKind = Start | 'after';
export const AUTOSLIDE = 'data-autoslide';
export const MIN_DELAY = 100;
export const AFTER_DEFAULT = 500;

function autoslideOf(app: App, m: Model, i: number): number | null {
  if (m.lines[i]) return null;
  const raw = m.locked[i] ? m.els[i].getAttribute(AUTOSLIDE) : app.doc.tagState(m.els[i]).attrs[AUTOSLIDE];
  return raw != null && /^\s*\d+\s*$/.test(raw) ? Number(raw) : null;
}

// the delays in ms of the steps that start after the step before, keyed by the first item of the
// step in document order, and by -1 for the next slide after the last step
export function delaysOf(app: App, m: Model): Map<number, number> {
  const out = new Map<number, number>();
  m.plan.groups.forEach((g, k) => {
    const ms = g.map((i) => autoslideOf(app, m, i)).find((v) => v !== null);
    if (ms === undefined || ms === null) return;
    const next = m.plan.groups[k + 1];
    out.set(next ? Math.min(...next) : -1, ms);
  });
  return out;
}

// the start of item i, with its delay in ms for After Previous
export function startAt(app: App, m: Model, i: number, delays: Map<number, number> = delaysOf(app, m)): { start: StartKind | null; delay: number | null } {
  const start = startOf(m.plan, i);
  const g = m.plan.groups.findIndex((g) => g.includes(i));
  const delay = start === 'click' && g > 0 ? delays.get(i) : undefined;
  return delay === undefined ? { start, delay: null } : { start: 'after', delay };
}

// the plan written into the tags of the slide: the class fragment, data-fragment-index, and
// data-final of each item that changes, the effect classes of an item taken out of the steps, and
// each data-keep of a number, which follows its step to its new index. the delays of the steps
// that start After Previous follow the first item of their step. the changes are recorded with an
// entry that shows the slide at an undo, and false is returned when nothing changes
export function writePlan(app: App, m: Model, plan: Plan, extra: Map<Element, TagEdit> = new Map(), delays: Map<number, number> = delaysOf(app, m)): boolean {
  const after = itemsOf(m.items, plan);
  const moved = m.els.find((_, i) => m.locked[i] && !m.lines[i] && (after[i].index !== m.items[i].index || after[i].fragment !== m.items[i].fragment || after[i].final !== m.items[i].final));
  if (moved) throw new Error(`The step of the ${describe(moved, () => null).kind.toLowerCase()} in the text of a block cannot be changed here, and it would be renumbered by this change`);
  const edits = new Map<Element, TagEdit>(extra);
  const add = (el: Element, e: TagEdit) => edits.set(el, { ...edits.get(el), ...e, attrs: { ...edits.get(el)?.attrs, ...e.attrs } });
  m.els.forEach((el, i) => {
    if (m.locked[i]) return;
    const b = m.items[i];
    const a = after[i];
    const e: TagEdit = {};
    if (a.fragment !== b.fragment) e.fragment = a.fragment;
    if (a.index !== b.index) e.index = a.index;
    if (a.final !== b.final) e.attrs = { 'data-final': a.final ? '' : null };
    if (!a.fragment && b.fragment) {
      const classes = app.doc.tagState(el).classes.filter((c) => EFFECT_CLASSES.includes(c));
      if (classes.length) e.classes = Object.fromEntries(classes.map((c) => [c, false]));
    }
    if (Object.keys(e).length) add(el, e);
  });
  const pairing = app.pairing;
  for (const el of m.slide.querySelectorAll('[data-keep]')) {
    if (!pairing?.elements.get(el)?.open) continue;
    const value = app.doc.tagState(el).attrs['data-keep'];
    if (!value || !/^\s*\d+\s*$/.test(value)) continue;
    const n = remapKeep(Number(value), m.items, after);
    if (n !== Number(value)) add(el, { attrs: { 'data-keep': String(n) } });
  }
  // the data-autoslide of each step before a step with a delay, on its first fragment with a tag,
  // and on no other fragment of a step before or after the change
  const want = new Map<number, number>();
  const firstTagged = (g: number[]) => [...g].sort((a, b) => a - b).find((i) => !m.locked[i]);
  plan.groups.forEach((g, k) => {
    const d = k ? delays.get(Math.min(...g)) : undefined;
    const at = d === undefined ? undefined : firstTagged(plan.groups[k - 1]);
    if (d !== undefined && at !== undefined) want.set(at, d);
  });
  const end = delays.get(-1);
  const lastAt = plan.groups.length ? firstTagged(plan.groups[plan.groups.length - 1]) : undefined;
  if (end !== undefined && lastAt !== undefined) want.set(lastAt, end);
  const touched = new Set([...m.plan.groups.flat(), ...plan.groups.flat()]);
  m.els.forEach((el, i) => {
    if (m.locked[i] || !touched.has(i)) return;
    const now = app.doc.tagState(el).attrs[AUTOSLIDE] ?? null;
    const w = want.has(i) ? String(want.get(i)) : null;
    if (now !== w) add(el, { attrs: { [AUTOSLIDE]: w } });
  });
  for (const [code, run] of lineRuns(m)) {
    const want = codeIndex(app, m, plan, after, code, run);
    if (want !== intOf(app.doc.tagState(code).attrs['data-fragment-index'])) add(code, { index: want });
  }
  for (const [el, e] of edits) if (e.attrs && !Object.keys(e.attrs).length) delete e.attrs;
  const changed = [...edits].filter(([, e]) => Object.keys(e).length);
  if (!changed.length) return false;
  const first = changed[0][0];
  // the selected step stays selected through an undo and a redo, which may change another element
  const held = app.history.holding();
  app.history.push({ label: 'steps', undo: () => app.showSlide(first), redo: () => app.showSlide(first) });
  for (const [el, e] of changed) app.doc.setTag(el, e, 'steps');
  held();
  return true;
}

// the classes of an effect written into the tag of el, and the others of EFFECT_CLASSES taken off.
// Play takes data-autoplay off, since a video of the class play is started at its step
export function effectEdit(state: TagState, effect: Effect): TagEdit {
  const want = effect === 'out' ? 'fade-out' : effect === 'only' ? 'current-visible' : effect === 'dim' ? 'semi-fade-out' : effect === 'play' ? 'play' : null;
  const classes: Record<string, boolean> = {};
  for (const c of state.classes) if (EFFECT_CLASSES.includes(c) && c !== want) classes[c] = false;
  if (want && !state.classes.includes(want)) classes[want] = true;
  const out: TagEdit = Object.keys(classes).length ? { classes } : {};
  if (effect === 'play' && 'data-autoplay' in state.attrs) out.attrs = { 'data-autoplay': null };
  return out;
}

const KINDS: [string, string][] = [['h1, h2, h3', 'Heading'], ['.foot', 'Footnote'], ['li', 'Item'], ['ul, ol', 'List'], ['p', 'Paragraph'], ['div.math', 'Formula'], ['table', 'Table'], ['tr', 'Table row'], ['pre, code', 'Code'], ['blockquote', 'Quotation'], ['video', 'Video'], ['tycho-viewer', 'Scene'], ['.qr', 'QR code'], ['.caption', 'Caption'], ['.backdrop', 'Backdrop'], ['.surface', 'Surface'], ['.plot', 'Plot'], ['[data-plot-show], [data-plot-tab]', 'Plot step'], ['[data-surface-stage]', 'Surface step'], ['.tikz > [data-part]', 'Figure step'], ['.tikz', 'TikZ figure'], ['img, figure, .zone, .plate', 'Figure'], ['svg.line', 'Line'], ['.shape', 'Shape']];

// the text of el with each formula given by its TeX, since an mjx-container does not have text
function textOf(el: Element, tex: Ctx['tex']): string {
  let out = '';
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) out += child.nodeValue ?? '';
    else if (child instanceof Element) out += child.localName === 'mjx-container' ? tex(child) ?? '' : child.matches('.beeson-badge, script, style, template') ? '' : textOf(child, tex);
  }
  return out;
}

// the title of a tycho scene, read from the JSON of its scene script, or the name of its file
function sceneTitle(el: Element): string {
  const script = el.querySelector('script[data-tycho="scene"]');
  try {
    if (script) {
      const raw = (script.textContent ?? '').trim();
      const json = script.getAttribute('data-encoding') === 'base64' ? new TextDecoder().decode(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))) : raw;
      const title = (JSON.parse(json) as { title?: unknown }).title;
      if (typeof title === 'string' && title) return title;
    }
  } catch {
    // a scene that is not JSON is named by its file
  }
  return el.getAttribute('src')?.split('/').pop() ?? 'tycho scene';
}

export function describe(el: Element, tex: Ctx['tex']): { kind: string; text: string } {
  const kind = KINDS.find(([selector]) => el.matches(selector))?.[1] ?? (el.localName === 'span' ? 'Text' : el.localName);
  const media = el.matches('img, video') ? el : el.querySelector('img, video');
  let text = textOf(el, tex).replace(/\s+/g, ' ').trim();
  // a new picture is shown from an object URL, hence it is named by the path of its file
  if (!text && media) text = media.getAttribute('alt') || (store.pathOf(media.getAttribute('src') ?? media.querySelector('source')?.getAttribute('src') ?? null) ?? '').split('/').pop() || '';
  if (!text && el.matches('tycho-viewer')) text = sceneTitle(el);
  if (!text) {
    const named = [['data-plot-show', 'Show'], ['data-plot-tab', 'Tab'], ['data-surface-stage', 'Stage'], ['data-part', 'Part'], ['data-scene', 'Scene'], ['data-strands', 'Strands']].find(([a]) => el.hasAttribute(a));
    if (named) text = `${named[1]} ${el.getAttribute(named[0]) ?? ''}`.trim();
  }
  return { kind, text: text.length > 90 ? `${text.slice(0, 90)}…` : text };
}

// the kind and the text of the row of a line step: its lines, and the first of them
export function describeLines(l: LineStep): { kind: string; text: string } {
  const first = Math.min(...[...linesOf(l.lines)]);
  const text = (l.code.textContent ?? '').split('\n')[first - 1]?.trim() ?? '';
  const kind = `${/[-,]/.test(l.lines) ? 'Lines' : 'Line'} ${l.lines.replace(/-/g, '–').replace(/,/g, ', ')}`;
  return { kind, text: text.length > 90 ? `${text.slice(0, 90)}…` : text };
}

export const STARTS: [StartKind, string][] = [['click', 'On Click'], ['with', 'With Previous'], ['after', 'After Previous']];

// a delay in ms as seconds with at most one decimal
const seconds = (ms: number): string => String(Math.round(ms / 100) / 10);

// the text of a row, cut with an ellipsis where the pane is too narrow and then shown whole in its
// tooltip, as in the Animation Pane of PowerPoint
function fullText(text: string): HTMLElement {
  const el = make('span', 'text', text);
  if (text) el.title = text;
  return el;
}

export const startLabel = (start: StartKind | null, delay: number | null): string =>
  start === 'after' ? `After Previous, ${seconds(delay ?? 0)} s` : start === 'with' ? 'With Previous' : 'On Click';

// item i can start After Previous when the step before its own has a fragment with a tag, on
// which the delay is written, or when it is shown with others and gets a step of its own
export function afterable(m: Model, i: number): boolean {
  const g = m.plan.groups.findIndex((g) => g.includes(i));
  if (g < 0) return false;
  const before = Math.min(...m.plan.groups[g]) === i ? m.plan.groups[g - 1] : m.plan.groups[g].filter((x) => x < i);
  return !!before?.some((x) => !m.locked[x]);
}

// the mark of a start in a chip, 9 px on the grid of the icons of ui/icons.ts: a plus for With
// Previous, and a clock for After Previous
function startGlyph(start: 'with' | 'after'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 10 10');
  svg.setAttribute('width', '9');
  svg.setAttribute('height', '9');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('start', start);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', start === 'with' ? 'M5 1.5v7M1.5 5h7' : 'M5 .9a4.1 4.1 0 1 1 0 8.2 4.1 4.1 0 0 1 0-8.2zM5 2.8V5l1.6 1.1');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.3');
  path.setAttribute('stroke-linecap', 'round');
  svg.append(path);
  return svg;
}

// the box under which the menu of a chip is opened: the column of the chip over the height of its
// row, so that the menu is put under the row at the chip, or over the row when there is no room
// under it, and never over the second line of the row
export const rowAnchor = (chip: Element, row: Element): DOMRect => {
  const c = chip.getBoundingClientRect();
  const r = row.getBoundingClientRect();
  return new DOMRect(c.left, r.top, c.width, r.height);
};

// a menu that still covers row, since it fits neither under nor over it, is put beside the row on
// the side of the canvas, level with the row, as a popover of Keynote is put beside its control.
// with beside set, the menu is put there in any case, e.g. for the head of a list, whose items are
// the rows under it
export function popover(menu: HTMLElement, row: Element, beside = false): void {
  const m = menu.getBoundingClientRect();
  const r = row.getBoundingClientRect();
  if (!beside && (m.bottom <= r.top || m.top >= r.bottom)) return;
  const pad = 4;
  const left = r.left - m.width - 6 >= pad ? r.left - m.width - 6 : Math.min(innerWidth - m.width - pad, r.right + 6);
  const top = Math.max(pad, Math.min(r.top - 6, innerHeight - m.height - pad));
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

// the menu is moved with its row when the row moves after the menu was opened, e.g. when the block
// of the transition above the rows is hidden at the release of the press that selected the row
function follow(menu: HTMLElement, row: Element): void {
  const top = row.getBoundingClientRect().top;
  const shift = () => {
    if (!menu.isConnected || !row.isConnected) return;
    const dy = row.getBoundingClientRect().top - top;
    if (dy) menu.style.top = `${Math.round(menu.getBoundingClientRect().top + dy)}px`;
  };
  window.addEventListener('pointerup', shift, { once: true, capture: true });
}

// the six dots of a drag handle, in the grid of the icons of ui/icons.ts
function grip(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 8 14');
  svg.setAttribute('width', '8');
  svg.setAttribute('height', '14');
  svg.setAttribute('aria-hidden', 'true');
  for (const [cx, cy] of [[2, 3], [6, 3], [2, 7], [6, 7], [2, 11], [6, 11]]) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', String(cx));
    c.setAttribute('cy', String(cy));
    c.setAttribute('r', '1.1');
    c.setAttribute('fill', 'currentColor');
    svg.append(c);
  }
  return svg;
}

const P = 'html.beeson-editor .beeson-edit-inspector .beeson-edit-side';
const CSS = `
.beeson-edit-side { display: none; flex-direction: column; }
html.beeson-steps .beeson-edit-side { display: flex; }
${P} { font: 12px/1.35 var(--ed-font, system-ui, sans-serif); color: var(--ed-text); user-select: none; -webkit-user-select: none; }
${P} .head { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 2px 12px 10px; border-bottom: 1px solid var(--ed-line); }
${P} .head button.play { grid-column: 1 / -1; }
${P} .row.line .grip { visibility: hidden; }
${P} .head button { display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 24px; padding: 0 7px; border: 1px solid var(--ed-control-line); border-radius: 6px; background: var(--ed-control); color: var(--ed-text); font: 500 12px/1 var(--ed-font); white-space: nowrap; cursor: default; }
${P} .head button:hover { background: color-mix(in srgb, var(--ed-control) 85%, var(--ed-text)); }
${P} .head button:disabled { color: var(--ed-faint); }
${P} .head button.play[aria-pressed="true"] { background: var(--ed-select); border-color: var(--ed-select); color: var(--ed-on-select); }
${P} .head button:focus-visible, ${P} .chip:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 1px; }
${P} .rows .row:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: -2px; }
${P} .rows { position: relative; flex: 1; min-height: 0; overflow: auto; padding: 10px 8px 12px; }
${P} .card { position: relative; margin: 0 0 6px; border: 1px solid var(--ed-line); border-radius: 8px; background: var(--ed-control); }
${P} .card.empty { padding: 12px; border-style: dashed; background: transparent; color: var(--ed-muted); text-align: center; }
${P} .card.plain { background: transparent; }
${P} .section { display: flex; align-items: baseline; justify-content: space-between; margin: 14px 2px 6px; color: var(--ed-muted); font: 600 11px/1.2 var(--ed-font); }
${P} .rows .row { position: relative; display: grid; grid-template-columns: 8px 32px minmax(0, 1fr); align-items: center; column-gap: 5px; min-height: 38px; padding: 4px 8px 4px 4px; box-sizing: border-box; cursor: default; outline: none; }
${P} .rows .card > .row:first-child { border-radius: 7px 7px 0 0; }
${P} .rows .card > .row:last-child { border-radius: 0 0 7px 7px; }
${P} .rows .card > .row:only-child { border-radius: 7px; }
${P} .rows .card > .row + .row::before { content: ""; position: absolute; left: 49px; right: 10px; top: 0; border-top: 1px solid var(--ed-line); }
${P} .rows .card > .row.with::before { border-top-style: dotted; border-top-color: var(--ed-faint); }
${P} .rows .row:hover { background: var(--ed-hover); }
${P} .rows .row.selected { background: var(--ed-select); color: var(--ed-on-select); }
${P} .rows .row.selected::before, ${P} .rows .row.selected + .row::before { border-top-color: transparent !important; }
${P} .rows .row.dragging { opacity: 0.35; }
${P} .rows .row.locked .grip { visibility: hidden; }
${P} .rows .row.locked .chip { opacity: 0.6; }
${P} .grip { display: flex; justify-content: center; color: var(--ed-faint); cursor: grab; }
${P} .rows .row.selected .grip { color: inherit; opacity: 0.7; }
${P} .chip { display: inline-flex; align-items: center; justify-content: center; gap: 1px; box-sizing: border-box; width: 32px; height: 20px; padding: 0 1px 0 4px; border: 1px solid var(--ed-control-line); border-radius: 10px; background: var(--ed-panel); color: var(--ed-text); font: 600 11px/1 var(--ed-font); font-variant-numeric: tabular-nums; cursor: default; }
${P} .chip svg { flex: none; opacity: 0.6; }
${P} .chip svg.start { opacity: 1; margin-right: 2px; }
${P} .chip[data-start="after"] svg.start { color: var(--ed-guide); }
${P} .rows .row.selected .chip svg.start { color: inherit; }
${P} .rows .list-head { position: relative; display: grid; grid-template-columns: 8px 52px minmax(0, 1fr); align-items: center; column-gap: 5px; min-height: 38px; padding: 4px 8px 4px 4px; box-sizing: border-box; cursor: default; }
${P} .rows .card > .row + .list-head::before { content: ""; position: absolute; left: 49px; right: 10px; top: 0; border-top: 1px solid var(--ed-line); }
${P} .rows .card > .list-head:first-child { border-radius: 7px 7px 0 0; }
${P} .rows .list-head:hover { background: var(--ed-hover); }
${P} .rows .list-head.selected { background: var(--ed-select); color: var(--ed-on-select); }
${P} .rows .list-head .chip { width: 52px; }
${P} .rows .row.nested { padding-left: 16px; grid-template-columns: 8px 32px minmax(0, 1fr); }
${P} .rows.wide .row, ${P} .rows.wide .row.nested { grid-template-columns: 8px 44px minmax(0, 1fr); }
${P} .rows .list-head + .row.nested::before, ${P} .rows .row.nested + .row.nested::before { content: ""; position: absolute; left: 61px; right: 10px; top: 0; border-top: 1px solid var(--ed-line); }
${P} .rows .list-head.selected + .row::before { border-top-color: transparent; }
${P} .detail .delay-box { display: flex; align-items: center; }
${P} .detail .delay-box .ed-num { flex: none; width: 104px; }
${P} .detail .delay-box .ed-num > label { display: none; }
${P} .detail .delay-box .ed-num .unit { font-size: 12px; }
${P} .rows .row.with .chip { color: var(--ed-muted); font-weight: 400; }
${P} .rows .row.slide .chip { color: var(--ed-muted); font-weight: 400; }
${P} .chip[aria-expanded="true"] { border-color: var(--ed-select); box-shadow: 0 0 0 1px var(--ed-select); }
${P} .rows .row.selected .chip, ${P} .rows .list-head.selected .chip { border-color: rgba(255, 255, 255, 0.5); background: rgba(255, 255, 255, 0.16); color: inherit; }
${P} .body { display: flex; flex-direction: column; min-width: 0; gap: 1px; }
${P} .text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
${P} .text:empty::before { content: "Empty"; color: var(--ed-faint); }
${P} .meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ed-muted); font-size: 11px; }
${P} .rows .row.selected .meta, ${P} .rows .list-head.selected .meta { color: inherit; opacity: 0.82; }
${P} .drop-line { position: absolute; left: 6px; right: 10px; height: 2px; margin-top: -1px; border-radius: 1px; background: var(--ed-select); pointer-events: none; }
${P} .drop-line::before { content: ""; position: absolute; left: -5px; top: -3px; width: 4px; height: 4px; border: 2px solid var(--ed-select); border-radius: 50%; background: var(--ed-panel); }
${P} .slide-zone { border-radius: 8px; }
${P} .slide-zone.drop { outline: 2px solid var(--ed-select); outline-offset: 2px; }
${P} .detail { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 6px 10px; padding: 10px 12px; border-top: 1px solid var(--ed-line); }
${P} .detail > span { color: var(--ed-muted); }
${P} .detail .beeson-edit-select { justify-content: space-between; width: 100%; height: 24px; padding: 0 6px 0 9px; border: 1px solid var(--ed-control-line); border-radius: 6px; background: var(--ed-control); color: var(--ed-text); font: 12px/1 var(--ed-font); }
${P} .detail .beeson-edit-select:disabled { color: var(--ed-faint); }
${P} .detail label { grid-column: 2; display: flex; align-items: center; gap: 6px; }
${P} .detail input { margin: 0; accent-color: var(--ed-select); }
${P} .detail.off > span, ${P} .detail.off label { color: var(--ed-faint); }
${P} .foot { margin: 0; padding: 8px 12px 10px; border-top: 1px solid var(--ed-line); color: var(--ed-muted); font-size: 11px; }
.beeson-steps-ghost { position: fixed; z-index: 95; box-sizing: border-box; display: grid; grid-template-columns: 8px 32px minmax(0, 1fr); align-items: center; column-gap: 5px; padding: 4px 8px 4px 4px; border: 1px solid var(--ed-line); border-radius: 8px; background: var(--ed-control); color: var(--ed-text); font: 12px/1.35 var(--ed-font, system-ui, sans-serif); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22), 0 1px 3px rgba(0, 0, 0, 0.14); opacity: 0.94; pointer-events: none; }
.beeson-steps-ghost .grip { display: flex; justify-content: center; color: var(--ed-faint); }
.beeson-steps-ghost .chip { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 20px; border: 1px solid var(--ed-control-line); border-radius: 10px; background: var(--ed-panel); color: inherit; font: 600 11px/1 var(--ed-font, system-ui, sans-serif); }
.beeson-steps-ghost .chip svg { display: none; }
.beeson-steps-ghost .body { display: flex; flex-direction: column; min-width: 0; }
.beeson-steps-ghost .text, .beeson-steps-ghost .meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beeson-steps-ghost .meta { color: var(--ed-muted); font-size: 11px; }
html.beeson-dragging-step, html.beeson-dragging-step * { cursor: grabbing !important; }
.beeson-badges { position: fixed; inset: 0; z-index: 52; pointer-events: none; }
.beeson-badge { position: absolute; transform: translate(-50%, -50%); min-width: 20px; height: 20px; padding: 0 5px; box-sizing: border-box; border: 1px solid rgba(0, 0, 0, 0.25); border-radius: 5px; background: #b8470c; color: #fff; font: 600 12px/18px var(--ed-font, system-ui, sans-serif); font-variant-numeric: tabular-nums; text-align: center; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); }
.beeson-badge.on { background: var(--ed-select, #8a2be2); }
html.beeson-editing .reveal .beeson-hover { outline: 2px solid var(--ed-guide, #f80) !important; outline-offset: 6px; }
html.beeson-previewing .beeson-badges, html.beeson-previewing .beeson-overlay, html.beeson-previewing .beeson-frame, html.beeson-previewing .beeson-handle { visibility: hidden !important; }
html.beeson-editing.beeson-previewing .reveal .slides section .fragment { transition: opacity 400ms ease-out !important; }
html.beeson-editing.beeson-previewing .reveal .slides section .fragment.beeson-pv-dim { opacity: 0.45 !important; }
html.beeson-editing.beeson-previewing .reveal .slides section .fragment.beeson-pv-off { opacity: 0 !important; }
html.beeson-editing.beeson-previewing .reveal .slides section .fragment.beeson-pv-ghost { opacity: 0.25 !important; }
@media (prefers-reduced-motion: reduce) { html.beeson-editing.beeson-previewing .reveal .slides section .fragment { transition: none !important; } }
`;

// the lists of the slide delivered by item whose items are consecutive steps, each alone at its
// step but the first, which may share its step. such a list is shown as one row with its items
// nested under it, as a build By Bullet in Keynote
type Run = { list: Element; items: number[]; from: number };
function runsOf(m: Model): Run[] {
  const out: Run[] = [];
  const seen = new Set<Element>();
  m.els.forEach((el) => {
    const list = el.localName === 'li' ? el.parentElement : null;
    if (!list || seen.has(list) || listOf(el) !== list) return;
    seen.add(list);
    const items = listItems(list).map((li) => m.els.indexOf(li));
    if (items.length < 2 || items.some((i) => i < 0)) return;
    const ks = items.map((i) => m.plan.groups.findIndex((g) => g.includes(i)));
    if (ks[0] < 0 || ks.some((k, j) => k !== ks[0] + j || (j > 0 && m.plan.groups[k].length !== 1))) return;
    out.push({ list, items, from: ks[0] });
  });
  return out;
}

// the videos of slide that the show plays at their step, i.e. of the style play or with
// data-autoplay in a fragment, for a preview of the Steps pane or of the toolbar. update starts each
// video that shown gives from its start, as src/video.ts starts it, and pauses and rewinds it to its
// poster when its step is undone. stop rewinds every video started. the tycho viewers of the style
// play are started and held by stepViewers of the theme. they are held from the start, so that each
// preview starts them anew, and played again at the stop, as the editor shows a kiosk viewer
export function stepVideos(slide: Element): { update(shown: (v: Element) => boolean): void; stop(): void } {
  const videos = [...slide.querySelectorAll('video')].filter((v) => v.closest('section') === slide && !!v.closest('.fragment') && (v.hasAttribute('data-autoplay') || !!v.closest('.fragment.play')));
  const started = new Set<HTMLVideoElement>();
  stepViewers(slide, () => false);
  const rewind = (v: HTMLVideoElement) => {
    started.delete(v);
    v.pause();
    v.load();
  };
  return {
    update: (shown) => {
      for (const v of videos) {
        const on = shown(v);
        if (on && !started.has(v) && v.getClientRects().length) {
          started.add(v);
          v.currentTime = 0;
          void v.play().catch(() => {});
        } else if (!on && started.has(v)) rewind(v);
      }
      stepViewers(slide, shown);
    },
    stop: () => {
      for (const v of [...started]) rewind(v);
      stepViewers(slide, () => true);
    },
  };
}

// the seconds of a step of a preview, and of the last frame, in which every element is restored
const STEP_MS = 800;
const END_MS = 700;
// the widest ghost of a dragged row, in CSS px
const GHOST_WIDTH = 240;

type Row = { el: Element; i: number; row: HTMLElement; chip: HTMLButtonElement };
type Head = { list: Element; head: HTMLElement; chip: HTMLButtonElement; run: Run };
// the facts of a row that the fields under the rows show
type Facts = { el: Element; stepped: boolean; start: StartKind | null; delay: number | null; effect: { id: Effect | null; label: string }; final: boolean };

export class Steps {
  readonly pane = make('div', 'beeson-edit-side');
  readonly badges = make('div', 'beeson-badges');
  readonly button = make('button', '', 'Steps');
  // the place of the transition of the slide at the head of the pane, filled by review/animate.ts
  readonly slot = make('div', 'slot');
  private readonly list = make('div', 'rows');
  private readonly detail = make('div', 'detail off');
  private readonly play = make('button', 'play');
  private readonly each = make('button', '', 'One by one');
  private readonly none = make('button', '', 'All at once');
  private readonly ctx: Ctx;
  private app: App | null = null;
  private on = false;
  // what the rows show, so that they are built again only when it changes, since a menu that is
  // open on a chip would be lost
  private key = '';
  // a number for each element of a row in the key, since the twin of a pair has the same words
  private readonly ids = new WeakMap<Element, number>();
  private lastId = 0;
  private idOf(el: Element): number {
    if (!this.ids.has(el)) this.ids.set(el, ++this.lastId);
    return this.ids.get(el) as number;
  }
  private rows: Row[] = [];
  private heads: Head[] = [];
  private model: Model | null = null;
  // the row last chosen by a press or a key, from which Play From plays while it is selected
  private current: Row | null = null;
  private start: HTMLButtonElement | null = null;
  private effect: HTMLButtonElement | null = null;
  private final: HTMLInputElement | null = null;
  private delay: ReturnType<typeof numberField> | null = null;
  // the preview that is played, which stop ends on the last layer of the slide
  private playing: { stop(): void; done: Promise<void> } | null = null;
  // the row that a drag has started from, and the step that it is dropped into
  private dragging = false;

  constructor(ctx: Ctx) {
    injectStyle('steps', CSS);
    this.ctx = ctx;
    this.badges.className = 'beeson-badges';
    this.button.title = 'Show the order in which the elements of the slide appear';
    this.button.setAttribute('aria-pressed', 'false');
    this.button.addEventListener('click', () => this.toggle());
    const head = make('div', 'head');
    this.play.type = 'button';
    this.play.setAttribute('aria-pressed', 'false');
    this.each.type = 'button';
    this.each.title = 'Show every element of the slide in a step of its own, in reading order';
    this.none.type = 'button';
    this.none.title = 'Show every element with the slide';
    this.setPlaying(false);
    head.append(this.play, this.each, this.none);
    this.list.setAttribute('role', 'group');
    this.list.setAttribute('aria-label', 'Steps of the slide');
    const foot = make('p', 'foot', 'Drag a row to change when it appears. The rows of a card appear together, at one click.');
    this.pane.append(this.slot, head, this.list, this.detail, foot);
    this.list.addEventListener('keydown', (ev) => this.key_(ev));
  }

  // the commands of commands/steps.ts, given the app at their install
  attach(app: App): void {
    this.app = app;
    const run = (id: string) => () => void app.commands.run(id).catch((e) => app.fail(e));
    this.play.addEventListener('click', (ev) => {
      if (ev.detail > 0) this.play.blur();
      run(!this.playing && this.selectedStep() !== null ? 'steps.playFrom' : 'steps.preview')();
    });
    this.each.addEventListener('click', run('steps.oneByOne'));
    this.none.addEventListener('click', run('steps.allAtOnce'));
    const field = (label: string, el: HTMLElement) => this.detail.append(make('span', '', label), el);
    this.start = chromeSelect(app, {
      label: 'Start of the step',
      choices: () => STARTS.map(([value, label]) => ({ value, label })),
      value: () => this.selected()?.start ?? 'click',
      text: () => STARTS.find(([v]) => v === this.selected()?.start)?.[1] ?? '—',
      onChange: (v) => this.runOn('steps.start', { start: v }),
    });
    // the delay of After Previous in seconds, with the stepper of the number fields of the Arrange
    // pane in steps of 0.1 s, as the Delay of the Timing of PowerPoint and of Build Order in Keynote.
    // a value is committed with Return, at a blur, or by the stepper, into each selected row that
    // starts After Previous. the field is empty while these rows differ
    const after = () => this.picked().filter((s) => s.start === 'after' && !s.final);
    const shared = () => {
      const ms = new Set(after().map((s) => s.delay));
      return ms.size === 1 ? [...ms][0] : null;
    };
    const delay = numberField(app, {
      label: 'Delay',
      unit: 's',
      step: 0.1,
      min: MIN_DELAY / 1000,
      max: 600,
      value: () => {
        const ms = shared();
        return ms === null ? null : ms / 1000;
      },
      enabled: () => after().length > 0,
      commit: (v) => {
        if (after().some((s) => Math.round(v * 1000) !== s.delay)) this.runOn('steps.delay', { delay: v });
      },
    });
    delay.input.classList.add('delay');
    delay.input.setAttribute('aria-label', 'Delay after the step before, in seconds');
    this.delay = delay;
    const delayBox = make('span', 'delay-box');
    delayBox.append(delay.el);
    this.effect = chromeSelect(app, {
      label: 'Effect of the step',
      choices: () => effectsFor(this.selected()?.el).map(([value, label]) => ({ value, label })),
      value: () => (this.selected()?.stepped ? (this.selected()?.effect.id ?? '') : ''),
      text: () => (this.selected()?.stepped ? (this.selected()?.effect.label ?? '') : '—'),
      onChange: (v) => this.runOn('steps.effect', { effect: v }),
    });
    const final = make('input');
    final.type = 'checkbox';
    final.addEventListener('change', () => this.runOn('steps.final', { on: final.checked }));
    this.final = final;
    const label = make('label');
    label.title = 'Show the element after every other step of the slide, as data-final does';
    label.append(final, document.createTextNode('Show last, after every step'));
    field('Start', this.start);
    field('Delay', delayBox);
    field('Effect', this.effect);
    this.detail.append(label);
    app.listen('slide', () => this.stop());
    app.selection.listen(() => this.mark());
    // a flip of the mode shows the other twin of a dark and light pair, to which the rows are bound
    new MutationObserver(() => this.refresh()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  toggle(): void {
    this.on = document.documentElement.classList.toggle('beeson-steps');
    this.button.classList.toggle('on', this.on);
    this.button.setAttribute('aria-pressed', String(this.on));
    if (!this.on) this.stop();
    this.ctx.layout();
    this.refresh();
  }

  get shown(): boolean {
    return this.on;
  }

  // the numbers on the slide follow its layout, and the rows are built again when the slide or
  // its steps change
  refresh(): void {
    this.badges.replaceChildren();
    const app = this.app;
    const m = this.on && app ? modelOf(app, this.ctx.slide()) : null;
    this.model = m;
    if (!m || !app) {
      this.key = '';
      this.rows = [];
      this.list.replaceChildren();
      this.syncDetail();
      return;
    }
    const { els, items, plan } = m;
    const at = (i: number) => stepAt(plan, i);
    if (!this.playing) {
      els.forEach((el, i) => {
        // an element of another layer of the slide is hidden, and so is its number
        if (at(i) < 0 || el.closest(`.${OFF}`)) return;
        // the number of a pair is drawn at the image of the mode shown
        const twin = m.twins?.get(el);
        const shown = twin && !el.getClientRects().length ? twin : el;
        let rect = shown.getBoundingClientRect();
        if (!rect.width && !rect.height) return;
        // the number of a line step is drawn at the left edge of the box, level with its first line
        const line = m.lines[i];
        if (line) {
          const first = lineRect(line.code, Math.min(...linesOf(line.lines)));
          if (!first) return;
          const box = line.code.closest('pre')?.getBoundingClientRect() ?? rect;
          rect = new DOMRect(box.left, first.top + first.height / 2, 0, 0);
        }
        const badge = make('span', 'beeson-badge', String(at(i) + 1));
        badge.style.left = `${rect.left}px`;
        badge.style.top = `${rect.top}px`;
        (badge as HTMLElement & { owner?: Element }).owner = shown;
        this.badges.append(badge);
      });
    }
    const described = els.map((el, i) => (m.lines[i] ? describeLines(m.lines[i] as LineStep) : describe(el, this.ctx.tex)));
    const effects = els.map((el, i) => (m.lines[i] ? 'Highlight' : effectOf(classesOf(app, el)).label));
    const delays = delaysOf(app, m);
    const key = [app.pairing?.sections.findIndex((s) => s.live === m.slide), JSON.stringify(plan), JSON.stringify([...delays]), ...els.map((el, i) => `${this.idOf(el)}|${described[i].kind}|${described[i].text}|${effects[i]}|${items[i].final}`)].join('\n');
    if (key !== this.key) {
      this.key = key;
      this.build(m, described, effects, delays);
    }
    this.mark();
  }

  private build(m: Model, described: { kind: string; text: string }[], effects: string[], delays: Map<number, number>): void {
    const { els, plan } = m;
    const app = this.app as App;
    const open = document.activeElement instanceof HTMLElement && this.list.contains(document.activeElement) ? this.rows.find((r) => r.row === document.activeElement || r.chip === document.activeElement)?.el : null;
    this.rows = [];
    this.heads = [];
    this.list.replaceChildren();
    this.list.classList.remove('wide');
    if (!els.length) {
      this.list.append(make('div', 'card empty', 'This slide has no element that can be a step.'));
      return;
    }
    const G = plan.groups.length;
    const row = (i: number, step: number) => {
      const el = els[i];
      const { start, delay } = startAt(app, m, i, delays);
      const { kind, text } = described[i];
      const final = plan.finals.includes(i);
      const line = m.lines[i];
      const locked = m.locked[i] && !line;
      const r = make('div', `row${start === 'with' ? ' with' : ''}${step < 0 ? ' slide' : ''}${locked ? ' locked' : ''}${line ? ' line' : ''}`);
      r.tabIndex = -1;
      r.dataset.doc = String(i);
      r.dataset.step = step < 0 ? '' : String(step);
      const chip = make('button', 'chip');
      chip.type = 'button';
      chip.tabIndex = -1;
      chip.setAttribute('aria-haspopup', 'menu');
      chip.setAttribute('aria-expanded', 'false');
      chip.setAttribute('aria-label', `Step of the ${kind.toLowerCase()}${text ? `: ${text}` : ''}`);
      const how = step < 0 ? 'With the slide' : [final ? 'Last' : startLabel(start, delay), effects[i]].join(' · ');
      chip.title = line ? `Step ${step + 1}, the ${kind.toLowerCase()} of the code box, set in its Code pane. Click to play the steps from it` : locked ? `Step ${step + 1}, set in the text of its block` : step < 0 ? 'Shown with the slide. Click to choose a step' : `Step ${step + 1}, ${final ? 'last' : startLabel(start, delay)}. Click to change its step, start, or effect`;
      chip.disabled = locked;
      // the start is marked in the chip as in the Animation Pane of PowerPoint: a number at a click,
      // a plus with the step before, and a clock after it
      const mark = step < 0 || final ? null : start === 'with' ? startGlyph('with') : start === 'after' ? startGlyph('after') : null;
      if (mark) chip.append(mark);
      chip.dataset.start = step < 0 ? '' : final ? 'last' : (start ?? '');
      chip.append(step < 0 ? '–' : final ? 'Last' : String(step + 1), icon('chevron-down', 9));
      // a chip with a start mark or Last widens the chip column of every row, to keep the texts aligned
      if (final || mark) {
        chip.style.width = '44px';
        this.list.classList.add('wide');
      }
      const meta = make('span', 'meta');
      meta.append(make('span', 'kind', kind), ` · ${how}`);
      const body = make('span', 'body');
      body.append(fullText(text), meta);
      const handle = make('span', 'grip');
      handle.append(grip());
      r.append(handle, chip, body);
      r.setAttribute('aria-label', `${step < 0 ? 'With the slide' : final ? 'Last step' : `Step ${step + 1}`}, ${kind}${text ? `: ${text}` : ''}`);
      // a line step points at its box, and dims the other lines of the box as the Code pane does
      const target = line ? (line.code.closest('pre') ?? el) : el;
      r.addEventListener('pointerenter', () => {
        if (this.dragging) return;
        target.classList.add('beeson-hover');
        if (line && !this.playing) dimLines(line.code, line.lines);
      });
      r.addEventListener('pointerleave', () => {
        target.classList.remove('beeson-hover');
        if (line && !this.playing) dimLines(null, null);
      });
      if (!locked) r.addEventListener('pointerdown', (ev) => this.press(ev, entry));
      chip.addEventListener('click', (ev) => {
        if (ev.detail === 0) this.openChip(entry, true);
      });
      const entry: Row = { el, i, row: r, chip };
      this.rows.push(entry);
      return r;
    };
    const cards: HTMLElement[] = [];
    const runs = new Map(runsOf(m).map((r) => [r.from, r]));
    const inner = new Set([...runs.values()].flatMap((r) => r.items.slice(1).map((_, j) => r.from + 1 + j)));
    plan.groups.forEach((g, k) => {
      if (inner.has(k)) return;
      const run = runs.get(k);
      const card = make('div', `card step${run ? ' list' : ''}`);
      card.dataset.gap = String(k);
      card.setAttribute('role', 'group');
      const n = run ? run.items.length : 1;
      card.setAttribute('aria-label', n > 1 ? `Steps ${k + 1} to ${k + n}` : `Step ${k + 1}`);
      const others = [...g].filter((i) => !run?.items.includes(i)).sort((a, b) => a - b);
      for (const i of others.filter((i) => !run || i < run.items[0])) card.append(row(i, k));
      if (run) {
        card.append(this.head(run, described));
        run.items.forEach((i, j) => card.append(row(i, k + j)));
        for (const r of this.rows.slice(-run.items.length)) r.row.classList.add('nested');
      }
      for (const i of others.filter((i) => run && i > run.items[0])) card.append(row(i, k));
      cards.push(card);
    });
    plan.finals.forEach((i, f) => {
      const card = make('div', 'card step final');
      card.dataset.gap = String(G);
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', 'Last step');
      card.append(row(i, G + f));
      cards.push(card);
    });
    if (!cards.length) cards.push(make('div', 'card empty step', 'No element of this slide is a step. Choose a step in the menu of a row, or drag a row here.'));
    this.list.append(...cards);
    const rest = els.map((_, i) => i).filter((i) => stepAt(plan, i) < 0);
    if (rest.length) {
      const zone = make('div', 'slide-zone');
      const head = make('div', 'section');
      head.append(make('span', '', 'With the slide'), make('span', '', String(rest.length)));
      const card = make('div', 'card plain');
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', 'With the slide');
      for (const i of rest) card.append(row(i, -1));
      zone.append(head, card);
      this.list.append(zone);
    }
    const back = open ? this.rows.find((r) => r.el === open) : null;
    if (back) back.row.focus({ preventScroll: true });
    const was = this.current;
    this.current = was ? (this.rows.find((r) => r.i === was.i && r.el === was.el) ?? null) : null;
  }

  // the row of a list delivered by item, above its items. a press selects the list, and its chip
  // opens the menu of its delivery
  private head(run: Run, described: { kind: string; text: string }[]): HTMLElement {
    const app = this.app as App;
    const n = run.items.length;
    const steps = `${run.from + 1}–${run.from + n}`;
    const head = make('div', 'list-head');
    const chip = make('button', 'chip');
    chip.type = 'button';
    chip.tabIndex = -1;
    chip.setAttribute('aria-haspopup', 'menu');
    chip.setAttribute('aria-expanded', 'false');
    chip.setAttribute('aria-label', `Delivery of the list, steps ${run.from + 1} to ${run.from + n}`);
    chip.title = `Steps ${run.from + 1} to ${run.from + n}, item by item. Click to change the delivery of the list`;
    chip.append(steps, icon('chevron-down', 9));
    const meta = make('span', 'meta');
    meta.append(make('span', 'kind', 'List'), ` · Item by item · ${n} steps`);
    const body = make('span', 'body');
    body.append(fullText(described[run.items[0]].text), meta);
    head.append(make('span', 'grip'), chip, body);
    head.setAttribute('aria-label', `List, item by item, steps ${run.from + 1} to ${run.from + n}`);
    const entry: Head = { list: run.list, head, chip, run };
    head.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      const onChip = ev.target instanceof Element && !!ev.target.closest('.chip');
      if (onChip && menuOpen() && chip.getAttribute('aria-expanded') === 'true') {
        closeMenus();
        return;
      }
      app.selection.set('elements', [run.list]);
      if (onChip) this.openDelivery(entry, false);
    });
    chip.addEventListener('click', (ev) => {
      if (ev.detail === 0) this.openDelivery(entry, true);
    });
    head.addEventListener('pointerenter', () => !this.dragging && run.list.classList.add('beeson-hover'));
    head.addEventListener('pointerleave', () => run.list.classList.remove('beeson-hover'));
    this.heads.push(entry);
    return head;
  }

  // the items of the delivery of the list of an element, for the menu of its chip
  private deliveryItems(el: Element): MenuItem[] {
    const app = this.app as App;
    const list = listOf(el);
    if (!list || !app.pairing?.elements.get(list)?.open) return [];
    const now = deliveryOf(app, list);
    const run = (by: Delivery | null) => () => void app.commands.run('steps.deliver', { el: list, by }).catch((e) => app.fail(e));
    return DELIVERIES.map(([by, label]): MenuItem => ({ label, checked: now === by, run: run(by) }));
  }

  private openDelivery(h: Head, keyboard: boolean): void {
    const app = this.app as App;
    const run = () => void app.commands.run('steps.deliver', { el: h.list, by: null }).catch((e) => app.fail(e));
    const items: MenuItem[] = [...this.deliveryItems(h.list), { rule: true }, { label: 'With the Slide', run }];
    const menu = openMenu(app, items, { anchor: rowAnchor(h.chip, h.head), placement: 'below', owner: h.chip, keyboard, label: 'Delivery', className: 'select steps' }).el;
    popover(menu, h.head, true);
    if (!keyboard) follow(menu, h.head);
  }

  // the rows of the selected elements are marked, and so are their numbers on the slide
  private mark(): void {
    const app = this.app;
    if (!app) return;
    const sel = app.selection;
    const items = sel.kind === 'elements' || sel.kind === 'text' ? sel.items : [];
    // the row of a pair is bound to the twin shown, and the selection may hold the other one after
    // a flip of the mode
    const twins = this.model?.twins;
    const hit = (el: Element) => [el, twins?.get(el)].some((e) => e && items.some((s) => s === e || s.contains(e) || e.contains(s)));
    const lines = this.model?.lines ?? [];
    // a line row is marked while it is the row last chosen and its box is selected, in place of the
    // row of the box
    const cur = this.current && lines[this.current.i] && hit(this.current.el) ? this.current : null;
    let first: Row | null = null;
    for (const r of this.rows) {
      const on = lines[r.i] ? r === cur : hit(r.el) && !(cur && cur.el.parentElement === r.el);
      r.row.classList.toggle('selected', on);
      r.row.setAttribute('aria-selected', String(on));
      if (on && !first) first = r;
    }
    for (const h of this.heads) h.head.classList.toggle('selected', items.includes(h.list));
    for (const b of this.badges.children) b.classList.toggle('on', hit((b as HTMLElement & { owner?: Element }).owner as Element));
    if (first && !this.dragging) first.row.scrollIntoView({ block: 'nearest' });
    for (const r of this.rows) r.row.tabIndex = r === (first ?? this.rows[0]) ? 0 : -1;
    this.syncDetail();
  }

  // the facts of the first selected row, for the fields under the rows
  private selected(): Facts | null {
    return this.picked()[0] ?? null;
  }

  // the facts of each selected row, apart from the rows of lines
  private picked(): Facts[] {
    const m = this.model;
    const app = this.app;
    if (!m || !app) return [];
    return this.rows.filter((r) => r.row.classList.contains('selected') && !m.lines[r.i]).map((r) => {
      const { start, delay } = startAt(app, m, r.i);
      return { el: r.el, stepped: stepAt(m.plan, r.i) >= 0, start, delay, effect: effectOf(classesOf(app, r.el)), final: m.plan.finals.includes(r.i) };
    });
  }

  private syncDetail(): void {
    const s = this.selected();
    this.detail.classList.toggle('off', !s);
    if (this.start) {
      this.start.disabled = !s?.stepped || s.final;
      (this.start as HTMLButtonElement & { refresh(): void }).refresh();
    }
    this.delay?.sync();
    if (this.delay) this.delay.input.placeholder = new Set(this.picked().filter((r) => r.start === 'after' && !r.final).map((r) => r.delay)).size > 1 ? 'Multiple' : '';
    if (this.effect) {
      // an effect chosen for an element shown with the slide makes it the last step
      this.effect.disabled = !s;
      (this.effect as HTMLButtonElement & { refresh(): void }).refresh();
    }
    if (this.final) {
      this.final.disabled = !s;
      this.final.checked = !!s?.final;
    }
    const m = this.model;
    const steps = m ? m.plan.groups.length + m.plan.finals.length : 0;
    this.play.disabled = !this.playing && !steps;
    this.setPlaying(!!this.playing);
    this.each.disabled = !m?.els.length;
    this.none.disabled = !steps;
  }

  // with several rows selected, a command of the fields acts on each of their elements
  private runOn(id: string, arg: Record<string, unknown>): void {
    const s = this.selected();
    const app = this.app;
    if (s && app) void app.commands.run(id, this.several() ? arg : { el: s.el, ...arg }).catch((e) => app.fail(e));
  }

  private several(): boolean {
    return this.rows.filter((r) => r.row.classList.contains('selected') && !this.model?.lines[r.i]).length > 1;
  }

  private select(r: Row): void {
    this.current = r;
    const line = this.model?.lines[r.i];
    this.app?.selection.set('elements', [line ? (r.el.parentElement as Element) : r.el]);
  }

  // the step of the row last chosen, 0 for the first, while it is marked, or null
  selectedStep(): number | null {
    const m = this.model;
    if (!this.on || !m) return null;
    const r = this.current?.row.classList.contains('selected') ? this.current : this.rows.find((r) => r.row.classList.contains('selected'));
    const k = r ? stepAt(m.plan, r.i) : -1;
    return k >= 0 ? k : null;
  }

  // the menu of a chip: the steps of the slide, two new steps, the start, the effect, and Show Last
  private openChip(r: Row, keyboard: boolean): void {
    const app = this.app;
    const m = this.model;
    if (!app || !m) return;
    // the menu of a row among several selected rows acts on each of them
    const many = this.several() && r.row.classList.contains('selected') && !m.lines[r.i];
    if (!many) this.select(r);
    const { plan } = m;
    const at = stepAt(plan, r.i);
    // Play From plays the steps of the slide from this one, as in the Animation Pane of PowerPoint
    const play: MenuItem = { label: at < 0 ? 'Play From Step' : `Play From Step ${at + 1}`, disabled: at < 0, run: () => void app.commands.run('steps.playFrom', { step: at }).catch((e) => app.fail(e)) };
    if (m.lines[r.i]) {
      // a line step is set in the Code pane of its box, hence its menu only plays it
      const menu = openMenu(app, [play], { anchor: rowAnchor(r.chip, r.row), placement: 'below', owner: r.chip, keyboard, label: 'Step', className: 'select steps' }).el;
      popover(menu, r.row);
      if (!keyboard) follow(menu, r.row);
      return;
    }
    const final = plan.finals.includes(r.i);
    const { start } = startAt(app, m, r.i);
    const effect = effectOf(classesOf(app, r.el)).id;
    const first = at === 0 && start === 'click';
    const run = (id: string, arg: Record<string, unknown>) => () => void app.commands.run(id, many ? arg : { el: r.el, ...arg }).catch((e) => app.fail(e));
    const items: MenuItem[] = [
      { label: 'With the Slide', checked: at < 0, run: run('steps.set', { to: null }) },
      ...plan.groups.map((_, k): MenuItem => ({ label: `Step ${k + 1}`, checked: at === k, run: run('steps.set', { to: k }) })),
      { label: 'New Step at Start', run: run('steps.set', { to: 'first' }) },
      { label: 'New Step at End', run: run('steps.set', { to: 'last' }) },
      { rule: true },
      { label: 'On Click', checked: start === 'click', disabled: at < 0 || final, run: run('steps.start', { start: 'click' }) },
      { label: 'With Previous', checked: start === 'with', disabled: at < 0 || final || first, run: run('steps.start', { start: 'with' }) },
      { label: 'After Previous', checked: start === 'after', disabled: at < 0 || final || first || !afterable(m, r.i), run: run('steps.start', { start: 'after' }) },
      { rule: true },
      ...effectsFor(r.el).map(([id, label]): MenuItem => ({ label, checked: at >= 0 && effect === id, run: run('steps.effect', { effect: id }) })),
      { rule: true },
      { label: 'Show Last', checked: final, run: run('steps.final', { on: !final }) },
      { rule: true },
      play,
    ];
    const delivery = this.deliveryItems(r.el);
    if (delivery.length) items.push({ rule: true }, ...delivery);
    const menu = openMenu(app, items, { anchor: rowAnchor(r.chip, r.row), placement: 'below', owner: r.chip, keyboard, label: 'Step', className: 'select steps' }).el;
    popover(menu, r.row);
    if (!keyboard) follow(menu, r.row);
  }

  // a press on a row selects its element. a press on its chip opens the menu of the chip, and a
  // press elsewhere that is moved by 4 px drags the row to another place in the order. with Shift,
  // the element is added to the selection, and with ⌘ (Ctrl) it is added or taken off, as in the
  // Animation Pane of PowerPoint
  private press(ev: PointerEvent, r: Row): void {
    if (ev.button !== 0 || !this.app || !this.model) return;
    ev.preventDefault();
    const onChip = ev.target instanceof Element && !!ev.target.closest('.chip');
    if (onChip && menuOpen() && r.chip.getAttribute('aria-expanded') === 'true') {
      closeMenus();
      return;
    }
    r.row.focus({ preventScroll: true });
    if (onChip) {
      this.openChip(r, false);
      return;
    }
    if ((ev.shiftKey || (this.app.platform === 'mac' ? ev.metaKey : ev.ctrlKey)) && !this.model.lines[r.i]) {
      const sel = this.app.selection;
      // the row of a pair is bound to the twin shown, and the selection may hold the other one
      const twin = this.model.twins?.get(r.el);
      const held = twin && sel.items.includes(twin) && !sel.items.includes(r.el) ? twin : r.el;
      if (!ev.shiftKey) sel.toggle(held);
      else if (!sel.items.includes(held)) sel.add(r.el);
      this.current = r;
      return;
    }
    this.select(r);
    if (!this.model.lines[r.i]) this.drag(ev, r);
  }

  private drag(ev: PointerEvent, r: Row): void {
    const app = this.app as App;
    const m = this.model as Model;
    const x0 = ev.clientX;
    const y0 = ev.clientY;
    const box = r.row.getBoundingClientRect();
    let ghost: HTMLElement | null = null;
    let line: HTMLElement | null = null;
    let target: number | null | undefined;
    const end = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('keydown', esc, true);
      ghost?.remove();
      line?.remove();
      r.row.classList.remove('dragging');
      this.list.querySelector('.slide-zone')?.classList.remove('drop');
      document.documentElement.classList.remove('beeson-dragging-step');
      this.dragging = false;
    };
    const move = (e: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(e.clientX - x0, e.clientY - y0) < 4) return;
        this.dragging = true;
        r.el.classList.remove('beeson-hover');
        ghost = make('div', 'beeson-steps-ghost');
        ghost.append(...[...r.row.children].map((c) => c.cloneNode(true)));
        ghost.style.width = `${Math.min(box.width, GHOST_WIDTH)}px`;
        document.body.append(ghost);
        line = make('div', 'drop-line');
        line.hidden = true;
        this.list.append(line);
        r.row.classList.add('dragging');
        document.documentElement.classList.add('beeson-dragging-step');
      }
      // the ghost is held at the left of the list, centered on the pointer, so that the drop line
      // and the rows on either side of it stay in view, as in the Animation Pane of PowerPoint. in
      // a window without room at the left, it is put under the pointer
      const lr = this.list.getBoundingClientRect();
      const left = lr.left - ghost.offsetWidth - 12;
      ghost.style.left = `${left >= 4 ? left : e.clientX + 16}px`;
      ghost.style.top = `${left >= 4 ? e.clientY - ghost.offsetHeight / 2 : e.clientY + 18}px`;
      if (e.clientY < lr.top + 24) this.list.scrollTop -= 8;
      else if (e.clientY > lr.bottom - 24) this.list.scrollTop += 8;
      target = this.dropAt(e.clientY, r, m, line as HTMLElement);
    };
    const up = () => {
      const dropped = ghost ? target : undefined;
      end();
      if (dropped !== undefined) void app.commands.run('steps.move', { el: r.el, gap: dropped }).catch((e) => app.fail(e));
    };
    const cancel = () => end();
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      end();
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('keydown', esc, true);
  }

  // the gap of the plan nearest to y, drawn as a line between the cards, or null over the
  // elements shown with the slide. undefined is a drop that does not change the order
  private dropAt(y: number, r: Row, m: Model, line: HTMLElement): number | null | undefined {
    const zone = this.list.querySelector('.slide-zone');
    const lr = this.list.getBoundingClientRect();
    const cards = [...this.list.querySelectorAll<HTMLElement>('.card.step')];
    const zr = zone?.getBoundingClientRect();
    const lastBottom = cards.length ? cards[cards.length - 1].getBoundingClientRect().bottom : lr.top;
    const overZone = !!zr && y > Math.max(zr.top - 4, lastBottom + 6);
    zone?.classList.toggle('drop', overZone);
    if (overZone) {
      line.hidden = true;
      return stepAt(m.plan, r.i) < 0 ? undefined : null;
    }
    // the edges between the cards, each the gap of the card after it
    const edges: { y: number; gap: number }[] = [];
    cards.forEach((c, k) => {
      const b = c.getBoundingClientRect();
      const before = k ? cards[k - 1].getBoundingClientRect().bottom : b.top - 6;
      edges.push({ y: (before + b.top) / 2, gap: Number(c.dataset.gap ?? 0) });
      if (k === cards.length - 1) edges.push({ y: b.bottom + 3, gap: m.plan.groups.length });
    });
    if (!edges.length) return undefined;
    const best = edges.reduce((a, b) => (Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a));
    line.hidden = false;
    line.style.top = `${best.y - lr.top + this.list.scrollTop}px`;
    if (m.plan.finals.includes(r.i) && best.gap >= m.plan.groups.length) return undefined;
    return best.gap;
  }

  // the arrow keys move between the rows, Return or Space opens the menu of the chip, and Delete
  // puts the element back with the slide
  private key_(ev: KeyboardEvent): void {
    const i = this.rows.findIndex((r) => r.row === document.activeElement);
    if (i < 0 || ev.altKey || ev.metaKey || ev.ctrlKey) return;
    const go = (to: number) => {
      const r = this.rows[Math.max(0, Math.min(this.rows.length - 1, to))];
      r.row.focus();
      this.select(r);
    };
    if (ev.key === 'ArrowDown') go(i + 1);
    else if (ev.key === 'ArrowUp') go(i - 1);
    else if (ev.key === 'Home') go(0);
    else if (ev.key === 'End') go(this.rows.length - 1);
    else if (ev.key === 'Enter' || ev.key === ' ') this.openChip(this.rows[i], true);
    else if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (!this.model?.lines[this.rows[i].i]) this.runOn('steps.set', { to: null });
    }
    else return;
    ev.preventDefault();
    ev.stopPropagation();
  }

  // the button reads Play From while a row of a step is chosen, as Play From and Play All in the
  // Animation Pane of PowerPoint
  private setPlaying(on: boolean): void {
    const from = on ? null : this.selectedStep();
    const label = on ? 'Stop' : from !== null ? 'Play From' : 'Preview Steps';
    if (this.play.textContent === label) return;
    this.play.replaceChildren(icon(on ? 'square' : 'play', 12), label);
    this.play.setAttribute('aria-pressed', String(on));
    this.play.title = on ? 'Stop the preview' : from !== null ? `Play the steps of the slide in place from step ${from + 1}` : 'Play the steps of the slide in place, and end on its last layer';
  }

  get previewing(): boolean {
    return !!this.playing;
  }

  // the steps of the current slide are played in place, with the effect of each fragment, from
  // the slide shown up to step from, 0 for the slide without its steps, to its last step, after
  // which every fragment is restored. the editor then shows the last layer of the slide. a second
  // call stops the preview
  preview(from = 0): Promise<void> {
    if (this.playing) {
      this.stop();
      return Promise.resolve();
    }
    const slide = this.ctx.slide();
    if (!slide) return Promise.resolve();
    // the steps are read from the model of the slide, which has the line steps of its code boxes,
    // or from its fragments where the model does not have them all
    const raw = fragmentsOf(slide);
    const m = this.app ? modelOf(this.app, slide) : null;
    const at = raw.map((f) => {
      const i = m ? indexIn(m, f.el) : -1;
      return m && i >= 0 && stepAt(m.plan, i) >= 0 ? stepAt(m.plan, i) + 1 : null;
    });
    const byModel = !!m && at.every((k) => k !== null);
    const frags = byModel ? raw.map((f, j) => ({ ...f, step: at[j] as number })) : raw;
    const lines = byModel && m ? m.lines.flatMap((l, i) => (l ? [{ ...l, step: stepAt(m.plan, i) + 1 }] : [])) : [];
    if (!frags.length && !lines.length) return Promise.resolve();
    const html = document.documentElement;
    const last = Math.max(...frags.map((f) => f.step), ...lines.map((l) => l.step));
    const first = Math.max(0, Math.min(from, last - 1));
    // the lines of a box are dimmed but for its last group reached, or its first group before
    const dim = (k: number) => {
      const reached = lines.filter((l) => l.step <= k);
      const l = reached.length ? reached.reduce((a, b) => (b.step > a.step ? b : a)) : lines[0];
      if (!l) return;
      dimLines(l.code, reached.length ? l.lines : (stepsOf(this.app as App, l.code).groups[0] ?? null));
    };
    const timers: number[] = [];
    const videos = stepVideos(slide);
    let finish = () => {};
    const done = new Promise<void>((resolve) => {
      finish = () => {
        timers.forEach(clearTimeout);
        videos.stop();
        for (const f of frags) f.el.classList.remove('beeson-pv-off', 'beeson-pv-dim', 'beeson-pv-ghost');
        if (lines.length) dimLines(null, null);
        html.classList.remove('beeson-previewing');
        if (this.app) setPreview(this.app, 'steps', false);
        this.playing = null;
        this.setPlaying(false);
        window.removeEventListener('keydown', esc, true);
        (this.app?.layers as Layers | undefined)?.showLast();
        this.app?.invalidate('slide');
        resolve();
      };
    });
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      finish();
    };
    // a fragment inside another one is dimmed with it, and a fragment with data-keep is held at
    // full opacity through the next step, or through the step of the index of its number, as the
    // theme does with the indexes of the page in src/steps.ts
    const nested = (el: Element) => !!el.parentElement?.closest('.fragment');
    const stepOf = new Map(frags.map((f) => [fragmentIndex(f.el)?.trim(), f.step]));
    const held = (f: { el: Element; step: number }, k: number) => {
      const keep = f.el.getAttribute('data-keep');
      if (keep === null) return false;
      return /^\s*\d+\s*$/.test(keep) ? k <= (stepOf.get(keep.trim()) ?? Number(keep)) : k <= f.step + 1;
    };
    const frame = (k: number, restored = false) => {
      for (const f of frags) {
        // a dimmed step is seen from the start, and a ghost keeps its opacity of the theme. a video
        // of the style play shows its poster from the start, and a video is not dimmed, as in the
        // show
        const dims = f.el.classList.contains('semi-fade-out');
        const shown = dims || f.el.classList.contains('play') || shownAt(f, k);
        f.el.classList.toggle('beeson-pv-off', !shown);
        f.el.classList.toggle('beeson-pv-dim', shown && !dims && !restored && f.kind === 'in' && f.step < k && !nested(f.el) && !held(f, k) && !f.el.matches('.ghost, video, :has(video)'));
        f.el.classList.toggle('beeson-pv-ghost', dims && f.step <= k);
      }
      if (restored) {
        if (lines.length) dimLines(null, null);
      } else dim(k);
      videos.update((v) => frags.every((f) => !f.el.contains(v) || shownAt(f, k)));
      html.dataset.previewStep = String(k);
    };
    showLayer(slide, null);
    html.classList.add('beeson-previewing');
    if (this.app) setPreview(this.app, 'steps', true, () => finish());
    this.badges.replaceChildren();
    this.setPlaying(true);
    window.addEventListener('keydown', esc, true);
    frame(first);
    // a step after a step with data-autoslide is played at its delay, as reveal.js plays it
    const delayAfter = (k: number) => {
      const ms = frags.filter((f) => f.step === k).map((f) => Number.parseInt(f.el.getAttribute(AUTOSLIDE) ?? '', 10)).find((v) => v > 0);
      return ms ?? STEP_MS;
    };
    let t = 0;
    for (let k = first + 1; k <= last; k++) {
      t += k > first + 1 ? delayAfter(k - 1) : STEP_MS;
      timers.push(window.setTimeout(() => frame(k), t));
    }
    timers.push(window.setTimeout(() => frame(last, true), t + STEP_MS));
    timers.push(window.setTimeout(() => finish(), t + STEP_MS + END_MS));
    this.playing = { stop: () => finish(), done };
    return done;
  }

  stop(): void {
    this.playing?.stop();
  }
}

// the arguments of the commands of a row, passed by the tab and by the tests
export type RowArg = { el: Element };

// the plan of the model of the slide of el after change, written as one change. the steps tab is
// refreshed by the change of the document
export function changePlan(app: App, el: Element, change: (plan: Plan, i: number) => Plan): boolean {
  const m = modelAt(app, el);
  if (!m) return false;
  return writePlan(app, m, change(m.plan, m.i));
}
