import { Orbits } from './orbits.ts';
import { Dots, register as registerDrawing } from './dots.ts';
import { initChrome, refreshChrome } from './chrome.ts';
import { mountCitations, syncCitations } from './citations.ts';
import { initClick } from './click.ts';
import { initCursor, togglePointer } from './cursor.ts';
import { initFullscreen, toggleFullscreen } from './fullscreen.ts';
import { mountPlots, type PlotView } from './plot.ts';
import { markViewers, stillViewers } from './print.ts';
import { mountQr } from './qr.ts';
import { mountShapes } from './shapes.ts';
import { compilingFigure, figuresReady, mountFigures, previewFigure, redrawFigures, reloadFigure } from './tikz.ts';
import { initScrub } from './scrub.ts';
import { initOverview } from './overview.ts';
import { mount as mountSurfaces, onRestore } from './surface.ts';
import type { Surface } from './surface.ts';
import { mount as mountBundles, type Bundle } from './bundle.ts';
import { fly } from './fly.ts';
import { fileOf, fitView, register, trajectoriesFor, type View } from './trajectories.ts';
import { builtIn } from './backdrops.ts';
import { addRestoreSteps, applyAll, applySteps, initSteps, initTimedSteps, typeset, type Internal } from './steps.ts';
import { numberTheorems } from './theorems.ts';
import { forDeck, get, initSwitcher, initTheme, set, toggle } from './switcher.ts';
import { coverAll, initVideos } from './video.ts';
import { typesetLabel } from './drawn-text.ts';
import { initViewers } from './viewers.ts';
import { exported, themeFile, unpackLarge } from './files.ts';
import type { Deck, RevealOptions, SlideEvent } from './reveal.d.ts';

function numberOf(slide: HTMLElement | null | undefined, counted: HTMLElement[]): [string, string, string] {
  if (slide?.dataset.appendix) return [`A${slide.dataset.appendix}`, '', ''];
  if (!slide || slide.dataset.visibility === 'uncounted') return ['', '', ''];
  return [String(counted.indexOf(slide) + 1), '/', counted.length as unknown as string];
}

function numberPages(slides: Set<Element>): void {
  const pages = [...document.querySelectorAll<HTMLElement>('.reveal .pdf-page')];
  const own = pages.map((page) => page.querySelector<HTMLElement>(':scope > section'));
  const counted = own.filter((s): s is HTMLElement => !!s && slides.has(s) && s.dataset.visibility !== 'uncounted');
  let html = '';
  pages.forEach((page, i) => {
    const slide = own[i];
    if (slide && slides.has(slide)) {
      const [a, delimiter, b] = numberOf(slide, counted);
      html = typeof b === 'number' ? `<span class="slide-number-a">${a}</span><span class="slide-number-delimiter">${delimiter}</span><span class="slide-number-b">${b}</span>` : a;
    }
    const number = page.querySelector('.slide-number-pdf');
    if (number) number.innerHTML = html;
  });
}

function markUncounted(scope: ParentNode): void {
  let appendix = 0;
  for (const slide of scope.querySelectorAll<HTMLElement>('.reveal .slides > section')) {
    if (appendix && slide.dataset.visibility !== 'hidden') slide.dataset.appendix = String(appendix++);
    if ((appendix || slide.matches('.title, .section, .closing')) && !slide.dataset.visibility) slide.dataset.visibility = 'uncounted';
    if (!appendix && slide.classList.contains('closing')) appendix = 1;
  }
}

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
  autoAnimateStyles: ['opacity', 'color', 'background-color', 'padding', 'font-size', 'line-height', 'letter-spacing', 'border-width', 'border-color', 'border-radius', 'outline', 'outline-offset', 'translate', 'rotate'],
  progress: true,
  slideNumber: (slide: HTMLElement) => numberOf(slide, window.Reveal.getSlides()),
  controls: false,
  jumpToSlide: false,
  center: false,
  pdfSeparateFragments: true,
  pdfMaxPagesPerSlide: 1,
  scrollActivationWidth: 0,
};

const TRACED = ['title', 'section', 'closing'];

type Backdrop = Orbits | Dots;
const backdrops: Backdrop[] = [];
const backdropOf = (el: HTMLElement): Backdrop | undefined => Dots.of(el) ?? Orbits.of(el);
const drawBackdrop = (el: HTMLElement): Backdrop => (Dots.draws(el) ? new Dots(el) : new Orbits(el));
const surfaces: (Surface | Bundle)[] = [];
onRestore(() => { for (const s of surfaces) s.draw(); });
const plots: PlotView[] = [];

