// regression tests of R27.2 on both platforms with trusted input. finding 81 of the judge qwen3 in
// round 9: a height typed into the size field of a figure with a caption reads back as typed, a
// height typed back gives the file back, and a value equal to the shown one is not an entry of the
// history. the second half of finding 83: Resize Row to Fit Content takes the written height off the
// rows, from the cell menu, the Table pane, and Format > Table. a nit of the same report: the Slide
// menu prints the keys of Duplicate Slide and Delete Slide where the keys run them

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
// the index of the figures slide in index.html, i.e. slide 5
const FIGURES = 4;
const IMG = 'section.present figure img.for-light';
const ROWS = 'test/pages/editor-r27-2.html';
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
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const sleep = (ms) => new Promise((d) => setTimeout(d, ms));
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

async function load(t, platform, deck = 'index.html', slide = FIGURES) {
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
const size = async (page) => ({ w: await fieldValue(page, 'width'), h: await fieldValue(page, 'height') });

// the aspect of the drawn picture of the image of the figure: the picture fitted into the image box
// by object-fit, else the image box
const pictureAspect = (page) => page.evaluate(`(() => {
  const img = document.querySelector(${js(`.reveal ${IMG}`)});
  const r = img.getBoundingClientRect();
  const k = getComputedStyle(img).objectFit === 'contain' ? Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight) : 0;
  return k ? img.naturalWidth / img.naturalHeight : r.width / r.height;
})()`);
// the aspect of demo/figure-light.png, 1200 by 1440 px
const NATURAL = 1200 / 1440;

for (const platform of PLATFORMS) {
  // finding 81: a Height of 700 and then of 875 left 633 by 875, and a typed Width of 600 then
  // moved the caption by 80 px
  test(`a typed Height of 700 and then of 875 gives back 600 by 875 and the file byte for byte (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, `.reveal ${IMG}`);
    assert.deepEqual(await size(page), { w: 600, h: 875 });
    await typeField(page, 'height', 700);
    assert.equal(await fieldValue(page, 'height'), 700);
    assert.ok(Math.abs((await pictureAspect(page)) - NATURAL) < 0.01, 'the typed height did not keep the aspect of the picture');
    const at700 = await render(page);
    await typeField(page, 'height', 875);
    assert.deepEqual(await size(page), { w: 600, h: 875 });
    assert.equal(await render(page), page.source, 'the height typed back did not give the file back');
    // a Width typed as the field shows it changes nothing and is not an entry of the history
    await typeField(page, 'width', 600);
    assert.deepEqual(await size(page), { w: 600, h: 875 });
    await byteExact(page);
    await undo(page);
    assert.equal(await render(page), at700, 'the first undo did not take off the typed height of 875');
    await undo(page);
    await byteExact(page);
    assert.equal((await state(page, 'edit.undo')).enabled, false, 'the values typed are more than two entries of the history');
    await redo(page);
    await redo(page);
    await byteExact(page);
    assert.deepEqual(await size(page), { w: 600, h: 875 });
    assert.deepEqual(errors(page), []);
  });

  test(`a typed Height of a figure with a caption reads back as typed, with the aspect of the picture kept (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, `.reveal ${IMG}`);
    // a width 1 px wider adds 1.2 px to the picture. no whole width gives 820, which lies between
    // the heights at the widths 587 and 588 px, hence it is read 1 px off. each other height is
    // given by a whole width, also 600, which the widths 197, 238, 280, and 321 px give
    for (const [h, off] of [[610, 0], [700, 0], [820, 1], [900, 0], [600, 0]]) {
      await typeField(page, 'height', h);
      const read = await fieldValue(page, 'height');
      assert.ok(Math.abs(read - h) <= off, `a typed Height of ${h} reads ${read}`);
      assert.ok(Math.abs((await pictureAspect(page)) - NATURAL) < 0.01, `a typed Height of ${h} did not keep the aspect of the picture`);
    }
    // a Height typed after a Width is solved with the caption at the width that the solve reaches
    await typeField(page, 'width', 500);
    assert.equal(await fieldValue(page, 'width'), 500);
    assert.ok(Math.abs((await pictureAspect(page)) - NATURAL) < 0.01, 'a typed Width did not keep the aspect of the picture');
    await typeField(page, 'height', 760);
    assert.equal(await fieldValue(page, 'height'), 760);
    const edited = await render(page);
    const { text } = await saveAndReopen(page, `r27-2-height-${platform}.html`);
    assert.equal(text, edited);
    assert.deepEqual(errors(page), []);
  });

  // the repair of R27.2: the solve stayed on the wrap of the caption where it started, and a height
  // that a whole px of width gives on another wrap read 1 px off, e.g. a typed 750 read 751 at
  // width 488, where width 529 gives 750
  test(`a typed Height that a whole px of width gives reads back as typed, also on another wrap of the caption (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, `.reveal ${IMG}`);
    for (const [h, w] of [[750, 529], [600, 321], [790, 521], [568, 253], [648, 154]]) {
      await typeField(page, 'width', w);
      assert.equal(await fieldValue(page, 'height'), h, `a typed Width of ${w} does not give ${h}`);
      await undo(page);
      await byteExact(page);
      await typeField(page, 'height', h);
      const read = await size(page);
      assert.equal(read.h, h, `a typed Height of ${h} reads ${read.w} by ${read.h}`);
      assert.ok(Math.abs((await pictureAspect(page)) - NATURAL) < 0.01, `a typed Height of ${h} did not keep the aspect of the picture`);
      await undo(page);
      await byteExact(page);
    }
    assert.deepEqual(errors(page), []);
  });

  test(`a value typed as a size field shows it is not an entry of the history (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, `.reveal ${IMG}`);
    await typeField(page, 'width', 600);
    await typeField(page, 'height', 875);
    await byteExact(page);
    assert.equal((await state(page, 'edit.undo')).enabled, false);
    await typeField(page, 'height', 700);
    const at700 = await render(page);
    const shown = await size(page);
    await typeField(page, 'height', 700);
    await typeField(page, 'width', shown.w);
    assert.equal(await render(page), at700);
    await undo(page);
    await byteExact(page);
    assert.equal((await state(page, 'edit.undo')).enabled, false);
    assert.deepEqual(errors(page), []);
  });
}

