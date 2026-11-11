// a line or an arrow on a slide, as Insert > Line and Insert > Arrow of Keynote and PowerPoint. a
// line is an inline svg as large as the box of its line, at the upper left of the slide and placed
// by its translate, with one line element and the marker of its arrowheads. it is drawn by a drag
// from point to point, with Shift in steps of 45 degrees, selected by a press within NEAR px of it,
// moved as an element, and edited by its two end handles. its tone and its arrowheads are set with
// the commands of Format > Line, which the Line pane of inspector/line.ts runs. the rules of its
// look are in theme/beeson.css, so that a deck draws it without the editor

import type { App } from '../app.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { overlay, view, xy } from '../canvas/frames.ts';
import { frameOf, frameRect, linePoints, movablesOf, onCanvas, snapBoxOf, toSlide, type Frame } from '../canvas/hit.ts';
import { LAYOUT_GUIDES, snapMove, snapPoint, type Box, type Targets } from '../canvas/snap.ts';
import { locked, placeOf, record, scrollOf, standIns, writePlace, type Place } from '../canvas/drag.ts';
import { freshGroup } from './order.ts';

export type Point = { x: number; y: number };
export type Ends = { x1: number; y1: number; x2: number; y2: number };
export type Heads = 'none' | 'start' | 'end' | 'both';

// the tones of a line, with the token that each is drawn in
export const LINE_TONES: [string, string, string][] = [
  ['text', 'Text', '--text'],
  ['muted', 'Muted', '--muted'],
  ['accent', 'Accent', '--accent'],
  ['violet', 'Violet', '--violet'],
  ['blue', 'Blue', '--blue'],
  ['red', 'Red', '--red'],
];
export const HEADS: [Heads, string][] = [['none', 'No Arrowheads'], ['start', 'Arrowhead at Start'], ['end', 'Arrowhead at End'], ['both', 'Arrowheads at Both Ends']];

// the arrowhead in units of the stroke width. its tip is one unit past the end of the line, where
// the head is as wide as the stroke
const HEAD = 'M-4-2.5 1 0-4 2.5z';
// in screen px: the distance within which a press selects a line, the snap, and a click
const NEAR = 6;
const SNAP = 8;
const CLICK = 3;
// the length of a line inserted with a click, in slide px
const CLICKED = 320;

const CSS = `
.beeson-line-layer { position: fixed; inset: 0; z-index: 52; pointer-events: none; }
.beeson-line-layer [hidden] { display: none !important; }
.beeson-line-end { position: fixed; width: 11px; height: 11px; margin: -7px 0 0 -7px; border-radius: 50%; border: 1.5px solid var(--ed-select, #7048e8); background: #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25); pointer-events: auto; touch-action: none; cursor: crosshair; }
.beeson-line-end.locked { border-color: #8a8a8a; background: #d9d9d9; pointer-events: none; }
.beeson-line-draft { position: fixed; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; color: var(--ed-select, #7048e8); }
.beeson-line-draft line { stroke: currentColor; stroke-width: 2; }
.beeson-line-draft marker { overflow: visible; }
.beeson-line-draft path { fill: currentColor; }
html.beeson-line-only .beeson-overlay .beeson-frame, html.beeson-line-only .beeson-overlay .beeson-rotor, html.beeson-line-only .beeson-overlay .beeson-rotor-stem,
html.beeson-line-only .beeson-overlay .beeson-handle, html.beeson-line-only .beeson-overlay .beeson-grip { display: none !important; }
html.beeson-drawing-line .reveal, html.beeson-drawing-line .reveal *, html.beeson-drawing-line .beeson-edit-canvas { cursor: crosshair !important; }
`;

const round = (v: number) => Math.round(v);

// the box of the svg of a line in slide px, at least 1 px wide and high
export function boxOf(e: Ends): Box {
  const [x1, y1, x2, y2] = [e.x1, e.y1, e.x2, e.y2].map(round);
  return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.max(1, Math.abs(x2 - x1)), height: Math.max(1, Math.abs(y2 - y1)) };
}

