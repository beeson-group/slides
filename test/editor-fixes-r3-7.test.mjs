// regression tests of the bugs in selection and in the menus that the photo editor of round 1
// found, each run on both platforms: the grips of a selected figure, the right-click on a word,
// Select All in a text, the menu items enabled for the selection, the zoom keys listed once, and
// the hovered thumbnail of the navigator

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { titled } from '../src/editor/commands/edit.ts';
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
    if (platform === 'mac') assert.equal(sel.text, 'matplotlib', 'a right-click on a word does not select the word');
    assert.deepEqual((await menuRows(page)).slice(0, 3).map((r) => r.label), ['Cut', 'Copy', 'Paste']);
    // the menu holds the focus while it is open, and gives it back to the text at its close
    await press(page, 'Escape');
    await sleep(50);
    assert.equal(await page.evaluate(`!!document.activeElement?.closest('.reveal section.present p')`), true, 'the paragraph is not put into editing');
    assert.deepEqual(errorsOf(page), []);
  });
}

// the rows of the menu of the menu bar named title, opened with a click on its title
async function barMenu(page, title) {
  await page.evaluate('window.BeesonEditorShell.closeMenus()');
  await sleep(30);
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
  // the commands of a submenu at any depth, with the state of each
  const all = (items) => items.flatMap((i) => i.command ? [{ id: i.command, ...E.state(i.command) }] : i.items ? all(typeof i.items === 'function' ? i.items() : i.items) : []);
  const walk = (items, path) => {
    for (const item of items) {
      if (item.command) commands[item.command] = E.state(item.command).enabled;
      if (!item.items) continue;
      const list = typeof item.items === 'function' ? item.items() : item.items;
      const inner = all(list);
      const name = path + ' > ' + item.label;
      subs[name] = !item.disabled;
      // a submenu is enabled only with an enabled command, and enabled with an enabled command that
      // is not a switch
      if (!item.disabled && !inner.some((i) => i.enabled)) wrong.push(name + ' is enabled');
      if (item.disabled && inner.some((i) => i.enabled && i.checked === null)) wrong.push(name + ' is disabled');
      walk(list, name);
    }
  };
  for (const bar of ${JSON.stringify(MENUS)}) walk(S.menuItems(bar), bar);
  return { subs, commands, wrong };
})()`);

const TEXT_SUBMENUS = ['Format > Font', 'Format > Text', 'Format > Font > Baseline', 'Format > Font > Text Color', 'Format > Font > Change Case'];
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
    assert.equal(caret.subs['Format > Text'], true, 'with the caret in a paragraph, its style cannot be set');
    assert.equal(caret.commands['text.style.body'], true, 'with the caret in a paragraph, its style cannot be set');
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

test('a label of the history is set in the title case of Apple, with short words in lowercase inside it', () => {
  assert.equal(titled('resize column to fit content'), 'Resize Column to Fit Content');
  assert.equal(titled('typing'), 'Typing');
  assert.equal(titled('move to the back'), 'Move to the Back');
  assert.equal(titled('size of text and color'), 'Size of Text and Color');
  assert.equal(titled('paste in place'), 'Paste in Place');
  // the first and the last word are capitalized, and a word given with a capital is kept
  assert.equal(titled('a move with Alt'), 'A Move with Alt');
  assert.equal(titled('set up'), 'Set Up');
  assert.equal(titled('insert QR code'), 'Insert QR Code');
  assert.equal(titled('zoom in'), 'Zoom In');
});

// the keys shown in every menu of the menu bar and in each of its submenus, as path and keys
async function menuKeys(page) {
  const out = [];
  for (const bar of MENUS) {
    const rows = await barMenu(page, bar);
    for (const r of rows) if (r.keys) out.push({ path: `${bar} > ${r.label}`, keys: r.keys });
    const subs = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu')].at(-1) ? [...[...document.querySelectorAll('.beeson-edit-menu')][0].querySelectorAll('.item')].filter((i) => i.querySelector('.arrow')?.childNodes.length && i.getAttribute('aria-disabled') !== 'true').map((i) => { const r = i.getBoundingClientRect(); return { label: i.querySelector('.label').textContent, x: r.left + r.width / 2, y: r.top + r.height / 2 }; }) : []`);
    for (const sub of subs) {
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sub.x, y: sub.y });
      await sleep(350);
      const inner = await page.evaluate(`(() => { const m = [...document.querySelectorAll('.beeson-edit-menu')]; return m.length < 2 ? [] : [...m.at(-1).querySelectorAll('.item')].map((i) => ({ label: i.querySelector('.label')?.textContent ?? '', keys: i.querySelector('.keys')?.textContent ?? '' })); })()`);
      for (const r of inner) if (r.keys) out.push({ path: `${bar} > ${sub.label} > ${r.label}`, keys: r.keys });
    }
  }
  await page.evaluate('window.BeesonEditorShell.closeMenus()');
  return out;
}

