// tests of R7.7 on both platforms with trusted input: a section of the light table moved by a drag
// of its head and renamed by a double click on its name, the tiles of the Add Slide popover in three
// columns as in the Add a Slide popover of Keynote, Distribute of one element across the slide and
// of two with Align to Slide, and an arrowhead at the start of a line alone. after each edit the
// text is checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { lineText } from '../src/editor/commands/line.ts';
import { byteExact, click, drag, press, saveAndReopen, selectFigure, type } from './helpers/editor.mjs';

const DECK = 'index.html';
const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
const SORTER = '.beeson-edit-sorter';
const FIGURE = '<figure class="zone fragment" data-fragment-index="2">';
const LEAD = '<p>The lead-in of a display</p>';
const P = '.reveal section.present > p';
const ZONE = '.reveal section.present .zone';
const SELECTED = '.beeson-overlay > .beeson-frame.selected:not([hidden])';
const IMG = '.reveal section.present .zone > img:not([hidden])';
const MATH = [...readFileSync(LAYOUTS, 'utf8').matchAll(/<section[\s\S]*?<\/section>/g)].findIndex((m) => m[0].includes('<h2>Math, an ordered list, and a zone</h2>'));

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
const rect = (page, selector) => page.evaluate(`(() => { const e = [...document.querySelectorAll(${js(selector)})].find((e) => e.getBoundingClientRect().width); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

// the editor on slide n of a deck served over HTTP, with the Format tab shown
async function load(t, platform, { deck = LAYOUTS, n = 0 } = {}) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
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
// after a redo, and an open of the saved text without problems
let saves = 0;
async function roundTrip(page, edited) {
  assert.equal(await render(page), edited);
  await undo(page);
  await byteExact(page);
  await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r7-7-${++saves}.html`);
  assert.equal(text, edited);
  page.source = text;
}

// a click on the tab or the button of the inspector whose text or title is name
async function tap(page, name) {
  const at = await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('${PANEL} button')].find((b) => b.textContent.trim() === ${js(name)} || b.title === ${js(name)} || b.getAttribute('aria-label') === ${js(name)});
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(at, `the inspector does not have a button ${name}`);
  await click(page, at);
  await frames(page);
}

