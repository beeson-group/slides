// the macros of the preamble of a deck in the labels of a plot: each macro expanded by
// src/expand.ts before the $…$ markup of a label is read, with its arguments, the default of an
// optional first argument, nested macros, and the three macros of the theme, and the markup of
// src/plot.ts, which shows what it cannot draw, e.g. bold, without it

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';
import { expandMacros, THEME_MACROS } from '../src/expand.ts';
import { parseMarkup } from '../src/plot.ts';

// the macros of tex.js in the demo deck, and two of a preamble with an optional argument
const MACROS = {
  vb: ['\\boldsymbol{#1}', 1],
  dd: '\\mathop{}\\!\\mathrm{d}',
  R: '\\mathbb{R}',
  LL: ['\\mathcal{L}_{#1}', 1],
  orb: ['#2_{\\mathrm{#1}}', 2, 'L2'],
  sat: '\\ensuremath{\\mathcal{S}}\\xspace',
  loop: '\\loop x',
};

test('a macro is replaced by its body, with its arguments in place of #1 and #2', () => {
  assert.equal(expandMacros('$\\vb{r}$', MACROS), '$\\boldsymbol{r}$');
  assert.equal(expandMacros('$\\vb r$', MACROS), '$\\boldsymbol{r}$');
  assert.equal(expandMacros('$\\LL{12}$', MACROS), '$\\mathcal{L}_{12}$');
  assert.equal(expandMacros('$x \\in \\R^3$', MACROS), '$x \\in \\mathbb{R}^3$');
  // a name is read up to its last letter, hence \Rx is not \R followed by x
  assert.equal(expandMacros('$\\Rx$', MACROS), '$\\Rx$');
  // an optional first argument in brackets, or its default
  assert.equal(expandMacros('$\\orb{\\Phi}$', MACROS), '$\\Phi_{\\mathrm{L2}}$');
  assert.equal(expandMacros('$\\orb[L1]{\\Phi}$', MACROS), '$\\Phi_{\\mathrm{L1}}$');
  // a label without a macro is kept as it is
  assert.equal(expandMacros('$\\lambda_h = 3$ and \\alpha', MACROS), '$\\lambda_h = 3$ and \\alpha');
});

test('nested macros are expanded, and a macro that calls itself is cut at a depth', () => {
  assert.equal(expandMacros('$\\vb{\\LL{1}}$', MACROS), '$\\boldsymbol{\\mathcal{L}_{1}}$');
  assert.equal(expandMacros('$\\dd t$', MACROS), '$\\mathop{}\\!\\mathrm{d}t$');
  const cut = expandMacros('$\\loop$', MACROS);
  assert.ok(cut.length < 200 && cut.startsWith('$\\loop x'), cut);
});

test('the theme adds ensuremath, xspace, and bm, and a macro of the deck takes the place of one of them', () => {
  assert.deepEqual(Object.keys(THEME_MACROS).sort(), ['bm', 'ensuremath', 'xspace']);
  assert.equal(expandMacros('$\\bm{v}$', MACROS), '$\\boldsymbol{v}$');
  // ensuremath outside the math of a label puts its argument into math
  assert.equal(expandMacros('the \\sat family', MACROS), 'the $\\mathcal{S}$ family');
  assert.equal(expandMacros('$\\sat_2$', MACROS), '$\\mathcal{S}_2$');
  assert.equal(expandMacros('$\\bm{v}$', { ...MACROS, bm: ['\\mathbf{#1}', 1] }), '$\\mathbf{v}$');
});

test('a deck without tex.js has nothing to expand', () => {
  assert.equal(expandMacros('$\\vb{r}$'), '$\\vb{r}$');
  assert.deepEqual(parseMarkup('$\\vb{r}$'), parseMarkup('$\\vb{r}$', {}));
  assert.deepEqual(parseMarkup('$\\vb{r}$', {}), [{ text: '\\vb', italic: false, shift: null }, { text: 'r', italic: true, shift: null }]);
});

test('a label is read after its macros, and bold, a blackboard letter, and the spaces of TeX are drawn as plain text', () => {
  assert.deepEqual(parseMarkup('$\\vb{r}_{\\LL{2}}$', MACROS), [{ text: 'r', italic: true, shift: null }, { text: 'ℒ2', italic: false, shift: 'sub' }]);
  assert.deepEqual(parseMarkup('$\\dd t$', MACROS), [{ text: 'd', italic: false, shift: null }, { text: 't', italic: true, shift: null }]);
  assert.deepEqual(parseMarkup('$\\R^3$', MACROS), [{ text: 'ℝ', italic: false, shift: null }, { text: '3', italic: false, shift: 'sup' }]);
  assert.deepEqual(parseMarkup('$\\mathbf{F} = m\\,a$', MACROS), [
    { text: 'F = ', italic: false, shift: null },
    { text: 'm', italic: true, shift: null },
    { text: ' ', italic: false, shift: null },
    { text: 'a', italic: true, shift: null },
  ]);
  assert.deepEqual(parseMarkup('the \\sat family', MACROS), [{ text: 'the 𝒮 family', italic: false, shift: null }]);
  assert.deepEqual(parseMarkup('$\\operatorname{tr} A$', MACROS), [{ text: 'tr ', italic: false, shift: null }, { text: 'A', italic: true, shift: null }]);
});

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser?.close();
});

test('a plot in a deck draws its labels with the macros of window.beesonTex', { timeout: 60000 }, async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(deckUrl('test/pages/plot-macros.html', '', '/1'));
  await page.waitFor(deckSettled);
  await page.waitFor(`document.querySelector('.plot-readout span')`);
  const labels = await page.evaluate(`({
    parameter: document.querySelector('.plot-readout span').innerHTML,
    labels: [...document.querySelectorAll('.plot-label')].map((el) => el.innerHTML),
  })`);
  assert.equal(labels.parameter, '<i>r</i>');
  assert.ok(labels.labels.includes('ℒ<sub>2</sub> orbit'), JSON.stringify(labels.labels));
  assert.ok(labels.labels.includes('the 𝒮 family'), JSON.stringify(labels.labels));
  assert.deepEqual(page.errors, []);
});
