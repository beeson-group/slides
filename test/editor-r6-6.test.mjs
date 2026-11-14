// the fixes of R6.6 on both platforms. the tiles of the layout chooser are drawn from samples of
// the layouts rather than from the current slide. Cmd+Enter on a Mac and Ctrl+Enter elsewhere commit the TeX
// of the Insert Formula and Edit Formula sheets while the preview is still typeset, and the labels
// of the transitions say that reveal.js plays the Fade of the slide entered. each edit of the file
// is checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
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

let last = null;

// the editor on the slide at index of a deck, served over HTTP
async function editor(platform, index = 2, deck = LAYOUTS) {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.send('Page.bringToFront');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  await page.evaluate(`Reveal.slide(${index})`);
  await wait(page, 300);
  return page;
}

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const wait = (page, ms) => page.evaluate(`new Promise((d) => setTimeout(() => d(true), ${ms}))`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const until = async (page, expr, ms = 3000) => {
  for (const end = Date.now() + ms; Date.now() < end; await wait(page, 50)) if (await page.evaluate(expr)) return true;
  return false;
};

let saves = 0;
async function saved(page) {
  const { text } = await saveAndReopen(page, `r6-6-${++saves}.html`);
  page.source = text;
  await byteExact(page);
  return text;
}

// undoes every entry down to source, and redoes them all, back to the text edited
async function undoAll(page, source) {
  const text = await render(page);
  let n = 0;
  while ((await render(page)) !== source) {
    assert.ok(n++ < 20, 'the undo does not reach the text of the deck');
    await undo(page);
  }
  await byteExact(page);
  for (let i = 0; i < n; i++) await redo(page);
  assert.equal(await render(page), text);
}

// typesetPromise, which typesets a slide, and tex2svgPromise, which typesets the preview of a
// sheet, are each slowed by 150 ms, as on a loaded machine
const SLOW = `(() => {
  for (const name of ['typesetPromise', 'tex2svgPromise']) {
    const t = MathJax[name].bind(MathJax);
    MathJax[name] = (...a) => new Promise((d) => setTimeout(d, 150)).then(() => t(...a));
  }
})()`;

const sheetOpen = `!!document.querySelector('.beeson-math textarea')`;
const sheetClosed = `!document.querySelector('.beeson-math')`;

for (const platform of PLATFORMS) {
  test(`the commit key of the Insert Formula sheet typed before the preview lands on ${platform}`, async () => {
    const page = await editor(platform, 2);
    const source = page.source;
    await exec(page, 'insert.formula');
    assert.ok(await until(page, sheetOpen), 'the sheet is not open');
    assert.equal(await page.evaluate(`document.querySelector('.beeson-math .title').textContent`), 'Insert Formula');
    await page.evaluate(SLOW);
    await type(page, 'x^2');
    await press(page, 'Mod+Enter');
    assert.ok(await until(page, sheetClosed), 'the key is lost, and the sheet is still open');
    await wait(page, 400);
    assert.match(await render(page), /<div class="math">\\\[x\^2\\\]<\/div>/);
    await undoAll(page, source);
    await saved(page);
    assert.deepEqual(errors(page), []);
  });

  test(`the commit key of the Edit Formula sheet typed after an error lands on ${platform}`, async () => {
    const page = await editor(platform, 3);
    const OLD = String.raw`-\frac{\partial \tilde U}{\partial x},`;
    await click(page, '.reveal section.present div.math mjx-container');
    assert.ok(await until(page, sheetOpen), 'the sheet is not open');
    assert.equal(await page.evaluate(`document.querySelector('.beeson-math .title').textContent`), 'Edit Formula');
    // a brace left open in the TeX is an error of MathJax, which dims Apply
    await page.evaluate(`(() => {
      const f = document.querySelector('.beeson-math textarea');
      f.value = f.value.replace(${JSON.stringify(OLD)}, ${JSON.stringify(String.raw`-\frac{a}{`)});
      const at = f.value.lastIndexOf('{') + 1;
      f.setSelectionRange(at, at);
      f.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    const dimmed = `[...document.querySelectorAll('.beeson-math button')].find((b) => b.textContent === 'Apply').disabled`;
    assert.ok(await until(page, dimmed), 'the error does not dim Apply');
    await page.evaluate(SLOW);
    await type(page, 'b}');
    await press(page, 'Mod+Enter');
    assert.ok(await until(page, sheetClosed), 'the key is lost, and the sheet is still open');
    await wait(page, 400);
    await byteExact(page, [[OLD, String.raw`-\frac{a}{b}`]]);
    await undoAll(page, readFileSync(LAYOUTS, 'utf8'));
    await saved(page);
    assert.deepEqual(errors(page), []);
  });
}

// as in Keynote, the transition of a slide is played when the show leaves it for the next slide
for (const platform of PLATFORMS) {
  test(`the label of Fade says that it is played from the slide into the next slide on ${platform}`, async () => {
    const page = await editor(platform, 3);
    const [title, group] = await page.evaluate(`[
      document.querySelector('.beeson-edit-transition button[data-command="slide.transition.fade"]').title,
      document.querySelector('.beeson-edit-transition .seg').getAttribute('aria-label'),
    ]`);
    assert.equal(title, 'Fade from this slide into the next slide, the default of the theme');
    assert.match(group, /next slide/);
    assert.deepEqual(errors(page), []);
  });
}

// the drawing of each tile of the chooser opened on the slide at index, as the markup of the slide
// in its shadow root, its pixels, and a hash of them, inside the outline of the tile
async function tiles(page, index) {
  await page.evaluate(`Reveal.slide(${index})`);
  await wait(page, 300);
  await exec(page, 'slide.layoutChooser');
  assert.ok(await until(page, `document.querySelectorAll('.beeson-edit-layouts .tile .pic').length === 8`), 'the chooser is not open');
  await frames(page);
  const list = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-layouts .tile')].map((t) => {
    const r = t.querySelector('.pic').getBoundingClientRect();
    return {
      layout: t.dataset.layout,
      name: t.textContent.trim(),
      marked: t.getAttribute('aria-selected') === 'true',
      markup: t.querySelector('.pic').shadowRoot.querySelector('.slides').innerHTML,
      clip: { x: r.left + 4, y: r.top + 4, width: r.width - 8, height: r.height - 8, scale: 1 },
    };
  })`);
  for (const t of list) {
    t.png = await page.screenshot(t.clip);
    t.pixels = createHash('sha1').update(t.png).digest('hex');
  }
  await press(page, 'Escape');
  return list;
}

// the rows of pixels of a PNG written by Chrome, with 8 bits per channel and without interlace, as
// in switcher.test.mjs
function decodePng(png) {
  let at = 8, width = 0, height = 0, channels = 4;
  const data = [];
  while (at < png.length) {
    const length = png.readUInt32BE(at), kind = png.toString('ascii', at + 4, at + 8), body = png.subarray(at + 8, at + 8 + length);
    if (kind === 'IHDR') ({ width, height, channels } = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), channels: body[9] === 6 ? 4 : 3 });
    if (kind === 'IDAT') data.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data)), stride = width * channels, px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[y * stride + x - channels] : 0, b = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= channels && y ? px[(y - 1) * stride + x - channels] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      px[y * stride + x] = raw[y * (stride + 1) + 1 + x] + [0, a, b, (a + b) >> 1, paeth][filter];
    }
  }
  return { width, channels, px };
}

