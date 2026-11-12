// the commands of a figure, in Format > Image and in the Image, Video, and QR panes of the
// inspector: the alt text of an image, the classes paper and invert, the mode in which an image or
// a video is shown, the switches of a video, and the text of a QR code. each is a change of the
// start tag through app.doc, as one entry of the history. the QR code is drawn again after every
// change of its data-qr, also at an undo

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { CONTAINER, pictureSize, twinOf } from '../canvas/hit.ts';
import { placeOf, record, withCorners, writePlace } from '../canvas/drag.ts';
import type { TagEdit } from '../tags.ts';
import { placeCaret } from '../text/typing.ts';
import { startOnClick } from './steps.ts';

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

// the one image or video of the figure of the selection that the mode of the slide hides and that
// does not have a twin, e.g. after Dark on an image in light mode. its pane is kept, so that Shown
// in and the file for the other mode stay in reach
export function hiddenOf(app: App): HTMLImageElement | HTMLVideoElement | null {
  const el = app.selection.only();
  if (!el?.matches(CONTAINER)) return null;
  const all = [...el.querySelectorAll('img, video')].filter((m) => !!app.pairing?.elements.get(m)?.open);
  const m = all.length === 1 ? (all[0] as HTMLImageElement | HTMLVideoElement) : null;
  return m && !shown(m) && modeOf(m) !== 'both' && !twinOf(app, m) ? m : null;
}

// the image and the video of the pane of the selection, also when the mode of the slide hides it
const hiddenTag = (app: App, tag: string) => {
  const h = hiddenOf(app);
  return h?.localName === tag ? h : null;
};
export const paneImageOf = (app: App) => imageOf(app) ?? (hiddenTag(app, 'img') as HTMLImageElement | null);
export const paneVideoOf = (app: App) => videoOf(app) ?? (hiddenTag(app, 'video') as HTMLVideoElement | null);
export const videoOf = (app: App) => mediaOf(app, 'video') as HTMLVideoElement | null;
export const viewerOf = (app: App) => mediaOf(app, 'tycho-viewer');
// the video or the tycho viewer that Start on a Click starts at its step
const playedOf = (app: App) => videoOf(app) ?? viewerOf(app);
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

// the empty caption of commands/insert.ts, which the first input writes into the file
let captionBox: { begin(host: Element): void; drop(): void } | null = null;
export function onCaptionBox(box: { begin(host: Element): void; drop(): void }): void {
  captionBox = box;
}

// the caption last taken off each figure or zone in the session, put back by Caption on
const takenCaption = new WeakMap<Element, string>();

function setTag(app: App, el: Element, edit: TagEdit, label: string): void {
  app.doc.setTag(el, edit, label);
}

