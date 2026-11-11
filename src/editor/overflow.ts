// a text of the current slide that runs past the edge of the slide, or into the footnote line at
// its bottom, or a text of the caption of a figure slide that reaches up to the heading or the
// running head, is marked, as the bounds of a text box in PowerPoint, and counted in app.overflow,
// which the state line reports. a line of a text drawn over a picture, a video, a plot, a QR
// code, a table, or a code box of another part of the slide, e.g. after a change of the layout, is
// marked and counted as well, in app.overFigure. a plate and a backdrop lie under the words of
// their layout

import { ALL, HOST, type App } from './app.ts';
import { injectStyle } from './ui/dom.ts';

// the pictures, tables, and code boxes that a text is not drawn over
const FIGURE = 'img, video, canvas, iframe, tycho-viewer, .plot, .qr, table, pre';

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
    if (slide && box.width > 0) {
      const foot = slide.querySelector(':scope > .foot, :scope > .panel > .foot');
      const past = (r: DOMRect) => r.right > box.right + 1 || r.bottom > box.bottom + 1 || r.left < box.left - 1 || r.top < box.top - 1;
      const meets = (r: DOMRect, b: DOMRect | undefined) => !!b && b.height > 0 && r.bottom > b.top + 1 && r.top < b.bottom - 1 && r.right > b.left + 1 && r.left < b.right - 1;
      const above = slide.matches('.figure') ? [...slide.querySelectorAll(':scope > h2, :scope > .run')].map((e) => e.getBoundingClientRect()) : [];
      const partOf = (el: Element) => [...slide.children].find((c) => c.contains(el));
      const figures = [...slide.querySelectorAll(FIGURE)].filter((f) => !f.closest('.plate, .backdrop, .surface') && !f.parentElement?.closest('.plot'))
        .map((f) => ({ part: partOf(f), r: f.getBoundingClientRect() })).filter((f) => f.r.width > 0 && f.r.height > 0);
      const lines = (el: Element) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        // a display formula is a block as wide as its column, hence it is measured by its glyphs
        const shown = [...el.querySelectorAll('mjx-container[display="true"]')];
        const blocks = shown.map((c) => c.getBoundingClientRect());
        const same = (a: DOMRect, b: DOMRect) => Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 && Math.abs(a.right - b.right) < 1 && Math.abs(a.bottom - b.bottom) < 1;
        const rects = [...range.getClientRects()].filter((r) => !blocks.some((b) => same(r, b)));
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
        const others = figures.filter((f) => f.part !== part);
        const onFigure = others.length > 0 && lines(el).some((l) => others.some((f) => meets(l, f.r)));
        const out = r.width > 0 && r.height > 0 && (past(r) || reach || onFigure || (el !== foot && !foot?.contains(el) && intoFoot(r)));
        el.classList.toggle('beeson-overflow', out);
        if (out) n += 1;
        if (out && onFigure) over += 1;
      }
    }
    if (n !== app.overflow || over !== app.overFigure) {
      app.overflow = n;
      app.overFigure = over;
      app.report();
    }
  });
}
