// Preview of the toolbar, a split button before Present. its main part runs Play Slide, which
// traces the backdrop of the current slide once and then plays its steps, and its menu runs Trace
// Backdrop and Play Steps alone, Select Backdrop, and Add Backdrop…. the backdrop is traced on the
// canvas as Preview of the Backdrop pane traces it, and the steps are drawn on a layer over the
// canvas, one per timing.step ms, each by showStep of present.ts as the show draws it. a preview
// stops at a click on Stop, Esc, a press outside the toolbar and the menus, a change of slide, an
// edit, and Chapters Table, after which the slide is drawn complete. it does not change the file,
// the history, or the selection, which is not drawn while it plays

import type { App } from '../app.ts';
import { previewPlays, setPreview, stopPreviews } from '../canvas/frames.ts';
import { showFormat } from '../inspector/inspector.ts';
import { OFF } from '../layers.ts';
import { drawInto } from '../navigator/thumbs.ts';
import { showStep, stepsOfSlide } from '../present.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { liveOf, slideBackdrop, type Live } from './backdrop.ts';

// the delay of each step in ms, which a test shortens through BeesonEditor.preview
export const timing = { step: 1000 };

const CSS = `
.beeson-edit-play { position: fixed; z-index: 65; overflow: hidden; pointer-events: none; }
.beeson-edit-play > .shot { position: absolute; inset: 0; }
`;

const theme = () => (window as unknown as { Beeson?: { preview?(el: HTMLElement): Live } }).Beeson;

// the seconds in which the drawing of the theme traces its last strand, after its stagger
const spanOf = (o: Live) => (o as Live & { span?: number }).span ?? 20;

// the preview that plays, whose stop ends its waits, takes its layer down, and completes its traces
let current: { stop(): void } | null = null;
export const playing = (): boolean => !!current;

function halt(app: App): void {
  const c = current;
  if (!c) return;
  current = null;
  c.stop();
  setPreview(app, 'play', false);
  app.invalidate();
}

const ready = (app: App) => !!app.pairing?.root && !!app.current();
const backdropOf = (app: App) => (ready(app) ? slideBackdrop(app) : null);
const hasSteps = (app: App) => ready(app) && stepsOfSlide(app.current()!) > 0;
const tableShown = (app: App) => !!app.commands.get('view.lightTable') && !!app.commands.state('view.lightTable').checked;
// the backdrop that a trace on the canvas shows, i.e. not one hidden in the layer of the editor
const traceable = (app: App) => {
  const el = tableShown(app) ? null : backdropOf(app);
  return el && !el.classList.contains(OFF) ? el : null;
};
const playable = (app: App) => !tableShown(app) && hasSteps(app);

type Part = 'backdrop' | 'steps';

async function play(app: App, parts: Part[]): Promise<void> {
  halt(app);
  const slide = app.current();
  if (!slide) return;
  const ends: (() => void)[] = [];
  let stopped = false;
  const me = { stop: () => { stopped = true; for (const end of ends.splice(0)) end(); } };
  current = me;
  setPreview(app, 'play', true, () => halt(app));
  app.invalidate();
  // Chapters Table stops the preview, and the layer of the steps follows the slide at every frame
  let place: (() => void) | null = null;
  let frame = 0;
  const follow = () => {
    if (stopped) return;
    if (tableShown(app)) { halt(app); return; }
    place?.();
    frame = requestAnimationFrame(follow);
  };
  frame = requestAnimationFrame(follow);
  ends.push(() => cancelAnimationFrame(frame));
  // a wait of ms, or until the preview stops
  const pause = (ms: number) => new Promise<void>((done) => {
    const t = window.setTimeout(done, ms);
    ends.push(() => { clearTimeout(t); done(); });
  });

  // the backdrop on the canvas, until its last strand is traced, or after the same seconds for a loop
  const trace = async (el: HTMLElement) => {
    const o = liveOf(el);
    if (!o) return;
    await o.ready;
    if (stopped) return;
    ends.push(() => { if (o.tracing) o.complete(); });
    o.reset();
    o.start();
    // a loop is cut after the same seconds
    const until = performance.now() + spanOf(o) * 1000 + 100;
    while (!stopped && o.tracing && performance.now() < until) await pause(50);
    if (o.tracing) o.complete();
  };

  // the steps on a layer over the canvas, clipped to its viewport
  const steps = async () => {
    const stage = app.slides() as HTMLElement;
    const box = stage.getBoundingClientRect();
    if (!box.width || !box.height) return;
    injectStyle('play', CSS);
    const layer = make('div', 'beeson-edit-play');
    layer.style.background = getComputedStyle(stage.closest('.reveal') ?? document.body).backgroundColor;
    const host = make('div', 'shot');
    layer.append(host);
    document.body.append(layer);
    const traced: Live[] = [];
    // the backdrops that are steps and still traced
    const busy: (() => boolean)[] = [];
    ends.push(() => {
      for (const o of traced) o.destroy();
      layer.remove();
    });
    const deck = { width: stage.offsetWidth || 1920, height: stage.offsetHeight || 1080 };
    drawInto(host, slide, deck, box.width);
    // the layer at the box of the slide, clipped to the viewport, after a zoom or a scroll too
    place = () => {
      const b = stage.getBoundingClientRect();
      layer.style.left = `${b.left}px`;
      layer.style.top = `${b.top}px`;
      layer.style.width = `${b.width}px`;
      layer.style.height = `${b.height}px`;
      const v = app.stage?.viewport;
      if (v) {
        const cut = [v.top - b.top, b.right - v.right, b.bottom - v.bottom, v.left - b.left];
        layer.style.clipPath = `inset(${cut.map((d) => `${Math.max(0, d)}px`).join(' ')})`;
      }
      const shot = host.shadowRoot?.querySelector<HTMLElement>('.slides');
      if (shot) shot.style.transform = `scale(${b.width / deck.width})`;
    };
    place();
    const n = stepsOfSlide(slide);
    for (let k = 0; k <= n && !stopped; k++) {
      if (k) await pause(timing.step);
      if (stopped) return;
      showStep(host, slide, k);
      // a backdrop that is a step is traced from its step on, as the show traces it
      const now = '.backdrop.fragment.current-fragment:not(.beeson-off)';
      for (const el of host.shadowRoot?.querySelectorAll<HTMLElement>(now) ?? []) {
        const o = theme()?.preview?.(el);
        if (!o) continue;
        traced.push(o);
        // after the completion that preview of src/main.ts queues once the strands are ready
        void o.ready.then(() => {
          if (stopped) return;
          o.reset();
          o.start();
          const until = performance.now() + spanOf(o) * 1000 + 100;
          busy.push(() => o.tracing && performance.now() < until);
        });
      }
    }
    await pause(timing.step);
    while (!stopped && busy.some((b) => b())) await pause(50);
  };

  try {
    for (const part of parts) {
      if (stopped) break;
      const el = traceable(app);
      if (part === 'backdrop' && el) await trace(el);
      else if (part === 'steps' && stepsOfSlide(slide) > 0) await steps();
    }
  } finally {
    if (current === me) halt(app);
  }
}

