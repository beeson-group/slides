// the commands of the order, the groups, the locks, and the rotation of the elements, as in the
// Arrange menu of Keynote. an element is drawn over its siblings of a lower z-index, and over the
// earlier siblings of the same z-index. an element out of the flow is ordered by a move of its unit
// among its siblings, and an element in the flow by a z-index, since a move would change the layout
// of its slide. a group is the elements with the same data-group, selected and dragged together,
// and a locked element, with data-locked, is not moved by the pointer, the keys, or the fields.
// each command is one entry of the history

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { angleOf, apartOf, locked, pivotOf, placeOf, record, seenCenter, spinOf, spunEls, turn, turnMember, turnedEls, turnersOf, withTwins } from '../canvas/drag.ts';
import { LINE, MOVABLE, OUTSIDE, objectOf, objectsOf, turnable, twinOf } from '../canvas/hit.ts';
import { stateOf } from '../tags.ts';
import { groupOf, groupUsed, groupValue, groupsOf, scopeOf, setScope, within } from '../model/groups.ts';
import { attachedTo } from '../model/attach.ts';

export type Order = 'front' | 'forward' | 'backward' | 'back';

export { groupOf };

// an element placed by the flow of its parent, which a move among its siblings would move on the
// slide: an element in the flow, or an absolute one without insets on an axis, e.g. a caption of a
// content slide. the browser gives the used insets, hence they are set to auto for a moment, and
// the answer is kept for the classes and the style of the element
const flowKept = new WeakMap<Element, { sig: string; value: boolean }>();
function inFlow(el: Element): boolean {
  const s = getComputedStyle(el);
  if (s.display === 'none' || s.position === 'fixed') return false;
  if (s.position !== 'absolute' || !(el instanceof HTMLElement)) return s.position !== 'absolute';
  const sig = `${el.className} ${el.getAttribute('style')} ${el.parentElement?.className}`;
  const kept = flowKept.get(el);
  if (kept?.sig === sig) return kept.value;
  const style = el.getAttribute('style');
  const was = el.getBoundingClientRect();
  const auto = (a: string, b: string) => {
    el.style.setProperty(a, 'auto', 'important');
    el.style.setProperty(b, 'auto', 'important');
    const r = el.getBoundingClientRect();
    if (style === null) el.removeAttribute('style');
    else el.setAttribute('style', style);
    return Math.abs(r.top - was.top) < 0.5 && Math.abs(r.left - was.left) < 0.5;
  };
  const value = auto('top', 'bottom') || auto('left', 'right');
  flowKept.set(el, { sig, value });
  return value;
}

// an element drawn in a layer of its own, i.e. positioned or transformed, whose order among the
// other layers sets which of them is drawn over the other
function isLayer(el: Element): boolean {
  const s = getComputedStyle(el);
  return s.display !== 'none' && (s.position !== 'static' || s.translate !== 'none' || s.rotate !== 'none' || s.transform !== 'none');
}

// a list whose items theme/beeson.css positions, which is thus drawn with the layers of z-index 0
const listed = (el: Element): boolean => el.matches('ul, ol') && [...el.children].some((c) => getComputedStyle(c).position !== 'static');

// the elements that theme/beeson.css gives a z-index, which is their z-index without a style
const RAISED = ':is(section, .col) > table';
// the z-index that the browser applies to el, 0 for auto
const zOf = (el: Element): number => (getComputedStyle(el).position === 'static' ? 0 : parseInt(getComputedStyle(el).zIndex, 10) || 0);

// the place of an element in the order that its slide is drawn, from back to front: for each
// stacking context around it, a z-index and the path of indices of the context in the file, then
// its own z-index and path. an element in the flow is drawn under the layers of z-index 0 of its
// context, together with the content of the positioned element around it that is not a stacking
// context, its host
type Level = [number, number[]];
type Key = Level[];
function cmp(a: Key, b: Key): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const [[za, pa], [zb, pb]] = [a[i], b[i]];
    if (za !== zb) return za - zb;
    for (let j = 0; j < Math.min(pa.length, pb.length); j++) if (pa[j] !== pb[j]) return pa[j] - pb[j];
    if (pa.length !== pb.length) return pa.length - pb.length;
  }
  return a.length - b.length;
}
const under = (a: Key, b: Key): boolean => cmp(a, b) < 0;

// the indices from the slide down to el, with the children of a parent of orders in that order
type Path = (el: Element) => number[];
const pathIn = (orders: Map<Element, Element[]>): Path => (el) => {
  const out: number[] = [];
  const slide = el.closest('section');
  for (let x: Element = el; x !== slide && x.parentElement; x = x.parentElement) out.unshift((orders.get(x.parentElement) ?? [...x.parentElement.children]).indexOf(x));
  return out;
};
// pathIn, with the path of each element kept, for a page that does not change meanwhile
const keptPath = (orders: Map<Element, Element[]>): Path => {
  const path = pathIn(orders), kept = new Map<Element, number[]>();
  return (el) => kept.get(el) ?? kept.set(el, path(el)).get(el)!;
};
const filePath = pathIn(new Map());

// the stacking contexts around el inside its slide, with their z-index, and its host
type Around = { stacks: [number, Element][]; host: Element | null };
function aroundOf(el: Element): Around {
  const out: Around = { stacks: [], host: null };
  const slide = el.closest('section');
  const chain: Element[] = [];
  for (let x = el.parentElement; x && x !== slide; x = x.parentElement) chain.unshift(x);
  for (const x of chain) {
    if (stacks(x)) [out.stacks, out.host] = [[...out.stacks, [zOf(x), x]], null];
    else if (isLayer(x)) out.host = x;
  }
  return out;
}

