// the commands of the View menu: the switches of the panes, the mode of the slide, and Next Pane
// and Previous Pane. D flips only the slide, through the switch of the theme. F6 moves the focus
// through the regions of the window, as in PowerPoint for Windows

import type { App } from '../app.ts';
import { OUTSIDE_DIALOGS } from '../commands.ts';

type Theme = { get(): 'dark' | 'light'; toggle(): void };
const theme = (): Theme | undefined => (window as unknown as { Beeson?: { theme?: Theme } }).Beeson?.theme;

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';

const shown = (el: Element | null): el is HTMLElement => el instanceof HTMLElement && el.getClientRects().length > 0;

// a region of the window: its element, and how the focus is put into it. the canvas is the slide,
// where the focus is on the page itself
type Pane = { name: string; el(app: App): Element | null; enter(app: App, el: Element): void };

const first = (_: App, el: Element) => [...el.querySelectorAll(FOCUSABLE)].find(shown)?.focus();

// the panes in the order of section 1 of the plan, with the status bar last. a pane that is
// missing or hidden is skipped
const PANES: Pane[] = [
  { name: 'menubar', el: () => document.querySelector('.beeson-edit-menubar'), enter: first },
  { name: 'toolbar', el: () => document.querySelector('.beeson-edit-top'), enter: first },
  {
    name: 'navigator',
    el: () => document.querySelector('.beeson-edit-nav'),
    enter: (app, el) => (shown(el.querySelector('[aria-current="true"]')) ? (el.querySelector('[aria-current="true"]') as HTMLElement).focus() : first(app, el)),
  },
  {
    name: 'canvas',
    el: () => document.querySelector('.reveal'),
    enter: () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
    },
  },
  { name: 'notes', el: (app) => (app.notes.shown() ? app.notes.ensure() : null), enter: (_, el) => (el as HTMLElement).focus() },
  // the accessibility pane of review/accessibility.ts, at the right of the canvas
  { name: 'accessibility', el: () => document.querySelector('.beeson-edit-a11y:not([hidden])'), enter: first },
  // the focus goes to the tab of the panel shown, from which Tab reaches its controls, since a
  // first control that is a field would take the keys of the inspector
  {
    name: 'inspector',
    el: () => document.querySelector('.beeson-edit-inspector'),
    enter: (app, el) => {
      const tab = el.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      const panel = el.querySelector(':scope > .panel:not([hidden])');
      if (tab && shown(tab)) tab.focus();
      else if (panel) first(app, panel);
    },
  },
  { name: 'status', el: () => document.querySelector('.beeson-edit-bottom'), enter: first },
];

// the pane of the focus. the notes are inside the slide, hence they are tested before the canvas
function paneOf(app: App): number {
  const active = document.activeElement;
  const notes = PANES.findIndex((p) => p.name === 'notes');
  if (active?.closest('aside.notes')) return notes;
  const i = PANES.findIndex((p) => p.name !== 'canvas' && p.name !== 'notes' && !!active && !!p.el(app)?.contains(active));
  return i >= 0 ? i : PANES.findIndex((p) => p.name === 'canvas');
}

export function cyclePane(app: App, step: 1 | -1): void {
  const from = paneOf(app);
  for (let n = 1; n < PANES.length; n++) {
    const pane = PANES[(from + step * n + PANES.length * n) % PANES.length];
    const el = pane.el(app);
    if (!el || (pane.name !== 'canvas' && pane.name !== 'notes' && !shown(el))) continue;
    pane.enter(app, el);
    return;
  }
}

export function install(app: App): void {
  const c = app.commands;
  const pane = (order: number) => ({ bar: 'View', group: 'panes', order });
  c.define({ id: 'view.navigator', label: 'Navigator', menu: pane(10), checked: (a) => a.nav.shown, run: (a) => a.nav.toggle() });
  c.define({ id: 'view.notes', label: 'Notes', menu: pane(11), checked: (a) => a.notes.shown(), run: (a) => a.notes.toggle() });
  c.define({ id: 'view.steps', label: 'Steps', menu: pane(12), toolbar: { group: 'inspector', order: 61, icon: 'steps' }, checked: (a) => a.steps.shown, run: (a) => a.steps.toggle() });
  c.define({
    id: 'view.slideDark',
    label: 'Slide in Dark Mode',
    keys: { mac: ['D'], other: ['D'] },
    menu: { bar: 'View', group: 'mode', order: 20 },
    enabled: () => !!theme(),
    checked: () => theme()?.get() === 'dark',
    run: () => theme()?.toggle(),
  });
  const go = (order: number) => ({ bar: 'View', group: 'pane', order });
  c.define({ id: 'view.nextPane', label: 'Next Pane', keys: { mac: ['F6'], other: ['F6'] }, in: OUTSIDE_DIALOGS, menu: go(50), run: (a) => cyclePane(a, 1) });
  c.define({ id: 'view.previousPane', label: 'Previous Pane', keys: { mac: ['Shift+F6'], other: ['Shift+F6'] }, in: OUTSIDE_DIALOGS, menu: go(51), run: (a) => cyclePane(a, -1) });
}
