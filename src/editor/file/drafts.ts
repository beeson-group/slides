// the unsaved edits of the deck, kept in the storage of the browser 1 s after the last change and
// offered on a card when the deck is opened again, e.g. after a crash or a closed tab. a draft is
// the whole rendered text with its time, under a key of the address of the deck without its query
// and hash. it is never replayed onto the page: Restore writes it over the file and reloads

import type { App, Drafts } from '../app.ts';
import { store, stored } from '../ui/dom.ts';
import { Dialog } from '../ui/dialog.ts';
import { canWrite, download, fileName, folder, pickTarget, write } from './files.ts';

type Draft = { at: number; text: string };

const DRAFT_KEY = `beeson-draft:${location.href.split(/[?#]/)[0]}`;
// the pause after the last change, in ms, before the edits are kept in the storage
const DRAFT_DELAY = 1000;

function readDraft(): Draft | null {
  const raw = stored(DRAFT_KEY);
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as Partial<Draft>;
    return typeof draft.text === 'string' && typeof draft.at === 'number' ? { at: draft.at, text: draft.text } : null;
  } catch {
    return null;
  }
}

export function install(app: App): void {
  const fail = (e: unknown) => app.fail(e);
  const actions: Record<string, () => unknown> = { restore: () => restore(), copy: () => copy(), discard: () => discard() };

  // the dialog shown when edits that were not saved are found in the storage of the browser. it
  // stays open until its action is done, since a dismissed picker leaves the draft where it is
  const recover = new Dialog({
    title: 'Edits that were not saved were found',
    text: '',
    buttons: [
      { label: 'Restore and save', title: 'Write the edits into the file and show the page again', value: 'restore', primary: true },
      { label: 'Download a copy', title: 'Put a copy of the file with the edits into your downloads', value: 'copy' },
      { label: 'Discard', title: 'Forget the edits', value: 'discard' },
    ],
    className: 'recover',
    dismissable: false,
    stay: ['restore', 'copy', 'discard'],
    onButton: (value) => void Promise.resolve().then(actions[value]).catch(fail),
  });

  let draftTimer = 0;

  // a render error is shown, since the edits are then not kept anywhere but on the page
  function keepDraft(): void {
    if (!app.dirty || !app.source || !app.pairing) return;
    let text: string;
    try {
      text = app.files.render();
    } catch (e) {
      app.note = { text: `The edits could not be kept in this browser: ${e instanceof Error ? e.message : String(e)}`, warn: true };
      app.report();
      return;
    }
    store(DRAFT_KEY, JSON.stringify({ at: Date.now(), text } satisfies Draft));
  }

  function drop(): void {
    window.clearTimeout(draftTimer);
    store(DRAFT_KEY, null);
  }

  // a draft that differs from the file that was opened is offered on the card
  function offer(): void {
    const draft = readDraft();
    if (!draft || !app.source || draft.text === app.source.text) {
      if (draft) drop();
      recover.close(null);
      return;
    }
    const when = new Date(draft.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    recover.text.textContent = `Edits of ${fileName()} from ${when} were kept in this browser and not saved. Restore writes the file with them and shows it again, a copy goes to your downloads, and Discard forgets them.`;
    void recover.open('restore');
  }

  async function restore(): Promise<void> {
    const draft = readDraft();
    if (!draft) {
      recover.close(null);
      return;
    }
    if (!app.handle && canWrite() && !(await pickTarget(app))) return;
    if (app.handle) {
      await write(app.handle, draft.text);
      drop();
      location.reload();
      return;
    }
    copy();
  }

  function copy(): void {
    const draft = readDraft();
    if (draft) download(fileName(), draft.text);
    drop();
    recover.close(null);
    app.note = { text: `A copy of ${fileName()} with the edits is in your downloads. Replace ${fileName()} in ${folder()} with it and open it again`, warn: false };
    app.report();
  }

  function discard(): void {
    drop();
    recover.close(null);
    app.report();
  }

  const drafts: Drafts = {
    keepSoon: () => {
      window.clearTimeout(draftTimer);
      draftTimer = window.setTimeout(keepDraft, DRAFT_DELAY);
    },
    drop,
    hasDraft: () => readDraft() !== null,
    offer,
    offered: () => !recover.el.hidden,
    restore,
  };
  app.drafts = drafts;
  app.listen('dirty', drafts.keepSoon);
}
