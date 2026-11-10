// the registry of the commands of the editor. a menu item, a toolbar button, a context menu item,
// an inspector button, and a key each name a command by its id, and a package declares its
// commands in its file under commands/, with the places where they are shown. the items of a menu
// are thus not listed in any file. installKeys holds the keyboard handler of today, which the one
// dispatch over the keys of the registry replaces

import type { App, Region } from './app.ts';

export type Context = 'element' | 'text' | 'canvas' | 'slide' | 'navigator';

export type Command = {
  // e.g. 'slide.duplicate'
  id: string;
  // e.g. (app) => `Undo ${app.history.undoLabel}`
  label: string | ((app: App) => string);
  // key strings per platform, e.g. 'Mod+Shift+Z', 'Alt+ArrowUp', 'Shift+1'
  keys?: { mac?: string[]; other?: string[] };
  // where the keys are taken, by default on the canvas and in the navigator
  in?: Region[];
  menu?: { bar: string; group: string; order: number; submenu?: string };
  toolbar?: { group: string; order: number; icon: string };
  context?: Context[];
  enabled?(app: App): boolean;
  // true or false for a switch, null or absent for a plain command
  checked?(app: App): boolean | null;
  run(app: App, arg?: unknown): void | Promise<void>;
  // true runs the command in one transaction of the history, labeled with its label
  undoable?: boolean;
};

export type CommandState = { id: string; label: string; enabled: boolean; checked: boolean | null };

// the commands of one group of a menu or of the toolbar, in their order
export type Group = { group: string; commands: Command[] };

const orderOf = (c: Command, place: 'menu' | 'toolbar'): number => c[place]?.order ?? 0;

// the groups in the order of their first command, and the commands of each group in their order
function grouped(list: Command[], place: 'menu' | 'toolbar'): Group[] {
  const groups = new Map<string, Command[]>();
  for (const c of [...list].sort((a, b) => orderOf(a, place) - orderOf(b, place))) {
    const name = c[place]?.group ?? '';
    groups.set(name, [...(groups.get(name) ?? []), c]);
  }
  return [...groups].map(([group, commands]) => ({ group, commands }));
}

export class Commands {
  private readonly app: App;
  private readonly byId = new Map<string, Command>();

  constructor(app: App) {
    this.app = app;
  }

  // a command is defined once. a second definition of its id is an error, since two packages
  // would then both own it
  define(command: Command): Command {
    if (this.byId.has(command.id)) throw new Error(`the command ${command.id} is defined twice`);
    this.byId.set(command.id, command);
    return command;
  }

  get(id: string): Command | undefined {
    return this.byId.get(id);
  }

  list(): Command[] {
    return [...this.byId.values()];
  }

  label(id: string): string {
    const c = this.byId.get(id);
    if (!c) return id;
    return typeof c.label === 'function' ? c.label(this.app) : c.label;
  }

  enabled(id: string): boolean {
    const c = this.byId.get(id);
    return !!c && (c.enabled?.(this.app) ?? true);
  }

  state(id: string): CommandState {
    const c = this.byId.get(id);
    if (!c) throw new Error(`there is no command ${id}`);
    return { id, label: this.label(id), enabled: this.enabled(id), checked: c.checked?.(this.app) ?? null };
  }

  // a disabled command is not run
  async run(id: string, arg?: unknown): Promise<void> {
    const c = this.byId.get(id);
    if (!c) throw new Error(`there is no command ${id}`);
    if (!this.enabled(id)) return;
    await c.run(this.app, arg);
  }

  // the commands of a menu of the menu bar, or of one of its submenus, in groups
  forMenu(bar: string, submenu?: string): Group[] {
    return grouped(this.list().filter((c) => c.menu?.bar === bar && c.menu.submenu === submenu), 'menu');
  }

  forToolbar(): Group[] {
    return grouped(this.list().filter((c) => c.toolbar), 'toolbar');
  }

  // the commands of a context menu, in the order of their definition
  forContext(kind: Context): Command[] {
    return this.list().filter((c) => c.context?.includes(kind));
  }
}

// the keys of today, before the listeners of reveal.js: ⌘S or Ctrl+S saves, with Shift into
// another file, ⌘Z and ⌘⇧Z or Ctrl+Z and Ctrl+Y move in the history, Enter on a formula opens its
// TeX, and Esc leaves the text that is being edited, so that the arrow keys move between the
// slides again
export function installKeys(app: App): void {
  const run = (id: string) => void app.commands.run(id).catch((e) => app.fail(e));
  window.addEventListener('keydown', (ev) => {
    const mod = ev.metaKey || ev.ctrlKey;
    const key = ev.key.toLowerCase();
    const target = ev.target instanceof Element ? ev.target : null;
    const inField = !!target?.closest('.beeson-math, input, textarea, select');
    const active = document.activeElement;
    if (mod && !ev.altKey && key === 's') {
      ev.preventDefault();
      run(ev.shiftKey ? 'file.saveAs' : 'file.save');
    } else if (mod && !ev.altKey && !inField && (key === 'z' || (key === 'y' && !ev.shiftKey))) {
      ev.preventDefault();
      ev.stopPropagation();
      run(key === 'y' || ev.shiftKey ? 'edit.redo' : 'edit.undo');
    } else if ((ev.key === 'Enter' || ev.key === ' ') && !app.math.isOpen() && active instanceof Element && active.matches('mjx-container') && app.hostOf(active)) {
      ev.preventDefault();
      ev.stopPropagation();
      app.math.open(active);
    } else if (ev.key === 'Escape' && app.files.problemsShown()) {
      app.files.closeProblems();
      ev.stopPropagation();
    } else if (ev.key === 'Escape' && app.files.askShown()) {
      app.files.cancelAsk();
      ev.stopPropagation();
    } else if (!app.math.isOpen() && app.move.onKey(ev)) {
      ev.preventDefault();
      ev.stopPropagation();
    } else if (ev.key === 'Escape') {
      const host = app.hostOf(active);
      if (app.math.isOpen()) {
        app.math.close();
        ev.stopPropagation();
      } else if (host) {
        // the block is selected, as the text box in PowerPoint, and the arrow keys nudge it
        (host as HTMLElement).blur();
        app.move.select(app.move.movableOf(host));
        ev.stopPropagation();
      }
    }
  }, true);
}
