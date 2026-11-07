// the in-place editor on the demo deck in headless Chrome: the text of index.html with no edit and
// with one edit is written back byte for byte, apart from the edited text, the keys of reveal.js do
// not fire while a block is typed into, the editor is loaded only with ?edit, and a save writes the
// file through a handle of the File System Access API

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';

const deckText = readFileSync('index.html', 'utf8');
const ready = 'window.BeesonEditor && window.BeesonEditor.ready.then(() => true)';
const openDeck = `window.BeesonEditor.open(${JSON.stringify(deckText)})`;

async function editorPage(browser, query = 'edit&still') {
  const page = await browser.newPage();
  await page.goto(deckUrl('index.html', query));
  await page.waitFor(deckSettled);
  await page.waitFor(ready);
  return page;
}

// the edited text must be the file with one replacement, hence the old text occurs once
function replaced(oldText, newText) {
  assert.equal(deckText.split(oldText).length, 2, `${oldText} is not unique in index.html`);
  return deckText.replace(oldText, newText);
}

test('a deck without ?edit does not load the editor, with ?edit it does on file://', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const plain = await browser.newPage();
  await plain.goto(deckUrl('index.html', 'still'));
  await plain.waitFor(deckSettled);
  assert.equal(await plain.evaluate(`!!document.querySelector('script[src$="editor.js"]') || 'BeesonEditor' in window`), false);
  assert.deepEqual(plain.errors, []);
  await plain.close();
  const page = await editorPage(browser);
  const status = await page.evaluate('window.BeesonEditor.status()');
  assert.equal(status.supported, true);
  assert.equal(status.state, 'waiting');
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-top button')].filter((b) => !b.hidden).map((b) => b.textContent)`), ['Undo', 'Redo', 'Open…', 'Save', 'Save as…', 'Autosave', 'Present']);
  // the card asks for the file, with the folder of the deck
  assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-card').hidden`), false);
  assert.match(await page.evaluate(`document.querySelector('.beeson-edit-card p').textContent`), /index\.html in \//);
  assert.deepEqual(page.errors, []);
});

