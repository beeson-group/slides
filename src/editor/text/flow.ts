// a text of several text elements, as one text box of Keynote and PowerPoint: the items of a list and the
// paragraphs of a text column are text elements of the file with an editing host each, and the arrows move
// the caret over the border of two of them. a selection over several text elements is a span. the window
// holds its part in the text element of its focus, from the edge of the text element to the focus, and the parts
// in the other text elements are drawn with the highlight beeson-span of the CSS Custom Highlight API. the
// formats of inline.ts, Tab, Shift+Tab, Backspace, Delete, Return, Cut, Copy, and typing act on the
// whole span. a place is a text element and a visible offset of text/elements.ts in it

import type { App } from '../app.ts';
import { besideTextElement, canIndent, canOutdent, canSplit, endOf, indent, offsetIn, outdent, pointAt, rangeOf, rangeTex, selectIn, split, type Target } from './elements.ts';
import { injectStyle } from '../ui/dom.ts';

export type Place = [Element, number];
type Way = 'left' | 'right' | 'up' | 'down';

const STYLE = '::highlight(beeson-span) { background-color: color-mix(in srgb, Highlight 60%, transparent); }';

let span: { anchor: Place; focus: Place } | null = null;
// a drag of the browser, which holds the window in the text element where it started
let drag: { from: Element; anchor: Place | null } | null = null;
// the column that ArrowUp and ArrowDown keep, as the left x of the caret in client px, while the
// focus is at the place where the last of these arrows put it
let column: { x: number; at: Place } | null = null;

const elementOf = (n: Node): Element | null => (n instanceof Element ? n : n.parentElement);
const end = (host: Element): number => offsetIn(host, host, host.childNodes.length);
const ahead = (way: Way): boolean => way === 'right' || way === 'down';

export const active = (): boolean => span !== null;

// the text elements of the text of host, in order
export function runOf(app: App, host: Element): Element[] {
  const out = [host];
  for (let b = besideTextElement(app, host, false); b; b = besideTextElement(app, b, false)) out.unshift(b);
  for (let b = besideTextElement(app, host, true); b; b = besideTextElement(app, b, true)) out.push(b);
  return out;
}

// the focus of the span read from the window, whose part in the text element of the focus runs from the
// edge of the text element. with off, a window elsewhere ends the span
function sync(off = false): void {
  if (!span || drag) return;
  const s = getSelection();
  const host = span.focus[0];
  const edge = span.anchor[0].compareDocumentPosition(host) & Node.DOCUMENT_POSITION_FOLLOWING ? 0 : end(host);
  if (s?.anchorNode && s.focusNode && host.contains(s.anchorNode) && host.contains(s.focusNode) && offsetIn(host, s.anchorNode, s.anchorOffset) === edge) {
    span.focus = [host, offsetIn(host, s.focusNode, s.focusOffset)];
  } else if (off) clear();
}

// the start and the end of the span, in the order of the text
function ends(): [Place, Place] | null {
  sync();
  if (!span) return null;
  const { anchor: a, focus: f } = span;
  const forward = a[0] === f[0] ? a[1] <= f[1] : !!(a[0].compareDocumentPosition(f[0]) & Node.DOCUMENT_POSITION_FOLLOWING);
  return forward ? [a, f] : [f, a];
}

// the range of the span in each of its text elements, from the first to the last
export function spanTargets(app: App): Target[] {
  const e = ends();
  if (!e || !e[0][0].isConnected || !e[1][0].isConnected) return [];
  const [[first, from], [last, to]] = e;
  const run = runOf(app, first);
  return run.slice(0, run.indexOf(last) + 1).slice(run.indexOf(first)).map((host) => {
    const range = document.createRange();
    range.setStart(...pointAt(host, host === first ? from : 0));
    range.setEnd(...pointAt(host, host === last ? to : end(host)));
    return { host, range };
  });
}

function highlight(ranges: Range[]): void {
  if (typeof CSS === 'undefined' || !CSS.highlights) return;
  if (ranges.length) CSS.highlights.set('beeson-span', new Highlight(...ranges));
  else CSS.highlights.delete('beeson-span');
}

export function clear(): void {
  span = null;
  highlight([]);
}

