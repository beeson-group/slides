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
import { insertPlain, pasteItems, pastesItems, spaced } from '../text/typing.ts';
import { movableOf, objectsOf } from '../canvas/hit.ts';
import { fieldOf, settleCopies, freshGroup } from './order.ts';
import { copiedGroups } from '../model/groups.ts';
import { relink } from '../model/glue.ts';
import { withTwins } from '../canvas/hit.ts';
import { VOID } from '../source.ts';
import { tokenize } from '../tokens.ts';
import { keepBeside } from './place.ts';
import { keepPlaces } from '../canvas/drag.ts';
import { MARK, docOf, slidesIn } from './slide.ts';
import { cellAt, clearRange, pasteAtCell, pasteRange, pasteTable, rangeText, selectedRange } from './table.ts';
import { display } from '../keymap.ts';
import { removeJoining } from '../text/blocks.ts';

// the offset of a paste or a duplicate that would cover its source, in slide pixels
export const STEP = 20;

// the selected elements that are in the file, without the slides, with the figure of a picture
// selected inside it, and without an element inside another selected one
export function selectedElements(app: App): Element[] {
  const els = objectsOf(app, app.selection.elements()).filter((el) => el.isConnected && !el.matches('.reveal .slides > section') && !!app.pairing?.elements.get(el)?.open);
  return els.filter((el) => !els.some((o) => o !== el && o.contains(el)));
}

// the element that Esc selects in a text of the slide, i.e. the block of the caret, which Duplicate
// duplicates, as Keynote and PowerPoint duplicate a text box. in a cell, Esc selects the cell,
// which is not duplicated
function caretBlock(app: App): Element | null {
  const host = app.selection.kind === 'text' ? app.hostOf(document.activeElement) : null;
  const el = host && !host.closest('td, th') ? movableOf(app, host) ?? host : null;
  return el && app.pairing?.elements.get(el)?.open ? el : null;
}

// the thumbnails, where Duplicate duplicates the slide
const inNavigator = (app: App): boolean => app.region() === 'navigator';

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
// where a paste goes after the last of its copies still on the slide. html is the table of a
// copy of a range of cells. away holds, for each slide that the copy was pasted on, the elements of
// each paste there, and the boxes of the first paste there without the sources, at the place of the
// sources. the pastes made while the sources were on the slide are kept for when they are deleted.
// boxes are the boxes of the sources at the copy, where a copy that is not in the flow is pasted
type Away = { pastes: Element[][]; base?: Box[] };
type Clip = { text: string; sources: Element[]; paths: string[][]; pasted: number; html?: string; away?: Map<Element, Away>; boxes?: Box[] };
let clip: Clip | null = null;

function copy(app: App, els: Element[], data: DataTransfer | null): void {
  const text = clipText(app, els);
  clip = { text, sources: els, paths: els.map(pathOf), pasted: 0, boxes: els.map((el) => boxOf(app, el)) };
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
  clip = { text: plain, sources: [], paths: [], pasted: 0, html };
  write(data, plain, html);
  return true;
}

// the box of el in slide pixels
type Box = { x: number; y: number; w: number; h: number };
function boxOf(app: App, el: Element): Box {
  const slides = app.slides() as HTMLElement;
  const s = slides.getBoundingClientRect();
  const k = slides.offsetWidth ? s.width / slides.offsetWidth : 1;
  const r = el.getBoundingClientRect();
  return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k };
}

// whether the box p moved by d slide pixels down and to the right is the box q within a slide pixel
const same = (p: Box, q: Box, d = 0): boolean => Math.abs(p.x + d - q.x) < 1 && Math.abs(p.y + d - q.y) < 1 && Math.abs(p.w - q.w) < 1 && Math.abs(p.h - q.h) < 1;

