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
import { BY_ITSELF, RESIZABLE, STRETCHED, aspectOf, bandAt, constrained, containerOf, cssWidth, frameOf, hasText, isTextSized, lineEnds, linePoints, linesOf, mediaIn, movableOf, movablesOf, onCanvas, orientedBox, pickOf, pictureOf, segmentTouches, sizedOf, snapBoxOf, toSlide, twinOf, visualRect } from './hit.ts';
import { groupReach, overlay, view } from './frames.ts';
import { enterGroup, freshGroup, groupOf } from '../commands/order.ts';
import { injectStyle } from '../ui/dom.ts';

const CSS = `
html.beeson-dragging.beeson-copying, html.beeson-dragging.beeson-copying * { cursor: copy !important; }
`;

// a drag shorter than this, in screen pixels, is a click
const CLICK = 3;
// a dragged edge snaps to a line within this many screen pixels
const SNAP = 8;

// the place of an element: its offset, its width, its height, and its angle in degrees, null where
// its style does not set them. a height is written only on a stretched image or video
export type Place = { translate: Translate | null; width: number | null; height?: number | null; rotate?: number | null };

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
  return {
    translate: translate && (translate.x || translate.y) ? translate : null,
    width: el.matches(RESIZABLE) || isTextSized(el) ? px(style.width) : null,
    height: el.matches(STRETCHED) ? px(style.height) : null,
    rotate: rotate ? rotate : null,
  };
}

const samePlace = (a: Place, b: Place) =>
  (a.translate?.x ?? 0) === (b.translate?.x ?? 0) && (a.translate?.y ?? 0) === (b.translate?.y ?? 0) && a.width === b.width && (a.height ?? null) === (b.height ?? null) && (a.rotate ?? 0) === (b.rotate ?? 0);

// the declaration name of the style of el as value, or null, as the tag edit of a save writes it.
// a declaration that the file or an earlier edit sets is written again, so that it is removed
function declare(el: Element, edit: TagEdit & { style?: Record<string, string | null> }, name: string, value: string | null): void {
  const had = new RegExp(`(^|;)\\s*${name}\\s*:`).test(el.getAttribute('style') ?? '');
  (el as HTMLElement).style.setProperty(name, value ?? '');
  if (value !== null || had || edit.style?.[name] !== undefined) edit.style = { ...edit.style, [name]: value };
}

// the one function that writes the place of an element: on the page, and as the tag edit that a
// save writes into its start tag. the width is written as a declaration of the style, which the
// writer of the tags of the document model takes. it does not record the history, which the caller
// does with record(). a locked element is left as it is, unless force is set by an undo or a redo
export function writePlace(app: App, el: Element, p: Place, force = false, twin = true): void {
  if (locked(el) && !force) return;
  const other = twin ? twinOf(app, el) : null;
  if (other) writePlace(app, other, p, force, false);
  const style = (el as HTMLElement).style;
  const t = p.translate && (p.translate.x || p.translate.y) ? { x: Math.round(p.translate.x), y: Math.round(p.translate.y) } : null;
  style.translate = t ? `${t.x}px ${t.y}px` : '';
  const edit: TagEdit & { style?: Record<string, string | null> } = { ...app.tagEdits.get(el), translate: t };
  if (el.matches(RESIZABLE) || isTextSized(el)) declare(el, edit, 'width', p.width === null ? null : `${Math.round(p.width)}px`);
  if (el.matches(STRETCHED) && p.height !== undefined) declare(el, edit, 'height', p.height === null ? null : `${Math.round(p.height)}px`);
  if (p.rotate !== undefined) {
    const r = p.rotate ? ((Math.round(p.rotate) % 360) + 360) % 360 : 0;
    style.rotate = r ? `${r}deg` : '';
    if (r || edit.style?.rotate !== undefined || /(^|;)\s*rotate\s*:/.test(el.getAttribute('style') ?? '')) edit.style = { ...edit.style, rotate: r ? `${r}deg` : null };
  }
  app.tagEdits.set(el, edit);
  app.markDirty();
}

