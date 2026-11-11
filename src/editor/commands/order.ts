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
// the z-index that the browser applies to el, 0 for auto, and the one el has without its style
const zOf = (el: Element): number => (getComputedStyle(el).position === 'static' ? 0 : parseInt(getComputedStyle(el).zIndex, 10) || 0);
const baseZ = (el: Element): number => ((el as HTMLElement).style.zIndex ? (el.matches(RAISED) ? 1 : 0) : zOf(el));
// whether the theme positions el, i.e. whether a z-index applies to it without position: relative
const placedByTheme = (el: Element): boolean => !(el as HTMLElement).style.position && getComputedStyle(el).position !== 'static';

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

// the siblings of el in the file, in the order of the page
function siblingsOf(app: App, el: Element): Element[] {
  const parent = el.parentElement;
  if (!parent) return [];
  return [...parent.children].filter((s) => !s.hasAttribute('data-generated') && !!app.pairing?.elements.has(s));
}

// the layers among the siblings of el from back to front, and the last one that a command puts el
// past, with the selected ones passed over, or null when el does not move. a plate, the back layer
// of its layout, is not ordered
function pickOf(app: App, el: Element, order: Order, selected: Set<Element>): { list: Element[]; pick: Element } | null {
  if (el.matches('.plate')) return null;
  const list = siblingsOf(app, el).filter((s) => s !== el && isLayer(s)).sort((a, b) => (under(keyOf(a), keyOf(b)) ? -1 : 1));
  const k = keyOf(el);
  const up = order === 'front' || order === 'forward';
  const passed = list.filter((s) => !selected.has(s) && (up ? under(k, keyOf(s)) : under(keyOf(s), k)));
  if (!passed.length) return null;
  return { list, pick: order === 'front' || order === 'backward' ? passed[passed.length - 1] : passed[0] };
}

// whether el has a declaration of applyPlan, and its place without them, i.e. in the order of the file
const ordered = (el: Element): boolean => !!((el as HTMLElement).style.zIndex || (el as HTMLElement).style.position);
function homeOf(el: Element): Key {
  const c = getComputedStyle(el);
  const layer = placedByTheme(el) || c.transform !== 'none' || c.translate !== 'none' || c.rotate !== 'none';
  return [layer ? baseZ(el) : -0.5, indexOf(el)];
}

// the order that a command gives el: its z-index, and the sibling that it is put before in the
// file, or undefined when it stays. el is put between the layers lo and hi of its siblings
type Plan = { z: number; before?: Node | null; home?: boolean };
function planOf(app: App, el: Element, order: Order, selected: Set<Element>): Plan | null {
  const found = pickOf(app, el, order, selected);
  const up = order === 'front' || order === 'forward';
  // an element with the declarations of a layer command that has no layer left to pass is put back
  // in the order of the file when this is a step the right way
  const home = ordered(el) && !el.matches('.plate') ? homeOf(el) : null;
  if (!found) return home && (up ? under(keyOf(el), home) : under(home, keyOf(el))) ? { z: baseZ(el), home: true } : null;
  const { list, pick } = found;
  const at = list.indexOf(pick);
  // the first step forward of an element that is not a layer makes it the layer at the back
  const first = order === 'forward' && !isLayer(el);
  const lo = up && !first ? pick : list[at - 1];
  const hi = up && !first ? list[at + 1] : pick;
  const fits = (z: number, i: number) => (!lo || under(keyOf(lo), [z, i])) && (!hi || under([z, i], keyOf(hi)));
  if (home && fits(...home)) return { z: home[0], home: true };
  const base = baseZ(el);
  const i = indexOf(el);
  // an element out of the flow is moved in the file, after lo or before hi, as far as it can
  // keep the z-index of the theme
  const move = !inFlow(el) ? { before: lo ? lo.nextSibling : hi } : null;
  const anchor = lo ? indexOf(lo) + 0.5 : indexOf(hi) - 0.5;
  if (fits(base, i)) return { z: base };
  if (move && fits(base, anchor)) return { z: base, ...move };
  // else the z-index nearest to that of the theme with which el stays in the file, or, for an
  // element in the flow that cannot stay between lo and hi, the z-index that passes the layer picked
  const zmin = lo ? (i > indexOf(lo) ? zOf(lo) : zOf(lo) + 1) : -Infinity;
  const zmax = hi ? (i < indexOf(hi) ? zOf(hi) : zOf(hi) - 1) : Infinity;
  if (zmin <= zmax) return { z: Math.min(Math.max(base, zmin), zmax) };
  if (move) return { z: zOf(lo ?? hi), ...move };
  // the order of the file, when it passes the same layers as this z-index
  const z = up ? zmin : zmax;
  const [a, b]: Key[] = up ? [[z, i], home ?? [z, i]] : [home ?? [z, i], [z, i]];
  if (home && (up ? under(keyOf(lo), home) : under(home, keyOf(hi))) && !list.some((s) => under(a, keyOf(s)) && under(keyOf(s), b))) return { z: home[0], home: true };
  return { z };
}

