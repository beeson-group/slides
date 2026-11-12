// the menus of the editor, built of DOM elements, since the popup of a native select is not seen
// in a screenshot of the Chrome DevTools protocol: the menus of the menu bar with their submenus,
// the context menus, the split buttons of the toolbar, and a select of the chrome.
//
// a menu does not take the focus when it is opened with the pointer, so that the caret and the
// range of a text are kept for its command, as in the menus of macOS. while a menu is open, every
// key is taken by the listener below, which is added at the import of this module and thus runs
// before the keyboard handler that commands.ts adds at its install. the highlighted item is kept
// in the menu and announced with aria-activedescendant. a menu with a search field, i.e. the Help
// menu, gives the focus to its field, which lists the commands of the menu bar that match

import type { App, Platform } from '../app.ts';
import { keysOf, type Command, type Context, type Group } from '../commands.ts';
import { display } from '../keymap.ts';
import { injectStyle, make } from './dom.ts';
import { icon } from './icons.ts';

// an item of a menu: a command of the registry by its id, a submenu, an action of the chrome, or a
// rule between groups. a command item may give a label of its own, e.g. a short one in a submenu,
// and the path of its menu, e.g. in the results of a search. a note is a line of gray text, and a
// search is the field at the top of the Help menu over the commands of the menus of bars
export type MenuItem =
  | { command: string; arg?: unknown; label?: string; path?: string[] }
  | { label: string; items: MenuItem[] | (() => MenuItem[]); disabled?: boolean }
  | { label: string; run: () => unknown; checked?: boolean | null; disabled?: boolean; keys?: string }
  | { note: string }
  | { search: { bars: string[] } }
  | { rule: true };

// where a menu is put: under a rectangle, e.g. a menu bar title, beside it for a submenu, or with
// its upper left at a point for a context menu. a select puts its checked item over the rectangle
export type Placement = 'below' | 'beside' | 'point' | 'over';

export type MenuOptions = {
  anchor: DOMRect | { x: number; y: number };
  placement?: Placement;
  // the button that opened the menu, marked with aria-expanded while it is open
  owner?: HTMLElement | null;
  // true when the menu is opened from the keyboard: its first item is highlighted, and the focus
  // is given to the menu and back to the owner at the close
  keyboard?: boolean;
  // true when a menu opened with the pointer takes the focus without a highlight, as a context
  // menu of macOS, and gives it back at the close
  focus?: boolean;
  label?: string;
  className?: string;
  onClose?: () => void;
  // the move to the menu beside a menu of the menu bar, with Left or Right
  onSibling?: (step: 1 | -1) => void;
};

export interface OpenMenu {
  readonly el: HTMLElement;
  close(): void;
}

// the item kinds, each with its rendered element
type Row = { el: HTMLElement; item: Exclude<MenuItem, { rule: true } | { note: string } | { search: unknown }>; enabled: boolean; submenu: (() => MenuItem[]) | null; text: string };

const CSS = `
.beeson-edit-menu { position: fixed; z-index: 90; box-sizing: border-box; min-width: 220px; max-width: 420px; max-height: calc(100vh - 16px); overflow-y: auto; padding: 5px; border: 1px solid var(--ed-menu-line); border-radius: 8px; background: var(--ed-menu); color: var(--ed-text); font: 13px/1.25 system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 10px 32px rgba(0, 0, 0, 0.22), 0 1px 3px rgba(0, 0, 0, 0.12); -webkit-backdrop-filter: blur(24px) saturate(1.6); backdrop-filter: blur(24px) saturate(1.6); outline: none; user-select: none; -webkit-user-select: none; }
.beeson-edit-menu .item { display: grid; grid-template-columns: 18px 1fr auto 14px; align-items: center; column-gap: 4px; min-height: 22px; padding: 0 8px 0 4px; border-radius: 4px; cursor: default; white-space: nowrap; }
.beeson-edit-menu .item .check { display: flex; justify-content: center; }
.beeson-edit-menu .item .label { overflow: hidden; text-overflow: ellipsis; }
.beeson-edit-menu .item .keys { padding-left: 24px; color: var(--ed-muted); font-variant-numeric: tabular-nums; letter-spacing: 0.04em; }
.beeson-edit-menu .item .arrow { display: flex; justify-content: flex-end; color: var(--ed-muted); }
.beeson-edit-menu .item.hi { background: var(--ed-select); color: var(--ed-on-select); }
.beeson-edit-menu .item.hi .keys, .beeson-edit-menu .item.hi .arrow { color: inherit; }
.beeson-edit-menu .item[aria-disabled="true"] { color: var(--ed-faint); }
.beeson-edit-menu .item[aria-disabled="true"] .keys { color: var(--ed-faint); }
.beeson-edit-menu .rule { height: 1px; margin: 5px 8px; background: var(--ed-menu-line); }
.beeson-edit-menu .empty { padding: 3px 12px; color: var(--ed-faint); }
.beeson-edit-menu .note { max-width: 300px; padding: 3px 8px 2px 26px; color: var(--ed-faint); font-size: 12px; white-space: normal; }
.beeson-edit-menu .item .label .path { margin-left: 8px; color: var(--ed-muted); font-size: 12px; }
.beeson-edit-menu .item.hi .label .path { color: inherit; opacity: 0.8; }
.beeson-edit-menu.help { min-width: 300px; max-width: 560px; }
.beeson-edit-menu .search { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: 8px; margin: -5px -5px 0; padding: 8px 11px 4px 13px; background: var(--ed-menu); }
.beeson-edit-menu .search .field { position: relative; flex: 1; display: flex; align-items: center; }
.beeson-edit-menu .search svg { position: absolute; left: 6px; width: 12px; height: 12px; color: var(--ed-muted); pointer-events: none; }
.beeson-edit-menu .search input { flex: 1; min-width: 0; height: 22px; box-sizing: border-box; padding: 0 6px 0 22px; border: 1px solid var(--ed-control-line); border-radius: 6px; background: var(--ed-control); color: var(--ed-text); font: inherit; outline: none; }
.beeson-edit-menu .search input:focus { border-color: transparent; box-shadow: 0 0 0 3px var(--ed-focus); }
.beeson-edit-menu .search input::-webkit-search-cancel-button { display: none; }
.beeson-edit-menu .heading { padding: 4px 8px 2px; color: var(--ed-muted); font-size: 11px; font-weight: 600; }
.beeson-edit-split { display: inline-flex; align-items: stretch; }
.beeson-edit-select { display: inline-flex; align-items: center; gap: 2px; }
`;

