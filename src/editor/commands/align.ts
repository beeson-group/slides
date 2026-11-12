// the commands of Align, Distribute, and the size and position fields of the Arrange tab of the
// inspector, in the Arrange menu. Align to Slide and Align to Selection is a switch, as in
// PowerPoint, and a single element is aligned to the slide in either case, as in Keynote. every
// command of a selection is one entry of the history, with the offsets written as translate and the
// widths as width, in slide pixels, by writePlace of canvas/drag.ts

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { CONTAINER, LINE, RESIZABLE, STRETCHED, aspectOf, captionsOf, pictureReach, constrained, cssWidth, frameOf, frameRect, isTextSized, kindOf, movableOf, objectsOf, orientedBox, pictureOf, pictureSize, sizedOf, snapBoxOf, toSlide, unturnedRect } from '../canvas/hit.ts';
import type { Box } from '../canvas/snap.ts';
import { angleOf, locked, placeOf, record, withCorners, writePlace, type Change, type Place } from '../canvas/drag.ts';
import { groupFrame, groupReach, turned } from '../canvas/frames.ts';
import { groupAngle, groupOf } from './order.ts';
import { declarationProblem } from '../model/scope.ts';
import { store } from '../ui/dom.ts';

export type Side = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export const SIDES: Side[] = ['left', 'center', 'right', 'top', 'middle', 'bottom'];
const SIDE_LABELS: Record<Side, string> = { left: 'Left', center: 'Center', right: 'Right', top: 'Top', middle: 'Middle', bottom: 'Bottom' };

// the reference of Align and Distribute, kept for the session
let reference: 'slide' | 'selection' = 'selection';

// the elements selected on the canvas, or the block of a text that has the caret
export function selectedTargets(app: App): Element[] {
  if (app.selection.kind === 'text') {
    const host = app.selection.items[0];
    const el = host ? (movableOf(app, host) ?? host) : null;
    return el && app.pairing?.elements.get(el)?.open ? [el] : [];
  }
  return app.selection.elements().filter((el) => app.pairing?.elements.get(el)?.open);
}

// the elements that the commands of this file act on: the selected ones, with the figure of a
// picture selected inside it, since a picture with its caption is one object. arg.els, given by a
// field of the inspector, is taken in their place
export function targetsOf(app: App, arg?: unknown): Element[] {
  const given = (arg as { els?: Element[] } | undefined)?.els;
  if (given) return given.filter((el) => el.isConnected);
  return objectsOf(app, selectedTargets(app));
}

// the element whose size is set for el: the shown picture of a figure, or el
export const sizedTarget = (el: Element): Element => (el.matches(CONTAINER) ? pictureOf(el) : el);

// the box of el in slide pixels at its frame, as the frames draw it
export const boxOf = (app: App, el: Element): Box => toSlide(frameOf(app), frameRect(el));

// the box in slide pixels of els when they are one whole group, at the frame of the group, or null
export function groupBoxOf(app: App, els: Element[]): Box | null {
  const id = els.length > 1 ? groupOf(els[0]) : null;
  if (!id || !els.every((el) => groupOf(el) === id)) return null;
  return toSlide(frameOf(app), groupReach(els));
}

// the frame of els when they are one whole group, in slide pixels without its rotation about its
// center, and the angle of its first member that it is turned by, or null
export function groupFrameOf(app: App, els: Element[]): { box: Box; deg: number } | null {
  if (!groupBoxOf(app, els)) return null;
  const deg = groupAngle(app, els) ?? 0;
  return { box: toSlide(frameOf(app), groupFrame(els, deg)), deg };
}

