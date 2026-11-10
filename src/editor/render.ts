// the pairing of the blocks of text in the file with their elements on the page, and the text of
// the file with the edits of the page written into it. a block is an element whose content is
// edited in place, e.g. a heading, a paragraph, a list item, a cell, a caption, or the notes, and
// the outermost such element is paired, since the elements inside it are written with it. every
// byte outside an edited block is copied from the file

import { RAW_TEXT, type Range } from './tokens.ts';
import { VOID, contentRange, elementRange, isFragmentRoot, lastEnd, rawRange, type Piece, type Source, type SrcComment, type SrcEl, type SrcNode, type SrcText } from './source.ts';
import type { MathInfo, MathLookup } from './math.ts';
import { mergeEdit, renderTag, stateOf, type TagEdit } from './tags.ts';
import { indentAt, placeLead, spaceOf, unitsOf, type Child, type Unit } from './model/units.ts';
import { textStyle } from './model/templates.ts';

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
// elements maps every element of the page that was found in the file, block or not, to its bytes,
// inner maps the elements inside the blocks, and root is the div.slides of the page
export type Pairing = {
  blocks: Block[];
  byLive: Map<Element, Block>;
  elements: Map<Element, SrcEl>;
  inner: Map<Element, SrcEl>;
  sections: { src: SrcEl; live: Element }[];
  problems: Problem[];
  root: Element | null;
};

// pairs the blocks of the file with the page. outside a block, the elements of the file are found
// on the page in order, and an element added on the page, e.g. a canvas of a backdrop or an item of
// the outline, is passed over. inside a block, the page must read as the file, else the block is a
// problem and is not edited
export function pair(source: Source, liveSlides: Element, math: MathLookup): Pairing {
  const out: Pairing = { blocks: [], byLive: new Map(), elements: new Map(), inner: new Map(), sections: [], problems: [], root: liveSlides };
  out.elements.set(liveSlides, source.slides);
  pairChildren(source.slides, liveSlides, null, math, out);
  return out;
}

function blocksWithin(s: SrcEl): SrcEl[] {
  if (isBlock(s)) return [s];
  return s.children.flatMap((c) => (c.kind === 'element' ? blocksWithin(c) : []));
}

// an element made at run time, e.g. a running head of chrome.ts, which is never in the file
const generated = (el: Element) => el.hasAttribute('data-generated');

function pairChildren(src: SrcEl, live: Element, slide: Element | null, math: MathLookup, out: Pairing): void {
  const items = virtualChildren(live, math);
  let j = 0;
  for (const s of src.children) {
    if (s.kind !== 'element') continue;
    let k = j;
    while (k < items.length && !(items[k].kind === 'element' && sameTag((items[k] as { el: Element }).el, s) && !generated((items[k] as { el: Element }).el))) k++;
    if (k === items.length) {
      for (const b of blocksWithin(s)) out.problems.push({ slide, tag: b.tag, reason: 'it is not on the page' });
      continue;
    }
    j = k + 1;
    pairElement(s, (items[k] as { el: Element }).el, slide, math, out);
  }
}

// pairs s with el and the elements inside them. slide is the slide around el, if any
export function pairElement(s: SrcEl, el: Element, slide: Element | null, math: MathLookup, out: Pairing): void {
  out.elements.set(el, s);
  const here = s.tag === 'section' ? el : slide;
  if (s.tag === 'section') out.sections.push({ src: s, live: el });
  if (isBlock(s)) {
    const reason = verify(s, el, math, out.inner);
    if (reason) out.problems.push({ slide: here, tag: s.tag, reason });
    else {
      const block = { src: s, live: el, slide: here };
      out.blocks.push(block);
      out.byLive.set(el, block);
    }
  } else pairChildren(s, el, here, math, out);
}

