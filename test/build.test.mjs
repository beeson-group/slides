// check of build.mjs, run on a copy so that theme/beeson.js is not touched

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
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
});
