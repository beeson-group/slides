// the commands of the Code pane of the Format tab, and the colors of a code box in the editor. the
// language of a box is the class language-* of its code, and its line steps are the groups of
// lines of data-line-numbers, separated by bars, e.g. 1-2|3|4-5. the first group is lit with the
// slide and each next group at a step. the highlight plugin of reveal.js is not run in the editor,
// since it replaces the code by a table of lines, hence the editor colors the tokens of
// highlight.js with the CSS Custom Highlight API, which leaves the DOM as the file has it

import type { App } from '../app.ts';
import { insertPlain } from '../text/typing.ts';
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
  // the code is inside the text element of its pre, hence it is paired among the elements inside text elements
  const src = code ? app.pairing?.elements.get(code) ?? app.pairing?.inner.get(code) : null;
  return code && src?.open && code.closest('section') ? code : null;
}

const classesOf = (app: App, code: Element): string[] => app.doc.tagState(code).classes;

export function languageOf(app: App, code: Element): string | null {
  const c = classesOf(app, code).find((c) => /^language-[\w-]+$/.test(c));
  return c ? c.slice('language-'.length) : null;
}

const LINES = 'data-line-numbers';
// why Number the Lines is dimmed, since reveal.js steps through the lines of a numbered box only
const NUMBERS_WHY = 'The line steps need the line numbers.';
// the size of the code of a small box
const SMALL = '18px';

// whether the pre of code is set small in the file
export const isSmall = (app: App, code: Element): boolean => app.doc.tagState(code.closest('pre') as Element).style['font-size']?.trim() === SMALL;

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

// the groups of a box after its text before was changed to after, as a code editor moves its marks
// of lines: a group after the lines that changed is moved by the lines added or deleted, and a
// group on a deleted line is put on the line before it, so that the box keeps its steps
export function shiftGroups(groups: string[], before: string, after: string): string[] {
  const a = before.replace(/\n$/, '').split('\n');
  const b = after.replace(/\n$/, '').split('\n');
  if (a.length === b.length) return groups;
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const endA = a.length - s;
  const endB = b.length - s;
  const line = (n: number): number => {
    if (n - 1 < p) return n;
    if (n - 1 >= endA) return n + b.length - a.length;
    return endB > p ? Math.min(n - 1, endB - 1) + 1 : Math.max(1, p);
  };
  return groups.map((g) => {
    const parts = g.split(',').map((part) => {
      const [x, y = x] = part.split('-').map(Number);
      const [u, v] = [line(x), line(y)];
      return u === v ? String(u) : `${u}-${v}`;
    });
    return parts.filter((q, k) => q !== parts[k - 1]).join(',');
  });
}

// the indent of a new line typed at the caret in code, i.e. the spaces and tabs at the start of
// the line of the caret that are before the caret
function indentAt(code: Element): string {
  const s = document.getSelection();
  if (!s?.rangeCount || !code.contains(s.getRangeAt(0).startContainer)) return '';
  const r = document.createRange();
  r.setStart(code, 0);
  r.setEnd(s.getRangeAt(0).startContainer, s.getRangeAt(0).startOffset);
  return /^[ \t]*/.exec(r.toString().split('\n').pop() ?? '')?.[0] ?? '';
}

// whether an input may add or delete a line of a box, i.e. a new line, a paste, a drop, or a
// delete of a text with a newline
function addsOrDeletesLines(ev: InputEvent): boolean {
  const type = ev.inputType;
  if (type === 'insertParagraph' || type === 'insertLineBreak' || type.startsWith('insertFrom') || type === 'insertReplacementText' || ev.data?.includes('\n')) return true;
  const text = (r: StaticRange | Range) => {
    const range = document.createRange();
    range.setStart(r.startContainer, r.startOffset);
    range.setEnd(r.endContainer, r.endOffset);
    return range.toString();
  };
  const s = document.getSelection();
  if (s?.rangeCount && !s.isCollapsed && text(s.getRangeAt(0)).includes('\n')) return true;
  return type.startsWith('delete') && ev.getTargetRanges().some((r) => text(r).includes('\n'));
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
  ['keyword', 'violet'], ['literal', 'violet'], ['meta', 'violet'], ['built_in', 'trajectory-3'], ['title', 'accent'],
  ['params', 'trajectory-6'], ['string', 'trajectory-4'], ['number', 'trajectory-5'], ['comment', 'muted'], ['operator', 'subtle'],
];
const NAME = (token: string) => `beeson-code-${token.replace(/_/g, '-')}`;
const DIM = 'beeson-code-dim';
// the numbers of the lines of a box with data-line-numbers, drawn while the deck is edited at
// the left of its code, as the table of the highlight plugin draws them in the deck
const NUMBERS = `
html.beeson-editor .reveal pre[data-beeson-lines] { position: relative; }
html.beeson-editor .reveal pre[data-beeson-lines]::before { content: attr(data-beeson-lines); position: absolute; top: 24px; left: 32px; white-space: pre; text-align: right; color: var(--muted); pointer-events: none; user-select: none; }
${[1, 2, 3].map((d) => `html.beeson-editor .reveal pre[data-beeson-digits="${d}"]::before { width: ${d}ch; }
html.beeson-editor .reveal pre[data-beeson-digits="${d}"] > code { padding-left: calc(${d}ch + 1em); }`).join('\n')}
`;

