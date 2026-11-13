// the TikZ figures of a deck. a div.tikz with data-figure="name" is drawn from figures/name.js next
// to the deck, the output that npm run tex compiles from figures/name.tex with scripts/figures.mjs.
// the output is a classic script loaded by a script element, since a deck opened from a file
// cannot read the text of a file next to it, and the element is not written into the file. the SVG
// of the mode of the deck is drawn inline at its size, centered in the box of the div, and shown
// smaller as a whole when it is larger than the box, see theme/beeson.css

/** The value of window.beesonFigures[name], written by figureScript of scripts/figures.mjs. */
export type FigureOutput = { hash: string; width: number; height: number; scale: number; parts: string[]; inputs: string[]; dark: string; light: string };

declare global {
  interface Window {
    beesonFigures?: Record<string, FigureOutput>;
  }
}

type Mode = 'dark' | 'light';

// the load of each output by name, resolved once its script has run or has failed to load
const loads = new Map<string, Promise<void>>();

function load(name: string): Promise<void> {
  if (window.beesonFigures?.[name] || !/^[\w-]+$/.test(name)) return Promise.resolve();
  let loading = loads.get(name);
  if (!loading) {
    loading = new Promise((done) => {
      const script = document.createElement('script');
      script.src = `figures/${name}.js`;
      script.onload = script.onerror = () => done();
      document.head.append(script);
    });
    loads.set(name, loading);
  }
  return loading;
}

// the number of each drawn instance, which is put into the ids of its SVG so that the ids of two
// instances of a figure differ, and the name and the mode it was drawn in. a clone of a slide in
// the print view of reveal.js is not in drawn, hence it is drawn again with a number of its own
const drawn = new WeakMap<Element, { n: number; key: string }>();
let instances = 0;

const figuresUnder = (root: ParentNode): HTMLElement[] => [
  ...(root instanceof HTMLElement && root.matches('.tikz') ? [root] : []),
  ...root.querySelectorAll<HTMLElement>('.tikz'),
];

/** Draws the figure el in mode from its output, or the error of a figure without one, in place of what it showed. */
function draw(el: HTMLElement, mode: Mode): void {
  const name = el.dataset.figure ?? '';
  const key = `${name} ${mode}`;
  const state = drawn.get(el);
  if (state?.key === key && el.querySelector(':scope > svg, :scope > .tikz-error')) return;
  const n = state?.n ?? ++instances;
  drawn.set(el, { n, key });
  for (const old of el.querySelectorAll(':scope > svg, :scope > .tikz-error')) old.remove();
  const output = window.beesonFigures?.[name];
  if (!output) {
    const box = document.createElement('div');
    box.className = 'tikz-error';
    box.textContent = name ? `figure ${name} is not compiled: run npm run tex` : 'a TikZ figure without a name in data-figure';
    el.prepend(box);
    return;
  }
  // every id of an output starts with tikz-name-mode-, written by finishSvg of scripts/figures.mjs
  const prefix = `tikz-${name}-${mode}-`;
  el.insertAdjacentHTML('afterbegin', output[mode].split(prefix).join(`${prefix}${n}-`));
  const svg = el.firstElementChild as SVGSVGElement;
  // the size of the output in the style, which the rule of a zone for a picture would stretch
  svg.style.width = `${output.width}px`;
  svg.style.height = `${output.height}px`;
  svg.setAttribute('aria-hidden', 'true');
}

/**
 * Draws each TikZ figure of root, and root itself if it is one, in the mode of the deck, once its
 * output is loaded. A figure that is drawn in this mode already is kept. The promise is resolved once
 * every figure is drawn.
 */
export function mountFigures(root: ParentNode, mode: Mode): Promise<void> {
  return Promise.all(figuresUnder(root).map(async (el) => {
    await load(el.dataset.figure ?? '');
    draw(el, mode);
  })).then(() => undefined);
}

/** Draws every TikZ figure of the page again in mode, after a flip of the mode. */
export function redrawFigures(mode: Mode): void {
  for (const el of figuresUnder(document)) if (drawn.has(el)) draw(el, mode);
}
