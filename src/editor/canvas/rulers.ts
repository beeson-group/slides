// the rulers along the top and the left of the canvas, as View > Rulers of Keynote: marked in
// slide px from the upper left of the slide, negative on the pasteboard, at a step that follows the
// zoom, and with the extent of the selection as a band. a drag out of a ruler places a guide of
// canvas/guides.ts. the setting is kept in the storage of the browser. the key of Keynote, Cmd+R,
// is taken on a Mac only, since Ctrl+R reloads the page in Firefox on Windows and Linux before a
// page sees it

import type { App } from '../app.ts';
import { OUTSIDE_DIALOGS } from '../commands.ts';
import { injectStyle, make, store, stored } from '../ui/dom.ts';
import { previewPlays } from './frames.ts';
import { frameOf, frameRect } from './hit.ts';

// the thickness of a ruler, in CSS px
export const RULER = 18;
const KEY = 'beeson-edit-rulers';
// the steps of the labels in slide px, of which the smallest at least LABEL screen px apart is used
const STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
const LABEL = 48;

const CSS = `
.beeson-ruler { position: fixed; z-index: 53; display: block; background: var(--ed-panel); touch-action: none; }
.beeson-ruler[data-axis="x"] { cursor: row-resize; }
.beeson-ruler[data-axis="y"] { cursor: col-resize; }
.beeson-ruler-corner { position: fixed; z-index: 53; width: ${RULER}px; height: ${RULER}px; box-sizing: border-box; background: var(--ed-panel); border-right: 1px solid var(--ed-line); border-bottom: 1px solid var(--ed-line); }
.beeson-ruler[hidden], .beeson-ruler-corner[hidden] { display: none; }
`;

// the label step and the minor step of a ruler at scale, in slide px
export function rulerSteps(scale: number): { label: number; minor: number } {
  const label = STEPS.find((s) => s * scale >= LABEL) ?? STEPS[STEPS.length - 1];
  const minor = [label / 10, label / 5, label / 2].find((m) => m * scale >= 5 && Number.isInteger(m)) ?? label;
  return { label, minor };
}

export function install(app: App): void {
  injectStyle('rulers', CSS);
  const stage = app.stage;
  // the top ruler marks x, and the left ruler marks y
  const top = make('canvas', 'beeson-ruler');
  top.dataset.axis = 'x';
  const left = make('canvas', 'beeson-ruler');
  left.dataset.axis = 'y';
  const corner = make('div', 'beeson-ruler-corner');
  stage.el.append(top, left, corner);
  let shown = stored(KEY) === '1';

  const color = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

  // the ruler of the axis, with the band of the selection from band[0] to band[1] in slide px
  const paint = (cv: HTMLCanvasElement, axis: 'x' | 'y', band: [number, number] | null) => {
    const v = stage.viewport;
    const f = frameOf(app);
    const length = axis === 'x' ? v.width : v.height;
    const box = axis === 'x' ? { left: v.left, top: v.top - RULER, width: v.width, height: RULER } : { left: v.left - RULER, top: v.top, width: RULER, height: v.height };
    Object.assign(cv.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
    const dpr = devicePixelRatio || 1;
    cv.width = Math.max(1, Math.round(box.width * dpr));
    cv.height = Math.max(1, Math.round(box.height * dpr));
    const g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // x of the drawing is along the ruler and y across it, from its outer edge, hence the left
    // ruler is drawn transposed
    if (axis === 'y') g.setTransform(0, dpr, dpr, 0, 0, 0);
    const start = axis === 'x' ? v.left : v.top;
    const origin = axis === 'x' ? f.left : f.top;
    const at = (u: number) => origin + u * f.scale - start;
    g.fillStyle = color('--ed-panel', '#f4f4f4');
    g.fillRect(0, 0, length, RULER);
    if (band) {
      g.fillStyle = color('--ed-select', '#7048e8');
      g.globalAlpha = 0.28;
      g.fillRect(at(band[0]), 0, at(band[1]) - at(band[0]), RULER);
      g.globalAlpha = 1;
    }
    g.fillStyle = color('--ed-line', '#ccc');
    g.fillRect(0, RULER - 1, length, 1);
    const { label, minor } = rulerSteps(f.scale);
    const u0 = Math.ceil((start - origin) / f.scale / minor) * minor;
    const u1 = (start + length - origin) / f.scale;
    const ink = color('--ed-muted', '#777');
    g.fillStyle = ink;
    g.font = `10px ${color('--ed-font', 'system-ui, sans-serif')}`;
    g.textBaseline = 'top';
    for (let u = u0; u <= u1; u += minor) {
      const x = Math.round(at(u)) + 0.5;
      const major = Math.abs(u % label) < 1e-6;
      const half = !major && Math.abs(u % (label / 2)) < 1e-6;
      const tick = major ? RULER - 4 : half ? 7 : 4;
      g.fillRect(x - 0.5, RULER - 1 - tick, 1, tick);
      if (!major) continue;
      if (axis === 'x') {
        g.fillText(String(Math.round(u)), x + 3, 2);
        continue;
      }
      // a label of the left ruler is read from the bottom up, as in Keynote
      g.save();
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.translate(2, x - 3);
      g.rotate(-Math.PI / 2);
      g.fillText(String(Math.round(u)), 0, 0);
      g.restore();
    }
  };

  // the extent of the selection on each axis, in slide px
  const extent = (): { x: [number, number]; y: [number, number] } | null => {
    const els = app.selection.elements().filter((el) => el.isConnected);
    if (!els.length) return null;
    const f = frameOf(app);
    const rs = els.map(frameRect).filter((r) => r.width || r.height);
    if (!rs.length) return null;
    const lo = (v: number, o: number) => (v - o) / f.scale;
    return {
      x: [lo(Math.min(...rs.map((r) => r.left)), f.left), lo(Math.max(...rs.map((r) => r.left + r.width)), f.left)],
      y: [lo(Math.min(...rs.map((r) => r.top)), f.top), lo(Math.max(...rs.map((r) => r.top + r.height)), f.top)],
    };
  };

  const draw = () => {
    top.hidden = left.hidden = corner.hidden = !shown;
    if (!shown || app.state !== 'loaded') return;
    const v = stage.viewport;
    Object.assign(corner.style, { left: `${v.left - RULER}px`, top: `${v.top - RULER}px` });
    const e = previewPlays() ? null : extent();
    paint(top, 'x', e?.x ?? null);
    paint(left, 'y', e?.y ?? null);
  };

  const set = (on: boolean) => {
    shown = on;
    store(KEY, on ? '1' : null);
    stage.setRoom(on ? { top: RULER, left: RULER } : { top: 0, left: 0 });
    draw();
  };

  app.listen('resize', draw);
  app.selection.listen(draw);
  app.onRefresh(['content', 'selection', 'slide', 'layout'], draw);
  if (shown) queueMicrotask(() => set(true));

  app.commands.define({
    id: 'view.rulers',
    label: 'Rulers',
    // Safari takes Cmd+R of Keynote before the page, and Chrome and Firefox pass it on. both keys
    // are bound, and the menus list first the one that reaches the page. elsewhere Ctrl+R reloads
    keys: { mac: app.safari ? ['Ctrl+Mod+R', 'Mod+R'] : ['Mod+R', 'Ctrl+Mod+R'], other: ['Alt+Shift+R'] },
    in: OUTSIDE_DIALOGS,
    menu: { bar: 'View', group: 'guides', order: 50 },
    checked: () => shown,
    run: () => set(!shown),
  });
}
