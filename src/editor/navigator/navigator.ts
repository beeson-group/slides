// the navigator at the left, as the slide navigator of Keynote: a thumbnail of each slide with its
// number, its place in the show, three dots on a slide with steps, a corner at the lower right
// of a slide with a transition other than the default Fade or None, as the corner of Keynote, and a
// hidden slide collapsed to a thin double bar without a number. a click selects a slide, Shift extends the selection to a
// range, and the command modifier adds or removes one slide. a drag moves the selected slides, with
// a line at the place where they are dropped. image and video files dropped onto a row make a new
// figure slide after it with the files in its plate, as a drop onto the navigator of Keynote. a
// preview of a slide at 320 px is shown while the pointer rests on its row

import type { App, Pane } from '../app.ts';
import { layersOf, showLayer } from '../layers.ts';
import { transitionOf } from '../review/transitions.ts';
import { injectStyle, stored, store } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { Outline } from './outline.ts';
import { drawInto, type Thumbs } from './thumbs.ts';

const KEY = 'beeson-nav';
const LAYOUTS = ['title', 'section', 'closing', 'figure', 'split'];
const PEEK_WIDTH = 320;
const PEEK_DELAY = 300;
// the distance in CSS px by which a press is moved before it is a drag
const DRAG_START = 4;
// the band at the top and the bottom of the list in which a drag scrolls it, in CSS px
const SCROLL_BAND = 28;

export function describe(slide: Element): { title: string; kind: string } {
  const heading = [...slide.querySelectorAll('h1, h2, h3, p, .caption')].find((h) => !h.closest('aside.notes, .backdrop') && (h.textContent ?? '').trim());
  const title = (heading?.textContent ?? '').replace(/\s+/g, ' ').trim() || 'Untitled slide';
  const kind = LAYOUTS.find((c) => slide.classList.contains(c)) ?? 'content';
  return { title, kind };
}

// the name of the transition of slide, or null for the default Fade and for None
function transitionName(app: App, slide: Element): string | null {
  const t = transitionOf(app, slide);
  if (t === 'magic') return 'Magic Move';
  if (t === null) return slide.getAttribute('data-transition');
  return null;
}

export const isHidden = (slide: Element): boolean => slide.getAttribute('data-visibility') === 'hidden';

// a slide with a step, outside its notes
const hasSteps = (slide: Element): boolean => [...slide.querySelectorAll('.fragment')].some((f) => !f.closest('aside.notes'));

// the number of each slide as the theme shows it: a title, section, or closing slide and a slide
// with data-visibility="uncounted" in the file are not numbered, the slides after the closing slide
// are numbered A1, A2, and so on, and a hidden slide is left out, since it is not in the show.
// written is the data-visibility of a slide in the file, since the theme sets uncounted at run time
export function numbers(slides: Element[], written: (slide: Element) => string | null): string[] {
  let n = 0;
  let a = 0;
  let appendix = false;
  return slides.map((s) => {
    let label = '';
    if (isHidden(s)) label = '';
    else if (appendix) label = `A${++a}`;
    else if (!s.matches('.title, .section, .closing') && written(s) !== 'uncounted') label = String(++n);
    if (s.classList.contains('closing')) appendix = true;
    return label;
  });
}

// the place of each slide in the show, 1 to N, as the navigators of Keynote and PowerPoint number
// the slides. a hidden slide is not in the show, and it is given the place that it would take
export function showPlaces(slides: Element[]): number[] {
  let n = 0;
  return slides.map((s) => (isHidden(s) ? n + 1 : ++n));
}

// the number of each slide in the navigator, and none on a hidden slide, which is drawn as the bar
// of a skipped slide of Keynote
export function places(slides: Element[]): string[] {
  const at = showPlaces(slides);
  return slides.map((s, i) => (isHidden(s) ? '' : String(at[i])));
}

// the width in px from which a thumbnail is read without a preview, as in Keynote, whose thumbnails
// are about as wide as those of the navigator at its usual width
const READABLE = 120;

// whether the thumbnail of row is large enough to read and inside the visible part of its list, in
// which case a hover preview would only repeat it
function shownWhole(row: HTMLElement): boolean {
  const pic = row.querySelector('.frame')?.getBoundingClientRect();
  const list = row.closest('.rows')?.getBoundingClientRect();
  return !!pic && !!list && pic.width >= READABLE && pic.top >= list.top && pic.bottom <= list.bottom;
}

