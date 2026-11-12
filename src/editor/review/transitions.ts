// the transition of a slide, as in the Animate inspector of Keynote, limited by the scope rule of
// the plan to None, Fade, Magic Move, and Push. as in Keynote, the transition of a slide is played
// when the show leaves it for the next shown slide. reveal.js plays a None or a Fade when the show
// enters a slide, since the slide entered is drawn over the slide left (z-index 11 on
// section.present in reveal.css) and faded in by its own data-transition, hence the None or Fade
// of a slide is written on the next shown slide. Fade is the default of the theme (transition:
// 'fade' in src/main.ts), hence it is written as the absence of data-transition, and None as
// data-transition="none". Magic Move is the auto-animate of reveal.js: data-auto-animate on the
// slide and on the next one, and the same data-id on each pair of matched elements. Push is the
// slide of reveal.js, by which the show moves the slide left out to the left while the next slide
// comes in from the right only when the slide is left by slide-out and the next one is entered by
// slide-in. Push is thus written as the halves of data-transition, e.g. fade-in slide-out on the
// slide and slide-in fade-out on the next one

import type { App } from '../app.ts';
import { drawInto } from '../navigator/thumbs.ts';
import { showStep, stepsOfSlide } from '../present.ts';
import { injectStyle, make } from '../ui/dom.ts';

export type Transition = 'none' | 'fade' | 'magic' | 'push';

// the classes of a step, of its effect, and of its run time, and ghost, which Magic Move animates
// as an opacity, left out of the key of a shape
const RUNTIME = /^(fragment|visible|current-fragment|ghost|fade-[\w-]+|semi-fade-out|current-visible|grow|shrink|strike|highlight-[\w-]+)$/;

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

// the effects by which the show enters s and leaves it, read from its data-transition, e.g. fade
// and slide from fade-in slide-out, with the fade of the theme for a half that is not given
export function halvesOf(s: Element): [string, string] {
  const v = (s.getAttribute('data-transition') ?? '').trim();
  const enter = /(\S+)-in\b/.exec(v)?.[1];
  const leave = /(\S+)-out\b/.exec(v)?.[1];
  if (enter || leave) return [enter ?? 'fade', leave ?? 'fade'];
  return [v || 'fade', v || 'fade'];
}

// the value of data-transition for two halves, without the attribute for the fade of the theme
const joined = (enter: string, leave: string): string | null => (enter !== leave ? `${enter}-in ${leave}-out` : enter === 'fade' ? null : enter);

const setHalves = (app: App, s: Element, enter: string, leave: string) => {
  const value = joined(enter, leave);
  if (s.getAttribute('data-transition') !== value) app.doc.setTag(s, { attrs: { 'data-transition': value } }, 'transition');
};

// the transition by which the show leaves slide, or null for an effect of reveal.js outside the
// scope, e.g. zoom. the last shown slide has the default Fade
export function transitionOf(app: App, slide: Element): Transition | null {
  const next = nextShown(app, slide);
  if (magic(slide) && magic(next)) return 'magic';
  if (!next) return 'fade';
  const [enter] = halvesOf(next);
  if (enter === 'slide' && halvesOf(slide)[1] === 'slide') return 'push';
  return enter === 'fade' || enter === 'none' ? enter : null;
}

// a slide and its file element are paired, with a start tag that the document model can write
export function paired(app: App, el: Element): boolean {
  const s = app.pairing?.elements.get(el) ?? app.pairing?.inner.get(el);
  return !!s?.open;
}

// the elements of a slide that Magic Move matches: its heading, its figures, its lines, and its
// shapes, the outermost of each nest, outside the notes. reveal.js matches an svg only by its
// data-id, and fades out and in again a line without one
const FIGURES = 'img, video, figure, .zone, .plate, .qr, tycho-viewer, div.math, table, pre, .backdrop, .surface, svg.line, .shape';

