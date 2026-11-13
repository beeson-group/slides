// regression tests of R20.13 on both platforms, the open items O7, O5, and O9 and the new defects
// N1 and N2 of the review of round 7: Slide Layout from Figure to Content with a paper image, the
// Format pane closed by hand in a narrow window, and the toolbar and the status bar in a window
// 560 px wide

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press } from './helpers/editor.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test-deck.html';
// the index of the slide of index.html with the figures
const FIGURES = 4;
const LAYOUTS = 'test/pages/editor-layouts.html';
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const PAPER = [...readFileSync(LAYOUTS, 'utf8').matchAll(/<section[\s\S]*?<\/section>/g)].findIndex((m) => m[0].includes('A figure slide with a paper image'));

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
const wait = (page, ms = 150) => page.evaluate(`new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), ${ms}))`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const exec = (page, id) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)})).then(() => true)`);
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const urlOf = (deck, platform) => `${server.origin}/${deck}?edit&still&theme=light&edit-platform=${platform}`;

// opens deck at its url with the storage of the browser as it is, and shows slide n
async function open(page, deck, platform, n, text = readFileSync(deck, 'utf8')) {
  await page.goto(urlOf(deck, platform));
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = text;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(text)})`);
  assert.deepEqual(s.problems, []);
  if (n !== undefined) await page.evaluate(`Reveal.slide(${n})`);
  await wait(page, 300);
}

async function load(t, platform, deck, n, size = { width: 1600, height: 1000 }) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await open(page, deck, platform, n);
  return page;
}

async function resize(page, width, height) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await wait(page, 400);
}

// the boxes of the drawn picture of the image, of the caption, and of the words of the caption and
// of the heading of the slide shown, in slide px. a picture with object-fit contain is drawn
// smaller than the box of its img
const boxes = (page) => page.evaluate(`(() => {
  const slide = Reveal.getCurrentSlide();
  const s = slide.getBoundingClientRect();
  const k = s.width / slide.offsetWidth;
  const px = (r) => ({ left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k });
  const words = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
  const img = slide.querySelector('img');
  const r = img.getBoundingClientRect();
  const cs = getComputedStyle(img);
  const contain = cs.objectFit === 'contain';
  const sc = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
  const w = contain ? img.naturalWidth * sc : r.width, h = contain ? img.naturalHeight * sc : r.height;
  const [ox, oy] = cs.objectPosition.split(' ').map((v) => parseFloat(v) / 100);
  const drawn = { left: r.left + (r.width - w) * ox, top: r.top + (r.height - h) * oy, right: r.left + (r.width - w) * ox + w, bottom: r.top + (r.height - h) * oy + h };
  return { drawn: px(drawn), caption: px(slide.querySelector('.caption').getBoundingClientRect()), captionWords: px(words(slide.querySelector('.caption'))), heading: px(words(slide.querySelector('h2'))) };
})()`);

const inside = (b) => b.left >= -1 && b.top >= -1 && b.right <= 1921 && b.bottom <= 1081;
const apart = (a, b) => a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1;

