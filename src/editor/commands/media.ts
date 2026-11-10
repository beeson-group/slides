// the commands of image and video files: Image… and Video… of the Insert menu and of the Insert
// group of the toolbar, Choose File… of the Insert menu as in Keynote, and Replace Image… and
// Capture Poster of Format > Image and of the Image and Video panes. each takes its files from the
// file chooser of the browser, or from arg.files, e.g. in a test. the install also sets up the drop
// of files onto the slide, the writing of new files at a save, and the files of a draft

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { ACCEPT, capturePoster, chooseFiles, insertFiles, replaceFile } from '../media/actions.ts';
import { install as installDrop } from '../media/drop.ts';
import { install as installSave } from '../media/save.ts';
import { media } from '../media/store.ts';
import { imageOf, videoOf } from './figure.ts';

type Arg = { el?: Element; files?: File[] } | undefined;

const filesOf = (arg: unknown): File[] | null => (arg as Arg)?.files ?? null;

// the image or the video given as arg.el, else the one of the selection
function mediaOf(app: App, arg: unknown): HTMLImageElement | HTMLVideoElement | null {
  const el = (arg as Arg)?.el;
  if (el?.isConnected && (el instanceof HTMLImageElement || el instanceof HTMLVideoElement)) return el;
  return imageOf(app) ?? videoOf(app);
}

export function install(app: App): void {
  installSave(app);
  installDrop(app);
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
      label: (a) => (videoOf(a) ? 'Replace Video…' : 'Replace Image…'),
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
