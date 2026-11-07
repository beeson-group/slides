// checks of scripts/vendor.mjs, run on a copy of the script so that theme/vendor/ is not touched

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

test('the tycho runtime and the Latin Modern faces, which are copied by hand, are kept when the vendor script is run', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'slides-vendor-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  cpSync(resolve('scripts/vendor.mjs'), join(root, 'scripts/vendor.mjs'));
  symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'junction');
  const runtime = join(root, 'theme/vendor/tycho/tycho.js');
  mkdirSync(join(root, 'theme/vendor/tycho'), { recursive: true });
  writeFileSync(runtime, '');
  const face = join(root, 'theme/vendor/latin-modern/latin-modern-roman-400-normal.woff2');
  mkdirSync(join(root, 'theme/vendor/latin-modern'), { recursive: true });
  writeFileSync(face, '');

  execFileSync(process.execPath, [join(root, 'scripts/vendor.mjs')]);

  assert.ok(existsSync(runtime));
  assert.ok(existsSync(face));
  assert.ok(existsSync(join(root, 'theme/vendor/reveal/reveal.js')));
});

test('three.js is bundled into a classic script that defines THREE, with its license', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'slides-vendor-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  cpSync(resolve('scripts/vendor.mjs'), join(root, 'scripts/vendor.mjs'));
  symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'junction');

  execFileSync(process.execPath, [join(root, 'scripts/vendor.mjs')]);

  const context = {};
  runInNewContext(readFileSync(join(root, 'theme/vendor/three/three.js'), 'utf8'), context);
  assert.equal(typeof context.THREE.WebGLRenderer, 'function');
  assert.match(readFileSync(join(root, 'theme/vendor/three/LICENSE'), 'utf8'), /MIT License/);
});

test('the math font named in theme/mathjax-config.js is vendored with its license', (t) => {
  const font = readFileSync('theme/mathjax-config.js', 'utf8').match(/font: '([\w-]+)'/)[1];
  const root = mkdtempSync(join(tmpdir(), 'slides-vendor-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  cpSync(resolve('scripts/vendor.mjs'), join(root, 'scripts/vendor.mjs'));
  symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'junction');

  execFileSync(process.execPath, [join(root, 'scripts/vendor.mjs')]);

  assert.ok(existsSync(join(root, `theme/vendor/mathjax/${font}-font/svg.js`)));
  assert.match(readFileSync(join(root, `theme/vendor/mathjax/${font}-font/LICENSE`), 'utf8'), /Apache License/);
});

test('every face in theme/beeson.css is a file in theme/vendor/', () => {
  const urls = [...readFileSync('theme/beeson.css', 'utf8').matchAll(/url\((vendor\/[^)]+)\)/g)].map((m) => m[1]);
  assert.ok(urls.length >= 4);
  for (const url of urls) assert.ok(existsSync(join('theme', url)), url);
});
