import { fileIndexes, notePlaced } from './shown-steps.ts';
import { stripRuntime } from './render.ts';
import { faceInfo, isLabel, typesetLabel } from './text/labels.ts';

export type MathInfo = { tex: string; open: string; close: string; display: boolean };
export type MathLookup = (el: Element) => MathInfo | null;

type MathItem = { math: string; display: boolean; start: { delim?: string }; end: { delim?: string }; typesetRoot?: Element };
type MathJaxApi = {
  startup: { promise: Promise<unknown>; document: { getMathItemsWithin(nodes: Element[]): MathItem[]; clearMathItemsWithin(nodes: Element[]): MathItem[] } };
  typesetClear(nodes: Element[]): void;
  typesetPromise(nodes: Element[]): Promise<unknown>;
  typeset?(nodes: Element[]): void;
  tex2svgPromise?(tex: string, options?: { display?: boolean }): Promise<Element>;
};

declare global {
  interface Window {
    MathJax?: MathJaxApi;
  }
}

const mathjax = (): MathJaxApi | null => (window.MathJax?.startup?.document ? window.MathJax : null);

function lookupOf(items: MathItem[]): MathLookup {
  const map = new Map<Element, MathInfo>();
  for (const item of items) if (item.typesetRoot) map.set(item.typesetRoot, { tex: item.math, display: item.display, open: item.start.delim ?? '', close: item.end.delim ?? '' });
  return (el) => map.get(el) ?? faceInfo(el);
}

export function mathLookup(): MathLookup {
  const mj = mathjax();
  return lookupOf(mj ? mj.startup.document.getMathItemsWithin([document.body]) : []);
}

export function mathIn(el: Element): MathLookup {
  const mj = el.querySelector('mjx-container') ? mathjax() : null;
  return lookupOf(mj ? mj.startup.document.getMathItemsWithin([el]) : []);
}

export async function previewTex(tex: string, display: boolean): Promise<{ node: Element | null; error: string | null }> {
  if (!tex.trim()) return { node: null, error: 'The formula is empty' };
  const mj = mathjax();
  if (!mj?.tex2svgPromise) return { node: null, error: null };
  const node = await mj.tex2svgPromise(tex, { display });
  const merror = node.querySelector('[data-mjx-error], mjx-merror');
  const error = merror ? (merror.getAttribute('data-mjx-error') ?? merror.textContent ?? 'TeX error') : null;
  return { node, error };
}

export async function retypeset(host: Element, container: Element, tex: string): Promise<boolean> {
  const mj = mathjax();
  if (!mj) return false;
  const lookup = mathLookup();
  const former = lookup(container);
  const count = host.querySelectorAll('mjx-container').length;
  const typeset = async (replacement: string) => {
    for (const c of [...host.querySelectorAll('mjx-container')]) {
      const info = lookup(c);
      if (!info) continue;
      c.replaceWith(document.createTextNode(info.open + (c === container ? replacement : info.tex) + info.close));
    }
    host.normalize();
    mj.typesetClear([host]);
    await mj.typesetPromise([host]);
    return host.querySelectorAll('mjx-container').length === count;
  };
  if (await typeset(tex)) return true;
  if (former) {
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    const source = former.open + tex + former.close;
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.nodeValue?.includes(source)) continue;
      text.nodeValue = text.nodeValue.replace(source, former.open + former.tex + former.close);
      break;
    }
    mj.typesetClear([host]);
    await mj.typesetPromise([host]);
  }
  return false;
}

export const mathReady = (): Promise<unknown> => window.MathJax?.startup?.promise ?? Promise.resolve();

export function contentWithTex(host: Element, replace?: ReadonlyMap<Element, string>): string {
  return withTex(host, replace).innerHTML;
}

function withTex(host: Element, replace?: ReadonlyMap<Element, string>, edit?: (copy: Element, at: (node: Node) => Node | null) => void): Element {
  const copy = host.cloneNode(true) as Element;
  const indexed = '[data-fragment-index]';
  fileIndexes([...host.querySelectorAll(indexed)], [...copy.querySelectorAll(indexed)]);
  stripRuntime(copy);
  const lookup = mathIn(host);
  const live = [...host.querySelectorAll('mjx-container')];
  const copies = [...copy.querySelectorAll('mjx-container')];
  copies.forEach((c, i) => {
    const info = lookup(live[i]);
    const tex = info ? (replace?.get(live[i]) ?? info.tex) : null;
    c.replaceWith(document.createTextNode(info ? info.open + tex + info.close : c.textContent ?? ''));
  });
  if (edit) {
    const at = (node: Node): Node | null => {
      const path: number[] = [];
      for (let n: Node = node; n !== host; n = n.parentNode!) {
        if (!n.parentNode) return null;
        path.unshift([...n.parentNode.childNodes].indexOf(n as ChildNode));
      }
      let out: Node = copy;
      for (const i of path) {
        const next = out.childNodes[i];
        if (!next) return null;
        out = next;
      }
      return out;
    };
    edit(copy, at);
  }
  copy.normalize();
  return copy;
}

