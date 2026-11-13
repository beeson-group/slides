// the TikZ figures of a deck. a figure is a <div class="tikz" data-figure="name"> on a slide, with
// its box in the width and the height in px of its style. its source is figures/name.tex next to
// the deck, a tikzpicture that a paper reads with \input as well, and its output is the classic
// script figures/name.js with the SVG of each mode, since a deck opened from a file cannot read the
// text of a file next to it. a figure is compiled by latex into DVI and by dvisvgm into SVG, with
// the letters as outlines, at 3.6 px per TeX point, hence its text of 10 pt is 36 px on a slide.
//
// compileFigure does not write anything into the folder of the talk, and writeFigure writes its text,
// so that a command of the editor can compile a source that is not saved yet.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const PX_PER_PT = 3.6;
// dvisvgm writes its sizes in bp
const PT_PER_BP = 72.27 / 72;
const STYLE = join(dirname(fileURLToPath(import.meta.url)), '..', 'styles', 'beeson-tikz.sty');
// the files of a compile in its temporary folder, which latex finds through TEXINPUTS
const WRAPPER = 'beeson-figure';
const SOURCE = 'beeson-figure-source';
const PREAMBLE = 'beeson-figure-preamble';
// a figure is fitted to its box within this many px
const SLACK = 0.5;

const read = (file, encoding = 'utf8') => {
  try {
    return readFileSync(file, encoding);
  } catch {
    return null;
  }
};
const isFile = (file) => {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
};
const list = (dir) => {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
};

