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

// finding 4, as the juror amended it: the presenter display and the rehearsal were drawn in the
// gray of the chrome in the light appearance, while the presenter displays of Keynote and
// PowerPoint are black in both appearances (K50, K51, and P45)
const LOOK = `(() => {
  const d = document.querySelector('dialog.beeson-edit-presenter[open]');
  const bg = (el, pseudo) => getComputedStyle(el, pseudo).backgroundColor;
  return { stage: bg(d), head: bg(d.querySelector('.bar')), foot: bg(d.querySelector('.bar.foot')), backdrop: bg(d, '::backdrop'), text: getComputedStyle(d).color };
})()`;
for (const platform of PLATFORMS) {
  test(`the presenter display and the rehearsal are drawn on a black stage in the light and the dark appearance (${platform})`, async (t) => {
    const looks = [];
    for (const mode of ['light', 'dark']) {
      const page = await load(t, platform, { mode, n: 2 });
      await press(page, 'Alt+Enter');
      await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter[open]')`, 20000);
      looks.push(['presenter display', mode, await page.evaluate(LOOK)]);
      await press(page, 'Escape');
      await page.waitFor(`!document.querySelector('dialog.beeson-edit-presenter[open]')`);
      await page.evaluate(`${TAB}?.close(), true`);
      await page.evaluate(`window.BeesonEditor.exec('play.rehearse'), true`);
      await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter.rehearse[open]')`, 20000);
      looks.push(['rehearsal', mode, await page.evaluate(LOOK)]);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
    // each part that is not black, and the text where it is not light
    const off = [];
    for (const [what, mode, look] of looks) {
      for (const part of ['stage', 'head', 'foot', 'backdrop']) if (look[part] !== 'rgb(0, 0, 0)') off.push(`${what}, ${mode}: ${part} ${look[part]}`);
      if (Math.min(...look.text.match(/\d+/g).slice(0, 3).map(Number)) <= 200) off.push(`${what}, ${mode}: text ${look.text}`);
    }
    assert.deepEqual(off, [], 'the presenter display or the rehearsal is not drawn on a black stage');
  });
}

// finding steps-transitions-present-4: the transition control mixed two directions, None and Fade
// into the slide and Magic Move to the next slide, hence a slide entered by Magic Move showed Fade,
// and None on it left the Magic Move in place and previewed it. the control now has the direction
// of Keynote, in which the transition of a slide is played when the show leaves it
const SEG = `[...document.querySelectorAll('.beeson-edit-transition [data-command^="slide.transition."]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.command.split('.').pop())`;
// the data-transition and the data-auto-animate of slides 3 to 5
const TAGS = `[...document.querySelectorAll('.reveal .slides > section')].slice(2, 5).map((s) => [s.getAttribute('data-transition'), s.hasAttribute('data-auto-animate')])`;
const segment = (kind) => `.beeson-edit-transition [data-command="slide.transition.${kind}"]`;
for (const platform of PLATFORMS) {
  test(`the transition of a slide is played when the show leaves it, as in Keynote, and the control shows the file in that direction (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    if (!(await page.evaluate(`window.BeesonEditor.state('view.steps').checked`))) await page.evaluate(`window.BeesonEditor.exec('view.steps')`);
    await frames(page);
    const goTo = async (n) => {
      await page.evaluate(`Reveal.slide(${n})`);
      await frames(page);
    };
    // Magic Move on slide 3 moves it into slide 4
    await click(page, segment('magic'));
    await frames(page);
    assert.deepEqual(await page.evaluate(SEG), ['magic']);
    assert.deepEqual(await page.evaluate(TAGS), [[null, true], [null, true], [null, false]]);
    // None on slide 4 cuts from slide 4 into slide 5, and the Magic Move into slide 4 is kept
    await goTo(3);
    assert.deepEqual(await page.evaluate(SEG), ['fade'], 'slide 4 does not show the Fade by which the show leaves it');
    await click(page, segment('none'));
    await frames(page);
    assert.deepEqual(await page.evaluate(TAGS), [[null, true], [null, true], ['none', false]], 'None on slide 4 is not written as the cut from slide 4 into slide 5');
    assert.deepEqual(await page.evaluate(SEG), ['none']);
    // Preview on slide 4 plays its own transition, from slide 4 into slide 5
    await click(page, '.beeson-edit-transition .preview');
    const plan = await page.evaluate(`(() => { const l = document.querySelector('.beeson-edit-preview'); return l && { kind: l.dataset.kind, shots: [...l.querySelectorAll('.shot')].map((s) => s.shadowRoot.querySelector('h1, h2')?.textContent.trim()) }; })()`);
    const headings = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].slice(3, 5).map((s) => s.querySelector('h1, h2').textContent.trim())`);
    assert.deepEqual(plan, { kind: 'none', shots: headings }, 'Preview on slide 4 does not play the cut from slide 4 into slide 5');
    await press(page, 'Escape');
    // Fade on slide 3 takes the Magic Move off both slides
    await goTo(2);
    assert.deepEqual(await page.evaluate(SEG), ['magic']);
    await click(page, segment('fade'));
    await frames(page);
    assert.deepEqual(await page.evaluate(TAGS), [[null, false], [null, false], ['none', false]]);
    assert.deepEqual(await page.evaluate(SEG), ['fade']);
    assert.match(await page.evaluate(`document.querySelector('${segment('fade')}').title`), /next slide/);
    // the last slide is not left for another slide, hence it has no transition
    await goTo(11);
    assert.deepEqual(await page.evaluate(SEG), [], 'the last slide shows a transition');
    assert.equal(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-transition [data-command^="slide.transition."]')].every((b) => b.disabled)`), true);
    await roundTrip(page, 3);
  });
}

