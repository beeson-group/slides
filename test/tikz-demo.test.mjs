// the two TikZ figures of the demo deck, right before its closing slide: a pgfplots axis of
// figures/decay.tex read from figures/decay.csv and a drawing of figures/libration.tex, each compiled
// to an output that is current, with a step for each of its parts, and drawn in both modes

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';
import { figureStatus, readFigure } from '../scripts/figures.mjs';

const DECK = 'index.html';

test('the demo deck shows the figures decay and libration right before its closing slide, each with a current output', () => {
  const html = readFileSync(DECK, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const slides = [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)].map((m) => m[0]);
  const closing = slides.findIndex((s) => /^<section class="closing"/.test(s));
  assert.ok(closing >= 2);
  assert.match(slides[closing - 2], /<div class="figure-box tikz" data-figure="decay"/);
  assert.match(slides[closing - 1], /<div class="figure-box tikz" data-figure="libration"/);
  const status = Object.fromEntries(figureStatus(DECK).map((f) => [f.name, f.state]));
  assert.deepEqual({ decay: status.decay, libration: status.libration }, { decay: 'current', libration: 'current' });
  // the curves of decay are its two parts, and libration has at least two parts, each a step of its slide
  // the output is read in a vm context, hence its arrays are copied into this realm before a strict comparison
  assert.deepEqual([...readFigure('.', 'decay').parts], ['x', 'y']);
  assert.ok(readFigure('.', 'libration').parts.length >= 2);
  for (const [slide, name] of [[slides[closing - 2], 'decay'], [slides[closing - 1], 'libration']]) {
    const steps = [...slide.matchAll(/<span class="fragment" data-part="([\w-]+)" data-fragment-index="\d+"><\/span>/g)].map((m) => m[1]);
    assert.deepEqual(steps, [...readFigure('.', name).parts].filter((part) => steps.includes(part)));
    assert.ok(steps.length >= 2, `${name} has ${steps.length} steps`);
  }
  // the data of decay: t from 0 to 12 in steps of 0.1, with x = exp(-0.12 t) cos t and y = exp(-0.12 t) sin t
  const rows = readFileSync('figures/decay.csv', 'utf8').trim().split('\n');
  assert.equal(rows[0], 't,x,y');
  assert.equal(rows.length, 122);
  for (const row of rows.slice(1)) {
    const [t, x, y] = row.split(',').map(Number);
    assert.ok(Math.abs(x - Math.exp(-0.12 * t) * Math.cos(t)) < 1e-4 && Math.abs(y - Math.exp(-0.12 * t) * Math.sin(t)) < 1e-4, row);
  }
});

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser?.close();
});

test('the figures of the demo deck are drawn in both modes without an error', { timeout: 120000 }, async (t) => {
  for (const mode of ['dark', 'light']) {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.goto(deckUrl(DECK, `theme=${mode}`));
    await page.waitFor(deckSettled);
    const figures = await page.evaluate(`[...document.querySelectorAll('.tikz')].map((el) => ({
      name: el.dataset.figure,
      error: el.querySelector('.tikz-error')?.textContent ?? null,
      mode: el.querySelector(':scope > svg [id]')?.id.split('-')[2] ?? null,
    }))`);
    assert.deepEqual(figures, [{ name: 'decay', error: null, mode }, { name: 'libration', error: null, mode }]);
    assert.deepEqual(page.errors, []);
  }
});
