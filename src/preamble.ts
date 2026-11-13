// the reader of a LaTeX preamble. a definition that MathJax can hold is read into the form of its
// configuration, i.e. tex.macros and tex.environments, a package is mapped to the extension of
// MathJax with its commands, and a kind of theorem is read from \newtheorem. every other statement
// is skipped and listed with its reason. the reader does not depend on Node or on a browser, since
// it is run by scripts/tex.mjs and by the editor

import { plainText } from './accents.ts';

/** A macro in the form of tex.macros of MathJax: the body, the number of arguments, and the default of an optional first argument. */
export type MacroDef = string | [string, number] | [string, number, string];
/** An environment in the form of tex.environments of MathJax: the code at its begin and at its end, the number of arguments, and the default of an optional first argument. */
export type EnvironmentDef = [string, string] | [string, string, number] | [string, string, number, string];
export type Style = 'plain' | 'definition' | 'remark';
/** A kind of theorem: the title of its head, its style of amsthm, and the name of its counter, which is null for a kind without a number. */
export type Kind = { title: string; style: Style; counter: string | null };
export type Skipped = { file: string; line: number; text: string; reason: string };
export type Preamble = {
  macros: Record<string, MacroDef>;
  environments: Record<string, EnvironmentDef>;
  // the extensions of MathJax to load on top of those of every deck
  packages: string[];
  theorems: Record<string, Kind>;
  skipped: Skipped[];
};
/** Returns the file that a preamble names in \input, \usepackage, or \documentclass, or null when it is not next to the preamble. */
export type Resolve = (name: string, kind: 'input' | 'package' | 'class') => { file: string; text: string } | null;
export type Options = { file?: string; resolve?: Resolve };

const usual = (title: string, style: Style): Kind => ({ title, style, counter: null });
/** The kinds of theorem of every deck, which are not numbered unless the preamble defines them. */
export const USUAL: Record<string, Kind> = {
  theorem: usual('Theorem', 'plain'),
  lemma: usual('Lemma', 'plain'),
  proposition: usual('Proposition', 'plain'),
  corollary: usual('Corollary', 'plain'),
  definition: usual('Definition', 'definition'),
  example: usual('Example', 'definition'),
  remark: usual('Remark', 'remark'),
  proof: usual('Proof', 'remark'),
};
/** The kinds of a deck: the usual ones, replaced and followed by those of its preamble. */
export const kindsOf = (theorems: Record<string, Kind>): Record<string, Kind> => ({ ...USUAL, ...theorems });

// EXTENSION is the extension of MathJax with the commands of a package of LaTeX. an empty name
// marks a package whose commands every deck has, from the extension ams or from the theme
const EXTENSION: Record<string, string> = {
  amsmath: '',
  amssymb: '',
  amsfonts: '',
  amstext: '',
  amsbsy: '',
  amsopn: '',
  latexsym: '',
  amsthm: '',
  ntheorem: '',
  mathtools: 'mathtools',
  physics: 'physics',
  braket: 'braket',
  cancel: 'cancel',
  color: 'color',
  xcolor: 'color',
  bm: '',
  xspace: '',
  mhchem: 'mhchem',
  amscd: 'amscd',
  bussproofs: 'bussproofs',
  cases: 'cases',
  centernot: 'centernot',
  colortbl: 'colortbl',
  empheq: 'empheq',
  extpfeil: 'extpfeil',
  gensymb: 'gensymb',
  textcomp: 'textcomp',
  units: 'units',
  upgreek: 'upgreek',
};
// the extensions of MathJax for these packages need a font that is not in theme/vendor/mathjax
const UNVENDORED = new Set(['bbm', 'bbold', 'bboldx', 'dsfont']);
const STYLES = ['plain', 'definition', 'remark'];

class Skip extends Error {}

