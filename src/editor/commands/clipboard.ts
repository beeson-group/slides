import type { App } from '../app.ts';
import { CLIPBOARD_REGIONS } from '../commands.ts';
import type { Translate } from '../tags.ts';
import { insertFiles } from '../media/actions.ts';
import { kindOf } from '../media/store.ts';
import { insertPlain, pasteItems, pastesItems, spaced, typesetTyped } from '../text/typing.ts';
import { hasTex } from '../typeset.ts';
import { movableOf, objectsOf } from '../canvas/hit.ts';
import { dissolve, fieldOf, settleCopies, freshGroup } from './order.ts';
import { copiedGroups, groupsOf } from '../model/groups.ts';
import { relink } from '../model/attach.ts';
import { withTwins } from '../canvas/hit.ts';
import { VOID } from '../source.ts';
import { tokenize } from '../tokens.ts';
import { keepBeside } from './place.ts';
import { keepPlaces } from '../canvas/drag.ts';
import { MARK, docOf, readClipboard, refusedRead, slidesIn } from './slide.ts';
import { arrive, originComment } from './origin.ts';
import { cellAt, clearRange, pasteAtCell, pasteRange, pasteTable, rangeText, selectedRange } from './table.ts';
import { removeJoining } from '../text/elements.ts';

export const STEP = 20;

export function selectedElements(app: App): Element[] {
  const els = objectsOf(app, app.selection.elements()).filter((el) => el.isConnected && !el.matches('.reveal .slides > section') && !!app.pairing?.elements.get(el)?.open);
  return els.filter((el) => !els.some((o) => o !== el && o.contains(el)));
}

function caretElement(app: App): Element | null {
  const host = app.selection.kind === 'text' ? app.hostOf(document.activeElement) : null;
  const el = host && !host.closest('td, th') ? movableOf(app, host) ?? host : null;
  return el && app.pairing?.elements.get(el)?.open ? el : null;
}

const inNavigator = (app: App): boolean => app.region() === 'navigator';

export function clipText(app: App, els: Element[]): string {
  const doc = docOf(app);
  const eol = app.source?.crlf ? '\r\n' : '\n';
  const texts = els.map((el) => doc.elementText(el));
  return [MARK, originComment(texts.join(eol)), ...texts].join(eol);
}

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

function markedHtml(html: string): string {
  const at = html.indexOf(MARK);
  return at >= 0 && !html.slice(0, at).replace(/<[^>]*>/g, '').trim() ? html.slice(at) : '';
}

