// the list of backdrops of R28.2 on both platforms: the names of the Family popup, one per drawing
// of the records of the file and never a value of data-strands-select, and the entry Broucke
// Families taken from the first drawing of demo/broucke-sample.js in the deck whose file is found

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen } from './helpers/editor.mjs';

// a deck of selections of demo/broucke-sample.js, and a deck whose first such drawing is missing
const NAMES = 'test/pages/editor-r28-2.html';
const MISSING = 'test/pages/editor-r28-2-missing.html';
// a deck of selections that draw the same records by terms other than family and frame
const SAME = 'test/pages/editor-r28-2-same.html';
const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
const TILES = '.beeson-backdrop-gallery [data-tile]';
const MENU = '.beeson-edit-menu.select';
const FAMILIES = ['Family 7', 'Family 7 (Inertial)', 'Family 11', 'Family 11 (Inertial)'];
// the names of the Family popup on the deck NAMES, one per drawing
const ITEMS = [...FAMILIES, 'Families 7 and 11', 'Families 7 and 11 (Inertial)', 'Families 7 and 11 (Both Frames)', 'Family 7 and Family 11 (Inertial)', 'Families 7 and 11 (Thin 1)'];
// the name of the drawing of each slide of the deck NAMES in the Family popup
const CHECKED = ['Families 7 and 11 (Both Frames)', 'Families 7 and 11 (Both Frames)', 'Families 7 and 11', 'Families 7 and 11 (Both Frames)', 'Family 7 and Family 11 (Inertial)', 'Families 7 and 11 (Thin 1)', 'Families 7 and 11'];
// the names of the Family popup on the deck SAME, and the name of the drawing of each of its slides
const SAME_ITEMS = [...FAMILIES, 'Families 7 and 11', 'Families 7 and 11 (Inertial)', 'Families 7 and 11 (Both Frames)', 'No Records'];
const SAME_CHECKED = ['Families 7 and 11 (Both Frames)', 'Families 7 and 11 (Both Frames)', 'Families 7 and 11', 'Families 7 and 11', 'Families 7 and 11', 'No Records', 'No Records'];

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
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg ? `, ${js(arg)}` : ''})).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');

