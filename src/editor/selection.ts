// the one selection of the editor, shown and edited everywhere: nothing, elements of the current
// slide, a text with its caret, or slides in the navigator. it is changed only through its methods
// and read by the frames, the navigator, the inspector, the menus, and the toolbar, which listen
// for its change. the store below keeps the items and their kind, and the selection of the
// elements on the slide is still kept by move.ts

import type { App } from './app.ts';

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
  listen(fn: () => void): void;
}

const inOrder = (items: Element[]): Element[] =>
  [...new Set(items)].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

export function install(app: App): void {
  let kind: SelectionKind = 'none';
  let items: Element[] = [];
  const listeners: (() => void)[] = [];
  const set = (k: SelectionKind, next: Element[]) => {
    items = k === 'none' ? [] : inOrder(next);
    kind = items.length ? k : 'none';
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
    add: (item) => set(kind === 'none' ? 'elements' : kind, [...items, item]),
    toggle: (item) => set(kind === 'none' ? 'elements' : kind, items.includes(item) ? items.filter((i) => i !== item) : [...items, item]),
    clear: () => set('none', []),
    selectAll: () => {
      if (kind === 'slides') {
        set('slides', [...app.slides().querySelectorAll(':scope > section')]);
        return;
      }
      const slide = app.current();
      const movable = slide ? [...slide.querySelectorAll('*')].filter((el) => app.move.movableOf(el) === el) : [];
      set('elements', movable);
    },
    listen: (fn) => void listeners.push(fn),
  };
  app.selection = selection;
}