// finding steps-transitions-present-5: a Shift or Mod click on a row of the Steps list selected its
// element alone, and the commands of the chip menu acted on one element, hence several elements
// could not be given a step together
const ROW = (text) => `[...document.querySelectorAll('.beeson-edit-side .rows .row')].find((r) => r.querySelector('.text').textContent.startsWith(${js(text)}))`;
const pointIn = (page, el, fx = 0.5) => page.evaluate(`(() => { const el = ${el}; el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width * ${fx}, y: r.top + r.height / 2 }; })()`);
const SELECTED_ROWS = `[...document.querySelectorAll('.beeson-edit-side .rows .row.selected')].map((r) => r.querySelector('.text').textContent.slice(0, 15))`;
async function choose(page, label) {
  const item = await pointIn(page, `[...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label').textContent === ${js(label)} && i.getAttribute('aria-disabled') !== 'true')`);
  await sleep(300);
  await click(page, item);
}
const openSteps = async (page) => {
  if (!(await page.evaluate(`window.BeesonEditor.state('view.steps').checked`))) await page.evaluate(`window.BeesonEditor.exec('view.steps')`);
  await frames(page);
};
const [HEADING, PARA, LAST] = ['Show your steps', 'Design the comp', 'When exporting '];
for (const platform of PLATFORMS) {
  test(`Shift and Mod clicks on rows of the Steps list add their elements to the selection (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await openSteps(page);
    await click(page, await pointIn(page, ROW(HEADING), 0.7));
    await click(page, await pointIn(page, ROW(PARA), 0.7), { modifiers: 'Shift' });
    await frames(page);
    assert.deepEqual(await page.evaluate(SELECTED_ROWS), [HEADING, PARA], 'Shift does not add a row to the selection');
    await click(page, await pointIn(page, ROW(LAST), 0.7), { modifiers: 'Mod' });
    await frames(page);
    // the row of the stepped list item is above the rows of the elements shown with the slide
    assert.deepEqual((await page.evaluate(SELECTED_ROWS)).sort(), [HEADING, PARA, LAST].sort(), 'Mod does not add a row to the selection');
    await click(page, await pointIn(page, ROW(LAST), 0.7), { modifiers: 'Mod' });
    await frames(page);
    assert.deepEqual(await page.evaluate(SELECTED_ROWS), [HEADING, PARA], 'Mod does not take a row off the selection');
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`the chip menu of a selected row gives every selected element one step together, as one entry of the history (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await openSteps(page);
    // the paragraph and the heading selected on the canvas
    await click(page, '.reveal section.present > p');
    await press(page, 'Escape');
    await click(page, '.reveal section.present > h2', { modifiers: 'Shift' });
    await frames(page);
    assert.deepEqual(await page.evaluate(SELECTED_ROWS), [HEADING, PARA]);
    await click(page, await pointIn(page, `${ROW(PARA)}.querySelector('.chip')`));
    await page.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
    assert.deepEqual(await page.evaluate(SELECTED_ROWS), [HEADING, PARA], 'the chip menu selects its row alone');
    await choose(page, 'New Step at End');
    await frames(page);
    const steps = await page.evaluate(`[${ROW(HEADING)}.dataset.step, ${ROW(PARA)}.dataset.step, ${ROW(LAST)}.dataset.step]`);
    assert.equal(steps[0], steps[1], 'the two elements are not given one step');
    assert.equal(Number(steps[0]), Number(steps[2]) + 1, 'the step is not new at the end');
    await roundTrip(page, 1);
  });
}

