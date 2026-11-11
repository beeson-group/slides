// the object list of Keynote (View > Object List), under the thumbnails in the column of the
// navigator: a row for each element of the current slide that can be selected, from front to back,
// with an icon of its kind, a name made of its kind and the first words of its text, and a padlock
// that locks and unlocks it. the members of a group are rows under a row of the group, which is
// folded with its chevron. a click selects, Shift and the command modifier add or take a row off
// the selection, and a drag of a row changes its layer within the limits of the layer commands of
// commands/order.ts. a group row is dragged as one object, whose members keep their order.
// a member row is dragged as an object of its own, and it stays in its group. the field at the bottom filters the rows by their name, as the search of
// Keynote. an element of the theme does not have a name or a hidden state, hence a row is not
// renamed or hidden

import type { App } from '../app.ts';
import { OUTSIDE_DIALOGS } from '../commands.ts';
import { CONTAINER, LINE, hasText, linesOf, movablesOf, objectOf } from '../canvas/hit.ts';
import { locked } from '../canvas/drag.ts';
import { canStep, enterGroup, groupOf, stepLayer } from '../commands/order.ts';
import { injectStyle, make, store, stored } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';

const KEY = 'beeson-edit-objects';
const SVG = 'http://www.w3.org/2000/svg';
// the distance in CSS px by which a press is moved before it is a drag
const DRAG_START = 4;
// the longest name of a row before its words are cut, in characters
const NAME_MAX = 34;

// the glyphs that ui/icons.ts does not have, on its grid of 20 px
const GLYPHS: Record<string, string[]> = {
  line: ['M4.5 15.5 15.5 4.5'],
  arrow: ['M4.5 15.5 15.5 4.5', 'M9.5 4.5h6v6'],
  code: ['M7 6l-4 4 4 4', 'M13 6l4 4-4 4'],
  group: ['M3 3.5h9v9H3z', 'M8 7.5h9v9H8z'],
  plot: ['M3.5 3.5v13h13', 'M6.5 12.5l3-4 3 2 3.5-5'],
  lock: ['M5.5 9h9v7.5h-9z', 'M7.5 9V6.5a2.5 2.5 0 0 1 5 0V9'],
  unlock: ['M5.5 9h9v7.5h-9z', 'M12.5 9V6a2.5 2.5 0 0 1 5 0v1'],
  search: ['M8.5 3.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10z', 'M12.25 12.25 16.5 16.5'],
};

function glyph(name: string, size = 16): SVGSVGElement {
  const paths = GLYPHS[name];
  if (!paths) return icon(name, size);
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('beeson-icon');
  for (const d of paths) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
  }
  return svg;
}

