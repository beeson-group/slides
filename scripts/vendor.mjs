// Copies into theme/vendor/ the files from node_modules that are required to run a deck offline,
// each package with its license, and bundles three.js into a classic script. Run it after `npm ci`.
// The tycho runtime in theme/vendor/tycho/ and the Latin Modern Roman faces in
// theme/vendor/latin-modern/ are not in node_modules, hence they are copied by hand and left in
// place here.
import { buildSync } from 'esbuild';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modules = join(root, 'node_modules');
const out = join(root, 'theme', 'vendor');

function copy(from, to) {
  mkdirSync(dirname(join(out, to)), { recursive: true });
  cpSync(join(modules, from), join(out, to), { recursive: true });
}

for (const dir of ['reveal', 'fonts', 'mathjax', 'three']) rmSync(join(out, dir), { recursive: true, force: true });

// the speaker-view page of the notes plugin is written into an about:blank popup, and the deck
// itself is loaded in the iframes of this popup. thus a file beyond notes.js is not needed
copy('reveal.js/dist/reveal.js', 'reveal/reveal.js');
copy('reveal.js/dist/reveal.css', 'reveal/reveal.css');
copy('reveal.js/dist/reset.css', 'reveal/reset.css');
copy('reveal.js/dist/plugin/notes.js', 'reveal/notes.js');
copy('reveal.js/LICENSE', 'reveal/LICENSE');

// the Greek of STIX Two Text in the weights of the theme, which is the fallback of Latin Modern
// Roman for a Greek letter in prose, e.g. a theta outside math, since Latin Modern Roman does not
// have lowercase Greek
const fontsource = '@fontsource/stix-two-text';
const ranges = JSON.parse(readFileSync(join(modules, fontsource, 'unicode.json'), 'utf8'));
const faces = [];
for (const weight of [400, 500]) {
  for (const style of ['normal', 'italic']) {
    const file = `stix-two-text-greek-${weight}-${style}.woff2`;
    copy(`${fontsource}/files/${file}`, `fonts/${file}`);
    faces.push(`@font-face {
  font-family: 'STIX Two Text';
  font-style: ${style};
  font-weight: ${weight};
  font-display: block;
  src: url(./${file}) format('woff2');
  unicode-range: ${ranges.greek};
}
`);
  }
}
writeFileSync(
  join(out, 'fonts', 'stix-two-text.css'),
  `/* The Greek of STIX Two Text, written by scripts/vendor.mjs from ${fontsource}. */\n${faces.join('\n')}`,
);
copy(`${fontsource}/LICENSE`, 'fonts/LICENSE');

// the TeX font of MathJax, i.e. Computer Modern, is loaded from output.fontPath in
// theme/mathjax-config.js. all of its glyphs are in svg.js, which is loaded at startup. tex-svg.js is
// copied from the nofont build, which is 1 MB smaller without the default New Computer Modern font
// of MathJax
// TeX packages outside the core, e.g. boldsymbol, are autoloaded at their first macro
copy('mathjax/tex-svg-nofont.js', 'mathjax/tex-svg.js');
copy('mathjax/input/tex/extensions', 'mathjax/input/tex/extensions');
copy('mathjax/LICENSE', 'mathjax/LICENSE');
copy('@mathjax/mathjax-tex-font/svg.js', 'mathjax/mathjax-tex-font/svg.js');
// a license file is not in the font package, and Apache-2.0 is declared in its package.json
copy('mathjax/LICENSE', 'mathjax/mathjax-tex-font/LICENSE');
// the font of the TeX package mhchem is loaded at the first \ce, from loader.paths.fonts in
// theme/mathjax-config.js. The fonts of bbm, bboldx, and dsfont are left out, since these packages
// are not autoloaded and are 1.7 MB in all
copy('@mathjax/mathjax-mhchem-font-extension/svg.js', 'mathjax/mathjax-mhchem-font-extension/svg.js');
copy('mathjax/LICENSE', 'mathjax/mathjax-mhchem-font-extension/LICENSE');

// three.js is published as ES modules only, and a module script is not loaded from a deck opened
// as a file. it is bundled here into a classic script that defines the global THREE, which is read
// by the surfaces of src/surface.ts
const three = JSON.parse(readFileSync(join(modules, 'three/package.json'), 'utf8')).version;
buildSync({
  stdin: { contents: "export * from 'three';", resolveDir: root, loader: 'js' },
  outfile: join(out, 'three/three.js'),
  bundle: true,
  format: 'iife',
  globalName: 'THREE',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  banner: { js: `/*! three.js ${three}, https://threejs.org, MIT license, bundled by scripts/vendor.mjs. */` },
  logLevel: 'warning',
});
copy('three/LICENSE', 'three/LICENSE');

function size(path) {
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.size;
  return readdirSync(path).reduce((total, name) => total + size(join(path, name)), 0);
}
console.log(`theme/vendor: ${(size(out) / 2 ** 20).toFixed(2)} MiB`);
