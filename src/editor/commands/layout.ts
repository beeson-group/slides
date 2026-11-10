// the layout of a slide changed in place, as the Slide Layout of Keynote. the parts of a slide,
// i.e. its heading, its words, its figures, its footnote, and its notes, are taken out of the
// wrappers of the old layout and put into those of the new one: the panel of a split slide, the
// block of a title or a closing slide, and the sec of a section slide. the parts keep their order,
// their steps, and their places, and the slide is written again from its own text with the
// indentation of the file. Reset Slide writes a slide in its own layout and takes the places off
// its elements. each command is one entry of the history

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { LAYOUTS, sampleText, textStyle, type Layout } from '../model/templates.ts';
import { childrenIn, eolOf, indentAt, spaceOf, unitsOf } from '../model/units.ts';
import type { Navigator } from '../navigator/navigator.ts';
import { drawInto } from '../navigator/thumbs.ts';
import { classesOf, tokenize, type Range, type Token } from '../tokens.ts';
import { injectStyle } from '../ui/dom.ts';
import { install as installOrder } from './order.ts';

export const LABELS: Record<Layout, string> = { title: 'Title', section: 'Section', content: 'Content', narrow: 'Content, Narrow', wide: 'Content, Wide', figure: 'Figure', split: 'Split', closing: 'Closing' };

const LAYOUT_CLASSES = ['title', 'section', 'closing', 'figure', 'split', 'narrow', 'wide'];
const WRAPPER_CLASSES = ['panel', 'block', 'sec'];

export type Kind = 'heading' | 'words' | 'caption' | 'foot' | 'visual' | 'other';

// the wrapper of each layout that has one, and the kinds of parts that it takes
const WRAP: Partial<Record<Layout, { cls: string; takes: Kind[] }>> = {
  title: { cls: 'block', takes: ['heading', 'words', 'caption'] },
  closing: { cls: 'block', takes: ['heading', 'words', 'caption'] },
  section: { cls: 'sec', takes: ['heading', 'words'] },
  split: { cls: 'panel', takes: ['heading', 'words', 'foot'] },
};

const VISUAL_CLASSES = ['backdrop', 'surface', 'zone', 'plate', 'qr', 'plot'];
const VISUAL_TAGS = ['figure', 'img', 'video', 'tycho-viewer', 'canvas', 'svg', 'iframe', 'object'];
const OTHER_TAGS = ['aside', 'script', 'style', 'template', 'link', 'meta', 'noscript'];

export function layoutOf(slide: Element | null): Layout {
  const c = slide?.classList;
  return (LAYOUT_CLASSES as Layout[]).find((l) => c?.contains(l)) ?? 'content';
}

// the kind of a part of a slide, from its tag name and its classes
export function kindOf(name: string, classes: string[]): Kind {
  if (OTHER_TAGS.includes(name) || classes.includes('run') || classes.includes('lockup')) return 'other';
  if (name === 'h1' || name === 'h2') return 'heading';
  if (classes.includes('caption')) return 'caption';
  if (classes.includes('foot')) return 'foot';
  if (VISUAL_TAGS.includes(name) || classes.some((c) => VISUAL_CLASSES.includes(c))) return 'visual';
  return 'words';
}

// a part by its index, or a wrapper with the indices of its parts
export type Item = number | { wrap: string; parts: number[] };

// the parts of a slide in the layout, in their order. the parts that the wrapper of the layout
// takes are put into it, and the wrapper is put where the first of them was. only the first
// heading is the heading of the slide, and a later one counts as words
export function arrange(kinds: Kind[], layout: Layout): Item[] {
  const first = kinds.indexOf('heading');
  const ks = kinds.map((k, i) => (k === 'heading' && i !== first ? 'words' : k));
  const w = WRAP[layout];
  if (!w) return ks.map((_, i) => i);
  const wrapper = { wrap: w.cls, parts: [] as number[] };
  const out: Item[] = [];
  ks.forEach((k, i) => {
    if (!w.takes.includes(k)) out.push(i);
    else {
      if (!wrapper.parts.length) out.push(wrapper);
      wrapper.parts.push(i);
    }
  });
  if (!wrapper.parts.length) out.unshift(wrapper);
  return out;
}

const headingTag = (layout: Layout) => (layout === 'title' || layout === 'closing' ? 'h1' : 'h2');