const CSS = `
html.beeson-editor { --ed-objects-h: 45%; }
html.beeson-editor.beeson-nav.beeson-objects body > .beeson-edit-nav { align-self: start; height: calc(100% - var(--ed-objects-h)); }
html.beeson-editor body > .beeson-edit-objects { grid-area: nav; align-self: end; position: relative; z-index: 50; height: var(--ed-objects-h); min-height: 0; min-width: 0; display: flex; flex-direction: column; box-sizing: border-box; background: var(--ed-panel); border-top: 1px solid var(--ed-line); border-right: 1px solid var(--ed-line); color: var(--ed-text); font: 12px/1.35 var(--ed-font); }
html.beeson-editor body > .beeson-edit-objects[hidden] { display: none; }
.beeson-edit-objects .head { flex: none; padding: 7px 10px 3px; color: var(--ed-muted); font-weight: 600; font-size: 11px; }
.beeson-edit-objects .list { position: relative; flex: 1; min-height: 0; overflow: auto; padding: 2px 6px 8px; outline: none; }
.beeson-edit-objects .row { position: relative; display: flex; align-items: center; gap: 5px; height: 24px; padding: 0 2px 0 4px; border-radius: 5px; cursor: default; touch-action: none; white-space: nowrap; }
.beeson-edit-objects .row[aria-level="2"] { padding-left: 22px; }
.beeson-edit-objects .row:hover:not([aria-selected="true"]) { background: var(--ed-hover); }
.beeson-edit-objects .row[aria-selected="true"] { background: var(--ed-select); color: var(--ed-on-select); }
.beeson-edit-objects .row:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: -2px; }
.beeson-edit-objects .row.dragged { opacity: 0.4; }
.beeson-edit-objects .twist { flex: none; display: grid; place-items: center; width: 14px; height: 14px; color: var(--ed-muted); }
.beeson-edit-objects .row[aria-selected="true"] .twist { color: inherit; }
.beeson-edit-objects .row[aria-expanded="true"] .twist svg { transform: rotate(90deg); }
.beeson-edit-objects .kind { flex: none; color: var(--ed-muted); }
.beeson-edit-objects .row[aria-selected="true"] .kind { color: inherit; }
.beeson-edit-objects .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.beeson-edit-objects .lock { flex: none; display: grid; place-items: center; width: 22px; height: 20px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--ed-faint); }
.beeson-edit-objects .lock[aria-pressed="true"] { color: var(--ed-text); }
.beeson-edit-objects .row[aria-selected="true"] .lock { color: color-mix(in srgb, var(--ed-on-select) 60%, transparent); }
.beeson-edit-objects .row[aria-selected="true"] .lock[aria-pressed="true"] { color: var(--ed-on-select); }
.beeson-edit-objects .lock:hover { background: var(--ed-pressed); }
.beeson-edit-objects .drop { position: absolute; left: 6px; right: 6px; height: 2px; margin-top: -1px; border-radius: 1px; background: var(--ed-select); pointer-events: none; }
.beeson-edit-objects .drop[hidden], .beeson-edit-objects .empty[hidden] { display: none; }
.beeson-edit-objects .empty { padding: 10px; color: var(--ed-muted); text-align: center; }
.beeson-edit-objects .search { flex: none; position: relative; padding: 6px 8px; border-top: 1px solid var(--ed-line); }
.beeson-edit-objects .search svg { position: absolute; left: 14px; top: 50%; margin-top: -7px; color: var(--ed-muted); pointer-events: none; }
.beeson-edit-objects .search input { box-sizing: border-box; width: 100%; height: 24px; padding: 0 8px 0 24px; border: 1px solid var(--ed-control-line); border-radius: 6px; background: var(--ed-control); color: var(--ed-text); font: 12px var(--ed-font); outline: none; }
.beeson-edit-objects .search input:focus { border-color: var(--ed-select); box-shadow: 0 0 0 3px var(--ed-focus); }
`;

