import type { Source } from './source.ts';
import type { Pairing } from './render.ts';
import type { TagEdit } from './tags.ts';
import { History, type Entry } from './history.ts';
import { contentWithTex } from './math.ts';
import { Commands } from './commands.ts';
import type { Selection } from './selection.ts';
import type { Doc } from './model/doc.ts';

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

export type Flag = 'content' | 'selection' | 'slide' | 'structure' | 'layout';
export const ALL: Flag[] = ['content', 'selection', 'slide', 'structure', 'layout'];

export type Region = 'canvas' | 'text' | 'field' | 'navigator' | 'notes' | 'inspector' | 'dialog';

export type Platform = 'mac' | 'other';

export type State = 'starting' | 'waiting' | 'loaded' | 'error';

export type Line = { text: string; warn: boolean; title: string };

export type Event = 'report' | 'history' | 'dirty' | 'slide' | 'resize' | 'open' | 'session' | 'sheet';

export const HOST = '[contenteditable="true"]';

export interface Files {
  open(text: string, fresh?: boolean): void;
  render(): string;
  save(): Promise<void>;
  saveAs(): Promise<void>;
  openFile(): Promise<void>;
  present(hash?: string, tab?: boolean): Promise<{ win: Window | null } | null>;
  toggleAutosave(): void;
  line(): Line;
  showProblems(): void;
  closeProblems(): void;
  problemsShown(): boolean;
  askShown(): boolean;
  cancelAsk(): void;
}

export interface Follow {
  start(): Promise<void>;
  read(text: string): void;
  written(text: string): void;
  begin(): void;
  end(): void;
  merge(target: FileSystemFileHandle): Promise<'same' | 'other' | 'merged' | 'cancelled'>;
  line(): string | null;
  status(): { changed: number[]; stale: number[] | null; watching: boolean };
}

export interface Drafts {
  keepSoon(): void;
  drop(): void;
  hasDraft(): boolean;
  offer(): void;
  offered(): boolean;
  restore(): Promise<void>;
}

export interface Notes {
  readonly button: HTMLButtonElement;
  shown(): boolean;
  toggle(): void;
  ensure(): HTMLElement | null;
  setPane(height: number): void;
  height(): number;
}

export interface MathPop {
  isOpen(): boolean;
  open(container: Element, into?: Entry, closed?: () => void): void;
  close(back?: boolean): void;
  setMath(container: Element, tex: string): Promise<void>;
  hold(): () => void;
  wholeTex(): Element | null;
}

export interface Typing {
  attach(): void;
  markMath(root: Element): void;
  restoreHost(host: Element, content: string): Promise<void>;
}

export interface Selector {
  select(el: Element | null): void;
  movableOf(target: Element | null): Element | null;
  mark(pairing: Pairing | null): void;
  refresh(): void;
}

export interface Pane {
  readonly pane: HTMLElement;
  readonly button: HTMLButtonElement;
  readonly shown: boolean;
  readonly seen?: boolean;
  toggle(): void;
  refresh(): void;
}

export type TabPick = { child: Element | null; i: number };

export interface ShownStepsSwitch {
  refresh(): void;
  reveal(el: Element): void;
  shown(slide: Element): TabPick;
  show(slide: Element, pick: TabPick): void;
}

const detectPlatform = (): Platform => {
  const forced = new URLSearchParams(location.search).get('edit-platform');
  if (forced === 'mac' || forced === 'other') return forced;
  const agent = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '';
  return /mac|iphone|ipad/i.test(agent) ? 'mac' : 'other';
};

const detectSafari = (): boolean => {
  const forced = new URLSearchParams(location.search).get('edit-browser');
  if (forced) return forced === 'safari';
  return /Safari\//.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|FxiOS|Firefox|Edg/.test(navigator.userAgent);
};

export class App {
  source: Source | null = null;
  saved: string | null = null;
  pairing: Pairing | null = null;
  readonly tagEdits = new Map<Element, TagEdit>();
  handle: FileSystemFileHandle | null = null;
  state: State = 'starting';
  dirty = false;
  note: { text: string; warn: boolean } | null = null;
  session: { status: string | null; save(): Promise<void> | void; sent(): Promise<void> } | null = null;
  autosave = false;
  overflow = 0;
  overFigure = 0;
  line: Line = { text: '', warn: false, title: '' };
  readonly platform: Platform = detectPlatform();
  readonly safari: boolean = detectSafari();
  menuItem: DOMRect | null = null;
  readonly history: History;
  readonly commands: Commands;