// the span drawn with its part in the text element apart in the window, which is the text element of the focus
// unless a drag of the browser holds the window in the text element where it started
function paint(app: App, apart = span!.focus[0]): void {
  const [host, at] = span!.focus;
  if (apart === host) {
    (host as HTMLElement).focus({ preventScroll: true });
    const edge = pointAt(host, ends()![0] === span!.anchor ? 0 : end(host));
    getSelection()?.setBaseAndExtent(...edge, ...pointAt(host, at));
  }
  highlight(spanTargets(app).filter((t) => t.host !== apart).map((t) => t.range));
}

export const repaint = (app: App): void => void (span && paint(app));

// the text from anchor to focus, as a span over several text elements or as the window in one
export function select(app: App, anchor: Place, focus: Place): void {
  if (anchor[0] !== focus[0]) {
    span = { anchor, focus };
    return paint(app);
  }
  clear();
  const host = anchor[0];
  (host as HTMLElement).focus({ preventScroll: true });
  getSelection()?.setBaseAndExtent(...pointAt(host, anchor[1]), ...pointAt(host, focus[1]));
}

// the anchor and the focus of the span, else of the window in one text element
export const places = (app: App): [Place, Place] | null => (span ? [span.anchor, span.focus] : windowPlaces(app));

// the anchor and the focus of the window as places, in one text element
function windowPlaces(app: App): [Place, Place] | null {
  const s = getSelection();
  if (!s?.anchorNode || !s.focusNode) return null;
  const host = app.hostOf(elementOf(s.anchorNode));
  if (!host || !host.contains(s.focusNode)) return null;
  return [[host, offsetIn(host, s.anchorNode, s.anchorOffset)], [host, offsetIn(host, s.focusNode, s.focusOffset)]];
}

// the box of the caret at the offset at of host, measured on a character beside it where the
// caret alone does not have a box
function caretBox(host: Element, at: number): DOMRect | null {
  const [node, offset] = pointAt(host, at);
  const r = document.createRange();
  r.setStart(node, offset);
  const box = r.getClientRects()[0];
  if (box || !(node instanceof Text) || !node.length) return box ?? null;
  r.setStart(node, Math.min(offset, node.length - 1));
  r.setEnd(node, r.startOffset + 1);
  return r.getClientRects()[0] ?? null;
}

// true when the focus at of host is at the edge of its text toward way: at its start or end, or on
// its first or last line
function atEdge(host: Element, at: number, way: Way): boolean {
  if (way === 'left' || way === 'right') {
    const part = rangeOf(host, way === 'left' ? null : pointAt(host, at), way === 'left' ? pointAt(host, at) : null);
    const copy = part.cloneContents();
    return !(copy.textContent ?? '').trim() && !copy.querySelector('mjx-container, br, img');
  }
  const caret = caretBox(host, at);
  const box = rangeOf(host, null, null).getBoundingClientRect();
  if (!caret?.height || !box.height) return true;
  return way === 'up' ? caret.top - box.top < caret.height / 2 : box.bottom - caret.bottom < caret.height / 2;
}

// the caret position of the browser at a point of the window
function fromPoint(x: number, y: number): [Node, number] | null {
  const d = document as Document & { caretRangeFromPoint?(x: number, y: number): Range | null };
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y);
    return p ? [p.offsetNode, p.offset] : null;
  }
  const r = d.caretRangeFromPoint?.(x, y);
  return r ? [r.startContainer, r.startOffset] : null;
}

// the place in the text element to that the focus reaches toward way from the left x of the caret: the end
// or the start of its text, or the nearest place on its first or last line
function placeIn(to: Element, way: Way, x: number): number {
  const fallback = way === 'left' || way === 'up' ? endOf(to) : 0;
  if (way === 'left' || way === 'right') return fallback;
  const lines = [...rangeOf(to, null, null).getClientRects()].filter((r) => r.height > 0);
  if (!lines.length) return fallback;
  const y = way === 'down' ? Math.min(...lines.map((r) => r.top)) + 3 : Math.max(...lines.map((r) => r.bottom)) - 3;
  const p = fromPoint(x, y);
  return p && to.contains(p[0]) ? offsetIn(to, ...p) : fallback;
}

// the focus of the window as a place, which a range has only with Shift
function focusOf(app: App, extend: boolean): Place | null {
  const s = getSelection();
  if (!s?.focusNode || (!extend && !s.isCollapsed)) return null;
  const host = app.hostOf(elementOf(s.focusNode));
  return host ? [host, offsetIn(host, s.focusNode, s.focusOffset)] : null;
}

// the x that the focus at of host keeps toward way: the column while it holds, else the caret
function xOf(host: Element, at: number, way: Way): number {
  const kept = (way === 'up' || way === 'down') && column && column.at[0] === host && column.at[1] === at;
  return kept ? column!.x : (caretBox(host, at)?.left ?? 0);
}

