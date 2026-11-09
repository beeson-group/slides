// a figure or a block of text is moved by dragging, as a box in PowerPoint: a figure by itself,
// and a block by the handle at its upper left, since a click into its text edits the text. the
// offset is the declaration translate of the style of the element, in slide pixels, and it is
// written into the start tag of the element at a save. the arrow keys nudge the selected element,
// and a double click on the handle puts it back

import type { Entry } from './history.ts';
import type { Pairing } from './render.ts';
import type { TagEdit, Translate } from './tags.ts';

export type Ctx = {
  pairing(): Pairing | null;
  slide(): Element | null;
  scale(): number;
  edits: Map<Element, TagEdit>;
  markDirty(): void;
  onChange(): void;
  // the slide of el is shown, for an undo from another slide
  show(el: Element): void;
  record(entry: Entry): void;
};

// the outermost of these elements under the pointer is moved, outside the notes and the backdrop
const MOVABLE = 'h1, h2, h3, p, ul, ol, dl, table, pre, blockquote, div.math, .caption, .foot, img, video, figure, .zone, .plate, .qr, tycho-viewer';
// an element without text to edit, dragged by itself. a tycho-viewer is turned by a drag, hence
// it is moved by its handle only
const BY_ITSELF = 'img, video, figure, .zone, .plate, .qr';
const OUTSIDE = 'aside.notes, .backdrop';
// a drag shorter than this, in screen pixels, is a click
const CLICK = 3;
// a dragged element snaps within this many screen pixels to an edge or the center of another
// element of the slide, of the slide itself, or of its own place in the file, unless Alt is held
const SNAP = 8;
// the nudges of one element closer than this, in ms, are one entry of the history
const PAUSE = 1000;

// the screen box of an element at its place in the file, i.e. without its offset
type Box = { left: number; top: number; width: number; height: number };

const translateOf = (el: Element): Translate => {
  const parts = ((el as HTMLElement).style.translate ?? '').split(/\s+/).map((p) => parseFloat(p));
  return { x: Number.isFinite(parts[0]) ? parts[0] : 0, y: Number.isFinite(parts[1]) ? parts[1] : 0 };
};

