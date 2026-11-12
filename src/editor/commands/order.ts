// the commands of the order, the groups, the locks, and the rotation of the elements, as in the
// Arrange menu of Keynote. an element is drawn over its siblings of a lower z-index, and over the
// earlier siblings of the same z-index. an element out of the flow is ordered by a move of its unit
// among its siblings, and an element in the flow by a z-index, since a move would change the layout
// of its slide. a group is the elements with the same data-group, selected and dragged together,
// and a locked element, with data-locked, is not moved by the pointer, the keys, or the fields.
// each command is one entry of the history

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { angleOf, apartOf, locked, pivotOf, placeOf, record, seenCenter, spinOf, turn, turnMember, turnedEls, turnersOf } from '../canvas/drag.ts';
import { LINE, MOVABLE, OUTSIDE, objectOf, objectsOf, turnable, twinOf } from '../canvas/hit.ts';
import { stateOf } from '../tags.ts';

export type Order = 'front' | 'forward' | 'backward' | 'back';

export const groupOf = (el: Element): string | null => el.getAttribute('data-group');

// an element in the flow of its parent, which a move among its siblings would move on the slide
function inFlow(el: Element): boolean {
  const s = getComputedStyle(el);
  return s.display !== 'none' && s.position !== 'absolute' && s.position !== 'fixed';
}

// an element drawn in a layer of its own, i.e. positioned or transformed, whose order among the
// other layers sets which of them is drawn over the other
function isLayer(el: Element): boolean {
  const s = getComputedStyle(el);
  return s.display !== 'none' && (s.position !== 'static' || s.translate !== 'none' || s.rotate !== 'none' || s.transform !== 'none');
}

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
const keyOf = (el: Element): Key => keyIn(el, aroundOf(el), filePath, getComputedStyle(el).position !== 'static', zOf(el), isLayer(el));

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

