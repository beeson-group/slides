// the pointer on the canvas: a press selects, a drag moves every selected element as one entry of
// the history, a drag of a resize handle writes the width of an image, a video, a QR code, or a
// viewer, and a drag from an empty point draws a marquee. Shift locks a move to one axis, the free
// modifier, ⌘ on a Mac and Alt elsewhere, turns the snapping off, and the copy modifier, ⌥ on a Mac
// and Ctrl elsewhere, held at the release leaves the elements and writes a copy of each where they
// were dropped. the offset of an element is the declaration translate of its style, and its size
// the declaration width, in slide pixels

import type { App } from '../app.ts';
import type { TagEdit, Translate } from '../tags.ts';
import type { Box, Handle, Targets } from './snap.ts';
import { LAYOUT_GUIDES, lockedAxis, resizeBox, snapMove, snapResize } from './snap.ts';
import { BY_ITSELF, RESIZABLE, aspectOf, bandAt, containerOf, frameOf, hasText, mediaIn, movableOf, movablesOf, onCanvas, orientedBox, pictureOf, sizedOf, toSlide, visualRect } from './hit.ts';
import { overlay, view } from './frames.ts';
import { freshGroup } from '../commands/order.ts';
import { injectStyle } from '../ui/dom.ts';

const CSS = `
html.beeson-dragging.beeson-copying, html.beeson-dragging.beeson-copying * { cursor: copy !important; }
`;

// a drag shorter than this, in screen pixels, is a click
const CLICK = 3;
// a dragged edge snaps to a line within this many screen pixels
const SNAP = 8;

// the place of an element: its offset, its width, and its angle in degrees, null where its style
// does not set them
export type Place = { translate: Translate | null; width: number | null; rotate?: number | null };

// an element with data-locked, which the pointer, the keys, and the fields do not move
export const locked = (el: Element): boolean => el.hasAttribute('data-locked');

const px = (v: string | undefined): number | null => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : null;
};

export function placeOf(el: Element): Place {
  const style = (el as HTMLElement).style;
  const [x, y] = (style.translate ?? '').split(/\s+/).map((p) => px(p));
  const translate = x === null || x === undefined ? null : { x, y: y ?? 0 };
  const rotate = px(style.rotate);
  return { translate: translate && (translate.x || translate.y) ? translate : null, width: el.matches(RESIZABLE) ? px(style.width) : null, rotate: rotate ? rotate : null };
}

const samePlace = (a: Place, b: Place) =>
  (a.translate?.x ?? 0) === (b.translate?.x ?? 0) && (a.translate?.y ?? 0) === (b.translate?.y ?? 0) && a.width === b.width && (a.rotate ?? 0) === (b.rotate ?? 0);

// the one function that writes the place of an element: on the page, and as the tag edit that a
// save writes into its start tag. the width is written as a declaration of the style, which the
// writer of the tags of the document model takes. it does not record the history, which the caller
// does with record(). a locked element is left as it is, unless force is set by an undo or a redo
export function writePlace(app: App, el: Element, p: Place, force = false): void {
  if (locked(el) && !force) return;
  const style = (el as HTMLElement).style;
  const t = p.translate && (p.translate.x || p.translate.y) ? { x: Math.round(p.translate.x), y: Math.round(p.translate.y) } : null;
  style.translate = t ? `${t.x}px ${t.y}px` : '';
  const edit: TagEdit & { style?: Record<string, string | null> } = { ...app.tagEdits.get(el), translate: t };
  if (el.matches(RESIZABLE)) {
    const w = p.width === null ? null : Math.round(p.width);
    style.width = w === null ? '' : `${w}px`;
    if (w !== null || edit.style?.width !== undefined || /(^|;)\s*width\s*:/.test(el.getAttribute('style') ?? '')) edit.style = { ...edit.style, width: w === null ? null : `${w}px` };
  }
  if (p.rotate !== undefined) {
    const r = p.rotate ? ((Math.round(p.rotate) % 360) + 360) % 360 : 0;
    style.rotate = r ? `${r}deg` : '';
    if (r || edit.style?.rotate !== undefined || /(^|;)\s*rotate\s*:/.test(el.getAttribute('style') ?? '')) edit.style = { ...edit.style, rotate: r ? `${r}deg` : null };
  }
  app.tagEdits.set(el, edit);
  app.markDirty();
}

