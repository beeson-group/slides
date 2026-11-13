// a modal dialog over the dialog element, which traps Tab, gives the focus back on close, and
// gives its answer as a Promise. it is shown as a sheet of Keynote, i.e. a card at the top of the
// window under the toolbar, over a scrim that dims the window in both modes of the chrome. the
// cards of a file in file/files.ts and file/drafts.ts are dialogs of this kind. a Dialog is kept
// in the page between its opens, with the attribute hidden while it is closed, since the tests
// read a card by its class and its hidden state

import type { App } from '../app.ts';
import { injectStyle, make } from './dom.ts';

export type DialogButton = { label: string; value: string; title?: string; primary?: boolean };
// a dialog is answered with the value of a button, or with null on Esc. a dialog that is not
// dismissable keeps Esc for nothing. onButton is called with the value of a pressed button, and
// the dialog is kept open for a value in stay
export type DialogOptions = { title: string; text?: string; body?: HTMLElement; buttons: DialogButton[]; className?: string; dismissable?: boolean; stay?: string[]; onButton?: (value: string) => void };

const CSS = `
dialog.beeson-edit-card { --sheet: var(--ed-panel); --sheet-line: var(--ed-menu-line); box-sizing: border-box; width: min(460px, calc(100vw - 32px)); max-height: calc(100vh - 104px); margin: 88px auto auto; padding: 20px 22px 18px; border: 1px solid var(--sheet-line); border-radius: 12px; background: var(--sheet); color: var(--ed-text); font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 24px 64px rgba(0, 0, 0, 0.32), 0 2px 8px rgba(0, 0, 0, 0.14); overflow: auto; }
dialog.beeson-edit-card[hidden] { display: none; }
dialog.beeson-edit-card::backdrop { background: rgba(0, 0, 0, 0.36); }
dialog.beeson-edit-card[open] { animation: beeson-sheet-in 160ms ease-out; }
dialog.beeson-edit-card[open]::backdrop { animation: beeson-scrim-in 160ms ease-out; }
@keyframes beeson-sheet-in { from { opacity: 0; transform: translateY(-10px); } }
@keyframes beeson-scrim-in { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { dialog.beeson-edit-card[open], dialog.beeson-edit-card[open]::backdrop { animation: none; } }
@media (prefers-color-scheme: dark) {
  dialog.beeson-edit-card { --sheet: #313133; --sheet-line: rgba(255, 255, 255, 0.16); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6), 0 0 0 0.5px rgba(0, 0, 0, 0.8); }
  dialog.beeson-edit-card::backdrop { background: rgba(0, 0, 0, 0.5); }
}
dialog.beeson-edit-card h3 { margin: 0 0 6px; font: 600 14px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; }
dialog.beeson-edit-card p { margin: 0 0 16px; color: var(--ed-muted); }
dialog.beeson-edit-card ul { margin: 0 0 16px; padding-left: 18px; max-height: 50vh; overflow-y: auto; color: var(--ed-muted); }
dialog.beeson-edit-card code { font: 12px/1.45 ui-monospace, Menlo, Consolas, monospace; color: var(--ed-text); word-break: break-all; }
dialog.beeson-edit-card .row { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 4px; }
dialog.beeson-edit-card .row button { font: inherit; min-width: 72px; padding: 4px 14px; border: 1px solid var(--ed-control-line); border-radius: 6px; background: var(--ed-control); color: var(--ed-text); cursor: default; white-space: nowrap; box-shadow: 0 0.5px 1px rgba(0, 0, 0, 0.12); }
dialog.beeson-edit-card .row button:hover { filter: brightness(0.97); }
dialog.beeson-edit-card .row button.primary { border-color: transparent; background: var(--ed-select); color: var(--ed-on-select); }
dialog.beeson-edit-card .row button[hidden] { display: none; }
dialog.beeson-edit-card button:focus-visible { outline: 3px solid var(--ed-focus); outline-offset: 1px; }
dialog.beeson-edit-card :is(input, select, textarea):focus-visible { outline: 3px solid var(--ed-focus); outline-offset: 0; }
dialog.beeson-edit-card.form label { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; }
dialog.beeson-edit-card.form input[type="number"] { width: 7ch; font: inherit; padding: 2px 6px; border: 1px solid var(--ed-control-line, var(--ed-line)); border-radius: 5px; background: var(--ed-control); color: var(--ed-text); }
[data-beside] { --arrow: 50%; }
[data-beside]::before { content: ""; position: absolute; width: 12px; height: 12px; box-sizing: border-box; background: inherit; border: 0 solid; border-color: inherit; transform: rotate(45deg); pointer-events: none; }
[data-beside="below"]::before { top: -7px; left: calc(var(--arrow) - 6px); border-width: 1px 0 0 1px; }
[data-beside="above"]::before { bottom: -7px; left: calc(var(--arrow) - 6px); border-width: 0 1px 1px 0; }
[data-beside="right"]::before { left: -7px; top: calc(var(--arrow) - 6px); border-width: 0 0 1px 1px; }
[data-beside="left"]::before { right: -7px; top: calc(var(--arrow) - 6px); border-width: 1px 1px 0 0; }
`;

