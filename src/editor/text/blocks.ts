// the structure of the text of a slide, as in PowerPoint and Keynote: Return splits a paragraph or
// a list item at the caret, Backspace at the start of a block joins it to the block before, and
// Delete at its end joins the block after to it. Tab and Shift+Tab change the level of a list item,
// i.e. move it into a list in the item before or out of its list, and a list is switched between
// the dash of ul, the numbers of ol, and paragraphs. a block of the file, e.g. an li of a ul, is
// split, joined, and retagged through app.doc, and a nested item, which is part of the content of
// the block around it, is changed as that content. each command is one entry of the history.
//
// a place in a text is given as a visible offset, i.e. the characters of the text nodes before it,
// with a formula, a br, and an img counted as one, since a formula is typeset again from its TeX
// after each change and its nodes are then new

import type { App } from '../app.ts';
import { mathLookup } from '../math.ts';
import { tokenize } from '../tokens.ts';
import { isRuntimeClass } from '../render.ts';
import { renderTag, type TagEdit } from '../tags.ts';
import { textStyle } from '../model/templates.ts';
import { injectStyle } from '../ui/dom.ts';

// an empty item gets a line to put the caret on, after the dash drawn by its ::before
const CSS = `
html.beeson-editing .reveal li[contenteditable="true"]:empty::after { content: "\\200b"; }
`;

const ATOM = 'mjx-container, br, img';
const LIST = 'ul, ol';
const itemsOf = (root: Element): Element[] => [...root.querySelectorAll('li')];

// the text nodes and the atoms of root in order, i.e. the parts that a visible offset counts
function atoms(root: Node): Node[] {
  const out: Node[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (n.nodeType === Node.TEXT_NODE) return n.parentElement?.closest('mjx-container') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      return (n as Element).matches(ATOM) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n);
  // an atom inside a formula, e.g. an img of its rendering, is part of the formula
  return out.filter((n) => !n.parentElement?.closest('mjx-container'));
}

const indexOf = (n: Node) => Array.prototype.indexOf.call(n.parentNode!.childNodes, n) as number;

// the visible offset of the point (node, offset) in root. a point inside a formula is before it
export function offsetIn(root: Node, node: Node, offset: number): number {
  const point = document.createRange();
  point.setStart(node, offset);
  let n = 0;
  for (const a of atoms(root)) {
    if (a instanceof Text) {
      if (a === node) return n + offset;
      if (point.comparePoint(a, a.length) <= 0) n += a.length;
      else return n;
    } else if (point.comparePoint(a.parentNode!, indexOf(a) + 1) <= 0) n += 1;
    else return n;
  }
  return n;
}

// the point at the visible offset n in root, or its end
export function pointAt(root: Node, n: number): [Node, number] {
  let left = Math.max(0, n);
  for (const a of atoms(root)) {
    if (a instanceof Text) {
      if (left <= a.length) return [a, left];
      left -= a.length;
    } else {
      if (left === 0) return [a.parentNode!, indexOf(a)];
      left -= 1;
    }
  }
  return [root, root.childNodes.length];
}

