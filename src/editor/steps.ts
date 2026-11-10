// the steps of the current slide, i.e. which of its elements are reveal.js fragments and in which
// order. the order is read from the file and from the edits, since reveal.js renumbers the
// indices on the page, and it is shown in a pane at the right of the slide, as the animation pane
// of PowerPoint and the build order of Keynote: one row per element of the slide with a select of
// its step, and the number of the step at the upper left of each stepped element on the slide

import type { Entry } from './history.ts';
import type { Pairing } from './render.ts';
import { stepIn, type Step, type TagEdit } from './tags.ts';
import { OFF } from './layers.ts';
import { injectStyle } from './ui/dom.ts';

export type Group = Element[];
export type Ctx = {
  pairing(): Pairing | null;
  slide(): Element | null;
  edits: Map<Element, TagEdit>;
  markDirty(): void;
  layout(): void;
  // the slide of el is shown, for an undo from another slide
  show(el: Element): void;
  record(entry: Entry): void;
  // the TeX of an mjx-container, or null
  tex(el: Element): string | null;
  // the steps of the slide were changed, which may change its layers
  changed(): void;
};
// the step of an element at a moment, for the history
type State = { el: Element; step: Step };

// the elements of a slide that can be a step, outside the notes and the backdrop, and not inside
// another such element, e.g. an image inside a paragraph, which is shown with the paragraph. a
// heading and the footnote can be a step too, as any text box in PowerPoint, but One by one
// leaves them with the slide
const CANDIDATES = 'h1, h2, h3, p, li, table, pre, blockquote, div.math, figure, .zone, .plate, .qr, tycho-viewer, .caption, .foot, img, video';
const WITH_SLIDE = 'h1, h2, h3, .foot';
const OUTSIDE = 'aside.notes, .backdrop';

export function candidates(slide: Element, pairing: Pairing): Element[] {
  return [...slide.querySelectorAll(CANDIDATES)].filter((el) => {
    if (!pairing.elements.get(el)?.open) return false;
    const up = el.parentElement?.closest(`${CANDIDATES}, ${OUTSIDE}, section`);
    return !up || up === slide;
  });
}

export function stepOf(el: Element, pairing: Pairing, edits: Map<Element, TagEdit>): Step {
  const base = stepIn(pairing.elements.get(el)?.attrs ?? []);
  const e = edits.get(el);
  return { fragment: e?.fragment ?? base.fragment, index: e?.index !== undefined ? e.index : base.index };
}

// the steps of the slide in order, each a group of the elements shown together, as reveal.js
// sorts them: by index, then the elements without an index one by one in document order
export function groupsOf(els: Element[], pairing: Pairing, edits: Map<Element, TagEdit>): Group[] {
  const steps = els.map((el) => ({ el, ...stepOf(el, pairing, edits) })).filter((s) => s.fragment);
  const groups: Group[] = [];
  let last: number | null = null;
  for (const s of steps.filter((s) => s.index !== null).sort((a, b) => (a.index as number) - (b.index as number))) {
    if (s.index !== last) {
      groups.push([]);
      last = s.index;
    }
    groups[groups.length - 1].push(s.el);
  }
  for (const s of steps) if (s.index === null) groups.push([s.el]);
  return groups;
}

const KINDS: [string, string][] = [['h1, h2, h3', 'Heading'], ['.foot', 'Footnote'], ['li', 'Item'], ['p', 'Paragraph'], ['div.math', 'Formula'], ['table', 'Table'], ['pre', 'Code'], ['blockquote', 'Quotation'], ['video', 'Video'], ['tycho-viewer', 'Scene'], ['.qr', 'QR code'], ['.caption', 'Caption'], ['img, figure, .zone, .plate', 'Figure']];

// the text of el with each formula given by its TeX, since an mjx-container does not have text
function textOf(el: Element, tex: Ctx['tex']): string {
  let out = '';
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) out += child.nodeValue ?? '';
    else if (child instanceof Element) out += child.localName === 'mjx-container' ? tex(child) ?? '' : textOf(child, tex);
  }
  return out;
}

function describe(el: Element, tex: Ctx['tex']): { kind: string; text: string } {
  const kind = KINDS.find(([selector]) => el.matches(selector))?.[1] ?? el.localName;
  const media = el.matches('img, video') ? el : el.querySelector('img, video');
  let text = textOf(el, tex).replace(/\s+/g, ' ').trim();
  if (!text && media) text = media.getAttribute('alt') || (media.getAttribute('src') ?? media.querySelector('source')?.getAttribute('src') ?? '').split('/').pop() || '';
  if (!text && el.matches('tycho-viewer')) text = el.getAttribute('src')?.split('/').pop() ?? '';
  return { kind, text: text.length > 60 ? `${text.slice(0, 60)}…` : text };
}

