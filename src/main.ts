// the entry point of beeson.js. window.Beeson.start() is called in a deck to initialize reveal.js
// with the defaults of the theme, and to start the orbit backdrops, the fragment steps, the mode
// switch, and the pointer

import { Orbits, mount } from './orbits.ts';
import { initChrome } from './chrome.ts';
import { initCursor, togglePointer } from './cursor.ts';
import { initSteps } from './steps.ts';
import { forDeck, get, initSwitcher, initTheme, set, toggle } from './switcher.ts';
import type { RevealOptions, SlideEvent } from './reveal.d.ts';

const DEFAULTS: RevealOptions = {
  width: 1920,
  height: 1080,
  margin: 0,
  minScale: 0.1,
  maxScale: 3,
  hash: true,
  transition: 'fade',
  backgroundTransition: 'none',
  autoAnimateDuration: 0.5,
  autoAnimateEasing: 'ease-out',
  autoAnimateUnmatched: true,
  progress: true,
  slideNumber: 'c/t',
  controls: false,
  center: false,
  pdfSeparateFragments: true,
};

// the slides whose backdrop is traced when shown, rather than shown complete
const TRACED = ['title', 'section', 'closing'];

const backdrops: Orbits[] = [];

const still = () => Orbits.reduced() || window.Reveal.isPrintView() || /print-pdf/.test(location.search);

function remount(): void {
  for (const o of mount(document)) if (!backdrops.includes(o)) backdrops.push(o);
}

const within = (slide: Element | null | undefined) => (slide ? backdrops.filter((o) => slide.contains(o.el)) : []);

function show(slide: HTMLElement): void {
  const glide = slide.hasAttribute('data-auto-animate');
  for (const o of within(slide)) {
    o.fit();
    if (still()) { o.complete(); continue; }
    const loop = o.el.hasAttribute('data-loop');
    if (glide) {
      // a matched backdrop is moved between two frames in a reveal.js auto-animate, hence it is
      // shown complete and measured again after the move
      o.complete();
      const seconds = Number(slide.dataset.autoAnimateDuration ?? window.Reveal.getConfig().autoAnimateDuration ?? 1);
      setTimeout(() => {
        if (window.Reveal.getCurrentSlide() !== slide) return;
        o.fit();
        if (loop) o.start();
      }, seconds * 1000 + 50);
    } else if (loop || o.el.hasAttribute('data-live') || TRACED.some((c) => slide.classList.contains(c))) {
      o.reset();
      o.start();
    } else o.complete();
  }
}

function completeAll(): void {
  remount();
  for (const o of backdrops) { o.fit(); o.complete(); }
}

async function start(options: Partial<RevealOptions> = {}): Promise<void> {
  const deck = window.Reveal;
  const plugins = [...(options.plugins ?? [])];
  if (window.RevealNotes && !plugins.includes(window.RevealNotes)) plugins.push(window.RevealNotes);
  initSwitcher();
  // in the print view, a page is cloned per fragment state after ready, and the clones are
  // mounted here
  deck.on('pdf-ready', completeAll);
  await deck.initialize({ ...DEFAULTS, ...options, plugins });

  initChrome(deck);
  initSteps(deck);
  remount();
  initCursor(() => backdrops, () => deck.getCurrentSlide());
  deck.addKeyBinding({ keyCode: 68, key: 'D', description: 'Switch dark and light' }, (ev) => { if (forDeck(ev)) toggle(); });
  deck.addKeyBinding({ keyCode: 80, key: 'P', description: 'Pointer' }, (ev) => { if (forDeck(ev)) togglePointer(); });

  if (still()) completeAll();
  else show(deck.getCurrentSlide());
  deck.on('slidechanged', (event) => {
    const ev = event as SlideEvent;
    if (!still()) for (const o of within(ev.previousSlide)) if (!ev.currentSlide.contains(o.el)) o.reset();
    show(ev.currentSlide);
  });
  deck.on('resize', () => { for (const o of backdrops) o.fit(); });
  syncViewers(get());
  document.addEventListener('beeson:theme', () => {
    for (const o of backdrops) o.redraw();
    syncViewers(get());
  });
}

// the mode of the deck is passed to a tycho viewer through its theme attribute, which can be
// changed at any time
function syncViewers(theme: string): void {
  for (const viewer of document.querySelectorAll('tycho-viewer')) viewer.setAttribute('theme', theme);
}

initTheme();

const Beeson = {
  start,
  theme: { get, set: (theme: 'dark' | 'light') => set(theme), toggle: () => toggle() },
  backdrops,
  version: __VERSION__,
};

declare global {
  interface Window {
    Beeson: typeof Beeson;
  }
}

window.Beeson = Beeson;
