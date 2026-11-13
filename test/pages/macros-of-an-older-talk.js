// TeX macros of a deck, read in theme/mathjax-config.js, hence this file is loaded first. each
// value is a replacement string, or [replacement, number of arguments]
window.beesonMacros = {
  vb: ['\\boldsymbol{#1}', 1],
  // upright d with the spacing of an operator, as in \int f(x) \dd x
  dd: '\\mathop{}\\!\\mathrm{d}',
  R: '\\mathbb{R}',
  // a libration point, as in \LL{1}
  LL: ['\\mathcal{L}_{#1}', 1],
};
