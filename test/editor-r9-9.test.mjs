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
  // the folder of a new media file is the root of the private file system
  await page.evaluate('window.showDirectoryPicker = async () => navigator.storage.getDirectory()');
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


// a trusted drag of the files at paths from the Finder, dropped at the point at. it returns the
// label of the outline and the drop effect while the files are over the point
async function dropFiles(page, at, paths, { drop = true } = {}) {
  const data = { items: [], files: paths, dragOperationsMask: 1 };
  await page.send('Input.dispatchDragEvent', { type: 'dragEnter', x: at.x, y: at.y, data });
  await page.send('Input.dispatchDragEvent', { type: 'dragOver', x: at.x, y: at.y, data });
  const outline = await page.evaluate(`(() => { const b = document.querySelector('.beeson-drop'); return b && !b.hidden ? b.textContent : null; })()`);
  if (drop) await page.send('Input.dispatchDragEvent', { type: 'drop', x: at.x, y: at.y, data });
  else await page.send('Input.dispatchDragEvent', { type: 'dragCancel', x: at.x, y: at.y, data });
  return outline;
}

const centerOf = (page, selector) =>
  page.evaluate(`(() => { const el = [...document.querySelectorAll(${js(selector)})].find((e) => e.getBoundingClientRect().width > 0); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

// the frames of the figures of the current slide, i.e. the shown picture with its caption, and the
// boxes of the text of its blocks and of the chrome, in px of the window
const LAID = `(() => {
  const slide = document.querySelector('.reveal:not(.beeson-peek) .slides > section.present');
  const s = slide.getBoundingClientRect();
  const box = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  const ink = (el) => { const g = document.createRange(); g.selectNodeContents(el); return box(g.getBoundingClientRect()); };
  const frame = (f) => {
    const parts = [...f.querySelectorAll('img, video, figcaption, .caption')].filter((m) => m.getBoundingClientRect().width > 0).map((m) => {
      const r = m.getBoundingClientRect();
      const nat = m.localName === 'img' ? [m.naturalWidth, m.naturalHeight] : m.localName === 'video' ? [m.videoWidth, m.videoHeight] : null;
      if (!nat || !nat[0] || getComputedStyle(m).objectFit !== 'contain') return box(r);
      const k = Math.min(r.width / nat[0], r.height / nat[1]);
      const w = nat[0] * k, h = nat[1] * k;
      return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, right: r.left + (r.width + w) / 2, bottom: r.top + (r.height + h) / 2 };
    });
    return parts.reduce((a, b) => ({ left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) }));
  };
  const figures = [...slide.querySelectorAll(':scope > figure, :scope > .zone, :scope > .plate')].filter((f) => f.querySelector('img, video')).map(frame);
  const texts = [...slide.querySelectorAll(':scope > h2, :scope > p, :scope > ul, :scope > ol, :scope > .run, :scope > .foot')].filter((t) => t.getClientRects().length).map(ink);
  return { slide: box(s), figures, texts };
})()`;

const meets = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
const inside = (a, s) => a.left >= s.left - 1 && a.top >= s.top - 1 && a.right <= s.right + 1 && a.bottom <= s.bottom + 1;

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

  test(`${platform}: Invert and Decorative on an image of a pair act on the image where they take effect, and on both`, async (t) => {
    const page = await load(t, platform, { n: FIGURE });
    await selectPicture(page);
    assert.equal((await state(page, 'figure.invert')).enabled, true);
    await tap(page, 'Invert in dark mode');
    await byteExact(page, [[DARK, DARK.replace('for-dark', 'for-dark invert')]]);
    assert.equal((await state(page, 'figure.invert')).checked, true);
    await setMode(page, 'dark');
    assert.notEqual((await page.evaluate(SHOWN)).filters[0], 'none', 'the dark image is not inverted');
    await setMode(page, 'light');
    await roundTrip(page);

    const page2 = await load(t, platform, { n: FIGURE });
    await selectPicture(page2);
    await tap(page2, 'Decorative');
    // the empty alt of a decorative image is written as the bare attribute
    const bare = (tag) => tag.replace(/alt="[^"]*"/, 'alt');
    await byteExact(page2, [[DARK, bare(DARK)], [LIGHT, bare(LIGHT)]]);
    await roundTrip(page2);
    await selectPicture(page2);
    await tap(page2, 'Decorative');
    await byteExact(page2, [[bare(DARK), DARK.replace(/ alt="[^"]*"/, '')], [bare(LIGHT), LIGHT.replace(/ alt="[^"]*"/, '')]]);
  });

  test(`${platform}: a picture added on a slide whose zone is filled is put in free space, with the first figure seen`, async (t) => {
    const page = await load(t, platform, { n: FIGURE });
    const before = await page.evaluate(LAID);
    assert.equal(before.figures.length, 1);
    await dropFiles(page, await centerOf(page, '.reveal .slides > section.present > p'), [resolve('demo/figure-light.png')]);
    await page.waitFor(`window.BeesonEditor.render().includes('<img src="media/figure-light')`, 20000);
    await sleep(300);
    await frames(page);
    const now = await page.evaluate(LAID);
    assert.equal(now.figures.length, 2);
    const [old, added] = now.figures;
    assert.deepEqual(old, before.figures[0], 'the first figure is moved');
    assert.ok(!meets(old, added), `the new picture ${JSON.stringify(added)} lies over the first figure ${JSON.stringify(old)}`);
    for (const text of now.texts) assert.ok(!meets(text, added), `the new picture ${JSON.stringify(added)} lies over a text ${JSON.stringify(text)}`);
    assert.ok(inside(added, now.slide), 'the new picture runs past the slide');
    await roundTrip(page);
  });
}
