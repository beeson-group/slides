// the commands of the Insert menu and of the Insert group of the toolbar: a text box, a formula, a
// code box, a QR code, and a footnote. each element is put at its place in the layout of the
// current slide, i.e. after the last block of the text column, into an empty zone, or on the foot
// line, and it is selected, with the caret in it for a text. a text box, a code box, and a
// footnote are put on the page first as an element of the editor only, marked data-generated, which
// the save and the pairing pass over, with a prompt drawn by the stylesheet below. the empty box is
// an entry of the history, as an insert of Keynote, and the deck is marked edited while it is on the
// slide. the first input into it writes the element into the file in place of that entry, hence an
// empty one is never written, and it is taken off the page with its entry when the caret leaves it

import type { App } from '../app.ts';
import type { Entry } from '../history.ts';
import { mathLookup } from '../math.ts';
import { emptySlot, isEmptySlot } from '../media/actions.ts';
import { applyPending } from '../text/carry.ts';
import { insertPlain, placeCaret } from '../text/typing.ts';
import { injectStyle } from '../ui/dom.ts';
import { columnOf } from './clipboard.ts';
import { onCaptionBox } from './figure.ts';
import { docOf } from './slide.ts';
import { freePlace, placeNew, translateOf } from './place.ts';

const CSS = `
/* the caption of a zone keeps the absolute place of the theme under the picture */
html.beeson-editor .reveal .slides .beeson-pending:not(.foot):not(.zone > .caption) { position: relative; }
html.beeson-editor .reveal .slides .beeson-pending { min-height: 1.4em; min-width: 8em; }
/* a new text box is put at the gap of the theme between two paragraphs, not at the 14 px of a list item */
html.beeson-editor .reveal .slides p.beeson-pending:not(:first-child):not(.caption) { margin-top: 24px; }
html.beeson-editor .reveal .slides .foot.beeson-pending { min-width: 13em; }
html.beeson-editor .reveal .slides .beeson-pending[data-prompt][contenteditable]:empty::before { content: attr(data-prompt); position: absolute; left: 0; top: 0; color: var(--muted, #888); white-space: nowrap; pointer-events: none; }
html.beeson-editor .reveal .slides pre.beeson-pending { box-sizing: border-box; min-height: calc(1.25em + 48px); padding: 24px; font-size: 22px; line-height: 1.25; }
html.beeson-editor .reveal .slides pre.beeson-pending[data-prompt][contenteditable]:empty::before { left: 24px; top: 24px; font-family: system-ui, sans-serif; }
html.beeson-editor .reveal .slides div.math.beeson-empty { position: relative; min-height: 1.4em; }
html.beeson-editor .reveal .slides div.math.beeson-empty::before { content: "Click to add a formula"; position: absolute; left: 0; top: 0; color: var(--muted, #888); font-size: 48px; white-space: nowrap; pointer-events: none; }
`;

// a text element that the first input writes into the file. a caption is a figcaption in a figure
// and a caption paragraph in a zone
type Kind = 'text' | 'code' | 'foot' | 'caption';
const captionTag = (host: Element) => (host.localName === 'figure' ? 'figcaption' : 'p');
const PENDING: Record<Kind, { label: string; prompt: string; make(parent: Element): HTMLElement; html(text: string, parent: Element): string }> = {
  text: { label: 'Text Box', prompt: 'Click to add text', make: () => document.createElement('p'), html: (t) => `<p>${lines(t)}</p>` },
  code: { label: 'Code Box', prompt: 'Click to add code', make: () => document.createElement('pre'), html: (t) => `<pre><code class="language-python">${escape(t)}</code></pre>` },
  foot: {
    label: 'Footnote',
    prompt: 'Click to add a footnote',
    make: () => Object.assign(document.createElement('div'), { className: 'foot' }),
    html: (t) => `<div class="foot">${lines(t)}</div>`,
  },
  caption: {
    label: 'Caption',
    prompt: 'Click to add a caption',
    make: (host) => Object.assign(document.createElement(captionTag(host)), { className: 'caption' }),
    html: (t, host) => `<${captionTag(host)} class="caption">${lines(t)}</${captionTag(host)}>`,
  },
};

const escape = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// a line of a text box or a footnote is a br, as a line typed into a block
const lines = (t: string) => escape(t).replace(/\r?\n/g, '<br>');

// the blocks and figures of a text column, after the last of which a new element is put
const BLOCK = 'h1, h2, h3, h4, p, ul, ol, dl, table, pre, blockquote, div.math, .col, .qr';

