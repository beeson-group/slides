// the Shape pane of the Format tab, for one or more selected shapes, as the Style tab of a shape in
// Keynote: the geometry in a pop-up, a swatch of each tone, the fill, the width of the outline, and
// the corners of a rounded rectangle. each control runs a command of commands/shape.ts by its id

import type { App } from '../app.ts';
import { CORNERS, FILLS, SHAPE_KINDS, WEIGHTS, kindOf, selectedShapes } from '../commands/shape.ts';
import { make } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { closeMenus, menuOpen, openMenu } from '../ui/menu.ts';
import { row, section, segmented, type Control, type Run } from './controls.ts';
import { swatches } from './line.ts';

// the pop-up of the geometry, which lists every kind of shape with the kind of the selection checked
function kindButton(app: App, run: Run): Control {
  const b = make('button', 'beeson-edit-select ed-shape-kind');
  b.type = 'button';
  b.setAttribute('aria-haspopup', 'menu');
  b.setAttribute('aria-expanded', 'false');
  b.setAttribute('aria-label', 'Shape');
  const text = make('span', 'value');
  b.append(text, icon('chevron-down', 10));
  const now = () => {
    const kinds = new Set(selectedShapes(app).map(kindOf));
    return kinds.size === 1 ? [...kinds][0] : null;
  };
  const open = (keyboard: boolean) => {
    const value = now();
    const items = SHAPE_KINDS.map(([kind, label]) => ({ label, checked: value === kind, run: () => void run(`shape.kind.${kind}`) }));
    openMenu(app, items, { anchor: b.getBoundingClientRect(), placement: 'below', owner: b, keyboard, label: 'Shape', className: 'select' });
  };
  b.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    if (menuOpen() && b.getAttribute('aria-expanded') === 'true') closeMenus();
    else open(false);
  });
  b.addEventListener('click', (ev) => {
    if (ev.detail === 0) open(true);
  });
  const sync = () => {
    b.disabled = !selectedShapes(app).length;
    const value = now();
    text.textContent = value ? SHAPE_KINDS.find(([k]) => k === value)![1] : 'Mixed';
  };
  sync();
  return { el: b, sync };
}

const items = (prefix: string, list: [string, string, string | null][]) => list.map(([id, label]) => ({ command: `shape.${prefix}.${id}`, text: label, title: label }));

export function shapePane(app: App, run: Run): Control[] {
  return [
    section('Shape', [kindButton(app, run)]),
    section('Color', [row([swatches(app, run, 'shape.tone', 'Shape color')])]),
    section('Fill', [segmented(app, run, items('fill', FILLS), 'Fill')]),
    section('Outline', [segmented(app, run, items('weight', WEIGHTS), 'Outline')]),
    section('Corners', [segmented(app, run, items('corner', CORNERS), 'Corners')]),
  ];
}
