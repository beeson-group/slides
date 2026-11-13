// regression tests of tables, media, and locked elements, on either platform with trusted input:
// a table inserted under the list of a full slide, the width of the Table pane, the text of merged
// cells, the controls of a locked element, and Capture Poster on a video of a deck opened from a
// file. after each edit the text is in the scope rule, an undo gives the file byte for byte, a
// redo gives the edit, and a save is opened again without problems

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, editorPage, press, saveAndReopen, selectFigure, type } from './helpers/editor.mjs';

const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const PANEL = '#beeson-edit-panel-format';
// the index of the slide "Figures are first class citizens, too" of index.html, whose list ends
// above the bottom of its figure
const FIGURES = 4;

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

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const js = (v) => JSON.stringify(v);
const settle = (page) => page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(window.BeesonEditor.status()))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

// the editor on a deck served over HTTP, with the Format tab shown, in a window of size
async function open(platform, { deck = 'test-deck.html', size } = {}) {
  const page = await browser.newPage(size);
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(status.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  return page;
}

async function show(page, h) {
  await page.evaluate(`Reveal.slide(${h})`);
  await sleep(150);
  await settle(page);
}

// the box of the first shown element of selector in CSS px of the viewport, or null
const boxOf = (page, selector) => page.evaluate(`(() => {
  const el = [...document.querySelectorAll(${js(selector)})].find((e) => e.getClientRects().length);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
})()`);

// the box of the text of the element of selector, without the white space of its box
const inkOf = (page, selector) => page.evaluate(`(() => {
  const range = document.createRange();
  range.selectNodeContents(document.querySelector(${js(selector)}));
  const r = range.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
})()`);

const inside = (a, b, what) => {
  const slack = 0.5;
  assert.ok(a.left >= b.left - slack && a.top >= b.top - slack && a.right <= b.right + slack && a.bottom <= b.bottom + slack, `${what}: ${js(a)} is not inside ${js(b)}`);
};
const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

let saves = 0;
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the edit did not change the text');
  const added = textProblems(edited, THEME);
  for (const p of textProblems(page.source, THEME)) if (added.includes(p)) added.splice(added.indexOf(p), 1);
  assert.deepEqual(added, [], 'the edit is out of the scope rule');
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  assert.equal((await settle(page)).undo, false, `the edit is more than ${undos} entries of the history`);
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r5-4-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  return edited;
}

// the window of the pictures of round 2 on the Mac, and a window of 1920 by 1080 elsewhere
const SIZES = { mac: { width: 1600, height: 1000 }, other: { width: 1920, height: 1080 } };

// state table-inserted of round 2: the table was put into the flow under the list, which its
// translate moves down, hence the bar of the columns covered the last line of the list, and the
// rows and the button Add Row ran past the bottom of the slide. a table of 2 rows fits under the
// list, and one of 3 rows is moved up over it, as tested in editor-r7-8.test.mjs
for (const platform of ['mac', 'other']) {
  test(`a table inserted under the list of a full slide is put in its free space, with its controls in the canvas (${platform})`, async (t) => {
    const page = await open(platform, { size: SIZES[platform] });
    t.after(() => page.close?.());
    await show(page, FIGURES);
    const li = '.reveal section.present ul > li:last-child';
    await click(page, li);
    await press(page, 'Escape');
    await exec(page, 'insert.table', { rows: 2, columns: 3 });
    await sleep(100);
    await settle(page);
    const slide = await boxOf(page, '.reveal section.present');
    const stage = await boxOf(page, '.beeson-edit-canvas');
    const table = await boxOf(page, '.reveal section.present table');
    const ink = await inkOf(page, li);
    const cols = await boxOf(page, '.beeson-table-bars .bar.cols');
    const figure = await boxOf(page, '.reveal section.present figure.figure-box');
    assert.ok(cols.top >= ink.bottom - 0.5, `the bar of the columns at ${cols.top} covers the list, whose text ends at ${ink.bottom}`);
    assert.ok(!meets(table, figure), 'the table covers the figure');
    inside(table, slide, 'the table');
    for (const name of ['Add Row', 'Add Column', 'Select Table']) inside(await boxOf(page, `.beeson-table-bars .round[title="${name}"]`), stage, name);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Insert Table');
    const edited = await roundTrip(page);
    assert.match(edited, /<table style="translate: 0px \d+px">/);
  });
}

