// the presenter display of the editor, as the presenter display of Keynote and the presenter view
// of PowerPoint: the current slide at its step, the next slide or step, the notes with A- and A+,
// the clock, and the elapsed time with pause and reset. each part can be hidden in the popover of
// Display Options, as in Keynote, and the choice is kept in the storage for the deck. while the
// display is customized, from the button of the popover, each part is moved by a drag and resized
// by its corner, and the layout is kept in the storage for the deck. with Presenter View, the
// saved deck is played in another tab and kept at the slide and step of the display. with
// Rehearse Timings, each slide is timed, and at the end the seconds spent on each slide shown are
// written into its data-timing, as one entry of the history. the slides are drawn from the page of
// the editor, hence a rehearsal needs no save

import { addRestoreSteps, applySteps } from '../steps.ts';
import type { App } from './app.ts';
import { drawInto } from './navigator/thumbs.ts';
import { injectStyle, make, store, stored } from './ui/dom.ts';
import { icon } from './ui/icons.ts';

// the kind of a fragment: shown from its step on, hidden from its step on (fade-out), or shown only
// at its step (current-visible)
export type FragKind = 'in' | 'out' | 'current';
export type Frag = { index: number | null; kind: FragKind; final: boolean };

// the step of each fragment, from 0, in the order of reveal.js: the fragments with an index in the
// order of their index, then each fragment without one in the order of the page, and a fragment
// with data-final after every other step
export function stepsOf(frags: Frag[]): number[] {
  const indexed = [...new Set(frags.filter((f) => !f.final && f.index !== null).map((f) => f.index as number))].sort((a, b) => a - b);
  let next = indexed.length;
  const out = frags.map((f) => (f.final ? -1 : f.index !== null ? indexed.indexOf(f.index) : next++));
  const finalStep = next;
  return out.map((s) => (s < 0 ? finalStep : s));
}

export const stepCount = (steps: number[]): number => (steps.length ? Math.max(...steps) + 1 : 0);

// whether a fragment of kind at step s is seen once k steps are shown
export function seenAt(kind: FragKind, s: number, k: number): boolean {
  if (kind === 'out') return s >= k;
  if (kind === 'current') return s === k - 1;
  return s < k;
}

// a time in ms as 0:42, 12:05, or 1:02:03, and with hours set always with the hours, e.g. 0:04:12
export function duration(ms: number, hours = false): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, '0');
  return h || hours ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

// the value of data-timing for a time in ms, in whole seconds and at least 1
export const seconds = (ms: number): number => Math.max(1, Math.round(ms / 1000));

const fragsOf = (slide: Element): Element[] => [...slide.querySelectorAll('.fragment')].filter((f) => !f.closest('aside.notes'));

function fragOf(el: Element): Frag {
  const raw = el.getAttribute('data-fragment-index');
  const index = raw !== null && raw.trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null;
  const kind: FragKind = el.classList.contains('fade-out') ? 'out' : el.classList.contains('current-visible') ? 'current' : 'in';
  return { index, kind, final: el.hasAttribute('data-final') && index === null };
}

// the steps of a slide of the editor as the show plays them, counted on a copy of the slide with
// what the show adds: a copy of a code box for each group of lines of its data-line-numbers after
// the first, as the highlight plugin of reveal.js makes them, and the step that addRestoreSteps of
// src/steps.ts adds. steps is the step of each fragment of the slide, from 0, and n the count
export function showSteps(slide: Element): { steps: number[]; n: number } {
  const copy = slide.cloneNode(true) as Element;
  copy.querySelectorAll('aside.notes').forEach((n) => n.remove());
  const own = fragsOf(copy);
  for (const code of copy.querySelectorAll('pre > code[data-line-numbers]')) {
    let at = parseInt(code.getAttribute('data-fragment-index') ?? '', 10);
    for (const _ of (code.getAttribute('data-line-numbers') ?? '').split('|').slice(1)) {
      const step = code.cloneNode(true) as Element;
      step.classList.add('fragment');
      if (Number.isNaN(at)) step.removeAttribute('data-fragment-index');
      else step.setAttribute('data-fragment-index', String(at++));
      code.parentElement?.append(step);
    }
  }
  const wrap = make('div', 'reveal');
  wrap.append(make('div', 'slides'));
  wrap.firstChild?.appendChild(copy);
  addRestoreSteps(wrap);
  const all = fragsOf(copy);
  const steps = stepsOf(all.map(fragOf));
  return { steps: own.map((f) => steps[all.indexOf(f)]), n: stepCount(steps) };
}

export const stepsOfSlide = (slide: Element): number => showSteps(slide).n;

// the clone of slide drawn into host is shown at step k as the show draws it: each fragment not
// seen at k is hidden, and until the slide is complete, the earlier steps are dimmed to the 0.45
// of theme/beeson.css, apart from a backdrop, a fragment inside a shown one, and a fragment held
// with data-keep. the classes highlighted at k are colored by applySteps of src/steps.ts
export function showStep(host: HTMLElement, slide: Element, k: number): void {
  const clone = host.shadowRoot?.querySelector('.beeson-thumb .slides > section');
  if (!clone) return;
  const frags = fragsOf(clone);
  const kinds = fragsOf(slide).map((f) => fragOf(f).kind);
  const { steps, n } = showSteps(slide);
  frags.forEach((f, i) => {
    f.setAttribute('data-fragment-index', String(steps[i] ?? 0));
    f.classList.toggle('visible', steps[i] < k);
    f.classList.toggle('current-fragment', steps[i] === k - 1);
  });
  applySteps(clone);
  (frags as HTMLElement[]).forEach((f, i) => {
    const seen = i >= steps.length || seenAt(kinds[i], steps[i], k);
    const dim = seen && k < n && steps[i] < k - 1 && !f.matches('.backdrop, [data-held]') && !f.parentElement?.closest('.fragment.visible');
    f.classList.toggle('beeson-off', !seen);
    f.style.setProperty('opacity', dim ? '0.45' : '', dim ? 'important' : '');
  });
}

