// the reader of a LaTeX preamble of src/preamble.ts: the definitions that are read into the macros
// and the environments of MathJax, the packages mapped to its extensions, the kinds of theorem, the
// files that a preamble names, and the lines that are skipped with their reason

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { USUAL, kindsOf, readPreamble } from '../src/preamble.ts';

const read = (lines, options) => readPreamble(lines.join('\n'), options);
const reasons = (preamble) => preamble.skipped.map((s) => `${s.line}: ${s.text} | ${s.reason}`);

test('a macro is read from \\newcommand, \\renewcommand, and \\providecommand, with its arguments and its default', () => {
  const p = read([
    '% the macros of a talk',
    '\\newcommand{\\vb}[1]{\\boldsymbol{#1}}',
    '\\newcommand\\dd{\\mathop{}\\!\\mathrm{d}}',
    '\\newcommand*{\\R}{\\mathbb{R}} % a comment after a definition',
    '\\newcommand{\\norm}[2][2]{\\lVert #2 \\rVert_{#1}}',
    '\\renewcommand{\\vec}[1]{\\mathbf{#1}}',
    '\\providecommand{\\R}{\\mathbf{R}}',
    '\\providecommand{\\Z}{\\mathbb{Z}}',
    '\\newcommand{\\half}\\frac12',
  ]);
  assert.deepEqual(p.macros, {
    vb: ['\\boldsymbol{#1}', 1],
    dd: '\\mathop{}\\!\\mathrm{d}',
    R: '\\mathbb{R}',
    norm: ['\\lVert #2 \\rVert_{#1}', 2, '2'],
    vec: ['\\mathbf{#1}', 1],
    Z: '\\mathbb{Z}',
    half: '\\frac',
  });
  // the 12 after \half is not part of its definition, as in TeX, and it is listed
  assert.deepEqual(reasons(p), ['9: 12 | not a definition']);
});

test('a definition over several lines is read without its comments and its line breaks', () => {
  const p = read([
    '\\newcommand{\\jac}[2]{%',
    '  \\frac{\\partial #1}{\\partial #2}% the Jacobian',
    '}',
    '\\newcommand{\\pct}{50\\%}',
  ]);
  assert.deepEqual(p.macros, { jac: ['\\frac{\\partial #1}{\\partial #2}', 2], pct: '50\\%' });
  assert.deepEqual(p.skipped, []);
});

test('\\def is read with undelimited parameters, and \\let copies a macro or names a command of TeX', () => {
  const p = read([
    '\\def\\eps{\\varepsilon}',
    '\\def\\pair#1#2{\\langle #1, #2 \\rangle}',
    '\\def\\until#1.{#1}',
    '\\newcommand{\\vb}[1]{\\boldsymbol{#1}}',
    '\\let\\bx\\vb',
    '\\let\\epsilon=\\varepsilon',
    '\\let\\oldphi\\phi',
    '\\renewcommand{\\phi}{\\varphi}',
    '\\let\\bgroup={',
  ]);
  assert.deepEqual(p.macros, {
    eps: '\\varepsilon',
    pair: ['\\langle #1, #2 \\rangle', 2],
    vb: ['\\boldsymbol{#1}', 1],
    bx: ['\\boldsymbol{#1}', 1],
    epsilon: '\\varepsilon',
    phi: '\\varphi',
  });
  assert.deepEqual(reasons(p), [
    '3: \\def\\until#1.{#1} | a \\def with delimited parameters is not read',
    '7: \\let\\oldphi\\phi | \\phi is defined again later in the preamble, and its first meaning cannot be kept',
    '9: \\let\\bgroup={ | a \\let of a character is not read',
  ]);
});