// the parent and the node before which a new element of the text column of slide is put: after its
// last block, and else at the start of the column. the plate of a figure slide is in the flow and
// as large as the slide, hence a new element is put after it, where it does not push the plate down
export function columnPlace(app: App, slide: Element): { parent: Element; before: Node | null } {
  const parent = columnOf(slide);
  const blocks = [...parent.children].filter((el) => (el.matches(BLOCK) || el.matches('.plate')) && !el.matches('.caption, .foot') && !!app.pairing?.elements.has(el));
  const last = blocks.at(-1);
  if (last) {
    let n = last.nextSibling;
    while (n instanceof Element && n.hasAttribute('data-generated')) n = n.nextSibling;
    return { parent, before: n };
  }
  return { parent, before: [...parent.children].find((el) => !el.hasAttribute('data-generated')) ?? null };
}

// the bottom of the zones and of the text column, in slide px, under which a new figure does not fit
const FLOOR = 920;

// the box of el in slide px
export function slideBox(app: App, el: Element): { left: number; top: number; right: number; bottom: number } {
  const slides = app.slides() as HTMLElement;
  const s = slides.getBoundingClientRect();
  const k = slides.offsetWidth ? s.width / slides.offsetWidth : 1;
  const r = el.getBoundingClientRect();
  return { left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k };
}

export type Box = { left: number; top: number; right: number; bottom: number };
export const meets = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// the box of the text of a block, which may be narrower than the block, or null when it is empty
export function inkBox(app: App, el: Element): Box | null {
  const range = document.createRange();
  range.selectNodeContents(el);
  const r = range.getBoundingClientRect();
  if (!r.width) return el.textContent?.trim() ? slideBox(app, el) : null;
  const slides = app.slides() as HTMLElement;
  const s = slides.getBoundingClientRect();
  const k = slides.offsetWidth ? s.width / slides.offsetWidth : 1;
  return { left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k };
}

// the blocks of a text column, whose box is the box of their text
const TEXT = 'h1, h2, h3, h4, p, ul, ol, dl, table, pre, blockquote, div.math';

// the box of the prompt of an empty block that shows its placeholder, i.e. of the text of its
// ::before as it is drawn, or null for a block without a prompt
function promptBox(app: App, el: Element): Box | null {
  const before = getComputedStyle(el, '::before');
  if (['none', 'normal'].includes(before.content)) return null;
  const box = slideBox(app, el);
  let text: string;
  try {
    text = JSON.parse(before.content);
  } catch {
    return box;
  }
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return box;
  ctx.font = before.font;
  const left = box.left + (parseFloat(getComputedStyle(el).paddingLeft) || 0);
  return { left, top: box.top, right: Math.min(box.right, left + ctx.measureText(text).width), bottom: box.bottom };
}

// the space that el takes on its slide in slide px, the one rule of every insert: the box of the
// text of a block that is not moved, the box of the prompt of an empty block that shows its
// placeholder, e.g. Text on a new slide, and else the box of the element with its translate
export function takenBox(app: App, el: Element): Box | null {
  if (!el.getClientRects().length) return null;
  const moved = el instanceof HTMLElement && !!el.style.translate;
  if (!el.matches(TEXT) || moved) return slideBox(app, el);
  return inkBox(app, el) ?? promptBox(app, el);
}

// the box where the layout of slide puts a zone, when nothing of the slide but el is drawn there. it
// is measured on a hidden zone of the theme, taken off at once
export function freeZone(app: App, slide: Element, el: Element): Box | null {
  if (slide.matches('.title, .closing, .figure, .section')) return null;
  const probe = document.createElement('div');
  probe.className = 'zone';
  probe.setAttribute('data-generated', '');
  probe.style.visibility = 'hidden';
  slide.append(probe);
  const zone = slideBox(app, probe);
  probe.remove();
  if (zone.right - zone.left < 1 || zone.bottom - zone.top < 1) return null;
  const columns = '.col, .panel, .block';
  for (const other of slide.querySelectorAll(':scope > *, :scope > .col > *, :scope > .panel > *')) {
    if (other === el || other.contains(el) || other.matches('aside.notes, .foot, .run, [data-generated]')) continue;
    const box = other.matches(columns) && !(other instanceof HTMLElement && other.style.translate) ? inkBox(app, other) : takenBox(app, other);
    if (box && meets(zone, box)) return null;
  }
  return zone;
}

