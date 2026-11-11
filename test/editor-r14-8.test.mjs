// the place of a new table on a figure slide, on both platforms: the plate of a figure slide is as
// large as the slide, hence the table does not have a free place there. it is put off the heading
// and the caption with the room of its bars, off what is drawn in the plate, and with its bars
// inside the slide

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';

const DECK = 'test/pages/editor-layouts.html';
// the figure slides of editor-layouts.html, with what is drawn in the plate of each
const SLIDES = [
  [6, 'a paper image', '.plate > img'],
  [7, 'a video', '.plate > video'],
  [8, 'a plot', '.plate svg'],
  [9, 'a backdrop', null],
];
const PLATFORMS = ['mac', 'other'];
// the gap and the height in screen px of the bars of a selected table, and the room in slide px
// that a new table keeps to a text, which is the room of the bars at the zoom of the canvas
const BARS = 24;

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

// the zoom of the canvas, the boxes in slide px of the shown elements of selector on the current
// slide, and the boxes of the lines of the text of the elements of texts
const measure = (page, selector, texts) => page.evaluate(`(() => {
  const slide = document.querySelector('.reveal .slides > section.present');
  const s = slide.getBoundingClientRect();
  const k = s.width / slide.offsetWidth;
  const box = (r) => ({ left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k });
  const boxes = ${js(selector)} ? [...slide.querySelectorAll(${js(selector)})].filter((e) => e.getClientRects().length).map((e) => box(e.getBoundingClientRect())) : [];
  const lines = [];
  for (const el of slide.querySelectorAll(${js(texts)})) {
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 1) lines.push(box(r));
    }
  }
  return { k, boxes, lines };
})()`);
const meets = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
const grown = (b, d) => ({ left: b.left - d, top: b.top - d, right: b.right + d, bottom: b.bottom + d });

async function load(t, platform, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
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

for (const platform of PLATFORMS) {
  for (const [n, what, drawn] of SLIDES) {
    test(`a new table on a figure slide with ${what} is put off the heading and the caption with the room of its bars (${platform})`, async (t) => {
      const page = await load(t, platform, n);
      const before = await render(page);
      const { boxes: media } = await measure(page, drawn, ':scope > h2');
      await exec(page, 'insert.table', { rows: 3, columns: 3 });
      await frames(page);
      const { k, boxes: [table], lines } = await measure(page, ':scope > table', ':scope > h2, :scope > .caption');
      assert.ok(table, 'no table was inserted');
      assert.ok(lines.length >= 2, 'the lines of the heading and of the caption were not measured');
      const room = BARS / k;
      const bars = grown(table, room);
      assert.ok(bars.left >= -1 && bars.top >= -1 && table.right <= 1921 && table.bottom <= 1081, `the table at ${js(table)} does not have its bars inside the slide`);
      for (const l of lines) assert.ok(!meets(bars, l), `the table at ${js(table)} with the room of its bars lies over a line of text at ${js(l)}`);
      for (const m of media) assert.ok(!meets(table, m), `the table at ${js(table)} lies over what is drawn in the plate at ${js(m)}`);
      // the insert is one entry of the history, taken back and made again byte for byte
      const edited = await render(page);
      assert.notEqual(edited, before);
      await undo(page);
      assert.equal(await render(page), before);
      await redo(page);
      assert.equal(await render(page), edited);
      assert.deepEqual(errors(page), []);
    });
  }
}