export class Move {
  // the dashed frame and the handle of the element under the pointer or being edited, and the
  // solid frame of the selected element
  readonly frame = document.createElement('div');
  readonly handle = document.createElement('div');
  readonly selectedFrame = document.createElement('div');
  // the guide lines at the edges that a dragged element snaps to
  readonly guideV = document.createElement('div');
  readonly guideH = document.createElement('div');
  // the offset of the element being dragged or nudged, at the lower right of its frame
  readonly offset = document.createElement('div');
  private readonly ctx: Ctx;
  private hover: Element | null = null;
  private selected: Element | null = null;
  private drag: { el: Element; x: number; y: number; from: Translate; moved: boolean; base: Box } | null = null;
  // the element whose offset is shown
  private moving: Element | null = null;
  // the run of nudges in progress: its element, the time of its last nudge, and the offset after it
  private run: { el: Element; at: number; to: Translate } | null = null;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
    this.frame.className = 'beeson-frame';
    this.selectedFrame.className = 'beeson-frame selected';
    this.handle.className = 'beeson-handle';
    this.handle.textContent = '⠿';
    this.handle.title = 'Drag to move, double-click to put back, arrow keys nudge';
    this.handle.tabIndex = 0;
    this.handle.setAttribute('role', 'button');
    this.handle.setAttribute('aria-label', 'Move the block: the arrow keys nudge it, Enter puts it back');
    this.guideV.className = 'beeson-guide v';
    this.guideH.className = 'beeson-guide h';
    this.offset.className = 'beeson-offset';
    this.frame.hidden = this.selectedFrame.hidden = this.handle.hidden = this.guideV.hidden = this.guideH.hidden = this.offset.hidden = true;
    this.handle.addEventListener('focus', () => {
      const el = this.current();
      if (el) this.select(el);
    });
    this.handle.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      this.reset();
    });
    // a figure reached with Tab is selected, and the arrow keys move it
    document.addEventListener('focusin', (ev) => {
      if (ev.target instanceof Element && ev.target.classList.contains('beeson-movable')) this.select(ev.target);
    });
    document.addEventListener('pointermove', (ev) => this.onMove(ev));
    document.addEventListener('pointerdown', (ev) => this.onDown(ev), true);
    document.addEventListener('pointerup', (ev) => this.onUp(ev), true);
    document.addEventListener('pointercancel', () => this.onUp(null), true);
    this.handle.addEventListener('dblclick', () => this.reset());
    // the native drag of an image would take the pointer
    document.addEventListener('dragstart', (ev) => {
      if (ev.target instanceof Element && this.movableOf(ev.target)) ev.preventDefault();
    });
  }

  // the element that a drag at target would move, or null
  movableOf(target: Element | null): Element | null {
    const slide = this.ctx.slide();
    const pairing = this.ctx.pairing();
    if (!target || !slide || !pairing || !slide.contains(target) || target.closest(OUTSIDE)) return null;
    let el = target.closest(MOVABLE);
    while (el) {
      const up = el.parentElement?.closest(MOVABLE) ?? null;
      if (!up || !slide.contains(up)) break;
      el = up;
    }
    return el && slide.contains(el) && pairing.elements.get(el)?.open ? el : null;
  }

  // the element that the handle is shown at: the one dragged, under the pointer, or being edited,
  // else the selected one
  current(): Element | null {
    const active = document.activeElement instanceof Element ? document.activeElement : null;
    const editing = active?.closest('[contenteditable="true"]') ?? null;
    return this.drag?.el ?? this.hover ?? this.movableOf(editing) ?? this.selected;
  }

  refresh(): void {
    if (this.selected && !this.selected.isConnected) this.selected = null;
    if (this.hover && !this.hover.isConnected) this.hover = null;
    if (this.moving && !this.moving.isConnected) this.moving = null;
    // a frame is drawn 6 px outside its element
    const place = (box: HTMLElement, el: Element) => {
      const rect = el.getBoundingClientRect();
      Object.assign(box.style, { left: `${rect.left - 6}px`, top: `${rect.top - 6}px`, width: `${rect.width + 12}px`, height: `${rect.height + 12}px` });
    };
    const selected = this.selected;
    this.selectedFrame.hidden = !selected;
    if (selected) place(this.selectedFrame, selected);
    this.offset.hidden = !this.moving;
    if (this.moving) {
      const rect = this.moving.getBoundingClientRect();
      const { x, y } = translateOf(this.moving);
      this.offset.textContent = `${x}, ${y}`;
      Object.assign(this.offset.style, { left: `${rect.right + 6}px`, top: `${rect.bottom + 10}px` });
    }
    const hot = this.current();
    this.frame.hidden = !hot || hot === selected;
    this.handle.hidden = !hot;
    if (!hot) return;
    place(this.frame, hot);
    const rect = hot.getBoundingClientRect();
    Object.assign(this.handle.style, { left: `${rect.left - 24}px`, top: `${rect.top - 24}px` });
  }

  select(el: Element | null): void {
    if (el !== this.selected) this.moving = this.run = null;
    this.selected = el;
    this.refresh();
  }

  private onMove(ev: PointerEvent): void {
    if (this.drag) {
      const scale = this.ctx.scale() || 1;
      let dx = (ev.clientX - this.drag.x) / scale;
      let dy = (ev.clientY - this.drag.y) / scale;
      // with Shift, the drag is locked to the axis of its larger offset, as in Keynote
      const lock = ev.shiftKey ? (Math.abs(dx) >= Math.abs(dy) ? 'y' : 'x') : null;
      if (lock === 'y') dy = 0;
      if (lock === 'x') dx = 0;
      let x = this.drag.from.x + dx;
      let y = this.drag.from.y + dy;
      if (Math.hypot(ev.clientX - this.drag.x, ev.clientY - this.drag.y) >= CLICK) this.drag.moved = true;
      if (this.drag.moved) {
        const snapped = ev.altKey ? null : this.snap(this.drag.el, this.drag.base, x, y, scale);
        // the locked axis is not snapped, since a snap would move the element off it
        if (snapped && lock !== 'x') x = snapped.x;
        if (snapped && lock !== 'y') y = snapped.y;
        this.guides(lock === 'x' ? null : (snapped?.gx ?? null), lock === 'y' ? null : (snapped?.gy ?? null));
        (this.drag.el as HTMLElement).style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
        this.moving = this.drag.el;
      }
      this.refresh();
      this.ctx.onChange();
      return;
    }
    const target = ev.target instanceof Element ? ev.target : null;
    if (target === this.handle || target === this.frame) return;
    const el = this.movableOf(target);
    if (el) {
      if (el !== this.hover) {
        this.hover = el;
        this.refresh();
      }
    } else if (this.hover && !this.near(this.hover, ev)) {
      this.hover = null;
      this.refresh();
    }
  }

  // whether the pointer is over el or over the room for its handle, so that the handle is reached
  private near(el: Element, ev: PointerEvent): boolean {
    const r = el.getBoundingClientRect();
    return ev.clientX >= r.left - 28 && ev.clientX <= r.right + 4 && ev.clientY >= r.top - 28 && ev.clientY <= r.bottom + 4;
  }

  private onDown(ev: PointerEvent): void {
    if (ev.button !== 0) return;
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    let el: Element | null = null;
    if (target === this.handle) el = this.current();
    else if (target.closest(BY_ITSELF) && !target.closest('[contenteditable="true"]')) el = this.movableOf(target);
    if (!el) {
      this.select(null);
      return;
    }
    ev.preventDefault();
    this.run = null;
    const from = translateOf(el);
    const scale = this.ctx.scale() || 1;
    const r = el.getBoundingClientRect();
    this.drag = { el, x: ev.clientX, y: ev.clientY, from, moved: false, base: { left: r.left - from.x * scale, top: r.top - from.y * scale, width: r.width, height: r.height } };
    document.documentElement.classList.add('beeson-dragging');
  }

  private onUp(ev: PointerEvent | null): void {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    this.moving = null;
    document.documentElement.classList.remove('beeson-dragging');
    this.guides(null, null);
    if (ev && drag.moved) this.commit(drag.el, drag.from);
    this.select(drag.el);
  }

  // the offset x, y moved to the nearest edge or center of another element of the slide, of the
  // slide, or of the place of el in the file, within SNAP screen pixels of an edge or the center of
  // el, as the alignment guides of Keynote and PowerPoint. gx and gy are the screen coordinates
  // of the lines snapped to
  private snap(el: Element, base: Box, x: number, y: number, scale: number): { x: number; y: number; gx: number | null; gy: number | null } | null {
    const slide = this.ctx.slide();
    const pairing = this.ctx.pairing();
    if (!slide || !pairing) return null;
    const box = slide.getBoundingClientRect();
    const xs = [box.left, box.left + box.width / 2, box.right, base.left];
    const ys = [box.top, box.top + box.height / 2, box.bottom, base.top];
    for (const other of slide.querySelectorAll(MOVABLE)) {
      if (other === el || other.contains(el) || el.contains(other) || other.closest(OUTSIDE) || !pairing.elements.get(other)?.open) continue;
      const up = other.parentElement?.closest(MOVABLE);
      if (up && slide.contains(up)) continue;
      const r = other.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      xs.push(r.left, r.left + r.width / 2, r.right);
      ys.push(r.top, r.top + r.height / 2, r.bottom);
    }
    const nearest = (edges: number[], targets: number[]) => {
      let best: { d: number; shift: number; to: number } | null = null;
      for (const edge of edges) {
        for (const to of targets) {
          const d = Math.abs(to - edge);
          if (d <= SNAP && (!best || d < best.d)) best = { d, shift: to - edge, to };
        }
      }
      return best;
    };
    const left = base.left + x * scale, top = base.top + y * scale;
    const bx = nearest([left, left + base.width / 2, left + base.width], xs);
    const by = nearest([top, top + base.height / 2, top + base.height], ys);
    return { x: bx ? x + bx.shift / scale : x, y: by ? y + by.shift / scale : y, gx: bx?.to ?? null, gy: by?.to ?? null };
  }

  // the guide lines across the slide at the screen coordinates snapped to, or none
  private guides(gx: number | null, gy: number | null): void {
    const box = this.ctx.slide()?.getBoundingClientRect();
    this.guideV.hidden = gx === null || !box;
    this.guideH.hidden = gy === null || !box;
    if (!box) return;
    if (gx !== null) Object.assign(this.guideV.style, { left: `${gx}px`, top: `${box.top}px`, height: `${box.height}px` });
    if (gy !== null) Object.assign(this.guideH.style, { top: `${gy}px`, left: `${box.left}px`, width: `${box.width}px` });
  }

  // a figure, which has no text to click into, is put into the tab order, so that it is selected
  // with Tab and moved with the arrow keys
  mark(pairing: Pairing | null): void {
    for (const el of document.querySelectorAll('.beeson-movable')) {
      el.classList.remove('beeson-movable');
      el.removeAttribute('tabindex');
    }
    if (!pairing) return;
    for (const [el, src] of pairing.elements) {
      if (!src.open || !el.matches(BY_ITSELF) || el.closest(OUTSIDE)) continue;
      const up = el.parentElement?.closest(MOVABLE);
      if (up && el.closest('section')?.contains(up)) continue;
      el.classList.add('beeson-movable');
      el.setAttribute('tabindex', '0');
      if (!el.hasAttribute('aria-label') && !el.hasAttribute('alt')) el.setAttribute('aria-label', 'Figure: the arrow keys move it, Esc deselects it');
    }
  }

  // the offset on the page is written into the edits, and the move from the former offset is one
  // entry of the history
  private commit(el: Element, from: Translate): void {
    const to = translateOf(el);
    this.set(el, to);
    if (from.x === to.x && from.y === to.y) return;
    this.ctx.record({ label: 'move', undo: () => this.apply(el, from), redo: () => this.apply(el, to) });
  }

  private apply(el: Element, t: Translate): void {
    this.run = null;
    this.ctx.show(el);
    (el as HTMLElement).style.translate = t.x === 0 && t.y === 0 ? '' : `${t.x}px ${t.y}px`;
    this.set(el, t);
    this.select(el);
  }

  private set(el: Element, { x, y }: Translate): void {
    this.ctx.edits.set(el, { ...this.ctx.edits.get(el), translate: x === 0 && y === 0 ? null : { x, y } });
    this.ctx.markDirty();
    this.refresh();
    this.ctx.onChange();
  }

  // the selected element is nudged by one slide pixel, or ten with Shift, while no text or field
  // is typed into and no list has the focus. a run of nudges is one entry of the history, whose
  // destination each nudge moves, until a pause, a drag, Escape, or another selection ends it
  onKey(ev: KeyboardEvent): boolean {
    const el = this.selected;
    const active = document.activeElement;
    if (!el || active?.closest('[contenteditable="true"], input, select, textarea, .beeson-edit-nav, .beeson-edit-side, .beeson-math')) return false;
    if (ev.key === 'Escape') {
      if (active instanceof HTMLElement && (active === el || active === this.handle)) active.blur();
      this.select(null);
      return true;
    }
    const step = ev.shiftKey ? 10 : 1;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const d = delta[ev.key];
    if (!d || ev.metaKey || ev.ctrlKey || ev.altKey) return false;
    const from = translateOf(el);
    const to = { x: from.x + d[0], y: from.y + d[1] };
    (el as HTMLElement).style.translate = `${to.x}px ${to.y}px`;
    this.moving = el;
    const now = performance.now();
    if (this.run && this.run.el === el && now - this.run.at < PAUSE) {
      Object.assign(this.run, { at: now, to });
      this.set(el, to);
      return true;
    }
    const run = { el, at: now, to };
    this.set(el, to);
    this.ctx.record({ label: 'move', undo: () => this.apply(el, from), redo: () => this.apply(el, run.to) });
    this.run = run;
    return true;
  }

  private reset(): void {
    const el = this.current();
    if (!el) return;
    this.run = null;
    const from = translateOf(el);
    (el as HTMLElement).style.translate = '';
    this.commit(el, from);
  }
}
