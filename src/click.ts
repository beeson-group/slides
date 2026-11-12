// a click on a slide of a deck shown without the editor moves the show on, as in PowerPoint and
// Keynote: it plays the next step of the slide, or shows the next slide after its last step. a
// click is left to an element that takes it, i.e. a link, a control, a video, which the click plays
// or pauses, a plot with its tabs, a surface or a tycho viewer, whose drag turns the camera, a QR
// code, the chrome, and the scrubber. a click that ends a drag or a text selection, a click with a
// modifier, and a right-click do not move the show

import type { Deck } from './reveal.d.ts';

// the elements that take a click of their own
const OWN = [
  'a[href]', 'button', 'input', 'select', 'textarea', 'label', 'summary', 'iframe', 'video', 'audio',
  '[contenteditable]:not([contenteditable="false"])', '.plot', '.surface', 'tycho-viewer', '.qr',
  '.run', '.foot', '.slide-number', '.progress', '.scrub', '.theme-switch', '.r-overlay',
].join(', ');

// the farthest the pointer moves from its press to its release in a click, in CSS px
const SLOP = 4;

const selected = () => String(window.getSelection() ?? '');

/**
 * Moves the deck on at a click on a slide. cue starts the delay of the step shown, which reveal.js
 * starts by itself only at a key or at a change of slide. end, where given, is called in place of a
 * move at a click past the last step of the last slide.
 */
export function initClick(deck: Deck, cue: () => void, end?: () => void): void {
  const root = deck.getRevealElement() as HTMLElement;
  let down: { x: number; y: number; text: string } | null = null;
  document.addEventListener('pointerdown', (ev) => {
    down = ev.isPrimary && ev.button === 0 ? { x: ev.clientX, y: ev.clientY, text: selected() } : null;
  }, true);
  document.addEventListener('click', (ev) => {
    const from = down;
    down = null;
    if (!from || ev.button !== 0 || ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) return;
    if (Math.hypot(ev.clientX - from.x, ev.clientY - from.y) > SLOP) return;
    const text = selected();
    if (text && text !== from.text) return;
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target || !root.contains(target)) return;
    const own = target.closest(OWN);
    // a video without controls is played and paused by a click, and one with controls by them
    if (own instanceof HTMLMediaElement && !own.controls) {
      if (own.paused) void own.play().catch(() => {});
      else own.pause();
    }
    if (own || deck.isOverview() || deck.isPaused()) return;
    if (end && deck.isLastSlide() && !deck.availableFragments().next) return end();
    deck.next();
    cue();
  });
}
