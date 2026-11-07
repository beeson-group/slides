// the pairing of the blocks of text in the file with their elements on the page, and the text of
// the file with the edits of the page written into it. a block is an element whose content is
// edited in place, e.g. a heading, a paragraph, a list item, a cell, a caption, or the notes, and
// the outermost such element is paired, since the elements inside it are written with it. every
// byte outside an edited block is copied from the file

import { RAW_TEXT, type Range } from './tokens.ts';
import { VOID, rawRange, type Piece, type Source, type SrcComment, type SrcEl, type SrcText } from './source.ts';
import type { MathInfo, MathLookup } from './math.ts';
import { renderTag, type TagEdit } from './tags.ts';

export type LivePiece = { kind: 'text'; text: string; node: Text } | ({ kind: 'math'; node: Element } & MathInfo);

// a child of an element on the page as it was in the file: the text nodes and formulas between
// two elements are one text item, since MathJax splits a text node at each formula
export type Item =
  | { kind: 'text'; text: string; pieces: LivePiece[] }
  | { kind: 'element'; el: Element }
  | { kind: 'comment'; node: Comment };

export function virtualChildren(el: Element, math: MathLookup): Item[] {
  const items: Item[] = [];
  let pending: LivePiece[] | null = null;
  const flush = () => {
    if (!pending) return;
    const text = pending.map((p) => (p.kind === 'text' ? p.text : p.open + p.tex + p.close)).join('');
    // an empty text node is left on the page by an edit, and the parser never makes one
    if (text !== '') items.push({ kind: 'text', text, pieces: pending });
    pending = null;
  };
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      (pending ??= []).push({ kind: 'text', text: (node as Text).data, node: node as Text });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const e = node as Element;
      const info = e.localName === 'mjx-container' ? math(e) : null;
      if (info) (pending ??= []).push({ kind: 'math', node: e, ...info });
      else {
        flush();
        items.push({ kind: 'element', el: e });
      }
    } else if (node.nodeType === Node.COMMENT_NODE) {
      flush();
      items.push({ kind: 'comment', node: node as Comment });
    }
  }
  flush();
  return items;
}

const BLOCK_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'td', 'th', 'dt', 'dd', 'figcaption', 'caption', 'blockquote', 'pre', 'aside', 'summary', 'label']);
const INLINE_TAGS = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'img', 'kbd', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr']);

// a div or a span is a block when its own text is not only white space and its children are
// inline, e.g. div.foot, div.caption, div.math, and span.lab of the theme
export function isBlock(s: SrcEl): boolean {
  if (BLOCK_TAGS.has(s.tag)) return true;
  if (s.tag !== 'div' && s.tag !== 'span') return false;
  const own = s.children.some((c) => c.kind === 'text' && /\S/.test(c.decoded));
  return own && s.children.every((c) => c.kind !== 'element' || INLINE_TAGS.has(c.tag));
}

const sameTag = (el: Element, s: SrcEl) => el.localName.toLowerCase() === s.tag.toLowerCase();
// a space typed at the end of a line is a no-break space on the page, and it is written as a plain
// space unless the file has no-break spaces in the same text
const shown = (live: string, src: string) => (src.includes('\u00a0') ? live : live.replace(/\u00a0/g, ' '));
const short = (s: string) => (s.length > 40 ? `${s.slice(0, 40)}…` : s).replace(/\n/g, '\\n');

export type Block = { src: SrcEl; live: Element; slide: Element | null };
export type Problem = { slide: Element | null; tag: string; reason: string };
// elements maps every element of the page that was found in the file, block or not, to its bytes
export type Pairing = { blocks: Block[]; byLive: Map<Element, Block>; elements: Map<Element, SrcEl>; sections: { src: SrcEl; live: Element }[]; problems: Problem[] };

// pairs the blocks of the file with the page. outside a block, the elements of the file are found
// on the page in order, and an element added on the page, e.g. a canvas of a backdrop or an item of
// the outline, is passed over. inside a block, the page must read as the file, else the block is a
// problem and is not edited
export function pair(source: Source, liveSlides: Element, math: MathLookup): Pairing {
  const out: Pairing = { blocks: [], byLive: new Map(), elements: new Map(), sections: [], problems: [] };
  pairChildren(source.slides, liveSlides, null, math, out);
  return out;
}

function blocksWithin(s: SrcEl): SrcEl[] {
  if (isBlock(s)) return [s];
  return s.children.flatMap((c) => (c.kind === 'element' ? blocksWithin(c) : []));
}

function pairChildren(src: SrcEl, live: Element, slide: Element | null, math: MathLookup, out: Pairing): void {
  const items = virtualChildren(live, math);
  let j = 0;
  for (const s of src.children) {
    if (s.kind !== 'element') continue;
    let k = j;
    while (k < items.length && !(items[k].kind === 'element' && sameTag((items[k] as { el: Element }).el, s))) k++;
    if (k === items.length) {
      for (const b of blocksWithin(s)) out.problems.push({ slide, tag: b.tag, reason: 'it is not on the page' });
      continue;
    }
    const el = (items[k] as { el: Element }).el;
    j = k + 1;
    out.elements.set(el, s);
    const here = s.tag === 'section' ? el : slide;
    if (s.tag === 'section') out.sections.push({ src: s, live: el });
    if (isBlock(s)) {
      const reason = verify(s, el, math);
      if (reason) out.problems.push({ slide: here, tag: s.tag, reason });
      else {
        const block = { src: s, live: el, slide: here };
        out.blocks.push(block);
        out.byLive.set(el, block);
      }
    } else pairChildren(s, el, here, math, out);
  }
}

// checks that el reads as s, part for part, and records on each text node of s how the page
// splits it into text and formulas
function verify(s: SrcEl, el: Element, math: MathLookup): string | null {
  const items = virtualChildren(el, math);
  const kids = s.children;
  if (items.length !== kids.length) return `the ${s.tag} has ${kids.length} parts in the file and ${items.length} on the page`;
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i], it = items[i];
    if (k.kind === 'element') {
      if (it.kind !== 'element' || !sameTag(it.el, k)) return `a ${k.tag} of the file is not on the page`;
      const reason = verify(k, it.el, math);
      if (reason) return reason;
    } else if (k.kind === 'text') {
      if (it.kind !== 'text') return `the text "${short(k.decoded)}" is not on the page`;
      if (shown(it.text, k.decoded) !== k.decoded) return `the text "${short(k.decoded)}" reads "${short(it.text)}" on the page`;
      k.pieces = piecesOf(it.pieces);
    } else if (it.kind !== 'comment') return 'a comment of the file is not on the page';
  }
  return null;
}

function piecesOf(live: LivePiece[]): Piece[] {
  let d = 0;
  return live.map((p): Piece => {
    if (p.kind === 'text') {
      const piece: Piece = { kind: 'text', dec: { start: d, end: d + p.text.length } };
      d += p.text.length;
      return piece;
    }
    const length = p.open.length + p.tex.length + p.close.length;
    const piece: Piece = { kind: 'math', dec: { start: d, end: d + length }, inner: { start: d + p.open.length, end: d + p.open.length + p.tex.length } };
    d += length;
    return piece;
  });
}

// the end of the last token inside s, for an element without an end tag
