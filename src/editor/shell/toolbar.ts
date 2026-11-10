// the toolbar of today: the file, its state, Which?, and the buttons Undo, Redo, Open…, Save,
// Save as…, Autosave, and Present, each of which runs a command of the registry. the toolbar of
// the plan, drawn from the registry, is built here

import type { App } from '../app.ts';
import { canWrite, fileName } from '../file/files.ts';
import { button, injectStyle, make, wire } from '../ui/dom.ts';

const CSS = `
.beeson-edit-top, .beeson-edit-bottom { position: fixed; left: 0; right: 0; z-index: 60; display: flex; align-items: center; gap: 12px; box-sizing: border-box; padding: 0 16px; background: var(--bg, #000); color: var(--text, #eee); font: 14px/1.4 system-ui, sans-serif; }
.beeson-edit-top { top: 0; height: 44px; border-bottom: 1px solid var(--line, #555); }
.beeson-edit-top .file { font-weight: 600; white-space: nowrap; }
.beeson-edit-top .state { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--subtle, #bbb); }
.beeson-edit-top .state.warn { color: var(--accent, #f80); }
.beeson-edit-top button, .beeson-edit-bottom button { font: inherit; padding: 4px 12px; border: 1px solid var(--line, #555); border-radius: 6px; background: transparent; color: var(--text, #eee); cursor: pointer; white-space: nowrap; }
.beeson-edit-top button:hover, .beeson-edit-bottom button:hover { border-color: var(--subtle, #bbb); }
.beeson-edit-top button:disabled { opacity: 0.4; cursor: default; }
.beeson-edit-top button.on { border-color: var(--accent, #f80); color: var(--accent, #f80); }
`;

export function install(app: App): void {
  injectStyle('toolbar', CSS);
  const top = make('div', 'beeson-edit-top');
  const fileEl = make('span', 'file');
  const stateEl = make('span', 'state');
  stateEl.setAttribute('aria-live', 'polite');
  const undoButton = button('Undo', 'Undo the last change, ⌘Z or Ctrl+Z');
  const redoButton = button('Redo', 'Redo the change undone, ⌘⇧Z or Ctrl+Y');
  const openButton = button('Open…', 'Choose the file of this deck');
  const saveButton = button('Save', 'Save the edits into the file, ⌘S or Ctrl+S');
  const saveAsButton = button('Save as…', 'Save the deck into another file, ⌘⇧S or Ctrl+Shift+S');
  const autosaveButton = button('Autosave', 'Save the edits into the file after each change');
  const presentButton = button('Present', 'Show the saved deck in a new tab');
  const whichButton = button('Which?', 'List the texts that cannot be edited');
  whichButton.className = 'which';
  whichButton.hidden = true;
  undoButton.disabled = redoButton.disabled = true;
  top.append(fileEl, stateEl, whichButton, undoButton, redoButton, openButton, saveButton, saveAsButton, autosaveButton, presentButton);

  const fail = (e: unknown) => app.fail(e);
  const run = (id: string) => () => app.commands.run(id);
  wire(openButton, run('file.open'), fail);
  wire(saveButton, run('file.save'), fail);
  wire(saveAsButton, run('file.saveAs'), fail);
  wire(autosaveButton, run('file.autosave'), fail);
  wire(presentButton, run('file.present'), fail);
  wire(undoButton, run('edit.undo'), fail);
  wire(redoButton, run('edit.redo'), fail);
  wire(whichButton, () => app.files.showProblems(), fail);
  if (!canWrite()) {
    autosaveButton.disabled = true;
    autosaveButton.title = 'Autosave needs a browser that writes the file in place, i.e. Chrome or Edge';
  }
  app.listen('history', () => {
    undoButton.disabled = !app.history.canUndo;
    redoButton.disabled = !app.history.canRedo;
  });
  app.listen('report', () => {
    fileEl.textContent = app.handle?.name ?? fileName();
    saveButton.classList.toggle('on', app.dirty);
    autosaveButton.classList.toggle('on', app.autosave);
    autosaveButton.setAttribute('aria-pressed', String(app.autosave));
    whichButton.hidden = !app.pairing?.problems.length;
    stateEl.textContent = app.line.text;
    stateEl.title = app.line.title;
    stateEl.classList.toggle('warn', app.line.warn);
  });
  document.body.append(top);
}