if (exported()) unpackLarge();
const EDITING = !exported() && new URLSearchParams(location.search).has('edit');
const PLAYED = !EDITING && window.parent !== window && new URLSearchParams(location.search).has('from-editor');
const RECEIVER = window.parent !== window && /receiver/i.test(location.search);
const TAB = !EDITING && window.parent === window && !!window.opener && new URLSearchParams(location.search).has('from-editor');
const ENDS = (PLAYED || TAB) && !/controls=false/.test(location.search);
const toEditor = (eventName: string, state: unknown = window.Reveal.getState()) => (RECEIVER ? window.parent.opener : TAB ? window.opener : window.parent)?.postMessage(JSON.stringify({ namespace: 'beeson', eventName, state }), '*');
let speaker: Window | null = null;

function fromSpeaker(ev: MessageEvent): void {
  let m: { namespace?: string; eventName?: string; state?: unknown } | null = null;
  try {
    const from = ev.source as Window | null;
    if (from?.opener === window) {
      speaker = from;
      if (from.document.readyState === 'loading') from.document.close();
    }
    if (from?.parent?.opener === window && typeof ev.data === 'string') m = JSON.parse(ev.data);
  } catch {
    return;
  }
  if (m?.namespace === 'beeson' && m.eventName === 'edit') (PLAYED || TAB ? toEditor('edit', m.state ?? window.Reveal.getState()) : edit());
}

type Indices = { indexh?: number; indexv?: number; indexf?: number };
const stepOf = (s: Indices) => `${s.indexh ?? 0}/${s.indexv ?? 0}/${s.indexf ?? -1}`;

function passKeys(): void {
  window.addEventListener('keydown', (ev) => {
    ev.stopImmediatePropagation();
    const speaker = window.parent as typeof window;
    const passed = new speaker.KeyboardEvent('keydown', ev);
    Object.defineProperty(passed, 'keyCode', { value: ev.keyCode });
    if (!speaker.document.dispatchEvent(passed)) ev.preventDefault();
  }, true);
}

function receiveSteps(deck: Deck): void {
  let posted: string[] = [];
  let left: string | null = null;
  let last: string | null = null;
  const post = () => {
    const config = deck.getConfig();
    if (!config.postMessageEvents) return;
    const step = stepOf(deck.getState());
    if (last !== null && step !== last) {
      if (!posted.length) left = last;
      last = step;
      posted.push(step);
      return;
    }
    config.postMessageEvents = false;
    queueMicrotask(() => (config.postMessageEvents = true));
  };
  deck.on('ready', () => (last = stepOf(deck.getState())));
  for (const type of ['slidechanged', 'fragmentshown', 'fragmenthidden']) deck.on(type, post);
  window.addEventListener('message', (ev) => {
    if (ev.source !== window.parent || typeof ev.data !== 'string' || !deck.isReady()) return;
    let m: { method?: string; args?: Indices[] } | null = null;
    try {
      m = JSON.parse(ev.data);
    } catch {
      return;
    }
    const state = m?.method === 'setState' ? m.args?.[0] : null;
    if (!state || typeof state !== 'object') return;
    ev.stopImmediatePropagation();
    const step = stepOf(state);
    const at = posted.indexOf(step);
    if (at >= 0 || (posted.length && step === left)) {
      posted = posted.slice(at + 1);
      return;
    }
    posted = [];
    const config = deck.getConfig();
    const posts = config.postMessageEvents;
    config.postMessageEvents = false;
    try {
      deck.setState(state as Parameters<Deck['setState']>[0]);
    } finally {
      config.postMessageEvents = posts;
      last = stepOf(deck.getState());
    }
  });
}

function edit(): void {
  speaker?.close();
  const params = new URLSearchParams(location.search);
  params.set('edit', '');
  location.href = `${location.href.split(/[?#]/)[0]}?${params.toString().replace(/=(?=&|$)/g, '')}${location.hash}`;
}

const still = () => EDITING || Orbits.reduced() || window.Reveal.isPrintView() || /print-pdf/.test(location.search);

function remount(): void {
  for (const el of document.querySelectorAll<HTMLElement>('.backdrop')) {
    const o = backdropOf(el) ?? drawBackdrop(el);
    if (!backdrops.includes(o)) backdrops.push(o);
  }
  if (document.querySelector('.surface')) for (const s of [...mountSurfaces(document), ...mountBundles(document)]) if (!surfaces.includes(s)) surfaces.push(s);
  for (const p of mountPlots(document)) if (!plots.includes(p)) plots.push(p);
}

