// the text of index.html as a tree with the bytes of each node. the tree is parsed with DOMParser,
// i.e. with the same parser as the deck, and the tokens of tokens.ts are matched to its nodes in
// document order inside div.slides. a node that cannot be matched is an error, and nothing is then
// edited, rather than a wrong place in the file

import { RAW_TEXT, classesOf, tokenize, type Attr, type Range, type Token } from './tokens.ts';

// one run of the raw text of a node: literal characters, or one character reference, or a CR LF
// pair, with its range in the file and in the decoded text
export type Segment = { raw: Range; dec: Range; literal: boolean };

// a part of a text node as shown on the page: a run of text, or one formula with its delimiters,
// whose TeX is in inner. the ranges are in the decoded text of the node
export type Piece = { kind: 'text'; dec: Range } | { kind: 'math'; dec: Range; inner: Range };

export type SrcText = {
  kind: 'text';
  node: Text;
  // range is the whole text in the file, and lead is the length of a newline at its start that the
  // parser drops after the start tag of a pre, which is not in decoded
  range: Range;
  lead: number;
  decoded: string;
  segments: Segment[];
  // recorded when the node is matched to the page, see render.ts
  pieces: Piece[] | null;
};
export type SrcComment = { kind: 'comment'; node: Comment; range: Range };
export type SrcEl = {
  kind: 'element';
  node: Element;
  tag: string;
  // open is null for an element without a start tag in the file, e.g. the tbody of a table, and
  // attrs are the attributes of the start tag with their bytes
  open: Range | null;
  attrs: Attr[];
  close: Range | null;
  children: SrcNode[];
};
export type SrcNode = SrcText | SrcComment | SrcEl;

export type Source = { text: string; crlf: boolean; doc: Document; slides: SrcEl };

export const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
// a newline right after the start tag of these elements is dropped by the parser
const PRE_LIKE = new Set(['pre', 'textarea', 'listing']);

let box: HTMLTextAreaElement | null = null;

// decodes the character references of a run of text with the parser of the browser, which has
// the full table of named references. the sentinel keeps a leading newline, which a textarea
// would drop
export function decode(raw: string): string {
  box ??= document.createElement('textarea');
  box.innerHTML = `.${raw}`;
  return box.value.slice(1);
}

const REFERENCE = /&(?:#[xX][0-9a-fA-F]+;?|#[0-9]+;?|[A-Za-z][A-Za-z0-9]*;?)/y;

// splits the raw text of a node into segments, so that a range of the decoded text can be traced
// to the file. when the segments do not give the decoded text, the node is one segment, and a
// change to any part of it rewrites all of it
function segmentsOf(raw: string, base: number, isRaw: boolean, decoded: string): Segment[] {
  const out: Segment[] = [];
  const whole: Segment[] = [{ raw: { start: base, end: base + raw.length }, dec: { start: 0, end: decoded.length }, literal: false }];
  let i = 0, d = 0, literalStart = -1;
  const parts: string[] = [];
  const flush = (to: number) => {
    if (literalStart >= 0 && to > literalStart) {
      out.push({ raw: { start: base + literalStart, end: base + to }, dec: { start: d, end: d + to - literalStart }, literal: true });
      parts.push(raw.slice(literalStart, to));
      d += to - literalStart;
    }
    literalStart = -1;
  };
  while (i < raw.length) {
    const c = raw[i];
    if (c === '\r') {
      flush(i);
      const length = raw[i + 1] === '\n' ? 2 : 1;
      out.push({ raw: { start: base + i, end: base + i + length }, dec: { start: d, end: d + 1 }, literal: false });
      parts.push('\n');
      d += 1;
      i += length;
      continue;
    }
    if (c === '&' && !isRaw) {
      REFERENCE.lastIndex = i;
      const m = REFERENCE.exec(raw);
      const value = m ? decode(m[0]) : null;
      if (m && value !== null && value !== m[0]) {
        flush(i);
        out.push({ raw: { start: base + i, end: base + i + m[0].length }, dec: { start: d, end: d + value.length }, literal: false });
        parts.push(value);
        d += value.length;
        i += m[0].length;
        continue;
      }
    }
    if (literalStart < 0) literalStart = i;
    i += 1;
  }
  flush(i);
  return parts.join('') === decoded ? out : whole;
}

// the range in the file of a range of the decoded text of a node. a boundary inside a character
// reference is moved outward
export function rawRange(s: SrcText, dec: Range): Range {
  const at = (pos: number, isEnd: boolean): number => {
    for (const seg of s.segments) {
      if (pos < seg.dec.start || pos > seg.dec.end) continue;
      if (seg.literal) return seg.raw.start + (pos - seg.dec.start);
      if (pos === seg.dec.start) return seg.raw.start;
      if (pos === seg.dec.end) return seg.raw.end;
      return isEnd ? seg.raw.end : seg.raw.start;
    }
    return pos <= 0 ? s.range.start + s.lead : s.range.end;
  };
  return { start: at(dec.start, false), end: at(dec.end, true) };
}
