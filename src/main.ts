// the entry point of beeson.js. window.Beeson.start() is called in a deck to initialize reveal.js
// with the defaults of the theme, and to start the orbit backdrops, the surfaces, the plots, the QR
// codes, the fragment steps, the videos and the tycho viewers at their steps, the mode switch, the pointer,
// and the click that moves the show on

import { Orbits, mount } from './orbits.ts';
import { initChrome, refreshChrome } from './chrome.ts';
import { mountCitations, syncCitations } from './citations.ts';
import { initClick } from './click.ts';
import { initCursor, togglePointer } from './cursor.ts';
import { initFullscreen, toggleFullscreen } from './fullscreen.ts';
import { mountPlots, type PlotView } from './plot.ts';
import { markViewers, stillViewers } from './print.ts';
import { mountQr } from './qr.ts';
import { mountShapes } from './shapes.ts';
import { initScrub } from './scrub.ts';
import { mount as mountSurfaces } from './surface.ts';
import type { Surface } from './surface.ts';
import { fitView, register, strandsFor, type View } from './strands.ts';
import { scene } from './scenes.ts';
import { addRestoreSteps, applyAll, applySteps, initSteps, initTimedSteps, typeset, type Internal } from './steps.ts';
import { numberTheorems } from './theorems.ts';
import { forDeck, get, initSwitcher, initTheme, set, toggle } from './switcher.ts';
import { coverAll, initVideos } from './video.ts';
import { initViewers } from './viewers.ts';
import type { RevealOptions, SlideEvent } from './reveal.d.ts';

// the number of a slide out of the numbered slides. a slide with data-visibility="uncounted", e.g. a
// title, section, or closing slide, is not numbered, and a slide of the appendix is numbered A1, A2, and so on.
// reveal.js writes the total only when it is a number
function numberOf(slide: HTMLElement | null | undefined): [string, string, string] {
  if (slide?.dataset.appendix) return [`A${slide.dataset.appendix}`, '', ''];
  if (!slide || slide.dataset.visibility === 'uncounted') return ['', '', ''];
  return [String(window.Reveal.getSlidePastCount(slide) + 1), '/', window.Reveal.getTotalSlides() as unknown as string];
}

