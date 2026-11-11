// the commands of the tables of the slides, as in Keynote and PowerPoint. Insert > Table… and the
// Table button of the toolbar open a grid of up to 10 columns by 8 rows, as the Insert Table grid of
// PowerPoint, and a click puts a table of the size chosen at its place in the layout, with a header
// row of th and the caret in its first cell. Insert Table… under the grid asks for a larger size. each cell is a block of the editor. Tab and Shift+Tab
// go to the next and the previous cell, Tab in the last cell adds a row, and an arrow key at the
// edge of a cell goes to the cell beside it. rows and columns are added and deleted from Format >
// Table, the context menu of a cell, the row and column bars around the table, and the Table pane
// of the inspector. a paste of tab-separated text or of an HTML table onto the slide is written as
// a new table, and a paste into a cell fills the cells from it on. a range of cells is selected by
// a drag across cells, a Shift-click, Esc in a cell, or Select Row and Select Column, and is merged
// and unmerged as a colspan and a rowspan. the widths of the columns are set by a drag of a border
// in the bar of the columns, Distribute Columns Evenly, and Resize Column to Fit Content, and are
// written in the style of the cells of the first row. Auto-Align sets the columns of numbers at the
// right. the handle at the lower right corner of the cells selected as a block is dragged over the
// cells beside them, which are filled as Autofill of Keynote fills them. each change is one entry
// of the history, written through app.doc
//
// while the caret is in a cell, or a table is selected, the table is drawn as a selected table of
// Keynote: a bar of the column letters above it and a bar of the row numbers at its left, with the
// columns and the rows of the caret or of the range marked, a round button at the end of each bar
// that adds a column or a row, a round button at the upper left that selects the table, and an
// outline around the cell of the caret or the range

import type { App } from '../app.ts';
import { overlay } from '../canvas/frames.ts';
import { keysOf, type Command } from '../commands.ts';
import { matches } from '../keymap.ts';
import { childSpace } from '../render.ts';
import { contentWithTex, mathLookup } from '../math.ts';
import { emptySlot } from '../media/actions.ts';
import { textStyle } from '../model/templates.ts';
import {
  CELL, GRID, MOST, around, fillLine, boxOf, cellAfter, cellBeside, cellHtml, cellOver, columnName, columnsOf, emptyRows, gridOf, grow, hasHeader, numericOf, sortOrder,
  parseHtmlTable, parseTabular, placeOf, placesOf, rowHtml, spotsIn, tableHtml, type Box, type Place,
} from '../table.ts';
import { placeCaret } from '../text/typing.ts';
import { Dialog } from '../ui/dialog.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { closeMenus, menuOpen, openMenu, type MenuItem } from '../ui/menu.ts';
import { columnPlace, freeZone, meets, slideBox, takenBox, type Box as SlideBox } from './insert.ts';
import { MARK } from './slide.ts';

// the widths of the frame of the cell of the caret and of the cells selected as a block
const FRAME = 2;
const FRAME_BLOCK = 4;
const CSS = `
html.beeson-editor .reveal .slides :is(td,th):empty{height:1.4em;width:3.5em}
html.beeson-editing .reveal .slides :is(td,th)[contenteditable="true"]:focus{outline:none}
.beeson-table-picker{position:fixed;z-index:90;inset:auto;margin:0;padding:8px 10px 10px;border:1px solid var(--ed-menu-line);border-radius:10px;background:var(--ed-menu);color:var(--ed-text);font:13px/1.25 var(--ed-font);box-shadow:0 10px 32px #0003;-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);user-select:none;-webkit-user-select:none}
.beeson-table-picker .size{margin:0 1px 8px;font-weight:600}
.beeson-table-picker .grid{display:grid;grid-template-columns:repeat(${GRID.columns},20px);grid-auto-rows:20px;gap:3px;outline:none}
.beeson-table-picker .grid:focus-visible{outline:2px solid var(--ed-focus);outline-offset:3px}
.beeson-table-picker .grid>div{border:1px solid var(--ed-control-line);border-radius:3px;background:var(--ed-control)}
.beeson-table-picker .grid>div:nth-child(-n+${GRID.columns}){border-top-width:3px}
.beeson-table-picker .grid>.on{border-color:var(--ed-select);background:color-mix(in srgb,var(--ed-select) 22%,var(--ed-control))}
.beeson-table-picker .foot{margin:9px 1px 0;color:var(--ed-muted);font-size:11px}
.beeson-table-picker .more{display:block;width:100%;margin:8px 0 0;padding:4px 8px;border:0;border-top:1px solid var(--ed-menu-line);border-radius:0 0 4px 4px;background:transparent;color:var(--ed-text);font:inherit;text-align:left;cursor:default}
.beeson-table-picker .more:hover,.beeson-table-picker .more:focus-visible{outline:none;border-radius:5px;background:var(--ed-select);color:var(--ed-on-select)}
dialog.beeson-table-size .fields{display:grid;grid-template-columns:auto 72px;gap:8px 12px;align-items:center;margin:4px 0 18px}
dialog.beeson-table-size .fields input{box-sizing:border-box;width:100%;padding:3px 6px;border:1px solid var(--ed-control-line);border-radius:6px;background:var(--ed-field,var(--ed-control));color:var(--ed-text);font:inherit;font-variant-numeric:tabular-nums}
dialog.beeson-table-size .fields input:focus-visible{outline:3px solid var(--ed-focus);outline-offset:0}
.beeson-table-bars .fill{width:11px;height:11px;border-radius:50%;background:#ffc400;box-shadow:0 0 0 1.5px #fff,0 0 0 2.5px #0006;cursor:crosshair;touch-action:none}
.beeson-table-bars .corner{width:11px;height:11px;border-radius:50%;background:#fff;box-shadow:0 0 0 1.5px var(--ed-select),0 0 0 2.5px #0004;touch-action:none}
.beeson-table-bars .corner[data-corner="upper-left"]{cursor:nwse-resize}
.beeson-table-bars .corner:not([data-corner="upper-left"]){cursor:nesw-resize}
.beeson-table-bars :is(.fill,.corner,.spread,.beeson-grip)[hidden]{display:none}
.beeson-table-bars .beeson-grip{box-sizing:content-box}
.beeson-table-bars .spread{border:2px dashed #e0a800;border-radius:2px;pointer-events:none}
html.beeson-autofilling,html.beeson-autofilling *{cursor:crosshair!important}
.beeson-table-bars{position:fixed;inset:0;z-index:52;pointer-events:none}
.beeson-table-bars[hidden]{display:none}
.beeson-table-bars>*{position:fixed;box-sizing:border-box;pointer-events:auto;cursor:default}
.beeson-table-bars .bar{border-radius:5px;background:var(--ed-panel);box-shadow:0 0 0 1px var(--ed-control-line);color:var(--ed-muted);font:10px/1 var(--ed-font);overflow:hidden}
.beeson-table-bars .bar>div{position:absolute;display:grid;place-items:center;box-shadow:-1px -1px 0 var(--ed-line)}
.beeson-table-bars .bar>div:hover{background:var(--ed-hover);color:var(--ed-text)}
.beeson-table-bars .bar .more{position:absolute;right:2px;top:50%;display:grid;width:14px;height:14px;margin-top:-7px;border-radius:3px;opacity:0}
.beeson-table-bars .bar.rows .more{right:auto;left:50%;top:auto;bottom:1px;margin:0 0 0 -7px}
.beeson-table-bars .bar>:hover>.more{opacity:1}
.beeson-table-bars .bar .more:hover{background:var(--ed-control-line)}
.beeson-table-bars .bar>.on{background:color-mix(in srgb,var(--ed-select) 20%,transparent);color:var(--ed-text);font-weight:600}
.beeson-table-bars .round{padding:0;border:0;border-radius:50%;display:grid;place-items:center;background:var(--ed-panel);box-shadow:0 0 0 1px var(--ed-control-line);color:var(--ed-select)}
.beeson-table-bars .round:hover{background:var(--ed-hover)}
.beeson-table-bars .cell{border:${FRAME}px solid var(--ed-select);border-radius:2px;pointer-events:none}
.beeson-table-bars .grips{position:static}
.beeson-table-bars .grip{position:fixed;cursor:col-resize;touch-action:none}
.beeson-table-bars .grip::after{content:"";position:absolute;left:4px;top:3px;bottom:3px;width:1px;background:var(--ed-muted);opacity:0}
.beeson-table-bars .grip:hover::after,html.beeson-column-resizing .beeson-table-bars .grip::after{opacity:1;background:var(--ed-select)}
.beeson-table-bars .guide{width:1px;background:var(--ed-select);pointer-events:none}
.beeson-table-bars .guide[hidden]{display:none}
html.beeson-column-resizing,html.beeson-column-resizing *{cursor:col-resize!important}
html.beeson-cell-range .reveal *{user-select:none!important;-webkit-user-select:none!important}
.beeson-table-bars .cell.block{border-width:${FRAME_BLOCK}px;background:color-mix(in srgb,var(--ed-select) 12%,transparent)}
`;

// the size of the bars and of their buttons, in screen px, and the gap between a bar and its table
const BAR = 18;
const GAP = 6;
// the width of the grip on the border of two columns, in screen px
const GRIP = 9;

type Target = { table: HTMLTableElement; cell: HTMLTableCellElement | null; box: Box | null };
// a size typed into Insert Table… is kept in full, while one from the grid loses the rows that do
// not fit on the slide
type Size = { rows: number; columns: number };

const isCell = (el: unknown): el is HTMLTableCellElement => el instanceof HTMLTableCellElement;

// the cell of the caret or of the text selected on the current slide, which is a block of the file
export function cellAt(app: App): HTMLTableCellElement | null {
  const sel = app.selection;
  const item = sel.kind === 'text' ? sel.items[0] : app.hostOf(document.activeElement);
  if (!isCell(item) || !app.current()?.contains(item) || !app.pairing?.byLive.has(item)) return null;
  const table = item.closest('table');
  return table && app.pairing.elements.get(table)?.open ? item : null;
}

// the cells selected as a block, as cells selected in Keynote, after Esc in the text of a cell, a
// drag across cells, or a Shift-click: the table is the selection, and the commands of the table
// act at the range from the anchor to the focus, grown over merged cells. caretCell is the last
// cell of the caret, which Esc leaves
let block: { anchor: HTMLTableCellElement; focus: HTMLTableCellElement } | null = null;
let caretCell: HTMLTableCellElement | null = null;
// the range reached by the fill handle while it is dragged, which the Table pane counts
let reaching: { table: HTMLTableElement; box: Box } | null = null;
export const fillRange = (table: HTMLTableElement): Box | null => (reaching?.table === table ? reaching.box : null);

function syncCell(app: App): void {
  const c = cellAt(app);
  if (c) {
    caretCell = c;
    block = null;
    return;
  }
  const only = app.selection.only();
  const kept = (x: Element | null): x is HTMLTableCellElement => !!x?.isConnected && !!only?.contains(x);
  if (!(only instanceof HTMLTableElement)) block = null;
  else if (!block || !kept(block.anchor) || !kept(block.focus)) block = kept(caretCell) ? { anchor: caretCell, focus: caretCell } : null;
  // Esc blurs the text before it selects the table, and the selection is empty in between
  if (app.selection.kind !== 'none') caretCell = null;
}

const inside = (a: Box, b: Box) => a.r0 >= b.r0 && a.c0 >= b.c0 && a.r1 <= b.r1 && a.c1 <= b.c1;

// the range of the cells selected as a block in table, or null
function rangeIn(table: HTMLTableElement): Box | null {
  const a = block && block.anchor.closest('table') === table ? placeOf(block.anchor) : null;
  const f = block && a ? placeOf(block.focus) : null;
  return a && f ? grow(gridOf(table), around(boxOf(a), boxOf(f))) : null;
}