const layer = (): HTMLElement => {
  let el = document.querySelector<HTMLElement>('.beeson-edit-menus');
  if (!el) {
    el = make('div', 'beeson-edit-menus');
    document.body.append(el);
  }
  return el;
};

// the open menus, the root first and each open submenu after its parent
const stack: Menu[] = [];
let uid = 0;
let platform: Platform = 'other';

// the first key of a command on the platform, as a menu shows it, e.g. ⇧⌘Z on a Mac and Ctrl+Y
// elsewhere for Redo, which the sheet of shortcuts lists with its other keys
export function commandKeys(c: Command, on: Platform = platform): string {
  const k = keysOf(c, on)[0];
  return k ? display(k, on) : '';
}

// the groups of the registry as items, with a rule between two groups
export function itemsOfGroups(groups: Group[]): MenuItem[] {
  const out: MenuItem[] = [];
  for (const g of groups) {
    if (!g.commands.length) continue;
    if (out.length) out.push({ rule: true });
    for (const c of g.commands) out.push({ command: c.id });
  }
  return out;
}

// whether a submenu of commands has an item that can run. a switch is counted when a command of its
// group is not a switch, e.g. Dashes beside Increase Indent Level in Text, or when every group of
// the submenu is made of switches. a group of settings, e.g. Align to Slide in Align, thus does not
// enable a submenu whose commands are disabled
function canRun(app: App, commands: Command[]): boolean {
  const plain = (c: Command) => !c.checked || c.checked(app) === null;
  const groups = new Set(commands.filter(plain).map((c) => c.menu?.group));
  const counted = groups.size ? commands.filter((c) => groups.has(c.menu?.group)) : commands;
  return counted.some((c) => app.commands.enabled(c.id));
}

// the layout of a menu over the submenus and the groups that the packages declare, by the name of
// a declared submenu or, for a command without one, of its group. parent sets it in a submenu of
// the layout, flat sets the commands of a declared submenu straight into that parent, and order is
// added to the order of the first command of a submenu. keep shows a submenu of one command as a
// submenu. '*' places a submenu of the menu that the layout does not name
type Place = { parent?: string; group: string; order?: number; flat?: boolean; keep?: boolean };
const LAYOUT: Record<string, Record<string, Place>> = {
  // Spelling and Grammar of Keynote, before Substitutions, with the one switch a page can set
  Edit: {
    'Spelling and Grammar': { group: 'substitutions', keep: true },
  },
  // Keynote's Format menu: the commands of the text in Font and Text, then the menus of an object,
  // e.g. Image and Table
  Format: {
    Font: { group: 'text', order: -1000 },
    Text: { group: 'text', order: -1000 },
    font: { parent: 'Font', group: 'font' },
    size: { parent: 'Font', group: 'font' },
    Baseline: { parent: 'Font', group: 'more' },
    'Text Color': { parent: 'Font', group: 'more' },
    'Change Case': { parent: 'Font', group: 'more' },
    'Paragraph Style': { parent: 'Text', group: 'style', flat: true },
    List: { parent: 'Text', group: 'list', flat: true },
    clear: { group: 'copy-style' },
    '*': { group: 'objects', order: 1000 },
  },
};

// the path of submenus of a command in its menu, and its group and order there
function placeOf(c: Command): { path: string[]; group: string; order: number } {
  const m = c.menu as NonNullable<Command['menu']>;
  const layout = LAYOUT[m.bar] ?? {};
  const p = layout[m.submenu ?? m.group];
  if (!m.submenu) return { path: p?.parent ? [p.parent] : [], group: p?.group ?? m.group, order: m.order };
  if (!p?.parent) return { path: [m.submenu], group: m.group, order: m.order };
  return p.flat ? { path: [p.parent], group: p.group, order: m.order } : { path: [p.parent, m.submenu], group: m.group, order: m.order };
}

