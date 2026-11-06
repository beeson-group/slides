// the running head of each content slide and the automatic outline of the section slides

import type { Deck } from './reveal.d.ts';

const OWN = ['title', 'section', 'closing'];

// a section slide's data-run replaces the text of its heading, e.g. where the heading holds math
const heading = (slide: HTMLElement): string =>
  slide.dataset.run ?? (slide.querySelector('h2') ?? slide.querySelector('h1'))?.textContent?.trim() ?? '';

export function initChrome(deck: Deck): void {
  const slides = deck.getSlides();
  const sections = slides.filter((s) => s.classList.contains('section'));
  let current: HTMLElement | null = null;
  for (const slide of slides) {
    if (slide.classList.contains('section')) current = slide;
    if (OWN.some((c) => slide.classList.contains(c)) || slide.querySelector('.run') || !current) continue;
    const text = heading(current);
    if (!text) continue;
    const run = document.createElement('div');
    run.className = 'run';
    run.textContent = text;
    slide.append(run);
  }
  for (const list of document.querySelectorAll<HTMLElement>('.reveal ul.outline[data-auto]')) {
    const home = list.closest('section');
    list.replaceChildren(
      ...sections.map((s) => {
        const li = document.createElement('li');
        li.textContent = heading(s);
        if (s === home) li.className = 'now';
        return li;
      }),
    );
  }
}