// the place that the focus of the window goes to toward way when it is at the edge of its text element and
// a text element of the same text is beside it, or null
function step(app: App, way: Way, extend: boolean): Place | null {
  const f = focusOf(app, extend);
  const to = f ? besideTextElement(app, f[0], ahead(way)) : null;
  if (!f || !to || !atEdge(f[0], f[1], way)) return null;
  return [to, placeIn(to, way, xOf(f[0], f[1], way))];
}

// the place on the line above or below the focus in its own text element at the column, while the column
// holds. the browser keeps a column only over its own moves, and an arrow that leaves a short line
// of another text element thus goes back to the column
function within(app: App, way: Way, extend: boolean): Place | null {
  const f = focusOf(app, extend);
  if (!f || !column || column.at[0] !== f[0] || column.at[1] !== f[1] || (way !== 'up' && way !== 'down') || atEdge(f[0], f[1], way)) return null;
  const caret = caretBox(f[0], f[1]);
  if (!caret) return null;
  const p = fromPoint(column.x, way === 'down' ? caret.bottom + caret.height / 2 : caret.top - caret.height / 2);
  return p && f[0].contains(p[0]) ? [f[0], offsetIn(f[0], ...p)] : null;
}

// an arrow collapses a span to its start or its end, or moves the caret into the text element beside it.
// Shift with an arrow moves the focus into the text element beside it
function move(app: App, way: Way, extend: boolean): void {
  if (!extend && span) {
    const [first, last] = ends()!;
    const [host, at] = ahead(way) ? last : first;
    clear();
    return selectIn(host, at);
  }
  const from = focusOf(app, extend);
  const x = from ? xOf(from[0], from[1], way) : 0;
  const to = step(app, way, extend) ?? within(app, way, extend);
  const anchor = extend ? (span?.anchor ?? windowPlaces(app)?.[0]) : to;
  if (!to || !anchor) return;
  select(app, anchor, to);
  column = way === 'up' || way === 'down' ? { x, at: to } : null;
}

// ⌘A in a text element of a text of several text elements selects the whole text, and returns false once it is
// selected
export function selectRun(app: App, host: Element): boolean {
  const run = runOf(app, host);
  if (run.length < 2) return false;
  const last = run[run.length - 1];
  const e = ends();
  if (e && e[0][0] === run[0] && e[0][1] === 0 && e[1][0] === last && e[1][1] === end(last)) return false;
  select(app, [run[0], 0], [last, end(last)]);
  return true;
}

// the text of the span replaced by text: the first text element keeps its text before the span and is
// given text and the text of the last text element after the span, and the text elements after the first are
// removed. a line of text is a br
async function removeSpan(app: App, text = ''): Promise<void> {
  const t = spanTargets(app);
  clear();
  if (t.length < 2) return;
  const [first, last] = [t[0], t[t.length - 1]];
  const at = offsetIn(first.host, first.range.startContainer, first.range.startOffset);
  const head = rangeTex(first.host, rangeOf(first.host, null, [first.range.startContainer, first.range.startOffset]));
  const tail = rangeTex(last.host, rangeOf(last.host, [last.range.endContainer, last.range.endOffset], null));
  const typed = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>');
  await app.doc.setContent(first.host, head + typed + tail, 'delete');
  for (const { host } of t.slice(1)) await app.doc.remove(host, 'delete');
  selectIn(first.host, at + text.replace(/\r?\n/g, ' ').length);
}

// the items that the selection touches, as indices into the items of the outermost list with the
// offsets of the start and the end in their items, where the selection reaches over one item
function touched(app: App): { list: Element; from: number; to: number; start: number; stop: number } | null {
  const t = spanTargets(app);
  const s = getSelection();
  const r = t.length ? rangeOf(t[0].host, [t[0].range.startContainer, t[0].range.startOffset], [t[t.length - 1].range.endContainer, t[t.length - 1].range.endOffset]) : s?.rangeCount ? s.getRangeAt(0) : null;
  const a = r && elementOf(r.startContainer)?.closest('li');
  const b = r && elementOf(r.endContainer)?.closest('li');
  const list = a && app.hostOf(a)?.parentElement;
  if (!r || !a || !b || !list?.matches('ul, ol')) return null;
  const items = [...list.querySelectorAll('li')];
  const [from, to] = [items.indexOf(a), items.indexOf(b)];
  return from >= 0 && to > from ? { list, from, to, start: offsetIn(a, r.startContainer, r.startOffset), stop: offsetIn(b, r.endContainer, r.endOffset) } : null;
}

