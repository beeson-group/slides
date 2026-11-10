// the commands of the View menu. today these are the switches of the panes, i.e. the slide list,
// the Steps pane, and the notes, whose buttons are in the status bar

import type { App } from '../app.ts';

export function install(app: App): void {
  const c = app.commands;
  c.define({ id: 'view.navigator', label: 'Navigator', checked: (a) => a.nav.shown, run: (a) => a.nav.toggle() });
  c.define({ id: 'view.steps', label: 'Steps', checked: (a) => a.steps.shown, run: (a) => a.steps.toggle() });
  c.define({ id: 'view.notes', label: 'Notes', checked: (a) => a.notes.shown(), run: (a) => a.notes.toggle() });
}
