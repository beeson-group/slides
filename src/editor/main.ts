// the entry point of editor.js, which beeson.js loads with the URL parameter edit. the text, the
// formulas, the speaker notes, the steps, and the places of the figures of the slides are edited
// on the page, and a save writes each edit into its place in the file of the deck, so that every
// other byte of the file stays as it was. the layout follows the normal view of PowerPoint: a
// toolbar with the file, its state, and the buttons, the list of the slides at the left, the
// slide, a notes pane under it, the steps at the right, and a status bar with the slide number.
//
// the file is written through the File System Access API where a browser has it, i.e. in Chrome
// and Edge, and elsewhere a copy with the edits is put into the downloads of the browser. the
// edits are also kept in the storage of the browser until they are saved, and offered again when
// the deck is opened after a crash or a closed tab

import { parseSource, type Source } from './source.ts';
import { pair, renderDeck, type Pairing } from './render.ts';
import { contentWithTex, mathLookup, mathReady, previewTex, retypeset, setContentWithTex } from './math.ts';
import { History } from './history.ts';
import { Nav } from './nav.ts';
import { Steps } from './steps.ts';
import { Move } from './move.ts';
import type { TagEdit } from './tags.ts';
import { CSS } from './styles.ts';

type PickerOptions = { types?: { description: string; accept: Record<string, string[]> }[]; multiple?: boolean; suggestedName?: string };
type Pickers = {
  showOpenFilePicker?: (options?: PickerOptions) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: PickerOptions) => Promise<FileSystemFileHandle>;
};
type Deck = {
  isReady(): boolean;
  configure(options: Record<string, unknown>): void;
  layout(): void;
  getScale(): number;
  getIndices(slide?: Element): { h: number; v: number };
  getCurrentSlide(): HTMLElement;
  getSlidePastCount(): number;
  getTotalSlides(): number;
  slide(h: number, v?: number): void;
  left(): void;
  right(): void;
  on(type: string, listener: () => void): void;
};
type Draft = { at: number; text: string };

const FILE_TYPES = [{ description: 'HTML', accept: { 'text/html': ['.html', '.htm'] } }];
const HOST = '[contenteditable="true"]';
// the keys in the storage of the browser: the unsaved edits of this deck, the autosave switch,
// and the height of the notes pane
const DRAFT_KEY = `beeson-draft:${location.href.split(/[?#]/)[0]}`;
const AUTOSAVE_KEY = 'beeson-autosave';
const PANE_KEY = 'beeson-pane';
// the pause after the last change, in ms, before the edits are kept in the storage and before an
// autosave
const DRAFT_DELAY = 1000;
const AUTOSAVE_DELAY = 1500;

const pickers = window as unknown as Pickers;
// the pickers are read when they are used, so that a test can take them away
const canPick = () => typeof pickers.showOpenFilePicker === 'function';
const canWrite = () => typeof pickers.showSaveFilePicker === 'function';

let source: Source | null = null;
let pairing: Pairing | null = null;
let handle: FileSystemFileHandle | null = null;
let dirty = false;
// starting, waiting for a file, loaded, or error
let state = 'starting';
let hosts: Element[] = [];
// the message of the last save or error, shown until the next edit
let note: { text: string; warn: boolean } | null = null;
// the step and the translation of each element changed since the last save, by its element
const tagEdits = new Map<Element, TagEdit>();
let autosave = false;
// a save in flight, and whether another one was asked for meanwhile
let saving = false;
let again = false;
let draftTimer = 0;
let autosaveTimer = 0;
// the texts of the current slide that run past its edge
let overflowing = 0;
let paneHeight = 200;

const slides = (): Element => document.querySelector('.reveal .slides') ?? document.body;
const deck = (): Deck | undefined => (window as unknown as { Reveal?: Deck }).Reveal;
const fileName = (): string => decodeURIComponent(location.pathname.split('/').pop() || '') || 'index.html';
const folder = (): string => decodeURIComponent(location.pathname).replace(/[^/]*$/, '');
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
const clock = (): string => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// the storage of the browser may be blocked or full
function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // nothing is kept
  }
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function button(text: string, title = '', label = ''): HTMLButtonElement {
  const el = make('button', '', text);
  el.title = title;
  if (label) el.setAttribute('aria-label', label);
  return el;
}

// the toolbar
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
whichButton.hidden = true;
undoButton.disabled = redoButton.disabled = true;
top.append(fileEl, stateEl, whichButton, undoButton, redoButton, openButton, saveButton, saveAsButton, autosaveButton, presentButton);

// the status bar
const bottom = make('div', 'beeson-edit-bottom');
const prevButton = button('‹', 'Previous slide', 'Previous slide');
const countEl = make('span', 'count');
const nextButton = button('›', 'Next slide', 'Next slide');
const hintEl = make('span', 'hint', 'Click a text or a formula to edit it, drag a figure or the ⠿ handle of a block to move it, press G to jump to a slide, and Esc to leave a text and select its block');
const notesButton = button('Notes', 'Show the speaker notes under the slide');
notesButton.setAttribute('aria-pressed', 'false');

