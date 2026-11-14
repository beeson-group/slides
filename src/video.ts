// the videos of a slide, played as videos set to start on a click in PowerPoint. a video with
// data-autoplay is played from its start once it is shown, i.e. with its slide, or at its step when
// it is or is in a fragment, and a video that is or is in a fragment of the style play is shown with
// its poster before its step and played from its start at its step. the videos shown at one step
// are started together, once each of them can be played, hence two clips side by side are in step.
// a video whose step is undone is paused and rewound, to its poster when it is still in view. the
// videos of a figure box or a plate are stacked in one place, and a video under a later one that is shown
// is marked data-covered, hidden once the later one has faded in, and paused. reveal.js 6 starts
// and pauses the videos inside a fragment, and not a video that is a fragment itself, and it does
// not pause a video hidden by the style of its fragment, e.g. fade-in-then-out

import type { Deck } from './reveal.d.ts';

// the fade of a fragment in theme/beeson.css, after which a covered video is hidden
const FADE = 400;

// the videos that are played, or waiting for the others of their step
const running = new WeakSet<HTMLVideoElement>();
// the start that each video waits for, so that a start undone before it is made is dropped
const turns = new WeakMap<HTMLVideoElement, number>();
let turn = 0;
// the videos whose plays outside a start are paused, e.g. one started late by reveal.js
const guarded = new WeakSet<HTMLVideoElement>();

// a fragment hidden by its style once it is shown, at once or at the next step
const HIDES = '.fade-out, .fade-in-then-out:not(.current-fragment), .current-visible:not(.current-fragment)';

/** Whether el is shown at the current step of its slide: every fragment from el up to the slide is shown and not hidden by its style. */
export function stepShown(el: Element, slide: Element): boolean {
  for (let e: Element | null = el; e && e !== slide; e = e.parentElement) {
    if (!e.classList.contains('fragment')) continue;
    if (!e.classList.contains('visible') || e.matches(HIDES)) return false;
  }
  return true;
}

const mode = (v: Element) => (v.classList.contains('for-dark') ? 'dark' : v.classList.contains('for-light') ? 'light' : '');

// a later video of the same place covers v in its mode, or in both modes without a class of a mode
const coveredBy = (v: Element, later: Element) => !mode(later) || mode(later) === mode(v);

/** Marks with data-covered each video of a figure box or a plate under a later video of the same place that is shown, except in a plate of the class row. */
export function cover(slide: Element): void {
  for (const place of slide.querySelectorAll('.figure-box, .plate')) {
    const videos = [...place.children].filter((c): c is HTMLVideoElement => c instanceof HTMLVideoElement);
    const shown = videos.map((v) => stepShown(v, slide));
    videos.forEach((v, i) => {
      const under = !place.classList.contains('row') && videos.some((later, j) => j > i && shown[j] && coveredBy(v, later));
      v.toggleAttribute('data-covered', under);
    });
  }
}

/** Covers the videos of every slide under root, e.g. of the pages of the print view. */
export function coverAll(root: ParentNode): void {
  for (const slide of root.querySelectorAll('.reveal .slides section')) cover(slide);
}

// a video is played with data-autoplay, or in a fragment of the style play of its slide
const plays = (v: HTMLVideoElement, slide: Element) => {
  if (v.hasAttribute('data-autoplay')) return true;
  const step = v.closest('.fragment.play');
  return !!step && slide.contains(step);
};

const ready = (v: HTMLVideoElement) => v.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA || v.error !== null;

const once = (v: HTMLVideoElement, types: string[]) => new Promise<void>((done) => {
  for (const type of types) v.addEventListener(type, () => done(), { once: true });
});

const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/**
 * Starts the videos together from their first frame. A video that cannot be played yet is loaded,
 * and the others are held at their first frame until every one can be played, or for 5 s at most.
 */
async function start(videos: HTMLVideoElement[]): Promise<void> {
  const mine = ++turn;
  for (const v of videos) {
    running.add(v);
    turns.set(v, mine);
  }
  const current = () => videos.filter((v) => turns.get(v) === mine && running.has(v));
  if (!videos.every(ready)) {
    // a video that reveal.js has started is held as well
    for (const v of videos) {
      v.pause();
      if (!ready(v)) v.preload = 'auto';
    }
    await Promise.race([Promise.all(videos.filter((v) => !ready(v)).map((v) => once(v, ['canplay', 'error']))), sleep(5000)]);
  }
  // a video rewound by a seek starts once the seek is done, hence the seeks are made first
  const seeks = current().filter((v) => v.currentTime > 0).map((v) => {
    v.currentTime = 0;
    return once(v, ['seeked', 'error']);
  });
  if (seeks.length) await Promise.race([Promise.all(seeks), sleep(1000)]);
  // a play refused by the browser, e.g. of a video with sound before any key is pressed, leaves it at its first frame
  for (const v of current()) v.play().catch(() => {});
}

/** Pauses a video and rewinds it: to its poster at once while it is in view, and to its first frame after the fade of its step otherwise. */
function stop(v: HTMLVideoElement): void {
  const played = !v.paused || v.currentTime > 0;
  running.delete(v);
  turns.delete(v);
  v.pause();
  if (!played) return;
  if (getComputedStyle(v).visibility !== 'hidden' && !v.hasAttribute('data-covered')) {
    v.load();
    return;
  }
  setTimeout(() => {
    if (!running.has(v) && v.currentTime > 0) v.currentTime = 0;
  }, FADE + 50);
}

function guard(v: HTMLVideoElement): void {
  if (guarded.has(v)) return;
  guarded.add(v);
  v.addEventListener('play', () => {
    if (!running.has(v)) v.pause();
  });
}

/**
 * Sets the videos of a slide to its current step. A video that is shown and not covered is started
 * with the others shown at the same step, and the others are stopped. In the speaker view, only a
 * muted video is played, as in reveal.js.
 */
export function syncVideos(slide: Element, speaker = false): void {
  cover(slide);
  const starts: HTMLVideoElement[] = [];
  for (const v of slide.querySelectorAll('video')) {
    if (!plays(v, slide) || (speaker && !v.muted)) continue;
    guard(v);
    if (stepShown(v, slide) && !v.hasAttribute('data-covered')) {
      if (!running.has(v)) starts.push(v);
    } else stop(v);
  }
  if (starts.length) void start(starts);
}

/** Forgets the videos of a slide that is left. reveal.js has paused them, and they are rewound when the slide is shown again. */
function leave(slide: Element): void {
  for (const v of slide.querySelectorAll('video')) {
    running.delete(v);
    turns.delete(v);
  }
}

/** Plays the videos of the current slide at each step, and of each slide that is shown. */
export function initVideos(deck: Deck): void {
  const speaker = deck.isSpeakerNotes();
  const sync = () => {
    const slide = deck.getCurrentSlide();
    if (slide) syncVideos(slide, speaker);
  };
  deck.on('slidechanged', (event) => {
    const previous = (event as Event & { previousSlide?: HTMLElement | null }).previousSlide;
    if (previous && previous !== deck.getCurrentSlide()) leave(previous);
    sync();
  });
  deck.on('fragmentshown', sync);
  deck.on('fragmenthidden', sync);
  sync();
}