function wordsOf(text: string): string {
  const body = new DOMParser().parseFromString(text, 'text/html').body;
  body.querySelectorAll('aside.notes, script, style').forEach((n) => n.remove());
  return (body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const stepOf = (el: Element): string => el.localName + (el.classList[0] && !el.classList[0].startsWith('beeson') ? `.${CSS.escape(el.classList[0])}` : '');

function pathOf(el: Element): string[] {
  const out: string[] = [];
  for (let p = el.parentElement; p && p.localName !== 'section'; p = p.parentElement) out.unshift(stepOf(p));
  return out;
}

function nextKept(el: Element): Node | null {
  let n = el.nextSibling;
  while (n instanceof Element && n.hasAttribute('data-generated')) n = n.nextSibling;
  return n;
}

type Away = { pastes: Element[][]; base?: Box[] };
type Clip = { text: string; sources: Element[]; paths: string[][]; pasted: number; html?: string; plain?: string; away?: Map<Element, Away>; boxes?: Box[] };
let clip: Clip | null = null;

function copy(app: App, els: Element[], data: DataTransfer | null, plain?: string): void {
  const text = clipText(app, els);
  clip = { text, sources: els, paths: els.map(pathOf), pasted: 0, boxes: els.map((el) => boxOf(app, el)), plain };
  write(data, plain ?? text, text);
}

function write(data: DataTransfer | null, plain: string, html: string): void {
  if (data) {
    data.setData('text/plain', plain);
    data.setData('text/html', html);
  } else void navigator.clipboard?.writeText(plain).catch(() => {});
}

function copyRange(app: App, data: DataTransfer | null): boolean {
  const t = selectedRange(app);
  if (!t) return false;
  const { plain, html } = rangeText(t);
  clip = { text: plain, sources: [], paths: [], pasted: 0, html };
  write(data, plain, html);
  return true;
}

type Box = { x: number; y: number; w: number; h: number };
function boxOf(app: App, el: Element): Box {
  const slides = app.slides() as HTMLElement;
  const s = slides.getBoundingClientRect();
  const k = slides.offsetWidth ? s.width / slides.offsetWidth : 1;
  const r = el.getBoundingClientRect();
  return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k };
}

const same = (p: Box, q: Box, d = 0): boolean => Math.abs(p.x + d - q.x) < 1 && Math.abs(p.y + d - q.y) < 1 && Math.abs(p.w - q.w) < 1 && Math.abs(p.h - q.h) < 1;

export function covers(app: App, a: Element, b: Element): boolean {
  return same(boxOf(app, a), boxOf(app, b));
}

const translateOf = (v: string | undefined): Translate => {
  const [x, y] = (v ?? '').trim().split(/\s+/).map((p) => parseFloat(p) || 0);
  return { x: x ?? 0, y: y ?? 0 };
};

export function shift(app: App, el: Element, n: number): void {
  const t = translateOf(docOf(app).tagState(el).style.translate);
  docOf(app).setTag(el, { translate: { x: t.x + STEP * n, y: t.y + STEP * n } }, 'move');
}

function inFlow(app: App, el: Element): boolean {
  const slide = app.current();
  const up = el.parentElement;
  return !!slide && !!up && (up === slide || up === columnOf(slide)) && !el.matches('.backdrop') && /^(static|relative)$/.test(getComputedStyle(el).position);
}

function keepAll(app: App, near: Element[]): (move: (el: Element, translate: Translate) => void) => void {
  const keep = keepPlaces(app, near);
  const slide = app.current();
  const ups = new Set(near.map((el): Element | null => el.parentElement).filter((up): up is Element => !!slide && (up === slide || up === columnOf(slide))));
  const free = [...ups].flatMap((up) => [...up.children]).filter((el) => !(el as HTMLElement).style?.translate && !!app.pairing?.elements.has(el));
  const places = free.map((el) => boxOf(app, el));
  return (move) => {
    keep(move);
    free.forEach((el, i) => {
      const b = boxOf(app, el);
      const [dx, dy] = [places[i].x - b.x, places[i].y - b.y].map((d) => Math.round(d * 10) / 10);
      if (!el.isConnected || !(dx || dy)) return;
      bare.add(el);
      move(el, { x: dx, y: dy });
    });
  };
}

const floating = new WeakSet<Element>();
const bare = new WeakSet<Element>();

export function keepCopies(app: App, els: Element[]): (move: (el: Element, translate: Translate | null) => void) => void {
  const keep = keepPlaces(app, els.filter((el) => floating.has(el)), els);
  return (move) => keep((el, t) => move(el, bare.has(el) && Math.abs(t.x) < 0.5 && Math.abs(t.y) < 0.5 ? null : t));
}

function onto(app: App, copy: Element, source: Element): void {
  const [a, b] = [boxOf(app, copy), boxOf(app, source)];
  const t = translateOf(docOf(app).tagState(copy).style.translate);
  const r = (v: number) => Math.round(v * 10) / 10;
  docOf(app).setTag(copy, { translate: { x: r(t.x + b.x - a.x), y: r(t.y + b.y - a.y) } }, 'move');
}

function freshIds(app: App, text: string): string {
  return docOf(app).freshIds(text, (id) => !!document.getElementById(id));
}

export function columnOf(slide: Element): Element {
  const col = slide.querySelector(':scope > .text-column, :scope > .title-text, :scope > .sec') ?? slide;
  return col.querySelector(':scope > .r-stack > :not(.beeson-off)') ?? col;
}


function regroup(app: App, copies: Element[]): void {
  copiedGroups(copies, (taken) => freshGroup(app, taken)).forEach((g, i) => {
    if (g !== copies[i].getAttribute('data-group')) docOf(app).setTag(copies[i], { attrs: { 'data-group': g } }, 'group');
  });
}

function pasteElements(app: App, texts: string[]): Promise<Element[]> {
  return app.history.selecting('Paste', () => pasted(app, texts));
}

async function pasted(app: App, texts: string[]): Promise<Element[]> {
  const slide = app.current();
  if (!slide) return [];
  const doc = docOf(app);
  const own = clip && clip.sources.length === texts.length && clip.sources.every((s) => s.isConnected && slide.contains(s)) ? clip : null;
  const keep = keepAll(app, own?.sources ?? []);
  const away = clip && clip.sources.length === texts.length ? (clip.away ??= new Map()) : null;
  const on = away && (away.get(slide) ?? away.set(slide, { pastes: [] }).get(slide));
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
    const ground = /^\s*<div\b[^>]*\bclass="(?:[^"]*\s)?backdrop[\s"]/.test(text);
    if (ground) {
      parent = slide;
      before = slide.firstElementChild;
    }
    const [node] = await doc.insert(text, parent, before, 'paste');
    nodes.push(node);
    grounds.push(ground);
  }
  const flow = nodes.map((n, i) => !!own && !grounds[i] && !covers(app, n, own.sources[i]) && inFlow(app, n));
  if (on && own && !flow.some(Boolean)) placeOwn(app, own, on, nodes, grounds);
  else if (on && !own) placeAway(app, on, nodes, grounds);
  const older = on ? [...on.pastes] : [];
  on?.pastes.push(nodes);
  regroup(app, nodes);
  settleCopies(app, nodes);
  relink(app, nodes);
  keep((el, translate) => doc.setTag(el, { translate }, 'move'));
  if (own) {
    const inflow = flow.map((f, i) => f && inFlow(app, nodes[i]));
    inflow.forEach((f, i) => f && (floating.add(nodes[i]), onto(app, nodes[i], own.sources[i])));
    const others = (i: number) => [own.sources[i], ...older.map((p) => p[i])];
    const boxes = nodes.map((n) => boxOf(app, n));
    const moves = nodes.map((_, i) => inflow[i] || (!grounds[i] && others(i).some((c) => c?.isConnected && same(boxes[i], boxOf(app, c)))));
    if (moves.some(Boolean)) moveOn(app, nodes, boxes, moves, others, inflow.some(Boolean) ? 1 : 0);
    own.pasted++;
  }
  app.selection.set('elements', nodes);
  return nodes;
}