const headAttrs = (heads: Heads, id: string): Record<'marker-start' | 'marker-end', string | null> => ({
  'marker-start': heads === 'start' || heads === 'both' ? `url(#${id})` : null,
  'marker-end': heads === 'end' || heads === 'both' ? `url(#${id})` : null,
});

// the ends of a line relative to the box of its svg
function local(e: Ends): Record<'x1' | 'y1' | 'x2' | 'y2', string> {
  const b = boxOf(e);
  return { x1: String(round(e.x1) - b.left), y1: String(round(e.y1) - b.top), x2: String(round(e.x2) - b.left), y2: String(round(e.y2) - b.top) };
}

// the text of a line between the ends in slide px, with its marker named id. the end tags are
// written, since source.ts pairs an element with the end tag of its name
export function lineText(e: Ends, o: { id: string; tone?: string; heads?: Heads }): string {
  const b = boxOf(e);
  const cls = o.tone && o.tone !== 'text' ? `line tone-${o.tone}` : 'line';
  const style = b.left || b.top ? ` style="translate: ${b.left}px ${b.top}px"` : '';
  const ends = Object.entries(local(e)).map(([k, v]) => ` ${k}="${v}"`).join('');
  const heads = Object.entries(headAttrs(o.heads ?? 'none', o.id)).map(([k, v]) => (v ? ` ${k}="${v}"` : '')).join('');
  return `<svg class="${cls}" width="${b.width}" height="${b.height}"${style}><defs><marker id="${o.id}" orient="auto-start-reverse"><path d="${HEAD}"></path></marker></defs><line${ends}${heads}></line></svg>`;
}

// the text with the arrowheads of each line pointed at the marker of its own svg. renameIds of
// model/doc.ts and its kin in the clipboard and slide commands rename the id of a copied marker,
// but not the url() that names it
export function fixHeads(text: string): string {
  return text.replace(/<svg\b[^>]*\bclass="(?:[^"]*\s)?line(?:\s[^"]*)?"[\s\S]*?<\/svg>/g, (svg) => {
    const id = /<marker\b[^>]*\sid="([^"]+)"/.exec(svg)?.[1];
    return id ? svg.replace(/url\(#[^)]*\)/g, `url(#${id})`) : svg;
  });
}

// the end of a line from the point from toward to, at a multiple of 45 degrees and at the length of
// the projection of to on that ray
export function stepped(from: Point, to: Point): Point {
  const dx = to.x - from.x, dy = to.y - from.y;
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const len = dx * Math.cos(a) + dy * Math.sin(a);
  return { x: from.x + len * Math.cos(a), y: from.y + len * Math.sin(a) };
}

// the distance of p from the segment from a to b
export function distance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export const isLine = (el: Element): boolean => el.matches('.reveal .slides section svg.line');

// the ends of the line of svg in slide px
export function endsOf(svg: Element): Ends {
  const line = svg.querySelector('line');
  const t = placeOf(svg).translate ?? { x: 0, y: 0 };
  const n = (a: string) => parseFloat(line?.getAttribute(a) ?? '') || 0;
  return { x1: t.x + n('x1'), y1: t.y + n('y1'), x2: t.x + n('x2'), y2: t.y + n('y2') };
}

export function headsOf(svg: Element): Heads {
  const line = svg.querySelector('line');
  const start = !!line?.hasAttribute('marker-start');
  const end = !!line?.hasAttribute('marker-end');
  return start && end ? 'both' : start ? 'start' : end ? 'end' : 'none';
}

export function toneOf(svg: Element): string {
  return LINE_TONES.find(([t]) => svg.classList.contains(`tone-${t}`))?.[0] ?? 'text';
}

// the selected lines that are paired with the file
export function selectedLines(app: App): Element[] {
  return app.selection.elements().filter((el) => el.isConnected && isLine(el) && !!app.pairing?.elements.get(el)?.open);
}

