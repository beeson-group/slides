// Delete of the selected elements of the current slide, each taken off the page with the white space
// and the comments before it, as one entry of the history. a locked element is skipped and stays
// selected, as in Keynote, and Delete is disabled while every selected element is locked

import type { App } from '../app.ts';
import { locked } from '../canvas/drag.ts';
import { docOf } from './slide.ts';

// the selected elements that are in the file, without the slides
function selectedElements(app: App): Element[] {
  return app.selection.elements().filter((el) => el.isConnected && !el.matches('.reveal .slides > section') && !!app.pairing?.elements.has(el));
}

export function install(app: App): void {
  app.commands.define({
    id: 'element.delete',
    label: 'Delete',
    keys: { mac: ['Backspace', 'Delete'], other: ['Delete', 'Backspace'] },
    in: ['canvas'],
    menu: { bar: 'Edit', group: 'delete', order: 40 },
    context: ['element'],
    enabled: (a) => selectedElements(a).some((el) => !locked(el)),
    undoable: true,
    run: async (a) => {
      const doc = docOf(a);
      // an element inside another selected one goes with it
      const els = selectedElements(a);
      const kept = els.filter((el) => locked(el));
      const outer = els.filter((el) => !locked(el) && !els.some((o) => o !== el && o.contains(el)));
      if (kept.length) a.selection.set('elements', kept);
      else a.selection.clear();
      for (const el of outer.reverse()) await doc.remove(el, 'delete');
    },
  });
}