const FOCUSABLE = 'button:not([disabled]):not([hidden]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// on a Mac, Return presses the default button of a sheet wherever the focus is in it, and Space the
// focused button. elsewhere Return presses the focused button, as in Windows
let returnPressesDefault = false;

// Tab and Shift+Tab go round the shown controls of root, a dialog or a popover, and never leave it
export function trapTab(root: HTMLElement, ev: KeyboardEvent): void {
  const list = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0 || el === document.activeElement);
  ev.preventDefault();
  if (!list.length) return;
  const at = list.indexOf(document.activeElement as HTMLElement);
  const next = ev.shiftKey ? (at <= 0 ? list.length - 1 : at - 1) : (at + 1) % list.length;
  list[next].focus();
}

export class Dialog {
  readonly el = make('dialog', 'beeson-edit-card') as HTMLDialogElement;
  readonly heading = make('h3');
  readonly text = make('p');
  readonly row = make('div', 'row');
  readonly buttons = new Map<string, HTMLButtonElement>();
  private done: ((value: string | null) => void) | null = null;
  private back: HTMLElement | null = null;
  private readonly options: DialogOptions;

  constructor(options: DialogOptions) {
    this.options = options;
    if (options.className) this.el.classList.add(...options.className.split(' '));
    this.el.hidden = true;
    this.el.setAttribute('aria-modal', 'true');
    this.heading.id = `beeson-edit-dialog-${Math.random().toString(36).slice(2, 8)}`;
    this.el.setAttribute('aria-labelledby', this.heading.id);
    this.heading.textContent = options.title;
    this.el.append(this.heading);
    if (options.text !== undefined) {
      this.text.textContent = options.text;
      this.el.append(this.text);
    }
    if (options.body) this.el.append(options.body);
    this.setButtons(options.buttons);
    this.el.append(this.row);
    // Esc is answered here for a trusted key, through the cancel event, and for a key sent by a
    // script, through keydown
    this.el.addEventListener('cancel', (ev) => {
      ev.preventDefault();
      if (options.dismissable !== false) this.close(null);
    });
    this.el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        if (options.dismissable !== false) this.close(null);
      } else if (ev.key === 'Tab') trapTab(this.el, ev);
      else if (ev.key === 'Enter' && !ev.isComposing && (returnPressesDefault || ev.target instanceof HTMLInputElement)) {
        // Return in a field, or anywhere in a sheet on a Mac, presses the default button
        const primary = this.row.querySelector<HTMLButtonElement>('button.primary:not(:disabled)');
        if (!primary) return;
        ev.preventDefault();
        ev.stopPropagation();
        primary.click();
      }
      // the keys that press a button are kept from the key handler of reveal.js, which cancels them
      else if ((ev.key === 'Enter' || ev.key === ' ') && ev.target instanceof HTMLButtonElement) ev.stopPropagation();
    });
    document.body.append(this.el);
  }

  setButtons(buttons: DialogButton[]): void {
    this.buttons.clear();
    this.row.replaceChildren(...buttons.map((b) => {
      const el = make('button', b.primary ? 'primary' : '', b.label);
      el.type = 'button';
      if (b.title) el.title = b.title;
      el.addEventListener('click', () => {
        if (!this.options.stay?.includes(b.value)) this.close(b.value);
        this.options.onButton?.(b.value);
      });
      this.buttons.set(b.value, el);
      return el;
    }));
  }

  get shown(): boolean {
    return this.el.open;
  }

  // the dialog is shown over the page, which is inert meanwhile, with the focus on the button of
  // the value focus or on the first button. the answer is the value of the button pressed, or null
  // for Esc or a close by the editor
  open(focus?: string, back?: HTMLElement | null): Promise<string | null> {
    if (this.el.open) return new Promise((resolve) => this.chain(resolve));
    this.back = back ?? (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null);
    this.el.hidden = false;
    try {
      this.el.showModal();
    } catch {
      // a dialog of a page that is not shown yet is opened without the scrim
      this.el.show();
    }
    const target = (focus && this.buttons.get(focus)) || this.el.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus({ preventScroll: true });
    return new Promise((resolve) => {
      this.done = resolve;
    });
  }

  private chain(resolve: (value: string | null) => void): void {
    const prev = this.done;
    this.done = (v) => {
      prev?.(v);
      resolve(v);
    };
  }

  close(value: string | null): void {
    if (!this.el.open && this.el.hidden) return;
    if (this.el.open) this.el.close();
    this.el.hidden = true;
    const done = this.done;
    this.done = null;
    const back = this.back;
    this.back = null;
    if (back?.isConnected && !back.closest('[hidden], [inert]')) back.focus({ preventScroll: true });
    done?.(value);
  }
}

