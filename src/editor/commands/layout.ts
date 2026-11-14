// the layout of a slide changed in place, as the Slide Layout of Keynote. the parts of a slide,
// i.e. its heading, its words, its figures, its footnote, and its notes, are taken out of the
// wrappers of the old layout and put into those of the new one: the text column of a split slide, the
// title text of a title or a closing slide, and the sec of a section slide. the parts keep their order,
// their steps, and their places, and the slide is written again from its own text with the
// indentation of the file. Reset Slide writes a slide in its own layout and takes the places off
// its elements. each command is one entry of the history

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { LAYOUTS, layoutText, sampleText, textStyle, type Layout, type NewLayout } from '../model/templates.ts';
import { childrenIn, eolOf, indentAt, spaceOf, unitsOf } from '../model/units.ts';
import type { Navigator } from '../navigator/navigator.ts';
import { drawInto, laidOut } from '../navigator/thumbs.ts';
import { classesOf, tokenize, type Range, type Token } from '../tokens.ts';
import { translateIn } from '../tags.ts';
import { injectStyle } from '../ui/dom.ts';
import { install as installOrder } from './order.ts';
import { checkOverlaps } from '../overflow.ts';

export const LABELS: Record<Layout, string> = { title: 'Title', section: 'Section', content: 'Content', narrow: 'Content, Narrow', wide: 'Content, Wide', figure: 'Figure', split: 'Split', closing: 'Closing' };

const LAYOUT_CLASSES = ['title', 'section', 'closing', 'figure', 'split', 'narrow', 'wide'];
const WRAPPER_CLASSES = ['text-column', 'title-text', 'sec', 'caption'];

export type Kind = 'heading' | 'words' | 'caption' | 'foot' | 'visual' | 'other';

// the wrapper of each layout that has one, and the kinds of parts that it takes. the words of a
// figure slide are its caption at the lower left, since the plate takes the rest of the slide
const WRAP: Partial<Record<Layout, { cls: string; takes: Kind[] }>> = {
  title: { cls: 'title-text', takes: ['heading', 'words', 'caption'] },
  closing: { cls: 'title-text', takes: ['heading', 'words', 'caption'] },
  section: { cls: 'sec', takes: ['heading', 'words'] },
  split: { cls: 'text-column', takes: ['heading', 'words', 'foot'] },
  figure: { cls: 'caption', takes: ['words'] },
};

// the empty plate of a figure slide, as a new one has, which is added to a slide without a figure
// and taken off again at a change to another layout
const PLATE = '<div class="plate"></div>';

const VISUAL_CLASSES = ['backdrop', 'surface', 'figure-box', 'plate', 'qr', 'plot', 'tikz'];
const VISUAL_TAGS = ['figure', 'img', 'video', 'tycho-viewer', 'canvas', 'svg', 'iframe', 'object'];
const OTHER_TAGS = ['aside', 'script', 'style', 'template', 'link', 'meta', 'noscript'];

export function layoutOf(slide: Element | null): Layout {
  const c = slide?.classList;
  return (LAYOUT_CLASSES as Layout[]).find((l) => c?.contains(l)) ?? 'content';
}

// the kind of a part of a slide, from its tag name and its classes
export function kindOf(name: string, classes: string[]): Kind {
  if (OTHER_TAGS.includes(name) || classes.includes('run') || classes.includes('lockup') || classes.includes('shape')) return 'other';
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
  if (!wrapper.parts.length && w.takes.includes('heading')) out.unshift(wrapper);
  return out;
}

// the empty placeholders of the words of a new slide of the layout, without white space, e.g.
// <p class="caption"></p> of a figure slide
const holdersOf = (layout: Layout): string[] =>
  layoutText(layout, { eol: '\n', step: '' }).replace(/\s+(?=<)/g, '').match(/<p[^>]*><\/p>|<ul><li><\/li><\/ul>/g) ?? [];
