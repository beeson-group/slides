// the entry point of beeson.js. window.Beeson.start() is called in a deck to initialize reveal.js
// with the defaults of the theme, and to start the orbit backdrops, the surfaces, the fragment steps,
// the mode switch, and the pointer

import { Orbits, mount } from './orbits.ts';
import { initChrome } from './chrome.ts';
import { initCursor, togglePointer } from './cursor.ts';
import { stillViewers } from './print.ts';
import { mount as mountSurfaces } from './surface.ts';
import type { Surface } from './surface.ts';
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
  // off with 0, since the chrome, the mode button, and the viewer are lost in the scroll view that
  // reveal.js would start in a narrow window
  scrollActivationWidth: 0,
};

// the slides whose backdrop is traced when shown, rather than shown complete
const TRACED = ['title', 'section', 'closing'];

const backdrops: Orbits[] = [];
const surfaces: Surface[] = [];

// with the URL parameter edit, the in-place editor is loaded, and the deck is drawn still while it
// is edited, without the traced backdrops and the tint at the pointer
const EDITING = new URLSearchParams(location.search).has('edit');

function edit(): void {
  const params = new URLSearchParams(location.search);
  params.set('edit', '');
  location.href = `${location.href.split(/[?#]/)[0]}?${params.toString().replace(/=(?=&|$)/g, '')}${location.hash}`;
}

const still = () => EDITING || Orbits.reduced() || window.Reveal.isPrintView() || /print-pdf/.test(location.search);

function remount(): void {
  for (const o of mount(document)) if (!backdrops.includes(o)) backdrops.push(o);
  if (document.querySelector('.surface')) for (const s of mountSurfaces(document)) if (!surfaces.includes(s)) surfaces.push(s);
}

const within = (slide: Element | null | undefined) => (slide ? backdrops.filter((o) => slide.contains(o.el)) : []);
const surfacesOf = (slide: Element | null | undefined) => (slide ? surfaces.filter((s) => slide.contains(s.el)) : []);

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
  for (const s of surfacesOf(slide)) {
    s.fit();
    s.sync(false);
    if (!still()) s.start();
  }
}

function completeAll(): void {
  remount();
  for (const o of backdrops) { o.fit(); o.complete(); }
  for (const s of surfaces) { s.fit(); s.sync(false); s.draw(); }
}

async function start(options: Partial<RevealOptions> = {}): Promise<void> {
  const deck = window.Reveal;
  const plugins = [...(options.plugins ?? [])];
  if (window.RevealNotes && !plugins.includes(window.RevealNotes)) plugins.push(window.RevealNotes);
  initSwitcher();
  // in the print view, a page is cloned per fragment state after ready, and the clones are
  // mounted here
  deck.on('pdf-ready', () => {
    completeAll();
    syncViewers(get());
    void stillViewers();
  });
  await deck.initialize({ ...DEFAULTS, ...options, plugins });

  initChrome(deck);
  initSteps(deck);
  remount();
  initCursor(() => backdrops, () => deck.getCurrentSlide(), !EDITING);
  deck.addKeyBinding({ keyCode: 68, key: 'D', description: 'Switch dark and light' }, (ev) => { if (forDeck(ev)) toggle(); });
  deck.addKeyBinding({ keyCode: 80, key: 'P', description: 'Pointer' }, (ev) => { if (forDeck(ev)) togglePointer(); });
  // E opens the same slide in the editor, and the other parameters of the address are kept
  if (!EDITING) deck.addKeyBinding({ keyCode: 69, key: 'E', description: 'Edit the deck' }, (ev) => { if (forDeck(ev)) edit(); });

  if (still()) completeAll();
  else show(deck.getCurrentSlide());
  deck.on('slidechanged', (event) => {
    const ev = event as SlideEvent;
    if (!still()) for (const o of within(ev.previousSlide)) if (!ev.currentSlide.contains(o.el)) o.reset();
    for (const s of surfacesOf(ev.previousSlide)) s.stop();
    show(ev.currentSlide);
  });
  // a step of a slide may set the stage of a surface on it
  const step = () => { for (const s of surfacesOf(deck.getCurrentSlide())) s.sync(!still()); };
  deck.on('fragmentshown', step);
  deck.on('fragmenthidden', step);
  deck.on('resize', () => {
    for (const o of backdrops) o.fit();
    for (const s of surfaces) s.fit();
  });
  syncViewers(get());
  // the backdrops of the current slide are redrawn inside the flip, and the others after it, since
  // a redraw of every backdrop of the deck holds the first frame of the flip. in the print view
  // every page is in view
  document.addEventListener('beeson:theme', () => {
    const now = window.Reveal.isPrintView() ? backdrops : within(deck.getCurrentSlide());
    for (const o of now) o.redraw();
    const later = backdrops.filter((o) => !now.includes(o));
    if (later.length) setTimeout(() => { for (const o of later) o.redraw(); }, 600);
    for (const s of surfaces) { s.recolor(); s.draw(); }
    syncViewers(get());
  });
}

// the mode of the deck is passed to a tycho viewer through its theme attribute, which can be
// changed at any time. a drag in a viewer moves the camera, and it is not a swipe of the deck
function syncViewers(theme: string): void {
  for (const viewer of document.querySelectorAll('tycho-viewer')) {
    viewer.setAttribute('theme', theme);
    viewer.setAttribute('data-prevent-swipe', '');
  }
}

initTheme();

// the editor, editor.js next to this script, is loaded after the deck. without the parameter, a
// deck does not load it
const self = document.currentScript as HTMLScriptElement | null;
if (EDITING) {
  const script = document.createElement('script');
  script.src = self?.src ? new URL('editor.js', self.src).href : 'theme/editor.js';
  document.head.append(script);
}

const Beeson = {
  start,
  theme: { get, set: (theme: 'dark' | 'light') => set(theme), toggle: () => toggle() },
  backdrops,
  surfaces,
  version: __VERSION__,
};

declare global {
  interface Window {
    Beeson: typeof Beeson;
  }
}

window.Beeson = Beeson;