// selects the visible offsets start to end of root, whose block is focused first
export function selectIn(root: Element, start: number, end = start): void {
  const host = root.closest('[contenteditable="true"]') as HTMLElement | null;
  host?.focus({ preventScroll: true });
  const range = document.createRange();
  range.setStart(...pointAt(root, start));
  range.setEnd(...pointAt(root, end));
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

// a range in a block, which a text command works on
export type Target = { host: Element; range: Range };

let last: Target | null = null;

// the range of the window in a block, or the one last seen in the block of app.selection, e.g.
// while a menu has the focus
export function textTarget(app: App): Target | null {
  const sel = window.getSelection();
  if (sel?.rangeCount) {
    const range = sel.getRangeAt(0);
    const host = app.hostOf(range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement);
    if (host && host.contains(range.endContainer)) return { host, range };
  }
  if (last && last.host.isConnected && app.selection.kind === 'text' && app.selection.items[0] === last.host) return last;
  return null;
}

// the content of the part of root in range as HTML, with each formula as its TeX between its
// delimiters, as contentWithTex of math.ts gives a whole block
export function rangeTex(root: Element, range: Range): string {
  const div = document.createElement('div');
  div.append(range.cloneContents());
  const lookup = mathLookup();
  const outer = (m: Element) => !m.parentElement?.closest('mjx-container');
  const live = [...root.querySelectorAll('mjx-container')].filter((m) => outer(m) && range.intersectsNode(m));
  [...div.querySelectorAll('mjx-container')].filter(outer).forEach((c, i) => {
    const info = live[i] ? lookup(live[i]) : null;
    c.replaceWith(document.createTextNode(info ? info.open + info.tex + info.close : c.textContent ?? ''));
  });
  // an inline element cut at the edge of the range is left empty in one of the parts
  for (const el of [...div.querySelectorAll('strong, em, b, i, sup, sub, code, span, a')].reverse()) {
    if (!el.textContent && !el.querySelector(ATOM)) el.remove();
  }
  div.normalize();
  return div.innerHTML;
}

export function rangeOf(root: Node, from: [Node, number] | null, to: [Node, number] | null): Range {
  const r = document.createRange();
  r.selectNodeContents(root);
  if (from) r.setStart(...from);
  if (to) r.setEnd(...to);
  return r;
}

// a detached copy of the content of host with its formulas as TeX, for a change of a nested item
function texCopy(host: Element): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = rangeTex(host, rangeOf(host, null, null));
  return div;
}

const spaceBefore = (n: Node): Text | null => {
  const p = n.previousSibling;
  return p instanceof Text && !p.data.trim() ? p : null;
};

// the white space of the layout of the file, i.e. with a line break, which a space typed in the
// text is not
const LAYOUT_END = /[ \t]*\r?\n\s*$/;
const layoutSpace = (n: Node | null): n is Text => n instanceof Text && !n.data.trim() && /\n/.test(n.data);

// the white space of the layout at the end of el removed
const trimEnd = (el: Element) => {
  while (layoutSpace(el.lastChild)) el.lastChild.remove();
  if (el.lastChild instanceof Text) el.lastChild.data = el.lastChild.data.replace(LAYOUT_END, '');
};

// nothing but white space between the points of r
const blank = (r: Range) => !r.toString().trim() && !r.cloneContents().querySelector(ATOM);

// the classes of a paragraph that is split and joined as a body paragraph. a caption, a subtitle,
// or a footnote is placed by the theme, and Return writes a br in it. a class that reveal.js or the
// editor sets at run time, e.g. visible on a step while every step is shown, is never a style
const PLAIN = /^(small|fragment|fade-[\w-]+|semi-fade-out|current-visible|grow|shrink|strike|highlight-[\w-]+)$/;
const plainClass = (c: string): boolean => PLAIN.test(c) || isRuntimeClass(c);

type Item = {
  host: Element;
  // the li at the caret, which is host or an li inside it, or host for a paragraph
  item: Element;
  nested: boolean;
  range: Range;
};

function itemAt(app: App): Item | null {
  const t = textTarget(app);
  if (!t || t.host.matches('aside.notes')) return null;
  const node = t.range.startContainer;
  const li = (node instanceof Element ? node : node.parentElement)?.closest('li');
  const item = li && t.host.contains(li) ? li : t.host;
  return { host: t.host, item, nested: item !== t.host, range: t.range };
}

// a block of the file that is split and joined: a body paragraph, a subheading, or a list item,
// whose parent takes elements
function structural(app: App, el: Element | null): boolean {
  const pairing = app.pairing;
  if (!el || !pairing?.byLive.has(el) || el.matches('aside.notes')) return false;
  const parent = el.parentElement;
  if (!parent || !pairing.elements.has(parent) || pairing.byLive.has(parent)) return false;
  if (el.localName === 'li') return parent.matches(LIST);
  if (el.localName === 'h3') return true;
  if (el.localName === 'p') return [...el.classList].every(plainClass);
  return false;
}

// the start tag of el as the file has it with its edits, with the tag name tag and edit applied
function startTag(app: App, el: Element, tag = el.localName, edit: TagEdit = {}): string {
  const body = app.doc.elementText(el);
  const start = tokenize(body).find((t) => t.type === 'start');
  if (!start || start.type !== 'start') return `<${tag}>`;
  const open = renderTag(body, start, start.attrs, edit) ?? body.slice(start.start, start.end);
  return open.replace(/^<[\w-]+/, `<${tag}`);
}

