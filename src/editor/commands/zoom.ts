// the commands of View > Zoom: Fit, Actual Size, Zoom to Selection, Zoom In, Zoom Out, and a typed
// percentage of the canvas, and the zoom of the text of the notes. Zoom In, Zoom Out, and Actual
// Size change the text of the notes while the focus is in them, since the zoom of PowerPoint acts
// on the pane in use, and their keys are thus listed once in the menu. on a Mac, Fit, Actual Size,
// and Zoom to Selection take the keys of Keynote, Cmd+Option+0, Cmd+0, and Cmd+Shift+0. the keys
// of Figma, Shift+1, Shift+0, and Shift+2, are bound on every platform, since Ctrl+Alt is not
// bound on Windows and Linux

import type { App, Region } from '../app.ts';
import { frameRect } from '../canvas/hit.ts';
import { MAX_ZOOM, MIN_ZOOM } from '../shell/canvas.ts';
import { ask } from '../ui/dialog.ts';
import { make } from '../ui/dom.ts';

// the zoom keys are taken everywhere but in a field and a dialog
const CANVAS_ZOOM: Region[] = ['canvas', 'text', 'navigator', 'inspector', 'notes'];

// the zoom of the text of the notes while the focus is in them, and else of the canvas
const inNotes = (app: App, way: 1 | -1 | 0): boolean => {
  if (app.region() !== 'notes') return false;
  app.notes.zoomText(way);
  return true;
};

// the box of the frames of the selected elements, or of the block of the text, in slide px
function selectionBox(app: App): { left: number; top: number; width: number; height: number } | null {
  const sel = app.selection;
  const els = sel.kind === 'elements' || sel.kind === 'text' ? sel.items.filter((el) => el.isConnected) : [];
  const rects = els.map(frameRect).filter((r) => r.width || r.height).map((r) => ({ left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height }));
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
    label: 'Fit Slide',
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
    run: (a) => void (inNotes(a, 0) || a.stage.setZoom(1)),
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
    run: (a) => void (inNotes(a, 1) || a.stage.zoomIn()),
  });
  c.define({
    id: 'zoom.out',
    label: 'Zoom Out',
    keys: { mac: ['Mod+-'], other: ['Mod+-'] },
    in: CANVAS_ZOOM,
    menu: menu('step', 24),
    run: (a) => void (inNotes(a, -1) || a.stage.zoomOut()),
  });
  // the Percent field of the Zoom dialog of PowerPoint, clamped to the range of the slider
  c.define({
    id: 'zoom.custom',
    label: 'Zoom…',
    menu: menu('step', 25),
    run: async (a) => {
      const field = make('input');
      field.type = 'number';
      field.name = 'percent';
      field.min = String(MIN_ZOOM * 100);
      field.max = String(MAX_ZOOM * 100);
      field.value = String(Math.round((a.stage.zoom ?? a.stage.fitScale()) * 100));
      const body = make('label');
      body.append(make('span', '', 'Percent'), field, make('span', '', '%'));
      const answer = await ask({ title: 'Zoom', body, className: 'form', buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'OK', value: 'ok', primary: true }] }, 'input[name="percent"]');
      const typed = parseFloat(field.value);
      if (answer === 'ok' && Number.isFinite(typed)) a.stage.setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, typed / 100)));
    },
  });

  const notes = (id: string, label: string, order: number, way: 1 | -1 | 0) =>
    c.define({ id, label, menu: menu('notes', order), enabled: (a) => a.notes.shown(), run: (a) => a.notes.zoomText(way) });
  notes('notes.zoomIn', 'Bigger Notes Text', 30, 1);
  notes('notes.zoomOut', 'Smaller Notes Text', 31, -1);
  notes('notes.zoomReset', 'Notes Text at 100%', 32, 0);
}
