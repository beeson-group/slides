// find and replace over the text of the blocks of every slide and of the speaker notes, in one
// floating panel modeled on the Find & Replace window of Keynote. the panel has a search field with
// the count of the matches, the previous and next buttons, and a gear menu with the modes Find and
// Find & Replace and the options Whole Words, Match Case, and the TeX of the formulas. every match
// is marked with a highlight of CSS while the panel is open, and the current one more strongly. a
// replacement writes the content of its block through app.doc.setContent
//
// pattern(), spans(), and splice() are pure, hence tested under node

import type { App } from './app.ts';
import { mathLookup, type MathInfo, type MathLookup } from './math.ts';
import { display } from './keymap.ts';
import { injectStyle, make } from './ui/dom.ts';
import type { MenuItem, MenuOptions, OpenMenu } from './ui/menu.ts';

export type FindOptions = { matchCase: boolean; wholeWords: boolean; tex: boolean };

// a match as the offsets of its first and its past-the-end character in the text of its block
export type Span = { start: number; end: number };

// the text of a formula is set off by this character, which a query does not contain, so that a
// match does not run from a text into a formula
export const MARK = '￼';

const WORD = '[\\p{L}\\p{N}_]';

// the pattern of a query, or null for an empty query. a run of white space in the query matches
// any run of white space, since the source of a block breaks its lines where the slide does not
export function pattern(query: string, options: Pick<FindOptions, 'matchCase' | 'wholeWords'>): RegExp | null {
  if (!query) return null;
  const body = query
    .split(/\s+/u)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&'))
    .join('\\s+');
  const source = options.wholeWords ? `(?<!${WORD})(?:${body})(?!${WORD})` : body;
  return new RegExp(source, `gu${options.matchCase ? '' : 'i'}`);
}

export function spans(text: string, re: RegExp | null): Span[] {
  if (!re) return [];
  const out: Span[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (!m[0].length) {
      re.lastIndex++;
      continue;
    }
    out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

// text is the piece of a block that starts at the offset from. each span of list, sorted and not
// overlapping, is cut from it, and replacement is put where a span starts inside the piece. a
// span that starts in an earlier piece is only cut, since its replacement is in that piece
export function splice(text: string, from: number, list: Span[], replacement: string): string {
  let out = '';
  let at = 0;
  for (const s of list) {
    const a = Math.max(s.start - from, 0);
    const b = Math.min(s.end - from, text.length);
    if (b < 0 || a > text.length) continue;
    out += text.slice(at, a);
    if (s.start >= from) out += replacement;
    at = Math.max(at, b);
  }
  return out + text.slice(at);
}

// a piece of the text of a block: a text node, a formula, or a line break
type Piece =
  | { kind: 'text'; node: Text; from: number; to: number }
  | { kind: 'math'; el: Element; info: MathInfo | null; from: number; to: number }
  | { kind: 'other'; from: number; to: number };

// the text of a block with its pieces, in the order of the page
type Indexed = { block: Element; text: string; pieces: Piece[] };

export type Match = Span & { block: Element };

// the elements of the editor that may sit inside a block, and the elements without text
const SKIP = '[data-generated], script, style, template, .beeson-badge';

function index(block: Element, lookup: MathLookup | null, tex: boolean): Indexed {
  const pieces: Piece[] = [];
  let text = '';
  const walk = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const value = (child as Text).data;
        pieces.push({ kind: 'text', node: child as Text, from: text.length, to: text.length + value.length });
        text += value;
      } else if (child instanceof Element) {
        if (child.matches('mjx-container')) {
          const info = lookup ? lookup(child) : null;
          text += MARK;
          const t = tex && info ? info.tex : '';
          pieces.push({ kind: 'math', el: child, info, from: text.length, to: text.length + t.length });
          text += t + MARK;
        } else if (child.matches('br')) {
          pieces.push({ kind: 'other', from: text.length, to: text.length + 1 });
          text += '\n';
        } else if (!child.matches(SKIP)) {
          walk(child);
        }
      }
    }
  };
  walk(block);
  return { block, text, pieces };
}