// the key of an element of around a, positioned with the z-index z or not, or turned
function keyIn(el: Element, a: Around, path: Path, placed: boolean, z: number, turned: boolean): Key {
  const lead = a.stacks.map(([sz, x]): Level => [sz, path(x)]);
  if (placed) return [...lead, [z, path(el)]];
  if (turned) return [...lead, [0, path(el)]];
  return a.host ? [...lead, [0, path(a.host)], [-0.5, path(el)]] : [...lead, [-0.5, path(el)]];
}
const keyOf = (el: Element): Key => keyIn(el, aroundOf(el), filePath, getComputedStyle(el).position !== 'static', zOf(el), isLayer(el) || listed(el));

// whether a is drawn under b, by the order of the stacking contexts of their slide
export function drawnUnder(a: Element, b: Element): boolean {
  if (a.closest('section') !== b.closest('section') || a.contains(b) || b.contains(a)) return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  return under(keyOf(a), keyOf(b));
}

// an element with a box on the slide, which the object list shows
const drawn = (el: Element): boolean => getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;

// the objects of a slide that the object list shows, and the children of the slide that hold none,
// e.g. a backdrop, apart from the speaker notes, from back to front
const ROWS = `${MOVABLE}, ${LINE}`;
function layersOf(app: App, slide: Element): Element[] {
  const ok = (e: Element) => !e.hasAttribute('data-generated') && !!app.pairing?.elements.has(e) && drawn(e);
  const rows = [...slide.querySelectorAll(ROWS)].filter((e) => !e.closest(OUTSIDE) && !slide.contains(e.parentElement?.closest(ROWS) ?? null));
  const rest = [...slide.children].filter((e) => !e.matches('aside.notes') && hidden(e));
  const keys = new Map([...rows, ...rest].filter(ok).map((e) => [e, keyOf(e)]));
  return [...keys.keys()].sort((x, y) => cmp(keys.get(x)!, keys.get(y)!));
}

// a plate or a backdrop is the back layer of its layout. a command does not move it, and Send to
// Back and Send Backward do not pass one at the back of the order
const BACK = '.plate, .backdrop';
const same = (a: Element[], b: Element[]): boolean => a.length === b.length && a.every((e, i) => e === b[i]);
// an element that the object list does not show, e.g. a backdrop, which a step passes together
// with the next row of the list
const hidden = (e: Element): boolean => !e.matches(ROWS) && !e.querySelector(ROWS);
const seen = (list: Element[]): Element[] => list.filter((e) => !hidden(e));
// the number of plates and backdrops at the back of list, which a command does not pass
const groundOf = (list: Element[]): number => {
  const i = list.findIndex((e) => !e.matches(BACK));
  return i < 0 ? list.length : i;
};
// whether the plate or backdrop b covers the middle of el, where it would take the clicks of el
const covers = (b: Element, el: Element): boolean => {
  const r = b.getBoundingClientRect(), e = el.getBoundingClientRect(), x = e.left + e.width / 2, y = e.top + e.height / 2;
  return x > r.left && x < r.right && y > r.top && y < r.bottom;
};
// the index in list after the ground and after the last plate or backdrop under the index i that
// covers an element of els, which a command does not pass
const floorOf = (list: Element[], i: number, els: Element[]): number => {
  const ground = groundOf(list);
  while (i > ground && !(list[i - 1].matches(BACK) && els.some((e) => covers(list[i - 1], e)))) i--;
  return Math.max(i, ground);
};

// list, from back to front, in the order that a command gives the elements of moving, which keep
// their own order. Bring Forward and Send Backward pass one element that the object list shows,
// and a moving element is put just over the shown element under it
function targetOf(list: Element[], moving: Set<Element>, order: Order): Element[] {
  const m = (e: Element) => moving.has(e) && !e.matches(BACK);
  if (order === 'front' || order === 'back') {
    const rest = list.filter((e) => !m(e));
    const at = order === 'front' ? rest.length : floorOf(list, list.findIndex(m), list.filter(m));
    return [...rest.slice(0, at), ...list.filter(m), ...rest.slice(at)];
  }
  const out = list.slice();
  const skip = (j: number, i: number) => j >= floorOf(out, i, [out[i]]) && j < out.length && hidden(out[j]) && !m(out[j]);
  if (order === 'forward') {
    for (let i = out.length - 2; i >= 0; i--) {
      if (!m(out[i])) continue;
      let j = i + 1;
      while (skip(j, i)) j++;
      if (j < out.length && !m(out[j])) out.splice(j, 0, ...out.splice(i, 1));
    }
  } else {
    for (let i = 1; i < out.length; i++) {
      if (!m(out[i])) continue;
      let j = i - 1;
      while (skip(j, i)) j--;
      if (j < floorOf(out, i, [out[i]]) || m(out[j])) continue;
      while (skip(j - 1, i)) j--;
      out.splice(j, 0, ...out.splice(i, 1));
    }
  }
  return out;
}

// the declarations position: relative and z-index in the style of an element
type Choice = { pos: boolean; z: number | null };
// what the order of el depends on: whether it is positioned without position: relative, whether it
// is turned or moved, its z-index without a z-index in its style, and its declarations now and in
// the file. ref is the file without the declarations of the form that a layer command writes on an
// element that the command moves, which the command may thus take off
type Fact = { el: Element; moving: boolean; placed: boolean; turned: boolean; base: number; now: Choice; file: Choice; ref: Choice; fixPos: boolean; fixZ: boolean; around: Around; lo: number };

const zIn = (v: string | undefined): number | null => (v !== undefined && /^-?\d+$/.test(v.trim()) ? Number(v) : null);

