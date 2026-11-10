// the running head of each content slide and the automatic outline of the section slides

const OWN = ['title', 'section', 'closing'];

// the data-run of a section slide is used in place of the text of its heading, e.g. for a heading
// with math
export const heading = (slide: HTMLElement): string =>
  slide.dataset.run ?? (slide.querySelector('h2') ?? slide.querySelector('h1'))?.textContent?.trim() ?? '';

// the running head of the slides after the closing slide, which are the appendix
const APPENDIX = 'Appendix slides';

// the running heads and the outlines are filled from every slide of the deck, since the slides of
// reveal.js leave out the section slides, which are not numbered. a section slide in the appendix
// names the slides after it. a running head made here is marked with data-generated, and one
// written in the file is kept
export function initChrome(): void {
  const slides = [...document.querySelectorAll<HTMLElement>('.reveal .slides section:not(:has(> section))')];
  const sections = slides.filter((s) => s.classList.contains('section'));
  let text = '';
  for (const slide of slides) {
    if (slide.classList.contains('section')) text = heading(slide);
    if (slide.classList.contains('closing')) text = APPENDIX;
    if (OWN.some((c) => slide.classList.contains(c)) || slide.querySelector('.run') || !text) continue;
    const run = document.createElement('div');
    run.className = 'run';
    run.dataset.generated = '';
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

// the running heads and the outlines filled again, after the slides were added, removed, or
// reordered in the editor
export function refreshChrome(): void {
  for (const run of document.querySelectorAll('.reveal .slides div.run[data-generated]')) run.remove();
  initChrome();
}