// a new figure that does not fit under the last block of the text column, i.e. over floor, is moved
// to the center of the free area where the layout puts a zone, and else to the center of the slide,
// where Keynote puts a new object, with a translate in slide px
function centerIfOut(app: App, el: Element, floor = FLOOR): void {
  const b = slideBox(app, el);
  const slide = el.closest('section') as HTMLElement | null;
  const w = slide?.offsetWidth || 1920;
  const h = slide?.offsetHeight || 1080;
  // a formula and a QR code are drawn narrower where they do not fit
  const narrow = el instanceof HTMLElement && el.matches('.math, .qr') ? el : undefined;
  if (b.bottom <= Math.min(floor, h) && b.top >= 0 && b.right <= w) return placeNew(app, el, narrow);
  const zone = slide ? freeZone(app, slide, el) : null;
  const fits = zone && b.right - b.left <= zone.right - zone.left && b.bottom - b.top <= zone.bottom - zone.top;
  const [cx, cy] = fits ? [(zone.left + zone.right) / 2, (zone.top + zone.bottom) / 2] : [w / 2, h / 2];
  const x = Math.round(cx - (b.left + b.right) / 2);
  const y = Math.round(cy - (b.top + b.bottom) / 2);
  docOf(app).setTag(el, { translate: { x, y } }, 'move');
  placeNew(app, el, narrow);
}

// the offset in slide px of a new text box el in the text column, under the blocks before it as
// they are drawn: moved down as far as the lowest of them is drawn under its place in the layout,
// e.g. a list moved down with a translate
function textOffset(app: App, el: HTMLElement): number {
  const parent = el.parentElement;
  if (!parent) return 0;
  const before = [...parent.children].slice(0, [...parent.children].indexOf(el)).filter((o) => !o.matches('.run, .foot, aside.notes, [data-generated]') && o.getClientRects().length);
  if (!before.length) return 0;
  const drawn = before.map((o) => slideBox(app, o).bottom);
  const placed = before.map((o, i) => drawn[i] - (parseFloat(getComputedStyle(o).translate.split(' ')[1] ?? '') || 0));
  return Math.max(0, Math.round(Math.max(...drawn) - Math.max(...placed)));
}

// the bottom margin of a slide in slide px, where the theme ends the foot line
const MARGIN = 50;

// the offset in slide px of a new text box el that does not fit under the blocks of the text
// column, i.e. that would meet a footnote or reach under the bottom margin of the slide, or null
// when it fits. the box is then put at the center of the visible part of the slide, where Keynote
// puts a new object when it finds no free space, moved up off a footnote under it and into the
// slide
function centerOffset(app: App, el: HTMLElement): { x: number; y: number } | null {
  const slide = el.closest('section') as HTMLElement | null;
  if (!slide) return null;
  const w = slide.offsetWidth || 1920, h = slide.offsetHeight || 1080;
  const b = slideBox(app, el);
  // the footnotes and the prompts of the empty placeholders, which the box is kept off
  const prompts = [...slide.querySelectorAll(':scope > *, :scope > .col > *, :scope > .panel > *')].filter((o) => o !== el && !o.matches('.foot') && !o.textContent?.trim()).map((o) => (o.getClientRects().length ? promptBox(app, o) : null)).filter((p): p is Box => !!p);
  const feet = [...[...slide.querySelectorAll('.foot')].filter((f) => f !== el && f.getClientRects().length).map((f) => slideBox(app, f)), ...prompts];
  if (b.top >= 0 && b.right <= w && b.bottom <= h - MARGIN && !feet.some((f) => meets(b, f))) return null;
  // the visible part of the slide in the canvas, in slide px
  const v = app.stage?.viewport ?? new DOMRect(0, 0, innerWidth, innerHeight);
  const slides = app.slides() as HTMLElement;
  const s = slides.getBoundingClientRect();
  const k = slides.offsetWidth ? s.width / slides.offsetWidth : 1;
  const left = Math.max(0, (v.left - s.left) / k), right = Math.min(w, (v.right - s.left) / k);
  const top = Math.max(0, (v.top - s.top) / k), bottom = Math.min(h, (v.bottom - s.top) / k);
  const bw = b.right - b.left, bh = b.bottom - b.top;
  const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), Math.max(lo, hi));
  const cx = clamp(right > left ? (left + right) / 2 : w / 2, bw / 2, w - bw / 2);
  let cy = clamp(bottom > top ? (top + bottom) / 2 : h / 2, bh / 2, h - bh / 2);
  const at = { left: cx - bw / 2, right: cx + bw / 2, top: cy - bh / 2, bottom: cy + bh / 2 };
  const under = feet.filter((f) => meets(at, f));
  if (under.length) cy = Math.max(bh / 2, Math.min(...under.map((f) => f.top)) - 24 - bh / 2);
  return { x: Math.round(cx - (b.left + b.right) / 2), y: Math.round(cy - (b.top + b.bottom) / 2) };
}

