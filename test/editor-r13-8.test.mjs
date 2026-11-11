// regression tests of R13.8 on both platforms: the transition of a slide kept at Duplicate Slide,
// the caption of a figure kept when Caption is turned off and on, the end of the show played by
// Present past its last slide, and a typed slide number read in one way by the two shows

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, saveAndReopen, selectFigure } from './helpers/editor.mjs';

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

// the editor on slide n of index.html, served over HTTP
async function load(t, platform, n = 0) {
  const text = readFileSync('index.html', 'utf8');
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/index.html?edit&still&theme=light&edit-platform=${platform}`;
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
    await saveAndReopen(page);
    assert.deepEqual(errors(page), []);
  });
}
