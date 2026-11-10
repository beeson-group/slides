// the outline view of the navigator, as in Keynote: the heading of each slide, with the blocks of
// its text column under it, i.e. its paragraphs and the items of its lists at their levels. a
// heading, a paragraph, or an item is edited in place, and its text is written into the block of
// the slide through app.doc when the field is left, as a text typed on the canvas. Return splits a
// paragraph or an item and adds a slide after a heading, and Tab and Shift+Tab change the level of
// an item, with the commands of text/blocks.ts at the same place of the block. a block that is not
// edited here, e.g. a formula, a table, or a text with other markup, is drawn dimmed

import type { App } from '../app.ts';
import { canIndent, canOutdent, canSplit, indent, offsetIn, outdent, ownTex, selectIn, setOwnTex, split } from '../text/blocks.ts';
import { injectStyle, make, store, stored } from '../ui/dom.ts';

const KEY = 'beeson-outline';

// the text column of a slide, as columnOf of commands/clipboard.ts gives it, which is not imported
// here, since its media modules read the location of the page when they are loaded
const columnOf = (slide: Element): Element => slide.querySelector(':scope > .panel, :scope > .block, :scope > .sec') ?? slide;

const CSS = `
.beeson-edit-outline { flex: 1; min-height: 0; overflow: auto; padding: 8px 10px 40px 4px; font: 12px/1.35 var(--ed-font, system-ui, sans-serif); color: var(--nav-text); }
.beeson-edit-outline[hidden] { display: none; }
.beeson-edit-nav.outlined .rows { display: none; }
.beeson-edit-outline .slide { display: grid; grid-template-columns: 24px 1fr; column-gap: 6px; padding: 4px 0 6px; border-radius: 6px; }
.beeson-edit-outline .slide[aria-current="true"] { background: var(--nav-current); }
.beeson-edit-outline .slide.skip { opacity: 0.55; }
.beeson-edit-outline .no { grid-column: 1; grid-row: 1; padding-top: 2px; text-align: right; color: var(--nav-muted); font-variant-numeric: tabular-nums; }
.beeson-edit-outline .line { grid-column: 2; display: flex; align-items: baseline; gap: 6px; padding-left: calc(var(--depth, 0) * 14px); }
.beeson-edit-outline .line.title { font-weight: 600; }
.beeson-edit-outline .line:not(.title)::before { content: ''; flex: none; width: 5px; height: 1.5px; margin-bottom: 4px; background: currentColor; opacity: 0.6; }
.beeson-edit-outline .line.para::before { width: 0; }
.beeson-edit-outline .text { flex: 1; min-width: 0; padding: 1px 3px; border-radius: 3px; outline: none; overflow-wrap: anywhere; white-space: pre-wrap; }
.beeson-edit-outline .text:empty::after { content: attr(data-prompt); color: var(--nav-muted); }
.beeson-edit-outline .text[contenteditable="true"]:focus { background: var(--ed-field, rgba(127, 127, 127, 0.12)); box-shadow: 0 0 0 1.5px var(--nav-select); }
.beeson-edit-outline .line.dim .text { color: var(--nav-muted); font-style: italic; }
`;

// the markup that a field of the outline keeps, as it is typed on the canvas
const INLINE = new Set(['strong', 'em', 'b', 'i', 'code', 'sub', 'sup', 'br']);
const OTHER: [string, string][] = [['div.math', 'Formula'], ['table', 'Table'], ['pre', 'Code'], ['.qr', 'QR code'], ['img, video, figure', 'Figure']];

type Kind = 'title' | 'para' | 'item' | 'other';
type Entry = { slide: Element; el: Element; kind: Kind; text: HTMLElement; shown: string };

function plain(html: string): boolean {
  const div = document.createElement('div');
  div.innerHTML = html;
  return [...div.querySelectorAll('*')].every((e) => INLINE.has(e.localName) && !e.attributes.length);
}

// the HTML of a field, with the spaces and the last br of contenteditable taken off
function fieldHtml(text: HTMLElement): string {
  return text.innerHTML.replace(/&nbsp;/g, ' ').replace(/<br>$/, '').trim();
}