// true when two captures of a tile are drawn alike. Chrome may raster an anti-aliased edge of a new
// tile one level apart, e.g. the corner of the figure box of Split at a half pixel, and it may keep that
// raster for some frames under load, hence each channel may differ by two levels
function alike(a, b) {
  const [x, y] = [decodePng(a), decodePng(b)];
  return x.width === y.width && x.px.length === y.px.length && x.px.every((v, i) => Math.abs(v - y.px[i]) <= 2);
}

for (const platform of PLATFORMS) {
  test(`the tiles of the layout chooser are samples of the layouts, the same on every slide, on ${platform}`, async () => {
    const page = await editor(platform, 2);
    const content = await tiles(page, 2);
    const figure = await tiles(page, 8);

    assert.deepEqual(content.map((t) => t.name), ['Title', 'Section', 'Content', 'Content, Narrow', 'Content, Wide', 'Figure', 'Split', 'Closing']);
    assert.equal(new Set(content.map((t) => t.markup)).size, 8, 'two tiles have the same markup');
    assert.equal(new Set(content.map((t) => t.pixels)).size, 8, 'two tiles are drawn alike');
    assert.deepEqual(figure.map((t) => t.markup), content.map((t) => t.markup), 'a tile depends on the current slide');
    for (const [i, t] of figure.entries()) assert.ok(alike(t.png, content[i].png), `the tile of ${t.layout} is drawn from the current slide`);
    assert.deepEqual(content.filter((t) => t.marked).map((t) => t.layout), ['content']);
    assert.deepEqual(figure.filter((t) => t.marked).map((t) => t.layout), ['figure']);
    // the deck is not changed by the chooser
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}
