// regression tests of the bugs in selection and in the menus that the photo editor of round 1
// found, each run on both platforms: the grips of a selected figure, the right-click on a word,
// Select All in a text, the menu items enabled for the selection, the zoom keys listed once, and
// the hovered thumbnail of the navigator

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const PLATFORMS = ['mac', 'other'];
const LAYOUTS = 'test/pages/editor-layouts.html';
const IMG = '.reveal section.present .zone > img';

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

// the errors of the page, without the missing icon of a deck served over HTTP
const errorsOf = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

let saves = 0;
const saved = () => saveAndReopen(last, `fixes-${++saves}.html`);
let last = null;

// the editor on deck, served over HTTP, where a save is written into the origin private file system
async function editor(platform, deck = 'index.html') {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.send('Page.bringToFront');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  return page;
}

// the slide of the first element matched by selector is shown
async function slideOf(page, selector) {
  await page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); Reveal.slide(Reveal.getIndices(el.closest('section')).h); })()`);
  await sleep(250);
}

// the box of the picture of the first shown image or video matched by selector, fitted in its box
// with object-fit contain, in CSS pixels of the viewport
const pictureOf = (page, selector) => page.evaluate(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getBoundingClientRect().width);
  const r = el.getBoundingClientRect();
  const [w, h] = el instanceof HTMLImageElement ? [el.naturalWidth, el.naturalHeight] : [el.videoWidth, el.videoHeight];
  if (!w || !h || getComputedStyle(el).objectFit !== 'contain') return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  const s = Math.min(r.width / w, r.height / h);
  const left = r.left + (r.width - w * s) / 2, top = r.top + (r.height - h * s) / 2;
  return { left, top, right: left + w * s, bottom: top + h * s };
})()`);

// the shown grips, each with its handle, its center, and whether it takes the pointer
const gripsOf = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-grip')].filter((g) => !g.hidden).map((g) => { const r = g.getBoundingClientRect(); return { handle: g.dataset.handle, x: r.left + r.width / 2, y: r.top + r.height / 2, live: getComputedStyle(g).pointerEvents !== 'none' }; })`);

for (const platform of PLATFORMS) {
  test(`${platform}: a figure selected with one click is resized by its grips at the corners of its picture`, async () => {
    const page = await editor(platform);
    await slideOf(page, '.reveal .slides .zone > img');
    await click(page, IMG);
    const grips = await gripsOf(page);
    assert.equal(grips.length, 8, 'a selected figure does not show eight grips');
    assert.ok(grips.every((g) => g.live), 'a grip of a selected figure cannot be dragged');
    const pic = await pictureOf(page, IMG);
    const se = grips.find((g) => g.handle === 'se');
    assert.ok(Math.abs(se.x - pic.right) < 2 && Math.abs(se.y - pic.bottom) < 2, `the grip se is at ${se.x}, ${se.y} and not at the corner ${pic.right}, ${pic.bottom} of the picture`);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-handle').hidden`), true, 'the handle of a block is drawn on a figure');

    await drag(page, { x: se.x, y: se.y }, { dx: -90, dy: -60, hold: true });
    const readout = await page.evaluate(`(() => { const r = document.querySelector('.beeson-offset'); return r.hidden ? null : r.textContent; })()`);
    assert.match(readout ?? '', /^\d+ × \d+$/, 'the size is not shown during the resize');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: se.x - 90, y: se.y - 60, button: 'left', clickCount: 1 });
    await sleep(50);

    const after = await page.evaluate('window.BeesonEditor.render()');
    const widths = [...after.matchAll(/<img class="for-(?:dark|light)"[^>]* style="width: (\d+)px"/g)].map((m) => Number(m[1]));
    assert.equal(widths.length, 2, 'the width is not written on both images of the pair');
    assert.equal(widths[0], widths[1], 'the images of the pair are given different widths');
    assert.ok(widths[0] > 300 && widths[0] < 560, `the width ${widths[0]} is not the dragged width`);
    const now = await pictureOf(page, IMG);
    const moved = await gripsOf(page);
    const corner = moved.find((g) => g.handle === 'se');
    assert.ok(Math.abs(corner.x - now.right) < 2 && Math.abs(corner.y - now.bottom) < 2, 'the grips do not follow the picture');
    const nw = moved.find((g) => g.handle === 'nw');
    assert.ok(Math.abs(nw.x - pic.left) < 3 && Math.abs(nw.y - pic.top) < 3, 'the corner across from the dragged grip is moved');

    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
    await page.evaluate('window.BeesonEditor.redo()');
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), after, 'a redo does not write the resize again');
    await saved();
    assert.deepEqual(errorsOf(page), []);
  });

  test(`${platform}: a figure without an image, a video, or a QR code is selected without grips`, async () => {
    const page = await editor(platform, LAYOUTS);
    await slideOf(page, '.reveal .slides .plot.plate');
    await click(page, '.reveal section.present .plot.plate');
    assert.equal(await page.evaluate(`[...document.querySelectorAll('.beeson-frame.selected')].filter((f) => !f.hidden).length`), 1, 'the plot is not selected');
    assert.deepEqual(await gripsOf(page), [], 'a figure that cannot be resized shows grips');
    // a paper image in a plate is resized from its first click too
    await slideOf(page, '.reveal .slides .plate > img.paper');
    await click(page, '.reveal section.present .plate > img.paper');
    const grips = await gripsOf(page);
    assert.equal(grips.filter((g) => g.live).length, 8, 'a plate with a paper image does not show live grips');
    const se = grips.find((g) => g.handle === 'se');
    await drag(page, { x: se.x, y: se.y }, { dx: -60, dy: -40 });
    assert.match(await page.evaluate('window.BeesonEditor.render()'), /<img class="paper"[^>]* style="width: \d+px"/, 'the paper image is not resized');
    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
    assert.deepEqual(errorsOf(page), []);
  });
}

