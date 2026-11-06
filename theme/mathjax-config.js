// MathJax configuration of a deck. load theme/macros.js, then this file, then
// theme/vendor/mathjax/tex-svg.js. the font path is resolved against the URL of this script, hence
// the same file is used for index.html and for pages in subfolders such as check/
window.MathJax = {
  tex: {
    inlineMath: [['\\(', '\\)']],
    displayMath: [['\\[', '\\]']],
    macros: window.beesonMacros ?? {},
  },
  output: {
    font: 'mathjax-stix2',
    fontPath: new URL('vendor/mathjax/mathjax-stix2-font', document.currentScript.src).href,
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
