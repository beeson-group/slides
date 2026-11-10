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
// before an edit that is undone, and a new one is written before the first one that follows it
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

// edit b laid over edit a, as two edits of the same element made one after the other
export function mergeEdit(a: TagEdit | undefined, b: TagEdit): TagEdit {
  const out: TagEdit = { ...a, ...b };
  if (a?.attrs || b.attrs) out.attrs = { ...a?.attrs, ...b.attrs };
  if (a?.classes || b.classes) out.classes = { ...a?.classes, ...b.classes };
  if (a?.style || b.style) out.style = { ...a?.style, ...b.style };
  return out;
}

// the start tag of the file read as the classes, the attributes, and the declarations of the style
// that it has after edit, all decoded. it is the state that an undo of a tag edit records
export type TagState = { classes: string[]; attrs: Record<string, string>; style: Record<string, string> };

export function stateOf(attrs: Attr[], edit: TagEdit = {}): TagState {
  const out: TagState = { classes: [], attrs: {}, style: {} };
  for (const a of attrs) if (!(a.name in out.attrs)) out.attrs[a.name] = a.value === null ? '' : decodeAttr(a.value);
  const classValue = edit.attrs && 'class' in edit.attrs ? edit.attrs.class : (out.attrs.class ?? null);
  const styleValue = edit.attrs && 'style' in edit.attrs ? edit.attrs.style : (out.attrs.style ?? null);
  for (const [name, value] of Object.entries(edit.attrs ?? {})) {
    if (value === null) delete out.attrs[name];
    else out.attrs[name] = value;
  }
  out.classes = splitClasses(classValue).map((c) => c.name);
  for (const [name, on] of Object.entries(classesOf(edit))) {
    out.classes = out.classes.filter((c) => c !== name);
    if (on) out.classes.push(name);
  }
  for (const d of rawDeclarations(styleValue)) out.style[d.name] = d.value;
  for (const [name, value] of Object.entries(styleOf(edit))) {
    if (value === null) delete out.style[name];
    else out.style[name] = norm(value);
  }
  if (edit.index !== undefined) {
    if (edit.index === null) delete out.attrs['data-fragment-index'];
    else out.attrs['data-fragment-index'] = String(edit.index);
  }
  if (out.classes.length) out.attrs.class = out.classes.join(' ');
  else delete out.attrs.class;
  const decls = Object.entries(out.style);
  if (decls.length) out.attrs.style = decls.map(([k, v]) => `${k}: ${v}`).join('; ');
  else delete out.attrs.style;
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

// the value of each attribute after the edit as parts, or null for an attribute to remove, and
// undefined for one to leave
function values(attrs: Attr[], edit: TagEdit): Map<string, Part[] | null> {
  const out = new Map<string, Part[] | null>();
  const whole = edit.attrs ?? {};

  const classMap = classesOf(edit);
  if ('class' in whole || Object.keys(classMap).length) {
    const before = rawClasses(attrs);
    let after = 'class' in whole ? splitClasses(whole.class).map((c) => ({ ...c, fresh: true })) : before.map((c) => ({ ...c, fresh: false }));
    for (const [name, on] of Object.entries(classMap)) {
      const has = after.some((c) => c.name === name);
      if (on && !has) after.splice(placeOf(edit.order?.classes, after, name, (c) => c.name), 0, { raw: name, name, fresh: true });
      if (!on && has) after = after.filter((c) => c.name !== name);
    }
    const same = after.length === before.length && after.every((c, i) => c.name === before[i].name);
    if (!same) out.set('class', after.length ? join(after.map((c) => [{ text: c.fresh ? c.name : c.raw, raw: !c.fresh }]), ' ') : null);
  }

  if (edit.index !== undefined) {
    const current = stepIn(attrs).index;
    if (edit.index !== current) out.set('data-fragment-index', edit.index === null ? null : [{ text: String(edit.index), raw: false }]);
  }

  const styleMap = { ...edit.style };
  if ('style' in whole || Object.keys(styleMap).length || edit.translate !== undefined) {
    const before = rawDeclarations(attr(attrs, 'style')?.value);
    type Decl = { raw: string; name: string; value: string; fresh: boolean };
    let after: Decl[] = 'style' in whole ? rawDeclarations(whole.style).map((d) => ({ ...d, raw: d.raw, fresh: true })) : before.map((d) => ({ ...d, fresh: false }));
    for (const [name, value] of Object.entries(styleMap)) {
      const at = after.findIndex((d) => d.name === name);
      if (value === null) {
        if (at >= 0) after = after.filter((d) => d.name !== name);
        continue;
      }
      if (at >= 0 && after[at].value === norm(value)) continue;
      const decl = { raw: `${name}: ${value}`, name, value: norm(value), fresh: true };
      if (at >= 0) after = [...after.slice(0, at), decl, ...after.slice(at + 1).filter((d) => d.name !== name)];
      else after.splice(placeOf(edit.order?.style, after, name, (d) => d.name), 0, decl);
    }
    if (edit.translate !== undefined) {
      // the translation is compared in whole px, and a new one is put last unless order places it
      const current = translateIn(after.filter((d) => d.name === 'translate').map((d) => `translate: ${d.value}`)[0] ?? '');
      const t = edit.translate;
      const same = current === t || (!!current && !!t && px(current.x) === px(t.x) && px(current.y) === px(t.y));
      if (!same) {
        after = after.filter((d) => d.name !== 'translate');
        if (t) after.splice(placeOf(edit.order?.style, after, 'translate', (d) => d.name), 0, { raw: `translate: ${translateText(t)}`, name: 'translate', value: translateText(t), fresh: true });
      }
    }
    const same = after.length === before.length && after.every((d, i) => d.name === before[i].name && d.value === before[i].value);
    if (!same) out.set('style', after.length ? join(after.map((d) => [{ text: d.raw, raw: !d.fresh }]), '; ') : null);
  }

  for (const [name, value] of Object.entries(whole)) {
    if (name === 'class' || name === 'style' || (name === 'data-fragment-index' && edit.index !== undefined)) continue;
    const a = attr(attrs, name);
    if (value === null) {
      if (a) out.set(name, null);
      continue;
    }
    const current = a ? (a.value === null ? '' : decodeAttr(a.value)) : null;
    if (current !== value) out.set(name, value === '' ? [] : [{ text: value, raw: false }]);
  }
  return out;
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
  const changes = values(attrs, edit);
  if (!changes.size) return null;
  // ops at one place are applied from the last in the tag, i.e. the highest rank, to the first
  const ops: { start: number; end: number; text: string; rank: number }[] = [];
  const order = edit.order?.attrs;
  const kept = attrs.filter((a) => changes.get(a.name) !== null);
  let end = range.end - 1;
  if (text[end - 1] === '/') end--;
  while (end > range.start && isSpace(text[end - 1])) end--;
  for (const [name, value] of changes) {
    const a = attr(attrs, name);
    if (a && value === null) {
      let start = a.start;
      while (start > range.start && isSpace(text[start - 1])) start--;
      ops.push({ start, end: a.end, text: '', rank: Infinity });
    } else if (a) {
      ops.push({ start: a.start, end: a.end, text: written(name, value as Part[], quoteOf(text, a)), rank: Infinity });
    } else if (value !== null) {
      // a new attribute is put before the attribute that follows it in order, else at the end
      const next = kept[placeOf(order, kept, name, (k) => k.name)];
      const rank = order?.includes(name) ? order.indexOf(name) : 2 ** 40 + ops.length;
      if (next) ops.push({ start: next.start, end: next.start, text: `${written(name, value, '"')} `, rank });
      else ops.push({ start: end, end, text: ` ${written(name, value, '"')}`, rank });
    }
  }
  ops.sort((a, b) => b.start - a.start || b.rank - a.rank);
  let tag = text.slice(range.start, range.end);
  for (const op of ops) tag = tag.slice(0, op.start - range.start) + op.text + tag.slice(op.end - range.start);
  return tag === text.slice(range.start, range.end) ? null : tag;
}
