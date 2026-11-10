// the accessibility checker, as Check Accessibility of PowerPoint: a panel of errors and warnings,
// each check with the elements it concerns, a click on an element to show it on its slide, a menu
// of fixes, and a line on why and how to fix it. the checks are those of section 1 of the plan: an
// image without alt text, a slide without a heading, a table without a header row, a video
// without a poster, and the texts that the editor cannot edit. the list is read again after each
// change while the panel is open

import type { App } from '../app.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { openMenu, type MenuItem } from '../ui/menu.ts';
import { paired } from './transitions.ts';

export type CheckId = 'alt' | 'heading' | 'header' | 'poster' | 'editable';
export type Severity = 'error' | 'warning';
export type Issue = { check: CheckId; slide: Element | null; el: Element | null; what: string };

export const CHECKS: { id: CheckId; severity: Severity; title: string; why: string; how: string }[] = [
  { id: 'alt', severity: 'error', title: 'Missing alternative text', why: 'A screen reader reads the alt text of an image in its place, and a reader of the PDF or of the page without images sees it.', how: 'Choose Add Alt Text and describe what the image shows, or mark an image that is only decoration as decorative.' },
  { id: 'heading', severity: 'error', title: 'Missing slide title', why: 'A slide is found and named by its title in the outline of a screen reader, in the navigator, and in the running head.', how: 'Give the slide an h2, or an h1 on a title slide.' },
  { id: 'header', severity: 'error', title: 'Missing table header', why: 'A screen reader names each cell by the header of its column, which it reads from a header row of th cells.', how: 'Choose Use First Row as Header.' },
  { id: 'poster', severity: 'warning', title: 'Video without a poster', why: 'A video without a poster is blank in the PDF, in the print view, and until it plays.', how: 'Give the video a poster, a PNG of its first frame, as AGENTS.md asks.' },
  { id: 'editable', severity: 'warning', title: 'Texts that cannot be edited', why: 'The editor did not match these texts to the file, hence an edit of them would not be saved.', how: 'Choose Show the Texts, and correct the markup of each one in the file.' },
];

const fileName = (src: string | null): string => (src ?? '').split(/[?#]/)[0].split('/').pop() || 'image';

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
    if (!heading) out.push({ check: 'heading', slide: s, el: null, what: 'Slide' });
  }
  for (const s of slides) for (const table of s.querySelectorAll('table')) {
    const first = (table as HTMLTableElement).rows[0];
    if (outside(table) && first && !first.querySelector('th')) out.push({ check: 'header', slide: s, el: table, what: 'Table' });
  }
  for (const s of slides) for (const video of s.querySelectorAll('video')) {
    if (outside(video) && !video.getAttribute('poster')) out.push({ check: 'poster', slide: s, el: video, what: `Video ${fileName(video.getAttribute('src'))}` });
  }
  for (const p of app.pairing?.problems ?? []) out.push({ check: 'editable', slide: p.slide, el: null, what: `${p.tag}: ${p.reason}` });
  return out;
}

