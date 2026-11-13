// the steps of a slide that the editor shows at once. every step of a slide is shown while it is
// edited, but an element that is hidden at a step, e.g. a derivation faded out and replaced by
// another one in its place, would then lie under the elements shown after it. the steps of such a
// slide are cut into ranges at each step at which an element is hidden, and the slide is shown one
// range at a time, as it is at the last step of the range. a switch in the status bar chooses the
// range, and a slide without such an element is shown whole, without the switch

export type StepRange = { from: number; to: number };
export type Fragment = { el: Element; step: number; kind: 'in' | 'out' | 'only' };

// a fade-out fragment is hidden from its step on, and current-visible and fade-in-then-out are shown
// at their step only. semi-fade-out and fade-in-then-semi-out are still seen, and do not cut a range
const OUT = '.fade-out';
const ONLY = '.current-visible, .fade-in-then-out';
export const OFF = 'beeson-off';

// the index of a fragment as the file gives it. reveal.js numbers the indexes of the page from 0
// at its start, and an edit writes the index of the file into the page, hence the editor reads the
// indexes of the tags, set at the install of commands/steps.ts, and the page only without it
let readIndex = (el: Element): string | null => el.getAttribute('data-fragment-index');
export function setIndexReader(read: (el: Element) => string | null): void {
  readIndex = read;
}
export const fragmentIndex = (el: Element): string | null => readIndex(el);

// the index of each element that the editor put into a block from a text, as the text gives it,
// i.e. in the numbers of the file. reveal.js numbers it again with the page, and the element does
// not have a tag in the file, hence this index is the one written for it
const placed = new WeakMap<Element, string>();
export function notePlaced(root: Element): void {
  for (const el of root.querySelectorAll('[data-fragment-index]')) placed.set(el, el.getAttribute('data-fragment-index')!);
}
export const placedIndex = (el: Element): string | undefined => placed.get(el);

// the index of each copy set to the index of the file of its element of live, the elements of a
// copy of a part of the page with an index, in the same order, so that a text taken from the page
// gives the numbers of the file
export function fileIndexes(live: Element[], copies: Element[]): void {
  copies.forEach((c, i) => {
    const v = live[i] ? readIndex(live[i]) : null;
    if (v !== null) c.setAttribute('data-fragment-index', v);
  });
}

// the fragments of a slide outside its notes, with their steps numbered from 1 in the order of
// reveal.js: by data-fragment-index, then the fragments without one in document order
export function fragmentsOf(slide: Element): Fragment[] {
  const els = [...slide.querySelectorAll('.fragment')].filter((el) => !el.closest('aside.notes'));
  const given = els.map((el) => parseFloat(readIndex(el) ?? ''));
  let next = Math.max(0, ...given.filter((i) => !Number.isNaN(i))) + 1;
  const index = given.map((i) => (Number.isNaN(i) ? next++ : i));
  const order = [...new Set(index)].sort((a, b) => a - b);
  return els.map((el, i) => ({ el, step: order.indexOf(index[i]) + 1, kind: el.matches(OUT) ? 'out' : el.matches(ONLY) ? 'only' : 'in' }));
}

export function rangesOf(slide: Element): StepRange[] {
  const fragments = fragmentsOf(slide);
  const last = Math.max(0, ...fragments.map((f) => f.step));
  const cuts = new Set<number>();
  for (const f of fragments) {
    const at = f.kind === 'out' ? f.step : f.kind === 'only' ? f.step + 1 : 0;
    if (at > 0 && at <= last) cuts.add(at);
  }
  const starts = [0, ...[...cuts].sort((a, b) => a - b)];
  return starts.map((from, i) => ({ from, to: i + 1 < starts.length ? starts[i + 1] - 1 : last }));
}

export const shownAt = (f: Fragment, step: number): boolean => (f.kind === 'in' ? f.step <= step : f.kind === 'out' ? step < f.step : step === f.step);

// the fragments not shown at the last step of range are marked with OFF, together with the
// fragments inside them, since the styles of the editor show every fragment. the fragments are in
// document order, hence an outer fragment is marked before the ones inside it. a null range clears
// the marks
export function showRange(slide: Element, range: StepRange | null): void {
  for (const f of fragmentsOf(slide)) {
    const up = f.el.parentElement?.closest('.fragment');
    f.el.classList.toggle(OFF, !!range && (!shownAt(f, range.to) || (!!up && up.classList.contains(OFF))));
  }
}

export function label(range: StepRange, last: boolean): string {
  if (range.from === 0) return range.to === 0 ? 'Before step 1' : `Up to step ${range.to}`;
  if (last) return `From step ${range.from}`;
  return range.from === range.to ? `Step ${range.from}` : `Steps ${range.from}–${range.to}`;
}

