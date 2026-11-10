// the steps of a slide. a slide is marked with data-complete once every fragment is shown, so that
// the earlier fragments are not dimmed any more. a step without content is added after the last
// step of a slide that dims a fragment, hence the last fragment is first shown alone, and every
// fragment is restored at the added step. a fragment with data-final is shown last, at a step
// that restores every fragment, in place of the added one. a fragment with data-highlight
// colors the elements of the classes it names once it is shown, e.g. a symbol set with
// \class{name}{...} in MathJax, in orange or, with data-tone, in violet, blue, or red, and a fragment
// with data-unhighlight takes the color off the classes it names. a fragment with
// data-keep is held at full opacity through the next step, or through the step of its value, and a
// fragment is held as well while the current step highlights a class in it

import type { Deck } from './reveal.d.ts';

export type Tone = 'accent' | 'violet' | 'blue' | 'red';
const TONES: Tone[] = ['accent', 'violet', 'blue', 'red'];

/** A fragment of a slide, as read by resolve. */
export type Step = {
  index: number;
  visible: boolean;
  // the last index at which the fragment is held, 'next' for the index of the next step, and null without data-keep
  keep: number | 'next' | null;
  highlight: string[];
  unhighlight: string[];
  tone: Tone;
  // the highlighted classes of the slide that are found in the fragment
  holds: string[];
};

/**
 * The state of the steps of a slide at the step current, which is -1 before the first step:
 * whether each fragment is held at full opacity, and the tone of each highlighted class.
 */
export function resolve(steps: Step[], current: number): { held: boolean[]; lit: Map<string, Tone> } {
  const indices = [...new Set(steps.map((s) => s.index))].sort((a, b) => a - b);
  const lit = new Map<string, Tone>();
  // a later step wins over an earlier one
  const order = steps.map((_, i) => i).sort((a, b) => steps[a].index - steps[b].index);
  for (const i of order) {
    if (!steps[i].visible) continue;
    for (const name of steps[i].unhighlight) lit.delete(name);
    for (const name of steps[i].highlight) lit.set(name, steps[i].tone);
  }
  const named = new Set(steps.filter((s) => s.visible && s.index === current).flatMap((s) => s.highlight));
  const held = steps.map((s) => {
    if (!s.visible || s.index === current) return false;
    const through = s.keep === 'next' ? (indices.find((k) => k > s.index) ?? s.index) : s.keep;
    if (through !== null && current <= through) return true;
    return s.holds.some((name) => named.has(name));
  });
  return { held, lit };
}

const words = (s: string | null | undefined) => (s ?? '').split(/\s+/).filter(Boolean);

const hasContent = (f: Element) => f.children.length > 0 || (f.textContent ?? '').trim() !== '';

// a copy of a code box, made by the highlight plugin of reveal.js for each group of lines after the
// first. a copy is not dimmed as a past step, and the box is dimmed as a whole once a later step
// outside it is shown, see theme/beeson.css
const isCopy = (f: Element) => f.matches('pre > code.fragment');

/**
 * Appends the step that restores the dimmed fragments to every slide under root whose last step
 * dims a fragment with content, or a code box. A fragment without data-fragment-index is placed by
 * reveal.js after every indexed one, in the order of the page, hence the added step is the last of
 * its slide. A slide with a fragment marked data-final, e.g. a QR code shown once the text is
 * complete, is left without the added step, since its last step restores every fragment.
 */
export function addRestoreSteps(root: ParentNode): void {
  for (const slide of root.querySelectorAll<HTMLElement>('.reveal .slides section')) {
    if (slide.querySelector('section, .fragment[data-restore], .fragment[data-final]')) continue;
    const frags = [...slide.querySelectorAll<HTMLElement>('.fragment')];
    const unindexed = frags.filter((f) => !f.hasAttribute('data-fragment-index'));
    const last = unindexed.length
      ? [unindexed[unindexed.length - 1]]
      : frags.filter((f) => Number(f.dataset.fragmentIndex) === Math.max(...frags.map((g) => Number(g.dataset.fragmentIndex))));
    const boxes = new Set(frags.filter(isCopy).map((f) => f.parentElement));
    const dimsBox = [...boxes].some((box) => !last.some((f) => f.parentElement === box && isCopy(f)));
    if (!dimsBox && !frags.some((f) => !last.includes(f) && hasContent(f) && !isCopy(f))) continue;
    const restore = document.createElement('span');
    restore.className = 'fragment';
    restore.setAttribute('data-restore', '');
    restore.setAttribute('aria-hidden', 'true');
    slide.append(restore);
  }
}

/**
 * Marks a slide complete when every fragment is shown, marks its held fragments with data-held, and
 * colors the elements of its highlighted classes.
 */
export function applySteps(slide: Element): void {
  const frags = [...slide.querySelectorAll<HTMLElement>('.fragment')];
  if (!slide.querySelector('section')) slide.toggleAttribute('data-complete', frags.every((f) => f.classList.contains('visible')));
  const names = [...new Set(frags.flatMap((f) => words(f.dataset.highlight)))];
  if (!names.length && !frags.some((f) => f.hasAttribute('data-keep'))) return;
  const select = (name: string) => `.${CSS.escape(name)}`;
  const steps = frags.map((f): Step => {
    const keep = f.getAttribute('data-keep');
    return {
      index: Number(f.dataset.fragmentIndex ?? 0),
      visible: f.classList.contains('visible'),
      keep: keep === null ? null : keep.trim() === '' ? 'next' : Number(keep),
      highlight: words(f.dataset.highlight),
      unhighlight: words(f.dataset.unhighlight),
      tone: TONES.find((t) => t !== 'accent' && t === f.dataset.tone) ?? 'accent',
      holds: names.filter((name) => f.matches(select(name)) || f.querySelector(select(name))),
    };
  });
  const current = Math.max(-1, ...steps.filter((s) => s.visible).map((s) => s.index));
  const { held, lit } = resolve(steps, current);
  frags.forEach((f, i) => f.toggleAttribute('data-held', held[i]));
  const tones = new Map<Element, Tone | undefined>();
  for (const name of names) for (const el of slide.querySelectorAll(select(name))) tones.set(el, lit.get(name) ?? tones.get(el));
  for (const [el, tone] of tones) {
    el.classList.add('hl-target');
    for (const t of TONES) el.classList.toggle(`hl-${t}`, tone === t);
  }
}

