// the in-place editor on the demo deck in headless Chrome: the text of index.html with no edit and
// with one edit is written back byte for byte, apart from the edited text, the keys of reveal.js do
// not fire while a block is typed into, the editor is loaded only with ?edit, and a save writes the
// file through a handle of the File System Access API

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';

const deckText = readFileSync('test-deck.html', 'utf8');
// the newline of the file, since a checkout on Windows may turn it into CRLF
const nl = deckText.includes('\r\n') ? '\r\n' : '\n';
const ready = 'window.BeesonEditor && window.BeesonEditor.ready.then(() => true)';
const openDeck = `window.BeesonEditor.open(${JSON.stringify(deckText)})`;

async function editorPage(browser, query = 'edit&still') {
  const page = await browser.newPage();
  await page.goto(deckUrl('test-deck.html', query));
  await page.waitFor(deckSettled);
  await page.waitFor(ready);
  return page;
}

// the items of the slide with the figure, each a step of its own in the file
// the rows of the Steps tab in document order, and the step of each, '' for an element shown with
// the slide and otherwise the step counted from 0
const IN_ORDER = `[...document.querySelectorAll('.beeson-edit-side .rows .row')].sort((a, b) => a.dataset.doc - b.dataset.doc)`;
const STEP_VALUES = `${IN_ORDER}.map((r) => r.dataset.step)`;
// the item with label of the menu of the chip of the row at position i in document order
const pickStep = (page, i, label) => page.evaluate(`(() => {
  document.querySelector('.beeson-edit-side .row[data-doc="${i}"] .chip').click();
  [...document.querySelectorAll('.beeson-edit-menu .item')].find((x) => x.querySelector('.label').textContent === ${JSON.stringify(label)}).click();
})()`);

const FIGURE_ITEMS = [
  'Dark and light mode: export one file per mode, marked <code>for-dark</code> and <code>for-light</code>.',
  'You might have noticed a toggle on the top right: try clicking it on this slide.',
  'You should give black-on-white plots the class <code>invert</code> to invert them in dark mode.',
];
const stepped = (i) => `<li class="fragment" data-fragment-index="${i + 1}">${FIGURE_ITEMS[i]}</li>`;

// the edited text must be the file with one replacement, hence the old text occurs once
function replaced(oldText, newText) {
  assert.equal(deckText.split(oldText).length, 2, `${oldText} is not unique in index.html`);
  return deckText.replace(oldText, newText);
}

test('a deck without ?edit does not load the editor, with ?edit it does on file://', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const plain = await browser.newPage();
  await plain.goto(deckUrl('test-deck.html', 'still'));
  await plain.waitFor(deckSettled);
  assert.equal(await plain.evaluate(`!!document.querySelector('script[src$="editor.js"]') || 'BeesonEditor' in window`), false);
  assert.deepEqual(plain.errors, []);
  await plain.close();
  const page = await editorPage(browser);
  const status = await page.evaluate('window.BeesonEditor.status()');
  assert.equal(status.supported, true);
  assert.equal(status.state, 'waiting');
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-top button')].filter((b) => !b.hidden).map((b) => b.textContent.replace(/^\\d+%/, '%'))`), ['View', '', '%Zoom', 'Undo', 'Redo', 'Add Slide', 'Table', 'Text', 'Formula', 'Shape', '', 'Media', '', 'Preview', '', 'Present', 'Save', 'Format', 'Steps']);
  // the dialog asks for the file, with the folder of the deck
  assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-dialog').hidden`), false);
  assert.match(await page.evaluate(`document.querySelector('.beeson-edit-dialog p').textContent`), /test-deck\.html in \//);
  assert.deepEqual(page.errors, []);
});

test('every block of the demo deck is paired, and a save without an edit is byte-exact', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  const status = await page.evaluate(openDeck);
  assert.deepEqual(status.problems, []);
  assert.ok(status.texts > 30, `${status.texts} texts`);
  assert.equal(status.sections, (deckText.match(/<section/g) ?? []).length);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), deckText);
  // the same file with Windows line endings is written back with them
  const crlf = deckText.replace(/\r?\n/g, '\r\n');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(crlf)})`)).problems, []);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), crlf);
  assert.deepEqual(page.errors, []);
});

test('one edit of a text, a formula, the notes, or a line changes only that text', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const h2 = 'Show your steps one at a time';
  assert.equal(deckText.includes(`<h2>${h2}</h2>`), true);
  // typing changes the data of the text node
  await page.evaluate(`[...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === ${JSON.stringify(h2)}).firstChild.data = 'Show your steps one at a time now'`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), replaced(`<h2>${h2}</h2>`, '<h2>Show your steps one at a time now</h2>'));
  await page.evaluate(`[...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === 'Show your steps one at a time now').firstChild.data = ${JSON.stringify(h2)}`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), deckText);

  // a character that must be escaped, and the no-break space that Chrome types at the end of a line
  await page.evaluate(`[...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === ${JSON.stringify(h2)}).firstChild.data = 'a < b &\\u00a0c'`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), replaced(`<h2>${h2}</h2>`, '<h2>a &lt; b &amp; c</h2>'));
  await page.evaluate(`[...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === 'a < b &\\u00a0c').firstChild.data = ${JSON.stringify(h2)}`);

  // a formula, through the field of the editor, which typesets the block again
  const tex = '-2\\tilde U \\ge C';
  assert.equal(deckText.split(tex).length, 2);
  await page.evaluate(`(async () => {
    const items = MathJax.startup.document.getMathItemsWithin([document.body]);
    const item = items.find((i) => i.math === ${JSON.stringify(tex)});
    await window.BeesonEditor.setMath(item.typesetRoot, ${JSON.stringify(tex + ' + 1')});
  })()`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), replaced(tex, `${tex} + 1`));
  assert.equal((await page.evaluate('window.BeesonEditor.status()')).dirty, true);
  await page.evaluate(`(async () => {
    const items = MathJax.startup.document.getMathItemsWithin([document.body]);
    const item = items.find((i) => i.math === ${JSON.stringify(tex + ' + 1')});
    await window.BeesonEditor.setMath(item.typesetRoot, ${JSON.stringify(tex)});
  })()`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), deckText);

  // the notes of a slide, and new notes on a slide without any
  const notes = [...deckText.matchAll(/<aside class="notes">([^<]*)<\/aside>/g)];
  assert.ok(notes.length > 0);
  const note = notes.find((m) => !m[1].includes('\\'));
  await page.evaluate(`[...document.querySelectorAll('.reveal aside.notes')].find((a) => a.textContent === ${JSON.stringify(note[1])}).firstChild.data = 'Changed notes.'`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), replaced(note[0], '<aside class="notes">Changed notes.</aside>'));
  await page.evaluate(`[...document.querySelectorAll('.reveal aside.notes')].find((a) => a.textContent === 'Changed notes.').firstChild.data = ${JSON.stringify(note[1])}`);
  await page.evaluate(`{
    const slide = [...document.querySelectorAll('.reveal .slides > section')].find((s) => !s.querySelector('aside.notes'));
    const aside = document.createElement('aside'); aside.className = 'notes'; aside.textContent = 'New notes.';
    slide.append(aside);
  }`);
  const rendered = await page.evaluate('window.BeesonEditor.render()');
  assert.equal(rendered.split('<aside class="notes">New notes.</aside>' + nl).length, 2);
  assert.equal(rendered.replace('  <aside class="notes">New notes.</aside>' + nl, ''), deckText);
  await page.evaluate(`[...document.querySelectorAll('.reveal aside.notes')].find((a) => a.textContent === 'New notes.').remove()`);

  // a line break inserted on the page is written as a br
  const li = [...deckText.matchAll(/<li[^>]*>([^<]+)<\/li>/g)].find((m) => deckText.split(m[0]).length === 2);
  await page.evaluate(`{
    const li = [...document.querySelectorAll('.reveal li')].find((l) => l.textContent === ${JSON.stringify(li[1])});
    li.firstChild.data = 'one';
    li.append(document.createElement('br'), 'two');
  }`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), replaced(li[0], li[0].replace(li[1], 'one<br>two')));
  assert.deepEqual(page.errors, []);
});

test('a save is paired again, and a second save is byte-exact', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const h2 = 'Show your steps one at a time';
  await page.evaluate(`[...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === ${JSON.stringify(h2)}).firstChild.data = 'Changed'`);
  const once = await page.evaluate('window.BeesonEditor.render()');
  assert.equal(once, replaced(`<h2>${h2}</h2>`, '<h2>Changed</h2>'));
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(once)})`);
  assert.deepEqual(status.problems, []);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), once);
  assert.deepEqual(page.errors, []);
});