export function install(app: App): void {
  injectStyle('insert', CSS);
  const c = app.commands;
  const fail = (e: unknown) => app.fail(e);
  const ready = (a: App) => !!a.pairing?.root && !!a.current() && a.region() !== 'dialog';

  // the element of the editor that waits for its first input, and whether it is being written
  let pending: { el: HTMLElement; kind: Kind; parent: Element } | null = null;
  let writing = false;
  // the kind and the element written in place of the box while it is written, and the input taken
  // meanwhile, in order: a text, or the inputType of a deletion
  let written: { kind: Kind; node: Element | null } | null = null;
  let typed: string[] = [];
  // the entry of the empty box is the last one of the history, a change of the history is made by
  // that entry, and an undo of it keeps the box, which the first input then writes
  let onTop = false;
  let own = false;
  let keep = false;

  const take = () => {
    if (!pending) return;
    pending.el.remove();
    pending = null;
    app.invalidate('content');
  };

  // the box is taken off, and its entry with it while that entry is the last one, so that the
  // history does not offer a Redo of an empty box
  const drop = () => {
    if (!pending || writing) return;
    const last = onTop;
    onTop = false;
    take();
    if (last) app.history.discard();
  };

  const begin = (kind: Kind, parent: Element, before: Node | null) => {
    drop();
    const def = PENDING[kind];
    const el = def.make(parent);
    el.classList.add('beeson-pending');
    el.setAttribute('data-generated', '');
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('data-prompt', def.prompt);
    el.setAttribute('aria-label', def.label);
    const next = before && before.parentNode === parent ? before : null;
    const show = () => {
      parent.insertBefore(el, next && next.parentNode === parent ? next : null);
      if (kind === 'text' || kind === 'code') {
        el.style.translate = '';
        const y = textOffset(app, el);
        el.style.translate = y ? `0px ${y}px` : '';
        const c = centerOffset(app, el);
        if (c) el.style.translate = `${c.x}px ${y + c.y}px`;
        // a text box is drawn narrower where its width does not fit, and a code box is not, since
        // the theme does not set the width of a pre
        el.style.width = '';
        const f = freePlace(app, el, kind === 'code' ? undefined : el);
        const t = translateOf(el);
        if (f) el.style.translate = `${t.x + f.x}px ${t.y + f.y}px`;
        if (f?.width) el.style.width = `${f.width}px`;
      }
      pending = { el, kind, parent };
      placeCaret(el);
      app.invalidate('content');
    };
    el.addEventListener('focusout', () => setTimeout(() => {
      if (pending?.el === el && document.activeElement !== el) drop();
    }, 0));
    show();
    own = true;
    app.history.push({
      label: `Insert ${def.label}`,
      undo: () => {
        own = true;
        onTop = false;
        if (!keep && pending?.el === el) take();
      },
      redo: () => {
        own = true;
        show();
        onTop = true;
      },
    });
    onTop = true;
  };

  // the input taken while the box is written is typed after it, in order, as typing of the block.
  // a new line in a text box is a new paragraph, as Enter in a paragraph, and a line break else.
  // the input that comes meanwhile is taken too, at the block of the caret
  const caretHost = () => {
    const n = window.getSelection()?.anchorNode;
    return app.hostOf(n instanceof Element ? n : n?.parentElement ?? null);
  };
  const replay = async (kind: Kind) => {
    for (let op = typed.shift(); op !== undefined; op = typed.shift()) {
      const host = caretHost();
      if (!host) break;
      if (op === 'deleteContentBackward') document.execCommand('delete');
      else if (op === 'deleteContentForward') document.execCommand('forwardDelete');
      else if (op === '\n' && kind === 'text' && app.commands.enabled('text.newParagraph')) await app.commands.run('text.newParagraph');
      else insertPlain(host, op);
      if (written) written.node = caretHost();
    }
    typed = [];
  };

  // the first text typed into the element of the editor writes it into the file in its place. every
  // input into the box or into the element written for it is taken until the write ends, since the
  // element is not yet a block of the pairing that the typing of text/typing.ts records
  const write = async (text: string) => {
    const p = pending;
    if (!p) return;
    writing = true;
    written = { kind: p.kind, node: null };
    typed = [];
    const def = PENDING[p.kind];
    try {
      // the entry of the empty box is undone with the box kept, so that the written box is one entry
      if (onTop) {
        keep = true;
        await app.history.undo().finally(() => (keep = false));
      }
      // the box is selected at a redo
      let made: Element[] = [];
      await app.history.selecting(`Insert ${def.label}`, async () => {
        // a box moved by textOffset or centerOffset is written with the same offset
        const [x0, y0] = p.el.style.translate.split(' ');
        const x = parseFloat(x0 ?? '') || 0, y = parseFloat(y0 ?? '') || 0;
        const [node] = await docOf(app).insert(def.html(text, p.parent), p.parent, p.el, def.label);
        written!.node = node;
        made = [node];
        p.el.remove();
        if (x || y) docOf(app).setTag(node, { translate: { x, y } }, def.label);
        if (p.el.style.width) docOf(app).setTag(node, { style: { width: p.el.style.width } }, def.label);
        pending = null;
        // the caret of a code box is in its code element, where the typing after the first key goes
        placeCaret(node, p.kind === 'code' ? (node.textContent ?? '').length : null);
        await applyPending(app, p.el, node);
      }, () => made);
      await replay(p.kind);
    } finally {
      writing = false;
      written = null;
      typed = [];
    }
  };

  // whether an input goes to the box, or to the element written in its place while it is written
  const intoBox = (target: EventTarget | null): boolean => {
    if (pending && target === pending.el) return true;
    const node = written?.node;
    return !!node && target instanceof Node && (node.contains(target) || target.contains(node));
  };

  // the input into the element of the editor is taken before the typing of text/typing.ts, which
  // records the blocks of the file
  window.addEventListener('beforeinput', (ev) => {
    if (!intoBox(ev.target)) return;
    ev.stopImmediatePropagation();
    const type = ev.inputType;
    if (type === 'insertCompositionText') return;
    ev.preventDefault();
    const kind = written?.kind ?? pending!.kind;
    let text = '';
    if (type === 'insertText' || type === 'insertReplacementText') text = ev.data ?? ev.dataTransfer?.getData('text/plain') ?? '';
    else if (type === 'insertFromPaste') text = ev.dataTransfer?.getData('text/plain') ?? '';
    // a new line typed after the first key is a line of the box, and an empty text box or
    // footnote is not written for a new line alone
    else if (type === 'insertParagraph' || type === 'insertLineBreak') text = kind === 'code' || writing ? '\n' : '';
    else if (writing && (type === 'deleteContentBackward' || type === 'deleteContentForward')) typed.push(type);
    if (!text) return;
    if (writing) typed.push(text);
    else void write(text).catch(fail);
  }, true);
  window.addEventListener('input', (ev) => {
    if (pending && ev.target === pending.el) ev.stopImmediatePropagation();
  }, true);
  // a text composed with an input method is written at its end
  window.addEventListener('compositionend', (ev) => {
    if (pending && ev.target === pending.el && !writing) {
      const text = pending.el.textContent ?? '';
      pending.el.textContent = '';
      if (text) void write(text).catch(fail);
    }
  }, true);
  app.listen('slide', drop);
  // the deck is marked edited after the check of files.ts, which marks it clean when its text reads
  // as saved, at each change of the history
  app.listen('history', () => {
    if (own) {
      own = false;
      if (pending) app.markDirty();
      return;
    }
    onTop = false;
    if (!writing) drop();
  });

  // the prompt of a formula whose TeX is empty, as a class of the page only
  const markEmpty = () => {
    const lookup = mathLookup();
    for (const el of app.slides().querySelectorAll('div.math')) {
      const tex = [...el.querySelectorAll('mjx-container')].map((m) => lookup(m)?.tex ?? '').join('');
      el.classList.toggle('beeson-empty', !!el.querySelector('mjx-container') && !tex.trim());
    }
  };
  app.onRefresh(['content', 'structure'], markEmpty);

  // the TeX field of a new formula, whose TeX is written into entry, the insert. a formula left
  // with an empty TeX at the close of the field is taken off again without an entry to redo, as a
  // Cancel of the Insert Equation window of Keynote
  const openTex = (node: Element, math: Element, entry: Entry | null) => {
    app.math.open(math, entry ?? undefined);
    const wait = window.setInterval(() => {
      if (app.math.isOpen()) return;
      window.clearInterval(wait);
      markEmpty();
      if (entry && node.isConnected && node.classList.contains('beeson-empty')) void app.history.retract(entry).catch(fail);
    }, 100);
  };

  onCaptionBox({ begin: (host) => begin('caption', host, null), drop });

  const pendingText = (kind: Kind) => (a: App) => {
    const slide = a.current()!;
    const { parent, before } = columnPlace(a, slide);
    begin(kind, parent, before);
  };

  const insertMenu = (order: number) => ({ bar: 'Insert', group: 'element', order });
  // the inserts of the toolbar in the order of Keynote: Table, Text, Formula, Shape, and Media, the
  // last two as split buttons of their variants
  const tool = (order: number, icon: string, more: { label?: string; split?: string } = {}) => ({ group: 'insert', order, icon, ...more });
  c.define({
    id: 'insert.text',
    label: 'Text Box',
    menu: insertMenu(20),
    toolbar: tool(21, 'text', { label: 'Text' }),
    enabled: ready,
    run: pendingText('text'),
  });
  c.define({
    id: 'insert.formula',
    label: 'Formula',
    keys: { mac: ['Mod+Alt+E'], other: ['Alt+='] },
    in: ['canvas', 'navigator', 'text'],
    menu: insertMenu(21),
    toolbar: tool(22, 'formula'),
    enabled: ready,
    run: async (a) => {
      // in a text, the button puts an inline formula at the caret, as Insert Equation of Keynote
      // and PowerPoint does, through math.inline of commands/math.ts. the sheet is opened after
      // the click, since the click on the toolbar would close it on its way to the document, and
      // the keys typed until then are held for its TeX field, and not typed into the text
      const release = a.math.hold();
      if (a.selection.kind === 'text' && a.commands.enabled('math.inline')) {
        setTimeout(() => void a.commands.run('math.inline').finally(release), 0);
        return;
      }
      // the keys typed while the formula is written are typed into its TeX field
      let made: { node: Element; math: Element } | null = null;
      try {
        await a.history.selecting('Insert Formula', async () => {
          const { parent, before } = columnPlace(a, a.current()!);
          const [node] = await docOf(a).insertElement('formula', parent, before, { tex: '' });
          // a formula grows with its TeX, hence it is moved only when it is under the slide, e.g.
          // after the caption of a figure slide
          centerIfOut(a, node, Infinity);
          a.selection.set('elements', [node]);
          markEmpty();
          const math = node.querySelector('mjx-container');
          if (math) made = { node, math };
        });
      } finally {
        if (!made) release();
      }
      if (!made) return;
      const { node, math } = made as { node: Element; math: Element };
      // the entry is read once the transaction is in the history, for its TeX
      const entry = a.history.undoLabel === 'Insert Formula' ? a.history.last : null;
      setTimeout(() => (openTex(node, math, entry), release()), 0);
    },
  });
  c.define({
    id: 'insert.qr',
    label: 'QR Code',
    menu: insertMenu(26),
    toolbar: tool(24.2, 'qr', { split: 'Media' }),
    enabled: ready,
    // a QR code fills the empty slot given, as by the icon of its placeholder, else the first one
    run: (a, arg) => a.history.selecting('Insert QR Code', async () => {
      const slide = a.current()!;
      const zone = arg instanceof Element && slide.contains(arg) && isEmptySlot(a, arg) ? arg : emptySlot(a, slide);
      const place = zone ? { parent: zone, before: null } : slide.matches('.title, .closing') ? { parent: slide, before: slide.querySelector(':scope > aside.notes') } : columnPlace(a, slide);
      const [node] = await docOf(a).insertElement('qr', place.parent, place.before, { qr: 'https://example.com' });
      if (!zone) centerIfOut(a, node);
      a.selection.set('elements', [node]);
    }),
  });
  c.define({
    id: 'insert.code',
    label: 'Code Box',
    menu: insertMenu(27),
    enabled: ready,
    run: pendingText('code'),
  });
  c.define({
    id: 'insert.footnote',
    label: 'Footnote',
    menu: insertMenu(28),
    enabled: ready,
    run: (a) => {
      const slide = a.current()!;
      // a slide has one footnote, which gets the caret
      const foot = slide.querySelector('.foot:not([data-generated])');
      if (foot && foot.matches('[contenteditable="true"]')) return placeCaret(foot);
      const parent = slide.matches('.split') ? (slide.querySelector(':scope > .panel') ?? slide) : slide;
      begin('foot', parent, parent.querySelector(':scope > aside.notes'));
    },
  });
}
