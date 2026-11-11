// the commands Undo and Redo of the Edit menu, named after the entry of the history that they take
// back, e.g. Undo Typing. their keys are those of both apps, and Redo has the key of PowerPoint
// and the key of Keynote. the browser keeps a history of its own in a text, hence the keys are
// taken in a text too, and they are left to a field and a dialog. the install also defines Edit >
// Spelling and Grammar > Check Spelling While Typing of Keynote, and Size and Position… of the menu
// of an element in PowerPoint

import type { App } from '../app.ts';
import { OUTSIDE_DIALOGS } from '../commands.ts';
import { store, stored } from '../ui/dom.ts';

const IN = OUTSIDE_DIALOGS.filter((r) => r !== 'field');

// the articles, coordinating conjunctions, and short prepositions that the title case of Apple
// keeps in lowercase inside a menu item. up, out, off, and over are left out, since they are most
// often a part of the verb, as in Set Up
const MINOR = new Set(['a', 'an', 'the', 'and', 'but', 'nor', 'or', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'onto', 'to', 'via', 'with']);

// a label of the history in the title case of macOS menus, e.g. resize column to fit content as
// Resize Column to Fit Content. a word given with a capital is kept, e.g. QR
export function titled(label: string): string {
  const words = label.split(/(\s+)/);
  const last = words.length - 1;
  return words.map((w, i) => (i === 0 || i === last || !MINOR.has(w) ? w.replace(/^\p{Ll}/u, (l) => l.toUpperCase()) : w)).join('');
}

const SPELLING_KEY = 'beeson-spelling';

// the switch of the spelling of the browser, which underlines a misspelled word in a block. it is
// set as spellcheck="false" on the html element of the page, which every block inherits, and the
// file is not changed. a field of the editor that asks for spelling itself, e.g. a line of the
// outline, is switched when it is focused
function installSpelling(app: App): void {
  let on = stored(SPELLING_KEY) !== '0';
  const asked = new WeakSet<HTMLElement>();
  const apply = () => {
    if (on) document.documentElement.removeAttribute('spellcheck');
    else document.documentElement.setAttribute('spellcheck', 'false');
  };
  document.addEventListener('focusin', (ev) => {
    const el = ev.target;
    if (!(el instanceof HTMLElement) || el.closest('.reveal')) return;
    if (!on && el.getAttribute('spellcheck') === 'true') {
      asked.add(el);
      el.spellcheck = false;
    } else if (on && asked.has(el)) el.spellcheck = true;
  }, true);
  apply();
  app.commands.define({
    id: 'edit.spelling',
    label: 'Check Spelling While Typing',
    menu: { bar: 'Edit', group: 'substitutions', order: 80, submenu: 'Spelling and Grammar' },
    checked: () => on,
    run: () => {
      on = !on;
      store(SPELLING_KEY, on ? null : '0');
      apply();
    },
  });
}

const frame = () => new Promise((done) => requestAnimationFrame(done));

// the Arrange pane of the Format tab, with the focus in W, or in X when the size is set by the
// layout of the slide, as Size and Position… of PowerPoint opens the Size and Position pane
async function sizeAndPosition(app: App): Promise<void> {
  // imported here, since the tests of titled import this module in node, without a document
  const { showFormat } = await import('../inspector/inspector.ts');
  showFormat(app, 'arrange');
  for (let i = 0; i < 3; i++) {
    const panel = document.getElementById('beeson-edit-panel-format');
    const field = ['width', 'x'].map((n) => panel?.querySelector<HTMLInputElement>(`#beeson-edit-num-${n}`)).find((f) => f && !f.disabled);
    if (field) {
      field.focus();
      field.select();
      return;
    }
    await frame();
  }
}

export function install(app: App): void {
  installSpelling(app);
  const c = app.commands;
  c.define({
    id: 'edit.undo',
    label: (a) => (a.history.undoLabel ? `Undo ${titled(a.history.undoLabel.replace(/…$/, ''))}` : 'Undo'),
    keys: { mac: ['Mod+Z'], other: ['Mod+Z'] },
    in: IN,
    menu: { bar: 'Edit', group: 'history', order: 10 },
    toolbar: { group: 'history', order: 10, icon: 'undo', label: 'Undo' },
    enabled: (a) => a.history.canUndo,
    run: (a) => a.history.undo(),
  });
  c.define({
    id: 'edit.redo',
    label: (a) => (a.history.redoLabel ? `Redo ${titled(a.history.redoLabel.replace(/…$/, ''))}` : 'Redo'),
    keys: { mac: ['Mod+Shift+Z', 'Mod+Y'], other: ['Mod+Y', 'Mod+Shift+Z'] },
    in: IN,
    menu: { bar: 'Edit', group: 'history', order: 11 },
    toolbar: { group: 'history', order: 11, icon: 'redo', label: 'Redo' },
    enabled: (a) => a.history.canRedo,
    run: (a) => a.history.redo(),
  });
  c.define({
    id: 'arrange.sizeAndPosition',
    label: 'Size and Position…',
    context: ['element'],
    enabled: (a) => a.selection.elements().length > 0 && a.region() !== 'dialog',
    run: (a) => sizeAndPosition(a),
  });
}
