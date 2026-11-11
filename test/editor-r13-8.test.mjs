// regression tests of R13.8 on both platforms: the transition of a slide kept at Duplicate Slide,
// the caption of a figure kept when Caption is turned off and on, the end of the show played by
// Present past its last slide, and a typed slide number read in one way by the two shows

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen, selectFigure } from './helpers/editor.mjs';

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
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const exec = (page, id) => page.evaluate(`window.BeesonEditor.exec(${js(id)})`).then(() => frames(page));

// the editor on slide n of a deck, served over HTTP
async function load(t, platform, n = 0, deck = 'index.html') {
  const text = readFileSync(deck, 'utf8');
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?edit&still&theme=light&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = text;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(text)})`);
  assert.deepEqual(s.problems, []);
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the transition by which the show leaves slide n, as the Transition submenu checks it
const transitionAt = async (page, n) => {
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page.evaluate(`['none', 'fade', 'magic'].filter((k) => window.BeesonEditor.state('slide.transition.' + k).checked)`);
};

// finding tour-history-save 1: the copy took the data-transition that encodes the transition into
// the original, which changed the transition out of the original
for (const platform of PLATFORMS) {
  test(`Duplicate Slide keeps the transition of the original and gives it to the copy (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await exec(page, 'slide.transition.none');
    assert.deepEqual(await transitionAt(page, 2), ['none']);
    assert.deepEqual(await transitionAt(page, 3), ['fade']);
    const before = await render(page);
    await exec(page, 'slide.duplicate');
    assert.equal(await page.evaluate('Reveal.getTotalSlides()'), 13);
    assert.deepEqual(await transitionAt(page, 2), ['none'], 'the slide before the original lost its transition');
    assert.deepEqual(await transitionAt(page, 3), ['fade'], 'the original lost its transition');
    assert.deepEqual(await transitionAt(page, 4), ['fade'], 'the copy does not have the transition of the original');
    const done = await render(page);
    await page.evaluate('window.BeesonEditor.undo()');
    assert.equal(await render(page), before, 'the duplicate is not one entry undone byte for byte');
    await page.evaluate('window.BeesonEditor.redo()');
    assert.equal(await render(page), done);
    await saveAndReopen(page);
    assert.deepEqual(errors(page), []);
  });
}