test('an operator and an environment are read', () => {
  const p = read([
    '\\DeclareMathOperator{\\sgn}{sgn}',
    '\\DeclareMathOperator*{\\argmin}{arg\\,min}',
    '\\newenvironment{mat}{\\begin{pmatrix}}{\\end{pmatrix}}',
    '\\newenvironment{cas}[1][l]{\\left\\{\\begin{array}{#1}}{\\end{array}\\right.}',
    '\\renewenvironment{mat}{\\begin{bmatrix}}{\\end{bmatrix}}',
  ]);
  assert.deepEqual(p.macros, { sgn: '\\operatorname{sgn}', argmin: '\\operatorname*{arg\\,min}' });
  assert.deepEqual(p.environments, {
    mat: ['\\begin{bmatrix}', '\\end{bmatrix}'],
    cas: ['\\left\\{\\begin{array}{#1}', '\\end{array}\\right.', 1, 'l'],
  });
  assert.deepEqual(p.skipped, []);
});

test('a package is mapped to the extension of MathJax that covers it, and one without an extension is skipped', () => {
  // the commands of bm and of xspace are macros of theme/mathjax-config.js in every deck
  const p = read([
    '\\usepackage{amsmath, amssymb}',
    '\\usepackage[dvipsnames]{xcolor}',
    '\\usepackage{physics,mathtools}',
    '\\RequirePackage{bm, xspace}',
    '\\usepackage{amsthm}',
    '\\usepackage{tikz}',
    '\\usepackage{siunitx}',
    '\\usepackage{bbm}',
    '\\usepackage{physics}',
  ]);
  assert.deepEqual(p.packages, ['color', 'physics', 'mathtools']);
  assert.deepEqual(reasons(p), [
    '6: \\usepackage{tikz} | MathJax does not have an extension for the package tikz',
    '7: \\usepackage{siunitx} | MathJax does not have an extension for the package siunitx',
    '8: \\usepackage{bbm} | the font of the package bbm is not vendored',
  ]);
});

test('the kinds of theorem are read from \\newtheorem, with the style, the shared counter, and the star, and a counter that is not read is listed', () => {
  const p = read([
    '\\newtheorem{theorem}{Theorem}',
    '\\newtheorem{lemma}[theorem]{Lemma}',
    '\\theoremstyle{definition}',
    '\\newtheorem{definition}{Definition}[section]',
    '\\newtheorem{hypothesis}{Hypoth\\`ese}',
    '\\theoremstyle{remark}',
    '\\newtheorem*{remark}{Remark}',
    '\\theoremstyle{fancy}',
    '\\newtheorem{claim}[nothing]{Claim}',
    '\\newtheorem{corollary}[lemma]{Corollary}',
  ]);
  assert.deepEqual(p.theorems, {
    theorem: { title: 'Theorem', style: 'plain', counter: 'theorem' },
    lemma: { title: 'Lemma', style: 'plain', counter: 'theorem' },
    definition: { title: 'Definition', style: 'definition', counter: 'definition' },
    hypothesis: { title: 'Hypothèse', style: 'definition', counter: 'hypothesis' },
    remark: { title: 'Remark', style: 'remark', counter: null },
    claim: { title: 'Claim', style: 'plain', counter: 'claim' },
    corollary: { title: 'Corollary', style: 'plain', counter: 'theorem' },
  });
  assert.deepEqual(reasons(p), [
    '4: \\newtheorem{definition}{Definition}[section] | a number within section is not read, hence definition is numbered through the deck',
    '8: \\theoremstyle{fancy} | the style fancy is not plain, definition, or remark, hence plain is used',
    '9: \\newtheorem{claim}[nothing]{Claim} | the counter nothing is not the counter of a kind, hence claim is numbered by itself',
  ]);
});

