// the slide sorter, as the light table of Keynote: the slides as a grid of thumbnails over the
// navigator and the slide, in groups headed by the section slides. the slides before the first
// section slide are the opening, and the slides after the closing slide the appendix. a group is
// collapsed with the triangle of its head, or with Return on its head. a click on a head selects
// the slides of its group, as a section of PowerPoint. the head of a section slide is dragged
// between the groups to move the section through slide.moveSection, and a double click on its name
// renames the section through slide.renameSection. a click selects a slide, Shift a range, and the
// command modifier one more slide. a drag moves the selected slides through slide.moveTo, Return or
// a double click shows a slide on the canvas and closes the sorter, and Esc closes it. the size of
// the thumbnails and the choice to leave out the hidden slides are kept in the storage of the
// browser

import type { App } from '../app.ts';
import { injectStyle, make, stored, store } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { transitionOf } from '../review/transitions.ts';
import type { MoveSection, RenameSection } from '../commands/slide.ts';
import { describe, droppedOrder, isHidden, type MoveTo, type Navigator } from './navigator.ts';
import { Thumbs } from './thumbs.ts';

const SIZE_KEY = 'beeson-sorter-size';
const HIDE_KEY = 'beeson-sorter-hide';
const MIN = 120;
const MAX = 360;
const DEFAULT = 220;
// the distance in CSS px by which a press is moved before it is a drag
const DRAG_START = 4;

type Group = { key: string; head: Element | null; title: string; slides: Element[] };
type Tile = { el: HTMLButtonElement; pic: HTMLElement; no: HTMLElement; corner: HTMLElement; dots: HTMLElement };
type Drag = { slides: Element[]; x: number; y: number; on: boolean; gap: number; head?: Element };

