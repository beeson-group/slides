// the commands of the Insert menu and of the Insert group of the toolbar: a text box, a formula, a
// code box, a QR code, and a footnote. each element is put at its place in the layout of the
// current slide, i.e. after the last block of the text column, into an empty zone, or on the foot
// line, and it is selected, with the caret in it for a text. a text box, a code box, and a
// footnote are put on the page first as an element of the editor only, marked data-generated, which
// the save and the pairing pass over, with a prompt drawn by the stylesheet below. the first input
// into it writes the element into the file as one entry of the history, hence an empty one is never
// written, and it is taken off the page when the caret leaves it

import type { App } from '../app.ts';
import { mathLookup } from '../math.ts';
import { placeCaret } from '../text/typing.ts';
import { injectStyle } from '../ui/dom.ts';
import { columnOf } from './clipboard.ts';
import { docOf } from './slide.ts';

const CSS = `
html.beeson-editor .reveal .slides .beeson-pending:not(.foot) { position: relative; }
html.beeson-editor .reveal .slides .beeson-pending { min-height: 1.4em; min-width: 8em; }
html.beeson-editor .reveal .slides .foot.beeson-pending { min-width: 13em; }
html.beeson-editor .reveal .slides .beeson-pending[data-prompt][contenteditable]:empty::before { content: attr(data-prompt); position: absolute; left: 0; top: 0; color: var(--muted, #888); white-space: nowrap; pointer-events: none; }
html.beeson-editor .reveal .slides pre.beeson-pending { box-sizing: border-box; min-height: calc(1.25em + 48px); padding: 24px; font-size: 22px; line-height: 1.25; }
html.beeson-editor .reveal .slides pre.beeson-pending[data-prompt][contenteditable]:empty::before { left: 24px; top: 24px; font-family: system-ui, sans-serif; }
html.beeson-editor .reveal .slides div.math.beeson-empty { position: relative; min-height: 1.4em; }
html.beeson-editor .reveal .slides div.math.beeson-empty::before { content: "Click to add a formula"; position: absolute; left: 0; top: 0; color: var(--muted, #888); font-size: 48px; white-space: nowrap; pointer-events: none; }
`;

// a text element that the first input writes into the file
type Kind = 'text' | 'code' | 'foot';
const PENDING: Record<Kind, { label: string; prompt: string; make(): HTMLElement; html(text: string): string }> = {
  text: { label: 'Text Box', prompt: 'Click to add text', make: () => document.createElement('p'), html: (t) => `<p>${lines(t)}</p>` },
  code: { label: 'Code Box', prompt: 'Click to add code', make: () => document.createElement('pre'), html: (t) => `<pre><code class="language-python">${escape(t)}</code></pre>` },
  foot: {
    label: 'Footnote',
    prompt: 'Click to add a footnote',
    make: () => Object.assign(document.createElement('div'), { className: 'foot' }),
    html: (t) => `<div class="foot">${lines(t)}</div>`,
  },
};

const escape = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// a line of a text box or a footnote is a br, as a line typed into a block
const lines = (t: string) => escape(t).replace(/\r?\n/g, '<br>');

// the blocks and figures of a text column, after the last of which a new element is put
const BLOCK = 'h1, h2, h3, h4, p, ul, ol, dl, table, pre, blockquote, div.math, .col, .qr';

