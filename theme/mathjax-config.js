window.MathJax = {
  loader: {
    paths: { fonts: new URL('vendor/mathjax', document.currentScript.src).href },
    load: (window.beesonTex?.packages ?? []).map((name) => `[tex]/${name}`),
  },
  tex: {
    inlineMath: [['\\(', '\\)']],
    displayMath: [['\\[', '\\]']],
    packages: { '[+]': window.beesonTex?.packages ?? [] },
    macros: { ensuremath: ['#1', 1], xspace: '', bm: ['\\boldsymbol{#1}', 1], ...(window.beesonTex?.macros ?? window.beesonMacros) },
    environments: { ...window.beesonTex?.environments },
  },
  output: {
    font: 'mathjax-tex',
    fontPath: new URL('vendor/mathjax/mathjax-tex-font', document.currentScript.src).href,
    linebreaks: { inline: false },
  },
  options: {
    ignoreHtmlClass: 'mathjax_ignore|label',
    menuOptions: { settings: { enrich: false, speech: false, braille: false } },
  },
  svg: {
    fontCache: 'global',
  },
};
