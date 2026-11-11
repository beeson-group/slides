// the one selection of the editor, shown and edited everywhere: nothing, elements of the current
// slide, a text with its caret, or slides in the navigator. it is changed only through its methods,
// and the frames, the navigator, the inspector, the menus, and the toolbar read it and listen for
// its change. a press on the chrome never changes it. it is cleared at a change of slide, and an
// element taken off the page is dropped from it

import type { App, Selector } from './app.ts';
import type { Pairing } from './render.ts';
import { BY_ITSELF, MOVABLE, OUTSIDE, movablesOf, pickOf } from './canvas/hit.ts';

export type SelectionKind = 'none' | 'elements' | 'text' | 'slides';

export interface Selection {
  readonly kind: SelectionKind;
  // the selected elements, the block of the text, or the selected sections, in document order
  readonly items: readonly Element[];
  set(kind: SelectionKind, items: Element[]): void;
  // add and toggle keep the kind, and set it to elements when nothing is selected
  add(item: Element): void;
  toggle(item: Element): void;
  clear(): void;
  // every slide while slides are selected, and else every movable element of the current slide
  selectAll(): void;
  // called after every change, synchronously
  listen(fn: () => void): void;
  has(item: Element): boolean;
  // the selected elements, or none while a text or slides are selected
  elements(): Element[];
  // the one selected element, or null when none or several are selected
  only(): Element | null;
}

const inOrder = (items: Element[]): Element[] =>
  [...new Set(items)].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

// a figure, which has no text to click into, is put into the tab order, so that it is selected with
// Tab and moved with the arrow keys
function mark(pairing: Pairing | null): void {
  for (const el of document.querySelectorAll('.beeson-movable')) {
    el.classList.remove('beeson-movable');
    el.removeAttribute('tabindex');
  }
  if (!pairing) return;
  for (const [el, src] of pairing.elements) {
    if (!src.open || !el.matches(BY_ITSELF) || el.closest(OUTSIDE)) continue;
    const up = el.parentElement?.closest(MOVABLE);
    if (up && el.closest('section')?.contains(up)) continue;
    el.classList.add('beeson-movable');
    el.setAttribute('tabindex', '0');
    if (!el.hasAttribute('aria-label') && !el.hasAttribute('alt')) el.setAttribute('aria-label', 'Figure: the arrow keys move it, Esc deselects it');
  }
}

// the text node and the offset of the caret at the point x, y of the viewport
function caretAt(x: number, y: number): { node: Text; offset: number } | null {
  const d = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  const p = d.caretPositionFromPoint?.(x, y);
  if (p) return p.offsetNode instanceof Text ? { node: p.offsetNode, offset: p.offset } : null;
  const r = document.caretRangeFromPoint?.(x, y);
  return r && r.startContainer instanceof Text ? { node: r.startContainer, offset: r.startOffset } : null;
}

// the start and the end in node of the word at offset, or at its end, or null between two words
function wordAround(node: Text, offset: number): [number, number] | null {
  const words = [...new Intl.Segmenter(document.documentElement.lang || undefined, { granularity: 'word' }).segment(node.data)].filter((w) => w.isWordLike);
  const w = words.find((x) => x.index <= offset && offset < x.index + x.segment.length) ?? words.find((x) => x.index + x.segment.length === offset);
  return w ? [w.index, w.index + w.segment.length] : null;
}

// whether the selection s holds every character of host
function wholly(s: globalThis.Selection, host: Element): boolean {
  if (!s.rangeCount) return false;
  const r = s.getRangeAt(0);
  const all = document.createRange();
  all.selectNodeContents(host);
  return r.compareBoundaryPoints(Range.START_TO_START, all) <= 0 && r.compareBoundaryPoints(Range.END_TO_END, all) >= 0;
}

// the range left in a text of the slide after its text is left, e.g. with Esc and a click on a
// figure, is removed, since the text commands would act on it. a range in a focused field is kept
function dropRange(app: App): void {
  const s = getSelection();
  const active = document.activeElement;
  if (!s?.rangeCount || (active instanceof HTMLElement && (active.isContentEditable || active.matches('input, textarea')))) return;
  if (app.hostOf(s.anchorNode instanceof Element ? s.anchorNode : s.anchorNode?.parentElement ?? null)) s.removeAllRanges();
}

