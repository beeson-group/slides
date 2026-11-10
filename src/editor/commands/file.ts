// the commands of the File menu. Save and Save As take their keys everywhere, so that the save
// page dialog of the browser is never opened. Present and Present from Start have the keys of
// PowerPoint, since F5 reloads the page in a browser

import type { App } from '../app.ts';
import { EVERYWHERE, OUTSIDE_DIALOGS } from '../commands.ts';
import { canWrite } from '../file/files.ts';

// the saved deck from a slide. the presentation is opened at the address of the editor, whose
// hash reveal.js does not keep up to date while the deck is edited. the hash is thus set to the
// slide for the time of the call, and replaceState does not fire a hashchange, hence the slide of
// the editor is kept
async function presentAt(app: App, fromStart: boolean): Promise<void> {
  const d = app.deck();
  const current = app.current();
  const { h, v } = !fromStart && d && current ? d.getIndices(current) : { h: 0, v: 0 };
  // the first slide is opened without a hash
  const to = v ? `#/${h}/${v}` : h ? `#/${h}` : '';
  const hash = location.hash;
  const at = (fragment: string) => history.replaceState(history.state, '', fragment || location.pathname + location.search);
  at(to);
  try {
    await app.files.present();
  } finally {
    if (location.hash === to) at(hash);
  }
}

export function install(app: App): void {
  const c = app.commands;
  const both = (...keys: string[]) => ({ mac: keys, other: keys });
  c.define({
    id: 'file.open',
    label: 'Open…',
    keys: both('Mod+O'),
    in: OUTSIDE_DIALOGS,
    menu: { bar: 'File', group: 'open', order: 10 },
    run: (a) => a.files.openFile(),
  });
  c.define({
    id: 'file.save',
    label: 'Save',
    keys: both('Mod+S'),
    in: EVERYWHERE,
    menu: { bar: 'File', group: 'save', order: 20 },
    toolbar: { group: 'save', order: 50, icon: 'save' },
    run: (a) => a.files.save(),
  });
  c.define({
    id: 'file.saveAs',
    label: 'Save As…',
    keys: both('Mod+Shift+S'),
    in: EVERYWHERE,
    menu: { bar: 'File', group: 'save', order: 21 },
    run: (a) => a.files.saveAs(),
  });
  c.define({
    id: 'file.autosave',
    label: 'Autosave',
    menu: { bar: 'File', group: 'save', order: 22 },
    enabled: () => canWrite(),
    checked: (a) => a.autosave,
    run: (a) => a.files.toggleAutosave(),
  });
  c.define({
    id: 'file.present',
    label: 'Present',
    keys: both('Mod+Enter'),
    in: OUTSIDE_DIALOGS,
    menu: { bar: 'File', group: 'present', order: 30 },
    toolbar: { group: 'present', order: 40, icon: 'play' },
    run: (a) => presentAt(a, false),
  });
  c.define({
    id: 'file.presentStart',
    label: 'Present from Start',
    keys: both('Mod+Shift+Enter'),
    in: OUTSIDE_DIALOGS,
    menu: { bar: 'File', group: 'present', order: 31 },
    run: (a) => presentAt(a, true),
  });
}
