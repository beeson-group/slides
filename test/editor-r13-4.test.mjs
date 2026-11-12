// the work of R13.4 on both platforms: the place of a new plot and of a new table on a slide
// without a free place of its size, the width of the navigator in a narrow window, and the
// selection of a display formula after its TeX is applied. each edit of the file is checked byte
// for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { center, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const DECK = 'index.html';
// the slides of index.html with an equation, with a figure in a zone, and with a video
const EQUATIONS = 3;
const FIGURES = 4;
const VIDEO = 10;
const PLATFORMS = ['mac', 'other'];
const FORMAT = '#beeson-edit-panel-format';

let browser;
let server;
before(async () => {
  browser = await launch({ offline: false });
  server = await serve('.');
});
after(async () => {
  await browser?.close();
  server?.close();
});

const js = (v) => JSON.stringify(v);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

// the box in slide px of each shown element of selector on the current slide
const boxes = (page, selector) => page.evaluate(`(() => {
  const slide = document.querySelector('.reveal .slides > section.present');
  const s = slide.getBoundingClientRect();
  const k = s.width / slide.offsetWidth;
  return [...slide.querySelectorAll(${js(selector)})].filter((e) => e.getClientRects().length).map((e) => {
    const r = e.getBoundingClientRect();
    return { left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k };
  });
})()`);
// the boxes in slide px of the lines of the text of each element of selector, clipped to the box
// of the element, as overflow.ts tests them, since the content area of a font is taller than the
// box of a heading with a tight line height
const lines = (page, selector) => page.evaluate(`(() => {
  const slide = document.querySelector('.reveal .slides > section.present');
  const s = slide.getBoundingClientRect();
  const k = s.width / slide.offsetWidth;
  const out = [];
  for (const el of slide.querySelectorAll(${js(selector)})) {
    const b = el.getBoundingClientRect();
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        const top = Math.max(r.top, b.top);
        const bottom = Math.min(r.bottom, b.bottom);
        if (r.width > 1 && bottom > top) out.push({ left: (r.left - s.left) / k, top: (top - s.top) / k, right: (r.right - s.left) / k, bottom: (bottom - s.top) / k });
      }
    }
  }
  return out;
})()`);
const meets = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const size = (a) => (a.right - a.left) * (a.bottom - a.top);
// the share of the area of b that a covers
const covers = (a, b) => area(a, b) / size(b);

// the editor on a deck served over HTTP, with the storage of the origin emptied first, and with
// slide n shown
async function load(t, platform, { n = 0, size: window = { width: 1600, height: 1000 } } = {}) {
  const page = await browser.newPage(window);
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the rendered text differs from before, an undo gives before and a redo the edited text byte for
// byte, and the saved text is opened again without problems
async function checkEdit(page, before, name) {
  const edited = await render(page);
  assert.notEqual(edited, before);
  await undo(page);
  assert.equal(await render(page), before);
  await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, name);
  assert.equal(text, edited);
  return edited;
}

