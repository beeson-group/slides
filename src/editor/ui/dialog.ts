// a modal dialog over the dialog element, which traps Tab, gives the focus back on close, and
// gives its answer as a Promise. the cards of a file are ported to it

import type { App } from '../app.ts';

export type DialogButton = { label: string; value: string; title?: string };
// a dialog is answered with the value of a button, or with null on Esc
export type DialogOptions = { title: string; text?: string; body?: HTMLElement; buttons: DialogButton[]; className?: string };

export function install(_app: App): void {
  // nothing yet
}
