// regression tests of R9.9 on both platforms with trusted input: the mode, Invert, and Decorative
// of an image of a pair for the two modes, a picture added beside a filled zone, a video held still
// while the deck is edited, Distribute Evenly, the selection after a drop onto a picture and after
// an undo and a redo of an insert, the Size note of a locked figure, the drag of a file that is not
// a picture, and Undo with the focus on a control of the inspector. after each edit the text is
// checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
const FIGURE = 4;
const VIDEO = 10;

const DARK = '<img class="for-dark" src="demo/figure-dark.png" alt="Zero-velocity curves of the Earth–Moon system, dark version">';
const LIGHT = '<img class="for-light" src="demo/figure-light.png" alt="Zero-velocity curves of the Earth–Moon system, light version">';

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
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const selection = (page) => page.evaluate(`window.BeesonEditor.selection().map((e) => e.localName + (e.className ? '.' + [...e.classList].join('.') : ''))`);
let saves = 0;

// the editor on the slide n of the demo deck served over HTTP, in a window of 1600 by 1000 px,
// with the Format tab of the inspector shown
async function load(t, platform, { n = 0, mode = 'light', query = 'edit&still' } = {}) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.send('Page.setInterceptFileChooserDialog', { enabled: true });
  const url = `${server.origin}/index.html?${query}&theme=${mode}&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('index.html', 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  if (n) await page.evaluate(`Reveal.slide(${n})`);
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
  const { text } = await saveAndReopen(page, `r9-9-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

const setMode = async (page, mode) => {
  await page.evaluate(`document.documentElement.dataset.theme = ${js(mode)}`);
  await frames(page);
};

// the files and filters of the shown images of the figure of the current slide, and whether they
// and the caption are drawn inside the slide
const SHOWN = `(() => {
  const slide = document.querySelector('.reveal:not(.beeson-peek) .slides > section.present');
  const s = slide.getBoundingClientRect();
  const cap = slide.querySelector('figcaption')?.getBoundingClientRect();
  const imgs = [...slide.querySelectorAll('figure img')].filter((i) => i.getBoundingClientRect().width > 0);
  return { n: imgs.length, files: imgs.map((i) => i.getAttribute('src')), filters: imgs.map((i) => getComputedStyle(i).filter), inside: imgs.every((i) => i.getBoundingClientRect().bottom <= s.bottom + 1) && (!cap || cap.bottom <= s.bottom + 1) };
})()`;

// shownIn asserts that the figure shows one image in each mode, inside the slide, with the file
// given for the mode, and turns the slide back to the light mode
async function shownIn(page, files) {
  for (const mode of ['light', 'dark']) {
    await setMode(page, mode);
    const s = await page.evaluate(SHOWN);
    assert.equal(s.n, 1, `the ${mode} mode shows ${s.n} images`);
    assert.ok(s.inside, `the figure runs below the slide in the ${mode} mode`);
    assert.equal(s.files[0], files[mode], `the ${mode} mode shows ${s.files[0]}`);
  }
  await setMode(page, 'light');
}

// a trusted click on the button or the checkbox of the Format tab whose text starts with text
async function tap(page, text) {
  const at = await page.evaluate(`(() => {
    const el = [...document.querySelectorAll('${PANEL} button, ${PANEL} label.ed-check')].find((b) => b.textContent.trim() === ${js(text)} || b.textContent.trim().startsWith(${js(text)} + ','));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(at, `the inspector does not have a control ${text}`);
  await click(page, at);
  await sleep(150);
  await frames(page);
}

const shownImage = `.reveal:not(.beeson-peek) .slides > section.present figure img`;
async function selectPicture(page) {
  const at = await page.evaluate(`(() => { const r = [...document.querySelectorAll(${js(shownImage)})].map((i) => i.getBoundingClientRect()).find((r) => r.width); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await click(page, at);
  await frames(page);
}

for (const platform of PLATFORMS) {
  test(`${platform}: Shown in on an image of a pair keeps one image in each mode, and a choice back gives the first file`, async (t) => {
    const page = await load(t, platform, { n: FIGURE });
    const files = { dark: 'demo/figure-dark.png', light: 'demo/figure-light.png' };
    await selectPicture(page);
    assert.deepEqual(await selection(page), ['img.for-light']);

    // Both keeps the light image alone, shown in both modes
    await tap(page, 'Both');
    await byteExact(page, [[`${DARK}\n    ${LIGHT}`, LIGHT.replace(' class="for-light"', '')]]);
    await shownIn(page, { dark: files.light, light: files.light });
    assert.equal((await state(page, 'figure.mode.both')).checked, true);
    // and Light gives the pair back
    await tap(page, 'Light');
    await byteExact(page);
    await shownIn(page, files);
    await tap(page, 'Both');
    await roundTrip(page);

    // Dark on the light image of a pair swaps the two, and Dark on the image shown then swaps back
    const page2 = await load(t, platform, { n: FIGURE });
    await selectPicture(page2);
    await tap(page2, 'Dark');
    await byteExact(page2, [[DARK, DARK.replace('for-dark', 'for-light')], [LIGHT, LIGHT.replace('for-light', 'for-dark')]]);
    await shownIn(page2, { dark: files.light, light: files.dark });
    assert.deepEqual(await selection(page2), ['img.for-light'], 'the image shown after the swap is not selected');
    await roundTrip(page2);
    await selectPicture(page2);
    await tap(page2, 'Dark');
    await byteExact(page2, [[DARK.replace('for-dark', 'for-light'), DARK], [LIGHT.replace('for-light', 'for-dark'), LIGHT]]);
    await shownIn(page2, files);
  });
}