// the nodes of a copy of a block in the order of the pieces of index(), with null for a line break
function piecesOf(root: Element): (Text | Element | null)[] {
  const out: (Text | Element | null)[] = [];
  const walk = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) out.push(child as Text);
      else if (child instanceof Element) {
        if (child.matches('mjx-container')) out.push(child);
        else if (child.matches('br')) out.push(null);
        else if (!child.matches(SKIP)) walk(child);
      }
    }
  };
  walk(root);
  return out;
}

// the content of a block with each span of list replaced, in the form of contentWithTex of math.ts.
// an inline element emptied by a replacement, e.g. an em around the matched word, is removed
function replaced(idx: Indexed, list: Span[], replacement: string): string {
  const copy = idx.block.cloneNode(true) as Element;
  const nodes = piecesOf(copy);
  const emptied: Node[] = [];
  idx.pieces.forEach((p, i) => {
    const node = nodes[i];
    if (!node) return;
    const mine = list.filter((s) => s.end > p.from && s.start < p.to);
    if (p.kind === 'text' && node instanceof Text) {
      if (mine.length) {
        node.data = splice(node.data, p.from, mine, replacement);
        if (!node.data) emptied.push(node);
      }
    } else if (p.kind === 'math' && node instanceof Element) {
      const info = p.info;
      const tex = info ? splice(info.tex, p.from, mine, replacement) : '';
      node.replaceWith(document.createTextNode(info ? info.open + tex + info.close : node.textContent ?? ''));
    }
  });
  for (const n of emptied) {
    let el = n.parentNode;
    n.parentNode?.removeChild(n);
    while (el && el !== copy && el instanceof Element && !el.childNodes.length) {
      const up = el.parentNode;
      el.remove();
      el = up;
    }
  }
  copy.normalize();
  return copy.innerHTML;
}

// the range of a match on the page. a match in the TeX of a formula is the range of its formula
function rangeOf(idx: Indexed, m: Span): Range | null {
  const range = document.createRange();
  const math = idx.pieces.find((p) => p.kind === 'math' && m.start >= p.from && m.end <= p.to);
  if (math && math.kind === 'math') {
    range.selectNode(math.el);
    return range;
  }
  const first = idx.pieces.find((p) => p.kind === 'text' && m.start >= p.from && m.start < p.to);
  const last = [...idx.pieces].reverse().find((p) => p.kind === 'text' && m.end > p.from && m.end <= p.to);
  if (!first || !last || first.kind !== 'text' || last.kind !== 'text') return null;
  range.setStart(first.node, m.start - first.from);
  range.setEnd(last.node, m.end - last.from);
  return range;
}

const before = (a: Node, b: Node): boolean => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

const ICONS = {
  gear: 'M8 5.3a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Zm6.2 3.6-.1-1.8 1.5-1.2-1.6-2.8-1.8.7a5.8 5.8 0 0 0-1.6-.9L10.3 1H7.1l-.3 1.9c-.6.2-1.1.5-1.6.9l-1.8-.7-1.6 2.8 1.5 1.2a6 6 0 0 0 0 1.8l-1.5 1.2 1.6 2.8 1.8-.7c.5.4 1 .7 1.6.9l.3 1.9h3.2l.3-1.9c.6-.2 1.1-.5 1.6-.9l1.8.7 1.6-2.8-1.5-1.2Z',
  chevronDown: 'M4 6.5 8 10.5 12 6.5',
  chevronLeft: 'M10 3.5 5.5 8 10 12.5',
  chevronRight: 'M6 3.5 10.5 8 6 12.5',
  search: 'M7 2.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM10.3 10.3 14 14',
  pencil: 'M3 13l.6-2.7L10.8 3a1.2 1.2 0 0 1 1.7 0l.5.5a1.2 1.2 0 0 1 0 1.7L5.7 12.4Z',
  close: 'M4.5 4.5l7 7m0-7-7 7',
};

function icon(name: keyof typeof ICONS): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('ic', `ic-${name}`);
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

