// regression tests of R31.2 on both platforms with trusted input. item 5 of the check of R27.2: a
// Height typed into the Arrange pane for a figure with a caption, which no whole width gives, reads
// the nearest height that a width gives. items 1 and 2 of the same check: Format > Table lists the
// fit commands in the order of the cell menu, and Resize Column to Fit Content fits every column of
// a table selected as an object, as Keynote does

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
// the index of the figures slide in index.html, i.e. slide 5
const FIGURES = 4;
const IMG = '.reveal section.present figure img.for-light';
const DECK = 'test/pages/editor-r31-2.html';
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
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : ', ' + js(arg)})).then(() => true)`);
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

async function load(t, platform, deck, slide) {
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

// the height that the field Height reads at each whole width from 1 to most px of the images of the
// figure of img: the height of the picture with the height that its caption adds, as the editor
// measures them, where the picture of an image with object-fit contain is fitted into its box. a
// picture drawn smaller than its box keeps the ratio of the box, written as a height with
// object-fit contain, and the letterbox under the picture is added. the first entry tells whether
// the box is kept. the widths written in the page are put back
const heightsAt = (page, img, most) => page.evaluate(`(() => {
  const i = document.querySelector(${js(img)});
  const f = i.closest('figure');
  const all = [...f.querySelectorAll('img')];
  const kept = all.map((o) => [o.style.width, o.style.height, o.style.objectFit]);
  const k = Reveal.getScale();
  const fit = getComputedStyle(i).objectFit === 'contain';
  const s = Math.min(i.offsetWidth / i.naturalWidth, i.offsetHeight / i.naturalHeight);
  const ratio = fit && (i.offsetWidth - s * i.naturalWidth > 0.5 || i.offsetHeight - s * i.naturalHeight > 0.5) ? i.offsetHeight / i.offsetWidth : 0;
  const out = [!!ratio];
  for (let w = 1; w <= ${most}; w++) {
    for (const o of all) {
      o.style.width = w + 'px';
      if (ratio) Object.assign(o.style, { height: Math.round(w * ratio) + 'px', objectFit: 'contain' });
    }
    const a = i.getBoundingClientRect();
    const boxes = [a, ...[...f.querySelectorAll(':scope > figcaption')].map((c) => c.getBoundingClientRect())];
    const box = Math.max(...boxes.map((b) => b.bottom)) - Math.min(...boxes.map((b) => b.top));
    const picture = fit ? Math.min(i.offsetWidth / i.naturalWidth, i.offsetHeight / i.naturalHeight) * i.naturalHeight : i.offsetHeight;
    out.push(picture + (i.offsetHeight - picture) / 2 + Math.max(0, box - a.height) / k);
  }
  all.forEach((o, n) => ([o.style.width, o.style.height, o.style.objectFit] = kept[n]));
  return out;
})()`);

// the nearest height to h that a whole width gives, and the smallest width that gives it. a kept
// box may be 2 px higher or lower than its ratio gives, which reaches 1 px either side
function nearest(map, h) {
  let best = null;
  for (let w = 1; w < map.length; w++) {
    const d = Math.max(0, Math.abs(Math.round(map[w]) - h) - (map[0] ? 1 : 0));
    if (!best || d < best.d) best = { w, h: Math.round(map[w]), d };
  }
  return best;
}

// the decks of the item, with the slide of the figure, its image, the typed heights, and the width
// and height that the brief gives where no width gives the typed height
const FIGURE_CASES = [
  ['index.html', FIGURES, IMG, [[200, { w: 159, h: 564 }], [422, { w: 159, h: 564 }], [496, { w: 159, h: 564 }], [437], [570]]],
  [DECK, 0, '.reveal section.present figure img', [[200, { w: 116, h: 410 }], [311], [385], [422]]],
];

for (const platform of PLATFORMS) {
  for (const [deck, slide, img, cases] of FIGURE_CASES) {
    // item 5 of the check of R27.2: the search tried only a few widths, hence a typed 200 read 562
    // at width 165 on slide 5, where width 200 gives 554
    test(`a typed Height that no width gives reads the nearest height, at the smaller width of two (${deck}, ${platform})`, async (t) => {
      const page = await load(t, platform, deck, slide);
      await click(page, img);
      await sleep(100);
      const map = await heightsAt(page, img, 800);
      for (const [h, want] of cases) {
        const near = nearest(map, h);
        await typeField(page, 'height', h);
        const read = await size(page);
        assert.equal(Math.abs(read.h - h), near.d, `a typed Height of ${h} reads ${read.w} by ${read.h}, where width ${near.w} gives ${near.h}`);
        if (want) assert.deepEqual(read, want, `a typed Height of ${h}`);
        if (near.d > 0) assert.equal(read.w, near.w, `a typed Height of ${h} reads ${read.w} by ${read.h}, where the smaller width ${near.w} gives ${near.h}`);
        assert.equal((await state(page, 'edit.undo')).label, 'Undo Size');
        await undo(page);
        await byteExact(page);
        assert.equal((await state(page, 'edit.undo')).enabled, false, `a typed Height of ${h} is more than one entry of the history`);
      }
      assert.deepEqual(errors(page), []);
    });
  }

  test(`a typed Height that no width gives is solved in less than 100 ms on slide 5, and undone, redone, and saved byte for byte (${platform})`, async (t) => {
    const page = await load(t, platform, 'index.html', FIGURES);
    await click(page, IMG);
    await sleep(100);
    const times = [];
    for (const h of [200, 422, 496, 437]) {
      times.push(await page.evaluate(`(() => { const t0 = performance.now(); window.BeesonEditor.exec('arrange.setSize', { h: ${h} }); return performance.now() - t0; })()`));
      await undo(page);
      await byteExact(page);
    }
    times.sort((a, b) => a - b);
    assert.ok(times[1] < 100, `a typed height took ${times.map((x) => x.toFixed(0)).join(', ')} ms`);
    await typeField(page, 'height', 422);
    const edited = await render(page);
    await undo(page);
    await byteExact(page);
    await redo(page);
    assert.equal(await render(page), edited);
    const { text } = await saveAndReopen(page, `r31-2-height-${platform}.html`);
    assert.equal(text, edited);
    assert.deepEqual(errors(page), []);
  });
}

const cell = (r, c) => `.reveal section.present table tr:nth-child(${r + 1}) > :nth-child(${c + 1})`;
const FIT = /distribute|fit/i;
// the commands of the fit and distribute items of Format > Table, and of the open cell menu
const formatTable = (page) => page.evaluate(`window.BeesonEditorShell.menuItems('Format', 'Table').map((i) => i.command).filter((c) => c && ${FIT}.test(c))`);
const cellMenu = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu.cell .item .label')].map((l) => l.textContent).filter((l) => ${FIT}.test(l))`);