// the change of the places of elements, already written, as one entry of the history. an undo or a
// redo shows the slide of the elements and selects them
export function record(app: App, label: string, changes: { el: Element; from: Place; to: Place }[]): { el: Element; from: Place; to: Place }[] {
  const moved = changes.filter((c) => !samePlace(c.from, c.to) && !locked(c.el));
  if (!moved.length) return moved;
  const apply = (way: 'from' | 'to') => {
    app.showSlide(moved[0].el);
    for (const c of moved) writePlace(app, c.el, c[way], true);
    app.selection.set('elements', moved.map((c) => c.el));
    app.invalidate('content');
  };
  app.history.push({ label, undo: () => apply('from'), redo: () => apply('to') });
  return moved;
}

type Press = {
  kind: 'move' | 'resize' | 'rotate' | 'marquee';
  x: number;
  y: number;
  moved: boolean;
  // the element pressed, which the readout of a move follows
  el: Element | null;
  els: Element[];
  from: Map<Element, Place>;
  // the union of the boxes of els at the press, in slide pixels
  base: Box;
  // what a click without a move does at the release
  click: (() => void) | null;
  handle?: Handle;
  aspect?: number | null;
  // the elements whose width a resize writes, e.g. both images of a figure, and the one shown,
  // whose picture the resize follows. the offset of the pressed element keeps the anchor in place
  sized?: Element[];
  pic?: Element;
  // the selection before a marquee with Shift or the command modifier, which it adds to
  initial?: Element[];
  // the center of a rotated element on the screen, and the angle of the press about it in degrees
  center?: { x: number; y: number };
  angle?: number;
  // the size of a rotated element at the press, in slide pixels
  size?: { width: number; height: number };
};

const union = (boxes: Box[]): Box => {
  const left = Math.min(...boxes.map((b) => b.left)), top = Math.min(...boxes.map((b) => b.top));
  return { left, top, width: Math.max(...boxes.map((b) => b.left + b.width)) - left, height: Math.max(...boxes.map((b) => b.top + b.height)) - top };
};

// the content box of a figure in screen pixels, i.e. without its padding
function contentRect(el: Element): Box {
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  const k = (el as HTMLElement).offsetWidth ? r.width / (el as HTMLElement).offsetWidth : 1;
  const p = (v: string) => (parseFloat(v) || 0) * k;
  return { left: r.left + p(s.paddingLeft), top: r.top + p(s.paddingTop), width: r.width - p(s.paddingLeft) - p(s.paddingRight), height: r.height - p(s.paddingTop) - p(s.paddingBottom) };
}

// the stand-ins of the elements of a copy by a drag, which stay at their places while the elements
// are dragged. each is a copy of the page only, marked data-generated, which the save and the
// pairing pass over, laid out over the place of its element without taking room in the flow
function standIns() {
  let list: Element[] = [];
  const make = (el: Element, from: Place): Element => {
    const h = el as HTMLElement;
    const copy = h.cloneNode(true) as HTMLElement;
    for (const n of [copy, ...copy.querySelectorAll('*')]) {
      for (const a of ['id', 'contenteditable', 'tabindex', 'data-id']) n.removeAttribute(a);
      n.classList.remove('beeson-movable');
    }
    const fromCanvas = h.querySelectorAll('canvas');
    copy.querySelectorAll('canvas').forEach((c, i) => {
      try {
        c.getContext('2d')?.drawImage(fromCanvas[i], 0, 0);
      } catch {
        // a WebGL canvas is left blank
      }
    });
    copy.setAttribute('data-generated', '');
    copy.setAttribute('aria-hidden', 'true');
    copy.classList.add('beeson-standin');
    const s = copy.style;
    if (getComputedStyle(h).position === 'static') {
      s.position = 'absolute';
      s.left = `${h.offsetLeft}px`;
      s.top = `${h.offsetTop}px`;
      s.width = `${h.offsetWidth}px`;
      s.boxSizing = 'border-box';
      s.margin = '0';
    }
    s.translate = from.translate ? `${Math.round(from.translate.x)}px ${Math.round(from.translate.y)}px` : '';
    s.pointerEvents = 'none';
    h.parentElement?.append(copy);
    return copy;
  };
  return {
    shown: () => list.length > 0,
    show(p: Press, on: boolean) {
      document.documentElement.classList.toggle('beeson-copying', on);
      if (on === list.length > 0) return;
      for (const c of list) c.remove();
      list = on ? p.els.map((el) => make(el, p.from.get(el) as Place)) : [];
    },
  };
}