const within = (slide: Element | null | undefined) => (slide ? backdrops.filter((o) => slide.contains(o.el)) : []);
const surfacesOf = (slide: Element | null | undefined) => (slide ? surfaces.filter((s) => slide.contains(s.el)) : []);
const plotsIn = (slide: Element | null | undefined) => (slide ? plots.filter((p) => slide.contains(p.el)) : []);

function stepPlots(slide: Element): void {
  const own = plotsIn(slide);
  for (const p of own) { p.fit(); p.syncSteps(); }
  if (own.length) applySteps(slide);
}

const waiting = (o: Backdrop) => o.el.classList.contains('fragment') && !o.el.classList.contains('visible');
const cuesOf = (slide: Element | null | undefined): Element[] => (slide ? [...slide.querySelectorAll('.fragment[data-backdrop-play]')] : []);
const held = (o: Backdrop, slide: Element | null = o.el.closest('section')): boolean => {
  const cues = cuesOf(slide);
  return cues.length > 0 && !cues.some((f) => f.classList.contains('visible'));
};
const restOrComplete = (o: Backdrop) => (!EDITING && held(o) ? o.reset() : o.complete());

function animated(o: Backdrop, slide: Element | null = o.el.closest('section')): boolean {
  if (waiting(o) || held(o, slide)) return false;
  const loop = o.el.hasAttribute('data-loop');
  if (slide?.hasAttribute('data-auto-animate')) return loop;
  return loop || o.el.hasAttribute('data-live') || TRACED.some((c) => slide?.classList.contains(c)) || cuesOf(slide).length > 0;
}

function playBackdrop(o: Backdrop, slide: HTMLElement): void {
  o.fit();
  if (still()) { restOrComplete(o); return; }
  if (waiting(o) || held(o, slide)) { o.reset(); return; }
  const loop = o.el.hasAttribute('data-loop');
  if (slide.hasAttribute('data-auto-animate')) {
    o.complete();
    const seconds = Number(slide.dataset.autoAnimateDuration ?? window.Reveal.getConfig().autoAnimateDuration ?? 1);
    setTimeout(() => {
      if (window.Reveal.getCurrentSlide() !== slide) return;
      o.fit();
      if (loop) o.start();
    }, seconds * 1000 + 50);
  } else if (animated(o, slide)) {
    o.reset();
    o.start();
  } else o.complete();
}

function show(slide: HTMLElement): void {
  stepPlots(slide);
  for (const p of plotsIn(slide)) if (still()) p.still(); else p.start();
  for (const o of within(slide)) playBackdrop(o, slide);
  for (const s of surfacesOf(slide)) {
    s.fit();
    s.sync(false);
    if (!still()) s.start();
  }
}

function mountWithin(root: Element): void {
  remount();
  mountQr(root);
  mountShapes(root);
  void mountFigures(root, get());
  numberTheorems();
  mountCitations();
  for (const o of backdrops) if (root.contains(o.el)) { o.fit(); o.complete(); }
  for (const s of surfaces) if (root.contains(s.el)) { s.fit(); s.sync(false); s.draw(); }
  for (const p of plots) if (root.contains(p.el)) { p.fit(); p.syncSteps(); p.still(); }
  if (root.matches('tycho-viewer') || root.querySelector('tycho-viewer')) {
    markViewers();
    syncViewers(get());
  }
  const slide = root.closest('.reveal .slides section');
  if (slide) applySteps(slide);
}

function remountBackdrop(el: HTMLElement): Backdrop {
  const at = backdrops.findIndex((o) => o.el === el);
  (at >= 0 ? backdrops[at] : backdropOf(el))?.destroy();
  const o = drawBackdrop(el);
  if (at >= 0) backdrops.splice(at, 1, o);
  else backdrops.push(o);
  o.complete();
  void o.ready.then(() => o.complete());
  return o;
}

function preview(el: HTMLElement): Backdrop {
  const o = drawBackdrop(el);
  o.complete();
  void o.ready.then(() => o.complete());
  return o;
}

