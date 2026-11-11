// regression tests of R9.2 on both platforms with trusted input. a thumbnail of the navigator shows
// its slide at the load of the deck, after a click on it, after the arrow keys, after an edit of its
// slide, and after an undo, and it is never drawn with raw TeX. after each edit the text is checked
// byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen, type } from './helpers/editor.mjs';

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
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let saves = 0;

// every drawing of a thumbnail of the navigator with a shown formula in raw TeX, kept in
// window.rawThumbs from before the open of the deck on
const WATCH = `(() => {
  window.rawThumbs = [];
  const check = () => {
    document.querySelectorAll('.beeson-edit-nav .row .pic').forEach((h, i) => {
      const wrap = h.shadowRoot?.querySelector('.beeson-thumb');
      if (!wrap || wrap.dataset.checked) return;
      wrap.dataset.checked = '1';
      const walker = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        const up = t.parentElement;
        if (up.closest('pre, code, mjx-container') || getComputedStyle(up).visibility === 'hidden') continue;
        const m = /\\\\[(\\[].{0,16}/.exec(t.data);
        if (m) window.rawThumbs.push({ slide: i + 1, text: m[0] });
      }
    });
    requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
  return true;
})()`;

// the editor on the slide n of the demo deck served over HTTP, in a window of 1600 by 1000 px as in
// the shoot of the council, with the thumbnails watched for raw TeX from before the open. the deck
// is opened at once after the editor is ready, as the shoot opens it
async function load(t, platform, { n = 0, mode = 'light', width = 1600, height = 1000 } = {}) {
  const page = await browser.newPage({ width, height });
  t.after(() => page.close().catch(() => {}));
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }] });
  const url = `${server.origin}/index.html?edit&still&theme=${mode}&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  await page.evaluate(WATCH);
  page.source = readFileSync('index.html', 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks the text before byte for byte after undos undos, the edit after as many redos,
// and an open of the saved edit without problems, which is the text before the next check
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r9-2-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

// the thumbnails of the navigator in view, each with the heading of its slide and the heading
// drawn in its picture, which is null for a blank thumbnail
const PICTURES = `(() => {
  const list = document.querySelector('.beeson-edit-nav .rows') ?? document.querySelector('.beeson-edit-nav');
  const box = list.getBoundingClientRect();
  const slides = [...document.querySelectorAll('.reveal:not(.beeson-peek) .slides > section')];
  return [...document.querySelectorAll('.beeson-edit-nav .row .pic')].map((h, i) => {
    const r = h.getBoundingClientRect();
    const shown = r.width > 0 && r.bottom > box.top && r.top < box.bottom;
    const head = (s) => s?.querySelector('h1, h2')?.textContent.replace(/\\s+/g, ' ').trim() ?? '';
    const section = h.shadowRoot?.querySelector('.beeson-thumb .slides > section');
    return { slide: i + 1, shown, heading: head(slides[i]), drawn: section ? head(section) : null };
  }).filter((p) => p.shown);
})()`;

// allDrawn asserts that every thumbnail in view shows its slide, in the state named by what
async function allDrawn(page, what) {
  const pics = await page.evaluate(PICTURES);
  assert.ok(pics.length >= 3, `only ${pics.length} thumbnails are in view ${what}`);
  for (const p of pics) assert.equal(p.drawn, p.heading, `the thumbnail of slide ${p.slide} is drawn ${p.drawn === null ? 'blank' : `with the heading "${p.drawn}"`} ${what}`);
}

// the center of the thumbnail of slide n, counted from 1
const thumb = (page, n) =>
  page.evaluate(`(() => { const r = document.querySelectorAll('.beeson-edit-nav .row .pic')[${n - 1}].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

const noRawTex = async (page) => assert.deepEqual(await page.evaluate('window.rawThumbs'), [], 'a thumbnail is drawn with raw TeX');

// finding 1: the thumbnail of the selected slide was drawn blank, with only its row of step
// circles, while the formulas of the deck were not typeset yet, since a thumbnail without a picture
// waited for them
for (const platform of PLATFORMS) {
  test(`every thumbnail in view shows its slide at the load of the deck and after a click on it (${platform})`, async (t) => {
    const page = await load(t, platform);
    await allDrawn(page, 'at the load of the deck');
    // slide 3 has formulas in the labels of its backdrop, and slide 2 does not have a formula
    for (const n of [3, 2, 4]) {
      await click(page, await thumb(page, n));
      await frames(page);
      assert.equal(await page.evaluate('Reveal.getIndices().h'), n - 1);
      await allDrawn(page, `after a click on the thumbnail of slide ${n}`);
    }
    await sleep(800);
    await allDrawn(page, 'after the clicks settle');
    await noRawTex(page);
    assert.deepEqual(errors(page), []);
  });

  test(`every thumbnail in view shows its slide after the arrow keys in the navigator (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await thumb(page, 1));
    for (const [key, n] of [['ArrowDown', 2], ['ArrowDown', 3], ['ArrowDown', 4], ['ArrowUp', 3]]) {
      await press(page, key);
      await frames(page);
      assert.equal(await page.evaluate('Reveal.getIndices().h'), n - 1, `${key} does not show slide ${n}`);
      await allDrawn(page, `after ${key} to slide ${n}`);
    }
    await sleep(800);
    await allDrawn(page, 'after the arrow keys settle');
    await noRawTex(page);
    assert.deepEqual(errors(page), []);
  });

  test(`the thumbnail of a slide with formulas shows the slide after an edit and an undo, never with raw TeX (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 3 });
    // the paragraph of slide 4 with the formula \(\tilde U\), whose TeX is shown while it is edited
    const para = '.reveal section.present p.fragment[data-fragment-index="2"]';
    await click(page, para);
    await press(page, 'End');
    await type(page, ' Edited');
    await sleep(900);
    await allDrawn(page, 'while a paragraph with a formula is edited');
    await press(page, 'Escape');
    await sleep(900);
    await allDrawn(page, 'after the edit');
    const drawnText = () => page.evaluate(`document.querySelectorAll('.beeson-edit-nav .row .pic')[3].shadowRoot.querySelector('.beeson-thumb').textContent`);
    assert.match(await drawnText(), /Edited/, 'the thumbnail of slide 4 does not show the edit');
    await press(page, 'Mod+Z');
    await frames(page);
    await allDrawn(page, 'right after the undo');
    await sleep(900);
    await allDrawn(page, 'after the undo');
    assert.doesNotMatch(await drawnText(), /Edited/, 'the thumbnail of slide 4 still shows the edit after the undo');
    await noRawTex(page);
    await press(page, 'Mod+Shift+Z');
    await roundTrip(page);
    await noRawTex(page);
  });
}
