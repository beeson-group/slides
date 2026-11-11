// the commands of the Slide menu: new slide with the gallery of the layouts, duplicate, delete,
// hide and show, move up and down, and cut, copy, and paste of slides, and the move and the rename
// of a section of the light table. each command acts on the slides selected in the navigator, or on
// the current slide, through the document model, and is one entry of the history however many
// slides it changes

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import type { Doc } from '../model/doc.ts';
import { LAYOUTS, type Layout } from '../model/templates.ts';
import { droppedOrder, isHidden, type MoveTo, type Navigator } from '../navigator/navigator.ts';
import { groupsOf, sectionHeading } from '../navigator/sorter.ts';
import { drawInto } from '../navigator/thumbs.ts';
import { setOwnTex } from '../text/blocks.ts';
import { tokenize } from '../tokens.ts';
import { nextShown, setTransition, transitionOf } from '../review/transitions.ts';
import { sample } from './layout.ts';
import { injectStyle } from '../ui/dom.ts';

// the mark that opens the text of slides on the clipboard, so that a paste in the navigator tells
// slides apart from other text
export const MARK = '<!--beeson-->';

// the width of the picture of a tile of the gallery, and its columns, as in the Add a Slide popover
// of Keynote
const PIC = 112;
const COLUMNS = 3;

const LABELS: Record<Layout, string> = { title: 'Title', section: 'Section', content: 'Content', narrow: 'Content, Narrow', wide: 'Content, Wide', figure: 'Figure', split: 'Split', closing: 'Closing' };

// the prompts of the empty blocks of a new slide, which are not written into the file
const CSS = `
html.beeson-editor .reveal:not(.beeson-peek) .slides section :is(h1, h2, p)[contenteditable="true"]:empty::before { color: var(--muted, #888); pointer-events: none; }
html.beeson-editor .reveal:not(.beeson-peek) .slides section :is(h1, h2)[contenteditable="true"]:empty::before { content: "Title"; }
html.beeson-editor .reveal:not(.beeson-peek) .slides section p.sub[contenteditable="true"]:empty::before { content: "Subtitle"; }
html.beeson-editor .reveal:not(.beeson-peek) .slides section p.who[contenteditable="true"]:empty::before { content: "Author"; }
html.beeson-editor .reveal:not(.beeson-peek) .slides section p.caption[contenteditable="true"]:empty::before { content: "Caption"; }
html.beeson-editor .reveal:not(.beeson-peek) .slides section > p[contenteditable="true"]:empty::before, html.beeson-editor .reveal:not(.beeson-peek) .slides section .panel > p[contenteditable="true"]:empty::before { content: "Text"; }
.beeson-edit-gallery { --g-bg: var(--ed-panel, #fbfbfd); --g-text: var(--ed-text, #1d1d1f); --g-muted: var(--ed-muted, #6e6e73); --g-line: var(--ed-line, #d2d2d7); --g-select: var(--ed-select, #7a5af8); }
@media (prefers-color-scheme: dark) {
  .beeson-edit-gallery { --g-bg: var(--ed-panel, #2c2c2e); --g-text: var(--ed-text, #f2f2f7); --g-muted: var(--ed-muted, #a1a1a6); --g-line: var(--ed-line, #48484a); --g-select: var(--ed-select, #9b82ff); }
}
.beeson-edit-gallery { position: fixed; z-index: 80; margin: 0; padding: 12px 14px 14px; width: max-content; box-sizing: border-box; border: 1px solid var(--g-line); border-radius: 12px; background: var(--g-bg); color: var(--g-text); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28); font: 12px/1.3 system-ui, sans-serif; }
.beeson-edit-gallery .head { margin: 0 0 10px; font-size: 13px; font-weight: 600; text-align: center; }
.beeson-edit-gallery .grid { display: grid; grid-template-columns: repeat(${COLUMNS}, ${PIC + 8}px); gap: 8px 10px; }
.beeson-edit-gallery .tile { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 4px; border: 0; border-radius: 8px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.beeson-edit-gallery .tile .pic { display: block; width: ${PIC}px; aspect-ratio: 16 / 9; border-radius: 4px; outline: 1px solid var(--g-line); background: var(--bg, #000); }
.beeson-edit-gallery .tile:hover .pic { outline: 2px solid var(--g-select); }
.beeson-edit-gallery .tile:focus-visible { outline: none; background: color-mix(in srgb, var(--g-select) 16%, transparent); }
.beeson-edit-gallery .tile:focus-visible .pic { outline: 2px solid var(--g-select); }
.beeson-edit-gallery .tile span { text-align: center; }
`;

