// the hover and selection frames, the eight resize handles, the rotate handle, the handle of a
// block, the readout at the pointer, the guides and the marks of equal gaps and sizes, and the
// marquee, in one layer over the canvas
// clipped to the canvas cell of the stage, so that a handle at the edge of the slide is drawn on
// the pasteboard and none is drawn over the bars at a zoom. the frames are drawn in screen pixels
// from the live boxes of the elements, and the guides from slide pixels by the live scale. the frame
// and the handles of a rotated element are turned with it, and a locked element is framed in gray
// with a cross in place of each handle

import type { App } from '../app.ts';
import { HOST } from '../app.ts';
import { injectStyle } from '../ui/dom.ts';
import type { Box, Guide, Handle, Spacing } from './snap.ts';
import { CONTAINER, RESIZABLE, frameOf, movableOf, toScreen, visualRect } from './hit.ts';

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

// what the drag and the keys show, besides the selection: the element under the pointer, the
// elements being moved, the guides and gaps of a snap, the readout, and the marquee in screen pixels
export const view: {
  hover: Element | null;
  moving: Element[] | null;
  resizing: boolean;
  guides: Guide[];
  spacing: Spacing[];
  readout: { text: string; x: number; y: number; at: 'pointer' | 'frame' } | null;
  marquee: Box | null;
} = { hover: null, moving: null, resizing: false, guides: [], spacing: [], readout: null, marquee: null };

const CSS = `
.beeson-overlay { position: fixed; inset: 0; z-index: 51; pointer-events: none; }
.beeson-frame { position: fixed; pointer-events: none; box-sizing: border-box; border: 1px dashed var(--ed-muted, var(--subtle, #bbb)); }
.beeson-frame.selected { border: 2px solid var(--ed-select, #7048e8); }
.beeson-frame.union { border: 1px dashed var(--ed-select, #7048e8); }
.beeson-overlay [hidden] { display: none !important; }
.beeson-grip { position: fixed; width: 9px; height: 9px; margin: -5.5px 0 0 -5.5px; border-radius: 50%; border: 1.5px solid var(--ed-select, #7048e8); background: #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25); pointer-events: auto; touch-action: none; }
.beeson-grip.fixed { border-color: #8a8a8a; background: #d9d9d9; pointer-events: none; }
.beeson-frame.selected.locked { border-color: #8a8a8a; }
.beeson-grip.locked { width: 9px; height: 9px; border: 0; border-radius: 0; background: linear-gradient(45deg, transparent 42%, #8a8a8a 42% 58%, transparent 58%), linear-gradient(-45deg, transparent 42%, #8a8a8a 42% 58%, transparent 58%); box-shadow: none; pointer-events: none; }
.beeson-rotor { position: fixed; width: 18px; height: 18px; margin: -9px 0 0 -9px; box-sizing: border-box; border-radius: 50%; border: 1.5px solid var(--ed-select, #7048e8); background: #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25); color: var(--ed-select, #7048e8); font: 600 12px/15px system-ui, sans-serif; text-align: center; cursor: grab; user-select: none; pointer-events: auto; touch-action: none; }
.beeson-rotor-stem { position: fixed; width: 1px; height: 15px; margin-left: -0.5px; background: var(--ed-select, #7048e8); transform-origin: 50% 100%; }
html.beeson-rotating, html.beeson-rotating * { cursor: grabbing !important; user-select: none !important; }
.beeson-grip[data-handle=nw], .beeson-grip[data-handle=se] { cursor: nwse-resize; }
.beeson-grip[data-handle=ne], .beeson-grip[data-handle=sw] { cursor: nesw-resize; }
.beeson-grip[data-handle=n], .beeson-grip[data-handle=s] { cursor: ns-resize; }
.beeson-grip[data-handle=e], .beeson-grip[data-handle=w] { cursor: ew-resize; }
.beeson-handle { position: fixed; width: 22px; height: 22px; box-sizing: border-box; border-radius: 6px; border: 1px solid var(--ed-line, var(--line, #555)); background: var(--ed-panel, var(--bg, #000)); color: var(--ed-text, var(--text, #eee)); font: 14px/20px system-ui, sans-serif; text-align: center; cursor: move; user-select: none; pointer-events: auto; }
.beeson-handle:hover, .beeson-handle:focus-visible { border-color: var(--ed-select, #7048e8); outline: none; }
.beeson-guide { position: fixed; background: var(--ed-guide, #e8590c); }
.beeson-guide.v { width: 1px; }
.beeson-guide.h { height: 1px; }
.beeson-gap { position: fixed; box-sizing: border-box; border-color: var(--ed-guide, #e8590c); border-style: solid; border-width: 0; }
.beeson-gap.h { height: 7px; margin-top: -3px; border-left-width: 1px; border-right-width: 1px; background: linear-gradient(var(--ed-guide, #e8590c), var(--ed-guide, #e8590c)) center / 100% 1px no-repeat; }
.beeson-gap.v { width: 7px; margin-left: -3px; border-top-width: 1px; border-bottom-width: 1px; background: linear-gradient(var(--ed-guide, #e8590c), var(--ed-guide, #e8590c)) center / 1px 100% no-repeat; }
.beeson-offset { position: fixed; height: 22px; padding: 0 7px; box-sizing: border-box; border-radius: 5px; background: var(--ed-guide, #e8590c); color: #fff; font: 600 12px/22px system-ui, sans-serif; font-variant-numeric: tabular-nums; white-space: nowrap; }
.beeson-offset.frame { transform: translateX(-100%); }
.beeson-marquee { position: fixed; box-sizing: border-box; border: 1px solid var(--ed-select, #7048e8); background: color-mix(in srgb, var(--ed-select, #7048e8) 12%, transparent); }
html.beeson-editing .reveal .beeson-movable:focus-visible { outline: 2px solid var(--ed-select, #7048e8); outline-offset: 6px; }
html.beeson-dragging, html.beeson-dragging * { cursor: move !important; user-select: none !important; }
html.beeson-resizing, html.beeson-resizing * { user-select: none !important; }
html.beeson-band, html.beeson-band .reveal * { cursor: move; }
html.beeson-editing .reveal .slides section img, html.beeson-editing .reveal .slides section video, html.beeson-editing .reveal .slides section .zone, html.beeson-editing .reveal .slides section .plate, html.beeson-editing .reveal .slides section .qr { cursor: move; }
`;

