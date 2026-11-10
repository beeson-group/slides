// the commands of the Code pane of the Format tab, and the colors of a code box in the editor. the
// language of a box is the class language-* of its code, and its line steps are the groups of
// lines of data-line-numbers, separated by bars, e.g. 1-2|3|4-5. the first group is lit with the
// slide and each next group at a step. the highlight plugin of reveal.js is not run in the editor,
// since it replaces the code by a table of lines, hence the editor colors the tokens of
// highlight.js with the CSS Custom Highlight API, which leaves the DOM as the file has it

import type { App } from '../app.ts';
import { injectStyle } from '../ui/dom.ts';

type Hljs = {
  highlight(code: string, o: { language: string; ignoreIllegals: boolean }): { value: string };
  highlightAuto(code: string): { value: string; language?: string };
  listLanguages(): string[];
  getLanguage(name: string): { name?: string } | undefined;
};

// highlight.js of the highlight plugin, which a deck loads from theme/vendor/reveal/highlight.js
let lib: Hljs | null | undefined;
export function hljsOf(): Hljs | null {
  if (lib !== undefined) return lib;
  try {
    lib = (window as { RevealHighlight?: () => { hljs?: Hljs } }).RevealHighlight?.().hljs ?? null;
  } catch {
    lib = null;
  }
  return lib;
}

// the names of the languages most used in a talk of the group, and their names for a deck that
// does not load highlight.js
export const COMMON: [string, string][] = [
  ['python', 'Python'], ['julia', 'Julia'], ['matlab', 'MATLAB'], ['cpp', 'C++'], ['c', 'C'], ['fortran', 'Fortran'],
  ['rust', 'Rust'], ['javascript', 'JavaScript'], ['typescript', 'TypeScript'], ['bash', 'Bash'], ['json', 'JSON'],
  ['yaml', 'YAML'], ['latex', 'LaTeX'], ['markdown', 'Markdown'], ['xml', 'HTML, XML'],
];
export const PLAIN = 'plaintext';

// the languages that a box can be given, by name, each with its name in the menu
export function languages(): [string, string][] {
  const hljs = hljsOf();
  if (!hljs) return COMMON;
  return hljs.listLanguages().filter((n) => /^[\w-]+$/.test(n) && n !== PLAIN).map((n): [string, string] => [n, nameOf(n)]).sort((a, b) => a[1].localeCompare(b[1]));
}

export const nameOf = (language: string | null): string => {
  if (language === null) return 'Automatic';
  if (language === PLAIN) return 'Plain Text';
  return COMMON.find(([n]) => n === language)?.[1] ?? hljsOf()?.getLanguage(language)?.name ?? language;
};

// the code of the code box of the argument or of the selection: a selected box, or a box with the
// caret, whose code has a tag in the file
export function codeAt(app: App, arg?: unknown): Element | null {
  const given = (arg as { el?: unknown } | undefined)?.el;
  const sel = app.selection;
  const el = given instanceof Element ? given : sel.only() ?? (sel.kind === 'text' ? sel.items[0] ?? null : null);
  const pre = el?.closest('pre');
  const code = pre?.querySelector(':scope > code') ?? null;
  // the code is inside the block of its pre, hence it is paired among the elements inside blocks
  const src = code ? app.pairing?.elements.get(code) ?? app.pairing?.inner.get(code) : null;
  return code && src?.open && code.closest('section') ? code : null;
}

const classesOf = (app: App, code: Element): string[] => app.doc.tagState(code).classes;

export function languageOf(app: App, code: Element): string | null {
  const c = classesOf(app, code).find((c) => /^language-[\w-]+$/.test(c));
  return c ? c.slice('language-'.length) : null;
}

const LINES = 'data-line-numbers';

// the line steps of a box: whether its lines are numbered, and its groups
export function stepsOf(app: App, code: Element): { numbers: boolean; groups: string[] } {
  const raw = app.doc.tagState(code).attrs[LINES];
  if (raw === undefined) return { numbers: false, groups: [] };
  const value = raw.replace(/\s+/g, '');
  return { numbers: true, groups: value ? value.split('|') : [] };
}

// a group of lines, e.g. 3, 1-2, or 1,3-5, checked and written without spaces
export function checkGroup(group: string): string {
  const g = group.replace(/\s+/g, '').replace(/–/g, '-');
  if (!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(g)) throw new Error(`the lines ${group || '(none)'} are not a group of lines, e.g. 3, 1-2, or 1,3-5`);
  for (const part of g.split(',')) {
    const [a, b = a] = part.split('-').map(Number);
    if (a < 1 || b < a) throw new Error(`the lines ${part} are not a range of lines from line 1`);
  }
  return g;
}

function writeSteps(app: App, code: Element, numbers: boolean, groups: string[]): void {
  const value = groups.length ? groups.join('|') : numbers ? '' : null;
  const now = app.doc.tagState(code).attrs[LINES] ?? null;
  if (value !== now) app.doc.setTag(code, { attrs: { [LINES]: value } }, 'line steps');
}