const holderOf = (body: string): string | null => {
  const sig = body.replace(/\s+(?=<)/g, '');
  return /^(<p( class="[\w ]+")?><\/p>|<ul><li><\/li><\/ul>)$/.test(sig) ? sig : null;
};

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
  // an empty placeholder that the layout does not have is dropped, and a slide left without words
  // gets the placeholders of a new slide of the layout after its heading, as Change Layout of
  // PowerPoint replaces the placeholders of a slide by those of the new layout
  const same = ((LAYOUT_CLASSES as Layout[]).find((c) => classesOf(open).includes(c)) ?? 'content') === layout;
  const holders = holdersOf(layout);
  const kept = parts.filter((p) => same || p.lead.trim() || !holderOf(p.body) || holders.includes(holderOf(p.body)!));
  if (!same && !kept.some((p) => ['words', 'caption'].includes(kindOf(p.name, p.classes)))) {
    const at = kept.findIndex((p) => p.name === 'h1' || p.name === 'h2') + 1;
    const head = headingTag(layout);
    if (!at && layout !== 'section') holders.unshift(`<${head}></${head}>`);
    kept.splice(at, 0, ...holders.map((b) => ({ name: b.slice(1, 3).replace(/\W/g, ''), classes: /class="([^"]*)"/.exec(b)?.[1].split(' ') ?? [], lead: '', blank: false, body: b.replace('<ul><li></li></ul>', `<ul>${eol}${step}<li></li>${eol}</ul>`), indent: '' })));
  }
  parts.splice(0, parts.length, ...kept);
  // a plate is laid out only on a figure slide, and on another slide it is the figure box at the right
  if (layout !== 'figure') {
    for (const p of parts) {
      if (p.name !== 'div' || !p.classes.includes('plate') || p.body === PLATE) continue;
      p.body = p.body.replace(/^(<div\b[^>]*?\bclass\s*=\s*["']?[^"'>]*?)\bplate\b/i, '$1figure-box');
      p.classes = p.classes.map((c) => (c === 'plate' ? 'figure-box' : c));
    }
  }
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
  // an empty element, e.g. a span that is a step of a plot, is not a text of the caption
  const empty = (p: Part) => /^<([\w-]+)[^>]*>\s*<\/\1\s*>$/.test(p.body);
  const kinds = parts.map((p) => kindOf(p.name, p.classes)).map((k, i) => (layout === 'figure' && k === 'words' && empty(parts[i]) ? 'other' : k));
  const items = arrange(kinds, layout).filter((i) => typeof i !== 'number' || layout === 'figure' || parts[i].body !== PLATE);
  if (layout === 'figure' && !kinds.includes('visual')) out += eol + ind(1) + PLATE;
  else if (!items.length) return out + body.slice(open.end);
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
  const from = slides.map((s) => {
    const body = app.doc.elementText(s);
    const o = origins.get(s);
    return o && o.last === body ? o : { text: body, layout: layoutOf(s), last: body };
  });
  // the places among the words of each slide of the text elements that the fit of its text column shrank. a
  // slide written from its first text has none
  const shrunk = slides.map((s, k) => (layout === 'split' || from[k].text !== from[k].last ? [] : wordsOf(app, s).flatMap((el, i) => (fitted.has(el) && el.classList.contains('small') ? [i] : []))));
  const codes = slides.map((s) => drawnCodes(app, s));
  const out = await rewrite(app, slides, (_, s) => {
    const o = from[slides.indexOf(s)];
    return layout === o.layout ? o.text : relayout(o.text, layout, step);
  }, 'layout');
  out.forEach((s, k) => {
    if (slides.includes(s)) return;
    if (layout !== from[k].layout) keepCodes(app, s, codes[k]);
    const words = wordsOf(app, s);
    for (const i of shrunk[k]) if (words[i]) app.doc.setTag(words[i], { classes: { small: false } }, 'layout');
    fitPanel(app, s);
    origins.set(s, { ...from[k], last: app.doc.elementText(s) });
    checkOverlaps(app, s);
  });
  return out;
}

// the QR codes of a slide in their order, each with the center of its drawn box and its width in
// slide px, its computed position, and the translate and the width of its style, or null for a
// code that is not shown. the center does not move with a rotate about it
type Drawn = { x: number; y: number; width: number; position: string; translate?: string; w?: string } | null;
function drawnCodes(app: App, slide: Element): Drawn[] {
  if (!(slide instanceof HTMLElement)) return [];
  return laidOut(slide, () => {
    const s = slide.getBoundingClientRect();
    const k = slide.offsetWidth ? s.width / slide.offsetWidth : 1;
    return [...slide.querySelectorAll<HTMLElement>('.qr')].map((q) => {
      if (!app.pairing?.elements.get(q)?.open || !q.getClientRects().length) return null;
      const r = q.getBoundingClientRect();
      const style = app.doc.tagState(q).style;
      return { x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k, width: q.offsetWidth, position: getComputedStyle(q).position, translate: style.translate, w: style.width };
    });
  });
}

// each QR code with a translate or a width keeps its place in the new layout of slide. a code that
// the theme places in the same way in both layouts keeps the translate and the width of its style,
// also where the slide was written from its text before a run of changes. a code that the theme
// places in another way, e.g. at the lower right of a closing slide and in the flow elsewhere, keeps
// the box drawn before the change, as PowerPoint keeps an object that is not a placeholder: its
// translate is written again, and its width where the default width of the layout differs. a code
// without a translate and a width takes the place and the size of the layout
function keepCodes(app: App, slide: Element, was: Drawn[]): void {
  [...slide.querySelectorAll<HTMLElement>('.qr')].forEach((q, i) => {
    const old = was[i];
    if (!old || !app.pairing?.elements.get(q)?.open || (old.translate === undefined && old.w === undefined)) return;
    const put = (key: 'translate' | 'width', value: string | undefined) => {
      if (app.doc.tagState(q).style[key] !== value) app.doc.setTag(q, { style: { [key]: value ?? null } }, 'layout');
    };
    const first = app.doc.tagState(q).style.width;
    put('width', old.w);
    const at = drawnCodes(app, slide)[i];
    if (!at || at.position === old.position) return put('translate', old.translate);
    // the width of the text before the run, none, or the old width, whichever draws the old size,
    // so that a width written by an earlier change is taken off where the layout draws it by default
    const fits = (w: string | undefined) => {
      put('width', w);
      return drawnCodes(app, slide)[i]?.width === old.width;
    };
    if (!fits(first) && !fits(undefined) && !(old.w !== undefined && fits(old.w))) put('width', `${Math.round(old.width)}px`);
    const moved = drawnCodes(app, slide)[i]!;
    const now = app.doc.tagState(q).style.translate;
    // a translate that is not written in px, e.g. with a bare 0 or as a share of the box, is read
    // from the computed style, where a share is of the drawn box of the code, which is square
    const drawn = () => {
      const [a = '0', b = '0'] = getComputedStyle(q).translate.split(/\s+/);
      const px = (v: string) => (v.endsWith('%') ? parseFloat(v) / 100 * moved.width : parseFloat(v)) || 0;
      return { x: px(a), y: px(b) };
    };
    const t = now === undefined ? { x: 0, y: 0 } : translateIn(`translate: ${now}`) ?? drawn();
    const x = Math.round(t.x + old.x - moved.x);
    const y = Math.round(t.y + old.y - moved.y);
    if (now === undefined ? x || y : x !== t.x || y !== t.y) app.doc.setTag(q, { translate: { x, y } }, 'layout');
  });
}

// the text of each slide before a run of changes of layout without an edit between them, and its
// layout. a change back to this layout gives the text again, as the file has it
const origins = new WeakMap<Element, { text: string; layout: Layout; last: string }>();

// the text elements set in the style Small by the fit of a text column in this session. an undo and a redo put
// the same elements back, hence a change of layout away from Split takes the style off these
// text elements only, and a text element in the style Small before the change to Split keeps it
const fitted = new WeakSet<Element>();

// the parts of a slide of the kind words, in their order, which a change of layout keeps
function wordsOf(app: App, slide: Element): Element[] {
  const open = (el: Element) => !!app.pairing?.elements.get(el)?.open;
  const parts = [...slide.children].filter(open).flatMap((el) =>
    el.localName === 'div' && WRAPPER_CLASSES.some((c) => el.classList.contains(c)) ? [...el.children].filter(open) : [el]);
  return parts.filter((el) => kindOf(el.localName, [...el.classList]) === 'words');
}

// true when a text of the text column runs past its bottom, or into the footnote at its bottom
function overflows(textColumn: Element): boolean {
  const foot = textColumn.querySelector(':scope > .foot');
  const box = textColumn.getBoundingClientRect();
  const limit = foot && foot.getBoundingClientRect().height ? foot.getBoundingClientRect().top : box.bottom;
  return [...textColumn.children].some((el) => !el.matches('.foot, aside') && el.getBoundingClientRect().bottom > limit + 1);
}

// the texts moved into the text column of a split slide are shrunk to fit it, as PowerPoint shrinks the
// text of a placeholder: the paragraphs and the lists of the text column are set in the style Small,
// within the scale of the theme. a text that still does not fit keeps the mark of overflow.ts. a
// slide that is not shown is laid out for the measure, hidden, since reveal.js does not lay out a
// slide away from the current one
function fitPanel(app: App, slide: Element): void {
  const textColumn = slide.querySelector(':scope > .text-column');
  if (!textColumn || !(slide instanceof HTMLElement) || !laidOut(slide, () => overflows(textColumn))) return;
  for (const el of textColumn.querySelectorAll(':scope > p, :scope > ul, :scope > ol')) {
    if (!app.pairing?.elements.get(el)?.open) continue;
    const classes = app.doc.tagState(el).classes.filter((c) => c !== 'fragment');
    if (classes.length) continue;
    app.doc.setTag(el, { classes: { small: true } }, 'layout');
    fitted.add(el);
  }
}

// the elements of a slide with a place of the editor: a translate, a rotate, the width of a
// figure that the editor resizes, or the z-index and the position of a layer command. the translate
// of a shape or a line is its place on the slide, which a reset keeps
const SIZED = 'img, video, .qr, tycho-viewer';
const KEPT = '.shape, svg.line';
function placed(app: App, slide: Element): Element[] {
  return [...slide.querySelectorAll('*')].filter((el) => {
    if (!app.pairing?.elements.get(el)?.open) return false;
    const s = app.doc.tagState(el).style;
    return ('translate' in s && !el.matches(KEPT)) || 'rotate' in s || 'z-index' in s || 'position' in s || ('width' in s && el.matches(SIZED)) || (('width' in s || 'height' in s) && el.matches('.backdrop'));
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

// the sample slide of a layout, parsed from its text, for the tiles of this chooser and of the New
// Slide gallery of commands/slide.ts
export function sample(layout: NewLayout): Element {
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

// the chooser beside the menu item that opened it, as a submenu, else under its anchor, at the right
// of a row of the navigator, or else in the window
function placeChooser(dialog: HTMLElement, anchor: Element | null, item: DOMRect | null = null): void {
  const w = dialog.offsetWidth;
  const h = dialog.offsetHeight;
  const r = item ?? anchor?.getBoundingClientRect();
  let x = r ? r.left : (innerWidth - w) / 2;
  let y = r ? r.bottom + 6 : (innerHeight - h) / 3;
  if (item) {
    x = item.right + w + 12 <= innerWidth ? item.right + 4 : item.left - w - 4;
    y = item.top - 8;
  } else if (r && anchor?.closest('.beeson-edit-nav')) {
    x = r.right + 10;
    y = r.top - 8;
  } else if (r && y + h > innerHeight - 8) {
    x = r.left - w - 10;
    y = r.top;
  }
  dialog.style.left = `${Math.max(8, Math.min(x, innerWidth - w - 8))}px`;
  dialog.style.top = `${Math.max(8, Math.min(y, innerHeight - h - 8))}px`;
}

export function openChooser(app: App, anchor: Element | null, item: DOMRect | null = null): void {
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
  // slides of several layouts mark none of them, as Multiple Layouts in Keynote
  const now = new Set(targets(app).map(layoutOf)).size > 1 ? null : layoutOf(slide);
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
  placeChooser(dialog, dialog.anchor ?? app.current(), item);
  dialog.addEventListener('keydown', (ev) => {
    const i = tiles.findIndex((t) => t.tile === document.activeElement);
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4 };
    if (ev.key === 'Escape') closeChooser();
    else if ((ev.key === 'Enter' || ev.key === ' ') && i >= 0) tiles[i].tile.click();
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
        enabled: (a) => targets(a).length > 0,
        checked: (a) => {
          const list = targets(a);
          return list.length > 0 && list.every((s) => layoutOf(s) === layout);
        },
        undoable: true,
        undo: 'Change Layout',
        run: async (a) => void (await changeLayout(a, targets(a), layout)),
      }),
    ),
    {
      // arg is the button that opens the chooser, or the argument of a context menu. from a menu,
      // the tiles are opened beside the item, as the Layout gallery of the menu of a thumbnail in
      // PowerPoint
      id: 'slide.layoutChooser',
      label: 'Layout',
      menu: { bar: 'Slide', group: 'layout', order: 55 },
      context: ['slide', 'canvas'],
      enabled: (a) => targets(a).length > 0,
      run: (a, arg) => {
        const t = (arg as { target?: unknown } | undefined)?.target;
        openChooser(a, arg instanceof Element ? arg : t instanceof Element && t.closest('.beeson-edit-nav') ? t : null, a.menuItem);
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
            // the box of a backdrop resized by its grips is put back with its offset
            const box = el.matches('.backdrop');
            for (const k of ['translate', 'rotate', 'width', 'height', 'z-index', 'position']) if (k in has && (box || k !== 'width' || el.matches(SIZED)) && (box || k !== 'height') && (k !== 'translate' || !el.matches(KEPT))) style[k] = null;
            a.doc.setTag(el, { style }, 'reset slide');
          }
        }
        a.relayout();
      },
    },
  ];
  for (const d of defs) app.commands.define(d.undoable ? { ...d, run: (a, arg) => navOf(a).keeping(d.id, () => d.run(a, arg)) } : d);
  // the commands of the order, the groups, the locks, and the rotation, from the same install line
  // of main.ts
  installOrder(app);
}
