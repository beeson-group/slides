// regression tests of R9.9 on both platforms with trusted input: the mode, Invert, and Decorative
// of an image of a pair for the two modes, a picture added beside a filled zone, a video held still
// while the deck is edited, Distribute Evenly, the selection after a drop onto a picture and after
// an undo and a redo of an insert, the Size note of a locked figure, the drag of a file that is not
// a picture, and Undo with the focus on a control of the inspector. after each edit the text is
// checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

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

const menuItems = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu')].at(-1) ? [...[...document.querySelectorAll('.beeson-edit-menu')].at(-1).querySelectorAll('.item')].filter((i) => i.getClientRects().length).map((i) => i.textContent.trim().replace(/\\s+/g, ' ')) : []`);

const itemAt = (page, label) => page.evaluate(`(() => {
  const item = [...document.querySelectorAll('.beeson-edit-menu .item')].filter((i) => i.getClientRects().length).find((i) => i.textContent.trim().startsWith(${js(label)}));
  if (!item) return null;
  const r = item.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);

// the submenu of the menu bar at the path, e.g. Arrange, Distribute, opened with trusted input
async function openSubmenu(page, bar, label) {
  await click(page, await page.evaluate(`(() => {
    const r = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)}).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`));
  await page.waitFor(`!!document.querySelector('.beeson-edit-menu .item')`, 3000);
  const at = await itemAt(page, label);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
  await page.waitFor(`document.querySelectorAll('.beeson-edit-menu').length > 1`, 3000);
}

// every element of the current slide selected with the key of Select All on the canvas
async function selectAll(page) {
  const at = await page.evaluate(`(() => { const r = document.querySelector('.reveal .slides > section.present').getBoundingClientRect(); return { x: r.right - 20, y: r.bottom - 60 }; })()`);
  await click(page, at);
  await press(page, 'Mod+A');
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

  test(`${platform}: a video is held still on the canvas while the deck is edited`, async (t) => {
    for (const mode of ['light', 'dark']) {
      const page = await load(t, platform, { n: VIDEO, mode, query: 'edit' });
      const VIDEOS = `[...document.querySelectorAll('.reveal:not(.beeson-peek) .slides > section.present video')].filter((v) => v.getBoundingClientRect().width > 0).map((v) => ({ paused: v.paused, time: v.currentTime }))`;
      await sleep(400);
      const a = await page.evaluate(VIDEOS);
      await sleep(800);
      const b = await page.evaluate(VIDEOS);
      assert.equal(a.length, 1);
      assert.deepEqual(b, a, `the video plays on the canvas in the ${mode} mode`);
      assert.equal(b[0].paused, true);
      // and after the slide is shown again
      await page.evaluate(`Reveal.slide(${VIDEO - 1})`);
      await page.evaluate(`Reveal.slide(${VIDEO})`);
      await sleep(800);
      assert.equal((await page.evaluate(VIDEOS))[0].paused, true, 'the video plays once its slide is shown again');
      await page.close();
    }
  });

  test(`${platform}: Distribute Evenly follows Vertically in the menu and the pane, and spaces the selection both ways as one entry`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await selectAll(page);
    assert.ok((await selection(page)).length >= 3, 'the elements of the slide are not selected');
    // both ways, from a second page with the two commands of the axes
    const page2 = await load(t, platform, { n: 2 });
    await selectAll(page2);
    await exec(page2, 'arrange.distribute.horizontal');
    await exec(page2, 'arrange.distribute.vertical');
    const both = await render(page2);
    assert.notEqual(both, page2.source);
    await page2.close();

    await openSubmenu(page, 'Arrange', 'Distribute');
    const items = (await menuItems(page)).map((i) => i.replace(/\s*[⌘⌥⇧^].*$|\s*(Ctrl|Alt)\+.*$/, ''));
    assert.deepEqual(items.slice(-3), ['Distribute Horizontally', 'Distribute Vertically', 'Distribute Evenly']);
    await click(page, await itemAt(page, 'Distribute Evenly'));
    await frames(page);
    assert.equal(await render(page), both);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Distribute Evenly');
    // with several text blocks selected, the Text pane is shown first since R10.2
    await page.evaluate(`[...document.querySelectorAll('${PANEL} [role=tab]')].find((t) => t.textContent === 'Arrange')?.click()`);
    await frames(page);
    const buttons = await page.evaluate(`[...document.querySelectorAll('${PANEL} button')].map((b) => b.textContent.trim())`);
    assert.deepEqual(buttons.filter((b) => ['Horizontally', 'Vertically', 'Evenly'].includes(b)), ['Horizontally', 'Vertically', 'Evenly']);
    await roundTrip(page);
  });
}

// the files at paths given to the file chooser of the command id, as a person picks them
async function choose(page, id, paths) {
  await page.evaluate(`window.__done = window.BeesonEditor.exec(${js(id)}).then(() => true); 0`);
  await page.waitFor(`!!document.querySelector('input.beeson-media-input')`);
  const { result } = await page.send('Runtime.evaluate', { expression: `document.querySelector('input.beeson-media-input')` });
  await page.send('DOM.setFileInputFiles', { files: paths, objectId: result.objectId });
  await page.waitFor('window.__done', 20000);
  await frames(page);
}

// redoSelects asserts that the selection after an undo and a redo of the last entry is the one
// after the entry, with an element in it
async function redoSelects(page, what) {
  const made = await selection(page);
  assert.ok(made.length, `nothing is selected after ${what}`);
  await page.evaluate('window.BeesonEditor.undo()');
  await frames(page);
  await page.evaluate('window.BeesonEditor.redo()');
  await frames(page);
  assert.deepEqual(await selection(page), made, `the redo of ${what} does not select its element`);
}

for (const platform of PLATFORMS) {
  test(`${platform}: a picture replaced by a drop is selected, and a redo of an insert or a replace selects its element`, async (t) => {
    const page = await load(t, platform, { n: FIGURE });
    assert.deepEqual(await selection(page), []);
    assert.equal(await dropFiles(page, await centerOf(page, shownImage), [resolve('demo/figure-dark.png')]), 'Replace Image');
    await page.waitFor(`window.BeesonEditor.render().includes('src="media/figure-dark')`, 20000);
    await frames(page);
    assert.deepEqual(await selection(page), ['img.for-light'], 'the picture replaced by the drop is not selected');
    await redoSelects(page, 'Replace Image');
    // a picture replaced by a video
    await choose(page, 'media.replace', [resolve('demo/clip-light.mp4')]);
    await redoSelects(page, 'Replace Image with a video');
    await roundTrip(page, 2);

    const page2 = await load(t, platform, { n: 5 });
    await exec(page2, 'insert.qr');
    await frames(page2);
    await redoSelects(page2, 'Insert QR Code');
    // a new table gets the caret in its first cell, and its redo selects it, as in Keynote
    await exec(page2, 'insert.table', { rows: 2, columns: 2 });
    await frames(page2);
    assert.equal(await page2.evaluate(`(() => { const n = getSelection().anchorNode; return (n?.nodeType === 1 ? n : n?.parentElement)?.closest('td, th')?.cellIndex; })()`), 0);
    await page2.evaluate('window.BeesonEditor.undo()');
    await page2.evaluate('window.BeesonEditor.redo()');
    await frames(page2);
    assert.deepEqual(await selection(page2), ['table'], 'the redo of Insert Table does not select its table');
    await choose(page2, 'insert.image', [resolve('demo/figure-light.png')]);
    await redoSelects(page2, 'Insert Image');
    await roundTrip(page2, 3);
  });
}

for (const platform of PLATFORMS) {
  test(`${platform}: a redo of Insert Line selects the line drawn`, async (t) => {
    const page = await load(t, platform, { n: 5 });
    await exec(page, 'insert.line');
    const at = await page.evaluate(`(() => { const r = document.querySelector('.reveal .slides > section.present').getBoundingClientRect(); return { x: r.left + r.width * 0.3, y: r.top + r.height * 0.85 }; })()`);
    await drag(page, at, { dx: 200, dy: 0 });
    await frames(page);
    await redoSelects(page, 'Insert Line');
    await roundTrip(page);
  });

  // a box written with a key, then left with Esc, which selects it. its first input is an entry
  // over the insert of the box, as in Keynote, and a redo of it puts the caret back into the text
  for (const [id, what] of [['insert.text', 'Insert Text Box'], ['insert.code', 'Insert Code Box']]) {
    test(`${platform}: a redo of the first input of ${what} puts the caret into the box`, async (t) => {
      const page = await load(t, platform, { n: 5 });
      await exec(page, id);
      await frames(page);
      await type(page, 'Hi');
      await sleep(200);
      await press(page, 'Escape');
      await frames(page);
      assert.equal((await state(page, 'edit.undo')).label, 'Undo Typing');
      await page.evaluate('window.BeesonEditor.undo()');
      await frames(page);
      assert.equal((await state(page, 'edit.undo')).label, `Undo ${what}`);
      await page.evaluate('window.BeesonEditor.redo()');
      await frames(page);
      const caret = `(() => { const n = getSelection().anchorNode; const e = n?.nodeType === 1 ? n : n?.parentElement; return e?.closest('p, pre')?.textContent ?? null; })()`;
      assert.equal(await page.evaluate(caret), 'Hi', `the redo of the first input of ${what} does not put the caret into the box`);
      await roundTrip(page, 2);
    });
  }
}

const NOTE = 'Only the width is written';
const notes = (page) => page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-note')].filter((n) => !n.hidden).map((n) => n.textContent)`);
// a text file of the Finder, dragged where a picture would be
const NOTE_FILE = join(mkdtempSync(join(tmpdir(), 'r9-9-')), 'note.txt');
writeFileSync(NOTE_FILE, 'a note, not a picture\n');

