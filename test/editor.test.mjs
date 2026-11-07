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

test('the print view of the PDF and of PowerPoint does not load the editor', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await printView(page, deckUrl('index.html', 'print-pdf&still'));
  assert.equal(await page.evaluate(`!!document.querySelector('script[src$="editor.js"]') || 'BeesonEditor' in window`), false);
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

