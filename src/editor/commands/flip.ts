// Flip Horizontal and Flip Vertical of an image, in the Arrange menu, its context menu, and the
// Arrange pane. a flip is the sign of the declaration scale, e.g. scale: -1 1, which keeps the zoom
// of a mask of canvas/mask.ts. a video, a QR code, and a block are not flipped

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { imageOf } from './figure.ts';
import { editing, scaleOf, scaleText, setPictureStyle } from '../canvas/mask.ts';

export const flipped = (el: Element) => {
  const sc = scaleOf(el);
  return { x: sc.x < 0, y: sc.y < 0 };
};

function flip(app: App, axis: 'x' | 'y'): void {
  const img = imageOf(app);
  if (!img) return;
  const sc = scaleOf(img);
  setPictureStyle(app, img, { scale: scaleText(axis === 'x' ? -sc.x : sc.x, axis === 'y' ? -sc.y : sc.y) }, 'flip');
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