// the element after el that is in the file, before which an element after el is inserted
function nextOf(app: App, el: Element): Element | null {
  let n = el.nextElementSibling;
  while (n && !app.pairing?.elements.has(n)) n = n.nextElementSibling;
  return n;
}

const sameKind = (a: Element, b: Element) => (a.localName === 'li') === (b.localName === 'li');

function prevBlock(app: App, el: Element): Element | null {
  const p = el.previousElementSibling;
  return p && structural(app, p) && sameKind(p, el) ? p : null;
}

function nextBlock(app: App, el: Element): Element | null {
  const n = el.nextElementSibling;
  return n && structural(app, n) && sameKind(n, el) ? n : null;
}

type Indent = { base: string; step: string; eol: string };

// the indentation of el in the file, the step of indentation of the file, and its line end
function indentOf(app: App, el: Element): Indent {
  const unit = app.doc.unitText(el);
  const lead = unit.slice(0, unit.indexOf(app.doc.elementText(el)));
  const base = /[ \t]*$/.exec(lead.slice(lead.lastIndexOf('\n') + 1))?.[0] ?? '';
  return { base, step: textStyle(app.source?.text ?? '').step, eol: app.source?.crlf ? '\r\n' : '\n' };
}

export function canSplit(app: App): boolean {
  const at = itemAt(app);
  return !!at && (at.nested || structural(app, at.item));
}

// Return: the item at the caret is split in two, and the caret is put at the start of the second
// part. the second part of a subheading is a body paragraph, and every other second part keeps the
// tag and the attributes of the item, apart from its id. the nested lists of an item go with its
// second part, and a join of the two parts gives the item back
export async function split(app: App): Promise<void> {
  const at = itemAt(app);
  if (!at || !canSplit(app)) return;
  const { host, item, range } = at;
  if (!range.collapsed) range.deleteContents();
  const caret: [Node, number] = [range.startContainer, range.startOffset];
  const head = rangeTex(item, rangeOf(item, null, caret));
  const tail = rangeTex(item, rangeOf(item, caret, null));
  if (at.nested) {
    const k = itemsOf(host).indexOf(item);
    const copy = texCopy(host);
    const li = copy.querySelectorAll('li')[k];
    li.innerHTML = head;
    const second = li.cloneNode(false) as Element;
    second.removeAttribute('id');
    second.innerHTML = tail;
    const space = spaceBefore(li);
    li.after(...(space ? [space.cloneNode()] : []), second);
    await app.doc.setContent(host, copy.innerHTML, 'new paragraph');
    const now = host.querySelectorAll('li')[k + 1];
    if (now) selectIn(now, 0);
    return;
  }
  const tag = item.localName === 'h3' ? 'p' : item.localName;
  const open = item.localName === 'h3' ? '<p>' : startTag(app, item, tag, { attrs: { id: null } });
  await app.doc.setContent(item, head, 'new paragraph');
  const [node] = await app.doc.insert(`${open}${tail}</${tag}>`, item.parentElement!, nextOf(app, item), 'new paragraph');
  selectIn(node, 0);
}

// the item into which the text of a joined block goes: the last item of the nested lists at the
// end of el, or el
function joinTarget(el: Element): Element {
  let t = el;
  for (let list = t.lastElementChild; list?.matches(LIST); list = t.lastElementChild) {
    const li = [...list.children].reverse().find((c) => c.localName === 'li');
    if (!li) break;
    t = li;
  }
  return t;
}

// the end of the text of el, before the white space of the layout at its end
function textEnd(el: Element): [Node, number] {
  let n: Node | null = el.lastChild;
  while (layoutSpace(n)) n = n.previousSibling;
  if (!n) return [el, 0];
  if (n instanceof Text) return [n, n.data.replace(LAYOUT_END, '').length];
  return [el, indexOf(n) + 1];
}