test('every block of the demo deck is paired, and a save without an edit is byte-exact', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  const status = await page.evaluate(openDeck);
  assert.deepEqual(status.problems, []);
  assert.ok(status.blocks > 30, `${status.blocks} blocks`);
  assert.equal(status.sections, (deckText.match(/<section/g) ?? []).length);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), deckText);
  // the same file with Windows line endings is written back with them
  const crlf = deckText.replace(/\n/g, '\r\n');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(crlf)})`)).problems, []);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), crlf);
  assert.deepEqual(page.errors, []);
});

test('one edit of a text, a formula, the notes, or a line changes only that text', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const h2 = 'Period of the families';
  assert.equal(deckText.includes(`<h2>${h2}</h2>`), true);
  // typing changes the data of the text node
  await page.evaluate(`[...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === ${JSON.stringify(h2)}).firstChild.data = 'Period of the families now'`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), replaced(`<h2>${h2}</h2>`, '<h2>Period of the families now</h2>'));
  await page.evaluate(`[...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === 'Period of the families now').firstChild.data = ${JSON.stringify(h2)}`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), deckText);

  // a character that must be escaped, and the no-break space that Chrome types at the end of a line
  await page.evaluate(`[...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === ${JSON.stringify(h2)}).firstChild.data = 'a < b &\\u00a0c'`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), replaced(`<h2>${h2}</h2>`, '<h2>a &lt; b &amp; c</h2>'));
  await page.evaluate(`[...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === 'a < b &\\u00a0c').firstChild.data = ${JSON.stringify(h2)}`);

  // a formula, through the field of the editor, which typesets the block again
  const tex = 'C = 2U - v^2';
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
  assert.equal(rendered.split('<aside class="notes">New notes.</aside>\n').length, 2);
  assert.equal(rendered.replace('  <aside class="notes">New notes.</aside>\n', ''), deckText);
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
  const h2 = 'Period of the families';
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
  await page.goto(`${server.origin}/index.html?edit&still`);
  await page.waitFor(deckSettled);
  await page.waitFor(ready);
  // the served deck is fetched by the editor itself
  const status = await page.evaluate('window.BeesonEditor.status()');
  assert.equal(status.state, 'loaded');
  assert.deepEqual(status.problems, []);
  await page.evaluate(`[...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === 'Period of the families').firstChild.data = 'Saved'`);
  const written = await page.evaluate(`(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('saved.html', { create: true });
    window.BeesonEditor.attach(handle);
    await window.BeesonEditor.save();
    return (await (await handle.getFile()).text());
  })()`);
  assert.equal(written, replaced('<h2>Period of the families</h2>', '<h2>Saved</h2>'));
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
  await page.evaluate(`[...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === 'Period of the families').firstChild.data = 'Downloaded'`);
  await page.evaluate('window.BeesonEditor.save()');
  assert.equal(await page.evaluate('window.__download'), 'index.html');
  assert.equal(await page.evaluate('window.__blob.text()'), replaced('<h2>Period of the families</h2>', '<h2>Downloaded</h2>'));
  const after = await page.evaluate('window.BeesonEditor.status()');
  assert.equal(after.dirty, false);
  assert.match(after.message, /^Saved a copy with 1 edit to your downloads/);
  assert.deepEqual(page.errors, []);
});

test('the video slide and the viewer are left alone, and the deck is still while it is edited', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  // without ?still, hence the backdrops are still by the editor alone
  const page = await editorPage(browser, 'edit');
  const status = await page.evaluate(openDeck);
  assert.deepEqual(status.problems, []);
  assert.equal(await page.evaluate(`document.querySelectorAll('video[contenteditable], tycho-viewer[contenteditable], .zone[contenteditable], img[contenteditable]').length`), 0);
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
    return { display: getComputedStyle(aside).display, slideBottom: slide.bottom, top: box.top, bottom: box.bottom, height: innerHeight, focused: document.activeElement === aside };
  })()`);
  assert.equal(boxes.display, 'block');
  assert.ok(Math.abs(boxes.top - boxes.slideBottom) < 2, `the notes start at ${boxes.top}, the slide ends at ${boxes.slideBottom}`);
  assert.ok(boxes.bottom <= boxes.height - 35, `the notes end at ${boxes.bottom} in a window of ${boxes.height}`);
  assert.equal(boxes.focused, true);
  await page.evaluate(`window.open = (url) => { window.__opened = url; }`);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-top button')].find((b) => b.textContent === 'Present').click()`);
  const opened = await page.evaluate('window.__opened');
  assert.ok(!/[?&]edit/.test(opened) && opened.endsWith('index.html?still'), opened);
  assert.deepEqual(page.errors, []);
});

