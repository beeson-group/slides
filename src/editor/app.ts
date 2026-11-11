// the shared state of the editor, which main.ts creates once and passes to the install function of
// each module. it holds the file and its pairing with the page, the pending tag edits, the one
// history, and the registry of commands. a module reaches another one through the services below,
// which each module sets at its install. app.invalidate() batches the refresh of the modules after
// an event, and app.region() names the part of the window that has the focus

import type { Source } from './source.ts';
import type { Pairing } from './render.ts';
import type { TagEdit } from './tags.ts';
import { History, type Entry } from './history.ts';
import { contentWithTex } from './math.ts';
import { Commands } from './commands.ts';
import type { Selection } from './selection.ts';
import type { Doc } from './model/doc.ts';

// the part of reveal.js that the editor uses
export type Deck = {
  isReady(): boolean;
  configure(options: Record<string, unknown>): void;
  layout(): void;
  sync?(): void;
  getScale(): number;
  getIndices(slide?: Element): { h: number; v?: number };
  getCurrentSlide(): HTMLElement;
  getSlidePastCount(): number;
  getTotalSlides(): number;
  slide(h: number, v?: number): void;
  left(): void;
  right(): void;
  on(type: string, listener: () => void): void;
};

// what a refresh is for: a text typed, the selection, the current slide, the slides or elements
// added, removed, or moved, and the size of the window or of a pane
export type Flag = 'content' | 'selection' | 'slide' | 'structure' | 'layout';
export const ALL: Flag[] = ['content', 'selection', 'slide', 'structure', 'layout'];

// the part of the window with the focus, which decides where a key is taken
export type Region = 'canvas' | 'text' | 'field' | 'navigator' | 'notes' | 'inspector' | 'dialog';

// the platform of the keys: the command modifier is ⌘ on a Mac and Ctrl elsewhere
export type Platform = 'mac' | 'other';

// starting, waiting for a file, loaded, or error
export type State = 'starting' | 'waiting' | 'loaded' | 'error';

// the state shown in the toolbar, and its list of the texts that cannot be edited as its title
export type Line = { text: string; warn: boolean; title: string };

export type Event = 'report' | 'history' | 'dirty' | 'slide' | 'resize';

// a block of text paired with the file is editable in place
export const HOST = '[contenteditable="true"]';

// the services of the modules, each set by the module named in its comment
export interface Files {
  // file/files.ts: the file, its saves, and the state line
  open(text: string, fresh?: boolean): void;
  render(): string;
  save(): Promise<void>;
  saveAs(): Promise<void>;
  openFile(): Promise<void>;
  // the show at hash, in place or in a new tab, with its window, or null when it is not played
  present(hash?: string, tab?: boolean): Promise<{ win: Window | null } | null>;
  toggleAutosave(): void;
  line(): Line;
  // the card of the texts that cannot be edited, and the card that asks before Open or Present
  showProblems(): void;
  closeProblems(): void;
  problemsShown(): boolean;
  askShown(): boolean;
  cancelAsk(): void;
}

export interface Drafts {
  // file/drafts.ts: the unsaved edits kept in the storage of the browser
  keepSoon(): void;
  drop(): void;
  hasDraft(): boolean;
  offer(): void;
  offered(): boolean;
  restore(): Promise<void>;
}

export interface Notes {
  // notes.ts: the notes pane under the slide, and its button in the status bar
  readonly button: HTMLButtonElement;
  shown(): boolean;
  toggle(): void;
  ensure(): HTMLElement | null;
  setPane(height: number): void;
  height(): number;
}

export interface MathPop {
  // text/mathpop.ts: the TeX field of a formula
  isOpen(): boolean;
  // into is the entry of the insert of a new formula, which its TeX is written into
  open(container: Element, into?: Entry): void;
  close(back?: boolean): void;
  setMath(container: Element, tex: string): Promise<void>;
  // holds the keys typed until the next open, which types them into its field, and returns the
  // release of the hold for a command that opens nothing
  hold(): () => void;
}

