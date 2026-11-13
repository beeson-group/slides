// the navigator and the commands of the slides and of the elements: thumbnails with the numbers of
// the theme, the selection of several slides, a new slide from the keys and from the gallery,
// duplicate, delete, hide, move by keys and by a drag, and copy and paste, each with trusted input
// on either platform. after each edit an undo gives the file byte for byte, a redo gives the edit,
// and a save is opened again without problems

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { LAYOUTS, NEW_LAYOUTS, layoutText, textStyle } from '../src/editor/model/templates.ts';
import { byteExact, click, drag, press, saveAndReopen, selectFigure } from './helpers/editor.mjs';

const LAYOUTS_DECK = 'test/pages/editor-layouts.html';

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

// the editor on a deck served over HTTP, where a save is written into the origin private file
// system, with every block paired with the file
async function open(platform, deck = 'index.html') {
  const page = await browser.newPage();
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  return page;
}

// what the rows show, in the order of the list
const rows = (page) =>
  page.evaluate(`[...document.querySelectorAll('.beeson-edit-nav .row')].map((r) => ({
    no: r.querySelector('.no').textContent,
    title: r.querySelector('.title').textContent,
    skip: r.classList.contains('skip'),
    dots: !r.querySelector('.dots').hidden,
    selected: r.getAttribute('aria-selected') === 'true',
    current: r.getAttribute('aria-current') === 'true',
  }))`);

// the center of row i, scrolled into view unless scroll is false
const row = async (page, i, scroll = true) =>
  page.evaluate(`(() => {
    const r = document.querySelectorAll('.beeson-edit-nav .row')[${i}];
    if (${scroll}) r.scrollIntoView({ block: 'center' });
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  })()`);

// a click on row i of the navigator, made again until row i is the current one. at a paint of the
// navigator, the row of the current slide is scrolled into view. with a paint between the reading
// of the place of row i and the click, the rows are moved under the click
async function pick(page, i) {
  for (let n = 0; n < 3; n++) {
    await settle(page);
    await click(page, await row(page, i));
    await settle(page);
    if ((await rows(page))[i].current) return;
  }
  assert.fail(`row ${i} of the navigator is not the current one after three clicks`);
}

const titles = async (page) => (await rows(page)).map((r) => r.title);
const settle = (page) => page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(window.BeesonEditor.status()))))');

// the edited text, the file again after the undos, the edit again after the redos, and a save
// opened again without problems
// the errors of the page, apart from the request of a favicon, which the server does not have
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

let saves = 0;
async function roundTrip(page, undos = 1) {
  const edited = await page.evaluate('window.BeesonEditor.render()');
  assert.notEqual(edited, page.source, 'the edit did not change the text');
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  assert.equal((await settle(page)).undo, false, `the edit is more than ${undos} entries of the history`);
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), edited);
  const { text } = await saveAndReopen(page, `saved-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  // the saved text is the file from here on, with a fresh history
  page.source = text;
  return edited;
}

// the text of the slide whose heading is heading, from its start tag to its end tag
function slideText(source, heading) {
  const at = source.indexOf(heading);
  const start = source.lastIndexOf('<section', at);
  const end = source.indexOf('</section>', at) + '</section>'.length;
  return source.slice(start, end);
}

test('the demo deck shows 13 thumbnails within 1 s, numbered by their places, with a mark on a slide with steps', async (t) => {
  const page = await open('mac');
  t.after(() => page.close?.());
  const ms = await page.evaluate(`(async () => {
    const t0 = performance.now();
    const all = () => [...document.querySelectorAll('.beeson-edit-nav .pic')].filter((p) => p.dataset.drawn).length;
    while (all() < 13 && performance.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 10));
    return all() === 13 ? performance.now() - t0 : null;
  })()`);
  assert.ok(ms !== null && ms < 1000, `the thumbnails were drawn in ${ms} ms`);
  const drawn = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-nav .pic')].map((p) => p.shadowRoot?.querySelector('section h1, section h2')?.textContent ?? null)`);
  assert.equal(drawn.length, 13);
  assert.equal(drawn[2], 'Show your steps one at a time');
  const list = await rows(page);
  assert.deepEqual(
    list.map((r) => r.no),
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'],
  );
  const stepped = await page.evaluate(`window.Reveal.getSlides().map((s) => !!s.querySelector('.fragment'))`);
  assert.deepEqual(
    list.map((r) => r.dots),
    stepped,
  );
  assert.ok(stepped.includes(true) && stepped.includes(false));
  // a thumbnail is drawn again after a change of its slide
  const before = await page.evaluate(`document.querySelectorAll('.beeson-edit-nav .pic')[3].dataset.drawn`);
  await page.evaluate(`window.Reveal.getSlides()[3].querySelector('h2').append(' again')`);
  await page.waitFor(`document.querySelectorAll('.beeson-edit-nav .pic')[3].dataset.drawn !== ${JSON.stringify(before)}`);
  assert.match(await page.evaluate(`document.querySelectorAll('.beeson-edit-nav .pic')[3].shadowRoot.querySelector('h2').textContent`), /again$/);
  assert.deepEqual(errors(page), []);
});

