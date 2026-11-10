// tests of R7.8 on both platforms with trusted input: every row of a new table kept, a placeholder
// with icons in an empty zone that is drawn by the editor only, a mask resized by its handles, and
// a sort of the rows of a table. after each edit the text is checked byte for byte, after an undo
// and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { numberOf, sortOrder } from '../src/editor/table.ts';
import { byteExact, click, press, saveAndReopen } from './helpers/editor.mjs';

const DECK = 'index.html';
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
    assert.equal(await undoLabel(page), 'Undo Image');
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
}
