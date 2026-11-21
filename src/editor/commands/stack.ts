import type { App } from '../app.ts';
import type { Translate } from '../tags.ts';
import { CHILD, STACK, childrenOf, fragmentIndex, fragmentsOf, moveTabTo, moveTo, rangesOf, shownAt, shownChild, stacksOf, stepAt, type Fragment, type Plan, type ShownSteps } from '../shown-steps.ts';
import { describe, indexIn, modelOf, writePlan, type Model } from '../steps.ts';
import { movableOf } from '../canvas/hit.ts';
import { openMenu } from '../ui/menu.ts';

const tabsOf = (app: App): ShownSteps => app.shownSteps as unknown as ShownSteps;

const FLOW_PARENT = ':scope > .text-column, :scope > .title-text, :scope > .sec';

function at(app: App, el: Element): Translate {
  const slides = app.slides() as HTMLElement;
  const s = slides.getBoundingClientRect();
  const k = slides.offsetWidth ? s.width / slides.offsetWidth : 1;
  const r = el.getBoundingClientRect();
  return { x: (r.left - s.left) / k, y: (r.top - s.top) / k };
}

const tenth = (v: number): number => Math.round(v * 10) / 10;

const translateOf = (v: string | undefined): Translate => {
  const [x, y] = (v ?? '').trim().split(/\s+/).map((p) => parseFloat(p) || 0);
  return { x: x ?? 0, y: y ?? 0 };
};

export function keepBoxes(app: App, els: Element[]): () => void {
  const list = [...new Set(els)];
  const before = list.map((el) => at(app, el));
  return () =>
    list.forEach((el, i) => {
      if (!el.isConnected || !app.pairing?.elements.get(el)?.open) return;
      const now = at(app, el);
      const [dx, dy] = [before[i].x - now.x, before[i].y - now.y].map(tenth);
      if (!dx && !dy) return;
      const t = translateOf(app.doc.tagState(el).style.translate);
      const x = tenth(t.x + dx), y = tenth(t.y + dy);
      app.doc.setTag(el, { translate: x || y ? { x, y } : null }, 'move');
    });
}

export const drawnOf = (app: App, slide: Element): Element[] =>
  [...slide.querySelectorAll('[style*="translate"]')].filter((el) => !el.closest('aside.notes') && el.closest('section') === slide && !!app.pairing?.elements.get(el)?.open);

const flowParents = (slide: Element): Element[] => [slide, ...slide.querySelectorAll(FLOW_PARENT)];

function stackOfChild(child: Element | null): Element | null {
  const up = child?.parentElement;
  return up?.classList.contains(STACK) ? up : null;
}

function deletable(app: App, child: Element | null | undefined): Element | null {
  const stack = stackOfChild(child ?? null);
  return child && stack && childrenOf(stack).length > 1 && app.pairing?.elements.get(child)?.open ? child : null;
}

function renumber(app: App, slide: Element, change: (plan: Plan, m: Model) => Plan = (p) => p): void {
  const m = modelOf(app, slide);
  if (m) writePlan(app, m, change(m.plan, m));
}

async function addTab(app: App): Promise<void> {
  const slide = app.current();
  const child = slide ? shownChild(slide) : null;
  if (!slide || !child) return;
  const tabs = tabsOf(app);
  await app.history.keeping('Add Tab', () => tabs.shown(slide), (pick) => tabs.show(slide, pick), async () => {
    const copy = await app.doc.duplicate(child);
    renumber(app, slide, (plan, m) => {
      const kin = childrenOf(copy.parentElement as Element);
      const next = kin[kin.indexOf(copy) + 1];
      const gap = next ? stepAt(plan, indexIn(m, next)) : -1;
      const inner = m.els.flatMap((el, k) => (el !== copy && copy.contains(el) ? [k] : []));
      return moveTabTo(plan, indexIn(m, copy), inner, gap < 0 ? plan.groups.length : gap);
    });
    tabs.show(slide, { child: copy, i: 0 });
  });
}

const contentOf = (child: Element): Element[] => (child.localName === 'div' ? [...child.children] : [child]);

async function unwrap(app: App, stack: Element): Promise<void> {
  const parent = stack.parentElement as Element;
  const els = childrenOf(stack).flatMap(contentOf).filter((el) => app.pairing?.elements.get(el)?.open);
  for (const el of els) await app.doc.move(el, parent, stack, 'unwrap');
  await app.doc.remove(stack, 'unwrap');
}