// the document model, which main.ts creates
export function docOf(app: App): Doc {
  return app.doc;
}

const navOf = (app: App): Navigator => app.nav as Navigator;
const sections = (app: App): Element[] => [...app.slides().querySelectorAll(':scope > section')];
const ready = (app: App): boolean => !!app.pairing?.root;
const targets = (app: App): Element[] => (ready(app) ? navOf(app).selected() : []);

// the slide after which a new or pasted slide is put, and the node before which it is inserted
function placeAfter(app: App): { root: Element; before: Element | null } {
  const last = navOf(app).selected().at(-1) ?? null;
  return { root: app.slides(), before: last?.nextElementSibling ?? null };
}

// the slides shown and selected after a command, with the focus kept in the navigator when the
// command was run from it, and on the tile of the current slide while the light table is shown
function land(app: App, slides: Element[], current: Element | null, focusNav: boolean): void {
  const nav = navOf(app);
  nav.select(slides, current);
  if (focusNav || nav.table?.shown) nav.focus(current);
}

// whether Select All and Delete of the Edit menu act on the slides, i.e. while a row of the navigator
// or a tile of the Light Table has the focus, as in the Slide Sorter of PowerPoint. a text of the
// outline is in the navigator, and the two are left to its text
export function onSlides(app: App): boolean {
  const active = document.activeElement;
  if (active instanceof HTMLElement && (active.isContentEditable || active.matches('input, textarea'))) return false;
  return app.region() === 'navigator' || !!active?.closest('.beeson-edit-sorter .tile');
}