const div = (className: string, parent: HTMLElement): HTMLDivElement => {
  const d = document.createElement('div');
  d.className = className;
  d.hidden = true;
  parent.append(d);
  return d;
};

const place = (d: HTMLElement, b: Box) => {
  d.hidden = false;
  Object.assign(d.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });
};

const grow = (b: Box, by: number): Box => ({ left: b.left - by, top: b.top - by, width: b.width + 2 * by, height: b.height + 2 * by });

// the angle of el in degrees, from its computed rotate
const angleOf = (el: Element): number => parseFloat(getComputedStyle(el).rotate) || 0;

// the box of el on the screen without its rotation, about the center of the box seen, and the
// angle that it is turned by. an element that is not rotated has the box of visualRect
function orientOf(el: Element, scale: number): { box: Box; deg: number } {
  const deg = angleOf(el);
  if (!deg) return { box: visualRect(el), deg: 0 };
  const r = el.getBoundingClientRect();
  const h = el as HTMLElement;
  const w = h.offsetWidth * scale, ht = h.offsetHeight * scale;
  return { box: { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - ht / 2, width: w, height: ht }, deg };
}

// the point x, y turned by deg about the center of box
function turned(box: Box, deg: number, x: number, y: number): { x: number; y: number } {
  if (!deg) return { x, y };
  const a = (deg * Math.PI) / 180;
  const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
  return { x: cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), y: cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a) };
}

// the distance of the rotate handle above the top edge of a frame, in screen pixels
const ROTOR = 24;

// the overlay of the editor. the handle of a block and the resize handles are its only parts that
// take the pointer
export class Frames {
  readonly layer: HTMLDivElement;
  // the dashed frame of the element under the pointer or being edited
  readonly hoverFrame: HTMLDivElement;
  // the handle of the block under the pointer, being edited, or selected, by which it is dragged
  readonly handle: HTMLDivElement;
  readonly grips: Record<Handle, HTMLDivElement>;
  // the rotate handle of the one selected element, on a stem above the middle of its top edge
  readonly rotor: HTMLDivElement;
  private readonly stem: HTMLDivElement;
  private readonly frames: HTMLDivElement[] = [];
  private readonly union: HTMLDivElement;
  private readonly guides: HTMLDivElement[] = [];
  private readonly gaps: HTMLDivElement[] = [];
  readonly readout: HTMLDivElement;
  private readonly marquee: HTMLDivElement;
  private readonly app: App;

