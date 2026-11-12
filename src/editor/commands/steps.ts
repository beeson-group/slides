// the commands of the Steps tab: Preview, One by one, All at once, and the changes of the step of
// an element, i.e. its step, its start, its effect, Show Last, a move by a drag, and a move one
// step earlier or later. each change is written as a new plan of the slide by writePlan of
// steps.ts, as one entry of the history. a command of a row takes the element of the row in its
// argument, and otherwise the selected element, or the item of the slide around it. Set Step, Add
// as Last Step, Show with Slide, the start, the effect, and Show Last act on each selected element

import type { App } from '../app.ts';
import { twinOf } from '../canvas/hit.ts';
import { moveTo, oneByOne, placedIndex, setFinal, setIndexReader, setStart, setStep, shift, stepAt, type Plan, type Start } from '../layers.ts';
import type { TagEdit } from '../tags.ts';
import { AFTER_DEFAULT, MIN_DELAY, WITH_SLIDE, afterable, carryDelays, classesOf, deliverPlan, deliveryOf, delaysOf, effectEdit, effectOf, indexIn, listItems, listOf, modelAt, modelOf, startAt, writePlan, type Delivery, type Effect, type Model, type StartKind, type Steps } from '../steps.ts';

type Arg = { el?: Element } & Record<string, unknown>;

// the item of the steps for the argument or the selection: the element itself, or the nearest
// item around it, or the first item inside it
function itemOf(app: App, arg: unknown): Element | null {
  const given = (arg as Arg | undefined)?.el;
  const el = given instanceof Element ? given : app.selection.only();
  if (!el) return null;
  const m = modelOf(app, el.closest('section'));
  if (!m) return null;
  for (let up: Element | null = el; up && up !== m.slide; up = up.parentElement) if (indexIn(m, up) >= 0) return up;
  return m.els.find((x, k) => !m.lines[k] && el.contains(x)) ?? null;
}

function change(app: App, arg: unknown, fn: (plan: Plan, i: number) => Plan): void {
  const el = itemOf(app, arg);
  const m = el ? modelAt(app, el) : null;
  if (m) writePlan(app, m, fn(m.plan, m.i));
}

