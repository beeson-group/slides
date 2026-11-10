// a modal dialog over the dialog element, which traps Tab, gives the focus back on close, and
// gives its answer as a Promise. the cards of a file in file/files.ts and file/drafts.ts are
// dialogs of this kind. a Dialog is kept in the page between its opens, with the attribute hidden
// while it is closed, since the tests read a card by its class and its hidden state

import type { App } from '../app.ts';
import { injectStyle, make } from './dom.ts';

export type DialogButton = { label: string; value: string; title?: string; primary?: boolean };
// a dialog is answered with the value of a button, or with null on Esc. a dialog that is not
// dismissable keeps Esc for nothing. onButton is called with the value of a pressed button, and
// the dialog is kept open for a value in stay
export type DialogOptions = { title: string; text?: string; body?: HTMLElement; buttons: DialogButton[]; className?: string; dismissable?: boolean; stay?: string[]; onButton?: (value: string) => void };

const CSS = `
dialog.beeson-edit-card { box-sizing: border-box; width: min(460px, calc(100vw - 32px)); max-height: calc(100vh - 64px); margin: auto; padding: 20px 22px 18px; border: 1px solid var(--ed-menu-line); border-radius: 12px; background: var(--ed-panel); color: var(--ed-text); font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.12); overflow: auto; }
dialog.beeson-edit-card[hidden] { display: none; }
dialog.beeson-edit-card::backdrop { background: rgba(0, 0, 0, 0.22); }
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

export function install(_app: App): void {
  injectStyle('dialog', CSS);
}