export class ShownSteps {
  readonly box = document.createElement('span');
  private readonly slide: () => Element | null;
  private readonly onChange: () => void;
  // the range chosen on each slide, kept while the editor is open
  private readonly chosen = new WeakMap<Element, number>();
  private key = '';

  constructor(slide: () => Element | null, onChange: () => void) {
    this.slide = slide;
    this.onChange = onChange;
    this.box.className = 'beeson-shown-steps';
    this.box.setAttribute('role', 'group');
    this.box.setAttribute('aria-label', 'Steps shown on the slide');
    this.box.hidden = true;
  }

  // the marks and the switch follow the current slide and its steps
  refresh(): void {
    // a preview of the steps shows every range in turn, and the last one at its end
    if (document.documentElement.classList.contains('beeson-previewing')) return;
    const slide = this.slide();
    const ranges = slide ? rangesOf(slide) : [];
    if (!slide || ranges.length < 2) {
      if (slide) showRange(slide, null);
      this.box.hidden = true;
      this.box.replaceChildren();
      this.key = '';
      return;
    }
    const at = Math.min(this.chosen.get(slide) ?? 0, ranges.length - 1);
    showRange(slide, ranges[at]);
    const labels = ranges.map((l, i) => label(l, i === ranges.length - 1));
    const key = `${labels.join('|')}#${at}`;
    this.box.hidden = false;
    if (key === this.key) return;
    this.key = key;
    const head = document.createElement('span');
    head.textContent = 'Shows';
    this.box.replaceChildren(head, ...labels.map((text, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.title = `Show the slide as it is at step ${ranges[i].to}, without the elements hidden by then and those shown after it`;
      b.setAttribute('aria-pressed', String(i === at));
      b.classList.toggle('on', i === at);
      b.addEventListener('click', (ev) => {
        if (ev.detail > 0) b.blur();
        this.choose(slide, i);
      });
      return b;
    }));
  }

  // the last range of the slide is chosen, e.g. at the end of a preview of its steps
  showLast(): void {
    const slide = this.slide();
    const ranges = slide ? rangesOf(slide) : [];
    if (slide && ranges.length > 1) this.choose(slide, ranges.length - 1);
    else this.refresh();
  }

  private choose(slide: Element, i: number): void {
    this.chosen.set(slide, i);
    this.refresh();
    this.onChange();
  }

  // the range in which el is shown is chosen, e.g. for an undo of a change to a hidden element
  reveal(el: Element): void {
    const slide = this.slide();
    if (!slide || !slide.contains(el) || !el.closest(`.${OFF}`)) return;
    const ranges = rangesOf(slide);
    for (let i = 0; i < ranges.length; i++) {
      showRange(slide, ranges[i]);
      if (!el.closest(`.${OFF}`)) {
        this.choose(slide, i);
        return;
      }
    }
    this.refresh();
  }
}

// the step model of a slide, pure and without the DOM. the elements of a slide that can be a step
// are items in document order, and a plan puts them into groups, i.e. the steps in their order,
// each with the items shown together, and into the finals, the items with data-final, which are
// shown last, one by one. every change of the Steps tab is a new plan, written as the indexes of
// the slide by itemsOf

export type Item = { fragment: boolean; index: number | null; final: boolean };
export type Plan = { groups: number[][]; finals: number[] };
// an item is shown at a click, or together with the item before it, as Start in PowerPoint
export type Start = 'click' | 'with';

const copy = (p: Plan): Plan => ({ groups: p.groups.map((g) => [...g]), finals: [...p.finals] });

// the plan of the items in the order of reveal.js: by index, then the fragments without an index
// one by one in document order. a fragment without an index and with data-final is shown last
export function planOf(items: Item[]): Plan {
  const byIndex = new Map<number, number[]>();
  const loose: number[][] = [];
  const finals: number[] = [];
  items.forEach((it, i) => {
    if (!it.fragment) return;
    if (it.index !== null) byIndex.set(it.index, [...(byIndex.get(it.index) ?? []), i]);
    else if (it.final) finals.push(i);
    else loose.push([i]);
  });
  const indexed = [...byIndex].sort((a, b) => a[0] - b[0]).map(([, g]) => g);
  return { groups: [...indexed, ...loose], finals };
}

// the step of item i counted from 0 over the groups and then the finals, or -1 with the slide
export function stepAt(plan: Plan, i: number): number {
  const g = plan.groups.findIndex((g) => g.includes(i));
  if (g >= 0) return g;
  const f = plan.finals.indexOf(i);
  return f >= 0 ? plan.groups.length + f : -1;
}

