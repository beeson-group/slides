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