// the controls of the Format tab that reach past the right edge of the inspector, with their text
const overflowing = (page) => page.evaluate(`(() => {
  const panel = document.querySelector('${PANEL}');
  const edge = panel.getBoundingClientRect().right - (panel.offsetWidth - panel.clientWidth);
  return [...panel.querySelectorAll('button, input, label, .ed-seg')]
    .filter((el) => el.getClientRects().length && el.getBoundingClientRect().right > edge + 0.5)
    .map((el) => el.textContent.trim() || el.getAttribute('aria-label') || el.localName);
})()`);

// states inspector-table and inspector-table-dark of round 2: the row Size of the Table pane put
// Distribute Evenly and Fit to Content beside its label, and Fit to Content was cut off at the
// right edge of the inspector
for (const platform of ['mac', 'other']) {
  test(`every control of the Table pane fits the width of the inspector (${platform})`, async (t) => {
    const page = await open(platform, { size: SIZES[platform] });
    t.after(() => page.close?.());
    await show(page, FIGURES);
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await sleep(100);
    await settle(page);
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} .ed-panes')?.dataset.pane`), 'table');
    assert.deepEqual(await overflowing(page), []);
    for (const id of ['table.distributeColumns', 'table.fitColumn']) {
      assert.equal(await page.evaluate(`document.querySelectorAll('${PANEL} [data-command="${id}"]').length`), 1, id);
    }
  });
}

// the deck of tables of the table tests: a table with a rowspan and a colspan on its first slide,
// a table of mass ratios on its second, and a first column set at the right in its first row on
// its third
const TABLES_DECK = 'test/pages/editor-tables.html';
const cellSelector = (r, c) => `.reveal section.present table tr:nth-child(${r + 1}) > :nth-child(${c + 1})`;
const centerOf = (page, selector) => boxOf(page, selector).then((b) => ({ x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 }));

async function dragCells(page, [r0, c0], [r1, c1]) {
  const from = await centerOf(page, cellSelector(r0, c0));
  const to = await centerOf(page, cellSelector(r1, c1));
  await drag(page, from, { dx: to.x - from.x, dy: to.y - from.y });
  await settle(page);
}

// the lines of the text of the cell of selector on the page, from the tops of its line boxes
const linesOf = (page, selector) => page.evaluate(`(() => {
  const range = document.createRange();
  range.selectNodeContents(document.querySelector(${js(selector)}));
  return new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
})()`);