// the table of the slide selected as an object, from a cell, with Esc twice
async function selectTable(page) {
  await click(page, cell(1, 0));
  await sleep(100);
  await press(page, 'Escape');
  await sleep(100);
  await press(page, 'Escape');
  await sleep(100);
  assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((e) => e.localName)'), ['table']);
}
// the width written in the style of each cell of the first row of the table of slide n of text
const widths = (text, n) => [...text.split('<section')[n + 1].split('</tr>')[0].matchAll(/<t[hd][^>]*>/g)].map((m) => /width: (\d+)px/.exec(m[0])?.[1] ?? null).map((w) => (w ? Number(w) : null));
// the lines of the words of each cell of the second row of the table of the slide
const lines = (page) => page.evaluate(`[...document.querySelectorAll(${js(cell(1, 0).replace(':nth-child(1)', '*'))})].map((c) => {
  const r = document.createRange();
  r.selectNodeContents(c);
  return new Set([...r.getClientRects()].map((b) => Math.round(b.top))).size;
})`);

for (const platform of PLATFORMS) {
  // item 2 of the check of R27.2: Format > Table listed Resize Column before Resize Row, and the
  // cell menu Resize Row before Resize Column
  test(`Format > Table lists the fit commands in the order of the cell menu (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, 1);
    await click(page, cell(1, 0));
    await sleep(100);
    await click(page, cell(1, 0), { button: 'right' });
    await page.waitFor(`!!document.querySelector('.beeson-edit-menu.cell')`);
    assert.deepEqual(await cellMenu(page), ['Distribute Rows Evenly', 'Distribute Columns Evenly', 'Resize Row to Fit Content', 'Resize Column to Fit Content']);
    await press(page, 'Escape');
    assert.deepEqual(await formatTable(page), ['table.distributeRows', 'table.distributeColumns', 'table.fitRow', 'table.fitColumn']);
    assert.deepEqual(errors(page), []);
  });

  // the same check: with the table selected as an object, Resize Column to Fit Content was dimmed,
  // where Keynote resizes every column of the table
  test(`Resize Column to Fit Content fits every column of a table selected as an object, as one entry of the history (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, 1);
    assert.ok((await lines(page)).some((n) => n > 1), 'a cell of the second row is on one line before the fit');
    await selectTable(page);
    assert.equal((await state(page, 'table.fitColumn')).enabled, true, 'Resize Column to Fit Content is dimmed with the table selected');
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} .ed-panes')?.dataset.pane`), 'table');
    const at = await page.evaluate(`(() => { const b = document.querySelector('${PANEL} button[data-command="table.fitColumn"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, disabled: b.disabled || b.getAttribute('aria-disabled') === 'true' }; })()`);
    assert.ok(at && !at.disabled, 'the button Fit to Content of the Columns section is dimmed');
    await click(page, at);
    await sleep(150);
    const edited = await render(page);
    const [a, b] = widths(edited, 1);
    assert.ok(a > 90 && b > 90, `the columns are not fitted: ${js([a, b])}`);
    assert.deepEqual(await lines(page), [1, 1], 'a cell of the second row is not on one line');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Resize Column to Fit Content');
    await undo(page);
    await byteExact(page);
    assert.equal((await state(page, 'edit.undo')).enabled, false, 'the fit is more than one entry of the history');
    await redo(page);
    assert.equal(await render(page), edited);
    const { text } = await saveAndReopen(page, `r31-2-fit-${platform}.html`);
    assert.equal(text, edited);
    assert.deepEqual(errors(page), []);
  });

  // found with the test above: the width of the widest text was written rounded to the nearest px,
  // and a px less wrapped Distant retrograde onto two lines
  test(`Resize Column to Fit Content sets the widest text of the column of the caret on one line (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, 1);
    await click(page, cell(1, 0));
    await sleep(100);
    await exec(page, 'table.fitColumn');
    await sleep(100);
    assert.deepEqual(await lines(page), [1, 1], 'Distant retrograde is not on one line');
    assert.equal(widths(await render(page), 1)[1], 90, 'another column changed');
    await undo(page);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`Resize Column to Fit Content of Format > Table fits every column of a table selected as an object, and is dimmed on a table without a column to fit (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, 1);
    await selectTable(page);
    const item = (await page.evaluate(`window.BeesonEditorShell.menuItems('Format', 'Table')`)).find((i) => i.command === 'table.fitColumn');
    assert.ok(item, 'Format > Table does not have Resize Column to Fit Content');
    await exec(page, 'table.fitColumn');
    await sleep(100);
    const [a, b] = widths(await render(page), 1);
    assert.ok(a > 90 && b > 90, `the columns are not fitted: ${js([a, b])}`);
    await undo(page);
    await byteExact(page);
    await page.evaluate('Reveal.slide(2)');
    await frames(page);
    await selectTable(page);
    assert.equal((await state(page, 'table.fitColumn')).enabled, false, 'the command is not dimmed on a table whose first row is one merged cell');
    assert.deepEqual(errors(page), []);
  });
}