// the content of before with the content after put at the end of its last item. the white space
// before the end tag of before is kept when its last item is nested
function joined(before: Element, after: string): string {
  const copy = texCopy(before);
  const target = joinTarget(copy);
  const space = target !== copy && copy.lastChild instanceof Text && !copy.lastChild.data.trim() ? copy.lastChild.data : '';
  if (space) copy.lastChild!.remove();
  trimEnd(target);
  const tail = document.createElement('template');
  tail.innerHTML = after.replace(/^\s*\n\s*/, '');
  target.append(tail.content);
  return copy.innerHTML + space;
}

async function join(app: App, before: Element, after: Element): Promise<void> {
  const at = offsetIn(before, ...textEnd(joinTarget(before)));
  const content = joined(before, rangeTex(after, rangeOf(after, null, null)));
  await app.doc.setContent(before, content, 'join');
  await app.doc.remove(after, 'join');
  selectIn(before, at);
}

type Join = { kind: 'join'; before: Element; after: Element } | { kind: 'outdent' } | null;

function joinBack(app: App): Join {
  const at = itemAt(app);
  if (!at || !at.range.collapsed) return null;
  if (!blank(rangeOf(at.item, null, [at.range.startContainer, at.range.startOffset]))) return null;
  if (at.nested) return { kind: 'outdent' };
  const before = structural(app, at.item) ? prevBlock(app, at.item) : null;
  return before ? { kind: 'join', before, after: at.item } : null;
}

function joinAhead(app: App): Join {
  const at = itemAt(app);
  if (!at || !at.range.collapsed || at.nested || !structural(app, at.item)) return null;
  if (!blank(rangeOf(at.item, [at.range.startContainer, at.range.startOffset], null))) return null;
  const after = nextBlock(app, at.item);
  return after ? { kind: 'join', before: at.item, after } : null;
}

export const canJoinBack = (app: App): boolean => joinBack(app) !== null;
export const canJoinAhead = (app: App): boolean => joinAhead(app) !== null;

// Backspace at the start of a block joins it to the block before, and at the start of a nested
// item it takes the item out of its list, as Shift+Tab does
export async function joinBackward(app: App): Promise<void> {
  const j = joinBack(app);
  if (j?.kind === 'join') await join(app, j.before, j.after);
  else if (j?.kind === 'outdent') await outdent(app);
}

// Delete at the end of a block joins the block after it to it
export async function joinForward(app: App): Promise<void> {
  const j = joinAhead(app);
  if (j?.kind === 'join') await join(app, j.before, j.after);
}

export function inList(app: App): boolean {
  const at = itemAt(app);
  return !!at && at.item.localName === 'li' && (at.nested || structural(app, at.item));
}

export function canIndent(app: App): boolean {
  const at = itemAt(app);
  if (!at || !inList(app)) return false;
  const before = at.item.previousElementSibling;
  return !!before && before.localName === 'li' && (at.nested || structural(app, before));
}

export function canOutdent(app: App): boolean {
  const at = itemAt(app);
  return !!at && at.nested;
}

// the list at the end of item, which is made of the tag when item does not end with a list
function childList(item: Element, tag: string, indent: Indent | null): Element {
  const end = item.lastElementChild;
  if (end?.matches(LIST) && !(end.nextSibling instanceof Text && end.nextSibling.data.trim())) return end;
  trimEnd(item);
  const list = document.createElement(tag);
  if (indent) item.append(`${indent.eol}${indent.base}${indent.step}`, list, `${indent.eol}${indent.base}`);
  else item.append(list);
  return list;
}

// li appended to list, after white space as that before the first item of list
function appendItem(list: Element, li: Node, indent: Indent | null): void {
  const first = list.querySelector(':scope > li');
  const inner = indent ? `${indent.eol}${indent.base}${indent.step}${indent.step}` : '';
  const space = first ? spaceBefore(first)?.data ?? '' : inner;
  const end = list.lastChild instanceof Text && !list.lastChild.data.trim() ? list.lastChild : null;
  const closing = end?.data ?? (indent ? `${indent.eol}${indent.base}${indent.step}` : '');
  end?.remove();
  list.append(...(space ? [space] : []), li, ...(closing ? [closing] : []));
}

