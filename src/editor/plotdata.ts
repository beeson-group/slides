// the data of a plot as sheets of cells, as Keynote's Chart Data Editor shows the data of a chart,
// read from the text of the JSON block of the plot in the format of REFERENCE.md. a tab is a sheet
// with a row per frame, which holds the values of the parameter, the times, and the positions and
// texts of the marks. the events of a mark are a sheet with a row per event, and the ranges of the
// axes are a sheet with a row per panel. each change is a splice of the text, hence the bytes of
// the cells that did not change are kept, and a text that parsePlot cannot read is refused. pure,
// without the DOM

import { parsePlot } from '../plot.ts';

// a JSON value with its range in the text
export type JNode =
  | { kind: 'number' | 'string' | 'literal'; start: number; end: number; value: unknown }
  | { kind: 'array'; start: number; end: number; items: JNode[] }
  | { kind: 'object'; start: number; end: number; entries: { key: string; value: JNode }[] };

export type Path = (string | number)[];

// a parse of JSON that keeps the range of each value. an error names the offset of the fault
export function parseJson(text: string): JNode {
  let i = 0;
  const fail = (what: string): never => {
    throw new Error(`${what} at offset ${i}`);
  };
  const space = () => {
    while (i < text.length && ' \t\r\n'.includes(text[i])) i++;
  };
  const string = (): JNode => {
    const start = i++;
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    if (i >= text.length) fail('the string is not closed');
    i++;
    return { kind: 'string', start, end: i, value: JSON.parse(text.slice(start, i)) as string };
  };
  const value = (): JNode => {
    space();
    const start = i;
    const c = text[i];
    if (c === '{') {
      i++;
      const entries: { key: string; value: JNode }[] = [];
      space();
      if (text[i] === '}') return { kind: 'object', start, end: ++i, entries };
      for (;;) {
        space();
        if (text[i] !== '"') fail('a key is expected');
        const key = (string() as { value: unknown }).value as string;
        space();
        if (text[i++] !== ':') fail('a colon is expected');
        entries.push({ key, value: value() });
        space();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === '}') return { kind: 'object', start, end: ++i, entries };
        fail('a comma or a closing brace is expected');
      }
    }
    if (c === '[') {
      i++;
      const items: JNode[] = [];
      space();
      if (text[i] === ']') return { kind: 'array', start, end: ++i, items };
      for (;;) {
        items.push(value());
        space();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === ']') return { kind: 'array', start, end: ++i, items };
        fail('a comma or a closing bracket is expected');
      }
    }
    if (c === '"') return string();
    const m = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i, i + 64));
    if (m) {
      i += m[0].length;
      return { kind: 'number', start, end: i, value: Number(m[0]) };
    }
    for (const [word, v] of [['true', true], ['false', false], ['null', null]] as const) {
      if (text.startsWith(word, i)) {
        i += word.length;
        return { kind: 'literal', start, end: i, value: v };
      }
    }
    return fail('a value is expected');
  };
  const root = value();
  space();
  if (i < text.length) fail('the text goes on after the value');
  return root;
}

export function nodeAt(root: JNode | null, path: Path): JNode | null {
  let n: JNode | null = root;
  for (const key of path) {
    if (!n) return null;
    if (typeof key === 'number') n = n.kind === 'array' ? (n.items[key] ?? null) : null;
    else n = n.kind === 'object' ? (n.entries.find((e) => e.key === key)?.value ?? null) : null;
  }
  return n;
}

// a cell of a sheet. text is the number as it is written in the block, or the string
export type Cell = { path: Path; kind: 'number' | 'text'; text: string };

// a sheet of the data editor, with a cell or null for each column of each row
export type Sheet = {
  key: string;
  name: string;
  // the tab shown on the plot while the sheet is edited, or null for the axes
  tab: number | null;
  columns: string[];
  rowNames: string[];
  rows: (Cell | null)[][];
  // the arrays with one item per row, which addRow and deleteRow change, or null for a sheet whose
  // rows are fixed
  arrays: Path[] | null;
  // the count of rows that deleteRow keeps
  least: number;
};

type JArray = Extract<JNode, { kind: 'array' }>;
const isObj = (n: JNode | null): n is Extract<JNode, { kind: 'object' }> => n?.kind === 'object';
const isArr = (n: JNode | null): n is JArray => n?.kind === 'array';
const get = (n: JNode | null, key: string) => nodeAt(n, [key]);

// the text of a label of the plot markup without its TeX, e.g. "$t$ (days)" as "t (days)"
export const plain = (markup: string): string =>
  markup.replace(/\$/g, '').replace(/\\(mathrm|text|mathcal)\{([^}]*)\}/g, '$2').replace(/\\/g, '').replace(/[{}]/g, '').trim();

function cellOf(text: string, n: JNode | null, path: Path): Cell | null {
  if (n?.kind === 'number') return { path, kind: 'number', text: text.slice(n.start, n.end) };
  if (n?.kind === 'string') return { path, kind: 'text', text: n.value as string };
  return null;
}

