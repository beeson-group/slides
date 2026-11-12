// the commands of image and video files: Image… and Video… of the Insert menu and of the Insert
// group of the toolbar, Choose File… of the Insert menu as in Keynote, Replace Image… and Capture
// Poster of Format > Image and of the Image and Video panes, and Save as Picture… of the menu of a
// picture in PowerPoint. each takes its files from the file chooser of the browser, or from
// arg.files, e.g. in a test. the install also sets up the drop of files onto the slide, the
// writing of new files at a save, and the files of a draft

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { display } from '../keymap.ts';
import { ACCEPT, capturePoster, chooseFiles, insertFiles, replaceFile } from '../media/actions.ts';
import { install as installDrop } from '../media/drop.ts';
import { install as installSave } from '../media/save.ts';
import { media } from '../media/store.ts';
import { hiddenOf, imageOf, modeOf, videoOf } from './figure.ts';
import { install as installBackdrop, openGallery } from './backdrop.ts';

type Arg = { el?: Element; files?: File[] } | undefined;

const filesOf = (arg: unknown): File[] | null => (arg as Arg)?.files ?? null;

// the image or the video given as arg.el, else the one of the selection
function mediaOf(app: App, arg: unknown): HTMLImageElement | HTMLVideoElement | null {
  const el = (arg as Arg)?.el;
  if (el?.isConnected && (el instanceof HTMLImageElement || el instanceof HTMLVideoElement)) return el;
  return imageOf(app) ?? videoOf(app) ?? hiddenOf(app);
}

// the file of an image or a video as the deck names it, with the name of its last segment: a new
// file from the store, a data or blob URL, or a file of the folder of the deck. a file on another
// server is not offered, since the editor does not fetch anything from the network
type Picture = { name: string; href: string; tab: boolean };

function pictureOf(el: HTMLImageElement | HTMLVideoElement): Picture | null {
  const value = el.getAttribute('src') ?? el.querySelector('source[src]')?.getAttribute('src') ?? null;
  const path = media.pathOf(value);
  if (!value || !path) return null;
  const kept = media.get(path);
  const fallback = el.localName === 'video' ? 'video' : 'picture';
  if (kept) return { name: path.slice(path.lastIndexOf('/') + 1), href: kept.url, tab: false };
  let url: URL;
  try {
    url = new URL(value, document.baseURI);
  } catch {
    return null;
  }
  if (url.protocol === 'data:' || url.protocol === 'blob:') {
    const ext = /^data:\w+\/([\w+]+)/.exec(value)?.[1]?.replace('svg+xml', 'svg').replace('jpeg', 'jpg');
    return { name: `${fallback}${ext ? `.${ext}` : ''}`, href: url.href, tab: false };
  }
  const own = url.protocol === 'file:' || (url.origin === location.origin && /^https?:$/.test(url.protocol));
  if (!own) return null;
  let name = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
  try {
    name = decodeURIComponent(name);
  } catch {
    // the name is kept as it is written
  }
  // a browser does not download a file of a page opened from a file, and it would open the file in
  // place of the editor, hence the file is opened in a new tab
  return { name: name || fallback, href: url.href, tab: url.protocol === 'file:' };
}

// the file is downloaded as it is, under its own name, or shown in a new tab where it is saved
function savePicture(app: App, picture: Picture): void {
  if (picture.tab) {
    window.open(picture.href, '_blank', 'noopener');
    app.note = { text: `${picture.name} is open in a new tab. Save it there with ${display('Mod+S', app.platform)}`, warn: false };
  } else {
    const a = document.createElement('a');
    a.href = picture.href;
    a.download = picture.name;
    a.hidden = true;
    document.body.append(a);
    a.click();
    a.remove();
    app.note = { text: `${picture.name} is in your downloads`, warn: false };
  }
  app.report();
}

