// the model of a table of the slides, as the editor writes it: a table with an explicit tbody, one
// row per line, a first row of th as the header row, and the cells of a column of numbers set at
// the right with the declaration text-align, the one style of a cell that the scope rule allows.
// the text of a new table is built here from a size or from the cells of a paste. a paste is
// either tab-separated text, as a spreadsheet or a table of Keynote or PowerPoint is put on the
// clipboard, or an HTML table. the rows and columns of a table on the page are read with colspan
// counted. the functions without a page are tested under node

import type { TextStyle } from './model/templates.ts';

// the largest size of the grid of the Insert Table popover, in rows and in columns
export const GRID = 8;

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

// the columns of rows that hold numbers, i.e. every cell below the header row that is not empty is
// a number, and at least one is
export function numericColumns(rows: string[][]): boolean[] {
  const width = rows[0]?.length ?? 0;
  return Array.from({ length: width }, (_, c) => {
    const body = rows.slice(1).map((r) => r[c] ?? '').filter((t) => t.trim());
    return body.length > 0 && body.every(isNumeric);
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

// a cell of a table on the page, with its row and its first column, counted with colspan. a cell
// of rowspan is counted in its own row only, since the editor does not write one
export type Place = { cell: HTMLTableCellElement; row: number; col: number; span: number };

export function placesOf(table: HTMLTableElement): Place[][] {
  return [...table.rows].map((tr, row) => {
    let col = 0;
    return [...tr.cells].map((cell) => {
      const p = { cell, row, col, span: Math.max(1, cell.colSpan) };
      col += p.span;
      return p;
    });
  });
}

export function columnsOf(table: HTMLTableElement): number {
  return Math.max(0, ...placesOf(table).map((r) => r.reduce((n, p) => n + p.span, 0)));
}

export function placeOf(cell: HTMLTableCellElement): Place | null {
  const table = cell.closest('table');
  if (!table) return null;
  for (const r of placesOf(table)) for (const p of r) if (p.cell === cell) return p;
  return null;
}

// the cell of a row over the column col, or null past the end of the row
export function cellAtColumn(tr: HTMLTableRowElement, col: number): HTMLTableCellElement | null {
  let at = 0;
  for (const cell of tr.cells) {
    const span = Math.max(1, cell.colSpan);
    if (col < at + span) return cell;
    at += span;
  }
  return null;
}

// the cell after or before cell in the order of reading, row by row
export function cellAfter(cell: HTMLTableCellElement, way: 1 | -1): HTMLTableCellElement | null {
  const table = cell.closest('table');
  if (!table) return null;
  const all = placesOf(table).flat().map((p) => p.cell);
  return all[all.indexOf(cell) + way] ?? null;
}

// the cell above or below cell in the same column, or the last cell of a shorter row
export function cellBeside(cell: HTMLTableCellElement, way: 1 | -1): HTMLTableCellElement | null {
  const p = placeOf(cell);
  const table = cell.closest('table');
  if (!p || !table) return null;
  const tr = table.rows[p.row + way];
  return tr ? cellAtColumn(tr, p.col) ?? tr.cells[tr.cells.length - 1] ?? null : null;
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
