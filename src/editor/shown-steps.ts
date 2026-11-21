import type { TabPick } from './app.ts';
import { injectStyle } from './ui/dom.ts';

export type StepRange = { from: number; to: number };
export type Fragment = { el: Element; step: number; kind: 'in' | 'out' | 'only' | 'span'; end: number };

const OUT = '.fade-out';
const ONLY = '.current-visible, .fade-in-then-out';
export const OFF = 'beeson-off';
export const STACK = 'r-stack';
export const CHILD = '.r-stack > *';

let readIndex = (el: Element): string | null => el.getAttribute('data-fragment-index');
export function setIndexReader(read: (el: Element) => string | null): void {
  readIndex = read;
}
export const fragmentIndex = (el: Element): string | null => readIndex(el);

const placed = new WeakMap<Element, string>();
export function notePlaced(root: Element): void {
  for (const el of root.querySelectorAll('[data-fragment-index]')) placed.set(el, el.getAttribute('data-fragment-index')!);
}
export const placedIndex = (el: Element): string | undefined => placed.get(el);

export function fileIndexes(live: Element[], copies: Element[]): void {
  copies.forEach((c, i) => {
    const v = live[i] ? readIndex(live[i]) : null;
    if (v !== null) c.setAttribute('data-fragment-index', v);
  });
}

const own = (slide: Element, el: Element): boolean => !el.closest('aside.notes') && el.closest('section') === slide;

export const stacksOf = (slide: Element): Element[] => [...slide.querySelectorAll(`.${STACK}`)].filter((s) => own(slide, s));

export const childrenOf = (stack: Element): Element[] => [...stack.children].filter((c) => !c.hasAttribute('data-generated'));

export function fragmentsOf(slide: Element): Fragment[] {
  const kids = new Set(stacksOf(slide).flatMap(childrenOf));
  const els = [...slide.querySelectorAll('*')].filter((el) => (el.classList.contains('fragment') || kids.has(el)) && own(slide, el));
  const steps = els.filter((el) => el.classList.contains('fragment'));
  const given = steps.map((el) => parseFloat(readIndex(el) ?? ''));
  let next = Math.max(0, ...given.filter((i) => !Number.isNaN(i))) + 1;
  const index = given.map((i) => (Number.isNaN(i) ? next++ : i));
  const order = [...new Set(index)].sort((a, b) => a - b);
  const stepOf = (el: Element) => {
    const i = steps.indexOf(el);
    return i < 0 ? 0 : order.indexOf(index[i]) + 1;
  };
  return els.map((el) => {
    const step = stepOf(el);
    if (!kids.has(el)) return { el, step, kind: el.matches(OUT) ? 'out' : el.matches(ONLY) ? 'only' : 'in', end: Infinity };
    const kin = childrenOf(el.parentElement as Element);
    const later = kin[kin.indexOf(el) + 1];
    return { el, step, kind: 'span', end: later ? stepOf(later) : Infinity };
  });
}

export function rangesOf(slide: Element): StepRange[] {
  const fragments = fragmentsOf(slide);
  const last = Math.max(0, ...fragments.map((f) => f.step));
  const cuts = new Set<number>();
  for (const f of fragments) {
    const at = f.kind === 'out' ? f.step : f.kind === 'only' ? f.step + 1 : f.kind === 'span' ? f.end : 0;
    if (at > 0 && at <= last) cuts.add(at);
  }
  const starts = [0, ...[...cuts].sort((a, b) => a - b)];
  return starts.map((from, i) => ({ from, to: i + 1 < starts.length ? starts[i + 1] - 1 : last }));
}

export const shownAt = (f: Fragment, step: number): boolean =>
  f.kind === 'in' ? f.step <= step : f.kind === 'out' ? step < f.step : f.kind === 'span' ? f.step <= step && step < f.end : step === f.step;

export function showRange(slide: Element, range: StepRange | null): void {
  for (const f of fragmentsOf(slide)) {
    const up = f.el.parentElement?.closest(`.fragment, ${CHILD}`);
    f.el.classList.toggle(OFF, !!range && (!shownAt(f, range.to) || (!!up && up.classList.contains(OFF))));
  }
}

export const shownChild = (slide: Element): Element | null => stacksOf(slide).flatMap(childrenOf).find((c) => !c.classList.contains(OFF)) ?? null;

export function label(range: StepRange, last: boolean): string {
  if (range.from === 0) return range.to === 0 ? 'Before step 1' : `Up to step ${range.to}`;
  if (last) return `From step ${range.from}`;
  return range.from === range.to ? `Step ${range.from}` : `Steps ${range.from}–${range.to}`;
}

