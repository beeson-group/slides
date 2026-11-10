// the sheet of the keyboard shortcuts, opened with ? or from the Help menu. it is built from the
// registry each time it is opened: the menus of the menu bar, then the menus that other modules
// add, e.g. Play, each with the commands that have a key on the platform of the editor, in the
// order of the menu and its submenus. a command without a menu, e.g. Next Slide on an arrow key,
// is listed with the command of its label in a menu, and else in the group Other

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { DEFAULT_REGIONS, boundKeys, keysOf } from '../commands.ts';
import { display } from '../keymap.ts';
import { button, injectStyle, make } from '../ui/dom.ts';
import { menuItems, type MenuItem } from '../ui/menu.ts';
import { MENUS } from './menubar.ts';

const CSS = `
.beeson-edit-keys { width: min(980px, calc(100vw - 32px)); max-height: calc(100vh - 64px); box-sizing: border-box; padding: 0; border: 1px solid var(--ed-line, #555); border-radius: 10px; background: var(--ed-panel, #f6f6f6); color: var(--ed-text, #1d1d1f); font: 12px/1.4 var(--ed-font, system-ui, sans-serif); box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35); }
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
.beeson-edit-keys kbd { font: inherit; color: var(--ed-muted, #6e6e73); white-space: nowrap; font-variant-numeric: tabular-nums; }
`;

export type SheetRow = { bar: string; label: string; keys: string[] };

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

// the rows of the sheet: one per label of each menu, with the keys of every command of the label
export function sheetRows(app: App): SheetRow[] {
  const platform = app.platform;
  const label = (c: Command) => (typeof c.label === 'string' ? c.label : c.label(app));
  const keys = (c: Command) => [...new Set(keysOf(c, platform).map((k) => display(k, platform)))];
  const all = app.commands.list();
  const extra = [...new Set(all.map((c) => c.menu?.bar).filter((b): b is string => !!b && !MENUS.includes(b)))];
  const rows: SheetRow[] = [];
  const add = (bar: string, name: string, list: string[]) => {
    const row = rows.find((r) => r.label === name && (r.bar === bar || bar === ''));
    if (row) row.keys.push(...list.filter((k) => !row.keys.includes(k)));
    else rows.push({ bar: bar || 'Other', label: name, keys: [...list] });
  };
  const listed = new Set<Command>();
  for (const bar of [...MENUS, ...extra]) {
    for (const c of commandsOf(app, menuItems(app, bar))) {
      listed.add(c);
      const k = keys(c);
      if (k.length) add(bar, label(c), k);
    }
  }
  for (const c of all) {
    const k = keys(c);
    if (!listed.has(c) && k.length) add('', label(c), k);
  }
  const rank = (bar: string) => (bar === 'Other' ? Infinity : [...MENUS, ...extra].indexOf(bar));
  return rows.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r.bar) - rank(b.r.bar) || a.i - b.i).map(({ r }) => r);
}

// the keys of the sheet that run two enabled commands in the region of the focus, each as the key
// and the ids of its commands, e.g. ⇧F3: find.previous, text.case.cycle. a key is meant to run one
// command in each state of the editor, the first enabled one that the registry finds
export function keyClashes(app: App): string[] {
  const platform = app.platform;
  const region = app.region();
  const listed = new Set(sheetRows(app).flatMap((r) => r.keys));
  const by = new Map<string, string[]>();
  for (const c of app.commands.list()) {
    if (!(c.in ?? DEFAULT_REGIONS).includes(region) || !app.commands.enabled(c.id)) continue;
    for (const key of new Set(boundKeys(c, platform).map((k) => display(k, platform)))) {
      if (listed.has(key)) by.set(key, [...(by.get(key) ?? []), c.id]);
    }
  }
  return [...by].filter(([, ids]) => ids.length > 1).map(([key, ids]) => `${key}: ${ids.join(', ')}`);
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
  // a click on the backdrop, outside the box of the sheet, closes it
  sheet.addEventListener('click', (ev) => {
    if (ev.target === sheet) sheet.close();
  });
  document.body.append(sheet);

  const open = () => {
    const groups: { bar: string; rows: SheetRow[] }[] = [];
    for (const row of sheetRows(app)) {
      const last = groups.at(-1);
      if (last?.bar === row.bar) last.rows.push(row);
      else groups.push({ bar: row.bar, rows: [row] });
    }
    // three columns of about 290 px each when the window has room for them, and a fourth in a
    // wider sheet when three would be taller than the window, a row being about 19 px high
    const fit = (width: number) => Math.max(1, Math.floor((Math.min(width, innerWidth - 32) - 32) / 290));
    const units = (g: { rows: SheetRow[] }) => g.rows.length + 2;
    const tallest = (lists: { rows: SheetRow[] }[][]) => Math.max(...lists.map((l) => l.reduce((sum, g) => sum + units(g), 0)));
    let lists = columns(groups, units, Math.min(3, fit(980)));
    const four = fit(1280) >= 4 && tallest(lists) * 19 > innerHeight - 160;
    if (four) lists = columns(groups, units, 4);
    sheet.classList.toggle('four', four);
    body.replaceChildren(
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
    back = document.activeElement;
    sheet.showModal();
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
