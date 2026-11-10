// the commands that move between the slides, in the View menu. Page Down and Page Up move on the
// canvas and in the navigator, Home and End on the canvas, and the arrows on the canvas while no
// element is selected, since the arrows then nudge the selection. in the navigator, the arrows,
// Home, and End are taken by the list of nav.ts, which moves its focus with the slide. G opens a
// field for the number of a slide, and on a Mac the key of Keynote does too

import type { App } from '../app.ts';
import { injectStyle, make } from '../ui/dom.ts';

const CSS = `
.beeson-edit-goto { position: fixed; top: 56px; left: 50%; z-index: 70; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--line, #555); border-radius: 8px; background: var(--bg, #000); color: var(--text, #eee); font: 13px/1.4 system-ui, sans-serif; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); }
.beeson-edit-goto[hidden] { display: none; }
.beeson-edit-goto input { width: 6ch; font: inherit; padding: 2px 6px; border: 1px solid var(--line, #555); border-radius: 4px; background: transparent; color: inherit; }
`;

const sections = (app: App): Element[] => [...app.slides().querySelectorAll(':scope > section')];

function go(app: App, to: (at: number, count: number) => number): void {
  const all = sections(app);
  const current = app.current()?.closest('.slides > section');
  const at = current ? all.indexOf(current) : -1;
  const i = Math.max(0, Math.min(all.length - 1, to(at, all.length)));
  if (all[i] && i !== at) app.showSlide(all[i]);
}

// the field of G. its input keeps the class of the field of reveal.js, which the tests find. Enter
// goes to the slide of the number typed, and Esc gives the focus back
function gotoField(app: App): () => void {
  injectStyle('goto', CSS);
  const box = make('div', 'beeson-edit-goto');
  const input = make('input', 'jump-to-slide-input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.setAttribute('aria-label', 'Slide number');
  box.append(make('span', '', 'Go to slide'), input);
  box.hidden = true;
  let back: Element | null = null;
  const close = (restore: boolean) => {
    if (box.hidden) return;
    box.hidden = true;
    if (restore && back instanceof HTMLElement && back.isConnected) back.focus();
    else input.blur();
  };
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const n = Number.parseInt(input.value, 10);
      close(false);
      if (n >= 1) go(app, (_, count) => Math.min(n, count) - 1);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      close(true);
    }
  });
  input.addEventListener('blur', () => close(false));
  document.body.append(box);
  return () => {
    back = document.activeElement;
    input.value = '';
    box.hidden = false;
    input.focus();
  };
}

export function install(app: App): void {
  const c = app.commands;
  const both = (...keys: string[]) => ({ mac: keys, other: keys });
  const view = (order: number) => ({ bar: 'View', group: 'go', order });
  // the arrows change the slide only while no element is selected
  const free = (a: App) => a.selection.kind !== 'elements';
  c.define({ id: 'navigate.next', label: 'Next Slide', keys: both('PageDown'), menu: view(40), run: (a) => go(a, (at) => at + 1) });
  c.define({ id: 'navigate.previous', label: 'Previous Slide', keys: both('PageUp'), menu: view(41), run: (a) => go(a, (at) => at - 1) });
  c.define({ id: 'navigate.first', label: 'First Slide', keys: both('Home'), in: ['canvas'], menu: view(42), run: (a) => go(a, () => 0) });
  c.define({ id: 'navigate.last', label: 'Last Slide', keys: both('End'), in: ['canvas'], menu: view(43), run: (a) => go(a, (_, count) => count - 1) });
  const open = gotoField(app);
  c.define({ id: 'navigate.goTo', label: 'Go to Slide…', keys: { mac: ['G', 'Ctrl+Mod+G'], other: ['G'] }, menu: view(44), run: () => open() });
  c.define({ id: 'navigate.nextArrow', label: 'Next Slide', keys: both('ArrowRight', 'ArrowDown'), in: ['canvas'], enabled: free, run: (a) => go(a, (at) => at + 1) });
  c.define({ id: 'navigate.previousArrow', label: 'Previous Slide', keys: both('ArrowLeft', 'ArrowUp'), in: ['canvas'], enabled: free, run: (a) => go(a, (at) => at - 1) });
}
