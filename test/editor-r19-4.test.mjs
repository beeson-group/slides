// regression tests of R19.4 on both platforms. at Fit, the slide stays at its place while the room
// past it shrinks after a drop, an undo, or a click on the picture (D8). a grip of an object
// selected with a group scales the group as one about its frame (D9)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const DECK = 'test-deck.html';
// the index of the figures slide in index.html
const FIGURES = 4;
const IMG = 'section.present figure img.for-light';
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
const near = (a, b, d) => Math.abs(a - b) <= d;
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const mouse = (page, type, x, y, extra = {}) => page.send('Input.dispatchMouseEvent', { type, x, y, ...extra });

const PANEL = '#beeson-edit-panel-format';
async function typeField(page, id, value) {
  await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].find((b) => b.textContent === 'Arrange')?.click()`);
  await frames(page);
  await page.evaluate(`(() => { const i = document.querySelector('#beeson-edit-num-${id}'); i.focus(); i.select(); })()`);
  await type(page, String(value));
  await press(page, 'Enter');
  await frames(page);
}

async function load(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&theme=light&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${FIGURES})`);
  await frames(page);
  return page;
}

// the upper left corner of the slide in CSS px
const slideAt = (page) => page.evaluate(`(() => { const r = document.querySelector('.reveal .slides').getBoundingClientRect(); return { x: r.left, y: r.top }; })()`);
const blockAt = (page, selector) => page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(${js(selector)}).getBoundingClientRect(); return { x: r.left + 20, y: r.top + 20 }; })()`);
const rectOf = (page, selector) => page.evaluate(`(() => { const r = document.querySelector(${js(selector)}).getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);

for (const platform of PLATFORMS) {
  // the modifier that turns the snap off in a drag
  const free = platform === 'mac' ? 'Mod' : 'Alt';

  // D8: with the figure past the left edge of the slide, each drop 40 px to the right moved the
  // slide 40 px to the right, since the room left of it shrank twice
  test(`at Fit the slide stays at its place while the room left of it shrinks after a drop and an undo (${platform})`, async (t) => {
    const page = await load(t, platform);
    const rest = await slideAt(page);
    await click(page, IMG);
    await typeField(page, 'x', -300);
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await slideAt(page), rest, 'the slide moved when the figure was put past its left edge');
    for (let n = 1; n <= 3; n++) {
      const at = await rectOf(page, IMG);
      await drag(page, { x: at.left + at.width / 2, y: at.top + at.height / 2 }, { dx: 40, modifiers: free });
      await frames(page);
      const now = await slideAt(page);
      assert.ok(near(now.x, rest.x, 0.5) && near(now.y, rest.y, 0.5), `after drop ${n} the slide is at ${js(now)}, and at ${js(rest)} at Fit`);
    }
    await undo(page);
    await frames(page);
    const now = await slideAt(page);
    assert.ok(near(now.x, rest.x, 0.5) && near(now.y, rest.y, 0.5), `after the undo the slide is at ${js(now)}, and at ${js(rest)} at Fit`);
    assert.deepEqual(errors(page), []);
  });

  test(`at Fit the slide stays at its place when the picture of a figure past its edge is selected (${platform})`, async (t) => {
    const page = await load(t, platform);
    const rest = await slideAt(page);
    await click(page, IMG);
    await typeField(page, 'x', -200);
    await press(page, 'Escape');
    await frames(page);
    await click(page, IMG);
    await frames(page);
    assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((el) => el.localName)'), ['img']);
    const now = await slideAt(page);
    assert.ok(near(now.x, rest.x, 0.5) && near(now.y, rest.y, 0.5), `with the picture selected the slide is at ${js(now)}, and at ${js(rest)} at Fit`);
    await press(page, 'Escape');
    await frames(page);
    const then = await slideAt(page);
    assert.ok(near(then.x, rest.x, 0.5) && near(then.y, rest.y, 0.5), `after Esc the slide is at ${js(then)}, and at ${js(rest)} at Fit`);
    assert.deepEqual(errors(page), []);
  });

  // D9: a grip of the heading selected with the group of the paragraph and the figure resized each
  // member about its own anchor, and the figure moved against the paragraph
  for (const [handle, dx] of [['e', -80], ['w', 80]]) {
    test(`the grip ${handle} of an object selected with a group scales the group as one about its frame (${platform})`, async (t) => {
      const page = await load(t, platform);
      await click(page, IMG);
      await click(page, await blockAt(page, ':scope > p'), { modifiers: 'Shift' });
      await press(page, platform === 'mac' ? 'Alt+Mod+G' : 'Mod+G');
      await frames(page);
      const grouped = await render(page);
      await click(page, await blockAt(page, ':scope > h2'), { modifiers: 'Shift' });
      await frames(page);
      assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 3);
      const P = 'section.present > p';
      const measure = async () => ({ p: await rectOf(page, P), img: await rectOf(page, IMG) });
      const was = await measure();
      const g = await page.evaluate(`(() => { const g = [...document.querySelectorAll('.beeson-grip[data-handle=${handle}]')].find((x) => !x.hidden && !x.dataset.group); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      await mouse(page, 'mouseMoved', g.x, g.y);
      await mouse(page, 'mousePressed', g.x, g.y, { button: 'left', buttons: 1, clickCount: 1 });
      for (let i = 1; i <= 8; i++) await mouse(page, 'mouseMoved', g.x + (dx * i) / 8, g.y, { button: 'left', buttons: 1 });
      await frames(page);
      await mouse(page, 'mouseReleased', g.x + dx, g.y, { button: 'left', clickCount: 1 });
      await frames(page);
      const now = await measure();
      const k = now.img.width / was.img.width;
      assert.ok(k < 0.98, `the group was not scaled: ${js({ was, now })}`);
      assert.ok(near(now.p.width / was.p.width, k, 0.02), `the paragraph is scaled by ${now.p.width / was.p.width} and the figure by ${k}`);
      // the center of the picture keeps its place to the upper left corner of the paragraph, scaled by k
      const dx0 = was.img.left + was.img.width / 2 - was.p.left, dy0 = was.img.top + was.img.height / 2 - was.p.top;
      const dx1 = now.img.left + now.img.width / 2 - now.p.left, dy1 = now.img.top + now.img.height / 2 - now.p.top;
      assert.ok(near(dx1, dx0 * k, 3) && near(dy1, dy0 * k, 3), `the picture to the paragraph is ${js([dx1, dy1])}, and ${js([dx0 * k, dy0 * k])} scaled by ${k}`);
      const edited = await render(page);
      assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 3);
      await undo(page);
      assert.equal(await render(page), grouped);
      await redo(page);
      assert.equal(await render(page), edited);
      const { text } = await saveAndReopen(page, `r19-4-group-follow-${handle}-${platform}.html`);
      assert.equal(text, edited);
      assert.deepEqual(errors(page), []);
    });
  }
}
