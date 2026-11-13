// the TikZ figures of a deck: the style of styles/beeson-tikz.sty, whose colors are the custom
// properties of theme/beeson.css in each mode, and the compile of a figure of scripts/figures.mjs
// into the SVG of each mode, fitted to its box. a test that runs TeX is skipped where latex or
// dvisvgm is not installed

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { compileFigure, cutPreamble, deckFigures, figureScript, findTools, finishSvg, wrapperOf } from '../scripts/figures.mjs';

const STY = readFileSync('styles/beeson-tikz.sty', 'utf8');
const CSS = readFileSync('theme/beeson.css', 'utf8');

// the custom properties of a mode, from the rules of :root and of html[data-theme="mode"] in their order
const properties = (mode) => {
  const values = {};
  for (const [, selectors, body] of CSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const list = selectors.split(',').map((s) => s.trim());
    if (!list.includes(':root') && !list.includes(`html[data-theme="${mode}"]`)) continue;
    for (const [, name, value] of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) values[name] = value.trim().toLowerCase();
  }
  return values;
};
// the colors that the style defines in a mode, from the two branches of \ifbeeson@dark
const colors = (mode) => {
  const [, dark, light] = /\\ifbeeson@dark([\s\S]*?)\\else([\s\S]*?)\\fi/.exec(STY);
  return Object.fromEntries([...(mode === 'dark' ? dark : light).matchAll(/\\definecolor\{(\w+)\}\{HTML\}\{([0-9A-Fa-f]{6})\}/g)].map(([, name, hex]) => [name, `#${hex.toLowerCase()}`]));
};
// each color of the style, with the custom property of the theme that it is taken from. ink is
// --text, since text is a key of TikZ
const TOKENS = { bg: 'bg', ink: 'text', subtle: 'subtle', muted: 'muted', line: 'line', accent: 'accent', violet: 'violet', blue: 'blue', red: 'red', ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`data${n}`, `data-${n}`])) };

for (const mode of ['dark', 'light']) {
  test(`the colors of the TikZ style in the ${mode} mode are those of the theme`, () => {
    const css = properties(mode);
    const sty = colors(mode);
    assert.deepEqual(Object.keys(sty).sort(), Object.keys(TOKENS).sort());
    for (const [name, property] of Object.entries(TOKENS)) assert.equal(sty[name], css[property], `${name} against --${property}`);
  });
}

test('the TikZ style is light unless it is loaded with the option dark, and it holds the look of a figure', () => {
  assert.match(STY, /\\ProvidesPackage\{beeson-tikz\}/);
  assert.match(STY, /\\DeclareOption\{dark\}\{\\beeson@darktrue\}/);
  assert.match(STY, /\\DeclareOption\{light\}\{\\beeson@darkfalse\}/);
  assert.match(STY, /\\ExecuteOptions\{light\}/);
  // at 3.6 px per TeX point, lines of 2 px and curves of 3 px
  assert.match(STY, /line width=0\.5556pt/);
  assert.match(STY, /every axis plot\/\.append style=\{line width=0\.8333pt\}/);
  assert.match(STY, /cycle list=\{\{accent\},\{blue\},\{violet\}\}/);
  assert.match(STY, /part\/\.style=/);
});

const tools = findTools();
const WITHOUT_TEX = !tools.latex || !tools.dvisvgm ? 'latex and dvisvgm are not installed, as on the test runners of CI' : false;

