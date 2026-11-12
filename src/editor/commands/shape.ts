// a shape on a slide, as Insert > Shape of Keynote and PowerPoint: a div.shape of theme/beeson.css
// placed and sized in its style, drawn by a drag in the drawing mode of its command, with Shift a
// square, or by a click at 240 by 240 px. its tone, fill, outline, corners, and geometry are classes
// set with the commands of Format > Shape, which the Shape pane of inspector/shape.ts runs. a key
// typed while one shape is selected starts its words, and Return or a double click on an empty
// shape puts the caret into it, with its p written only at the first input

import type { App } from '../app.ts';
import { HOST } from '../app.ts';
import { injectStyle } from '../ui/dom.ts';
import { setItemIcon } from '../ui/icons.ts';
import { overlay, view, wh } from '../canvas/frames.ts';
import { frameOf, onCanvas } from '../canvas/hit.ts';
import { LINE_TONES } from './line.ts';
import { toFront } from './order.ts';
import { DRAWN, shapePath } from '../../shapes.ts';

export const SHAPE_KINDS: [string, string][] = [
  ['rounded', 'Rounded Rectangle'],
  ['rectangle', 'Rectangle'],
  ['ellipse', 'Ellipse'],
  ['triangle', 'Triangle'],
  ['arrow', 'Block Arrow'],
  ['arrow-both', 'Double Block Arrow'],
  ['brace', 'Brace'],
  ['plus', 'Plus'],
  ['equals', 'Equals'],
];
// the class of each kind, none for a rectangle
const KIND_CLASSES = SHAPE_KINDS.map(([k]) => k).filter((k) => k !== 'rectangle');
export const FILLS: [string, string, string | null][] = [['tint', 'Tint', null], ['none', 'None', 'fill-none'], ['ground', 'Background', 'fill-ground'], ['veil', 'Veil', 'veil']];
export const WEIGHTS: [string, string, string | null][] = [['none', 'None', 'no-outline'], ['3', '3 px', null], ['6', '6 px', 'weight-6'], ['8', '8 px', 'weight-8']];
export const CORNERS: [string, string, string | null][] = [['small', 'Small', 'round-s'], ['medium', 'Medium', null], ['large', 'Large', 'round-l']];

// the side of a shape placed by a click, and the pointer travel under which a press is a click
const CLICKED = 240;
const CLICK = 3;
// the band in which a press hits a shape without a fill: its outline and NEAR slide px on each side
// of it. inside the band, a press goes through the shape, e.g. to start a marquee. the band of a
// drawn geometry is its stroke
const NEAR = 6;
// the inner edge of the band, measured from the edge of the ::before box, which is NEAR px outside
// the outline
const HOLE = `calc(${2 * NEAR}px + var(--weight))`;
const HOLE_END = `calc(100% - ${2 * NEAR}px - var(--weight))`;

const CSS = `
html.beeson-drawing-shape .reveal, html.beeson-drawing-shape .reveal *, html.beeson-drawing-shape .beeson-edit-canvas { cursor: crosshair !important; }
.beeson-shape-ghost { position: fixed; overflow: visible; }
.beeson-shape-ghost path { fill: color-mix(in srgb, currentColor 20%, var(--ghost-bg)); stroke: currentColor; stroke-width: 3; stroke-linejoin: miter; }
.beeson-shape-ghost[data-kind=brace] path { fill: none; }
html.beeson-editor .reveal .slides .shape > p[data-generated] { min-width: 1em; min-height: 1.4em; }
html.beeson-editing .reveal .slides section .shape.fill-none { pointer-events: none; }
html.beeson-editing .reveal .slides section .shape.fill-none > :not(svg) { pointer-events: auto; }
html.beeson-editing .reveal .slides section .shape.fill-none > svg path { pointer-events: stroke; }
html.beeson-editing .reveal .slides section .shape.fill-none:not(:is(${DRAWN.map((k) => `.${k}`).join(", ")}))::before { content: ""; position: absolute; inset: calc(-${NEAR}px - var(--weight)); pointer-events: auto; clip-path: polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${HOLE} ${HOLE}, ${HOLE} ${HOLE_END}, ${HOLE_END} ${HOLE_END}, ${HOLE_END} ${HOLE}, ${HOLE} ${HOLE}); }
`;