test('the print view of the PDF and of PowerPoint does not load the editor', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await printView(page, deckUrl('index.html', 'print-pdf&still'));
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
  await page.evaluate(`(() => { const img = document.querySelector('.reveal .slides section .zone > img'); const { h, v } = Reveal.getIndices(img.closest('section')); Reveal.slide(h, v); })()`);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Steps').click()`);
  await new Promise((done) => setTimeout(done, 300));
  const pick = (i, value) => page.evaluate(`(() => { const sel = document.querySelectorAll('.beeson-edit-side .row select')[${i}]; sel.value = ${value === undefined ? '[...sel.options].at(-1).value' : JSON.stringify(value)}; sel.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  // the heading is the first row, with the slide. the second and the third item get steps of
  // their own, and the figure joins the first one
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .row .kind')].map((k) => k.textContent)`), ['Heading', 'Paragraph', 'Item', 'Item', 'Item', 'Figure']);
  await pick(3);
  await pick(4);
  await pick(5, '0');
  const rows = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .row select')].map((s) => s.value)`);
  assert.deepEqual(rows, ['', '', '', '0', '1', '0']);
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-badge')].map((b) => b.textContent)`), ['1', '2', '1']);
  let expected = replaced('<li>Give a white raster figure the class <code>paper</code> to frame it.</li>', '<li class="fragment" data-fragment-index="1">Give a white raster figure the class <code>paper</code> to frame it.</li>');
  expected = expected.replace('<li>Give a black-on-white line plot the class <code>invert</code> to invert it in dark mode.</li>', '<li class="fragment" data-fragment-index="2">Give a black-on-white line plot the class <code>invert</code> to invert it in dark mode.</li>');
  expected = expected.replace('<figure class="zone">', '<figure class="zone fragment" data-fragment-index="1">');
  assert.notEqual(expected, deckText);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), expected);
  // the element goes back with the slide, and the figure is alone in the first step
  await pick(3, '');
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .row select')].map((s) => s.value)`), ['', '', '', '', '1', '0']);
  // the saved text is paired again, and the steps are read from it
  const text = await page.evaluate('window.BeesonEditor.render()');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(text)})`)).problems, []);
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .row select')].map((s) => s.value)`), ['', '', '', '', '1', '0']);
  // One by one steps every element but the heading, and All at once takes every step away
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .head button')].find((b) => b.textContent === 'One by one').click()`);
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .row select')].map((s) => s.value)`), ['', '0', '1', '2', '3', '4']);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .head button')].find((b) => b.textContent === 'All at once').click()`);
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .row select')].map((s) => s.value)`), ['', '', '', '', '', '']);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), deckText);
  assert.deepEqual(page.errors, []);
});

