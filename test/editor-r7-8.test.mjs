// tests of R7.8 on both platforms with trusted input: every row of a new table kept, a placeholder
// with icons in an empty zone that is drawn by the editor only, a mask resized by its handles, and
// a sort of the rows of a table. after each edit the text is checked byte for byte, after an undo
// and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { numberOf, sortOrder } from '../src/editor/table.ts';
import { byteExact, click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const DECK = 'index.html';
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const PLATFORMS = ['mac', 'other'];
// the window of the pictures of round 3 on the Mac, and a window of 1920 by 1080 elsewhere
const SIZES = { mac: { width: 1600, height: 1000 }, other: { width: 1920, height: 1080 } };
// the index of the slide "Figures are first class citizens, too" of index.html, whose list ends
// near the bottom of the slide, beside its figure
const FIGURES = 4;
// the deck of tables of the table tests, with a table with a rowspan on its first slide and a
// plain table of mass ratios on its second
const TABLES = 'test/pages/editor-tables.html';
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

const js = (v) => JSON.stringify(v);
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
const rect = (page, selector) => page.evaluate(`(() => { const e = [...document.querySelectorAll(${js(selector)})].find((e) => e.getBoundingClientRect().width); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// the editor on slide n of a deck served over HTTP, with the Format tab shown
async function load(t, platform, { deck = DECK, n = 0 } = {}) {
  const page = await browser.newPage(SIZES[platform]);
  t.after(() => page.close().catch(() => {}));
  // the file chooser of the browser is given its files by the test, as in editor-media.test.mjs
  await page.send('Page.setInterceptFileChooserDialog', { enabled: true });
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks the edited text, the text before byte for byte after an undo, the edited text
// after a redo, and an open of the saved text without problems. it returns the edited text
let saves = 0;
async function roundTrip(page, edited = null) {
  const text = await render(page);
  if (edited !== null) assert.equal(text, edited);
  assert.notEqual(text, page.source, 'the edit did not change the text');
  await undo(page);
  await byteExact(page);
  await redo(page);
  assert.equal(await render(page), text);
  const saved = await saveAndReopen(page, `r7-8-${++saves}.html`);
  assert.equal(saved.text, text);
  assert.deepEqual(errors(page), []);
  page.source = saved.text;
  return text;
}

const count = (text, re) => (text.match(re) ?? []).length;

// states 23, 49, 93, and 157 of round 3: a table of 3 by 3 cells chosen in the grid was inserted
// with 2 rows, since the row that did not fit under the list was taken out
for (const platform of PLATFORMS) {
  test(`a table of 3 by 3 cells chosen in the grid is inserted with its 3 rows, on the slide (${platform})`, async (t) => {
    const page = await load(t, platform, { n: FIGURES });
    const rows = count(page.source, /<tr>/g);
    await click(page, '.reveal section.present ul > li:last-child');
    await press(page, 'Escape');
    await click(page, '.beeson-edit-top [data-command="insert.table"]');
    await page.waitFor(`!!document.querySelector('dialog.beeson-table-picker[open]')`);
    // the cell of the third row and the third column of the grid of 10 columns
    const cell = await rect(page, '.beeson-table-picker .grid > :nth-child(23)');
    await click(page, cell);
    await page.waitFor(`!!document.querySelector('.reveal section.present table')`);
    await frames(page);
    const shape = await page.evaluate(`[...document.querySelector('.reveal section.present table').rows].map((r) => r.cells.length)`);
    assert.deepEqual(shape, [3, 3, 3]);
    const slide = await rect(page, '.reveal section.present');
    const table = await rect(page, '.reveal section.present table');
    const figure = await rect(page, '.reveal section.present figure.zone');
    assert.ok(table.top >= slide.top && table.bottom <= slide.bottom, `the table at ${js(table)} runs past the slide at ${js(slide)}`);
    assert.ok(!meets(table, figure), 'the table covers the figure');
    assert.equal(await undoLabel(page), 'Undo Insert Table');
    const edited = await roundTrip(page);
    assert.equal(count(edited, /<tr>/g), rows + 3);
  });
}

// the center of the item labeled label of the open menus, or null
const itemAt = (page, label) => page.evaluate(`(() => {
  const item = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label')?.textContent === ${js(label)});
  if (!item || item.getAttribute('aria-disabled') === 'true') return null;
  const r = item.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);

const cellOf = (r, c) => `.reveal section.present table tr:nth-child(${r + 1}) > :nth-child(${c + 1})`;
const PLAIN = [
  '<tr><td>Moon</td><td>\\(0.01215\\)</td><td>Earth and Moon</td></tr>',
  '<tr><td>Europa</td><td>2.53e-5</td><td>Jupiter</td></tr>',
  '<tr><td>Titan</td><td>2.37e-4</td><td>Saturn</td></tr>',
];
const plainRows = (order) => order.map((i) => PLAIN[i]).join('\n      ');

test('numbers of a table are read by value, and a sort puts numbers before texts and empty cells last', () => {
  assert.equal(numberOf('1,200'), 1200);
  assert.equal(numberOf('(10.00)'), -10);
  assert.equal(numberOf('12 %'), 0.12);
  assert.equal(numberOf('−3.5'), -3.5);
  assert.equal(numberOf('2.53e-5'), 2.53e-5);
  assert.equal(numberOf('Halo'), null);
  assert.deepEqual(sortOrder(['10', '9', '100']), [1, 0, 2]);
  assert.deepEqual(sortOrder(['10', '9', '100'], true), [2, 0, 1]);
  assert.deepEqual(sortOrder(['b', '', '2', 'A', '1']), [4, 2, 3, 0, 1]);
  assert.deepEqual(sortOrder(['b', '', '2', 'A', '1'], true), [2, 4, 0, 3, 1]);
  // rows with equal keys keep their order
  assert.deepEqual(sortOrder(['x', 'y', 'x']), [0, 2, 1]);
});

// state 95 of round 3: the menu of a cell did not sort the rows of its table. Keynote sorts the
// body rows by a column from the menu of the column
for (const platform of PLATFORMS) {
  test(`Sort Descending in the menu of a cell reorders the body rows by its column, as one entry (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: TABLES, n: 1 });
    await click(page, cellOf(2, 1));
    await frames(page);
    await click(page, cellOf(2, 1), { button: 'right' });
    await page.waitFor(`!!document.querySelector('.beeson-edit-menu.cell')`);
    const item = await itemAt(page, 'Sort Descending');
    assert.ok(item, 'the menu of the cell does not offer Sort Descending');
    await click(page, item);
    await frames(page);
    // 0.01215, 2.37e-4, and 2.53e-5, with the formula read as its number
    await byteExact(page, [[plainRows([0, 1, 2]), plainRows([0, 2, 1])]]);
    assert.equal(await undoLabel(page), 'Undo Sort Descending');
    await roundTrip(page);
  });

  test(`Sort Ascending in the Table pane reorders the body rows by the column of the caret (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: TABLES, n: 1 });
    await click(page, cellOf(1, 0));
    await frames(page);
    const button = await rect(page, `${PANEL} [data-command="table.sortAscending"]`);
    assert.ok(button, 'the Table pane does not have Sort Ascending');
    await click(page, button);
    await frames(page);
    // Europa, Moon, and Titan
    await byteExact(page, [[plainRows([0, 1, 2]), plainRows([1, 0, 2])]]);
    assert.equal(await undoLabel(page), 'Undo Sort Ascending');
    // the caret is kept in its cell, which is moved with its row
    assert.equal(await page.evaluate('document.activeElement.textContent'), 'Moon');
    await roundTrip(page);
    // a sort of rows already in order is not an entry of the history, which the open of the saved
    // text emptied
    await click(page, cellOf(1, 0));
    await exec(page, 'table.sortAscending');
    assert.equal(await render(page), page.source);
    assert.equal((await state(page, 'edit.undo')).enabled, false);
  });

  test(`Sort is dimmed for a table with a cell over two rows (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: TABLES, n: 0 });
    await click(page, cellOf(3, 1));
    await frames(page);
    assert.equal((await state(page, 'table.sortAscending')).enabled, false);
    assert.equal((await state(page, 'table.sortDescending')).enabled, false);
  });
}

// the deck of empty zones: a split slide and a content slide with an empty zone each, and a figure
// slide with an empty plate
const EMPTY = 'test/pages/editor-empty-zone.html';
const PLACEHOLDER = '.reveal section.present .beeson-placeholder';
const shownPlaceholders = (page) => page.evaluate(`[...document.querySelectorAll('.reveal section.present .beeson-placeholder')].filter((p) => p.getBoundingClientRect().width > 0).length`);
const buttonOf = (page, label) => rect(page, `${PLACEHOLDER} button[aria-label="${label}"]`);

// state 98 of round 3: an empty zone was drawn as nothing until a file was dragged over it, where
// PowerPoint draws a content placeholder with icons that insert into it
for (const platform of PLATFORMS) {
  test(`an empty zone or plate is drawn with a placeholder of the editor only, which a save does not write (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: EMPTY, n: 0 });
    for (const n of [0, 1, 2]) {
      await page.evaluate(`Reveal.slide(${n})`);
      await frames(page);
      assert.equal(await shownPlaceholders(page), 1, `slide ${n} does not show one placeholder`);
      const labels = await page.evaluate(`[...document.querySelectorAll('${PLACEHOLDER} button')].map((b) => b.getAttribute('aria-label'))`);
      assert.deepEqual(labels, ['Insert Image', 'Insert Video', 'Insert Table', 'Insert QR Code']);
      const slot = await rect(page, '.reveal section.present :is(.zone, .plate)');
      const box = await rect(page, PLACEHOLDER);
      assert.ok(box.left >= slot.left - 0.5 && box.right <= slot.right + 0.5 && box.top >= slot.top - 0.5 && box.bottom <= slot.bottom + 0.5, `the placeholder at ${js(box)} is not inside its slot at ${js(slot)}`);
      // the icons are at the center of the slot
      const icon = await buttonOf(page, 'Insert Table');
      assert.ok(icon.x > slot.left + slot.width / 4 && icon.x < slot.right - slot.width / 4, 'the icons are not at the center of the slot');
      // the placeholder does not have text, since a slot with text is not empty
      assert.equal(await page.evaluate(`document.querySelector('${PLACEHOLDER}').textContent`), '');
    }
    // a thumbnail of the navigator does not draw the placeholder
    const thumb = await page.evaluate(`(() => {
      const hosts = [...document.querySelectorAll('.beeson-edit-nav *')].filter((h) => h.shadowRoot?.querySelector('.beeson-thumb'));
      return hosts.map((h) => [...h.shadowRoot.querySelectorAll('.beeson-placeholder')].filter((p) => p.getBoundingClientRect().width > 0).length);
    })()`);
    assert.ok(thumb.length >= 3, `the navigator draws ${thumb.length} thumbnails`);
    assert.deepEqual([...new Set(thumb)], [0]);
    assert.equal(await render(page), page.source);
    const { text } = await saveAndReopen(page, `r7-8-${++saves}.html`);
    assert.equal(text, page.source, 'the save of a deck with empty zones changed the file');
    assert.equal(await page.evaluate(`window.BeesonEditor.status().dirty`), false);
    assert.deepEqual(errors(page), []);
  });

  test(`the QR Code icon of a placeholder inserts a QR code into its zone, and an undo draws the placeholder again (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: EMPTY, n: 0 });
    await click(page, await buttonOf(page, 'Insert QR Code'));
    await page.waitFor(`!!document.querySelector('.reveal section.present .zone > .qr')`);
    await frames(page);
    assert.equal(await shownPlaceholders(page), 0);
    assert.equal(await undoLabel(page), 'Undo QR Code');
    await undo(page);
    await frames(page);
    await byteExact(page);
    assert.equal(await shownPlaceholders(page), 1);
    await redo(page);
    await frames(page);
    assert.equal(await shownPlaceholders(page), 0);
    const edited = await roundTrip(page);
    assert.match(edited, /<div class="zone">\s*<div class="qr" data-qr="https:\/\/example.com"><\/div>\s*<\/div>/);
  });

  test(`the Table icon of a placeholder inserts a table of the size chosen into its zone (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: EMPTY, n: 1 });
    await click(page, await buttonOf(page, 'Insert Table'));
    await page.waitFor(`!!document.querySelector('dialog.beeson-table-picker[open]')`);
    // the cell of the second row and the second column of the grid of 10 columns
    await click(page, await rect(page, '.beeson-table-picker .grid > :nth-child(12)'));
    await page.waitFor(`!!document.querySelector('.reveal section.present .zone > table')`);
    await frames(page);
    assert.deepEqual(await page.evaluate(`[...document.querySelector('.reveal section.present .zone > table').rows].map((r) => r.cells.length)`), [2, 2]);
    assert.equal(await shownPlaceholders(page), 0);
    assert.equal(await page.evaluate('document.activeElement.localName'), 'th');
    assert.equal(await undoLabel(page), 'Undo Insert Table');
    const edited = await roundTrip(page);
    assert.match(edited, /<div class="zone">\s*<table>\s*<tbody>\s*<tr><th><\/th><th><\/th><\/tr>\s*<tr><td><\/td><td><\/td><\/tr>\s*<\/tbody>\s*<\/table>\s*<\/div>/);
  });

  test(`the Image icon of a placeholder inserts the file chosen into its plate (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: EMPTY, n: 2 });
    await click(page, await buttonOf(page, 'Insert Image'));
    await page.waitFor(`!!document.querySelector('input.beeson-media-input')`);
    const { result } = await page.send('Runtime.evaluate', { expression: `document.querySelector('input.beeson-media-input')` });
    await page.send('DOM.setFileInputFiles', { files: [resolve('demo/figure-light.png')], objectId: result.objectId });
    await page.waitFor(`!!document.querySelector('.reveal section.present .plate > img')`);
    await frames(page);
    assert.equal(await shownPlaceholders(page), 0);
    // the entry is named as every insert, and the item of the Insert menu keeps its own label
    assert.equal(await undoLabel(page), 'Undo Insert Image');
    assert.equal((await state(page, 'insert.image')).label, 'Image…');
    const edited = await render(page);
    assert.equal(edited, page.source.replace('<div class="plate"></div>', '<div class="plate">\n    <img src="media/figure-light.png">\n  </div>'));
    await undo(page);
    await frames(page);
    await byteExact(page);
    assert.equal(await shownPlaceholders(page), 1);
    await redo(page);
    assert.equal(await render(page), edited);
    // a save of a new file asks for the folder of the deck, which editor-media.test.mjs stubs, hence
    // the text is opened again without a save
    assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(edited)})`)).problems, []);
    assert.deepEqual(errors(page), []);
  });

  test(`the Video icon of a placeholder inserts the file chosen into its zone, as the entry Insert Video (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: EMPTY, n: 0 });
    await click(page, await buttonOf(page, 'Insert Video'));
    await page.waitFor(`!!document.querySelector('input.beeson-media-input')`);
    const { result } = await page.send('Runtime.evaluate', { expression: `document.querySelector('input.beeson-media-input')` });
    await page.send('DOM.setFileInputFiles', { files: [resolve('demo/clip-dark.mp4')], objectId: result.objectId });
    await page.waitFor(`!!document.querySelector('.reveal section.present .zone > video')`);
    await frames(page);
    assert.equal(await shownPlaceholders(page), 0);
    assert.equal(await undoLabel(page), 'Undo Insert Video');
    assert.equal((await state(page, 'insert.video')).label, 'Video…');
    const edited = await render(page);
    assert.match(edited, /<div class="zone">\s*<video [^>]*src="media\/clip-dark\.mp4"[^>]*><\/video>\s*<\/div>/);
    await undo(page);
    await frames(page);
    await byteExact(page);
    assert.equal(await shownPlaceholders(page), 1);
    await redo(page);
    assert.equal(await render(page), edited);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.redo').enabled`), false);
    assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(edited)})`)).problems, []);
    assert.deepEqual(errors(page), []);
  });
}

// the deck of layouts of the mask tests, whose slide 3 has a dark image of 1200 by 1440 px in a
// zone of 600 by 800 px
const LAYOUTS = 'test/pages/editor-layouts.html';
const IMG = '.reveal section.present figure.zone img.for-dark';
const BAR = 'dialog.beeson-mask-bar';
const written = async (page) => (await render(page)).match(/<img class="for-dark"[^>]*?(?: style="([^"]*)")?>/)[1] ?? null;
const handlesShown = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-mask-window i')].filter((i) => getComputedStyle(i).display !== 'none').length`);
const pressed = (page) => page.evaluate(`[...document.querySelectorAll('${BAR} .modes button')].map((b) => b.title + ' ' + b.getAttribute('aria-pressed'))`);
const handleAt = (page, name) => rect(page, `.beeson-mask-window i[data-handle=${name}]`);

