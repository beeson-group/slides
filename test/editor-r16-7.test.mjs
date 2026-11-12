// the key of Duplicate Slide of R16.7 on both platforms, with trusted input. Mod+D is the key of
// Edit > Duplicate, which duplicates the selected figure, and the slide in the navigator and with
// nothing selected. the Slide menu thus lists Duplicate Slide with the key only where the key runs
// it, as it lists Delete Slide, and the item stays live

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press } from './helpers/editor.mjs';

const DECK = 'index.html';
// the index of the figures slide in index.html
const FIGURES = 4;
const PLATFORMS = ['mac', 'other'];
const DUPLICATE = { mac: '⌘D', other: 'Ctrl+D' };

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
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const slides = (page) => page.evaluate(`document.querySelectorAll('.reveal .slides > section').length`);
const figures = (page) => page.evaluate(`Reveal.getCurrentSlide().querySelectorAll('figure').length`);

async function load(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&theme=light&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`)).problems, []);
  await page.evaluate(`Reveal.slide(${FIGURES})`);
  await settle(page);
  return page;
}

const rect = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const findItem = `(l) => [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.getClientRects().length && i.querySelector('.label')?.firstChild?.textContent === l)`;
const closeMenus = async (page) => { await page.evaluate('window.BeesonEditorShell?.closeMenus?.(); true'); await settle(page); };

async function openBar(page, bar) {
  await click(page, await rect(page, `[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)})`));
  await settle(page);
}

// the key printed and the dimmed state of the item label of the menu bar, read from the open menu,
// which is then closed
async function itemIn(page, bar, label) {
  await openBar(page, bar);
  const out = await page.evaluate(`(() => { const i = (${findItem})(${js(label)}); return i ? { keys: i.querySelector('.keys')?.textContent ?? '', dimmed: i.getAttribute('aria-disabled') === 'true' } : null; })()`);
  await closeMenus(page);
  return out;
}

// a point of the canvas under the slide
const below = (page) => page.evaluate(`(() => { const r = document.querySelector('.reveal .slides').getBoundingClientRect(); return { x: Math.round(r.left + 6), y: Math.round(r.bottom + 12) }; })()`);

for (const platform of PLATFORMS) {
  const live = { keys: '', dimmed: false };
  const keyed = { keys: DUPLICATE[platform], dimmed: false };

  test(`with a figure selected, Duplicate Slide is listed without a key, and Mod+D duplicates the figure (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, '.reveal .slides > section.present img');
    await settle(page);
    assert.deepEqual(await itemIn(page, 'Slide', 'Duplicate Slide'), live);
    assert.deepEqual(await itemIn(page, 'Edit', 'Duplicate'), keyed);
    await press(page, 'Mod+D');
    await settle(page);
    assert.equal(await figures(page), 2);
    assert.equal(await slides(page), 12);
    assert.equal(await undoLabel(page), 'Undo Duplicate');
    await undo(page);
    assert.equal(await render(page), page.source);
    // the item of the Slide menu duplicates the slide while the figure is selected
    await click(page, '.reveal .slides > section.present img');
    await settle(page);
    await openBar(page, 'Slide');
    await click(page, await rect(page, `(${findItem})('Duplicate Slide')`));
    await settle(page);
    assert.equal(await slides(page), 13);
    assert.equal(await undoLabel(page), 'Undo Duplicate Slide');
    await undo(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`in the navigator, Mod+D duplicates the slide as Edit > Duplicate, and Duplicate Slide is listed with the key (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await rect(page, `document.querySelectorAll('.beeson-edit-nav .row')[${FIGURES}]`));
    await settle(page);
    assert.deepEqual(await itemIn(page, 'Slide', 'Duplicate Slide'), keyed);
    assert.deepEqual(await itemIn(page, 'Edit', 'Duplicate'), keyed);
    await click(page, await rect(page, `document.querySelectorAll('.beeson-edit-nav .row')[${FIGURES}]`));
    await settle(page);
    await press(page, 'Mod+D');
    await settle(page);
    assert.equal(await slides(page), 13);
    assert.equal(await undoLabel(page), 'Undo Duplicate Slide');
    await undo(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`with nothing selected on the canvas, Mod+D duplicates the slide, and Duplicate Slide is listed with the key (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await below(page));
    await settle(page);
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 0);
    assert.deepEqual(await itemIn(page, 'Slide', 'Duplicate Slide'), keyed);
    assert.deepEqual(await itemIn(page, 'Edit', 'Duplicate'), keyed);
    await click(page, await below(page));
    await settle(page);
    await press(page, 'Mod+D');
    await settle(page);
    assert.equal(await slides(page), 13);
    assert.equal(await undoLabel(page), 'Undo Duplicate Slide');
    await undo(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`the sheet of shortcuts lists Mod+D at Duplicate, and not at Duplicate Slide (${platform})`, async (t) => {
    const page = await load(t, platform);
    await page.evaluate(`window.BeesonEditor.exec('help.keys')`);
    await settle(page);
    const rows = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-keys .row')].map((r) => ({ label: r.firstElementChild.textContent, keys: r.querySelector('kbd').textContent.split(', ') }))`);
    const keysOf = (label) => rows.find((r) => r.label === label)?.keys ?? [];
    assert.deepEqual(keysOf('Duplicate Slide'), []);
    assert.ok(keysOf('Duplicate').includes(DUPLICATE[platform]), js(keysOf('Duplicate')));
    assert.deepEqual(errors(page), []);
  });
}