// the sheets of the text of a block. a text that parsePlot cannot read throws its error
export function sheetsOf(text: string): Sheet[] {
  const root = parseJson(text);
  const plot = parsePlot(JSON.parse(text));
  const sheets: Sheet[] = [];
  const kinds = new Map(plot.marks.map((m) => [m.id, m.kind]));
  const valueName = plain(plot.parameter.label) || 'Value';
  plot.tabs.forEach((tab, t) => {
    const base: Path = ['tabs', t];
    const tabNode = nodeAt(root, base);
    const n = tab.values.length;
    const columns: string[] = [];
    const getters: ((r: number) => Cell | null)[] = [];
    const arrays: Path[] = [];
    const add = (name: string, cell: (r: number) => Cell | null) => {
      columns.push(name);
      getters.push(cell);
    };
    // a column of a list with an item per frame. a list of one item is a mark that does not move,
    // shown in the first row only
    const column = (name: string, list: JNode | null, path: Path, key: Path) => {
      if (!isArr(list)) return;
      const still = list.items.length !== n;
      add(still ? `${name} (all)` : name, (r) => (still && r > 0 ? null : cellOf(text, nodeAt(list, [still ? 0 : r, ...key]), [...path, still ? 0 : r, ...key])));
    };
    const perFrame = (list: JNode | null, path: Path) => {
      if (isArr(list) && list.items.length === n && !arrays.some((p) => p.join() === path.join())) arrays.push(path);
    };
    column(valueName, get(tabNode, 'values'), [...base, 'values'], []);
    perFrame(get(tabNode, 'values'), [...base, 'values']);
    if (tab.times) {
      column('Time (s)', get(tabNode, 'times'), [...base, 'times'], []);
      perFrame(get(tabNode, 'times'), [...base, 'times']);
    }
    perFrame(get(tabNode, 'active'), [...base, 'active']);
    const data = get(tabNode, 'data');
    const events: { id: string; path: Path }[] = [];
    for (const { key: id, value: v } of isObj(data) ? data.entries : []) {
      const at: Path = [...base, 'data', id];
      const kind = kinds.get(id);
      if (kind === 'points' && isArr(v)) {
        perFrame(v, at);
        const width = Math.max(0, ...v.items.map((x) => (isArr(x) ? x.items.length : 0)));
        for (let k = 0; k < width; k++) {
          const axis = k % 2 ? 'y' : 'x';
          column(width > 2 ? `${id} ${axis}${Math.floor(k / 2) + 1}` : `${id} ${axis}`, v, at, [k]);
        }
      } else if (kind === 'trace') {
        const list = isObj(v) ? get(v, 'points') : v;
        const path = isObj(v) ? [...at, 'points'] : at;
        perFrame(list, path);
        column(`${id} x`, list, path, [0]);
        column(`${id} y`, list, path, [1]);
      } else if (kind === 'label' && isObj(v)) {
        const where = get(v, 'at');
        if (isArr(where) && isArr(where.items[0] ?? null)) {
          perFrame(where, [...at, 'at']);
          column(`${id} x`, where, [...at, 'at'], [0]);
          column(`${id} y`, where, [...at, 'at'], [1]);
        } else {
          add(`${id} x (all)`, (r) => (r > 0 ? null : cellOf(text, nodeAt(where, [0]), [...at, 'at', 0])));
          add(`${id} y (all)`, (r) => (r > 0 ? null : cellOf(text, nodeAt(where, [1]), [...at, 'at', 1])));
        }
        const said = get(v, 'text');
        if (isArr(said)) {
          perFrame(said, [...at, 'text']);
          column(`${id} text`, said, [...at, 'text'], []);
        } else {
          add(`${id} text (all)`, (r) => (r > 0 ? null : cellOf(text, said, [...at, 'text'])));
        }
      } else if (kind === 'events') {
        events.push({ id, path: at });
      }
    }
    const name = plain(tab.label) || tab.name;
    sheets.push({
      key: `tab:${tab.name}`,
      name,
      tab: t,
      columns,
      rowNames: Array.from({ length: n }, (_, r) => String(r + 1)),
      rows: Array.from({ length: n }, (_, r) => getters.map((g) => g(r))),
      arrays,
      least: 1,
    });
    for (const e of events) {
      const list = nodeAt(root, e.path);
      const count = isArr(list) ? list.items.length : 0;
      const cell = (r: number, key: Path) => cellOf(text, nodeAt(list, [r, ...key]), [...e.path, r, ...key]);
      sheets.push({
        key: `events:${tab.name}:${e.id}`,
        name: `${name}: ${e.id}`,
        tab: t,
        columns: ['Frame', 'x', 'y', 'Text'],
        rowNames: Array.from({ length: count }, (_, r) => String(r + 1)),
        rows: Array.from({ length: count }, (_, r) => [cell(r, ['frame']), cell(r, ['at', 0]), cell(r, ['at', 1]), cell(r, ['text'])]),
        arrays: [e.path],
        least: 0,
      });
    }
  });
  const panels = get(root, 'panels');
  if (isArr(panels)) {
    const cell = (r: number, key: Path) => cellOf(text, nodeAt(panels, [r, ...key]), ['panels', r, ...key]);
    sheets.push({
      key: 'axes',
      name: 'Axes',
      tab: null,
      columns: ['x from', 'x to', 'y from', 'y to'],
      rowNames: plot.panels.map((p) => p.id),
      rows: plot.panels.map((_, r) => [cell(r, ['x', 'range', 0]), cell(r, ['x', 'range', 1]), cell(r, ['y', 'range', 0]), cell(r, ['y', 'range', 1])]),
      arrays: null,
      least: 0,
    });
  }
  return sheets;
}