// the table of the caret, or the one selected table, with the cell given in arg, e.g. by the
// context menu of a cell or a bar, else the cell of the caret or the focus of the cells selected
// as a block. the box is the range selected as a block where it holds the cell, else its cell
export function targetOf(app: App, arg?: unknown): Target | null {
  syncCell(app);
  const given = arg && typeof arg === 'object' && 'cell' in arg ? (arg as { cell: unknown }).cell : null;
  const cell = isCell(given) && given.isConnected ? given : cellAt(app) ?? block?.focus ?? null;
  if (cell) {
    const table = cell.closest('table') as HTMLTableElement;
    const own = boxOf(placeOf(cell)!);
    const range = rangeIn(table);
    return { table, cell, box: range && inside(own, range) ? range : own };
  }
  const only = app.selection.only();
  if (only instanceof HTMLTableElement && app.pairing?.elements.get(only)?.open) return { table: only, cell: null, box: null };
  return null;
}

// the cells from anchor to focus selected as a block, with the table as the selection
function selectCells(app: App, anchor: HTMLTableCellElement, focus: HTMLTableCellElement): void {
  const table = anchor.closest('table') as HTMLTableElement;
  const host = app.hostOf(document.activeElement);
  if (host instanceof HTMLElement) host.blur();
  window.getSelection()?.removeAllRanges();
  if (app.selection.only() !== table) app.selection.set('elements', [table]);
  block = { anchor, focus };
  caretCell = null;
  app.invalidate('selection');
}

// the table selected as an object, without a cell selected, as after Select Table of Keynote
function selectTable(app: App, table: HTMLTableElement): void {
  const host = app.hostOf(document.activeElement);
  if (host instanceof HTMLElement) host.blur();
  window.getSelection()?.removeAllRanges();
  app.selection.set('elements', [table]);
  block = null;
  caretCell = null;
  app.invalidate('selection');
}

// whether table is selected as an object, which its move handle and its edge grips act on
const asObject = (app: App, table: HTMLTableElement) => app.selection.only() === table && !inBlock(app) && !cellAt(app);

// a cell of the file on the current slide at target
function liveCell(target: EventTarget | null): HTMLTableCellElement | null {
  const app = current;
  const cell = target instanceof Element ? target.closest(CELL) : null;
  return app && isCell(cell) && app.pairing?.byLive.has(cell) && app.current()?.contains(cell) ? cell : null;
}

// whether cell is in the range of the cells selected as a block
function inRange(cell: HTMLTableCellElement): boolean {
  const app = current;
  if (!app || !inBlock(app)) return false;
  const range = rangeIn(cell.closest('table') as HTMLTableElement);
  const p = placeOf(cell);
  return !!range && !!p && inside(boxOf(p), range);
}

// true while cells of a table are selected as a block, and not a text
function inBlock(app: App): boolean {
  syncCell(app);
  return !!block && app.selection.only() === block.anchor.closest('table') && !cellAt(app);
}

// the caret is put into a cell, at its start or its end, or over all of its text
export function focusCell(cell: Element, at: 'start' | 'end' | 'all' = 'all'): void {
  if (!(cell instanceof HTMLElement)) return;
  if (at !== 'all') return placeCaret(cell, at === 'start' ? 0 : null);
  cell.focus({ preventScroll: true });
  window.getSelection()?.selectAllChildren(cell);
}

// the collapsed range of the caret in cell, or null for a range or a caret elsewhere
function caretIn(cell: Element): Range | null {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return null;
  const r = sel.getRangeAt(0);
  return r.collapsed && cell.contains(r.startContainer) ? r : null;
}

// the text of cell before or after the caret, without white space
function besideCaret(cell: Element, r: Range, way: 'before' | 'after'): string {
  const part = document.createRange();
  part.selectNodeContents(cell);
  if (way === 'before') part.setEnd(r.startContainer, r.startOffset);
  else part.setStart(r.startContainer, r.startOffset);
  const frag = part.cloneContents();
  return (frag.textContent ?? '').replace(/\s/g, '') + (frag.querySelector('mjx-container, br, img') ? '*' : '');
}

// whether the caret in cell is on the first or the last line of its text, or the cell is empty
function onEdgeLine(cell: Element, r: Range, line: 'first' | 'last'): boolean {
  const caret = r.getClientRects()[0] ?? r.getBoundingClientRect();
  const all = document.createRange();
  all.selectNodeContents(cell);
  const box = all.getBoundingClientRect();
  if (!caret.height || !box.height) return true;
  return line === 'first' ? caret.top - box.top < caret.height / 2 : box.bottom - caret.bottom < caret.height / 2;
}

// the white space before a child of parent in the file, and the indentation of the deck
function styleOf(app: App) {
  const source = app.source;
  if (!source) throw new Error('no file is open');
  return { ...textStyle(source.text), eol: source.crlf ? '\r\n' : '\n' };
}

function baseOf(app: App, parent: Element): string {
  const src = app.pairing?.elements.get(parent);
  if (!src) throw new Error(`the ${parent.localName} is not in the file`);
  const style = styleOf(app);
  const space = childSpace(src, style.eol, style.step);
  return space.slice(space.lastIndexOf('\n') + 1);
}

const right = (cell: Element) => (cell as HTMLElement).style.textAlign === 'right';

// the text of a cell with a formula read as its TeX, e.g. 2.69 for \(2.69\)
function cellText(cell: Element): string {
  const tex = mathLookup();
  let out = '';
  const walk = (n: Node) => {
    if (n instanceof Element && n.localName === 'mjx-container') out += tex(n)?.tex ?? '';
    else if (n.nodeType === 3) out += (n as Text).data;
    else n.childNodes.forEach(walk);
  };
  walk(cell);
  return out;
}

// the columns of numbers of a table, with a formula read as its TeX
const numbersOf = (table: HTMLTableElement): boolean[] => numericOf(table, cellText);

// the body rows of a table that a sort reorders: the rows of its first tbody after the header rows,
// i.e. the rows of th only. null when a cell of the body reaches over two rows, since Keynote does
// not sort the rows of a merged cell, or when fewer than two rows are left
function sortable(table: HTMLTableElement): HTMLTableRowElement[] | null {
  const body = table.tBodies[0];
  if (!body) return null;
  const rows = [...body.rows];
  while (rows.length && rows[0].cells.length && [...rows[0].cells].every((c) => c.localName === 'th')) rows.shift();
  if (rows.length < 2 || rows.some((tr) => [...tr.cells].some((c) => c.rowSpan !== 1))) return null;
  return rows;
}

// the body rows of the table of t reordered by the column of its cell, each row moved in the file
// before the row that takes its place, as one entry of the history
async function sortRows(app: App, t: Target, descending: boolean): Promise<void> {
  const rows = sortable(t.table);
  const col = t.box?.c0;
  if (!rows || col === undefined) return;
  const g = gridOf(t.table);
  const all = [...t.table.rows];
  const keys = rows.map((tr) => {
    const s = g.grid[all.indexOf(tr)]?.[col];
    return s ? cellText(s.cell) : '';
  });
  const order = sortOrder(keys, descending).map((i) => rows[i]);
  const label = descending ? 'sort descending' : 'sort ascending';
  for (const [i, tr] of order.entries()) {
    const now = sortable(t.table)!;
    if (now[i] !== tr) await app.doc.move(tr, now[i].parentElement!, now[i], label);
  }
}

// a table of rows of cells put at its place in the layout of the current slide, and then moved
// where it fits by placeTable, with every row, or put into the empty zone into
async function insertTable(app: App, rows: string[][], into: Element | null = null): Promise<HTMLTableElement> {
  const { parent, before } = into ? { parent: into, before: null } : columnPlace(app, app.current()!);
  const [table] = await app.doc.insert(tableHtml(rows, styleOf(app), baseOf(app, parent)), parent, before, 'insert table');
  if (!into) placeTable(app, table as HTMLTableElement);
  return table as HTMLTableElement;
}

// a new empty table of size, as one entry of the history, with the caret in its first cell
async function newTable(app: App, size: Size, into: Element | null = null): Promise<void> {
  const rows = Math.max(1, Math.min(MOST.rows, Math.round(size.rows)));
  const columns = Math.max(1, Math.min(MOST.columns, Math.round(size.columns)));
  const table = await app.history.transact('Insert Table', () => insertTable(app, emptyRows(rows, columns), into));
  const first = table.rows[0]?.cells[0];
  if (first) placeCaret(first, 0);
}

// the table picker opened at anchor, e.g. by the table button of the placeholder of an empty zone,
// whose table is put into the zone
export function pickTableInto(app: App, zone: Element, anchor: DOMRect): void {
  const fail = (e: unknown) => app.fail(e);
  const into = (size: Size) => (zone.isConnected ? newTable(app, size, zone) : Promise.resolve()).catch(fail);
  openPicker(app, anchor, (s) => void into(s), (rested) => void askSize(app, rested).then((s) => s && into(s)).catch(fail));
}

// the band in slide px over the bottom of the slide, where the slide number is drawn, and over the
// footnote line, which a new table does not reach into
const BOTTOM = 40;
// the step in slide px of the grid on which a new table looks for a free place
const STEP = 20;

// a new table put where it fits on its slide, with every row and with room around it for its bars
// at the zoom of the canvas: under the blocks before it, else at the center of the free area where
// the layout puts a zone, else at the free place nearest to it at the right of the text or below it,
// and else at the center of the slide over what is there, as Keynote inserts a table, where the
// fill of the theme hides what is under it. the space that an element takes is the rule takenBox of
// insert.ts. the move is a translate in slide px
function placeTable(app: App, table: HTMLTableElement): void {
  const slide = table.closest('section');
  const parent = table.parentElement;
  if (!slide || !parent || !table.getClientRects().length) return;
  const t = slideBox(app, table);
  const k = table.getBoundingClientRect().width / (table.offsetWidth || 1) || 1;
  const room = (GAP + BAR + 2) / k;
  const w = (slide as HTMLElement).offsetWidth || 1920;
  const h = (slide as HTMLElement).offsetHeight || 1080;
  const foot = [...slide.querySelectorAll(':scope > .foot')].map((f) => takenBox(app, f)).find((b) => !!b);
  const floor = Math.min(h - BOTTOM, foot ? foot.top - BOTTOM : Infinity);
  const skip = (el: Element) => el === table || el.matches('aside.notes, script, style');
  const taken = (els: Element[]) => els.filter((el) => !skip(el)).map((el) => ({ el, box: takenBox(app, el) })).filter((o): o is { el: Element; box: SlideBox } => !!o.box);
  const above = [...parent.children].slice(0, [...parent.children].indexOf(table)).filter((el) => !el.matches('.run, .foot, [data-generated]'));
  const before = taken(above).map((o) => o.box);
  const all = taken([...slide.querySelectorAll(':scope > *, :scope > .col > *, :scope > .panel > *')].filter((el) => !el.contains(table)));
  const others = all.map((o) => o.box);
  const tw = t.right - t.left;
  const th = t.bottom - t.top;
  const at = (left: number, top: number): SlideBox => ({ left, top, right: left + tw, bottom: top + th });
  // a box measured at the zoom of the canvas may pass the floor by a fraction of a slide px
  const free = (b: SlideBox) => b.top - room >= 0 && b.bottom <= floor + 1 && b.right + room <= w &&
    !others.some((o) => meets({ left: b.left - room, top: b.top - room, right: b.right + room, bottom: b.bottom + room }, o));
  const top = Math.max(t.top, ...before.map((b) => b.bottom + room));
  let best: SlideBox | null = null;
  let place: SlideBox | null = free(at(t.left, top)) ? at(t.left, top) : null;
  const zone = place ? null : freeZone(app, slide, table);
  if (zone) {
    const b = at((zone.left + zone.right - tw) / 2, (zone.top + zone.bottom - th) / 2);
    if (free(b)) place = b;
  }
  // the free places on a grid of STEP px under the heading of the slide, the nearest one taken
  const head = slide.querySelector(':scope > h2, :scope > h1');
  const under = head ? (takenBox(app, head)?.bottom ?? 0) + room : room;
  let near = Infinity;
  for (let y = under; !place && y + th <= floor; y += STEP) {
    for (let x = room; x + tw + room <= w; x += STEP) {
      const d = Math.hypot(x - t.left, y - top);
      if (d < near && free(at(x, y))) {
        near = d;
        best = at(x, y);
      }
    }
  }
  place ??= best;
  place ??= at((w - tw) / 2, (h - th) / 2);
  const x = Math.round(place.left - t.left);
  const y = Math.round(place.top - t.top);
  if (x || y) app.doc.setTag(table, { translate: { x, y } }, 'insert table');
}