// the center of word in the shown paragraph that holds it, and the box of the paragraph
const wordAt = (page, word) => page.evaluate(`(() => {
  const p = [...document.querySelectorAll('.reveal section.present p')].find((e) => e.textContent.includes(${JSON.stringify(word)}));
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const i = n.data.indexOf(${JSON.stringify(word)});
    if (i < 0) continue;
    const range = document.createRange();
    range.setStart(n, i);
    range.setEnd(n, i + ${word.length});
    const r = range.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, left: r.left, right: r.right };
  }
})()`);

// the text of the selection of the document, and whether it is collapsed
const selected = (page) => page.evaluate(`(() => { const s = getSelection(); return { text: s.toString(), collapsed: s.isCollapsed }; })()`);

// the label and the keys of each item of the open context menu, and whether it is enabled
const menuRows = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => ({ label: i.querySelector('.label')?.textContent ?? '', keys: i.querySelector('.keys')?.textContent ?? '', enabled: i.getAttribute('aria-disabled') !== 'true' }))`);

const CLIP = { mac: ['⌘X', '⌘C', '⌘V'], other: ['Ctrl+X', 'Ctrl+C', 'Ctrl+V'] };

for (const platform of PLATFORMS) {
  test(`${platform}: a right-click on a word offers Cut, Copy, and Paste, and on a Mac it selects the word`, async () => {
    const page = await editor(platform);
    await slideOf(page, '.reveal .slides p');
    await page.evaluate(`Reveal.slide([...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.textContent.includes('matplotlib figure')))`);
    await sleep(250);
    const word = await wordAt(page, 'matplotlib');
    // the caret is put into the word first, as in the photo of state 34
    await click(page, { x: word.left + 20, y: word.y });
    await sleep(50);
    await click(page, { x: word.left + 20, y: word.y }, { button: 'right' });
    await sleep(100);
    const sel = await selected(page);
    if (platform === 'mac') assert.equal(sel.text, 'matplotlib', 'a right-click on a word does not select the word');
    else assert.equal(sel.collapsed, true, 'a right-click on a word selects text outside a Mac');
    const rows = await menuRows(page);
    assert.deepEqual(rows.slice(0, 3).map((r) => r.label), ['Cut', 'Copy', 'Paste'], 'the text menu does not open with Cut, Copy, and Paste');
    assert.deepEqual(rows.slice(0, 3).map((r) => r.keys), CLIP[platform], 'Cut, Copy, and Paste are listed without their keys');
    if (platform === 'mac') assert.deepEqual(rows.slice(0, 2).map((r) => r.enabled), [true, true], 'Cut and Copy are disabled on a selected word');
    await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await sleep(50);

    // a right-click inside a selection of two words keeps the selection
    await page.evaluate(`(() => {
      const p = [...document.querySelectorAll('.reveal section.present p')].find((e) => e.textContent.includes('matplotlib'));
      const n = [...p.childNodes].find((c) => c.nodeType === 3 && c.data.includes('matplotlib figure'));
      const i = n.data.indexOf('matplotlib figure');
      p.focus();
      getSelection().setBaseAndExtent(n, i, n, i + 'matplotlib figure'.length);
    })()`);
    await sleep(50);
    await click(page, { x: word.left + 20, y: word.y }, { button: 'right' });
    await sleep(100);
    assert.equal((await selected(page)).text, 'matplotlib figure', 'a right-click inside a selection does not keep it');
    assert.deepEqual(errorsOf(page), []);
  });

  test(`${platform}: a right-click on a word of a paragraph that is not edited puts the text into editing`, async () => {
    const page = await editor(platform);
    await page.evaluate(`Reveal.slide([...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.textContent.includes('matplotlib figure')))`);
    await sleep(250);
    const word = await wordAt(page, 'matplotlib');
    await click(page, { x: word.x, y: word.y }, { button: 'right' });
    await sleep(100);
    const sel = await selected(page);
    assert.equal(await page.evaluate(`!!document.activeElement?.closest('.reveal section.present p')`), true, 'the paragraph is not put into editing');
    if (platform === 'mac') assert.equal(sel.text, 'matplotlib', 'a right-click on a word does not select the word');
    assert.deepEqual((await menuRows(page)).slice(0, 3).map((r) => r.label), ['Cut', 'Copy', 'Paste']);
    assert.deepEqual(errorsOf(page), []);
  });
}

// the rows of the menu of the menu bar named title, opened with a click on its title
async function barMenu(page, title) {
  await page.evaluate(`document.querySelectorAll('.beeson-edit-menus .beeson-edit-menu').length && document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  const at = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-menubar button')].find((x) => x.textContent === ${JSON.stringify(title)}); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await sleep(80);
  return menuRows(page);
}