const CSS = `
.beeson-step-tabs { position: fixed; z-index: 52; display: flex; gap: 2px; font: 12px/1 var(--ed-font); }
.beeson-step-tabs[hidden], html.beeson-previewing .beeson-step-tabs { display: none; }
.beeson-step-tabs button { min-width: 24px; height: 26px; padding: 0 10px; border: 1px solid var(--ed-line); border-radius: 6px; background: var(--ed-panel); color: var(--ed-text); font: inherit; white-space: nowrap; cursor: default; }
.beeson-step-tabs button:hover { background: var(--ed-bg); }
.beeson-step-tabs button[aria-pressed="true"] { border-color: var(--ed-select); background: var(--ed-select); color: var(--ed-on-select); }
.beeson-step-tabs button.add { min-width: 26px; padding: 0 8px; font-size: 15px; }
.beeson-step-tabs button:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 1px; }
`;
const GAP = 4;
const HOLD_MS = 500;
export type TabAction = 'add' | 'menu' | 'delete' | 'make';

export type Pick = TabPick;

export class ShownSteps {
  readonly tabs = document.createElement('div');
  private readonly slide: () => Element | null;
  private readonly onChange: () => void;
  private readonly chosen = new WeakMap<Element, Pick>();
  private key = '';
  private pressed = false;
  act: ((what: TabAction, at: DOMRect, child: Element | null) => void) | null = null;

  constructor(slide: () => Element | null, onChange: () => void) {
    this.slide = slide;
    this.onChange = onChange;
    this.tabs.className = 'beeson-step-tabs';
    this.tabs.setAttribute('role', 'group');
    this.tabs.setAttribute('aria-label', 'Steps shown on the slide');
    this.tabs.hidden = true;
    injectStyle('step-tabs', CSS);
    document.body.append(this.tabs);
  }

  private at(slide: Element, ranges: StepRange[]): number {
    const { child, i } = this.chosen.get(slide) ?? { child: null, i: 0 };
    const f = child && slide.contains(child) ? fragmentsOf(slide).find((x) => x.el === child) : undefined;
    if (!f) return Math.min(i, ranges.length - 1);
    const fits = ranges.flatMap((r, k) => (shownAt(f, r.to) ? [k] : []));
    return fits.includes(i) ? i : (fits[0] ?? 0);
  }

  refresh(): void {
    if (document.documentElement.classList.contains('beeson-previewing')) return;
    const slide = this.slide();
    const ranges = slide ? rangesOf(slide) : [];
    if (!slide || (ranges.length < 2 && !stacksOf(slide).length)) {
      if (slide) showRange(slide, null);
      this.tabs.hidden = true;
      this.tabs.replaceChildren();
      this.key = '';
      return;
    }
    const at = this.at(slide, ranges);
    showRange(slide, ranges[at]);
    const labels = ranges.map((l, i) => label(l, i === ranges.length - 1));
    this.tabs.hidden = false;
    const stacked = stacksOf(slide).length > 0;
    const key = [...labels, stacked ? '+' : 'make'].join('|');
    if (key !== this.key) {
      this.key = key;
      const tabs = labels.map((text, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        b.title = `Show the slide as it is at step ${ranges[i].to}, without the elements hidden by then and those shown after it`;
        b.addEventListener('click', (ev) => {
          if (ev.detail > 0) b.blur();
          if (this.pressed) {
            this.pressed = false;
            return;
          }
          const now = this.slide();
          if (now) this.choose(now, i);
        });
        const menu = () => {
          const now = this.slide();
          if (now) this.act?.('menu', b.getBoundingClientRect(), this.childAt(now, i));
        };
        b.addEventListener('contextmenu', (ev) => {
          ev.preventDefault();
          menu();
        });
        b.addEventListener('keydown', (ev) => {
          if (ev.key !== 'Delete' && ev.key !== 'Backspace') return;
          ev.preventDefault();
          ev.stopPropagation();
          const now = this.slide();
          if (now) this.act?.('delete', b.getBoundingClientRect(), this.childAt(now, i));
        });
        b.addEventListener('pointerdown', (ev) => {
          if (ev.pointerType !== 'touch') return;
          this.pressed = false;
          const timer = setTimeout(() => {
            this.pressed = true;
            menu();
          }, HOLD_MS);
          const end = () => clearTimeout(timer);
          b.addEventListener('pointerup', end, { once: true });
          b.addEventListener('pointercancel', end, { once: true });
          b.addEventListener('pointerleave', end, { once: true });
        });
        return b;
      });
      const extra = document.createElement('button');
      extra.type = 'button';
      extra.className = stacked ? 'add' : 'make';
      extra.textContent = stacked ? '+' : 'Make Stack';
      extra.title = stacked ? 'Add a tab with a copy of the tab shown, just before the next tab' : 'Make the elements replaced on this slide a stack, with a tab for each version';
      extra.setAttribute('aria-label', stacked ? 'Add Tab' : 'Make Stack');
      extra.addEventListener('click', (ev) => {
        if (ev.detail > 0) extra.blur();
        this.act?.(stacked ? 'add' : 'make', extra.getBoundingClientRect(), null);
      });
      this.tabs.replaceChildren(...tabs, extra);
    }
    this.tabs.querySelectorAll('button:not(.add, .make)').forEach((b, i) => {
      b.setAttribute('aria-pressed', String(i === at));
      b.classList.toggle('on', i === at);
    });
    this.place();
  }

