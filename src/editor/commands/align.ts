// the commands of Align, Distribute, and the size and position fields of the Arrange tab of the
// inspector, in the Arrange menu. Align to Slide and Align to Selection is a switch, as in
// PowerPoint, and a single element is aligned to the slide in either case, as in Keynote. every
// command of a selection is one entry of the history, with the offsets written as translate and the
// widths as width, in slide pixels, by writePlace of canvas/drag.ts

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { RESIZABLE, STRETCHED, aspectOf, constrained, cssWidth, frameOf, isTextSized, kindOf, movableOf, pictureSize, sizedOf, toSlide, visualRect } from '../canvas/hit.ts';
import type { Box } from '../canvas/snap.ts';
import { placeOf, record, writePlace, type Place } from '../canvas/drag.ts';
import { declarationProblem } from '../model/scope.ts';
import { store } from '../ui/dom.ts';

export type Side = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export const SIDES: Side[] = ['left', 'center', 'right', 'top', 'middle', 'bottom'];
const SIDE_LABELS: Record<Side, string> = { left: 'Left', center: 'Center', right: 'Right', top: 'Top', middle: 'Middle', bottom: 'Bottom' };

// the reference of Align and Distribute, kept for the session
let reference: 'slide' | 'selection' = 'selection';

// the elements that the commands of this file act on: those selected on the canvas, or the block
// of a text that has the caret. arg.els, given by a field of the inspector, is taken in their place
export function targetsOf(app: App, arg?: unknown): Element[] {
  const given = (arg as { els?: Element[] } | undefined)?.els;
  if (given) return given.filter((el) => el.isConnected);
  if (app.selection.kind === 'text') {
    const host = app.selection.items[0];
    const el = host ? (movableOf(app, host) ?? host) : null;
    return el && app.pairing?.elements.get(el)?.open ? [el] : [];
  }
  return app.selection.elements().filter((el) => app.pairing?.elements.get(el)?.open);
}

// the box of el in slide pixels, as the frames draw it
export const boxOf = (app: App, el: Element): Box => toSlide(frameOf(app), visualRect(el));

function slideBox(app: App): Box {
  const slides = app.slides() as HTMLElement;
  return { left: 0, top: 0, width: slides.offsetWidth || 1920, height: slides.offsetHeight || 1080 };
}

const union = (boxes: Box[]): Box => {
  const left = Math.min(...boxes.map((b) => b.left)), top = Math.min(...boxes.map((b) => b.top));
  return { left, top, width: Math.max(...boxes.map((b) => b.left + b.width)) - left, height: Math.max(...boxes.map((b) => b.top + b.height)) - top };
};

const toSlideRef = (els: Element[]) => reference === 'slide' || els.length === 1;

// each element moved by its offset dx and dy, as one entry of the history
function shift(app: App, label: string, moves: { el: Element; dx: number; dy: number }[]): void {
  const changes = moves.map(({ el, dx, dy }) => {
    const from = placeOf(el);
    const to: Place = { ...from, translate: { x: (from.translate?.x ?? 0) + dx, y: (from.translate?.y ?? 0) + dy } };
    writePlace(app, el, to);
    return { el, from, to: placeOf(el) };
  });
  record(app, label, changes);
  app.invalidate('content');
}

function align(app: App, side: Side): void {
  const els = targetsOf(app);
  if (!els.length) return;
  const boxes = els.map((el) => boxOf(app, el));
  const ref = toSlideRef(els) ? slideBox(app) : union(boxes);
  const at = (b: Box) => {
    switch (side) {
      case 'left': return { dx: ref.left - b.left, dy: 0 };
      case 'center': return { dx: ref.left + ref.width / 2 - (b.left + b.width / 2), dy: 0 };
      case 'right': return { dx: ref.left + ref.width - (b.left + b.width), dy: 0 };
      case 'top': return { dx: 0, dy: ref.top - b.top };
      case 'middle': return { dx: 0, dy: ref.top + ref.height / 2 - (b.top + b.height / 2) };
      case 'bottom': return { dx: 0, dy: ref.top + ref.height - (b.top + b.height) };
    }
  };
  shift(app, `align ${side}`, els.map((el, i) => ({ el, ...at(boxes[i]) })));
}

// the elements spaced evenly along an axis, with the first and the last of them kept in place, or
// put at the edges of the slide with Align to Slide, as in PowerPoint
function distribute(app: App, axis: 'x' | 'y'): void {
  const els = targetsOf(app);
  const items = els.map((el) => ({ el, b: boxOf(app, el) }));
  const start = (b: Box) => (axis === 'x' ? b.left : b.top);
  const size = (b: Box) => (axis === 'x' ? b.width : b.height);
  items.sort((a, b) => start(a.b) - start(b.b));
  const ref = reference === 'slide' ? slideBox(app) : union(items.map((i) => i.b));
  const total = items.reduce((s, i) => s + size(i.b), 0);
  const gap = (size(ref) - total) / (items.length - 1);
  let at = start(ref);
  const moves = items.map((i) => {
    const d = at - start(i.b);
    at += size(i.b) + gap;
    return { el: i.el, dx: axis === 'x' ? d : 0, dy: axis === 'y' ? d : 0 };
  });
  shift(app, `distribute ${axis === 'x' ? 'horizontally' : 'vertically'}`, moves);
}

const canDistribute = (app: App) => {
  const n = targetsOf(app).length;
  return n >= 3 || (reference === 'slide' && n >= 2);
};

// whether the width of every target is written by the editor, by the scope rule, and whether its
// height is set by the field H, i.e. every target is a picture and none a text block
export const resizable = (els: Element[]) => els.length > 0 && els.every((el) => el.matches(RESIZABLE) || isTextSized(el));
export const heightSet = (els: Element[]) => els.length > 0 && els.every((el) => el.matches(RESIZABLE));

