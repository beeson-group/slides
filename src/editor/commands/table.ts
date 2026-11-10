// the commands of the tables of the slides, as in Keynote and PowerPoint. Insert > Table… and the
// Table button of the toolbar open a grid of up to 8 by 8 cells, as the Insert Table grid of
// PowerPoint, and a click puts a table of the size chosen at its place in the layout, with a header
// row of th and the caret in its first cell. each cell is a block of the editor. Tab and Shift+Tab
// go to the next and the previous cell, Tab in the last cell adds a row, and an arrow key at the
// edge of a cell goes to the cell beside it. rows and columns are added and deleted from Format >
// Table, the context menu of a cell, the row and column bars around the table, and the Table pane
// of the inspector. a paste of tab-separated text or of an HTML table onto the slide is written as
// a new table, and a paste into a cell fills the cells from it on. a range of cells is selected by
// a drag across cells, a Shift-click, Esc in a cell, or Select Row and Select Column, and is merged
// and unmerged as a colspan and a rowspan. the widths of the columns are set by a drag of a border
// in the bar of the columns, Distribute Columns Evenly, and Resize Column to Fit Content, and are
// written in the style of the cells of the first row. Auto-Align sets the columns of numbers at the
// right. each change is one entry of the history, written through app.doc
//
// while the caret is in a cell, or a table is selected, the table is drawn as a selected table of
// Keynote: a bar of the column letters above it and a bar of the row numbers at its left, with the
// columns and the rows of the caret or of the range marked, a round button at the end of each bar
// that adds a column or a row, a round button at the upper left that selects the table, and an
// outline around the cell of the caret or the range

import type { App } from '../app.ts';
import { keysOf, type Command } from '../commands.ts';
import { matches } from '../keymap.ts';
import { childSpace } from '../render.ts';
import { contentWithTex, mathLookup } from '../math.ts';
import { textStyle } from '../model/templates.ts';
import {
  CELL, GRID, around, boxOf, cellAfter, cellBeside, cellHtml, cellOver, columnName, columnsOf, emptyRows, gridOf, grow, hasHeader, numericOf,
  parseHtmlTable, parseTabular, placeOf, placesOf, rowHtml, spotsIn, tableHtml, type Box, type Place,
} from '../table.ts';
import { placeCaret } from '../text/typing.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { closeMenus, menuOpen, openMenu, type MenuItem } from '../ui/menu.ts';
import { columnPlace } from './insert.ts';
import { MARK } from './slide.ts';