// li taken out of its list with the white space before it. a list left without items is removed
// together with the white space around it
function takeOut(li: Element): void {
  const list = li.parentElement!;
  spaceBefore(li)?.remove();
  li.remove();
  if (list.querySelector(':scope > li')) return;
  const owner = list.parentElement!;
  spaceBefore(list)?.remove();
  list.remove();
  if (!owner.querySelector(`:scope > :is(${LIST})`)) trimEnd(owner);
}

// Tab: the item is put at the end of a list in the item before it, of the type of its own list,
// with its nested items. the first item of a list stays where it is
export async function indent(app: App): Promise<void> {
  const at = itemAt(app);
  if (!at || !canIndent(app)) return;
  const { host, item } = at;
  const offset = offsetIn(item, at.range.startContainer, at.range.startOffset);
  if (at.nested) {
    const k = itemsOf(host).indexOf(item);
    const copy = texCopy(host);
    const li = copy.querySelectorAll('li')[k];
    const before = li.previousElementSibling!;
    const tag = li.parentElement!.localName;
    takeOut(li);
    appendItem(childList(before, tag, null), li, null);
    await app.doc.setContent(host, copy.innerHTML, 'indent');
    const now = host.querySelectorAll('li')[k];
    if (now) selectIn(now, offset);
    return;
  }
  const before = item.previousElementSibling!;
  const ind = indentOf(app, before);
  const copy = texCopy(before);
  const template = document.createElement('template');
  template.innerHTML = app.doc.elementText(item);
  const li = template.content.firstElementChild!;
  appendItem(childList(copy, item.parentElement!.localName, ind), li, ind);
  const k = itemsOf(copy).indexOf(li);
  await app.doc.setContent(before, copy.innerHTML, 'indent');
  await app.doc.remove(item, 'indent');
  const now = before.querySelectorAll('li')[k];
  if (now) selectIn(now, offset);
}

// Shift+Tab: a nested item is put after the item whose list it is in, and the items after it in
// its list go into a list at its end. an item of the first level stays where it is
export async function outdent(app: App): Promise<void> {
  const at = itemAt(app);
  if (!at || !at.nested) return;
  const { host, item } = at;
  const offset = offsetIn(item, at.range.startContainer, at.range.startOffset);
  const k = itemsOf(host).indexOf(item);
  const copy = texCopy(host);
  const li = copy.querySelectorAll('li')[k];
  const list = li.parentElement!;
  const owner = list.parentElement!.closest('li') ?? copy;
  const followers = [...list.children].slice([...list.children].indexOf(li) + 1).filter((c) => c.localName === 'li');
  if (followers.length) {
    const sub = childList(li, list.localName, null);
    for (const f of followers) {
      spaceBefore(f)?.remove();
      appendItem(sub, f, null);
    }
  }
  const space = spaceBefore(li)?.data ?? '';
  takeOut(li);
  if (owner !== copy) {
    owner.after(spaceBefore(owner)?.data ?? space, li);
    await app.doc.setContent(host, copy.innerHTML, 'outdent');
    const now = host.querySelectorAll('li')[k];
    if (now) selectIn(now, offset);
    return;
  }
  // an item of the second level becomes an item of the list of host, after host
  await app.doc.setContent(host, copy.innerHTML, 'outdent');
  const [node] = await app.doc.insert(li.outerHTML, host.parentElement!, nextOf(app, host), 'outdent');
  selectIn(node, offset);
}

export type ListKind = 'none' | 'ul' | 'ol';

// the kind of list at the caret, or null where a list is not set, e.g. in a heading
export function listKind(app: App): ListKind | null {
  const at = itemAt(app);
  if (!at) return null;
  if (at.item.localName === 'li') return at.nested || structural(app, at.item) ? (at.item.parentElement!.localName as ListKind) : null;
  return at.item.localName === 'p' && structural(app, at.item) ? 'none' : null;
}

export function canSetList(app: App, kind: ListKind): boolean {
  const at = itemAt(app);
  const now = listKind(app);
  if (!at || now === null) return false;
  if (kind !== 'none') return true;
  return !at.nested && !at.item.querySelector(LIST);
}

