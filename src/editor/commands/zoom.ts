// the commands of View > Zoom: Fit, Actual Size, Zoom to Selection, Zoom In, and Zoom Out of the
// canvas, and the zoom of the text of the notes. Mod+= and Mod+- change the text of the notes
// while the focus is in them, since the zoom of PowerPoint acts on the pane in use. on a Mac,
// Fit, Actual Size, and Zoom to Selection take the keys of Keynote, Cmd+Option+0, Cmd+0, and
// Cmd+Shift+0. the keys of Figma, Shift+1, Shift+0, and Shift+2, are bound on every platform,
// since Ctrl+Alt is not bound on Windows and Linux

import type { App, Region } from '../app.ts';

// the zoom keys of the canvas are taken everywhere but in a field, a dialog, and the notes, which
// take the same keys for their text
const CANVAS_ZOOM: Region[] = ['canvas', 'text', 'navigator', 'inspector'];

// the box of the selected elements, or of the block of the text, in slide px
function selectionBox(app: App): { left: number; top: number; width: number; height: number } | null {
  const sel = app.selection;
  const els = sel.kind === 'elements' || sel.kind === 'text' ? sel.items.filter((el) => el.isConnected) : [];
  const rects = els.map((el) => el.getBoundingClientRect()).filter((r) => r.width || r.height);
  if (!rects.length) return null;
  const a = app.stage.toSlide({ x: Math.min(...rects.map((r) => r.left)), y: Math.min(...rects.map((r) => r.top)) });
  const b = app.stage.toSlide({ x: Math.max(...rects.map((r) => r.right)), y: Math.max(...rects.map((r) => r.bottom)) });
  return { left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y };
}

export function install(app: App): void {
  const c = app.commands;
  const menu = (group: string, order: number) => ({ bar: 'View', group, order, submenu: 'Zoom' });
  c.define({
    id: 'zoom.fit',
    label: 'Fit',
    keys: { mac: ['Mod+Alt+0', 'Shift+1'], other: ['Shift+1'] },
    menu: menu('zoom', 20),
    checked: (a) => a.stage.zoom === null,
    run: (a) => a.stage.setZoom(null),
  });
  c.define({
    id: 'zoom.actual',
    label: 'Actual Size',
    keys: { mac: ['Mod+0', 'Shift+0'], other: ['Mod+0', 'Shift+0'] },
    in: CANVAS_ZOOM,
    menu: menu('zoom', 21),
    run: (a) => a.stage.setZoom(1),
  });
  c.define({
    id: 'zoom.selection',
    label: 'Zoom to Selection',
    keys: { mac: ['Mod+Shift+0', 'Shift+2'], other: ['Shift+2'] },
    menu: menu('zoom', 22),
    enabled: (a) => !!selectionBox(a),
    run: (a) => {
      const box = selectionBox(a);
      if (box) a.stage.zoomTo(box);
    },
  });
  c.define({
    id: 'zoom.in',
    label: 'Zoom In',
    keys: { mac: ['Mod+=', 'Mod++'], other: ['Mod+=', 'Mod++'] },
    in: CANVAS_ZOOM,
    menu: menu('step', 23),
    run: (a) => a.stage.zoomIn(),
  });
  c.define({
    id: 'zoom.out',
    label: 'Zoom Out',
    keys: { mac: ['Mod+-'], other: ['Mod+-'] },
    in: CANVAS_ZOOM,
    menu: menu('step', 24),
    run: (a) => a.stage.zoomOut(),
  });

  const notes = (id: string, label: string, keys: string[], order: number, way: 1 | -1 | 0) =>
    c.define({ id, label, keys: { mac: keys, other: keys }, in: ['notes'], menu: menu('notes', order), enabled: (a) => a.notes.shown(), run: (a) => a.notes.zoomText(way) });
  notes('notes.zoomIn', 'Bigger Notes Text', ['Mod+=', 'Mod++'], 30, 1);
  notes('notes.zoomOut', 'Smaller Notes Text', ['Mod+-'], 31, -1);
  notes('notes.zoomReset', 'Notes Text at 100%', ['Mod+0'], 32, 0);
}