// Use Rehearsed Timings of the Play menu, as the switch of PowerPoint, kept in the storage. a show
// opened from the editor with the switch on is moved on by reveal.js after the data-timing of each
// slide, spread evenly over the slide and its steps. data-autoslide is set in the page of the show
// only, and never written into the file
const TIMINGS_KEY = 'beeson-use-timings';
export const usingTimings = (): boolean => stored(TIMINGS_KEY) === '1';
export const useTimings = (on: boolean): void => store(TIMINGS_KEY, on ? '1' : '0');

// the delay of each step of a slide with data-timing seconds and steps steps, in ms, or null
// without a timing
export function stepDelay(timing: string | null, steps: number): number | null {
  const s = Number(timing);
  if (timing === null || timing.trim() === '' || !Number.isFinite(s) || s <= 0) return null;
  return Math.max(100, Math.round((s * 1000) / (steps + 1)));
}

type ShowReveal = { isReady?(): boolean; sync?(): void };

// plays the timings in the show of win once its reveal.js is ready, and resolves with the number
// of slides timed, or 0 when the show is closed, cannot be reached, or is not ready in time ms. a
// slide or step with its own data-autoslide keeps it
export function playTimings(win: Window, time = 30000): Promise<number> {
  return new Promise((resolve) => {
    const started = performance.now();
    const poll = window.setInterval(() => {
      let reveal: ShowReveal | undefined;
      try {
        if (win.closed) throw new Error('closed');
        reveal = (win as unknown as { Reveal?: ShowReveal }).Reveal;
      } catch {
        clearInterval(poll);
        resolve(0);
        return;
      }
      if (!reveal?.isReady?.()) {
        if (performance.now() - started > time) {
          clearInterval(poll);
          resolve(0);
        }
        return;
      }
      clearInterval(poll);
      let n = 0;
      for (const s of win.document.querySelectorAll('.reveal .slides section[data-timing]')) {
        // the slides of the show have their added steps already
        const delay = stepDelay(s.getAttribute('data-timing'), stepCount(stepsOf(fragsOf(s).map(fragOf))));
        if (delay === null || s.hasAttribute('data-autoslide')) continue;
        s.setAttribute('data-autoslide', String(delay));
        n++;
      }
      // a sync of reveal.js cues the delay of the step shown
      if (n) reveal.sync?.();
      resolve(n);
    }, 100);
  });
}