const CSS = `
.beeson-edit-side { position: fixed; right: 0; top: 44px; bottom: 36px; z-index: 50; width: 320px; box-sizing: border-box; display: none; flex-direction: column; background: var(--bg, #000); border-left: 1px solid var(--line, #555); color: var(--text, #eee); font: 13px/1.4 system-ui, sans-serif; }
html.beeson-steps .beeson-edit-side { display: flex; }
.beeson-edit-side .head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--line, #555); }
.beeson-edit-side .head span { flex: 1; font-weight: 600; }
.beeson-edit-side .head button, .beeson-edit-side select { font: inherit; font-size: 12px; padding: 2px 8px; border: 1px solid var(--line, #555); border-radius: 6px; background: var(--bg, #000); color: var(--text, #eee); cursor: pointer; }
.beeson-edit-side .head button:hover { border-color: var(--subtle, #bbb); }
.beeson-edit-side .rows { flex: 1; overflow: auto; padding: 6px 0; }
.beeson-edit-side .row { display: grid; grid-template-columns: auto auto 1fr; align-items: center; gap: 8px; padding: 5px 12px; cursor: default; }
.beeson-edit-side .row:hover { background: color-mix(in srgb, var(--violet, #96f) 18%, transparent); }
.beeson-edit-side .row .kind { color: var(--subtle, #bbb); white-space: nowrap; }
.beeson-edit-side .row .text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beeson-edit-side .empty, .beeson-edit-side .foot { margin: 0; padding: 10px 12px; color: var(--subtle, #bbb); font-size: 12px; }
.beeson-edit-side .foot { border-top: 1px solid var(--line, #555); }
.beeson-badges { position: fixed; inset: 0; z-index: 52; pointer-events: none; }
.beeson-badge { position: absolute; transform: translate(-50%, -50%); min-width: 22px; height: 22px; padding: 0 5px; box-sizing: border-box; border-radius: 11px; background: var(--accent, #f80); color: #000; font: 600 13px/22px system-ui, sans-serif; text-align: center; }
html.beeson-editing .reveal .beeson-hover { outline: 2px solid var(--accent, #f80) !important; outline-offset: 6px; }
`;

export class Steps {
  readonly pane = document.createElement('div');
  readonly badges = document.createElement('div');
  readonly button = document.createElement('button');
  private readonly list = document.createElement('div');
  private readonly ctx: Ctx;
  private on = false;
  // what the rows show, so that they are built again only when it changes, since a select that
  // is being opened would be lost
  private key = '';

  constructor(ctx: Ctx) {
    injectStyle('steps', CSS);
    this.ctx = ctx;
    this.pane.className = 'beeson-edit-side';
    this.badges.className = 'beeson-badges';
    this.button.textContent = 'Steps';
    this.button.title = 'Show the order in which the elements of the slide appear';
    this.button.setAttribute('aria-pressed', 'false');
    const head = document.createElement('div');
    head.className = 'head';
    const title = document.createElement('span');
    title.textContent = 'Steps';
    const each = document.createElement('button');
    each.textContent = 'One by one';
    each.title = 'Show every element of the slide in a step of its own, in reading order';
    const none = document.createElement('button');
    none.textContent = 'All at once';
    none.title = 'Show every element with the slide';
    each.addEventListener('click', () => this.setAll(true));
    none.addEventListener('click', () => this.setAll(false));
    head.append(title, each, none);
    this.list.className = 'rows';
    const foot = document.createElement('p');
    foot.className = 'foot';
    foot.textContent = 'Elements with the same step appear together. A step is a reveal.js fragment in the file.';
    this.pane.append(head, this.list, foot);
    this.button.addEventListener('click', () => this.toggle());
  }

  toggle(): void {
    this.on = document.documentElement.classList.toggle('beeson-steps');
    this.button.classList.toggle('on', this.on);
    this.button.setAttribute('aria-pressed', String(this.on));
    this.ctx.layout();
    this.refresh();
  }

  get shown(): boolean {
    return this.on;
  }

