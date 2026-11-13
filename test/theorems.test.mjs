// the theorems of src/theorems.ts and theme/beeson.css: the head of each theorem from its kind, its
// number, and its name, under node, and the theorems of test/pages/tex/index.html in Chrome, in both
// modes, after a theorem is added, and in the print view

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { kindsOf } from '../src/kinds.ts';
import { theoremHeads } from '../src/theorems.ts';

const PAGE = 'test/pages/tex/index.html';

const KINDS = kindsOf({
  theorem: { title: 'Theorem', style: 'plain', counter: 'theorem' },
  lemma: { title: 'Lemma', style: 'plain', counter: 'theorem' },
  definition: { title: 'Definition', style: 'definition', counter: 'definition' },
});

test('the head of a theorem is the title of its kind, its number, and its name', () => {
  const heads = (theorems) => theoremHeads(theorems, KINDS).map((h) => h.head);
  assert.deepEqual(heads([{ kind: 'definition' }, { kind: 'theorem', name: 'stable manifold' }, { kind: 'definition' }]), ['Definition 1.', 'Theorem 1 (stable manifold).', 'Definition 2.']);
  // a lemma is numbered with the theorems, and a theorem on a hidden slide is not counted
  assert.deepEqual(heads([{ kind: 'theorem' }, { kind: 'lemma' }, { kind: 'lemma', counted: false }, { kind: 'theorem' }]), ['Theorem 1.', 'Lemma 2.', 'Lemma.', 'Theorem 3.']);
  // a usual kind that the preamble does not define is not numbered, and the name of a proof is its head
  assert.deepEqual(heads([{ kind: 'corollary' }, { kind: 'remark', name: 'on the proof' }, { kind: 'proof' }, { kind: 'proof', name: 'Proof of Theorem 2' }]), ['Corollary.', 'Remark (on the proof).', 'Proof.', 'Proof of Theorem 2.']);
  assert.deepEqual(theoremHeads([{ kind: 'theorem' }, { kind: 'definition' }, { kind: 'proof' }], KINDS).map((h) => h.style), ['plain', 'definition', 'remark']);
});

test('a theorem of a kind that is not defined is headed by the name of the kind and marked', () => {
  assert.deepEqual(theoremHeads([{ kind: 'conjecture' }, { kind: 'theorem' }], KINDS), [
    { head: 'conjecture.', style: 'plain', missing: true },
    { head: 'Theorem 1.', style: 'plain', missing: false },
  ]);
});

// each theorem under root: its head, the look of its head and of its words, the place where its
// words start after the head, and the square at its end
const THEOREMS = (root) => `[...${root}.querySelectorAll('p.theorem')].map((p) => {
  const head = getComputedStyle(p, '::before'), end = getComputedStyle(p, '::after'), words = getComputedStyle(p);
  const first = document.createTreeWalker(p, NodeFilter.SHOW_TEXT).nextNode();
  const range = document.createRange();
  range.setStart(first, 0);
  range.setEnd(first, 1);
  const em = p.querySelector('em');
  return {
    head: p.dataset.head,
    weight: head.fontWeight,
    slant: head.fontStyle,
    words: words.fontStyle,
    em: em ? getComputedStyle(em).fontStyle : '',
    // the head is drawn before the words, on their line
    indent: range.getBoundingClientRect().left - p.getBoundingClientRect().left > 2 * parseFloat(words.fontSize),
    square: end.content !== 'none' && end.float === 'right',
    red: head.color !== words.color,
    missing: p.dataset.missing !== undefined,
  };
})`;

const look = (head, weight, slant, words, more = {}) => ({ head, weight, slant, words, em: '', indent: true, square: false, red: false, missing: false, ...more });
// the hidden slide is not on the page of a show
const EXPECTED = [
  look('Definition 1.', '500', 'normal', 'normal'),
  // an emphasis in the italic words of a theorem is upright, as with \emph in LaTeX
  look('Theorem 1 (stable manifold).', '500', 'normal', 'italic', { em: 'normal' }),
  look('Proof.', '400', 'italic', 'normal', { square: true }),
  look('Lemma 2.', '500', 'normal', 'italic'),
  look('Theorem 3.', '500', 'normal', 'italic'),
  look('Corollary.', '500', 'normal', 'italic'),
  look('Note 1.', '400', 'italic', 'normal'),
  look('Proof of Theorem 3.', '400', 'italic', 'normal', { square: true }),
  look('conjecture.', '500', 'normal', 'italic', { red: true, missing: true }),
  look('Theorem 4.', '500', 'normal', 'italic'),
];

for (const mode of ['dark', 'light']) {
  test(`the theorems of a deck are headed and numbered through its slides, in the ${mode} mode`, { timeout: 60000 }, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.goto(deckUrl(PAGE, `theme=${mode}&still`));
    await page.waitFor(deckSettled);
    assert.deepEqual(await page.evaluate(THEOREMS('document')), EXPECTED);
    // the head is in the color of the words
    assert.ok(await page.evaluate(`(() => { const p = document.querySelector('p.theorem'); return getComputedStyle(p, '::before').color === getComputedStyle(p).color; })()`));
    assert.deepEqual(page.errors, []);
  });
}

test('the theorems are numbered again after one is added to a slide', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl(PAGE, 'still'));
  await page.waitFor(deckSettled);
  const heads = await page.evaluate(`(() => {
    const slide = document.querySelectorAll('.slides section')[1];
    slide.querySelector('p.theorem').insertAdjacentHTML('beforebegin', '<p class="theorem" data-kind="lemma">A new lemma.</p>');
    Beeson.mount(slide);
    return [...document.querySelectorAll('p.theorem')].map((p) => p.dataset.head);
  })()`);
  assert.deepEqual(heads, ['Lemma 1.', 'Definition 1.', 'Theorem 2 (stable manifold).', 'Proof.', 'Lemma 3.', 'Theorem 4.', 'Corollary.', 'Note 1.', 'Proof of Theorem 3.', 'conjecture.', 'Theorem 5.']);
  // a kind given later is headed, and the mark of a kind that is not defined is taken off
  const fixed = await page.evaluate(`(() => {
    const p = document.querySelector('p.theorem[data-missing]');
    p.dataset.kind = 'definition';
    Beeson.mount(p.closest('section'));
    return { head: p.dataset.head, missing: p.dataset.missing !== undefined, style: p.dataset.style };
  })()`);
  assert.deepEqual(fixed, { head: 'Definition 2.', missing: false, style: 'definition' });
  assert.deepEqual(page.errors, []);
});

test('the print view shows each theorem with its head on every page of its slide', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await printView(page, deckUrl(PAGE, 'print-pdf&still'));
  // the slide with a step is printed on two pages, with the same numbers on both
  const pages = await page.evaluate(`[...document.querySelectorAll('.pdf-page')].map((page) => ${THEOREMS('page')})`);
  assert.deepEqual(pages, [[], EXPECTED.slice(0, 3), EXPECTED.slice(3), EXPECTED.slice(3)]);
  assert.deepEqual(page.errors, []);
});