const CSS = `
.beeson-edit-a11y { position: fixed; z-index: 80; top: 92px; right: calc(var(--ed-insp-col, 0px) + 16px); width: 340px; max-width: calc(100vw - 32px); max-height: calc(100vh - 140px); box-sizing: border-box; display: flex; flex-direction: column; background: var(--ed-panel); color: var(--ed-text); border: 1px solid var(--ed-menu-line); border-radius: 10px; box-shadow: 0 10px 32px rgba(0, 0, 0, 0.22), 0 0 0 0.5px rgba(0, 0, 0, 0.12); font: 13px/1.35 var(--ed-font); user-select: none; -webkit-user-select: none; }
@media (prefers-color-scheme: dark) { .beeson-edit-a11y { background: var(--ed-bg); box-shadow: 0 10px 32px rgba(0, 0, 0, 0.55), 0 0 0 0.5px rgba(0, 0, 0, 0.8); } }
.beeson-edit-a11y[hidden] { display: none; }
.beeson-edit-a11y .title { position: relative; flex: none; height: 28px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid var(--ed-line); color: var(--ed-muted); font-weight: 500; }
.beeson-edit-a11y .title .close { position: absolute; left: 9px; top: 8px; width: 12px; height: 12px; padding: 0; border: 0; border-radius: 50%; background: var(--ed-control-line); color: transparent; display: grid; place-items: center; }
.beeson-edit-a11y .title .close:hover, .beeson-edit-a11y .title .close:focus-visible { background: var(--ed-muted); color: var(--ed-panel); }
.beeson-edit-a11y .title .close svg { width: 8px; height: 8px; }
.beeson-edit-a11y .status { flex: none; display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--ed-line); font-weight: 600; }
.beeson-edit-a11y .status .dot { width: 9px; height: 9px; border-radius: 50%; background: #2e9e5b; }
.beeson-edit-a11y .status.bad .dot { background: var(--ed-guide); }
.beeson-edit-a11y .status .sub { margin-left: auto; color: var(--ed-muted); font-weight: 400; }
.beeson-edit-a11y .list { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 6px 6px 8px; }
.beeson-edit-a11y .kind { margin: 8px 8px 4px; color: var(--ed-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
.beeson-edit-a11y .check { display: flex; align-items: center; gap: 6px; width: 100%; height: 26px; padding: 0 8px 0 4px; border: 0; border-radius: 5px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: default; }
.beeson-edit-a11y .check:hover { background: var(--ed-hover); }
.beeson-edit-a11y .check svg { flex: none; color: var(--ed-muted); transition: transform 120ms; }
.beeson-edit-a11y .check[aria-expanded="true"] svg { transform: rotate(90deg); }
.beeson-edit-a11y .check .n { margin-left: auto; color: var(--ed-muted); font-variant-numeric: tabular-nums; }
.beeson-edit-a11y .items[hidden] { display: none; }
.beeson-edit-a11y .item { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 6px; min-height: 26px; margin: 1px 0; padding: 0 4px 0 28px; border-radius: 5px; cursor: default; }
.beeson-edit-a11y .item:hover { background: var(--ed-hover); }
.beeson-edit-a11y .item[aria-selected="true"] { background: var(--ed-select); color: var(--ed-on-select); }
.beeson-edit-a11y .item .what { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beeson-edit-a11y .item .where { color: var(--ed-muted); }
.beeson-edit-a11y .item[aria-selected="true"] .where { color: inherit; opacity: 0.8; }
.beeson-edit-a11y .item .fix { height: 20px; padding: 0 4px 0 7px; border: 0; border-radius: 4px; background: var(--ed-pressed); color: inherit; font: 12px/1 var(--ed-font); display: inline-flex; align-items: center; gap: 2px; cursor: default; }
.beeson-edit-a11y .item .fix:hover { box-shadow: inset 0 0 0 100px var(--ed-hover); }
.beeson-edit-a11y .item .fix:focus-visible, .beeson-edit-a11y button:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 1px; }
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
    this.el.setAttribute('role', 'dialog');
    this.el.tabIndex = -1;
    this.el.setAttribute('aria-label', 'Accessibility');
    const title = make('div', 'title', 'Accessibility');
    const close = make('button', 'close');
    close.type = 'button';
    close.title = 'Close the checker';
    close.setAttribute('aria-label', 'Close');
    close.append(icon('plus', 8));
    (close.firstChild as SVGElement).style.transform = 'rotate(45deg)';
    close.addEventListener('click', () => this.toggle(false));
    title.prepend(close);
    this.list.setAttribute('role', 'tree');
    this.list.setAttribute('aria-label', 'Inspection results');
    this.el.append(title, this.status, this.list, this.info);
    this.el.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape' || (ev.target as Element).matches('input')) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.toggle(false);
    });
    app.onRefresh(['content', 'structure'], () => {
      if (!this.el.hidden && !this.editing) this.refresh();
    });
  }

  get shown(): boolean {
    return !this.el.hidden;
  }

  toggle(on = this.el.hidden): void {
    if (!this.el.isConnected) document.body.append(this.el);
    this.el.hidden = !on;
    this.picked = null;
    this.editing = null;
    if (on) {
      this.refresh();
      (this.list.querySelector<HTMLElement>('.check') ?? this.el.querySelector<HTMLElement>('.close'))?.focus({ preventScroll: true });
    } else if (this.el.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  }

  refresh(): void {
    // the row or head with the focus is focused again in the new list, or else the panel
    const active = document.activeElement;
    const had = active instanceof HTMLElement && this.list.contains(active) ? (active.dataset.i ? `.item[data-i="${active.dataset.i}"]` : active.matches('.check') ? `.check[data-check="${active.dataset.check}"]` : null) : null;
    this.issues = inspect(this.app);
    const errors = this.issues.filter((i) => CHECKS.find((c) => c.id === i.check)?.severity === 'error').length;
    const warnings = this.issues.length - errors;
    this.status.classList.toggle('bad', this.issues.length > 0);
    const sub = [errors && `${errors} ${errors === 1 ? 'error' : 'errors'}`, warnings && `${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`].filter(Boolean).join(', ');
    this.status.replaceChildren(make('span', 'dot'), make('span', '', this.issues.length ? 'Investigate' : 'Good to go'), make('span', 'sub', sub));
    this.list.replaceChildren();
    if (!this.issues.length) this.list.append(make('div', 'good', 'No accessibility issues were found in this deck.'));
    for (const severity of ['error', 'warning'] as Severity[]) {
      const checks = CHECKS.filter((c) => c.severity === severity && this.issues.some((i) => i.check === c.id));
      if (!checks.length) continue;
      this.list.append(make('div', 'kind', severity === 'error' ? 'Errors' : 'Warnings'));
      for (const c of checks) this.list.append(...this.checkRows(c));
    }
    if (this.picked && !this.issues.some((i) => this.same(i, this.picked))) this.picked = null;
    this.showInfo();
    if (had && !this.editing) (this.list.querySelector<HTMLElement>(had) ?? this.el).focus({ preventScroll: true });
  }

  private same(a: Issue, b: Issue | null): boolean {
    return !!b && a.check === b.check && a.slide === b.slide && a.el === b.el && a.what === b.what;
  }

  private checkRows(c: (typeof CHECKS)[number]): HTMLElement[] {
    const list = this.issues.filter((i) => i.check === c.id);
    const head = make('button', 'check');
    head.type = 'button';
    head.dataset.check = c.id;
    head.setAttribute('role', 'treeitem');
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
    for (const issue of list) items.append(...this.itemRows(issue));
    return [head, items];
  }

  private itemRows(issue: Issue): HTMLElement[] {
    const row = make('div', 'item');
    row.setAttribute('role', 'treeitem');
    row.tabIndex = 0;
    row.dataset.check = issue.check;
    row.dataset.i = String(this.issues.indexOf(issue));
    row.setAttribute('aria-selected', String(this.same(issue, this.picked)));
    const label = make('span', 'what');
    label.append(document.createTextNode(`${issue.what} `), make('span', 'where', whereOf(this.app, issue.slide)));
    const fix = make('button', 'fix');
    fix.type = 'button';
    fix.title = 'Recommended actions';
    fix.append(document.createTextNode('Fix'), icon('chevron-down', 12));
    fix.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.pick(issue);
      openMenu(this.app, this.fixes(issue), { anchor: fix.getBoundingClientRect(), placement: 'below', owner: fix, keyboard: ev.detail === 0, label: 'Fixes' });
    });
    row.append(label, fix);
    row.addEventListener('click', () => this.pick(issue));
    row.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      this.pick(issue);
    });
    const out: HTMLElement[] = [row];
    if (issue.el && this.editing === issue.el) out.push(this.altField(issue.el));
    return out;
  }

  // the element of issue is shown on its slide and selected, and its check is explained
  pick(issue: Issue): void {
    this.picked = issue;
    const target = issue.el ?? issue.slide;
    if (target?.isConnected) this.app.showSlide(target);
    if (issue.el?.isConnected && issue.el.closest('section')) {
      const box = issue.el.closest('.zone, .plate, figure') ?? issue.el;
      this.app.selection.set('elements', [issue.el.matches('img, video, .qr') ? issue.el : box]);
    }
    const i = String(this.issues.findIndex((x) => this.same(x, issue)));
    for (const r of this.list.querySelectorAll<HTMLElement>('.item')) r.setAttribute('aria-selected', String(r.dataset.i === i));
    this.showInfo();
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
      case 'editable':
        return [{ label: 'Show the Texts…', run: run(() => this.app.files.showProblems()) }, go];
      default:
        return [go];
    }
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
