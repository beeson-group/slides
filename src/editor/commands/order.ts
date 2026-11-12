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
import { objectOf, objectsOf, turnable, twinOf } from '../canvas/hit.ts';
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

// the place of an element in the order of its siblings from back to front: its z-index, then its
// index in the file. an element that is not a layer is drawn under the layers of z-index 0
type Key = [number, number];
const under = (a: Key, b: Key): boolean => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
const indexOf = (el: Element): number => [...(el.parentElement?.children ?? [])].indexOf(el);
const keyOf = (el: Element): Key => [isLayer(el) ? zOf(el) : -0.5, indexOf(el)];

// whether a is drawn under b, by the order of the children of their nearest common ancestor
export function drawnUnder(a: Element, b: Element): boolean {
  let x: Element = a;
  while (x.parentElement && !x.parentElement.contains(b)) x = x.parentElement;
  let y: Element = b;
  while (y.parentElement && y.parentElement !== x.parentElement) y = y.parentElement;
  if (x === y || y.parentElement !== x.parentElement) return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  return under(keyOf(x), keyOf(y));
}

// an element with a box on the slide, which the object list shows
const drawn = (el: Element): boolean => getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;

// the drawn children of parent in the file apart from the speaker notes, from back to front, as the
// object list shows them
function layersOf(app: App, parent: Element): Element[] {
  return [...parent.children]
    .filter((s) => !s.hasAttribute('data-generated') && !!app.pairing?.elements.has(s) && !s.matches('aside.notes') && drawn(s))
    .sort((a, b) => (under(keyOf(a), keyOf(b)) ? -1 : 1));
}

// a plate or a backdrop is the back layer of its layout. a command does not move it, and Send to
// Back and Send Backward do not pass it
const BACK = '.plate, .backdrop';
const same = (a: Element[], b: Element[]): boolean => a.length === b.length && a.every((e, i) => e === b[i]);

// list, from back to front, in the order that a command gives the elements of moving, which keep
// their own order. Bring Forward and Send Backward pass one element of list
function targetOf(list: Element[], moving: Set<Element>, order: Order): Element[] {
  const out = list.slice();
  const m = (e: Element) => moving.has(e) && !e.matches(BACK);
  if (order === 'front') return [...out.filter((e) => !m(e)), ...out.filter(m)];
  if (order === 'back') {
    const first = out.findIndex(m);
    const rest = out.filter((e) => !m(e));
    let at = 0;
    for (let i = 0; i < first; i++) if (out[i].matches(BACK)) at = rest.indexOf(out[i]) + 1;
    return first < 0 ? out : [...rest.slice(0, at), ...out.filter(m), ...rest.slice(at)];
  }
  if (order === 'forward') {
    for (let i = out.length - 2; i >= 0; i--) if (m(out[i]) && !m(out[i + 1])) [out[i], out[i + 1]] = [out[i + 1], out[i]];
  } else {
    for (let i = 1; i < out.length; i++) if (m(out[i]) && !m(out[i - 1]) && !out[i - 1].matches(BACK)) [out[i - 1], out[i]] = [out[i], out[i - 1]];
  }
  return out;
}

// the declarations position: relative and z-index in the style of an element
type Choice = { pos: boolean; z: number | null };
// what the order of el depends on: whether it is positioned without position: relative, whether it
// is turned or moved, its z-index without a z-index in its style, and its declarations now and in
// the file. ref is the file without the declarations of the form that a layer command writes on an
// element that the command moves, which the command may thus take off
type Fact = { el: Element; moving: boolean; placed: boolean; turned: boolean; base: number; now: Choice; file: Choice; ref: Choice; fixPos: boolean; fixZ: boolean };

const zIn = (v: string | undefined): number | null => (v !== undefined && /^-?\d+$/.test(v.trim()) ? Number(v) : null);

function factOf(app: App, el: Element, moving: boolean): Fact {
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
  return { el, moving, placed, turned, base, now, file, ref: form ? { pos: false, z: null } : file, fixPos, fixZ };
}