const CSS = `
.beeson-edit-nav { --nav-bg: var(--ed-panel, #f4f4f6); --nav-text: var(--ed-text, #1d1d1f); --nav-muted: var(--ed-muted, #86868b); --nav-line: var(--ed-line, #d2d2d7); --nav-select: var(--ed-select, #7a5af8); --nav-current: rgba(0, 0, 0, 0.07); --nav-hover: rgba(0, 0, 0, 0.2); --nav-shadow: 0 1px 3px rgba(0, 0, 0, 0.22); }
@media (prefers-color-scheme: dark) {
  .beeson-edit-nav { --nav-bg: var(--ed-panel, #232326); --nav-text: var(--ed-text, #f2f2f7); --nav-muted: var(--ed-muted, #98989d); --nav-line: var(--ed-line, #3a3a3c); --nav-select: var(--ed-select, #9b82ff); --nav-current: rgba(255, 255, 255, 0.09); --nav-hover: rgba(255, 255, 255, 0.3); --nav-shadow: 0 1px 3px rgba(0, 0, 0, 0.6); }
}
.beeson-edit-nav { position: fixed; left: 0; top: 44px; bottom: 36px; z-index: 50; width: 240px; box-sizing: border-box; display: none; flex-direction: column; background: var(--nav-bg); border-right: 1px solid var(--nav-line); color: var(--nav-text); font: 12px/1.3 system-ui, sans-serif; }
html.beeson-nav .beeson-edit-nav { display: flex; }
.beeson-edit-nav .rows { position: relative; flex: 1; overflow: auto; padding: 10px 10px 40px 4px; outline: none; }
.beeson-edit-nav .foot { flex: none; display: flex; align-items: center; height: 32px; padding: 0 6px; border-top: 1px solid var(--nav-line); }
.beeson-edit-nav .foot button { display: grid; place-items: center; width: 26px; height: 24px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: var(--nav-text); }
.beeson-edit-nav .foot button:hover { background: var(--nav-current); }
.beeson-edit-nav .foot button:focus-visible { outline: 2px solid var(--nav-select); outline-offset: -2px; }
.beeson-edit-nav .row { position: relative; display: grid; grid-template-columns: 24px 1fr; column-gap: 6px; align-items: end; width: 100%; box-sizing: border-box; margin: 0 0 8px; padding: 5px 6px 5px 0; border: 0; border-radius: 8px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: default; touch-action: none; }
.beeson-edit-nav .row:focus-visible { outline: none; }
.beeson-edit-nav .row[aria-current="true"] { background: var(--nav-current); }
.beeson-edit-nav .row .no { color: var(--nav-muted); text-align: right; font-variant-numeric: tabular-nums; line-height: 1; padding-bottom: 1px; }
.beeson-edit-nav .row .frame { position: relative; border-radius: 5px; box-shadow: var(--nav-shadow); outline: 1px solid var(--nav-line); outline-offset: 0; }
.beeson-edit-nav .row .pic { display: block; aspect-ratio: 16 / 9; border-radius: 5px; background: var(--bg, #000); }
.beeson-edit-nav .row:hover:not([aria-selected="true"]):not(.dragged) .frame { outline: 3px solid var(--nav-hover); outline-offset: 2px; }
.beeson-edit-nav .row[aria-selected="true"] .frame { outline: 3px solid var(--nav-select); outline-offset: 2px; }
.beeson-edit-nav .rows:focus-within .row[aria-selected="true"] .no { color: var(--nav-select); font-weight: 600; }
.beeson-edit-nav .row .dots { position: absolute; left: 6px; bottom: 5px; display: flex; gap: 3px; pointer-events: none; }
.beeson-edit-nav .row .dots[hidden] { display: none; }
.beeson-edit-nav .row .dots i { width: 5px; height: 5px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45); }
.beeson-edit-nav .row .trans { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; border-bottom-right-radius: 5px; background: var(--nav-select); clip-path: polygon(100% 0, 100% 100%, 0 100%); pointer-events: none; }
.beeson-edit-nav .row .trans[hidden] { display: none; }
.beeson-edit-nav .row.skip { align-items: center; padding-top: 2px; padding-bottom: 2px; }
.beeson-edit-nav .row.skip .frame { height: 5px; box-shadow: none; outline: 0; border-top: 1px solid var(--nav-muted); border-bottom: 1px solid var(--nav-muted); border-radius: 0; }
.beeson-edit-nav .row.skip .pic, .beeson-edit-nav .row.skip .dots, .beeson-edit-nav .row.skip .trans { display: none; }
.beeson-edit-nav .row.skip[aria-selected="true"] .frame { outline: 0; border-color: var(--nav-select); }
.beeson-edit-nav .row.dragged { opacity: 0.35; }
.beeson-edit-nav .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.beeson-edit-nav .drop { position: absolute; left: 22px; right: 10px; height: 3px; margin-top: -1.5px; border-radius: 2px; background: var(--nav-select); pointer-events: none; }
.beeson-edit-nav .drop::before { content: ""; position: absolute; left: -7px; top: -3.5px; width: 6px; height: 6px; border: 2px solid var(--nav-select); border-radius: 50%; background: var(--nav-bg); }
.beeson-edit-nav .drop[hidden] { display: none; }
.beeson-edit-ghost { position: fixed; z-index: 70; pointer-events: none; border-radius: 6px; overflow: visible; box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35); transform: rotate(-1.5deg); opacity: 0.95; }
.beeson-edit-ghost .pic { border-radius: 6px; aspect-ratio: 16 / 9; background: var(--bg, #000); }
.beeson-edit-ghost .count { position: absolute; right: -8px; top: -8px; min-width: 20px; height: 20px; padding: 0 5px; box-sizing: border-box; border-radius: 10px; background: var(--ed-select, #7a5af8); color: #fff; font: 600 12px/20px system-ui, sans-serif; text-align: center; }
.beeson-edit-peek { position: fixed; left: 248px; z-index: 57; width: 320px; overflow: hidden; border-radius: 6px; outline: 1px solid var(--line, #555); background: var(--bg, #000); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); pointer-events: none; }
.beeson-edit-peek[hidden] { display: none; }
.beeson-edit-peek .reveal { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; overflow: hidden; }
.beeson-edit-peek .fragment { visibility: visible !important; opacity: 1 !important; transition: none !important; }
.beeson-edit-peek .fragment.beeson-off { visibility: hidden !important; }
`;