for (const platform of PLATFORMS) {
  test(`${platform}: the Size section of a locked figure does not have the note on the width`, async (t) => {
    const page = await load(t, platform, { n: FIGURE });
    await click(page, await centerOf(page, shownImage));
    await frames(page);
    assert.deepEqual(await selection(page), ['figure.zone.beeson-movable']);
    await tap(page, 'Arrange');
    assert.ok(!(await notes(page)).some((n) => n.startsWith(NOTE)), 'the note is shown on the figure before the lock');
    await press(page, 'Mod+L');
    await frames(page);
    assert.equal((await state(page, 'arrange.unlock')).enabled, true, 'the figure is not locked');
    assert.ok(!(await notes(page)).some((n) => n.startsWith(NOTE)), 'the note is shown on the locked figure');
    await press(page, platform === 'mac' ? 'Mod+Alt+L' : 'Mod+Shift+L');
    await frames(page);
    assert.ok(!(await notes(page)).some((n) => n.startsWith(NOTE)), 'the note is shown after the unlock');
  });

  test(`${platform}: a file that is not a picture is not offered a drop, and a picture still is`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    const at = await centerOf(page, '.reveal .slides > section.present > p');
    assert.equal(await dropFiles(page, at, [NOTE_FILE], { drop: false }), null, 'the slide is outlined for a text file');
    assert.equal(await dropFiles(page, at, [resolve('demo/figure-light.png')], { drop: false }), 'Add Image');
    assert.equal(await render(page), page.source);
  });
}

