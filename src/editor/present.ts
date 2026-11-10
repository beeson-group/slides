// the presenter display of the editor, as the presenter display of Keynote and the presenter view
// of PowerPoint: the current slide at its step, the next slide or step, the notes with A- and A+,
// the clock, and the elapsed time with pause and reset. with Presenter View, the saved deck is
// played in another tab and kept at the slide and step of the display. with Rehearse Timings, each
// slide is timed, and at the end the seconds spent on each slide shown are written into its
// data-timing, as one entry of the history. the slides are drawn from the page of the editor,
// hence a rehearsal needs no save

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

export const stepsOfSlide = (slide: Element): number => stepCount(stepsOf(fragsOf(slide).map(fragOf)));

// the clone of slide drawn into host is shown at step k: each fragment not seen at k is hidden
function showStep(host: HTMLElement, slide: Element, k: number): void {
  const clone = host.shadowRoot?.querySelector('.beeson-thumb .slides > section');
  if (!clone) return;
  const frags = fragsOf(clone);
  const steps = stepsOf(fragsOf(slide).map(fragOf));
  frags.forEach((f, i) => f.classList.toggle('beeson-off', i < steps.length && !seenAt(fragOf(f).kind, steps[i], k)));
}

const NOTES_KEY = 'beeson-presenter-notes';
// the sizes of the text of the notes, in CSS px
const NOTE_SIZES = [14, 16, 18, 21, 24, 28, 32, 40];

const CSS = `
dialog.beeson-edit-presenter { box-sizing: border-box; width: 100vw; height: 100vh; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: var(--ed-canvas); color: var(--ed-text); font: 13px/1.35 var(--ed-font); outline: none; overflow: hidden; }
dialog.beeson-edit-presenter[open] { display: grid; grid-template-rows: 48px minmax(0, 1fr) 44px; }
dialog.beeson-edit-presenter::backdrop { background: var(--ed-canvas); }
.beeson-edit-presenter .bar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; padding: 0 14px; background: var(--ed-bg); border-bottom: 1px solid var(--ed-line); user-select: none; -webkit-user-select: none; }
.beeson-edit-presenter .bar.foot { grid-row: 3; border-bottom: 0; border-top: 1px solid var(--ed-line); }
.beeson-edit-presenter .bar > :last-child { justify-self: end; }
.beeson-edit-presenter .group { display: flex; align-items: center; gap: 8px; min-width: 0; }
.beeson-edit-presenter button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; height: 28px; min-width: 28px; padding: 0 9px; border: 0; border-radius: 6px; background: transparent; color: inherit; font: 12px/1 var(--ed-font); cursor: default; white-space: nowrap; }
.beeson-edit-presenter button:hover:not(:disabled) { background: var(--ed-hover); }
.beeson-edit-presenter button:active:not(:disabled) { background: var(--ed-pressed); }
.beeson-edit-presenter button:disabled { color: var(--ed-faint); }
.beeson-edit-presenter button:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 1px; }
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
.beeson-edit-presenter .notes .text.empty { color: var(--ed-faint); }
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
  private readonly nextShot = make('div', 'shot');
  private readonly endMark = make('div', 'end-mark', 'End of the show');
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
    const middle = make('div', 'group');
    middle.append(pause, elapsed, reset);
    const clock = make('span', 'clock');
    clock.setAttribute('aria-label', 'Clock');
    const top = make('div', 'bar top');
    top.append(left, middle, clock);

    const shotCurrent = make('div', 'shot current');
    shotCurrent.append(this.current);
    const currentLabel = make('div', 'label');
    const colLeft = make('div', 'col');
    colLeft.append(currentLabel, shotCurrent);
    this.nextShot.append(this.next, this.endMark);
    const nextLabel = make('div', 'label');
    const notes = make('div', 'notes');
    const head = make('div', 'head');
    const smaller = tool('A−', 'Make the notes smaller');
    const bigger = tool('A+', 'Make the notes bigger');
    smaller.addEventListener('click', () => this.zoomNotes(-1));
    bigger.addEventListener('click', () => this.zoomNotes(1));
    head.append(make('span', '', 'Notes'), smaller, bigger);
    const text = make('div', 'text');
    notes.append(head, text);
    const colRight = make('div', 'col');
    colRight.append(nextLabel, this.nextShot, notes);
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
    const right = make('div', 'group');
    right.append(audience, hint);
    const foot = make('div', 'bar foot');
    foot.append(nav, slideTime, right);

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

    el.append(top, stage, summary, foot);
    Object.assign(this.parts, { title, elapsed, clock, currentLabel, nextLabel, text, count, slideTime: slideTime.lastChild as HTMLElement, audience, said, pause, back, keep });
    el.addEventListener('keydown', (ev) => this.onKey(ev));
    el.addEventListener('cancel', (ev) => {
      ev.preventDefault();
      this.finish();
    });
    new ResizeObserver(() => this.draw()).observe(shotCurrent);
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
  // were not, and null for a show without a rehearsal
  open(mode: Mode, from: Element | null, audience: Window | null = null): Promise<boolean | null> {
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
    if (this.el.classList.contains('asking')) {
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