const current = (): Element | null => deck()?.getCurrentSlide() ?? null;

// the slide of el is shown, e.g. for an undo of a change on another slide
function showSlide(el: Element): void {
  const d = deck();
  const section = el.closest('section');
  if (!d || !section || section === d.getCurrentSlide()) return;
  const { h, v } = d.getIndices(section);
  d.slide(h, v);
}

// the history of the changes, the list of the slides at the left, the steps of the current slide
// in a pane at the right, and the moving of its figures and blocks
const history = new History({
  snapshot: contentWithTex,
  restore: restoreHost,
  onChange: () => {
    undoButton.disabled = !history.canUndo;
    redoButton.disabled = !history.canRedo;
    if (dirty) cleanIfSaved();
  },
});
const relayout = () => {
  deck()?.layout();
  layout();
};
const nav = new Nav({ slides: () => [...slides().querySelectorAll(':scope > section')], current, go: showSlide, layout: relayout });
const steps = new Steps({ pairing: () => pairing, slide: current, edits: tagEdits, markDirty, layout: relayout, show: showSlide, record: (e) => history.push(e), tex: (el) => mathLookup()(el)?.tex ?? null });
const move = new Move({ pairing: () => pairing, slide: current, scale: () => deck()?.getScale() ?? 1, edits: tagEdits, markDirty, onChange: () => steps.refresh(), show: showSlide, record: (e) => history.push(e) });
bottom.append(prevButton, countEl, nextButton, hintEl, nav.button, steps.button, notesButton);

// the frames, the numbers, the list, and the overflow marks follow the slide after a change
function follow(): void {
  steps.refresh();
  move.refresh();
  nav.refresh();
}

// the pane under the slide, which the notes of the current slide are laid over, and the strip
// above it that changes its height
const pane = make('div', 'beeson-edit-pane', 'Notes');
const resizer = make('div', 'beeson-edit-resize');
resizer.title = 'Drag to change the height of the notes, or focus it and press the up and down arrows';
resizer.tabIndex = 0;
resizer.setAttribute('role', 'separator');
resizer.setAttribute('aria-orientation', 'horizontal');
resizer.setAttribute('aria-label', 'Height of the notes');
resizer.setAttribute('aria-valuemin', '120');
resizer.setAttribute('aria-valuemax', '600');

// the card shown until a file is chosen on file:, where the page cannot read itself
const card = make('div', 'beeson-edit-card');
const cardText = make('p');
const cardButton = button(`Choose ${fileName()}…`);
card.append(make('h3', '', 'Choose the file of this deck'), cardText, cardButton);
card.hidden = true;

// the card shown when edits that were not saved are found in the storage of the browser
const recover = make('div', 'beeson-edit-card recover');
const recoverText = make('p');
const restoreButton = button('Restore and save', 'Write the edits into the file and show the page again');
const copyButton = button('Download a copy', 'Put a copy of the file with the edits into your downloads');
const discardButton = button('Discard', 'Forget the edits');
const recoverRow = make('div', 'row');
recoverRow.append(restoreButton, copyButton, discardButton);
recover.append(make('h3', '', 'Edits that were not saved were found'), recoverText, recoverRow);
recover.hidden = true;

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

// the card that lists the texts that cannot be edited, opened with Which? after the state
const problemsCard = make('div', 'beeson-edit-card problems');
const problemsList = make('ul');
problemsList.style.cssText = 'margin: 0 0 16px; padding-left: 20px; max-height: 50vh; overflow-y: auto; color: var(--subtle, #bbb);';
const problemsClose = button('Close');
const problemsRow = make('div', 'row');
problemsRow.append(problemsClose);
problemsCard.append(make('h3', '', 'Texts that cannot be edited'), problemsList, problemsRow);
problemsCard.hidden = true;

const problemText = (p: Pairing['problems'][number]): string => `slide ${slideNumber(p.slide) ?? '?'}, ${p.tag}: ${p.reason}`;

function setState(text: string, warn = false, title = ''): void {
  stateEl.textContent = text;
  stateEl.title = title;
  stateEl.classList.toggle('warn', warn);
}

function slideNumber(slide: Element | null): number | null {
  if (!slide) return null;
  const d = deck();
  return d ? d.getIndices(slide).h + 1 : null;
}

function report(): void {
  fileEl.textContent = handle?.name ?? fileName();
  saveButton.classList.toggle('on', dirty);
  autosaveButton.classList.toggle('on', autosave);
  autosaveButton.setAttribute('aria-pressed', String(autosave));
  card.hidden = state !== 'waiting';
  whichButton.hidden = !pairing?.problems.length;
  if (state === 'waiting') {
    const where = `${fileName()} in ${folder()}, i.e. the file that is open here`;
    cardText.textContent = canWrite()
      ? `A browser writes only to a file that you have chosen. Choose ${where}, and your edits are saved into it.`
      : `A browser does not write to a file by itself. Choose ${where}. A save then puts a copy with your edits into your downloads, and you replace the file with it.`;
    setState('Choose the file of this deck to start editing');
    return;
  }
  if (!pairing) {
    setState(note?.text ?? 'Loading', note?.warn ?? false);
    return;
  }
  if (!pairing.blocks.length) {
    setState('This file is not the deck on the page', true);
    return;
  }
  const problems = pairing.problems;
  const list = problems.map(problemText).join('\n');
  const parts = [dirty ? 'Unsaved changes' : note?.text ?? 'No unsaved changes'];
  if (problems.length) parts.push(`${plural(problems.length, 'text')} cannot be edited`);
  if (overflowing) parts.push(`${plural(overflowing, 'text')} run${overflowing === 1 ? 's' : ''} past the slide or into its footnote`);
  if (autosave && !handle && canWrite()) parts.push('autosave starts after the first save');
  setState(parts.join('. '), (note?.warn ?? false) || problems.length > 0 || overflowing > 0, list);
}

