import type { App } from '../app.ts';
import type { TagEdit, Translate } from '../tags.ts';
import type { Box, Handle, Targets } from './snap.ts';
import { LAYOUT_GUIDES, anchored, fitPicture, lockedAxis, resizeBox, snapAngle, snapMove, snapResize } from './snap.ts';
import { BOXED, BY_ITSELF, CONTAINER, RESIZABLE, STRETCHED, aspectOf, bandAt, captionsOf, constrained, containerOf, cssWidth, figureFrame, frameOf, frameRect, hasText, innerBandAt, isTextSized, linePoints, linesOf, lineTouches, mediaIn, movableOf, movablesOf, objectOf, objectsOf, onCanvas, orientedBox, pickOf, pictureOf, pictureReach, sizedOf, snapBoxOf, stackAt, toSlide, turnable, twinOf, unturnedRect, visualRect } from './hit.ts';
import { groupFrame, overlay, turned, view, wh, xy } from './frames.ts';
import { enterGroup, settleCopies, freshGroup, groupOf, selectIn } from '../commands/order.ts';
import { afterMove, relink } from '../model/attach.ts';
import { copiedGroups, groupsOf, scopeOf, within } from '../model/groups.ts';
import { cornerBoxOf } from '../commands/align.ts';
import { backdropAt, pressBackdrop } from '../commands/backdrop.ts';
import { selectedRange } from '../commands/table.ts';
import { placeCaretAt } from '../selection.ts';
import { injectStyle } from '../ui/dom.ts';
import { editItem, outlineItem } from '../text/outline.ts';

const CSS = `
html.beeson-dragging.beeson-copying, html.beeson-dragging.beeson-copying * { cursor: copy !important; }
html.beeson-sizing, html.beeson-sizing * { cursor: var(--beeson-grip-cursor) !important; user-select: none !important; }
html.beeson-editing.beeson-pick .reveal .slides * { cursor: move; }
html.beeson-editing.beeson-pick-locked .reveal .slides * { cursor: default; }
`;

function holdGrip(grip: HTMLElement): void {
  view.held = grip;
  document.documentElement.style.setProperty('--beeson-grip-cursor', getComputedStyle(grip).cursor);
  document.documentElement.classList.add('beeson-sizing');
}

const CLICK = 3;
const ARRANGE = { move: 'arrange.setPosition', resize: 'arrange.setSize', rotate: 'arrange.setRotation' } as const;
const TAP = 10;
const SNAP = 8;

export type Place = { translate: Translate | null; width: number | null; height?: number | null; rotate?: number | null };

const OVERLAYS = '.beeson-overlay, .beeson-line-layer, .beeson-table-bars, .beeson-guides, .beeson-ruler';

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

function declare(el: Element, edit: TagEdit & { style?: Record<string, string | null> }, name: string, value: string | null): void {
  const had = new RegExp(`(^|;)\\s*${name}\\s*:`).test(el.getAttribute('style') ?? '');
  (el as HTMLElement).style.setProperty(name, value ?? '');
  if (value !== null || had || edit.style?.[name] !== undefined) edit.style = { ...edit.style, [name]: value };
}

const unturned = new WeakSet<Element>();

export function writePlace(app: App, el: Element, p: Place, force = false, twin = true): void {
  if (locked(el) && !force) return;
  const other = twin ? twinOf(app, el) : null;
  if (other) writePlace(app, other, p, force, false);
  const style = (el as HTMLElement).style;
  const r = p.translate ? { x: Math.round(p.translate.x), y: Math.round(p.translate.y) } : null;
  const t = r && (r.x || r.y) ? r : null;
  style.translate = t ? `${t.x}px ${t.y}px` : '';
  const edit: TagEdit & { style?: Record<string, string | null> } = { ...app.tagEdits.get(el), translate: t };
  if (el.matches(RESIZABLE) || isTextSized(el)) declare(el, edit, 'width', p.width === null ? null : `${Math.round(p.width)}px`);
  if (el.matches(STRETCHED) && p.height !== undefined) declare(el, edit, 'height', p.height === null ? null : `${Math.round(p.height)}px`);
  if (p.rotate !== undefined) {
    const r = p.rotate ? ((Math.round(p.rotate) % 360) + 360) % 360 : 0;
    const had = unturned.delete(el) || /(^|;)\s*rotate\s*:/.test(el.getAttribute('style') ?? '');
    style.rotate = r ? `${r}deg` : '';
    if (r || had || edit.style?.rotate !== undefined) edit.style = { ...edit.style, rotate: r ? `${r}deg` : null };
  }
  app.tagEdits.set(el, edit);
  app.markDirty();
}

export function record(app: App, label: string, changes: { el: Element; from: Place; to: Place }[], selected: Element[] = app.selection.elements()): { el: Element; from: Place; to: Place }[] {
  const moved = changes.filter((c) => !samePlace(c.from, c.to) && !locked(c.el));
  if (!moved.length) return moved;
  const before = selected.slice();
  const listed = new Map(changes.map((c) => [c.el, c]));
  const apply = (way: 'from' | 'to') => {
    app.showSlide(moved[0].el);
    for (const c of moved) {
      const twin = twinOf(app, c.el), own = twin ? listed.get(twin) : undefined;
      writePlace(app, c.el, c[way], true, !own);
      if (twin && own) writePlace(app, twin, own[way], true, false);
    }
    const kept = before.filter((el) => el.isConnected);
    const els = moved.map((c) => c.el);
    app.frame(kept.length ? kept : els.filter((el) => el.getClientRects().length && !els.some((o) => o !== el && o.contains(el))));
    app.invalidate('content');
  };
  const attachment = afterMove(app, moved.map((c) => c.el));
  const touches = moved.flatMap((c) => [c.el, twinOf(app, c.el)].filter((el): el is Element => !!el));
  app.history.push({
    label,
    undo: () => (attachment.undo(), apply('from')),
    redo: () => (apply('to'), attachment.redo()),
    get touches() {
      return [...touches, ...attachment.touched];
    },
  });
  return moved;
}