// the items of a menu of the menu bar, or of one of its submenus at any depth. a submenu is shown
// at the group and the order of its first command, unless the layout places it, and a submenu of
// one command is replaced by the command
export function menuItems(app: App, bar: string, submenu?: string): MenuItem[] {
  type Entry = { group: string; order: number; item: MenuItem };
  const placed = app.commands.list().filter((c) => c.menu?.bar === bar).map((c) => ({ c, ...placeOf(c) }));
  const at = submenu === undefined ? [] : (() => {
    const p = placed.find((x) => x.path.includes(submenu))?.path;
    return p ? p.slice(0, p.indexOf(submenu) + 1) : null;
  })();
  if (!at) return [];
  const inside = placed.filter((x) => at.every((name, i) => x.path[i] === name));
  const entries: Entry[] = inside.filter((x) => x.path.length === at.length).map((x) => ({ group: x.group, order: x.order, item: { command: x.c.id } }));
  const subs = new Map<string, typeof placed>();
  for (const x of inside) if (x.path.length > at.length) subs.set(x.path[at.length], [...(subs.get(x.path[at.length]) ?? []), x]);
  for (const [name, members] of subs) {
    const first = [...members].sort((a, b) => a.order - b.order)[0];
    const p = LAYOUT[bar]?.[name] ?? (at.length === 0 ? LAYOUT[bar]?.['*'] : undefined);
    const group = p && (at.length === 0 ? !p.parent : p.parent === at.at(-1)) ? p.group : first.group;
    const order = first.order + (p?.order ?? 0);
    const item: MenuItem = members.length === 1 && !p?.keep ? { command: first.c.id } : { label: name, items: () => menuItems(app, bar, name), disabled: !canRun(app, members.map((x) => x.c)) };
    entries.push({ group, order, item });
  }
  entries.sort((a, b) => a.order - b.order);
  const groups = new Map<string, MenuItem[]>();
  for (const e of entries) groups.set(e.group, [...(groups.get(e.group) ?? []), e.item]);
  const out: MenuItem[] = [];
  for (const items of groups.values()) {
    if (out.length) out.push({ rule: true });
    out.push(...items);
  }
  return out;
}

// a command of a menu of the menu bar, with the names of the menu and the submenus that lead to it
export type MenuEntry = { command: string; label: string; path: string[] };

// the commands of the menus of bars as they are shown, each once, in the order of the menus
export function menuEntries(app: App, bars: string[]): MenuEntry[] {
  const out: MenuEntry[] = [];
  const seen = new Set<string>();
  const walk = (items: MenuItem[], path: string[]) => {
    for (const it of items) {
      if ('command' in it && !seen.has(it.command)) {
        seen.add(it.command);
        out.push({ command: it.command, label: it.label ?? app.commands.label(it.command), path });
      } else if ('items' in it) walk(typeof it.items === 'function' ? it.items() : it.items, [...path, it.label]);
    }
  };
  for (const bar of bars) walk(menuItems(app, bar), [bar]);
  return out;
}

// the lowercase letters of a label without accents and the ellipsis, as a search compares them
const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/…/g, '').toLowerCase();