test('the keys of reveal.js do not fire while a block is typed into', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const press = (key, keyCode) => page.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, keyCode: ${keyCode}, which: ${keyCode}, bubbles: true, cancelable: true }))`);
  const slide = () => page.evaluate('Reveal.getIndices().h');
  assert.equal(await slide(), 0);
  await page.evaluate(`document.querySelector('.reveal h1').focus()`);
  assert.equal(await page.evaluate('document.activeElement.isContentEditable'), true);
  await press('ArrowRight', 39);
  await press(' ', 32);
  await press('n', 78);
  await press('d', 68);
  assert.equal(await slide(), 0);
  assert.equal(await page.evaluate(`document.documentElement.dataset.theme || 'dark'`), 'dark');
  // Esc leaves the text, without the overview of reveal.js, and selects its block, and after a
  // second Esc the arrows move the slides again
  await press('Escape', 27);
  assert.equal(await page.evaluate('document.activeElement.isContentEditable'), false);
  assert.equal(await page.evaluate('Reveal.isOverview()'), false);
  assert.equal(await page.evaluate(`!document.querySelector('.beeson-frame.selected').hidden`), true);
  await press('Escape', 27);
  assert.equal(await page.evaluate(`document.querySelector('.beeson-frame.selected').hidden`), true);
  await press('ArrowRight', 39);
  assert.equal(await slide(), 1);
  assert.deepEqual(page.errors, []);
});

test('a save writes the file through a handle, from a served deck', async (t) => {
  // the local server is reached, hence the browser is not offline here
  const browser = await launch({ offline: false });
  t.after(() => browser.close());
  const server = await serve('.');
  t.after(() => server.close());
  const page = await browser.newPage();
  await page.goto(`${server.origin}/test-deck.html?edit&still`);
  await page.waitFor(deckSettled);
  await page.waitFor(ready);
  // the served deck is fetched by the editor itself
  const status = await page.evaluate('window.BeesonEditor.status()');
  assert.equal(status.state, 'loaded');
  assert.deepEqual(status.problems, []);
  await page.evaluate(`[...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === 'Show your steps one at a time').firstChild.data = 'Saved'`);
  const written = await page.evaluate(`(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('saved.html', { create: true });
    window.BeesonEditor.attach(handle);
    await window.BeesonEditor.save();
    return (await (await handle.getFile()).text());
  })()`);
  assert.equal(written, replaced('<h2>Show your steps one at a time</h2>', '<h2>Saved</h2>'));
  const after = await page.evaluate('window.BeesonEditor.status()');
  assert.equal(after.dirty, false);
  assert.match(after.message, /^Saved 1 edit to saved\.html/);
  // the demo deck does not have a favicon, which a browser asks a server for
  assert.deepEqual(page.errors.filter((e) => !e.includes('favicon.ico')), []);
});

test('without the file pickers, a save is a download of the file with the edits', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  await page.evaluate(`{
    window.showOpenFilePicker = undefined;
    window.showSaveFilePicker = undefined;
    URL.createObjectURL = (blob) => { window.__blob = blob; return 'blob:test'; };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () { window.__download = this.download; };
  }`);
  assert.equal((await page.evaluate('window.BeesonEditor.status()')).supported, false);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  await page.evaluate(`[...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === 'Show your steps one at a time').firstChild.data = 'Downloaded'`);
  await page.evaluate('window.BeesonEditor.save()');
  assert.equal(await page.evaluate('window.__download'), 'test-deck.html');
  assert.equal(await page.evaluate('window.__blob.text()'), replaced('<h2>Show your steps one at a time</h2>', '<h2>Downloaded</h2>'));
  const after = await page.evaluate('window.BeesonEditor.status()');
  assert.equal(after.dirty, false);
  // Safari and Firefox put a download into the downloads folder, unless they are set to ask where
  // to save each download, in which case index.html is chosen and replaced in the dialog
  assert.match(after.message, /^Saved a copy with 1 edit\. Replace test-deck\.html in \/.*, or set the browser to ask where to save each download/);
  assert.deepEqual(page.errors, []);
});

test('the video slide and the viewer are left alone, and the deck is still while it is edited', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  // without ?still, hence the backdrops are still by the editor alone
  const page = await editorPage(browser, 'edit');
  const status = await page.evaluate(openDeck);
  assert.deepEqual(status.problems, []);
  assert.equal(await page.evaluate(`document.querySelectorAll('video[contenteditable], tycho-viewer[contenteditable], .figure-box[contenteditable], img[contenteditable]').length`), 0);
  assert.equal(await page.evaluate(`!!document.querySelector('.reveal section:has(video) > h2[contenteditable="true"]')`), true);
  assert.equal(await page.evaluate('Reveal.getIndices().h'), 0);
  assert.equal(await page.evaluate('Beeson.backdrops.every((o) => !o.raf)'), true);
  await page.evaluate(`(async () => {
    const r = document.querySelector('.reveal section.present .backdrop').getBoundingClientRect();
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true }));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  })()`);
  assert.equal(await page.evaluate('Beeson.backdrops.every((o) => !o.pointer)'), true);
  assert.deepEqual(await page.evaluate('({ transition: Reveal.getConfig().transition, fragments: Reveal.getConfig().fragments })'), { transition: 'none', fragments: false });
  assert.deepEqual(page.errors, []);
});

test('the notes are laid in a pane under the slide, and Present opens the deck without the editor', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  assert.match(await page.evaluate(`document.querySelector('.beeson-edit-bottom .count').textContent`), /^Slide 1 of \d+$/);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Notes').click()`);
  const boxes = await page.evaluate(`(() => {
    const slide = document.querySelector('.reveal .slides').getBoundingClientRect();
    const aside = document.querySelector('.reveal section.present > aside.notes');
    const box = aside.getBoundingClientRect();
    const pane = document.querySelector('.beeson-edit-pane').getBoundingClientRect();
    return { display: getComputedStyle(aside).display, slideBottom: slide.bottom, paneTop: pane.top, top: box.top, bottom: box.bottom, height: innerHeight, focused: document.activeElement === aside };
  })()`);
  assert.equal(boxes.display, 'block');
  // the notes are in their pane under the canvas, below the slide and its pasteboard
  assert.ok(Math.abs(boxes.top - boxes.paneTop) < 2 && boxes.slideBottom <= boxes.top, `the notes start at ${boxes.top}, the pane at ${boxes.paneTop}, and the slide ends at ${boxes.slideBottom}`);
  // the status bar of 28 px is under the notes
  assert.ok(boxes.bottom <= boxes.height - 27, `the notes end at ${boxes.bottom} in a window of ${boxes.height}`);
  assert.equal(boxes.focused, true);
  // the show is played in place, in a frame over the editor
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-top button')].find((b) => b.textContent === 'Present').click()`);
  await until(page, `!!document.querySelector('.beeson-edit-show iframe')?.src`);
  const opened = await page.evaluate(`document.querySelector('.beeson-edit-show iframe').src`);
  assert.ok(!/[?&]edit(?:[=&]|$)/.test(opened) && /test-deck\.html\?still(?:&|$)/.test(opened), opened);
  assert.deepEqual(page.errors, []);
});

test('the print view of the PDF and of PowerPoint does not load the editor', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await printView(page, deckUrl('test-deck.html', 'print-pdf&still'));
  assert.equal(await page.evaluate(`!!document.querySelector('script[src$="editor.js"]') || 'BeesonEditor' in window`), false);
  assert.deepEqual(page.errors, []);
});

test('an invalid TeX is refused in the field with an error, and the formula on the slide is kept', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  await page.evaluate(`(() => { const c = document.querySelector('.reveal .slides .math mjx-container'); const { h, v } = Reveal.getIndices(c.closest('section')); Reveal.slide(h, v); })()`);
  const before = await page.evaluate(`document.querySelector('.reveal section.present .math').innerHTML`);
  await page.evaluate(`document.querySelector('.reveal section.present mjx-container').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))`);
  await page.evaluate(`(() => { const f = document.querySelector('.beeson-math textarea'); f.value = f.value + ' \\\\frac{'; f.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await new Promise((done) => setTimeout(done, 600));
  // the error of MathJax is shown under the field, and Apply is off
  assert.notEqual(await page.evaluate(`document.querySelector('.beeson-math .error').textContent`), '', 'the error is empty');
  assert.equal(await page.evaluate(`[...document.querySelectorAll('.beeson-math button')].find((b) => b.textContent === 'Apply').disabled`), true);
  await page.evaluate(`[...document.querySelectorAll('.beeson-math button')].find((b) => b.textContent === 'Apply').click()`);
  await new Promise((done) => setTimeout(done, 300));
  assert.ok(await page.evaluate(`!!document.querySelector('.beeson-math')`), 'the field is closed');
  assert.equal(await page.evaluate(`document.querySelector('.reveal section.present .math').innerHTML`), before);
  assert.equal(await page.evaluate(`document.querySelectorAll('.reveal section.present [data-mjx-error]').length`), 0);
  assert.deepEqual(page.errors, []);
});

test('a step set in the Steps pane writes the class and the index into the tag of the element, and nothing else', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  await page.evaluate(`(() => { const img = document.querySelector('.reveal .slides section .figure-box > img'); const { h, v } = Reveal.getIndices(img.closest('section')); Reveal.slide(h, v); })()`);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Steps').click()`);
  await new Promise((done) => setTimeout(done, 300));
  const pick = (i, label) => pickStep(page, i, label);
  // the heading is the first row, with the slide, and each item is a step of its own. the figure
  // joins the first step
  assert.deepEqual(await page.evaluate(`${IN_ORDER}.map((r) => r.querySelector('.kind').textContent)`), ['Heading', 'Paragraph', 'Item', 'Item', 'Item', 'Figure']);
  const rows = () => page.evaluate(`${STEP_VALUES}`);
  assert.deepEqual(await rows(), ['', '', '0', '1', '2', '']);
  await pick(5, 'Step 1');
  assert.deepEqual(await rows(), ['', '', '0', '1', '2', '0']);
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-badge')].map((b) => b.textContent)`), ['1', '2', '3', '1']);
  const expected = replaced('<figure class="figure-box">', '<figure class="figure-box fragment" data-fragment-index="1">');
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), expected);
  // the second item goes back with the slide, and the third item takes the second step
  await pick(3, 'With the Slide');
  assert.deepEqual(await rows(), ['', '', '0', '', '1', '0']);
  // the saved text is paired again, and the steps are read from it
  const text = await page.evaluate('window.BeesonEditor.render()');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(text)})`)).problems, []);
  assert.deepEqual(await rows(), ['', '', '0', '', '1', '0']);
  // One by one steps every element but the heading, and All at once takes every step away
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .head button')].find((b) => b.textContent === 'One by one').click()`);
  assert.deepEqual(await page.evaluate(`${STEP_VALUES}`), ['', '0', '1', '2', '3', '4']);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .head button')].find((b) => b.textContent === 'All at once').click()`);
  assert.deepEqual(await page.evaluate(`${STEP_VALUES}`), ['', '', '', '', '', '']);
  const unstepped = FIGURE_ITEMS.reduce((text, item, i) => text.replace(stepped(i), `<li>${item}</li>`), deckText);
  assert.notEqual(unstepped, deckText);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), unstepped);
  assert.deepEqual(page.errors, []);
});

