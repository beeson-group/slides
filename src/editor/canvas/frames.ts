import type { App } from '../app.ts';
import { HOST } from '../app.ts';
import { injectStyle } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { GROUP_ACTIONS, groupAction, groupOf, lockEls, membersOf, runGroupAction } from '../commands/order.ts';
import type { GroupAction } from '../commands/order.ts';
import { scopeOf } from '../model/groups.ts';
import { apartOf, turnersOf } from './drag.ts';
import type { Box, Guide, Handle, Spacing } from './snap.ts';
import { BY_ITSELF, CONTAINER, RESIZABLE, captionsOf, objectsOf, figureFrame, frameOf, frameRect, isTextSized, movableOf, orientedBox, pictureOf, scaleAt, sizedOf, toScreen, turnable as turns } from './hit.ts';

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];

export const view: {
  hover: Element | null;
  moving: Element[] | null;
  resizing: boolean;
  guides: Guide[];
  spacing: Spacing[];
  readout: { text: string; x: number; y: number; at: 'pointer' | 'frame' } | null;
  marquee: Box | null;
  turn: { box: Box; deg: number } | null;
  spoke: { x: number; y: number; deg: number; reach: number } | null;
  held: HTMLElement | null;
} = { hover: null, moving: null, resizing: false, guides: [], spacing: [], readout: null, marquee: null, turn: null, spoke: null, held: null };

export const xy = (x: number, y: number) => `x: ${Math.round(x)} px  y: ${Math.round(y)} px`;
export const wh = (w: number, h: number) => `w: ${Math.round(w)} px  h: ${Math.round(h)} px`;

const CSS = `
.beeson-overlay { position: fixed; inset: 0; z-index: 51; pointer-events: none; }
.beeson-frame { position: fixed; pointer-events: none; box-sizing: border-box; border: 1px solid var(--ed-muted, var(--subtle, #bbb)); opacity: 0.3; }
.beeson-frame:where(.selected, .union, .entered, .caret) { border: 1px solid #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.55), inset 0 0 0 1px rgba(0, 0, 0, 0.55); opacity: 1; }
.beeson-frame.entered { border: 3px solid rgba(0, 0, 0, 0.55); box-shadow: none; outline: 1px dashed #fff; outline-offset: -2px; }
.beeson-overlay [hidden] { display: none !important; }
.beeson-grip { position: fixed; width: 9px; height: 9px; margin: -5.5px 0 0 -5.5px; border-radius: 50%; border: 1px solid #444; background: #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25); pointer-events: auto; touch-action: none; }
.beeson-frame.locked { opacity: 0.45; }
.beeson-grip.square { border-radius: 0; }
.beeson-grip.cut:is([data-handle=w], [data-handle=e]) { height: 26px; margin-top: -14px; border-radius: 4px; }
.beeson-grip.cut:is([data-handle=n], [data-handle=s]) { width: 26px; margin-left: -14px; border-radius: 4px; }
.beeson-grip.cut::after { content: ""; position: absolute; inset: -9px; }
.beeson-rotor { position: fixed; width: 14px; height: 14px; margin: -7px 0 0 -7px; box-sizing: border-box; border-radius: 50%; border: 1px solid #444; background: #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25); color: #444; font: 600 10px/12px system-ui, sans-serif; text-align: center; cursor: grab; user-select: none; pointer-events: auto; touch-action: none; }
.beeson-rotor-stem { position: fixed; width: 1px; height: 11px; margin-left: -0.5px; background: #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.55); transform-origin: 50% 0; }
html.beeson-rotating, html.beeson-rotating * { cursor: grabbing !important; user-select: none !important; }
.beeson-grip[data-handle=nw], .beeson-grip[data-handle=se] { cursor: nwse-resize; }
.beeson-grip[data-handle=ne], .beeson-grip[data-handle=sw] { cursor: nesw-resize; }
.beeson-grip[data-handle=n], .beeson-grip[data-handle=s] { cursor: ns-resize; }
.beeson-grip[data-handle=e], .beeson-grip[data-handle=w] { cursor: ew-resize; }
.beeson-handle, .beeson-lock, .beeson-grouping { position: fixed; width: 22px; height: 22px; box-sizing: border-box; border-radius: 6px; border: 1px solid var(--ed-line, var(--line, #555)); background: var(--ed-panel, var(--bg, #000)); color: var(--ed-text, var(--text, #eee)); font: 14px/20px system-ui, sans-serif; text-align: center; cursor: move; user-select: none; pointer-events: auto; }
.beeson-handle:hover, .beeson-handle:focus-visible, .beeson-lock:hover, .beeson-lock:focus-visible, .beeson-grouping:hover, .beeson-grouping:focus-visible { border-color: var(--ed-text, var(--text, #eee)); outline: none; }
.beeson-lock, .beeson-grouping { display: grid; place-items: center; cursor: default; touch-action: manipulation; }
.beeson-lock.closed, .beeson-grouping.filled { background: var(--ed-text, var(--text, #eee)); color: var(--ed-panel, var(--bg, #000)); }
.beeson-guide { position: fixed; background: var(--ed-guide, #e8590c); }
.beeson-guide.v { width: 1px; }
.beeson-guide.h { height: 1px; }
.beeson-guide.spoke { width: 1px; margin-left: -0.5px; }
.beeson-gap { position: fixed; color: var(--ed-guide, #e8590c); }
.beeson-gap.h { margin-top: -3.5px; }
.beeson-gap.v { margin-left: -3.5px; }
.beeson-gap svg { display: block; overflow: visible; }
.beeson-offset { position: fixed; height: 22px; padding: 0 7px; box-sizing: border-box; border-radius: 5px; background: var(--ed-guide, #e8590c); color: #fff; font: 600 12px/22px system-ui, sans-serif; font-variant-numeric: tabular-nums; white-space: nowrap; }
.beeson-offset.frame { transform: translateX(-100%); }
.beeson-marquee { position: fixed; box-sizing: border-box; border: 1px solid var(--ed-select, #7048e8); background: color-mix(in srgb, var(--ed-select, #7048e8) 12%, transparent); }
html.beeson-editing .reveal .beeson-movable:focus-visible { outline: 2px solid var(--ed-select, #7048e8); outline-offset: 6px; }
html.beeson-dragging, html.beeson-dragging * { cursor: move !important; user-select: none !important; }
html.beeson-band, html.beeson-band .reveal * { cursor: move; }
html.beeson-editing .reveal .slides section img, html.beeson-editing .reveal .slides section video, html.beeson-editing .reveal .slides section .figure-box, html.beeson-editing .reveal .slides section .plate, html.beeson-editing .reveal .slides section .qr, html.beeson-editing .reveal .slides section .shape { cursor: move; }
html.beeson-editing .reveal .slides section .shape { pointer-events: auto; }
html.beeson-editing .reveal .slides section [data-locked]:is(img, video, .figure-box, .plate, .qr, .shape), html.beeson-editing .reveal .slides section [data-locked] :is(img, video, .qr) { cursor: default; }
html.beeson-playing :is(.beeson-overlay, .beeson-line-layer, .beeson-table-bars, .beeson-guides, .beeson-backdrop-cuts, .beeson-attach-target) { visibility: hidden !important; }
html.beeson-playing .reveal .slides, html.beeson-playing .reveal .slides * { caret-color: transparent !important; }
html.beeson-playing .reveal .beeson-movable:focus-visible { outline: none; }
`;

