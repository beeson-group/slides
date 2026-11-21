import type { App } from '../app.ts';
import { overlay, previewPlays } from '../canvas/frames.ts';
import { CLIPBOARD_REGIONS, keysOf, type Command } from '../commands.ts';
import { matches } from '../keymap.ts';
import { childSpace } from '../render.ts';
import { contentWithTex, mathLookup } from '../math.ts';
import { emptySlot } from '../media/actions.ts';
import { textStyle } from '../model/templates.ts';
import {
  CELL, GRID, MOST, around, fillLine, boxOf, cellAfter, cellBeside, cellHtml, cellOver, columnName, columnsOf, emptyRows, gridOf, grow, hasHeader, numericOf, sortOrder,
  CELLS, editorHeads, parseEditorTable, parseHtmlTable, parseTabular, placeOf, placesOf, rowHtml, spotsIn, tableHtml, type Box, type Place,
} from '../table.ts';
import { offsetIn, selectIn } from '../text/elements.ts';
import { placeCaret } from '../text/typing.ts';
import { Dialog } from '../ui/dialog.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { closeMenus, menuOpen, openMenu, type MenuItem } from '../ui/menu.ts';
import { columnPlace, freeFigureBox, meets, slideBox, takenBox, type Box as SlideBox } from './insert.ts';
import { FLOW_KIDS, centerPlace, drawnCells, framed, MARGIN, piecesOf, wordBox } from './place.ts';
import { checkOverlaps } from '../overflow.ts';
import { MARK } from './slide.ts';