const twice = (list) => {
  const seen = new Map();
  for (const { path, keys } of list) for (const k of keys.split(', ').filter(Boolean)) seen.set(k, [...(seen.get(k) ?? []), path]);
  return [...seen].filter(([, paths]) => paths.length > 1).map(([k, paths]) => `${k}: ${paths.join(' | ')}`);
};

for (const platform of PLATFORMS) {
  test(`${platform}: each key is listed once in the menus and in the sheet of shortcuts, and the zoom keys under the zoom`, async () => {
    const page = await editor(platform);
    // the notes are shown, so that their commands are enabled
    await page.evaluate(`window.BeesonEditor.exec('view.notes')`);
    await sleep(100);
    const listed = await menuKeys(page);
    assert.deepEqual(twice(listed), [], 'a key is listed for two items of the menus');
    const zoom = listed.filter((l) => l.path.startsWith('View > Zoom > ')).map((l) => `${l.path.slice(14)} ${l.keys}`);
    const mod = platform === 'mac' ? '⌘' : 'Ctrl+';
    for (const want of [`Zoom In ${mod}=`, `Zoom Out ${mod}−`, `Actual Size ${mod}0`]) assert.ok(zoom.includes(want), `${want} is not listed under the zoom`);

    await page.evaluate(`window.BeesonEditor.exec('help.keys')`);
    await sleep(100);
    const sheet = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-keys kbd')].map((k) => ({ path: k.previousElementSibling?.textContent ?? '', keys: k.textContent }))`);
    assert.ok(sheet.length > 10, 'the sheet of shortcuts is empty');
    // the sheet lists the keys of every context, e.g. Esc in a text and on the canvas, and the keys
    // of the zoom once
    const zoomKeys = platform === 'mac' ? ['⌘=', '⌘−', '⌘0'] : ['Ctrl+=', 'Ctrl+−', 'Ctrl+0'];
    assert.deepEqual(twice(sheet).filter((line) => zoomKeys.some((k) => line.startsWith(`${k}:`))), [], 'a key of the zoom is listed for two items of the sheet of shortcuts');
    assert.deepEqual(errorsOf(page), []);
  });
}

// the outline of the thumbnail of row i of the navigator, and the box of the row
const thumb = (page, i) => page.evaluate(`(() => {
  const row = document.querySelectorAll('.beeson-edit-nav .row')[${i}];
  const f = row.querySelector('.frame');
  const s = getComputedStyle(f);
  const r = f.getBoundingClientRect();
  return { outline: s.outlineWidth + ' ' + s.outlineColor, x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom };
})()`);
const peekShown = (page) => page.evaluate(`!document.querySelector('.beeson-edit-peek')?.hidden`);

