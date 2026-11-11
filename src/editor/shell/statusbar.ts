// the status bar: the previous and next slide with the number of the current one, the state of
// accessibility of the deck, the layer switch, the buttons Navigator, Steps, and Notes, the zoom (−,
// a slider, +, the percentage as a menu, and Fit), and the switch ◐ of the mode of the slide

import type { App } from '../app.ts';
import { button, injectStyle, make, wire } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { chromeSelect } from '../ui/menu.ts';
import { ZOOMS } from './canvas.ts';
import { isHidden, showPlaces } from '../navigator/navigator.ts';

const CSS = `
.beeson-edit-bottom { grid-area: status; position: relative; z-index: 60; display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 8px; box-sizing: border-box; background: var(--ed-bg); border-top: 1px solid var(--ed-line); color: var(--ed-muted); font: 12px/1 var(--ed-font); user-select: none; -webkit-user-select: none; }
.beeson-edit-bottom button { display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 20px; padding: 0 7px; border: 0; border-radius: 4px; background: transparent; color: var(--ed-text); font: inherit; cursor: default; white-space: nowrap; }
.beeson-edit-bottom button:hover { background: var(--ed-hover); }
.beeson-edit-bottom button.on, .beeson-edit-bottom button[aria-pressed="true"] { background: var(--ed-pressed); }
.beeson-edit-bottom button:focus-visible, .beeson-edit-bottom input:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: -1px; }
.beeson-edit-bottom .count { white-space: nowrap; min-width: 9ch; text-align: center; color: var(--ed-text); font-variant-numeric: tabular-nums; }
.beeson-edit-bottom .rule { width: 1px; height: 14px; background: var(--ed-line); flex: none; }
.beeson-edit-bottom .beeson-layers { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.beeson-edit-bottom .beeson-layers[hidden] { display: none; }
.beeson-edit-bottom .beeson-layers > span { margin-right: 4px; }
.beeson-edit-bottom .gap { flex: 1; }
.beeson-edit-bottom .a11y[hidden] { display: none; }
.beeson-edit-bottom .a11y svg { flex: none; color: var(--ed-muted); }
.beeson-edit-bottom .zoom { display: flex; align-items: center; gap: 2px; }
.beeson-edit-bottom .zoom button { padding: 0 4px; }
/* the percentage keeps one width, so that the slider stays under the pointer while the zoom changes */
.beeson-edit-bottom .zoom .percent { min-width: 60px; justify-content: flex-end; font-variant-numeric: tabular-nums; }
.beeson-edit-bottom .slider { position: relative; display: inline-flex; align-items: center; width: 120px; height: 16px; margin: 0 2px; flex: none; }
.beeson-edit-bottom .slider .tick { position: absolute; left: calc(7px + (100% - 14px) * var(--tick)); top: 3px; width: 1px; height: 10px; margin-left: -0.5px; background: var(--ed-muted); pointer-events: none; }
.beeson-edit-bottom input[type=range] { position: relative; z-index: 1; width: 100%; height: 16px; margin: 0; padding: 0; background: transparent; -webkit-appearance: none; appearance: none; pointer-events: none; }
.beeson-edit-bottom input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: color-mix(in srgb, var(--ed-muted) 45%, transparent); }
.beeson-edit-bottom input[type=range]::-moz-range-track { height: 4px; border-radius: 2px; background: color-mix(in srgb, var(--ed-muted) 45%, transparent); }
.beeson-edit-bottom input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; margin-top: -5px; border: 0; border-radius: 50%; background: #fff; box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.3); }
.beeson-edit-bottom input[type=range]::-moz-range-thumb { width: 14px; height: 14px; border: 0; border-radius: 50%; background: #fff; box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.3); }
.beeson-edit-bottom .beeson-edit-select { min-width: 52px; justify-content: space-between; font-variant-numeric: tabular-nums; }
@media (max-width: 1099px) { .beeson-edit-bottom .slider { width: 72px; } }
`;

// the slider is linear in the logarithm of the zoom, from 10 to 400 percent, in steps of a
// thousandth of its length. TICK is the place of 100 percent, to which a drag within SNAP px is
// snapped, as on the zoom slider of PowerPoint
const LOG_MIN = Math.log(0.1);
const LOG_MAX = Math.log(4);
const STEPS = 1000;
const TICK = -LOG_MIN / (LOG_MAX - LOG_MIN);
const SNAP = 4;

// the figure of the accessibility button, drawn as the icons of ui/icons.ts on their grid of 20 px
function person(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ['M10 3a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2z', 'M4 7.75 10 8.5l6-.75', 'M10 8.5v4', 'M10 12.5 7 17', 'M10 12.5 13 17']) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
  }
  return svg;
}

