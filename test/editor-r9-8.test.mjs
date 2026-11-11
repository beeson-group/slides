// regression tests of R9.8 on both platforms with trusted input: Present from a slide after a
// hidden slide, the show played in place over the editor, the steps of the presenter view as the
// show plays them, the presenter display, the transition of a slide in one direction, a step given
// to several elements at once, and the rows and buttons of the Steps pane. after each edit the text
// is checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
// a deck of five slides whose second slide is hidden
const PRESENT = 'test/pages/editor-present.html';

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
let saves = 0;

// load opens the editor on the slide n of deck, served over HTTP, and keeps every window that the
// page opens in window.__shows
async function load(t, platform, { deck = 'index.html', n = 0, mode = 'light', width = 1600, height = 1000 } = {}) {
  const page = await browser.newPage({ width, height });
  t.after(() => page.close().catch(() => {}));
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }] });
  const url = `${server.origin}/${deck}?edit&still&theme=${mode}&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await page.evaluate(`(() => { const real = window.open; window.__shows = []; window.open = function (...a) { const w = real.apply(window, a); window.__shows.push(w); return w; }; return true; })()`);
  await frames(page);
  return page;
}

// roundTrip checks the text before byte for byte after undos undos, the edit after as many redos,
// and an open of the saved edit without problems, which is the text before the next check
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r9-8-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

// SHOW is the window of the show started from the editor, i.e. the frame of the show in place, or
// else the last window that the page opened
const SHOW = `(document.querySelector('.beeson-edit-show iframe')?.contentWindow ?? window.__shows?.at(-1))`;
// showReady is true once reveal.js and MathJax are ready in the show, before which a jump to a
// slide with formulas is not made by a presenter
const showReady = `(() => { try { const w = ${SHOW}; if (!w?.Reveal?.isReady()) return false; return !w.MathJax || (w.MathJax.startup?.promise?.then(() => true) ?? false); } catch { return false; } })()`;
const showHeading = (page) => page.evaluate(`${SHOW}.Reveal.getCurrentSlide().querySelector('h1, h2').textContent.trim()`);
const editorHeading = (page) => page.evaluate(`Reveal.getCurrentSlide().querySelector('h1, h2').textContent.trim()`);

// finding steps-transitions-present-3: Present opened the show one slide too far for each hidden
// slide before the current slide, since presentAt read the index of the slide in the editor, which
// keeps the hidden slides
for (const platform of PLATFORMS) {
  test(`Present opens the show at the current slide after a hidden slide, and at the next shown slide from a hidden one (${platform})`, async (t) => {
    for (const [n, heading, shown] of [[3, 'Four', 'Four'], [4, 'Five', 'Five'], [1, 'Two', 'Three']]) {
      const page = await load(t, platform, { deck: PRESENT, n });
      assert.equal(await editorHeading(page), heading);
      await press(page, 'Mod+Enter');
      await page.waitFor(showReady, 20000);
      assert.equal(await showHeading(page), shown, `Present from the slide ${heading} shows another slide`);
      await page.close();
    }
  });
}

const stageGone = `!document.querySelector('.beeson-edit-show')`;

// finding steps-transitions-present-1: Present opened the show in a new tab that was not full
// screen, Esc there opened the overview of reveal.js, and the editor stayed at its own slide
for (const platform of PLATFORMS) {
  test(`Present plays the show in place over the whole screen, and Esc ends it at the slide shown last (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await press(page, 'Mod+Enter');
    await page.waitFor(showReady, 20000);
    assert.equal(await page.evaluate('window.__shows.length'), 0, 'Present opens the show in a new tab');
    assert.equal(await page.evaluate(`document.fullscreenElement?.className ?? null`), 'beeson-edit-show', 'the show is not full screen');
    assert.equal(await showHeading(page), 'Show your steps one at a time');
    assert.equal(await page.evaluate(`!!${SHOW}.BeesonEditor || !!${SHOW}.document.querySelector('script[src$="editor.js"]')`), false, 'the editor is loaded in the show');
    // the keys go to the show
    await press(page, 'ArrowRight');
    await page.waitFor(`${SHOW}.Reveal.getIndices().f === 0`);
    await page.evaluate(`${SHOW}.Reveal.slide(6), true`);
    await sleep(300);
    await press(page, 'Escape');
    await page.waitFor(stageGone);
    assert.equal(await page.evaluate('document.fullscreenElement'), null);
    assert.equal(await editorHeading(page), 'Chapter two', 'the editor is not at the slide shown last');
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`a show that the browser does not take into full screen fills the window, and Esc ends it (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await page.evaluate(`Element.prototype.requestFullscreen = function () { return Promise.reject(new TypeError('refused')); }, true`);
    await press(page, 'Mod+Enter');
    await page.waitFor(showReady, 20000);
    const box = await page.evaluate(`(() => { const r = document.querySelector('.beeson-edit-show iframe').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
    assert.deepEqual(box, [0, 0, 1600, 1000], 'the show does not fill the window');
    await page.evaluate(`${SHOW}.Reveal.slide(4), true`);
    await sleep(300);
    await press(page, 'Escape');
    await page.waitFor(stageGone);
    assert.equal(await editorHeading(page), 'Figures are first class citizens, too');
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`Present with unsaved changes asks first, and the saved file is then played in place over the whole screen (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await page.evaluate(`window.BeesonEditor.exec('slide.hide')`);
    await press(page, 'Mod+Enter');
    await page.waitFor(`[...document.querySelectorAll('dialog[open] button')].some((b) => b.textContent === 'Present the saved file')`);
    const at = await page.evaluate(`(() => { const r = [...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent === 'Present the saved file').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await click(page, at);
    await page.waitFor(showReady, 20000);
    assert.equal(await page.evaluate('window.__shows.length'), 0, 'Present opens the show in a new tab');
    assert.equal(await page.evaluate(`document.fullscreenElement?.className ?? null`), 'beeson-edit-show', 'the show is not full screen');
    assert.equal(await showHeading(page), 'Show your steps one at a time');
    await press(page, 'Escape');
    await page.waitFor(stageGone);
    assert.equal(await page.evaluate('window.BeesonEditor.status().dirty'), true);
    assert.deepEqual(errors(page), []);
  });
}

// with Use Rehearsed Timings on, the show in place is moved on after the timing of its slide
for (const platform of PLATFORMS) {
  test(`with Use Rehearsed Timings on, the show in place moves on after the timing of its slide (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: PRESENT, n: 3 });
    await page.evaluate(`localStorage.setItem('beeson-use-timings', '1'), true`);
    await press(page, 'Mod+Enter');
    await page.waitFor(showReady, 20000);
    assert.equal(await showHeading(page), 'Four');
    await page.waitFor(`${SHOW}.Reveal.getCurrentSlide().querySelector('h2').textContent === 'Five'`, 5000);
    await press(page, 'Escape');
    await page.waitFor(stageGone);
    assert.equal(await editorHeading(page), 'Five');
    assert.deepEqual(errors(page), []);
  });
}

// the keys of the section Presenting of the README in the show in place. the frame is at the top
// left of the window, hence a point of the frame is the same point of the page
const inShow = (expression) => `(() => { const w = ${SHOW}; return ${expression}; })()`;
const stageUp = `!!document.querySelector('.beeson-edit-show')`;
const fullStage = `document.fullscreenElement?.className === 'beeson-edit-show'`;
async function present(t, platform, options) {
  const page = await load(t, platform, { n: 2, ...options });
  await press(page, 'Mod+Enter');
  await page.waitFor(showReady, 20000);
  await sleep(300);
  return page;
}

for (const platform of PLATFORMS) {
  test(`in the show in place, d and the toggle at the top right flip the theme of the address, p the pointer, and o the overview (${platform})`, async (t) => {
    const page = await present(t, platform, { mode: 'light' });
    assert.equal(await page.evaluate(inShow(`new URL(w.location.href).searchParams.get('theme')`)), 'light', 'the show is not given the theme of the address of the editor');
    assert.equal(await page.evaluate(inShow('w.document.documentElement.dataset.theme')), 'light');
    await press(page, 'd');
    await page.waitFor(inShow(`w.document.documentElement.dataset.theme === 'dark'`), 3000);
    const toggle = await page.evaluate(inShow(`(() => {
      const b = w.document.querySelector('.theme-switch');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const s = w.getComputedStyle(b);
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      return { x, y, shown: r.width > 0 && Number(s.opacity) > 0 && s.visibility === 'visible' && w.document.elementFromPoint(x, y) === b, right: x > w.innerWidth * 0.75 && y < w.innerHeight * 0.25 };
    })()`));
    assert.ok(toggle?.shown, 'the toggle of the theme is not shown in the show');
    assert.ok(toggle.right, 'the toggle of the theme is not at the top right');
    await click(page, toggle);
    await page.waitFor(inShow(`w.document.documentElement.dataset.theme === 'light'`), 3000);
    await press(page, 'p');
    await page.waitFor(inShow(`!!w.document.querySelector('.pointer-dot')`), 3000);
    await press(page, 'p');
    await page.waitFor(inShow(`!w.document.querySelector('.pointer-dot')`), 3000);
    await press(page, 'o');
    await sleep(500);
    assert.ok(await page.evaluate(stageUp), 'o ends the show');
    assert.equal(await page.evaluate(inShow('w.Reveal.isOverview()')), true, 'o does not open the overview');
    await press(page, 'o');
    await page.waitFor(inShow('!w.Reveal.isOverview()'), 3000);
    assert.ok(await page.evaluate(fullStage));
    await press(page, 'Escape');
    await page.waitFor(stageGone);
    assert.deepEqual(errors(page), []);
  });

  test(`in the show in place, f leaves full screen and enters it again, and the show goes on (${platform})`, async (t) => {
    const page = await present(t, platform);
    assert.ok(await page.evaluate(fullStage));
    await press(page, 'f');
    await sleep(500);
    assert.ok(await page.evaluate(stageUp), 'f ends the show');
    assert.equal(await page.evaluate('document.fullscreenElement'), null, 'f does not leave full screen');
    await press(page, 'ArrowRight');
    await page.waitFor(`${SHOW}.Reveal.getIndices().f === 0`, 3000);
    await press(page, 'f');
    await sleep(500);
    assert.ok(await page.evaluate(fullStage), 'f does not enter full screen again');
    await press(page, 'ArrowRight');
    await page.waitFor(`${SHOW}.Reveal.getIndices().f === 1`, 3000);
    await press(page, 'Escape');
    await page.waitFor(stageGone);
    assert.equal(await page.evaluate('document.fullscreenElement'), null);
    assert.equal(await editorHeading(page), 'Show your steps one at a time');
    assert.deepEqual(errors(page), []);
  });

  test(`in the show in place, e returns to the editor at the slide shown, and the deck is never loaded with edit in the frame (${platform})`, async (t) => {
    const page = await present(t, platform);
    // the listener of the capture phase runs before the one of the show, which may take the frame away
    await page.evaluate(`(() => { const f = document.querySelector('.beeson-edit-show iframe'); window.__loads = []; f.addEventListener('load', () => window.__loads.push(f.contentWindow?.location.href ?? null), true); return true; })()`);
    await page.evaluate(`${SHOW}.Reveal.slide(4), true`);
    await sleep(300);
    await press(page, 'e');
    await page.waitFor(stageGone, 10000);
    await sleep(300);
    assert.deepEqual(await page.evaluate('window.__loads'), [], 'e loads another page into the frame of the show');
    assert.equal(await page.evaluate('document.fullscreenElement'), null);
    assert.equal(await editorHeading(page), 'Figures are first class citizens, too', 'e does not return to the editor at the slide shown');
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`in the show in place, s opens the speaker view with the notes, and the show goes on (${platform})`, async (t) => {
    const page = await present(t, platform);
    await page.evaluate(inShow(`(() => { const real = w.open; w.open = function (...a) { const v = real.apply(w, a); w.__speaker = v; return v; }; return true; })()`));
    await press(page, 's');
    await sleep(1000);
    assert.ok(await page.evaluate(stageUp), 'the speaker view ends the show');
    await page.waitFor(inShow(`/A new element is faded in/.test(w.__speaker?.document.querySelector('.speaker-controls-notes .value')?.textContent ?? '')`), 15000);
    await press(page, 'ArrowRight');
    await page.waitFor(`${SHOW}.Reveal.getIndices().f === 0`, 3000);
    await page.evaluate(inShow('(w.__speaker.close(), true)'));
    await press(page, 'Escape');
    await page.waitFor(stageGone);
    assert.equal(await editorHeading(page), 'Show your steps one at a time');
    assert.deepEqual(errors(page), []);
  });

  test(`in the show in place, the scrubber opens near the bottom edge, and a click on a tick shows its slide (${platform})`, async (t) => {
    const page = await present(t, platform);
    const move = (x, y) => page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await move(800, 990);
    await page.waitFor(inShow(`w.document.querySelector('.reveal').classList.contains('scrubbing')`), 3000);
    const target = await page.evaluate(inShow(`(() => {
      const ticks = [...w.document.querySelectorAll('.scrub-tick')];
      const slides = w.Reveal.getSlides();
      const box = w.document.querySelector('.scrub').getBoundingClientRect();
      const i = 6;
      return { h: w.Reveal.getIndices(slides[i]).h, now: w.Reveal.getIndices().h, x: box.left + box.width * parseFloat(ticks[i].style.left) / 100 };
    })()`));
    assert.notEqual(target.h, target.now);
    await move(target.x, 990);
    await click(page, { x: target.x, y: 990 });
    await page.waitFor(`${SHOW}.Reveal.getIndices().h === ${target.h}`, 3000);
    const heading = await showHeading(page);
    await press(page, 'Escape');
    await page.waitFor(stageGone);
    assert.equal(await editorHeading(page), heading);
    assert.deepEqual(errors(page), []);
  });
}

// VIEW reads the presenter view: the slide and step it shows, from 1 and from 0, the number of
// steps of its slide, and the opacity of each fragment of its current slide, 0 for one not shown
const VIEW = `(() => {
  const d = document.querySelector('dialog.beeson-edit-presenter');
  const [at] = d.querySelector('.count').textContent.split('/').map(Number);
  const m = /Step (\\d+) of (\\d+)/.exec(d.textContent);
  const clone = d.querySelector('.shot.current .pic').shadowRoot.querySelector('.slides > section');
  const opacity = [...clone.querySelectorAll('.fragment')].map((f) => (getComputedStyle(f).visibility === 'hidden' ? 0 : Number(getComputedStyle(f).opacity)));
  return { at, step: m ? Number(m[1]) : 0, n: m ? Number(m[2]) : 0, opacity };
})()`;
const TAB = `window.__shows.at(-1)`;

// finding steps-transitions-present-2: the presenter view counted the steps of a slide without the
// step that the theme adds to restore the dimmed fragments, and it did not dim the earlier steps,
// hence the view and the show fell out of step
for (const platform of PLATFORMS) {
  test(`the presenter view counts and draws the steps of each slide as the show plays them, the restore step included (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await press(page, 'Alt+Enter');
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter[open]') && !!${TAB}?.Reveal?.isReady()`, 20000);
    await sleep(300);
    // slide 3 has three steps, and the theme adds a fourth that restores the dimmed ones
    let view = await page.evaluate(VIEW);
    assert.deepEqual([view.at, view.step, view.n], [3, 0, 4], 'the view does not count the restore step of slide 3');
    await press(page, 'ArrowRight');
    await press(page, 'ArrowRight');
    view = await page.evaluate(VIEW);
    assert.deepEqual(view.opacity, [0.45, 1, 0], 'the view does not dim the earlier step of slide 3 as the show does');
    await press(page, 'ArrowRight');
    await press(page, 'ArrowRight');
    view = await page.evaluate(VIEW);
    assert.deepEqual(view.opacity, [1, 1, 1], 'the restore step of slide 3 does not show every step at full opacity');
    assert.deepEqual(await page.evaluate(`${TAB}.Reveal.getIndices()`), { h: 2, v: 0, f: 3 }, 'the show does not play the restore step of slide 3');
    // the view moved on through every slide of the deck, with the show at its slide and step
    for (let i = 0; i < 60 && !(await page.evaluate(`/End of the show/.test(document.querySelector('dialog.beeson-edit-presenter').textContent)`)); i++) {
      await press(page, 'ArrowRight');
      view = await page.evaluate(VIEW);
      const show = await page.evaluate(`${TAB}.Reveal.getIndices()`);
      assert.deepEqual([show.h, show.f ?? -1], [view.at - 1, view.step - 1], `the show is not at slide ${view.at}, step ${view.step} of the view`);
      const steps = await page.evaluate(`new Set([...${TAB}.Reveal.getCurrentSlide().querySelectorAll('.fragment')].map((f) => f.dataset.fragmentIndex)).size`);
      assert.equal(view.n, steps, `the view counts ${view.n} steps on slide ${view.at}, and the show ${steps}`);
    }
    // the show moved on by itself, and the view follows it through the restore step of slide 3
    await page.evaluate(`${TAB}.Reveal.slide(2, 0, -1), true`);
    await sleep(600);
    for (let k = 1; k <= 4; k++) {
      await page.evaluate(`${TAB}.Reveal.next(), true`);
      // the timer of the view is slowed while the tab of the show is in front
      await page.waitFor(`(() => { const v = ${VIEW}; return v.at === 3 && v.step === ${k}; })()`, 5000).catch(() => {});
      view = await page.evaluate(VIEW);
      assert.deepEqual([view.at, view.step, view.n], [3, k, 4], `the view does not follow step ${k} of the show`);
    }
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('dialog.beeson-edit-presenter[open]')`);
    await page.evaluate(`${TAB}.close(), true`);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}