// the folders of a TeX Live of each year, newest first, then those of MiKTeX
function usualFolders(env) {
  const folders = ['/Library/TeX/texbin', '/usr/texbin', '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];
  for (const root of ['/usr/local/texlive', 'C:\\texlive', join(env.HOME ?? '', 'texlive')]) {
    for (const year of list(root).filter((name) => /^\d{4}$/.test(name)).sort().reverse()) {
      const bin = join(root, year, 'bin');
      folders.push(...list(bin).map((arch) => join(bin, arch)));
    }
  }
  if (env.LOCALAPPDATA) folders.push(join(env.LOCALAPPDATA, 'Programs', 'MiKTeX', 'miktex', 'bin', 'x64'));
  folders.push(join(env.ProgramFiles ?? 'C:\\Program Files', 'MiKTeX', 'miktex', 'bin', 'x64'));
  return folders;
}

/**
 * The paths of latex and dvisvgm, each null when it is not found. They are looked up on the PATH and
 * then in the usual folders of TeX Live and MiKTeX, or only in the folder of BEESON_TEXBIN when it is set.
 */
export function findTools(env = process.env) {
  const folders = env.BEESON_TEXBIN !== undefined ? [env.BEESON_TEXBIN] : [...(env.PATH ?? env.Path ?? '').split(delimiter).filter(Boolean), ...usualFolders(env)];
  const extensions = process.platform === 'win32' ? ['.exe', ''] : [''];
  const find = (name) => {
    for (const folder of folders) for (const extension of extensions) if (isFile(join(folder, name + extension))) return join(folder, name + extension);
    return null;
  };
  return { latex: find('latex'), dvisvgm: find('dvisvgm') };
}

const attributes = (tag) => {
  const values = {};
  for (const [, name, double, single, bare] of tag.replace(/^<\w+/, '').matchAll(/([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    values[name.toLowerCase()] = double ?? single ?? bare ?? '';
  }
  return values;
};
const px = (style, key) => {
  const match = new RegExp(`(?:^|;)\\s*${key}\\s*:\\s*([\\d.]+)px`, 'i').exec(style);
  return match ? Number(match[1]) : null;
};

/** The TikZ figures of a deck, in the order of the file: the name of each and its box in px, with null for a size that is not set. */
export function deckFigures(html) {
  const text = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[\s\S]*?<\/script\s*>/gi, '');
  const figures = [];
  for (const [tag] of text.matchAll(/<div\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const values = attributes(tag);
    if (!(values.class ?? '').split(/\s+/).includes('tikz')) continue;
    const style = values.style ?? '';
    figures.push({ name: values['data-figure'] ?? null, box: { width: px(style, 'width'), height: px(style, 'height') } });
  }
  return figures;
}

/**
 * The text of a preamble.tex that a figure reads: the lines above \begin{document}, without the
 * \documentclass statement, with each line in its place so that an error is given at its line.
 */
export function cutPreamble(text) {
  const lines = [];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    // a % that is not escaped starts a comment
    const comment = /(?:^|[^\\])(?:\\\\)*%/.exec(line);
    const end = comment ? comment.index + comment[0].length - 1 : line.length;
    const code = line.slice(0, end);
    const begin = code.indexOf('\\begin{document}');
    if (begin >= 0) {
      lines.push(code.slice(0, begin));
      break;
    }
    lines.push(code.replace(/\\documentclass\s*(\[[^\]]*\])?\s*\{[^}]*\}/, '') + line.slice(end));
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return `${lines.join('\n')}\n`;
}

const pt = (value) => `${+value.toFixed(4)}pt`;

/**
 * The document that latex compiles for a figure in a mode. width and height are the size of a
 * pgfplots axis in TeX pt, and scale is the scale of the coordinates of a drawing, which TikZ does
 * not apply to text and line widths.
 */
export function wrapperOf({ mode = 'light', preamble = false, width = null, height = null, scale = 1 } = {}) {
  const lines = [
    '\\documentclass[dvisvgm]{article}',
    '\\usepackage[T1]{fontenc}\\usepackage{lmodern}\\usepackage{tikz,pgfplots}\\pgfplotsset{compat=1.18}',
    `\\usepackage[${mode}]{beeson-tikz}`,
  ];
  if (preamble) lines.push(`\\input{${PREAMBLE}}`);
  // a source may size a part by the box, as in width=0.5\figurewidth. without a box, the two
  // lengths are the defaults of pgfplots
  lines.push(
    '\\pagestyle{empty}',
    '\\ifdefined\\figurewidth\\else\\newlength\\figurewidth\\fi\\ifdefined\\figureheight\\else\\newlength\\figureheight\\fi',
    `\\setlength\\figurewidth{${pt(width ?? 240)}}\\setlength\\figureheight{${pt(height ?? 207)}}`,
  );
  const size = [width !== null && 'width=\\figurewidth', height !== null && 'height=\\figureheight'].filter(Boolean);
  if (size.length) lines.push(`\\pgfplotsset{${size.join(', ')}}`);
  if (scale !== 1) lines.push(`\\tikzset{every picture/.append style={scale=${+scale.toFixed(5)}}}`);
  lines.push(`\\begin{document}\\color{ink}\\input{${SOURCE}}\\end{document}`);
  return `${lines.join('\n')}\n`;
}

/**
 * An SVG of dvisvgm as it is drawn inline in a deck: without its XML prolog and comments, with every
 * id prefixed, and with its width and height in px, times factor for a figure shown smaller.
 * Returns the SVG, its size in px, and the names of its parts in the order of the file.
 */
export function finishSvg(svg, prefix, factor = 1) {
  let text = svg.replace(/<\?xml[\s\S]*?\?>\s*/g, '').replace(/<!--[\s\S]*?-->\s*/g, '').trim();
  text = text
    .replace(/(\s)id=(['"])/g, `$1id=$2${prefix}`)
    .replace(/(\shref|\sxlink:href)=(['"])#/g, `$1=$2#${prefix}`)
    .replace(/url\(#/g, `url(#${prefix}`);
  const root = /<svg\b[^>]*>/.exec(text)[0];
  const size = (key) => Math.round(parseFloat(new RegExp(`\\s${key}=['"]([\\d.]+)`).exec(root)[1]) * PT_PER_BP * PX_PER_PT * factor * 100) / 100;
  const width = size('width');
  const height = size('height');
  text = text.replace(root, root.replace(/(\swidth=)(['"])[^'"]*\2/, `$1'${width}'`).replace(/(\sheight=)(['"])[^'"]*\2/, `$1'${height}'`));
  const parts = [...new Set([...text.matchAll(/\sdata-part=['"]([^'"]*)['"]/g)].map((match) => match[1]))];
  return { svg: text, width, height, parts };
}

// the number of pgfplots axes in a source, without those of a comment
const axes = (source) => source.replace(/(^|[^\\])%.*$/gm, '$1').match(/\\begin\{(axis|semilogxaxis|semilogyaxis|loglogaxis|polaraxis|ternaryaxis|smithchart)\}/g)?.length ?? 0;

// the errors of a log of latex, each at its file and line of the talk. texts holds the wrapper,
// the source, and the preamble, by the name of each in the temporary folder
function errorsOf(log, { name, dir, texts }) {
  const located = [...log.matchAll(/^(.*?\.\w+):(\d+): (.*)$/gm)].map(([, path, line, message]) => ({ path, line: Number(line), message }));
  let errors = located.filter((error) => !/^Emergency stop/.test(error.message));
  if (!errors.length) {
    // an error without a place, e.g. a file that is not found, is given at the line where TeX stopped
    const stop = located.find((error) => /^Emergency stop/.test(error.message));
    errors = [{ path: stop?.path ?? `${WRAPPER}.tex`, line: stop?.line ?? null, message: /^! (.*)$/m.exec(log)?.[1] ?? 'latex failed without an error in its log' }];
  }
  const source = `figures/${name}.tex`;
  return errors.map(({ path, line, message }) => {
    const base = path.split(/[\\/]/).pop();
    let file;
    if (base === `${SOURCE}.tex`) file = source;
    else if (base === `${PREAMBLE}.tex`) file = 'preamble.tex';
    else if (base === `${WRAPPER}.tex`) {
      // the line of the wrapper that inputs the preamble or the source
      file = (texts[WRAPPER].split('\n')[line - 1] ?? '').includes(PREAMBLE) ? 'preamble.tex' : source;
      line = null;
    } else {
      const local = relative(dir, resolve(dir, path));
      file = local.startsWith('..') || isAbsolute(local) ? base : local.split('\\').join('/');
    }
    // a file that is not found is given at the first line that names it
    const missing = /File `([^']+)' not found/.exec(message)?.[1].replace(/\.\w+$/, '');
    const text = { [source]: texts[SOURCE], 'preamble.tex': texts[PREAMBLE] }[file];
    if (line === null && missing && text) {
      const at = text.split('\n').findIndex((code) => code.replace(/(^|[^\\])%.*$/, '$1').includes(missing));
      if (at >= 0) line = at + 1;
    }
    return { file, line, message: message.trim().replace(/\.$/, '') };
  });
}

/**
 * A hash over everything that the output of a figure depends on: its source, the style, the
 * wrapper, the preamble.tex of the talk, the files of the talk that TeX read (inputs, as paths
 * from the folder of the deck), and its box. Line ends are read as LF, since git on Windows may
 * check a file out with CRLF.
 */
export function figureHash({ dir, source, box = {}, inputs = [] }) {
  const hash = createHash('sha256');
  const add = (label, text) => hash.update(`${label}\0${text === null ? '\u0001' : text.replace(/\r\n/g, '\n')}\0`);
  add('source', source);
  add('style', read(STYLE));
  add('wrapper', wrapperOf());
  add('preamble', read(join(dir, 'preamble.tex')));
  for (const file of [...inputs].sort()) add(`input ${file}`, read(join(dir, file), 'latin1'));
  add('box', `${box.width ?? ''} ${box.height ?? ''}`);
  return hash.digest('hex').slice(0, 16);
}

// a value as JSON in ASCII, since the script is read in the encoding of its page
const ascii = (value) => JSON.stringify(value).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

/** The text of figures/name.js, which adds the figure to window.beesonFigures, with one line per key. */
export function figureScript(name, figure) {
  const lines = [`// written from figures/${name}.tex by npm run tex. change the source, since this file is written again from it`, `(window.beesonFigures ??= {})[${ascii(name)}] = {`];
  for (const [key, value] of Object.entries(figure)) lines.push(`  ${ascii(key)}: ${ascii(value)},`);
  lines.push('};');
  return `${lines.join('\n')}\n`;
}

/**
 * Compiles a figure of the talk in the folder dir, from its source text, or from figures/name.tex
 * when source is not given, into the box {width, height} in px. Returns { figure, text, passes,
 * seconds }, where figure is the value of window.beesonFigures[name] and text the script
 * figures/name.js, or { errors }, each { file, line, message } with file as a path from dir and
 * line null where TeX does not give one. Nothing is written into dir.
 */
export function compileFigure({ dir, name, source, box = {}, tools = findTools() }) {
  const started = Date.now();
  dir = resolve(dir);
  source ??= readFileSync(join(dir, 'figures', `${name}.tex`), 'utf8');
  for (const tool of ['latex', 'dvisvgm']) {
    if (!tools[tool]) return { errors: [{ file: null, line: null, message: `${tool} is not found` }] };
  }
  const preamble = read(join(dir, 'preamble.tex'));
  const temporary = mkdtempSync(join(tmpdir(), 'beeson-figure-'));
  let passes = 0;
  // one compile in a mode, with the size in TeX pt and the files of the talk that TeX read
  const pass = (mode, fit) => {
    passes += 1;
    const wrapper = wrapperOf({ mode, preamble: preamble !== null, ...fit });
    writeFileSync(join(temporary, `${WRAPPER}.tex`), wrapper);
    const env = { ...process.env, TEXINPUTS: `${temporary}${delimiter}${process.env.TEXINPUTS ?? ''}`, max_print_line: '10000', error_line: '254', half_error_line: '238' };
    // the folder of the talk is the working folder of TeX, hence a path in a source is read from it
    const latex = spawnSync(tools.latex, ['-interaction=nonstopmode', '-halt-on-error', '-no-shell-escape', '-file-line-error', '-recorder', `-output-directory=${temporary}`, `${WRAPPER}.tex`], { cwd: dir, env, encoding: 'utf8', maxBuffer: 1 << 26 });
    if (latex.error) return { errors: [{ file: null, line: null, message: `latex does not run: ${latex.error.message}` }] };
    if (latex.status !== 0) return { errors: errorsOf(read(join(temporary, `${WRAPPER}.log`)) ?? latex.stdout ?? '', { name, dir, texts: { [WRAPPER]: wrapper, [SOURCE]: source, [PREAMBLE]: preamble === null ? null : cutPreamble(preamble) } }) };
    const file = join(temporary, `${WRAPPER}.svg`);
    const svg = spawnSync(tools.dvisvgm, ['--no-fonts', '--precision=2', `--output=${file}`, join(temporary, `${WRAPPER}.dvi`)], { cwd: dir, env, encoding: 'utf8', maxBuffer: 1 << 26 });
    const text = read(file);
    if (svg.error || svg.status !== 0 || text === null) {
      return { errors: [{ file: `figures/${name}.tex`, line: null, message: `dvisvgm failed: ${(svg.error?.message ?? svg.stderr ?? '').trim().split(/\r?\n/).pop()}` }] };
    }
    const root = /<svg\b[^>]*>/.exec(text)[0];
    const size = (key) => parseFloat(new RegExp(`\\s${key}=['"]([\\d.]+)`).exec(root)[1]) * PT_PER_BP;
    const inputs = new Set();
    for (const [, path] of (read(join(temporary, `${WRAPPER}.fls`)) ?? '').matchAll(/^INPUT (.+)$/gm)) {
      const local = relative(dir, resolve(dir, path.trim()));
      if (local && !local.startsWith('..') && !isAbsolute(local)) inputs.add(local.split('\\').join('/'));
    }
    return { svg: text, width: size('width'), height: size('height'), inputs: [...inputs].sort() };
  };
  try {
    copyFileSync(STYLE, join(temporary, 'beeson-tikz.sty'));
    writeFileSync(join(temporary, `${SOURCE}.tex`), source);
    if (preamble !== null) writeFileSync(join(temporary, `${PREAMBLE}.tex`), cutPreamble(preamble));
    // the target in TeX pt of each dimension of the box that is set
    const target = { width: box.width != null ? box.width / PX_PER_PT : null, height: box.height != null ? box.height / PX_PER_PT : null };
    const boxed = target.width !== null || target.height !== null;
    const off = (out) => Math.max(...['width', 'height'].map((key) => (target[key] === null ? 0 : Math.abs(out[key] - target[key]) * PX_PER_PT)));
    let fit = {};
    let out;
    if (boxed && axes(source) === 1) {
      // pgfplots sets the width of an axis close to the width of its picture, and the second pass
      // takes the measured excess off. an axis is never made smaller than 10 pt
      fit = { ...target };
      out = pass('light', fit);
      if (out.errors) return out;
      if (off(out) > SLACK) {
        for (const key of ['width', 'height']) if (target[key] !== null) fit[key] = Math.max(10, fit[key] - (out[key] - target[key]));
        out = pass('light', fit);
      }
    } else {
      out = pass('light', fit);
      if (boxed && !out.errors) {
        // the scale of the coordinates that fills the box in one dimension. a size is a + b scale in
        // each dimension, since text and lines are not scaled, hence a second pass at the scale
        // measured from the first two is close to the box
        const ratio = (out) => Math.min(...['width', 'height'].filter((key) => target[key] !== null).map((key) => target[key] / out[key]));
        const first = out;
        const scale = ratio(first);
        if (Math.abs(scale - 1) > 1e-3) {
          fit = { scale };
          out = pass('light', fit);
          if (!out.errors && off(out) > SLACK) {
            const scales = ['width', 'height']
              .filter((key) => target[key] !== null)
              .map((key) => {
                const b = (out[key] - first[key]) / (scale - 1);
                return b > 0 ? 1 + (target[key] - first[key]) / b : scale * (target[key] / out[key]);
              });
            const corrected = Math.max(0.01, Math.min(...scales));
            if (Math.abs(corrected - scale) > 1e-4) {
              fit = { scale: corrected };
              out = pass('light', fit);
            }
          }
        }
      }
    }
    if (out.errors) return out;
    // a figure that does not fit after the passes is shown smaller as a whole, and never larger
    const shrink = ['width', 'height'].filter((key) => target[key] !== null && (out[key] - target[key]) * PX_PER_PT > SLACK).map((key) => target[key] / out[key]);
    const factor = shrink.length ? Math.floor(Math.min(...shrink) * 1e4) / 1e4 : 1;
    const dark = pass('dark', fit);
    if (dark.errors) return dark;
    const light = finishSvg(out.svg, `tikz-${name}-light-`, factor);
    const figure = {
      hash: figureHash({ dir, source, box, inputs: out.inputs }),
      width: light.width,
      height: light.height,
      scale: factor,
      parts: light.parts,
      inputs: out.inputs,
      dark: finishSvg(dark.svg, `tikz-${name}-dark-`, factor).svg,
      light: light.svg,
    };
    return { figure, text: figureScript(name, figure), passes, seconds: (Date.now() - started) / 1000 };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

/** Writes the text of a compile into figures/name.js of the talk in the folder dir. */
export function writeFigure(dir, name, text) {
  mkdirSync(join(dir, 'figures'), { recursive: true });
  writeFileSync(join(dir, 'figures', `${name}.js`), text);
}

/** The figure that the script figures/name.js of the talk in the folder dir holds, or null when it is missing or unreadable. */
export function readFigure(dir, name) {
  const text = read(join(dir, 'figures', `${name}.js`));
  if (text === null) return null;
  try {
    const window = {};
    vm.runInNewContext(text, { window });
    return window.beesonFigures?.[name] ?? null;
  } catch {
    return null;
  }
}

/**
 * The TikZ figures of a deck, each once, with its name, its box, its output and its source as paths
 * from the folder of the deck, and its state: current, stale, missing (without an output), no source,
 * or invalid (without a name of letters, digits, - and _). A figure shown twice takes the box of its
 * first tag. TeX is not run.
 */
export function figureStatus(deck) {
  const dir = dirname(resolve(deck));
  const seen = new Set();
  const figures = [];
  for (const { name, box } of deckFigures(readFileSync(deck, 'utf8'))) {
    if (!name || !/^[\w-]+$/.test(name)) {
      figures.push({ name: name || null, box, state: 'invalid' });
      continue;
    }
    if (seen.has(name)) continue;
    seen.add(name);
    const entry = { name, box, file: `figures/${name}.js`, source: `figures/${name}.tex` };
    const source = read(join(dir, entry.source));
    const figure = source === null ? null : readFigure(dir, name);
    if (source === null) entry.state = 'no source';
    else if (!figure) entry.state = read(join(dir, entry.file)) === null ? 'missing' : 'stale';
    else entry.state = figure.hash === figureHash({ dir, source, box, inputs: Array.isArray(figure.inputs) ? figure.inputs : [] }) ? 'current' : 'stale';
    figures.push(entry);
  }
  return figures;
}

const problem = (figure, deck) =>
  ({
    stale: `${figure.file} is stale, run npm run tex`,
    missing: `${figure.file} is missing, run npm run tex`,
    'no source': `${figure.source} is not found, for the TikZ figure ${figure.name} of ${basename(deck)}`,
    invalid: `${basename(deck)}: a TikZ figure without a name in data-figure, or with a name other than letters, digits, - and _`,
  })[figure.state];

/** One line for each TikZ figure of a deck that is not current, as npm run check prints it. */
export function figureProblems(deck) {
  return figureStatus(deck)
    .filter((figure) => figure.state !== 'current')
    .map((figure) => problem(figure, deck));
}

/**
 * Compiles each stale or missing TikZ figure of a deck and writes its output, for npm run tex, with
 * one line for each figure. An output is kept after an error. Returns false, and sets the exit code
 * to 1, while a figure is not current, e.g. when TeX is not installed.
 */
export function compileFigures(deck, { log = console.log, tools = findTools() } = {}) {
  const dir = dirname(resolve(deck));
  let current = true;
  for (const figure of figureStatus(deck)) {
    if (figure.state === 'current') {
      log(`${figure.file}: up to date`);
      continue;
    }
    if (figure.state === 'no source' || figure.state === 'invalid') {
      log(problem(figure, deck));
      current = false;
      continue;
    }
    const absent = ['latex', 'dvisvgm'].find((tool) => !tools[tool]);
    if (absent) {
      log(`${figure.file}: not compiled, since ${absent} is not found. install TeX Live, or put latex and dvisvgm on the PATH`);
      current = false;
      continue;
    }
    const compiled = compileFigure({ dir, name: figure.name, box: figure.box, tools });
    if (compiled.errors) {
      for (const error of compiled.errors) log(`${error.file ?? figure.source}${error.line === null ? '' : `:${error.line}`}: ${error.message}`);
      log(`${figure.file}: not compiled${figure.state === 'stale' ? ', the last good output is kept' : ''}`);
      current = false;
      continue;
    }
    writeFigure(dir, figure.name, compiled.text);
    const { width, height, scale } = compiled.figure;
    const smaller = scale < 1 ? `, shown at ${scale} of its size, since it does not fit its box` : '';
    log(`${figure.file}: compiled in ${compiled.seconds.toFixed(1)} s, ${Math.round(width)} by ${Math.round(height)} px${smaller}`);
  }
  if (!current) process.exitCode = 1;
  return current;
}