export type Change = { el: Element; from: Place; to: Place };

export const spinOf = (el: Element): Element => (el.matches(CONTAINER) ? (captionsOf(el).length ? el : pictureOf(el)) : el);

export function angleOf(el: Element): number {
  const spin = el.matches(CONTAINER) ? pictureOf(el) : el;
  const up = spin !== el ? el : spin.matches(RESIZABLE) ? spin.parentElement?.closest(CONTAINER) : null;
  return (((placeOf(spin).rotate ?? 0) + (up ? (placeOf(up).rotate ?? 0) : 0)) % 360 + 360) % 360;
}

export function seenCenter(app: App, spin: Element): { x: number; y: number } {
  const b = spin.matches(CONTAINER) && captionsOf(spin).length ? unturnedRect(spin).box : orientedBox(spin, frameOf(app).scale, angleOf(spin));
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}

function writeLive(el: Element, p: Place): void {
  const style = (el as HTMLElement).style;
  const t = p.translate && (Math.round(p.translate.x) || Math.round(p.translate.y)) ? p.translate : null;
  style.translate = t ? `${Math.round(t.x)}px ${Math.round(t.y)}px` : '';
  if (el.matches(RESIZABLE) || isTextSized(el)) style.width = p.width === null ? '' : `${Math.round(p.width)}px`;
  if (el.matches(STRETCHED) && p.height !== undefined) style.height = p.height === null ? '' : `${Math.round(p.height)}px`;
  if (p.rotate !== undefined) {
    if (!p.rotate && style.rotate) unturned.add(el);
    else if (p.rotate) unturned.delete(el);
    style.rotate = p.rotate ? `${Math.round(p.rotate)}deg` : '';
  }
}

export function turn(app: App, spin: Element, carrier: Element, deg: number, want: { x: number; y: number }, live = false): void {
  const was = placeOf(carrier).translate, memo = restOf.get(carrier), at = whole(angleOf(spin));
  const unbroken = !!memo && sameOffset(memo.at, was);
  const moved = !!memo && !unbroken && memo.deg === at;
  const d = { x: (was?.x ?? 0) - (memo?.at?.x ?? 0), y: (was?.y ?? 0) - (memo?.at?.y ?? 0) };
  const shift = (r: Translate | null): Translate | null => (r?.x ?? 0) + d.x || (r?.y ?? 0) + d.y ? { x: (r?.x ?? 0) + d.x, y: (r?.y ?? 0) + d.y } : null;
  const rests = unbroken ? memo.rests : moved ? new Map([...memo.rests].map(([a, r]) => [a, shift(r)])) : new Map<number, Translate | null>();
  const turns = unbroken || moved ? memo.turns + 1 : 1;
  if (!rests.has(at)) rests.set(at, was);
  const put = (el: Element, p: Place) => {
    if (!live) return writePlace(app, el, p);
    writeLive(el, p);
    const twin = twinOf(app, el);
    if (twin) writeLive(twin, p);
  };
  if (carrier !== spin && placeOf(carrier).rotate) put(carrier, { ...placeOf(carrier), rotate: null });
  const pic = spin.matches(CONTAINER) ? pictureOf(spin) : spin;
  if (pic !== spin && placeOf(pic).rotate) put(pic, { ...placeOf(pic), rotate: null });
  put(spin, { ...placeOf(spin), rotate: whole(deg) || null });
  const c = seenCenter(app, spin), k = frameOf(app).scale;
  const now = placeOf(carrier);
  let x = (now.translate?.x ?? 0) + (want.x - c.x) / k, y = (now.translate?.y ?? 0) + (want.y - c.y) / k;
  const e = spin.getBoundingClientRect(), a = (angleOf(spin) * Math.PI) / 180;
  const ux = (c.x - e.left - e.width / 2) / k, uy = (c.y - e.top - e.height / 2) / k;
  const vx = ux * Math.cos(a) + uy * Math.sin(a), vy = uy * Math.cos(a) - ux * Math.sin(a);
  if (Math.abs(ux - vx) > 0.01 || Math.abs(uy - vy) > 0.01) [x, y] = [Math.round(x + ux - vx) - ux + vx, Math.round(y + uy - vy) - uy + vy];
  const rest = rests.get(whole(deg)), near = 2 + turns;
  if (rest !== undefined && Math.abs(x - (rest?.x ?? 0)) <= near && Math.abs(y - (rest?.y ?? 0)) <= near) [x, y] = [rest?.x ?? 0, rest?.y ?? 0];
  if (Math.abs(x - (now.translate?.x ?? 0)) >= 0.5 || Math.abs(y - (now.translate?.y ?? 0)) >= 0.5) put(carrier, { ...now, translate: { x, y } });
  restOf.set(carrier, { rests, at: placeOf(carrier).translate, deg: whole(deg), turns });
}

const restOf = new WeakMap<Element, { rests: Map<number, Translate | null>; at: Translate | null; deg: number; turns: number }>();
const whole = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;
const sameOffset = (a: Translate | null, b: Translate | null) => (a?.x ?? 0) === (b?.x ?? 0) && (a?.y ?? 0) === (b?.y ?? 0);

export type Turner = { el: Element; spin: Element; angle: number; center: { x: number; y: number }; group?: { pivot: { x: number; y: number }; angle: number } };

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