// the lines of the box from the first to the last line of the selected text in it, counted from 1.
// a selection that ends at the start of a line does not take that line
export function selectedLines(code: Element): [number, number] | null {
  const s = document.getSelection();
  if (!s || !s.rangeCount) return null;
  const r = s.getRangeAt(0);
  if (!code.contains(r.startContainer) || !code.contains(r.endContainer)) return null;
  const lineAt = (node: Node, offset: number) => {
    const before = document.createRange();
    before.setStart(code, 0);
    before.setEnd(node, offset);
    const text = before.toString();
    return { line: text.split('\n').length, atStart: text.endsWith('\n') };
  };
  const a = lineAt(r.startContainer, r.startOffset).line;
  const end = lineAt(r.endContainer, r.endOffset);
  const b = end.atStart && end.line > a && !r.collapsed ? end.line - 1 : end.line;
  return [a, Math.max(a, b)];
}

// the numbers of the lines of a group, e.g. 1,3-4 is 1, 3, and 4
export function linesOf(group: string): Set<number> {
  const out = new Set<number>();
  for (const part of group.split(',')) {
    const [a, b = a] = part.split('-').map(Number);
    for (let n = a; n <= Math.min(b, a + 10000); n++) out.add(n);
  }
  return out;
}

// the scopes of highlight.js that the theme colors in beeson.css, with the property of the color
const TOKENS: [string, string][] = [
  ['keyword', 'violet'], ['literal', 'violet'], ['meta', 'violet'], ['built_in', 'strand-3'], ['title', 'accent'],
  ['params', 'strand-6'], ['string', 'strand-4'], ['number', 'strand-5'], ['comment', 'muted'], ['operator', 'subtle'],
];
const NAME = (token: string) => `beeson-code-${token.replace(/_/g, '-')}`;
const DIM = 'beeson-code-dim';
const STYLE = [
  ...TOKENS.map(([t, color]) => `::highlight(${NAME(t)}) { color: var(--${color}); }`),
  `::highlight(${DIM}) { color: var(--muted); }`,
].join('\n');

type Token = [number, number, string];
const cache = new Map<string, Token[]>();

