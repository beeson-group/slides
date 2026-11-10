// resizing, lines, and guides of package R5.2 on both platforms, driven with trusted input: a
// picture sized in the editor is drawn at the size written into its tag, with or without the
// editor, the fields W and H give the drawn picture, a marquee selects a line, an element snaps to
// the ends and the middle of a line and a line to the other elements, the guides placed by hand
// follow their slide, a picture is stretched with Constrain Proportions off, and a text block is
// given a width by its grips. each edit is checked byte for byte after an undo, and after a save
// and an open of the saved text

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { byteExact, click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const PLATFORMS = ['mac', 'other'];
const LAYOUTS = 'test/pages/editor-layouts.html';
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const SECTIONS = [...readFileSync(LAYOUTS, 'utf8').matchAll(/<section[\s\S]*?<\/section>/g)].map((m) => m[0]);
const MATH = SECTIONS.findIndex((s) => s.includes('<h2>Math, an ordered list, and a zone</h2>'));
const PAPER = SECTIONS.findIndex((s) => s.includes('<h2>A figure slide with a paper image</h2>'));
const ZONE_IMG = '.reveal section.present .zone > img';
const PANEL = '#beeson-edit-panel-format';

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
let saves = 0;

// the editor on slide n of the deck of layouts, served over HTTP, with the storage of the browser
// cleared first unless keep is set
async function editor(platform, n = MATH, { keep = false } = {}) {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.send('Page.bringToFront');
  const url = `${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  if (!keep) {
    await page.evaluate('localStorage.clear()');
    await page.goto(url);
  }
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(LAYOUTS, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const near = (a, b, by = 2) => Math.abs(a - b) <= by;

async function inScope(page) {
  const now = textProblems(await render(page), THEME);
  for (const p of textProblems(page.source, THEME)) {
    const i = now.indexOf(p);
    if (i >= 0) now.splice(i, 1);
  }
  assert.deepEqual(now, []);
}

// the edit, the file again after an undo, the edit again after a redo, and a save opened again
async function roundTrip(page, edited) {
  await undo(page);
  await frames(page);
  await byteExact(page);
  await redo(page);
  await frames(page);
  assert.equal(await render(page), edited, 'a redo does not write the edit again');
  await inScope(page);
  await saveAndReopen(page, `r5-2-${++saves}.html`);
}

// the screen point of a point in slide px, and the box of an element in slide px
const screen = (page, x, y) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides');
  const r = s.getBoundingClientRect(), k = r.width / s.offsetWidth;
  return { x: r.left + ${x} * k, y: r.top + ${y} * k };
})()`);
const slideBox = (page, selector) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides');
  const r = s.getBoundingClientRect(), k = r.width / s.offsetWidth;
  const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getBoundingClientRect().width);
  const b = el.getBoundingClientRect();
  return { left: (b.left - r.left) / k, top: (b.top - r.top) / k, width: b.width / k, height: b.height / k };
})()`);

// the box of the picture of the shown image or video of selector in slide px, fitted in its box
// with object-fit contain where its style sets that
const pictureBox = (page, selector) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides');
  const sr = s.getBoundingClientRect(), k = sr.width / s.offsetWidth;
  const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getBoundingClientRect().width);
  const r = el.getBoundingClientRect();
  const [w, h] = el instanceof HTMLImageElement ? [el.naturalWidth, el.naturalHeight] : [el.videoWidth, el.videoHeight];
  let b = { left: r.left, top: r.top, width: r.width, height: r.height };
  if (w && h && getComputedStyle(el).objectFit === 'contain') {
    const q = Math.min(r.width / w, r.height / h);
    b = { left: r.left + (r.width - w * q) / 2, top: r.top + (r.height - h * q) / 2, width: w * q, height: h * q };
  }
  return { left: (b.left - sr.left) / k, top: (b.top - sr.top) / k, width: b.width / k, height: b.height / k };
})()`);

// the Arrange pane of the Format tab shown, and the values of its fields W and H
async function arrange(page) {
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await sleep(50);
  const at = await page.evaluate(`(() => { const b = [...document.querySelectorAll('${PANEL} button')].find((b) => [b.textContent.trim(), b.title, b.getAttribute('aria-label')].includes('Arrange')); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await sleep(50);
  return sizeFields(page);
}
const sizeFields = (page) => page.evaluate(`(() => {
  const f = (n) => document.querySelector('${PANEL} #beeson-edit-num-' + n);
  return { w: f('width')?.value ?? null, h: f('height')?.value ?? null, wOff: !!f('width')?.disabled, hOff: !!f('height')?.disabled };
})()`);

// a value typed into a field of the inspector and committed with Return
async function setField(page, name, value) {
  const at = await page.evaluate(`(() => { const r = document.querySelector('${PANEL} #beeson-edit-num-${name}').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, at, { count: 3 });
  await press(page, 'Mod+A');
  await page.send('Input.insertText', { text: String(value) });
  await press(page, 'Enter');
  await sleep(80);
}

// the image of the zone of the math slide selected by itself, with a click on the figure and one
// more on the image
async function selectZoneImage(page) {
  await click(page, ZONE_IMG);
  await click(page, ZONE_IMG);
  await frames(page);
}

for (const platform of PLATFORMS) {
  test(`${platform}: a picture sized past the box of its zone or plate is drawn at the size in its tag, with and without the editor`, async () => {
    const page = await editor(platform);
    await selectZoneImage(page);
    await arrange(page);
    await setField(page, 'width', 1000);
    const pic = await pictureBox(page, ZONE_IMG);
    assert.ok(near(pic.width, 1000) && near(pic.height, 1200), `the image of width 1000 is drawn at ${Math.round(pic.width)} by ${Math.round(pic.height)}`);
    const edited = await render(page);
    assert.match(edited, /<img class="for-dark"[^>]* style="width: 1000px"/, 'the width is not written on the image');
    await roundTrip(page, edited);
    assert.deepEqual(errors(page), []);

    // a paper image of a plate, which the theme scales down to fit
    const plate = await editor(platform, PAPER);
    await click(plate, '.reveal section.present .plate > img');
    await click(plate, '.reveal section.present .plate > img');
    await arrange(plate);
    await setField(plate, 'width', 1800);
    // the paper of 24 px around the picture is inside the width of the image
    const paper = await slideBox(plate, '.reveal section.present .plate > img');
    assert.ok(near(paper.width, 1800) && near(paper.height, 1752 * 1.2 + 48), `the paper image of width 1800 is drawn at ${Math.round(paper.width)} by ${Math.round(paper.height)}`);
    assert.deepEqual(errors(plate), []);

    // the same tags in a deck without the editor
    const show = await browser.newPage();
    await show.goto(`${server.origin}/${LAYOUTS}?still`);
    await show.waitFor(deckSettled);
    await show.evaluate(`(() => { Reveal.slide(${MATH}); for (const img of document.querySelectorAll('.zone > img')) img.style.width = '1000px'; })()`);
    await frames(show);
    const shown = await pictureBox(show, ZONE_IMG);
    assert.ok(near(shown.width, 1000) && near(shown.height, 1200), `the deck draws the image of width 1000 at ${Math.round(shown.width)} by ${Math.round(shown.height)}`);
    await show.close();
  });
}
