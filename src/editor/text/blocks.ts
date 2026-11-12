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
import { fileIndexes } from '../layers.ts';
import { tokenize } from '../tokens.ts';
import { isRuntimeClass } from '../render.ts';
import { renderTag, type TagEdit } from '../tags.ts';
import { textStyle } from '../model/templates.ts';
import { injectStyle } from '../ui/dom.ts';
import * as flow from './flow.ts';

// an empty item gets a line to put the caret on, after the dash drawn by its ::before, which the
// editor draws as a placeholder and theme/beeson.css takes off in the show
const CSS = `
html.beeson-editing .reveal li[contenteditable="true"]:empty::after, html.beeson-editing .reveal [contenteditable="true"] li:empty::after { content: "\\200b"; }
html.beeson-editor .reveal ul > li:empty::before { content: ""; }
html.beeson-editor .reveal ol > li:empty::before { content: counter(list-item); }
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

// the blocks of the selected elements: a selected block, and each item of a selected list, as on a
// text box selected as an object in Keynote
export function selectedBlocks(app: App): Element[] {
  const pairing = app.pairing;
  if (!pairing) return [];
  return app.selection.elements().flatMap((el) => {
    if (pairing.byLive.has(el)) return el.matches('aside.notes') ? [] : [el];
    return el.matches(LIST) && pairing.elements.has(el) ? [...el.querySelectorAll('li')].filter((li) => pairing.byLive.has(li)) : [];
  });
}

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
  const indexed = '[data-fragment-index]';
  fileIndexes([...root.querySelectorAll(indexed)].filter((el) => range.intersectsNode(el)), [...div.querySelectorAll(indexed)]);
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

// the classes of a paragraph that is split and joined as a body paragraph, with its alignment and
// its ghost. a caption, a subtitle, or a footnote is placed by the theme, and Return writes a br in
// it. a class that reveal.js or the editor sets at run time, e.g. visible on a step while every
// step is shown, is never a style
const PLAIN = /^(small|center|ghost|fragment|fade-[\w-]+|semi-fade-out|current-visible|grow|shrink|strike|highlight-[\w-]+)$/;
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
  // a caret between the items of a list is not in an item
  if ((node instanceof Element ? node : node.parentElement)?.matches(LIST)) return null;
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

// the block before or after el in one text with it, as text/flow.ts reads it: an item of the same
// list, or a paragraph of the same column. a block with a translate of its own is a box apart
export function besideBlock(app: App, el: Element, ahead: boolean): Element | null {
  const n = structural(app, el) ? (ahead ? nextBlock : prevBlock)(app, el) : null;
  return n && !(n as HTMLElement).style.translate && !(el as HTMLElement).style.translate ? n : null;
}

type Indent = { base: string; step: string; eol: string };

// the indentation of el in the file, the step of indentation of the file, and its line end
function indentOf(app: App, el: Element): Indent {
  const unit = app.doc.unitText(el);
  const lead = unit.slice(0, unit.indexOf(app.doc.elementText(el)));
  const base = /[ \t]*$/.exec(lead.slice(lead.lastIndexOf('\n') + 1))?.[0] ?? '';
  return { base, step: textStyle(app.source?.text ?? '').step, eol: app.source?.crlf ? '\r\n' : '\n' };
}

// the attribute start of the items of a numbered list after its item k, cut off from it, so that
// they go on with its count, as the items after a cut list of Keynote do
function goOn(list: Element, k: number): Record<string, string | null> {
  if (!(list instanceof HTMLOListElement)) return {};
  const n = list.start + k;
  return { start: n === 1 ? null : String(n) };
}

// each numbered list cut off by the editor, whose start goes on at every change with the count of
// the list before it as the page has it, until a start is entered into Start at
const cutOff = new WeakSet<Element>();

function keepCounts(app: App): void {
  for (const ol of app.slides().querySelectorAll('ol')) {
    if (!cutOff.has(ol) || !(ol instanceof HTMLOListElement)) continue;
    let first = ol.previousElementSibling;
    while (first && !first.matches('ol, ul')) first = first.previousElementSibling;
    // 1 after a dash list or without a list before
    const n = first instanceof HTMLOListElement ? first.start + first.querySelectorAll(':scope > li').length : 1;
    if (n !== ol.start) app.doc.setTag(ol, { attrs: { start: n === 1 ? null : String(n) } }, 'start at');
  }
}

// second, the list made of the items of list after its item k, goes on with the count of list
// when item k is not its first item. otherwise list is taken off, and second keeps its start, or
// goes on with the list before as list did
function goesOn(list: Element, second: Element | undefined, k: number): void {
  if (list instanceof HTMLOListElement && second && (k > 0 || cutOff.has(list))) cutOff.add(second);
}

// a list of the file at the level of the blocks, e.g. the ul of a slide or of its div.col
const fileList = (app: App, el: Element | null): el is Element => !!el?.matches(LIST) && !!app.pairing?.elements.has(el) && !app.pairing.byLive.has(el);

// the attributes of the start tag of list in the file, apart from start
function listAttrs(app: App, list: Element): string {
  const start = tokenize(app.doc.elementText(list)).find((t) => t.type === 'start');
  return start?.type === 'start' ? start.attrs.filter((a) => a.name !== 'start').map((a) => `${a.name}=${a.value ?? ''}`).sort().join(' ') : '';
}

function prevOf(app: App, el: Element): Element | null {
  let n = el.previousElementSibling;
  while (n && !app.pairing?.elements.has(n)) n = n.previousElementSibling;
  return n;
}

// els taken off the page in order, after which the lists before and after each text of the flow of
// their column are one list when they have one tag and the same attributes apart from start, as a
// list of Keynote and PowerPoint is a run of paragraphs. the items of the second list are moved to
// the end of the first, which drops its start
export async function removeJoining(app: App, els: Element[], label: string): Promise<void> {
  const around: [Element | null, Element | null][] = [];
  for (const el of els) {
    // an element out of the flow of the column, e.g. a figure of the zone, is not between the lists
    const inFlow = el.matches('p, h1, h2, h3, h4, h5, h6, ul, ol, div.math, blockquote, pre') && !/^(absolute|fixed)$/.test(getComputedStyle(el).position);
    around.push(inFlow ? [prevOf(app, el), nextOf(app, el)] : [null, null]);
    await app.doc.remove(el, label);
  }
  // a list joined into the list before it, for the joins after it
  const into = new Map<Element, Element>();
  for (let [first, second] of around) {
    while (first && into.has(first)) first = into.get(first)!;
    if (!fileList(app, first) || !fileList(app, second) || !first.isConnected || !second.isConnected || first.localName !== second.localName) continue;
    // a locked list does not take items, and is not taken off
    if (first.closest('[data-locked]') || second.closest('[data-locked]')) continue;
    if (nextOf(app, first) !== second || listAttrs(app, first) !== listAttrs(app, second)) continue;
    const items = [...second.children].filter((c) => c.localName === 'li' && app.pairing?.elements.has(c));
    const end = first.lastChild instanceof Text && !first.lastChild.data.trim() ? first.lastChild : null;
    await app.doc.insert(items.map((li) => app.doc.elementText(li)), first, end, label);
    await app.doc.remove(second, label);
    into.set(second, first);
  }
}

// the tag edit of a list made of kind. a ul does not take the attribute start of a numbered list,
// and an ol does not take the class of a mark
const listEdit = (kind: ListKind): TagEdit => ({ ...(kind === 'ol' ? {} : { attrs: { start: null } }), classes: { dots: kind === 'dots', arrows: kind === 'arrows' } });

// the list of the page el made of kind, retagged only where its tag changes
async function relist(app: App, el: Element, kind: ListKind): Promise<Element> {
  if (el.localName !== tagOf(kind)) return app.doc.retag(el, tagOf(kind), listEdit(kind), 'list');
  app.doc.setTag(el, listEdit(kind), 'list');
  return el;
}

// list, an element of a copy of a block, made of kind in place, with its other attributes kept
function markList(list: Element, kind: ListKind): void {
  let out = list;
  if (list.localName !== tagOf(kind)) {
    out = document.createElement(tagOf(kind));
    for (const a of list.attributes) out.setAttribute(a.name, a.value);
    out.append(...list.childNodes);
    list.replaceWith(out);
  }
  for (const m of MARKS) out.classList.toggle(m, m === kind);
  if (!out.classList.length) out.removeAttribute('class');
  if (kind !== 'ol') out.removeAttribute('start');
}

// the numbered list of the caret, or the one numbered list selected as an object
export function startList(app: App): HTMLOListElement | null {
  const blocks = listBlocks(app);
  const el = blocks ? (blocks.length === 1 ? blocks[0] : null) : itemAt(app)?.item.parentElement ?? null;
  return el instanceof HTMLOListElement && !!app.pairing?.elements.has(el) && !app.pairing.byLive.has(el) ? el : null;
}

// Start At of the Text pane: the number of the first item of the numbered list, written as start,
// which a 1 takes off. the shown number entered keeps the start of a cut-off list
export function setStart(app: App, n: number): void {
  const list = startList(app);
  if (!list || !Number.isInteger(n) || n < 1 || (n === list.start && !cutOff.has(list))) return;
  if (n !== list.start) app.doc.setTag(list, { attrs: { start: n === 1 ? null : String(n) } }, 'start at');
  if (!cutOff.delete(list)) return;
  app.history.push({ label: 'start at', undo: () => void cutOff.add(list), redo: () => void cutOff.delete(list) });
}

export function canSplit(app: App): boolean {
  const at = itemAt(app);
  return !!at && (at.nested || structural(app, at.item));
}

// the function that puts the caret at the visible offset at of el, unless the focus is in a text
// outside the slides at its call, e.g. a field of a pane, which keeps it
const caretAt = (app: App, el: Element, at = 0) => () => {
  const a = document.activeElement;
  if (!a?.matches('input, textarea, [contenteditable="true"]') || app.slides().contains(a)) selectIn(el, at);
};

// Return: the item at the caret is split in two, and the caret is put at the start of the second
// part. the second part of a subheading is a body paragraph, and every other second part keeps the
// tag and the attributes of the item, apart from its id. the nested lists of an item go with its
// second part, and a join of the two parts gives the item back
export async function split(app: App): Promise<void> {
  const at = itemAt(app);
  if (!at || !canSplit(app)) return;
  const { host, item, range } = at;
  // Return on an empty item moves it out one level, and on the first level takes the item off its
  // list as a paragraph, as in Keynote and PowerPoint. the items after it go into a list of their
  // own after the paragraph, with the attributes of their list apart from its id
  if (item.localName === 'li' && !item.textContent?.trim() && !item.querySelector('mjx-container, img, ul, ol')) {
    if (at.nested) {
      // the caret goes back into the empty nested item at an undo, and into the item made of it at a
      // redo. an item of host is found again by its index, since its content is replaced
      const place = (el: Element | null) => {
        if (!el || !host.contains(el)) return el && caretAt(app, el);
        const i = itemsOf(host).indexOf(el);
        return () => {
          const li = itemsOf(host)[i];
          if (li) caretAt(app, li)();
        };
      };
      let done = false;
      const kept = app.history.keep(() => place(done ? (itemAt(app)?.item ?? null) : item));
      await outdent(app);
      done = true;
      return kept();
    }
    const list = item.parentElement!;
    const items = [...list.children].filter((c) => c.localName === 'li');
    const followers = items.slice(items.indexOf(item) + 1);
    // a paragraph after items of a moved list is moved with them, so that it is not drawn over them
    const move = list.querySelector(':scope > li') !== item && (list as HTMLElement).style.translate;
    const texts = [move ? `<p style="translate: ${move}"></p>` : '<p></p>'];
    // an undo puts the caret into the empty item, and a redo into the paragraph
    let to = item;
    const kept = app.history.keep(() => caretAt(app, to));
    if (followers.length) {
      const { base, step, eol } = indentOf(app, list);
      const rest = followers.map((f) => `${eol}${base}${step}${app.doc.elementText(f)}`).join('');
      texts.push(`${startTag(app, list, list.localName, { attrs: { id: null, ...goOn(list, items.indexOf(item)) } })}${rest}${eol}${base}</${list.localName}>`);
    }
    const [p, second] = await app.doc.insert(texts, list.parentElement!, nextOf(app, list), 'new paragraph');
    goesOn(list, second, items.indexOf(item));
    for (const f of followers) await app.doc.remove(f, 'new paragraph');
    await app.doc.remove(list.querySelectorAll(':scope > li').length > 1 ? item : list, 'new paragraph');
    selectIn(p, 0);
    to = p;
    return kept();
  }
  // a selected text is taken off in an entry of its own, which the undo reads before the change
  if (!range.collapsed) {
    app.history.beforeTyping(host, 'new paragraph');
    range.deleteContents();
    app.history.afterTyping(host);
    app.history.break();
  }
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
    // the items of host are found again by their index, since its content is replaced
    const off = offsetIn(item, ...caret);
    let done = false;
    const nth = (i: number, at = 0) => () => {
      const el = itemsOf(host)[i];
      if (el) caretAt(app, el, at)();
    };
    const kept = app.history.keep(() => (done ? nth(k + 1) : nth(k, off)));
    await app.doc.setContent(host, copy.innerHTML, 'new paragraph');
    const now = host.querySelectorAll('li')[k + 1];
    if (now) selectIn(now, 0);
    done = true;
    return kept();
  }
  const tag = item.localName === 'h3' ? 'p' : item.localName;
  const open = item.localName === 'h3' ? '<p>' : startTag(app, item, tag, { attrs: { id: null } });
  // an undo puts the caret back into the item, and a redo at the start of the second part
  const off = offsetIn(item, ...caret);
  let second: Element | null = null;
  const kept = app.history.keep(() => (second ? caretAt(app, second) : caretAt(app, item, off)));
  await app.doc.setContent(item, head, 'new paragraph');
  [second] = await app.doc.insert(`${open}${tail}</${tag}>`, item.parentElement!, nextOf(app, item), 'new paragraph');
  selectIn(second, 0);
  kept();
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

// the visible offset of the end of the text of el, in its last nested item
export const endOf = (el: Element): number => offsetIn(el, ...textEnd(joinTarget(el)));

async function join(app: App, before: Element, after: Element): Promise<void> {
  const at = endOf(before);
  const content = joined(before, rangeTex(after, rangeOf(after, null, null)));
  await app.doc.setContent(before, content, 'join');
  await app.doc.remove(after, 'join');
  selectIn(before, at);
}

type Join = { kind: 'join'; before: Element; after: Element } | { kind: 'outdent' } | { kind: 'unlist'; item: Element } | { kind: 'drop'; item: Element; to: Element; end: boolean } | null;

const empty = (el: Element) => !el.textContent?.trim() && !el.querySelector('mjx-container, img');
const liOf = (list: Element) => [...list.children].filter((c) => c.localName === 'li');

function joinBack(app: App): Join {
  const at = itemAt(app);
  if (!at || !at.range.collapsed) return null;
  if (!blank(rangeOf(at.item, null, [at.range.startContainer, at.range.startOffset]))) return null;
  if (at.nested) return { kind: 'outdent' };
  if (!structural(app, at.item)) return null;
  const before = prevBlock(app, at.item);
  if (before) return { kind: 'join', before, after: at.item };
  // a paragraph after a list is taken off, with its text joined onto the last item, as in Keynote.
  // a locked list is left alone, and so is the paragraph after it
  const list = at.item.localName === 'p' ? prevOf(app, at.item) : null;
  const last = fileList(app, list) && !list.closest('[data-locked]') ? liOf(list).at(-1) : null;
  if (last) return { kind: 'drop', item: at.item, to: last, end: true };
  // the first item of a list has its dash taken off, as in Keynote and PowerPoint
  return at.item.localName === 'li' && !at.item.previousElementSibling ? { kind: 'unlist', item: at.item } : null;
}

// what Backspace does at the caret, for the name of its entry
export const joinKind = (app: App): 'join' | 'outdent' | 'unlist' | 'drop' | null => joinBack(app)?.kind ?? null;

// the first item of a list made a paragraph before the list, with the attributes of the item. the
// items of its nested lists take its place in the list. an undo puts the caret at the start of the
// item, and a redo at the start of the paragraph
async function unlist(app: App, li: Element): Promise<void> {
  const list = li.parentElement!;
  let at = li;
  const kept = app.history.keep(() => {
    const el = at;
    return () => selectIn(el, 0);
  });
  const [p] = await app.doc.insert(`${startTag(app, li, 'p')}${ownTex(li)}</p>`, list.parentElement!, list, 'list');
  const subs = [...texCopy(li).querySelectorAll(':scope > :is(ul, ol) > li')].map((s) => s.outerHTML);
  if (subs.length) await app.doc.insert(subs, list, li, 'list');
  await app.doc.remove(list.querySelectorAll(':scope > li').length > 1 ? li : list, 'list');
  selectIn(p, 0);
  at = p;
  kept();
}

function joinAhead(app: App): Join {
  const at = itemAt(app);
  if (!at || !at.range.collapsed || at.nested || !structural(app, at.item)) return null;
  if (!blank(rangeOf(at.item, [at.range.startContainer, at.range.startOffset], null))) return null;
  const after = nextBlock(app, at.item);
  if (after) return { kind: 'join', before: at.item, after };
  // an empty paragraph before a list is taken off, with the caret at the start of the list, unless
  // the list is locked
  const list = at.item.localName === 'p' && empty(at.item) ? nextOf(app, at.item) : null;
  const first = fileList(app, list) && !list.closest('[data-locked]') ? liOf(list)[0] : null;
  return first ? { kind: 'drop', item: at.item, to: first, end: false } : null;
}

// item, a paragraph next to a list, taken off with its text joined onto the item to, after which
// the lists around it are joined. the caret goes to the end of the text of to, or with end false to
// its start. an undo puts the caret at the start of item
async function drop(app: App, item: Element, to: Element, end: boolean): Promise<void> {
  const at = end ? endOf(to) : 0;
  let done = false;
  const kept = app.history.keep(() => (done ? caretAt(app, to, at) : caretAt(app, item)));
  if (!empty(item)) await app.doc.setContent(to, joined(to, rangeTex(item, rangeOf(item, null, null))), 'join');
  // with end false, to is in the list after item, whose items are copied into the list before it
  const first = end ? null : prevOf(app, item);
  const n = fileList(app, first) ? liOf(first).length : 0;
  await removeJoining(app, [item], 'join');
  if (!to.isConnected && first) to = liOf(first)[n] ?? to;
  selectIn(to, at);
  done = true;
  kept();
}

export const canJoinBack = (app: App): boolean => joinBack(app) !== null;
export const canJoinAhead = (app: App): boolean => joinAhead(app) !== null;

// Backspace at the start of a block joins it to the block before, at the start of a nested item it
// takes the item out of its list, as Shift+Tab does, and at the start of a first item of a list it
// takes the dash off the item
export async function joinBackward(app: App): Promise<void> {
  const j = joinBack(app);
  if (j?.kind === 'join') await join(app, j.before, j.after);
  else if (j?.kind === 'outdent') await outdent(app);
  else if (j?.kind === 'unlist') await unlist(app, j.item);
  else if (j?.kind === 'drop') await drop(app, j.item, j.to, j.end);
}

// Delete at the end of a block joins the block after it to it, and in an empty paragraph before a
// list takes the paragraph off
export async function joinForward(app: App): Promise<void> {
  const j = joinAhead(app);
  if (j?.kind === 'join') await join(app, j.before, j.after);
  else if (j?.kind === 'drop') await drop(app, j.item, j.to, j.end);
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

// the list at the end of item, which is made like the list from when item does not end with a list
function childList(item: Element, from: Element, indent: Indent | null): Element {
  const end = item.lastElementChild;
  if (end?.matches(LIST) && !(end.nextSibling instanceof Text && end.nextSibling.data.trim())) return end;
  trimEnd(item);
  // the tag and the mark of the list from
  const list = document.createElement(from.localName);
  const mark = kindOf(from);
  if (tagOf(mark) !== mark) list.className = mark;
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
    const from = li.parentElement!;
    takeOut(li);
    appendItem(childList(before, from, null), li, null);
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
  appendItem(childList(copy, item.parentElement!, ind), li, ind);
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
    const sub = childList(li, list, null);
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

// a list of dashes, dots, or arrows is a ul, the last two with the class of their mark
export type ListKind = 'none' | 'ul' | 'dots' | 'arrows' | 'ol';
const MARKS = ['dots', 'arrows'] as const;
const tagOf = (kind: ListKind): string => (kind === 'dots' || kind === 'arrows' ? 'ul' : kind);
export const openList = (kind: ListKind): string => (tagOf(kind) === kind ? `<${kind}>` : `<ul class="${kind}">`);

// the kind of the list element list
export function kindOf(list: Element): ListKind {
  if (list.localName === 'ol') return 'ol';
  return MARKS.find((m) => list.classList.contains(m)) ?? 'ul';
}

// the kind of list of a block selected as an element: a body paragraph, or a list of the file that
// is not inside a block, e.g. the ul of a slide or of its div.col
function blockList(app: App, el: Element): ListKind | null {
  if (el.localName === 'p') return structural(app, el) ? 'none' : null;
  const pairing = app.pairing;
  const parent = el.parentElement;
  if (!el.matches(LIST) || !pairing?.elements.has(el) || pairing.byLive.has(el) || !parent || !pairing.elements.has(parent) || pairing.byLive.has(parent)) return null;
  return kindOf(el);
}

// the blocks selected as elements, each of which a list is set on as a whole, as on a text box
// selected as an object in Keynote, or null when a selected element is not such a block
function listBlocks(app: App): Element[] | null {
  if (app.selection.kind !== 'elements') return null;
  const els = app.selection.elements();
  return els.length && els.every((el) => blockList(app, el) !== null) ? els : null;
}

// the kind of list at the caret or of the selected blocks, or null where a list is not set, e.g. in
// a heading, or where the selected blocks differ
export function listKind(app: App): ListKind | null {
  const blocks = listBlocks(app);
  if (blocks) {
    const kinds = new Set(blocks.map((el) => blockList(app, el)));
    return kinds.size === 1 ? [...kinds][0] : null;
  }
  const at = itemAt(app);
  if (!at) return null;
  if (at.item.localName === 'li') return at.nested || structural(app, at.item) ? kindOf(at.item.parentElement!) : null;
  return at.item.localName === 'p' && structural(app, at.item) ? 'none' : null;
}

export function canSetList(app: App, kind: ListKind): boolean {
  // a list with a nested list is not made paragraphs, since the nested items would be lost
  const blocks = listBlocks(app);
  if (blocks) return kind !== 'none' || blocks.every((el) => !el.querySelector('li :is(ul, ol)'));
  const at = itemAt(app);
  const now = listKind(app);
  if (!at || now === null) return false;
  if (kind !== 'none') return true;
  return !at.nested && !at.item.querySelector(LIST);
}

// why a list is not set on the selection, or null without a block
export function listWhy(app: App, label: string): string | null {
  const el = textTarget(app)?.host ?? app.selection.elements()[0];
  if (!el) return null;
  if (el.matches('h1, h2, h3, h4')) return `${label} is not available on a heading, since only a paragraph or a list item is set as a list`;
  if (el.matches('td, th')) return `${label} is not available in a table, since a cell of the theme does not hold a list`;
  if (el.querySelector('li :is(ul, ol)') || itemAt(app)?.item.querySelector(LIST)) return `${label} is not available, since the nested items of the list would be lost`;
  return `${label} is not available on this block, since only a paragraph or a list item is set as a list`;
}

// the list at the caret given the tag of kind. a paragraph becomes a list of one item, and an item
// of the first level becomes a paragraph, which cuts its list in two
export async function setList(app: App, kind: ListKind): Promise<void> {
  const blocks = listBlocks(app);
  if (blocks) return setBlockList(app, blocks, kind);
  if (flow.active() && (await setSpanList(app, kind))) return;
  const at = itemAt(app);
  const now = listKind(app);
  if (!at || now === null || now === kind || !canSetList(app, kind)) return;
  const { host, item } = at;
  const offset = offsetIn(item, at.range.startContainer, at.range.startOffset);
  // the selected text is selected again in the block made
  const stop = item.contains(at.range.endContainer) ? offsetIn(item, at.range.endContainer, at.range.endOffset) : offset;
  if (at.nested) {
    const k = itemsOf(host).indexOf(item);
    const copy = texCopy(host);
    markList(copy.querySelectorAll('li')[k].parentElement!, kind);
    await app.doc.setContent(host, copy.innerHTML, 'list');
    const li = host.querySelectorAll('li')[k];
    if (li) selectIn(li, offset, stop);
    return;
  }
  const parent = item.parentElement!;
  const content = rangeTex(item, rangeOf(item, null, null));
  const { base, step, eol } = indentOf(app, now === 'none' ? item : parent);
  if (now === 'none') {
    // the attributes of the paragraph go to its item, apart from its paragraph style
    const li = startTag(app, item, 'li', { classes: { small: false } });
    const [list] = await app.doc.insert(`${openList(kind)}${eol}${base}${step}${li}${content}</li>${eol}${base}</${tagOf(kind)}>`, parent, item, 'list');
    await app.doc.remove(item, 'list');
    const first = list.querySelector('li');
    if (first) selectIn(first, offset, stop);
    return;
  }
  if (kind !== 'none') {
    const index = [...parent.children].indexOf(item);
    const list = await relist(app, parent, kind);
    const li = list.children[index];
    if (li) selectIn(li, offset, stop);
    return;
  }
  const items = [...parent.children];
  const followers = items.slice(items.indexOf(item) + 1).filter((c) => c.localName === 'li');
  const texts = [`${startTag(app, item, 'p')}${content.trim()}</p>`];
  if (followers.length) {
    const rest = followers.map((f) => `${eol}${base}${step}${app.doc.elementText(f)}`).join('');
    const k = items.filter((c) => c.localName === 'li').indexOf(item);
    texts.push(`${startTag(app, parent, parent.localName, { attrs: { id: null, ...goOn(parent, k) } })}${rest}${eol}${base}</${parent.localName}>`);
  }
  const [p, second] = await app.doc.insert(texts, parent.parentElement!, nextOf(app, parent), 'list');
  goesOn(parent, second, items.filter((c) => c.localName === 'li').indexOf(item));
  for (const f of followers) await app.doc.remove(f, 'list');
  await app.doc.remove(item, 'list');
  if (!parent.querySelector(':scope > li')) await app.doc.remove(parent, 'list');
  selectIn(p, offset, stop);
}

// a list style on a text selected over items of one list of the first level: the list is retagged,
// or its items are made paragraphs, and the same text is selected after it. false where the span
// is not over such items
async function setSpanList(app: App, kind: ListKind): Promise<boolean> {
  const p = flow.places(app);
  const run = flow.spanTargets(app).map((t) => t.host);
  const list = run[0]?.parentElement;
  if (p && list && run.every((h) => h.localName === 'p' && h.parentElement === list && structural(app, h))) return spanParagraphs(app, run, p, kind);
  if (!p || !list?.matches(LIST) || !run.every((h) => h.localName === 'li' && h.parentElement === list && structural(app, h))) return false;
  if (kindOf(list) === kind || (kind === 'none' && run.some((h) => h.querySelector(LIST)))) return true;
  const [a, f] = p.map(([el, at]) => [run.indexOf(el), at] as const);
  const items = [...list.children].filter((c) => c.localName === 'li');
  let made: Element[];
  if (kind !== 'none') {
    const now = await relist(app, list, kind);
    const kids = [...now.children].filter((c) => c.localName === 'li');
    made = run.map((h) => kids[items.indexOf(h)]);
  } else {
    const { base, step, eol } = indentOf(app, list);
    const followers = items.slice(items.indexOf(run[run.length - 1]) + 1);
    const texts = run.map((li) => `${startTag(app, li, 'p')}${rangeTex(li, rangeOf(li, null, null)).trim()}</p>`);
    if (followers.length) {
      const rest = followers.map((f) => `${eol}${base}${step}${app.doc.elementText(f)}`).join('');
      texts.push(`${startTag(app, list, list.localName, { attrs: { id: null, ...goOn(list, items.indexOf(run[0])) } })}${rest}${eol}${base}</${list.localName}>`);
    }
    const inserted = await app.doc.insert(texts, list.parentElement!, nextOf(app, list), 'list');
    if (followers.length) goesOn(list, inserted.at(-1), items.indexOf(run[0]));
    made = inserted.slice(0, run.length);
    for (const el of [...followers, ...run]) await app.doc.remove(el, 'list');
    if (!list.querySelector(':scope > li')) await app.doc.remove(list, 'list');
  }
  if (made[a[0]] && made[f[0]]) flow.select(app, [made[a[0]], a[1]], [made[f[0]], f[1]]);
  return true;
}

// a span over body paragraphs of one parent made one list of kind, with an item for each paragraph
async function spanParagraphs(app: App, run: Element[], p: [flow.Place, flow.Place], kind: ListKind): Promise<boolean> {
  if (kind === 'none') return true;
  const { base, step, eol } = indentOf(app, run[0]);
  const items = run.map((el) => `${eol}${base}${step}${startTag(app, el, 'li', { classes: { small: false } })}${rangeTex(el, rangeOf(el, null, null))}</li>`).join('');
  const [list] = await app.doc.insert(`${openList(kind)}${items}${eol}${base}</${tagOf(kind)}>`, run[0].parentElement!, run[0], 'list');
  for (const el of run) await app.doc.remove(el, 'list');
  const made = [...list.children].filter((c) => c.localName === 'li');
  const [a, f] = p.map(([el, at]) => [made[run.indexOf(el)], at] as const);
  if (a[0] && f[0]) flow.select(app, [a[0], a[1]], [f[0], f[1]]);
  return true;
}

// each selected block given the list of kind as a whole: a paragraph becomes a list of one item, a
// list is retagged, and each item of a list becomes a paragraph with the attributes of the item.
// the blocks made are selected, and the blocks before them again after an undo
function setBlockList(app: App, blocks: Element[], kind: ListKind): Promise<void> {
  if (!canSetList(app, kind)) return Promise.resolve();
  return app.history.selecting('List', () => listBlocksAs(app, blocks, kind));
}

async function listBlocksAs(app: App, blocks: Element[], kind: ListKind): Promise<void> {
  const made: Element[] = [];
  for (const el of blocks) {
    const now = blockList(app, el);
    if (now === kind) made.push(el);
    else if (now === 'none') {
      const { base, step, eol } = indentOf(app, el);
      const li = startTag(app, el, 'li', { classes: { small: false } });
      const content = rangeTex(el, rangeOf(el, null, null));
      made.push(...(await app.doc.insert(`${openList(kind)}${eol}${base}${step}${li}${content}</li>${eol}${base}</${tagOf(kind)}>`, el.parentElement!, el, 'list')));
      await app.doc.remove(el, 'list');
    } else if (kind !== 'none') made.push(await relist(app, el, kind));
    else {
      const texts = [...el.children].filter((c) => c.localName === 'li').map((li) => `${startTag(app, li, 'p')}${rangeTex(li, rangeOf(li, null, null)).trim()}</p>`);
      made.push(...(await app.doc.insert(texts, el.parentElement!, nextOf(app, el), 'list')));
      await app.doc.remove(el, 'list');
    }
    if (tagOf(kind) === 'ul') await markNested(app, made.at(-1)!, kind);
  }
  app.selection.set('elements', made);
}

// the nested ul lists of the list block made of kind, as a text box of PowerPoint takes a bullet at
// every level. a nested ol is kept
async function markNested(app: App, block: Element, kind: ListKind): Promise<void> {
  for (const li of block.querySelectorAll(':scope > li')) {
    if ([...li.querySelectorAll('ul')].every((ul) => kindOf(ul) === kind)) continue;
    const copy = texCopy(li);
    for (const ul of copy.querySelectorAll('ul')) markList(ul, kind);
    await app.doc.setContent(li, copy.innerHTML, 'list');
  }
}

export function install(app: App): void {
  injectStyle('blocks', CSS);
  app.history.onSettle(() => keepCounts(app));
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
  if (one('p', 'small') || one('li', 'small')) return 'small';
  return one('p', null) || one('li', null) ? 'body' : null;
}

// the blocks that a style is set on: the blocks of a text selected over several of them, the block
// of the text, or the selected blocks
function chosen(app: App): Element[] {
  const spanned = flow.spanTargets(app).map((t) => t.host);
  const t = spanned.length ? null : textTarget(app);
  return spanned.length ? spanned : t ? [t.host] : selectedBlocks(app);
}

const styled = (app: App): Element[] => chosen(app).filter((el) => styleOf(app, el) !== null);

// a list item takes the styles that are a class on its tag, i.e. Body and Small
const ITEM_STYLES: ParagraphStyle[] = ['body', 'small'];
export const fits = (el: Element, style: ParagraphStyle): boolean => el.localName !== 'li' || ITEM_STYLES.includes(style);

// the style of every chosen block, or null when they differ, e.g. on a heading and a paragraph, as
// the menu of Keynote does not check a style over blocks of different styles
export function paragraphStyle(app: App): ParagraphStyle | null {
  const styles = new Set(chosen(app).map((el) => styleOf(app, el)));
  return styles.size === 1 ? [...styles][0] : null;
}

export const canStyle = (app: App, style?: ParagraphStyle): boolean => styled(app).some((el) => !style || fits(el, style));

async function restyle(app: App, el: Element, style: ParagraphStyle, kept: [number, number] | null): Promise<Element> {
  const classes: Record<string, boolean> = {};
  for (const [s, c] of Object.entries(STYLE_CLASSES)) if (el.classList.contains(c) !== (s === style)) classes[c] = s === style;
  const tag = el.localName === 'li' ? 'li' : STYLE_TAG[style];
  let node = el;
  if (tag === el.localName) {
    if (Object.keys(classes).length) app.doc.setTag(el, { classes }, 'paragraph style');
  } else node = await app.doc.retag(el, tag, { classes }, 'paragraph style');
  if (kept) selectIn(node, ...kept);
  return node;
}

// the style set on the block of the text, whose selection is kept, or on the selected blocks, which
// are selected again after a retag, and after an undo and a redo
export async function setStyle(app: App, style: ParagraphStyle | ((s: ParagraphStyle) => ParagraphStyle)): Promise<void> {
  const spanned = flow.active() ? flow.places(app) : null;
  const t = spanned ? null : textTarget(app);
  const kept: [number, number] | null = t && [offsetIn(t.host, t.range.startContainer, t.range.startOffset), offsetIn(t.host, t.range.endContainer, t.range.endOffset)];
  const blocks = styled(app);
  const each = async () => {
    const made: Element[] = [];
    for (const el of blocks) {
      const now = styleOf(app, el)!;
      const next = typeof style === 'function' ? style(now) : style;
      made.push(next !== now && fits(el, next) ? await restyle(app, el, next, kept) : el);
    }
    return made;
  };
  if (spanned) {
    // a retag makes a new element of a block of the span, in which its place is kept
    const made = await each();
    const place = ([el, at]: [Element, number]): [Element, number] => [made[blocks.indexOf(el)] ?? el, at];
    return flow.select(app, place(spanned[0]), place(spanned[1]));
  }
  if (t) return void (await each());
  await app.history.selecting('Paragraph Style', async () => {
    const made = await each();
    if (made.length) app.selection.set('elements', made);
  });
}

// why a style or a step of the size is not set on the blocks of the selection, by the scope rule,
// or null without a block
export function styleWhy(app: App, label: string, up?: boolean): string | null {
  const t = textTarget(app);
  const el = t?.host ?? selectedBlocks(app)[0] ?? app.selection.elements()[0];
  if (!el) return null;
  if (el.matches('h1, h2, h4')) return `${label} is not available on a heading, since the theme sets its size`;
  if (el.matches('td, th')) return `${label} is not available in a table, since the theme sets the size of its cells`;
  if (el.matches('aside.notes')) return `${label} is not available in the notes, which take only bold and italic`;
  const s = styleOf(app, el);
  if (!s) return `${label} is not available on this block, since only a paragraph or a list item takes a style of the type scale`;
  if (up === undefined) return null;
  if (el.localName === 'li') return `${label} is not available, since a list item takes only Body and Small`;
  return `${label} is not available, since ${up ? 'Subheading is the largest' : 'Footnote is the smallest'} style of the type scale`;
}

// the style one size up or down the ladder, or the same style at its end
export const stepped = (s: ParagraphStyle, up: boolean): ParagraphStyle => LADDER[Math.min(LADDER.length - 1, Math.max(0, rank(s) + (up ? 1 : -1)))];

export const canStep = (app: App, up: boolean): boolean => styled(app).some((el) => {
  const s = styleOf(app, el)!;
  const next = stepped(s, up);
  return next !== s && fits(el, next);
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