test('a figure dragged on the slide gets its offset as a translate style in its tag, and the arrow keys nudge it', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const moved = await page.evaluate(`(async () => {
    const img = document.querySelector('.reveal .slides section .zone > img');
    const { h, v } = Reveal.getIndices(img.closest('section'));
    Reveal.slide(h, v);
    await new Promise((done) => setTimeout(done, 200));
    const r = img.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    // with Alt, so that the figure does not snap to an edge on its way
    const at = (type, cx, cy) => document.elementFromPoint(cx, cy).dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, pointerId: 1, altKey: true }));
    at('pointermove', x, y);
    const hovered = !document.querySelector('.beeson-frame').hidden && !document.querySelector('.beeson-handle').hidden;
    const scale = Reveal.getScale();
    at('pointerdown', x, y);
    at('pointermove', x + 30 * scale, y + 20 * scale);
    at('pointermove', x + 60 * scale, y + 40 * scale);
    at('pointerup', x + 60 * scale, y + 40 * scale);
    const translate = img.closest('.zone').style.translate;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true, cancelable: true }));
    return { src: img.getAttribute('src'), hovered, translate, nudged: img.closest('.zone').style.translate, slide: Reveal.getIndices().h === h, selected: !document.querySelector('.beeson-frame.selected').hidden };
  })()`);
  const { src, ...rest } = moved;
  assert.deepEqual(rest, { hovered: true, translate: '60px 40px', nudged: '59px 30px', slide: true, selected: true });
  // the tag of the figure of this image, which is one of two zones with the same tag
  const figureAt = deckText.lastIndexOf('<figure class="zone">', deckText.indexOf(src));
  assert.ok(figureAt > 0);
  const expected = `${deckText.slice(0, figureAt)}<figure class="zone" style="translate: 59px 30px">${deckText.slice(figureAt + '<figure class="zone">'.length)}`;
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
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), replaced('<p>A figure exported with the matplotlib styles of the template is shown without a frame.</p>', '<p style="translate: 0px 20px">A figure exported with the matplotlib styles of the template is shown without a frame.</p>'));
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
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const status = () => page.evaluate('window.BeesonEditor.status()');
  const render = () => page.evaluate('window.BeesonEditor.render()');
  const key = (key, extra = '') => page.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, metaKey: true, ${extra} bubbles: true, cancelable: true }))`);
  assert.deepEqual([(await status()).undo, (await status()).redo], [false, false]);
  // the typing into a heading, as the keys type it
  const h2 = 'Period of the families';
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
  const tex = 'C = 2U - v^2';
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
  assert.equal(await page.evaluate(`!!document.querySelector('.reveal section.present li mjx-container')`), true);
  await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(), applied);
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await render(), deckText);
  // a step, from the pane
  await page.evaluate(`(() => { const img = document.querySelector('.reveal .slides section .zone > img'); Reveal.slide(Reveal.getIndices(img.closest('section')).h); })()`);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Steps').click()`);
  await sleep(200);
  await page.evaluate(`(() => { const sel = document.querySelectorAll('.beeson-edit-side .row select')[3]; sel.value = [...sel.options].at(-1).value; sel.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  const stepped = replaced('<li>Give a white raster figure the class <code>paper</code> to frame it.</li>', '<li class="fragment" data-fragment-index="1">Give a white raster figure the class <code>paper</code> to frame it.</li>');
  assert.equal(await render(), stepped);
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await render(), deckText);
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .row select')].map((s) => s.value)`), ['', '', '', '', '', '']);
  await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(), stepped);
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-badge')].map((b) => b.textContent)`), ['1']);
  await page.evaluate('window.BeesonEditor.undo()');
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Steps').click()`);
  // a drag, with Alt so that the figure does not snap, and a nudge
  await page.evaluate(`(() => {
    const img = document.querySelector('.reveal section.present .zone > img');
    const r = img.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const at = (type, cx, cy) => document.elementFromPoint(cx, cy).dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, pointerId: 1, altKey: true }));
    const scale = Reveal.getScale();
    at('pointermove', x, y);
    at('pointerdown', x, y);
    at('pointermove', x + 60 * scale, y + 40 * scale);
    at('pointerup', x + 60 * scale, y + 40 * scale);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  })()`);
  const translate = () => page.evaluate(`document.querySelector('.reveal section.present .zone').style.translate`);
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
  // the arrows of the status bar are named, and the notes show their focus
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].slice(0, 2).map((b) => b.getAttribute('aria-label'))`), ['Previous slide', 'Next slide']);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Notes').click()`);
  const outline = await page.evaluate(`(() => { const a = document.querySelector('.reveal section.present > aside.notes'); const s = getComputedStyle(a); return { focused: document.activeElement === a, style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor }; })()`);
  assert.equal(outline.focused, true);
  assert.equal(outline.style, 'solid');
  assert.notEqual(outline.color, 'rgba(0, 0, 0, 0)');
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
    return { display: getComputedStyle(strip).display, stripAtPane: Math.abs(y - paneTop) < 6, pane: window.BeesonEditor.status().pane, stored: localStorage.getItem('beeson-pane'), asideHeight: aside.height, asideAtSlide: Math.abs(aside.top - slide.bottom) < 2 };
  })()`);
  assert.equal(result.display, 'block');
  assert.equal(result.stripAtPane, true);
  assert.equal(result.pane, 300);
  assert.equal(result.stored, '300');
  assert.ok(Math.abs(result.asideHeight - 300) < 2, `the notes are ${result.asideHeight} px high`);
  assert.equal(result.asideAtSlide, true);
  assert.deepEqual(page.errors, []);
});

test('E opens the slide in the editor', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('index.html', 'still', '/3'));
  await page.waitFor(deckSettled);
  assert.equal(await page.evaluate(`'BeesonEditor' in window`), false);
  await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', keyCode: 69, which: 69, bubbles: true, cancelable: true }))`);
  await until(page, `location.search === '?still&edit' && !!window.BeesonEditor`);
  await page.waitFor(ready);
  assert.equal(await page.evaluate('location.hash'), '#/3');
  assert.equal(await page.evaluate('Reveal.getIndices().h'), 3);
  // in the editor, the key does nothing
  await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', keyCode: 69, which: 69, bubbles: true, cancelable: true }))`);
  await sleep(200);
  assert.equal(await page.evaluate('location.search'), '?still&edit');
  assert.deepEqual(page.errors, []);
});

