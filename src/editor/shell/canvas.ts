// the stage of the slide in the canvas cell of the shell. the cell is a scroll container with a
// spacer as large as the zoomed slide and its pasteboard, and the viewport of reveal.js, .reveal,
// is set with position: fixed over the box of the slide in it and clipped to the cell. reveal.js
// is thus held at the zoom, with a margin of 0 and the limits of its scale widened. at Fit, the
// slide is centered with a pasteboard of at least 32 px around it, and past Fit the pasteboard is
// 32 px on every side, grown by Zoom to Selection to center a box near an edge. the box of the
// slide is written into custom properties on html. the wheel and a trackpad scroll the canvas past Fit,
// and a pinch or the wheel with Ctrl zooms about the pointer. every step of a slide is shown,
// apart from the elements of another layer, and the progress line, the scrubber, the slide
// number, and the mode switch of the theme are hidden

import type { App } from '../app.ts';
import { injectStyle, make } from '../ui/dom.ts';

// the stage for the frames, the handles, and the drags: the scale in CSS px per slide px, the
// upper left corner of the slide in the viewport, and the zoom, which is null at Fit
export type Stage = {
  readonly scale: number;
  readonly origin: { x: number; y: number };
  readonly zoom: number | null;
  // the box of the canvas cell in the viewport, without its scroll bars
  readonly viewport: DOMRect;
  readonly el: HTMLElement;
  toSlide(p: { x: number; y: number }): { x: number; y: number };
  toScreen(p: { x: number; y: number }): { x: number; y: number };
  // a zoom of null is Fit, and about is the point of the viewport that stays where it is
  setZoom(zoom: number | null, about?: { x: number; y: number }): void;
  zoomIn(): void;
  zoomOut(): void;
  // the zoom at which a box in slide px fills the cell, with the box centered in it
  zoomTo(box: { left: number; top: number; width: number; height: number }): void;
  fitScale(): number;
  place(): void;
  // the room at the top and the left of the cell that the viewport leaves, e.g. for the rulers of
  // canvas/rulers.ts, in CSS px
  setRoom(room: { top: number; left: number }): void;
};

declare module '../app.ts' {
  interface App {
    stage: Stage;
  }
}

// the margin of the pasteboard at Fit, in CSS px, and the levels of the zoom, which are the steps of
// Zoom In and Zoom Out and the choices of the Zoom popup of the toolbar and of the status bar
export const MARGIN = 32;
export const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

const CSS = `
html.beeson-editor body.reveal-viewport { background: var(--ed-canvas); }
html.beeson-editor .beeson-edit-canvas { grid-area: canvas; position: relative; min-width: 0; min-height: 0; overflow: hidden; background: var(--ed-canvas); color-scheme: inherit; }
html.beeson-editor .beeson-edit-canvas.zoomed { overflow: scroll; }
html.beeson-editor .beeson-edit-canvas > .spacer { width: 1px; height: 1px; pointer-events: none; }
html.beeson-editor .reveal:not(.beeson-peek) { position: fixed !important; inset: auto !important; left: var(--ed-slide-x, 0px) !important; top: var(--ed-slide-y, 0px) !important; width: var(--ed-slide-w, 100%) !important; height: var(--ed-slide-h, 100%) !important; margin: 0 !important; z-index: 1; overflow: visible; background: var(--bg); box-shadow: 0 0 0 1px var(--ed-edge), 0 2px 6px rgba(0, 0, 0, 0.16), 0 12px 32px rgba(0, 0, 0, 0.18); clip-path: var(--ed-clip, none); }
html.beeson-editor .beeson-badges { clip-path: var(--ed-cell-clip, none) !important; }
html.beeson-editor .reveal .progress, html.beeson-editor .reveal .scrub, html.beeson-editor .reveal .slide-number, html.beeson-editor .theme-switch { display: none !important; }
html.beeson-editing .reveal .slides section .fragment { visibility: visible !important; opacity: 1 !important; transition: none !important; }
html.beeson-editing .reveal .slides section .fragment.beeson-off { visibility: hidden !important; }
`;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
// reveal.js rounds its scale to a hundredth, hence the zoom is a hundredth too
const hundredth = (v: number) => Math.floor(v * 100 + 1e-6) / 100;