function factOf(app: App, el: Element, moving: boolean, lo: number): Fact {
  const src = app.pairing?.elements.get(el);
  const style = src?.open ? stateOf(src.attrs).style : null;
  const s = (el as HTMLElement).style;
  const c = getComputedStyle(el);
  // a position of the author other than relative, or a z-index that is not a whole number, is not
  // written by a command, and neither is a style without a start tag
  const fixPos = !style || ('position' in style && style.position.trim() !== 'relative');
  const fixZ = !style || ('z-index' in style && zIn(style['z-index']) === null);
  const now = { pos: !fixPos && s.position === 'relative', z: fixZ ? null : zIn(s.zIndex) };
  const file = { pos: !fixPos && 'position' in style!, z: fixZ ? null : zIn(style!['z-index']) };
  const form = moving && file.z !== null && !['top', 'right', 'bottom', 'left', 'inset'].some((k) => k in style!);
  const base = !fixZ && s.zIndex ? (el.matches(RAISED) ? 1 : 0) : parseInt(c.zIndex, 10) || 0;
  const turned = c.transform !== 'none' || c.translate !== 'none' || c.rotate !== 'none' || listed(el);
  const placed = fixPos ? c.position !== 'static' : !s.position && c.position !== 'static';
  return { el, moving, placed, turned, base, now, file, ref: form ? { pos: false, z: null } : file, fixPos, fixZ, around: aroundOf(el), lo };
}

// the place of the element of f with the declarations of c, at the path of path, as keyOf gives
// it. a z-index applies to a positioned element only
const keyWith = (f: Fact, c: Choice, path: Path): Key => keyIn(f.el, f.around, path, f.placed || c.pos, c.z ?? f.base, f.turned);

// the declarations that a command may give the element of f. on an element that it does not move,
// a declaration of the file stays, or is put back once a command has changed it
function choicesOf(f: Fact, hi: number): Choice[] {
  const out: Choice[] = [{ pos: false, z: null }, f.now, f.file];
  if (!f.placed && !f.fixPos) out.push({ pos: true, z: null });
  if (!f.fixZ && (f.placed || !f.fixPos)) for (let z = f.lo; z <= hi; z++) if (z !== f.base) out.push({ pos: !f.placed, z });
  const kept = (c: Choice) => f.moving || ((!f.file.pos || c.pos === f.file.pos || c.pos === f.now.pos) && (f.file.z === null || c.z === f.file.z || c.z === f.now.z));
  return out.filter((c, i) => (c.pos || c.z === null || f.placed) && kept(c) && out.findIndex((d) => d.pos === c.pos && d.z === c.z) === i);
}

// the cost of c: its declarations that ref does not have, which count more on an element that the
// command does not move, then a change of the declarations that the element has, then the size of
// its z-index
const costOf = (f: Fact, c: Choice): number =>
  (Number(c.pos !== f.ref.pos) + Number(c.z !== f.ref.z)) * (f.moving ? 10000 : 25000) + (c.pos !== f.now.pos || c.z !== f.now.z ? 100 : 0) + Math.abs(c.z ?? 0);
// the cost of a move in the file, which saves a declaration, and its length
const MOVE = 5000;

// the choices of facts, from back to front, of the lowest cost that draw them in this order at the
// paths of path, or null when no choice does
function solve(facts: Fact[], path: Path, options: Choice[][]): { cost: number; choices: Choice[] } | null {
  type Step = { key: Key; cost: number; c: Choice | null; back: Step | null };
  let prev: Step[] = [{ key: [[-Infinity, []]], cost: 0, c: null, back: null }];
  for (const [n, f] of facts.entries()) {
    // the steps of prev sorted by key, and for each count of them the cheapest, the first in prev on
    // a tie, since the steps under a key are the first ones in this order
    const sorted = prev.map((_, i) => i).sort((a, b) => cmp(prev[a].key, prev[b].key));
    const cheapest: number[] = [];
    for (const i of sorted) {
      const b = cheapest.at(-1);
      cheapest.push(b === undefined || prev[i].cost < prev[b].cost || (prev[i].cost === prev[b].cost && i < b) ? i : b);
    }
    const next: Step[] = [];
    for (const c of options[n]) {
      const key = keyWith(f, c, path);
      let [lo, hi] = [0, sorted.length];
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (under(prev[sorted[mid]].key, key)) lo = mid + 1;
        else hi = mid;
      }
      const from = lo ? prev[cheapest[lo - 1]] : null;
      if (from) next.push({ key, cost: from.cost + costOf(f, c), c, back: from });
    }
    if (!next.length) return null;
    prev = next;
  }
  const best = prev.reduce((a, p) => (p.cost < a.cost ? p : a));
  const choices: Choice[] = [];
  for (let s: Step | null = best; s?.c; s = s.back) choices.unshift(s.c);
  return { cost: best.cost, choices };
}

// whether a child of el with a z-index under 0 is drawn over the ground of el, i.e. whether el
// makes a stacking context, as a slide does. elsewhere, e.g. in the text column of a split slide or the
// title text of a title slide, the child is drawn under its parent, hidden from a click
function stacks(el: Element): boolean {
  const s = getComputedStyle(el);
  return (s.position !== 'static' && s.zIndex !== 'auto') || s.transform !== 'none' || s.translate !== 'none' || s.rotate !== 'none' || s.scale !== 'none' || Number(s.opacity) < 1 || s.isolation === 'isolate' || s.filter !== 'none';
}

// the order of the children of each parent of a moved element, and the declarations of each
// element of target, that draw target from back to front at the lowest cost. an element of moving
// out of the flow is moved among its siblings where this saves a declaration, since a move in the
// file does not move it on the slide. a move from its place in the file is a cost, and a move does
// not change the order of the steps without an index. a hidden element over the ground may be
// drawn in any place, unless it is a backdrop that covers a moved element
type Plan = { orders: Map<Element, Element[]>; facts: Fact[]; choices: Choice[]; moving: Element[] };