// the colors are the tokens --ed-* of the chrome, set by shell/shell.ts. the panel is a window of
// its own over the canvas, hence it is drawn in the color of the bars in dark mode, which is
// lighter than the canvas
const CSS = `
.beeson-find { position: fixed; z-index: 80; top: 92px; right: calc(var(--ed-insp-col, 0px) + var(--ed-a11y-col, 0px) + 16px); width: 480px; max-width: calc(100vw - 32px); box-sizing: border-box; background: var(--ed-panel); color: var(--ed-text); border: 1px solid var(--ed-menu-line); border-radius: 10px; box-shadow: 0 10px 32px rgba(0, 0, 0, 0.22), 0 0 0 0.5px rgba(0, 0, 0, 0.12); font: 13px/1.3 var(--ed-font); user-select: none; -webkit-user-select: none; }
@media (prefers-color-scheme: dark) { .beeson-find { background: var(--ed-bg); box-shadow: 0 10px 32px rgba(0, 0, 0, 0.55), 0 0 0 0.5px rgba(0, 0, 0, 0.8); } }
.beeson-find[hidden] { display: none; }
.beeson-find .title { position: relative; height: 28px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid var(--ed-line); color: var(--ed-muted); font-size: 13px; font-weight: 500; cursor: grab; touch-action: none; }
.beeson-find .title.dragging { cursor: grabbing; }
.beeson-find .title .close { position: absolute; left: 9px; top: 8px; width: 12px; height: 12px; padding: 0; border: 0; border-radius: 50%; background: var(--ed-control-line); color: transparent; display: grid; place-items: center; }
.beeson-find .title .close .ic { width: 8px; height: 8px; stroke-width: 2; }
.beeson-find .title .close:hover, .beeson-find .title .close:focus-visible { background: var(--ed-muted); color: var(--ed-panel); }
.beeson-find .body { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-areas: "gear search nav"; gap: 10px 12px; align-items: center; padding: 14px 16px 16px; }
.beeson-find.replacing .body { grid-template-areas: "gear search search" ". replace replace" ". actions nav"; }
.beeson-find.replacing .actions, .beeson-find.replacing .nav { margin-top: 6px; }
.beeson-find .gear { grid-area: gear; align-self: start; display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 54px; height: 24px; padding: 0 7px 0 9px; box-sizing: border-box; }
.beeson-find .search { grid-area: search; }
.beeson-find .replace { grid-area: replace; }
.beeson-find .actions { grid-area: actions; display: flex; gap: 10px; }
.beeson-find:not(.replacing) .replace, .beeson-find:not(.replacing) .actions { display: none; }
.beeson-find .nav { grid-area: nav; display: flex; align-items: center; height: 24px; border-radius: 6px; background: var(--ed-pressed); }
.beeson-find button { font: inherit; color: inherit; cursor: default; }
.beeson-find .gear, .beeson-find .actions button { border: 0; border-radius: 6px; background: var(--ed-pressed); color: var(--ed-text); }
.beeson-find .gear[aria-expanded="true"] { background: var(--ed-hover); box-shadow: inset 0 0 0 100px var(--ed-pressed); }
.beeson-find .actions button { height: 24px; padding: 0 12px; white-space: nowrap; }
.beeson-find .nav button { width: 32px; height: 24px; display: grid; place-items: center; border: 0; background: transparent; color: var(--ed-text); padding: 0; }
.beeson-find .nav button:first-child { border-radius: 6px 0 0 6px; }
.beeson-find .nav button + button { border-radius: 0 6px 6px 0; background: linear-gradient(var(--ed-faint), var(--ed-faint)) left center / 1px 12px no-repeat; }
.beeson-find .gear:hover, .beeson-find .actions button:hover:not(:disabled), .beeson-find .nav button:hover:not(:disabled) { box-shadow: inset 0 0 0 100px var(--ed-hover); }
.beeson-find button:disabled { color: var(--ed-faint); }
.beeson-find button:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 1px; }
.beeson-find .field { display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 4px 0 7px; box-sizing: border-box; background: var(--ed-control); border: 1px solid var(--ed-control-line); border-radius: 5px; min-width: 0; }
.beeson-find .field:focus-within { border-color: var(--ed-select); box-shadow: 0 0 0 3px var(--ed-focus); }
.beeson-find .field input { flex: 1; min-width: 0; border: 0; outline: 0; padding: 0; background: transparent; color: var(--ed-text); font: inherit; font-size: 14px; user-select: text; -webkit-user-select: text; }
.beeson-find .field input::placeholder { color: var(--ed-faint); }
.beeson-find .count { color: var(--ed-muted); font-size: 12px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.beeson-find .count.none { color: #d1453b; }
.beeson-find .field .clear { width: 16px; height: 16px; padding: 0; border: 0; border-radius: 50%; background: var(--ed-text); color: var(--ed-control); display: grid; place-items: center; }
.beeson-find .field .clear .ic { width: 8px; height: 8px; stroke-width: 2; }
.beeson-find .field .clear[hidden] { display: none; }
.beeson-find .field .clear:hover { background: var(--ed-muted); }
.beeson-find .ic { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.beeson-find .ic-gear { width: 15px; height: 15px; stroke: none; fill: currentColor; fill-rule: evenodd; }
.beeson-find .gear .ic-chevronDown { width: 11px; height: 11px; stroke-width: 1.8; }
.beeson-find .field > .ic { color: var(--ed-muted); }
::highlight(beeson-find) { background-color: #ffe14d; color: #000; }
::highlight(beeson-find-current) { background-color: #ff9632; color: #000; }
html.beeson-editor mjx-container.beeson-find-math { outline: 3px solid rgba(255, 221, 0, 0.8); outline-offset: 2px; border-radius: 2px; }
html.beeson-editor mjx-container.beeson-find-math.current { outline-color: #ff9632; }
`;