// a dialog shown once and removed after its answer
export async function ask(options: DialogOptions, focus?: string): Promise<string | null> {
  const d = new Dialog(options);
  try {
    return await d.open(focus);
  } finally {
    d.el.remove();
  }
}

// the open modal dialog, into which an element that must be clicked while it is open is put,
// since the rest of the page is inert
export const host = (): HTMLElement => document.querySelector<HTMLElement>('dialog.beeson-edit-card[open]') ?? document.body;

// a side of a target at which a popover is put
export type Side = 'below' | 'above' | 'right' | 'left';

export type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Bounds = { left?: number; top?: number; width: number; height: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
const meets = (a: { left: number; top: number; right: number; bottom: number }, b: Box) =>
  a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

// the place of a popover of size w by h beside the box t, as the popovers of Keynote are put beside
// their object and flipped to the other side. a side fits when the popover is in view there
// without meeting t. on each side that fits, the popover is put next to t, and else at the far
// edge of view, centered on at, or else aligned with the start or the end of t or clear of a box
// of avoid, e.g. a line of the text of the slide, at the first of these places where it meets none
// of the boxes of avoid.
// where each place meets one, it is put where it covers the least of them, and where no side
// fits, it is put on the side with the most room and kept in view, and side is null. view is the window or the canvas, at left and top 0 unless
// given. arrow is the place of the point of its arrow at at along its edge, in px from its left or
// top. a pure function, tested under node
export function besidePlace(t: Box, w: number, h: number, view: Bounds, sides: Side[] = ['below', 'above', 'right', 'left'], gap = 10, margin = 8, avoid: Box[] = [], at: Box = t): { x: number; y: number; side: Side | null; arrow: number } {
  const x0 = view.left ?? 0;
  const y0 = view.top ?? 0;
  const x1 = x0 + view.width;
  const y1 = y0 + view.height;
  const room: Record<Side, number> = {
    below: y1 - margin - (t.bottom + gap) - h,
    above: t.top - gap - h - margin - y0,
    right: x1 - margin - (t.right + gap) - w,
    left: t.left - gap - w - margin - x0,
  };
  const across = (side: Side) => side === 'below' || side === 'above';
  // the popover on side, next to t or at the far edge of view, at the place cross along the side,
  // i.e. its left on a side below or above t and its top on a side at the right or the left
  const place = (side: Side, cross: number, far = false) => {
    let x = cross;
    let y = cross;
    if (across(side)) y = side === 'below' ? (far ? y1 - margin - h : t.bottom + gap) : far ? y0 + margin : t.top - gap - h;
    else x = side === 'right' ? (far ? x1 - margin - w : t.right + gap) : far ? x0 + margin : t.left - gap - w;
    x = clamp(x, x0 + margin, x1 - w - margin);
    y = clamp(y, y0 + margin, y1 - h - margin);
    const arrow = across(side) ? clamp(at.left + at.width / 2 - x, 18, w - 18) : clamp(at.top + at.height / 2 - y, 18, h - 18);
    return { x, y, arrow };
  };
  // the places along a side: centered on at, aligned with the start or the end of t, and clear of
  // the start or the end of each box of avoid, as long as the popover is level with t
  const crosses = (side: Side): number[] => {
    const a = across(side);
    const size = a ? w : h;
    const [lo, hi] = a ? [t.left, t.right] : [t.top, t.bottom];
    const out = [a ? at.left + at.width / 2 - w / 2 : at.top + at.height / 2 - h / 2, lo, hi - size];
    for (const b of avoid) out.push(a ? b.left - gap - size : b.top - gap - size, a ? b.right + gap : b.bottom + gap);
    return out.filter((c) => c < hi && c + size > lo);
  };
  // the area of the boxes of avoid under the popover at p
  const covers = (p: { x: number; y: number }) => avoid.reduce((sum, b) => {
    const dx = Math.min(p.x + w, b.right) - Math.max(p.x, b.left);
    const dy = Math.min(p.y + h, b.bottom) - Math.max(p.y, b.top);
    return dx > 0.5 && dy > 0.5 ? sum + dx * dy : sum;
  }, 0);
  const fits = sides.filter((s) => room[s] >= 0);
  let best: { x: number; y: number; arrow: number; side: Side; cost: number } | null = null;
  for (const side of fits) {
    for (const far of [false, true]) {
      for (const cross of crosses(side)) {
        const p = place(side, cross, far);
        const cost = covers(p);
        if (!cost) return { ...p, side };
        if (!best || cost < best.cost) best = { ...p, side, cost };
      }
    }
  }
  if (best) return { x: best.x, y: best.y, arrow: best.arrow, side: best.side };
  const side = sides.reduce((a, b) => (room[b] > room[a] ? b : a));
  return { ...place(side, crosses(side)[0] ?? (across(side) ? at.left + at.width / 2 - w / 2 : at.top + at.height / 2 - h / 2)), side: null };
}

// a box on the screen, from a DOMRect or a box of edges
const boxOf = (r: { left: number; top: number; right: number; bottom: number }): Box => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.right - r.left, height: r.bottom - r.top });

