// the transition of a slide, as in the Animate inspector of Keynote, limited by the scope rule of
// the plan to None, Fade, and Magic Move. the transition of a slide is played when the show leaves
// it for the next slide. Fade is the default of the theme (transition: 'fade' in src/main.ts),
// hence it is written as the absence of data-transition, and None as data-transition="none".
// Magic Move is the auto-animate of reveal.js: data-auto-animate on the slide and on the next one,
// and the same data-id on each pair of matched elements

import type { App } from '../app.ts';

export type Transition = 'none' | 'fade' | 'magic';

const slidesOf = (app: App): Element[] => [...app.slides().querySelectorAll(':scope > section')];

// the slide after slide in the show, without the hidden ones
export function nextShown(app: App, slide: Element): Element | null {
  const list = slidesOf(app);
  return list.slice(list.indexOf(slide) + 1).find((s) => s.getAttribute('data-visibility') !== 'hidden') ?? null;
}

function previousShown(app: App, slide: Element): Element | null {
  const list = slidesOf(app);
  return list.slice(0, Math.max(0, list.indexOf(slide))).reverse().find((s) => s.getAttribute('data-visibility') !== 'hidden') ?? null;
}

const magic = (s: Element | null): boolean => !!s?.hasAttribute('data-auto-animate');

// the transition of slide, or null for an effect of reveal.js outside the scope, e.g. slide
export function transitionOf(app: App, slide: Element): Transition | null {
  if (magic(slide) && magic(nextShown(app, slide))) return 'magic';
  const t = slide.getAttribute('data-transition');
  if (t === null || t === '' || t === 'fade') return 'fade';
  if (t === 'none') return 'none';
  return null;
}

// a slide and its file element are paired, with a start tag that the document model can write
export function paired(app: App, el: Element): boolean {
  const s = app.pairing?.elements.get(el) ?? app.pairing?.inner.get(el);
  return !!s?.open;
}

// the elements of a slide that Magic Move matches: its heading and its figures, the outermost of
// each nest, outside the notes
const FIGURES = 'img, video, figure, .zone, .plate, .qr, tycho-viewer, div.math, table, pre, .backdrop, .surface';

export function candidates(slide: Element): Element[] {
  const heading = [...slide.querySelectorAll('h1, h2')].find((h) => !h.closest('aside.notes'));
  const figures = [...slide.querySelectorAll(FIGURES)].filter((el) => !el.closest('aside.notes') && !el.parentElement?.closest(FIGURES));
  return heading ? [heading, ...figures.filter((f) => !f.contains(heading))] : figures;
}

// the key under which an element is matched with an element of the other slide: a heading by its
// tag, a picture by its source, a QR code by its text, and a backdrop by its drawing
export function keyOf(el: Element): string {
  const tag = el.localName;
  if (tag === 'h1' || tag === 'h2') return 'heading';
  const media = el.matches('img, video, tycho-viewer') ? el : el.querySelector('img, video, tycho-viewer');
  if (media) return `media:${media.getAttribute('src') ?? ''}`;
  if (el.matches('.qr')) return `qr:${el.getAttribute('data-qr') ?? ''}`;
  if (el.matches('.backdrop')) return `backdrop:${el.getAttribute('data-scene') ?? el.getAttribute('data-strands') ?? ''}`;
  if (el.matches('.surface')) return `surface:${el.getAttribute('data-function') ?? ''}`;
  const kind = ['zone', 'plate', 'math'].find((c) => el.classList.contains(c));
  return kind ? `${kind}:${(el.querySelector('[data-plot]') ?? el).getAttribute('data-plot') ?? ''}` : tag;
}

// the pairs of elements of a and b with the same key, each element in one pair at most, and a pair
// of elements with the same data-id first
export function matchPairs(a: Element, b: Element): [Element, Element][] {
  const left = candidates(a);
  const right = candidates(b);
  const used = new Set<Element>();
  const pairs: [Element, Element][] = [];
  for (const x of left) {
    const id = x.getAttribute('data-id');
    const y = (id ? right.find((r) => !used.has(r) && r.getAttribute('data-id') === id) : undefined) ?? right.find((r) => !used.has(r) && keyOf(r) === keyOf(x));
    if (!y) continue;
    used.add(y);
    pairs.push([x, y]);
  }
  return pairs;
}

// a data-id that is not on the page or in the file, as magic-1, magic-2, and so on
export function freshId(app: App, taken: Set<string> = new Set()): string {
  const text = app.source?.text ?? '';
  for (let i = 1; ; i++) {
    const id = `magic-${i}`;
    if (!taken.has(id) && !document.querySelector(`[data-id="${id}"]`) && !text.includes(`data-id="${id}"`)) return id;
  }
}

// each element of slide that Magic Move matches gets a data-id, unless it has one, so that a
// duplicate of the slide is matched with it
export function markForMagic(app: App, slide: Element): void {
  const taken = new Set<string>();
  for (const el of candidates(slide)) {
    if (el.getAttribute('data-id') || !paired(app, el)) continue;
    const id = freshId(app, taken);
    taken.add(id);
    app.doc.setTag(el, { attrs: { 'data-id': id } }, 'data-id');
  }
}

// each pair of matched elements of a and b is given one data-id, kept from either element when it
// has one
function linkPairs(app: App, a: Element, b: Element): void {
  const taken = new Set<string>();
  for (const [x, y] of matchPairs(a, b)) {
    if (!paired(app, x) || !paired(app, y)) continue;
    const id = x.getAttribute('data-id') || y.getAttribute('data-id') || freshId(app, taken);
    taken.add(id);
    if (x.getAttribute('data-id') !== id) app.doc.setTag(x, { attrs: { 'data-id': id } }, 'data-id');
    if (y.getAttribute('data-id') !== id) app.doc.setTag(y, { attrs: { 'data-id': id } }, 'data-id');
  }
}

const setMagic = (app: App, s: Element, on: boolean) => {
  if (magic(s) !== on) app.doc.setTag(s, { attrs: { 'data-auto-animate': on ? '' : null } }, 'auto-animate');
};

// sets the transition of slide, in the history transaction of the caller. a slide keeps
// data-auto-animate while the slide before it moves into it by Magic Move, and the next slide
// loses it when it is not moved into the slide after it
export function setTransition(app: App, slide: Element, t: Transition): void {
  const next = nextShown(app, slide);
  if (t === 'magic') {
    if (!next) throw new Error('Magic Move needs a slide after this one');
    setMagic(app, slide, true);
    setMagic(app, next, true);
    linkPairs(app, slide, next);
    return;
  }
  const value = t === 'none' ? 'none' : null;
  if (slide.getAttribute('data-transition') !== value && !(value === null && !slide.hasAttribute('data-transition'))) {
    app.doc.setTag(slide, { attrs: { 'data-transition': value } }, 'transition');
  }
  if (transitionOf(app, slide) === 'magic' || magic(slide)) {
    if (!magic(previousShown(app, slide))) setMagic(app, slide, false);
    if (next && magic(next) && !magic(nextShown(app, next))) setMagic(app, next, false);
  }
}

// Magic Move set up as in Keynote: the slide is duplicated after itself, and the two are joined by
// Magic Move, with the same data-id on each matched element. the copy is returned, for the caller
// to show, and its elements are then moved by hand
export async function magicMoveCopy(app: App, slide: Element): Promise<Element> {
  markForMagic(app, slide);
  setMagic(app, slide, true);
  return app.doc.duplicate(slide);
}