async function deleteTab(app: App, given: Element | null): Promise<void> {
  const child = deletable(app, given);
  const stack = stackOfChild(child);
  const slide = child?.closest('section');
  if (!child || !stack || !slide) return;
  const tabs = tabsOf(app);
  const kin = childrenOf(stack);
  const k = kin.indexOf(child);
  const shown = kin[k + 1] ?? kin[k - 1];
  const lone = kin.length === 2;
  const keep = keepBoxes(app, [...drawnOf(app, slide).filter((el) => !child.contains(el)), ...(lone ? contentOf(shown) : [])]);
  await app.history.keeping('Delete Tab', () => tabs.shown(slide), (pick) => tabs.show(slide, pick), async () => {
    await app.doc.remove(child, 'delete tab');
    if (lone) await unwrap(app, stack);
    renumber(app, slide, (plan, m) => (k === 0 || (lone && shown.localName !== 'div') ? moveTo(plan, indexIn(m, shown), null) : plan));
    keep();
    tabs.show(slide, { child: lone ? null : shown, i: 0 });
  });
}

function wrappable(app: App): Element[] {
  const slide = app.current();
  const sel = app.selection;
  if (!slide || sel.kind !== 'elements' || !sel.items.length) return [];
  const els = sel.items.map((el) => movableOf(app, el));
  const parent = els[0]?.parentElement;
  if (!parent || !flowParents(slide).includes(parent) || els.some((el) => !el || el.parentElement !== parent || el.matches(`.${STACK}, .backdrop`))) return [];
  return [...new Set(els as Element[])].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
}

async function insertStack(app: App): Promise<void> {
  const els = wrappable(app);
  const slide = app.current();
  if (!els.length || !slide) return;
  const keep = keepBoxes(app, [...els, ...drawnOf(app, slide)]);
  const [stack] = await app.doc.insert(`<div class="${STACK}"><div></div></div>`, els[0].parentElement as Element, els[0], 'insert stack');
  const child = stack.firstElementChild as Element;
  for (const el of els) await app.doc.move(el, child, null, 'insert stack');
  keep();
  tabsOf(app).show(slide, { child, i: 0 });
  app.selection.set('elements', els);
}

function everyTabTarget(app: App): Element | null {
  const slide = app.current();
  const el = movableOf(app, app.selection.only());
  if (!slide || !el || !stacksOf(slide).length || el.matches(`.${STACK}, .backdrop`)) return null;
  const up = el.parentElement;
  if (up?.matches(CHILD) && stackOfChild(up)?.closest('section') === slide) return el;
  return up && flowParents(slide).includes(up) && shownChild(slide) ? el : null;
}

const onEveryTab = (app: App): boolean | null => {
  const el = everyTabTarget(app);
  return el ? !el.parentElement?.matches(CHILD) : null;
};

async function setEveryTab(app: App): Promise<void> {
  const el = everyTabTarget(app);
  const slide = app.current();
  if (!el || !slide) return;
  const keep = keepBoxes(app, [el, ...drawnOf(app, slide)]);
  const stack = stackOfChild(el.parentElement);
  if (stack) await app.doc.move(el, stack.parentElement as Element, stack.nextSibling, 'show on every tab');
  else await app.doc.move(el, shownChild(slide) as Element, null, 'show on one tab');
  keep();
  app.selection.set('elements', [el]);
}

const STEP_CLASSES = ['current-visible', 'fade-in-then-out', 'fade-out'];

function named(app: App, el: Element): string {
  const { kind, text } = describe(el, () => null);
  return `the ${kind.toLowerCase()}${text ? ` \u201c${text.length > 40 ? `${text.slice(0, 40)}\u2026` : text}\u201d` : ''}`;
}

type Conversion = { slide: Element; parent: Element; ranges: ReturnType<typeof rangesOf>; moved: { f: Fragment; range: number }[] };

function conversionOf(app: App, slide: Element | null): Conversion | string | null {
  if (!slide || stacksOf(slide).length) return null;
  const ranges = rangesOf(slide);
  if (ranges.length < 2) return null;
  const parents = flowParents(slide);
  const replaced = fragmentsOf(slide).filter((f) => f.kind === 'only' || f.kind === 'out');
  const nested = replaced.find((f) => f.el.parentElement?.closest('.col') && slide.contains(f.el.parentElement.closest('.col')));
  if (nested) return `Make Stack cannot move ${named(app, nested.el)}, since it is inside a column`;
  const top = replaced.filter((f) => f.el.parentElement && parents.includes(f.el.parentElement));
  const moved: Conversion['moved'] = [];
  for (const f of top) {
    const shown = ranges.flatMap((r, k) => ([...Array(r.to - r.from + 1)].some((_, j) => shownAt(f, r.from + j)) ? [k] : []));
    if (shown.length > 1) return `Make Stack cannot move ${named(app, f.el)}, since it is shown in more than one tab`;
    if (shown.length === 1) moved.push({ f, range: shown[0] });
  }
  const parent = moved[0]?.f.el.parentElement;
  if (!parent) return null;
  if (moved.some(({ f }) => f.el.parentElement !== parent)) return `Make Stack cannot move ${named(app, moved.find(({ f }) => f.el.parentElement !== parent)!.f.el)}, since it is not beside the others`;
  return { slide, parent, ranges, moved };
}