const previews = new Map<string, () => void>();
export const previewPlays = (): boolean => previews.size > 0;
export const stopPreviews = (): void => { for (const stop of [...previews.values()]) stop(); };
export function setPreview(app: App, kind: string, on: boolean, stop: () => void = () => {}): void {
  const was = previewPlays();
  if (on) previews.set(kind, stop);
  else previews.delete(kind);
  if (was === previewPlays()) return;
  document.documentElement.classList.toggle('beeson-playing', previewPlays());
  app.invalidate('selection');
}

const touchAdjustmentTarget = (d: HTMLElement): void => d.addEventListener('click', () => {});

const div = (className: string, parent: HTMLElement): HTMLDivElement => {
  const d = document.createElement('div');
  d.className = className;
  d.hidden = true;
  parent.append(d);
  return d;
};

const place = (d: HTMLElement, b: Box) => {
  d.hidden = false;
  Object.assign(d.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });
};

export type FramedGroup = { els: Element[]; reach: Box; deg: number };

const grow = (b: Box, by: number): Box => ({ left: b.left - by, top: b.top - by, width: b.width + 2 * by, height: b.height + 2 * by });

export const growOf = (el: Element): number => (el.matches(RESIZABLE) || el.matches(CONTAINER) || el.matches('.backdrop') ? 0 : 6);

const angleOf = (el: Element): number => parseFloat(getComputedStyle(el).rotate) || 0;

export function groupReach(els: Element[]): Box {
  const seen = els.map(frameRect);
  const left = Math.min(...seen.map((b) => b.left)), top = Math.min(...seen.map((b) => b.top));
  return { left, top, width: Math.max(...seen.map((b) => b.left + b.width)) - left, height: Math.max(...seen.map((b) => b.top + b.height)) - top };
}

