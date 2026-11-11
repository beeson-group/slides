// the commands of the File menu, in the groups of the File menu of Keynote: Open… and Open Recent,
// then Save, Save As…, Autosave, and Revert to Saved, then Export To. Save and Save As take their
// keys everywhere, so that the save page dialog of the browser is never opened. Present and
// Present from Start have the keys of PowerPoint, since F5 reloads the page in a browser

import type { App } from '../app.ts';
import { EVERYWHERE, OUTSIDE_DIALOGS, type Command } from '../commands.ts';
import { canPick, canWrite, fileActions } from '../file/files.ts';
import { clearRecents, MAX_RECENT, recentLabel, recents } from '../file/recent.ts';

const hidden = (s: Element | null) => s?.getAttribute('data-visibility') === 'hidden';
const sections = (parent: Element) => [...parent.children].filter((s) => s.localName === 'section' && !hidden(s));

// the indices of slide in the show, where reveal.js removes the hidden slides that the editor
// keeps. a hidden slide is shown from the next shown slide, or from the last one
export function showIndices(app: App, slide: Element | null): { h: number; v: number } {
  const leaves = [...app.slides().querySelectorAll('section')].filter((s) => !s.querySelector('section'));
  const shown = leaves.filter((s) => !hidden(s) && !hidden(s.parentElement));
  const at = slide ? leaves.indexOf(slide) : 0;
  const to = shown.find((s) => leaves.indexOf(s) >= at) ?? shown.at(-1);
  if (!to) return { h: 0, v: 0 };
  const top = to.parentElement?.localName === 'section' ? to.parentElement : to;
  return { h: Math.max(0, sections(app.slides()).indexOf(top)), v: top === to ? 0 : Math.max(0, sections(top).indexOf(to)) };
}

// the saved deck from a slide. the presentation is opened at the address of the editor, whose
// hash reveal.js does not keep up to date while the deck is edited. the hash is thus set to the
// slide for the time of the call, and replaceState does not fire a hashchange, hence the slide of
// the editor is kept
async function presentAt(app: App, fromStart: boolean): Promise<void> {
  const { h, v } = fromStart ? { h: 0, v: 0 } : showIndices(app, app.current());
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
    id: 'file.revert',
    label: 'Revert to Saved',
    menu: { bar: 'File', group: 'save', order: 23 },
    enabled: (a) => a.dirty && a.state === 'loaded',
    run: () => fileActions().revert(),
  });

  // Open Recent lists the decks of file/recent.ts, which the menus read at each open, hence the
  // place of each item is a getter. without a deck, or in a browser without the open picker, i.e.
  // in Firefox and Safari, Open Recent is a dimmed item
  const listed = () => (canPick() ? recents() : []);
  const recent = (order: number, group = 'open'): Command['menu'] => ({ bar: 'File', group, order, submenu: 'Open Recent' });
  c.define({
    id: 'file.recent.none',
    label: 'Open Recent',
    get menu() {
      return listed().length ? undefined : { bar: 'File', group: 'open', order: 11 };
    },
    enabled: () => false,
    run: () => {},
  });
  for (let i = 0; i < MAX_RECENT; i++) {
    c.define({
      id: `file.recent.${i + 1}`,
      label: () => {
        const r = listed()[i];
        return r ? recentLabel(r) : '';
      },
      get menu() {
        return listed()[i] ? recent(11 + i / 100) : undefined;
      },
      enabled: (a) => !!listed()[i] && a.state !== 'starting',
      run: async () => {
        const r = listed()[i];
        if (r) await fileActions().openRecent(r);
      },
    });
  }
  c.define({
    id: 'file.recent.clear',
    label: 'Clear Menu',
    get menu() {
      return listed().length ? recent(11.5, 'clear') : undefined;
    },
    run: () => clearRecents(),
  });

  // Export To of Keynote, with the formats that a browser writes. PDF… prints the saved file in its
  // print view, and HTML… writes a copy of the deck with its edits
  const exportTo = (order: number): Command['menu'] => ({ bar: 'File', group: 'export', order, submenu: 'Export To' });
  c.define({
    id: 'file.export.pdf',
    label: 'PDF…',
    menu: exportTo(40),
    enabled: (a) => a.state === 'loaded',
    run: () => fileActions().exportPdf(),
  });
  c.define({
    id: 'file.export.html',
    label: 'HTML…',
    menu: exportTo(41),
    enabled: (a) => a.state === 'loaded' && !!a.pairing,
    run: () => fileActions().exportHtml(),
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