// whether the boxes of a and b are the same within a slide pixel, i.e. a copy a covers its source b.
// a block of the text column is put under its source by the layout, and is not offset
export function covers(app: App, a: Element, b: Element): boolean {
  return same(boxOf(app, a), boxOf(app, b));
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
  return docOf(app).freshIds(text, (id) => !!document.getElementById(id));
}

// the container of the text column of slide, i.e. the panel of a split slide, the block of a title
// or closing slide, the words of a section slide, and else the slide
export function columnOf(slide: Element): Element {
  return slide.querySelector(':scope > .panel, :scope > .block, :scope > .sec') ?? slide;
}

// the copies of a group are a new group, as the copies of a drag with the copy modifier in
// canvas/drag.ts are
function regroup(app: App, copies: Element[]): void {
  copiedGroups(copies, (taken) => freshGroup(app, taken)).forEach((g, i) => {
    if (g !== copies[i].getAttribute('data-group')) docOf(app).setTag(copies[i], { attrs: { 'data-group': g } }, 'group');
  });
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
  const keep = keepPlaces(app, own?.sources ?? []);
  const away = clip && clip.sources.length === texts.length ? (clip.away ??= new Map()) : null;
  const on = away && (away.get(slide) ?? away.set(slide, { pastes: [] }).get(slide));
  // a paste on the slide of its sources is put after the last copy of the clipboard that is still
  // in the slide, hence a paste after an undone or deleted one takes the place that it freed
  const copies = new Set((on?.pastes ?? []).flat().filter((c: Element) => c.isConnected));
  const nodes: Element[] = [];
  const grounds: boolean[] = [];
  for (const [i, raw] of texts.entries()) {
    const text = freshIds(app, raw);
    const source = own?.sources[i] ?? null;
    let parent: Element;
    let before: Node | null;
    if (source?.parentElement) {
      parent = source.parentElement;
      const prev = nodes.at(-1)?.parentElement === parent ? nodes.at(-1) : [...parent.children].reverse().find((c) => copies.has(c));
      before = nextKept(prev ?? source);
    } else {
      let at: Element | null = slide;
      for (const s of clip?.paths[i] ?? []) at = at?.querySelector(`:scope > ${s}`) ?? null;
      parent = at && app.pairing?.elements.has(at) && !app.pairing.byLive.has(at) ? at : columnOf(slide);
      before = parent.querySelector(':scope > aside.notes');
    }
    // a backdrop goes to the ground of the slide, under every other element
    const ground = /^\s*<div\b[^>]*\bclass="(?:[^"]*\s)?backdrop[\s"]/.test(text);
    if (ground) {
      parent = slide;
      before = slide.firstElementChild;
    }
    const [node] = await doc.insert(text, parent, before, 'paste');
    nodes.push(node);
    grounds.push(ground);
  }
  if (on && own) placeOwn(app, own, on, nodes, grounds);
  else if (on) placeAway(app, on, nodes, grounds);
  const older = on ? [...on.pastes] : [];
  on?.pastes.push(nodes);
  regroup(app, nodes);
  settleCopies(app, nodes);
  relink(app, nodes);
  keep((el, translate) => doc.setTag(el, { translate }, 'move'));
  if (own) {
    // a paste in the flow that lands on a source or a copy, which keep holds at its place, is
    // moved on from where it lands
    const others = (i: number) => [own.sources[i], ...older.map((p) => p[i])];
    const boxes = nodes.map((n) => boxOf(app, n));
    const moves = nodes.map((_, i) => !grounds[i] && others(i).some((c) => c?.isConnected && same(boxes[i], boxOf(app, c))));
    if (moves.some(Boolean)) moveOn(app, nodes, boxes, moves, others, 0);
    own.pasted++;
  }
  app.selection.set('elements', nodes);
  return nodes;
}

