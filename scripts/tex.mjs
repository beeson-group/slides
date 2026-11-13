// npm run tex writes the script tex.js next to a deck, from the preamble.tex and the references.bib
// next to it: the macros and the environments for MathJax, the kinds of theorem, and the references
// of the entries that the deck cites. The lines of the preamble and the entries of the bibliography
// that are not read are printed with their reason, and so is a key that is cited without an entry.
// In an older talk, the macros of theme/macros.js are written into a preamble.tex once.
//
//   node scripts/tex.mjs [deck]     the deck is index.html unless it is given
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

// the readers of src/ are TypeScript, which Node reads without a flag from version 22.18 on. under
// an older Node they are bundled by esbuild, which is installed by npm ci
async function readers() {
  const names = ['bibtex', 'preamble', 'texfile'];
  try {
    return Object.assign({}, ...(await Promise.all(names.map((name) => import(`../src/${name}.ts`)))));
  } catch (error) {
    if (error?.code !== 'ERR_UNKNOWN_FILE_EXTENSION') throw error;
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const { buildSync } = await import('esbuild').catch(() => {
    throw new Error('npm run tex needs Node 22.18 or later, or the packages that npm ci installs');
  });
  const built = buildSync({
    stdin: { contents: names.map((name) => `export * from './src/${name}.ts';`).join('\n'), resolveDir: root },
    bundle: true,
    format: 'esm',
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
}
const { readBibtex, readPreamble, preambleOf, texOf, texScript } = await readers();

/** What npm run tex writes for a deck, with the lines that are skipped and the keys without an entry. Nothing is written. */
export function deckTex(deck) {
  const dir = dirname(resolve(deck));
  const text = (name) => {
    try {
      return readFileSync(join(dir, name), 'utf8');
    } catch {
      return null;
    }
  };
  // as in TeX, a file is looked up from the folder of the preamble, and \input adds .tex to a name
  // without an extension
  const names = {
    input: (name) => (/\.[A-Za-z]+$/.test(name) ? [name] : [`${name}.tex`, name]),
    package: (name) => [`${name}.sty`],
    class: (name) => [`${name}.cls`],
  };
  const find = (name, kind) => {
    for (const file of names[kind](name)) {
      const found = text(file);
      if (found !== null) return { file, text: found };
    }
    return null;
  };
  const preamble = readPreamble(text('preamble.tex') ?? '', { file: 'preamble.tex', resolve: find });
  const bibliography = readBibtex(text('references.bib') ?? '');
  const { tex, missing } = texOf(preamble, bibliography, readFileSync(deck, 'utf8'));
  return { file: join(dir, 'tex.js'), text: texScript(tex), tex, preamble, bibliography, missing };
}

// the macros of theme/macros.js of an older talk are written into a preamble.tex, each under the
// comment lines above it, the file is deleted, and its script tag in the deck is pointed at tex.js
function convertMacros(deck) {
  const dir = dirname(resolve(deck));
  const file = join(dir, 'theme', 'macros.js');
  if (!existsSync(file)) return;
  if (existsSync(join(dir, 'preamble.tex'))) {
    console.log('theme/macros.js is left in place, since preamble.tex exists: move its macros into preamble.tex, and delete it');
    return;
  }
  const source = readFileSync(file, 'utf8');
  const window = {};
  vm.runInNewContext(source, { window });
  const comments = {};
  let above = [];
  for (const line of source.split(/\r?\n/)) {
    const comment = /^\s*\/\/ ?(.*)$/.exec(line);
    const key = /^\s*["']?([A-Za-z@]+)["']?\s*:/.exec(line);
    if (comment) above.push(comment[1]);
    else {
      if (key && above.length) comments[key[1]] = above;
      above = [];
    }
  }
  writeFileSync(join(dir, 'preamble.tex'), preambleOf(window.beesonMacros ?? {}, comments));
  rmSync(file);
  writeFileSync(deck, readFileSync(deck, 'utf8').replace(/(<script\b[^>]*\ssrc\s*=\s*["'])theme\/macros\.js(["'])/, '$1tex.js$2'));
  console.log('preamble.tex: written from theme/macros.js, which is deleted');
}

function main() {
  const [deck = 'index.html'] = process.argv.slice(2);
  if (!existsSync(deck)) {
    console.error(`${deck} is not found`);
    process.exit(1);
  }
  convertMacros(deck);
  const { file, text, tex, preamble, bibliography, missing } = deckTex(deck);
  writeFileSync(file, text);
  const count = (items, one, many = `${one}s`) => `${Object.keys(items).length} ${Object.keys(items).length === 1 ? one : many}`;
  console.log(`tex.js: ${count(tex.macros, 'macro')}, ${count(tex.environments, 'environment')}, ${count(tex.theorems, 'kind of theorem', 'kinds of theorem')}, and ${count(tex.references, 'reference')}`);
  const short = (statement) => (statement.length > 100 ? `${statement.slice(0, 99)}…` : statement);
  for (const skipped of preamble.skipped) console.log(`${skipped.file}:${skipped.line}: ${short(skipped.text)}: ${skipped.reason}`);
  for (const skipped of bibliography.skipped) console.log(`references.bib:${skipped.line}: ${short(skipped.text)}: ${skipped.reason}`);
  const name = basename(deck);
  for (const key of missing) console.log(`${name}: the key ${key} is cited, and it is not in references.bib`);
  if (!/<script\b[^>]*\ssrc\s*=\s*["']tex\.js["']/.test(readFileSync(deck, 'utf8'))) {
    console.log(`${name} does not load tex.js: put <script src="tex.js"></script> before the script of theme/mathjax-config.js`);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
