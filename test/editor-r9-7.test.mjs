// regression tests of R9.7, the shell of the editor, on both platforms with trusted input: the
// overflow of the toolbar, the keys of the panes and of the chrome, the order of the menu bar, the
// keys of the dialogs, the tree of the accessibility checker, a typed zoom, and the details of the
// status bar and the View menu

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, center, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

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
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const run = (page, id) => page.evaluate(`window.BeesonEditor.exec(${js(id)}).then(() => true)`);
let saves = 0;

// the editor on the slide n of the demo deck served over HTTP, in a window of width by height px.
// the storage of the browser is cleared before the load, and then given the pairs of stored
async function load(t, platform, { n = 0, mode = 'light', width = 1600, height = 1000, stored = {} } = {}) {
  const page = await browser.newPage({ width, height });
  t.after(() => page.close().catch(() => {}));
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }] });
  const url = `${server.origin}/index.html?edit&still&theme=${mode}&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${js(stored)})) localStorage.setItem(k, v); true`);
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('index.html', 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks the text before byte for byte after an undo, the edit after a redo, and an
// open of the saved edit without problems
async function roundTrip(page) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r9-7-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

// the buttons of the toolbar in view: the command of each, its edges, and whether its label is
// shown, with the overflow of the toolbar in px and the buttons past the right edge of the window
const BAR = `(() => {
  const t = document.querySelector('.beeson-edit-top');
  const bs = [...t.querySelectorAll('button.tb')].filter((b) => b.getClientRects().length).map((b) => {
    const r = b.getBoundingClientRect();
    const l = b.querySelector('.label');
    return { id: b.dataset.command ?? (b.classList.contains('more-groups') ? 'more' : ''), left: Math.round(r.left), right: Math.round(r.right), label: !!l && getComputedStyle(l).display !== 'none' };
  });
  return { over: t.scrollWidth - t.clientWidth, buttons: bs, off: bs.filter((b) => b.right > innerWidth).map((b) => b.id) };
})()`;

const TOOLBAR_KEY = 'beeson-edit-toolbar:/index.html';

// the labels of the items of the open menu
const menuLabels = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item .label')].map((l) => l.textContent)`);

// shell-1 and shell-3: a toolbar wider than the window put its last buttons off screen, and the
// labels were hidden below 1100 px whatever the choice of Show
for (const platform of PLATFORMS) {
  test(`a customized toolbar wider than the window folds its last groups into » and keeps every button in view (${platform})`, async (t) => {
    for (const width of [1280, 1100]) {
      const page = await load(t, platform, { width, height: 900 });
      await run(page, 'view.customizeToolbar');
      for (const id of ['file.open', 'find.open', 'view.notes', 'view.accessibility', 'play.rehearse', 'arrange.group']) {
        await page.evaluate(`document.querySelector('.beeson-edit-customize .item[data-item="${id}"]').focus()`);
        await press(page, 'Enter');
      }
      await click(page, '.beeson-edit-customize .done');
      await frames(page);
      const bar = await page.evaluate(BAR);
      assert.deepEqual(bar.off, [], `${width}: buttons off screen`);
      assert.ok(bar.over <= 0, `${width}: the toolbar overflows by ${bar.over} px`);
      assert.ok(bar.buttons.some((b) => b.id === 'more'), `${width}: no » menu`);
      assert.ok(bar.buttons.every((b) => b.label), `${width}: the labels are hidden`);
      // the folded buttons are items of the menu », and none of them is also in the toolbar
      await click(page, '.beeson-edit-top .more-groups');
      assert.ok((await menuLabels(page)).length > 0, `${width}: the menu » is empty`);
      for (const { id } of bar.buttons) if (id !== 'more') assert.ok(await page.evaluate(`!document.querySelector('.beeson-edit-menu .item[data-command="${id}"]')`), `${width}: ${id} is both in the toolbar and in »`);
      await press(page, 'Escape');
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });

  test(`the labels of the default toolbar are kept at every width at which they fit (${platform})`, async (t) => {
    for (const width of [1100, 1099, 1000]) {
      const page = await load(t, platform, { width, height: 800 });
      const bar = await page.evaluate(BAR);
      assert.ok(bar.buttons.every((b) => b.label), `${width}: the labels are hidden`);
      assert.ok(bar.over <= 0, `${width}: the toolbar overflows by ${bar.over} px`);
      assert.ok(!bar.buttons.some((b) => b.id === 'more'), `${width}: » is shown though every button fits`);
      await page.close();
    }
    // with Icon Only, the labels stay hidden at a width at which they fit
    const page = await load(t, platform, { width: 1600, height: 900, stored: { [TOOLBAR_KEY]: js({ items: null, show: 'icon' }) } });
    assert.ok((await page.evaluate(BAR)).buttons.every((b) => !b.label), 'a label is shown with Icon Only');
    assert.deepEqual(errors(page), []);
  });
}