// the list at the caret given the tag of kind. a paragraph becomes a list of one item, and an item
// of the first level becomes a paragraph, which cuts its list in two
export async function setList(app: App, kind: ListKind): Promise<void> {
  const at = itemAt(app);
  const now = listKind(app);
  if (!at || now === null || now === kind || !canSetList(app, kind)) return;
  const { host, item } = at;
  const offset = offsetIn(item, at.range.startContainer, at.range.startOffset);
  if (at.nested) {
    const k = itemsOf(host).indexOf(item);
    const copy = texCopy(host);
    const list = copy.querySelectorAll('li')[k].parentElement!;
    const other = document.createElement(kind);
    for (const a of list.attributes) other.setAttribute(a.name, a.value);
    other.append(...list.childNodes);
    list.replaceWith(other);
    await app.doc.setContent(host, copy.innerHTML, 'list');
    const li = host.querySelectorAll('li')[k];
    if (li) selectIn(li, offset);
    return;
  }
  const parent = item.parentElement!;
  const content = rangeTex(item, rangeOf(item, null, null));
  const { base, step, eol } = indentOf(app, now === 'none' ? item : parent);
  if (now === 'none') {
    // the attributes of the paragraph go to its item, apart from its paragraph style
    const li = startTag(app, item, 'li', { classes: { small: false } });
    const [list] = await app.doc.insert(`<${kind}>${eol}${base}${step}${li}${content}</li>${eol}${base}</${kind}>`, parent, item, 'list');
    await app.doc.remove(item, 'list');
    const first = list.querySelector('li');
    if (first) selectIn(first, offset);
    return;
  }
  if (kind !== 'none') {
    const index = [...parent.children].indexOf(item);
    const list = await app.doc.retag(parent, kind, {}, 'list');
    const li = list.children[index];
    if (li) selectIn(li, offset);
    return;
  }
  const items = [...parent.children];
  const followers = items.slice(items.indexOf(item) + 1).filter((c) => c.localName === 'li');
  const texts = [`${startTag(app, item, 'p')}${content.trim()}</p>`];
  if (followers.length) {
    const rest = followers.map((f) => `${eol}${base}${step}${app.doc.elementText(f)}`).join('');
    texts.push(`${startTag(app, parent)}${rest}${eol}${base}</${parent.localName}>`);
  }
  const [p] = await app.doc.insert(texts, parent.parentElement!, nextOf(app, parent), 'list');
  for (const f of followers) await app.doc.remove(f, 'list');
  await app.doc.remove(item, 'list');
  if (!parent.querySelector(':scope > li')) await app.doc.remove(parent, 'list');
  selectIn(p, offset);
}

export function install(app: App): void {
  injectStyle('blocks', CSS);
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    const host = app.hostOf(range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement);
    if (host && host.contains(range.endContainer)) last = { host, range: range.cloneRange() };
  });
}

// the paragraph styles of a block of the file: a body paragraph, a small paragraph, a subheading,
// a caption, and a footnote, which the theme places at the lower left. Bigger and Smaller step
// along the sizes of the theme, from a footnote of 28 px to a subheading, and a caption is as
// large as a small paragraph
export type ParagraphStyle = 'body' | 'small' | 'subheading' | 'caption' | 'footnote';
export const PARAGRAPH_STYLES: ParagraphStyle[] = ['body', 'small', 'subheading', 'caption', 'footnote'];
const STYLE_TAG: Record<ParagraphStyle, string> = { body: 'p', small: 'p', subheading: 'h3', caption: 'p', footnote: 'div' };
const STYLE_CLASSES = { small: 'small', caption: 'caption', footnote: 'foot' } as const;
const LADDER: ParagraphStyle[] = ['footnote', 'small', 'body', 'subheading'];
const rank = (s: ParagraphStyle) => (s === 'caption' ? 1 : LADDER.indexOf(s));

// the style of a block whose classes are those of a style and of the steps, or null
export function styleOf(app: App, el: Element): ParagraphStyle | null {
  const pairing = app.pairing;
  if (!pairing?.byLive.has(el) || el.matches('aside.notes')) return null;
  const parent = el.parentElement;
  if (!parent || !pairing.elements.has(parent) || pairing.byLive.has(parent)) return null;
  const own = [...el.classList].filter((c) => !plainClass(c) || c === 'small');
  const one = (tag: string, cls: string | null) => el.localName === tag && (cls ? own.length === 1 && own[0] === cls : own.length === 0);
  if (one('h3', null)) return 'subheading';
  if (one('div', 'foot')) return 'footnote';
  if (one('p', 'caption')) return 'caption';
  if (one('p', 'small')) return 'small';
  return one('p', null) ? 'body' : null;
}

