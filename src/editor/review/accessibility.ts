// the accessibility checker, as Check Accessibility of PowerPoint: a pane docked at the right of
// the canvas, with the errors and the warnings of each check and the elements they concern, a click
// on an element to show it on its slide, a menu of fixes, and a line on why and how to fix it. the
// checks are those of section 1 of the plan: an image without alt text, a slide without a heading,
// a table without a header row, a video without a poster, and the texts that the editor cannot
// edit, and two checks of PowerPoint: the reading order of a slide and link text that does not
// name its target. the list is read again after each change while the pane is open, and else the
// state of the deck is read for the button Accessibility: Investigate of the status bar. the
// contrast of text is measured in contrast.ts, and its tips do not change that state

import type { App } from '../app.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { openMenu, type MenuItem } from '../ui/menu.ts';
import { contrastIssues, type Mode } from './contrast.ts';
import { paired } from './transitions.ts';

export type CheckId = 'alt' | 'heading' | 'header' | 'contrast' | 'poster' | 'order' | 'link' | 'editable' | 'behind';
export type Severity = 'error' | 'warning' | 'tip';
export type Issue = { check: CheckId; slide: Element | null; el: Element | null; what: string; mode?: Mode };

export const CHECKS: { id: CheckId; severity: Severity; title: string; why: string; how: string }[] = [
  { id: 'alt', severity: 'error', title: 'Missing alternative text', why: 'A screen reader reads the alt text of an image in its place, and a reader of the PDF or of the page without images sees it.', how: 'Choose Add Alt Text and describe what the image shows, or mark an image that is only decoration as decorative.' },
  { id: 'heading', severity: 'error', title: 'Missing slide title', why: 'A slide is found and named by its title in the outline of a screen reader, in the navigator, and in the running head.', how: 'Give the slide an h2, or an h1 on a title slide.' },
  { id: 'header', severity: 'error', title: 'Missing table header', why: 'A screen reader names each cell by the header of its column, which it reads from a header row of th cells.', how: 'Choose Use First Row as Header.' },
  { id: 'contrast', severity: 'warning', title: 'Hard-to-read text contrast', why: 'Text too close in color to what is behind it is hard to read on a projector, in daylight, and with low vision. WCAG 2 asks for a contrast of 4.5:1, or 3:1 for text of 36 px and more.', how: 'Choose Select and Show, and give the text another tone, e.g. Text or Subtle, that reads in both modes.' },
  { id: 'poster', severity: 'warning', title: 'Video without a poster', why: 'A video without a poster is blank in the PDF, in the print view, and until it plays.', how: 'Give the video a poster, a PNG of its first frame, as AGENTS.md asks.' },
  { id: 'order', severity: 'warning', title: 'Check reading order', why: 'A screen reader reads the elements of a slide in the order of the file, and here an element drawn above another is read after it.', how: 'Choose Select and Show, and move the element back to its place, or move its text in the file before the element under it.' },
  { id: 'link', severity: 'warning', title: 'Unclear link text', why: 'A screen reader can list the links of a slide by their text alone, and a link named "here" or by its address does not say where it goes.', how: 'Choose Edit Link, and give the link a few words that name its target.' },
  { id: 'editable', severity: 'warning', title: 'Texts that cannot be edited', why: 'The editor did not match these texts to the file, hence an edit of them would not be saved.', how: 'Choose Show the Texts, and correct the markup of each one in the file.' },
  { id: 'behind', severity: 'tip', title: 'Check text over a picture', why: 'The color behind a text over a backdrop, a surface, or a picture is not one color, hence its contrast is not measured.', how: 'Look at the slide in both modes, and move the text where the drawing is hard to read under it.' },
];

const severityOf = (i: Issue): Severity => CHECKS.find((c) => c.id === i.check)?.severity ?? 'warning';