test('the slides after the closing slide are numbered by their places, as in the status bar', async (t) => {
  const page = await open('mac', LAYOUTS_DECK);
  t.after(() => page.close?.());
  const list = await rows(page);
  assert.equal(list.at(-1).no, String(list.length));
  assert.equal(list.at(-2).no, String(list.length - 1));
  assert.deepEqual(errors(page), []);
});

for (const platform of ['mac', 'other']) {
  const mod = platform === 'mac' ? 'Meta' : 'Ctrl';

  test(`Return in the navigator adds a content slide after the current one, with the caret in its heading (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await click(page, await row(page, 2));
    await press(page, 'Enter');
    await settle(page);
    assert.equal((await rows(page)).length, 14);
    const caret = await page.evaluate(`(() => {
      const s = window.getSelection();
      const h = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('h2');
      return { inH2: !!h && h.textContent === '', index: window.Reveal.getSlides().indexOf(h?.closest('section')), focused: document.activeElement === h };
    })()`);
    assert.deepEqual(caret, { inH2: true, index: 3, focused: true });
    const edited = await page.evaluate('window.BeesonEditor.render()');
    const template = layoutText('content', textStyle(page.source));
    const end = slideText(page.source, 'Show your steps one at a time');
    const at = page.source.indexOf(end) + end.length;
    assert.equal(edited.slice(0, at), page.source.slice(0, at));
    const added = edited.slice(at, at + edited.length - page.source.length);
    assert.equal(added.trimStart(), template);
    assert.match(added.slice(0, added.length - template.length), /^\s+$/);
    assert.equal(edited.slice(at + added.length), page.source.slice(at));
    await roundTrip(page);
  });

  test(`each of the eight layouts is added from the gallery (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await click(page, await row(page, 4));
    for (const [i, layout] of LAYOUTS.entries()) {
      await page.evaluate(`window.BeesonEditor.exec('slide.gallery')`);
      assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-edit-gallery .tile .pic').length`), NEW_LAYOUTS.length);
      await click(page, `.beeson-edit-gallery .tile[data-layout="${layout}"]`);
      await settle(page);
      assert.equal(await page.evaluate(`!!document.querySelector('.beeson-edit-gallery')`), false);
      const current = await page.evaluate(`(() => { const s = window.Reveal.getCurrentSlide(); return { index: window.Reveal.getSlides().indexOf(s), cls: s.className.split(' ').filter((c) => ${JSON.stringify(LAYOUTS)}.includes(c)) }; })()`);
      assert.deepEqual(current, { index: 5 + i, cls: layout === 'content' ? [] : [layout] }, layout);
      assert.ok((await page.evaluate('window.BeesonEditor.render()')).includes(layoutText(layout, textStyle(page.source))), layout);
    }
    await roundTrip(page, LAYOUTS.length);
  });

  test(`Mod+D duplicates a slide with a suffix on each id and the same data-id (${platform})`, async (t) => {
    const page = await open(platform, LAYOUTS_DECK);
    t.after(() => page.close?.());
    const names = await titles(page);
    const glide = names.indexOf('A glide');
    const plot = names.indexOf('A plot in a zone');
    await click(page, await row(page, glide));
    await press(page, 'Mod+D');
    await settle(page);
    assert.equal((await titles(page))[glide + 1], 'A glide');
    let edited = await page.evaluate('window.BeesonEditor.render()');
    const original = slideText(page.source, '<h2>A glide</h2>');
    assert.equal(edited.split(original).length, 3, 'the copy is not the slide byte for byte');
    await roundTrip(page);
    await click(page, await row(page, plot));
    await press(page, 'Mod+D');
    await settle(page);
    edited = await page.evaluate('window.BeesonEditor.render()');
    assert.ok(edited.includes('data-plot="zone-plot-1"') && edited.includes('id="zone-plot-1"'), 'the id of the copy has no suffix');
    assert.equal(edited.split('id="zone-plot"').length, 2);
    await roundTrip(page);
  });

  test(`Backspace deletes a slide with the comment above it (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await click(page, await row(page, 2));
    await press(page, 'Backspace');
    await settle(page);
    assert.equal((await rows(page)).length, 12);
    const edited = await page.evaluate('window.BeesonEditor.render()');
    assert.ok(!edited.includes('Show your steps one at a time'));
    assert.ok(!edited.includes('<!-- content, the default layout'), 'the comment above the slide is kept');
    assert.equal(await page.evaluate(`window.Reveal.getCurrentSlide().querySelector('h2').textContent`), 'Equations are first class citizens');
    await roundTrip(page);
  });

  test(`Alt+ArrowDown moves a section slide, and the running heads and the outlines follow (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    const run = (i) => page.evaluate(`window.Reveal.getSlides()[${i}].querySelector('.run')?.textContent ?? null`);
    assert.equal(await run(7), 'Chapter two');
    await click(page, await row(page, 6));
    await press(page, 'Alt+ArrowDown');
    await settle(page);
    const names = await titles(page);
    assert.deepEqual(names.slice(5, 8), ['Code boxes, you guessed it...', 'Explain concepts, visually', 'Chapter two']);
    assert.equal(await run(6), 'Chapter one');
    assert.equal(await run(8), 'Chapter two');
    assert.equal(await page.evaluate(`document.activeElement.closest('.beeson-edit-nav .row')?.querySelector('.title').textContent`), 'Chapter two');
    const edited = await roundTrip(page);
    assert.ok(edited.indexOf('Explain concepts, visually') < edited.indexOf('Chapter two'));
    // the comment above the section slide moved with it
    assert.ok(edited.indexOf('Explain concepts, visually') < edited.indexOf('<!-- a second section slide'));
  });

  test(`a drag in the navigator moves a slide, with an insertion line (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    const to = await row(page, 5);
    const from = await row(page, 6, false);
    const dy = to.y - from.y - 20;
    await drag(page, from, { dy, hold: true });
    assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('.beeson-edit-nav .drop')).display !== 'none'`), true);
    assert.equal(await page.evaluate(`!!document.querySelector('.beeson-edit-ghost')`), true);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: from.x, y: from.y + dy, button: 'left', clickCount: 1 });
    await settle(page);
    assert.deepEqual((await titles(page)).slice(4, 7), ['Figures are first class citizens, too', 'Chapter two', 'Code boxes, you guessed it...']);
    assert.equal(await page.evaluate(`window.Reveal.getSlides()[6].querySelector('.run').textContent`), 'Chapter two');
    assert.equal(await page.evaluate(`!!document.querySelector('.beeson-edit-ghost')`), false);
    await roundTrip(page);
  });

  test(`Hide writes data-visibility="hidden", and the hidden slide is a bar without a number (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await click(page, await row(page, 3));
    if (platform === 'mac') await press(page, 'Mod+Shift+H');
    else await page.evaluate(`window.BeesonEditor.exec('slide.hide')`);
    await settle(page);
    const list = await rows(page);
    assert.equal(list[3].skip, true);
    assert.deepEqual(
      list.map((r) => r.no),
      ['1', '2', '3', '', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
    );
    const edited = await page.evaluate('window.BeesonEditor.render()');
    const original = slideText(page.source, 'Equations are first class citizens');
    assert.ok(edited.includes(original.replace('<section>', '<section data-visibility="hidden">')));
    assert.equal(await page.evaluate(`window.BeesonEditor.state('slide.hide').label`), 'Show Slide');
    const file = page.source;
    await roundTrip(page);
    await page.evaluate(`window.BeesonEditor.exec('slide.hide')`);
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), file);
  });

  test(`three slides selected with Shift are moved, and deleted, as one entry (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await click(page, await row(page, 2));
    await click(page, await row(page, 4), { modifiers: 'Shift' });
    assert.deepEqual(
      (await rows(page)).map((r, i) => (r.selected ? i : -1)).filter((i) => i >= 0),
      [2, 3, 4],
    );
    await press(page, 'Alt+ArrowDown');
    await settle(page);
    assert.deepEqual((await titles(page)).slice(2, 6), ['Code boxes, you guessed it...', 'Show your steps one at a time', 'Equations are first class citizens', 'Figures are first class citizens, too']);
    await roundTrip(page);
    await click(page, await row(page, 7));
    await click(page, await row(page, 9), { modifiers: 'Shift' });
    await press(page, 'Backspace');
    await settle(page);
    assert.deepEqual((await titles(page)).slice(6), ['Chapter two', 'Embedding videos', 'Starting a video on a click', 'Thank you']);
    assert.equal((await rows(page)).length, 10);
    await roundTrip(page);
  });

  // on macOS, Ctrl with a click is a click of the right button, hence the toggle with Ctrl of
  // Windows and Linux is tested on those hosts
  test(`slides apart from each other, selected with the command modifier, are deleted as one entry (${platform})`, { skip: platform === 'other' && process.platform === 'darwin' }, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await click(page, await row(page, 2));
    await click(page, await row(page, 5), { modifiers: 'Mod' });
    await click(page, await row(page, 8), { modifiers: 'Mod' });
    assert.deepEqual(
      (await rows(page)).map((r, i) => (r.selected ? i : -1)).filter((i) => i >= 0),
      [2, 5, 8],
    );
    assert.equal(await page.evaluate(`window.BeesonEditor.state('slide.delete').label`), 'Delete Slides');
    await press(page, 'Delete');
    await settle(page);
    assert.equal((await rows(page)).length, 10);
    const edited = await page.evaluate('window.BeesonEditor.render()');
    for (const gone of ['Show your steps one at a time', 'Code boxes, you guessed it...', 'Color the terms and the marks']) assert.ok(!edited.includes(gone), gone);
    await roundTrip(page);
  });

  test(`a slide copied and pasted after the last one is written byte for byte (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    const key = (commands, keyName, code, keyCode) =>
      page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: keyName, code, windowsVirtualKeyCode: keyCode, modifiers: mod === 'Meta' ? 4 : 2, commands }).then(() => page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: keyCode, modifiers: mod === 'Meta' ? 4 : 2 }));
    await pick(page, 3);
    await key(['copy'], 'c', 'KeyC', 67);
    await pick(page, 12);
    await key(['paste'], 'v', 'KeyV', 86);
    await settle(page);
    const list = await rows(page);
    assert.equal(list.length, 14);
    assert.equal(list[13].title, 'Equations are first class citizens');
    assert.equal(list[13].no, '14');
    assert.equal(list[13].current, true);
    const copied = slideText(page.source, 'Equations are first class citizens');
    const closing = slideText(page.source, 'Thank you');
    const at = page.source.indexOf(closing) + closing.length;
    const edited = await page.evaluate('window.BeesonEditor.render()');
    assert.equal(edited, page.source.slice(0, at) + '\n\n' + copied + page.source.slice(at));
    await roundTrip(page);
  });

  test(`Delete removes a selected figure (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await click(page, await row(page, 4));
    await settle(page);
    await selectFigure(page, '.reveal .slides section.present figure.zone img.for-dark, .reveal .slides section.present figure.zone img');
    await settle(page);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('element.delete').enabled`), true);
    await press(page, 'Delete');
    await settle(page);
    assert.equal(await page.evaluate(`!!window.Reveal.getCurrentSlide().querySelector('figure')`), false);
    const figure = page.source.slice(page.source.lastIndexOf('\n', page.source.indexOf('<figure class="zone">')), page.source.indexOf('</figure>') + '</figure>'.length);
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source.replace(figure, ''));
    await roundTrip(page);
  });
}
