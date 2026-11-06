// the globals of a deck page: reveal.js and its notes plugin, loaded with script tags before beeson.js

import type { RevealApi, RevealConfig, RevealPlugin } from 'reveal.js';

export type RevealOptions = RevealConfig;

// isPrintView is part of the API of reveal.js 6 but is missing from its declarations
export type Deck = RevealApi & { isPrintView(): boolean };

export type SlideEvent = Event & { currentSlide: HTMLElement; previousSlide?: HTMLElement | null };

declare global {
  interface Window {
    Reveal: Deck;
    RevealNotes?: () => RevealPlugin;
  }
  // the version of package.json, defined in build.mjs
  const __VERSION__: string;
}
