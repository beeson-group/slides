// the file of the deck: open, save, save as, autosave, and present, with the cards that ask for the
// file, ask before Open or Present with unsaved changes, and list the texts that cannot be edited.
// the file is written through the File System Access API where a browser has it, i.e. in Chrome
// and Edge, and elsewhere a copy with the edits is put into the downloads of the browser

import type { App, Files, Line } from '../app.ts';
import { parseSource } from '../source.ts';
import { pair, renderDeck, type Pairing } from '../render.ts';
import { mathLookup } from '../math.ts';
import { coverSentences } from '../overflow.ts';
import { make, store, stored } from '../ui/dom.ts';
import { Dialog, host } from '../ui/dialog.ts';
import { display } from '../keymap.ts';
import { forget, loadRecents, pageOf, recentsOfPage, remember, type Recent } from './recent.ts';
import { startShow } from '../show.ts';

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

// the files that a text of the deck names and that are not on the disk yet, e.g. a new image under
// media/, written next to the deck before the text, or downloaded with it. each returns a sentence
// for the state, empty when it did not have anything to do
export type Companions = { write(text: string, deck: FileSystemFileHandle): Promise<string>; download(text: string): string };
let companions: Companions | null = null;
export const setCompanions = (c: Companions): void => {
  companions = c;
};

// a copy of the file for a browser that cannot write it in place
export function download(name: string, text: string): string {
  const note = companions?.download(text) ?? '';
  const url = URL.createObjectURL(new Blob([text], { type: 'text/html' }));
  const a = make('a');
  a.href = url;
  a.download = name;
  host().append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return note;
}

export async function write(to: FileSystemFileHandle, text: string): Promise<string> {
  const note = (await companions?.write(text, to)) ?? '';
  const writable = await to.createWritable();
  await writable.write(text);
  await writable.close();
  return note;
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
    host().append(input);
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
    save: ['Save and present', 'Save the edits into the file, then play the show'],
    discard: ['Present the saved file', 'Play the show of the deck as saved, and keep the edits here'],
  },
  export: {
    text: 'The PDF is printed from the file. Save the edits into it first, export the saved file without them, or go on editing.',
    save: ['Save and export', 'Save the edits into the file, then open its print view in a new tab'],
    discard: ['Export the saved file', 'Open the print view of the deck as saved in a new tab, and keep the edits here'],
  },
  pptx: {
    text: 'The PowerPoint file is written from the file. Save the edits into it first, export the saved file without them, or go on editing.',
    save: ['Save and export', 'Save the edits into the file, then show the command that writes the PowerPoint file'],
    discard: ['Export the saved file', 'Show the command that writes the PowerPoint file of the deck as saved, and keep the edits here'],
  },
  print: {
    text: 'The slides are printed from the file. Save the edits into it first, print the saved file without them, or go on editing.',
    save: ['Save and print', 'Save the edits into the file, then open its print view in a new tab'],
    discard: ['Print the saved file', 'Open the print view of the deck as saved in a new tab, and keep the edits here'],
  },
};

