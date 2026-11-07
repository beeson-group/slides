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
function lastEnd(s: SrcEl): number {
  const last = s.children[s.children.length - 1];
  if (!last) return s.open?.end ?? -1;
  if (last.kind === 'element') return last.close ? last.close.end : lastEnd(last);
  return last.range.end;
}

// the range of the content of s in the file
export function innerRange(s: SrcEl): Range | null {
  if (!s.open) return null;
  const start = s.open.end;
  const end = s.close ? s.close.start : Math.max(start, lastEnd(s));
  return { start, end };
}

export function escape(source: Source, text: string, keepNbsp: boolean): string {
  let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // a no-break space is typed by the browser at the end of a line, and it is kept only where the
  // file had one
  s = keepNbsp ? s.replace(/ /g, '&nbsp;') : s.replace(/ /g, ' ');
  return source.crlf ? s.replace(/\n/g, '\r\n') : s;
}

// an element that is not in the file, e.g. a br inserted on the page
function serializeNew(source: Source, el: Element, math: MathLookup): string {
  const tag = el.localName;
  const attrs = [...el.attributes]
    .map((a) => (a.value === '' ? ` ${a.name}` : ` ${a.name}="${a.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`))
    .join('');
  if (VOID.has(tag)) return `<${tag}${attrs}>`;
  return `<${tag}${attrs}>${serializeNewChildren(source, el, math)}</${tag}>`;
}

export function serializeNewChildren(source: Source, el: Element, math: MathLookup): string {
  return virtualChildren(el, math)
    .map((it) => (it.kind === 'text' ? escape(source, it.text, false) : it.kind === 'element' ? serializeNew(source, it.el, math) : `<!--${it.node.data}-->`))
    .join('');
}

// a text node: copied from the file when unchanged, else piece by piece when the page still splits
// it as the file was paired, else written whole
function serializeText(source: Source, s: SrcText, it: Item & { kind: 'text' }): string {
  const text = source.text;
  if (shown(it.text, s.decoded) === s.decoded) return text.slice(s.range.start, s.range.end);
  const keepNbsp = s.decoded.includes('\u00a0');
  const lead = text.slice(s.range.start, s.range.start + s.lead);
  const live = it.pieces;
  if (s.pieces && s.pieces.length === live.length && s.pieces.every((p, i) => p.kind === live[i].kind)) {
    const parts = s.pieces.map((p, i) => {
      const lp = live[i];
      const r = rawRange(s, p.dec);
      if (p.kind === 'text' || lp.kind !== 'math') {
        const old = s.decoded.slice(p.dec.start, p.dec.end);
        const now = lp.kind === 'text' ? lp.text : lp.open + lp.tex + lp.close;
        return shown(now, old) === old ? text.slice(r.start, r.end) : escape(source, now, keepNbsp);
      }
      const inner = rawRange(s, p.inner);
      const old = s.decoded.slice(p.inner.start, p.inner.end);
      const tex = shown(lp.tex, old) === old ? text.slice(inner.start, inner.end) : escape(source, lp.tex, keepNbsp);
      return text.slice(r.start, inner.start) + tex + text.slice(inner.end, r.end);
    });
    return lead + parts.join('');
  }
  return lead + escape(source, it.text, keepNbsp);
}

// the content of el as it is written into the file. each child of el is matched to the next child
// of s of its kind, and a matched child is copied from the file where it is unchanged
function serializeChildren(source: Source, s: SrcEl, el: Element, math: MathLookup): string {
  const text = source.text;
  const items = virtualChildren(el, math);
  const kids = s.children;
  let c = 0;
  const parts: string[] = [];
  for (const it of items) {
    if (it.kind === 'element') {
      let k = c;
      while (k < kids.length && !(kids[k].kind === 'element' && sameTag(it.el, kids[k] as SrcEl))) k++;
      if (k < kids.length) {
        c = k + 1;
        parts.push(serializeElement(source, kids[k] as SrcEl, it.el, math));
      } else parts.push(serializeNew(source, it.el, math));
      continue;
    }
    // a text or a comment is matched to the next one of its kind before the next element of the file
    let k = c;
    while (k < kids.length && kids[k].kind !== it.kind && kids[k].kind !== 'element') k++;
    const hit = k < kids.length && kids[k].kind === it.kind ? kids[k] : null;
    if (hit) c = k + 1;
    if (it.kind === 'text') parts.push(hit ? serializeText(source, hit as SrcText, it) : escape(source, it.text, false));
    else parts.push(hit ? text.slice((hit as SrcComment).range.start, (hit as SrcComment).range.end) : `<!--${it.node.data}-->`);
  }
  return parts.join('');
}

