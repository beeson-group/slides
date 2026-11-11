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
import { LAYOUT_GUIDES, anchored, fitPicture, lockedAxis, resizeBox, snapMove, snapResize } from './snap.ts';
import { BY_ITSELF, CONTAINER, RESIZABLE, STRETCHED, aspectOf, bandAt, captionsOf, constrained, containerOf, cssWidth, frameOf, frameRect, hasText, isTextSized, lineEnds, linePoints, linesOf, mediaIn, movableOf, movablesOf, objectOf, objectsOf, onCanvas, orientedBox, pickOf, pictureOf, pictureReach, segmentTouches, sizedOf, snapBoxOf, toSlide, turnable, twinOf, visualRect } from './hit.ts';
import { groupFrame, overlay, turned, view, wh, xy } from './frames.ts';
import { enterGroup, settleCopies, freshGroup, groupOf } from '../commands/order.ts';
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

// the layers drawn over the slide by the editor, whose presses are presses on the canvas
const OVERLAYS = '.beeson-overlay, .beeson-line-layer, .beeson-table-bars, .beeson-guides, .beeson-ruler';

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
  // an offset under half a pixel is none, e.g. the rest of a turn taken back
  const r = p.translate ? { x: Math.round(p.translate.x), y: Math.round(p.translate.y) } : null;
  const t = r && (r.x || r.y) ? r : null;
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

export type Change = { el: Element; from: Place; to: Place };

// the element whose style takes the angle of el: the shown picture of a figure, since the caption
// of a figure is not turned with its picture, as a caption of PowerPoint is not, and else el
export const spinOf = (el: Element): Element => (el.matches(CONTAINER) ? pictureOf(el) : el);

// the angle of el in degrees, from 0 to 359: the angle of the picture of a figure, with the angle
// of a figure that is turned in the file
export function angleOf(el: Element): number {
  const spin = spinOf(el);
  const up = spin !== el ? el : spin.matches(RESIZABLE) ? spin.parentElement?.closest(CONTAINER) : null;
  return (((placeOf(spin).rotate ?? 0) + (up ? (placeOf(up).rotate ?? 0) : 0)) % 360 + 360) % 360;
}

// the center on the screen of spin as it is seen, i.e. of the picture of an image or a video,
// about which a turn turns it
export function seenCenter(app: App, spin: Element): { x: number; y: number } {
  const b = orientedBox(spin, frameOf(app).scale, angleOf(spin));
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}

// the place of an element on the page only, as during a drag, whose release writes it with
// writePlace
function writeLive(el: Element, p: Place): void {
  const style = (el as HTMLElement).style;
  const t = p.translate && (Math.round(p.translate.x) || Math.round(p.translate.y)) ? p.translate : null;
  style.translate = t ? `${Math.round(t.x)}px ${Math.round(t.y)}px` : '';
  if (el.matches(RESIZABLE) || isTextSized(el)) style.width = p.width === null ? '' : `${Math.round(p.width)}px`;
  if (el.matches(STRETCHED) && p.height !== undefined) style.height = p.height === null ? '' : `${Math.round(p.height)}px`;
  if (p.rotate !== undefined) style.rotate = p.rotate ? `${Math.round(p.rotate)}deg` : '';
}

// spin turned to deg degrees, with its center on the screen put at want by the offset of carrier,
// which is spin or the figure around it. an image fitted at a side of its box, e.g. in a plate,
// thus turns about the center of its picture. a figure that is turned in the file gives its angle
// to its picture. with live set, the page alone is changed, with the image of the other mode turned
// as writePlace turns it
export function turn(app: App, spin: Element, carrier: Element, deg: number, want: { x: number; y: number }, live = false): void {
  const put = (el: Element, p: Place) => {
    if (!live) return writePlace(app, el, p);
    writeLive(el, p);
    const twin = twinOf(app, el);
    if (twin) writeLive(twin, p);
  };
  if (carrier !== spin && placeOf(carrier).rotate) put(carrier, { ...placeOf(carrier), rotate: null });
  put(spin, { ...placeOf(spin), rotate: ((Math.round(deg) % 360) + 360) % 360 || null });
  const c = seenCenter(app, spin), k = frameOf(app).scale;
  const dx = (want.x - c.x) / k, dy = (want.y - c.y) / k;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
  const now = placeOf(carrier);
  put(carrier, { ...now, translate: { x: (now.translate?.x ?? 0) + dx, y: (now.translate?.y ?? 0) + dy } });
}