export interface Typing {
  // text/typing.ts: the editable blocks, and a block put back by the history
  attach(): void;
  markMath(root: Element): void;
  restoreHost(host: Element, content: string): Promise<void>;
}

export interface Selector {
  // selection.ts: the selected element for the modules of today
  select(el: Element | null): void;
  movableOf(target: Element | null): Element | null;
  mark(pairing: Pairing | null): void;
  refresh(): void;
}

export interface Pane {
  // nav.ts and steps.ts: a pane shown with its button in the status bar
  readonly pane: HTMLElement;
  readonly button: HTMLButtonElement;
  readonly shown: boolean;
  toggle(): void;
  refresh(): void;
}

export interface LayerSwitch {
  // layers.ts: the layer of the slide that is shown
  refresh(): void;
  reveal(el: Element): void;
}

const detectPlatform = (): Platform => {
  const forced = new URLSearchParams(location.search).get('edit-platform');
  if (forced === 'mac' || forced === 'other') return forced;
  const agent = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '';
  return /mac|iphone|ipad/i.test(agent) ? 'mac' : 'other';
};

// true in Safari, which takes Cmd+L and Cmd+R of Keynote before the page, where Chrome and Firefox
// pass them on. the URL parameter edit-browser=safari sets it for a test
const detectSafari = (): boolean => {
  const forced = new URLSearchParams(location.search).get('edit-browser');
  if (forced) return forced === 'safari';
  return /Safari\//.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|FxiOS|Firefox|Edg/.test(navigator.userAgent);
};

export class App {
  source: Source | null = null;
  // the text last read from the file or written to it. it differs from the source after a save
  // during which an edit was made, and the deck is clean when it renders as this text
  saved: string | null = null;
  pairing: Pairing | null = null;
  // the step, the offset, and later any attribute of each element changed since the last save
  readonly tagEdits = new Map<Element, TagEdit>();
  handle: FileSystemFileHandle | null = null;
  state: State = 'starting';
  dirty = false;
  // the message of the last save or error, shown until the next edit
  note: { text: string; warn: boolean } | null = null;
  autosave = false;
  // the texts of the current slide that run past its edge
  overflow = 0;
  // those of them drawn over a figure of the slide
  overFigure = 0;
  // the state line as last reported
  line: Line = { text: '', warn: false, title: '' };
  readonly platform: Platform = detectPlatform();
  readonly safari: boolean = detectSafari();
  // the box of the menu item whose command runs, until the task of the run ends, e.g. for the
  // layout tiles that Layout opens beside its item
  menuItem: DOMRect | null = null;
  readonly history: History;
  readonly commands: Commands;

  files!: Files;
  drafts!: Drafts;
  notes!: Notes;
  math!: MathPop;
  typing!: Typing;
  move!: Selector;
  layers!: LayerSwitch;
  selection!: Selection;
  doc!: Doc;
  nav!: Pane;
  steps!: Pane;

  private readonly listeners = new Map<Event, (() => void)[]>();
  private readonly refreshers: { flags: Flag[]; refresh(flags: ReadonlySet<Flag>): void }[] = [];
  private pending = new Set<Flag>();
  private scheduled = false;

  constructor() {
    this.history = new History({
      snapshot: contentWithTex,
      restore: (host, content) => this.typing.restoreHost(host, content),
      onChange: () => this.emit('history'),
      selected: () => (this.selection?.kind === 'elements' ? this.selection.elements() : null),
      reselect: (els) => {
        const live = els.filter((el) => el.isConnected);
        if (live.length) this.selection.set('elements', live);
      },
      view: () => {
        const slide = this.current();
        return slide ? () => void (slide.isConnected && this.showSlide(slide)) : null;
      },
    });
    this.commands = new Commands(this);
  }

  deck(): Deck | undefined {
    return (window as unknown as { Reveal?: Deck }).Reveal;
  }

  slides(): Element {
    return document.querySelector('.reveal .slides') ?? document.body;
  }

  current(): Element | null {
    return this.deck()?.getCurrentSlide() ?? null;
  }

