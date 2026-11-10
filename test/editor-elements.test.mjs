// the operations on the elements of a slide, driven with trusted input on either platform: cut,
// copy, paste, and duplicate of the selected elements, the copy by a drag with the copy modifier,
// and the Insert commands for a text box, a formula, a code box, a QR code, and a footnote. after
// each edit an undo gives the file byte for byte, a redo gives the edit, and a save is opened
// again without problems

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, center, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS_DECK = 'test/pages/editor-layouts.html';
const FIGURE = '<figure class="zone">';
// the index of the slide of the equations in index.html, without a zone or a footnote
const EQUATIONS = 3;

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

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const settle = (page) => page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(window.BeesonEditor.status()))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

// the editor on a deck served over HTTP, where a save is written into the origin private file
// system
async function open(platform, deck = 'index.html') {
  const page = await browser.newPage();
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  page.platform = platform;
  return page;
}

// the slide of index h shown, or the slide of the first element matched by selector
async function show(page, at) {
  const h = typeof at === 'number' ? at : await page.evaluate(`Reveal.getIndices(document.querySelector(${JSON.stringify(at)}).closest('section')).h`);
  await page.evaluate(`Reveal.slide(${h})`);
  await sleep(150);
}

// a copy or a cut event, as the browser sends it for the keys of the system, with a clipboard of the
// page, since the clipboard of the system is shared with the other tests run at the same time. the
// text put on it is kept in window.clipped
const clipEvent = (page, type) =>
  page.evaluate(`(() => {
    const data = new DataTransfer();
    (document.activeElement ?? document.body).dispatchEvent(new ClipboardEvent(${JSON.stringify(type)}, { clipboardData: data, bubbles: true, cancelable: true }));
    window.clipped = data.getData('text/plain');
  })()`);

// a paste event with text, as the browser sends it for ⌘V or Ctrl+V on the canvas
const pasteText = (page, text) =>
  page.evaluate(`(() => {
    const data = new DataTransfer();
    data.setData('text/plain', ${JSON.stringify(text)});
    (document.activeElement ?? document.body).dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  })()`);

const figureText = (source) => source.slice(source.indexOf(FIGURE), source.indexOf('</figure>') + '</figure>'.length);
const withTranslate = (text, t) => text.replace(FIGURE, `<figure class="zone" style="translate: ${t}">`);

