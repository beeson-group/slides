import type { Deck, SlideEvent } from './reveal.d.ts';

export type Tone = 'accent' | 'violet' | 'blue' | 'red';
const TONES: Tone[] = ['accent', 'violet', 'blue', 'red'];

export type Step = {
  index: number;
  visible: boolean;
  keep: number | 'next' | null;
  highlight: string[];
  unhighlight: string[];
  tone: Tone;
  holds: string[];
  focus?: boolean;
};

export function resolve(steps: Step[], current: number): { held: boolean[]; lit: Map<string, Tone> } {
  const indices = [...new Set(steps.map((s) => s.index))].sort((a, b) => a - b);
  const lit = new Map<string, Tone>();
  const order = steps.map((_, i) => i).sort((a, b) => steps[a].index - steps[b].index);
  for (const i of order) {
    if (!steps[i].visible) continue;
    for (const name of steps[i].unhighlight) lit.delete(name);
    for (const name of steps[i].highlight) lit.set(name, steps[i].tone);
  }
  const named = new Set(steps.filter((s) => s.visible && s.index === current).flatMap((s) => s.highlight));
  const focused = steps.some((s) => s.visible && s.focus);
  const held = steps.map((s) => {
    if (!s.visible || s.index === current) return false;
    if (focused) return true;
    const through = s.keep === 'next' ? (indices.find((k) => k > s.index) ?? s.index) : s.keep;
    if (through !== null && current <= through) return true;
    return s.holds.some((name) => named.has(name));
  });
  return { held, lit };
}

const words = (s: string | null | undefined) => (s ?? '').split(/\s+/).filter(Boolean);

const MOVES_ON = 'data-moves-on';

const hasContent = (f: Element) => f.children.length > 0 || (f.textContent ?? '').trim() !== '';

const isCopy = (f: Element) => f.matches('pre > code.fragment');

const holdsVideo = (f: Element) => f.matches('video, tycho-viewer') || !!f.querySelector('video, tycho-viewer');

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
    if (!dimsBox && !frags.some((f) => !last.includes(f) && hasContent(f) && !isCopy(f) && !holdsVideo(f) && !f.matches('.r-stack > *'))) continue;
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

export function applySteps(slide: Element): void {
  const frags = [...slide.querySelectorAll<HTMLElement>('.fragment')];
  if (!slide.querySelector('section')) slide.toggleAttribute('data-complete', !slide.hasAttribute(MOVES_ON) && frags.every((f) => f.classList.contains('visible')));
  const names = [...new Set(frags.flatMap((f) => words(f.dataset.highlight)))];
  if (!names.length && !frags.some((f) => f.hasAttribute('data-keep') || f.hasAttribute('data-focus'))) return;
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
      focus: f.hasAttribute('data-focus'),
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

export function applyAll(root: ParentNode): void {
  for (const slide of root.querySelectorAll('.reveal .slides section')) applySteps(slide);
}

export const typeset = (): Promise<unknown> => window.MathJax?.startup?.promise ?? Promise.resolve();

export function initSteps(deck: Deck): void {
  const mark = () => {
    const slide = deck.getCurrentSlide();
    if (slide) applySteps(slide);
  };
  for (const type of ['fragmentshown', 'fragmenthidden', 'slidechanged']) deck.on(type, mark);
  mark();
  void typeset().then(mark);
  deck.on('slidechanged', (event) => {
    const { previousSlide: from, currentSlide: to } = event as SlideEvent;
    if (!from?.hasAttribute(MOVES_ON) || !to || deck.getSlides().indexOf(to) < deck.getSlides().indexOf(from)) return;
    const frags = [...from.querySelectorAll<HTMLElement>('.fragment')];
    const last = Math.max(...frags.map((f) => Number(f.dataset.fragmentIndex)).filter(Number.isFinite));
    for (const f of frags) if (Number(f.dataset.fragmentIndex) === last) f.classList.add('current-fragment');
  });
}

const AUTOSLIDE = 'data-autoslide';
const HELD = 'data-autoslide-held';

type At = { slide: number; f: number };

const stepsOf = (slide: Element): number[] => [-1, ...new Set([...slide.querySelectorAll<HTMLElement>('.fragment')].map((f) => Number(f.dataset.fragmentIndex)).filter(Number.isFinite))].sort((a, b) => a - b);
const fragmentsAt = (slide: Element, f: number) => [...slide.querySelectorAll<HTMLElement>('.fragment')].filter((el) => Number(el.dataset.fragmentIndex) === f);
const delayed = (el: Element) => (parseInt(el.getAttribute(AUTOSLIDE) ?? el.getAttribute(HELD) ?? '', 10) || 0) > 0;

export type Internal = { cueAutoSlide(): void };

export function initTimedSteps(deck: Deck, forDeck: (ev: KeyboardEvent) => boolean, internal: Internal): void {
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
  const before = (at: At): At | null => {
    const steps = stepsOf(slides()[at.slide]);
    const k = steps.indexOf(at.f);
    if (k > 0) return { slide: at.slide, f: steps[k - 1] };
    const prev = slides()[at.slide - 1];
    return prev ? { slide: at.slide - 1, f: stepsOf(prev).at(-1)! } : null;
  };
  const delayedAt = (at: At | null) => !!at && at.f >= 0 && fragmentsAt(slides()[at.slide], at.f).some(delayed);
  const same = (a: At | null, b: At | null) => !!a && !!b && a.slide === b.slide && a.f === b.f;
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
    internal.cueAutoSlide();
    if (!delayedAt(now)) return;
    if (same(before(from), now) && byDelay(now)) setTimeout(() => deck.prev(), 0);
  };
  for (const type of ['fragmentshown', 'fragmenthidden', 'slidechanged']) deck.on(type, change);
}
