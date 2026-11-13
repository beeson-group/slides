// written from preamble.tex and references.bib by npm run tex and by a save in the editor.
// change the two sources, since this file is written again from them
window.beesonTex = {
  "macros": {
    "vb": ["\\boldsymbol{#1}",1],
    "R": "\\ensuremath{\\mathbb{R}}\\xspace",
    "norm": ["\\lVert #2 \\rVert_{#1}",2,"2"],
    "sgn": "\\operatorname{sgn}",
    "argmin": "\\operatorname*{arg\\,min}",
  },
  "environments": {
    "pmat": ["\\begin{pmatrix}","\\end{pmatrix}"],
  },
  "packages": ["physics"],
  "theorems": {
    "theorem": {"title":"Theorem","style":"plain","counter":"theorem"},
    "lemma": {"title":"Lemma","style":"plain","counter":"theorem"},
    "definition": {"title":"Definition","style":"definition","counter":"definition"},
    "note": {"title":"Note","style":"remark","counter":"note"},
  },
  "references": {},
};