// the first item of a group in document order is shown at a click, and the others with it
export function startOf(plan: Plan, i: number): Start | null {
  const g = plan.groups.find((g) => g.includes(i));
  if (g) return Math.min(...g) === i ? 'click' : 'with';
  return plan.finals.includes(i) ? 'click' : null;
}

// the items as the plan writes them. the group at position k gets the index base + k, where base
// is the lowest index of the items or 1, and a final item does not have an index
export function itemsOf(items: Item[], plan: Plan): Item[] {
  const given = items.filter((it) => it.fragment && it.index !== null).map((it) => it.index as number);
  const base = given.length ? Math.min(1, ...given) : 1;
  return items.map((_, i) => {
    const g = plan.groups.findIndex((g) => g.includes(i));
    if (g >= 0) return { fragment: true, index: base + g, final: false };
    if (plan.finals.includes(i)) return { fragment: true, index: null, final: true };
    return { fragment: false, index: null, final: false };
  });
}

function without(plan: Plan, i: number): Plan {
  const p = copy(plan);
  p.groups = p.groups.map((g) => g.filter((x) => x !== i)).filter((g) => g.length);
  p.finals = p.finals.filter((x) => x !== i);
  return p;
}

// item i put into a step of its own in the gap before the group at position gap of plan, or with
// the slide for null. a gap past the last group is a new last step
export function moveTo(plan: Plan, i: number, gap: number | null): Plan {
  const p = without(plan, i);
  if (gap === null) return p;
  const at = plan.groups.slice(0, Math.max(0, gap)).filter((g) => g.some((x) => x !== i)).length;
  p.groups.splice(at, 0, [i]);
  return p;
}

// item i put into the group at position to, into a new first or last group, or with the slide for
// null
export function setStep(plan: Plan, i: number, to: number | 'first' | 'last' | null): Plan {
  if (to === 'first') return moveTo(plan, i, 0);
  if (to === null) return moveTo(plan, i, null);
  const target = to === 'last' ? undefined : plan.groups[to];
  if (!target) return moveTo(plan, i, plan.groups.length);
  const others = target.filter((x) => x !== i);
  if (!others.length) return moveTo(plan, i, to as number);
  const p = without(plan, i);
  p.groups.find((g) => g.includes(others[0]))?.push(i);
  return p;
}

// With Previous joins the group of item i, with the items shown with it, to the group before, and
// On Click starts a new group after it at item i, with the items of its group that follow it
export function setStart(plan: Plan, i: number, start: Start): Plan {
  const g = plan.groups.findIndex((g) => g.includes(i));
  if (g < 0 || startOf(plan, i) === start) return plan;
  const p = copy(plan);
  if (start === 'with') {
    if (g === 0) return plan;
    p.groups[g - 1].push(...p.groups[g]);
    p.groups.splice(g, 1);
  } else {
    p.groups[g] = plan.groups[g].filter((x) => x < i);
    p.groups.splice(g + 1, 0, plan.groups[g].filter((x) => x >= i));
  }
  return p;
}

// item i shown last, after every step, or put back as the last step
export function setFinal(plan: Plan, i: number, on: boolean): Plan {
  if (plan.finals.includes(i) === on) return plan;
  const p = without(plan, i);
  if (on) p.finals = [...p.finals, i].sort((a, b) => a - b);
  else p.groups.push([i]);
  return p;
}

// item i moved one step earlier or later, as with the arrows of the Animation Pane of PowerPoint:
// an item alone in its group swaps with the group beside it, and an item shown with others gets a
// step of its own beside its group
export function shift(plan: Plan, i: number, by: -1 | 1): Plan {
  const g = plan.groups.findIndex((g) => g.includes(i));
  if (g < 0) return plan;
  if (plan.groups[g].length > 1) return moveTo(plan, i, by < 0 ? g : g + 1);
  const to = g + by;
  if (to < 0 || to >= plan.groups.length) return plan;
  const p = copy(plan);
  [p.groups[g], p.groups[to]] = [p.groups[to], p.groups[g]];
  return p;
}

// every eligible item in a step of its own in document order, the finals kept last, and every
// other item with the slide
export function oneByOne(plan: Plan, eligible: boolean[]): Plan {
  const finals = plan.finals.filter((i) => eligible[i]);
  return { groups: eligible.flatMap((ok, i) => (ok && !finals.includes(i) ? [[i]] : [])), finals };
}

// the index named by a data-keep of n after the items before were written as after. the step of
// index n is followed to its new index, which is that of the earliest of its items still in a
// group, and n is kept when none is
export function remapKeep(n: number, before: Item[], after: Item[]): number {
  const moved = before.flatMap((it, i) => (it.fragment && it.index === n && after[i].fragment && after[i].index !== null ? [after[i].index as number] : []));
  return moved.length ? Math.min(...moved) : n;
}