export const canLevel = (app: App): boolean => touched(app) !== null;

// Tab and Shift+Tab on each item that the selection touches, in order, which keeps the order of
// the items of the list. the same text is selected after it
export async function level(app: App, deeper: boolean): Promise<void> {
  const t = touched(app);
  if (!t) return deeper ? indent(app) : outdent(app);
  clear();
  const item = (k: number) => t.list.querySelectorAll('li')[k];
  for (let k = t.from; k <= t.to; k++) {
    selectIn(item(k), k === t.from ? t.start : k === t.to ? t.stop : 0);
    if (deeper ? canIndent(app) : canOutdent(app)) await (deeper ? indent(app) : outdent(app));
  }
  const place = (li: Element, at: number): Place | null => {
    const host = app.hostOf(li);
    return host && [host, offsetIn(host, ...pointAt(li, at))];
  };
  const [a, b] = [place(item(t.from), t.start), place(item(t.to), t.stop)];
  if (a && b) select(app, a, b);
}

export function install(app: App): void {
  injectStyle('flow', STYLE);
  const c = app.commands;
  const WAYS: [Way, string, string][] = [['left', 'ArrowLeft', 'Left'], ['right', 'ArrowRight', 'Right'], ['up', 'ArrowUp', 'Up'], ['down', 'ArrowDown', 'Down']];
  for (const [way, key, name] of WAYS) {
    c.define({ id: `text.flow.${way}`, label: `Move ${name}`, keys: { mac: [key], other: [key] }, in: ['text'], enabled: (a) => !!span || !!step(a, way, false) || !!within(a, way, false), run: (a) => move(a, way, false) });
    c.define({ id: `text.flow.extend.${way}`, label: `Extend Selection ${name}`, keys: { mac: [`Shift+${key}`], other: [`Shift+${key}`] }, in: ['text'], enabled: (a) => !!step(a, way, true) || !!within(a, way, true), run: (a) => move(a, way, true) });
  }
  c.define({ id: 'text.flow.delete', label: 'Delete', keys: { mac: ['Backspace', 'Delete'], other: ['Backspace', 'Delete'] }, in: ['text'], undoable: true, enabled: active, run: removeSpan });
  c.define({
    id: 'text.flow.newParagraph',
    label: 'New Paragraph',
    keys: { mac: ['Enter'], other: ['Enter'] },
    in: ['text'],
    undoable: true,
    enabled: active,
    run: async (a) => {
      await removeSpan(a);
      if (canSplit(a)) await split(a);
    },
  });

  document.addEventListener('selectionchange', () => sync(true));

  // a drag of the browser is held in the text element where it started, hence the text elements of the same text
  // under the pointer are added to it as a span, and the window is moved into the text element of the focus
  // once the button is released
  document.addEventListener('pointerdown', (ev) => {
    const host = ev.button === 0 && !ev.shiftKey ? app.hostOf(ev.target) : null;
    drag = host && runOf(app, host).length > 1 ? { from: host, anchor: null } : null;
  }, true);
  document.addEventListener('pointermove', (ev) => {
    if (!drag || !(ev.buttons & 1)) return;
    const over = app.hostOf(document.elementFromPoint(ev.clientX, ev.clientY));
    if (!over || !runOf(app, drag.from).includes(over)) return;
    if (over === drag.from) return clear();
    const s = getSelection();
    drag.anchor ??= s?.anchorNode && drag.from.contains(s.anchorNode) ? [drag.from, offsetIn(drag.from, s.anchorNode, s.anchorOffset)] : null;
    const p = fromPoint(ev.clientX, ev.clientY);
    if (!drag.anchor || !p || !over.contains(p[0])) return;
    span = { anchor: drag.anchor, focus: [over, offsetIn(over, ...p)] };
    paint(app, drag.from);
  }, true);
  // a Shift+click in another text element of the same text selects from the anchor of the selection to the
  // click, over the text elements between, before the canvas takes the click as one more selected object.
  // the press is cancelled, so that the browser does not move the caret into the clicked text element
  let shifted = false;
  window.addEventListener('pointerdown', (ev) => {
    shifted = false;
    if (ev.button !== 0 || !ev.shiftKey) return;
    const to = app.hostOf(ev.target);
    const anchor = places(app)?.[0];
    if (!to || !anchor || (anchor[0] === to && !span) || !runOf(app, anchor[0]).includes(to)) return;
    const p = fromPoint(ev.clientX, ev.clientY);
    if (!p || !to.contains(p[0])) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    shifted = true;
    select(app, anchor, [to, offsetIn(to, ...p)]);
  }, true);
  window.addEventListener('mousedown', (ev) => {
    if (!shifted) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
  }, true);

  // the drag is held until the window is moved, since a change of the window that the browser
  // reports after the release, while the window is still in the first text element, would end the span
  document.addEventListener('pointerup', () => {
    const held = drag;
    if (!held) return;
    if (!span) return void (drag = null);
    setTimeout(() => {
      if (drag === held) drag = null;
      repaint(app);
    }, 0);
  }, true);

  // typing replaces the span, as one entry of the history
  document.addEventListener('beforeinput', (ev) => {
    if (!span || !/^(insert|delete)/.test(ev.inputType)) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const text = ev.inputType.startsWith('insert') ? (ev.data ?? ev.dataTransfer?.getData('text/plain') ?? '') : '';
    void app.history.transact(ev.inputType === 'insertFromPaste' ? 'Paste' : 'typing', () => removeSpan(app, text)).catch((e) => app.fail(e));
  }, true);
  for (const kind of ['copy', 'cut'] as const) {
    document.addEventListener(kind, (ev) => {
      if (!span) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      ev.clipboardData?.setData('text/plain', spanTargets(app).map((t) => t.range.toString().trim()).join('\n'));
      if (kind === 'cut') void app.history.transact('Cut', () => removeSpan(app)).catch((e) => app.fail(e));
    }, true);
  }
}