const FRAME = 2;
const FRAME_RANGE = 4;
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
.beeson-table-bars .grip::after{content:"";position:absolute;right:2px;top:3px;bottom:0;width:1px;background:var(--ed-select);opacity:0}
.beeson-table-bars .grips.rows .grip{cursor:row-resize}
.beeson-table-bars .grips.rows .grip::after{right:0;left:0;top:50%;bottom:auto;width:auto;height:1px}
.beeson-table-bars .grip:hover::after,.beeson-table-bars .grip.on::after{opacity:1}
.beeson-table-bars .drop{border-radius:1.5px;background:var(--ed-select);pointer-events:none}
.beeson-table-bars .drop[hidden]{display:none}
.beeson-table-bars .lift{overflow:hidden;opacity:.85;box-shadow:0 0 0 1px var(--ed-select),0 10px 28px #0006;transform-origin:0 0;pointer-events:none}
.beeson-table-bars .lift[hidden]{display:none}
.beeson-table-bars .lift>div{position:absolute;box-sizing:border-box;display:grid;overflow:hidden}
html.beeson-line-moving,html.beeson-line-moving *{cursor:grabbing!important}
html.beeson-line-refused,html.beeson-line-refused *{cursor:not-allowed!important}
html.beeson-column-resizing,html.beeson-column-resizing *{cursor:col-resize!important}
html.beeson-row-resizing,html.beeson-row-resizing *{cursor:row-resize!important}
html.beeson-cell-range .reveal *{user-select:none!important;-webkit-user-select:none!important}
.beeson-table-bars .cell.range{border-width:${FRAME_RANGE}px;background:color-mix(in srgb,var(--ed-select) 12%,transparent)}
`;

const BAR = 18;
const GAP = 6;
const GRIP = 9;
const COARSE = matchMedia('(pointer: coarse), (hover: none)');

type Target = { table: HTMLTableElement; cell: HTMLTableCellElement | null; box: Box | null };
type Size = { rows: number; columns: number };

const isCell = (el: unknown): el is HTMLTableCellElement => el instanceof HTMLTableCellElement;

export function cellAt(app: App): HTMLTableCellElement | null {
  const sel = app.selection;
  const item = sel.kind === 'text' ? sel.items[0] : app.hostOf(document.activeElement);
  if (!isCell(item) || !app.current()?.contains(item) || !app.pairing?.byLive.has(item)) return null;
  const table = item.closest('table');
  return table && app.pairing.elements.get(table)?.open ? item : null;
}

let cellRange: { anchor: HTMLTableCellElement; focus: HTMLTableCellElement } | null = null;
let caretCell: HTMLTableCellElement | null = null;
let reaching: { table: HTMLTableElement; box: Box } | null = null;
export const fillRange = (table: HTMLTableElement): Box | null => (reaching?.table === table ? reaching.box : null);

function syncCell(app: App): void {
  const c = cellAt(app);
  if (c) {
    caretCell = c;
    cellRange = null;
    return;
  }
  const only = app.selection.only();
  const kept = (x: Element | null): x is HTMLTableCellElement => !!x?.isConnected && !!only?.contains(x);
  if (!(only instanceof HTMLTableElement)) cellRange = null;
  else if (!cellRange || !kept(cellRange.anchor) || !kept(cellRange.focus)) cellRange = kept(caretCell) ? { anchor: caretCell, focus: caretCell } : null;
  if (app.selection.kind !== 'none') caretCell = null;
}

const inside = (a: Box, b: Box) => a.r0 >= b.r0 && a.c0 >= b.c0 && a.r1 <= b.r1 && a.c1 <= b.c1;

function rangeIn(table: HTMLTableElement): Box | null {
  const a = cellRange && cellRange.anchor.closest('table') === table ? placeOf(cellRange.anchor) : null;
  const f = cellRange && a ? placeOf(cellRange.focus) : null;
  return a && f ? grow(gridOf(table), around(boxOf(a), boxOf(f))) : null;
}

export function targetOf(app: App, arg?: unknown): Target | null {
  syncCell(app);
  const given = arg && typeof arg === 'object' && 'cell' in arg ? (arg as { cell: unknown }).cell : null;
  const cell = isCell(given) && given.isConnected ? given : cellAt(app) ?? cellRange?.focus ?? null;
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

function selectCells(app: App, anchor: HTMLTableCellElement, focus: HTMLTableCellElement): void {
  const table = anchor.closest('table') as HTMLTableElement;
  const host = app.hostOf(document.activeElement);
  if (host instanceof HTMLElement) host.blur();
  window.getSelection()?.removeAllRanges();
  if (app.selection.only() !== table) app.selection.set('elements', [table]);
  cellRange = { anchor, focus };
  caretCell = null;
  app.invalidate('selection');
}

function selectTable(app: App, table: HTMLTableElement): void {
  const host = app.hostOf(document.activeElement);
  if (host instanceof HTMLElement) host.blur();
  window.getSelection()?.removeAllRanges();
  app.selection.set('elements', [table]);
  cellRange = null;
  caretCell = null;
  app.invalidate('selection');
}

const asObject = (app: App, table: HTMLTableElement) => app.selection.only() === table && !rangeHeld(app) && !cellAt(app);

function liveCell(target: EventTarget | null): HTMLTableCellElement | null {
  const app = current;
  const cell = target instanceof Element ? target.closest(CELL) : null;
  return app && isCell(cell) && app.pairing?.byLive.has(cell) && app.current()?.contains(cell) ? cell : null;
}

function inRange(cell: HTMLTableCellElement): boolean {
  const app = current;
  if (!app || !rangeHeld(app)) return false;
  const range = rangeIn(cell.closest('table') as HTMLTableElement);
  const p = placeOf(cell);
  return !!range && !!p && inside(boxOf(p), range);
}

function rangeHeld(app: App): boolean {
  syncCell(app);
  return !!cellRange && app.selection.only() === cellRange.anchor.closest('table') && !cellAt(app);
}

export function focusCell(cell: Element, at: 'start' | 'end' | 'all' = 'all'): void {
  if (!(cell instanceof HTMLElement)) return;
  if (at !== 'all') return placeCaret(cell, at === 'start' ? 0 : null);
  cell.focus({ preventScroll: true });
  window.getSelection()?.selectAllChildren(cell);
}

function caretIn(cell: Element): Range | null {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return null;
  const r = sel.getRangeAt(0);
  return r.collapsed && cell.contains(r.startContainer) ? r : null;
}

function besideCaret(cell: Element, r: Range, way: 'before' | 'after'): string {
  const part = document.createRange();
  part.selectNodeContents(cell);
  if (way === 'before') part.setEnd(r.startContainer, r.startOffset);
  else part.setStart(r.startContainer, r.startOffset);
  const frag = part.cloneContents();
  return (frag.textContent ?? '').replace(/\s/g, '') + (frag.querySelector('mjx-container, br, img') ? '*' : '');
}

function onEdgeLine(cell: Element, r: Range, line: 'first' | 'last'): boolean {
  const caret = r.getClientRects()[0] ?? r.getBoundingClientRect();
  const all = document.createRange();
  all.selectNodeContents(cell);
  const box = all.getBoundingClientRect();
  if (!caret.height || !box.height) return true;
  return line === 'first' ? caret.top - box.top < caret.height / 2 : box.bottom - caret.bottom < caret.height / 2;
}

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

function cellText(cell: Element, delimiters = false): string {
  const tex = mathLookup();
  let out = '';
  const walk = (n: Node) => {
    const info = n instanceof Element && n.localName === 'mjx-container' ? tex(n) : undefined;
    if (info !== undefined) out += info ? (delimiters ? info.open + info.tex + info.close : info.tex) : '';
    else if (n.nodeType === 3) out += (n as Text).data;
    else n.childNodes.forEach(walk);
  };
  walk(cell);
  return out;
}

const numbersOf = (table: HTMLTableElement): boolean[] => numericOf(table, cellText);

function sortable(table: HTMLTableElement): HTMLTableRowElement[] | null {
  const body = table.tBodies[0];
  if (!body) return null;
  const rows = [...body.rows];
  while (rows.length && rows[0].cells.length && [...rows[0].cells].every((c) => c.localName === 'th')) rows.shift();
  if (rows.length < 2 || rows.some((tr) => [...tr.cells].some((c) => c.rowSpan !== 1))) return null;
  return rows;
}

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

type Line = 'row' | 'column';

function headRows(table: HTMLTableElement): boolean[] {
  let head = true;
  return [...table.rows].map((tr) => {
    head &&= tr.parentElement?.localName === 'thead' || (tr.cells.length > 0 && [...tr.cells].every((c) => c.localName === 'th'));
    return head;
  });
}

function movable(table: HTMLTableElement, kind: Line, lo: number, hi: number, to: number): boolean {
  const g = gridOf(table);
  if (to < 0 || to > (kind === 'row' ? g.grid.length : g.width) || (to >= lo && to <= hi + 1)) return false;
  const a = Math.min(lo, to), b = Math.max(hi, to - 1);
  if (kind === 'row') {
    const rows = [...table.rows].slice(a, b + 1);
    const head = headRows(table).slice(a, b + 1);
    if (rows.some((tr) => tr.parentElement !== rows[0].parentElement) || head.some((h) => h !== head[0])) return false;
    const parts = to < lo ? [[to, lo - 1], [lo, hi]] : [[lo, hi], [hi + 1, to - 1]];
    const whole = (s: Place) => s.row > b || s.row + s.rows - 1 < a || parts.some(([p, q]) => s.row >= p && s.row + s.rows - 1 <= q);
    return g.grid.slice(a, b + 1).flat().every((x) => !!x && whole(x));
  }
  const spots = g.grid.flatMap((r) => r.slice(a, b + 1));
  return spots.every((x) => !!x && x.rows === 1 && x.span === 1);
}

const movableAnywhere = (table: HTMLTableElement, kind: Line, lo: number, hi: number): boolean =>
  Array.from({ length: (kind === 'row' ? table.rows.length : columnsOf(table)) + 1 }, (_, to) => to).some((to) => movable(table, kind, lo, hi, to));

function moveOf(t: Target | null, kind: Line, way: -1 | 1): { lo: number; hi: number; to: number } | null {
  const box = t?.box;
  if (!t || !box) return null;
  const [lo, hi] = kind === 'row' ? [box.r0, box.r1] : [box.c0, box.c1];
  const end = kind === 'row' ? t.table.rows.length : gridOf(t.table).width;
  for (let to = way < 0 ? lo - 1 : hi + 2; to >= 0 && to <= end; to += way) if (movable(t.table, kind, lo, hi, to)) return { lo, hi, to };
  return null;
}

async function moveLines(app: App, table: HTMLTableElement, kind: Line, lo: number, hi: number, to: number): Promise<void> {
  const label = `move ${kind}`;
  const first = table.rows[0];
  const widths = new Map((gridOf(table).spots[0] ?? []).map((s) => [s.col, app.doc.tagState(s.cell).style.width ?? null]));
  const lines = (all: Element[]) => (to < lo ? { move: all.slice(lo, hi + 1), before: all[to] } : { move: all.slice(hi + 1, to), before: all[lo] });
  if (kind === 'row') {
    const { move, before } = lines([...table.rows]);
    for (const tr of move) await app.doc.move(tr, before.parentElement!, before, label);
  } else {
    for (const row of gridOf(table).grid) {
      const { move, before } = lines(row.map((x) => x!.cell));
      for (const cell of move) await app.doc.move(cell, before.parentElement!, before, label);
    }
  }
  if (kind !== 'row' || table.rows[0] === first) return;
  for (const s of placesOf(table)[0]) {
    const w = widths.get(s.col) ?? null;
    if ((app.doc.tagState(s.cell).style.width ?? null) !== w) app.doc.setTag(s.cell, { style: { width: w } }, label);
  }
  for (const cell of first.cells) if (app.doc.tagState(cell).style.width) app.doc.setTag(cell, { style: { width: null } }, label);
}

async function insertTable(app: App, rows: string[][], into: Element | null = null, markup = false, heads: boolean[][] | null = null): Promise<HTMLTableElement> {
  const slide = app.current()!;
  const own = slide.matches('.title, .closing') ? { parent: slide, before: slide.querySelector(':scope > .foot, :scope > aside.notes') } : null;
  const { parent, before } = into ? { parent: into, before: null } : own ?? columnPlace(app, slide);
  const [table] = await app.doc.insert(tableHtml(rows, styleOf(app), baseOf(app, parent), markup, heads), parent, before, 'insert table');
  if (!into) placeTable(app, table as HTMLTableElement);
  else fillSlot(app, table as HTMLTableElement, into);
  return table as HTMLTableElement;
}

function fillSlot(app: App, table: HTMLTableElement, slot: Element): void {
  const cells = [...(table.rows[0]?.cells ?? [])];
  const s = getComputedStyle(slot);
  const inner = (slot as HTMLElement).clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
  if (!cells.length || !(inner > 0)) return;
  const set = (w: number) => { for (const c of cells) app.doc.setTag(c, { style: { width: `${Math.max(0, Math.floor(w))}px` } }, 'insert table'); };
  const w = inner / cells.length;
  set(w);
  set(w + (inner - table.offsetWidth) / cells.length);
}

async function newTable(app: App, size: Size, into: Element | null = null): Promise<void> {
  const rows = Math.max(1, Math.min(MOST.rows, Math.round(size.rows)));
  const columns = Math.max(1, Math.min(MOST.columns, Math.round(size.columns)));
  const table = await app.history.selecting('Insert Table', async () => {
    const t = await insertTable(app, emptyRows(rows, columns), into);
    checkOverlaps(app, app.current(), t);
    app.selection.set('elements', [t]);
    return t;
  });
  const first = table.rows[0]?.cells[0];
  if (first) placeCaret(first, 0);
}

export function pickTableInto(app: App, figureBox: Element, anchor: DOMRect): void {
  const fail = (e: unknown) => app.fail(e);
  const into = (size: Size) => (figureBox.isConnected ? newTable(app, size, figureBox) : Promise.resolve()).catch(fail);
  openPicker(app, anchor, (s) => void into(s), (rested) => void askSize(app, rested).then((s) => s && into(s)).catch(fail));
}

const BOTTOM = 40;
const STEP = 20;

function placeTable(app: App, table: HTMLTableElement): void {
  const slide = table.closest('section');
  const parent = table.parentElement;
  if (!slide || !parent || !table.getClientRects().length) return;
  const t = slideBox(app, table);
  const room = (GAP + BAR + 2) / 0.54;
  const w = (slide as HTMLElement).offsetWidth || 1920;
  const h = (slide as HTMLElement).offsetHeight || 1080;
  const foot = [...slide.querySelectorAll(':scope > .foot')].map((f) => takenBox(app, f)).find((b) => !!b);
  const floor = Math.min(h - BOTTOM, foot ? foot.top - BOTTOM : Infinity);
  const ground = (el: Element) => el.matches('.plate') && el.getBoundingClientRect().width >= (slide.getBoundingClientRect().width - 1);
  const skip = (el: Element) => el === table || el.matches('aside.notes, script, style, .backdrop, .title-text, .sec');
  const taken = (els: Element[]) => els.filter((el) => !skip(el)).map((el) => (framed(el) ? slideBox(app, el) : wordBox(app, el))).filter((b): b is SlideBox => !!b);
  const drawn = slide.matches('.title, .section, .closing') ? [] : [...slide.querySelectorAll(':scope > .backdrop')].flatMap((b) => drawnCells(app, b));
  const above = [...parent.children].slice(0, [...parent.children].indexOf(table)).filter((el) => !el.matches('.run, .foot, [data-generated]'));
  const before = taken(above.filter((el) => !ground(el)));
  const kids = [...slide.querySelectorAll(FLOW_KIDS)].filter((el) => !el.contains(table));
  const others = taken(kids.flatMap((el) => (ground(el) ? [...el.children].filter((c) => c.getClientRects().length) : [el])));
  const tw = t.right - t.left;
  const th = t.bottom - t.top;
  const at = (left: number, top: number): SlideBox => ({ left, top, right: left + tw, bottom: top + th });
  const side = tw + 2 * MARGIN <= w ? MARGIN : room;
  let ink = drawn;
  const free = (b: SlideBox) => b.left >= side - 1 && b.top - room >= 0 && b.bottom <= floor + 1 && b.right <= w - side + 1 &&
    !others.some((o) => meets({ left: b.left - room, top: b.top - room, right: b.right + room, bottom: b.bottom + room }, o)) && !ink.some((o) => meets(b, o));
  const head = slide.querySelector(':scope > h2, :scope > h1');
  const headBox = head ? takenBox(app, head) : null;
  const left = t.left >= room ? t.left : (headBox?.left ?? room);
  const top = Math.max(t.top, ...before.map((b) => b.bottom + room));
  const center = at((w - tw) / 2, (h - th) / 2);
  const from = top >= h || parent === slide && slide.matches('.title, .closing') ? center : at(left, top);
  let best: SlideBox | null = null;
  let place: SlideBox | null = null;
  const figureBox = free(at(left, top)) ? null : freeFigureBox(app, slide, table);
  const under = head ? (headBox?.bottom ?? 0) + room : room;
  for (const d of drawn.length ? [drawn, []] : [drawn]) {
    ink = d;
    place = free(at(left, top)) ? at(left, top) : null;
    const b = figureBox && at((figureBox.left + figureBox.right - tw) / 2, (figureBox.top + figureBox.bottom - th) / 2);
    if (!place && b && free(b)) place = b;
    let near = Infinity;
    for (const y of place ? [] : [from.top, ...Array.from({ length: Math.max(0, Math.floor((floor - th - under) / STEP) + 1) }, (_, i) => under + i * STEP)]) {
      for (const x of [from.left, ...Array.from({ length: Math.max(0, Math.floor((w - 2 * side - tw) / STEP) + 1) }, (_, i) => side + i * STEP)]) {
        const d = Math.hypot(x - from.left, y - from.top);
        if (d < near && free(at(x, y))) {
          near = d;
          best = at(x, y);
        }
      }
    }
    if (place ?? best) break;
  }
  place ??= best ?? centerPlace(w, h, tw, th, piecesOf(app, table), room, room);
  const x = Math.round(place.left - t.left);
  const y = Math.round(place.top - t.top);
  if (x || y) app.doc.setTag(table, { translate: { x, y } }, 'insert table');
}

const boxOfTarget = (t: Target): Box | null => t.box;

const spanText = (n: number) => (n > 1 ? String(n) : null);

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

const rangeSelected = (app: App, t: Target) => app.selection.only() === t.table && !cellAt(app);

function keepCaret(app: App, asRange: boolean): () => void {
  if (asRange) return () => {};
  return app.history.keep(() => {
    const cell = cellAt(app);
    const r = cell && caretIn(cell);
    if (!cell || !r) return null;
    const at = offsetIn(cell, r.startContainer, r.startOffset);
    return () => selectIn(cell, at);
  });
}

function land(app: App, cell: Element | null | undefined, at: 'start' | 'end', asRange: boolean): void {
  if (!isCell(cell)) return;
  if (!asRange) return focusCell(cell, at);
  selectCells(app, cell, cell);
}

async function dropEmptyRows(app: App, table: HTMLTableElement, label: string): Promise<void> {
  for (let r = table.rows.length - 1; r >= 0; r--) {
    const tr = table.rows[r];
    if (tr.cells.length) continue;
    const g = gridOf(table);
    for (const s of new Set(g.grid[r].filter((x): x is Place => !!x))) app.doc.setTag(s.cell, { attrs: { rowspan: spanText(s.rows - 1) } }, label);
    await app.doc.remove(tr, label);
  }
}

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

async function deleteRow(app: App, t: Target): Promise<void> {
  const box = boxOfTarget(t);
  if (!box) return;
  if (box.r1 - box.r0 + 1 >= t.table.rows.length) return deleteTable(app, t);
  const asRange = rangeSelected(app, t);
  for (let r = box.r1; r >= box.r0; r--) await removeRow(app, t.table, r);
  const row = Math.min(box.r0, t.table.rows.length - 1);
  land(app, cellOver(t.table, row, box.c0) ?? t.table.rows[row].cells[0], 'end', asRange);
}

async function removeColumn(app: App, table: HTMLTableElement, c: number): Promise<void> {
  const g = gridOf(table);
  for (const s of new Set(g.grid.map((row) => row[c]).filter((x): x is Place => !!x))) {
    if (s.span > 1) app.doc.setTag(s.cell, { attrs: { colspan: spanText(s.span - 1) } }, 'delete column');
    else await app.doc.remove(s.cell, 'delete column');
  }
}

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

async function deleteColumn(app: App, t: Target): Promise<void> {
  const box = boxOfTarget(t);
  if (!box) return;
  if (box.c1 - box.c0 + 1 >= columnsOf(t.table)) return deleteTable(app, t);
  const asRange = rangeSelected(app, t);
  for (let c = box.c1; c >= box.c0; c--) await removeColumn(app, t.table, c);
  await dropEmptyRows(app, t.table, 'delete column');
  const row = Math.min(box.r0, t.table.rows.length - 1);
  const col = Math.min(box.c0, columnsOf(t.table) - 1);
  land(app, cellOver(t.table, row, col) ?? t.table.rows[row]?.cells[0], 'end', asRange);
}

async function deleteTable(app: App, t: Target): Promise<void> {
  app.selection.clear();
  await app.doc.remove(t.table, 'delete table');
}

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

function alignNumbers(app: App, t: Target, on: boolean, box?: Box): void {
  for (const p of misaligned(t, on, box)) app.doc.setTag(p.cell, { style: { 'text-align': right(p.cell) ? null : 'right' } }, 'align numbers');
}

function misaligned(t: Target, on: boolean, box?: Box): Place[] {
  const numeric = numbersOf(t.table);
  const shown = (p: Place) => !box || (p.row >= box.r0 && p.row <= box.r1 && p.col >= box.c0 && p.col <= box.c1);
  return placesOf(t.table).flat().filter((p) => shown(p) && right(p.cell) !== (on && numeric[p.col]));
}

const alignBox = (t: Target) => (t.box && spotsIn(gridOf(t.table), t.box).length > 1 ? t.box : undefined);

function numbersRight(t: Target | null): boolean {
  if (!t) return false;
  const numeric = numbersOf(t.table);
  const cells = placesOf(t.table).flat().filter((p) => numeric[p.col]);
  return cells.length > 0 && cells.every((p) => right(p.cell));
}

async function mergeCells(app: App, t: Target): Promise<void> {
  const box = t.box!;
  const [first, ...rest] = spotsIn(gridOf(t.table), box);
  const asRange = rangeSelected(app, t);
  const joined = [first, ...rest].map((s) => contentWithTex(s.cell).trim()).filter(Boolean).join('<br>');
  for (const s of rest) await app.doc.remove(s.cell, 'merge cells');
  app.doc.setTag(first.cell, { attrs: { colspan: spanText(box.c1 - box.c0 + 1), rowspan: spanText(box.r1 - box.r0 + 1) } }, 'merge cells');
  if (joined !== contentWithTex(first.cell)) await app.doc.setContent(first.cell, joined, 'merge cells');
  await dropEmptyRows(app, t.table, 'merge cells');
  land(app, first.cell, 'end', asRange);
}

async function unmergeCells(app: App, t: Target): Promise<void> {
  const g = gridOf(t.table);
  const box = t.box!;
  const merged = spotsIn(g, box).filter((s) => s.rows > 1 || s.span > 1);
  const asRange = rangeSelected(app, t);
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
  if (asRange && anchor && focus) selectCells(app, anchor, focus);
  else land(app, t.cell, 'end', false);
}

const mergeable = (t: Target | null) => !!t?.box && spotsIn(gridOf(t.table), t.box).length > 1;
const unmergeable = (t: Target | null) => !!t?.box && spotsIn(gridOf(t.table), t.box).some((s) => s.rows > 1 || s.span > 1);

const NARROWEST = 24;

const contentWidth = (cell: Element) => parseFloat(getComputedStyle(cell).width) || 0;

function leastHeight(tr: HTMLTableRowElement): number {
  const kept = tr.style.height;
  tr.style.height = '1px';
  const h = tr.offsetHeight;
  tr.style.height = kept;
  return h;
}

function writeHeights(app: App, heights: Map<HTMLTableRowElement, number | null>, label: string): void {
  for (const [tr, h] of heights) {
    const text = h === null ? null : `${Math.max(1, Math.round(h))}px`;
    if (tr.style.height !== (text ?? '')) app.doc.setTag(tr, { style: { height: text } }, label);
  }
}

function writeWidths(app: App, widths: Map<HTMLTableCellElement, number>, label: string): void {
  for (const [cell, w] of widths) {
    const text = `${Math.max(1, Math.round(w))}px`;
    if ((cell as HTMLElement).style.width !== text) app.doc.setTag(cell, { style: { width: text } }, label);
  }
}

function firstRowIn(t: Target): Place[] {
  const g = gridOf(t.table);
  const box = t.box && t.box.c1 > t.box.c0 ? t.box : { c0: 0, c1: g.width - 1 };
  return (g.spots[0] ?? []).filter((s) => s.col >= box.c0 && s.col + s.span - 1 <= box.c1);
}

function distributeColumns(app: App, t: Target): void {
  const cells = firstRowIn(t);
  const outer = cells.map((s) => (s.cell as HTMLElement).offsetWidth);
  const each = outer.reduce((a, b) => a + b, 0) / cells.reduce((n, s) => n + s.span, 0);
  writeWidths(app, new Map(cells.map((s, i) => [s.cell, each * s.span - (outer[i] - contentWidth(s.cell))])), 'distribute columns');
}

function rowsIn(t: Target): HTMLTableRowElement[] {
  const rows = [...t.table.rows];
  return t.box && t.box.r1 > t.box.r0 ? rows.slice(t.box.r0, t.box.r1 + 1) : rows;
}

function distributeRows(app: App, t: Target): void {
  const rows = rowsIn(t);
  const slides = app.slides() as HTMLElement;
  const k = slides.offsetWidth ? slides.getBoundingClientRect().width / slides.offsetWidth : 1;
  const high = (r: HTMLTableRowElement) => r.getBoundingClientRect().height / k;
  const outer = rows.map(high);
  const least = rows.map((r) => {
    const kept = r.style.height;
    r.style.height = '1px';
    const h = high(r);
    r.style.height = kept;
    return h;
  });
  const each = Math.max(outer.reduce((a, b) => a + b, 0) / rows.length, ...least);
  const write = (r: HTMLTableRowElement, h: number) => {
    const text = `${Math.max(1, Math.round(h))}px`;
    if (r.style.height !== text) app.doc.setTag(r, { style: { height: text } }, 'distribute rows');
  };
  for (const r of rows) write(r, each);
  for (const r of rows) if (Math.abs(high(r) - each) >= 0.5) write(r, 2 * each - high(r));
}

function columnWidths(table: HTMLTableElement, nowrap: boolean, from = 0, to = Infinity): Map<HTMLTableCellElement, number> {
  const g = gridOf(table);
  const out = new Map<HTMLTableCellElement, number>();
  for (const head of (g.spots[0] ?? []).filter((s) => s.span === 1 && s.col >= from && s.col <= to)) {
    const column = g.grid.map((r) => r[head.col]).filter((s): s is Place => !!s && s.span === 1);
    const kept = column.map((s) => [s.cell.style.whiteSpace, s.cell.style.width, s.cell.hasAttribute('style')] as const);
    if (nowrap) for (const s of column) s.cell.style.whiteSpace = 'nowrap';
    head.cell.style.width = '1px';
    out.set(head.cell, contentWidth(head.cell));
    column.forEach((s, i) => {
      s.cell.style.whiteSpace = kept[i][0];
      s.cell.style.width = kept[i][1];
      if (!kept[i][2]) s.cell.removeAttribute('style');
    });
  }
  return out;
}

const fitWidths = (t: Target) => new Map([...columnWidths(t.table, true, t.box?.c0, t.box?.c1)].map(([c, w]) => [c, Math.ceil(w - 0.01)]));

function writtenHeights(app: App, t: Target): Element[] {
  const rows = [...t.table.rows].slice(t.box?.r0 ?? 0, t.box ? t.box.r1 + 1 : undefined);
  return rows.flatMap((tr) => [tr, ...tr.cells]).filter((el) => app.pairing?.elements.get(el)?.open && app.doc.tagState(el).style.height);
}

async function pasteCells(app: App, cell: HTMLTableCellElement, rows: string[][], asRange = false, markup = false): Promise<void> {
  if (app.commands.refused('edit.paste', { cell })) return;
  const start = placeOf(cell)!;
  const table = cell.closest('table') as HTMLTableElement;
  while (table.rows.length < start.row + rows.length) await addRow(app, { table, cell: null, box: null }, true);
  while (columnsOf(table) < start.col + rows[0].length) await addColumn(app, { table, cell: null, box: null }, true);
  let last: HTMLTableCellElement | null = null;
  const done = new Set<Element>();
  for (const [i, r] of rows.entries()) {
    for (const [j, text] of r.entries()) {
      const target = cellOver(table, start.row + i, start.col + j);
      if (!target || done.has(target)) continue;
      done.add(target);
      const html = markup ? text : cellHtml('td', text).replace(/^<td>|<\/td>$/g, '');
      await app.doc.setContent(target, html, 'paste');
      last = target;
    }
  }
  if (last && asRange) selectCells(app, cell, last);
  else if (last) focusCell(last, 'end');
}

export const selectedRange = (app: App): Target | null => (rangeHeld(app) ? targetOf(app) : null);

export function rangeText(t: Target): { plain: string; html: string } {
  const g = gridOf(t.table);
  const b = t.box!;
  const quote = (v: string) => (/[\t\n"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const plain: string[] = [];
  const html: string[] = [];
  for (let r = b.r0; r <= b.r1; r++) {
    const texts: string[] = [];
    let row = '';
    for (let c = b.c0; c <= b.c1; c++) {
      const s = g.grid[r]?.[c];
      const own = s && s.row === r && s.col === c ? s.cell : null;
      const tag = s?.cell.localName === 'th' ? 'th' : 'td';
      texts.push(own ? cellText(own, true) : '');
      row += `<${tag}>${own ? contentWithTex(own) : ''}</${tag}>`;
    }
    plain.push(texts.map(quote).join('\t'));
    html.push(`<tr>${row}</tr>`);
  }
  return { plain: plain.join('\n'), html: `<table ${CELLS}>${html.join('')}</table>` };
}

function keepingRange<T>(app: App, fn: () => Promise<T>): Promise<T> {
  const take = () => (cellRange ? { ...cellRange } : null);
  const put = (b: typeof cellRange) => {
    if (b?.anchor.isConnected && b.focus.isConnected) selectCells(app, b.anchor, b.focus);
  };
  return app.history.keeping('Clear Cells', take, put, fn);
}

export function clearRange(app: App): Promise<void> {
  return keepingRange(app, async () => {
    const t = selectedRange(app);
    const kept = cellRange;
    if (!t?.box || !kept) return;
    for (const p of spotsIn(gridOf(t.table), t.box)) {
      if (p.cell.childNodes.length) await app.doc.setContent(p.cell, '', 'clear cells');
    }
    selectCells(app, kept.anchor, kept.focus);
  });
}

export async function pasteRange(app: App, text: string, html = ''): Promise<boolean> {
  const t = selectedRange(app);
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  const marked = parseEditorTable(html);
  const rows = marked ?? parseHtmlTable(html) ?? parseTabular(text) ?? (lines ? lines.split('\n').map((l) => [l]) : null);
  const first = t?.box ? cellOver(t.table, t.box.r0, t.box.c0) : null;
  if (!first || !rows) return false;
  await keepingRange(app, () => pasteCells(app, first, rows, true, !!marked));
  return true;
}

export async function pasteAtCell(app: App, text: string, html = ''): Promise<boolean> {
  const cell = cellAt(app);
  const marked = parseEditorTable(html);
  const rows = cell && (marked ?? parseHtmlTable(html) ?? parseTabular(text));
  if (!rows) return false;
  await pasteCells(app, cell, rows, false, !!marked);
  return true;
}

export async function pasteTable(app: App, text: string, html = ''): Promise<boolean> {
  const marked = parseEditorTable(html);
  const rows = marked ?? parseHtmlTable(html) ?? parseTabular(text);
  if (!rows) return false;
  await app.history.transact('Paste', async () => {
    const table = await insertTable(app, rows, null, !!marked, marked ? editorHeads(html) : null);
    app.selection.set('elements', [table]);
  });
  return true;
}

let current: App | null = null;

let cancelMove: ((cancel: boolean) => boolean) | null = null;

function cellItems(cell: HTMLTableCellElement): MenuItem[] {
  const arg = { cell };
  const ids = (list: string[]): MenuItem[] => list.map((command) => ({ command, arg }));
  return [
    ...ids(['edit.cut', 'edit.copy', 'edit.paste']).map((i) => ({ command: (i as { command: string }).command })),
    { rule: true },
    ...ids(['table.rowAbove', 'table.rowBelow', 'table.columnBefore', 'table.columnAfter']),
    { rule: true },
    ...ids(['table.moveRowUp', 'table.moveRowDown', 'table.moveColumnLeft', 'table.moveColumnRight']),
    { rule: true },
    ...ids(['table.deleteRow', 'table.deleteColumn']),
    { rule: true },
    ...ids(['table.selectRow', 'table.selectColumn']),
    { rule: true },
    ...ids(['table.merge', 'table.unmerge']),
    { rule: true },
    ...ids(['table.distributeRows', 'table.distributeColumns', 'table.fitRow', 'table.fitColumn']),
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

let picker: ((restore: boolean) => void) | null = null;

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
  box.append(size, grid, make('div', 'foot', 'Choose with the arrow keys, and insert with Return'), larger);
  let pick: Size | null = null;
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
      if (!(ev.target instanceof Element) || !(box.contains(ev.target) || button?.contains(ev.target))) close(true);
    }, { capture: true, signal });
    for (const type of ['resize', 'blur']) window.addEventListener(type, () => close(true), { signal });
  }, 0);
}

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

function toolbarButton(id: string): DOMRect | null {
  const b = document.querySelector<HTMLElement>(`.beeson-edit-top [data-command="${id}"]`);
  return b && b.getClientRects().length ? b.getBoundingClientRect() : null;
}

const refusedDrag = (app: App, id: string, table: Element | null): boolean => !!table && app.commands.refused(id, { cell: table, els: [table] });

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
  const grips = make('div', 'grips');
  const rowGrips = make('div', 'grips rows');
  const handle = make('div', 'fill');
  handle.title = 'Drag to fill the cells beside the selection';
  handle.hidden = true;
  const spread = make('div', 'spread');
  spread.hidden = true;
  const corners = (['upper-left', 'upper-right', 'lower-left'] as const).map((name) => {
    const c = make('div', 'corner');
    c.dataset.corner = name;
    c.title = 'Drag to extend or shorten the selection';
    c.hidden = true;
    return c;
  });
  const sides = (['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map((h) => {
    const g = make('div', app.platform === 'mac' ? 'beeson-grip square' : 'beeson-grip');
    g.dataset.handle = h;
    g.title = 'Drag to resize the table';
    g.hidden = true;
    return g;
  });
  const gapLine = make('div', 'drop');
  gapLine.hidden = true;
  const lift = make('div', 'lift');
  lift.hidden = true;
  layer.append(cols, rows, grab, addCol, addRow, outline, grips, rowGrips, spread, ...corners, handle, ...sides, lift, gapLine);
  document.body.append(layer);
  for (const type of ['pointerdown', 'mousedown']) layer.addEventListener(type, (ev) => ev.preventDefault());

  const pick = (ev: MouseEvent, column: boolean) => {
    const seg = ev.target instanceof Element ? ev.target.closest<HTMLElement>('[data-index]') : null;
    if (!seg || !shown || (ev.type === 'click' && dragged)) return;
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
    if (!b || !rangeHeld(app) || cellRange?.anchor !== anchor || cellRange.focus !== focus) selectCells(app, anchor, focus);
    if (ev.type === 'click' && !(ev.target as Element).closest('.more')) return;
    ev.preventDefault();
    const arg = { cell: column ? anchor : focus };
    const ids = column
      ? [['table.columnBefore', 'table.columnAfter'], ['table.moveColumnLeft', 'table.moveColumnRight'], ['table.deleteColumn'], ['table.distributeColumns', 'table.fitColumn'], ['table.sortAscending', 'table.sortDescending']]
      : [['table.rowAbove', 'table.rowBelow'], ['table.moveRowUp', 'table.moveRowDown'], ['table.deleteRow'], ['table.distributeRows', 'table.fitRow']];
    const items: MenuItem[] = ids.flatMap((group, k) => [...(k ? [{ rule: true as const }] : []), ...group.map((command) => ({ command, arg }))]);
    openMenu(app, items, { anchor: seg.getBoundingClientRect(), placement: column ? 'below' : 'beside', label: `${seg.title} menu` });
  };
  for (const [bar, column] of [[cols, true], [rows, false]] as const) {
    bar.addEventListener('click', (ev) => pick(ev, column));
    bar.addEventListener('contextmenu', (ev) => pick(ev, column));
  }

  let moving: { kind: Line; table: HTMLTableElement; lo: number; hi: number; x: number; y: number; to: number | null; on: boolean; at: [number, number]; from: [number, number]; grab: [number, number] } | null = null;
  let dragged = false;
  const lifted = (m: NonNullable<typeof moving>) => {
    const t = m.table.getBoundingClientRect();
    const k = t.width / (m.table.offsetWidth || 1);
    const cells = new Set(gridOf(m.table).grid.flatMap((row, r) => row.filter((s, c) => s && (m.kind === 'row' ? r : c) >= m.lo && (m.kind === 'row' ? r : c) <= m.hi).map((s) => s!.cell)));
    const boxes = [...cells].map((c) => c.getBoundingClientRect());
    const left = Math.min(...boxes.map((b) => b.left)), top = Math.min(...boxes.map((b) => b.top));
    const width = Math.max(...boxes.map((b) => b.right)) - left, height = Math.max(...boxes.map((b) => b.bottom)) - top;
    lift.replaceChildren(...[...cells].map((cell, i) => {
      const b = boxes[i];
      const s = getComputedStyle(cell);
      const d = make('div');
      d.style.cssText = `left:${(b.left - left) / k}px;top:${(b.top - top) / k}px;width:${b.width / k}px;height:${b.height / k}px;align-content:${s.verticalAlign === 'middle' ? 'center' : s.verticalAlign === 'bottom' ? 'end' : 'start'}`;
      for (const p of ['font', 'line-height', 'letter-spacing', 'color', 'text-align', 'padding', 'border-top', 'border-right', 'border-bottom', 'border-left', 'background-color']) d.style.setProperty(p, s.getPropertyValue(p));
      const inner = make('div');
      inner.append(...[...cell.childNodes].map((n) => n.cloneNode(true)));
      d.append(inner);
      return d;
    }));
    lift.style.cssText = `width:${width / k}px;height:${height / k}px;background:${getComputedStyle(m.table).getPropertyValue('--bg').trim() || 'Canvas'}`;
    m.from = [(left - t.left) / k, (top - t.top) / k];
    m.grab = [(m.x - left) / k, (m.y - top) / k];
    follow(m, t);
    lift.hidden = false;
  };
  const follow = (m: NonNullable<typeof moving>, t: DOMRect) => {
    const row = m.kind === 'row';
    const k = t.width / (m.table.offsetWidth || 1);
    lift.style.transform = `scale(${k})`;
    lift.style.left = `${row ? t.left + m.from[0] * k : m.at[0] - m.grab[0] * k}px`;
    lift.style.top = `${row ? m.at[1] - m.grab[1] * k : t.top + m.from[1] * k}px`;
  };
  const unlift = () => {
    lift.hidden = true;
    lift.replaceChildren();
  };
  const gapAt = (m: NonNullable<typeof moving>, x: number, y: number): number | null => {
    const spans = m.kind === 'row' ? [...m.table.rows].map((tr) => { const b = tr.getBoundingClientRect(); return [b.top, b.bottom]; }) : columnEdges(m.table);
    const at = m.kind === 'row' ? y : x;
    let k = spans.findIndex(([, end]) => at < end);
    if (k < 0) k = spans.length - 1;
    const to = k < m.lo ? k : k > m.hi ? k + 1 : null;
    return to !== null && movable(m.table, m.kind, m.lo, m.hi, to) ? to : null;
  };
  const endMove = (ev: PointerEvent | null) => {
    const m = moving;
    if (!m) return;
    moving = null;
    document.documentElement.classList.remove('beeson-line-moving', 'beeson-line-refused');
    unlift();
    const to = ev && m.on && app.current()?.contains(m.table) ? gapAt(m, ev.clientX, ev.clientY) : null;
    if (to === null || refusedDrag(app, m.kind === 'row' ? 'table.moveRowUp' : 'table.moveColumnLeft', m.table)) return;
    const range = cellRange && { ...cellRange };
    void app.history.transact(m.kind === 'row' ? 'Move Row' : 'Move Column', () => moveLines(app, m.table, m.kind, m.lo, m.hi, to)).then(() => {
      if (range) selectCells(app, range.anchor, range.focus);
    }).catch((e) => app.fail(e));
  };
  for (const [bar, column] of [[cols, true], [rows, false]] as const) {
    bar.addEventListener('pointerdown', (ev) => {
      dragged = false;
      const seg = ev.target instanceof Element && !ev.target.closest('.more') ? ev.target.closest<HTMLElement>('[data-index]') : null;
      const b = shown?.box;
      if (!seg || !shown || !b || ev.button !== 0 || ev.shiftKey || !rangeHeld(app)) return;
      const g = gridOf(shown.table);
      const whole = column ? b.r0 === 0 && b.r1 === g.grid.length - 1 : b.c0 === 0 && b.c1 === g.width - 1;
      const [lo, hi] = column ? [b.c0, b.c1] : [b.r0, b.r1];
      const i = Number(seg.dataset.index);
      if (!whole || i < lo || i > hi) return;
      moving = { kind: column ? 'column' : 'row', table: shown.table, lo, hi, x: ev.clientX, y: ev.clientY, to: null, on: false, at: [ev.clientX, ev.clientY], from: [0, 0], grab: [0, 0] };
      bar.setPointerCapture(ev.pointerId);
    });
    bar.addEventListener('pointermove', (ev) => {
      const m = moving;
      if (!m || (!m.on && Math.hypot(ev.clientX - m.x, ev.clientY - m.y) < 4)) return;
      if (!m.on && refusedDrag(app, m.kind === 'row' ? 'table.moveRowUp' : 'table.moveColumnLeft', m.table)) {
        dragged = true;
        stopMove();
        return;
      }
      m.at = [ev.clientX, ev.clientY];
      if (!m.on && movableAnywhere(m.table, m.kind, m.lo, m.hi)) lifted(m);
      m.on = dragged = true;
      document.documentElement.classList.add(lift.hidden ? 'beeson-line-refused' : 'beeson-line-moving');
      m.to = gapAt(m, ev.clientX, ev.clientY);
    });
    bar.addEventListener('pointerup', (ev) => endMove(ev));
    bar.addEventListener('pointercancel', () => endMove(null));
    bar.addEventListener('lostpointercapture', () => endMove(null));
  }
  const stopMove = () => {
    moving = null;
    document.documentElement.classList.remove('beeson-line-moving', 'beeson-line-refused');
    unlift();
  };
  cancelMove = (cancel) => {
    if (!moving) return false;
    if (cancel) stopMove();
    return true;
  };

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

  let resize: { cells: HTMLTableCellElement[]; widths: number[]; styles: string[]; least: number[]; i: number; x: number; scale: number; on: boolean } | null = null;
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
      i: Number(grip.dataset.grip), x: ev.clientX, scale: box.width / (shown.table.offsetWidth || 1) || 1, on: false,
    };
    grip.setPointerCapture(ev.pointerId);
    grip.classList.add('on');
    document.documentElement.classList.add('beeson-column-resizing');
  });
  grips.addEventListener('pointermove', (ev) => {
    if (!resize || (!resize.on && ev.clientX === resize.x)) return;
    if (!resize.on && refusedDrag(app, 'arrange.setSize', resize.cells[0].closest('table'))) {
      resize = null;
      document.documentElement.classList.remove('beeson-column-resizing');
      return;
    }
    resize.on = true;
    for (const [cell, w] of sized(ev)) cell.style.width = `${Math.round(w)}px`;
    overlay().draw();
  });
  const drop = (ev: PointerEvent | null) => {
    const r = resize;
    if (!r) return;
    const widths = ev ? sized(ev) : null;
    resize = null;
    for (const g of grips.children) g.classList.remove('on');
    document.documentElement.classList.remove('beeson-column-resizing');
    r.cells.forEach((c, i) => {
      c.style.width = r.styles[i];
    });
    if (widths && [...widths].some(([c, w]) => Math.abs(w - r.widths[r.cells.indexOf(c)]) >= 0.5) && !refusedDrag(app, 'arrange.setSize', r.cells[0].closest('table'))) {
      void app.history.transact('Resize Column', () => writeWidths(app, widths, 'resize column')).catch((e) => app.fail(e));
    }
  };
  grips.addEventListener('pointerup', (ev) => drop(ev));
  grips.addEventListener('pointercancel', () => drop(null));
  grips.addEventListener('lostpointercapture', () => drop(null));

  let filling: { table: HTMLTableElement; from: Box; to: Box; x: number; y: number } | null = null;
  handle.addEventListener('pointerdown', (ev) => {
    if (!shown?.box || ev.button !== 0 || !rangeHeld(app)) return;
    filling = { table: shown.table, from: shown.box, to: shown.box, x: ev.clientX, y: ev.clientY };
    handle.setPointerCapture(ev.pointerId);
    document.documentElement.classList.add('beeson-autofilling');
  });
  handle.addEventListener('pointermove', (ev) => {
    if (!filling) return;
    const to = reach(filling.table, filling.from, ev.clientX, ev.clientY);
    Object.assign(filling, { x: ev.clientX, y: ev.clientY });
    if (sameBox(to, filling.to)) return;
    if (sameBox(filling.to, filling.from) && refusedDrag(app, 'edit.paste', filling.table)) {
      filling = null;
      reaching = null;
      document.documentElement.classList.remove('beeson-autofilling');
      app.invalidate('selection');
      return;
    }
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
    if (sameBox(to, f.from) || refusedDrag(app, 'edit.paste', f.table)) return;
    void app.history.transact('Autofill', () => autofill(app, f.table, f.from, to)).then(() => {
      const a = cellOver(f.table, to.r0, to.c0);
      const b = cellOver(f.table, to.r1, to.c1);
      if (a && b) selectCells(app, a, b);
    }).catch((e) => app.fail(e));
  };
  handle.addEventListener('pointerup', (ev) => endFill(ev));
  handle.addEventListener('pointercancel', () => endFill(null));

  let stretching: { table: HTMLTableElement; row: number; col: number } | null = null;
  for (const c of corners) {
    c.addEventListener('pointerdown', (ev) => {
      const at = shown?.box;
      if (!at || !shown || ev.button !== 0 || !rangeHeld(app)) return;
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
      if (a && b && (cellRange?.anchor !== a || cellRange?.focus !== b)) selectCells(app, a, b);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) c.addEventListener(type, () => (stretching = null));
  }

  let widening: {
    table: HTMLTableElement; cells: HTMLTableCellElement[]; outer: number[]; content: number[]; styles: string[]; rows: HTMLTableRowElement[]; tall: number[]; least: number[]; heights: string[];
    at: number[]; moved: string; handle: string; x: number; y: number; scale: number; width: number; height: number; on: boolean;
  } | null = null;
  const widen = (ev: PointerEvent) => {
    const r = widening!;
    const sx = r.handle.includes('e') ? 1 : r.handle.includes('w') ? -1 : 0;
    const sy = r.handle.includes('s') ? 1 : r.handle.includes('n') ? -1 : 0;
    let kx = sx ? Math.max(0.05, (r.width + (sx * (ev.clientX - r.x)) / r.scale) / r.width) : 1;
    let ky = sy ? Math.max(0.05, (r.height + (sy * (ev.clientY - r.y)) / r.scale) / r.height) : 1;
    if (ev.shiftKey) kx = ky = sx && (!sy || Math.abs(kx - 1) >= Math.abs(ky - 1)) ? kx : ky;
    const widths = kx === 1 ? null : new Map(r.cells.map((c, i) => [c, Math.round(Math.max(NARROWEST, r.outer[i] * kx - r.outer[i] + r.content[i]))]));
    const heights = ky === 1 ? null : new Map(r.rows.map((tr, i) => [tr, r.tall[i] * ky > r.least[i] + 0.5 ? Math.round(r.tall[i] * ky) : null]));
    r.cells.forEach((c, i) => (c.style.width = widths ? `${widths.get(c)}px` : r.styles[i]));
    r.rows.forEach((tr, i) => (tr.style.height = heights ? (heights.get(tr) === null ? '' : `${heights.get(tr)}px`) : r.heights[i]));
    const shift = [sx < 0 ? r.width - r.table.offsetWidth : 0, sy < 0 ? r.height - r.table.offsetHeight : 0];
    r.table.style.translate = shift[0] || shift[1] ? `${r.at[0] + shift[0]}px ${r.at[1] + shift[1]}px` : r.moved;
    return { widths, heights, shift };
  };
  for (const g of sides) {
    g.addEventListener('pointerdown', (ev) => {
      if (!shown || ev.button !== 0 || !asObject(app, shown.table)) return;
      const table = shown.table;
      const cells = (gridOf(table).spots[0] ?? []).map((s) => s.cell);
      const rows = [...table.rows];
      const at = (table.style.translate || '0 0').split(/\s+/).map((v) => parseFloat(v) || 0);
      widening = {
        table, cells, outer: cells.map((c) => c.offsetWidth), content: cells.map(contentWidth), styles: cells.map((c) => c.style.width),
        rows, tall: rows.map((tr) => tr.offsetHeight), least: rows.map(leastHeight), heights: rows.map((tr) => tr.style.height),
        at: [at[0] ?? 0, at[1] ?? 0], moved: table.style.translate, handle: g.dataset.handle ?? 'e', x: ev.clientX, y: ev.clientY,
        scale: table.getBoundingClientRect().width / (table.offsetWidth || 1) || 1, width: table.offsetWidth || 1, height: table.offsetHeight || 1, on: false,
      };
      g.setPointerCapture(ev.pointerId);
      document.documentElement.classList.add('beeson-resizing');
    });
    g.addEventListener('pointermove', (ev) => {
      const r = widening;
      if (!r || (!r.on && ev.clientX === r.x && ev.clientY === r.y)) return;
      if (!r.on && refusedDrag(app, 'arrange.setSize', r.table)) {
        widening = null;
        document.documentElement.classList.remove('beeson-resizing');
        return;
      }
      r.on = true;
      widen(ev);
      overlay().draw();
    });
    const end = (ev: PointerEvent | null) => {
      const r = widening;
      if (!r) return;
      const done = ev && Math.hypot(ev.clientX - r.x, ev.clientY - r.y) >= 1 ? widen(ev) : null;
      widening = null;
      document.documentElement.classList.remove('beeson-resizing');
      r.cells.forEach((c, i) => (c.style.width = r.styles[i]));
      r.rows.forEach((tr, i) => (tr.style.height = r.heights[i]));
      r.table.style.translate = r.moved;
      if (!done || (!done.widths && !done.heights) || refusedDrag(app, 'arrange.setSize', r.table)) return;
      void app.history.transact('Resize Table', () => {
        if (done.widths) writeWidths(app, done.widths, 'resize table');
        if (done.heights) writeHeights(app, done.heights, 'resize table');
        const [x, y] = [r.at[0] + done.shift[0], r.at[1] + done.shift[1]];
        if (done.shift[0] || done.shift[1]) app.doc.setTag(r.table, { translate: x || y ? { x, y } : null }, 'resize table');
      }).catch((e) => app.fail(e));
    };
    g.addEventListener('pointerup', (ev) => end(ev));
    g.addEventListener('pointercancel', () => end(null));
    g.addEventListener('lostpointercapture', () => end(null));
  }

  let heightening: { tr: HTMLTableRowElement; tall: number; least: number; style: string; y: number; scale: number; on: boolean } | null = null;
  const heightOf = (ev: PointerEvent): number | null => {
    const r = heightening!;
    const h = r.tall + (ev.clientY - r.y) / r.scale;
    return h > r.least + 0.5 ? Math.round(h) : null;
  };
  rowGrips.addEventListener('pointerdown', (ev) => {
    const grip = ev.target instanceof HTMLElement ? ev.target.closest<HTMLElement>('[data-row]') : null;
    const tr = grip && shown ? shown.table.rows[Number(grip.dataset.row)] : null;
    if (!grip || !tr || !shown || ev.button !== 0) return;
    heightening = { tr, tall: tr.offsetHeight, least: leastHeight(tr), style: tr.style.height, y: ev.clientY, scale: shown.table.getBoundingClientRect().width / (shown.table.offsetWidth || 1) || 1, on: false };
    grip.setPointerCapture(ev.pointerId);
    grip.classList.add('on');
    document.documentElement.classList.add('beeson-row-resizing');
  });
  rowGrips.addEventListener('pointermove', (ev) => {
    const r = heightening;
    if (!r || (!r.on && ev.clientY === r.y)) return;
    if (!r.on && refusedDrag(app, 'arrange.setSize', r.tr.closest('table'))) {
      heightening = null;
      for (const g of rowGrips.children) g.classList.remove('on');
      document.documentElement.classList.remove('beeson-row-resizing');
      return;
    }
    r.on = true;
    const h = heightOf(ev);
    r.tr.style.height = h === null ? '' : `${h}px`;
    overlay().draw();
  });
  const dropRow = (ev: PointerEvent | null) => {
    const r = heightening;
    if (!r) return;
    const h = ev && r.on ? heightOf(ev) : undefined;
    heightening = null;
    for (const g of rowGrips.children) g.classList.remove('on');
    document.documentElement.classList.remove('beeson-row-resizing');
    r.tr.style.height = r.style;
    if (h === undefined || (h === null ? !r.style : Math.abs(h - r.tall) < 0.5) || refusedDrag(app, 'arrange.setSize', r.tr.closest('table'))) return;
    void app.history.transact('Resize Row', () => writeHeights(app, new Map([[r.tr, h]]), 'resize row')).catch((e) => app.fail(e));
  };
  rowGrips.addEventListener('pointerup', (ev) => dropRow(ev));
  rowGrips.addEventListener('pointercancel', () => dropRow(null));
  rowGrips.addEventListener('lostpointercapture', () => dropRow(null));

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
    const coarse = COARSE.matches;
    const reach = coarse ? 2 * GRIP : Math.min(GRIP, ...rowBoxes.map((b) => b.height / 3));
    first.forEach((s, i) => {
      const x = edges[s.col + s.span - 1][1];
      if (coarse) place(grips.children[i], x - reach / 2, top, reach, BAR);
      else place(grips.children[i], x - GRIP + 2, top, GRIP, box.bottom - top);
    });
    if (rowGrips.children.length !== rowBoxes.length) {
      rowGrips.replaceChildren(...rowBoxes.map((_, i) => {
        const g = make('div', 'grip');
        g.dataset.row = String(i);
        g.title = 'Drag to resize the row';
        return g;
      }));
    }
    rowBoxes.forEach((b, i) => place(rowGrips.children[i], left, b.bottom - reach / 2, coarse ? BAR : box.right - left, reach));
    const gap = moving?.on && moving.table === t.table ? moving.to : null;
    gapLine.hidden = gap === null;
    if (gap !== null && moving!.kind === 'row') {
      const y = gap < rowBoxes.length ? rowBoxes[gap].top : rowBoxes[rowBoxes.length - 1].bottom;
      place(gapLine, box.left, y - 1.5, box.width, 3);
    } else if (gap !== null) {
      const x = gap < edges.length ? edges[gap][0] : edges[edges.length - 1][1];
      place(gapLine, x - 1.5, box.top, 3, box.height);
    }
    if (moving?.on && moving.table === t.table) follow(moving, box);
    const v = app.stage?.viewport;
    const inX = (x: number) => (v ? Math.max(v.left + 2, Math.min(x, v.right - BAR - 2)) : x);
    const inY = (y: number) => (v ? Math.max(v.top + 2, Math.min(y, v.bottom - BAR - 2)) : y);
    place(grab, inX(left), inY(top), BAR, BAR);
    place(addCol, inX(box.right + GAP), inY(top), BAR, BAR);
    place(addRow, inX(left), inY(box.bottom + GAP), BAR, BAR);
    outline.hidden = !at;
    const ranged = !!at && rangeHeld(app);
    outline.classList.toggle('range', ranged);
    handle.hidden = !ranged && !filling;
    if (at) {
      const r = boxRect(t.table, at);
      const f = ranged ? FRAME_RANGE : FRAME;
      const g = gridOf(t.table).grid;
      const first = g[at.r0]?.[at.c0]?.cell, last = g[at.r1]?.[at.c1]?.cell;
      const k = first ? first.getBoundingClientRect().width / (first.offsetWidth || 1) : 1;
      const out = (c: HTMLElement | undefined, side: 'Left' | 'Top' | 'Right' | 'Bottom') => !c || parseFloat(getComputedStyle(c)[`padding${side}`]) * k < f ? f : 0;
      const x0 = r.left - out(first, 'Left'), y0 = r.top - out(first, 'Top');
      place(outline, x0, y0, r.right + out(last, 'Right') - x0, r.bottom + out(last, 'Bottom') - y0);
      if (filling) place(handle, filling.x - 5.5, filling.y - 5.5, 11, 11);
      else if (!handle.hidden) place(handle, r.right - 5, r.bottom - 5, 11, 11);
      const ends = { 'upper-left': [r.left, r.top], 'upper-right': [r.right, r.top], 'lower-left': [r.left, r.bottom] };
      for (const c of corners) {
        c.hidden = !ranged || !!filling;
        const [x, y] = ends[c.dataset.corner as keyof typeof ends];
        if (!c.hidden) place(c, x - 6, y - 6, 11, 11);
      }
    } else for (const c of corners) c.hidden = true;
    const whole = !!widening || (asObject(app, t.table) && !t.table.hasAttribute('data-locked'));
    for (const g of sides) {
      g.hidden = !whole;
      const h = g.dataset.handle ?? '';
      const x = h.includes('w') ? box.left : h.includes('e') ? box.right : (box.left + box.right) / 2;
      const y = h.includes('n') ? box.top : h.includes('s') ? box.bottom : (box.top + box.bottom) / 2;
      if (whole) g.style.cssText = `left:${x}px;top:${y}px`;
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
    if (moving && !app.current()?.contains(moving.table)) stopMove();
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

function columnEdges(table: HTMLTableElement): number[][] {
  const edges = Array.from({ length: columnsOf(table) }, () => [Infinity, -Infinity]);
  for (const p of placesOf(table).flat()) {
    const b = p.cell.getBoundingClientRect();
    edges[p.col][0] = Math.min(edges[p.col][0], b.left);
    edges[p.col + p.span - 1][1] = Math.max(edges[p.col + p.span - 1][1], b.right);
  }
  return edges;
}

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

function spotAt(table: HTMLTableElement, x: number, y: number): { row: number; col: number } {
  const rows = [...table.rows].map((tr) => tr.getBoundingClientRect());
  const edges = columnEdges(table);
  const row = rows.findIndex((r) => y < r.bottom);
  const col = edges.findIndex(([, r]) => x < r);
  return { row: Math.max(0, row < 0 ? rows.length - 1 : row), col: Math.max(0, col < 0 ? edges.length - 1 : col) };
}

const sameBox = (a: Box, b: Box) => a.r0 === b.r0 && a.c0 === b.c0 && a.r1 === b.r1 && a.c1 === b.c1;

function reach(table: HTMLTableElement, from: Box, x: number, y: number): Box {
  const { row, col } = spotAt(table, x, y);
  const dr = row > from.r1 ? row - from.r1 : row < from.r0 ? from.r0 - row : 0;
  const dc = col > from.c1 ? col - from.c1 : col < from.c0 ? from.c0 - col : 0;
  if (dr && dr >= dc) return row > from.r1 ? { ...from, r1: row } : { ...from, r0: row };
  if (dc) return col > from.c1 ? { ...from, c1: col } : { ...from, c0: col };
  return from;
}

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
    if (!forward) along.reverse();
    const line = along.map((i) => (vertical ? content(i, across) : content(across, i)));
    for (const [k, f] of fillLine(line, count).entries()) {
      const i = forward ? along[along.length - 1] + 1 + k : along[along.length - 1] - 1 - k;
      const html = 'text' in f ? f.text : line[f.copy];
      await (vertical ? write(i, across, html) : write(across, i, html));
    }
  }
}

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
  const RANGE_KEYS: Command[] = [];
  c.intercept((ev) => {
    if (!cancelMove?.(ev.key === 'Escape')) return false;
    ev.preventDefault();
    return true;
  });
  c.intercept((ev) => {
    if (ev.isComposing || menuOpen() || picker || app.region() !== 'canvas' || !rangeHeld(app)) return false;
    if (ev.key === 'Escape' && previewPlays()) return false;
    const hit = (x: Command | undefined) => !!x && keysOf(x, app.platform).some((k) => matches(ev, k, app.platform));
    const key = RANGE_KEYS.find(hit);
    if (!key && hit(c.get('edit.duplicate'))) ev.preventDefault();
    if (!key) return false;
    ev.preventDefault();
    void c.run(key.id, undefined, ev).catch(fail);
    return true;
  });
  c.intercept((ev) => {
    if (menuOpen() || !(ev.key === 'ContextMenu' || (ev.key === 'F10' && ev.shiftKey && !ev.metaKey && !ev.ctrlKey && !ev.altKey))) return false;
    const cell = cellAt(app);
    if (!cell) return false;
    ev.preventDefault();
    const r = cell.getBoundingClientRect();
    openCellMenu(app, cell, { x: r.left + 8, y: r.top + Math.min(r.height, 24) });
    return true;
  });
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
      await newTable(a, size, emptySlot(a, a.current()!));
    },
  });

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

  const rowCommand = (id: string, label: string, order: number, below: boolean, key: string) => c.define({
    id,
    label,
    keys: { mac: [key], other: [key] },
    in: ['canvas'],
    inText: ['other'],
    menu: menu('add', order),
    enabled: withTable,
    undoable: true,
    run: async (a, arg) => {
      const t = need(a, arg);
      const asRange = rangeSelected(a, t);
      const kept = keepCaret(a, asRange);
      const col = t.cell ? placeOf(t.cell)!.col : 0;
      const tr = await addRow(a, t, below);
      land(a, cellOver(t.table, [...t.table.rows].indexOf(tr), col) ?? tr.cells[0], 'start', asRange);
      kept();
    },
  });
  rowCommand('table.rowAbove', 'Add Row Above', 80, false, 'Alt+ArrowUp');
  rowCommand('table.rowBelow', 'Add Row Below', 81, true, 'Alt+ArrowDown');
  const columnCommand = (id: string, label: string, order: number, after: boolean, key: string) => c.define({
    id,
    label,
    keys: { mac: [key], other: [key] },
    in: ['canvas'],
    inText: ['other'],
    menu: menu('add', order),
    enabled: withTable,
    undoable: true,
    run: async (a, arg) => {
      const t = need(a, arg);
      const asRange = rangeSelected(a, t);
      const kept = keepCaret(a, asRange);
      land(a, await addColumn(a, t, after), 'start', asRange);
      kept();
    },
  });
  columnCommand('table.columnBefore', 'Add Column Before', 82, false, 'Alt+ArrowLeft');
  columnCommand('table.columnAfter', 'Add Column After', 83, true, 'Alt+ArrowRight');
  const moveCommand = (id: string, label: string, order: number, kind: Line, way: -1 | 1) => c.define({
    id,
    label,
    menu: menu('move', order),
    enabled: (a, arg?: unknown) => ready(a) && !!moveOf(targetOf(a, arg), kind, way),
    undoable: true,
    run: async (a, arg) => {
      const t = need(a, arg);
      const m = moveOf(t, kind, way);
      if (!m) return;
      const range = rangeSelected(a, t) && cellRange ? { ...cellRange } : null;
      await moveLines(a, t.table, kind, m.lo, m.hi, m.to);
      if (range) selectCells(a, range.anchor, range.focus);
      else if (t.cell) focusCell(t.cell, 'start');
    },
  });
  moveCommand('table.moveRowUp', 'Move Row Up', 83.1, 'row', -1);
  moveCommand('table.moveRowDown', 'Move Row Down', 83.2, 'row', 1);
  moveCommand('table.moveColumnLeft', 'Move Column Left', 83.3, 'column', -1);
  moveCommand('table.moveColumnRight', 'Move Column Right', 83.4, 'column', 1);
  c.define({
    id: 'table.deleteRow',
    label: 'Delete Row',
    keys: { mac: ['Mod+Alt+Backspace'], other: ['Ctrl+Shift+Backspace'] },
    in: ['text', 'canvas'],
    menu: menu('delete', 84),
    enabled: withCell,
    undoable: true,
    run: (a, arg) => deleteRow(a, need(a, arg)),
  });
  c.define({
    id: 'table.deleteColumn',
    label: 'Delete Column',
    keys: { mac: ['Ctrl+Mod+Backspace'], other: ['Alt+Shift+Backspace'] },
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
  c.define({
    id: 'table.autoAlign',
    label: 'Auto-Align',
    keys: { mac: ['Alt+Mod+U'], other: ['Alt+Shift+U'] },
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
    keys: { mac: ['Ctrl+Mod+M'], other: ['Alt+Shift+M'] },
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
    id: 'table.distributeRows',
    label: 'Distribute Rows Evenly',
    menu: menu('size', 79.84),
    enabled: (a, arg?: unknown) => {
      const t = ready(a) ? targetOf(a, arg) : null;
      return !!t && rowsIn(t).length > 1;
    },
    undoable: true,
    run: (a, arg) => distributeRows(a, need(a, arg)),
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
      return !!t && !!gridOf(t.table).spots[0]?.some((s) => s.span === 1 && (!t.box || (s.col >= t.box.c0 && s.col <= t.box.c1)));
    },
    undoable: true,
    run: (a, arg) => {
      const t = need(a, arg);
      writeWidths(a, fitWidths(t), 'fit column');
    },
  });
  c.define({
    id: 'table.fitRow',
    label: 'Resize Row to Fit Content',
    menu: menu('size', 79.88),
    enabled: (a, arg?: unknown) => {
      const t = ready(a) ? targetOf(a, arg) : null;
      return !!t && writtenHeights(a, t).length > 0;
    },
    undoable: true,
    run: (a, arg) => {
      for (const el of writtenHeights(a, need(a, arg))) a.doc.setTag(el, { style: { height: null } }, 'fit row');
    },
  });

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

  const ways = [['Left', 0, -1], ['Right', 0, 1], ['Up', -1, 0], ['Down', 1, 0]] as const;
  for (const [way, dr, dc] of ways) {
    const beside = (): HTMLTableCellElement | null => {
      const f = cellRange && placeOf(cellRange.focus);
      if (!f) return null;
      const g = gridOf(cellRange!.focus.closest('table') as HTMLTableElement);
      const row = dr > 0 ? f.row + f.rows : dr < 0 ? f.row - 1 : f.row;
      const col = dc > 0 ? f.col + f.span : dc < 0 ? f.col - 1 : f.col;
      return g.grid[row]?.[col]?.cell ?? null;
    };
    for (const extend of [false, true]) {
      const key = `${extend ? 'Shift+' : ''}Arrow${way}`;
      RANGE_KEYS.push(c.define({
        id: `table.${extend ? 'extend' : 'select'}${way}`,
        label: `${extend ? 'Extend Selection' : 'Select Cell'} ${way === 'Left' ? 'Before' : way === 'Right' ? 'After' : way === 'Up' ? 'Above' : 'Below'}`,
        keys: { mac: [key], other: [key] },
        in: ['canvas'],
        enabled: rangeHeld,
        run: (a) => {
          const to = beside();
          if (to && cellRange) selectCells(a, extend ? cellRange.anchor : to, to);
        },
      }));
    }
  }
  RANGE_KEYS.push(c.define({
    id: 'table.selectTable',
    label: 'Select Table',
    keys: { mac: ['Escape'], other: ['Escape'] },
    in: ['canvas'],
    enabled: rangeHeld,
    run: (a) => {
      const t = need(a);
      selectTable(a, t.table);
    },
  }));
  RANGE_KEYS.push(c.define({
    id: 'table.editCell',
    label: 'Edit Cell',
    keys: { mac: ['Enter'], other: ['Enter'] },
    in: ['canvas'],
    enabled: rangeHeld,
    run: () => {
      if (cellRange) focusCell(cellRange.focus, 'end');
    },
  }));
  RANGE_KEYS.push(c.define({
    id: 'table.clearCells',
    label: 'Clear Cells',
    keys: { mac: ['Backspace', 'Delete'], other: ['Backspace', 'Delete'] },
    in: ['canvas'],
    enabled: rangeHeld,
    undoable: true,
    run: (a) => clearRange(a),
  }));

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

  window.addEventListener('contextmenu', (ev) => {
    const target = ev.target instanceof Element ? ev.target.closest(CELL) : null;
    if (!isCell(target) || !app.pairing?.byLive.has(target) || !app.current()?.contains(target)) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (cellAt(app) !== target && !inRange(target)) focusCell(target, 'end');
    openCellMenu(app, target, { x: ev.clientX, y: ev.clientY });
  }, true);

  let press: HTMLTableCellElement | null = null;
  let held = false;
  const stop = (ev: Event) => {
    ev.preventDefault();
    ev.stopImmediatePropagation();
  };
  window.addEventListener('pointerdown', (ev) => {
    press = null;
    held = false;
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
      if (!asObject(app, cell.closest('table') as HTMLTableElement)) press = cell;
      return;
    }
    const table = cell.closest('table');
    const from = rangeHeld(app) ? cellRange!.anchor : cellAt(app);
    if (!from || from.closest('table') !== table || (from === cell && !rangeHeld(app))) return;
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
    if (cellRange?.anchor !== press || cellRange.focus !== over || !rangeHeld(app)) selectCells(app, press, over);
    window.getSelection()?.removeAllRanges();
  }, true);
  const release = () => {
    press = null;
    held = false;
    document.documentElement.classList.remove('beeson-cell-range');
  };
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);

  window.addEventListener('paste', (ev) => {
    const data = ev.clipboardData;
    if (ev.defaultPrevented || !data || !ready(app)) return;
    const html = data.getData('text/html');
    const text = data.getData('text/plain');
    if (html.includes(MARK) || text.includes(MARK)) return;
    const region = app.region();
    const onSlide = CLIPBOARD_REGIONS.includes(region);
    if (onSlide && (text.trim() || html) && selectedRange(app)) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      void app.history.transact('Paste', () => pasteRange(app, text, html)).catch(fail);
      return;
    }
    const cell = region === 'text' ? cellAt(app) : null;
    if (!onSlide && !cell) return;
    const marked = parseEditorTable(html);
    const rows = marked ?? parseHtmlTable(html) ?? parseTabular(text);
    if (!rows) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    closeMenus();
    if (cell) {
      void app.history.transact('Paste', () => pasteCells(app, cell, rows, false, !!marked)).catch(fail);
      return;
    }
    void pasteTable(app, text, html).catch(fail);
  }, true);

  installBars(app);
}
