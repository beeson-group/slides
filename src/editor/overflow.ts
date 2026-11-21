import { ALL, HOST, type App } from './app.ts';
import { drawnUnder } from './commands/order.ts';
import { injectStyle } from './ui/dom.ts';
import { orientedBox, scaleAt } from './canvas/hit.ts';

const FIGURE = 'img, video, canvas, iframe, tycho-viewer, .plot, .qr, .tikz, table, pre';

type Turned = { x: number; y: number; w: number; h: number; a: number };

function turnOf(el: Element, slide: Element): number {
  let deg = 0;
  for (let at: Element | null = el; at && at !== slide; at = at.parentElement) deg += parseFloat(getComputedStyle(at).rotate) || 0;
  return deg % 360;
}

function turnedOf(f: Element, slide: Element): Turned | null {
  const deg = turnOf(f, slide);
  if (!deg) return null;
  const b = orientedBox(f, scaleAt(f), deg);
  return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width / 2, h: b.height / 2, a: (deg * Math.PI) / 180 };
}

function cuts(r: DOMRect, q: Turned): boolean {
  const w = r.width / 2 - 1, h = r.height / 2 - 1;
  const dx = q.x - (r.left + r.width / 2), dy = q.y - (r.top + r.height / 2);
  const c = Math.abs(Math.cos(q.a)), s = Math.abs(Math.sin(q.a));
  if (Math.abs(dx) >= w + q.w * c + q.h * s || Math.abs(dy) >= h + q.w * s + q.h * c) return false;
  const u = Math.abs(dx * Math.cos(q.a) + dy * Math.sin(q.a)), v = Math.abs(dy * Math.cos(q.a) - dx * Math.sin(q.a));
  return u < q.w + w * c + h * s && v < q.h + w * s + h * c;
}

const KINDS: [string, string][] = [['img', 'picture'], ['video', 'video'], ['.plot', 'plot'], ['.qr', 'QR code'], ['.tikz', 'TikZ figure'], ['table', 'table'], ['pre', 'code box'], ['tycho-viewer', 'scene']];
const kindOf = (f: Element): string => KINDS.find(([s]) => f.matches(s))?.[1] ?? 'figure';

type Check = { scope: Element | null; seen: Map<Element, string> };
const checks = new WeakMap<Element, Check[]>();

const placeOf = (el: Element, slide: Element): string => {
  let k = '';
  for (let e: Element | null = el; e && e !== slide; e = e.parentElement) k += `${(e as HTMLElement).style?.cssText ?? ''}|`;
  return k;
};

export function checkOverlaps(app: App, slide: Element | null, scope: Element | null = null): void {
  if (!slide) return;
  const seen = new Map<Element, string>();
  for (const el of slide.querySelectorAll('*')) if (app.pairing?.elements.has(el)) seen.set(el, placeOf(el, slide));
  const all = [...(checks.get(slide) ?? []).filter((c) => !c.scope || c.scope.isConnected), { scope, seen }];
  checks.set(slide, all.slice(-64));
  app.invalidate('layout');
}

let sentences: string[] = [];
export const coverSentences = (): string[] => sentences;

const many = (n: number, word: string): string => (n === 1 ? `a ${word}` : `${n} ${word}${word.endsWith('x') ? 'es' : 's'}`);
const texts = (n: number): string => `${n} text${n === 1 ? '' : 's'}`;
const are = (n: number): string => (n === 1 ? 'is' : 'are');
function figures(fs: Set<Element>): string {
  const count = new Map<string, number>();
  for (const f of fs) count.set(kindOf(f), (count.get(kindOf(f)) ?? 0) + 1);
  const named = [...count].map(([kind, n]) => many(n, kind));
  return named.length < 3 ? named.join(' and ') : `${named.slice(0, -1).join(', ')}, and ${named.at(-1)}`;
}
function sentencesOf(pairs: { text: Element; fig: Element }[]): string[] {
  const out: string[] = [];
  for (const up of [true, false]) {
    const some = pairs.filter((p) => drawnUnder(p.text, p.fig) === up);
    if (!some.length) continue;
    const fs = new Set(some.map((p) => p.fig));
    const ts = new Set(some.map((p) => p.text)).size;
    out.push(`${texts(ts)} ${are(ts)} ${up ? 'under' : 'over'} ${figures(fs)}`);
  }
  return out;
}

const CSS = `
html.beeson-editing .reveal .beeson-overflow { outline: 2px dashed var(--accent, #f80) !important; outline-offset: 6px; }
`;