const CSS = `
html.beeson-editor body > .beeson-edit-sorter, .beeson-edit-sorter { grid-area: 2 / 1 / 4 / 3; position: relative; z-index: 55; display: flex; flex-direction: column; min-height: 0; background: var(--ed-canvas); color: var(--ed-text); font: 12px/1.35 var(--ed-font); --tile-w: 220px; }
.beeson-edit-sorter[hidden] { display: none; }
.beeson-edit-sorter .groups { position: relative; flex: 1 1 auto; min-height: 0; overflow: auto; padding: 8px 24px 24px; outline: none; }
.beeson-edit-sorter .head { display: flex; align-items: center; gap: 6px; width: 100%; height: 30px; margin: 10px 0 6px; padding: 0 6px 0 2px; border: 0; border-bottom: 1px solid var(--ed-line); border-radius: 0; background: transparent; color: var(--ed-text); font: 600 13px/1 var(--ed-font); text-align: left; cursor: default; }
.beeson-edit-sorter .head:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 1px; }
.beeson-edit-sorter .head.section { touch-action: none; }
.beeson-edit-sorter .head.picked .name { color: var(--ed-select); }
.beeson-edit-sorter .head.dragged { opacity: 0.35; }
.beeson-edit-sorter .rename { position: absolute; z-index: 1; height: 22px; margin: 0; padding: 0 4px; box-sizing: border-box; border: 1px solid var(--ed-focus); border-radius: 4px; outline: 2px solid var(--ed-focus); outline-offset: 0; background: var(--ed-control); color: var(--ed-text); font: 600 13px/1 var(--ed-font); }
.beeson-edit-sorter .head svg { flex: none; color: var(--ed-muted); transition: transform 120ms; }
.beeson-edit-sorter .head[aria-expanded="true"] svg { transform: rotate(90deg); }
.beeson-edit-sorter .head .n { color: var(--ed-muted); font-weight: 400; }
.beeson-edit-sorter .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--tile-w), var(--tile-w))); gap: 18px 22px; padding: 6px 4px 8px; }
.beeson-edit-sorter .tiles[hidden] { display: none; }
.beeson-edit-sorter .tile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; cursor: default; touch-action: none; }
.beeson-edit-sorter .tile:focus-visible { outline: none; }
.beeson-edit-sorter .tile .frame { position: relative; width: var(--tile-w); border-radius: 4px; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25); outline: 1px solid var(--ed-line); }
.beeson-edit-sorter .tile .pic { display: block; aspect-ratio: 16 / 9; border-radius: 4px; overflow: hidden; background: var(--bg, #000); }
.beeson-edit-sorter .tile .no { margin-top: 6px; min-width: 28px; padding: 2px 8px; border-radius: 9px; color: var(--ed-muted); text-align: center; font-variant-numeric: tabular-nums; line-height: 1.3; }
.beeson-edit-sorter .tile[aria-selected="true"] .frame { outline: 4px solid var(--ed-select); outline-offset: 2px; }
.beeson-edit-sorter .tile[aria-selected="true"] .no { background: var(--ed-select); color: var(--ed-on-select); font-weight: 600; }
.beeson-edit-sorter .tile:focus-visible .frame { box-shadow: 0 0 0 9px var(--ed-focus); }
.beeson-edit-sorter .tile.hidden-slide .pic { opacity: 0.4; }
.beeson-edit-sorter .tile.hidden-slide .no { text-decoration: line-through; }
.beeson-edit-sorter .tile .corner { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; border-bottom-right-radius: 4px; background: linear-gradient(135deg, transparent 50%, var(--ed-panel) 50%); box-shadow: -1px -1px 2px rgba(0, 0, 0, 0.25); pointer-events: none; }
.beeson-edit-sorter .tile .corner[hidden], .beeson-edit-sorter .tile .dots[hidden] { display: none; }
.beeson-edit-sorter .tile .dots { position: absolute; left: 7px; bottom: 6px; display: flex; gap: 3px; pointer-events: none; }
.beeson-edit-sorter .tile .dots i { width: 5px; height: 5px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45); }
.beeson-edit-sorter .tile.dragged { opacity: 0.35; }
.beeson-edit-sorter .drop { position: absolute; width: 4px; margin-left: -2px; border-radius: 2px; background: var(--ed-select); pointer-events: none; }
.beeson-edit-sorter .drop[hidden] { display: none; }
.beeson-edit-sorter .drop.across { width: auto; height: 4px; margin: -2px 0 0; }
.beeson-edit-sorter .bar { flex: none; display: flex; align-items: center; gap: 14px; height: 36px; padding: 0 16px; border-top: 1px solid var(--ed-line); background: var(--ed-panel); color: var(--ed-text); }
.beeson-edit-sorter .bar label { display: inline-flex; align-items: center; gap: 6px; }
.beeson-edit-sorter .bar .count { color: var(--ed-muted); }
.beeson-edit-sorter .bar .size { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; color: var(--ed-muted); }
.beeson-edit-sorter .bar input[type="range"] { width: 140px; accent-color: var(--ed-select); }
.beeson-edit-sorter .bar input[type="checkbox"] { accent-color: var(--ed-select); }
.beeson-edit-sorter .bar .done { height: 24px; padding: 0 12px; border: 1px solid var(--ed-control-line); border-radius: 6px; background: var(--ed-control); color: var(--ed-text); font: inherit; }
.beeson-edit-sorter .bar .done:focus-visible, .beeson-edit-sorter .bar input:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 1px; }
`;

// the groups of slides, each headed by a section slide, with the opening before the first one and
// the appendix after the closing slide
export function groupsOf(slides: Element[]): Group[] {
  const out: Group[] = [];
  let group: Group = { key: 'opening', head: null, title: 'Opening', slides: [] };
  let appendix = false;
  for (const s of slides) {
    if (!appendix && s.classList.contains('section')) {
      if (group.slides.length) out.push(group);
      group = { key: '', head: s, title: describe(s).title, slides: [] };
    }
    group.slides.push(s);
    if (!appendix && s.classList.contains('closing')) {
      out.push(group);
      appendix = true;
      group = { key: 'appendix', head: null, title: 'Appendix', slides: [] };
    }
  }
  if (group.slides.length) out.push(group);
  return out;
}

// the heading of a section slide, which names its section
export const sectionHeading = (slide: Element): HTMLElement | null =>
  [...slide.querySelectorAll<HTMLElement>('h1, h2')].find((h) => !h.closest('aside.notes, .backdrop')) ?? null;