const shownVideo = `.reveal:not(.beeson-peek) .slides > section.present video`;
const focused = (page) => page.evaluate(`(() => { const a = document.activeElement; return a ? a.localName + (a.type ? '.' + a.type : '') : null; })()`);
const rectOf = (page, selector) => page.evaluate(`(() => { const el = [...document.querySelectorAll(${js(selector)})].find((e) => e.getBoundingClientRect().width > 0); if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);

// the video of the current slide selected by itself, with its pane in the Format tab
async function selectVideo(page) {
  const at = await centerOf(page, shownVideo);
  await click(page, at);
  await click(page, at);
  await frames(page);
  assert.deepEqual((await selection(page)).map((s) => s.split('.')[0]), ['video']);
  await page.waitFor(`!!document.querySelector('${PANEL} input[name=poster-frame]:not([disabled])')`, 10000);
}

// undoRedoKeys asserts that the keys of Undo and Redo, with the focus left on the control,
// take the deck back to before and forward to edited
async function undoRedoKeys(page, platform, before, edited, control) {
  assert.equal(await focused(page), control, `the focus is not on the ${control}`);
  await press(page, 'Mod+Z');
  await page.waitFor(`window.BeesonEditor.render() === ${js(before)}`, 5000).catch(() => {});
  assert.equal(await render(page), before, `Undo does nothing with the focus on the ${control}`);
  await press(page, platform === 'mac' ? 'Mod+Shift+Z' : 'Mod+Y');
  await page.waitFor(`window.BeesonEditor.render() === ${js(edited)}`, 5000).catch(() => {});
  assert.equal(await render(page), edited, `Redo does nothing with the focus on the ${control}`);
}
for (const platform of PLATFORMS) {
  test(`${platform}: Undo and Redo act on the deck with the focus on a slider or a checkbox of the inspector, and not in a text field`, async (t) => {
    const page = await load(t, platform, { n: VIDEO });
    await selectVideo(page);
    // a click on the Poster Frame slider, which captures the frame as the poster
    const before = await render(page);
    const r = await rectOf(page, `${PANEL} input[name=poster-frame]`);
    await click(page, { x: r.left + r.width * 0.6, y: r.top + r.height / 2 });
    await page.waitFor(`window.BeesonEditor.render() !== ${js(before)}`, 20000);
    const poster = await render(page);
    await undoRedoKeys(page, platform, before, poster, 'input.range');

    // the Loop checkbox of the pane, reached with Tab and checked with Space, since a click keeps
    // the focus where it is
    const onLoop = `document.activeElement?.closest('label.ed-check')?.textContent.trim() === 'Loop'`;
    for (let i = 0; i < 8 && !(await page.evaluate(onLoop)); i++) await press(page, 'Tab');
    assert.ok(await page.evaluate(onLoop), 'Tab does not reach the Loop checkbox');
    await press(page, 'Space');
    await frames(page);
    const looped = await render(page);
    assert.notEqual(looped, poster, 'Loop does not change the file');
    await undoRedoKeys(page, platform, poster, looped, 'input.checkbox');

    // Undo in a text field of the inspector is the undo of its typing, and not of the deck
    await tap(page, 'Arrange');
    const x = await rectOf(page, `${PANEL} input[name=X]:not([disabled])`);
    await click(page, { x: x.left + x.width / 2, y: x.top + x.height / 2 });
    assert.equal(await focused(page), 'input.text');
    await type(page, '9');
    await press(page, 'Mod+Z');
    await frames(page);
    assert.equal(await render(page), looped, 'Undo in a text field undoes the deck');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Loop');
  });
}

// the box of the new element of the current slide in px of the window, and the boxes of the texts
// and the chrome it lies over: a heading, a paragraph, a list, a code box, a formula, a caption,
// the running head, the footnote line, and the slide number
const OVER = `((el) => {
  const slide = document.querySelector('.reveal:not(.beeson-peek) .slides > section.present');
  const box = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  const ink = (t) => { const g = document.createRange(); g.selectNodeContents(t); const r = g.getBoundingClientRect(); return box(r.width ? r : t.getBoundingClientRect()); };
  const me = box(el.getBoundingClientRect());
  const meets = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const texts = [...slide.querySelectorAll('h1, h2, p, ul, ol, pre, table, div.math, figcaption, .run, .foot'), document.querySelector('.reveal .slide-number')]
    .filter((t) => t && t !== el && !el.contains(t) && !t.contains(el) && t.getClientRects().length && !t.closest('aside.notes, ul, ol, table') || t === el);
  const over = texts.filter((t) => t !== el && meets(me, t.matches('.run, .foot, .slide-number') ? box(t.getBoundingClientRect()) : ink(t)))
    .map((t) => t.localName + (t.classList.length ? '.' + [...t.classList].filter((c) => !c.startsWith('beeson')).join('.') : ''));
  const s = slide.getBoundingClientRect();
  return { me, over, inside: me.left >= s.left - 1 && me.top >= s.top - 1 && me.right <= s.right + 1 && me.bottom <= s.bottom + 1 };
})`;
const NEW = {
  text: `document.querySelector('.beeson-pending')`,
  code: `document.querySelector('.beeson-pending')`,
  formula: `window.BeesonEditor.selection()[0]`,
  qr: `window.BeesonEditor.selection()[0]`,
};

// the deck at path served over HTTP with the editor, and its slides with the kinds of new element
// whose place is checked on each
const PLACES = [
  ['test/pages/editor-layouts.html', [2, 3, 4, 5, 6, 8], ['text', 'code', 'formula', 'qr']],
  ['test/pages/editor-empty-zone.html', [0, 1, 2], ['text', 'code', 'formula', 'qr']],
  ['index.html', [2, 3, 4], ['text', 'formula', 'qr']],
];

for (const platform of PLATFORMS) {
  test(`${platform}: a new text box, code box, formula, or QR code is put in free space of each layout, off the texts and the chrome`, async (t) => {
    for (const [path, slides, kinds] of PLACES) {
      const page = await browser.newPage({ width: 1600, height: 1000 });
      t.after(() => page.close().catch(() => {}));
      const url = `${server.origin}/${path}?edit&still&theme=light&edit-platform=${platform}`;
      await page.goto(url);
      await page.evaluate('localStorage.clear()');
      await page.goto(url);
      await page.waitFor(deckSettled);
      await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
      const source = readFileSync(path, 'utf8');
      assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(source)})`)).problems, []);
      for (const n of slides) {
        for (const kind of kinds) {
          await page.evaluate(`Reveal.slide(${n})`);
          await frames(page);
          await exec(page, `insert.${kind}`);
          await sleep(300);
          await frames(page);
          const m = await page.evaluate(`${OVER}(${NEW[kind]})`);
          const where = `${kind} on the slide ${n} of ${path} at ${JSON.stringify(m.me)}`;
          assert.deepEqual(m.over, [], `the new ${where} lies over a text or the chrome`);
          assert.ok(m.inside, `the new ${where} runs past the slide`);
          // the new element is taken back
          await press(page, 'Escape');
          await frames(page);
          if ((await render(page)) !== source) await page.evaluate('window.BeesonEditor.undo()');
          assert.equal(await render(page), source, `the new ${kind} is not taken back`);
        }
      }
      await page.close();
    }
  });
}