  constructor(app: App) {
    injectStyle('frames', CSS);
    this.app = app;
    this.layer = document.createElement('div');
    this.layer.className = 'beeson-overlay';
    this.hoverFrame = div('beeson-frame', this.layer);
    this.frames.push(div('beeson-frame selected', this.layer));
    this.union = div('beeson-frame union', this.layer);
    // the first guide on each axis is always there, at the line snapped to
    this.guides.push(div('beeson-guide v', this.layer), div('beeson-guide h', this.layer));
    this.marquee = div('beeson-marquee', this.layer);
    this.grips = Object.fromEntries(HANDLES.map((h) => {
      const g = div('beeson-grip', this.layer);
      g.dataset.handle = h;
      return [h, g];
    })) as Record<Handle, HTMLDivElement>;
    this.stem = div('beeson-rotor-stem', this.layer);
    this.rotor = div('beeson-rotor', this.layer);
    this.rotor.textContent = '↻';
    this.rotor.title = 'Drag to rotate, with Shift in steps of 15°';
    this.handle = div('beeson-handle', this.layer);
    this.handle.textContent = '⠿';
    this.handle.title = 'Drag to move, double-click to put back, arrow keys nudge';
    this.handle.tabIndex = 0;
    this.handle.setAttribute('role', 'button');
    this.handle.setAttribute('aria-label', 'Move the block: the arrow keys nudge it, Enter puts it back');
    this.readout = div('beeson-offset', this.layer);
  }

  // the element that the handle of a block is shown at: the one dragged, under the pointer, or
  // being edited, else the one selected
  current(): Element | null {
    const active = document.activeElement instanceof Element ? document.activeElement : null;
    const editing = active?.closest(HOST) ?? null;
    return view.moving?.[0] ?? view.hover ?? movableOf(this.app, editing) ?? this.app.selection.only();
  }

  // the resize handles of the one selected element: live on an image, a video, a QR code, or a
  // viewer, gray on a figure whose size is set by its layout, none on a block of text, and crosses
  // on a locked element
  gripsOf(el: Element | null): 'live' | 'fixed' | 'locked' | null {
    if (!el || this.app.selection.only() !== el) return null;
    if (el.hasAttribute('data-locked')) return 'locked';
    if (el.matches(RESIZABLE)) return 'live';
    return el.matches(CONTAINER) ? 'fixed' : null;
  }

  draw(): void {
    const app = this.app;
    const v = app.stage?.viewport;
    if (v) this.layer.style.clipPath = `inset(${v.top}px ${innerWidth - v.right}px ${innerHeight - v.bottom}px ${v.left}px)`;
    if (view.hover && !view.hover.isConnected) view.hover = null;
    const selected = app.selection.elements().filter((el) => el.isConnected);
    const scale = frameOf(app).scale;
    // a figure is framed at its edge, where its handles are, and a block 6 px outside its text
    const orients = selected.map((el) => {
      const o = orientOf(el, scale);
      return el.matches(RESIZABLE) || el.matches(CONTAINER) ? o : { ...o, box: grow(o.box, 6) };
    });
    const boxes = orients.map((o) => o.box);
    while (this.frames.length < boxes.length) this.frames.push(div('beeson-frame selected', this.layer));
    this.frames.forEach((f, i) => {
      if (!boxes[i]) {
        f.hidden = true;
        return;
      }
      place(f, boxes[i]);
      f.style.rotate = orients[i].deg ? `${orients[i].deg}deg` : '';
      f.classList.toggle('locked', selected[i].hasAttribute('data-locked'));
    });
    if (boxes.length > 1) {
      const seen = selected.map((el) => (el.matches(RESIZABLE) || el.matches(CONTAINER) ? visualRect(el) : grow(visualRect(el), 6)));
      const left = Math.min(...seen.map((b) => b.left)), top = Math.min(...seen.map((b) => b.top));
      const right = Math.max(...seen.map((b) => b.left + b.width)), bottom = Math.max(...seen.map((b) => b.top + b.height));
      place(this.union, grow({ left, top, width: right - left, height: bottom - top }, 6));
    } else this.union.hidden = true;

    const only = app.selection.only();
    const grips = view.moving && !view.resizing ? null : this.gripsOf(only);
    const tycho = !!only?.matches('tycho-viewer');
    for (const h of HANDLES) {
      const g = this.grips[h];
      if (!grips || !only || (tycho && (h === 'n' || h === 's'))) {
        g.hidden = true;
        continue;
      }
      const b = boxes[0];
      const at = turned(b, orients[0].deg, h.includes('w') ? b.left : h.includes('e') ? b.left + b.width : b.left + b.width / 2, h.includes('n') ? b.top : h.includes('s') ? b.top + b.height : b.top + b.height / 2);
      g.hidden = false;
      g.classList.toggle('fixed', grips === 'fixed');
      g.classList.toggle('locked', grips === 'locked');
      Object.assign(g.style, { left: `${at.x}px`, top: `${at.y}px` });
    }
    // the rotate handle, also while it is dragged, on one element that is not locked
    const rotating = document.documentElement.classList.contains('beeson-rotating');
    const turnable = !!only && boxes.length === 1 && !only.hasAttribute('data-locked') && (!view.moving || rotating);
    this.rotor.hidden = this.stem.hidden = !turnable;
    if (turnable) {
      const b = boxes[0], deg = orients[0].deg;
      const top = turned(b, deg, b.left + b.width / 2, b.top);
      const knob = turned(b, deg, b.left + b.width / 2, b.top - ROTOR);
      Object.assign(this.rotor.style, { left: `${knob.x}px`, top: `${knob.y}px` });
      Object.assign(this.stem.style, { left: `${top.x}px`, top: `${top.y - ROTOR + 9}px`, height: `${ROTOR - 9}px`, rotate: deg ? `${deg}deg` : '' });
    }

    const hot = this.current();
    const framed = hot && selected.includes(hot);
    this.hoverFrame.hidden = !hot || !!framed || !!view.moving;
    if (hot && !framed && !view.moving) place(this.hoverFrame, grow(visualRect(hot), 6));
    // a figure with handles is dragged by itself, and the handle of a block would cover a corner
    this.handle.hidden = !hot || (hot === only && !!this.gripsOf(only));
    if (!this.handle.hidden && hot) {
      const r = hot.getBoundingClientRect();
      Object.assign(this.handle.style, { left: `${r.left - 24}px`, top: `${r.top - 24}px` });
    }
    this.drawGuides();
    if (view.marquee) place(this.marquee, view.marquee);
    else this.marquee.hidden = true;
    const out = view.readout;
    this.readout.hidden = !out;
    if (out) {
      this.readout.textContent = out.text;
      this.readout.classList.toggle('frame', out.at === 'frame');
      Object.assign(this.readout.style, { left: `${out.x}px`, top: `${out.y}px` });
    }
  }

