// the start tag of an element with three things changed: the class fragment, the attribute
// data-fragment-index, and the declaration translate of its style, i.e. the step at which the
// element is shown and the offset it was dragged by. every other byte of the tag is copied from
// the file, and an attribute that is not changed keeps its bytes

import type { Attr, Range } from './tokens.ts';

export type Translate = { x: number; y: number };
// a field left undefined is not changed, and null removes the index or the translation
export type TagEdit = { fragment?: boolean; index?: number | null; translate?: Translate | null };
export type Step = { fragment: boolean; index: number | null };

const isSpace = (c: string | undefined) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
const quote = (value: string) => `"${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;
// the value of an attribute in the file, decoded as far as a class or a style needs
const decode = (value: string | null) => (value ?? '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const attr = (attrs: Attr[], name: string): Attr | null => attrs.find((a) => a.name === name) ?? null;
const px = (n: number) => `${Math.round(n)}px`;

export const classesIn = (attrs: Attr[]): string[] => decode(attr(attrs, 'class')?.value ?? null).split(/\s+/).filter(Boolean);

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

// the value of each attribute after the edit, or null for an attribute to remove, and undefined
// for one to leave
function values(attrs: Attr[], edit: TagEdit): Map<string, string | null> {
  const out = new Map<string, string | null>();
  if (edit.fragment !== undefined) {
    const classes = classesIn(attrs);
    const has = classes.includes('fragment');
    if (edit.fragment && !has) out.set('class', [...classes, 'fragment'].join(' '));
    if (!edit.fragment && has) {
      const rest = classes.filter((c) => c !== 'fragment');
      out.set('class', rest.length ? rest.join(' ') : null);
    }
  }
  if (edit.index !== undefined) {
    const current = stepIn(attrs).index;
    if (edit.index !== current) out.set('data-fragment-index', edit.index === null ? null : String(edit.index));
  }
  if (edit.translate !== undefined) {
    const style = decode(attr(attrs, 'style')?.value ?? null);
    const current = translateIn(style);
    const same = current === edit.translate || (!!current && !!edit.translate && px(current.x) === px(edit.translate.x) && px(current.y) === px(edit.translate.y));
    if (!same) {
      const rest = style.split(';').map((d) => d.trim()).filter((d) => d && !/^translate\s*:/.test(d));
      if (edit.translate) rest.push(`translate: ${px(edit.translate.x)} ${px(edit.translate.y)}`);
      out.set('style', rest.length ? rest.join('; ') : null);
    }
  }
  return out;
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
      ops.push({ start: a.start, end: a.end, text: `${name}=${quote(value as string)}` });
    } else if (value !== null) added.push(` ${name}=${quote(value)}`);
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