// the title, section, and closing slides are left out of the count, and so are the slides after the closing
// slide, which are the appendix. a slide whose data-visibility is set keeps it
function markUncounted(scope: ParentNode): void {
  let appendix = 0;
  for (const slide of scope.querySelectorAll<HTMLElement>('.reveal .slides > section')) {
    if (appendix) slide.dataset.appendix = String(appendix++);
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
  // the list of reveal.js with translate and rotate, which the editor writes for a move and a turn.
  // with center off, reveal.js measures an element by its offset, which does not count them
  autoAnimateStyles: ['opacity', 'color', 'background-color', 'padding', 'font-size', 'line-height', 'letter-spacing', 'border-width', 'border-color', 'border-radius', 'outline', 'outline-offset', 'translate', 'rotate'],
  progress: true,
  slideNumber: (slide: HTMLElement) => numberOf(slide),
  controls: false,
  center: false,
  pdfSeparateFragments: true,
  // one page per step, as in Keynote and PowerPoint, with what runs past the slide cut off in the
  // print styles of theme/beeson.css
  pdfMaxPagesPerSlide: 1,
  // off with 0, since the chrome, the mode button, and the viewer are lost in the scroll view that
  // reveal.js would start in a narrow window
  scrollActivationWidth: 0,
};

// the slides whose backdrop is traced when shown, rather than shown complete
const TRACED = ['title', 'section', 'closing'];

const backdrops: Orbits[] = [];
const surfaces: Surface[] = [];
const plots: PlotView[] = [];

// with the URL parameter edit, the in-place editor is loaded, and the deck is drawn still while it
// is edited, without the traced backdrops and the tint at the pointer
const EDITING = new URLSearchParams(location.search).has('edit');
// with the parameter from-editor, the deck is the show that the editor plays in a frame. Esc and E
// return to the editor, F takes the stage of the editor into full screen and out, and S warns the
// editor that the speaker view leaves full screen, hence the keys are posted to the editor
const PLAYED = !EDITING && window.parent !== window && new URLSearchParams(location.search).has('from-editor');
// the frame of the current slide in the speaker view of reveal.js, with receiver in its address, is
// sent the keys of the speaker view, and it posts them to the deck that opened the speaker view
const RECEIVER = window.parent !== window && /receiver/i.test(location.search);
// with from-editor, the deck in a tab of its own is the show of Presenter View, which posts to the
// editor that opened it
const TAB = !EDITING && window.parent === window && !!window.opener && new URLSearchParams(location.search).has('from-editor');
// the show played by the editor, in its frame or its tab, and the current slide of its speaker
// view, end at a click or a key forward past the last step. the speaker view gives its frame of the
// upcoming slide controls=false
const ENDS = (PLAYED || TAB) && !/controls=false/.test(location.search);
const toEditor = (eventName: string, state: unknown = window.Reveal.getState()) => (RECEIVER ? window.parent.opener : TAB ? window.opener : window.parent)?.postMessage(JSON.stringify({ namespace: 'beeson', eventName, state }), '*');
// the speaker view opened by the show, which is closed with the show
let speaker: Window | null = null;

// E or Esc posted by the speaker view is taken as a key of the deck, and the speaker view is known
// by the messages that it posts to the deck. a window of another origin is reached by postMessage,
// and its opener and parent are read. the editor is given the state of the speaker view, which the
// deck takes over only after a delay
function fromSpeaker(ev: MessageEvent): void {
  let m: { namespace?: string; eventName?: string; state?: unknown } | null = null;
  try {
    const from = ev.source as Window | null;
    if (from?.opener === window) speaker = from;
    if (from?.parent?.opener === window && typeof ev.data === 'string') m = JSON.parse(ev.data);
  } catch {
    return;
  }
  if (m?.namespace === 'beeson' && m.eventName === 'edit') (PLAYED || TAB ? toEditor('edit', m.state ?? window.Reveal.getState()) : edit());
}

function edit(): void {
  // the speaker view does not follow the editor, hence it is closed with the show
  speaker?.close();
  const params = new URLSearchParams(location.search);
  params.set('edit', '');
  location.href = `${location.href.split(/[?#]/)[0]}?${params.toString().replace(/=(?=&|$)/g, '')}${location.hash}`;
}

const still = () => EDITING || Orbits.reduced() || window.Reveal.isPrintView() || /print-pdf/.test(location.search);

function remount(): void {
  for (const o of mount(document)) if (!backdrops.includes(o)) backdrops.push(o);
  if (document.querySelector('.surface')) for (const s of mountSurfaces(document)) if (!surfaces.includes(s)) surfaces.push(s);
  for (const p of mountPlots(document)) if (!plots.includes(p)) plots.push(p);
}

const within = (slide: Element | null | undefined) => (slide ? backdrops.filter((o) => slide.contains(o.el)) : []);
const surfacesOf = (slide: Element | null | undefined) => (slide ? surfaces.filter((s) => slide.contains(s.el)) : []);
const plotsIn = (slide: Element | null | undefined) => (slide ? plots.filter((p) => slide.contains(p.el)) : []);

// a plot is laid out and set to the steps of its slide, and the highlights of the slide are applied
// again to the marks it has drawn
function stepPlots(slide: Element): void {
  const own = plotsIn(slide);
  for (const p of own) { p.fit(); p.syncSteps(); }
  if (own.length) applySteps(slide);
}

// a backdrop that is a step of its slide is left blank until its step is shown
const waiting = (o: Orbits) => o.el.classList.contains('fragment') && !o.el.classList.contains('visible');

function playBackdrop(o: Orbits, slide: HTMLElement): void {
  o.fit();
  if (still()) { o.complete(); return; }
  if (waiting(o)) { o.reset(); return; }
  const loop = o.el.hasAttribute('data-loop');
  if (slide.hasAttribute('data-auto-animate')) {
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

// the backdrops, surfaces, plots, and QR codes under root drawn still, for content added to the page
// by the editor after the start
function mountWithin(root: Element): void {
  remount();
  mountQr(root);
  mountShapes(root);
  // a theorem added to a slide changes the numbers on the slides after it
  numberTheorems();
  mountCitations();
  for (const o of backdrops) if (root.contains(o.el)) { o.fit(); o.complete(); }
  for (const s of surfaces) if (root.contains(s.el)) { s.fit(); s.sync(false); s.draw(); }
  for (const p of plots) if (root.contains(p.el)) { p.fit(); p.syncSteps(); p.still(); }
  const slide = root.closest('.reveal .slides section');
  if (slide) applySteps(slide);
}

// the backdrop el drawn complete by a new Orbits in place of its drawing, at its index of
// backdrops, after a change of its drawing or of its labels in the editor
function remountBackdrop(el: HTMLElement): Orbits {
  const at = backdrops.findIndex((o) => o.el === el);
  (at >= 0 ? backdrops[at] : Orbits.of(el))?.destroy();
  const o = new Orbits(el);
  if (at >= 0) backdrops.splice(at, 1, o);
  else backdrops.push(o);
  o.complete();
  void o.ready.then(() => o.complete());
  return o;
}

// a drawing of the attributes of el, a div outside the slides, drawn complete for a tile of the
// gallery of the editor, and left out of backdrops. the caller destroys it
function preview(el: HTMLElement): Orbits {
  const o = new Orbits(el);
  o.complete();
  void o.ready.then(() => o.complete());
  return o;
}

// the window of the drawing of el fitted to box, by default its box on its slide, in slide px
async function fitWindow(el: HTMLElement, box?: { left: number; top: number; width: number; height: number }): Promise<View | null> {
  const strands = el.dataset.strands !== undefined ? (await strandsFor(el)).strands : scene(el.dataset.scene ?? '');
  const b = box ?? { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
  return b.width && b.height ? fitView(strands, b, { width: 1920, height: 1080 }) : null;
}

function completeAll(): void {
  remount();
  for (const o of backdrops) { o.fit(); o.complete(); }
  for (const s of surfaces) { s.fit(); s.sync(false); s.draw(); }
  for (const p of plots) { p.fit(); p.syncSteps(); p.still(); }
  applyAll(document);
}

async function start(options: Partial<RevealOptions> = {}): Promise<void> {
  const deck = window.Reveal;
  const plugins = [...(options.plugins ?? [])];
  if (window.RevealNotes && !plugins.includes(window.RevealNotes)) plugins.push(window.RevealNotes);
  // a code box is left as written in the file while the deck is edited, since the text of the page
  // is paired with the file in the editor
  if (window.RevealHighlight && !EDITING && !plugins.includes(window.RevealHighlight)) plugins.push(window.RevealHighlight);
  initSwitcher();
  // the editor counts the slides of the file, hence every slide is numbered while the deck is edited
  if (!EDITING) markUncounted(document);
  // the QR codes and the shapes are drawn, and the theorems and the citations are numbered, before
  // reveal.js clones the slides of the print view
  mountQr(document);
  mountShapes(document);
  numberTheorems();
  mountCitations();
  // in the print view, a page is cloned per fragment state after ready, and the clones are
  // mounted here. the viewers are numbered before the clones are made
  markViewers();
  deck.on('pdf-ready', () => {
    completeAll();
    mountShapes(document);
    // each page shows the references of the citations of its step
    mountCitations();
    coverAll(document);
    void typeset().then(() => applyAll(document));
    syncViewers(get());
    void stillViewers();
  });
  // the editor lists the steps written in the file, and it does not show the added ones. the steps
  // are added in a plugin, since the plugins are initialized in order before the fragments are
  // sorted, and the copies of a code box are made by the highlight plugin before this one
  // the init of a plugin is given the object of reveal.js that its controllers call
  const hooks: { internal?: Internal } = {};
  if (!EDITING) plugins.push({ id: 'beeson-restore', init: (reveal: unknown) => { hooks.internal = reveal as Internal; addRestoreSteps(document); } });
  // a hidden slide is removed from the page by reveal.js unless showHiddenSlides is set, and it
  // must be on the page to be edited
  // the show in the frame of the editor posts its events to the editor. the option is not in the
  // address, which the speaker view copies into its frame of the upcoming slide, whose events
  // would then move the show a step on
  const editing: Partial<RevealOptions> = EDITING ? { showHiddenSlides: true } : PLAYED && !RECEIVER ? { postMessageEvents: true } : {};
  await deck.initialize({ ...DEFAULTS, ...editing, ...options, plugins });

  initChrome();
  initSteps(deck);
  // the references are measured once the slides are laid out, and again in the typeface of the deck
  syncCitations();
  void document.fonts.ready.then(() => syncCitations());
  // the editor shows every step, and it does not play a delay
  const { internal } = hooks;
  if (internal) initTimedSteps(deck, forDeck, internal);
  remount();
  initCursor(() => backdrops, () => deck.getCurrentSlide(), !EDITING);
  deck.addKeyBinding({ keyCode: 68, key: 'D', description: 'Switch dark and light' }, (ev) => { if (forDeck(ev)) toggle(); });
  deck.addKeyBinding({ keyCode: 80, key: 'P', description: 'Pointer' }, (ev) => { if (forDeck(ev)) togglePointer(); });
  // F enters full screen as in reveal.js, and it leaves it too
  deck.addKeyBinding(70, (ev) => { if (forDeck(ev)) (PLAYED ? toEditor('fullscreen') : toggleFullscreen()); });
  deck.registerKeyboardShortcut('F', 'Full screen on and off');
  // the print view is not shown on a screen, and the editor keeps the bottom of the window
  if (!EDITING && !deck.isPrintView() && !/print-pdf/.test(location.search)) {
    if (!PLAYED) initFullscreen();
    initScrub(deck);
    // the videos and the viewers of the style play are played at their steps, and not while the deck
    // is edited, when every step is shown
    initVideos(deck);
    initViewers(deck);
    // a click on a slide moves the show on, as in PowerPoint and Keynote, and a click past the end
    // of the show played from the editor returns to the editor, as a key forward does below
    if (internal) initClick(deck, () => internal.cueAutoSlide(), ENDS ? () => toEditor('edit') : undefined);
  }
  // E opens the same slide in the editor, and the other parameters of the address are kept. the
  // frame of the upcoming slide in the speaker view is a step ahead of the show, hence it posts a
  // null state, and the deck that opened the speaker view gives the editor its own state
  if (PLAYED || TAB) for (const keyCode of [27, 69]) deck.addKeyBinding(keyCode, (ev) => { if (forDeck(ev)) toEditor('edit', ENDS ? undefined : null); });
  else if (!EDITING) deck.addKeyBinding({ keyCode: 69, key: 'E', description: 'Edit the deck' }, (ev) => { if (forDeck(ev)) (RECEIVER ? toEditor('edit') : edit()); });
  if (PLAYED) document.addEventListener('keydown', (ev) => { if (ev.keyCode === 83 && forDeck(ev)) toEditor('speaker'); }, true);
  let typed = '';
  if (PLAYED && !RECEIVER) {
    // Return and Backspace move the show, and a slide number typed before Return goes to its
    // slide before its steps, as in PowerPoint and in the presenter display of the editor. the
    // frames of the speaker view are left with the keys of reveal.js
    document.addEventListener('keydown', (ev) => { if (!/^[0-9]$/.test(ev.key) && ev.key !== 'Enter') typed = ''; }, true);
    for (let d = 0; d < 10; d++) for (const keyCode of [48 + d, 96 + d]) deck.addKeyBinding(keyCode, (ev) => { if (forDeck(ev)) typed = (typed + d).slice(-4); });
    deck.addKeyBinding(13, (ev) => {
      if (deck.isOverview()) deck.toggleOverview(false);
      else if (forDeck(ev)) (typed ? deck.slide(Number(typed) - 1, 0, -1) : deck.next());
      typed = '';
    });
    deck.addKeyBinding(8, (ev) => { if (forDeck(ev)) deck.prev(); });
  }
  // a key forward at the last step of the last slide returns to the editor, as the presenter
  // display ends the show there
  if (ENDS) document.addEventListener('keydown', (ev) => {
    if (!['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'].includes(ev.key) || (ev.key === 'Enter' && typed)) return;
    if (!forDeck(ev) || deck.isOverview() || !deck.isLastSlide() || deck.availableFragments().next) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    toEditor('edit');
  }, true);
  if (!EDITING && !RECEIVER) window.addEventListener('message', fromSpeaker);
  // the editor ends the show by taking its frame away, or by closing its tab
  if (PLAYED || TAB) window.addEventListener('pagehide', () => speaker?.close());

  if (still()) completeAll();
  else show(deck.getCurrentSlide());
  deck.on('slidechanged', (event) => {
    const ev = event as SlideEvent;
    if (!still()) for (const o of within(ev.previousSlide)) if (!ev.currentSlide.contains(o.el)) o.reset();
    const before = surfacesOf(ev.previousSlide);
    for (const s of before) s.stop();
    // a surface whose data attributes other than data-stage match those of a surface on the slide
    // before takes its camera, so that the turn of the camera continues across the slide change.
    // data-shown is left out too, since each surface writes its drawn stage there
    const key = (s: { el: HTMLElement }) => JSON.stringify(Object.entries(s.el.dataset).filter(([k]) => k !== 'stage' && k !== 'shown').sort());
    for (const s of surfacesOf(ev.currentSlide)) {
      const from = before.find((b) => key(b) === key(s));
      if (from) s.follow(from);
    }
    for (const p of plotsIn(ev.previousSlide)) if (!ev.currentSlide.contains(p.el)) p.leave();
    show(ev.currentSlide);
    // every step of a slide before the current one is shown, and none of a slide after it
    syncCitations();
  });
  // a step of a slide may set the stage of a surface on it, or the steps of a plot, and it may
  // show a citation
  const step = () => {
    for (const s of surfacesOf(deck.getCurrentSlide())) s.sync(!still());
    stepPlots(deck.getCurrentSlide());
    syncCitations(deck.getCurrentSlide());
  };
  deck.on('fragmentshown', step);
  deck.on('fragmenthidden', step);
  // a backdrop that is a step is traced from its step on, and blanked when the step is hidden
  const stepped = (event: Event) => {
    const shown = (event as Event & { fragments?: HTMLElement[] }).fragments ?? [];
    for (const o of within(deck.getCurrentSlide())) if (shown.includes(o.el)) playBackdrop(o, deck.getCurrentSlide());
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
// changed at any time, unless the viewer carries data-keep-theme, under which the theme written in
// the file is kept, for a scene whose marks are drawn for one background. a drag in a viewer moves
// the camera, and it is not a swipe of the deck
function syncViewers(theme: string): void {
  for (const viewer of document.querySelectorAll('tycho-viewer')) {
    if (!viewer.hasAttribute('data-keep-theme')) viewer.setAttribute('theme', theme);
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
  plots,
  // called in a script file of polylines named in data-strands, see src/strands.ts
  strands: register,
  // called by the editor after a structural change of the slides
  mount: mountWithin,
  // called by the editor on a backdrop, see remountBackdrop, preview, and fitWindow
  remount: remountBackdrop,
  preview,
  fitWindow,
  // called by the editor after the slides were added, removed, or reordered
  refreshChrome: (): void => {
    refreshChrome();
    numberTheorems();
  },
  version: __VERSION__,
};

declare global {
  interface Window {
    Beeson: typeof Beeson;
  }
}

window.Beeson = Beeson;
