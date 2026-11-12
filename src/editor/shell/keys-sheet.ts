// the sheet of the keyboard shortcuts, opened with ? or from the Help menu. it is built from the
// registry each time it is opened: the menus of the menu bar, then the menus that other modules
// add, e.g. Play, each with the commands that have a key on the platform of the editor, in the
// order of the menu and its submenus. a command without a menu, e.g. Next Slide on an arrow key,
// is listed with the command of its label in a menu, and else in the group Other

import type { App, Region } from '../app.ts';
import type { Command } from '../commands.ts';
import { DEFAULT_REGIONS, boundKeys, keysOf } from '../commands.ts';
import { display } from '../keymap.ts';
import { button, injectStyle, make } from '../ui/dom.ts';
import { trapTab } from '../ui/dialog.ts';
import { menuItems, type MenuItem } from '../ui/menu.ts';
import { MENUS } from './menubar.ts';

const CSS = `
.beeson-edit-keys { width: min(980px, calc(100vw - 32px)); max-height: calc(100vh - 32px); box-sizing: border-box; padding: 0; border: 1px solid var(--ed-line, #555); border-radius: 10px; background: var(--ed-panel, #f6f6f6); color: var(--ed-text, #1d1d1f); font: 12px/1.4 var(--ed-font, system-ui, sans-serif); box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35); }
.beeson-edit-keys.four { width: min(1280px, calc(100vw - 32px)); }
.beeson-edit-keys[open] { display: flex; flex-direction: column; }
.beeson-edit-keys::backdrop { background: rgba(0, 0, 0, 0.3); }
.beeson-edit-keys .head { flex: none; display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid var(--ed-line, #555); }
.beeson-edit-keys h2 { margin: 0; font: 600 14px/1.4 var(--ed-font, system-ui, sans-serif); }
.beeson-edit-keys .head button { font: inherit; padding: 2px 12px; border: 1px solid var(--ed-line, #555); border-radius: 6px; background: var(--ed-segment, transparent); color: inherit; cursor: default; }
.beeson-edit-keys .head button:focus-visible { outline: 2px solid var(--ed-select, #8a2be2); outline-offset: 1px; }
.beeson-edit-keys .body { display: flex; gap: 28px; min-height: 0; padding: 10px 16px 14px; overflow: auto; }
.beeson-edit-keys .column { flex: 1; min-width: 0; }
.beeson-edit-keys section { margin-bottom: 10px; }
.beeson-edit-keys section:last-child { margin-bottom: 0; }
.beeson-edit-keys h3 { margin: 0 0 2px; font: 600 11px/1.5 var(--ed-font, system-ui, sans-serif); color: var(--ed-muted, #6e6e73); }
.beeson-edit-keys .row { display: flex; justify-content: space-between; gap: 12px; padding: 1px 0; }
.beeson-edit-keys .row > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beeson-edit-keys.dense .row { padding: 0; line-height: 1.3; }
.beeson-edit-keys.dense section { margin-bottom: 6px; }
.beeson-edit-keys kbd { font: inherit; color: var(--ed-muted, #6e6e73); white-space: nowrap; font-variant-numeric: tabular-nums; }
`;

export type SheetRow = { bar: string; label: string; keys: string[]; commands: Command[] };

// the commands of the items of a menu and of its submenus, in their order
function commandsOf(app: App, items: MenuItem[]): Command[] {
  const out: Command[] = [];
  for (const item of items) {
    if ('command' in item) {
      const c = app.commands.get(item.command);
      if (c) out.push(c);
    } else if ('items' in item) out.push(...commandsOf(app, typeof item.items === 'function' ? item.items() : item.items));
  }
  return out;
}