// the offset of an element from its place in the file, which the X and Y fields show
export function offsetOf(el: Element): { x: number; y: number } {
  const t = placeOf(el).translate;
  return { x: t?.x ?? 0, y: t?.y ?? 0 };
}

// the size of an element in slide pixels, unscaled, at its picture for an image or a video
export const sizeOf = (el: Element): { w: number; h: number } => pictureSize(el);

export function commands(): Command[] {
  const list: Command[] = [];
  for (const [i, side] of SIDES.entries()) {
    list.push({
      id: `arrange.align.${side}`,
      label: `Align ${SIDE_LABELS[side]}`,
      menu: { bar: 'Arrange', group: i < 3 ? 'x' : 'y', order: 20 + i, submenu: 'Align' },
      undoable: true,
      enabled: (app) => targetsOf(app).length > 0,
      run: (app) => align(app, side),
    });
  }
  for (const [i, ref] of (['slide', 'selection'] as const).entries()) {
    list.push({
      id: `arrange.alignTo.${ref}`,
      label: ref === 'slide' ? 'Align to Slide' : 'Align to Selection',
      menu: { bar: 'Arrange', group: 'reference', order: 30 + i, submenu: 'Align' },
      checked: () => reference === ref,
      run: (app) => {
        reference = ref;
        app.invalidate('selection');
      },
    });
  }
  for (const [i, axis] of (['x', 'y'] as const).entries()) {
    list.push({
      id: `arrange.distribute.${axis === 'x' ? 'horizontal' : 'vertical'}`,
      label: axis === 'x' ? 'Distribute Horizontally' : 'Distribute Vertically',
      menu: { bar: 'Arrange', group: 'distribute', order: 40 + i, submenu: 'Distribute' },
      undoable: true,
      enabled: canDistribute,
      run: (app) => distribute(app, axis),
    });
  }
  // arg is { x, y, els }, with x or y left out to keep it
  list.push({
    id: 'arrange.setPosition',
    label: 'Position',
    undoable: true,
    enabled: (app) => targetsOf(app).length > 0,
    run: (app, arg) => {
      const a = (arg ?? {}) as { x?: number; y?: number };
      const changes = targetsOf(app, arg).map((el) => {
        const from = placeOf(el);
        const now = offsetOf(el);
        writePlace(app, el, { ...from, translate: { x: a.x ?? now.x, y: a.y ?? now.y } });
        return { el, from, to: placeOf(el) };
      });
      record(app, 'position', changes);
      app.invalidate('content');
    },
  });
  // arg is { w, h, els }. an image or a video with its switch Constrain Proportions on keeps the
  // aspect that it has, and with the switch off it is stretched, with its height written. for any
  // other picture, a height is written as the width at its aspect, and a text block takes a width
  list.push({
    id: 'arrange.setSize',
    label: 'Size',
    undoable: true,
    enabled: (app) => resizable(targetsOf(app)),
    run: (app, arg) => {
      const a = (arg ?? {}) as { w?: number; h?: number };
      const els = targetsOf(app, arg);
      if (!resizable(els)) return;
      const changes = els.map((el) => {
        const from = placeOf(el);
        const now = sizeOf(el);
        if (isTextSized(el)) {
          if (a.w !== undefined) writePlace(app, el, { ...from, width: Math.max(1, cssWidth(el, a.w)) });
        } else if (el.matches(STRETCHED)) {
          const keep = constrained(el);
          const aspect = now.w / Math.max(1, now.h);
          let w = now.w, h = now.h;
          if (a.w !== undefined) [w, h] = [a.w, keep ? a.w / aspect : now.h];
          else if (a.h !== undefined) [w, h] = [keep ? a.h * aspect : now.w, a.h];
          const stretch = !keep || (from.height ?? null) !== null;
          writePlace(app, el, { ...from, width: Math.max(1, w), height: stretch ? Math.max(1, h) : null });
        } else {
          const aspect = aspectOf(el) ?? now.w / Math.max(1, now.h);
          const w = a.w ?? (a.h !== undefined ? a.h * aspect : now.w);
          writePlace(app, el, { ...from, width: Math.max(1, w) });
        }
        return { el, from, to: placeOf(el) };
      });
      record(app, 'resize', changes);
      app.invalidate('content');
    },
  });
  // the switch Constrain Proportions of the size fields, as in Keynote and PowerPoint. it is kept
  // per kind of picture in the browser and written nowhere in the file. it is held on for a QR code,
  // whose height the scope rule does not write, since its square then follows its width
  list.push({
    id: 'arrange.constrainProportions',
    label: 'Constrain Proportions',
    enabled: (app) => picturesOf(app).some(heightWritten),
    checked: (app) => {
      const pics = picturesOf(app);
      return pics.length > 0 && pics.every(constrained);
    },
    run: (app) => {
      const pics = picturesOf(app).filter(heightWritten);
      const on = !pics.every(constrained);
      for (const m of pics) store(`beeson-edit-constrain-${kindOf(m)}`, on ? 'on' : 'off');
      app.invalidate('selection');
    },
  });
  return list;
}

// the shown images, videos, QR codes, and viewers whose size the fields of the selection set,
// including those that a selected figure holds. the image of the other mode shares their kind
const picturesOf = (app: App): Element[] => [...new Set(targetsOf(app).flatMap(sizedOf))].filter((m) => m.matches(RESIZABLE) && m.getBoundingClientRect().width > 0);
const heightWritten = (el: Element): boolean => declarationProblem(el.localName, [...el.classList], 'height', '1px') === null;

export function install(app: App): void {
  for (const c of commands()) app.commands.define(c);
}
