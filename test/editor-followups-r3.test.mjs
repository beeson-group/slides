// the follow-ups of round 3 of the editor on both platforms: a QR code inserted on a full slide,
// the pasteboard of a zoomed canvas and Zoom to Selection, an image pasted from the clipboard, files
// dropped onto the navigator, the order of the keyboard sheet, the mark of a transition in the
// navigator, Delete of a locked element, the group of a copy, the highlights of a duplicated
// slide, and the Formula button in a text. each edit is checked byte for byte, after an undo and a
// redo, and after a save and an open of the saved text

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, center, click, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const IMAGE = resolve('demo/figure-light.png');
const IMAGE_BYTES = readFileSync(IMAGE).length;
const PNG = [137, 80, 78, 71, 13, 10, 26, 10];

// five paragraphs on the clipboard of the editor, which fill the text column of a content slide down
// to its foot
const PARAGRAPHS = ['<!--beeson-->', ...Array.from({ length: 5 }, (_, i) => `<p>Paragraph ${i + 1} of a column that is filled to the foot of the slide.</p>`)].join('\n');

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

const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg !== undefined ? `, ${JSON.stringify(arg)}` : ''})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const status = (page) => page.evaluate('window.BeesonEditor.status()');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

// CLEAR empties the storage of the origin: the drafts, their media files, and the private file
// system
const CLEAR = `(async () => {
  localStorage.clear();
  await new Promise((done) => { const r = indexedDB.deleteDatabase('beeson-media'); r.onsuccess = r.onerror = r.onblocked = () => done(); });
  const root = await navigator.storage.getDirectory();
  for await (const name of root.keys()) await root.removeEntry(name, { recursive: true });
  return true;
})()`;