// el given the order of plan, by a move in the file and the declarations z-index and position.
// position: relative is written only on an element that the theme does not position, since a
// z-index applies to a positioned element only, and an element that is not moved or turned is a
// layer only once it is positioned
async function applyPlan(app: App, el: Element, plan: Plan): Promise<void> {
  if (plan.before !== undefined) await app.doc.move(el, el.parentElement!, plan.before, 'order');
  const s = (el as HTMLElement).style;
  const z = plan.home || plan.z === baseZ(el) ? null : String(plan.z);
  const c = getComputedStyle(el);
  const turned = c.transform !== 'none' || c.translate !== 'none' || c.rotate !== 'none';
  const position = plan.home || placedByTheme(el) || (z === null && turned) ? null : 'relative';
  const style: Record<string, string | null> = {};
  if (!placedByTheme(el) && s.position !== (position ?? '')) style.position = position;
  if (s.zIndex !== (z ?? '')) style['z-index'] = z;
  if (Object.keys(style).length) app.doc.setTag(el, { style }, 'order');
}

// whether Bring Forward, or Send Backward with up false, would move el by itself
export const canStep = (app: App, el: Element, up: boolean): boolean => planOf(app, el, up ? 'forward' : 'backward', new Set([el])) !== null;

// the layer that Bring to Front, or Send to Back with up false, puts el in front of or behind, with
// the elements of selected passed over, or null when el does not move
export const layerLimit = (app: App, el: Element, up: boolean, selected: Set<Element>): Element | null => pickOf(app, el, up ? 'front' : 'back', selected)?.pick ?? null;

// el moved by one layer, as Bring Forward or Send Backward moves it, for a drag of a row of
// navigator/objects.ts. it returns false when el does not move
export async function stepLayer(app: App, el: Element, up: boolean): Promise<boolean> {
  const plan = planOf(app, el, up ? 'forward' : 'backward', new Set([el]));
  if (!plan) return false;
  await applyPlan(app, el, plan);
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

const canOrder = (app: App, order: Order): boolean => {
  const els = objectEls(app);
  const set = new Set(els);
  return els.some((el) => planOf(app, el, order, set) !== null);
};

async function reorder(app: App, order: Order): Promise<void> {
  const before = app.selection.elements().slice();
  const els = objectEls(app);
  const set = new Set(els);
  const up = order === 'front' || order === 'forward';
  // the elements in the order that keeps their own order: the front one first for a move up
  els.sort((a, b) => (drawnUnder(a, b) === up ? 1 : -1));
  for (const el of els) {
    const plan = planOf(app, el, order, set);
    if (plan) await applyPlan(app, el, plan);
  }
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

// whether the selection holds a locked element, an element inside one, or a text of one
export function lockedSelection(app: App): boolean {
  const sel = app.selection;
  const els = sel.kind === 'text' ? sel.items : sel.elements();
  return els.some((el) => !!el.closest('[data-locked]') || !!el.querySelector('[data-locked]'));
}

export function install(app: App): void {
  for (const c of commands(app)) app.commands.define(c);
  keepGroups(app);
  app.commands.veto((a, c) => (CHANGES.test(c.id) || (c.id === 'edit.paste' && a.selection.kind === 'text')) && lockedSelection(a));
  // Delete skips a locked element, hence it is turned off only when every selected element is locked
  app.commands.veto((a, c) => c.id === 'element.delete' && a.selection.kind !== 'text' && a.selection.elements().length > 0 && a.selection.elements().every((el) => !!el.closest('[data-locked]')));
  // typing, a drop, and the keys that delete or break a line do not go through a command, hence
  // they are cancelled before the browser changes the text of a locked block
  document.addEventListener('beforeinput', (ev) => {
    if (ev.target instanceof Element && ev.target.closest('.reveal .slides [data-locked]')) ev.preventDefault();
  }, true);
}
