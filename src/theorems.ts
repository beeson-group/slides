// the theorems of a deck. a theorem is a paragraph of the class theorem with its kind in data-kind,
// e.g. lemma, and an optional name in data-name. its head, e.g. Lemma 2 (stable manifold)., is
// written into data-head and the style of its kind into data-style, and both are drawn by
// theme/beeson.css. the kinds are the usual ones and those of the tex.js of the deck

import { kindsOf, type Kind, type Style } from './kinds.ts';

export type Head = { head: string; style: Style; missing: boolean };

/**
 * The heads of the theorems of a deck, in the order of its slides. A kind with a counter is numbered
 * through the deck, a theorem that is not counted, e.g. on a hidden slide, does not have a number,
 * and a theorem of a kind that is not defined is headed by the name of the kind.
 */
export function theoremHeads(theorems: { kind: string; name?: string; counted?: boolean }[], kinds: Record<string, Kind>): Head[] {
  const count = new Map<string, number>();
  return theorems.map(({ kind: name, name: note, counted = true }) => {
    const kind = Object.hasOwn(kinds, name) ? kinds[name] : null;
    if (!kind) return { head: `${name}.`, style: 'plain', missing: true };
    // as the optional argument of a proof in amsthm, the name of a proof is written in place of Proof
    if (name === 'proof' && note) return { head: `${note}.`, style: kind.style, missing: false };
    let number = '';
    if (kind.counter !== null && counted) {
      count.set(kind.counter, (count.get(kind.counter) ?? 0) + 1);
      number = ` ${count.get(kind.counter)}`;
    }
    return { head: `${kind.title}${number}${note ? ` (${note})` : ''}.`, style: kind.style, missing: false };
  });
}

/**
 * Writes the head and the style of every theorem of the deck. In the print view, the theorems are
 * numbered before the pages of a slide are cloned, since each clone would be counted.
 */
export function numberTheorems(): void {
  const tex = (window as unknown as { beesonTex?: { theorems?: Record<string, Kind> } }).beesonTex;
  const theorems = [...document.querySelectorAll<HTMLElement>('.reveal .slides p.theorem')];
  const heads = theoremHeads(
    theorems.map((p) => ({ kind: p.dataset.kind || 'theorem', name: p.dataset.name, counted: !p.closest('section[data-visibility="hidden"]') })),
    kindsOf(tex?.theorems ?? {}),
  );
  theorems.forEach((p, k) => {
    const { head, style, missing } = heads[k];
    if (p.dataset.head !== head) p.dataset.head = head;
    if (p.dataset.style !== style) p.dataset.style = style;
    p.toggleAttribute('data-missing', missing);
  });
}
