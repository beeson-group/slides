// the commands Cut, Copy, Paste, and Duplicate of the Edit menu. with elements of the slide
// selected, they act on the elements, and in the navigator on the slides, through the commands of
// commands/slide.ts. the text on the clipboard is the format of commands/slide.ts: the mark
// <!--beeson-->, then each element as it is written into the file. a paste on the slide of its
// source is put after the source, offset by 20 px when it would cover it, and a paste on another
// slide is put into the container on the same path from its slide, at the same offset. the keys
// of the clipboard are taken from the events cut, copy, and paste, which carry the clipboard in
// every browser, and ⌘D or Ctrl+D duplicates. an image or a video on the clipboard, e.g. a
// screenshot or an image copied in another app, is put on the slide through the media store of
// media/store.ts, into an empty zone or a new one, and its file is written under media/ at the save.
// Paste and Match Style pastes the words of the clipboard into a text in the style at the caret,
// and it is Paste on the slide

import type { App } from '../app.ts';
import type { Translate } from '../tags.ts';
import { insertFiles } from '../media/actions.ts';
import { kindOf } from '../media/store.ts';
import { insertPlain, pasteItems, pastesItems } from '../text/typing.ts';
import { objectsOf } from '../canvas/hit.ts';
import { settleCopies, freshGroup } from './order.ts';
import { withTwins } from '../canvas/hit.ts';
import { VOID } from '../source.ts';
import { tokenize } from '../tokens.ts';
import { keepBeside } from './place.ts';
import { MARK, docOf, slidesIn } from './slide.ts';
import { clearRange, pasteRange, rangeText, selectedRange } from './table.ts';

// the offset of a paste or a duplicate that would cover its source, in slide pixels
export const STEP = 20;

// the selected elements that are in the file, without the slides, with the figure of a picture
// selected inside it, and without an element inside another selected one
export function selectedElements(app: App): Element[] {
  const els = objectsOf(app, app.selection.elements()).filter((el) => el.isConnected && !el.matches('.reveal .slides > section') && !!app.pairing?.elements.get(el)?.open);
  return els.filter((el) => !els.some((o) => o !== el && o.contains(el)));
}

// the text of els on the clipboard: the mark, then each element as it is written into the file
export function clipText(app: App, els: Element[]): string {
  const doc = docOf(app);
  const eol = app.source?.crlf ? '\r\n' : '\n';
  return [MARK, ...els.map((el) => doc.elementText(el))].join(eol);
}

// the elements of a text of the clipboard, each without the white space before it, or null for a
// text without the mark or with slides
export function elementsIn(text: string): string[] | null {
  const at = text.indexOf(MARK);
  if (at < 0 || text.slice(0, at).trim() || slidesIn(text)?.length) return null;
  const body = text.slice(at + MARK.length);
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (const t of tokenize(body)) {
    if (t.type === 'start') {
      if (depth === 0) start = t.start;
      if (t.selfClosing || VOID.has(t.name.toLowerCase())) {
        if (depth === 0) out.push(body.slice(start, t.end));
      } else depth++;
    } else if (t.type === 'end' && depth > 0 && --depth === 0) out.push(body.slice(start, t.end));
  }
  return out.length ? out : null;
}

