// regression tests of R25.1 on both platforms: a selection of a backdrop and a build of its pane
// read no file of the list of backdrops, Paste of the Edit menu and of the text menu sets the
// spaces of one word as the paste of the key does, and the top row fits a narrow window with a
// wide interface font

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'index.html';
const LAYOUTS = 'test/pages/editor-layouts.html';
const BACKDROP = [...readFileSync(LAYOUTS, 'utf8').matchAll(/<section[\s\S]*?<\/section>/g)].findIndex((m) => m[0].includes('A figure slide with a backdrop'));
const PANEL = '#beeson-edit-panel-format';
// the files of the list of backdrops, which are not next to a page under test/pages/
const FILES = /brand\/transfer\.js|demo\/broucke-sample\.js/;

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
const wait = (page, ms) => page.evaluate(`new Promise((d) => setTimeout(() => requestAnimationFrame(() => d(true)), ${ms}))`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const exec = (page, id) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)})).then(() => true)`);
let saves = 0;

// the editor on slide n of a deck, served over HTTP, with the storage of the origin emptied
async function load(t, platform, deck, n, size = { width: 1600, height: 1000 }) {
  const page = await browser.newPage(size);
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

// the URLs of the files of the list of backdrops that the page requested
const requested = (page) => page.evaluate(`performance.getEntriesByType('resource').map((e) => e.name).filter((n) => ${FILES}.test(n))`);

// the names of the entries of the Drawing popup of the Format pane, opened by a click
async function drawingItems(page) {
  await click(page, `${PANEL} [aria-label="Drawing"]`);
  await page.waitFor(`!!document.querySelector('.beeson-edit-menu.select')`);
  return page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu.select .item')].map((i) => i.querySelector('.label')?.textContent ?? i.textContent)`);
}

for (const platform of PLATFORMS) {
  // the files are read only when the Drawing popup or the list of Media > Backdrop… is opened,
  // hence a deck without brand/ and demo/ does not log a 404 at a selection of its backdrop
  test(`a selection of a backdrop and a build of its pane do not request a file of the list of backdrops (${platform})`, async (t) => {
    const page = await load(t, platform, LAYOUTS, BACKDROP);
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await exec(page, 'backdrop.select');
    await wait(page, 600);
    assert.equal(await page.evaluate(`!!document.querySelector('${PANEL} [aria-label="Drawing"]')`), true, 'the Backdrop pane is not built');
    // the pane is built again for the backdrop of the title slide
    await page.evaluate(`Reveal.slide(0)`);
    await frames(page);
    await exec(page, 'backdrop.select');
    await wait(page, 600);
    assert.deepEqual(await requested(page), []);
    assert.deepEqual(errors(page), []);
  });

  test(`the Drawing popup opened before the list of Media > Backdrop… leaves out an entry whose file is not found (${platform})`, async (t) => {
    const page = await load(t, platform, LAYOUTS, BACKDROP);
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await exec(page, 'backdrop.select');
    await frames(page);
    const items = await drawingItems(page);
    assert.deepEqual(items, ['Lyapunov Families', 'Cislunar Manifolds', 'Earth Manifolds', 'mark'], 'the popup lists an entry whose file is not found');
    assert.ok((await requested(page)).length > 0, 'the popup does not read the files');
    assert.deepEqual(errors(page).filter((e) => !FILES.test(e)), []);
  });
}

// the caret put at the mark | of at, e.g. 'steps.| Direct', into the paragraph of the current slide
async function caretAt(page, at) {
  const needle = at.replace('|', '');
  await page.evaluate(`(() => {
    const el = [...document.querySelectorAll('.reveal section.present > p')].find((p) => p.textContent.includes(${js(needle)}));
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const i = n.data.indexOf(${js(needle)});
      if (i < 0) continue;
      el.closest('[contenteditable="true"]')?.focus();
      getSelection().collapse(n, i + ${at.indexOf('|')});
      return;
    }
    throw new Error('the text ${needle} is not in the paragraph');
  })()`);
}

// the point near the left end of the paragraph of the current slide that holds the text of at
const pointOf = (page, at) => page.evaluate(`(() => { const r = [...document.querySelectorAll('.reveal section.present > p')].find((p) => p.textContent.includes(${js(at.replace('|', ''))})).getBoundingClientRect(); return { x: r.left + 4, y: r.top + r.height / 2 }; })()`);

// the caret put into the paragraph by a click, then collapsed at the mark
async function enterText(page, at) {
  await click(page, await pointOf(page, at));
  await frames(page);
  await caretAt(page, at);
}

// readText of the page gives text, so that the system clipboard, which other tests share, is not
// read by the editor
const stubClipboard = (page, text) => page.evaluate(`Object.defineProperty(navigator.clipboard, 'readText', { configurable: true, value: async () => ${js(text)} })`);