// the caret is put into the first empty heading of slide, or else at the start of its first block
function caretInto(slide: Element): void {
  const block = slide.querySelector<HTMLElement>('h1[contenteditable="true"], h2[contenteditable="true"]') ?? slide.querySelector<HTMLElement>('[contenteditable="true"]');
  if (!block) return;
  block.focus({ preventScroll: true });
  const range = document.createRange();
  range.selectNodeContents(block);
  range.collapse(true);
  const sel = getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

async function newSlide(app: App, layout: Layout, before = placeAfter(app).before): Promise<Element> {
  const slide = await docOf(app).insertSlide(layout, before);
  // the slide is hidden under the Light Table, hence its tile takes the focus, as at Duplicate
  if (navOf(app).table?.shown) land(app, [slide], slide, true);
  else {
    navOf(app).select([slide], slide);
    caretInto(slide);
  }
  return slide;
}

// the layout of the slide that New Slide adds: the layout of a content, figure, or split slide,
// as PowerPoint repeats the layout of the slide before, and content after a title, section, or
// closing slide
function nextLayout(app: App): Layout {
  const s = navOf(app).selected().at(-1);
  return (['narrow', 'wide', 'figure', 'split'] as Layout[]).find((l) => s?.classList.contains(l)) ?? 'content';
}

// the slides put into the order of desired, one move per slide out of place
async function applyOrder(app: App, desired: Element[]): Promise<void> {
  const doc = docOf(app);
  const root = app.slides();
  for (let i = 0; i < desired.length; i++) {
    const live = sections(app);
    if (live[i] !== desired[i]) await doc.move(desired[i], root, live[i], 'move slide');
  }
}

// the order after each selected slide is moved one place up, or down, past a slide not selected
function shifted(list: Element[], moved: Set<Element>, up: boolean): Element[] {
  const out = [...list];
  const idx = up ? out.map((_, i) => i) : out.map((_, i) => out.length - 1 - i);
  for (const i of idx) {
    const j = up ? i - 1 : i + 1;
    if (j < 0 || j >= out.length || !moved.has(out[i]) || moved.has(out[j])) continue;
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const canShift = (app: App, up: boolean): boolean => {
  const list = sections(app);
  const t = targets(app);
  return t.length > 0 && shifted(list, new Set(t), up).some((s, i) => s !== list[i]);
};

// the text of slides on the clipboard: the mark, then each slide as it is written into the file
export function clipText(app: App, slides: Element[]): string {
  const doc = docOf(app);
  const eol = app.source?.crlf ? '\r\n' : '\n';
  return [MARK, ...slides.map((s) => doc.elementText(s))].join(eol);
}

// the sections of a text of the clipboard, each without the white space before it, or null for a
// text without the mark
export function slidesIn(text: string): string[] | null {
  const at = text.indexOf(MARK);
  if (at < 0 || text.slice(0, at).trim()) return null;
  const body = text.slice(at + MARK.length);
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (const t of tokenize(body)) {
    if (t.type === 'start' && t.name === 'section' && !t.selfClosing) {
      if (depth++ === 0) start = t.start;
    } else if (t.type === 'end' && t.name === 'section' && depth > 0 && --depth === 0) out.push(body.slice(start, t.end));
  }
  return out;
}

// an id that is already on the page is renamed in a pasted slide, together with the plots that
// name it, so that a cut slide is pasted with its own ids
function freshIds(app: App, text: string): string {
  const doc = docOf(app);
  let out = text;
  for (const id of new Set([...text.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))) {
    if (!document.getElementById(id)) continue;
    const next = doc.uniqueId(id);
    out = out.split(`id="${id}"`).join(`id="${next}"`).split(`data-plot="${id}"`).join(`data-plot="${next}"`);
  }
  return out;
}

// the text last copied, for a paste from a menu where the clipboard of the system cannot be read
let copied = '';

function copySlides(app: App, data?: DataTransfer | null): string {
  const text = clipText(app, targets(app));
  copied = text;
  if (data) {
    data.setData('text/plain', text);
    data.setData('text/html', text);
  } else void navigator.clipboard?.writeText(text).catch(() => {});
  return text;
}

async function deleteSlides(app: App, slides: Element[], focusNav: boolean): Promise<void> {
  const list = sections(app);
  const gone = new Set(slides);
  const lastAt = list.indexOf(slides.at(-1)!);
  const next = list.slice(lastAt + 1).find((s) => !gone.has(s)) ?? [...list.slice(0, list.indexOf(slides[0]))].reverse().find((s) => !gone.has(s)) ?? null;
  const doc = docOf(app);
  for (const s of [...slides].reverse()) await doc.remove(s, 'delete slide');
  if (next) land(app, [next], next, focusNav);
}

async function pasteSlides(app: App, text: string, focusNav: boolean): Promise<boolean> {
  const texts = slidesIn(text);
  if (!texts?.length) return false;
  const { root, before } = placeAfter(app);
  const nodes = await docOf(app).insert(texts.map((t) => freshIds(app, t)), root, before, 'paste slides');
  land(app, nodes, nodes[0], focusNav);
  return true;
}

// a section of the light table, i.e. a section slide with the slides under it, moved to gap, an
// index in the slides of the deck, and the name of a section, i.e. the heading of its section slide
export type MoveSection = { head: Element; gap: number };
export type RenameSection = { head: Element; text: string };

export const sectionSlides = (app: App, head: Element): Element[] => groupsOf(sections(app)).find((g) => g.head === head)?.slides ?? [];

const escapeText = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// the gallery of the eight layouts, drawn as the samples of the layout chooser of
// commands/layout.ts. a click or Enter on a layout adds a slide of it after the current one. back
// is the element that had the focus before the gallery was opened
type Gallery = HTMLDialogElement & { anchor?: HTMLElement | null; back?: HTMLElement | null };
let gallery: HTMLDialogElement | null = null;

function closeGallery(back = true): void {
  if (!gallery) return;
  const g = gallery;
  gallery = null;
  const to = (g as Gallery).back;
  g.close();
  g.remove();
  if (back && to?.isConnected) to.focus({ preventScroll: true });
}

// the gallery opened as a popover at anchor, a button of the toolbar or of the navigator, or else
// at the right of the row of the current slide in the navigator
function openGallery(app: App, anchor: HTMLElement | null): void {
  closeGallery(false);
  const dialog = document.createElement('dialog') as Gallery;
  dialog.className = 'beeson-edit-gallery';
  dialog.setAttribute('aria-label', 'New slide');
  // a popover leaves the toolbar live, and a click on one of its buttons closes the gallery and runs it
  dialog.dataset.popover = '';
  // a click blurs the button of the toolbar, hence the button is looked up when it is not given
  dialog.back = anchor ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  dialog.anchor = anchor ?? document.querySelector<HTMLElement>('.beeson-edit-top [data-command="slide.gallery"]');
  const head = document.createElement('div');
  head.className = 'head';
  head.textContent = 'New Slide';
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.setAttribute('role', 'listbox');
  grid.setAttribute('aria-label', 'Layouts');
  const stage = app.slides() as HTMLElement;
  const deck = { width: stage.offsetWidth || 1920, height: stage.offsetHeight || 1080 };
  const tiles = LAYOUTS.map((layout) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile';
    tile.dataset.layout = layout;
    tile.setAttribute('role', 'option');
    const pic = document.createElement('span');
    pic.className = 'pic';
    const name = document.createElement('span');
    name.textContent = LABELS[layout];
    tile.append(pic, name);
    tile.addEventListener('click', () => {
      closeGallery(false);
      void app.commands.run(`slide.new.${layout}`).catch((e) => app.fail(e));
    });
    grid.append(tile);
    return { tile, pic, layout };
  });
  dialog.append(head, grid);
  document.body.append(dialog);
  dialog.show();
  for (const t of tiles) drawInto(t.pic, sample(t.layout), deck, PIC);
  place(dialog, dialog.anchor ?? null, navOf(app).rowOf(app.current()));
  dialog.addEventListener('keydown', (ev) => {
    const i = tiles.findIndex((t) => t.tile === document.activeElement);
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS };
    if (ev.key === 'Escape') closeGallery();
    else if (ev.key in step) tiles[Math.min(tiles.length - 1, Math.max(0, i + step[ev.key]))].tile.focus();
    else if (ev.key === 'Home' || ev.key === 'End') tiles[ev.key === 'Home' ? 0 : tiles.length - 1].tile.focus();
    else if (ev.key === 'Tab') tiles[(i + (ev.shiftKey ? tiles.length - 1 : 1)) % tiles.length].tile.focus();
    else return;
    ev.preventDefault();
    ev.stopPropagation();
  });
  const outside = (ev: PointerEvent) => {
    if (!gallery) document.removeEventListener('pointerdown', outside, true);
    else if (!gallery.contains(ev.target as Node)) {
      document.removeEventListener('pointerdown', outside, true);
      closeGallery(false);
    }
  };
  document.addEventListener('pointerdown', outside, true);
  gallery = dialog;
  (tiles.find((t) => t.layout === nextLayout(app)) ?? tiles[0]).tile.focus();
}

// the gallery is a popover under its anchor, or over it when there is no room under it, and
// else at the right of the row of the current slide, inside the window
function place(dialog: HTMLElement, anchor: HTMLElement | null, row: HTMLElement | null): void {
  const w = dialog.offsetWidth;
  const h = dialog.offsetHeight;
  const a = anchor?.isConnected && anchor.getClientRects().length ? anchor.getBoundingClientRect() : null;
  let x: number;
  let y: number;
  if (a) {
    x = a.left;
    y = a.bottom + 6 + h <= innerHeight - 8 ? a.bottom + 6 : a.top - 6 - h;
  } else {
    const r = row?.getBoundingClientRect();
    x = r ? r.right + 10 : 260;
    y = r ? r.top - 8 : 60;
  }
  dialog.style.left = `${Math.max(8, Math.min(x, innerWidth - w - 8))}px`;
  dialog.style.top = `${Math.max(8, Math.min(y, innerHeight - h - 8))}px`;
}

export function install(app: App): void {
  injectStyle('slide', CSS);
  const c = app.commands;
  const inNav = () => app.region() === 'navigator';
  // Move Slide Up and Down are dimmed while the slide has the focus, where Alt with an arrow does
  // not move the slide, as it adds a row to a table there. a menu opened with the pointer leaves
  // the focus where it was
  const onSlide = (a: App) => a.region() === 'canvas' && !document.activeElement?.closest('.beeson-edit-menu');
  const slideMenu = (order: number, group = 'slide') => ({ bar: 'Slide', group, order });
  const defs: Command[] = [
    {
      id: 'slide.new',
      label: 'New Slide',
      keys: { mac: ['Ctrl+M'], other: ['Ctrl+M'] },
      menu: slideMenu(10),
      context: ['slide', 'navigator', 'canvas'],
      enabled: ready,
      undoable: true,
      run: async (a) => void (await newSlide(a, nextLayout(a))),
    },
    {
      // Add Section of the menus of the navigator of PowerPoint, as Insert > New Slide > Section:
      // a section slide after the slide under the pointer or the selected slides, or at the end
      // from the empty part of the navigator
      id: 'slide.newSection',
      label: 'New Section',
      menu: slideMenu(11),
      context: ['slide', 'navigator'],
      enabled: ready,
      undoable: true,
      run: async (a, arg) => {
        const { kind, target } = (arg ?? {}) as { kind?: string; target?: Element | null };
        const after = kind === 'navigator' ? null : target?.isConnected ? target : navOf(a).selected().at(-1);
        await newSlide(a, 'section', after ? after.nextElementSibling : null);
      },
    },
    {
      id: 'slide.newAfter',
      label: 'New Slide',
      keys: { mac: ['Enter'], other: ['Enter'] },
      in: ['navigator'],
      enabled: ready,
      undoable: true,
      run: async (a) => void (await newSlide(a, nextLayout(a))),
    },
    {
      id: 'slide.gallery',
      label: 'Add Slide',
      toolbar: { group: 'slide', order: 10, icon: 'add-slide' },
      enabled: ready,
      run: (a, arg) => openGallery(a, arg instanceof HTMLElement ? arg : null),
    },
    ...LAYOUTS.map(
      (layout, i): Command => ({
        id: `slide.new.${layout}`,
        label: LABELS[layout],
        menu: { bar: 'Insert', group: 'slide', order: 10 + i, submenu: 'New Slide' },
        enabled: ready,
        undoable: true,
        run: async (a) => void (await newSlide(a, layout)),
      }),
    ),
    {
      id: 'slide.duplicate',
      label: (a) => (targets(a).length > 1 ? 'Duplicate Slides' : 'Duplicate Slide'),
      keys: { mac: ['Mod+D'], other: ['Mod+D'] },
      in: ['navigator'],
      menu: slideMenu(20),
      context: ['slide', 'canvas'],
      enabled: (a) => targets(a).length > 0,
      undoable: true,
      run: async (a) => {
        const focus = inNav();
        const doc = docOf(a);
        const copies: Element[] = [];
        for (const s of targets(a)) {
          // the copy is the next shown slide of s, and it takes the data-transition of s, which is
          // the transition into s. the transition out of s is thus set again where the copy changed
          // it, and the copy leaves by the old transition out of s, which stays on the slide after it
          const out = transitionOf(a, s);
          const raw = nextShown(a, s)?.getAttribute('data-transition') ?? null;
          const copy = await doc.duplicate(s);
          copies.push(copy);
          if (nextShown(a, s) !== copy) continue;
          if (!out) doc.setTag(copy, { attrs: { 'data-transition': raw } }, 'transition');
          else if (transitionOf(a, s) !== out) setTransition(a, s, out);
        }
        land(a, copies, copies.at(-1) ?? null, focus);
      },
    },
    {
      id: 'slide.delete',
      label: (a) => (targets(a).length > 1 ? 'Delete Slides' : 'Delete Slide'),
      keys: { mac: ['Backspace', 'Delete'], other: ['Delete', 'Backspace'] },
      in: ['navigator'],
      menu: slideMenu(30),
      context: ['slide', 'canvas'],
      enabled: (a) => targets(a).length > 0 && targets(a).length < sections(a).length,
      undoable: true,
      run: (a) => deleteSlides(a, targets(a), inNav()),
    },
    {
      id: 'slide.hide',
      label: (a) => (targets(a).length && targets(a).every(isHidden) ? 'Show Slide' : 'Hide Slide'),
      keys: { mac: ['Mod+Shift+H'], other: ['Ctrl+Shift+H'] },
      in: ['navigator', 'canvas'],
      menu: slideMenu(40),
      context: ['slide', 'canvas'],
      enabled: (a) => targets(a).length > 0,
      undoable: true,
      run: (a) => {
        const t = targets(a);
        const hide = !t.every(isHidden);
        for (const s of t) docOf(a).hide(s, hide);
        navOf(a).refresh();
      },
    },
    {
      id: 'slide.moveUp',
      label: 'Move Slide Up',
      keys: { mac: ['Alt+ArrowUp'], other: ['Alt+ArrowUp'] },
      in: ['navigator'],
      menu: slideMenu(50, 'move'),
      context: ['slide'],
      enabled: (a) => canShift(a, true) && !onSlide(a),
      undoable: true,
      run: async (a) => {
        const t = targets(a);
        await applyOrder(a, shifted(sections(a), new Set(t), true));
        land(a, t, a.current(), inNav());
      },
    },
    {
      id: 'slide.moveDown',
      label: 'Move Slide Down',
      keys: { mac: ['Alt+ArrowDown'], other: ['Alt+ArrowDown'] },
      in: ['navigator'],
      menu: slideMenu(51, 'move'),
      context: ['slide'],
      enabled: (a) => canShift(a, false) && !onSlide(a),
      undoable: true,
      run: async (a) => {
        const t = targets(a);
        await applyOrder(a, shifted(sections(a), new Set(t), false));
        land(a, t, a.current(), inNav());
      },
    },
    {
      id: 'slide.moveTo',
      label: (a) => (targets(a).length > 1 ? 'Move Slides' : 'Move Slide'),
      enabled: ready,
      undoable: true,
      run: async (a, arg) => {
        const { slides, gap } = arg as MoveTo;
        await applyOrder(a, droppedOrder(sections(a), slides, gap));
        land(a, slides, a.current(), true);
      },
    },
    {
      id: 'slide.moveSection',
      label: 'Move Section',
      enabled: ready,
      undoable: true,
      run: async (a, arg) => {
        const { head, gap } = arg as MoveSection;
        const slides = sectionSlides(a, head);
        if (!slides.length) return;
        await applyOrder(a, droppedOrder(sections(a), slides, gap));
        land(a, slides, head, false);
      },
    },
    {
      id: 'slide.renameSection',
      label: 'Rename Section',
      enabled: ready,
      undoable: true,
      run: async (a, arg) => {
        const { head, text } = arg as RenameSection;
        const h = sectionHeading(head);
        const name = text.replace(/\s+/g, ' ').trim();
        if (!h || !name || name === (h.textContent ?? '').replace(/\s+/g, ' ').trim()) return;
        await setOwnTex(a, h, escapeText(name), 'rename section');
      },
    },
    {
      id: 'slide.cut',
      label: 'Cut',
      listedAs: () => 'edit.cut',
      context: ['slide'],
      enabled: (a) => targets(a).length > 0 && targets(a).length < sections(a).length,
      undoable: true,
      run: async (a, arg) => {
        copySlides(a, arg instanceof DataTransfer ? arg : null);
        await deleteSlides(a, targets(a), inNav());
      },
    },
    {
      id: 'slide.copy',
      label: 'Copy',
      listedAs: () => 'edit.copy',
      context: ['slide'],
      enabled: (a) => targets(a).length > 0,
      run: (a, arg) => void copySlides(a, arg instanceof DataTransfer ? arg : null),
    },
    {
      id: 'slide.paste',
      label: 'Paste',
      listedAs: () => 'edit.paste',
      context: ['slide', 'navigator'],
      enabled: ready,
      undoable: true,
      run: async (a, arg) => {
        let text = typeof arg === 'string' ? arg : '';
        if (!text) text = (await navigator.clipboard?.readText().catch(() => '')) || copied;
        await pasteSlides(a, text, inNav());
      },
    },
    {
      // Select All of the Edit menu acts on the elements of the slide, and in the navigator the
      // same keys select every slide, as in the navigators of Keynote and PowerPoint. it follows
      // Paste in the thumbnail menu, as in both apps
      id: 'slide.selectAll',
      label: 'Select All Slides',
      keys: { mac: ['Mod+A'], other: ['Mod+A'] },
      in: ['navigator'],
      context: ['slide'],
      enabled: (a) => sections(a).length > 0,
      run: (a) => land(a, sections(a), a.current(), true),
    },
  ];
  // an undo and a redo of a slide command show and select the slides from before and after it
  for (const d of defs) c.define(d.undoable ? { ...d, run: (a, arg) => navOf(a).keeping(d.id, () => d.run(a, arg)) } : d);

  // the clipboard keys in the navigator act on the slides, through the events that carry the
  // clipboard in every browser
  const onClip = (ev: ClipboardEvent) => {
    if (ev.defaultPrevented || app.region() !== 'navigator' || !ready(app)) return;
    if (ev.type === 'paste') {
      const text = ev.clipboardData?.getData('text/plain') || ev.clipboardData?.getData('text/html') || '';
      if (!slidesIn(text)?.length) return;
      ev.preventDefault();
      void c.run('slide.paste', text).catch((e) => app.fail(e));
      return;
    }
    ev.preventDefault();
    void c.run(ev.type === 'cut' ? 'slide.cut' : 'slide.copy', ev.clipboardData).catch((e) => app.fail(e));
  };
  for (const type of ['copy', 'cut', 'paste'] as const) document.addEventListener(type, onClip);
}
