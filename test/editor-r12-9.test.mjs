// regression tests of R12.9 on both platforms with trusted input: the show tab of the presenter
// display ended with the display, and the keys of PowerPoint in the show played by Present, i.e.
// Return and Backspace, and a slide number typed before Return

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press } from './helpers/editor.mjs';

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
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// the editor on slide n of index.html, served over HTTP, with every window that the page opens kept
// in window.__shows
async function load(t, platform, n = 0) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/test-deck.html?edit&still&theme=light&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('test-deck.html', 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await page.evaluate(`(() => { const real = window.open; window.__shows = []; window.open = function (...a) { const w = real.apply(window, a); window.__shows.push(w); return w; }; return true; })()`);
  await frames(page);
  return page;
}

const DISPLAY = 'dialog.beeson-edit-presenter[open]';
const TAB = 'window.__shows.at(-1)';
const tabClosed = `(() => { try { return ${TAB}.closed; } catch { return true; } })()`;

// finding steps-transitions-present-1: Esc and End of the presenter display closed the display,
// and the show tab stayed open at the slide shown last
for (const platform of PLATFORMS) {
  test(`Esc and End of the presenter display end the show in its tab too (${platform})`, async (t) => {
    for (const how of ['Escape', 'End']) {
      const page = await load(t, platform, 1);
      await press(page, 'Alt+Enter');
      await page.waitFor(`!!document.querySelector(${js(DISPLAY)}) && !!${TAB}?.Reveal?.isReady()`, 20000);
      await sleep(300);
      await press(page, 'ArrowRight');
      await press(page, 'ArrowRight');
      await page.waitFor(`${TAB}.Reveal.getIndices().h === 2`, 5000);
      if (how === 'Escape') await press(page, 'Escape');
      else await click(page, `${DISPLAY} button.end`);
      await page.waitFor(`!document.querySelector(${js(DISPLAY)})`);
      await sleep(300);
      assert.equal(await page.evaluate(tabClosed), true, `${how} of the presenter display leaves the show tab open`);
      assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelector('h2').textContent`), 'Show your steps one at a time', 'the editor is not at the slide shown last');
      await byteExact(page);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });
}

// the frame of the show played by Present
const SHOW = `document.querySelector('.beeson-edit-show iframe')?.contentWindow`;
const showReady = `(() => { try { const w = ${SHOW}; return !!w?.Reveal?.isReady() && (!w.MathJax || (w.MathJax.startup?.promise?.then(() => true) ?? false)); } catch { return false; } })()`;
const at = (page) => page.evaluate(`(() => { const i = ${SHOW}.Reveal.getIndices(); return [i.h, i.f ?? -1]; })()`);
async function present(t, platform, n) {
  const page = await load(t, platform, n);
  await press(page, 'Mod+Enter');
  await page.waitFor(showReady, 20000);
  await sleep(300);
  return page;
}

// finding steps-transitions-present-2: Return and Backspace did not move the played show, whose
// keys differed from those of the presenter display
for (const platform of PLATFORMS) {
  test(`in the show played by Present, Return goes forward and Backspace goes back, and p stays the pointer (${platform})`, async (t) => {
    const page = await present(t, platform, 2);
    assert.deepEqual(await at(page), [2, -1]);
    await press(page, 'ArrowRight');
    await press(page, 'Enter');
    await sleep(200);
    assert.deepEqual(await at(page), [2, 1], 'Return does not go forward');
    await press(page, 'Backspace');
    await sleep(200);
    assert.deepEqual(await at(page), [2, 0], 'Backspace does not go back');
    await press(page, 'p');
    await page.waitFor(`!!${SHOW}.document.querySelector('.pointer-dot')`, 3000);
    await press(page, 'p');
    await page.waitFor(`!${SHOW}.document.querySelector('.pointer-dot')`, 3000);
    assert.deepEqual(await at(page), [2, 0], 'p moves the show');
    // Return closes the overview of reveal.js, without a move
    await press(page, 'o');
    await page.waitFor(`${SHOW}.Reveal.isOverview()`, 3000);
    await press(page, 'Enter');
    await page.waitFor(`!${SHOW}.Reveal.isOverview()`, 3000);
    assert.equal(await page.evaluate(`${SHOW}.Reveal.getIndices().h`), 2, 'Return in the overview moves the show');
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('.beeson-edit-show')`);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}

// finding steps-transitions-present-5: a slide number typed before Return did not go to its slide
for (const platform of PLATFORMS) {
  test(`in the show played by Present, a slide number typed before Return goes to its slide (${platform})`, async (t) => {
    const page = await present(t, platform, 0);
    assert.deepEqual(await at(page), [0, -1]);
    await press(page, '5');
    await press(page, 'Enter');
    await sleep(300);
    assert.equal(await page.evaluate(`${SHOW}.Reveal.getIndices().h`), 4, '5 and Return do not go to slide 5');
    await press(page, '1');
    await press(page, '0');
    await press(page, 'Enter');
    await sleep(300);
    assert.equal(await page.evaluate(`${SHOW}.Reveal.getIndices().h`), 9, '10 and Return do not go to slide 10');
    // a number followed by another key is dropped, and Return then goes forward
    await press(page, '2');
    await press(page, 'ArrowLeft');
    await press(page, 'Enter');
    await sleep(300);
    assert.equal(await page.evaluate(`${SHOW}.Reveal.getIndices().h`), 9, 'a number is kept after another key');
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('.beeson-edit-show')`);
    assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelector('h2').textContent`), 'Embedding TyCHO scenes');
    assert.deepEqual(errors(page), []);
  });
}