// the center of the Caption switch of the Image pane
const switchAt = (page) => page.evaluate(`(() => { const l = [...document.querySelectorAll('.beeson-edit-inspector label')].find((l) => l.textContent.trim() === 'Caption'); const r = l.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

// finding r12-4-insert-layout-media 2: Caption turned off and on lost the text of the caption, and
// wrote an empty figcaption into the file
for (const platform of PLATFORMS) {
  test(`Caption turned off and on again puts back the caption with its text (${platform})`, async (t) => {
    const page = await load(t, platform, 4);
    await selectFigure(page, 'img.for-light');
    await exec(page, 'figure.caption');
    assert.ok(!(await render(page)).includes('Zero-velocity curves at'), 'Caption off keeps the caption');
    const off = await render(page);
    await exec(page, 'figure.caption');
    await byteExact(page);
    await page.evaluate('window.BeesonEditor.undo()');
    assert.equal(await render(page), off);
    await page.evaluate('window.BeesonEditor.redo()');
    await byteExact(page);
    await saveAndReopen(page);
    assert.deepEqual(errors(page), []);
  });

  test(`Caption on a picture without a caption writes the caption only once it has text (${platform})`, async (t) => {
    const page = await load(t, platform, 10);
    await selectFigure(page, 'video.for-light');
    await exec(page, 'figure.caption');
    assert.ok(await page.evaluate(`!!Reveal.getCurrentSlide().querySelector('.zone > .caption')`), 'Caption does not show a caption to type into');
    await byteExact(page);
    await sleep(100);
    await page.send('Input.insertText', { text: 'x' });
    await frames(page);
    assert.match(await render(page), /<p class="caption">x<\/p>\s*<\/div>/);
    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
    // an empty caption is taken off when the caret leaves it
    await selectFigure(page, 'video.for-light');
    await exec(page, 'figure.caption');
    await page.evaluate('document.activeElement.blur()');
    await sleep(100);
    assert.ok(await page.evaluate(`!Reveal.getCurrentSlide().querySelector('.zone > .caption')`), 'an empty caption stays on the page');
    await byteExact(page);
    await byteExact(page);
    await saveAndReopen(page);
    assert.deepEqual(errors(page), []);
  });

  test(`the Caption switch of the Image pane shows an empty caption, which Caption takes off again (${platform})`, async (t) => {
    const page = await load(t, platform, 0, 'test/pages/editor-multi.html');
    await selectFigure(page, 'img.for-light');
    await click(page, await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-inspector .ed-tabs button')].find((b) => b.textContent.trim() === 'Image'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
    await frames(page);
    await click(page, await switchAt(page));
    await sleep(150);
    const shown = `!!document.querySelector('figure > figcaption')`;
    assert.equal(await page.evaluate(shown), true, 'the switch does not show a caption');
    await byteExact(page);
    // the caret is in the caption, which Caption turns off again
    await exec(page, 'figure.caption');
    assert.equal(await page.evaluate(shown), false, 'Caption does not take the empty caption off');
    assert.equal((await page.evaluate(`window.BeesonEditor.state('figure.caption')`)).checked, false);
    await byteExact(page);
    await selectFigure(page, 'img.for-light');
    await exec(page, 'figure.caption');
    await page.send('Input.insertText', { text: 'A caption' });
    await frames(page);
    assert.match(await render(page), /<figcaption class="caption">A caption<\/figcaption>\s*<\/figure>/);
    assert.deepEqual(errors(page), []);
  });
}

// the frame of the show played by Present, and its slide and step
const SHOW = `document.querySelector('.beeson-edit-show iframe')?.contentWindow`;
const showReady = `(() => { try { const w = ${SHOW}; return !!w?.Reveal?.isReady() && (!w.MathJax || (w.MathJax.startup?.promise?.then(() => true) ?? false)); } catch { return false; } })()`;
async function present(t, platform, n) {
  const page = await load(t, platform, n);
  await press(page, 'Mod+Enter');
  await page.waitFor(showReady, 20000);
  await sleep(300);
  return page;
}

// finding r12-9-show 1: the show played by Present stayed at the closing slide at every key forward
for (const platform of PLATFORMS) {
  test(`the show played by Present returns to the editor at a move forward past its last slide (${platform})`, async (t) => {
    for (const key of ['ArrowRight', 'Enter', 'Space', 'PageDown', 'n']) {
      const page = await present(t, platform, 11);
      assert.equal(await page.evaluate(`${SHOW}.Reveal.isLastSlide()`), true);
      await press(page, key);
      await page.waitFor(`!document.querySelector('.beeson-edit-show')`, 5000).catch(() => {});
      assert.equal(await page.evaluate(`!!document.querySelector('.beeson-edit-show')`), false, `${js(key)} at the last slide does not end the show`);
      assert.equal(await page.evaluate('Reveal.getIndices().h'), 11);
      await byteExact(page);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });

  test(`the show played by Present goes through the steps of its last slides before it ends (${platform})`, async (t) => {
    const page = await present(t, platform, 10);
    const steps = await page.evaluate(`${SHOW}.Reveal.availableFragments().next`);
    await press(page, 'ArrowRight');
    await sleep(200);
    if (steps) assert.equal(await page.evaluate(`${SHOW}.Reveal.getIndices().h`), 10, 'a step of slide 11 is skipped');
    for (let i = 0; i < 10 && (await page.evaluate(`${SHOW}.Reveal.getIndices().h`)) < 11; i++) {
      await press(page, 'ArrowRight');
      await sleep(200);
    }
    assert.equal(await page.evaluate(`${SHOW}.Reveal.getIndices().h`), 11);
    assert.equal(await page.evaluate(`!!document.querySelector('.beeson-edit-show')`), true, 'the show ends at the arrival on its last slide');
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('.beeson-edit-show')`);
    assert.deepEqual(errors(page), []);
  });
}

// a deck opened by itself keeps the keys of reveal.js at its last slide
test('a deck opened by itself stays at its last slide at a key forward', async (t) => {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/index.html?still#/11`);
  await page.waitFor(deckSettled);
  for (const key of ['ArrowRight', 'Space', 'Enter']) await press(page, key);
  await sleep(300);
  assert.equal(await page.evaluate('Reveal.getIndices().h'), 11);
  assert.equal(await page.evaluate('location.search'), '?still');
  assert.deepEqual(errors(page), []);
});