// the change of the places of elements, already written, as one entry of the history. an undo or a
// redo shows the slide of the elements and selects what was selected for the change, by default the
// selection at the call, as in Keynote. without one, it selects the shown elements that were moved,
// apart from the hidden image of a dark and light pair and an element inside another one
export function record(app: App, label: string, changes: { el: Element; from: Place; to: Place }[], selected: Element[] = app.selection.elements()): { el: Element; from: Place; to: Place }[] {
  const moved = changes.filter((c) => !samePlace(c.from, c.to) && !locked(c.el));
  if (!moved.length) return moved;
  const before = selected.slice();
  const apply = (way: 'from' | 'to') => {
    app.showSlide(moved[0].el);
    for (const c of moved) writePlace(app, c.el, c[way], true);
    const kept = before.filter((el) => el.isConnected);
    const els = moved.map((c) => c.el);
    app.selection.set('elements', kept.length ? kept : els.filter((el) => el.getClientRects().length && !els.some((o) => o !== el && o.contains(el))));
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
  // the selection at the press, which an undo and a redo of the change select again
  selected: Element[];
  // the box of el at the press, in slide pixels, whose upper left corner the readout of a move gives
  corner: Box | null;
  els: Element[];
  from: Map<Element, Place>;
  // the union of the boxes of els at the press, in slide pixels
  base: Box;
  // what a click without a move does at the release
  click: (() => void) | null;
  handle?: Handle;
  aspect?: number | null;
  // whether the picture of a resize is an image or a video, whose height is written as well, and
  // whether its switch Constrain Proportions is on
  stretch?: boolean;
  keep?: boolean;
  // the elements whose width a resize writes, e.g. both images of a figure, and the one shown,
  // whose picture the resize follows. the offset of the pressed element keeps the anchor in place
  sized?: Element[];
  pic?: Element;
  // the other selected elements that a resize scales with the pressed one, each about its anchor
  followers?: Follower[];
  // the selection before a marquee with Shift or the command modifier, which it adds to
  initial?: Element[];
  // the center of a rotated element on the screen, and the angle of the press about it in degrees
  center?: { x: number; y: number };
  angle?: number;
  // the size of a rotated element at the press, in slide pixels
  size?: { width: number; height: number };
  // whether the grips of a group are pressed, which scale all its members about one anchor
  group?: boolean;
};

// an element of a multiple selection that follows a resize by the grip of another: the elements
// whose width it writes, its picture, its angle, and the box of its picture at the press without
// its rotation, about the center of the picture, in slide pixels
type Follower = { el: Element; sized: Element[]; pic: Element; deg: number; base: Box };

// the angle of el and of the picture inside it, as its style sets them
const angleIn = (el: Element, pic: Element): number => (placeOf(el).rotate ?? 0) + (pic === el ? 0 : (placeOf(pic).rotate ?? 0));

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
      points: linePoints(app, els),
      slide: { width: slides.offsetWidth || 1920, height: slides.offsetHeight || 1080 },
      layout: LAYOUT_GUIDES,
    };
  };

  const start = (kind: Press['kind'], ev: PointerEvent, el: Element | null, els: Element[], click: Press['click']): Press => {
    const f = frameOf(app);
    const p: Press = {
      kind, x: ev.clientX, y: ev.clientY, moved: false, el, els, click, selected: app.selection.elements().slice(), corner: el ? snapBoxOf(app, el) : null,
      from: new Map(els.map((e) => [e, placeOf(e)])),
      base: els.length ? union(els.map((e) => snapBoxOf(app, e))) : { left: 0, top: 0, width: 0, height: 0 },
    };
    press = p;
    view.hover = null;
    return p;
  };

  // a press on an element: it is selected, or with Shift or the command modifier added, and taken
  // off again at a click without a move. a press on a selected element keeps the selection, so that
  // all of it is dragged, and a click on it then selects it alone, or the image inside it. a click
  // on a member of a group that is selected as the whole selection selects the member by itself
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
      const id = groupOf(el);
      const inGroup = several && !!id && sel.elements().every((o) => groupOf(o) === id);
      click = () => {
        if (inGroup) enterGroup(app, el);
        else if (several) sel.set('elements', [el]);
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
    if (grip && !grip.classList.contains('locked') && (grip as HTMLElement).dataset.group) {
      // the grips of a group: each member is a follower of the box of the group
      ev.preventDefault();
      ev.stopPropagation();
      const f = frameOf(app);
      const all = sel.elements().filter((o) => !locked(o));
      const followers: Follower[] = all.filter((o) => !all.some((x) => x !== o && x.contains(o))).map((o) => {
        const pic = pictureOf(o);
        const deg = angleIn(o, pic);
        return { el: o, sized: sizedOf(o), pic, deg, base: toSlide(f, orientedBox(pic, f.scale, deg)) };
      });
      if (!followers.length) return;
      const p = Object.assign(start('resize', ev, followers[0].el, followers.map((m) => m.el), null), { handle: (grip as HTMLElement).dataset.handle as Handle, followers, group: true });
      for (const m of followers.flatMap((m) => m.sized)) if (!p.from.has(m)) p.from.set(m, placeOf(m));
      p.base = toSlide(f, frames.groupBox() ?? union(followers.map((m) => visualRect(m.pic))));
      document.documentElement.classList.add('beeson-resizing');
      return;
    }
    if (grip && !grip.classList.contains('locked')) {
      const el = frames.memberOf(grip);
      const sized = el ? sizedOf(el) : [];
      if (!el || !sized.length || locked(el)) return;
      ev.preventDefault();
      ev.stopPropagation();
      const pic = pictureOf(el);
      const f = frameOf(app);
      const all = sel.elements();
      const followers: Follower[] = all
        .filter((o) => o !== el && !locked(o) && !o.contains(el) && !el.contains(o) && !all.some((x) => x !== o && x.contains(o)) && sizedOf(o).length)
        .map((o) => {
          const pic = pictureOf(o);
          const deg = angleIn(o, pic);
          return { el: o, sized: sizedOf(o), pic, deg, base: toSlide(f, orientedBox(pic, f.scale, deg)) };
        });
      const p = Object.assign(start('resize', ev, el, [el, ...followers.map((m) => m.el)], null), {
        handle: (grip as HTMLElement).dataset.handle as Handle, aspect: aspectOf(pic), sized, pic, followers, stretch: pic.matches(STRETCHED), keep: constrained(pic),
      });
      for (const m of [...sized, ...followers.flatMap((m) => m.sized)]) if (!p.from.has(m)) p.from.set(m, placeOf(m));
      p.base = toSlide(f, visualRect(pic));
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
    const el = pickOf(app, target);
    const host = app.hostOf(target);
    if (el && host) {
      // a click into a text puts the caret there, and with Shift or the command modifier the block
      // is added to the selection as a box. a block of a group is selected with its group at the
      // first click and by itself at the second, and only the third puts the caret in it, as in
      // Keynote and PowerPoint
      if (ev.shiftKey || commandHeld(ev) || (groupOf(el) && sel.only() !== el)) pressElement(ev, el, target);
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
      // a line is touched where the marquee touches the line itself, not only its box
      for (const svg of linesOf(app)) if (segmentTouches(...lineEnds(svg), box)) touched.push(svg);
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
      writeLive(el, { ...from, translate: { x: (from.translate?.x ?? 0) + dx, y: (from.translate?.y ?? 0) + dy } });
    }
    view.moving = p.els;
    view.guides = snap?.guides ?? [];
    view.spacing = snap?.spacing ?? [];
    // the upper left corner of the pressed element in slide pixels next to the pointer, as Keynote
    // gives its x and y, below and to the right of it, where the guides at the pointer are not covered
    const c = p.corner;
    const at = c ? `x ${Math.round(c.left + dx)}  y ${Math.round(c.top + dy)}` : '';
    view.readout = { text: `${ghosts.shown() ? 'Copy  ' : ''}${at}`, x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
    document.documentElement.classList.add('beeson-dragging');
    frames.draw();
    app.invalidate('content');
  };

  // the place on the page only, during a drag. the release writes it with writePlace
  const writeLive = (el: Element, p: Place) => {
    const style = (el as HTMLElement).style;
    const t = p.translate && (Math.round(p.translate.x) || Math.round(p.translate.y)) ? p.translate : null;
    style.translate = t ? `${Math.round(t.x)}px ${Math.round(t.y)}px` : '';
    if (el.matches(RESIZABLE) || isTextSized(el)) style.width = p.width === null ? '' : `${Math.round(p.width)}px`;
    if (el.matches(STRETCHED) && p.height !== undefined) style.height = p.height === null ? '' : `${Math.round(p.height)}px`;
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

  // the size of every element of a resize, on the page only: the width of the border box, and the
  // height of an image or a video where it is stretched, else its height as at the press
  const setSize = (p: Press, width: number, height: number | null) => {
    for (const m of p.sized ?? p.els) {
      (m as HTMLElement).style.width = `${Math.round(cssWidth(m, width))}px`;
      if (m.matches(STRETCHED)) {
        const h = height ?? p.from.get(m)?.height ?? null;
        (m as HTMLElement).style.height = h === null ? '' : `${Math.round(h)}px`;
      }
    }
  };

  // how a resize by the grip of p is made: the aspect that it keeps, or null, whether both sides
  // are free, and whether the height is written. an image or a video keeps its aspect where its
  // switch Constrain Proportions is on, and Shift on a corner turns the switch over for the drag,
  // as in Keynote. it is stretched where the switch is off, and a stretched picture keeps the
  // aspect that it has
  const modeOf = (p: Press, ev: PointerEvent): { aspect: number | null; free: boolean; height: boolean } => {
    if (!p.stretch) return { aspect: p.aspect ?? null, free: false, height: false };
    const corner = (p.handle as Handle).length === 2;
    const keep = corner ? p.keep !== ev.shiftKey : !!p.keep;
    const stretched = (p.from.get(p.pic ?? p.els[0])?.height ?? null) !== null;
    return { aspect: keep ? (p.aspect ?? null) : null, free: !keep, height: !keep || stretched };
  };

  // a resize by a handle: the width is the width of the picture, and the offset of the pressed
  // element, i.e. the picture or the figure around it, is changed so that the edge or corner across
  // from the handle stays, since the box of a figure is laid out by the theme around its width
  const resize = (p: Press, ev: PointerEvent, dx: number, dy: number) => {
    if (p.group) {
      groupResize(p, ev, dx, dy);
      return;
    }
    const el = p.els[0];
    const pic = p.pic ?? el;
    const f = frameOf(app);
    const mode = modeOf(p, ev);
    const o = { aspect: mode.aspect, center: aboutCenter(ev), free: mode.free };
    const deg = (p.from.get(el)?.rotate ?? 0) + (pic === el ? 0 : (p.from.get(pic)?.rotate ?? 0));
    if (deg) {
      rotatedResize(p, ev, dx, dy, deg, o, mode.height);
      return;
    }
    let box = resizeBox(p.base, p.handle as Handle, dx, dy, o);
    view.guides = [];
    view.spacing = [];
    if (!freeResize(ev)) {
      const snapped = snapResize(p.base, p.handle as Handle, box, targetsFor([pic, ...(p.followers ?? []).map((m) => m.el)]), SNAP / f.scale, o);
      box = snapped.box;
      view.guides = snapped.guides;
      view.spacing = snapped.sizes;
    }
    setSize(p, box.width, mode.height ? box.height : null);
    // the offset that puts the anchor of the box seen where the resize put it
    const seen = toSlide(f, visualRect(pic));
    const h = p.handle as Handle;
    const shift = (a: 'x' | 'y') => {
      const [s, w] = a === 'x' ? ['left', 'width'] as const : ['top', 'height'] as const;
      const side = a === 'x' ? (h.includes('w') ? -1 : h.includes('e') ? 1 : 0) : (h.includes('n') ? -1 : h.includes('s') ? 1 : 0);
      // a text block keeps its top, and its wrapped text sets its height
      if (a === 'y' && isTextSized(pic)) return box.top - seen.top;
      if (o.center || side === 0) return box[s] + box[w] / 2 - (seen[s] + seen[w] / 2);
      return side === 1 ? box[s] - seen[s] : box[s] + box[w] - (seen[s] + seen[w]);
    };
    const now = placeOf(el);
    writeLive(el, { ...now, translate: { x: (now.translate?.x ?? 0) + shift('x'), y: (now.translate?.y ?? 0) + shift('y') } });
    follow(p, h, box.width / p.base.width, box.height / p.base.height, o.center);
    view.moving = p.els;
    view.resizing = true;
    const after = toSlide(f, visualRect(pic));
    view.readout = { text: `${Math.round(after.width)} × ${Math.round(after.height)}`, x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
    frames.draw();
    app.invalidate('content');
  };

  // a resize of a rotated element, without snapping: the pointer offset is turned into the frame of
  // the element, and the offset is changed so that the edge or corner across from the handle stays
  // where it was on the slide
  const rotatedResize = (p: Press, ev: PointerEvent, dx: number, dy: number, deg: number, o: { aspect: number | null; center: boolean; free: boolean }, height: boolean) => {
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
    setSize(p, box.width, height ? box.height : null);
    const move = turn(box.left + box.width / 2 - cx, box.top + box.height / 2 - cy, a);
    const seen = center();
    const now = placeOf(el);
    const sx = cx + move.x - seen.x, sy = cy + move.y - seen.y;
    writeLive(el, { ...now, translate: { x: (now.translate?.x ?? 0) + sx, y: (now.translate?.y ?? 0) + sy }, rotate: from.rotate });
    follow(p, p.handle as Handle, box.width / p.base.width, box.height / p.base.height, o.center);
    view.moving = p.els;
    view.resizing = true;
    view.guides = [];
    view.spacing = [];
    view.readout = { text: `${Math.round(box.width)} × ${Math.round(box.height)}`, x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
    frames.draw();
    app.invalidate('content');
  };

  // a resize of a group by its grips, without snapping: the box of the group keeps its aspect at a
  // corner unless Shift is held, and each member is scaled by the ratio of the box, with its center
  // moved away from the edge or corner across from the grip, or from the center of the group
  const groupResize = (p: Press, ev: PointerEvent, dx: number, dy: number) => {
    const f = frameOf(app);
    const h = p.handle as Handle;
    const corner = h.length === 2;
    const center = aboutCenter(ev);
    const box = resizeBox(p.base, h, dx, dy, { aspect: corner && !ev.shiftKey ? p.base.width / p.base.height : null, center, free: true });
    const sx = h.includes('w') ? -1 : h.includes('e') ? 1 : 0;
    const sy = h.includes('n') ? -1 : h.includes('s') ? 1 : 0;
    const k = sx ? box.width / p.base.width : box.height / p.base.height;
    const b = p.base;
    const ax = center || !sx ? b.left + b.width / 2 : sx > 0 ? b.left : b.left + b.width;
    const ay = center || !sy ? b.top + b.height / 2 : sy > 0 ? b.top : b.top + b.height;
    for (const m of p.followers ?? []) {
      for (const s of m.sized) {
        (s as HTMLElement).style.width = `${Math.round(cssWidth(s, m.base.width * k))}px`;
        if ((p.from.get(s)?.height ?? null) !== null) (s as HTMLElement).style.height = `${Math.round(m.base.height * k)}px`;
      }
      const seen = toSlide(f, orientedBox(m.pic, f.scale, m.deg));
      // a text block keeps the place of its top, under its wrapped text
      const text = isTextSized(m.pic);
      const cx = ax + (m.base.left + m.base.width / 2 - ax) * k;
      const y0 = text ? m.base.top : m.base.top + m.base.height / 2;
      const cy = ay + (y0 - ay) * k;
      const now = placeOf(m.el);
      const from = p.from.get(m.el) as Place;
      writeLive(m.el, { ...now, translate: { x: (now.translate?.x ?? 0) + cx - (seen.left + seen.width / 2), y: (now.translate?.y ?? 0) + cy - (text ? seen.top : seen.top + seen.height / 2) }, rotate: from.rotate });
    }
    view.moving = p.els;
    view.resizing = true;
    view.guides = [];
    view.spacing = [];
    // the size that the members reach, as W and H of the Arrange pane give it, since the layout
    // sets the height of a zone and a text block, which can differ from box
    const reached = toSlide(f, groupReach(p.els));
    view.readout = { text: `${Math.round(reached.width)} × ${Math.round(reached.height)}`, x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
    frames.draw();
    app.invalidate('content');
  };

  // the followers of a resize are scaled by the ratio of the pressed element, the width ratio kx
  // for a handle on a side edge and the height ratio ky for one on the top or bottom edge, each
  // about the edge or corner of its own picture across from handle, or about its center
  const follow = (p: Press, handle: Handle, kx: number, ky: number, center: boolean) => {
    if (!p.followers?.length) return;
    const f = frameOf(app);
    const sx = handle.includes('w') ? -1 : handle.includes('e') ? 1 : 0;
    const sy = handle.includes('n') ? -1 : handle.includes('s') ? 1 : 0;
    const k = sx ? kx : ky;
    for (const m of p.followers) {
      for (const s of m.sized) {
        (s as HTMLElement).style.width = `${Math.round(cssWidth(s, m.base.width * k))}px`;
        // a stretched picture keeps the aspect that it has
        if ((p.from.get(s)?.height ?? null) !== null) (s as HTMLElement).style.height = `${Math.round(m.base.height * k)}px`;
      }
      const seen = toSlide(f, orientedBox(m.pic, f.scale, m.deg));
      // the center of the picture moves by half its growth away from the anchor, turned by its angle
      const a = (m.deg * Math.PI) / 180;
      const lx = center ? 0 : (sx * (seen.width - m.base.width)) / 2, ly = center ? 0 : (sy * (seen.height - m.base.height)) / 2;
      const cx = m.base.left + m.base.width / 2 + lx * Math.cos(a) - ly * Math.sin(a);
      const cy = m.base.top + m.base.height / 2 + lx * Math.sin(a) + ly * Math.cos(a);
      const now = placeOf(m.el);
      const from = p.from.get(m.el) as Place;
      writeLive(m.el, { ...now, translate: { x: (now.translate?.x ?? 0) + cx - (seen.left + seen.width / 2), y: (now.translate?.y ?? 0) + cy - (seen.top + seen.height / 2) }, rotate: from.rotate });
    }
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
      const els = [...new Set([...p.els, ...(p.sized ?? []), ...(p.followers ?? []).flatMap((m) => m.sized)])];
      if (ev && p.moved) {
        const changes = els.map((el) => {
          const to = placeOf(el);
          writePlace(app, el, to);
          return { el, from: p.from.get(el) as Place, to };
        });
        record(app, p.kind === 'resize' ? 'resize' : p.kind === 'rotate' ? 'rotate' : 'move', changes, p.selected);
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
    const el = pickOf(app, target);
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
    record(app, 'move', [{ el, from, to }], [el]);
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