// the pixels of a PNG written by Chrome, with 8 bits per channel and without interlace, as in
// editor-r6-6.test.mjs
function decodePng(png) {
  let at = 8, width = 0, channels = 4;
  const data = [];
  while (at < png.length) {
    const length = png.readUInt32BE(at), kind = png.toString('ascii', at + 4, at + 8), body = png.subarray(at + 8, at + 8 + length);
    if (kind === 'IHDR') ({ width, channels } = { width: body.readUInt32BE(0), channels: body[9] === 6 ? 4 : 3 });
    if (kind === 'IDAT') data.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data)), stride = width * channels, height = raw.length / (stride + 1), px = Buffer.alloc(height * stride);
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
  return px;
}

// the mean difference of two captures of the same size, per channel
function differ(a, b) {
  const [x, y] = [decodePng(a), decodePng(b)];
  assert.equal(x.length, y.length);
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += Math.abs(x[i] - y[i]);
  return sum / x.length;
}

// the box of the image on the screen without its scale, inset by 12 px past the selection frame
const insetBox = (page) => page.evaluate(`(() => {
  const el = document.querySelector(${js(IMG)}), k = Reveal.getScale(), r = el.getBoundingClientRect();
  const w = el.offsetWidth * k, h = el.offsetHeight * k;
  return { x: Math.round(r.left + r.width / 2 - w / 2 + 12), y: Math.round(r.top + r.height / 2 - h / 2 + 12), width: Math.round(w - 24), height: Math.round(h - 24), scale: 1 };
})()`);