// the editor on deck at slide n, with the storage of the origin emptied
async function load(t, platform, deck, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the backdrop of the current slide selected, with the Format panel shown
async function selectBackdrop(page) {
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await exec(page, 'backdrop.select');
  await frames(page);
}

// the text of the popup of the pane named label, or null when the popup is not shown
const popupText = (page, label) => page.evaluate(`(() => {
  const b = document.querySelector('${PANEL} [aria-label="${label}"]');
  return b && b.getClientRects().length ? b.textContent : null;
})()`);

// the items of the popup of the pane named label, opened by a click, as [name, checked]
async function popupItems(page, label) {
  await click(page, `${PANEL} [aria-label="${label}"]`);
  await page.waitFor(`!!document.querySelector('${MENU}')`);
  return page.evaluate(`[...document.querySelectorAll('${MENU} .item')].map((i) => [i.querySelector('.label')?.textContent ?? i.textContent, i.getAttribute('aria-checked') === 'true'])`);
}

// a click on the item called name of the open popup, after which the file differs from text
async function choose(page, name, text) {
  await page.evaluate(`[...document.querySelectorAll('${MENU} .item')].find((i) => (i.querySelector('.label')?.textContent ?? i.textContent) === ${js(name)}).setAttribute('data-pick', '')`);
  await click(page, `${MENU} .item[data-pick]`);
  if (text !== undefined) await page.waitFor(`window.BeesonEditor.render() !== ${js(text)}`);
  await frames(page);
}

// the list of Media > Backdrop…, as [key, name] per entry, once count entries are drawn
async function openList(page, count) {
  await exec(page, 'insert.backdrop');
  await page.waitFor(`document.querySelectorAll('${TILES}').length >= ${count}`);
  await frames(page);
  return page.evaluate(`[...document.querySelectorAll('${TILES}')].map((b) => [b.dataset.tile, b.querySelector('.name').textContent])`);
}

// a click on the entry called name of the open list, after which the file differs from text
async function pick(page, name, text) {
  await page.evaluate(`[...document.querySelectorAll('${TILES}')].find((b) => b.querySelector('.name').textContent === ${js(name)}).setAttribute('data-pick', '')`);
  await click(page, `${TILES}[data-pick]`);
  await page.waitFor(`window.BeesonEditor.render() !== ${js(text)}`);
  await frames(page);
}

// the names of the backdrops in the object list on the slides ns
async function rowNames(page, ns) {
  if (!(await state(page, 'view.objects')).checked) await exec(page, 'view.objects');
  const out = [];
  for (const n of ns) {
    await page.evaluate(`Reveal.slide(${n})`);
    await frames(page);
    out.push(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-objects .row')].filter((r) => r.dataset.kind === 'Backdrop').map((r) => r.querySelector('.name').textContent).join()`));
  }
  return out;
}

const tagOf = (text, heading) => text.match(new RegExp(`${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(<div class="backdrop"[^>]*>)`))[1];

for (const platform of PLATFORMS) {
  // item 1
  test(`the Family popup names each drawing once in words, without a value of data-strands-select or empty parentheses (${platform})`, async (t) => {
    const page = await load(t, platform, NAMES, 0);
    for (const [n, name] of CHECKED.entries()) {
      await page.evaluate(`Reveal.slide(${n})`);
      await frames(page);
      await selectBackdrop(page);
      assert.equal(await popupText(page, 'Family'), name, `slide ${n}`);
      const items = await popupItems(page, 'Family');
      const names = items.map((i) => i[0]);
      assert.deepEqual(names, ITEMS, `slide ${n}`);
      for (const s of names) assert.doesNotMatch(s, /[=|<>;]|\(\s*\)/, s);
      assert.deepEqual(items.filter((i) => i[1]).map((i) => i[0]), [name], `slide ${n}`);
      await press(page, 'Escape');
    }
  });

  test(`a Family item that draws the records of the backdrop changes nothing, and another is one entry of the history (${platform})`, async (t) => {
    const page = await load(t, platform, NAMES, 1);
    await selectBackdrop(page);
    // every family in both frames draws what both frames draw
    await popupItems(page, 'Family');
    await choose(page, 'Families 7 and 11 (Both Frames)');
    assert.equal(await render(page), page.source);
    await popupItems(page, 'Family');
    await choose(page, 'Family 7 and Family 11 (Inertial)', page.source);
    const text = await render(page);
    assert.equal(tagOf(text, '<h2>Both frames'), '<div class="backdrop" data-strands="../../demo/broucke-sample.js" data-strands-select="family=7,frame=pulsating;family=11,frame=inertial" data-strands-color="family" data-strands-ramp="e">');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Family');
    assert.equal(await popupText(page, 'Family'), 'Family 7 and Family 11 (Inertial)');
    await undo(page);
    assert.equal(await render(page), page.source);
    assert.equal(await popupText(page, 'Family'), 'Families 7 and 11 (Both Frames)');
    await redo(page);
    assert.equal(await render(page), text);
    assert.equal((await saveAndReopen(page)).text, text);
  });

  test(`selections that draw the same records by other terms are one Family item, named by the records they draw (${platform})`, async (t) => {
    const page = await load(t, platform, SAME, 0);
    for (const [n, name] of SAME_CHECKED.entries()) {
      await page.evaluate(`Reveal.slide(${n})`);
      await frames(page);
      await selectBackdrop(page);
      assert.equal(await popupText(page, 'Family'), name, `slide ${n}`);
      const items = await popupItems(page, 'Family');
      assert.deepEqual(items.map((i) => i[0]), SAME_ITEMS, `slide ${n}`);
      assert.deepEqual(items.filter((i) => i[1]).map((i) => i[0]), [name], `slide ${n}`);
      await press(page, 'Escape');
    }
    assert.deepEqual(await rowNames(page, [0, 2, 5]), ['Backdrop: Broucke Families 7 and 11 (Both Frames)', 'Backdrop: Broucke Families 7 and 11', 'Backdrop: Broucke No Records']);
  });

  test(`a Family item of the records that thin=0|1 draws changes nothing, and Families 7 and 11 writes frame=pulsating (${platform})`, async (t) => {
    const page = await load(t, platform, SAME, 0);
    await selectBackdrop(page);
    await popupItems(page, 'Family');
    await choose(page, 'Families 7 and 11 (Both Frames)');
    assert.equal(await render(page), page.source);
    await popupItems(page, 'Family');
    await choose(page, 'Families 7 and 11', page.source);
    const text = await render(page);
    assert.equal(tagOf(text, '<h2>Either thin'), '<div class="backdrop" data-strands="../../demo/broucke-sample.js" data-strands-select="frame=pulsating" data-strands-color="family" data-strands-ramp="e">');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Family');
    await undo(page);
    assert.equal(await render(page), page.source);
    await redo(page);
    assert.equal(await render(page), text);
    assert.equal((await saveAndReopen(page)).text, text);
    // a selection without a record is the item No Records
    await page.evaluate('Reveal.slide(5)');
    await frames(page);
    await selectBackdrop(page);
    await popupItems(page, 'Family');
    await choose(page, 'No Records');
    assert.equal(await render(page), text);
  });

  // item 2
  test(`Broucke Families is listed when the first drawing of its file in the deck is missing and a later one is found (${platform})`, async (t) => {
    const page = await load(t, platform, MISSING, 2);
    await selectBackdrop(page);
    const items = (await popupItems(page, 'Drawing')).map((i) => i[0]);
    assert.ok(items.includes('Broucke Families'), items.join(', '));
    await press(page, 'Escape');
    const list = (await openList(page, 3)).map((e) => e[1]);
    assert.ok(list.includes('Broucke Families'), list.join(', '));
    await pick(page, 'Broucke Families', page.source);
    const tag = tagOf(await render(page), '<h2>A scene');
    assert.match(tag, /data-strands="\.\.\/\.\.\/demo\/broucke-sample\.js"/);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Replace Backdrop');
    await undo(page);
    assert.equal(await render(page), page.source);
  });
}