test('Esc leaves a text and selects its block for the arrow keys, Tab reaches a figure, and a dragged figure snaps to the edge of a block with a guide', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  await page.evaluate(`(() => { const img = document.querySelector('.reveal .slides section .zone > img'); Reveal.slide(Reveal.getIndices(img.closest('section')).h); })()`);
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
  assert.deepEqual(await page.evaluate(`(() => { const h = document.querySelector('.beeson-handle'); return { focused: document.activeElement === h, role: h.getAttribute('role'), label: h.getAttribute('aria-label') }; })()`), { focused: true, role: 'button', label: 'Move the block: the arrow keys nudge it, Enter puts it back' });
  await page.evaluate(`document.querySelector('.beeson-handle').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))`);
  assert.equal(await page.evaluate(`document.querySelector('.reveal section.present p').style.translate`), '');
  await key('Escape');
  assert.equal(await selected(), false);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), deckText);
  // a figure is in the tab order, and the focus selects it
  const figure = await page.evaluate(`(() => { const f = document.querySelector('.reveal section.present .zone'); f.focus(); return { tabindex: f.getAttribute('tabindex'), label: f.getAttribute('aria-label'), focused: document.activeElement === f, selected: !document.querySelector('.beeson-frame.selected').hidden, imgInOrder: document.querySelector('.reveal section.present .zone > img').hasAttribute('tabindex') }; })()`);
  assert.deepEqual(figure, { tabindex: '0', label: 'Figure: the arrow keys move it, Esc deselects it', focused: true, selected: true, imgInOrder: false });
  await key('ArrowLeft');
  assert.equal(await page.evaluate(`document.querySelector('.reveal section.present .zone').style.translate`), '-1px');
  await key('Escape');
  assert.deepEqual(await page.evaluate(`({ selected: !document.querySelector('.beeson-frame.selected').hidden, focused: document.activeElement === document.querySelector('.reveal section.present .zone') })`), { selected: false, focused: false });
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), deckText);
  // the figure dragged to 5 px from the left edge of the paragraph snaps to it, with a guide at the
  // edge while it is dragged, and with Alt it stays where it is dropped
  const drag = (alt) => page.evaluate(`(() => {
    const img = document.querySelector('.reveal section.present .zone > img'); const zone = img.closest('.zone'); const p = document.querySelector('.reveal section.present p');
    const z = zone.getBoundingClientRect(), pr = p.getBoundingClientRect(), r = img.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const at = (type, cx, cy) => document.elementFromPoint(cx, cy).dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, pointerId: 1, altKey: ${alt} }));
    const dx = pr.left + 5 - z.left;
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
  const line = '  <aside class="notes">New notes.</aside>\n';
  assert.equal(rendered.replace(line, ''), deckText);
  // the notes are written into the second slide
  assert.equal(rendered.slice(0, rendered.indexOf(line)).split('<section').length - 1, 2);
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

test('an undo puts the caret at the change, and ⌘B and ⌘I write strong and em', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  const render = () => page.evaluate('window.BeesonEditor.render()');
  const h2 = 'Period of the families';
  await page.evaluate(`(() => {
    const h = [...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === ${JSON.stringify(h2)});
    Reveal.slide(Reveal.getIndices(h.closest('section')).h);
    h.focus();
    const r = document.createRange(); r.setStart(h.firstChild, 6); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    document.execCommand('insertText', false, 'X');
  })()`);
  const caret = () => page.evaluate(`(() => { const s = getSelection(); const h = document.activeElement; const r = document.createRange(); r.setStart(h, 0); r.setEnd(s.anchorNode, s.anchorOffset); return [h.textContent, r.toString().length]; })()`);
  await page.evaluate('window.BeesonEditor.undo()');
  assert.deepEqual(await caret(), [h2, 6]);
  await page.evaluate('window.BeesonEditor.redo()');
  assert.deepEqual(await caret(), ['PeriodX of the families', 7]);
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await render(), deckText);
  // a word of a list item is made bold and italic, and the selection is kept
  const li = [...deckText.matchAll(/<li>([A-Za-z][^<\\&]+)<\/li>/g)].find((m) => deckText.split(m[0]).length === 2);
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
  assert.equal(await render(), replaced(li[0], li[0].replace(word, `<strong>${word}</strong>`)));
  assert.equal(await format('formatItalic'), word);
  assert.equal(await render(), replaced(li[0], li[0].replace(word, `<strong><em>${word}</em></strong>`)));
  // a second Cmd+B takes the bold off again
  await format('formatBold');
  assert.equal(await render(), replaced(li[0], li[0].replace(word, `<em>${word}</em>`)));
  await page.evaluate('window.BeesonEditor.undo()');
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await render(), replaced(li[0], li[0].replace(word, `<strong>${word}</strong>`)));
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

test('a step is inserted before the others as one entry of the history, and a formula is listed by its TeX in the Steps pane', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  await page.evaluate(`(() => { const img = document.querySelector('.reveal .slides section .zone > img'); Reveal.slide(Reveal.getIndices(img.closest('section')).h); })()`);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Steps').click()`);
  await sleep(300);
  const values = () => page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .row select')].map((s) => s.value)`);
  const pick = (i, value) => page.evaluate(`(() => { const sel = document.querySelectorAll('.beeson-edit-side .row select')[${i}]; sel.value = ${value === undefined ? '[...sel.options].at(-1).value' : JSON.stringify(value)}; sel.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await pick(3);
  await pick(4);
  assert.deepEqual(await values(), ['', '', '', '0', '1', '']);
  const before = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .row select')[2].options].map((o) => [o.value, o.textContent])`);
  assert.deepEqual(before[1], ['before', 'Step 1, new, before the others']);
  await pick(2, 'before');
  assert.deepEqual(await values(), ['', '', '0', '1', '2', '']);
  let expected = replaced('<li>Export one file per mode and mark them <code>for-dark</code> and <code>for-light</code>.</li>', '<li class="fragment" data-fragment-index="1">Export one file per mode and mark them <code>for-dark</code> and <code>for-light</code>.</li>');
  expected = expected.replace('<li>Give a white raster figure the class <code>paper</code> to frame it.</li>', '<li class="fragment" data-fragment-index="2">Give a white raster figure the class <code>paper</code> to frame it.</li>');
  expected = expected.replace('<li>Give a black-on-white line plot the class <code>invert</code> to invert it in dark mode.</li>', '<li class="fragment" data-fragment-index="3">Give a black-on-white line plot the class <code>invert</code> to invert it in dark mode.</li>');
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), expected);
  // one undo takes the new step away and puts the other steps back
  await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true }))`);
  assert.deepEqual(await values(), ['', '', '', '0', '1', '']);
  // a display formula is listed by its TeX, and an inline formula is shown in place in its item
  await page.evaluate(`(() => { const c = document.querySelector('.reveal .slides .math mjx-container'); Reveal.slide(Reveal.getIndices(c.closest('section')).h); })()`);
  await sleep(300);
  const texts = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .row')].map((r) => [r.querySelector('.kind').textContent, r.querySelector('.text').textContent])`);
  const formulas = texts.filter(([kind]) => kind === 'Formula').map(([, text]) => text);
  assert.equal(formulas.length, 2);
  assert.ok(formulas[0].startsWith('\\ddot x - 2\\dot y = \\frac{\\partial U}'), formulas[0]);
  assert.ok(formulas[1].startsWith('U = \\frac{x^2 + y^2}{2}'), formulas[1]);
  const item = texts.find(([kind, text]) => kind === 'Item' && text.startsWith('At a given'));
  assert.ok(item && item[1].startsWith('At a given Jacobi constant C = 2U - v^2, the motion'), JSON.stringify(texts));
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
    return { pane: window.BeesonEditor.status().pane, aside: a.width, reveal: reveal.width, left: a.left, revealLeft: reveal.left, textLeft: text.left, paneLeft: pane.left, hit: !!hit && aside.contains(hit) };
  })()`);
  assert.equal(result.pane, 500);
  assert.ok(Math.abs(result.aside - result.reveal) < 2, `the notes are ${result.aside} px wide in a pane of ${result.reveal} px`);
  assert.ok(Math.abs(result.left - result.revealLeft) < 2, JSON.stringify(result));
  assert.ok(result.textLeft - result.paneLeft >= 0 && result.textLeft - result.paneLeft < 40, JSON.stringify(result));
  assert.equal(result.hit, true, 'the notes at the left of the pane are clipped');
  assert.deepEqual(page.errors, []);
});

test('Shift locks a drag to one axis, a run of nudges is one undo, and the offset is shown while the element moves', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  assert.deepEqual((await page.evaluate(openDeck)).problems, []);
  await page.evaluate(`(() => { const img = document.querySelector('.reveal .slides section .zone > img'); Reveal.slide(Reveal.getIndices(img.closest('section')).h); })()`);
  await sleep(200);
  const translate = () => page.evaluate(`document.querySelector('.reveal section.present .zone').style.translate`);
  // a drag by 60 by 20 slide pixels with Shift. with alt true, the figure does not snap
  const drag = (alt) => page.evaluate(`(() => {
    const img = document.querySelector('.reveal section.present .zone > img');
    const r = img.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const at = (type, cx, cy) => document.elementFromPoint(cx, cy).dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, pointerId: 1, shiftKey: true, altKey: ${alt} }));
    const scale = Reveal.getScale();
    const label = () => document.querySelector('.beeson-offset');
    at('pointermove', x, y);
    at('pointerdown', x, y);
    at('pointermove', x + 30 * scale, y + 10 * scale);
    at('pointermove', x + 60 * scale, y + 20 * scale);
    const zone = img.closest('.zone'), z = zone.getBoundingClientRect(), l = label()?.getBoundingClientRect();
    const during = { shown: !!label() && !label().hidden, text: label()?.textContent, lowerRight: !!l && l.top >= z.bottom && Math.abs(l.right - z.right - 6) < 1 };
    at('pointerup', x + 60 * scale, y + 20 * scale);
    return { during, after: label()?.hidden, translate: zone.style.translate };
  })()`);
  const locked = await drag(true);
  assert.deepEqual(locked, { during: { shown: true, text: '60, 0', lowerRight: true }, after: true, translate: '60px' });
  await page.evaluate(`document.querySelector('.beeson-handle').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
  // without Alt the figure may snap along the free axis, but not off the locked one
  const snapped = await drag(false);
  assert.match(snapped.translate, /^-?\d+px$/);
  await page.evaluate(`document.querySelector('.beeson-handle').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
  assert.equal(await translate(), '');
  // five nudges in a run are one entry of the history, and the offset is shown while they last
  const key = (k) => page.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true, cancelable: true }))`);
  for (let i = 0; i < 5; i++) await key('ArrowRight');
  assert.equal(await translate(), '5px');
  assert.deepEqual(await page.evaluate(`(() => { const l = document.querySelector('.beeson-offset'); return { shown: !l.hidden, text: l.textContent }; })()`), { shown: true, text: '5, 0' });
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
