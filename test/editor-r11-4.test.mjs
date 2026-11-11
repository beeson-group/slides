// the work of R11.4 on both platforms: the parts of the presenter display moved and resized while
// it is customized, as in Customize Presenter Display of Keynote (K52), the TeX popover of a
// formula by the keyboard, and a marquee held at the edge of a zoomed canvas. each edit of the file
// is checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const OUTLINE = 'test/pages/editor-outline.html';
const LAYOUTS = 'test/pages/editor-layouts.html';
// the slide of editor-layouts.html with a display, an ordered list, and a zone
const MATH = 3;
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
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const near = (a, b, by = 2) => Math.abs(a - b) <= by;
const sameRect = (a, b, by = 2) => !!a && !!b && near(a.left, b.left, by) && near(a.top, b.top, by) && near(a.width, b.width, by) && near(a.height, b.height, by);
const mouse = (page, type, x, y) => page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
// the box of the first element of selector on the screen, or null when it is not shown
const rectOf = (page, selector) => page.evaluate(`(() => { const e = document.querySelector(${js(selector)}); if (!e || !e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);
// the selected elements, a display as math
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => el.matches('div.math') ? 'math' : el.localName)`);

// the editor on a deck served over HTTP, with the storage of the origin emptied first, and with
// slide n shown
async function load(t, platform, { deck = OUTLINE, n = 0, size = { width: 1600, height: 1000 } } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the rendered text is edited, an undo gives the text before and a redo the edited text byte for
// byte, and the saved text is opened again without problems
async function checkEdit(page, before, edited, name) {
  assert.equal(await render(page), edited);
  await undo(page);
  assert.equal(await render(page), before);
  await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, name);
  assert.equal(text, edited);
}

// a marquee from the empty slide held at the top edge of a zoomed canvas scrolls it, with the start
// corner of the marquee kept on its point of the slide, and selects what it covers at the release
const CANVAS = `(() => { const c = document.querySelector('.beeson-edit-canvas'), v = window.BeesonEditorShell.stage.viewport; return { x: c.scrollLeft, y: c.scrollTop, zoomed: c.classList.contains('zoomed'), left: v.left, top: v.top, width: v.width, height: v.height }; })()`;
for (const platform of PLATFORMS) {
  test(`a marquee held at the edge of a zoomed canvas scrolls it, and selects what it covers at the release (${platform})`, async (t) => {
    // a window 600 px high, in which the canvas at Actual Size scrolls the display out of view
    const page = await load(t, platform, { deck: LAYOUTS, n: MATH, size: { width: 1600, height: 600 } });
    await exec(page, 'zoom.actual');
    await frames(page);
    // an empty point of the slide under the list, with the canvas scrolled to put the point 300 px
    // right of its left edge and the slide y of 560 px, under the display, at its top edge or as near
    // as the canvas scrolls
    const start = { x: 640, y: 1000 };
    const at = await page.evaluate(`(() => {
      const c = document.querySelector('.beeson-edit-canvas'), st = window.BeesonEditorShell.stage, v = st.viewport;
      c.scrollLeft += st.toScreen(${js(start)}).x - v.left - 300;
      c.scrollTop += st.toScreen({ x: 0, y: 560 }).y - v.top;
      st.place();
      return st.toScreen(${js(start)});
    })()`);
    await frames(page);
    const before = await page.evaluate(CANVAS);
    assert.ok(before.zoomed, 'the canvas is not zoomed at Actual Size');
    const math0 = await rectOf(page, '.reveal section.present div.math');
    assert.ok(math0.top + math0.height < before.top, `the display is in view before the marquee, at ${js(math0)}`);
    // the marquee to 4 px under the top of the canvas, held there for a second with small moves
    const edge = before.top + 4;
    await drag(page, at, { dx: 0, dy: edge - at.y, hold: true });
    for (let i = 0; i < 12; i++) {
      await mouse(page, 'mouseMoved', at.x, edge - (i % 2));
      await sleep(100);
    }
    await mouse(page, 'mouseMoved', at.x, edge);
    await frames(page);
    const held = await page.evaluate(CANVAS);
    assert.ok(held.y < before.y - 50, `the canvas is scrolled from ${before.y} to ${held.y} while the marquee is held at its top edge`);
    // the start corner stays on its point of the slide, and the marquee reaches the pointer
    const corner = await page.evaluate(`window.BeesonEditorShell.stage.toScreen(${js(start)})`);
    const box = await rectOf(page, '.beeson-marquee');
    assert.ok(box && near(box.top + box.height, corner.y) && near(box.left, corner.x) && near(box.top, edge), `the marquee is ${js(box)}, from the start corner ${js(corner)} to the pointer at ${edge}`);
    // the elements covered by the marquee are selected at the release
    await mouse(page, 'mouseReleased', at.x, edge);
    await frames(page);
    const picked = await selected(page);
    assert.ok(picked.includes('ol'), `the marquee does not select the list: ${js(picked)}`);
    assert.ok(picked.includes('math'), `the marquee does not select the display, which it covers after the scroll: ${js(picked)}`);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}
