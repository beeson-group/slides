// regression tests of R16.3 on both platforms, the findings G7, G8, and G15 of the second review of
// round 7: the keys after an undo that frames a block with the caret left in its text, View >
// Navigator in a narrow window with the inspector open, and Tab in the outline on the title after a
// slide whose last list is locked

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const OUTLINE = 'test/pages/editor-outline.html';
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
const rect = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

// the editor on slide n of deck in a window of size, served over HTTP, with the storage emptied
async function load(t, platform, n, deck = 'index.html', size = { width: 1600, height: 1000 }) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?edit&still&theme=light&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  await reopen(page, n);
  return page;
}

// every entry of the history undone with the focus left on the page, and slide n shown with
// nothing selected
async function reopen(page, n) {
  await page.evaluate('document.activeElement?.blur?.(); getSelection().removeAllRanges(); true');
  await wait(page);
  await page.evaluate(`(async () => { while (window.BeesonEditor.state('edit.undo').enabled) await window.BeesonEditor.undo(); return true; })()`);
  assert.equal(await render(page), page.source, 'the history does not undo to the file');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await wait(page);
  await page.evaluate(`Promise.resolve(window.BeesonEditor.exec('selection.clear')).then(() => true)`);
}

const findItem = `(l) => [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.getClientRects().length && i.querySelector('.label')?.firstChild?.textContent === l)`;
const closeMenus = async (page) => { await page.evaluate('window.BeesonEditorShell?.closeMenus?.(); true'); await wait(page); };

async function openBar(page, bar) {
  await click(page, await rect(page, `[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)})`));
  await wait(page);
}

async function choose(page, bar, label) {
  await openBar(page, bar);
  await click(page, await rect(page, `(${findItem})(${js(label)})`));
  await wait(page);
}

// G7: a point inside the word matplotlib of the first paragraph of the figures slide
const word = (page) => page.evaluate(`(() => {
  const el = Reveal.getCurrentSlide().querySelector(':scope > p');
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = w.nextNode(); node; node = w.nextNode()) {
    const at = node.textContent.indexOf('matplotlib');
    if (at < 0) continue;
    const r = document.createRange(); r.setStart(node, at + 4); r.setEnd(node, at + 5);
    const b = r.getBoundingClientRect(); return { x: b.left + 1, y: b.top + b.height / 2 };
  }
  return null;
})()`);

// the state after a key: the file, the label of the last entry of the history, the number of
// blocks of the slide, the selection, and whether the caret is in the paragraph
const outcome = async (page) => ({
  text: await render(page),
  undo: await undoLabel(page),
  ...(await page.evaluate(`(() => {
    const p = Reveal.getCurrentSlide().querySelector(':scope > p'), s = getSelection(), a = document.activeElement;
    return {
      blocks: Reveal.getCurrentSlide().children.length,
      selected: window.BeesonEditor.selection().map((el) => el.tagName.toLowerCase()),
      focus: a === document.body ? 'body' : a.tagName.toLowerCase() + (a.isContentEditable ? ' editable' : ''),
      caret: !!(p && s.rangeCount && p.contains(s.anchorNode) && a.contains(s.anchorNode)),
    };
  })()`)),
});

const caret = async (page) => {
  await click(page, await word(page));
  await wait(page);
  assert.equal(await page.evaluate(`document.activeElement.matches('p') && document.activeElement.isContentEditable`), true, 'the click does not put the caret into the paragraph');
};

// the three ways to undo: the key, the button Undo of the toolbar, whose mousedown keeps the focus
// in the text, and the item Undo of the Edit menu
const ROUTES = {
  'Mod+Z': (page) => press(page, 'Mod+Z'),
  'the toolbar': (page) => click(page, '.beeson-edit-top [data-command="edit.undo"]'),
  'Edit > Undo': async (page) => {
    await openBar(page, 'Edit');
    assert.equal(await page.evaluate(`(${findItem})('Undo Move') ? true : false`), true, 'the Edit menu does not list Undo Move');
    await click(page, await rect(page, `(${findItem})('Undo Move')`));
  },
};
const KEYS = ['Backspace', 'ArrowLeft', 'Mod+D', 'Mod+X', 'q'];

