// checks of scripts/vendor.mjs, run on a copy of the script so that theme/vendor/ is not touched

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('the tycho runtime, which is copied by hand, is kept when the vendor script is run', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'slides-vendor-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  cpSync(resolve('scripts/vendor.mjs'), join(root, 'scripts/vendor.mjs'));
  symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'junction');
  const runtime = join(root, 'theme/vendor/tycho/tycho.js');
  mkdirSync(join(root, 'theme/vendor/tycho'), { recursive: true });
  writeFileSync(runtime, '');

  execFileSync(process.execPath, [join(root, 'scripts/vendor.mjs')]);

  assert.ok(existsSync(runtime));
  assert.ok(existsSync(join(root, 'theme/vendor/reveal/reveal.js')));
});