// the classes of a section in the layout. a class that does not name a layout is kept
export function layoutClasses(classes: string[], layout: Layout): string[] {
  const keep = classes.filter((c) => !LAYOUT_CLASSES.includes(c));
  return layout === 'content' ? keep : [layout, ...keep];
}

// a part read from the text: lead is the comments before it, blank is true after a blank line,
// and indent is the indentation of its first line in the file
type Part = { name: string; classes: string[]; lead: string; blank: boolean; body: string; indent: string };

// text with each line after the first that starts with from started with to instead. a line in
// a pre or a textarea keeps its white space, which is shown
export function shift(text: string, from: string, to: string): string {
  if (from === to || !text.includes('\n')) return text;
  const keep: Range[] = [];
  let open: number | null = null;
  for (const t of tokenize(text)) {
    if (t.type === 'start' && (t.name === 'pre' || t.name === 'textarea') && open === null) open = t.end;
    else if (t.type === 'end' && (t.name === 'pre' || t.name === 'textarea') && open !== null) {
      keep.push({ start: open, end: t.start });
      open = null;
    }
  }
  return text.replace(/\n([ \t]*)/g, (m, space: string, at: number) => {
    if (keep.some((r) => at >= r.start && at < r.end) || !space.startsWith(from)) return m;
    return '\n' + to + space.slice(from.length);
  });
}

// the start tag of a section with its class attribute set to classes, and its other bytes kept
function openTag(body: string, open: Extract<Token, { type: 'start' }>, classes: string[]): string {
  const text = body.slice(open.start, open.end);
  if (classes.join(' ') === classesOf(open).join(' ')) return text;
  const attr = open.attrs.find((a) => a.name === 'class');
  const value = `class="${classes.join(' ')}"`;
  if (!attr) return classes.length ? text.replace(/^<section/i, `<section ${value}`) : text;
  const a = attr.start - open.start;
  const b = attr.end - open.start;
  if (classes.length) return text.slice(0, a) + value + text.slice(b);
  return text.slice(0, a).replace(/[ \t\r\n\f]+$/, '') + text.slice(b);
}

// body is the text of a section with its edits, and step one step of the indentation of the file.
// relayout returns the section written in the layout, and body itself when the section is
// already in it
export function relayout(body: string, layout: Layout, step: string): string {
  const tokens = tokenize(body);
  const open = tokens.find((t): t is Extract<Token, { type: 'start' }> => t.type === 'start');
  const close = [...tokens].reverse().find((t) => t.type === 'end' && t.name === 'section');
  if (!open || open.name !== 'section' || !close) throw new Error('the slide is not a section');
  const eol = eolOf(body);
  const base = indentAt(body, close.start);
  const startAt = new Map(tokens.filter((t) => t.type === 'start').map((t) => [t.start, t as Extract<Token, { type: 'start' }>]));
  const endAt = new Map(tokens.filter((t) => t.type === 'end').map((t) => [t.end, t]));
  // the start tag of each wrapper of the slide, reused when the layout has the same wrapper
  const wrappers = new Map<string, string>();
  const parts: Part[] = [];
  const read = (content: Range, depth: number, prefix: string) => {
    for (const u of unitsOf(body, childrenIn(tokens, content), content).units) {
      const lead = body.slice(u.lead.start, u.lead.end);
      const space = spaceOf(lead);
      const tok = startAt.get(u.range.start)!;
      const classes = classesOf(tok);
      const wrap = depth === 1 && tok.name === 'div' ? WRAPPER_CLASSES.find((c) => classes.includes(c)) : undefined;
      const end = endAt.get(u.range.end);
      if (wrap && end) {
        wrappers.set(wrap, body.slice(tok.start, tok.end));
        read({ start: tok.end, end: end.start }, depth + 1, lead.slice(space.length));
        continue;
      }
      const indent = indentAt(body, u.lead.start + space.length);
      parts.push({ name: tok.name, classes, lead: prefix + lead.slice(space.length), blank: (space.match(/\n/g) ?? []).length > 1, body: body.slice(u.range.start, u.end), indent });
      prefix = '';
    }
  };
  read({ start: open.end, end: close.start }, 1, '');
  const h = headingTag(layout);
  const ind = (d: number) => base + step.repeat(d);
  const firstHeading = parts.findIndex((p) => p.name === 'h1' || p.name === 'h2');
  const put = (i: number, d: number) => {
    const p = parts[i];
    let text = p.body;
    if (i === firstHeading) text = text.replace(/^<h[12](?=[\s/>])/i, `<${h}`).replace(/<\/h[12](\s*)>$/i, `</${h}$1>`);
    return (p.blank ? eol : '') + eol + ind(d) + shift(p.lead + text, p.indent, ind(d));
  };
  let out = openTag(body, open, layoutClasses(classesOf(open), layout));
  const items = arrange(parts.map((p) => kindOf(p.name, p.classes)), layout);
  if (!items.length) return out + body.slice(open.end);
  for (const item of items) {
    if (typeof item === 'number') out += put(item, 1);
    else {
      const inner = item.parts.length ? item.parts.map((i) => put(i, 2)).join('') : eol + ind(2) + `<${h}></${h}>`;
      out += eol + ind(1) + (wrappers.get(item.wrap) ?? `<div class="${item.wrap}">`) + inner + eol + ind(1) + '</div>';
    }
  }
  return out + eol + base + body.slice(close.start);
}

