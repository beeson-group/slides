// the speaker notes of the current slide, in a pane under the canvas as in PowerPoint and Keynote,
// in the font of the chrome and at a zoom of their own. the text that is edited is the aside.notes
// of the slide, so that the typing, the history, find, and the save treat it as any other block.
// lay() sets the aside over the box of the pane, in the slide px of its section, at every zoom and
// scroll of the canvas, and its font is divided by the scale of the slide, hence its text keeps
// its size on the screen. while the notes are shown, a slide without notes gets an empty aside to
// type into, which is not written into the file before it has text. the divider above the pane is
// dragged to set its height, and dragged down to the bottom it hides the notes, as in PowerPoint

import type { App, Notes } from './app.ts';
import { button, injectStyle, make, store, stored } from './ui/dom.ts';

declare module './app.ts' {
  interface Notes {
    // the zoom of the text of the notes, 1 at 100 percent
    textZoom(): number;
    // a step up or down the zooms of TEXT_ZOOMS, or back to 100 percent with 0
    zoomText(way: 1 | -1 | 0): void;
  }
}

const PANE_KEY = 'beeson-pane';
const ZOOM_KEY = 'beeson-notes-zoom';
// the heights of the pane in CSS px. a drag of the divider below HIDE hides the notes
const MIN = 80;
const MAX = 600;
const HIDE = 40;
export const TEXT_ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
// the size of the text at 100 percent and the padding of the pane, in CSS px
const FONT = 13;
const PAD = { top: 10, side: 16 };