// the entries whose label holds every word of query, as the search of the Help menu of macOS
// matches the items of the menus: first the labels that start with the query, then the labels
// with a word that starts with its first word, then the others, each in the order of the menus
export function searchEntries(entries: MenuEntry[], query: string): MenuEntry[] {
  const q = plain(query).trim();
  const words = q.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const rank = (label: string) => (label.startsWith(q) ? 0 : label.split(/[\s,(]+/).some((w) => w.startsWith(words[0])) ? 1 : 2);
  return entries
    .map((e, i) => ({ e, i, label: plain(e.label) }))
    .filter((x) => words.every((w) => x.label.includes(w)))
    .sort((a, b) => rank(a.label) - rank(b.label) || a.i - b.i)
    .map((x) => x.e);
}

const CLIPBOARD = ['edit.cut', 'edit.copy', 'edit.paste'];

// the sections of the menu of an element, as in PowerPoint: the clipboard, the items of its kind,
// e.g. Replace Image… and Edit Alt Text…, the arrange items, and the steps
const SECTIONS = ['edit', 'kind', 'arrange', 'steps'] as const;
const sectionOf = (c: Command): (typeof SECTIONS)[number] =>
  c.menu?.bar === 'Edit' ? 'edit' : c.menu?.bar === 'Arrange' || c.id.startsWith('arrange.') ? 'arrange' : c.id.startsWith('steps.') ? 'steps' : 'kind';

// the items of a context menu of a kind, each run with the kind and the element clicked. a rule
// is put where the group of the menu bar changes between two neighbors, and in the menu of an
// element where its section changes. the items of the kind of another element are left out of the
// menu of an element, i.e. a disabled item of a submenu without an enabled item, e.g. the items of
// Video on an image, or one outside a menu, e.g. Edit Text on a figure without a text. Reset Mask,
// disabled next to Edit Mask on an image without a mask, is kept, and so are the items of a locked
// element, which a lock dims, as in Keynote and PowerPoint
export function contextItems(app: App, kind: Context, target: Element | null): MenuItem[] {
  const out: MenuItem[] = [];
  let last: string | null = null;
  // the menu of a text or an element opens with the clipboard, and the menu of the canvas with
  // Paste, as in Keynote and PowerPoint
  const lead = (kind === 'text' ? [...CLIPBOARD, 'edit.pasteAndMatchStyle'] : kind === 'element' ? CLIPBOARD : kind === 'canvas' ? ['edit.paste'] : []).filter((id) => app.commands.get(id));
  for (const id of lead) out.push({ command: id, arg: { kind, target } });
  if (lead.length) last = kind === 'element' ? 'edit' : 'Edit/clipboard';
  let rest = app.commands.forContext(kind).filter((x) => !lead.includes(x.id));
  if (kind === 'element') {
    // Edit Text, enabled on an element that holds a text, follows the items of the kind of the
    // element. it is left out of the menu of a figure with an image or a video, as the menu of an
    // image in Keynote does not have an item for text, and its caption is edited with a click or
    // Return
    if (target?.matches('figure') && target.querySelector('img, video')) rest = rest.filter((c) => c.id !== 'selection.editText');
    const rank = (c: Command) => SECTIONS.indexOf(sectionOf(c)) + (c.id === 'selection.editText' ? 0.5 : 0);
    const home = (c: Command) => (c.menu ? `${c.menu.bar}/${c.menu.submenu ?? c.menu.group}` : c.id);
    const live = new Set(rest.filter((c) => sectionOf(c) === 'kind' && app.commands.applies(c.id)).map(home));
    rest = rest.filter((c) => sectionOf(c) !== 'kind' || live.has(home(c))).sort((a, b) => rank(a) - rank(b));
  }
  for (const c of rest) {
    const group = kind === 'element' ? sectionOf(c) : `${c.menu?.bar ?? ''}/${c.menu?.group ?? ''}`;
    if (last !== null && group !== last) out.push({ rule: true });
    last = group;
    // the commands of a submenu of the menu bar are a submenu of the menu of a text, e.g. Speech. in
    // the menu of an element, Align and Distribute are submenus, and so is the group of Group,
    // Ungroup, and Regroup of the Arrange menu, as in PowerPoint
    const arranged = kind === 'element' && sectionOf(c) === 'arrange';
    const sub = kind === 'text' ? c.menu?.submenu : arranged ? (c.menu?.submenu ?? (c.menu?.group === 'group' ? 'Group' : undefined)) : undefined;
    const prev = out.at(-1);
    const item: MenuItem = { command: c.id, arg: { kind, target } };
    if (sub && prev && 'items' in prev && prev.label === sub && Array.isArray(prev.items)) {
      const before = prev.items.at(-1);
      if (arranged && before && 'command' in before && app.commands.get(before.command)?.menu?.group !== c.menu?.group) prev.items.push({ rule: true });
      prev.items.push(item);
    } else out.push(sub ? { label: sub, items: [item] } : item);
  }
  if (kind === 'canvas') addGrid(app, out);
  // the menu of the browser, with its spelling guesses, is opened by a second right-click
  if (kind === 'text' && out.length) out.push({ rule: true }, { note: browserNote(app) });
  return out;
}

// the submenu Grid and Guides and the switch of the rulers of the menu of a slide in PowerPoint,
// after the items of the slide and before those of its backdrop
const GRID: (string | null)[] = ['view.guides', 'view.grid', null, 'view.grid.snap', null, 'view.grid.settings'];

function addGrid(app: App, out: MenuItem[]): void {
  const items: MenuItem[] = GRID.filter((id) => id === null || app.commands.get(id)).map((id) => (id === null ? { rule: true } : { command: id }));
  const add: MenuItem[] = [];
  if (items.some((it) => 'command' in it)) add.push({ label: 'Grid and Guides', items });
  if (app.commands.get('view.rulers')) add.push({ command: 'view.rulers' });
  if (!add.length) return;
  const at = out.findIndex((it) => 'command' in it && !['Edit', 'Slide', undefined].includes(app.commands.get(it.command)?.menu?.bar));
  out.splice(at < 0 ? out.length : at, 0, { rule: true }, ...add, { rule: true });
}

// the note at the end of the menu of a text, on what a second right-click opens. a page cannot
// read the spelling guesses of the browser, and it cannot open its menu either
function browserNote(app: App): string {
  const spelling = !!app.commands.get('edit.spelling') && app.commands.state('edit.spelling').checked;
  if (!spelling) return 'Right-click again for the menu of the browser';
  return app.platform === 'mac' ? 'Right-click again for spelling guesses and Look Up' : 'Right-click again for spelling guesses';
}

class Menu {
  readonly el = make('div', 'beeson-edit-menu');
  private rows: Row[] = [];
  private hi = -1;
  private child: Menu | null = null;
  private childTimer = 0;
  readonly parent: Menu | null;
  private readonly app: App;
  readonly options: MenuOptions;
  private readonly restore: Element | null;
  private readonly opened = performance.now();
  private typed = '';
  // the row of the parent menu that opened this submenu
  anchorRow: HTMLElement | null = null;
  private typedAt = 0;
  private ids = 0;
  // the search field of the Help menu, the rows of its results before the rows of the items, and
  // the commands that it searches
  private search: { input: HTMLInputElement; results: HTMLElement; rows: Row[]; bars: string[] } | null = null;

  constructor(app: App, items: MenuItem[], options: MenuOptions, parent: Menu | null) {
    this.app = app;
    this.options = options;
    this.parent = parent;
    this.restore = document.activeElement;
    this.el.id = `beeson-edit-menu-${++uid}`;
    this.el.setAttribute('role', 'menu');
    this.el.tabIndex = -1;
    if (options.label) this.el.setAttribute('aria-label', options.label);
    if (options.className) this.el.classList.add(...options.className.split(' '));
    this.build(items);
    // a press in a menu does not move the focus, and it is not seen by the editor below. a press in
    // the search field places the caret
    const field = (ev: Event) => ev.target instanceof Element && !!ev.target.closest('.search input');
    this.el.addEventListener('pointerdown', (ev) => field(ev) || ev.preventDefault());
    this.el.addEventListener('mousedown', (ev) => field(ev) || ev.preventDefault());
    this.el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    layer().append(this.el);
    this.place();
    if (options.owner) options.owner.setAttribute('aria-expanded', 'true');
    // the search field takes the focus at once, as in the Help menu of macOS
    if (this.search) this.search.input.focus({ preventScroll: true });
    else if (options.keyboard) {
      this.highlight(this.next(-1, 1));
      this.el.focus({ preventScroll: true });
    } else if (options.focus) this.el.focus({ preventScroll: true });
  }

  private build(items: MenuItem[]): void {
    const clean = items.filter((it, i) => !('rule' in it) || (i > 0 && i < items.length - 1 && !('rule' in items[i - 1])));
    if (!clean.length) {
      this.el.append(make('div', 'empty', 'No items'));
      return;
    }
    for (const item of clean) {
      if ('rule' in item) {
        const rule = make('div', 'rule');
        rule.setAttribute('role', 'separator');
        this.el.append(rule);
      } else if ('note' in item) this.el.append(make('div', 'note', item.note));
      else if ('search' in item) this.buildSearch(item.search.bars);
      else {
        const row = this.attach(this.row(item));
        this.rows.push(row);
        this.el.append(row.el);
      }
    }
  }

  // the listeners of a row, which find its index when they run, since the results of a search are
  // put before the other rows
  private attach(row: Row): Row {
    const at = () => this.rows.indexOf(row);
    row.el.addEventListener('pointermove', () => {
      if (this.hi !== at()) this.highlight(at(), true);
    });
    row.el.addEventListener('pointerleave', () => {
      if (!this.child && this.hi === at()) this.highlight(-1);
    });
    row.el.addEventListener('click', () => this.activate(at()));
    // a press on a menu bar title held and released over an item runs it, as in macOS
    row.el.addEventListener('pointerup', (ev) => {
      if (ev.button === 0 && performance.now() - this.opened > 250) this.activate(at());
    });
    return row;
  }

  // the field Search at the top of the Help menu, with the commands that match under the heading
  // Menu Items, each with the path of its menu and its keys, before the items of the menu
  private buildSearch(bars: string[]): void {
    const box = make('div', 'search');
    const field = make('span', 'field');
    const input = make('input');
    input.type = 'search';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-label', 'Search the menus');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', this.el.id);
    input.setAttribute('aria-expanded', 'false');
    field.innerHTML = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="5" cy="5" r="3.6"/><path d="M7.7 7.7 11 11" stroke-linecap="round"/></svg>';
    field.append(input);
    box.append(make('span', 'name', 'Search'), field);
    const results = make('div', 'results');
    results.setAttribute('role', 'group');
    results.setAttribute('aria-label', 'Menu Items');
    this.el.append(box, results);
    this.search = { input, results, rows: [], bars };
    input.addEventListener('input', () => this.find());
  }

  // the results of the text of the search field, of which the first that can run is highlighted, so
  // that Return runs it
  private find(): void {
    const s = this.search;
    if (!s) return;
    this.highlight(-1);
    this.closeChild();
    this.rows = this.rows.filter((r) => !s.rows.includes(r));
    s.results.replaceChildren();
    const found = searchEntries(menuEntries(this.app, s.bars), s.input.value);
    s.rows = found.map((e) => this.attach(this.row({ command: e.command, path: e.path })));
    if (s.input.value.trim()) {
      s.results.append(make('div', 'heading', 'Menu Items'));
      if (!s.rows.length) s.results.append(make('div', 'note', 'No menu items match'));
      for (const r of s.rows) s.results.append(r.el);
    }
    this.rows = [...s.rows, ...this.rows];
    s.input.setAttribute('aria-expanded', String(s.rows.length > 0));
    const first = s.rows.findIndex((r) => r.enabled);
    if (first >= 0) this.highlight(first);
    this.place();
  }

  private row(item: Row['item']): Row {
    const el = make('div', 'item');
    el.id = `${this.el.id}-${++this.ids}`;
    let label = '';
    let keys = '';
    let checked: boolean | null = null;
    let enabled = true;
    let submenu: Row['submenu'] = null;
    if ('command' in item) {
      const c = this.app.commands.get(item.command);
      label = item.label ?? this.app.commands.label(item.command);
      enabled = !!c && this.app.commands.enabled(item.command);
      checked = c?.checked?.(this.app) ?? null;
      keys = this.app.commands.shortcuts(item.command)[0] ?? '';
      el.dataset.command = item.command;
    } else if ('items' in item) {
      label = item.label;
      enabled = !item.disabled;
      const items = item.items;
      submenu = typeof items === 'function' ? items : () => items;
    } else {
      label = item.label;
      enabled = !item.disabled;
      checked = item.checked ?? null;
      keys = item.keys ?? '';
    }
    el.setAttribute('role', checked === null ? 'menuitem' : 'menuitemcheckbox');
    if (checked !== null) el.setAttribute('aria-checked', String(checked));
    if (!enabled) el.setAttribute('aria-disabled', 'true');
    if (submenu) el.setAttribute('aria-haspopup', 'menu');
    const check = make('span', 'check');
    if (checked) check.append(icon('check', 14));
    const arrow = make('span', 'arrow');
    if (submenu) arrow.append(icon('chevron-right', 12));
    const name = make('span', 'label', label);
    if ('path' in item && item.path?.length) name.append(make('span', 'path', item.path.join(' ▸ ')));
    el.append(check, name, make('span', 'keys', keys), arrow);
    return { el, item, enabled, submenu, text: label.toLowerCase() };
  }

  // the menu is kept inside the window, and flipped to the other side of its anchor when it would
  // leave the window
  private place(): void {
    const a = this.options.anchor;
    const box = 'width' in a ? a : new DOMRect(a.x, a.y, 0, 0);
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    const pad = 4;
    let x = box.left;
    let y = box.bottom;
    switch (this.options.placement ?? 'below') {
      case 'beside':
        x = box.right - 2;
        y = box.top - 6;
        if (x + w > innerWidth - pad) x = box.left - w + 2;
        break;
      case 'point':
        x = box.left;
        y = box.top;
        if (x + w > innerWidth - pad) x = Math.max(pad, x - w);
        if (y + h > innerHeight - pad) y = Math.max(pad, y - h);
        break;
      case 'over': {
        const on = this.rows.find((r) => r.el.getAttribute('aria-checked') === 'true');
        x = box.left - 22;
        y = box.top - (on ? on.el.offsetTop : 5);
        break;
      }
      default:
        x = box.left;
        y = box.bottom + 2;
        if (y + h > innerHeight - pad && box.top - h - 2 > pad) y = box.top - h - 2;
    }
    x = Math.max(pad, Math.min(x, innerWidth - w - pad));
    y = Math.max(pad, Math.min(y, innerHeight - h - pad));
    this.el.style.left = `${Math.round(x)}px`;
    this.el.style.top = `${Math.round(y)}px`;
  }

  highlight(i: number, fromPointer = false): void {
    this.rows[this.hi]?.el.classList.remove('hi');
    this.hi = i;
    const row = this.rows[i];
    window.clearTimeout(this.childTimer);
    if (!row) {
      this.el.removeAttribute('aria-activedescendant');
      this.search?.input.removeAttribute('aria-activedescendant');
      return;
    }
    row.el.classList.add('hi');
    this.el.setAttribute('aria-activedescendant', row.el.id);
    this.search?.input.setAttribute('aria-activedescendant', row.el.id);
    row.el.scrollIntoView({ block: 'nearest' });
    if (this.child && this.child.anchorRow !== row.el) this.closeChild();
    if (fromPointer && row.submenu && row.enabled && !this.child) this.childTimer = window.setTimeout(() => this.openChild(false), 120);
  }

  private openChild(keyboard: boolean): void {
    const row = this.rows[this.hi];
    if (!row?.submenu || !row.enabled) return;
    if (this.child) this.closeChild();
    const child = new Menu(this.app, row.submenu(), { anchor: row.el.getBoundingClientRect(), placement: 'beside', label: row.text }, this);
    child.anchorRow = row.el;
    row.el.setAttribute('aria-expanded', 'true');
    this.child = child;
    stack.push(child);
    if (keyboard) child.highlight(child.next(-1, 1));
  }

  closeChild(): void {
    if (!this.child) return;
    this.child.anchorRow?.removeAttribute('aria-expanded');
    this.child.destroy();
    this.child = null;
  }

  destroy(): void {
    this.closeChild();
    window.clearTimeout(this.childTimer);
    this.el.remove();
    const at = stack.indexOf(this);
    if (at >= 0) stack.splice(at, 1);
    if (!this.parent) {
      this.options.owner?.setAttribute('aria-expanded', 'false');
      this.options.onClose?.();
    }
  }

  // the root and its submenus are closed, and the focus goes back where it was before the open
  closeAll(): void {
    const root = this.root();
    root.destroy();
    const back = root.options.keyboard && root.options.owner ? root.options.owner : root.restore;
    if (back instanceof HTMLElement && back.isConnected && document.activeElement !== back && (root.options.keyboard || document.activeElement === root.el || !document.activeElement || document.activeElement === document.body)) back.focus({ preventScroll: true });
  }

  root(): Menu {
    let m: Menu = this;
    while (m.parent) m = m.parent;
    return m;
  }

  // the item i is run after every menu is closed, so that its command sees the focus and the
  // selection of the editor as they were before the menu was opened
  private activate(i: number): void {
    const row = this.rows[i];
    // a pointer release runs the item, and the click after it finds the menu closed
    if (!row || !row.enabled || !stack.includes(this)) return;
    if (row.submenu) {
      this.highlight(i);
      this.openChild(true);
      return;
    }
    const app = this.app;
    app.menuItem = row.el.getBoundingClientRect();
    setTimeout(() => (app.menuItem = null), 0);
    this.closeAll();
    const item = row.item;
    const fail = (e: unknown) => this.app.fail(e);
    if ('command' in item) void this.app.commands.run(item.command, item.arg).catch(fail);
    else if ('run' in item) Promise.resolve().then(item.run).catch(fail);
  }

  next(from: number, step: 1 | -1): number {
    const n = this.rows.length;
    for (let k = 1; k <= n; k++) {
      const i = (((from + step * k) % n) + n) % n;
      if (this.rows[i].enabled) return i;
    }
    return -1;
  }

  // the keys of the deepest open menu. Left and Right move between the menus of the menu bar
  // when the menu is not a submenu and its item does not open one. 'field' leaves a key to the
  // search field and keeps it from the editor
  key(ev: KeyboardEvent): boolean | 'field' {
    const row = this.rows[this.hi];
    if (this.search && document.activeElement === this.search.input) {
      const empty = !this.search.input.value;
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        if (!empty) return 'field';
      } else if (ev.key === 'Home' || ev.key === 'End' || ev.key === ' ') return 'field';
      else if (ev.key.length === 1 || ['Backspace', 'Delete'].includes(ev.key)) return 'field';
    }
    switch (ev.key) {
      case 'ArrowDown':
        this.highlight(this.next(this.hi, 1));
        return true;
      case 'ArrowUp':
        this.highlight(this.next(this.hi < 0 ? 0 : this.hi, -1));
        return true;
      case 'Home':
        this.highlight(this.next(-1, 1));
        return true;
      case 'End':
        this.highlight(this.next(0, -1));
        return true;
      case 'ArrowRight':
        if (row?.submenu && row.enabled) this.openChild(true);
        else if (!this.parent) this.options.onSibling?.(1);
        return true;
      case 'ArrowLeft':
        if (this.parent) {
          this.parent.closeChild();
          this.parent.el.focus({ preventScroll: true });
        } else this.options.onSibling?.(-1);
        return true;
      case 'Enter':
      case ' ':
        if (this.hi >= 0) this.activate(this.hi);
        else if (ev.key === 'Enter') this.closeAll();
        return true;
      case 'Escape':
        if (this.parent) this.parent.closeChild();
        else this.closeAll();
        return true;
      case 'Tab':
        this.closeAll();
        return true;
      default:
        if (ev.key.length === 1 && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
          const now = performance.now();
          this.typed = now - this.typedAt < 700 ? this.typed + ev.key.toLowerCase() : ev.key.toLowerCase();
          this.typedAt = now;
          const start = this.typed.length > 1 ? Math.max(this.hi, 0) : this.hi + 1;
          const n = this.rows.length;
          for (let k = 0; k < n; k++) {
            const i = (start + k) % n;
            if (this.rows[i].enabled && this.rows[i].text.startsWith(this.typed)) {
              this.highlight(i);
              break;
            }
          }
          return true;
        }
        // a shortcut with a modifier closes the menu and is left to the editor, as in macOS
        if (ev.metaKey || ev.ctrlKey) {
          this.closeAll();
          return false;
        }
        return true;
    }
  }
}

