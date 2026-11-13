// a fragment is new content inserted on the page, e.g. a slide or an element, read from its own
// text in the same way as the file. its text is the unit of the new element, i.e. its lead, the
// element, and the end comment of a marker pair. the text is wrapped in an element of class slides
// that its root may be a child of, and its root is paired with the element of the page, so that it
// is written by the renderer like an element of the file

import { parseSource, type Source, type SrcEl } from '../source.ts';
import { pairElement, type Pairing } from '../render.ts';
import type { MathLookup } from '../math.ts';

// the wrapper of a root, by its tag. a row and a cell are parsed only inside a table
const WRAPPERS: [Set<string>, string, string][] = [
  [new Set(['tr']), '<table><tbody class="slides">', '</tbody></table>'],
  [new Set(['td', 'th']), '<table><tbody><tr class="slides">', '</tr></tbody></table>'],
  [new Set(['thead', 'tbody', 'tfoot', 'caption', 'colgroup']), '<table class="slides">', '</table>'],
];
const DEFAULT: [string, string] = ['<div class="reveal"><div class="slides">', '</div></div>'];

// the tag of the first element of a text, after its white space and comments
export function rootTag(text: string): string | null {
  return /^(?:\s|<!--[\s\S]*?-->)*<([a-zA-Z][\w-]*)/.exec(text)?.[1].toLowerCase() ?? null;
}

// the source of a fragment. crlf is that of the file, and home is the element of the page that the
// fragment is inserted into, where its lead is kept
export function parseFragment(text: string, crlf: boolean, home: Element | null): Source {
  const tag = rootTag(text);
  if (!tag) throw new Error('the new content does not start with an element');
  const wrapper = WRAPPERS.find(([tags]) => tags.has(tag));
  const [open, close] = wrapper ? [wrapper[1], wrapper[2]] : DEFAULT;
  const source = parseSource(open + text + close);
  source.crlf = crlf;
  source.fragment = { home };
  if (!fragmentRoot(source)) throw new Error(`the new ${tag} is not read as one element`);
  return source;
}

export function fragmentRoot(source: Source): SrcEl | null {
  return (source.slides.children.find((c) => c.kind === 'element') as SrcEl | undefined) ?? null;
}

const emptyPairing = (): Pairing => ({ blocks: [], byLive: new Map(), elements: new Map(), inner: new Map(), sections: [], problems: [], root: null });

// the pairing of the root of a fragment with the element of the page made from it
export function pairFragment(source: Source, live: Element, math: MathLookup): Pairing {
  const root = fragmentRoot(source);
  if (!root) throw new Error('the fragment does not have an element');
  const out = emptyPairing();
  pairElement(root, live, live.parentElement?.closest('section') ?? null, math, out);
  return out;
}

// the pairing of a fragment added to the pairing of the deck, with the slides in the order of the page
export function mergePairing(into: Pairing, from: Pairing): void {
  into.blocks.push(...from.blocks);
  for (const [k, v] of from.byLive) into.byLive.set(k, v);
  for (const [k, v] of from.elements) into.elements.set(k, v);
  for (const [k, v] of from.inner) into.inner.set(k, v);
  into.sections.push(...from.sections);
  into.sections.sort((a, b) => (a.live.compareDocumentPosition(b.live) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  into.problems.push(...from.problems);
}