export function apartOf(app: App, els: Element[]): Turner[] | null {
  const top = els.filter((el) => !els.some((o) => o !== el && o.contains(el)) && el.getClientRects().length);
  const ids = new Set(top.map(groupOf).filter((id) => id !== null));
  if (top.length < 2 || (ids.size === 1 && top.every(groupOf))) return null;
  const out: Turner[] = [];
  for (const el of top) {
    if (groupOf(el)) continue;
    if (!turnable(el)) return null;
    const spin = spinOf(el);
    out.push({ el, spin, angle: angleOf(el), center: seenCenter(app, spin) });
  }
  for (const id of ids) {
    const members = turnersOf(app, top.filter((el) => groupOf(el) === id));
    if (!members) return null;
    const group = { pivot: pivotOf(members.map((t) => t.el), members[0].angle), angle: members[0].angle };
    out.push(...members.map((t) => ({ ...t, group })));
  }
  return out.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
}

export const spunEls = (spin: Element): Element[] => (spin.matches(CONTAINER) ? [spin, pictureOf(spin)] : [spin]);

export const withTwins = (app: App, els: Element[]): Element[] => [...new Set(els.flatMap((el) => [el, twinOf(app, el) ?? el]))];

export const turnedEls = (turners: Turner[]): Element[] => [...new Set(turners.flatMap((t) => [t.el, ...spunEls(t.spin)]))];

export function turnMember(app: App, t: Turner, pivot: { x: number; y: number }, deg: number, live = false): void {
  const a = (deg * Math.PI) / 180;
  const dx = t.center.x - pivot.x, dy = t.center.y - pivot.y;
  turn(app, t.spin, t.el, t.angle + deg, { x: pivot.x + dx * Math.cos(a) - dy * Math.sin(a), y: pivot.y + dx * Math.sin(a) + dy * Math.cos(a) }, live);
}

export function pivotOf(els: Element[], deg = 0): { x: number; y: number } {
  const b = groupFrame(els, deg);
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}

function cornerOf(app: App, el: Element): { x: number; y: number } {
  const b = orientedBox(el, frameOf(app).scale, angleOf(el));
  return { x: b.left, y: b.top };
}

export function withCorners(app: App, els: Element[], change: () => Change[]): Change[] {
  const marks = els.filter((el) => el.matches(RESIZABLE) && el.getClientRects().length).map((el) => ({ el, carrier: objectOf(app, el), at: cornerOf(app, el) }));
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
  el: Element | null;
  selected: Element[];
  corner: Box | null;
  els: Element[];
  from: Map<Element, Place>;
  base: Box;
  scroll: { x: number; y: number };
  at: { x: number; y: number };
  click: (() => void) | null;
  handle?: Handle;
  aspect?: number | null;
  stretch?: boolean;
  keep?: boolean;
  sized?: Element[];
  pic?: Element;
  followers?: Follower[];
  initial?: Element[];
  center?: { x: number; y: number };
  angle?: number;
  size?: { width: number; height: number };
  framed?: Element | null;
  picture?: Box;
  group?: boolean;
  turners?: Turner[];
  apart?: boolean;
  was?: number;
  carrier?: Element;
};

type Follower = { el: Element; sized: Element[]; pic: Element; deg: number; base: Box; group?: { box: Box; deg: number } };

const angleIn = (el: Element, pic: Element): number => (placeOf(el).rotate ?? 0) + (pic === el ? 0 : (placeOf(pic).rotate ?? 0));

export const scrollOf = (app: App) => ({ x: app.stage?.el.scrollLeft ?? 0, y: app.stage?.el.scrollTop ?? 0 });

const union = (boxes: Box[]): Box => {
  const left = Math.min(...boxes.map((b) => b.left)), top = Math.min(...boxes.map((b) => b.top));
  return { left, top, width: Math.max(...boxes.map((b) => b.left + b.width)) - left, height: Math.max(...boxes.map((b) => b.top + b.height)) - top };
};

function contentRect(el: Element): Box {
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  const k = (el as HTMLElement).offsetWidth ? r.width / (el as HTMLElement).offsetWidth : 1;
  const p = (v: string) => (parseFloat(v) || 0) * k;
  return { left: r.left + p(s.paddingLeft), top: r.top + p(s.paddingTop), width: r.width - p(s.paddingLeft) - p(s.paddingRight), height: r.height - p(s.paddingTop) - p(s.paddingBottom) };
}

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
      } catch {}
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

export function keepPlaces(app: App, near: Element[], left: Element[] = []): (move: (el: Element, translate: Translate) => void) => void {
  const beside = [...new Set(near.flatMap((el) => [...(el.parentElement?.children ?? [])]))].filter(
    (el) => !left.includes(el) && !!(el as HTMLElement).style?.translate && !!app.pairing?.elements.has(el),
  );
  const at = (el: Element) => {
    const s = app.slides() as HTMLElement;
    const k = s.offsetWidth ? s.getBoundingClientRect().width / s.offsetWidth : 1;
    const r = el.getBoundingClientRect();
    return { x: r.left / k, y: r.top / k };
  };
  const places = beside.map(at);
  return (move) =>
    beside.forEach((el, i) => {
      const now = at(el);
      const [dx, dy] = [places[i].x - now.x, places[i].y - now.y].map((d) => Math.round(d * 10) / 10);
      if (!dx && !dy) return;
      const t = placeOf(el).translate ?? { x: 0, y: 0 };
      move(el, { x: t.x + dx, y: t.y + dy });
    });
}

