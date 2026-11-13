// the commands of the mask edit of canvas/mask.ts: Edit Mask and Reset Mask in Format > Image, as
// in Keynote, Crop in Format under the name of PowerPoint, and Edit Backdrop Window for the window
// of a backdrop. Edit Mask takes Shift+Cmd+M on a Mac, the key of Keynote. it does not have a key
// on other platforms, since Firefox there takes Ctrl+Shift+M for its responsive design mode

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { imageOf } from './figure.ts';
import { MASK_STYLE, begin, editing, install as installMask, masked, orbitOf, pinned, scaleOf, scaleText, styleEdit } from '../canvas/mask.ts';

// the backdrops of the current slide that an edit of the window can start on
function backdropsOf(app: App): HTMLElement[] {
  const slide = app.current();
  if (!slide) return [];
  return [...slide.querySelectorAll<HTMLElement>('.backdrop')].filter((el) => app.pairing?.elements.get(el)?.open && orbitOf(el) && el.offsetHeight > 0);
}

// the backdrop under the target of a context menu, else the first of the slide
function backdropOf(app: App, arg: unknown): HTMLElement | null {
  const list = backdropsOf(app);
  const t = (arg as { target?: Element | null } | undefined)?.target;
  return list.find((el) => t && el.contains(t)) ?? list[0] ?? null;
}

const startMask = (app: App) => {
  const img = imageOf(app);
  if (img) begin(app, img);
};

const commands = (): Command[] => [
  {
    id: 'image.editMask',
    label: 'Edit Mask',
    keys: { mac: ['Mod+Shift+M'], other: ['Ctrl+Shift+M'] },
    in: ['canvas'],
    menu: { bar: 'Format', group: 'mask', order: 40, submenu: 'Image' },
    context: ['element'],
    enabled: (app) => !!imageOf(app) && !editing(),
    run: startMask,
  },
  {
    id: 'image.resetMask',
    label: 'Reset Mask',
    menu: { bar: 'Format', group: 'mask', order: 41, submenu: 'Image' },
    context: ['element'],
    undoable: true,
    enabled: (app) => {
      const img = imageOf(app);
      return !!img && !editing() && masked(img);
    },
    run: (app) => {
      const img = imageOf(app);
      if (!img) return;
      // a flip is kept, without the zoom of the mask
      const sc = scaleOf(img);
      const style: Record<string, string | null> = { scale: scaleText(Math.sign(sc.x) || 1, Math.sign(sc.y) || 1) };
      for (const n of MASK_STYLE) style[n] = null;
      // a box resized in Edit Mask keeps object-fit contain, without which the theme stretches its
      // picture to the box
      if (pinned(img)) style['object-fit'] = 'contain';
      const edit = styleEdit(app, img, style);
      if (edit) app.doc.setTag(img, edit, 'mask');
    },
  },
  {
    id: 'image.crop',
    label: 'Crop',
    menu: { bar: 'Format', group: 'mask', order: 95 },
    enabled: (app) => !!imageOf(app) && !editing(),
    run: startMask,
  },
  {
    id: 'backdrop.editWindow',
    label: 'Edit Backdrop Window',
    menu: { bar: 'Format', group: 'mask', order: 96 },
    context: ['canvas'],
    enabled: (app) => backdropsOf(app).length > 0 && !editing(),
    run: (app, arg) => {
      const el = backdropOf(app, arg);
      if (el) begin(app, el);
    },
  },
];

export function install(app: App): void {
  installMask(app);
  for (const c of commands()) app.commands.define(c);
}