// a command returns once the preview has started, and the preview plays on
const start = (app: App, parts: Part[]) => void play(app, parts).catch((e) => app.fail(e));

export function install(app: App): void {
  const c = app.commands;
  const preview = (order: number) => ({ group: 'present', order, icon: 'play', label: 'Preview', split: 'Preview' });
  const menu = (order: number) => ({ bar: 'Play', group: 'preview', order });
  c.define({
    id: 'preview.slide',
    label: 'Play Slide',
    menu: menu(25),
    toolbar: preview(39),
    // a click on the main part while a preview plays stops it
    enabled: (a) => playing() || !!traceable(a) || playable(a),
    run: (a) => (playing() ? halt(a) : start(a, ['backdrop', 'steps'])),
  });
  c.define({
    id: 'preview.backdrop',
    label: 'Trace Backdrop',
    menu: menu(26),
    toolbar: preview(39.01),
    enabled: (a) => !!traceable(a),
    run: (a) => start(a, ['backdrop']),
  });
  c.define({
    id: 'preview.steps',
    label: 'Play Steps',
    menu: menu(27),
    toolbar: preview(39.02),
    enabled: playable,
    run: (a) => start(a, ['steps']),
  });
  c.define({
    id: 'preview.selectBackdrop',
    label: 'Select Backdrop',
    toolbar: preview(39.03),
    enabled: (a) => !!backdropOf(a),
    run: (a) => {
      const el = backdropOf(a);
      if (!el) return;
      a.selection.set('elements', [el]);
      showFormat(a, 'backdrop');
    },
  });
  c.define({
    id: 'preview.addBackdrop',
    label: 'Add Backdrop…',
    toolbar: preview(39.04),
    enabled: (a) => ready(a) && !backdropOf(a) && c.enabled('insert.backdrop'),
    run: (a) => a.commands.run('insert.backdrop'),
  });

  // a press outside the toolbar and the menus, Esc, a change of slide, and an edit stop a preview.
  // Esc stops it alone, without the Deselect of its key. the keymap matches a key before the
  // listener below, hence a command is turned off only during the keydown of Esc, and Deselect keeps
  // Mod+Shift+A. the same holds for Preview Steps of the Steps pane and Preview Transition
  const esc = () => { const ev = window.event; return ev instanceof KeyboardEvent && ev.type === 'keydown' && ev.key === 'Escape'; };
  c.veto((_, cmd) => previewPlays() && esc() && Object.values(cmd.keys ?? {}).some((k) => k.includes('Escape')));
  window.addEventListener('pointerdown', (ev) => {
    const t = ev.target;
    if (playing() && !(t instanceof Element && t.closest('.beeson-edit-top, .beeson-edit-menu'))) halt(app);
  }, true);
  // a press on Preview, on the Play button of the Steps pane, or on Preview of the Transition pane
  // leaves the caret in a text, as Undo and Redo of the toolbar do, hence it is where it was at the
  // end of the preview
  const starts = '.beeson-edit-top [data-command="preview.slide"], .beeson-edit-side button.play, [data-command="slide.previewTransition"]';
  window.addEventListener('mousedown', (ev) => {
    const t = ev.target;
    if (t instanceof Element && t.closest(starts) && (document.activeElement as HTMLElement | null)?.isContentEditable) ev.preventDefault();
  }, true);
  // a key typed in that text, or an input into it, stops every preview before it is written, hence
  // it is not written into a text that a preview hides, under a caret that is not drawn. the
  // command of a key, e.g. Enter, runs before the listener below, hence its key stops the previews
  // in the veto, which is checked before the command runs
  const typing = () => previewPlays() && !!(document.activeElement as HTMLElement | null)?.isContentEditable;
  const typed = (ev: Event | undefined) => ev instanceof KeyboardEvent && ev.type === 'keydown' && ev.key !== 'Escape' && !['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(ev.key) && typing();
  c.veto(() => { if (typed(window.event)) stopPreviews(); return false; });
  window.addEventListener('keydown', (ev) => { if (typed(ev)) stopPreviews(); }, true);
  window.addEventListener('beforeinput', () => { if (typing()) stopPreviews(); }, true);
  window.addEventListener('keydown', (ev) => {
    if (!playing() || ev.key !== 'Escape') return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    halt(app);
  }, true);
  app.listen('slide', () => halt(app));
  app.listen('history', () => halt(app));
}