test('a figure dragged on the slide gets its offset as a translate style in its tag, and the arrow keys nudge it', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  // Alt is the free modifier of a drag on Windows and Linux, and the copy modifier on a Mac
  const page = await editorPage(browser, 'edit&still&edit-platform=other');
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const moved = await page.evaluate(`(async () => {
    const img = document.querySelector('.reveal .slides section .figure-box > img');
    const { h, v } = Reveal.getIndices(img.closest('section'));
    Reveal.slide(h, v);
    await new Promise((done) => setTimeout(done, 200));
    const r = img.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    // with Alt, so that the figure does not snap to an edge on its way
    const at = (type, cx, cy) => document.elementFromPoint(cx, cy).dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, pointerId: 1, altKey: true }));
    at('pointermove', x, y);
    // a figure is dragged by itself, hence its hover frame is drawn without the handle of a block
    const hovered = !document.querySelector('.beeson-frame').hidden && document.querySelector('.beeson-handle').hidden;
    const scale = Reveal.getScale();
    // a click on the image selects it apart from its caption, and Esc selects the figure
    at('pointerdown', x, y);
    at('pointerup', x, y);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    at('pointerdown', x, y);
    at('pointermove', x + 30 * scale, y + 20 * scale);
    at('pointermove', x + 60 * scale, y + 40 * scale);
    at('pointerup', x + 60 * scale, y + 40 * scale);
    const translate = img.closest('.figure-box').style.translate;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true, cancelable: true }));
    return { src: img.getAttribute('src'), hovered, translate, nudged: img.closest('.figure-box').style.translate, slide: Reveal.getIndices().h === h, selected: !document.querySelector('.beeson-frame.selected').hidden };
  })()`);
  const { src, ...rest } = moved;
  assert.deepEqual(rest, { hovered: true, translate: '60px 40px', nudged: '59px 30px', slide: true, selected: true });
  // the tag of the figure of this image, which is one of two figure boxes with the same tag
  const figureAt = deckText.lastIndexOf('<figure class="figure-box">', deckText.indexOf(src));
  assert.ok(figureAt > 0);
  const expected = `${deckText.slice(0, figureAt)}<figure class="figure-box" style="translate: 59px 30px">${deckText.slice(figureAt + '<figure class="figure-box">'.length)}`;
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), expected);
  // a double click on the handle puts the figure back, and the tag is as in the file again
  await page.evaluate(`document.querySelector('.beeson-handle').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), deckText);
  // a paragraph is dragged by its handle, since a click into it edits the text, with Alt so that
  // it does not snap
  const block = await page.evaluate(`(async () => {
    const p = document.querySelector('.reveal section.present p');
    const r = p.getBoundingClientRect();
    const at = (type, cx, cy, target = document.elementFromPoint(cx, cy)) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, pointerId: 1, altKey: true }));
    at('pointermove', r.left + 40, r.top + 10);
    const handle = document.querySelector('.beeson-handle');
    const hr = handle.getBoundingClientRect();
    const hx = hr.left + hr.width / 2, hy = hr.top + hr.height / 2;
    at('pointerdown', hx, hy, handle);
    at('pointermove', hx, hy + 20 * Reveal.getScale(), handle);
    at('pointerup', hx, hy + 20 * Reveal.getScale(), handle);
    return { handleShown: !handle.hidden, translate: p.style.translate, editing: document.activeElement === p };
  })()`);
  assert.deepEqual(block, { handleShown: true, translate: '0px 20px', editing: false });
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), replaced('<p>Export your matplotlib figure with the styles of the template. It will show frameless.</p>', '<p style="translate: 0px 20px">Export your matplotlib figure with the styles of the template. It will show frameless.</p>'));
  assert.deepEqual(page.errors, []);
});

// polls an expression across a navigation that the page starts itself
async function until(page, expression, timeout = 15000) {
  const start = Date.now();
  for (;;) {
    try {
      if (await page.evaluate(expression)) return;
    } catch {
      // the document is being replaced
    }
    if (Date.now() - start > timeout) throw new Error(`timed out waiting for ${expression}`);
    await new Promise((done) => setTimeout(done, 50));
  }
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

test('one history undoes and redoes the typing, a formula, a step, and a move, with ⌘Z and ⌘⇧Z', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  // Alt is the free modifier of a drag on Windows and Linux, and the copy modifier on a Mac
  const page = await editorPage(browser, 'edit&still&edit-platform=other');
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const status = () => page.evaluate('window.BeesonEditor.status()');
  const render = () => page.evaluate('window.BeesonEditor.render()');
  const key = (key, extra = '') => page.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, metaKey: true, ${extra} bubbles: true, cancelable: true }))`);
  assert.deepEqual([(await status()).undo, (await status()).redo], [false, false]);
  // the typing into a heading, as the keys type it
  const h2 = 'Show your steps one at a time';
  await page.evaluate(`(() => {
    const h = [...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === ${JSON.stringify(h2)});
    Reveal.slide(Reveal.getIndices(h.closest('section')).h);
    h.focus();
    const r = document.createRange(); r.selectNodeContents(h); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    document.execCommand('insertText', false, ' now');
  })()`);
  const typed = replaced(`<h2>${h2}</h2>`, `<h2>${h2} now</h2>`);
  assert.equal(await render(), typed);
  assert.equal((await status()).undo, true);
  await key('z');
  await sleep(200);
  assert.equal(await render(), deckText);
  assert.deepEqual([(await status()).undo, (await status()).redo], [false, true]);
  await key('z', 'shiftKey: true,');
  await sleep(200);
  assert.equal(await render(), typed);
  // the caret is in the heading after the redo
  assert.equal(await page.evaluate('document.activeElement.textContent'), `${h2} now`);
  await key('z');
  await sleep(200);
  assert.equal(await render(), deckText);
  // a formula, from another slide
  const tex = '-2\\tilde U \\ge C';
  const applied = replaced(tex, `${tex} + 1`);
  await page.evaluate(`(async () => {
    const items = MathJax.startup.document.getMathItemsWithin([document.body]);
    const item = items.find((i) => i.math === ${JSON.stringify(tex)});
    await window.BeesonEditor.setMath(item.typesetRoot, ${JSON.stringify(tex + ' + 1')});
    Reveal.slide(0);
  })()`);
  assert.equal(await render(), applied);
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await render(), deckText);
  // the undo showed the slide of the formula
  assert.equal(await page.evaluate(`!!document.querySelector('.reveal section.present .surface')`), true);
  await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(), applied);
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await render(), deckText);
  // a step, from the pane
  await page.evaluate(`(() => { const img = document.querySelector('.reveal .slides section .figure-box > img'); Reveal.slide(Reveal.getIndices(img.closest('section')).h); })()`);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Steps').click()`);
  await sleep(200);
  await pickStep(page, 5, 'New Step at End');
  const figureStep = replaced('<figure class="figure-box">', '<figure class="figure-box fragment" data-fragment-index="4">');
  assert.equal(await render(), figureStep);
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await render(), deckText);
  assert.deepEqual(await page.evaluate(`${STEP_VALUES}`), ['', '', '0', '1', '2', '']);
  await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(), figureStep);
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-badge')].map((b) => b.textContent)`), ['1', '2', '3', '4']);
  await page.evaluate('window.BeesonEditor.undo()');
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Steps').click()`);
  // a drag, with Alt so that the figure does not snap, and a nudge
  await page.evaluate(`(() => {
    const img = document.querySelector('.reveal section.present .figure-box > img');
    const r = img.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const at = (type, cx, cy) => document.elementFromPoint(cx, cy).dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, pointerId: 1, altKey: true }));
    const scale = Reveal.getScale();
    at('pointermove', x, y);
    // a click on the image selects it apart from its caption, and Esc selects the figure
    at('pointerdown', x, y);
    at('pointerup', x, y);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    at('pointerdown', x, y);
    at('pointermove', x + 60 * scale, y + 40 * scale);
    at('pointerup', x + 60 * scale, y + 40 * scale);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  })()`);
  const translate = () => page.evaluate(`document.querySelector('.reveal section.present .figure-box').style.translate`);
  assert.equal(await translate(), '59px 40px');
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await translate(), '60px 40px');
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await translate(), '');
  assert.equal(await render(), deckText);
  await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await translate(), '60px 40px');
  assert.notEqual(await render(), deckText);
  // the Undo button of the toolbar
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-top button')].find((b) => b.textContent === 'Undo').click()`);
  await sleep(100);
  assert.equal(await render(), deckText);
  assert.equal(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-top button')].find((b) => b.textContent === 'Undo').disabled`), true);
  assert.deepEqual(page.errors, []);
});

