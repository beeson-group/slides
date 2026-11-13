// the grid of the canvas, as View > Gridlines, Snap to Grid, and Grid Settings of PowerPoint: lines
// over the slide at a spacing in slide px, 40 by default, at which the x of every layout guide of
// snap.ts lies. with Snap to Grid, an element snaps to the lines of the grid as it snaps to the
// other elements, whether the grid is shown or not. the settings are kept in the storage of the
// browser, and not in the deck

import type { App } from '../app.ts';
import { OUTSIDE_DIALOGS } from '../commands.ts';
import { ask } from '../ui/dialog.ts';
import { injectStyle, make, store, stored } from '../ui/dom.ts';
import { provideLines } from './snap.ts';

const SHOWN = 'beeson-edit-grid';
const SNAP = 'beeson-edit-grid-snap';
const SPACING = 'beeson-edit-grid-spacing';
export const GRID = 40;
const MIN = 5;
const MAX = 480;

const CSS = `
.beeson-grid { position: fixed; z-index: 2; pointer-events: none; left: var(--ed-slide-x, 0px); top: var(--ed-slide-y, 0px); width: var(--ed-slide-w, 0px); height: var(--ed-slide-h, 0px); clip-path: var(--ed-clip, none);
  --grid-ink: color-mix(in srgb, var(--ed-muted, #888) 45%, transparent);
  background-image: linear-gradient(to right, var(--grid-ink) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-ink) 1px, transparent 1px); }
.beeson-grid[hidden] { display: none; }
`;

// a spacing in slide px from a text, or null for one out of range
export function spacingOf(text: string): number | null {
  const n = Number(text.trim());
  return Number.isFinite(n) && n >= MIN && n <= MAX ? Math.round(n) : null;
}

export function install(app: App): void {
  injectStyle('grid', CSS);
  const stage = app.stage;
  const layer = make('div', 'beeson-grid');
  stage.el.append(layer);
  let shown = stored(SHOWN) === '1';
  let snap = stored(SNAP) === '1';
  let spacing = spacingOf(stored(SPACING) ?? '') ?? GRID;

  provideLines(() => ({ grid: snap ? spacing : null }));

  const draw = () => {
    layer.hidden = !shown || app.state !== 'loaded';
    const step = spacing * stage.scale;
    layer.style.backgroundSize = `${step}px ${step}px`;
  };
  const save = () => {
    store(SHOWN, shown ? '1' : null);
    store(SNAP, snap ? '1' : null);
    store(SPACING, spacing === GRID ? null : String(spacing));
    draw();
    app.invalidate('layout');
  };
  app.listen('resize', draw);
  app.onRefresh(['layout', 'slide'], draw);
  queueMicrotask(draw);

  // the sheet of Grid Settings: the spacing, Show Gridlines, and Snap to Grid
  const sheet = async () => {
    const body = make('div');
    const row = (input: HTMLInputElement, text: string) => {
      const label = make('label');
      label.append(input, make('span', '', text));
      body.append(label);
    };
    const size = make('input');
    size.type = 'number';
    size.name = 'spacing';
    size.min = String(MIN);
    size.max = String(MAX);
    size.value = String(spacing);
    const label = make('label');
    label.append(make('span', '', 'Spacing'), size, make('span', '', 'slide px'));
    body.append(label);
    const show = make('input');
    show.type = 'checkbox';
    show.name = 'show';
    show.checked = shown;
    row(show, 'Show gridlines on the slide');
    const snaps = make('input');
    snaps.type = 'checkbox';
    snaps.name = 'snap';
    snaps.checked = snap;
    row(snaps, 'Snap elements to the grid');
    const answer = await ask({
      title: 'Grid Settings',
      body,
      className: 'beeson-grid-sheet form',
      buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'OK', value: 'ok', primary: true }],
    }, 'input[name="spacing"]');
    if (answer !== 'ok') return;
    spacing = spacingOf(size.value) ?? spacing;
    shown = show.checked;
    snap = snaps.checked;
    save();
  };

  const menu = (order: number) => ({ bar: 'View', group: 'guides', order });
  const c = app.commands;
  c.define({
    id: 'view.grid',
    label: 'Gridlines',
    keys: { mac: ["Mod+'"], other: ["Mod+'"] },
    in: OUTSIDE_DIALOGS,
    menu: menu(53),
    checked: () => shown,
    run: () => {
      shown = !shown;
      save();
    },
  });
  c.define({
    id: 'view.grid.snap',
    label: 'Snap to Grid',
    menu: menu(54),
    checked: () => snap,
    run: () => {
      snap = !snap;
      save();
    },
  });
  // with an arg, the spacing is set at once, e.g. by a test
  c.define({
    id: 'view.grid.settings',
    label: 'Grid Settings…',
    menu: menu(55),
    enabled: (a) => a.region() !== 'dialog',
    run: (a, arg) => {
      const n = typeof arg === 'number' ? spacingOf(String(arg)) : null;
      if (n === null) {
        // the command ends at once, and the sheet is answered later
        void sheet().catch((e) => a.fail(e));
        return;
      }
      spacing = n;
      save();
    },
  });
}