const navOf = (app: App): Navigator => app.nav as Navigator;

// the slides of the commands: those selected in the navigator, else the current one
function targets(app: App): Element[] {
  if (!app.pairing?.root) return [];
  const picked = app.selection.kind === 'slides' ? [...app.selection.items] : [app.current()].filter((s): s is Element => !!s);
  return picked.filter((s) => s.localName === 'section' && !!app.pairing?.elements.get(s)?.open);
}

const stepOf = (app: App) => textStyle(app.source?.text ?? '').step;

// each slide replaced by a slide of the text that write returns for it, after the comments of its
// unit. a slide whose text write leaves as it is stays on the page
type Page = { Beeson?: { mount?(root: Element): void } };

// every step of a slide is shown while it is edited, and a new slide is not marked so by reveal.js.
// its fragments are marked as shown, and its highlights are applied again
function showSteps(slide: Element): void {
  for (const f of slide.querySelectorAll('.fragment')) f.classList.add('visible');
  (window as unknown as Page).Beeson?.mount?.(slide);
}

async function rewrite(app: App, slides: Element[], write: (body: string, slide: Element) => string, label: string): Promise<Element[]> {
  const current = app.current();
  const out: Element[] = [];
  let shown: Element | null = null;
  for (const s of slides) {
    const body = app.doc.elementText(s);
    const next = write(body, s);
    if (next === body) {
      out.push(s);
      continue;
    }
    const unit = app.doc.unitText(s);
    const lead = unit.slice(0, unit.length - body.length);
    const parent = s.parentElement!;
    const before = s.nextSibling;
    if (app.selection.kind === 'elements' || app.selection.kind === 'text') app.selection.clear();
    await app.doc.remove(s, label);
    const [slide] = await app.doc.insert(lead.slice(spaceOf(lead).length) + next, parent, before, label);
    showSteps(slide);
    out.push(slide);
    if (s === current) shown = slide;
  }
  if (out.some((s, i) => s !== slides[i])) {
    navOf(app).select(out, shown ?? out.at(-1) ?? null);
    if (shown) app.showSlide(shown);
    app.relayout();
  }
  return out;
}

export async function changeLayout(app: App, slides: Element[], layout: Layout): Promise<Element[]> {
  const step = stepOf(app);
  const out = await rewrite(app, slides, (body) => relayout(body, layout, step), 'layout');
  for (const s of out) if (!slides.includes(s)) fitPanel(app, s);
  return out;
}

// true when a text of the panel runs past its bottom, or into the footnote at its bottom
function overflows(panel: Element): boolean {
  const foot = panel.querySelector(':scope > .foot');
  const box = panel.getBoundingClientRect();
  const limit = foot && foot.getBoundingClientRect().height ? foot.getBoundingClientRect().top : box.bottom;
  return [...panel.children].some((el) => !el.matches('.foot, aside') && el.getBoundingClientRect().bottom > limit + 1);
}

// the texts moved into the panel of a split slide are shrunk to fit it, as PowerPoint shrinks the
// text of a placeholder: the paragraphs and the lists of the panel are set in the style Small,
// within the scale of the theme. a text that still does not fit keeps the mark of overflow.ts. a
// slide that is not shown is laid out for the measure, hidden, since reveal.js does not lay out a
// slide away from the current one
function fitPanel(app: App, slide: Element): void {
  const panel = slide.querySelector(':scope > .panel');
  if (!panel || !(slide instanceof HTMLElement) || !laidOut(slide, () => overflows(panel))) return;
  for (const el of panel.querySelectorAll(':scope > p, :scope > ul, :scope > ol')) {
    if (!app.pairing?.elements.get(el)?.open) continue;
    const classes = app.doc.tagState(el).classes.filter((c) => c !== 'fragment');
    if (!classes.length) app.doc.setTag(el, { classes: { small: true } }, 'layout');
  }
}

