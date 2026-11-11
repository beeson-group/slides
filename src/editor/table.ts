// the model of a table of the slides, as the editor writes it: a table with an explicit tbody, one
// row per line, a first row of th as the header row, and the cells of a column of numbers set at
// the right with the declaration text-align, the one style of a cell that the scope rule allows.
// the text of a new table is built here from a size or from the cells of a paste. a paste is
// either tab-separated text, as a spreadsheet or a table of Keynote or PowerPoint is put on the
// clipboard, or an HTML table. the cells of a table on the page are laid out in a grid with their
// colspan and rowspan. the functions without a page are tested under node

import type { TextStyle } from './model/templates.ts';

// the size of the grid of the Insert Table popover, 10 columns by 8 rows as in PowerPoint, and the
// largest table of the Insert Table dialog
export const GRID = { columns: 10, rows: 8 };
export const MOST = { columns: 30, rows: 75 };

export const CELL = 'td, th';

// a number of a table, e.g. 42, -3.5, 1,200, $9.99, 12 %, (10.00), or 3.2e-4, which is set at the
// right of its cell
const NUMBER = /^[(−+-]?[$€£¥]?\s?[−+-]?(\d{1,3}(,\d{3})+|\d+)?([.,]\d+)?([eE][−+-]?\d+)?\s?(%|‰)?\)?$/;

export function isNumeric(text: string): boolean {
  const t = text.trim();
  return /^[^eE]*\d/.test(t) && NUMBER.test(t);
}

// the cells of tab-separated text, with a row per line and a tab between two cells. a cell in
// double quotes, as a spreadsheet writes a cell with a tab or a line break, is read without its
// quotes. null when the text does not have a tab, since a paste of plain lines is a paste of text
export function parseTabular(text: string): string[][] | null {
  const t = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  if (!t.includes('\t')) return null;
  const rows: string[][] = [[]];
  let cell = '';
  let i = 0;
  let start = true;
  while (i < t.length) {
    const ch = t[i];
    if (start && ch === '"') {
      let j = i + 1;
      let quoted = '';
      while (j < t.length) {
        if (t[j] === '"' && t[j + 1] === '"') {
          quoted += '"';
          j += 2;
        } else if (t[j] === '"') break;
        else quoted += t[j++];
      }
      if (j < t.length && (j + 1 === t.length || t[j + 1] === '\t' || t[j + 1] === '\n')) {
        cell = quoted;
        i = j + 1;
        start = false;
        continue;
      }
    }
    start = false;
    if (ch === '\t' || ch === '\n') {
      rows[rows.length - 1].push(cell.trim());
      cell = '';
      if (ch === '\n') rows.push([]);
      start = true;
    } else cell += ch;
    i++;
  }
  rows[rows.length - 1].push(cell.trim());
  return square(rows);
}

// rows padded with empty cells to the width of the widest one, or null with fewer than two cells
// or without a text
function square(rows: string[][]): string[][] | null {
  const width = Math.max(0, ...rows.map((r) => r.length));
  if (!rows.length || rows.length * width < 2 || !rows.some((r) => r.some((c) => c.trim()))) return null;
  return rows.map((r) => [...r, ...Array<string>(width - r.length).fill('')]);
}

// the text of a cell of a pasted table, with the white space of the markup collapsed and a br read
// as a line break
function cellText(el: Element): string {
  const parts: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === 3) parts.push((n as Text).data);
    else if (n instanceof Element) {
      if (n.localName === 'br') parts.push('\n');
      else if (!['style', 'script'].includes(n.localName)) n.childNodes.forEach(walk);
    }
  };
  walk(el);
  return parts.join('').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).join('\n').trim();
}

// the cells of the first table of an HTML text, e.g. from a web page or a spreadsheet, with a cell
// of colspan followed by empty cells. null without a table of two cells
export function parseHtmlTable(html: string): string[][] | null {
  if (!/<table[\s>]/i.test(html)) return null;
  const table = new DOMParser().parseFromString(html, 'text/html').querySelector('table');
  if (!table) return null;
  const rows = [...table.rows].map((tr) => [...tr.cells].flatMap((c) => [cellText(c), ...Array<string>(Math.max(0, c.colSpan - 1)).fill('')]));
  return square(rows.filter((r) => r.length));
}