// the edited text, the file after the undos, the edit after the redos, and a save opened again
let saves = 0;
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the edit did not change the text');
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  assert.equal((await settle(page)).undo, false, `the edit is more than ${undos} entries of the history`);
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `elements-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
}

for (const platform of ['mac', 'other']) {
  test(`a figure copied and pasted is written once more with translate 20 px larger, twice (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await show(page, '.reveal .slides figure.zone');
    await click(page, '.reveal section.present figure.zone img.for-dark');
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.copy').enabled`), true);
    await clipEvent(page, 'copy');
    const clipped = await page.evaluate('window.clipped');
    assert.ok(clipped.startsWith('<!--beeson-->'), 'the copy is not marked');
    await pasteText(page, clipped);
    await settle(page);
    const fig = figureText(page.source);
    assert.equal(await render(page), page.source.replace(fig, `${fig}\n  ${withTranslate(fig, '20px 20px')}`));
    // the copy is selected, and a second paste is put 20 px further
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal section.present figure.zone').length`), 2);
    await pasteText(page, clipped);
    await settle(page);
    assert.equal(await render(page), page.source.replace(fig, `${fig}\n  ${withTranslate(fig, '20px 20px')}\n  ${withTranslate(fig, '40px 40px')}`));
    await page.evaluate('window.BeesonEditor.undo()');
    await roundTrip(page);
  });

  test(`a figure pasted on another slide is put into the slide at the same offset (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await show(page, '.reveal .slides figure.zone');
    await click(page, '.reveal section.present figure.zone img.for-dark');
    await clipEvent(page, 'copy');
    const clipped = await page.evaluate('window.clipped');
    await show(page, EQUATIONS);
    await pasteText(page, clipped);
    await settle(page);
    const edited = await render(page);
    const slide = edited.slice(edited.indexOf('<h2>Equations are first class citizens'), edited.indexOf('</section>', edited.indexOf('<h2>Equations are first class citizens')));
    assert.ok(slide.includes(`${figureText(page.source)}\n  <aside class="notes">`), `the figure is not put before the notes of the slide:\n${slide}`);
    assert.equal(edited.split(FIGURE).length, page.source.split(FIGURE).length + 1, 'the copy is offset');
    await roundTrip(page);
  });

  test(`a figure cut is taken off the slide and put back by a paste (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await show(page, '.reveal .slides figure.zone');
    await click(page, '.reveal section.present figure.zone img.for-dark');
    await clipEvent(page, 'cut');
    await settle(page);
    const fig = figureText(page.source);
    assert.equal(await render(page), page.source.replace(`\n  ${fig}`, ''));
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Cut');
    await pasteText(page, await page.evaluate('window.clipped'));
    await settle(page);
    assert.equal(await render(page), page.source, 'the figure is not put back at its place');
    await page.evaluate('window.BeesonEditor.undo()');
    await roundTrip(page);
  });

  test(`Mod+D duplicates a selected figure with an offset, and a paragraph under itself (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await show(page, '.reveal .slides figure.zone');
    await click(page, '.reveal section.present figure.zone img.for-dark');
    await press(page, 'Mod+D');
    await settle(page);
    const fig = figureText(page.source);
    assert.equal(await render(page), page.source.replace(fig, `${fig}\n  ${withTranslate(fig, '20px 20px')}`));
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Duplicate');
    await roundTrip(page);
    // a paragraph, selected by its border, is put under itself by the layout, without an offset
    await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
    await show(page, '.reveal .slides figure.zone');
    const p = await page.evaluate(`(() => { const r = document.querySelector('.reveal section.present > p').getBoundingClientRect(); return { x: r.right + 3, y: (r.top + r.bottom) / 2 }; })()`);
    await click(page, p);
    await press(page, 'Mod+D');
    await settle(page);
    const para = '<p>Export your matplotlib figure with the styles of the template. It will show frameless.</p>';
    assert.equal(await render(page), page.source.replace(para, `${para}\n  ${para}`));
    assert.deepEqual(errors(page), []);
  });

  test(`a drag with the copy modifier leaves the figure and writes a copy where it is dropped (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await show(page, '.reveal .slides figure.zone');
    const copyKey = platform === 'mac' ? 'Alt' : 'Ctrl';
    await click(page, '.reveal section.present figure.zone img.for-dark');
    const scale = await page.evaluate('Reveal.getScale()');
    await drag(page, '.reveal section.present figure.zone img.for-dark', { dx: -200 * scale, dy: 100 * scale, modifiers: copyKey, hold: true });
    // during the drag the figure stays at its place, and the readout names the copy
    const during = await page.evaluate(`({ standin: !!document.querySelector('.beeson-standin'), copying: document.documentElement.classList.contains('beeson-copying'), readout: document.querySelector('.beeson-offset')?.textContent ?? '' })`);
    assert.deepEqual({ standin: during.standin, copying: during.copying }, { standin: true, copying: true });
    assert.match(during.readout, /^Copy/);
    const end = await center(page, '.reveal section.present figure.zone img.for-dark');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: end.x, y: end.y, button: 'left', clickCount: 1, modifiers: platform === 'mac' ? 1 : 2 });
    await sleep(300);
    await settle(page);
    const edited = await render(page);
    const fig = figureText(page.source);
    const m = edited.match(/<figure class="zone" style="translate: (-?\d+)px (-?\d+)px">/);
    assert.ok(m, 'the copy does not have an offset');
    assert.ok(Math.abs(Number(m[1]) + 200) <= 12 && Math.abs(Number(m[2]) - 100) <= 12, `the copy is at ${m[1]}, ${m[2]}`);
    assert.equal(edited, page.source.replace(fig, `${fig}\n  ${withTranslate(fig, `${m[1]}px ${m[2]}px`)}`), 'the figure is moved, or the copy is not after it');
    assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-standin').length`), 0);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Duplicate');
    await roundTrip(page);
  });

  test(`a drag without the copy modifier moves the figure (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await show(page, '.reveal .slides figure.zone');
    const free = platform === 'mac' ? 'Meta' : 'Alt';
    await click(page, '.reveal section.present figure.zone img.for-dark');
    const scale = await page.evaluate('Reveal.getScale()');
    await drag(page, '.reveal section.present figure.zone img.for-dark', { dx: -100 * scale, dy: 50 * scale, modifiers: free });
    await settle(page);
    assert.equal(await render(page), page.source.replace(FIGURE, withTranslate(FIGURE, '-100px 50px')));
    await roundTrip(page);
  });
}

test('a Ctrl-click on a selected figure with edit-platform=other deselects it without a copy', async (t) => {
  const page = await open('other');
  t.after(() => page.close?.());
  await show(page, '.reveal .slides figure.zone');
  await click(page, '.reveal section.present figure.zone img.for-dark');
  await click(page, '.reveal section.present figure.zone img.for-dark', { modifiers: 'Ctrl' });
  await settle(page);
  assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-frame.selected:not([hidden])').length`), 0);
  await byteExact(page);
});