// measure run on slide shown as the current slide is, and invisible, with its inline style put back
function laidOut<T>(slide: HTMLElement, measure: () => T): T {
  const style = slide.getAttribute('style');
  const hidden = slide.hidden;
  const present = slide.classList.contains('present');
  slide.hidden = false;
  slide.style.display = 'block';
  if (!present) {
    slide.style.visibility = 'hidden';
    slide.classList.add('present');
  }
  try {
    return measure();
  } finally {
    if (!present) slide.classList.remove('present');
    if (style === null) slide.removeAttribute('style');
    else slide.setAttribute('style', style);
    slide.hidden = hidden;
  }
}

// the elements of a slide with a place of the editor: a translate, a rotate, or the width of a
// figure that the editor resizes
const SIZED = 'img, video, .qr, tycho-viewer';
function placed(app: App, slide: Element): Element[] {
  return [...slide.querySelectorAll('*')].filter((el) => {
    if (!app.pairing?.elements.get(el)?.open) return false;
    const s = app.doc.tagState(el).style;
    return 'translate' in s || 'rotate' in s || ('width' in s && el.matches(SIZED));
  });
}

function needsReset(app: App, slide: Element): boolean {
  const body = app.doc.elementText(slide);
  return relayout(body, layoutOf(slide), stepOf(app)) !== body || placed(app, slide).length > 0;
}

// the chooser: a grid of a sample slide of each layout, as the master slides of Keynote and the
// layout gallery of PowerPoint, with the name of the layout under it and the layout of the slide
// marked. a click or Enter on a tile changes the layout of the selected slides. it has the look of
// the New Slide gallery of commands/slide.ts, with larger tiles
const TILE = 120;
const CSS = `
.beeson-edit-gallery.beeson-edit-layouts { width: max-content; }
.beeson-edit-layouts .grid { grid-template-columns: repeat(4, ${TILE + 8}px); }
.beeson-edit-layouts .tile .pic { width: ${TILE}px; }
.beeson-edit-layouts .tile[aria-selected="true"] .pic { outline: 3px solid var(--g-select); }
.beeson-edit-layouts .tile[aria-selected="true"] span:last-child { color: var(--g-select); font-weight: 600; }
`;

// the sample slide of a layout, parsed from its text
function sample(layout: Layout): Element {
  const t = document.createElement('template');
  t.innerHTML = sampleText(layout);
  return t.content.firstElementChild!;
}

let chooser: (HTMLDialogElement & { anchor?: HTMLElement | null }) | null = null;

function closeChooser(back = true): void {
  if (!chooser) return;
  const c = chooser;
  chooser = null;
  c.close();
  c.remove();
  if (back && c.anchor?.isConnected) c.anchor.focus({ preventScroll: true });
}

// the chooser under its anchor, at the right of a row of the navigator, or else in the window
function placeChooser(dialog: HTMLElement, anchor: Element | null): void {
  const w = dialog.offsetWidth;
  const h = dialog.offsetHeight;
  const r = anchor?.getBoundingClientRect();
  let x = r ? r.left : (innerWidth - w) / 2;
  let y = r ? r.bottom + 6 : (innerHeight - h) / 3;
  if (r && anchor?.closest('.beeson-edit-nav')) {
    x = r.right + 10;
    y = r.top - 8;
  } else if (r && y + h > innerHeight - 8) {
    x = r.left - w - 10;
    y = r.top;
  }
  dialog.style.left = `${Math.max(8, Math.min(x, innerWidth - w - 8))}px`;
  dialog.style.top = `${Math.max(8, Math.min(y, innerHeight - h - 8))}px`;
}