// an error of a button or a key, shown in the state until the next edit
function fail(e: unknown): void {
  note = { text: e instanceof Error ? e.message : String(e), warn: true };
  report();
}

function count(): void {
  const d = deck();
  if (d) countEl.textContent = `Slide ${d.getSlidePastCount() + 1} of ${d.getTotalSlides()}`;
}

// the scale of the slide, the room under it, and the overhang of the stage beyond it on each side,
// for the notes pane in styles.ts
function layout(): void {
  const d = deck();
  if (!d) return;
  const scale = d.getScale();
  const reveal = document.querySelector('.reveal')?.getBoundingClientRect();
  const box = slides().getBoundingClientRect();
  const gap = reveal ? Math.max(0, reveal.bottom - box.bottom) / scale : 0;
  document.documentElement.style.setProperty('--beeson-scale', String(scale));
  document.documentElement.style.setProperty('--beeson-gap', `${gap}px`);
  const side = reveal ? Math.max(0, (reveal.width - box.width) / 2) / scale : 0;
  document.documentElement.style.setProperty('--beeson-side', `${side}px`);
}

function setPane(height: number): void {
  paneHeight = Math.max(120, Math.min(600, Math.round(height)));
  document.documentElement.style.setProperty('--beeson-pane', `${paneHeight}px`);
  resizer.setAttribute('aria-valuenow', String(paneHeight));
  relayout();
  follow();
}

// each formula is one unit that the caret skips, reached with Tab and opened with Enter
function markMath(root: Element): void {
  for (const c of root.querySelectorAll('mjx-container')) {
    c.setAttribute('contenteditable', 'false');
    if (!hostOf(c)) continue;
    c.setAttribute('tabindex', '0');
    c.setAttribute('role', 'button');
    c.setAttribute('aria-label', 'Formula, Enter opens its TeX');
  }
}

// marks the blocks of the pairing editable, and the formulas in them as one unit each. a block
// that stays a block is left alone, so that a save does not take the focus
function attach(): void {
  const next = pairing ? pairing.blocks.map((b) => b.live) : [];
  for (const h of hosts) if (!next.includes(h)) h.removeAttribute('contenteditable');
  for (const h of next) if (h.getAttribute('contenteditable') !== 'true') h.setAttribute('contenteditable', 'true');
  hosts = next;
  for (const h of next) if (h.matches('aside.notes')) h.setAttribute('aria-label', 'Speaker notes');
  move.mark(pairing);
  markMath(slides());
  document.documentElement.classList.toggle('beeson-editing', hosts.length > 0);
  ensureNotes();
}

function status() {
  return {
    state,
    // true where the file is written in place, false where a save is a download
    supported: canWrite(),
    dirty,
    file: handle?.name ?? null,
    blocks: pairing?.blocks.length ?? 0,
    sections: pairing?.sections.length ?? 0,
    // the elements whose step or place was changed since the last save
    tags: tagEdits.size,
    problems: (pairing?.problems ?? []).map((p) => ({ slide: slideNumber(p.slide), tag: p.tag, reason: p.reason })),
    message: stateEl.textContent ?? '',
    undo: history.canUndo,
    redo: history.canRedo,
    autosave,
    overflow: overflowing,
    draft: readDraft() !== null,
    recover: !recover.hidden,
    pane: paneHeight,
  };
}

// pairs the text of the file with the page and makes the paired blocks editable. the state
// reports the blocks that could not be paired. a fresh file starts the history anew and is
// checked against the edits kept in the storage, and the text of a save is paired again in place
function open(text: string, fresh = true): ReturnType<typeof status> {
  tagEdits.clear();
  if (fresh) {
    history.clear();
    move.select(null);
  }
  try {
    source = parseSource(text);
    pairing = pair(source, slides(), mathLookup());
    state = 'loaded';
    dirty = false;
    if (!pairing.blocks.length) pairing.problems.push({ slide: null, tag: 'slides', reason: 'nothing on the page was found in the file' });
  } catch (error) {
    source = null;
    pairing = null;
    state = 'error';
    note = { text: error instanceof Error ? error.message : String(error), warn: true };
  }
  attach();
  report();
  follow();
  if (fresh) offerDraft();
  return status();
}

// the text of the file with the edits of the page, without writing it
function render(): string {
  if (!source || !pairing) throw new Error('no file is open');
  return renderDeck(source, pairing, mathLookup(), tagEdits).text;
}

