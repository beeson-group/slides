// MathJax configuration of a deck. load the tex.js of the deck, then this file, then
// theme/vendor/mathjax/tex-svg.js. the font path is resolved against the URL of this script, hence
// the same file is used for index.html and for pages in subfolders such as check/
window.MathJax = {
  loader: {
    // the font of a TeX package is loaded from this folder, in place of the CDN of MathJax
    paths: { fonts: new URL('vendor/mathjax', document.currentScript.src).href },
    // the extensions for the packages of the preamble. the other ones are loaded at their first macro
    load: (window.beesonTex?.packages ?? []).map((name) => `[tex]/${name}`),
  },
  tex: {
    inlineMath: [['\\(', '\\)']],
    displayMath: [['\\[', '\\]']],
    packages: { '[+]': window.beesonTex?.packages ?? [] },
    // the macros and the environments of preamble.tex, which npm run tex writes into tex.js, after
    // three commands of LaTeX that MathJax does not have
    macros: { ensuremath: ['#1', 1], xspace: '', bm: ['\\boldsymbol{#1}', 1], ...window.beesonTex?.macros },
    environments: { ...window.beesonTex?.environments },
  },
  output: {
    font: 'mathjax-tex',
    fontPath: new URL('vendor/mathjax/mathjax-tex-font', document.currentScript.src).href,
    // an inline formula is kept on one line, since MathJax 4 would otherwise break it at a
    // relation, as in "e" at the end of one line and "= 0.295" at the start of the next
    linebreaks: { inline: false },
  },
  options: {
    // the speech and Braille of the accessibility menu are run with SRE, the Speech Rule Engine, in
    // a web worker. this worker cannot be started from a page opened from file://, and SRE is not
    // in theme/vendor/
    menuOptions: { settings: { enrich: false, speech: false, braille: false } },
  },
  svg: {
    // one definition of each glyph per page, rather than one per formula
    fontCache: 'global',
  },
};
