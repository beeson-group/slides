// the commands of the File menu. today they are run by the buttons of the toolbar and by ⌘S and
// ⌘⇧S. their keys, menu places, and the commands Revert to Saved and Download a Copy are added
// with the keyboard dispatch

import type { App } from '../app.ts';
import { canWrite } from '../file/files.ts';

export function install(app: App): void {
  const c = app.commands;
  c.define({ id: 'file.open', label: 'Open…', run: (a) => a.files.openFile() });
  c.define({ id: 'file.save', label: 'Save', run: (a) => a.files.save() });
  c.define({ id: 'file.saveAs', label: 'Save As…', run: (a) => a.files.saveAs() });
  c.define({ id: 'file.autosave', label: 'Autosave', enabled: () => canWrite(), checked: (a) => a.autosave, run: (a) => a.files.toggleAutosave() });
  c.define({ id: 'file.present', label: 'Present', run: (a) => a.files.present() });
}
