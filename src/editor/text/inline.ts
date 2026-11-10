// the formats of the words of a block, within the scope rule: strong, em, sup, sub, code, a link,
// and a span with one class tone-NAME of theme/beeson.css for the color of the words. a format is
// set on the range of the text, on the word at the caret when nothing is selected, or on the
// whole text of each selected block. the change is recorded as the content of the block before and
// after, as typing is, and the command around it makes it one entry of the history

import type { App } from '../app.ts';
import { textTarget, type Target } from './blocks.ts';

export type Match = (el: Element) => boolean;

const tagIs = (...tags: string[]): Match => (el) => tags.includes(el.localName);

export const TONES = ['accent', 'violet', 'blue', 'red', 'subtle', 'muted'] as const;
export type Tone = (typeof TONES)[number];

export const isTone: Match = (el) => el.localName === 'span' && el.classList.length === 1 && el.classList[0].startsWith('tone-');

export const FORMATS = {
  bold: { tag: 'strong', match: tagIs('strong', 'b') },
  italic: { tag: 'em', match: tagIs('em', 'i') },
  superscript: { tag: 'sup', match: tagIs('sup') },
  subscript: { tag: 'sub', match: tagIs('sub') },
  code: { tag: 'code', match: tagIs('code') },
} as const;
export type FormatName = keyof typeof FORMATS;

export const isLink: Match = tagIs('a');

// what Clear Formatting takes off, i.e. every format of the editor and of the browser apart from a
// link, a formula, and a span of the deck such as the class of a colored symbol
export const CLEARED: Match = (el) => tagIs('strong', 'b', 'em', 'i', 'sup', 'sub', 'code', 'u', 's', 'mark')(el) || isTone(el);

// the elements that a format is not wrapped around, whose content is formatted instead
const BLOCKISH = 'ul, ol, li, p, div, table, pre, h1, h2, h3, h4, h5, h6, mjx-container';

const elementOf = (n: Node): Element | null => (n instanceof Element ? n : n.parentElement);

