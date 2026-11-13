// the running head of each content slide and the automatic outline of the section slides

const OWN = ['title', 'section', 'closing'];

// the text of el with each typeset formula written back as its TeX between its delimiters, since
// the text of a heading typeset by MathJax is not its source
function sourceText(el: Element): string {
  const items = window.MathJax?.startup?.document?.getMathItemsWithin([el]) ?? [];
  if (!items.length) return el.textContent ?? '';
  const tex = new Map(items.filter((i) => i.typesetRoot).map((i) => [i.typesetRoot!, `${i.start.delim ?? ''}${i.math}${i.end.delim ?? ''}`]));
  const copy = el.cloneNode(true) as Element;
  const roots = [...el.querySelectorAll('mjx-container')];
  [...copy.querySelectorAll('mjx-container')].forEach((m, k) => m.replaceWith(tex.get(roots[k]) ?? m.textContent ?? ''));
  return copy.textContent ?? '';
}

// the data-run of a section slide is used in place of the text of its heading, e.g. for a heading
// with math
export const heading = (slide: HTMLElement): string => {
  if (slide.dataset.run !== undefined) return slide.dataset.run;
  const h = slide.querySelector('h2') ?? slide.querySelector('h1');
  return h ? sourceText(h).trim() : '';
};

// the running head of the slides after the closing slide, which are the appendix
const APPENDIX = 'Appendix slides';

// the source text of each running head and outline item made here. an element whose text is the
// same at a refresh is kept, with the formulas that MathJax typeset in it
const made = new WeakMap<Element, string>();

// the new running heads and outline items typeset, once MathJax has typeset the page
function typeset(nodes: Element[]): void {
  const mj = window.MathJax;
  if (!nodes.length || !mj?.typesetPromise) return;
  void Promise.resolve(mj.startup?.promise).then(() => mj.typesetPromise(nodes.filter((n) => n.isConnected)));
}

function untypeset(nodes: Element[]): void {
  if (nodes.length) window.MathJax?.typesetClear?.(nodes);
}

// the running heads and the outlines are filled from every slide of the deck, since the slides of
// reveal.js leave out the section slides, which are not numbered. a section slide in the appendix
// names the slides after it. a running head made here is marked with data-generated, and one
// written in the file is kept
function fill(): void {
  const slides = [...document.querySelectorAll<HTMLElement>('.reveal .slides section:not(:has(> section))')];
  const sections = slides.filter((s) => s.classList.contains('section'));
  const fresh: Element[] = [];
  const gone: Element[] = [];
  let text = '';
  for (const slide of slides) {
    if (slide.classList.contains('section')) text = heading(slide);
    if (slide.classList.contains('closing')) text = APPENDIX;
    const old = slide.querySelector<HTMLElement>(':scope > div.run[data-generated]');
    const wanted = !OWN.some((c) => slide.classList.contains(c)) && !slide.querySelector('.run:not([data-generated])') && !!text;
    // a kept running head stays the last element of its slide, as a new one is appended
    if (old && wanted && made.get(old) === text) {
      if (old.nextElementSibling) slide.append(old);
      continue;
    }
    if (old) {
      gone.push(old);
      old.remove();
    }
    if (!wanted) continue;
    const run = document.createElement('div');
    run.className = 'run';
    run.dataset.generated = '';
    run.textContent = text;
    made.set(run, text);
    slide.append(run);
    fresh.push(run);
  }
  for (const list of document.querySelectorAll<HTMLElement>('.reveal ul.outline[data-auto]')) {
    const home = list.closest('section');
    const names = sections.map(heading);
    const items = [...list.children];
    const same = items.length === names.length && items.every((li, k) => made.get(li) === names[k]);
    if (same) {
      items.forEach((li, k) => li.classList.toggle('now', sections[k] === home));
      continue;
    }
    gone.push(...items);
    const lis = sections.map((s, k) => {
      const li = document.createElement('li');
      li.textContent = names[k];
      made.set(li, names[k]);
      if (s === home) li.className = 'now';
      return li;
    });
    list.replaceChildren(...lis);
    fresh.push(...lis);
  }
  untypeset(gone);
  typeset(fresh);
}

export function initChrome(): void {
  fill();
}

// the running heads and the outlines filled again, after the slides were added, removed, or
// reordered or a tag was edited in the editor. a running head or an outline item whose text is
// the same is kept as it is
export function refreshChrome(): void {
  fill();
}