// the places in order, the children of the parent of el, that a move of el is tried at: its own,
// the one after the sibling before it in the file, the two ends, and next to the siblings around the
// elements drawn just under and just over it in target, each with the places around it up to the
// next sibling that stays in the file. a plan thus runs a few solves for each moved element
function placesOf(el: Element, order: Element[], target: Element[], stays: (k: Element) => boolean, prev: Element | undefined): number[] {
  const without = order.filter((k) => k !== el);
  const kid = (k: Element | undefined) => {
    let x: Element | null = k ?? null;
    while (x && x.parentElement !== el.parentElement) x = x.parentElement;
    return x && x !== el ? x : null;
  };
  const i = target.indexOf(el);
  const under = target.slice(0, Math.max(0, i)).reverse(), over = target.slice(i + 1);
  const near = [under[0], under.find(stays), over[0], over.find(stays)].map(kid);
  const out = new Set<number>();
  for (const j of [order.indexOf(el), prev ? without.indexOf(prev) + 1 : 0, without.length, ...near.flatMap((k) => (k ? [without.indexOf(k), without.indexOf(k) + 1] : []))]) {
    if (j < 0 || j > without.length) continue;
    let [lo, hi] = [j, j];
    while (lo > 0 && !stays(without[lo - 1])) lo--;
    while (hi < without.length && !stays(without[hi])) hi++;
    for (let k = lo; k <= hi; k++) out.add(k);
  }
  return [...out];
}

function planOf(app: App, all: Element[], moving: Element[], any = false): Plan | null {
  const ground = groundOf(all);
  const target = all.filter((e, i) => i < ground || !hidden(e) || (e.matches(BACK) && moving.some((k) => covers(e, k))));
  const n = target.length;
  const facts = target.map((el) => factOf(app, el, moving.includes(el), stacks(el.parentElement!) ? -n : 0));
  const hi = Math.max(0, ...facts.map((f) => f.base)) + n;
  const free = moving.filter((e) => target.includes(e) && !inFlow(e) && !e.matches(BACK));
  // an element inserted since the file was read is from a text of its own, and its place in the
  // file is before the next sibling from the text of its parent
  const at = (el: Element): number => {
    const src = app.pairing?.elements.get(el), home = app.pairing?.elements.get(el.parentElement!)?.source;
    if (!src?.source.fragment || src.source === home) return src?.open?.start ?? -1;
    let n = el.nextElementSibling;
    while (n && app.pairing?.elements.get(n)?.source !== home) n = n.nextElementSibling;
    return n ? (app.pairing?.elements.get(n)?.open?.start ?? 0) - 0.5 : Number.MAX_SAFE_INTEGER;
  };
  // the place of el among its siblings of the file that stay
  const rank = (el: Element, order: Element[]) => order.filter((k) => k === el || (!free.includes(k) && at(k) >= 0)).indexOf(el);
  const kidsOf = (el: Element) => [...el.parentElement!.children];
  // the steps without an index in the file, which reveal.js shows in the order of the page
  const steps = [...(target[0]?.closest('section')?.querySelectorAll('.fragment') ?? [])]
    .filter((e) => !!app.pairing?.elements.get(e)?.open && app.doc.tagState(e).attrs['data-fragment-index'] === undefined);
  const options = facts.map((f) => choicesOf(f, hi));
  const costIn = (orders: Map<Element, Element[]>) => {
    const path = keptPath(orders);
    const keys = steps.map((e): Key => [[0, path(e)]]);
    if (keys.some((k, i) => i && !under(keys[i - 1], k))) return null;
    const s = solve(facts, path, options);
    const moves = free.reduce((sum, el) => {
      const [now, was] = [rank(el, orders.get(el.parentElement!) ?? kidsOf(el)), rank(el, kidsOf(el).sort((a, b) => at(a) - at(b)))];
      return sum + (now === was ? 0 : MOVE + Math.abs(now - was));
    }, 0);
    return s ? { ...s, cost: s.cost + moves, orders } : null;
  };
  let best = costIn(new Map());
  for (const el of free) {
    if (any && best) break;
    const parent = el.parentElement!;
    const order = best?.orders.get(parent) ?? kidsOf(el);
    const without = order.filter((k) => k !== el);
    const file = kidsOf(el).filter((k) => k === el || at(k) >= 0).sort((a, b) => at(a) - at(b));
    for (const i of placesOf(el, order, target, (k) => !free.includes(k) && at(k) >= 0, file[file.indexOf(el) - 1])) {
      const s = costIn(new Map([...(best?.orders ?? []), [parent, [...without.slice(0, i), el, ...without.slice(i)]]]));
      if (s && (!best || s.cost < best.cost)) best = s;
    }
  }
  return best ? { orders: best.orders, facts, choices: best.choices, moving: free } : null;
}

async function applyPlan(app: App, plan: Plan): Promise<void> {
  for (const [parent, kids] of plan.orders) {
    for (const [at, el] of kids.entries()) {
      if (!plan.moving.includes(el)) continue;
      const prev = kids[at - 1] ?? null;
      if (el.previousElementSibling === prev) continue;
      await app.doc.move(el, parent, prev ? prev.nextSibling : parent.firstElementChild, 'order');
    }
  }
  plan.facts.forEach((f, i) => {
    const c = plan.choices[i];
    const style: Record<string, string | null> = {};
    if (c.pos !== f.now.pos) style.position = c.pos ? 'relative' : null;
    if (c.z !== f.now.z) style['z-index'] = c.z === null ? null : String(c.z);
    if (Object.keys(style).length) app.doc.setTag(f.el, { style }, 'order');
  });
}

// whether a command changes the order of the objects of slide for the elements of els, and, with
// solved, whether declarations draw this order. the declarations of the other elements of the slide
// are written again at the lowest cost of their order, hence taken off once the slide is drawn in
// the order of the file
function changes(app: App, slide: Element | null, els: Set<Element>, o: Order, solved = true): boolean {
  const known = asked?.find((a) => a.slide === slide && a.o === o && a.solved === solved && same(a.els, [...els]));
  if (known) return known.value;
  if (!asked) queueMicrotask(() => (asked = null));
  asked ??= [];
  const list = slide ? (asked.find((a) => a.slide === slide)?.list ?? layersOf(app, slide)) : [];
  const target = targetOf(list, els, o);
  const value = !same(seen(target), seen(list)) && (!solved || !!planOf(app, target, [...els], true));
  asked.push({ slide, els: [...els], o, solved, list, value });
  return value;
}
// the answers of changes in one run of the code of the page, e.g. a refresh of the panes and the
// menus, in which the four Order commands share the order of the slide and each answer
let asked: { slide: Element | null; els: Element[]; o: Order; solved: boolean; list: Element[]; value: boolean }[] | null = null;

