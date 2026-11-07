// the globals of a deck page: reveal.js, its notes plugin, and MathJax, loaded with script tags before beeson.js

import type { RevealApi, RevealConfig, RevealPlugin } from 'reveal.js';

export type RevealOptions = RevealConfig;

// isPrintView is part of the API of reveal.js 6 but is missing from its declarations
export type Deck = RevealApi & { isPrintView(): boolean };

export type SlideEvent = Event & { currentSlide: HTMLElement; previousSlide?: HTMLElement | null };

declare global {
  interface Window {
    Reveal: Deck;
    RevealNotes?: () => RevealPlugin;
    MathJax?: { startup?: { promise?: Promise<unknown> } };
  }
  // the version of package.json, defined in build.mjs
  const __VERSION__: string;
}