// the box of the pane and the font are written by lay() in the slide px of the present section:
// --ed-notes-x, -y, -w, and -h, --ed-notes-font, and --ed-notes-pad-t, -s, and -r. the
// section keeps its clip at its edge, widened by the box of the pane in --ed-notes-clip
const CSS = `
html.beeson-editor body > .beeson-edit-pane { display: none; }
html.beeson-editor.beeson-notes body > .beeson-edit-pane { display: block; }
html.beeson-editor .beeson-edit-resize { position: fixed; left: var(--ed-nav-col); right: var(--ed-insp-col); bottom: calc(28px + var(--beeson-pane, 200px) - 4px); height: 8px; z-index: 56; display: none; cursor: row-resize; touch-action: none; }
html.beeson-editor.beeson-notes .beeson-edit-resize { display: block; }
html.beeson-editor .beeson-edit-resize::after { content: ''; position: absolute; left: 50%; top: 2px; width: 36px; height: 4px; margin-left: -18px; border-radius: 2px; background: var(--ed-faint); opacity: 0.6; }
html.beeson-editor .beeson-edit-resize:hover::after, html.beeson-editor .beeson-edit-resize.dragging::after, html.beeson-editor .beeson-edit-resize:focus-visible::after { opacity: 1; background: var(--ed-muted); }
html.beeson-editor .beeson-edit-resize:hover, html.beeson-editor .beeson-edit-resize.dragging, html.beeson-editor .beeson-edit-resize:focus-visible { outline: none; background: linear-gradient(transparent 3px, color-mix(in srgb, var(--ed-select) 55%, transparent) 3px 5px, transparent 5px); }
html.beeson-editor .beeson-edit-notes-zoom { position: fixed; z-index: 57; display: none; align-items: center; gap: 2px; height: 22px; padding: 0 2px; box-sizing: border-box; border: 1px solid var(--ed-line); border-radius: 6px; background: var(--ed-panel); color: var(--ed-muted); font: 11px/1 var(--ed-font); font-variant-numeric: tabular-nums; opacity: 0.7; transition: opacity 120ms; user-select: none; -webkit-user-select: none; }
html.beeson-editor.beeson-notes .beeson-edit-notes-zoom { display: flex; }
html.beeson-editor .beeson-edit-notes-zoom:hover, html.beeson-editor .beeson-edit-notes-zoom:focus-within, html.beeson-editor.beeson-notes-hot .beeson-edit-notes-zoom { opacity: 1; }
html.beeson-editor .beeson-edit-notes-zoom button { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 18px; padding: 0 3px; border: 0; border-radius: 4px; background: transparent; color: var(--ed-text); font: 500 11px/1 var(--ed-font); cursor: default; }
html.beeson-editor .beeson-edit-notes-zoom button.big { font-size: 15px; }
html.beeson-editor .beeson-edit-notes-zoom button:hover { background: var(--ed-hover); }
html.beeson-editor .beeson-edit-notes-zoom button:disabled { color: var(--ed-faint); }
html.beeson-editor .beeson-edit-notes-zoom button:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: -1px; }
html.beeson-editor .beeson-edit-notes-zoom .value { min-width: 34px; text-align: center; }
html.beeson-editor.beeson-notes .reveal .slides section.present { overflow: visible; clip-path: var(--ed-notes-clip, none); }
html.beeson-editor.beeson-notes .reveal .slides section.present > aside.notes { display: block; position: absolute; left: var(--ed-notes-x, 0px); top: var(--ed-notes-y, 100%); width: var(--ed-notes-w, 100%); height: var(--ed-notes-h, 200px); right: auto; bottom: auto; z-index: 100; box-sizing: border-box; margin: 0; padding: var(--ed-notes-pad-t, 10px) var(--ed-notes-pad-r, 16px) var(--ed-notes-pad-t, 10px) var(--ed-notes-pad-s, 16px); --text: var(--ed-text); --subtle: var(--ed-muted); --muted: var(--ed-muted); --line: var(--ed-line); --accent: var(--ed-guide); --violet: var(--ed-select); font-family: var(--ed-font); font-size: var(--ed-notes-font, 13px); font-weight: 400; line-height: 1.5; letter-spacing: normal; text-align: left; color: var(--ed-text); background: var(--ed-panel); box-shadow: inset 0 var(--ed-notes-hair, 1px) var(--ed-line); overflow: auto; overscroll-behavior: contain; outline: var(--ed-notes-hair, 1px) solid transparent; outline-offset: calc(-1 * var(--ed-notes-hair, 1px)); cursor: text; }
html.beeson-editor.beeson-notes .reveal .slides section.present > aside.notes:hover { outline-color: transparent; }
html.beeson-editor.beeson-notes .reveal .slides section.present > aside.notes:focus { outline: calc(2 * var(--ed-notes-hair, 1px)) solid var(--ed-focus); outline-offset: calc(-2 * var(--ed-notes-hair, 1px)); }
html.beeson-editor.beeson-notes .reveal .slides section.present > aside.notes:empty::before { content: 'Click to add notes'; color: var(--ed-faint); }
`;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function install(app: App): void {
  injectStyle('notes', CSS);
  const root = document.documentElement;
  const notesButton = button('Notes', 'Show the speaker notes under the slide');
  notesButton.setAttribute('aria-pressed', 'false');
  // the backdrop of the notes in the grid of the shell, over which the aside is laid
  const pane = make('div', 'beeson-edit-pane');
  pane.setAttribute('aria-hidden', 'true');
  const resizer = make('div', 'beeson-edit-resize');
  resizer.title = 'Drag to change the height of the notes, or down to hide them. When focused, the up and down arrows change it';
  resizer.tabIndex = 0;
  resizer.setAttribute('role', 'separator');
  resizer.setAttribute('aria-orientation', 'horizontal');
  resizer.setAttribute('aria-label', 'Height of the notes');
  resizer.setAttribute('aria-valuemin', String(MIN));
  resizer.setAttribute('aria-valuemax', String(MAX));

  // the zoom of the text, at the upper right of the pane, as the A buttons of the notes of the
  // presenter display of Keynote
  const zoomBox = make('div', 'beeson-edit-notes-zoom');
  zoomBox.setAttribute('role', 'group');
  zoomBox.setAttribute('aria-label', 'Size of the notes text');
  const smaller = button('A', 'Smaller notes text', 'Smaller notes text');
  const bigger = button('A', 'Bigger notes text', 'Bigger notes text');
  bigger.className = 'big';
  const value = make('span', 'value');
  zoomBox.append(smaller, value, bigger);

  let paneHeight = 200;
  let textZoom = 1;
  const shown = () => root.classList.contains('beeson-notes');

  // the aside is laid over the pane, in the slide px of the present section
  function lay(): void {
    if (!shown() || !app.stage) return;
    const slide = app.current();
    const box = pane.getBoundingClientRect();
    if (!slide || !box.height) return;
    const s = app.stage.scale || 1;
    const sec = slide.getBoundingClientRect();
    const px = (v: number) => `${v / s}px`;
    const x = (box.left - sec.left) / s;
    const y = (box.top - sec.top) / s;
    const w = box.width / s;
    const h = box.height / s;
    const set = (name: string, v: string) => root.style.setProperty(name, v);
    set('--ed-notes-x', `${x}px`);
    set('--ed-notes-y', `${y}px`);
    set('--ed-notes-w', `${w}px`);
    set('--ed-notes-h', `${h}px`);
    set('--ed-notes-font', px(FONT * textZoom));
    set('--ed-notes-pad-t', px(PAD.top));
    set('--ed-notes-pad-s', px(PAD.side));
    // the text keeps clear of the zoom control at the top right of the pane
    set('--ed-notes-pad-r', px((zoomBox.offsetWidth || 110) + 14 + PAD.side));
    set('--ed-notes-hair', px(1));
    // the box of the slide and the box of the pane, both drawn clockwise, hence their union
    const W = sec.width / s;
    const H = sec.height / s;
    set('--ed-notes-clip', `path('M0 0H${W}V${H}H0Z M${x} ${y}H${x + w}V${y + h}H${x}Z')`);
    Object.assign(zoomBox.style, { left: '', right: `${innerWidth - box.right + 14}px`, top: `${box.top + 7}px` });
  }

  function setPane(height: number): void {
    paneHeight = clamp(Math.round(height), MIN, MAX);
    root.style.setProperty('--beeson-pane', `${paneHeight}px`);
    resizer.setAttribute('aria-valuenow', String(paneHeight));
    app.relayout();
    app.invalidate('layout');
  }

  function showZoom(): void {
    value.textContent = `${Math.round(textZoom * 100)}%`;
    smaller.disabled = textZoom <= TEXT_ZOOMS[0];
    bigger.disabled = textZoom >= TEXT_ZOOMS[TEXT_ZOOMS.length - 1];
    zoomBox.title = `Notes text at ${Math.round(textZoom * 100)} percent`;
  }

  function setTextZoom(z: number): void {
    textZoom = clamp(Math.round(z * 100) / 100, TEXT_ZOOMS[0], TEXT_ZOOMS[TEXT_ZOOMS.length - 1]);
    store(ZOOM_KEY, String(textZoom));
    showZoom();
    lay();
  }

  function zoomText(way: 1 | -1 | 0): void {
    if (way === 0) return setTextZoom(1);
    const next = way > 0 ? TEXT_ZOOMS.find((z) => z > textZoom + 0.001) : [...TEXT_ZOOMS].reverse().find((z) => z < textZoom - 0.001);
    if (next) setTextZoom(next);
  }

  function ensure(): HTMLElement | null {
    const slide = app.current();
    if (!slide || !app.pairing?.blocks.length || !shown()) return null;
    let aside = slide.querySelector<HTMLElement>(':scope > aside.notes');
    if (!aside) {
      aside = make('aside', 'notes');
      aside.setAttribute('contenteditable', 'true');
      aside.setAttribute('aria-label', 'Speaker notes');
      slide.append(aside);
    }
    return aside;
  }

  function setShown(on: boolean): void {
    root.classList.toggle('beeson-notes', on);
    notesButton.classList.toggle('on', on);
    notesButton.setAttribute('aria-pressed', String(on));
    app.relayout();
    app.invalidate('layout');
  }

  function toggle(): void {
    setShown(!shown());
    if (shown()) ensure()?.focus({ preventScroll: true });
  }

  resizer.addEventListener('keydown', (ev) => {
    const step = ev.key === 'ArrowUp' ? 20 : ev.key === 'ArrowDown' ? -20 : 0;
    if (!step) return;
    ev.preventDefault();
    ev.stopPropagation();
    setPane(paneHeight + step);
    store(PANE_KEY, String(paneHeight));
  });
  resizer.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    const startY = ev.clientY;
    const startHeight = paneHeight;
    let wanted = startHeight;
    resizer.classList.add('dragging');
    const onMove = (e: PointerEvent) => {
      wanted = startHeight + startY - e.clientY;
      setPane(wanted);
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      resizer.classList.remove('dragging');
      // dragged down to the bottom, the notes are hidden, and shown again at their height before
      if (wanted < HIDE) {
        setPane(startHeight);
        setShown(false);
      }
      store(PANE_KEY, String(paneHeight));
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });

  smaller.addEventListener('click', () => zoomText(-1));
  bigger.addEventListener('click', () => zoomText(1));
  // a press on the zoom buttons keeps the caret in the notes
  zoomBox.addEventListener('pointerdown', (ev) => ev.preventDefault());

  const inNotes = (ev: Event) => ev.target instanceof Element && !!ev.target.closest('aside.notes, .beeson-edit-notes-zoom');
  // a pinch or the wheel with Ctrl over the notes zooms their text, as over the notes pane of
  // PowerPoint, and Safari sends a pinch as gesture events
  let pinch: number | null = null;
  window.addEventListener('wheel', (ev) => {
    if (!ev.ctrlKey || !inNotes(ev)) return;
    ev.preventDefault();
    if (pinch === null) setTextZoom(textZoom * Math.exp(-clamp(ev.deltaY, -50, 50) / 200));
  }, { passive: false });
  window.addEventListener('gesturestart', (ev) => {
    if (!inNotes(ev)) return;
    ev.preventDefault();
    pinch = textZoom;
  }, { passive: false });
  window.addEventListener('gesturechange', (ev) => {
    if (pinch === null) return;
    ev.preventDefault();
    setTextZoom(pinch * (ev as Event & { scale: number }).scale);
  }, { passive: false });
  window.addEventListener('gestureend', () => {
    pinch = null;
  });
  // the zoom buttons are brought up while the pointer is over the notes
  document.addEventListener('pointerover', (ev) => root.classList.toggle('beeson-notes-hot', inNotes(ev)));

  app.listen('slide', () => {
    ensure();
    lay();
  });
  app.listen('resize', lay);
  document.body.append(pane, resizer, zoomBox);
  const notes: Notes = { button: notesButton, shown, toggle, ensure, setPane, height: () => paneHeight, textZoom: () => textZoom, zoomText };
  app.notes = notes;
  const kept = Number(stored(ZOOM_KEY));
  textZoom = TEXT_ZOOMS[0] <= kept && kept <= TEXT_ZOOMS[TEXT_ZOOMS.length - 1] ? kept : 1;
  showZoom();
  setPane(Number(stored(PANE_KEY)) || 200);
  installDashes(app);
}