// the items of the argument, or of each selected element when several are selected, on the slide
// of the first, with their positions in the order of the slide
function itemsOf(app: App, arg: unknown): { m: Model; items: { el: Element; i: number }[] } | null {
  const sel = app.selection;
  const many = !((arg as Arg | undefined)?.el instanceof Element) && sel.kind === 'elements' && sel.items.length > 1;
  const els = many ? [...new Set(sel.items.flatMap((el) => itemOf(app, { el }) ?? []))] : [itemOf(app, arg)].flatMap((el) => el ?? []);
  const m = els.length ? modelOf(app, els[0].closest('section')) : null;
  const items = m ? els.map((el) => ({ el, i: indexIn(m, el) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i) : [];
  return m && items.length ? { m, items } : null;
}

// fn applied to the plan at each item, as one change. first is the position of the first item,
// whose step the others join
function changeEach(app: App, arg: unknown, fn: (plan: Plan, i: number, first: number) => Plan): void {
  const s = itemsOf(app, arg);
  if (s) writePlan(app, s.m, s.items.reduce((p, { i }) => fn(p, i, s.items[0].i), s.m.plan));
}

// the positions of the items that are a step for the item at i: the item itself, or the items
// held by it that are a step when it is not one, e.g. the images of a figure, by which the figure
// counts as a step
const stepsIn = (m: Model, i: number): number[] =>
  stepAt(m.plan, i) >= 0 ? [i] : m.els.flatMap((x, k) => (k !== i && !m.lines[k] && m.els[i].contains(x) && stepAt(m.plan, k) >= 0 ? [k] : []));

function stepsFor(app: App, el: Element | null): { m: Model & { i: number }; at: number[] } | null {
  const m = el ? modelAt(app, el) : null;
  return m ? { m, at: stepsIn(m, m.i) } : null;
}

const stepped = (app: App, arg?: unknown): boolean => !!stepsFor(app, itemOf(app, arg))?.at.length;

// a delay given in seconds, in ms from 0.1 s to 10 min
function msOf(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error(`a delay of ${seconds} s is not a time`);
  return Math.min(600000, Math.max(MIN_DELAY, Math.round(seconds * 1000)));
}

// the list of the argument or of the selection, i.e. the selected list, an item of it, or the
// block of a text in it
function listAt(app: App, arg: unknown): Element | null {
  const given = (arg as Arg | undefined)?.el;
  const sel = app.selection;
  const el = given instanceof Element ? given : sel.only() ?? (sel.kind === 'text' ? sel.items[0] ?? null : null);
  const list = listOf(el);
  const paired = (x: Element) => !!app.pairing?.elements.get(x)?.open;
  return list && paired(list) && listItems(list).every(paired) ? list : null;
}

// the list delivered by, or shown with the slide for null, as one change. the effect of the step
// moves from the list to its items, or from the first of its items that is a step to the list
function deliver(app: App, list: Element, by: Delivery | null): void {
  const lis = listItems(list);
  const m = modelOf(app, list.closest('section'), [list, ...lis]);
  if (!m || !lis.length) return;
  const at = m.els.indexOf(list);
  const items = lis.map((li) => m.els.indexOf(li));
  if (at < 0 || items.some((i) => i < 0)) return;
  const plan = deliverPlan(m.plan, at, items, by);
  const from = m.items[at].fragment ? at : items.find((i) => m.items[i].fragment);
  const effect = from === undefined ? null : effectOf(classesOf(app, m.els[from])).id;
  const extra = new Map<Element, TagEdit>();
  if (effect && by) {
    for (const i of by === 'all' ? [at] : items) {
      const edit = effectEdit(app.doc.tagState(m.els[i]), effect);
      if (i !== from && Object.keys(edit).length) extra.set(m.els[i], edit);
    }
  }
  const standIn = new Map(by === 'item' ? [[at, items[0]]] : items.map((i) => [i, at]));
  writePlan(app, m, plan, extra, carryDelays(m.plan, plan, delaysOf(app, m), standIn));
}

const num = (v: string | null | undefined): number | null => (v != null && /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? Number(v) : null);

// the index of a fragment in the file. a fragment that is not paired with a tag, e.g. a span in a
// paragraph, is not edited, and its index is placed among those of the paired fragments whose
// index was not edited, by the order of the page, which reveal.js numbers from 0. a fragment put
// into a block from a text keeps the index of the text
function indexOf(app: App, el: Element): string | null {
  const paired = (f: Element) => !!app.pairing?.elements.get(f)?.open;
  if (paired(el)) return app.doc.tagState(el).attrs['data-fragment-index'] ?? null;
  const placed = placedIndex(el);
  if (placed !== undefined) return placed;
  const me = num(el.getAttribute('data-fragment-index'));
  const slide = el.closest('section');
  if (me === null || !slide) return me === null ? null : String(me);
  const known = [...slide.querySelectorAll('.fragment')].flatMap((f) => {
    if (!paired(f) || app.tagEdits.get(f)?.index !== undefined) return [];
    const page = num(f.getAttribute('data-fragment-index'));
    const file = num(app.doc.tagState(f).attrs['data-fragment-index']);
    return page === null || file === null ? [] : [{ page, file }];
  });
  const same = known.find((k) => k.page === me);
  if (same) return String(same.file);
  const lo = known.filter((k) => k.page < me).sort((a, b) => b.page - a.page)[0];
  const hi = known.filter((k) => k.page > me).sort((a, b) => a.page - b.page)[0];
  if (lo && hi) return String((lo.file + hi.file) / 2);
  if (lo) return String(lo.file + me - lo.page);
  if (hi) return String(hi.file - (hi.page - me));
  return String(me);
}

// the effect Play of a video set or taken off, as Start on a click of the Video pane. a video that
// is not a step is made the last step of its slide with the effect Play, and a video taken off Play
// stays a step with the effect Fade In. a video in a zone or a plate is not an item of the steps
// until it is a step, hence it is given to the model
export function startOnClick(app: App, video: Element, on: boolean): void {
  const m = modelOf(app, video.closest('section'), [video]);
  const i = m ? indexIn(m, video) : -1;
  if (!m || i < 0) return;
  const edit = effectEdit(app.doc.tagState(m.els[i]), on ? 'play' : 'in');
  const plan = on && stepAt(m.plan, i) < 0 ? setStep(m.plan, i, 'last') : m.plan;
  writePlan(app, m, plan, Object.keys(edit).length ? new Map([[m.els[i], edit]]) : new Map());
  playAfterFragment(app, m.els[i]);
}

// a video made a step with Play is written as the theme writes it, fragment play, since a tag edit
// puts a new class before the class fragment that it adds. the order is set on each of a pair
function playAfterFragment(app: App, video: Element): void {
  for (const el of [video, twinOf(app, video)]) {
    if (!el) continue;
    const s = app.doc.tagState(el);
    if (!s.classes.includes('fragment') || s.classes.indexOf('play') > s.classes.indexOf('fragment')) continue;
    const classes = s.classes.filter((c) => c !== 'play');
    classes.splice(classes.indexOf('fragment') + 1, 0, 'play');
    app.doc.setTag(el, { order: { attrs: Object.keys(s.attrs), classes, style: Object.keys(s.style) } }, 'steps');
  }
}

export function install(app: App): void {
  const steps = app.steps as Steps;
  steps.attach(app);
  setIndexReader((el) => indexOf(app, el));
  const c = app.commands;
  const menu = (order: number) => ({ bar: 'Slide', group: 'steps', order });
  c.define({
    id: 'steps.preview',
    label: (a) => ((a.steps as Steps).previewing ? 'Stop Preview' : 'Preview Steps'),
    menu: menu(60),
    enabled: (a) => (a.steps as Steps).previewing || !!modelOf(a)?.items.some((it) => it.fragment),
    run: (a) => (a.steps as Steps).preview(),
  });
  // the step given, or the step of the row chosen in the Steps tab, or of the selected element
  const fromOf = (a: App, arg: unknown): number | null => {
    const given = (arg as { step?: unknown } | undefined)?.step;
    if (typeof given === 'number' && given >= 0) return given;
    const chosen = (a.steps as Steps).selectedStep();
    if (chosen !== null) return chosen;
    const el = itemOf(a, arg);
    const m = el ? modelAt(a, el) : null;
    const k = m ? stepAt(m.plan, m.i) : -1;
    return k >= 0 ? k : null;
  };
  c.define({
    id: 'steps.playFrom',
    label: (a) => ((a.steps as Steps).previewing ? 'Stop Preview' : 'Play From Selected Step'),
    menu: menu(60.5),
    enabled: (a) => (a.steps as Steps).previewing || fromOf(a, undefined) !== null,
    run: (a, arg) => {
      const steps = a.steps as Steps;
      if (steps.previewing) return steps.preview();
      const from = fromOf(a, arg);
      return from === null ? undefined : steps.preview(from);
    },
  });
  c.define({
    id: 'steps.oneByOne',
    label: 'Steps One by One',
    menu: menu(61),
    enabled: (a) => !!modelOf(a)?.els.length,
    undoable: true,
    run: (a) => {
      const m = modelOf(a);
      if (m) writePlan(a, m, oneByOne(m.plan, m.els.map((el) => !el.matches(WITH_SLIDE))));
    },
  });
  c.define({
    id: 'steps.allAtOnce',
    label: 'All Steps with the Slide',
    menu: menu(62),
    enabled: (a) => {
      const m = modelOf(a);
      return !!m?.items.some((it, k) => it.fragment && !m.lines[k]);
    },
    undoable: true,
    run: (a) => {
      const m = modelOf(a);
      // the line steps of a code box stay steps of their own, set in its Code pane
      if (m) writePlan(a, m, { groups: m.lines.flatMap((l, i) => (l ? [[i]] : [])), finals: [] });
    },
  });
  // the step chosen in the menu of a chip: an index of the plan, 'first' or 'last' for a new step,
  // or null for the slide. the commands of a row are enabled without a selection, since enabled
  // does not see the element of the argument
  // several items are given one step: the first item takes the step chosen, and the others join it
  const join = (to: number | 'first' | 'last' | null) => (p: Plan, i: number, first: number) => setStep(p, i, i === first || to === null ? to : stepAt(p, first));
  c.define({
    id: 'steps.set',
    label: 'Set Step',
    undoable: true,
    run: (a, arg) => changeEach(a, arg, join((arg as { to: number | 'first' | 'last' | null }).to)),
  });
  const all = (a: App) => itemsOf(a, undefined)?.items ?? [];
  c.define({
    id: 'steps.add',
    label: 'Add as Last Step',
    context: ['element'],
    enabled: (a) => all(a).some(({ el }) => !stepped(a, { el })),
    undoable: true,
    run: (a, arg) => changeEach(a, arg, join('last')),
  });
  c.define({
    id: 'steps.remove',
    label: 'Show with Slide',
    context: ['element'],
    enabled: (a) => all(a).some(({ el }) => stepped(a, { el })),
    undoable: true,
    run: (a, arg) => {
      const s = itemsOf(a, arg);
      const at = s ? s.items.flatMap(({ i }) => stepsIn(s.m, i)) : [];
      if (s && at.length) writePlan(a, s.m, at.reduce((p, k) => setStep(p, k, null), s.m.plan));
    },
  });
  // On Click, With Previous, or After Previous with a delay in seconds, the last one written as
  // data-autoslide on the step before by writePlan of steps.ts
  c.define({
    id: 'steps.start',
    label: 'Set Start of Step',
    undoable: true,
    run: (a, arg) => {
      const s = itemsOf(a, arg);
      if (!s) return;
      const { start, delay } = arg as { start: StartKind; delay?: number };
      const delays = delaysOf(a, s.m);
      let plan = s.m.plan;
      for (const { i } of s.items) {
        const m = { ...s.m, plan };
        const g = plan.groups.findIndex((g) => g.includes(i));
        if (start !== 'after') {
          delays.delete(i);
          if (start === 'with' && g >= 0) delays.delete(Math.min(...plan.groups[g]));
          plan = setStart(plan, i, start as Start);
          continue;
        }
        if (g <= 0 && Math.min(...(plan.groups[g] ?? [i])) === i) throw new Error('the first step of a slide is shown at a click, and it cannot start after a step before it');
        if (!afterable(m, i)) throw new Error('the step before is set in the text of a block, and a delay cannot be written on it');
        delays.set(i, delay === undefined ? (startAt(a, m, i, delays).delay ?? AFTER_DEFAULT) : msOf(delay));
        plan = setStart(plan, i, 'click');
      }
      writePlan(a, s.m, plan, new Map(), delays);
    },
  });
  // the delay of each item of the argument or of the selection that starts After Previous
  c.define({
    id: 'steps.delay',
    label: 'Set Delay of Step',
    undoable: true,
    run: (a, arg) => {
      const s = itemsOf(a, arg);
      if (!s) return;
      const delays = delaysOf(a, s.m);
      const after = s.items.filter(({ i }) => startAt(a, s.m, i, delays).start === 'after');
      if (!after.length) return;
      const ms = msOf((arg as { delay: number }).delay);
      for (const { i } of after) delays.set(i, ms);
      writePlan(a, s.m, s.m.plan, new Map(), delays);
    },
  });
  // the delivery of a list from the menu of its row: all, item, or null for the slide
  c.define({
    id: 'steps.deliver',
    label: 'Set Delivery of List',
    undoable: true,
    run: (a, arg) => {
      const list = listAt(a, arg);
      if (!list) throw new Error('the element is not in a list at the top of the slide');
      deliver(a, list, (arg as { by: Delivery | null }).by);
    },
  });
  // the context menu of a list switches it between its two deliveries, as the Delivery of Keynote
  c.define({
    id: 'steps.listDelivery',
    label: (a) => {
      const list = listAt(a, undefined);
      return list && deliveryOf(a, list) === 'item' ? 'Show List All at Once' : 'Show List Item by Item';
    },
    context: ['element', 'text'],
    enabled: (a) => !!listAt(a, undefined),
    undoable: true,
    run: (a, arg) => {
      const list = listAt(a, (arg as { target?: unknown } | undefined)?.target instanceof Element ? { el: (arg as { target: Element }).target } : undefined) ?? listAt(a, undefined);
      if (list) deliver(a, list, deliveryOf(a, list) === 'item' ? 'all' : 'item');
    },
  });
  c.define({
    id: 'steps.final',
    label: 'Show Last',
    undoable: true,
    run: (a, arg) => changeEach(a, arg, (p, i) => setFinal(p, i, !!(arg as { on?: boolean }).on)),
  });
  // a drop of a row in the gap before the step at position gap, or with the slide for null
  c.define({
    id: 'steps.move',
    label: 'Move Step',
    undoable: true,
    run: (a, arg) => change(a, arg, (p, i) => moveTo(p, i, (arg as { gap: number | null }).gap)),
  });
  // Alt with an arrow moves the selected row, as the arrows of the Animation Pane of PowerPoint.
  // Alt with Left or Right is Back and Forward in a browser outside a Mac, hence only Up and Down
  c.define({
    id: 'steps.earlier',
    label: 'Move Step Earlier',
    keys: { mac: ['Alt+ArrowUp'], other: ['Alt+ArrowUp'] },
    in: ['inspector'],
    enabled: (a) => stepped(a),
    undoable: true,
    run: (a, arg) => change(a, arg, (p, i) => shift(p, i, -1)),
  });
  c.define({
    id: 'steps.later',
    label: 'Move Step Later',
    keys: { mac: ['Alt+ArrowDown'], other: ['Alt+ArrowDown'] },
    in: ['inspector'],
    enabled: (a) => stepped(a),
    undoable: true,
    run: (a, arg) => change(a, arg, (p, i) => shift(p, i, 1)),
  });
  // the effect of a step: Fade In, Play, Fade Out, Only at Its Step, or Dim. the elements shown
  // with the slide become one last step first. Play is set only on a video
  c.define({
    id: 'steps.effect',
    label: 'Set Effect of Step',
    undoable: true,
    run: (a, arg) => {
      const s = itemsOf(a, arg);
      if (!s) return;
      const effect = (arg as { effect: Effect }).effect;
      const extra = new Map<Element, TagEdit>();
      let plan = s.m.plan;
      let first = -1;
      for (const { el, i } of s.items) {
        if (s.m.locked[i] || (effect === 'play' && el.localName !== 'video')) continue;
        const edit = effectEdit(a.doc.tagState(el), effect);
        if (Object.keys(edit).length) extra.set(el, edit);
        if (stepAt(plan, i) >= 0) continue;
        plan = setStep(plan, i, first < 0 ? 'last' : stepAt(plan, first));
        if (first < 0) first = i;
      }
      if (extra.size || plan !== s.m.plan) writePlan(a, s.m, plan, extra);
      if (effect === 'play') for (const el of extra.keys()) playAfterFragment(a, el);
    },
  });
}