// a folder of a talk, deleted after the test
const folder = (t, files) => {
  const root = mkdtempSync(join(tmpdir(), 'slides figures-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(root, name, '..'), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  return root;
};
// the object that a script figures/name.js assigns to window.beesonFigures
const run = (script) => {
  const window = {};
  vm.runInNewContext(script, { window });
  return JSON.parse(JSON.stringify(window.beesonFigures));
};

const CSV = 't,x,y\n0,1,0\n1,0.6,0.3\n2,0.37,0.45\n3,0.22,0.5\n4,0.14,0.48\n5,0.08,0.44\n';
const DECAY = `\\begin{tikzpicture}
\\begin{axis}[xlabel={$t$}, ylabel={amplitude}]
\\addplot+[part=x, mark=none] table[x=t, y=x, col sep=comma]{figures/decay.csv} node[pos=1, anchor=west] {$x(t)$};
\\addplot+[part=y, mark=none] table[x=t, y=y, col sep=comma]{figures/decay.csv} node[pos=1, anchor=west] {$y(t)$};
\\end{axis}
\\end{tikzpicture}
`;
const ORBIT = `\\usetikzlibrary{arrows.meta}
\\begin{tikzpicture}
\\draw[subtle] (-2,0) -- (2,0);
\\begin{scope}[part=moon]
\\fill[accent] (1,0) circle (0.1) node[above] {Moon};
\\end{scope}
\\draw[violet, -{Stealth}] (0,0) circle (1);
\\node at (-1, 0.5) {Earth};
\\end{tikzpicture}
`;

test('the wrapper loads the style of the mode, then the preamble, then the box, and inputs the source', () => {
  const text = wrapperOf({ mode: 'dark', preamble: true, width: 150, height: 100 });
  assert.match(text, /^\\documentclass\[dvisvgm\]\{article\}\n/);
  const at = (part) => text.indexOf(part);
  assert.ok(at('\\usepackage[T1]{fontenc}') < at('\\usepackage{lmodern}'));
  assert.ok(at('\\usepackage{tikz,pgfplots}\\pgfplotsset{compat=1.18}') < at('\\usepackage[dark]{beeson-tikz}'));
  assert.ok(at('\\usepackage[dark]{beeson-tikz}') < at('\\input{beeson-figure-preamble}'));
  assert.ok(at('\\input{beeson-figure-preamble}') < at('\\setlength\\figurewidth{150pt}'));
  assert.match(text, /\\setlength\\figureheight\{100pt\}/);
  assert.match(text, /\\pgfplotsset\{width=\\figurewidth, height=\\figureheight\}/);
  assert.match(text, /\\begin\{document\}\\color\{ink\}\\input\{beeson-figure-source\}\\end\{document\}\n$/);
  assert.doesNotMatch(text, /scale=/);
  // without a box, the lengths are the defaults of pgfplots, and a drawing is scaled by its coordinates
  const natural = wrapperOf({ scale: 0.5 });
  assert.match(natural, /\\usepackage\[light\]\{beeson-tikz\}/);
  assert.doesNotMatch(natural, /preamble|width=\\figurewidth/);
  assert.match(natural, /\\setlength\\figurewidth\{240pt\}/);
  assert.match(natural, /\\tikzset\{every picture\/\.append style=\{scale=0\.5\}\}/);
});

test('a preamble is cut at \\begin{document}, without its \\documentclass, with its lines in place', () => {
  const source = '% a paper\r\n\\documentclass[11pt]{article} % the class\r\n\\usepackage{amsmath}\r\n% \\begin{document} in a comment\r\n\\newcommand{\\R}{\\mathbb{R}}\\begin{document}\r\nText\r\n\\end{document}\r\n';
  assert.equal(cutPreamble(source), '% a paper\n % the class\n\\usepackage{amsmath}\n% \\begin{document} in a comment\n\\newcommand{\\R}{\\mathbb{R}}\n');
  assert.equal(cutPreamble('\\newcommand{\\R}{\\mathbb{R}}\n'), '\\newcommand{\\R}{\\mathbb{R}}\n');
});

test('a TikZ figure of a deck is read with its name and the box of its style, without those of a comment or a script', () => {
  const html = `<section><div class="zone tikz" data-figure="decay" style="width: 600px; height: 480px; translate: 10px 0"></div>
<div data-figure='orbit' class=tikz style="min-width: 20px;width:300.5px"></div><div class="tikz" data-figure="plain"></div>
<!-- <div class="tikz" data-figure="comment"></div> --><div class="tikzpicture" data-figure="no"></div>
<script type="application/json">{"a": "<div class=\\"tikz\\" data-figure=\\"script\\"></div>"}</script></section>`;
  assert.deepEqual(deckFigures(html), [
    { name: 'decay', box: { width: 600, height: 480 } },
    { name: 'orbit', box: { width: 300.5, height: null } },
    { name: 'plain', box: { width: null, height: null } },
  ]);
});

test('an SVG of dvisvgm is kept without its prolog and comments, with ids unique to its figure and mode, at its size in px', () => {
  const svg = `<?xml version='1.0' encoding='UTF-8'?>
<!-- This file was generated by dvisvgm 3.6 -->
<svg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='100pt' height='50pt' viewBox='0 0 100 50'>
<defs><path id='g0-58' d='M1 1Z'/><clipPath id='c1'><path d='M0 0Z'/></clipPath></defs>
<g id='page1' data-id='x'><g data-part='x'><use x='1' y='2' xlink:href='#g0-58'/><path clip-path='url(#c1)' d='M0 0Z'/></g><g data-part="moon"></g><g data-part='x'></g></g>
</svg>
`;
  const { svg: text, width, height, parts } = finishSvg(svg, 'tikz-decay-dark-');
  assert.ok(text.startsWith("<svg version='1.1'"));
  assert.ok(!text.includes('<?xml') && !text.includes('<!--'));
  assert.ok(text.includes("id='tikz-decay-dark-g0-58'") && text.includes("xlink:href='#tikz-decay-dark-g0-58'"));
  assert.ok(text.includes("clip-path='url(#tikz-decay-dark-c1)'") && text.includes("id='tikz-decay-dark-page1' data-id='x'"));
  // 1 bp is 72.27/72 TeX pt, and a TeX pt is 3.6 px
  assert.equal(width, 361.35);
  assert.equal(height, 180.68);
  assert.ok(text.includes("width='361.35' height='180.68' viewBox='0 0 100 50'"));
  assert.deepEqual(parts, ['x', 'moon']);
  // a figure shown smaller as a whole
  const smaller = finishSvg(svg, 'p-', 0.5);
  assert.equal(smaller.width, 180.68);
  assert.ok(smaller.svg.includes("width='180.68' height='90.34'"));
});

test('the script of a figure is one assignment in ASCII to window.beesonFigures', () => {
  const figure = { hash: '0123456789abcdef', width: 600, height: 480, scale: 1, parts: ['x'], inputs: ['figures/decay.csv'], dark: "<svg><text>\u00e9</text></svg>", light: '<svg></svg>' };
  const script = figureScript('decay', figure);
  assert.ok(!/[^\x20-\x7e\n]/.test(script), 'a character outside ASCII');
  assert.match(script, /^\/\/ [^\n]*\n\(window\.beesonFigures \?\?= \{\}\)\["decay"\] = \{\n/);
  assert.deepEqual(run(script), { decay: figure });
  assert.deepEqual(run(`${script}${figureScript('orbit', figure)}`), { decay: figure, orbit: figure });
});

test('a pgfplots figure from a CSV file is fitted to its box, with its curves as parts in the colors of each mode', { skip: WITHOUT_TEX }, (t) => {
  const dir = folder(t, { 'figures/decay.tex': DECAY, 'figures/decay.csv': CSV });
  const { figure, text, errors } = compileFigure({ dir, name: 'decay', box: { width: 600, height: 480 } });
  assert.equal(errors, undefined);
  assert.ok(Math.abs(figure.width - 600) <= 2, `width ${figure.width}`);
  assert.ok(Math.abs(figure.height - 480) <= 2, `height ${figure.height}`);
  assert.equal(figure.scale, 1);
  assert.deepEqual(figure.parts, ['x', 'y']);
  assert.deepEqual(figure.inputs, ['figures/decay.csv']);
  for (const mode of ['dark', 'light']) {
    const svg = figure[mode];
    assert.ok(svg.startsWith('<svg') && svg.trimEnd().endsWith('</svg>'));
    // the label at the end of a curve is drawn inside the group of its curve
    const x = /<g data-part='x'>([\s\S]*?)<g data-part='y'>/.exec(svg)[1];
    assert.match(x, /<path d='M/);
    assert.match(x, /<use [^>]*xlink:href='#tikz-decay-/);
    assert.ok(!/ id='(?!tikz-decay-)/.test(svg));
  }
  assert.match(figure.dark, /#f08050/i);
  assert.match(figure.light, /#c8571e/i);
  assert.doesNotMatch(figure.dark, /#c8571e/i);
  assert.deepEqual(run(text).decay, figure);
  // nothing is written into the folder of the talk
  assert.throws(() => readFileSync(join(dir, 'figures', 'decay.js')));
});

test('a drawing is fitted to its box by a scale of its coordinates, up or down, with its text at 36 px', { skip: WITHOUT_TEX }, (t) => {
  const dir = folder(t, { 'figures/orbit.tex': ORBIT });
  const natural = compileFigure({ dir, name: 'orbit' }).figure;
  assert.deepEqual(natural.parts, ['moon']);
  for (const box of [{ width: 900, height: 900 }, { width: 400, height: 900 }, { width: 2000, height: 300 }]) {
    const { figure } = compileFigure({ dir, name: 'orbit', box });
    assert.equal(figure.scale, 1);
    // the drawing fills the box in one of its dimensions, and it is inside the box in the other
    const gaps = [box.width - figure.width, box.height - figure.height];
    assert.ok(Math.min(...gaps) <= 2 && Math.min(...gaps) >= -2 && Math.max(...gaps) >= -2, `${figure.width} by ${figure.height} in ${box.width} by ${box.height}`);
  }
  // a box smaller than the text of the figure: the figure is shown smaller as a whole
  const { figure } = compileFigure({ dir, name: 'orbit', box: { width: 60, height: 60 } });
  assert.ok(figure.scale < 1, `scale ${figure.scale}`);
  assert.ok(figure.width <= 61 && figure.height <= 61, `${figure.width} by ${figure.height}`);
});

test('an error of TeX is given with the file and the line of the source, and with the line of the preamble', { skip: WITHOUT_TEX }, (t) => {
  const dir = folder(t, { 'figures/decay.tex': DECAY, 'figures/decay.csv': CSV, 'preamble.tex': '\\documentclass{article}\n\\newcommand{\\R}{\\mathbb{R}}\n\\begin{document}\n' });
  const broken = DECAY.replace('\\end{tikzpicture}', '\\undefinedmacro\n\\end{tikzpicture}');
  const { errors, figure } = compileFigure({ dir, name: 'decay', source: broken });
  assert.equal(figure, undefined);
  assert.deepEqual(errors[0], { file: 'figures/decay.tex', line: 6, message: 'Undefined control sequence' });
  writeFileSync(join(dir, 'preamble.tex'), '\\documentclass{article}\n\\usepackage{notapackage}\n\\begin{document}\n');
  assert.deepEqual(compileFigure({ dir, name: 'decay' }).errors[0], { file: 'preamble.tex', line: 2, message: "LaTeX Error: File `notapackage.sty' not found" });
  // a macro of the preamble is known in the figure
  writeFileSync(join(dir, 'preamble.tex'), '\\newcommand{\\amp}{\\textit{amplitude}}\n');
  assert.ok(compileFigure({ dir, name: 'decay', source: DECAY.replace('{amplitude}', '{\\amp}') }).figure);
});
