// the commands Undo and Redo of the Edit menu, named after the entry of the history that they take
// back, e.g. Undo Typing. their keys are those of both apps, and Redo has the key of PowerPoint
// and the key of Keynote. the browser keeps a history of its own in a text, hence the keys are
// taken in a text too, and they are left to a field and a dialog

import type { App } from '../app.ts';
import { OUTSIDE_DIALOGS } from '../commands.ts';

const IN = OUTSIDE_DIALOGS.filter((r) => r !== 'field');

// a label of the history in title case, e.g. typing as Typing
export function titled(label: string): string {
  return label.replace(/(^|\s)(\p{Ll})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());
}

export function install(app: App): void {
  const c = app.commands;
  c.define({
    id: 'edit.undo',
    label: (a) => (a.history.undoLabel ? `Undo ${titled(a.history.undoLabel)}` : 'Undo'),
    keys: { mac: ['Mod+Z'], other: ['Mod+Z'] },
    in: IN,
    menu: { bar: 'Edit', group: 'history', order: 10 },
    toolbar: { group: 'history', order: 10, icon: 'undo' },
    enabled: (a) => a.history.canUndo,
    run: (a) => a.history.undo(),
  });
  c.define({
    id: 'edit.redo',
    label: (a) => (a.history.redoLabel ? `Redo ${titled(a.history.redoLabel)}` : 'Redo'),
    keys: { mac: ['Mod+Shift+Z', 'Mod+Y'], other: ['Mod+Y', 'Mod+Shift+Z'] },
    in: IN,
    menu: { bar: 'Edit', group: 'history', order: 11 },
    toolbar: { group: 'history', order: 11, icon: 'redo' },
    enabled: (a) => a.history.canRedo,
    run: (a) => a.history.redo(),
  });
}