const INSET = 8;

export function orientOf(el: Element, scale: number): { box: Box; deg: number } {
  if (captionsOf(el).length) {
    const whole = figureFrame(el);
    return { box: grow(whole.deg ? whole.box : frameRect(el), INSET), deg: whole.deg };
  }
  const pic = pictureOf(el);
  const deg = angleOf(el) + (pic === el ? 0 : angleOf(pic)) + (el.matches(RESIZABLE) && el.parentElement?.closest(CONTAINER) ? angleOf(el.parentElement.closest(CONTAINER) as Element) : 0);
  return deg ? { box: orientedBox(pic, scale, deg), deg } : { box: frameRect(el), deg: 0 };
}

export function turned(box: Box, deg: number, x: number, y: number): { x: number; y: number } {
  if (!deg) return { x, y };
  const a = (deg * Math.PI) / 180;
  const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
  return { x: cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), y: cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a) };
}

export function groupFrame(els: Element[], deg: number): Box {
  if (!deg) return groupReach(els);
  const a = (deg * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const back = (x: number, y: number) => ({ x: x * cos + y * sin, y: y * cos - x * sin });
  const points = els.flatMap((el) => {
    const pic = pictureOf(el), d = angleOf(el) + (pic === el ? 0 : angleOf(pic));
    const whole = captionsOf(el).length ? figureFrame(el) : null;
    const b = whole?.deg ? whole.box : orientedBox(pic, scaleAt(el), d);
    const at = back(b.left + b.width / 2, b.top + b.height / 2);
    const boxes = whole?.deg ? [{ x: at.x, y: at.y, w: b.width, h: b.height, d: whole.deg - deg }] : [{ x: at.x, y: at.y, w: b.width, h: b.height, d: d - deg }, ...captionsOf(el).map((r) => ({ x: at.x + r.left + r.width / 2 - (b.left + b.width / 2), y: at.y + r.top + r.height / 2 - (b.top + b.height / 2), w: r.width, h: r.height, d: 0 }))];
    return boxes.flatMap(({ x, y, w, h, d }) => {
      const c = { left: x - w / 2, top: y - h / 2, width: w, height: h };
      return [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => turned(c, d, c.left + u * w, c.top + v * h));
    });
  });
  const left = Math.min(...points.map((p) => p.x)), top = Math.min(...points.map((p) => p.y));
  const width = Math.max(...points.map((p) => p.x)) - left, height = Math.max(...points.map((p) => p.y)) - top;
  const cx = left + width / 2, cy = top + height / 2;
  return { left: cx * cos - cy * sin - width / 2, top: cx * sin + cy * cos - height / 2, width, height };
}

const ROTOR = 18;
const SHORT = 11;
const KNOB = 7;
const WORDS = 'h1, h2, h3, p, li, dt, dd, div.math, .caption, figcaption, td, th, pre, blockquote';
const HANDLE = 22;
const HANDLE_GAP = 10;
const ROW_BAR = 24;
const ROW = 23;

export class Frames {
  readonly layer: HTMLDivElement;
  readonly hoverFrame: HTMLDivElement;
  readonly handle: HTMLDivElement;
  readonly grips: Record<Handle, HTMLDivElement>;
  private readonly gripSets: Record<Handle, HTMLDivElement>[] = [];
  private members: (Element | null)[] = [];
  private groups: (FramedGroup | null)[] = [];
  readonly rotor: HTMLDivElement;
  private readonly stem: HTMLDivElement;
  private readonly spoke: HTMLDivElement;
  private readonly frames: HTMLDivElement[] = [];
  private readonly union: HTMLDivElement;
  private readonly unions: HTMLDivElement[] = [];
  private readonly entered: HTMLDivElement;
  private readonly caret: HTMLDivElement;
  private rotorAt = ROTOR;
  private group: Box | null = null;
  private reach: Box | null = null;
  private groupDeg = 0;
  private readonly guides: HTMLDivElement[] = [];
  private readonly gaps: HTMLDivElement[] = [];
  readonly readout: HTMLDivElement;
  private readonly marquee: HTMLDivElement;
  private readonly locks: HTMLDivElement[] = [];
  private lockTargets: Element[][] = [];
  private columns = new Map<Element, Box>();
  private readonly grouping: HTMLDivElement;
  private groupAct: GroupAction | null = null;
  private readonly app: App;

  constructor(app: App) {
    injectStyle('frames', CSS);
    this.app = app;
    this.layer = document.createElement('div');
    this.layer.className = 'beeson-overlay';
    this.hoverFrame = div('beeson-frame', this.layer);
    this.frames.push(div('beeson-frame selected', this.layer));
    this.union = div('beeson-frame union group', this.layer);
    this.entered = div('beeson-frame entered', this.layer);
    this.caret = div('beeson-frame caret', this.layer);
    this.guides.push(div('beeson-guide v', this.layer), div('beeson-guide h', this.layer));
    this.marquee = div('beeson-marquee', this.layer);
    this.grips = this.gripSet();
    this.stem = div('beeson-rotor-stem', this.layer);
    this.rotor = div('beeson-rotor', this.layer);
    touchAdjustmentTarget(this.rotor);
    this.rotor.textContent = '↻';
    this.rotor.title = 'Drag to rotate, held at multiples of 45°, with Shift in steps of 15°';
    this.spoke = div('beeson-guide spoke', this.layer);
    this.handle = div('beeson-handle', this.layer);
    this.handle.textContent = '⠿';
    this.handle.title = 'Drag to move, double-click to put back, or nudge with the arrow keys';
    this.handle.tabIndex = 0;
    this.handle.setAttribute('role', 'button');
    this.handle.setAttribute('aria-label', 'Move the text element. Nudge it with the arrow keys, and put it back with Enter');
    this.readout = div('beeson-offset', this.layer);
    this.grouping = this.button('beeson-grouping', () => {
      if (this.groupAct) runGroupAction(this.app, this.groupAct).catch((e) => this.app.fail(e));
    });
  }

  private button(className: string, act: () => void): HTMLDivElement {
    const b = div(className, this.layer);
    b.tabIndex = 0;
    b.setAttribute('role', 'button');
    b.addEventListener('pointerdown', (ev) => ev.preventDefault());
    b.addEventListener('click', act);
    b.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      ev.stopPropagation();
      act();
    });
    return b;
  }

  private padlock(): HTMLDivElement {
    const n = this.locks.length;
    const b = this.button('beeson-lock', () => {
      const els = this.lockTargets[n];
      if (!els?.length) return;
      lockEls(this.app, els, !els.every((el) => el.hasAttribute('data-locked'))).catch((e) => this.app.fail(e));
    });
    this.locks.push(b);
    return b;
  }

  columnOf(el: Element): Box | null {
    return this.columns.get(el) ?? null;
  }

  private gripSet(): Record<Handle, HTMLDivElement> {
    const n = this.gripSets.length;
    const set = Object.fromEntries(HANDLES.map((h) => {
      const g = div('beeson-grip', this.layer);
      touchAdjustmentTarget(g);
      g.classList.toggle('square', this.app.platform === 'mac');
      g.dataset.handle = h;
      g.dataset.member = String(n);
      return [h, g];
    })) as Record<Handle, HTMLDivElement>;
    this.gripSets.push(set);
    return set;
  }

  groupBox(): Box | null {
    return this.reach;
  }

  groupTurn(): number {
    return this.groupDeg;
  }

  groupAt(grip: Element): FramedGroup | null {
    return this.groups[Number((grip as HTMLElement).dataset.member)] ?? null;
  }

  memberOf(grip: Element): Element | null {
    return this.members[Number((grip as HTMLElement).dataset.member)] ?? null;
  }

  current(): Element | null {
    const active = document.activeElement instanceof Element ? document.activeElement : null;
    const editing = active?.closest(HOST) ?? null;
    return view.moving?.[0] ?? view.hover ?? movableOf(this.app, editing) ?? this.app.selection.only();
  }

  gripsOf(el: Element | null): 'live' | 'locked' | null {
    if (!el || !(this.app.selection.elements().includes(el) || el === this.caretElement())) return null;
    if (el.hasAttribute('data-locked')) return 'locked';
    return sizedOf(el).length || el.matches('.backdrop') ? 'live' : null;
  }

  private handles(el: Element): boolean {
    return !(el.matches(BY_ITSELF) && !el.matches('tycho-viewer')) && !((sizedOf(el).length || el.matches('.backdrop')) && !isTextSized(el));
  }

  caretElement(): Element | null {
    if (this.app.selection.elements().length) return null;
    const active = document.activeElement instanceof Element ? document.activeElement : null;
    const el = movableOf(this.app, active?.closest(HOST) ?? null);
    return el && sizedOf(el).length ? el : null;
  }

  draw(): void {
    const app = this.app;
    const v = app.stage?.viewport;
    if (v) this.layer.style.clipPath = `inset(${v.top}px ${innerWidth - v.right}px ${innerHeight - v.bottom}px ${v.left}px)`;
    if (view.hover && !view.hover.isConnected) view.hover = null;
    const selected = app.selection.elements().filter((el) => el.isConnected);
    const words = document.activeElement?.closest('.reveal .slides section .shape [contenteditable="true"]')?.closest('.shape');
    if (!selected.length && words) selected.push(words);
    const caret = selected.length ? null : this.caretElement();
    if (caret) selected.push(caret);
    const scale = frameOf(app).scale;
    const orients = selected.map((el) => {
      const o = orientOf(el, scale);
      return { ...o, box: grow(o.box, growOf(el)) };
    });
    const boxes = orients.map((o) => o.box);
    while (this.frames.length < boxes.length) this.frames.push(div('beeson-frame selected', this.layer));
    this.frames.forEach((f, i) => {
      if (!boxes[i]) {
        f.hidden = true;
        return;
      }
      place(f, boxes[i]);
      f.style.rotate = orients[i].deg ? `${orients[i].deg}deg` : '';
      f.classList.toggle('locked', objectsOf(app, [selected[i]]).every((el) => el.hasAttribute('data-locked')));
    });
    const id = selected.length > 1 ? groupOf(selected[0]) : null;
    const grouped = !!id && selected.every((el) => groupOf(el) === id);
    this.group = this.reach = null;
    this.groupDeg = 0;
    const turn = grouped ? view.turn : null;
    if (boxes.length > 1 && grouped) {
      this.groupDeg = turn ? turn.deg : (turnersOf(app, selected)?.[0].angle ?? 0);
      this.reach = turn?.box ?? groupFrame(selected, this.groupDeg);
      this.group = selected.some((el) => captionsOf(el).length) ? grow(this.reach, INSET) : this.reach;
      place(this.union, this.group);
      this.union.classList.toggle('locked', selected.some((el) => el.hasAttribute('data-locked')));
      this.union.style.rotate = this.groupDeg ? `${this.groupDeg}deg` : '';
      for (const f of this.frames) f.hidden = true;
    } else this.union.hidden = true;
    const drawn = new Map<Element, FramedGroup & { box: Box }>();
    if (!this.group && boxes.length > 1) {
      const ids = new Map<string, Element[]>();
      for (const el of selected) {
        const g = groupOf(el);
        if (g) ids.set(g, [...(ids.get(g) ?? []), el]);
      }
      for (const els of ids.values()) {
        if (els.length < 2) continue;
        const deg = turnersOf(app, els)?.[0].angle ?? 0;
        const reach = groupFrame(els, deg);
        const o = { box: els.some((el) => captionsOf(el).length) ? grow(reach, INSET) : reach, deg, reach, els };
        for (const el of els) drawn.set(el, o);
      }
    }
    const shown = [...new Set(drawn.values())];
    while (this.unions.length < shown.length) this.unions.push(div('beeson-frame union group', this.layer));
    this.unions.forEach((u, n) => {
      if (!shown[n]) {
        u.hidden = true;
        return;
      }
      place(u, shown[n].box);
      u.classList.toggle('locked', shown[n].els.some((el) => el.hasAttribute('data-locked')));
      u.style.rotate = shown[n].deg ? `${shown[n].deg}deg` : '';
    });
    selected.forEach((el, i) => {
      if (drawn.has(el)) this.frames[i].hidden = true;
    });
    const held = view.moving ? view.held : null;
    const turning = !!held && held === this.rotor;
    if (turning) for (const f of [...this.frames, this.union, ...this.unions]) f.hidden = true;
    const scope = scopeOf();
    const inside = scope.length && selected.length ? membersOf(app, scope[scope.length - 1]).filter((el) => el.getClientRects().length) : [];
    this.entered.hidden = !inside.length;
    if (inside.length) place(this.entered, grow(groupFrame(inside, 0), 1));
    const host = app.hostOf(document.activeElement);
    const typed = host?.closest('.reveal .slides') && !host.closest('aside.notes') && !selected.some((el) => el.contains(host)) ? host : null;
    this.caret.hidden = !typed;
    if (typed) place(this.caret, grow(typed.getBoundingClientRect(), 6));

    const only = app.selection.only();
    const gripped: { el: Element; grips: 'live' | 'locked'; box: Box; deg: number; group: FramedGroup | null }[] = [];
    const lockOf = (els: Element[]) => (els.some((el) => el.hasAttribute('data-locked')) ? 'locked' as const : 'live' as const);
    const still = !turn && !(view.moving && !view.resizing);
    if (still && this.group) gripped.push({ el: selected[0], grips: lockOf(selected), box: this.group, deg: this.groupDeg, group: { els: selected, reach: this.reach as Box, deg: this.groupDeg } });
    else if (still) selected.forEach((el, i) => {
      const o = drawn.get(el);
      const grips = o ? (o.els[0] === el ? lockOf(o.els) : null) : this.gripsOf(el);
      if (grips) gripped.push({ el, grips, box: o ? o.box : boxes[i], deg: o ? o.deg : orients[i].deg, group: o ?? null });
    });
    while (this.gripSets.length < gripped.length) this.gripSet();
    this.members = this.gripSets.map((_, n) => gripped[n]?.el ?? null);
    this.groups = this.gripSets.map((_, n) => gripped[n]?.group ?? null);
    this.gripSets.forEach((set, n) => {
      const m = gripped[n];
      const level = !!m && !m.group && isTextSized(m.el);
      for (const h of HANDLES) {
        const g = set[h];
        if (m?.group) g.dataset.group = '1';
        else delete g.dataset.group;
        if (!m || (level && (h === 'n' || h === 's'))) {
          g.hidden = true;
          continue;
        }
        const b = m.box, deg = m.deg;
        const at = turned(b, deg, h.includes('w') ? b.left : h.includes('e') ? b.left + b.width : b.left + b.width / 2, h.includes('n') ? b.top : h.includes('s') ? b.top + b.height : b.top + b.height / 2);
        g.hidden = turning || m.grips === 'locked';
        const cursor = deg ? CURSORS[Math.round((((HANDLES.indexOf(h) * 45 + 225 + deg) % 360) + 360) % 360 / 45) % 4] : '';
        Object.assign(g.style, { left: `${at.x}px`, top: `${at.y}px`, ...(held ? {} : { cursor }) });
      }
    });
    const rotating = document.documentElement.classList.contains('beeson-rotating');
    const turnGroup = !!this.group && (!!turn || !!turnersOf(app, selected));
    const apart = !this.group && boxes.length > 1 && !!apartOf(app, selected);
    const turnable = (turnGroup || apart || (!!only && boxes.length === 1 && turns(only as Element) && !only.matches('.backdrop'))) && (!view.moving || rotating);
    this.rotor.hidden = !turnable || (!!held && held !== this.rotor);
    this.stem.hidden = !turnable || !!held;
    if (turnable) {
      const first = drawn.get(selected[0]) ?? orients[0];
      const b = turnGroup ? (this.group as Box) : first.box, deg = turnGroup ? this.groupDeg : first.deg;
      const cx = b.left + b.width / 2;
      const knobAt = (d: number) => turned(b, deg, cx, b.top - d);
      if (!rotating) {
        const lines = this.linesBesides(turnGroup || apart ? selected : [only as Element]);
        const free = (d: number) => {
          const k = knobAt(d);
          return !lines.some((r) => k.x + KNOB > r.left && k.x - KNOB < r.right && k.y + KNOB > r.top && k.y - KNOB < r.bottom);
        };
        let d = ROTOR;
        while (d > SHORT && !free(d)) d--;
        this.rotorAt = free(d) ? d : ROTOR;
      }
      const knob = knobAt(this.rotorAt);
      Object.assign(this.rotor.style, { left: `${knob.x}px`, top: `${knob.y}px` });
      const edge = turned(b, deg, cx, b.top);
      Object.assign(this.stem.style, { left: `${edge.x}px`, top: `${edge.y}px`, height: `${this.rotorAt - KNOB}px`, rotate: `${deg + 180}deg` });
    }

    const columns: { els: Element[]; at: Box; handled: boolean }[] = [];
    const bounds = (els: Element[]) => {
      const rs = els.map((el) => el.getBoundingClientRect());
      const left = Math.min(...rs.map((r) => r.left)), top = Math.min(...rs.map((r) => r.top));
      return { left, top, width: Math.max(...rs.map((r) => r.right)) - left, height: Math.max(...rs.map((r) => r.bottom)) - top };
    };
    if (!view.moving && !turn) {
      if (this.group) columns.push({ els: selected, at: bounds(selected), handled: false });
      else {
        for (const o of shown) columns.push({ els: o.els, at: bounds(o.els), handled: false });
        for (const el of selected) if (!drawn.has(el)) columns.push({ els: [el], at: bounds([el]), handled: this.handles(el) });
      }
    }
    while (this.locks.length < columns.length) this.padlock();
    this.lockTargets = columns.map((f) => objectsOf(app, f.els));
    this.columns = new Map();
    const buttons: Box[] = [];
    this.locks.forEach((b, n) => {
      const f = columns[n];
      b.hidden = !f;
      if (!f) return;
      const closed = this.lockTargets[n].every((el) => el.hasAttribute('data-locked'));
      if (b.dataset.closed !== String(closed)) {
        b.dataset.closed = String(closed);
        b.classList.toggle('closed', closed);
        b.title = closed ? 'Unlock' : 'Lock';
        b.setAttribute('aria-label', b.title);
        b.replaceChildren(icon(closed ? 'lock' : 'unlock', 16));
      }
      const bar = f.els.length === 1 && f.els[0].localName === 'table' ? ROW_BAR : 0;
      const at = { left: f.at.left - 6 - HANDLE_GAP - HANDLE - bar, top: f.at.top - 6 + (f.handled ? ROW : 0), width: HANDLE, height: HANDLE };
      Object.assign(b.style, { left: `${at.left}px`, top: `${at.top}px` });
      buttons.push(at);
      const column = { left: at.left, top: f.at.top - 6, width: HANDLE, height: at.top + HANDLE - (f.at.top - 6) };
      for (const el of f.els) this.columns.set(el, column);
    });
    const act = columns.length ? groupAction(app) : null;
    this.groupAct = act;
    this.grouping.hidden = !act;
    if (act) {
      const label = GROUP_ACTIONS[act];
      if (this.grouping.title !== label) {
        const filled = act === 'ungroup' || act === 'takeOut';
        this.grouping.title = label;
        this.grouping.setAttribute('aria-label', label);
        this.grouping.classList.toggle('filled', filled);
        this.grouping.innerHTML = groupIcon(filled);
      }
      const all = bounds(selected);
      const at = columns.length === 1 ? { ...buttons[0], top: buttons[0].top + ROW } : { left: all.left - 6 - HANDLE_GAP - HANDLE, top: all.top - 6 - ROW, width: HANDLE, height: HANDLE };
      Object.assign(this.grouping.style, { left: `${at.left}px`, top: `${at.top}px` });
      buttons.push(at);
      if (columns.length === 1) {
        const column = this.columns.get(columns[0].els[0]) as Box;
        for (const el of columns[0].els) this.columns.set(el, { ...column, height: column.height + ROW });
      }
    }

    if (!view.moving && app.stage) {
      const points = gripped.flatMap((m) => [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => turned(m.box, m.deg, m.box.left + u * m.box.width, m.box.top + v * m.box.height)));
      for (const b of buttons) points.push({ x: b.left, y: b.top }, { x: b.left + b.width, y: b.top + b.height });
      if (!this.rotor.hidden) points.push({ x: parseFloat(this.rotor.style.left), y: parseFloat(this.rotor.style.top) });
      const inSlide = points.map((p) => app.stage.toSlide(p));
      app.stage.setReach(inSlide.length ? { left: Math.min(...inSlide.map((p) => p.x)), top: Math.min(...inSlide.map((p) => p.y)), right: Math.max(...inSlide.map((p) => p.x)), bottom: Math.max(...inSlide.map((p) => p.y)) } : null);
    }
    const hot = this.current();
    const framed = hot && selected.includes(hot);
    this.hoverFrame.hidden = !hot || !!framed || !!view.moving;
    if (hot && !framed && !view.moving) place(this.hoverFrame, grow(frameRect(hot), 6));
    this.handle.hidden = !hot || hot.hasAttribute('data-locked') || (hot.matches(BY_ITSELF) && !hot.matches('tycho-viewer')) || (!!this.gripsOf(hot) && !isTextSized(hot));
    if (!this.handle.hidden && hot) {
      const r = hot.getBoundingClientRect();
      const bar = hot.localName === 'table' ? ROW_BAR : 0;
      Object.assign(this.handle.style, { left: `${r.left - 6 - HANDLE_GAP - HANDLE - bar}px`, top: `${r.top - 6}px` });
    }
    this.drawGuides();
    const spoke = view.spoke;
    this.spoke.hidden = !spoke;
    if (spoke) Object.assign(this.spoke.style, { left: `${spoke.x}px`, top: `${spoke.y - spoke.reach}px`, height: `${2 * spoke.reach}px`, rotate: `${spoke.deg}deg` });
    if (view.marquee) place(this.marquee, view.marquee);
    else this.marquee.hidden = true;
    const out = view.readout;
    this.readout.hidden = !out;
    if (out) {
      this.readout.textContent = out.text;
      this.readout.classList.toggle('frame', out.at === 'frame');
      Object.assign(this.readout.style, { left: `${out.x}px`, top: `${out.y}px` });
      const v = this.app.stage.viewport, r = this.readout.getBoundingClientRect();
      const pointer = out.at === 'pointer';
      let dx = pointer && r.right > v.right ? -(r.width + 28) : 0, dy = pointer && r.bottom > v.bottom ? -(r.height + 36) : 0;
      dx += Math.max(v.left - (r.left + dx), Math.min(0, v.right - (r.right + dx)));
      dy += Math.max(v.top - (r.top + dy), Math.min(0, v.bottom - (r.bottom + dy)));
      if (dx || dy) Object.assign(this.readout.style, { left: `${out.x + dx}px`, top: `${out.y + dy}px` });
    }
  }

  private linesBesides(els: Element[]): DOMRect[] {
    const slide = this.app.current();
    if (!slide) return [];
    const out: DOMRect[] = [];
    const range = document.createRange();
    for (const textEl of slide.querySelectorAll(WORDS)) {
      if (els.some((el) => el.contains(textEl) || textEl.contains(el)) || textEl.closest('aside.notes')) continue;
      range.selectNodeContents(textEl);
      for (const r of range.getClientRects()) if (r.width && r.height) out.push(r);
    }
    return out;
  }

  private drawGuides(): void {
    const f = frameOf(this.app);
    const lines = { v: view.guides.filter((g) => g.axis === 'x'), h: view.guides.filter((g) => g.axis === 'y') };
    const used = { v: 0, h: 0 };
    const take = (cls: 'v' | 'h') => {
      const pool = this.guides.filter((d) => d.classList.contains(cls));
      const d = pool[used[cls]++] ?? div(`beeson-guide ${cls}`, this.layer);
      if (!this.guides.includes(d)) this.guides.push(d);
      return d;
    };
    for (const g of lines.v) place(take('v'), { ...toScreen(f, { left: g.at, top: g.from, width: 0, height: g.to - g.from }), width: 1 });
    for (const g of lines.h) place(take('h'), { ...toScreen(f, { left: g.from, top: g.at, width: g.to - g.from, height: 0 }), height: 1 });
    for (const cls of ['v', 'h'] as const) this.guides.filter((d) => d.classList.contains(cls)).slice(used[cls]).forEach((d) => (d.hidden = true));
    let n = 0;
    for (const s of view.spacing) {
      for (const gap of s.gaps) {
        const d = this.gaps[n] ?? div('beeson-gap', this.layer);
        if (!this.gaps.includes(d)) this.gaps.push(d);
        n++;
        d.className = `beeson-gap ${s.axis === 'x' ? 'h' : 'v'}`;
        const b = s.axis === 'x' ? toScreen(f, { left: gap.from, top: gap.at, width: gap.to - gap.from, height: 0 }) : toScreen(f, { left: gap.at, top: gap.from, width: 0, height: gap.to - gap.from });
        place(d, s.axis === 'x' ? { ...b, height: 7 } : { ...b, width: 7 });
        const len = Math.round(s.axis === 'x' ? b.width : b.height);
        const key = `${s.axis}${len}`;
        if (d.dataset.mark !== key) {
          d.dataset.mark = key;
          const h = Math.round(Math.min(6, len / 3) * 10) / 10;
          const pt = (u: number, v: number) => (s.axis === 'x' ? `${u},${v}` : `${v},${u}`);
          const [w, ht] = s.axis === 'x' ? [len, 7] : [7, len];
          d.innerHTML = `<svg width="${w}" height="${ht}" aria-hidden="true"><path d="M${pt(0, 3.5)}L${pt(len, 3.5)}" stroke="currentColor"/><path d="M${pt(0, 3.5)}L${pt(h, 0.5)}L${pt(h, 6.5)}ZM${pt(len, 3.5)}L${pt(len - h, 0.5)}L${pt(len - h, 6.5)}Z" fill="currentColor"/></svg>`;
        }
      }
    }
    this.gaps.slice(n).forEach((d) => (d.hidden = true));
  }
}

const groupIcon = (filled: boolean): string => `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="2.5" width="15" height="15" rx="1"${filled ? '' : ' stroke-dasharray="2 2.6"'}/><rect x="5.5" y="5.5" width="5" height="5"${filled ? ' fill="currentColor"' : ''}/><rect x="9.5" y="9.5" width="5" height="5"${filled ? ' fill="currentColor"' : ''}/></svg>`;

let installed: Frames | null = null;

export function overlay(): Frames {
  if (!installed) throw new Error('the frames are not installed');
  return installed;
}

export function install(app: App): void {
  const frames = new Frames(app);
  installed = frames;
  document.body.append(frames.layer);
  app.selection.listen(() => {
    if (!view.moving) view.readout = null;
    frames.draw();
  });
  app.onRefresh(['content', 'selection', 'slide', 'structure', 'layout'], () => frames.draw());
  app.listen('resize', () => frames.draw());
}
