// the units of a container in the file. a unit is a child element with the white space and the
// comments before it, its lead, so that the comment above a slide is moved and deleted with the
// slide. a pair of comments "X start" and "X end" around one element is one unit, from the start
// comment to the end comment, e.g. the comments that demo/tycho-scene.py writes around a
// tycho-viewer. the white space after the last unit is the tail of the container. the units and
// the tail cover the content of the container without a gap, hence the content is written again
// byte for byte when its units are written in the order of the file. pure, without the DOM

import type { Range } from '../tokens.ts';

// a child of the container with its range in the file, in the order of the file
export type Child = { kind: 'element' | 'text' | 'comment'; start: number; end: number };

// lead runs from the end of the unit before to the element, range is the element, and end is the
// end of the unit, i.e. of the end comment of a marker pair. child is the index of the element in
// the children
export type Unit = { lead: Range; range: Range; end: number; child: number };
export type Units = { units: Unit[]; tail: Range };

const START = /^\s*(\S+) start\b/;
const commentText = (text: string, c: Child) => text.slice(c.start + 4, Math.max(c.start + 4, c.end - 3));
const blank = (text: string, c: Child) => c.kind === 'text' && !/\S/.test(text.slice(c.start, c.end));

export function unitsOf(text: string, children: Child[], content: Range): Units {
  const units: Unit[] = [];
  let pos = content.start;
  let from = 0;
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    if (c.kind !== 'element') continue;
    const unit: Unit = { lead: { start: pos, end: c.start }, range: { start: c.start, end: c.end }, end: c.end, child: i };
    // the last comment of the lead opens a marker pair when an end comment of the same name follows
    // the element, with only white space between them
    const opener = children.slice(from, i).reverse().find((k) => k.kind === 'comment');
    const name = opener ? START.exec(commentText(text, opener))?.[1] : undefined;
    if (name) {
      let j = i + 1;
      while (j < children.length && blank(text, children[j])) j++;
      const closer = children[j];
      if (closer?.kind === 'comment' && new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} end\\b`).test(commentText(text, closer))) {
        unit.end = closer.end;
        i = j;
      }
    }
    units.push(unit);
    pos = unit.end;
    from = i + 1;
  }
  return { units, tail: { start: pos, end: Math.max(pos, content.end) } };
}

// the line ending of a text, CR LF when the text has one
export const eolOf = (text: string): string => (text.includes('\r\n') ? '\r\n' : '\n');

// the white space at the start of a lead, i.e. the line break and the indentation before the
// element or before its first comment
export const spaceOf = (lead: string): string => /^[ \t\r\n\f]*/.exec(lead)?.[0] ?? '';

// the indentation of the line of text at pos
export function indentAt(text: string, pos: number): string {
  const start = text.lastIndexOf('\n', pos - 1) + 1;
  return /^[ \t]*/.exec(text.slice(start, pos))?.[0] ?? '';
}

// the lead of a unit placed in a container it did not come from: the white space of the container,
// then the comments of the lead, each line indented as the container indents its children
export function placeLead(lead: string, space: string, eol: string): string {
  const rest = lead.slice(spaceOf(lead).length);
  if (!rest) return space;
  const indent = space.slice(space.lastIndexOf('\n') + 1);
  return space + rest.replace(/\r?\n[ \t]*/g, eol + indent);
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

// the children of a content range read from the tokens of tokens.ts, for well-formed content in
// which every element that is not void has its end tag. the editor reads them from the tree of
// source.ts, which is matched to the same tokens
export function childrenIn(tokens: { type: string; name?: string; selfClosing?: boolean; start: number; end: number }[], content: Range): Child[] {
  const out: Child[] = [];
  let depth = 0;
  let open: { start: number; name: string } | null = null;
  for (const t of tokens) {
    if (t.start < content.start || t.end > content.end) continue;
    if (depth === 0 && (t.type === 'text' || t.type === 'comment')) {
      out.push({ kind: t.type, start: t.start, end: t.end });
    } else if (t.type === 'start') {
      const single = VOID.has(t.name ?? '') || !!t.selfClosing;
      if (depth === 0 && single) out.push({ kind: 'element', start: t.start, end: t.end });
      else if (!single) {
        if (depth === 0) open = { start: t.start, name: t.name ?? '' };
        depth++;
      }
    } else if (t.type === 'end' && depth > 0) {
      depth--;
      if (depth === 0 && open) {
        out.push({ kind: 'element', start: open.start, end: t.end });
        open = null;
      }
    }
  }
  return out;
}
