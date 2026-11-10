// the one selection of the editor, shown and edited everywhere: nothing, elements of the current
// slide, a text with its caret, or slides in the navigator. it is changed only through its methods,
// and the frames, the navigator, the inspector, the menus, and the toolbar read it and listen for
// its change. a press on the chrome never changes it. it is cleared at a change of slide, and an
// element taken off the page is dropped from it

import type { App, Selector } from './app.ts';
import type { Pairing } from './render.ts';
import { BY_ITSELF, MOVABLE, OUTSIDE, movableOf, movablesOf } from './canvas/hit.ts';

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
      if (kind === 'slides') set('slides', [...app.slides().querySelectorAll(':scope > section')]);
      else set('elements', movablesOf(app));
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
    movableOf: (target) => movableOf(app, target),
    mark,
    refresh: () => app.invalidate('selection'),
  };
  app.move = move;

  // a text that gets the focus is the selection, and so is a figure reached with Tab
  document.addEventListener('focusin', (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    const host = app.hostOf(target);
    if (host && app.current()?.contains(host) && !host.closest('aside.notes')) set('text', [host]);
    else if (target?.classList.contains('beeson-movable')) set('elements', [target]);
  });
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
