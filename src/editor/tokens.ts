// a tokenizer of HTML that records the offset of every token in the text of index.html. the tree
// itself is parsed by DOMParser in source.ts, and the tokens are matched to its nodes in document
// order, which gives each node its bytes in the file

export type Range = { start: number; end: number };

export type Attr = { name: string; value: string | null } & Range;

export type Token =
  | ({ type: 'start'; name: string; attrs: Attr[]; selfClosing: boolean } & Range)
  | ({ type: 'end'; name: string } & Range)
  // raw is true inside script, style, and the other raw text elements, where a character
  // reference is not decoded
  | ({ type: 'text'; raw: boolean } & Range)
  | ({ type: 'comment' } & Range)
  // a doctype, a processing instruction, or a bogus comment
  | ({ type: 'other' } & Range);

// the elements whose content runs to the matching end tag, without character references
export const RAW_TEXT = new Set(['script', 'style', 'xmp', 'iframe', 'noembed', 'noframes']);
// the same, with character references
const RCDATA = new Set(['textarea', 'title']);

const isLetter = (c: string) => /^[A-Za-z]$/.test(c);
const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
// a < opens a tag, a comment, a doctype, or a processing instruction only before one of these
const opensMarkup = (c: string) => /^[A-Za-z!/?]$/.test(c);

export function tokenize(html: string): Token[] {
  const out: Token[] = [];
  const lower = html.toLowerCase();
  const n = html.length;
  let i = 0;
  // the element whose raw or RCDATA content comes next
  let rawFor: { name: string; raw: boolean } | null = null;

  const textUntilMarkup = (from: number): number => {
    let j = from;
    while (j < n && !(html[j] === '<' && j + 1 < n && opensMarkup(html[j + 1]))) j++;
    return j;
  };

  while (i < n) {
    if (rawFor) {
      // the content ends at the end tag of rawFor, in any case, followed by a space, a /, or a >
      let end = n;
      for (let k = lower.indexOf(`</${rawFor.name}`, i); k >= 0; k = lower.indexOf(`</${rawFor.name}`, k + 1)) {
        const after = html[k + 2 + rawFor.name.length] ?? '>';
        if (isSpace(after) || after === '/' || after === '>') { end = k; break; }
      }
      if (end > i) out.push({ type: 'text', raw: rawFor.raw, start: i, end });
      rawFor = null;
      i = end;
      continue;
    }
    const next = html[i + 1] ?? '';
    if (html[i] !== '<' || !opensMarkup(next)) {
      const end = textUntilMarkup(i + 1);
      out.push({ type: 'text', raw: false, start: i, end });
      i = end;
      continue;
    }
    if (html.startsWith('<!--', i)) {
      let end: number;
      if (html.startsWith('>', i + 4)) end = i + 5;
      else if (html.startsWith('->', i + 4)) end = i + 6;
      else {
        const k = html.indexOf('-->', i + 4);
        end = k < 0 ? n : k + 3;
      }
      out.push({ type: 'comment', start: i, end });
      i = end;
    } else if (next === '!' || next === '?' || (next === '/' && !isLetter(html[i + 2] ?? ''))) {
      const k = html.indexOf('>', i);
      const end = k < 0 ? n : k + 1;
      out.push({ type: 'other', start: i, end });
      i = end;
    } else if (next === '/') {
      let j = i + 2;
      while (j < n && !isSpace(html[j]) && html[j] !== '>' && html[j] !== '/') j++;
      const name = lower.slice(i + 2, j);
      const k = html.indexOf('>', j);
      const end = k < 0 ? n : k + 1;
      out.push({ type: 'end', name, start: i, end });
      i = end;
    } else {
      let j = i + 1;
      while (j < n && !isSpace(html[j]) && html[j] !== '>' && html[j] !== '/') j++;
      const name = lower.slice(i + 1, j);
      const attrs: Attr[] = [];
      let selfClosing = false;
      for (;;) {
        // a / between attributes is ignored unless it closes the tag
        while (j < n && (isSpace(html[j]) || html[j] === '/')) {
          selfClosing = html[j] === '/' && html[j + 1] === '>';
          j++;
        }
        if (j >= n || html[j] === '>') break;
        const nameStart = j;
        while (j < n && !isSpace(html[j]) && html[j] !== '>' && html[j] !== '/' && html[j] !== '=') j++;
        if (j === nameStart) { j++; continue; }
        const attrName = lower.slice(nameStart, j);
        let k = j;
        while (k < n && isSpace(html[k])) k++;
        if (html[k] !== '=') {
          attrs.push({ name: attrName, value: null, start: nameStart, end: j });
          continue;
        }
        k++;
        while (k < n && isSpace(html[k])) k++;
        const quote = html[k];
        if (quote === '"' || quote === "'") {
          const e = html.indexOf(quote, k + 1);
          const valueEnd = e < 0 ? n : e;
          attrs.push({ name: attrName, value: html.slice(k + 1, valueEnd), start: nameStart, end: Math.min(valueEnd + 1, n) });
          j = Math.min(valueEnd + 1, n);
        } else {
          let e = k;
          while (e < n && !isSpace(html[e]) && html[e] !== '>') e++;
          attrs.push({ name: attrName, value: html.slice(k, e), start: nameStart, end: e });
          j = e;
        }
      }
      const end = Math.min(j + 1, n);
      out.push({ type: 'start', name, attrs, selfClosing, start: i, end });
      i = end;
      if (RAW_TEXT.has(name)) rawFor = { name, raw: true };
      else if (RCDATA.has(name)) rawFor = { name, raw: false };
    }
  }
  return out;
}

// the classes of a start tag, from the raw value of its class attribute
export function classesOf(token: Token): string[] {
  if (token.type !== 'start') return [];
  const value = token.attrs.find((a) => a.name === 'class')?.value ?? '';
  return value.split(/\s+/).filter(Boolean);
}