type Row = { el: HTMLButtonElement; no: HTMLElement; pic: HTMLElement; dots: HTMLElement; trans: HTMLElement; num: HTMLElement; title: HTMLElement; kind: HTMLElement };

// the current slide, the selected slides, and whether the focus is in the navigator
type Place = { current: Element | null; slides: Element[]; nav: boolean };

type Drag = { slide: Element; x: number; y: number; id: number; on: boolean; slides: Element[]; gap: number; ghost: HTMLElement | null; scroll: number };

// what a drag in the navigator asks for: the slides moved to the gap before the slide at gap, in
// the order of the list before the move
export type MoveTo = { slides: Element[]; gap: number };

// the order of list after the slides of a drag are dropped at gap
export function droppedOrder(list: Element[], moved: Element[], gap: number): Element[] {
  const set = new Set(moved);
  const rest = list.filter((s) => !set.has(s));
  const at = gap - list.slice(0, gap).filter((s) => set.has(s)).length;
  return [...rest.slice(0, at), ...list.filter((s) => set.has(s)), ...rest.slice(at)];
}

export class Navigator implements Pane {
  readonly pane = document.createElement('div');
  readonly button = document.createElement('button');
  readonly list = document.createElement('div');
  private readonly peek = document.createElement('div');
  private readonly drop = document.createElement('div');
  private readonly foot = document.createElement('div');
  readonly outline: Outline;
  private readonly app: App;
  private readonly rows = new Map<Element, Row>();
  private thumbs: Thumbs | null = null;
  private on = true;
  private timer = 0;
  private anchor: Element | null = null;
  private drag: Drag | null = null;
  private eatClick = false;

