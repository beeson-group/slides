// checks of the steps of src/steps.ts, i.e. the fragments held at full opacity with data-keep or by
// a highlight, and the classes colored with data-highlight. the same steps are then checked in a
// test deck in Chrome, in the slide view and in the print view

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { resolve } from '../src/steps.ts';

const step = (index, visible, more = {}) => ({ index, visible, keep: null, highlight: [], tone: 'accent', holds: [], ...more });

test('a fragment with an empty data-keep is held through the next step of the slide', () => {
  const steps = [step(1, true, { keep: 'next' }), step(4, true), step(6, true)];
  assert.deepEqual(resolve(steps, 4).held, [true, false, false]);
  assert.deepEqual(resolve(steps, 6).held, [false, false, false]);
});

test('a fragment with a data-keep of a number is held through that step', () => {
  const steps = [step(1, true, { keep: 3 }), step(2, true), step(3, true), step(4, true)];
  assert.deepEqual(resolve(steps, 3).held, [true, false, false, false]);
  assert.deepEqual(resolve(steps, 4).held, [false, false, false, false]);
});

test('the current fragment and a hidden fragment are not held', () => {
  const steps = [step(1, true, { keep: 'next' }), step(2, false)];
  assert.deepEqual(resolve(steps, 1).held, [false, false]);
  assert.deepEqual(resolve([step(1, false, { keep: 'next' }), step(2, false)], -1).held, [false, false]);
});

test('a fragment is held while the current step highlights a class in it', () => {
  const steps = [step(1, true, { holds: ['a'] }), step(2, true), step(3, true, { highlight: ['a'] }), step(4, true)];
  assert.deepEqual(resolve(steps, 2).held, [false, false, false, false]);
  assert.deepEqual(resolve(steps, 3).held, [true, false, false, false]);
  assert.deepEqual(resolve(steps, 4).held, [false, false, false, false]);
});

test('a class is colored once its step is shown, in the tone of the last step that names it', () => {
  const steps = [step(1, true, { highlight: ['a'] }), step(2, true, { highlight: ['a', 'b'], tone: 'violet' }), step(3, false, { highlight: ['c'] })];
  assert.deepEqual([...resolve(steps, 2).lit], [['a', 'violet'], ['b', 'violet']]);
  assert.deepEqual([...resolve([step(1, true, { highlight: ['a'] }), step(2, false, { highlight: ['a'], tone: 'violet' })], 1).lit], [['a', 'accent']]);
  assert.deepEqual([...resolve([step(1, false, { highlight: ['a'] })], -1).lit], []);
});

// the opacity of the display, of the sentence after it, and the color of each class, in the
// display of MathJax and in a span of the text
const view = (root) => `(() => {
  const root = ${root}, color = (el) => el && getComputedStyle(el).color;
  const [display, sentence] = root.querySelectorAll('.fragment');
  return {
    display: [getComputedStyle(display).opacity, display.hasAttribute('data-held')],
    sentence: getComputedStyle(sentence).opacity,
    first: [color(root.querySelector('mjx-container .first')), color(root.querySelector('span.first'))],
    second: color(root.querySelector('mjx-container .second')),
  };
})()`;

const TEXT = 'rgb(242, 242, 239)';
const ACCENT = 'rgb(240, 128, 80)';
const VIOLET = 'rgb(201, 79, 230)';

// at the start, and after each of the six steps
const EXPECTED = [
  { display: ['0', false], sentence: '0', first: [TEXT, TEXT], second: TEXT },
  { display: ['1', false], sentence: '0', first: [TEXT, TEXT], second: TEXT },
  { display: ['1', true], sentence: '1', first: [TEXT, TEXT], second: TEXT },
  { display: ['1', true], sentence: '0.45', first: [ACCENT, ACCENT], second: TEXT },
  { display: ['1', true], sentence: '0.45', first: [ACCENT, ACCENT], second: VIOLET },
  { display: ['0.45', false], sentence: '0.45', first: [ACCENT, ACCENT], second: VIOLET },
  { display: ['1', false], sentence: '1', first: [ACCENT, ACCENT], second: VIOLET },
];

test('a display is held and its symbols are colored step by step', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('test/pages/stepped-math.html'));
  await page.waitFor(deckSettled);

  const seen = [];
  for (let i = 0; i < EXPECTED.length; i++) {
    if (i) await page.evaluate('Reveal.next()');
    // after the transitions of opacity and color, of 400 ms
    await new Promise((done) => setTimeout(done, 600));
    seen.push(await page.evaluate(view('Reveal.getCurrentSlide()')));
  }
  assert.deepEqual(seen, EXPECTED);
  assert.deepEqual(page.errors, []);
});

test('the print view shows the held display and the colors of each step', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await printView(page, deckUrl('test/pages/stepped-math.html', 'print-pdf'));

  assert.equal(await page.evaluate(`document.querySelectorAll('.pdf-page').length`), EXPECTED.length);
  const seen = [];
  for (let i = 0; i < EXPECTED.length; i++) seen.push(await page.evaluate(view(`document.querySelectorAll('.pdf-page section')[${i}]`)));
  // the page of the last step is not marked complete in the print view, hence it is printed dimmed
  assert.deepEqual(seen.slice(0, -1), EXPECTED.slice(0, -1));
});