// the children of parent made want, with a node moved only where the order differs
function putChildren(parent: HTMLElement, want: Element[]): void {
  const now = [...parent.children];
  if (now.length === want.length && now.every((c, i) => c === want[i])) return;
  for (const c of now) if (!want.includes(c)) c.remove();
  let prev: Element | null = null;
  for (const el of want) {
    const at: Element | null = prev ? prev.nextElementSibling : parent.firstElementChild;
    if (at !== el) parent.insertBefore(el, at);
    prev = el;
  }
}

export class Sorter {
  readonly el = make('div', 'beeson-edit-sorter');
  private readonly app: App;
  private readonly scroller = make('div', 'groups');
  private readonly drop = make('div', 'drop');
  private readonly count = make('span', 'count');
  private readonly hide = make('input');
  private readonly slider = make('input');
  private readonly tiles = new Map<Element, Tile>();
  private readonly closed = new Set<Element | string>();
  private readonly groups = new Map<Element | string, { head: HTMLButtonElement; title: HTMLElement; count: HTMLElement; box: HTMLElement; slides: Element[] }>();
  private renaming: HTMLInputElement | null = null;
  private thumbs: Thumbs | null = null;
  private anchor: Element | null = null;
  private drag: Drag | null = null;
  private eatClick = false;

  constructor(app: App) {
    this.app = app;
    injectStyle('sorter', CSS);
    this.el.hidden = true;
    this.el.setAttribute('aria-label', 'Light Table');
    this.scroller.setAttribute('role', 'listbox');
    this.scroller.setAttribute('aria-multiselectable', 'true');
    this.scroller.setAttribute('aria-label', 'Slides');
    this.drop.hidden = true;
    const bar = make('div', 'bar');
    const hideLabel = make('label');
    this.hide.type = 'checkbox';
    this.hide.checked = stored(HIDE_KEY) === '1';
    this.hide.addEventListener('change', () => {
      store(HIDE_KEY, this.hide.checked ? '1' : null);
      this.refresh();
    });
    hideLabel.append(this.hide, document.createTextNode('Hide Skipped Slides'));
    const size = make('label', 'size');
    this.slider.type = 'range';
    this.slider.min = String(MIN);
    this.slider.max = String(MAX);
    this.slider.step = '10';
    this.slider.value = String(Math.min(MAX, Math.max(MIN, Number(stored(SIZE_KEY)) || DEFAULT)));
    this.slider.setAttribute('aria-label', 'Size of the thumbnails');
    this.slider.addEventListener('input', () => {
      store(SIZE_KEY, this.slider.value);
      this.measure();
    });
    size.append(icon('slide', 14), this.slider, icon('slide', 20));
    const done = make('button', 'done', 'Done');
    done.type = 'button';
    done.title = 'Close the light table';
    done.addEventListener('click', () => this.toggle(false));
    bar.append(hideLabel, this.count, size, done);
    this.scroller.append(this.drop);
    this.el.append(this.scroller, bar);
    this.scroller.addEventListener('keydown', (ev) => this.onKey(ev));
    this.scroller.addEventListener('pointerdown', (ev) => this.onDown(ev));
    app.onRefresh(['content', 'structure', 'slide', 'selection'], () => {
      if (!this.el.hidden) this.refresh();
    });
  }

  get shown(): boolean {
    return !this.el.hidden;
  }

