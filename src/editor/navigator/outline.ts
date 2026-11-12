// the outline view of the navigator, as in Keynote: the heading of each slide, with the blocks of
// its text column under it, i.e. its paragraphs and the items of its lists at their levels. a
// heading, a paragraph, or an item is edited in place, and its text is written into the block of
// the slide through app.doc when the field is left, as a text typed on the canvas. Return splits a
// paragraph or an item and adds a slide after a heading, and Tab and Shift+Tab change the level of
// an item, with the commands of text/blocks.ts at the same place of the block, or move a line
// across slides with promote.ts. a block that is not edited here, e.g. a formula, a table, or a
// text with other markup, is drawn dimmed. the math of a line is typeset, apart from the line with
// the caret, which shows its TeX to be edited

import type { App } from '../app.ts';
import { besideBlock, canIndent, canOutdent, canSplit, indent, joinBackward, joinKind, offsetIn, outdent, ownTex, selectIn, setOwnTex, split } from '../text/blocks.ts';
import { holdTyping } from '../commands/edit.ts';
import { hasTex, typeset, untypeset } from '../typeset.ts';
import { demote, promote } from './promote.ts';
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

// the line of a locked block, or of a block inside a locked element, is read only, as the block is
// on the slide: its text is selected and copied, and nothing changes it
const lockedLine = (e: Entry) => !!e.el.closest('[data-locked]');

function plain(html: string): boolean {
  const div = document.createElement('div');
  div.innerHTML = html;
  return [...div.querySelectorAll('*')].every((e) => INLINE.has(e.localName) && !e.attributes.length);
}

// the HTML of a field, with the spaces and the last br of contenteditable taken off
function fieldHtml(text: HTMLElement): string {
  return text.innerHTML.replace(/&nbsp;/g, ' ').replace(/<br>$/, '').trim();
}

