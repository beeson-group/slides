// the guides placed by hand, as the guides of Keynote: a guide is dragged out of a ruler of
// canvas/rulers.ts, with its place in slide px shown during the drag, moved by a drag on the canvas
// where no element is under the pointer, and removed by a drag back onto a ruler or off the
// canvas. an element snaps to the guides as it snaps to the other elements in snap.ts. the guides
// are not part of the deck: they are kept per slide during the session, and in the storage of the
// browser per deck and per index of a slide. Show Guides, Clear All Guides on Slide, Copy Guides,
// and Paste Guides are the commands of Keynote

import type { App } from '../app.ts';
import { injectStyle, make, store, stored } from '../ui/dom.ts';
import { frameOf, movableOf, onCanvas } from './hit.ts';
import { provideLines } from './snap.ts';

export type Guides = { x: number[]; y: number[] };

// the distance in screen px within which a press grabs a guide
const GRAB = 4;
const SHOWN = 'beeson-edit-guides-shown';
const CLIP = 'beeson-edit-guides-copied';
const keyOf = () => `beeson-edit-guides:${location.pathname}`;

const CSS = `
.beeson-guides { position: fixed; inset: 0; z-index: 50; pointer-events: none; clip-path: var(--ed-cell-clip, none); }
.beeson-guides .beeson-hand-guide { position: fixed; box-sizing: border-box; border: 0 dashed var(--ed-guide, #e8590c); }
.beeson-guides .beeson-hand-guide[data-axis="x"] { width: 0; border-left-width: 1px; }
.beeson-guides .beeson-hand-guide[data-axis="y"] { height: 0; border-top-width: 1px; }
.beeson-guides .beeson-hand-guide.off { opacity: 0.4; }
.beeson-guide-readout { z-index: 54; }
.beeson-guide-readout[hidden] { display: none; }
html.beeson-guide-x, html.beeson-guide-x * { cursor: col-resize !important; }
html.beeson-guide-y, html.beeson-guide-y * { cursor: row-resize !important; }
`;

const empty = (): Guides => ({ x: [], y: [] });
const clean = (g: Partial<Guides> | null | undefined): Guides => ({
  x: (g?.x ?? []).filter(Number.isFinite).map(Math.round),
  y: (g?.y ?? []).filter(Number.isFinite).map(Math.round),
});

// the guides of b added to those of a, each place once, in order
export function merged(a: Guides, b: Guides): Guides {
  const join = (p: number[], q: number[]) => [...new Set([...p, ...q])].sort((m, n) => m - n);
  return { x: join(a.x, b.x), y: join(a.y, b.y) };
}

function read<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(stored(key) ?? 'null') as T) ?? fallback;
  } catch {
    return fallback;
  }
}

type Press = { axis: 'x' | 'y'; index: number; at: number; x: number; y: number };

