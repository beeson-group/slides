// a line or an arrow on a slide, as Insert > Line and Insert > Arrow of Keynote and PowerPoint. a
// line is an inline svg as large as the box of its stroke, at the upper left of the slide and placed
// by its translate, with one line element, or the path of a curve or an elbow of canvas/stroke.ts,
// and the marker of its arrowheads. it is drawn by a drag from point to point, with Shift in steps
// of 45 degrees, selected by a press near its stroke, moved as an element, and edited by its two
// end handles and the grip of its bend. its tone, arrowheads, kind, weight, and dash are set with
// the commands of Format > Line, which the Line pane of inspector/line.ts runs. the rules of its
// look are in theme/beeson.css, so that a deck draws it without the editor

import type { App } from '../app.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { setItemIcon } from '../ui/icons.ts';
import { overlay, view, xy } from '../canvas/frames.ts';
import { frameOf, frameRect, lineAt, linePoints, movablesOf, onCanvas, snapBoxOf, strokeOf, toSlide, type Frame } from '../canvas/hit.ts';
import { bendTo, gripOf, parseStroke, rebend, strokeText, withKind, type Ends, type Kind, type Point, type Stroke } from '../canvas/stroke.ts';
import { LAYOUT_GUIDES, snapMove, snapPoint, type Box, type Targets } from '../canvas/snap.ts';
import { angleOf, locked, placeOf, record, scrollOf, standIns, writePlace, type Place } from '../canvas/drag.ts';
import { freshGroup } from './order.ts';
import { copiedGroups } from '../model/groups.ts';
import { glueAt, install as installGlue, recorded, relink, setEnd, showTarget, type End, type Glue } from '../model/glue.ts';

export { distance } from '../canvas/stroke.ts';
export type { Ends, Point };
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
export const KINDS: [Kind, string][] = [['straight', 'Straight'], ['curve', 'Curved'], ['elbow', 'Elbow']];
// the weights in px, each the class weight-N on the svg apart from the 3 px of the theme
export const WEIGHTS = [2, 3, 6, 8];

// the arrowhead in units of the stroke width. its tip is one unit past the end of the line, where
// the head is as wide as the stroke
const HEAD = 'M-4-2.5 1 0-4 2.5z';
// in screen px: the snap and a click. a press selects a line within 6 px of it, in lineAt of
// canvas/hit.ts
const SNAP = 8;
const CLICK = 3;
// the length of a line inserted with a click, in slide px
const CLICKED = 320;

