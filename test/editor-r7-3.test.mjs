// tests of R7.3 on both platforms with trusted input: Save as Picture… and Size and Position… in
// the menu of a figure, the Grid and Guides submenu in the menu of a slide, Edit > Spelling and
// Grammar > Check Spelling While Typing with the menu of the browser on a second right-click, and
// the search field of the Help menu

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
// slides of the deck of layouts: a paragraph and a list, a figure with a raster image, and a video
const TEXT = 2;
const PAPER = 6;
const VIDEO = 7;
const P = '.reveal section.present > p:not(.small)';

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
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const ready = 'window.BeesonEditor && window.BeesonEditor.ready.then(() => true)';
const menus = (page) => page.evaluate(`document.querySelectorAll('.beeson-edit-menu').length`);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

// a listener that runs before those of the editor and records, after each contextmenu event,
// whether its default was prevented, i.e. whether the menu of the browser was kept from opening
const RECORD = `window.__context = []; addEventListener('contextmenu', (e) => setTimeout(() => window.__context.push(e.defaultPrevented)), true);`;

// the editor on the slide n of a deck served over HTTP
async function load(t, platform, { deck = LAYOUTS, n = TEXT, record = false, page: reuse } = {}) {
  const page = reuse ?? (await browser.newPage({ width: 1600, height: 1000 }));
  if (!reuse) t.after(() => page.close().catch(() => {}));
  if (record) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: RECORD });
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor(ready);
  // the choice of spelling of a test that failed is not left to the next, and a page reloaded
  // keeps it
  if (!reuse && (await page.evaluate(`localStorage.getItem('beeson-spelling') !== null`))) {
    await page.evaluate(`localStorage.removeItem('beeson-spelling')`);
    return load(t, platform, { deck, n, page });
  }
  page.source = readFileSync(deck, 'utf8');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`)).problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the rows of the open menus, the last opened last
const rows = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu')].map((m) => [...m.querySelectorAll('.item')].map((i) => ({
  label: i.querySelector('.label')?.firstChild?.textContent ?? '',
  path: i.querySelector('.label .path')?.textContent ?? '',
  keys: i.querySelector('.keys')?.textContent ?? '',
  dimmed: i.getAttribute('aria-disabled') === 'true',
  submenu: i.getAttribute('aria-haspopup') === 'menu',
  hi: i.classList.contains('hi'),
})))`);
const labels = (list) => list.map((r) => r.label);

