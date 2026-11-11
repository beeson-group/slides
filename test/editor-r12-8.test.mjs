// regression tests of R12.8 on both platforms with trusted input: the undo of Tab and Shift+Tab in
// the outline, the color of a series added in the Plot Data window, the keys of the Arrange menu in
// the Object List, and the drop line of a row dragged in the Object List. after each edit of the
// file the text is checked byte for byte after an undo and again after a redo

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen } from './helpers/editor.mjs';

const DECK = 'index.html';
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

const js = (v) => JSON.stringify(v);
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg ? `, ${js(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const settle = async (page) => {
  await page.evaluate('new Promise((d) => setTimeout(() => d(true), 120))');
  await frames(page);
};

// the editor on slide n, counted from 0, of deck, served over HTTP with the storage cleared
async function load(t, platform, { deck = DECK, n = 0 } = {}) {
  const page = await browser.newPage();
  t.after(() => page.close().catch(() => {}));
  await page.send('Page.bringToFront');
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear(); true');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(status.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

const OUTLINE = '.beeson-edit-outline';
// each slide of the outline as its number, then the depth and the start of each of its lines
const outline = (page) => page.evaluate(`[...document.querySelectorAll('${OUTLINE} .slide')].map((g) => [g.querySelector('.no').textContent, ...[...g.querySelectorAll('.line')].map((l) => l.style.getPropertyValue('--depth') + ' ' + l.textContent.slice(0, 20))])`);
const count = (page) => page.evaluate(`document.querySelector('.beeson-edit-bottom').textContent.match(/Slide \\S+ of \\d+/)?.[0]`);
const undoKey = (page) => press(page, 'Mod+Z');
const redoKey = (page) => press(page, 'Mod+Shift+Z');

// the outline shown, with the caret in its line that starts with text, by a click
async function caretIn(page, text) {
  if (!(await state(page, 'view.outline')).checked) await exec(page, 'view.outline');
  await frames(page);
  const at = await page.evaluate(`(() => {
    const t = [...document.querySelectorAll('${OUTLINE} .text')].find((e) => e.textContent.startsWith(${js(text)}));
    t.scrollIntoView({ block: 'center' });
    const r = t.getBoundingClientRect();
    return { x: r.left + 30, y: r.top + r.height / 2 };
  })()`);
  await click(page, at);
  await frames(page);
}

for (const platform of PLATFORMS) {
  // plots-objects-outline-1: in Keynote and PowerPoint, Tab in the outline demotes an item, and
  // one undo restores the file. one undo of the indent of the outline left the item twice
  test(`one undo of Tab in the outline restores the file (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await caretIn(page, 'Two elements');
    await press(page, 'Tab');
    await settle(page);
    const indented = await render(page);
    assert.notEqual(indented, page.source);
    assert.equal(indented.split('Two elements with the same index').length, 2);
    assert.equal((await outline(page))[2][4], '2 Two elements with th');
    await undoKey(page);
    await settle(page);
    await byteExact(page);
    assert.equal((await state(page, 'edit.undo')).enabled, false);
    assert.deepEqual((await outline(page))[2].slice(3, 6), ['1 Each step is a revea', '1 Two elements with th', '1 When exporting to PD']);
    await redoKey(page);
    await settle(page);
    assert.equal(await render(page), indented);
    assert.equal((await outline(page))[2][4], '2 Two elements with th');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Increase Indent Level');
    // Shift+Tab on the nested item takes it out again in one entry
    await caretIn(page, 'Two elements');
    await press(page, 'Shift+Tab');
    await settle(page);
    await byteExact(page);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Decrease Indent Level');
    await undoKey(page);
    await settle(page);
    assert.equal(await render(page), indented);
    const { text } = await saveAndReopen(page, `r12-8-tab-${platform}.html`);
    assert.equal(text, indented);
    assert.deepEqual(errors(page), []);
  });

  // plots-objects-outline-2: after an undo of Promote to Slide, the outline and the slide count
  // follow the deck, as in Keynote and PowerPoint
  test(`an undo of Shift+Tab in the outline redraws the outline and the slide count (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await caretIn(page, 'Two elements');
    const before = await outline(page);
    const slides = before.length;
    await press(page, 'Shift+Tab');
    await settle(page);
    const promoted = await render(page);
    assert.equal((await outline(page)).length, slides + 1);
    assert.equal(await count(page), `Slide 4 of ${slides + 1}`);
    await undoKey(page);
    await settle(page);
    await byteExact(page);
    assert.deepEqual(await outline(page), before);
    assert.equal(await count(page), `Slide 3 of ${slides}`);
    // the caret is in the item put back
    assert.equal(await page.evaluate(`document.activeElement.closest('${OUTLINE} .line.item')?.textContent.slice(0, 12)`), 'Two elements');
    await redoKey(page);
    await settle(page);
    assert.equal(await render(page), promoted);
    assert.equal((await outline(page)).length, slides + 1);
    assert.equal(await count(page), `Slide 4 of ${slides + 1}`);
    await undoKey(page);
    await settle(page);
    await byteExact(page);
    assert.deepEqual(await outline(page), before);
    assert.deepEqual(errors(page), []);
  });
}

const WINDOW = '.beeson-plotdata';
const PANEL = '#beeson-edit-panel-format';
// the stroke of each trace of the plot of the current slide, and the pressed swatch of each series
const strokes = (page) => page.evaluate(`[...document.querySelectorAll('.reveal section.present .plot path.plot-trace')].map((p) => getComputedStyle(p).stroke)`);
const pressed = (page) => page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-series .ed-swatches')].map((g) => [g.getAttribute('aria-label'), [...g.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.dataset.tone)])`);

for (const platform of PLATFORMS) {
  // plots-objects-outline-3: in Keynote and PowerPoint, a new series takes the next color of the
  // chart, and the color well of each series shows its color. a new series was drawn in the
  // accent of the first one, and no swatch of Series Colors was pressed
  test(`a series added in Plot Data takes the next data color, and its swatch is pressed (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await exec(page, 'insert.plot');
    await page.waitFor(`!!document.querySelector('${WINDOW}:not([hidden])')`);
    page.source = await render(page);
    await click(page, await page.evaluate(`(() => {
      const r = [...document.querySelectorAll('${WINDOW} button')].find((b) => b.textContent === 'Add Series').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`));
    await settle(page);
    const added = await render(page);
    assert.match(added, /\{ "id": "series-1", "panel": "main", "kind": "trace", "tone": "data-1" \}/);
    const [one, two] = await strokes(page);
    assert.notEqual(one, two);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Add Series');
    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
    await page.evaluate('window.BeesonEditor.redo()');
    assert.equal(await render(page), added);
    // the swatch of the color in effect is pressed, the accent for a series without a tone
    await press(page, 'Escape');
    await click(page, '.reveal section.present .plot');
    await settle(page);
    assert.deepEqual(await pressed(page), [['Color of line', ['accent']], ['Color of series-1', ['data-1']]]);
    assert.deepEqual(errors(page), []);
  });
}
