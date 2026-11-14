// the TikZ figures of a deck: the style of styles/beeson-tikz.sty, whose colors are the custom
// properties of theme/beeson.css in each mode, the compile of a figure of scripts/figures.mjs into
// the SVG of each mode, fitted to its box, the hash that tells a stale output without TeX, and the
// figures of npm run tex. a test that runs TeX is skipped where latex or dvisvgm is not installed

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { compileFigure, cutPreamble, deckFigures, figureHash, figureProblems, figureScript, figureStatus, findTools, finishSvg, wrapperOf } from '../scripts/figures.mjs';

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
  const html = `<section><div class="figure-box tikz" data-figure="decay" style="width: 600px; height: 480px; translate: 10px 0"></div>
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

const page = (body) => `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<script src="tex.js"></script>\n</head>\n<body>\n<div class="reveal"><div class="slides">\n${body}\n</div></div>\n</body>\n</html>\n`;
// npm run tex on the deck of a folder, with TeX only in the folder texbin when it is given
const tex = (root, texbin) => {
  const env = { ...process.env };
  if (texbin !== undefined) env.BEESON_TEXBIN = texbin;
  const done = spawnSync(process.execPath, [resolve('scripts/tex.mjs'), join(root, 'index.html')], { encoding: 'utf8', env });
  return { out: `${done.stdout}${done.stderr}`, status: done.status };
};
// an output of a figure as npm run tex would write it for the files of the folder, without TeX
const output = (root, name, box, inputs = []) => {
  const hash = figureHash({ dir: root, source: readFileSync(join(root, 'figures', `${name}.tex`), 'utf8'), box, inputs });
  writeFileSync(join(root, 'figures', `${name}.js`), figureScript(name, { hash, width: 10, height: 10, scale: 1, parts: [], inputs, dark: '<svg></svg>', light: '<svg></svg>' }));
};

test('the hash of a figure is read with LF line ends, and it changes with the source, the files it reads, the preamble, and the box', (t) => {
  const root = folder(t, { 'figures/decay.csv': CSV, 'preamble.tex': '\\newcommand{\\amp}{a}\n', 'more.tex': 'x\n' });
  const base = { dir: root, source: DECAY, box: { width: 600, height: 480 }, inputs: ['figures/decay.csv', 'more.tex'] };
  const hash = figureHash(base);
  assert.match(hash, /^[0-9a-f]{16}$/);
  assert.equal(figureHash({ ...base, source: DECAY.replace(/\n/g, '\r\n') }), hash);
  writeFileSync(join(root, 'figures/decay.csv'), CSV.replace(/\n/g, '\r\n'));
  assert.equal(figureHash(base), hash);
  assert.notEqual(figureHash({ ...base, source: DECAY.replace('amplitude', 'a') }), hash);
  assert.notEqual(figureHash({ ...base, box: { width: 600, height: 400 } }), hash);
  assert.notEqual(figureHash({ ...base, box: {} }), hash);
  writeFileSync(join(root, 'more.tex'), 'y\n');
  assert.notEqual(figureHash(base), hash);
  writeFileSync(join(root, 'more.tex'), 'x\n');
  writeFileSync(join(root, 'figures/decay.csv'), `${CSV}6,0.05,0.4\n`);
  assert.notEqual(figureHash(base), hash);
  writeFileSync(join(root, 'figures/decay.csv'), CSV);
  assert.equal(figureHash(base), hash);
  rmSync(join(root, 'preamble.tex'));
  assert.notEqual(figureHash(base), hash);
});

test('the figures of a deck are listed as current, stale, or missing, without TeX, and each problem is one line', (t) => {
  const root = folder(t, {
    'index.html': page(`<section><div class="tikz" data-figure="decay" style="width: 600px; height: 480px"></div></section>