// the members of a group scaled by kx and ky along the axes of its frame, turned by deg, about the
// upper left corner of the frame, as a drag of its corner grip scales them. a picture is stretched
// where kx and ky differ, and a text block keeps the place of its top under its wrapped text
function scaleGroup(app: App, els: Element[], frame: { box: Box; deg: number }, kx: number, ky: number): Change[] {
  const f = frameOf(app);
  const corner = turned(frame.box, frame.deg, frame.box.left, frame.box.top);
  const a = (frame.deg * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const changes: Change[] = [];
  for (const el of els.filter((el) => !locked(el) && !els.some((o) => o !== el && o.contains(el)))) {
    const s = sizedTarget(el), pic = pictureOf(el), deg = angleOf(el);
    // the center of the member, or the middle of the top of a text block, turned with it
    const point = () => {
      const b = toSlide(f, orientedBox(pic, f.scale, deg)), up = isTextSized(pic) ? b.height / 2 : 0, r = (deg * Math.PI) / 180;
      return { b, x: b.left + b.width / 2 + up * Math.sin(r), y: b.top + b.height / 2 - up * Math.cos(r) };
    };
    const was = point(), place = placeOf(el), size = placeOf(s);
    if (s.matches(RESIZABLE) || isTextSized(s)) {
      const stretch = s.matches(STRETCHED) && (kx !== ky || (size.height ?? null) !== null);
      writePlace(app, s, { ...size, width: Math.max(1, cssWidth(s, was.b.width * kx)), height: stretch ? Math.max(1, was.b.height * ky) : size.height });
    }
    // the point of the member in the axes of the frame, scaled from the corner
    const vx = was.x - corner.x, vy = was.y - corner.y;
    const lx = (vx * cos + vy * sin) * kx, ly = (vy * cos - vx * sin) * ky;
    const now = point(), at = placeOf(el);
    writePlace(app, el, { ...at, translate: { x: (at.translate?.x ?? 0) + corner.x + lx * cos - ly * sin - now.x, y: (at.translate?.y ?? 0) + corner.y + lx * sin + ly * cos - now.y } });
    changes.push({ el, from: place, to: placeOf(el) });
    if (s !== el) changes.push({ el: s, from: size, to: placeOf(s) });
  }
  return changes;
}

function slideBox(app: App): Box {
  const slides = app.slides() as HTMLElement;
  return { left: 0, top: 0, width: slides.offsetWidth || 1920, height: slides.offsetHeight || 1080 };
}

const union = (boxes: Box[]): Box => {
  const left = Math.min(...boxes.map((b) => b.left)), top = Math.min(...boxes.map((b) => b.top));
  return { left, top, width: Math.max(...boxes.map((b) => b.left + b.width)) - left, height: Math.max(...boxes.map((b) => b.top + b.height)) - top };
};

// the objects that Align and Distribute move: each whole group of the targets is one object at the
// box of its frame, whose members are moved together, as a group of Keynote is one object
function objects(app: App): { els: Element[]; b: Box }[] {
  const byGroup = new Map<string | Element, Element[]>();
  for (const el of targetsOf(app)) {
    const key = groupOf(el) ?? el;
    byGroup.set(key, [...(byGroup.get(key) ?? []), el]);
  }
  return [...byGroup.values()].map((els) => ({ els, b: groupBoxOf(app, els) ?? boxOf(app, els[0]) }));
}

const toSlideRef = (n: number) => reference === 'slide' || n === 1;

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
  const items = objects(app);
  if (!items.length) return;
  const ref = toSlideRef(items.length) ? slideBox(app) : union(items.map((i) => i.b));
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
  shift(app, `align ${side}`, items.flatMap((i) => i.els.map((el) => ({ el, ...at(i.b) }))));
}

// the objects spaced evenly along an axis in the order of their start, as in Keynote: the first and
// the last of them are kept in place, or put at the edges of the slide with Align to Slide, and the
// gaps between them are made equal. objects that do not fit between the two have their centers
// spaced evenly instead, and each is kept inside the span of the selection. one object is spaced
// evenly across the slide, i.e. centered on it, since PowerPoint distributes one object on the slide
function distribute(app: App, axis: 'x' | 'y'): void {
  const items = objects(app);
  if (!items.length) return;
  const start = (b: Box) => (axis === 'x' ? b.left : b.top);
  const size = (b: Box) => (axis === 'x' ? b.width : b.height);
  items.sort((a, b) => start(a.b) - start(b.b) || size(a.b) - size(b.b));
  const n = items.length;
  const toSlide = toSlideRef(n);
  const ref = toSlide ? slideBox(app) : union(items.map((i) => i.b));
  const lo = start(ref), hi = lo + size(ref);
  const first = items[0].b, last = items[n - 1].b;
  const f = toSlide ? lo : start(first), z = toSlide ? hi - size(last) : start(last);
  const to = new Map<Box, number>(n === 1 ? [[first, lo + (size(ref) - size(first)) / 2]] : [[first, f], [last, z]]);
  const inner = items.slice(1, -1).map((i) => i.b);
  const gap = n === 1 ? 0 : (z - f - size(first) - inner.reduce((s, b) => s + size(b), 0)) / (n - 1);
  // the gaps are kept equal where they are negative too, as in PowerPoint, hence a column of
  // objects at one margin is left in place
  let at = f + size(first) + gap;
  inner.forEach((b) => {
    to.set(b, Math.min(Math.max(at, lo), Math.max(lo, hi - size(b))));
    at += size(b) + gap;
  });
  const moves = items.flatMap((i) => {
    const d = to.get(i.b)! - start(i.b);
    return i.els.map((el) => ({ el, dx: axis === 'x' ? d : 0, dy: axis === 'y' ? d : 0 }));
  });
  shift(app, `distribute ${axis === 'x' ? 'horizontally' : 'vertically'}`, moves);
}

// Distribute acts on one object, which is aligned to the slide, and is dimmed for two objects within
// their own span
const canDistribute = (app: App) => {
  const n = objects(app).length;
  return n === 1 || n >= 3 || (reference === 'slide' && n === 2);
};