async function fitWindow(el: HTMLElement, box?: { left: number; top: number; width: number; height: number }): Promise<View | null> {
  if (Dots.draws(el)) {
    const dots = Dots.of(el);
    await dots?.ready;
    return dots?.viewFitted(box) ?? null;
  }
  const trajectories = fileOf(el) !== null ? (await trajectoriesFor(el)).trajectories : builtIn(el.dataset.backdrop ?? '');
  const b = box ?? { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
  return b.width && b.height ? fitView(trajectories, b, { width: 1920, height: 1080 }) : null;
}

function completeAll(): void {
  remount();
  for (const o of backdrops) { o.fit(); restOrComplete(o); }
  for (const s of surfaces) { s.fit(); s.sync(false); s.draw(); }
  for (const p of plots) { p.fit(); p.syncSteps(); p.still(); }
  applyAll(document);
}

async function start(options: Partial<RevealOptions> = {}): Promise<void> {
  const deck = window.Reveal;
  const plugins = [...(options.plugins ?? [])];
  if (window.RevealNotes && !plugins.includes(window.RevealNotes)) plugins.push(window.RevealNotes);
  if (window.RevealHighlight && !EDITING && !plugins.includes(window.RevealHighlight)) plugins.push(window.RevealHighlight);
  initSwitcher();
  if (!EDITING) markUncounted(document);
  mountQr(document);
  mountShapes(document);
  numberTheorems();
  mountCitations();
  void mountFigures(document, get());
  markViewers();
  const slides = new Set(document.querySelectorAll('.reveal .slides section'));
  deck.on('pdf-ready', () => {
    numberPages(slides);
    completeAll();
    mountShapes(document);
    void mountFigures(document, get());
    mountCitations();
    coverAll(document);
    void typeset().then(() => applyAll(document));
    syncViewers(get());
    void stillViewers();
  });
  const hooks: { internal?: Internal } = {};
  if (!EDITING) plugins.push({ id: 'beeson-restore', init: (reveal: unknown) => { hooks.internal = reveal as Internal; addRestoreSteps(document); } });
  if (RECEIVER) receiveSteps(deck);
  if (RECEIVER && !/postMessageEvents=true/.test(location.search)) passKeys();
  const editing: Partial<RevealOptions> = EDITING ? { showHiddenSlides: true, focusBodyOnPageVisibilityChange: false } : PLAYED && !RECEIVER ? { postMessageEvents: true } : {};
  await deck.initialize({ ...DEFAULTS, ...editing, ...options, plugins });

  initChrome();
  initSteps(deck);
  syncCitations();
  void document.fonts.ready.then(() => syncCitations());
  const { internal } = hooks;
  if (internal) initTimedSteps(deck, forDeck, internal);
  remount();
  initCursor(() => backdrops, () => deck.getCurrentSlide(), !EDITING);
  deck.addKeyBinding({ keyCode: 68, key: 'D', description: 'Switch dark and light' }, (ev) => { if (forDeck(ev)) toggle(); });
  deck.addKeyBinding({ keyCode: 80, key: 'P', description: 'Pointer' }, (ev) => { if (forDeck(ev)) togglePointer(); });
  deck.addKeyBinding(70, (ev) => { if (forDeck(ev)) (PLAYED ? toEditor('fullscreen') : toggleFullscreen()); });
  deck.registerKeyboardShortcut('F', 'Full screen on and off');
  if (!EDITING && !deck.isPrintView() && !/print-pdf/.test(location.search)) {
    if (!PLAYED) initFullscreen();
    initScrub(deck);
    initOverview(deck);
    initVideos(deck);
    initViewers(deck);
    if (internal) initClick(deck, () => internal.cueAutoSlide(), ENDS ? () => toEditor('edit') : undefined);
  }
  if (PLAYED || TAB) for (const keyCode of [27, 69]) deck.addKeyBinding(keyCode, (ev) => { if (forDeck(ev)) toEditor('edit', ENDS ? undefined : null); });
  else if (!EDITING) deck.addKeyBinding({ keyCode: 69, key: 'E', description: 'Edit the deck' }, (ev) => { if (forDeck(ev)) (RECEIVER ? toEditor('edit') : edit()); });
  if (PLAYED) document.addEventListener('keydown', (ev) => { if (ev.keyCode === 83 && forDeck(ev)) toEditor('speaker'); }, true);
  let typed = '';
  if (PLAYED && !RECEIVER) {
    document.addEventListener('keydown', (ev) => { if (!/^[0-9]$/.test(ev.key) && ev.key !== 'Enter') typed = ''; }, true);
    for (let d = 0; d < 10; d++) for (const keyCode of [48 + d, 96 + d]) deck.addKeyBinding(keyCode, (ev) => { if (forDeck(ev)) typed = (typed + d).slice(-4); });
    deck.addKeyBinding(13, (ev) => {
      if (deck.isOverview()) deck.toggleOverview(false);
      else if (forDeck(ev)) (typed ? deck.slide(Number(typed) - 1, 0, -1) : deck.next());
      typed = '';
    });
    deck.addKeyBinding(8, (ev) => { if (forDeck(ev)) deck.prev(); });
  }
  if (ENDS) document.addEventListener('keydown', (ev) => {
    if (!['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'].includes(ev.key) || (ev.key === 'Enter' && typed)) return;
    if (!forDeck(ev) || deck.isOverview() || !deck.isLastSlide() || deck.availableFragments().next) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    toEditor('edit');
  }, true);
  if (!EDITING && !RECEIVER) window.addEventListener('message', fromSpeaker);
  if (PLAYED || TAB) window.addEventListener('pagehide', () => speaker?.close());

  if (still()) completeAll();
  else show(deck.getCurrentSlide());
  deck.on('slidechanged', (event) => {
    const ev = event as SlideEvent;
    if (!still()) for (const o of within(ev.previousSlide)) if (!ev.currentSlide.contains(o.el)) o.reset();
    const before = surfacesOf(ev.previousSlide);
    for (const s of before) s.stop();
    const key = (s: { el: HTMLElement }) => JSON.stringify(Object.entries(s.el.dataset).filter(([k]) => k !== 'surfaceState' && k !== 'shown').sort());
    for (const s of surfacesOf(ev.currentSlide)) {
      const from = before.find((b) => key(b) === key(s));
      if (from) s.follow(from as Surface & Bundle);
    }
    for (const p of plotsIn(ev.previousSlide)) if (!ev.currentSlide.contains(p.el)) p.leave();
    show(ev.currentSlide);
    syncCitations();
  });
  const step = () => {
    for (const s of surfacesOf(deck.getCurrentSlide())) s.sync(!still());
    stepPlots(deck.getCurrentSlide());
    syncCitations(deck.getCurrentSlide());
  };
  deck.on('fragmentshown', (event) => {
    step();
    if (!still()) fly(deck.getCurrentSlide(), (event as Event & { fragments?: Element[] }).fragments ?? []);
  });
  deck.on('fragmenthidden', step);
  const stepped = (event: Event) => {
    const shown = (event as Event & { fragments?: HTMLElement[] }).fragments ?? [];
    const cue = shown.some((f) => f.hasAttribute('data-backdrop-play'));
    for (const o of within(deck.getCurrentSlide())) if (cue || shown.includes(o.el)) playBackdrop(o, deck.getCurrentSlide());
  };
  deck.on('fragmentshown', stepped);
  deck.on('fragmenthidden', stepped);
  deck.on('resize', () => {
    for (const o of backdrops) o.fit();
    for (const s of surfaces) s.fit();
    stepPlots(deck.getCurrentSlide());
  });
  document.addEventListener('beeson:plot-drawn', (ev) => {
    const slide = (ev.target as Element).closest('.reveal .slides section');
    if (slide) applySteps(slide);
  });
  syncViewers(get());
  document.addEventListener('beeson:theme', () => {
    const now = window.Reveal.isPrintView() ? backdrops : within(deck.getCurrentSlide());
    for (const o of now) o.redraw();
    const later = backdrops.filter((o) => !now.includes(o));
    setTimeout(() => {
      for (const o of later) o.redraw();
      document.dispatchEvent(new Event('beeson:redrawn'));
    }, 600);
    for (const s of surfaces) { s.recolor(); s.draw(); }
    redrawFigures(get());
    syncViewers(get());
  });
}

function syncViewers(theme: string): void {
  for (const viewer of document.querySelectorAll('tycho-viewer')) {
    if (!viewer.hasAttribute('data-keep-theme')) viewer.setAttribute('theme', theme);
    viewer.setAttribute('data-prevent-swipe', '');
  }
}

initTheme();

if (EDITING) {
  const script = document.createElement('script');
  script.src = themeFile('editor.js');
  document.head.append(script);
} else if (exported() && new URLSearchParams(location.search).has('edit')) {
  const told = document.createElement('dialog');
  told.className = 'beeson-not-editable';
  told.textContent = 'This single web page cannot be edited. To edit the talk, open index.html in its talk folder and add ?edit to its address.';
  told.addEventListener('click', () => told.close());
  document.body.append(told);
  told.show();
}

const Beeson = {
  start,
  theme: { get, set: (theme: 'dark' | 'light') => set(theme), toggle: () => toggle() },
  backdrops,
  animated,
  surfaces,
  plots,
  figures: { get ready(): Promise<void> { return figuresReady(); }, reload: reloadFigure, preview: previewFigure, compiling: compilingFigure },
  trajectories: register,
  drawing: registerDrawing,
  mount: mountWithin,
  remount: remountBackdrop,
  preview,
  fitWindow,
  typesetLabel,
  refreshChrome: (): void => {
    refreshChrome();
    numberTheorems();
    mountCitations();
  },
  version: __VERSION__,
};

declare global {
  interface Window {
    Beeson: typeof Beeson;
  }
}

window.Beeson = Beeson;