const TEXT = 'h1, h2, h3, h4, p, ul, ol, dl, table, pre, blockquote, div.math, figcaption, .caption, .foot';

// the boxes of the lines of the text and of the formulas of el, on the screen. the empty part of
// a block, e.g. the right of a short line, is left out, since a popover may be put over it
export function inkBoxes(el: Element): Box[] {
  const out: Box[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n instanceof Element ? (n.localName === 'mjx-container' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) : (n as Text).data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n instanceof Element) {
      // the ink of a formula is its svg, which is narrower than a display container
      const ink = n.firstElementChild ?? n;
      for (const r of ink.getClientRects()) if (r.width && r.height) out.push(boxOf(r));
      continue;
    }
    if (n.parentElement?.closest('mjx-container')) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.width && r.height) out.push(boxOf(r));
  }
  return out;
}

// the lines of the text of the blocks of slide, which a popover is kept off
export function slideInk(slide: Element | null): Box[] {
  if (!slide) return [];
  return [...slide.querySelectorAll(TEXT)].filter((el) => !el.parentElement?.closest(TEXT) && !el.closest('aside.notes')).flatMap(inkBoxes);
}

// the canvas, in which a popover is kept as the popovers of Keynote are kept on its canvas, off the
// inspector. a target outside the canvas, e.g. scrolled off it, keeps the popover in the window
export function canvasView(app: App, t: Box): Bounds {
  const v = app.stage?.viewport;
  const within = v && t.left >= v.left && t.right <= v.right && t.top >= v.top && t.bottom <= v.bottom;
  return within ? v : { left: 0, top: 0, width: innerWidth, height: innerHeight };
}

// how a popover is put: the sides to try in order, the gap to its target, the box of its view,
// the boxes to keep it off, and the box that its arrow points at
export type Beside = { sides?: Side[]; gap?: number; view?: () => Bounds; avoid?: () => Box[]; at?: () => Box };

// the popover pop, a fixed element, put beside the box of target in view, by default the window,
// with an arrow at the target on the side where it fits. it is given the attribute data-beside with
// its side
export function placeBeside(pop: HTMLElement, target: Box | DOMRectReadOnly, options: Beside = {}): Side | null {
  const t = boxOf(target);
  const view = options.view?.() ?? { width: innerWidth, height: innerHeight };
  const p = besidePlace(t, pop.offsetWidth, pop.offsetHeight, view, options.sides, options.gap ?? 12, 8, options.avoid?.() ?? [], options.at?.() ?? t);
  pop.style.left = `${Math.round(p.x)}px`;
  pop.style.top = `${Math.round(p.y)}px`;
  if (p.side) {
    pop.dataset.beside = p.side;
    pop.style.setProperty('--arrow', `${Math.round(p.arrow)}px`);
  } else delete pop.dataset.beside;
  return p.side;
}

// the popover of the editor put by the rule of every popover: beside the block of target, which
// is kept clear also where it is empty, since a text typed there grows into it, off the lines of
// the text of the current slide, and inside the canvas. the boxes are read once, since a target
// may be typeset again while the popover is open. the function returned stops it
export function popoverBeside(app: App, pop: HTMLElement, target: Element, options: { sides?: Side[]; at?: Box } = {}): () => void {
  const t = boxOf(target.getBoundingClientRect());
  const avoid = slideInk(app.current());
  const view = canvasView(app, t);
  return keepBeside(pop, () => t, { sides: options.sides, view: () => view, avoid: () => avoid, at: options.at ? () => options.at! : undefined });
}

// the popover kept beside target while its size changes, e.g. as a preview is typeset or a row is
// shown. the function returned stops it
export function keepBeside(pop: HTMLElement, target: () => Box | DOMRectReadOnly, options: Beside = {}): () => void {
  const place = () => {
    if (pop.isConnected) placeBeside(pop, target(), options);
  };
  place();
  const watch = new ResizeObserver(place);
  watch.observe(pop);
  return () => watch.disconnect();
}

export function install(app: App): void {
  injectStyle('dialog', CSS);
  returnPressesDefault = app.platform === 'mac';
}
