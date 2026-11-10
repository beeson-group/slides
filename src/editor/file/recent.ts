// the decks of File > Open Recent: the file handles of the File System Access API of the last decks
// opened or saved here, kept in IndexedDB with their names, the newest first. each deck is kept
// with the address of the page that it was opened on, since the editor edits the deck of its page.
// the list is read once at the start, and it is empty in a browser without the API or without
// IndexedDB. a failed read or write of the database leaves the list of the page as it is

export type Recent = { name: string; page: string; at: number; handle: FileSystemFileHandle };

const DB = 'beeson-editor';
const STORE = 'recent';
const KEY = 'decks';
// the number of decks in the menu, as in Keynote and PowerPoint
export const MAX_RECENT = 10;

// the address of the page of the deck, without its query and hash
export const pageOf = (): string => location.href.split(/[?#]/)[0];

let list: Recent[] = [];
const watchers: (() => void)[] = [];

export const recents = (): readonly Recent[] => list;

// the decks of this page, the newest first
export const recentsOfPage = (): Recent[] => list.filter((r) => r.page === pageOf());

export function watchRecents(fn: () => void): void {
  watchers.push(fn);
}

function base(): Promise<IDBDatabase> {
  return new Promise((done, fail) => {
    const ask = indexedDB.open(DB, 1);
    ask.onupgradeneeded = () => ask.result.createObjectStore(STORE);
    ask.onsuccess = () => done(ask.result);
    ask.onerror = () => fail(ask.error);
    ask.onblocked = () => fail(new Error('the database of the editor is blocked'));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await base();
  try {
    return await new Promise<T>((done, fail) => {
      const t = db.transaction(STORE, mode);
      const ask = fn(t.objectStore(STORE));
      t.oncomplete = () => done(ask.result);
      t.onerror = () => fail(t.error);
      t.onabort = () => fail(t.error);
    });
  } finally {
    db.close();
  }
}

const valid = (r: unknown): r is Recent => {
  const x = r as Partial<Recent> | null;
  return !!x && typeof x.name === 'string' && typeof x.page === 'string' && typeof x.at === 'number' && typeof x.handle?.getFile === 'function';
};

function changed(next: Recent[]): void {
  list = next;
  for (const fn of watchers) fn();
}

// a list that cannot be written is kept for the session of the page
async function store(next: Recent[]): Promise<void> {
  try {
    await run('readwrite', (s) => s.put(next, KEY));
  } catch {
    // nothing else to do
  }
  changed(next);
}

export async function loadRecents(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const stored = await run<unknown>('readonly', (s) => s.get(KEY));
    changed(Array.isArray(stored) ? stored.filter(valid).slice(0, MAX_RECENT) : []);
  } catch {
    changed([]);
  }
}

const same = async (a: FileSystemFileHandle, b: FileSystemFileHandle): Promise<boolean> => {
  try {
    return a === b || (await a.isSameEntry(b));
  } catch {
    return false;
  }
};

const without = async (handle: FileSystemFileHandle): Promise<Recent[]> => {
  const rest: Recent[] = [];
  for (const r of list) if (!(await same(r.handle, handle))) rest.push(r);
  return rest;
};

// handle is put at the head of the list once, with the address of this page
export async function remember(handle: FileSystemFileHandle): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const rest = await without(handle);
  await store([{ name: handle.name, page: pageOf(), at: Date.now(), handle }, ...rest].slice(0, MAX_RECENT));
}

export async function forget(handle: FileSystemFileHandle): Promise<void> {
  await store(await without(handle));
}

export const clearRecents = (): Promise<void> => store([]);

// the label of a deck in the menu is its file name. when another deck of the list has the same
// name, the folder of its page is added after a dash, since every talk made from the template is
// an index.html
export function recentLabel(r: Recent): string {
  if (list.filter((o) => o.name === r.name).length < 2) return r.name;
  const parts = decodeURIComponent(new URL(r.page).pathname).split('/').filter(Boolean);
  const folder = parts.at(-2);
  return folder ? `${r.name} — ${folder}` : r.name;
}
