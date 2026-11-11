// the commands of a figure, in Format > Image and in the Image, Video, and QR panes of the
// inspector: the alt text of an image, the classes paper and invert, the mode in which an image or
// a video is shown, the switches of a video, and the text of a QR code. each is a change of the
// start tag through app.doc, as one entry of the history. the QR code is drawn again after every
// change of its data-qr, also at an undo

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { CONTAINER } from '../canvas/hit.ts';
import type { TagEdit } from '../tags.ts';

// the longest text of a QR code, in bytes of UTF-8, as src/qr.ts encodes it at level M
export const QR_MAX = 2331;

const shown = (el: Element) => el.getBoundingClientRect().width > 0;

// the one element of tag that the selection is or holds in a figure, a zone, or a plate. of a pair
// for the two modes, it is the one shown in the mode of the slide
function mediaOf(app: App, tag: string): HTMLElement | null {
  const el = app.selection.only();
  if (!el) return null;
  const open = (m: Element) => !!app.pairing?.elements.get(m)?.open;
  if (el.matches(tag)) return open(el) ? (el as HTMLElement) : null;
  if (!el.matches(CONTAINER)) return null;
  const found = [...el.querySelectorAll(tag)].filter((m) => shown(m) && open(m));
  return found.length === 1 ? (found[0] as HTMLElement) : null;
}

export const imageOf = (app: App) => mediaOf(app, 'img') as HTMLImageElement | null;
export const videoOf = (app: App) => mediaOf(app, 'video') as HTMLVideoElement | null;
export const qrOf = (app: App) => mediaOf(app, '.qr');

// the target given by a field of the inspector as arg.el, else the one of the selection
const given = (arg: unknown): Element | null => {
  const el = (arg as { el?: Element } | undefined)?.el;
  return el?.isConnected ? el : null;
};

const valueOf = (arg: unknown): string | null => {
  if (typeof arg === 'string') return arg;
  const v = (arg as { value?: unknown } | undefined)?.value;
  return typeof v === 'string' ? v : null;
};

export type Mode = 'both' | 'dark' | 'light';
export const modeOf = (el: Element): Mode => (el.classList.contains('for-dark') ? 'dark' : el.classList.contains('for-light') ? 'light' : 'both');

export const bytesOf = (text: string) => new TextEncoder().encode(text).length;

// a request of the Image pane to show its alt text field, made by Edit Alt Text… without a text
let altRequest: (() => void) | null = null;
export function onAltRequest(fn: () => void): void {
  altRequest = fn;
}

function setTag(app: App, el: Element, edit: TagEdit, label: string): void {
  app.doc.setTag(el, edit, label);
}

function switchOf(id: string, label: string, target: (app: App) => Element | null, isOn: (el: Element) => boolean, edit: (on: boolean) => TagEdit, menu?: Command['menu']): Command {
  return {
    id,
    label,
    menu,
    undoable: true,
    enabled: (app) => !!target(app),
    checked: (app) => {
      const el = target(app);
      return el ? isOn(el) : false;
    },
    run: (app, arg) => {
      const el = given(arg) ?? target(app);
      if (el) setTag(app, el, edit(!isOn(el)), label.toLowerCase());
    },
  };
}

const imageMenu = (order: number): Command['menu'] => ({ bar: 'Format', group: 'image', order, submenu: 'Image' });
const has = (name: string) => (el: Element) => el.hasAttribute(name);
const flag = (name: string) => (on: boolean): TagEdit => ({ attrs: { [name]: on ? '' : null } });
const visual = (app: App) => imageOf(app) ?? videoOf(app);

export function commands(): Command[] {
  const list: Command[] = [
    {
      // with a text as arg, e.g. from the field of the Image pane, the alt is written. without one,
      // the Image pane is shown with the field focused, as Alt Text in the context menu of PowerPoint
      id: 'figure.alt',
      label: 'Edit Alt Text…',
      menu: imageMenu(10),
      context: ['element'],
      undoable: true,
      enabled: (app) => !!imageOf(app),
      run: (app, arg) => {
        const el = given(arg) ?? imageOf(app);
        const text = valueOf(arg);
        if (!el) return;
        if (text === null) return void altRequest?.();
        // an empty text takes the alt off, and Decorative writes the empty alt
        const alt = text === '' ? null : text;
        if (el.getAttribute('alt') !== alt) setTag(app, el, { attrs: { alt } }, 'alt text');
      },
    },
    // a decorative image has an empty alt, which a screen reader skips
    switchOf('figure.decorative', 'Decorative', imageOf, (el) => el.getAttribute('alt') === '', (on) => ({ attrs: { alt: on ? '' : null } }), imageMenu(11)),
    switchOf('figure.paper', 'Paper', imageOf, (el) => el.classList.contains('paper'), (on) => ({ classes: { paper: on } }), imageMenu(20)),
    switchOf('figure.invert', 'Invert in Dark Mode', imageOf, (el) => el.classList.contains('invert'), (on) => ({ classes: { invert: on } }), imageMenu(21)),
    switchOf('figure.autoplay', 'Play Automatically', videoOf, has('data-autoplay'), flag('data-autoplay')),
    switchOf('figure.loop', 'Loop', videoOf, has('loop'), flag('loop')),
    switchOf('figure.muted', 'Muted', videoOf, has('muted'), flag('muted')),
    {
      id: 'figure.qr',
      label: 'QR Code Text',
      undoable: true,
      enabled: (app) => !!qrOf(app),
      run: (app, arg) => {
        const el = given(arg) ?? qrOf(app);
        const text = valueOf(arg);
        if (!el || text === null) return;
        if (!text.trim()) throw new Error('the text of a QR code cannot be empty');
        if (bytesOf(text) > QR_MAX) throw new Error(`the text of a QR code is longer than ${QR_MAX} bytes`);
        if (el.getAttribute('data-qr') !== text) setTag(app, el, { attrs: { 'data-qr': text } }, 'qr code');
      },
    },
  ];
  for (const [i, mode] of (['both', 'dark', 'light'] as const).entries()) {
    list.push({
      id: `figure.mode.${mode}`,
      label: mode === 'both' ? 'Both Modes' : mode === 'dark' ? 'Dark Mode Only' : 'Light Mode Only',
      menu: { bar: 'Format', group: 'mode', order: 30 + i, submenu: 'Image' },
      undoable: true,
      undo: 'Figure Mode',
      enabled: (app) => !!visual(app),
      checked: (app) => {
        const el = visual(app);
        return el ? modeOf(el) === mode : false;
      },
      run: (app, arg) => {
        const el = given(arg) ?? visual(app);
        if (el && modeOf(el) !== mode) setTag(app, el, { classes: { 'for-dark': mode === 'dark', 'for-light': mode === 'light' } }, 'mode');
      },
    });
  }
  return list;
}

type Page = { Beeson?: { mount?(root: Element): void } };

// the svg of a QR code is drawn by the theme once, hence it is drawn again from its new text. the
// theme draws the codes under the root it is given, which is thus the parent of the code
function redrawQr(el: Element): void {
  for (const old of el.querySelectorAll(':scope > svg, :scope > .qr-error')) old.remove();
  if (el.parentElement) (window as unknown as Page).Beeson?.mount?.(el.parentElement);
}

export function install(app: App): void {
  for (const c of commands()) app.commands.define(c);
  new MutationObserver((records) => {
    for (const r of records) if (r.target instanceof Element && r.target.matches('.qr')) redrawQr(r.target);
  }).observe(app.slides(), { subtree: true, attributes: true, attributeFilter: ['data-qr'] });
}
