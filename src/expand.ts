// the expansion of the macros of a preamble in a text that is not set by MathJax, e.g. a label of a
// plot. the macros are those of window.beesonTex, written into tex.js by npm run tex, in the form of
// tex.macros of MathJax, with the three macros that theme/mathjax-config.js adds to every deck

import type { MacroDef } from './preamble.ts';

/** The macros that theme/mathjax-config.js gives every deck, before the macros of its preamble. */
export const THEME_MACROS: Record<string, MacroDef> = { ensuremath: ['#1', 1], xspace: '', bm: ['\\boldsymbol{#1}', 1] };

// the depth of nested macros at which a macro is left as it is, e.g. one that calls itself
const DEPTH = 10;

/** The macros of the deck with those of the theme, or null in a deck without tex.js. */
export function deckMacros(): Record<string, MacroDef> | null {
  const tex = (globalThis as { window?: { beesonTex?: { macros?: Record<string, MacroDef> } } }).window?.beesonTex;
  return tex ? { ...THEME_MACROS, ...tex.macros } : null;
}

// a group in braces without them, a command, or one character, starting at i, and the index after it
function argument(s: string, i: number): [string, number] {
  if (s[i] === '{') {
    let depth = 0, j = i;
    for (; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}' && --depth === 0) break;
    }
    return [s.slice(i + 1, j), j + 1];
  }
  const command = /^\\(?:[A-Za-z]+|.)/.exec(s.slice(i));
  if (command) return [command[0], i + command[0].length];
  return [s[i] ?? '', i + 1];
}

// an optional argument in brackets at i, outside braces, or null where there is none
function optional(s: string, i: number): [string, number] | null {
  if (s[i] !== '[') return null;
  let depth = 0;
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}') depth--;
    else if (s[j] === ']' && depth === 0) return [s.slice(i + 1, j), j + 1];
  }
  return null;
}

const skipSpaces = (s: string, i: number): number => {
  while (s[i] === ' ' || s[i] === '\t' || s[i] === '\n') i++;
  return i;
};

function expand(s: string, macros: Record<string, MacroDef>, depth: number, math: boolean): string {
  if (depth > DEPTH) return s;
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '$') {
      math = !math;
      out += c;
      i++;
      continue;
    }
    if (c !== '\\') {
      out += c;
      i++;
      continue;
    }
    const name = /^\\([A-Za-z]+)/.exec(s.slice(i))?.[1];
    const def = name !== undefined && Object.hasOwn(macros, name) ? macros[name] : undefined;
    if (name === undefined || def === undefined) {
      // a command that is not a macro, or a backslash with the character after it, e.g. \{ or \\
      const keep = name !== undefined ? name.length + 1 : 2;
      out += s.slice(i, i + keep);
      i += keep;
      continue;
    }
    const [body, count = 0, preset] = typeof def === 'string' ? [def] : def;
    let j = i + 1 + name.length;
    // TeX drops the spaces after the name of a command. in a text they are kept, since there a
    // macro such as \sat\xspace is followed by the space that \xspace would put there
    if (math || count) j = skipSpaces(s, j);
    const args: string[] = [];
    if (preset !== undefined && count > 0) {
      const given = optional(s, j);
      args.push(given ? given[0] : preset);
      if (given) j = given[1];
    }
    while (args.length < count) {
      j = skipSpaces(s, j);
      const [arg, next] = argument(s, j);
      args.push(arg);
      j = next;
    }
    const filled = body.replace(/#([1-9])/g, (m, k: string) => args[Number(k) - 1] ?? m);
    // \ensuremath outside the math of a text puts its argument into math
    out += name === 'ensuremath' && !math ? `$${expand(filled, macros, depth + 1, true)}$` : expand(filled, macros, depth + 1, math);
    i = j;
  }
  return out;
}

/**
 * Expands each macro in src, with its arguments, the default of an optional first argument, and
 * the macros in its body, down to a depth. The macros are those of the deck with those of the theme
 * by default, and a deck without tex.js has nothing to expand.
 */
export function expandMacros(src: string, macros?: Record<string, MacroDef>): string {
  const all = macros ? { ...THEME_MACROS, ...macros } : deckMacros();
  return all && src.includes('\\') ? expand(src, all, 0, false) : src;
}