// the presenter display of the editor, opened by Alt+Return
const DISPLAY = 'dialog.beeson-edit-presenter[open]';
async function display(t, platform, n) {
  const page = await load(t, platform, n);
  await page.evaluate(`(() => { window.open = () => null; return true; })()`);
  await press(page, 'Alt+Enter');
  await page.waitFor(`!!document.querySelector(${js(DISPLAY)})`, 20000);
  await sleep(300);
  return page;
}
const slideOf = (page) => page.evaluate(`(() => { const m = document.querySelector(${js(DISPLAY)}).textContent.match(/Slide (\\d+) of/); return m ? Number(m[1]) : null; })()`);

// finding r12-9-show 2: a number typed in the presenter display was kept after other keys, and a
// number out of range was read differently by the two shows
for (const platform of PLATFORMS) {
  test(`the presenter display drops a typed number at another key, and a number out of range goes to the first or the last slide (${platform})`, async (t) => {
    const page = await display(t, platform, 5);
    assert.equal(await slideOf(page), 6);
    for (const key of ['2', 'ArrowLeft', 'Enter']) await press(page, key);
    await sleep(200);
    assert.equal(await slideOf(page), 6, 'the number is kept after another key');
    for (const key of ['9', '9', 'Enter']) await press(page, key);
    await sleep(200);
    assert.equal(await slideOf(page), 12, '99 and Return do not go to the last slide');
    for (const key of ['0', 'Enter']) await press(page, key);
    await sleep(200);
    assert.equal(await slideOf(page), 1, '0 and Return do not go to the first slide');
    assert.deepEqual(errors(page), []);
  });

  test(`the show played by Present goes to the first or the last slide for a number out of range (${platform})`, async (t) => {
    const page = await present(t, platform, 5);
    for (const key of ['9', '9', 'Enter']) await press(page, key);
    await sleep(300);
    assert.equal(await page.evaluate(`${SHOW}.Reveal.getIndices().h`), 11);
    for (const key of ['0', 'Enter']) await press(page, key);
    await sleep(300);
    assert.equal(await page.evaluate(`${SHOW}.Reveal.getIndices().h`), 0);
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('.beeson-edit-show')`);
    assert.deepEqual(errors(page), []);
  });
}

// the center on the screen of the first shown element matched by selector
const centerOf = (page, selector) => page.evaluate(`(() => { const r = [...Reveal.getCurrentSlide().querySelectorAll(${js(selector)})].map((e) => e.getBoundingClientRect()).find((r) => r.width); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rotorShown = (page) => page.evaluate(`(() => { const g = document.querySelector('.beeson-rotor'); return !!g && getComputedStyle(g).display !== 'none' && g.getBoundingClientRect().width > 0; })()`);

// finding r12-5-select-arrange 2: in a selection of a group and another element, the rotate handle
// was missing, and a typed Angle turned each member of the group about its own center
for (const platform of PLATFORMS) {
  test(`a group in a selection of several elements is turned as one object about its center (${platform})`, async (t) => {
    const page = await load(t, platform, 4);
    await selectFigure(page, 'img.for-light');
    await click(page, '.reveal section.present > p', { modifiers: 'Shift' });
    await exec(page, 'arrange.group');
    await click(page, '.reveal section.present > h2', { modifiers: 'Shift' });
    await frames(page);
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 3);
    assert.equal(await rotorShown(page), true, 'the selection does not have a rotate handle');
    const grouped = await render(page);
    const before = { p: await centerOf(page, 'p'), img: await centerOf(page, 'img.for-light'), h2: await centerOf(page, 'h2') };
    await page.evaluate(`window.BeesonEditor.exec('arrange.setRotation', { deg: 20 })`);
    await frames(page);
    const now = { p: await centerOf(page, 'p'), img: await centerOf(page, 'img.for-light'), h2: await centerOf(page, 'h2') };
    assert.ok(Math.abs(gap(now.p, now.img) - gap(before.p, before.img)) < 2, 'the members of the group are moved apart');
    assert.ok(gap(now.p, before.p) > 20, 'the group is not turned about its center');
    assert.ok(gap(now.h2, before.h2) < 2, 'the heading is not turned about its own center');
    // the line from the paragraph to the picture is turned by 20 degrees
    const angle = (a, b) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    assert.ok(Math.abs(angle(now.p, now.img) - angle(before.p, before.img) - 20) < 1.5, 'the group is not turned by the angle');
    const turned = await render(page);
    assert.match(turned, /<h2 style="rotate: 20deg">/);
    await page.evaluate('window.BeesonEditor.undo()');
    assert.equal(await render(page), grouped);
    await page.evaluate('window.BeesonEditor.redo()');
    assert.equal(await render(page), turned);
    await saveAndReopen(page);
    assert.deepEqual(errors(page), []);
  });
}