  constructor(app: App) {
    injectStyle('nav', CSS);
    this.app = app;
    this.pane.className = 'beeson-edit-nav';
    this.pane.setAttribute('aria-label', 'Slides');
    this.button.textContent = 'Navigator';
    this.button.title = 'Show the navigator of the slides at the left';
    this.list.className = 'rows';
    this.list.setAttribute('role', 'listbox');
    this.list.setAttribute('aria-label', 'Slides');
    this.list.setAttribute('aria-multiselectable', 'true');
    this.list.dataset.context = 'navigator';
    this.drop.className = 'drop';
    this.drop.hidden = true;
    this.list.append(this.drop);
    this.peek.className = 'beeson-edit-peek';
    this.peek.hidden = true;
    this.peek.setAttribute('aria-hidden', 'true');
    this.peek.setAttribute('inert', '');
    // the + button opens the chooser of New Slide over itself
    this.foot.className = 'foot';
    const add = document.createElement('button');
    add.type = 'button';
    add.dataset.command = 'slide.gallery';
    add.title = 'Add Slide';
    add.setAttribute('aria-label', 'Add Slide');
    add.append(icon('plus', 16));
    add.addEventListener('click', () => void this.app.commands.run('slide.gallery', add).catch((e) => this.app.fail(e)));
    this.foot.append(add);
    this.outline = new Outline(app, this.pane);
    this.pane.append(this.list, this.outline.el, this.foot, this.peek);
    // the outline view takes the place of the thumbnails, and shows the navigator when it is hidden
    app.commands.define({
      id: 'view.outline',
      label: 'Outline',
      menu: { bar: 'View', group: 'panes', order: 10.5 },
      checked: () => this.outline.shown,
      run: () => {
        if (!this.on && !this.outline.shown) this.toggle();
        this.outline.toggle();
        this.app.relayout();
      },
    });
    this.button.addEventListener('click', () => this.toggle());
    this.list.addEventListener('keydown', (ev) => this.onKey(ev));
    this.list.addEventListener('pointerdown', (ev) => this.onDown(ev));
    this.list.addEventListener('pointermove', (ev) => this.onMove(ev));
    this.list.addEventListener('pointerup', (ev) => this.onUp(ev));
    this.list.addEventListener('pointercancel', () => this.endDrag(false));
    this.list.addEventListener('lostpointercapture', () => this.endDrag(false));
    this.list.addEventListener('focusin', () => {
      if (this.app.selection && this.app.selection.kind !== 'slides') this.selectOnly(this.app.current());
    });
    this.list.addEventListener('dragover', (ev) => this.onFileOver(ev));
    this.list.addEventListener('dragleave', (ev) => {
      if (!this.drag && !(ev.relatedTarget instanceof Node && this.list.contains(ev.relatedTarget))) this.drop.hidden = true;
    });
    // the drop of media/drop.ts stops the drop at the window, hence it is taken there
    window.addEventListener('drop', (ev) => this.onFileDrop(ev), true);
    new ResizeObserver(() => this.measure()).observe(this.list);
    this.on = stored(KEY) !== '0';
    this.show(this.on);
  }

  get shown(): boolean {
    return this.on;
  }

  useThumbs(thumbs: Thumbs): void {
    this.thumbs = thumbs;
    this.thumbs.setHosts(new Map([...this.rows].map(([s, r]) => [s, r.pic])));
    this.measure();
  }

  toggle(): void {
    // while the navigator is on but hidden for the width of the window beside the inspector, it is
    // shown with the inspector closed in its place
    if (this.on && this.pane.isConnected && !this.pane.getClientRects().length) {
      void this.app.commands.run(this.app.steps.shown ? 'view.steps' : 'shell.format').catch((e) => this.app.fail(e));
      return;
    }
    this.show(!this.on);
    store(KEY, this.on ? '1' : '0');
    this.app.relayout();
    this.refresh();
  }

  private show(on: boolean): void {
    this.on = on;
    if (!on) this.hidePeek();
    document.documentElement.classList.toggle('beeson-nav', on);
    this.button.classList.toggle('on', on);
    this.button.setAttribute('aria-pressed', String(on));
  }

  slides(): Element[] {
    return [...this.app.slides().querySelectorAll(':scope > section')];
  }

  // the selected slides in the order of the deck, or the current slide when no slide is selected
  selected(): Element[] {
    const sel = this.app.selection;
    if (sel?.kind === 'slides') {
      const items = sel.items.filter((s) => s.isConnected && s.parentElement === this.app.slides());
      if (items.length) return items;
    }
    const current = this.app.current();
    return current ? [current] : [];
  }

  // the slides set as the selection, the anchor of a range, and the slide shown
  select(slides: Element[], current: Element | null = slides.at(-1) ?? null, anchor: Element | null = current): void {
    this.app.selection.set('slides', slides);
    this.anchor = anchor;
    if (current) this.app.showSlide(current);
    this.refresh();
  }

  private selectOnly(slide: Element | null): void {
    if (slide) this.select([slide], slide);
  }