// the parent and the node before which a new element of the text column of slide is put: after its
// last block, and else at the start of the column
export function columnPlace(app: App, slide: Element): { parent: Element; before: Node | null } {
  const parent = columnOf(slide);
  const blocks = [...parent.children].filter((el) => el.matches(BLOCK) && !el.matches('.caption, .foot') && !!app.pairing?.elements.has(el));
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
function slideBox(app: App, el: Element): { left: number; top: number; right: number; bottom: number } {
  const slides = app.slides() as HTMLElement;
  const s = slides.getBoundingClientRect();
  const k = slides.offsetWidth ? s.width / slides.offsetWidth : 1;
  const r = el.getBoundingClientRect();
  return { left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k };
}

// a new figure that does not fit under the last block of the text column is moved to the center of
// the slide, where Keynote puts a new object, with a translate in slide px
function centerIfOut(app: App, el: Element): void {
  const b = slideBox(app, el);
  const slide = el.closest('section') as HTMLElement | null;
  const w = slide?.offsetWidth || 1920;
  if (b.bottom <= FLOOR && b.top >= 0 && b.right <= w) return;
  const h = slide?.offsetHeight || 1080;
  const x = Math.round(w / 2 - (b.left + b.right) / 2);
  const y = Math.round(h / 2 - (b.top + b.bottom) / 2);
  docOf(app).setTag(el, { translate: { x, y } }, 'move');
}

// the zone of slide without content, into which a figure is put
const emptyZone = (slide: Element): Element | null => [...slide.querySelectorAll(':scope > .zone, :scope > .panel ~ .zone')].find((z) => !z.children.length && !z.textContent?.trim()) ?? null;

export function install(app: App): void {
  injectStyle('insert', CSS);
  const c = app.commands;
  const fail = (e: unknown) => app.fail(e);
  const ready = (a: App) => !!a.pairing?.root && !!a.current() && a.region() !== 'dialog';

  // the element of the editor that waits for its first input, and whether it is being written
  let pending: { el: HTMLElement; kind: Kind; parent: Element } | null = null;
  let writing = false;
  let typed = '';

  const drop = () => {
    if (!pending || writing) return;
    pending.el.remove();
    pending = null;
    app.invalidate('content');
  };

  const begin = (kind: Kind, parent: Element, before: Node | null) => {
    drop();
    const def = PENDING[kind];
    const el = def.make();
    el.classList.add('beeson-pending');
    el.setAttribute('data-generated', '');
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('data-prompt', def.prompt);
    el.setAttribute('aria-label', def.label);
    parent.insertBefore(el, before && before.parentNode === parent ? before : null);
    pending = { el, kind, parent };
    el.addEventListener('focusout', () => setTimeout(() => {
      if (pending?.el === el && document.activeElement !== el) drop();
    }, 0));
    placeCaret(el);
    app.invalidate('content');
  };

  // the first text typed into the element of the editor writes it into the file in its place, and
  // the text typed while it is written is typed after it, as typing of the block
  const write = async (text: string) => {
    const p = pending;
    if (!p) return;
    writing = true;
    typed = '';
    const def = PENDING[p.kind];
    try {
      await app.history.transact(def.label, async () => {
        const [node] = await docOf(app).insert(def.html(text), p.parent, p.el, def.label);
        p.el.remove();
        pending = null;
        placeCaret(node);
      });
    } finally {
      writing = false;
    }
    if (typed) document.execCommand('insertText', false, typed);
    typed = '';
  };

  // the input into the element of the editor is taken before the typing of text/typing.ts, which
  // records the blocks of the file
  window.addEventListener('beforeinput', (ev) => {
    const p = pending;
    if (!p || ev.target !== p.el) return;
    ev.stopImmediatePropagation();
    const type = ev.inputType;
    if (type === 'insertCompositionText') return;
    ev.preventDefault();
    let text = '';
    if (type === 'insertText' || type === 'insertReplacementText') text = ev.data ?? ev.dataTransfer?.getData('text/plain') ?? '';
    else if (type === 'insertFromPaste') text = ev.dataTransfer?.getData('text/plain') ?? '';
    else if (p.kind === 'code' && (type === 'insertParagraph' || type === 'insertLineBreak')) text = '\n';
    if (!text) return;
    if (writing) typed += text;
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
  app.listen('history', () => {
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

  // the TeX field of a new formula. a formula left with an empty TeX at the close of the field is
  // taken off again, as a Cancel of the Insert Equation window of Keynote
  const openTex = (node: Element, math: Element) => {
    app.math.open(math);
    const wait = window.setInterval(() => {
      if (app.math.isOpen()) return;
      window.clearInterval(wait);
      markEmpty();
      if (node.isConnected && node.classList.contains('beeson-empty') && app.history.undoLabel === 'Formula') void app.history.undo().catch(fail);
    }, 100);
  };

  const pendingText = (kind: Kind) => (a: App) => {
    const slide = a.current()!;
    const { parent, before } = columnPlace(a, slide);
    begin(kind, parent, before);
  };

  const insertMenu = (order: number) => ({ bar: 'Insert', group: 'element', order });
  const tool = (order: number, icon: string) => ({ group: 'insert', order, icon });
  c.define({
    id: 'insert.text',
    label: 'Text Box',
    menu: insertMenu(20),
    toolbar: tool(20, 'text'),
    enabled: ready,
    run: pendingText('text'),
  });
  c.define({
    id: 'insert.formula',
    label: 'Formula',
    keys: { mac: ['Mod+Alt+E'], other: ['Alt+='] },
    menu: insertMenu(21),
    toolbar: tool(21, 'formula'),
    enabled: ready,
    undoable: true,
    run: async (a) => {
      // in a text, the button puts an inline formula at the caret, as Insert Equation of Keynote
      // and PowerPoint does, through math.inline of commands/math.ts. the sheet is opened after
      // the click, since the click on the toolbar would close it on its way to the document
      if (a.selection.kind === 'text' && a.commands.enabled('math.inline')) {
        setTimeout(() => void a.commands.run('math.inline'), 0);
        return;
      }
      const { parent, before } = columnPlace(a, a.current()!);
      const [node] = await docOf(a).insertElement('formula', parent, before, { tex: '' });
      a.selection.set('elements', [node]);
      markEmpty();
      const math = node.querySelector('mjx-container');
      if (math) setTimeout(() => openTex(node, math), 0);
    },
  });
  c.define({
    id: 'insert.qr',
    label: 'QR Code',
    menu: insertMenu(26),
    toolbar: tool(26, 'qr'),
    enabled: ready,
    undoable: true,
    run: async (a) => {
      const slide = a.current()!;
      const zone = emptyZone(slide);
      const place = zone ? { parent: zone, before: null } : slide.matches('.title, .closing') ? { parent: slide, before: slide.querySelector(':scope > aside.notes') } : columnPlace(a, slide);
      const [node] = await docOf(a).insertElement('qr', place.parent, place.before, { qr: 'https://example.com' });
      if (!zone) centerIfOut(a, node);
      a.selection.set('elements', [node]);
    },
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
