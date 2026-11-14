// regression tests of R17.1 on both platforms: a new table is put off the drawn orbit of the
// backdrop of a figure slide (requirement 3d, N11), at the same place in slide px in every size of
// the window (N10), and on a title or closing slide without moving the words of its block (N9)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';

const DECK = 'test-deck.html';
const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
// slide 5 of the demo deck, with a heading, a paragraph, a list of three items, and a figure
const FIGURES = 4;
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

// the boxes in slide px of the tables and the figures of the current slide, and of each line of the
// words of its texts outside a table and a plot, by the rects of their text nodes
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
  return { tables: of('table'), figures: of('img, video, .qr, figure, .figure-box'), words };
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

for (const platform of PLATFORMS) {
  // requirement 3d and N11: the table was put at 120, 231 over 1.2 percent of the drawn orbit
  test(`a new table on the figure slide with a backdrop lies off the drawn orbit and the words (${platform})`, async (t) => {
    const page = await load(t, platform, LAYOUTS, 9);
    assert.ok(await page.evaluate(`!!document.querySelector('.reveal section.present.figure > .backdrop canvas')`), 'slide 10 is not the figure slide with a backdrop');
    const before = await render(page);
    await insertTable(page);
    const { tables, words } = await pieces(page);
    assert.equal(tables.length, 1, 'no table was inserted');
    const where = `the table at ${js(round(tables[0]))}`;
    assert.ok(inside(tables[0]), `${where} is not inside the margins`);
    assert.deepEqual(wordsUnder(tables[0], words), [], `${where} lies over words`);
    const d = await drawnUnder(page, tables[0]);
    assert.ok(d.all > 1000, `the backdrop is not drawn: ${js(d)}`);
    assert.equal(d.n, 0, `${where} lies over ${d.n} of ${d.all} sampled drawn pixels of the orbit`);
    await undone(page, before);
    assert.deepEqual(errors(page), []);
  });
}

// the boxes of two tables inserted on slide 5 in a window of width by height px
async function two(t, platform, width, height) {
  const page = await load(t, platform, DECK, FIGURES, width, height);
  await insertTable(page);
  await insertTable(page);
  const p = await pieces(page);
  const boxes = [p.tables[0], p.tables[1]].map(round);
  assert.deepEqual(errors(page), []);
  await page.close();
  return { boxes, ...p };
}

for (const platform of PLATFORMS) {
  // N10: the first table was at x 620, 640, or 665 at the three sizes, and the last table at
  // 1920 by 1080 over the words of the heading
  test(`two tables on slide 5 are put at the same places in slide px at three sizes of the window (${platform})`, async (t) => {
    const runs = [];
    for (const [w, h] of [[1280, 800], [1600, 1000], [1920, 1080]]) runs.push({ size: `${w}x${h}`, ...(await two(t, platform, w, h)) });
    for (const r of runs.slice(1)) {
      r.boxes.forEach((b, i) => b.forEach((v, j) => assert.ok(Math.abs(v - runs[0].boxes[i][j]) <= 1, `at ${r.size} the boxes are ${js(r.boxes)}, at ${runs[0].size} ${js(runs[0].boxes)}`)));
    }
    for (const r of runs) {
      const second = r.tables[1];
      assert.deepEqual(wordsUnder(second, r.words.filter((l) => l.name.startsWith('h2:'))), [], `at ${r.size} the second table at ${js(round(second))} lies over the heading`);
      assert.ok(inside(second), `at ${r.size} the second table at ${js(round(second))} is not inside the margins`);
    }
  });
}

for (const platform of PLATFORMS) {
  for (const [deck, selector] of [[DECK, '.title'], [DECK, '.closing']]) {
    // N9: the first table moved the heading of the title slide from y 399 to y 162, and a second
    // one to y -75, cut at the top of the slide
    test(`two new tables on a ${selector.slice(1)} slide leave the words of its block at their place (${platform})`, async (t) => {
      const page = await load(t, platform, deck, selector);
      const before = await render(page);
      const start = (await pieces(page)).words;
      for (let i = 0; i < 2; i++) {
        await insertTable(page);
        const { tables, words } = await pieces(page);
        assert.equal(tables.length, i + 1, 'no table was inserted');
        assert.deepEqual(words.map(round), start.map(round), `after table ${i + 1} the words moved from ${js(start.map((l) => [l.name, ...round(l)]))} to ${js(words.map((l) => [l.name, ...round(l)]))}`);
        const table = tables[i];
        assert.ok(inside(table), `table ${i + 1} at ${js(round(table))} is not inside the margins`);
        assert.deepEqual(wordsUnder(table, words), [], `table ${i + 1} at ${js(round(table))} lies over words`);
        for (const o of tables.slice(0, i)) assert.ok(!meets(table, o), `table ${i + 1} at ${js(round(table))} lies over a table at ${js(round(o))}`);
      }
      await undo(page);
      await undone(page, before);
      assert.deepEqual(errors(page), []);
    });
  }
}