// the matplotlib paragraph of the demo deck is shown, and the caret is put into its first word
async function caretInParagraph(page) {
  await page.evaluate(`Reveal.slide([...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.textContent.includes('matplotlib figure')))`);
  await sleep(250);
  const word = await wordAt(page, 'matplotlib');
  await click(page, { x: word.left + 20, y: word.y });
  await sleep(50);
  return word;
}

const shownSelected = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-frame.selected')].filter((f) => !f.hidden).length`);

for (const platform of PLATFORMS) {
  test(`${platform}: in a text, Select All selects the text of the block, and a second one every element of the slide`, async () => {
    const page = await editor(platform);
    await caretInParagraph(page);
    const rows = await barMenu(page, 'Edit');
    const all = rows.find((r) => r.label === 'Select All');
    assert.equal(all?.enabled, true, 'Select All is dimmed while the caret is in a paragraph');
    assert.equal(all.keys, platform === 'mac' ? '⌘A' : 'Ctrl+A');
    assert.deepEqual(['Cut', 'Copy', 'Paste'].map((l) => rows.find((r) => r.label === l)?.keys), CLIP[platform], 'Cut, Copy, and Paste are listed without their keys');
    await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await sleep(50);

    const text = await page.evaluate(`[...document.querySelectorAll('.reveal section.present p')].find((e) => e.textContent.includes('matplotlib')).textContent`);
    // the menu item selects the text of the block, as the first key press does
    await click(page, await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-menubar button')].find((x) => x.textContent === 'Edit'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
    await sleep(80);
    await click(page, await page.evaluate(`(() => { const i = [...document.querySelectorAll('.beeson-edit-menu .item')].find((x) => x.querySelector('.label')?.textContent === 'Select All'); const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
    await sleep(80);
    assert.equal((await selected(page)).text, text, 'Select All of the menu does not select the text of the block');
    assert.equal(await page.evaluate(`!!document.activeElement?.closest('.reveal section.present p')`), true, 'the text is left by the first Select All');

    await press(page, 'Mod+A');
    await sleep(80);
    assert.equal(await page.evaluate(`!!document.activeElement?.closest('.reveal section.present p')`), false, 'a second Select All does not leave the text');
    const count = await shownSelected(page);
    assert.ok(count >= 3, `a second Select All selects ${count} elements, not every element of the slide`);
    assert.deepEqual(errorsOf(page), []);
  });
}

// every menu of the menu bar with its submenus, as lines of the form 'Format > List' with the
// enabled state of each submenu and each command
const MENUS = ['File', 'Edit', 'Insert', 'Format', 'Arrange', 'Slide', 'View', 'Help'];
const survey = (page) => page.evaluate(`(() => {
  const S = window.BeesonEditorShell, E = window.BeesonEditor;
  const subs = {}, commands = {}, wrong = [];
  for (const bar of ${JSON.stringify(MENUS)}) {
    for (const item of S.menuItems(bar)) {
      if (item.command) commands[item.command] = E.state(item.command).enabled;
      if (!item.items) continue;
      const inner = (typeof item.items === 'function' ? item.items() : item.items).filter((i) => i.command).map((i) => ({ id: i.command, ...E.state(i.command) }));
      for (const i of inner) commands[i.id] = i.enabled;
      const plain = inner.filter((i) => i.checked === null);
      const expected = (plain.length ? plain : inner).some((i) => i.enabled);
      subs[bar + ' > ' + item.label] = !item.disabled;
      if (!item.disabled !== expected) wrong.push(bar + ' > ' + item.label + (expected ? ' is disabled' : ' is enabled'));
    }
  }
  return { subs, commands, wrong };
})()`);

const TEXT_SUBMENUS = ['Format > Baseline', 'Format > Text Color', 'Format > Paragraph Style', 'Format > List', 'Format > Change Case'];
const TEXT_COMMANDS = ['text.bold', 'text.italic', 'text.superscript', 'text.tone.accent', 'text.style.body', 'text.list.ul', 'text.case.upper', 'text.clear', 'text.link'];

for (const platform of PLATFORMS) {
  test(`${platform}: a menu item is enabled only where its command can run, with nothing, a caret, a figure, or two elements selected`, async () => {
    const page = await editor(platform);
    await page.evaluate(`Reveal.slide([...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('.zone > video') && s.querySelector(':scope > p')))`);
    await sleep(250);
    const off = (s, names) => names.filter((n) => n in s.subs || n in s.commands).filter((n) => s.subs[n] ?? s.commands[n]);

    const nothing = await survey(page);
    assert.deepEqual(nothing.wrong, [], 'with nothing selected, a submenu is enabled without an item that can run');
    assert.deepEqual(off(nothing, [...TEXT_SUBMENUS, ...TEXT_COMMANDS, 'Arrange > Align', 'Arrange > Distribute']), [], 'with nothing selected, a text or an arrange item is enabled');

    await click(page, '.reveal section.present > p');
    await sleep(50);
    const caret = await survey(page);
    assert.deepEqual(caret.wrong, [], 'with the caret in a paragraph, a submenu does not follow its items');
    assert.equal(caret.subs['Format > Paragraph Style'], true, 'with the caret in a paragraph, its style cannot be set');
    assert.equal(caret.commands['selection.all'], true);

    await press(page, 'Escape');
    await press(page, 'Escape');
    await click(page, '.reveal section.present .zone > video');
    await sleep(50);
    const figure = await survey(page);
    assert.deepEqual(figure.wrong, [], 'with a figure selected, a submenu does not follow its items');
    assert.deepEqual(off(figure, [...TEXT_SUBMENUS, ...TEXT_COMMANDS]), [], 'the text submenus of Format are left enabled while a figure is selected');

    await click(page, '.reveal section.present > p', { modifiers: 'Shift' });
    await sleep(50);
    const two = await survey(page);
    assert.deepEqual(two.wrong, [], 'with two elements selected, a submenu does not follow its items');
    assert.equal(two.subs['Arrange > Align'], true, 'two elements cannot be aligned');
    assert.deepEqual(errorsOf(page), []);
  });
}
