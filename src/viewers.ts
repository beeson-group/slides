// the tycho viewers of a slide that are started on a click, as the videos of src/video.ts. a viewer
// that is or is in a fragment of the style play holds the first frame of its scene, paused, until
// its step, and it is played from its start at its step. the viewers shown at one step are started
// together, once the scene of each of them is loaded, hence two scenes side by side are in step. a
// viewer whose step is undone, or whose slide is left, is paused at its first frame. a kiosk viewer
// is started by the runtime once its scene is loaded, hence a viewer of the style play is held at
// its first frame once its scene is loaded, unless its step is shown by then. the runtime does not
// fire an event at the load of a scene, and its state is read in place of one, which is null
// before the load. a viewer of no fragment of the style play is left to the runtime, which plays a
// kiosk viewer while it is in the viewport, from where it stopped

import type { Deck } from './reveal.d.ts';
import { stepShown } from './video.ts';

// the element of the tycho runtime, of which the state is undefined until tycho.js defines it
type Viewer = HTMLElement & {
  readonly state?: object | null;
  play(): void;
  seek(t: number): void;
};

// the viewers that are played, or waiting for the others of their step
const running = new WeakSet<Viewer>();
// the start that each viewer waits for, so that a start undone before it is made is dropped
const turns = new WeakMap<Viewer, number>();
let turn = 0;
const loads = new WeakMap<Viewer, Promise<void>>();

const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

const loaded = (v: Viewer) => (v.state ?? null) !== null;
const failed = (v: Viewer) => !!v.shadowRoot?.querySelector('.status.error');

/** Resolves once the scene of a viewer is loaded, once the viewer shows an error, or after 60 s. */
function whenLoaded(v: Viewer): Promise<void> {
  let load = loads.get(v);
  if (!load) {
    const until = performance.now() + 60000;
    load = new Promise((done) => {
      const poll = () => (loaded(v) || failed(v) || performance.now() > until ? done() : setTimeout(poll, 50));
      poll();
    });
    loads.set(v, load);
  }
  return load;
}

// a viewer is played at its step when it is or is in a fragment of the style play of its slide
const plays = (v: Element, slide: Element) => {
  const step = v.closest('.fragment.play');
  return !!step && slide.contains(step);
};

/** Shows the first frame of the scene of a viewer, paused. A viewer whose scene is not loaded is left as it is. */
function hold(v: Viewer): void {
  if (loaded(v)) v.seek(0);
}

/**
 * Starts the viewers together from the start of their scenes. While a scene is loaded, the viewers
 * whose scenes are loaded are held at their first frame, for 5 s at most.
 */
async function start(viewers: Viewer[]): Promise<void> {
  const mine = ++turn;
  for (const v of viewers) {
    running.add(v);
    turns.set(v, mine);
  }
  const waiting = viewers.filter((v) => !loaded(v));
  if (waiting.length) {
    for (const v of viewers) hold(v);
    await Promise.race([Promise.all(waiting.map(whenLoaded)), sleep(5000)]);
  }
  const current = viewers.filter((v) => turns.get(v) === mine && running.has(v) && loaded(v));
  // the clock of each viewer is anchored at its play, hence the plays are made in one task
  for (const v of current) v.seek(0);
  for (const v of current) v.play();
}

/** Pauses a viewer at the first frame of its scene. */
function stop(v: Viewer): void {
  running.delete(v);
  turns.delete(v);
  hold(v);
}

/** Sets the viewers of the style play of a slide to its current step: a viewer that is shown is started with the others shown at the same step, and the others are stopped. */
export function stepViewers(slide: Element): void {
  const starts: Viewer[] = [];
  for (const v of slide.querySelectorAll<Viewer>('tycho-viewer')) {
    if (!plays(v, slide)) continue;
    if (stepShown(v, slide)) {
      if (!running.has(v)) starts.push(v);
    } else stop(v);
  }
  if (starts.length) void start(starts);
}

/** Stops the viewers of the style play of a slide that is left, so that they are not resumed where they were when it is shown again. */
function leave(slide: Element): void {
  for (const v of slide.querySelectorAll<Viewer>('tycho-viewer')) if (plays(v, slide)) stop(v);
}

/** Holds each viewer of the style play at its first frame once its scene is loaded, and plays the viewers of the current slide at their steps. */
export function initViewers(deck: Deck): void {
  for (const v of document.querySelectorAll<Viewer>('.reveal .slides tycho-viewer')) {
    const slide = v.closest('section');
    if (!slide || !plays(v, slide)) continue;
    void whenLoaded(v).then(() => {
      if (!running.has(v)) hold(v);
    });
  }
  const sync = () => {
    const slide = deck.getCurrentSlide();
    if (slide) stepViewers(slide);
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