<section><div class="tikz" data-figure="orbit"></div><div class="tikz" data-figure="lost"></div></section>
<section><div class="tikz" data-figure="new" style="width: 300px"></div><div class="tikz" data-figure="decay" style="width: 600px; height: 480px"></div><div class="tikz"></div></section>`),
    'figures/decay.tex': DECAY,
    'figures/decay.csv': CSV,
    'figures/orbit.tex': ORBIT,
    'figures/new.tex': ORBIT,
  });
  output(root, 'decay', { width: 600, height: 480 }, ['figures/decay.csv']);
  output(root, 'orbit', { width: 100, height: null });
  const deck = join(root, 'index.html');
  const states = () => Object.fromEntries(figureStatus(deck).map((figure) => [figure.name, figure.state]));
  // a figure shown twice is listed once
  assert.deepEqual(figureStatus(deck).map((figure) => figure.name), ['decay', 'orbit', 'lost', 'new', null]);
  assert.deepEqual(states(), { decay: 'current', orbit: 'stale', lost: 'no source', new: 'missing', null: 'invalid' });
  assert.deepEqual(figureStatus(deck)[0], { name: 'decay', box: { width: 600, height: 480 }, file: 'figures/decay.js', source: 'figures/decay.tex', state: 'current' });
  assert.deepEqual(figureProblems(deck), [
    'figures/orbit.js is stale, run npm run tex',
    'figures/lost.tex is not found, for the TikZ figure lost of index.html',
    'figures/new.js is missing, run npm run tex',
    'index.html: a TikZ figure without a name in data-figure, or with a name other than letters, digits, - and _',
  ]);
  // a figure is stale after a change of the data that it reads, and every figure after a change of the preamble
  writeFileSync(join(root, 'figures/decay.csv'), `${CSV}6,0.05,0.4\n`);
  assert.equal(states().decay, 'stale');
  writeFileSync(join(root, 'figures/decay.csv'), CSV);
  output(root, 'orbit', { width: null, height: null });
  assert.equal(states().decay, 'current');
  assert.equal(states().orbit, 'current');
  writeFileSync(join(root, 'preamble.tex'), '\\newcommand{\\amp}{a}\n');
  assert.equal(states().decay, 'stale');
  assert.equal(states().orbit, 'stale');
  // an output that is not a script of a figure is stale
  writeFileSync(join(root, 'figures/orbit.js'), 'window.beesonFigures = null;\n');
  output(root, 'decay', { width: 600, height: 480 }, ['figures/decay.csv']);
  assert.deepEqual(states(), { decay: 'current', orbit: 'stale', lost: 'no source', new: 'missing', null: 'invalid' });
  assert.deepEqual(figureProblems(join(root, 'index.html')).length, 4);
});

test('npm run tex without TeX writes tex.js, lists each stale figure as not compiled, and ends nonzero only while one is stale', (t) => {
  const root = folder(t, {
    'index.html': page('<section><div class="tikz" data-figure="decay" style="width: 600px; height: 480px"></div><div class="tikz" data-figure="orbit"></div></section>'),
    'figures/decay.tex': DECAY,
    'figures/decay.csv': CSV,
    'figures/orbit.tex': ORBIT,
    'texbin/.keep': '',
  });
  output(root, 'decay', { width: 600, height: 480 }, ['figures/decay.csv']);
  const { out, status } = tex(root, join(root, 'texbin'));
  assert.ok(readFileSync(join(root, 'tex.js'), 'utf8').includes('window.beesonTex'));
  assert.match(out, /tex\.js: 0 macros/);
  assert.match(out, /^figures\/decay\.js: up to date$/m);
  assert.match(out, /^figures\/orbit\.js: not compiled, since latex is not found\. install TeX Live, or put latex and dvisvgm on the PATH$/m);
  assert.equal(status, 1);
  output(root, 'orbit', { width: null, height: null });
  const again = tex(root, join(root, 'texbin'));
  assert.match(again.out, /^figures\/orbit\.js: up to date$/m);
  assert.equal(again.status, 0);
});

test('npm run tex prints nothing of figures for a deck without one', (t) => {
  const root = folder(t, { 'index.html': page('<section><p>Words</p></section>') });
  const { out, status } = tex(root, join(root, 'nowhere'));
  assert.doesNotMatch(out, /figures|not compiled/);
  assert.equal(status, 0);
});

test('npm run tex compiles each stale figure, skips one that is up to date, and keeps the last good output after an error', { skip: WITHOUT_TEX }, (t) => {
  const root = folder(t, {
    'index.html': page('<section><div class="tikz" data-figure="decay" style="width: 600px; height: 480px"></div><div class="tikz" data-figure="orbit"></div></section>'),
    'figures/decay.tex': DECAY,
    'figures/decay.csv': CSV,
    'figures/orbit.tex': ORBIT,
  });
  const first = tex(root);
  assert.match(first.out, /^figures\/decay\.js: compiled in \d+\.\d s, 600 by 480 px$/m);
  assert.match(first.out, /^figures\/orbit\.js: compiled in \d+\.\d s, \d+ by \d+ px$/m);
  assert.equal(first.status, 0);
  const deck = join(root, 'index.html');
  assert.deepEqual(figureStatus(deck).map((figure) => figure.state), ['current', 'current']);
  const good = readFileSync(join(root, 'figures/decay.js'), 'utf8');
  assert.equal(run(good).decay.inputs[0], 'figures/decay.csv');
  const second = tex(root);
  assert.match(second.out, /^figures\/decay\.js: up to date$/m);
  assert.match(second.out, /^figures\/orbit\.js: up to date$/m);
  writeFileSync(join(root, 'figures/decay.tex'), DECAY.replace('\\end{tikzpicture}', '\\undefinedmacro\n\\end{tikzpicture}'));
  const broken = tex(root);
  assert.match(broken.out, /^figures\/decay\.tex:6: Undefined control sequence$/m);
  assert.match(broken.out, /^figures\/decay\.js: not compiled, the last good output is kept$/m);
  assert.equal(broken.status, 1);
  assert.equal(readFileSync(join(root, 'figures/decay.js'), 'utf8'), good);
  assert.equal(figureStatus(deck)[0].state, 'stale');
});