// the mark of a table that a cut or a copy of a range of cells of the editor writes
export const CELLS = 'data-beeson="cells"';

// the HTML of the children of el with only the inline elements of the theme, i.e. strong, em, s, a
// span of one class tone-*, and br. every other element is reduced to its text, without a script
// or a style
function inlineHtml(el: Element): string {
  let out = '';
  for (const n of el.childNodes) {
    if (n.nodeType === 3) out += escape((n as Text).data).replace(/\u00a0/g, '&nbsp;');
    if (!(n instanceof Element) || ['script', 'style'].includes(n.localName)) continue;
    const tone = n.localName === 'span' && n.classList.length === 1 && /^tone-(accent|violet|blue|red|subtle|muted)$/.test(n.className);
    if (n.localName === 'br') out += '<br>';
    else if (['strong', 'em', 's'].includes(n.localName)) out += `<${n.localName}>${inlineHtml(n)}</${n.localName}>`;
    else if (tone) out += `<span class="${n.className}">${inlineHtml(n)}</span>`;
    else out += inlineHtml(n);
  }
  return out;
}

// the inner HTML of each cell of a table marked with CELLS, kept to the inline elements of the
// theme and to formulas, with a cell of colspan followed by empty cells. null without such a table
export function parseEditorTable(html: string): string[][] | null {
  if (!html.includes(CELLS)) return null;
  const table = new DOMParser().parseFromString(html, 'text/html').querySelector(`table[${CELLS}]`) as HTMLTableElement | null;
  if (!table) return null;
  const rows = [...table.rows].map((tr) => [...tr.cells].flatMap((c) => [inlineHtml(c), ...Array<string>(Math.max(0, c.colSpan - 1)).fill('')]));
  return square(rows.filter((r) => r.length));
}

// the columns of rows that hold numbers, i.e. every cell below the header row that is not empty is
// a number, and at least one is
export function numericColumns(rows: string[][]): boolean[] {
  const width = rows[0]?.length ?? 0;
  return Array.from({ length: width }, (_, c) => {
    const body = rows.slice(1).map((r) => r[c] ?? '').filter((t) => t.trim());
    return body.length > 0 && body.every(isNumeric);
  });
}

// the value of a number of a table, e.g. -1200 for (1,200) or 0.12 for 12 %, or null for a text.
// a comma is read as a separator of thousands when it is followed by three digits
export function numberOf(text: string): number | null {
  const t = text.trim();
  if (!isNumeric(t)) return null;
  const negative = /^\(.*\)$/.test(t);
  let s = t.replace(/[()$€£¥\s]/g, '').replace(/−/g, '-');
  const scale = s.endsWith('%') ? 0.01 : s.endsWith('‰') ? 0.001 : 1;
  s = s.replace(/[%‰]$/, '');
  s = /,\d{3}(?!\d)/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  const n = Number(s) * scale;
  return Number.isFinite(n) ? (negative ? -Math.abs(n) : n) : null;
}

// the order of the rows of a sort by their keys, as Sort Ascending and Sort Descending of a column
// of Keynote: numbers by value before texts in the order of the language, and empty cells last in
// either direction. rows with equal keys keep their order
export function sortOrder(keys: string[], descending = false): number[] {
  const words = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const values = keys.map((k) => ({ text: k.trim(), number: numberOf(k) }));
  const rank = (v: { text: string; number: number | null }) => (v.number !== null ? 0 : v.text ? 1 : 2);
  return keys.map((_, i) => i).sort((i, j) => {
    const a = values[i];
    const b = values[j];
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (rank(a) === 2) return 0;
    const d = rank(a) === 0 ? a.number! - b.number! : words.compare(a.text, b.text);
    return descending ? -d : d;
  });
}

const escape = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// a cell with its text, set at the right in a column of numbers
export function cellHtml(tag: 'td' | 'th', text = '', right = false): string {
  return `<${tag}${right ? ' style="text-align: right"' : ''}>${escape(text).replace(/\n/g, '<br>')}</${tag}>`;
}