// a member of a group at the start of a turn of the group: the element that takes its angle, its
// angle, and the center of this element on the screen, about which its rotate turns it
export type Turner = { el: Element; spin: Element; angle: number; center: { x: number; y: number } };

// the members of a selected group that a turn moves, in the order of the page, whose first sets the
// angle of the group, or null when els are not one whole group that every member of can be turned
export function turnersOf(app: App, els: Element[]): Turner[] | null {
  const id = els.length > 1 ? groupOf(els[0]) : null;
  if (!id || !els.every((el) => groupOf(el) === id && turnable(el))) return null;
  const top = els.filter((el) => !els.some((o) => o !== el && o.contains(el)) && el.getClientRects().length);
  top.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  return top.map((el) => {
    const spin = spinOf(el);
    return { el, spin, angle: angleOf(el), center: seenCenter(app, spin) };
  });
}

// the elements whose places a turn of turners changes
export const turnedEls = (turners: Turner[]): Element[] => [...new Set(turners.flatMap((t) => [t.el, t.spin]))];

// a member t of a group turned by deg degrees from its angle at the start, about the point pivot
// on the screen, about which its center is carried
export function turnMember(app: App, t: Turner, pivot: { x: number; y: number }, deg: number, live = false): void {
  const a = (deg * Math.PI) / 180;
  const dx = t.center.x - pivot.x, dy = t.center.y - pivot.y;
  turn(app, t.spin, t.el, t.angle + deg, { x: pivot.x + dx * Math.cos(a) - dy * Math.sin(a), y: pivot.y + dx * Math.sin(a) + dy * Math.cos(a) }, live);
}

// the center of the frame of a group on the screen, turned by deg, about which the group is turned
export function pivotOf(els: Element[], deg = 0): { x: number; y: number } {
  const b = groupFrame(els, deg);
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}

// the upper left corner on the screen of the picture of el, without its rotation
function cornerOf(app: App, el: Element): { x: number; y: number } {
  const b = orientedBox(el, frameOf(app).scale, angleOf(el));
  return { x: b.left, y: b.top };
}

// the changes of the sizes of els made by change, with the upper left corner of each image or video
// kept where it is, as a typed width of Keynote and PowerPoint keeps it. the layout of a zone or a
// plate puts a picture with a width at another place, hence the offset of its figure is changed, as
// a resize by a grip changes it
export function withCorners(app: App, els: Element[], change: () => Change[]): Change[] {
  const marks = els.filter((el) => el.matches(STRETCHED) && el.getClientRects().length).map((el) => ({ el, carrier: objectOf(app, el), at: cornerOf(app, el) }));
  const from = new Map(marks.map((m) => [m.carrier, placeOf(m.carrier)]));
  const changes = change();
  const k = frameOf(app).scale;
  for (const m of marks) {
    const c = cornerOf(app, m.el);
    const dx = (m.at.x - c.x) / k, dy = (m.at.y - c.y) / k;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    const now = placeOf(m.carrier);
    writePlace(app, m.carrier, { ...now, translate: { x: (now.translate?.x ?? 0) + dx, y: (now.translate?.y ?? 0) + dy } });
  }
  for (const c of changes) c.to = placeOf(c.el);
  for (const [el, place] of from) if (!changes.some((c) => c.el === el)) changes.push({ el, from: place, to: placeOf(el) });
  return changes;
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
  // the scroll of the canvas at the press
  scroll: { x: number; y: number };
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
  // the figure whose frame, i.e. its picture with its caption, has the grip of a resize, or null for
  // the picture by itself, and the box of the picture at the press, in slide pixels
  framed?: Element | null;
  picture?: Box;
  // whether the grips of a group are pressed, which scale all its members about one anchor
  group?: boolean;
  // the members of a group turned by its rotate handle about the center of its frame
  turners?: Turner[];
  // the angle at the press of the element turned, or of the first member of a group, and the
  // element whose offset keeps the center of a turned picture, i.e. its figure
  was?: number;
  carrier?: Element;
};

// an element of a multiple selection that follows a resize by the grip of another: the elements
// whose width it writes, its picture, its angle, and the box of its picture at the press without
// its rotation, about the center of the picture, in slide pixels
type Follower = { el: Element; sized: Element[]; pic: Element; deg: number; base: Box };

// the angle of el and of the picture inside it, as its style sets them
const angleIn = (el: Element, pic: Element): number => (placeOf(el).rotate ?? 0) + (pic === el ? 0 : (placeOf(pic).rotate ?? 0));

