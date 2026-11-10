// the stage of the slide: the viewport of reveal.js is shrunk between the bars and the panes, and
// the scale of the slide, the room under it, and the overhang of the stage beyond it on each side
// are written into custom properties on html for the notes pane in notes.ts. every step of a slide
// is shown, apart from the elements of another layer, and the progress line and the slide number
// of the theme are hidden. the zoom and the pasteboard of the plan are built here

import type { App } from '../app.ts';
import { injectStyle } from '../ui/dom.ts';

const CSS = `
html.beeson-editor { --beeson-left: 6px; --beeson-right: 6px; }
html.beeson-editor.beeson-nav { --beeson-left: 246px; }
html.beeson-editor.beeson-steps { --beeson-right: 326px; }
html.beeson-editor .reveal:not(.beeson-peek) { position: relative; z-index: 1; height: calc(100% - 80px) !important; margin-top: 44px; margin-left: var(--beeson-left); width: calc(100% - var(--beeson-left) - var(--beeson-right)) !important; overflow: visible; }
html.beeson-editor.beeson-notes .reveal:not(.beeson-peek) { height: calc(100% - 80px - var(--beeson-pane, 200px)) !important; }
html.beeson-editor .reveal .progress, html.beeson-editor .reveal .slide-number { display: none !important; }
html.beeson-editing .reveal .slides section .fragment { visibility: visible !important; opacity: 1 !important; transition: none !important; }
html.beeson-editing .reveal .slides section .fragment.beeson-off { visibility: hidden !important; }
`;

export function install(app: App): void {
  injectStyle('canvas', CSS);
  const layout = () => {
    const d = app.deck();
    if (!d) return;
    const scale = d.getScale();
    const reveal = document.querySelector('.reveal')?.getBoundingClientRect();
    const box = app.slides().getBoundingClientRect();
    const root = document.documentElement.style;
    const gap = reveal ? Math.max(0, reveal.bottom - box.bottom) / scale : 0;
    root.setProperty('--beeson-scale', String(scale));
    root.setProperty('--beeson-gap', `${gap}px`);
    const side = reveal ? Math.max(0, (reveal.width - box.width) / 2) / scale : 0;
    root.setProperty('--beeson-side', `${side}px`);
  };
  app.listen('resize', layout);
}
