import type { App } from '../app.ts';
import { injectStyle, make } from '../ui/dom.ts';

export type Stage = {
  readonly scale: number;
  readonly origin: { x: number; y: number };
  readonly zoom: number | null;
  readonly zooming: boolean;
  readonly live: boolean;
  readonly viewport: DOMRect;
  readonly el: HTMLElement;
  toSlide(p: { x: number; y: number }): { x: number; y: number };
  toScreen(p: { x: number; y: number }): { x: number; y: number };
  setZoom(zoom: number | null, about?: { x: number; y: number }, live?: boolean): void;
  settle(): void;
  zoomIn(): void;
  zoomOut(): void;
  zoomTo(box: { left: number; top: number; width: number; height: number }): void;
  fitScale(): number;
  place(): void;
  setRoom(room: { top: number; left: number }): void;
  setReach(box: { left: number; top: number; right: number; bottom: number } | null): void;
  edgeScroll(ev: { clientX: number; clientY: number } | null, again?: () => void): void;
};

declare module '../app.ts' {
  interface App {
    stage: Stage;
  }
}

export const MARGIN = 32;
export const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];
export const MIN_ZOOM = 0.1;
const GRIP = 16;
export const MAX_ZOOM = 4;

const BOX = ['--ed-slide-x', '--ed-slide-y', '--ed-slide-w', '--ed-slide-h', '--ed-clip'];
const CELL = '--ed-cell-clip';
const CSS = `
${[...BOX, CELL].map((p) => `@property ${p} { syntax: '*'; inherits: false; }`).join('\n')}
html.beeson-editor body.reveal-viewport { background: var(--ed-canvas); }
html.beeson-editor .beeson-edit-canvas { grid-area: canvas; position: relative; min-width: 0; min-height: 0; overflow: hidden; background: var(--ed-canvas); color-scheme: inherit; }
html.beeson-editor .beeson-edit-canvas.zoomed { overflow: scroll; }
html.beeson-editor .beeson-edit-canvas > .spacer { width: 1px; height: 1px; pointer-events: none; }
html.beeson-editor .reveal:not(.beeson-peek) { position: fixed !important; inset: auto !important; left: var(--ed-slide-x, 0px) !important; top: var(--ed-slide-y, 0px) !important; width: var(--ed-slide-w, 100%) !important; height: var(--ed-slide-h, 100%) !important; margin: 0 !important; z-index: 1; overflow: visible; background: var(--bg); box-shadow: 0 0 0 1px var(--ed-edge), 0 2px 6px rgba(0, 0, 0, 0.16), 0 12px 32px rgba(0, 0, 0, 0.18); clip-path: var(--ed-clip, none); }
html.beeson-editor .beeson-badges { clip-path: var(--ed-cell-clip, none) !important; }
html.beeson-editor .reveal .progress, html.beeson-editor .reveal .scrub, html.beeson-editor .reveal .slide-number, html.beeson-editor .theme-switch { display: none !important; }
html.beeson-editing .reveal .slides section :is(.fragment, .r-stack > *) { visibility: visible !important; opacity: 1 !important; transition: none !important; }
html.beeson-editing .reveal .slides section :is(.fragment, .r-stack > *).beeson-off { visibility: hidden !important; }
html.beeson-editing .reveal .slides section > .refs[data-generated] { pointer-events: none; }
`;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const hundredth = (v: number) => Math.floor(v * 100 + 1e-6) / 100;

