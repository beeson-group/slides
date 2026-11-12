// Delete of the selected elements of the current slide, each taken off the page with the white space
// and the comments before it, as one entry of the history. a locked element is skipped and stays
// selected, as in Keynote, and Delete is disabled while every selected element is locked. the image
// of the other mode beside a deleted image goes with it. in a text, Delete of the menu deletes the
// selected words as Cut does, and it is dimmed at a caret as in both apps. the keys of Delete are
// left to the browser in a text

import type { App } from '../app.ts';
import { locked } from '../canvas/drag.ts';
import { objectsOf, withTwins } from '../canvas/hit.ts';
import { fieldCells, hasRange, inCells, inText } from './clipboard.ts';
import { keepBeside } from './place.ts';
import { docOf, onSlides } from './slide.ts';
import { clearRange, selectedRange } from './table.ts';
import { removeJoining } from '../text/blocks.ts';

// the selected elements that are in the file, with the figure of a picture selected inside it, and
// without the slides
function selectedElements(app: App): Element[] {
  return objectsOf(app, app.selection.elements()).filter((el) => el.isConnected && !el.matches('.reveal .slides > section') && !!app.pairing?.elements.has(el));
}

export function install(app: App): void {
  app.commands.define({
    id: 'element.delete',
    label: 'Delete',
    keys: { mac: ['Backspace', 'Delete'], other: ['Delete', 'Backspace'] },
    in: ['canvas'],
    menu: { bar: 'Edit', group: 'clipboard', order: 23 },
    context: ['element'],
    enabled: (a) => (onSlides(a) ? a.commands.enabled('slide.delete') : inText(a) ? hasRange() || inCells(a) : selectedElements(a).some((el) => !locked(el))),
    listedAs: (a) => (onSlides(a) ? 'slide.delete' : 'element.delete'),
    runsAs: (a) => (onSlides(a) ? 'slide.delete' : 'element.delete'),
    undoable: true,
    get undo() {
      return inCells(app) ? fieldCells.label : undefined;
    },
    run: async (a) => {
      if (onSlides(a)) return a.commands.run('slide.delete');
      // on a range of cells around a field, the cells are cleared, as by the Delete key
      if (inCells(a)) return fieldCells.clear();
      if (inText(a)) return void document.execCommand('delete');
      // on a range of cells, the text of the cells is cleared, as by the Delete key
      if (selectedRange(a)) return clearRange(a);
      const doc = docOf(a);
      // an element inside another selected one goes with it
      const els = selectedElements(a);
      const kept = els.filter((el) => locked(el));
      const outer = withTwins(a, els.filter((el) => !locked(el) && !els.some((o) => o !== el && o.contains(el))));
      // an element with an offset beside a deleted plate is kept in its place
      const keep = keepBeside(a, [...outer]);
      // an undo selects the deleted elements again, as in Keynote
      await a.history.selecting('Delete', async () => {
        if (kept.length) a.selection.set('elements', kept);
        else a.selection.clear();
        await removeJoining(a, outer.reverse(), 'delete');
        keep((el, translate) => doc.setTag(el, { translate }, 'move'));
      });
    },
  });
}
