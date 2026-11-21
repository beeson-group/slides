type Typesetter = { startup?: { promise?: Promise<unknown> }; tex2svgPromise?: (tex: string, options: { display: boolean }) => Promise<HTMLElement> };
type Waiting = { tex: string; put: (node: Element | null) => void };

const mathjax = () => (globalThis as { MathJax?: Typesetter }).MathJax;

const ESCAPED: Record<string, string> = { '{': '\\{', '}': '\\}', $: '\\$', '\\': '\\backslash ', '\u00a0': '~', '\u2212': '-' };

export function wordsTex(words: string): string {
  return words.split(/([{}$\\\u00a0\u2212])/).map((part, k) => (k % 2 ? ESCAPED[part] : part ? `\\text{${part}}` : '')).join('');
}

export function labelTex(source: string): string {
  return source.trim().split(/\\\(([\s\S]*?)\\\)/).map((part, k) => (k % 2 ? part : wordsTex(part.replace(/\s+/g, ' ')))).join('');
}

export function plotTex(source: string): string {
  return source.split('$').map((part, k) => (k % 2 ? part : wordsTex(part))).join('');
}

const formulas = new Map<string, Element>();
const queue: string[] = [];
const waiting = new Map<Element, Waiting>();
let typesetting: Promise<void> | null = null;

function untypeset(tex: string, reason: string): HTMLElement {
  const node = document.createElement('mjx-container');
  node.dataset.mjxError = reason;
  node.textContent = `$${tex}$`;
  return node;
}

async function typesetQueue(before: unknown): Promise<void> {
  await Promise.resolve(before).catch(() => undefined);
  let since = performance.now();
  while (queue.length) {
    const tex = queue[0];
    const mj = mathjax();
    const node = mj?.tex2svgPromise
      ? await mj.tex2svgPromise(tex, { display: false }).catch((error: unknown) => untypeset(tex, error instanceof Error ? error.message : String(error)))
      : untypeset(tex, 'MathJax is not loaded');
    node.removeAttribute('tabindex');
    formulas.set(tex, node);
    queue.shift();
    for (const [el, w] of waiting) {
      const done = formulas.get(w.tex);
      if (!done) continue;
      waiting.delete(el);
      w.put(done.cloneNode(true) as Element);
    }
    if (performance.now() - since > 8) {
      await new Promise((done) => setTimeout(done));
      since = performance.now();
    }
  }
  typesetting = null;
}

function request(tex: string): void {
  if (formulas.has(tex) || queue.includes(tex)) return;
  queue.push(tex);
  if (typesetting) return;
  const startup = mathjax()?.startup;
  typesetting = typesetQueue(startup?.promise);
  if (startup?.promise) startup.promise = typesetting;
}

export function prefetch(texs: string[]): void {
  for (const tex of texs) if (tex) request(tex);
}

export function typeset(el: Element, tex: string, put: (node: Element | null) => void): void {
  waiting.get(el)?.put(null);
  waiting.delete(el);
  const node = tex ? formulas.get(tex) : null;
  if (!tex || node) return put(node ? (node.cloneNode(true) as Element) : null);
  waiting.set(el, { tex, put });
  request(tex);
}

function named(node: Element, name: string): Element {
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', name.replace(/\s+/g, ' ').trim());
  return node;
}

export function setPlotText(el: HTMLElement, source: string): void {
  typeset(el, plotTex(source), (node) => {
    if (node || !source) el.replaceChildren(...(node ? [named(node, source.replaceAll('$', ''))] : []));
  });
}

export const LABEL_SOURCE = 'data-label-source';

export function labelSource(label: Element): string {
  return [...label.childNodes].map((n) => (n instanceof Element && n.hasAttribute(LABEL_SOURCE) ? n.getAttribute(LABEL_SOURCE) : n.textContent)).join('');
}

const shownAs = (label: Element, source: string) => label.childNodes.length === 1 && label.firstElementChild?.getAttribute(LABEL_SOURCE) === source;

export function typesetLabel(label: Element): Promise<void> {
  const source = labelSource(label);
  if (shownAs(label, source) || !source.trim()) return Promise.resolve();
  return new Promise((done) => typeset(label, labelTex(source), (node) => {
    if (node && labelSource(label) === source && !label.contains(document.activeElement)) {
      node.setAttribute(LABEL_SOURCE, source);
      label.replaceChildren(named(node, source.replace(/\\[()]/g, '')));
    }
    done();
  }));
}

export function typesetLabels(labels: Element[]): void {
  for (const label of labels) void typesetLabel(label);
}
