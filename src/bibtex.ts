// a BibTeX parser for the bibliography of a deck. an entry is read with its type, its key, and
// its fields, whose values keep their TeX text, e.g. the braces that hold a name together. an
// entry that is not read is skipped and listed with its reason, and the entries after it are read.
// the parser does not depend on Node or on a browser, since it is run by scripts/tex.mjs and by
// the editor

import { plainText } from './accents.ts';

/** An entry of a bibliography, with the line of its start and its place in the source, from start up to end. */
export type Entry = { type: string; key: string; fields: Record<string, string>; line: number; start: number; end: number };
export type SkippedEntry = { line: number; text: string; reason: string };
export type Bibliography = { entries: Entry[]; skipped: SkippedEntry[] };

const MONTHS: Record<string, string> = {
  jan: 'January',
  feb: 'February',
  mar: 'March',
  apr: 'April',
  may: 'May',
  jun: 'June',
  jul: 'July',
  aug: 'August',
  sep: 'September',
  oct: 'October',
  nov: 'November',
  dec: 'December',
};
// the characters of the name of a field or of a string
const NAME = /^[^\s,#{}()"=@]+/;

class Skip extends Error {}

const tidy = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** The plain text of a field of an entry, which is empty without the field. */
export const plain = (entry: Entry, field: string): string => plainText(entry.fields[field] ?? '');

/** Reads the entries of a BibTeX source. */
export function readBibtex(source: string): Bibliography {
  const n = source.length;
  const strings = new Map(Object.entries(MONTHS));
  const entries: Entry[] = [];
  const skipped: SkippedEntry[] = [];
  const keys = new Set<string>();

  const space = (i: number): number => {
    while (i < n && /\s/.test(source[i])) i++;
    return i;
  };
  const unclosed = (shut: string): Skip => new Skip(shut === '}' ? 'a brace is not closed' : 'a parenthesis is not closed');
  const name = (i: number): string => NAME.exec(source.slice(i, i + 200))?.[0] ?? '';
  // the index after the group that is opened at i. as in BibTeX, a backslash does not escape a
  // brace or a quote
  const group = (i: number): number => {
    const paren = source[i] === '(';
    let depth = paren ? 1 : 0;
    for (let k = i; k < n; k++) {
      if (source[k] === '{') depth++;
      else if (source[k] === '}') depth--;
      else if (paren && source[k] === ')' && depth === 1) depth--;
      if (depth === 0) return k + 1;
    }
    throw unclosed(paren ? ')' : '}');
  };
  // the value at i, i.e. texts in braces or in quotes, numbers, and names of strings, joined at #
  const value = (i: number, field: string): [string, number] => {
    let text = '';
    for (;;) {
      i = space(i);
      if (source[i] === '{') {
        const end = group(i);
        text += source.slice(i + 1, end - 1);
        i = end;
      } else if (source[i] === '"') {
        let depth = 0;
        let k = i + 1;
        for (; k < n && !(source[k] === '"' && depth === 0); k++) {
          if (source[k] === '{') depth++;
          else if (source[k] === '}' && --depth < 0) break;
        }
        if (source[k] !== '"') throw new Skip('a quote is not closed');
        text += source.slice(i + 1, k);
        i = k + 1;
      } else {
        const word = name(i);
        if (!word) throw new Skip(`the field ${field} does not have a value`);
        text += /^\d+$/.test(word) ? word : (strings.get(word.toLowerCase()) ?? word);
        i += word.length;
      }
      i = space(i);
      if (source[i] !== '#') return [text, i];
      i++;
    }
  };
  // the field at i, as its name and its value, and the index after it
  const field = (i: number, shut: string): [string, string, number] => {
    const named = name(i);
    if (!named) throw i >= n || source[i] === '@' ? unclosed(shut) : new Skip('the name of a field is expected');
    const equals = space(i + named.length);
    if (source[equals] !== '=') throw new Skip(`the field ${named} does not have a value`);
    const [text, end] = value(equals + 1, named);
    return [named.toLowerCase(), text, end];
  };

  const entry = (start: number, type: string, open: number, line: number): number => {
    const shut = source[open] === '{' ? '}' : ')';
    let i = space(open + 1);
    const key = /^[^\s,{}()"=#@]*/.exec(source.slice(i, i + 500))?.[0] ?? '';
    i = space(i + key.length);
    if (!key || (source[i] !== ',' && source[i] !== shut)) throw new Skip('the entry does not have a key');
    const fields: Record<string, string> = {};
    let last = '';
    while (source[i] !== shut) {
      if (i >= n || source[i] === '@') throw unclosed(shut);
      if (source[i] !== ',') throw new Skip(`a comma is missing after the field ${last}`);
      i = space(i + 1);
      if (source[i] === shut) break;
      const [named, text, end] = field(i, shut);
      // as in BibTeX, the first of two fields of one name is kept
      if (!(named in fields)) fields[named] = tidy(text);
      last = named;
      i = space(end);
    }
    if (keys.has(key)) throw new Skip(`the key ${key} is the key of an entry above`);
    keys.add(key);
    entries.push({ type, key, fields, line, start, end: i + 1 });
    return i + 1;
  };

  let seen = 0;
  let line = 1;
  let i = 0;
  while ((i = source.indexOf('@', i)) >= 0) {
    const start = i;
    const head = /^@([A-Za-z]+)\s*[{(]/.exec(source.slice(i, i + 80));
    // an @ in the text between the entries, e.g. in an address
    if (!head) {
      i++;
      continue;
    }
    for (; seen < start; seen++) if (source[seen] === '\n') line++;
    const type = head[1].toLowerCase();
    const open = start + head[0].length - 1;
    try {
      if (type === 'comment' || type === 'preamble') i = group(open);
      else if (type === 'string') {
        const shut = source[open] === '{' ? '}' : ')';
        const [named, text, end] = field(space(open + 1), shut);
        if (source[space(end)] !== shut) throw unclosed(shut);
        strings.set(named, text);
        i = space(end) + 1;
      } else i = entry(start, type, open, line);
    } catch (error) {
      if (!(error instanceof Skip)) throw error;
      const eol = source.indexOf('\n', start);
      i = eol < 0 ? n : eol;
      skipped.push({ line, text: source.slice(start, i).trim(), reason: error.message });
    }
  }
  return { entries, skipped };
}