  // the slide of el is shown in the layer in which el is seen, e.g. for an undo of a change on
  // another slide
  showSlide(el: Element): void {
    const d = this.deck();
    const section = el.closest('section');
    if (d && section) {
      const was = d.getCurrentSlide();
      const at = d.getIndices();
      // a current slide taken off the page, e.g. by an undo, is first replaced by the slide at its
      // index, since reveal.js would otherwise animate from it
      if (!was?.isConnected) d.slide(at.h, at.v);
      const { h, v = 0 } = d.getIndices(section);
      const moved = h !== at.h || v !== (at.v ?? 0);
      if (moved || section !== d.getCurrentSlide()) d.slide(h, v);
      // reveal.js announces a change of its index only, and not another slide put at the index
      if (!moved && d.getCurrentSlide() !== was) {
        this.emit('slide');
        this.invalidate();
      }
    }
    this.layers?.reveal(el);
  }

  slideNumber(slide: Element | null): number | null {
    if (!slide) return null;
    const d = this.deck();
    return d ? d.getIndices(slide).h + 1 : null;
  }

  // the editable block around target, on a slide
  hostOf(target: EventTarget | null): Element | null {
    const host = target instanceof Element ? target.closest(HOST) : null;
    return host && this.slides().contains(host) ? host : null;
  }

  // the viewport of reveal.js is laid out again, e.g. after a pane was shown or resized
  relayout(): void {
    this.deck()?.layout();
    this.emit('resize');
  }

  listen(event: Event, fn: () => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(fn);
    this.listeners.set(event, list);
  }

  emit(event: Event): void {
    for (const fn of this.listeners.get(event) ?? []) fn();
  }

  // every change passes here: the state is shown, and the drafts and the autosave are scheduled
  markDirty(): void {
    if (!this.dirty) {
      this.dirty = true;
      this.note = null;
      this.report();
    }
    this.emit('dirty');
  }

  report(): void {
    if (this.files) this.line = this.files.line();
    this.emit('report');
  }

  // an error of a button or a key, shown in the state until the next edit
  fail(e: unknown): void {
    this.note = { text: e instanceof Error ? e.message : String(e), warn: true };
    this.report();
  }

  // refresh is called once after the event in which one of flags was invalidated, with every flag
  // invalidated in the event, and the modules are refreshed in the order of their install. the
  // refresh is run in a microtask rather than an animation frame, since a pane is read right after
  // an action in the tests of today
  onRefresh(flags: Flag[], refresh: (flags: ReadonlySet<Flag>) => void): void {
    this.refreshers.push({ flags, refresh });
  }

  invalidate(...flags: Flag[]): void {
    for (const f of flags.length ? flags : ALL) this.pending.add(f);
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => this.flush());
  }

  // the refresh that is due is run now, e.g. before the state is read by a test
  flush(): void {
    this.scheduled = false;
    const flags = this.pending;
    if (!flags.size) return;
    this.pending = new Set();
    for (const r of this.refreshers) if (r.flags.some((f) => flags.has(f))) r.refresh(flags);
  }

  region(): Region {
    const active = document.activeElement;
    if (!(active instanceof Element) || active === document.body) return 'canvas';
    // a popover, e.g. the grid of Insert Table, leaves the toolbar and the commands enabled
    if (active.closest('.beeson-math, .beeson-edit-card:not([hidden]), dialog[open]:not([data-popover])')) return 'dialog';
    // a slider, a checkbox, a button, or a list does not have an undo of its own, hence its region
    // is that of the pane around it
    if (active.matches('textarea, input:not([type=range], [type=checkbox], [type=radio], [type=button], [type=color])')) return 'field';
    if (active.closest('aside.notes')) return 'notes';
    // a formula focused in an object that is selected takes the keys of the slide
    if (this.hostOf(active) && !(active.matches('mjx-container') && this.selection.items.some((el) => this.selection.kind === 'elements' && el.contains(active)))) return 'text';
    if (active.closest('.beeson-edit-nav')) return 'navigator';
    // the object list of navigator/objects.ts takes its own keys, as a pane of controls
    if (active.closest('.beeson-edit-inspector, .beeson-edit-side, .beeson-edit-objects')) return 'inspector';
    return 'canvas';
  }
}