// the modifiers of a drag on the canvas, as canvas/drag.ts and commands/line.ts read them, one row
// per modifier in the group Mouse after the menus, as Keynote describes them. Shift locks a move to
// an axis, a rotation to steps of 15 degrees, and a line to steps of 45, and turns Constrain
// Proportions over on a corner. the free modifier turns the snapping off, also the hold of a
// rotation at the multiples of 45 degrees, and the copy modifier drops a copy of a move or resizes
// about the center
const MOUSE: [label: string, mac: string, other: string][] = [
  ['Lock Axis or Angle, Toggle Aspect', '⇧-drag', 'Shift+drag'],
  ['Move, Resize, or Rotate Without Snapping', '⌘-drag', 'Alt+drag'],
  ['Drag a Copy, Resize About the Center', '⌥-drag', 'Ctrl+drag'],
];

// the rows of the sheet: one per label of each menu, with the keys of every command of the label,
// then the modifiers of a drag
export function sheetRows(app: App): SheetRow[] {
  const platform = app.platform;
  const label = (c: Command) => (typeof c.label === 'string' ? c.label : c.label(app));
  const keys = (c: Command) => [...new Set(keysOf(c, platform).map((k) => display(k, platform)))];
  const all = app.commands.list();
  const extra = [...new Set(all.map((c) => c.menu?.bar).filter((b): b is string => !!b && !MENUS.includes(b)))];
  const rows: SheetRow[] = [];
  const add = (bar: string, name: string, list: string[], c: Command) => {
    const row = rows.find((r) => r.label === name && (r.bar === bar || bar === ''));
    if (row) {
      row.keys.push(...list.filter((k) => !row.keys.includes(k)));
      row.commands.push(c);
    } else rows.push({ bar: bar || 'Other', label: name, keys: [...list], commands: [c] });
  };
  const listed = new Set<Command>();
  for (const bar of [...MENUS, ...extra]) {
    for (const c of commandsOf(app, menuItems(app, bar))) {
      listed.add(c);
      const k = keys(c);
      if (k.length) add(bar, label(c), k, c);
    }
  }
  for (const c of all) {
    const k = keys(c);
    if (!listed.has(c) && k.length) add('', label(c), k, c);
  }
  const rank = (bar: string) => (bar === 'Other' ? Infinity : [...MENUS, ...extra].indexOf(bar));
  const sorted = rows.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r.bar) - rank(b.r.bar) || a.i - b.i).map(({ r }) => r);
  return [...sorted, ...MOUSE.map(([name, mac, other]) => ({ bar: 'Mouse', label: name, keys: [platform === 'mac' ? mac : other], commands: [] }))];
}

// the keys listed at two rows of the menus whose commands are taken in one place, each as the key
// and its rows, e.g. Shift+F3: Edit > Find Previous, Format > Change Case. the slide list is one
// place, a text with the notes a second, and the slide with the inspector the third. Delete may
// thus be listed at Delete and at Delete Slide, and Ctrl+] at Increase Indent Level of a text and
// at Bring Forward of an element, as in PowerPoint. the rows of Other and Mouse are not counted
export function sheetClashes(app: App): string[] {
  const place = (region: Region) => (region === 'navigator' ? 'navigator' : region === 'text' || region === 'notes' ? 'text' : 'slide');
  const inText = (c: Command) => c.inText === true || (Array.isArray(c.inText) && c.inText.includes(app.platform));
  const panes = (r: SheetRow) => new Set(r.commands.flatMap((c) => [...(c.in ?? DEFAULT_REGIONS).map(place), ...(inText(c) ? ['text'] : [])]));
  const by = new Map<string, SheetRow[]>();
  for (const r of sheetRows(app)) if (r.bar !== 'Other' && r.bar !== 'Mouse') for (const k of r.keys) by.set(k, [...(by.get(k) ?? []), r]);
  const out: string[] = [];
  for (const [key, rows] of by) {
    const shared = rows.filter((r, i) => rows.some((o, j) => j !== i && [...panes(r)].some((p) => panes(o).has(p))));
    if (shared.length) out.push(`${key}: ${shared.map((r) => `${r.bar} > ${r.label}`).join(', ')}`);
  }
  return out;
}

