// the shapes of a slide, a div.shape of theme/beeson.css placed and sized in its style. a rectangle,
// a rounded rectangle, and an ellipse are drawn by the CSS of their box, and the geometries of
// DRAWN by an svg child that is drawn here from the box in px, so that a head keeps its proportion
// to the shorter side and the outline stays inside the box. the svg is never in the file, and it
// is drawn again at a change of the size or the class of its shape

const SVG = 'http://www.w3.org/2000/svg';

export const DRAWN = ['triangle', 'arrow', 'arrow-both', 'brace', 'plus', 'equals'];

const num = (v: number) => String(Math.round(v * 100) / 100);
// a path of commands, each a letter with its numbers
const path = (parts: (string | number)[]) => parts.map((p) => (typeof p === 'number' ? num(p) : p)).join(' ').replace(/ ?([A-Z]) ?/g, '$1');

/** The path of the geometry kind in a box of w by h px with an outline s px wide, or '' for a shape of CSS. */
export function shapePath(kind: string, w: number, h: number, s: number): string {
  const i = s / 2;
  const l = i, t = i, r = w - i, b = h - i, cx = w / 2, cy = h / 2, m = Math.min(w, h);
  switch (kind) {
    case 'triangle':
      return path(['M', cx, t, 'L', r, b, 'L', l, b, 'Z']);
    case 'arrow': {
      const x1 = r - m / 2, y1 = cy - (b - t) / 4, y2 = cy + (b - t) / 4;
      return path(['M', l, y1, 'L', x1, y1, 'L', x1, t, 'L', r, cy, 'L', x1, b, 'L', x1, y2, 'L', l, y2, 'Z']);
    }
    case 'arrow-both': {
      const x1 = l + m / 2, x2 = r - m / 2, y1 = cy - (b - t) / 4, y2 = cy + (b - t) / 4;
      return path(['M', l, cy, 'L', x1, t, 'L', x1, y1, 'L', x2, y1, 'L', x2, t, 'L', r, cy, 'L', x2, b, 'L', x2, y2, 'L', x1, y2, 'L', x1, b, 'Z']);
    }
    case 'brace': {
      const a = (r - l) / 2, d = 0.0833 * m;
      return path(['M', l, t, 'A', a, d, 0, 0, 1, cx, t + d, 'L', cx, cy - d, 'A', a, d, 0, 0, 0, r, cy, 'A', a, d, 0, 0, 0, cx, cy + d, 'L', cx, b - d, 'A', a, d, 0, 0, 1, l, b]);
    }
    case 'plus': {
      const p = 0.3675 * w, q = 0.3675 * h, k = 0.1176 * m;
      return path(['M', cx - p, cy - k, 'L', cx - k, cy - k, 'L', cx - k, cy - q, 'L', cx + k, cy - q, 'L', cx + k, cy - k, 'L', cx + p, cy - k,
        'L', cx + p, cy + k, 'L', cx + k, cy + k, 'L', cx + k, cy + q, 'L', cx - k, cy + q, 'L', cx - k, cy + k, 'L', cx - p, cy + k, 'Z']);
    }
    case 'equals': {
      const p = 0.3675 * w, g = 0.0588 * h, bar = 0.2352 * h;
      const rect = (y0: number, y1: number) => ['M', cx - p, y0, 'L', cx + p, y0, 'L', cx + p, y1, 'L', cx - p, y1, 'Z'];
      return path([...rect(cy - g - bar, cy - g), ...rect(cy + g, cy + g + bar)]);
    }
    default:
      return '';
  }
}

const kindOf = (el: Element) => DRAWN.find((k) => el.classList.contains(k)) ?? null;

// the svg child of el drawn from its box, or taken off for a shape of CSS. a shape that is not laid
// out yet, e.g. on a slide that reveal.js does not show, is sized from its style
function draw(el: HTMLElement): void {
  const kind = kindOf(el);
  let svg = el.querySelector<SVGSVGElement>(':scope > svg');
  if (!kind) {
    svg?.remove();
    return;
  }
  const style = getComputedStyle(el);
  const w = el.offsetWidth || parseFloat(style.width) || 0, h = el.offsetHeight || parseFloat(style.height) || 0;
  const s = parseFloat(style.getPropertyValue('--shape-weight')) || 0;
  if (!svg) {
    svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.append(document.createElementNS(SVG, 'path'));
    el.prepend(svg);
  }
  svg.setAttribute('viewBox', `0 0 ${num(w || 1)} ${num(h || 1)}`);
  svg.querySelector('path')?.setAttribute('d', shapePath(kind, w, h, s));
}

let sizes: ResizeObserver | null = null;
let classes: MutationObserver | null = null;
const watched = new WeakSet<Element>();

/** Draws each div.shape of root, and root itself if it is one, and draws it again at each change of its size or class. */
export function mountShapes(root: ParentNode): void {
  sizes ??= new ResizeObserver((entries) => { for (const e of entries) draw(e.target as HTMLElement); });
  classes ??= new MutationObserver((records) => { for (const r of records) draw(r.target as HTMLElement); });
  const own = root instanceof HTMLElement && root.matches('.shape') ? [root] : [];
  for (const el of [...own, ...root.querySelectorAll<HTMLElement>('.reveal .slides section .shape')]) {
    draw(el);
    if (watched.has(el)) continue;
    watched.add(el);
    sizes.observe(el);
    classes.observe(el, { attributes: true, attributeFilter: ['class'] });
  }
}