const boxOfTarget = (t: Target): Box | null => t.box;

const spanText = (n: number) => (n > 1 ? String(n) : null);

// a row added above or below the cells of t, or at the end. a cell that reaches across the line of
// the new row grows by a row, and each other column gets a cell, set at the right in a column of
// numbers. a row added above a header row is a header row
async function addRow(app: App, t: Target, below: boolean): Promise<HTMLTableRowElement> {
  const g = gridOf(t.table);
  const rows = [...t.table.rows];
  const box = boxOfTarget(t);
  const n = box ? (below ? box.r1 + 1 : box.r0) : below ? rows.length : rows.length - 1;
  const grown = new Set<Place>();
  const cols: number[] = [];
  for (let c = 0; c < g.width; c++) {
    const s = g.grid[n - 1]?.[c];
    if (s && s.row + s.rows > n) grown.add(s);
    else cols.push(c);
  }
  const head = hasHeader(t.table) && n === 0;
  const aligned = (c: number) => g.grid.some((r) => r[c]?.cell.localName === 'td' && right(r[c]!.cell));
  const tag = head ? 'th' : 'td';
  const text = rowHtml(cols.map((c) => ({ tag, right: !head && aligned(c) })));
  const next = rows[n];
  const parent = (next ?? rows[n - 1]).parentElement!;
  const [tr] = await app.doc.insert(text, parent, next ?? rows[n - 1].nextSibling, below ? 'add row below' : 'add row above');
  for (const s of grown) app.doc.setTag(s.cell, { attrs: { rowspan: spanText(s.rows + 1) } }, 'add row');
  return tr as HTMLTableRowElement;
}

// a column added before or after the cells of t, or at the end. a cell that reaches across the line
// of the new column grows by a column, and each other row gets a cell, a th next to a th
async function addColumn(app: App, t: Target, after: boolean): Promise<HTMLTableCellElement | null> {
  const g = gridOf(t.table);
  const box = boxOfTarget(t);
  const b = box ? (after ? box.c1 + 1 : box.c0) : after ? g.width : g.width - 1;
  const home = box?.r0 ?? -1;
  const grown = new Set<Place>();
  let mine: HTMLTableCellElement | null = null;
  for (const [r, tr] of [...t.table.rows].entries()) {
    const s = g.grid[r][b - 1];
    if (s && s.col + s.span > b) {
      grown.add(s);
      if (r === home) mine = s.cell;
      continue;
    }
    const near = s ?? g.grid[r][b];
    const tag = near?.cell.localName === 'th' ? 'th' : 'td';
    const before = g.spots[r].find((x) => x.col >= b)?.cell ?? null;
    const [cell] = await app.doc.insert(cellHtml(tag), tr, before, after ? 'add column after' : 'add column before');
    if (r === home) mine = cell as HTMLTableCellElement;
  }
  for (const s of grown) app.doc.setTag(s.cell, { attrs: { colspan: spanText(s.span + 1) } }, 'add column');
  return mine;
}

// true while the table of t is the selection and its cell is selected as a block, not its text
const blocked = (app: App, t: Target) => app.selection.only() === t.table && !cellAt(app);

// the cell after an edit: selected as a block in the block state, and else with the caret in it
function land(app: App, cell: Element | null | undefined, at: 'start' | 'end', asBlock: boolean): void {
  if (!isCell(cell)) return;
  if (!asBlock) return focusCell(cell, at);
  selectCells(app, cell, cell);
}

// the rows left without a cell taken out, and each cell that reached over one a row shorter
async function dropEmptyRows(app: App, table: HTMLTableElement, label: string): Promise<void> {
  for (let r = table.rows.length - 1; r >= 0; r--) {
    const tr = table.rows[r];
    if (tr.cells.length) continue;
    const g = gridOf(table);
    for (const s of new Set(g.grid[r].filter((x): x is Place => !!x))) app.doc.setTag(s.cell, { attrs: { rowspan: spanText(s.rows - 1) } }, label);
    await app.doc.remove(tr, label);
  }
}

// one row taken out. a cell that starts in it and reaches below it is moved to the row below, and a
// cell from a row above that reaches over it gets a row less
async function removeRow(app: App, table: HTMLTableElement, r: number): Promise<void> {
  const g = gridOf(table);
  for (const s of new Set(g.grid[r].filter((x): x is Place => !!x))) {
    if (s.rows === 1) continue;
    if (s.row === r) {
      const before = g.spots[r + 1].find((x) => x.col > s.col)?.cell ?? null;
      await app.doc.move(s.cell, table.rows[r + 1], before, 'delete row');
    }
    app.doc.setTag(s.cell, { attrs: { rowspan: spanText(s.rows - 1) } }, 'delete row');
  }
  await app.doc.remove(table.rows[r], 'delete row');
}

// the rows of the cells of t taken out, or the table with its last rows
async function deleteRow(app: App, t: Target): Promise<void> {
  const box = boxOfTarget(t);
  if (!box) return;
  if (box.r1 - box.r0 + 1 >= t.table.rows.length) return deleteTable(app, t);
  const asBlock = blocked(app, t);
  for (let r = box.r1; r >= box.r0; r--) await removeRow(app, t.table, r);
  const row = Math.min(box.r0, t.table.rows.length - 1);
  land(app, cellOver(t.table, row, box.c0) ?? t.table.rows[row].cells[0], 'end', asBlock);
}

// one column taken out. a cell that reaches over another column gets a column less
async function removeColumn(app: App, table: HTMLTableElement, c: number): Promise<void> {
  const g = gridOf(table);
  for (const s of new Set(g.grid.map((row) => row[c]).filter((x): x is Place => !!x))) {
    if (s.span > 1) app.doc.setTag(s.cell, { attrs: { colspan: spanText(s.span - 1) } }, 'delete column');
    else await app.doc.remove(s.cell, 'delete column');
  }
}

// the rows or the columns of a table added or taken out at its end, until it has count of them,
// as the fields Rows and Columns of the Table tab of Keynote set them. the selection is kept, and a
// cell taken out is dropped from it
export async function setCount(app: App, table: HTMLTableElement, kind: 'rows' | 'columns', count: number): Promise<void> {
  const n = Math.max(1, Math.min(MOST[kind], Math.round(count)));
  const t = { table, cell: null, box: null };
  if (kind === 'rows') {
    while (table.rows.length < n) await addRow(app, t, true);
    while (table.rows.length > n) await removeRow(app, table, table.rows.length - 1);
    return;
  }
  while (columnsOf(table) < n) await addColumn(app, t, true);
  while (columnsOf(table) > n) await removeColumn(app, table, columnsOf(table) - 1);
  await dropEmptyRows(app, table, 'delete column');
}

// the columns of the cells of t taken out, or the table with its last columns. a cell that reaches
// over another column gets a column less, and a row left without a cell is taken out
async function deleteColumn(app: App, t: Target): Promise<void> {
  const box = boxOfTarget(t);
  if (!box) return;
  if (box.c1 - box.c0 + 1 >= columnsOf(t.table)) return deleteTable(app, t);
  const asBlock = blocked(app, t);
  for (let c = box.c1; c >= box.c0; c--) await removeColumn(app, t.table, c);
  await dropEmptyRows(app, t.table, 'delete column');
  const row = Math.min(box.r0, t.table.rows.length - 1);
  const col = Math.min(box.c0, columnsOf(t.table) - 1);
  land(app, cellOver(t.table, row, col) ?? t.table.rows[row]?.cells[0], 'end', asBlock);
}

async function deleteTable(app: App, t: Target): Promise<void> {
  app.selection.clear();
  await app.doc.remove(t.table, 'delete table');
}

// the first row made a row of th, or a row of td again, with the caret kept in its cell
async function setHeader(app: App, t: Target, on: boolean): Promise<void> {
  const first = t.table.rows[0];
  if (!first) return;
  let caret: Element | null = null;
  for (const cell of [...first.cells]) {
    if ((cell.localName === 'th') === on) continue;
    const node = await app.doc.retag(cell, on ? 'th' : 'td', {}, on ? 'header row' : 'no header row');
    if (cell === t.cell) caret = node;
  }
  if (caret) placeCaret(caret);
}

// the cells of the columns of numbers set at the right, the header cell included, or every cell
// set at the left again. with a box, only the cells inside it
function alignNumbers(app: App, t: Target, on: boolean, box?: Box): void {
  for (const p of misaligned(t, on, box)) app.doc.setTag(p.cell, { style: { 'text-align': right(p.cell) ? null : 'right' } }, 'align numbers');
}

// the cells that alignNumbers changes
function misaligned(t: Target, on: boolean, box?: Box): Place[] {
  const numeric = numbersOf(t.table);
  const shown = (p: Place) => !box || (p.row >= box.r0 && p.row <= box.r1 && p.col >= box.c0 && p.col <= box.c1);
  return placesOf(t.table).flat().filter((p) => shown(p) && right(p.cell) !== (on && numeric[p.col]));
}

// the box of Auto-Align: the range of the cells selected as a block, or the table at one cell
const alignBox = (t: Target) => (t.box && spotsIn(gridOf(t.table), t.box).length > 1 ? t.box : undefined);

function numbersRight(t: Target | null): boolean {
  if (!t) return false;
  const numeric = numbersOf(t.table);
  const cells = placesOf(t.table).flat().filter((p) => numeric[p.col]);
  return cells.length > 0 && cells.every((p) => right(p.cell));
}

// the cells of the range of t merged into its first cell, as Merge Cells of Keynote. the first cell
// keeps its tag and its style, and thus its alignment, takes the text of the cells with a text in
// the order of reading, each on a line of its own after a br, as Keynote and PowerPoint keep it,
// and is written with the colspan and the rowspan of the range. a row left without a cell is
// taken out
async function mergeCells(app: App, t: Target): Promise<void> {
  const box = t.box!;
  const [first, ...rest] = spotsIn(gridOf(t.table), box);
  const asBlock = blocked(app, t);
  const joined = [first, ...rest].map((s) => contentWithTex(s.cell).trim()).filter(Boolean).join('<br>');
  for (const s of rest) await app.doc.remove(s.cell, 'merge cells');
  app.doc.setTag(first.cell, { attrs: { colspan: spanText(box.c1 - box.c0 + 1), rowspan: spanText(box.r1 - box.r0 + 1) } }, 'merge cells');
  if (joined !== contentWithTex(first.cell)) await app.doc.setContent(first.cell, joined, 'merge cells');
  await dropEmptyRows(app, t.table, 'merge cells');
  land(app, first.cell, 'end', asBlock);
}