const screenOf = (f: Frame, p: Point): Point => ({ x: f.left + p.x * f.scale, y: f.top + p.y * f.scale });
const slideOf = (f: Frame, p: Point): Point => ({ x: (p.x - f.left) / f.scale, y: (p.y - f.top) / f.scale });

// svg set to the ends on the page only, while one of its ends is dragged
function showEnds(svg: Element, e: Ends): void {
  const b = boxOf(e);
  svg.setAttribute('width', String(b.width));
  svg.setAttribute('height', String(b.height));
  (svg as SVGElement).style.translate = b.left || b.top ? `${b.left}px ${b.top}px` : '';
  const line = svg.querySelector('line');
  for (const [k, v] of Object.entries(local(e))) line?.setAttribute(k, v);
}

type Press =
  | { kind: 'end'; svg: Element; which: 1 | 2; from: Ends; off: Point; x: number; y: number; moved: boolean }
  | { kind: 'move'; svg: Element; els: Element[]; places: Map<Element, Place>; base: Box; x: number; y: number; scroll: { x: number; y: number }; moved: boolean; click: (() => void) | null }
  | { kind: 'draw'; heads: Heads; start: Point; end: Point; x: number; y: number; moved: boolean };

type Grip = HTMLElement & { line?: Element };

export function install(app: App): void {
  injectStyle('line', CSS);
  const c = app.commands;
  const frames = overlay();
  const mac = () => app.platform === 'mac';
  // the modifiers of drag.ts: a move without the snap, and a press that adds to the selection
  const freeMove = (ev: MouseEvent) => (mac() ? ev.metaKey : ev.altKey);
  const commandHeld = (ev: MouseEvent) => (mac() ? ev.metaKey : ev.ctrlKey);
  const copyHeld = (ev: MouseEvent) => (mac() ? ev.altKey : ev.ctrlKey);
  // the originals left in place while a move with the copy key is dragged, as drag.ts shows them
  const ghosts = standIns();
  const ready = (a: App) => !!a.pairing?.root && !!a.current() && a.region() !== 'dialog';
  const root = document.documentElement;

  const insert = app.doc.insert.bind(app.doc);
  app.doc.insert = (texts, ...rest) => insert(typeof texts === 'string' ? fixHeads(texts) : texts.map(fixHeads), ...rest);

  const layer = make('div', 'beeson-line-layer');
  document.body.append(layer);
  const grips: Grip[] = [];
  const draft = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  draft.classList.add('beeson-line-draft');
  draft.innerHTML = `<defs><marker id="beeson-line-draft-head" orient="auto-start-reverse"><path d="${HEAD}"></path></marker></defs><line></line>`;
  draft.setAttribute('hidden', '');
  layer.append(draft);

  let press: Press | null = null;
  // the arrowheads of the line that the next drag on the canvas draws, or null
  let drawing: Heads | null = null;

  const targets = (skip: Element[]): Targets => {
    const f = frameOf(app);
    const slides = app.slides() as HTMLElement;
    return {
      boxes: movablesOf(app).filter((o) => !skip.includes(o)).map((o) => toSlide(f, frameRect(o))).filter((b) => b.width > 0 && b.height > 0),
      points: linePoints(app, skip),
      slide: { width: slides.offsetWidth || 1920, height: slides.offsetHeight || 1080 },
      layout: LAYOUT_GUIDES,
    };
  };

  // the point of ev in slide px, snapped to the lines of the slide, or with Shift and a fixed end
  // start in steps of 45 degrees from it
  // off is the offset of the pointer from the point that it moves, in slide px
  const pointAt = (ev: PointerEvent, start: Point | null, skip: Element[], off: Point = { x: 0, y: 0 }): Point => {
    const f = frameOf(app);
    const at = slideOf(f, { x: ev.clientX, y: ev.clientY });
    const p = { x: at.x - off.x, y: at.y - off.y };
    if (start && ev.shiftKey) return stepped(start, p);
    if (freeMove(ev)) return p;
    const s = snapPoint(p, targets(skip), SNAP / f.scale);
    view.guides = s.guides;
    return { x: p.x + s.dx, y: p.y + s.dy };
  };

  // the length and the angle of a line from its first end, counterclockwise as in Keynote
  const readout = (e: Ends, ev: PointerEvent) => {
    const len = Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
    const deg = ((round((-Math.atan2(e.y2 - e.y1, e.x2 - e.x1) * 180) / Math.PI) % 360) + 360) % 360;
    view.readout = { text: `${round(len)} px  ${deg}°`, x: ev.clientX + 14, y: ev.clientY + 14, at: 'pointer' };
  };

  // the line nearest to the point x, y in screen px within NEAR, the last in the file on a tie
  const lineAt = (x: number, y: number): Element | null => {
    const slide = app.current();
    if (!slide) return null;
    const f = frameOf(app);
    let best: Element | null = null;
    let near = NEAR;
    for (const svg of slide.querySelectorAll('svg.line')) {
      if (!isLine(svg) || !app.pairing?.elements.get(svg)?.open || !svg.getClientRects().length) continue;
      const e = endsOf(svg);
      const d = distance({ x, y }, screenOf(f, { x: e.x1, y: e.y1 }), screenOf(f, { x: e.x2, y: e.y2 }));
      if (d <= near) {
        near = d;
        best = svg;
      }
    }
    return best;
  };

  // the end handles of the selected lines. the frames of drag.ts are hidden while only lines are
  // selected, since the box of a line is not what a user moves or resizes
  const draw = () => {
    const lines = selectedLines(app);
    const only = lines.length > 0 && lines.length === app.selection.elements().length;
    root.classList.toggle('beeson-line-only', only);
    const f = frameOf(app);
    const v = app.stage?.viewport;
    if (v) layer.style.clipPath = `inset(${v.top}px ${innerWidth - v.right}px ${innerHeight - v.bottom}px ${v.left}px)`;
    const shown = only && !(press?.kind === 'move' && press.moved);
    const ends = shown
      ? lines.flatMap((svg) => {
          const e = endsOf(svg);
          return [
            { svg, which: 1, p: screenOf(f, { x: e.x1, y: e.y1 }) },
            { svg, which: 2, p: screenOf(f, { x: e.x2, y: e.y2 }) },
          ];
        })
      : [];
    while (grips.length < ends.length) {
      const g: Grip = make('div', 'beeson-line-end');
      layer.append(g);
      grips.push(g);
    }
    grips.forEach((g, i) => {
      const end = ends[i];
      g.hidden = !end;
      if (!end) return;
      g.style.left = `${end.p.x}px`;
      g.style.top = `${end.p.y}px`;
      g.dataset.end = String(end.which);
      g.classList.toggle('locked', locked(end.svg));
      g.line = end.svg;
    });
  };

  const showDraft = (from: Point, to: Point, heads: Heads) => {
    const f = frameOf(app);
    const a = screenOf(f, from), b = screenOf(f, to);
    const line = draft.querySelector('line') as SVGLineElement;
    for (const [k, v] of Object.entries({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })) line.setAttribute(k, String(v));
    for (const [k, v] of Object.entries(headAttrs(heads, 'beeson-line-draft-head'))) {
      if (v) line.setAttribute(k, v);
      else line.removeAttribute(k);
    }
    draft.removeAttribute('hidden');
  };

  const endDrawing = () => {
    drawing = null;
    root.classList.remove('beeson-drawing-line');
    draft.setAttribute('hidden', '');
  };

  // a new line between the ends in slide px, on the current slide before its notes, selected
  const add = async (e: Ends, heads: Heads): Promise<Element | null> => {
    const slide = app.current();
    if (!slide) return null;
    const id = app.doc.uniqueId('line');
    const before = slide.querySelector(':scope > aside.notes');
    const label = heads === 'none' ? 'Insert Line' : 'Insert Arrow';
    const [svg] = await app.history.selecting(label, async () => {
      const made = await app.doc.insert(lineText(e, { id, heads }), slide, before, label);
      app.selection.set('elements', made);
      return made;
    });
    app.invalidate('content', 'selection');
    return svg;
  };

  // the ends of a line as one entry of the history, written into the start tags of its svg and line
  const setEnds = (svg: Element, e: Ends) =>
    app.history.transact('Move Line End', () => {
      const b = boxOf(e);
      const line = svg.querySelector('line') as Element;
      app.doc.setTag(svg, { attrs: { width: String(b.width), height: String(b.height) }, translate: b.left || b.top ? { x: b.left, y: b.top } : null }, 'line');
      app.doc.setTag(line, { attrs: local(e) }, 'line');
      app.invalidate('content');
    });

  // a press is taken before the capture listener of drag.ts on document, which does not hit-test
  // a line, since the svg of a line does not take the pointer
  const onDown = (ev: PointerEvent) => {
    if (ev.button !== 0 || press || app.state !== 'loaded') return;
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    const at = { x: ev.clientX, y: ev.clientY };
    if (drawing) {
      if (!onCanvas(target, app, at)) return;
      ev.preventDefault();
      ev.stopPropagation();
      const start = pointAt(ev, null, []);
      press = { kind: 'draw', heads: drawing, start, end: start, x: at.x, y: at.y, moved: false };
      return;
    }
    const grip = target.closest('.beeson-line-end') as Grip | null;
    if (grip?.line) {
      ev.preventDefault();
      ev.stopPropagation();
      // the end keeps its offset from the pointer, which a grip past an arrowhead is drawn at
      const which = grip.dataset.end === '1' ? 1 : 2;
      const from = endsOf(grip.line);
      const p = slideOf(frameOf(app), at);
      const off = which === 1 ? { x: p.x - from.x1, y: p.y - from.y1 } : { x: p.x - from.x2, y: p.y - from.y2 };
      press = { kind: 'end', svg: grip.line, which, from, off, x: at.x, y: at.y, moved: false };
      return;
    }
    if (!onCanvas(target, app, at) || target.closest('[contenteditable="true"]:focus')) return;
    const svg = lineAt(at.x, at.y);
    if (!svg) return;
    ev.preventDefault();
    ev.stopPropagation();
    const host = app.hostOf(document.activeElement);
    if (host) (host as HTMLElement).blur();
    const sel = app.selection;
    let click: (() => void) | null = null;
    if (ev.shiftKey || commandHeld(ev)) {
      if (sel.has(svg)) click = () => sel.toggle(svg);
      else sel.add(svg);
    } else if (sel.has(svg)) {
      if (sel.elements().length > 1) click = () => sel.set('elements', [svg]);
    } else sel.set('elements', [svg]);
    const els = sel.elements().filter((e) => !sel.elements().some((o) => o !== e && o.contains(e)) && !locked(e));
    const boxes = els.map((e) => snapBoxOf(app, e));
    const left = Math.min(...boxes.map((b) => b.left)), top = Math.min(...boxes.map((b) => b.top));
    const base = { left, top, width: Math.max(...boxes.map((b) => b.left + b.width)) - left, height: Math.max(...boxes.map((b) => b.top + b.height)) - top };
    press = { kind: 'move', svg, els, places: new Map(els.map((e) => [e, placeOf(e)])), base, x: at.x, y: at.y, scroll: scrollOf(app), moved: false, click };
    app.invalidate('selection');
  };

  const onMove = (ev: PointerEvent) => {
    const p = press;
    if (!p) return;
    ev.stopPropagation();
    if (!p.moved && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < CLICK) return;
    p.moved = true;
    ev.preventDefault();
    const f = frameOf(app);
    view.guides = [];
    app.stage?.edgeScroll(ev, () => press === p && onMove(ev));
    if (p.kind === 'draw') {
      p.end = pointAt(ev, p.start, []);
      showDraft(p.start, p.end, p.heads);
      readout({ x1: p.start.x, y1: p.start.y, x2: p.end.x, y2: p.end.y }, ev);
    } else if (p.kind === 'end') {
      if (p.svg.isConnected && locked(p.svg)) return;
      const fixed = p.which === 1 ? { x: p.from.x2, y: p.from.y2 } : { x: p.from.x1, y: p.from.y1 };
      const to = pointAt(ev, fixed, [p.svg], p.off);
      const e = p.which === 1 ? { x1: to.x, y1: to.y, x2: fixed.x, y2: fixed.y } : { x1: fixed.x, y1: fixed.y, x2: to.x, y2: to.y };
      showEnds(p.svg, e);
      readout({ x1: fixed.x, y1: fixed.y, x2: to.x, y2: to.y }, ev);
    } else {
      if (!p.els.length) return;
      const s = scrollOf(app);
      let dx = (ev.clientX - p.x + s.x - p.scroll.x) / f.scale, dy = (ev.clientY - p.y + s.y - p.scroll.y) / f.scale;
      const lock = ev.shiftKey ? (Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y') : null;
      if (lock === 'x') dy = 0;
      if (lock === 'y') dx = 0;
      const snap = freeMove(ev) ? null : snapMove({ ...p.base, left: p.base.left + dx, top: p.base.top + dy }, targets(p.els), SNAP / f.scale, { x: lock !== 'y', y: lock !== 'x' });
      dx += snap?.dx ?? 0;
      dy += snap?.dy ?? 0;
      for (const el of p.els) {
        const from = p.places.get(el) as Place;
        (el as HTMLElement).style.translate = `${round((from.translate?.x ?? 0) + dx)}px ${round((from.translate?.y ?? 0) + dy)}px`;
      }
      view.guides = snap?.guides ?? [];
      view.spacing = snap?.spacing ?? [];
      // the upper left corner of the line on the slide, as the readout of a move of drag.ts gives it
      ghosts.show({ els: p.els, from: p.places }, copyHeld(ev));
      const c = snapBoxOf(app, p.svg);
      view.readout = { text: `${ghosts.shown() ? 'Copy  ' : ''}${xy(c.left, c.top)}`, x: ev.clientX + 14, y: ev.clientY + 18, at: 'pointer' };
    }
    root.classList.add('beeson-dragging');
    frames.draw();
    draw();
  };

  // the end of a press: ev is null for a cancel, which puts everything back
  const finish = async (ev: PointerEvent | null) => {
    const p = press;
    if (!p) return;
    press = null;
    app.stage?.edgeScroll(null);
    view.guides = [];
    view.spacing = [];
    view.readout = null;
    root.classList.remove('beeson-dragging');
    const copying = ghosts.shown();
    if (p.kind === 'move') ghosts.show({ els: p.els, from: p.places }, false);
    frames.draw();
    if (p.kind === 'draw') {
      endDrawing();
      if (!ev) return;
      const end = p.moved ? p.end : { x: p.start.x + CLICKED, y: p.start.y };
      await add({ x1: p.start.x, y1: p.start.y, x2: end.x, y2: end.y }, p.heads);
    } else if (p.kind === 'end') {
      const e = endsOf(p.svg);
      showEnds(p.svg, p.from);
      if (p.moved && ev) await setEnds(p.svg, e);
    } else if (!p.moved || !ev || (copying && copyHeld(ev))) {
      const to = p.els.map((el) => placeOf(el).translate);
      for (const el of p.els) {
        const from = p.places.get(el) as Place;
        (el as HTMLElement).style.translate = from.translate ? `${from.translate.x}px ${from.translate.y}px` : '';
      }
      if (!p.moved || !ev) p.click?.();
      // a copy of each element is written after it at the place where it was dropped, and the
      // copies of a group are a new group
      else await app.history.selecting('Duplicate', async () => {
        const groups = new Map<string, string>();
        const copies: Element[] = [];
        for (const [i, el] of p.els.entries()) {
          const copy = await app.doc.duplicate(el);
          const g = copy.getAttribute('data-group');
          if (g && !groups.has(g)) groups.set(g, freshGroup(app));
          const t = to[i];
          app.doc.setTag(copy, { translate: t ? { x: round(t.x), y: round(t.y) } : null, ...(g ? { attrs: { 'data-group': groups.get(g)! } } : {}) }, 'move');
          copies.push(copy);
        }
        app.selection.set('elements', copies);
      });
    } else {
      const changes = p.els.map((el) => {
        const to = placeOf(el);
        writePlace(app, el, to);
        return { el, from: p.places.get(el) as Place, to };
      });
      record(app, 'move', changes);
      app.invalidate('content');
    }
    draw();
  };

  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', (ev) => void finish(ev).catch((e) => app.fail(e)), true);
  window.addEventListener('pointercancel', () => void finish(null), true);
  window.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape' || (!drawing && !press)) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (press) void finish(null);
    endDrawing();
  }, true);
  app.listen('resize', draw);
  app.selection.listen(draw);
  app.onRefresh(['content', 'selection', 'slide', 'layout'], draw);

  // with an arg { from, to } in slide px the line is inserted at once, e.g. by a test
  const startDrawing = (heads: Heads) => async (a: App, arg?: unknown) => {
    const at = arg as { from?: Point; to?: Point } | undefined;
    if (at?.from && at.to) {
      await add({ x1: at.from.x, y1: at.from.y, x2: at.to.x, y2: at.to.y }, heads);
      return;
    }
    const host = a.hostOf(document.activeElement);
    if (host) (host as HTMLElement).blur();
    drawing = heads;
    root.classList.add('beeson-drawing-line');
  };

  const insertMenu = (order: number) => ({ bar: 'Insert', group: 'element', order });
  // the Shape button of the toolbar, whose main part draws a line
  const shape = (order: number) => ({ group: 'insert', order, icon: 'shape', label: 'Shape', split: 'Shape' });
  c.define({ id: 'insert.line', label: 'Line', menu: insertMenu(30), toolbar: shape(23), enabled: ready, checked: () => (drawing === 'none' ? true : null), run: startDrawing('none') });
  c.define({ id: 'insert.arrow', label: 'Arrow', menu: insertMenu(31), toolbar: shape(23.1), enabled: ready, checked: () => (drawing === 'end' ? true : null), run: startDrawing('end') });

  const some = (a: App) => ready(a) && selectedLines(a).length > 0;
  const lineMenu = (group: string, order: number) => ({ bar: 'Format', group, order, submenu: 'Line' });
  LINE_TONES.forEach(([tone, label], i) => {
    c.define({
      id: `line.tone.${tone}`,
      label,
      menu: lineMenu('line-tone', 80 + i),
      enabled: some,
      checked: (a) => some(a) && selectedLines(a).every((svg) => toneOf(svg) === tone),
      undoable: true,
      undo: 'Line Color',
      run: (a) => {
        const classes: Record<string, boolean> = {};
        for (const [t] of LINE_TONES) if (t !== 'text') classes[`tone-${t}`] = t === tone;
        for (const svg of selectedLines(a)) a.doc.setTag(svg, { classes }, 'line tone');
        a.invalidate('content');
      },
    });
  });
  HEADS.forEach(([heads, label], i) => {
    c.define({
      id: `line.heads.${heads}`,
      label,
      menu: lineMenu('line-heads', 90 + i),
      enabled: some,
      checked: (a) => some(a) && selectedLines(a).every((svg) => headsOf(svg) === heads),
      undoable: true,
      undo: 'Arrowheads',
      run: (a) => {
        for (const svg of selectedLines(a)) {
          const line = svg.querySelector('line');
          const id = svg.querySelector('marker')?.id;
          if (line && id) a.doc.setTag(line, { attrs: headAttrs(heads, id) }, 'arrowheads');
        }
        a.invalidate('content');
      },
    });
  });
}
