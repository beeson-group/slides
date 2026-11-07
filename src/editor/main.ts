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
import type { TagEdit } from './tags.ts';

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

