// marks the current slide with data-complete once its last fragment is shown, so that the theme
// stops dimming the earlier fragments

import type { Deck } from './reveal.d.ts';

export function initSteps(deck: Deck): void {
  const mark = () => {
    const slide = deck.getCurrentSlide();
    if (!slide) return;
    slide.toggleAttribute('data-complete', !deck.availableFragments().next);
  };
  for (const type of ['fragmentshown', 'fragmenthidden', 'slidechanged']) deck.on(type, mark);
  mark();
}