export class Outline {
  readonly el = make('div', 'beeson-edit-outline');
  private readonly app: App;
  private readonly pane: HTMLElement;
  private entries: Entry[] = [];
  private on = false;
  private busy = false;

  constructor(app: App, pane: HTMLElement) {
    injectStyle('outline', CSS);
    this.app = app;
    this.pane = pane;
    this.el.setAttribute('role', 'list');
    this.el.setAttribute('aria-label', 'Outline');
    this.el.hidden = true;
    // the keys of a field are its own, taken before the keys of the navigator, apart from the
    // keys of the commands with a modifier, e.g. Undo
    window.addEventListener('keydown', (ev) => this.onKey(ev), true);
    this.el.addEventListener('focusout', (ev) => {
      const t = ev.target instanceof HTMLElement ? this.entries.find((e) => e.text === ev.target) : null;
      if (t && !this.busy) void this.commit(t).then(() => setTimeout(() => this.refresh(), 0)).catch((e) => app.fail(e));
    });
    this.el.addEventListener('focusin', (ev) => {
      const t = this.entries.find((e) => e.text === ev.target);
      if (t && t.slide !== app.current()) app.showSlide(t.slide);
    });
    this.on = stored(KEY) === '1';
  }

  get shown(): boolean {
    return this.on;
  }

  toggle(): void {
    this.on = !this.on;
    store(KEY, this.on ? '1' : '0');
    this.refresh();
  }

  // the outline is drawn again after a change, unless one of its fields is edited
  refresh(): void {
    this.pane.classList.toggle('outlined', this.on);
    this.el.hidden = !this.on;
    if (!this.on || this.busy || this.el.contains(document.activeElement)) {
      this.mark();
      return;
    }
    this.build();
  }

  private mark(): void {
    const current = this.app.current();
    for (const g of this.el.children) g.setAttribute('aria-current', String((g as HTMLElement & { slide?: Element }).slide === current));
  }

  private build(): void {
    const slides = [...this.app.slides().querySelectorAll(':scope > section')];
    this.entries = [];
    const groups = slides.map((slide, i) => {
      const g = make('div', 'slide') as HTMLElement & { slide?: Element };
      g.slide = slide;
      g.setAttribute('role', 'listitem');
      const hidden = slide.getAttribute('data-visibility') === 'hidden';
      g.classList.toggle('skip', hidden);
      g.append(make('span', 'no', String(i + 1)));
      const title = slide.querySelector('h1, h2');
      if (title) g.append(this.line(slide, title, 'title', 0));
      const column = columnOf(slide);
      for (const block of this.blocks(column, title)) g.append(this.line(slide, block.el, block.kind, block.depth));
      return g;
    });
    this.el.replaceChildren(...groups);
    this.mark();
  }

  // the blocks of a text column in order, with the items of its lists at their levels
  private blocks(column: Element, title: Element | null): { el: Element; kind: Kind; depth: number }[] {
    const out: { el: Element; kind: Kind; depth: number }[] = [];
    const items = (list: Element, depth: number) => {
      for (const li of list.children) {
        if (li.localName !== 'li') continue;
        out.push({ el: li, kind: 'item', depth });
        for (const sub of li.children) if (sub.matches('ul, ol')) items(sub, depth + 1);
      }
    };
    for (const el of column.children) {
      if (el === title || el.hasAttribute('data-generated') || el.matches('aside, .foot, .run, .caption, .zone, .backdrop, .surface, .plot, script, h1, h2, ul.outline[data-auto]')) continue;
      if (el.matches('ul, ol')) items(el, 1);
      else if (el.matches('p, h3, h4')) out.push({ el, kind: 'para', depth: 1 });
      else if (el.matches('.col')) out.push(...this.blocks(el, null));
      else if (OTHER.some(([s]) => el.matches(s))) out.push({ el, kind: 'other', depth: 1 });
    }
    return out;
  }

