// the findings of round 1 of the council on the shell, the navigator, and the place of an insert,
// on both platforms: the scroll bars of a zoomed canvas, the inspector at the start, the View and
// Zoom popups of the toolbar, the numbers and the skipped slides of the navigator, the outline
// view, the popover of Add Slide, the place of a new text box and QR code, the keyboard sheet, the
// history after an empty box, Paste Style on a step, and the brand images of the thumbnails. each
// edit is checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { center, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];

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
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

// the editor on a deck served over HTTP, with the storage of the origin emptied first, or with
// keep the storage of the page before, and with slide n shown
async function load(t, platform, { deck = LAYOUTS, n = 0, size = { width: 1600, height: 1000 }, scheme, keep = false } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  if (scheme) await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  if (!keep) {
    await page.goto(`${server.origin}/theme/beeson.css`);
    await page.evaluate('localStorage.clear()');
  }
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
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
  const { text } = await saveAndReopen(page, `shell-r3-8-${++saves}.html`);
  assert.equal(text, edited);
}

for (const platform of PLATFORMS) {
  test(`a light thumbnail of a closing slide on a page under test/pages loads the lockup of brand/ (${platform})`, async (t) => {
    const page = await load(t, platform);
    if ((await page.evaluate('Beeson.theme.get()')) !== 'light') await page.evaluate('Beeson.theme.toggle()');
    const closing = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.classList.contains('closing'))`);
    await page.evaluate(`document.querySelectorAll('.beeson-edit-nav .row')[${closing}].scrollIntoView()`);
    await sleep(1200);
    const url = await page.evaluate(`(() => {
      const pic = document.querySelectorAll('.beeson-edit-nav .row')[${closing}].querySelector('.pic');
      const s = pic.shadowRoot?.querySelector('section.closing');
      return s ? getComputedStyle(s, '::before').backgroundImage : null;
    })()`);
    assert.match(url ?? '', /\/brand\/lockup-light\.png/);
    assert.doesNotMatch(url, /test\/pages\/brand/);
    assert.deepEqual(errors(page), []);
  });
}

// the whole text of the first shown element of the current slide matched by selector with has in
// its text is selected, with the focus in its block
const selectAll = (page, selector, has) =>
  page.evaluate(`(() => {
    const el = [...document.querySelectorAll('.reveal section.present ' + ${JSON.stringify(selector)})].find((e) => e.textContent.includes(${JSON.stringify(has)}));
    el.closest('[contenteditable="true"]')?.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    return true;
  })()`);

const slideOf = (page, heading) => page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('h2')?.textContent.includes(${JSON.stringify(heading)}))`);

for (const platform of PLATFORMS) {
  test(`Paste Style reads the style of a paragraph that is a step and sets a style on it (${platform})`, async (t) => {
    const page = await load(t, platform);
    await page.evaluate(`Reveal.slide(${await slideOf(page, 'Math, an ordered list')})`);
    await frames(page);
    // from a step: the body style of the paragraph makes a paragraph of a list item
    await selectAll(page, 'p.fragment', 'Coriolis');
    await exec(page, 'text.copyStyle');
    await selectAll(page, 'li', 'A first step');
    await exec(page, 'text.pasteStyle');
    await frames(page);
    const item = await render(page);
    assert.ok(!item.includes('<li class="fragment" data-fragment-index="3">A first step</li>'), 'the list item is not made a paragraph');
    assert.match(item, /<p[^>]*>A first step<\/p>/);
    assert.ok(!/class="[^"]*\b(visible|current-fragment)\b/.test(item), 'a class of reveal.js is written');
    await undoRedo(page, page.source, item);
    await undo(page);
    await sleep(100);
    // onto a step: the small style of a paragraph is set on the paragraph of the step
    await selectAll(page, 'p', 'The lead-in');
    await exec(page, 'text.style.small');
    await frames(page);
    const small = await render(page);
    await exec(page, 'text.copyStyle');
    await selectAll(page, 'p.fragment', 'Coriolis');
    await exec(page, 'text.pasteStyle');
    await frames(page);
    const edited = await render(page);
    assert.match(edited, /<p class="(fragment small|small fragment)" data-fragment-index="2" data-highlight="coriolis">where the/);
    assert.ok(!/class="[^"]*\b(visible|current-fragment)\b/.test(edited), 'a class of reveal.js is written');
    await undoRedo(page, small, edited);
    await savedAs(page, edited);
    assert.deepEqual(errors(page), []);
  });
}

const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const PENDING = `document.querySelector('.reveal section.present .beeson-pending')`;

for (const platform of PLATFORMS) {
  for (const [id, label] of [['insert.text', 'Text Box'], ['insert.code', 'Code Box'], ['insert.footnote', 'Footnote']]) {
    test(`an empty ${label} that is left is taken out of the history, without a Redo (${platform})`, async (t) => {
      // slide 4 does not have a footnote
      const page = await load(t, platform, { n: 4 });
      // an edit before the insert stays the entry of Undo
      await exec(page, 'slide.hide');
      await frames(page);
      const hidden = await render(page);
      const undoBefore = (await state(page, 'edit.undo')).label;
      await exec(page, id);
      await frames(page);
      assert.equal((await state(page, 'edit.undo')).label, `Undo ${label}`);
      await press(page, 'Escape');
      await sleep(150);
      assert.equal(await page.evaluate(`!!${PENDING}`), false, 'the empty box is on the slide');
      assert.equal((await state(page, 'edit.redo')).enabled, false, `the history offers ${(await state(page, 'edit.redo')).label}`);
      assert.equal((await state(page, 'edit.undo')).label, undoBefore);
      assert.equal(await render(page), hidden);
      await undo(page);
      await sleep(100);
      assert.equal(await render(page), page.source);
      assert.deepEqual(errors(page), []);
    });
  }
}
