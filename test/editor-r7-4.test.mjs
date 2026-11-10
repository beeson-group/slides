// tests of R7.4 on both platforms with trusted input: ⌘] and ⌘[ for the list level, the name of an
// insert in Undo, Copy Style and Paste Style for a figure, Change Case with Shift+F3 at the head of
// its submenu, Smart Web and Email Links, and dash lists in the speaker notes. after each edit the
// text is checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { inflateRawSync } from 'node:zlib';
import { smartLink } from '../src/editor/text/substitute.ts';
import { byteExact, click, press, saveAndReopen } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const TEXT = 2;
const ZONE = 3;
const PAPER = 6;
const SPLIT = 10;
const P = '.reveal section.present > p:not(.small)';
const NOTES = '.reveal section.present > aside.notes';
const PARAGRAPH = '<p>A paragraph with <strong>bold</strong>, <em>italic</em>, <code>code</code>, and \\(x^2\\) inline.</p>';

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
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);

// the editor on slide n of a deck, the layouts by default, opened from its file without problems
async function load(t, platform, n = 0, deck = LAYOUTS) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the edited text, the text before byte for byte after an undo, the edit again after a redo, and
// an open of the saved text without problems
let saves = 0;
async function roundTrip(page, edited, undos = 1) {
  assert.equal(await render(page), edited);
  for (let i = 0; i < undos; i++) await undo(page);
  await byteExact(page);
  for (let i = 0; i < undos; i++) await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r7-4-${++saves}.html`);
  assert.equal(text, edited);
  page.source = text;
  return text;
}

// the characters of a US layout typed as trusted keys, each with its code and Shift
const KEYS = { '-': ['Minus', 189, 0], ' ': ['Space', 32, 0], '.': ['Period', 190, 0], '/': ['Slash', 191, 0], ':': ['Semicolon', 186, 8], '@': ['Digit2', 50, 8] };
async function typeKeys(page, text) {
  for (const c of text) {
    const [code, keyCode, mods] = KEYS[c] ?? [`Key${c.toUpperCase()}`, c.toUpperCase().charCodeAt(0), /[A-Z]/.test(c) ? 8 : 0];
    const base = { key: c, code, windowsVirtualKeyCode: keyCode, modifiers: mods };
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: c, unmodifiedText: c });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }
}

// Return with its text, as a keyboard sends it, since press() sends a key without a text, which
// does not break a line of the notes in Chrome
async function enter(page) {
  const base = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 0 };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: '\r', unmodifiedText: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

// a press of a bracket key with the command modifier, which press() does not know
async function bracket(page, platform, key) {
  const modifiers = platform === 'mac' ? 4 : 2;
  const [code, keyCode] = key === ']' ? ['BracketRight', 221] : ['BracketLeft', 219];
  const base = { key, code, windowsVirtualKeyCode: keyCode, modifiers };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

// the caret put after the text at of the first element at selector, or at its end, with its block
// focused, by a click and then the range
async function caretIn(page, selector, at = null) {
  await click(page, selector);
  await frames(page);
  return page.evaluate(`(() => {
    const el = document.querySelector(${js(selector)});
    const r = document.createRange();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let placed = false;
    for (let n = walker.nextNode(); n && ${js(at)} !== null; n = walker.nextNode()) {
      const i = n.data.indexOf(${js(at)});
      if (i >= 0) { r.setStart(n, i + ${js(at ?? '')}.length); placed = true; break; }
    }
    if (!placed) { r.selectNodeContents(el); r.collapse(false); }
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    return true;
  })()`);
}

async function openBar(page, bar) {
  await click(page, await page.evaluate(`(() => {
    const r = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)}).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`));
  await frames(page);
}

// the items of the last open menu as [label, keys, disabled], with '|' for a rule
const lastMenu = (page) => page.evaluate(`(() => {
  const menus = [...document.querySelectorAll('.beeson-edit-menu')];
  const m = menus.at(-1);
  return [...m.querySelectorAll(':scope .item, :scope .rule, :scope [role=separator]')].map((i) => i.classList.contains('item') ? [i.querySelector('.label').textContent, i.querySelector('.keys')?.textContent ?? '', i.getAttribute('aria-disabled') === 'true'] : '|');
})()`);

// a click on the item labeled label of the open menus
async function choose(page, label) {
  const at = await page.evaluate(`(() => {
    const item = [...document.querySelectorAll('.beeson-edit-menu .item')].reverse().find((i) => i.querySelector('.label')?.textContent === ${js(label)});
    if (!item) return null;
    const r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(at, `the open menus do not have an item ${label}`);
  await click(page, at);
  await frames(page);
}

// the menus of a path opened from the menu bar, e.g. Format, Font, Change Case
async function openPath(page, path) {
  await openBar(page, path[0]);
  for (const name of path.slice(1)) await choose(page, name);
}

// the parts of a zip, from its central directory, as a map of a name to a Buffer, as in
// pptx.test.mjs
function unzip(file) {
  const end = file.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const parts = new Map();
  let at = file.readUInt32LE(end + 16);
  for (let n = 0; n < file.readUInt16LE(end + 10); n += 1) {
    const method = file.readUInt16LE(at + 10);
    const size = file.readUInt32LE(at + 20);
    const nameLength = file.readUInt16LE(at + 28);
    const local = file.readUInt32LE(at + 42);
    const name = file.toString('utf8', at + 46, at + 46 + nameLength);
    const start = local + 30 + file.readUInt16LE(local + 26) + file.readUInt16LE(local + 28);
    const data = file.subarray(start, start + size);
    parts.set(name, method === 8 ? inflateRawSync(data) : data);
    at += 46 + nameLength;
  }
  return parts;
}

const KEY = { mac: { indent: '⌘]', outdent: '⌘[', cycle: '⇧F3' }, other: { indent: 'Ctrl+]', outdent: 'Ctrl+[', cycle: 'Shift+F3' } };

for (const platform of PLATFORMS) {
  test(`⌘] and ⌘[ change the level of a list item as Tab and Shift+Tab do, and the menu shows them (${platform})`, async (t) => {
    // Tab on a page of its own, closed before the next, since the first indent after an open
    // writes the step that reveal.js numbered on the page, and a later one the step of the file
    const second = '.reveal section.present > ul > li:nth-child(2)';
    const tab = await load(t, platform, TEXT);
    await caretIn(tab, second, 'A sec');
    await press(tab, 'Tab');
    await frames(tab);
    const tabbed = await render(tab);
    await tab.close();
    const page = await load(t, platform, TEXT);
    await caretIn(page, second, 'A sec');
    await bracket(page, platform, ']');
    await frames(page);
    const indented = await render(page);
    assert.notEqual(indented, page.source, `${KEY[platform].indent} did not indent the item`);
    assert.equal(indented, tabbed, 'Tab and the bracket key differ');
    assert.equal(await undoLabel(page), 'Undo Increase Indent Level');
    await undo(page);
    await byteExact(page);
    // the nested item is taken out a level with the left bracket, as with Shift+Tab
    const nested = '.reveal section.present > ul ul > li';
    await caretIn(page, nested, 'A nes');
    await bracket(page, platform, '[');
    await frames(page);
    const outdented = await render(page);
    assert.notEqual(outdented, page.source, `${KEY[platform].outdent} did not outdent the item`);
    await roundTrip(page, outdented);
    // the List submenu of Format > Text shows the bracket keys, Keynote's keys of the two items
    await caretIn(page, '.reveal section.present > ul > li:nth-child(1)', 'A fir');
    await openPath(page, ['Format', 'Text']);
    const items = await lastMenu(page);
    assert.deepEqual(items.find((i) => i[0] === 'Increase Indent Level')?.[1], KEY[platform].indent);
    assert.deepEqual(items.find((i) => i[0] === 'Decrease Indent Level')?.[1], KEY[platform].outdent);
    await press(page, 'Escape');
    assert.deepEqual(errors(page), []);
  });

  test(`an insert is named Insert and its kind in Undo, while the menu keeps its label (${platform})`, async (t) => {
    // slide 3 does not have a footnote, which Footnote would only give the caret
    const page = await load(t, platform, ZONE);
    for (const [id, label] of [['insert.text', 'Text Box'], ['insert.code', 'Code Box'], ['insert.footnote', 'Footnote']]) {
      await exec(page, id);
      await frames(page);
      assert.equal(await undoLabel(page), `Undo Insert ${label}`);
      await press(page, 'Escape');
      await sleep(150);
      await byteExact(page);
    }
    // the Edit menu reads Undo Insert Text Box after a text box is typed, and Insert still lists
    // Text Box
    await exec(page, 'insert.text');
    await frames(page);
    await typeKeys(page, 'x');
    await sleep(300);
    await openBar(page, 'Edit');
    assert.equal((await lastMenu(page))[0][0], 'Undo Insert Text Box');
    await press(page, 'Escape');
    await openBar(page, 'Insert');
    assert.ok((await lastMenu(page)).some((i) => i[0] === 'Text Box'), 'Insert does not list Text Box');
    await press(page, 'Escape');
    await undo(page);
    await sleep(100);
    await byteExact(page);
    // a QR code and a table, each one entry named for its kind
    await exec(page, 'insert.qr');
    await frames(page);
    assert.equal(await undoLabel(page), 'Undo Insert QR Code');
    await roundTrip(page, await render(page));
    await exec(page, 'insert.table', { rows: 2, columns: 2 });
    await frames(page);
    assert.equal(await undoLabel(page), 'Undo Insert Table');
    await roundTrip(page, await render(page));
    assert.deepEqual(errors(page), []);
  });

  test(`a new formula is named Insert Formula in Undo, and one left empty is taken off again (${platform})`, async (t) => {
    const page = await load(t, platform, TEXT);
    await exec(page, 'insert.formula');
    await sleep(200);
    assert.equal(await undoLabel(page), 'Undo Insert Formula');
    // the TeX field closed with an empty TeX takes the formula off, which finds its entry by name
    await press(page, 'Escape');
    await sleep(400);
    await byteExact(page);
    assert.equal((await state(page, 'edit.undo')).enabled, false, 'the empty formula is still in the history');
    assert.deepEqual(errors(page), []);
  });

  test(`Copy Style and Paste Style carry paper, invert, and the mode of a figure to an image and a video (${platform})`, async (t) => {
    const page = await load(t, platform, PAPER);
    const copy = platform === 'mac' ? 'Mod+Alt+C' : 'Mod+Shift+C';
    const paste = platform === 'mac' ? 'Mod+Alt+V' : 'Mod+Shift+V';
    // the image of the zone of slide 3 is shown in one mode only
    await page.evaluate(`Reveal.slide(${ZONE})`);
    await frames(page);
    await click(page, '.reveal section.present .zone > img');
    await frames(page);
    assert.equal((await state(page, 'text.copyStyle')).enabled, true, 'Copy Style is dimmed on an image');
    const mode = await page.evaluate(`window.BeesonEditor.selection()[0].className`);
    assert.match(mode, /^for-(dark|light)$/);
    await press(page, copy);
    // on the paper image of slide 6, paper is taken off and the mode is set
    await page.evaluate(`Reveal.slide(${PAPER})`);
    await frames(page);
    await click(page, '.reveal section.present .plate > img');
    await frames(page);
    assert.equal((await state(page, 'text.pasteStyle')).enabled, true, 'Paste Style is dimmed on an image');
    await press(page, paste);
    await frames(page);
    assert.equal(await undoLabel(page), 'Undo Paste Style');
    const img = '<img class="paper" src="../../demo/figure-light.png" alt="A white raster figure">';
    const styled = page.source.replace(img, `<img class="${mode}" src="../../demo/figure-light.png" alt="A white raster figure">`);
    await roundTrip(page, styled);
    // the paper style of slide 6 goes to the video of the split slide, which takes only the mode, in a
    // class written after its attributes
    await page.evaluate(`Reveal.slide(${SPLIT})`);
    await frames(page);
    await click(page, '.reveal section.present .zone > video');
    await frames(page);
    await press(page, paste);
    await frames(page);
    const video = '<video src="../../demo/clip-dark.mp4" poster="../../demo/clip-dark.png" muted loop></video>';
    await roundTrip(page, page.source.replace(video, `<video src="../../demo/clip-dark.mp4" poster="../../demo/clip-dark.png" muted loop class="${mode}"></video>`));
    // a text style is not pasted on a figure, and a figure style not on a text
    await caretIn(page, '.reveal section.present .panel > p', 'Words');
    assert.equal((await state(page, 'text.pasteStyle')).enabled, false, 'the style of a figure is pasted on a text');
    await press(page, copy);
    await click(page, '.reveal section.present .zone > video');
    await frames(page);
    assert.equal((await state(page, 'text.pasteStyle')).enabled, false, 'the style of a text is pasted on a figure');
    assert.deepEqual(errors(page), []);
  });

  test(`the Format Painter carries the style of a figure to the next figure clicked (${platform})`, async (t) => {
    const page = await load(t, platform, PAPER);
    await click(page, '.reveal section.present .plate > img');
    await frames(page);
    assert.equal((await state(page, 'text.formatPainter')).enabled, true, 'the Format Painter is dimmed on an image');
    await exec(page, 'text.formatPainter');
    await page.evaluate(`Reveal.slide(${ZONE})`);
    await frames(page);
    await click(page, '.reveal section.present .zone > img');
    await sleep(100);
    assert.equal((await state(page, 'text.formatPainter')).checked, false, 'the painter is still armed');
    const shown = await page.evaluate(`window.BeesonEditor.selection()[0].getAttribute('src')`);
    const name = shown.includes('dark') ? 'dark' : 'light';
    const before = `<img class="for-${name}" src="../../demo/figure-${name}.png"`;
    await roundTrip(page, page.source.replace(before, `<img class="paper" src="../../demo/figure-${name}.png"`));
    assert.deepEqual(errors(page), []);
  });

  test(`Change Case with ${KEY[platform].cycle} heads its submenu, and its item cycles the case (${platform})`, async (t) => {
    const page = await load(t, platform, TEXT);
    await caretIn(page, P, 'A parag');
    await openPath(page, ['Format', 'Font', 'Change Case']);
    const items = await lastMenu(page);
    assert.deepEqual(items.slice(0, 3), [['Change Case', KEY[platform].cycle, false], '|', ['Sentence case.', '', false]]);
    await choose(page, 'Change Case');
    await frames(page);
    assert.equal(await undoLabel(page), 'Undo Change Case');
    await roundTrip(page, page.source.replace(PARAGRAPH, PARAGRAPH.replace('paragraph', 'PARAGRAPH')));
    // the sheet of shortcuts lists the key at Change Case
    await exec(page, 'help.keys');
    await frames(page);
    const rows = await page.evaluate(`[...document.querySelectorAll('dialog.beeson-edit-keys .row')].map((r) => [r.firstChild.textContent, r.lastChild.textContent])`);
    await press(page, 'Escape');
    assert.ok(rows.some(([label, keys]) => label === 'Change Case' && keys === KEY[platform].cycle), 'the sheet does not list Change Case');
    assert.deepEqual(errors(page), []);
  });

  test(`Smart Web and Email Links writes an a with href at the space after an address, and one undo takes it away (${platform})`, async (t) => {
    const page = await load(t, platform, TEXT);
    assert.equal((await state(page, 'text.smart.links')).checked, true, 'Smart Links is off');
    await caretIn(page, P);
    await typeKeys(page, ' See www.example.com/a. ');
    await frames(page);
    const typed = PARAGRAPH.replace('inline.</p>', 'inline. See www.example.com/a. </p>');
    const linked = PARAGRAPH.replace('inline.</p>', 'inline. See <a href="https://www.example.com/a">www.example.com/a</a>. </p>');
    assert.equal(await undoLabel(page), 'Undo Smart Link');
    assert.equal(await render(page), page.source.replace(PARAGRAPH, linked));
    // one undo leaves the typed text, and the next takes the typing
    await undo(page);
    assert.equal(await render(page), page.source.replace(PARAGRAPH, typed));
    await undo(page);
    await byteExact(page);
    await redo(page);
    await redo(page);
    await roundTrip(page, page.source.replace(PARAGRAPH, linked), 2);
    // an email address gets a mailto link, and a word with a dot is left as typed
    await caretIn(page, P);
    await typeKeys(page, 'me@example.org e.g. ');
    await frames(page);
    const mail = linked.replace('</a>. </p>', '</a>. <a href="mailto:me@example.org">me@example.org</a> e.g. </p>');
    // three entries: the address typed, its link, and the words typed after it
    await roundTrip(page, page.source.replace(linked, mail), 3);
    // switched off in Edit > Substitutions, an address stays text
    await openPath(page, ['Edit', 'Substitutions']);
    await choose(page, 'Smart Web and Email Links');
    assert.equal((await state(page, 'text.smart.links')).checked, false);
    await caretIn(page, P);
    await typeKeys(page, 'http://x.org ');
    await frames(page);
    assert.equal(await render(page), page.source.replace(mail, mail.replace(' e.g. </p>', ' e.g. http://x.org </p>')));
    await exec(page, 'text.smart.links');
    assert.deepEqual(errors(page), []);
  });

  test(`a line of the speaker notes becomes a dash list with a dash and a space, Return, and Backspace (${platform})`, async (t) => {
    const page = await load(t, platform, TEXT);
    if (!(await state(page, 'view.notes')).checked) await exec(page, 'view.notes');
    await frames(page);
    const notes = '<aside class="notes">Notes of a content slide.</aside>';
    await caretIn(page, NOTES);
    await enter(page);
    await typeKeys(page, '- first');
    await frames(page);
    assert.equal(await render(page), page.source.replace(notes, '<aside class="notes">Notes of a content slide.<ul><li>first</li></ul></aside>'));
    // Return starts the next item, and Return in an empty item ends the list
    await enter(page);
    await typeKeys(page, 'second');
    await enter(page);
    await enter(page);
    await typeKeys(page, 'after');
    await frames(page);
    const listed = '<aside class="notes">Notes of a content slide.<ul><li>first</li><li>second</li></ul>after</aside>';
    assert.equal(await render(page), page.source.replace(notes, listed));
    page.source = page.source.replace(notes, listed);
    // Backspace at the start of an item makes it a line again
    await caretIn(page, `${NOTES} li:nth-child(2)`);
    await page.evaluate(`(() => { const r = document.createRange(); r.setStart(document.querySelector(${js(`${NOTES} li:nth-child(2)`)}).firstChild, 0); getSelection().removeAllRanges(); getSelection().addRange(r); })()`);
    await press(page, 'Backspace');
    await frames(page);
    assert.equal(await undoLabel(page), 'Undo Join Paragraphs');
    const joined = '<aside class="notes">Notes of a content slide.<ul><li>first</li></ul>second<br>after</aside>';
    await roundTrip(page, page.source.replace(listed, joined));
    assert.deepEqual(errors(page), []);
  });

  test(`Dashes and Paragraphs of Format > Text make a line of the notes an item and back (${platform})`, async (t) => {
    const page = await load(t, platform, TEXT);
    if (!(await state(page, 'view.notes')).checked) await exec(page, 'view.notes');
    await frames(page);
    const notes = '<aside class="notes">Notes of a content slide.</aside>';
    await caretIn(page, NOTES, 'Notes of');
    await openPath(page, ['Format', 'Text']);
    const items = await lastMenu(page);
    assert.deepEqual(items.filter((i) => ['Paragraphs', 'Dashes', 'Numbers'].includes(i[0])).map((i) => [i[0], i[2]]), [['Paragraphs', false], ['Dashes', false], ['Numbers', true]]);
    await choose(page, 'Dashes');
    assert.equal(await undoLabel(page), 'Undo Dashes');
    assert.equal((await state(page, 'text.list.ul')).checked, true);
    const listed = '<aside class="notes"><ul><li>Notes of a content slide.</li></ul></aside>';
    await roundTrip(page, page.source.replace(notes, listed));
    await caretIn(page, `${NOTES} li`, 'Notes');
    await openPath(page, ['Format', 'Text']);
    await choose(page, 'Paragraphs');
    await roundTrip(page, page.source.replace(listed, notes));
    assert.deepEqual(errors(page), []);
  });
}

test('the speaker view of reveal.js and the PowerPoint file show the list of the notes', async (t) => {
  const listed = readFileSync(LAYOUTS, 'utf8').replace('<aside class="notes">Notes of a content slide.</aside>', '<aside class="notes">Notes of a content slide.<ul><li>first</li><li>second</li></ul>after</aside>');
  // the deck saved next to the layouts, so that its paths to the theme hold
  const deck = 'test/pages/r7-4-notes.tmp.html';
  writeFileSync(deck, listed);
  t.after(() => rmSync(deck, { force: true }));
  // the editor opens the deck with the list in its notes and renders it unchanged
  const page = await load(t, 'mac', TEXT, deck);
  assert.equal(await render(page), listed);
  await page.close();
  const show = await browser.newPage({ width: 1280, height: 720 });
  t.after(() => show.close().catch(() => {}));
  await show.goto(`${server.origin}/${deck}`);
  await show.waitFor(deckSettled);
  const notes = await show.evaluate(`Reveal.getSlideNotes(Reveal.getSlides().find((s) => s.querySelector('h2')?.textContent === 'Text, a list, and a backdrop'))`);
  assert.equal(notes, 'Notes of a content slide.<ul><li>first</li><li>second</li></ul>after');
  // the speaker view writes the notes as HTML into its notes box
  assert.match(readFileSync('theme/vendor/reveal/notes.js', 'utf8'), /notesValue\.innerHTML = data\.notes;/);
  const folder = mkdtempSync(join(tmpdir(), 'beeson-r7-4-'));
  try {
    const output = join(folder, 'deck.pptx');
    const run = spawnSync(process.execPath, ['scripts/export-pptx.mjs', deck, output], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const parts = unzip(readFileSync(output));
    const name = [...parts.keys()].find((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n) && parts.get(n).toString().includes('Notes of a content slide.'));
    assert.ok(name, 'the notes of the slide are not in the PowerPoint file');
    const xml = parts.get(name).toString();
    const paragraphs = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    assert.deepEqual(paragraphs, ['Notes of a content slide.', '– first', '– second', 'after']);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test('an address at the end of the text before a space is found, without the punctuation after it', () => {
  assert.deepEqual(smartLink('see https://example.com/a.'), { start: 4, end: 25, href: 'https://example.com/a' });
  assert.deepEqual(smartLink('www.example.com'), { start: 0, end: 15, href: 'https://www.example.com' });
  assert.deepEqual(smartLink('(me@example.org)'), { start: 1, end: 15, href: 'mailto:me@example.org' });
  assert.deepEqual(smartLink('to me@example.org,'), { start: 3, end: 17, href: 'mailto:me@example.org' });
  assert.deepEqual(smartLink('https://en.wikipedia.org/wiki/Halo_(orbit)'), { start: 0, end: 42, href: 'https://en.wikipedia.org/wiki/Halo_(orbit)' });
  assert.equal(smartLink('e.g.'), null);
  assert.equal(smartLink('http://'), null);
  assert.equal(smartLink('a \\(www.x.org'), null);
});
