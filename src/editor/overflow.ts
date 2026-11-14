// a text of the current slide that runs past the edge of the slide, or into the footnote line at
// its bottom, or a text of the caption of a figure slide that reaches up to the heading or the
// running head, is marked, as the bounds of a text box in PowerPoint, and counted in app.overflow,
// which the state line reports. a line of a text drawn over a picture, a video, a plot, a QR
// code, a table, or a code box of another part of the slide is marked and counted as well, in
// app.overFigure, after a change of the layout of the slide and for a new element that the editor
// put on it, by the turned box of a turned picture. neither Keynote nor PowerPoint comments on an
// overlap that the user made, hence an overlap leaves the report once the user moves the text or
// the figure. a plate and a backdrop lie under the words of their layout

import { ALL, HOST, type App } from './app.ts';
import { drawnUnder } from './commands/order.ts';
import { injectStyle } from './ui/dom.ts';
import { orientedBox, scaleAt } from './canvas/hit.ts';

// the pictures, tables, and code boxes that a text is not drawn over
const FIGURE = 'img, video, canvas, iframe, tycho-viewer, .plot, .qr, .tikz, table, pre';

// a picture turned by its own rotate or by that of an element around it, on the screen: the center
// and the half sizes of its picture as it is seen without the rotation, and the angle in radians
type Turned = { x: number; y: number; w: number; h: number; a: number };

// the angle of el in degrees with the elements around it on the slide
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

// whether the box r on the screen and the turned picture q overlap by more than 1 px, as meets
// takes two upright boxes, by the separating axes of both
function cuts(r: DOMRect, q: Turned): boolean {
  const w = r.width / 2 - 1, h = r.height / 2 - 1;
  const dx = q.x - (r.left + r.width / 2), dy = q.y - (r.top + r.height / 2);
  const c = Math.abs(Math.cos(q.a)), s = Math.abs(Math.sin(q.a));
  if (Math.abs(dx) >= w + q.w * c + q.h * s || Math.abs(dy) >= h + q.w * s + q.h * c) return false;
  const u = Math.abs(dx * Math.cos(q.a) + dy * Math.sin(q.a)), v = Math.abs(dy * Math.cos(q.a) - dx * Math.sin(q.a));
  return u < q.w + w * c + h * s && v < q.h + w * s + h * c;
}

// the names of the figures in the state line, by the words of AGENTS.md
const KINDS: [string, string][] = [['img', 'picture'], ['video', 'video'], ['.plot', 'plot'], ['.qr', 'QR code'], ['.tikz', 'TikZ figure'], ['table', 'table'], ['pre', 'code box'], ['tycho-viewer', 'scene']];
const kindOf = (f: Element): string => KINDS.find(([s]) => f.matches(s))?.[1] ?? 'figure';

// a check of the overlaps on slide, made by checkOverlaps. scope is null after a change of the
// layout, and else the new element whose overlaps are reported. seen maps each element of the
// file on the slide to its placeOf at the check, and an element whose placeOf differs is left out
// of the report until an undo puts it back. the checks are kept per slide, at most 64 of them,
// hence the inserts on one slide do not take the report of another away
type Check = { scope: Element | null; seen: Map<Element, string> };
const checks = new WeakMap<Element, Check[]>();

// the declarations of the style of el and of its parents inside slide, which a drag, a nudge, a
// field, a resize, a rotation, an align, a distribute, and a layer command change. they are read
// as the browser serializes them, since an undo may give the attribute back with a closing
// semicolon. the style of the section is left out, since reveal.js writes it
const placeOf = (el: Element, slide: Element): string => {
  let k = '';
  for (let e: Element | null = el; e && e !== slide; e = e.parentElement) k += `${(e as HTMLElement).style?.cssText ?? ''}|`;
  return k;
};