async function makeStack(app: App): Promise<void> {
  const c = conversionOf(app, app.current());
  if (typeof c === 'string') throw new Error(c);
  if (!c) return;
  const { slide, parent, ranges, moved } = c;
  const all = fragmentsOf(slide);
  const indexAt = (step: number) => fragmentIndex(all.find((f) => f.step === step && f.el.classList.contains('fragment'))!.el);
  const flow = [...parent.children].filter((el) => app.pairing?.elements.get(el)?.open && !el.matches('aside.notes, .backdrop'));
  const keep = keepBoxes(app, [...flow, ...drawnOf(app, slide)]);
  const tabs = tabsOf(app);
  const was = tabs.shown(slide).i;
  const kids = ranges.map((r) => (r.from ? `<div class="fragment" data-fragment-index="${indexAt(r.from)}"></div>` : '<div></div>'));
  const els = moved.map(({ f }) => f.el);
  const [stack] = await app.doc.insert(`<div class="${STACK}">${kids.join('')}</div>`, parent, els[0], 'make stack');
  const children = [...stack.children];
  for (const { f, range } of moved) {
    await app.doc.move(f.el, children[range], null, 'make stack');
    const classes = Object.fromEntries(STEP_CLASSES.filter((k) => f.el.classList.contains(k)).map((k) => [k, false]));
    const first = f.kind === 'out' || f.step === ranges[range].from;
    app.doc.setTag(f.el, first ? { fragment: false, index: null, classes } : { classes }, 'make stack');
  }
  keep();
  tabs.show(slide, { child: children[Math.min(was, children.length - 1)], i: was });
}

export function install(app: App): void {
  const tabs = tabsOf(app);
  const fail = (e: unknown) => app.fail(e);
  tabs.act = (what, rect, child) => {
    if (what === 'add') void app.commands.run('stack.addTab').catch(fail);
    else if (what === 'delete' && child) void app.commands.run('stack.deleteTab', { el: child }).catch(fail);
    else if (what === 'make') void app.commands.run('stack.make').catch(fail);
    else if (what === 'menu' && child) openMenu(app, [{ command: 'stack.deleteTab', arg: { el: child } }], { anchor: rect, placement: 'below' });
  };
  const given = (arg: unknown): Element | null => {
    const el = (arg as { el?: unknown } | undefined)?.el;
    return el instanceof Element ? el : null;
  };
  for (const c of [
    {
      id: 'stack.addTab',
      label: 'Add Tab',
      undoable: true,
      enabled: (a: App) => !!(a.current() && shownChild(a.current() as Element)),
      run: (a: App) => addTab(a),
    },
    {
      id: 'stack.deleteTab',
      label: 'Delete Tab',
      undoable: true,
      enabled: (a: App) => !!deletable(a, a.current() && shownChild(a.current() as Element)),
      run: (a: App, arg?: unknown) => deleteTab(a, given(arg) ?? (a.current() && shownChild(a.current() as Element))),
    },
    {
      id: 'insert.stack',
      label: 'Stack',
      menu: { bar: 'Insert', group: 'element', order: 22.9 },
      undoable: true,
      undo: 'Insert Stack',
      enabled: (a: App) => wrappable(a).length > 0,
      why: () => 'Select the elements of the first version, side by side in the flow of the slide',
      run: (a: App) => insertStack(a),
    },
    {
      id: 'stack.make',
      label: 'Make Stack',
      menu: { bar: 'Slide', group: 'stack', order: 57 },
      undoable: true,
      enabled: (a: App) => !!conversionOf(a, a.current()),
      run: (a: App) => makeStack(a),
    },
    {
      id: 'arrange.everyTab',
      label: 'Show on Every Tab',
      menu: { bar: 'Arrange', group: 'stack', order: 12.5 },
      context: ['element' as const],
      undoable: true,
      enabled: (a: App) => !!everyTabTarget(a),
      checked: onEveryTab,
      run: (a: App) => setEveryTab(a),
    },
  ]) app.commands.define(c);
}