// the actions of the File menu that are not services of app.files, set at the install
export type FileActions = {
  revert(): Promise<void>;
  openRecent(r: Recent): Promise<void>;
  exportPdf(action?: 'export' | 'print'): Promise<void>;
  exportHtml(): Promise<void>;
  exportPptx(): Promise<void>;
};
let actions: FileActions | null = null;
export function fileActions(): FileActions {
  if (!actions) throw new Error('the file of the deck is not installed');
  return actions;
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

export function install(app: App): void {
  const fail = (e: unknown) => app.fail(e);
  const later = (action: () => unknown) => Promise.resolve().then(action).catch(fail);

  // the dialog shown until a file is chosen on file:, where the page cannot read itself. the file of
  // this page opened last is offered first when the browser keeps it for Open Recent
  const card = new Dialog({
    title: 'Choose the file of this deck',
    text: '',
    buttons: [{ label: `Choose ${fileName()}…`, value: 'choose', primary: true }],
    dismissable: false,
    stay: ['choose', 'recent'],
    onButton: (value) => later(() => {
      const last = recentsOfPage()[0];
      return value === 'recent' && last ? openRecent(last) : openFile();
    }),
  });
  let cardRecent: Recent | null = null;

  // the dialog that asks before File > Revert to Saved, as macOS asks in its apps
  const revertCard = new Dialog({
    title: 'Do you want to revert to the most recently saved version?',
    text: 'Your current changes will be lost.',
    buttons: [
      { label: 'Revert', title: 'Forget the edits since the last save, and show the deck as its file holds it', value: 'revert', primary: true },
      { label: 'Cancel', title: 'Go on editing', value: 'cancel' },
    ],
    className: 'revert',
  });

  // the dialog shown when Open or Present is pressed with unsaved changes, as the prompt of PowerPoint
  const ask = new Dialog({ title: 'The deck has unsaved changes', text: '', buttons: [], className: 'ask' });

  // the dialog of PowerPoint… of Export To, with the command that writes the file, since a page
  // cannot take the screenshots of scripts/export-pptx.mjs
  const pptxCommand = make('code');
  const pptxBody = make('p');
  pptxBody.append(pptxCommand);
  const pptxCard = new Dialog({
    title: 'Export to PowerPoint',
    text: '',
    body: pptxBody,
    buttons: [
      { label: 'Copy Command', title: 'Put the command on the clipboard', value: 'copy', primary: true },
      { label: 'Close', value: 'close' },
    ],
    className: 'pptx',
    stay: ['copy'],
    onButton: (value) => {
      if (value !== 'copy') return;
      const button = pptxCard.buttons.get('copy');
      void navigator.clipboard.writeText(pptxCommand.textContent ?? '').then(
        () => button && (button.textContent = 'Copied'),
        () => {
          app.note = { text: 'The browser did not let the page copy the command', warn: true };
          app.report();
        },
      );
    },
  });

  // the dialog that lists the texts that cannot be edited, opened with Which? after the state
  const problemsList = make('ul');
  const problemsCard = new Dialog({
    title: 'Texts that cannot be edited',
    body: problemsList,
    buttons: [{ label: 'Close', value: 'close', primary: true }],
    className: 'problems',
    onButton: () => later(closeProblems),
  });

  // a save in flight, and whether another one was asked for meanwhile
  let saving = false;
  let again = false;
  let autosaveTimer = 0;

  const problemText = (p: Pairing['problems'][number]): string => `slide ${app.slideNumber(p.slide) ?? '?'}, ${p.tag}: ${p.reason}`;

  async function askFirst(action: keyof typeof ASK): Promise<'save' | 'discard' | null> {
    const words = ASK[action];
    ask.text.textContent = words.text;
    ask.setButtons([
      { label: words.save[0], title: words.save[1], value: 'save', primary: true },
      { label: words.discard[0], title: words.discard[1], value: 'discard' },
      { label: 'Cancel', title: 'Go on editing', value: 'cancel' },
    ]);
    const choice = await ask.open('cancel');
    return choice === 'save' || choice === 'discard' ? choice : null;
  }

  function showProblems(): void {
    problemsList.replaceChildren(...(app.pairing?.problems ?? []).map((p) => make('li', '', problemText(p))));
    void problemsCard.open('close');
  }

  // the focus goes back to Which? in the menu bar
  function closeProblems(): void {
    problemsCard.close(null);
    const which = document.querySelector<HTMLButtonElement>('.beeson-edit-header button.which');
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
    // a warning, e.g. an error of a save or of a draft, is shown with unsaved changes too
    if (app.dirty && app.note?.warn) parts.push(app.note.text);
    if (problems.length) parts.push(`${plural(problems.length, 'text')} cannot be edited`);
    const past = app.overflow - app.overFigure;
    if (past) parts.push(`${plural(past, 'text')} run${past === 1 ? 's' : ''} past the slide or into its footnote`);
    if (app.overFigure) parts.push(...coverSentences());
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
      app.saved = text;
      app.pairing = pair(app.source, app.slides(), mathLookup());
      app.state = 'loaded';
      app.dirty = false;
      if (!app.pairing.blocks.length) app.pairing.problems.push({ slide: null, tag: 'slides', reason: 'nothing on the page was found in the file' });
    } catch (error) {
      app.source = null;
      app.saved = null;
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

  // the edits since the last save are undone, so that the page reads as the saved file again. the
  // undo stops at the text last saved, since the history also holds the edits written by a save
  async function discardEdits(): Promise<void> {
    while (app.history.canUndo && !readsAsSaved()) await app.history.undo();
    app.history.clear();
    app.move.select(null);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.clearTimeout(autosaveTimer);
    app.drafts.drop();
    app.dirty = false;
    app.report();
  }

  // with unsaved changes, the user is asked first, as in PowerPoint: a save, a discard, or no open,
  // for which false is returned
  async function readyToOpen(): Promise<boolean> {
    app.note = null;
    if (!app.dirty) return true;
    const choice = await askFirst('open');
    if (!choice) return false;
    if (choice === 'save') {
      await save();
      return !app.dirty;
    }
    await discardEdits();
    return true;
  }

  // the handle last put on the list of Open Recent, which a save does not put there again
  let kept: FileSystemFileHandle | null = null;
  const keep = (handle: FileSystemFileHandle): void => {
    kept = handle;
    void remember(handle).catch(() => {});
  };

  // a file that is not the deck on the page is not kept for Open Recent, since it is offered on
  // the card of this page
  async function openHandle(handle: FileSystemFileHandle): Promise<void> {
    const text = await (await handle.getFile()).text();
    app.handle = handle;
    open(text);
    if (app.pairing?.blocks.length) keep(handle);
  }

  async function openFile(): Promise<void> {
    if (!(await readyToOpen())) return;
    if (canPick() && pickers.showOpenFilePicker) {
      let picked: FileSystemFileHandle[];
      try {
        picked = await pickers.showOpenFilePicker({ multiple: false });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        throw error;
      }
      await openHandle(picked[0]);
      return;
    }
    const file = await pickFile();
    if (!file) return;
    app.handle = null;
    open(await file.text());
  }

  // the browser asks once per session whether the page may edit a file kept from an earlier one,
  // at the click that opens it
  async function permitted(handle: FileSystemFileHandle): Promise<boolean> {
    type Asking = { queryPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>; requestPermission?(o: { mode: 'readwrite' }): Promise<PermissionState> };
    const h = handle as FileSystemFileHandle & Asking;
    const mode = { mode: 'readwrite' } as const;
    if (!h.queryPermission || (await h.queryPermission(mode)) === 'granted') return true;
    return (await h.requestPermission?.(mode)) === 'granted';
  }

  // a deck of Open Recent kept on another page is opened on its page, where the card offers its
  // file. a deck that is missing is taken off the list
  async function openRecent(r: Recent): Promise<void> {
    if (!(await readyToOpen())) return;
    if (r.page !== pageOf()) {
      location.assign(r.page + location.search);
      return;
    }
    if (!(await permitted(r.handle))) {
      app.note = { text: `The browser was not allowed to open ${r.name}`, warn: true };
      app.report();
      return;
    }
    try {
      await openHandle(r.handle);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
      await forget(r.handle);
      app.note = { text: `${r.name} was moved or deleted, and it was taken off Open Recent`, warn: true };
      app.report();
    }
  }

  // the slide shown is kept in the hash through a reload, which reveal.js does not keep up to date
  // while the deck is edited
  function keepSlide(): void {
    const d = app.deck();
    const current = app.current();
    if (!d || !current) return;
    const { h, v } = d.getIndices(current);
    history.replaceState(history.state, '', `${location.pathname}${location.search}${v ? `#/${h}/${v}` : h ? `#/${h}` : ''}`);
  }

  // the page is loaded again from the file, without the edits and their draft, hence the card of
  // the edits that were not saved is not offered after the reload
  async function revert(): Promise<void> {
    if (!app.dirty) return;
    if ((await revertCard.open('cancel')) !== 'revert') return;
    window.clearTimeout(autosaveTimer);
    app.drafts.drop();
    app.dirty = false;
    keepSlide();
    location.reload();
  }

  // the address of the deck with the parameters of this page but edit, and with extra
  function deckAddress(extra: string[] = []): string {
    const params = new URLSearchParams(location.search);
    params.delete('edit');
    for (const name of extra) params.set(name, '');
    // a parameter without a value, such as still, is kept without an equals sign
    const query = params.toString().replace(/=(?=&|$)/g, '');
    return `${pageOf()}${query ? `?${query}` : ''}`;
  }

  // with unsaved changes, the user is asked first, and false is returned for no export or show
  async function savedFirst(action: 'present' | 'export' | 'print' | 'pptx'): Promise<boolean> {
    if (!app.dirty) return true;
    const choice = await askFirst(action);
    if (!choice) return false;
    if (choice === 'save') await save();
    return choice === 'discard' || !app.dirty;
  }

  // the print view of the saved deck, with one page per step as npm run pdf prints it, opened in a
  // new tab and printed there once it is ready. a view that the page cannot read, e.g. on file:,
  // where each file is an origin of its own, is printed with the key of the browser
  async function exportPdf(action: 'export' | 'print' = 'export'): Promise<void> {
    if (!(await savedFirst(action))) return;
    const win = window.open(deckAddress(['print-pdf', 'still']), '_blank');
    const key = display('Mod+P', app.platform);
    const then = action === 'print' ? 'choose a printer' : 'choose Save as PDF';
    if (!win) {
      app.note = { text: `The browser did not open the print view. Allow this page to open a tab, and ${action} again`, warn: true };
      app.report();
      return;
    }
    app.note = { text: `The print view of ${fileName()} is open in a new tab, with one page per step. In its print dialog, ${then}`, warn: false };
    app.report();
    if (!(await printWhenReady(win))) {
      app.note = { text: `The print view of ${fileName()} is open in a new tab, with one page per step. Press ${key} there and ${then}`, warn: false };
      app.report();
    }
  }

  // the card of the command that writes the PowerPoint file from the saved deck, run in its folder
  async function exportPptx(): Promise<void> {
    if (!(await savedFirst('pptx'))) return;
    // the attached file is named as it is, and its folder is not known to the page. the folder of
    // the address is that of the deck only on file:, since a server maps an address to a folder
    const name = app.handle?.name ?? fileName();
    const where = location.protocol === 'file:' && name === fileName() ? `, i.e. ${folder()}` : '';
    pptxCommand.textContent = name === 'index.html' ? 'npm run pptx' : `npm run pptx -- ${name}`;
    pptxCard.text.textContent = `The PowerPoint file is written from the saved ${name} by this command, run in the folder of the deck${where}. It writes slides.pptx, with one click per step.`;
    const copy = pptxCard.buttons.get('copy');
    if (copy) copy.textContent = 'Copy Command';
    await pptxCard.open('copy');
  }

  // a copy of the deck with the edits, written into a file chosen with the picker or put into the
  // downloads, while the deck stays in its own file
  async function exportHtml(): Promise<void> {
    if (!app.source || !app.pairing) {
      app.note = { text: 'Choose the file of this deck first', warn: true };
      app.report();
      return;
    }
    const text = render();
    if (pickers.showSaveFilePicker) {
      let to: FileSystemFileHandle;
      try {
        to = await pickers.showSaveFilePicker({ suggestedName: fileName(), types: FILE_TYPES });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        throw error;
      }
      const also = await write(to, text);
      app.note = { text: `Exported a copy of the deck to ${to.name} at ${clock()}${also ? `. ${also}` : ''}`, warn: false };
    } else {
      const also = download(fileName(), text);
      app.note = { text: `A copy of the deck is in your downloads${also ? `. ${also}` : ''}`, warn: false };
    }
    app.report();
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
      const also = await write(app.handle, rendered.text);
      if (app.handle !== kept) keep(app.handle);
      text = (n ? `Saved ${edits} to ${app.handle.name} at ${clock()}` : `Saved ${app.handle.name} at ${clock()}`) + (also ? `. ${also}` : '');
    } else {
      const also = download(fileName(), rendered.text);
      text = `${n ? `Saved a copy with ${edits}` : `Saved a copy of ${fileName()}`}. ${REPLACE()}${also ? `. ${also}` : ''}`;
    }
    app.saved = rendered.text;
    // the typing after a save is a new entry of the history, hence a discard can stop at the save
    app.history.break();
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

  function readsAsSaved(): boolean {
    try {
      return app.saved !== null && render() === app.saved;
    } catch {
      return false;
    }
  }

  // a deck whose text is the file again, e.g. after its edits were undone, is clean
  function cleanIfSaved(): void {
    if (!app.source || !app.pairing || app.saved === null) return;
    try {
      if (render() !== app.saved) return;
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

  // the saved deck at hash, without the editor, played in place or, with tab, in a new tab. with
  // unsaved changes, the user is asked first. the show in place takes the full screen before the
  // save, while the click on the card still counts. null is returned when nothing is played
  async function present(hash = '', tab = false): Promise<{ win: Window | null } | null> {
    const choice = app.dirty ? await askFirst('present') : 'saved';
    if (!choice) return null;
    const show = tab ? null : startShow(app);
    if (choice === 'save') await save();
    if (choice === 'save' && app.dirty) {
      show?.end();
      return null;
    }
    // from-editor lets the show in a tab end at a click past its last step (src/main.ts)
    const url = `${deckAddress(show ? [] : ['from-editor'])}${hash}`;
    return { win: show ? show.load(url) : window.open(url, '_blank') };
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
    problemsShown: () => !problemsCard.el.hidden,
    askShown: () => !ask.el.hidden,
    cancelAsk: () => ask.close(null),
  };
  app.files = files;
  actions = { revert, openRecent, exportPdf, exportHtml, exportPptx };
  app.autosave = canWrite() && stored(AUTOSAVE_KEY) === '1';

  app.listen('report', () => {
    if (app.state !== 'waiting') {
      card.close(null);
      return;
    }
    const where = `${fileName()} in ${folder()}, i.e. the file that is open here`;
    const last = canPick() ? recentsOfPage()[0] ?? null : null;
    const when = last ? new Date(last.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
    const again = last ? ` Open ${last.name}, the file of this deck that you chose on ${when}, or choose it again.` : '';
    card.text.textContent = canWrite()
      ? `A browser writes only to a file that you have chosen. Choose ${where}, and your edits are saved into it.${again}`
      : `This browser does not write to a file by itself. Choose ${where}. A save is then a download of a copy with your edits. Set the browser to ask where to save each download, and you choose ${fileName()} in its folder and replace it.`;
    if (last !== cardRecent) {
      cardRecent = last;
      card.setButtons(last
        ? [
          { label: `Open ${last.name}`, title: `Open the file of this deck that you chose on ${when}`, value: 'recent', primary: true },
          { label: `Choose ${fileName()}…`, value: 'choose' },
        ]
        : [{ label: `Choose ${fileName()}…`, value: 'choose', primary: true }]);
      if (card.shown) card.buttons.get(last ? 'recent' : 'choose')?.focus({ preventScroll: true });
    }
    if (!card.shown) void card.open(last ? 'recent' : 'choose');
  });
  // the list is read after the start, and the card is updated with it
  void loadRecents().then(() => app.report()).catch(() => {});
  app.listen('history', () => {
    if (app.dirty) cleanIfSaved();
  });
  app.listen('dirty', scheduleAutosave);
  window.addEventListener('beforeunload', (ev) => { if (app.dirty) ev.preventDefault(); });
}

// whether the print view in win can be read by this page, once it is ready to print, after which
// it is printed. the view is ready as scripts/chrome.mjs waits for it before npm run pdf prints it:
// a page per step, the fonts, MathJax, and the backdrops loaded, and a frame of each video shown
async function printWhenReady(win: Window): Promise<boolean> {
  type View = Window & { Reveal?: { isReady(): boolean }; MathJax?: { startup?: { promise?: Promise<unknown> } }; Beeson?: { backdrops?: { ready: Promise<unknown> }[] } };
  const view = win as View;
  const until = Date.now() + 60000;
  let loaded = false;
  while (Date.now() < until) {
    await sleep(100);
    if (win.closed) return true;
    let d: Document;
    try {
      d = view.document;
      if (!d.URL.includes('print-pdf')) continue;
    } catch {
      return false;
    }
    // the global Reveal of the tab has isReady only once the deck is initialized
    if (typeof view.Reveal?.isReady !== 'function' || !view.Reveal.isReady() || !d.querySelector('.pdf-page') || d.querySelector('.reveal-viewport.loading-scroll-mode')) continue;
    if (!loaded) {
      loaded = true;
      await d.fonts.ready;
      await view.MathJax?.startup?.promise;
      await Promise.all((view.Beeson?.backdrops ?? []).map((b) => b.ready));
      d.querySelectorAll<HTMLVideoElement>('video[preload="none"]').forEach((video) => {
        video.preload = 'auto';
        video.load();
      });
    }
    const videos = [...d.querySelectorAll('video')].every((v) => v.readyState >= 2 || v.error || !v.getClientRects().length);
    const viewers = [...d.querySelectorAll('tycho-viewer')].every((v) => v.shadowRoot?.querySelector('.status.error'));
    if (!videos || !viewers || ![...d.images].every((i) => i.complete)) continue;
    await new Promise((done) => view.requestAnimationFrame(() => view.requestAnimationFrame(done)));
    win.focus();
    win.print();
    return true;
  }
  return false;
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
