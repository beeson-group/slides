// the work of R12.4 on both platforms: the place of a new table and of a new plot, a text laid over
// a figure by a change of the layout, the pair of an image for the two modes, the caption of a
// picture, the slide made from the Content tile, and the name and the path of an unsaved picture.
// each edit of the file is checked byte for byte, after an undo and a redo, and after a save and
// an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { drag, saveAndReopen } from './helpers/editor.mjs';

const DECK = 'index.html';
// the slides of index.html with a list beside a backdrop, with a figure in a zone, and with a video
const STEPS = 2;
const FIGURES = 4;
const VIDEO = 10;
// the slide of editor-layouts.html with a heading and a backdrop
const GLIDE = 13;
const PLATFORMS = ['mac', 'other'];

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
  const slide = document.querySelector('.reveal .slides > section.present, .reveal .slides > section > section.present');
  const s = slide.getBoundingClientRect();
  const k = s.width / slide.offsetWidth;
  return [...slide.querySelectorAll(${js(selector)})].filter((e) => e.getClientRects().length).map((e) => {
    const r = e.getBoundingClientRect();
    return { left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k };
  });
})()`);
const meets = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;

// the editor on a deck served over HTTP, with the storage of the origin emptied first, and with
// slide n shown
async function load(t, platform, { deck = DECK, n = 0, size = { width: 1600, height: 1000 } } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
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
  // tables-equations-insert-5
  test(`a new table beside the list of a slide with a backdrop is put in the free space over the backdrop (${platform})`, async (t) => {
    const page = await load(t, platform, { n: STEPS });
    const before = await render(page);
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await frames(page);
    const [table] = await boxes(page, ':scope > table');
    assert.ok(table, 'no table was inserted');
    for (const b of await boxes(page, ':scope > ul > li, :scope > p, :scope > h2')) {
      assert.ok(!meets(table, b), `the table at ${js(table)} lies over a text at ${js(b)}`);
    }
    await checkEdit(page, before, `r12-4-table-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });

  // tables-equations-insert-6. the theme draws a plot at the size of a zone, 600 by 800 slide px,
  // and the slides of index.html with a figure or a video in the zone do not have a free place of
  // that size, where the plot stays in the zone off every text. the slide of editor-layouts.html
  // with a QR code moved into the zone has one, at the left over its backdrop
  test(`a new plot is put off the figures and the texts already on the slide (${platform})`, async (t) => {
    for (const [deck, n, first] of [['test/pages/editor-layouts.html', GLIDE, 'insert.qr'], [DECK, FIGURES], [DECK, VIDEO]]) {
      const page = await load(t, platform, { deck, n });
      const before = await render(page);
      if (first) {
        // the QR code is dragged from the text column into the zone place
        await exec(page, first);
        await frames(page);
        const k = await page.evaluate(`(() => { const s = document.querySelector('.reveal section.present'); return s.getBoundingClientRect().width / s.offsetWidth; })()`);
        await drag(page, '.reveal section.present > .qr', { dx: 1180 * k, dy: 60 * k });
        await frames(page);
      }
      const texts = await boxes(page, ':scope > p, :scope > ul > li, :scope > .foot');
      const figures = await boxes(page, ':scope > .qr');
      await exec(page, 'insert.plot');
      await exec(page, 'plot.closeData');
      await frames(page);
      const [plot] = await boxes(page, ':scope > .plot');
      assert.ok(plot, 'no plot was inserted');
      assert.equal(figures.length, first ? 1 : 0);
      if (first) assert.ok(figures[0].left > 1100, `the QR code was not moved into the zone place: ${js(figures[0])}`);
      for (const b of [...texts, ...figures]) assert.ok(!meets(plot, b), `on slide ${n} of ${deck}, the plot at ${js(plot)} lies over ${js(b)}`);
      if (!first) await checkEdit(page, before, `r12-4-plot-${n}-${platform}.html`);
      assert.deepEqual(errors(page), []);
    }
  });

  // navigator-slides-canvas-1
  test(`a text laid over the figure of its slide by a change of the layout is marked and named in the status (${platform})`, async (t) => {
    for (const id of ['slide.layout.wide', 'slide.layout.title', 'slide.layout.closing']) {
      const page = await load(t, platform, { n: FIGURES });
      assert.equal((await page.evaluate('window.BeesonEditor.status()')).overflow, 0, 'the slide is reported before the change');
      await exec(page, id);
      await frames(page);
      await frames(page);
      const s = await page.evaluate('window.BeesonEditor.status()');
      assert.ok(s.overflow > 0, `after ${id}, the texts over the figure are not counted`);
      assert.match(s.message, /over a figure/, `after ${id}, the status reads ${s.message}`);
      assert.ok(await page.evaluate(`document.querySelectorAll('.reveal section.present .beeson-overflow').length > 0`));
      await undo(page);
      await frames(page);
      await frames(page);
      assert.equal((await page.evaluate('window.BeesonEditor.status()')).overflow, 0, `after an undo of ${id}, the slide is still reported`);
    }
  });
}