function placeAway(app: App, on: Away, nodes: Element[], grounds: boolean[]): void {
  const boxes = nodes.map((n) => boxOf(app, n));
  const base = (on.base ??= boxes);
  const { pastes } = on;
  const moves = nodes.map((_, i) => !grounds[i] && !!base[i] && same(boxes[i], base[i]));
  moveOn(app, nodes, boxes, moves, (i) => pastes.map((p) => p[i]), 0);
}

function placeOwn(app: App, own: Clip, on: Away, nodes: Element[], grounds: boolean[]): void {
  const boxes = nodes.map((n) => boxOf(app, n));
  const cover = nodes.map((n, i) => !grounds[i] && covers(app, n, own.sources[i]));
  const moves = nodes.map((_, i) => cover[i] || (!grounds[i] && !!own.boxes?.[i] && same(boxes[i], own.boxes[i])));
  moveOn(app, nodes, boxes, moves, (i) => [own.sources[i], ...on.pastes.map((p) => p[i])], cover.some(Boolean) ? own.pasted + 1 : 0);
}

function moveOn(app: App, nodes: Element[], boxes: Box[], moves: boolean[], others: (i: number) => (Element | undefined)[], from: number): void {
  const taken = (n: number) => nodes.some((_, i) => moves[i] && others(i).some((c) => c?.isConnected && same(boxes[i], boxOf(app, c), STEP * n)));
  let n = from;
  while (taken(n)) n++;
  if (n) nodes.forEach((node, i) => moves[i] && shift(app, node, n));
}