// the editor on a deck served over HTTP, opened with text, or with the file of the deck, and with
// slide n shown
async function load(t, platform, { deck = LAYOUTS, text, n = 0, size } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate(CLEAR);
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = text ?? readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// an undo gives the text before byte for byte, and a redo gives the edited text again
async function undoRedo(page, before, edited) {
  await undo(page);
  await sleep(100);
  assert.equal(await render(page), before);
  await redo(page);
  await sleep(100);
  assert.equal(await render(page), edited);
}

let saves = 0;
async function savedAs(page, edited) {
  const { text } = await saveAndReopen(page, `followups-${++saves}.html`);
  assert.equal(text, edited);
}

// the box in slide px of the first shown element that matches selector
const slideBox = (page, selector) =>
  page.evaluate(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getBoundingClientRect().width > 0);
    if (!el) return null;
    const s = document.querySelector('.reveal .slides');
    const k = s.getBoundingClientRect().width / s.offsetWidth;
    const o = s.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { left: (r.left - o.left) / k, top: (r.top - o.top) / k, right: (r.right - o.left) / k, bottom: (r.bottom - o.top) / k };
  })()`);

for (const platform of PLATFORMS) {
  test(`a QR code inserted on a full wide slide is centered on it, inside its edges (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'slide.new.wide');
    await frames(page);
    await press(page, 'Escape');
    await press(page, 'Escape');
    await exec(page, 'edit.paste', PARAGRAPHS);
    await frames(page);
    const full = await render(page);
    assert.equal(full.split('<p>Paragraph ').length, 6);
    await exec(page, 'insert.qr');
    await frames(page);
    const box = await slideBox(page, '.reveal section.present .qr');
    assert.ok(box, 'the QR code is not on the slide');
    assert.ok(box.top >= 0 && box.bottom <= 1080, `the QR code runs past the slide: ${JSON.stringify(box)}`);
    assert.ok(Math.abs((box.left + box.right) / 2 - 960) < 2 && Math.abs((box.top + box.bottom) / 2 - 540) < 2, `the QR code is not centered: ${JSON.stringify(box)}`);
    const edited = await render(page);
    assert.match(edited, /<p>Paragraph 5 [^\n]*<\/p>\n  <div class="qr" data-qr="https:\/\/example.com" style="translate: -?\d+px -?\d+px"><\/div>\n/);
    await undoRedo(page, full, edited);
    await savedAs(page, edited);
    assert.deepEqual(errors(page), []);
  });

  test(`a QR code inserted on a slide with room is put after the last block of the column (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 4 });
    await exec(page, 'insert.qr');
    await frames(page);
    const edited = await render(page);
    assert.match(edited, /<p>A paragraph in a column.<\/p>\n  <\/div>\n  <div class="qr" data-qr="https:\/\/example.com"><\/div>\n/);
    const box = await slideBox(page, '.reveal section.present .qr');
    assert.ok(box.bottom <= 1080, JSON.stringify(box));
    await undoRedo(page, page.source, edited);
  });
}

// the pasteboard around the slide, measured at the start and at the end of the scroll of the canvas
const pasteboard = (page) =>
  page.evaluate(`(async () => {
    const s = window.BeesonEditorShell.stage;
    const at = async (x, y) => {
      s.el.scrollLeft = x;
      s.el.scrollTop = y;
      await new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)));
      const v = s.viewport;
      const r = document.querySelector('.reveal .slides').getBoundingClientRect();
      return { left: r.left - v.left, top: r.top - v.top, right: v.right - r.right, bottom: v.bottom - r.bottom };
    };
    const start = await at(0, 0);
    const end = await at(1e7, 1e7);
    return { left: start.left, top: start.top, right: end.right, bottom: end.bottom };
  })()`);

for (const platform of PLATFORMS) {
  test(`the pasteboard is equal on every side of the slide at each zoom past Fit (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: 'index.html', size: { width: 1600, height: 1000 } });
    for (const z of [1, 2, 3]) {
      await page.evaluate(`window.BeesonEditorShell.stage.setZoom(${z})`);
      await frames(page);
      const p = await pasteboard(page);
      for (const side of ['left', 'top', 'right', 'bottom']) assert.ok(Math.abs(p[side] - 32) < 1, `at ${z * 100} percent: ${JSON.stringify(p)}`);
    }
    assert.deepEqual(errors(page), []);
  });

  test(`Zoom to Selection centers a figure at the edge of the slide, with the pasteboard grown (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: 'index.html', size: { width: 1600, height: 1000 } });
    await page.evaluate(`Reveal.slide(Reveal.getIndices(document.querySelector('.reveal .slides section .zone > img').closest('section')).h)`);
    await frames(page);
    const fig = '.reveal section.present .zone > img';
    await click(page, fig);
    await exec(page, 'zoom.selection');
    await frames(page);
    const r = await page.evaluate(`(() => { const v = window.BeesonEditorShell.stage.viewport; const i = [...document.querySelectorAll(${JSON.stringify(fig)})].map((e) => e.getBoundingClientRect()).find((b) => b.width); return { cx: i.left + i.width / 2 - (v.left + v.width / 2), cy: i.top + i.height / 2 - (v.top + v.height / 2) }; })()`);
    assert.ok(Math.abs(r.cx) < 2 && Math.abs(r.cy) < 2, `the figure is off the center of the canvas by ${JSON.stringify(r)}`);
    const p = await pasteboard(page);
    assert.ok(Math.abs(p.left - p.right) < 1 && Math.abs(p.top - p.bottom) < 1 && Math.abs(p.left - p.top) < 1 && p.left > 32, JSON.stringify(p));
    // a later zoom gives the pasteboard its margin of 32 px again
    await page.evaluate('window.BeesonEditorShell.stage.setZoom(2)');
    await frames(page);
    const q = await pasteboard(page);
    assert.ok(Math.abs(q.left - 32) < 1 && Math.abs(q.right - 32) < 1, JSON.stringify(q));
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}

// PASTE_IMAGE sends a paste of an image file to the focused element, as a screenshot or an image
// copied in another app is pasted, with a DataTransfer of its own, since the system clipboard is
// shared with other tests
const PASTE_IMAGE = `(async () => {
  const bytes = await (await fetch('/demo/figure-light.png')).arrayBuffer();
  const data = new DataTransfer();
  data.items.add(new File([bytes], 'image.png', { type: 'image/png' }));
  const ev = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
  (document.activeElement ?? document.body).dispatchEvent(ev);
  return ev.defaultPrevented;
})()`;

// SAVE_INTO saves into a folder of the private file system, and returns the saved text and the
// files of its media/
const SAVE_INTO = (folder) => `(async () => {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle(${JSON.stringify(folder)}, { create: true });
  const deck = await dir.getFileHandle('deck.html', { create: true });
  window.showDirectoryPicker = async () => dir;
  window.BeesonEditor.attach(deck);
  await window.BeesonEditor.save();
  const files = {};
  try {
    const media = await dir.getDirectoryHandle('media');
    for await (const [name, h] of media.entries()) {
      const f = await h.getFile();
      files[name] = { size: f.size, head: [...new Uint8Array(await f.slice(0, 8).arrayBuffer())] };
    }
  } catch {}
  return { text: await (await deck.getFile()).text(), files };
})()`;

const SPLIT_ZONE = '<div class="zone"></div>';
const waitText = (page, text) => page.waitFor(`window.BeesonEditor.render().includes(${JSON.stringify(text)})`, 30000);

for (const platform of PLATFORMS) {
  test(`an image pasted from the clipboard fills an empty zone and is written into media/ at the save (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'slide.new.split');
    await frames(page);
    const before = await render(page);
    // two presses of Esc take the caret out of the new slide, to the canvas
    await press(page, 'Escape');
    await press(page, 'Escape');
    assert.equal(await page.evaluate(PASTE_IMAGE), true, 'the paste is left to the browser');
    await waitText(page, 'media/image.png');
    const edited = await render(page);
    assert.equal(edited, before.replace(SPLIT_ZONE, '<div class="zone">\n    <img src="media/image.png">\n  </div>'));
    assert.match(await page.evaluate(`document.querySelector('.reveal section.present > .zone > img').getAttribute('src')`), /^blob:/);
    assert.equal((await status(page)).undo, true);
    await undoRedo(page, before, edited);
    const saved = await page.evaluate(SAVE_INTO(`paste-${platform}`));
    assert.equal(saved.text, edited);
    assert.deepEqual(Object.keys(saved.files), ['image.png']);
    assert.equal(saved.files['image.png'].size, IMAGE_BYTES);
    assert.deepEqual(saved.files['image.png'].head, PNG);
    assert.deepEqual(errors(page), []);
  });

  test(`an image pasted into a text is put on the slide, and not into the text (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await click(page, '.reveal section.present > h2');
    await press(page, 'End');
    assert.equal(await page.evaluate(PASTE_IMAGE), true);
    await waitText(page, 'media/image.png');
    const edited = await render(page);
    assert.ok(edited.includes('<h2>Text, a list, and a backdrop</h2>'), 'the heading was changed');
    assert.match(edited, /<figure class="zone">\n {4}<img src="media\/image.png">\n {2}<\/figure>/);
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal section.present h2 img').length`), 0);
    await undoRedo(page, page.source, edited);
    assert.deepEqual(errors(page), []);
  });
}

