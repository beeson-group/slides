// the commands of the Steps tab: Preview, One by one, All at once, and the changes of the step of
// an element, i.e. its step, its start, its effect, Show Last, a move by a drag, and a move one
// step earlier or later. each change is written as a new plan of the slide by writePlan of
// steps.ts, as one entry of the history. a command of a row takes the element of the row in its
// argument, and otherwise the selected element, or the item of the slide around it

import type { App } from '../app.ts';
import { moveTo, oneByOne, setFinal, setIndexReader, setStart, setStep, shift, stepAt, type Plan, type Start } from '../layers.ts';
import { WITH_SLIDE, effectEdit, modelAt, modelOf, writePlan, type Effect, type Steps } from '../steps.ts';

type Arg = { el?: Element } & Record<string, unknown>;

// the item of the steps for the argument or the selection: the element itself, or the nearest
// item around it, or the first item inside it
function itemOf(app: App, arg: unknown): Element | null {
  const given = (arg as Arg | undefined)?.el;
  const el = given instanceof Element ? given : app.selection.only();
  if (!el) return null;
  const m = modelOf(app, el.closest('section'));
  if (!m) return null;
  for (let up: Element | null = el; up && up !== m.slide; up = up.parentElement) if (m.els.includes(up)) return up;
  return m.els.find((x) => el.contains(x)) ?? null;
}

function change(app: App, arg: unknown, fn: (plan: Plan, i: number) => Plan): void {
  const el = itemOf(app, arg);
  const m = el ? modelAt(app, el) : null;
  if (m) writePlan(app, m, fn(m.plan, m.i));
}

const stepped = (app: App, arg?: unknown): boolean => {
  const el = itemOf(app, arg);
  const m = el ? modelAt(app, el) : null;
  return !!m && stepAt(m.plan, m.i) >= 0;
};

const num = (v: string | null | undefined): number | null => (v != null && /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? Number(v) : null);

// the index of a fragment in the file. a fragment that is not paired with a tag, e.g. a span in a
// paragraph, is not edited, and its index is placed among those of the paired fragments whose
// index was not edited, by the order of the page, which reveal.js numbers from 0
function indexOf(app: App, el: Element): string | null {
  const paired = (f: Element) => !!app.pairing?.elements.get(f)?.open;
  if (paired(el)) return app.doc.tagState(el).attrs['data-fragment-index'] ?? null;
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
    enabled: (a) => !!modelOf(a)?.items.some((it) => it.fragment),
    undoable: true,
    run: (a) => {
      const m = modelOf(a);
      if (m) writePlan(a, m, { groups: [], finals: [] });
    },
  });
  // the step chosen in the menu of a chip: an index of the plan, 'first' or 'last' for a new step,
  // or null for the slide. the commands of a row are enabled without a selection, since enabled
  // does not see the element of the argument
  c.define({
    id: 'steps.set',
    label: 'Set Step',
    undoable: true,
    run: (a, arg) => change(a, arg, (p, i) => setStep(p, i, (arg as { to: number | 'first' | 'last' | null }).to)),
  });
  c.define({
    id: 'steps.add',
    label: 'Add as Last Step',
    context: ['element'],
    enabled: (a) => !!itemOf(a, undefined) && !stepped(a),
    undoable: true,
    run: (a, arg) => change(a, arg, (p, i) => setStep(p, i, 'last')),
  });
  c.define({
    id: 'steps.remove',
    label: 'Show with Slide',
    context: ['element'],
    enabled: (a) => stepped(a),
    undoable: true,
    run: (a, arg) => change(a, arg, (p, i) => setStep(p, i, null)),
  });
  c.define({
    id: 'steps.start',
    label: 'Set Start of Step',
    undoable: true,
    run: (a, arg) => change(a, arg, (p, i) => setStart(p, i, (arg as { start: Start }).start)),
  });
  c.define({
    id: 'steps.final',
    label: 'Show Last',
    undoable: true,
    run: (a, arg) => change(a, arg, (p, i) => setFinal(p, i, !!(arg as { on?: boolean }).on)),
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
  // the effect of a step: Fade In, Fade Out, or Only at Its Step. an element shown with the slide
  // becomes the last step first
  c.define({
    id: 'steps.effect',
    label: 'Set Effect of Step',
    undoable: true,
    run: (a, arg) => {
      const el = itemOf(a, arg);
      const m = el ? modelAt(a, el) : null;
      if (!el || !m || m.locked[m.i]) return;
      const edit = effectEdit(a.doc.tagState(el), (arg as { effect: Effect }).effect);
      const extra = new Map(Object.keys(edit).length ? [[el, edit]] : []);
      writePlan(a, m, stepAt(m.plan, m.i) >= 0 ? m.plan : setStep(m.plan, m.i, 'last'), extra);
    },
  });
}
