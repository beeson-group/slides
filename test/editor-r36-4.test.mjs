// the built-in entries of the list of backdrops of R36.4 on both platforms: an entry whose file is
// not found next to the deck is listed at its place and dimmed, in the gallery of Insert >
// Backdrop… and in the Drawing popup of the Backdrop pane, and it cannot be chosen. the decks are a
// talk folder without brand/transfer.js and demo/broucke-sample.js, the same deck with a drawing of
// its own Broucke file, and the demo deck

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen } from './helpers/editor.mjs';

const TALK = 'test/pages/editor-r36-4.html';
const OWN = 'test/pages/editor-r36-4-own.html';
const DEMO = 'index.html';
const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
const TILES = '.beeson-backdrop-gallery [data-tile]';
const MENU = '.beeson-edit-menu.select';
const KEYS = ['logo', 'nest', 'tubes', 'wideRibbon', 'broucke'];
const LIST = ['Beeson Logo', 'Lyapunov Families', 'Cislunar Manifolds', 'Earth Manifolds', 'Broucke Families'];
const LOGO_TITLE = 'brand/transfer.js is not found next to the deck';
const BROUCKE_TITLE = 'demo/broucke-sample.js is not found next to the deck';

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

// the number of failed loads of the file at path under test/pages/ that Chrome logged
const failures = (page, path) => page.errors.filter((e) => e.includes(`/test/pages/${path}`)).length;

// the gallery of Insert > Backdrop…, as { key, name, disabled, title, text } per tile. the tiles
// are put into the gallery at once, after the files of the list are read
async function openList(page) {
  await exec(page, 'insert.backdrop');
  await page.waitFor(`!!document.querySelector('.beeson-backdrop-gallery')`);
  await frames(page);
  return page.evaluate(`[...document.querySelectorAll('${TILES}')].map((b) => ({ key: b.dataset.tile, name: b.querySelector('.name').textContent, disabled: b.disabled, title: b.title, text: b.textContent }))`);
}

// the backdrop of the current slide selected, with the Format panel shown
async function selectBackdrop(page) {
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await exec(page, 'backdrop.select');
  await frames(page);
}

// the items of the popup of the pane named label, opened by a click, as [name, disabled]
async function popupItems(page, label) {
  await click(page, `${PANEL} [aria-label="${label}"]`);
  await page.waitFor(`!!document.querySelector('${MENU}')`);
  return page.evaluate(`[...document.querySelectorAll('${MENU} .item')].map((i) => [i.querySelector('.label')?.textContent ?? i.textContent, i.getAttribute('aria-disabled') === 'true'])`);
}

// the name of the highlighted item of the open popup, or null
const highlighted = (page) => page.evaluate(`(() => { const i = document.querySelector('${MENU} .item.hi'); return i ? (i.querySelector('.label')?.textContent ?? i.textContent) : null; })()`);