// a paste on a slide without the sources is put at the place of the sources, then moved in steps
// of 20 px to the first place that a copy of the clipboard on this slide does not take now. a copy
// that is deleted or undone does not take a place, and a block of the text column, which the layout
// puts after the copies before it, is not moved
function placeAway(app: App, on: Away, nodes: Element[], grounds: boolean[]): void {
  const boxes = nodes.map((n) => boxOf(app, n));
  const base = (on.base ??= boxes);
  const { pastes } = on;
  const moves = nodes.map((_, i) => !grounds[i] && !!base[i] && same(boxes[i], base[i]));
  moveOn(app, nodes, boxes, moves, (i) => pastes.map((p) => p[i]), 0);
}

// a paste on the slide of its sources is moved by one step more than the pastes there before it
// where it covers its source, and else not, then on to the first place that a source or a copy of
// the clipboard on this slide does not take now. a copy that is not at the place of the sources at
// the copy, e.g. a block of the text column, is not moved
function placeOwn(app: App, own: Clip, on: Away, nodes: Element[], grounds: boolean[]): void {
  const boxes = nodes.map((n) => boxOf(app, n));
  const cover = nodes.map((n, i) => !grounds[i] && covers(app, n, own.sources[i]));
  const moves = nodes.map((_, i) => cover[i] || (!grounds[i] && !!own.boxes?.[i] && same(boxes[i], own.boxes[i])));
  moveOn(app, nodes, boxes, moves, (i) => [own.sources[i], ...on.pastes.map((p) => p[i])], cover.some(Boolean) ? own.pasted + 1 : 0);
}

// nodes moved by the first count of steps of 20 px from from on at which none of the nodes that
// moves names is on a connected element of others(i), where boxes are the boxes of nodes now
function moveOn(app: App, nodes: Element[], boxes: Box[], moves: boolean[], others: (i: number) => (Element | undefined)[], from: number): void {
  const taken = (n: number) => nodes.some((_, i) => moves[i] && others(i).some((c) => c?.isConnected && same(boxes[i], boxOf(app, c), STEP * n)));
  let n = from;
  while (taken(n)) n++;
  if (n) nodes.forEach((node, i) => moves[i] && shift(app, node, n));
}

// the element that each duplicate was first duplicated from, and the duplicates of each such element
const origins = new WeakMap<Element, Element>();
const duplicates = new WeakMap<Element, Element[]>();

// the copies of els, each after its element. a copy that covers its element is moved by 20 px, and
// on to the first place that the element, the element it was first duplicated from, or a duplicate
// of the latter on this slide does not take now. a copy in the flow that lands on such a duplicate,
// which keepPlaces holds at its place, is moved on from where it lands. an undo selects els again,
// and a redo the copies
export function duplicateElements(app: App, els: Element[]): Promise<Element[]> {
  return app.history.selecting('Duplicate', () => duplicated(app, els));
}

