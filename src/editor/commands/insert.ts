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
import { FLOW_KIDS, freePlace, placeNew, titlePlace, translateOf } from './place.ts';
import { checkOverlaps } from '../overflow.ts';
import { overShapes } from './order.ts';
import { deckKinds } from './text.ts';
import { liveSubmenu } from '../ui/menu.ts';

const CSS = `
html.beeson-editor .reveal .slides .beeson-pending:not(.foot):not(.figure-box > .caption) { position: relative; }
html.beeson-editor .reveal .slides .beeson-pending { min-height: 1.4em; min-width: 8em; }
html.beeson-editor .reveal .slides p.beeson-pending:not(:first-child):not(.caption) { margin-top: 24px; }
html.beeson-editor .reveal .slides section:is(.title, .closing) .title-text > p.beeson-pending { margin-top: 0; }
html.beeson-editor .reveal .slides .foot.beeson-pending { min-width: 13em; }
html.beeson-editor .reveal .slides .beeson-pending[data-prompt][contenteditable]:empty::before { content: attr(data-prompt); position: absolute; left: 0; top: 0; color: var(--muted, #888); white-space: nowrap; pointer-events: none; }
html.beeson-editor .reveal .slides pre.beeson-pending { box-sizing: border-box; min-height: calc(1.25em + 48px); padding: 24px; font-size: 22px; line-height: 1.25; }
html.beeson-editor .reveal .slides pre.beeson-pending[data-prompt][contenteditable]:empty::before { left: 24px; top: 24px; font-family: system-ui, sans-serif; }
html.beeson-editor .reveal .slides div.math.beeson-empty { position: relative; min-height: 1.4em; }
html.beeson-editor .reveal .slides div.math.beeson-empty::before { content: "Click to add a formula"; position: absolute; left: 0; top: 0; color: var(--muted, #888); font-size: 48px; white-space: nowrap; pointer-events: none; }
`;