// state table-merged of round 2: Merge Cells joined the text of the cells with spaces on one line,
// where PowerPoint and Keynote keep the text of each cell on a line of its own
for (const platform of ['mac', 'other']) {
  test(`Merge Cells keeps the text of each cell on a line of its own, in the order of reading (${platform})`, async (t) => {
    const page = await open(platform, { deck: TABLES_DECK });
    t.after(() => page.close?.());
    await show(page, 1);
    // Moon and the formula above Europa and 2.53e-5
    await dragCells(page, [1, 0], [2, 1]);
    if (platform === 'mac') await press(page, 'Ctrl+Mod+M');
    else await exec(page, 'table.merge');
    await sleep(120);
    await settle(page);
    await byteExact(page, [[
      '<tr><td>Moon</td><td>\\(0.01215\\)</td><td>Earth and Moon</td></tr>\n      <tr><td>Europa</td><td>2.53e-5</td><td>Jupiter</td></tr>',
      '<tr><td colspan="2" rowspan="2">Moon<br>\\(0.01215\\)<br>Europa<br>2.53e-5</td><td>Earth and Moon</td></tr>\n      <tr><td>Jupiter</td></tr>',
    ]]);
    assert.equal(await linesOf(page, '.reveal section.present td[rowspan]'), 4);
    assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('.reveal section.present td[rowspan]')).textAlign`), 'left');
    await roundTrip(page);
  });

  test(`a merged cell keeps the alignment of its first cell (${platform})`, async (t) => {
    const page = await open(platform, { deck: TABLES_DECK });
    t.after(() => page.close?.());
    await show(page, 2);
    // Halo, set at the right, above Lyapunov, set at the left
    await dragCells(page, [1, 0], [2, 0]);
    await exec(page, 'table.merge');
    await sleep(120);
    await settle(page);
    await byteExact(page, [[
      '<tr><td style="text-align: right">Halo</td><td>14.8</td></tr>\n      <tr><td>Lyapunov</td><td>2.69</td></tr>',
      '<tr><td style="text-align: right" rowspan="2">Halo<br>Lyapunov</td><td>14.8</td></tr>\n      <tr><td>2.69</td></tr>',
    ]]);
    assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('.reveal section.present td[rowspan]')).textAlign`), 'right');
    await roundTrip(page);
  });
}

// the controls of the Format tab other than its tabs, as text, command, and whether each is enabled
const controls = (page) => page.evaluate(`[...document.querySelectorAll('${PANEL} :is(button, input, textarea, select)')]
  .filter((e) => e.getAttribute('role') !== 'tab' && e.getClientRects().length)
  .map((e) => ({ name: e.textContent.trim() || e.getAttribute('aria-label') || e.name || e.type, command: e.dataset.command ?? null, on: !e.disabled }))`);

// the items of the open menu, as their text without the keys, and whether each is enabled
const menuItems = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu [role^=menuitem]')]
  .map((e) => ({ text: e.textContent.trim(), on: e.getAttribute('aria-disabled') !== 'true' }))`);

// the commands that change a figure, which a lock turns off
const CHANGES = [
  'media.replace', 'figure.alt', 'figure.decorative', 'figure.whiteFigure', 'figure.invert', 'figure.mode.dark', 'image.editMask', 'image.crop',
  'edit.cut', 'element.delete', 'selection.editText', 'arrange.align.left', 'arrange.order.back', 'arrange.flipHorizontal', 'arrange.nudge.left',
  'arrange.group', 'steps.add',
];
// the items of the context menu of a locked figure that do not change it
const KEPT = ['Copy', 'Paste', 'Duplicate', 'Save as Picture…', 'Unlock'];

// state locked-element of round 2: a figure locked with Lock kept Replace and the other controls
// of the Image pane, the align, flip, and order buttons of the Arrange pane, and the items of its
// context menu enabled, where Keynote turns off every control of a locked object but Unlock
for (const platform of ['mac', 'other']) {
  test(`a locked figure cannot be changed from the inspector, the menus, or its context menu until it is unlocked (${platform})`, async (t) => {
    const page = await open(platform, { size: SIZES[platform] });
    t.after(() => page.close?.());
    await show(page, FIGURES);
    const figure = '.reveal section.present figure.figure-box img';
    await selectFigure(page, figure);
    await settle(page);
    assert.equal((await state(page, 'media.replace')).enabled, true);
    await press(page, 'Mod+L');
    await settle(page);
    assert.equal(await page.evaluate(`document.querySelector('.reveal section.present figure.figure-box').hasAttribute('data-locked')`), true);
    assert.equal((await state(page, 'arrange.unlock')).enabled, true);
    assert.equal((await state(page, 'edit.copy')).enabled, true);
    for (const id of CHANGES) assert.equal((await state(page, id)).enabled, false, `${id} is enabled on a locked figure`);
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} .ed-panes')?.dataset.pane`), 'image');
    assert.deepEqual((await controls(page)).filter((c) => c.on), [], 'the Image pane has enabled controls');
    await click(page, `${PANEL} [role=tab]:last-child`);
    await settle(page);
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} .ed-panes')?.dataset.pane`), 'arrange');
    assert.deepEqual((await controls(page)).filter((c) => c.on).map((c) => c.command), ['arrange.unlock'], 'the Arrange pane has enabled controls other than Unlock');
    await click(page, figure, { button: 'right' });
    await settle(page);
    const on = (await menuItems(page)).filter((i) => i.on).map((i) => i.text);
    assert.ok(on.some((text) => text.startsWith('Unlock')), 'Unlock is not in the context menu');
    assert.deepEqual(on.filter((text) => !KEPT.some((k) => text.startsWith(k))), [], 'the context menu has enabled items that change the figure');
    await press(page, 'Escape');
    const edited = await roundTrip(page);
    assert.match(edited, /<figure class="figure-box" data-locked>/);
    // Unlock gives the controls back, on the figure selected again after the open of the save
    await click(page, figure);
    await settle(page);
    assert.equal((await state(page, 'media.replace')).enabled, false);
    await press(page, platform === 'mac' ? 'Mod+Alt+L' : 'Mod+Shift+L');
    await settle(page);
    assert.equal(await page.evaluate(`document.querySelector('.reveal section.present figure.figure-box').hasAttribute('data-locked')`), false);
    for (const id of ['media.replace', 'figure.whiteFigure', 'arrange.align.left', 'edit.cut']) assert.equal((await state(page, id)).enabled, true, `${id} is off after Unlock`);
    assert.ok((await controls(page)).filter((c) => c.on).length > 10, 'the Arrange pane is still off after Unlock');
  });
}

