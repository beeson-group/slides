// the fixes of R6.6 on both platforms. the tiles of the layout chooser are drawn from samples of
// the layouts rather than from the current slide. Cmd+Enter on a Mac and Ctrl+Enter elsewhere commit the TeX
// of the Insert Formula and Edit Formula sheets while the preview is still typeset, and the labels
// of the transitions say that reveal.js plays the Fade of the slide entered. each edit of the file
// is checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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

// reveal.js fades a slide in by its own data-transition, over the slide left (z-index 11 on
// section.present in theme/vendor/reveal/reveal.css), hence a Fade set on a slide is played into it
for (const platform of PLATFORMS) {
  test(`the label of Fade says that it is played into the slide on ${platform}`, async () => {
    const page = await editor(platform, 3);
    const [title, group] = await page.evaluate(`[
      document.querySelector('.beeson-edit-transition button[data-command="slide.transition.fade"]').title,
      document.querySelector('.beeson-edit-transition .seg').getAttribute('aria-label'),
    ]`);
    assert.equal(title, 'Fade into this slide from the slide before, the default of the theme');
    assert.doesNotMatch(group, /next slide/);
    assert.deepEqual(errors(page), []);
  });
}

// the drawing of each tile of the chooser opened on the slide at index, as the markup of the slide
// in its shadow root and a hash of its pixels, inside the outline of the tile. Chrome may raster an
// anti-aliased edge of a new tile one level apart on its first frame, e.g. the corner of the zone
// of Split at a half pixel, hence a tile is captured until two captures in a row are equal
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
  const digest = async (clip) => createHash('sha1').update(await page.screenshot(clip)).digest('hex');
  for (const t of list) {
    t.pixels = await digest(t.clip);
    for (let n = 0, last = null; n < 5 && t.pixels !== last; n++) [last, t.pixels] = [t.pixels, await digest(t.clip)];
  }
  await press(page, 'Escape');
  return list;
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
    assert.deepEqual(figure.map((t) => t.pixels), content.map((t) => t.pixels), 'a tile is drawn from the current slide');
    assert.deepEqual(content.filter((t) => t.marked).map((t) => t.layout), ['content']);
    assert.deepEqual(figure.filter((t) => t.marked).map((t) => t.layout), ['figure']);
    // the deck is not changed by the chooser
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}
