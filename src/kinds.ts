// the kinds of theorem, e.g. a lemma, a definition, and a proof. the file is apart from the reader of
// a preamble, since the theme draws a theorem from its kind and does not read a preamble

export type Style = 'plain' | 'definition' | 'remark';
/** A kind of theorem: the title of its head, its style of amsthm, and the name of its counter, which is null for a kind without a number. */
export type Kind = { title: string; style: Style; counter: string | null };

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