// the text of the slide whose heading is h2 in text
const slideOf = (text, h2) => {
  const at = text.indexOf(h2);
  return text.slice(text.lastIndexOf('<section', at), text.indexOf('</section>', at));
};

test('a text box is a p after the last block of the column, with the caret in it, and an empty one is not written', async (t) => {
  const page = await open('mac');
  t.after(() => page.close?.());
  await show(page, '.reveal .slides figure.zone');
  await page.evaluate(`window.BeesonEditor.exec('insert.text')`);
  await settle(page);
  const pending = await page.evaluate(`(() => { const a = document.activeElement; return { tag: a.localName, prompt: getComputedStyle(a, '::before').content, after: a.previousElementSibling.localName, editable: a.isContentEditable }; })()`);
  assert.deepEqual(pending, { tag: 'p', prompt: '"Click to add text"', after: 'ul', editable: true });
  assert.equal(await render(page), page.source, 'the empty text box is written');
  assert.equal((await settle(page)).undo, false);
  // Esc leaves it, and it is taken off the slide
  await press(page, 'Escape');
  await settle(page);
  assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-pending').length`), 0);
  await page.evaluate(`window.BeesonEditor.exec('insert.text')`);
  await type(page, 'A new text');
  await sleep(100);
  await type(page, ' box');
  await settle(page);
  const ul = page.source.slice(page.source.indexOf('<ul style="translate: 0px 20px">'), page.source.indexOf('</ul>', page.source.indexOf('<ul style="translate: 0px 20px">')) + 5);
  assert.equal(await render(page), page.source.replace(ul, `${ul}\n  <p>A new text box</p>`));
  assert.equal(await page.evaluate(`document.activeElement.textContent`), 'A new text box');
  await roundTrip(page, 2);
});

test('a text box is put into the text column of each layout', async (t) => {
  const page = await open('other', LAYOUTS_DECK);
  t.after(() => page.close?.());
  const parents = {};
  const count = await page.evaluate(`document.querySelectorAll('.reveal .slides > section').length`);
  for (let h = 0; h < count; h++) {
    await show(page, h);
    await page.evaluate(`window.BeesonEditor.exec('insert.text')`);
    await type(page, `Text ${h}`);
    await settle(page);
    const where = await page.evaluate(`(() => { const p = document.activeElement; const s = p.closest('section'); return [s.className.split(' ').find((c) => ['title', 'section', 'narrow', 'wide', 'figure', 'split', 'closing'].includes(c)) ?? 'content', p.parentElement === s ? 'section' : p.parentElement.className]; })()`);
    parents[where[0]] = where[1];
  }
  assert.deepEqual(parents, { title: 'block', section: 'sec', content: 'section', narrow: 'section', wide: 'section', figure: 'section', split: 'panel', closing: 'block' });
  await roundTrip(page, count);
});

