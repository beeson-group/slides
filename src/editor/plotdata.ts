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
  | { kind: 'object'; start: number; end: number; entries: { key: string; at: number; value: JNode }[] };

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
      const entries: { key: string; at: number; value: JNode }[] = [];
      space();
      if (text[i] === '}') return { kind: 'object', start, end: ++i, entries };
      for (;;) {
        space();
        if (text[i] !== '"') fail('a key is expected');
        const at = i;
        const key = (string() as { value: unknown }).value as string;
        space();
        if (text[i++] !== ':') fail('a colon is expected');
        entries.push({ key, at, value: value() });
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
  // the id of the mark of each column, i.e. its series, or null for the values and the times
  series: (string | null)[];
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
    const series: (string | null)[] = [];
    const getters: ((r: number) => Cell | null)[] = [];
    const arrays: Path[] = [];
    let mark: string | null = null;
    const add = (name: string, cell: (r: number) => Cell | null) => {
      columns.push(name);
      series.push(mark);
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
      mark = id;
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
      series,
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
        series: [null, null, null, null],
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
      series: [null, null, null, null],
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

// the items of a list, or the entries of an object from their keys, as ranges of the text
function partsOf(n: JNode): { start: number; end: number }[] {
  if (n.kind === 'array') return n.items.map((x) => ({ start: x.start, end: x.end }));
  if (n.kind === 'object') return n.entries.map((e) => ({ start: e.at, end: e.value.end }));
  return [];
}

// the splice that puts piece after the part i of a list or an object, or at its end for i = -1,
// with the separator of its parts
function insertAt(text: string, n: JNode, i: number, piece: string): Splice {
  const parts = partsOf(n);
  if (!parts.length) return { start: n.start + 1, end: n.end - 1, text: piece };
  const at = i < 0 || i >= parts.length ? parts.length - 1 : i;
  const k = at + 1 < parts.length ? at : at - 1;
  const sep = parts.length > 1 ? text.slice(parts[k].end, parts[k + 1].start) : ', ';
  return { start: parts[at].end, end: parts[at].end, text: sep + piece };
}

// the splice that takes the part i of a list or an object out with one separator
function cutAt(n: JNode, i: number): Splice {
  const parts = partsOf(n);
  if (parts.length === 1) return { start: parts[0].start, end: parts[0].end, text: '' };
  if (i < parts.length - 1) return { start: parts[i].start, end: parts[i + 1].start, text: '' };
  return { start: parts[i - 1].end, end: parts[i].end, text: '' };
}

// the splice that puts the part from of a list or an object before the part to, or after it with
// after, while the separators keep their places
function moveAt(text: string, n: JNode, from: number, to: number, after: boolean): Splice | null {
  const parts = partsOf(n);
  if (from === to || !parts[from] || !parts[to]) return null;
  const pieces = parts.map((p) => text.slice(p.start, p.end));
  const [moved] = pieces.splice(from, 1);
  const at = to - (from < to ? 1 : 0) + (after ? 1 : 0);
  pieces.splice(at, 0, moved);
  const out = pieces.map((p, i) => (i ? text.slice(parts[i - 1].end, parts[i].start) : '') + p).join('');
  return { start: parts[0].start, end: parts.at(-1)!.end, text: out };
}

const keyIndex = (n: JNode | null, key: string) => (isObj(n) ? n.entries.findIndex((e) => e.key === key) : -1);
const markIndex = (marks: JNode | null, id: string) => (isArr(marks) ? marks.items.findIndex((m) => nodeAt(m, ['id'])?.kind === 'string' && (nodeAt(m, ['id']) as { value: unknown }).value === id) : -1);

// the text with the value of key in the object at path set to the JSON text lit, the entry added
// at the end of the object when it is not there, and taken out for null
export function setKey(text: string, path: Path, key: string, lit: string | null): Result {
  const root = parseJson(text);
  const obj = nodeAt(root, path);
  if (!isObj(obj)) return { text: null, error: `${path.join('.') || 'the plot'} is not an object` };
  const i = keyIndex(obj, key);
  if (i >= 0) {
    if (lit === null) return checked(apply(text, [cutAt(obj, i)]));
    const v = obj.entries[i].value;
    return checked(apply(text, [{ start: v.start, end: v.end, text: lit }]));
  }
  if (lit === null) return { text, error: null };
  return checked(apply(text, [insertAt(text, obj, -1, `${JSON.stringify(key)}: ${lit}`)]));
}

// a name for a new mark or tab, the first of stem-1, stem-2, and so on that the text does not hold
const fresh = (text: string, stem: string) => {
  let k = 1;
  while (text.includes(`"${stem}-${k}"`)) k++;
  return `${stem}-${k}`;
};

// the text with a new series after the series of the column c of the sheet of a tab, or at the end,
// i.e. a trace in the panel of that series whose points cross its panel on the diagonal in each
// tab, as a column of Keynote's Chart Data Editor is added with values to replace. its id is new
export function addSeries(text: string, sheet: Sheet, c: number): Result & { id?: string } {
  if (sheet.tab === null || !sheet.key.startsWith('tab:')) return { text: null, error: `series are not added to the sheet ${sheet.name}` };
  const root = parseJson(text);
  const plot = parsePlot(JSON.parse(text));
  const after = sheet.series[c] ?? sheet.series.filter(Boolean).at(-1) ?? null;
  const panel = plot.panels.find((p) => p.id === plot.marks.find((m) => m.id === after)?.panel) ?? plot.panels[0];
  const id = fresh(text, 'series');
  const marks = nodeAt(root, ['marks']);
  const splices: Splice[] = [];
  const mark = `{ "id": "${id}", "panel": "${panel.id}", "kind": "trace" }`;
  if (isArr(marks)) splices.push(insertAt(text, marks, after ? markIndex(marks, after) : -1, mark));
  else splices.push(insertAt(text, root, -1, `"marks": [${mark}]`));
  const [x0, x1] = panel.x.range, [y0, y1] = panel.y.range;
  plot.tabs.forEach((tab, t) => {
    const n = tab.values.length;
    const at = (r: number, a: number, b: number) => shortest(a + ((b - a) * r) / Math.max(1, n - 1));
    const points = `[${Array.from({ length: n }, (_, r) => `[${at(r, x0, x1)}, ${at(r, y0, y1)}]`).join(', ')}]`;
    const data = nodeAt(root, ['tabs', t, 'data']);
    if (isObj(data)) splices.push(insertAt(text, data, after ? keyIndex(data, after) : -1, `"${id}": ${points}`));
    else splices.push(insertAt(text, nodeAt(root, ['tabs', t])!, -1, `"data": { "${id}": ${points} }`));
  });
  const res = checked(apply(text, splices));
  return res.error === null ? { ...res, id } : res;
}

// the text with the mark id taken out of the marks and out of the data of each tab
export function deleteSeries(text: string, id: string): Result {
  const root = parseJson(text);
  const marks = nodeAt(root, ['marks']);
  const i = markIndex(marks, id);
  if (!marks || i < 0) return { text: null, error: `the series ${id} is not a mark of the plot` };
  const splices = [cutAt(marks, i)];
  const tabs = nodeAt(root, ['tabs']);
  for (const tab of isArr(tabs) ? tabs.items : []) {
    const data = nodeAt(tab, ['data']);
    const k = keyIndex(data, id);
    if (data && k >= 0) splices.push(cutAt(data, k));
  }
  return checked(apply(text, splices));
}

// the text with the series id put before the series to, or after it with after, in the marks and in
// the data of each tab, hence its columns are moved in the sheet of each tab
export function moveSeries(text: string, id: string, to: string, after: boolean): Result {
  const root = parseJson(text);
  const marks = nodeAt(root, ['marks']);
  const splices: Splice[] = [];
  const m = marks && moveAt(text, marks, markIndex(marks, id), markIndex(marks, to), after);
  if (m) splices.push(m);
  const tabs = nodeAt(root, ['tabs']);
  for (const tab of isArr(tabs) ? tabs.items : []) {
    const data = nodeAt(tab, ['data']);
    const d = data && moveAt(text, data, keyIndex(data, id), keyIndex(data, to), after);
    if (d) splices.push(d);
  }
  if (!splices.length) return { text, error: null };
  return checked(apply(text, splices));
}

// the text with a copy of the tab t after it, under a new name, which is also its label when it has
// one. the name is returned with the text
export function addTab(text: string, t: number): Result & { name?: string } {
  const root = parseJson(text);
  const tabs = nodeAt(root, ['tabs']);
  const tab = nodeAt(tabs, [t]);
  if (!isArr(tabs) || !isObj(tab)) return { text: null, error: 'the plot does not have this tab' };
  const old = nodeAt(tab, ['name']);
  const name = fresh(text, old?.kind === 'string' ? String(old.value) : 'tab');
  const renames: Splice[] = [];
  for (const key of ['name', 'label']) {
    const n = nodeAt(tab, [key]);
    if (n?.kind === 'string') renames.push({ start: n.start - tab.start, end: n.end - tab.start, text: JSON.stringify(name) });
  }
  const copy = apply(text.slice(tab.start, tab.end), renames);
  const res = checked(apply(text, [insertAt(text, tabs, t, copy)]));
  return res.error === null ? { ...res, name } : res;
}

export function deleteTab(text: string, t: number): Result {
  const tabs = nodeAt(parseJson(text), ['tabs']);
  if (!isArr(tabs) || !tabs.items[t]) return { text: null, error: 'the plot does not have this tab' };
  if (tabs.items.length < 2) return { text: null, error: 'a plot keeps at least one tab' };
  return checked(apply(text, [cutAt(tabs, t)]));
}

// the text with each cell of edits set to what was typed, checked once all are set, hence e.g. the
// times of a pasted column may pass through an order that does not increase
export function setCells(text: string, edits: { cell: Cell; typed: string }[]): Result {
  const root = parseJson(text);
  const splices: Splice[] = [];
  for (const { cell, typed } of edits) {
    const lit = literal(cell, typed);
    if (lit === null) return { text: null, error: `${typed.trim() || 'an empty cell'} is not a number` };
    const n = nodeAt(root, cell.path);
    if (!n) return { text: null, error: 'the cell is not in the block' };
    if (text.slice(n.start, n.end) !== lit) splices.push({ start: n.start, end: n.end, text: lit });
  }
  return checked(apply(text, splices));
}

// the cells of a range of a sheet from row r0 and column c0 to row r1 and column c1, by row
export const cellsIn = (sheet: Sheet, r0: number, c0: number, r1: number, c1: number): (Cell | null)[][] =>
  sheet.rows.slice(Math.min(r0, r1), Math.max(r0, r1) + 1).map((row) => row.slice(Math.min(c0, c1), Math.max(c0, c1) + 1));

// a range copied from a spreadsheet as rows of cells, i.e. text with tabs between the cells and a
// line per row
export function parseTsv(clip: string): string[][] {
  const lines = clip.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 1 && lines.at(-1) === '') lines.pop();
  return lines.map((l) => l.split('\t'));
}

// the text with the cells of rows pasted from row r and column c of the sheet of key. a sheet of
// a tab gets the rows and the series that the range needs, as the data editors of Keynote and
// PowerPoint grow with a pasted range, and the cells outside a fixed sheet are left out
export function pasteCells(text: string, key: string, r: number, c: number, rows: string[][]): Result {
  const sheetOf = (t: string) => sheetsOf(t).find((s) => s.key === key) ?? null;
  let out = text;
  let sheet = sheetOf(out);
  if (!sheet) return { text: null, error: 'the sheet is not in the block' };
  const height = r + rows.length, width = c + Math.max(...rows.map((row) => row.length));
  while (sheet.arrays && sheet.rows.length < height) {
    const res = addRow(out, sheet, sheet.rows.length - 1);
    if (res.error !== null) return res;
    out = res.text;
    sheet = sheetOf(out)!;
  }
  while (sheet.key.startsWith('tab:') && sheet.columns.length < width) {
    const res = addSeries(out, sheet, sheet.columns.length - 1);
    if (res.error !== null) return res;
    out = res.text;
    sheet = sheetOf(out)!;
  }
  const edits: { cell: Cell; typed: string }[] = [];
  rows.forEach((row, i) => row.forEach((typed, j) => {
    const cell = sheet!.rows[r + i]?.[c + j];
    if (cell) edits.push({ cell, typed });
  }));
  return setCells(out, edits);
}

// the text with the texts of a range made empty. parsePlot of plot.ts refuses null and a frame
// without its point, hence a number cell is not cleared, and it is returned in kept
export function clearCells(text: string, cells: (Cell | null)[][]): Result & { kept: Cell[] } {
  const all = cells.flat().filter((x): x is Cell => !!x);
  const res = setCells(text, all.filter((c) => c.kind === 'text').map((cell) => ({ cell, typed: '' })));
  return { ...res, kept: all.filter((c) => c.kind === 'number') };
}