// the range around the word at a collapsed caret, or the range itself
function wordRange(range: Range): Range {
  if (!range.collapsed || !(range.startContainer instanceof Text)) return range;
  const text = range.startContainer;
  const word = /[\p{L}\p{N}_'’-]/u;
  let start = range.startOffset;
  let end = start;
  while (start > 0 && word.test(text.data[start - 1])) start--;
  while (end < text.length && word.test(text.data[end])) end++;
  const r = document.createRange();
  r.setStart(text, start);
  r.setEnd(text, end);
  return r;
}

// the ranges that a format is set on: the text of the window or the word at its caret, and else
// the whole text of each selected block. notes take only bold and italic
export function inlineTargets(app: App, notes = false): Target[] {
  const t = textTarget(app);
  if (t) {
    if (!notes && t.host.matches('aside.notes')) return [];
    const range = wordRange(t.range);
    return range.collapsed ? [] : [{ host: t.host, range }];
  }
  return app.selection.elements().filter((el) => app.pairing?.byLive.has(el) && !el.matches('aside.notes')).map((host) => {
    const range = document.createRange();
    range.selectNodeContents(host);
    return { host, range };
  });
}

// the text nodes of range that are not blank, or the node at a collapsed range
function textsIn(range: Range): Node[] {
  const root = range.commonAncestorContainer;
  if (root instanceof Text) return [root];
  const out: Node[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const edge = (n === range.startContainer && range.startOffset === n.length) || (n === range.endContainer && range.endOffset === 0);
    if (range.intersectsNode(n) && !edge && n.data.trim() && !n.parentElement?.closest('mjx-container')) out.push(n);
  }
  return out.length ? out : [range.startContainer];
}

// the element of host around node that matches, if any
export function around(host: Element, node: Node, match: Match): Element | null {
  for (let el = elementOf(node); el && el !== host && host.contains(el); el = el.parentElement) if (match(el)) return el;
  return null;
}

// true when every text of range is inside an element of the format
export function formatted(host: Element, range: Range, match: Match): boolean {
  return textsIn(range).every((n) => around(host, n, match));
}

// the nodes of range taken out of every element that matches: an element around the whole range
// is cut into the part before the range, the range, and the part after it, and an element inside
// the range is unwrapped. the nodes are siblings in order
function lift(host: Element, range: Range, match: Match): Node[] {
  let outer: Element | null = null;
  for (let el = elementOf(range.commonAncestorContainer); el && el !== host && host.contains(el); el = el.parentElement) if (match(el)) outer = el;
  let nodes: Node[];
  if (outer) {
    const start: [Node, number] = [range.startContainer, range.startOffset];
    const tail = document.createRange();
    tail.setStart(range.endContainer, range.endOffset);
    tail.setEnd(outer, outer.childNodes.length);
    const after = outer.cloneNode(false) as Element;
    after.append(tail.extractContents());
    const head = document.createRange();
    head.setStart(outer, 0);
    head.setEnd(...start);
    const before = outer.cloneNode(false) as Element;
    before.append(head.extractContents());
    nodes = [...outer.childNodes];
    outer.before(before);
    outer.after(after);
    outer.replaceWith(...nodes);
  } else {
    const fragment = range.extractContents();
    nodes = [...fragment.childNodes];
    range.insertNode(fragment);
  }
  const out: Node[] = [];
  for (const n of nodes) {
    if (n instanceof Element && !n.matches('mjx-container')) {
      for (const el of [...n.querySelectorAll('*')].filter((e) => match(e) && !e.closest('mjx-container')).reverse()) el.replaceWith(...el.childNodes);
      if (match(n)) {
        const kids = [...n.childNodes];
        n.replaceWith(...kids);
        out.push(...kids);
        continue;
      }
    }
    out.push(n);
  }
  return out;
}

// each run of inline nodes in nodes wrapped in an element of make, and the content of a block
// among them formatted in the same way. a run of white space alone is not wrapped
function wrapRuns(nodes: Node[], make: () => Element): void {
  let run: Node[] = [];
  const flush = () => {
    if (run.some((n) => !(n instanceof Text) || n.data.trim())) {
      const el = make();
      run[0].parentNode!.insertBefore(el, run[0]);
      el.append(...run);
    }
    run = [];
  };
  for (const n of nodes) {
    if (n instanceof Element && n.matches(BLOCKISH) && !n.matches('mjx-container')) {
      flush();
      wrapRuns([...n.childNodes], make);
    } else run.push(n);
  }
  flush();
}

// an element of a format left without text by a cut is removed
function prune(host: Element): void {
  for (const el of [...host.querySelectorAll('strong, em, b, i, sup, sub, code, span, a')].reverse()) {
    if ((CLEARED(el) || isLink(el)) && !el.textContent && !el.querySelector('mjx-container, br, img')) el.remove();
  }
}

// the change of a format on each target, recorded in the history as the content of its block
// before and after. a target of the window keeps the formatted text selected
export function edit(app: App, targets: Target[], change: (host: Element, range: Range) => Node[]): void {
  const fromWindow = textTarget(app) !== null;
  for (const { host, range } of targets) {
    app.history.beforeTyping(host);
    const nodes = change(host, range);
    prune(host);
    if (fromWindow && nodes.length) {
      const connected = nodes.filter((n) => n.isConnected);
      (host as HTMLElement).focus({ preventScroll: true });
      const r = document.createRange();
      if (connected.length) {
        r.setStartBefore(connected[0]);
        r.setEndAfter(connected[connected.length - 1]);
      } else r.setStart(range.startContainer, range.startOffset);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    }
    host.normalize();
    app.history.afterTyping(host);
  }
  app.markDirty();
  app.invalidate('content');
}

// the nodes of range taken out of the format of match, and wrapped in an element of make if given
export function setFormat(host: Element, range: Range, match: Match, make: (() => Element) | null): Node[] {
  const nodes = lift(host, range, match);
  if (make) {
    wrapRuns(nodes, make);
    return nodes.map((n) => (n.parentNode && n.parentNode !== host && (n.parentNode as Element).matches?.(':not([contenteditable])') ? n.parentNode : n)).filter((n, i, a) => a.indexOf(n) === i);
  }
  return nodes;
}

// a format is taken off when every text of every target has it, and else put on. superscript and
// subscript take each other off
export function toggle(app: App, name: FormatName): void {
  const targets = inlineTargets(app, name === 'bold' || name === 'italic');
  if (!targets.length) return;
  const f = FORMATS[name];
  const on = targets.every((t) => formatted(t.host, t.range, f.match));
  const pair = name === 'superscript' ? FORMATS.subscript.match : name === 'subscript' ? FORMATS.superscript.match : null;
  edit(app, targets, (host, range) => {
    if (on) return setFormat(host, range, f.match, null);
    const match: Match = pair ? (el) => f.match(el) || pair(el) : f.match;
    return setFormat(host, range, match, () => document.createElement(f.tag));
  });
}

export function isOn(app: App, name: FormatName): boolean {
  const targets = inlineTargets(app, true);
  return targets.length > 0 && targets.every((t) => formatted(t.host, t.range, FORMATS[name].match));
}

// the tone of the words at the caret or of the selection, null for the text color of the theme
export function toneAt(app: App): Tone | null {
  const t = inlineTargets(app)[0] ?? textTarget(app);
  if (!t) return null;
  const span = around(t.host, textsIn(t.range)[0], isTone);
  return span ? (span.classList[0].slice(5) as Tone) : null;
}

// the words colored in tone, or given the text color of the theme with null
export function setTone(app: App, tone: Tone | null): void {
  const targets = inlineTargets(app);
  edit(app, targets, (host, range) => setFormat(host, range, isTone, tone ? () => {
    const span = document.createElement('span');
    span.className = `tone-${tone}`;
    return span;
  } : null));
}

export function clearFormatting(app: App): void {
  edit(app, inlineTargets(app, true), (host, range) => setFormat(host, range, CLEARED, null));
}

// the range of a link: the whole link around a collapsed caret, and else the range of a format
function linkTargets(app: App): Target[] {
  const t = textTarget(app);
  if (t && t.range.collapsed && !t.host.matches('aside.notes')) {
    const a = around(t.host, t.range.startContainer, isLink);
    if (a) {
      const range = document.createRange();
      range.selectNodeContents(a);
      return [{ host: t.host, range }];
    }
  }
  return inlineTargets(app);
}

export const canLink = (app: App): boolean => linkTargets(app).length > 0;

// the address of the link at the start of the range of a link, or null
export function linkAt(app: App): string | null {
  const t = linkTargets(app)[0];
  const a = t ? around(t.host, t.range.startContainer, isLink) ?? around(t.host, textsIn(t.range)[0], isLink) : null;
  return a?.getAttribute('href') ?? null;
}

export function setLink(app: App, href: string): void {
  edit(app, linkTargets(app), (host, range) => setFormat(host, range, isLink, () => {
    const a = document.createElement('a');
    a.setAttribute('href', href);
    return a;
  }));
}

export function removeLink(app: App): void {
  edit(app, linkTargets(app), (host, range) => setFormat(host, range, isLink, null));
}