// the order of the objects of slide that a command gives to the elements of els, applied, or
// false when they stay
async function arrange(app: App, slide: Element, els: Element[], o: Order): Promise<boolean> {
  const list = layersOf(app, slide);
  const target = targetOf(list, new Set(els), o);
  const plan = same(seen(target), seen(list)) ? null : planOf(app, target, els);
  if (plan) await applyPlan(app, plan);
  return !!plan;
}

// a new element of a slide drawn under a shape of the slide, put in front of the shapes by the plan
// of Bring to Front, in the entry of its insert, so that it is seen once it is dragged onto a shape,
// as the newest object of Keynote and PowerPoint
export async function overShapes(app: App, el: Element): Promise<void> {
  const slide = el.closest('section');
  if (slide && [...slide.querySelectorAll('.shape')].some((s) => drawnUnder(el, s))) await arrange(app, slide, [el], 'front');
}

// a new shape or line put in front of its slide by the plan of Bring to Front, in the entry of its
// insert, as the newest object of Keynote and PowerPoint. nothing is written where it is in front
export async function toFront(app: App, el: Element): Promise<void> {
  const slide = el.closest('section');
  if (slide) await arrange(app, slide, [el], 'front');
}

// whether Bring Forward, or Send Backward with up false, would move el by itself
export const canStep = (app: App, el: Element, up: boolean): boolean => changes(app, el.closest('section'), new Set([el]), up ? 'forward' : 'backward', false);

// the last element that Bring to Front, or Send to Back with up false, puts el in front of or
// behind, with the elements of selected passed over, or null when el does not move
export function layerLimit(app: App, el: Element, up: boolean, selected: Set<Element>): Element | null {
  const slide = el.closest('section');
  const list = slide ? layersOf(app, slide) : [];
  const target = targetOf(list, selected, up ? 'front' : 'back');
  const k = list.indexOf(el);
  const passed = list.filter((s, i) => !selected.has(s) && !hidden(s) && (up ? i > k : i < k && target.indexOf(s) > target.indexOf(el)));
  return (up ? passed.at(-1) : passed[0]) ?? null;
}

// el moved by one layer, as Bring Forward or Send Backward moves it, for a drag of a row of
// navigator/objects.ts. it returns false when el does not move
export async function stepLayer(app: App, el: Element, up: boolean): Promise<boolean> {
  const slide = el.closest('section');
  return !!slide && arrange(app, slide, [el], up ? 'forward' : 'backward');
}

// the selected elements that a command acts on, without an element inside another one
const selectedEls = (app: App): Element[] => {
  const els = app.selection.elements();
  return els.filter((e) => !els.some((o) => o !== e && o.contains(e)) && !!app.pairing?.elements.get(e)?.open);
};

// the elements that the order, the group, and the lock commands act on: the figure of an image, a
// video, or a QR code selected inside it, since the picture is drawn in the layer of its figure and
// is one object with its caption, and else the selected element
const objectEls = (app: App): Element[] => objectsOf(app, selectedEls(app));

const canOrder = (app: App, o: Order): boolean => changes(app, app.current(), new Set(objectEls(app)), o);

async function reorder(app: App, o: Order): Promise<void> {
  const before = app.selection.elements().slice();
  const slide = app.current();
  // the selection stays over the undo and the redo, which may change other elements
  const held = app.history.holding();
  if (slide) await arrange(app, slide, objectEls(app), o);
  app.selection.set('elements', before.filter((el) => el.isConnected));
  held();
  app.invalidate('content');
}

// the members of a group on the page, at any depth, apart from the hidden image of a dark and light
// pair, which follows its twin
export const membersOf = (app: App, id: string): Element[] => [...(app.current() ?? document).querySelectorAll(`[data-group~="${CSS.escape(id)}"]`)]
  .filter((el) => !!app.pairing?.elements.get(el)?.open && !(twinOf(app, el) && !el.getClientRects().length));

// a name of a group that is not on the page, in the file, or in taken
export function freshGroup(app: App, taken: Set<string> = new Set()): string {
  const text = app.source?.text ?? '';
  for (let i = 1; ; i++) {
    const id = `g${i}`;
    if (!taken.has(id) && !groupUsed(id, text)) return id;
  }
}

// a copy does not take a data-id that another element of its slide has, since reveal.js pairs the
// elements of two slides by this id. the images of a pair of modes in a copy share theirs
function freshDataIds(app: App, copies: Element[]): void {
  const slide = app.current();
  if (!slide) return;
  const inCopies = (el: Element) => copies.some((c) => c === el || c.contains(el));
  for (const el of copies.flatMap((c) => [c, ...c.querySelectorAll('[data-id]')])) {
    const id = el.getAttribute('data-id');
    if (id && [...slide.querySelectorAll(`[data-id="${CSS.escape(id)}"]`)].some((o) => !inCopies(o))) app.doc.setTag(el, { attrs: { 'data-id': null } }, 'id');
  }
}

// the layout of a figure slide has one plate, and another slide has none, hence a copy of a plate
// is a plate only as the first plate of a figure slide. elsewhere it is made a figure box, the box of
// the theme for a figure beside other content, since a second plate is laid out under the slide
function plateToFigureBox(app: App, copies: Element[]): void {
  for (const el of copies) {
    const slide = el.closest('section');
    if (!el.matches('.plate') || !slide || (slide.matches('.figure') && slide.querySelector(':scope > .plate') === el)) continue;
    app.doc.setTag(el, { classes: { plate: false, 'figure-box': true } }, 'layout');
  }
}