// the height of each row of the table of the slide, in slide px
const rows = (page) => page.evaluate(`(() => {
  const k = Reveal.getScale();
  return [...document.querySelectorAll('.reveal section.present table tr')].map((tr) => Math.round(tr.getBoundingClientRect().height / k));
})()`);
const cell = (r, c) => `.reveal section.present table tr:nth-child(${r + 1}) > :nth-child(${c + 1})`;

// the labels of the items of the open cell menu, and the point and the state of one of them
const cellMenu = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu.cell .item .label')].map((l) => l.textContent)`);
const itemOf = (page, menu, label) => page.evaluate(`(() => {
  const b = [...document.querySelectorAll('.beeson-edit-menu${menu} .item')].find((b) => b.getClientRects().length && b.querySelector('.label')?.textContent === ${js(label)});
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.left + 20, y: r.top + r.height / 2, enabled: b.getAttribute('aria-disabled') !== 'true' };
})()`);

const FIT_MOON = ['<tr style="height: 160px"><td>Moon</td>', '<tr><td>Moon</td>'];
const FIT_EUROPA = ['<td style="height: 140px">Europa</td>', '<td>Europa</td>'];

for (const platform of PLATFORMS) {
  // finding 83, its second half: the cell menu had Resize Column to Fit Content and not the row
  // command of Keynote
  test(`Resize Row to Fit Content of the cell menu fits the row of the caret to its content (${platform})`, async (t) => {
    const page = await load(t, platform, ROWS, 0);
    const before = await rows(page);
    assert.ok(before[1] >= 160 && before[2] >= 140, `the written heights are not drawn: ${js(before)}`);
    await click(page, cell(1, 0));
    await click(page, cell(1, 0), { button: 'right' });
    await page.waitFor(`!!document.querySelector('.beeson-edit-menu.cell')`);
    const labels = await cellMenu(page);
    const i = labels.indexOf('Resize Row to Fit Content');
    assert.ok(i >= 0, `the cell menu does not have Resize Row to Fit Content: ${labels.join(', ')}`);
    assert.ok(Math.abs(i - labels.indexOf('Resize Column to Fit Content')) === 1, `the row item is not beside the column item: ${labels.join(', ')}`);
    const item = await itemOf(page, '.cell', 'Resize Row to Fit Content');
    assert.ok(item.enabled);
    await click(page, item);
    await sleep(150);
    await byteExact(page, [FIT_MOON]);
    const after = await rows(page);
    assert.ok(after[1] < 100 && Math.abs(after[1] - after[3]) <= 2, `the row is not fitted to its content: ${js(after)}`);
    assert.equal(after[2], before[2], 'another row changed');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Resize Row to Fit Content');
    await undo(page);
    await byteExact(page);
    assert.equal((await state(page, 'edit.undo')).enabled, false);
    await redo(page);
    await byteExact(page, [FIT_MOON]);
    const edited = await render(page);
    const { text } = await saveAndReopen(page, `r27-2-row-${platform}.html`);
    assert.equal(text, edited);
    assert.deepEqual(errors(page), []);
  });

  test(`the menu of a row bar has Resize Row to Fit Content, as the menu of a column bar has the column command (${platform})`, async (t) => {
    const page = await load(t, platform, ROWS, 0);
    await click(page, cell(1, 0));
    await sleep(100);
    await click(page, '.beeson-table-bars .bar.rows > [data-index="1"]', { button: 'right' });
    await sleep(100);
    const item = await itemOf(page, '', 'Resize Row to Fit Content');
    assert.ok(item?.enabled, 'the menu of the row bar does not have Resize Row to Fit Content');
    await click(page, item);
    await sleep(150);
    await byteExact(page, [FIT_MOON]);
    assert.deepEqual(errors(page), []);
  });

  test(`Resize Row to Fit Content of the Table pane fits the rows of a range, as one entry of the history (${platform})`, async (t) => {
    const page = await load(t, platform, ROWS, 0);
    if (!(await state(page, 'shell.format')).checked) await page.evaluate(`window.BeesonEditor.exec('shell.format')`);
    await click(page, cell(1, 1));
    await click(page, cell(2, 1), { modifiers: 'Shift' });
    await sleep(100);
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} .ed-panes')?.dataset.pane`), 'table');
    const at = await page.evaluate(`(() => { const b = document.querySelector('${PANEL} button[data-command="table.fitRow"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, title: b.title || b.getAttribute('aria-label') || b.textContent }; })()`);
    assert.ok(at, 'the Table pane does not have Resize Row to Fit Content');
    assert.equal(at.title, 'Resize Row to Fit Content');
    await click(page, at);
    await sleep(150);
    await byteExact(page, [FIT_MOON, FIT_EUROPA]);
    const after = await rows(page);
    assert.ok(Math.abs(after[1] - after[3]) <= 2 && Math.abs(after[2] - after[3]) <= 2, `the rows are not fitted: ${js(after)}`);
    await undo(page);
    await byteExact(page);
    assert.equal((await state(page, 'edit.undo')).enabled, false, 'the fit is more than one entry of the history');
    assert.deepEqual(errors(page), []);
  });

  test(`Format > Table has Resize Row to Fit Content, dimmed on a row without a written height (${platform})`, async (t) => {
    const page = await load(t, platform, ROWS, 0);
    await click(page, cell(3, 0));
    await sleep(100);
    assert.equal((await state(page, 'table.fitRow')).enabled, false, 'the command is not dimmed on a row without a height');
    await click(page, cell(2, 0));
    await sleep(100);
    assert.equal((await state(page, 'table.fitRow')).enabled, true);
    assert.equal((await state(page, 'table.fitRow')).label, 'Resize Row to Fit Content');
    await click(page, await page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent === 'Format').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
    const table = await itemOf(page, '', 'Table');
    assert.ok(table, 'the Format menu does not have Table');
    await click(page, table);
    await sleep(100);
    const item = await itemOf(page, '', 'Resize Row to Fit Content');
    assert.ok(item?.enabled, 'Format > Table does not have Resize Row to Fit Content');
    await click(page, item);
    await sleep(150);
    await byteExact(page, [FIT_EUROPA]);
    assert.deepEqual(errors(page), []);
  });
}