export const isShape = (el: Element): boolean => el.matches('.reveal .slides section .shape');

// the selected elements when every one of them is a shape, else none
export function selectedShapes(app: App): Element[] {
  const els = app.selection.elements();
  return els.length && els.every(isShape) ? els : [];
}

// whether the shape el is drawn with an svg, which a flip mirrors
export const isDrawn = (el: Element): boolean => DRAWN.some((k) => el.classList.contains(k));

export const kindOf = (el: Element): string => KIND_CLASSES.find((k) => el.classList.contains(k)) ?? 'rectangle';

// the class of one of the choices of a family that el carries, e.g. weight-6 of WEIGHTS
const choiceOf = (el: Element, family: [string, string, string | null][]): string =>
  (family.find(([, , cls]) => cls && el.classList.contains(cls)) ?? family.find(([, , cls]) => !cls)!)[0];

// the classes of a tag edit that set the choice of a family and take the other ones off
const choose = (family: [string, string, string | null][], id: string): Record<string, boolean> =>
  Object.fromEntries(family.filter(([, , cls]) => cls).map(([k, , cls]) => [cls!, k === id]));

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function caretAtEnd(el: Element): void {
  (el as HTMLElement).focus({ preventScroll: true });
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const s = getSelection();
  s?.removeAllRanges();
  s?.addRange(range);
}

type Box = { left: number; top: number; width: number; height: number };

// the outline of a shape of the kind in a box of w by h px, with the outline s px wide drawn inside
// the box as the theme draws it: by the border of the box for a rectangle, a rounded rectangle, and
// an ellipse, and by the path of shapes.ts for the other kinds
function outlineOf(kind: string, w: number, h: number, s: number): string {
  if (DRAWN.includes(kind)) return shapePath(kind, w, h, s);
  const i = s / 2, l = i, t = i, r = w - i, b = h - i;
  if (kind === 'ellipse') {
    const rx = Math.max(0, r - l) / 2, ry = Math.max(0, b - t) / 2;
    return `M${l} ${h / 2}A${rx} ${ry} 0 0 1 ${r} ${h / 2}A${rx} ${ry} 0 0 1 ${l} ${h / 2}Z`;
  }
  if (kind !== 'rounded') return `M${l} ${t}H${r}V${b}H${l}Z`;
  const k = Math.max(0, Math.min(24, w / 2, h / 2) - i);
  return `M${l + k} ${t}H${r - k}A${k} ${k} 0 0 1 ${r} ${t + k}V${b - k}A${k} ${k} 0 0 1 ${r - k} ${b}H${l + k}A${k} ${k} 0 0 1 ${l} ${b - k}V${t + k}A${k} ${k} 0 0 1 ${l + k} ${t}Z`;
}

export function shapeText(kind: string, b: Box): string {
  const cls = kind === 'rectangle' ? 'shape' : `shape ${kind}`;
  // the translate is last, where the tag writer puts one that a move changes
  const at = b.left || b.top ? `; translate: ${b.left}px ${b.top}px` : '';
  return `<div class="${cls}" style="width: ${b.width}px; height: ${b.height}px${at}"></div>`;
}

// a character typed while one shape is selected starts its words or adds to them. the key is taken
// before the keyboard handler of commands.ts, which this listener precedes as it is added when the
// module loads, since a bare key such as G is a command of the canvas
let typed: ((ev: KeyboardEvent) => void) | null = null;
window.addEventListener('keydown', (ev) => typed?.(ev), true);