  private place(): void {
    const cell = document.querySelector('.beeson-edit-canvas')?.getBoundingClientRect();
    const slide = document.querySelector('.reveal:not(.beeson-peek)')?.getBoundingClientRect();
    if (!cell || !slide) return;
    const { offsetWidth: w, offsetHeight: h } = this.tabs;
    const over = slide.bottom + GAP + h > cell.bottom && slide.top - GAP - h >= cell.top;
    const x = Math.max(cell.left + GAP, slide.left), y = over ? slide.top - GAP - h : slide.bottom + GAP;
    Object.assign(this.tabs.style, { left: `${x}px`, top: `${y}px`, clipPath: `inset(${cell.top - y}px ${x + w - cell.right}px ${y + h - cell.bottom}px ${cell.left - x}px)` });
  }

  showLast(): void {
    const slide = this.slide();
    const ranges = slide ? rangesOf(slide) : [];
    if (slide && ranges.length > 1) this.choose(slide, ranges.length - 1);
    else this.refresh();
  }

  childAt(slide: Element, i: number): Element | null {
    const range = rangesOf(slide)[i];
    const kids = new Set(stacksOf(slide).flatMap(childrenOf));
    return (range && fragmentsOf(slide).find((f) => kids.has(f.el) && shownAt(f, range.to))?.el) || null;
  }

  shown(slide: Element): Pick {
    return this.chosen.get(slide) ?? { child: null, i: 0 };
  }

  show(slide: Element, pick: Pick): void {
    this.chosen.set(slide, pick);
    if (slide === this.slide()) this.refresh();
  }

  private choose(slide: Element, i: number): void {
    const ranges = rangesOf(slide);
    showRange(slide, ranges[i] ?? null);
    this.chosen.set(slide, { child: shownChild(slide), i });
    this.refresh();
    this.onChange();
  }

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

export type Item = { fragment: boolean; index: number | null; final: boolean };
export type Plan = { groups: number[][]; finals: number[] };
export type Start = 'click' | 'with';

const copy = (p: Plan): Plan => ({ groups: p.groups.map((g) => [...g]), finals: [...p.finals] });

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

export function stepAt(plan: Plan, i: number): number {
  const g = plan.groups.findIndex((g) => g.includes(i));
  if (g >= 0) return g;
  const f = plan.finals.indexOf(i);
  return f >= 0 ? plan.groups.length + f : -1;
}

export function startOf(plan: Plan, i: number): Start | null {
  const g = plan.groups.find((g) => g.includes(i));
  if (g) return Math.min(...g) === i ? 'click' : 'with';
  return plan.finals.includes(i) ? 'click' : null;
}

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

export function moveTo(plan: Plan, i: number, gap: number | null): Plan {
  const p = without(plan, i);
  if (gap === null) return p;
  const at = plan.groups.slice(0, Math.max(0, gap)).filter((g) => g.some((x) => x !== i)).length;
  p.groups.splice(at, 0, [i]);
  return p;
}

export function moveTabTo(plan: Plan, head: number, inner: number[], gap: number): Plan {
  const own = plan.groups.findIndex((g) => g.includes(head));
  const ownInner = own >= 0 ? plan.groups[own].filter((x) => inner.includes(x)) : [];
  const later = plan.groups.map((g, k) => (k === own ? [] : g.filter((x) => inner.includes(x)))).filter((g) => g.length);
  const group = [[head, ...ownInner], ...later];
  const moved = new Set(group.flat());
  const p = copy(plan);
  p.groups = p.groups.map((g) => g.filter((x) => !moved.has(x))).filter((g) => g.length);
  p.finals = p.finals.filter((x) => x !== head);
  const at = plan.groups.slice(0, Math.max(0, gap)).filter((g) => g.some((x) => !moved.has(x))).length;
  p.groups.splice(at, 0, ...group);
  return p;
}

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

export function setFinal(plan: Plan, i: number, on: boolean): Plan {
  if (plan.finals.includes(i) === on) return plan;
  const p = without(plan, i);
  if (on) p.finals = [...p.finals, i].sort((a, b) => a - b);
  else p.groups.push([i]);
  return p;
}

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

export function oneByOne(plan: Plan, eligible: boolean[]): Plan {
  const finals = plan.finals.filter((i) => eligible[i]);
  return { groups: eligible.flatMap((ok, i) => (ok && !finals.includes(i) ? [[i]] : [])), finals };
}

export function remapKeep(n: number, before: Item[], after: Item[]): number {
  const moved = before.flatMap((it, i) => (it.fragment && it.index === n && after[i].fragment && after[i].index !== null ? [after[i].index as number] : []));
  return moved.length ? Math.min(...moved) : n;
}
