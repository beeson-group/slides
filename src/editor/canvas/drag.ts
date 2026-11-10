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
import { BY_ITSELF, RESIZABLE, aspectOf, bandAt, containerOf, frameOf, hasText, mediaIn, movableOf, movablesOf, onCanvas, toSlide, visualRect } from './hit.ts';
import { overlay, view } from './frames.ts';
import { injectStyle } from '../ui/dom.ts';

const CSS = `
html.beeson-dragging.beeson-copying, html.beeson-dragging.beeson-copying * { cursor: copy !important; }
`;

// a drag shorter than this, in screen pixels, is a click
const CLICK = 3;
// a dragged edge snaps to a line within this many screen pixels
const SNAP = 8;

// the place of an element: its offset and its width, null where its style does not set them
export type Place = { translate: Translate | null; width: number | null };

const px = (v: string | undefined): number | null => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : null;
};

export function placeOf(el: Element): Place {
  const style = (el as HTMLElement).style;
  const [x, y] = (style.translate ?? '').split(/\s+/).map((p) => px(p));
  const translate = x === null || x === undefined ? null : { x, y: y ?? 0 };
  return { translate: translate && (translate.x || translate.y) ? translate : null, width: el.matches(RESIZABLE) ? px(style.width) : null };
}

const samePlace = (a: Place, b: Place) =>
  (a.translate?.x ?? 0) === (b.translate?.x ?? 0) && (a.translate?.y ?? 0) === (b.translate?.y ?? 0) && a.width === b.width;

// the one function that writes the place of an element: on the page, and as the tag edit that a
// save writes into its start tag. the width is written as a declaration of the style, which the
// writer of the tags of the document model takes. it does not record the history, which the caller
// does with record()
export function writePlace(app: App, el: Element, p: Place): void {
  const style = (el as HTMLElement).style;
  const t = p.translate && (p.translate.x || p.translate.y) ? { x: Math.round(p.translate.x), y: Math.round(p.translate.y) } : null;
  style.translate = t ? `${t.x}px ${t.y}px` : '';
  const edit: TagEdit & { style?: Record<string, string | null> } = { ...app.tagEdits.get(el), translate: t };
  if (el.matches(RESIZABLE)) {
    const w = p.width === null ? null : Math.round(p.width);
    style.width = w === null ? '' : `${w}px`;
    if (w !== null || edit.style?.width !== undefined || /(^|;)\s*width\s*:/.test(el.getAttribute('style') ?? '')) edit.style = { ...edit.style, width: w === null ? null : `${w}px` };
  }
  app.tagEdits.set(el, edit);
  app.markDirty();
}

// the change of the places of elements, already written, as one entry of the history. an undo or a
// redo shows the slide of the elements and selects them
export function record(app: App, label: string, changes: { el: Element; from: Place; to: Place }[]): { el: Element; from: Place; to: Place }[] {
  const moved = changes.filter((c) => !samePlace(c.from, c.to));
  if (!moved.length) return moved;
  const apply = (way: 'from' | 'to') => {
    app.showSlide(moved[0].el);
    for (const c of moved) writePlace(app, c.el, c[way]);
    app.selection.set('elements', moved.map((c) => c.el));
    app.invalidate('content');
  };
  app.history.push({ label, undo: () => apply('from'), redo: () => apply('to') });
  return moved;
}

type Press = {
  kind: 'move' | 'resize' | 'marquee';
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
  // the selection before a marquee with Shift or the command modifier, which it adds to
  initial?: Element[];
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
    start('move', ev, el, sel.elements().filter((e) => !sel.elements().some((o) => o !== e && o.contains(e))), click);
  };

  const onDown = (ev: PointerEvent) => {
    if (ev.button !== 0 || press) return;
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    const sel = app.selection;
    const grip = target.closest('.beeson-grip');
    if (grip && !grip.classList.contains('fixed')) {
      const el = sel.only();
      if (!el) return;
      ev.preventDefault();
      ev.stopPropagation();
      Object.assign(start('resize', ev, el, [el], null), { handle: (grip as HTMLElement).dataset.handle as Handle, aspect: aspectOf(el) });
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
    // the offset of the pressed element at the lower right of the frames, where the pointer is
    // mostly near and the readout does not cover the guides at the pointer
    const t = p.el ? placeOf(p.el).translate : null;
    const seen = union(p.els.map(visualRect));
    view.readout = { text: `${ghosts.shown() ? 'Copy  ' : ''}${t?.x ?? 0}, ${t?.y ?? 0}`, x: seen.left + seen.width + 6, y: seen.top + seen.height + 10, at: 'frame' };
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
  };

  // a resize by a handle: the width is the width of the picture, and the offset is changed so that
  // the edge or corner across from the handle stays, since the box of a figure is laid out by the
  // theme around its width
  const resize = (p: Press, ev: PointerEvent, dx: number, dy: number) => {
    const el = p.els[0];
    const f = frameOf(app);
    const o = { aspect: p.aspect ?? null, center: aboutCenter(ev) };
    let box = resizeBox(p.base, p.handle as Handle, dx, dy, o);
    view.guides = [];
    if (!freeResize(ev)) {
      const snapped = snapResize(p.base, p.handle as Handle, box, targetsFor([el]), SNAP / f.scale, o);
      box = snapped.box;
      view.guides = snapped.guides;
    }
    (el as HTMLElement).style.width = `${Math.round(box.width)}px`;
    // the offset that puts the anchor of the box seen where the resize put it
    const seen = toSlide(f, visualRect(el));
    const h = p.handle as Handle;
    const shift = (a: 'x' | 'y') => {
      const [s, w] = a === 'x' ? ['left', 'width'] as const : ['top', 'height'] as const;
      const side = a === 'x' ? (h.includes('w') ? -1 : h.includes('e') ? 1 : 0) : (h.includes('n') ? -1 : h.includes('s') ? 1 : 0);
      if (o.center || side === 0) return box[s] + box[w] / 2 - (seen[s] + seen[w] / 2);
      return side === 1 ? box[s] - seen[s] : box[s] + box[w] - (seen[s] + seen[w]);
    };
    const now = placeOf(el).translate ?? { x: 0, y: 0 };
    writeLive(el, { translate: { x: now.x + shift('x'), y: now.y + shift('y') }, width: box.width });
    view.moving = [el];
    view.resizing = true;
    const after = toSlide(f, visualRect(el));
    view.readout = { text: `${Math.round(after.width)} × ${Math.round(after.height)}`, x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
    frames.draw();
    app.invalidate('content');
  };

  const onUp = (ev: PointerEvent | null) => {
    const p = press;
    if (!p) return;
    press = null;
    document.documentElement.classList.remove('beeson-dragging', 'beeson-resizing');
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
      if (ev && p.moved) {
        const changes = p.els.map((el) => {
          const to = placeOf(el);
          writePlace(app, el, to);
          return { el, from: p.from.get(el) as Place, to };
        });
        record(app, p.kind === 'resize' ? 'resize' : 'move', changes);
      } else if (p.moved) {
        for (const el of p.els) writeLive(el, p.from.get(el) as Place);
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
      for (const { el, box } of dropped) {
        const copy = await app.doc.duplicate(el);
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
