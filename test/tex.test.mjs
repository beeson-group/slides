// the script tex.js of a deck: the keys that a deck cites, the content of the script and its text
// of src/texfile.ts, and the command npm run tex of scripts/tex.mjs, which writes the script from
// the preamble.tex and the references.bib next to the deck, and which turns the theme/macros.js of
// an older talk into a preamble.tex

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { readBibtex } from '../src/bibtex.ts';
import { readPreamble } from '../src/preamble.ts';
import { citedKeys, preambleOf, texOf, texScript } from '../src/texfile.ts';
import { deckTex } from '../scripts/tex.mjs';

const BIB = `@article{koon2000, author = {Koon, Wang Sang and Lo, Martin W. and Marsden, Jerrold E. and Ross, Shane D.}, title = {Heteroclinic connections}, journal = {Chaos}, volume = 10, year = 2000, doi = {10.1063/1.166509}, abstract = {Never written into the script}}
@article{gomez2004, author = {G{\\'o}mez, G. and Koon, W. S.}, title = {Connecting orbits}, journal = {Nonlinearity}, volume = 17, year = 2004}
@book{szebehely1967, author = {Szebehely, Victor}, title = {Theory of Orbits}, publisher = {Academic Press}, year = 1967}
`;
const PREAMBLE = `\\usepackage{physics}
\\usepackage{tikz}
\\newcommand{\\vb}[1]{\\boldsymbol{#1}}
\\newcommand{\\R}{\\mathbb{R}}
\\newtheorem{theorem}{Theorem}
`;
const page = (body, head = '<script src="tex.js"></script>') =>
  `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n${head}\n<script src="theme/mathjax-config.js"></script>\n</head>\n<body>\n<div class="reveal"><div class="slides">\n${body}\n</div></div>\n</body>\n</html>\n`;
const DECK = page('<section><p>Tubes<cite data-key="koon2000"></cite> and orbits<cite data-key="szebehely1967, koon2000"></cite>.</p></section>');

