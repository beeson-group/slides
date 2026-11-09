// the layers of a slide in the editor. every step of a slide is shown while it is edited, but an
// element that is hidden at a step, e.g. a derivation faded out and replaced by another one in its
// place, would then lie under the elements shown after it. the steps of such a slide are cut into
// layers at each step at which an element is hidden, and the slide is shown one layer at a time, as
// it is at the last step of the layer. a switch in the status bar chooses the layer, and a slide
// without such an element is shown whole, without the switch

export type Layer = { from: number; to: number };
type Fragment = { el: Element; step: number; kind: 'in' | 'out' | 'only' };

// a fade-out fragment is hidden from its step on, and current-visible and fade-in-then-out are shown
// at their step only. semi-fade-out and fade-in-then-semi-out are still seen, and do not cut a layer
const OUT = '.fade-out';
const ONLY = '.current-visible, .fade-in-then-out';
export const OFF = 'beeson-off';

// the fragments of a slide outside its notes, with their steps numbered from 1 in the order of
// reveal.js: by data-fragment-index, then the fragments without one in document order
function fragmentsOf(slide: Element): Fragment[] {
  const els = [...slide.querySelectorAll('.fragment')].filter((el) => !el.closest('aside.notes'));
  const given = els.map((el) => parseInt(el.getAttribute('data-fragment-index') ?? '', 10));
  let next = Math.max(0, ...given.filter((i) => !Number.isNaN(i))) + 1;
  const index = given.map((i) => (Number.isNaN(i) ? next++ : i));
  const order = [...new Set(index)].sort((a, b) => a - b);
  return els.map((el, i) => ({ el, step: order.indexOf(index[i]) + 1, kind: el.matches(OUT) ? 'out' : el.matches(ONLY) ? 'only' : 'in' }));
}

export function layersOf(slide: Element): Layer[] {
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

const shownAt = (f: Fragment, step: number): boolean => (f.kind === 'in' ? f.step <= step : f.kind === 'out' ? step < f.step : step === f.step);

// the fragments not shown at the last step of layer are marked with OFF, together with the
// fragments inside them, since the styles of the editor show every fragment. the fragments are in
// document order, hence an outer fragment is marked before the ones inside it. a null layer clears
// the marks
export function showLayer(slide: Element, layer: Layer | null): void {
  for (const f of fragmentsOf(slide)) {
    const up = f.el.parentElement?.closest('.fragment');
    f.el.classList.toggle(OFF, !!layer && (!shownAt(f, layer.to) || (!!up && up.classList.contains(OFF))));
  }
}

export function label(layer: Layer, last: boolean): string {
  if (layer.from === 0) return layer.to === 0 ? 'Before step 1' : `Up to step ${layer.to}`;
  if (last) return `From step ${layer.from}`;
  return layer.from === layer.to ? `Step ${layer.from}` : `Steps ${layer.from}–${layer.to}`;
}

export class Layers {
  readonly box = document.createElement('span');
  private readonly slide: () => Element | null;
  private readonly onChange: () => void;
  // the layer chosen on each slide, kept while the editor is open
  private readonly chosen = new WeakMap<Element, number>();
  private key = '';

  constructor(slide: () => Element | null, onChange: () => void) {
    this.slide = slide;
    this.onChange = onChange;
    this.box.className = 'beeson-layers';
    this.box.setAttribute('role', 'group');
    this.box.setAttribute('aria-label', 'Layer of the slide');
    this.box.hidden = true;
  }

  // the marks and the switch follow the current slide and its steps
  refresh(): void {
    const slide = this.slide();
    const layers = slide ? layersOf(slide) : [];
    if (!slide || layers.length < 2) {
      if (slide) showLayer(slide, null);
      this.box.hidden = true;
      this.box.replaceChildren();
      this.key = '';
      return;
    }
    const at = Math.min(this.chosen.get(slide) ?? 0, layers.length - 1);
    showLayer(slide, layers[at]);
    const labels = layers.map((l, i) => label(l, i === layers.length - 1));
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
      b.title = `Show the slide as it is at step ${layers[i].to}, without the elements hidden by then and those shown after it`;
      b.setAttribute('aria-pressed', String(i === at));
      b.classList.toggle('on', i === at);
      b.addEventListener('click', (ev) => {
        if (ev.detail > 0) b.blur();
        this.choose(slide, i);
      });
      return b;
    }));
  }

  private choose(slide: Element, i: number): void {
    this.chosen.set(slide, i);
    this.refresh();
    this.onChange();
  }

  // the layer in which el is shown is chosen, e.g. for an undo of a change to a hidden element
  reveal(el: Element): void {
    const slide = this.slide();
    if (!slide || !slide.contains(el) || !el.closest(`.${OFF}`)) return;
    const layers = layersOf(slide);
    for (let i = 0; i < layers.length; i++) {
      showLayer(slide, layers[i]);
      if (!el.closest(`.${OFF}`)) {
        this.choose(slide, i);
        return;
      }
    }
    this.refresh();
  }
}