// the tokens of text in language, null for highlightAuto, as offsets into text with the scope of
// each. a text node of the result takes the scope of its innermost span with a colored scope
function tokensOf(hljs: Hljs, text: string, language: string | null): Token[] {
  const key = `${language ?? ''}\u0000${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let html = '';
  try {
    html = language && hljs.getLanguage(language) ? hljs.highlight(text, { language, ignoreIllegals: true }).value : language ? '' : hljs.highlightAuto(text).value;
  } catch {
    html = '';
  }
  const out: Token[] = [];
  if (html) {
    const t = document.createElement('template');
    t.innerHTML = html;
    const walk = document.createTreeWalker(t.content, NodeFilter.SHOW_TEXT);
    let at = 0;
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const len = (n.nodeValue ?? '').length;
      let scope: string | undefined;
      for (let up = n.parentElement; up && !scope; up = up.parentElement) scope = TOKENS.find(([s]) => up!.classList.contains(`hljs-${s}`))?.[0];
      if (scope && len) out.push([at, at + len, scope]);
      at += len;
    }
  }
  if (cache.size > 200) cache.clear();
  cache.set(key, out);
  return out;
}

// the point at offset in the text of code, over its text nodes
function pointAt(nodes: Text[], starts: number[], offset: number): [Text, number] | null {
  for (let k = nodes.length - 1; k >= 0; k--) if (starts[k] <= offset) return [nodes[k], Math.min(offset - starts[k], nodes[k].length)];
  return null;
}

function textNodes(code: Element): { nodes: Text[]; starts: number[]; text: string } {
  const nodes: Text[] = [];
  const starts: number[] = [];
  let text = '';
  const walk = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
    nodes.push(n);
    starts.push(text.length);
    text += n.data;
  }
  return { nodes, starts, text };
}

function rangeOf(nodes: Text[], starts: number[], a: number, b: number): Range | null {
  const p = pointAt(nodes, starts, a);
  const q = pointAt(nodes, starts, b);
  if (!p || !q) return null;
  const r = new Range();
  r.setStart(p[0], p[1]);
  r.setEnd(q[0], q[1]);
  return r;
}

type Highlights = { set(name: string, h: unknown): void; delete(name: string): void };
const registry = (): Highlights | null => (typeof CSS !== 'undefined' && 'highlights' in CSS ? (CSS as unknown as { highlights: Highlights }).highlights : null);
const HighlightOf = (): (new (...r: Range[]) => { priority: number }) | null => (window as unknown as { Highlight?: new (...r: Range[]) => { priority: number } }).Highlight ?? null;

// the code boxes of the current slide colored by the tokens of their language. a box of Plain
// Text is not colored, and a box without a language is colored by the language that highlight.js
// guesses, as the highlight plugin does
export function paint(app: App): void {
  const reg = registry();
  const H = HighlightOf();
  const hljs = hljsOf();
  if (!reg || !H || !hljs) return;
  const ranges = new Map<string, Range[]>(TOKENS.map(([t]) => [t, []]));
  const slide = app.current();
  for (const code of slide?.querySelectorAll('pre > code') ?? []) {
    const lang = [...code.classList].find((c) => /^language-[\w-]+$/.test(c))?.slice('language-'.length) ?? null;
    if (lang === PLAIN || code.classList.contains('nohighlight')) continue;
    const { nodes, starts, text } = textNodes(code);
    if (!text.trim()) continue;
    for (const [a, b, scope] of tokensOf(hljs, text, lang)) {
      const r = rangeOf(nodes, starts, a, b);
      if (r) ranges.get(scope)?.push(r);
    }
  }
  for (const [t] of TOKENS) reg.set(NAME(t), new H(...(ranges.get(t) ?? [])));
}

// the lines of code outside group drawn dim, e.g. while its group is pointed at in the Code pane,
// or none for null
export function dimLines(code: Element | null, group: string | null): void {
  const reg = registry();
  const H = HighlightOf();
  if (!reg || !H) return;
  if (!code || group === null) {
    reg.delete(DIM);
    return;
  }
  const keep = linesOf(group);
  const { nodes, starts, text } = textNodes(code);
  const out: Range[] = [];
  let at = 0;
  text.split('\n').forEach((line, k) => {
    if (!keep.has(k + 1) && line.length) {
      const r = rangeOf(nodes, starts, at, at + line.length);
      if (r) out.push(r);
    }
    at += line.length + 1;
  });
  const h = new H(...out);
  h.priority = 1;
  reg.set(DIM, h);
}

export function install(app: App): void {
  injectStyle('code', STYLE);
  const c = app.commands;
  const need = (a: App, arg: unknown): Element => {
    const code = codeAt(a, arg);
    if (!code) throw new Error('select a code box, i.e. a pre with a code, first');
    return code;
  };
  // the language of a box, null for Automatic, or plaintext for Plain Text. the class is the one
  // of the highlight plugin, and the other classes of the code are kept
  c.define({
    id: 'code.language',
    label: 'Set Language of Code',
    enabled: (a) => !!codeAt(a),
    undoable: true,
    run: (a, arg) => {
      const code = need(a, arg);
      const language = (arg as { language: string | null }).language;
      if (language !== null && !/^[\w-]+$/.test(language)) throw new Error(`${language} is not the name of a language of highlight.js`);
      const classes: Record<string, boolean> = {};
      for (const k of classesOf(a, code)) if (/^language-/.test(k) && k !== `language-${language}`) classes[k] = false;
      if (language !== null && !classesOf(a, code).includes(`language-${language}`)) classes[`language-${language}`] = true;
      if (Object.keys(classes).length) a.doc.setTag(code, { classes }, 'language');
    },
  });
  c.define({
    id: 'code.numbers',
    label: 'Number the Lines',
    enabled: (a) => {
      const code = codeAt(a);
      return !!code && !stepsOf(a, code).groups.length;
    },
    checked: (a) => {
      const code = codeAt(a);
      return !!code && stepsOf(a, code).numbers;
    },
    undoable: true,
    run: (a, arg) => {
      const code = need(a, arg);
      const s = stepsOf(a, code);
      writeSteps(a, code, !s.numbers, s.groups);
    },
  });
  // the groups typed into the field of the pane, e.g. 1-2|3|4-5, or none
  c.define({
    id: 'code.lines',
    label: 'Set Line Steps',
    undoable: true,
    run: (a, arg) => {
      const code = need(a, arg);
      const value = String((arg as { value: string }).value ?? '').trim();
      const groups = value ? value.split('|').map(checkGroup) : [];
      writeSteps(a, code, stepsOf(a, code).numbers || groups.length > 0, groups);
    },
  });
  c.define({
    id: 'code.addGroup',
    label: 'Add Selected Lines as a Step',
    enabled: (a) => {
      const code = codeAt(a);
      return !!code && !!selectedLines(code);
    },
    undoable: true,
    run: (a, arg) => {
      const code = need(a, arg);
      const given = (arg as { lines?: [number, number] } | undefined)?.lines;
      const lines = given ?? selectedLines(code);
      if (!lines) throw new Error('select the lines of the step in the code box first');
      const [from, to] = lines;
      const s = stepsOf(a, code);
      writeSteps(a, code, true, [...s.groups, checkGroup(from === to ? String(from) : `${from}-${to}`)]);
    },
  });
  c.define({
    id: 'code.removeGroup',
    label: 'Remove Line Step',
    undoable: true,
    run: (a, arg) => {
      const code = need(a, arg);
      const index = (arg as { index: number }).index;
      const s = stepsOf(a, code);
      if (!(index >= 0 && index < s.groups.length)) return;
      writeSteps(a, code, true, s.groups.filter((_, k) => k !== index));
    },
  });
  let frame = 0;
  const later = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      paint(app);
    });
  };
  app.onRefresh(['content', 'slide', 'structure'], later);
  app.listen('slide', later);
  document.addEventListener('input', later, true);
  later();
}