  private drawGuides(): void {
    const f = frameOf(this.app);
    const lines = { v: view.guides.filter((g) => g.axis === 'x'), h: view.guides.filter((g) => g.axis === 'y') };
    const used = { v: 0, h: 0 };
    const take = (cls: 'v' | 'h') => {
      const pool = this.guides.filter((d) => d.classList.contains(cls));
      const d = pool[used[cls]++] ?? div(`beeson-guide ${cls}`, this.layer);
      if (!this.guides.includes(d)) this.guides.push(d);
      return d;
    };
    for (const g of lines.v) place(take('v'), { ...toScreen(f, { left: g.at, top: g.from, width: 0, height: g.to - g.from }), width: 1 });
    for (const g of lines.h) place(take('h'), { ...toScreen(f, { left: g.from, top: g.at, width: g.to - g.from, height: 0 }), height: 1 });
    for (const cls of ['v', 'h'] as const) this.guides.filter((d) => d.classList.contains(cls)).slice(used[cls]).forEach((d) => (d.hidden = true));
    let n = 0;
    for (const s of view.spacing) {
      for (const gap of s.gaps) {
        const d = this.gaps[n] ?? div('beeson-gap', this.layer);
        if (!this.gaps.includes(d)) this.gaps.push(d);
        n++;
        d.className = `beeson-gap ${s.axis === 'x' ? 'h' : 'v'}`;
        const b = s.axis === 'x' ? toScreen(f, { left: gap.from, top: gap.at, width: gap.to - gap.from, height: 0 }) : toScreen(f, { left: gap.at, top: gap.from, width: 0, height: gap.to - gap.from });
        place(d, s.axis === 'x' ? { ...b, height: 7 } : { ...b, width: 7 });
      }
    }
    this.gaps.slice(n).forEach((d) => (d.hidden = true));
  }
}

let installed: Frames | null = null;

// the overlay, which canvas/drag.ts draws into
export function overlay(): Frames {
  if (!installed) throw new Error('the frames are not installed');
  return installed;
}

export function install(app: App): void {
  const frames = new Frames(app);
  installed = frames;
  document.body.append(frames.layer);
  app.selection.listen(() => {
    if (!view.moving) view.readout = null;
    frames.draw();
  });
  app.onRefresh(['content', 'selection', 'slide', 'structure', 'layout'], () => frames.draw());
  app.listen('resize', () => frames.draw());
}