export function install(app: App): void {
  injectStyle('shape', CSS);
  const c = app.commands;
  const frames = overlay();
  const root = document.documentElement;
  const ready = (a: App) => !!a.pairing?.root && !!a.current() && a.region() !== 'dialog';

  // the kind of shape that the next press on the canvas draws, or null, and the press of a drawing
  let drawing: string | null = null;
  let press: { kind: string; x: number; y: number; from: { x: number; y: number }; moved: boolean } | null = null;

  // the shape being drawn by a drag, in the overlay over the canvas, in the tone of the text of the
  // slide over its tint, as a new shape is drawn
  const ghost = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ghost.classList.add('beeson-shape-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.append(document.createElementNS('http://www.w3.org/2000/svg', 'path'));
  ghost.setAttribute('hidden', '');
  frames.layer.prepend(ghost);
  const drawGhost = (kind: string, b: Box | null) => {
    ghost.toggleAttribute('hidden', !b);
    const slide = app.current();
    if (!b || !slide) return;
    const f = frameOf(app), style = getComputedStyle(slide);
    ghost.dataset.kind = kind;
    ghost.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`);
    Object.assign(ghost.style, { left: `${f.left + b.left * f.scale}px`, top: `${f.top + b.top * f.scale}px`, width: `${b.width * f.scale}px`, height: `${b.height * f.scale}px` });
    ghost.style.color = style.getPropertyValue('--text');
    ghost.style.setProperty('--ghost-bg', style.getPropertyValue('--bg'));
    ghost.firstElementChild!.setAttribute('d', outlineOf(kind, b.width, b.height, 3));
  };

  const endDrawing = () => {
    drawing = null;
    root.classList.remove('beeson-drawing-shape');
  };

  // a new shape of the box in slide px on the current slide, in front of its elements, selected
  const add = async (kind: string, b: Box): Promise<void> => {
    const slide = app.current();
    if (!slide) return;
    const r = (v: number) => Math.round(v);
    const box = { left: r(b.left), top: r(b.top), width: Math.max(1, r(b.width)), height: Math.max(1, r(b.height)) };
    const before = slide.querySelector(':scope > aside.notes');
    await app.history.selecting('Insert Shape', async () => {
      const made = await app.doc.insert(shapeText(kind, box), slide, before, 'Insert Shape');
      await toFront(app, made[0]);
      app.selection.set('elements', made);
      return made;
    });
    app.invalidate('content', 'selection');
  };

  // the box of a drag from the press to the point p in slide px, with Shift a square of the
  // longer side
  const boxOf = (from: { x: number; y: number }, p: { x: number; y: number }, square: boolean): Box => {
    let w = p.x - from.x, h = p.y - from.y;
    if (square) {
      const s = Math.max(Math.abs(w), Math.abs(h));
      w = Math.sign(w || 1) * s;
      h = Math.sign(h || 1) * s;
    }
    return { left: Math.min(from.x, from.x + w), top: Math.min(from.y, from.y + h), width: Math.abs(w), height: Math.abs(h) };
  };
  const slideAt = (ev: PointerEvent) => {
    const f = frameOf(app);
    return { x: (ev.clientX - f.left) / f.scale, y: (ev.clientY - f.top) / f.scale };
  };

  const onDown = (ev: PointerEvent) => {
    if (!drawing || ev.button !== 0 || press || app.state !== 'loaded') return;
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target || !onCanvas(target, app, { x: ev.clientX, y: ev.clientY })) return;
    ev.preventDefault();
    ev.stopPropagation();
    press = { kind: drawing, x: ev.clientX, y: ev.clientY, from: slideAt(ev), moved: false };
  };
  const onMove = (ev: PointerEvent) => {
    const p = press;
    if (!p) return;
    ev.stopPropagation();
    if (!p.moved && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < CLICK) return;
    p.moved = true;
    ev.preventDefault();
    const b = boxOf(p.from, slideAt(ev), ev.shiftKey);
    drawGhost(p.kind, b);
    view.readout = { text: wh(b.width, b.height), x: ev.clientX + 14, y: ev.clientY + 14, at: 'pointer' };
    frames.draw();
  };
  const finish = async (ev: PointerEvent | null) => {
    const p = press;
    if (!p) return;
    press = null;
    drawGhost(p.kind, null);
    view.readout = null;
    frames.draw();
    endDrawing();
    if (!ev) return;
    const from = p.from;
    await add(p.kind, p.moved ? boxOf(from, slideAt(ev), ev.shiftKey) : { left: from.x, top: from.y, width: CLICKED, height: CLICKED });
  };

  // the words of an empty shape, begun with a p of the editor only that is written at its first input
  let opened: HTMLElement | null = null;
  const close = () => {
    const p = opened;
    opened = null;
    if (p?.isConnected) p.remove();
  };
  // the shape el with its words set to the text, written in place of it as one entry of the
  // history, with the caret at the end of the words
  const startWords = async (el: Element, text: string) => {
    const parent = el.parentElement;
    if (!parent) return;
    const body = app.doc.elementText(el).replace(/<\/div>$/, `<p>${escape(text)}</p></div>`);
    let next: Node | null = el.nextSibling;
    while (next instanceof Element && next.hasAttribute('data-generated')) next = next.nextSibling;
    const [made] = await app.history.selecting('Typing', async () => {
      const out = await app.doc.insert(body, parent, next, 'Typing');
      await app.doc.remove(el, 'Typing');
      app.selection.set('elements', out);
      return out;
    });
    app.invalidate('content', 'selection');
    const p = made?.querySelector(HOST) ?? made?.querySelector('p');
    if (p) caretAtEnd(p);
  };
  const openWords = (el: Element) => {
    close();
    const p = document.createElement('p');
    p.setAttribute('data-generated', '');
    p.contentEditable = 'true';
    el.append(p);
    opened = p;
    p.addEventListener('beforeinput', (ev) => {
      ev.preventDefault();
      const text = ev.data ?? '';
      if (!text || opened !== p) return;
      close();
      void startWords(el, text).catch((e) => app.fail(e));
    });
    // the words are kept while the sheet of a formula typed into them is open
    p.addEventListener('focusout', () => setTimeout(() => opened === p && document.activeElement !== p && !app.math.isOpen() && close(), 0));
    p.focus({ preventScroll: true });
  };
  const emptyShape = () => {
    const el = app.selection.only();
    return el && isShape(el) && !el.querySelector(':scope > :not(svg):not([data-generated])') ? el : null;
  };

  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', (ev) => void finish(ev).catch((e) => app.fail(e)), true);
  window.addEventListener('pointercancel', () => void finish(null), true);
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && (drawing || press)) {
      ev.preventDefault();
      ev.stopPropagation();
      if (press) void finish(null);
      endDrawing();
      return;
    }
  }, true);
  typed = (ev) => {
    if (ev.isComposing || ev.key.length !== 1 || ev.key === ' ' || ev.ctrlKey || ev.metaKey || app.state !== 'loaded' || app.region() !== 'canvas') return;
    // an Alt key of a command, e.g. Alt+= of Insert Formula on other, runs the command
    if (ev.altKey && app.commands.forKey(ev, 'canvas')) return;
    const el = app.selection.only();
    if (!el || !isShape(el) || el.hasAttribute('data-locked')) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const host = [...el.querySelectorAll(HOST)].at(-1);
    if (host) {
      caretAtEnd(host);
      document.execCommand('insertText', false, ev.key);
    } else void startWords(el, ev.key).catch((e) => app.fail(e));
  };
  // a press on the words of a selected shape is taken by the move of canvas/drag.ts, whose click
  // puts the caret, hence the word at the caret of a double click is selected here, as the browser
  // selects it in a text. a space or a mark between two words is selected by itself
  window.addEventListener('dblclick', (ev) => {
    const el = ev.target instanceof Element ? ev.target.closest('.shape') : null;
    const host = ev.target instanceof Element ? ev.target.closest(HOST) : null;
    const s = getSelection(), node = s?.anchorNode;
    if (!el || !isShape(el) || !host || !el.contains(host) || !s?.isCollapsed || !(node instanceof Text) || !host.contains(node)) return;
    const words = new Intl.Segmenter(document.documentElement.lang || undefined, { granularity: 'word' }).segment(node.data);
    const at = s.anchorOffset;
    const before = at > 0 ? words.containing(at - 1) : undefined;
    const w = (before?.isWordLike && at === before.index + before.segment.length ? before : words.containing(at)) ?? before;
    if (w) s.setBaseAndExtent(node, w.index, node, w.index + w.segment.length);
  });
  window.addEventListener('dblclick', (ev) => {
    const el = ev.target instanceof Element ? ev.target.closest('.shape') : null;
    if (!el || !isShape(el) || el.querySelector(':scope > :not(svg):not([data-generated])') || el.hasAttribute('data-locked')) return;
    app.selection.set('elements', [el]);
    openWords(el);
  }, true);

  // with an arg { box } in slide px the shape is inserted at once, e.g. by a test
  const startDrawing = (kind: string) => async (a: App, arg?: unknown) => {
    const box = (arg as { box?: Box } | undefined)?.box;
    if (box) return add(kind, box);
    const host = a.hostOf(document.activeElement);
    if (host) (host as HTMLElement).blur();
    drawing = kind;
    root.classList.add('beeson-drawing-shape');
  };
  SHAPE_KINDS.forEach(([kind, label], i) => {
    c.define({
      id: `insert.shape.${kind}`,
      label,
      menu: { bar: 'Insert', group: 'element', order: 29 + i / 100, submenu: 'Shape' },
      toolbar: { group: 'insert', order: 22.1 + i / 100, icon: 'shape', label: 'Shape', split: 'Shape' },
      enabled: ready,
      checked: () => (drawing === kind ? true : null),
      run: startDrawing(kind),
    });
    setItemIcon(`insert.shape.${kind}`, `shape:${kind}`);
  });

  // Return on an empty shape puts the caret into it, before Edit Text of commands/arrange.ts
  c.define({
    id: 'shape.editWords',
    label: 'Edit Text',
    keys: { mac: ['Enter'], other: ['Enter'] },
    in: ['canvas'],
    enabled: (a) => ready(a) && !!emptyShape() && !emptyShape()!.hasAttribute('data-locked'),
    run: () => {
      const el = emptyShape();
      if (el) openWords(el);
    },
  });

  const some = (a: App) => ready(a) && selectedShapes(a).length > 0;
  const shapeMenu = (group: string, order: number) => ({ bar: 'Format', group, order, submenu: 'Shape' });
  const family = (prefix: string, list: [string, string, string | null][], undo: string, group: string, at: number, only?: (el: Element, id: string) => boolean, read = (el: Element) => choiceOf(el, list)) =>
    list.forEach(([id, label], i) => {
      const fit = (a: App) => some(a) && (!only || selectedShapes(a).every((el) => only(el, id)));
      c.define({
        id: `shape.${prefix}.${id}`,
        label,
        menu: shapeMenu(group, at + i),
        enabled: fit,
        checked: (a) => fit(a) && selectedShapes(a).every((el) => read(el) === id),
        undoable: true,
        undo,
        run: (a) => {
          for (const el of selectedShapes(a)) a.doc.setTag(el, { classes: choose(list, id) }, undo);
          a.invalidate('content');
        },
      });
    });
  family('tone', LINE_TONES.map(([t, label]) => [t, label, t === 'text' ? null : `tone-${t}`]), 'Shape Color', 'shape-tone', 80);
  family('fill', FILLS, 'Shape Fill', 'shape-fill', 90);
  // a veil is drawn without an outline unless it has weight-6 or weight-8, hence 3 px, which does not
  // have a class, is not offered on a veil, and the outline of a veil without a class reads as None
  const veil = (el: Element) => el.classList.contains('veil');
  family('weight', WEIGHTS, 'Outline', 'shape-weight', 100, (el, id) => id !== '3' || !veil(el), (el) => (veil(el) && choiceOf(el, WEIGHTS) === '3' ? 'none' : choiceOf(el, WEIGHTS)));
  family('corner', CORNERS, 'Corners', 'shape-corner', 110, (el) => el.classList.contains('rounded'));
  SHAPE_KINDS.forEach(([kind, label], i) => {
    c.define({
      id: `shape.kind.${kind}`,
      label,
      menu: shapeMenu('shape-kind', 120 + i),
      enabled: some,
      checked: (a) => some(a) && selectedShapes(a).every((el) => kindOf(el) === kind),
      undoable: true,
      undo: 'Change Shape',
      run: (a) => {
        const classes = Object.fromEntries(KIND_CLASSES.map((k) => [k, k === kind]));
        for (const el of selectedShapes(a)) if (kindOf(el) !== kind) a.doc.setTag(el, { classes }, 'Change Shape');
        a.invalidate('content');
      },
    });
  });
}
