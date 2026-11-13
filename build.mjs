// bundles src/main.ts into theme/beeson.js and src/editor/main.ts into theme/editor.js, which are
// committed so that a toolchain is not required for a talk

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = new URL('.', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

const common = {
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: false,
  sourcemap: false,
  legalComments: 'none',
  define: { __VERSION__: JSON.stringify(version) },
};

await build({
  ...common,
  entryPoints: [fileURLToPath(new URL('src/main.ts', root))],
  outfile: fileURLToPath(new URL('theme/beeson.js', root)),
  banner: {
    js: `/*! beeson.js ${version}, the reveal.js theme of the Beeson group. MIT license. The orbit engine is ported from src/lib/orbits.ts of https://github.com/ClouD-161803/ClouD-161803.github.io (MIT). */`,
  },
});

await build({
  ...common,
  entryPoints: [fileURLToPath(new URL('src/editor/main.ts', root))],
  outfile: fileURLToPath(new URL('theme/editor.js', root)),
  // the whitespace is taken out to keep the bundle under its budget, and the names are kept
  minifyWhitespace: true,
  banner: { js: `/*! editor.js ${version}, the in-place editor of the beeson theme. MIT license. */` },
});
