// bundles src/main.ts into theme/beeson.js, which is committed so that a talk needs no toolchain

import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const root = new URL('.', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

await build({
  entryPoints: [new URL('src/main.ts', root).pathname],
  outfile: new URL('theme/beeson.js', root).pathname,
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: false,
  sourcemap: false,
  legalComments: 'none',
  define: { __VERSION__: JSON.stringify(version) },
  banner: {
    js: `/*! beeson.js ${version}, the reveal.js theme of the Beeson group. MIT license. The orbit engine is ported from src/lib/orbits.ts of https://github.com/ClouD-161803/ClouD-161803.github.io (MIT). */`,
  },
});