// the keys of the sheet that run two enabled commands in the region of the focus, each as the key
// and the ids of its commands, e.g. ⇧F3: find.previous, text.case.cycle. a key is meant to run one
// command in each state of the editor, the first enabled one that the registry finds. with shared
// set, the keys listed at two items of one menu or of one context menu, enabled or not, each as
// the menu, the key, and the ids, e.g. Insert: ⌥⌘E: insert.formula, math.inline, which the menu
// would show as one key of two commands
export function keyClashes(app: App, shared = false): string[] {
  const platform = app.platform;
  const listed = new Set(sheetRows(app).flatMap((r) => r.keys));
  const out: string[] = [];
  const clash = (where: string, commands: Command[], keys: (c: Command) => string[]) => {
    const by = new Map<string, string[]>();
    for (const c of commands) for (const key of new Set(keys(c))) if (listed.has(key)) by.set(key, [...(by.get(key) ?? []), c.id]);
    out.push(...[...by].filter(([, ids]) => ids.length > 1).map(([key, ids]) => `${where}${key}: ${ids.join(', ')}`));
  };
  if (!shared) {
    const region = app.region();
    clash('', app.commands.list().filter((c) => (c.in ?? DEFAULT_REGIONS).includes(region) && app.commands.enabled(c.id)), (c) => boundKeys(c, platform).map((k) => display(k, platform)));
    return out;
  }
  const shown = (c: Command) => app.commands.shortcuts(c.id);
  const menus = new Map<string, Command[]>();
  for (const c of app.commands.list()) {
    const places = [...(c.menu ? [c.menu.submenu ? `${c.menu.bar} > ${c.menu.submenu}` : c.menu.bar] : []), ...(c.context ?? []).map((k) => `the context menu of ${k}`)];
    for (const p of places) menus.set(p, [...(menus.get(p) ?? []), c]);
  }
  for (const [where, commands] of menus) clash(`${where}: `, commands, shown);
  return out;
}

// the groups split in their order into n columns, with the tallest column as short as it can be
function columns<T>(groups: T[], height: (g: T) => number, n: number): T[][] {
  const h = groups.map(height);
  const best = new Map<string, { cost: number; cut: number }>();
  const sum = (a: number, b: number) => h.slice(a, b).reduce((x, y) => x + y, 0);
  const solve = (from: number, k: number): number => {
    if (k === 1 || from >= groups.length) return sum(from, groups.length);
    const key = `${from},${k}`;
    const hit = best.get(key);
    if (hit) return hit.cost;
    let out = { cost: Infinity, cut: groups.length };
    for (let cut = from + 1; cut <= groups.length; cut++) {
      const cost = Math.max(sum(from, cut), solve(cut, k - 1));
      if (cost < out.cost) out = { cost, cut };
    }
    best.set(key, out);
    return out.cost;
  };
  solve(0, n);
  const out: T[][] = [];
  let from = 0;
  for (let k = n; k > 1 && from < groups.length; k--) {
    const cut = best.get(`${from},${k}`)?.cut ?? groups.length;
    out.push(groups.slice(from, cut));
    from = cut;
  }
  if (from < groups.length) out.push(groups.slice(from));
  return out;
}

type Group = { bar: string; rows: SheetRow[] };

// the groups laid in their order into n columns of about one height, with the heading of a group
// counted as two rows. a group that does not fit into the rest of its column is continued in the
// next one under its name, with three rows or more on each side
function balanced(groups: Group[], n: number): Group[][] {
  const fill = (limit: number): Group[][] => {
    const out: Group[][] = [[]];
    let used = 0;
    for (const g of groups) {
      let { bar, rows } = g;
      while (rows.length) {
        const room = limit - used - 2;
        const take = room >= rows.length ? rows.length : Math.min(room, rows.length - 3);
        if (take >= Math.min(3, rows.length) || !used) {
          // a column too short for three rows takes its group whole
          const count = take >= 3 || take === rows.length ? take : rows.length;
          out.at(-1)!.push({ bar, rows: rows.slice(0, count) });
          used += count + 2;
          rows = rows.slice(count);
          bar = `${g.bar} (continued)`;
        }
        if (rows.length) {
          out.push([]);
          used = 0;
        }
      }
    }
    return out;
  };
  const total = groups.reduce((a, g) => a + g.rows.length + 2, 0);
  for (let limit = Math.ceil(total / n); limit < total; limit++) {
    const out = fill(limit);
    if (out.length <= n) return out;
  }
  return fill(total);
}