const origins = new WeakMap<Element, Element>();
const duplicates = new WeakMap<Element, Element[]>();

export function duplicateElements(app: App, els: Element[]): Promise<Element[]> {
  return app.history.selecting('Duplicate', () => duplicated(app, els));
}

async function duplicated(app: App, els: Element[]): Promise<Element[]> {
  const doc = docOf(app);
  const copies: Element[] = [];
  const keep = keepAll(app, els);
  for (const el of els) copies.push(await doc.duplicate(el));
  const slide = app.current();
  const roots = els.map((el) => origins.get(el) ?? el);
  const cover = copies.map((dup, i) => !dup.matches('.backdrop') && covers(app, dup, els[i]));
  const family = (i: number) => [els[i], roots[i], ...(duplicates.get(roots[i]) ?? [])].filter((c) => slide?.contains(c));
  regroup(app, copies);
  settleCopies(app, copies);
  relink(app, copies);
  keep((el, translate) => doc.setTag(el, { translate }, 'move'));
  const flow = copies.map((dup, i) => !cover[i] && inFlow(app, dup));
  flow.forEach((f, i) => f && (floating.add(copies[i]), onto(app, copies[i], els[i])));
  const boxes = copies.map((c) => boxOf(app, c));
  const moves = copies.map((dup, i) => cover[i] || flow[i] || (!dup.matches('.backdrop') && family(i).some((c) => same(boxes[i], boxOf(app, c)))));
  if (moves.some(Boolean)) moveOn(app, copies, boxes, moves, family, cover.some(Boolean) || flow.some(Boolean) ? 1 : 0);
  copies.forEach((dup, i) => {
    origins.set(dup, roots[i]);
    duplicates.set(roots[i], [...(duplicates.get(roots[i]) ?? []), dup]);
  });
  app.selection.set('elements', copies);
  return copies;
}

function mediaFiles(data: DataTransfer | null | undefined): File[] {
  if (!data) return [];
  const files = [...data.files];
  for (const item of data.items ?? []) {
    const f = item.kind === 'file' ? item.getAsFile() : null;
    if (f && !files.some((g) => g.name === f.name && g.size === f.size && g.type === f.type)) files.push(f);
  }
  return files.filter((f) => kindOf(f));
}

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
const onSlide = (app: App) => CLIPBOARD_REGIONS.includes(app.region());

export const hasRange = () => {
  const f = document.activeElement;
  if (f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement) return f.selectionStart !== f.selectionEnd;
  const s = getSelection();
  return !!s && s.rangeCount > 0 && !s.isCollapsed;
};