// the copies of a paste, a Duplicate, or a drag with the copy modifier, fitted to their slide
export function settleCopies(app: App, copies: Element[]): void {
  freshDataIds(app, copies);
  plateToFigureBox(app, copies);
}

// two elements or more that are not one group already
const canGroup = (app: App): boolean => {
  const els = objectEls(app);
  const first = groupOf(els[0] ?? document.body);
  return els.length > 1 && !(first && els.every((el) => groupOf(el) === first));
};
// the groups that Ungroup takes apart: those of the selection at the level of the scope, or the
// entered group of a member selected by itself, as in PowerPoint
function ungroupIds(app: App): Set<string> {
  const els = objectEls(app);
  const ids = new Set(els.map(groupOf).filter((g): g is string => !!g));
  const inner = scopeOf().at(-1);
  if (!ids.size && inner && els.length && els.every((el) => within(el))) ids.add(inner);
  return ids;
}

const canUngroup = (app: App): boolean => ungroupIds(app).size > 0;

// the depth at which Group and Ungroup act: the level of the scope, or the slide for a selection
// outside it
const depthOf = (el: Element): number => (within(el) ? scopeOf().length : 0);

// Group writes a fresh name at the depth of the scope into the list of every selected element, hence
// a selected group keeps its own name inside the new one
function group(app: App): void {
  const els = objectEls(app);
  const id = freshGroup(app);
  for (const el of els) {
    const list = groupsOf(el), d = depthOf(el);
    app.doc.setTag(el, { attrs: { 'data-group': groupValue([...list.slice(0, d), id, ...list.slice(d)]) } }, 'group');
  }
  app.selection.set('elements', els);
}

// the lists of the members of the groups taken apart by the last Ungroup, before and after it,
// which Regroup writes back. it is kept for the session only, since the file does not hold it
let ungrouped: { els: Element[]; from: string[]; to: string[] } | null = null;

// Ungroup takes the name at the depth of the scope off every member of each selected group, and
// selects the former children, an inner group as a whole
function ungroup(app: App): void {
  const ids = ungroupIds(app);
  if (ids.has(scopeOf().at(-1) as string)) setScope(scopeOf().slice(0, -1));
  const all = [...new Set([...ids].flatMap((id) => membersOf(app, id)))];
  const from = all.map((el) => groupValue(groupsOf(el)) ?? '');
  for (const el of all) app.doc.setTag(el, { attrs: { 'data-group': groupValue(groupsOf(el).filter((n) => !ids.has(n))) } }, 'ungroup');
  ungrouped = { els: all, from, to: all.map((el) => groupValue(groupsOf(el)) ?? '') };
  app.selection.set('elements', all);
}

// Regroup gives the members of the last Ungroup their lists back while each of them is on the
// slide with the list that Ungroup left
const canRegroup = (app: App): boolean => {
  const u = ungrouped, slide = app.current();
  return !!u && !!slide && u.els.every((el, i) => el.isConnected && slide.contains(el) && (groupValue(groupsOf(el)) ?? '') === u.to[i]);
};

function regroup(app: App): void {
  const u = ungrouped;
  if (!u || !canRegroup(app)) return;
  // a name that Ungroup took off and that another element of the page took since is replaced by a
  // fresh one. the names of the outer groups, which Ungroup left, are kept
  const names = new Map<string, string>();
  const taken = (n: string) => [...document.querySelectorAll(`[data-group~="${CSS.escape(n)}"]`)].some((el) => !u.els.includes(el));
  const left = new Set(u.to.flatMap((l) => l.split(' ')));
  for (const list of u.from) for (const n of list.split(' ').filter(Boolean)) {
    if (!names.has(n)) names.set(n, !left.has(n) && taken(n) ? freshGroup(app, new Set(names.values())) : n);
  }
  u.els.forEach((el, i) => app.doc.setTag(el, { attrs: { 'data-group': groupValue(u.from[i].split(' ').filter(Boolean).map((n) => names.get(n) as string)) } }, 'group'));
  app.selection.set('elements', u.els);
}

// the elements of a lock or an unlock. a caret or a range in the text of a locked text element
// unlocks it, since a click into the text of a locked text element puts the caret there
function lockTargets(app: App, on: boolean): Element[] {
  const els = objectEls(app);
  if (on || app.selection.kind !== 'text') return els;
  const locked = app.selection.items.map((el) => el.closest('[data-locked]')).filter((el): el is Element => !!el);
  return [...new Set([...els, ...locked])];
}

function setLock(app: App, on: boolean): void {
  const els = lockTargets(app, on).filter((el) => locked(el) !== on);
  for (const el of els) app.doc.setTag(el, { attrs: { 'data-locked': on ? '' : null } }, on ? 'lock' : 'unlock');
  app.invalidate('selection');
}

export { angleOf };

// whether every one of els is a line with an attached end, which is not turned until each end is
// detached, as a connection line of Keynote
export const attachedLines = (els: Element[]): boolean => els.length > 0 && els.every((el) => el.matches(LINE) && (attachedTo(el, 'from').length > 0 || attachedTo(el, 'to').length > 0));

// the angle of a whole group, i.e. of its first member in the order of the page, or null when els
// are not one whole group that can be turned
export function groupAngle(app: App, els: Element[]): number | null {
  const turners = turnersOf(app, els);
  return turners ? turners[0].angle : null;
}

// a click on a member of a selected group enters the group at its next level, as a double click
// does in Keynote and PowerPoint, and selects the child under the pointer: el, or the inner group
// that holds it
export function enterGroup(app: App, el: Element): void {
  const g = el.closest('[data-group]') ?? el;
  const list = groupsOf(g), d = within(g) ? scopeOf().length : 0;
  if (d < list.length) setScope(list.slice(0, d + 1));
  const inner = list[d + 1];
  app.selection.set('elements', inner ? membersOf(app, inner) : [el]);
  app.invalidate('selection');
}