export function install(app: App): void {
  injectStyle('drag', CSS);
  const frames = overlay();
  const ghosts = standIns();
  let press: Press | null = null;
  const mac = () => app.platform === 'mac';
  const commandHeld = (ev: MouseEvent) => (mac() ? ev.metaKey : ev.ctrlKey);
  const freeMove = (ev: MouseEvent) => (mac() ? ev.metaKey : ev.altKey);
  const copyHeld = (ev: MouseEvent) => (mac() ? ev.altKey : ev.ctrlKey);
  const freeResize = (ev: MouseEvent) => (mac() ? ev.metaKey : ev.altKey);
  const aboutCenter = (ev: MouseEvent) => (mac() ? ev.altKey : ev.ctrlKey);

  const leaveText = () => {
    const host = app.hostOf(document.activeElement);
    if (host) (host as HTMLElement).blur();
  };

  // the lines that a drag of els snaps to: the other elements of the slide, the figure around an
  // element inside one, the slide, and the layouts
  const targetsFor = (els: Element[]): Targets => {
    const f = frameOf(app);
    const others = movablesOf(app).filter((o) => !els.some((el) => el === o || el.contains(o) || o.contains(el)));
    const frames_: Box[] = [];
    for (const el of els) {
      const up = containerOf(app, el);
      if (up) frames_.push(toSlide(f, contentRect(up)));
    }
    const slides = app.slides() as HTMLElement;
    return {
      boxes: others.map((o) => toSlide(f, visualRect(o))).filter((b) => b.width > 0 && b.height > 0),
      frames: frames_,
      slide: { width: slides.offsetWidth || 1920, height: slides.offsetHeight || 1080 },
      layout: LAYOUT_GUIDES,
    };
  };

  const start = (kind: Press['kind'], ev: PointerEvent, el: Element | null, els: Element[], click: Press['click']): Press => {
    const f = frameOf(app);
    const p: Press = {
      kind, x: ev.clientX, y: ev.clientY, moved: false, el, els, click,
      from: new Map(els.map((e) => [e, placeOf(e)])),
      base: els.length ? union(els.map((e) => toSlide(f, visualRect(e)))) : { left: 0, top: 0, width: 0, height: 0 },
    };
    press = p;
    view.hover = null;
    return p;
  };

  // a press on an element: it is selected, or with Shift or the command modifier added, and taken
  // off again at a click without a move. a press on a selected element keeps the selection, so that
  // all of it is dragged, and a click on it then selects it alone, or the image inside it
  const pressElement = (ev: PointerEvent, el: Element, target: Element | null) => {
    ev.preventDefault();
    leaveText();
    const sel = app.selection;
    const add = ev.shiftKey || commandHeld(ev);
    let click: Press['click'] = null;
    if (add) {
      if (sel.has(el)) click = () => sel.toggle(el);
      else sel.add(el);
    } else if (sel.has(el)) {
      const several = sel.elements().length > 1;
      const media = mediaIn(el, target);
      click = () => {
        if (several) sel.set('elements', [el]);
        else if (media) sel.set('elements', [media]);
      };
    } else sel.set('elements', [el]);
    const els = sel.elements().filter((e) => !sel.elements().some((o) => o !== e && o.contains(e)) && !locked(e));
    start('move', ev, els.includes(el) ? el : (els[0] ?? null), els, click);
  };

  const onDown = (ev: PointerEvent) => {
    if (ev.button !== 0 || press) return;
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    const sel = app.selection;
    if (target === frames.rotor) {
      const el = sel.only();
      if (!el || locked(el)) return;
      ev.preventDefault();
      ev.stopPropagation();
      const r = el.getBoundingClientRect();
      const center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      Object.assign(start('rotate', ev, el, [el], null), { center, angle: Math.atan2(ev.clientY - center.y, ev.clientX - center.x) * 180 / Math.PI });
      document.documentElement.classList.add('beeson-rotating');
      return;
    }
    const grip = target.closest('.beeson-grip');
    if (grip && !grip.classList.contains('locked')) {
      const el = sel.only();
      const sized = el ? sizedOf(el) : [];
      if (!el || !sized.length) return;
      ev.preventDefault();
      ev.stopPropagation();
      const pic = pictureOf(el);
      const p = Object.assign(start('resize', ev, el, [el], null), { handle: (grip as HTMLElement).dataset.handle as Handle, aspect: aspectOf(pic), sized, pic });
      for (const m of sized) if (!p.from.has(m)) p.from.set(m, placeOf(m));
      p.base = toSlide(frameOf(app), visualRect(pic));
      document.documentElement.classList.add('beeson-resizing');
      return;
    }
    if (target === frames.handle) {
      const el = frames.current();
      if (el) pressElement(ev, el, null);
      return;
    }
    // a press on the chrome, e.g. a button of a bar or a pane, keeps the selection
    if (!onCanvas(target, app, { x: ev.clientX, y: ev.clientY })) return;
    // an image selected inside its figure is dragged inside it
    const inner = sel.only();
    if (inner && inner.matches(RESIZABLE) && containerOf(app, inner) && inner.contains(target)) {
      pressElement(ev, inner, target);
      return;
    }
    const el = movableOf(app, target);
    const host = app.hostOf(target);
    if (el && host) {
      // a click into a text puts the caret there, and with Shift or the command modifier the block
      // is added to the selection as a box
      if (ev.shiftKey || commandHeld(ev)) pressElement(ev, el, target);
      return;
    }
    if (el && (target.closest(BY_ITSELF) || !hasText(el))) {
      if (el.matches(BY_ITSELF)) pressElement(ev, el, target);
      else if (!sel.has(el)) sel.set('elements', [el]);
      return;
    }
    const band = bandAt(app, ev.clientX, ev.clientY);
    if (band) {
      pressElement(ev, band, null);
      return;
    }
    // an empty point of the slide or of the canvas around it starts a marquee
    ev.preventDefault();
    leaveText();
    const add = ev.shiftKey || commandHeld(ev);
    const initial = add ? sel.elements().slice() : [];
    if (!add) sel.clear();
    start('marquee', ev, null, [], null).initial = initial;
  };

  const onMove = (ev: PointerEvent) => {
    const p = press;
    if (!p) {
      hover(ev);
      return;
    }
    if (!p.moved && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < CLICK) return;
    p.moved = true;
    const f = frameOf(app);
    if (p.kind === 'marquee') {
      const left = Math.min(p.x, ev.clientX), top = Math.min(p.y, ev.clientY);
      const box = { left, top, width: Math.abs(ev.clientX - p.x), height: Math.abs(ev.clientY - p.y) };
      view.marquee = box;
      const touched = movablesOf(app).filter((el) => {
        const r = visualRect(el);
        return r.left <= box.left + box.width && r.left + r.width >= box.left && r.top <= box.top + box.height && r.top + r.height >= box.top;
      });
      app.selection.set('elements', [...(p.initial ?? []), ...touched]);
      frames.draw();
      return;
    }
    let dx = (ev.clientX - p.x) / f.scale;
    let dy = (ev.clientY - p.y) / f.scale;
    if (p.kind === 'resize') {
      resize(p, ev, dx, dy);
      return;
    }
    if (p.kind === 'rotate') {
      rotate(p, ev);
      return;
    }
    if (!p.els.length) return;
    const lock = ev.shiftKey ? lockedAxis(dx, dy) : null;
    if (lock === 'x') dy = 0;
    if (lock === 'y') dx = 0;
    const moved = { ...p.base, left: p.base.left + dx, top: p.base.top + dy };
    const snap = freeMove(ev) ? null : snapMove(moved, targetsFor(p.els), SNAP / f.scale, { x: lock !== 'y', y: lock !== 'x' });
    dx += snap?.dx ?? 0;
    dy += snap?.dy ?? 0;
    ghosts.show(p, copyHeld(ev));
    for (const el of p.els) {
      const from = p.from.get(el) as Place;
      writeLive(el, { translate: { x: (from.translate?.x ?? 0) + dx, y: (from.translate?.y ?? 0) + dy }, width: from.width });
    }
    view.moving = p.els;
    view.guides = snap?.guides ?? [];
    view.spacing = snap?.spacing ?? [];
    // the position of the pressed element, i.e. the X and Y of the Arrange pane, next to the pointer
    // as in Keynote, below and to the right of it, where the guides at the pointer are not covered
    const t = p.el ? placeOf(p.el).translate : null;
    view.readout = { text: `${ghosts.shown() ? 'Copy  ' : ''}${t?.x ?? 0}, ${t?.y ?? 0}`, x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
    document.documentElement.classList.add('beeson-dragging');
    frames.draw();
    app.invalidate('content');
  };

  // the place on the page only, during a drag. the release writes it with writePlace
  const writeLive = (el: Element, p: Place) => {
    const style = (el as HTMLElement).style;
    const t = p.translate && (Math.round(p.translate.x) || Math.round(p.translate.y)) ? p.translate : null;
    style.translate = t ? `${Math.round(t.x)}px ${Math.round(t.y)}px` : '';
    if (el.matches(RESIZABLE)) style.width = p.width === null ? '' : `${Math.round(p.width)}px`;
    if (p.rotate !== undefined) style.rotate = p.rotate ? `${Math.round(p.rotate)}deg` : '';
  };

  // a turn by the rotate handle about the center of the element. Shift snaps the angle to steps of
  // 15 degrees, and the angle is shown at the pointer
  const rotate = (p: Press, ev: PointerEvent) => {
    const el = p.els[0];
    const c = p.center as { x: number; y: number };
    const now = Math.atan2(ev.clientY - c.y, ev.clientX - c.x) * 180 / Math.PI;
    let deg = (p.from.get(el)?.rotate ?? 0) + now - (p.angle ?? 0);
    deg = ev.shiftKey ? Math.round(deg / 15) * 15 : Math.round(deg);
    deg = ((deg % 360) + 360) % 360;
    writeLive(el, { ...(p.from.get(el) as Place), rotate: deg || null });
    view.moving = [el];
    view.resizing = true;
    view.readout = { text: `${deg}°`, x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
    frames.draw();
    app.invalidate('content');
  };

  // the width of every element of a resize, on the page only
  const setWidth = (p: Press, width: number) => {
    for (const m of p.sized ?? p.els) (m as HTMLElement).style.width = `${Math.round(width)}px`;
  };

  // a resize by a handle: the width is the width of the picture, and the offset of the pressed
  // element, i.e. the picture or the figure around it, is changed so that the edge or corner across
  // from the handle stays, since the box of a figure is laid out by the theme around its width
  const resize = (p: Press, ev: PointerEvent, dx: number, dy: number) => {
    const el = p.els[0];
    const pic = p.pic ?? el;
    const f = frameOf(app);
    const o = { aspect: p.aspect ?? null, center: aboutCenter(ev) };
    const deg = (p.from.get(el)?.rotate ?? 0) + (pic === el ? 0 : (p.from.get(pic)?.rotate ?? 0));
    if (deg) {
      rotatedResize(p, ev, dx, dy, deg, o);
      return;
    }
    let box = resizeBox(p.base, p.handle as Handle, dx, dy, o);
    view.guides = [];
    view.spacing = [];
    if (!freeResize(ev)) {
      const snapped = snapResize(p.base, p.handle as Handle, box, targetsFor([pic]), SNAP / f.scale, o);
      box = snapped.box;
      view.guides = snapped.guides;
      view.spacing = snapped.sizes;
    }
    setWidth(p, box.width);
    // the offset that puts the anchor of the box seen where the resize put it
    const seen = toSlide(f, visualRect(pic));
    const h = p.handle as Handle;
    const shift = (a: 'x' | 'y') => {
      const [s, w] = a === 'x' ? ['left', 'width'] as const : ['top', 'height'] as const;
      const side = a === 'x' ? (h.includes('w') ? -1 : h.includes('e') ? 1 : 0) : (h.includes('n') ? -1 : h.includes('s') ? 1 : 0);
      if (o.center || side === 0) return box[s] + box[w] / 2 - (seen[s] + seen[w] / 2);
      return side === 1 ? box[s] - seen[s] : box[s] + box[w] - (seen[s] + seen[w]);
    };
    const now = placeOf(el).translate ?? { x: 0, y: 0 };
    writeLive(el, { translate: { x: now.x + shift('x'), y: now.y + shift('y') }, width: el.matches(RESIZABLE) ? box.width : null });
    view.moving = [el];
    view.resizing = true;
    const after = toSlide(f, visualRect(pic));
    view.readout = { text: `${Math.round(after.width)} × ${Math.round(after.height)}`, x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
    frames.draw();
    app.invalidate('content');
  };

  // a resize of a rotated element, without snapping: the pointer offset is turned into the frame of
  // the element, and the offset is changed so that the edge or corner across from the handle stays
  // where it was on the slide
  const rotatedResize = (p: Press, ev: PointerEvent, dx: number, dy: number, deg: number, o: { aspect: number | null; center: boolean }) => {
    const el = p.els[0] as HTMLElement;
    const pic = p.pic ?? el;
    const f = frameOf(app);
    const a = (deg * Math.PI) / 180;
    const turn = (x: number, y: number, by: number) => ({ x: x * Math.cos(by) - y * Math.sin(by), y: x * Math.sin(by) + y * Math.cos(by) });
    const local = turn(dx, dy, -a);
    const from = p.from.get(el) as Place;
    // the box of the picture without its rotation at the press, about the center of the picture
    const center = () => {
      const b = toSlide(f, orientedBox(pic, f.scale, deg));
      return { x: b.left + b.width / 2, y: b.top + b.height / 2, width: b.width, height: b.height };
    };
    if (!p.size) {
      const c = center();
      p.size = { width: c.width, height: c.height };
      p.base = { left: c.x - c.width / 2, top: c.y - c.height / 2, width: c.width, height: c.height };
    }
    const cx = p.base.left + p.base.width / 2, cy = p.base.top + p.base.height / 2;
    const box = resizeBox(p.base, p.handle as Handle, local.x, local.y, o);
    setWidth(p, box.width);
    const move = turn(box.left + box.width / 2 - cx, box.top + box.height / 2 - cy, a);
    const seen = center();
    const now = placeOf(el).translate ?? { x: 0, y: 0 };
    const sx = cx + move.x - seen.x, sy = cy + move.y - seen.y;
    writeLive(el, { translate: { x: now.x + sx, y: now.y + sy }, width: el.matches(RESIZABLE) ? box.width : null, rotate: from.rotate });
    view.moving = [el];
    view.resizing = true;
    view.guides = [];
    view.spacing = [];
    view.readout = { text: `${Math.round(box.width)} × ${Math.round(box.height)}`, x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
    frames.draw();
    app.invalidate('content');
  };

  const onUp = (ev: PointerEvent | null) => {
    const p = press;
    if (!p) return;
    press = null;
    document.documentElement.classList.remove('beeson-dragging', 'beeson-resizing', 'beeson-rotating');
    view.moving = null;
    view.resizing = false;
    view.guides = [];
    view.spacing = [];
    view.marquee = null;
    view.readout = null;
    const copying = ghosts.shown();
    ghosts.show(p, false);
    if (p.kind === 'move' && ev && p.moved && copying && copyHeld(ev)) {
      void copyAt(p).catch((e) => app.fail(e));
    } else if (p.kind !== 'marquee') {
      const els = [...p.els, ...(p.sized ?? []).filter((m) => !p.els.includes(m))];
      if (ev && p.moved) {
        const changes = els.map((el) => {
          const to = placeOf(el);
          writePlace(app, el, to);
          return { el, from: p.from.get(el) as Place, to };
        });
        record(app, p.kind === 'resize' ? 'resize' : p.kind === 'rotate' ? 'rotate' : 'move', changes);
      } else if (p.moved) {
        for (const el of els) writeLive(el, p.from.get(el) as Place);
      } else p.click?.();
    }
    frames.draw();
    app.invalidate('content');
  };

  // the elements of a copy by a drag are put back, and a copy of each is written after it, at the
  // place where it was dropped, as one entry of the history. the copies are then selected
  const copyAt = async (p: Press) => {
    const f = frameOf(app);
    const dropped = p.els.map((el) => ({ el, box: toSlide(f, visualRect(el)) }));
    for (const el of p.els) writeLive(el, p.from.get(el) as Place);
    await app.history.transact('Duplicate', async () => {
      const copies: Element[] = [];
      // the copies of a group are a new group
      const groups = new Map<string, string>();
      for (const { el, box } of dropped) {
        const copy = await app.doc.duplicate(el);
        const g = copy.getAttribute('data-group');
        if (g) {
          if (!groups.has(g)) groups.set(g, freshGroup(app));
          app.doc.setTag(copy, { attrs: { 'data-group': groups.get(g)! } }, 'group');
        }
        const now = toSlide(frameOf(app), visualRect(copy));
        const t = placeOf(copy).translate ?? { x: 0, y: 0 };
        app.doc.setTag(copy, { translate: { x: Math.round(t.x + box.left - now.left), y: Math.round(t.y + box.top - now.top) } }, 'move');
        copies.push(copy);
      }
      app.selection.set('elements', copies);
    });
    frames.draw();
  };

  // the element under the pointer gets the hover frame and the handle, which stay while the pointer
  // is on its way to the handle at its upper left
  const hover = (ev: PointerEvent) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (target && (target === frames.handle || target.closest('.beeson-grip'))) return;
    const el = movableOf(app, target);
    const band = el ? null : onCanvas(target, app, { x: ev.clientX, y: ev.clientY }) ? bandAt(app, ev.clientX, ev.clientY) : null;
    document.documentElement.classList.toggle('beeson-band', !!band);
    const next = el ?? band;
    if (next) {
      if (next !== view.hover) {
        view.hover = next;
        frames.draw();
      }
    } else if (view.hover && !near(view.hover, ev)) {
      view.hover = null;
      frames.draw();
    }
  };

  const near = (el: Element, ev: PointerEvent): boolean => {
    const r = el.getBoundingClientRect();
    return ev.clientX >= r.left - 28 && ev.clientX <= r.right + 6 && ev.clientY >= r.top - 28 && ev.clientY <= r.bottom + 6;
  };

  // the handle of a block puts it back at its place in the file with a double click or Enter
  const reset = () => {
    const el = frames.current();
    if (!el) return;
    const from = placeOf(el);
    const to = { ...from, translate: null };
    writePlace(app, el, to);
    record(app, 'move', [{ el, from, to }]);
    if (!app.selection.has(el)) app.selection.set('elements', [el]);
    frames.draw();
  };
  frames.handle.addEventListener('dblclick', reset);
  frames.handle.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    reset();
  });
  frames.handle.addEventListener('focus', () => {
    const el = frames.current();
    if (el && !app.selection.has(el)) app.selection.set('elements', [el]);
  });

  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp, true);
  document.addEventListener('pointercancel', () => onUp(null), true);
  // the native drag of an image would take the pointer
  document.addEventListener('dragstart', (ev) => {
    if (ev.target instanceof Element && movableOf(app, ev.target)) ev.preventDefault();
  });
  app.listen('slide', () => {
    view.hover = null;
    if (press) onUp(null);
  });
}