  files!: Files;
  drafts!: Drafts;
  follow!: Follow;
  notes!: Notes;
  math!: MathPop;
  typing!: Typing;
  move!: Selector;
  shownSteps!: ShownStepsSwitch;
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
      alone: () => !this.session,
      selected: () => (this.selection?.kind === 'elements' ? this.selection.elements() : null),
      reselect: (els) => {
        const live = els.filter((el) => el.isConnected);
        if (live.length) this.frame(live);
      },
      changed: () => this.selection?.changed() ?? (() => {}),
      view: () => {
        const slide = this.current();
        const pick = slide ? this.shownSteps?.shown(slide) : null;
        return slide
          ? () => {
              if (!slide.isConnected) return;
              this.showSlide(slide);
              if (pick) this.shownSteps.show(slide, pick);
            }
          : null;
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

  showSlide(el: Element): void {
    if (this.history.quiet) return;
    const d = this.deck();
    const section = el.closest('section');
    if (d && section) {
      const was = d.getCurrentSlide();
      const at = d.getIndices();
      if (!was?.isConnected) d.slide(at.h, at.v);
      const { h, v = 0 } = d.getIndices(section);
      const moved = h !== at.h || v !== (at.v ?? 0);
      if (moved || section !== d.getCurrentSlide()) d.slide(h, v);
      if (!moved && d.getCurrentSlide() !== was) {
        this.emit('slide');
        this.invalidate();
      }
    }
    this.shownSteps?.reveal(el);
  }

  slideNumber(slide: Element | null): number | null {
    if (!slide) return null;
    const d = this.deck();
    return d ? d.getIndices(slide).h + 1 : null;
  }

  caretHost(): Element | null {
    const active = document.activeElement, sel = getSelection();
    const host = active?.matches('mjx-container') ? null : this.hostOf(active);
    return host && sel?.rangeCount && active!.contains(sel.anchorNode) ? host : null;
  }

  frame(els: Element[]): void {
    const host = this.caretHost();
    const formula = host?.matches('div.math') && els.includes(host) ? host.querySelector<HTMLElement>('mjx-container') : null;
    formula?.focus({ preventScroll: true });
    if (host && !formula && els.some((el) => el.contains(host))) return this.selection.set('text', [host]);
    if (host && !formula) {
      (document.activeElement as HTMLElement).blur();
      getSelection()?.removeAllRanges();
    }
    this.selection.set('elements', els);
  }

  hostOf(target: EventTarget | null): Element | null {
    const host = target instanceof Element ? target.closest(HOST) : null;
    return host && this.slides().contains(host) ? host : null;
  }

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

  fail(e: unknown): void {
    this.note = { text: e instanceof Error ? e.message : String(e), warn: true };
    this.report();
  }

  onRefresh(flags: Flag[], refresh: (flags: ReadonlySet<Flag>) => void): void {
    this.refreshers.push({ flags, refresh });
  }

  invalidate(...flags: Flag[]): void {
    for (const f of flags.length ? flags : ALL) this.pending.add(f);
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => this.flush());
  }

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
    if (active.closest('.beeson-math, .beeson-edit-dialog:not([hidden]), dialog[open]:not([data-popover])')) return 'dialog';
    if (active.matches('textarea, input:not([type=range], [type=checkbox], [type=radio], [type=button], [type=color])')) return 'field';
    if (active.closest('aside.notes')) return 'notes';
    if (this.caretHost() || (this.hostOf(active) && !(this.selection.kind === 'elements' && this.selection.items.some((el) => el.contains(active))))) return 'text';
    if (active.closest('.beeson-edit-nav')) return 'navigator';
    if (active.closest('.beeson-edit-inspector, .beeson-edit-side, .beeson-edit-objects')) return 'inspector';
    return 'canvas';
  }
}
