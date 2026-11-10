// regression tests of R8.4 on both platforms with trusted input, from the laptop tests on Windows
// and Linux and the juror of round 3. a poster is captured at the time of the slider after a slow
// seek. after each edit the text is checked byte for byte, after an undo and a redo, and after a
// save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
// the slide "Embedding videos" of the demo deck
const VIDEOS = 10;

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
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let saves = 0;

// the editor on the slide n of a deck served over HTTP, in a window of size, with the Format tab
// shown unless format is false
async function load(t, platform, { deck = 'index.html', n = 0, size = { width: 1440, height: 900 }, format = true } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (format && !(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${n})`);
  await sleep(150);
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
  const { text } = await saveAndReopen(page, `r8-4-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

const boxOf = (page, selector) => page.evaluate(`(() => {
  const el = [...document.querySelectorAll(${js(selector)})].find((e) => e.getClientRects().length);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
})()`);

// finding 1: the poster was captured 500 ms after the seek was asked, before a slow seek had ended,
// hence it was the first frame of the video. SLOW_SEEK starts the seek of a video that is not on
// the page, i.e. of the video of the capture, 900 ms after it is asked, as a slow machine does
const SLOW_SEEK = `(() => {
  const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    get() { return d.get.call(this); },
    set(v) { if (this.isConnected) d.set.call(this, v); else setTimeout(() => d.set.call(this, v), 900); },
  });
  return true;
})()`;
const SLIDER = `${PANEL} input[name="poster-frame"]`;
const posterBytes = (page, video) => page.evaluate(`fetch(document.querySelector(${js(video)}).poster).then((r) => r.arrayBuffer()).then((b) => [...new Uint8Array(b)].reduce((h, x) => (h * 31 + x) >>> 0, b.byteLength))`);

for (const platform of PLATFORMS) {
  test(`a poster is captured at the time of the slider after a seek slower than 500 ms (${platform})`, async (t) => {
    const page = await load(t, platform, { n: VIDEOS });
    const mode = await page.evaluate(`[...document.querySelectorAll('.reveal section.present video')].find((v) => v.getBoundingClientRect().width).classList.contains('for-dark') ? 'dark' : 'light'`);
    const video = `.reveal section.present video.for-${mode}`;
    const clip = `clip-${mode}`;
    await click(page, video);
    await frames(page);
    await page.waitFor(`!!document.querySelector(${js(SLIDER)}) && !document.querySelector(${js(SLIDER)}).disabled`);
    await page.evaluate(SLOW_SEEK);
    const r = await boxOf(page, SLIDER);
    await click(page, { x: r.left + 8 + (r.width - 16) * 0.5, y: r.top + r.height / 2 });
    await page.waitFor(`window.BeesonEditor.render().includes('poster="media/${clip}.png"')`, 10000);
    const half = await posterBytes(page, video);
    await page.evaluate(`document.querySelector(${js(SLIDER)}).focus()`);
    await press(page, 'Home');
    await page.waitFor(`window.BeesonEditor.render().includes('poster="media/${clip}-2.png"')`, 10000);
    const first = await posterBytes(page, video);
    assert.notEqual(half, first, 'the poster at the middle of the video is its first frame');
    await page.evaluate('window.showDirectoryPicker = () => navigator.storage.getDirectory()');
    await roundTrip(page, 2);
  });
}
