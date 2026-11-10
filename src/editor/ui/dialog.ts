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
[data-beside] { --arrow: 50%; }
[data-beside]::before { content: ""; position: absolute; width: 12px; height: 12px; box-sizing: border-box; background: inherit; border: 0 solid; border-color: inherit; transform: rotate(45deg); pointer-events: none; }
[data-beside="below"]::before { top: -7px; left: calc(var(--arrow) - 6px); border-width: 1px 0 0 1px; }
[data-beside="above"]::before { bottom: -7px; left: calc(var(--arrow) - 6px); border-width: 0 1px 1px 0; }
[data-beside="right"]::before { left: -7px; top: calc(var(--arrow) - 6px); border-width: 0 0 1px 1px; }
[data-beside="left"]::before { right: -7px; top: calc(var(--arrow) - 6px); border-width: 1px 1px 0 0; }
`;

const FOCUSABLE = 'button:not([disabled]):not([hidden]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
      } else if (ev.key === 'Tab') this.trap(ev);
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

  // Tab and Shift+Tab go round the controls of the dialog
  private trap(ev: KeyboardEvent): void {
    const list = [...this.el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!list.length) return;
    ev.preventDefault();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const next = ev.shiftKey ? (at <= 0 ? list.length - 1 : at - 1) : (at + 1) % list.length;
    list[next].focus();
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

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Bounds = { left?: number; top?: number; width: number; height: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

// the place of a popover of size w by h beside the box t, on the first of sides where it fits in
// view without meeting t, as the popovers of Keynote are put beside their object and flipped to the
// other side. view is the window, or the canvas, at left and top 0 unless given. where no side
// fits, it is put on the side with the most room and kept in view, and side is null. arrow is the
// place of the point of its arrow along its edge, in px from its left or top. a pure function,
// tested under node
export function besidePlace(t: Box, w: number, h: number, view: Bounds, sides: Side[] = ['below', 'above', 'right', 'left'], gap = 10, margin = 8): { x: number; y: number; side: Side | null; arrow: number } {
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
  const fit = sides.find((s) => room[s] >= 0);
  const side = fit ?? sides.reduce((a, b) => (room[b] > room[a] ? b : a));
  const across = side === 'below' || side === 'above';
  let x = across ? t.left + t.width / 2 - w / 2 : side === 'right' ? t.right + gap : t.left - gap - w;
  let y = across ? (side === 'below' ? t.bottom + gap : t.top - gap - h) : t.top + t.height / 2 - h / 2;
  x = clamp(x, x0 + margin, x1 - w - margin);
  y = clamp(y, y0 + margin, y1 - h - margin);
  const arrow = across ? clamp(t.left + t.width / 2 - x, 18, w - 18) : clamp(t.top + t.height / 2 - y, 18, h - 18);
  return { x, y, side: fit ?? null, arrow };
}

// the popover pop, a fixed element, put beside the box of target in view, by default the window,
// with an arrow at the target on the side where it fits. it is given the attribute data-beside with
// its side
export function placeBeside(pop: HTMLElement, target: DOMRectReadOnly, sides?: Side[], gap = 12, view?: () => Bounds): Side | null {
  const p = besidePlace(target, pop.offsetWidth, pop.offsetHeight, view?.() ?? { width: innerWidth, height: innerHeight }, sides, gap);
  pop.style.left = `${Math.round(p.x)}px`;
  pop.style.top = `${Math.round(p.y)}px`;
  if (p.side) {
    pop.dataset.beside = p.side;
    pop.style.setProperty('--arrow', `${Math.round(p.arrow)}px`);
  } else delete pop.dataset.beside;
  return p.side;
}

// the popover kept beside target while its size changes, e.g. as a preview is typeset or a row is
// shown. the function returned stops it
export function keepBeside(pop: HTMLElement, target: () => DOMRectReadOnly, sides?: Side[], gap?: number, view?: () => Bounds): () => void {
  const place = () => {
    if (pop.isConnected) placeBeside(pop, target(), sides, gap, view);
  };
  place();
  const watch = new ResizeObserver(place);
  watch.observe(pop);
  return () => watch.disconnect();
}

export function install(_app: App): void {
  injectStyle('dialog', CSS);
}
