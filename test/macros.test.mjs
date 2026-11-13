// the definitions of a preamble.tex in a deck: theme/mathjax-config.js gives MathJax the macros, the
// environments, and the packages of the tex.js next to the deck. In test/pages/tex/index.html, each
// formula written with a definition is typeset as the formula that it stands for

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { deckTex } from '../scripts/tex.mjs';

const PAGE = 'test/pages/tex/index.html';

// the glyphs of the two formulas of each row, and whether the first has a name drawn in red, as
// MathJax draws a macro that is not defined
const ROWS = `[...document.querySelectorAll('.slides tr[data-case]')].map((row) => {
  const glyphs = (cell) => [...cell.querySelectorAll('mjx-container use')].map((use) => use.getAttribute('xlink:href') ?? use.getAttribute('href'));
  const [got, want] = row.cells;
  return { name: row.dataset.case, got: glyphs(got), want: glyphs(want), red: !!got.querySelector('[fill="red"], [data-mjx-error]') };
})`;

function typeset(rows) {
  assert.equal(rows.length, 8);
  for (const row of rows) {
    assert.ok(row.want.length > 0, row.name);
    assert.deepEqual(row.got, row.want, row.name);
    assert.ok(!row.red, row.name);
  }
}

test('the tex.js of the deck is the one that npm run tex writes', () => {
  const fresh = deckTex(PAGE);
  assert.equal(readFileSync('test/pages/tex/tex.js', 'utf8'), fresh.text);
  assert.deepEqual(fresh.preamble.skipped, []);
  assert.deepEqual(fresh.tex.packages, ['physics']);
});

test('a formula with a macro, an operator, an environment, or a package of the preamble is typeset', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl(PAGE, 'still'));
  await page.waitFor(deckSettled);
  typeset(await page.evaluate(ROWS));
  assert.deepEqual(page.errors, []);
});

test('the definitions of the preamble are typeset in the print view', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await printView(page, deckUrl(PAGE, 'print-pdf&still'));
  typeset(await page.evaluate(ROWS));
  assert.deepEqual(page.errors, []);
});