// selects els with the scope set to list, e.g. for a row of the Object List
export function selectIn(app: App, list: string[], els: Element[]): void {
  setScope(list);
  app.selection.set('elements', els);
  app.invalidate('selection');
}

// Esc in an entered group leaves it and selects it whole, or false outside a group
export function leaveGroup(app: App): boolean {
  const list = scopeOf();
  if (!list.length || app.selection.kind !== 'elements') return false;
  selectIn(app, list.slice(0, -1), membersOf(app, list[list.length - 1]));
  return true;
}

// a selection that holds a child of the scope holds every member of the child, i.e. of an inner
// group. a child taken off a selection that held it whole and other elements, e.g. by a click with
// Shift, is taken off whole. the scope is left once the selection holds an element outside it
function keepGroups(app: App): void {
  let before = new Set<Element>();
  let busy = false;
  app.selection.listen(() => {
    if (busy) return;
    const sel = app.selection;
    const els = sel.elements();
    const held = sel.kind === 'text' ? sel.items : els;
    if (scopeOf().length && (!held.length || held.some((el) => !within(el)))) setScope([]);
    const ids = new Set([...els, ...before].map(groupOf).filter((g): g is string => !!g));
    let next = [...els];
    for (const id of ids) {
      const members = membersOf(app, id);
      const held = members.filter((m) => els.includes(m));
      if (!held.length || held.length === members.length) continue;
      if (members.every((m) => before.has(m)) && next.some((e) => !members.includes(e))) next = next.filter((e) => !members.includes(e));
      else next.push(...members.filter((m) => !next.includes(m)));
    }
    if (next.length !== els.length || next.some((e, i) => e !== els[i])) {
      busy = true;
      sel.set(next.length ? 'elements' : 'none', next);
      busy = false;
    }
    before = new Set(sel.elements());
  });
}

// the second keys of Windows and Linux are those of PowerPoint, with the character that Shift
// gives on a US layout, which a symbol is matched by
const ORDERS: { order: Order; label: string; mac: string; other: string[] }[] = [
  { order: 'front', label: 'Bring to Front', mac: 'Mod+Shift+F', other: ['Mod+Shift+ArrowUp', 'Mod+Shift+}'] },
  { order: 'forward', label: 'Bring Forward', mac: 'Mod+Alt+Shift+F', other: ['Mod+ArrowUp', 'Mod+]'] },
  { order: 'backward', label: 'Send Backward', mac: 'Mod+Alt+Shift+B', other: ['Mod+ArrowDown', 'Mod+['] },
  { order: 'back', label: 'Send to Back', mac: 'Mod+Shift+B', other: ['Mod+Shift+ArrowDown', 'Mod+Shift+{'] },
];

