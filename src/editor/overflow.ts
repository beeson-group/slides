// a text of the current slide that runs past the edge of the slide, or into the footnote line at
// its bottom, or a text of the caption of a figure slide that reaches up to the heading or the
// running head, is marked, as the bounds of a text box in PowerPoint, and counted in app.overflow,
// which the state line reports

import { ALL, HOST, type App } from './app.ts';
import { injectStyle } from './ui/dom.ts';

const CSS = `
html.beeson-editing .reveal .beeson-overflow { outline: 2px dashed var(--accent, #f80) !important; outline-offset: 6px; }
`;

export function install(app: App): void {
  injectStyle('overflow', CSS);
  app.onRefresh(ALL, () => {
    const slide = app.current();
    const box = app.slides().getBoundingClientRect();
    let n = 0;
    if (slide && box.width > 0) {
      const foot = slide.querySelector(':scope > .foot');
      const f = foot?.getBoundingClientRect();
      const past = (r: DOMRect) => r.right > box.right + 1 || r.bottom > box.bottom + 1 || r.left < box.left - 1 || r.top < box.top - 1;
      const meets = (r: DOMRect, b: DOMRect | undefined) => !!b && b.height > 0 && r.bottom > b.top + 1 && r.top < b.bottom - 1 && r.right > b.left + 1 && r.left < b.right - 1;
      const intoFoot = (r: DOMRect) => meets(r, f);
      const above = slide.matches('.figure') ? [...slide.querySelectorAll(':scope > h2, :scope > .run')].map((e) => e.getBoundingClientRect()) : [];
      for (const el of slide.querySelectorAll(HOST)) {
        if (el.closest('aside.notes, .backdrop')) continue;
        const r = el.getBoundingClientRect();
        const over = !!el.closest('section.figure > .caption') && above.some((b) => meets(r, b));
        const out = r.width > 0 && r.height > 0 && (past(r) || over || (el !== foot && !foot?.contains(el) && intoFoot(r)));
        el.classList.toggle('beeson-overflow', out);
        if (out) n += 1;
      }
    }
    if (n !== app.overflow) {
      app.overflow = n;
      app.report();
    }
  });
}
