// the start tag of an element with a TagEdit applied, i.e. with target values for some of its
// attributes, classes, and declarations of its style. the fields fragment, index, and translate
// are the step at which the element is shown and the offset it was dragged by, kept as fields of
// their own since the Steps pane and the moves of the editor read them. every other byte of the
// tag is copied from the file. an attribute that is not changed keeps its bytes, and so does each
// class and each declaration of a changed attribute that is not changed itself

import { REFERENCE_IN_ATTR, decodeAttr, type Attr, type Range } from './tokens.ts';

export type Translate = { x: number; y: number };
// each field is a target value, and a field or a key left undefined is not changed. in attrs and
// style, null removes the attribute or the declaration, and in classes, false removes the class.
// an empty string in attrs is written as an attribute without a value, e.g. muted. the fields
// fragment, index, and translate take precedence over the class fragment, the attribute
// data-fragment-index, and the declaration translate of the maps. order gives the names of the
// attributes, the classes, and the declarations of a tag in their order, e.g. those of the tag
// before an edit that is undone. those of the file that it names are written in this order, e.g.
// after an undo across a save, and a new one is written before the first one that follows it
// there, else at the end
export type TagEdit = {
  attrs?: Record<string, string | null>;
  classes?: Record<string, boolean>;
  style?: Record<string, string | null>;
  fragment?: boolean;
  index?: number | null;
  translate?: Translate | null;
  order?: { attrs?: string[]; classes?: string[]; style?: string[] };
};
export type Step = { fragment: boolean; index: number | null };

// a part of a written value: raw bytes kept from the file, or new text to escape
type Part = { text: string; raw: boolean };

// the index in list at which an item named name is put, by its place in order
function placeOf<T>(order: string[] | undefined, list: T[], name: string, nameOf: (t: T) => string): number {
  const i = order ? order.indexOf(name) : -1;
  if (i < 0) return list.length;
  const j = list.findIndex((t) => order!.indexOf(nameOf(t)) > i);
  return j < 0 ? list.length : j;
}

// list with the items named in order sorted by it, and the others in their places. a name that is
// in list twice is sorted by its first item
function reorder<T>(list: T[], order: string[] | undefined, nameOf: (t: T) => string): T[] {
  if (!order) return list;
  const sorts = (t: T) => order.includes(nameOf(t)) && list.find((u) => nameOf(u) === nameOf(t)) === t;
  const sorted = list.filter(sorts).sort((a, b) => order.indexOf(nameOf(a)) - order.indexOf(nameOf(b)));
  let k = 0;
  return list.map((t) => (sorts(t) ? sorted[k++] : t));
}

const isSpace = (c: string | undefined) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
const attr = (attrs: Attr[], name: string): Attr | null => attrs.find((a) => a.name === name) ?? null;
const px = (n: number) => `${Math.round(n)}px`;
// a declaration value compared with white space collapsed
const norm = (value: string) => value.trim().replace(/\s+/g, ' ');

// the classes of a class value, each with its raw bytes
const splitClasses = (raw: string | null | undefined): { raw: string; name: string }[] =>
  (raw ?? '').split(/[ \t\n\r\f]+/).filter(Boolean).map((r) => ({ raw: r, name: decodeAttr(r) }));
const rawClasses = (attrs: Attr[]) => splitClasses(attr(attrs, 'class')?.value);

// the declarations of a style value, each with its raw bytes, its property in lowercase, and its
// value. a semicolon that ends a character reference does not end a declaration
function rawDeclarations(value: string | null | undefined): { raw: string; name: string; value: string }[] {
  const raw = value ?? '';
  const out: string[] = [];
  let start = 0;
  for (const m of raw.matchAll(new RegExp(`${REFERENCE_IN_ATTR.source}|;`, 'g'))) {
    if (m[0] !== ';') continue;
    out.push(raw.slice(start, m.index));
    start = (m.index as number) + 1;
  }
  out.push(raw.slice(start));
  return out
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const decoded = decodeAttr(d);
      const colon = decoded.indexOf(':');
      return { raw: d, name: (colon < 0 ? decoded : decoded.slice(0, colon)).trim().toLowerCase(), value: colon < 0 ? '' : norm(decoded.slice(colon + 1)) };
    });
}

export const classesIn = (attrs: Attr[]): string[] => rawClasses(attrs).map((c) => c.name);