const STYLE = [
  ...TOKENS.map(([t, color]) => `::highlight(${NAME(t)}) { color: var(--${color}); }`),
  `::highlight(${DIM}) { color: var(--muted); }`,
  NUMBERS,
].join('\n');

// the numbers of the lines of each box of the slide whose lines are numbered in the file, as an
// attribute of the page only, which the save does not write
function numberLines(app: App): void {
  for (const pre of app.slides().querySelectorAll('pre')) {
    const code = pre.querySelector(':scope > code');
    const on = !!code && code.hasAttribute(LINES);
    const count = on ? Math.max(1, (code!.textContent ?? '').replace(/\n$/, '').split('\n').length) : 0;
    const lines = on ? Array.from({ length: count }, (_, k) => String(k + 1)).join('\n') : null;
    if (lines === null) {
      pre.removeAttribute('data-beeson-lines');
      pre.removeAttribute('data-beeson-digits');
    } else if (pre.getAttribute('data-beeson-lines') !== lines) {
      pre.setAttribute('data-beeson-lines', lines);
      pre.setAttribute('data-beeson-digits', String(Math.min(3, String(count).length)));
    }
  }
}

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

// the box of the first character of line n of code, counted from 1, or null for a line that code
// does not have or that is not drawn
export function lineRect(code: Element, n: number): DOMRect | null {
  const { nodes, starts, text } = textNodes(code);
  let at = 0;
  for (let k = 1; k < n; k++) {
    at = text.indexOf('\n', at) + 1;
    if (at <= 0) return null;
  }
  const box = rangeOf(nodes, starts, at, Math.min(text.length, at + 1))?.getClientRects()[0];
  return box && box.height ? box : null;
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
    why: (a) => (codeAt(a) ? NUMBERS_WHY : null),
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
  // Small sets the code at 18 px, the one size of a box that the scope rule allows besides the
  // 22 px of the theme, written as font-size on the pre. off takes the declaration out again
  c.define({
    id: 'code.small',
    label: 'Small Code',
    enabled: (a) => !!codeAt(a),
    checked: (a) => {
      const code = codeAt(a);
      return !!code && isSmall(a, code);
    },
    undoable: true,
    run: (a, arg) => {
      const code = need(a, arg);
      const given = (arg as { on?: unknown } | undefined)?.on;
      const on = typeof given === 'boolean' ? given : !isSmall(a, code);
      if (on === isSmall(a, code)) return;
      a.doc.setTag(code.closest('pre') as Element, { style: { 'font-size': on ? SMALL : null } }, on ? 'Smaller' : 'Bigger');
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
      numberLines(app);
      paint(app);
    });
  };
  // Return in a box starts a line with the indent of the line of the caret. an input that adds or
  // deletes lines of a box with line steps is one entry of the history with the shift of its
  // groups, which ends at the input event after it. the listeners are on the window, before and
  // after those of text/typing.ts on the document
  let pending: { code: Element; before: string; finish: () => void } | null = null;
  const settle = () => {
    const p = pending;
    if (!p) return;
    pending = null;
    try {
      const s = stepsOf(app, p.code);
      const groups = shiftGroups(s.groups, p.before, p.code.textContent ?? '');
      if (groups.join('|') !== s.groups.join('|')) writeSteps(app, p.code, true, groups);
    } finally {
      p.finish();
    }
  };
  window.addEventListener('beforeinput', (ev) => {
    const host = app.hostOf(ev.target);
    const code = host?.closest('pre')?.querySelector(':scope > code') ?? null;
    if (!host || !code || pending) return;
    if (codeAt(app, { el: code }) && stepsOf(app, code).groups.length && addsOrDeletesLines(ev)) {
      let finish = () => {};
      const done = new Promise<void>((d) => (finish = d));
      pending = { code, before: code.textContent ?? '', finish };
      void app.history.transact('typing', () => done).catch((e) => app.fail(e));
      setTimeout(settle, 0);
    }
    if (ev.inputType === 'insertParagraph' || ev.inputType === 'insertLineBreak') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      app.history.break();
      app.history.beforeTyping(host);
      insertPlain(host, `\n${indentAt(code)}`);
    }
  }, true);
  window.addEventListener('input', settle);
  app.onRefresh(['content', 'slide', 'structure'], later);
  app.listen('slide', later);
  document.addEventListener('input', later, true);
  later();
}