// the center of the item labeled label of the open menus, or null
const itemAt = (page, label) => page.evaluate(`(() => {
  const item = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label')?.textContent === ${js(label)});
  if (!item) return null;
  const r = item.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);

// the source with its sections put into the order of a list of their indices, each section moved
// with the white space and the comments before it
function reordered(source, order) {
  const units = [...source.matchAll(/\s*(?:<!--[\s\S]*?-->\s*)*<section[\s\S]*?<\/section>/g)];
  const start = units[0].index;
  const end = units.at(-1).index + units.at(-1)[0].length;
  return source.slice(0, start) + order.map((i) => units[i][0]).join('') + source.slice(end);
}

const heads = (page) => page.evaluate(`[...document.querySelectorAll('${SORTER} .head')].map((h) => h.querySelector('.name').textContent + ' ' + h.querySelector('.n').textContent)`);
const headOf = (name) => `[...document.querySelectorAll('${SORTER} .head')].find((h) => h.querySelector('.name').textContent === ${js(name)})`;
const nameAt = (page, name) => page.evaluate(`(() => { const r = ${headOf(name)}.querySelector('.name').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top }; })()`);
const picked = (page) => page.evaluate(`[...document.querySelectorAll('${SORTER} .tile[aria-selected="true"]')].map((t) => Number(t.querySelector('.no').textContent))`);
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);

for (const platform of PLATFORMS) {
  test(`a drag of a section head in the light table moves the section slide with its slides as one entry (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: DECK, n: 4 });
    await exec(page, 'view.lightTable');
    await frames(page);
    assert.deepEqual(await heads(page), ['Opening 1 slide', 'Chapter one 5 slides', 'Chapter two 7 slides']);
    // a click on a head selects the slides of its section, as in PowerPoint
    await click(page, await nameAt(page, 'Chapter one'));
    await frames(page);
    assert.deepEqual(await picked(page), [2, 3, 4, 5, 6]);
    assert.equal(await page.evaluate(`${headOf('Chapter one')}.classList.contains('picked')`), true);
    // the head of Chapter two is dragged above the head of Chapter one, with a line across the light
    // table where it is dropped
    const from = await nameAt(page, 'Chapter two');
    const to = await nameAt(page, 'Chapter one');
    await drag(page, from, { dy: to.y - from.y - 6, hold: true });
    const line = await rect(page, `${SORTER} .drop.across`);
    assert.ok(line && line.width > 600 && line.top < to.top, `the drop line is at ${js(line)}`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: from.x, y: to.y - 6, button: 'left', clickCount: 1 });
    await page.waitFor(`document.querySelectorAll('.reveal .slides > section')[1].querySelector('h2')?.textContent === 'Chapter two'`);
    await frames(page);
    // the closing slide moves with Chapter two, hence Chapter one follows it as the appendix
    assert.deepEqual(await heads(page), ['Opening 1 slide', 'Chapter two 7 slides', 'Appendix 5 slides']);
    assert.deepEqual(await picked(page), [2, 3, 4, 5, 6, 7, 8]);
    assert.equal(await undoLabel(page), 'Undo Move Section');
    await roundTrip(page, reordered(page.source, [0, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5]));
    // a drop where the section already is leaves the file and the history alone
    await frames(page);
    const before = await undoLabel(page);
    const again = await nameAt(page, 'Chapter two');
    await drag(page, again, { dy: 8 });
    await frames(page);
    await byteExact(page);
    assert.equal(await undoLabel(page), before);
    assert.deepEqual(errors(page), []);
  });

  test(`a double click on the name of a section head renames its section slide, and Esc keeps the name (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: DECK, n: 4 });
    await exec(page, 'view.lightTable');
    await frames(page);
    await click(page, await nameAt(page, 'Chapter one'), { count: 2 });
    await frames(page);
    const field = `${SORTER} input.rename`;
    assert.equal(await page.evaluate(`document.activeElement === document.querySelector('${field}')`), true, 'the field of the name does not have the focus');
    assert.equal(await page.evaluate(`document.querySelector('${field}').value`), 'Chapter one');
    // Esc drops the typed name and keeps the light table open
    await type(page, 'Nothing');
    await press(page, 'Escape');
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelector('${field}')`), null);
    assert.equal(await page.evaluate(`document.querySelector('${SORTER}').hidden`), false, 'Esc in the field closed the light table');
    await byteExact(page);
    // Return writes the typed name into the heading of the section slide
    await click(page, await nameAt(page, 'Chapter one'), { count: 2 });
    await frames(page);
    await type(page, 'Part one');
    await press(page, 'Enter');
    await page.waitFor(`document.querySelectorAll('.reveal .slides > section')[1].querySelector('h2').textContent === 'Part one'`);
    await frames(page);
    assert.deepEqual(await heads(page), ['Opening 1 slide', 'Part one 5 slides', 'Chapter two 7 slides']);
    assert.equal(await undoLabel(page), 'Undo Rename Section');
    await byteExact(page, [['<h2>Chapter one</h2>', '<h2>Part one</h2>']]);
    await roundTrip(page, await render(page));
    assert.deepEqual(errors(page), []);
  });

  test(`the Add Slide popover draws its tiles 120 px wide in three columns, as in Keynote (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: DECK, n: 4 });
    await click(page, '.beeson-edit-top [data-command="slide.gallery"]');
    await frames(page);
    const tiles = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-gallery .tile')].map((t) => { const r = t.getBoundingClientRect(), p = t.querySelector('.pic').getBoundingClientRect(); return { layout: t.dataset.layout, left: Math.round(r.left), top: Math.round(r.top), width: r.width, pic: p.width, ratio: p.width / p.height }; })`);
    assert.equal(tiles.length, 9);
    for (const tile of tiles) {
      assert.equal(tile.width, 120, `the tile of ${tile.layout} is ${tile.width} px wide`);
      assert.equal(tile.pic, 112);
      assert.ok(Math.abs(tile.ratio - 16 / 9) < 0.02);
    }
    assert.equal(new Set(tiles.map((t) => t.left)).size, 3, 'the tiles are not in three columns');
    assert.deepEqual(tiles.slice(0, 3).map((t) => t.top), [tiles[0].top, tiles[0].top, tiles[0].top]);
    assert.ok(tiles[3].top > tiles[0].top && tiles[3].left === tiles[0].left);
    const box = await rect(page, '.beeson-edit-gallery');
    assert.ok(box.right <= 1600 && box.bottom <= 1000 && box.width < 420, `the popover is ${js(box)}`);
    // ArrowDown moves the focus one row down, i.e. by three tiles, and Space adds a slide of it
    assert.equal(await page.evaluate(`document.activeElement.dataset.layout`), 'content');
    await press(page, 'ArrowDown');
    assert.equal(await page.evaluate(`document.activeElement.dataset.layout`), 'figure');
    await press(page, 'ArrowUp');
    await press(page, 'ArrowUp');
    assert.equal(await page.evaluate(`document.activeElement.dataset.layout`), 'title');
    await press(page, 'ArrowDown');
    await press(page, 'ArrowDown');
    assert.equal(await page.evaluate(`document.activeElement.dataset.layout`), 'split');
    await press(page, 'Space');
    await page.waitFor(`document.querySelectorAll('.reveal .slides > section').length === 14`);
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal .slides > section')[5].matches('.split')`), true);
    await roundTrip(page, await render(page));
    assert.deepEqual(errors(page), []);
  });

  test(`Distribute centers one element on the slide, with Align to Selection dimmed for it (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    await selectFigure(page, IMG);
    await frames(page);
    assert.equal((await state(page, 'arrange.distribute.horizontal')).enabled, true);
    assert.equal((await state(page, 'arrange.distribute.vertical')).enabled, true);
    assert.equal((await state(page, 'arrange.alignTo.selection')).enabled, false);
    assert.equal((await state(page, 'arrange.alignTo.slide')).checked, true);
    // a figure has the Image pane with its tabs, and Distribute is in the tab Arrange
    await tap(page, 'Arrange');
    await tap(page, 'Horizontally');
    const text = await render(page);
    const dx = Number(text.match(/<figure class="zone fragment" data-fragment-index="2" style="translate: (-?\d+)px 0px">/)?.[1]);
    assert.ok(dx < 0, `the offset of the figure is ${dx}`);
    await byteExact(page, [[FIGURE, `${FIGURE.slice(0, -1)} style="translate: ${dx}px 0px">`]]);
    const slide = await rect(page, '.reveal .slides');
    // the frame of the figure, i.e. its picture with its caption, is centered
    const frame = await rect(page, SELECTED);
    assert.ok(Math.abs(frame.x - slide.x) <= 1.5, `the figure is centered at ${frame.x}, and the slide at ${slide.x}`);
    await roundTrip(page, text);
    // the open of the saved text clears the selection
    await selectFigure(page, IMG);
    await tap(page, 'Arrange');
    await tap(page, 'Vertically');
    const both = await render(page);
    const dy = Number(both.match(/data-fragment-index="2" style="translate: -?\d+px (-?\d+)px">/)?.[1]);
    assert.ok(Number.isFinite(dy) && dy !== 0, `the vertical offset of the figure is ${dy}`);
    const framed = await rect(page, SELECTED);
    assert.ok(Math.abs(framed.y - slide.y) <= 1.5, `the figure is centered at ${framed.y}, and the slide at ${slide.y}`);
    await roundTrip(page, both);
    assert.deepEqual(errors(page), []);
  });

  test(`Distribute of two elements with Align to Slide puts them at the edges of the slide (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    const p = await rect(page, P);
    await selectFigure(page, IMG);
    await click(page, { x: p.right + 3, y: p.y }, { modifiers: 'Shift' });
    await frames(page);
    assert.equal((await state(page, 'arrange.distribute.horizontal')).enabled, false, 'two elements are distributed within their own box');
    assert.equal((await state(page, 'arrange.alignTo.selection')).enabled, true);
    await tap(page, 'Slide');
    assert.equal((await state(page, 'arrange.distribute.horizontal')).enabled, true);
    await tap(page, 'Horizontally');
    const text = await render(page);
    const x = (tag) => Number(text.match(new RegExp(`${tag.slice(0, -1)} style="translate: (-?\\d+)px 0px">`))?.[1]);
    const [px, fx] = [x(LEAD.slice(0, 3)), x(FIGURE)];
    assert.ok(Number.isFinite(px) && Number.isFinite(fx), `the offsets are ${px} and ${fx}`);
    await byteExact(page, [
      [LEAD, `<p style="translate: ${px}px 0px">The lead-in of a display</p>`],
      [FIGURE, `${FIGURE.slice(0, -1)} style="translate: ${fx}px 0px">`],
    ]);
    const slide = await rect(page, '.reveal .slides');
    const edges = [await rect(page, P), await rect(page, ZONE)].map((r) => [r.left, r.right]);
    assert.ok(edges.some(([l]) => Math.abs(l - slide.left) <= 1.5), `a frame is not at the left edge: ${js(edges)}`);
    assert.ok(edges.some(([, r]) => Math.abs(r - slide.right) <= 1.5), `a frame is not at the right edge: ${js(edges)}`);
    await roundTrip(page, text);
    assert.deepEqual(errors(page), []);
  });

  test(`Arrowhead at Start in the Line pane and in Format > Line writes marker-start alone (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    await exec(page, 'insert.line', { from: { x: 300, y: 500 }, to: { x: 800, y: 500 } });
    await frames(page);
    const plain = lineText({ x1: 300, y1: 500, x2: 800, y2: 500 }, { id: 'line-1' });
    const start = lineText({ x1: 300, y1: 500, x2: 800, y2: 500 }, { id: 'line-1', heads: 'start' });
    const end = lineText({ x1: 300, y1: 500, x2: 800, y2: 500 }, { id: 'line-1', heads: 'end' });
    assert.ok(start.includes('<line x1="0" y1="0" x2="500" y2="0" marker-start="url(#line-1)"></line>'));
    page.source = await render(page);
    assert.ok(page.source.includes(plain));
    await tap(page, 'Arrowhead at Start');
    await byteExact(page, [[plain, start]]);
    assert.equal((await state(page, 'line.heads.start')).checked, true);
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} [data-command="line.heads.start"]').getAttribute('aria-pressed')`), 'true');
    // the grip of each end is drawn on its end, the tip of the head at the start
    const grips = await page.evaluate(`Object.fromEntries([...document.querySelectorAll('.beeson-line-end')].filter((g) => !g.hidden).map((g) => { const r = g.getBoundingClientRect(); return [g.dataset.end, r.left + r.width / 2]; }))`);
    const ends = await page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'), r = s.getBoundingClientRect(), k = r.width / s.offsetWidth; return [r.left + 300 * k, r.left + 800 * k]; })()`);
    assert.ok(Math.abs(grips[1] - ends[0]) <= 1, `the grip of the start is at ${grips[1]}, and the start at ${ends[0]}`);
    assert.ok(Math.abs(grips[2] - ends[1]) <= 1, `the grip of the end is at ${grips[2]}, and the end at ${ends[1]}`);
    await roundTrip(page, await render(page));
    // Format > Line > Arrowhead at Start, from an arrowhead at the end, on the line selected again
    // after the open of the saved text
    const near = await page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'), r = s.getBoundingClientRect(), k = r.width / s.offsetWidth; return { x: r.left + 550 * k, y: r.top + 500 * k + 3 }; })()`);
    await click(page, near);
    await frames(page);
    await exec(page, 'line.heads.end');
    await frames(page);
    page.source = await render(page);
    assert.ok(page.source.includes(end));
    await click(page, await page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === 'Format').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
    await frames(page);
    const sub = await itemAt(page, 'Line');
    assert.ok(sub, 'Format does not have the submenu Line');
    await click(page, sub);
    await frames(page);
    const item = await itemAt(page, 'Arrowhead at Start');
    assert.ok(item, 'Format > Line does not list Arrowhead at Start');
    await click(page, item);
    await frames(page);
    await byteExact(page, [[end, start]]);
    await roundTrip(page, await render(page));
    assert.deepEqual(errors(page), []);
  });
}
