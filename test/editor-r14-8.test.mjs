// a new element on a figure slide, on both platforms. the plate of a figure slide is in the flow and
// as large as the slide, hence a new element is written after it, and what is drawn in the plate
// stays where the theme puts it. a new table does not have a free place there. it is put off the
// heading and the caption with the room of its bars, off a paper image, on less than a twentieth
// of a video or a plot, and with its bars inside the slide

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press } from './helpers/editor.mjs';

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
// the share of the area of b that a covers
const covers = (a, b) => (Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))) / ((b.right - b.left) * (b.bottom - b.top));
const round = (boxes) => boxes.map((b) => [b.left, b.top, b.right, b.bottom].map(Math.round));
const grown = (b, d) => ({ left: b.left - d, top: b.top - d, right: b.right + d, bottom: b.bottom + d });

async function load(t, platform, n, deck = DECK) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
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

for (const platform of PLATFORMS) {
  for (const [id, name] of [['insert.text', 'text'], ['insert.formula', 'formula'], ['insert.qr', 'QR code']]) {
    test(`a new ${name} on a figure slide with a paper image does not move the image (${platform})`, async (t) => {
      const page = await load(t, platform, 6);
      const before = await render(page);
      const { boxes: media } = await measure(page, '.plate > img', ':scope > h2');
      assert.equal(media.length, 1);
      await exec(page, id);
      await frames(page);
      // an empty text box is written into the file only once it has text
      if (id !== 'insert.text') assert.notEqual(await render(page), before, 'nothing was inserted');
      const { boxes: after } = await measure(page, '.plate > img', ':scope > h2');
      assert.deepEqual(round(after), round(media), `the insert of a ${name} moved the image of the plate`);
      await undo(page);
      assert.equal(await render(page), before);
      assert.deepEqual(errors(page), []);
    });
  }

  // an element written after the plate is under it in the flow, hence its offset would carry it above
  // the slide once the plate is deleted or cut
  const removals = [['deleted', 'element.delete'], ['cut', 'edit.cut']];
  const inserts = [['insert.table', 'table', ':scope > table', { rows: 3, columns: 3 }], ['insert.qr', 'QR code', ':scope > .qr', undefined]];
  for (const [verb, command, id, name, selector, arg] of removals.flatMap((r) => inserts.map((i) => [...r, ...i]))) {
    test(`a new ${name} on a figure slide stays in its place when the plate is ${verb} (${platform})`, async (t) => {
      const page = await load(t, platform, 6);
      await exec(page, id, arg);
      await frames(page);
      await press(page, 'Escape');
      await press(page, 'Escape');
      await frames(page);
      const edited = await render(page);
      const { boxes: placed } = await measure(page, selector, ':scope > h2');
      assert.equal(placed.length, 1, `no ${name} was inserted`);
      // a point of the image that is not under the new element, the heading, or the caption
      const at = await page.evaluate(`(() => {
        const r = document.querySelector('.reveal section.present .plate img').getBoundingClientRect();
        for (let fy = 0.9; fy > 0.1; fy -= 0.05) for (let fx = 0.1; fx < 0.9; fx += 0.05) {
          const x = r.left + r.width * fx, y = r.top + r.height * fy;
          const hit = document.elementsFromPoint(x, y);
          if (hit.find((e) => e.tagName === 'IMG') && !hit.find((e) => e.closest('table, .qr, h2, .caption'))) return { x, y };
        }
        return null;
      })()`);
      assert.ok(at, 'the image does not have a point clear of the other elements');
      await click(page, at);
      await frames(page);
      await exec(page, command);
      await frames(page);
      assert.equal(await page.evaluate(`document.querySelectorAll('.reveal section.present .plate').length`), 0, `the plate was not ${verb}`);
      const { boxes: left } = await measure(page, selector, ':scope > h2');
      assert.deepEqual(round(left), round(placed), `the ${name} moved when the plate was ${verb}`);
      // the removal is one entry of the history, taken back and made again byte for byte
      const deleted = await render(page);
      await undo(page);
      assert.equal(await render(page), edited);
      const { boxes: back } = await measure(page, selector, ':scope > h2');
      assert.deepEqual(round(back), round(placed));
      await redo(page);
      assert.equal(await render(page), deleted);
      assert.deepEqual(errors(page), []);
    });
  }

  // on a content slide, the plate of the figure slide is the zone at the right, and its delete
  // does not move the elements beside it
  test(`a deleted plate does not write an offset on the element beside it once the slide is a content slide (${platform})`, async (t) => {
    const page = await load(t, platform, 6);
    await exec(page, 'insert.qr');
    await frames(page);
    await press(page, 'Escape');
    await frames(page);
    await exec(page, 'slide.layout.content');
    await frames(page);
    const offset = (text) => /<div class="qr"[^>]*translate: ([^;"]*)/.exec(text)?.[1];
    const written = offset(await render(page));
    assert.ok(written, 'the QR code does not have an offset');
    await click(page, '.reveal section.present .zone img');
    await frames(page);
    await exec(page, 'element.delete');
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal section.present .zone').length`), 0, 'the plate was not deleted');
    assert.equal(offset(await render(page)), written, 'the delete of the plate changed the offset of the QR code');
    assert.deepEqual(errors(page), []);
  });

  // the plate of a plot is as large as the slide, and a new element may lie over it, but not over
  // another new element while a place off it exists
  test(`a second QR code on a figure slide with a plot is put off the first (${platform})`, async (t) => {
    const page = await load(t, platform, 8);
    for (let i = 0; i < 2; i++) {
      await exec(page, 'insert.qr');
      await frames(page);
      await press(page, 'Escape');
      await frames(page);
    }
    const { boxes } = await measure(page, ':scope > .qr', ':scope > h2');
    assert.equal(boxes.length, 2, 'two QR codes were not inserted');
    assert.ok(!meets(boxes[0], boxes[1]), `the QR codes at ${js(boxes[0])} and ${js(boxes[1])} lie over each other`);
    assert.deepEqual(errors(page), []);
  });

  // the first table of a new figure slide fills its plate, and a second table keeps the room of its
  // bars to it, as to a text
  test(`a second table on a new figure slide is put off the first with the room of its bars (${platform})`, async (t) => {
    const page = await load(t, platform, 3, 'index.html');
    await exec(page, 'slide.new');
    await exec(page, 'slide.layout.figure');
    await frames(page);
    for (let i = 0; i < 2; i++) {
      await exec(page, 'insert.table', { rows: 3, columns: 3 });
      await frames(page);
      await press(page, 'Escape');
      await press(page, 'Escape');
      await frames(page);
    }
    const { k, boxes } = await measure(page, 'table', ':scope > h2');
    assert.equal(boxes.length, 2, 'two tables were not inserted');
    const [first, second] = boxes[0].top <= boxes[1].top ? boxes : [boxes[1], boxes[0]];
    assert.ok(!meets(grown(second, BARS / k), first), `the bars of the table at ${js(second)} lie over the table at ${js(first)}`);
    assert.deepEqual(errors(page), []);
  });

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
      // what is drawn in the plate is where it was before the insert
      const { boxes: after } = await measure(page, drawn, ':scope > h2');
      assert.deepEqual(round(after), round(media), 'the insert of a table moved what is drawn in the plate');
      for (const m of media) {
        if (what === 'a paper image') assert.ok(!meets(table, m), `the table at ${js(table)} lies over the image at ${js(m)}`);
        else assert.ok(covers(table, m) < 0.05, `the table at ${js(table)} covers more than a twentieth of what is drawn in the plate at ${js(m)}`);
      }
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
