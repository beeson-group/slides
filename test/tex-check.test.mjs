// the problems of a preamble and a bibliography that scripts/check.mjs names, in the two decks of
// test/pages/tex-check/, which share one preamble.tex, one references.bib, and the tex.js written
// for fresh.html

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function check(deck) {
  const out = mkdtempSync(join(tmpdir(), 'beeson-tex-check-'));
  try {
    return spawnSync(process.execPath, ['scripts/check.mjs', '--deck', deck, '--themes', 'dark', '--out', out], { encoding: 'utf8' });
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

test('the check names a macro that is not defined, a key that is not in the bibliography, a kind that is not defined, and a tex.js that is not written again', { timeout: 120000 }, () => {
  const run = check('test/pages/tex-check/stale.html');
  assert.equal(run.status, 1, run.stdout + run.stderr);
  // each problem is named with the picture of its slide
  assert.match(run.stderr, /dark-01\.png \(#\/0\/0\): macro not defined: \\foo\n/);
  assert.match(run.stderr, /dark-01\.png \(#\/0\/0\): citation of a key that is not in the bibliography: lost1999\n/);
  assert.match(run.stderr, /dark-01\.png \(#\/0\/0\): theorem of a kind that is not defined: conjecture\n/);
  assert.match(run.stderr, /tex\.js is not the one written from preamble\.tex and references\.bib: run npm run tex\n/);
  // a macro of the preamble is defined, and a line of the preamble that is not read is not a problem
  assert.doesNotMatch(run.stdout + run.stderr, /\\vb|tikz/);
});

test('the check passes on a deck whose preamble has a line that is not read', { timeout: 120000 }, () => {
  const run = check('test/pages/tex-check/fresh.html');
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /no page errors/);
});
