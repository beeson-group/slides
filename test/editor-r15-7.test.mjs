// the work of R15.7 on both platforms with trusted input: a menu lists the key of an item in every
// region, and the key runs the item, in a text and on a framed formula, apart from Delete Slide,
// which is without a key. the entry of a slide deleted by Edit > Delete in the navigator, the check
// of View > Navigator in a narrow window, and File > Export To > PowerPoint…

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const DECK = 'index.html';
// the index of the figures slide in index.html
const FIGURES = 4;
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
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

async function load(t, platform, size = { width: 1600, height: 1000 }) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&theme=light&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${FIGURES})`);
  await settle(page);
  return page;
}

// an undo gives the text before and a redo the edited text byte for byte, and the saved text is
// opened again without problems
async function checkEdit(page, name, before = page.source) {
  const edited = await render(page);
  assert.notEqual(edited, before);
  await undo(page);
  assert.equal(await render(page), before);
  await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, name);
  assert.equal(text, edited);
}

const rect = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const findItem = `(l) => [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.getClientRects().length && i.querySelector('.label')?.firstChild?.textContent === l)`;
const closeMenus = async (page) => { await page.evaluate('window.BeesonEditorShell?.closeMenus?.(); true'); await settle(page); };

async function openBar(page, bar) {
  await click(page, await rect(page, `[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)})`));
  await settle(page);
}

async function choose(page, bar, label) {
  await openBar(page, bar);
  await click(page, await rect(page, `(${findItem})(${js(label)})`));
  await settle(page);
}

// the key printed and the dimmed state of each item of labels in the menu bar named bar, read from
// the open menu, which is then closed
async function itemsIn(page, bar, labels) {
  await openBar(page, bar);
  const out = await page.evaluate(`Object.fromEntries(${js(labels)}.map((l) => { const i = (${findItem})(l); return [l, i ? { keys: i.querySelector('.keys')?.textContent ?? '', dimmed: i.getAttribute('aria-disabled') === 'true' } : null]; }))`);
  await closeMenus(page);
  return out;
}

// the middle of a word of the first paragraph of the current slide
const wordAt = (page, word) => page.evaluate(`(() => {
  const el = Reveal.getCurrentSlide().querySelector(':scope > p');
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = w.nextNode(); node; node = w.nextNode()) {
    const at = node.textContent.indexOf(${js(word)});
    if (at < 0) continue;
    const r = document.createRange(); r.setStart(node, at); r.setEnd(node, at + ${js(word)}.length);
    const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }
  return null;
})()`);

const state = (page) => page.evaluate(`(() => {
  const a = document.activeElement;
  return {
    slides: document.querySelectorAll('.reveal .slides > section').length,
    blocks: Reveal.getCurrentSlide().children.length,
    selected: window.BeesonEditor.selection().map((el) => el.tagName.toLowerCase()),
    focus: a === document.body ? 'body' : a.tagName.toLowerCase() + (a.isContentEditable ? ' editable' : ''),
    words: getSelection().toString(),
  };
})()`);

// a point of the canvas under the slide
const below = (page) => page.evaluate(`(() => { const r = document.querySelector('.reveal .slides').getBoundingClientRect(); return { x: Math.round(r.left + 6), y: Math.round(r.bottom + 12) }; })()`);

// Insert > Formula with its TeX typed, closed by a click on the canvas under the slide, which keeps
// the formula framed with the focus on its div.math, as in state 286 of round 6
async function newFormula(page) {
  await choose(page, 'Insert', 'Formula');
  await type(page, 'x^2 + y^2');
  await settle(page);
  await click(page, await below(page));
  await settle(page);
}

// whether the last keydown of key reached the page with its default prevented, i.e. was kept from
// the browser, e.g. ⌘D from the bookmarks of Chrome
const watchKeys = (page) => page.evaluate(`(() => { window.__keys = {}; addEventListener('keydown', (ev) => { window.__keys[ev.key.toLowerCase()] = ev.defaultPrevented; }, true); return true; })()`);
const prevented = (page, key) => page.evaluate(`window.__keys[${js(key)}] ?? null`);

const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);

const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);

const KEYS = {
  mac: { duplicate: '⌘D', deselect: '⇧⌘A', delete: '⌫', press: 'Backspace' },
  other: { duplicate: 'Ctrl+D', deselect: 'Ctrl+Shift+A', delete: 'Delete', press: 'Delete' },
};

for (const platform of PLATFORMS) {
  const K = KEYS[platform];

  // item 1a: Edit > Duplicate and Edit > Deselect are enabled at a caret in a text, and their keys
  // run them there and are listed. Duplicate leaves the text and duplicates its block, as Esc and
  // Duplicate do, and Deselect leaves the text with nothing selected
  test(`Mod+D and Mod+Shift+A run Duplicate and Deselect at a caret in a text, and the Edit menu lists them (${platform})`, async (t) => {
    const page = await load(t, platform);
    await watchKeys(page);
    const caret = async () => {
      await click(page, await wordAt(page, 'your'));
      await settle(page);
      assert.equal((await state(page)).focus, 'p editable');
    };
    // the block duplicated by Esc and Duplicate
    await caret();
    await press(page, 'Escape');
    await press(page, 'Mod+D');
    await settle(page);
    const copied = await render(page);
    assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelectorAll(':scope > p').length`), 2);
    await undo(page);
    await settle(page);
    assert.equal(await render(page), page.source);
    await caret();
    assert.deepEqual(await itemsIn(page, 'Edit', ['Duplicate', 'Deselect']), { Duplicate: { keys: K.duplicate, dimmed: false }, Deselect: { keys: K.deselect, dimmed: false } });
    await caret();
    await choose(page, 'Edit', 'Duplicate');
    assert.equal(await render(page), copied, 'Edit > Duplicate in a text does not duplicate the block of the caret');
    await undo(page);
    await settle(page);
    assert.equal(await render(page), page.source);
    await caret();
    await press(page, 'Mod+D');
    await settle(page);
    assert.equal(await prevented(page, 'd'), true, 'the browser does not get Mod+D');
    assert.equal((await state(page)).slides, 12, 'Mod+D in a text does not duplicate the slide');
    assert.equal(await render(page), copied, 'Mod+D in a text does not duplicate the block of the caret');
    assert.equal(await undoLabel(page), 'Undo Duplicate');
    await checkEdit(page, `r15-7-duplicate-${platform}.html`);
    await caret();
    await press(page, 'Mod+Shift+A');
    await settle(page);
    assert.deepEqual(await state(page), { slides: 12, blocks: 7, selected: [], focus: 'body', words: '' }, 'Mod+Shift+A leaves the text with nothing selected, as Edit > Deselect does');
    assert.equal(await prevented(page, 'a'), true);
    await caret();
    await choose(page, 'Edit', 'Deselect');
    assert.deepEqual(await state(page), { slides: 12, blocks: 7, selected: [], focus: 'body', words: '' });
    // Esc in a text still selects its block
    await caret();
    await press(page, 'Escape');
    await settle(page);
    assert.deepEqual((await state(page)).selected, ['p']);
    assert.equal(await render(page), copied);
    assert.deepEqual(errors(page), []);
  });

  // item 1b: ⌫ deletes the words selected in a text, as Edit > Delete does, hence the menu lists
  // it. Delete Slide is without a key
  test(`Edit > Delete lists the key that deletes the words selected in a text (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await wordAt(page, 'matplotlib'), { count: 2 });
    await settle(page);
    assert.equal((await state(page)).words.trim(), 'matplotlib');
    assert.deepEqual(await itemsIn(page, 'Edit', ['Delete']), { Delete: { keys: K.delete, dimmed: false } });
    assert.deepEqual(await itemsIn(page, 'Slide', ['Delete Slide']), { 'Delete Slide': { keys: '', dimmed: false } });
    await click(page, await wordAt(page, 'matplotlib'), { count: 2 });
    await settle(page);
    await press(page, K.press);
    await settle(page);
    const s = await state(page);
    assert.equal(s.slides, 12);
    assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelector(':scope > p').textContent.includes('matplotlib')`), false);
    await checkEdit(page, `r15-7-delete-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });

  // item 1c: a new display framed after its TeX field is closed takes the keys of the slide
  test(`Mod+D duplicates a framed formula after Insert > Formula, and the Edit menu lists its keys (${platform})`, async (t) => {
    const page = await load(t, platform);
    await watchKeys(page);
    await newFormula(page);
    const inserted = await render(page);
    assert.deepEqual(await state(page), { slides: 12, blocks: 7, selected: ['div'], focus: 'div editable', words: '' });
    assert.deepEqual(await itemsIn(page, 'Edit', ['Duplicate', 'Deselect', 'Delete']), {
      Duplicate: { keys: K.duplicate, dimmed: false },
      Deselect: { keys: K.deselect, dimmed: false },
      Delete: { keys: K.delete, dimmed: false },
    });
    await press(page, 'Mod+D');
    await settle(page);
    const s = await state(page);
    assert.equal(s.slides, 12, 'Mod+D does not duplicate the slide');
    assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelectorAll(':scope > div.math').length`), 2);
    assert.equal(await prevented(page, 'd'), true);
    await checkEdit(page, `r15-7-formula-${platform}.html`, inserted);
    assert.deepEqual(errors(page), []);
  });

  test(`Mod+Shift+A and the Delete key act on a framed formula after Insert > Formula (${platform})`, async (t) => {
    const page = await load(t, platform);
    await newFormula(page);
    const inserted = await render(page);
    await press(page, 'Mod+Shift+A');
    await settle(page);
    assert.deepEqual((await state(page)).selected, [], 'Mod+Shift+A deselects the formula');
    assert.equal(await render(page), inserted);
    await undo(page);
    await settle(page);
    assert.equal(await render(page), page.source);
    await newFormula(page);
    await press(page, K.press);
    await settle(page);
    assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelectorAll(':scope > div.math').length`), 0, 'the key deletes the formula');
    assert.equal(await render(page), page.source);
    await undo(page);
    await settle(page);
    assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelectorAll(':scope > div.math').length`), 1);
    assert.deepEqual(errors(page), []);
  });
}

