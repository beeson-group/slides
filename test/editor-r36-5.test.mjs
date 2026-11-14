// regression tests of R36.5 on both platforms with trusted input. finding 84 of the judge qwen3 in
// round 10: a typed Height of a figure with a caption was read at a collapsed width, e.g. 110 by
// 752 for the figure of 600 by 875 of slide 5, where the caption is wrapped to many lines and is
// higher than the picture. a typed Height scales the figure, hence a smaller Height gives a
// narrower figure at about the same ratio, and the field reads the typed value within 1 px

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
// the deck, the index of the slide, and the heights typed, as differences from the Height at the start
const FIGURES = [
  ['the figure of slide 5 of index.html', 'test-deck.html', 4, [-175, -143, -139, -131, -129, -123, -119, -60, 76]],
  ['a figure with a caption and a written width', 'test/pages/editor-r36-2.html', 0, [-200, -160, -123, -119, -80, -40, 40]],
];

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
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

async function load(t, platform, deck, slide) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${deck}?edit&still&theme=light&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${slide})`);
  await frames(page);
  await page.waitFor(`[...document.querySelectorAll('.reveal section.present img')].every((i) => i.complete && i.naturalWidth)`);
  return page;
}

async function fieldValue(page, id) {
  await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].find((b) => b.textContent === 'Arrange')?.click()`);
  await frames(page);
  return Number(await page.evaluate(`document.querySelector('#beeson-edit-num-${id}')?.value`));
}
async function typeField(page, id, value) {
  await fieldValue(page, id);
  await page.evaluate(`(() => { const i = document.querySelector('#beeson-edit-num-${id}'); i.focus(); i.select(); })()`);
  await type(page, String(value));
  await press(page, 'Enter');
  await frames(page);
}
// the heights of the picture as drawn and of the caption of the figure shown, in slide px
const parts = (page) => page.evaluate(`(() => {
  const fig = document.querySelector('.reveal section.present figure');
  const img = [...fig.querySelectorAll('img')].find((i) => i.offsetWidth);
  const f = Math.min(img.offsetWidth / img.naturalWidth, img.offsetHeight / img.naturalHeight);
  return { picture: img.naturalHeight * f, caption: fig.querySelector('figcaption').offsetHeight };
})()`);

for (const platform of PLATFORMS) {
  for (const [kind, deck, slide, steps] of FIGURES) {
    test(`a typed Height scales ${kind} and is not read at a collapsed width (${platform})`, async (t) => {
      const page = await load(t, platform, deck, slide);
      await click(page, '.reveal section.present figure img');
      const start = { w: await fieldValue(page, 'width'), h: await fieldValue(page, 'height') };
      const wrong = [];
      const read = [];
      for (const d of steps) {
        const h = start.h + d;
        await typeField(page, 'height', h);
        const now = { w: await fieldValue(page, 'width'), h: await fieldValue(page, 'height') };
        const p = await parts(page);
        read.push(`${h}: ${now.w} by ${now.h}`);
        if (Math.abs(now.h - h) > 1) wrong.push(`a typed Height of ${h} reads ${now.h}`);
        if (p.caption > p.picture) wrong.push(`a typed Height of ${h} gives ${now.w} by ${now.h}, with a caption of ${p.caption} px on a picture of ${Math.round(p.picture)} px`);
        // a smaller figure is a narrower one, and a larger one a wider one
        if (d < 0 ? now.w >= start.w : now.w <= start.w) wrong.push(`a typed Height of ${h} gives a Width of ${now.w}, from ${start.w} by ${start.h}`);
        await undo(page);
        await byteExact(page);
      }
      assert.deepEqual(wrong, [], `the sizes read: ${read.join(', ')}`);
      assert.deepEqual(errors(page), []);
    });
  }
}
