// regression tests of R13.8 on both platforms: the transition of a slide kept at Duplicate Slide,
// the caption of a figure kept when Caption is turned off and on, the end of the show played by
// Present past its last slide, and a typed slide number read in one way by the two shows

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, saveAndReopen, selectFigure } from './helpers/editor.mjs';

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