const fileName = (src: string | null): string => (src ?? '').split(/[?#]/)[0].split('/').pop() || 'image';

// the elements of a slide that a screen reader reads one after the other, outermost first. a
// backdrop, a surface, a label of a backdrop, and a running head filled by the theme are left out
const UNITS = 'h1, h2, h3, h4, p, ul, ol, table, pre, div.math, figure, .zone, .plate, .qr, img, video, tycho-viewer, .caption, .foot';
const SKIP = 'aside.notes, .backdrop, .surface, .lab, [data-generated]';

const quote = (text: string): string => `"${text.length > 24 ? `${text.slice(0, 23)}…` : text}"`;

// the name of an element in a row of the checker: the start of its text, or its kind
function labelOf(el: Element): string {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (el.matches('img, video, .qr, tycho-viewer, .zone, .plate, figure') || !text) {
    return el.matches('table') ? 'Table' : el.matches('video') || el.querySelector('video') ? 'Video' : el.matches('.qr') ? 'QR code' : el.matches('div.math') ? 'Formula' : 'Figure';
  }
  return quote(text);
}

// the box of each element of els, in CSS px of the page. a slide that reveal.js does not lay out,
// i.e. one away from the current slide, is shown for the time of the measure only
function measure(slide: HTMLElement, els: Element[]): DOMRect[] {
  const style = slide.getAttribute('style');
  const hidden = !slide.getClientRects().length;
  if (hidden) slide.style.display = 'block';
  const out = els.map((el) => el.getBoundingClientRect());
  if (hidden) {
    if (style === null) slide.removeAttribute('style');
    else slide.setAttribute('style', style);
  }
  return out;
}

// the first pair of elements of slide whose reading order is not the order in which they are
// drawn: later comes after earlier in the file, and it is drawn above it in the same column
export function readingOrder(slide: Element): { earlier: Element; later: Element } | null {
  const all = [...slide.querySelectorAll(UNITS)].filter((el) => !el.closest(SKIP));
  const units = all.filter((el) => !all.some((o) => o !== el && o.contains(el)));
  const boxes = measure(slide as HTMLElement, units);
  const shown = units.map((el, i) => ({ el, r: boxes[i] })).filter(({ r }) => r.width > 0 && r.height > 0);
  for (let j = 1; j < shown.length; j++) {
    for (let i = 0; i < j; i++) {
      const a = shown[i].r, b = shown[j].r;
      const column = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0;
      if (column && b.bottom <= a.top + 1) return { earlier: shown[i].el, later: shown[j].el };
    }
  }
  return null;
}

// link text that does not name the target of the link, as the Accessibility Checker of PowerPoint
// finds it: a bare address, the address of the link, a word such as here, or no text
const VAGUE = /^(click here|click|here|link|this link|this|more|read more|learn more|details|website|this page|page|go)[.!:]?$/i;

export function unclearLink(a: Element): boolean {
  const text = (a.textContent ?? '').replace(/\s+/g, ' ').trim();
  const href = (a.getAttribute('href') ?? '').trim();
  if (!text) return !a.querySelector('img[alt]:not([alt=""])');
  return VAGUE.test(text) || /^(https?:\/\/|www\.)\S+$/i.test(text) || text === href;
}

// the issues of the slides, in the order of the checks and then of the slides
export function inspect(app: App): Issue[] {
  const slides = [...app.slides().querySelectorAll(':scope > section')];
  const out: Issue[] = [];
  const outside = (el: Element) => !el.closest('aside.notes');
  for (const s of slides) for (const img of s.querySelectorAll('img')) {
    if (outside(img) && !img.hasAttribute('alt') && img.getAttribute('role') !== 'presentation') out.push({ check: 'alt', slide: s, el: img, what: `Image ${fileName(img.getAttribute('src'))}` });
  }
  for (const s of slides) {
    const heading = [...s.querySelectorAll('h1, h2')].find((h) => outside(h) && (h.textContent ?? '').trim());
    if (!heading) out.push({ check: 'heading', slide: s, el: null, what: '' });
  }
  for (const s of slides) for (const table of s.querySelectorAll('table')) {
    const first = (table as HTMLTableElement).rows[0];
    if (outside(table) && first && !first.querySelector('th')) out.push({ check: 'header', slide: s, el: table, what: 'Table' });
  }
  for (const s of slides) for (const video of s.querySelectorAll('video')) {
    if (outside(video) && !video.getAttribute('poster')) out.push({ check: 'poster', slide: s, el: video, what: `Video ${fileName(video.getAttribute('src'))}` });
  }
  for (const s of slides) {
    const order = readingOrder(s);
    if (order) out.push({ check: 'order', slide: s, el: order.later, what: `${labelOf(order.later)} after ${labelOf(order.earlier)}` });
  }
  for (const s of slides) for (const a of s.querySelectorAll('a')) {
    if (outside(a) && unclearLink(a)) out.push({ check: 'link', slide: s, el: a, what: `Link ${quote((a.textContent ?? '').trim() || a.getAttribute('href') || '')}` });
  }
  for (const p of app.pairing?.problems ?? []) out.push({ check: 'editable', slide: p.slide, el: null, what: `${p.tag}: ${p.reason}` });
  out.push(...contrastIssues(slides));
  return out;
}

const CSS = `
.beeson-edit-a11y { position: relative; z-index: 50; min-width: 0; min-height: 0; box-sizing: border-box; display: flex; flex-direction: column; background: var(--ed-panel); color: var(--ed-text); border-left: 1px solid var(--ed-line); font: 13px/1.35 var(--ed-font); user-select: none; -webkit-user-select: none; }
.beeson-edit-a11y[hidden] { display: none; }
.beeson-edit-a11y .title { flex: none; height: 36px; display: flex; align-items: center; gap: 8px; padding: 0 8px 0 14px; border-bottom: 1px solid var(--ed-line); font-weight: 600; }
.beeson-edit-a11y .title .close { margin-left: auto; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--ed-muted); display: grid; place-items: center; }
.beeson-edit-a11y .title .close:hover { background: var(--ed-hover); color: var(--ed-text); }
.beeson-edit-a11y .title .close svg { width: 14px; height: 14px; }
.beeson-edit-a11y .status { flex: none; display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--ed-line); font-weight: 600; }
.beeson-edit-a11y .status .dot { width: 9px; height: 9px; border-radius: 50%; background: #2e9e5b; }
.beeson-edit-a11y .status.bad .dot { background: var(--ed-guide); }
.beeson-edit-a11y .status .sub { margin-left: auto; color: var(--ed-muted); font-weight: 400; }
.beeson-edit-a11y .list { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 6px 6px 8px; }
.beeson-edit-a11y .kind { margin: 8px 8px 4px; color: var(--ed-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
.beeson-edit-a11y :is(.check, .tiphead) { display: flex; align-items: center; gap: 6px; width: 100%; height: 26px; padding: 0 8px 0 4px; border: 0; border-radius: 5px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: default; }
.beeson-edit-a11y :is(.check, .tiphead):hover { background: var(--ed-hover); }
.beeson-edit-a11y :is(.check, .tiphead) svg { flex: none; color: var(--ed-muted); transition: transform 120ms; }
.beeson-edit-a11y :is(.check, .tiphead)[aria-expanded="true"] svg { transform: rotate(90deg); }
.beeson-edit-a11y :is(.check, .tiphead) .n { margin-left: auto; color: var(--ed-muted); font-variant-numeric: tabular-nums; }
.beeson-edit-a11y .items[hidden] { display: none; }
.beeson-edit-a11y :is(.item, .hint) { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 6px; min-height: 26px; margin: 1px 0; padding: 0 4px 0 28px; border-radius: 5px; cursor: default; }
.beeson-edit-a11y :is(.item, .hint):hover { background: var(--ed-hover); }
.beeson-edit-a11y :is(.item, .hint)[aria-selected="true"] { background: var(--ed-select); color: var(--ed-on-select); }
.beeson-edit-a11y :is(.item, .hint) .what { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beeson-edit-a11y :is(.item, .hint) .where { color: var(--ed-muted); }
.beeson-edit-a11y :is(.item, .hint)[aria-selected="true"] .where { color: inherit; opacity: 0.8; }
.beeson-edit-a11y :is(.item, .hint) .fix { height: 20px; padding: 0 4px 0 7px; border: 0; border-radius: 4px; background: var(--ed-pressed); color: inherit; font: 12px/1 var(--ed-font); display: inline-flex; align-items: center; gap: 2px; cursor: default; }
.beeson-edit-a11y :is(.item, .hint) .fix:hover { box-shadow: inset 0 0 0 100px var(--ed-hover); }
.beeson-edit-a11y :is(.item, .hint) .fix:focus-visible, .beeson-edit-a11y button:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 1px; }
.beeson-edit-a11y .alt { display: flex; gap: 6px; margin: 2px 4px 6px 28px; }
.beeson-edit-a11y .alt input { flex: 1; min-width: 0; height: 24px; box-sizing: border-box; padding: 0 7px; border: 1px solid var(--ed-control-line); border-radius: 5px; background: var(--ed-control); color: var(--ed-text); font: inherit; user-select: text; -webkit-user-select: text; }
.beeson-edit-a11y .alt input:focus { outline: none; border-color: var(--ed-select); box-shadow: 0 0 0 3px var(--ed-focus); }
.beeson-edit-a11y .alt button { height: 24px; padding: 0 10px; border: 0; border-radius: 5px; background: var(--ed-select); color: var(--ed-on-select); font: inherit; }
.beeson-edit-a11y .good { margin: 18px 14px; color: var(--ed-muted); text-align: center; }
.beeson-edit-a11y .info { flex: none; border-top: 1px solid var(--ed-line); padding: 10px 14px 12px; font-size: 12px; user-select: text; -webkit-user-select: text; }
.beeson-edit-a11y .info[hidden] { display: none; }
.beeson-edit-a11y .info h4 { margin: 0 0 2px; font: 600 12px/1.3 var(--ed-font); }
.beeson-edit-a11y .info p { margin: 0 0 8px; color: var(--ed-muted); }
.beeson-edit-a11y .info p:last-child { margin-bottom: 0; }
`;

type Theme = { get(): string; set(theme: 'dark' | 'light'): void };
const theme = (): Theme | undefined => (window as unknown as { Beeson?: { theme?: Theme } }).Beeson?.theme;
const frame = () => new Promise((done) => requestAnimationFrame(done));

// the slide is flipped into the mode of el when el is shown in the other mode only, or into the
// mode of its issue, and the promise is resolved once el has a box, or after 1.5 s. the theme
// applies a mode at the end of the first frame of its view transition
async function shownInMode(el: Element, of?: Mode): Promise<void> {
  const mode = el.closest('.for-light') ? 'light' : el.closest('.for-dark') ? 'dark' : (of ?? null);
  const t = theme();
  if (!mode || !t || t.get() === mode) return;
  t.set(mode);
  const end = performance.now() + 1500;
  while (!el.getClientRects().length && performance.now() < end) await frame();
}

// the label of the slide of an issue, e.g. Slide 4
const whereOf = (app: App, slide: Element | null): string => (slide ? `Slide ${app.slideNumber(slide) ?? '?'}` : '');

export class Checker {
  readonly el = make('div', 'beeson-edit-a11y');
  private readonly app: App;
  private readonly status = make('div', 'status');
  private readonly list = make('div', 'list');
  private readonly info = make('div', 'info');
  private readonly closed = new Set<CheckId>();
  private picked: Issue | null = null;
  private editing: Element | null = null;
  issues: Issue[] = [];

  constructor(app: App) {
    this.app = app;
    injectStyle('a11y', CSS);
    this.el.hidden = true;
    this.el.setAttribute('role', 'complementary');
    this.el.tabIndex = -1;
    this.el.setAttribute('aria-label', 'Accessibility');
    const title = make('div', 'title', 'Accessibility');
    const close = make('button', 'close');
    close.type = 'button';
    close.title = 'Close the pane';
    close.setAttribute('aria-label', 'Close');
    close.append(icon('plus', 14));
    (close.firstChild as SVGElement).style.transform = 'rotate(45deg)';
    close.addEventListener('click', () => this.toggle(false));
    title.append(close);
    this.list.setAttribute('role', 'tree');
    this.list.setAttribute('aria-label', 'Inspection results');
    this.el.append(title, this.status, this.list, this.info);
    this.list.addEventListener('focusin', (ev) => this.rove((ev.target as Element).closest<HTMLElement>('[role="treeitem"]')));
    this.list.addEventListener('keydown', (ev) => this.treeKey(ev));
    this.el.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape' || (ev.target as Element).matches('input')) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.toggle(false);
    });
    app.onRefresh(['content', 'structure'], () => {
      if (this.el.hidden) this.summarySoon();
      else if (!this.editing) this.refresh();
    });
    app.listen('report', () => this.el.hidden && this.summarySoon());
  }

  get shown(): boolean {
    return !this.el.hidden;
  }

  // the pane is docked at the right of the canvas, before the inspector, as the Accessibility pane
  // of PowerPoint, and the canvas is laid out again in the space that is left
  toggle(on = this.el.hidden): void {
    const inspector = document.querySelector('.beeson-edit-inspector');
    if (!this.el.isConnected || (inspector && this.el.nextElementSibling !== inspector)) {
      if (inspector) inspector.before(this.el);
      else document.body.append(this.el);
    }
    this.el.hidden = !on;
    document.documentElement.classList.toggle('beeson-a11y', on);
    this.picked = null;
    this.editing = null;
    if (on) {
      this.refresh();
      (this.list.querySelector<HTMLElement>('.check') ?? this.el.querySelector<HTMLElement>('.close'))?.focus({ preventScroll: true });
    } else if (this.el.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    this.showSummary();
    this.app.relayout();
  }

  // the state of the deck in the button of the status bar, read again 400 ms after the last change
  // while the pane is closed, since a check measures every slide
  private timer = 0;

  private summarySoon(): void {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      if (!this.app.pairing?.root) return;
      this.issues = inspect(this.app);
      this.showSummary();
    }, 400);
  }

  private showSummary(): void {
    const b = document.querySelector<HTMLButtonElement>('.beeson-edit-bottom .a11y');
    if (!b) return;
    const ready = !!this.app.pairing?.root;
    b.hidden = !ready;
    const bad = this.issues.some((i) => severityOf(i) !== 'tip');
    const state = bad ? 'Investigate' : 'Good to go';
    const text = b.querySelector('.text');
    if (text) text.textContent = `Accessibility: ${state}`;
    b.title = bad ? 'Open the accessibility pane to see the issues of the deck' : 'No accessibility issues were found in this deck';
    b.setAttribute('aria-pressed', String(this.shown));
  }

  refresh(): void {
    // the row or head with the focus is focused again in the new list. a row whose issue is gone,
    // e.g. after a fix, gives the focus to the row now at its place in its check, or to the head
    const active = document.activeElement;
    const row = active instanceof HTMLElement && this.list.contains(active) && active.dataset.check ? active : null;
    const was = row?.dataset.i ? this.issues[Number(row.dataset.i)] : null;
    const nth = row ? [...this.list.querySelectorAll(`[data-i][data-check="${row.dataset.check}"]`)].indexOf(row) : -1;
    this.issues = inspect(this.app);
    const errors = this.issues.filter((i) => severityOf(i) === 'error').length;
    const warnings = this.issues.filter((i) => severityOf(i) === 'warning').length;
    this.status.classList.toggle('bad', errors + warnings > 0);
    const sub = [errors && `${errors} ${errors === 1 ? 'error' : 'errors'}`, warnings && `${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`].filter(Boolean).join(', ');
    this.status.replaceChildren(make('span', 'dot'), make('span', '', errors + warnings ? 'Investigate' : 'Good to go'), make('span', 'sub', sub));
    this.list.replaceChildren();
    if (!(errors + warnings)) this.list.append(make('div', 'good', 'No accessibility issues were found in this deck.'));
    for (const severity of ['error', 'warning', 'tip'] as Severity[]) {
      const checks = CHECKS.filter((c) => c.severity === severity && this.issues.some((i) => i.check === c.id));
      if (!checks.length) continue;
      this.list.append(make('div', 'kind', severity === 'error' ? 'Errors' : severity === 'warning' ? 'Warnings' : 'Tips'));
      for (const c of checks) this.list.append(...this.checkRows(c));
    }
    if (this.picked && !this.issues.some((i) => this.same(i, this.picked))) this.picked = null;
    this.showInfo();
    this.showSummary();
    let back: HTMLElement | null = null;
    if (row) {
      const i = was ? this.issues.findIndex((x) => this.same(x, was)) : -1;
      const items = [...this.list.querySelectorAll<HTMLElement>(`[data-i][data-check="${row.dataset.check}"]`)];
      back = i >= 0 ? this.list.querySelector<HTMLElement>(`[data-i="${i}"]`) : nth >= 0 && items.length ? items[Math.min(nth, items.length - 1)] : null;
      back ??= this.list.querySelector<HTMLElement>(`:is(.check, .tiphead)[data-check="${row.dataset.check}"]`) ?? this.list.querySelector<HTMLElement>('[role="treeitem"]');
    }
    this.rove(back ?? this.list.querySelector<HTMLElement>('[role="treeitem"]'));
    if (row && !this.editing) (back ?? this.el).focus({ preventScroll: true });
  }

  // the tree is one Tab stop, the row to of a roving tabindex
  private rove(to: HTMLElement | null): void {
    if (to) for (const r of this.list.querySelectorAll<HTMLElement>('[role="treeitem"]')) r.tabIndex = r === to ? 0 : -1;
  }

  // the keys of a tree of ARIA: the up and down arrows go between the shown rows, Home and End to
  // the first and the last, the right arrow opens a head or goes into it, the left arrow closes a
  // head or goes up to it, and the key of the context menu opens the fixes of a row
  private treeKey(ev: KeyboardEvent): void {
    const at = ev.target as HTMLElement;
    if (!at.matches('[role="treeitem"]') || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const rows = [...this.list.querySelectorAll<HTMLElement>('[role="treeitem"]')].filter((r) => r.getClientRects().length > 0);
    const i = rows.indexOf(at);
    const expanded = at.getAttribute('aria-expanded');
    let to: HTMLElement | null | undefined = null;
    if (ev.key === 'ContextMenu' || (ev.key === 'F10' && ev.shiftKey)) {
      const issue = this.issues[Number(at.dataset.i)];
      if (!issue) return;
      this.openFixes(issue, at.querySelector('.fix')!, true, null);
    } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') to = rows[i + (ev.key === 'ArrowDown' ? 1 : -1)];
    else if (ev.key === 'Home' || ev.key === 'End') to = ev.key === 'Home' ? rows[0] : rows[rows.length - 1];
    else if (ev.key === 'ArrowRight' && expanded) {
      if (expanded === 'false') at.click();
      else to = rows[i + 1];
    } else if (ev.key === 'ArrowLeft') {
      if (expanded === 'true') at.click();
      else to = this.list.querySelector<HTMLElement>(`.check[data-check="${at.dataset.check}"]`);
    } else return;
    ev.preventDefault();
    ev.stopPropagation();
    to?.focus({ preventScroll: true });
  }

  private openFixes(issue: Issue, fix: HTMLElement, keyboard: boolean, owner: HTMLElement | null): void {
    void this.pick(issue);
    // the tree may be built again while the menu is open, hence its row is found again at the close
    const onClose = () => {
      const i = this.issues.findIndex((x) => this.same(x, issue));
      if (keyboard && !owner) this.list.querySelector<HTMLElement>(`[data-i="${i}"]`)?.focus({ preventScroll: true });
    };
    openMenu(this.app, this.fixes(issue), { anchor: fix.getBoundingClientRect(), placement: 'below', owner, keyboard, label: 'Fixes', onClose });
  }

  private same(a: Issue, b: Issue | null): boolean {
    return !!b && a.check === b.check && a.slide === b.slide && a.el === b.el && a.what === b.what;
  }

  private checkRows(c: (typeof CHECKS)[number]): HTMLElement[] {
    const list = this.issues.filter((i) => i.check === c.id);
    // a tip is drawn as a check, under classes of its own, since it does not count as an issue
    const tip = c.severity === 'tip';
    const head = make('button', tip ? 'tiphead' : 'check');
    head.type = 'button';
    head.dataset.check = c.id;
    head.setAttribute('role', 'treeitem');
    head.tabIndex = -1;
    const open = !this.closed.has(c.id);
    head.setAttribute('aria-expanded', String(open));
    head.append(icon('chevron-right', 14), make('span', '', c.title), make('span', 'n', String(list.length)));
    const items = make('div', 'items');
    items.setAttribute('role', 'group');
    items.hidden = !open;
    head.addEventListener('click', () => {
      if (this.closed.has(c.id)) this.closed.delete(c.id);
      else this.closed.add(c.id);
      const now = !this.closed.has(c.id);
      head.setAttribute('aria-expanded', String(now));
      items.hidden = !now;
    });
    for (const issue of list) items.append(...this.itemRows(issue, tip));
    return [head, items];
  }

  private itemRows(issue: Issue, tip = false): HTMLElement[] {
    const row = make('div', tip ? 'hint' : 'item');
    row.setAttribute('role', 'treeitem');
    row.tabIndex = -1;
    row.dataset.check = issue.check;
    row.dataset.i = String(this.issues.indexOf(issue));
    row.setAttribute('aria-selected', String(this.same(issue, this.picked)));
    const label = make('span', 'what');
    if (issue.what) label.append(document.createTextNode(`${issue.what} `));
    label.append(make('span', issue.what ? 'where' : '', whereOf(this.app, issue.slide)));
    const fix = make('button', 'fix');
    fix.type = 'button';
    fix.tabIndex = -1;
    fix.title = 'Recommended actions';
    fix.append(document.createTextNode('Fix'), icon('chevron-down', 12));
    fix.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.openFixes(issue, fix, ev.detail === 0, fix);
    });
    row.append(label, fix);
    row.addEventListener('click', () => void this.pick(issue));
    row.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      void this.pick(issue);
    });
    const out: HTMLElement[] = [row];
    if (issue.el && this.editing === issue.el) out.push(this.altField(issue.el));
    return out;
  }

  // the element of issue is shown on its slide and selected, and its check is explained. an image
  // of one mode, e.g. for-light in dark mode, is shown by a flip of the slide into its mode first,
  // and it is selected once it has a box, so that its frame is measured after the flip
  async pick(issue: Issue): Promise<void> {
    this.picked = issue;
    const i = String(this.issues.findIndex((x) => this.same(x, issue)));
    for (const r of this.list.querySelectorAll<HTMLElement>('.item, .hint')) r.setAttribute('aria-selected', String(r.dataset.i === i));
    this.showInfo();
    const target = issue.el ?? issue.slide;
    if (target?.isConnected) this.app.showSlide(target);
    if (!issue.el?.isConnected || !issue.el.closest('section')) return;
    await shownInMode(issue.el, issue.mode);
    if (this.picked !== issue || !issue.el.isConnected) return;
    const text = issue.check === 'contrast' || issue.check === 'behind';
    const box = issue.check === 'link' ? (issue.el.closest('p, li, h1, h2, h3, h4, td, th, .caption, .foot') ?? issue.el) : text ? (this.app.move.movableOf(issue.el) ?? issue.el) : (issue.el.closest('.zone, .plate, figure') ?? issue.el);
    this.app.selection.set('elements', [issue.el.matches('img, video, .qr') ? issue.el : box]);
    this.app.invalidate('layout');
  }

  private showInfo(): void {
    const c = CHECKS.find((x) => x.id === this.picked?.check);
    this.info.hidden = !c;
    if (!c) return;
    const why = make('h4', '', 'Why fix:');
    const how = make('h4', '', 'How to fix:');
    this.info.replaceChildren(why, make('p', '', c.why), how, make('p', '', c.how));
  }

  private fixes(issue: Issue): MenuItem[] {
    const run = (fn: () => unknown) => () => Promise.resolve().then(fn).catch((e) => this.app.fail(e));
    const go: MenuItem = { label: issue.el ? 'Select and Show' : 'Go to Slide', run: run(() => this.pick(issue)) };
    const el = issue.el;
    switch (issue.check) {
      case 'alt':
        return [
          { label: 'Add Alt Text…', run: run(() => this.editAlt(issue)), disabled: !el || !paired(this.app, el) },
          { label: 'Mark as Decorative', run: run(() => this.app.commands.run('review.altText', { el, value: '' })), disabled: !el || !paired(this.app, el) },
          { rule: true },
          go,
        ];
      case 'header':
        return [{ command: 'review.tableHeader', arg: { el }, label: 'Use First Row as Header' }, { rule: true }, go];
      case 'link':
        return [{ label: 'Edit Link…', run: run(() => this.editLink(issue)), disabled: !el || !paired(this.app, el.closest('[contenteditable]') ?? el) }, { rule: true }, go];
      case 'editable':
        return [{ label: 'Show the Texts…', run: run(() => this.app.files.showProblems()) }, go];
      default:
        return [go];
    }
  }

  // the dialog of the link of issue, opened with the caret in its text
  private async editLink(issue: Issue): Promise<void> {
    const a = issue.el;
    if (!a?.isConnected) return;
    this.app.showSlide(a);
    const host = a.closest<HTMLElement>('[contenteditable="true"]');
    if (!host) return;
    host.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(a);
    range.collapse(false);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    await this.app.commands.run('text.link');
  }

  // a field under the row of an image without alt text, committed with Return and left with Esc
  private editAlt(issue: Issue): void {
    this.editing = issue.el;
    this.picked = issue;
    this.refresh();
    this.list.querySelector<HTMLInputElement>('.alt input')?.focus();
  }

  private altField(el: Element): HTMLElement {
    const box = make('div', 'alt');
    const input = make('input');
    input.type = 'text';
    input.placeholder = 'Describe the image';
    input.setAttribute('aria-label', 'Alt text');
    const done = make('button', '', 'Add');
    done.type = 'button';
    const commit = () => {
      const value = input.value.trim();
      this.editing = null;
      if (!value) return this.refresh();
      void this.app.commands.run('review.altText', { el, value }).catch((e) => this.app.fail(e)).finally(() => this.refresh());
    };
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') commit();
      else if (ev.key === 'Escape') {
        this.editing = null;
        this.refresh();
      } else return;
      ev.preventDefault();
      ev.stopPropagation();
    });
    done.addEventListener('click', commit);
    box.append(input, done);
    return box;
  }
}

// the first row of table made a header row: each td of it is retagged as th
export async function useHeaderRow(app: App, table: Element): Promise<void> {
  const first = (table as HTMLTableElement).rows[0];
  if (!first) return;
  for (const cell of [...first.cells]) if (cell.localName === 'td' && paired(app, cell)) await app.doc.retag(cell, 'th', {}, 'header row');
}
