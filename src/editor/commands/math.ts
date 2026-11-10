// the commands of the formulas: Inline Formula at the caret of a text, Edit Formula…, the TeX of
// the Formula pane, Hold Through the Next Step of a display, and the color of a symbol at a step.
// a symbol is colored as AGENTS.md describes stepped math: its part of the TeX is marked as
// \class{name}{…}, and a fragment of a later step is given data-highlight with the name and
// data-tone with its tone, orange being the default without data-tone. the step is chosen in the
// step model of steps.ts, and an element shown with the slide can be made the new last step for
// it. each command is one entry of the history, written through app.doc

import type { App } from '../app.ts';
import { HOST } from '../app.ts';
import { classesIn, mathLookup, suggestName, unwrapClass, wrapClass } from '../math.ts';
import { setStep, stepAt } from '../layers.ts';
import { describe, modelOf, writePlan, type Model } from '../steps.ts';
import { openInsert, sheetTarget } from '../text/mathpop.ts';

export type Tone = 'accent' | 'violet' | 'blue' | 'red';
export const TONES: [Tone, string][] = [['accent', 'Orange'], ['violet', 'Violet'], ['blue', 'Blue'], ['red', 'Red']];

// the inline formula focused last in a text, by its block and its place among the formulas of the
// block, since a formula is replaced by a new container when its block is typeset again
let focused: { host: Element; index: number } | null = null;

// the mjx-container of the formula of the selection: the formula of the open sheet, a selected
// div.math, the formula of a div.math with the caret, or the inline formula focused last in the
// text with the caret
export function formulaOf(app: App): Element | null {
  const open = sheetTarget();
  if (open?.isConnected && app.hostOf(open)) return open;
  const sel = app.selection;
  const only = sel.only();
  if (only?.matches('div.math')) return only.querySelector('mjx-container');
  if (sel.kind !== 'text') return null;
  const host = sel.items[0];
  if (host.matches('div.math')) return host.querySelector('mjx-container');
  if (focused?.host === host) return host.querySelectorAll('mjx-container')[focused.index] ?? null;
  return null;
}

// the display around a formula, which can be a step and be held
export const displayOf = (container: Element | null): Element | null => container?.closest('div.math') ?? null;

// the text with the caret into which an inline formula can be put: not a display, a code box, or
// the notes
function inlineHost(app: App): Element | null {
  const sel = app.selection;
  if (sel.kind !== 'text') return null;
  const host = sel.items[0];
  if (!host.isConnected || host.matches('div.math') || host.closest('pre, code, aside.notes')) return null;
  return app.current()?.contains(host) ? host : null;
}

// the caret of the selection of the page in host, or the end of host
function caretIn(host: Element): Range {
  const sel = window.getSelection();
  if (sel?.rangeCount) {
    const r = sel.getRangeAt(0);
    if (host.contains(r.startContainer) && host.contains(r.endContainer)) return r.cloneRange();
  }
  const r = document.createRange();
  r.selectNodeContents(host);
  r.collapse(false);
  return r;
}

// a step of the slide at which a symbol can be colored, i.e. a step after the step of its
// formula, with the elements shown at it. an element of with is shown with the slide and is made
// the last step
export type ColorStep = { step: number; label: string; els: Element[] } | { step: null; label: string; with: Element };

const words = (s: string | null | undefined): string[] => (s ?? '').split(/\s+/).filter(Boolean);

// the item of the model whose element holds the formula
function itemOfFormula(m: Model, container: Element): number {
  return m.els.findIndex((el) => el.contains(container));
}