export function candidates(slide: Element): Element[] {
  const heading = [...slide.querySelectorAll('h1, h2')].find((h) => !h.closest('aside.notes'));
  const figures = [...slide.querySelectorAll(FIGURES)].filter((el) => !el.closest('aside.notes') && !el.parentElement?.closest(FIGURES));
  return heading ? [heading, ...figures.filter((f) => !f.contains(heading))] : figures;
}

// the key under which an element is matched with an element of the other slide: a heading by its
// tag, a picture by its source, a QR code by its text, a backdrop by its drawing, a line by its
// tone and its arrowheads, and a shape by its classes
export function keyOf(el: Element): string {
  const tag = el.localName;
  if (tag === 'h1' || tag === 'h2') return 'heading';
  if (el.matches('svg.line')) {
    // the stroke of a straight line is a line, and that of a curve or an elbow a path
    const line = el.querySelector(':scope > line, :scope > path');
    const tone = [...el.classList].find((c) => c.startsWith('tone-')) ?? '';
    return `line:${tone}:${line?.hasAttribute('marker-start') ? 'start' : ''}:${line?.hasAttribute('marker-end') ? 'end' : ''}`;
  }
  if (el.matches('.shape')) return `shape:${[...el.classList].filter((c) => !RUNTIME.test(c)).sort().join(' ')}`;
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
  if (!next) throw new Error('A transition needs a slide after this one');
  // a slide is left by slide-out only while it is pushed, and else as it is entered. the next slide
  // keeps its slide-out while it pushes the slide after it
  const [enter, leave] = halvesOf(slide);
  const pushes = (s: Element) => halvesOf(s)[1] === 'slide';
  if (leave === 'slide' && t !== 'push') setHalves(app, slide, enter, enter === 'slide' ? 'fade' : enter);
  if (t === 'magic') {
    setMagic(app, slide, true);
    setMagic(app, next, true);
    linkPairs(app, slide, next);
    return;
  }
  if (t === 'push') {
    setHalves(app, slide, enter, 'slide');
    setHalves(app, next, 'slide', pushes(next) ? 'slide' : 'fade');
  } else {
    const value = t === 'none' ? 'none' : 'fade';
    if (halvesOf(next)[0] !== value || (!pushes(next) && halvesOf(next)[1] !== value)) setHalves(app, next, value, pushes(next) ? 'slide' : value);
  }
  if (magic(slide)) {
    if (!magic(previousShown(app, slide))) setMagic(app, slide, false);
    if (magic(next) && !magic(nextShown(app, next))) setMagic(app, next, false);
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

// Preview of the transition, as the Preview button of the Animate pane of Keynote. the transition
// of the slide is played from the slide, at its last step, into the next shown slide at its first
// step. the clones of the slides are drawn on a layer over the canvas, which is taken down at the
// end, at a press, or at Esc, and the page is not changed
export type Plan = { kind: Transition; from: Element | null; to: Element };

export function previewOf(app: App, slide: Element): Plan | null {
  const next = nextShown(app, slide);
  return next && { kind: transitionOf(app, slide) ?? 'fade', from: slide, to: next };
}

// FADE_MS is the fade of theme/beeson.css, and HOLD_MS the time each end of the preview is held,
// both in ms
const FADE_MS = 400;
// the slide of reveal.js at its default speed
const PUSH_MS = 800;
const HOLD_MS = 350;

const PREVIEW_CSS = `
.beeson-edit-preview { position: fixed; z-index: 65; overflow: hidden; pointer-events: none; }
.beeson-edit-preview > .shot { position: absolute; inset: 0; }
`;

const magicMs = (): number => {
  const config = (window as unknown as { Reveal?: { getConfig?(): { autoAnimateDuration?: number } } }).Reveal?.getConfig?.();
  return (config?.autoAnimateDuration ?? 0.5) * 1000;
};

// the elements of section that are not in kept and do not contain an element of kept, outermost
// first
function unmatched(section: Element, kept: Set<Element>): Element[] {
  const out: Element[] = [];
  const walk = (el: Element) => {
    for (const c of el.children) {
      if (kept.has(c)) continue;
      if ([...kept].some((k) => c.contains(k))) walk(c);
      else out.push(c);
    }
  };
  walk(section);
  return out;
}

let stopPreview: (() => void) | null = null;

export const previewing = (): boolean => !!stopPreview;

export function preview(app: App, slide: Element): Promise<void> {
  stopPreview?.();
  const plan = previewOf(app, slide);
  const stage = app.slides() as HTMLElement;
  const box = stage.getBoundingClientRect();
  if (!plan || !box.width || !box.height) return Promise.resolve();
  injectStyle('preview', PREVIEW_CSS);
  const deck = { width: stage.offsetWidth || 1920, height: stage.offsetHeight || 1080 };
  const layer = make('div', 'beeson-edit-preview');
  layer.dataset.kind = plan.kind;
  layer.style.cssText = `left: ${box.left}px; top: ${box.top}px; width: ${box.width}px; height: ${box.height}px;`;
  layer.style.background = getComputedStyle(stage.closest('.reveal') ?? document.body).backgroundColor;
  document.body.append(layer);
  const shot = (s: Element, k: number) => {
    const host = make('div', 'shot');
    layer.append(host);
    drawInto(host, s, deck, box.width);
    showStep(host, s, k);
    return host;
  };
  const from = plan.from ? shot(plan.from, stepsOfSlide(plan.from)) : null;
  const to = shot(plan.to, 0);
  to.style.opacity = '0';
  const animations: Animation[] = [];
  const timers: number[] = [];
  return new Promise<void>((resolve) => {
    const stop = () => {
      if (stopPreview !== stop) return;
      stopPreview = null;
      for (const t of timers) clearTimeout(t);
      for (const a of animations) a.cancel();
      window.removeEventListener('pointerdown', stop, true);
      window.removeEventListener('keydown', key, true);
      layer.remove();
      resolve();
    };
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      stop();
    };
    stopPreview = stop;
    window.addEventListener('pointerdown', stop, true);
    window.addEventListener('keydown', key, true);
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const ms = plan.kind === 'magic' ? magicMs() : plan.kind === 'none' ? 0 : plan.kind === 'push' ? PUSH_MS : FADE_MS;
    later(HOLD_MS, () => {
      layer.dataset.phase = 'play';
      if (plan.kind === 'magic' && from) {
        const a = from.shadowRoot?.querySelector('.slides > section');
        const b = to.shadowRoot?.querySelector('.slides > section');
        const pairs = a && b ? matchPairs(a, b) : [];
        const scale = box.width / deck.width;
        // each matched element of the next slide is moved from the place of its match, and the
        // others are faded in, as in the auto-animate of reveal.js with autoAnimateUnmatched
        const moves = pairs.map(([x, y]) => ({ y, p: x.getBoundingClientRect(), q: y.getBoundingClientRect() }));
        from.style.opacity = '0';
        to.style.opacity = '1';
        for (const { y, p, q } of moves) {
          if (!q.width || !q.height) continue;
          const start = `translate(${(p.left - q.left) / scale}px, ${(p.top - q.top) / scale}px) scale(${p.width / q.width}, ${p.height / q.height})`;
          animations.push(y.animate([{ transform: start, transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }], { duration: ms, easing: 'ease-out' }));
        }
        if (b) for (const el of unmatched(b, new Set(pairs.map(([, y]) => y)))) animations.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: 'ease-out' }));
      } else if (plan.kind === 'push') {
        to.style.opacity = '1';
        const ease = { duration: ms, easing: 'cubic-bezier(0.26, 0.86, 0.44, 0.985)', fill: 'forwards' as const };
        animations.push(to.animate([{ transform: 'translateX(100%)' }, { transform: 'none' }], ease));
        if (from) animations.push(from.animate([{ transform: 'none' }, { transform: 'translateX(-100%)' }], ease));
      } else if (ms) {
        to.style.opacity = '1';
        animations.push(to.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: 'ease-out' }));
        if (from) animations.push(from.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: 'ease-out', fill: 'forwards' }));
      } else {
        to.style.opacity = '1';
        if (from) from.style.opacity = '0';
      }
      later(ms + HOLD_MS, stop);
    });
  });
}
