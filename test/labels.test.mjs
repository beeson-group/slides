import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';
import { labelTex, plotTex, wordsTex } from '../src/drawn-text.ts';
import { byteExact, center, click, editorPage, press, type } from './helpers/editor.mjs';

test('the words of a drawn text are set in \\text, with the characters that TeX reads escaped', () => {
  assert.equal(wordsTex('Moon'), '\\text{Moon}');
  assert.equal(wordsTex('a {b} $5'), '\\text{a }\\{\\text{b}\\}\\text{ }\\$\\text{5}');
  assert.equal(wordsTex('C:\\x'), '\\text{C:}\\backslash \\text{x}');
  assert.equal(wordsTex('\u22121'), '-\\text{1}');
  assert.equal(wordsTex('10\u00a0km'), '\\text{10}~\\text{km}');
  assert.equal(wordsTex(''), '');
});

test('a label is one formula of its words and its \\( \\) math, with its spaces collapsed', () => {
  assert.equal(labelTex('Moon'), '\\text{Moon}');
  assert.equal(labelTex('\\(\\mathcal{L}_{1}\\)'), '\\mathcal{L}_{1}');
  assert.equal(labelTex('\n    Halo \\(\\gamma\\)\n    orbit  '), '\\text{Halo }\\gamma\\text{ orbit}');
});

test('a text of a plot is one formula of its words and its $ $ math', () => {
  assert.equal(plotTex('$\\delta x$ in km'), '\\delta x\\text{ in km}');
  assert.equal(plotTex('the $\\sat$ family'), '\\text{the }\\sat\\text{ family}');
  assert.equal(plotTex('\u22121'), '-\\text{1}');
});

const LABELS = `[...document.querySelectorAll('section.present .backdrop > .label')].map((l) => ({
  tex: [...l.querySelectorAll('mjx-container')].map((c) => c.querySelector('[data-latex]')?.getAttribute('data-latex')),
  words: [...l.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent.trim()).join(''),
  italic: getComputedStyle(l).fontStyle,
}))`;

describe('the labels of a drawing', () => {
  const DECK = 'test/pages/editor-layouts.html';
  const SLIDE = 2;
  const LABEL = 'section.present .backdrop > .label';
  const L2 = `${LABEL}:nth-of-type(2)`;
  const L2_SOURCE = '<span class="label" data-at="L2" data-dy="-34">\\(\\mathcal{L}_{2}\\)</span>';

  let browser;
  before(async () => {
    browser = await launch();
  });
  after(async () => {
    await browser?.close();
  });

  const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => d(true), 100))))');
  const settle = async (page) => {
    await frames(page);
    await page.evaluate('MathJax.startup.promise.then(() => true)');
    await frames(page);
  };
  const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
  const selected = (page) => page.evaluate('window.BeesonEditor.selection().map((e) => e.className)');
  const sourceOf = (page, selector) => page.evaluate(`(() => { const l = document.querySelector(${JSON.stringify(selector)}); return l.firstElementChild?.getAttribute('data-label-source') ?? l.textContent; })()`);

  async function labelPage() {
    const page = await editorPage(browser, { deck: DECK });
    await page.evaluate(`Reveal.slide(${SLIDE})`);
    await settle(page);
    return page;
  }

  test('labels are typeset by the theme as one formula each, upright, before the deck is settled', { timeout: 60000 }, async (t) => {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.goto(deckUrl(DECK, '', `/${SLIDE}`));
    await page.waitFor(deckSettled);
    assert.deepEqual(await page.evaluate(LABELS), [
      { tex: ['\\mathcal{L}_{1}'], words: '', italic: 'normal' },
      { tex: ['\\mathcal{L}_{2}'], words: '', italic: 'normal' },
    ]);
    assert.deepEqual(page.errors, []);
  });

  test('a first click selects a label, a second edits its source, and Esc typesets it again with every other byte kept', { timeout: 60000 }, async (t) => {
    const page = await labelPage();
    t.after(() => page.close());
    const at = await center(page, L2);
    await click(page, at);
    await frames(page);
    assert.deepEqual(await selected(page), ['label']);
    await click(page, at);
    await frames(page);
    assert.equal(await page.evaluate(`document.activeElement === document.querySelector(${JSON.stringify(L2)})`), true);
    await press(page, 'End');
    await type(page, ' gate');
    await press(page, 'Enter');
    await frames(page);
    assert.equal(await page.evaluate(`document.activeElement === document.querySelector(${JSON.stringify(L2)})`), false);
    await settle(page);
    assert.equal(await sourceOf(page, L2), '\\(\\mathcal{L}_{2}\\) gate');
    assert.deepEqual((await page.evaluate(LABELS))[1].tex, ['\\mathcal{L}_{2}\\text{ gate}']);
    await byteExact(page, [[L2_SOURCE, L2_SOURCE.replace('\\)</span>', '\\) gate</span>')]]);
    await page.evaluate('window.BeesonEditor.undo()');
    await settle(page);
    await byteExact(page);
    assert.deepEqual(page.errors, []);
  });

  test('Add Label puts a label at the point of the click, ready for its text, and Delete removes a selected label', { timeout: 60000 }, async (t) => {
    const page = await labelPage();
    t.after(() => page.close());
    const box = await page.evaluate(`(() => { const r = document.querySelector('section.present .backdrop').getBoundingClientRect(); return { x: r.left + r.width * 0.3, y: r.top + r.height * 0.7 }; })()`);
    await page.evaluate(`window.BeesonEditor.exec('backdrop.addLabel', { el: document.querySelector('section.present .backdrop'), x: ${box.x}, y: ${box.y} })`);
    await frames(page);
    await type(page, 'Halo \\(\\gamma\\)');
    await press(page, 'Escape');
    await settle(page);
    const added = `${LABEL}:nth-of-type(3)`;
    assert.equal(await sourceOf(page, added), 'Halo \\(\\gamma\\)');
    const placed = await page.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(added)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    assert.ok(Math.hypot(placed.x - box.x, placed.y - box.y) < 4, JSON.stringify({ placed, box }));
    const tag = (await page.evaluate('window.BeesonEditor.render()')).match(/<span class="label" data-at="(-?[\d.]+) (-?[\d.]+)">Halo \\\(\\gamma\\\)<\/span>/);
    assert.ok(tag, 'the added label is written with its point');
    await byteExact(page, [[L2_SOURCE, `${L2_SOURCE}\n    ${tag[0]}`]]);
    assert.deepEqual(await selected(page), ['label']);
    await press(page, 'Backspace');
    await settle(page);
    await byteExact(page);
    assert.deepEqual(page.errors, []);
  });
});