// the dash lists of the speaker notes, which are rich text in Keynote. a line of the notes, i.e.
// the text between two br or lists, is made an item of a ul by the list commands, or by a dash and
// a space typed at its start, and an item is made a line again. Enter in an item starts the next
// one, or ends the list in an empty item, and Backspace at the start of an item makes it a line.
// each change is recorded as the content of the aside before and after

type Caret = { aside: HTMLElement; range: Range; li: HTMLLIElement | null };

function caretOf(app: App): Caret | null {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  const aside = app.hostOf(node instanceof Element ? node : node.parentElement);
  if (!(aside instanceof HTMLElement) || !aside.matches('aside.notes') || !aside.contains(range.endContainer)) return null;
  const li = (node instanceof Element ? node : node.parentElement)?.closest('li');
  return { aside, range, li: li && aside.contains(li) && li.parentElement?.parentElement === aside ? (li as HTMLLIElement) : null };
}

const isBreak = (n: Node | null) => n instanceof Element && (n.localName === 'br' || n.matches('ul, ol, div, p'));
const isInline = (n: Node | null) => !!n && !isBreak(n);

// the children of the aside on the line of the caret, and the br or list on each side of them
function lineOf(c: Caret): { nodes: Node[]; before: Node | null; after: Node | null } {
  const kids = [...c.aside.childNodes];
  const { startContainer: node, startOffset: offset } = c.range;
  let lo: number, hi: number;
  if (node === c.aside) [lo, hi] = [offset - 1, offset];
  else {
    let top: Node = node;
    while (top.parentNode !== c.aside) top = top.parentNode!;
    lo = hi = kids.indexOf(top as ChildNode);
  }
  while (lo >= 0 && !isBreak(kids[lo])) lo--;
  while (hi < kids.length && !isBreak(kids[hi])) hi++;
  return { nodes: kids.slice(lo + 1, hi), before: kids[lo] ?? null, after: kids[hi] ?? null };
}