export function contentWithInline(host: Element, range: Range, tex: string): { content: string; index: number } {
  const mark = '\ue000beeson-formula\ue000';
  const outside = (node: Node, offset: number): [Node, number] => {
    const math = (node instanceof Element ? node : node.parentElement)?.closest('mjx-container');
    if (math && host.contains(math)) return [math.parentNode!, [...math.parentNode!.childNodes].indexOf(math) + 1];
    return [node, offset];
  };
  const [sn, so] = outside(range.startContainer, range.startOffset);
  const [en, eo] = range.collapsed ? [sn, so] : outside(range.endContainer, range.endOffset);
  const copy = withTex(host, undefined, (_root, at) => {
    const start = at(sn);
    const end = at(en);
    if (!start || !end) throw new Error('the caret is not in a text element');
    const r = document.createRange();
    r.setStart(start, so);
    r.setEnd(end, eo);
    r.deleteContents();
    r.insertNode(document.createTextNode(mark));
  });
  let index = 0;
  const caret = document.createRange();
  caret.setStart(sn, so);
  for (const c of host.querySelectorAll('mjx-container')) if (caret.comparePoint(c, 0) < 0) index++;
  return { content: copy.innerHTML.replace(mark, escapeHtml(`\\(${tex}\\)`)), index };
}

const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\u00a0/g, '&nbsp;');

export async function setContentWithTex(host: Element, content: string): Promise<void> {
  const mj = mathjax();
  if (mj) mj.typesetClear([host]);
  if (!keepCode(host, content)) host.innerHTML = content;
  notePlaced(host);
  if (isLabel(host)) await typesetLabel(host);
  else if (mj) await mj.typesetPromise([host]);
}

function keepCode(host: Element, content: string): boolean {
  const code = host.localName === 'pre' && host.children.length === 1 ? host.firstElementChild : null;
  if (code?.localName !== 'code') return false;
  const t = document.createElement('template');
  t.innerHTML = content;
  const next = t.content.children.length === 1 ? t.content.firstElementChild : null;
  if (next?.localName !== 'code') return false;
  for (const a of [...code.attributes]) if (!next.hasAttribute(a.name)) code.removeAttribute(a.name);
  for (const a of [...next.attributes]) code.setAttribute(a.name, a.value);
  code.replaceChildren(...next.childNodes);
  host.replaceChildren(...[...t.content.childNodes].map((n) => (n === next ? code : n)));
  return true;
}

export type Macro = { name: string; args: number; body: string; default?: string; deck: boolean };

export function deckMacros(): Macro[] {
  type Def = string | [string, number, string?];
  const page = window as unknown as { beesonTex?: { macros?: Record<string, Def> }; beesonMacros?: Record<string, Def> };
  const raw = page.beesonTex?.macros ?? page.beesonMacros ?? {};
  return Object.entries(raw).map(([name, v]) => (Array.isArray(v) ? { name, body: String(v[0]), args: Number(v[1]) || 0, ...(v.length > 2 && { default: String(v[2]) }), deck: true } : { name, body: String(v), args: 0, deck: true }));
}

