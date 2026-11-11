// the contrast of text for the accessibility checker, as Hard-to-read text contrast of PowerPoint.
// each text block of a slide is measured in the dark and in the light mode of the theme: the
// computed color of the block and of each element in it with text of its own, against the color
// behind it, i.e. the first background of its ancestors on the slide, e.g. a Split panel or the
// fill of a table, over the background of the deck. the ratio is that of WCAG 2, and a text under
// 4.5:1, or under 3:1 at 36 px and more, is reported. a block over a backdrop, a surface, or a
// picture is listed as a tip to check by eye, since the color behind it is not one color. the
// chrome of the theme, e.g. the footnote line, is not checked. the mode that is not shown is
// measured under a constructed sheet with its tokens on .reveal, which does not change the page

import type { Issue } from './accessibility.ts';

export type Mode = 'dark' | 'light';
type Rgba = [number, number, number, number];

const BLOCKS = 'h1, h2, h3, h4, p, li, td, th, figcaption, .caption, div.math, .lab';
const SKIP = 'aside.notes, [data-generated], .foot, .run, ul.outline[data-auto], .plot, .qr, pre, svg, mjx-container *';
const PICTURES = '.backdrop, .surface, .plate, img, video, canvas, tycho-viewer';

// the rgba of a CSS color in sRGB, read from a canvas, which parses every form of color
const parsed = new Map<string, Rgba>();
let ctx: CanvasRenderingContext2D | null = null;
function rgba(color: string): Rgba {
  let c = parsed.get(color);
  if (c) return c;
  ctx ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  if (!ctx) return [0, 0, 0, 1];
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = '#000';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  c = [d[0], d[1], d[2], d[3] / 255];
  parsed.set(color, c);
  return c;
}

// top drawn over bottom, which is opaque
const over = (top: Rgba, bottom: Rgba): Rgba => [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1) as Rgba;

function luminance([r, g, b]: Rgba): number {
  const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// the contrast ratio of WCAG 2 of two opaque colors, from 1 to 21
export function ratio(a: Rgba, b: Rgba): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// the custom properties of the theme in mode, from the rules on :root and html[data-theme]
function tokens(mode: Mode): Record<string, string> {
  const html = document.createElement('html');
  html.dataset.theme = mode;
  const out: Record<string, string> = {};
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const r of rules) {
      if (!(r instanceof CSSStyleRule) || !/:root|data-theme/.test(r.selectorText)) continue;
      let hit = false;
      try {
        hit = html.matches(r.selectorText.replace(/:root/g, 'html'));
      } catch {
        // a selector that this browser does not parse
      }
      if (!hit) continue;
      for (const p of r.style) if (p.startsWith('--') && !p.startsWith('--ed-')) out[p] = r.style.getPropertyValue(p).trim();
    }
  }
  return out;
}

export const modeNow = (): Mode => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

// the elements of block whose own text is drawn in their color, the block first. a formula is
// drawn in the color of its container
function inks(block: Element): Element[] {
  const own = (el: Element) => [...el.childNodes].some((n) => n instanceof Text && n.data.trim()) || el.localName === 'mjx-container';
  const out = own(block) ? [block] : [];
  for (const el of block.querySelectorAll('*')) {
    if (el.closest(SKIP) || (el.matches(BLOCKS) && el !== block) || el.parentElement?.closest(BLOCKS) !== block) continue;
    if (own(el)) out.push(el);
  }
  return out;
}

// the color behind el: the backgrounds of its ancestors up to its slide over the background of the
// deck, bg
function behind(el: Element, bg: Rgba): Rgba {
  const layers: Rgba[] = [];
  for (let a: Element | null = el; a; a = a.parentElement) {
    const c = rgba(getComputedStyle(a).backgroundColor);
    if (c[3] > 0) layers.push(c);
    if (c[3] >= 1 || a.localName === 'section') break;
  }
  return layers.reduceRight((under, top) => over(top, under), bg);
}