const CSS = `
html.beeson-editor .reveal .slides :is(td,th):empty{height:1.4em;width:3.5em}
html.beeson-editing .reveal .slides :is(td,th)[contenteditable="true"]:focus{outline:none}
.beeson-table-picker{position:fixed;z-index:90;inset:auto;margin:0;padding:8px 10px 10px;border:1px solid var(--ed-menu-line);border-radius:10px;background:var(--ed-menu);color:var(--ed-text);font:13px/1.25 var(--ed-font);box-shadow:0 10px 32px #0003;-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);user-select:none;-webkit-user-select:none}
.beeson-table-picker .size{margin:0 1px 8px;font-weight:600}
.beeson-table-picker .grid{display:grid;grid-template-columns:repeat(${GRID},20px);grid-auto-rows:20px;gap:3px;outline:none}
.beeson-table-picker .grid:focus-visible{outline:2px solid var(--ed-focus);outline-offset:3px}
.beeson-table-picker .grid>div{border:1px solid var(--ed-control-line);border-radius:3px;background:var(--ed-control)}
.beeson-table-picker .grid>div:nth-child(-n+${GRID}){border-top-width:3px}
.beeson-table-picker .grid>.on{border-color:var(--ed-select);background:color-mix(in srgb,var(--ed-select) 22%,var(--ed-control))}
.beeson-table-picker .foot{margin:9px 1px 0;color:var(--ed-muted);font-size:11px}
.beeson-table-bars{position:fixed;inset:0;z-index:52;pointer-events:none}
.beeson-table-bars[hidden]{display:none}
.beeson-table-bars>*{position:fixed;box-sizing:border-box;pointer-events:auto;cursor:default}
.beeson-table-bars .bar{border-radius:5px;background:var(--ed-panel);box-shadow:0 0 0 1px var(--ed-control-line);color:var(--ed-muted);font:10px/1 var(--ed-font);overflow:hidden}
.beeson-table-bars .bar>div{position:absolute;display:grid;place-items:center;box-shadow:-1px -1px 0 var(--ed-line)}
.beeson-table-bars .bar>div:hover{background:var(--ed-hover);color:var(--ed-text)}
.beeson-table-bars .bar>.on{background:color-mix(in srgb,var(--ed-select) 20%,transparent);color:var(--ed-text);font-weight:600}
.beeson-table-bars .round{padding:0;border:0;border-radius:50%;display:grid;place-items:center;background:var(--ed-panel);box-shadow:0 0 0 1px var(--ed-control-line);color:var(--ed-select)}
.beeson-table-bars .round:hover{background:var(--ed-hover)}
.beeson-table-bars .cell{border:2px solid var(--ed-select);border-radius:2px;pointer-events:none}
.beeson-table-bars .grips{position:static}
.beeson-table-bars .grip{position:fixed;cursor:col-resize;touch-action:none}
.beeson-table-bars .grip::after{content:"";position:absolute;left:4px;top:3px;bottom:3px;width:1px;background:var(--ed-muted);opacity:0}
.beeson-table-bars .grip:hover::after,html.beeson-column-resizing .beeson-table-bars .grip::after{opacity:1;background:var(--ed-select)}
.beeson-table-bars .guide{width:1px;background:var(--ed-select);pointer-events:none}
.beeson-table-bars .guide[hidden]{display:none}
html.beeson-column-resizing,html.beeson-column-resizing *{cursor:col-resize!important}
html.beeson-cell-range .reveal *{user-select:none!important;-webkit-user-select:none!important}
.beeson-table-bars .cell.block{border-width:4px;background:color-mix(in srgb,var(--ed-select) 12%,transparent)}
`;

// the size of the bars and of their buttons, in screen px, and the gap between a bar and its table
const BAR = 18;
const GAP = 6;
// the width of the grip on the border of two columns, in screen px
const GRIP = 9;

type Target = { table: HTMLTableElement; cell: HTMLTableCellElement | null; box: Box | null };
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

// the columns of numbers of a table, with a formula read as its TeX, e.g. 2.69 for \(2.69\)
function numbersOf(table: HTMLTableElement): boolean[] {
  const tex = mathLookup();
  const read = (cell: Element): string => {
    let out = '';
    const walk = (n: Node) => {
      if (n instanceof Element && n.localName === 'mjx-container') out += tex(n)?.tex ?? '';
      else if (n.nodeType === 3) out += (n as Text).data;
      else n.childNodes.forEach(walk);
    };
    walk(cell);
    return out;
  };
  return numericOf(table, read);
}

