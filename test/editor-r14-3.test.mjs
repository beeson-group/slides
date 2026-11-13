// regression tests of R14.3 on both platforms with trusted input: New Slide in the Light Table
// keeps the focus on the tile of the new slide, and Select All and Delete of the Edit menu act on
// the slides while a tile or a row of the navigator has the focus, with the keys that run them there

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press } from './helpers/editor.mjs';

const DECK = 'test-deck.html';
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
const settle = (page) => page.evaluate('new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), 150))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const MOD_A = { mac: '⌘A', other: 'Ctrl+A' };

async function load(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await settle(page);
  return page;
}

const rect = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const tile = (page, i) => rect(page, `document.querySelectorAll('.beeson-edit-sorter .tile .pic')[${i}]`);
const row = (page, i) => rect(page, `document.querySelectorAll('.beeson-edit-nav .row')[${i}]`);
const item = (page, label) => rect(page, `[...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.getClientRects().length && i.querySelector('.label')?.textContent === ${js(label)})`);
const itemState = (page, label) => page.evaluate(`(() => { const i = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.getClientRects().length && i.querySelector('.label')?.textContent === ${js(label)}); return i ? { keys: i.querySelector('.keys')?.textContent ?? '', disabled: i.getAttribute('aria-disabled') === 'true' } : null; })()`);
const closeMenus = async (page) => { await page.evaluate('window.BeesonEditorShell?.closeMenus?.(); true'); await settle(page); };

async function openBar(page, bar) {
  await click(page, await rect(page, `[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)})`));
  await settle(page);
}

const tiles = (page) => page.evaluate(`(() => {
  const all = [...document.querySelectorAll('.beeson-edit-sorter .tile')];
  const a = document.activeElement;
  const r = a.getBoundingClientRect();
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { n: all.length, focus: all.indexOf(a), covered: !!top && !a.contains(top), selected: all.flatMap((t, i) => (t.getAttribute('aria-selected') === 'true' ? [i] : [])) };
})()`);
const rows = (page) => page.evaluate(`(() => { const all = [...document.querySelectorAll('.beeson-edit-nav .row')]; return { n: all.length, selected: all.flatMap((r, i) => (r.getAttribute('aria-selected') === 'true' ? [i] : [])) }; })()`);

async function lightTable(page) {
  await page.evaluate(`BeesonEditor.exec('view.lightTable')`);
  await settle(page);
  await click(page, await tile(page, 3));
  await settle(page);
}

for (const platform of PLATFORMS) {
  for (const how of ['key', 'menu']) {
    test(`New Slide by its ${how} in the Light Table keeps the focus on the tile of the new slide (${platform})`, async (t) => {
      const page = await load(t, platform);
      await lightTable(page);
      const n = (await tiles(page)).n;
      if (how === 'key') await press(page, 'Ctrl+M');
      else {
        await click(page, await tile(page, 3), { button: 'right' });
        await settle(page);
        await click(page, await item(page, 'New Slide'));
      }
      await settle(page);
      const s = await tiles(page);
      assert.deepEqual(s, { n: n + 1, focus: 4, covered: false, selected: [4] });
      const added = await render(page);
      assert.notEqual(added, page.source);
      await press(page, 'q');
      await settle(page);
      assert.equal(await render(page), added, 'a typed letter does not go into a hidden slide');
      await press(page, 'ArrowRight');
      await settle(page);
      assert.equal((await tiles(page)).focus, 5);
      await undo(page);
      await settle(page);
      assert.equal(await render(page), page.source);
      assert.deepEqual(errors(page), []);
    });
  }

  test(`Select All Slides and Edit > Select All with a tile focused in the Light Table (${platform})`, async (t) => {
    const page = await load(t, platform);
    await lightTable(page);
    const n = (await tiles(page)).n;
    await click(page, await tile(page, 3), { button: 'right' });
    await settle(page);
    assert.deepEqual(await itemState(page, 'Select All Slides'), { keys: MOD_A[platform], disabled: false });
    await closeMenus(page);
    await click(page, await tile(page, 3));
    await settle(page);
    await openBar(page, 'Edit');
    assert.deepEqual(await itemState(page, 'Select All'), { keys: MOD_A[platform], disabled: false });
    await click(page, await item(page, 'Select All'));
    await settle(page);
    assert.deepEqual((await tiles(page)).selected, [...Array(n).keys()]);
    await click(page, await tile(page, 2));
    await settle(page);
    await press(page, 'Mod+A');
    await settle(page);
    assert.deepEqual((await tiles(page)).selected, [...Array(n).keys()]);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`Edit > Select All and Edit > Delete with a row of the navigator focused (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await row(page, 4));
    await settle(page);
    const n = (await rows(page)).n;
    await openBar(page, 'Edit');
    assert.deepEqual(await itemState(page, 'Select All'), { keys: MOD_A[platform], disabled: false });
    assert.deepEqual(await itemState(page, 'Delete'), { keys: platform === 'mac' ? '⌫' : 'Delete', disabled: false });
    await click(page, await item(page, 'Select All'));
    await settle(page);
    assert.deepEqual((await rows(page)).selected, [...Array(n).keys()]);
    await click(page, await row(page, 4));
    await settle(page);
    await openBar(page, 'Edit');
    await click(page, await item(page, 'Delete'));
    await settle(page);
    const s = await rows(page);
    assert.equal(s.n, n - 1);
    assert.deepEqual(s.selected, [4]);
    const sections = (text) => text.split('<section').length;
    assert.equal(sections(await render(page)), sections(page.source) - 1);
    await undo(page);
    await settle(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}

// a figure selected on the canvas stays selected while the caret is in a field of a pane, where
// Delete and Select All of the Edit menu act on the text of the field
for (const platform of PLATFORMS) {
  for (const [what, field] of [
    ['the Description field of the Format pane', () => `document.querySelector('#beeson-edit-panel-format textarea[name="alt"]')`],
  ]) {
    test(`Edit > Delete and Edit > Select All with the caret in ${what} act on its text, and not on the figure selected on the canvas (${platform})`, async (t) => {
      const page = await load(t, platform);
      const n = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('figure.zone'))`);
      await page.evaluate(`Reveal.slide(${n})`);
      await settle(page);
      const at = field(n);
      const figure = () => rect(page, `[...document.querySelectorAll('.reveal section.present figure.zone img')].find((i) => i.getClientRects().length)`);
      const figures = (text) => text.split('<figure').length;
      const textOf = () => page.evaluate(`(() => { const f = ${at}; return 'value' in f ? f.value : f.textContent; })()`);
      const choose = async (label) => {
        await openBar(page, 'Edit');
        const state = await itemState(page, label);
        await click(page, await item(page, label));
        await settle(page);
        await closeMenus(page);
        return state;
      };
      await click(page, await figure());
      await settle(page);
      await click(page, await rect(page, at));
      await settle(page);
      assert.ok(await page.evaluate(`document.activeElement === ${at}`), `the caret is not in ${what}`);
      const text = await textOf();
      assert.ok(text.length > 3, `${what} does not have a text`);
      // at a caret, Delete is dimmed, as in a text of the slide
      const caret = await choose('Delete');
      assert.equal(figures(await render(page)), figures(page.source), `Edit > Delete at a caret in ${what} deleted the figure`);
      assert.equal(caret.disabled, true, `Edit > Delete is not dimmed at a caret in ${what}`);
      await choose('Select All');
      const selected = await page.evaluate(`(() => { const f = ${at}; return document.activeElement === f && ('value' in f ? f.value.slice(f.selectionStart, f.selectionEnd) : getSelection().toString()); })()`);
      assert.equal(selected, text, `Edit > Select All does not select the text of ${what}`);
      const range = await choose('Delete');
      assert.equal(range.disabled, false, `Edit > Delete is dimmed on a selected text in ${what}`);
      assert.equal(await textOf(), '', `Edit > Delete does not delete the selected text of ${what}`);
      assert.equal(figures(await render(page)), figures(page.source), `Edit > Delete on a selected text in ${what} deleted the figure`);
      // a paste is plain text in the field
      await page.evaluate(`Promise.resolve(window.BeesonEditor.exec('edit.paste', 'One\\n two')).then(() => true)`);
      await settle(page);
      assert.equal(await textOf(), 'One\n two', `Paste does not put the text into ${what}`);
      assert.equal(figures(await render(page)), figures(page.source), `Paste with the caret in ${what} changed the figures of the slide`);
      // a press on the figure takes the focus out of the text, and Delete acts on the figure again
      await click(page, await figure(), { button: 'right' });
      await settle(page);
      assert.equal((await itemState(page, 'Delete'))?.disabled, false, 'Delete is dimmed in the menu of the figure');
      await click(page, await item(page, 'Delete'));
      await settle(page);
      assert.equal(figures(await render(page)), figures(page.source) - 1, 'Delete in the menu of the figure does not delete it');
      assert.deepEqual(errors(page), []);
    });
  }
}