test('a formula is inserted with Mod+Alt+E, its TeX is applied, and a formula left empty is taken off', async (t) => {
  const page = await open('mac');
  t.after(() => page.close?.());
  await show(page, '.reveal .slides figure.zone');
  await press(page, 'Mod+Alt+E');
  await sleep(200);
  assert.equal(await page.evaluate(`!!document.querySelector('.beeson-math') && document.activeElement.localName`), 'textarea');
  await press(page, 'Escape');
  await sleep(300);
  await byteExact(page);
  assert.equal((await settle(page)).undo, false, 'the formula left empty is kept in the history');
  await page.evaluate(`window.BeesonEditor.exec('insert.formula')`);
  await sleep(200);
  await type(page, 'E = mc^2');
  // Apply is on once the preview of the TeX is typeset
  await sleep(400);
  await press(page, 'Mod+Enter');
  await sleep(500);
  const ul = page.source.slice(page.source.indexOf('<ul style="translate: 0px 20px">'), page.source.indexOf('</ul>', page.source.indexOf('<ul style="translate: 0px 20px">')) + 5);
  assert.equal(await render(page), page.source.replace(ul, `${ul}\n  <div class="math">\\[E = mc^2\\]</div>`));
  await roundTrip(page, 2);
});

test('Alt+= opens the TeX field of a new formula with edit-platform=other', async (t) => {
  const page = await open('other');
  t.after(() => page.close?.());
  await show(page, '.reveal .slides figure.zone');
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: '=', code: 'Equal', windowsVirtualKeyCode: 187, modifiers: 1 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: '=', code: 'Equal', windowsVirtualKeyCode: 187, modifiers: 1 });
  await sleep(200);
  assert.equal(await page.evaluate(`!!document.querySelector('.beeson-math')`), true);
  assert.deepEqual(errors(page), []);
});

test('a code box and a footnote are written at the first input, and a QR code is selected in the column', async (t) => {
  const page = await open('mac');
  t.after(() => page.close?.());
  await show(page, EQUATIONS);
  const h2 = '<h2>Equations are first class citizens';
  await page.evaluate(`window.BeesonEditor.exec('insert.code')`);
  assert.equal(await page.evaluate(`getComputedStyle(document.activeElement, '::before').content`), '"Click to add code"');
  await type(page, 'x = 1');
  await settle(page);
  assert.ok(slideOf(await render(page), h2).includes('<pre><code class="language-python">x = 1</code></pre>\n  <aside'), 'the code box is not after the last block');
  await press(page, 'Escape');
  await page.evaluate(`window.BeesonEditor.exec('insert.footnote')`);
  assert.equal(await page.evaluate(`getComputedStyle(document.activeElement, '::before').content`), '"Click to add a footnote"');
  await type(page, 'A note');
  await settle(page);
  assert.ok(slideOf(await render(page), h2).includes('<div class="foot">A note</div>\n  <aside'), 'the footnote is not before the notes');
  // a second Footnote puts the caret into the one of the slide
  await press(page, 'Escape');
  await page.evaluate(`window.BeesonEditor.exec('insert.footnote')`);
  assert.equal(await page.evaluate(`document.activeElement.className`), 'foot');
  await press(page, 'Escape');
  await page.evaluate(`window.BeesonEditor.exec('insert.qr')`);
  await settle(page);
  assert.ok(slideOf(await render(page), h2).includes('<pre><code class="language-python">x = 1</code></pre>\n  <div class="qr" data-qr="https://example.com"></div>'), 'the QR code is not after the last block');
  assert.equal(await page.evaluate(`!!document.querySelector('.reveal section.present .qr svg')`), true, 'the QR code is not drawn');
  assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.duplicate').enabled`), true);
  await roundTrip(page, 3);
});

test('a QR code is put into an empty zone', async (t) => {
  const page = await open('mac', LAYOUTS_DECK);
  t.after(() => page.close?.());
  await show(page, '.reveal .slides .split .zone video');
  // the zone of the split slide, emptied of its video
  await page.evaluate(`window.BeesonEditor.doc.remove(document.querySelector('.reveal section.present .zone video'))`);
  page.source = await render(page);
  await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  await show(page, '.reveal .slides .split .zone');
  await page.evaluate(`window.BeesonEditor.exec('insert.qr')`);
  await settle(page);
  assert.equal(await page.evaluate(`document.querySelector('.reveal section.present .zone > .qr') !== null`), true);
  await roundTrip(page);
});
