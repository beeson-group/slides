// the unsaved edits of the deck, kept in the storage of the browser 1 s after the last change and
// offered on a card when the deck is opened again, e.g. after a crash or a closed tab. a draft is
// the whole rendered text with its time, under a key of the address of the deck without its query
// and hash. it is never replayed onto the page: Restore writes it over the file and reloads

import type { App, Drafts } from '../app.ts';
import { button, injectStyle, make, store, stored, wire } from '../ui/dom.ts';
import { canWrite, download, fileName, folder, pickTarget, write } from './files.ts';

type Draft = { at: number; text: string };

const DRAFT_KEY = `beeson-draft:${location.href.split(/[?#]/)[0]}`;
// the pause after the last change, in ms, before the edits are kept in the storage
const DRAFT_DELAY = 1000;

const CSS = `
.beeson-edit-card.recover { z-index: 66; }
`;

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
  injectStyle('drafts', CSS);

  // the card shown when edits that were not saved are found in the storage of the browser
  const recover = make('div', 'beeson-edit-card recover');
  const recoverText = make('p');
  const restoreButton = button('Restore and save', 'Write the edits into the file and show the page again');
  const copyButton = button('Download a copy', 'Put a copy of the file with the edits into your downloads');
  const discardButton = button('Discard', 'Forget the edits');
  const recoverRow = make('div', 'row');
  recoverRow.append(restoreButton, copyButton, discardButton);
  recover.append(make('h3', '', 'Edits that were not saved were found'), recoverText, recoverRow);
  recover.hidden = true;

  let draftTimer = 0;

  function keepDraft(): void {
    if (!app.dirty || !app.source || !app.pairing) return;
    const draft: Draft = { at: Date.now(), text: app.files.render() };
    store(DRAFT_KEY, JSON.stringify(draft));
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
      recover.hidden = true;
      return;
    }
    const when = new Date(draft.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    recoverText.textContent = `Edits of ${fileName()} from ${when} were kept in this browser and not saved. Restore writes the file with them and shows it again, a copy goes to your downloads, and Discard forgets them.`;
    copyButton.hidden = false;
    recover.hidden = false;
  }

  async function restore(): Promise<void> {
    const draft = readDraft();
    if (!draft) {
      recover.hidden = true;
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
    recover.hidden = true;
    app.note = { text: `A copy of ${fileName()} with the edits is in your downloads. Replace ${fileName()} in ${folder()} with it and open it again`, warn: false };
    app.report();
  }

  function discard(): void {
    drop();
    recover.hidden = true;
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
    offered: () => !recover.hidden,
    restore,
  };
  app.drafts = drafts;
  const fail = (e: unknown) => app.fail(e);
  wire(restoreButton, restore, fail);
  wire(copyButton, copy, fail);
  wire(discardButton, discard, fail);
  app.listen('dirty', drafts.keepSoon);
  document.body.append(recover);
}