export function install(app: App): void {
  injectStyle('canvas', CSS);
  const el = make('div', 'beeson-edit-canvas beeson-edit-region');
  el.setAttribute('aria-hidden', 'true');
  const spacer = make('div', 'spacer');
  el.append(spacer);
  document.body.append(el);

  let zoom: number | null = null;
  let pad = MARGIN;
  let configured = false;
  let placing = false;
  let held = 0;
  let owed = false;
  let placed = { x: -1, y: -1 };
  let live = false;
  let stale: number | null = null;
  let box = { x: 0, y: 0, w: 0, h: 0 };
  let size = { w: 1920, h: 1080 };
  let room = { top: 0, left: 0 };
  let reach = { left: 0, top: 0, right: 0, bottom: 0 };
  let added = { x: 0, y: 0 };
  const vars: Record<string, string> = {};
  const sheet = injectStyle('canvas-box', '');
  const write = (next: Record<string, string>) => {
    Object.assign(vars, next);
    const text = `.reveal:not(.beeson-peek), .beeson-grid, .beeson-presence { ${BOX.filter((p) => vars[p]).map((p) => `${p}: ${vars[p]};`).join(' ')} }\n.beeson-badges, .beeson-guides, .beeson-presence-cell { ${CELL}: ${vars[CELL] ?? 'none'}; }`;
    if (sheet.textContent !== text) sheet.textContent = text;
  };

  const reveal = () => document.querySelector<HTMLElement>('.reveal:not(.beeson-peek)');
  const viewport = (): DOMRect => {
    const r = el.getBoundingClientRect();
    return new DOMRect(r.left + el.clientLeft + room.left, r.top + el.clientTop + room.top, el.clientWidth - room.left, el.clientHeight - room.top);
  };
  const fitMargin = (v: DOMRect): number => clamp(8 + (Math.min(v.width, (v.height * size.w) / size.h) - 400) / 10, 8, MARGIN);
  const fitScale = (): number => {
    const v = viewport();
    const m = fitMargin(v);
    return Math.max(MIN_ZOOM / 4, hundredth(Math.min((v.width - 2 * m) / size.w, (v.height - 2 * m) / size.h)));
  };
  const scale = (): number => stale ?? app.deck()?.getScale() ?? (box.w / size.w || 1);
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
    d.configure({ margin: 0, minScale: MIN_ZOOM / 4, maxScale: MAX_ZOOM, scrollActivationWidth: 0 });
  }

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
      const p = zoom === null ? Math.min(pad, fitMargin(v)) : pad;
      const baseW = Math.max(v.width, w + 2 * p);
      const baseH = Math.max(v.height, h + 2 * p);
      const more = (over: number, has: number) => (over > 0 && zoom === null ? Math.max(0, Math.ceil(over * s + GRIP - has)) : 0);
      const add = { left: more(reach.left, (baseW - w) / 2), right: more(reach.right, (baseW - w) / 2), top: more(reach.top, (baseH - h) / 2), bottom: more(reach.bottom, (baseH - h) / 2) };
      const contentW = baseW + add.left + add.right;
      const contentH = baseH + add.top + add.bottom;
      const sx = el.scrollLeft, sy = el.scrollTop;
      spacer.style.width = `${contentW + room.left}px`;
      spacer.style.height = `${contentH + room.top}px`;
      el.scrollLeft = sx + add.left - added.x;
      el.scrollTop = sy + add.top - added.y;
      added = { x: add.left, y: add.top };
      const x = v.left + add.left + (baseW - w) / 2 - el.scrollLeft;
      const y = v.top + add.top + (baseH - h) / 2 - el.scrollTop;
      const resized = w !== box.w || h !== box.h;
      box = { x, y, w, h };
      write({ '--ed-slide-x': `${x}px`, '--ed-slide-y': `${y}px`, '--ed-slide-w': `${w}px`, '--ed-slide-h': `${h}px` });
      const d = app.deck();
      if ((resized || stale !== null) && d?.isReady()) {
        if (live && s <= 2 * d.getScale()) scaleSlides(s);
        else {
          stale = null;
          d.layout();
        }
      }
      writeRoom(v);
      placed = { x: el.scrollLeft, y: el.scrollTop };
      app.invalidate('layout');
      if (held) owed = true;
      else app.emit('resize');
    } finally {
      placing = false;
    }
  }

  function scaleSlides(s: number): void {
    stale = s;
    const one = s === 1;
    Object.assign((app.slides() as HTMLElement).style, { left: one ? '' : '50%', top: one ? '' : '50%', bottom: one ? '' : 'auto', right: one ? '' : 'auto', transform: one ? '' : `translate(-50%, -50%) scale(${s})` });
  }

  function writeRoom(v: DOMRect): void {
    const notes = document.documentElement.classList.contains('beeson-notes') ? document.querySelector('.beeson-edit-pane')?.getBoundingClientRect() : null;
    const bottom = notes && notes.height ? notes.bottom : v.bottom;
    write({
      [CELL]: `inset(${v.top}px ${innerWidth - v.right}px ${innerHeight - v.bottom}px ${v.left}px)`,
      '--ed-clip': `inset(${v.top - box.y}px ${box.x + box.w - v.right}px ${box.y + box.h - bottom}px ${v.left - box.x}px)`,
    });
  }

  function holding(fn: () => void, now = false): void {
    held++;
    live = now;
    try {
      fn();
    } finally {
      held--;
      if (!held && owed && !placing) {
        owed = false;
        placing = true;
        try {
          app.emit('resize');
        } finally {
          placing = false;
        }
      }
      app.report();
      live = false;
    }
  }

  const setZoom = (next: number | null, about?: { x: number; y: number }, now = false, held?: { x: number; y: number }): void => holding(() => {
    const v = viewport();
    const at = about ?? { x: v.left + v.width / 2, y: v.top + v.height / 2 };
    const before = held ?? toSlide(at);
    pad = MARGIN;
    zoom = next === null ? null : clamp(hundredth(next), MIN_ZOOM, MAX_ZOOM);
    if (zoom !== null && Math.abs(zoom - fitScale()) < 0.005) zoom = null;
    place();
    const after = toScreen(before);
    el.scrollLeft += after.x - at.x;
    el.scrollTop += after.y - at.y;
    place();
  }, now);

  const settleZoom = () => stale !== null && holding(place);

  const zoomTo = (b: { left: number; top: number; width: number; height: number }): void => holding(() => {
    const v = viewport();
    const z = hundredth(Math.min((v.width - 2 * MARGIN) / Math.max(b.width, 1), (v.height - 2 * MARGIN) / Math.max(b.height, 1)));
    zoom = z <= fitScale() + 0.005 ? null : clamp(z, MIN_ZOOM, MAX_ZOOM);
    pad = MARGIN;
    place();
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
  });

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

  let edge: { x: number; y: number; again: () => void } | null = null;
  let frame = 0;
  const tick = () => {
    frame = 0;
    if (!edge || !el.classList.contains('zoomed')) return;
    const x = el.scrollLeft, y = el.scrollTop;
    el.scrollLeft += edge.x;
    el.scrollTop += edge.y;
    if (el.scrollLeft === x && el.scrollTop === y) return;
    place();
    edge.again();
  };
  const edgeScroll = (ev: { clientX: number; clientY: number } | null, again = () => {}) => {
    const v = viewport();
    const by = (d: number) => (d < 24 ? Math.ceil((16 * (24 - Math.max(d, 0))) / 24) : 0);
    edge = ev && el.classList.contains('zoomed') ? { x: by(v.right - ev.clientX) - by(ev.clientX - v.left), y: by(v.bottom - ev.clientY) - by(ev.clientY - v.top), again } : null;
    if (edge && !edge.x && !edge.y) edge = null;
    if (edge && !frame) frame = requestAnimationFrame(tick);
  };

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
    get zooming() {
      return held > 0;
    },
    get live() {
      return live;
    },
    get viewport() {
      return viewport();
    },
    el,
    toSlide,
    toScreen,
    setZoom,
    settle: settleZoom,
    zoomIn: () => step(1),
    zoomOut: () => step(-1),
    zoomTo,
    fitScale,
    place,
    edgeScroll,
    setReach(next) {
      const over = next ? { left: Math.max(0, -next.left), top: Math.max(0, -next.top), right: Math.max(0, next.right - size.w), bottom: Math.max(0, next.bottom - size.h) } : { left: 0, top: 0, right: 0, bottom: 0 };
      const same = (Object.keys(over) as (keyof typeof over)[]).every((k) => Math.abs(over[k] - reach[k]) < 1);
      if (same) return;
      reach = over;
      place();
    },
    setRoom(next) {
      if (next.top === room.top && next.left === room.left) return;
      room = next;
      place();
    },
  };

  new ResizeObserver(() => place()).observe(el);
  el.addEventListener('scroll', () => (el.scrollLeft !== placed.x || el.scrollTop !== placed.y) && place(), { passive: true });
  app.listen('resize', place);

  let pinch: number | null = null;
  const LINE = 16;
  let wheeled: { zoom: number | null; at: { x: number; y: number }; held: { x: number; y: number } } | null = null;
  let raw: { zoom: number; held: { x: number; y: number } } | null = null;
  let wheelFrame = 0;
  let settling = 0;
  const normal = (z: number): number | null => {
    const c = clamp(hundredth(z), MIN_ZOOM, MAX_ZOOM);
    return Math.abs(c - fitScale()) < 0.005 ? null : c;
  };
  const onWheel = (ev: WheelEvent) => {
    const t = ev.target instanceof Element ? ev.target : null;
    if (t?.closest('tycho-viewer, aside.notes, .beeson-edit-menu')) return;
    const unit = ev.deltaMode === 1 ? LINE : ev.deltaMode === 2 ? viewport().height : 1;
    let dx = ev.deltaX * unit;
    let dy = ev.deltaY * unit;
    if (ev.ctrlKey) {
      ev.preventDefault();
      if (pinch !== null) return;
      const shown = wheeled ? wheeled.zoom : zoom;
      const kept = raw !== null && normal(raw.zoom) === shown ? raw : null;
      const at = { x: ev.clientX, y: ev.clientY };
      const seen = kept && toScreen(kept.held);
      const held = kept && seen && Math.hypot(seen.x - at.x, seen.y - at.y) < 2 ? kept.held : toSlide(at);
      raw = { zoom: clamp((kept ? kept.zoom : shown ?? fitScale()) * Math.exp(-clamp(dy, -50, 50) / 200), MIN_ZOOM, MAX_ZOOM), held };
      wheeled = { zoom: normal(raw.zoom), at, held };
      wheelFrame ||= requestAnimationFrame(() => {
        wheelFrame = 0;
        const w = wheeled;
        wheeled = null;
        if (w) setZoom(w.zoom, w.at, true, w.held);
      });
      clearTimeout(settling);
      settling = window.setTimeout(settleZoom, 200);
    } else if (el.classList.contains('zoomed') ? t?.closest('.reveal') : el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) {
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
    setZoom(pinch * g.scale, { x: g.clientX, y: g.clientY }, true);
  }, { passive: false });
  window.addEventListener('gestureend', () => {
    if (pinch === null) return;
    pinch = null;
    settleZoom();
  });
}
