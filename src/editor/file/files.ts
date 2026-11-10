// the file of the deck: open, save, save as, autosave, and present, with the cards that ask for the
// file, ask before Open or Present with unsaved changes, and list the texts that cannot be edited.
// the file is written through the File System Access API where a browser has it, i.e. in Chrome
// and Edge, and elsewhere a copy with the edits is put into the downloads of the browser

import type { App, Files, Line } from '../app.ts';
import { parseSource } from '../source.ts';
import { pair, renderDeck, type Pairing } from '../render.ts';
import { mathLookup } from '../math.ts';
import { button, injectStyle, make, store, stored, wire } from '../ui/dom.ts';

type PickerOptions = { types?: { description: string; accept: Record<string, string[]> }[]; multiple?: boolean; suggestedName?: string };
type Pickers = {
  showOpenFilePicker?: (options?: PickerOptions) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: PickerOptions) => Promise<FileSystemFileHandle>;
};

// the type of the file to save. a file to open is chosen without a filter, since a filter may leave
// index.html grayed out in the dialog of macOS, and a file that is not the deck is reported once read
const FILE_TYPES = [{ description: 'HTML', accept: { 'text/html': ['.html', '.htm'] } }];
const AUTOSAVE_KEY = 'beeson-autosave';
// the pause after the last change, in ms, before an autosave
const AUTOSAVE_DELAY = 1500;

const pickers = window as unknown as Pickers;
// the pickers are read when they are used, so that a test can take them away
export const canPick = (): boolean => typeof pickers.showOpenFilePicker === 'function';
export const canWrite = (): boolean => typeof pickers.showSaveFilePicker === 'function';

export const fileName = (): string => decodeURIComponent(location.pathname.split('/').pop() || '') || 'index.html';
export const folder = (): string => decodeURIComponent(location.pathname).replace(/[^/]*$/, '');
// the advice after a save that is a download. Safari and Firefox put a download into the downloads
// folder, unless they are set to ask where to save each download. index.html is then chosen and
// replaced in the dialog of the browser
const REPLACE = (): string => `Replace ${fileName()} in ${folder()} with it, or set the browser to ask where to save each download`;
export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
const clock = (): string => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const CSS = `
.beeson-edit-card { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 65; box-sizing: border-box; width: min(600px, calc(100vw - 32px)); padding: 24px 28px; border: 1px solid var(--line, #555); border-radius: 10px; background: var(--bg, #000); color: var(--text, #eee); font: 15px/1.5 system-ui, sans-serif; box-shadow: 0 12px 48px rgba(0, 0, 0, 0.45); }
.beeson-edit-card[hidden] { display: none; }
.beeson-edit-card h3 { margin: 0 0 8px; font: 600 18px/1.3 system-ui, sans-serif; }
.beeson-edit-card p { margin: 0 0 16px; color: var(--subtle, #bbb); }
.beeson-edit-card code { font: 13px/1.5 ui-monospace, Menlo, Consolas, monospace; color: var(--text, #eee); word-break: break-all; }
.beeson-edit-card button { font: inherit; padding: 8px 16px; border: 1px solid var(--violet, #96f); border-radius: 6px; background: transparent; color: var(--text, #eee); cursor: pointer; white-space: nowrap; }
.beeson-edit-card .row { display: flex; flex-wrap: wrap; gap: 8px; }
.beeson-edit-card .row button:not(:first-child) { border-color: var(--line, #555); }
`;

// a copy of the file for a browser that cannot write it in place
export function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/html' }));
  const a = make('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function write(to: FileSystemFileHandle, text: string): Promise<void> {
  const writable = await to.createWritable();
  await writable.write(text);
  await writable.close();
}

// the file is asked for with the save picker and kept in app.handle, and false is returned when
// the picker is dismissed
export async function pickTarget(app: App): Promise<boolean> {
  if (!pickers.showSaveFilePicker) return false;
  try {
    app.handle = await pickers.showSaveFilePicker({ suggestedName: app.handle?.name ?? fileName(), types: FILE_TYPES });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return false;
    throw error;
  }
}