/** Applies the steps of every slide under root, e.g. of the pages of the print view. */
export function applyAll(root: ParentNode): void {
  for (const slide of root.querySelectorAll('.reveal .slides section')) applySteps(slide);
}

// a symbol set with \class exists only once MathJax has typeset the page
export const typeset = (): Promise<unknown> => window.MathJax?.startup?.promise ?? Promise.resolve();

export function initSteps(deck: Deck): void {
  const mark = () => {
    const slide = deck.getCurrentSlide();
    if (slide) applySteps(slide);
  };
  for (const type of ['fragmentshown', 'fragmenthidden', 'slidechanged']) deck.on(type, mark);
  mark();
  void typeset().then(mark);
}

// a step that starts After Previous is shown by reveal.js a delay after the step before, with
// data-autoslide on a fragment of the step before. going back, as in PowerPoint and Keynote, a timed
// step does not play again by itself: Back skips the timed steps to the last step reached by a
// click, and the delay of the step it lands on is set aside in HELD until the step changes again
const AUTOSLIDE = 'data-autoslide';
const HELD = 'data-autoslide-held';

// a step of the deck: the index of its slide in getSlides and its fragment index, -1 before the first
type At = { slide: number; f: number };

// the fragment indices of the steps of a slide, -1 for the slide without a fragment shown
const stepsOf = (slide: Element): number[] => [-1, ...new Set([...slide.querySelectorAll<HTMLElement>('.fragment')].map((f) => Number(f.dataset.fragmentIndex)).filter(Number.isFinite))].sort((a, b) => a - b);
const fragmentsAt = (slide: Element, f: number) => [...slide.querySelectorAll<HTMLElement>('.fragment')].filter((el) => Number(el.dataset.fragmentIndex) === f);
const delayed = (el: Element) => (parseInt(el.getAttribute(AUTOSLIDE) ?? el.getAttribute(HELD) ?? '', 10) || 0) > 0;

/** Keeps Back from playing a timed step again in a deck shown without the editor. */
export function initTimedSteps(deck: Deck): void {
  const slides = () => deck.getSlides();
  const here = (): At => {
    const slide = deck.getCurrentSlide();
    const shown = [...slide.querySelectorAll<HTMLElement>('.fragment.visible')].map((f) => Number(f.dataset.fragmentIndex)).filter(Number.isFinite);
    return { slide: slides().indexOf(slide), f: Math.max(-1, ...shown) };
  };
  // the step before at, or null for the first step of the deck
  const before = (at: At): At | null => {
    const steps = stepsOf(slides()[at.slide]);
    const k = steps.indexOf(at.f);
    if (k > 0) return { slide: at.slide, f: steps[k - 1] };
    const prev = slides()[at.slide - 1];
    return prev ? { slide: at.slide - 1, f: stepsOf(prev).at(-1)! } : null;
  };
  const delayedAt = (at: At | null) => !!at && at.f >= 0 && fragmentsAt(slides()[at.slide], at.f).some(delayed);
  const same = (a: At | null, b: At | null) => !!a && !!b && a.slide === b.slide && a.f === b.f;

  let last = here();
  let held: Element[] = [];
  // reveal.js pauses every delay of the deck at an input while a delay runs. a pause by the input
  // of a Back is taken back, and a pause with the key A of reveal.js is kept
  let paused = false;
  deck.on('autoslidepaused', () => {
    paused = true;
    setTimeout(() => (paused = false), 0);
  });
  const change = () => {
    const now = here();
    if (same(now, last)) return;
    for (const el of held) {
      el.setAttribute(AUTOSLIDE, el.getAttribute(HELD) ?? '');
      el.removeAttribute(HELD);
    }
    held = [];
    const from = last;
    last = now;
    const back = now.slide < from.slide || (now.slide === from.slide && now.f < from.f);
    if (!back || deck.isOverview()) return;
    if (delayedAt(now)) {
      held = fragmentsAt(slides()[now.slide], now.f).filter((el) => el.hasAttribute(AUTOSLIDE));
      for (const el of held) {
        el.setAttribute(HELD, el.getAttribute(AUTOSLIDE)!);
        el.removeAttribute(AUTOSLIDE);
      }
    }
    if (paused) {
      paused = false;
      deck.toggleAutoSlide(true);
    }
    // the delay of the step may have been started before this event, and it is cued again without it
    (deck as Deck & { cueAutoSlide?: () => void }).cueAutoSlide?.();
    if (!delayedAt(now)) return;
    // a step reached by the delay of the step before is skipped after one step back
    if (same(before(from), now) && delayedAt(before(now))) setTimeout(() => deck.prev(), 0);
  };
  for (const type of ['fragmentshown', 'fragmenthidden', 'slidechanged']) deck.on(type, change);
}