// whether the width of every target is written by the editor, by the scope rule, and whether its
// height is set by the field H, i.e. every target is a picture and none a text block
export const resizable = (els: Element[]) => els.length > 0 && els.map(sizedTarget).every((el) => el.matches(RESIZABLE) || isTextSized(el));
export const heightSet = (els: Element[]) => els.length > 0 && els.map(sizedTarget).every((el) => el.matches(RESIZABLE));

// the offset of an element from its place in the file, i.e. its translate
export function offsetOf(el: Element): { x: number; y: number } {
  const t = placeOf(el).translate;
  return { x: t?.x ?? 0, y: t?.y ?? 0 };
}

// the box of el in slide pixels that the fields X and Y give, as in Keynote and PowerPoint, where a
// turn about the center of an object does not change them: the box without its rotation of a
// turned figure with its caption, picture, or text, about its center as it is seen, else the box of
// the readout of a move
export function unturnedBoxOf(app: App, el: Element): Box {
  const deg = el.matches(LINE) ? 0 : angleOf(el);
  if (!deg) return snapBoxOf(app, el);
  const f = frameOf(app);
  return toSlide(f, captionsOf(el).length ? unturnedRect(el).box : orientedBox(pictureOf(el), f.scale, deg));
}

// the box whose upper left corner the fields X and Y give for the moved elements els, which the
// readout of a move gives too: the frame of a whole group without its rotation, else the box of
// lead without its rotation
export const cornerBoxOf = (app: App, els: Element[], lead: Element): Box => groupFrameOf(app, els)?.box ?? unturnedBoxOf(app, lead);

// the upper left corner of an element on the slide in slide pixels, which the X and Y fields show
export function positionOf(app: App, el: Element): { x: number; y: number } {
  const b = unturnedBoxOf(app, el);
  return { x: Math.round(b.left), y: Math.round(b.top) };
}

// the size of an element in slide pixels, unscaled, at its picture for an image, a video, or a figure
export const sizeOf = (el: Element): { w: number; h: number } => pictureSize(sizedTarget(el));