// each merged cell of the range of t split into cells of one row and one column, as Unmerge Cells
// of Keynote. the merged cell keeps its text at its first row and column, and the new cells are
// empty, with its tag and its alignment. the place of each new cell is taken from the table before
// the change, and the merged cells are split in the order of reading, so that the new cells of two
// merged cells side by side are written in the order of their columns
async function unmergeCells(app: App, t: Target): Promise<void> {
  const g = gridOf(t.table);
  const box = t.box!;
  const merged = spotsIn(g, box).filter((s) => s.rows > 1 || s.span > 1);
  const asBlock = blocked(app, t);
  const plan = merged.map((s) => ({
    s,
    rows: Array.from({ length: s.rows - 1 }, (_, k) => s.row + 1 + k).map((r) => ({ r, before: g.spots[r].find((x) => x.col > s.col)?.cell ?? null })),
  }));
  for (const { s, rows } of plan) {
    const cells = (n: number) => Array.from({ length: n }, () => cellHtml(s.cell.localName as 'td' | 'th', '', right(s.cell)));
    if (s.span > 1) await app.doc.insert(cells(s.span - 1), s.cell.parentElement!, s.cell.nextSibling, 'unmerge cells');
    for (const { r, before } of rows) await app.doc.insert(cells(s.span), t.table.rows[r], before, 'unmerge cells');
    app.doc.setTag(s.cell, { attrs: { colspan: null, rowspan: null } }, 'unmerge cells');
  }
  const after = gridOf(t.table);
  const anchor = after.grid[box.r0]?.[box.c0]?.cell;
  const focus = after.grid[box.r1]?.[box.c1]?.cell;
  if (asBlock && anchor && focus) selectCells(app, anchor, focus);
  else land(app, t.cell, 'end', false);
}

// whether the range of t holds more than one cell, and whether it holds a merged cell
const mergeable = (t: Target | null) => !!t?.box && spotsIn(gridOf(t.table), t.box).length > 1;
const unmergeable = (t: Target | null) => !!t?.box && spotsIn(gridOf(t.table), t.box).some((s) => s.rows > 1 || s.span > 1);

// the smallest width of the content of a column that a drag of its border leaves, in slide px,
// where its words leave it narrower
const NARROWEST = 24;

// the width of the content of a cell in slide px, which a width in its style sets, since the theme
// sizes the cells by their content box
const contentWidth = (cell: Element) => parseFloat(getComputedStyle(cell).width) || 0;

// the widths of cells of the first row written in px into their style, each that changes
function writeWidths(app: App, widths: Map<HTMLTableCellElement, number>, label: string): void {
  for (const [cell, w] of widths) {
    const text = `${Math.max(1, Math.round(w))}px`;
    if ((cell as HTMLElement).style.width !== text) app.doc.setTag(cell, { style: { width: text } }, label);
  }
}

// the cells of the first row in the columns of the range of t, or in every column where the range
// is one column wide or there is none. a cell of the first row over more than one column is taken
// only inside the columns
function firstRowIn(t: Target): Place[] {
  const g = gridOf(t.table);
  const box = t.box && t.box.c1 > t.box.c0 ? t.box : { c0: 0, c1: g.width - 1 };
  return (g.spots[0] ?? []).filter((s) => s.col >= box.c0 && s.col + s.span - 1 <= box.c1);
}

// the columns of the range of t, or of the table, made as wide as each other, with the width of
// all of them kept, as Distribute Columns Evenly of Keynote
function distributeColumns(app: App, t: Target): void {
  const cells = firstRowIn(t);
  const outer = cells.map((s) => (s.cell as HTMLElement).offsetWidth);
  const each = outer.reduce((a, b) => a + b, 0) / cells.reduce((n, s) => n + s.span, 0);
  writeWidths(app, new Map(cells.map((s, i) => [s.cell, each * s.span - (outer[i] - contentWidth(s.cell))])), 'distribute columns');
}

// the width of the content of each cell of the first row of table, measured with the cell set a
// px wide, so that its column is as narrow as its cells let it be: as wide as its longest word, or
// with nowrap as its widest text on one line. the style of each cell is put back before the next
// frame. a cell of the first row over more than one column is not measured
function columnWidths(table: HTMLTableElement, nowrap: boolean, from = 0, to = Infinity): Map<HTMLTableCellElement, number> {
  const g = gridOf(table);
  const out = new Map<HTMLTableCellElement, number>();
  for (const head of (g.spots[0] ?? []).filter((s) => s.span === 1 && s.col >= from && s.col <= to)) {
    const column = g.grid.map((r) => r[head.col]).filter((s): s is Place => !!s && s.span === 1);
    const kept = column.map((s) => [s.cell.style.whiteSpace, s.cell.style.width] as const);
    if (nowrap) for (const s of column) s.cell.style.whiteSpace = 'nowrap';
    head.cell.style.width = '1px';
    out.set(head.cell, contentWidth(head.cell));
    column.forEach((s, i) => {
      s.cell.style.whiteSpace = kept[i][0];
      s.cell.style.width = kept[i][1];
    });
  }
  return out;
}

// the widest text of each column of the cells of t on one line, as Resize Column to Fit Content
// of Keynote
const fitWidths = (t: Target) => columnWidths(t.table, true, t.box?.c0, t.box?.c1);

// the cells of rows written into the table of cell from cell on, with rows and columns added at the
// end as they are needed
async function pasteCells(app: App, cell: HTMLTableCellElement, rows: string[][]): Promise<void> {
  const start = placeOf(cell)!;
  const table = cell.closest('table') as HTMLTableElement;
  while (table.rows.length < start.row + rows.length) await addRow(app, { table, cell: null, box: null }, true);
  while (columnsOf(table) < start.col + rows[0].length) await addColumn(app, { table, cell: null, box: null }, true);
  let last: HTMLTableCellElement | null = null;
  const done = new Set<Element>();
  for (const [i, r] of rows.entries()) {
    for (const [j, text] of r.entries()) {
      // a merged cell takes the text of its first row and column
      const target = cellOver(table, start.row + i, start.col + j);
      if (!target || done.has(target)) continue;
      done.add(target);
      const html = cellHtml('td', text).replace(/^<td>|<\/td>$/g, '');
      await app.doc.setContent(target, html, 'paste');
      last = target;
    }
  }
  if (last) focusCell(last, 'end');
}

let current: App | null = null;

// the commands of the keys of the cells selected as a block, run before the commands of a
// selected element, e.g. the arrows before a nudge and Delete before the delete of the table
const BLOCK_KEYS: Command[] = [];
window.addEventListener('keydown', (ev) => {
  const app = current;
  if (!app || ev.isComposing || menuOpen() || picker || app.region() !== 'canvas' || !inBlock(app)) return;
  const c = BLOCK_KEYS.find((x) => keysOf(x, app.platform).some((k) => matches(ev, k, app.platform)));
  if (!c) return;
  ev.preventDefault();
  ev.stopImmediatePropagation();
  void app.commands.run(c.id).catch((e) => app.fail(e));
}, true);

// the context menu of a cell, with the commands of the clipboard and of the table
function cellItems(cell: HTMLTableCellElement): MenuItem[] {
  const arg = { cell };
  const ids = (list: string[]): MenuItem[] => list.map((command) => ({ command, arg }));
  return [
    ...ids(['edit.cut', 'edit.copy', 'edit.paste']).map((i) => ({ command: (i as { command: string }).command })),
    { rule: true },
    ...ids(['table.rowAbove', 'table.rowBelow', 'table.columnBefore', 'table.columnAfter']),
    { rule: true },
    ...ids(['table.deleteRow', 'table.deleteColumn']),
    { rule: true },
    ...ids(['table.selectRow', 'table.selectColumn']),
    { rule: true },
    ...ids(['table.merge', 'table.unmerge']),
    { rule: true },
    ...ids(['table.distributeColumns', 'table.fitColumn']),
    { rule: true },
    ...ids(['table.sortAscending', 'table.sortDescending']),
    { rule: true },
    ...ids(['table.header', 'table.numbersRight', 'table.autoAlign']),
    { rule: true },
    ...ids(['table.delete']),
  ];
}

function openCellMenu(app: App, cell: HTMLTableCellElement, at: { x: number; y: number }): void {
  openMenu(app, cellItems(cell), { anchor: at, placement: 'point', label: 'cell menu', className: 'context cell' });
}

// Shift+F10 and the Menu key in a cell open its menu, before the context menu of a text that
// shell/shell.ts opens, hence the listener is added at the import of this module
window.addEventListener('keydown', (ev) => {
  const app = current;
  if (!app || menuOpen() || !(ev.key === 'ContextMenu' || (ev.key === 'F10' && ev.shiftKey && !ev.metaKey && !ev.ctrlKey && !ev.altKey))) return;
  const cell = cellAt(app);
  if (!cell) return;
  ev.preventDefault();
  ev.stopImmediatePropagation();
  const r = cell.getBoundingClientRect();
  openCellMenu(app, cell, { x: r.left + 8, y: r.top + Math.min(r.height, 24) });
}, true);

// the close of the open grid of Insert Table, or null
let picker: ((restore: boolean) => void) | null = null;

// the grid of the Insert Table popover, under its anchor. a cell of the grid chooses the size of
// the table up to it, shown above the grid as columns by rows, and a click or Return inserts it.
// it is a popover, hence the toolbar stays enabled and the Table button is drawn pressed under it
function openPicker(app: App, anchor: DOMRect | null, done: (size: Size) => void, more?: (rested?: Size) => void): void {
  picker?.(false);
  const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const box = make('dialog', 'beeson-table-picker');
  box.dataset.popover = '';
  const button = document.querySelector('.beeson-edit-top [data-command="insert.table"]');
  box.setAttribute('aria-label', 'Insert Table');
  const size = make('div', 'size', 'Insert Table');
  const grid = make('div', 'grid');
  grid.tabIndex = 0;
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', 'Size of the table');
  const cells = Array.from({ length: GRID.columns * GRID.rows }, () => make('div'));
  grid.append(...cells);
  const larger = make('button', 'more', 'Insert Table…');
  larger.type = 'button';
  box.append(size, grid, make('div', 'foot', 'Arrow keys choose, Return inserts'), larger);
  let pick: Size | null = null;
  // the size last shown, which Insert Table… opens with after the pointer leaves the grid
  let rested: Size | undefined;
  const show = (next: Size | null) => {
    pick = next;
    if (next) rested = next;
    cells.forEach((d, i) => d.classList.toggle('on', !!next && i / GRID.columns < next.rows && i % GRID.columns < next.columns));
    size.textContent = next ? `${next.columns} × ${next.rows} Table` : 'Insert Table';
    grid.setAttribute('aria-valuetext', next ? `${next.columns} columns by ${next.rows} rows` : '');
  };
  const sizeAt = (ev: Event): Size | null => {
    const i = cells.indexOf(ev.target as HTMLDivElement);
    return i < 0 ? null : { rows: Math.floor(i / GRID.columns) + 1, columns: (i % GRID.columns) + 1 };
  };
  // the listeners of the window are taken off with the picker
  const off = new AbortController();
  const close = (restore: boolean) => {
    if (off.signal.aborted) return;
    off.abort();
    box.remove();
    picker = null;
    button?.setAttribute('aria-expanded', 'false');
    app.invalidate('selection');
    if (restore && back?.isConnected) back.focus({ preventScroll: true });
  };
  const choose = (s: Size | null) => {
    if (!s) return;
    close(false);
    done(s);
  };
  grid.addEventListener('pointermove', (ev) => {
    const s = sizeAt(ev);
    if (s) show(s);
  });
  grid.addEventListener('pointerleave', () => show(null));
  grid.addEventListener('click', (ev) => choose(sizeAt(ev)));
  larger.addEventListener('click', () => {
    close(false);
    more?.(rested);
  });
  const steps: Record<string, [number, number]> = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
  box.addEventListener('keydown', (ev) => {
    const step = ev.target === grid ? steps[ev.key] : undefined;
    const clamp = (n: number, most: number) => Math.max(1, Math.min(most, n));
    if (step) show({ rows: clamp((pick?.rows ?? 0) + step[0], GRID.rows), columns: clamp((pick?.columns ?? 0) + step[1], GRID.columns) });
    else if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === larger) larger.click();
    else if (ev.key === 'Enter' || ev.key === ' ') choose(pick);
    else if (ev.key === 'Escape') close(true);
    else if (ev.key === 'Tab') (ev.target === grid ? larger : grid).focus({ preventScroll: true });
    else return;
    ev.preventDefault();
    ev.stopPropagation();
  });
  document.body.append(box);
  box.show();
  picker = close;
  button?.setAttribute('aria-expanded', 'true');
  app.invalidate('selection');
  const w = box.offsetWidth;
  const v = app.stage?.viewport;
  const left = anchor ? anchor.left : v ? v.left + (v.width - w) / 2 : 100;
  box.style.left = `${Math.max(4, Math.min(innerWidth - w - 4, left))}px`;
  box.style.top = `${Math.max(4, anchor ? anchor.bottom + 4 : (v?.top ?? 88) + 12)}px`;
  grid.focus({ preventScroll: true });
  setTimeout(() => {
    const signal = off.signal;
    window.addEventListener('pointerdown', (ev) => {
      // a press on the Table button is left to its click, which closes the grid
      if (!(ev.target instanceof Element) || !(box.contains(ev.target) || button?.contains(ev.target))) close(true);
    }, { capture: true, signal });
    for (const type of ['resize', 'blur']) window.addEventListener(type, () => close(true), { signal });
  }, 0);
}