export function install(app: App): void {
  const c = app.commands;
  const fail = (e: unknown) => app.fail(e);
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
      if (inText(a)) return void document.execCommand('cut');
      if (copyRange(a, data)) return clearRange(a);
      const els = withTwins(a, selectedElements(a));
      if (!els.length) return a.commands.run('slide.cut', data ?? undefined);
      copy(a, els, data);
      const keep = keepBeside(a, els);
      const held = keepCopies(a, els);
      await a.history.selecting('Cut', async () => {
        a.selection.clear();
        const ids = els.flatMap((el) => [el, ...el.querySelectorAll('[data-group]')].flatMap(groupsOf));
        await removeJoining(a, [...els].reverse(), 'cut');
        dissolve(a, ids);
        keep((el, translate) => docOf(a).setTag(el, { translate }, 'move'));
        held((el, translate) => docOf(a).setTag(el, { translate }, 'move'));
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
  const paste = async (a: App, arg: unknown, match: boolean) => {
    if (Array.isArray(arg) && arg.every((f) => f instanceof File)) return void (await insertFiles(a, arg));
    let text = typeof arg === 'string' ? arg : '';
    const read = !text;
    let refused = false;
    if (!text) ({ text, refused } = await readClipboard());
    if (!text && !inText(a)) {
      const files = await readMedia();
      if (files.length) return void (await insertFiles(a, files));
    }
    text ||= clip?.text || '';
    if (!text && refused) return refusedRead(a);
    const els = elementsIn(text);
    const slides = slidesIn(text)?.length ? text : null;
    const field = fieldOf(a);
    if (field) {
      if (text && !els && !slides) {
        const data = new DataTransfer();
        data.setData('text/plain', text);
        const ev = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
        if (field.dispatchEvent(ev)) document.execCommand('insertText', false, text);
      }
    } else if (inText(a)) {
      const at = getSelection()?.anchorNode ?? document.activeElement;
      const host = a.hostOf(at instanceof Element ? at : at?.parentElement ?? null);
      const plain = !els && !slides;
      if (host && plain && pastesItems(a, host, text)) await pasteItems(a, text);
      else {
        if (match && host) insertPlain(host, plain ? spaced(host, text) : wordsOf(text));
        else if (plain) {
          const html = cellAt(a) ? (text === clip?.text ? clip.html : '') || (read ? await readHtml() : '') : '';
          if (!(await pasteAtCell(a, text, html))) document.execCommand('insertText', false, host ? spaced(host, text) : text);
        }
        if (host && plain && hasTex(text) && !host.closest('pre')) await typesetTyped(a, host);
      }
    } else if (els) await arrive(a, text, els, (from) => pasteElements(a, from));
    else if (slides) await a.commands.run('slide.paste', slides);
    else {
      const html = (text === clip?.text ? clip.html : '') || (read && text ? await readHtml() : '');
      const marked = markedHtml(html) || (clip?.plain && text === clip.plain ? clip.text : '');
      const inHtml = elementsIn(marked);
      if (inHtml) await arrive(a, marked, inHtml, (from) => pasteElements(a, from));
      else if (!(await pasteRange(a, text, html)) && onSlide(a)) await pasteTable(a, text, html);
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
    enabled: (a) => (inNavigator(a) ? a.commands.enabled('slide.duplicate') : ready(a) && !selectedRange(a) && (a.selection.kind === 'text' ? !!caretElement(a) : selectedElements(a).length > 0 || a.commands.enabled('slide.duplicate'))),
    runsAs: (a) => (!inNavigator(a) && (selectedElements(a).length || caretElement(a)) ? 'edit.duplicate' : 'slide.duplicate'),
    undoable: true,
    run: async (a) => {
      if (inNavigator(a)) return a.commands.run('slide.duplicate');
      const textEl = caretElement(a);
      if (textEl) {
        (document.activeElement as HTMLElement | null)?.blur();
        a.selection.set('elements', [textEl]);
      }
      const els = selectedElements(a);
      if (els.length) await duplicateElements(a, els);
      else await a.commands.run('slide.duplicate');
    },
  });

  const onClip = (ev: ClipboardEvent) => {
    if (ev.defaultPrevented || !ready(app)) return;
    if (ev.type === 'paste' && (onSlide(app) || app.region() === 'text')) {
      const data = ev.clipboardData;
      const text = data?.getData('text/plain') ?? '';
      const files = mediaFiles(data);
      if (files.length && !elementsIn(text) && !slidesIn(text)?.length && (onSlide(app) || !text.trim())) {
        ev.preventDefault();
        void c.run('edit.paste', files).catch(fail);
        return;
      }
    }
    if (ev.type === 'copy' && app.region() === 'dialog') {
      const formula = app.math.wholeTex();
      const display = app.selection.only();
      if (!formula || !display?.matches('div.math') || !display.contains(formula)) return;
      ev.preventDefault();
      copy(app, [display], ev.clipboardData, (document.activeElement as HTMLTextAreaElement).value);
      return;
    }
    if (!onSlide(app)) return;
    if (ev.type === 'paste') {
      const data = ev.clipboardData;
      const text = [data?.getData('text/plain') ?? '', markedHtml(data?.getData('text/html') ?? '')].find((t) => elementsIn(t) || slidesIn(t)?.length);
      if (!text) return;
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