export function install(app: App): void {
  injectStyle('guides', CSS);
  const stage = app.stage;
  const layer = make('div', 'beeson-guides');
  const readout = make('div', 'beeson-offset beeson-guide-readout');
  readout.hidden = true;
  stage.el.append(layer);
  document.body.append(readout);
  const root = document.documentElement;

  let shown = stored(SHOWN) !== '0';
  // the guides of each slide element, read by index from the storage of the deck at the first use
  const kept = new WeakMap<Element, Guides>();
  const sections = () => [...app.slides().querySelectorAll(':scope > section')];
  const of = (slide: Element | null): Guides => {
    if (!slide) return empty();
    let g = kept.get(slide);
    if (!g) {
      const saved = read<Partial<Guides>[]>(keyOf(), []);
      g = clean(saved[sections().indexOf(slide)]);
      kept.set(slide, g);
    }
    return g;
  };
  // every slide is read before one is written, so that a guide stays with its slide when slides
  // are added or moved during the session
  const persist = () => {
    const all = sections().map((s) => of(s));
    store(keyOf(), all.some((g) => g.x.length || g.y.length) ? JSON.stringify(all) : null);
  };
  const setOf = (slide: Element, g: Guides) => {
    sections().forEach((s) => of(s));
    kept.set(slide, clean(g));
    persist();
    draw();
    app.invalidate('layout');
  };

  provideLines(() => (shown ? { guides: of(app.current()) } : {}));

  let press: Press | null = null;
  const lines: HTMLElement[] = [];

  const draw = () => {
    const f = frameOf(app);
    const v = stage.viewport;
    const g = shown ? of(app.current()) : empty();
    const all: { axis: 'x' | 'y'; at: number; off: boolean }[] = [
      ...g.x.map((at, i) => ({ axis: 'x' as const, at, off: press?.axis === 'x' && press.index === i })),
      ...g.y.map((at, i) => ({ axis: 'y' as const, at, off: press?.axis === 'y' && press.index === i })),
    ].filter((l) => !l.off);
    if (press) all.push({ axis: press.axis, at: press.at, off: outside(press) });
    while (lines.length < all.length) {
      const d = make('div', 'beeson-hand-guide');
      layer.append(d);
      lines.push(d);
    }
    lines.forEach((d, i) => {
      const l = all[i];
      d.hidden = !l;
      if (!l) return;
      d.dataset.axis = l.axis;
      d.dataset.at = String(l.at);
      d.classList.toggle('off', l.off);
      if (l.axis === 'x') Object.assign(d.style, { left: `${f.left + l.at * f.scale}px`, top: `${v.top}px`, height: `${v.height}px`, width: '' });
      else Object.assign(d.style, { top: `${f.top + l.at * f.scale}px`, left: `${v.left}px`, width: `${v.width}px`, height: '' });
    });
  };

  // a press released off the viewport of the canvas, e.g. on a ruler, removes its guide
  const outside = (p: Press) => {
    const v = stage.viewport;
    return p.x < v.left || p.x >= v.right || p.y < v.top || p.y >= v.bottom;
  };

  // the guide within GRAB of the point x, y in screen px, or null
  const guideAt = (x: number, y: number): { axis: 'x' | 'y'; index: number } | null => {
    if (!shown) return null;
    const f = frameOf(app);
    const g = of(app.current());
    let best: { axis: 'x' | 'y'; index: number; d: number } | null = null;
    g.x.forEach((at, index) => {
      const d = Math.abs(f.left + at * f.scale - x);
      if (d <= GRAB && (!best || d < best.d)) best = { axis: 'x', index, d };
    });
    g.y.forEach((at, index) => {
      const d = Math.abs(f.top + at * f.scale - y);
      if (d <= GRAB && (!best || d < best.d)) best = { axis: 'y', index, d };
    });
    return best;
  };

  // a guide is grabbed only where a press does not select anything, i.e. on the slide outside its
  // elements or on the pasteboard
  const free = (target: Element, x: number, y: number) =>
    onCanvas(target, app, { x, y }) && !movableOf(app, target) && !target.closest('.beeson-overlay *, .beeson-line-layer *, [contenteditable="true"]');

  const track = (ev: PointerEvent) => {
    const p = press;
    if (!p) return;
    const f = frameOf(app);
    p.x = ev.clientX;
    p.y = ev.clientY;
    p.at = Math.round(p.axis === 'x' ? (ev.clientX - f.left) / f.scale : (ev.clientY - f.top) / f.scale);
    readout.hidden = false;
    readout.textContent = outside(p) ? 'Remove' : `${p.axis === 'x' ? 'x' : 'y'} ${p.at}`;
    readout.style.left = `${ev.clientX + 14}px`;
    readout.style.top = `${ev.clientY + 14}px`;
    draw();
  };

  window.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0 || press || ev.defaultPrevented || app.state !== 'loaded' || !app.current()) return;
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    const ruler = target.closest<HTMLElement>('.beeson-ruler');
    // the top ruler gives a horizontal guide, i.e. one at a y, and the left ruler a vertical one
    let grab: { axis: 'x' | 'y'; index: number } | null = null;
    if (ruler) grab = { axis: ruler.dataset.axis === 'x' ? 'y' : 'x', index: -1 };
    else if (free(target, ev.clientX, ev.clientY)) grab = guideAt(ev.clientX, ev.clientY);
    if (!grab) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (!shown) set(true);
    press = { ...grab, at: 0, x: ev.clientX, y: ev.clientY };
    root.classList.add(`beeson-guide-${grab.axis}`);
    track(ev);
  }, true);

  window.addEventListener('pointermove', (ev) => {
    if (press) {
      // the hover frame of drag.ts is not drawn while a guide is dragged
      ev.preventDefault();
      ev.stopPropagation();
      track(ev);
      return;
    }
    if (ev.buttons) return;
    const target = ev.target instanceof Element ? ev.target : null;
    const hit = target && free(target, ev.clientX, ev.clientY) ? guideAt(ev.clientX, ev.clientY) : null;
    root.classList.toggle('beeson-guide-x', hit?.axis === 'x');
    root.classList.toggle('beeson-guide-y', hit?.axis === 'y');
  }, true);

  const finish = (keep: boolean) => {
    const p = press;
    if (!p) return;
    press = null;
    readout.hidden = true;
    root.classList.remove('beeson-guide-x', 'beeson-guide-y');
    const slide = app.current();
    if (!slide) return;
    const g = of(slide);
    const next = { x: [...g.x], y: [...g.y] };
    if (p.index >= 0) next[p.axis].splice(p.index, 1);
    if (keep && !outside(p)) next[p.axis].push(p.at);
    else if (!keep && p.index >= 0) next[p.axis].splice(p.index, 0, g[p.axis][p.index]);
    setOf(slide, next);
  };
  window.addEventListener('pointerup', () => finish(true), true);
  window.addEventListener('pointercancel', () => finish(false), true);
  window.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape' || !press) return;
    ev.preventDefault();
    ev.stopPropagation();
    finish(false);
  }, true);

  app.listen('resize', draw);
  app.onRefresh(['content', 'slide', 'layout', 'structure'], draw);

  const set = (on: boolean) => {
    shown = on;
    store(SHOWN, on ? null : '0');
    draw();
    app.invalidate('layout');
  };

  const has = (a: App) => {
    const g = of(a.current());
    return !!(g.x.length || g.y.length);
  };
  const menu = (order: number) => ({ bar: 'View', group: 'guides', order, submenu: 'Guides' });
  const c = app.commands;
  c.define({
    id: 'view.guides',
    label: 'Show Guides',
    keys: { mac: ['Mod+Ctrl+Alt+G'] },
    menu: menu(51),
    checked: () => shown,
    run: () => set(!shown),
  });
  // with an arg { x, y } of lists in slide px, the guides are added at once, e.g. by a test
  c.define({
    id: 'view.guides.add',
    label: 'Add Guides',
    enabled: (a) => !!a.current(),
    run: (a, arg) => {
      const slide = a.current();
      if (slide) setOf(slide, merged(of(slide), clean(arg as Partial<Guides>)));
    },
  });
  c.define({
    id: 'view.guides.clear',
    label: 'Clear All Guides on Slide',
    menu: menu(52),
    enabled: has,
    run: (a) => {
      const slide = a.current();
      if (slide) setOf(slide, empty());
    },
  });
  const slideMenu = (order: number) => ({ bar: 'Slide', group: 'guides', order });
  c.define({
    id: 'slide.guides.copy',
    label: 'Copy Guides',
    menu: slideMenu(70),
    enabled: has,
    run: (a) => store(CLIP, JSON.stringify(of(a.current()))),
  });
  c.define({
    id: 'slide.guides.paste',
    label: 'Paste Guides',
    menu: slideMenu(71),
    enabled: (a) => !!a.current() && stored(CLIP) !== null,
    run: (a) => {
      const slide = a.current();
      if (slide) setOf(slide, merged(of(slide), clean(read<Partial<Guides> | null>(CLIP, null))));
    },
  });
}
