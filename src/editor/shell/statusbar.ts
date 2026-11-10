// the status bar of today: the previous and next slide with the number of the current one, the
// layer switch, a hint, and the buttons Slides, Steps, and Notes. the status bar of the plan is
// built here

import type { App } from '../app.ts';
import { button, injectStyle, make, wire } from '../ui/dom.ts';

const CSS = `
.beeson-edit-bottom { bottom: 0; height: 36px; font-size: 13px; color: var(--subtle, #bbb); border-top: 1px solid var(--line, #555); }
.beeson-edit-bottom button { padding: 2px 10px; font-size: 13px; }
.beeson-edit-bottom button.on { border-color: var(--violet, #96f); color: var(--text, #eee); }
.beeson-edit-bottom .count { white-space: nowrap; min-width: 9ch; text-align: center; }
.beeson-edit-bottom .beeson-layers { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.beeson-edit-bottom .beeson-layers[hidden] { display: none; }
.beeson-edit-bottom .beeson-layers > span { margin-right: 4px; }
.beeson-edit-bottom .hint { flex: 1; min-width: 0; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

// layers is the switch of layers.ts, placed between the slide number and the hint
export function install(app: App, layers: HTMLElement): void {
  injectStyle('statusbar', CSS);
  const bottom = make('div', 'beeson-edit-bottom');
  const prevButton = button('‹', 'Previous slide', 'Previous slide');
  const countEl = make('span', 'count');
  const nextButton = button('›', 'Next slide', 'Next slide');
  const hintEl = make('span', 'hint', 'Click a text or a formula to edit it, drag a figure or the ⠿ handle of a block to move it, press G to jump to a slide, and Esc to leave a text and select its block');
  bottom.append(prevButton, countEl, nextButton, layers, hintEl, app.nav.button, app.steps.button, app.notes.button);
  const fail = (e: unknown) => app.fail(e);
  wire(prevButton, () => app.commands.run('navigate.previous'), fail);
  wire(nextButton, () => app.commands.run('navigate.next'), fail);
  wire(app.notes.button, () => app.commands.run('view.notes'), fail);
  const count = () => {
    const d = app.deck();
    if (d) countEl.textContent = `Slide ${d.getSlidePastCount() + 1} of ${d.getTotalSlides()}`;
  };
  app.listen('slide', count);
  app.listen('resize', count);
  document.body.append(bottom);
}