// the text nodes of slide that hold more than white space, each with its text element, i.e. without the
// indent between the text elements and items that a list style writes
function inked(slide: Element): { text: Text; textEl: Element | null }[] {
  const out: { text: Text; textEl: Element | null }[] = [];
  const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!/\S/.test((n as Text).data) || el?.closest('mjx-container, aside.notes')) continue;
    out.push({ text: n as Text, textEl: el?.closest('p, li, h1, h2, h3, h4, h5, h6, dt, dd, td, th, figcaption, .caption, .foot, pre, blockquote') ?? null });
  }
  return out;
}

// the place of the point (node, offset) counted over the inked text of slide, with one more at the
// border of two text elements, which a change of the text elements around the text keeps, e.g. Dashes on a
// paragraph or Paragraphs on a list
function countTo(slide: Element, node: Node, offset: number): number {
  const point = document.createRange();
  point.setStart(node, offset);
  let n = 0;
  let textEl: Element | null | undefined;
  for (const t of inked(slide)) {
    if (textEl !== undefined && t.textEl !== textEl) n += 1;
    textEl = t.textEl;
    if (t.text === node) return n + offset;
    if (point.comparePoint(t.text, t.text.length) > 0) return n;
    n += t.text.length;
  }
  return n;
}

function pointOf(slide: Element, n: number): [Node, number] | null {
  let textEl: Element | null | undefined;
  let left = n;
  for (const t of inked(slide)) {
    if (textEl !== undefined && t.textEl !== textEl) left -= 1;
    textEl = t.textEl;
    if (left < 0) return [t.text, 0];
    if (left <= t.text.length) return [t.text, left];
    left -= t.text.length;
  }
  return null;
}

// the text selection of the current slide as a function that selects it again, after the text elements
// that hold it were made again, e.g. by an undo of a list style. null where it is not in the slide
export function mark(app: App): (() => void) | null {
  const p = places(app);
  const slide = app.current();
  if (!p || !slide || !p.every(([host]) => slide.contains(host) && !host.closest('aside.notes'))) return null;
  const [a, f] = p.map(([host, at]) => countTo(slide, ...pointAt(host, at)));
  return () => {
    const ends = [a, f].map((n) => pointOf(slide, n));
    const at = ends.map((e) => {
      const host = e && app.hostOf(elementOf(e[0]));
      return host ? ([host, offsetIn(host, e![0], e![1])] as Place) : null;
    });
    if (!at[0] || !at[1]) return;
    select(app, at[0], at[1]);
    // the start of a nested item is the end of the white space before it as well, where the list
    // commands do not act, hence the window is given the points in the texts
    if (at[0][0] === at[1][0]) getSelection()?.setBaseAndExtent(...ends[0]!, ...ends[1]!);
  };
}