  toggle(on = this.el.hidden): void {
    if (!this.el.isConnected) document.body.append(this.el);
    if (!this.thumbs) {
      this.thumbs = new Thumbs(this.app, this.scroller);
      const thumbs = this.thumbs;
      new MutationObserver(() => thumbs.all()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
    this.el.hidden = !on;
    if (on) {
      this.refresh();
      this.measure();
      this.focus();
    } else {
      this.thumbs.setHosts(new Map());
      const current = this.app.current();
      (this.app.nav as Navigator).focus(current);
    }
    this.app.relayout();
  }

  private measure(): void {
    const w = Number(this.slider.value) || DEFAULT;
    this.el.style.setProperty('--tile-w', `${w}px`);
    this.thumbs?.setWidth(w);
  }

  private slides(): Element[] {
    return [...this.app.slides().querySelectorAll(':scope > section')];
  }

  // the slides shown, in the order of the deck, without the hidden ones when they are left out
  private shownSlides(): Element[] {
    return this.slides().filter((s) => !(this.hide.checked && isHidden(s)) && this.tiles.get(s)?.el.isConnected && !this.tiles.get(s)?.el.closest('[hidden]'));
  }

  selected(): Element[] {
    return (this.app.nav as Navigator).selected();
  }

  // the groups and tiles follow the slides, their positions as in the status bar, their
  // transitions, steps, and hidden state, and the selection. a tile is kept with its thumbnail
  // while its slide is on the page
  refresh(): void {
    const slides = this.slides();
    const kept = new Set(slides);
    for (const s of [...this.tiles.keys()]) if (!kept.has(s)) this.tiles.delete(s);
    const picked = new Set(this.app.selection.kind === 'slides' ? this.app.selection.items : [this.app.current()]);
    const current = this.app.current();
    const parts: HTMLElement[] = [];
    const groups = groupsOf(slides);
    const keys = new Set(groups.map((g) => g.head ?? g.key));
    for (const k of [...this.groups.keys()]) if (!keys.has(k)) this.groups.delete(k);
    for (const g of groups) {
      const key = g.head ?? g.key;
      const open = !this.closed.has(key);
      const list = g.slides.filter((s) => !(this.hide.checked && isHidden(s)));
      const group = this.groups.get(key) ?? this.makeGroup(key);
      const { head, title, count, box } = group;
      group.slides = g.slides;
      head.setAttribute('aria-expanded', String(open));
      head.classList.toggle('picked', list.length > 0 && list.every((s) => picked.has(s)));
      title.textContent = g.title;
      count.textContent = `${list.length} ${list.length === 1 ? 'slide' : 'slides'}`;
      box.hidden = !open;
      const want: HTMLElement[] = [];
      for (const s of list) {
        const i = slides.indexOf(s);
        const t = this.tiles.get(s) ?? this.makeTile(s);
        this.tiles.set(s, t);
        const { title } = describe(s);
        const hidden = isHidden(s);
        t.no.textContent = String(i + 1);
        t.el.classList.toggle('hidden-slide', hidden);
        t.el.setAttribute('aria-selected', String(picked.has(s)));
        t.el.tabIndex = s === current ? 0 : -1;
        t.el.setAttribute('aria-label', `Slide ${i + 1}: ${title}${hidden ? ', hidden' : ''}`);
        t.el.title = `Slide ${i + 1}: ${title}`;
        const transition = transitionOf(this.app, s);
        t.corner.hidden = transition === 'fade';
        t.corner.title = transition === 'magic' ? 'Magic Move' : transition === 'none' ? 'No transition' : '';
        t.dots.hidden = ![...s.querySelectorAll('.fragment')].some((f) => !f.closest('aside.notes'));
        want.push(t.el);
      }
      putChildren(box, want);
      parts.push(head, box);
    }
    // the nodes are moved only where their order changed, since a move takes the focus off a tile
    const had = document.activeElement instanceof HTMLElement && this.scroller.contains(document.activeElement) ? document.activeElement : null;
    putChildren(this.scroller, [...parts, this.drop, ...(this.renaming ? [this.renaming] : [])]);
    if (had?.isConnected && document.activeElement !== had) had.focus({ preventScroll: true });
    this.count.textContent = `${slides.length} ${slides.length === 1 ? 'slide' : 'slides'}`;
    const hosts = new Map<Element, HTMLElement>();
    for (const [s, t] of this.tiles) if (t.el.isConnected && !t.el.parentElement?.hidden) hosts.set(s, t.pic);
    this.thumbs?.setHosts(hosts);
  }

  private makeGroup(key: Element | string) {
    const head = make('button', 'head');
    head.type = 'button';
    const title = make('span', 'name');
    const count = make('span', 'n');
    const triangle = icon('chevron-right', 14);
    head.append(triangle, title, count);
    const group = { head, title, count, box: make('div', 'tiles'), slides: [] as Element[] };
    // a key or a click on the triangle collapses the group, and a click elsewhere selects its slides
    head.addEventListener('click', (ev) => {
      if (this.eatClick) {
        this.eatClick = false;
        return;
      }
      if (ev.detail === 0 || triangle.contains(ev.target as Node)) {
        if (this.closed.has(key)) this.closed.delete(key);
        else this.closed.add(key);
        return this.refresh();
      }
      const list = group.slides.filter((s) => !(this.hide.checked && isHidden(s)));
      if (list.length) this.select(list, list[0], list[0]);
      head.focus({ preventScroll: true });
    });
    if (key instanceof Element) {
      head.classList.add('section');
      head.title = 'Drag to move the section, or double-click its name to rename it';
      title.addEventListener('dblclick', () => this.rename(key, title));
      head.addEventListener('pointerdown', (ev) => this.onHeadDown(key, ev));
    }
    this.groups.set(key, group);
    return group;
  }

  // a field over the name of the section of head, a section slide, whose text is written into its
  // heading with Return or when it is left, and dropped with Esc
  private rename(head: Element, name: HTMLElement): void {
    const h = sectionHeading(head);
    if (!h || this.renaming) return;
    const field = make('input', 'rename');
    field.type = 'text';
    field.value = (h.textContent ?? '').replace(/\s+/g, ' ').trim();
    field.setAttribute('aria-label', 'Section name');
    const at = name.getBoundingClientRect();
    const box = this.scroller.getBoundingClientRect();
    Object.assign(field.style, {
      left: `${at.left - box.left + this.scroller.scrollLeft - 5}px`,
      top: `${at.top + at.height / 2 - 11 - box.top + this.scroller.scrollTop}px`,
      width: `${Math.max(160, at.width + 40)}px`,
    });
    let done = false;
    const finish = (keep: boolean) => {
      if (done) return;
      done = true;
      this.renaming = null;
      const text = field.value;
      field.remove();
      this.groups.get(head)?.head.focus({ preventScroll: true });
      if (!keep) return;
      const arg: RenameSection = { head, text };
      void this.app.commands
        .run('slide.renameSection', arg)
        .then(() => {
          this.app.flush();
          this.refresh();
        })
        .catch((e) => this.app.fail(e));
    };
    field.addEventListener('keydown', (ev) => {
      if (ev.isComposing) return;
      // the keys of the field stay with it, apart from the command keys of the editor
      if (!ev.metaKey && !ev.ctrlKey) ev.stopPropagation();
      if (ev.key === 'Enter' || ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        finish(ev.key === 'Enter');
      }
    });
    field.addEventListener('blur', () => finish(true));
    field.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    this.scroller.append(field);
    this.renaming = field;
    field.focus();
    field.select();
  }

  private makeTile(slide: Element): Tile {
    const el = make('button', 'tile');
    el.type = 'button';
    el.setAttribute('role', 'option');
    el.dataset.context = 'slide';
    const frame = make('span', 'frame');
    const pic = make('span', 'pic');
    const corner = make('span', 'corner');
    const dots = make('span', 'dots');
    dots.append(make('i'), make('i'), make('i'));
    frame.append(pic, dots, corner);
    const no = make('span', 'no');
    el.append(frame, no);
    el.addEventListener('click', (ev) => this.onClick(slide, ev));
    el.addEventListener('dblclick', () => this.open(slide));
    el.addEventListener('contextmenu', () => {
      if (!this.selected().includes(slide)) this.select([slide], slide);
    });
    return { el, pic, no, corner, dots };
  }

  private select(slides: Element[], current: Element | null, anchor: Element | null = current): void {
    (this.app.nav as Navigator).select(slides, current, anchor);
    this.anchor = anchor;
    this.app.flush();
    this.refresh();
  }

  focus(slide: Element | null = this.app.current()): void {
    const tile = slide ? this.tiles.get(slide) : null;
    if (!tile?.el.isConnected) return;
    tile.el.focus({ preventScroll: true });
    tile.el.scrollIntoView({ block: 'nearest' });
  }

  // the slide shown on the canvas, with the sorter closed
  open(slide: Element): void {
    this.select([slide], slide);
    this.toggle(false);
  }

  private onClick(slide: Element, ev: MouseEvent): void {
    if (this.eatClick) {
      this.eatClick = false;
      return;
    }
    const mod = this.app.platform === 'mac' ? ev.metaKey : ev.ctrlKey;
    const now = this.selected();
    if (ev.shiftKey && this.anchor) {
      const list = this.shownSlides();
      const [a, b] = [list.indexOf(this.anchor), list.indexOf(slide)].sort((x, y) => x - y);
      if (a >= 0) return this.select(list.slice(a, b + 1), slide, this.anchor);
    }
    if (mod) {
      const next = now.includes(slide) ? now.filter((s) => s !== slide) : [...now, slide];
      if (next.length) return this.select(this.slides().filter((s) => next.includes(s)), slide, slide);
      return;
    }
    this.select([slide], slide);
    this.focus(slide);
  }

  // the number of tiles in a row of the grid of slide
  private columns(slide: Element): number {
    const box = this.tiles.get(slide)?.el.parentElement;
    if (!box) return 1;
    const tops = [...box.children].map((c) => (c as HTMLElement).offsetTop);
    return Math.max(1, tops.filter((t) => t === tops[0]).length);
  }

  private onKey(ev: KeyboardEvent): void {
    if (ev.target instanceof HTMLInputElement || ev.altKey || ev.metaKey || ev.ctrlKey) return;
    const target = ev.target instanceof Element ? ev.target.closest('.tile') : null;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      return this.toggle(false);
    }
    if (!target) return;
    const list = this.shownSlides();
    const slide = [...this.tiles].find(([, t]) => t.el === target)?.[0] ?? null;
    if (!slide) return;
    const i = list.indexOf(slide);
    if (ev.key === 'Enter') {
      ev.preventDefault();
      return this.open(slide);
    }
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      ev.preventDefault();
      void this.app.commands
        .run('slide.delete')
        .then(() => {
          this.app.flush();
          this.refresh();
          this.focus();
        })
        .catch((e) => this.app.fail(e));
      return;
    }
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -this.columns(slide), ArrowDown: this.columns(slide), Home: -i, End: list.length - 1 - i }[ev.key];
    if (step === undefined) return;
    ev.preventDefault();
    const next = list[Math.max(0, Math.min(list.length - 1, i + step))];
    if (!next) return;
    if (ev.shiftKey) {
      const anchor = this.anchor && list.includes(this.anchor) ? this.anchor : slide;
      const [a, b] = [list.indexOf(anchor), list.indexOf(next)].sort((x, y) => x - y);
      this.select(list.slice(a, b + 1), next, anchor);
    } else this.select([next], next);
    this.focus(next);
  }

  // a drag of a tile moves the selected slides, or the slide of the tile when it is not selected
  private onDown(ev: PointerEvent): void {
    if (ev.button !== 0 || (this.app.platform === 'mac' && ev.ctrlKey)) return;
    const tile = ev.target instanceof Element ? ev.target.closest('.tile') : null;
    const slide = tile && [...this.tiles].find(([, t]) => t.el === tile)?.[0];
    if (!slide || ev.shiftKey || ev.metaKey || ev.ctrlKey) return;
    const now = this.selected();
    this.drag = { slides: now.includes(slide) ? now : [slide], x: ev.clientX, y: ev.clientY, on: false, gap: -1 };
    const move = (e: PointerEvent) => this.onMove(e);
    const up = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      this.onUp();
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  }

  // a drag of the head of a section slide moves the section, i.e. the slides of its group
  private onHeadDown(head: Element, ev: PointerEvent): void {
    if (ev.button !== 0 || (this.app.platform === 'mac' && ev.ctrlKey) || ev.shiftKey || ev.metaKey || ev.ctrlKey || this.renaming) return;
    const slides = this.groups.get(head)?.slides ?? [];
    if (!slides.length) return;
    this.drag = { slides, x: ev.clientX, y: ev.clientY, on: false, gap: -1, head };
    const move = (e: PointerEvent) => this.onMove(e);
    const up = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      this.onUp();
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  }

  // the gap of a section is the start of the group whose head is nearest the pointer, or the end of
  // the deck below the last group, drawn as a line across the light table
  private onHeadMove(ev: PointerEvent, d: Drag): void {
    const all = this.slides();
    const box = this.scroller.getBoundingClientRect();
    const spots: { gap: number; y: number }[] = [];
    let last: HTMLElement | null = null;
    for (const g of groupsOf(all)) {
      const parts = this.groups.get(g.head ?? g.key);
      if (!parts?.head.isConnected) continue;
      spots.push({ gap: all.indexOf(g.slides[0]), y: parts.head.getBoundingClientRect().top - 4 });
      last = parts.box.hidden || !parts.box.childElementCount ? parts.head : parts.box;
    }
    if (last) spots.push({ gap: all.length, y: last.getBoundingClientRect().bottom + 4 });
    const best = spots.reduce<{ gap: number; y: number } | null>((b, s) => (!b || Math.abs(s.y - ev.clientY) < Math.abs(b.y - ev.clientY) ? s : b), null);
    if (!best) return;
    d.gap = best.gap;
    const pad = parseFloat(getComputedStyle(this.scroller).paddingLeft) || 0;
    Object.assign(this.drop.style, { left: `${pad}px`, right: `${pad}px`, top: `${best.y - box.top + this.scroller.scrollTop}px`, height: '' });
    this.drop.classList.add('across');
    this.drop.hidden = false;
  }

  private onMove(ev: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    if (!d.on) {
      if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < DRAG_START) return;
      d.on = true;
      for (const s of d.slides) this.tiles.get(s)?.el.classList.add('dragged');
      if (d.head) this.groups.get(d.head)?.head.classList.add('dragged');
    }
    ev.preventDefault();
    if (d.head) {
      this.onHeadMove(ev, d);
      return this.scrollNear(ev);
    }
    // the gap is before the tile under the pointer, or after it past its middle, in the order of
    // the deck
    const all = this.slides();
    const list = this.shownSlides();
    let best: { s: Element; r: DOMRect; dist: number } | null = null;
    for (const s of list) {
      const r = this.tiles.get(s)!.el.getBoundingClientRect();
      const dy = ev.clientY < r.top ? r.top - ev.clientY : ev.clientY > r.bottom ? ev.clientY - r.bottom : 0;
      const dx = ev.clientX < r.left ? r.left - ev.clientX : ev.clientX > r.right ? ev.clientX - r.right : 0;
      const dist = dy * 4 + dx;
      if (!best || dist < best.dist) best = { s, r, dist };
    }
    if (!best) return;
    const after = ev.clientX > best.r.left + best.r.width / 2;
    d.gap = all.indexOf(best.s) + (after ? 1 : 0);
    const box = this.scroller.getBoundingClientRect();
    const x = (after ? best.r.right + 11 : best.r.left - 11) - box.left + this.scroller.scrollLeft;
    Object.assign(this.drop.style, { left: `${x}px`, right: '', top: `${best.r.top - box.top + this.scroller.scrollTop}px`, height: `${best.r.height - 24}px` });
    this.drop.classList.remove('across');
    this.drop.hidden = false;
    this.scrollNear(ev);
  }

  // the light table scrolled while a drag is near its top or its bottom
  private scrollNear(ev: PointerEvent): void {
    const r = this.scroller.getBoundingClientRect();
    if (ev.clientY < r.top + 28) this.scroller.scrollTop -= 12;
    else if (ev.clientY > r.bottom - 28) this.scroller.scrollTop += 12;
  }

  private onUp(): void {
    const d = this.drag;
    this.drag = null;
    this.drop.hidden = true;
    for (const t of this.tiles.values()) t.el.classList.remove('dragged');
    for (const g of this.groups.values()) g.head.classList.remove('dragged');
    if (!d?.on || d.gap < 0) return;
    this.eatClick = true;
    window.setTimeout(() => (this.eatClick = false), 0);
    const head = d.head;
    if (head) {
      const all = this.slides();
      if (droppedOrder(all, d.slides, d.gap).every((s, i) => s === all[i])) return;
      const arg: MoveSection = { head, gap: d.gap };
      void this.app.commands
        .run('slide.moveSection', arg)
        .then(() => {
          this.app.flush();
          this.refresh();
          this.groups.get(head)?.head.focus({ preventScroll: true });
        })
        .catch((e) => this.app.fail(e));
      return;
    }
    const arg: MoveTo = { slides: d.slides, gap: d.gap };
    void this.app.commands
      .run('slide.moveTo', arg)
      .then(() => {
        this.app.flush();
        this.refresh();
        this.focus(d.slides.at(-1) ?? null);
      })
      .catch((e) => this.app.fail(e));
  }
}