export function install(app: App): void {
  injectStyle('canvas', CSS);
  const el = make('div', 'beeson-edit-canvas beeson-edit-region');
  el.setAttribute('aria-hidden', 'true');
  const spacer = make('div', 'spacer');
  el.append(spacer);
  document.body.append(el);

  let zoom: number | null = null;
  // the pasteboard on each side of the slide past Fit, grown by Zoom to Selection for a box near an
  // edge of the slide, and given back its margin by the next zoom
  let pad = MARGIN;
  let configured = false;
  let placing = false;
  // the box of the slide last written, in the viewport, and its size in slide px
  let box = { x: 0, y: 0, w: 0, h: 0 };
  let size = { w: 1920, h: 1080 };
  let room = { top: 0, left: 0 };
  const root = document.documentElement.style;

  const reveal = () => document.querySelector<HTMLElement>('.reveal:not(.beeson-peek)');
  const viewport = (): DOMRect => {
    const r = el.getBoundingClientRect();
    return new DOMRect(r.left + el.clientLeft + room.left, r.top + el.clientTop + room.top, el.clientWidth - room.left, el.clientHeight - room.top);
  };
  const fitScale = (): number => {
    const v = viewport();
    return Math.max(MIN_ZOOM / 4, hundredth(Math.min((v.width - 2 * MARGIN) / size.w, (v.height - 2 * MARGIN) / size.h)));
  };
  const scale = (): number => app.deck()?.getScale() ?? (box.w / size.w || 1);
  const origin = (): { x: number; y: number } => {
    const r = app.slides().getBoundingClientRect();
    return { x: r.left, y: r.top };
  };

  function configure(): void {
    const d = app.deck();
    if (configured || !d?.isReady()) return;
    configured = true;
    const config = (d as unknown as { getConfig?: () => { width?: number; height?: number } }).getConfig?.();
    if (typeof config?.width === 'number' && typeof config.height === 'number') size = { w: config.width, h: config.height };
    // the scroll view of reveal.js is never turned on, however narrow the slide is drawn
    d.configure({ margin: 0, minScale: MIN_ZOOM / 4, maxScale: MAX_ZOOM, scrollActivationWidth: 0 });
  }

  // the slide is set into the cell at the zoom, and reveal.js is laid out again when the size of
  // the slide changed. the other modules are told with the event resize
  function place(): void {
    if (placing) return;
    placing = true;
    try {
      configure();
      const s = zoom ?? fitScale();
      el.classList.toggle('zoomed', zoom !== null && zoom > fitScale());
      const v = viewport();
      const w = Math.ceil(size.w * s);
      const h = Math.ceil(size.h * s);
      const contentW = Math.max(v.width, w + 2 * pad);
      const contentH = Math.max(v.height, h + 2 * pad);
      spacer.style.width = `${contentW + room.left}px`;
      spacer.style.height = `${contentH + room.top}px`;
      const x = v.left + (contentW - w) / 2 - el.scrollLeft;
      const y = v.top + (contentH - h) / 2 - el.scrollTop;
      const resized = w !== box.w || h !== box.h;
      box = { x, y, w, h };
      root.setProperty('--ed-slide-x', `${x}px`);
      root.setProperty('--ed-slide-y', `${y}px`);
      root.setProperty('--ed-slide-w', `${w}px`);
      root.setProperty('--ed-slide-h', `${h}px`);
      const d = app.deck();
      if (resized && d?.isReady()) d.layout();
      writeRoom(v);
      app.invalidate('layout');
      app.emit('resize');
    } finally {
      placing = false;
    }
  }

  // .reveal is clipped to the cell, and to the notes pane under it, over which notes.ts lays the
  // aside of the slide. the step badges are clipped to the cell, so that a badge at the edge of
  // the slide is drawn on the pasteboard and none is drawn over the bars
  function writeRoom(v: DOMRect): void {
    const notes = document.documentElement.classList.contains('beeson-notes') ? document.querySelector('.beeson-edit-pane')?.getBoundingClientRect() : null;
    const bottom = notes && notes.height ? notes.bottom : v.bottom;
    root.setProperty('--ed-cell-clip', `inset(${v.top}px ${innerWidth - v.right}px ${innerHeight - v.bottom}px ${v.left}px)`);
    root.setProperty('--ed-clip', `inset(${v.top - box.y}px ${box.x + box.w - v.right}px ${box.y + box.h - bottom}px ${v.left - box.x}px)`);
  }

  function setZoom(next: number | null, about?: { x: number; y: number }): void {
    const v = viewport();
    const at = about ?? { x: v.left + v.width / 2, y: v.top + v.height / 2 };
    const before = toSlide(at);
    pad = MARGIN;
    zoom = next === null ? null : clamp(hundredth(next), MIN_ZOOM, MAX_ZOOM);
    if (zoom !== null && Math.abs(zoom - fitScale()) < 0.005) zoom = null;
    place();
    // the point under about is kept there by a scroll
    const after = toScreen(before);
    el.scrollLeft += after.x - at.x;
    el.scrollTop += after.y - at.y;
    place();
    app.report();
  }

  function zoomTo(b: { left: number; top: number; width: number; height: number }): void {
    const v = viewport();
    const z = hundredth(Math.min((v.width - 2 * MARGIN) / Math.max(b.width, 1), (v.height - 2 * MARGIN) / Math.max(b.height, 1)));
    zoom = z <= fitScale() + 0.005 ? null : clamp(z, MIN_ZOOM, MAX_ZOOM);
    pad = MARGIN;
    place();
    // the pasteboard is made wide enough on every side for the center of the box to be scrolled to
    // the center of the cell, which is measured inside the scroll bars of the zoom
    if (zoom !== null) {
      const u = viewport();
      const cx = (b.left + b.width / 2) * zoom;
      const cy = (b.top + b.height / 2) * zoom;
      const need = Math.max(u.width / 2 - cx, u.width / 2 - (size.w * zoom - cx), u.height / 2 - cy, u.height / 2 - (size.h * zoom - cy));
      pad = Math.max(MARGIN, Math.ceil(need) + 1);
      place();
    }
    const c = toScreen({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
    const w = viewport();
    el.scrollLeft += c.x - (w.left + w.width / 2);
    el.scrollTop += c.y - (w.top + w.height / 2);
    place();
    app.report();
  }

  const step = (way: 1 | -1) => {
    const now = zoom ?? fitScale();
    const next = way > 0 ? ZOOMS.find((z) => z > now + 0.004) : [...ZOOMS].reverse().find((z) => z < now - 0.004);
    setZoom(next ?? (way > 0 ? MAX_ZOOM : MIN_ZOOM));
  };

  function toSlide(p: { x: number; y: number }): { x: number; y: number } {
    const o = origin();
    const s = scale();
    return { x: (p.x - o.x) / s, y: (p.y - o.y) / s };
  }

  function toScreen(p: { x: number; y: number }): { x: number; y: number } {
    const o = origin();
    const s = scale();
    return { x: o.x + p.x * s, y: o.y + p.y * s };
  }

  app.stage = {
    get scale() {
      return scale();
    },
    get origin() {
      return origin();
    },
    get zoom() {
      return zoom;
    },
    get viewport() {
      return viewport();
    },
    el,
    toSlide,
    toScreen,
    setZoom,
    zoomIn: () => step(1),
    zoomOut: () => step(-1),
    zoomTo,
    fitScale,
    place,
    setRoom(next) {
      if (next.top === room.top && next.left === room.left) return;
      room = next;
      place();
    },
  };

  new ResizeObserver(() => place()).observe(el);
  el.addEventListener('scroll', () => place(), { passive: true });
  app.listen('resize', place);

  // the wheel over the slide scrolls the canvas past Fit, and Shift turns a wheel without a
  // horizontal delta sideways. with Ctrl, which a pinch of a trackpad sends too, the wheel zooms
  // about the pointer, and a notch of a mouse wheel is a step of at most 28 percent. Safari sends
  // a pinch as gesture events instead. a figure that takes the wheel keeps it
  let pinch: number | null = null;
  const LINE = 16;
  const onWheel = (ev: WheelEvent) => {
    const t = ev.target instanceof Element ? ev.target : null;
    if (t?.closest('tycho-viewer, aside.notes, .beeson-edit-menu')) return;
    const unit = ev.deltaMode === 1 ? LINE : ev.deltaMode === 2 ? viewport().height : 1;
    let dx = ev.deltaX * unit;
    let dy = ev.deltaY * unit;
    if (ev.ctrlKey) {
      ev.preventDefault();
      if (pinch !== null) return;
      const now = zoom ?? fitScale();
      setZoom(now * Math.exp(-clamp(dy, -50, 50) / 200), { x: ev.clientX, y: ev.clientY });
    } else if (el.classList.contains('zoomed') && t?.closest('.reveal')) {
      ev.preventDefault();
      if (ev.shiftKey && !dx) [dx, dy] = [dy, 0];
      el.scrollLeft += dx;
      el.scrollTop += dy;
    }
  };
  const inCanvas = (ev: Event) => ev.target instanceof Element && !!ev.target.closest('.reveal:not(.beeson-peek), .beeson-edit-canvas') && !ev.target.closest('aside.notes');
  window.addEventListener('wheel', (ev) => {
    if (inCanvas(ev)) onWheel(ev);
  }, { passive: false });
  type Gesture = Event & { scale: number; clientX: number; clientY: number };
  window.addEventListener('gesturestart', (ev) => {
    if (!inCanvas(ev)) return;
    ev.preventDefault();
    pinch = zoom ?? fitScale();
  }, { passive: false });
  window.addEventListener('gesturechange', (ev) => {
    if (pinch === null) return;
    ev.preventDefault();
    const g = ev as Gesture;
    setZoom(pinch * g.scale, { x: g.clientX, y: g.clientY });
  }, { passive: false });
  window.addEventListener('gestureend', () => {
    pinch = null;
  });
}