for (const platform of PLATFORMS) {
  test(`in a talk without the files, Beeson Logo and Broucke Families are tiles at their places, dimmed with the reason, and a click on them adds nothing (${platform})`, async (t) => {
    const page = await load(t, platform, TALK, 1);
    const list = await openList(page);
    assert.deepEqual(list.map((e) => e.key), KEYS);
    assert.deepEqual(list.map((e) => e.name), LIST);
    assert.deepEqual(list.map((e) => e.disabled), [true, false, false, false, true]);
    assert.equal(list[0].title, LOGO_TITLE);
    assert.equal(list[4].title, BROUCKE_TITLE);
    assert.match(list[0].text, /File not found/);
    assert.match(list[4].text, /File not found/);
    assert.ok(list.slice(1, 4).every((e) => e.title === e.name && !/File not found/.test(e.text)));
    // a dimmed tile is not focused by a key, and a click on it adds no backdrop
    assert.equal(await page.evaluate(`(() => { const b = document.querySelector('${TILES}[data-tile="broucke"]'); b.focus(); return document.activeElement === b; })()`), false);
    for (const key of ['broucke', 'logo']) {
      await click(page, `${TILES}[data-tile="${key}"]`);
      await frames(page);
      assert.equal(await render(page), page.source, key);
    }
    await press(page, 'Escape');
    // one failed load of each file, which a second opening of the list does not repeat
    await openList(page);
    await press(page, 'Escape');
    assert.equal(failures(page, 'demo/broucke-sample.js'), 1, page.errors.join('\n'));
    assert.equal(failures(page, 'brand/transfer.js'), 1, page.errors.join('\n'));
  });

  test(`in a talk without the files, the Drawing popup lists Beeson Logo and Broucke Families disabled, and neither is chosen by the pointer, a key, or the command (${platform})`, async (t) => {
    const page = await load(t, platform, TALK, 0);
    await selectBackdrop(page);
    const items = await popupItems(page, 'Drawing');
    assert.deepEqual(items, LIST.map((name, i) => [name, i === 0 || i === 4]));
    await page.evaluate(`[...document.querySelectorAll('${MENU} .item')].find((i) => i.textContent.includes('Broucke')).setAttribute('data-pick', '')`);
    await click(page, `${MENU} .item[data-pick]`);
    await frames(page);
    assert.equal(await render(page), page.source);
    if (await page.evaluate(`!!document.querySelector('${MENU}')`)) await press(page, 'Escape');
    await frames(page);
    // opened by Space, the arrows, Home, End, and a typed letter skip the disabled items
    await page.evaluate(`document.querySelector('${PANEL} [aria-label="Drawing"]').focus()`);
    await press(page, 'Space');
    await page.waitFor(`!!document.querySelector('${MENU}')`);
    await press(page, 'Home');
    assert.equal(await highlighted(page), 'Lyapunov Families');
    await press(page, 'End');
    assert.equal(await highlighted(page), 'Earth Manifolds');
    const seen = [];
    for (let i = 0; i < 8; i++) {
      await press(page, 'ArrowDown');
      seen.push(await highlighted(page));
    }
    assert.ok(seen.every((n) => n !== 'Beeson Logo' && n !== 'Broucke Families'), seen.join(', '));
    await press(page, 'Home');
    await press(page, 'b');
    assert.equal(await highlighted(page), 'Lyapunov Families');
    // Enter runs the drawing of the backdrop, which changes nothing
    await press(page, 'Enter');
    await frames(page);
    assert.equal(await render(page), page.source);
    for (const value of ['broucke', 'logo']) {
      await exec(page, 'backdrop.scene', { value });
      await frames(page);
      assert.equal(await render(page), page.source, value);
    }
    // the gallery opened after the popup does not load either file again
    await openList(page);
    await press(page, 'Escape');
    assert.equal(failures(page, 'demo/broucke-sample.js'), 1, page.errors.join('\n'));
  });

  test(`a talk with a Broucke drawing of its own file offers Broucke Families from this file, with the Family popup as it was (${platform})`, async (t) => {
    const page = await load(t, platform, OWN, 1);
    const list = await openList(page);
    assert.deepEqual(list.map((e) => e.name), LIST);
    assert.deepEqual(list.map((e) => e.disabled), [true, false, false, false, false]);
    assert.equal(list[0].title, LOGO_TITLE);
    assert.equal(list[4].title, 'Broucke Families');
    await click(page, `${TILES}[data-tile="broucke"]`);
    await page.waitFor(`window.BeesonEditor.render() !== ${js(page.source)}`);
    await frames(page);
    const text = await render(page);
    assert.match(text, /<div class="backdrop" data-strands="\.\.\/\.\.\/demo\/broucke-sample\.js" data-strands-select="frame=pulsating,family=7"[^>]*><\/div>\s*<h2>A content slide without a backdrop/);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Add Backdrop');
    await undo(page);
    assert.equal(await render(page), page.source);
    await redo(page);
    assert.equal(await render(page), text);
    assert.equal((await saveAndReopen(page)).text, text);
    assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`)).problems, []);
    // the Drawing popup offers the entry, and the Family popup of the drawing of the deck is unchanged
    await page.evaluate('Reveal.slide(0)');
    await frames(page);
    await selectBackdrop(page);
    assert.deepEqual(await popupItems(page, 'Drawing'), LIST.map((name, i) => [name, i === 0]));
    await press(page, 'Escape');
    await page.evaluate('Reveal.slide(2)');
    await frames(page);
    await selectBackdrop(page);
    assert.deepEqual((await popupItems(page, 'Family')).map((i) => i[0]), ['Family 7', 'Family 7 (Inertial)', 'Family 11', 'Family 11 (Inertial)', 'Families 7 and 11', 'Families 7 and 11 (Inertial)']);
    await press(page, 'Escape');
    assert.equal(await render(page), page.source);
  });

  test(`the demo deck offers every entry, none dimmed, in the gallery and in the Drawing popup (${platform})`, async (t) => {
    const page = await load(t, platform, DEMO, 2);
    const list = await openList(page);
    assert.deepEqual(list.map((e) => e.key), KEYS);
    assert.deepEqual(list.map((e) => e.name), LIST);
    assert.ok(list.every((e) => !e.disabled && e.title === e.name && !/File not found/.test(e.text)));
    await press(page, 'Escape');
    await selectBackdrop(page);
    assert.deepEqual(await popupItems(page, 'Drawing'), LIST.map((name) => [name, false]));
    await press(page, 'Escape');
    assert.equal(await render(page), page.source);
  });
}
