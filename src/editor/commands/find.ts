// the commands of find and replace in the Edit menu, with the panel of find.ts. Find, Find Next,
// and Find Previous have the keys of both apps, ⌘F, ⌘G, and ⇧⌘G on a Mac. elsewhere Ctrl+G is
// Group, hence Next and Previous are F3 and Shift+F3. Shift+F3 in a text is Change Case there, as
// in PowerPoint, hence Find Previous is not taken in a text on Windows and Linux, and Shift+Return
// in the search field of the panel steps back on every platform. Replace has the key ⌃H of
// PowerPoint on every platform, since Keynote does not give it a key and ⌥⌘F of the plan is not in
// either app. the keys are taken in every region outside a dialog, the search field of the panel
// included

import type { App, Region } from '../app.ts';
import { createFinder, type FindOptions, type Scope } from '../find.ts';
import { closeMenus, openMenu } from '../ui/menu.ts';

const IN: Region[] = ['canvas', 'text', 'field', 'navigator', 'notes', 'inspector'];
const NEXT = { mac: ['Mod+G'], other: ['F3'] };
const PREVIOUS = { mac: ['Mod+Shift+G'], other: ['Shift+F3'] };

// the query of find.open and find.replace, given as an argument by a test or a script
const queryOf = (arg: unknown): string | undefined => (typeof arg === 'string' ? arg : undefined);

export function install(app: App): void {
  const finder = createFinder(app, { next: NEXT[app.platform], previous: PREVIOUS[app.platform] }, { open: openMenu, close: closeMenus });
  const c = app.commands;
  c.define({
    id: 'find.open',
    label: 'Find…',
    keys: { mac: ['Mod+F'], other: ['Mod+F'] },
    in: IN,
    menu: { bar: 'Edit', group: 'find', order: 40 },
    run: (_, arg) => finder.show('find', queryOf(arg)),
  });
  // with the panel closed, the match found is selected in its block, as after Find Next in Keynote
  c.define({
    id: 'find.next',
    label: 'Find Next',
    keys: NEXT,
    in: IN,
    menu: { bar: 'Edit', group: 'find', order: 41 },
    enabled: () => !!finder.query,
    run: () => finder.step(1, !finder.open),
  });
  c.define({
    id: 'find.previous',
    label: 'Find Previous',
    keys: PREVIOUS,
    in: app.platform === 'mac' ? IN : IN.filter((r) => r !== 'text'),
    menu: { bar: 'Edit', group: 'find', order: 42 },
    enabled: () => !!finder.query,
    run: () => finder.step(-1, !finder.open),
  });
  c.define({
    id: 'find.replace',
    label: 'Replace…',
    keys: { mac: ['Ctrl+H'], other: ['Ctrl+H'] },
    in: IN,
    menu: { bar: 'Edit', group: 'find', order: 43 },
    run: (_, arg) => finder.show('replace', queryOf(arg)),
  });
  c.define({
    id: 'find.replaceOne',
    label: 'Replace',
    enabled: () => finder.open && finder.current >= 0,
    undoable: true,
    run: () => finder.replaceCurrent(false),
  });
  c.define({
    id: 'find.replaceAndFind',
    label: 'Replace & Find',
    enabled: () => finder.open && finder.current >= 0,
    undoable: true,
    run: () => finder.replaceCurrent(true),
  });
  c.define({
    id: 'find.replaceAll',
    label: 'Replace All',
    enabled: () => finder.open && finder.matches.length > 0,
    undoable: true,
    run: async () => {
      await finder.replaceAll();
    },
  });
  c.define({
    id: 'find.close',
    label: 'Close Find',
    enabled: () => finder.open,
    run: () => finder.hide(),
  });
  const option = (id: string, label: string, key: keyof FindOptions) =>
    c.define({ id, label, checked: () => finder.options[key], run: () => finder.toggle(key) });
  option('find.matchCase', 'Match Case', 'matchCase');
  option('find.wholeWords', 'Whole Words', 'wholeWords');
  c.define({ id: 'find.tex', label: 'Search TeX of Formulas', enabled: () => finder.scope !== 'alt', checked: () => finder.options.tex, run: () => finder.toggle('tex') });
  // the scope of the search, one of three as a choice of the gear menu
  const scope = (id: string, label: string, value: Scope) =>
    c.define({ id, label, checked: () => finder.scope === value, run: () => finder.setScope(value) });
  scope('find.scopeAll', 'Slides and Notes', 'all');
  scope('find.scopeNotes', 'Notes Only', 'notes');
  scope('find.scopeAlt', 'Alt Texts', 'alt');
}