// the center of row i of the navigator, in the order of the slides
const rowCenter = (page, i) =>
  page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-edit-nav .row')][${i}].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const sectionsOf = (text) => text.split('<section').length - 1;

for (const platform of PLATFORMS) {
  test(`files dropped onto the navigator make a figure slide after the slide under the drop (${platform})`, async (t) => {
    const page = await load(t, platform);
    const at = await rowCenter(page, 2);
    const data = { items: [], files: [IMAGE], dragOperationsMask: 1 };
    await page.send('Input.dispatchDragEvent', { type: 'dragEnter', x: at.x, y: at.y, data });
    await page.send('Input.dispatchDragEvent', { type: 'dragOver', x: at.x, y: at.y, data });
    const line = await page.evaluate(`(() => { const d = document.querySelector('.beeson-edit-nav .drop'); if (d.hidden) return null; const rows = [...document.querySelectorAll('.beeson-edit-nav .row')].map((r) => r.getBoundingClientRect()); const y = d.getBoundingClientRect().top; return { y, after2: rows[2].bottom, before3: rows[3].top }; })()`);
    assert.ok(line, 'the line of the drop is not shown');
    assert.ok(line.y >= line.after2 - 4 && line.y <= line.before3 + 4, JSON.stringify(line));
    await page.send('Input.dispatchDragEvent', { type: 'drop', x: at.x, y: at.y, data });
    await waitText(page, 'media/figure-light.png');
    await frames(page);
    const edited = await render(page);
    assert.equal(sectionsOf(edited), sectionsOf(page.source) + 1);
    // the text before the first slide, then the slides
    const slides = edited.split(/\n(?=<section)/).slice(1);
    assert.match(slides[3], /^<section class="figure">\n {2}<div class="plate">\n {4}<img src="media\/figure-light.png">\n {2}<\/div>\n {2}<h2><\/h2>\n {2}<p class="caption"><\/p>\n<\/section>/);
    assert.equal(await page.evaluate('Reveal.getIndices().h'), 3);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-nav .drop').hidden`), true);
    await undoRedo(page, page.source, edited);
    await undo(page);
    assert.equal((await status(page)).undo, false, 'the drop is more than one entry of the history');
    await redo(page);
    const saved = await page.evaluate(SAVE_INTO(`nav-drop-${platform}`));
    assert.equal(saved.text, edited);
    assert.deepEqual(Object.keys(saved.files), ['figure-light.png']);
    assert.deepEqual(errors(page), []);
  });
}