// the scroll of the canvas, which moves the slide under a held pointer
export const scrollOf = (app: App) => ({ x: app.stage?.el.scrollLeft ?? 0, y: app.stage?.el.scrollTop ?? 0 });

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
export function standIns() {
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
    show(p: { els: Element[]; from: Map<Element, Place> }, on: boolean) {
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

  // a press on the slide, or on a frame, a grip, a line, a bar of a table, a ruler, or a guide of
  // the canvas, takes the keys from a control of the chrome, e.g. a tab of the inspector, so that
  // Esc and the arrows reach the selection, as after a click on the canvas of Keynote. most of
  // these presses are cancelled, hence the browser does not move the focus by itself. the listener
  // is added before those of the lines, the tables, and the guides, which stop the press
  window.addEventListener('pointerdown', (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target || !(onCanvas(target, app, { x: ev.clientX, y: ev.clientY }) || target.closest(OVERLAYS))) return;
    const a = document.activeElement;
    if (a instanceof HTMLElement && a !== document.body && !app.hostOf(a) && !a.closest('.reveal, .beeson-handle')) a.blur();
  }, true);

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
      const box = up ? contentRect(up) : null;
      // a zone around a picture with a width is the box of the picture, which does not snap
      const v = box && el.matches(RESIZABLE) ? visualRect(el) : null;
      if (box && !(v && Math.abs(v.width - box.width) < 0.5 && Math.abs(v.height - box.height) < 0.5)) frames_.push(toSlide(f, box));
    }
    const slides = app.slides() as HTMLElement;
    return {
      boxes: others.map((o) => toSlide(f, frameRect(o))).filter((b) => b.width > 0 && b.height > 0),
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
      scroll: scrollOf(app),
    };
    press = p;
    view.hover = null;
    return p;
  };

  // a press on an element: it is selected, or with Shift or the command modifier added, and taken
  // off again at a click without a move. a press on a selected element keeps the selection, so that
  // all of it is dragged, and a click on it then selects it alone, or the picture inside an
  // unlocked figure. a click on a member of a group that is selected as the whole selection
  // selects the member by itself
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
      const media = locked(el) ? null : mediaIn(el, target);
      const id = groupOf(el);
      const inGroup = several && !!id && sel.elements().every((o) => groupOf(o) === id);
      click = () => {
        if (inGroup) enterGroup(app, el);
        else if (several) sel.set('elements', [el]);
        else if (media) sel.set('elements', [media]);
      };
    } else sel.set('elements', [el]);
    // a picture selected inside its figure is dragged with its figure
    const moved = objectsOf(app, sel.elements());
    const els = moved.filter((e) => !moved.some((o) => o !== e && o.contains(e)) && !locked(e));
    const lead = objectOf(app, el);
    start('move', ev, els.includes(lead) ? lead : (els[0] ?? null), els, click);
  };

  const onDown = (ev: PointerEvent) => {
    if (ev.button !== 0 || press) return;
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    const sel = app.selection;
    if (target === frames.rotor) {
      const el = sel.only();
      const box = frames.groupBox();
      const turners = !el && box ? turnersOf(app, sel.elements()) : null;
      // the picture of a figure takes the angle, from the figure and from the picture selected
      const spin = el ? spinOf(el) : null;
      const carrier = spin ? objectOf(app, spin) : null;
      if (!turners && (!el || !spin || !carrier || locked(el) || locked(spin) || locked(carrier))) return;
      ev.preventDefault();
      ev.stopPropagation();
      let center: { x: number; y: number };
      let p: Press;
      if (turners && box) {
        // a group turns about the center of its frame, which is drawn turned with it
        center = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
        p = start('rotate', ev, turners[0].el, turnedEls(turners), null);
        p.turners = turners;
        p.was = turners[0].angle;
        view.turn = { box, deg: frames.groupTurn() };
      } else {
        center = seenCenter(app, spin as Element);
        p = start('rotate', ev, spin, [...new Set([spin as Element, carrier as Element])], null);
        p.was = angleOf(spin as Element);
        p.carrier = carrier as Element;
      }
      Object.assign(p, { center, angle: Math.atan2(ev.clientY - center.y, ev.clientX - center.x) * 180 / Math.PI });
      view.held = frames.rotor;
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
      const p = Object.assign(start('resize', ev, followers[0].el, followers.map((m) => m.el), null), { handle: (grip as HTMLElement).dataset.handle as Handle, followers, group: true, was: frames.groupTurn() });
      for (const m of followers.flatMap((m) => m.sized)) if (!p.from.has(m)) p.from.set(m, placeOf(m));
      p.base = toSlide(f, frames.groupBox() ?? union(followers.map((m) => visualRect(m.pic))));
      view.held = grip as HTMLElement;
      document.documentElement.classList.add('beeson-resizing');
      return;
    }
    if (grip && !grip.classList.contains('locked')) {
      // the grips of a picture selected inside its figure resize the figure
      const member = frames.memberOf(grip);
      const el = member ? objectOf(app, member) : null;
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
        framed: member && member.matches(CONTAINER) ? member : null,
      });
      for (const m of [...sized, ...followers.flatMap((m) => m.sized)]) if (!p.from.has(m)) p.from.set(m, placeOf(m));
      p.picture = toSlide(f, p.framed ? pictureReach(p.framed) : visualRect(pic));
      p.base = toSlide(f, p.framed ? frameRect(p.framed) : visualRect(pic));
      view.held = grip as HTMLElement;
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
        const r = frameRect(el);
        return r.left <= box.left + box.width && r.left + r.width >= box.left && r.top <= box.top + box.height && r.top + r.height >= box.top;
      });
      // a line is touched where the marquee touches the line itself, not only its box
      for (const svg of linesOf(app)) if (segmentTouches(...lineEnds(svg), box)) touched.push(svg);
      app.selection.set('elements', [...(p.initial ?? []), ...touched]);
      frames.draw();
      return;
    }
    // the pointer on the slide, which a scroll of the canvas moves too
    const s = scrollOf(app);
    let dx = (ev.clientX - p.x + s.x - p.scroll.x) / f.scale;
    let dy = (ev.clientY - p.y + s.y - p.scroll.y) / f.scale;
    if (p.kind !== 'rotate') app.stage?.edgeScroll(ev, () => press === p && onMove(ev));
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
    const at = c ? xy(c.left + dx, c.top + dy) : '';
    view.readout = { text: `${ghosts.shown() ? 'Copy  ' : ''}${at}`, x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
    document.documentElement.classList.add('beeson-dragging');
    frames.draw();
    app.invalidate('content');
  };

  // a turn by the rotate handle about the center of the element. Shift snaps the angle to steps of
  // 15 degrees, and the angle is shown at the pointer
  const rotate = (p: Press, ev: PointerEvent) => {
    const c = p.center as { x: number; y: number };
    const now = Math.atan2(ev.clientY - c.y, ev.clientX - c.x) * 180 / Math.PI;
    const was = p.was ?? 0;
    let deg = was + now - (p.angle ?? 0);
    deg = ev.shiftKey ? Math.round(deg / 15) * 15 : Math.round(deg);
    deg = ((deg % 360) + 360) % 360;
    if (p.turners) {
      // the angle of a group is that of its first member, as in the field Angle
      const by = deg - was;
      for (const t of p.turners) turnMember(app, t, c, by, true);
      if (view.turn) view.turn.deg = deg;
    } else turn(app, p.els[0], p.carrier ?? p.els[0], deg, c, true);
    view.moving = p.els;
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

  // a resize by a handle: the picture is sized so that the frame that has the handle, i.e. the
  // figure with its caption or the picture by itself, meets the pointer, and the offset of the
  // pressed element keeps the side of the frame across from the handle in place. the layout of a
  // figure puts the caption under its picture, which can change the margins of the frame, e.g. at
  // the first width of a picture fitted into its zone, hence the size is fitted again to the
  // margins measured, up to three times. a turned picture with a caption is framed upright around
  // both, and the box upright around the picture keeps its aspect
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
    const upright = !!deg && !!p.framed && captionsOf(p.framed).length > 0;
    if (deg && !upright) {
      rotatedResize(p, ev, dx, dy, deg, o, mode.height);
      return;
    }
    const h = p.handle as Handle;
    const seen = () => toSlide(f, p.framed ? pictureReach(p.framed) : visualRect(pic));
    const framed = () => toSlide(f, p.framed ? frameRect(p.framed) : visualRect(pic));
    const at = p.picture as Box;
    if (upright) Object.assign(o, { aspect: at.width / at.height, free: false });
    // the picture without its rotation, which is smaller than the box upright around it
    const plain = () => (upright ? toSlide(f, orientedBox(pic, f.scale, deg)) : seen());
    const fit = (want: Box) => {
      for (let i = 0; i < 3; i++) {
        const frame = framed(), now = seen(), own = plain();
        const size = fitPicture(want, frame.width - now.width, frame.height - now.height, h, o, at);
        if (i && Math.abs(size.width - now.width) < 0.5 && Math.abs(size.height - now.height) < 0.5) break;
        setSize(p, (size.width * own.width) / now.width, mode.height ? (size.height * own.height) / now.height : null);
      }
    };
    fit(resizeBox(p.base, h, dx, dy, { aspect: null, center: o.center, free: true }));
    view.guides = [];
    view.spacing = [];
    if (!freeResize(ev)) {
      // the frame snaps, with the aspect that it has where the picture keeps its aspect
      const frame = framed();
      const box = anchored(p.base, h, frame.width, frame.height, o.center);
      const snapped = snapResize(p.base, h, box, targetsFor([pic, ...(p.followers ?? []).map((m) => m.el)]), SNAP / f.scale, { ...o, aspect: o.aspect ? frame.width / frame.height : null });
      if (snapped.box !== box) fit(snapped.box);
      view.guides = snapped.guides;
      view.spacing = snapped.sizes;
    }
    // the offset that puts the side of the frame across from the handle where it was. a text block
    // keeps its top, and its wrapped text sets its height
    const frame = framed();
    const box = anchored(p.base, h, frame.width, frame.height, o.center);
    const now = placeOf(el);
    writeLive(el, { ...now, translate: { x: (now.translate?.x ?? 0) + box.left - frame.left, y: (now.translate?.y ?? 0) + (isTextSized(pic) ? p.base.top : box.top) - frame.top } });
    const after = seen(), size = plain();
    follow(p, h, after.width / at.width, after.height / at.height, o.center);
    view.moving = p.els;
    view.resizing = true;
    view.readout = { text: wh(size.width, size.height), x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
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
    view.readout = { text: wh(box.width, box.height), x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
    frames.draw();
    app.invalidate('content');
  };

  // a resize of a group by its grips, without snapping: the box of the group keeps its aspect at a
  // corner unless Shift is held, and each member is scaled by the ratio of the box, with its center
  // moved away from the edge or corner across from the grip, or from the center of the group. the
  // pointer is taken in the axes of the frame, which is turned by the angle of the group
  const groupResize = (p: Press, ev: PointerEvent, dx: number, dy: number) => {
    const f = frameOf(app);
    const h = p.handle as Handle;
    const corner = h.length === 2;
    const center = aboutCenter(ev);
    const deg = p.was ?? 0, r = (deg * Math.PI) / 180;
    const box = resizeBox(p.base, h, dx * Math.cos(r) + dy * Math.sin(r), dy * Math.cos(r) - dx * Math.sin(r), { aspect: corner && !ev.shiftKey ? p.base.width / p.base.height : null, center, free: true });
    const sx = h.includes('w') ? -1 : h.includes('e') ? 1 : 0;
    const sy = h.includes('n') ? -1 : h.includes('s') ? 1 : 0;
    const k = sx ? box.width / p.base.width : box.height / p.base.height;
    const b = p.base;
    const { x: ax, y: ay } = turned(b, deg, center || !sx ? b.left + b.width / 2 : sx > 0 ? b.left : b.left + b.width, center || !sy ? b.top + b.height / 2 : sy > 0 ? b.top : b.top + b.height);
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
    // the size that the members reach with the captions under their pictures, as W and H of the
    // Arrange pane give it, since the layout sets the height of a zone and a text block, which can
    // differ from box
    const reached = toSlide(f, groupFrame(p.els, deg));
    view.readout = { text: wh(reached.width, reached.height), x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
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
    app.stage?.edgeScroll(null);
    document.documentElement.classList.remove('beeson-dragging', 'beeson-resizing', 'beeson-rotating');
    view.moving = null;
    view.resizing = false;
    view.turn = null;
    view.held = null;
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
    const dropped = p.els.map((el) => ({ el, box: toSlide(f, frameRect(el)) }));
    for (const el of p.els) writeLive(el, p.from.get(el) as Place);
    await app.history.selecting('Duplicate', async () => {
      const copies: Element[] = [];
      // the copies of a group are a new group
      const groups = new Map<string, string>();
      for (const { el, box } of dropped) {
        const copy = await app.doc.duplicate(el);
        // before the copy is put where it was dropped, since a plate made a zone is laid out anew
        settleCopies(app, [copy]);
        const g = copy.getAttribute('data-group');
        if (g) {
          if (!groups.has(g)) groups.set(g, freshGroup(app));
          app.doc.setTag(copy, { attrs: { 'data-group': groups.get(g)! } }, 'group');
        }
        const now = toSlide(frameOf(app), frameRect(copy));
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
