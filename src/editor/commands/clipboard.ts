// the commands Cut, Copy, Paste, and Duplicate of the Edit menu. with elements of the slide
// selected, they act on the elements, and in the navigator on the slides, through the commands of
// commands/slide.ts. the text on the clipboard is the format of commands/slide.ts: the mark
// <!--beeson-->, then each element as it is written into the file. a paste on the slide of its
// source is put after the source, offset by 20 px when it would cover it, and a paste on another
// slide is put into the container on the same path from its slide, at the same offset. the keys
// of the clipboard are taken from the events cut, copy, and paste, which carry the clipboard in
// every browser, and ⌘D or Ctrl+D duplicates. an image or a video on the clipboard, e.g. a
// screenshot or an image copied in another app, is put on the slide through the media store of
// media/store.ts, into an empty zone or a new one, and its file is written under media/ at the save

import type { App } from '../app.ts';
import type { Translate } from '../tags.ts';
import { insertFiles } from '../media/actions.ts';
import { kindOf } from '../media/store.ts';
import { freshGroup } from './order.ts';
import { VOID } from '../source.ts';
import { tokenize } from '../tokens.ts';
import { MARK, docOf, slidesIn } from './slide.ts';

// the offset of a paste or a duplicate that would cover its source, in slide pixels
export const STEP = 20;

// the selected elements that are in the file, without the slides, and without an element inside
// another selected one
export function selectedElements(app: App): Element[] {
  const els = app.selection.elements().filter((el) => el.isConnected && !el.matches('.reveal .slides > section') && !!app.pairing?.elements.get(el)?.open);
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
// and the elements of the last such paste, after which the next one is put
type Clip = { text: string; sources: Element[]; paths: string[][]; pasted: number; last: Element[] };
let clip: Clip | null = null;

function copy(app: App, els: Element[], data: DataTransfer | null): void {
  const text = clipText(app, els);
  clip = { text, sources: els, paths: els.map(pathOf), pasted: 0, last: [] };
  if (data) {
    data.setData('text/plain', text);
    data.setData('text/html', text);
  } else void navigator.clipboard?.writeText(text).catch(() => {});
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

// the elements of texts pasted onto the current slide. the caller runs it in one transaction
async function pasteElements(app: App, texts: string[]): Promise<Element[]> {
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
  if (own) {
    own.pasted++;
    own.last = nodes;
  }
  app.selection.set('elements', nodes);
  return nodes;
}

// the copies of els, each after its element and offset by 20 px when it would cover it
export async function duplicateElements(app: App, els: Element[]): Promise<Element[]> {
  const doc = docOf(app);
  const copies: Element[] = [];
  for (const el of els) {
    const dup = await doc.duplicate(el);
    if (covers(app, dup, el)) shift(app, dup, 1);
    copies.push(dup);
  }
  regroup(app, copies);
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

export const inText = (app: App) => app.selection.kind === 'text' || app.region() === 'text';
const onSlides = (app: App) => app.region() === 'navigator' || app.selection.kind === 'slides';

// whether the range of the document is not collapsed, i.e. a text has something to cut or copy, as
// in both apps, where Cut and Copy are disabled at a caret
export const hasRange = () => {
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
      const els = selectedElements(a);
      if (!els.length) return a.commands.run('slide.cut', data ?? undefined);
      copy(a, els, data);
      a.selection.clear();
      for (const el of [...els].reverse()) await docOf(a).remove(el, 'cut');
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
      const els = selectedElements(a);
      if (!els.length) return a.commands.run('slide.copy', data ?? undefined);
      copy(a, els, data);
    },
  });
  c.define({
    id: 'edit.paste',
    label: 'Paste',
    menu: menu(22),
    context: ['element', 'text', 'canvas'],
    enabled: ready,
    undoable: true,
    run: async (a, arg) => {
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
      // a paste into a text is plain text, as every paste into a text
      if (inText(a)) {
        if (!els && !slides) document.execCommand('insertText', false, text);
      } else if (els) await pasteElements(a, els);
      else if (slides) await a.commands.run('slide.paste', slides);
    },
  });
  c.define({
    id: 'edit.duplicate',
    label: 'Duplicate',
    keys: { mac: ['Mod+D'], other: ['Mod+D'] },
    in: ['canvas'],
    menu: menu(30, 'select'),
    context: ['element'],
    enabled: (a) => ready(a) && (selectedElements(a).length > 0 || a.commands.enabled('slide.duplicate')),
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
