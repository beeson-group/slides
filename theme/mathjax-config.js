// MathJax configuration of a deck. load theme/macros.js, then this file, then
// theme/vendor/mathjax/tex-svg.js. the font path is resolved against the URL of this script, hence
// the same file serves index.html and pages in subfolders such as check/
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
    // the speech and Braille of the accessibility menu run SRE, the Speech Rule Engine, in a web
    // worker, which a page opened from file:// is not allowed to start, and theme/vendor/ does not
    // ship SRE
    menuOptions: { settings: { enrich: false, speech: false, braille: false } },
  },
  svg: {
    // one definition of each glyph per page, rather than one per formula
    fontCache: 'global',
  },
};
