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

import type { Deck, SlideEvent } from './reveal.d.ts';

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

// a slide whose last step dims the steps before it and moves on by a delay, see addRestoreSteps
const MOVES_ON = 'data-moves-on';

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
 * complete, is left without the added step, since its last step restores every fragment. A slide
 * whose last step has a delay is left without it too and marked with data-moves-on, since the
 * delay moves on to the next slide, and the slide keeps the look of its last step through the
 * transition, as in PowerPoint.
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
    if (last.some(delayed)) {
      slide.setAttribute(MOVES_ON, '');
      continue;
    }
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
  if (!slide.querySelector('section')) slide.toggleAttribute('data-complete', !slide.hasAttribute(MOVES_ON) && frags.every((f) => f.classList.contains('visible')));
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
  // reveal.js takes current-fragment off every fragment of a slide it leaves forward, hence the
  // last step of a slide marked data-moves-on is current again for the transition
  deck.on('slidechanged', (event) => {
    const { previousSlide: from, currentSlide: to } = event as SlideEvent;
    if (!from?.hasAttribute(MOVES_ON) || !to || deck.getSlides().indexOf(to) < deck.getSlides().indexOf(from)) return;
    const frags = [...from.querySelectorAll<HTMLElement>('.fragment')];
    const last = Math.max(...frags.map((f) => Number(f.dataset.fragmentIndex)).filter(Number.isFinite));
    for (const f of frags) if (Number(f.dataset.fragmentIndex) === last) f.classList.add('current-fragment');
  });
}

// a step that starts After Previous is shown by reveal.js a delay after the step before, with
// data-autoslide on a fragment of the step before. as in PowerPoint and Keynote, a key during a
// delay shows the next step at once, and the later delays still play. going back, a timed step
// does not play again by itself: Back skips the steps reached by a delay to the last step reached
// by a key, and the delay of the step it lands on is set aside in HELD until the step changes again
const AUTOSLIDE = 'data-autoslide';
const HELD = 'data-autoslide-held';

// a step of the deck: the index of its slide in getSlides and its fragment index, -1 before the first
type At = { slide: number; f: number };

// the fragment indices of the steps of a slide, -1 for the slide without a fragment shown
const stepsOf = (slide: Element): number[] => [-1, ...new Set([...slide.querySelectorAll<HTMLElement>('.fragment')].map((f) => Number(f.dataset.fragmentIndex)).filter(Number.isFinite))].sort((a, b) => a - b);
const fragmentsAt = (slide: Element, f: number) => [...slide.querySelectorAll<HTMLElement>('.fragment')].filter((el) => Number(el.dataset.fragmentIndex) === f);
const delayed = (el: Element) => (parseInt(el.getAttribute(AUTOSLIDE) ?? el.getAttribute(HELD) ?? '', 10) || 0) > 0;

/** The object of reveal.js that its controllers call, which is passed to the init of a plugin. */
export type Internal = { cueAutoSlide(): void };

/**
 * Plays the timed steps of a deck shown without the editor as PowerPoint and Keynote play them.
 * forDeck tells whether a key press is for the deck, rather than for a field, and internal is the
 * object of reveal.js that its keyboard calls at the end of a key.
 */
export function initTimedSteps(deck: Deck, forDeck: (ev: KeyboardEvent) => boolean, internal: Internal): void {
  // both are read by reveal.js at each input and at the end of each delay. without
  // autoSlideStoppable, an input does not pause the delays, and the key A of reveal.js is bound
  // here in its place. reveal.js moves the deck on at the end of a delay with autoSlideMethod
  const config = deck.getConfig();
  const method = config.autoSlideMethod;
  let timer = false;
  config.autoSlideStoppable = false;
  config.autoSlideMethod = () => {
    timer = true;
    try {
      if (typeof method === 'function') method();
      else deck.next();
    } finally {
      timer = false;
    }
  };
  deck.addKeyBinding({ keyCode: 65, key: 'A', description: 'Pause and resume the timed steps' }, (ev: KeyboardEvent) => {
    if (forDeck(ev)) deck.toggleAutoSlide(!deck.isAutoSliding());
  });
  // reveal.js starts the delay of the step again at the end of every key. as in PowerPoint and
  // Keynote, a key that does nothing to the show, e.g. D, leaves the running delay alone, hence the
  // delay is cued at a key only when the step, the overview, or the pause has changed
  const cue = internal.cueAutoSlide.bind(internal);
  const state = () => {
    const { h, v, f } = deck.getIndices();
    return `${h}/${v}/${f}/${deck.isOverview()}/${deck.isPaused()}`;
  };
  let keyFrom: string | null = null;
  internal.cueAutoSlide = () => {
    if (keyFrom === null || keyFrom !== state()) cue();
  };
  window.addEventListener('keydown', () => {
    keyFrom = state();
    setTimeout(() => (keyFrom = null), 0);
  }, true);
  window.addEventListener('keydown', () => (keyFrom = null));

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
  // whether each step was last reached going forward by a delay, or by a key. a step not reached
  // yet, e.g. one gone back to from a slide shown with the scrubber, is taken as reached by a delay
  // when the step before it has a delay
  const reached = new Map<string, boolean>();
  const byDelay = (at: At) => reached.get(`${at.slide}:${at.f}`) ?? delayedAt(before(at));

  let last = here();
  let held: Element[] = [];
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
    if (!back) reached.set(`${now.slide}:${now.f}`, timer);
    if (!back || deck.isOverview()) return;
    if (delayedAt(now)) {
      held = fragmentsAt(slides()[now.slide], now.f).filter((el) => el.hasAttribute(AUTOSLIDE));
      for (const el of held) {
        el.setAttribute(HELD, el.getAttribute(AUTOSLIDE)!);
        el.removeAttribute(AUTOSLIDE);
      }
    }
    // the delay of the step may have been started before this event, and it is cued again without it
    internal.cueAutoSlide();
    if (!delayedAt(now)) return;
    // a step reached by a delay is skipped after one step back
    if (same(before(from), now) && byDelay(now)) setTimeout(() => deck.prev(), 0);
  };
  for (const type of ['fragmentshown', 'fragmenthidden', 'slidechanged']) deck.on(type, change);
}
