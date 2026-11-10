// a text of the current slide that runs past the edge of the slide, or into the footnote line at
// its bottom, is marked, as the bounds of a text box in PowerPoint, and counted in app.overflow,
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
      const intoFoot = (r: DOMRect) => !!f && f.height > 0 && r.bottom > f.top + 1 && r.top < f.bottom - 1 && r.right > f.left + 1 && r.left < f.right - 1;
      for (const el of slide.querySelectorAll(HOST)) {
        if (el.closest('aside.notes, .backdrop')) continue;
        const r = el.getBoundingClientRect();
        const out = r.width > 0 && r.height > 0 && (past(r) || (el !== foot && !foot?.contains(el) && intoFoot(r)));
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