for (const platform of PLATFORMS) {
  test(`after an undo that frames a paragraph with the caret left in it, every key acts on the text as at a caret (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    for (const key of KEYS) {
      // the key at a caret put by a click into the same place
      await reopen(page, FIGURES);
      await caret(page);
      await press(page, key);
      await wait(page);
      const expected = await outcome(page);
      for (const [route, undo] of Object.entries(ROUTES)) {
        await reopen(page, FIGURES);
        await click(page, await word(page));
        await press(page, 'Escape');
        await press(page, 'ArrowRight');
        await wait(page);
        assert.equal(await undoLabel(page), 'Undo Move');
        await caret(page);
        await undo(page);
        await wait(page);
        const undone = await outcome(page);
        assert.equal(undone.text, page.source, `the undo by ${route} does not restore the file`);
        assert.equal(await state(page, 'edit.undo').then((s) => s.enabled), false, `the undo by ${route} is not of the Move`);
        assert.equal(undone.caret, true, `the undo by ${route} takes the caret out of the paragraph`);
        await press(page, key);
        await wait(page);
        assert.deepEqual(await outcome(page), expected, `${key} after the undo by ${route} does not act as at a caret`);
      }
    }
    const { text } = await saveAndReopen(page, `r16-3-keys-${platform}.html`);
    assert.equal(text, await render(page));
    assert.deepEqual(errors(page), []);
  });
}

// G8: whether the navigator and the inspector are drawn, and the check marks of the View menu
const view = async (page) => {
  await openBar(page, 'View');
  const out = await page.evaluate(`(() => {
    const c = (l) => (${findItem})(l)?.getAttribute('aria-checked');
    const drawn = (s) => !!document.querySelector(s)?.getClientRects().length;
    return { navigator: c('Navigator'), slideOnly: c('Slide Only'), nav: drawn('.beeson-edit-nav'), inspector: drawn('.beeson-edit-inspector') };
  })()`);
  await closeMenus(page);
  return out;
};

for (const platform of PLATFORMS) {
  test(`View > Navigator in a narrow window with the navigator off and the inspector open shows the navigator in one choice (${platform})`, async (t) => {
    const OFF = { navigator: 'false', slideOnly: 'true', nav: false, inspector: true };
    const ON = { navigator: 'true', slideOnly: 'false', nav: true, inspector: false };
    // Slide Only is the reference, which shows the navigator from the same state
    for (const item of ['Slide Only', 'Navigator']) {
      const page = await load(t, platform, 1, 'index.html', { width: 800, height: 900 });
      // the navigator turned off with the inspector closed, then the Format inspector opened
      await choose(page, 'View', 'Navigator');
      await choose(page, 'View', 'Navigator');
      assert.equal((await view(page)).nav, false, 'the second choice does not turn the navigator off');
      await page.evaluate(`window.BeesonEditor.exec('shell.format')`);
      await wait(page);
      assert.deepEqual(await view(page), OFF, 'the navigator is not off with the inspector open');
      await choose(page, 'View', item);
      assert.deepEqual(await view(page), ON, `one choice of ${item} does not show the navigator in place of the inspector`);
      assert.equal(await render(page), page.source);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });
}

// G15: the line of the outline that starts with start, with the caret at its start
async function lineStart(page, start) {
  if (!(await state(page, 'view.outline')).checked) await page.evaluate(`window.BeesonEditor.exec('view.outline')`);
  await wait(page, 300);
  const at = await page.evaluate(`(() => {
    const t = [...document.querySelectorAll('.beeson-edit-outline .text')].find((e) => e.textContent.startsWith(${js(start)}));
    t.scrollIntoView({ block: 'center' });
    const r = t.getBoundingClientRect();
    return { x: r.right - 2, y: r.bottom - 6 };
  })()`);
  await click(page, at);
  await wait(page);
  await page.evaluate('getSelection().collapse(document.activeElement, 0)');
  assert.ok(await page.evaluate(`document.activeElement.matches('.beeson-edit-outline .text') && document.activeElement.textContent.startsWith(${js(start)})`), 'the caret is not in the line of the outline');
}

const slides = (page) => page.evaluate(`document.querySelectorAll('.reveal .slides > section').length`);
const lockedItems = (page) => page.evaluate(`[...document.querySelector('.reveal .slides > section ul[data-locked]').children].map((li) => li.firstChild.textContent.trim())`);

for (const platform of PLATFORMS) {
  test(`Tab in the outline on the title after a slide whose last list is locked does nothing (${platform})`, async (t) => {
    const title = 'Transfer budget';
    const page = await load(t, platform, 0, OUTLINE);
    // the top-level list of slide 1 selected and locked by its key
    await click(page, 'section.present > ul > li');
    await press(page, 'Escape');
    await wait(page);
    await press(page, 'Mod+L');
    await wait(page);
    const locked = await render(page);
    assert.ok(locked.includes('<ul data-locked>'), 'the list is not locked');
    assert.equal(await undoLabel(page), 'Undo Lock');
    const items = await lockedItems(page);
    await page.evaluate('Reveal.slide(1)');
    await wait(page);
    const n = await slides(page);
    await lineStart(page, title);
    await press(page, 'Tab');
    await wait(page, 300);
    assert.equal(await slides(page), n, 'Tab removes the slide');
    assert.equal(await render(page), locked, 'Tab changes the file');
    assert.equal(await undoLabel(page), 'Undo Lock', 'Tab is an entry of the history');
    assert.deepEqual(await lockedItems(page), items, 'Tab changes the items of the locked list');
    // with the lock undone, Tab demotes the title into the list
    await page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
    await wait(page);
    assert.equal(await render(page), page.source);
    await page.evaluate('Reveal.slide(1)');
    await wait(page);
    await lineStart(page, title);
    await press(page, 'Tab');
    await wait(page, 300);
    assert.equal(await slides(page), n - 1, 'Tab does not demote the title without the lock');
    assert.equal(await undoLabel(page), 'Undo Demote Slide');
    assert.deepEqual(errors(page), []);
  });
}