test('the list of the slides at the left jumps to a slide, and G jumps to a slide by its number', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const rows = () => page.evaluate(`[...document.querySelectorAll('.beeson-edit-nav .row')].map((r) => [r.querySelector('.num').textContent, r.querySelector('.title').textContent, r.querySelector('.kind').textContent, r.getAttribute('aria-current')])`);
  const first = await rows();
  assert.equal(first.length, await page.evaluate('Reveal.getTotalSlides()'));
  assert.deepEqual(first[0], ['1', 'Presenting in HTML', 'title', 'true']);
  assert.deepEqual(first[1].slice(0, 3), ['2', 'Chapter one', 'section']);
  assert.ok(first.every((r) => r[1].length > 0));
  // the pane is beside the slide, and the slide is not under it
  const box = () => page.evaluate(`(() => { const nav = document.querySelector('.beeson-edit-nav'); const n = nav.getBoundingClientRect(); const s = document.querySelector('.reveal .slides').getBoundingClientRect(); const c = window.BeesonEditorShell.stage.viewport; return { display: getComputedStyle(nav).display, navRight: n.right, slideLeft: s.left, slideRight: s.right, cellLeft: c.left, cellRight: c.right }; })()`);
  let b = await box();
  assert.equal(b.display, 'flex');
  assert.ok(b.slideLeft >= b.navRight && b.slideRight <= 1920, JSON.stringify(b));
  await page.evaluate(`document.querySelectorAll('.beeson-edit-nav .row')[4].click()`);
  assert.equal(await page.evaluate('Reveal.getIndices().h'), 4);
  assert.equal((await rows())[4][3], 'true');
  assert.equal((await rows())[0][3], 'false');
  // the arrows move within the list
  await page.evaluate(`(() => { const r = document.querySelectorAll('.beeson-edit-nav .row')[4]; r.focus(); r.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); })()`);
  assert.equal(await page.evaluate('Reveal.getIndices().h'), 5);
  assert.equal(await page.evaluate(`document.activeElement === document.querySelectorAll('.beeson-edit-nav .row')[5]`), true);
  // the title in the list follows the heading
  await page.evaluate(`(() => { const h = document.querySelector('.reveal section.present h2'); h.firstChild.data = 'Renamed'; h.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  assert.equal((await rows())[5][1], 'Renamed');
  // the Slides button hides the list, and the choice is kept
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Navigator').click()`);
  b = await box();
  assert.equal(b.display, 'none');
  // the canvas takes the width of the list, and the slide is centered in it
  assert.ok(Math.abs(b.slideLeft - b.cellLeft - (b.cellRight - b.slideRight)) < 2 && b.slideLeft < 200, JSON.stringify(b));
  assert.equal(await page.evaluate(`localStorage.getItem('beeson-nav')`), '0');
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Navigator').click()`);
  assert.equal((await box()).display, 'flex');
  // G of reveal.js asks for a number
  await page.evaluate(`document.activeElement.blur(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', keyCode: 71, which: 71, bubbles: true, cancelable: true }))`);
  assert.equal(await page.evaluate(`document.activeElement.className`), 'jump-to-slide-input');
  await page.evaluate(`(() => { const i = document.querySelector('.jump-to-slide-input'); i.value = '11'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.evaluate(`document.querySelector('.jump-to-slide-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }))`);
  await sleep(300);
  assert.equal(await page.evaluate('Reveal.getIndices().h'), 10);
  assert.equal((await rows())[10][3], 'true');
  assert.deepEqual(page.errors, []);
});

test('Save as writes a chosen file, autosave saves after a pause, and unsaved edits are offered again after a reload', async (t) => {
  const browser = await launch({ offline: false });
  t.after(() => browser.close());
  const server = await serve('.');
  t.after(() => server.close());
  const page = await browser.newPage({ drafts: true });
  const url = `${server.origin}/test-deck.html?edit&still`;
  const status = () => page.evaluate('window.BeesonEditor.status()');
  const load = async () => {
    await page.goto(url);
    await page.waitFor(deckSettled);
    await page.waitFor(ready);
    await page.waitFor('window.BeesonEditor.status().texts > 0');
  };
  // the guard against leaving with unsaved changes would hold the navigation of the test
  const leave = () => page.evaluate(`window.addEventListener('beforeunload', (e) => e.stopImmediatePropagation(), true)`);
  await load();
  const h2 = 'Show your steps one at a time';
  const type = (from, to) => page.evaluate(`(() => { const h = [...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === ${JSON.stringify(from)}); h.firstChild.data = ${JSON.stringify(to)}; h.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const file = (name) => page.evaluate(`(async () => { const root = await navigator.storage.getDirectory(); const h = await root.getFileHandle(${JSON.stringify(name)}, { create: true }); return (await h.getFile()).text(); })()`);
  // Save as, with the picker giving a file of the private file system of the browser
  await page.evaluate(`window.showSaveFilePicker = async (o) => { window.__suggested = o.suggestedName; const root = await navigator.storage.getDirectory(); return root.getFileHandle('saved-as.html', { create: true }); }`);
  await type(h2, 'Saved as');
  await page.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, shiftKey: true, bubbles: true, cancelable: true }))`);
  await page.waitFor('!window.BeesonEditor.status().dirty');
  assert.equal(await page.evaluate('window.__suggested'), 'test-deck.html');
  assert.equal(await file('saved-as.html'), replaced(`<h2>${h2}</h2>`, '<h2>Saved as</h2>'));
  let s = await status();
  assert.equal(s.file, 'saved-as.html');
  assert.match(s.message, /^Saved 1 edit to saved-as\.html at \d/);
  // autosave, after the pause that follows the last change
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-header button')].find((b) => b.textContent === 'Autosave').click()`);
  s = await status();
  assert.equal(s.autosave, true);
  await type('Saved as', 'Autosaved');
  assert.equal((await status()).dirty, true);
  await page.waitFor('!window.BeesonEditor.status().dirty', 6000);
  assert.equal(await file('saved-as.html'), replaced(`<h2>${h2}</h2>`, '<h2>Autosaved</h2>'));
  assert.equal(await page.evaluate(`localStorage.getItem('beeson-autosave')`), '1');
  await page.evaluate('window.BeesonEditor.toggleAutosave()');
  assert.equal((await status()).autosave, false);
  // the edits are kept in the browser after a pause, and offered after a reload
  await type('Autosaved', 'Drafted');
  await page.waitFor('window.BeesonEditor.status().draft', 6000);
  await leave();
  await load();
  s = await status();
  assert.equal(s.recover, true);
  assert.equal(s.dirty, false);
  assert.match(await page.evaluate(`document.querySelector('.beeson-edit-dialog.recover p').textContent`), /^Edits of test-deck\.html from .* were kept in this browser/);
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-dialog.recover button')].map((b) => b.textContent)`), ['Restore and save', 'Download a copy', 'Discard']);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-dialog.recover button')].find((b) => b.textContent === 'Discard').click()`);
  s = await status();
  assert.deepEqual([s.recover, s.draft], [false, false]);
  // Restore writes the edits into the file and shows the page again
  await type(h2, 'Drafted twice');
  await page.waitFor('window.BeesonEditor.status().draft', 6000);
  await leave();
  await load();
  assert.equal((await status()).recover, true);
  await page.evaluate(`(async () => { window.__before = true; const root = await navigator.storage.getDirectory(); window.BeesonEditor.attach(await root.getFileHandle('restored.html', { create: true })); })()`);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-dialog.recover button')].find((b) => b.textContent === 'Restore and save').click()`);
  await until(page, '!window.__before && !!window.BeesonEditor && window.BeesonEditor.status().texts > 0');
  assert.equal(await file('restored.html'), replaced(`<h2>${h2}</h2>`, '<h2>Drafted twice</h2>'));
  s = await status();
  assert.deepEqual([s.recover, s.draft, s.dirty], [false, false, false]);
  // the guard against leaving with unsaved changes fired at each reload of the test, and headless
  // Chrome logs that it did not show the panel, since the page had no user gesture
  assert.deepEqual(page.errors.filter((e) => !e.includes('favicon.ico') && !e.includes('beforeunload')), []);
});

test('a formula is reached with Tab and opened with Enter, and the controls carry labels', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  await page.evaluate(`(() => { const c = document.querySelector('.reveal .slides .math mjx-container'); Reveal.slide(Reveal.getIndices(c.closest('section')).h); })()`);
  const info = await page.evaluate(`(() => { const c = document.querySelector('.reveal section.present .math mjx-container'); c.focus(); return { tabindex: c.getAttribute('tabindex'), role: c.getAttribute('role'), label: c.getAttribute('aria-label'), focused: document.activeElement === c }; })()`);
  assert.deepEqual(info, { tabindex: '0', role: 'button', label: 'Formula, Enter opens its TeX', focused: true });
  await page.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }))`);
  assert.equal(await page.evaluate(`document.querySelector('.beeson-math textarea')?.getAttribute('aria-label')`), 'TeX of the formula');
  assert.equal(await page.evaluate(`document.activeElement === document.querySelector('.beeson-math textarea')`), true);
  assert.equal(await page.evaluate(`document.querySelector('.beeson-math').getAttribute('role')`), 'dialog');
  await page.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true }))`);
  assert.equal(await page.evaluate(`!!document.querySelector('.beeson-math')`), false);
  // the arrows of the status bar are named, and the notes show only the caret, as in Keynote
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].slice(0, 2).map((b) => b.getAttribute('aria-label'))`), ['Previous slide', 'Next slide']);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Notes').click()`);
  const outline = await page.evaluate(`(() => { const a = document.querySelector('.reveal section.present > aside.notes'); const s = getComputedStyle(a); return { focused: document.activeElement === a, style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor }; })()`);
  assert.equal(outline.focused, true);
  assert.equal(outline.color, 'rgba(0, 0, 0, 0)');
  assert.deepEqual(page.errors, []);
});

test('a text that runs past the edge of the slide is marked and counted, and no text of the demo deck does', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const counts = await page.evaluate(`(async () => { const out = []; for (let i = 0; i < Reveal.getTotalSlides(); i += 1) { Reveal.slide(i); await new Promise((d) => setTimeout(d, 50)); out.push(window.BeesonEditor.status().overflow); } return out; })()`);
  assert.deepEqual(counts, counts.map(() => 0));
  const h2 = 'Show your steps one at a time';
  await page.evaluate(`(() => { const h = [...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === ${JSON.stringify(h2)}); Reveal.slide(Reveal.getIndices(h.closest('section')).h); h.firstChild.data = 'A heading that goes on and on '.repeat(30); h.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const status = await page.evaluate('window.BeesonEditor.status()');
  assert.ok(status.overflow >= 1, `overflow ${status.overflow}`);
  assert.match(status.message, /texts? runs? past the slide or into its footnote/);
  assert.equal(await page.evaluate(`document.querySelector('.reveal section.present h2').classList.contains('beeson-overflow')`), true);
  await page.evaluate(`(() => { const h = document.querySelector('.reveal section.present h2'); h.firstChild.data = ${JSON.stringify(h2)}; h.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  assert.equal((await page.evaluate('window.BeesonEditor.status()')).overflow, 0);
  assert.equal(await page.evaluate(`document.querySelectorAll('.reveal .beeson-overflow').length`), 0);
  assert.deepEqual(page.errors, []);
});

test('the notes pane is resized by dragging the strip above it, and the height is kept', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Notes').click()`);
  const result = await page.evaluate(`(() => {
    const strip = document.querySelector('.beeson-edit-resize');
    const r = strip.getBoundingClientRect();
    const paneTop = document.querySelector('.beeson-edit-pane').getBoundingClientRect().top;
    const at = (type, y) => strip.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: r.left + 100, clientY: y, button: 0, pointerId: 1 }));
    const y = r.top + r.height / 2;
    at('pointerdown', y);
    at('pointermove', y - 50);
    at('pointermove', y - 100);
    at('pointerup', y - 100);
    const aside = document.querySelector('.reveal section.present > aside.notes').getBoundingClientRect();
    const slide = document.querySelector('.reveal .slides').getBoundingClientRect();
    const paneAfter = document.querySelector('.beeson-edit-pane').getBoundingClientRect().top;
    return { display: getComputedStyle(strip).display, stripAtPane: Math.abs(y - paneTop) < 6, pane: window.BeesonEditor.status().pane, stored: localStorage.getItem('beeson-pane'), asideHeight: aside.height, asideAtPane: Math.abs(aside.top - paneAfter) < 2 && slide.bottom <= aside.top };
  })()`);
  assert.equal(result.display, 'block');
  assert.equal(result.stripAtPane, true);
  assert.equal(result.pane, 300);
  assert.equal(result.stored, '300');
  assert.ok(Math.abs(result.asideHeight - 300) < 2, `the notes are ${result.asideHeight} px high`);
  assert.equal(result.asideAtPane, true);
  assert.deepEqual(page.errors, []);
});

test('E opens the slide in the editor', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('test-deck.html', 'still', '/3'));
  await page.waitFor(deckSettled);
  assert.equal(await page.evaluate(`'BeesonEditor' in window`), false);
  await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', keyCode: 69, which: 69, bubbles: true, cancelable: true }))`);
  await until(page, `location.search === '?still&edit' && !!window.BeesonEditor`);
  await page.waitFor(ready);
  // the editor shows every step, hence reveal.js may add the last step of the slide to the hash
  assert.match(await page.evaluate('location.hash'), /^#\/3(\/0\/\d+)?$/);
  assert.equal(await page.evaluate('Reveal.getIndices().h'), 3);
  // in the editor, the key does nothing
  await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', keyCode: 69, which: 69, bubbles: true, cancelable: true }))`);
  await sleep(200);
  assert.equal(await page.evaluate('location.search'), '?still&edit');
  assert.deepEqual(page.errors, []);
});

