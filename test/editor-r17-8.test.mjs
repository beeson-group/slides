// regression tests of R17.8 on both platforms, the requirements 8 and 8a and the defects N36 to
// N41 of the check of round 7: the keys with a command modifier that act in a text, Move Slide Up
// and Down dimmed in a text, Mod+D kept from the browser in a cell, Mod+B and Mod+I on a framed
// formula, and the inspector given back once the window has room for it

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test-deck.html';
// the index of the figures slide in index.html
const FIGURES = 4;

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
const wait = (page, ms = 150) => page.evaluate(`new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), ${ms}))`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const undoLabel = (page) => state(page, 'edit.undo').then((s) => s.label);
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const rect = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const slides = (page) => page.evaluate(`document.querySelectorAll('.reveal .slides > section').length`);

async function load(t, platform, size = { width: 1600, height: 1000 }) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${DECK}?edit&still&theme=light&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${FIGURES})`);
  await wait(page);
  return page;
}

async function resize(page, width, height) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await wait(page, 300);
}

// whether the last keydown of a key reached the window with its default prevented, read after the
// handler of the editor, which is the first listener of the capture phase
const watchKeys = (page) => page.evaluate(`(() => { window.__keys = {}; addEventListener('keydown', (ev) => { window.__keys[ev.key.toLowerCase()] = ev.defaultPrevented; }, true); return true; })()`);
const prevented = (page, key) => page.evaluate(`window.__keys[${js(key)}] ?? null`);

// the caret put by a click into the word matplotlib of the first paragraph of the figures slide
async function caret(page) {
  const at = await page.evaluate(`(() => {
    const el = Reveal.getCurrentSlide().querySelector(':scope > p');
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = w.nextNode(); node; node = w.nextNode()) {
      const i = node.textContent.indexOf('matplotlib');
      if (i < 0) continue;
      const r = document.createRange(); r.setStart(node, i + 4); r.setEnd(node, i + 5);
      const b = r.getBoundingClientRect(); return { x: b.left + 1, y: b.top + b.height / 2 };
    }
    return null;
  })()`);
  await click(page, at);
  await wait(page);
  assert.equal(await page.evaluate(`document.activeElement.matches('p') && document.activeElement.isContentEditable`), true, 'the click does not put the caret into the paragraph');
}

const KEYS = {
  mac: { hide: 'Mod+Shift+H', zoom: 'Mod+Shift+0' },
  other: { hide: 'Ctrl+Shift+H', zoom: null },
};

for (const platform of PLATFORMS) {
  const K = KEYS[platform];

  // item 1: New Slide, Hide Slide, and on a Mac Zoom to Selection act by their keys in a text, as
  // their items of the menu do, and a key that the text takes is typed
  test(`the keys of New Slide, Hide Slide, and Zoom to Selection act with the caret in a paragraph (${platform})`, async (t) => {
    const page = await load(t, platform);
    await watchKeys(page);
    if (K.zoom) {
      await caret(page);
      assert.equal((await state(page, 'zoom.fit')).checked, true);
      await press(page, K.zoom);
      await wait(page, 300);
      assert.equal((await state(page, 'zoom.fit')).checked, false, `${K.zoom} in a text does not zoom to the block`);
      assert.equal(await prevented(page, '0'), true);
      await exec(page, 'zoom.fit');
      await wait(page);
    }
    const n = await slides(page);
    await caret(page);
    await press(page, 'Ctrl+M');
    await wait(page, 300);
    assert.equal(await slides(page), n + 1, 'Ctrl+M in a text does not make a new slide');
    assert.equal(await undoLabel(page), 'Undo New Slide');
    assert.equal(await prevented(page, 'm'), true);
    await undo(page);
    await wait(page);
    assert.equal(await render(page), page.source);
    await page.evaluate(`Reveal.slide(${FIGURES})`);
    await wait(page);
    await caret(page);
    await press(page, K.hide);
    await wait(page);
    assert.equal(await undoLabel(page), 'Undo Hide Slide', `${K.hide} in a text does not hide the slide`);
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal .slides > section')[${FIGURES}].getAttribute('data-visibility')`), 'hidden');
    const hidden = await render(page);
    await undo(page);
    await wait(page);
    assert.equal(await render(page), page.source);
    await page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
    assert.equal(await render(page), hidden);
    await undo(page);
    await page.evaluate(`Reveal.slide(${FIGURES})`);
    await wait(page);
    // the text takes Shift with a digit and a bare letter. press() sends Shift+2 with the text 2, and
    // Shift+0, the key of Actual Size, with the text 0
    await caret(page);
    await press(page, 'Shift+2');
    await press(page, 'd');
    await press(page, 'Shift+0');
    await wait(page);
    assert.equal((await state(page, 'zoom.fit')).checked, true, 'Shift+2 or Shift+0 in a text zooms');
    assert.ok((await render(page)).includes('matp2d0lotlib'), 'Shift+2, D, and Shift+0 are not typed into the text');
    assert.equal(await undoLabel(page), 'Undo Typing');
    const { text } = await saveAndReopen(page, `r17-8-keys-${platform}.html`);
    assert.equal(text, await render(page));
    assert.deepEqual(errors(page), []);
  });

  // item 2: Move Slide Up and Down are dimmed in a text, where Alt with an arrow moves the caret or
  // adds a row, as on the canvas
  test(`Move Slide Up and Move Slide Down are dimmed with the caret in a paragraph or in a cell (${platform})`, async (t) => {
    const page = await load(t, platform);
    const moves = async () => ({ up: (await state(page, 'slide.moveUp')).enabled, down: (await state(page, 'slide.moveDown')).enabled });
    assert.deepEqual(await moves(), { up: false, down: false }, 'the two are not dimmed on the canvas');
    await caret(page);
    assert.deepEqual(await moves(), { up: false, down: false }, 'the two are live with the caret in a paragraph');
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await wait(page);
    await click(page, await rect(page, `Reveal.getCurrentSlide().querySelector('table').rows[1].cells[1]`));
    await wait(page);
    assert.equal(await page.evaluate(`!!document.activeElement.closest('td, th')`), true, 'the click does not put the caret into a cell');
    assert.deepEqual(await moves(), { up: false, down: false }, 'the two are live with the caret in a cell');
    await press(page, 'Alt+ArrowUp');
    await wait(page);
    assert.equal(await page.evaluate('Reveal.getIndices().h'), FIGURES, 'Alt+ArrowUp in a cell moves the slide');
    // the navigator still moves the slide
    await click(page, `.beeson-edit-nav .row:nth-child(${FIGURES + 1})`);
    await wait(page);
    assert.deepEqual(await moves(), { up: true, down: true }, 'the two are dimmed in the navigator');
    assert.deepEqual(errors(page), []);
  });

  // item 3: Mod+D is kept from the browser, which bookmarks the page, also where Duplicate is dimmed
  test(`Mod+D with the caret in a cell of a table is kept from the browser and changes nothing (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await wait(page);
    const inserted = await render(page);
    await watchKeys(page);
    await click(page, await rect(page, `Reveal.getCurrentSlide().querySelector('table').rows[1].cells[1]`));
    await wait(page);
    assert.equal((await state(page, 'edit.duplicate')).enabled, false);
    await press(page, 'Mod+D');
    await wait(page);
    assert.equal(await prevented(page, 'd'), true, 'Mod+D in a cell reaches the browser');
    assert.equal(await render(page), inserted);
    assert.equal(await undoLabel(page), 'Undo Insert Table');
    assert.deepEqual(errors(page), []);
  });

  // item 4: a display of math is not set in bold or italic, neither a new one nor one of the deck
  test(`Mod+B and Mod+I on a framed formula change nothing (${platform})`, async (t) => {
    const page = await load(t, platform);
    await watchKeys(page);
    const check = async (before, label, what) => {
      for (const key of ['Mod+B', 'Mod+I']) {
        await press(page, key);
        await wait(page);
        assert.equal(await render(page), before, `${key} on ${what} changes the file`);
        assert.equal(await undoLabel(page), label, `${key} on ${what} is an entry of the history`);
        assert.equal(await page.evaluate(`!!Reveal.getCurrentSlide().querySelector('div.math :is(strong, em, b, i)')`), false, `${key} on ${what} sets the display in bold or italic`);
      }
    };
    // the display of the slide, framed by a click and Esc
    const math = await rect(page, `Reveal.getCurrentSlide().querySelector('div.math mjx-container')`);
    if (math) {
      await click(page, math);
      await press(page, 'Escape');
      await wait(page);
      assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((el) => el.className)'), ['math']);
      await check(page.source, 'Undo', 'the display of the slide');
    }
    // a new formula, closed by a click on the canvas under the slide
    await click(page, await rect(page, `[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === 'Insert')`));
    await wait(page);
    await click(page, await rect(page, `[...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.getClientRects().length && i.querySelector('.label')?.firstChild?.textContent === 'Formula')`));
    await wait(page);
    await type(page, 'x^2 + y^2');
    await wait(page);
    const below = await page.evaluate(`(() => { const r = document.querySelector('.reveal .slides').getBoundingClientRect(); return { x: Math.round(r.left + 6), y: Math.round(r.bottom + 12) }; })()`);
    await click(page, below);
    await wait(page);
    assert.equal(await page.evaluate(`document.activeElement.matches('div.math')`), true, 'the new formula does not have the focus');
    await check(await render(page), await undoLabel(page), 'a new formula');
    assert.deepEqual(errors(page), []);
  });
}

// item 5: whether the navigator and the inspector are drawn, and the check marks of the View menu
const findItem = `(l) => [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.getClientRects().length && i.querySelector('.label')?.firstChild?.textContent === l)`;
async function openBar(page, bar) {
  await click(page, await rect(page, `[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)})`));
  await wait(page);
}
async function choose(page, bar, label) {
  await openBar(page, bar);
  await click(page, await rect(page, `(${findItem})(${js(label)})`));
  await wait(page);
}
const view = async (page) => {
  await openBar(page, 'View');
  const out = await page.evaluate(`(() => {
    const c = (l) => (${findItem})(l)?.getAttribute('aria-checked');
    const drawn = (s) => !!document.querySelector(s)?.getClientRects().length;
    return { navigator: c('Navigator'), format: c('Format'), nav: drawn('.beeson-edit-nav'), inspector: drawn('.beeson-edit-inspector') };
  })()`);
  await page.evaluate('window.BeesonEditorShell?.closeMenus?.(); true');
  await wait(page);
  return out;
};

for (const platform of PLATFORMS) {
  test(`the inspector closed for the navigator in a narrow window is given back once the window has room for it (${platform})`, async (t) => {
    const BOTH = { navigator: 'true', format: 'true', nav: true, inspector: true };
    const page = await load(t, platform, { width: 760, height: 900 });
    assert.deepEqual(await view(page), { navigator: 'false', format: 'true', nav: false, inspector: true });
    await choose(page, 'View', 'Navigator');
    assert.deepEqual(await view(page), { navigator: 'true', format: 'false', nav: true, inspector: false }, 'View > Navigator does not show the navigator in place of the inspector');
    // the navigator hidden again leaves room for the inspector
    await choose(page, 'View', 'Navigator');
    assert.deepEqual(await view(page), { navigator: 'false', format: 'true', nav: false, inspector: true }, 'the inspector is not given back with the navigator hidden');
    await resize(page, 1600, 900);
    assert.deepEqual(await view(page), { navigator: 'false', format: 'true', nav: false, inspector: true });
    // a wider window gives the inspector back beside the navigator
    await resize(page, 760, 900);
    await choose(page, 'View', 'Navigator');
    assert.deepEqual(await view(page), { navigator: 'true', format: 'false', nav: true, inspector: false });
    await resize(page, 1600, 900);
    assert.deepEqual(await view(page), BOTH, 'the inspector is not given back at 1600 px');
    // Format closed by the user stays closed
    await choose(page, 'View', 'Format');
    await resize(page, 760, 900);
    await resize(page, 1600, 900);
    assert.deepEqual(await view(page), { navigator: 'true', format: 'false', nav: true, inspector: false }, 'Format closed by the user is opened again');
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  // N36: View > Navigator after the window was narrowed shows the navigator in one choice
  test(`View > Navigator after the window was narrowed with the navigator off shows it in one choice (${platform})`, async (t) => {
    const page = await load(t, platform);
    assert.equal((await view(page)).nav, true);
    await choose(page, 'View', 'Navigator');
    assert.deepEqual(await view(page), { navigator: 'false', format: 'true', nav: false, inspector: true });
    await resize(page, 760, 900);
    await choose(page, 'View', 'Navigator');
    assert.deepEqual(await view(page), { navigator: 'true', format: 'false', nav: true, inspector: false }, 'one choice of View > Navigator does not show the navigator');
    assert.deepEqual(errors(page), []);
  });
}
