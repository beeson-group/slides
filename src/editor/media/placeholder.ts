// the placeholder of an empty zone or plate, as the content placeholder of PowerPoint: a dashed
// edge with buttons for an image, a video, a table, and a QR code at its center, of which a click
// inserts into the zone. it is an element of the editor only, marked data-generated, which the save
// and the pairing pass over, and it is drawn again after each change of the slides. it does not
// have text, since a slot with text is not empty, hence its hint is drawn by the stylesheet

import type { App } from '../app.ts';
import { pickTableInto } from '../commands/table.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { ACCEPT, chooseFiles, insertFiles, isEmptySlot } from './actions.ts';

// the sizes are in slide px, hence the placeholder is scaled with the slide as in PowerPoint. on a
// plate it is drawn inside the padding, where the figure of the plate is drawn
const CSS = `
html.beeson-editor .reveal .slides section .plate:has(> .beeson-placeholder) { position: relative; }
html.beeson-editor .reveal .slides .beeson-placeholder { position: absolute; inset: 0; z-index: 1; display: flex !important; flex-direction: column; align-items: center; justify-content: center; gap: 28px; box-sizing: border-box; border: 3px dashed color-mix(in srgb, var(--muted, #888) 70%, transparent); border-radius: 8px; pointer-events: none; }
html.beeson-editor .reveal .slides .plate > .beeson-placeholder { inset: 200px 120px 250px; }
html.beeson-editor .reveal .slides .beeson-placeholder .row { display: grid; grid-template-columns: repeat(2, 96px); gap: 20px; }
html.beeson-editor .reveal .slides .beeson-placeholder button { width: 96px; height: 96px; padding: 0; display: grid; place-items: center; box-sizing: border-box; border: 2px solid transparent; border-radius: 16px; background: color-mix(in srgb, var(--muted, #888) 14%, transparent); color: var(--muted, #888); cursor: pointer; pointer-events: auto; }
html.beeson-editor .reveal .slides .beeson-placeholder button:hover, html.beeson-editor .reveal .slides .beeson-placeholder button:focus-visible { border-color: var(--ed-select, #8a2be2); color: var(--ed-select, #8a2be2); background: color-mix(in srgb, var(--ed-select, #8a2be2) 12%, transparent); outline: none; }
html.beeson-editor .reveal .slides .beeson-placeholder button svg { width: 52px; height: 52px; }
html.beeson-editor .reveal .slides .beeson-placeholder::after { content: "Click an icon to add it, or drop an image or a video here"; max-width: 90%; color: var(--muted, #888); font: 26px/1.3 system-ui, sans-serif; text-align: center; }
html.beeson-editor.beeson-previewing .reveal .slides .beeson-placeholder { display: none !important; }
`;

type Kind = 'image' | 'video' | 'table' | 'qr';
const BUTTONS: { kind: Kind; label: string }[] = [
  { kind: 'image', label: 'Insert Image' },
  { kind: 'video', label: 'Insert Video' },
  { kind: 'table', label: 'Insert Table' },
  { kind: 'qr', label: 'Insert QR Code' },
];

const SLOTS = '.reveal .slides section > .zone, .reveal .slides section > .plate';

function placeholder(): HTMLElement {
  const box = make('div', 'beeson-placeholder');
  box.setAttribute('data-generated', '');
  box.setAttribute('aria-label', 'Empty zone');
  // hidden outside the stylesheet of the editor, e.g. in a thumbnail of the navigator, whose clone
  // of the slide is drawn without the hidden attribute
  box.style.display = 'none';
  const row = make('div', 'row');
  for (const b of BUTTONS) {
    const el = make('button');
    el.type = 'button';
    el.tabIndex = -1;
    el.dataset.insert = b.kind;
    el.title = b.label;
    el.setAttribute('aria-label', b.label);
    el.append(icon(b.kind, 52));
    row.append(el);
  }
  box.append(row);
  return box;
}

// a placeholder in each empty slot of the slides, and none in a slot with content
export function syncPlaceholders(app: App): void {
  const ready = !!app.pairing?.root;
  for (const slot of document.querySelectorAll(SLOTS)) {
    const own = slot.querySelector(':scope > .beeson-placeholder');
    const empty = ready && isEmptySlot(app, slot);
    if (empty && !own) slot.append(placeholder());
    else if (!empty && own) own.remove();
  }
}

async function insertInto(app: App, zone: Element, kind: Kind, anchor: DOMRect): Promise<void> {
  if (kind === 'table') return pickTableInto(app, zone, anchor);
  if (kind === 'qr') {
    if (app.current() === zone.closest('section')) await app.commands.run('insert.qr');
    return;
  }
  const files = await chooseFiles(ACCEPT[kind]);
  if (files.length && zone.isConnected && isEmptySlot(app, zone)) await insertFiles(app, files, zone);
}

export function install(app: App): void {
  injectStyle('media-placeholder', CSS);
  app.onRefresh(['content', 'slide', 'structure'], () => syncPlaceholders(app));
  // a press on a button is taken before the selection and the drag of the canvas, which listen on
  // the document, and it does not move the focus
  window.addEventListener('pointerdown', (ev) => {
    const b = ev.target instanceof Element ? ev.target.closest('.beeson-placeholder button') : null;
    if (!b) return;
    ev.preventDefault();
    ev.stopPropagation();
  }, true);
  window.addEventListener('click', (ev) => {
    const b = ev.target instanceof Element ? ev.target.closest<HTMLElement>('.beeson-placeholder button') : null;
    const zone = b?.closest('.zone, .plate');
    if (!b || !zone) return;
    ev.preventDefault();
    ev.stopPropagation();
    void insertInto(app, zone, b.dataset.insert as Kind, b.getBoundingClientRect()).catch((e) => app.fail(e));
  }, true);
}