export type Finder = {
  readonly open: boolean;
  readonly mode: 'find' | 'replace';
  readonly options: FindOptions;
  readonly query: string;
  readonly matches: Match[];
  readonly current: number;
  show(mode: 'find' | 'replace', query?: string): void;
  hide(): void;
  step(way: 1 | -1, select?: boolean): void;
  toggle(option: keyof FindOptions): void;
  setMode(mode: 'find' | 'replace'): void;
  replaceCurrent(find: boolean): Promise<void>;
  replaceAll(): Promise<number>;
};

// the keys of Next and Previous, shown in the titles of their buttons
type Keys = { next: string[]; previous: string[] };

// openMenu and closeMenus of ui/menu.ts, given by commands/find.ts, since ui/menu.ts listens on
// window at its import and this module is imported by the pure tests under node
export type Menus = { open(app: App, items: MenuItem[], options: MenuOptions): OpenMenu; close(): void };

export function createFinder(app: App, keys: Keys, menus: Menus): Finder {
  injectStyle('find', CSS);
  const options: FindOptions = { matchCase: false, wholeWords: false, tex: false };
  let mode: 'find' | 'replace' = 'find';
  let indexed: Indexed[] = [];
  let matches: Match[] = [];
  let current = -1;
  // the count of the last Replace All, shown in place of the count of matches until the next edit
  let note: string | null = null;

  const panel = make('div', 'beeson-find');
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Find & Replace');
  const title = make('div', 'title', 'Find & Replace');
  const close = make('button', 'close');
  close.type = 'button';
  close.title = 'Close';
  close.setAttribute('aria-label', 'Close');
  close.append(icon('close'));
  title.prepend(close);

  const gear = make('button', 'gear');
  gear.type = 'button';
  gear.title = 'Options';
  gear.setAttribute('aria-label', 'Options');
  gear.setAttribute('aria-haspopup', 'menu');
  gear.setAttribute('aria-expanded', 'false');
  gear.append(icon('gear'), icon('chevronDown'));

  const field = (cls: string, glyph: keyof typeof ICONS, label: string, placeholder: string) => {
    const box = make('label', `field ${cls}`);
    const input = make('input');
    input.type = 'text';
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', label);
    input.placeholder = placeholder;
    const clear = make('button', 'clear');
    clear.type = 'button';
    clear.tabIndex = -1;
    clear.title = 'Clear';
    clear.setAttribute('aria-label', `Clear ${label.toLowerCase()}`);
    clear.hidden = true;
    clear.append(icon('close'));
    box.append(icon(glyph), input);
    return { box, input, clear };
  };
  const search = field('search', 'search', 'Find', 'Find');
  const count = make('span', 'count');
  count.setAttribute('aria-live', 'polite');
  search.box.append(count, search.clear);
  const replace = field('replace', 'pencil', 'Replace with', 'Replace');
  replace.box.append(replace.clear);

  const actionButton = (text: string) => {
    const b = make('button', '', text);
    b.type = 'button';
    return b;
  };
  const actions = make('div', 'actions');
  const allButton = actionButton('Replace All');
  const andFindButton = actionButton('Replace & Find');
  const oneButton = actionButton('Replace');
  actions.append(allButton, andFindButton, oneButton);

  const nav = make('div', 'nav');
  const previous = make('button');
  previous.type = 'button';
  previous.setAttribute('aria-label', 'Previous');
  previous.append(icon('chevronLeft'));
  const next = make('button');
  next.type = 'button';
  next.setAttribute('aria-label', 'Next');
  next.append(icon('chevronRight'));
  nav.append(previous, next);
  const keyText = (list: string[]) => (list[0] ? ` (${display(list[0], app.platform)})` : '');
  previous.title = `Previous${keyText(keys.previous)}`;
  next.title = `Next${keyText(keys.next)}`;

  const body = make('div', 'body');
  body.append(gear, search.box, replace.box, actions, nav);

  // the gear menu of the modes and the options, drawn by ui/menu.ts as the other menus
  const menuOf = (): MenuItem[] => [
    { label: 'Find', checked: mode === 'find', run: () => setMode('find') },
    { label: 'Find & Replace', checked: mode === 'replace', run: () => setMode('replace') },
    { rule: true },
    { command: 'find.wholeWords' },
    { command: 'find.matchCase' },
    { rule: true },
    { command: 'find.tex' },
  ];
  const openOptions = (keyboard: boolean) => menus.open(app, menuOf(), { anchor: gear.getBoundingClientRect(), placement: 'below', owner: gear, keyboard, label: 'Options', className: 'find-options' });
  const optionsOpen = () => gear.getAttribute('aria-expanded') === 'true';
  gear.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    if (optionsOpen()) menus.close();
    else openOptions(false);
  });
  gear.addEventListener('click', (ev) => {
    if (ev.detail === 0) openOptions(true);
  });

  panel.append(title, body);
  document.body.append(panel);

  // the panel is moved by a drag of its title, within the window
  title.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0 || (ev.target as Element).closest('button')) return;
    ev.preventDefault();
    const box = panel.getBoundingClientRect();
    const dx = ev.clientX - box.left;
    const dy = ev.clientY - box.top;
    title.setPointerCapture(ev.pointerId);
    title.classList.add('dragging');
    const move = (e: PointerEvent) => {
      const x = Math.max(0, Math.min(innerWidth - box.width, e.clientX - dx));
      const y = Math.max(0, Math.min(innerHeight - 40, e.clientY - dy));
      Object.assign(panel.style, { left: `${x}px`, top: `${y}px`, right: 'auto' });
    };
    const up = () => {
      title.classList.remove('dragging');
      title.removeEventListener('pointermove', move);
      title.removeEventListener('pointerup', up);
      title.removeEventListener('pointercancel', up);
    };
    title.addEventListener('pointermove', move);
    title.addEventListener('pointerup', up);
    title.addEventListener('pointercancel', up);
  });

  // the paired blocks on the page in the order of the page, hence the notes of a slide after its
  // other blocks
  function blocks(): Element[] {
    const list = (app.pairing?.blocks ?? []).map((b) => b.live).filter((el) => el.isConnected && app.slides().contains(el));
    return list.sort((a, b) => (a === b ? 0 : before(a, b) ? -1 : 1));
  }

  function compute(): void {
    const re = pattern(search.input.value, options);
    const lookup = re ? mathLookup() : null;
    indexed = re ? blocks().map((b) => index(b, lookup, options.tex)) : [];
    matches = indexed.flatMap((idx) => spans(idx.text, re).map((s) => ({ ...s, block: idx.block })));
  }

  const indexedOf = (block: Element) => indexed.find((i) => i.block === block) ?? null;

  // the first match at or after the start of the current slide, for a search as the query is typed
  function fromSlide(): number {
    const slide = app.current();
    if (!matches.length) return -1;
    if (!slide) return 0;
    const at = matches.findIndex((m) => slide.contains(m.block) || before(slide, m.block));
    return at < 0 ? 0 : at;
  }

  // the first match at or after the offset start of block, once the matches are computed again
  function nearest(block: Element, start: number): number {
    if (!matches.length) return -1;
    const at = matches.findIndex((m) => (m.block === block && m.start >= start) || (m.block !== block && before(block, m.block)));
    return at < 0 ? 0 : at;
  }

  // the highlights of CSS are drawn by Chrome, Safari, and Firefox from 140, and a browser without
  // them shows only the current match, selected when the panel is closed
  function paint(): void {
    const highlights = (globalThis as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights;
    const Highlight = (globalThis as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    for (const el of document.querySelectorAll('mjx-container.beeson-find-math')) el.classList.remove('beeson-find-math', 'current');
    highlights?.delete('beeson-find');
    highlights?.delete('beeson-find-current');
    if (panel.hidden) return;
    const all: Range[] = [];
    let mine: Range | null = null;
    matches.forEach((m, i) => {
      const idx = indexedOf(m.block);
      const r = idx && rangeOf(idx, m);
      if (!r) return;
      const math = r.startContainer.childNodes[r.startOffset];
      if (r.endOffset === r.startOffset + 1 && math instanceof Element && math.matches('mjx-container')) {
        math.classList.add('beeson-find-math');
        if (i === current) math.classList.add('current');
      }
      if (i === current) mine = r;
      else all.push(r);
    });
    if (!highlights || !Highlight) return;
    highlights.set('beeson-find', new Highlight(...all));
    if (mine) highlights.set('beeson-find-current', new Highlight(mine));
  }

  function sync(): void {
    const query = search.input.value;
    search.clear.hidden = !query;
    replace.clear.hidden = !replace.input.value;
    count.classList.toggle('none', !!query && !matches.length && !note);
    count.textContent = note ?? (!query ? '' : !matches.length ? 'Not found' : current >= 0 ? `${current + 1} of ${matches.length}` : `${matches.length} found`);
    const any = matches.length > 0;
    previous.disabled = !any;
    next.disabled = !any;
    allButton.disabled = !any;
    andFindButton.disabled = !(any && current >= 0);
    oneButton.disabled = !(any && current >= 0);
    panel.classList.toggle('replacing', mode === 'replace');
    paint();
  }

  // the slide of the current match is shown, with the notes when the match is in them, and the
  // notes are scrolled to it. with select, the match is selected in its block, which then takes
  // the focus, and else the focus stays where it is
  function reveal(select: boolean): void {
    const m = matches[current];
    if (!m) return;
    const keep = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    app.showSlide(m.block);
    if (m.block.closest('aside.notes') && !app.notes.shown()) app.notes.toggle();
    app.flush();
    const idx = indexedOf(m.block);
    const r = idx && rangeOf(idx, m);
    const scroller = m.block.closest('aside.notes');
    if (r && scroller) {
      const box = r.getBoundingClientRect();
      const view = scroller.getBoundingClientRect();
      if (box.top < view.top || box.bottom > view.bottom) scroller.scrollTop += box.top - view.top - view.height / 3;
    }
    if (select && r) {
      (app.hostOf(m.block) as HTMLElement | null)?.focus({ preventScroll: true });
      const sel = getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    } else if (keep && keep.isConnected && document.activeElement !== keep) {
      keep.focus({ preventScroll: true });
    }
  }

  // the query or an option changed, hence the search starts again from the current slide
  function research(): void {
    note = null;
    compute();
    current = fromSlide();
    sync();
    if (current >= 0) reveal(false);
  }

  // the deck changed, hence the matches are computed again and the current one is kept in its place
  function refresh(): void {
    if (panel.hidden || !search.input.value) return;
    const was = matches[current];
    compute();
    current = was ? nearest(was.block, was.start) : -1;
    sync();
  }

  function setMode(m: 'find' | 'replace'): void {
    mode = m;
    sync();
  }

  function toggle(option: keyof FindOptions): void {
    options[option] = !options[option];
    if (panel.hidden) sync();
    else research();
  }

  function show(m: 'find' | 'replace', query?: string): void {
    mode = m;
    const wasHidden = panel.hidden;
    if (query === undefined && wasHidden) {
      // a text selected in a block is taken as the query, as Use Selection for Find of Keynote
      const sel = getSelection();
      const text = sel && !sel.isCollapsed && app.hostOf(sel.anchorNode?.parentElement ?? null) ? sel.toString() : '';
      if (text && text.length < 200 && !text.includes('\n')) query = text;
    }
    panel.hidden = false;
    if (query !== undefined && query !== search.input.value) {
      search.input.value = query;
      research();
    } else if (wasHidden) {
      research();
    } else {
      sync();
    }
    const target = m === 'replace' && search.input.value ? replace.input : search.input;
    target.focus();
    target.select();
  }

  // the current match is selected in its block once the panel is closed, so that it can be typed
  // over, as in Keynote
  function hide(): void {
    if (panel.hidden) return;
    if (optionsOpen()) menus.close();
    const had = panel.contains(document.activeElement);
    panel.hidden = true;
    sync();
    if (current >= 0 && matches[current]) reveal(true);
    else if (had) (document.activeElement as HTMLElement | null)?.blur();
  }

  // with select, as for Find Next with the panel closed, the match is selected in its block
  function step(way: 1 | -1, select = false): void {
    compute();
    if (!matches.length) {
      current = -1;
      sync();
      return;
    }
    note = null;
    const start = fromSlide();
    if (current < 0 || current >= matches.length) current = way > 0 ? start : (start - 1 + matches.length) % matches.length;
    else current = (current + way + matches.length) % matches.length;
    sync();
    reveal(select);
  }

  async function write(block: Element, list: Span[], label: string): Promise<void> {
    const idx = indexedOf(block);
    if (!idx || !list.length) return;
    await app.doc.setContent(block, replaced(idx, list, replace.input.value), label);
  }

  // the current match is replaced, and with find the next match is shown
  async function replaceCurrent(find: boolean): Promise<void> {
    const m = matches[current];
    if (!m) return;
    const keep = panel.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
    await write(m.block, [m], 'replace');
    note = null;
    compute();
    current = nearest(m.block, m.start + replace.input.value.length);
    sync();
    if (find && current >= 0) reveal(false);
    keep?.focus({ preventScroll: true });
  }

  // every match is replaced with each block written once, and the count of replacements is shown
  async function replaceAll(): Promise<number> {
    compute();
    const total = matches.length;
    if (!total) return 0;
    const keep = panel.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
    // restoreHost of text/typing.ts shows the slide of each block written, hence the slide shown
    // before is shown again
    const slide = app.current();
    const byBlock = new Map<Element, Span[]>();
    for (const m of matches) byBlock.set(m.block, [...(byBlock.get(m.block) ?? []), m]);
    for (const [block, list] of byBlock) await write(block, list, 'replace all');
    if (slide?.isConnected) app.showSlide(slide);
    compute();
    current = -1;
    note = `${total} replaced`;
    sync();
    keep?.focus({ preventScroll: true });
    return total;
  }

  search.input.addEventListener('input', research);
  replace.input.addEventListener('input', () => {
    note = null;
    sync();
  });
  for (const f of [search, replace]) {
    f.clear.addEventListener('click', () => {
      f.input.value = '';
      f.input.dispatchEvent(new Event('input'));
      f.input.focus();
    });
  }
  const fail = (e: unknown) => app.fail(e);
  // Return in the search field finds the next match and Shift+Return the one before. Return in
  // the replace field replaces the current match and finds the next one
  search.input.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' || ev.isComposing) return;
    ev.preventDefault();
    step(ev.shiftKey ? -1 : 1);
  });
  replace.input.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' || ev.isComposing) return;
    ev.preventDefault();
    void app.commands.run('find.replaceAndFind').catch(fail);
  });
  panel.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    ev.preventDefault();
    ev.stopPropagation();
    hide();
  });
  close.addEventListener('click', () => hide());
  previous.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  allButton.addEventListener('click', () => void app.commands.run('find.replaceAll').catch(fail));
  andFindButton.addEventListener('click', () => void app.commands.run('find.replaceAndFind').catch(fail));
  oneButton.addEventListener('click', () => void app.commands.run('find.replaceOne').catch(fail));

  // the matches follow the typing, an undo, and a change of the slides while the panel is open
  app.onRefresh(['content', 'structure'], refresh);
  app.listen('history', () => {
    if (!panel.hidden) queueMicrotask(refresh);
  });

  return {
    get open() {
      return !panel.hidden;
    },
    get mode() {
      return mode;
    },
    options,
    get query() {
      return search.input.value;
    },
    get matches() {
      return matches;
    },
    get current() {
      return current;
    },
    show,
    hide,
    step,
    toggle,
    setMode,
    replaceCurrent,
    replaceAll,
  };
}