// a table of rows of cells put at its place in the layout of the current slide
async function insertTable(app: App, rows: string[][]): Promise<HTMLTableElement> {
  const { parent, before } = columnPlace(app, app.current()!);
  const [table] = await app.doc.insert(tableHtml(rows, styleOf(app), baseOf(app, parent)), parent, before, 'insert table');
  return table as HTMLTableElement;
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

// the columns of the cells of t taken out, or the table with its last columns. a cell that reaches
// over another column gets a column less, and a row left without a cell is taken out
async function deleteColumn(app: App, t: Target): Promise<void> {
  const box = boxOfTarget(t);
  if (!box) return;
  if (box.c1 - box.c0 + 1 >= columnsOf(t.table)) return deleteTable(app, t);
  const asBlock = blocked(app, t);
  for (let c = box.c1; c >= box.c0; c--) {
    const g = gridOf(t.table);
    for (const s of new Set(g.grid.map((row) => row[c]).filter((x): x is Place => !!x))) {
      if (s.span > 1) app.doc.setTag(s.cell, { attrs: { colspan: spanText(s.span - 1) } }, 'delete column');
      else await app.doc.remove(s.cell, 'delete column');
    }
  }
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
// keeps its tag and its style, takes the text of the cells with a text, joined with a space, and
// is written with the colspan and the rowspan of the range. a row left without a cell is taken out
async function mergeCells(app: App, t: Target): Promise<void> {
  const box = t.box!;
  const [first, ...rest] = spotsIn(gridOf(t.table), box);
  const asBlock = blocked(app, t);
  const joined = [first, ...rest].map((s) => contentWithTex(s.cell).trim()).filter(Boolean).join(' ');
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
  if (!app || ev.isComposing || menuOpen() || app.region() !== 'canvas' || !inBlock(app)) return;
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

// the grid of the Insert Table popover, under its anchor. a cell of the grid chooses the size of
// the table up to it, shown above the grid as columns by rows, and a click or Return inserts it
function openPicker(app: App, anchor: DOMRect | null, done: (size: Size) => void): void {
  document.querySelector('dialog.beeson-table-picker')?.remove();
  const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const box = make('dialog', 'beeson-table-picker');
  box.setAttribute('aria-label', 'Insert Table');
  const size = make('div', 'size', 'Insert Table');
  const grid = make('div', 'grid');
  grid.tabIndex = 0;
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', 'Size of the table');
  const cells = Array.from({ length: GRID * GRID }, () => make('div'));
  grid.append(...cells);
  box.append(size, grid, make('div', 'foot', 'Arrow keys choose, Return inserts'));
  let pick: Size | null = null;
  const show = (next: Size | null) => {
    pick = next;
    cells.forEach((d, i) => d.classList.toggle('on', !!next && i / GRID < next.rows && i % GRID < next.columns));
    size.textContent = next ? `${next.columns} × ${next.rows} Table` : 'Insert Table';
    grid.setAttribute('aria-valuetext', next ? `${next.columns} columns by ${next.rows} rows` : '');
  };
  const sizeAt = (ev: Event): Size | null => {
    const i = cells.indexOf(ev.target as HTMLDivElement);
    return i < 0 ? null : { rows: Math.floor(i / GRID) + 1, columns: (i % GRID) + 1 };
  };
  // the listeners of the window are taken off with the picker
  const off = new AbortController();
  const close = (restore: boolean) => {
    if (off.signal.aborted) return;
    off.abort();
    box.remove();
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
  const steps: Record<string, [number, number]> = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
  box.addEventListener('keydown', (ev) => {
    const step = steps[ev.key];
    const clamp = (n: number) => Math.max(1, Math.min(GRID, n));
    if (step) show({ rows: clamp((pick?.rows ?? 0) + step[0]), columns: clamp((pick?.columns ?? 0) + step[1]) });
    else if (ev.key === 'Enter' || ev.key === ' ') choose(pick);
    else if (ev.key === 'Escape') close(true);
    else if (ev.key !== 'Tab') return;
    ev.preventDefault();
    ev.stopPropagation();
  });
  document.body.append(box);
  box.show();
  const w = box.offsetWidth;
  const v = app.stage?.viewport;
  const left = anchor ? anchor.left : v ? v.left + (v.width - w) / 2 : 100;
  box.style.left = `${Math.max(4, Math.min(innerWidth - w - 4, left))}px`;
  box.style.top = `${Math.max(4, anchor ? anchor.bottom + 4 : (v?.top ?? 88) + 12)}px`;
  grid.focus({ preventScroll: true });
  setTimeout(() => {
    const signal = off.signal;
    window.addEventListener('pointerdown', (ev) => {
      if (!(ev.target instanceof Node) || !box.contains(ev.target)) close(true);
    }, { capture: true, signal });
    for (const type of ['resize', 'blur']) window.addEventListener(type, () => close(true), { signal });
  }, 0);
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
  const grab = round('Select Table', 'table', (t) => app.selection.set('elements', [t.table]));
  const addCol = round('Add Column', 'plus', (t) => app.commands.run('table.columnAfter', { cell: lastCell(t.table, 'column') }));
  const addRow = round('Add Row', 'plus', (t) => app.commands.run('table.rowBelow', { cell: lastCell(t.table, 'row') }));
  // a grip on the border at the right of each cell of the first row, whose drag sets the widths
  // of the columns on its two sides, or of the last column, and the line of the border while it is
  // dragged
  const grips = make('div', 'grips');
  const guide = make('div', 'guide');
  guide.hidden = true;
  layer.append(cols, rows, grab, addCol, addRow, outline, grips, guide);
  document.body.append(layer);
  // a press on the bars keeps the caret in its cell
  for (const type of ['pointerdown', 'mousedown']) layer.addEventListener(type, (ev) => ev.preventDefault());

  // a click on a letter or a number opens the menu of the table for a cell of its column or row
  const segmentMenu = (ev: MouseEvent, column: boolean) => {
    const seg = ev.target instanceof Element ? ev.target.closest<HTMLElement>('[data-index]') : null;
    if (!seg || !shown) return;
    const i = Number(seg.dataset.index);
    const home = shown.cell ? placeOf(shown.cell)! : { row: 0, col: 0 };
    const tr = shown.table.rows[column ? home.row : i];
    const cell = tr && (cellOver(shown.table, column ? home.row : i, column ? i : home.col) ?? tr.cells[tr.cells.length - 1]);
    if (!cell) return;
    const anchor = seg.getBoundingClientRect();
    focusCell(cell, 'end');
    openMenu(app, cellItems(cell).slice(4), { anchor, placement: column ? 'below' : 'beside', label: seg.title });
  };
  cols.addEventListener('click', (ev) => segmentMenu(ev, true));
  rows.addEventListener('click', (ev) => segmentMenu(ev, false));

  const place = (el: Element, left: number, top: number, width: number, height: number) => {
    (el as HTMLElement).style.cssText = `left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
  };
  const segments = (bar: HTMLElement, names: string[], on: (i: number) => boolean, word: string) =>
    bar.replaceChildren(...names.map((name, i) => {
      const d = make('div', on(i) ? 'on' : '', name);
      d.dataset.index = String(i);
      d.title = `${word} ${name}`;
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

  const draw = () => {
    const t = shown;
    if (!t || !t.table.isConnected) return hide();
    const box = t.table.getBoundingClientRect();
    const width = columnsOf(t.table);
    // the left edge of each column and the right edge, from the cells that start and end in it
    const edges = Array.from({ length: width }, () => [Infinity, -Infinity]);
    for (const p of placesOf(t.table).flat()) {
      const b = p.cell.getBoundingClientRect();
      edges[p.col][0] = Math.min(edges[p.col][0], b.left);
      edges[p.col + p.span - 1][1] = Math.max(edges[p.col + p.span - 1][1], b.right);
    }
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
    place(grab, left, top, BAR, BAR);
    place(addCol, box.right + GAP, top, BAR, BAR);
    place(addRow, left, box.bottom + GAP, BAR, BAR);
    outline.hidden = !at;
    outline.classList.toggle('block', !!at && inBlock(app));
    if (at) {
      const r = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
      for (const p of spotsIn(gridOf(t.table), at)) {
        const b = p.cell.getBoundingClientRect();
        r.left = Math.min(r.left, b.left);
        r.top = Math.min(r.top, b.top);
        r.right = Math.max(r.right, b.right);
        r.bottom = Math.max(r.bottom, b.bottom);
      }
      place(outline, r.left - 1, r.top - 1, r.right - r.left + 2, r.bottom - r.top + 2);
    }
    const v = app.stage?.viewport;
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
    toolbar: { group: 'insert', order: 22, icon: 'table', label: 'Table' },
    enabled: ready,
    run: async (a, arg) => {
      const size = arg && typeof arg === 'object' && 'rows' in arg ? (arg as Size) : null;
      if (!size) return openPicker(a, toolbarButton('insert.table'), (s) => void a.commands.run('insert.table', s).catch(fail));
      const rows = Math.max(1, Math.min(GRID, Math.round(size.rows)));
      const columns = Math.max(1, Math.min(GRID, Math.round(size.columns)));
      const table = await a.history.transact('Insert Table', () => insertTable(a, emptyRows(rows, columns)));
      const first = table.rows[0]?.cells[0];
      if (first) placeCaret(first, 0);
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