// the range from start to end of the text replaced by text
type Splice = { start: number; end: number; text: string };

function apply(text: string, splices: Splice[]): string {
  let out = text;
  for (const s of [...splices].sort((a, b) => b.start - a.start)) out = out.slice(0, s.start) + s.text + out.slice(s.end);
  return out;
}

// the fault of a text that is not JSON or not a plot, or null for a text that parsePlot reads
export function check(text: string): string | null {
  try {
    parseJson(text);
    parsePlot(JSON.parse(text));
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const LOOSE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

// the JSON text of what was typed into a cell, or null for a number that cannot be read. a number
// is written as typed when it is JSON, and else in its shortest form, e.g. .5 as 0.5
export function literal(cell: Cell, typed: string): string | null {
  if (cell.kind === 'text') return JSON.stringify(typed);
  const t = typed.trim().replace(/^−/, '-');
  if (NUMBER.test(t)) return t;
  if (LOOSE.test(t) && Number.isFinite(Number(t))) return String(Number(t));
  return null;
}

export type Result = { text: string; error: null } | { text: null; error: string };

const checked = (text: string): Result => {
  const error = check(text);
  return error ? { text: null, error } : { text, error: null };
};

// the text with the value of cell replaced by what was typed
export function setCell(text: string, cell: Cell, typed: string): Result {
  const lit = literal(cell, typed);
  if (lit === null) return { text: null, error: `${typed.trim() || 'an empty cell'} is not a number` };
  const n = nodeAt(parseJson(text), cell.path);
  if (!n) return { text: null, error: 'the cell is not in the block' };
  return checked(apply(text, [{ start: n.start, end: n.end, text: lit }]));
}

const shortest = (x: number) => String(Number(x.toPrecision(12)));

// the text with a row added after the row r of sheet. each array of the sheet gets a copy of its
// item r with the separator of its items. a value or a time is put midway to the next one, or one
// step past the last one, hence the times still increase
export function addRow(text: string, sheet: Sheet, r: number): Result {
  if (!sheet.arrays) return { text: null, error: `rows are not added to the sheet ${sheet.name}` };
  const root = parseJson(text);
  const splices: Splice[] = [];
  for (const path of sheet.arrays) {
    const list = nodeAt(root, path);
    if (!isArr(list)) continue;
    const items = list.items;
    if (!items.length) {
      // an empty list of events
      splices.push({ start: list.start + 1, end: list.end - 1, text: '{ "frame": 0, "at": [0, 0], "text": "" }' });
      continue;
    }
    const at = Math.min(Math.max(r, 0), items.length - 1);
    const item = items[at];
    let copy = text.slice(item.start, item.end);
    const key = path.at(-1);
    if ((key === 'values' || key === 'times') && item.kind === 'number') {
      const v = item.value as number;
      const next = items[at + 1];
      const prev = items[at - 1];
      const step = next?.kind === 'number' ? ((next.value as number) - v) / 2 : prev?.kind === 'number' ? v - (prev.value as number) : 1;
      copy = shortest(v + step);
    }
    const k = at + 1 < items.length ? at : at - 1;
    const sep = items.length > 1 ? text.slice(items[k].end, items[k + 1].start) : ', ';
    splices.push({ start: item.end, end: item.end, text: sep + copy });
  }
  return checked(apply(text, splices));
}

// the text with the row r of sheet taken out of each of its arrays, with one separator. the ghost
// of a trace, i.e. the frame of its faint line, is moved back when it is past the last frame
export function deleteRow(text: string, sheet: Sheet, r: number): Result {
  if (!sheet.arrays) return { text: null, error: `rows are not deleted from the sheet ${sheet.name}` };
  if (sheet.rows.length <= sheet.least) return { text: null, error: `the sheet ${sheet.name} must keep at least one row` };
  const root = parseJson(text);
  const splices: Splice[] = [];
  for (const path of sheet.arrays) {
    const list = nodeAt(root, path);
    if (!isArr(list) || r >= list.items.length) continue;
    const items = list.items;
    if (items.length === 1) splices.push({ start: items[0].start, end: items[0].end, text: '' });
    else if (r < items.length - 1) splices.push({ start: items[r].start, end: items[r + 1].start, text: '' });
    else splices.push({ start: items[r - 1].end, end: items[r].end, text: '' });
    if (path.at(-1) === 'points') {
      const ghost = nodeAt(root, [...path.slice(0, -1), 'ghost']);
      if (ghost?.kind === 'number' && (ghost.value as number) > items.length - 2) splices.push({ start: ghost.start, end: ghost.end, text: String(items.length - 2) });
    }
  }
  return checked(apply(text, splices));
}