// the blocks that a style is set on: the block of the text, or the selected blocks
function styled(app: App): Element[] {
  const t = textTarget(app);
  const list = t ? [t.host] : app.selection.elements();
  return list.filter((el) => styleOf(app, el) !== null);
}

// the style of every block that a style is set on, or null when they differ or there are none
export function paragraphStyle(app: App): ParagraphStyle | null {
  const styles = new Set(styled(app).map((el) => styleOf(app, el)));
  return styles.size === 1 ? [...styles][0] : null;
}

export const canStyle = (app: App): boolean => styled(app).length > 0;

async function restyle(app: App, el: Element, style: ParagraphStyle, caret: number | null): Promise<void> {
  const classes: Record<string, boolean> = {};
  for (const [s, c] of Object.entries(STYLE_CLASSES)) if (el.classList.contains(c) !== (s === style)) classes[c] = s === style;
  const tag = STYLE_TAG[style];
  let node = el;
  if (tag === el.localName) {
    if (Object.keys(classes).length) app.doc.setTag(el, { classes }, 'paragraph style');
  } else node = await app.doc.retag(el, tag, { classes }, 'paragraph style');
  if (caret !== null) selectIn(node, caret);
}

export async function setStyle(app: App, style: ParagraphStyle | ((s: ParagraphStyle) => ParagraphStyle)): Promise<void> {
  const t = textTarget(app);
  const caret = t ? offsetIn(t.host, t.range.startContainer, t.range.startOffset) : null;
  for (const el of styled(app)) {
    const now = styleOf(app, el)!;
    const next = typeof style === 'function' ? style(now) : style;
    if (next !== now) await restyle(app, el, next, caret);
  }
}

// the style one size up or down the ladder, or the same style at its end
export const stepped = (s: ParagraphStyle, up: boolean): ParagraphStyle => LADDER[Math.min(LADDER.length - 1, Math.max(0, rank(s) + (up ? 1 : -1)))];

export const canStep = (app: App, up: boolean): boolean => styled(app).some((el) => {
  const s = styleOf(app, el)!;
  return stepped(s, up) !== s;
});

// the nodes of el before its first nested list, i.e. its own text, and the layout space before the
// list, which is kept at a change of the text
function ownNodes(el: Element): { own: Node[]; list: Element | null } {
  const list = [...el.children].find((c) => c.matches(LIST)) ?? null;
  const own: Node[] = [];
  for (const n of el.childNodes) {
    if (n === list) break;
    own.push(n);
  }
  return { own, list };
}

// the own text of a block or of a list item, without its nested lists, as HTML with each formula as
// its TeX between its delimiters
export function ownTex(el: Element): string {
  const { list } = ownNodes(el);
  const end: [Node, number] | null = list ? [el, [...el.childNodes].indexOf(list)] : null;
  return rangeTex(el, rangeOf(el, null, end)).trim();
}

// html written as the own text of el, a block or a list item inside one, with its nested lists kept,
// through app.doc as the content of its block, as one entry of the history
export async function setOwnTex(app: App, el: Element, html: string, label = 'typing'): Promise<void> {
  const host = app.hostOf(el) ?? el;
  if (html === ownTex(el)) return;
  const copy = texCopy(host);
  const target = el === host ? copy : copy.querySelectorAll('li')[itemsOf(host).indexOf(el)];
  if (!target) return;
  const { own, list } = ownNodes(target);
  const last = own.at(-1);
  const tail = list && last instanceof Text ? /\s*$/.exec(last.data)?.[0] ?? '' : '';
  for (const n of own) n.parentNode?.removeChild(n);
  const holder = document.createElement('div');
  holder.innerHTML = html + tail;
  target.prepend(...holder.childNodes);
  await app.doc.setContent(host, copy.innerHTML, label);
}
