const OWN = ['title', 'section', 'closing'];

function sourceText(el: Element): string {
  const items = window.MathJax?.startup?.document?.getMathItemsWithin([el]) ?? [];
  if (!items.length) return el.textContent ?? '';
  const tex = new Map(items.filter((i) => i.typesetRoot).map((i) => [i.typesetRoot!, `${i.start.delim ?? ''}${i.math}${i.end.delim ?? ''}`]));
  const copy = el.cloneNode(true) as Element;
  const roots = [...el.querySelectorAll('mjx-container')];
  [...copy.querySelectorAll('mjx-container')].forEach((m, k) => m.replaceWith(tex.get(roots[k]) ?? m.textContent ?? ''));
  return copy.textContent ?? '';
}

const title = (slide: HTMLElement): string => {
  const h = slide.querySelector('h2') ?? slide.querySelector('h1');
  return h ? sourceText(h).trim() : '';
};

export const heading = (slide: HTMLElement): string => slide.dataset.run ?? title(slide);

const APPENDIX = 'Appendix slides';

const made = new WeakMap<Element, string>();

function typeset(nodes: Element[]): void {
  const mj = window.MathJax;
  if (!nodes.length || !mj?.typesetPromise) return;
  void Promise.resolve(mj.startup?.promise).then(() => mj.typesetPromise(nodes.filter((n) => n.isConnected)));
}

function untypeset(nodes: Element[]): void {
  if (nodes.length) window.MathJax?.typesetClear?.(nodes);
}

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
  const names = sections.map(title);
  for (const list of document.querySelectorAll<HTMLElement>('.reveal :is(ul, ol).outline[data-auto]')) {
    const home = list.closest('section');
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

export function refreshChrome(): void {
  fill();
}
