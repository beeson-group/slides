// the pane Backdrop of the inspector, for a selected backdrop: its drawing, chosen from a popup or
// from the gallery of Choose…, the family and the colormap of a drawing of a file, its window, i.e.
// its center and its half height, the labels of the points of a built-in backdrop, and its motion, with the
// Lock button of the Arrange pane. each control runs a command of commands/backdrop.ts, whose writes
// the theme draws again

import type { App } from '../app.ts';
import { COLORMAPS, LABELS, colormapName, drawnBy, entryName, families, isBroucke, library, liveOf, probeLibrary, sameSelection, selectedBackdrop } from '../commands/backdrop.ts';
import { openMenu, type MenuItem } from '../ui/menu.ts';
import { make } from '../ui/dom.ts';
import { button, checkbox, glyph, keepFocus, note, numberField, row, section, type Control, type Run } from './controls.ts';

// a popup button whose menu runs the items of list, as the Paragraph Style popup of inspector/text.ts.
// the menu is opened once ready, if given, has settled
function popup(app: App, label: string, current: () => string, list: () => MenuItem[], enabled: () => boolean, ready?: () => Promise<void>): Control {
  const b = make('button', 'ed-popup');
  b.type = 'button';
  b.setAttribute('aria-haspopup', 'menu');
  b.setAttribute('aria-label', label);
  b.title = label;
  const text = make('span');
  b.append(text, glyph('chevron-down', 16));
  const open = (keyboard: boolean) => openMenu(app, list(), { anchor: b.getBoundingClientRect(), placement: 'below', owner: b, keyboard, label, className: 'select', onClose: () => sync() });
  let asked = 0;
  const show = (keyboard: boolean) => {
    if (!ready) return void open(keyboard);
    const ask = ++asked;
    void ready().catch(() => {}).then(() => {
      if (ask === asked && b.isConnected) open(keyboard);
    });
  };
  keepFocus(b);
  b.addEventListener('pointerdown', () => show(false));
  b.addEventListener('click', (ev) => {
    if (ev.detail === 0) show(true);
  });
  const sync = () => {
    text.textContent = current();
    b.disabled = !enabled();
  };
  sync();
  return { el: b, sync };
}

// parts in a box that is shown while shown() is true, so that the pane follows a change of the
// drawing between a built-in backdrop and a file without being built again
function when(shown: () => boolean, parts: Control[]): Control {
  const box = make('div');
  box.append(...parts.map((p) => p.el));
  const sync = () => {
    box.hidden = !shown();
    for (const p of parts) p.sync();
  };
  sync();
  return { el: box, sync, flush: () => parts.forEach((p) => p.flush?.()) };
}

export function backdropPane(app: App, run: Run): Control[] {
  const el = selectedBackdrop(app);
  const live = () => liveOf(el);
  const view = () => live()?.view ?? null;
  const on = () => !!el?.isConnected && !!live() && !el.hasAttribute('data-locked');
  const file = () => !!el?.hasAttribute('data-trajectories');
  const field = (label: string, key: 'cx' | 'cy' | 'half', id: string) => numberField(app, {
    label, unit: '', step: 0.01, min: key === 'half' ? 0.01 : -100, max: 100,
    value: () => view()?.[key] ?? null,
    enabled: on,
    command: `backdrop.${id}`,
    commit: (value) => run(`backdrop.${id}`, { value, el }),
  });
  const drawing = popup(app, 'Drawing', () => (el ? entryName(el) : ''), () => library(app).map((e) => ({
    label: e.name,
    checked: !!el && drawnBy(e, el),
    disabled: !!e.missing,
    run: () => run('backdrop.builtIn', { value: e.key, el }),
  })), on, () => probeLibrary(app));
  const parts: Control[] = [
    section('Drawing', [
      drawing,
      row([button(app, run, { command: 'backdrop.choose', text: 'Choose…' })]),
      when(file, [
        when(() => isBroucke(el), [popup(app, 'Family', () => (el && isBroucke(el) ? families(app, el).find((f) => sameSelection(f.spec, el.getAttribute('data-trajectories-select'), el))?.name ?? '' : ''), () => (el ? families(app, el) : []).map((f) => ({
          label: f.name,
          checked: sameSelection(el?.getAttribute('data-trajectories-select') ?? null, f.spec, el),
          run: () => run('backdrop.family', { value: f.spec, el }),
        })), on)]),
        popup(app, 'Colormap', () => colormapName(el?.getAttribute('data-trajectories-colormap') ?? null), () => [null, ...COLORMAPS].map((c) => ({
          label: colormapName(c),
          checked: (el?.getAttribute('data-trajectories-colormap') ?? null) === c,
          run: () => run('backdrop.colormap', { value: c, el }),
        })), on),
        note(() => 'The trajectories are chosen and colored by the data-trajectories attributes of the file, as REFERENCE.md describes.'),
      ]),
    ]),
    section('Window', [
      row([field('Center X', 'cx', 'cx'), field('Center Y', 'cy', 'cy')]),
      row([field('Half Height', 'half', 'half'), { el: make('div', 'ed-num'), sync: () => {} }]),
      row([button(app, run, { command: 'backdrop.zoomIn', arg: { el }, text: 'Zoom In' }), button(app, run, { command: 'backdrop.zoomOut', arg: { el }, text: 'Zoom Out' })]),
      row([button(app, run, { command: 'backdrop.edit', arg: { el }, text: 'Edit Window…' }), button(app, run, { command: 'backdrop.fitWindow', arg: { el }, text: 'Fit Window' })]),
      note(() => 'Drag the drawing or use the arrow keys to pan it, and drag a handle to resize its box.'),
    ]),
  ];
  parts.push(when(() => !file(), [section('Labels', [
    row(LABELS.slice(0, 2).map((l) => labelBox(app, run, el, l.at, l.name))),
    row(LABELS.slice(2).map((l) => labelBox(app, run, el, l.at, l.name))),
  ])]));
  const traced = !!el?.closest('section')?.matches('.title, .section, .closing');
  parts.push(
    section('Motion', [
      checkbox(app, run, 'backdrop.live', 'Live'),
      row([numberField(app, {
        label: 'Duration', unit: 's', step: 1, min: 0, max: 600,
        value: () => (el?.hasAttribute('data-duration') ? Number(el.getAttribute('data-duration')) : null),
        enabled: on,
        command: 'backdrop.duration',
        commit: (value) => run('backdrop.duration', { value, el }),
      }), button(app, run, { command: 'backdrop.preview', arg: { el }, text: 'Preview' })]),
      note(() => (traced ? 'A backdrop of a title, section, or closing slide is traced in the show without Live.' : 'Live traces the backdrop when its slide is shown.')),
    ]),
    section(null, [row([button(app, run, { command: 'arrange.lock', icon: 'lock', text: 'Lock' }), button(app, run, { command: 'arrange.unlock', icon: 'unlock', text: 'Unlock' })])]),
  );
  return parts;
}

// a checkbox of the label of a point, checked while the backdrop has it
function labelBox(app: App, run: Run, el: HTMLElement | null, at: string, name: string): Control {
  const c = checkbox(app, run, 'backdrop.label', name, () => !!el && [...el.querySelectorAll(':scope > .label')].some((l) => l.getAttribute('data-at') === at));
  // the command is run with the point, which checkbox() does not pass
  c.el.addEventListener('click', (ev) => {
    ev.stopImmediatePropagation();
    ev.preventDefault();
    if (!c.el.classList.contains('off')) void Promise.resolve(run('backdrop.label', { at, el })).then(() => setTimeout(c.sync));
  }, true);
  return c;
}
