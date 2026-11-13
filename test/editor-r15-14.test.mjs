// the tiles of the layout chooser and of the New Slide gallery, and the sketch of the well Slide
// Layout of the inspector, of R15.14, on both platforms. a tile draws the texts that a new slide of
// its layout gets, and a gray box at the place where the layout puts a figure or a backdrop: the
// figure box of Content and the backdrop of Content, Narrow. Content, Wide is without a box, in its tile
// and in the well, since its text column runs over the place of the figure box

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
// the content, narrow, and wide slides of editor-layouts.html
const SLIDES = { content: 3, narrow: 4, wide: 5 };
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
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

async function load(t, platform, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(LAYOUTS, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the gray boxes of each tile of the gallery of selector, by the layout of the tile: the class and
// the left, top, width, and height in slide px of each figure box, plate, and backdrop of its sample
const tiles = (page, selector) => page.evaluate(`(() => {
  const out = {};
  for (const tile of document.querySelectorAll(${js(selector)} + ' .tile')) {
    const root = tile.querySelector('.pic').shadowRoot;
    const slide = root.querySelector('section');
    const s = slide.getBoundingClientRect();
    const k = s.width / slide.offsetWidth;
    out[tile.dataset.layout] = [...slide.querySelectorAll('.figure-box, .plate, .backdrop')].map((e) => {
      const r = e.getBoundingClientRect();
      return [e.className, ...[(r.left - s.left) / k, (r.top - s.top) / k, r.width / k, r.height / k].map(Math.round)];
    });
  }
  return out;
})()`);

for (const platform of PLATFORMS) {
  for (const [name, command, selector] of [
    ['layout chooser', 'slide.layoutChooser', '.beeson-edit-layouts'],
    ['New Slide gallery', 'slide.gallery', '.beeson-edit-gallery:not(.beeson-edit-layouts)'],
  ]) {
    test(`the tiles Content and Content, Narrow of the ${name} draw the place of their figure, and Content, Wide is without one (${platform})`, async (t) => {
      const page = await load(t, platform, SLIDES.content);
      await exec(page, command);
      await frames(page);
      const drawn = await tiles(page, selector);
      // the figure box of a content slide and the backdrop of a narrow slide, as theme/beeson.css places them
      assert.deepEqual(drawn.content, [['figure-box', 1200, 120, 600, 800]]);
      assert.deepEqual(drawn.narrow, [['backdrop', 920, 0, 1000, 1080]]);
      assert.deepEqual(drawn.wide, []);
      assert.deepEqual(errors(page), []);
    });
  }

  test(`a new Content slide is written without a zone (${platform})`, async (t) => {
    const page = await load(t, platform, SLIDES.content);
    const before = await render(page);
    await exec(page, 'slide.new.content');
    await frames(page);
    const made = await render(page);
    assert.equal((made.match(/class="figure-box"/g) ?? []).length, (before.match(/class="figure-box"/g) ?? []).length);
    assert.deepEqual(errors(page), []);
  });

  test(`the well Slide Layout draws the block of the figure for Content and Content, Narrow, and not for Content, Wide (${platform})`, async (t) => {
    const page = await load(t, platform, SLIDES.content);
    // the blocks of the sketch that are at least as high as the figure of a content slide, i.e. the
    // figure box of Content and the backdrop of Content, Narrow, whose square left corners are drawn
    // by a second rect with rx 0
    const blocks = () => page.evaluate(`(() => {
      const svg = document.querySelector('.beeson-edit-inspector .ed-card .thumb svg');
      return svg ? [...svg.querySelectorAll('rect')].filter((r) => r.getAttribute('fill') === 'var(--ed-faint)' && Number(r.getAttribute('height')) >= 24 && r.getAttribute('rx') !== '0').length : null;
    })()`);
    const name = () => page.evaluate(`document.querySelector('.beeson-edit-inspector .ed-card .what span:last-child')?.textContent ?? null`);
    for (const [layout, label, n] of [['content', 'Content', 1], ['narrow', 'Content, Narrow', 1], ['wide', 'Content, Wide', 0]]) {
      await page.evaluate(`Reveal.slide(${SLIDES[layout]})`);
      await frames(page);
      assert.equal(await name(), label);
      assert.equal(await blocks(), n, `the block of the figure in the well for ${label}`);
    }
    assert.deepEqual(errors(page), []);
  });
}