// layers is the switch of layers.ts, placed after the slide number
export function install(app: App, layers: HTMLElement): void {
  injectStyle('statusbar', CSS);
  const bottom = make('div', 'beeson-edit-bottom beeson-edit-region');
  const prevButton = button('‹', 'Previous slide', 'Previous slide');
  const countEl = make('span', 'count');
  const nextButton = button('›', 'Next slide', 'Next slide');

  // the state of the checker of review/accessibility.ts, which writes its text, as the button
  // Accessibility: Investigate of the status bar of PowerPoint, and opens its pane
  const a11yButton = button('', 'Check Accessibility', '');
  a11yButton.className = 'a11y';
  a11yButton.hidden = true;
  a11yButton.append(person(), make('span', 'text'));

  const zoomBox = make('div', 'zoom');
  const outButton = button('', 'Zoom out', 'Zoom out');
  outButton.append(icon('minus', 14));
  const inButton = button('', 'Zoom in', 'Zoom in');
  inButton.append(icon('plus', 14));
  const slider = make('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(STEPS);
  slider.setAttribute('aria-label', 'Zoom');
  const track = make('span', 'slider');
  track.style.setProperty('--tick', String(TICK));
  const tick = make('span', 'tick');
  tick.title = '100%';
  track.append(tick, slider);
  const current = () => app.stage?.zoom ?? app.stage?.fitScale() ?? 1;
  const percent = chromeSelect(app, {
    label: 'Zoom',
    className: 'percent',
    choices: () => [{ value: 'fit', label: 'Fit Slide' }, ...ZOOMS.map((z) => ({ value: String(z), label: `${Math.round(z * 100)}%` })), { value: 'custom', label: 'Zoom…' }],
    value: () => (app.stage?.zoom === null ? 'fit' : String(app.stage?.zoom)),
    text: () => `${Math.round(current() * 100)}%`,
    onChange: (v) => (v === 'custom' ? void app.commands.run('zoom.custom').catch(fail) : app.stage.setZoom(v === 'fit' ? null : Number(v))),
  }) as HTMLButtonElement & { refresh(): void };
  const fitButton = button('Fit', 'Fit the slide into the window');
  zoomBox.append(outButton, track, inButton, percent, fitButton);

  // the mode of the slide is flipped by the button of the theme, from the point of this one
  const modeButton = button('', 'Flip the slide between dark and light mode, D', 'Flip the mode of the slide');
  modeButton.append(icon('contrast', 14));

  const rule = () => make('span', 'rule');
  bottom.append(prevButton, countEl, nextButton, a11yButton, layers, make('span', 'gap'), app.nav.button, app.steps.button, app.notes.button, rule(), zoomBox, rule(), modeButton);
  const fail = (e: unknown) => app.fail(e);
  wire(prevButton, () => app.commands.run('navigate.previous'), fail);
  wire(nextButton, () => app.commands.run('navigate.next'), fail);
  wire(app.notes.button, () => app.commands.run('view.notes'), fail);
  wire(a11yButton, () => app.commands.run('view.accessibility'), fail);
  // the panes wire Slides and Steps themselves, and a pointer click leaves the focus on the slide
  for (const b of [app.nav.button, app.steps.button]) b.addEventListener('click', (ev) => ev.detail > 0 && b.blur());
  wire(outButton, () => app.stage.zoomOut(), fail);
  wire(inButton, () => app.stage.zoomIn(), fail);
  wire(fitButton, () => app.stage.setZoom(null), fail);
  // a press or a drag on the slider is followed here rather than by the browser, which loses the
  // pointer once the thumb is held at the tick. the thumb of 14 px runs over the width of the
  // slider less its own, measured at the press, and the arrow keys move it one step at a time
  // without a snap
  const zoomAt = (at: number) => app.stage.setZoom(Math.exp(LOG_MIN + (at / STEPS) * (LOG_MAX - LOG_MIN)));
  let r = track.getBoundingClientRect();
  const follow = (ev: PointerEvent) => {
    const span = r.width - 14;
    const at = Math.min(1, Math.max(0, (ev.clientX - r.left - 7) / span));
    if (Math.abs(at - TICK) * span <= SNAP) {
      slider.value = String(Math.round(TICK * STEPS));
      app.stage.setZoom(1);
      return;
    }
    slider.value = String(Math.round(at * STEPS));
    zoomAt(Number(slider.value));
  };
  track.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    slider.focus({ preventScroll: true });
    track.setPointerCapture(ev.pointerId);
    r = track.getBoundingClientRect();
    follow(ev);
  });
  track.addEventListener('pointermove', (ev) => track.hasPointerCapture(ev.pointerId) && follow(ev));
  slider.addEventListener('input', () => zoomAt(Number(slider.value)));
  wire(modeButton, () => {
    const r = modeButton.getBoundingClientRect();
    document.querySelector('.theme-switch')?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  }, fail);

  // the place of the current slide in the show and the count of the slides in the show, as the
  // navigator numbers them. a hidden slide reads the struck number that it would take
  const count = () => {
    const d = app.deck();
    if (!d) return;
    const slides = [...app.slides().querySelectorAll(':scope > section')];
    const cur = app.current();
    const i = cur ? slides.indexOf(cur) : -1;
    if (i < 0) {
      countEl.textContent = `Slide ${d.getSlidePastCount() + 1} of ${d.getTotalSlides()}`;
      return;
    }
    const n = String(showPlaces(slides)[i]);
    const total = slides.filter((s) => !isHidden(s)).length;
    const hidden = isHidden(slides[i]);
    countEl.replaceChildren('Slide ', hidden ? make('s', '', n) : n, ` of ${total}${hidden ? ', hidden' : ''}`);
    if (hidden) countEl.setAttribute('aria-label', `Slide ${n} of ${total}, hidden`);
    else countEl.removeAttribute('aria-label');
  };
  const zoomState = () => {
    if (!app.stage) return;
    const z = current();
    if (document.activeElement !== slider) slider.value = String(Math.round(((Math.log(z) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * STEPS));
    fitButton.setAttribute('aria-pressed', String(app.stage.zoom === null));
    percent.refresh();
  };
  app.listen('slide', count);
  app.listen('history', count);
  app.listen('resize', () => {
    count();
    zoomState();
  });
  app.listen('report', zoomState);
  document.body.append(bottom);
}