export function openChooser(app: App, anchor: Element | null): void {
  closeChooser(false);
  const slide = targets(app).at(-1) ?? app.current();
  if (!slide) return;
  const dialog = document.createElement('dialog') as HTMLDialogElement & { anchor?: HTMLElement | null };
  dialog.className = 'beeson-edit-gallery beeson-edit-layouts';
  dialog.setAttribute('aria-label', 'Slide layout');
  dialog.anchor = anchor instanceof HTMLElement ? anchor : document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const head = Object.assign(document.createElement('div'), { className: 'head', textContent: 'Slide Layout' });
  const grid = Object.assign(document.createElement('div'), { className: 'grid' });
  grid.setAttribute('role', 'listbox');
  grid.setAttribute('aria-label', 'Layouts');
  const stage = app.slides() as HTMLElement;
  const deck = { width: stage.offsetWidth || 1920, height: stage.offsetHeight || 1080 };
  const now = layoutOf(slide);
  const tiles = LAYOUTS.map((layout) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile';
    tile.dataset.layout = layout;
    tile.setAttribute('role', 'option');
    tile.setAttribute('aria-selected', String(layout === now));
    const pic = Object.assign(document.createElement('span'), { className: 'pic' });
    tile.append(pic, Object.assign(document.createElement('span'), { textContent: LABELS[layout] }));
    tile.addEventListener('click', () => {
      closeChooser();
      void app.commands.run(`slide.layout.${layout}`).catch((e) => app.fail(e));
    });
    grid.append(tile);
    return { tile, pic, layout };
  });
  dialog.append(head, grid);
  document.body.append(dialog);
  dialog.show();
  for (const t of tiles) drawInto(t.pic, sample(t.layout), deck, TILE);
  placeChooser(dialog, dialog.anchor ?? app.current());
  dialog.addEventListener('keydown', (ev) => {
    const i = tiles.findIndex((t) => t.tile === document.activeElement);
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4 };
    if (ev.key === 'Escape') closeChooser();
    else if (ev.key in step) tiles[Math.min(tiles.length - 1, Math.max(0, i + step[ev.key]))].tile.focus();
    else if (ev.key === 'Home' || ev.key === 'End') tiles[ev.key === 'Home' ? 0 : tiles.length - 1].tile.focus();
    else if (ev.key === 'Tab') tiles[(i + (ev.shiftKey ? tiles.length - 1 : 1)) % tiles.length].tile.focus();
    else return;
    ev.preventDefault();
    ev.stopPropagation();
  });
  const outside = (ev: PointerEvent) => {
    if (!chooser) document.removeEventListener('pointerdown', outside, true);
    else if (!chooser.contains(ev.target as Node)) {
      document.removeEventListener('pointerdown', outside, true);
      closeChooser(false);
    }
  };
  document.addEventListener('pointerdown', outside, true);
  chooser = dialog;
  (tiles.find((t) => t.layout === now) ?? tiles[0]).tile.focus();
}

export function install(app: App): void {
  injectStyle('layout', CSS);
  const defs: Command[] = [
    ...LAYOUTS.map(
      (layout, i): Command => ({
        id: `slide.layout.${layout}`,
        label: LABELS[layout],
        menu: { bar: 'Slide', group: 'layout', order: 55 + i, submenu: 'Layout' },
        enabled: (a) => targets(a).length > 0,
        checked: (a) => {
          const list = targets(a);
          return list.length > 0 && list.every((s) => layoutOf(s) === layout);
        },
        undoable: true,
        run: async (a) => void (await changeLayout(a, targets(a), layout)),
      }),
    ),
    {
      // arg is the button that opens the chooser, or the argument of a context menu
      id: 'slide.layoutChooser',
      label: 'Change Layout…',
      context: ['slide', 'canvas'],
      enabled: (a) => targets(a).length > 0,
      run: (a, arg) => {
        const t = (arg as { target?: unknown } | undefined)?.target;
        openChooser(a, arg instanceof Element ? arg : t instanceof Element && t.closest('.beeson-edit-nav') ? t : null);
      },
    },
    {
      id: 'slide.reset',
      label: 'Reset Slide',
      menu: { bar: 'Slide', group: 'layout', order: 64 },
      context: ['slide', 'canvas'],
      enabled: (a) => targets(a).some((s) => needsReset(a, s)),
      undoable: true,
      run: async (a) => {
        const step = stepOf(a);
        const fresh = await rewrite(a, targets(a), (body, s) => relayout(body, layoutOf(s), step), 'reset slide');
        for (const s of fresh) {
          for (const el of placed(a, s)) {
            const has = a.doc.tagState(el).style;
            const style: Record<string, null> = {};
            for (const k of ['translate', 'rotate', 'width']) if (k in has && (k !== 'width' || el.matches(SIZED))) style[k] = null;
            a.doc.setTag(el, { style }, 'reset slide');
          }
        }
        a.relayout();
      },
    },
  ];
  for (const d of defs) app.commands.define(d);
  // the commands of the order, the groups, the locks, and the rotation, from the same install line
  // of main.ts
  installOrder(app);
}
