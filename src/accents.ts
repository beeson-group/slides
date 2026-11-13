// the plain text of a piece of TeX text, e.g. the title of a kind of theorem or a field of a
// BibTeX entry: an accent command becomes its letter, a special letter its character, and the
// braces are dropped. math between dollar signs is kept as it is written

// ACCENT is the combining character of each accent command of TeX
const ACCENT: Record<string, string> = {
  '`': '̀',
  "'": '́',
  '^': '̂',
  '~': '̃',
  '"': '̈',
  '=': '̄',
  '.': '̇',
  u: '̆',
  v: '̌',
  H: '̋',
  c: '̧',
  k: '̨',
  r: '̊',
  d: '̣',
  b: '̱',
};
const LETTER: Record<string, string> = { ss: 'ß', o: 'ø', O: 'Ø', l: 'ł', L: 'Ł', ae: 'æ', AE: 'Æ', oe: 'œ', OE: 'Œ', aa: 'å', AA: 'Å', i: 'ı', j: 'ȷ' };
// the letter under an accent is one letter or a dotless i or j, bare or in braces
const BASE = String.raw`(?:\{\s*(\\[ij]|[A-Za-z])\s*\}|(\\[ij](?![A-Za-z])|[A-Za-z]))`;
const SYMBOL_ACCENT = new RegExp(String.raw`\\([\`'^~"=.])\s*${BASE}`, 'g');
// an accent named by a letter is followed by a brace or a space, since \v before a letter would
// be the start of another command
const LETTER_ACCENT = new RegExp(String.raw`\\([uvHckrdb])(?:\s*\{\s*(\\[ij]|[A-Za-z])\s*\}|\s+(\\[ij](?![A-Za-z])|[A-Za-z]))`, 'g');

const accented = (_: string, accent: string, braced: string | undefined, bare: string | undefined): string => {
  const base = (braced ?? bare ?? '').replace('\\', '');
  return (base + ACCENT[accent]).normalize('NFC');
};

function words(tex: string): string {
  return tex
    .replace(SYMBOL_ACCENT, accented)
    .replace(LETTER_ACCENT, accented)
    .replace(/\\(ss|ae|AE|oe|OE|aa|AA|o|O|l|L|i|j)(?![A-Za-z])\s*/g, (_, name: string) => LETTER[name])
    .replace(/\\([{}])/g, (_, brace: string) => (brace === '{' ? '\u0001' : '\u0002'))
    .replace(/\\([&%#_])/g, '$1')
    .replace(/\\[,;: ]|~/g, ' ')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/``/g, '“')
    .replace(/''/g, '”')
    .replace(/\\[A-Za-z@]+\*?\s*/g, '')
    .replace(/[{}]/g, '')
    .replace(/\u0001/g, '{')
    .replace(/\u0002/g, '}');
}

/** The plain text of TeX text, with the math between dollar signs kept as it is written. */
export function plainText(tex: string): string {
  // an escaped dollar sign does not open math. the odd parts of the split are the math
  const parts = tex.replace(/\\\$/g, '\u0003').split(/(\$[^$]*\$)/);
  return parts
    .map((part, index) => (index % 2 ? part : words(part)))
    .join('')
    .replace(/\u0003/g, '$')
    .replace(/\s+/g, ' ')
    .trim();
}