// a menu of items is opened at its anchor, and any menu open before is closed
export function openMenu(app: App, items: MenuItem[], options: MenuOptions): OpenMenu {
  closeMenus();
  const menu = new Menu(app, items, options, null);
  stack.push(menu);
  return { el: menu.el, close: () => (stack.includes(menu) ? menu.closeAll() : undefined) };
}

export function closeMenus(): void {
  stack[0]?.closeAll();
}

export const menuOpen = (): boolean => stack.length > 0;

// the context menu of a kind at the point of ev, or null when no command is shown for the kind,
// in which case the menu of the browser is left alone
// whether the last input is a press of the key of the context menu or of Shift+F10, which opens
// the menu from the keyboard. it is set before the listener of shell.ts that opens the menu, since
// this module is imported first, and a press of the pointer clears it
let menuKey = false;
window.addEventListener('keydown', (ev) => {
  menuKey = ev.key === 'ContextMenu' || (ev.key === 'F10' && ev.shiftKey);
}, true);

// whether the menu of a text or a cell was open at the last press, which the press closes
let textMenu = false;
window.addEventListener('pointerdown', () => {
  menuKey = false;
  const kinds = stack[0]?.options.className?.split(' ') ?? [];
  textMenu = kinds.includes('context') && (kinds.includes('text') || kinds.includes('cell'));
}, true);