export function rowHtml(cells: { tag: 'td' | 'th'; text?: string; right?: boolean }[]): string {
  return `<tr>${cells.map((c) => cellHtml(c.tag, c.text, c.right)).join('')}</tr>`;
}

// the text of a table of rows of cells, with the first row as the header row, indented at base in
// the style of the deck, as the template of model/templates.ts writes an empty table
export function tableHtml(rows: string[][], style: TextStyle, base: string): string {
  const numeric = numericColumns(rows);
  const lines: [number, string][] = [
    [0, '<table>'],
    [1, '<tbody>'],
    ...rows.map((r, i): [number, string] => [2, rowHtml(r.map((text, c) => ({ tag: i ? 'td' : 'th', text, right: numeric[c] })))]),
    [1, '</tbody>'],
    [0, '</table>'],
  ];
  return lines.map(([depth, text], i) => (i ? base + style.step.repeat(depth) : '') + text).join(style.eol);
}

// the fill of count cells after the cells of a line, as Autofill of Keynote fills them: a line of
// numbers in a step goes on in that step, also with the same words before and after the numbers,
// e.g. Step 1 and Step 2, and any other line is repeated, each new cell a copy of a cell of line
export type Fill = { text: string } | { copy: number };
const SERIES = /^(\D*?)(-?\d+(?:\.\d+)?)(\D*)$/;

export function fillLine(line: string[], count: number): Fill[] {
  const parts = line.map((t) => SERIES.exec(t.trim()));
  const [p0, s0] = [parts[0]?.[1], parts[0]?.[3]];
  if (line.length >= 2 && parts.every((m) => m && m[1] === p0 && m[3] === s0)) {
    const values = parts.map((m) => Number(m![2]));
    const step = values[1] - values[0];
    const even = values.every((v, i) => !i || Math.abs(v - values[i - 1] - step) < 1e-9 * Math.max(1, Math.abs(step)));
    if (even && step !== 0) {
      const places = Math.max(...parts.map((m) => (m![2].split('.')[1] ?? '').length));
      return Array.from({ length: count }, (_, k) => {
        const v = (values[values.length - 1] + step * (k + 1)).toFixed(places);
        return { text: `${p0}${/^-0(\.0*)?$/.test(v) ? v.slice(1) : v}${s0}` };
      });
    }
  }
  return Array.from({ length: count }, (_, k) => ({ copy: k % line.length }));
}

// the cells of an empty table of a size, the header row included
export const emptyRows = (rows: number, columns: number): string[][] =>
  Array.from({ length: Math.max(1, rows) }, () => Array<string>(Math.max(1, columns)).fill(''));