export function install(app: App): void {
  let kind: SelectionKind = 'none';
  let items: Element[] = [];
  const listeners: (() => void)[] = [];
  const set = (k: SelectionKind, next: Element[]) => {
    const ordered = k === 'none' ? [] : inOrder(next);
    const nextKind = ordered.length ? k : 'none';
    if (nextKind === kind && ordered.length === items.length && ordered.every((el, i) => el === items[i])) return;
    items = ordered;
    kind = nextKind;
    if (kind !== 'text') dropRange(app);
    for (const fn of listeners) fn();
    app.invalidate('selection');
  };
  const selection: Selection = {
    get kind() {
      return kind;
    },
    get items() {
      return items;
    },
    set,
    add: (item) => set(kind === 'none' || kind === 'text' ? 'elements' : kind, [...(kind === 'text' ? [] : items), item]),
    toggle: (item) => {
      const base = kind === 'text' ? [] : items;
      set(kind === 'none' || kind === 'text' ? 'elements' : kind, base.includes(item) ? base.filter((i) => i !== item) : [...base, item]);
    },
    clear: () => set('none', []),
    selectAll: () => {
      if (kind === 'slides') return set('slides', [...app.slides().querySelectorAll(':scope > section')]);
      const host = kind === 'text' ? items[0] : null;
      const s = getSelection();
      if (host && s && !wholly(s, host)) return void s.selectAllChildren(host);
      if (host && host.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      if (host) s?.removeAllRanges();
      set('elements', movablesOf(app));
    },
    listen: (fn) => void listeners.push(fn),
    has: (item) => items.includes(item),
    elements: () => (kind === 'elements' ? items : []),
    only: () => (kind === 'elements' && items.length === 1 ? items[0] : null),
  };
  app.selection = selection;

  // the interface of the modules of today that select and mark the elements
  const move: Selector = {
    select: (el) => (el ? set('elements', [el]) : set('none', [])),
    // what a press at target selects, i.e. the figure of a picture
    movableOf: (target) => pickOf(app, target),
    mark,
    refresh: () => app.invalidate('selection'),
  };
  app.move = move;

  // a text that gets the focus is the selection, and so is a figure reached with Tab. a figure
  // focused by a right-click on its selected image keeps the image selected
  document.addEventListener('focusin', (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    const host = app.hostOf(target);
    if (host && app.current()?.contains(host) && !host.closest('aside.notes')) set('text', [host]);
    else if (target?.classList.contains('beeson-movable') && !(kind === 'elements' && items.some((el) => el !== target && target.contains(el)))) set('elements', [target]);
  });
  // a right-click in a text, before its context menu is opened in shell.ts: inside the selection
  // the selection is kept, and else the text is focused and the word under the pointer is selected
  // on a Mac, as in the text fields of macOS, or the caret is put under it elsewhere. the range
  // before the press is kept, since the press of the right button may collapse it
  let before: Range | null = null;
  // a right press on a selected object keeps it selected for its element menu, without a caret
  const onSelected = (ev: MouseEvent) => kind === 'elements' && ev.target instanceof Element && items.includes(pickOf(app, ev.target) as Element);
  document.addEventListener('mousedown', (ev) => {
    if ((ev.button === 2 || (ev.ctrlKey && app.platform === 'mac')) && onSelected(ev)) ev.preventDefault();
    const s = getSelection();
    before = ev.button === 2 && s && s.rangeCount && !s.isCollapsed ? s.getRangeAt(0).cloneRange() : null;
  }, true);
  document.addEventListener('contextmenu', (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    const host = app.hostOf(target);
    if (!host || !app.current()?.contains(host) || host.closest('aside.notes') || target?.closest('mjx-container') || onSelected(ev)) return;
    const s = getSelection();
    if (!s) return;
    const kept = before ?? (s.rangeCount && !s.isCollapsed ? s.getRangeAt(0) : null);
    before = null;
    const inside = (r: Range) => [...r.getClientRects()].some((b) => ev.clientX >= b.left && ev.clientX <= b.right && ev.clientY >= b.top && ev.clientY <= b.bottom);
    if (kept && host.contains(kept.commonAncestorContainer) && inside(kept)) {
      s.removeAllRanges();
      s.addRange(kept);
      return;
    }
    const at = caretAt(ev.clientX, ev.clientY);
    if (!at || !host.contains(at.node)) return;
    if (document.activeElement !== host && !host.contains(document.activeElement)) (host as HTMLElement).focus({ preventScroll: true });
    const word = app.platform === 'mac' ? wordAround(at.node, at.offset) : null;
    if (word) s.setBaseAndExtent(at.node, word[0], at.node, word[1]);
    else s.setBaseAndExtent(at.node, at.offset, at.node, at.offset);
  }, true);
  app.listen('slide', () => {
    if (kind !== 'slides') set('none', []);
  });
  // an element taken off the page, or left on another slide, is dropped
  app.onRefresh(['content', 'structure', 'slide'], () => {
    if (kind === 'slides' || kind === 'none') return;
    const slide = app.current();
    const kept = items.filter((el) => el.isConnected && !!slide?.contains(el));
    if (kept.length !== items.length) set(kind, kept);
  });
}