for (const platform of PLATFORMS) {
  // plot-placement. the theme draws a plot at 600 by 800 slide px, and the slides with a figure or
  // a video in the zone do not have a free place of that size
  test(`a new plot on a slide without a free place of its size is put off the box of the figure or the video, and a second plot off the first (${platform})`, async (t) => {
    for (const [n, what] of [[FIGURES, ':scope > figure.zone'], [VIDEO, ':scope > .zone:not(.plot)']]) {
      const page = await load(t, platform, { n });
      const before = await render(page);
      const [figure] = await boxes(page, what);
      assert.ok(figure, `slide ${n} does not have a figure in its zone`);
      await exec(page, 'insert.plot');
      await exec(page, 'plot.closeData');
      await frames(page);
      await frames(page);
      const [plot] = await boxes(page, ':scope > .plot');
      assert.ok(plot, 'no plot was inserted');
      assert.ok(plot.left >= -1 && plot.top >= -1 && plot.right <= 1921 && plot.bottom <= 1081, `the plot at ${js(plot)} runs past the slide`);
      assert.ok(covers(plot, figure) < 0.25, `on slide ${n}, the plot at ${js(plot)} covers ${Math.round(100 * covers(plot, figure))} % of the figure at ${js(figure)}`);
      assert.equal(await page.evaluate(`window.BeesonEditor.selection().length === 1 && window.BeesonEditor.selection()[0].matches('.plot')`), true, 'the new plot is not selected');
      const under = (await lines(page, ':scope > p, :scope > ul > li, :scope > h2')).filter((l) => meets(plot, l));
      if (under.length) {
        const s = await page.evaluate('window.BeesonEditor.status()');
        assert.ok(s.overflow > 0 && /A plot covers \d+ texts?/.test(s.message), `the texts under the plot are not named in the status: ${js(s)}`);
      }
      await checkEdit(page, before, `r13-4-plot-${n}-${platform}.html`);
      await exec(page, 'insert.plot');
      await exec(page, 'plot.closeData');
      await frames(page);
      const plots = await boxes(page, ':scope > .plot');
      assert.equal(plots.length, 2);
      assert.ok(covers(plots[1], plots[0]) < 0.5, `the second plot at ${js(plots[1])} lies on the first at ${js(plots[0])}`);
      assert.ok(covers(plots[1], figure) < 0.5, `the second plot at ${js(plots[1])} lies on the figure at ${js(figure)}`);
      assert.deepEqual(errors(page), []);
    }
  });

  // table-over-list. by R15.10, a table without a free place is put inside the margins at the
  // middle of the slide, where it may cover words, and off the figure
  test(`a new table on a slide without a free place of its size is put at the middle of the slide off the figure, and a second table off the first (${platform})`, async (t) => {
    const page = await load(t, platform, { n: FIGURES });
    const before = await render(page);
    await click(page, '.reveal section.present ul > li:last-child');
    await press(page, 'Escape');
    const [figure] = await boxes(page, ':scope > figure.zone');
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await frames(page);
    const [table] = await boxes(page, ':scope > table');
    assert.ok(table, 'no table was inserted');
    assert.ok(table.left >= 119 && table.top >= -1 && table.right <= 1801 && table.bottom <= 1081, `the table at ${js(table)} is not inside the margins of the slide`);
    assert.ok(Math.abs((table.top + table.bottom) / 2 - 540) <= 1, `the table at ${js(table)} is not at the middle of the slide`);
    assert.equal(area(table, figure), 0, `the table at ${js(table)} lies over the figure at ${js(figure)}`);
    await checkEdit(page, before, `r13-4-table-${platform}.html`);
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await frames(page);
    const tables = await boxes(page, ':scope > table');
    assert.equal(tables.length, 2);
    assert.ok(covers(tables[1], tables[0]) < 0.5, `the second table at ${js(tables[1])} lies on the first at ${js(tables[0])}`);
    assert.deepEqual(errors(page), []);
  });

  // navigator-edge-drag. in a window 1000 px wide with the Format pane open, the navigator is
  // drawn at most 50vw less the width of the pane
  test(`a drag of the edge of the navigator past its widest drawn width stores the drawn width (${platform})`, async (t) => {
    const page = await load(t, platform, { n: FIGURES, size: { width: 1000, height: 900 } });
    await page.evaluate(`document.documentElement.classList.contains('beeson-format') || window.BeesonEditor.exec('shell.format'), true`);
    await frames(page);
    const geo = () => page.evaluate(`(() => {
      const edge = document.querySelector('.beeson-edit-nav-edge');
      const e = edge.getBoundingClientRect();
      return { nav: document.querySelector('.beeson-edit-nav').getBoundingClientRect().width, at: { x: e.left + e.width / 2, y: e.top + e.height / 2 },
        now: Number(edge.getAttribute('aria-valuenow')), css: parseFloat(document.documentElement.style.getPropertyValue('--ed-nav-w')), stored: Number(localStorage.getItem('beeson-nav-w')) };
    })()`);
    const g0 = await geo();
    await drag(page, g0.at, { dx: 120, steps: 12 });
    await frames(page);
    const g1 = await geo();
    assert.ok(g1.nav < g0.nav + 120 - 2, `the navigator in a window 1000 px wide follows the pointer to ${g1.nav} px`);
    for (const [k, v] of Object.entries({ now: g1.now, css: g1.css, stored: g1.stored })) assert.ok(Math.abs(v - g1.nav) <= 1, `the ${k} width is ${v} while ${g1.nav} px is drawn`);
    await drag(page, g1.at, { dx: -40, steps: 8 });
    await frames(page);
    const g2 = await geo();
    assert.ok(Math.abs(g2.nav - (g1.nav - 40)) <= 2, `a drag 40 px to the left took the navigator from ${g1.nav} to ${g2.nav} px`);
    assert.ok(Math.abs(g2.now - g2.nav) <= 1 && Math.abs(g2.stored - g2.nav) <= 1, `after the drag to the left, ${js(g2)}`);
    assert.deepEqual(errors(page), []);
  });

  // formula-frame
  test(`a display formula stays selected and framed after its TeX is applied in the Formula pane, and after an undo and a redo (${platform})`, async (t) => {
    const page = await load(t, platform, { n: EQUATIONS });
    await page.evaluate(`(() => { const E = window.BeesonEditor; E.state('view.steps').checked && E.exec('view.steps'); E.state('shell.format').checked || E.exec('shell.format'); return true; })()`);
    await frames(page);
    const before = await render(page);
    await click(page, await center(page, '.reveal section.present div.math mjx-container'));
    await press(page, 'Escape');
    await frames(page);
    const framed = () => page.evaluate(`(() => {
      const math = document.querySelector('.reveal section.present div.math');
      const m = math.getBoundingClientRect();
      const sel = window.BeesonEditor.selection();
      const frames = [...document.querySelectorAll('.beeson-overlay .beeson-frame.selected')].filter((f) => !f.hidden && getComputedStyle(f).display !== 'none').map((f) => f.getBoundingClientRect())
        .filter((r) => r.width > 0 && Math.abs(r.left - m.left) < 20 && Math.abs(r.top - m.top) < 20 && Math.abs(r.width - m.width) < 40);
      return { selected: sel.length === 1 && sel[0] === math, framed: frames.length === 1 };
    })()`);
    assert.deepEqual(await framed(), { selected: true, framed: true }, 'the display is not selected by a click and Escape');
    await click(page, await center(page, `${FORMAT} textarea[name="tex"]`));
    await press(page, 'End');
    await type(page, ' a');
    await press(page, 'Enter');
    await frames(page);
    await frames(page);
    assert.deepEqual(await framed(), { selected: true, framed: true }, 'after Enter in the TeX field');
    const edited = await render(page);
    assert.notEqual(edited, before);
    await undo(page);
    await frames(page);
    assert.equal(await render(page), before);
    assert.deepEqual(await framed(), { selected: true, framed: true }, 'after an undo of the TeX');
    await redo(page);
    await frames(page);
    assert.equal(await render(page), edited);
    assert.deepEqual(await framed(), { selected: true, framed: true }, 'after a redo of the TeX');
    const { text } = await saveAndReopen(page, `r13-4-formula-${platform}.html`);
    assert.equal(text, edited);
    assert.deepEqual(errors(page), []);
  });
}