// steps-transitions-present-6 and -7: the chip of a row with a start mark or Show Last is kept
// off the text of its row, and the two Preview buttons of the Steps tab are told apart
const TWO = 'Two elements wi';
const overlap = (text) => `(() => { const r = ${ROW(text)}; return r.querySelector('.chip').getBoundingClientRect().right - r.querySelector('.text').getBoundingClientRect().left; })()`;
for (const platform of PLATFORMS) {
  test(`the chip of a row with a start mark or Show Last does not cover its text (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await openSteps(page);
    for (const [row, label] of [[TWO, 'With Previous'], [TWO, 'After Previous'], [LAST, 'Show Last']]) {
      await click(page, await pointIn(page, `${ROW(row)}.querySelector('.chip')`));
      await page.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
      await choose(page, label);
      await frames(page);
      assert.ok((await page.evaluate(overlap(row))) <= 0, `the chip of ${label} covers the text of its row by ${await page.evaluate(overlap(row))} px`);
    }
    assert.deepEqual(errors(page), []);
  });

  test(`the two Preview buttons of the Steps tab name what they play (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await openSteps(page);
    const labels = await page.evaluate(`[document.querySelector('.beeson-edit-transition .preview'), document.querySelector('.beeson-edit-side .head button.play')].map((b) => b?.textContent.trim())`);
    assert.deepEqual(labels, ['Preview Transition', 'Preview Steps']);
    assert.deepEqual(errors(page), []);
  });
}

// the speaker view of reveal.js, which s opens, sends each key pressed in it to its frame of the
// current slide as triggerKey (setupKeyboard in theme/vendor/reveal/notes.js), and a keydown on its
// document is sent the same way. the speaker view opened by the window w is kept in w.__speaker
// and in window.__speakerKept of the page
const SPEAKER_FRAME = (w) => `${w}.__speaker?.document.querySelector('#current-slide iframe')?.contentWindow`;
const keepSpeaker = (w) => `(() => { const w = ${w}; const real = w.open; w.open = function (...a) { const v = real.apply(w, a); w.__speaker = v; window.__speakerKept = v; return v; }; return true; })()`;
const speakerReady = (w) => `(() => { try { return !!${SPEAKER_FRAME(w)}?.Reveal?.isReady?.(); } catch { return false; } })()`;
const speakerKey = (keyCode) => `(window.__speakerKept.document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: ${keyCode}, bubbles: true })), true)`;
const within = (page, expression, timeout) => page.waitFor(expression, timeout).then(() => true, () => false);

for (const platform of PLATFORMS) {
  test(`e in the speaker view of a deck opened by itself opens the editor in the window of the show at the slide shown, and not in the speaker view (${platform})`, async (t) => {
    const page = await browser.newPage({ width: 1600, height: 1000 });
    t.after(() => page.close().catch(() => {}));
    await page.goto(`${server.origin}/index.html?still&edit-platform=${platform}#/2`);
    await page.waitFor(deckSettled);
    await page.evaluate(keepSpeaker('window'));
    await press(page, 's');
    await page.waitFor(speakerReady('window'), 20000);
    await sleep(500);
    await page.evaluate(speakerKey(69));
    assert.ok(await within(page, `new URLSearchParams(location.search).has('edit') && !!window.BeesonEditor`, 10000), 'e in the speaker view does not open the editor in the window of the show');
    await page.waitFor('window.BeesonEditor.ready.then(() => true)');
    assert.equal(await page.evaluate('Reveal.getIndices().h'), 2, 'the editor is not opened at the slide shown');
    // the speaker view is found by the name of its window
    const frame = await page.evaluate(`(() => { const v = window.open('', 'reveal.js - Notes'); const f = v.document.querySelector('#current-slide iframe').contentWindow; const out = [new URLSearchParams(f.location.search).has('edit'), !!f.document.querySelector('script[src*="editor.js"]')]; v.close(); return out; })()`);
    assert.deepEqual(frame, [false, false], 'the editor is loaded into the frame of the speaker view');
  });

  test(`e and Esc in the speaker view of the show in place end the show and return to the editor at the slide shown (${platform})`, async (t) => {
    for (const [name, keyCode] of [['e', 69], ['Esc', 27]]) {
      const page = await present(t, platform);
      await page.evaluate(`${SHOW}.Reveal.slide(3)`);
      await page.evaluate(keepSpeaker(SHOW));
      await press(page, 's');
      await page.waitFor(speakerReady(SHOW), 20000);
      await sleep(500);
      const shown = await showHeading(page);
      await page.evaluate(speakerKey(keyCode));
      assert.ok(await within(page, stageGone, 5000), `${name} in the speaker view does not end the show`);
      assert.equal(await editorHeading(page), shown, `${name} in the speaker view does not return to the slide shown`);
      assert.deepEqual(errors(page), []);
    }
  });

  test(`the speaker view is closed with the show in place, when the show is ended with e or Esc in its own window (${platform})`, async (t) => {
    for (const key of ['e', 'Escape']) {
      const page = await present(t, platform);
      await page.evaluate(keepSpeaker(SHOW));
      await press(page, 's');
      await page.waitFor(speakerReady(SHOW), 20000);
      await sleep(500);
      await page.evaluate(`${SHOW}.focus()`);
      await press(page, key);
      await page.waitFor(stageGone, 5000);
      assert.ok(await within(page, 'window.__speakerKept.closed', 3000), `the speaker view is left open after ${key} in the show`);
      assert.deepEqual(errors(page), []);
    }
  });
}