// the offset in the TeX of a typeset field of the point x, y, after a formula at the point
function texOffset(field: HTMLElement, x: number, y: number): number {
  const tex = field.dataset.tex ?? field.textContent ?? '';
  const formulas = [...tex.matchAll(/\\\(.*?\\\)|\\\[.*?\\\]/gs)].map((m) => m[0].length);
  const doc = document as Document & { caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null };
  const p = doc.caretPositionFromPoint?.(x, y);
  const r = p ? null : document.caretRangeFromPoint?.(x, y);
  const node = p?.offsetNode ?? r?.startContainer ?? null;
  const offset = p?.offset ?? r?.startOffset ?? 0;
  if (!node || !field.contains(node)) return tex.length;
  const math = (node instanceof Element ? node : node.parentElement)?.closest('mjx-container') ?? null;
  // the point before a child of an element is the end of the text before the child
  const before = !math && node instanceof Element ? (node.childNodes[offset] ?? null) : null;
  let count = 0;
  let k = 0;
  const walk = (parent: Node): boolean => {
    for (const c of parent.childNodes) {
      if (c === before) return true;
      if (c instanceof Element && c.localName === 'mjx-container') {
        count += formulas[k++] ?? 0;
        if (c === math) return true;
      } else if (c instanceof Text) {
        if (c === node) {
          count += offset;
          return true;
        }
        count += c.length;
      } else if (walk(c)) return true;
      if (c === node) return true;
    }
    return false;
  };
  walk(field);
  return Math.min(count, tex.length);
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
    const focused = () => this.entries.find((e) => e.text === document.activeElement);
    holdTyping(app, {
      active: () => !!focused(),
      pending: () => {
        const e = focused();
        return !!e && !this.busy && e.text.contentEditable === 'true' && fieldHtml(e.text) !== e.shown;
      },
      step: (run) => this.step(focused()!, run),
    });
    for (const type of ['beforeinput', 'cut', 'paste', 'drop']) this.el.addEventListener(type, (ev) => {
      const t = this.entries.find((e) => e.text.contains(ev.target as Node));
      if (!t || !lockedLine(t)) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }, true);
    app.commands.veto((_, c) => /^(edit\.(cut|paste|pasteAndMatchStyle)|element\.delete)$/.test(c.id) && !!focused() && lockedLine(focused()!));
    // Duplicate of the menu copies the slide after the typed text of the line is written, as Mod+D
    app.commands.take((id) => (id === 'edit.duplicate' && focused() ? this.step(focused()!, () => app.commands.run('slide.duplicate')) : undefined));
    this.el.addEventListener('focusout', (ev) => {
      const t = ev.target instanceof HTMLElement ? this.entries.find((e) => e.text === ev.target) : null;
      if (t && !this.busy) void this.commit(t).then(() => {
        this.typesetLine(t);
        setTimeout(() => this.refresh(), 0);
      }).catch((e) => app.fail(e));
    });
    // a press in a typeset field puts the caret at the same place of its TeX, since the browser
    // would put it at the point in the TeX, which is longer
    this.el.addEventListener('mousedown', (ev) => {
      const t = this.entries.find((e) => e.text.contains(ev.target as Node));
      if (!t || ev.button !== 0 || t.text.contentEditable !== 'true' || !t.text.querySelector('mjx-container')) return;
      ev.preventDefault();
      const at = texOffset(t.text, ev.clientX, ev.clientY);
      t.text.focus({ preventScroll: true });
      selectIn(t.text, at);
    });
    this.el.addEventListener('focusin', (ev) => {
      const t = this.entries.find((e) => e.text === ev.target);
      if (!t) return;
      this.showTex(t);
      if (t.slide !== app.current()) app.showSlide(t.slide);
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

  // the outline is drawn again after a change, unless one of its fields is edited and its lines
  // are still those of the deck. after an undo they are not, and the caret is put back in the line
  // of the same block, or of a block with the same text, e.g. an item put back by an undo of
  // Promote to Slide
  refresh(): void {
    this.pane.classList.toggle('outlined', this.on);
    this.el.hidden = !this.on;
    const field = this.entries.find((e) => e.text === document.activeElement);
    if (!this.on || this.busy || (this.el.contains(document.activeElement) && !(field && this.stale()))) {
      this.mark();
      return;
    }
    if (!field) return this.build();
    const sel = window.getSelection();
    const at = sel?.rangeCount && field.text.contains(sel.anchorNode) ? offsetIn(field.text, sel.anchorNode!, sel.anchorOffset) : null;
    const text = field.text.textContent;
    this.done(() => (this.entries.find((x) => x.el === field.el) ?? this.entries.find((x) => x.text.textContent === text))?.text ?? null, at);
  }

  // the blocks of the outline are not those of the deck in their order
  private stale(): boolean {
    const els = [...this.app.slides().querySelectorAll(':scope > section')].flatMap((slide) => {
      const title = slide.querySelector('h1, h2');
      return [...(title ? [title] : []), ...this.blocks(columnOf(slide), title).map((b) => b.el)];
    });
    return els.length !== this.entries.length || els.some((el, i) => this.entries[i].el !== el);
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
    untypeset([...this.el.querySelectorAll('.text')]);
    this.el.replaceChildren(...groups);
    this.mark();
    void typeset(this.entries.filter((e) => e.text.dataset.tex !== undefined).map((e) => e.text));
  }

  // the TeX of a typeset field put back when the field is focused, with the caret where the click
  // put it in the TeX, or else at its end
  private showTex(e: Entry): void {
    if (e.text.contentEditable !== 'true' || !e.text.querySelector('mjx-container')) return;
    untypeset([e.text]);
    e.text.innerHTML = e.shown;
    queueMicrotask(() => {
      const sel = window.getSelection();
      if (document.activeElement === e.text && !(sel?.rangeCount && e.text.contains(sel.anchorNode))) selectIn(e.text, (e.text.textContent ?? '').length);
    });
  }

  // a field typeset again when it is left, with its TeX as committed
  private typesetLine(e: Entry): void {
    const tex = e.text.textContent ?? '';
    if (!e.text.isConnected || e.text === document.activeElement || !hasTex(tex)) return;
    e.text.dataset.tex = tex;
    void typeset([e.text]);
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
      if (el.closest('[data-locked]')) text.setAttribute('aria-readonly', 'true');
    } else {
      row.classList.add('dim');
      const name = OTHER.find(([s]) => el.matches(s))?.[1];
      // the own text of the block, with the TeX of its math, as it is typed
      const own = document.createElement('template');
      own.innerHTML = html;
      text.textContent = name ?? (own.content.textContent ?? '').replace(/\s+/g, ' ').trim();
      text.title = 'Edit this block on the slide';
    }
    // the text of the line as typed, read while its math is typeset
    const source = text.textContent ?? '';
    if (hasTex(source)) text.dataset.tex = source;
    row.append(text);
    this.entries.push({ slide, el, kind, text, shown: editable ? html : '' });
    return row;
  }

  // the text of a field written into its block, when it was changed
  private async commit(e: Entry): Promise<void> {
    if (e.text.contentEditable !== 'true' || !e.el.isConnected) return;
    const html = fieldHtml(e.text);
    if (html === e.shown) return;
    // a text that reached a locked line anyway, e.g. from an input method, is taken back
    if (lockedLine(e)) return void (e.text.innerHTML = e.shown);
    e.shown = html;
    await setOwnTex(this.app, e.el, html);
  }

  private onKey(ev: KeyboardEvent): void {
    const e = this.entries.find((x) => x.text === document.activeElement);
    if (!e || ev.isComposing) return;
    if (ev.metaKey || ev.ctrlKey || ev.altKey) {
      const id = this.app.commands.forKey(ev, this.app.region())?.id;
      if (id === 'edit.undo' || id === 'edit.redo') {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        void this.app.commands.run(id).catch((err) => this.app.fail(err));
        return;
      }
      // the copy of the slide is made after the typed text of the line is written. the write puts
      // the focus into the slide, hence the command of the navigator is run rather than Duplicate
      if (id === 'edit.duplicate') {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        void this.step(e, () => this.app.commands.run('slide.duplicate')).catch((err) => this.app.fail(err));
        return;
      }
      // a line does not take a format, hence the native bold, italic, and underline are not run.
      // Control-B of a Mac moves the caret back, and it is left to the line
      if (/^[biu]$/i.test(ev.key) && !ev.altKey && !(this.app.platform === 'mac' && ev.ctrlKey && !ev.metaKey)) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        return;
      }
      // the keys of a text, e.g. Select All and the clipboard, stay with the field
      if (/^[acvx]$/i.test(ev.key)) ev.stopImmediatePropagation();
      return;
    }
    ev.stopImmediatePropagation();
    if (lockedLine(e) && ['Enter', 'Tab', 'Backspace'].includes(ev.key)) ev.preventDefault();
    else if (ev.key === 'Escape') {
      ev.preventDefault();
      e.text.blur();
    } else if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      void this.act(e, 'return').catch((err) => this.app.fail(err));
    } else if (ev.key === 'Tab') {
      ev.preventDefault();
      void this.act(e, ev.shiftKey ? 'outdent' : 'indent').catch((err) => this.app.fail(err));
    } else if (ev.key === 'Backspace' && e.kind !== 'title' && this.atStart(e)) {
      ev.preventDefault();
      void this.act(e, 'join').catch((err) => this.app.fail(err));
    }
  }

  // the caret is collapsed at the start of the field of e
  private atStart(e: Entry): boolean {
    const sel = window.getSelection();
    return !!sel?.rangeCount && sel.isCollapsed && e.text.contains(sel.anchorNode) && offsetIn(e.text, sel.anchorNode!, sel.anchorOffset) === 0;
  }

  // Return, Tab, Shift+Tab, or Backspace at the start of a field: its text is written, the caret is
  // put at the same place of the block on the slide, and the command of the canvas is run there
  private async act(e: Entry, what: 'return' | 'indent' | 'outdent' | 'join'): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const sel = window.getSelection();
      const at = sel?.rangeCount && e.text.contains(sel.getRangeAt(0).startContainer) ? offsetIn(e.text, sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset) : null;
      const math = hasTex(e.text.textContent ?? '');
      await this.commit(e);
      const k = this.entries.indexOf(e);
      if (what === 'return' && e.kind === 'title') {
        this.app.showSlide(e.slide);
        await this.app.commands.run('slide.new');
        this.done(() => this.titleOf(this.app.current()));
        return;
      }
      // Shift+Tab on a first-level line and Tab on a title move the line across slides
      const moved = what === 'outdent' && e.kind !== 'title' ? await promote(this.app, e.el) : what === 'indent' && e.kind === 'title' ? await demote(this.app, e.el) : null;
      if (moved) {
        this.app.showSlide(moved.slide);
        this.done(() => this.entries.find((x) => x.el === moved.line)?.text ?? null);
        return;
      }
      const end = (e.el.textContent ?? '').length;
      selectIn(e.el, math || at === null ? end : at);
      // one entry of the history with the label of the command of the canvas
      const run = (id: string, fn: (app: App) => Promise<void>) => this.app.history.transact(this.app.commands.label(id), () => fn(this.app));
      // Backspace joins two paragraphs or items of one text, as in the outline of Keynote, and
      // does nothing at the start of a text or next to a locked block
      if (what === 'join') {
        selectIn(e.el, 0);
        const before = besideBlock(this.app, e.el, false);
        const prev = this.entries[k - 1];
        if (joinKind(this.app) !== 'join' || !before || before.closest('[data-locked]') || !prev) return this.done(() => this.entries[k]?.text ?? null, 0);
        const len = (prev.text.dataset.tex ?? prev.text.textContent ?? '').length;
        await run('text.joinBackward', joinBackward);
        this.done(() => this.entries[k - 1]?.text ?? null, len);
        return;
      }
      if (what === 'return' && canSplit(this.app)) await run('text.newParagraph', split);
      else if (what === 'indent' && canIndent(this.app)) await run('text.indent', indent);
      else if (what === 'outdent' && canOutdent(this.app)) await run('text.outdent', outdent);
      else {
        this.done(() => this.entries[k]?.text ?? null, at);
        return;
      }
      this.done(() => this.entries[what === 'return' ? k + 1 : k]?.text ?? null, what === 'return' ? 0 : at);
    } finally {
      this.busy = false;
    }
  }

  // Undo or Redo in a field, by its key, the menu, or the toolbar: a text typed since the field was
  // last written is written first, as an entry of its own, and the caret is put at the end of the first line changed by the step, or
  // else in the line of the same block, or in the line before it
  private async step(e: Entry, run: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.commit(e);
      const k = this.entries.indexOf(e);
      const before = new Map(this.entries.map((x) => [x.el, x.shown]));
      await run();
      await this.app.history.idle();
      this.done(() => {
        const changed = this.entries.find((x) => before.get(x.el) !== x.shown);
        return (changed ?? this.entries.find((x) => x.el === e.el) ?? this.entries[Math.max(0, k - 1)])?.text ?? null;
      });
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
