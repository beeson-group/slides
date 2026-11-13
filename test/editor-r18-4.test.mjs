// regression tests of R18.4 on both platforms, the findings C5, C6, and C15 of the third review of
// round 7, and the state left by R17.8: the selection after an undo that frames another element or
// puts back the TeX of an inline formula, Mod+D in the Object List, and an undo of Hide Slide at a
// caret

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
// the index of the figures slide and of the slide of the effective potential in index.html
const FIGURES = 4;
const POTENTIAL = 3;

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
const exec = (page, id) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)})).then(() => true)`);
const rect = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const count = (page, selector) => page.evaluate(`Reveal.getCurrentSlide().querySelectorAll(${js(selector)}).length`);

async function load(t, platform, n, deck = 'index.html') {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?edit&still&theme=light&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await wait(page, 300);
  return page;
}

// the focus, whether a caret is shown in a text of the slide, and the selected elements
const focus = (page) => page.evaluate(`(() => {
  const a = document.activeElement, s = getSelection();
  return {
    focus: a === document.body ? 'body' : a.tagName.toLowerCase(),
    caret: !!(s.rangeCount && a.isContentEditable && a.closest('.reveal') && a.contains(s.anchorNode)),
    selected: window.BeesonEditor.selection().map((el) => el.tagName.toLowerCase()),
  };
})()`);

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
  assert.equal((await focus(page)).caret, true, 'the click does not put the caret into the paragraph');
}

const IMAGE = `[...Reveal.getCurrentSlide().querySelectorAll('figure img')].find((i) => i.getClientRects().length)`;

for (const platform of PLATFORMS) {
  // C5: an undo or a redo of a Move of the figure, with the caret put into a paragraph after it,
  // frames the figure and takes the caret off, hence Mod+D and a letter act on the figure
  test(`an undo or a redo that frames a figure takes the caret off the paragraph (${platform})`, async (t) => {
    for (const how of ['undo', 'redo']) {
      const page = await load(t, platform, FIGURES);
      await click(page, await rect(page, IMAGE));
      await press(page, 'ArrowRight');
      await wait(page);
      assert.equal(await undoLabel(page), 'Undo Move');
      const moved = await render(page);
      if (how === 'redo') await press(page, 'Mod+Z');
      await wait(page);
      await caret(page);
      await press(page, how === 'undo' ? 'Mod+Z' : 'Mod+Shift+Z');
      await wait(page);
      const text = await render(page);
      assert.equal(text, how === 'undo' ? page.source : moved);
      assert.deepEqual(await focus(page), { focus: 'body', caret: false, selected: ['figure'] }, `the ${how} leaves a caret beside the framed figure`);
      await press(page, 'q');
      await wait(page);
      assert.equal(await render(page), text, `q after the ${how} is typed`);
      await press(page, 'Mod+D');
      await wait(page);
      assert.equal(await count(page, 'figure'), 2, `Mod+D after the ${how} does not duplicate the figure`);
      assert.equal(await undoLabel(page), 'Undo Duplicate');
      await press(page, 'Mod+Z');
      await wait(page);
      assert.equal(await render(page), text);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });

  // C15: Mod+D on a row of the Object List duplicates the object of the row
  test(`Mod+D on a row of the Object List duplicates its object (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await exec(page, 'view.objects');
    await wait(page, 300);
    await click(page, await rect(page, `[...document.querySelectorAll('.beeson-edit-objects .row')].filter((e) => e.getClientRects().length).find((e) => /zero-velocity/i.test(e.textContent))`));
    await wait(page);
    assert.equal(await page.evaluate(`!!document.activeElement.closest('.beeson-edit-objects')`), true, 'the row does not have the focus');
    await press(page, 'Mod+D');
    await wait(page, 300);
    assert.equal(await count(page, 'figure'), 2, 'Mod+D on the row does not duplicate the figure');
    assert.equal(await undoLabel(page), 'Undo Duplicate');
    const copied = await render(page);
    await page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
    assert.equal(await render(page), page.source);
    await page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
    assert.equal(await render(page), copied);
    const { text } = await saveAndReopen(page, `r18-4-objects-${platform}.html`);
    assert.equal(text, copied);
    assert.deepEqual(errors(page), []);
  });
}

for (const platform of PLATFORMS) {
  // C6: an undo or a redo of the TeX of an inline formula frames its paragraph again, without a
  // caret, as after Apply
  test(`an undo or a redo of the TeX of an inline formula keeps its paragraph framed (${platform})`, async (t) => {
    for (const how of ['undo', 'redo']) {
      const page = await load(t, platform, POTENTIAL);
      await click(page, await rect(page, `Reveal.getCurrentSlide().querySelector('p mjx-container')`));
      await wait(page, 300);
      assert.equal(await page.evaluate(`(() => { const f = document.querySelector('.beeson-math textarea'); if (!f) return false; f.focus(); f.setSelectionRange(f.value.length, f.value.length); return true; })()`), true, 'the click does not open the TeX of the formula');
      await type(page, ' + 1');
      await press(page, 'Mod+Enter');
      await wait(page, 600);
      assert.equal(await undoLabel(page), 'Undo Formula');
      const applied = await render(page);
      const framed = await focus(page);
      assert.deepEqual(framed.selected, ['p']);
      await press(page, 'Mod+Z');
      await wait(page, 400);
      if (how === 'redo') {
        await press(page, 'Mod+Shift+Z');
        await wait(page, 400);
      }
      const text = await render(page);
      assert.equal(text, how === 'undo' ? page.source : applied);
      const now = await focus(page);
      assert.deepEqual(now.selected, ['p'], `the ${how} does not frame the paragraph`);
      assert.equal(now.caret, false, `the ${how} leaves a caret in the paragraph`);
      await press(page, 'q');
      await wait(page);
      assert.equal(await render(page), text, `q after the ${how} is typed into the paragraph`);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });

  // the state left by R17.8: an undo of Hide Slide at a caret keeps the text as the selection
  test(`an undo of Hide Slide with the caret in a paragraph keeps the text as the selection (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await caret(page);
    assert.equal((await state(page, 'zoom.selection')).enabled, true);
    await press(page, platform === 'mac' ? 'Mod+Shift+H' : 'Ctrl+Shift+H');
    await wait(page);
    assert.equal(await undoLabel(page), 'Undo Hide Slide');
    await press(page, 'Mod+Z');
    await wait(page, 300);
    assert.equal(await render(page), page.source);
    assert.equal((await focus(page)).caret, true, 'the undo takes the caret off');
    assert.equal((await state(page, 'zoom.selection')).enabled, true, 'the undo empties the selection while the caret stays');
    await press(page, 'Mod+D');
    await wait(page, 300);
    assert.equal(await count(page, ':scope > p'), 2, 'Mod+D does not duplicate the paragraph of the caret');
    assert.equal(await undoLabel(page), 'Undo Duplicate');
    assert.deepEqual(errors(page), []);
  });
}
