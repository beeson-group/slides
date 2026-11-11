// the registry of the commands of the editor. a menu item, a toolbar button, a context menu item,
// an inspector button, and a key each name a command by its id, and a package declares its
// commands in its file under commands/, with the places where they are shown. the items of a menu
// are thus not listed in any file. installKeys installs the one keyboard handler of the editor,
// which runs the command of a key

import type { App, Deck, Platform, Region } from './app.ts';
import { display, fallback, matches, parseKey, type KeyEvent } from './keymap.ts';

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
  // label is a short label of the toolbar that does not change, e.g. Undo for Undo Typing. split
  // draws a split button, whose list holds the commands of the group with the same split and the
  // submenu of that name of the menu of the command
  toolbar?: { group: string; order: number; icon: string; label?: string; split?: string };
  context?: Context[];
  // the id of the command whose keys a menu lists for this one, for an item that stands for it,
  // e.g. Unlock in a context menu, which runs the Unlock of the Arrange menu
  listedAs?(app: App): string;
  // the id of the command whose run this one hands its run to in the present state, e.g. Duplicate,
  // which duplicates the slide while nothing is selected. a menu lists the key at both
  runsAs?(app: App): string;
  enabled?(app: App): boolean;
  // true or false for a switch, null or absent for a plain command
  checked?(app: App): boolean | null;
  run(app: App, arg?: unknown): void | Promise<void>;
  // true runs the command in one transaction of the history, labeled with its label, or with undo,
  // the name of the action of a family of values, e.g. Text Color for Accent
  undoable?: boolean;
  undo?: string;
  // why the command is disabled, for the tooltip of its control, e.g. Bigger on a heading
  why?(app: App): string | null;
};

export type CommandState = { id: string; label: string; enabled: boolean; checked: boolean | null; why?: string };

// the commands of one group of a menu or of the toolbar, in their order
export type Group = { group: string; commands: Command[] };

// the regions of a command without in
export const DEFAULT_REGIONS: Region[] = ['canvas', 'navigator'];

// every region but a dialog, e.g. for Undo, and every region, e.g. for Save
export const OUTSIDE_DIALOGS: Region[] = ['canvas', 'text', 'field', 'navigator', 'notes', 'inspector'];
export const EVERYWHERE: Region[] = [...OUTSIDE_DIALOGS, 'dialog'];

// the keys that the menus list for a command whose keys reach it as clipboard events, since the
// browser takes them in a text
const CLIPBOARD_KEYS: Record<string, string[]> = { 'edit.cut': ['Mod+X'], 'edit.copy': ['Mod+C'], 'edit.paste': ['Mod+V'] };

// the keys that run a command on the platform
export function boundKeys(c: Command, platform: Platform): string[] {
  return c.keys?.[platform] ?? [];
}

// the keys of a command on the platform: each key that runs it in its own regions, once. the sheet
// of shortcuts thus lists a key at every command that it runs, e.g. ⌘D at Duplicate on the canvas
// and at Duplicate Slide in the navigator, and a menu only where the focus is, through keysIn
export function keysOf(c: Command, platform: Platform): string[] {
  return [...new Set(c.keys?.[platform] ?? CLIPBOARD_KEYS[c.id] ?? [])];
}