// a file chosen with the input element, in a browser without the open picker
function pickFile(): Promise<File | null> {
  return new Promise((done) => {
    const input = make('input');
    input.type = 'file';
    input.style.display = 'none';
    const finish = (file: File | null) => {
      input.remove();
      done(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    document.body.append(input);
    input.click();
  });
}

const ASK = {
  open: {
    text: 'Save them into the file first, open a file without them, or go on editing.',
    save: ['Save and open…', 'Save the edits into the file, then choose a file'],
    discard: ['Open without saving', 'Put the slides back as saved, then choose a file'],
  },
  present: {
    text: 'Save them into the file first, present the saved file without them, or go on editing.',
    save: ['Save and present', 'Save the edits into the file, then show the deck in a new tab'],
    discard: ['Present the saved file', 'Show the deck as saved in a new tab, and keep the edits here'],
  },
};

export function install(app: App): void {
  injectStyle('files', CSS);

  // the card shown until a file is chosen on file:, where the page cannot read itself
  const card = make('div', 'beeson-edit-card');
  const cardText = make('p');
  const cardButton = button(`Choose ${fileName()}…`);
  card.append(make('h3', '', 'Choose the file of this deck'), cardText, cardButton);
  card.hidden = true;

  // the card shown when Open or Present is pressed with unsaved changes, as the prompt of PowerPoint
  const ask = make('div', 'beeson-edit-card ask');
  const askText = make('p');
  const askSave = button('');
  const askDiscard = button('');
  const askCancel = button('Cancel', 'Go on editing');
  const askRow = make('div', 'row');
  askRow.append(askSave, askDiscard, askCancel);
  ask.append(make('h3', '', 'The deck has unsaved changes'), askText, askRow);
  ask.hidden = true;
  let asking: ((choice: 'save' | 'discard' | null) => void) | null = null;

  // the card that lists the texts that cannot be edited, opened with Which? after the state
  const problemsCard = make('div', 'beeson-edit-card problems');
  const problemsList = make('ul');
  problemsList.style.cssText = 'margin: 0 0 16px; padding-left: 20px; max-height: 50vh; overflow-y: auto; color: var(--subtle, #bbb);';
  const problemsClose = button('Close');
  const problemsRow = make('div', 'row');
  problemsRow.append(problemsClose);
  problemsCard.append(make('h3', '', 'Texts that cannot be edited'), problemsList, problemsRow);
  problemsCard.hidden = true;

  // a save in flight, and whether another one was asked for meanwhile
  let saving = false;
  let again = false;
  let autosaveTimer = 0;

  const problemText = (p: Pairing['problems'][number]): string => `slide ${app.slideNumber(p.slide) ?? '?'}, ${p.tag}: ${p.reason}`;

  function askFirst(action: keyof typeof ASK): Promise<'save' | 'discard' | null> {
    const words = ASK[action];
    askText.textContent = words.text;
    [askSave.textContent, askSave.title] = words.save;
    [askDiscard.textContent, askDiscard.title] = words.discard;
    return new Promise((done) => {
      asking = done;
      ask.hidden = false;
      askCancel.focus();
    });
  }

  function answer(choice: 'save' | 'discard' | null): void {
    ask.hidden = true;
    asking?.(choice);
    asking = null;
  }

  function showProblems(): void {
    problemsList.replaceChildren(...(app.pairing?.problems ?? []).map((p) => make('li', '', problemText(p))));
    problemsCard.hidden = false;
    problemsClose.focus();
  }

  // the focus goes back to Which? in the toolbar
  function closeProblems(): void {
    problemsCard.hidden = true;
    const which = document.querySelector<HTMLButtonElement>('.beeson-edit-top button.which');
    if (which && !which.hidden) which.focus();
  }

  function line(): Line {
    const plain = (text: string, warn = false): Line => ({ text, warn, title: '' });
    if (app.state === 'waiting') return plain('Choose the file of this deck to start editing');
    const pairing = app.pairing;
    if (!pairing) return plain(app.note?.text ?? 'Loading', app.note?.warn ?? false);
    if (!pairing.blocks.length) return plain('This file is not the deck on the page', true);
    const problems = pairing.problems;
    const parts = [app.dirty ? 'Unsaved changes' : app.note?.text ?? 'No unsaved changes'];
    if (problems.length) parts.push(`${plural(problems.length, 'text')} cannot be edited`);
    if (app.overflow) parts.push(`${plural(app.overflow, 'text')} run${app.overflow === 1 ? 's' : ''} past the slide or into its footnote`);
    if (app.autosave && !app.handle && canWrite()) parts.push('autosave starts after the first save');
    return { text: parts.join('. '), warn: (app.note?.warn ?? false) || problems.length > 0 || app.overflow > 0, title: problems.map(problemText).join('\n') };
  }

  // pairs the text of the file with the page and makes the paired blocks editable. the state
  // reports the blocks that could not be paired. a fresh file starts the history anew and is
  // checked against the edits kept in the storage, and the text of a save is paired again in place
  function open(text: string, fresh = true): void {
    app.tagEdits.clear();
    if (fresh) {
      app.history.clear();
      app.move.select(null);
    }
    try {
      app.source = parseSource(text);
      app.pairing = pair(app.source, app.slides(), mathLookup());
      app.state = 'loaded';
      app.dirty = false;
      if (!app.pairing.blocks.length) app.pairing.problems.push({ slide: null, tag: 'slides', reason: 'nothing on the page was found in the file' });
    } catch (error) {
      app.source = null;
      app.pairing = null;
      app.state = 'error';
      app.note = { text: error instanceof Error ? error.message : String(error), warn: true };
    }
    app.typing.attach();
    app.report();
    app.invalidate();
    if (fresh) app.drafts.offer();
  }

  // the text of the file with the edits of the page, without writing it
  function render(): string {
    if (!app.source || !app.pairing) throw new Error('no file is open');
    return renderDeck(app.source, app.pairing, mathLookup(), app.tagEdits).text;
  }

  // the edits since the last save are undone, so that the page reads as the saved file again
  async function discardEdits(): Promise<void> {
    while (app.history.canUndo) await app.history.undo();
    app.history.clear();
    app.move.select(null);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.clearTimeout(autosaveTimer);
    app.drafts.drop();
    app.dirty = false;
    app.report();
  }

  // with unsaved changes, the user is asked first, as in PowerPoint: a save, a discard, or no open
  async function openFile(): Promise<void> {
    app.note = null;
    if (app.dirty) {
      const choice = await askFirst('open');
      if (!choice) return;
      if (choice === 'save') {
        await save();
        if (app.dirty) return;
      } else await discardEdits();
    }
    if (canPick() && pickers.showOpenFilePicker) {
      let picked: FileSystemFileHandle[];
      try {
        picked = await pickers.showOpenFilePicker({ multiple: false });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        throw error;
      }
      const text = await (await picked[0].getFile()).text();
      app.handle = picked[0];
      open(text);
      return;
    }
    const file = await pickFile();
    if (!file) return;
    app.handle = null;
    open(await file.text());
  }

  // writes the rendered text to the file, asking for the file at the first save of a deck opened
  // from a server. the saved text is then paired again, so that the next save starts from it. a
  // save asked for while one is in flight is run after it
  async function save(): Promise<void> {
    if (saving) {
      again = true;
      return;
    }
    saving = true;
    try {
      await doSave();
    } finally {
      saving = false;
    }
    if (again) {
      again = false;
      if (app.dirty) await save();
    }
  }

  async function doSave(): Promise<void> {
    if (!app.source || !app.pairing) {
      app.note = { text: 'Choose the file of this deck first', warn: true };
      app.report();
      return;
    }
    const rendered = renderDeck(app.source, app.pairing, mathLookup(), app.tagEdits);
    if (!app.handle && canWrite() && !(await pickTarget(app))) return;
    const n = rendered.edits.length;
    const edits = plural(n, 'edit');
    let text: string;
    if (app.handle) {
      await write(app.handle, rendered.text);
      text = n ? `Saved ${edits} to ${app.handle.name} at ${clock()}` : `Saved ${app.handle.name} at ${clock()}`;
    } else {
      download(fileName(), rendered.text);
      text = `${n ? `Saved a copy with ${edits}` : `Saved a copy of ${fileName()}`}. ${REPLACE()}`;
    }
    const warnings = rendered.warnings.length ? `, ${rendered.warnings.join(', ')}` : '';
    app.note = { text: `${text}${warnings}`, warn: rendered.warnings.length > 0 };
    // an edit made while the file was written is kept for the next save, since the page no longer
    // reads as the saved text
    if (render() === rendered.text) {
      open(rendered.text, false);
      app.drafts.drop();
    } else {
      app.report();
      scheduleAutosave();
    }
  }

  // the deck is written into a file chosen with the picker, and where there is no picker a save is
  // a download anyway
  async function saveAs(): Promise<void> {
    if (!app.source || !app.pairing) {
      app.note = { text: 'Choose the file of this deck first', warn: true };
      app.report();
      return;
    }
    if (canWrite() && !(await pickTarget(app))) return;
    await save();
  }

  // a deck whose text is the file again, e.g. after its edits were undone, is clean
  function cleanIfSaved(): void {
    if (!app.source || !app.pairing) return;
    try {
      if (render() !== app.source.text) return;
    } catch {
      return;
    }
    app.dirty = false;
    window.clearTimeout(autosaveTimer);
    app.drafts.drop();
    app.report();
  }

  function scheduleAutosave(): void {
    window.clearTimeout(autosaveTimer);
    if (!app.autosave || !app.handle) return;
    autosaveTimer = window.setTimeout(() => {
      if (app.dirty && !saving) void save().catch((e) => app.fail(e));
    }, AUTOSAVE_DELAY);
  }

  // the switch is kept in the storage, as the AutoSave switch of PowerPoint
  function toggleAutosave(): void {
    app.autosave = !app.autosave;
    store(AUTOSAVE_KEY, app.autosave ? '1' : '0');
    if (app.dirty) scheduleAutosave();
    app.report();
  }

  // the saved deck in a new tab, without the editor. with unsaved changes, the user is asked first
  async function present(): Promise<void> {
    if (app.dirty) {
      const choice = await askFirst('present');
      if (!choice) return;
      if (choice === 'save') {
        await save();
        if (app.dirty) return;
      }
    }
    const params = new URLSearchParams(location.search);
    params.delete('edit');
    // a parameter without a value, such as still, is kept without an equals sign
    const query = params.toString().replace(/=(?=&|$)/g, '');
    window.open(`${location.href.split(/[?#]/)[0]}${query ? `?${query}` : ''}${location.hash}`, '_blank');
  }

  const files: Files = {
    open,
    render,
    save,
    saveAs,
    openFile,
    present,
    toggleAutosave,
    line,
    showProblems,
    closeProblems,
    problemsShown: () => !problemsCard.hidden,
    askShown: () => !ask.hidden,
    cancelAsk: () => answer(null),
  };
  app.files = files;
  app.autosave = canWrite() && stored(AUTOSAVE_KEY) === '1';

  const fail = (e: unknown) => app.fail(e);
  wire(cardButton, openFile, fail);
  wire(askSave, () => answer('save'), fail);
  wire(askDiscard, () => answer('discard'), fail);
  wire(askCancel, () => answer(null), fail);
  wire(problemsClose, closeProblems, fail);
  app.listen('report', () => {
    card.hidden = app.state !== 'waiting';
    if (app.state !== 'waiting') return;
    const where = `${fileName()} in ${folder()}, i.e. the file that is open here`;
    cardText.textContent = canWrite()
      ? `A browser writes only to a file that you have chosen. Choose ${where}, and your edits are saved into it.`
      : `This browser does not write to a file by itself. Choose ${where}. A save is then a download of a copy with your edits. Set the browser to ask where to save each download, and you choose ${fileName()} in its folder and replace it.`;
  });
  app.listen('history', () => {
    if (app.dirty) cleanIfSaved();
  });
  app.listen('dirty', scheduleAutosave);
  window.addEventListener('beforeunload', (ev) => { if (app.dirty) ev.preventDefault(); });
  document.body.append(card, ask, problemsCard);
}

// the text is fetched when the deck is served, and with file: it is chosen with the card
export async function fetchSource(app: App): Promise<boolean> {
  if (location.protocol === 'file:') return false;
  try {
    const response = await fetch(location.href.split(/[?#]/)[0], { cache: 'no-store' });
    if (!response.ok) return false;
    app.files.open(await response.text());
    return true;
  } catch {
    return false;
  }
}
