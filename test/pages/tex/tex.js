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
  "references": {
    "gomez2004": {"authors":"G\u00f3mez et al.","title":"Connecting orbits and invariant manifolds in the spatial restricted three-body problem","venue":"Nonlinearity","volume":"17","year":"2004","doi":"10.1088/0951-7715/17/5/002"},
    "koon2000": {"authors":"Koon et al.","title":"Heteroclinic connections between periodic orbits and resonance transitions in celestial mechanics","venue":"Chaos","volume":"10","year":"2000","doi":"10.1063/1.166509"},
    "szebehely1967": {"authors":"Szebehely","title":"Theory of Orbits: The Restricted Problem of Three Bodies","venue":"Academic Press","year":"1967"},
  },
};