test('Open with unsaved changes asks first: Cancel keeps them, Open without saving puts the slide back as saved, and Save and open saves them', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const h2 = 'Show your steps one at a time';
  // stubs of the pickers: both give one handle of a file, read as last written
  await page.evaluate(`window.pickerCalls = 0; window.written = null;
    const handle = { name: 'test-deck.html', getFile: async () => new File([window.written ?? ${JSON.stringify(deckText)}], 'test-deck.html', { type: 'text/html' }), createWritable: async () => ({ write: async (text) => { window.written = text; }, close: async () => {} }) };
    window.showOpenFilePicker = async () => { window.pickerCalls += 1; return [handle]; };
    window.showSaveFilePicker = async () => handle;`);
  const type = (text) => page.evaluate(`(() => { const h = [...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === ${JSON.stringify(h2)}); Reveal.slide(Reveal.getIndices(h.closest('section')).h); h.focus(); const r = document.createRange(); r.selectNodeContents(h); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('insertText', false, ${JSON.stringify(text)}); })()`);
  // Open… is in the File menu of the menu bar
  const open = () => page.evaluate(`{
    [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent === 'File').click();
    [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label').textContent === 'Open…').click();
  }`);
  const choose = (text) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-dialog.ask button')].find((b) => b.textContent === ${JSON.stringify(text)}).click()`);
  await type(' edited');
  assert.equal((await page.evaluate('window.BeesonEditor.status()')).dirty, true);
  await open();
  await sleep(100);
  const card = await page.evaluate(`(() => { const c = document.querySelector('.beeson-edit-dialog.ask'); return { hidden: c.hidden, title: c.querySelector('h3').textContent, buttons: [...c.querySelectorAll('button')].map((b) => b.textContent), focused: document.activeElement.textContent }; })()`);
  assert.deepEqual(card, { hidden: false, title: 'The deck has unsaved changes', buttons: ['Save and open…', 'Open without saving', 'Cancel'], focused: 'Cancel' });
  await choose('Cancel');
  await sleep(100);
  assert.equal((await page.evaluate('window.BeesonEditor.status()')).dirty, true);
  assert.equal(await page.evaluate('window.pickerCalls'), 0);
  assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-dialog.ask').hidden`), true);
  // Escape on the dialog is Cancel too
  await open();
  await sleep(100);
  await page.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true }))`);
  assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-dialog.ask').hidden`), true);
  assert.equal((await page.evaluate('window.BeesonEditor.status()')).dirty, true);
  // Open without saving undoes the typing, so that the page reads as the file chosen
  await open();
  await sleep(100);
  await choose('Open without saving');
  await until(page, 'window.pickerCalls === 1');
  await sleep(200);
  let status = await page.evaluate('window.BeesonEditor.status()');
  assert.deepEqual({ dirty: status.dirty, problems: status.problems, undo: status.undo, draft: status.draft }, { dirty: false, problems: [], undo: false, draft: false });
  assert.equal(await page.evaluate(`[...document.querySelectorAll('.reveal h2')].some((h) => h.textContent === ${JSON.stringify(h2)})`), true);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), deckText);
  // Save and open writes the edits first, and the file opened then holds them
  await type(' edited');
  assert.equal((await page.evaluate('window.BeesonEditor.status()')).dirty, true);
  await open();
  await sleep(100);
  assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-dialog.ask').hidden`), false);
  await choose('Save and open…');
  await until(page, 'window.pickerCalls === 2');
  await sleep(200);
  assert.equal(await page.evaluate('window.written'), replaced(`<h2>${h2}</h2>`, `<h2>${h2} edited</h2>`));
  status = await page.evaluate('window.BeesonEditor.status()');
  assert.deepEqual({ dirty: status.dirty, problems: status.problems }, { dirty: false, problems: [] });
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), await page.evaluate('window.written'));
  assert.deepEqual(page.errors, []);
});

// a regression test of Discard going back past the text on disk: Open without saving after a save
// and a later edit must leave the page as saved, not as it was before the save
test('Open without saving after a save puts the slides back as last saved', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const h2 = 'Show your steps one at a time';
  await page.evaluate(`window.written = null;
    const handle = { name: 'test-deck.html', getFile: async () => new File([window.written], 'test-deck.html', { type: 'text/html' }), createWritable: async () => ({ write: async (text) => { window.written = text; }, close: async () => {} }) };
    window.showOpenFilePicker = async () => { throw new DOMException('', 'AbortError'); };
    window.showSaveFilePicker = async () => handle;`);
  const type = (text) => page.evaluate(`(() => { const h = [...document.querySelectorAll('.reveal h2')].find((h) => h.textContent.startsWith(${JSON.stringify(h2)})); Reveal.slide(Reveal.getIndices(h.closest('section')).h); h.focus(); const r = document.createRange(); r.selectNodeContents(h); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('insertText', false, ${JSON.stringify(text)}); })()`);
  await type(' saved');
  await page.evaluate('window.BeesonEditor.save()');
  const saved = await page.evaluate('window.written');
  assert.equal(saved, replaced(`<h2>${h2}</h2>`, `<h2>${h2} saved</h2>`));
  await type(' later');
  assert.equal((await page.evaluate('window.BeesonEditor.status()')).dirty, true);
  await page.evaluate(`void window.BeesonEditor.exec('file.open')`);
  await sleep(100);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-dialog.ask button')].find((b) => b.textContent === 'Open without saving').click()`);
  await sleep(300);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), saved);
  const status = await page.evaluate('window.BeesonEditor.status()');
  assert.deepEqual({ dirty: status.dirty, problems: status.problems }, { dirty: false, problems: [] });
  assert.deepEqual(page.errors, []);
});

test('Esc leaves a text and selects its block for the arrow keys, Tab reaches a figure, and a dragged figure snaps to the edge of a block with a guide', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  // Alt is the free modifier of a drag on Windows and Linux, and the copy modifier on a Mac
  const page = await editorPage(browser, 'edit&still&edit-platform=other');
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  await page.evaluate(`(() => { const img = document.querySelector('.reveal .slides section .figure-box > img'); Reveal.slide(Reveal.getIndices(img.closest('section')).h); })()`);
  await sleep(200);
  const key = (k, o = '{}') => page.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true, cancelable: true, ...${o} }))`);
  const selected = () => page.evaluate(`!document.querySelector('.beeson-frame.selected').hidden`);
  await page.evaluate(`document.querySelector('.reveal section.present p').focus()`);
  await key('Escape');
  assert.deepEqual(await page.evaluate(`({ editing: document.activeElement === document.querySelector('.reveal section.present p'), selected: !document.querySelector('.beeson-frame.selected').hidden, handle: !document.querySelector('.beeson-handle').hidden })`), { editing: false, selected: true, handle: true });
  await key('ArrowRight');
  await key('ArrowDown', '{ shiftKey: true }');
  assert.equal(await page.evaluate(`document.querySelector('.reveal section.present p').style.translate`), '1px 10px');
  // Enter on the handle, which Tab reaches, puts the block back
  await page.evaluate(`document.querySelector('.beeson-handle').focus()`);
  assert.deepEqual(await page.evaluate(`(() => { const h = document.querySelector('.beeson-handle'); return { focused: document.activeElement === h, role: h.getAttribute('role'), label: h.getAttribute('aria-label') }; })()`), { focused: true, role: 'button', label: 'Move the text element: the arrow keys nudge it, Enter puts it back' });
  await page.evaluate(`document.querySelector('.beeson-handle').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))`);
  assert.equal(await page.evaluate(`document.querySelector('.reveal section.present p').style.translate`), '');
  await key('Escape');
  assert.equal(await selected(), false);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), deckText);
  // a figure is in the tab order, and the focus selects it
  const figure = await page.evaluate(`(() => { const f = document.querySelector('.reveal section.present .figure-box'); f.focus(); return { tabindex: f.getAttribute('tabindex'), label: f.getAttribute('aria-label'), focused: document.activeElement === f, selected: !document.querySelector('.beeson-frame.selected').hidden, imgInOrder: document.querySelector('.reveal section.present .figure-box > img').hasAttribute('tabindex') }; })()`);
  assert.deepEqual(figure, { tabindex: '0', label: 'Figure: the arrow keys move it, Esc deselects it', focused: true, selected: true, imgInOrder: false });
  await key('ArrowLeft');
  assert.equal(await page.evaluate(`document.querySelector('.reveal section.present .figure-box').style.translate`), '-1px');
  await key('Escape');
  assert.deepEqual(await page.evaluate(`({ selected: !document.querySelector('.beeson-frame.selected').hidden, focused: document.activeElement === document.querySelector('.reveal section.present .figure-box') })`), { selected: false, focused: false });
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), deckText);
  // the figure dragged to 5 px from the left edge of the paragraph snaps to it, with a guide at the
  // edge while it is dragged, and with Alt it stays where it is dropped
  const drag = (alt) => page.evaluate(`(() => {
    const img = document.querySelector('.reveal section.present .figure-box > img'); const zone = img.closest('.figure-box'); const p = document.querySelector('.reveal section.present p');
    const z = zone.getBoundingClientRect(), pr = p.getBoundingClientRect(), r = img.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const at = (type, cx, cy) => document.elementFromPoint(cx, cy).dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, pointerId: 1, altKey: ${alt} }));
    const dx = pr.left + 5 - z.left;
    // a click on the image selects it apart from its caption, and Esc selects the figure
    at('pointerdown', x, y);
    at('pointerup', x, y);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    at('pointerdown', x, y);
    at('pointermove', x + dx / 2, y + 100);
    at('pointermove', x + dx, y + 200);
    const guide = document.querySelector('.beeson-guide.v');
    const during = { shown: !guide.hidden, atEdge: Math.abs(parseFloat(guide.style.left) - pr.left) < 0.5 };
    at('pointerup', x + dx, y + 200);
    const after = zone.getBoundingClientRect();
    return { during, offLeft: after.left - pr.left, hidden: guide.hidden, translate: zone.style.translate };
  })()`);
  const snapped = await drag(false);
  assert.deepEqual(snapped.during, { shown: true, atEdge: true });
  assert.ok(Math.abs(snapped.offLeft) < 1, `the figure is ${snapped.offLeft} px off the edge`);
  assert.equal(snapped.hidden, true);
  assert.match(snapped.translate, /^-?\d+px -?\d+px$/);
  await page.evaluate(`document.querySelector('.beeson-handle').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
  const free = await drag(true);
  assert.equal(free.during.shown, false);
  assert.ok(Math.abs(free.offLeft - 5) < 1, `the figure is ${free.offLeft} px off the edge`);
  assert.deepEqual(page.errors, []);
});