// the words of the elements or slides of a text of the clipboard, without their notes, on one line
function wordsOf(text: string): string {
  const body = new DOMParser().parseFromString(text, 'text/html').body;
  body.querySelectorAll('aside.notes, script, style').forEach((n) => n.remove());
  return (body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

// the containers between a slide and el, each as its tag and first class, e.g. ['div.panel']
const stepOf = (el: Element): string => el.localName + (el.classList[0] && !el.classList[0].startsWith('beeson') ? `.${CSS.escape(el.classList[0])}` : '');

function pathOf(el: Element): string[] {
  const out: string[] = [];
  for (let p = el.parentElement; p && p.localName !== 'section'; p = p.parentElement) out.unshift(stepOf(p));
  return out;
}

// the sibling after el that is in the file, past the elements made at run time
function nextKept(el: Element): Node | null {
  let n = el.nextSibling;
  while (n instanceof Element && n.hasAttribute('data-generated')) n = n.nextSibling;
  return n;
}

// the last copy, with its sources, the number of times it was pasted on the slide of its sources,
// and the elements of the last such paste, after which the next one is put. html is the table of a
// copy of a range of cells
type Clip = { text: string; sources: Element[]; paths: string[][]; pasted: number; last: Element[]; html?: string };
let clip: Clip | null = null;

function copy(app: App, els: Element[], data: DataTransfer | null): void {
  const text = clipText(app, els);
  clip = { text, sources: els, paths: els.map(pathOf), pasted: 0, last: [] };
  write(data, text, text);
}

function write(data: DataTransfer | null, plain: string, html: string): void {
  if (data) {
    data.setData('text/plain', plain);
    data.setData('text/html', html);
  } else void navigator.clipboard?.writeText(plain).catch(() => {});
}

// the cells of a selected range copied as tab-separated text and as a table, or false without a range
function copyRange(app: App, data: DataTransfer | null): boolean {
  const t = selectedRange(app);
  if (!t) return false;
  const { plain, html } = rangeText(t);
  clip = { text: plain, sources: [], paths: [], pasted: 0, last: [], html };
  write(data, plain, html);
  return true;
}

// the box of el in slide pixels
function boxOf(app: App, el: Element) {
  const slides = app.slides() as HTMLElement;
  const s = slides.getBoundingClientRect();
  const k = slides.offsetWidth ? s.width / slides.offsetWidth : 1;
  const r = el.getBoundingClientRect();
  return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k };
}

// whether the boxes of a and b are the same within a slide pixel, i.e. a copy a covers its source b.
// a block of the text column is put under its source by the layout, and is not offset
export function covers(app: App, a: Element, b: Element): boolean {
  const p = boxOf(app, a), q = boxOf(app, b);
  return Math.abs(p.x - q.x) < 1 && Math.abs(p.y - q.y) < 1 && Math.abs(p.w - q.w) < 1 && Math.abs(p.h - q.h) < 1;
}

const translateOf = (v: string | undefined): Translate => {
  const [x, y] = (v ?? '').trim().split(/\s+/).map((p) => parseFloat(p) || 0);
  return { x: x ?? 0, y: y ?? 0 };
};

// the offset of el moved by n steps of 20 px down and to the right, as a change of the history
export function shift(app: App, el: Element, n: number): void {
  const t = translateOf(docOf(app).tagState(el).style.translate);
  docOf(app).setTag(el, { translate: { x: t.x + STEP * n, y: t.y + STEP * n } }, 'move');
}

// text with each id that is already on the page renamed, together with the plots that name it
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

// the container of the text column of slide, i.e. the panel of a split slide, the block of a title
// or closing slide, the words of a section slide, and else the slide
export function columnOf(slide: Element): Element {
  return slide.querySelector(':scope > .panel, :scope > .block, :scope > .sec') ?? slide;
}

// the copies of a group are a new group, as the copies of a drag with the copy modifier in
// canvas/drag.ts are
function regroup(app: App, copies: Element[]): void {
  const groups = new Map<string, string>();
  for (const el of copies) {
    const g = el.getAttribute('data-group');
    if (!g) continue;
    if (!groups.has(g)) groups.set(g, freshGroup(app));
    docOf(app).setTag(el, { attrs: { 'data-group': groups.get(g)! } }, 'group');
  }
}

// the elements of texts pasted onto the current slide. the caller runs it in one transaction. an
// undo selects what was selected before the paste, and a redo the pasted elements
function pasteElements(app: App, texts: string[]): Promise<Element[]> {
  return app.history.selecting('Paste', () => pasted(app, texts));
}

async function pasted(app: App, texts: string[]): Promise<Element[]> {
  const slide = app.current();
  if (!slide) return [];
  const doc = docOf(app);
  const own = clip && clip.sources.length === texts.length && clip.sources.every((s) => s.isConnected && slide.contains(s)) ? clip : null;
  const nodes: Element[] = [];
  for (const [i, raw] of texts.entries()) {
    const text = freshIds(app, raw);
    const source = own?.sources[i] ?? null;
    let parent: Element;
    let before: Node | null;
    if (source?.parentElement) {
      parent = source.parentElement;
      const prev = [nodes.at(-1), own?.last.at(-1)].find((n) => n?.parentElement === parent);
      before = nextKept(prev ?? source);
    } else {
      let at: Element | null = slide;
      for (const s of clip?.paths[i] ?? []) at = at?.querySelector(`:scope > ${s}`) ?? null;
      parent = at && app.pairing?.elements.has(at) && !app.pairing.byLive.has(at) ? at : columnOf(slide);
      before = parent.querySelector(':scope > aside.notes');
    }
    const [node] = await doc.insert(text, parent, before, 'paste');
    if (source && own && covers(app, node, source)) shift(app, node, own.pasted + 1);
    nodes.push(node);
  }
  regroup(app, nodes);
  settleCopies(app, nodes);
  if (own) {
    own.pasted++;
    own.last = nodes;
  }
  app.selection.set('elements', nodes);
  return nodes;
}

// the copies of els, each after its element and offset by 20 px when it would cover it. an undo
// selects els again, and a redo the copies
export function duplicateElements(app: App, els: Element[]): Promise<Element[]> {
  return app.history.selecting('Duplicate', () => duplicated(app, els));
}

async function duplicated(app: App, els: Element[]): Promise<Element[]> {
  const doc = docOf(app);
  const copies: Element[] = [];
  for (const el of els) {
    const dup = await doc.duplicate(el);
    if (covers(app, dup, el)) shift(app, dup, 1);
    copies.push(dup);
  }
  regroup(app, copies);
  settleCopies(app, copies);
  app.selection.set('elements', copies);
  return copies;
}

// the image and video files of a clipboard
function mediaFiles(data: DataTransfer | null | undefined): File[] {
  if (!data) return [];
  const files = [...data.files];
  for (const item of data.items ?? []) {
    const f = item.kind === 'file' ? item.getAsFile() : null;
    if (f && !files.some((g) => g.name === f.name && g.size === f.size && g.type === f.type)) files.push(f);
  }
  return files.filter((f) => kindOf(f));
}

// the files of an image or a video on the system clipboard, read for Edit > Paste from the menu
async function readMedia(): Promise<File[]> {
  try {
    const items = (await navigator.clipboard?.read?.()) ?? [];
    const out: File[] = [];
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith('image/') || t.startsWith('video/'));
      if (type) out.push(new File([await item.getType(type)], `image.${type.split('/')[1].split('+')[0]}`, { type }));
    }
    return out;
  } catch {
    return [];
  }
}

