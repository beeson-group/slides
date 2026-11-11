// the image and video files added in the editor and not saved yet. each file is kept as a blob under
// its path in the deck, e.g. media/orbit.png, and the page shows it from an object URL until a save
// writes it next to the deck. the text of the file names the path, and only the page has the object
// URL. the blobs are also kept in IndexedDB under the address of the deck, so that a draft of
// file/drafts.ts is recovered with its files after a crash or a closed tab

export type Kind = 'image' | 'video';
export type MediaFile = { path: string; blob: Blob; url: string; saved: boolean };

// the folder of the new files, next to the deck
export const FOLDER = 'media';

const DB = 'beeson-media';
const STORE = 'files';
// read when used, since the model of the deck, which a test loads without a page, imports the store
const deck = () => location.href.split(/[?#]/)[0];

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i;
const VIDEO_EXT = /\.(mp4|m4v|webm|mov|ogv)$/i;

export function kindOf(file: { type: string; name: string }): Kind | null {
  if (file.type.startsWith('image/') || (!file.type && IMAGE_EXT.test(file.name))) return 'image';
  if (file.type.startsWith('video/') || (!file.type && VIDEO_EXT.test(file.name))) return 'video';
  return null;
}

// a name that is safe in a path and in an attribute, e.g. orbit-plot-2.png for "Orbit plot (2).PNG"
export function safeName(name: string, fallback: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  const clean = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  const stem = clean(dot > 0 ? base.slice(0, dot) : base) || fallback;
  const ext = dot > 0 ? clean(base.slice(dot + 1)) : '';
  return ext ? `${stem}.${ext}` : stem;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// whether text has path as the whole value of an attribute
export const names = (text: string, path: string): boolean => new RegExp(`=\\s*(["']?)${escapeRe(path)}\\1(?=[\\s>/])`).test(text);

type Row = { deck: string; path: string; blob: Blob };

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((done, fail) => {
    r.onsuccess = () => done(r.result);
    r.onerror = () => fail(r.error);
  });
}

let opened: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  opened ??= new Promise((done, fail) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: ['deck', 'path'] });
    r.onsuccess = () => done(r.result);
    r.onerror = () => fail(r.error);
  });
  return opened;
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const s = (await db()).transaction(STORE, mode).objectStore(STORE);
  return request(fn(s));
}

const ofDeck = () => IDBKeyRange.bound([deck(), ''], [deck(), '￿']);

export class MediaStore {
  private readonly byPath = new Map<string, MediaFile>();
  private readonly byUrl = new Map<string, MediaFile>();
  // the chain of the writes to IndexedDB, whose end a test waits for
  private kept: Promise<unknown> = Promise.resolve();

  // a new file under media/ named after name. its path is not one of the store, and taken is
  // false for it
  add(blob: Blob, name: string, taken: (path: string) => boolean, fallback = 'file'): MediaFile {
    const clean = safeName(name, fallback);
    const dot = clean.lastIndexOf('.');
    const [stem, ext] = dot > 0 ? [clean.slice(0, dot), clean.slice(dot)] : [clean, ''];
    let path = `${FOLDER}/${clean}`;
    for (let i = 2; this.byPath.has(path) || taken(path); i++) path = `${FOLDER}/${stem}-${i}${ext}`;
    return this.put({ path, blob, url: URL.createObjectURL(blob), saved: false }, true);
  }

  private put(f: MediaFile, keep: boolean): MediaFile {
    this.byPath.set(f.path, f);
    this.byUrl.set(f.url, f);
    if (keep) this.keep(() => tx('readwrite', (s) => s.put({ deck: deck(), path: f.path, blob: f.blob } satisfies Row)));
    return f;
  }

  // a browser without IndexedDB, e.g. in a private window, keeps the files on the page only
  private keep(fn: () => Promise<unknown>): void {
    this.kept = this.kept.then(fn).catch(() => {});
  }

  idle(): Promise<unknown> {
    return this.kept;
  }

  get(path: string | null): MediaFile | null {
    return (path && this.byPath.get(path)) || null;
  }

  // the path in the deck of the value of a src or a poster on the page
  pathOf(value: string | null): string | null {
    if (!value) return value;
    return this.byUrl.get(value)?.path ?? value;
  }

  // the files that text names and that are not on the disk yet
  unsaved(text: string): MediaFile[] {
    return [...this.byPath.values()].filter((f) => !f.saved && names(text, f.path));
  }

  // files are on the disk, hence IndexedDB no longer keeps them for a draft. the page keeps
  // showing them from their object URLs
  saved(files: MediaFile[]): void {
    for (const f of files) {
      f.saved = true;
      this.keep(() => tx('readwrite', (s) => s.delete([deck(), f.path])));
    }
  }

  // each src and poster under root, root included, that names a file of the store is shown from
  // the object URL of the file. a later src or poster set on these elements with the path of a new
  // file, e.g. by app.doc at an undo, is set to its object URL at once, since a browser asks the
  // server for a poster as soon as it is set
  resolve(root: Element): void {
    for (const el of [root, ...root.querySelectorAll('img, video, source')]) {
      if (!el.matches('img, video, source')) continue;
      this.hook(el);
      for (const attr of ['src', 'poster']) {
        const f = this.byPath.get(el.getAttribute(attr) ?? '');
        if (f) el.setAttribute(attr, f.url);
      }
    }
  }

  private readonly hooked = new WeakSet<Element>();
  private hook(el: Element): void {
    if (this.hooked.has(el)) return;
    this.hooked.add(el);
    const set = Element.prototype.setAttribute;
    el.setAttribute = (name: string, value: string) => set.call(el, name, name === 'src' || name === 'poster' ? (this.byPath.get(value)?.url ?? value) : value);
  }

  // the files that IndexedDB keeps for a draft of this deck. with keep false, e.g. when the deck
  // does not have a draft, they are forgotten
  async load(keep: boolean): Promise<number> {
    let rows: Row[] = [];
    try {
      rows = (await tx('readonly', (s) => s.getAll(ofDeck()))) as Row[];
      if (!keep) await tx('readwrite', (s) => s.delete(ofDeck()));
    } catch {
      return 0;
    }
    if (!keep) return 0;
    for (const r of rows) if (!this.byPath.has(r.path)) this.put({ path: r.path, blob: r.blob, url: URL.createObjectURL(r.blob), saved: false }, false);
    return rows.length;
  }
}

// the one store of the editor
export const media = new MediaStore();