export function install(app: App): void {
  injectStyle('drag', CSS);
  const frames = overlay();
  const ghosts = standIns();
  let press: Press | null = null;
  let quiet = false;
  let tapped: { el: Element; id: number; x: number; y: number } | null = null;
  const mac = () => app.platform === 'mac';
  const commandHeld = (ev: MouseEvent) => (mac() ? ev.metaKey : ev.ctrlKey);
  const freeMove = (ev: MouseEvent) => (mac() ? ev.metaKey : ev.altKey);
  const copyHeld = (ev: MouseEvent) => (mac() ? ev.altKey : ev.ctrlKey);
  const freeResize = (ev: MouseEvent) => (mac() ? ev.metaKey : ev.altKey);
  const aboutCenter = (ev: MouseEvent) => (mac() ? ev.altKey : ev.ctrlKey);

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

  const targetsFor = (els: Element[]): Targets => {
    const f = frameOf(app);
    const others = movablesOf(app).filter((o) => !els.some((el) => el === o || el.contains(o) || o.contains(el)));
    const frames_: Box[] = [];
    for (const el of els) {
      const up = containerOf(app, el);
      const box = up ? contentRect(up) : null;
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
    if (kind === 'rotate') els = withTwins(app, els);
    const p: Press = {
      kind, x: ev.clientX, y: ev.clientY, moved: false, el, els, click, selected: app.selection.elements().slice(), corner: el && kind === 'move' ? cornerBoxOf(app, els, el) : null,
      from: new Map(els.map((e) => [e, placeOf(e)])),
      base: els.length ? union(els.map((e) => snapBoxOf(app, e))) : { left: 0, top: 0, width: 0, height: 0 },
      scroll: scrollOf(app),
      at: { x: (ev.clientX - f.left) / f.scale, y: (ev.clientY - f.top) / f.scale },
    };
    press = p;
    view.hover = null;
    return p;
  };

  const pressElement = (ev: PointerEvent, el: Element, target: Element | null, onClick: Press['click'] = null) => {
    ev.preventDefault();
    leaveText();
    const sel = app.selection;
    const add = ev.shiftKey || commandHeld(ev);
    let click: Press['click'] = null;
    if (add) {
      if (sel.has(el)) click = () => sel.toggle(el);
      else sel.add(el);
    } else if (sel.elements().includes(el)) {
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
    const moved = objectsOf(app, sel.elements());
    const els = moved.filter((e) => !moved.some((o) => o !== e && o.contains(e)) && !locked(e));
    const lead = objectOf(app, el);
    start('move', ev, els.includes(lead) ? lead : (els[0] ?? null), els, onClick ?? click);
  };

  const onDown = (ev: PointerEvent) => {
    if (ev.button !== 0 || (ev.ctrlKey && mac()) || press) return;
    quiet = false;
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target || target.closest('.beeson-lock, .beeson-grouping')) return;
    const sel = app.selection;
    if (target === frames.rotor) {
      const el = sel.only();
      const box = frames.groupBox();
      const turners = el ? null : box ? turnersOf(app, sel.elements()) : apartOf(app, sel.elements());
      const spin = el ? spinOf(el) : null;
      const carrier = spin ? objectOf(app, spin) : null;
      if (!turners && (!el || !spin || !carrier || locked(el) || locked(spin) || locked(carrier))) return;
      ev.preventDefault();
      ev.stopPropagation();
      let center: { x: number; y: number };
      let p: Press;
      if (turners && box) {
        center = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
        p = start('rotate', ev, turners[0].el, turnedEls(turners), null);
        p.turners = turners;
        p.was = turners[0].angle;
        view.turn = { box, deg: frames.groupTurn() };
      } else if (turners) {
        center = turners[0].center;
        p = start('rotate', ev, turners[0].el, turnedEls(turners), null);
        Object.assign(p, { turners, apart: true, was: turners[0].angle });
      } else {
        center = seenCenter(app, spin as Element);
        p = start('rotate', ev, spin, [...new Set([...spunEls(spin as Element), carrier as Element])], null);
        p.was = angleOf(spin as Element);
        p.carrier = carrier as Element;
      }
      Object.assign(p, { center, angle: Math.atan2(ev.clientY - center.y, ev.clientX - center.x) * 180 / Math.PI });
      view.held = frames.rotor;
      document.documentElement.classList.add('beeson-rotating');
      return;
    }
    const grip = target.closest('.beeson-grip');
    if (grip && (grip as HTMLElement).dataset.group) {
      ev.preventDefault();
      ev.stopPropagation();
      const f = frameOf(app);
      const group = frames.groupAt(grip);
      const all = (group?.els ?? sel.elements()).filter((o) => !locked(o));
      const followers: Follower[] = all.filter((o) => !all.some((x) => x !== o && x.contains(o))).map((o) => {
        const pic = pictureOf(o);
        const deg = angleIn(o, pic);
        return { el: o, sized: sizedOf(o), pic, deg, base: toSlide(f, orientedBox(pic, f.scale, deg)) };
      });
      if (!followers.length) return;
      const p = Object.assign(start('resize', ev, followers[0].el, followers.map((m) => m.el), null), { handle: (grip as HTMLElement).dataset.handle as Handle, followers, group: true, was: group?.deg ?? frames.groupTurn() });
      for (const m of followers.flatMap((m) => m.sized)) if (!p.from.has(m)) p.from.set(m, placeOf(m));
      p.base = toSlide(f, group?.reach ?? frames.groupBox() ?? union(followers.map((m) => visualRect(m.pic))));
      holdGrip(grip as HTMLElement);
      return;
    }
    if (grip) {
      const member = frames.memberOf(grip);
      if (member?.matches('.backdrop')) return pressBackdrop(app, ev, member as HTMLElement, (grip as HTMLElement).dataset.handle as Handle);
      const el = member ? objectOf(app, member) : null;
      const sized = el ? sizedOf(el) : [];
      if (!el || !sized.length || locked(el)) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (!sel.elements().length) {
        leaveText();
        sel.set('elements', [el]);
      }
      const pic = pictureOf(el);
      const f = frameOf(app);
      const all = sel.elements();
      const groups = new Map<string, { box: Box; deg: number }>();
      const groupFor = (o: Element) => {
        const id = groupOf(o);
        const els = id ? all.filter((x) => groupOf(x) === id) : [];
        if (!id || els.length < 2) return undefined;
        if (!groups.has(id)) {
          const deg = turnersOf(app, els)?.[0].angle ?? 0;
          groups.set(id, { box: toSlide(f, groupFrame(els, deg)), deg });
        }
        return groups.get(id);
      };
      const followers: Follower[] = all
        .filter((o) => o !== el && !locked(o) && !o.contains(el) && !el.contains(o) && !all.some((x) => x !== o && x.contains(o)) && (sizedOf(o).length || groupFor(o)))
        .map((o) => {
          const pic = pictureOf(o);
          const deg = angleIn(o, pic);
          return { el: o, sized: sizedOf(o), pic, deg, base: toSlide(f, orientedBox(pic, f.scale, deg)), group: groupFor(o) };
        });
      const host = ev.pointerType === 'touch' ? app.hostOf(el) : null;
      const tap = host ? () => {
        const r = host.getBoundingClientRect();
        placeCaretAt(host, Math.min(Math.max(ev.clientX, r.left), r.right - 1), Math.min(Math.max(ev.clientY, r.top), r.bottom - 1));
      } : null;
      const p = Object.assign(start('resize', ev, el, [el, ...followers.map((m) => m.el)], tap), {
        handle: (grip as HTMLElement).dataset.handle as Handle, aspect: aspectOf(pic), sized, pic, followers, stretch: pic.matches(STRETCHED), keep: constrained(pic),
        framed: member && member.matches(CONTAINER) ? member : null,
      });
      for (const m of [...sized, ...followers.flatMap((m) => m.sized)]) if (!p.from.has(m)) p.from.set(m, placeOf(m));
      p.picture = toSlide(f, p.framed ? pictureReach(p.framed) : visualRect(pic));
      p.base = toSlide(f, p.framed ? frameRect(p.framed) : visualRect(pic));
      holdGrip(grip as HTMLElement);
      return;
    }
    if (target === frames.handle) {
      const el = frames.current();
      if (el) pressElement(ev, el, null);
      return;
    }
    if (!onCanvas(target, app, { x: ev.clientX, y: ev.clientY })) return;
    const next = ev.altKey && !ev.shiftKey && !commandHeld(ev) ? behind(ev) : null;
    pressCanvas(ev, target);
    if (!next) return;
    const pick = () => {
      quiet = true;
      selectIn(app, groupsOf(next), [next]);
      frames.draw();
    };
    const p = press as Press | null;
    if (p?.kind === 'move') p.click = pick;
    else if (!p) {
      ev.preventDefault();
      leaveText();
      pick();
    }
  };

  const behind = (ev: PointerEvent): Element | null => {
    const stack = stackAt(app, ev.clientX, ev.clientY);
    const sel = objectsOf(app, app.selection.elements());
    const at = stack.reduce((k, el, i) => (sel.includes(el) ? i : k), 0);
    return stack.length > 1 ? stack[(at + 1) % stack.length] : null;
  };

  const boxFirst = (el: Element): boolean => !el.matches('table') || !!groupOf(el) || (scopeOf().length > 0 && within(el));
  const editingIn = (el: Element): boolean => !!app.hostOf(document.activeElement) && el.contains(document.activeElement);
  const heldTable = (el: Element): boolean => el.matches('table') && app.selection.only() === el && !editingIn(el) && !selectedRange(app);

  const pressCanvas = (ev: PointerEvent, target: Element) => {
    const sel = app.selection;
    const inner = innerBandAt(app, ev.clientX, ev.clientY);
    if (inner) {
      pressElement(ev, inner, null);
      return;
    }
    const el = pickOf(app, target);
    const host = app.hostOf(target);
    if (el && host) {
      const editing = editingIn(el);
      if (ev.pointerType === 'touch' && !ev.shiftKey && !commandHeld(ev) && boxFirst(el) && sel.only() !== el && !editing) {
        ev.preventDefault();
        tapped = { el, id: ev.pointerId, x: ev.clientX, y: ev.clientY };
        return;
      }
      if (ev.shiftKey || commandHeld(ev) || (boxFirst(el) && sel.only() !== el && !editing)) pressElement(ev, el, target);
      else if ((boxFirst(el) || heldTable(el)) && sel.only() === el && !editing && !locked(el)) {
        const { clientX: x, clientY: y } = ev;
        pressElement(ev, el, target, () => placeCaretAt(host, x, y));
      }
      return;
    }
    const item = el ? outlineItem(el, target) : null;
    if (el && item) {
      pressElement(ev, el, target, sel.only() === el && !ev.shiftKey && !commandHeld(ev) && !locked(el) ? () => editItem(app, item) : null);
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
    const back = backdropAt(app, target);
    const add = ev.shiftKey || commandHeld(ev);
    if (back && !add && sel.only() === back) return pressBackdrop(app, ev, back, null);
    ev.preventDefault();
    leaveText();
    const initial = add ? sel.elements().slice() : [];
    if (!add) sel.clear();
    start('marquee', ev, null, [], back && !add ? () => sel.set('elements', [back]) : null).initial = initial;
  };

  const onMove = (ev: PointerEvent) => {
    if (tapped?.id === ev.pointerId && Math.hypot(ev.clientX - tapped.x, ev.clientY - tapped.y) >= TAP) tapped = null;
    const p = press;
    if (!p) {
      hover(ev);
      return;
    }
    if (!p.moved && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < CLICK) return;
    if (!p.moved && p.kind !== 'marquee' && app.commands.refused(ARRANGE[p.kind], { els: [...p.els, ...(p.sized ?? []), ...(p.followers ?? []).flatMap((m) => m.sized)] })) {
      p.click = null;
      onUp(null);
      return;
    }
    p.moved = true;
    const f = frameOf(app);
    if (p.kind === 'marquee') {
      const s = scrollOf(app);
      const x0 = p.x - s.x + p.scroll.x, y0 = p.y - s.y + p.scroll.y;
      const left = Math.min(x0, ev.clientX), top = Math.min(y0, ev.clientY);
      const box = { left, top, width: Math.abs(ev.clientX - x0), height: Math.abs(ev.clientY - y0) };
      app.stage?.edgeScroll(ev, () => press === p && onMove(ev));
      view.marquee = box;
      const touched = movablesOf(app).filter((el) => {
        const r = frameRect(el);
        return r.left <= box.left + box.width && r.left + r.width >= box.left && r.top <= box.top + box.height && r.top + r.height >= box.top;
      });
      for (const svg of linesOf(app)) if (lineTouches(svg, box)) touched.push(svg);
      app.selection.set('elements', [...(p.initial ?? []), ...touched]);
      frames.draw();
      return;
    }
    let dx = (ev.clientX - f.left) / f.scale - p.at.x;
    let dy = (ev.clientY - f.top) / f.scale - p.at.y;
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
    const c = p.corner;
    const at = c ? xy(c.left + dx, c.top + dy) : '';
    view.readout = { text: `${ghosts.shown() ? 'Copy  ' : ''}${at}`, x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
    document.documentElement.classList.add('beeson-dragging');
    frames.draw();
    app.invalidate('content');
  };

  const rotate = (p: Press, ev: PointerEvent) => {
    const c = p.center as { x: number; y: number };
    const now = Math.atan2(ev.clientY - c.y, ev.clientX - c.x) * 180 / Math.PI;
    const was = p.was ?? 0;
    const snapped = snapAngle(was + now - (p.angle ?? 0), { steps: ev.shiftKey, free: freeMove(ev) });
    const deg = snapped.deg;
    view.spoke = snapped.held ? { x: c.x, y: c.y, deg, reach: Math.hypot(ev.clientX - c.x, ev.clientY - c.y) + 24 } : null;
    if (p.turners) {
      const by = deg - was;
      for (const t of p.turners) turnMember(app, t, p.apart ? (t.group?.pivot ?? t.center) : c, by, true);
      if (view.turn) view.turn.deg = deg;
    } else turn(app, p.els[0], p.carrier ?? p.els[0], deg, c, true);
    view.moving = p.els;
    view.resizing = true;
    view.readout = { text: `${deg}°`, x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
    frames.draw();
    app.invalidate('content');
  };

  const setSize = (p: Press, width: number, height: number | null) => {
    for (const m of p.sized ?? p.els) {
      (m as HTMLElement).style.width = `${Math.round(cssWidth(m, width))}px`;
      if (m.matches(STRETCHED)) {
        const h = height ?? p.from.get(m)?.height ?? null;
        (m as HTMLElement).style.height = h === null ? '' : `${Math.round(h)}px`;
      }
    }
  };

  const modeOf = (p: Press, ev: PointerEvent): { aspect: number | null; free: boolean; height: boolean } => {
    if (!p.stretch) return { aspect: p.aspect ?? null, free: false, height: false };
    const corner = (p.handle as Handle).length === 2;
    const keep = corner ? p.keep !== ev.shiftKey : !!p.keep;
    const stretched = (p.from.get(p.pic ?? p.els[0])?.height ?? null) !== null || (p.pic ?? p.els[0]).matches(BOXED);
    return { aspect: keep ? (p.aspect ?? null) : null, free: !keep, height: !keep || stretched };
  };

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
    const whole = !!p.framed && captionsOf(p.framed).length > 0;
    const frameDeg = whole ? (p.from.get(el)?.rotate ?? 0) : deg;
    const upright = !!deg && whole && !frameDeg;
    if (frameDeg) {
      rotatedResize(p, ev, dx, dy, frameDeg, o, mode.height);
      return;
    }
    const h = p.handle as Handle;
    const seen = () => toSlide(f, p.framed ? pictureReach(p.framed) : visualRect(pic));
    const framed = () => toSlide(f, p.framed ? frameRect(p.framed) : visualRect(pic));
    const at = p.picture as Box;
    if (upright) Object.assign(o, { aspect: at.width / at.height, free: false });
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
      const frame = framed();
      const box = anchored(p.base, h, frame.width, frame.height, o.center);
      const snapped = snapResize(p.base, h, box, targetsFor([pic, ...(p.followers ?? []).map((m) => m.el)]), SNAP / f.scale, { ...o, aspect: o.aspect ? frame.width / frame.height : null });
      if (snapped.box !== box) fit(snapped.box);
      view.guides = snapped.guides;
      view.spacing = snapped.sizes;
    }
    const frame = framed();
    const box = anchored(p.base, h, frame.width, frame.height, o.center);
    const now = placeOf(el);
    writeLive(el, { ...now, translate: { x: (now.translate?.x ?? 0) + box.left - frame.left, y: (now.translate?.y ?? 0) + (isTextSized(pic) ? p.base.top : box.top) - frame.top } });
    const after = seen(), size = plain();
    follow(p, h, after.width / at.width, after.height / at.height, o.center);
    view.moving = p.els;
    view.resizing = true;
    const unturned = p.framed && captionsOf(p.framed).length ? unturnedRect(p.framed) : null;
    const caption = unturned ? (unturned.box.height - unturned.picture.height) / f.scale : 0;
    view.readout = { text: wh(size.width, size.height + caption), x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
    frames.draw();
    app.invalidate('content');
  };

  const rotatedResize = (p: Press, ev: PointerEvent, dx: number, dy: number, deg: number, o: { aspect: number | null; center: boolean; free: boolean }, height: boolean) => {
    const el = p.els[0] as HTMLElement;
    const pic = p.pic ?? el;
    const whole = p.framed && captionsOf(p.framed).length ? p.framed : null;
    const f = frameOf(app);
    const a = (deg * Math.PI) / 180;
    const turn = (x: number, y: number, by: number) => ({ x: x * Math.cos(by) - y * Math.sin(by), y: x * Math.sin(by) + y * Math.cos(by) });
    const local = turn(dx, dy, -a);
    const from = p.from.get(el) as Place;
    const center = () => {
      const b = toSlide(f, whole ? figureFrame(whole).box : orientedBox(pic, f.scale, deg));
      return { x: b.left + b.width / 2, y: b.top + b.height / 2, width: b.width, height: b.height };
    };
    const picture = () => toSlide(f, whole ? figureFrame(whole).picture : orientedBox(pic, f.scale, deg));
    if (!p.size) {
      const c = center();
      p.size = { width: c.width, height: c.height };
      p.base = { left: c.x - c.width / 2, top: c.y - c.height / 2, width: c.width, height: c.height };
      p.picture = picture();
    }
    const cx = p.base.left + p.base.width / 2, cy = p.base.top + p.base.height / 2;
    const h = p.handle as Handle;
    let box: Box;
    if (whole) {
      const want = resizeBox(p.base, h, local.x, local.y, { aspect: null, center: o.center, free: true });
      for (let i = 0; i < 3; i++) {
        const frame = center(), now = picture();
        const size = fitPicture(want, frame.width - now.width, frame.height - now.height, h, o, p.picture as Box);
        if (i && Math.abs(size.width - now.width) < 0.5 && Math.abs(size.height - now.height) < 0.5) break;
        setSize(p, size.width, height ? size.height : null);
      }
      const frame = center();
      box = anchored(p.base, h, frame.width, frame.height, o.center);
    } else {
      box = resizeBox(p.base, h, local.x, local.y, o);
      setSize(p, box.width, height ? box.height : null);
    }
    const move = turn(box.left + box.width / 2 - cx, box.top + box.height / 2 - cy, a);
    const seen = center();
    const now = placeOf(el);
    const sx = cx + move.x - seen.x, sy = cy + move.y - seen.y;
    writeLive(el, { ...now, translate: { x: (now.translate?.x ?? 0) + sx, y: (now.translate?.y ?? 0) + sy }, rotate: from.rotate });
    follow(p, h, box.width / p.base.width, box.height / p.base.height, o.center);
    view.moving = p.els;
    view.resizing = true;
    view.guides = [];
    view.spacing = [];
    view.readout = { text: wh(whole ? picture().width : box.width, box.height), x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
    frames.draw();
    app.invalidate('content');
  };

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
        if ((p.from.get(s)?.height ?? null) !== null || s.matches(BOXED)) (s as HTMLElement).style.height = `${Math.round(m.base.height * k)}px`;
      }
      const seen = toSlide(f, orientedBox(m.pic, f.scale, m.deg));
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
    const reached = toSlide(f, groupFrame(p.els, deg));
    view.readout = { text: wh(reached.width, reached.height), x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
    frames.draw();
    app.invalidate('content');
  };

  const follow = (p: Press, handle: Handle, kx: number, ky: number, center: boolean) => {
    if (!p.followers?.length) return;
    const f = frameOf(app);
    const sx = handle.includes('w') ? -1 : handle.includes('e') ? 1 : 0;
    const sy = handle.includes('n') ? -1 : handle.includes('s') ? 1 : 0;
    const k = sx ? kx : ky;
    for (const m of p.followers) {
      for (const s of m.sized) {
        (s as HTMLElement).style.width = `${Math.round(cssWidth(s, m.base.width * k))}px`;
        if ((p.from.get(s)?.height ?? null) !== null || s.matches(BOXED)) (s as HTMLElement).style.height = `${Math.round(m.base.height * k)}px`;
      }
      const seen = toSlide(f, orientedBox(m.pic, f.scale, m.deg));
      const now = placeOf(m.el);
      const from = p.from.get(m.el) as Place;
      if (m.group) {
        const b = m.group.box;
        const { x: ax, y: ay } = turned(b, m.group.deg, center || !sx ? b.left + b.width / 2 : sx > 0 ? b.left : b.left + b.width, center || !sy ? b.top + b.height / 2 : sy > 0 ? b.top : b.top + b.height);
        const text = isTextSized(m.pic);
        const cx = ax + (m.base.left + m.base.width / 2 - ax) * k;
        const cy = ay + ((text ? m.base.top : m.base.top + m.base.height / 2) - ay) * k;
        writeLive(m.el, { ...now, translate: { x: (now.translate?.x ?? 0) + cx - (seen.left + seen.width / 2), y: (now.translate?.y ?? 0) + cy - (text ? seen.top : seen.top + seen.height / 2) }, rotate: from.rotate });
        continue;
      }
      const a = (m.deg * Math.PI) / 180;
      const lx = center ? 0 : (sx * (seen.width - m.base.width)) / 2, ly = center ? 0 : (sy * (seen.height - m.base.height)) / 2;
      const cx = m.base.left + m.base.width / 2 + lx * Math.cos(a) - ly * Math.sin(a);
      const cy = m.base.top + m.base.height / 2 + lx * Math.sin(a) + ly * Math.cos(a);
      writeLive(m.el, { ...now, translate: { x: (now.translate?.x ?? 0) + cx - (seen.left + seen.width / 2), y: (now.translate?.y ?? 0) + cy - (seen.top + seen.height / 2) }, rotate: from.rotate });
    }
  };

  const onUp = (ev: PointerEvent | null) => {
    const t = tapped;
    tapped = null;
    if (t && ev?.pointerId === t.id) {
      leaveText();
      app.selection.set('elements', [t.el]);
    }
    const p = press;
    if (!p) return;
    press = null;
    app.stage?.edgeScroll(null);
    document.documentElement.classList.remove('beeson-dragging', 'beeson-sizing', 'beeson-rotating');
    view.moving = null;
    view.resizing = false;
    view.turn = null;
    view.spoke = null;
    view.held = null;
    view.guides = [];
    view.spacing = [];
    view.marquee = null;
    view.readout = null;
    const copying = ghosts.shown();
    ghosts.show(p, false);
    const els = [...new Set([...p.els, ...(p.sized ?? []), ...(p.followers ?? []).flatMap((m) => m.sized)])];
    const refused = !!ev && p.moved && p.kind !== 'marquee' && app.commands.refused(ARRANGE[p.kind], { els });
    if (p.kind === 'move' && ev && p.moved && !refused && copying && copyHeld(ev)) {
      void copyAt(p).catch((e) => app.fail(e));
    } else if (p.kind !== 'marquee') {
      if (ev && p.moved && !refused) {
        const changes = els.map((el) => {
          const to = placeOf(el);
          writePlace(app, el, to);
          return { el, from: p.from.get(el) as Place, to };
        });
        record(app, p.kind === 'resize' ? 'resize' : p.kind === 'rotate' ? 'rotate' : 'move', changes, p.selected);
      } else if (p.moved) {
        for (const el of els) {
          const from = p.from.get(el) as Place, twin = twinOf(app, el);
          writeLive(el, from);
          const memo = restOf.get(el);
          if (memo && p.kind === 'rotate') restOf.set(el, { ...memo, at: from.translate });
          if (twin && !els.includes(twin)) writeLive(twin, from);
        }
      } else if (ev) p.click?.();
    } else if (!p.moved && ev) p.click?.();
    if (p.kind === 'move' && p.moved) quiet = true;
    frames.draw();
    app.invalidate('content');
    pickCursor();
  };

  const copyAt = async (p: Press) => {
    const f = frameOf(app);
    const dropped = p.els.map((el) => ({ el, box: toSlide(f, frameRect(el)) }));
    for (const el of p.els) writeLive(el, p.from.get(el) as Place);
    const keep = keepPlaces(app, p.els);
    await app.history.selecting('Duplicate', async () => {
      const copies: Element[] = [];
      for (const { el, box } of dropped) {
        const copy = await app.doc.duplicate(el);
        settleCopies(app, [copy]);
        const now = toSlide(frameOf(app), frameRect(copy));
        const t = placeOf(copy).translate ?? { x: 0, y: 0 };
        app.doc.setTag(copy, { translate: { x: Math.round(t.x + box.left - now.left), y: Math.round(t.y + box.top - now.top) } }, 'move');
        copies.push(copy);
      }
      copiedGroups(copies, (taken) => freshGroup(app, taken)).forEach((g, i) => {
        if (g !== copies[i].getAttribute('data-group')) app.doc.setTag(copies[i], { attrs: { 'data-group': g } }, 'group');
      });
      relink(app, copies);
      keep((el, translate) => app.doc.setTag(el, { translate }, 'move'));
      app.selection.set('elements', copies);
    });
    frames.draw();
  };

  const hover = (ev: PointerEvent) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (target && (target === frames.handle || target.closest('.beeson-grip, .beeson-lock, .beeson-grouping, .beeson-table-bars'))) return;
    const el = pickOf(app, target);
    const band = el ? null : onCanvas(target, app, { x: ev.clientX, y: ev.clientY }) ? bandAt(app, ev.clientX, ev.clientY) : null;
    document.documentElement.classList.toggle('beeson-band', !!band);
    under = target;
    pickCursor();
    const hot = frames.current();
    const next = hot && hot !== el && toward(hot, ev) ? hot : el ?? band;
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

  let under: Element | null = null;
  const pickCursor = () => {
    const el = pickOf(app, under);
    const box = !!el && !!app.hostOf(under) && (boxFirst(el) || heldTable(el)) && !editingIn(el);
    document.documentElement.classList.toggle('beeson-pick', box && !locked(el));
    document.documentElement.classList.toggle('beeson-pick-locked', box && locked(el) && app.selection.only() !== el);
  };
  app.onRefresh(['selection', 'content', 'slide'], pickCursor);
  for (const type of ['focusin', 'focusout']) document.addEventListener(type, () => queueMicrotask(pickCursor));

  const columnOf = (el: Element): Box | null => {
    const parts = [frames.handle.hidden ? null : frames.handle.getBoundingClientRect(), frames.columnOf(el)].filter((b): b is Box => !!b);
    if (!parts.length) return null;
    const left = Math.min(...parts.map((b) => b.left)), top = Math.min(...parts.map((b) => b.top));
    return { left, top, width: Math.max(...parts.map((b) => b.left + b.width)) - left, height: Math.max(...parts.map((b) => b.top + b.height)) - top };
  };

  const toward = (el: Element, ev: PointerEvent): boolean => {
    const h = columnOf(el);
    if (!h) return false;
    const r = el.getBoundingClientRect();
    return ev.clientX >= h.left && ev.clientX <= r.left && ev.clientY >= Math.min(h.top, r.top) && ev.clientY <= Math.max(h.top + h.height, r.bottom);
  };

  const near = (el: Element, ev: PointerEvent): boolean => {
    const r = el.getBoundingClientRect();
    const h = columnOf(el);
    return ev.clientX >= Math.min(r.left - 28, h?.left ?? Infinity) && ev.clientX <= r.right + 6 && ev.clientY >= r.top - 28 && ev.clientY <= Math.max(r.bottom + 6, h ? h.top + h.height : -Infinity);
  };

  const reset = () => {
    const el = frames.current();
    if (!el) return;
    if (app.commands.refused('arrange.setPosition', { els: [el] })) return;
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
  window.addEventListener('click', (ev) => {
    if (quiet) ev.preventDefault();
    quiet = false;
  }, true);
  const held = () => !!press?.moved && press.kind !== 'marquee';
  app.commands.veto((_, c) => held() && Object.values(c.keys ?? {}).some((k) => k.includes('Escape')));
  window.addEventListener('keydown', (ev) => {
    if (!ev.repeat) quiet = false;
    if (ev.key !== 'Escape' || !held()) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    onUp(null);
  }, true);
  document.addEventListener('dragstart', (ev) => {
    if (ev.target instanceof Element && movableOf(app, ev.target)) ev.preventDefault();
  });
  app.listen('slide', () => {
    view.hover = null;
    under = null;
    if (press) onUp(null);
  });
}