function serializeElement(source: Source, s: SrcEl, el: Element, math: MathLookup): string {
  const text = source.text;
  const open = s.open ? text.slice(s.open.start, s.open.end) : '';
  const close = s.close ? text.slice(s.close.start, s.close.end) : '';
  if (VOID.has(s.tag)) return open;
  if (RAW_TEXT.has(s.tag)) {
    const inner = innerRange(s);
    return open + (inner ? text.slice(inner.start, inner.end) : '') + close;
  }
  return open + serializeChildren(source, s, el, math) + close;
}

export function renderBlock(source: Source, block: Block, math: MathLookup): string {
  return serializeChildren(source, block.src, block.live, math);
}

// the range of an element removed on the page, with its line when nothing else is on it
function deletionRange(text: string, s: SrcEl): Range | null {
  if (!s.open) return null;
  let start = s.open.start;
  let end = s.close ? s.close.end : lastEnd(s);
  let a = start;
  while (a > 0 && (text[a - 1] === ' ' || text[a - 1] === '\t')) a--;
  let b = end;
  while (b < text.length && (text[b] === ' ' || text[b] === '\t')) b++;
  const lineStart = a === 0 || text[a - 1] === '\n';
  const lineEnd = b === text.length || text[b] === '\n' || text.startsWith('\r\n', b);
  if (lineStart && lineEnd) {
    start = a;
    end = b === text.length ? b : text[b] === '\n' ? b + 1 : b + 2;
  }
  return { start, end };
}

export type Edit = { start: number; end: number; text: string };
export type Rendered = { text: string; edits: Edit[]; changed: Block[]; warnings: string[] };

// the text of the file with the edits of the page. a block whose content differs from the file is
// replaced, a block removed from the page is removed, notes added to a slide without any are
// inserted before its end tag, and the start tag of an element in tags is written with its step
// or its translation
export function renderDeck(source: Source, pairing: Pairing, math: MathLookup, tags: Map<Element, TagEdit> = new Map()): Rendered {
  const edits: Edit[] = [];
  const changed: Block[] = [];
  const warnings: string[] = [];
  for (const [el, edit] of tags) {
    const s = pairing.elements.get(el);
    if (!s?.open || !el.isConnected) continue;
    const tag = renderTag(source.text, s.open, s.attrs, edit);
    if (tag !== null) edits.push({ start: s.open.start, end: s.open.end, text: tag });
  }
  for (const b of pairing.blocks) {
    const range = innerRange(b.src);
    if (!range) continue;
    if (!b.live.isConnected) {
      const d = deletionRange(source.text, b.src);
      if (d) {
        edits.push({ ...d, text: '' });
        changed.push(b);
      }
      continue;
    }
    const inner = renderBlock(source, b, math);
    if (inner !== source.text.slice(range.start, range.end)) {
      edits.push({ start: range.start, end: range.end, text: inner });
      changed.push(b);
    }
  }
  for (const { src, live } of pairing.sections) {
    for (const aside of live.querySelectorAll(':scope > aside.notes')) {
      if (pairing.byLive.has(aside)) continue;
      const inner = serializeNewChildren(source, aside, math);
      if (!inner.trim()) continue;
      if (!src.close) {
        warnings.push('the notes of a slide without an end tag are not saved');
        continue;
      }
      const eol = source.crlf ? '\r\n' : '\n';
      edits.push({ start: src.close.start, end: src.close.start, text: `  <aside class="notes">${inner}</aside>${eol}` });
    }
  }
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  for (let i = 1; i < edits.length; i++) {
    if (edits[i].end > edits[i - 1].start) throw new Error('two edits overlap in the file');
  }
  let text = source.text;
  for (const e of edits) text = text.slice(0, e.start) + e.text + text.slice(e.end);
  return { text, edits, changed, warnings };
}