// the lowest contrast of the inks of block in the mode shown now, with the size of that ink
function lowest(block: Element, bg: Rgba): { ratio: number; size: number } | null {
  let out: { ratio: number; size: number } | null = null;
  for (const ink of inks(block)) {
    const cs = getComputedStyle(ink);
    const under = behind(ink, bg);
    const r = ratio(over(rgba(cs.color), under), under);
    const size = parseFloat(cs.fontSize);
    const need = size >= 36 ? 3 : 4.5;
    if (r < need && (!out || r < out.ratio)) out = { ratio: r, size };
  }
  return out;
}

const overlap = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;

const quote = (text: string): string => `"${text.length > 24 ? `${text.slice(0, 23)}…` : text}"`;
// the start of the text of a block, or its kind for a block of math alone
const textOf = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
const label = (el: Element) => (textOf(el) ? quote(textOf(el)) : el.matches('.lab') ? 'Label' : 'Formula');

// the ratio written down, never rounded up to a limit it misses
const shown = (r: number) => `${(Math.floor(r * 10) / 10).toFixed(1)}:1`;

// the boxes of the text of each block and of each picture of slide. a slide that reveal.js does
// not lay out is shown for the time of the measure only
function boxes(slide: HTMLElement, blocks: Element[], pictures: Element[]): DOMRect[] {
  const style = slide.getAttribute('style');
  const hidden = !slide.getClientRects().length;
  if (hidden) slide.style.display = 'block';
  const range = document.createRange();
  const out = [
    ...blocks.map((b) => {
      range.selectNodeContents(b);
      return range.getBoundingClientRect();
    }),
    ...pictures.map((p) => p.getBoundingClientRect()),
  ];
  if (hidden) {
    if (style === null) slide.removeAttribute('style');
    else slide.setAttribute('style', style);
  }
  return out;
}

// the contrast issues and the tips of the slides
export function contrastIssues(slides: Element[]): Issue[] {
  const now = modeNow();
  const plain: { slide: Element; block: Element }[] = [];
  const tips: Issue[] = [];
  for (const slide of slides) {
    const blocks = [...slide.querySelectorAll(BLOCKS)].filter((b) => !b.closest(SKIP) && (textOf(b) || b.querySelector('mjx-container')) && !b.parentElement?.closest(BLOCKS));
    const pictures = [...slide.querySelectorAll(PICTURES)].filter((p) => !p.closest('aside.notes'));
    const box = boxes(slide as HTMLElement, blocks, pictures);
    blocks.forEach((block, i) => {
      const over = pictures.some((p, j) => p.contains(block) || (!block.contains(p) && !p.contains(block) && overlap(box[i], box[blocks.length + j])));
      if (over) tips.push({ check: 'behind', slide, el: block, what: label(block) });
      else plain.push({ slide, block });
    });
  }
  const found: Issue[] = [];
  const read = (mode: Mode, t: Record<string, string>) => {
    const bg = rgba(t['--bg'] ?? '#000');
    for (const { slide, block } of plain) {
      if (block.closest(mode === 'dark' ? '.for-light' : '.for-dark')) continue;
      const low = lowest(block, bg);
      if (low) found.push({ check: 'contrast', slide, el: block, what: `${label(block)} ${shown(low.ratio)} in ${mode} mode`, mode });
    }
  };
  for (const mode of ['dark', 'light'] as Mode[]) {
    const t = tokens(mode);
    if (mode === now) {
      read(mode, t);
      continue;
    }
    // the mode not shown, under its tokens and without transitions, which are taken off only once
    // the page is styled in its own mode again, so that no color is animated back
    const sheet = new CSSStyleSheet();
    const still = '.reveal, .reveal *, .reveal *::before, .reveal *::after { transition: none !important; }';
    sheet.replaceSync(`.reveal { ${Object.entries(t).map(([k, v]) => `${k}: ${v};`).join(' ')} } ${still}`);
    const before = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...before, sheet];
    try {
      read(mode, t);
    } finally {
      sheet.replaceSync(still);
      for (const { block } of plain) void getComputedStyle(block).color;
      document.adoptedStyleSheets = before;
    }
  }
  const order = new Map(plain.map(({ block }, i) => [block, i]));
  found.sort((a, b) => order.get(a.el!)! - order.get(b.el!)! || (a.mode === 'dark' ? -1 : 1));
  return [...found, ...tips];
}
