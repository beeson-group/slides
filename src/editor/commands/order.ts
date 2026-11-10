// the commands of the order, the groups, the locks, and the rotation of the elements, as in the
// Arrange menu of Keynote. the order of an element is the order of its unit among its siblings,
// since an element of the theme does not set a z-index, and a later sibling is drawn over an
// earlier one. a group is the elements with the same data-group, selected and dragged together,
// and a locked element, with data-locked, is not moved by the pointer, the keys, or the fields.
// each command is one entry of the history

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { locked, placeOf, record, writePlace } from '../canvas/drag.ts';
import { objectsOf, turnable } from '../canvas/hit.ts';

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

// the siblings of el in the file, in the order of the page
function siblingsOf(app: App, el: Element): Element[] {
  const parent = el.parentElement;
  if (!parent) return [];
  return [...parent.children].filter((s) => !s.hasAttribute('data-generated') && !!app.pairing?.elements.has(s));
}

// the sibling that el is put after, or before for a move back, or null when el does not move. el
// passes only siblings that a move does not change on the slide: an element in the flow passes
// only elements out of it, and the selected elements are passed over
function targetOf(app: App, el: Element, order: Order, selected: Set<Element>): Element | null {
  if (!isLayer(el)) return null;
  const list = siblingsOf(app, el);
  const at = list.indexOf(el);
  const up = order === 'front' || order === 'forward';
  const way = up ? list.slice(at + 1) : list.slice(0, at).reverse();
  const flow = inFlow(el);
  const reached: Element[] = [];
  for (const s of way) {
    if (flow && inFlow(s)) break;
    if (!selected.has(s) && isLayer(s)) reached.push(s);
  }
  if (!reached.length) return null;
  return order === 'forward' || order === 'backward' ? reached[0] : reached[reached.length - 1];
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
  return els.some((el) => targetOf(app, el, order, set) !== null);
};

async function reorder(app: App, order: Order): Promise<void> {
  const before = app.selection.elements().slice();
  const els = objectEls(app);
  const set = new Set(els);
  const up = order === 'front' || order === 'forward';
  // the elements in the order that keeps their own order: the last first for a move up
  for (const el of up ? [...els].reverse() : els) {
    const target = targetOf(app, el, order, set);
    if (!target) continue;
    await app.doc.move(el, el.parentElement!, up ? target.nextSibling : target, 'order');
  }
  app.selection.set('elements', before.filter((el) => el.isConnected));
  app.invalidate('content');
}

// the members of a group on the page
const membersOf = (app: App, id: string): Element[] => [...(app.current() ?? document).querySelectorAll(`[data-group="${CSS.escape(id)}"]`)].filter((el) => !!app.pairing?.elements.get(el)?.open);

// a name of a group that is not on the page or in the file
export function freshGroup(app: App): string {
  const text = app.source?.text ?? '';
  for (let i = 1; ; i++) {
    const id = `g${i}`;
    if (!document.querySelector(`[data-group="${id}"]`) && !text.includes(`data-group="${id}"`)) return id;
  }
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

// the angle of el in degrees, from 0 to 359
export const angleOf = (el: Element): number => placeOf(el).rotate ?? 0;

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

export function commands(): Command[] {
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
      context: ['element'],
      enabled: (app) => canGroup(app) || canUngroup(app),
      undoable: true,
      run: (app) => (canGroup(app) ? group(app) : ungroup(app)),
    },
    {
      id: 'arrange.lock',
      label: 'Lock',
      // Safari takes Cmd+L of Keynote before the page, and Chrome and Firefox pass it on
      keys: { mac: ['Ctrl+Mod+L', 'Mod+L'], other: ['Mod+L'] },
      in: ['canvas'],
      menu: arrange(70, 'lock'),
      enabled: (app) => objectEls(app).some((el) => !locked(el)),
      undoable: true,
      run: (app) => setLock(app, true),
    },
    {
      id: 'arrange.unlock',
      label: 'Unlock',
      keys: { mac: ['Mod+Alt+L'], other: ['Mod+Shift+L'] },
      in: ['canvas', 'text'],
      menu: arrange(71, 'lock'),
      enabled: (app) => lockTargets(app, false).some(locked),
      undoable: true,
      run: (app) => setLock(app, false),
    },
    {
      id: 'arrange.toggleLock',
      label: (app) => (objectEls(app).length && objectEls(app).every(locked) ? 'Unlock' : 'Lock'),
      context: ['element'],
      enabled: (app) => objectEls(app).length > 0,
      undoable: true,
      run: (app) => setLock(app, !objectEls(app).every(locked)),
    },
    {
      // arg is { deg, els }, the angle in degrees, of the elements, or of the selection by default
      id: 'arrange.setRotation',
      label: 'Rotate',
      enabled: (app) => selectedEls(app).some(turnable),
      run: (app, arg) => {
        const a = (arg ?? {}) as { deg?: number; els?: Element[] };
        if (typeof a.deg !== 'number' || !Number.isFinite(a.deg)) return;
        const deg = ((Math.round(a.deg) % 360) + 360) % 360;
        const changes = (a.els ?? selectedEls(app)).filter((el) => el.isConnected && turnable(el)).map((el) => {
          const from = placeOf(el);
          const to = { ...from, rotate: deg || null };
          writePlace(app, el, to);
          return { el, from, to };
        });
        record(app, 'rotate', changes);
        app.invalidate('content');
      },
    },
    {
      id: 'arrange.resetRotation',
      label: 'Reset Rotation',
      menu: { bar: 'Arrange', group: 'reset', order: 12 },
      enabled: (app) => selectedEls(app).some((el) => turnable(el) && angleOf(el) !== 0),
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
  for (const c of commands()) app.commands.define(c);
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