for (const platform of PLATFORMS) {
  test(`${platform}: a hovered thumbnail of the navigator is framed, and previewed only where it is not shown whole`, async () => {
    const page = await editor(platform);
    await page.evaluate(`document.documentElement.classList.contains('beeson-nav') || window.BeesonEditor.exec('view.navigator')`);
    await sleep(150);
    const rest = await thumb(page, 1);
    const other = await thumb(page, 2);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rest.x, y: rest.y });
    await sleep(700);
    const hovered = await thumb(page, 1);
    assert.notEqual(hovered.outline, other.outline, 'the hovered thumbnail is drawn as at rest');
    assert.equal(await peekShown(page), false, 'the hover preview repeats a thumbnail that is shown whole');

    // a thumbnail cut by the lower edge of the list is previewed
    const cut = await page.evaluate(`(() => {
      const list = document.querySelector('.beeson-edit-nav .rows');
      const edge = list.getBoundingClientRect().bottom;
      const frames = [...list.querySelectorAll('.row .frame')];
      const i = frames.findIndex((f) => { const r = f.getBoundingClientRect(); return r.top < edge - 20 && r.bottom > edge; });
      if (i < 0) return null;
      const r = frames[i].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: (r.top + edge) / 2 };
    })()`);
    assert.ok(cut, 'a thumbnail is not cut by the lower edge of the list');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 600 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cut.x, y: cut.y });
    await sleep(700);
    assert.equal(await peekShown(page), true, 'a thumbnail cut by the edge of the list is not previewed');
    assert.deepEqual(errorsOf(page), []);
  });
}

// the menus of the menu bar as a tree of labels, with a submenu as { label, items } and a rule as '|'
const tree = (page) => page.evaluate(`(() => {
  const E = window.BeesonEditor;
  const walk = (items) => items.map((i) => i.rule ? '|' : i.command ? E.state(i.command).label : { label: i.label, items: walk(typeof i.items === 'function' ? i.items() : i.items) });
  return Object.fromEntries(${JSON.stringify(MENUS)}.map((bar) => [bar, walk(window.BeesonEditorShell.menuItems(bar))]));
})()`);

// the paths of the submenus of one item, and of the groups of one item between two rules
function sparse(items, path, out = []) {
  const groups = [[]];
  for (const i of items) if (i === '|') groups.push([]); else groups.at(-1).push(i);
  if (groups.length > 1) for (const g of groups) if (g.length === 1 && typeof g[0] === 'string') out.push(`${path} > ${g[0]} is a group of one item`);
  for (const i of items) {
    if (typeof i !== 'object') continue;
    if (i.items.filter((x) => x !== '|').length === 1) out.push(`${path} > ${i.label} is a submenu of one item`);
    sparse(i.items, `${path} > ${i.label}`, out);
  }
  return out;
}