// the keys printed beside the items of labels in the menu bar of bar
async function keysIn(page, bar, labels) {
  const i = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].findIndex((b) => b.textContent === ${js(bar)})`);
  await click(page, `.beeson-edit-menubar [role=menuitem]:nth-child(${i + 1})`);
  const items = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => ({ label: i.querySelector('.label')?.textContent, keys: i.querySelector('.keys')?.textContent ?? '' }))`);
  await page.evaluate('window.BeesonEditorShell.closeMenus(); true');
  return Object.fromEntries(labels.map((l) => [l, items.find((i) => i.label === l)?.keys]));
}
const count = (page) => page.evaluate(`document.querySelectorAll('.reveal .slides > section').length`);

for (const platform of PLATFORMS) {
  // a nit of qwen3 in round 9: with the focus on a row of the navigator, the Slide menu printed no
  // key beside Duplicate Slide and Delete Slide, which the keys run there
  test(`the Slide menu prints the keys of Duplicate Slide and Delete Slide where the keys run them (${platform})`, async (t) => {
    const page = await load(t, platform);
    const mac = platform === 'mac';
    const dup = mac ? '⌘D' : 'Ctrl+D';
    const del = mac ? '⌫' : 'Delete';
    await click(page, `.reveal ${IMG}`);
    assert.deepEqual(await keysIn(page, 'Slide', ['Duplicate Slide', 'Delete Slide']), { 'Duplicate Slide': '', 'Delete Slide': '' }, 'with a figure selected, the keys run Duplicate and Delete of the figure');
    await click(page, '.beeson-edit-nav .row:nth-child(5)');
    await sleep(100);
    assert.deepEqual(await keysIn(page, 'Slide', ['Duplicate Slide', 'Delete Slide']), { 'Duplicate Slide': dup, 'Delete Slide': del });
    assert.deepEqual(await keysIn(page, 'Edit', ['Duplicate', 'Delete']), { Duplicate: dup, Delete: del });
    const n = await count(page);
    await press(page, 'Mod+D');
    await sleep(200);
    assert.equal(await count(page), n + 1, 'the key did not duplicate the slide');
    await press(page, mac ? 'Backspace' : 'Delete');
    await sleep(200);
    assert.equal(await count(page), n, 'the key did not delete the slide');
    assert.deepEqual(errors(page), []);
  });
}