for (const platform of PLATFORMS) {
  test(`the groups of the keyboard sheet are in the order of the menu bar (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'help.keys');
    const { heads, menus } = await page.evaluate(`({
      heads: [...document.querySelectorAll('.beeson-edit-keys h3')].map((h) => h.textContent),
      menus: [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].map((m) => m.textContent.trim()),
    })`);
    assert.ok(heads.includes('Play'), JSON.stringify(heads));
    const known = heads.filter((h) => menus.includes(h));
    assert.deepEqual(known, menus.filter((m) => known.includes(m)));
    assert.deepEqual(heads.slice(0, known.length), known, 'a group outside the menu bar is listed before a menu');
  });
}

// the indices of the slides whose rows carry the mark of a transition
const marked = (page) =>
  page.evaluate(`[...document.querySelectorAll('.beeson-edit-nav .row')].map((r, i) => { const m = r.querySelector('.trans'); return m && !m.hidden && m.getBoundingClientRect().width > 0 ? i : -1; }).filter((i) => i >= 0)`);

for (const platform of PLATFORMS) {
  test(`a slide with a transition carries a mark on its thumbnail (${platform})`, async (t) => {
    const page = await load(t, platform);
    const magic = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.hasAttribute('data-auto-animate'))`);
    assert.deepEqual(await marked(page), [magic]);
    assert.match(await page.evaluate(`document.querySelectorAll('.beeson-edit-nav .row')[${magic}].getAttribute('aria-label')`), /, with the transition Magic Move/);
    // None on the slide of Magic Move takes the mark off, and the default Fade of the theme is not
    // marked
    await page.evaluate(`Reveal.slide(${magic})`);
    await frames(page);
    await exec(page, 'slide.transition.none');
    await frames(page);
    assert.deepEqual(await marked(page), []);
    await undo(page);
    await frames(page);
    assert.deepEqual(await marked(page), [magic]);
    assert.equal(await render(page), page.source);
  });
}

const DELETE = { mac: 'Backspace', other: 'Delete' };
const TITLE_QR = '<div class="qr" data-qr="https://github.com/beeson-group/slides"></div>';
// the shown elements of the selection: each framed by itself, or the members of a group in its
// one frame
const shownFrames = (page) => page.evaluate(`(() => {
  const frames = [...document.querySelectorAll('.beeson-frame.selected')].filter((f) => !f.hidden && f.getBoundingClientRect().width).length;
  const group = [...document.querySelectorAll('.beeson-frame.union.group')].some((f) => !f.hidden);
  return group ? window.BeesonEditor.selection().filter((e) => e.getBoundingClientRect().width).length : frames;
})()`);