// the picture of the image after an edit captured inside its new box, and the same place after an
// undo, which differ by the resampling of the scaled picture only, i.e. less than the place shifted
// by 1 px in any direction. the edit is redone after the check
async function pictureKept(page, edited) {
  await press(page, 'Escape');
  await click(page, '.reveal section.present h2');
  await frames(page);
  const box = await insetBox(page);
  const after = await page.screenshot(box);
  await undo(page);
  await frames(page);
  await byteExact(page);
  const before = await page.screenshot(box);
  const kept = differ(after, before);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const shift = differ(await page.screenshot({ ...box, x: box.x + dx, y: box.y + dy }), after);
    assert.ok(kept < shift, `the picture moved: ${kept} in place against ${shift} shifted by ${dx}, ${dy} px`);
  }
  await redo(page);
  assert.equal(await render(page), edited);
}

async function editMask(page) {
  await click(page, IMG, { count: 2 });
  await page.waitFor(`!!document.querySelector('${BAR}[open]')`);
  assert.deepEqual(await pressed(page), ['Edit Image true', 'Edit Mask false']);
  assert.equal(await handlesShown(page), 0, 'the handles are drawn in Edit Image, where they do not resize');
  await click(page, `${BAR} button[title="Edit Mask"]`);
  assert.deepEqual(await pressed(page), ['Edit Image false', 'Edit Mask true']);
  assert.equal(await handlesShown(page), 8);
}