const NOTES_KEY = 'beeson-presenter-notes';
// the parts of the display that can be hidden, with the labels of Keynote
const PARTS = [
  ['current', 'Current Slide'],
  ['next', 'Next Slide'],
  ['notes', 'Presenter Notes'],
  ['clock', 'Clock'],
  ['timer', 'Timer'],
] as const;
const partsKey = () => `beeson-presenter-parts:${location.pathname}`;
function hiddenParts(): string[] {
  try {
    const v: unknown = JSON.parse(stored(partsKey()) ?? '[]');
    return Array.isArray(v) ? v.filter((p) => PARTS.some(([id]) => id === p)) : [];
  } catch {
    return [];
  }
}
// the layout of Customize Presenter Display as fractions of the display: the left x and top y of
// each part, the width w of a slide and of the notes, and the height h of the notes or, for the
// clock and the timer, of their text. it is kept in the storage for the deck, never in the file
type Spot = { x: number; y: number; w?: number; h?: number };
type Layout = Record<string, Spot>;
const layoutKey = () => `beeson-presenter-layout:${location.pathname}`;
const TEXTS = ['clock', 'timer'];
// the place of a part missing from a layout, e.g. one hidden while the layout was made
const SPOTS: Layout = { current: { x: 0.02, y: 0.08, w: 0.56 }, next: { x: 0.61, y: 0.08, w: 0.37 }, notes: { x: 0.61, y: 0.5, w: 0.37, h: 0.4 }, clock: { x: 0.86, y: 0.015, h: 0.02 }, timer: { x: 0.42, y: 0.012, h: 0.026 } };
const fraction = (v: unknown): v is number => typeof v === 'number' && v >= 0 && v <= 1;
function storedLayout(): Layout | null {
  try {
    const v: unknown = JSON.parse(stored(layoutKey()) ?? 'null');
    if (!v || typeof v !== 'object') return null;
    const out: Layout = {};
    for (const [id] of PARTS) {
      const s = (v as Record<string, Partial<Spot>>)[id];
      if (!s || !fraction(s.x) || !fraction(s.y)) continue;
      out[id] = { x: s.x, y: s.y, ...(fraction(s.w) ? { w: s.w } : {}), ...(fraction(s.h) ? { h: s.h } : {}) };
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
const seen = (el: Element): boolean => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), Math.max(lo, hi));

// the sizes of the text of the notes, in CSS px
const NOTE_SIZES = [14, 16, 18, 21, 24, 28, 32, 40];

// the presenter display and the rehearsal are black in both appearances, as in Keynote and
// PowerPoint, hence the dialog sets the tokens of the editor for a black stage
const CSS = `
dialog.beeson-edit-presenter { --ed-bg: #000; --ed-canvas: #000; --ed-panel: #161618; --ed-text: #f2f2f4; --ed-muted: #a1a1a6; --ed-faint: #6c6c71; --ed-line: #2c2c2e; --ed-guide: #f08050; --ed-select: #9d47d8; --ed-focus: #c94fe6; --ed-hover: rgba(255, 255, 255, 0.08); --ed-pressed: rgba(255, 255, 255, 0.14); --ed-edge: rgba(255, 255, 255, 0.14); --ed-menu-line: rgba(255, 255, 255, 0.12); color-scheme: dark; box-sizing: border-box; width: 100vw; height: 100vh; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: var(--ed-canvas); color: var(--ed-text); font: 13px/1.35 var(--ed-font); outline: none; overflow: hidden; }
dialog.beeson-edit-presenter[open] { display: grid; grid-template-rows: 48px minmax(0, 1fr) 44px; }
dialog.beeson-edit-presenter::backdrop { background: #000; }
.beeson-edit-presenter .bar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; padding: 0 14px; background: var(--ed-bg); border-bottom: 1px solid var(--ed-line); user-select: none; -webkit-user-select: none; }
.beeson-edit-presenter .bar.foot { grid-row: 3; border-bottom: 0; border-top: 1px solid var(--ed-line); }
.beeson-edit-presenter .bar > :last-child { justify-self: end; }
.beeson-edit-presenter .parts { position: absolute; top: 44px; right: 10px; z-index: 2; display: flex; flex-direction: column; gap: 2px; min-width: 180px; padding: 6px; border: 1px solid var(--ed-menu-line); border-radius: 10px; background: var(--ed-panel); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4); user-select: none; -webkit-user-select: none; }
.beeson-edit-presenter .parts[hidden] { display: none; }
.beeson-edit-presenter .parts label { display: flex; align-items: center; gap: 8px; height: 26px; padding: 0 8px; border-radius: 6px; }
.beeson-edit-presenter .parts label:hover { background: var(--ed-hover); }
.beeson-edit-presenter .parts input { margin: 0; accent-color: var(--ed-select); }
.beeson-edit-presenter.no-clock .clock, .beeson-edit-presenter.no-timer .timer { visibility: hidden; }
.beeson-edit-presenter.no-current .col.now, .beeson-edit-presenter.no-next .upcoming, .beeson-edit-presenter.no-notes .notes, .beeson-edit-presenter.no-next.no-notes .col.side { display: none; }
.beeson-edit-presenter:is(.no-current, .no-next.no-notes) .stage { grid-template-columns: minmax(0, 1fr); }
.beeson-edit-presenter.no-current .shot.next { align-self: center; width: min(100%, calc((100vh - 150px) * 16 / 9)); }
.beeson-edit-presenter.no-current:not(.no-notes) .shot.next { width: min(100%, calc((100vh - 330px) * 16 / 9)); }
.beeson-edit-presenter .parts > button { margin-top: 6px; background: var(--ed-pressed); }
.beeson-edit-presenter .col.now { align-self: start; }
.beeson-edit-presenter .col.upcoming { flex: none; }
.beeson-edit-presenter.free :is(.col.now, .col.upcoming, .notes, .clock, .group.timer) { position: absolute; z-index: 1; box-sizing: border-box; }
.beeson-edit-presenter.free .col.upcoming .shot.next { width: 100%; align-self: stretch; }
.beeson-edit-presenter.free .notes { min-height: 0; }
.beeson-edit-presenter.free .bar.top > :last-child { grid-column: 3; }
.beeson-edit-presenter.free .bar button { position: relative; z-index: 2; }
.beeson-edit-presenter .layout { position: absolute; inset: 0; z-index: 3; user-select: none; -webkit-user-select: none; }
.beeson-edit-presenter .layout[hidden], .beeson-edit-presenter .layout .frame[hidden] { display: none; }
.beeson-edit-presenter .layout .frame { position: absolute; box-sizing: border-box; border: 2px solid var(--ed-select); border-radius: 6px; background: color-mix(in srgb, var(--ed-select) 14%, transparent); cursor: move; }
.beeson-edit-presenter .layout .name { position: absolute; z-index: 1; left: -2px; top: calc(100% + 3px); padding: 1px 6px; border-radius: 4px; background: var(--ed-select); color: var(--ed-on-select, #fff); font-size: 11px; white-space: nowrap; }
.beeson-edit-presenter .layout .grip { position: absolute; z-index: 1; right: -7px; bottom: -7px; width: 12px; height: 12px; border: 1px solid var(--ed-select); border-radius: 3px; background: #fff; cursor: nwse-resize; }
.beeson-edit-presenter .layout .tools { position: absolute; z-index: 2; left: 50%; bottom: 8px; transform: translateX(-50%); display: flex; gap: 8px; padding: 6px; border: 1px solid var(--ed-menu-line); border-radius: 10px; background: var(--ed-panel); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4); }
.beeson-edit-presenter .layout .tools button:not(.primary) { background: var(--ed-pressed); }
.beeson-edit-presenter .group { display: flex; align-items: center; gap: 8px; min-width: 0; }
.beeson-edit-presenter button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; height: 28px; min-width: 28px; padding: 0 9px; border: 0; border-radius: 6px; background: transparent; color: inherit; font: 12px/1 var(--ed-font); cursor: default; white-space: nowrap; }
.beeson-edit-presenter button:hover:not(:disabled) { background: var(--ed-hover); }
.beeson-edit-presenter button:active:not(:disabled) { background: var(--ed-pressed); }
.beeson-edit-presenter button:disabled { color: var(--ed-faint); }
.beeson-edit-presenter button:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 1px; }
.beeson-edit-presenter .parts input:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 2px; }
.beeson-edit-presenter button.end { background: var(--ed-pressed); padding-left: 5px; }
.beeson-edit-presenter button.primary { background: var(--ed-select); color: var(--ed-on-select); padding: 0 14px; }
.beeson-edit-presenter button.primary:hover { background: color-mix(in srgb, var(--ed-select) 88%, #000); }
.beeson-edit-presenter .title { font-weight: 600; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beeson-edit-presenter .rec { display: none; width: 8px; height: 8px; border-radius: 50%; background: var(--ed-guide); }
.beeson-edit-presenter.rehearse .rec { display: inline-block; }
.beeson-edit-presenter .elapsed { min-width: 104px; text-align: center; font: 300 26px/1 var(--ed-font); font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.beeson-edit-presenter.paused .elapsed { color: var(--ed-muted); }
.beeson-edit-presenter .clock { font: 300 20px/1 var(--ed-font); font-variant-numeric: tabular-nums; color: var(--ed-muted); }
.beeson-edit-presenter .stage { grid-row: 2; display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 24px; min-height: 0; padding: 18px 24px; }
.beeson-edit-presenter .col { display: flex; flex-direction: column; gap: 8px; min-height: 0; min-width: 0; }
.beeson-edit-presenter .label { display: flex; justify-content: space-between; gap: 8px; color: var(--ed-muted); font-size: 12px; white-space: nowrap; }
.beeson-edit-presenter .label b { color: var(--ed-text); font-weight: 600; }
.beeson-edit-presenter .shot { position: relative; width: 100%; aspect-ratio: 16 / 9; flex: none; border-radius: 4px; background: var(--ed-panel); box-shadow: 0 0 0 1px var(--ed-edge), 0 6px 22px rgba(0, 0, 0, 0.18); overflow: hidden; }
.beeson-edit-presenter .shot > .pic { position: absolute; inset: 0; }
.beeson-edit-presenter .shot .end-mark { position: absolute; inset: 0; display: grid; place-items: center; color: var(--ed-muted); font-size: 14px; }
.beeson-edit-presenter .shot .end-mark[hidden], .beeson-edit-presenter .shot > .pic[hidden] { display: none; }
.beeson-edit-presenter .notes { flex: 1; min-height: 80px; display: flex; flex-direction: column; border: 1px solid var(--ed-line); border-radius: 8px; background: var(--ed-panel); overflow: hidden; }
.beeson-edit-presenter .notes .head { display: flex; align-items: center; gap: 2px; height: 30px; flex: none; padding: 0 4px 0 12px; border-bottom: 1px solid var(--ed-line); color: var(--ed-muted); font-size: 12px; }
.beeson-edit-presenter .notes .head span { flex: 1; }
.beeson-edit-presenter .notes .head button { height: 24px; min-width: 30px; padding: 0 6px; font-weight: 600; }
.beeson-edit-presenter .notes .text { flex: 1; overflow: auto; padding: 10px 14px 14px; font-family: var(--ed-font); line-height: 1.45; user-select: text; -webkit-user-select: text; }
.beeson-edit-presenter .notes .text p { margin: 0 0 0.6em; }
.beeson-edit-presenter .notes .text.empty { color: var(--ed-muted); }
.beeson-edit-presenter .count { min-width: 72px; text-align: center; font-variant-numeric: tabular-nums; }
.beeson-edit-presenter .slide-time { visibility: hidden; display: inline-flex; align-items: baseline; gap: 8px; color: var(--ed-muted); }
.beeson-edit-presenter.rehearse .slide-time { visibility: visible; }
.beeson-edit-presenter .slide-time b { color: var(--ed-guide); font: 500 18px/1 var(--ed-font); font-variant-numeric: tabular-nums; }
.beeson-edit-presenter .hint { color: var(--ed-faint); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beeson-edit-presenter .audience { color: var(--ed-muted); font-size: 12px; white-space: nowrap; }
.beeson-edit-presenter .summary { grid-row: 2; display: none; place-items: center; }
.beeson-edit-presenter.asking .stage { display: none; }
.beeson-edit-presenter.asking .summary { display: grid; }
.beeson-edit-presenter .card { width: min(440px, calc(100vw - 32px)); box-sizing: border-box; padding: 20px 22px 18px; border: 1px solid var(--ed-menu-line); border-radius: 12px; background: var(--ed-panel); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28); }
.beeson-edit-presenter .card h3 { margin: 0 0 6px; font: 600 14px/1.3 var(--ed-font); }
.beeson-edit-presenter .card p { margin: 0 0 14px; color: var(--ed-muted); }
.beeson-edit-presenter .card .buttons { display: flex; justify-content: flex-end; gap: 8px; }
.beeson-edit-presenter .card .buttons button:not(.primary) { background: var(--ed-pressed); }
@media (max-width: 900px) { .beeson-edit-presenter .hint { display: none; } .beeson-edit-presenter .stage { grid-template-columns: 1fr; overflow: auto; } }
`;

export type Mode = 'present' | 'rehearse';

// a button that does not take the focus from the dialog, so that the keys of the show stay live
function tool(text: string, title: string, iconName?: string): HTMLButtonElement {
  const b = make('button');
  b.type = 'button';
  b.title = title;
  if (iconName) b.append(icon(iconName, 16));
  if (text) b.append(document.createTextNode(text));
  else b.setAttribute('aria-label', title);
  b.addEventListener('mousedown', (ev) => ev.preventDefault());
  return b;
}

type RevealLike = { isReady?(): boolean; getIndices(): { h: number; v?: number; f?: number }; slide(h: number, v?: number, f?: number): void };

export class Presenter {
  readonly el = make('dialog', 'beeson-edit-presenter') as HTMLDialogElement;
  private readonly app: App;
  private mode: Mode = 'present';
  private list: Element[] = [];
  private at = 0;
  private step = 0;
  private audience: Window | null = null;
  // the slide and fragment last sent to the show, as h/f
  private sent: string | null = null;
  // the time shown, and the time of each slide in a rehearsal, in ms of performance.now()
  private elapsed = 0;
  private since: number | null = null;
  private readonly times = new Map<Element, number>();
  private slideSince: number | null = null;
  private timer = 0;
  private typed = '';
  private noteSize = Number(stored(NOTES_KEY)) || 18;
  private readonly parts: Record<string, HTMLElement> = {};
  private readonly current = make('div', 'pic');
  private readonly next = make('div', 'pic');
  private readonly nextShot = make('div', 'shot next');
  private readonly options = tool('', 'Display Options', 'inspector');
  private readonly popover = make('div', 'parts');
  private readonly endMark = make('div', 'end-mark', 'End of the show');
  // the element of each part, the overlay of its frames while the display is customized, and the
  // drag of a frame or of its corner, with the layout that it changes
  private readonly blocks: Record<string, HTMLElement> = {};
  private readonly layout = make('div', 'layout');
  private readonly frames: Record<string, HTMLElement> = {};
  private press: { id: string; resize: boolean; x: number; y: number; from: Spot; box: { width: number; height: number }; layout: Layout } | null = null;
  private done: ((kept: boolean | null) => void) | null = null;

  constructor(app: App) {
    this.app = app;
    injectStyle('presenter', CSS);
    const el = this.el;
    el.setAttribute('aria-label', 'Presenter view');
    el.tabIndex = -1;

    const end = tool('End', 'End the show (Esc)', 'chevron-left');
    end.classList.add('end');
    end.addEventListener('click', () => this.finish());
    const title = make('span', 'title');
    const left = make('div', 'group');
    left.append(end, make('span', 'rec'), title);
    const elapsed = make('span', 'elapsed', '0:00:00');
    elapsed.setAttribute('role', 'timer');
    elapsed.setAttribute('aria-label', 'Elapsed time');
    const pause = tool('Pause', 'Pause the timer');
    pause.classList.add('pause');
    pause.addEventListener('click', () => this.togglePause());
    const reset = tool('Reset', 'Set the timer back to zero');
    reset.addEventListener('click', () => this.resetTimer());
    const middle = make('div', 'group timer');
    middle.append(pause, elapsed, reset);
    const clock = make('span', 'clock');
    clock.setAttribute('aria-label', 'Clock');
    this.options.setAttribute('aria-haspopup', 'dialog');
    this.options.setAttribute('aria-expanded', 'false');
    this.options.addEventListener('click', () => this.showParts(this.popover.hidden));
    const right = make('div', 'group');
    right.append(clock, this.options);
    const top = make('div', 'bar top');
    top.append(left, middle, right);
    this.popover.hidden = true;
    this.popover.setAttribute('role', 'dialog');
    this.popover.setAttribute('aria-label', 'Display Options');
    for (const [id, text] of PARTS) {
      const box = make('input') as HTMLInputElement;
      box.type = 'checkbox';
      box.name = id;
      box.addEventListener('change', () => {
        const hidden = new Set(hiddenParts());
        if (box.checked) hidden.delete(id);
        else hidden.add(id);
        store(partsKey(), hidden.size ? JSON.stringify(PARTS.map(([p]) => p).filter((p) => hidden.has(p))) : null);
        this.applyParts();
      });
      const label = make('label');
      label.append(box, text);
      this.popover.append(label);
    }
    const customize = tool('Customize Presenter Display', 'Move and resize the parts of the display');
    customize.addEventListener('click', () => this.customize(true));
    this.popover.append(customize);
    // a click outside the popover closes it
    el.addEventListener('pointerdown', (ev) => {
      const at = ev.target as Node;
      if (!this.popover.hidden && !this.popover.contains(at) && !this.options.contains(at)) this.showParts(false);
    });

    const shotCurrent = make('div', 'shot current');
    shotCurrent.append(this.current);
    // a click on the current slide moves the show on, as in the presenter view of PowerPoint
    shotCurrent.addEventListener('click', (ev) => {
      if (ev.button === 0 && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !ev.shiftKey) this.go(1);
    });
    const currentLabel = make('div', 'label');
    const colLeft = make('div', 'col now');
    colLeft.append(currentLabel, shotCurrent);
    this.nextShot.append(this.next, this.endMark);
    const nextLabel = make('div', 'label next');
    const upcoming = make('div', 'col upcoming');
    upcoming.append(nextLabel, this.nextShot);
    const notes = make('div', 'notes');
    const head = make('div', 'head');
    const smaller = tool('A−', 'Make the notes smaller');
    const bigger = tool('A+', 'Make the notes bigger');
    smaller.addEventListener('click', () => this.zoomNotes(-1));
    bigger.addEventListener('click', () => this.zoomNotes(1));
    head.append(make('span', '', 'Notes'), smaller, bigger);
    const text = make('div', 'text');
    notes.append(head, text);
    const colRight = make('div', 'col side');
    colRight.append(upcoming, notes);
    const stage = make('div', 'stage');
    stage.append(colLeft, colRight);

    const back = tool('', 'Previous (←)', 'chevron-left');
    const fwd = tool('', 'Next (→ or Space)', 'chevron-right');
    back.addEventListener('click', () => this.go(-1));
    fwd.addEventListener('click', () => this.go(1));
    const count = make('span', 'count');
    const nav = make('div', 'group');
    nav.append(back, count, fwd);
    const slideTime = make('span', 'slide-time');
    slideTime.append(document.createTextNode('This slide'), make('b', '', '0:00'));
    const hint = make('span', 'hint', '→ or Space next, ← back, a number and Return to go, Esc to end');
    const audience = make('span', 'audience');
    const info = make('div', 'group');
    info.append(audience, hint);
    const foot = make('div', 'bar foot');
    foot.append(nav, slideTime, info);

    const summary = make('div', 'summary');
    const card = make('div', 'card');
    card.setAttribute('role', 'alertdialog');
    card.setAttribute('aria-label', 'Keep the new slide timings?');
    const h3 = make('h3', '', 'Keep the new slide timings?');
    const said = make('p');
    const buttons = make('div', 'buttons');
    const discard = tool("Don't Keep", 'Leave the timings of the slides as they were');
    const keep = tool('Keep Timings', 'Write the seconds of each slide shown into its data-timing');
    keep.classList.add('primary', 'keep');
    discard.classList.add('discard');
    discard.addEventListener('click', () => this.answer(false));
    keep.addEventListener('click', () => this.answer(true));
    buttons.append(discard, keep);
    card.append(h3, said, buttons);
    summary.append(card);

    Object.assign(this.blocks, { current: colLeft, next: upcoming, notes, clock, timer: middle });
    this.layout.hidden = true;
    for (const [id, text] of PARTS) {
      const frame = make('div', 'frame');
      frame.dataset.part = id;
      frame.append(make('span', 'name', text), make('span', 'grip'));
      this.frames[id] = frame;
      this.layout.append(frame);
    }
    const tools = make('div', 'tools');
    const auto = tool('Use Auto Layout', 'Put each part back in the layout of the display');
    auto.addEventListener('click', () => {
      store(layoutKey(), null);
      this.applyLayout();
    });
    const done = tool('Done', 'End the customizing (Esc)');
    done.classList.add('primary');
    done.addEventListener('click', () => this.customize(false));
    tools.append(auto, done);
    this.layout.append(tools);
    this.layout.addEventListener('pointerdown', (ev) => this.pressFrame(ev));
    this.layout.addEventListener('pointermove', (ev) => this.dragFrame(ev));
    for (const type of ['pointerup', 'pointercancel'] as const) this.layout.addEventListener(type, () => this.dropFrame());

    el.append(top, stage, summary, foot, this.popover, this.layout);
    Object.assign(this.parts, { title, elapsed, clock, currentLabel, nextLabel, text, count, slideTime: slideTime.lastChild as HTMLElement, audience, said, pause, back, keep });
    el.addEventListener('keydown', (ev) => this.onKey(ev));
    el.addEventListener('cancel', (ev) => {
      ev.preventDefault();
      this.finish();
    });
    const resized = new ResizeObserver(() => this.draw());
    resized.observe(shotCurrent);
    resized.observe(this.nextShot);
    resized.observe(el);
  }

  get isOpen(): boolean {
    return this.el.open;
  }

  // the slides of the show, without the hidden ones
  private shown(): Element[] {
    return [...this.app.slides().querySelectorAll(':scope > section')].filter((s) => s.getAttribute('data-visibility') !== 'hidden');
  }

  // opens the display at slide from, or at the first slide shown after it. the promise is resolved
  // at the end of the show, with true when the timings of a rehearsal were kept, false when they
  // were not, and null for a show without a rehearsal. with customize, the popover of the parts is
  // open
  open(mode: Mode, from: Element | null, audience: Window | null = null, customize = false): Promise<boolean | null> {
    if (this.isOpen) this.close(null);
    this.mode = mode;
    this.list = this.shown();
    if (!this.list.length) return Promise.resolve(null);
    const all = [...this.app.slides().querySelectorAll(':scope > section')];
    const fromAt = from ? all.indexOf(from) : 0;
    const i = this.list.findIndex((s) => all.indexOf(s) >= fromAt);
    this.at = i < 0 ? 0 : i;
    this.step = 0;
    this.audience = audience;
    this.sent = null;
    this.parts.audience.textContent = '';
    this.times.clear();
    this.elapsed = 0;
    const now = performance.now();
    this.since = now;
    this.slideSince = now;
    this.typed = '';
    this.el.classList.toggle('rehearse', mode === 'rehearse');
    this.el.classList.remove('asking', 'paused');
    this.parts.pause.textContent = 'Pause';
    this.parts.title.textContent = mode === 'rehearse' ? 'Rehearse Timings' : 'Presenter View';
    if (!this.el.isConnected) document.body.append(this.el);
    this.el.showModal();
    this.el.focus({ preventScroll: true });
    this.applyNotes();
    this.customize(false);
    this.applyParts();
    this.applyLayout();
    this.showParts(customize);
    this.render();
    this.timer = window.setInterval(() => this.tick(), 250);
    return new Promise((resolve) => {
      this.done = resolve;
    });
  }

  private slide(): Element {
    return this.list[this.at];
  }

  // the time since the last account is added to the slide shown and to the elapsed time, e.g.
  // before the slide changes
  private account(): void {
    const now = performance.now();
    if (this.slideSince !== null && this.list[this.at]) {
      const s = this.list[this.at];
      this.times.set(s, (this.times.get(s) ?? 0) + now - this.slideSince);
      this.slideSince = now;
    }
    if (this.since !== null) {
      this.elapsed += now - this.since;
      this.since = now;
    }
  }

  // a click forward or back: the next step of the slide, else the next slide at its first step.
  // forward from the last step of the last slide ends the show
  go(dir: 1 | -1): void {
    if (this.el.classList.contains('asking')) return;
    const n = stepsOfSlide(this.slide());
    if (dir > 0 && this.step < n) this.step++;
    else if (dir < 0 && this.step > 0) this.step--;
    else if (dir > 0 && this.at === this.list.length - 1) return this.finish();
    else if (dir < 0 && this.at === 0) return;
    else {
      this.account();
      this.at += dir;
      this.step = dir > 0 ? 0 : stepsOfSlide(this.slide());
    }
    this.render();
  }

  goTo(index: number): void {
    if (index < 0 || index >= this.list.length || this.el.classList.contains('asking')) return;
    if (index !== this.at) this.account();
    this.at = index;
    this.step = 0;
    this.render();
  }

  private togglePause(): void {
    const paused = !this.el.classList.contains('paused');
    if (paused) {
      this.account();
      this.since = null;
      this.slideSince = null;
    } else {
      this.since = performance.now();
      this.slideSince = this.since;
    }
    this.el.classList.toggle('paused', paused);
    this.parts.pause.textContent = paused ? 'Resume' : 'Pause';
    this.parts.pause.title = paused ? 'Run the timer again' : 'Pause the timer';
    this.tick();
  }

  private resetTimer(): void {
    this.elapsed = 0;
    const now = performance.now();
    if (this.since !== null) this.since = now;
    if (this.slideSince !== null) this.slideSince = now;
    if (this.mode === 'rehearse') this.times.delete(this.slide());
    this.tick();
  }

  private zoomNotes(dir: 1 | -1): void {
    const i = NOTE_SIZES.findIndex((s) => s >= this.noteSize);
    const at = Math.max(0, Math.min(NOTE_SIZES.length - 1, (i < 0 ? NOTE_SIZES.length - 1 : i) + dir));
    this.noteSize = NOTE_SIZES[at];
    store(NOTES_KEY, String(this.noteSize));
    this.applyNotes();
  }

  private applyNotes(): void {
    this.parts.text.style.fontSize = `${this.noteSize}px`;
  }

  // the parts hidden in the storage of the deck are hidden, and their checkboxes cleared
  private applyParts(): void {
    const hidden = hiddenParts();
    for (const [id] of PARTS) this.el.classList.toggle(`no-${id}`, hidden.includes(id));
    for (const box of this.popover.querySelectorAll('input')) box.checked = !hidden.includes(box.name);
    this.draw();
  }

  private get customizing(): boolean {
    return !this.layout.hidden;
  }

  // the customizing of Keynote: the popover is closed, each shown part is framed, and a drag of a
  // frame or of its corner moves or resizes the part
  private customize(on: boolean): void {
    this.dropFrame();
    this.layout.hidden = !on;
    if (on) this.showParts(false);
    this.drawFrames();
  }

  // each part at its place in layout, or in the grid of the display without one. the slides keep
  // their aspect ratio, since their height follows their width
  private applyLayout(layout = storedLayout()): void {
    this.el.classList.toggle('free', !!layout);
    for (const [id] of PARTS) {
      const s = layout ? layout[id] ?? SPOTS[id] : null;
      const text = TEXTS.includes(id);
      Object.assign(this.blocks[id].style, {
        left: s ? `${s.x * 100}%` : '',
        top: s ? `${s.y * 100}%` : '',
        width: s?.w !== undefined && !text ? `${s.w * 100}%` : '',
        height: s?.h !== undefined && id === 'notes' ? `${s.h * 100}%` : '',
      });
      if (text) this.textOf(id).style.fontSize = s?.h !== undefined ? `${s.h * 100}vh` : '';
    }
    this.draw();
  }

  private textOf(id: string): HTMLElement {
    return id === 'clock' ? this.parts.clock : this.parts.elapsed;
  }

  // the layout of the parts as they are shown, i.e. the stored layout or the places of the grid
  private measured(): Layout {
    const kept = storedLayout();
    if (kept) return { ...SPOTS, ...kept };
    const d = this.el.getBoundingClientRect();
    const out: Layout = { ...SPOTS };
    for (const [id] of PARTS) {
      const el = this.blocks[id];
      if (!seen(el)) continue;
      const r = el.getBoundingClientRect();
      const s: Spot = { x: (r.left - d.left) / d.width, y: (r.top - d.top) / d.height };
      if (TEXTS.includes(id)) s.h = parseFloat(getComputedStyle(this.textOf(id)).fontSize) / d.height;
      else s.w = r.width / d.width;
      if (id === 'notes') s.h = r.height / d.height;
      out[id] = s;
    }
    return out;
  }

  private drawFrames(): void {
    if (!this.customizing) return;
    const d = this.el.getBoundingClientRect();
    for (const [id] of PARTS) {
      const frame = this.frames[id];
      frame.hidden = !seen(this.blocks[id]);
      if (frame.hidden) continue;
      const r = this.blocks[id].getBoundingClientRect();
      Object.assign(frame.style, { left: `${r.left - d.left}px`, top: `${r.top - d.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    }
  }

  // a press on a frame moves its part, and a press on its corner resizes it. a layout of the grid
  // is taken as it is shown, so that the other parts stay where they are
  private pressFrame(ev: PointerEvent): void {
    const target = ev.target as Element;
    const frame = target.closest<HTMLElement>('.frame');
    if (ev.button !== 0 || !frame?.dataset.part) return;
    ev.preventDefault();
    const id = frame.dataset.part;
    const layout = this.measured();
    this.applyLayout(layout);
    const d = this.el.getBoundingClientRect();
    const r = this.blocks[id].getBoundingClientRect();
    this.press = { id, resize: !!target.closest('.grip'), x: ev.clientX, y: ev.clientY, from: { ...layout[id] }, box: { width: r.width / d.width, height: r.height / d.height }, layout };
    this.layout.setPointerCapture(ev.pointerId);
  }

  // a part is kept inside the display. the corner of a slide scales it by the side moved the most,
  // that of the notes sets both sides, and that of the clock or the timer the size of the text
  private dragFrame(ev: PointerEvent): void {
    const p = this.press;
    if (!p) return;
    const d = this.el.getBoundingClientRect();
    const dx = (ev.clientX - p.x) / d.width;
    const dy = (ev.clientY - p.y) / d.height;
    const { from: f, box } = p;
    const s: Spot = { ...f };
    if (!p.resize) {
      s.x = clamp(f.x + dx, 0, 1 - box.width);
      s.y = clamp(f.y + dy, 0, 1 - box.height);
    } else if (TEXTS.includes(p.id)) s.h = clamp((f.h ?? 0.02) * ((box.height + dy) / box.height), 0.012, 0.2);
    else if (p.id === 'notes') {
      s.w = clamp((f.w ?? box.width) + dx, 0.1, 1 - f.x);
      s.h = clamp((f.h ?? box.height) + dy, 0.08, 1 - f.y);
    } else {
      const kx = (box.width + dx) / box.width;
      const ky = (box.height + dy) / box.height;
      const k = Math.min(Math.abs(kx - 1) >= Math.abs(ky - 1) ? kx : ky, (1 - f.x) / box.width, (1 - f.y) / box.height);
      s.w = Math.max(0.12, (f.w ?? box.width) * k);
    }
    p.layout[p.id] = s;
    this.applyLayout(p.layout);
  }

  private dropFrame(): void {
    const p = this.press;
    if (!p) return;
    this.press = null;
    const round = (v: number) => Math.round(v * 1e4) / 1e4;
    const layout = Object.fromEntries(Object.entries(p.layout).map(([id, s]) => [id, Object.fromEntries(Object.entries(s).map(([k, v]) => [k, round(v)]))]));
    store(layoutKey(), JSON.stringify(layout));
  }

  private showParts(open: boolean): void {
    this.popover.hidden = !open;
    this.options.setAttribute('aria-expanded', String(open));
    if (!open && this.popover.contains(document.activeElement)) this.el.focus({ preventScroll: true });
  }

  private slideTime(): number {
    const base = this.times.get(this.slide()) ?? 0;
    return base + (this.slideSince !== null ? performance.now() - this.slideSince : 0);
  }

  private tick(): void {
    if (!this.isOpen) return;
    const total = this.elapsed + (this.since !== null ? performance.now() - this.since : 0);
    this.parts.elapsed.textContent = duration(total, true);
    this.parts.clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    this.parts.slideTime.textContent = duration(this.slideTime());
    this.follow();
  }

  // the show in the other tab is kept at the slide and step of the display, and a change made in
  // the show, e.g. a click on its slide, is taken over by the display
  private follow(): void {
    const w = this.audience;
    if (!w) return;
    let reveal: RevealLike | undefined;
    try {
      if (w.closed) {
        this.audience = null;
        this.parts.audience.textContent = 'The show tab is closed';
        return;
      }
      reveal = (w as unknown as { Reveal?: RevealLike }).Reveal;
    } catch {
      this.audience = null;
      return;
    }
    if (!reveal?.isReady?.()) {
      this.parts.audience.textContent = 'Opening the show…';
      return;
    }
    this.parts.audience.textContent = 'The show is in its own tab';
    const { h, f } = reveal.getIndices();
    const there = `${h}/${f ?? -1}`;
    if (this.sent !== null && there !== this.sent && h < this.list.length) {
      if (h !== this.at) this.account();
      this.at = h;
      this.step = (f ?? -1) + 1;
      this.sent = there;
      this.render(false);
    } else if (there !== this.sent) this.push();
  }

  private push(): void {
    try {
      const reveal = (this.audience as unknown as { Reveal?: RevealLike } | null)?.Reveal;
      if (!reveal?.isReady?.()) return;
      reveal.slide(this.at, 0, this.step - 1);
      const { h, f } = reveal.getIndices();
      this.sent = `${h}/${f ?? -1}`;
    } catch {
      this.audience = null;
    }
  }

  private draw(): void {
    if (!this.isOpen || !this.list.length) return;
    const stage = this.app.slides() as HTMLElement;
    const deck = { width: stage.offsetWidth || 1920, height: stage.offsetHeight || 1080 };
    const slide = this.slide();
    const w = this.current.getBoundingClientRect().width;
    if (w > 0) {
      drawInto(this.current, slide, deck, w);
      showStep(this.current, slide, this.step);
    }
    const n = stepsOfSlide(slide);
    const nextSlide = this.step < n ? slide : this.list[this.at + 1];
    const nextStep = this.step < n ? this.step + 1 : 0;
    this.endMark.hidden = !!nextSlide;
    this.next.hidden = !nextSlide;
    const nw = this.nextShot.getBoundingClientRect().width;
    if (nextSlide && nw > 0) {
      drawInto(this.next, nextSlide, deck, nw);
      showStep(this.next, nextSlide, nextStep);
    }
    this.drawFrames();
  }

  private render(push = true): void {
    const slide = this.slide();
    const n = stepsOfSlide(slide);
    const total = this.list.length;
    this.parts.currentLabel.replaceChildren(make('b', '', `Current: Slide ${this.at + 1} of ${total}`), make('span', '', n ? `Step ${this.step} of ${n}` : ''));
    const nextLabel = this.step < n ? `Next: Step ${this.step + 1} of ${n}` : this.at + 1 < total ? `Next: Slide ${this.at + 2} of ${total}` : 'Next: End of the show';
    this.parts.nextLabel.replaceChildren(make('b', '', nextLabel));
    this.parts.count.textContent = `${this.at + 1} / ${total}`;
    (this.parts.back as HTMLButtonElement).disabled = this.at === 0 && this.step === 0;
    const aside = slide.querySelector(':scope > aside.notes');
    const text = this.parts.text;
    text.replaceChildren();
    const has = !!aside && (aside.textContent ?? '').trim() !== '';
    text.classList.toggle('empty', !has);
    if (aside && has) for (const node of aside.childNodes) text.append(node.cloneNode(true));
    else text.textContent = 'This slide does not have notes.';
    text.querySelectorAll('[contenteditable]').forEach((node) => node.removeAttribute('contenteditable'));
    this.draw();
    if (push) this.push();
    this.tick();
  }

  private onKey(ev: KeyboardEvent): void {
    const inPopover = this.popover.contains(ev.target as Node);
    if (this.customizing && ev.key === 'Escape') this.customize(false);
    else if (!this.popover.hidden && ev.key === 'Escape') this.showParts(false);
    // a checkbox of the popover takes Space and Return
    else if (inPopover && (ev.key === ' ' || ev.key === 'Enter')) return;
    else if (this.el.classList.contains('asking')) {
      if (ev.key === 'Enter') this.answer(true);
      else if (ev.key === 'Escape') this.answer(false);
      else return;
    } else if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    else if (/^[0-9]$/.test(ev.key)) this.typed = (this.typed + ev.key).slice(-4);
    else if (ev.key === 'Enter' && this.typed) {
      this.goTo(Number(this.typed) - 1);
      this.typed = '';
    } else if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'].includes(ev.key)) this.go(1);
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'].includes(ev.key)) this.go(-1);
    else if (ev.key === 'Home') this.goTo(0);
    else if (ev.key === 'End') this.goTo(this.list.length - 1);
    else if (ev.key === 'Escape') this.finish();
    else return;
    ev.preventDefault();
    ev.stopPropagation();
  }

  // the end of the show. a rehearsal asks first whether its timings are kept
  finish(): void {
    if (!this.isOpen) return;
    if (this.mode !== 'rehearse') return this.close(null);
    if (this.el.classList.contains('asking')) return this.answer(false);
    this.account();
    this.since = null;
    this.slideSince = null;
    const n = this.times.size;
    this.parts.said.textContent = `The rehearsal took ${duration(this.elapsed)} over ${n} ${n === 1 ? 'slide' : 'slides'}. The seconds of each slide shown are written into its data-timing.`;
    this.el.classList.add('asking');
    this.parts.keep.focus({ preventScroll: true });
  }

  private answer(keep: boolean): void {
    void this.write(keep).catch((e) => this.app.fail(e));
  }

  // the seconds of each slide shown in the rehearsal
  timings(): Map<Element, number> {
    return new Map([...this.times].map(([s, ms]) => [s, seconds(ms)]));
  }

  private async write(keep: boolean): Promise<void> {
    const changed = [...this.timings()].filter(([s, sec]) => s.isConnected && s.getAttribute('data-timing') !== String(sec));
    this.close(null, false);
    if (keep && changed.length) {
      await this.app.history.transact('Rehearse Timings', () => {
        for (const [s, sec] of changed) this.app.doc.setTag(s, { attrs: { 'data-timing': String(sec) } }, 'timing');
      });
      this.app.invalidate('content');
    }
    this.resolve(keep);
  }

  close(result: boolean | null, resolve = true): void {
    clearInterval(this.timer);
    const last = this.list[this.at];
    if (this.el.open) this.el.close();
    this.el.classList.remove('asking');
    this.customize(false);
    this.showParts(false);
    // the show tab is ended with the display, as End Show of PowerPoint ends both
    try {
      this.audience?.close();
    } catch {
      // a tab of another origin is left to its viewer
    }
    this.audience = null;
    if (last?.isConnected) this.app.showSlide(last);
    if (resolve) this.resolve(result);
  }

  private resolve(result: boolean | null): void {
    const done = this.done;
    this.done = null;
    done?.(result);
  }
}