// the center of the last item labeled label of the open menus, or null
const itemAt = (page, label) => page.evaluate(`(() => {
  const item = [...document.querySelectorAll('.beeson-edit-menu .item')].filter((i) => i.querySelector('.label')?.firstChild?.textContent === ${js(label)}).at(-1);
  if (!item) return null;
  const r = item.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);

async function openBar(page, bar) {
  await click(page, await page.evaluate(`(() => {
    const r = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)}).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`));
  await page.waitFor(`!!document.querySelector('.beeson-edit-menu .item')`, 3000);
}

// a trusted click on each label of a path of the open menu, with the pointer moved onto a submenu
// row so that it opens
async function pick(page, ...path) {
  const open = await menus(page);
  for (const [i, label] of path.entries()) {
    const at = await itemAt(page, label);
    assert.ok(at, `${label} is not in the open menu`);
    if (i < path.length - 1) {
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
      await page.waitFor(`document.querySelectorAll('.beeson-edit-menu').length > ${open + i}`);
    } else await click(page, at);
  }
  await frames(page);
}

// a trusted right-click at a point, and the menus open after it
async function rightClick(page, at, modifiers = '') {
  await click(page, at, { button: 'right', modifiers });
  await frames(page);
}

const point = (page, selector, fx = 0.5, fy = 0.5) => page.evaluate(`(() => {
  const r = [...document.querySelectorAll(${js(selector)})].map((e) => e.getBoundingClientRect()).find((r) => r.width && r.height);
  return { x: r.left + r.width * ${fx}, y: r.top + r.height * ${fy} };
})()`);

// the Help menu opened again with text typed into its search field
async function search(page, text) {
  await press(page, 'Escape');
  await openBar(page, 'Help');
  await type(page, text);
}

// a point of the slide shown away from every element, in its lower left corner
const empty = (page) => page.evaluate(`(() => { const r = document.querySelector('.reveal section.present').getBoundingClientRect(); return { x: r.left + 20, y: r.bottom - 20 }; })()`);

for (const platform of PLATFORMS) {
  const mac = platform === 'mac';

  test(`Save as Picture… follows Replace Image… in the menu of an image and downloads its file under its own name without a fetch (${platform})`, async (t) => {
    const page = await load(t, platform, { n: PAPER });
    await page.evaluate(`(() => {
      window.__saved = [];
      HTMLAnchorElement.prototype.click = function () { window.__saved.push({ name: this.download, href: this.href }); };
      window.__open = [];
      window.open = (...a) => { window.__open.push(a); return null; };
    })()`);
    await rightClick(page, await point(page, '.reveal section.present img.paper'));
    const menu = labels((await rows(page))[0]);
    assert.equal(menu[menu.indexOf('Replace Image…') + 1], 'Save as Picture…');
    assert.ok(menu.indexOf('Size and Position…') > menu.indexOf('Save as Picture…'));
    // the fetches of the picture by a script alone, since another file of the deck may be answered
    // during the save, and the picture may be drawn again by an img
    const fetches = () => page.evaluate(`performance.getEntriesByType('resource').filter((r) => r.name.endsWith('/demo/figure-light.png') && ['fetch', 'xmlhttprequest'].includes(r.initiatorType)).length`);
    const fetched = await fetches();
    await pick(page, 'Save as Picture…');
    assert.equal(await menus(page), 0);
    const saved = await page.evaluate('window.__saved');
    assert.equal(saved.length, 1);
    assert.equal(saved[0].name, 'figure-light.png');
    assert.equal(saved[0].href, `${server.origin}/demo/figure-light.png`);
    assert.deepEqual(await page.evaluate('window.__open'), []);
    assert.equal(await fetches(), fetched, 'the picture was fetched to be saved');
    const bytes = await page.evaluate(`fetch(${js(saved[0].href)}).then((r) => r.arrayBuffer()).then((b) => [...new Uint8Array(b)])`);
    assert.equal(sha(Buffer.from(bytes)), sha(readFileSync('demo/figure-light.png')));
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`Save Media as… in the menu of a video downloads the video of the mode shown (${platform})`, async (t) => {
    const page = await load(t, platform, { n: VIDEO });
    await page.evaluate(`window.__saved = []; HTMLAnchorElement.prototype.click = function () { window.__saved.push({ name: this.download, href: this.href }); };`);
    await rightClick(page, await point(page, '.reveal section.present video'));
    const menu = labels((await rows(page))[0]);
    assert.ok(menu.includes('Save Media as…'));
    assert.ok(!menu.includes('Save as Picture…'));
    await pick(page, 'Save Media as…');
    const saved = await page.evaluate('window.__saved');
    assert.equal(saved.length, 1);
    const shown = await page.evaluate(`[...document.querySelectorAll('.reveal section.present video')].find((v) => v.getBoundingClientRect().width).getAttribute('src')`);
    assert.equal(saved[0].name, shown.split('/').pop());
    assert.ok(['clip-dark.mp4', 'clip-light.mp4'].includes(saved[0].name));
    assert.deepEqual(errors(page), []);
  });

  test(`Size and Position… opens the Arrange tab with the focus on W, or on X when W is set by the layout (${platform})`, async (t) => {
    const page = await load(t, platform, { n: PAPER });
    await rightClick(page, await point(page, '.reveal section.present img.paper'));
    await pick(page, 'Size and Position…');
    await page.waitFor(`document.activeElement && document.activeElement.matches('#beeson-edit-num-width, #beeson-edit-num-x')`, 3000);
    const focus = await page.evaluate(`(() => {
      const a = document.activeElement;
      const w = document.querySelector('#beeson-edit-num-width');
      return { id: a.id, width: !!w && !w.disabled, selected: a.selectionStart === 0 && a.selectionEnd === a.value.length, shown: !!a.closest('#beeson-edit-panel-format') && a.getBoundingClientRect().width > 0 };
    })()`);
    assert.equal(focus.id, focus.width ? 'beeson-edit-num-width' : 'beeson-edit-num-x');
    assert.ok(focus.selected && focus.shown);
    await press(page, 'Escape');

    // an image with its own width gets the focus on W
    const zone = await load(t, platform, { n: 3 });
    await rightClick(zone, await point(zone, '.reveal section.present figure img', 0.5, 0.4));
    await pick(zone, 'Size and Position…');
    await zone.waitFor(`document.activeElement && document.activeElement.matches('#beeson-edit-num-width, #beeson-edit-num-x')`, 3000);
    const id = await zone.evaluate(`document.activeElement.id`);
    const width = await zone.evaluate(`!document.querySelector('#beeson-edit-num-width').disabled`);
    assert.equal(id, width ? 'beeson-edit-num-width' : 'beeson-edit-num-x');
    await byteExact(zone);
    assert.deepEqual([...errors(page), ...errors(zone)], []);
  });

  test(`the menu of a slide has Grid and Guides with Gridlines, Snap to Grid, and Grid Settings…, then Rulers (${platform})`, async (t) => {
    const page = await load(t, platform);
    await rightClick(page, await empty(page));
    const slide = (await rows(page))[0];
    const at = labels(slide).indexOf('Grid and Guides');
    assert.ok(at > 0, 'Grid and Guides is not in the menu of the slide');
    assert.ok(slide[at].submenu);
    assert.equal(slide[at + 1].label, 'Rulers');
    assert.ok(labels(slide).indexOf('Reset Slide') < at);
    await pick(page, 'Grid and Guides', 'Gridlines');
    assert.equal(await menus(page), 0);
    assert.equal((await state(page, 'view.grid')).checked, true);

    await rightClick(page, await empty(page));
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...(await itemAt(page, 'Grid and Guides')) });
    await page.waitFor(`document.querySelectorAll('.beeson-edit-menu').length > 1`);
    const grid = (await rows(page))[1];
    assert.deepEqual(labels(grid), ['Gridlines', 'Snap to Grid', 'Grid Settings…']);
    assert.equal(grid[0].keys, mac ? "⌘'" : "Ctrl+'");
    await pick(page, 'Gridlines');
    assert.equal((await state(page, 'view.grid')).checked, false);

    const rulers = (await state(page, 'view.rulers')).checked;
    await rightClick(page, await empty(page));
    await pick(page, 'Rulers');
    assert.equal((await state(page, 'view.rulers')).checked, !rulers);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`Check Spelling While Typing is kept in the browser, set only in the page, and a save leaves the file as it was (${platform})`, async (t) => {
    const page = await load(t, platform);
    await openBar(page, 'Edit');
    const edit = (await rows(page))[0];
    const spelling = edit.find((r) => r.label === 'Spelling and Grammar');
    assert.ok(spelling?.submenu, 'Spelling and Grammar is not a submenu of Edit');
    assert.ok(labels(edit).indexOf('Spelling and Grammar') < labels(edit).indexOf('Substitutions'));
    assert.equal((await state(page, 'edit.spelling')).checked, true);
    await pick(page, 'Spelling and Grammar', 'Check Spelling While Typing');
    assert.equal((await state(page, 'edit.spelling')).checked, false);
    assert.equal(await page.evaluate(`document.querySelector(${js(P)}).spellcheck`), false);
    assert.equal(await page.evaluate(`document.querySelector('.reveal section.present h2').spellcheck`), false);
    await byteExact(page);
    const { text } = await saveAndReopen(page, `r7-3-spelling-${platform}.html`);
    assert.equal(text, page.source);
    assert.ok(!/spellcheck/.test(text));

    await load(t, platform, { page });
    assert.equal((await state(page, 'edit.spelling')).checked, false);
    assert.equal(await page.evaluate(`document.querySelector(${js(P)}).spellcheck`), false);
    await openBar(page, 'Edit');
    await pick(page, 'Spelling and Grammar', 'Check Spelling While Typing');
    assert.equal((await state(page, 'edit.spelling')).checked, true);
    assert.equal(await page.evaluate(`document.querySelector(${js(P)}).spellcheck`), true);
    assert.equal(await page.evaluate(`localStorage.getItem('beeson-spelling')`), null);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`a second right-click in a text, or a right-click with ${mac ? '⌥' : 'Alt'} held, opens the menu of the browser (${platform})`, async (t) => {
    const page = await load(t, platform, { record: true });
    const at = await point(page, P, 0.1);
    await click(page, at);
    await frames(page);
    await rightClick(page, at);
    const text = (await rows(page))[0];
    assert.ok(labels(text).includes('Cut'));
    assert.match(await page.evaluate(`document.querySelector('.beeson-edit-menu .note').textContent`), /^Right-click again for spelling guesses/);
    await rightClick(page, at);
    assert.equal(await menus(page), 0, 'the second right-click opened a menu of the editor');
    await page.waitFor('window.__context.length === 2');
    assert.deepEqual(await page.evaluate('window.__context'), [true, false]);

    // a right-click after the menu of the browser opens the menu of the editor again
    await rightClick(page, at);
    assert.equal(await menus(page), 1);
    await press(page, 'Escape');
    await rightClick(page, await empty(page), 'Alt');
    assert.equal(await menus(page), 0, 'a right-click with Alt opened a menu of the editor');
    await rightClick(page, await empty(page));
    assert.equal(await menus(page), 1);
    await page.waitFor('window.__context.length === 5');
    assert.deepEqual(await page.evaluate('window.__context'), [true, false, true, false, true]);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`the search field of the Help menu lists the commands with their path and keys, Return runs one, and Esc closes the menu (${platform})`, async (t) => {
    const page = await load(t, platform);
    await openBar(page, 'Help');
    assert.equal(await page.evaluate(`document.activeElement.matches('.beeson-edit-menu .search input')`), true);
    assert.deepEqual(labels((await rows(page))[0]), ['Keyboard Shortcuts']);

    // a key of the editor is typed into the field, e.g. G, which jumps to a slide outside it
    await press(page, 'g');
    assert.equal(await page.evaluate(`document.activeElement.value`), 'g');
    await press(page, 'Backspace');
    assert.equal(await page.evaluate(`document.activeElement.value`), '');

    await type(page, 'save as');
    let found = (await rows(page))[0];
    const saveAs = found.find((r) => r.label === 'Save As…');
    assert.ok(saveAs, 'Save As… is not found');
    assert.equal(saveAs.path, 'File');
    assert.equal(saveAs.keys, mac ? '⇧⌘S' : 'Ctrl+Shift+S');
    assert.ok(found[0].hi);

    await search(page, 'match style');
    found = (await rows(page))[0];
    const match = found.find((r) => r.label === 'Paste and Match Style');
    assert.equal(match?.path, 'Edit');
    assert.equal(match.keys, mac ? '⌥⇧⌘V' : '');

    await search(page, 'zzzq');
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-menu .results .note')?.textContent`), 'No menu items match');

    // the arrow keys move the highlight through the results, and Return runs the highlighted one
    await search(page, 'spelling');
    found = (await rows(page))[0];
    assert.equal(found[0].label, 'Check Spelling While Typing');
    assert.equal(found[0].path, 'Edit ▸ Spelling and Grammar');
    assert.ok(found[0].hi);
    await press(page, 'ArrowDown');
    assert.ok(!(await rows(page))[0][0].hi);
    await press(page, 'ArrowUp');
    assert.ok((await rows(page))[0][0].hi);
    assert.equal(await page.evaluate(`document.activeElement.getAttribute('aria-activedescendant') === document.querySelector('.beeson-edit-menu .item.hi').id`), true);
    await press(page, 'Enter');
    await frames(page);
    assert.equal(await menus(page), 0);
    assert.equal((await state(page, 'edit.spelling')).checked, false);
    await search(page, 'spelling');
    await press(page, 'Enter');
    assert.equal((await state(page, 'edit.spelling')).checked, true);

    await openBar(page, 'Help');
    await type(page, 'keyboard');
    await press(page, 'Enter');
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-keys[open]')`, 3000);
    await press(page, 'Escape');
    await frames(page);

    await openBar(page, 'Help');
    await type(page, 'grid');
    await press(page, 'Escape');
    await frames(page);
    assert.equal(await menus(page), 0);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}