const RESIZED = /^scale: [\d.]+; clip-path: inset\([\d.]+%\); object-fit: contain; object-position: -?[\d.]+(%|px) -?[\d.]+(%|px); width: (\d+)px; height: (\d+)px(; translate: -?\d+px -?\d+px)?$/;

// state 138 of round 3: the frame of Edit Mask was drawn with eight handles that did not resize it,
// where Keynote resizes the mask with them and keeps the picture in place
for (const platform of PLATFORMS) {
  test(`in Edit Mask a handle resizes the box of an image, and the picture stays in place (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: LAYOUTS, n: 3 });
    await editMask(page);
    await drag(page, await handleAt(page, 'nw'), { dx: 120, dy: 90 });
    await press(page, 'Enter');
    assert.equal(await page.evaluate(`!!document.querySelector('${BAR}[open]')`), false);
    assert.equal(await undoLabel(page), 'Undo Edit Mask');
    const style = await written(page);
    const m = style?.match(RESIZED);
    assert.ok(m && m[5], `the style ${style} is not a resized mask with a translate`);
    assert.ok(+m[3] < 600 && +m[4] < 800, `the box of ${m[3]} by ${m[4]} px is not smaller than the zone`);
    const edited = await render(page);
    assert.equal(edited, page.source.replace('<img class="for-dark" src="../../demo/figure-dark.png" alt="A figure, dark version">', `<img class="for-dark" src="../../demo/figure-dark.png" alt="A figure, dark version" style="${style}">`));
    assert.deepEqual(textProblems(edited, THEME), textProblems(page.source, THEME), 'the resized mask is out of the scope rule');
    await pictureKept(page, edited);
    await roundTrip(page, edited);
  });

  test(`in Edit Mask a drag inside the box moves it over the picture, and Esc and Reset leave the image as it was (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: LAYOUTS, n: 3 });
    await editMask(page);
    await drag(page, await handleAt(page, 'se'), { dx: -150, dy: -150 });
    // Esc leaves the image as it was
    await press(page, 'Escape');
    assert.equal(await written(page), null);
    assert.equal(await render(page), page.source);
    // Reset puts the box back, and Done then does not write anything
    await editMask(page);
    await drag(page, await handleAt(page, 'e'), { dx: -100, dy: 0 });
    await click(page, `${BAR} button[title="The picture as it was before this edit"]`);
    await click(page, `${BAR} button.done`);
    assert.equal(await render(page), page.source);
    assert.equal(await page.evaluate(`document.querySelector(${js(IMG)}).getAttribute('style')`), null);
    // a box made smaller is moved over the picture by a drag inside it
    await editMask(page);
    await drag(page, await handleAt(page, 'se'), { dx: -150, dy: -150 });
    const shrunk = await rect(page, '.beeson-mask-window');
    await drag(page, shrunk, { dx: 60, dy: 70 });
    const moved = await rect(page, '.beeson-mask-window');
    assert.ok(Math.abs(moved.left - shrunk.left - 60) < 2 && Math.abs(moved.top - shrunk.top - 70) < 2, `the box moved from ${js(shrunk)} to ${js(moved)}`);
    assert.ok(Math.abs(moved.width - shrunk.width) < 1.5 && Math.abs(moved.height - shrunk.height) < 1.5, 'the move changed the size of the box');
    await click(page, `${BAR} button.done`);
    assert.equal(await undoLabel(page), 'Undo Edit Mask');
    const style = await written(page);
    const m = style?.match(RESIZED);
    assert.ok(m && m[5], `the style ${style} is not a resized mask with a translate`);
    const edited = await render(page);
    await pictureKept(page, edited);
    await roundTrip(page, edited);
    // Reset Mask takes the zoom and the place of the picture off, and keeps object-fit contain, without
    // which the theme stretches the picture to the box
    await click(page, IMG);
    await click(page, IMG);
    assert.equal((await state(page, 'image.resetMask')).enabled, true);
    await exec(page, 'image.resetMask');
    const reset = await written(page);
    assert.match(reset, /^object-fit: contain; width: \d+px; height: \d+px; translate: -?\d+px -?\d+px$/);
    assert.deepEqual(textProblems(await render(page), THEME), textProblems(page.source, THEME), 'the reset mask is out of the scope rule');
    assert.equal((await state(page, 'image.resetMask')).enabled, false);
    const fit = await page.evaluate(`getComputedStyle(document.querySelector(${js(IMG)})).objectFit`);
    assert.equal(fit, 'contain');
    await roundTrip(page);
  });
}
