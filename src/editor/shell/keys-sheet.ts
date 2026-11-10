// the sheet of the keyboard shortcuts, opened with ? or from the Help menu. it is built from the
// registry each time it is opened, with every command that has a key on the platform of the
// editor, under the menu of the command in the order of the menu bar. a command without a menu,
// e.g. Next Slide on an arrow key, is listed with the command of its menu of the same label

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { keysOf } from '../commands.ts';
import { display } from '../keymap.ts';
import { button, injectStyle, make } from '../ui/dom.ts';

const BARS = ['File', 'Edit', 'Insert', 'Format', 'Arrange', 'Slide', 'View', 'Help'];

const CSS = `
.beeson-edit-keys { width: min(720px, calc(100vw - 32px)); max-height: calc(100vh - 64px); box-sizing: border-box; padding: 0; border: 1px solid var(--line, #555); border-radius: 10px; background: var(--bg, #000); color: var(--text, #eee); font: 13px/1.4 system-ui, sans-serif; box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5); }
.beeson-edit-keys::backdrop { background: rgba(0, 0, 0, 0.4); }
.beeson-edit-keys .head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--line, #555); }
.beeson-edit-keys h2 { margin: 0; font: 600 15px/1.4 system-ui, sans-serif; }
.beeson-edit-keys .head button { font: inherit; padding: 2px 10px; border: 1px solid var(--line, #555); border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
.beeson-edit-keys .body { columns: 2 300px; column-gap: 32px; padding: 12px 16px 16px; overflow: auto; max-height: calc(100vh - 140px); }
.beeson-edit-keys section { break-inside: avoid; margin-bottom: 12px; }
.beeson-edit-keys h3 { margin: 0 0 4px; font: 600 12px/1.4 system-ui, sans-serif; color: var(--subtle, #bbb); }
.beeson-edit-keys .row { display: flex; justify-content: space-between; gap: 16px; padding: 2px 0; }
.beeson-edit-keys kbd { font: inherit; color: var(--subtle, #bbb); white-space: nowrap; }
`;

export type SheetRow = { bar: string; label: string; keys: string[] };

// the rows of the sheet: one per label of each menu, with the keys of every command of the label
export function sheetRows(app: App): SheetRow[] {
  const platform = app.platform;
  const commands = app.commands.list().filter((c) => keysOf(c, platform).length);
  const label = (c: Command) => (typeof c.label === 'string' ? c.label : c.label(app));
  const barOf = (c: Command) => c.menu?.bar ?? commands.find((o) => o.menu && label(o) === label(c))?.menu?.bar ?? 'Other';
  const rows: SheetRow[] = [];
  const sorted = [...commands].sort((a, b) => (a.menu?.order ?? Infinity) - (b.menu?.order ?? Infinity));
  for (const c of sorted) {
    const bar = barOf(c);
    const keys = keysOf(c, platform).map((k) => display(k, platform));
    const row = rows.find((r) => r.bar === bar && r.label === label(c));
    if (row) row.keys.push(...keys.filter((k) => !row.keys.includes(k)));
    else rows.push({ bar, label: label(c), keys });
  }
  const rank = (bar: string) => (BARS.includes(bar) ? BARS.indexOf(bar) : BARS.length);
  return rows.sort((a, b) => rank(a.bar) - rank(b.bar));
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
    body.replaceChildren();
    let section: HTMLElement | null = null;
    let bar = '';
    for (const row of sheetRows(app)) {
      if (row.bar !== bar || !section) {
        bar = row.bar;
        section = make('section');
        section.append(make('h3', '', bar));
        body.append(section);
      }
      const line = make('div', 'row');
      line.append(make('span', '', row.label), make('kbd', '', row.keys.join(', ')));
      section.append(line);
    }
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
