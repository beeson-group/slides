// checks of the code box of the demo deck, colored and stepped by the highlight plugin of reveal.js,
// in the slide view and in the print view

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';

// the lines lit in the copy of the code shown on top, i.e. the last one shown, and the opacity of
// this copy, of its first lit line, and of its first dim line
const view = (root) => `(() => {
  const codes = [...${root}.querySelectorAll('pre > code')];
  const top = codes.filter((c) => !c.classList.contains('fragment') || c.classList.contains('visible')).pop();
  const rows = [...top.querySelectorAll('tr')];
  const lit = rows.filter((row) => row.classList.contains('highlight-line'));
  const dim = rows.find((row) => !lit.includes(row));
  const opacity = (el) => el && getComputedStyle(el).opacity;
  return { lit: lit.map((row) => rows.indexOf(row) + 1), opacity: [opacity(top), opacity(lit[0]), opacity(dim)] };
})()`;

// resolves once the transitions of the current slide have ended, i.e. the fades of 400 ms of a step.
// On a busy runner a fade starts late, and it is not over after a fixed wait of 600 ms
const still = `(async () => {
  const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  await frame();
  for (let running; (running = Reveal.getCurrentSlide().getAnimations({ subtree: true }).filter((a) => a instanceof CSSTransition)).length;) {
    await Promise.all(running.map((a) => a.finished.catch(() => {})));
    await frame();
  }
  return true;
})()`;

const EXPECTED = [[1, 2, 3], [4], [5, 6, 7], [8, 9]].map((lit) => ({ lit, opacity: ['1', '1', '0.35'] }));
const SLIDE = `[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('pre code'))`;

test('the code box of the demo deck is colored, and each step lights the next group of its lines', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('index.html', 'theme=dark'));
  await page.waitFor(deckSettled);
  await page.evaluate(`Reveal.slide(${SLIDE})`);

  const tokens = await page.evaluate(`Object.fromEntries([...Reveal.getCurrentSlide().querySelectorAll('pre > code:first-child [class^="hljs-"]')]
    .map((e) => [e.className, getComputedStyle(e).color]))`);
  assert.equal(tokens['hljs-keyword'], 'rgb(201, 79, 230)');
  assert.equal(tokens['hljs-title function_'], 'rgb(240, 128, 80)');
  assert.equal(tokens['hljs-built_in'], 'rgb(61, 139, 255)');
  assert.equal(tokens['hljs-number'], 'rgb(255, 210, 63)');
  assert.ok(tokens['hljs-ln-n'], 'the lines are numbered');

  const seen = [];
  for (let i = 0; i < EXPECTED.length; i++) {
    if (i) await page.evaluate('Reveal.next()');
    await page.evaluate(still);
    seen.push(await page.evaluate(view('Reveal.getCurrentSlide()')));
  }
  assert.deepEqual(seen, EXPECTED);
  assert.equal(await page.evaluate(`Reveal.getCurrentSlide().hasAttribute('data-complete')`), true);
  assert.deepEqual(page.errors, []);
});

// the opacity of the code box and of the sentence of the current slide, and whether the slide is complete
const state = `(() => {
  const slide = Reveal.getCurrentSlide();
  const opacity = (el) => getComputedStyle(el).opacity;
  return [opacity(slide.querySelector('pre')), opacity(slide.querySelector('p.fragment')), slide.hasAttribute('data-complete')];
})()`;

test('a step outside a code box dims the box or is dimmed by it, and a step is added to restore both', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('test/pages/code-steps.html'));
  await page.waitFor(deckSettled);

  const slides = [
    [['1', '0', false], ['1', '0', false], ['1', '0', false], ['0.45', '1', false], ['1', '1', true]],
    [['1', '0', false], ['1', '1', false], ['1', '0.45', false], ['1', '1', true]],
  ];
  for (const [h, expected] of slides.entries()) {
    await page.evaluate(`Reveal.slide(${h})`);
    const seen = [];
    for (let i = 0; i < expected.length; i++) {
      if (i) await page.evaluate('Reveal.next()');
      await page.evaluate(still);
      seen.push(await page.evaluate(state));
    }
    assert.deepEqual(seen, expected);
  }
  assert.deepEqual(page.errors, []);
});

test('the print view gives each group of lines of the code box a page', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await printView(page, deckUrl('index.html', 'print-pdf&still'));

  const pages = await page.evaluate(`[...document.querySelectorAll('.pdf-page section')].map((s, i) => [s, i]).filter(([s]) => s.querySelector('pre code')).map(([, i]) => i)`);
  assert.equal(pages.length, EXPECTED.length);
  const seen = [];
  for (const i of pages) seen.push(await page.evaluate(view(`document.querySelectorAll('.pdf-page section')[${i}]`)));
  assert.deepEqual(seen.map((s) => s.lit), EXPECTED.map((s) => s.lit));
});