// the text of a locked block was still typed into after a double click, where Keynote keeps the
// text of a locked object as it is until an unlock
const LEAD = '<p>Design the complete slide first, then break it up into steps. Direct the viewer\'s attention.</p>';
for (const platform of ['mac', 'other']) {
  test(`the text of a locked block is not changed by typing until it is unlocked (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close());
    await show(page, 2);
    const lead = '.reveal section.present > p';
    await click(page, lead);
    await press(page, 'Escape');
    await press(page, 'Mod+L');
    await settle(page);
    const locked = page.source.replace(LEAD, LEAD.replace('<p>', '<p data-locked>'));
    assert.equal(await render(page), locked);
    await click(page, lead, { count: 2 });
    await type(page, 'XYZ');
    for (const key of ['Backspace', 'Delete', 'Enter']) await press(page, key);
    await press(page, 'Escape');
    await settle(page);
    const typed = await render(page);
    assert.ok(typed === locked, `the text of the locked block was changed: ${typed.match(/<p data-locked>.*<\/p>/)?.[0]}`);
    await click(page, lead);
    await press(page, platform === 'mac' ? 'Mod+Alt+L' : 'Mod+Shift+L');
    await settle(page);
    await byteExact(page);
    await click(page, lead, { count: 2 });
    await type(page, 'XYZ');
    await settle(page);
    assert.match(await render(page), /XYZ/, 'the unlocked block cannot be typed into');
    assert.deepEqual(errors(page), []);
  });
}

// the index of the slide "Embedding videos" of index.html, with a video for each mode
const VIDEOS = 10;
const clipOf = (mode) => `<video class="for-${mode}" src="demo/clip-${mode}.mp4" poster="demo/clip-${mode}.png" muted loop data-autoplay></video>`;

// a trusted click on the button of the Format tab with the text name
async function tap(page, name) {
  const at = await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('${PANEL} button')].find((b) => b.textContent.trim() === ${js(name)});
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(at, `the inspector does not have a button ${name}`);
  await click(page, at);
}

// the file at path given to the open file chooser of the editor, as a person picks it
async function choose(page, path) {
  await page.waitFor(`!!document.querySelector('input.beeson-media-input')`);
  const { result } = await page.send('Runtime.evaluate', { expression: `document.querySelector('input.beeson-media-input')` });
  await page.send('DOM.setFileInputFiles', { files: [path], objectId: result.objectId });
}

const ASK = 'dialog.beeson-edit-card.beeson-poster-ask[open]';

// state video-capture-poster of round 2: in a deck opened from a file, the page has an origin of
// its own, which the video of the folder does not share, hence the browser kept the frames of the
// video from the page, and Capture Poster failed with a message in the title bar
for (const platform of ['mac', 'other']) {
  test(`Capture Poster on a video of a deck opened from a file asks once for its file and writes its first frame (${platform})`, async (t) => {
    const page = await editorPage(browser, { query: `edit&still&edit-platform=${platform}` });
    t.after(() => page.close?.());
    assert.match(await page.evaluate('location.protocol'), /^file:$/);
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await show(page, VIDEOS);
    // the video of the mode of the slide, and its file
    const mode = await page.evaluate(`[...document.querySelectorAll('.reveal section.present video')].find((v) => v.getClientRects().length && v.getBoundingClientRect().width).classList.contains('for-dark') ? 'dark' : 'light'`);
    const video = `.reveal section.present video.for-${mode}`;
    const clip = `clip-${mode}`;
    await click(page, video);
    await settle(page);
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} .ed-panes')?.dataset.pane`), 'video');
    const button = await page.evaluate(`[...document.querySelectorAll('${PANEL} [data-command="media.poster"]')].map((b) => [b.textContent.trim(), b.title])[0]`);
    const before = (await page.evaluate('window.BeesonEditor.status()')).message;
    await click(page, `${PANEL} [data-command="media.poster"]`);
    const asked = await page.waitFor(`!!document.querySelector(${js(ASK)}) || window.BeesonEditor.status().message !== ${js(before)}`, 8000).then(() => page.evaluate(`document.querySelector(${js(ASK)})?.textContent ?? null`));
    assert.ok(asked, `Capture Poster did not ask for the file: ${(await page.evaluate('window.BeesonEditor.status()')).message}`);
    assert.ok(asked.includes(`${clip}.mp4`), asked);
    // the button says that it asks for the file
    assert.equal(button[0], 'Capture Poster…');
    assert.match(button[1], /asks once for the file/);
    // a chooser opened by a trusted click is cancelled at once in headless Chrome unless the
    // protocol intercepts it, and the input then keeps waiting for its files
    await page.send('Page.setInterceptFileChooserDialog', { enabled: true });
    await click(page, `${ASK} button.primary`);
    await choose(page, resolve(`demo/${clip}.mp4`));
    await page.waitFor(`window.BeesonEditor.render().includes('poster="media/${clip}.png"')`);
    const captured = page.source.replace(clipOf(mode), clipOf(mode).replace(`poster="demo/${clip}.png"`, `poster="media/${clip}.png"`));
    assert.equal(await render(page), captured);
    assert.doesNotMatch((await page.evaluate('window.BeesonEditor.status()')).message ?? '', /cannot/);
    assert.deepEqual(textProblems(captured, THEME).filter((p) => !textProblems(page.source, THEME).includes(p)), []);
    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
    await page.evaluate('window.BeesonEditor.redo()');
    assert.equal(await render(page), captured);
    // a second capture reads the file chosen before, without asking again
    await page.evaluate('window.BeesonEditor.undo()');
    await click(page, video);
    await settle(page);
    await tap(page, 'Capture Poster');
    await page.waitFor(`window.BeesonEditor.render().includes('poster="media/${clip}')`);
    assert.equal(await page.evaluate(`!!document.querySelector(${js(ASK)})`), false);
    assert.deepEqual(errors(page), []);
  });
}
