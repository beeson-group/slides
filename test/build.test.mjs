// check of build.mjs, run on a copy so that theme/beeson.js is not touched

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('the theme is built in a folder with a space in its name', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'slides build-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of ['build.mjs', 'package.json', 'src']) {
    cpSync(resolve(path), join(root, path), { recursive: true });
  }
  symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'junction');

  execFileSync(process.execPath, [join(root, 'build.mjs')], { stdio: 'pipe' });

  assert.ok(existsSync(join(root, 'theme/beeson.js')));
  assert.ok(existsSync(join(root, 'theme/editor.js')));
});

test('the theme bundle carries none of the editor, which is all in theme/editor.js', () => {
  const theme = readFileSync(resolve('theme/beeson.js'), 'utf8');
  const editor = readFileSync(resolve('theme/editor.js'), 'utf8');
  for (const mark of ['BeesonEditor', 'beeson-edit', 'showOpenFilePicker']) assert.ok(!theme.includes(mark), `${mark} is in theme/beeson.js`);
  assert.ok(editor.includes('BeesonEditor'));
});

// the editor is loaded at each ?edit from a file, without a toolchain, hence its bundle is kept small
test('theme/editor.js is under 400 KB', () => {
  const size = statSync(resolve('theme/editor.js')).size;
  assert.ok(size < 400 * 1024, `theme/editor.js is ${Math.round(size / 1024)} KB`);
});