// the width of the picture that el draws smaller than its box under object-fit contain, written on
// el and its twin with the corner of the picture kept in its place, so that the box of el is the
// picture. a picture with a width, a crop, or a fit of its own is drawn as its box already
function fitToPicture(app: App, el: Element): void {
  const style = app.doc.tagState(el).style;
  if (placeOf(el).width !== null || style['clip-path'] || style.scale || getComputedStyle(el).objectFit !== 'contain') return;
  const p = pictureSize(el);
  const box = el as HTMLElement;
  if (p.w > box.offsetWidth - 0.5 && p.h > box.offsetHeight - 0.5) return;
  record(app, 'oval', withCorners(app, [el], () => {
    const from = placeOf(el);
    writePlace(app, el, { ...from, width: p.w });
    return [{ el, from, to: placeOf(el) }];
  }));
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

// the image that Invert in Dark Mode acts on: an image shown in dark mode, or the dark twin of a
// light image, since the theme inverts an image only in dark mode
function invertible(app: App, el: Element | null): Element | null {
  if (!el || !el.classList.contains('for-light') || el.classList.contains('invert')) return el;
  return twinOf(app, el);
}

const imageMenu = (order: number): Command['menu'] => ({ bar: 'Format', group: 'image', order, submenu: 'Image' });
const has = (name: string) => (el: Element) => el.hasAttribute(name);
// a video of the fragment style play, which the theme starts at its step
const onClick = (el: Element) => !!el.closest('.fragment.play');
const flag = (name: string) => (on: boolean): TagEdit => ({ attrs: { [name]: on ? '' : null } });
const visual = (app: App) => imageOf(app) ?? videoOf(app) ?? hiddenOf(app);

const modeClasses = (m: Mode) => ({ 'for-dark': m === 'dark', 'for-light': m === 'light' });
const otherMode = (m: Mode): Mode => (m === 'dark' ? 'light' : 'dark');

// the unit text of the twin that Both took off an image or a video, with the mode of the image
// then, so that Dark or Light on the image puts the pair back
const takenTwin = new WeakMap<Element, { text: string; mode: Mode; after: boolean }>();

// the mode of el set so that each mode of the slide shows one picture. of a pair, Both keeps el
// alone, and Dark or Light swaps the modes of el and its twin. Dark or Light on an image whose
// twin Both took off puts the twin back with the other mode
async function setMode(app: App, el: Element, mode: Mode): Promise<void> {
  const twin = twinOf(app, el);
  if (twin && mode === 'both') {
    takenTwin.set(el, { text: app.doc.elementText(twin), mode: modeOf(el), after: !!(el.compareDocumentPosition(twin) & Node.DOCUMENT_POSITION_FOLLOWING) });
    await app.doc.remove(twin, 'mode');
  }
  setTag(app, el, { classes: modeClasses(mode) }, 'mode');
  if (twin && mode !== 'both') {
    setTag(app, twin, { classes: modeClasses(otherMode(mode)) }, 'mode');
    // a picture selected by itself gives way to its twin, which is the one shown now
    if (app.selection.only() === el && !shown(el)) app.selection.set('elements', [twin]);
  }
  const back = takenTwin.get(el);
  if (twin || mode === 'both' || !back || !el.parentElement) return;
  const [node] = await app.doc.insert(back.text, el.parentElement, back.after ? el.nextElementSibling : el, 'mode');
  if (mode !== back.mode) setTag(app, node, { classes: modeClasses(otherMode(mode)) }, 'mode');
}

// the figure or the zone of the picture of the selection, or of the caption that the caret is in,
// which takes a caption under the picture
function captionHost(app: App): Element | null {
  const typed = app.selection.kind === 'text' ? app.selection.items[0]?.closest('figcaption, .caption') : null;
  const host = typed ? typed.parentElement : visual(app)?.parentElement;
  return host?.matches('figure, .zone') && !host.matches('.plate, .plot') ? host : null;
}
const captionOf = (host: Element) => host.querySelector(':scope > figcaption, :scope > .caption');

export function commands(): Command[] {
  const list: Command[] = [
    {
      // a caption under the picture, as Caption in the Style tab of Keynote: a figcaption in a
      // figure and a caption paragraph in a zone, with the caret in it. the caption taken off is
      // put back with its text, and a new one is written into the file at its first input
      id: 'figure.caption',
      label: 'Caption',
      menu: imageMenu(12),
      enabled: (app) => !!captionHost(app),
      checked: (app) => {
        const host = captionHost(app);
        return host ? !!captionOf(host) : false;
      },
      run: async (app) => {
        const host = captionHost(app);
        if (!host) return;
        const old = captionOf(host);
        if (old?.hasAttribute('data-generated')) return captionBox?.drop();
        const back = takenCaption.get(host);
        if (!old && !back) return captionBox?.begin(host);
        await app.history.transact('Caption', async () => {
          if (old) {
            takenCaption.set(host, app.doc.elementText(old));
            return app.doc.remove(old, 'caption');
          }
          const [node] = await app.doc.insert(back!, host, null, 'caption');
          if (node) setTimeout(() => node.matches('[contenteditable="true"]') && placeCaret(node));
        });
      },
    },
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
    // a decorative image has an empty alt, which a screen reader skips, written on both images of
    // a pair
    {
      ...switchOf('figure.decorative', 'Decorative', imageOf, (el) => el.getAttribute('alt') === '', () => ({}), imageMenu(11)),
      run: (app, arg) => {
        const el = given(arg) ?? imageOf(app);
        if (!el) return;
        const edit = { attrs: { alt: el.getAttribute('alt') === '' ? null : '' } };
        for (const m of [el, twinOf(app, el)]) if (m) setTag(app, m, edit, 'decorative');
      },
    },
    switchOf('figure.paper', 'Paper', imageOf, (el) => el.classList.contains('paper'), (on) => ({ classes: { paper: on } }), imageMenu(20)),
    // an oval picture is clipped to its ellipse, and the inset of its crop is rounded with it, on both
    // images of a pair
    {
      ...switchOf('figure.oval', 'Oval', imageOf, (el) => el.classList.contains('oval'), () => ({}), imageMenu(22)),
      run: (app, arg) => {
        const el = given(arg) ?? imageOf(app);
        if (!el) return;
        const on = !el.classList.contains('oval');
        if (on) fitToPicture(app, el);
        for (const m of [el, twinOf(app, el)]) {
          if (!m) continue;
          const edit: TagEdit = { classes: { oval: on } };
          const inset = /^inset\((-?[\d.]+%)( round 50%)?\)$/.exec(app.doc.tagState(m).style['clip-path'] ?? '');
          if (inset) edit.style = { 'clip-path': `inset(${inset[1]}${on ? ' round 50%' : ''})` };
          setTag(app, m, edit, 'oval');
        }
      },
    },
    switchOf('figure.invert', 'Invert in Dark Mode', (app) => invertible(app, imageOf(app)), (el) => el.classList.contains('invert'), (on) => ({ classes: { invert: on } }), imageMenu(21)),
    // a video started on a click is not played with its slide, hence Play Automatically is dimmed
    // and off while Start on a Click is on
    {
      ...switchOf('figure.autoplay', 'Play Automatically', videoOf, (el) => has('data-autoplay')(el) && !onClick(el), flag('data-autoplay')),
      enabled: (app) => {
        const el = videoOf(app);
        return !!el && !onClick(el);
      },
      why: (app) => {
        const el = videoOf(app);
        return el && onClick(el) ? 'The video is started on a click, at its step' : null;
      },
    },
    // a video or a tycho viewer started at its step, as Start Movie on Click of Keynote and the
    // animation Play of PowerPoint, i.e. a step with the effect Play of the Steps pane
    {
      id: 'figure.startOnClick',
      label: 'Start on a Click',
      undoable: true,
      enabled: (app) => !!playedOf(app),
      checked: (app) => {
        const el = playedOf(app);
        return el ? onClick(el) : false;
      },
      run: (app, arg) => {
        const el = given(arg) ?? playedOf(app);
        if (el) startOnClick(app, el, !onClick(el));
      },
    },
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
        if (el && modeOf(el) !== mode) return app.history.selecting('mode', () => setMode(app, el, mode));
      },
    });
  }
  return list;
}

type Page = { Beeson?: { mount?(root: Element): void } };

// the svg of a QR code is drawn by the theme once, hence it is drawn again from its new text. the
// theme draws the codes under the root it is given, which is thus the parent of the code
function redrawQr(el: Element): void {
  for (const old of el.querySelectorAll(':scope > svg, :scope > .qr-error, :scope > .qr-logo')) old.remove();
  if (el.parentElement) (window as unknown as Page).Beeson?.mount?.(el.parentElement);
}

export function install(app: App): void {
  for (const c of commands()) app.commands.define(c);
  new MutationObserver((records) => {
    for (const r of records) if (r.target instanceof Element && r.target.matches('.qr')) redrawQr(r.target);
  }).observe(app.slides(), { subtree: true, attributes: true, attributeFilter: ['data-qr'] });
}