export function commands(app: App): Command[] {
  const arrange = (order: number, group = 'order') => ({ bar: 'Arrange', group, order });
  const list: Command[] = ORDERS.map(({ order, label, mac, other }, i) => ({
    id: `arrange.order.${order}`,
    label,
    keys: { mac: [mac], other },
    in: ['canvas'],
    menu: arrange(50 + i),
    context: ['element'],
    enabled: (app) => canOrder(app, order),
    undoable: true,
    run: (app) => reorder(app, order),
  }));
  list.push(
    {
      id: 'arrange.group',
      label: 'Group',
      keys: { mac: ['Mod+Alt+G'], other: ['Mod+G'] },
      in: ['canvas'],
      menu: arrange(60, 'group'),
      context: ['element'],
      enabled: canGroup,
      undoable: true,
      run: group,
    },
    {
      id: 'arrange.ungroup',
      label: 'Ungroup',
      keys: { mac: ['Mod+Alt+Shift+G'], other: ['Mod+Shift+G'] },
      in: ['canvas'],
      menu: arrange(61, 'group'),
      context: ['element'],
      enabled: canUngroup,
      undoable: true,
      run: ungroup,
    },
    {
      // Ctrl+Shift+J opens the console of Chrome and Firefox on Windows and Linux, which may keep it
      id: 'arrange.regroup',
      label: 'Regroup',
      keys: { mac: ['Mod+Alt+J'], other: ['Mod+Shift+J'] },
      in: ['canvas'],
      menu: arrange(62, 'group'),
      context: ['element'],
      enabled: canRegroup,
      undoable: true,
      run: regroup,
    },
    {
      id: 'arrange.lock',
      label: 'Lock',
      // Safari takes Cmd+L of Keynote before the page, and Chrome and Firefox pass it on. both keys
      // are bound, and the menus list first the one that reaches the page
      keys: { mac: app.safari ? ['Ctrl+Mod+L', 'Mod+L'] : ['Mod+L', 'Ctrl+Mod+L'], other: ['Mod+L'] },
      in: ['canvas'],
      menu: arrange(70, 'lock'),
      enabled: (app) => objectEls(app).some((el) => !locked(el)),
      undoable: true,
      run: (app) => setLock(app, true),
    },
    {
      id: 'arrange.unlock',
      label: 'Unlock',
      // Safari takes Opt+Cmd+L of Keynote for its downloads
      keys: { mac: app.safari ? ['Ctrl+Mod+Alt+L', 'Mod+Alt+L'] : ['Mod+Alt+L', 'Ctrl+Mod+Alt+L'], other: ['Mod+Shift+L'] },
      in: ['canvas', 'text'],
      menu: arrange(71, 'lock'),
      enabled: (app) => lockTargets(app, false).some(locked),
      undoable: true,
      run: (app) => setLock(app, false),
    },
    {
      id: 'arrange.toggleLock',
      label: (app) => (objectEls(app).length && objectEls(app).every(locked) ? 'Unlock' : 'Lock'),
      listedAs: (app) => (objectEls(app).length && objectEls(app).every(locked) ? 'arrange.unlock' : 'arrange.lock'),
      context: ['element'],
      enabled: (app) => objectEls(app).length > 0,
      undoable: true,
      run: (app) => setLock(app, !objectEls(app).every(locked)),
    },
    {
      // arg is { deg, els }, the angle in degrees, of the elements, or of the selection by default.
      // a whole group is turned about the center of its frame until its first member is at deg
      id: 'arrange.setRotation',
      label: 'Rotate',
      enabled: (app) => selectedEls(app).some(turnable) && !attachedLines(selectedEls(app)),
      run: (app, arg) => {
        const a = (arg ?? {}) as { deg?: number; els?: Element[] };
        if (typeof a.deg !== 'number' || !Number.isFinite(a.deg)) return;
        const deg = ((Math.round(a.deg) % 360) + 360) % 360;
        const els = (a.els ?? selectedEls(app)).filter((el) => el.isConnected);
        // the places of the elements that a turn changes, before and after it, as one entry
        const turned = (els: Element[], run: () => void) => {
          const moved = withTwins(app, els);
          const from = new Map(moved.map((el) => [el, placeOf(el)]));
          run();
          record(app, 'rotate', moved.map((el) => ({ el, from: from.get(el) as ReturnType<typeof placeOf>, to: placeOf(el) })));
          app.invalidate('content');
        };
        const turners = turnersOf(app, els);
        if (turners) {
          const pivot = pivotOf(turners.map((t) => t.el), turners[0].angle);
          turned(turnedEls(turners), () => {
            for (const t of turners) turnMember(app, t, pivot, deg - turners[0].angle);
          });
          return;
        }
        // a group in a multiple selection is turned about the center of its frame until its first
        // member is at deg, and each element outside a group about its own center
        const apart = apartOf(app, els);
        if (apart?.some((t) => t.group)) {
          turned(turnedEls(apart), () => {
            for (const t of apart) turnMember(app, t, t.group?.pivot ?? t.center, deg - (t.group?.angle ?? t.angle));
          });
          return;
        }
        // the picture of a figure takes the angle, from the figure and from the picture selected,
        // and its figure the offset that keeps the center of the picture
        const pairs = els.filter((el) => turnable(el)).map((el) => {
          const spin = spinOf(el);
          return { spin, carrier: objectOf(app, spin) };
        }).filter((t) => !locked(t.spin) && !locked(t.carrier));
        turned([...new Set(pairs.flatMap((t) => [...spunEls(t.spin), t.carrier]))], () => {
          for (const t of pairs) turn(app, t.spin, t.carrier, deg, seenCenter(app, t.spin));
        });
      },
    },
    {
      id: 'arrange.resetRotation',
      label: 'Reset Rotation',
      menu: { bar: 'Arrange', group: 'reset', order: 12 },
      enabled: (app) => {
        const els = selectedEls(app);
        if (attachedLines(els)) return false;
        const group = groupAngle(app, els);
        return group !== null ? group !== 0 : els.some((el) => turnable(el) && angleOf(el) !== 0);
      },
      run: (app) => app.commands.run('arrange.setRotation', { deg: 0 }),
    },
  );
  return list;
}

// the commands that change the elements of the selection or the text of a text element of it, which a
// lock turns off, as Keynote does until a locked object is unlocked. Copy, Duplicate, and the
// commands that select or show the selection are kept, and so are Lock and Unlock
const CHANGES = new RegExp([
  '^(figure|image|media|code|surface|line|backdrop|math|text)\\.',
  '^arrange\\.(?!(lock|unlock|toggleLock)$)',
  '^table\\.(?!(select|extend|cell\\.))',
  '^steps\\.(set|add|remove|start|delay|deliver|listDelivery|final|move|earlier|later|effect)$',
  '^(edit\\.cut|selection\\.editText)$',
].join('|'));

// the focused text that is not a text of the slides, i.e. a field of a pane. the commands of the
// Edit menu act on its text, and not on the selection of the canvas
export const fieldOf = (app: App): HTMLElement | null => {
  const f = document.activeElement;
  const typed = f instanceof HTMLElement && (f.isContentEditable || f.matches('textarea, input:not([type=range], [type=checkbox], [type=radio], [type=button], [type=color])'));
  return typed && !app.hostOf(f) ? f : null;
};

// whether the selection holds a locked element, an element inside one, or a text of one
export function lockedSelection(app: App): boolean {
  const sel = app.selection;
  const els = sel.kind === 'text' ? sel.items : sel.elements();
  return els.some((el) => !!el.closest('[data-locked]') || !!el.querySelector('[data-locked]'));
}

export function install(app: App): void {
  for (const c of commands(app)) app.commands.define(c);
  keepGroups(app);
  // a lock holds an element of the slide, and not the text of a field, on which Cut, Paste, and
  // Delete act while the caret is in it
  const inField = (a: App, id: string) => /^(edit\.(cut|paste)|element\.delete)$/.test(id) && !!fieldOf(a);
  app.commands.veto((a, c) => !inField(a, c.id) && (CHANGES.test(c.id) || (c.id === 'edit.paste' && a.selection.kind === 'text')) && lockedSelection(a));
  // Delete skips a locked element, hence it is turned off only when every selected element is locked
  app.commands.veto((a, c) => c.id === 'element.delete' && !inField(a, c.id) && a.selection.kind !== 'text' && a.selection.elements().length > 0 && a.selection.elements().every((el) => !!el.closest('[data-locked]')));
  // typing, a drop, and the keys that delete or break a line do not go through a command, hence
  // they are cancelled before the browser changes the text of a locked text element
  document.addEventListener('beforeinput', (ev) => {
    if (ev.target instanceof Element && ev.target.closest('.reveal .slides [data-locked]')) ev.preventDefault();
  }, true);
}
