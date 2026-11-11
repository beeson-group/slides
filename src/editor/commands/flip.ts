// Flip Horizontal and Flip Vertical of an image, in the Arrange menu, its context menu, and the
// Arrange pane. a flip is the sign of the declaration scale, e.g. scale: -1 1, which keeps the zoom
// of a mask of canvas/mask.ts. the picture is mirrored where it is. a video, a QR code, and a block
// are not flipped

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { placeOf, seenCenter } from '../canvas/drag.ts';
import { frameOf, objectOf } from '../canvas/hit.ts';
import { imageOf } from './figure.ts';
import { editing, scaleOf, scaleText, styleEdit } from '../canvas/mask.ts';

export const flipped = (el: Element) => {
  const sc = scaleOf(el);
  return { x: sc.x < 0, y: sc.y < 0 };
};

function flip(app: App, axis: 'x' | 'y'): void {
  const img = imageOf(app);
  if (!img) return;
  const sc = scaleOf(img);
  const edit = styleEdit(app, img, { scale: scaleText(axis === 'x' ? -sc.x : sc.x, axis === 'y' ? -sc.y : sc.y) });
  if (!edit) return;
  const at = seenCenter(app, img);
  app.doc.setTag(img, edit, 'flip');
  // an image fitted at a side of its box, e.g. in a plate, is mirrored across its box, hence the
  // offset of its figure puts the picture back where it was, as a flip of both apps leaves it
  const c = seenCenter(app, img), k = frameOf(app).scale;
  const dx = Math.round((at.x - c.x) / k), dy = Math.round((at.y - c.y) / k);
  if (dx || dy) {
    const carrier = objectOf(app, img);
    const t = placeOf(carrier).translate ?? { x: 0, y: 0 };
    const to = { x: Math.round(t.x + dx), y: Math.round(t.y + dy) };
    app.doc.setTag(carrier, { translate: to.x || to.y ? to : null }, 'flip');
  }
  app.invalidate('content');
}

const commands = (): Command[] => (['x', 'y'] as const).map((axis, i) => ({
  id: axis === 'x' ? 'arrange.flipHorizontal' : 'arrange.flipVertical',
  label: axis === 'x' ? 'Flip Horizontal' : 'Flip Vertical',
  menu: { bar: 'Arrange', group: 'flip', order: 14 + i },
  context: ['element'],
  undoable: true,
  enabled: (app: App) => !!imageOf(app) && !editing(),
  run: (app: App) => flip(app, axis),
}));

export function install(app: App): void {
  for (const c of commands()) app.commands.define(c);
}