async function duplicated(app: App, els: Element[]): Promise<Element[]> {
  const doc = docOf(app);
  const copies: Element[] = [];
  const keep = keepPlaces(app, els);
  for (const el of els) copies.push(await doc.duplicate(el));
  const slide = app.current();
  const roots = els.map((el) => origins.get(el) ?? el);
  const cover = copies.map((dup, i) => !dup.matches('.backdrop') && covers(app, dup, els[i]));
  const family = (i: number) => [els[i], roots[i], ...(duplicates.get(roots[i]) ?? [])].filter((c) => slide?.contains(c));
  regroup(app, copies);
  settleCopies(app, copies);
  relink(app, copies);
  keep((el, translate) => doc.setTag(el, { translate }, 'move'));
  const boxes = copies.map((c) => boxOf(app, c));
  const moves = copies.map((dup, i) => cover[i] || (!dup.matches('.backdrop') && family(i).some((c) => same(boxes[i], boxOf(app, c)))));
  if (moves.some(Boolean)) moveOn(app, copies, boxes, moves, family, cover.some(Boolean) ? 1 : 0);
  copies.forEach((dup, i) => {
    origins.set(dup, roots[i]);
    duplicates.set(roots[i], [...(duplicates.get(roots[i]) ?? []), dup]);
  });
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
// the HTML of the system clipboard, or '' where it does not have one or the browser refuses the read
async function readHtml(): Promise<string> {
  try {
    for (const item of (await navigator.clipboard?.read?.()) ?? []) if (item.types.includes('text/html')) return await (await item.getType('text/html')).text();
  } catch {}
  return '';
}

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
        await removeJoining(a, [...els].reverse(), 'cut');
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
    const read = !text;
    let refused = false;
    if (!text) text = (await navigator.clipboard?.readText().catch((e) => void (refused = e?.name === 'NotAllowedError'))) || '';
    if (!text && !inText(a)) {
      const files = await readMedia();
      if (files.length) return void (await insertFiles(a, files));
    }
    text ||= clip?.text || '';
    // the key pastes from its own event, which the browser allows where it refuses the read
    if (!text && refused) {
      a.note = { text: `The browser did not let the editor read the clipboard. Press ${display('Mod+V', a.platform)} to paste`, warn: true };
      return void a.report();
    }
    const els = elementsIn(text);
    const slides = slidesIn(text)?.length ? text : null;
    const field = fieldOf(a);
    if (field) {
      // a text is given to the field as the paste of the key first, and a field without a handler
      // takes the plain text
      if (text && !els && !slides) {
        const data = new DataTransfer();
        data.setData('text/plain', text);
        const ev = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
        if (field.dispatchEvent(ev)) document.execCommand('insertText', false, text);
      }
    } else if (inText(a)) {
      const at = getSelection()?.anchorNode ?? document.activeElement;
      const host = a.hostOf(at instanceof Element ? at : at?.parentElement ?? null);
      // one word with the space after it gets the spaces of the paste of the key in text/typing.ts
      if (host && !els && !slides && pastesItems(a, host, text)) await pasteItems(a, text);
      else if (match && host) insertPlain(host, els || slides ? wordsOf(text) : spaced(host, text));
      else if (!els && !slides) {
        // a range pasted into a cell fills the cells from it, as the paste of the key in table.ts
        const html = cellAt(a) ? (text === clip?.text ? clip.html : '') || (read ? await readHtml() : '') : '';
        if (!(await pasteAtCell(a, text, html))) document.execCommand('insertText', false, host ? spaced(host, text) : text);
      }
    } else if (els) await pasteElements(a, els);
    else if (slides) await a.commands.run('slide.paste', slides);
    else {
      // a range of cells or a table is pasted onto the selected range, or else onto the slide as a
      // new table, as by the key. a copy of another tab or of the page before a reload is read
      // from the system clipboard
      const html = (text === clip?.text ? clip.html : '') || (read && text ? await readHtml() : '');
      if (!(await pasteRange(a, text, html)) && a.region() === 'canvas') await pasteTable(a, text, html);
    }
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
    in: ['canvas', 'text', 'navigator'],
    menu: menu(30, 'select'),
    context: ['element'],
    // in the navigator, the key duplicates the slide whatever the canvas selected
    enabled: (a) => (inNavigator(a) ? a.commands.enabled('slide.duplicate') : ready(a) && !selectedRange(a) && (a.selection.kind === 'text' ? !!caretBlock(a) : selectedElements(a).length > 0 || a.commands.enabled('slide.duplicate'))),
    runsAs: (a) => (!inNavigator(a) && (selectedElements(a).length || caretBlock(a)) ? 'edit.duplicate' : 'slide.duplicate'),
    undoable: true,
    run: async (a) => {
      if (inNavigator(a)) return a.commands.run('slide.duplicate');
      // in a text, the block of the caret is selected first, as by Esc
      const block = caretBlock(a);
      if (block) {
        (document.activeElement as HTMLElement | null)?.blur();
        a.selection.set('elements', [block]);
      }
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