for (const platform of PLATFORMS) {
  // O7: the drawn image and the caption of the figure slide stay inside the slide as Content
  test(`Slide Layout from Figure to Content keeps the paper image and its caption inside the slide (${platform})`, async (t) => {
    const page = await load(t, platform, LAYOUTS, PAPER);
    await page.evaluate(`document.querySelector('img.paper').decode().then(() => true)`);
    await exec(page, 'slide.layout.content');
    await wait(page, 400);
    const b = await boxes(page);
    assert.ok(inside(b.drawn), `the drawn image runs past the slide: ${js(b.drawn)}`);
    assert.ok(inside(b.caption), `the caption runs past the slide: ${js(b.caption)}`);
    assert.ok(apart(b.drawn, b.captionWords) && apart(b.drawn, b.heading), `the image covers the words: ${js(b)}`);
    assert.doesNotMatch(await page.evaluate(`document.querySelector('.beeson-edit-menubar .state, .beeson-edit-header .state')?.textContent ?? ''`), /past the slide/);
    const text = await render(page);
    assert.deepEqual(textProblems(text, THEME), textProblems(page.source, THEME));
    await undo(page);
    assert.equal(await render(page), page.source);
    await redo(page);
    assert.equal(await render(page), text);
    assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(text)})`)).problems, []);
    await page.evaluate(`Reveal.slide(${PAPER})`);
    await wait(page, 300);
    assert.ok(inside((await boxes(page)).drawn), 'the drawn image runs past the slide after a reopen');
    assert.deepEqual(errors(page), []);
  });
}

// whether the navigator and the inspector are drawn, whether Format is checked, and the stored state
// of the inspector
const panes = (page) => page.evaluate(`(() => {
  const drawn = (s) => (document.querySelector(s)?.getBoundingClientRect().width ?? 0) > 0;
  return { nav: drawn('.beeson-edit-nav'), inspector: drawn('.beeson-edit-inspector'), format: window.BeesonEditor.state('shell.format').checked, stored: localStorage.getItem('beeson-inspector') };
})()`);

for (const platform of PLATFORMS) {
  // O5 and N1: at 760 px the window is too narrow for both panes, and the navigator is drawn in
  // the room of a Format pane closed by hand, which must not be taken as a pane that gave way to it
  test(`a Format pane closed by hand at 760 px stays closed after a widen and after a reopen (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, FIGURES, { width: 760, height: 700 });
    assert.deepEqual(await panes(page), { nav: false, inspector: true, format: true, stored: '1' });
    await click(page, '.beeson-edit-top [data-command="shell.format"]');
    await wait(page, 300);
    assert.deepEqual(await panes(page), { nav: true, inspector: false, format: false, stored: '0' }, 'Format closed by hand is stored as open');
    await resize(page, 1600, 1000);
    assert.deepEqual(await panes(page), { nav: true, inspector: false, format: false, stored: '0' }, 'Format closed by hand is opened again by a widen');
    await resize(page, 760, 700);
    await open(page, DECK, platform, FIGURES);
    assert.deepEqual(await panes(page), { nav: true, inspector: false, format: false, stored: '0' }, 'Format closed by hand is opened again by a reopen');
    await resize(page, 1600, 1000);
    assert.deepEqual(await panes(page), { nav: true, inspector: false, format: false, stored: '0' }, 'Format closed by hand is opened again by a widen after a reopen');
    assert.deepEqual(errors(page).filter((e) => !e.includes('beforeunload')), []);
  });
}

// the buttons of the toolbar and of the status bar that are cut off by the window or by their bar,
// and the scroll width of the body, in a window of 560 px
const cutOff = (page) => page.evaluate(`(() => {
  const W = innerWidth;
  const cut = [];
  for (const bar of document.querySelectorAll('.beeson-edit-top, .beeson-edit-bottom')) {
    const br = bar.getBoundingClientRect();
    for (const b of bar.querySelectorAll('button')) {
      const r = b.getBoundingClientRect();
      if (!r.width || getComputedStyle(b).visibility === 'hidden') continue;
      const label = b.querySelector('.label');
      const clipped = r.left < Math.max(0, br.left) - 0.5 || r.right > Math.min(W, br.right) + 0.5;
      const truncated = label && label.scrollWidth > label.clientWidth + 0.5;
      if (clipped || truncated) cut.push((b.dataset.command ?? b.className) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    }
  }
  return { cut, scroll: document.body.scrollWidth, width: W };
})()`);

// a choice of the Show menu of the Customize Toolbar sheet
async function show(page, name) {
  await click(page, '.beeson-edit-customize button.show');
  await wait(page, 300);
  const at = await page.evaluate(`(() => { const e = [...document.querySelectorAll('.beeson-edit-menu [role^=menuitem]')].find((x) => x.textContent.includes(${js(name)})); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  assert.ok(at, `the Show menu does not have ${name}`);
  await click(page, at);
  await wait(page, 400);
}

for (const platform of PLATFORMS) {
  // O9 and N2: every button of the two bars is drawn whole in a window 560 px wide, and the page is
  // not wider than the window, with and without Customize Toolbar open
  test(`the toolbar and the status bar fit a window of 560 px, with and without Customize Toolbar (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, FIGURES, { width: 560, height: 700 });
    const fits = async (when) => {
      const m = await cutOff(page);
      assert.deepEqual(m.cut, [], `a button is cut off ${when}`);
      assert.ok(m.scroll <= m.width, `the body is ${m.scroll} px wide in a window of ${m.width} px ${when}`);
    };
    await fits('with the sheet closed');
    await page.evaluate(`window.BeesonEditor.exec('view.customizeToolbar')`);
    await wait(page, 400);
    await fits('with the sheet open');
    for (const name of ['Text Only', 'Icon Only', 'Icon and Text']) {
      await show(page, name);
      await fits(`with the sheet open and ${name}`);
    }
    await press(page, 'Escape');
    await wait(page, 300);
    await fits('after the sheet is closed with Icon and Text');
    assert.deepEqual(errors(page), []);
  });
}