test('the eight usual kinds exist without a line of the preamble, unnumbered, and a line of the preamble replaces one', () => {
  assert.deepEqual(Object.keys(USUAL), ['theorem', 'lemma', 'proposition', 'corollary', 'definition', 'example', 'remark', 'proof']);
  assert.ok(Object.values(USUAL).every((kind) => kind.counter === null));
  assert.deepEqual([USUAL.theorem.style, USUAL.definition.style, USUAL.example.style, USUAL.remark.style, USUAL.proof.style], ['plain', 'definition', 'definition', 'remark', 'remark']);
  const kinds = kindsOf({ theorem: { title: 'Theorem', style: 'plain', counter: 'theorem' }, axiom: { title: 'Axiom', style: 'plain', counter: null } });
  assert.deepEqual(kinds.theorem, { title: 'Theorem', style: 'plain', counter: 'theorem' });
  assert.deepEqual(kinds.proof, { title: 'Proof', style: 'remark', counter: null });
  assert.deepEqual(Object.keys(kinds), [...Object.keys(USUAL), 'axiom']);
});

test('a file named in \\input, \\usepackage, or \\documentclass is read when it is next to the preamble', () => {
  const files = {
    'more.tex': '\\newcommand{\\A}{a}\n\\input{deep/again}',
    'deep/again.tex': '\\newcommand{\\B}{b}\n\\input{more}',
    'mymath.sty': '\\NeedsTeXFormat{LaTeX2e}\n\\ProvidesPackage{mymath}\n\\RequirePackage{amsmath}\n\\makeatletter\n\\newcommand{\\C}{c}\n\\makeatother\n\\endinput\n\\newcommand{\\never}{x}',
    'talk.cls': '\\newcommand{\\D}{d}',
  };
  const asked = [];
  const resolve = (name, kind) => {
    asked.push(`${kind} ${name}`);
    const file = { input: [name, `${name}.tex`], package: [`${name}.sty`], class: [`${name}.cls`] }[kind].find((f) => f in files);
    return file ? { file, text: files[file] } : null;
  };
  const p = read(['\\documentclass[12pt]{talk}', '\\usepackage{mymath}', '\\input{more}', '\\input missing', '\\documentclass{article}'], { file: 'preamble.tex', resolve });
  assert.deepEqual(p.macros, { D: 'd', C: 'c', A: 'a', B: 'b' });
  assert.deepEqual(asked, ['class talk', 'package mymath', 'package amsmath', 'input more', 'input deep/again', 'input more', 'input missing', 'class article']);
  assert.deepEqual(p.skipped, [
    { file: 'deep/again.tex', line: 2, text: '\\input{more}', reason: 'the file more.tex is read already' },
    { file: 'preamble.tex', line: 4, text: '\\input missing', reason: 'the file missing is not found' },
  ]);
});

test('every other line is skipped and listed, a statement of several lines once, and nothing is read after \\begin{document}', () => {
  const p = read([
    '\\usetikzlibrary{arrows.meta, calc}',
    '\\pgfplotsset{compat=1.18,',
    '  every axis/.append style={thick}}',
    '\\definecolor{accent}{HTML}{E77500}',
    '\\setlength\\parindent{0pt}',
    '\\DeclarePairedDelimiter{\\abs}{\\lvert}{\\rvert}',
    '\\newcommand{\\broken}[1]{#1',
    '\\begin{document}',
    '\\newcommand{\\late}{x}',
  ]);
  assert.deepEqual(p.macros, {});
  assert.deepEqual(reasons(p), [
    '1: \\usetikzlibrary{arrows.meta, calc} | not a definition',
    '2: \\pgfplotsset{compat=1.18, every axis/.append style={thick}} | not a definition',
    '4: \\definecolor{accent}{HTML}{E77500} | not a definition',
    '5: \\setlength\\parindent{0pt} | not a definition',
    '6: \\DeclarePairedDelimiter{\\abs}{\\lvert}{\\rvert} | not a definition',
    '7: \\newcommand{\\broken}[1]{#1 | a brace is not closed',
  ]);
});

test('a preamble with the line ends of Windows reads as one with the line ends of Unix', () => {
  const lines = ['\\newcommand{\\jac}[2]{%', '  \\frac{\\partial #1}{\\partial #2}%', '}', '\\usepackage{tikz}'];
  assert.deepEqual(readPreamble(lines.join('\r\n')), readPreamble(lines.join('\n')));
});