// a second right-click in a text, or a right-click with ⌥ or Alt held, is left to the browser,
// which opens its own menu with the spelling guesses, Look Up, and Translate. this listener is added
// at the import of this module, before every other listener of the menus of the editor
window.addEventListener('contextmenu', (ev) => {
  const t = ev.target instanceof Element ? ev.target : null;
  const again = textMenu && !!t?.closest('[contenteditable="true"]');
  textMenu = false;
  if (!t || t.closest('.beeson-edit-menu') || !(again || ev.altKey)) return;
  closeMenus();
  ev.stopImmediatePropagation();
}, true);

// a context menu takes the focus, and opened from the keyboard it highlights its first item
export function openContextMenu(app: App, kind: Context, target: Element | null, at: { x: number; y: number }): OpenMenu | null {
  const items = contextItems(app, kind, target);
  if (!items.length) return null;
  const keyboard = menuKey;
  menuKey = false;
  return openMenu(app, items, { anchor: at, placement: 'point', label: `${kind} menu`, className: `context ${kind}`, keyboard, focus: true });
}

// a button with a menu of its own beside it, e.g. Add Slide with its layouts. the main button runs
// its action, and the narrow button opens items under the pair
export function splitButton(app: App, main: HTMLButtonElement, items: () => MenuItem[], label: string): HTMLElement {
  const box = make('span', 'beeson-edit-split');
  const more = make('button', 'more');
  more.type = 'button';
  more.setAttribute('aria-label', label);
  more.setAttribute('aria-haspopup', 'menu');
  more.setAttribute('aria-expanded', 'false');
  more.title = label;
  more.append(icon('chevron-down', 12));
  const open = (keyboard: boolean) => openMenu(app, items(), { anchor: box.getBoundingClientRect(), owner: more, keyboard, label });
  more.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    if (stack[0]?.options.owner === more) closeMenus();
    else open(false);
  });
  more.addEventListener('click', (ev) => {
    if (ev.detail === 0) open(true);
  });
  box.append(main, more);
  return box;
}

