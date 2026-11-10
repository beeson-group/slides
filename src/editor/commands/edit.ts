// the commands of the Edit menu. today these are Undo and Redo, run by the buttons of the toolbar
// and by ⌘Z, ⌘⇧Z, and Ctrl+Y

import type { App } from '../app.ts';

export function install(app: App): void {
  const c = app.commands;
  c.define({ id: 'edit.undo', label: 'Undo', enabled: (a) => a.history.canUndo, run: (a) => a.history.undo() });
  c.define({ id: 'edit.redo', label: 'Redo', enabled: (a) => a.history.canRedo, run: (a) => a.history.redo() });
}