test('the toggles, the state, the notes, and the formula dialog carry their states, and the notes strip is operated by keyboard', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const pressed = () => page.evaluate(`[...document.querySelectorAll('.beeson-edit-header button, .beeson-edit-bottom button')].filter((b) => b.hasAttribute('aria-pressed')).map((b) => [b.textContent, b.getAttribute('aria-pressed')])`);
  // the inspector is shown at the start with its Format tab, as Keynote opens a presentation
  assert.deepEqual(await pressed(), [['Autosave', 'false'], ['View', 'true'], ['Format', 'true'], ['Steps', 'false'], ['Navigator', 'true'], ['Steps', 'false'], ['Notes', 'false'], ['Fit', 'true']]);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Notes').click()`);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Steps').click()`);
  assert.deepEqual(await pressed(), [['Autosave', 'false'], ['View', 'true'], ['Format', 'false'], ['Steps', 'true'], ['Navigator', 'true'], ['Steps', 'true'], ['Notes', 'true'], ['Fit', 'true']]);
  assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-header .state').getAttribute('aria-live')`), 'polite');
  assert.equal(await page.evaluate(`document.querySelector('.reveal section.present > aside.notes').getAttribute('aria-label')`), 'Speaker notes');
  // the strip above the notes is a separator with a value, and the arrows change the height
  const strip = await page.evaluate(`(() => { const s = document.querySelector('.beeson-edit-resize'); s.focus(); return { role: s.getAttribute('role'), label: s.getAttribute('aria-label'), now: s.getAttribute('aria-valuenow'), focused: document.activeElement === s }; })()`);
  assert.deepEqual(strip, { role: 'separator', label: 'Height of the notes', now: '200', focused: true });
  await page.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }))`);
  await page.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }))`);
  await page.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))`);
  assert.deepEqual(await page.evaluate(`({ pane: window.BeesonEditor.status().pane, now: document.querySelector('.beeson-edit-resize').getAttribute('aria-valuenow'), stored: localStorage.getItem('beeson-pane') })`), { pane: 220, now: '220', stored: '220' });
  // the formula dialog is modal, and Escape and Apply give the focus back to the formula
  await page.evaluate(`(() => { const c = document.querySelector('.reveal .slides .math mjx-container'); Reveal.slide(Reveal.getIndices(c.closest('section')).h); })()`);
  await sleep(200);
  await page.evaluate(`(() => { const c = document.querySelector('.reveal section.present .math mjx-container'); c.focus(); c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true })); })()`);
  assert.equal(await page.evaluate(`document.querySelector('.beeson-math').getAttribute('aria-modal')`), 'true');
  await page.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true }))`);
  assert.equal(await page.evaluate(`document.activeElement === document.querySelector('.reveal section.present .math mjx-container')`), true);
  await page.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }))`);
  await page.evaluate(`(() => { const f = document.querySelector('.beeson-math textarea'); f.value = f.value + ' + 1'; f.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(400);
  await page.evaluate(`[...document.querySelectorAll('.beeson-math button')].find((b) => b.textContent === 'Apply').click()`);
  await until(page, `!document.querySelector('.beeson-math')`);
  assert.equal(await page.evaluate(`document.activeElement === document.querySelector('.reveal section.present .math mjx-container')`), true);
  assert.deepEqual(page.errors, []);
});

test('with Notes on, a slide without notes gets an empty aside to type into, which is saved once it has text', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const status = () => page.evaluate('window.BeesonEditor.status()');
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Notes').click()`);
  assert.equal(await page.evaluate(`!!document.querySelector('.reveal .slides > section:nth-of-type(2) > aside.notes')`), false);
  await page.evaluate(`document.activeElement.blur(); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, which: 39, bubbles: true, cancelable: true }))`);
  assert.equal(await page.evaluate('Reveal.getIndices().h'), 1);
  const aside = await page.evaluate(`(() => { const a = document.querySelector('.reveal section.present > aside.notes'); return a && { editable: a.isContentEditable, label: a.getAttribute('aria-label'), text: a.textContent }; })()`);
  assert.deepEqual(aside, { editable: true, label: 'Speaker notes', text: '' });
  assert.equal((await status()).dirty, false);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), deckText);
  await page.evaluate(`(() => { const a = document.querySelector('.reveal section.present > aside.notes'); a.focus(); document.execCommand('insertText', false, 'New notes.'); })()`);
  assert.equal((await status()).dirty, true);
  const rendered = await page.evaluate('window.BeesonEditor.render()');
  const line = '  <aside class="notes">New notes.</aside>' + nl;
  assert.equal(rendered.replace(line, ''), deckText);
  // the notes are written into the second slide
  assert.equal(rendered.slice(0, rendered.indexOf(line)).split('<section').length - 1, 2);
  assert.deepEqual(page.errors, []);
});

test('a toolbar button pressed by keyboard keeps the focus, and Tab is kept inside the formula dialog', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const focus = await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('.beeson-edit-header button')].find((b) => b.textContent === 'Autosave');
    b.focus();
    b.click();
    const keyboard = document.activeElement === b;
    b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    return { keyboard, pointer: document.activeElement === b };
  })()`);
  assert.deepEqual(focus, { keyboard: true, pointer: false });
  await page.evaluate(`(() => { const c = document.querySelector('.reveal .slides .math mjx-container'); Reveal.slide(Reveal.getIndices(c.closest('section')).h); })()`);
  await sleep(200);
  await page.evaluate(`(() => { const c = document.querySelector('.reveal section.present .math mjx-container'); c.focus(); c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true })); })()`);
  await sleep(400);
  const tab = (shift) => page.evaluate(`(() => { document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, shiftKey: ${shift}, bubbles: true, cancelable: true })); const a = document.activeElement; return a.tagName === 'TEXTAREA' ? 'field' : a.textContent; })()`);
  assert.equal(await tab(false), 'Apply');
  assert.equal(await tab(false), 'Cancel');
  assert.equal(await tab(false), 'field');
  assert.equal(await tab(true), 'Cancel');
  assert.deepEqual(page.errors, []);
});

test('with nothing selected, Esc and B do not open the overview or black out the slide', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const press = (key, keyCode) => page.evaluate(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, keyCode: ${keyCode}, which: ${keyCode}, bubbles: true, cancelable: true }))`);
  await page.evaluate('document.activeElement.blur()');
  await press('Escape', 27);
  assert.equal(await page.evaluate('Reveal.isOverview()'), false);
  await press('b', 66);
  assert.equal(await page.evaluate('Reveal.isPaused()'), false);
  assert.deepEqual(page.errors, []);
});

test('an undo back to the saved text leaves the deck clean, and Present with unsaved changes asks first', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const status = () => page.evaluate('window.BeesonEditor.status()');
  const h2 = 'Show your steps one at a time';
  const type = (text) => page.evaluate(`(() => { const h = [...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === ${JSON.stringify(h2)}); Reveal.slide(Reveal.getIndices(h.closest('section')).h); h.focus(); const r = document.createRange(); r.selectNodeContents(h); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('insertText', false, ${JSON.stringify(text)}); })()`);
  await type(' edited');
  assert.equal((await status()).dirty, true);
  await page.evaluate('window.BeesonEditor.undo()');
  let s = await status();
  assert.deepEqual({ dirty: s.dirty, draft: s.draft, undo: s.undo }, { dirty: false, draft: false, undo: false });
  assert.equal(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-top button')].find((b) => b.textContent === 'Save').classList.contains('on')`), false);
  // Present asks while there are unsaved changes
  await page.evaluate(`window.written = null;
    const handle = { name: 'test-deck.html', getFile: async () => new File([window.written ?? ${JSON.stringify(deckText)}], 'test-deck.html'), createWritable: async () => ({ write: async (text) => { window.written = text; }, close: async () => {} }) };
    window.showSaveFilePicker = async () => handle;`);
  const present = () => page.evaluate(`[...document.querySelectorAll('.beeson-edit-top button')].find((b) => b.textContent === 'Present').click()`);
  const choose = (text) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-dialog.ask button')].find((b) => b.textContent === ${JSON.stringify(text)}).click()`);
  // the show is played in place, in a frame over the editor, and Esc ends it
  const shown = `!!document.querySelector('.beeson-edit-show')`;
  const endShow = async () => {
    await page.evaluate(`(window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })), true)`);
    await until(page, `!document.querySelector('.beeson-edit-show')`);
  };
  await type(' edited');
  await present();
  await sleep(100);
  const card = await page.evaluate(`(() => { const c = document.querySelector('.beeson-edit-dialog.ask'); return { hidden: c.hidden, buttons: [...c.querySelectorAll('button')].map((b) => b.textContent), focused: document.activeElement.textContent }; })()`);
  assert.deepEqual(card, { hidden: false, buttons: ['Save and present', 'Present the saved file', 'Cancel'], focused: 'Cancel' });
  await choose('Cancel');
  await sleep(100);
  assert.equal(await page.evaluate(shown), false);
  await present();
  await sleep(100);
  await choose('Present the saved file');
  await until(page, shown);
  s = await status();
  assert.deepEqual({ dirty: s.dirty, written: await page.evaluate('window.written') }, { dirty: true, written: null });
  await endShow();
  await present();
  await sleep(100);
  await choose('Save and present');
  await until(page, shown);
  assert.equal(await page.evaluate('window.written'), replaced(`<h2>${h2}</h2>`, `<h2>${h2} edited</h2>`));
  assert.equal((await status()).dirty, false);
  // Present without unsaved changes does not ask
  await endShow();
  await present();
  await until(page, shown);
  assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-dialog.ask').hidden`), true);
  assert.deepEqual(page.errors, []);
});

test('the texts that cannot be edited are listed on a card from the toolbar', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  const which = `[...document.querySelectorAll('.beeson-edit-header button')].find((b) => b.textContent === 'Which?')`;
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  assert.equal(await page.evaluate(`!${which} || ${which}.hidden`), true);
  const changed = deckText.replace('<h2>Show your steps one at a time</h2>', '<h2>Another heading</h2>');
  const problems = (await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(changed)})`)).problems;
  assert.ok(problems.length > 0);
  assert.equal(await page.evaluate(`${which}.hidden`), false);
  await page.evaluate(`${which}.click()`);
  const card = await page.evaluate(`(() => { const c = document.querySelector('.beeson-edit-dialog.problems'); return { hidden: c.hidden, title: c.querySelector('h3').textContent, items: c.querySelectorAll('li').length, focused: document.activeElement.textContent }; })()`);
  assert.deepEqual(card, { hidden: false, title: 'Texts that cannot be edited', items: problems.length, focused: 'Close' });
  await page.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true }))`);
  assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-dialog.problems').hidden`), true);
  assert.equal(await page.evaluate(`document.activeElement === ${which}`), true);
  assert.deepEqual(page.errors, []);
});