// list, from back to front, in the order that a command gives the elements of moving, which keep
// their own order. Bring Forward and Send Backward pass one element that the object list shows,
// and a moving element is put just over the shown element under it
function targetOf(list: Element[], moving: Set<Element>, order: Order): Element[] {
  const m = (e: Element) => moving.has(e) && !e.matches(BACK);
  const ground = groundOf(list);
  if (order === 'front' || order === 'back') {
    const rest = list.filter((e) => !m(e));
    const at = order === 'front' ? rest.length : ground;
    return [...rest.slice(0, at), ...list.filter(m), ...rest.slice(at)];
  }
  const out = list.slice();
  const skip = (j: number) => j >= ground && j < out.length && hidden(out[j]) && !m(out[j]);
  if (order === 'forward') {
    for (let i = out.length - 2; i >= 0; i--) {
      if (!m(out[i])) continue;
      let j = i + 1;
      while (skip(j)) j++;
      if (j < out.length && !m(out[j])) out.splice(j, 0, ...out.splice(i, 1));
    }
  } else {
    for (let i = 1; i < out.length; i++) {
      if (!m(out[i])) continue;
      let j = i - 1;
      while (skip(j)) j--;
      if (j < ground || m(out[j])) continue;
      while (skip(j - 1)) j--;
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
  const turned = c.transform !== 'none' || c.translate !== 'none' || c.rotate !== 'none';
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
function solve(facts: Fact[], path: Path, hi: number): { cost: number; choices: Choice[] } | null {
  type Step = { key: Key; cost: number; path: Choice[] };
  let prev: Step[] = [{ key: [[-Infinity, []]], cost: 0, path: [] }];
  for (const f of facts) {
    const next: Step[] = [];
    for (const c of choicesOf(f, hi)) {
      const key = keyWith(f, c, path);
      const from = prev.filter((p) => under(p.key, key)).reduce<Step | null>((a, p) => (!a || p.cost < a.cost ? p : a), null);
      if (from) next.push({ key, cost: from.cost + costOf(f, c), path: [...from.path, c] });
    }
    if (!next.length) return null;
    prev = next;
  }
  const best = prev.reduce((a, p) => (p.cost < a.cost ? p : a));
  return { cost: best.cost, choices: best.path };
}

// whether a child of el with a z-index under 0 is drawn over the ground of el, i.e. whether el
// makes a stacking context, as a slide does. elsewhere, e.g. in the panel of a split slide or the
// block of a title slide, the child is drawn under its parent, hidden from a click
function stacks(el: Element): boolean {
  const s = getComputedStyle(el);
  return (s.position !== 'static' && s.zIndex !== 'auto') || s.transform !== 'none' || s.translate !== 'none' || s.rotate !== 'none' || s.scale !== 'none' || Number(s.opacity) < 1 || s.isolation === 'isolate' || s.filter !== 'none';
}

// the order of the children of each parent of a moved element, and the declarations of each
// element of target, that draw target from back to front at the lowest cost. an element of moving
// out of the flow is moved among its siblings where this saves a declaration, since a move in the
// file does not move it on the slide. a hidden element over the ground may be drawn in any place
type Plan = { orders: Map<Element, Element[]>; facts: Fact[]; choices: Choice[]; moving: Element[] };
function planOf(app: App, all: Element[], moving: Element[]): Plan | null {
  const ground = groundOf(all);
  const target = all.filter((e, i) => i < ground || !hidden(e));
  const n = target.length;
  const facts = target.map((el) => factOf(app, el, moving.includes(el), stacks(el.parentElement!) ? -n : 0));
  const hi = Math.max(0, ...facts.map((f) => f.base)) + n;
  const free = moving.filter((e) => target.includes(e) && !inFlow(e) && !e.matches(BACK));
  // the place of el among its siblings that stay
  const rank = (el: Element, order: Element[]) => order.filter((k) => k === el || !free.includes(k)).indexOf(el);
  const kidsOf = (el: Element) => [...el.parentElement!.children];
  const costIn = (orders: Map<Element, Element[]>) => {
    const s = solve(facts, pathIn(orders), hi);
    const moves = free.reduce((sum, el) => {
      const [now, was] = [rank(el, orders.get(el.parentElement!) ?? kidsOf(el)), rank(el, kidsOf(el))];
      return sum + (now === was ? 0 : MOVE + Math.abs(now - was));
    }, 0);
    return s ? { ...s, cost: s.cost + moves, orders } : null;
  };
  let best = costIn(new Map());
  for (const el of free) {
    const parent = el.parentElement!;
    const without = (best?.orders.get(parent) ?? kidsOf(el)).filter((k) => k !== el);
    // a move helps only next to the siblings that hold the elements just under and over el in target
    const k = target.indexOf(el);
    const near = [target[k - 1], target[k + 1]].map((t) => without.find((w) => w.contains(t ?? null))).filter((t) => t !== undefined);
    for (const at of new Set(near.flatMap((t) => [without.indexOf(t), without.indexOf(t) + 1]))) {
      const s = costIn(new Map([...(best?.orders ?? []), [parent, [...without.slice(0, at), el, ...without.slice(at)]]]));
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
  const list = slide ? layersOf(app, slide) : [];
  const target = targetOf(list, els, o);
  return !same(seen(target), seen(list)) && (!solved || !!planOf(app, target, [...els]));
}

// the order of the objects of slide that a command gives to the elements of els, applied, or
// false when they stay
async function arrange(app: App, slide: Element, els: Element[], o: Order): Promise<boolean> {
  const list = layersOf(app, slide);
  const target = targetOf(list, new Set(els), o);
  const plan = same(seen(target), seen(list)) ? null : planOf(app, target, els);
  if (plan) await applyPlan(app, plan);
  return !!plan;
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
  if (slide) await arrange(app, slide, objectEls(app), o);
  app.selection.set('elements', before.filter((el) => el.isConnected));
  app.invalidate('content');
}

// the members of a group on the page, apart from the hidden image of a dark and light pair, which
// follows its twin
const membersOf = (app: App, id: string): Element[] => [...(app.current() ?? document).querySelectorAll(`[data-group="${CSS.escape(id)}"]`)]
  .filter((el) => !!app.pairing?.elements.get(el)?.open && !(twinOf(app, el) && !el.getClientRects().length));

// a name of a group that is not on the page or in the file
export function freshGroup(app: App): string {
  const text = app.source?.text ?? '';
  for (let i = 1; ; i++) {
    const id = `g${i}`;
    if (!document.querySelector(`[data-group="${id}"]`) && !text.includes(`data-group="${id}"`)) return id;
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
// is a plate only as the first plate of a figure slide. elsewhere it is made a zone, the box of
// the theme for a figure beside other content, since a second plate is laid out under the slide
function plateToZone(app: App, copies: Element[]): void {
  for (const el of copies) {
    const slide = el.closest('section');
    if (!el.matches('.plate') || !slide || (slide.matches('.figure') && slide.querySelector(':scope > .plate') === el)) continue;
    app.doc.setTag(el, { classes: { plate: false, zone: true } }, 'layout');
  }
}

// the copies of a paste, a Duplicate, or a drag with the copy modifier, fitted to their slide
export function settleCopies(app: App, copies: Element[]): void {
  freshDataIds(app, copies);
  plateToZone(app, copies);
}

// two elements or more that are not one group already
const canGroup = (app: App): boolean => {
  const els = objectEls(app);
  const first = groupOf(els[0] ?? document.body);
  return els.length > 1 && !(first && els.every((el) => groupOf(el) === first));
};
const canUngroup = (app: App): boolean => objectEls(app).some((el) => groupOf(el));

function group(app: App): void {
  const els = objectEls(app);
  const id = freshGroup(app);
  for (const el of els) app.doc.setTag(el, { attrs: { 'data-group': id } }, 'group');
  app.selection.set('elements', els);
}

function ungroup(app: App): void {
  const els = objectEls(app);
  const ids = new Set(els.map(groupOf).filter((g): g is string => !!g));
  const all = [...ids].flatMap((id) => membersOf(app, id));
  for (const el of all) app.doc.setTag(el, { attrs: { 'data-group': null } }, 'ungroup');
  app.selection.set('elements', all);
}

// the elements of a lock or an unlock. a caret or a range in the text of a locked block unlocks
// the block, since a click into the text of a locked block puts the caret there
function lockTargets(app: App, on: boolean): Element[] {
  const els = objectEls(app);
  if (on || app.selection.kind !== 'text') return els;
  const blocks = app.selection.items.map((el) => el.closest('[data-locked]')).filter((el): el is Element => !!el);
  return [...new Set([...els, ...blocks])];
}

function setLock(app: App, on: boolean): void {
  const els = lockTargets(app, on).filter((el) => locked(el) !== on);
  for (const el of els) app.doc.setTag(el, { attrs: { 'data-locked': on ? '' : null } }, on ? 'lock' : 'unlock');
  app.invalidate('selection');
}

export { angleOf };

// the angle of a whole group, i.e. of its first member in the order of the page, or null when els
// are not one whole group that can be turned
export function groupAngle(app: App, els: Element[]): number | null {
  const turners = turnersOf(app, els);
  return turners ? turners[0].angle : null;
}

// the member of a group selected by itself with enterGroup, which keepGroups leaves alone while it
// is the whole selection
let entered: Element | null = null;

// selects el, a member of a selected group, by itself, as the second click on a member does in
// Keynote and PowerPoint
export function enterGroup(app: App, el: Element): void {
  entered = el;
  app.selection.set('elements', [el]);
}

// a selection that holds a member of a group holds every member, apart from a member selected by
// itself with enterGroup. a member taken off a selection that held its whole group and other
// elements, e.g. by a click with Shift, takes the whole group off, and a click that selects one
// member of a selected group keeps the group
function keepGroups(app: App): void {
  let before = new Set<Element>();
  let busy = false;
  app.selection.listen(() => {
    if (busy) return;
    const sel = app.selection;
    const els = sel.elements();
    if (entered && !(els.length === 1 && els[0] === entered)) entered = null;
    if (entered) {
      before = new Set(els);
      return;
    }
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

const ORDERS: { order: Order; label: string; mac: string; other: string }[] = [
  { order: 'front', label: 'Bring to Front', mac: 'Mod+Shift+F', other: 'Mod+Shift+ArrowUp' },
  { order: 'forward', label: 'Bring Forward', mac: 'Mod+Alt+Shift+F', other: 'Mod+ArrowUp' },
  { order: 'backward', label: 'Send Backward', mac: 'Mod+Alt+Shift+B', other: 'Mod+ArrowDown' },
  { order: 'back', label: 'Send to Back', mac: 'Mod+Shift+B', other: 'Mod+Shift+ArrowDown' },
];

export function commands(app: App): Command[] {
  const arrange = (order: number, group = 'order') => ({ bar: 'Arrange', group, order });
  const list: Command[] = ORDERS.map(({ order, label, mac, other }, i) => ({
    id: `arrange.order.${order}`,
    label,
    keys: { mac: [mac], other: [other] },
    in: ['canvas'],
    menu: arrange(50 + i),
    context: order === 'front' || order === 'back' ? ['element'] : undefined,
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
      enabled: canUngroup,
      undoable: true,
      run: ungroup,
    },
    {
      // the item of the context menu, which groups or ungroups the selection
      id: 'arrange.toggleGroup',
      label: (app) => (canUngroup(app) && !canGroup(app) ? 'Ungroup' : 'Group'),
      listedAs: (app) => (canUngroup(app) && !canGroup(app) ? 'arrange.ungroup' : 'arrange.group'),
      context: ['element'],
      enabled: (app) => canGroup(app) || canUngroup(app),
      undoable: true,
      run: (app) => (canGroup(app) ? group(app) : ungroup(app)),
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
      enabled: (app) => selectedEls(app).some(turnable),
      run: (app, arg) => {
        const a = (arg ?? {}) as { deg?: number; els?: Element[] };
        if (typeof a.deg !== 'number' || !Number.isFinite(a.deg)) return;
        const deg = ((Math.round(a.deg) % 360) + 360) % 360;
        const els = (a.els ?? selectedEls(app)).filter((el) => el.isConnected);
        // the places of the elements that a turn changes, before and after it, as one entry
        const turned = (moved: Element[], run: () => void) => {
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
        turned([...new Set(pairs.flatMap((t) => [t.spin, t.carrier]))], () => {
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
        const group = groupAngle(app, els);
        return group !== null ? group !== 0 : els.some((el) => turnable(el) && angleOf(el) !== 0);
      },
      run: (app) => app.commands.run('arrange.setRotation', { deg: 0 }),
    },
  );
  return list;
}

// the commands that change the elements of the selection or the text of a block of it, which a
// lock turns off, as Keynote does until a locked object is unlocked. Copy, Duplicate, and the
// commands that select or show the selection are kept, and so are Lock and Unlock
const CHANGES = new RegExp([
  '^(figure|image|media|code|surface|line|backdrop|math|text)\\.',
  '^plot\\.(?!closeData$)',
  '^arrange\\.(?!(lock|unlock|toggleLock)$)',
  '^table\\.(?!(select|extend|cell\\.))',
  '^steps\\.(set|add|remove|start|delay|deliver|listDelivery|final|move|earlier|later|effect)$',
  '^(edit\\.cut|selection\\.editText)$',
].join('|'));

// the focused text that is not a text of the slides, i.e. a line of the outline or a field of a
// pane. the commands of the Edit menu act on its text, and not on the selection of the canvas
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
  // a lock holds an element of the slide, and not the text of a line of the outline or of a field,
  // on which Cut, Paste, and Delete act while the caret is in it
  const inField = (a: App, id: string) => /^(edit\.(cut|paste)|element\.delete)$/.test(id) && !!fieldOf(a);
  app.commands.veto((a, c) => !inField(a, c.id) && (CHANGES.test(c.id) || (c.id === 'edit.paste' && a.selection.kind === 'text')) && lockedSelection(a));
  // Delete skips a locked element, hence it is turned off only when every selected element is locked
  app.commands.veto((a, c) => c.id === 'element.delete' && !inField(a, c.id) && a.selection.kind !== 'text' && a.selection.elements().length > 0 && a.selection.elements().every((el) => !!el.closest('[data-locked]')));
  // typing, a drop, and the keys that delete or break a line do not go through a command, hence
  // they are cancelled before the browser changes the text of a locked block
  document.addEventListener('beforeinput', (ev) => {
    if (ev.target instanceof Element && ev.target.closest('.reveal .slides [data-locked]')) ev.preventDefault();
  }, true);
}