for (const platform of PLATFORMS) {
  test(`${platform}: the Format menu is grouped as in Keynote, and a menu does not have a submenu of one item`, async () => {
    const page = await editor(platform);
    await caretInParagraph(page);
    const menus = await tree(page);
    assert.deepEqual(Object.entries(menus).flatMap(([bar, items]) => sparse(items, bar).filter((p) => p.includes('submenu'))), [], 'a submenu holds a single item');
    const format = menus.Format;
    assert.deepEqual(format.slice(0, 2).map((i) => i.label), ['Font', 'Text'], 'the Format menu does not open with Font and Text');
    const font = format[0].items.filter((i) => i !== '|').map((i) => i.label ?? i);
    for (const want of ['Bold', 'Italic', 'Bigger', 'Smaller', 'Baseline', 'Text Color']) assert.ok(font.includes(want), `${want} is not in Font`);
    const text = format[1].items.filter((i) => i !== '|').map((i) => i.label ?? i);
    for (const want of ['Body', 'Subheading', 'Dashes', 'Numbers']) assert.ok(text.includes(want), `${want} is not in Text`);
    const top = format.map((i) => i.label ?? i);
    assert.ok(top.indexOf('Image') > top.indexOf('Clear Formatting') && top.indexOf('Table') > top.indexOf('Clear Formatting'), `the object items do not follow the text items: ${top.join(', ')}`);
    // a group of one item, e.g. Delete Table set apart in Table, is checked at the top of Format only
    assert.deepEqual(sparse(format, 'Format').filter((p) => p.split(' > ').length === 2), [], 'the Format menu has a group of one item');

    // a submenu of a submenu is opened in the menus
    await barMenu(page, 'Format');
    const hover = async (label, level) => {
      const at = await page.evaluate(`(() => { const i = [...[...document.querySelectorAll('.beeson-edit-menu')][${level}].querySelectorAll('.item')].find((x) => x.querySelector('.label').textContent === ${JSON.stringify(label)}); const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
      await sleep(350);
    };
    await hover('Font', 0);
    await hover('Baseline', 1);
    assert.deepEqual(await page.evaluate(`[...[...document.querySelectorAll('.beeson-edit-menu')][2]?.querySelectorAll('.item .label') ?? []].map((l) => l.textContent)`), ['Superscript', 'Subscript']);
    await page.evaluate('window.BeesonEditorShell.closeMenus()');
    assert.deepEqual(errorsOf(page), []);
  });
}

for (const platform of PLATFORMS) {
  test(`${platform}: the menu of an image opens with the clipboard, then the items of an image, then the arrange items`, async () => {
    const page = await editor(platform);
    await slideOf(page, '.reveal .slides .zone > img');
    await click(page, IMG, { button: 'right' });
    await sleep(100);
    const rows = await menuRows(page);
    const labels = rows.map((r) => r.label);
    assert.deepEqual(labels.slice(0, 3), ['Cut', 'Copy', 'Paste'], `the menu of an image opens with ${labels.slice(0, 3).join(', ')}`);
    assert.ok(!labels.includes('Edit Formula…') && !labels.includes('Edit Plot Data…'), 'the items of another kind are offered on an image');
    const at = (label) => {
      const i = labels.indexOf(label);
      assert.ok(i >= 0, `${label} is not offered on an image: ${labels.join(', ')}`);
      return i;
    };
    const kind = Math.max(at('Replace Image…'), at('Edit Alt Text…'));
    const arrange = Math.min(at('Bring to Front'), at('Send to Back'));
    assert.ok(kind < arrange, `the items of an image do not come before the arrange items: ${labels.join(', ')}`);
    // the figure of the image holds a caption, whose text is offered after the items of the image
    assert.ok(at('Edit Text') > kind && at('Edit Text') < arrange, `Edit Text is not offered after the items of the image: ${labels.join(', ')}`);
    await page.evaluate('window.BeesonEditorShell.closeMenus()');

    // a figure of videos does not hold a text, hence Edit Text is not offered on it
    await slideOf(page, '.reveal .slides .zone > video');
    await click(page, '.reveal section.present .zone > video', { button: 'right' });
    await sleep(100);
    assert.ok(!(await menuRows(page)).some((r) => r.label === 'Edit Text'), 'Edit Text is offered on a figure without a text');
    await page.evaluate('window.BeesonEditorShell.closeMenus()');
    assert.deepEqual(errorsOf(page), []);
  });
}

// the open menu that holds the focus, with the label of its highlighted item
const menuFocus = (page) => page.evaluate(`(() => {
  const m = document.activeElement?.closest?.('.beeson-edit-menu');
  return { focused: !!m, hi: m?.querySelector('.item.hi .label')?.textContent ?? null, open: document.querySelectorAll('.beeson-edit-menu').length };
})()`);

for (const platform of PLATFORMS) {
  test(`${platform}: a context menu takes the focus, with its first item highlighted when it is opened from the keyboard`, async () => {
    const page = await editor(platform);
    await slideOf(page, '.reveal .slides .zone > img');
    await click(page, IMG);
    await press(page, 'Shift+F10');
    await sleep(100);
    const keyed = await menuFocus(page);
    assert.equal(keyed.open, 1, 'Shift+F10 does not open the menu of the selection');
    assert.equal(keyed.focused, true, 'a menu opened with Shift+F10 leaves the focus on the page');
    assert.equal(keyed.hi, 'Cut', 'a menu opened with Shift+F10 does not highlight its first item');
    await press(page, 'ArrowDown');
    assert.equal((await menuFocus(page)).hi, 'Copy');
    await press(page, 'Escape');
    await sleep(50);
    assert.equal((await menuFocus(page)).open, 0);

    await click(page, IMG, { button: 'right' });
    await sleep(100);
    const pointed = await menuFocus(page);
    assert.equal(pointed.focused, true, 'a menu opened with the mouse does not take the focus');
    assert.equal(pointed.hi, null, 'a menu opened with the mouse highlights an item');
    await press(page, 'Escape');

    // the word selected by a right-click is kept, and the focus goes back to its text at the close
    const word = await caretInParagraph(page);
    await click(page, { x: word.left + 20, y: word.y }, { button: 'right' });
    await sleep(100);
    assert.equal((await menuFocus(page)).focused, true);
    await press(page, 'Escape');
    await sleep(50);
    assert.equal(await page.evaluate(`!!document.activeElement?.closest('.reveal section.present p')`), true, 'the focus does not go back to the text');
    if (platform === 'mac') assert.equal((await selected(page)).text, 'matplotlib', 'the selected word is lost at the close of the menu');
    assert.deepEqual(errorsOf(page), []);
  });
}

// the text of the readout of a drag and its box, or null while it is hidden
const readoutOf = (page) => page.evaluate(`(() => { const o = document.querySelector('.beeson-offset:not(.beeson-guide-readout)'); if (!o || o.hidden) return null; const r = o.getBoundingClientRect(); return { text: o.textContent, left: r.left, top: r.top }; })()`);

// the values of the fields X and Y of the Arrange pane, opened with its tab in the Format panel
async function arrangeXY(page) {
  if (!(await page.evaluate(`window.BeesonEditor.state('shell.format')`)).checked) await page.evaluate(`window.BeesonEditor.exec('shell.format')`);
  await sleep(50);
  const at = await page.evaluate(`(() => { const b = [...document.querySelectorAll('#beeson-edit-panel-format button')].find((b) => [b.textContent.trim(), b.title, b.getAttribute('aria-label')].includes('Arrange')); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await sleep(50);
  return page.evaluate(`['x', 'y'].map((n) => document.querySelector('#beeson-edit-panel-format #beeson-edit-num-' + n).value).join(', ')`);
}

for (const platform of PLATFORMS) {
  test(`${platform}: the position of a dragged figure, as the Arrange pane gives it, is shown next to the pointer`, async () => {
    const page = await editor(platform);
    await slideOf(page, '.reveal .slides .zone > img');
    await click(page, IMG);
    const pic = await pictureOf(page, IMG);
    const from = { x: (pic.left + pic.right) / 2, y: (pic.top + pic.bottom) / 2 };
    const to = { x: from.x - 70, y: from.y + 40 };
    await drag(page, from, { dx: to.x - from.x, dy: to.y - from.y, hold: true });
    const during = await readoutOf(page);
    assert.ok(during, 'the position is not shown during the move');
    assert.ok(during.left > to.x && during.left - to.x < 40 && during.top > to.y && during.top - to.y < 40, `the readout at ${during.left}, ${during.top} is not next to the pointer at ${to.x}, ${to.y}`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', clickCount: 1 });
    await sleep(50);
    assert.equal(await readoutOf(page), null, 'the readout is left after the move');
    assert.equal(during.text, await arrangeXY(page), 'the readout is not the X and Y of the Arrange pane');

    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
    await page.evaluate('window.BeesonEditor.redo()');
    assert.match(await page.evaluate('window.BeesonEditor.render()'), /class="zone"[^>]* style="translate: -?\d+px -?\d+px"/, 'a redo does not write the move again');
    await saved();
    assert.deepEqual(errorsOf(page), []);
  });
}

const MULTI = 'test/pages/editor-multi.html';
const QR = '.reveal section.present .qr';
const ZONE_IMG = '.reveal section.present .zone > img';
// the box of the first shown element matched by selector, in CSS pixels of the viewport
const boxOf = (page, selector) => page.evaluate(`(() => { const r = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getBoundingClientRect().width).getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; })()`);
const near = (a, b, by = 2) => Math.abs(a - b) < by;

for (const platform of PLATFORMS) {
  test(`${platform}: each element of a multiple selection shows its grips, and a grip resizes every element of it`, async () => {
    const page = await editor(platform, MULTI);
    await click(page, QR);
    await click(page, ZONE_IMG, { modifiers: 'Shift' });
    await click(page, '.reveal section.present p', { modifiers: 'Shift' });
    assert.equal(await shownSelected(page), 3, 'the QR code, the figure, and the paragraph are not selected');
    const qr = await boxOf(page, QR);
    const pic = await pictureOf(page, ZONE_IMG);
    const grips = await gripsOf(page);
    assert.equal(grips.length, 16, 'the QR code and the figure do not show eight grips each, and the paragraph none');
    assert.ok(grips.every((g) => g.live), 'a grip of a multiple selection cannot be dragged');
    const at = (box, handle) => grips.find((g) => g.handle === handle && near(g.x, box.right) && near(g.y, box.bottom));
    assert.ok(at(qr, 'se') && at(pic, 'se'), 'the grips are not at the corners of the QR code and of the picture');

    const se = at(qr, 'se');
    await drag(page, { x: se.x, y: se.y }, { dx: -60, dy: -60 });
    await sleep(50);
    const qrAfter = await boxOf(page, QR);
    const picAfter = await pictureOf(page, ZONE_IMG);
    const k = (qrAfter.right - qrAfter.left) / (qr.right - qr.left);
    assert.ok(k < 0.9, `the QR code is not resized by its grip (${k})`);
    const kPic = (picAfter.right - picAfter.left) / (pic.right - pic.left);
    assert.ok(Math.abs(kPic - k) < 0.02, `the picture is scaled by ${kPic} and the QR code by ${k}`);
    assert.ok(near(qrAfter.left, qr.left) && near(qrAfter.top, qr.top), 'the corner of the QR code across from the grip is moved');
    assert.ok(near(picAfter.left, pic.left) && near(picAfter.top, pic.top), 'the corner of the picture across from the grip is moved');
    assert.equal(await shownSelected(page), 3, 'the resize changes the selection');
    const after = await page.evaluate('window.BeesonEditor.render()');
    assert.match(after, /<div class="qr" [^>]*style="width: \d+px"/, 'the width of the QR code is not written');
    const widths = [...after.matchAll(/<img class="for-(?:dark|light)"[^>]* style="width: (\d+)px"/g)].map((m) => Number(m[1]));
    assert.equal(widths.length, 2, 'the width is not written on both images of the figure');
    assert.equal(widths[0], widths[1], 'the images of the pair are given different widths');

    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
    await page.evaluate('window.BeesonEditor.redo()');
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), after, 'a redo does not write the resize again');
    await saved();
    assert.deepEqual(errorsOf(page), []);
  });
}

// the switch Constrain Proportions of the Arrange pane, whether it follows the fields W and H, and
// the note under it
const constrainOf = (page) => page.evaluate(`(() => {
  const panel = document.querySelector('#beeson-edit-panel-format');
  const box = [...panel.querySelectorAll('label.ed-check')].find((l) => l.textContent.trim() === 'Constrain Proportions');
  if (!box) return null;
  const input = box.querySelector('input');
  const height = panel.querySelector('#beeson-edit-num-height');
  return { checked: input.checked, disabled: input.disabled, afterSize: !!height && !!(height.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING), note: box.closest('.ed-sec')?.textContent ?? '' };
})()`);

for (const platform of PLATFORMS) {
  test(`${platform}: the Arrange pane has a Constrain Proportions switch beside the size fields, held on while only the width is written`, async () => {
    const page = await editor(platform, MULTI);
    // a state kept in the browser does not free an aspect that the scope rule cannot write
    await page.evaluate(`localStorage.setItem('beeson-edit-constrain-qr', 'off')`);
    await click(page, ZONE_IMG);
    await arrangeXY(page);
    const image = await constrainOf(page);
    assert.ok(image, 'the Arrange pane does not have a switch Constrain Proportions');
    assert.ok(image.afterSize, 'the switch is not beside the size fields');
    assert.deepEqual([image.checked, image.disabled], [true, true], 'the switch of an image is not on, or can be turned off while only the width is written');
    assert.match(image.note, /width/i, 'the note does not say that only the width is written');
    await click(page, QR);
    await arrangeXY(page);
    const qr = await constrainOf(page);
    assert.deepEqual([qr.checked, qr.disabled], [true, true], 'the switch of a QR code is not held on');
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source, 'the switch writes into the file');
    await page.evaluate(`localStorage.removeItem('beeson-edit-constrain-qr')`);
    assert.deepEqual(errorsOf(page), []);
  });
}