// an entry of the open menu chosen by a click
async function clickItem(page, item) {
  const at = await page.evaluate(`(() => { const e = [...document.querySelectorAll('[role=menu] [role^=menuitem]')].find((x) => x.getClientRects().length && (x.querySelector('.label')?.textContent ?? x.textContent).trim() === ${js(item)}); const r = e.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await wait(page, 300);
}

const menuOpen = `[...document.querySelectorAll('[role=menu] [role^=menuitem]')].some((x) => x.getClientRects().length)`;

// an entry of the Edit menu of the menu bar chosen by clicks
async function barMenu(page, item) {
  await click(page, '.beeson-edit-menubar [role=menuitem]:nth-child(2)');
  await page.waitFor(menuOpen);
  await clickItem(page, item);
}

// an entry of the menu of the text, opened by a right-click into the paragraph. a right-click
// selects a word on a Mac, hence the caret is put at the mark again while the menu is open
async function textMenu(page, at, item) {
  await click(page, await pointOf(page, at), { button: 'right' });
  await page.waitFor(menuOpen);
  await caretAt(page, at);
  await clickItem(page, item);
}

// the paste checked against page.source after an undo, again after a redo, and after a save and an
// open. it returns the line of the edited text that holds probe
async function roundTrip(page, probe) {
  const edited = await render(page);
  const line = edited.split('\n').find((l) => l.includes(probe)) ?? '';
  assert.notEqual(edited, page.source, 'the paste does not change the file');
  await undo(page);
  assert.equal(await render(page), page.source, 'the undo does not give the file back byte for byte');
  await redo(page);
  assert.equal(await render(page), edited, 'the redo does not write the paste again');
  const { text } = await saveAndReopen(page, `r25-1-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  return line;
}

// each case gives the route, the entry, the caret, the clipboard text, and the saved text, which
// are those of the paste by the key in test/editor-r24-1.test.mjs
const CASES = [
  ['Paste of the Edit menu', 'bar', 'Paste', 'steps.| Direct', 'break ', 'then break it up into steps. break Direct'],
  ['Paste of the Edit menu', 'bar', 'Paste', 'attention.|', 'break ', 'the viewer\'s attention. break</p>'],
  ['Paste of the Edit menu', 'bar', 'Paste', 'steps|.', 'break ', 'into steps break. Direct'],
  ['Paste of the Edit menu', 'bar', 'Paste', 'steps.| Direct', 'break it ', 'into steps.break it  Direct'],
  ['Paste of the Edit menu', 'bar', 'Paste', 'Des|ign the', 'ak ', '<p>Desak ign the'],
  ['Paste of the text menu', 'text', 'Paste', 'steps.| Direct', 'break ', 'then break it up into steps. break Direct'],
  ['Paste and Match Style of the text menu', 'text', 'Paste and Match Style', 'steps.| Direct', 'break ', 'then break it up into steps. break Direct'],
];

for (const platform of PLATFORMS) {
  for (const [name, route, item, at, clip, expected] of CASES) {
    test(`${name} of ${js(clip)} at ${js(at)} gives ${js(expected)} as the key does (${platform})`, async (t) => {
      const page = await load(t, platform, DECK, 2);
      await stubClipboard(page, clip);
      await enterText(page, at);
      if (route === 'bar') await barMenu(page, item);
      else await textMenu(page, at, item);
      const line = await roundTrip(page, 'attention');
      assert.ok(line.includes(expected), `the paste saved ${js(line.trim())}`);
    });
  }
}

// Verdana is about as wide as DejaVu Sans, the interface font of WSL, in which the Autosave button
// was at 480 to 584 px in a window of 560 px
const WIDE = 'Verdana, "DejaVu Sans", sans-serif';
// the menus and the buttons of the top row that are cut off, the right end of the elements of the
// row, and the scroll widths of the body and of the row
const topRow = (page) => page.evaluate(`(() => {
  const W = innerWidth;
  const row = document.querySelector('.beeson-edit-titlebar');
  const cut = [];
  for (const b of row.querySelectorAll('.beeson-edit-menubar [role=menuitem], .right button')) {
    const r = b.getBoundingClientRect();
    if (!r.width) continue;
    const hit = document.elementFromPoint(Math.min(r.right - 2, W - 1), r.top + r.height / 2);
    if (r.left < -0.5 || r.right > W + 0.5 || b.scrollWidth > b.clientWidth + 0.5 || !b.contains(hit)) cut.push((b.textContent || b.className) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
  }
  const right = Math.max(...[row, ...row.querySelectorAll('*')].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().right));
  return { cut, right, body: document.body.scrollWidth, row: row.scrollWidth, width: W };
})()`);

for (const platform of PLATFORMS) {
  for (const font of [null, WIDE]) {
    test(`the top row fits every window from 480 px on with ${font ? 'a wide' : 'the default'} interface font (${platform})`, async (t) => {
      const page = await load(t, platform, DECK, 1, { width: 560, height: 700 });
      if (font) await page.evaluate(`document.documentElement.style.setProperty('--ed-font', ${js(font)})`);
      await wait(page, 300);
      for (const width of [480, 500, 520, 560, 600, 700, 800, 900, 1000, 1280]) {
        await page.send('Emulation.setDeviceMetricsOverride', { width, height: 700, deviceScaleFactor: 1, mobile: false });
        await wait(page, 300);
        const m = await topRow(page);
        assert.deepEqual(m.cut, [], `a menu or a button of the top row is cut off at ${width} px`);
        assert.ok(m.row <= m.width && m.right <= m.width + 0.5, `the top row is ${m.row} px wide and ends at ${m.right} px in a window of ${m.width} px`);
        // the status bar is wider than a window below 520 px, which this test does not cover
        if (width >= 560) assert.ok(m.body <= m.width, `the body is ${m.body} px wide in a window of ${m.width} px`);
      }
      assert.deepEqual(errors(page), []);
    });
  }
}
