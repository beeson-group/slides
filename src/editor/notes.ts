// the speaker notes of the current slide, laid over a pane under the slide while the Notes button
// is on, and the strip above the pane that changes its height. while the notes are shown, a slide
// without notes gets an empty aside to type into. an aside without text is not written into the
// file, hence it does not make the deck dirty

import type { App, Notes } from './app.ts';
import { button, injectStyle, make, store, stored } from './ui/dom.ts';

const PANE_KEY = 'beeson-pane';

// --beeson-scale is the scale of the slide, --beeson-gap the room under the slide in the viewport
// of reveal.js, and --beeson-side the room beside it on each side, in slide pixels, all set by
// shell/canvas.ts. --beeson-pane is the height of the pane, in CSS pixels
const CSS = `
.beeson-edit-pane { position: fixed; left: 0; right: 0; bottom: 36px; z-index: 0; height: var(--beeson-pane, 200px); box-sizing: border-box; display: none; background: var(--bg, #000); border-top: 1px solid var(--line, #555); color: var(--subtle, #bbb); font: 12px/1.4 system-ui, sans-serif; padding: 8px 16px; }
html.beeson-notes .beeson-edit-pane { display: block; }
html.beeson-nav .beeson-edit-pane, html.beeson-nav .beeson-edit-resize { left: 240px; }
html.beeson-steps .beeson-edit-pane, html.beeson-steps .beeson-edit-resize { right: 320px; }
.beeson-edit-resize { position: fixed; left: 0; right: 0; bottom: calc(36px + var(--beeson-pane, 200px) - 4px); height: 8px; z-index: 56; display: none; cursor: ns-resize; }
html.beeson-notes .beeson-edit-resize { display: block; }
.beeson-edit-resize:hover { background: color-mix(in srgb, var(--violet, #96f) 45%, transparent); }
.beeson-edit-resize:focus-visible { outline: none; background: color-mix(in srgb, var(--violet, #96f) 45%, transparent); }
html.beeson-editor.beeson-notes .reveal .slides section.present { overflow: visible; clip-path: inset(0 calc(-1 * var(--beeson-side, 0px)) calc(-1 * (var(--beeson-pane, 200px) / var(--beeson-scale, 1) + var(--beeson-gap, 0px))) calc(-1 * var(--beeson-side, 0px))); }
html.beeson-editor.beeson-notes .reveal .slides section.present > aside.notes { display: block; position: absolute; left: calc(-1 * var(--beeson-side, 0px)); right: calc(-1 * var(--beeson-side, 0px)); top: calc(100% + var(--beeson-gap, 0px)); z-index: 5; box-sizing: border-box; height: calc(var(--beeson-pane, 200px) / var(--beeson-scale, 1)); margin: 0; padding: calc(30px / var(--beeson-scale, 1)) calc(16px / var(--beeson-scale, 1)) calc(12px / var(--beeson-scale, 1)); font-size: calc(15px / var(--beeson-scale, 1)); line-height: 1.5; text-align: left; color: var(--text, #eee); background: transparent; overflow: auto; outline: 1px solid transparent; outline-offset: -1px; }
html.beeson-editor.beeson-notes .reveal .slides section.present > aside.notes:focus { outline-color: var(--violet, #96f); }
html.beeson-editor.beeson-notes .reveal .slides section.present > aside.notes:empty::before { content: 'Click to add notes'; color: var(--subtle, #bbb); }
`;

export function install(app: App): void {
  injectStyle('notes', CSS);
  const notesButton = button('Notes', 'Show the speaker notes under the slide');
  notesButton.setAttribute('aria-pressed', 'false');
  const pane = make('div', 'beeson-edit-pane', 'Notes');
  const resizer = make('div', 'beeson-edit-resize');
  resizer.title = 'Drag to change the height of the notes, or focus it and press the up and down arrows';
  resizer.tabIndex = 0;
  resizer.setAttribute('role', 'separator');
  resizer.setAttribute('aria-orientation', 'horizontal');
  resizer.setAttribute('aria-label', 'Height of the notes');
  resizer.setAttribute('aria-valuemin', '120');
  resizer.setAttribute('aria-valuemax', '600');
  let paneHeight = 200;

  const shown = () => document.documentElement.classList.contains('beeson-notes');

  function setPane(height: number): void {
    paneHeight = Math.max(120, Math.min(600, Math.round(height)));
    document.documentElement.style.setProperty('--beeson-pane', `${paneHeight}px`);
    resizer.setAttribute('aria-valuenow', String(paneHeight));
    app.relayout();
    app.invalidate('layout');
  }

  function ensure(): HTMLElement | null {
    const slide = app.current();
    if (!slide || !app.pairing?.blocks.length || !shown()) return null;
    let aside = slide.querySelector<HTMLElement>(':scope > aside.notes');
    if (!aside) {
      aside = make('aside', 'notes');
      aside.setAttribute('contenteditable', 'true');
      aside.setAttribute('aria-label', 'Speaker notes');
      slide.append(aside);
    }
    return aside;
  }

  function toggle(): void {
    const on = document.documentElement.classList.toggle('beeson-notes');
    notesButton.classList.toggle('on', on);
    notesButton.setAttribute('aria-pressed', String(on));
    app.relayout();
    app.invalidate('layout');
    if (on) ensure()?.focus({ preventScroll: true });
  }

  resizer.addEventListener('keydown', (ev) => {
    const step = ev.key === 'ArrowUp' ? 20 : ev.key === 'ArrowDown' ? -20 : 0;
    if (!step) return;
    ev.preventDefault();
    ev.stopPropagation();
    setPane(paneHeight + step);
    store(PANE_KEY, String(paneHeight));
  });
  resizer.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    const startY = ev.clientY;
    const startHeight = paneHeight;
    const onMove = (e: PointerEvent) => setPane(startHeight + startY - e.clientY);
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      store(PANE_KEY, String(paneHeight));
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });
  app.listen('slide', () => void ensure());
  document.body.append(pane, resizer);
  const notes: Notes = { button: notesButton, shown, toggle, ensure, setPane, height: () => paneHeight };
  app.notes = notes;
  setPane(Number(stored(PANE_KEY)) || 200);
}
