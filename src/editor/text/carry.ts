// the typing style of Keynote and PowerPoint: with the caret in a text but not in a word, e.g. in a
// new text box or at the end of a footnote, a format, a tone, a paragraph style, or a kind of list
// chosen in the Text pane is kept for the text typed next at the same caret, and dropped once the
// caret moves. in a new box of commands/insert.ts, which is written into the file at its first
// character, it is set on the written box by applyPending. the size of a code box is its font size
// of 22 or 18 px, the one size that the scope rule allows on a pre

import type { App } from '../app.ts';
import * as textElements from './elements.ts';
import { FORMATS, around, inlineTargets, isTone, setTone, toggle, type FormatName, type Tone } from './inline.ts';

type Caret = { host: Element; node: Node; offset: number; pending: boolean };
type Carry = Caret & { formats: Partial<Record<FormatName, boolean>>; tone?: Tone | null; style?: textElements.ParagraphStyle; list?: textElements.ListKind; small?: boolean };

const SMALL_CODE = '18px';
let carry: Carry | null = null;

// the collapsed caret in a text element of the file or in a new box that waits for its first character
function caretOf(app: App): Caret | null {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !sel.isCollapsed || !sel.anchorNode) return null;
  const node = sel.anchorNode;
  const el = node instanceof Element ? node : node.parentElement;
  if (!el || el.closest('mjx-container')) return null;
  const pending = el.closest('.beeson-pending[contenteditable="true"]');
  if (pending) return { host: pending, node, offset: sel.anchorOffset, pending: true };
  const host = app.hostOf(el);
  return host ? { host, node, offset: sel.anchorOffset, pending: false } : null;
}

const kindOf = (c: Caret): 'code' | 'foot' | 'text' => (c.host.closest('pre') ? 'code' : c.host.matches('.foot') ? 'foot' : 'text');

// the carry of the caret, while the caret has not moved
function current(app: App): Carry | null {
  const c = caretOf(app);
  if (!c || !carry || carry.host !== c.host || carry.node !== c.node || carry.offset !== c.offset) return null;
  return carry;
}

function ensure(app: App): Carry {
  const now = current(app);
  if (now) return now;
  carry = { ...(caretOf(app) as Caret), formats: {} };
  return carry;
}

function changed(app: App): void {
  app.invalidate('selection');
}

// true where a format chosen now is kept for the text typed next: a caret outside a word in a text
// that holds formats, i.e. not in a code box, and in the notes only for bold and italic
export function canFormat(app: App, notes = false): boolean {
  const c = caretOf(app);
  if (!c || kindOf(c) === 'code' || (!notes && c.host.matches('aside.notes'))) return false;
  return c.pending || inlineTargets(app, notes).length === 0;
}

export function formatOn(app: App, name: FormatName): boolean {
  const kept = current(app)?.formats[name];
  if (kept !== undefined) return kept;
  const c = caretOf(app);
  return !!c && !c.pending && !!around(c.host, c.node, FORMATS[name].match);
}

export function toggleFormat(app: App, name: FormatName): void {
  const on = !formatOn(app, name);
  const k = ensure(app);
  k.formats[name] = on;
  if (on && name === 'superscript') k.formats.subscript = false;
  if (on && name === 'subscript') k.formats.superscript = false;
  changed(app);
}

export function toneOf(app: App): Tone | null {
  const kept = current(app)?.tone;
  if (kept !== undefined) return kept;
  const c = caretOf(app);
  const span = c && !c.pending ? around(c.host, c.node, isTone) : null;
  return span ? (span.classList[0].slice(5) as Tone) : null;
}

export function chooseTone(app: App, tone: Tone | null): void {
  ensure(app).tone = tone;
  changed(app);
}

// the paragraph style and the kind of list of a new box, which a text element of the file has already
const pendingText = (app: App): Caret | null => {
  const c = caretOf(app);
  return c?.pending && kindOf(c) !== 'code' ? c : null;
};

export const canStyle = (app: App): boolean => pendingText(app) !== null;

export function styleOf(app: App): textElements.ParagraphStyle | null {
  const c = pendingText(app);
  if (!c) return null;
  return current(app)?.style ?? (kindOf(c) === 'foot' ? 'footnote' : 'body');
}

export function chooseStyle(app: App, style: textElements.ParagraphStyle | ((s: textElements.ParagraphStyle) => textElements.ParagraphStyle)): void {
  const now = styleOf(app);
  if (!now) return;
  ensure(app).style = typeof style === 'function' ? style(now) : style;
  changed(app);
}

export const canStep = (app: App, up: boolean): boolean => {
  const s = styleOf(app);
  return s !== null && textElements.stepped(s, up) !== s;
};

export const canList = (app: App): boolean => {
  const c = pendingText(app);
  return !!c && kindOf(c) === 'text';
};

export const listOf = (app: App): textElements.ListKind | null => (canList(app) ? (current(app)?.list ?? 'none') : null);

export function chooseList(app: App, kind: textElements.ListKind): void {
  ensure(app).list = kind;
  changed(app);
}