// the height that the caption of a figure adds to its picture, in slide pixels, which the field H
// of the figure selected as one object gives with the picture, as its frame holds both. it is taken
// before the picture is turned, hence it is the same at every angle
export function captionHeight(app: App, el: Element): number {
  if (!el.matches(CONTAINER) || !captionsOf(el).length) return 0;
  const { box, picture } = unturnedRect(el);
  return Math.max(0, box.height - picture.height) / frameOf(app).scale;
}

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
      // one object is aligned to the slide, hence Align to Selection is dimmed for it, as in PowerPoint
      enabled: (app) => ref === 'slide' || objects(app).length !== 1,
      checked: (app) => (objects(app).length === 1 ? ref === 'slide' : reference === ref),
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
  // Evenly spaces the selection in both directions at once, as Distribute Objects > Evenly of Keynote
  list.push({
    id: 'arrange.distribute.evenly',
    label: 'Distribute Evenly',
    menu: { bar: 'Arrange', group: 'distribute', order: 42, submenu: 'Distribute' },
    undoable: true,
    enabled: canDistribute,
    run: (app) => {
      distribute(app, 'x');
      distribute(app, 'y');
    },
  });
  // arg is { x, y, els }, the position on the slide, with x or y left out to keep it. it is written
  // as the offset that reaches it
  list.push({
    id: 'arrange.setPosition',
    label: 'Position',
    undoable: true,
    enabled: (app) => targetsOf(app).length > 0,
    run: (app, arg) => {
      const a = (arg ?? {}) as { x?: number; y?: number };
      const els = targetsOf(app, arg);
      // a group is moved as one element, by the offset of the corner of its frame without its
      // rotation, as the fields give it
      const group = groupFrameOf(app, els)?.box;
      const changes = els.map((el) => {
        const from = placeOf(el);
        const now = offsetOf(el);
        const at = group ?? unturnedBoxOf(app, el);
        const to = (v: number | undefined, off: number, edge: number) => (v === undefined ? off : Math.round(off + v - edge));
        writePlace(app, el, { ...from, translate: { x: to(a.x, now.x, at.left), y: to(a.y, now.y, at.top) } });
        return { el, from, to: placeOf(el) };
      });
      record(app, 'position', changes);
      app.invalidate('content');
    },
  });
  // arg is { w, h, els }. an image or a video with its switch Constrain Proportions on keeps the
  // aspect that it has, and with the switch off it is stretched, with its height written. for any
  // other picture, a height is written as the width at its aspect, and a text block takes a width.
  // a whole group is scaled about the upper left corner of its frame, on both axes where every
  // picture of it keeps its aspect, else on the axis typed
  list.push({
    id: 'arrange.setSize',
    label: 'Size',
    undoable: true,
    enabled: (app) => resizable(targetsOf(app)) || !!groupBoxOf(app, targetsOf(app)),
    run: (app, arg) => {
      const typed = (arg ?? {}) as { w?: number; h?: number };
      const a = typed;
      let frame = groupFrameOf(app, targetsOf(app, arg));
      if (frame) {
        const all = targetsOf(app, arg);
        const keep = all.flatMap(sizedOf).filter((m) => m.matches(STRETCHED) && m.getClientRects().length).every(constrained);
        // an upright caption and rewrapped text do not scale with a turned frame, hence the frame
        // is scaled again from its measured size until it reads as typed, in at most four passes
        const changes = new Map<Element, Change>();
        const start = frame.deg ? frame.box : null;
        for (let pass = 0; frame && pass < 4; pass++) {
          const off = (v: number | undefined, now: number) => v !== undefined && Math.round(now) !== Math.round(v);
          if (!off(a.w, frame.box.width) && !off(a.h, frame.box.height)) break;
          const kw = a.w !== undefined ? a.w / frame.box.width : null, kh = a.h !== undefined ? a.h / frame.box.height : null;
          const kx = kw ?? (keep && kh ? kh : 1), ky = kh ?? (keep && kw ? kw : 1);
          for (const c of scaleGroup(app, all, frame, kx, ky)) changes.set(c.el, { ...c, from: changes.get(c.el)?.from ?? c.from });
          frame = groupFrameOf(app, all);
        }
        // the scale keeps the turned corner on the screen, hence the members are moved back until
        // the upper left corner of the frame without its rotation is where it was, as for a figure
        if (frame && start) {
          const dx = start.left - frame.box.left, dy = start.top - frame.box.top;
          for (const el of all.filter((el) => !locked(el) && !all.some((o) => o !== el && o.contains(el)))) {
            const at = placeOf(el);
            writePlace(app, el, { ...at, translate: { x: (at.translate?.x ?? 0) + dx, y: (at.translate?.y ?? 0) + dy } });
            changes.set(el, { el, from: changes.get(el)?.from ?? at, to: placeOf(el) });
          }
        }
        record(app, 'resize', [...changes.values()]);
        app.invalidate('content');
        return;
      }
      const objects = targetsOf(app, arg);
      const els = objects.map(sizedTarget);
      if (!resizable(els)) return;
      const caps = objects.map((o) => captionHeight(app, o));
      // the box of a turned object that the fields X and Y give, and its place, before the change
      const turned = objects.map((o) => (angleOf(o) ? { o, box: unturnedBoxOf(app, o), from: placeOf(o) } : null));
      const changes = withCorners(app, els, () => els.map((el, i) => {
        const from = placeOf(el);
        const now = sizeOf(el);
        const put = (a: { w?: number; h?: number }) => {
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
        };
        // a typed H of a figure with a caption is the height of its picture with its caption. the
        // caption wraps anew at the new width of the picture, hence its height is measured again. a
        // caption that leaves less than 1 px gives the picture alone the typed height
        const h = typed.h;
        const left = (cap: number) => (h !== undefined && h - cap >= 1 ? { ...typed, h: h - cap } : typed);
        put(left(caps[i]));
        if (h !== undefined && caps[i] && h - caps[i] >= 1) {
          const again = left(captionHeight(app, objects[i]));
          if (again.h !== h) put(again);
        }
        // the width is written in whole px, which can put the height 1 px off, hence the width 1 px
        // either side is taken where it gives the typed height
        const to = placeOf(el);
        if (h !== undefined && to.width != null && (to.height ?? null) === null && !isTextSized(el)) {
          const read = () => sizeOf(el).h + captionHeight(app, objects[i]);
          const wide = (d: number) => Math.max(1, to.width! + d);
          const best = [0, -1, 1].map((d) => {
            writePlace(app, el, { ...to, width: wide(d) });
            return { d, off: Math.abs(read() - h) };
          }).reduce((a, b) => (b.off + 0.01 < a.off ? b : a));
          writePlace(app, el, { ...to, width: wide(best.d) });
        }
        return { el, from, to: placeOf(el) };
      }));
      // withCorners keeps the corner of a picture, and a turned figure turns its caption about the
      // center of both, hence the figure is moved back until X and Y read as before
      for (const t of turned) {
        if (!t) continue;
        const b = unturnedBoxOf(app, t.o), dx = t.box.left - b.left, dy = t.box.top - b.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
        const at = placeOf(t.o);
        writePlace(app, t.o, { ...at, translate: { x: (at.translate?.x ?? 0) + dx, y: (at.translate?.y ?? 0) + dy } });
        const c = changes.find((c) => c.el === t.o);
        if (c) c.to = placeOf(t.o);
        else changes.push({ el: t.o, from: t.from, to: placeOf(t.o) });
      }
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