// the step of an element as the file gives it
export function stepIn(attrs: Attr[]): Step {
  const value = attr(attrs, 'data-fragment-index')?.value;
  const index = value === undefined || value === null || !/^\s*-?\d+\s*$/.test(value) ? null : Number(value);
  return { fragment: classesIn(attrs).includes('fragment'), index };
}

// the translation in a style, e.g. "translate: 40px -20px", in px
export function translateIn(style: string | null | undefined): Translate | null {
  const m = (style ?? '').match(/(?:^|;)\s*translate\s*:\s*(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?\s*(?:;|$)/);
  return m ? { x: Number(m[1]), y: Number(m[2] ?? 0) } : null;
}

export const translateText = (t: Translate): string => `${px(t.x)} ${px(t.y)}`;

// edit b laid over edit a, as two edits of the same element made one after the other. a whole
// class, style, or data-fragment-index of b replaces the classes, the declarations, or the index
// that a sets, and a declaration translate of b replaces the field translate of a, since those of
// a would otherwise be laid over it
export function mergeEdit(a: TagEdit | undefined, b: TagEdit): TagEdit {
  const whole = b.attrs ?? {};
  const before: TagEdit = { ...a };
  if ('class' in whole) {
    delete before.classes;
    delete before.fragment;
  }
  if ('style' in whole) {
    delete before.style;
    delete before.translate;
  }
  if ('data-fragment-index' in whole) delete before.index;
  if (b.style && 'translate' in b.style) delete before.translate;
  const out: TagEdit = { ...before, ...b };
  if (before.attrs || b.attrs) out.attrs = { ...before.attrs, ...b.attrs };
  if (before.classes || b.classes) out.classes = { ...before.classes, ...b.classes };
  if (before.style || b.style) out.style = { ...before.style, ...b.style };
  return out;
}

// the start tag of the file read as the classes, the attributes, and the declarations of the style
// that it has after edit, all decoded. it is the state that an undo of a tag edit records
export type TagState = { classes: string[]; attrs: Record<string, string>; style: Record<string, string> };

export function stateOf(attrs: Attr[], edit: TagEdit = {}): TagState {
  const l = layout(attrs, edit);
  const out: TagState = { classes: l.classes.map((c) => c.name), attrs: {}, style: {} };
  for (const d of l.style) out.style[d.name] = d.value;
  for (const name of l.names) {
    if (name === 'class') {
      if (out.classes.length) out.attrs.class = out.classes.join(' ');
    } else if (name === 'style') {
      const decls = Object.entries(out.style);
      if (decls.length) out.attrs.style = decls.map(([k, v]) => `${k}: ${v}`).join('; ');
    } else {
      const parts = l.changes.get(name);
      const a = attr(attrs, name);
      out.attrs[name] = parts ? parts.map((p) => (p.raw ? decodeAttr(p.text) : p.text)).join('') : a?.value ? decodeAttr(a.value) : '';
    }
  }
  return out;
}

// the classes and the declarations of edit, with the fields fragment and translate in them
function classesOf(edit: TagEdit): Record<string, boolean> {
  return edit.fragment === undefined ? { ...edit.classes } : { ...edit.classes, fragment: edit.fragment };
}
function styleOf(edit: TagEdit): Record<string, string | null> {
  if (edit.translate === undefined) return { ...edit.style };
  return { ...edit.style, translate: edit.translate === null ? null : translateText(edit.translate) };
}

const join = (parts: Part[][], by: string): Part[] => parts.flatMap((p, i) => (i ? [{ text: by, raw: true }, ...p] : p));

type Cls = { raw: string; name: string; fresh: boolean };
type Decl = { raw: string; name: string; value: string; fresh: boolean };
// an attribute of the start tag after an edit: one of the file, with its new value or undefined
// when it is not changed, or a new one, without attr. an attribute that does not stay is moved, or
// put in if it is new, before the next one that stays
type Item = { name: string; attr: Attr | null; value: Part[] | undefined; stays: boolean };
// the start tag after an edit. changes holds the value of each attribute that changes as parts, or
// null for an attribute to remove. classes and style are the classes and the declarations after
// the edit, items the attributes in the order in which renderTag writes them, and names their names
type Layout = { changes: Map<string, Part[] | null>; classes: Cls[]; style: Decl[]; items: Item[]; names: string[] };

function layout(attrs: Attr[], edit: TagEdit): Layout {
  const changes = new Map<string, Part[] | null>();
  const whole = edit.attrs ?? {};

  const classMap = classesOf(edit);
  const classesBefore = rawClasses(attrs);
  let classes: Cls[] = 'class' in whole ? splitClasses(whole.class).map((c) => ({ ...c, fresh: true })) : classesBefore.map((c) => ({ ...c, fresh: false }));
  for (const [name, on] of Object.entries(classMap)) {
    const has = classes.some((c) => c.name === name);
    if (on && !has) classes.splice(placeOf(edit.order?.classes, classes, name, (c) => c.name), 0, { raw: name, name, fresh: true });
    if (!on && has) classes = classes.filter((c) => c.name !== name);
  }
  classes = reorder(classes, edit.order?.classes, (c) => c.name);
  if ('class' in whole || Object.keys(classMap).length || edit.order?.classes) {
    const same = classes.length === classesBefore.length && classes.every((c, i) => c.name === classesBefore[i].name);
    if (!same) changes.set('class', classes.length ? join(classes.map((c) => [{ text: c.fresh ? c.name : c.raw, raw: !c.fresh }]), ' ') : null);
  }

  if (edit.index !== undefined) {
    const current = stepIn(attrs).index;
    if (edit.index !== current) changes.set('data-fragment-index', edit.index === null ? null : [{ text: String(edit.index), raw: false }]);
  }

  const styleMap = { ...edit.style };
  const styleBefore = rawDeclarations(attr(attrs, 'style')?.value);
  let style: Decl[] = 'style' in whole ? rawDeclarations(whole.style).map((d) => ({ ...d, fresh: true })) : styleBefore.map((d) => ({ ...d, fresh: false }));
  for (const [name, value] of Object.entries(styleMap)) {
    const at = style.findIndex((d) => d.name === name);
    if (value === null) {
      if (at >= 0) style = style.filter((d) => d.name !== name);
      continue;
    }
    if (at >= 0 && style[at].value === norm(value)) continue;
    const decl = { raw: `${name}: ${value}`, name, value: norm(value), fresh: true };
    if (at >= 0) style = [...style.slice(0, at), decl, ...style.slice(at + 1).filter((d) => d.name !== name)];
    else style.splice(placeOf(edit.order?.style, style, name, (d) => d.name), 0, decl);
  }
  if (edit.translate !== undefined) {
    // the translation is compared in whole px, and a new one is put last unless order places it
    const current = translateIn(style.filter((d) => d.name === 'translate').map((d) => `translate: ${d.value}`)[0] ?? '');
    const t = edit.translate;
    const same = current === t || (!!current && !!t && px(current.x) === px(t.x) && px(current.y) === px(t.y));
    if (!same) {
      style = style.filter((d) => d.name !== 'translate');
      if (t) style.splice(placeOf(edit.order?.style, style, 'translate', (d) => d.name), 0, { raw: `translate: ${translateText(t)}`, name: 'translate', value: translateText(t), fresh: true });
    }
  }
  style = reorder(style, edit.order?.style, (d) => d.name);
  if ('style' in whole || Object.keys(styleMap).length || edit.translate !== undefined || edit.order?.style) {
    const same = style.length === styleBefore.length && style.every((d, i) => d.name === styleBefore[i].name && d.value === styleBefore[i].value);
    if (!same) changes.set('style', style.length ? join(style.map((d) => [{ text: d.raw, raw: !d.fresh }]), '; ') : null);
  }

  for (const [name, value] of Object.entries(whole)) {
    if (name === 'class' || name === 'style' || (name === 'data-fragment-index' && edit.index !== undefined)) continue;
    const a = attr(attrs, name);
    if (value === null) {
      if (a) changes.set(name, null);
      continue;
    }
    const current = a ? (a.value === null ? '' : decodeAttr(a.value)) : null;
    if (current !== value) changes.set(name, value === '' ? [] : [{ text: value, raw: false }]);
  }

  // the attributes of the file that are kept, in the order of the edit where it gives one, e.g.
  // after an undo across a save that wrote them in another order, with the others in their place
  const order = edit.order?.attrs;
  const kept = reorder(attrs.filter((a) => changes.get(a.name) !== null), order, (a) => a.name);
  const fresh = [...changes]
    .map(([name, value], k) => ({ name, value, k }))
    .filter((c): c is { name: string; value: Part[]; k: number } => c.value !== null && !attr(attrs, c.name))
    .map(({ name, value, k }) => ({ name, value, at: placeOf(order, kept, name, (a) => a.name), rank: order?.includes(name) ? order.indexOf(name) : 2 ** 40 + k }))
    .sort((a, b) => a.at - b.at || a.rank - b.rank);
  const items: Item[] = [];
  let f = 0;
  const put = (at: number) => { while (f < fresh.length && fresh[f].at === at) items.push({ name: fresh[f].name, attr: null, value: fresh[f++].value, stays: false }); };
  kept.forEach((a, i) => {
    put(i);
    items.push({ name: a.name, attr: a, value: changes.get(a.name) ?? undefined, stays: true });
  });
  put(kept.length);
  // the attributes of the file that stay are a longest run of them in the order of the file
  const own = items.filter((i) => i.attr);
  const run = own.map(() => 1);
  const prev = own.map(() => -1);
  own.forEach((x, i) => own.slice(0, i).forEach((y, j) => {
    if (y.attr!.start < x.attr!.start && run[j] + 1 > run[i]) [run[i], prev[i]] = [run[j] + 1, j];
  }));
  const stay = new Set<Item>();
  for (let i = run.indexOf(Math.max(0, ...run)); i >= 0; i = prev[i]) stay.add(own[i]);
  for (const x of own) x.stays = stay.has(x);
  const names = [...new Set(items.map((i) => i.name))];
  return { changes, classes, style, items, names };
}

// the quote of an attribute in the file, or null for a value without quotes or an attribute
// without a value
function quoteOf(text: string, a: Attr): string | null {
  if (a.value === null) return null;
  const c = text[a.end - 1];
  return (c === '"' || c === "'") && a.end - a.start >= a.name.length + 2 ? c : null;
}

// an attribute written with the quote of the file, where raw parts keep their bytes and new parts
// are escaped. a raw part of a value without quotes cannot hold a quote, and one is escaped anyway.
// an empty value is written as the name alone
function written(name: string, parts: Part[], quote: string | null): string {
  if (!parts.length) return name;
  const q = quote ?? '"';
  const other = q === '"' ? '&quot;' : '&#39;';
  const value = parts
    .map((p) => (p.raw ? (quote ? p.text : p.text.replace(/"/g, '&quot;')) : p.text.replace(/&/g, '&amp;').split(q).join(other)))
    .join('');
  return `${name}=${q}${value}${q}`;
}

// the start tag at range in text with edit applied, or null when nothing changes
export function renderTag(text: string, range: Range, attrs: Attr[], edit: TagEdit): string | null {
  const { changes, items } = layout(attrs, edit);
  // ops at one place are applied from the last in the tag, i.e. the highest rank, to the first
  const ops: { start: number; end: number; text: string; rank: number }[] = [];
  let end = range.end - 1;
  if (text[end - 1] === '/') end--;
  while (end > range.start && isSpace(text[end - 1])) end--;
  const remove = (a: Attr) => {
    let start = a.start;
    while (start > range.start && isSpace(text[start - 1])) start--;
    ops.push({ start, end: a.end, text: '', rank: Infinity });
  };
  for (const [name, value] of changes) {
    const a = attr(attrs, name);
    if (a && value === null) remove(a);
  }
  items.forEach((item, rank) => {
    const a = item.attr;
    const value = item.value === undefined ? text.slice(a!.start, a!.end) : written(item.name, item.value, a ? quoteOf(text, a) : '"');
    if (a && item.stays) {
      if (item.value !== undefined) ops.push({ start: a.start, end: a.end, text: value, rank: Infinity });
      return;
    }
    if (a) remove(a);
    const next = items.slice(rank + 1).find((i) => i.stays)?.attr;
    if (next) ops.push({ start: next.start, end: next.start, text: `${value} `, rank });
    else ops.push({ start: end, end, text: ` ${value}`, rank });
  });
  if (!ops.length) return null;
  ops.sort((a, b) => b.start - a.start || b.rank - a.rank);
  let tag = text.slice(range.start, range.end);
  for (const op of ops) tag = tag.slice(0, op.start - range.start) + op.text + tag.slice(op.end - range.start);
  return tag === text.slice(range.start, range.end) ? null : tag;
}
