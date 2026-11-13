// tests of R20.1 on both platforms with trusted input: the plot features cut from the editor. a
// div.plot of a deck is an opaque figure, which is selected, moved, duplicated, deleted, locked,
// and given a step as other figures are. its JSON block is not written by the editor

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, center, click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATE_SLIDE = 8;
const ZONE_SLIDE = 12;
const SLIDE = '.reveal .slides > section.present';
const PLATE = '<div class="plot plate" data-plot="plate-plot">';
const ZONE = '<div class="plot zone" data-plot="zone-plot">';
const BLOCK = '<script type="application/json" id="zone-plot">';
const STEP = '<span class="fragment" data-fragment-index="2" data-plot-show="right"></span>';
const IDS = ['plot.editData', 'plot.setData', 'plot.addRow', 'plot.deleteRow', 'plot.addSeries', 'plot.deleteSeries', 'plot.moveSeriesLeft', 'plot.moveSeriesRight', 'plot.moveSeries', 'plot.addTab', 'plot.deleteTab', 'plot.pasteCells', 'plot.clearCells', 'plot.title', 'plot.range', 'plot.scale', 'plot.unit', 'plot.axes', 'plot.tone', 'insert.plot', 'plot.closeData'];

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
const wait = (page, ms = 300) => page.evaluate(`new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), ${ms}))`);
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const title = (page) => page.evaluate(`document.querySelector('.beeson-edit-menubar .state, .beeson-edit-header .state')?.textContent ?? null`);
const rect = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const menuLabels = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].filter((i) => i.getClientRects().length).map((i) => i.querySelector('.label')?.firstChild?.textContent ?? '')`);
const selected = (page, sel) => page.evaluate(`window.BeesonEditor.selection().map((e) => e.matches(${js(sel)}))`);
let saves = 0;

async function load(t, platform, slide) {
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
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${slide})`);
  await wait(page);
  return page;
}

// the labels of the menu bar's menu named bar, opened by a trusted click and closed again
async function openMenu(page, bar) {
  await click(page, await rect(page, `[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)})`));
  await wait(page, 200);
  const labels = await menuLabels(page);
  await press(page, 'Escape');
  await wait(page, 100);
  return labels;
}

// the last edit undone to the file before and redone, and the edited file returned
async function roundTrip(page, before) {
  const edited = await render(page);
  assert.notEqual(edited, before, 'the action does not change the file');
  await undo(page);
  await wait(page, 100);
  assert.equal(await render(page), before, 'the undo does not give the file back byte for byte');
  await redo(page);
  await wait(page, 100);
  assert.equal(await render(page), edited, 'the redo does not write the edit again');
  return edited;
}

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith('.ts') ? [path] : [];
  });
}

test('the editor is built without the plot commands, the Plot Data window, and the plot modules', () => {
  const bundle = readFileSync('theme/editor.js', 'utf8');
  assert.deepEqual(bundle.match(/id:\s*"(plot\.[A-Za-z]+|insert\.plot)"/g) ?? [], [], 'a plot command is in the bundle');
  assert.ok(!bundle.includes('beeson-plotdata'), 'the style of the Plot Data window is in the bundle');
  for (const path of ['src/editor/commands/plot.ts', 'src/editor/plotdata.ts', 'src/editor/inspector/plot.ts']) assert.ok(!existsSync(path), `${path} is still there`);
  for (const path of sources('src/editor')) assert.doesNotMatch(readFileSync(path, 'utf8'), /from '[./]+(plotdata|commands\/plot|inspector\/plot|plot)\.ts'/, `${path} imports a plot module`);
});