test('an undo puts the caret at the change, and ⌘B and ⌘I write strong and em', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const render = () => page.evaluate('window.BeesonEditor.render()');
  const h2 = 'Show your steps one at a time';
  await page.evaluate(`(() => {
    const h = [...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === ${JSON.stringify(h2)});
    Reveal.slide(Reveal.getIndices(h.closest('section')).h);
    h.focus();
    const r = document.createRange(); r.setStart(h.firstChild, 5); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    document.execCommand('insertText', false, 'X');
  })()`);
  const caret = () => page.evaluate(`(() => { const s = getSelection(); const h = document.activeElement; const r = document.createRange(); r.setStart(h, 0); r.setEnd(s.anchorNode, s.anchorOffset); return [h.textContent, r.toString().length]; })()`);
  await page.evaluate('window.BeesonEditor.undo()');
  assert.deepEqual(await caret(), [h2, 5]);
  await page.evaluate('window.BeesonEditor.redo()');
  assert.deepEqual(await caret(), ['Show Xyour steps one at a time', 6]);
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await render(), deckText);
  // a word of a list item is made bold and italic, and the selection is kept
  const li = [...deckText.matchAll(/<li[^>]*>([A-Za-z][^<\\&]+)<\/li>/g)].find((m) => deckText.split(m[0]).length === 2);
  const word = li[1].split(' ')[0];
  const format = (type) => page.evaluate(`(() => {
    const li = [...document.querySelectorAll('.reveal li')].find((l) => l.textContent === ${JSON.stringify(li[1])});
    Reveal.slide(Reveal.getIndices(li.closest('section')).h);
    li.focus();
    let node = li.firstChild;
    while (node.nodeType !== 3) node = node.firstChild;
    const r = document.createRange(); r.setStart(node, 0); r.setEnd(node, ${word.length});
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const ev = new InputEvent('beforeinput', { inputType: ${JSON.stringify(type)}, bubbles: true, cancelable: true });
    li.dispatchEvent(ev);
    if (!ev.defaultPrevented) document.execCommand(${JSON.stringify(type === 'formatBold' ? 'bold' : type === 'formatItalic' ? 'italic' : 'underline')});
    return getSelection().toString();
  })()`);
  assert.equal(await format('formatBold'), word);
  assert.equal(await render(), replaced(li[0], li[0].replace(`>${word}`, `><strong>${word}</strong>`)));
  assert.equal(await format('formatItalic'), word);
  assert.equal(await render(), replaced(li[0], li[0].replace(`>${word}`, `><strong><em>${word}</em></strong>`)));
  // a second Cmd+B takes the bold off again
  await format('formatBold');
  assert.equal(await render(), replaced(li[0], li[0].replace(`>${word}`, `><em>${word}</em>`)));
  await page.evaluate('window.BeesonEditor.undo()');
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await render(), replaced(li[0], li[0].replace(`>${word}`, `><strong>${word}</strong>`)));
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await render(), deckText);
  // underline stays blocked
  await format('formatUnderline');
  assert.equal(await render(), deckText);
  assert.deepEqual(page.errors, []);
});

test('an empty TeX is refused in the field, and a save without an edit does not count edits', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  await page.evaluate(`(() => { const c = document.querySelector('.reveal .slides .math mjx-container'); Reveal.slide(Reveal.getIndices(c.closest('section')).h); })()`);
  await page.evaluate(`document.querySelector('.reveal section.present mjx-container').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))`);
  await page.evaluate(`(() => { const f = document.querySelector('.beeson-math textarea'); f.value = '  '; f.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(600);
  assert.equal(await page.evaluate(`document.querySelector('.beeson-math .error').textContent`), 'The formula is empty');
  assert.equal(await page.evaluate(`[...document.querySelectorAll('.beeson-math button')].find((b) => b.textContent === 'Apply').disabled`), true);
  await page.evaluate(`[...document.querySelectorAll('.beeson-math button')].find((b) => b.textContent === 'Cancel').click()`);
  const message = await page.evaluate(`(async () => {
    window.BeesonEditor.attach({ name: 'unchanged.html', createWritable: async () => ({ write: async () => {}, close: async () => {} }) });
    await window.BeesonEditor.save();
    return window.BeesonEditor.status().message;
  })()`);
  assert.match(message, /^Saved unchanged\.html at \d/);
  assert.deepEqual(page.errors, []);
});

// the contrast ratio of two CSS colors rgb(r, g, b), as defined in the Web Content Accessibility
// Guidelines 2
const contrast = (a, b) => {
  const lum = (c) => {
    const [r, g, bl] = c.match(/[\d.]+/g).slice(0, 3).map((v) => {
      const s = Number(v) / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('the slide list and the step chips of the Steps pane carry their names, and the muted text of the panes is legible in light mode', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-nav .rows').getAttribute('aria-label')`), 'Slides');
  await page.evaluate(`(() => { const img = document.querySelector('.reveal .slides section .figure-box > img'); Reveal.slide(Reveal.getIndices(img.closest('section')).h); })()`);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Steps').click()`);
  await sleep(300);
  const rows = await page.evaluate(`${IN_ORDER}.map((r) => [r.localName, r.classList[0], r.querySelector('.chip').getAttribute('aria-label')])`);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows[0].slice(0, 2), ['div', 'row']);
  assert.match(rows[0][2], /^Step of the heading: \S/);
  assert.match(rows[5][2], /^Step of the figure: \S/);
  assert.ok(rows.every(([name, , label]) => name === 'div' && /^Step of the [a-z]+: /.test(label)), JSON.stringify(rows));
  // the panes follow the scheme of the system, not the mode of the deck, and the footnote is drawn
  // on the first ancestor with an opaque background, the Steps pane itself being transparent
  for (const scheme of ['light', 'dark']) {
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
    const colors = await page.evaluate(`(() => {
      const foot = document.querySelector('.beeson-edit-side .foot');
      let el = foot;
      while (el && /rgba\\([^)]*, 0\\)|transparent/.test(getComputedStyle(el).backgroundColor)) el = el.parentElement;
      return { text: getComputedStyle(foot).color, bg: el ? getComputedStyle(el).backgroundColor : 'rgb(255, 255, 255)' };
    })()`);
    assert.doesNotMatch(colors.bg, /rgba/, colors.bg);
    const ratio = contrast(colors.text, colors.bg);
    assert.ok(ratio >= 4.5, `the footnote of the Steps pane has a contrast of ${ratio.toFixed(2)} to 1 in ${scheme} mode (${colors.text} on ${colors.bg})`);
  }
  assert.deepEqual(page.errors, []);
});

test('a step is inserted before the others as one entry of the history, and a formula is listed by its TeX in the Steps pane', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  await page.evaluate(`(() => { const img = document.querySelector('.reveal .slides section .figure-box > img'); Reveal.slide(Reveal.getIndices(img.closest('section')).h); })()`);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Steps').click()`);
  await sleep(300);
  const values = () => page.evaluate(`${STEP_VALUES}`);
  const pick = (i, label) => pickStep(page, i, label);
  assert.deepEqual(await values(), ['', '', '0', '1', '2', '']);
  const before = await page.evaluate(`(() => { const chip = document.querySelector('.beeson-edit-side .row[data-doc="5"] .chip'); chip.click(); const labels = [...document.querySelectorAll('.beeson-edit-menu .item .label')].map((l) => l.textContent); chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); document.querySelector('.beeson-edit-menu')?.remove(); return labels; })()`);
  assert.deepEqual(before.slice(0, 6), ['With the Slide', 'Step 1', 'Step 2', 'Step 3', 'New Step at Start', 'New Step at End']);
  await pick(5, 'New Step at Start');
  assert.deepEqual(await values(), ['', '', '1', '2', '3', '0']);
  let expected = replaced('<figure class="figure-box">', '<figure class="figure-box fragment" data-fragment-index="1">');
  expected = FIGURE_ITEMS.reduce((text, item, i) => text.replace(stepped(i), `<li class="fragment" data-fragment-index="${i + 2}">${item}</li>`), expected);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), expected);
  // one undo takes the new step away and puts the other steps back
  await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true }))`);
  assert.deepEqual(await values(), ['', '', '0', '1', '2', '']);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), deckText);
  // a display formula is listed by its TeX, and an inline formula is shown in place in its paragraph
  await page.evaluate(`(() => { const c = document.querySelector('.reveal .slides .surface'); Reveal.slide(Reveal.getIndices(c.closest('section')).h); })()`);
  await sleep(300);
  const texts = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .row')].map((r) => [r.querySelector('.kind').textContent, r.querySelector('.text').textContent])`);
  const formulas = texts.filter(([kind]) => kind === 'Formula').map(([, text]) => text);
  assert.equal(formulas.length, 3);
  assert.ok(formulas[0].startsWith('U_g = -(1-\\mu)/\\rho_1'), formulas[0]);
  assert.ok(formulas[2].startsWith('\\tilde U = U_g + U_c'), formulas[2]);
  const item = texts.find(([kind, text]) => kind === 'Paragraph' && text.startsWith('Libration points'));
  assert.ok(item && item[1].startsWith('Libration points \\{\\LL{i}\\}_{i=1}^5 satisfy \\nabla'), JSON.stringify(texts));
  assert.deepEqual(page.errors, []);
});

test('the notes fill the width of the pane when the pane is tall', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Notes').click()`);
  const result = await page.evaluate(`(async () => {
    const strip = document.querySelector('.beeson-edit-resize');
    const r = strip.getBoundingClientRect();
    const at = (type, y) => strip.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: r.left + 100, clientY: y, button: 0, pointerId: 1 }));
    const y = r.top + r.height / 2;
    at('pointerdown', y);
    at('pointermove', y - 300);
    at('pointerup', y - 300);
    await new Promise((d) => setTimeout(d, 100));
    const aside = document.querySelector('.reveal section.present > aside.notes');
    const a = aside.getBoundingClientRect();
    const reveal = document.querySelector('.reveal').getBoundingClientRect();
    const pane = document.querySelector('.beeson-edit-pane').getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(aside);
    const text = range.getClientRects()[0];
    const hit = document.elementFromPoint(pane.left + 30, text.top + text.height / 2);
    return { pane: window.BeesonEditor.status().pane, aside: a.width, reveal: pane.width, left: a.left, revealLeft: pane.left, textLeft: text.left, paneLeft: pane.left, hit: !!hit && aside.contains(hit) };
  })()`);
  assert.equal(result.pane, 500);
  assert.ok(Math.abs(result.aside - result.reveal) < 2, `the notes are ${result.aside} px wide in a pane of ${result.reveal} px`);
  assert.ok(Math.abs(result.left - result.revealLeft) < 2, JSON.stringify(result));
  assert.ok(result.textLeft - result.paneLeft >= 0 && result.textLeft - result.paneLeft < 40, JSON.stringify(result));
  assert.equal(result.hit, true, 'the notes at the left of the pane are clipped');
  assert.deepEqual(page.errors, []);
});