// the numbers of columns and rows of a new table, asked in a dialog, or null after Cancel. the
// dialog opens with start, the size last shown in the grid, and else with the size typed last
let lastSize: Size = { columns: 4, rows: 6 };
async function askSize(app: App, start: Size = lastSize): Promise<Size | null> {
  const body = make('div', 'fields');
  const field = (label: string, value: number, most: number) => {
    const input = make('input');
    input.type = 'number';
    input.min = '1';
    input.max = String(most);
    input.step = '1';
    input.value = String(value);
    input.name = label.toLowerCase();
    const l = make('label', '', label);
    l.htmlFor = input.id = `beeson-table-${input.name}`;
    // a field reached with Tab is selected, hence a number typed replaces it
    input.addEventListener('focus', () => input.select());
    body.append(l, input);
    return input;
  };
  const columns = field('Columns', start.columns, MOST.columns);
  const rows = field('Rows', start.rows, MOST.rows);
  const d = new Dialog({
    title: 'Insert Table',
    text: `A table of up to ${MOST.columns} columns and ${MOST.rows} rows, with a header row.`,
    body,
    className: 'beeson-table-size',
    buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Insert', value: 'insert', primary: true }],
  });
  const read = (input: HTMLInputElement, most: number) => Math.max(1, Math.min(most, Math.round(Number(input.value)) || 1));
  // Return in a field inserts, as the default button of a dialog
  body.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    ev.stopPropagation();
    d.buttons.get('insert')?.click();
  });
  try {
    const p = d.open(undefined, document.activeElement as HTMLElement | null);
    columns.focus();
    columns.select();
    if ((await p) !== 'insert' || !app.current()) return null;
    lastSize = { columns: read(columns, MOST.columns), rows: read(rows, MOST.rows) };
    return lastSize;
  } finally {
    d.el.remove();
  }
}

// the toolbar button of a command when it is shown, as the anchor of its popover
function toolbarButton(id: string): DOMRect | null {
  const b = document.querySelector<HTMLElement>(`.beeson-edit-top [data-command="${id}"]`);
  return b && b.getClientRects().length ? b.getBoundingClientRect() : null;
}