// the caret at the start of the text of node, or before node where it is a br
function caretAt(node: Node): void {
  if (node instanceof Element && node.localName !== 'br' && node.firstChild) return caretAt(node.firstChild);
  const r = document.createRange();
  if (node instanceof Text) r.setStart(node, 0);
  else r.setStartBefore(node);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(r);
}

const empty = (el: Element) => !el.textContent?.trim() && !el.querySelector('mjx-container, img');

// the line of the caret made an item, joined to a list right before or after it
function toItem(c: Caret): void {
  const { nodes, before, after } = lineOf(c);
  let next = after;
  if (next instanceof Element && next.localName === 'br') {
    const n = next.nextSibling;
    next.remove();
    next = n;
  }
  // a list starts a line, hence the br after a line with text is taken off, and the br of an
  // empty line is kept
  if (before instanceof Element && before.localName === 'br' && isInline(before.previousSibling)) before.remove();
  const li = document.createElement('li');
  li.append(...nodes);
  if (!li.firstChild) li.append(document.createElement('br'));
  const prev = next ? next.previousSibling : c.aside.lastChild;
  let ul: Element;
  if (prev instanceof Element && prev.localName === 'ul') ul = prev;
  else {
    ul = document.createElement('ul');
    c.aside.insertBefore(ul, next);
  }
  ul.append(li);
  if (ul.nextSibling instanceof Element && ul.nextSibling.localName === 'ul') {
    const rest = ul.nextSibling;
    ul.append(...rest.childNodes);
    rest.remove();
  }
  caretAt(li);
}