// a deck opened by itself keeps the keys of reveal.js: Return, Backspace, and a number do not move it
test('a deck opened by itself does not take Return, Backspace, or a number', async (t) => {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/test-deck.html?still#/2`);
  await page.waitFor(deckSettled);
  const here = () => page.evaluate('(() => { const i = Reveal.getIndices(); return [i.h, i.f ?? -1]; })()');
  assert.deepEqual(await here(), [2, -1]);
  for (const key of ['Enter', 'Backspace', '5', 'Enter']) await press(page, key);
  await sleep(300);
  assert.deepEqual(await here(), [2, -1]);
  assert.deepEqual(errors(page), []);
});

// the presenter display with a customized layout plays the show in its tab: Esc first ends the
// customizing with the show kept, and Esc then ends the display and the show tab
const rectOf = (page, selector) => page.evaluate(`(() => { const e = document.querySelector(${js(selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top }; })()`);
for (const platform of PLATFORMS) {
  test(`the presenter display keeps its customized layout with the show tab, and Esc ends the customizing before the show (${platform})`, async (t) => {
    const page = await load(t, platform, 1);
    await page.evaluate(`localStorage.setItem('beeson-presenter-layout:' + location.pathname, ${js(JSON.stringify({ notes: { x: 0.05, y: 0.6, w: 0.4, h: 0.3 } }))}), true`);
    await press(page, 'Alt+Enter');
    await page.waitFor(`!!document.querySelector(${js(DISPLAY)}) && !!${TAB}?.Reveal?.isReady()`, 20000);
    await sleep(300);
    const notes = await rectOf(page, `${DISPLAY} .notes`);
    assert.ok(Math.abs(notes.left - 80) <= 2 && Math.abs(notes.top - 600) <= 2, `the notes are at ${js(notes)}, not at the stored layout`);
    await click(page, `${DISPLAY} .bar.top button[aria-label="Display Options"]`);
    await click(page, `${DISPLAY} .parts button`);
    await page.waitFor(`!!document.querySelector('${DISPLAY} .layout:not([hidden])')`, 3000);
    await press(page, 'ArrowRight');
    await page.waitFor(`${TAB}.Reveal.getIndices().h === 2`, 5000);
    // the timer of a tab behind the show tab is slowed, and its frames are not drawn
    await press(page, 'Escape');
    await sleep(300);
    assert.ok(await page.evaluate(`!!document.querySelector(${js(DISPLAY)})`), 'Esc while the display is customized ends the display');
    assert.equal(await page.evaluate(tabClosed), false, 'Esc while the display is customized ends the show');
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector(${js(DISPLAY)})`);
    await sleep(300);
    assert.equal(await page.evaluate(tabClosed), true, 'Esc leaves the show tab open');
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}