const CSS = `
.beeson-line-layer { position: fixed; inset: 0; z-index: 52; pointer-events: none; }
.beeson-line-layer [hidden] { display: none !important; }
.beeson-line-end { position: fixed; width: 11px; height: 11px; margin: -7px 0 0 -7px; border-radius: 50%; border: 1.5px solid var(--ed-select, #7048e8); background: #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25); pointer-events: auto; touch-action: none; cursor: crosshair; }
.beeson-line-end.bend { background: var(--ed-select, #7048e8); border-color: #fff; }
.beeson-line-end.locked { border-color: #8a8a8a; background: #d9d9d9; pointer-events: none; }
.beeson-line-draft { position: fixed; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; color: var(--ed-select, #7048e8); }
.beeson-line-draft > path { stroke: currentColor; stroke-width: 2; fill: none; }
.beeson-line-draft marker { overflow: visible; }
.beeson-line-draft marker path { fill: currentColor; }
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

const strokeFrom = (e: Ends | Stroke): Stroke => ('kind' in e ? e : withKind(e, 'straight'));

// the text of the stroke s with the arrowheads at the marker id, i.e. a line or a path element. the
// end tag is written, since source.ts pairs an element with the end tag of its name
function childText(s: Stroke, heads: Heads, id: string): string {
  const t = strokeText(s);
  const attrs = { ...t.attrs, ...headAttrs(heads, id) };
  return `<${t.tag}${Object.entries(attrs).map(([k, v]) => (v ? ` ${k}="${v}"` : '')).join('')}></${t.tag}>`;
}

// the text of a line between the ends in slide px, or of a curve or an elbow, with its marker
// named id
export function lineText(e: Ends | Stroke, o: { id: string; tone?: string; heads?: Heads }): string {
  const s = strokeFrom(e);
  const b = strokeText(s).box;
  const cls = o.tone && o.tone !== 'text' ? `line tone-${o.tone}` : 'line';
  const style = b.left || b.top ? ` style="translate: ${b.left}px ${b.top}px"` : '';
  return `<svg class="${cls}" width="${b.width}" height="${b.height}"${style}><defs><marker id="${o.id}" orient="auto-start-reverse"><path d="${HEAD}"></path></marker></defs>${childText(s, o.heads ?? 'none', o.id)}</svg>`;
}

// the text with the arrowheads of each line pointed at the marker of its own svg. Doc.freshIds of
// model/doc.ts, which the clipboard and slide commands call, renames the id of a copied marker, but
// not the url() that names it
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

export const isLine = (el: Element): boolean => el.matches('.reveal .slides section svg.line');

// the stroke of svg in slide px, or null for a path that the editor does not write
export const strokeAt = (svg: Element): Stroke | null => parseStroke(strokeOf(svg), placeOf(svg).translate ?? { x: 0, y: 0 });

// the ends of the stroke of svg in slide px
export function endsOf(svg: Element): Ends {
  const s = strokeAt(svg);
  return s ? { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 } : { x1: 0, y1: 0, x2: 0, y2: 0 };
}

export const kindOf = (svg: Element): Kind | null => strokeAt(svg)?.kind ?? null;
export const weightOf = (svg: Element): number => WEIGHTS.find((w) => svg.classList.contains(`weight-${w}`)) ?? 3;

export function headsOf(svg: Element): Heads {
  const line = strokeOf(svg);
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

// svg set to the stroke on the page only, while one of its ends or its bend is dragged
function showStroke(svg: Element, s: Stroke): void {
  const t = strokeText(s);
  const b = t.box;
  svg.setAttribute('width', String(b.width));
  svg.setAttribute('height', String(b.height));
  (svg as SVGElement).style.translate = b.left || b.top ? `${b.left}px ${b.top}px` : '';
  const child = strokeOf(svg);
  for (const [k, v] of Object.entries(t.attrs)) child?.setAttribute(k, v);
}

type Drawing = { heads: Heads; kind: Kind };

// glue is the glue of a dragged end at its last move, and from and to that of the ends of a drawn line
type Grab = { svg: Element; which: 1 | 2; from: Stroke; off: Point; x: number; y: number; moved: boolean; glue?: Glue | null };
type Press =
  | ({ kind: 'end' } & Grab)
  | ({ kind: 'bend' } & Grab)
  | { kind: 'move'; svg: Element; els: Element[]; places: Map<Element, Place>; base: Box; x: number; y: number; scroll: { x: number; y: number }; moved: boolean; click: (() => void) | null }
  | { kind: 'draw'; draw: Drawing; start: Point; end: Point; x: number; y: number; moved: boolean; from: Glue | null; to: Glue | null };

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
  installGlue(app);
  // the glue of an end at p, without the free key, with its element outlined
  const glueOf = (ev: PointerEvent, p: Point, skip: Element[] = []) => {
    const g = freeMove(ev) ? null : glueAt(app, p, skip);
    showTarget(app, g?.glue.els ?? null);
    return g;
  };

  const insert = app.doc.insert.bind(app.doc);
  app.doc.insert = (texts, ...rest) => insert(typeof texts === 'string' ? fixHeads(texts) : texts.map(fixHeads), ...rest);

  const layer = make('div', 'beeson-line-layer');
  document.body.append(layer);
  const grips: Grip[] = [];
  const draft = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  draft.classList.add('beeson-line-draft');
  draft.innerHTML = `<defs><marker id="beeson-line-draft-head" orient="auto-start-reverse"><path d="${HEAD}"></path></marker></defs><path></path>`;
  draft.setAttribute('hidden', '');
  layer.append(draft);

  let press: Press | null = null;
  // the arrowheads and the kind of the line that the next drag on the canvas draws, or null
  let drawing: Drawing | null = null;

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
          const s = strokeAt(svg);
          if (!s) return [];
          const bend = gripOf(s);
          return [
            { svg, which: '1', p: screenOf(f, { x: s.x1, y: s.y1 }) },
            { svg, which: '2', p: screenOf(f, { x: s.x2, y: s.y2 }) },
            ...(bend ? [{ svg, which: 'bend', p: screenOf(f, bend) }] : []),
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
      g.dataset.end = end.which;
      g.classList.toggle('bend', end.which === 'bend');
      g.classList.toggle('locked', locked(end.svg));
      g.line = end.svg;
    });
  };

  // the stroke of the kind from a to b on the screen, whose text is in whole screen px
  const showDraft = (from: Point, to: Point, d: Drawing) => {
    const f = frameOf(app);
    const a = screenOf(f, from), b = screenOf(f, to);
    const t = strokeText(withKind({ x1: a.x, y1: a.y, x2: b.x, y2: b.y }, d.kind));
    const line = draft.querySelector(':scope > path') as SVGPathElement;
    const box = t.box;
    const at = (k: string, v: string) => String(Number(v) + (k === 'x1' || k === 'x2' ? box.left : box.top));
    line.setAttribute('d', t.tag === 'path' ? t.attrs.d : `M${at('x1', t.attrs.x1)} ${at('y1', t.attrs.y1)} L${at('x2', t.attrs.x2)} ${at('y2', t.attrs.y2)}`);
    line.setAttribute('transform', t.tag === 'path' ? `translate(${box.left} ${box.top})` : '');
    for (const [k, v] of Object.entries(headAttrs(d.heads, 'beeson-line-draft-head'))) {
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

  // a new line of the kind between the ends in slide px, on the current slide before its notes,
  // selected
  const add = async (e: Ends, d: Drawing, glue: Partial<Record<End, Glue | null>> = {}): Promise<Element | null> => {
    const slide = app.current();
    if (!slide) return null;
    const id = app.doc.uniqueId('line');
    const before = slide.querySelector(':scope > aside.notes');
    const label = d.kind === 'curve' ? 'Insert Curved Arrow' : d.kind === 'elbow' ? 'Insert Elbow Arrow' : d.heads === 'none' ? 'Insert Line' : 'Insert Arrow';
    const [svg] = await app.history.selecting(label, async () => {
      const made = await app.doc.insert(lineText(withKind(e, d.kind), { id, heads: d.heads }), slide, before, label);
      for (const end of ['from', 'to'] as End[]) if (glue[end]) setEnd(recorded(app), made[0], end, glue[end] as Glue);
      app.selection.set('elements', made);
      return made;
    });
    app.invalidate('content', 'selection');
    return svg;
  };

  // the stroke of a line as one entry of the history, written into the start tags of its svg and
  // its line or path, with the glue of a dragged end
  const setStroke = (svg: Element, s: Stroke, label: string, glue?: { end: End; to: Glue | null }) =>
    app.history.transact(label, () => {
      const t = strokeText(s);
      const b = t.box;
      app.doc.setTag(svg, { attrs: { width: String(b.width), height: String(b.height) }, translate: b.left || b.top ? { x: b.left, y: b.top } : null }, 'line');
      app.doc.setTag(strokeOf(svg) as Element, { attrs: t.attrs }, 'line');
      if (glue) setEnd(recorded(app), svg, glue.end, glue.to);
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
      const point = pointAt(ev, null, []);
      const g = glueOf(ev, point);
      const start = g?.at ?? point;
      press = { kind: 'draw', draw: drawing, start, end: start, x: at.x, y: at.y, moved: false, from: g?.glue ?? null, to: null };
      return;
    }
    const grip = target.closest('.beeson-line-end') as Grip | null;
    const from = grip?.line ? strokeAt(grip.line) : null;
    if (grip?.line && from) {
      ev.preventDefault();
      ev.stopPropagation();
      // the end or the bend keeps its offset from the pointer, which a grip past an arrowhead is
      // drawn at
      const bend = grip.dataset.end === 'bend';
      const which = grip.dataset.end === '1' ? 1 : 2;
      const p = slideOf(frameOf(app), at);
      const g = bend ? (gripOf(from) as Point) : which === 1 ? { x: from.x1, y: from.y1 } : { x: from.x2, y: from.y2 };
      const grab = { svg: grip.line, which: which as 1 | 2, from, off: { x: p.x - g.x, y: p.y - g.y }, x: at.x, y: at.y, moved: false };
      press = bend ? { kind: 'bend', ...grab } : { kind: 'end', ...grab };
      return;
    }
    if (!onCanvas(target, app, at) || target.closest('[contenteditable="true"]:focus')) return;
    const svg = lineAt(app, at.x, at.y);
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
      const g = glueOf(ev, pointAt(ev, p.start, []));
      p.end = g?.at ?? pointAt(ev, p.start, []);
      p.to = g?.glue ?? null;
      showDraft(p.start, p.end, p.draw);
      readout({ x1: p.start.x, y1: p.start.y, x2: p.end.x, y2: p.end.y }, ev);
    } else if (p.kind === 'end') {
      if (p.svg.isConnected && locked(p.svg)) return;
      const fixed = p.which === 1 ? { x: p.from.x2, y: p.from.y2 } : { x: p.from.x1, y: p.from.y1 };
      const g = glueOf(ev, pointAt(ev, fixed, [p.svg], p.off));
      const to = g?.at ?? pointAt(ev, fixed, [p.svg], p.off);
      p.glue = g?.glue ?? null;
      const e = p.which === 1 ? { x1: to.x, y1: to.y, x2: fixed.x, y2: fixed.y } : { x1: fixed.x, y1: fixed.y, x2: to.x, y2: to.y };
      showStroke(p.svg, rebend(p.from, e));
      readout({ x1: fixed.x, y1: fixed.y, x2: to.x, y2: to.y }, ev);
    } else if (p.kind === 'bend') {
      if (p.svg.isConnected && locked(p.svg)) return;
      // with Shift the grip of a curve stays on the perpendicular bisector of its chord, which gives
      // a symmetric arc. the middle segment of an elbow lands on the line of an end within SNAP
      const s = p.from;
      let to = pointAt(ev, null, [p.svg], p.off);
      if (ev.shiftKey && s.kind === 'curve') {
        const m = { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 }, n = { x: s.y1 - s.y2, y: s.x2 - s.x1 };
        const k = ((to.x - m.x) * n.x + (to.y - m.y) * n.y) / (n.x * n.x + n.y * n.y || 1);
        to = { x: m.x + k * n.x, y: m.y + k * n.y };
      }
      showStroke(p.svg, bendTo(s, to, freeMove(ev) ? 0 : SNAP / f.scale));
      view.readout = null;
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
    showTarget(app, null);
    const copying = ghosts.shown();
    if (p.kind === 'move') ghosts.show({ els: p.els, from: p.places }, false);
    frames.draw();
    if (p.kind === 'draw') {
      endDrawing();
      if (!ev) return;
      const end = p.moved ? p.end : { x: p.start.x + CLICKED, y: p.start.y };
      await add({ x1: p.start.x, y1: p.start.y, x2: end.x, y2: end.y }, p.draw, { from: p.from, to: p.moved ? p.to : null });
    } else if (p.kind === 'end' || p.kind === 'bend') {
      const s = strokeAt(p.svg);
      showStroke(p.svg, p.from);
      const glue = p.kind === 'end' ? { end: (p.which === 1 ? 'from' : 'to') as End, to: p.glue ?? null } : undefined;
      if (p.moved && ev && s) await setStroke(p.svg, s, p.kind === 'bend' ? 'Bend Line' : 'Move Line End', glue);
    } else if (!p.moved || !ev || (copying && copyHeld(ev))) {
      const to = p.els.map((el) => placeOf(el).translate);
      for (const el of p.els) {
        const from = p.places.get(el) as Place;
        (el as HTMLElement).style.translate = from.translate ? `${from.translate.x}px ${from.translate.y}px` : '';
      }
      // a cancel keeps the selection of the press
      if (!p.moved && ev) p.click?.();
      // a copy of each element is written after it at the place where it was dropped, and the
      // copies of a group are a new group
      else if (ev) await app.history.selecting('Duplicate', async () => {
        const copies: Element[] = [];
        for (const el of p.els) copies.push(await app.doc.duplicate(el));
        const groups = copiedGroups(copies, (taken) => freshGroup(app, taken));
        copies.forEach((copy, i) => {
          const t = to[i], g = groups[i];
          app.doc.setTag(copy, { translate: t ? { x: round(t.x), y: round(t.y) } : null, ...(g !== copy.getAttribute('data-group') ? { attrs: { 'data-group': g } } : {}) }, 'move');
        });
        relink(app, copies);
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
  // Esc puts back a dragged end or bend in place of the commands of the key, as in drag.ts
  app.commands.veto((_, cmd) => !!press?.moved && Object.values(cmd.keys ?? {}).some((k) => k.includes('Escape')));
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
  const startDrawing = (heads: Heads, kind: Kind = 'straight') => async (a: App, arg?: unknown) => {
    const at = arg as { from?: Point; to?: Point } | undefined;
    if (at?.from && at.to) {
      await add({ x1: at.from.x, y1: at.from.y, x2: at.to.x, y2: at.to.y }, { heads, kind });
      return;
    }
    const host = a.hostOf(document.activeElement);
    if (host) (host as HTMLElement).blur();
    drawing = { heads, kind };
    root.classList.add('beeson-drawing-line');
  };
  const isDrawing = (heads: Heads, kind: Kind) => () => (drawing?.heads === heads && drawing.kind === kind ? true : null);

  const insertMenu = (order: number) => ({ bar: 'Insert', group: 'element', order });
  // the Shape button of the toolbar, whose main part draws a line
  const shape = (order: number) => ({ group: 'insert', order, icon: 'shape', label: 'Shape', split: 'Shape' });
  c.define({ id: 'insert.line', label: 'Line', menu: insertMenu(30), toolbar: shape(23), enabled: ready, checked: isDrawing('none', 'straight'), run: startDrawing('none') });
  c.define({ id: 'insert.arrow', label: 'Arrow', menu: insertMenu(31), toolbar: shape(23.1), enabled: ready, checked: isDrawing('end', 'straight'), run: startDrawing('end') });
  c.define({ id: 'insert.curve', label: 'Curved Arrow', menu: insertMenu(31.1), toolbar: shape(23.2), enabled: ready, checked: isDrawing('end', 'curve'), run: startDrawing('end', 'curve') });
  c.define({ id: 'insert.elbow', label: 'Elbow Arrow', menu: insertMenu(31.2), toolbar: shape(23.3), enabled: ready, checked: isDrawing('end', 'elbow'), run: startDrawing('end', 'elbow') });
  for (const [id, face] of [['insert.line', 'straight'], ['insert.arrow', 'arrow'], ['insert.curve', 'curve'], ['insert.elbow', 'elbow']]) setItemIcon(id, `line-${face}`);

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
          const line = strokeOf(svg);
          const id = svg.querySelector('marker')?.id;
          if (line && id) a.doc.setTag(line, { attrs: headAttrs(heads, id) }, 'arrowheads');
        }
        a.invalidate('content');
      },
    });
  });
  // a change of kind replaces the child of the svg, keeping its ends, its arrowheads, its marker,
  // and every attribute of the svg, hence a line made a curve and back is written as before
  KINDS.forEach(([kind, label], i) => {
    c.define({
      id: `line.kind.${kind}`,
      label,
      menu: lineMenu('line-kind', 100 + i),
      enabled: (a) => some(a) && selectedLines(a).every((svg) => !!kindOf(svg)),
      checked: (a) => some(a) && selectedLines(a).every((svg) => kindOf(svg) === kind),
      run: (a) =>
        a.history.selecting('Line Kind', async () => {
          const made = [...a.selection.elements()];
          for (const svg of selectedLines(a)) {
            const s = strokeAt(svg);
            const id = svg.querySelector('marker')?.id;
            if (!s || !id || s.kind === kind) continue;
            const next = withKind(s, kind);
            const text = childText(next, headsOf(svg), id);
            const node = await a.doc.rewrite(svg, (body) => body.replace(/(<\/defs>\s*)<(line|path)\b[^>]*>(?:\s*<\/\2>)?/, (_, lead: string) => lead + text), 'line kind');
            const b = strokeText(next).box, was = strokeText(s).box;
            // the svg is turned about the center of its box, hence a turned line is moved by the turn of
            // the step from the old center to the new one, which keeps its ends on the slide
            const r = (angleOf(svg) * Math.PI) / 180, dx = b.left + b.width / 2 - was.left - was.width / 2, dy = b.top + b.height / 2 - was.top - was.height / 2;
            const x = round(b.left + dx * (Math.cos(r) - 1) - dy * Math.sin(r)), y = round(b.top + dx * Math.sin(r) + dy * (Math.cos(r) - 1));
            a.doc.setTag(node, { attrs: { width: String(b.width), height: String(b.height) }, translate: x || y ? { x, y } : null }, 'line kind');
            made.splice(made.indexOf(svg), 1, node);
          }
          a.selection.set('elements', made);
          a.invalidate('content', 'selection');
        }),
    });
  });
  WEIGHTS.forEach((w, i) => {
    c.define({
      id: `line.weight.${w}`,
      label: `${w} px`,
      menu: lineMenu('line-weight', 110 + i),
      enabled: some,
      checked: (a) => some(a) && selectedLines(a).every((svg) => weightOf(svg) === w),
      undoable: true,
      undo: 'Line Weight',
      run: (a) => {
        const classes: Record<string, boolean> = {};
        for (const o of WEIGHTS) if (o !== 3) classes[`weight-${o}`] = o === w;
        for (const svg of selectedLines(a)) a.doc.setTag(svg, { classes }, 'line weight');
        a.invalidate('content');
      },
    });
  });
  // the glue of an end of the selected lines taken off, which the Line pane runs
  for (const [end, name] of [['from', 'start'], ['to', 'end']] as const) {
    c.define({
      id: `line.unglue.${name}`,
      label: `Detach ${name === 'start' ? 'Start' : 'End'}`,
      enabled: (a) => some(a) && selectedLines(a).some((svg) => svg.hasAttribute(`data-${end}`)),
      undoable: true,
      undo: 'Detach Line',
      run: (a) => {
        for (const svg of selectedLines(a)) setEnd(recorded(a), svg, end, null);
        a.invalidate('content');
      },
    });
  }
  c.define({
    id: 'line.dashed',
    label: 'Dashed',
    menu: lineMenu('line-dash', 120),
    enabled: some,
    checked: (a) => some(a) && selectedLines(a).every((svg) => svg.classList.contains('dashed')),
    undoable: true,
    undo: 'Dashed',
    run: (a) => {
      const on = !selectedLines(a).every((svg) => svg.classList.contains('dashed'));
      for (const svg of selectedLines(a)) a.doc.setTag(svg, { classes: { dashed: on } }, 'dashed');
      a.invalidate('content');
    },
  });
}