// the object that a script tex.js assigns to window.beesonTex
const run = (script) => {
  const window = {};
  vm.runInNewContext(script, { window });
  return JSON.parse(JSON.stringify(window.beesonTex));
};
// a folder of a deck, deleted after the test
const folder = (t, files) => {
  const root = mkdtempSync(join(tmpdir(), 'slides tex-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(root, name, '..'), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  return root;
};
const tex = (root, ...args) => execFileSync(process.execPath, [resolve('scripts/tex.mjs'), join(root, 'index.html'), ...args], { encoding: 'utf8', stdio: 'pipe' });

test('the keys of a deck are those of its citations, each once, without those of a comment or a script', () => {
  const html = `<section><p>A<cite data-key="b"></cite> and<cite class="x" data-key='a, c'></cite><cite data-key="b,d" class="fragment"></cite></p>
<!-- <cite data-key="comment"></cite> -->
<script type="application/json">{"text": "<cite data-key=\\"script\\"></cite>"}</script>
<cite>a title without a key</cite><cite data-key=""></cite><p data-key="p"></p></section>`;
  assert.deepEqual(citedKeys(html), ['b', 'a', 'c', 'd']);
  assert.deepEqual(citedKeys('<section></section>'), []);
});

test('the script holds the macros, the kinds, and only the cited entries, as references in the house form', () => {
  const { tex: content, missing } = texOf(readPreamble(PREAMBLE), readBibtex(BIB), DECK.replace('szebehely1967, koon2000', 'szebehely1967, nokey, koon2000'));
  assert.deepEqual(content, {
    macros: { vb: ['\\boldsymbol{#1}', 1], R: '\\mathbb{R}' },
    environments: {},
    packages: ['physics'],
    theorems: { theorem: { title: 'Theorem', style: 'plain', counter: 'theorem' } },
    references: {
      koon2000: { authors: 'Koon et al.', title: 'Heteroclinic connections', venue: 'Chaos', volume: '10', year: '2000', doi: '10.1063/1.166509' },
      szebehely1967: { authors: 'Szebehely', title: 'Theory of Orbits', venue: 'Academic Press', year: '1967' },
    },
  });
  assert.deepEqual(missing, ['nokey']);
});

test('the text of the script is one assignment in ASCII, with the references in the order of their keys', () => {
  const html = page('<section><cite data-key="szebehely1967"></cite><cite data-key="gomez2004"></cite></section>');
  const { tex: content } = texOf(readPreamble(PREAMBLE), readBibtex(BIB), html);
  const script = texScript(content);
  assert.deepEqual(run(script), content);
  assert.match(script, /^\/\/ [^\n]*\n(\/\/ [^\n]*\n)*window\.beesonTex = \{\n/);
  assert.ok(script.endsWith('};\n'));
  assert.ok(!/[^\x20-\x7e\n]/.test(script), 'a character outside ASCII');
  assert.ok(script.indexOf('"gomez2004"') < script.indexOf('"szebehely1967"'));
  assert.ok(script.includes('G\\u00f3mez & Koon'));
  // one line per macro and per reference, so that a change is one line of a diff
  assert.ok(script.includes('\n    "vb": ["\\\\boldsymbol{#1}",1],\n'));
  assert.equal(texScript(texOf(readPreamble(PREAMBLE), readBibtex(BIB), html).tex), script);
});

test('the macros of an older talk are written as a preamble that reads as the same macros', () => {
  const macros = { vb: ['\\boldsymbol{#1}', 1], dd: '\\mathop{}\\!\\mathrm{d}', norm: ['\\lVert #2 \\rVert_{#1}', 2, '2'] };
  const source = preambleOf(macros, { dd: ['upright d with the spacing of an operator, as in \\int f(x) \\dd x'] });
  assert.ok(source.includes('% upright d with the spacing of an operator, as in \\int f(x) \\dd x\n\\newcommand{\\dd}{\\mathop{}\\!\\mathrm{d}}\n'));
  assert.ok(source.includes('\\newcommand{\\norm}[2][2]{\\lVert #2 \\rVert_{#1}}\n'));
  const read = readPreamble(source);
  assert.deepEqual(read.macros, macros);
  assert.deepEqual(read.skipped, []);
});

test('npm run tex writes tex.js next to the deck and prints what it skipped and what is cited without an entry', (t) => {
  const root = folder(t, {
    'index.html': DECK.replace('data-key="koon2000"', 'data-key="koon2000,lost1999"'),
    'preamble.tex': `${PREAMBLE}\\input{more}\n\\usepackage{mine}\n`,
    'more.tex': '\\newcommand{\\more}{m}\n',
    'mine.sty': '\\ProvidesPackage{mine}\n\\DeclareMathOperator{\\sgn}{sgn}\n',
    'references.bib': `${BIB}@article{open, title = {Not closed\n`,
  });
  const out = tex(root);
  const script = readFileSync(join(root, 'tex.js'), 'utf8');
  const content = run(script);
  assert.deepEqual(Object.keys(content.macros), ['vb', 'R', 'more', 'sgn']);
  assert.deepEqual(Object.keys(content.references), ['koon2000', 'szebehely1967']);
  assert.ok(!script.includes('Never written'));
  assert.match(out, /tex\.js: 4 macros, 0 environments, 1 kind of theorem, and 2 references/);
  assert.match(out, /preamble\.tex:2: \\usepackage\{tikz\}: MathJax does not have an extension for the package tikz/);
  assert.match(out, /references\.bib:4: @article\{open, title = \{Not closed: a brace is not closed/);
  assert.match(out, /index\.html: the key lost1999 is cited, and it is not in references\.bib/);
  // a second run writes the same bytes
  tex(root);
  assert.equal(readFileSync(join(root, 'tex.js'), 'utf8'), script);
  assert.equal(deckTex(join(root, 'index.html')).text, script);
});

test('npm run tex bundles the readers of src/ under a Node that does not read TypeScript', (t) => {
  const root = folder(t, { 'index.html': DECK, 'preamble.tex': PREAMBLE, 'references.bib': BIB });
  tex(root);
  const script = readFileSync(join(root, 'tex.js'), 'utf8');
  rmSync(join(root, 'tex.js'));
  execFileSync(process.execPath, ['--no-experimental-strip-types', resolve('scripts/tex.mjs'), join(root, 'index.html')], { stdio: 'pipe' });
  assert.equal(readFileSync(join(root, 'tex.js'), 'utf8'), script);
});

test('npm run tex works on a deck without a preamble and without a bibliography', (t) => {
  const root = folder(t, { 'index.html': page('<section><p>Words</p></section>') });
  const out = tex(root);
  const script = readFileSync(join(root, 'tex.js'), 'utf8');
  assert.deepEqual(run(script), { macros: {}, environments: {}, packages: [], theorems: {}, references: {} });
  assert.ok(script.endsWith('window.beesonTex = {\n  "macros": {},\n  "environments": {},\n  "packages": [],\n  "theorems": {},\n  "references": {},\n};\n'));
  assert.match(out, /tex\.js: 0 macros, 0 environments, 0 kinds of theorem, and 0 references/);
  assert.ok(!existsSync(join(root, 'preamble.tex')));
});

test('npm run tex turns the theme/macros.js of an older talk into a preamble.tex, once', (t) => {
  const macros = readFileSync(resolve('test/pages/macros-of-an-older-talk.js'), 'utf8');
  const root = folder(t, {
    'index.html': page('<section><p>\\(\\vb{x} \\in \\R^3\\)</p></section>', '<script src="theme/macros.js"></script>'),
    'theme/macros.js': macros,
  });
  const out = tex(root);
  const preamble = readFileSync(join(root, 'preamble.tex'), 'utf8');
  assert.ok(preamble.includes('\\newcommand{\\vb}[1]{\\boldsymbol{#1}}\n'));
  assert.ok(preamble.includes('% upright d with the spacing of an operator, as in \\int f(x) \\dd x\n\\newcommand{\\dd}{\\mathop{}\\!\\mathrm{d}}\n'));
  assert.ok(preamble.includes('% a libration point, as in \\LL{1}\n\\newcommand{\\LL}[1]{\\mathcal{L}_{#1}}\n'));
  assert.ok(!existsSync(join(root, 'theme/macros.js')));
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.ok(html.includes('<script src="tex.js"></script>\n<script src="theme/mathjax-config.js"></script>'));
  assert.ok(!html.includes('macros.js'));
  assert.deepEqual(Object.keys(run(readFileSync(join(root, 'tex.js'), 'utf8')).macros), ['vb', 'dd', 'R', 'LL']);
  assert.match(out, /preamble\.tex: written from theme\/macros\.js, which is deleted/);
  // the preamble is the source from then on: a second run reads it and does not write it
  writeFileSync(join(root, 'preamble.tex'), '\\newcommand{\\only}{o}\n');
  tex(root);
  assert.equal(readFileSync(join(root, 'preamble.tex'), 'utf8'), '\\newcommand{\\only}{o}\n');
  assert.deepEqual(Object.keys(run(readFileSync(join(root, 'tex.js'), 'utf8')).macros), ['only']);
});

test('npm run tex leaves a theme/macros.js in place next to a preamble.tex, and says so', (t) => {
  const root = folder(t, {
    'index.html': page('<section></section>', '<script src="theme/macros.js"></script>'),
    'theme/macros.js': 'window.beesonMacros = { R: "\\\\mathbb{R}" };\n',
    'preamble.tex': '\\newcommand{\\Z}{\\mathbb{Z}}\n',
  });
  const out = tex(root);
  assert.ok(existsSync(join(root, 'theme/macros.js')));
  assert.equal(readFileSync(join(root, 'preamble.tex'), 'utf8'), '\\newcommand{\\Z}{\\mathbb{Z}}\n');
  assert.match(out, /theme\/macros\.js is left in place, since preamble\.tex exists/);
  assert.match(out, /index\.html does not load tex\.js/);
});