export type SelectOption = { value: string; label: string };

// a select of the chrome: a button that shows the label of the value, and a DOM menu of the
// options with a check mark at the value, put over the button as a pop-up button of macOS
export function chromeSelect(app: App, options: { label: string; choices: () => SelectOption[]; value: () => string; text?: () => string; onChange: (value: string) => void; className?: string }): HTMLButtonElement {
  const b = make('button', `beeson-edit-select ${options.className ?? ''}`.trim());
  b.type = 'button';
  b.setAttribute('aria-haspopup', 'menu');
  b.setAttribute('aria-expanded', 'false');
  b.setAttribute('aria-label', options.label);
  b.title = options.label;
  const text = make('span', 'value');
  b.append(text, icon('chevron-down', 10));
  const refresh = () => {
    text.textContent = options.text?.() ?? options.choices().find((c) => c.value === options.value())?.label ?? options.value();
  };
  const open = (keyboard: boolean) => {
    const value = options.value();
    const items: MenuItem[] = options.choices().map((c) => ({ label: c.label, checked: c.value === value, run: () => { options.onChange(c.value); refresh(); } }));
    openMenu(app, items, { anchor: b.getBoundingClientRect(), placement: 'below', owner: b, keyboard, label: options.label, className: 'select' });
  };
  b.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    if (stack[0]?.options.owner === b) closeMenus();
    else open(false);
  });
  b.addEventListener('click', (ev) => {
    if (ev.detail === 0) open(true);
  });
  (b as HTMLButtonElement & { refresh(): void }).refresh = refresh;
  refresh();
  return b;
}

// the keys are taken from every other listener while a menu is open
window.addEventListener('keydown', (ev) => {
  if (!stack.length) return;
  const handled = stack[stack.length - 1].key(ev);
  if (handled) ev.stopImmediatePropagation();
  if (handled === true) ev.preventDefault();
}, true);

// a press outside the open menus closes them. a press on the owner of the menu is left to the
// owner, which closes it or opens the next one
window.addEventListener('pointerdown', (ev) => {
  if (!stack.length) return;
  const t = ev.target instanceof Node ? ev.target : null;
  if (t && stack.some((m) => m.el.contains(t))) {
    ev.stopPropagation();
    return;
  }
  const owner = stack[0].options.owner;
  if (owner && t && owner.contains(t)) return;
  closeMenus();
}, true);
window.addEventListener('blur', () => closeMenus());
window.addEventListener('resize', () => closeMenus());

export function install(app: App): void {
  injectStyle('menu', CSS);
  platform = app.platform;
}