export function colorSteps(app: App, container: Element): ColorStep[] {
  const m = modelOf(app, container.closest('section'));
  if (!m) return [];
  const own = itemOfFormula(m, container);
  const from = own >= 0 ? stepAt(m.plan, own) : -1;
  const out: ColorStep[] = [];
  m.plan.groups.forEach((g, k) => {
    if (k <= from) return;
    const els = g.filter((i) => !m.locked[i] && !m.els[i].contains(container)).map((i) => m.els[i]);
    if (!els.length) return;
    const d = describe(els[0], (el) => mathLookup()(el)?.tex ?? null);
    out.push({ step: k, label: `Step ${k + 1}: ${d.kind}, ${d.text}`, els });
  });
  const block = displayOf(container) ?? container.closest(HOST);
  m.els.forEach((el, i) => {
    if (m.locked[i] || stepAt(m.plan, i) >= 0 || el.contains(container) || el.matches('h1, h2, h3, .foot')) return;
    if (block && !(block.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) return;
    const d = describe(el, (e) => mathLookup()(e)?.tex ?? null);
    out.push({ step: null, label: `New Step: ${d.kind}, ${d.text}`, with: el });
  });
  return out;
}

// the tone of a fragment, orange without data-tone
const toneOf = (app: App, el: Element): Tone => {
  const t = app.doc.tagState(el).attrs['data-tone'];
  return t === 'violet' || t === 'blue' || t === 'red' ? t : 'accent';
};

const highlightOf = (app: App, el: Element): string[] => words(app.doc.tagState(el).attrs['data-highlight']);

// the paired fragments of the slide of container that color name
function fragmentsColoring(app: App, slide: Element, name: string): Element[] {
  return [...slide.querySelectorAll('[data-highlight]')].filter((el) => !!app.pairing?.elements.get(el)?.open && highlightOf(app, el).includes(name));
}

// the colored symbols of a formula: the name, the body, and the tone and step of the fragment that
// colors it, or null for a class that is not colored by any step
export type Colored = { name: string; body: string; start: number; end: number; tone: Tone | null; step: number | null };

export function coloredOf(app: App, container: Element): Colored[] {
  const info = mathLookup()(container);
  const slide = container.closest('section');
  if (!info || !slide) return [];
  const m = modelOf(app, slide);
  const seen = new Set<string>();
  return classesIn(info.tex).filter((c) => !seen.has(c.name) && !!seen.add(c.name)).map((c) => {
    const f = fragmentsColoring(app, slide, c.name)[0];
    const i = f && m ? m.els.indexOf(f) : -1;
    const step = m && i >= 0 && stepAt(m.plan, i) >= 0 ? stepAt(m.plan, i) : null;
    return { name: c.name, body: c.body, start: c.bodyStart, end: c.end - 1, tone: f ? toneOf(app, f) : null, step };
  });
}

// the edit of the tag of el that sets its highlighted names and its tone. a fragment without a name
// left loses its tone as well
function highlightEdit(names: string[], tone: Tone | null): { attrs: Record<string, string | null> } {
  if (!names.length) return { attrs: { 'data-highlight': null, 'data-tone': null } };
  return { attrs: { 'data-highlight': names.join(' '), 'data-tone': tone && tone !== 'accent' ? tone : null } };
}

export type ColorArg = { el?: Element; tex?: string; start: number; end: number; tone: Tone; step: number | null; with?: Element; name?: string };

async function color(app: App, arg: ColorArg): Promise<void> {
  const container = arg.el ?? formulaOf(app);
  const info = container ? mathLookup()(container) : null;
  const slide = container?.closest('section');
  if (!container || !info || !slide) throw new Error('Select a formula first');
  const base = arg.tex ?? info.tex;
  const taken = new Set<string>();
  for (const c of slide.querySelectorAll('mjx-container')) for (const k of classesIn(mathLookup()(c)?.tex ?? '')) taken.add(k.name);
  for (const f of slide.querySelectorAll('[data-highlight]')) for (const n of words(f.getAttribute('data-highlight'))) taken.add(n);
  const s = Math.min(arg.start, arg.end);
  const e = Math.max(arg.start, arg.end);
  const existing = classesIn(base).find((c) => (c.bodyStart === s && c.end - 1 === e) || (c.start === s && c.end === e));
  const { tex, name } = wrapClass(base, s, e, existing?.name ?? arg.name ?? suggestName(base.slice(s, e), taken));
  // the fragment of the step: one of its elements without another tone, or the element made the
  // new last step
  const m = modelOf(app, slide);
  if (!m) throw new Error('The slide does not have steps');
  let target: Element | null = null;
  if (arg.step === null) {
    if (!arg.with || !m.els.includes(arg.with)) throw new Error('Choose the element of the new step');
    target = arg.with;
  } else {
    const group = m.plan.groups[arg.step];
    if (!group) throw new Error(`The slide does not have a step ${arg.step + 1}`);
    const els = group.filter((i) => !m.locked[i] && !m.els[i].contains(container)).map((i) => m.els[i]);
    const fits = (el: Element) => highlightOf(app, el).every((n) => n === name) || toneOf(app, el) === arg.tone;
    target = els.find((el) => fits(el) && highlightOf(app, el).length) ?? els.find(fits) ?? null;
    if (!target) {
      const other = TONES.find(([t]) => t === toneOf(app, els[0]))?.[1] ?? 'another color';
      throw new Error(`Step ${arg.step + 1} colors its symbols in ${other}, and a step has one color. Choose ${other} or another step`);
    }
  }
  if (tex !== info.tex) await app.math.setMath(container, tex);
  if (arg.step === null) {
    const now = modelOf(app, slide)!;
    writePlan(app, now, setStep(now.plan, now.els.indexOf(target), 'last'));
  }
  for (const f of fragmentsColoring(app, slide, name)) {
    if (f === target) continue;
    const rest = highlightOf(app, f).filter((n) => n !== name);
    app.doc.setTag(f, highlightEdit(rest, toneOf(app, f)), 'color');
  }
  const names = [...highlightOf(app, target).filter((n) => n !== name), name];
  app.doc.setTag(target, highlightEdit(names, arg.tone), 'color');
}

// the class of name taken out of the TeX of the formula, and out of the fragments of its slide once
// no element of the slide has the class any more
async function uncolor(app: App, arg: { el?: Element; name: string }): Promise<void> {
  const container = arg.el ?? formulaOf(app);
  const info = container ? mathLookup()(container) : null;
  const slide = container?.closest('section');
  if (!container || !info || !slide) throw new Error('Select a formula first');
  const tex = unwrapClass(info.tex, arg.name);
  if (tex !== info.tex) await app.math.setMath(container, tex);
  if (slide.querySelector(`.${CSS.escape(arg.name)}`)) return;
  for (const f of fragmentsColoring(app, slide, arg.name)) {
    app.doc.setTag(f, highlightEdit(highlightOf(app, f).filter((n) => n !== arg.name), toneOf(app, f)), 'color');
  }
}

export function install(app: App): void {
  const c = app.commands;

  // the colors of the classes of a slide are applied by applySteps of src/steps.ts, which
  // beeson.js runs again for the slide of a beeson:plot-drawn event. a formula typeset again, or a
  // highlight written or undone, thus gets its color back
  app.onRefresh(['content', 'structure'], () => {
    const slide = app.current();
    if (slide?.querySelector('[data-highlight]')) slide.dispatchEvent(new CustomEvent('beeson:plot-drawn', { bubbles: true }));
  });

  // the inline formula focused last in a text is kept while the focus is in the inspector or the
  // sheet, and dropped once the caret is in the text again
  document.addEventListener('focusin', (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    const host = app.hostOf(target);
    if (target.matches('mjx-container') && host) focused = { host, index: [...host.querySelectorAll('mjx-container')].indexOf(target) };
    else if (host || target.closest('.reveal')) focused = null;
  });

  // an inline formula at the caret of a text. its key, Keynote's key of Insert Equation on a Mac and
  // PowerPoint's on Windows, is bound to insert.formula of commands/insert.ts, which runs this
  // command in a text and puts a display on the canvas
  c.define({
    id: 'math.inline',
    label: 'Inline Formula',
    in: ['text'],
    menu: { bar: 'Insert', group: 'element', order: 22 },
    context: ['text'],
    enabled: (a) => !!inlineHost(a) && a.region() !== 'dialog',
    run: (a) => {
      const host = inlineHost(a);
      if (host) openInsert(a, host, caretIn(host));
    },
  });
  c.define({
    id: 'math.edit',
    label: 'Edit Formula…',
    context: ['element', 'text'],
    enabled: (a) => !!formulaOf(a) && !a.math.isOpen(),
    run: (a) => {
      const f = formulaOf(a);
      if (f) a.math.open(f);
    },
  });
  // the TeX of the Formula pane, for the formula given in el
  c.define({
    id: 'math.tex',
    label: 'Formula',
    undoable: true,
    run: async (a, arg) => {
      const { el, tex } = arg as { el?: Element; tex: string };
      const target = el?.isConnected ? el : formulaOf(a);
      if (!target) throw new Error('Select a formula first');
      await a.math.setMath(target, tex);
    },
  });
  c.define({
    id: 'math.hold',
    label: 'Hold Through the Next Step',
    enabled: (a) => {
      const d = displayOf(formulaOf(a));
      return !!d && !!a.pairing?.elements.get(d)?.open;
    },
    checked: (a) => {
      const d = displayOf(formulaOf(a));
      return !!d && !!a.pairing?.elements.get(d)?.open && 'data-keep' in a.doc.tagState(d).attrs;
    },
    undoable: true,
    run: (a) => {
      const d = displayOf(formulaOf(a));
      if (!d) return;
      const on = 'data-keep' in a.doc.tagState(d).attrs;
      a.doc.setTag(d, { attrs: { 'data-keep': on ? null : '' } }, 'hold');
    },
  });
  c.define({
    id: 'math.color',
    label: 'Color Symbol at Step',
    enabled: (a) => !!formulaOf(a),
    undoable: true,
    run: (a, arg) => color(a, arg as ColorArg),
  });
  c.define({
    id: 'math.uncolor',
    label: 'Remove Color of Symbol',
    enabled: (a) => !!formulaOf(a),
    undoable: true,
    run: (a, arg) => uncolor(a, arg as { el?: Element; name: string }),
  });
}