for (const platform of PLATFORMS) {
  test(`a plot is not inserted or edited by a command, a menu, the toolbar, or Mod+Shift+D (${platform})`, async (t) => {
    const page = await load(t, platform, ZONE_SLIDE);
    for (const id of IDS) await assert.rejects(state(page, id), /there is no command/, `${id} is still a command`);
    assert.equal(await page.evaluate(`!!document.querySelector('[data-command="insert.plot"]')`), false, 'the toolbar has the button Plot');
    assert.ok(!(await openMenu(page, 'Insert')).includes('Plot'), 'the Insert menu has Plot');
    assert.ok(!(await openMenu(page, 'Format')).includes('Plot'), 'the Format menu has the submenu Plot');
    await click(page, `${SLIDE} .plot`);
    await wait(page);
    await press(page, 'Mod+Shift+D');
    await wait(page);
    assert.equal(await page.evaluate(`!!document.querySelector('.beeson-plotdata')`), false, 'Mod+Shift+D opens the Plot Data window');
    assert.equal((await state(page, 'edit.undo')).enabled, false, 'Mod+Shift+D adds a history entry');
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`a plot in a zone is an opaque figure, moved, duplicated, and deleted with its block kept (${platform})`, async (t) => {
    const page = await load(t, platform, ZONE_SLIDE);
    const source = page.source;
    await click(page, `${SLIDE} .plot`);
    await wait(page);
    assert.deepEqual(await selected(page, 'div.plot.zone'), [true]);
    assert.equal(await page.evaluate(`document.querySelector('#beeson-edit-panel-format .ed-panes').dataset.pane`), 'arrange');
    assert.equal(await page.evaluate(`!!document.querySelector('#beeson-edit-panel-format .ed-tabs')`), false, 'the Format tab of a plot has more panes than Arrange');
    await click(page, `${SLIDE} .plot`, { button: 'right' });
    await wait(page, 150);
    const labels = await menuLabels(page);
    assert.ok(labels.includes('Bring to Front'), `the menu of a plot does not have the arrange items: ${labels.join(', ')}`);
    assert.ok(!labels.some((l) => /Plot/.test(l)), `the menu of a plot has a plot item: ${labels.join(', ')}`);
    await press(page, 'Escape');
    await wait(page, 100);
    // a drag writes translate into the tag of the div.plot alone
    await drag(page, await center(page, `${SLIDE} .plot`), { dx: -120, dy: 40 });
    await wait(page);
    const moved = await render(page);
    const tag = moved.match(/<div class="plot zone" data-plot="zone-plot" style="translate: -?\d+px -?\d+px">/);
    assert.ok(tag, 'the drag does not write translate into the tag of the plot');
    await byteExact(page, [[ZONE, tag[0]]]);
    await roundTrip(page, source);
    await undo(page);
    await wait(page, 100);
    await byteExact(page);
    // Mod+D copies the div.plot alone, and the copy names the same block
    await click(page, `${SLIDE} .plot`);
    await press(page, 'Mod+D');
    await wait(page);
    const copied = await render(page);
    assert.equal(copied.split('data-plot="zone-plot"').length, 3, 'Mod+D does not copy the plot once');
    assert.equal(copied.split(BLOCK).length, 2, 'Mod+D copies the JSON block');
    assert.equal(await page.evaluate(`document.querySelectorAll('${SLIDE} .plot .plot-body').length`), 2, 'the copy is not drawn from the block');
    await roundTrip(page, source);
    // a delete of the copy gives the file back
    await press(page, platform === 'mac' ? 'Backspace' : 'Delete');
    await wait(page);
    assert.equal(await render(page), source, 'the delete of the copy does not give the file back');
    await undo(page);
    await wait(page, 100);
    assert.equal(await render(page), copied);
    await undo(page);
    await wait(page, 100);
    await byteExact(page);
    // a delete of the plot keeps its JSON block and its step span in the file
    await click(page, `${SLIDE} .plot`);
    await press(page, platform === 'mac' ? 'Backspace' : 'Delete');
    await wait(page);
    const deleted = await render(page);
    assert.ok(!deleted.includes(ZONE), 'the plot is not deleted');
    assert.ok(deleted.includes(BLOCK) && deleted.includes(STEP), 'the delete takes the JSON block or the step span');
    await roundTrip(page, source);
    const { text } = await saveAndReopen(page, `r20-1-${++saves}.html`);
    assert.equal(text, deleted);
    assert.deepEqual(errors(page), []);
  });

  test(`a plot over a text is reported as a plot, and its row of the Object List reads Plot (${platform})`, async (t) => {
    const page = await load(t, platform, ZONE_SLIDE);
    await click(page, `${SLIDE} .plot`);
    await wait(page);
    const p = await page.evaluate(`(() => { const r = document.querySelector('${SLIDE} > p').getBoundingClientRect(), s = document.querySelector('${SLIDE}').getBoundingClientRect(), k = 1920 / s.width; return { x: Math.round((r.left - s.left) * k), y: Math.round((r.top - s.top) * k) }; })()`);
    await exec(page, 'arrange.setPosition', p);
    await wait(page);
    // the report is made after a change of the layout, and not after a move by the user
    await exec(page, 'slide.layout.wide');
    await wait(page, 400);
    assert.match(await title(page), /A plot covers 1 text\b/);
    await exec(page, 'view.objects');
    await wait(page);
    const rows = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-objects .row')].map((r) => r.querySelector('.name').textContent)`);
    assert.ok(rows.includes('Plot'), `the Object List does not name the plot: ${rows.join(', ')}`);
    assert.deepEqual(errors(page), []);
  });

  test(`a plot in a plate is locked and given a step as other figures are (${platform})`, async (t) => {
    const page = await load(t, platform, PLATE_SLIDE);
    const source = page.source;
    await click(page, `${SLIDE} .plot`);
    await wait(page);
    assert.deepEqual(await selected(page, 'div.plot.plate'), [true]);
    await exec(page, 'arrange.lock');
    await wait(page);
    const locked = await render(page);
    assert.equal(locked, source.replace(PLATE, '<div class="plot plate" data-plot="plate-plot" data-locked>'));
    await exec(page, 'arrange.setPosition', { x: 300, y: 200 });
    await wait(page);
    assert.equal(await render(page), locked, 'a locked plot is moved');
    await exec(page, 'arrange.unlock');
    await wait(page);
    assert.equal(await render(page), source);
    await exec(page, 'steps.add');
    await wait(page);
    const stepped = await render(page);
    // the plot becomes the third step, after the two step spans of the plot, which are numbered
    await byteExact(page, [[PLATE, '<div class="plot plate fragment" data-plot="plate-plot" data-fragment-index="3">'],
      ['<span class="fragment" data-plot-show="right">', '<span class="fragment" data-plot-show="right" data-fragment-index="1">'],
      ['<span class="fragment" data-plot-tab="two">', '<span class="fragment" data-plot-tab="two" data-fragment-index="2">']]);
    await exec(page, 'view.steps');
    await wait(page);
    const rows = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .rows .row .meta')].map((r) => r.textContent)`);
    assert.ok(rows.some((r) => /^Plot(?! step)/.test(r)), `the Steps pane does not name the plot: ${rows.join(', ')}`);
    await roundTrip(page, source);
    const { text } = await saveAndReopen(page, `r20-1-${++saves}.html`);
    assert.equal(text, stepped);
    assert.deepEqual(errors(page), []);
  });
}
