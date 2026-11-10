// the new media files written at a save, before the text of the deck that names them. in Chrome
// and Edge they are written into media/ in the folder of the deck, which a page reaches only once
// it is chosen with showDirectoryPicker, and elsewhere each file is downloaded with the copy of the
// deck. a picker is shown only during a press of a key or a button, hence a save without one, e.g.
// an autosave or a save right after the save picker, asks for the folder with a dialog first

import type { App } from '../app.ts';
import { plural, setCompanions } from '../file/files.ts';
import { Dialog, host } from '../ui/dialog.ts';
import { make } from '../ui/dom.ts';
import { FOLDER, media, type MediaFile } from './store.ts';

type Permission = 'granted' | 'denied' | 'prompt';
type Folder = FileSystemDirectoryHandle & {
  queryPermission?(o: { mode: 'readwrite' }): Promise<Permission>;
  requestPermission?(o: { mode: 'readwrite' }): Promise<Permission>;
};
type DirectoryPicker = (o?: { id?: string; mode?: 'read' | 'readwrite'; startIn?: FileSystemHandle }) => Promise<Folder>;

const picker = (): DirectoryPicker | undefined => (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const list = (files: MediaFile[]) => {
  const n = files.map((f) => baseName(f.path));
  return n.length < 3 ? n.join(' and ') : `${n.slice(0, -1).join(', ')}, and ${n.at(-1)}`;
};

function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = make('a');
  a.href = url;
  a.download = name;
  host().append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function install(app: App): void {
  // the folder of the deck, kept for the next saves of this page
  let folder: Folder | null = null;

  const ask = new Dialog({
    title: 'Choose the folder of the deck',
    text: '',
    buttons: [
      { label: 'Choose Folder…', value: 'choose', primary: true },
      { label: 'Cancel', value: 'cancel' },
    ],
    className: 'media-folder',
  });

  const stopped = () => new Error(`the new media files were not saved, hence ${app.handle?.name ?? 'the deck'} was not saved either`);

  async function pick(deck: FileSystemFileHandle): Promise<Folder> {
    const show = picker();
    if (!show) throw new Error('this browser cannot write into a folder');
    try {
      return await show({ id: 'beeson-deck', mode: 'readwrite', startIn: deck });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw stopped();
      // without a press of a key or a button, the picker is opened from the dialog
      if (!(error instanceof DOMException) || (error.name !== 'SecurityError' && error.name !== 'NotAllowedError')) throw error;
    }
    ask.text.textContent = `The new images and videos are written into the folder ${FOLDER} next to ${deck.name}. A browser writes into a folder only after you choose it, hence choose the folder that holds ${deck.name}.`;
    if ((await ask.open('choose')) !== 'choose') throw stopped();
    try {
      return await show({ id: 'beeson-deck', mode: 'readwrite', startIn: deck });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw stopped();
      throw error;
    }
  }

  // the folder that holds deck, with leave to write into it
  async function folderOf(deck: FileSystemFileHandle): Promise<Folder> {
    const holds = async (f: Folder) => (await f.resolve(deck))?.length === 1;
    if (!folder || !(await holds(folder))) {
      const chosen = await pick(deck);
      if (!(await holds(chosen))) throw new Error(`the folder ${chosen.name} does not hold ${deck.name}. Save again and choose the folder of the deck`);
      folder = chosen;
    }
    if (folder.queryPermission && (await folder.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      if ((await folder.requestPermission?.({ mode: 'readwrite' })) !== 'granted') throw stopped();
    }
    return folder;
  }

  setCompanions({
    async write(text, deck) {
      const files = media.unsaved(text);
      if (!files.length) return '';
      const into = await (await folderOf(deck)).getDirectoryHandle(FOLDER, { create: true });
      for (const f of files) {
        const writable = await (await into.getFileHandle(baseName(f.path), { create: true })).createWritable();
        await writable.write(f.blob);
        await writable.close();
      }
      media.saved(files);
      return `${plural(files.length, 'new file')} written into ${FOLDER}`;
    },
    download(text) {
      const files = media.unsaved(text);
      for (const f of files) downloadBlob(baseName(f.path), f.blob);
      media.saved(files);
      return files.length ? `Put ${list(files)} into the folder ${FOLDER} next to it` : '';
    },
  });
}