export function install(app: App): void {
  installSave(app);
  installDrop(app);
  installBackdrop(app);
  // the files of a draft are kept with it, and else IndexedDB is cleared of them
  void media.load(app.drafts.hasDraft()).then((n) => n && media.resolve(app.slides()));
  // a src or a poster written on the page from the file, e.g. by an undo of a removal or by a
  // paste, is shown from the store when it names a new file
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes') media.resolve(r.target as Element);
      else for (const n of r.addedNodes) if (n instanceof Element) media.resolve(n);
    }
  }).observe(app.slides(), { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'poster'] });

  const c = app.commands;
  const ready = (a: App) => !!a.pairing?.root && !!a.current() && a.region() !== 'dialog';
  const insert = (accept: string, multiple: boolean) => async (a: App, arg: unknown) => {
    const files = filesOf(arg) ?? (await chooseFiles(accept, multiple));
    if (files.length) await insertFiles(a, files);
  };
  const list: Command[] = [
    {
      id: 'insert.image',
      label: 'Image…',
      menu: { bar: 'Insert', group: 'element', order: 24 },
      toolbar: { group: 'insert', order: 24, icon: 'media', label: 'Media', split: 'Media' },
      enabled: ready,
      run: insert(ACCEPT.image, true),
    },
    {
      id: 'insert.video',
      label: 'Video…',
      menu: { bar: 'Insert', group: 'element', order: 25 },
      toolbar: { group: 'insert', order: 24.1, icon: 'video', split: 'Media' },
      enabled: ready,
      run: insert(ACCEPT.video, false),
    },
    {
      // a backdrop from the gallery of commands/backdrop.ts, at the ground of the slide, or in place
      // of the drawing of the backdrop of the slide
      id: 'insert.backdrop',
      label: 'Backdrop…',
      menu: { bar: 'Insert', group: 'element', order: 26.5 },
      toolbar: { group: 'insert', order: 24.25, icon: 'orbit', split: 'Media' },
      enabled: ready,
      run: (a, arg) => openGallery(a, arg instanceof Element ? arg : null),
    },
    {
      // Ctrl+Shift+V is Paste and Match Style outside the Mac, hence the key is only ⇧⌘V there
      id: 'insert.file',
      label: 'Choose File…',
      keys: { mac: ['Mod+Shift+V'] },
      menu: { bar: 'Insert', group: 'file', order: 29 },
      toolbar: { group: 'insert', order: 24.3, icon: 'open', split: 'Media' },
      enabled: ready,
      run: insert(ACCEPT.any, true),
    },
    {
      id: 'media.replace',
      // on a picture that the mode hides, the file is chosen for the other mode
      label: (a) => {
        const h = hiddenOf(a);
        const kind = (h ?? videoOf(a))?.localName === 'video' ? 'Video' : 'Image';
        return h ? `Choose ${kind} for ${modeOf(h) === 'dark' ? 'Light' : 'Dark'} Mode…` : `Replace ${kind}…`;
      },
      menu: { bar: 'Format', group: 'file', order: 5, submenu: 'Image' },
      context: ['element'],
      enabled: (a) => !!mediaOf(a, undefined),
      run: async (a, arg) => {
        const el = mediaOf(a, arg);
        if (!el) return;
        const [file] = filesOf(arg) ?? (await chooseFiles(ACCEPT[el.localName === 'video' ? 'video' : 'image']));
        if (file) await replaceFile(a, el, file);
      },
    },
    {
      // the id is outside media., which a lock turns off, since a save does not change the element
      id: 'picture.save',
      label: (a) => (videoOf(a) ? 'Save Media as…' : 'Save as Picture…'),
      context: ['element'],
      enabled: (a) => {
        const el = mediaOf(a, undefined);
        return !!el && !!pictureOf(el);
      },
      run: (a, arg) => {
        const el = mediaOf(a, arg);
        const picture = el && pictureOf(el);
        if (picture) savePicture(a, picture);
      },
    },
    {
      id: 'media.poster',
      label: 'Capture Poster',
      menu: { bar: 'Format', group: 'file', order: 6, submenu: 'Image' },
      enabled: (a) => !!videoOf(a),
      run: async (a, arg) => {
        const el = mediaOf(a, arg);
        if (el instanceof HTMLVideoElement) await capturePoster(a, el);
      },
    },
  ];
  for (const command of list) c.define(command);
}