// called by the change of a layout, with scope null, and by an insert that the editor places,
// with the new element. an undo takes the slide or scope off the page, and the check with it. a
// check whose scope is off the page is dropped at the next check of its slide, since this check is
// made in a new entry of the history, after which an undone insert is not redone
export function checkOverlaps(app: App, slide: Element | null, scope: Element | null = null): void {
  if (!slide) return;
  const seen = new Map<Element, string>();
  for (const el of slide.querySelectorAll('*')) if (app.pairing?.elements.has(el)) seen.set(el, placeOf(el, slide));
  const all = [...(checks.get(slide) ?? []).filter((c) => !c.scope || c.scope.isConnected), { scope, seen }];
  checks.set(slide, all.slice(-64));
  app.invalidate('layout');
}

// the sentences of the state line on the texts reported over a figure, e.g. "A table covers 1
// text", which name the one drawn over the other first
let sentences: string[] = [];
export const coverSentences = (): string[] => sentences;

const many = (n: number, word: string): string => (n === 1 ? `a ${word}` : `${n} ${word}${word.endsWith('x') ? 'es' : 's'}`);
const texts = (n: number): string => `${n} text${n === 1 ? '' : 's'}`;
const verb = (n: number): string => (n === 1 ? 'covers' : 'cover');
// the figures by kind, in the order in which they are met, e.g. 2 tables and a plot, or a
// picture, a table, and a QR code
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
    const named = figures(fs);
    out.push(up ? `${named[0].toUpperCase()}${named.slice(1)} ${verb(fs.size)} ${texts(ts)}` : `${texts(ts)} ${verb(ts)} ${named}`);
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
      // an empty new code box is not in the file yet
      const figures = [...slide.querySelectorAll(FIGURE)].filter((f) => !f.closest('.plate, .backdrop, .surface') && !f.parentElement?.closest('.plot') && !f.matches('pre.beeson-pending'))
        .map((f) => ({ el: f, part: partOf(f), r: f.getBoundingClientRect(), q: turnedOf(f, slide) })).filter((f) => f.r.width > 0 && f.r.height > 0);
      const lines = (el: Element) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        // a display formula is a text element as wide as its column, hence it is measured by its glyphs
        const shown = [...el.querySelectorAll('mjx-container[display="true"]')];
        const textEls = shown.map((c) => c.getBoundingClientRect());
        const same = (a: DOMRect, b: DOMRect) => Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 && Math.abs(a.right - b.right) < 1 && Math.abs(a.bottom - b.bottom) < 1;
        const rects = [...range.getClientRects()].filter((r) => !textEls.some((b) => same(r, b)));
        rects.push(...shown.flatMap((c) => [...c.querySelectorAll(':scope > svg')].map((g) => g.getBoundingClientRect())));
        return rects.filter((r) => r.width > 1 && r.height > 1);
      };
      // the footnote is measured by the lines of its text, since its box runs past the end of its text
      const footLines = foot ? lines(foot) : [];
      const intoFoot = (r: DOMRect) => footLines.some((l) => meets(r, l));
      for (const el of slide.querySelectorAll(HOST)) {
        // an empty placeholder of the editor is not a text of the slide
        if (el.closest('aside.notes, .backdrop') || (el.matches('.beeson-pending') && !el.textContent)) {
          el.classList.remove('beeson-overflow');
          continue;
        }
        const r = el.getBoundingClientRect();
        const reach = !!el.closest('section.figure > .caption') && above.some((b) => meets(r, b));
        const part = partOf(el);
        const others = figures.filter((f) => f.part !== part && checked(el, f.el));
        // a line is clipped to the box r of its text, since the content area of its font is taller
        // than the box of a heading with a tight line height. a turned picture is met by its turned
        // box, not by the box upright around it
        const hit = (others.length ? lines(el) : []).map((l) => DOMRect.fromRect({ x: Math.max(l.left, r.left), y: Math.max(l.top, r.top), width: Math.min(l.right, r.right) - Math.max(l.left, r.left), height: Math.min(l.bottom, r.bottom) - Math.max(l.top, r.top) })).filter((l) => l.width > 1 && l.height > 1);
        const under = others.filter((f) => hit.some((l) => (f.q ? cuts(l, f.q) : meets(l, f.r))));
        for (const f of under) pairs.push({ text: el, fig: f.el });
        const onFigure = under.length > 0;
        // a turned text, e.g. the caption of a turned figure, runs past by its lines, since the box
        // upright around its turned box runs past them
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