type Kind = 'text' | 'theorem' | 'code' | 'foot' | 'caption';
const captionTag = (host: Element) => (host.localName === 'figure' ? 'figcaption' : 'p');
const PENDING: Record<Kind, { label: string; prompt: string; make(parent: Element): HTMLElement; html(text: string, parent: Element, el: HTMLElement): string }> = {
  text: { label: 'Text Box', prompt: 'Click to add text', make: () => document.createElement('p'), html: (t) => `<p>${lines(t)}</p>` },
  theorem: {
    label: 'Theorem',
    prompt: '',
    make: () => Object.assign(document.createElement('p'), { className: 'theorem' }),
    html: (t, _, el) => `<p class="theorem" data-kind="${escape(el.dataset.kind ?? 'theorem').replace(/"/g, '&quot;')}">${lines(t)}</p>`,
  },
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
const lines = (t: string) => escape(t).replace(/\r?\n/g, '<br>');

const COLUMN_PARTS = 'h1, h2, h3, h4, p, ul, ol, dl, table, pre, blockquote, div.math, .col, .qr';

export function columnPlace(app: App, slide: Element): { parent: Element; before: Node | null } {
  const parent = columnOf(slide);
  const parts = [...parent.children].filter((el) => (el.matches(COLUMN_PARTS) || el.matches('.plate')) && !el.matches('.caption, .foot') && !!app.pairing?.elements.has(el));
  const last = parts.at(-1);
  if (last) {
    let n = last.nextSibling;
    while (n instanceof Element && n.hasAttribute('data-generated')) n = n.nextSibling;
    return { parent, before: n };
  }
  return { parent, before: [...parent.children].find((el) => !el.hasAttribute('data-generated')) ?? null };
}

const FLOOR = 920;

export function slideBox(app: App, el: Element): { left: number; top: number; right: number; bottom: number } {
  const slides = app.slides() as HTMLElement;
  const s = slides.getBoundingClientRect();
  const k = slides.offsetWidth ? s.width / slides.offsetWidth : 1;
  const r = el.getBoundingClientRect();
  return { left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k };
}

export type Box = { left: number; top: number; right: number; bottom: number };
export const meets = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

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

const TEXT = 'h1, h2, h3, h4, p, ul, ol, dl, table, pre, blockquote, div.math';

export function promptBox(app: App, el: Element): Box | null {
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

export function takenBox(app: App, el: Element): Box | null {
  if (!el.getClientRects().length) return null;
  const moved = el instanceof HTMLElement && !!el.style.translate;
  if (!el.matches(TEXT) || moved) return slideBox(app, el);
  return inkBox(app, el) ?? promptBox(app, el);
}

export function freeFigureBox(app: App, slide: Element, el: Element): Box | null {
  if (slide.matches('.title, .closing, .figure, .section')) return null;
  const probe = document.createElement('div');
  probe.className = 'figure-box';
  probe.setAttribute('data-generated', '');
  probe.style.visibility = 'hidden';
  slide.append(probe);
  const figureBox = slideBox(app, probe);
  probe.remove();
  if (figureBox.right - figureBox.left < 1 || figureBox.bottom - figureBox.top < 1) return null;
  const columns = '.col, .text-column, .title-text';
  for (const other of slide.querySelectorAll(FLOW_KIDS)) {
    if (other === el || other.contains(el) || other.matches('aside.notes, .foot, .run, [data-generated]')) continue;
    const box = other.matches(columns) && !(other instanceof HTMLElement && other.style.translate) ? inkBox(app, other) : takenBox(app, other);
    if (box && meets(figureBox, box)) return null;
  }
  return figureBox;
}

function centerIfOut(app: App, el: Element, floor = FLOOR): void {
  const b = slideBox(app, el);
  const slide = el.closest('section') as HTMLElement | null;
  const w = slide?.offsetWidth || 1920;
  const h = slide?.offsetHeight || 1080;
  const narrow = el instanceof HTMLElement && el.matches('.math, .qr') ? el : undefined;
  if (b.bottom <= Math.min(floor, h) && b.top >= 0 && b.right <= w) return placeNew(app, el, narrow);
  const figureBox = slide ? freeFigureBox(app, slide, el) : null;
  const fits = figureBox && b.right - b.left <= figureBox.right - figureBox.left && b.bottom - b.top <= figureBox.bottom - figureBox.top;
  const [cx, cy] = fits ? [(figureBox.left + figureBox.right) / 2, (figureBox.top + figureBox.bottom) / 2] : [w / 2, h / 2];
  const x = Math.round(cx - (b.left + b.right) / 2);
  const y = Math.round(cy - (b.top + b.bottom) / 2);
  docOf(app).setTag(el, { translate: { x, y } }, 'move');
  placeNew(app, el, narrow);
}

async function putPicture(a: App, slot: Element | null, insert: (parent: Element, before: Node | null) => Promise<Element[]>): Promise<Element> {
  const slide = a.current()!;
  const figureBox = slot ?? emptySlot(a, slide);
  const place = figureBox ? { parent: figureBox, before: null } : slide.matches('.title, .closing') ? { parent: slide, before: slide.querySelector(':scope > aside.notes') } : columnPlace(a, slide);
  const [node] = await insert(place.parent, place.before);
  if (!figureBox) centerIfOut(a, node);
  checkOverlaps(a, slide, node);
  a.selection.set('elements', [node]);
  return node;
}

export async function placeFigure(a: App, name: string): Promise<Element | null> {
  let made: Element | null = null;
  await a.history.selecting('Insert TikZ Figure', async () => {
    made = await putPicture(a, null, (p, b) => docOf(a).insert(`<div class="tikz" data-figure="${name}" style="width: 800px; height: 600px"></div>`, p, b, 'Insert TikZ Figure'));
  });
  return made;
}

function textOffset(app: App, el: HTMLElement): number {
  const parent = el.parentElement;
  if (!parent) return 0;
  const before = [...parent.children].slice(0, [...parent.children].indexOf(el)).filter((o) => !o.matches('.run, .foot, aside.notes, [data-generated]') && o.getClientRects().length);
  if (!before.length) return 0;
  const drawn = before.map((o) => slideBox(app, o).bottom);
  const placed = before.map((o, i) => drawn[i] - (parseFloat(getComputedStyle(o).translate.split(' ')[1] ?? '') || 0));
  return Math.max(0, Math.round(Math.max(...drawn) - Math.max(...placed)));
}

const TYPED = ['insertText', 'insertReplacementText', 'deleteContentBackward', 'deleteContentForward', 'deleteWordBackward', 'deleteWordForward'];

const MARGIN = 50;

function centerOffset(app: App, el: HTMLElement): { x: number; y: number } | null {
  const slide = el.closest('section') as HTMLElement | null;
  if (!slide) return null;
  const w = slide.offsetWidth || 1920, h = slide.offsetHeight || 1080;
  const b = slideBox(app, el);
  const prompts = [...slide.querySelectorAll(FLOW_KIDS)].filter((o) => o !== el && !o.matches('.foot') && !o.textContent?.trim()).map((o) => (o.getClientRects().length ? promptBox(app, o) : null)).filter((p): p is Box => !!p);
  const feet = [...[...slide.querySelectorAll('.foot')].filter((f) => f !== el && f.getClientRects().length).map((f) => slideBox(app, f)), ...prompts];
  if (b.top >= 0 && b.right <= w && b.bottom <= h - MARGIN && !feet.some((f) => meets(b, f))) return null;
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

  let pending: { el: HTMLElement; kind: Kind; parent: Element; show(): void; entry: Entry } | null = null;
  let writing = false;
  let written: { kind: Kind; node: Element | null } | null = null;
  let typed: string[] = [];
  let onTop = false;
  let own = false;
  let keep = false;
  let leaving = false;

  const renumber = (kind: Kind) => {
    if (kind === 'theorem') (window as { Beeson?: { refreshChrome?(): void } }).Beeson?.refreshChrome?.();
  };
  const take = () => {
    if (!pending) return;
    pending.el.remove();
    renumber(pending.kind);
    pending = null;
    app.invalidate('content');
  };

  const drop = () => {
    if (!pending || writing) return;
    const last = onTop && app.history.last === pending.entry;
    onTop = false;
    take();
    if (last) app.history.discard();
  };

  const begin = (kind: Kind, parent: Element, before: Node | null, attrs: Record<string, string> = {}) => {
    drop();
    const def = PENDING[kind];
    const el = def.make(parent);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    el.classList.add('beeson-pending');
    el.setAttribute('data-generated', '');
    el.setAttribute('contenteditable', 'true');
    if (def.prompt) el.setAttribute('data-prompt', def.prompt);
    el.setAttribute('aria-label', def.label);
    const next = before && before.parentNode === parent ? before : null;
    const entry: Entry = {
      label: `Insert ${def.label}`,
      undo: () => {
        own = true;
        onTop = false;
        if (!keep && pending?.el === el) take();
      },
      redo: () => {
        own = true;
        app.showSlide(parent);
        show();
        onTop = true;
      },
    };
    const show = () => {
      parent.insertBefore(el, next && next.parentNode === parent ? next : null);
      if (kind === 'text' && parent.matches('section:is(.title, .closing)')) {
        el.style.translate = '';
        el.style.width = '';
        const f = titlePlace(app, el);
        el.style.translate = `${f.x}px ${f.y}px`;
        if (f.width) el.style.width = `${f.width}px`;
      } else if (kind === 'text' || kind === 'theorem' || kind === 'code') {
        el.style.translate = '';
        const y = textOffset(app, el);
        el.style.translate = y ? `0px ${y}px` : '';
        const c = centerOffset(app, el);
        if (c) el.style.translate = `${c.x}px ${y + c.y}px`;
        el.style.width = '';
        const f = freePlace(app, el, kind === 'code' ? undefined : el);
        const t = translateOf(el);
        if (f) el.style.translate = `${t.x + f.x}px ${t.y + f.y}px`;
        if (f?.width) el.style.width = `${f.width}px`;
      }
      pending = { el, kind, parent, show, entry };
      renumber(kind);
      placeCaret(el);
      app.invalidate('content');
    };
    el.addEventListener('focusout', () => setTimeout(() => {
      if (pending?.el !== el || document.activeElement === el || leaving || app.math.isOpen()) return;
      if (kind === 'text') void write('', 'typing', true).catch(fail);
      else drop();
    }, 0));
    show();
    own = true;
    app.history.push(entry);
    onTop = true;
  };

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

  const write = async (text: string, label = 'typing', empty = false) => {
    const p = pending;
    if (!p || writing) return;
    writing = true;
    written = { kind: p.kind, node: null };
    typed = [];
    const def = PENDING[p.kind];
    const apart = p.kind !== 'caption' && !empty;
    try {
      if (onTop && !apart) {
        keep = true;
        await app.history.undo().finally(() => (keep = false));
      }
      let made: Element[] = [];
      const body = async () => {
        if (apart) {
          app.history.push({
            label,
            undo: () => {
              own = true;
              onTop = true;
              p.el.textContent = '';
              p.show();
            },
            redo: () => {
              p.el.remove();
              pending = null;
            },
            selects: 'undo',
          });
        }
        const [x0, y0] = p.el.style.translate.split(' ');
        let x = parseFloat(x0 ?? '') || 0, y = parseFloat(y0 ?? '') || 0;
        const was = slideBox(app, p.el);
        let prev = p.el.previousElementSibling;
        while (prev && (prev.hasAttribute('data-generated') || !prev.getClientRects().length)) prev = prev.previousElementSibling;
        const prevWas = prev && slideBox(app, prev);
        const [node] = await docOf(app).insert(def.html(text, p.parent, p.el), p.parent, p.el, def.label);
        written!.node = node;
        made = [node];
        p.el.remove();
        renumber(p.kind);
        const end = node.lastChild;
        if (end instanceof Text && end.data.endsWith(' ')) end.data = `${end.data.slice(0, -1)} `;
        if (p.kind === 'text' || p.kind === 'theorem') {
          const now = slideBox(app, node);
          const prevNow = prev && slideBox(app, prev);
          x = Math.round(was.left - now.left - (prevWas && prevNow ? prevWas.left - prevNow.left : 0));
          y = Math.round(was.top - now.top - (prevWas && prevNow ? prevWas.top - prevNow.top : 0));
        }
        if (x || y) docOf(app).setTag(node, { translate: { x, y } }, def.label);
        if (p.el.style.width) docOf(app).setTag(node, { style: { width: p.el.style.width } }, def.label);
        pending = null;
        const caret = () => placeCaret(node, p.kind === 'code' ? (node.textContent ?? '').length : null);
        if (!empty) caret();
        await applyPending(app, p.el, node);
        await overShapes(app, node);
        checkOverlaps(app, app.current(), node);
        if (apart) {
          await replay(p.kind);
          app.history.push({ label, undo: () => {}, redo: caret, selects: 'redo' });
        }
      };
      if (apart) await app.history.transact(label, body);
      else await app.history.selecting(`Insert ${def.label}`, body, () => made);
      if (apart && made[0]) watch(made[0], p.kind, p.entry, app.history.last);
      if (!apart) await replay(p.kind);
    } finally {
      writing = false;
      written = null;
      typed = [];
    }
  };

  let recent: { node: Element; kind: Kind; box: Entry; first: Entry | null; alone: boolean; at: number } | null = null;
  const typingOf = (e: Entry | null, node: Element) => !!e && e.els?.length === 1 && e.els[0] === node && ['typing', 'Cut', 'Paste'].includes(e.label);
  const leave = async (node: Element) => {
    const r = recent;
    if (r?.node !== node || (r.kind !== 'text' && r.kind !== 'theorem') || writing || !node.isConnected || node.contains(document.activeElement) || node.textContent?.trim() || node.querySelector('img, svg, mjx-container')) return;
    await app.history.idle();
    const h = app.history;
    if (app.selection.kind === 'elements' && app.selection.elements().includes(node)) app.selection.clear();
    const p = pending;
    const held = !!p && h.last === p.entry;
    const active = document.activeElement as HTMLElement | null;
    const sel = getSelection();
    const range = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    const kept = app.selection.kind === 'elements' ? app.selection.elements().filter((e) => e !== node) : [];
    const slide = node.closest('section');
    leaving = true;
    try {
      if (held) h.discard();
      if (r.alone) {
        while (typingOf(h.last, node)) await h.retract(h.last!, true);
        for (const e of [r.first, r.box]) if (e && h.last === e) await h.retract(e, true);
        if (active?.isConnected && active !== document.body && !node.contains(active)) {
          active.focus({ preventScroll: true });
          if (range?.startContainer.isConnected && active.contains(range.startContainer)) {
            sel!.removeAllRanges();
            sel!.addRange(range);
          }
        }
        if (kept.length && kept.every((e) => e.isConnected)) app.selection.set('elements', kept);
      }
      if (node.isConnected) {
        await h.transact(`Delete ${PENDING[r.kind].label}`, () => {
          const show = () => void (slide?.isConnected && app.showSlide(slide));
          h.push({ label: 'show', undo: show, redo: show });
          docOf(app).remove(node);
        });
      }
      if (p && p.el.isConnected && (pending === p || !pending)) {
        pending = p;
        if (held) {
          own = true;
          h.push(p.entry);
          onTop = true;
        }
        p.show();
      }
    } finally {
      leaving = false;
    }
    recent = null;
  };
  const watch = (node: Element, kind: Kind, box: Entry, first: Entry | null) => {
    recent = { node, kind, box, first, alone: true, at: performance.now() };
    node.addEventListener('focusout', () => setTimeout(() => void leave(node).catch(fail), 0));
  };

  const intoBox = (target: EventTarget | null): boolean => {
    if (pending && target === pending.el) return true;
    const node = written?.node;
    return !!node && target instanceof Node && (node.contains(target) || target.contains(node));
  };

  window.addEventListener('beforeinput', (ev) => {
    const r = recent;
    const a = getSelection()?.anchorNode;
    if (r?.first?.label === 'typing' && !writing && app.history.last === r.first && !!a && r.node.contains(a) && performance.now() - r.at < 1000 && TYPED.includes(ev.inputType)) {
      r.at = performance.now();
      const input = new Promise<void>((done) => {
        const end = () => {
          window.removeEventListener('input', end);
          done();
        };
        window.addEventListener('input', end);
        setTimeout(end, 0);
      });
      void app.history.amend(r.first, () => input).catch(fail);
    }
    if (!intoBox(ev.target)) return;
    ev.stopImmediatePropagation();
    const type = ev.inputType;
    if (type === 'insertCompositionText') return;
    ev.preventDefault();
    const kind = written?.kind ?? pending!.kind;
    let text = '';
    if (type === 'insertText' || type === 'insertReplacementText') text = ev.data ?? ev.dataTransfer?.getData('text/plain') ?? '';
    else if (type === 'insertFromPaste') text = ev.dataTransfer?.getData('text/plain') ?? '';
    else if (type === 'insertParagraph' || type === 'insertLineBreak') text = kind === 'code' || writing ? '\n' : '';
    else if (writing && (type === 'deleteContentBackward' || type === 'deleteContentForward')) typed.push(type);
    if (!text) return;
    if (writing) typed.push(text);
    else void write(text, type === 'insertFromPaste' ? 'Paste' : 'typing').catch(fail);
  }, true);
  window.addEventListener('input', (ev) => {
    if (!pending || ev.target !== pending.el) return;
    ev.stopImmediatePropagation();
    if ((ev as InputEvent).isComposing || writing) return;
    const p = pending;
    setTimeout(() => {
      const text = p.el.innerText.replace(/\n$/, '');
      if (pending !== p || writing || !text.trim()) return;
      void write(text, 'Paste').catch(fail);
    }, 0);
  }, true);
  window.addEventListener('compositionend', (ev) => {
    if (pending && ev.target === pending.el && !writing) {
      const text = pending.el.textContent ?? '';
      pending.el.textContent = '';
      if (text) void write(text).catch(fail);
    }
  }, true);
  app.listen('slide', drop);
  app.listen('history', () => {
    const l = app.history.last;
    if (recent && l !== recent.first && !typingOf(l, recent.node) && l !== pending?.entry) recent.alone = false;
    if (own) {
      own = false;
      if (pending) app.markDirty();
      return;
    }
    onTop = false;
    if (!writing && !leaving) drop();
  });

  const texOf = new WeakMap<Element, string>();
  const markEmpty = () => {
    const formulas = [...app.slides().querySelectorAll('div.math')].map((el) => [el, [...el.querySelectorAll('mjx-container')]] as const);
    const lookup = formulas.some(([, ms]) => ms.some((m) => !texOf.has(m))) ? mathLookup() : null;
    for (const [el, ms] of formulas) {
      for (const m of ms) if (lookup && !texOf.has(m)) texOf.set(m, lookup(m)?.tex ?? '');
      el.classList.toggle('beeson-empty', !!ms.length && !ms.map((m) => texOf.get(m)).join('').trim());
    }
  };
  app.onRefresh(['content', 'structure'], markEmpty);

  const openTex = (node: Element, math: Element, entry: Entry | null) => {
    app.math.open(math, entry ?? undefined, () => {
      markEmpty();
      if (entry && node.isConnected && node.classList.contains('beeson-empty')) void app.history.retract(entry).catch(fail);
    });
  };

  onCaptionBox({ begin: (host) => begin('caption', host, null), drop });

  const pendingText = (kind: Kind) => (a: App) => {
    const slide = a.current()!;
    const plate = kind === 'text' && slide.matches('.title, .closing') ? { parent: slide, before: slide.querySelector(':scope > .foot, :scope > aside.notes') } : null;
    const { parent, before } = plate ?? columnPlace(a, slide);
    begin(kind, parent, before);
    if (kind === 'text' && !a.commands.state('shell.format').checked) void a.commands.run('shell.format').catch(fail);
  };

  const insertMenu = (order: number) => ({ bar: 'Insert', group: 'element', order });
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
    id: 'insert.theorem',
    label: 'Theorem',
    keys: { mac: ['Ctrl+Mod+T'], other: ['Alt+Shift+T'] },
    in: ['canvas', 'navigator', 'text'],
    menu: { ...insertMenu(20.5), submenu: 'Theorem' },
    enabled: ready,
    run: (a, arg) => {
      const { parent, before } = columnPlace(a, a.current()!);
      begin('theorem', parent, before, { 'data-kind': typeof arg === 'string' ? arg : 'theorem' });
    },
  });
  liveSubmenu('Insert', 'Theorem', () => Object.entries(deckKinds()).map(([kind, k]) => ({ command: 'insert.theorem', arg: kind, label: k.title })));
  c.define({
    id: 'insert.formula',
    label: 'Formula',
    keys: { mac: ['Mod+Alt+E'], other: ['Alt+='] },
    in: ['canvas', 'navigator', 'text'],
    menu: insertMenu(21),
    toolbar: tool(22, 'formula'),
    enabled: ready,
    run: async (a) => {
      if (a.selection.kind === 'text' && a.commands.enabled('math.inline')) return a.commands.run('math.inline');
      const release = a.math.hold();
      let made: { node: Element; math: Element } | null = null;
      try {
        await a.history.selecting('Insert Formula', async () => {
          const { parent, before } = columnPlace(a, a.current()!);
          const [node] = await docOf(a).insertElement('formula', parent, before, { tex: '' });
          centerIfOut(a, node, Infinity);
          node.classList.remove('beeson-empty');
          await overShapes(a, node);
          checkOverlaps(a, a.current(), node);
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
    run: (a, arg) => a.history.selecting('Insert QR Code', async () => {
      const slot = arg instanceof Element && a.current()!.contains(arg) && isEmptySlot(a, arg) ? arg : null;
      await putPicture(a, slot, (p, b) => docOf(a).insertElement('qr', p, b, { qr: 'https://example.com' }));
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
      const foot = slide.querySelector('.foot:not([data-generated])');
      if (foot && foot.matches('[contenteditable="true"]')) return placeCaret(foot);
      const parent = slide.matches('.split') ? (slide.querySelector(':scope > .text-column') ?? slide) : slide;
      begin('foot', parent, parent.querySelector(':scope > aside.notes'));
    },
  });
}
