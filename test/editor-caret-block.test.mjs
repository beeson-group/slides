// regression tests: a heading or a paragraph with the caret in it, i.e. clicked into once, is moved
// by a drag of its handle and resized by a drag of its grips, as a block selected as an object is.
// the selection of a caret holds the block itself, which pressElement in src/editor/canvas/drag.ts
// took for a selected object, and the drag then moved nothing. the frame of the block was drawn
// without grips

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { launch } from '../scripts/chrome.mjs';
import { center, click, drag, editorPage, press } from './helpers/editor.mjs';

const DECK = 'test/pages/editor-layouts.html';
// the slide of DECK with a heading, a paragraph, and a list
const TEXT = 2;

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser?.close();
});

const js = (v) => JSON.stringify(v);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');

for (const selector of ['.reveal section.present h2', '.reveal section.present p:first-of-type']) {
  test(`a drag of the handle of ${selector} with the caret in it moves it`, async (t) => {
    const page = await editorPage(browser, { deck: DECK, page: { width: 1600, height: 1000 }, clear: true });
    t.after(() => page.close().catch(() => {}));
    await page.evaluate(`Reveal.slide(${TEXT})`);
    await frames(page);
    const at = await center(page, selector);
    await click(page, at);
    await frames(page);
    assert.equal(await page.evaluate(`document.activeElement === document.querySelector(${js(selector)})`), true, 'the click does not put the caret in the block');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y, button: 'none' });
    await frames(page);
    const was = await page.evaluate(`document.querySelector(${js(selector)}).getBoundingClientRect().left`);
    await drag(page, '.beeson-handle', { dx: 60, dy: 30 });
    await frames(page);
    const now = await page.evaluate(`document.querySelector(${js(selector)}).getBoundingClientRect().left`);
    assert.ok(now - was > 40, `the block is moved by ${now - was} px in place of about 60 px`);
    assert.match(await page.evaluate(`document.querySelector(${js(selector)}).getAttribute('style') ?? ''`), /translate:/);
  });
}

for (const [slide, selector] of [[0, '.reveal section.present h1'], [TEXT, '.reveal section.present h2']]) {
  test(`a drag of the east grip of ${selector} with the caret in it sets its width`, async (t) => {
    const page = await editorPage(browser, { deck: DECK, page: { width: 1600, height: 1000 }, clear: true });
    t.after(() => page.close().catch(() => {}));
    await page.evaluate(`Reveal.slide(${slide})`);
    await frames(page);
    await click(page, await center(page, selector));
    await frames(page);
    assert.equal(await page.evaluate(`document.activeElement === document.querySelector(${js(selector)})`), true, 'the click does not put the caret in the block');
    const grip = await page.evaluate(`(() => {
      const g = [...document.querySelectorAll('.beeson-grip[data-handle=e]')].find((g) => !g.hidden);
      const r = g?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    })()`);
    assert.ok(grip, 'the block with the caret is drawn without grips');
    const was = await page.evaluate(`document.querySelector(${js(selector)}).getBoundingClientRect().width`);
    await drag(page, grip, { dx: -150 });
    await frames(page);
    const now = await page.evaluate(`document.querySelector(${js(selector)}).getBoundingClientRect().width`);
    assert.ok(was - now > 100, `the block is narrowed by ${was - now} px in place of about 150 px`);
    assert.match(await page.evaluate(`document.querySelector(${js(selector)}).getAttribute('style') ?? ''`), /width:/);
  });
}

// the frame and every grip of a block stay drawn while one of its grips is dragged, from a block
// selected by Esc and from a block with the caret in it
for (const esc of [true, false]) {
  test(`the frame and the grips of a heading are drawn during the drag of its east grip (${esc ? 'selected by Esc' : 'caret'})`, async (t) => {
    const page = await editorPage(browser, { deck: DECK, page: { width: 1600, height: 1000 }, clear: true });
    t.after(() => page.close().catch(() => {}));
    await page.evaluate(`Reveal.slide(${TEXT})`);
    await frames(page);
    await click(page, await center(page, '.reveal section.present h2'));
    await frames(page);
    if (esc) {
      await press(page, 'Escape');
      await frames(page);
    }
    const shown = (selector) => page.evaluate(`[...document.querySelectorAll(${js(selector)})].filter((e) => !e.hidden).length`);
    const grip = await page.evaluate(`(() => {
      const r = [...document.querySelectorAll('.beeson-grip[data-handle=e]')].find((g) => !g.hidden).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await drag(page, grip, { dx: -100, hold: true });
    await frames(page);
    assert.equal(await shown('.beeson-frame.selected'), 1, 'the frame is hidden during the resize');
    assert.equal(await shown('.beeson-grip'), 6, 'the grips are hidden during the resize');
  });
}
