// Delete of the selected elements of the current slide, each taken off the page with the white space
// and the comments before it, as one entry of the history

import type { App } from '../app.ts';
import { docOf, takeKeys } from './slide.ts';

// the selected elements that are in the file. until the selection of selection.ts holds the
// elements, the element selected by move.ts is taken
function selectedElements(app: App): Element[] {
  const sel = app.selection;
  const legacy = (app.move as unknown as { selected?: Element | null }).selected ?? null;
  const items = sel?.kind === 'elements' ? [...sel.items] : legacy ? [legacy] : [];
  return items.filter((el) => el.isConnected && !el.matches('.reveal .slides > section') && !!app.pairing?.elements.has(el));
}

export function install(app: App): void {
  app.commands.define({
    id: 'element.delete',
    label: 'Delete',
    keys: { mac: ['Backspace', 'Delete'], other: ['Delete', 'Backspace'] },
    in: ['canvas'],
    menu: { bar: 'Edit', group: 'delete', order: 40 },
    context: ['element'],
    enabled: (a) => selectedElements(a).length > 0,
    undoable: true,
    run: async (a) => {
      const doc = docOf(a);
      // an element inside another selected one goes with it
      const els = selectedElements(a);
      const outer = els.filter((el) => !els.some((o) => o !== el && o.contains(el)));
      a.move.select(null);
      a.selection.clear();
      for (const el of outer.reverse()) await doc.remove(el, 'delete');
    },
  });
  takeKeys(app, ['element.delete']);
}
