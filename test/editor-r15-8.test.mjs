// regression tests of R15.8 on both platforms: a text is reported as lying over a figure by the
// lines of its text inside its box. the rects of a line are the content area of its font, which is
// taller than the box of a heading with a tight line height, hence a figure that ends at the edge
// of the box of a heading was reported

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';

const DECK = 'index.html';
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
const status = (page) => page.evaluate('window.BeesonEditor.status()');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

// the closing slide of the deck, with a second QR code that is selected
async function closing(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(readFileSync(DECK, 'utf8'))})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide([...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.matches('.closing')))`);
  await frames(page);
  await exec(page, 'insert.qr');
  await frames(page);
  return page;
}

// the boxes in slide px of the heading, of its one line of text, and of the new QR code
const boxes = (page) => page.evaluate(`(() => {
  const slide = document.querySelector('.reveal .slides > section.present');
  const s = slide.getBoundingClientRect();
  const k = s.width / slide.offsetWidth;
  const px = (r) => ({ left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k });
  const h1 = slide.querySelector('h1');
  const range = document.createRange();
  range.selectNodeContents(h1);
  const codes = slide.querySelectorAll('.qr');
  return { h1: px(h1.getBoundingClientRect()), line: px(range.getClientRects()[0]), qr: px(codes[codes.length - 1].getBoundingClientRect()), marked: h1.classList.contains('beeson-overflow') };
})()`);

// puts the new QR code over the first word of the heading, with its lower edge dy px under the
// upper edge of the box of the heading
async function put(page, dy) {
  const b = await boxes(page);
  await exec(page, 'arrange.setPosition', { x: Math.round(b.h1.left + 40), y: Math.round(b.h1.top - (b.qr.bottom - b.qr.top) + dy) });
  await frames(page);
  return boxes(page);
}

for (const platform of PLATFORMS) {
  // state 109 of round 6: a QR code snapped to the upper edge of the heading "Thank you" was
  // reported as "1 text lies over a figure", since the rect of the line starts 18 px over the box
  test(`a QR code that ends at the upper edge of a heading is not reported as under its text (${platform})`, async (t) => {
    const page = await closing(t, platform);
    const b = await put(page, 0);
    assert.ok(Math.abs(b.qr.bottom - b.h1.top) < 1, `the QR code does not end at the heading: ${js(b)}`);
    assert.ok(b.qr.right > b.line.left + 2 && b.qr.left < b.line.right - 2, `the QR code is not over the text of the heading: ${js(b)}`);
    // the content area of the font is taller than the box of the heading
    assert.ok(b.line.top < b.h1.top - 2, `the line of the heading is inside its box: ${js(b)}`);
    const s = await status(page);
    assert.equal(s.overflow, 0, `the heading is reported: ${js(s.message)}`);
    assert.equal(b.marked, false, 'the heading is outlined');
    assert.deepEqual(errors(page), []);
  });

  test(`a QR code that reaches 10 px into the box of a heading is reported (${platform})`, async (t) => {
    const page = await closing(t, platform);
    const b = await put(page, 10);
    assert.ok(Math.abs(b.qr.bottom - b.h1.top - 10) < 1, `the QR code does not reach into the heading: ${js(b)}`);
    const s = await status(page);
    assert.equal(s.overflow, 1, `the heading is not reported: ${js(s.message)}`);
    assert.equal(b.marked, true, 'the heading is not outlined');
    assert.deepEqual(errors(page), []);
  });
}
