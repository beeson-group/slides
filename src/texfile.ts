// the script tex.js of a deck, which is written next to index.html from the preamble.tex and the
// references.bib of the talk: the macros and the environments for MathJax, the kinds of theorem,
// and the references of the entries that the deck cites. the script is a classic script, since a
// deck opened from a file cannot read the text of a file next to it. it is written by scripts/tex.mjs
// and by a save in the editor, with the same text

import type { Bibliography } from './bibtex.ts';
import type { EnvironmentDef, Kind, MacroDef, Preamble } from './preamble.ts';
import { referenceOf, type Reference } from './reference.ts';

/** The content of tex.js, i.e. the value of window.beesonTex in a deck. */
export type Tex = {
  macros: Record<string, MacroDef>;
  environments: Record<string, EnvironmentDef>;
  // the extensions of MathJax to load on top of those of every deck
  packages: string[];
  // the kinds of theorem of the preamble, without the usual ones of the theme
  theorems: Record<string, Kind>;
  // the references of the cited entries, by key
  references: Record<string, Reference>;
};

/** The keys of the citations of a deck, each once, in the order of the file. */
export function citedKeys(html: string): string[] {
  const keys = new Set<string>();
  const text = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[\s\S]*?<\/script\s*>/gi, '');
  for (const match of text.matchAll(/<cite\b[^>]*?\sdata-key\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    for (const key of (match[1] ?? match[2]).split(',')) if (key.trim()) keys.add(key.trim());
  }
  return [...keys];
}

/** The content of tex.js for a deck, and the keys that the deck cites without an entry of the bibliography. */
export function texOf(preamble: Preamble, bibliography: Bibliography, html: string): { tex: Tex; missing: string[] } {
  const entries = new Map(bibliography.entries.map((entry) => [entry.key, entry]));
  const references: Record<string, Reference> = {};
  const missing: string[] = [];
  // in the order of the keys, so that a slide moved in the deck does not change the script
  for (const key of citedKeys(html).sort()) {
    const entry = entries.get(key);
    if (entry) references[key] = referenceOf(entry);
    else missing.push(key);
  }
  const { macros, environments, packages, theorems } = preamble;
  return { tex: { macros, environments, packages, theorems, references }, missing };
}

// a value as JSON in ASCII, since the script is read in the encoding of its page
const ascii = (value: unknown): string => JSON.stringify(value).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

/** The text of tex.js, with one line per macro, environment, kind, and reference. */
export function texScript(tex: Tex): string {
  const lines = ['// written from preamble.tex and references.bib by npm run tex and by a save in the editor.', '// change the two sources, since this file is written again from them', 'window.beesonTex = {'];
  for (const [name, part] of Object.entries(tex)) {
    const entries = Array.isArray(part) ? [] : Object.entries(part);
    if (!entries.length) lines.push(`  ${ascii(name)}: ${ascii(part)},`);
    else lines.push(`  ${ascii(name)}: {`, ...entries.map(([key, value]) => `    ${ascii(key)}: ${ascii(value)},`), '  },');
  }
  lines.push('};');
  return `${lines.join('\n')}\n`;
}

/** The source of a preamble with the macros of a theme/macros.js of an older talk, each under its comment lines. */
export function preambleOf(macros: Record<string, MacroDef>, comments: Record<string, string[]> = {}): string {
  const lines = ['% the macros of the talk. npm run tex reads them into tex.js for MathJax'];
  for (const [name, def] of Object.entries(macros)) {
    const [body, args, preset] = Array.isArray(def) ? def : [def, 0];
    lines.push(...(comments[name] ?? []).map((comment) => `% ${comment}`));
    lines.push(`\\newcommand{\\${name}}${args ? `[${args}]` : ''}${preset === undefined ? '' : `[${preset}]`}{${body}}`);
  }
  return `${lines.join('\n')}\n`;
}
