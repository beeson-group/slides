// regression tests of R18.3 on both platforms: a new plot is put at the same place in slide px at
// every zoom, off the heading of the panel of a split slide (C11), and off the heading of the wide
// layout, where the center of the slide lies over it (C12). the drawn cells of a backdrop are read
// from a copy of the canvas of a fixed size in slide px, whatever the zoom (C13)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
// the margin of the layouts at the left and the right of a slide, in slide px
const MARGIN = 120;

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
const settle = async (page) => {
  await frames(page);
  await frames(page);
};
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

// the editor on deck in a window of width by height px, with the first slide that matches the
// selector or the index n shown
async function load(t, platform, deck, n, width = 1600, height = 1000) {
  const page = await browser.newPage({ width, height });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  const at = typeof n === 'number' ? n : await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.matches(${js(n)}))`);
  assert.ok(at >= 0, `${deck} does not have a slide ${n}`);
  await page.evaluate(`Reveal.slide(${at})`);
  await settle(page);
  return page;
}

const insertTable = async (page) => {
  await exec(page, 'insert.table', { rows: 3, columns: 3 });
  await settle(page);
};
const insertPlot = async (page) => {
  await exec(page, 'insert.plot');
  await exec(page, 'plot.closeData');
  await settle(page);
  await settle(page);
};

// the boxes in slide px of the tables, the plots, and the figures of the current slide, and of
// each line of the words of its texts outside a table and a plot, by the rects of their text nodes
const pieces = (page) => page.evaluate(`(() => {
  const slide = document.querySelector('.reveal .slides > section.present');
  const s = slide.getBoundingClientRect();
  const k = s.width / slide.offsetWidth;
  const px = (r) => ({ left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k });
  const shown = (e) => e.getClientRects().length && !e.closest('aside.notes, .backdrop');
  const of = (sel) => [...slide.querySelectorAll(sel)].filter(shown).map((e) => px(e.getBoundingClientRect()));
  const words = [];
  const walk = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const el = n.parentElement;
    if (!n.textContent.trim() || !shown(el) || el.closest('table, .plot, aside, script, style, mjx-assistive-mml, .beeson-pending')) continue;
    const owner = el.closest('h1, h2, p, li, figcaption, .caption, .run, .foot') ?? el;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.width > 1 && r.height > 1) words.push({ ...px(r), name: owner.localName + ':' + owner.textContent.trim().slice(0, 16) });
  }
  return { tables: of('table'), plots: of('.plot'), figures: of('img, video, .qr, figure, .zone'), words };
})()`);
const meets = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const round = (b) => [b.left, b.top, b.right - b.left, b.bottom - b.top].map(Math.round);
const inside = (b) => b.left >= MARGIN - 1 && b.right <= 1920 - MARGIN + 1 && b.top >= -1 && b.bottom <= 1081;
const wordsUnder = (box, words) => words.filter((l) => meets(box, l)).map((l) => `${l.name} ${Math.round(area(box, l))} px2`);

// the edit gives back the file byte for byte after one undo
async function undone(page, before) {
  assert.notEqual(await render(page), before);
  await undo(page);
  assert.equal(await render(page), before);
}

// the drawn pixels of the backdrop of the current slide under box, sampled every 4 slide px
const drawnUnder = (page, box) => page.evaluate(`(() => {
  const slide = document.querySelector('.reveal .slides > section.present');
  const s = slide.getBoundingClientRect(), k = s.width / slide.offsetWidth;
  const b = ${js(box)};
  let n = 0, all = 0;
  for (const c of slide.querySelectorAll('.backdrop canvas')) {
    const cr = c.getBoundingClientRect();
    if (!cr.width || !c.width) continue;
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const sx = c.width / cr.width, sy = c.height / cr.height;
    for (let y = 0; y < 1080; y += 4) for (let x = 0; x < 1920; x += 4) {
      const px = Math.floor((s.left + x * k - cr.left) * sx), py = Math.floor((s.top + y * k - cr.top) * sy);
      if (px < 0 || py < 0 || px >= c.width || py >= c.height || data[(py * c.width + px) * 4 + 3] <= 20) continue;
      all += 1;
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) n += 1;
    }
  }
  return { n, all };
})()`);

// the place of the new plot of the current slide in slide px, with its translate
const plotted = async (page) => {
  const { plots, words } = await pieces(page);
  assert.equal(plots.length, 1, 'no plot was inserted');
  const translate = await page.evaluate(`document.querySelector('.reveal .slides > section.present .plot').style.translate`);
  return { plot: plots[0], words, translate };
};
const zoom = async (page, z) => {
  await page.evaluate(`window.BeesonEditorShell.stage.setZoom(${js(z)})`);
  await settle(page);
};

for (const platform of PLATFORMS) {
  // C11: at 50, 150, and 200 percent the plot was put at 120, 191 over the heading of the panel,
  // with the translate -760px 71px, and at Fit at 120, 256
  test(`a new plot on the split slide is put at the same place off the heading at every zoom (${platform})`, async (t) => {
    const at = {};
    for (const z of [null, 0.5, 1.5, 2]) {
      const page = await load(t, platform, LAYOUTS, '.split');
      await zoom(page, z);
      await insertPlot(page);
      const { plot, words, translate } = await plotted(page);
      const where = `the plot at ${js(round(plot))} at the zoom ${z ?? 'Fit'}`;
      assert.ok(inside(plot), `${where} is not inside the margins`);
      assert.deepEqual(wordsUnder(plot, words.filter((l) => l.name.startsWith('h2:'))), [], `${where} lies over the heading`);
      at[z ?? 'Fit'] = `${js(round(plot))} ${translate}`;
      assert.deepEqual(errors(page), []);
      await page.close();
    }
    assert.deepEqual(new Set(Object.values(at)).size, 1, `the plot is put at ${js(at)}`);
  });

  // C12: the plot was put at the center of the slide, 660, 140, over the heading
  test(`a new plot on the wide layout lies off the heading and the table, inside the margins (${platform})`, async (t) => {
    const page = await load(t, platform, LAYOUTS, 'section.wide');
    const before = await render(page);
    const start = await pieces(page);
    await insertPlot(page);
    const { plot, words } = await plotted(page);
    const where = `the plot at ${js(round(plot))}`;
    assert.ok(inside(plot), `${where} is not inside the margins`);
    assert.deepEqual(wordsUnder(plot, words.filter((l) => l.name.startsWith('h2:'))), [], `${where} lies over the heading`);
    for (const b of [...start.tables, ...start.figures]) assert.ok(!meets(plot, b), `${where} lies over ${js(round(b))}`);
    await undone(page, before);
    assert.deepEqual(errors(page), []);
  });

  // C13: every canvas of the backdrop was read at its full size, 3840 by 2160 px at 200 percent
  test(`a new table on the figure slide with a backdrop at 200 percent reads a small copy of the canvases, and lies off the drawn orbit (${platform})`, async (t) => {
    const page = await load(t, platform, LAYOUTS, 9);
    await zoom(page, 2);
    await page.evaluate(`(() => {
      const read = CanvasRenderingContext2D.prototype.getImageData;
      window.__reads = [];
      CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h, ...rest) {
        window.__reads.push(w * h);
        return read.call(this, x, y, w, h, ...rest);
      };
    })()`);
    await insertTable(page);
    const reads = await page.evaluate('window.__reads');
    assert.ok(reads.length > 0, 'the canvases of the backdrop were not read');
    assert.ok(Math.max(...reads) <= 960 * 540, `the largest read is ${Math.max(...reads)} px`);
    await zoom(page, null);
    const { tables, words } = await pieces(page);
    assert.equal(tables.length, 1, 'no table was inserted');
    const where = `the table at ${js(round(tables[0]))}`;
    assert.deepEqual(wordsUnder(tables[0], words), [], `${where} lies over words`);
    const d = await drawnUnder(page, tables[0]);
    assert.ok(d.all > 1000, `the backdrop is not drawn: ${js(d)}`);
    assert.equal(d.n, 0, `${where} lies over ${d.n} of ${d.all} sampled drawn pixels of the orbit`);
    assert.deepEqual(errors(page), []);
  });
}