const COMMANDS: [string, number][] = [
  ['frac', 2], ['sqrt', 1], ['class', 2], ['dot', 1], ['ddot', 1], ['tilde', 1], ['hat', 1], ['bar', 1], ['vec', 1],
  ['mathrm', 1], ['mathbf', 1], ['mathcal', 1], ['mathbb', 1], ['boldsymbol', 1], ['text', 1], ['operatorname', 1],
  ['partial', 0], ['nabla', 0], ['cdot', 0], ['times', 0], ['pm', 0], ['mp', 0], ['int', 0], ['oint', 0], ['sum', 0], ['prod', 0],
  ['infty', 0], ['approx', 0], ['equiv', 0], ['propto', 0], ['sim', 0], ['le', 0], ['ge', 0], ['ll', 0], ['gg', 0], ['neq', 0],
  ['to', 0], ['mapsto', 0], ['rightarrow', 0], ['leftarrow', 0], ['Rightarrow', 0], ['in', 0], ['subset', 0], ['cup', 0], ['cap', 0],
  ['left', 0], ['right', 0], ['quad', 0], ['qquad', 0], ['ldots', 0], ['cdots', 0], ['dagger', 0], ['top', 0],
  ['sin', 0], ['cos', 0], ['tan', 0], ['exp', 0], ['log', 0], ['ln', 0], ['det', 0], ['max', 0], ['min', 0], ['lim', 0],
  ['begin', 1], ['end', 1],
  ...['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'varphi', 'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi', 'Omega'].map((g): [string, number] => [g, 0]),
];

export function completions(prefix: string, macros: Macro[], limit = 8): Macro[] {
  const lower = prefix.toLowerCase();
  const names = new Set(macros.map((m) => m.name));
  const all = [...macros, ...COMMANDS.filter(([n]) => !names.has(n)).map(([name, args]) => ({ name, args, body: '', deck: false }))];
  const rank = (m: Macro) => {
    if (m.name.startsWith(prefix)) return 0;
    if (m.name.toLowerCase().startsWith(lower)) return 1;
    return m.name.toLowerCase().includes(lower) ? 2 : -1;
  };
  return all
    .map((m, i) => ({ m, i, r: rank(m) }))
    .filter((x) => x.r >= 0 && !(x.m.name === prefix && !x.m.args))
    .sort((a, b) => a.r - b.r || Number(b.m.deck) - Number(a.m.deck) || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.m);
}

export function isName(name: string, macros: Macro[]): boolean {
  return macros.some((m) => m.name === name) || COMMANDS.some(([n]) => n === name);
}

const SAMPLES: Record<string, string | null> = {
  frac: '\\frac{a}{b}', class: null, text: '\\text{ab}', operatorname: '\\operatorname{op}', mathrm: '\\mathrm{d}',
  mathbf: '\\mathbf{v}', mathcal: '\\mathcal{L}', mathbb: '\\mathbb{R}', boldsymbol: '\\boldsymbol{\\mu}',
  left: '\\left(\\,\\right.', right: '\\left.\\,\\right)', quad: '|\\quad|', qquad: '|\\qquad|', begin: null, end: null,
};

export function sampleTex(m: Macro): string | null {
  if (!m.deck && Object.hasOwn(SAMPLES, m.name)) return SAMPLES[m.name];
  return `\\${m.name}${'{x}'.repeat(m.args)}`;
}

const glyphs = new Map<string, Promise<Element | null>>();

export function glyphOf(m: Macro): Promise<Element | null> {
  const tex = sampleTex(m);
  if (tex === null) return Promise.resolve(null);
  let out = glyphs.get(tex);
  if (!out) {
    out = previewTex(tex, false).then((r) => (r.error ? null : r.node), () => null);
    glyphs.set(tex, out);
  }
  return out;
}

export function completionText(m: Macro): { text: string; caret: number } {
  const text = `\\${m.name}${'{}'.repeat(m.args)}`;
  return { text, caret: m.args ? m.name.length + 2 : text.length };
}

function closing(tex: string, open: number): number {
  let depth = 0;
  for (let i = open; i < tex.length; i++) {
    if (tex[i] === '\\') i++;
    else if (tex[i] === '{') depth++;
    else if (tex[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

export function balanced(part: string): boolean {
  let depth = 0;
  for (let i = 0; i < part.length; i++) {
    if (part[i] === '\\') i++;
    else if (part[i] === '{') depth++;
    else if (part[i] === '}' && --depth < 0) return false;
  }
  return depth === 0;
}

export type Marked = { name: string; body: string; start: number; end: number; bodyStart: number };

export function classesIn(tex: string): Marked[] {
  const out: Marked[] = [];
  const re = /\\class\s*\{/g;
  for (let m = re.exec(tex); m; m = re.exec(tex)) {
    const nameOpen = m.index + m[0].length - 1;
    const nameClose = closing(tex, nameOpen);
    if (nameClose < 0) break;
    let open = nameClose + 1;
    while (tex[open] === ' ') open++;
    if (tex[open] !== '{') continue;
    const close = closing(tex, open);
    if (close < 0) break;
    out.push({ name: tex.slice(nameOpen + 1, nameClose).trim(), body: tex.slice(open + 1, close), start: m.index, end: close + 1, bodyStart: open + 1 });
  }
  return out;
}

export function suggestName(body: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const words = body
    .replace(/\\(tilde|hat|bar|dot|ddot|vec|mathrm|mathbf|mathcal|mathbb|boldsymbol|left|right|operatorname|text)(?![A-Za-z])/g, ' ')
    .replace(/\\([A-Za-z]+)/g, ' $1 ')
    .match(/[A-Za-z0-9]+/g) ?? [];
  let stem = words.join('-').toLowerCase().slice(0, 24).replace(/-+$/, '');
  if (!/^[a-z]/.test(stem)) stem = stem ? `sym-${stem}` : 'sym';
  if (!used.has(stem)) return stem;
  for (let i = 2; ; i++) if (!used.has(`${stem}-${i}`)) return `${stem}-${i}`;
}

export function wrapClass(tex: string, start: number, end: number, name: string): { tex: string; name: string } {
  let s = Math.min(start, end);
  let e = Math.max(start, end);
  while (s < e && /\s/.test(tex[s])) s++;
  while (e > s && /\s/.test(tex[e - 1])) e--;
  if (s === e) throw new Error('Select a symbol in the TeX first');
  for (const c of classesIn(tex)) {
    if ((c.bodyStart === s && c.end - 1 === e) || (c.start === s && c.end === e)) return { tex, name: c.name };
  }
  const part = tex.slice(s, e);
  if (!balanced(part)) throw new Error('The selection is not a whole symbol, since its braces are not balanced');
  return { tex: `${tex.slice(0, s)}\\class{${name}}{${part}}${tex.slice(e)}`, name };
}

export function unwrapClass(tex: string, name: string): string {
  const found = classesIn(tex).filter((c) => c.name === name).reverse();
  let out = tex;
  for (const c of found) out = out.slice(0, c.start) + c.body + out.slice(c.end);
  return out;
}