// the letters of a column as Keynote shows them, A to Z and then AA
export function columnName(i: number): string {
  let n = i + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

// a cell of a grid with its first row and column, and the rows and the columns that it covers
export type Spot<T> = { cell: T; row: number; col: number; rows: number; span: number };
export type Grid<T> = { spots: Spot<T>[][]; grid: (Spot<T> | undefined)[][]; width: number };

// the cells of rows laid out as HTML lays out a table. a cell takes the first column of its row
// that a cell of a row above does not cover, and covers the columns of its colspan and the rows of
// its rowspan, where a rowspan of 0 or past the last row reaches the last row. grid[r][c] is the
// spot over row r and column c, or undefined at the end of a short row
export function layoutCells<T>(rows: T[][], size: (cell: T) => { rows: number; cols: number }): Grid<T> {
  const grid: (Spot<T> | undefined)[][] = rows.map(() => []);
  const spots = rows.map((cells, row) => {
    let col = 0;
    return cells.map((cell) => {
      while (grid[row][col]) col++;
      const s = size(cell);
      const left = rows.length - row;
      const spot = { cell, row, col, rows: s.rows > 0 ? Math.min(s.rows, left) : left, span: Math.max(1, s.cols) };
      for (let r = row; r < row + spot.rows; r++) for (let c = col; c < col + spot.span; c++) grid[r][c] = spot;
      col += spot.span;
      return spot;
    });
  });
  return { spots, grid, width: Math.max(0, ...grid.map((r) => r.length)) };
}

// a range of the cells of a grid, from row r0 and column c0 to row r1 and column c1
export type Box = { r0: number; c0: number; r1: number; c1: number };

export const boxOf = (s: Spot<unknown>): Box => ({ r0: s.row, c0: s.col, r1: s.row + s.rows - 1, c1: s.col + s.span - 1 });

// the smallest box around a and b
export const around = (a: Box, b: Box): Box => ({ r0: Math.min(a.r0, b.r0), c0: Math.min(a.c0, b.c0), r1: Math.max(a.r1, b.r1), c1: Math.max(a.c1, b.c1) });

// the box grown until each cell that it meets is inside it, as a merged cell is selected whole
export function grow<T>(g: Grid<T>, box: Box): Box {
  let out = box;
  for (let changed = true; changed;) {
    changed = false;
    for (const s of spotsIn(g, out)) {
      const next = around(out, boxOf(s));
      if (next.r0 !== out.r0 || next.c0 !== out.c0 || next.r1 !== out.r1 || next.c1 !== out.c1) {
        out = next;
        changed = true;
      }
    }
  }
  return out;
}

// the cells that a box meets, in the order of reading
export function spotsIn<T>(g: Grid<T>, box: Box): Spot<T>[] {
  const out = new Set<Spot<T>>();
  for (let r = box.r0; r <= box.r1; r++) for (let c = box.c0; c <= box.c1; c++) {
    const s = g.grid[r]?.[c];
    if (s) out.add(s);
  }
  return [...out].sort((a, b) => a.row - b.row || a.col - b.col);
}

// the grid of a table on the page
export type Place = Spot<HTMLTableCellElement>;
export const gridOf = (table: HTMLTableElement): Grid<HTMLTableCellElement> =>
  layoutCells([...table.rows].map((tr) => [...tr.cells]), (c) => ({ rows: c.rowSpan, cols: c.colSpan }));
export const placesOf = (table: HTMLTableElement): Place[][] => gridOf(table).spots;
export const columnsOf = (table: HTMLTableElement): number => gridOf(table).width;

export function placeOf(cell: HTMLTableCellElement): Place | null {
  const table = cell.closest('table');
  if (!table) return null;
  for (const r of placesOf(table)) for (const p of r) if (p.cell === cell) return p;
  return null;
}

// the cell over a row and a column, or null at the end of a short row
export const cellOver = (table: HTMLTableElement, row: number, col: number): HTMLTableCellElement | null =>
  gridOf(table).grid[row]?.[col]?.cell ?? null;

// the cell after or before cell in the order of reading, row by row
export function cellAfter(cell: HTMLTableCellElement, way: 1 | -1): HTMLTableCellElement | null {
  const table = cell.closest('table');
  if (!table) return null;
  const all = placesOf(table).flat().map((p) => p.cell);
  return all[all.indexOf(cell) + way] ?? null;
}

// the cell above or below cell in its first column, or the last cell of a shorter row
export function cellBeside(cell: HTMLTableCellElement, way: 1 | -1): HTMLTableCellElement | null {
  const p = placeOf(cell);
  const table = cell.closest('table');
  if (!p || !table) return null;
  const row = way > 0 ? p.row + p.rows : p.row - 1;
  const tr = table.rows[row];
  return tr ? cellOver(table, row, p.col) ?? tr.cells[tr.cells.length - 1] ?? null : null;
}

// whether the first row of a table is a header row, i.e. a row of th only
export function hasHeader(table: HTMLTableElement): boolean {
  const first = table.rows[0];
  return !!first && first.cells.length > 0 && [...first.cells].every((c) => c.localName === 'th');
}

// the columns of a table on the page that hold numbers, read from the text of its cells by read
export function numericOf(table: HTMLTableElement, read: (cell: Element) => string = (c) => c.textContent ?? ''): boolean[] {
  const width = columnsOf(table);
  const rows = placesOf(table).map((r) => {
    const out = Array<string>(width).fill('');
    for (const p of r) out[p.col] = read(p.cell);
    return out;
  });
  return numericColumns(rows);
}