// a key without Mod, Ctrl, Alt, or Meta, other than a function key, which a focused button or
// field of the bars takes for itself
export function isPlain(value: string): boolean {
  return !/(^|\+)(Mod|Ctrl|Alt|Meta)\+/.test(value) && !/^(Shift\+)?F\d+$/.test(value);
}

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

  // the checks that turn a command off whatever its own enabled says, e.g. on a locked element
  private readonly vetoes: ((app: App, c: Command) => boolean)[] = [];

  veto(check: (app: App, c: Command) => boolean): void {
    this.vetoes.push(check);
  }

  // whether the command applies to the selection by its own enabled, i.e. before the vetoes, as a
  // command of a locked element does, which its context menu shows dimmed
  applies(id: string): boolean {
    const c = this.byId.get(id);
    return !!c && (c.enabled?.(this.app) ?? true);
  }

  enabled(id: string): boolean {
    const c = this.byId.get(id);
    return !!c && this.applies(id) && !this.vetoes.some((v) => v(this.app, c));
  }

  state(id: string): CommandState {
    const c = this.byId.get(id);
    if (!c) throw new Error(`there is no command ${id}`);
    const enabled = this.enabled(id);
    const why = enabled ? null : c.why?.(this.app);
    return { id, label: this.label(id), enabled, checked: c.checked?.(this.app) ?? null, ...(why ? { why } : {}) };
  }

  // a disabled command is not run. an undoable command is one entry of the history, however many
  // changes it makes
  async run(id: string, arg?: unknown): Promise<void> {
    const c = this.byId.get(id);
    if (!c) throw new Error(`there is no command ${id}`);
    if (!this.enabled(id)) return;
    if (c.undoable) await this.app.history.transact(c.undo ?? this.label(id), () => c.run(this.app, arg));
    else await c.run(this.app, arg);
  }

  // the command whose keys a menu lists for the command of id
  listed(id: string): Command | undefined {
    const c = this.byId.get(id);
    return (c?.listedAs && this.byId.get(c.listedAs(this.app))) || c;
  }

  // the keys of a command on the platform of the editor, as a menu shows them
  shortcuts(id: string): string[] {
    const c = this.listed(id);
    return c ? keysOf(c, this.app.platform).map((k) => display(k, this.app.platform)) : [];
  }

  // the keys of the command of id that a menu opened in region lists. a key that runs another
  // command there is left out, e.g. ⌘D at Duplicate Slide while a figure is selected on the canvas,
  // and so is a key that an enabled command does not take there, e.g. ⌫ at Delete Slide on the
  // canvas. a dimmed item keeps its key, as in Keynote, and the keys of the clipboard are listed
  // everywhere
  keysIn(id: string, region: Region): string[] {
    const c = this.listed(id);
    if (!c) return [];
    const p = this.app.platform;
    return keysOf(c, p).filter((k) => {
      const chord = parseKey(k, p);
      const runs = this.forKey({ key: chord.key === 'Space' ? ' ' : chord.key, shiftKey: chord.shift, altKey: chord.alt, ctrlKey: chord.ctrl, metaKey: chord.meta }, region);
      return runs ? [runs.id, runs.runsAs?.(this.app)].some((r) => r === c.id || r === id) : !boundKeys(c, p).includes(k) || (c.in ?? DEFAULT_REGIONS).includes(region) || !this.enabled(c.id);
    });
  }

  // the first enabled command taken in region whose keys match ev, and else the first one whose
  // keys match ev with the fallback modifier of keymap.ts. with plain set, a key of isPlain is not
  // taken
  forKey(ev: KeyEvent, region: Region, plain = true): Command | undefined {
    const platform = this.app.platform;
    const find = (e: KeyEvent) => this.list().find((c) =>
      (c.in ?? DEFAULT_REGIONS).includes(region) &&
      boundKeys(c, platform).some((k) => (plain || !isPlain(k)) && matches(e, k, platform)) &&
      this.enabled(c.id));
    const alt = fallback(ev, platform);
    return find(ev) ?? (alt ? find(alt) : undefined);
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

// the one keyboard handler of the editor, on window in the capture phase and thus before any other
// listener. it runs the command of a key in the region of the focus, and only then prevents the
// default and stops the event. a key that does not run a command is left to the browser, e.g.
// Backspace and the clipboard keys in a text. a plain key on a focused button or field of the bars
// is left to it, e.g. Space on a button or an arrow on the resizer of the notes. the keys of
// reveal.js are turned off, since the navigation is a set of commands of the registry
export function installKeys(app: App): void {
  window.addEventListener('keydown', (ev) => {
    if (ev.isComposing || ev.keyCode === 229) return;
    if (dialogKey(app, ev)) return;
    const region = app.region();
    // the handle of a block is outside the slide, and its keys are those of the canvas
    const active = document.activeElement;
    const onBar = region === 'canvas' && active instanceof Element && active !== document.body && active !== document.documentElement && !active.closest('.reveal, .beeson-handle');
    const command = app.commands.forKey(ev, region, !onBar);
    if (!command) return;
    ev.preventDefault();
    ev.stopPropagation();
    void app.commands.run(command.id).catch((e) => app.fail(e));
  }, true);
  // the options of reveal.js are set by main.ts once it is ready, before the resize that follows
  // them, hence the keyboard is turned off at a resize
  app.listen('resize', () => {
    const d = app.deck() as (Deck & { getConfig?(): { keyboard?: unknown } }) | undefined;
    if (d?.isReady() && d.getConfig?.().keyboard !== false) d.configure({ keyboard: false });
  });
}

// the keys of the dialogs of today, which are not commands yet: Enter on a formula opens its TeX,
// and Esc closes the TeX field or a card of a file
function dialogKey(app: App, ev: KeyboardEvent): boolean {
  const active = document.activeElement;
  if ((ev.key === 'Enter' || ev.key === ' ') && !app.math.isOpen() && active instanceof Element && active.matches('mjx-container') && app.hostOf(active)) {
    ev.preventDefault();
    ev.stopPropagation();
    app.math.open(active);
    return true;
  }
  if (ev.key !== 'Escape') return false;
  if (app.files.problemsShown()) app.files.closeProblems();
  else if (app.files.askShown()) app.files.cancelAsk();
  else if (app.math.isOpen()) app.math.close();
  else return false;
  ev.stopPropagation();
  return true;
}