  // fn as a part of the history after whose undo the current slide, the selected slides, and the
  // focus in the navigator are those before fn, and after whose redo those after it, as the
  // selecting() of history.ts keeps the elements
  keeping<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
    const take = (): Place => ({ current: this.app.current(), slides: this.selected(), nav: this.app.region() === 'navigator' });
    return this.app.history.keeping(label, take, (p) => this.restore(p), fn);
  }

  private restore(p: Place): void {
    const slides = p.slides.filter((s) => s.isConnected);
    const current = p.current?.isConnected ? p.current : (slides.at(-1) ?? null);
    if (!current) return;
    this.select(slides.length ? slides : [current], current);
    if (p.nav || this.app.region() === 'navigator' || document.activeElement === document.body) this.focus(current);
  }

  // the row of slide gets the focus, e.g. after a command run in the navigator
  focus(slide: Element | null = this.app.current()): void {
    const row = slide ? this.rows.get(slide) : null;
    row?.el.focus({ preventScroll: true });
    row?.el.scrollIntoView({ block: 'nearest' });
  }

  // the row and the thumbnail of slide, e.g. as the place of the gallery of a new slide
  rowOf(slide: Element | null): HTMLElement | null {
    return (slide && this.rows.get(slide)?.el) || null;
  }

  private makeRow(slide: Element): Row {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'row';
    el.setAttribute('role', 'option');
    el.dataset.context = 'slide';
    const no = document.createElement('span');
    no.className = 'no';
    no.setAttribute('aria-hidden', 'true');
    const frame = document.createElement('span');
    frame.className = 'frame';
    const pic = document.createElement('span');
    pic.className = 'pic';
        const dots = document.createElement('span');
    dots.className = 'dots';
    dots.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
    const trans = document.createElement('span');
    trans.className = 'trans';
    trans.hidden = true;
    frame.append(pic, dots, trans);
    const sr = (cls: string) => {
      const s = document.createElement('span');
      s.className = `${cls} sr`;
      return s;
    };
    const num = sr('num');
    const title = sr('title');
    const kind = sr('kind');
    el.append(no, frame, num, title, kind);
    el.addEventListener('click', (ev) => this.onClick(slide, ev));
    el.addEventListener('contextmenu', () => {
      if (!this.selected().includes(slide)) this.selectOnly(slide);
    });
    el.addEventListener('pointerenter', () => {
      this.hidePeek();
      if (!this.drag) this.timer = window.setTimeout(() => this.showPeek(slide, el), PEEK_DELAY);
    });
    el.addEventListener('pointerleave', () => this.hidePeek());
    return { el, no, pic, dots, trans, num, title, kind };
  }

  // the rows follow the slides of the deck, their numbers, titles, steps, and hidden state, and
  // the selection. a row is kept with its thumbnail while its slide is on the page
  refresh(): void {
    this.outline.refresh();
    // a focused row moved in the list loses the focus, e.g. by Move Slide Up
    const focusIn = this.list.contains(document.activeElement);
    const slides = this.slides();
    const nums = places(slides);
    const kept = new Set(slides);
    for (const [s, r] of this.rows) {
      if (kept.has(s)) continue;
      r.el.remove();
      this.rows.delete(s);
    }
    let changed = false;
    let prev: Element = this.drop;
    slides.forEach((slide, i) => {
      let row = this.rows.get(slide);
      if (!row) {
        row = this.makeRow(slide);
        this.rows.set(slide, row);
        changed = true;
      }
      if (prev.nextSibling !== row.el) {
        prev.after(row.el);
        changed = true;
      }
      prev = row.el;
      const { title, kind } = describe(slide);
      const hidden = isHidden(slide);
      const steps = hasSteps(slide);
      if (row.no.textContent !== nums[i]) row.no.textContent = nums[i];
      if (row.num.textContent !== String(i + 1)) row.num.textContent = String(i + 1);
      if (row.title.textContent !== title) row.title.textContent = title;
      if (row.kind.textContent !== kind) row.kind.textContent = kind;
      row.el.classList.toggle('skip', hidden);
      row.dots.hidden = !steps;
      const effect = transitionName(this.app, slide);
      row.trans.hidden = !effect;
      const label = `Slide ${i + 1}: ${title}${hidden ? ', hidden' : ''}${steps ? ', with steps' : ''}${effect ? `, with the transition ${effect}` : ''}`;
      if (row.el.getAttribute('aria-label') !== label) row.el.setAttribute('aria-label', label);
      row.el.title = `Slide ${i + 1}: ${title}`;
    });
    if (changed && this.thumbs) this.thumbs.setHosts(new Map([...this.rows].map(([s, r]) => [s, r.pic])));
    this.paint(focusIn || this.list.contains(document.activeElement));
  }

  // the current row and the selected rows are marked, the current row is kept in view, and the
  // focus follows the current slide while it is in the list
  private paint(focusIn = this.list.contains(document.activeElement)): void {
    const current = this.app.current();
    const sel = this.app.selection?.kind === 'slides' ? new Set(this.selected()) : new Set(current ? [current] : []);
    for (const [slide, row] of this.rows) {
      const here = slide === current;
      row.el.setAttribute('aria-current', here ? 'true' : 'false');
      row.el.setAttribute('aria-selected', sel.has(slide) ? 'true' : 'false');
      row.el.tabIndex = here ? 0 : -1;
      if (here && !this.drag) {
        if (this.on) row.el.scrollIntoView({ block: 'nearest' });
        if (focusIn && document.activeElement !== row.el) row.el.focus({ preventScroll: true });
      }
    }
    if (!current && this.rows.size) [...this.rows.values()][0].el.tabIndex = 0;
  }

  private measure(): void {
    const first = this.rows.values().next().value as Row | undefined;
    const width = first && !first.el.classList.contains('skip') ? first.pic.getBoundingClientRect().width : this.list.clientWidth - 44;
    if (width > 0) this.thumbs?.setWidth(width);
  }

  private onClick(slide: Element, ev: MouseEvent): void {
    this.hidePeek();
    if (this.eatClick) {
      this.eatClick = false;
      return;
    }
    const list = this.slides();
    const mod = this.app.platform === 'mac' ? ev.metaKey : ev.ctrlKey;
    if (ev.shiftKey) {
      const anchor = this.anchor && list.includes(this.anchor) ? this.anchor : (this.selected()[0] ?? slide);
      const [a, b] = [list.indexOf(anchor), list.indexOf(slide)].sort((x, y) => x - y);
      this.select(list.slice(a, b + 1), slide, anchor);
    } else if (mod) {
      const now = this.app.selection.kind === 'slides' ? this.selected() : [];
      if (now.includes(slide) && now.length > 1) {
        const rest = now.filter((s) => s !== slide);
        this.select(rest, slide === this.app.current() ? rest.at(-1)! : this.app.current(), this.anchor);
      } else this.select([...now, slide], slide);
    } else this.selectOnly(slide);
    this.focus(this.app.current());
  }

  // the arrows move to the previous or next slide, with Shift the selection is extended, and Home
  // and End move to the first and the last slide. a key taken by the dispatch of the registry is
  // left alone
  private onKey(ev: KeyboardEvent): void {
    if (ev.defaultPrevented || ev.altKey || ev.metaKey || ev.ctrlKey) return;
    if (this.drag && ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      this.endDrag(false);
      return;
    }
    const slides = this.slides();
    const at = slides.indexOf(this.app.current() as Element);
    const to: Record<string, number> = { ArrowUp: at - 1, ArrowDown: at + 1, Home: 0, End: slides.length - 1 };
    const i = to[ev.key];
    if (i === undefined) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (i < 0 || i >= slides.length) return;
    if (ev.shiftKey) {
      const anchor = this.anchor && slides.includes(this.anchor) ? this.anchor : slides[at];
      const [a, b] = [slides.indexOf(anchor), i].sort((x, y) => x - y);
      this.select(slides.slice(a, b + 1), slides[i], anchor);
    } else this.selectOnly(slides[i]);
    this.focus(slides[i]);
  }

  private rowAt(target: EventTarget | null): [Element, Row] | null {
    const el = target instanceof Element ? target.closest('.row') : null;
    for (const entry of this.rows) if (entry[1].el === el) return entry;
    return null;
  }

  private onDown(ev: PointerEvent): void {
    if (ev.button !== 0 || (this.app.platform === 'mac' && ev.ctrlKey)) return;
    const hit = this.rowAt(ev.target);
    if (!hit) return;
    this.drag = { slide: hit[0], x: ev.clientX, y: ev.clientY, id: ev.pointerId, on: false, slides: [], gap: -1, ghost: null, scroll: 0 };
  }

  private onMove(ev: PointerEvent): void {
    const d = this.drag;
    if (!d || ev.pointerId !== d.id) return;
    if (!d.on) {
      if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < DRAG_START) return;
      this.startDrag(d);
    }
    this.placeGhost(ev.clientX, ev.clientY);
    this.placeDrop(ev.clientY);
    const box = this.list.getBoundingClientRect();
    d.scroll = ev.clientY < box.top + SCROLL_BAND ? -1 : ev.clientY > box.bottom - SCROLL_BAND ? 1 : 0;
    if (d.scroll) this.autoScroll(ev.clientY);
  }

  private startDrag(d: Drag): void {
    this.hidePeek();
    d.on = true;
    if (!this.selected().includes(d.slide) || this.app.selection.kind !== 'slides') this.selectOnly(d.slide);
    d.slides = this.selected();
    try {
      this.list.setPointerCapture(d.id);
    } catch {
      // a synthetic pointer is not captured
    }
    for (const s of d.slides) this.rows.get(s)?.el.classList.add('dragged');
    const row = this.rows.get(d.slide);
    const ghost = document.createElement('div');
    ghost.className = 'beeson-edit-ghost';
    const width = row?.pic.getBoundingClientRect().width || 150;
    ghost.style.width = `${width}px`;
    const pic = document.createElement('div');
    pic.className = 'pic';
    ghost.append(pic);
    if (d.slides.length > 1) {
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = String(d.slides.length);
      ghost.append(count);
    }
    document.body.append(ghost);
    d.ghost = ghost;
    const stage = this.app.slides() as HTMLElement;
    drawInto(pic, d.slide, { width: stage.offsetWidth || 1920, height: stage.offsetHeight || 1080 }, width);
  }

  private placeGhost(x: number, y: number): void {
    const g = this.drag?.ghost;
    if (!g) return;
    g.style.left = `${x + 14}px`;
    g.style.top = `${y - 18}px`;
  }

  // the gap nearest to y, between two rows, and the line drawn in it
  private placeDrop(y: number): void {
    const d = this.drag;
    if (!d) return;
    const rows = this.slides().map((s) => this.rows.get(s)!.el);
    let gap = rows.length;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) {
        gap = i;
        break;
      }
    }
    d.gap = gap;
    this.drawDrop(gap);
  }

  private drawDrop(gap: number): void {
    const rows = this.slides().map((s) => this.rows.get(s)!.el);
    const box = this.list.getBoundingClientRect();
    const before = rows[gap - 1]?.getBoundingClientRect();
    const after = rows[gap]?.getBoundingClientRect();
    const at = before && after ? (before.bottom + after.top) / 2 : after ? after.top - 2 : before ? before.bottom + 2 : box.top;
    this.drop.style.top = `${at - box.top + this.list.scrollTop}px`;
    this.drop.hidden = false;
  }

  private autoScroll(y: number): void {
    const d = this.drag;
    if (!d || !d.scroll) return;
    this.list.scrollTop += d.scroll * 8;
    this.placeDrop(y);
    requestAnimationFrame(() => {
      if (this.drag === d && d.scroll) this.autoScroll(y);
    });
  }

  private onUp(ev: PointerEvent): void {
    const d = this.drag;
    if (!d || ev.pointerId !== d.id) return;
    if (d.on) this.placeDrop(ev.clientY);
    this.endDrag(d.on);
  }

  // the gap after the row under y, where a drop of files puts its slide
  private fileGap(y: number): number {
    return this.slides().filter((s) => this.rows.get(s)!.el.getBoundingClientRect().top <= y).length;
  }

  private onFileOver(ev: DragEvent): void {
    const dt = ev.dataTransfer;
    if (this.drag || !dt || !this.app.pairing?.root || !dt.types.includes('Files')) return;
    if (![...dt.items].every((i) => i.kind !== 'file' || /^(image|video)\//.test(i.type))) return;
    ev.preventDefault();
    dt.dropEffect = 'copy';
    this.drawDrop(this.fileGap(ev.clientY));
  }

  // the new slide and its files are one entry of the history. the media modules are loaded at the
  // drop, since they read the location of the page, and the node tests load this module
  private onFileDrop(ev: DragEvent): void {
    if (this.drag || !(ev.target instanceof Node) || !this.list.contains(ev.target)) return;
    this.drop.hidden = true;
    const dropped = [...(ev.dataTransfer?.files ?? [])];
    if (!dropped.length || !this.app.pairing?.root) return;
    ev.preventDefault();
    const before = this.slides()[this.fileGap(ev.clientY)] ?? null;
    const run = async () => {
      const [{ insertFiles }, { kindOf }] = await Promise.all([import('../media/actions.ts'), import('../media/store.ts')]);
      const files = dropped.filter((f) => kindOf(f));
      if (!files.length) return;
      await this.app.history.transact(files.length > 1 ? 'Media' : 'New Slide', () => this.keeping('New Slide', async () => {
        const slide = await this.app.doc.insertSlide('figure', before);
        this.select([slide], slide);
        await insertFiles(this.app, files, slide.querySelector('.plate'));
      }));
    };
    run().catch((e) => this.app.fail(e));
  }

  // a drop moves the slides of the drag to its gap through the command slide.moveTo, as one entry
  private endDrag(dropped: boolean): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.drop.hidden = true;
    d.ghost?.remove();
    for (const r of this.rows.values()) r.el.classList.remove('dragged');
    if (!d.on) return;
    this.eatClick = true;
    setTimeout(() => (this.eatClick = false), 0);
    if (!dropped || d.gap < 0) return;
    const list = this.slides();
    const order = droppedOrder(list, d.slides, d.gap);
    if (order.every((s, i) => s === list[i])) return;
    const arg: MoveTo = { slides: d.slides, gap: d.gap };
    void this.app.commands.run('slide.moveTo', arg).catch((e) => this.app.fail(e));
  }

  private hidePeek(): void {
    clearTimeout(this.timer);
    this.peek.hidden = true;
    this.peek.replaceChildren();
  }

  // a clone of the slide, scaled into the preview from its upper left, with every step shown. the
  // canvases of a backdrop are painted from the originals, since a cloned canvas is blank, and a
  // tycho viewer is left out, since its clone would start a second renderer
  private showPeek(slide: Element, row: HTMLElement): void {
    if (this.drag || isHidden(slide) || shownWhole(row)) return;
    const stage = slide.parentElement as HTMLElement;
    const width = stage.offsetWidth || 1920;
    const height = stage.offsetHeight || 1080;
    const clone = slide.cloneNode(true) as HTMLElement;
    const from = slide.querySelectorAll('canvas');
    clone.querySelectorAll('canvas').forEach((canvas, i) => {
      try {
        canvas.getContext('2d')?.drawImage(from[i], 0, 0);
      } catch {
        // a canvas of zero size is left blank
      }
    });
    clone.querySelectorAll('aside.notes').forEach((n) => n.remove());
    clone.querySelectorAll<HTMLElement>('.backdrop .lab').forEach((l) => {
      if (!l.style.left) l.remove();
    });
    clone.querySelectorAll('tycho-viewer').forEach((v) => {
      const box = document.createElement('div');
      box.className = v.className;
      box.setAttribute('style', v.getAttribute('style') ?? '');
      v.replaceWith(box);
    });
    clone.querySelectorAll('video').forEach((v) => {
      v.removeAttribute('autoplay');
      v.preload = 'none';
    });
    for (const el of [clone, ...clone.querySelectorAll('*')]) {
      for (const name of ['id', 'contenteditable', 'tabindex', 'hidden', 'aria-hidden']) el.removeAttribute(name);
      el.classList.remove('beeson-hover', 'beeson-overflow', 'current-fragment', 'past', 'future');
      if (el.classList.contains('fragment')) el.classList.add('visible');
    }
    const layers = layersOf(clone);
    showLayer(clone, layers.length > 1 ? layers[0] : null);
    clone.classList.add('present');
    clone.style.display = 'block';
    const deck = document.createElement('div');
    deck.className = 'reveal beeson-peek';
    const slides = document.createElement('div');
    slides.className = 'slides';
    slides.style.cssText = `inset: 0 auto auto 0; margin: 0; width: ${width}px; height: ${height}px; transform: scale(${PEEK_WIDTH / width}); transform-origin: 0 0;`;
    slides.append(clone);
    deck.append(slides);
    const peekHeight = (PEEK_WIDTH * height) / width;
    const top = Math.max(52, Math.min(row.getBoundingClientRect().top, innerHeight - 44 - peekHeight));
    this.peek.style.left = `${this.pane.getBoundingClientRect().right + 8}px`;
    this.peek.style.top = `${top}px`;
    this.peek.style.height = `${peekHeight}px`;
    this.peek.replaceChildren(deck);
    this.peek.hidden = false;
  }
}

// the selection follows the current slide while slides are selected, e.g. after a change of the
// slide with the keys
export function install(app: App): void {
  const nav = app.nav as Navigator;
  app.selection.listen(() => nav.refresh());
  app.listen('slide', () => {
    const current = app.current();
    if (current && app.selection.kind === 'slides' && !app.selection.items.includes(current)) nav.select([current], current);
  });
  // a press on the slide takes the keys to the canvas, also where the canvas does not take the focus
  document.addEventListener(
    'pointerdown',
    (ev) => {
      const target = ev.target instanceof Element ? ev.target : null;
      const active = document.activeElement;
      if (target?.closest('.reveal') && active instanceof HTMLElement && nav.pane.contains(active)) active.blur();
    },
    true,
  );
}