const firstEditItem = async (page) => {
  await openBar(page, 'Edit');
  const label = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.getClientRects().length)?.querySelector('.label')?.textContent`);
  await closeMenus(page);
  return label;
};

// the key and the dimmed state of each item of labels in the open menu at the top
const openItems = (page, labels) => page.evaluate(`Object.fromEntries(${js(labels)}.map((l) => { const i = (${findItem})(l); return [l, i ? { keys: i.querySelector('.keys')?.textContent ?? '', dimmed: i.getAttribute('aria-disabled') === 'true' } : null]; }))`);
const cell = (page) => rect(page, `Reveal.getCurrentSlide().querySelector('table').rows[1].cells[1]`);
const size = (page) => page.evaluate(`(() => { const t = Reveal.getCurrentSlide().querySelector('table'); return [t.rows.length, t.rows[0].cells.length]; })()`);
const ADD = ['Add Row Above', 'Add Row Below', 'Add Column Before', 'Add Column After'];

for (const platform of PLATFORMS) {
  const K = KEYS[platform];

  // item 1, the exception: Delete Slide and Duplicate Slide list the keys of Edit > Delete and Edit >
  // Duplicate only where the keys act on the slide, i.e. in the navigator, and Mod+D also with
  // nothing selected on the canvas
  test(`Delete Slide and Duplicate Slide list their keys only where the keys run them, and Edit > Delete and Edit > Duplicate list their keys in the navigator (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await below(page));
    await settle(page);
    assert.deepEqual(await itemsIn(page, 'Slide', ['Delete Slide', 'Duplicate Slide']), { 'Delete Slide': { keys: '', dimmed: false }, 'Duplicate Slide': { keys: K.duplicate, dimmed: false } });
    await click(page, '.reveal .slides > section.present img');
    await settle(page);
    assert.deepEqual(await itemsIn(page, 'Slide', ['Delete Slide', 'Duplicate Slide']), { 'Delete Slide': { keys: '', dimmed: false }, 'Duplicate Slide': { keys: '', dimmed: false } });
    const row = await rect(page, `document.querySelectorAll('.beeson-edit-nav .row')[${FIGURES}]`);
    await click(page, row);
    await settle(page);
    assert.deepEqual(await itemsIn(page, 'Slide', ['Delete Slide']), { 'Delete Slide': { keys: K.delete, dimmed: false } });
    assert.deepEqual(await itemsIn(page, 'Edit', ['Delete', 'Duplicate']), { Delete: { keys: K.delete, dimmed: false }, Duplicate: { keys: K.duplicate, dimmed: false } });
    await click(page, row, { button: 'right' });
    await settle(page);
    assert.deepEqual(await openItems(page, ['Delete Slide']), { 'Delete Slide': { keys: K.delete, dimmed: false } });
    await closeMenus(page);
    await click(page, row);
    await press(page, K.press);
    await settle(page);
    assert.equal((await state(page)).slides, 11);
    assert.equal(await undoLabel(page), 'Undo Delete Slide');
    await undo(page);
    await settle(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  // item 1d: the cell menu lists the Option arrows at its Add items with the caret in a cell, where
  // the text takes the keys, and with the cell selected, where the keys add a row or a column
  test(`the cell menu lists the keys of its Add items with the caret in a cell and with the cell selected (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await settle(page);
    const inserted = await render(page);
    const arrows = platform === 'mac' ? ['⌥↑', '⌥↓', '⌥←', '⌥→'] : ['Alt+Up Arrow', 'Alt+Down Arrow', 'Alt+Left Arrow', 'Alt+Right Arrow'];
    const listed = Object.fromEntries(ADD.map((l, i) => [l, { keys: arrows[i], dimmed: false }]));
    for (const how of ['caret', 'cell']) {
      await click(page, await cell(page));
      await settle(page);
      if (how === 'cell') await press(page, 'Escape');
      await settle(page);
      const focus = (await state(page)).focus;
      assert.equal(focus, how === 'caret' ? 'td editable' : focus);
      await click(page, await cell(page), { button: 'right' });
      await settle(page);
      assert.deepEqual(await openItems(page, ADD), listed, `with the ${how}`);
      await closeMenus(page);
    }
    // with the caret in the cell, the text takes the keys on a Mac, where Option with an arrow moves
    // the caret, and the key adds a row on Windows and Linux (R17.10)
    await click(page, await cell(page));
    await settle(page);
    await press(page, 'Alt+ArrowUp');
    await settle(page);
    assert.deepEqual(await size(page), platform === 'mac' ? [3, 3] : [4, 3]);
    // the undo puts the caret back into the cell (R19.3)
    if (platform !== 'mac') await undo(page);
    await settle(page);
    assert.equal(await render(page), inserted);
    await press(page, 'Escape');
    await press(page, 'Alt+ArrowUp');
    await settle(page);
    assert.deepEqual(await size(page), [4, 3]);
    // Duplicate is dimmed with the caret in a cell, since Esc selects the cell, and keeps its key
    await click(page, await cell(page));
    await settle(page);
    assert.deepEqual(await itemsIn(page, 'Edit', ['Duplicate']), { Duplicate: { keys: K.duplicate, dimmed: true } });
    assert.deepEqual(errors(page), []);
  });
}

for (const platform of PLATFORMS) {
  // item 2: Edit > Delete on a row of the navigator hands its run to Delete Slide, which names the
  // entry, as in Keynote. a figure deleted on the canvas is still Delete
  test(`Edit > Delete of a slide in the navigator is the entry Delete Slide (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await rect(page, `document.querySelectorAll('.beeson-edit-nav .row')[3]`));
    await settle(page);
    await choose(page, 'Edit', 'Delete');
    assert.equal((await state(page)).slides, 11);
    assert.equal(await undoLabel(page), 'Undo Delete Slide');
    assert.equal(await firstEditItem(page), 'Undo Delete Slide');
    await undo(page);
    await settle(page);
    assert.equal(await render(page), page.source);
    await page.evaluate(`Reveal.slide(${FIGURES})`);
    await settle(page);
    await click(page, '.reveal .slides > section.present img');
    await settle(page);
    await choose(page, 'Edit', 'Delete');
    assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelectorAll('figure').length`), 0);
    assert.equal(await undoLabel(page), 'Undo Delete');
    await undo(page);
    await settle(page);
    assert.equal(await render(page), page.source);
    // Edit > Duplicate with nothing selected on the canvas hands its run to Duplicate Slide too
    await click(page, await below(page));
    await settle(page);
    await choose(page, 'Edit', 'Duplicate');
    assert.equal((await state(page)).slides, 13);
    assert.equal(await undoLabel(page), 'Undo Duplicate Slide');
    await checkEdit(page, `r15-7-duplicate-slide-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });

  // item 3: the check of View > Navigator follows the navigator drawn, as Slide Only does, and the
  // item shows the navigator in place of the inspector in a window too narrow for both
  test(`View > Navigator is checked only while the navigator is drawn (${platform})`, async (t) => {
    const page = await load(t, platform, { width: 800, height: 900 });
    const checks = async () => {
      await openBar(page, 'View');
      const out = await page.evaluate(`(() => { const c = (l) => (${findItem})(l)?.getAttribute('aria-checked'); return { navigator: c('Navigator'), slideOnly: c('Slide Only'), drawn: !!document.querySelector('.beeson-edit-nav')?.getClientRects().length }; })()`);
      await closeMenus(page);
      return out;
    };
    assert.deepEqual(await checks(), { navigator: 'false', slideOnly: 'true', drawn: false });
    await choose(page, 'View', 'Navigator');
    assert.deepEqual(await checks(), { navigator: 'true', slideOnly: 'false', drawn: true });
    assert.equal(await page.evaluate(`!!document.querySelector('.beeson-edit-inspector')?.getClientRects().length`), false, 'the navigator is shown in place of the inspector');
    await choose(page, 'View', 'Navigator');
    assert.deepEqual(await checks(), { navigator: 'false', slideOnly: 'true', drawn: false });
    await choose(page, 'View', 'Slide Only');
    assert.deepEqual(await checks(), { navigator: 'true', slideOnly: 'false', drawn: true });
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}

const card = (page, name) => page.evaluate(`(() => { const d = document.querySelector('dialog.beeson-edit-card.${name}'); return d && !d.hidden && d.open ? { text: d.textContent, code: d.querySelector('code')?.textContent ?? null, buttons: [...d.querySelectorAll('.row button')].map((b) => b.textContent) } : null; })()`);
const cardButton = (page, name, label) => rect(page, `[...document.querySelectorAll('dialog.beeson-edit-card.${name} .row button')].find((b) => b.textContent === ${js(label)})`);

// File > Export To > PowerPoint… opens the item of the submenu Export To of the File menu
async function exportPowerPoint(page) {
  await openBar(page, 'File');
  await click(page, await rect(page, `(${findItem})('Export To')`));
  await settle(page);
  const items = await page.evaluate(`(() => { const m = [...document.querySelectorAll('.beeson-edit-menu')].filter((m) => m.getClientRects().length).at(-1); return [...m.querySelectorAll('.item')].map((i) => i.querySelector('.label')?.textContent); })()`);
  assert.deepEqual(items, ['PDF…', 'HTML…', 'PowerPoint…'], 'File > Export To does not list PowerPoint… after PDF… and HTML…');
  await click(page, await rect(page, `(${findItem})('PowerPoint…')`));
  await settle(page);
  return items;
}

for (const platform of PLATFORMS) {
  // item 6: a page cannot write the PowerPoint file, hence the item shows the command that writes it
  test(`File > Export To > PowerPoint… shows the command that writes the file, and copies it (${platform})`, async (t) => {
    const page = await load(t, platform);
    await page.send('Browser.grantPermissions', { origin: server.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
    assert.deepEqual(await exportPowerPoint(page), ['PDF…', 'HTML…', 'PowerPoint…']);
    const shown = await card(page, 'pptx');
    assert.ok(shown, 'the card of PowerPoint… is not open');
    assert.equal(shown.code, 'npm run pptx');
    assert.match(shown.text, /saved index\.html/);
    assert.deepEqual(shown.buttons, ['Copy Command', 'Close']);
    await page.evaluate(`navigator.clipboard.writeText('nothing').then(() => true)`);
    await click(page, await cardButton(page, 'pptx', 'Copy Command'));
    await settle(page);
    assert.equal(await page.evaluate('navigator.clipboard.readText()'), 'npm run pptx');
    assert.ok(await card(page, 'pptx'), 'Copy Command closes the card');
    await press(page, 'Escape');
    await settle(page);
    assert.equal(await card(page, 'pptx'), null, 'Esc does not close the card');
    await exportPowerPoint(page);
    await click(page, await cardButton(page, 'pptx', 'Close'));
    await settle(page);
    assert.equal(await card(page, 'pptx'), null);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`File > Export To > PowerPoint… with unsaved changes asks to save first, as Present does (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await wordAt(page, 'your'));
    await type(page, 'q');
    await settle(page);
    const edited = await render(page);
    assert.notEqual(edited, page.source);
    await exportPowerPoint(page);
    const ask = await card(page, 'ask');
    assert.ok(ask, 'the deck is not asked to be saved first');
    assert.match(ask.text, /PowerPoint/);
    assert.deepEqual(ask.buttons, ['Save and export', 'Export the saved file', 'Cancel']);
    assert.equal(await card(page, 'pptx'), null);
    await press(page, 'Escape');
    await settle(page);
    assert.equal(await card(page, 'ask'), null);
    assert.equal(await card(page, 'pptx'), null, 'Esc on the question shows the command');
    await exportPowerPoint(page);
    await click(page, await cardButton(page, 'ask', 'Export the saved file'));
    await settle(page);
    assert.equal((await card(page, 'pptx'))?.code, 'npm run pptx');
    await press(page, 'Escape');
    await settle(page);
    assert.equal(await render(page), edited, 'the edits are not kept');
    assert.deepEqual(errors(page), []);
  });
}