test('a row of the slide list rested on shows a preview of its slide, which is hidden when the pointer leaves', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const at = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s, i) => i > 0 && s.querySelector('.backdrop canvas') && s.querySelector('h2'))`);
  assert.ok(at > 0);
  const peek = () => page.evaluate(`(() => {
    const p = document.querySelector('.beeson-edit-peek');
    if (!p) return null;
    const box = p.getBoundingClientRect();
    const list = document.querySelector('.beeson-edit-nav .rows').getBoundingClientRect();
    const clone = p.querySelector('section');
    const canvas = clone?.querySelector('.backdrop canvas');
    let painted = false;
    if (canvas && canvas.width) {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4) if (data[i]) { painted = true; break; }
    }
    return { shown: !p.hidden && getComputedStyle(p).display !== 'none', width: box.width, right: box.left >= list.right, hidden: p.getAttribute('aria-hidden'), focusable: p.querySelectorAll('[tabindex], [contenteditable]').length, title: clone?.querySelector('h2')?.textContent ?? null, painted, fragments: [...(clone?.querySelectorAll('.fragment') ?? [])].every((f) => getComputedStyle(f).opacity === '1') };
  })()`);
  const row = (type) => page.evaluate(`document.querySelectorAll('.beeson-edit-nav .row')[${at}].dispatchEvent(new PointerEvent('${type}', { bubbles: false, pointerId: 1 }))`);
  // a thumbnail shown whole is not previewed, hence the row is scrolled under the upper edge of the
  // list, where its thumbnail is cut
  await page.evaluate(`(() => { const list = document.querySelector('.beeson-edit-nav .rows'); const f = document.querySelectorAll('.beeson-edit-nav .row')[${at}].querySelector('.frame').getBoundingClientRect(); list.scrollTop += f.top + f.height / 2 - list.getBoundingClientRect().top; })()`);
  // the time from the pointer on the row to the preview is measured in the page, since a read 100 ms
  // after the pointer came later than the 300 ms of the rest on a slow runner
  const rested = await page.evaluate(`new Promise((done) => {
    const p = document.querySelector('.beeson-edit-peek');
    const entered = performance.now();
    new MutationObserver((_, observer) => {
      if (p.hidden) return;
      observer.disconnect();
      done(performance.now() - entered);
    }).observe(p, { attributes: true, attributeFilter: ['hidden'] });
    document.querySelectorAll('.beeson-edit-nav .row')[${at}].dispatchEvent(new PointerEvent('pointerenter', { bubbles: false, pointerId: 1 }));
  })`);
  assert.ok(rested >= 290, `the preview is shown ${rested} ms after the pointer, and does not wait for the pointer to rest`);
  const shown = await peek();
  const title = await page.evaluate(`document.querySelectorAll('.reveal .slides > section')[${at}].querySelector('h2').textContent`);
  assert.equal(shown.shown, true);
  assert.ok(Math.abs(shown.width - 320) < 2, `the preview is ${shown.width} px wide`);
  assert.equal(shown.right, true);
  assert.equal(shown.hidden, 'true');
  assert.equal(shown.focusable, 0);
  assert.equal(shown.title, title);
  assert.equal(shown.painted, true);
  assert.equal(shown.fragments, true);
  await row('pointerleave');
  assert.notEqual((await peek())?.shown, true);
  // a click on the row hides the preview and moves to the slide
  await row('pointerenter');
  await page.waitFor(`document.querySelector('.beeson-edit-peek')?.hidden === false`);
  assert.equal((await peek()).shown, true);
  await page.evaluate(`document.querySelectorAll('.beeson-edit-nav .row')[${at}].click()`);
  assert.notEqual((await peek())?.shown, true);
  assert.equal(await page.evaluate('Reveal.getIndices().h'), at);
  assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-edit-peek section').length`), 0);
  assert.deepEqual(page.errors, []);
});

test('Shift locks a drag to one axis, a run of nudges is one undo, and the offset is shown while the element moves', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  // Alt is the free modifier of a drag on Windows and Linux, and the copy modifier on a Mac
  const page = await editorPage(browser, 'edit&still&edit-platform=other');
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  await page.evaluate(`(() => { const img = document.querySelector('.reveal .slides section .figure-box > img'); Reveal.slide(Reveal.getIndices(img.closest('section')).h); })()`);
  await sleep(200);
  const translate = () => page.evaluate(`document.querySelector('.reveal section.present .figure-box').style.translate`);
  // a drag by 60 by 20 slide pixels with Shift. with alt true, the figure does not snap
  const drag = (alt) => page.evaluate(`(() => {
    const img = document.querySelector('.reveal section.present .figure-box > img');
    const r = img.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const at = (type, cx, cy) => document.elementFromPoint(cx, cy).dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, pointerId: 1, shiftKey: true, altKey: ${alt} }));
    const scale = Reveal.getScale();
    const label = () => document.querySelector('.beeson-offset');
    // a click on the image selects it apart from its caption, and Esc selects the figure
    const tap = (type) => document.elementFromPoint(x, y).dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, pointerId: 1 }));
    tap('pointerdown');
    tap('pointerup');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    at('pointermove', x, y);
    at('pointerdown', x, y);
    at('pointermove', x + 30 * scale, y + 10 * scale);
    at('pointermove', x + 60 * scale, y + 20 * scale);
    const zone = img.closest('.figure-box'), l = label()?.getBoundingClientRect();
    // the upper left corner of the figure in slide px, i.e. of its picture with its caption, which
    // the readout gives, and whose frame is drawn 8 px outside it
    const s = document.querySelector('.reveal .slides').getBoundingClientRect(), z = document.querySelector('.beeson-overlay > .beeson-frame.selected:not([hidden])').getBoundingClientRect();
    const corner = 'x: ' + Math.round((z.left + 8 - s.left) / scale) + ' px  y: ' + Math.round((z.top + 8 - s.top) / scale) + ' px';
    const during = { shown: !!label() && !label().hidden, corner: label()?.textContent === corner, atPointer: !!l && Math.abs(l.left - (x + 60 * scale) - 14) < 1 && Math.abs(l.top - (y + 20 * scale) - 18) < 1 };
    at('pointerup', x + 60 * scale, y + 20 * scale);
    return { during, after: label()?.hidden, translate: zone.style.translate };
  })()`);
  const locked = await drag(true);
  assert.deepEqual(locked, { during: { shown: true, corner: true, atPointer: true }, after: true, translate: '60px' });
  await page.evaluate(`document.querySelector('.beeson-handle').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
  // without Alt the figure may snap along the free axis, but not off the locked one
  const snapped = await drag(false);
  assert.match(snapped.translate, /^-?\d+px$/);
  await page.evaluate(`document.querySelector('.beeson-handle').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
  assert.equal(await translate(), '');
  // five nudges in a run are one entry of the history, and the upper left corner of the figure in
  // slide px is shown while they last
  const key = (k) => page.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true, cancelable: true }))`);
  for (let i = 0; i < 5; i++) await key('ArrowRight');
  assert.equal(await translate(), '5px');
  assert.deepEqual(await page.evaluate(`(() => {
    const l = document.querySelector('.beeson-offset');
    const scale = Reveal.getScale(), s = document.querySelector('.reveal .slides').getBoundingClientRect(), z = document.querySelector('.beeson-overlay > .beeson-frame.selected:not([hidden])').getBoundingClientRect();
    // the corner of the figure, inside its frame by 8 px
    return { shown: !l.hidden, corner: l.textContent === 'x: ' + Math.round((z.left + 8 - s.left) / scale) + ' px  y: ' + Math.round((z.top + 8 - s.top) / scale) + ' px' };
  })()`), { shown: true, corner: true });
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await translate(), '');
  await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await translate(), '5px');
  // a pause ends the run, and the nudge after it is an entry of its own
  await sleep(1100);
  await key('ArrowDown');
  assert.equal(await translate(), '5px 1px');
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await translate(), '5px');
  // Escape drops the selection, hides the offset, and ends the run
  await key('Escape');
  assert.equal(await page.evaluate(`document.querySelector('.beeson-offset').hidden`), true);
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await translate(), '');
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), deckText);
  assert.deepEqual(page.errors, []);
});

// a slide whose elements are faded out at a step and replaced in their place is shown one layer at
// a time, i.e. as it is at the last step before an element is hidden. the texts of test/pages/
// layers.html are thus not laid over each other while they are edited
test('a slide with elements faded out at a step is edited one layer at a time', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const file = 'test/pages/layers.html';
  const text = readFileSync(file, 'utf8');
  const page = await browser.newPage();
  await page.goto(deckUrl(file, 'edit&still'));
  await page.waitFor(deckSettled);
  await page.waitFor(ready);
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(text)})`)).problems, []);
  const shown = (ids) => page.evaluate(`${JSON.stringify(ids)}.filter((id) => getComputedStyle(document.getElementById(id)).visibility === 'visible')`);
  const layers = () => page.evaluate(`(() => { const box = document.querySelector('.beeson-shown-steps'); return box.hidden ? null : [...box.querySelectorAll('button')].map((b) => (b.getAttribute('aria-pressed') === 'true' ? '*' : '') + b.textContent); })()`);
  const choose = (label) => page.evaluate(`[...document.querySelectorAll('.beeson-shown-steps button')].find((b) => b.textContent === ${JSON.stringify(label)}).click()`);
  const go = async (h) => { await page.evaluate(`Reveal.slide(${h})`); await sleep(100); };
  const swap = ['old-lead', 'old-step', 'old-span', 'new-lead', 'new-step'];

  assert.deepEqual(await shown(swap), ['old-lead', 'old-step', 'old-span']);
  assert.deepEqual(await layers(), ['*Up to step 2', 'From step 3']);
  await choose('From step 3');
  assert.deepEqual(await layers(), ['Up to step 2', '*From step 3']);
  assert.deepEqual(await shown(swap), ['new-lead', 'new-step']);

  const panels = ['panel-0', 'panel-1', 'panel-2', 'panel-3'];
  await go(1);
  assert.deepEqual(await layers(), ['*Before step 1', 'Step 1', 'Step 2', 'From step 3']);
  assert.deepEqual(await shown(panels), ['panel-0']);
  await choose('Step 2');
  assert.deepEqual(await shown(panels), ['panel-2']);
  await choose('From step 3');
  assert.deepEqual(await shown(panels), ['panel-3']);

  // a slide without such elements shows every step, without the switch
  await go(2);
  assert.equal(await layers(), null);
  assert.deepEqual(await shown(['plain-1', 'plain-2']), ['plain-1', 'plain-2']);

  // the layer of a slide is kept when the slide is shown again, and nothing of it is saved
  await go(0);
  assert.deepEqual(await layers(), ['Up to step 2', '*From step 3']);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), text);
  assert.deepEqual(page.errors, []);
});

// a type filter of the picker may leave index.html grayed out in the file dialog of macOS. any
// file can thus be chosen, and a file that is not the deck is reported after it is read
test('the file to open is chosen without a filter of its type', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  await page.evaluate(`{
    window.__options = 'not called';
    window.showOpenFilePicker = (options) => { window.__options = options ?? null; return Promise.reject(new DOMException('', 'AbortError')); };
  }`);
  await page.evaluate(`document.querySelector('.beeson-edit-dialog button').click()`);
  await page.waitFor(`window.__options !== 'not called'`);
  assert.equal(await page.evaluate('JSON.stringify(window.__options?.types ?? null)'), 'null');
  // without the open picker, the file is chosen with an input element
  await page.evaluate(`{
    window.showOpenFilePicker = undefined;
    window.__accept = 'not clicked';
    HTMLInputElement.prototype.click = function () { window.__accept = this.getAttribute('accept'); };
  }`);
  await page.evaluate(`document.querySelector('.beeson-edit-dialog button').click()`);
  await page.waitFor(`window.__accept !== 'not clicked'`);
  assert.equal(await page.evaluate('window.__accept'), null);
  assert.deepEqual(page.errors, []);
});