// the code box at the caret or selected on the canvas, or a new code box
function codeBox(app: App): { pre: Element | null; small: boolean } | null {
  const c = caretOf(app);
  if (c && kindOf(c) === 'code') {
    const pre = c.host.closest('pre')!;
    if (c.pending) return { pre: null, small: !!current(app)?.small };
    return { pre, small: (pre as HTMLElement).style.fontSize === SMALL_CODE };
  }
  const el = app.selection.kind === 'elements' ? app.selection.only() : null;
  if (el?.localName === 'pre' && el.querySelector(':scope > code') && app.pairing?.elements.has(el)) return { pre: el, small: (el as HTMLElement).style.fontSize === SMALL_CODE };
  return null;
}

export const canSizeCode = (app: App, up: boolean): boolean => {
  const box = codeBox(app);
  return !!box && box.small === up;
};

export function sizeCode(app: App, up: boolean): void {
  const box = codeBox(app);
  if (!box || box.small !== up) return;
  if (!box.pre) {
    ensure(app).small = !up;
    changed(app);
    return;
  }
  app.doc.setTag(box.pre, { style: { 'font-size': up ? null : SMALL_CODE } }, up ? 'Bigger' : 'Smaller');
  app.markDirty();
  app.invalidate('content');
}

// the caret at the end of the last text of the selection, inside the formats around it
function caretAtLastText(): void {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return;
  const range = sel.getRangeAt(0);
  const root = range.commonAncestorContainer;
  let last: Text | null = root instanceof Text ? root : null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) if (range.intersectsNode(n) && !n.parentElement?.closest('mjx-container')) last = n;
  if (last) sel.collapse(last, last.length);
  else sel.collapseToEnd();
}

// the first text of the selection that is not in a formula
function firstText(): Text | null {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const root = range.commonAncestorContainer;
  if (root instanceof Text) return root;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) if (range.intersectsNode(n) && n.data && !n.parentElement?.closest('mjx-container')) return n;
  return null;
}

// the tone and the formats of k set on the selected text where they differ from it, the tone
// inside and bold outside, as Paste Style sets them
function formatSelection(app: App, k: Carry): void {
  const has = (match: (el: Element) => boolean): boolean | null => {
    const text = firstText();
    const host = text ? app.hostOf(text.parentElement) : null;
    return host && text ? !!around(host, text, match) : null;
  };
  if (k.tone !== undefined) {
    const text = firstText();
    const host = text ? app.hostOf(text.parentElement) : null;
    const span = host && text ? around(host, text, isTone) : null;
    if ((span ? span.classList[0].slice(5) : null) !== k.tone) setTone(app, k.tone);
  }
  for (const name of ['code', 'subscript', 'superscript', 'strike', 'italic', 'bold'] as const) {
    const want = k.formats[name];
    const now = want === undefined ? null : has(FORMATS[name].match);
    if (now !== null && now !== want) toggle(app, name);
  }
}

// the carry of the new box from, now written into the file as the text element to, is set on the text of
// the text element, within the transaction that writes it
export async function applyPending(app: App, from: Element, to: Element): Promise<void> {
  const k = carry && carry.host === from ? carry : null;
  carry = null;
  if (!k) return;
  if (to.localName === 'pre') {
    if (k.small) app.doc.setTag(to, { style: { 'font-size': SMALL_CODE } }, 'Smaller');
    return;
  }
  const selectAll = (el: Element) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(r);
  };
  selectAll(to);
  if (k.list && k.list !== 'none') await textElements.setList(app, k.list);
  if (k.style && textElements.paragraphStyle(app) !== k.style && textElements.canStyle(app)) await textElements.setStyle(app, k.style);
  const anchor = window.getSelection()?.anchorNode;
  const host = anchor ? app.hostOf(anchor instanceof Element ? anchor : anchor.parentElement) : null;
  if (!host) return;
  selectAll(host);
  formatSelection(app, k);
  caretAtLastText();
}

export function install(app: App): void {
  // the first character typed at the caret of a carry is typed with it. a space alone is typed as
  // it is and keeps the carry, since a format is not set on a run of white space
  let follow: Carry | null = null;
  document.addEventListener('beforeinput', (ev) => {
    follow = null;
    if (ev.inputType !== 'insertText' || !ev.data || ev.defaultPrevented) return;
    const k = current(app);
    if (!k || k.pending) return;
    if (!ev.data.trim()) {
      follow = k;
      return;
    }
    ev.preventDefault();
    carry = null;
    const host = k.host;
    app.history.beforeTyping(host);
    const sel = window.getSelection()!;
    const range = sel.getRangeAt(0);
    const text = document.createTextNode(ev.data);
    range.insertNode(text);
    const r = document.createRange();
    r.selectNodeContents(text);
    sel.removeAllRanges();
    sel.addRange(r);
    formatSelection(app, k);
    caretAtLastText();
    host.normalize();
    app.history.afterTyping(host);
    app.markDirty();
    app.invalidate('content');
  }, true);
  document.addEventListener('input', () => {
    const k = follow;
    follow = null;
    const c = k ? caretOf(app) : null;
    if (k && c && c.host === k.host) carry = { ...k, node: c.node, offset: c.offset };
  });
}