// li made a line of the aside in its place, which cuts its list in two. an empty line is a br
function toLine(aside: HTMLElement, li: HTMLLIElement): void {
  const ul = li.parentElement!;
  const items = [...ul.children];
  const at = items.indexOf(li);
  const ref = ul.nextSibling;
  const line = empty(li) ? [] : [...li.childNodes];
  const rest = items.slice(at + 1);
  const out: Node[] = [];
  if (at === 0 && isInline(ul.previousSibling)) out.push(document.createElement('br'));
  out.push(...line);
  if (!line.length || (!rest.length && isInline(ref))) out.push(document.createElement('br'));
  if (rest.length) {
    const tail = document.createElement('ul');
    tail.append(...rest);
    out.push(tail);
  }
  li.remove();
  for (const n of out) aside.insertBefore(n, ref);
  if (!ul.children.length) ul.remove();
  caretAt(line[0] ?? out.find((n) => n instanceof Element && n.localName === 'br')!);
}

// fn run on the aside of c as one input of typing, which the command around it names
function change(app: App, c: Caret, fn: () => void): void {
  app.history.beforeTyping(c.aside);
  fn();
  app.history.afterTyping(c.aside);
  app.markDirty();
  app.invalidate('content');
}

// ul at an item of the notes, none on another line of the notes, and null outside the notes
export function notesListKind(app: App): 'ul' | 'none' | null {
  const c = caretOf(app);
  return !c ? null : c.li ? 'ul' : 'none';
}

// the notes take dashes and lines, and not numbers
export function canSetNotesList(app: App, kind: 'none' | 'ul' | 'ol'): boolean {
  return kind !== 'ol' && notesListKind(app) !== null;
}

export function setNotesList(app: App, kind: 'none' | 'ul' | 'ol'): void {
  const c = caretOf(app);
  if (!c || kind === 'ol' || (kind === 'ul') === !!c.li) return;
  change(app, c, () => (c.li ? toLine(c.aside, c.li) : toItem(c)));
}

export const canSplitNotesItem = (app: App): boolean => !!caretOf(app)?.li;

// the text of the item after the caret is made the next item, and an empty item is made a line
export function splitNotesItem(app: App): void {
  const c = caretOf(app);
  if (!c?.li) return;
  const li = c.li;
  change(app, c, () => {
    if (empty(li)) return toLine(c.aside, li);
    c.range.deleteContents();
    const tail = document.createRange();
    tail.setStart(c.range.startContainer, c.range.startOffset);
    tail.setEnd(li, li.childNodes.length);
    const next = document.createElement('li');
    next.append(tail.extractContents());
    // an empty item holds a br, without which the caret cannot be put into it
    for (const item of [li, next]) if (empty(item)) item.replaceChildren(document.createElement('br'));
    li.after(next);
    caretAt(next);
  });
}

// whether the caret is collapsed at the start of an item of the notes
export function canJoinNotesItem(app: App): boolean {
  const c = caretOf(app);
  if (!c?.li || !c.range.collapsed) return false;
  const r = document.createRange();
  r.setStart(c.li, 0);
  r.setEnd(c.range.startContainer, c.range.startOffset);
  return r.toString() === '' && !r.cloneContents().querySelector('mjx-container, img');
}

export function joinNotesItem(app: App): void {
  const c = caretOf(app);
  if (c?.li) change(app, c, () => toLine(c.aside, c.li!));
}

// a dash and a space typed at the start of a line of the notes make it an item, as an entry of
// the history after the typing, named as the list command
function installDashes(app: App): void {
  let typed = false;
  document.addEventListener('beforeinput', (ev) => {
    typed = ev.inputType === 'insertText' && !ev.defaultPrevented && ev.data === ' ';
  });
  document.addEventListener('input', () => {
    if (!typed) return;
    typed = false;
    const c = caretOf(app);
    if (!c || c.li || !c.range.collapsed) return;
    const first = lineOf(c).nodes[0];
    if (!(first instanceof Text) || c.range.startContainer !== first || c.range.startOffset !== 2 || !/^[-–][  ]/u.test(first.data)) return;
    void app.history.transact('Dashes', () => change(app, c, () => {
      first.deleteData(0, 2);
      if (first.data) c.range.setStart(first, 0);
      else {
        c.range.setStartBefore(first);
        first.remove();
      }
      toItem(c);
    })).catch((e) => app.fail(e));
  });
}
