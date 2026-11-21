import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser?.close();
});

const texts = (root) => `[...${root}.querySelectorAll('.plot-label, .plot-readout > span:first-child')].map((el) => ({
  words: [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('|'),
  tex: [...el.querySelectorAll('mjx-container')].map((c) => c.querySelector('[data-latex]')?.getAttribute('data-latex')),
  focusable: el.querySelector('[tabindex]') !== null,
  faults: el.querySelectorAll('mjx-merror, [data-mjx-error], [fill="red"]').length,
}))`;

test('each text of a plot is typeset by MathJax as one formula, its words in \\text, with the macros of the deck before the deck is settled', { timeout: 60000 }, async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(deckUrl('test/pages/plot-math.html', '', '/1'));
  await page.waitFor(deckSettled);
  const shown = await page.evaluate(texts('document'));
  const find = (tex) => shown.find((s) => s.tex.includes(tex));
  assert.deepEqual(find('\\delta x\\text{ in km}'), { words: '', tex: ['\\delta x\\text{ in km}'], focusable: false, faults: 0 });
  assert.deepEqual(find('\\text{the }\\sat\\text{ family}'), { words: '', tex: ['\\text{the }\\sat\\text{ family}'], focusable: false, faults: 0 });
  assert.ok(find('-\\text{1}'), JSON.stringify(shown));
  assert.deepEqual(find('\\vb{r}'), { words: '', tex: ['\\vb{r}'], focusable: false, faults: 0 });
  for (const tex of ['\\LL{1}', '\\alpha = -2.932', '\\alpha = \\pm 2.334\\,i']) assert.ok(find(tex), `${tex} in ${JSON.stringify(shown)}`);
  assert.ok(shown.every((s) => s.words === '' && s.tex.length === 1 && s.faults === 0), JSON.stringify(shown));
  assert.deepEqual(page.errors, []);
});

test('a label with a text per frame is typeset once per text, and not again as the plot is played', { timeout: 60000 }, async (t) => {
  const page = await browser.newPage({ motion: true });
  t.after(() => page.close());
  await page.goto(deckUrl('test/pages/plot-math.html', '', '/1'));
  await page.waitFor(deckSettled);
  await page.evaluate(`(() => {
    window.typesets = 0;
    const typeset = MathJax.tex2svgPromise;
    MathJax.tex2svgPromise = (...args) => { window.typesets++; return typeset(...args); };
    window.seen = new Set();
    const mark = document.querySelector('.plot-mark');
    const record = () => { window.seen.add(mark.querySelector('[data-latex]')?.getAttribute('data-latex')); requestAnimationFrame(record); };
    Beeson.plots[0].start();
    requestAnimationFrame(record);
  })()`);
  await page.waitFor(`window.seen.has('t = 0') && window.seen.has('t = 1')`, 30000);
  assert.equal(await page.evaluate('window.typesets'), 0);
  assert.deepEqual(page.errors, []);
});

test('a formula that MathJax does not typeset is shown as its TeX with the reason that npm run check reports', { timeout: 60000 }, async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(deckUrl('test/pages/plot-math.html', '', '/1'));
  await page.waitFor(deckSettled);
  await page.evaluate(`(() => {
    const typeset = MathJax.tex2svgPromise;
    MathJax.tex2svgPromise = (tex, options) => (tex === 'q' ? Promise.reject(new Error('the extension is not loaded')) : typeset(tex, options));
    const spec = JSON.parse(document.getElementById('data').textContent);
    spec.parameter.label = '$q$';
    Beeson.plots[0].reload(JSON.stringify(spec));
    Beeson.plots[0].fit();
  })()`);
  await page.waitFor(`document.querySelector('.plot-readout [data-mjx-error]')`);
  const shown = await page.evaluate(`(() => { const e = document.querySelector('.plot-readout [data-mjx-error]'); return [e.textContent, e.dataset.mjxError]; })()`);
  assert.deepEqual(shown, ['$q$', 'the extension is not loaded']);
  assert.deepEqual(page.errors, []);
});

test('the formulas in the texts of a plot are typeset in the print view', { timeout: 60000 }, async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await printView(page, deckUrl('test/pages/plot-math.html', 'print-pdf'));
  const printed = await page.evaluate(texts(`document.querySelector('.pdf-page:has(.plot)')`));
  assert.ok(printed.length > 6, JSON.stringify(printed));
  assert.ok(printed.some((s) => s.tex.includes('\\LL{1}')), JSON.stringify(printed));
  assert.ok(printed.every((s) => !s.words.includes('$') && s.faults === 0), JSON.stringify(printed));
  assert.deepEqual(page.errors, []);
});
