// regression tests of R41.2 on both platforms: a QR code whose translate is not written in px, e.g.
// with a bare 0 or as a percentage of its box, keeps its drawn place and size at a change of layout
// away from Closing, with an undo and a redo byte for byte

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';

const DECK = 'test/pages/editor-r41-2.html';
const PLATFORMS = ['mac', 'other'];
const TRANSLATES = ['0 -300px', '10% 5%', '-40px 0'];

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
const exec = async (page, id) => {
  await page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)})).then(() => true)`);
  await settle(page);
};
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const near = (a, b, by = 1) => Math.abs(a - b) <= by;

// the deck of three closing slides, with the slide of the translate shown
async function load(t, platform, translate) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  const source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${TRANSLATES.indexOf(translate)})`);
  await settle(page);
  return page;
}

// the QR code of the current slide: the center of its drawn box in slide px, its width, and its style
const code = (page) => page.evaluate(`(() => {
  const slide = document.querySelector('.reveal .slides > section.present');
  const s = slide.getBoundingClientRect(), k = s.width / slide.offsetWidth;
  const q = slide.querySelector('.qr'), r = q.getBoundingClientRect();
  return { x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k, width: q.offsetWidth, style: q.getAttribute('style') };
})()`);

for (const platform of PLATFORMS) {
  for (const translate of TRANSLATES) {
    for (const layout of ['title', 'section']) {
      test(`Closing to ${layout} keeps the drawn place of a QR code with the translate ${translate} (${platform})`, async (t) => {
        const page = await load(t, platform, translate);
        const before = await render(page);
        const was = await code(page);
        assert.equal(was.style, `translate: ${translate}`);
        await exec(page, `slide.layout.${layout}`);
        const after = await render(page);
        const now = await code(page);
        assert.ok(near(now.x, was.x) && near(now.y, was.y), `the QR code is moved by the change of layout: ${js({ was, now })}`);
        assert.equal(now.width, was.width, `the QR code is resized by the change of layout: ${js({ was, now })}`);
        await page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
        await settle(page);
        assert.equal(await render(page), before, 'the undo does not give the text before the change byte for byte');
        assert.deepEqual(await code(page), was);
        await page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
        await settle(page);
        assert.equal(await render(page), after, 'the redo does not give the text after the change byte for byte');
        assert.deepEqual(await code(page), now);
        assert.deepEqual(errors(page), []);
      });
    }
  }
}