for (const platform of PLATFORMS) {
  test(`Delete skips a locked element, and deletes nothing when every selected element is locked (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, '.reveal section.present > .qr');
    await exec(page, 'arrange.lock');
    const locked = page.source.replace(TITLE_QR, '<div class="qr" data-qr="https://github.com/beeson-group/slides" data-locked></div>');
    assert.equal(await render(page), locked);
    const label = (await status(page)).undoLabel ?? null;
    // with the locked QR code alone selected, Delete does nothing and adds no entry
    await press(page, DELETE[platform]);
    await frames(page);
    assert.equal(await render(page), locked);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('element.delete').enabled`), false);
    assert.equal((await status(page)).undoLabel ?? null, label);
    // with the heading added, only the heading is deleted, and the QR code stays selected
    await click(page, '.reveal section.present h1', { modifiers: 'Shift' });
    assert.equal(await shownFrames(page), 2);
    await press(page, DELETE[platform]);
    await frames(page);
    const edited = await render(page);
    assert.ok(edited.includes('data-locked></div>'), 'the locked QR code was deleted');
    assert.ok(!edited.includes('<h1>Every layout</h1>'), 'the heading was not deleted');
    assert.equal(await shownFrames(page), 1);
    await undoRedo(page, locked, edited);
    assert.deepEqual(errors(page), []);
  });
}

const GROUP_KEY = { mac: 'Mod+Alt+G', other: 'Mod+G' };

for (const platform of PLATFORMS) {
  test(`a copy of a group made with Duplicate or a paste is a new group (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, '.reveal section.present h1', { modifiers: 'Shift' });
    await click(page, '.reveal section.present > .qr', { modifiers: 'Shift' });
    await press(page, GROUP_KEY[platform]);
    await frames(page);
    const grouped = await render(page);
    assert.equal(grouped.split('data-group="g1"').length - 1, 2);
    await press(page, 'Mod+D');
    await frames(page);
    const duplicated = await render(page);
    assert.equal(duplicated.split('data-group="g1"').length - 1, 2, 'the copies joined the group of their sources');
    assert.equal(duplicated.split('data-group="g2"').length - 1, 2, 'the copies are not one new group');
    await undoRedo(page, grouped, duplicated);
    // a copy and a paste of the group g1 makes a new group as well
    await undo(page);
    await frames(page);
    // a first click on a member selects the group, which a second click would leave for the member
    await exec(page, 'selection.clear');
    await click(page, '.reveal section.present > .qr');
    assert.equal(await shownFrames(page), 2);
    await exec(page, 'edit.copy');
    await exec(page, 'edit.paste');
    await frames(page);
    const pasted = await render(page);
    assert.equal(pasted.split('data-group="g1"').length - 1, 2, 'the pasted copies joined the group of their sources');
    assert.equal(pasted.split('data-group="g2"').length - 1, 2, 'the pasted copies are not one new group');
    await undoRedo(page, grouped, pasted);
    await savedAs(page, pasted);
    assert.deepEqual(errors(page), []);
  });
}

// whether each element of the class coriolis on the current slide is colored orange
const coriolis = (page) => page.evaluate(`[...document.querySelectorAll('.reveal section.present .coriolis')].map((el) => el.classList.contains('hl-accent'))`);

for (const platform of PLATFORMS) {
  test(`a duplicated slide keeps its highlights, also after a change of its layout (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 3 });
    const shown = await coriolis(page);
    assert.ok(shown.length >= 2 && shown.every(Boolean), `the source is not highlighted: ${JSON.stringify(shown)}`);
    await exec(page, 'slide.duplicate');
    await frames(page);
    assert.equal(await page.evaluate('Reveal.getIndices().h'), 4);
    assert.deepEqual(await coriolis(page), shown, 'the duplicate lost its highlights');
    assert.equal(await page.evaluate(`[...document.querySelectorAll('.reveal section.present .fragment')].every((f) => f.classList.contains('visible'))`), true);
    await exec(page, 'slide.layout.wide');
    await frames(page);
    assert.deepEqual(await coriolis(page), shown, 'the highlights were lost at the change of layout');
    await undo(page);
    await undo(page);
    await frames(page);
    assert.equal(await render(page), page.source);
    await redo(page);
    await frames(page);
    await page.evaluate('Reveal.slide(4)');
    await frames(page);
    assert.deepEqual(await coriolis(page), shown, 'the duplicate lost its highlights at a redo');
    assert.deepEqual(errors(page), []);
  });
}

// the slide of the equations of the demo deck, and the paragraph of its step 2
const EQUATIONS = 3;
const STEP2 = String.raw`<p class="fragment" data-fragment-index="2">where \(\tilde U\) is the effective potential.</p>`;
const STEP2_LIVE = `[...document.querySelectorAll('.reveal section.present p')].find((p) => p.textContent.startsWith('where'))`;

