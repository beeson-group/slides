import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch } from '../scripts/chrome.mjs';
import { plotTextIn, withPlotText } from '../src/editor/text/plot-texts.ts';
import { converge, open, sessionUrl, show, talk, TALK } from './helpers/client.mjs';
import { byteExact, click, editorPage, press, type } from './helpers/editor.mjs';

const SCRIPT = String.raw`<script type="application/json" id="d">{
  "parameter": { "label": "$A$" },
  "panels": [{ "id": "p.q", "x": { "range": [0, 1], "ticks": [0, { "at": 1, "text": "one" }], "title": "$\\delta x$ in km" } }],
  "tabs": [{ "name": "a", "data": { "m": { "text": ["t \"0\"", "$t$"] } } }]
}</script>`;

test('the text of a plot is read from the string literal at its path in the JSON script', () => {
  assert.equal(plotTextIn(SCRIPT, 'panels[0].x.title'), '$\\delta x$ in km');
  assert.equal(plotTextIn(SCRIPT, 'panels[0].x.ticks[1].text'), 'one');
  assert.equal(plotTextIn(SCRIPT, 'tabs[0].data.m.text[0]'), 't "0"');
  assert.equal(plotTextIn(SCRIPT, 'parameter.label'), '$A$');
  assert.equal(plotTextIn(SCRIPT, 'panels[0].x.ticks[0]'), null);
  assert.equal(plotTextIn(SCRIPT, 'tabs[0].label'), null);
});

test('a new text of a plot replaces only the bytes of its string literal, escaped as JSON requires', () => {
  const changed = withPlotText(SCRIPT, 'panels[0].x.title', '$\\delta x$ in "km"');
  assert.equal(changed, SCRIPT.replace(String.raw`"$\\delta x$ in km"`, String.raw`"$\\delta x$ in \"km\""`));
  assert.equal(withPlotText(SCRIPT, 'tabs[0].data.m.text[1]', '</script>'), SCRIPT.replace('"$t$"', '"<\\/script>"'));
  assert.equal(withPlotText(SCRIPT, 'tabs[0].label', 'x'), null);
  assert.equal(JSON.parse(withPlotText(SCRIPT, 'parameter.label', 'tab\there').replace(/^<script[^>]*>|<\/script>$/g, '')).parameter.label, 'tab\there');
});