// the bars of the table of the caret, drawn again in each frame while it is shown, since the table
// moves with a drag, a zoom, and a scroll of the canvas
function installBars(app: App): void {
  const layer = make('div', 'beeson-table-bars');
  layer.hidden = true;
  const cols = make('div', 'bar cols');
  const rows = make('div', 'bar rows');
  const outline = make('div', 'cell');
  let shown: Target | null = null;
  let frame = 0;
  let signature = '';
  const round = (title: string, name: string, run: (t: Target) => unknown) => {
    const b = make('button', 'round');
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.append(icon(name, 12));
    b.addEventListener('click', () => {
      if (shown) void Promise.resolve(run(shown)).catch((e) => app.fail(e));
    });
    return b;
  };
  const grab = round('Select Table', 'table', (t) => selectTable(app, t.table));
  const addCol = round('Add Column', 'plus', (t) => app.commands.run('table.columnAfter', { cell: lastCell(t.table, 'column') }));
  const addRow = round('Add Row', 'plus', (t) => app.commands.run('table.rowBelow', { cell: lastCell(t.table, 'row') }));
  // a grip on the border at the right of each cell of the first row, whose drag sets the widths
  // of the columns on its two sides, or of the last column, and the line of the border while it is
  // dragged
  const grips = make('div', 'grips');
  const guide = make('div', 'guide');
  guide.hidden = true;
  // the fill handle at the lower right corner of the cells selected as a block, and the box of the
  // cells that its drag reaches
  const handle = make('div', 'fill');
  handle.title = 'Drag to fill the cells beside the selection';
  handle.hidden = true;
  const spread = make('div', 'spread');
  spread.hidden = true;
  // the handles at the other corners of the cells selected as a block, whose drag moves that corner
  // of the range to the cell under the pointer while the opposite corner stays
  const corners = (['upper-left', 'upper-right', 'lower-left'] as const).map((name) => {
    const c = make('div', 'corner');
    c.dataset.corner = name;
    c.title = 'Drag to extend or shorten the selection';
    c.hidden = true;
    return c;
  });
  // the grips at the left and right edges of a table selected as an object, whose drag sets the
  // widths of its columns in proportion, which is the only size of a table that the theme lets the
  // editor write. a drag of the left grip moves the table, so that its right edge stays
  const sides = (['w', 'e'] as const).map((h) => {
    const g = make('div', app.platform === 'mac' ? 'beeson-grip square' : 'beeson-grip');
    g.dataset.handle = h;
    g.title = 'Drag to resize the table';
    g.hidden = true;
    return g;
  });
  layer.append(cols, rows, grab, addCol, addRow, outline, grips, guide, spread, ...corners, handle, ...sides);
  document.body.append(layer);
  // a press on the bars keeps the caret in its cell
  for (const type of ['pointerdown', 'mousedown']) layer.addEventListener(type, (ev) => ev.preventDefault());

  // a click on a letter or a number selects its column or row as a block, and with Shift the
  // columns or rows from the range to it, as in Keynote. its arrow and a right-click then open the
  // menu of the column or the row
  const pick = (ev: MouseEvent, column: boolean) => {
    const seg = ev.target instanceof Element ? ev.target.closest<HTMLElement>('[data-index]') : null;
    if (!seg || !shown) return;
    const table = shown.table;
    const g = gridOf(table);
    const i = Number(seg.dataset.index);
    const b = ev.shiftKey ? shown.box : null;
    const from = b ? Math.min(i, column ? b.c0 : b.r0) : i;
    const to = b ? Math.max(i, column ? b.c1 : b.r1) : i;
    const at = (r: number, c: number) => g.grid[r]?.[c]?.cell;
    const anchor = column ? at(0, from) : at(from, 0);
    const focus = column ? at(g.grid.length - 1, to) : at(to, g.width - 1);
    if (!anchor || !focus) return;
    if (!b || !inBlock(app) || block?.anchor !== anchor || block.focus !== focus) selectCells(app, anchor, focus);
    if (ev.type === 'click' && !(ev.target as Element).closest('.more')) return;
    ev.preventDefault();
    const arg = { cell: column ? anchor : focus };
    const ids = column
      ? [['table.columnBefore', 'table.columnAfter'], ['table.deleteColumn'], ['table.distributeColumns', 'table.fitColumn'], ['table.sortAscending', 'table.sortDescending']]
      : [['table.rowAbove', 'table.rowBelow'], ['table.deleteRow']];
    const items: MenuItem[] = ids.flatMap((group, k) => [...(k ? [{ rule: true as const }] : []), ...group.map((command) => ({ command, arg }))]);
    openMenu(app, items, { anchor: seg.getBoundingClientRect(), placement: column ? 'below' : 'beside', label: `${seg.title} menu` });
  };
  for (const [bar, column] of [[cols, true], [rows, false]] as const) {
    bar.addEventListener('click', (ev) => pick(ev, column));
    bar.addEventListener('contextmenu', (ev) => pick(ev, column));
  }

  const place = (el: Element, left: number, top: number, width: number, height: number) => {
    (el as HTMLElement).style.cssText = `left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
  };
  const segments = (bar: HTMLElement, names: string[], on: (i: number) => boolean, word: string) =>
    bar.replaceChildren(...names.map((name, i) => {
      const d = make('div', on(i) ? 'on' : '', name);
      d.dataset.index = String(i);
      d.title = `${word} ${name}`;
      const more = make('span', 'more');
      more.title = `${word} ${name} Menu`;
      more.append(icon('chevron-down', 14));
      d.append(more);
      return d;
    }));

  // the drag of a grip: the cells of the first row, the widths of their content and their widths
  // in the style at the press, the cell at the left of the border, and the scale of the slide
  // in the style at the press, the narrowest widths that their words leave, the cell at the left
  // of the border, and the scale of the slide
  let resize: { cells: HTMLTableCellElement[]; widths: number[]; styles: string[]; least: number[]; i: number; x: number; scale: number } | null = null;
  const sized = (ev: PointerEvent): Map<HTMLTableCellElement, number> => {
    const r = resize!;
    const d = (ev.clientX - r.x) / r.scale;
    const out = new Map<HTMLTableCellElement, number>();
    const left = r.widths[r.i];
    const next = r.widths[r.i + 1];
    if (next === undefined) out.set(r.cells[r.i], Math.max(r.least[r.i], left + d));
    else {
      const w = Math.max(r.least[r.i], Math.min(left + d, left + next - r.least[r.i + 1]));
      out.set(r.cells[r.i], w);
      out.set(r.cells[r.i + 1], Math.max(r.least[r.i + 1], left + next - w));
    }
    return out;
  };
  grips.addEventListener('pointerdown', (ev) => {
    const grip = ev.target instanceof HTMLElement ? ev.target.closest<HTMLElement>('[data-grip]') : null;
    if (!grip || !shown || ev.button !== 0) return;
    const cells = (gridOf(shown.table).spots[0] ?? []).map((s) => s.cell);
    const box = shown.table.getBoundingClientRect();
    const widths = cells.map(contentWidth);
    const least = columnWidths(shown.table, false);
    resize = {
      cells, widths, styles: cells.map((c) => c.style.width), least: cells.map((c, i) => Math.min(widths[i], Math.max(NARROWEST, least.get(c) ?? widths[i]))),
      i: Number(grip.dataset.grip), x: ev.clientX, scale: box.width / (shown.table.offsetWidth || 1) || 1,
    };
    grip.setPointerCapture(ev.pointerId);
    document.documentElement.classList.add('beeson-column-resizing');
  });
  grips.addEventListener('pointermove', (ev) => {
    if (!resize) return;
    for (const [cell, w] of sized(ev)) cell.style.width = `${Math.round(w)}px`;
  });
  const drop = (ev: PointerEvent | null) => {
    const r = resize;
    if (!r) return;
    const widths = ev ? sized(ev) : null;
    resize = null;
    document.documentElement.classList.remove('beeson-column-resizing');
    r.cells.forEach((c, i) => {
      c.style.width = r.styles[i];
    });
    if (widths && ev && Math.abs(ev.clientX - r.x) >= 1) {
      void app.history.transact('Resize Column', () => writeWidths(app, widths, 'resize column')).catch((e) => app.fail(e));
    }
  };
  grips.addEventListener('pointerup', (ev) => drop(ev));
  grips.addEventListener('pointercancel', () => drop(null));
  grips.addEventListener('lostpointercapture', () => drop(null));

  let filling: { table: HTMLTableElement; from: Box; to: Box; x: number; y: number } | null = null;
  handle.addEventListener('pointerdown', (ev) => {
    if (!shown?.box || ev.button !== 0 || !inBlock(app)) return;
    filling = { table: shown.table, from: shown.box, to: shown.box, x: ev.clientX, y: ev.clientY };
    handle.setPointerCapture(ev.pointerId);
    document.documentElement.classList.add('beeson-autofilling');
  });
  handle.addEventListener('pointermove', (ev) => {
    if (!filling) return;
    const to = reach(filling.table, filling.from, ev.clientX, ev.clientY);
    Object.assign(filling, { x: ev.clientX, y: ev.clientY });
    if (sameBox(to, filling.to)) return;
    filling.to = to;
    reaching = { table: filling.table, box: to };
    app.invalidate('selection');
  });
  const endFill = (ev: PointerEvent | null) => {
    const f = filling;
    if (!f) return;
    filling = null;
    reaching = null;
    document.documentElement.classList.remove('beeson-autofilling');
    const to = ev ? reach(f.table, f.from, ev.clientX, ev.clientY) : f.from;
    if (sameBox(to, f.from)) return;
    void app.history.transact('Autofill', () => autofill(app, f.table, f.from, to)).then(() => {
      const a = cellOver(f.table, to.r0, to.c0);
      const b = cellOver(f.table, to.r1, to.c1);
      if (a && b) selectCells(app, a, b);
    }).catch((e) => app.fail(e));
  };
  handle.addEventListener('pointerup', (ev) => endFill(ev));
  handle.addEventListener('pointercancel', () => endFill(null));

  // the drag of a corner handle: the table and the cell at the corner of the range that stays
  let stretching: { table: HTMLTableElement; row: number; col: number } | null = null;
  for (const c of corners) {
    c.addEventListener('pointerdown', (ev) => {
      const at = shown?.box;
      if (!at || !shown || ev.button !== 0 || !inBlock(app)) return;
      const name = c.dataset.corner;
      stretching = { table: shown.table, row: name === 'lower-left' ? at.r0 : at.r1, col: name === 'upper-right' ? at.c0 : at.c1 };
      c.setPointerCapture(ev.pointerId);
    });
    c.addEventListener('pointermove', (ev) => {
      const s = stretching;
      if (!s || !s.table.isConnected) return;
      const { row, col } = spotAt(s.table, ev.clientX, ev.clientY);
      const a = cellOver(s.table, s.row, s.col);
      const b = cellOver(s.table, row, col);
      if (a && b && (block?.anchor !== a || block?.focus !== b)) selectCells(app, a, b);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) c.addEventListener(type, () => (stretching = null));
  }

  // the drag of an edge grip: the cells of the first row with their outer widths and the widths of
  // their content, and their styles at the press, the translate of the table, and its width
  let widening: { table: HTMLTableElement; cells: HTMLTableCellElement[]; outer: number[]; content: number[]; styles: string[]; at: number[]; moved: string; left: boolean; x: number; scale: number; width: number } | null = null;
  const widen = (ev: PointerEvent) => {
    const r = widening!;
    const d = ((ev.clientX - r.x) / r.scale) * (r.left ? -1 : 1);
    const k = Math.max(0.05, (r.width + d) / r.width);
    const widths = new Map(r.cells.map((c, i) => [c, Math.round(Math.max(NARROWEST, r.outer[i] * k - r.outer[i] + r.content[i]))]));
    for (const [c, w] of widths) c.style.width = `${w}px`;
    const shift = r.left ? r.width - r.table.offsetWidth : 0;
    r.table.style.translate = shift ? `${r.at[0] + shift}px ${r.at[1]}px` : r.moved;
    return { widths, shift };
  };
  for (const g of sides) {
    g.addEventListener('pointerdown', (ev) => {
      if (!shown || ev.button !== 0 || !asObject(app, shown.table)) return;
      const table = shown.table;
      const cells = (gridOf(table).spots[0] ?? []).map((s) => s.cell);
      const at = (table.style.translate || '0 0').split(/\s+/).map((v) => parseFloat(v) || 0);
      widening = {
        table, cells, outer: cells.map((c) => c.offsetWidth), content: cells.map(contentWidth), styles: cells.map((c) => c.style.width), at: [at[0] ?? 0, at[1] ?? 0],
        moved: table.style.translate, left: g.dataset.handle === 'w', x: ev.clientX, scale: table.getBoundingClientRect().width / (table.offsetWidth || 1) || 1, width: table.offsetWidth || 1,
      };
      g.setPointerCapture(ev.pointerId);
      document.documentElement.classList.add('beeson-resizing');
    });
    g.addEventListener('pointermove', (ev) => {
      if (widening) widen(ev);
    });
    const end = (ev: PointerEvent | null) => {
      const r = widening;
      if (!r) return;
      const done = ev && Math.abs(ev.clientX - r.x) >= 1 ? widen(ev) : null;
      widening = null;
      document.documentElement.classList.remove('beeson-resizing');
      r.cells.forEach((c, i) => (c.style.width = r.styles[i]));
      r.table.style.translate = r.moved;
      if (!done) return;
      void app.history.transact('Resize Table', () => {
        writeWidths(app, done.widths, 'resize table');
        const x = r.at[0] + done.shift;
        if (done.shift) app.doc.setTag(r.table, { translate: x || r.at[1] ? { x, y: r.at[1] } : null }, 'resize table');
      }).catch((e) => app.fail(e));
    };
    g.addEventListener('pointerup', (ev) => end(ev));
    g.addEventListener('pointercancel', () => end(null));
    g.addEventListener('lostpointercapture', () => end(null));
  }

  const draw = () => {
    const t = shown;
    if (!t || !t.table.isConnected) return hide();
    const box = t.table.getBoundingClientRect();
    const edges = columnEdges(t.table);
    const width = edges.length;
    const rowBoxes = [...t.table.rows].map((tr) => tr.getBoundingClientRect());
    const at = t.box;
    const next = [width, rowBoxes.length, at?.r0, at?.c0, at?.r1, at?.c1].join();
    if (next !== signature) {
      signature = next;
      segments(cols, edges.map((_, c) => columnName(c)), (c) => !!at && at.c0 <= c && c <= at.c1, 'Column');
      segments(rows, rowBoxes.map((_, r) => String(r + 1)), (r) => !!at && at.r0 <= r && r <= at.r1, 'Row');
    }
    const top = box.top - GAP - BAR;
    const left = box.left - GAP - BAR;
    place(cols, box.left, top, box.width, BAR);
    edges.forEach(([l, r], c) => place(cols.children[c], l - box.left, 0, r - l, BAR));
    place(rows, left, box.top, BAR, box.height);
    rowBoxes.forEach((b, r) => place(rows.children[r], 0, b.top - box.top, BAR, b.height));
    const first = gridOf(t.table).spots[0] ?? [];
    if (grips.children.length !== first.length) {
      grips.replaceChildren(...first.map((_, i) => {
        const g = make('div', 'grip');
        g.dataset.grip = String(i);
        g.title = 'Drag to resize the column';
        return g;
      }));
    }
    first.forEach((s, i) => {
      const x = edges[s.col + s.span - 1][1];
      place(grips.children[i], x - GRIP / 2, top, GRIP, BAR);
      if (resize?.i === i) place(guide, x, box.top, 1, box.height);
    });
    guide.hidden = !resize;
    // the buttons are kept inside the canvas, also for a table at its edge
    const v = app.stage?.viewport;
    const inX = (x: number) => (v ? Math.max(v.left + 2, Math.min(x, v.right - BAR - 2)) : x);
    const inY = (y: number) => (v ? Math.max(v.top + 2, Math.min(y, v.bottom - BAR - 2)) : y);
    place(grab, inX(left), inY(top), BAR, BAR);
    place(addCol, inX(box.right + GAP), inY(top), BAR, BAR);
    place(addRow, inX(left), inY(box.bottom + GAP), BAR, BAR);
    outline.hidden = !at;
    const blocked = !!at && inBlock(app);
    outline.classList.toggle('block', blocked);
    handle.hidden = !blocked && !filling;
    if (at) {
      const r = boxRect(t.table, at);
      // the frame is drawn outside the cells, off the text at their edges
      const f = blocked ? FRAME_BLOCK : FRAME;
      place(outline, r.left - f, r.top - f, r.right - r.left + 2 * f, r.bottom - r.top + 2 * f);
      // the handle is under the pointer while it is dragged
      if (filling) place(handle, filling.x - 5.5, filling.y - 5.5, 11, 11);
      else if (!handle.hidden) place(handle, r.right - 5, r.bottom - 5, 11, 11);
      const ends = { 'upper-left': [r.left, r.top], 'upper-right': [r.right, r.top], 'lower-left': [r.left, r.bottom] };
      for (const c of corners) {
        c.hidden = !blocked || !!filling;
        const [x, y] = ends[c.dataset.corner as keyof typeof ends];
        if (!c.hidden) place(c, x - 6, y - 6, 11, 11);
      }
    } else for (const c of corners) c.hidden = true;
    const whole = !!widening || (asObject(app, t.table) && !t.table.hasAttribute('data-locked'));
    for (const g of sides) {
      g.hidden = !whole;
      if (whole) g.style.cssText = `left:${g.dataset.handle === 'w' ? box.left : box.right}px;top:${(box.top + box.bottom) / 2}px`;
    }
    const reached = filling && !sameBox(filling.to, filling.from) ? boxRect(filling.table, filling.to) : null;
    spread.hidden = !reached;
    if (reached) place(spread, reached.left - 2, reached.top - 2, reached.right - reached.left + 4, reached.bottom - reached.top + 4);
    if (v) layer.style.clipPath = `inset(${v.top}px ${innerWidth - v.right}px ${innerHeight - v.bottom}px ${v.left}px)`;
    frame = requestAnimationFrame(draw);
  };

  const hide = () => {
    shown = null;
    signature = '';
    layer.hidden = true;
    cancelAnimationFrame(frame);
  };

  const refresh = () => {
    const t = targetOf(app);
    if (!t || !app.current()?.contains(t.table)) return hide();
    if (shown?.table !== t.table) signature = '';
    shown = t;
    layer.hidden = false;
    cancelAnimationFrame(frame);
    draw();
  };
  app.onRefresh(['content', 'selection', 'slide', 'structure', 'layout'], refresh);
  document.addEventListener('selectionchange', () => {
    if (shown || cellAt(app)) refresh();
  });
}

// the left edge and the right edge of each column of a table on the screen, from the cells that
// start and end in it
function columnEdges(table: HTMLTableElement): number[][] {
  const edges = Array.from({ length: columnsOf(table) }, () => [Infinity, -Infinity]);
  for (const p of placesOf(table).flat()) {
    const b = p.cell.getBoundingClientRect();
    edges[p.col][0] = Math.min(edges[p.col][0], b.left);
    edges[p.col + p.span - 1][1] = Math.max(edges[p.col + p.span - 1][1], b.right);
  }
  return edges;
}

// the box on the screen around the cells of a range
function boxRect(table: HTMLTableElement, at: Box): { left: number; top: number; right: number; bottom: number } {
  const r = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const p of spotsIn(gridOf(table), at)) {
    const b = p.cell.getBoundingClientRect();
    r.left = Math.min(r.left, b.left);
    r.top = Math.min(r.top, b.top);
    r.right = Math.max(r.right, b.right);
    r.bottom = Math.max(r.bottom, b.bottom);
  }
  return r;
}

// the row and the column of a table at the point x, y, those at its edge for a point outside it
function spotAt(table: HTMLTableElement, x: number, y: number): { row: number; col: number } {
  const rows = [...table.rows].map((tr) => tr.getBoundingClientRect());
  const edges = columnEdges(table);
  const row = rows.findIndex((r) => y < r.bottom);
  const col = edges.findIndex(([, r]) => x < r);
  return { row: Math.max(0, row < 0 ? rows.length - 1 : row), col: Math.max(0, col < 0 ? edges.length - 1 : col) };
}

const sameBox = (a: Box, b: Box) => a.r0 === b.r0 && a.c0 === b.c0 && a.r1 === b.r1 && a.c1 === b.c1;

// the range that a drag of the fill handle to the point x, y reaches from the range from: from
// grown along one axis, the one in which the point is farther past it in cells, to the row or the
// column of the point, kept inside the table
function reach(table: HTMLTableElement, from: Box, x: number, y: number): Box {
  const { row, col } = spotAt(table, x, y);
  const dr = row > from.r1 ? row - from.r1 : row < from.r0 ? from.r0 - row : 0;
  const dc = col > from.c1 ? col - from.c1 : col < from.c0 ? from.c0 - col : 0;
  if (dr && dr >= dc) return row > from.r1 ? { ...from, r1: row } : { ...from, r0: row };
  if (dc) return col > from.c1 ? { ...from, c1: col } : { ...from, c0: col };
  return from;
}

// the cells of to outside from filled from the cells of from, line by line along the axis in which
// to grows: a series where the cells of a line hold numbers in a step, else copies of the cells
async function autofill(app: App, table: HTMLTableElement, from: Box, to: Box): Promise<void> {
  const g = gridOf(table);
  if (spotsIn(g, to).some((s) => s.rows > 1 || s.span > 1)) throw new Error('Autofill does not fill merged cells');
  const content = (r: number, c: number) => {
    const cell = g.grid[r]?.[c]?.cell;
    return cell ? contentWithTex(cell) : '';
  };
  const write = async (r: number, c: number, html: string) => {
    const cell = g.grid[r]?.[c]?.cell;
    if (cell && contentWithTex(cell) !== html) await app.doc.setContent(cell, html, 'autofill');
  };
  const span = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const vertical = to.r0 !== from.r0 || to.r1 !== from.r1;
  const forward = vertical ? to.r1 > from.r1 : to.c1 > from.c1;
  const count = vertical ? to.r1 - to.r0 - (from.r1 - from.r0) : to.c1 - to.c0 - (from.c1 - from.c0);
  for (const across of vertical ? span(from.c0, from.c1) : span(from.r0, from.r1)) {
    const along = vertical ? span(from.r0, from.r1) : span(from.c0, from.c1);
    // a fill up or to the left goes on from the first cell, hence the line is read backward
    if (!forward) along.reverse();
    const line = along.map((i) => (vertical ? content(i, across) : content(across, i)));
    for (const [k, f] of fillLine(line, count).entries()) {
      const i = forward ? along[along.length - 1] + 1 + k : along[along.length - 1] - 1 - k;
      const html = 'text' in f ? f.text : line[f.copy];
      await (vertical ? write(i, across, html) : write(across, i, html));
    }
  }
}

// the last cell of a table, or the last cell of its first row, after which a row or a column is
// added by the round buttons of the bars
function lastCell(table: HTMLTableElement, kind: 'row' | 'column'): HTMLTableCellElement | null {
  const rows = [...table.rows];
  const tr = kind === 'row' ? rows[rows.length - 1] : rows[0];
  return tr?.cells[tr.cells.length - 1] ?? null;
}

export function install(app: App): void {
  current = app;
  injectStyle('table', CSS);
  const c = app.commands;
  const fail = (e: unknown) => app.fail(e);
  const ready = (a: App) => !!a.pairing?.root && !!a.current() && a.region() !== 'dialog';
  const inCell = (a: App) => ready(a) && !!cellAt(a);
  const withTable = (a: App, arg?: unknown) => ready(a) && !!targetOf(a, arg);
  const withCell = (a: App, arg?: unknown) => ready(a) && !!targetOf(a, arg)?.cell;
  const menu = (group: string, order: number) => ({ bar: 'Format', group, order, submenu: 'Table' });
  const need = (a: App, arg?: unknown): Target => {
    const t = targetOf(a, arg);
    if (!t) throw new Error('the caret is not in a table');
    return t;
  };

  c.define({
    id: 'insert.table',
    label: 'Table…',
    menu: { bar: 'Insert', group: 'element', order: 22 },
    toolbar: { group: 'insert', order: 20, icon: 'table', label: 'Table' },
    enabled: ready,
    checked: () => picker ? true : null,
    run: async (a, arg) => {
      const size = arg && typeof arg === 'object' && 'rows' in arg ? (arg as Size) : null;
      if (!size && picker) return picker(true);
      if (!size) return openPicker(a, toolbarButton('insert.table'), (s) => void a.commands.run('insert.table', s).catch(fail), (rested) => void a.commands.run('insert.tableSize', rested).catch(fail));
      // a table fills the first empty slot of the slide, as the table icon of its placeholder does
      await newTable(a, size, emptySlot(a, a.current()!));
    },
  });

  // the Insert Table dialog of PowerPoint, with the numbers of columns and rows, for a table larger
  // than the grid
  c.define({
    id: 'insert.tableSize',
    label: 'Insert Table…',
    enabled: ready,
    run: async (a, arg) => {
      const start = arg && typeof arg === 'object' && 'rows' in arg ? (arg as Size) : undefined;
      const size = await askSize(a, start);
      if (size) await a.commands.run('insert.table', size);
    },
  });

  // the keys of the rows and the columns are taken on the canvas only, while a cell is selected as
  // a block, as in Keynote. in a text, Option with an arrow moves the caret by a word or a paragraph
  // on a Mac, and Alt with Left or Right is Back or Forward of a browser on Windows and Linux
  const rowCommand = (id: string, label: string, order: number, below: boolean, key: string) => c.define({
    id,
    label,
    keys: { mac: [key], other: [key] },
    in: ['canvas'],
    menu: menu('add', order),
    enabled: withTable,
    undoable: true,
    run: async (a, arg) => {
      const t = need(a, arg);
      const asBlock = blocked(a, t);
      const col = t.cell ? placeOf(t.cell)!.col : 0;
      const tr = await addRow(a, t, below);
      land(a, cellOver(t.table, [...t.table.rows].indexOf(tr), col) ?? tr.cells[0], 'start', asBlock);
    },
  });
  rowCommand('table.rowAbove', 'Add Row Above', 80, false, 'Alt+ArrowUp');
  rowCommand('table.rowBelow', 'Add Row Below', 81, true, 'Alt+ArrowDown');
  const columnCommand = (id: string, label: string, order: number, after: boolean, key: string) => c.define({
    id,
    label,
    keys: { mac: [key], other: [key] },
    in: ['canvas'],
    menu: menu('add', order),
    enabled: withTable,
    undoable: true,
    run: async (a, arg) => {
      const t = need(a, arg);
      const asBlock = blocked(a, t);
      land(a, await addColumn(a, t, after), 'start', asBlock);
    },
  });
  columnCommand('table.columnBefore', 'Add Column Before', 82, false, 'Alt+ArrowLeft');
  columnCommand('table.columnAfter', 'Add Column After', 83, true, 'Alt+ArrowRight');
  c.define({
    id: 'table.deleteRow',
    label: 'Delete Row',
    keys: { mac: ['Mod+Alt+Backspace'] },
    in: ['text', 'canvas'],
    menu: menu('delete', 84),
    enabled: withCell,
    undoable: true,
    run: (a, arg) => deleteRow(a, need(a, arg)),
  });
  c.define({
    id: 'table.deleteColumn',
    label: 'Delete Column',
    keys: { mac: ['Ctrl+Mod+Backspace'] },
    in: ['text', 'canvas'],
    menu: menu('delete', 85),
    enabled: withCell,
    undoable: true,
    run: (a, arg) => deleteColumn(a, need(a, arg)),
  });
  c.define({
    id: 'table.header',
    label: 'Header Row',
    menu: menu('options', 86),
    enabled: withTable,
    checked: (a) => {
      const t = targetOf(a);
      return t ? hasHeader(t.table) : false;
    },
    undoable: true,
    run: (a, arg) => {
      const t = need(a, arg);
      return setHeader(a, t, !hasHeader(t.table));
    },
  });
  c.define({
    id: 'table.numbersRight',
    label: 'Numbers at the Right',
    menu: menu('options', 87),
    enabled: (a, arg?: unknown) => {
      const t = ready(a) ? targetOf(a, arg) : null;
      return !!t && (numbersOf(t.table).some(Boolean) || placesOf(t.table).flat().some((p) => right(p.cell)));
    },
    checked: (a) => numbersRight(targetOf(a)),
    undoable: true,
    run: (a, arg) => {
      const t = need(a, arg);
      return alignNumbers(a, t, !numbersRight(t));
    },
  });
  // Auto-Align of Keynote, which sets a number at the right and a text at the left, as the theme
  // sets it, by the columns of numbers of numbersOf
  c.define({
    id: 'table.autoAlign',
    label: 'Auto-Align',
    keys: { mac: ['Alt+Mod+U'] },
    in: ['text', 'canvas'],
    menu: menu('options', 87.5),
    enabled: (a, arg?: unknown) => {
      const t = ready(a) ? targetOf(a, arg) : null;
      return !!t && misaligned(t, true, alignBox(t)).length > 0;
    },
    undoable: true,
    run: (a, arg) => {
      const t = need(a, arg);
      alignNumbers(a, t, true, alignBox(t));
    },
  });
  // Sort Ascending and Sort Descending of the column menu of Keynote, by the column of the cell
  const sortCommand = (id: string, label: string, order: number, descending: boolean) => c.define({
    id,
    label,
    menu: menu('sort', order),
    enabled: (a, arg?: unknown) => {
      const t = ready(a) ? targetOf(a, arg) : null;
      return !!t?.box && !!sortable(t.table);
    },
    undoable: true,
    run: (a, arg) => sortRows(a, need(a, arg), descending),
  });
  sortCommand('table.sortAscending', 'Sort Ascending', 87.6, false);
  sortCommand('table.sortDescending', 'Sort Descending', 87.7, true);
  // the counts of the rows and the columns typed into the fields of the Table pane
  for (const [kind, label] of [['rows', 'Set Row Count'], ['columns', 'Set Column Count']] as const) {
    c.define({
      id: `table.${kind}`,
      label,
      enabled: withTable,
      undoable: true,
      run: (a, arg) => setCount(a, need(a, arg).table, kind, Number((arg as { count?: unknown } | undefined)?.count)),
    });
  }
  c.define({
    id: 'table.delete',
    label: 'Delete Table',
    menu: menu('table', 88),
    enabled: withTable,
    undoable: true,
    run: (a, arg) => deleteTable(a, need(a, arg)),
  });

  c.define({
    id: 'table.merge',
    label: 'Merge Cells',
    keys: { mac: ['Ctrl+Mod+M'] },
    in: ['text', 'canvas'],
    menu: menu('merge', 79.7),
    enabled: (a, arg?: unknown) => ready(a) && mergeable(targetOf(a, arg)),
    undoable: true,
    run: (a, arg) => mergeCells(a, need(a, arg)),
  });
  c.define({
    id: 'table.unmerge',
    label: 'Unmerge Cells',
    menu: menu('merge', 79.8),
    enabled: (a, arg?: unknown) => ready(a) && unmergeable(targetOf(a, arg)),
    undoable: true,
    run: (a, arg) => unmergeCells(a, need(a, arg)),
  });

  c.define({
    id: 'table.distributeColumns',
    label: 'Distribute Columns Evenly',
    menu: menu('size', 79.85),
    enabled: (a, arg?: unknown) => {
      const t = ready(a) ? targetOf(a, arg) : null;
      return !!t && firstRowIn(t).length > 1;
    },
    undoable: true,
    run: (a, arg) => distributeColumns(a, need(a, arg)),
  });
  c.define({
    id: 'table.fitColumn',
    label: 'Resize Column to Fit Content',
    menu: menu('size', 79.9),
    enabled: (a, arg?: unknown) => {
      const t = ready(a) ? targetOf(a, arg) : null;
      return !!t?.box && gridOf(t.table).spots[0]?.some((s) => s.span === 1 && s.col >= t.box!.c0 && s.col <= t.box!.c1);
    },
    undoable: true,
    run: (a, arg) => {
      const t = need(a, arg);
      writeWidths(a, fitWidths(t), 'fit column');
    },
  });

  // the rows or the columns of the cells of the target selected as a block, from the first cell
  // that meets them to the last one
  const selectLine = (a: App, t: Target, kind: 'row' | 'column') => {
    const g = gridOf(t.table);
    const box = t.box!;
    const met = kind === 'row'
      ? [box.r0, box.r1].map((r) => g.grid[r].filter((x): x is Place => !!x))
      : [box.c0, box.c1].map((col) => g.grid.map((r) => r[col]).filter((x): x is Place => !!x));
    selectCells(a, met[0][0].cell, met[1][met[1].length - 1].cell);
  };
  c.define({
    id: 'table.selectRow',
    label: 'Select Row',
    menu: menu('select', 79),
    enabled: withCell,
    run: (a, arg) => selectLine(a, need(a, arg), 'row'),
  });
  c.define({
    id: 'table.selectColumn',
    label: 'Select Column',
    menu: menu('select', 79.5),
    enabled: withCell,
    run: (a, arg) => selectLine(a, need(a, arg), 'column'),
  });

  // the keys of the cells selected as a block, which the listener of BLOCK_KEYS takes before the
  // keys of a selected element: an arrow selects the cell beside the focus, Shift with an arrow
  // moves the focus and keeps the anchor, Return puts the caret into the focus, and Delete clears
  // the text of the cells
  const ways = [['Left', 0, -1], ['Right', 0, 1], ['Up', -1, 0], ['Down', 1, 0]] as const;
  for (const [way, dr, dc] of ways) {
    const beside = (): HTMLTableCellElement | null => {
      const f = block && placeOf(block.focus);
      if (!f) return null;
      const g = gridOf(block!.focus.closest('table') as HTMLTableElement);
      const row = dr > 0 ? f.row + f.rows : dr < 0 ? f.row - 1 : f.row;
      const col = dc > 0 ? f.col + f.span : dc < 0 ? f.col - 1 : f.col;
      return g.grid[row]?.[col]?.cell ?? null;
    };
    for (const extend of [false, true]) {
      const key = `${extend ? 'Shift+' : ''}Arrow${way}`;
      BLOCK_KEYS.push(c.define({
        id: `table.${extend ? 'extend' : 'select'}${way}`,
        label: `${extend ? 'Extend Selection' : 'Select Cell'} ${way === 'Left' ? 'Before' : way === 'Right' ? 'After' : way === 'Up' ? 'Above' : 'Below'}`,
        keys: { mac: [key], other: [key] },
        in: ['canvas'],
        enabled: inBlock,
        run: (a) => {
          const to = beside();
          if (to && block) selectCells(a, extend ? block.anchor : to, to);
        },
      }));
    }
  }
  // Esc from the cells selected as a block selects the table as an object, and the next one clears
  // the selection, as in Keynote
  BLOCK_KEYS.push(c.define({
    id: 'table.selectTable',
    label: 'Select Table',
    keys: { mac: ['Escape'], other: ['Escape'] },
    in: ['canvas'],
    enabled: inBlock,
    run: (a) => {
      const t = need(a);
      selectTable(a, t.table);
    },
  }));
  BLOCK_KEYS.push(c.define({
    id: 'table.editCell',
    label: 'Edit Cell',
    keys: { mac: ['Enter'], other: ['Enter'] },
    in: ['canvas'],
    enabled: inBlock,
    run: () => {
      if (block) focusCell(block.focus, 'end');
    },
  }));
  BLOCK_KEYS.push(c.define({
    id: 'table.clearCells',
    label: 'Clear Cells',
    keys: { mac: ['Backspace', 'Delete'], other: ['Backspace', 'Delete'] },
    in: ['canvas'],
    enabled: inBlock,
    undoable: true,
    run: async (a) => {
      const t = need(a);
      for (const p of spotsIn(gridOf(t.table), t.box!)) {
        if (p.cell.childNodes.length) await a.doc.setContent(p.cell, '', 'clear cells');
      }
    },
  }));

  // Tab and Shift+Tab go to the next and the previous cell, with its text selected, as in
  // PowerPoint, and Tab in the last cell adds a row below it
  c.define({
    id: 'table.nextCell',
    label: 'Next Cell',
    keys: { mac: ['Tab'], other: ['Tab'] },
    in: ['text'],
    enabled: inCell,
    run: async (a) => {
      const cell = cellAt(a)!;
      const next = cellAfter(cell, 1);
      if (next) return focusCell(next, 'all');
      const table = cell.closest('table') as HTMLTableElement;
      const tr = await a.history.transact('Add Row', () => addRow(a, { table, cell, box: boxOf(placeOf(cell)!) }, true));
      if (tr.cells[0]) focusCell(tr.cells[0], 'start');
    },
  });
  c.define({
    id: 'table.previousCell',
    label: 'Previous Cell',
    keys: { mac: ['Shift+Tab'], other: ['Shift+Tab'] },
    in: ['text'],
    enabled: inCell,
    run: (a) => {
      const prev = cellAfter(cellAt(a)!, -1);
      if (prev) focusCell(prev, 'all');
    },
  });

  // an arrow key at the edge of the text of a cell goes on to the cell beside it, and inside the
  // text it moves the caret as the browser moves it
  const edge = (way: 'left' | 'right' | 'up' | 'down') => (a: App): { cell: HTMLTableCellElement; to: HTMLTableCellElement } | null => {
    const cell = inCell(a) ? cellAt(a) : null;
    const r = cell ? caretIn(cell) : null;
    if (!cell || !r) return null;
    const to = way === 'left' ? cellAfter(cell, -1) : way === 'right' ? cellAfter(cell, 1) : cellBeside(cell, way === 'up' ? -1 : 1);
    if (!to) return null;
    const at = way === 'left' ? besideCaret(cell, r, 'before') === ''
      : way === 'right' ? besideCaret(cell, r, 'after') === ''
        : onEdgeLine(cell, r, way === 'up' ? 'first' : 'last');
    return at ? { cell, to } : null;
  };
  const arrows = [
    ['left', 'ArrowLeft', 'Cell Before'],
    ['right', 'ArrowRight', 'Cell After'],
    ['up', 'ArrowUp', 'Cell Above'],
    ['down', 'ArrowDown', 'Cell Below'],
  ] as const;
  for (const [way, key, label] of arrows) {
    const find = edge(way);
    c.define({
      id: `table.cell.${way}`,
      label,
      keys: { mac: [key], other: [key] },
      in: ['text'],
      enabled: (a) => !!find(a),
      run: (a) => {
        const hit = find(a);
        if (hit) focusCell(hit.to, way === 'left' || way === 'up' ? 'end' : 'start');
      },
    });
  }

  // a right-click or a Control-click into a cell opens the menu of the cell in place of the menu of
  // a text, before the listener of shell/shell.ts on the document
  window.addEventListener('contextmenu', (ev) => {
    const target = ev.target instanceof Element ? ev.target.closest(CELL) : null;
    if (!isCell(target) || !app.pairing?.byLive.has(target) || !app.current()?.contains(target)) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (cellAt(app) !== target && !inRange(target)) focusCell(target, 'end');
    openCellMenu(app, target, { x: ev.clientX, y: ev.clientY });
  }, true);

  // a drag from a cell into another one or a Shift-click selects the cells between them as a
  // block, before canvas/drag.ts on the document. a right press in the range keeps it for the menu
  let press: HTMLTableCellElement | null = null;
  let held = false;
  const stop = (ev: Event) => {
    ev.preventDefault();
    ev.stopImmediatePropagation();
  };
  window.addEventListener('pointerdown', (ev) => {
    press = null;
    held = false;
    // a press on the move handle of a table selects it as an object, as Select Table does
    const moving = ev.target instanceof Element && ev.target.closest('.beeson-handle') ? overlay().current() : null;
    if (moving instanceof HTMLTableElement && ev.button === 0) selectTable(app, moving);
    const cell = liveCell(ev.target);
    if (!cell || !ready(app)) return;
    if (ev.button === 2 || (ev.button === 0 && ev.ctrlKey && app.platform === 'mac')) {
      if (inRange(cell)) {
        held = true;
        stop(ev);
      }
      return;
    }
    if (ev.button !== 0) return;
    if (!ev.shiftKey) {
      press = cell;
      return;
    }
    const table = cell.closest('table');
    const from = inBlock(app) ? block!.anchor : cellAt(app);
    if (!from || from.closest('table') !== table || (from === cell && !inBlock(app))) return;
    held = true;
    stop(ev);
    selectCells(app, from, cell);
  }, true);
  window.addEventListener('mousedown', (ev) => {
    if (held) stop(ev);
  }, true);
  window.addEventListener('pointermove', (ev) => {
    if (!press || !(ev.buttons & 1)) return;
    const over = liveCell(document.elementFromPoint(ev.clientX, ev.clientY));
    const dragging = document.documentElement.classList.contains('beeson-cell-range');
    if (!over || over.closest('table') !== press.closest('table') || (over === press && !dragging)) return;
    document.documentElement.classList.add('beeson-cell-range');
    if (block?.anchor !== press || block.focus !== over || !inBlock(app)) selectCells(app, press, over);
    window.getSelection()?.removeAllRanges();
  }, true);
  const release = () => {
    press = null;
    held = false;
    document.documentElement.classList.remove('beeson-cell-range');
  };
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);

  // a paste of tab-separated text or of an HTML table: onto the slide it is a new table, selected,
  // and into a cell it fills the cells from that cell on. a paste of elements or slides of the
  // editor, marked by MARK, is left to commands/clipboard.ts
  window.addEventListener('paste', (ev) => {
    const data = ev.clipboardData;
    if (ev.defaultPrevented || !data || !ready(app)) return;
    const html = data.getData('text/html');
    const text = data.getData('text/plain');
    if (html.includes(MARK) || text.includes(MARK)) return;
    const region = app.region();
    const cell = region === 'text' ? cellAt(app) : null;
    if (region !== 'canvas' && !cell) return;
    const rows = parseHtmlTable(html) ?? parseTabular(text);
    if (!rows) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    closeMenus();
    if (cell) {
      void app.history.transact('Paste', () => pasteCells(app, cell, rows)).catch(fail);
      return;
    }
    void app.history.transact('Paste Table', async () => {
      const table = await insertTable(app, rows);
      app.selection.set('elements', [table]);
    }).catch(fail);
  }, true);

  installBars(app);
}
