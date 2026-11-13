// the citations of a deck. a citation is an empty cite element after the cited words, with the key
// of its paper in data-key, or the keys of several papers separated by commas. on each slide, the
// papers are numbered from 1 in the order of their first citation, the number of a citation is
// written into data-n and drawn by theme/beeson.css, and the references of the papers are written
// into a div of the class refs at the place of the footnote line. a reference is shown once one of
// its citations is shown, i.e. with the step of the cited words. the references are those of the
// tex.js of the deck

import { referenceLink, referenceParts, type Reference } from './reference.ts';

export type Cited = { labels: string[]; missing: boolean[]; keys: string[] };

/**
 * The label of each citation of a slide, e.g. 1,2 for two papers, whether a key of the citation is
 * not known, and the keys of the cited papers in the order of their numbers. A key that is not
 * known is written into the label in place of a number.
 */
export function citedOf(citations: string[][], known: (key: string) => boolean): Cited {
  const keys: string[] = [];
  const labels: string[] = [];
  const missing: boolean[] = [];
  for (const cited of citations) {
    const numbers = new Set<number>();
    const lost = new Set<string>();
    for (const key of cited) {
      if (!known(key)) {
        lost.add(key);
        continue;
      }
      if (!keys.includes(key)) keys.push(key);
      numbers.add(keys.indexOf(key) + 1);
    }
    labels.push([...[...numbers].sort((a, b) => a - b), ...lost].join(','));
    missing.push(lost.size > 0);
  }
  return { labels, missing, keys };
}

const keysOf = (cite: HTMLElement): string[] => (cite.dataset.key ?? '').split(',').map((key) => key.trim()).filter(Boolean);
// a citation in the notes is not drawn on the slide
const citesOf = (slide: HTMLElement): HTMLElement[] => [...slide.querySelectorAll<HTMLElement>('cite[data-key]')].filter((cite) => !cite.closest('aside.notes'));
const refsOf = (slide: HTMLElement): HTMLElement | null => slide.querySelector<HTMLElement>(':scope > div.refs[data-generated]');
// the slides of the deck without the stacks, and with the pages of the print view
const slides = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.reveal .slides section:not(:has(> section))')];
// the slides with references
const cited = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.reveal .slides section > div.refs[data-generated]')].map((refs) => refs.parentElement as HTMLElement);

// the references of each div made here, as a text. a div whose references are the same is kept
const made = new WeakMap<Element, string>();

function referenceEl(number: number, key: string, reference: Reference): HTMLElement {
  const ref = document.createElement('span');
  ref.className = 'ref';
  ref.dataset.key = key;
  const sup = document.createElement('sup');
  sup.textContent = String(number);
  ref.append(sup);
  const [before, italic, after] = referenceParts(reference);
  const venue = document.createElement('em');
  venue.textContent = italic;
  const link = referenceLink(reference);
  let words: HTMLElement = ref;
  if (link) {
    const a = document.createElement('a');
    a.href = link;
    a.target = '_blank';
    a.rel = 'noopener';
    ref.append(a);
    words = a;
  }
  words.append(before, ...(italic ? [venue] : []), after);
  return ref;
}

function mount(slide: HTMLElement, references: Record<string, Reference>): void {
  const cites = citesOf(slide);
  const { labels, missing, keys } = citedOf(cites.map(keysOf), (key) => Object.hasOwn(references, key));
  cites.forEach((cite, k) => {
    if (cite.dataset.n !== labels[k]) cite.dataset.n = labels[k];
    cite.toggleAttribute('data-missing', missing[k]);
  });
  let refs = refsOf(slide);
  if (!keys.length) {
    refs?.remove();
    slide.style.removeProperty('--refs');
    return;
  }
  const text = JSON.stringify(keys.map((key) => [key, references[key]]));
  if (!refs) {
    refs = document.createElement('div');
    refs.className = 'refs';
    refs.dataset.generated = '';
    slide.append(refs);
  }
  if (made.get(refs) !== text) {
    refs.replaceChildren(...keys.map((key, k) => referenceEl(k + 1, key, references[key])));
    made.set(refs, text);
  }
}

// a reference is hidden until one of its citations is shown, and it keeps its place while it is
// hidden. reveal.js hides a fragment before its step with its visibility, which a citation inherits.
// the footnote of the slide is lifted by the height of the references, which is 0 while the slide
// is not drawn
function sync(slide: HTMLElement): void {
  const refs = refsOf(slide);
  if (!refs) return;
  const shown = new Set<string>();
  for (const cite of citesOf(slide)) if (getComputedStyle(cite).visibility !== 'hidden') for (const key of keysOf(cite)) shown.add(key);
  for (const ref of refs.children) ref.classList.toggle('off', !shown.has((ref as HTMLElement).dataset.key ?? ''));
  const height = `${refs.offsetHeight}px`;
  if (refs.offsetHeight && slide.style.getPropertyValue('--refs') !== height) slide.style.setProperty('--refs', height);
}

/** Numbers the citations of every slide and writes its references, after the start and after a change of a slide. */
export function mountCitations(): void {
  const references = (window as unknown as { beesonTex?: { references?: Record<string, Reference> } }).beesonTex?.references ?? {};
  for (const slide of slides()) {
    mount(slide, references);
    sync(slide);
  }
}

/** Shows the references of slide, or of every slide, whose citations are shown, after a step or a change of slide. */
export function syncCitations(slide?: HTMLElement | null): void {
  for (const s of slide ? [slide] : cited()) sync(s);
}