// the focused text that is not a text of the slides, i.e. a line of the outline or a field of a
// pane. the commands of the Edit menu act on its text, and not on the selection of the canvas
export const fieldOf = (app: App): HTMLElement | null => {
  const f = document.activeElement;
  const typed = f instanceof HTMLElement && (f.isContentEditable || f.matches('textarea, input:not([type=range], [type=checkbox], [type=radio], [type=button], [type=color])'));
  return typed && !app.hostOf(f) ? f : null;
};
export const inText = (app: App) => app.selection.kind === 'text' || app.region() === 'text' || !!fieldOf(app);
const onSlides = (app: App) => app.region() === 'navigator' || app.selection.kind === 'slides';

// whether the range of the document is not collapsed, i.e. a text has something to cut or copy, as
// in both apps, where Cut and Copy are disabled at a caret
export const hasRange = () => {
  const f = document.activeElement;
  if (f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement) return f.selectionStart !== f.selectionEnd;
  const s = getSelection();
  return !!s && s.rangeCount > 0 && !s.isCollapsed;
};

export function install(app: App): void {
  const c = app.commands;
  const fail = (e: unknown) => app.fail(e);
  // Duplicate opens the group of the selection, as Duplicate Selection in the Edit menu of Keynote
  const menu = (order: number, group = 'clipboard') => ({ bar: 'Edit', group, order });
  const ready = (a: App) => !!a.pairing?.root;

  c.define({
    id: 'edit.cut',
    label: 'Cut',
    menu: menu(20),
    context: ['element', 'text'],
    enabled: (a) => ready(a) && (inText(a) ? hasRange() : selectedElements(a).length > 0 || (onSlides(a) && a.commands.enabled('slide.cut'))),
    undoable: true,
    run: async (a, arg) => {
      const data = arg instanceof DataTransfer ? arg : null;
      // in a text, the command of the browser, which a click on a menu item allows
      if (inText(a)) return void document.execCommand('cut');
      if (copyRange(a, data)) return clearRange(a);
      // the image of the other mode beside a cut image goes with it
      const els = withTwins(a, selectedElements(a));
      if (!els.length) return a.commands.run('slide.cut', data ?? undefined);
      copy(a, els, data);
      // an element with an offset beside a cut plate is kept in its place, as at a delete
      const keep = keepBeside(a, els);
      // an undo selects the cut elements again, as in Keynote
      await a.history.selecting('Cut', async () => {
        a.selection.clear();
        for (const el of [...els].reverse()) await docOf(a).remove(el, 'cut');
        keep((el, translate) => docOf(a).setTag(el, { translate }, 'move'));
      });
    },
  });
  c.define({
    id: 'edit.copy',
    label: 'Copy',
    menu: menu(21),
    context: ['element', 'text'],
    enabled: (a) => ready(a) && (inText(a) ? hasRange() : selectedElements(a).length > 0 || (onSlides(a) && a.commands.enabled('slide.copy'))),
    run: (a, arg) => {
      const data = arg instanceof DataTransfer ? arg : null;
      if (inText(a)) return void document.execCommand('copy');
      if (copyRange(a, data)) return;
      const els = selectedElements(a);
      if (!els.length) return a.commands.run('slide.copy', data ?? undefined);
      copy(a, els, data);
    },
  });
  // a paste into a text is plain text, as every paste into a text. with match set, the words of
  // the elements or slides of the editor on the clipboard are pasted too
  const paste = async (a: App, arg: unknown, match: boolean) => {
    if (Array.isArray(arg) && arg.every((f) => f instanceof File)) return void (await insertFiles(a, arg));
    let text = typeof arg === 'string' ? arg : '';
    if (!text) text = (await navigator.clipboard?.readText().catch(() => '')) || '';
    if (!text && !inText(a)) {
      const files = await readMedia();
      if (files.length) return void (await insertFiles(a, files));
    }
    text ||= clip?.text || '';
    const els = elementsIn(text);
    const slides = slidesIn(text)?.length ? text : null;
    const field = fieldOf(a);
    if (field) {
      // slides are pasted from a line of the outline as from the navigator. a text is given to the
      // field as the paste of the key first, since the grid of Plot Data fills its cells from it
      // and a line of the outline takes one line. a field without a handler takes the plain text
      if (slides && a.region() === 'navigator') await a.commands.run('slide.paste', slides);
      else if (text && !els && !slides) {
        const data = new DataTransfer();
        data.setData('text/plain', text);
        if (field.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))) document.execCommand('insertText', false, text);
      }
    } else if (inText(a)) {
      const at = getSelection()?.anchorNode ?? document.activeElement;
      const host = a.hostOf(at instanceof Element ? at : at?.parentElement ?? null);
      if (host && !els && !slides && pastesItems(a, host, text)) await pasteItems(a, text);
      else if (match && host) insertPlain(host, els || slides ? wordsOf(text) : text);
      else if (!els && !slides) document.execCommand('insertText', false, text);
    } else if (els) await pasteElements(a, els);
    else if (!slides && (await pasteRange(a, text, text === clip?.text ? clip.html : ''))) return;
    else if (slides) await a.commands.run('slide.paste', slides);
  };
  c.define({
    id: 'edit.paste',
    label: 'Paste',
    menu: menu(22),
    context: ['element', 'text', 'canvas'],
    enabled: ready,
    undoable: true,
    run: (a, arg) => paste(a, arg, false),
  });
  // the keys of Keynote and PowerPoint on the Mac, which are also those of Paste and Match Style
  // in Chrome, Safari, and Firefox. in a text the key is left to the browser, whose paste is plain
  // text in text/typing.ts. elsewhere Ctrl+Shift+V is Paste Style, the key of PowerPoint for
  // Windows, and PowerPoint does not have a key for this paste
  c.define({
    id: 'edit.pasteAndMatchStyle',
    label: 'Paste and Match Style',
    keys: { mac: ['Mod+Alt+Shift+V'] },
    in: ['canvas'],
    menu: menu(22.5),
    context: ['text'],
    enabled: ready,
    undoable: true,
    run: (a, arg) => paste(a, arg, true),
  });
  c.define({
    id: 'edit.duplicate',
    label: 'Duplicate',
    keys: { mac: ['Mod+D'], other: ['Mod+D'] },
    in: ['canvas'],
    menu: menu(30, 'select'),
    context: ['element'],
    enabled: (a) => ready(a) && !selectedRange(a) && (selectedElements(a).length > 0 || a.commands.enabled('slide.duplicate')),
    runsAs: (a) => (selectedElements(a).length ? 'edit.duplicate' : 'slide.duplicate'),
    undoable: true,
    run: async (a) => {
      const els = selectedElements(a);
      if (els.length) await duplicateElements(a, els);
      else await a.commands.run('slide.duplicate');
    },
  });

  // the keys of the clipboard on the canvas act on the selected elements, and a paste of slides on
  // the canvas adds them after the current slide. in a text and in the navigator, the events are
  // left to the browser and to commands/slide.ts
  const onClip = (ev: ClipboardEvent) => {
    if (ev.defaultPrevented || !ready(app)) return;
    // an image pasted on the slide, or into a text when it comes without a text, e.g. a
    // screenshot, is put on the slide, since a block of the theme does not hold an image
    if (ev.type === 'paste' && (app.region() === 'canvas' || app.region() === 'text')) {
      const data = ev.clipboardData;
      const text = data?.getData('text/plain') ?? '';
      const files = mediaFiles(data);
      if (files.length && !elementsIn(text) && !slidesIn(text)?.length && (app.region() === 'canvas' || !text.trim())) {
        ev.preventDefault();
        void c.run('edit.paste', files).catch(fail);
        return;
      }
    }
    if (app.region() !== 'canvas') return;
    if (ev.type === 'paste') {
      const text = ev.clipboardData?.getData('text/plain') || ev.clipboardData?.getData('text/html') || '';
      if (!elementsIn(text) && !slidesIn(text)?.length) return;
      ev.preventDefault();
      void c.run('edit.paste', text).catch(fail);
      return;
    }
    if (!selectedElements(app).length) return;
    ev.preventDefault();
    void c.run(ev.type === 'cut' ? 'edit.cut' : 'edit.copy', ev.clipboardData).catch(fail);
  };
  for (const type of ['copy', 'cut', 'paste'] as const) document.addEventListener(type, onClip);
}