// the words of the text of el, without the rendering of its formulas, cut at a word
function wordsOf(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  for (const m of copy.querySelectorAll('mjx-container, [data-generated], .beeson-handle')) m.remove();
  const text = (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= NAME_MAX) return text;
  const cut = text.slice(0, NAME_MAX + 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > NAME_MAX / 2 ? cut.slice(0, space) : cut.slice(0, NAME_MAX)).replace(/[\s,;:.]+$/, '')}…`;
}

// the kind of el, its icon, and its name in the list
export function describeObject(el: Element): { kind: string; icon: string; name: string } {
  const named = (kind: string, glyphName: string, words = '') => ({ kind, icon: glyphName, name: words ? `${kind}: ${words}` : kind });
  if (el.matches(LINE)) {
    const line = el.querySelector('line');
    return line?.hasAttribute('marker-end') || line?.hasAttribute('marker-start') ? named('Arrow', 'arrow') : named('Line', 'line');
  }
  if (el.matches('div.math')) return named('Formula', 'formula');
  if (el.matches('table')) return named('Table', 'table');
  if (el.matches('pre')) return named('Code', 'code');
  if (el.matches('img')) return named('Image', 'image');
  if (el.matches('video')) return named('Video', 'video');
  if (el.matches('.qr')) return named('QR Code', 'qr');
  if (el.matches('tycho-viewer')) return named('Scene', 'shape');
  if (el.matches(CONTAINER)) {
    const caption = el.querySelector(':scope > figcaption, :scope > .caption');
    const words = caption ? wordsOf(caption) : '';
    if (el.querySelector('.plot')) return named('Plot', 'plot', words);
    if (el.querySelector('tycho-viewer')) return named('Scene', 'shape', words);
    if (el.querySelector('video')) return named('Video', 'video', words);
    if (el.querySelector('.qr')) return named('QR Code', 'qr', words);
    return named('Figure', 'image', words);
  }
  return named('Text', 'text', hasText(el) || el.textContent?.trim() ? wordsOf(el) : '');
}

// a row of the list: an element, or a group with its members
type Item = { el: Element; group: null } | { el: null; group: string; members: Element[] };

type Key = Element | string;
const keyOf = (item: Item): Key => item.el ?? `group:${item.group}`;

// whether b comes after a in the document, i.e. is drawn over it among the same siblings
const before = (a: Element, b: Element): boolean => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

export function install(app: App): void {
  injectStyle('objects', CSS);
  const root = make('div', 'beeson-edit-objects');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Objects');
  const head = make('div', 'head', 'Objects');
  const list = make('div', 'list');
  list.setAttribute('role', 'tree');
  list.setAttribute('aria-label', 'Objects of the slide');
  list.setAttribute('aria-multiselectable', 'true');
  const drop = make('div', 'drop');
  drop.hidden = true;
  const empty = make('div', 'empty');
  const search = make('div', 'search');
  const field = make('input');
  field.type = 'search';
  field.placeholder = 'Search';
  field.setAttribute('aria-label', 'Search the objects');
  search.append(glyph('search', 14), field);
  root.append(head, list, empty, search);
  root.hidden = true;

  let on = stored(KEY) === '1';
  const folded = new Set<string>();
  // the key of the row with the focus, kept over a rebuild of the rows
  let focusKey: Element | string | null = null;
  let rows: { item: Item; row: HTMLElement }[] = [];
  let press: { els: Element[]; key: Key; x: number; y: number; id: number; on: boolean; gap: number } | null = null;

  const mod = (ev: MouseEvent | KeyboardEvent) => (app.platform === 'mac' ? ev.metaKey : ev.ctrlKey);
  const outlineShown = () => !!(app.nav as unknown as { outline?: { shown: boolean } }).outline?.shown;

  // the objects of the current slide from front to back, i.e. in the reverse order of the page
  const objects = (): Element[] => {
    if (app.state !== 'loaded') return [];
    const found = [...movablesOf(app), ...linesOf(app)];
    const els = found.filter((el) => !found.some((o) => o !== el && o.contains(el)));
    return els.sort((a, b) => (before(a, b) ? 1 : -1));
  };

  // the rows in order: a group at the place of its member in front, which holds its members
  const items = (): Item[] => {
    const out: Item[] = [];
    const done = new Set<string>();
    const els = objects();
    for (const el of els) {
      const g = groupOf(el);
      const members = g ? els.filter((m) => groupOf(m) === g) : [];
      if (!g || members.length < 2) out.push({ el, group: null });
      else if (!done.has(g)) {
        done.add(g);
        out.push({ el: null, group: g, members });
      }
    }
    return out;
  };

  const nameOf = (item: Item): string => (item.el ? describeObject(item.el).name : 'Group');
  const membersOf = (item: Item): Element[] => (item.el ? [item.el] : item.members);

  // the selected object of each element of the selection, and the block of a text with its caret
  const selectedObjects = (): Set<Element> => {
    const sel = app.selection;
    if (sel.kind === 'text') return new Set(objects().filter((o) => sel.items.some((h) => o.contains(h))));
    return new Set(sel.elements().map((el) => objectOf(app, el)));
  };

  const shown = () => on && app.nav.shown && !outlineShown() && getComputedStyle(app.nav.pane).display !== 'none';

  function lockButton(item: Item): HTMLButtonElement {
    const els = membersOf(item);
    const all = els.length > 0 && els.every(locked);
    const b = make('button', 'lock');
    b.type = 'button';
    b.tabIndex = -1;
    b.setAttribute('aria-pressed', String(all));
    b.setAttribute('aria-label', all ? 'Unlock' : 'Lock');
    b.title = all ? 'Unlock' : 'Lock';
    b.append(glyph(all ? 'lock' : 'unlock', 14));
    b.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const targets = els.filter((el) => locked(el) === all);
      void app.history.transact(all ? 'Unlock' : 'Lock', () => {
        for (const el of targets) app.doc.setTag(el, { attrs: { 'data-locked': all ? null : '' } }, all ? 'unlock' : 'lock');
      }).then(() => app.invalidate('selection')).catch((e) => app.fail(e));
    });
    return b;
  }

  function rowOf(item: Item, level: number, selected: Set<Element>): HTMLElement {
    const row = make('div', 'row');
    row.setAttribute('role', 'treeitem');
    row.setAttribute('aria-level', String(level));
    const els = membersOf(item);
    row.setAttribute('aria-selected', String(els.length > 0 && els.every((el) => selected.has(el))));
    row.tabIndex = -1;
    const twist = make('span', 'twist');
    if (!item.el) {
      const open = !folded.has(item.group) || !!field.value.trim();
      row.setAttribute('aria-expanded', String(open));
      twist.append(glyph('chevron-right', 12));
      twist.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      twist.addEventListener('click', (ev) => {
        ev.stopPropagation();
        fold(item.group, open);
      });
    }
    const kind = make('span', 'kind');
    const d = item.el ? describeObject(item.el) : { kind: 'Group', icon: 'group' };
    kind.append(glyph(d.icon, 16));
    row.dataset.kind = d.kind;
    const name = make('span', 'name', nameOf(item));
    row.append(twist, kind, name, lockButton(item));
    row.title = nameOf(item);
    return row;
  }

  function fold(group: string, close: boolean): void {
    if (close) folded.add(group);
    else folded.delete(group);
    focusKey = `group:${group}`;
    refresh(true);
  }

  // the rows built again from the slide, with the focus kept on the row of the same element. the
  // rows are kept while they would be built the same, since a row that is replaced loses the focus
  const ids = new WeakMap<Element, number>();
  let lastId = 0;
  const idOf = (key: Element | string) => {
    if (typeof key === 'string') return key;
    if (!ids.has(key)) ids.set(key, ++lastId);
    return ids.get(key);
  };
  let built = '';
  function refresh(keepFocus = root.contains(document.activeElement) && document.activeElement !== field): void {
    if (root.previousElementSibling !== app.nav.pane) app.nav.pane.after(root);
    document.documentElement.classList.toggle('beeson-objects', on && app.nav.shown && !outlineShown());
    root.hidden = !shown();
    if (root.hidden || press?.on) return;
    const query = field.value.trim().toLowerCase();
    const selected = selectedObjects();
    const plan: { item: Item; level: number }[] = [];
    for (const item of items()) {
      if (item.el) {
        if (!query || nameOf(item).toLowerCase().includes(query)) plan.push({ item, level: 1 });
        continue;
      }
      const members = item.members.filter((m) => !query || describeObject(m).name.toLowerCase().includes(query));
      if (query && !members.length && !'group'.includes(query)) continue;
      plan.push({ item, level: 1 });
      if (folded.has(item.group) && !query) continue;
      for (const m of query ? members : item.members) plan.push({ item: { el: m, group: null }, level: 2 });
    }
    const on2 = (item: Item) => membersOf(item).every((el) => selected.has(el));
    const keys = plan.map((p) => keyOf(p.item));
    const current = focusKey && keys.includes(focusKey) ? focusKey : keys[plan.findIndex((p) => on2(p.item))] ?? keys[0];
    const sig = [query, ...plan.map((p) => [idOf(keyOf(p.item)), p.level, nameOf(p.item), on2(p.item), membersOf(p.item).every(locked), !p.item.el && folded.has(p.item.group)].join('|'))].join('\n');
    if (sig !== built) {
      built = sig;
      rows = plan.map((p) => ({ item: p.item, row: rowOf(p.item, p.level, selected) }));
      list.replaceChildren(...rows.map((r) => r.row), drop);
      empty.hidden = rows.length > 0;
      empty.textContent = query ? 'No matching objects' : 'No objects on this slide';
      rows.find((r) => r.row.getAttribute('aria-selected') === 'true')?.row.scrollIntoView({ block: 'nearest' });
    }
    for (const r of rows) r.row.tabIndex = keyOf(r.item) === current ? 0 : -1;
    const row = rows.find((r) => keyOf(r.item) === current)?.row;
    if (keepFocus && row && document.activeElement !== row) row.focus({ preventScroll: true });
  }

  // a click on a row: the row alone, or the row added to or taken off the selection
  function choose(item: Item, extend: boolean): void {
    focusKey = keyOf(item);
    const els = membersOf(item);
    const sel = app.selection;
    if (extend) {
      const now = sel.kind === 'elements' ? sel.elements().map((el) => objectOf(app, el)) : [];
      const all = els.every((el) => now.includes(el));
      sel.set('elements', all ? now.filter((el) => !els.includes(el)) : [...now, ...els.filter((el) => !now.includes(el))]);
    } else if (item.el && groupOf(item.el) && rows.some((r) => !r.item.el && r.item.group === groupOf(item.el))) enterGroup(app, item.el);
    else sel.set('elements', els);
    refresh(true);
  }

  const itemAt = (target: EventTarget | null) => {
    const row = target instanceof Element ? target.closest('.beeson-edit-objects .row') : null;
    return rows.find((r) => r.row === row) ?? null;
  };


  // a drag of a row that the layer commands can move: the gap at the pointer, as the index of the
  // row that it is put in front of
  const gapAt = (y: number): number => {
    const i = rows.findIndex((r) => {
      const b = r.row.getBoundingClientRect();
      return y < b.top + b.height / 2;
    });
    return i < 0 ? rows.length : i;
  };
  const rowAt = (key: Key) => rows.find((r) => keyOf(r.item) === key)?.row;
  const movable = (item: Item) => {
    const els = membersOf(item);
    return els.length > 0 && !els.some(locked) && els.some((el) => canStep(app, el, true) || canStep(app, el, false));
  };

  list.addEventListener('pointerdown', (ev) => {
    const r = itemAt(ev.target);
    if (ev.button !== 0 || !r || (ev.target as Element).closest('.lock, .twist')) return;
    // the row is selected at the press, since the rows are built again once it is selected
    choose(r.item, ev.shiftKey || mod(ev));
    if (movable(r.item)) press = { els: membersOf(r.item), key: keyOf(r.item), x: ev.clientX, y: ev.clientY, id: ev.pointerId, on: false, gap: -1 };
  });
  // refresh() puts the focus on the row pressed, which a mousedown would put on the row rebuilt
  list.addEventListener('mousedown', (ev) => {
    if (itemAt(ev.target) || ev.target === list) ev.preventDefault();
  });
  list.addEventListener('pointermove', (ev) => {
    const p = press;
    if (!p || ev.pointerId !== p.id) return;
    if (!p.on) {
      if (Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < DRAG_START) return;
      p.on = true;
      rowAt(p.key)?.classList.add('dragged');
      list.setPointerCapture(ev.pointerId);
    }
    p.gap = gapAt(ev.clientY);
    const lb = list.getBoundingClientRect();
    const at = p.gap < rows.length ? rows[p.gap].row.getBoundingClientRect().top : (rows.at(-1)?.row.getBoundingClientRect().bottom ?? lb.top);
    drop.hidden = false;
    drop.style.top = `${at - lb.top + list.scrollTop}px`;
  });
  const endDrag = async (commit: boolean) => {
    const p = press;
    press = null;
    drop.hidden = true;
    if (!p?.on) return;
    rowAt(p.key)?.classList.remove('dragged');
    const k = rows.findIndex((r) => keyOf(r.item) === p.key);
    if (commit && k >= 0 && (p.gap < k || p.gap > k + 1)) await moveTo(p.els, p.key, k, p.gap);
    refresh(true);
  };
  list.addEventListener('pointerup', (ev) => {
    if (press && ev.pointerId === press.id) void endDrag(true).catch((e) => app.fail(e));
  });
  list.addEventListener('pointercancel', () => void endDrag(false));

  // the elements els of row k, from front to back, moved by layers until each is drawn in front of
  // the row at gap, or behind the row before gap, or until the layer commands stop it. the element
  // that goes first is moved first, hence a member of a group does not pass another member
  async function moveTo(els: Element[], key: Key, k: number, gap: number): Promise<void> {
    const up = gap < k;
    const edge = (item: Item) => membersOf(item)[up ? 0 : membersOf(item).length - 1];
    const other = edge(rows[up ? gap : gap - 1].item);
    if (!other || els.includes(other) || !els.some((el) => canStep(app, el, up))) return;
    await app.history.transact('Reorder', async () => {
      for (const el of up ? els : [...els].reverse()) {
        for (let n = 0; n < 500 && (up ? before(el, other) : before(other, el)); n++) if (!(await stepLayer(app, el, up))) break;
      }
    });
    focusKey = key;
    app.selection.set('elements', els);
    app.invalidate('content');
  }

  list.addEventListener('keydown', (ev) => {
    const i = rows.findIndex((r) => r.row === document.activeElement);
    if (i < 0) return;
    // the keys of the Arrange menu act on the rows chosen, as in Keynote's object list
    const arrange = app.commands.forKey(ev, 'canvas');
    if (arrange?.id.startsWith('arrange.')) {
      ev.preventDefault();
      void app.commands.run(arrange.id).catch((e) => app.fail(e));
      return;
    }
    const go = (j: number) => {
      const r = rows[Math.max(0, Math.min(rows.length - 1, j))];
      if (!r) return;
      ev.preventDefault();
      choose(r.item, ev.shiftKey);
    };
    const item = rows[i].item;
    switch (ev.key) {
      case 'ArrowDown': return go(i + 1);
      case 'ArrowUp': return go(i - 1);
      case 'Home': return go(0);
      case 'End': return go(rows.length - 1);
      case 'ArrowRight':
        ev.preventDefault();
        if (!item.el && folded.has(item.group)) fold(item.group, false);
        return;
      case 'ArrowLeft': {
        ev.preventDefault();
        if (!item.el && !folded.has(item.group)) return fold(item.group, true);
        const g = item.el ? groupOf(item.el) : null;
        const parent = g ? rows.find((r) => !r.item.el && r.item.group === g) : null;
        if (parent) {
          focusKey = keyOf(parent.item);
          parent.row.focus();
        }
        return;
      }
      case 'Enter':
      case ' ':
        ev.preventDefault();
        return choose(item, ev.shiftKey || mod(ev));
      case 'Escape':
        ev.preventDefault();
        (document.activeElement as HTMLElement).blur();
        return;
      case 'Backspace':
      case 'Delete':
        ev.preventDefault();
        void app.commands.run('element.delete').catch((e) => app.fail(e));
    }
  });
  list.addEventListener('focusin', (ev) => {
    const r = itemAt(ev.target);
    if (r) focusKey = keyOf(r.item);
  });
  field.addEventListener('input', () => refresh(false));
  field.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown' && rows.length) {
      ev.preventDefault();
      choose(rows[0].item, false);
      rows[0].row.focus();
    } else if (ev.key === 'Escape' && field.value) {
      ev.preventDefault();
      ev.stopPropagation();
      field.value = '';
      refresh(false);
    }
  });

  document.body.append(root);
  app.onRefresh(['content', 'selection', 'slide', 'structure', 'layout'], () => refresh());
  app.listen('resize', () => refresh());
  app.listen('slide', () => (focusKey = null));

  const toggle = () => {
    on = !on;
    store(KEY, on ? '1' : null);
    if (on && !app.nav.shown) app.nav.toggle();
    refresh(false);
    if (on) (rows.find((r) => r.row.tabIndex === 0)?.row ?? field).focus({ preventScroll: true });
  };
  app.commands.define({
    id: 'view.objects',
    label: 'Object List',
    // Keynote's key on a Mac, and PowerPoint's key of the Selection Pane on Windows, since Ctrl+Shift+L
    // is Unlock there
    keys: { mac: ['Mod+Shift+L'], other: ['Alt+F10'] },
    in: OUTSIDE_DIALOGS,
    menu: { bar: 'View', group: 'panes', order: 10.7 },
    checked: () => on,
    run: toggle,
  });
}