// the selected video, the Play button of its pane, and the Poster Frame slider beside it
const PLAYED = `(() => {
  const v = window.BeesonEditor.selection()[0];
  const slider = document.querySelector('${PANEL} input[name=poster-frame]');
  const play = slider?.parentElement.querySelector('button.ed-play');
  return { paused: v.paused, time: v.currentTime, slider: Number(slider?.value), label: play?.getAttribute('aria-label') ?? null, before: !!play && !!(play.compareDocumentPosition(slider) & Node.DOCUMENT_POSITION_FOLLOWING) };
})()`;
const playAt = (page) => page.evaluate(`(() => { const r = document.querySelector('${PANEL} button.ed-play').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

for (const platform of PLATFORMS) {
  test(`${platform}: Play in the Video pane plays the video in place from the frame of the slider, as a preview that stops on a change of the selection or the slide`, async (t) => {
    const page = await load(t, platform, { n: VIDEO, query: 'edit' });
    await selectVideo(page);
    // the frame at half of the video, captured as the poster
    const r = await rectOf(page, `${PANEL} input[name=poster-frame]`);
    await click(page, { x: r.left + r.width * 0.5, y: r.top + r.height / 2 });
    await page.waitFor(`window.BeesonEditor.render() !== ${js(page.source)}`, 20000);
    const edited = await render(page);
    const undo = (await state(page, 'edit.undo')).label;
    const from = (await page.evaluate(PLAYED)).slider;
    let s = await page.evaluate(PLAYED);
    assert.equal(s.label, 'Play', 'the Video pane does not have a Play button');
    assert.ok(s.before, 'the Play button is not beside the slider');

    await click(page, await playAt(page));
    await sleep(900);
    s = await page.evaluate(PLAYED);
    assert.equal(s.paused, false, 'the video does not play');
    assert.equal(s.label, 'Pause');
    assert.ok(s.time > from && s.time < from + 2, `the video plays from ${s.time} and not from the frame ${from} of the slider`);
    assert.ok(Math.abs(s.slider - s.time) < 0.5, `the slider at ${s.slider} does not follow the video at ${s.time}`);
    // Pause pauses it, and the preview is not an edit
    await click(page, await playAt(page));
    await frames(page);
    s = await page.evaluate(PLAYED);
    assert.equal(s.paused, true, 'Pause does not pause the video');
    assert.equal(s.label, 'Play');
    assert.equal(await render(page), edited, 'the preview changes the file');
    assert.equal((await state(page, 'edit.undo')).label, undo, 'the preview is an entry of the history');

    // a change of the slide, and of the selection, stops the preview
    await click(page, await playAt(page));
    await sleep(300);
    const video = `[...document.querySelectorAll(${js(shownVideo)})].find((v) => v.getBoundingClientRect().width > 0)`;
    await page.evaluate(`window.__played = ${video}`);
    assert.equal(await page.evaluate('window.__played.paused'), false);
    await page.evaluate(`Reveal.slide(${VIDEO - 1})`);
    await sleep(300);
    assert.equal(await page.evaluate('window.__played.paused'), true, 'the video plays on after a change of the slide');
    await page.evaluate(`Reveal.slide(${VIDEO})`);
    await frames(page);
    await selectVideo(page);
    await click(page, await playAt(page));
    await sleep(300);
    assert.equal(await page.evaluate('window.__played.paused'), false);
    await click(page, await page.evaluate(`(() => { const r = document.querySelector('.reveal .slides > section.present').getBoundingClientRect(); return { x: r.left + 40, y: r.bottom - 60 }; })()`));
    await sleep(300);
    assert.deepEqual(await selection(page), []);
    assert.equal(await page.evaluate('window.__played.paused'), true, 'the video plays on after a change of the selection');
    assert.equal(await render(page), edited);
    assert.deepEqual(errors(page), []);
  });
}

// the tag of the outline of a drop, and the buttons of the placeholder drawn under it
const TAGGED = `(() => {
  const tag = document.querySelector('.beeson-drop:not([hidden]) span')?.getBoundingClientRect();
  const shown = [...document.querySelectorAll('.reveal section.present .beeson-placeholder button')].filter((b) => getComputedStyle(b).visibility === 'visible' && b.getBoundingClientRect().width > 0);
  const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  return { tag: !!tag, buttons: shown.length, under: tag ? shown.filter((b) => meets(tag, b.getBoundingClientRect())).map((b) => b.getAttribute('aria-label')) : [] };
})()`;

for (const platform of PLATFORMS) {
  test(`${platform}: the tag of a file dragged over an empty zone is not drawn over the buttons of its placeholder`, async (t) => {
    const path = 'test/pages/editor-empty-zone.html';
    const page = await browser.newPage({ width: 1600, height: 1000 });
    t.after(() => page.close().catch(() => {}));
    await page.goto(`${server.origin}/${path}?edit&still&theme=light&edit-platform=${platform}`);
    await page.waitFor(deckSettled);
    await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
    assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(readFileSync(path, 'utf8'))})`)).problems, []);
    await page.evaluate('Reveal.slide(1)');
    await frames(page);
    assert.equal((await page.evaluate(TAGGED)).buttons, 4);
    const at = await centerOf(page, '.reveal section.present .zone');
    const data = { items: [], files: [resolve('demo/figure-light.png')], dragOperationsMask: 1 };
    await page.send('Input.dispatchDragEvent', { type: 'dragEnter', x: at.x, y: at.y, data });
    await page.send('Input.dispatchDragEvent', { type: 'dragOver', x: at.x, y: at.y, data });
    await frames(page);
    const over = await page.evaluate(TAGGED);
    assert.ok(over.tag, 'the zone is not outlined');
    assert.deepEqual(over.under, [], 'the tag is drawn over buttons of the placeholder');
    await page.send('Input.dispatchDragEvent', { type: 'dragCancel', x: at.x, y: at.y, data });
    // the leave of the window, as the browser sends it at the end of the drag
    await page.evaluate(`(() => { const d = new DataTransfer(); d.items.add(new File(['x'], 'a.png', { type: 'image/png' })); window.dispatchEvent(new DragEvent('dragleave', { dataTransfer: d })); })()`);
    await frames(page);
    assert.equal((await page.evaluate(TAGGED)).buttons, 4, 'the buttons are not drawn again after the drag');
  });
}
