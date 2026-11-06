// Copies into theme/vendor/ the files from node_modules that a deck needs to run offline, each
// package with its license. Run it after `npm ci`. The tycho runtime in theme/vendor/tycho/ is not
// in node_modules, hence it is copied by hand and left in place here.
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

for (const dir of ['reveal', 'fonts', 'mathjax']) rmSync(join(out, dir), { recursive: true, force: true });

// the speaker-view page of the notes plugin is written into an about:blank popup, and the deck
// itself is loaded in the iframes of this popup. thus a file beyond notes.js is not needed
copy('reveal.js/dist/reveal.js', 'reveal/reveal.js');
copy('reveal.js/dist/reveal.css', 'reveal/reveal.css');
copy('reveal.js/dist/reset.css', 'reveal/reset.css');
copy('reveal.js/dist/plugin/notes.js', 'reveal/notes.js');
copy('reveal.js/LICENSE', 'reveal/LICENSE');

// STIX Two Text in the weights of the theme. the greek subset is kept for Greek letters in prose,
// e.g. a Delta-v outside math
const fontsource = '@fontsource/stix-two-text';
const ranges = JSON.parse(readFileSync(join(modules, fontsource, 'unicode.json'), 'utf8'));
const faces = [];
for (const subset of ['latin', 'latin-ext', 'greek']) {
  for (const weight of [400, 500]) {
    for (const style of ['normal', 'italic']) {
      const file = `stix-two-text-${subset}-${weight}-${style}.woff2`;
      copy(`${fontsource}/files/${file}`, `fonts/${file}`);
      faces.push(`@font-face {
  font-family: 'STIX Two Text';
  font-style: ${style};
  font-weight: ${weight};
  font-display: block;
  src: url(./${file}) format('woff2');
  unicode-range: ${ranges[subset]};
}
`);
    }
  }
}
writeFileSync(
  join(out, 'fonts', 'stix-two-text.css'),
  `/* STIX Two Text, written by scripts/vendor.mjs from ${fontsource}. */\n${faces.join('\n')}`,
);
copy(`${fontsource}/LICENSE`, 'fonts/LICENSE');

// tex-svg.js loads the STIX Two Math font from output.fontPath in theme/mathjax-config.js: svg.js
// at startup, then one file of svg/dynamic/ for each character range that a formula uses. it is
// copied from the nofont build, which is 1 MB smaller, since the default New Computer Modern font of
// MathJax is left out of it
// TeX packages outside the core, e.g. boldsymbol, are autoloaded by tex-svg.js at their first macro
copy('mathjax/tex-svg-nofont.js', 'mathjax/tex-svg.js');
copy('mathjax/input/tex/extensions', 'mathjax/input/tex/extensions');
copy('mathjax/LICENSE', 'mathjax/LICENSE');
copy('@mathjax/mathjax-stix2-font/svg.js', 'mathjax/mathjax-stix2-font/svg.js');
copy('@mathjax/mathjax-stix2-font/svg/dynamic', 'mathjax/mathjax-stix2-font/svg/dynamic');
// the font package does not ship a license file, and its package.json declares Apache-2.0
copy('mathjax/LICENSE', 'mathjax/mathjax-stix2-font/LICENSE');

function size(path) {
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.size;
  return readdirSync(path).reduce((total, name) => total + size(join(path, name)), 0);
}
console.log(`theme/vendor: ${(size(out) / 2 ** 20).toFixed(2)} MiB`);