export function install(app: App): void {
  injectStyle('overflow', CSS);
  app.onRefresh(ALL, () => {
    const slide = app.current();
    const box = app.slides().getBoundingClientRect();
    let n = 0;
    let over = 0;
    const pairs: { text: Element; fig: Element }[] = [];
    if (slide && box.width > 0) {
      const foot = slide.querySelector(':scope > .foot, :scope > .text-column > .foot');
      const past = (r: DOMRect) => r.right > box.right + 1 || r.bottom > box.bottom + 1 || r.left < box.left - 1 || r.top < box.top - 1;
      const meets = (r: DOMRect, b: DOMRect | undefined) => !!b && b.height > 0 && r.bottom > b.top + 1 && r.top < b.bottom - 1 && r.right > b.left + 1 && r.left < b.right - 1;
      const above = slide.matches('.figure') ? [...slide.querySelectorAll(':scope > h2, :scope > .run')].map((e) => e.getBoundingClientRect()) : [];
      const partOf = (el: Element) => [...slide.children].find((c) => c.contains(el));
      const live = (checks.get(slide) ?? []).filter((c) => !c.scope || c.scope.isConnected);
      const now = new Map<Element, string>();
      const at = (el: Element) => now.get(el) ?? now.set(el, placeOf(el, slide)).get(el);
      const checked = (t: Element, f: Element) => live.some((c) => c.seen.get(t) === at(t) && c.seen.get(f) === at(f) && (!c.scope || c.scope.contains(t) || c.scope.contains(f)));
      const figures = [...slide.querySelectorAll(FIGURE)].filter((f) => !f.closest('.plate, .backdrop, .surface, .beeson-off') && !f.parentElement?.closest('.plot') && !f.matches('pre.beeson-pending'))
        .map((f) => ({ el: f, part: partOf(f), r: f.getBoundingClientRect(), q: turnedOf(f, slide) })).filter((f) => f.r.width > 0 && f.r.height > 0);
      const lines = (el: Element) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const shown = [...el.querySelectorAll('mjx-container[display="true"]')];
        const textEls = shown.map((c) => c.getBoundingClientRect());
        const same = (a: DOMRect, b: DOMRect) => Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 && Math.abs(a.right - b.right) < 1 && Math.abs(a.bottom - b.bottom) < 1;
        const rects = [...range.getClientRects()].filter((r) => !textEls.some((b) => same(r, b)));
        rects.push(...shown.flatMap((c) => [...c.querySelectorAll(':scope > svg')].map((g) => g.getBoundingClientRect())));
        return rects.filter((r) => r.width > 1 && r.height > 1);
      };
      const footLines = foot ? lines(foot) : [];
      const intoFoot = (r: DOMRect) => footLines.some((l) => meets(r, l));
      for (const el of slide.querySelectorAll(HOST)) {
        if (el.closest('aside.notes, .backdrop, .beeson-off') || (el.matches('.beeson-pending') && !el.textContent)) {
          el.classList.remove('beeson-overflow');
          continue;
        }
        const r = el.getBoundingClientRect();
        const reach = !!el.closest('section.figure > .caption') && above.some((b) => meets(r, b));
        const part = partOf(el);
        const others = figures.filter((f) => f.part !== part && checked(el, f.el));
        const hit = (others.length ? lines(el) : []).map((l) => DOMRect.fromRect({ x: Math.max(l.left, r.left), y: Math.max(l.top, r.top), width: Math.min(l.right, r.right) - Math.max(l.left, r.left), height: Math.min(l.bottom, r.bottom) - Math.max(l.top, r.top) })).filter((l) => l.width > 1 && l.height > 1);
        const under = others.filter((f) => hit.some((l) => (f.q ? cuts(l, f.q) : meets(l, f.r))));
        for (const f of under) pairs.push({ text: el, fig: f.el });
        const onFigure = under.length > 0;
        const tilted = turnOf(el, slide) ? lines(el) : null;
        const off = tilted ? tilted.some(past) : past(r);
        const out = r.width > 0 && r.height > 0 && (off || reach || onFigure || (el !== foot && !foot?.contains(el) && (tilted ? tilted.some(intoFoot) : intoFoot(r))));
        el.classList.toggle('beeson-overflow', out);
        if (out) n += 1;
        if (out && onFigure) over += 1;
      }
    }
    const said = sentencesOf(pairs);
    if (n !== app.overflow || over !== app.overFigure || said.join() !== sentences.join()) {
      app.overflow = n;
      app.overFigure = over;
      sentences = said;
      app.report();
    }
  });
}