// a file chosen with the input element, in a browser without the open picker
function pickFile(): Promise<File | null> {
  return new Promise((done) => {
    const input = make('input');
    input.type = 'file';
    input.accept = '.html,.htm,text/html';
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

// the edits since the last save are undone, so that the page reads as the saved file again
async function discardEdits(): Promise<void> {
  while (history.canUndo) await history.undo();
  history.clear();
  move.select(null);
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  window.clearTimeout(autosaveTimer);
  dropDraft();
  dirty = false;
  report();
}

// with unsaved changes, the user is asked first, as in PowerPoint: a save, a discard, or no open
async function openFile(): Promise<void> {
  note = null;
  if (dirty) {
    const choice = await askFirst('open');
    if (!choice) return;
    if (choice === 'save') {
      await save();
      if (dirty) return;
    } else await discardEdits();
  }
  if (canPick() && pickers.showOpenFilePicker) {
    let picked: FileSystemFileHandle[];
    try {
      picked = await pickers.showOpenFilePicker({ types: FILE_TYPES, multiple: false });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      throw error;
    }
    const text = await (await picked[0].getFile()).text();
    handle = picked[0];
    open(text);
    return;
  }
  const file = await pickFile();
  if (!file) return;
  handle = null;
  open(await file.text());
}

// a copy of the file for a browser that cannot write it in place
function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/html' }));
  const a = make('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function write(to: FileSystemFileHandle, text: string): Promise<void> {
  const writable = await to.createWritable();
  await writable.write(text);
  await writable.close();
}

// the file is asked for with the save picker, and false is returned when the picker is dismissed
async function pickTarget(): Promise<boolean> {
  if (!pickers.showSaveFilePicker) return false;
  try {
    handle = await pickers.showSaveFilePicker({ suggestedName: handle?.name ?? fileName(), types: FILE_TYPES });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return false;
    throw error;
  }
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
    if (dirty) await save();
  }
}

async function doSave(): Promise<void> {
  if (!source || !pairing) {
    note = { text: 'Choose the file of this deck first', warn: true };
    report();
    return;
  }
  const rendered = renderDeck(source, pairing, mathLookup(), tagEdits);
  if (!handle && canWrite() && !(await pickTarget())) return;
  const n = rendered.edits.length;
  const edits = plural(n, 'edit');
  let text: string;
  if (handle) {
    await write(handle, rendered.text);
    text = n ? `Saved ${edits} to ${handle.name} at ${clock()}` : `Saved ${handle.name} at ${clock()}`;
  } else {
    download(fileName(), rendered.text);
    text = n ? `Saved a copy with ${edits} to your downloads. Replace ${fileName()} with it to keep them` : `Saved a copy of ${fileName()} to your downloads`;
  }
  const warnings = rendered.warnings.length ? `, ${rendered.warnings.join(', ')}` : '';
  note = { text: `${text}${warnings}`, warn: rendered.warnings.length > 0 };
  // an edit made while the file was written is kept for the next save, since the page no longer
  // reads as the saved text
  if (render() === rendered.text) {
    open(rendered.text, false);
    dropDraft();
  } else {
    report();
    scheduleAutosave();
  }
}

// the deck is written into a file chosen with the picker, and where there is no picker a save is
// a download anyway
async function saveAs(): Promise<void> {
  if (!source || !pairing) {
    note = { text: 'Choose the file of this deck first', warn: true };
    report();
    return;
  }
  if (canWrite() && !(await pickTarget())) return;
  await save();
}

// every change passes here: the state is shown, the edits are kept in the storage after a pause,
// and an autosave is started
function markDirty(): void {
  if (!dirty) {
    dirty = true;
    note = null;
    report();
  }
  window.clearTimeout(draftTimer);
  draftTimer = window.setTimeout(keepDraft, DRAFT_DELAY);
  scheduleAutosave();
}

// a deck whose text is the file again, e.g. after its edits were undone, is clean
function cleanIfSaved(): void {
  if (!source || !pairing) return;
  try {
    if (render() !== source.text) return;
  } catch {
    return;
  }
  dirty = false;
  window.clearTimeout(autosaveTimer);
  dropDraft();
  report();
}

function keepDraft(): void {
  if (!dirty || !source || !pairing) return;
  const draft: Draft = { at: Date.now(), text: render() };
  store(DRAFT_KEY, JSON.stringify(draft));
}

function dropDraft(): void {
  window.clearTimeout(draftTimer);
  store(DRAFT_KEY, null);
}

function readDraft(): Draft | null {
  const raw = stored(DRAFT_KEY);
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as Partial<Draft>;
    return typeof draft.text === 'string' && typeof draft.at === 'number' ? { at: draft.at, text: draft.text } : null;
  } catch {
    return null;
  }
}

// a draft that differs from the file that was opened is offered on the card
function offerDraft(): void {
  const draft = readDraft();
  if (!draft || !source || draft.text === source.text) {
    if (draft) dropDraft();
    recover.hidden = true;
    return;
  }
  const when = new Date(draft.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  recoverText.textContent = `Edits of ${fileName()} from ${when} were kept in this browser and not saved. Restore writes the file with them and shows it again, a copy goes to your downloads, and Discard forgets them.`;
  copyButton.hidden = false;
  recover.hidden = false;
}

async function restoreDraft(): Promise<void> {
  const draft = readDraft();
  if (!draft) {
    recover.hidden = true;
    return;
  }
  if (!handle && canWrite() && !(await pickTarget())) return;
  if (handle) {
    await write(handle, draft.text);
    dropDraft();
    location.reload();
    return;
  }
  copyDraft();
}

function copyDraft(): void {
  const draft = readDraft();
  if (draft) download(fileName(), draft.text);
  dropDraft();
  recover.hidden = true;
  note = { text: `A copy of ${fileName()} with the edits is in your downloads. Replace the file with it and open it again`, warn: false };
  report();
}

function discardDraft(): void {
  dropDraft();
  recover.hidden = true;
  report();
}

function scheduleAutosave(): void {
  window.clearTimeout(autosaveTimer);
  if (!autosave || !handle) return;
  autosaveTimer = window.setTimeout(() => {
    if (dirty && !saving) void save().catch(fail);
  }, AUTOSAVE_DELAY);
}

// the switch is kept in the storage, as the AutoSave switch of PowerPoint
function toggleAutosave(): void {
  autosave = !autosave;
  store(AUTOSAVE_KEY, autosave ? '1' : '0');
  if (dirty) scheduleAutosave();
  report();
}

// the saved deck in a new tab, without the editor. with unsaved changes, the user is asked first
async function present(): Promise<void> {
  if (dirty) {
    const choice = await askFirst('present');
    if (!choice) return;
    if (choice === 'save') {
      await save();
      if (dirty) return;
    }
  }
  const params = new URLSearchParams(location.search);
  params.delete('edit');
  // a parameter without a value, such as still, is kept without an equals sign
  const query = params.toString().replace(/=(?=&|$)/g, '');
  window.open(`${location.href.split(/[?#]/)[0]}${query ? `?${query}` : ''}${location.hash}`, '_blank');
}

// the notes of the current slide are laid over the pane under the slide while the Notes button is
// on
function toggleNotes(): void {
  const on = document.documentElement.classList.toggle('beeson-notes');
  notesButton.classList.toggle('on', on);
  notesButton.setAttribute('aria-pressed', String(on));
  relayout();
  follow();
  if (on) ensureNotes()?.focus({ preventScroll: true });
}

// while the notes are shown, a slide without notes gets an empty aside to type into. an aside
// without text is not written into the file, hence it does not make the deck dirty
function ensureNotes(): HTMLElement | null {
  const slide = current();
  if (!slide || !pairing?.blocks.length || !document.documentElement.classList.contains('beeson-notes')) return null;
  let aside = slide.querySelector<HTMLElement>(':scope > aside.notes');
  if (!aside) {
    aside = make('aside', 'notes');
    aside.setAttribute('contenteditable', 'true');
    aside.setAttribute('aria-label', 'Speaker notes');
    slide.append(aside);
  }
  return aside;
}

// the TeX of a formula is edited in a field under it, and the host is typeset again on Apply
let popover: HTMLElement | null = null;
// the formula that the field is open for, which gets the focus back when the field is closed
let popoverFor: Element | null = null;

function closeMath(back = true): void {
  popover?.remove();
  popover = null;
  const el = popoverFor;
  popoverFor = null;
  if (back && el?.isConnected) (el as HTMLElement).focus({ preventScroll: true });
}

// a TeX with an error is refused before the slide is touched, and the error is thrown to the
// field, where it is shown under the TeX. the change is one entry of the history
async function setMath(container: Element, tex: string): Promise<void> {
  const host = container.closest(HOST);
  if (!host) throw new Error('the formula is not in an editable block');
  const info = mathLookup()(container);
  const { error } = await previewTex(tex, info?.display ?? false);
  if (error) throw new Error(error);
  const before = contentWithTex(host);
  if (!(await retypeset(host, container, tex))) throw new Error('MathJax does not find the formula with this TeX, and the slide is kept as it was');
  markMath(host);
  const after = contentWithTex(host);
  if (after !== before) history.push({ label: 'formula', undo: () => restoreHost(host, before), redo: () => restoreHost(host, after) });
  markDirty();
}

function openMath(container: Element): void {
  const info = mathLookup()(container);
  if (!info) return;
  closeMath();
  const box = make('div', 'beeson-math');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'The TeX of the formula');
  popoverFor = container;
  // the formula is typeset into a new container on Apply, found again by its place in the block
  const host = container.closest(HOST);
  const at = host ? [...host.querySelectorAll('mjx-container')].indexOf(container) : -1;
  const field = make('textarea');
  field.setAttribute('aria-label', 'TeX of the formula');
  field.value = info.tex;
  field.rows = Math.min(12, Math.max(3, info.tex.split('\n').length + 1));
  const row = make('div', 'row');
  const apply = make('button', '', 'Apply');
  const cancel = make('button', '', 'Cancel');
  const hint = make('span', 'hint', `${info.open} … ${info.close}, ⌘ or Ctrl+Enter applies, Esc cancels`);
  const preview = make('div', 'preview');
  const error = make('div', 'error');
  error.setAttribute('role', 'alert');
  row.append(apply, cancel, hint);
  box.append(field, preview, row, error);
  const rect = container.getBoundingClientRect();
  box.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - 656))}px`;
  box.style.top = `${Math.max(52, Math.min(rect.bottom + 8, window.innerHeight - 420))}px`;
  // the TeX is typeset under the field as it is typed, and Apply is off while it has an error.
  // a late result of an earlier TeX is dropped
  let shown = 0;
  let timer = 0;
  const show = async () => {
    const seq = ++shown;
    const result = await previewTex(field.value, info.display).catch((e: unknown) => ({ node: null, error: e instanceof Error ? e.message : String(e) }));
    if (seq !== shown) return;
    preview.replaceChildren(...(result.node ? [result.node] : []));
    error.textContent = result.error ?? '';
    apply.disabled = !!result.error;
  };
  void show();
  field.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(show, 150);
  });
  apply.addEventListener('click', async () => {
    try {
      await setMath(container, field.value);
      popoverFor = host?.querySelectorAll('mjx-container')[at] ?? null;
      closeMath();
    } catch (e) {
      error.textContent = e instanceof Error ? e.message : String(e);
    }
  });
  cancel.addEventListener('click', () => closeMath());
  field.addEventListener('keydown', (ev) => {
    if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
      ev.preventDefault();
      apply.click();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      closeMath();
    }
  });
  // Tab and Shift+Tab cycle between the field and the buttons, as in a modal dialog
  box.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Tab') return;
    ev.preventDefault();
    const stops = [field, apply, cancel].filter((el) => !el.disabled);
    const at = stops.indexOf(document.activeElement as HTMLTextAreaElement);
    stops[(at + (ev.shiftKey ? -1 : 1) + stops.length) % stops.length].focus();
  });
  document.body.append(box);
  popover = box;
  field.focus();
  field.select();
}

// a block is put back to a content of the history, on its slide, with the caret at the end of the
// text that changed
async function restoreHost(host: Element, content: string): Promise<void> {
  showSlide(host);
  if (host.matches('aside.notes') && !document.documentElement.classList.contains('beeson-notes')) toggleNotes();
  const before = host.textContent ?? '';
  await setContentWithTex(host, content);
  markMath(host);
  history.track(host);
  markDirty();
  placeCaret(host, changeEnd(before, host.textContent ?? ''));
  follow();
}

// the end of the part of after that differs from before, as an offset into after, i.e. the first
// character that differs after an undo of typing. null when the texts are the same
function changeEnd(before: string, after: string): number | null {
  if (before === after) return null;
  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) head++;
  let tail = 0;
  while (tail < before.length - head && tail < after.length - head && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
  return after.length - tail;
}

// the caret is put at the offset into the text of host, or at its end. an offset inside a formula
// puts it after the formula
function placeCaret(host: Element, offset: number | null = null): void {
  if (!(host instanceof HTMLElement)) return;
  host.focus({ preventScroll: true });
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(host);
  range.collapse(false);
  if (offset !== null) {
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    let left = offset;
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      if (left <= node.length) {
        const math = node.parentElement?.closest('mjx-container');
        if (math && host.contains(math)) range.setStartAfter(math);
        else range.setStart(node, left);
        range.collapse(true);
        break;
      }
      left -= node.length;
    }
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

// Cmd+B and Cmd+I wrap the selection in strong and em, as the deck is written, or take it out of
// them when all of its text is inside. the command of the browser would write b and i, and it
// nests a b inside a strong of the theme, whose weight of 500 it does not take for bold
function toggleFormat(host: Element, tag: 'strong' | 'em'): void {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (range.collapsed || !host.contains(range.commonAncestorContainer)) return;
  const alias = tag === 'strong' ? 'b' : 'i';
  const same = (el: Element) => el.localName === tag || el.localName === alias;
  const formatOf = (node: Node): Element | null => {
    for (let el = node instanceof Element ? node : node.parentElement; el && el !== host; el = el.parentElement) if (same(el)) return el;
    return null;
  };
  const unwrap = (root: ParentNode) => {
    for (const el of [...root.querySelectorAll(`${tag}, ${alias}`)]) el.replaceWith(...el.childNodes);
  };
  const common = range.commonAncestorContainer;
  const texts: Text[] = [];
  if (common instanceof Text) texts.push(common);
  else {
    const walker = document.createTreeWalker(common, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      const empty = (node === range.startContainer && range.startOffset === node.length) || (node === range.endContainer && range.endOffset === 0);
      if (range.intersectsNode(node) && !empty && node.data.trim()) texts.push(node);
    }
  }
  const off = texts.length > 0 && texts.every((node) => formatOf(node));
  const outer = off ? formatOf(common) : null;
  let nodes: Node[];
  if (outer) {
    // the element around the whole selection is split into the part before it, the selection
    // without the element, and the part after it, so that the formats inside it are kept
    const start: [Node, number] = [range.startContainer, range.startOffset];
    const tail = document.createRange();
    tail.setStart(range.endContainer, range.endOffset);
    tail.setEnd(outer, outer.childNodes.length);
    const after = outer.cloneNode(false) as Element;
    after.append(tail.extractContents());
    const head = document.createRange();
    head.setStart(outer, 0);
    head.setEnd(...start);
    const before = outer.cloneNode(false) as Element;
    before.append(head.extractContents());
    unwrap(outer);
    nodes = [...outer.childNodes];
    outer.before(before);
    outer.after(after);
    outer.replaceWith(...nodes);
  } else {
    const fragment = range.extractContents();
    unwrap(fragment);
    if (off) {
      nodes = [...fragment.childNodes];
      range.insertNode(fragment);
    } else {
      const el = document.createElement(tag);
      el.append(fragment);
      range.insertNode(el);
      nodes = [el];
    }
  }
  for (const el of [...host.querySelectorAll('strong, em, b, i')]) {
    if (!el.textContent && !el.querySelector('br, img, mjx-container')) el.remove();
  }
  if (nodes.length) {
    const selected = document.createRange();
    selected.setStartBefore(nodes[0]);
    selected.setEndAfter(nodes[nodes.length - 1]);
    selection.removeAllRanges();
    selection.addRange(selected);
  }
  host.normalize();
}

const hostOf = (target: EventTarget | null): Element | null => {
  const host = target instanceof Element ? target.closest(HOST) : null;
  return host && slides().contains(host) ? host : null;
};

// a line in a block is a br, or a newline in a pre, and a paste is plain text, so that the text
// of a slide stays what the file can hold
function insertPlain(host: Element, text: string): void {
  if (host.closest('pre')) {
    document.execCommand('insertText', false, text);
    return;
  }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line) document.execCommand('insertText', false, line);
    if (i < lines.length - 1) document.execCommand('insertLineBreak');
  });
}

// the undo of the browser, e.g. from its Edit menu, is taken by the history
function onBeforeInput(ev: InputEvent): void {
  const host = hostOf(ev.target);
  if (!host) return;
  const type = ev.inputType;
  if (type === 'historyUndo' || type === 'historyRedo') {
    ev.preventDefault();
    void (type === 'historyUndo' ? history.undo() : history.redo()).catch(fail);
    return;
  }
  // bold and italic are an entry of the history each
  if (type === 'formatBold' || type === 'formatItalic') {
    ev.preventDefault();
    history.break();
    history.beforeTyping(host);
    toggleFormat(host, type === 'formatBold' ? 'strong' : 'em');
    history.afterTyping(host);
    history.break();
    markDirty();
    follow();
    return;
  }
  // a new line starts a new entry of the history, as in a text editor
  if (type === 'insertParagraph' || type === 'insertLineBreak') history.break();
  history.beforeTyping(host);
  if (type === 'insertParagraph' || type === 'insertLineBreak') {
    ev.preventDefault();
    insertPlain(host, '\n');
  } else if (type === 'insertFromPaste') {
    ev.preventDefault();
    insertPlain(host, ev.dataTransfer?.getData('text/plain') ?? '');
  } else if (type === 'insertFromDrop' || type.startsWith('format') || type.startsWith('insertOrdered') || type.startsWith('insertUnordered') || type === 'insertHorizontalRule' || type === 'insertLink') {
    ev.preventDefault();
  }
}

// before the listeners of reveal.js: ⌘S or Ctrl+S saves, with Shift into another file, ⌘Z and
// ⌘⇧Z or Ctrl+Z and Ctrl+Y move in the history, Enter on a formula opens its TeX, and Esc leaves
// the text that is being edited, so that the arrow keys move between the slides again
function onKeyDown(ev: KeyboardEvent): void {
  const mod = ev.metaKey || ev.ctrlKey;
  const key = ev.key.toLowerCase();
  const target = ev.target instanceof Element ? ev.target : null;
  const inField = !!target?.closest('.beeson-math, input, textarea, select');
  const active = document.activeElement;
  if (mod && !ev.altKey && key === 's') {
    ev.preventDefault();
    void (ev.shiftKey ? saveAs() : save()).catch(fail);
  } else if (mod && !ev.altKey && !inField && (key === 'z' || (key === 'y' && !ev.shiftKey))) {
    ev.preventDefault();
    ev.stopPropagation();
    void (key === 'y' || ev.shiftKey ? history.redo() : history.undo()).catch(fail);
  } else if ((ev.key === 'Enter' || ev.key === ' ') && !popover && active instanceof Element && active.matches('mjx-container') && hostOf(active)) {
    ev.preventDefault();
    ev.stopPropagation();
    openMath(active);
  } else if (ev.key === 'Escape' && !ask.hidden) {
    answer(null);
    ev.stopPropagation();
  } else if (ev.key === 'Escape') {
    const host = hostOf(active);
    if (popover) {
      closeMath();
      ev.stopPropagation();
    }
  }
}

function onClick(ev: MouseEvent): void {
  const target = ev.target instanceof Element ? ev.target : null;
  const container = target?.closest('mjx-container');
  if (container && hostOf(container)) {
    ev.preventDefault();
    openMath(container);
  } else if (popover && target && !popover.contains(target)) closeMath(false);
}


const revealReady = (): Promise<void> =>
  new Promise((done) => {
    const tick = () => (deck()?.isReady() ? done() : setTimeout(tick, 50));
    tick();
  });

// the text is fetched when the deck is served, and with file: it is chosen with the card
async function fetchSource(): Promise<boolean> {
  if (location.protocol === 'file:') return false;
  try {
    const response = await fetch(location.href.split(/[?#]/)[0], { cache: 'no-store' });
    if (!response.ok) return false;
    open(await response.text());
    return true;
  } catch {
    return false;
  }
}

async function init(): Promise<void> {
  const style = make('style');
  style.id = 'beeson-editor';
  style.textContent = CSS;
  document.head.append(style);
  document.body.append(top, bottom, pane, resizer, nav.pane, steps.pane, steps.badges, move.frame, move.selectedFrame, move.handle, move.guideV, move.guideH, move.offset, card, recover, ask, problemsCard);
  document.documentElement.classList.add('beeson-editor');
  autosave = canWrite() && stored(AUTOSAVE_KEY) === '1';
  if (!canWrite()) {
    autosaveButton.disabled = true;
    autosaveButton.title = 'Autosave needs a browser that writes the file in place, i.e. Chrome or Edge';
  }
  setPane(Number(stored(PANE_KEY)) || 200);
  // a pointer click leaves the focus on the slide, and Enter or Space on a focused button keeps it
  const wire = (el: HTMLButtonElement, action: () => unknown) => el.addEventListener('click', (ev) => {
    if (ev.detail > 0) el.blur();
    Promise.resolve().then(action).catch(fail);
  });
  wire(openButton, openFile);
  wire(cardButton, openFile);
  wire(saveButton, save);
  wire(saveAsButton, saveAs);
  wire(autosaveButton, toggleAutosave);
  wire(presentButton, present);
  wire(undoButton, () => history.undo());
  wire(redoButton, () => history.redo());
  wire(prevButton, () => deck()?.left());
  wire(nextButton, () => deck()?.right());
  wire(notesButton, toggleNotes);
  wire(restoreButton, restoreDraft);
  wire(copyButton, copyDraft);
  wire(discardButton, discardDraft);
  wire(askSave, () => answer('save'));
  wire(askDiscard, () => answer('discard'));
  wire(askCancel, () => answer(null));
  resizer.addEventListener('keydown', (ev) => {
    const step = ev.key === 'ArrowUp' ? 20 : ev.key === 'ArrowDown' ? -20 : 0;
    if (!step) return;
    ev.preventDefault();
    ev.stopPropagation();
    setPane(paneHeight + step);
    store(PANE_KEY, String(paneHeight));
  });
  resizer.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    const startY = ev.clientY;
    const startHeight = paneHeight;
    const onMove = (e: PointerEvent) => setPane(startHeight + startY - e.clientY);
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      store(PANE_KEY, String(paneHeight));
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });
  document.addEventListener('beforeinput', onBeforeInput);
  document.addEventListener('input', (ev) => {
    const host = hostOf(ev.target);
    if (!host) return;
    history.afterTyping(host);
    markDirty();
    follow();
  });
  document.addEventListener('focusin', (ev) => {
    const host = hostOf(ev.target);
    if (host) history.track(host);
    follow();
  });
  document.addEventListener('focusout', () => setTimeout(follow, 0));
  window.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('click', onClick);
  window.addEventListener('beforeunload', (ev) => { if (dirty) ev.preventDefault(); });
  report();
  await revealReady();
  const d = deck();
  if (d) {
    // the slides change without a transition and with every step shown, as in the editing view
    // of PowerPoint, and the keys of reveal.js for the overview (Esc, O), the black and the white
    // screen (B, V, the period), fullscreen (F), the help (the question mark), and the speaker view
    // (S) are off. the viewport of reveal.js is laid out again between the bars
    d.configure({ transition: 'none', backgroundTransition: 'none', fragments: false, keyboard: { 27: null, 79: null, 66: null, 86: null, 190: null, 70: null, 191: null, 83: null } });
    d.layout();
    d.on('slidechanged', () => { count(); closeMath(false); move.select(null); ensureNotes(); follow(); });
    d.on('resize', () => { layout(); follow(); });
    count();
    layout();
  }
  await mathReady();
  if (!(await fetchSource())) {
    state = 'waiting';
    report();
  }
}

const BeesonEditor = {
  ready: init(),
  open,
  render,
  status,
  save,
  saveAs,
  setMath,
  undo: () => history.undo(),
  redo: () => history.redo(),
  toggleAutosave,
  restoreDraft,
  setPane,
  // the file written by save, for a test with a handle of the origin private file system
  attach: (h: FileSystemFileHandle) => { handle = h; },
  version: __VERSION__,
};

declare global {
  interface Window {
    BeesonEditor: typeof BeesonEditor;
  }
}

window.BeesonEditor = BeesonEditor;