// checks that el reads as s, part for part, and records on each text node of s how the page
// splits it into text and formulas
function verify(s: SrcEl, el: Element, math: MathLookup, inner?: Map<Element, SrcEl>): string | null {
  const items = virtualChildren(el, math);
  const kids = s.children;
  if (items.length !== kids.length) return `the ${s.tag} has ${kids.length} parts in the file and ${items.length} on the page`;
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i], it = items[i];
    if (k.kind === 'element') {
      if (it.kind !== 'element' || !sameTag(it.el, k)) return `a ${k.tag} of the file is not on the page`;
      const reason = verify(k, it.el, math, inner);
      if (reason) return reason;
      inner?.set(it.el, k);
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
function serializeChildren(source: Source, s: SrcEl, el: Element, math: MathLookup, tags: Map<Element, TagEdit>): string {
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
        parts.push(serializeElement(source, kids[k] as SrcEl, it.el, math, tags));
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

// the classes put on an element at run time by the editor, reveal.js, and the theme, e.g. hl-target
// on a span colored at a step, which are not written into the file
const RUNTIME_PREFIX = /^(beeson-|hl-|plot-)/;
const RUNTIME_CLASSES = new Set(['visible', 'current-fragment', 'present', 'past', 'future', 'disabled', 'enabled', 'stack']);
export const isRuntimeClass = (c: string): boolean => RUNTIME_PREFIX.test(c) || RUNTIME_CLASSES.has(c);
// the declarations and the attributes of an element inside a block that are compared with the
// file, i.e. those that the editor writes under the scope rule
const LIVE_STYLE = ['translate', 'rotate', 'width', 'font-size', 'text-align'];
const LIVE_ATTRS = ['alt', 'src', 'poster', 'href', 'muted', 'loop', 'colspan', 'rowspan'];

let probe: HTMLElement | null = null;

// the changes of an element inside a block on the page, against its start tag in the file. the
// declarations of the file are read by the browser as those of the page are, so that a value is
// compared in one spelling
function liveEdit(s: SrcEl, el: Element): TagEdit {
  const file = stateOf(s.attrs);
  const edit: TagEdit = {};
  const live = [...el.classList].filter((c) => !isRuntimeClass(c));
  const classes: Record<string, boolean> = {};
  for (const c of live) if (!file.classes.includes(c)) classes[c] = true;
  for (const c of file.classes) if (!live.includes(c)) classes[c] = false;
  if (Object.keys(classes).length) edit.classes = classes;
  const style = (el as HTMLElement).style;
  if (style) {
    probe ??= document.createElement('div');
    probe.setAttribute('style', file.attrs.style ?? '');
    const decls: Record<string, string | null> = {};
    for (const name of LIVE_STYLE) {
      const now = style.getPropertyValue(name);
      if (now !== probe.style.getPropertyValue(name)) decls[name] = now || null;
    }
    if (Object.keys(decls).length) edit.style = decls;
  }
  const attrs: Record<string, string | null> = {};
  for (const name of LIVE_ATTRS) {
    const now = el.getAttribute(name);
    if (now !== (file.attrs[name] ?? null)) attrs[name] = now;
  }
  if (Object.keys(attrs).length) edit.attrs = attrs;
  return edit;
}

// an element inside a block, with its start tag written again when it was changed on the page or
// by a tag edit, which is applied here since the block is one splice of the file
function serializeElement(source: Source, s: SrcEl, el: Element, math: MathLookup, tags: Map<Element, TagEdit>): string {
  const text = source.text;
  let open = s.open ? text.slice(s.open.start, s.open.end) : '';
  if (s.open) open = renderTag(text, s.open, s.attrs, mergeEdit(liveEdit(s, el), tags.get(el) ?? {})) ?? open;
  const close = s.close ? text.slice(s.close.start, s.close.end) : '';
  if (VOID.has(s.tag)) return open;
  if (RAW_TEXT.has(s.tag)) {
    const inner = innerRange(s);
    return open + (inner ? text.slice(inner.start, inner.end) : '') + close;
  }
  return open + serializeChildren(source, s, el, math, tags) + close;
}

export function renderBlock(source: Source, block: Block, math: MathLookup, tags: Map<Element, TagEdit> = new Map()): string {
  return serializeChildren(source, block.src, block.live, math, tags);
}

export type Edit = { start: number; end: number; text: string };
export type Rendered = { text: string; edits: Edit[]; changed: Block[]; warnings: string[] };

// the elements taken off the page by the document model, see model/doc.ts, whose units are left out
// of the file. an element taken off the page otherwise, e.g. by a script of the theme, is kept
export const detached = new WeakSet<Element>();

type Kid = { child: Child; node: SrcNode };

// the children of s with their ranges, without an element that has no bytes in the file
function kidsOf(s: SrcEl): Kid[] {
  const out: Kid[] = [];
  for (const c of s.children) {
    const range = c.kind === 'element' ? elementRange(c) : c.range;
    if (range) out.push({ child: { kind: c.kind, start: range.start, end: range.end }, node: c });
  }
  return out;
}

// the units of the content of s, with the element of each
export function unitsWithin(s: SrcEl): { units: (Unit & { el: SrcEl })[]; tail: Range } | null {
  const range = contentRange(s);
  if (!range) return null;
  const kids = kidsOf(s);
  const { units, tail } = unitsOf(s.source.text, kids.map((k) => k.child), range);
  return { units: units.map((u) => ({ ...u, el: kids[u.child].node as SrcEl })), tail };
}

// the unit of s in its parent, i.e. its lead, its range, and the end of its marker pair
export function unitOf(s: SrcEl): Unit | null {
  if (!s.parent) return null;
  return unitsWithin(s.parent)?.units.find((u) => u.el === s) ?? null;
}

// the white space before a unit placed into s: that of the first unit of s, else a line break and
// the indentation of s with one step more
export function childSpace(s: SrcEl, eol: string, step: string): string {
  const first = unitsWithin(s)?.units[0];
  if (first) return spaceOf(s.source.text.slice(first.lead.start, first.range.start));
  return eol + (s.open ? indentAt(s.source.text, s.open.start) : '') + step;
}

// the file written again from the page. each element of the file is written as its units, in the
// order of its children on the page: a unit of the file with its lead, a unit moved in from another
// element or inserted on the page with the white space of this one, and a unit taken off the page
// left out. an element of the file that is not on the page is kept where it was, an element made
// at run time is passed over, and a block is written by serializeChildren. every other byte is
// copied, hence the text of an unchanged page is the file byte for byte
class Renderer {
  readonly edits: Edit[] = [];
  readonly changed: Block[] = [];
  readonly warnings: string[] = [];
  private readonly liveOf = new Map<SrcEl, Element>();
  private readonly eol: string;
  private step: string | null = null;
  private readonly source: Source;
  private readonly pairing: Pairing;
  private readonly math: MathLookup;
  private readonly tags: Map<Element, TagEdit>;

  constructor(source: Source, pairing: Pairing, math: MathLookup, tags: Map<Element, TagEdit>) {
    this.source = source;
    this.pairing = pairing;
    this.math = math;
    this.tags = tags;
    for (const [el, s] of pairing.elements) this.liveOf.set(s, el);
    this.eol = source.crlf ? '\r\n' : '\n';
  }

  element(s: SrcEl, live: Element | undefined): string {
    const text = s.source.text;
    const range = elementRange(s);
    if (!range) return '';
    if (!live) return text.slice(range.start, range.end);
    const open = this.open(s, live);
    const close = s.close ? text.slice(s.close.start, s.close.end) : '';
    const inner = contentRange(s);
    const verbatim = inner ? text.slice(inner.start, inner.end) : '';
    if (VOID.has(s.tag)) return open;
    if (RAW_TEXT.has(s.tag)) return open + verbatim + close;
    const block = this.pairing.byLive.get(live);
    if (block?.src === s) {
      const content = serializeChildren(s.source, s, live, this.math, this.tags);
      if (content !== verbatim) {
        this.edits.push({ start: inner?.start ?? range.start, end: inner?.end ?? range.start, text: content });
        this.changed.push(block);
      }
      return open + content + close;
    }
    // a block that the page does not read as the file is copied
    if (isBlock(s)) return open + verbatim + close;
    return open + this.content(s, live) + close;
  }

  private open(s: SrcEl, live: Element): string {
    if (!s.open) return '';
    const raw = s.source.text.slice(s.open.start, s.open.end);
    const edit = this.tags.get(live);
    const tag = edit ? renderTag(s.source.text, s.open, s.attrs, edit) : null;
    if (tag === null) return raw;
    this.edits.push({ start: s.open.start, end: s.open.end, text: tag });
    return tag;
  }

  // a unit is left out when its element was taken off the page by the document model, moved into
  // another element, also one taken off the page, or is a block deleted on the page
  private dropped(s: SrcEl, node: Element): boolean {
    if (detached.has(node) || node.parentNode) return true;
    return this.pairing.byLive.get(node)?.src === s;
  }

  // the indentation of the line of the start tag of s, and one step of the file
  private indent(s: SrcEl): string {
    return s.open ? indentAt(s.source.text, s.open.start) : '';
  }

  private stepOf(): string {
    return (this.step ??= textStyle(this.source.text).step);
  }

  private space(s: SrcEl): string {
    return childSpace(s, this.eol, this.stepOf());
  }

  private content(s: SrcEl, live: Element): string {
    const text = s.source.text;
    const within = unitsWithin(s);
    const units = within?.units ?? [];
    const own = new Map(units.map((u) => [u.el, u]));
    // a unit of the file that is not on the page is kept after the unit of the file before it
    const kept = new Map<SrcEl | null, Unit[]>();
    let anchor: SrcEl | null = null;
    let changed = false;
    for (const u of units) {
      const node = this.liveOf.get(u.el);
      if (node?.parentElement === live) anchor = u.el;
      else if (node && this.dropped(u.el, node)) changed = true;
      else kept.set(anchor, [...(kept.get(anchor) ?? []), u]);
    }
    const parts: string[] = [];
    const keep = (key: SrcEl | null) => {
      for (const u of kept.get(key) ?? []) parts.push(text.slice(u.lead.start, u.end));
    };
    keep(null);
    const notes: Element[] = [];
    let order = -1;
    for (const c of live.children) {
      const m = this.pairing.elements.get(c);
      if (!m) {
        if (s.tag === 'section' && c.matches('aside.notes') && !generated(c)) notes.push(c);
        continue;
      }
      const u = own.get(m);
      if (u) {
        if (units.indexOf(u) < order) changed = true;
        order = units.indexOf(u);
        parts.push(text.slice(u.lead.start, u.range.start) + this.element(m, c) + text.slice(u.range.end, u.end));
        keep(m);
        continue;
      }
      const home = unitOf(m);
      if (!home) continue;
      changed = true;
      const mt = m.source.text;
      const lead = mt.slice(home.lead.start, home.range.start);
      const inPlace = isFragmentRoot(m) && m.source.fragment?.home === live;
      parts.push((inPlace ? lead : placeLead(lead, this.space(s), this.eol)) + this.element(m, c) + mt.slice(home.range.end, home.end));
    }
    let tail = within ? text.slice(within.tail.start, within.tail.end) : '';
    if (!units.length && !tail && parts.length) tail = this.eol + this.indent(s);
    let out = parts.join('') + tail;
    for (const aside of notes) {
      const inner = serializeNewChildren(this.source, aside, this.math);
      if (!inner.trim()) continue;
      if (!s.close) {
        this.warnings.push('the notes of a slide without an end tag are not saved');
        continue;
      }
      out += `  <aside class="notes">${inner}</aside>${this.eol}`;
      changed = true;
    }
    const range = contentRange(s);
    if (changed && range) this.edits.push({ ...range, text: out });
    return out;
  }
}

// the text of the file with the edits of the page: the content of the blocks, the start tags in
// tags, the notes added to a slide, and the slides and elements inserted, removed, and moved
export function renderDeck(source: Source, pairing: Pairing, math: MathLookup, tags: Map<Element, TagEdit> = new Map()): Rendered {
  const r = new Renderer(source, pairing, math, tags);
  const range = elementRange(source.slides);
  let text = source.text;
  if (range && pairing.root) text = text.slice(0, range.start) + r.element(source.slides, pairing.root) + text.slice(range.end);
  return { text, edits: r.edits, changed: r.changed, warnings: r.warnings };
}

// the text of one element of the page with its edits, and the lead and the end of the marker pair
// of its unit in the text that it was read from
export function renderUnit(pairing: Pairing, math: MathLookup, tags: Map<Element, TagEdit>, el: Element, source: Source): { lead: string; body: string; trail: string } | null {
  const s = pairing.elements.get(el);
  if (!s) return null;
  const u = unitOf(s);
  const text = s.source.text;
  const body = new Renderer(source, pairing, math, tags).element(s, el);
  if (!u) return { lead: '', body, trail: '' };
  return { lead: text.slice(u.lead.start, u.range.start), body, trail: text.slice(u.range.end, u.end) };
}