  // the numbers on the slide follow its layout, and the rows are built again when the slide or
  // its steps change
  refresh(): void {
    this.badges.replaceChildren();
    const pairing = this.ctx.pairing();
    const slide = this.ctx.slide();
    if (!this.on || !pairing || !slide) {
      this.key = '';
      this.list.replaceChildren();
      return;
    }
    const els = candidates(slide, pairing);
    const groups = groupsOf(els, pairing, this.ctx.edits);
    const stepOf = (el: Element) => groups.findIndex((g) => g.includes(el));
    for (const el of els) {
      const at = stepOf(el);
      // an element of another layer of the slide is hidden, and so is its number
      if (at < 0 || el.closest(`.${OFF}`)) continue;
      const rect = el.getBoundingClientRect();
      const badge = document.createElement('span');
      badge.className = 'beeson-badge';
      badge.textContent = String(at + 1);
      badge.style.left = `${rect.left}px`;
      badge.style.top = `${rect.top}px`;
      this.badges.append(badge);
    }
    const described = els.map((el) => describe(el, this.ctx.tex));
    const rows = els.map((el, i) => `${stepOf(el)}|${described[i].kind}|${described[i].text}`);
    const key = [pairing.sections.findIndex((s) => s.live === slide), groups.length, ...rows].join('\n');
    if (key === this.key) return;
    this.key = key;
    this.list.replaceChildren();
    if (!els.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'This slide has no element that can be a step.';
      this.list.append(empty);
      return;
    }
    els.forEach((el, i) => {
      const at = stepOf(el);
      const { kind, text } = described[i];
      const row = document.createElement('div');
      row.className = 'row';
      const select = document.createElement('select');
      select.title = 'The step at which this element appears';
      select.setAttribute('aria-label', `Step of the ${kind.toLowerCase()}${text ? `: ${text}` : ''}`);
      const option = (value: string, text: string) => {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = text;
        select.append(o);
      };
      option('', 'With slide');
      if (groups.length) option('before', 'Step 1, new, before the others');
      groups.forEach((_, g) => option(String(g), `Step ${g + 1}`));
      option(String(groups.length), `Step ${groups.length + 1}, new`);
      select.value = at < 0 ? '' : String(at);
      select.addEventListener('change', () => this.setStep(el, select.value === '' ? null : select.value === 'before' ? 'before' : Number(select.value)));
      const kindEl = document.createElement('span');
      kindEl.className = 'kind';
      kindEl.textContent = kind;
      const textEl = document.createElement('span');
      textEl.className = 'text';
      textEl.textContent = text;
      row.append(select, kindEl, textEl);
      row.addEventListener('pointerenter', () => el.classList.add('beeson-hover'));
      row.addEventListener('pointerleave', () => el.classList.remove('beeson-hover'));
      this.list.append(row);
    });
  }

  // moves el to the group at position to, to a new last group with to at the count of the
  // groups, to a new first group with 'before', which shifts the others by one, or out of the
  // steps with null
  setStep(el: Element, to: number | 'before' | null): void {
    const pairing = this.ctx.pairing();
    const slide = this.ctx.slide();
    if (!pairing || !slide) return;
    const els = candidates(slide, pairing);
    let groups = groupsOf(els, pairing, this.ctx.edits);
    const target: Group | 'new' | 'before' | null = to === null || to === 'before' ? to : to >= groups.length ? 'new' : groups[to];
    for (const g of groups) {
      const i = g.indexOf(el);
      if (i >= 0) g.splice(i, 1);
    }
    groups = groups.filter((g) => g.length);
    if (target === 'before') groups.unshift([el]);
    else if (target === 'new') groups.push([el]);
    else if (target && groups.includes(target)) target.push(el);
    else if (target) groups.push([el]);
    this.write(els, groups, pairing);
  }

  private setAll(each: boolean): void {
    const pairing = this.ctx.pairing();
    const slide = this.ctx.slide();
    if (!pairing || !slide) return;
    const els = candidates(slide, pairing);
    this.write(els, each ? els.filter((el) => !el.matches(WITH_SLIDE)).map((el) => [el]) : [], pairing);
  }

  // the indices of the slide, numbered from the lowest index in the file, or from 1, are written
  // into the edits and onto the page. an element that is not in a group is shown with the slide,
  // and the change is one entry of the history
  private write(els: Element[], groups: Group[], pairing: Pairing): void {
    const given = els.map((el) => stepIn(pairing.elements.get(el)?.attrs ?? []).index).filter((i): i is number => i !== null);
    const base = given.length ? Math.min(1, ...given) : 1;
    const before: State[] = els.map((el) => ({ el, step: stepOf(el, pairing, this.ctx.edits) }));
    const after: State[] = els.map((el) => {
      const at = groups.findIndex((g) => g.includes(el));
      return { el, step: at < 0 ? { fragment: false, index: null } : { fragment: true, index: base + at } };
    });
    if (before.every((b, i) => b.step.fragment === after[i].step.fragment && b.step.index === after[i].step.index)) return;
    this.apply(after);
    this.ctx.record({ label: 'steps', undo: () => this.apply(before), redo: () => this.apply(after) });
  }

  private apply(states: State[]): void {
    if (states.length) this.ctx.show(states[0].el);
    for (const { el, step } of states) {
      this.ctx.edits.set(el, { ...this.ctx.edits.get(el), ...step });
      el.classList.toggle('fragment', step.fragment);
      el.classList.toggle('visible', step.fragment);
      el.classList.remove('current-fragment');
      if (step.index === null) el.removeAttribute('data-fragment-index');
      else el.setAttribute('data-fragment-index', String(step.index));
    }
    this.ctx.markDirty();
    this.ctx.changed();
  }
}
