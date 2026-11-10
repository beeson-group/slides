// the transition of the slide at the head of the Steps tab, as in the Animate inspector of Keynote
// with no element selected: None, Fade, or Magic Move to the next slide, Magic Move to a copy of
// the slide, and the time of the slide in the last rehearsal. each button runs a command of
// commands/review.ts, and the block is hidden while an element or a text is selected

import type { App } from '../app.ts';
import { injectStyle, make } from '../ui/dom.ts';

const CSS = `
html.beeson-editor .beeson-edit-side .slot { padding: 2px 12px 10px; border-bottom: 1px solid var(--ed-line); }
html.beeson-editor .beeson-edit-side .slot[hidden] { display: none; }
.beeson-edit-transition h5 { margin: 4px 0 8px; color: var(--ed-text); font: 600 12px/1.2 var(--ed-font); }
.beeson-edit-transition .seg { display: flex; padding: 2px; border-radius: 7px; background: var(--ed-segment); box-shadow: inset 0 0 0 1px var(--ed-control-line); }
.beeson-edit-transition .seg button { flex: 1; height: 22px; padding: 0 6px; border: 0; border-radius: 5px; background: transparent; color: var(--ed-text); font: 500 12px/1 var(--ed-font); white-space: nowrap; cursor: default; }
.beeson-edit-transition .seg button[aria-pressed="true"] { background: var(--ed-control); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18), inset 0 0 0 1px var(--ed-control-line); }
.beeson-edit-transition .seg button:disabled { color: var(--ed-faint); }
.beeson-edit-transition .copy { display: block; width: 100%; height: 24px; margin-top: 8px; border: 1px solid var(--ed-control-line); border-radius: 6px; background: var(--ed-control); color: var(--ed-text); font: 500 12px/1 var(--ed-font); cursor: default; }
.beeson-edit-transition .copy:disabled { color: var(--ed-faint); }
.beeson-edit-transition button:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 1px; }
.beeson-edit-transition .note { margin: 8px 0 0; color: var(--ed-muted); font: 11px/1.35 var(--ed-font); }
.beeson-edit-transition .note:empty { display: none; }
`;

const KINDS: [string, string, string][] = [
  ['none', 'None', 'Cut to the next slide without an effect'],
  ['fade', 'Fade', 'Fade to the next slide, the default of the theme'],
  ['magic', 'Magic Move', 'Move the matched elements to their places on the next slide'],
];

export function install(app: App): void {
  const slot = (app.steps as unknown as { slot?: HTMLElement }).slot;
  if (!slot) return;
  injectStyle('animate', CSS);
  const box = make('div', 'beeson-edit-transition');
  const seg = make('div', 'seg');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Transition to the next slide');
  const run = (id: string) => void app.commands.run(id).catch((e) => app.fail(e));
  const buttons = KINDS.map(([t, text, title]) => {
    const b = make('button', '', text);
    b.type = 'button';
    b.title = title;
    b.dataset.command = `slide.transition.${t}`;
    b.addEventListener('click', () => run(b.dataset.command!));
    seg.append(b);
    return b;
  });
  const copy = make('button', 'copy', 'Magic Move to Copy');
  copy.type = 'button';
  copy.dataset.command = 'slide.magicMove';
  copy.title = 'Duplicate the slide after itself, joined by Magic Move, and move its elements on the copy';
  copy.addEventListener('click', () => run('slide.magicMove'));
  const note = make('p', 'note');
  box.append(make('h5', '', 'Transition'), seg, copy, note);
  slot.replaceChildren(box);
  const sync = () => {
    const kind = app.selection.kind;
    slot.hidden = kind === 'elements' || kind === 'text';
    if (slot.hidden) return;
    for (const b of buttons) {
      const s = app.commands.state(b.dataset.command!);
      b.disabled = !s.enabled;
      b.setAttribute('aria-pressed', String(!!s.checked));
    }
    copy.disabled = !app.commands.state('slide.magicMove').enabled;
    const t = app.current()?.getAttribute('data-timing');
    note.textContent = t ? `Rehearsed time of the slide: ${t} s` : '';
  };
  app.selection.listen(sync);
  app.onRefresh(['content', 'structure', 'slide', 'selection', 'layout'], sync);
  sync();
}