// a list of names in a sentence, with the serial comma
const listed = (names: string[]): string => (names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`);
// a line break and its indent read as one space, as in TeX
const tidy = (text: string): string => text.replace(/\s*\n\s*/g, ' ').trim();

// uncomment returns the text without its comments, and the line of the source of each character
// that is kept. as in TeX, a comment ends with its line and with the indent of the next line
function uncomment(source: string): { text: string; lines: number[] } {
  const src = source.replace(/\r\n?/g, '\n');
  let text = '';
  const lines: number[] = [];
  let line = 1;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\\' && i + 1 < src.length && src[i + 1] !== '\n') {
      text += c + src[i + 1];
      lines.push(line, line);
      i++;
    } else if (c === '%') {
      while (i < src.length && src[i] !== '\n') i++;
      line++;
      while (src[i + 1] === ' ' || src[i + 1] === '\t') i++;
    } else {
      text += c;
      lines.push(line);
      if (c === '\n') line++;
    }
  }
  return { text, lines };
}

/** Reads a LaTeX preamble into the macros and environments of MathJax, its extensions, and the kinds of theorem. */
export function readPreamble(source: string, options: Options = {}): Preamble {
  const macros: Record<string, MacroDef> = {};
  const environments: Record<string, EnvironmentDef> = {};
  const packages: string[] = [];
  const theorems: Record<string, Kind> = {};
  // the skipped statements, with the count of the statements read before each, since a \let is
  // skipped only once its target is defined again
  const skipped: (Skipped & { order: number })[] = [];
  // lets holds each macro that a \let made a second name of a command outside the preamble
  const lets = new Map<string, { target: string; entry: Omit<Skipped, 'reason'> & { order: number } }>();
  const files = new Set([options.file ?? 'preamble.tex']);
  let style: Style = 'plain';
  let order = 0;
  // set at \begin{document}, after which nothing is read in any file
  let done = false;

  const define = (macro: string, def: MacroDef): void => {
    for (const [alias, { target, entry }] of lets) {
      if (target !== macro) continue;
      delete macros[alias];
      lets.delete(alias);
      skipped.push({ ...entry, reason: `\\${macro} is defined again later in the preamble, and its first meaning cannot be kept` });
    }
    lets.delete(macro);
    macros[macro] = def;
  };

  const scan = (file: string, source: string): void => {
    const { text, lines } = uncomment(source);
    const n = text.length;
    // the start and the count of the statement that is read
    let from = 0;
    let at = 0;

    const space = (i: number): number => {
      while (i < n && /\s/.test(text[i])) i++;
      return i;
    };
    const entry = (end: number) => ({ order: at, file, line: lines[from], text: tidy(text.slice(from, end)) });
    const note = (end: number, reason: string): void => void skipped.push({ ...entry(end), reason });
    // the name of the control sequence at i, and the index after it
    const control = (i: number): [string, number] => {
      let end = i + 1;
      while (end < n && /[A-Za-z@]/.test(text[end])) end++;
      if (end === i + 1) end++;
      return [text.slice(i + 1, end), end];
    };
    // the text between the brace at i and its closing brace, and the index after it
    const group = (i: number): [string, number] => {
      if (text[i] !== '{') throw new Skip('a brace is expected');
      let depth = 0;
      for (let k = i; k < n; k++) {
        if (text[k] === '\\') k++;
        else if (text[k] === '{') depth++;
        else if (text[k] === '}' && --depth === 0) return [text.slice(i + 1, k), k + 1];
      }
      throw new Skip('a brace is not closed');
    };
    // the text of an optional argument after i, or null without one
    const bracket = (i: number): [string, number] | null => {
      const open = space(i);
      if (text[open] !== '[') return null;
      let depth = 0;
      for (let k = open + 1; k < n; k++) {
        if (text[k] === '\\') k++;
        else if (text[k] === '{') depth++;
        else if (text[k] === '}') depth--;
        else if (text[k] === ']' && depth === 0) return [text.slice(open + 1, k), k + 1];
      }
      throw new Skip('a bracket is not closed');
    };
    // an argument after i: a group, a control sequence, or one character, as in TeX
    const argument = (i: number): [string, number] => {
      const start = space(i);
      if (start >= n) throw new Skip('an argument is missing');
      if (text[start] === '{') {
        const [inner, end] = group(start);
        return [tidy(inner), end];
      }
      if (text[start] !== '\\') return [text[start], start + 1];
      const [name, end] = control(start);
      return [`\\${name}`, end];
    };
    // the name of the macro that is defined after i, bare or in braces
    const macroName = (i: number): [string, number] => {
      const [name, end] = argument(i);
      if (!/^\\([A-Za-z@]+|.)$/.test(name)) throw new Skip('the name of a macro is expected');
      return [name.slice(1), end];
    };
    // the number of arguments and the default of the first one, as after \newcommand{\name}
    const counts = (i: number, owner: string): [number, string | null, number] => {
      const count = bracket(i);
      if (!count) return [0, null, i];
      const args = Number(count[0]);
      if (!Number.isInteger(args) || args < 0 || args > 9) throw new Skip(`the number of arguments of ${owner} is not read`);
      const preset = bracket(count[1]);
      return preset ? [args, preset[0], preset[1]] : [args, null, count[1]];
    };
    // the end of the lines of a statement that is skipped: the line on which its braces are
    // closed, or its first line when they are not closed
    const lineEnd = (start: number): number => {
      let depth = 0;
      let first = -1;
      for (let k = start; k < n; k++) {
        if (text[k] === '\\') k++;
        else if (text[k] === '{') depth++;
        else if (text[k] === '}') depth--;
        else if (text[k] === '\n') {
          if (first < 0) first = k;
          if (depth <= 0) return k;
        }
      }
      return depth > 0 && first >= 0 ? first : n;
    };

    const read = (found: { file: string; text: string }): void => {
      files.add(found.file);
      scan(found.file, found.text);
    };

    const statement = (): number => {
      if (text[from] !== '\\') throw new Skip('not a definition');
      const [name, after] = control(from);
      let i = after;
      const starred = text[i] === '*';
      switch (name) {
        case 'newcommand':
        case 'renewcommand':
        case 'providecommand':
        case 'DeclareRobustCommand': {
          const [macro, a] = macroName(starred ? i + 1 : i);
          const [args, preset, b] = counts(a, `\\${macro}`);
          const [body, end] = argument(b);
          if (name !== 'providecommand' || !(macro in macros)) define(macro, preset !== null ? [body, args, preset] : args ? [body, args] : body);
          return end;
        }
        case 'def':
        case 'gdef': {
          const [macro, a] = macroName(i);
          const brace = text.indexOf('{', a);
          if (brace < 0) throw new Skip('a brace is expected');
          const params = text.slice(a, brace).replace(/\s/g, '');
          let args = 0;
          while (params.startsWith(`#${args + 1}`, 2 * args)) args++;
          if (params.length !== 2 * args) throw new Skip('a \\def with delimited parameters is not read');
          const [body, end] = argument(brace);
          define(macro, args ? [body, args] : body);
          return end;
        }
        case 'let': {
          const [alias, a] = macroName(i);
          let b = space(a);
          if (text[b] === '=') b = space(b + 1);
          if (text[b] !== '\\') throw new Skip('a \\let of a character is not read');
          const [target, end] = control(b);
          // a macro of the preamble is copied. a command from outside it is named, which holds
          // until the command is defined again
          const origin = lets.get(target)?.target ?? (target in macros ? null : target);
          const copy = macros[target];
          define(alias, origin !== null ? `\\${origin}` : Array.isArray(copy) ? ([...copy] as MacroDef) : copy);
          if (origin !== null) lets.set(alias, { target: origin, entry: entry(end) });
          return end;
        }
        case 'DeclareMathOperator': {
          const [macro, a] = macroName(starred ? i + 1 : i);
          const [body, end] = argument(a);
          define(macro, `\\operatorname${starred ? '*' : ''}{${body}}`);
          return end;
        }
        case 'newenvironment':
        case 'renewenvironment': {
          const [environment, a] = group(space(starred ? i + 1 : i));
          const [args, preset, b] = counts(a, `the environment ${environment}`);
          const [begin, c] = argument(b);
          const [finish, end] = argument(c);
          environments[environment.trim()] = preset !== null ? [begin, finish, args, preset] : args ? [begin, finish, args] : [begin, finish];
          return end;
        }
        case 'usepackage':
        case 'RequirePackage': {
          const [names, a] = group(space(bracket(i)?.[1] ?? i));
          const end = bracket(a)?.[1] ?? a;
          const missing: string[] = [];
          const unvendored: string[] = [];
          for (const pkg of names.split(',').map((s) => s.trim()).filter(Boolean)) {
            const found = options.resolve?.(pkg, 'package');
            if (found) {
              if (!files.has(found.file)) read(found);
            } else if (pkg in EXTENSION) {
              if (EXTENSION[pkg] && !packages.includes(EXTENSION[pkg])) packages.push(EXTENSION[pkg]);
            } else (UNVENDORED.has(pkg) ? unvendored : missing).push(pkg);
          }
          const reasons: string[] = [];
          if (missing.length) reasons.push(`MathJax does not have an extension for the package${missing.length > 1 ? 's' : ''} ${listed(missing)}`);
          if (unvendored.length) reasons.push(`the font of the package${unvendored.length > 1 ? 's' : ''} ${listed(unvendored)} is not vendored`);
          if (reasons.length) note(end, reasons.join(', and '));
          return end;
        }
        case 'documentclass':
        case 'LoadClass': {
          const [cls, a] = group(space(bracket(i)?.[1] ?? i));
          const found = options.resolve?.(cls.trim(), 'class');
          if (found && !files.has(found.file)) read(found);
          return bracket(a)?.[1] ?? a;
        }
        case 'input':
        case 'include': {
          while (text[i] === ' ' || text[i] === '\t') i++;
          let end = i;
          let named: string;
          if (text[i] === '{') [named, end] = group(i);
          else {
            while (end < n && !/\s/.test(text[end])) end++;
            named = text.slice(i, end);
          }
          const found = options.resolve?.(named.trim(), 'input');
          if (!found) note(end, `the file ${named.trim()} is not found`);
          else if (files.has(found.file)) note(end, `the file ${found.file} is read already`);
          else read(found);
          return end;
        }
        case 'theoremstyle': {
          const [named, end] = group(space(i));
          style = STYLES.includes(named.trim()) ? (named.trim() as Style) : 'plain';
          if (style !== named.trim()) note(end, `the style ${named.trim()} is not plain, definition, or remark, hence plain is used`);
          return end;
        }
        case 'newtheorem': {
          const [named, a] = group(space(starred ? i + 1 : i));
          const kind = named.trim();
          const shared = bracket(a);
          const [title, b] = group(space(shared?.[1] ?? a));
          const within = bracket(b);
          const end = within?.[1] ?? b;
          let counter: string | null = starred ? null : kind;
          if (!starred && shared) {
            const other = theorems[shared[0].trim()]?.counter;
            if (other) counter = other;
            else note(end, `the counter ${shared[0].trim()} is not the counter of a kind, hence ${kind} is numbered by itself`);
          } else if (!starred && within) note(end, `a number within ${within[0].trim()} is not read, hence ${kind} is numbered through the deck`);
          theorems[kind] = { title: plainText(title), style, counter };
          return end;
        }
        case 'begin': {
          const [environment] = group(space(i));
          if (environment.trim() !== 'document') throw new Skip('not a definition');
          done = true;
          return n;
        }
        case 'endinput':
          return n;
        case 'NeedsTeXFormat':
        case 'ProvidesPackage':
        case 'ProvidesClass':
        case 'ProvidesFile': {
          const [, a] = group(space(i));
          return bracket(a)?.[1] ?? a;
        }
        case 'makeatletter':
        case 'makeatother':
        case 'relax':
        case 'long':
        case 'global':
        case 'protected':
          return i;
        default:
          throw new Skip('not a definition');
      }
    };

    let i = 0;
    while (!done) {
      from = space(i);
      if (from >= n) break;
      at = ++order;
      try {
        i = statement();
      } catch (error) {
        if (!(error instanceof Skip)) throw error;
        i = lineEnd(from);
        note(i, error.message);
      }
    }
  };

  scan(options.file ?? 'preamble.tex', source);
  skipped.sort((a, b) => a.order - b.order);
  return { macros, environments, packages, theorems, skipped: skipped.map(({ file, line, text, reason }) => ({ file, line, text, reason })) };
}
