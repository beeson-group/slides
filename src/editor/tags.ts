// the start tag of an element with three things changed: the class fragment, the attribute
// data-fragment-index, and the declaration translate of its style, i.e. the step at which the
// element is shown and the offset it was dragged by. every other byte of the tag is copied from
// the file, and an attribute that is not changed keeps its bytes, as does each class and each
// declaration of a changed attribute that is not changed itself

import { REFERENCE_IN_ATTR, decodeAttr, type Attr, type Range } from './tokens.ts';

export type Translate = { x: number; y: number };
// a field left undefined is not changed, and null removes the index or the translation
export type TagEdit = { fragment?: boolean; index?: number | null; translate?: Translate | null };
export type Step = { fragment: boolean; index: number | null };

// a part of a written value: raw bytes kept from the file, or new text to escape
type Part = { text: string; raw: boolean };

const isSpace = (c: string | undefined) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
const attr = (attrs: Attr[], name: string): Attr | null => attrs.find((a) => a.name === name) ?? null;
const px = (n: number) => `${Math.round(n)}px`;

// the classes of a class attribute, each with its raw bytes
const rawClasses = (attrs: Attr[]): { raw: string; name: string }[] =>
  (attr(attrs, 'class')?.value ?? '').split(/[ \t\n\r\f]+/).filter(Boolean).map((raw) => ({ raw, name: decodeAttr(raw) }));

// the declarations of a style attribute, each with its raw bytes and its property in lowercase. a
// semicolon that ends a character reference does not end a declaration
function rawDeclarations(value: string | null | undefined): { raw: string; name: string }[] {
  const raw = value ?? '';
  const out: string[] = [];
  let start = 0;
  for (const m of raw.matchAll(new RegExp(`${REFERENCE_IN_ATTR.source}|;`, 'g'))) {
    if (m[0] !== ';') continue;
    out.push(raw.slice(start, m.index));
    start = (m.index as number) + 1;
  }
  out.push(raw.slice(start));
  return out.map((d) => d.trim()).filter(Boolean).map((d) => ({ raw: d, name: decodeAttr(d.split(':')[0]).trim().toLowerCase() }));
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

const join = (parts: Part[][], by: string): Part[] => parts.flatMap((p, i) => (i ? [{ text: by, raw: true }, ...p] : p));

// the value of each attribute after the edit as parts, or null for an attribute to remove, and
// undefined for one to leave
function values(attrs: Attr[], edit: TagEdit): Map<string, Part[] | null> {
  const out = new Map<string, Part[] | null>();
  if (edit.fragment !== undefined) {
    const classes = rawClasses(attrs);
    const has = classes.some((c) => c.name === 'fragment');
    const kept = classes.filter((c) => c.name !== 'fragment').map((c): Part[] => [{ text: c.raw, raw: true }]);
    if (edit.fragment && !has) out.set('class', join([...kept, [{ text: 'fragment', raw: false }]], ' '));
    if (!edit.fragment && has) out.set('class', kept.length ? join(kept, ' ') : null);
  }
  if (edit.index !== undefined) {
    const current = stepIn(attrs).index;
    if (edit.index !== current) out.set('data-fragment-index', edit.index === null ? null : [{ text: String(edit.index), raw: false }]);
  }
  if (edit.translate !== undefined) {
    const style = attr(attrs, 'style')?.value ?? null;
    const current = translateIn(decodeAttr(style ?? ''));
    const same = current === edit.translate || (!!current && !!edit.translate && px(current.x) === px(edit.translate.x) && px(current.y) === px(edit.translate.y));
    if (!same) {
      const rest = rawDeclarations(style).filter((d) => d.name !== 'translate').map((d): Part[] => [{ text: d.raw, raw: true }]);
      if (edit.translate) rest.push([{ text: `translate: ${px(edit.translate.x)} ${px(edit.translate.y)}`, raw: false }]);
      out.set('style', rest.length ? join(rest, '; ') : null);
    }
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
// are escaped. a raw part of a value without quotes cannot hold a quote, and one is escaped anyway
function written(name: string, parts: Part[], quote: string | null): string {
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
  const ops: { start: number; end: number; text: string }[] = [];
  const added: string[] = [];
  for (const [name, value] of changes) {
    const a = attr(attrs, name);
    if (a && value === null) {
      let start = a.start;
      while (start > range.start && isSpace(text[start - 1])) start--;
      ops.push({ start, end: a.end, text: '' });
    } else if (a) {
      ops.push({ start: a.start, end: a.end, text: written(name, value as Part[], quoteOf(text, a)) });
    } else if (value !== null) added.push(` ${written(name, value, '"')}`);
  }
  if (added.length) {
    let at = range.end - 1;
    if (text[at - 1] === '/') at--;
    while (at > range.start && isSpace(text[at - 1])) at--;
    ops.push({ start: at, end: at, text: added.join('') });
  }
  ops.sort((a, b) => b.start - a.start);
  let tag = text.slice(range.start, range.end);
  for (const op of ops) tag = tag.slice(0, op.start - range.start) + op.text + tag.slice(op.end - range.start);
  return tag === text.slice(range.start, range.end) ? null : tag;
}
