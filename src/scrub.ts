// the scrubber of the progress line. while the mouse is near the bottom of the window, the line is
// magnified into a band with a tick at the start of each numbered slide, labeled with the slide
// number and the time at which the slide starts, and a click on the band shows the slide of the
// nearest tick at its first step. without the mouse there, the progress line of reveal.js is left
// as it is drawn

import { heading } from './chrome.ts';
import type { Deck } from './reveal.d.ts';

type Timing = { totalTime?: number | null; defaultTiming?: number | null };

// seconds as m:ss
export function minutes(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// the start time of each slide, in s from the start of the talk, by the rule of the pacing of the
// speaker view of reveal.js (getTimings in theme/vendor/reveal/notes.js): data-timing of a slide in
// s, and else defaultTiming, or with totalTime set, an equal share of the time left by the timed
// slides. starts returns null when the deck sets neither totalTime nor defaultTiming
export function starts(timings: (string | undefined)[], config: Timing): number[] | null {
  const { totalTime } = config;
  if (config.defaultTiming == null && totalTime == null) return null;
  const fallback = totalTime ? 0 : (config.defaultTiming ?? 0);
  let own = timings.map((t) => {
    const n = t === undefined ? NaN : parseInt(t, 10);
    return Number.isNaN(n) ? fallback : n;
  });
  if (totalTime) {
    const open = own.filter((x) => x === 0).length;
    const share = open ? Math.round((totalTime - own.reduce((a, b) => a + b, 0)) / open) : 0;
    own = own.map((x) => (x === 0 ? share : x));
  }
  let t = 0;
  return own.map((x) => { const at = t; t += x; return at; });
}

// the least gap between two labels, in em of the band
const GAP = 3.2;

// the band is opened only with the mouse within REACH screen pixels of its bottom edge, so that
// the controls of a figure near the bottom of a slide are not covered, and it is kept open while
// the mouse is anywhere over it. REACH is wide enough for the band to open before the pointer hits
// the bottom of the screen, where macOS shows a hidden Dock over the window
const REACH = 48;

export function initScrub(deck: Deck): void {
  const reveal = deck.getRevealElement() as HTMLElement;
  const band = document.createElement('div');
  band.className = 'scrub';
  band.setAttribute('aria-hidden', 'true');
  const track = document.createElement('div');
  track.className = 'scrub-track';
  const fill = document.createElement('span');
  track.append(fill);
  const headingBox = document.createElement('div');
  headingBox.className = 'scrub-heading';
  band.append(track, headingBox);
  reveal.append(band);

  let ticks: { slide: HTMLElement; at: number; el: HTMLElement }[] = [];
  let hovered: (typeof ticks)[number] | null = null;
  let open = false;
  let zone = band.getBoundingClientRect();

  // the ticks are placed where the progress of reveal.js stands at the first step of each slide. the
  // slides of reveal.js leave out those with data-visibility="uncounted", which are not numbered
  const build = () => {
    for (const t of ticks) t.el.remove();
    const slides = deck.getSlides() as HTMLElement[];
    const last = Math.max(1, deck.getTotalSlides() - 1);
    const times = starts(slides.map((s) => s.dataset.timing), deck.getConfig() as Timing);
    ticks = slides.map((slide, i) => {
      const at = Math.min(deck.getSlidePastCount(slide) / last, 1);
      const el = document.createElement('div');
      el.className = 'scrub-tick';
      el.style.left = `${at * 100}%`;
      if (i === 0) el.classList.add('first');
      if (i === slides.length - 1 && slides.length > 1) el.classList.add('last');
      const number = document.createElement('span');
      number.textContent = String(deck.getSlidePastCount(slide) + 1);
      el.append(number);
      if (times) {
        const time = document.createElement('span');
        time.className = 'scrub-time';
        time.textContent = minutes(times[i]);
        el.append(time);
      }
      band.append(el);
      return { slide, at, el };
    });
  };

  // a label is shown on every k-th tick, so that labels are at least GAP em apart, and always on
  // the current and the hovered slide
  const thin = () => {
    zone = band.getBoundingClientRect();
    const em = parseFloat(getComputedStyle(band).fontSize) || 16;
    const spacing = zone.width / Math.max(1, ticks.length - 1);
    const k = Math.max(1, Math.ceil((GAP * em) / spacing));
    ticks.forEach((t, i) => t.el.classList.toggle('quiet', i % k !== 0 && i !== ticks.length - 1));
  };

  const mark = () => {
    fill.style.transform = `scaleX(${deck.getTotalSlides() < 2 ? 0 : deck.getProgress()})`;
    const current = deck.getCurrentSlide();
    for (const t of ticks) t.el.classList.toggle('now', t.slide === current);
  };

  const hover = (t: typeof hovered) => {
    if (t === hovered) return;
    hovered?.el.classList.remove('hover');
    hovered = t;
    if (!t) { headingBox.textContent = ''; return; }
    t.el.classList.add('hover');
    headingBox.textContent = heading(t.slide);
    const half = headingBox.offsetWidth / 2;
    const x = Math.min(Math.max(t.at * zone.width, half), zone.width - half);
    headingBox.style.left = `${x}px`;
  };

  const show = (on: boolean) => {
    if (on === open) return;
    open = on;
    if (on) { build(); thin(); mark(); }
    else hover(null);
    reveal.classList.toggle('scrubbing', on);
  };

  const nearest = (x: number) => {
    const at = (x - zone.left) / zone.width;
    let best = ticks[0] ?? null;
    for (const t of ticks) if (Math.abs(t.at - at) < Math.abs((best?.at ?? 0) - at)) best = t;
    return best;
  };

  document.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse' && ev.pointerType !== 'pen') return;
    const top = open ? zone.top : zone.bottom - REACH;
    const near = ev.clientY >= top && ev.clientY <= zone.bottom && ev.clientX >= zone.left && ev.clientX <= zone.right;
    show(near);
    if (near) hover(nearest(ev.clientX));
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => show(false));
  // a key, e.g. of a remote, moves the talk on, and the band is closed until the mouse moves
  document.addEventListener('keydown', () => show(false), true);
  band.addEventListener('click', (ev) => {
    const t = nearest(ev.clientX);
    if (!t) return;
    const { h, v } = deck.getIndices(t.slide);
    deck.slide(h, v, -1);
  });
  for (const event of ['slidechanged', 'fragmentshown', 'fragmenthidden']) deck.on(event, () => { if (open) mark(); });
  deck.on('resize', () => { zone = band.getBoundingClientRect(); if (open) thin(); });
}