for (const platform of PLATFORMS) {
  test(`the Formula button inserts an inline formula at the caret of a text (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: 'index.html', n: EQUATIONS });
    const at = await page.evaluate(`(() => { const r = ${STEP2_LIVE}.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await click(page, at);
    await sleep(150);
    await press(page, 'End');
    const displays = await page.evaluate(`document.querySelectorAll('.reveal section.present div.math').length`);
    await click(page, await center(page, '.beeson-edit-top [data-command="insert.formula"]'));
    await sleep(200);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-math .title')?.textContent ?? null`), 'Insert Inline Formula');
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal section.present div.math').length`), displays, 'a display formula was inserted');
    await type(page, 'x');
    await sleep(300);
    await press(page, 'Mod+Enter');
    await sleep(500);
    await byteExact(page, [[STEP2, STEP2.replace('potential.</p>', String.raw`potential.\(x\)</p>`)]]);
    const edited = await render(page);
    await undoRedo(page, page.source, edited);
    // on the canvas, without a caret, the button inserts a display formula
    await press(page, 'Escape');
    await press(page, 'Escape');
    await click(page, await center(page, '.beeson-edit-top [data-command="insert.formula"]'));
    await sleep(300);
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal section.present div.math').length`), displays + 1);
    assert.deepEqual(errors(page), []);
  });
}

// the empty box of Text Box, Code Box, and Footnote, which is not written into the file
const PENDING = `document.querySelector('.reveal section.present .beeson-pending')`;
// a new box on a slide without room under its text is written with the offset that centers it
const unmoved = (text) => text.replace(/ style="translate: -?\d+px -?\d+px"/g, '');
const undoLabel = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)}).label`);
const INSERTS = [
  ['insert.text', 'Text Box', '<p>x</p>'],
  ['insert.code', 'Code Box', '<pre><code class="language-python">x</code></pre>'],
  ['insert.footnote', 'Footnote', '<div class="foot">x</div>'],
];

for (const platform of PLATFORMS) {
  for (const [id, label, html] of INSERTS) {
    test(`${label} is an entry of the history, and the deck is edited while its empty box is on the slide (${platform})`, async (t) => {
      const page = await load(t, platform, { deck: 'index.html', n: EQUATIONS });
      const clean = async () => {
        const s = await status(page);
        assert.equal(await page.evaluate(`!!${PENDING}`), false, 'the empty box is on the slide');
        assert.equal(s.undo, false);
        assert.equal(s.dirty, false);
        assert.match(s.message, /^No unsaved changes/);
        assert.equal(await render(page), page.source);
      };
      const boxed = async () => {
        const s = await status(page);
        assert.equal(await page.evaluate(`${PENDING} === document.activeElement`), true, 'the caret is not in the empty box');
        assert.equal(s.undo, true, 'Undo is disabled');
        assert.equal(await undoLabel(page, 'edit.undo'), `Undo ${label}`);
        assert.equal(s.dirty, true);
        assert.match(s.message, /^Unsaved changes/);
        assert.equal(await render(page), page.source, 'the empty box was written');
      };
      await exec(page, id);
      await frames(page);
      await boxed();
      await undo(page);
      await frames(page);
      await clean();
      assert.equal(await undoLabel(page, 'edit.redo'), `Redo ${label}`);
      await redo(page);
      await frames(page);
      await boxed();
      // the box is taken off when the caret leaves it, and so is its entry
      await press(page, 'Escape');
      await sleep(100);
      await clean();
      // the first input writes the box, and one undo takes it off with its text
      await exec(page, id);
      await frames(page);
      await type(page, 'x');
      await sleep(300);
      assert.ok(unmoved(await render(page)).includes(html), 'the box was not written');
      assert.equal(await undoLabel(page, 'edit.undo'), `Undo ${label}`);
      await undo(page);
      await sleep(100);
      assert.equal(await render(page), page.source);
      assert.equal(await page.evaluate(`!!${PENDING}`), false);
      assert.equal((await status(page)).undo, false, 'the insert is more than one entry of the history');
      await redo(page);
      await sleep(100);
      assert.ok(unmoved(await render(page)).includes(html));
      assert.deepEqual(errors(page), []);
    });
  }
}