// the place of the element of f with the declarations of c, at index i of the file, as keyOf
// gives it. a z-index applies to a positioned element only
const keyWith = (f: Fact, c: Choice, i: number): Key => (f.placed || c.pos ? [c.z ?? f.base, i] : [f.turned ? 0 : -0.5, i]);

// the declarations that a command may give the element of f. on an element that it does not move,
// a declaration of the file stays, or is put back once a command has changed it
function choicesOf(f: Fact, lo: number, hi: number): Choice[] {
  const out: Choice[] = [{ pos: false, z: null }, f.now, f.file];
  if (!f.placed && !f.fixPos) out.push({ pos: true, z: null });
  if (!f.fixZ && (f.placed || !f.fixPos)) for (let z = lo; z <= hi; z++) if (z !== f.base) out.push({ pos: !f.placed, z });
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
// indices of index, or null when no choice does
function solve(facts: Fact[], index: (el: Element) => number, lo: number, hi: number): { cost: number; choices: Choice[] } | null {
  type Step = { key: Key; cost: number; path: Choice[] };
  let prev: Step[] = [{ key: [-Infinity, -Infinity], cost: 0, path: [] }];
  for (const f of facts) {
    const i = index(f.el);
    const next: Step[] = [];
    for (const c of choicesOf(f, lo, hi)) {
      const key = keyWith(f, c, i);
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

// the children of parent in the order of the file, and the declarations of each element of
// target, that draw target from back to front at the lowest cost. an element of moving out of the
// flow is moved in the file where this saves a declaration, since a move in the file does not
// move it on the slide
type Plan = { kids: Element[]; facts: Fact[]; choices: Choice[]; moving: Element[] };
function planOf(app: App, parent: Element, target: Element[], moving: Element[]): Plan | null {
  const facts = target.map((el) => factOf(app, el, moving.includes(el)));
  const lo = stacks(parent) ? -target.length : 0;
  const hi = Math.max(0, ...facts.map((f) => f.base)) + target.length;
  const free = moving.filter((e) => target.includes(e) && !inFlow(e) && !e.matches(BACK));
  const kids = [...parent.children];
  // the place of el among the children that stay
  const rank = (el: Element, order: Element[]) => order.filter((k) => k === el || !free.includes(k)).indexOf(el);
  const costIn = (order: Element[]) => {
    const s = solve(facts, (el) => order.indexOf(el), lo, hi);
    const moves = free.reduce((sum, el) => sum + (rank(el, order) === rank(el, kids) ? 0 : MOVE + Math.abs(rank(el, order) - rank(el, kids))), 0);
    return s ? { ...s, cost: s.cost + moves, order } : null;
  };
  let best = costIn(kids);
  for (const el of free) {
    const now = best?.order ?? kids;
    const without = now.filter((k) => k !== el);
    // a move helps only next to the elements just under and over el in target
    const k = target.indexOf(el);
    const near = [target[k - 1], target[k + 1]].filter((t) => t !== undefined);
    for (const at of new Set(near.flatMap((t) => [without.indexOf(t), without.indexOf(t) + 1]))) {
      const s = costIn([...without.slice(0, at), el, ...without.slice(at)]);
      if (s && (!best || s.cost < best.cost)) best = s;
    }
  }
  return best ? { kids: best.order, facts, choices: best.choices, moving: free } : null;
}

async function applyPlan(app: App, parent: Element, plan: Plan): Promise<void> {
  for (const [at, el] of plan.kids.entries()) {
    if (!plan.moving.includes(el)) continue;
    const prev = plan.kids[at - 1] ?? null;
    if (el.previousElementSibling === prev) continue;
    await app.doc.move(el, parent, prev ? prev.nextSibling : parent.firstElementChild, 'order');
  }
  plan.facts.forEach((f, i) => {
    const c = plan.choices[i];
    const style: Record<string, string | null> = {};
    if (c.pos !== f.now.pos) style.position = c.pos ? 'relative' : null;
    if (c.z !== f.now.z) style['z-index'] = c.z === null ? null : String(c.z);
    if (Object.keys(style).length) app.doc.setTag(f.el, { style }, 'order');
  });
}

// the declarations of the layer commands on the children of every other parent of the slide of el
// written again at the lowest cost of their order, hence taken off once the order is the one of
// the file
async function tidy(app: App, el: Element, done: Iterable<Element>): Promise<void> {
  const skip = new Set(done);
  const slide = el.closest('section');
  const parents = new Set([...(slide?.querySelectorAll('[style]') ?? [])].filter((e) => {
    const s = (e as HTMLElement).style;
    return (s.position || s.zIndex) && !!e.parentElement && !skip.has(e.parentElement);
  }).map((e) => e.parentElement!));
  for (const parent of parents) {
    const list = layersOf(app, parent);
    const plan = planOf(app, parent, list, []);
    if (plan) await applyPlan(app, parent, plan);
  }
}

// whether a command changes the order of the children of parent for the elements of els, and,
// with solved, whether declarations draw this order
function changes(app: App, parent: Element | null, els: Set<Element>, o: Order, solved = true): boolean {
  const list = parent ? layersOf(app, parent) : [];
  const target = targetOf(list, els, o);
  return !same(target, list) && (!solved || !!planOf(app, parent!, target, [...els]));
}

// the order of the children of parent that a command gives to the elements of els, applied, or
// false when they stay
async function arrange(app: App, parent: Element, els: Element[], o: Order): Promise<boolean> {
  const list = layersOf(app, parent);
  const target = targetOf(list, new Set(els), o);
  const plan = same(target, list) ? null : planOf(app, parent, target, els);
  if (plan) await applyPlan(app, parent, plan);
  return !!plan;
}

// whether Bring Forward, or Send Backward with up false, would move el by itself
export const canStep = (app: App, el: Element, up: boolean): boolean => changes(app, el.parentElement, new Set([el]), up ? 'forward' : 'backward', false);

// the last element that Bring to Front, or Send to Back with up false, puts el in front of or
// behind, with the elements of selected passed over, or null when el does not move
export function layerLimit(app: App, el: Element, up: boolean, selected: Set<Element>): Element | null {
  const list = el.parentElement ? layersOf(app, el.parentElement) : [];
  const target = targetOf(list, selected, up ? 'front' : 'back');
  const k = list.indexOf(el);
  const passed = list.filter((s, i) => !selected.has(s) && (up ? i > k : i < k && target.indexOf(s) > target.indexOf(el)));
  return (up ? passed.at(-1) : passed[0]) ?? null;
}

// el moved by one layer, as Bring Forward or Send Backward moves it, for a drag of a row of
// navigator/objects.ts. it returns false when el does not move
export async function stepLayer(app: App, el: Element, up: boolean): Promise<boolean> {
  const parent = el.parentElement;
  if (!parent || !(await arrange(app, parent, [el], up ? 'forward' : 'backward'))) return false;
  await tidy(app, el, [parent]);
  return true;
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

// the elements of els by their parent
function byParent(els: Element[]): Map<Element, Element[]> {
  const out = new Map<Element, Element[]>();
  for (const el of els) if (el.parentElement) out.set(el.parentElement, [...(out.get(el.parentElement) ?? []), el]);
  return out;
}

const canOrder = (app: App, o: Order): boolean => [...byParent(objectEls(app))].some(([parent, els]) => changes(app, parent, new Set(els), o));

async function reorder(app: App, o: Order): Promise<void> {
  const before = app.selection.elements().slice();
  const parents = byParent(objectEls(app));
  for (const [parent, els] of parents) await arrange(app, parent, els, o);
  const first = [...parents.values()][0]?.[0];
  if (first) await tidy(app, first, parents.keys());
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