describe('the texts of a plot in the editor', () => {
  const DECK = 'test/pages/plot-math.html';
  const X = '.plot-label[data-plot-text="panels[0].x.title"]';
  const L = '.plot-label[data-plot-text="panels[0].labels[0].text"]';

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
  const texOf = (page, selector) => page.evaluate(`document.querySelector(${JSON.stringify(selector)})?.querySelector('[data-latex]')?.getAttribute('data-latex') ?? null`);
  const editing = (page, selector) => page.evaluate(`(() => { const a = document.activeElement; return document.querySelector(${JSON.stringify(selector)})?.contains(a) && a.isContentEditable ? a.textContent : null; })()`);
  const chosen = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-plot-text-chosen')].map((el) => el.dataset.plotText)`);

  async function plotPage() {
    const page = await editorPage(browser, { deck: DECK });
    await page.evaluate('Reveal.slide(1)');
    await settle(page);
    return page;
  }

  test('a first click selects a text of a plot, a second shows its source, and Return typesets it again with only its string literal changed', { timeout: 60000 }, async (t) => {
    const page = await plotPage();
    t.after(() => page.close());
    await click(page, X);
    await frames(page);
    assert.deepEqual(await chosen(page), ['panels[0].x.title']);
    assert.equal(await editing(page, X), null);
    await click(page, X);
    await frames(page);
    assert.equal(await editing(page, X), '$\\delta x$ in km');
    await press(page, 'End');
    await type(page, ' (scaled)');
    await press(page, 'Enter');
    await settle(page);
    assert.equal(await editing(page, X), null);
    assert.deepEqual(await chosen(page), ['panels[0].x.title']);
    assert.equal(await texOf(page, X), '\\delta x\\text{ in km (scaled)}');
    await byteExact(page, [[String.raw`"$\\delta x$ in km"`, String.raw`"$\\delta x$ in km (scaled)"`]]);
    assert.deepEqual(page.errors, []);
  });

  test('Return opens a selected text, Esc keeps the typed text, and each edit is undone as one entry', { timeout: 60000 }, async (t) => {
    const page = await plotPage();
    t.after(() => page.close());
    await click(page, X);
    await click(page, X);
    await frames(page);
    await press(page, 'End');
    await type(page, ' (scaled)');
    await press(page, 'Enter');
    await settle(page);
    await click(page, L);
    await frames(page);
    assert.deepEqual(await chosen(page), ['panels[0].labels[0].text']);
    await press(page, 'Enter');
    await frames(page);
    assert.equal(await editing(page, L), '$\\LL{1}$');
    await press(page, 'End');
    await type(page, ' "gate"');
    await press(page, 'Escape');
    await settle(page);
    assert.equal(await editing(page, L), null);
    assert.equal(await texOf(page, L), '\\LL{1}\\text{ "gate"}');
    await byteExact(page, [[String.raw`"$\\delta x$ in km"`, String.raw`"$\\delta x$ in km (scaled)"`], [String.raw`"text": "$\\LL{1}$"`, String.raw`"text": "$\\LL{1}$ \"gate\""`]]);
    await page.evaluate('window.BeesonEditor.undo()');
    await settle(page);
    assert.equal(await texOf(page, L), '\\LL{1}');
    await byteExact(page, [[String.raw`"$\\delta x$ in km"`, String.raw`"$\\delta x$ in km (scaled)"`]]);
    await page.evaluate('window.BeesonEditor.undo()');
    await settle(page);
    assert.equal(await texOf(page, X), '\\delta x\\text{ in km}');
    await byteExact(page);
    assert.deepEqual(page.errors, []);
  });

  test('a tick computed from a number is not a text of the JSON, and a click on it selects the plot', { timeout: 60000 }, async (t) => {
    const page = await plotPage();
    t.after(() => page.close());
    assert.equal(await page.evaluate(`document.querySelectorAll('.plot-tick[data-plot-text]').length`), 0);
    await click(page, '.plot-tick');
    await frames(page);
    assert.deepEqual(await chosen(page), []);
    assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((e) => e.matches(".plot"))'), [true]);
    assert.deepEqual(page.errors, []);
  });
});

const PLOT_TALK = TALK.replace('<link rel="stylesheet" href="theme/beeson.css">', `<link rel="stylesheet" href="theme/beeson.css">
<script src="theme/mathjax-config.js"></script>
<script src="theme/vendor/mathjax/tex-svg.js"></script>`).replace('<p>First slide</p>', `<p>First slide</p>
  <div class="plot figure-box" data-plot="one"></div>
  <script type="application/json" id="one">{ "panels": [{ "id": "p", "x": { "range": [0, 1], "title": "$x$" }, "y": { "range": [0, 1] } }], "tabs": [{ "name": "a", "values": [0] }] }</script>`);

test('in a session, a text of a plot edited on one page is written into index.html and drawn on the other pages', { timeout: 180_000 }, async (t) => {
  const server = await talk(t, { deck: PLOT_TALK });
  const browser = await launch({ offline: false });
  t.after(() => browser.close());
  const list = [await open(browser, sessionUrl(server.edit), { name: 'Ann' }), await open(browser, sessionUrl(server.edit), { name: 'Ben' })];
  await converge(server, list);
  const [ann, ben] = list;
  const X = '.plot-label[data-plot-text="panels[0].x.title"]';
  const tex = `document.querySelector('${X} [data-latex]')?.getAttribute('data-latex')`;
  await show(ann, 'One');
  await ann.waitFor(`${tex} === 'x'`);
  await click(ann, X);
  await click(ann, X);
  await ann.waitFor(`document.activeElement.isContentEditable && document.activeElement.textContent === '$x$'`);
  await press(ann, 'End');
  await type(ann, ' in km');
  await press(ann, 'Enter');
  await ann.waitFor(`${tex} === 'x\\\\text{ in km}'`);
  await converge(server, list);
  assert.equal(server.read(), PLOT_TALK.replace('"title": "$x$"', '"title": "$x$ in km"'));
  await show(ben, 'One');
  await ben.waitFor(`${tex} === 'x\\\\text{ in km}'`, 20_000);
});
