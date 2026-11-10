// the stage of the slide in the canvas cell of the shell. the cell is a scroll container with a
// spacer as large as the zoomed slide and its pasteboard, and the viewport of reveal.js, .reveal,
// is set with position: fixed over the box of the slide in it and clipped to the cell. reveal.js
// is thus held at the zoom, with a margin of 0 and the limits of its scale widened. at Fit, the
// slide is centered with a pasteboard of at least 32 px around it. the box of the slide is
// written into custom properties on html, together with the room under and beside it for the
// notes in notes.ts. every step of a slide is shown, apart from the elements of another layer,
// and the progress line, the slide number, and the mode switch of the theme are hidden. the layer
// of the frames and handles is clipped to the cell rather than to the slide

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
  fitScale(): number;
  place(): void;
};

declare module '../app.ts' {
  interface App {
    stage: Stage;
  }
}

// the margin of the pasteboard at Fit, and the steps of Zoom In and Zoom Out, in CSS px and scale
export const MARGIN = 32;
export const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3];
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

const CSS = `
html.beeson-editor body.reveal-viewport { background: var(--ed-canvas); }
html.beeson-editor .beeson-edit-canvas { grid-area: canvas; position: relative; min-width: 0; min-height: 0; overflow: hidden; background: var(--ed-canvas); color-scheme: inherit; }
html.beeson-editor .beeson-edit-canvas.zoomed { overflow: scroll; }
html.beeson-editor .beeson-edit-canvas > .spacer { width: 1px; height: 1px; pointer-events: none; }
html.beeson-editor .reveal:not(.beeson-peek) { position: fixed !important; inset: auto !important; left: var(--ed-slide-x, 0px) !important; top: var(--ed-slide-y, 0px) !important; width: var(--ed-slide-w, 100%) !important; height: var(--ed-slide-h, 100%) !important; margin: 0 !important; z-index: 1; overflow: visible; background: var(--bg); box-shadow: 0 0 0 1px var(--ed-edge), 0 2px 6px rgba(0, 0, 0, 0.16), 0 12px 32px rgba(0, 0, 0, 0.18); clip-path: var(--ed-clip, none); }
html.beeson-editor .beeson-overlay, html.beeson-editor .beeson-badges { clip-path: var(--ed-cell-clip, none) !important; }
html.beeson-editor .reveal .progress, html.beeson-editor .reveal .slide-number, html.beeson-editor .theme-switch { display: none !important; }
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
  let configured = false;
  let placing = false;
  // the box of the slide last written, in the viewport, and its size in slide px
  let box = { x: 0, y: 0, w: 0, h: 0 };
  let size = { w: 1920, h: 1080 };
  const root = document.documentElement.style;

  const reveal = () => document.querySelector<HTMLElement>('.reveal:not(.beeson-peek)');
  const viewport = (): DOMRect => {
    const r = el.getBoundingClientRect();
    return new DOMRect(r.left + el.clientLeft, r.top + el.clientTop, el.clientWidth, el.clientHeight);
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
      const contentW = Math.max(v.width, w + 2 * MARGIN);
      const contentH = Math.max(v.height, h + 2 * MARGIN);
      spacer.style.width = `${contentW}px`;
      spacer.style.height = `${contentH}px`;
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

  // the clip of .reveal is the cell with the notes cell under it, and the room under and beside
  // the slide is written for the notes in the slide px of notes.ts
  function writeRoom(v: DOMRect): void {
    const s = scale();
    const notes = document.querySelector('.beeson-edit-pane');
    const notesBox = notes && document.documentElement.classList.contains('beeson-notes') ? notes.getBoundingClientRect() : null;
    const bottom = notesBox && notesBox.height ? notesBox.bottom : v.bottom;
    // the overlays of canvas/frames.ts and the step badges are clipped to the cell, so that a
    // handle at the edge of the slide is drawn on the pasteboard and none is drawn over the bars
    root.setProperty('--ed-cell-clip', `inset(${v.top}px ${innerWidth - v.right}px ${innerHeight - v.bottom}px ${v.left}px)`);
    root.setProperty('--ed-clip', `inset(${v.top - box.y}px ${box.x + box.w - v.right}px ${box.y + box.h - bottom}px ${v.left - box.x}px)`);
    const left = Math.max(0, box.x - v.left) / s;
    const right = Math.max(0, v.right - box.x - box.w) / s;
    root.setProperty('--beeson-scale', String(s));
    root.setProperty('--beeson-gap', `${((notesBox?.top ?? v.bottom) - box.y - box.h) / s}px`);
    root.setProperty('--beeson-side', `${Math.max(left, right)}px`);
    root.setProperty('--ed-room-l', `${left}px`);
    root.setProperty('--ed-room-r', `${right}px`);
  }

  function setZoom(next: number | null, about?: { x: number; y: number }): void {
    const v = viewport();
    const at = about ?? { x: v.left + v.width / 2, y: v.top + v.height / 2 };
    const before = toSlide(at);
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
    fitScale,
    place,
  };

  new ResizeObserver(() => place()).observe(el);
  el.addEventListener('scroll', () => place(), { passive: true });
  app.listen('resize', place);

  // the wheel over the slide scrolls the canvas past Fit, and with Ctrl, which a pinch of a
  // trackpad sends too, it zooms about the pointer. a figure that takes the wheel keeps it
  const onWheel = (ev: WheelEvent) => {
    const t = ev.target instanceof Element ? ev.target : null;
    if (t?.closest('tycho-viewer, aside.notes, .beeson-edit-menu')) return;
    if (ev.ctrlKey) {
      ev.preventDefault();
      const now = zoom ?? fitScale();
      setZoom(now * Math.exp(-ev.deltaY / 200), { x: ev.clientX, y: ev.clientY });
    } else if (el.classList.contains('zoomed') && t?.closest('.reveal')) {
      ev.preventDefault();
      el.scrollLeft += ev.deltaX;
      el.scrollTop += ev.deltaY;
    }
  };
  window.addEventListener('wheel', (ev) => {
    const t = ev.target instanceof Element ? ev.target : null;
    if (t?.closest('.reveal:not(.beeson-peek), .beeson-edit-canvas')) onWheel(ev);
  }, { passive: false });
}