  private line(slide: Element, el: Element, kind: Kind, depth: number): HTMLElement {
    const row = make('div', `line ${kind}`);
    row.style.setProperty('--depth', String(depth));
    const text = make('div', 'text');
    const host = this.app.hostOf(el);
    const html = kind === 'other' ? '' : ownTex(el);
    const editable = kind !== 'other' && !!host && plain(html);
    if (editable) {
      text.innerHTML = html;
      text.contentEditable = 'true';
      text.spellcheck = true;
      text.setAttribute('role', 'textbox');
      text.setAttribute('aria-label', kind === 'title' ? 'Slide title' : kind === 'item' ? 'List item' : 'Paragraph');
      text.dataset.prompt = kind === 'title' ? 'Title' : 'Text';
    } else {
      row.classList.add('dim');
      const name = OTHER.find(([s]) => el.matches(s))?.[1];
      // the own text of the block, with the TeX of its math, as it is typed
      const own = document.createElement('template');
      own.innerHTML = html;
      text.textContent = name ?? (own.content.textContent ?? '').replace(/\s+/g, ' ').trim();
      text.title = 'Edit this block on the slide';
    }
    row.append(text);
    this.entries.push({ slide, el, kind, text, shown: editable ? html : '' });
    return row;
  }

  // the text of a field written into its block, when it was changed
  private async commit(e: Entry): Promise<void> {
    if (e.text.contentEditable !== 'true' || !e.el.isConnected) return;
    const html = fieldHtml(e.text);
    if (html === e.shown) return;
    e.shown = html;
    await setOwnTex(this.app, e.el, html);
  }

  private onKey(ev: KeyboardEvent): void {
    const e = this.entries.find((x) => x.text === document.activeElement);
    if (!e || ev.isComposing) return;
    if (ev.metaKey || ev.ctrlKey || ev.altKey) {
      // the keys of a text, e.g. Select All and the clipboard, stay with the field
      if (/^[acvxz]$/i.test(ev.key) && !(ev.key.toLowerCase() === 'z')) ev.stopImmediatePropagation();
      return;
    }
    ev.stopImmediatePropagation();
    if (ev.key === 'Escape') {
      ev.preventDefault();
      e.text.blur();
    } else if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      void this.act(e, 'return').catch((err) => this.app.fail(err));
    } else if (ev.key === 'Tab') {
      ev.preventDefault();
      void this.act(e, ev.shiftKey ? 'outdent' : 'indent').catch((err) => this.app.fail(err));
    }
  }

  // Return, Tab, or Shift+Tab in a field: its text is written, the caret is put at the same place
  // of the block on the slide, and the command of the canvas is run there
  private async act(e: Entry, what: 'return' | 'indent' | 'outdent'): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const sel = window.getSelection();
      const at = sel?.rangeCount && e.text.contains(sel.getRangeAt(0).startContainer) ? offsetIn(e.text, sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset) : null;
      const math = /\\\(|\\\[/.test(e.text.textContent ?? '');
      await this.commit(e);
      const k = this.entries.indexOf(e);
      if (what === 'return' && e.kind === 'title') {
        this.app.showSlide(e.slide);
        await this.app.commands.run('slide.new');
        this.done(() => this.titleOf(this.app.current()));
        return;
      }
      const end = (e.el.textContent ?? '').length;
      selectIn(e.el, math || at === null ? end : at);
      if (what === 'return' && canSplit(this.app)) await split(this.app);
      else if (what === 'indent' && canIndent(this.app)) await indent(this.app);
      else if (what === 'outdent' && canOutdent(this.app)) await outdent(this.app);
      else {
        this.done(() => this.entries[k]?.text ?? null, at);
        return;
      }
      this.done(() => this.entries[what === 'return' ? k + 1 : k]?.text ?? null, what === 'return' ? 0 : at);
    } finally {
      this.busy = false;
    }
  }

  private titleOf(slide: Element | null): HTMLElement | null {
    return this.entries.find((x) => x.slide === slide && x.kind === 'title')?.text ?? null;
  }

  // the outline drawn again, with the focus in the field that pick gives, at the offset at
  private done(pick: () => HTMLElement | null, at: number | null = null): void {
    window.getSelection()?.removeAllRanges();
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.busy = false;
    this.build();
    const text = pick();
    if (!text) return;
    text.focus({ preventScroll: false });
    text.scrollIntoView({ block: 'nearest' });
    selectIn(text, at ?? (text.textContent ?? '').length);
  }
}