export function install(app: App): void {
  injectStyle('keys', CSS);
  const sheet = make('dialog', 'beeson-edit-keys');
  sheet.setAttribute('aria-labelledby', 'beeson-edit-keys-title');
  const head = make('div', 'head');
  const title = make('h2', '', 'Keyboard Shortcuts');
  title.id = 'beeson-edit-keys-title';
  const done = button('Done', 'Close the list of keyboard shortcuts');
  head.append(title, done);
  const body = make('div', 'body');
  sheet.append(head, body);
  let back: Element | null = null;
  done.addEventListener('click', () => sheet.close());
  sheet.addEventListener('close', () => {
    if (back instanceof HTMLElement && back !== document.body && back.isConnected) back.focus();
    else (document.activeElement as HTMLElement | null)?.blur();
  });
  // Tab stays in the sheet, and Esc closes it here, since the browser may ignore the cancel of a
  // dialog that was not used since a former cancel
  sheet.addEventListener('keydown', (ev) => {
    if (ev.key === 'Tab') trapTab(sheet, ev);
    else if (ev.key === 'Escape') {
      ev.preventDefault();
      sheet.close();
    }
  });
  // a click on the backdrop, outside the box of the sheet, closes it
  sheet.addEventListener('click', (ev) => {
    if (ev.target === sheet) sheet.close();
  });
  document.body.append(sheet);

  const open = () => {
    const groups: Group[] = [];
    for (const row of sheetRows(app)) {
      const last = groups.at(-1);
      if (last?.bar === row.bar) last.rows.push(row);
      else groups.push({ bar: row.bar, rows: [row] });
    }
    // columns of about 290 px each, as many as the window has room for up to three, with the
    // heading of a group counted as two rows
    const fit = (width: number) => Math.max(1, Math.floor((Math.min(width, innerWidth - 32) - 32) / 290));
    const units = (g: Group) => g.rows.length + 2;
    const draw = (lists: Group[][]) => body.replaceChildren(
      ...lists.map((list) => {
        const column = make('div', 'column');
        for (const g of list) {
          const section = make('section');
          section.append(make('h3', '', g.bar));
          for (const row of g.rows) {
            const line = make('div', 'row');
            const name = make('span', '', row.label);
            name.title = row.label;
            line.append(name, make('kbd', '', row.keys.join(', ')));
            section.append(line);
          }
          column.append(section);
        }
        return column;
      }),
    );
    sheet.classList.remove('four', 'dense');
    let n = Math.min(3, fit(980));
    draw(columns(groups, units, n));
    back = document.activeElement;
    // the sheet is centered with a margin above it that clears the menu bar, as a dialog of
    // Keynote is not drawn over the titles of the menu bar
    const bar = document.querySelector('.beeson-edit-menubar')?.getBoundingClientRect().bottom ?? 0;
    sheet.style.maxHeight = `calc(100vh - ${2 * Math.max(16, Math.ceil(bar) + 8)}px)`;
    sheet.showModal();
    // the sheet is measured once shown. while its rows are taller than the window, it gets a fourth
    // column in a wider sheet, then tighter rows, then columns of one height with a long group
    // continued in the next one, and else its body scrolls
    const over = () => body.scrollHeight > body.clientHeight;
    if (over() && fit(1280) >= 4) {
      sheet.classList.add('four');
      n = 4;
      draw(columns(groups, units, n));
    }
    if (over()) sheet.classList.add('dense');
    if (over()) draw(balanced(groups, n));
    done.focus();
  };
  app.commands.define({
    id: 'help.keys',
    label: 'Keyboard Shortcuts',
    keys: { mac: ['?'], other: ['?'] },
    menu: { bar: 'Help', group: 'help', order: 10 },
    run: () => {
      if (!sheet.open) open();
    },
  });
}
