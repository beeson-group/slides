// the fixes of R5.7 on both platforms: every key typed back to back into a new text box, code box,
// formula, and footnote lands, the Format Painter is dimmed in a code box, the running head of the
// Slide pane does not leave typeset items of MathJax behind, and a change of layout to Split fits
// the panel text of every slide changed. each edit of the file is checked byte for byte, after an
// undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, saveAndReopen } from './helpers/editor.mjs';

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

let last = null;

// the editor on the slide at index of a deck, served over HTTP
async function editor(platform, index = 2, deck = LAYOUTS, size) {
  await last?.close().catch(() => {});
  const page = await browser.newPage(size);
  last = page;
  await page.send('Page.bringToFront');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  await page.evaluate(`Reveal.slide(${index})`);
  await frames(page);
  return page;
}

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const wait = (page, ms) => page.evaluate(`new Promise((d) => setTimeout(() => d(true), ${ms}))`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const until = async (page, expr, ms = 3000) => {
  for (const end = Date.now() + ms; Date.now() < end; await wait(page, 50)) if (await page.evaluate(expr)) return true;
  return false;
};

let saves = 0;
async function saved(page) {
  const { text } = await saveAndReopen(page, `r5-7-${++saves}.html`);
  page.source = text;
  await byteExact(page);
  return text;
}

// the trusted key events of a text, with a newline sent as Enter, all sent over the DevTools
// protocol before the first one is handled
function burst(page, text) {
  const sent = [];
  for (const c of text) {
    const base = c === '\n'
      ? { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' }
      : { key: c, code: c === ' ' ? 'Space' : `Key${c.toUpperCase()}`, windowsVirtualKeyCode: c === ' ' ? 32 : c.toUpperCase().charCodeAt(0), text: c, unmodifiedText: c };
    sent.push(page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base }));
    sent.push(page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: base.key, code: base.code, windowsVirtualKeyCode: base.windowsVirtualKeyCode }));
  }
  return Promise.all(sent);
}

// undoes every entry down to the text of the deck, and redoes them all, back to the text edited
async function undoAll(page, source) {
  const text = await render(page);
  let n = 0;
  while ((await render(page)) !== source) {
    assert.ok(n++ < 20, 'the undo does not reach the text of the deck');
    await undo(page);
  }
  await byteExact(page);
  for (let i = 0; i < n; i++) await redo(page);
  assert.equal(await render(page), text);
}

// each new text written into the file by its first key, with the slide it is put on, the text
// typed, and a pattern of the elements that every key must reach in the file. Enter in a text box
// starts a new paragraph, as in an existing one, and in a footnote it starts a new line
const NEW_TEXTS = [
  { id: 'insert.code', slide: 5, keys: 'a\nbc\n\nd', written: /<pre><code class="language-python">a\nbc\n\nd\n?<\/code><\/pre>/ },
  { id: 'insert.text', slide: 2, keys: 'a\nbc d', written: /<p>a<\/p>\s*<p>bc d<\/p>/ },
  { id: 'insert.footnote', slide: 3, keys: 'a\nbc d', written: /<div class="foot">a<br>bc d<\/div>/ },
];

for (const platform of PLATFORMS) {
  for (const { id, slide, keys, written } of NEW_TEXTS) {
    test(`every key typed back to back into a new text of ${id} lands on ${platform}`, async () => {
      const page = await editor(platform, slide);
      const source = page.source;
      await exec(page, id);
      await frames(page);
      // the write of the new element is slowed as on a loaded machine, so that the keys after the
      // first one come while it is written
      await page.evaluate(`(() => { const t = MathJax.typesetPromise.bind(MathJax); MathJax.typesetPromise = (n) => new Promise((d) => setTimeout(d, 150)).then(() => t(n)); })()`);
      await burst(page, keys);
      await wait(page, 600);
      const text = await render(page);
      assert.match(text, written, `a key is lost: ${JSON.stringify(text.split('\n').filter((l) => !source.includes(l)))}`);
      await undoAll(page, source);
      await saved(page);
      assert.deepEqual(errors(page), []);
    });
  }

  test(`Enter at the end of a code box starts a new line of its code on ${platform}`, async () => {
    const page = await editor(platform, 5);
    const CODE = 'x = 1\ny = x + 1</code>';
    await page.evaluate(`(() => {
      const c = document.querySelector('.reveal section.present pre code');
      c.closest('[contenteditable="true"]').focus();
      const r = document.createRange();
      r.selectNodeContents(c);
      r.collapse(false);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
    })()`);
    await burst(page, '\nz');
    await wait(page, 200);
    await byteExact(page, [[CODE, 'x = 1\ny = x + 1\nz</code>']]);
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal section.present pre code').length`), 1);
    await undoAll(page, page.source);
    await saved(page);
    assert.deepEqual(errors(page), []);
  });

  test(`every key typed back to back after Insert > Formula reaches its TeX field on ${platform}`, async () => {
    const page = await editor(platform, 5);
    await exec(page, 'insert.formula');
    await burst(page, 'abc d');
    await wait(page, 300);
    const field = await page.evaluate(`(() => { const f = document.querySelector('.beeson-math textarea'); return f && { value: f.value, focused: f === document.activeElement }; })()`);
    assert.deepEqual(field, { value: 'abc d', focused: true });
    assert.deepEqual(errors(page), []);
  });

  // the keys come while the formula is written, before its TeX field is open, and D, which flips
  // the mode of the slide on the canvas, is a key of the TeX
  test(`every key typed while Insert > Formula writes its formula reaches its TeX field on ${platform}`, async () => {
    const page = await editor(platform, 5);
    const source = page.source;
    const dark = (await state(page, 'view.slideDark')).checked;
    await page.evaluate(`(() => { const t = MathJax.typesetPromise.bind(MathJax); MathJax.typesetPromise = (n) => new Promise((d) => setTimeout(d, 150)).then(() => t(n)); })()`);
    await page.evaluate(`void window.BeesonEditor.exec('insert.formula'), true`);
    await burst(page, 'abc d');
    assert.ok(await until(page, `!!document.querySelector('.beeson-math textarea')`), 'the TeX field does not open');
    await wait(page, 300);
    const field = await page.evaluate(`(() => { const f = document.querySelector('.beeson-math textarea'); return { value: f.value, focused: f === document.activeElement }; })()`);
    assert.deepEqual(field, { value: 'abc d', focused: true });
    assert.equal((await state(page, 'view.slideDark')).checked, dark, 'a key of the TeX flips the mode of the slide');
    await page.evaluate(`[...document.querySelectorAll('.beeson-math button')].find((b) => b.textContent === 'Insert').click()`);
    assert.ok(await until(page, `!document.querySelector('.beeson-math')`), 'the formula is not inserted');
    assert.match(await render(page), /<div class="math">\\\[abc d\\\]<\/div>/);
    await undoAll(page, source);
    await saved(page);
    assert.deepEqual(errors(page), []);
  });
}

// the caret put at the end of the first element at selector, or the whole text of it selected,
// with its block focused
const caretIn = (page, selector, whole = false) =>
  page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    el.closest('[contenteditable="true"]').focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    if (!${whole}) r.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    return true;
  })()`);
const painterOn = async (page) => (await state(page, 'text.formatPainter')).enabled;

for (const platform of PLATFORMS) {
  test(`the Format Painter is dimmed in a code box and live again in a text on ${platform}`, async () => {
    const page = await editor(platform, 5);
    const source = page.source;
    await caretIn(page, '.reveal section.present h2');
    await frames(page);
    assert.equal(await painterOn(page), true, 'the painter is dimmed in a heading');
    await caretIn(page, '.reveal section.present pre code');
    await frames(page);
    assert.equal(await painterOn(page), false, 'the painter is live with the caret in a code box');
    await caretIn(page, '.reveal section.present pre code', true);
    await frames(page);
    assert.equal(await painterOn(page), false, 'the painter is live with the code of a box selected');
    // Esc leaves the text of the code box and selects the box
    await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await frames(page);
    assert.equal(await page.evaluate(`document.activeElement?.closest?.('pre') ? 'text' : 'element'`), 'element');
    assert.equal(await painterOn(page), false, 'the painter is live with a code box selected');
    await caretIn(page, '.reveal section.present td');
    await frames(page);
    assert.equal(await painterOn(page), true, 'the painter is dimmed in a cell after a code box');
    // a painter armed in a text does not paint a code box
    await caretIn(page, '.reveal section.present h2', true);
    await exec(page, 'text.formatPainter');
    assert.equal((await state(page, 'text.formatPainter')).checked, true);
    await caretIn(page, '.reveal section.present pre code', true);
    await page.evaluate(`document.querySelector('.reveal section.present pre code').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))`);
    await wait(page, 100);
    assert.equal(await render(page), source, 'the painter wrote a style into a code box');
    assert.deepEqual(errors(page), []);
  });
}

// the typeset items in the list of MathJax, and those of them whose formula is off the page
const mathItems = (page) =>
  page.evaluate(`(() => { const items = Array.from(MathJax.startup.document.math); return { all: items.length, gone: items.filter((m) => !m.typesetRoot?.isConnected).length }; })()`);

for (const platform of PLATFORMS) {
  test(`the Slide pane rebuilt many times leaves no typeset items of MathJax behind on ${platform}`, async () => {
    const page = await editor(platform, 2);
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    const sel = '.beeson-edit-inspector .ed-sec .ed-note.running-head mjx-container';
    const shown = async () => assert.ok(await until(page, `!!document.querySelector(${JSON.stringify(sel)})`), 'the running head of the Slide pane is not typeset');
    await shown();
    const first = await mathItems(page);
    for (let k = 0; k < 12; k++) {
      await page.evaluate(`Reveal.slide(${k % 2 ? 2 : 3})`);
      await shown();
    }
    await page.evaluate('Reveal.slide(2)');
    await shown();
    await wait(page, 200);
    const now = await mathItems(page);
    assert.equal(now.gone, 0, `MathJax keeps ${now.gone} typeset items of running heads that are off the page`);
    assert.equal(now.all, first.all);
    assert.deepEqual(errors(page), []);
  });
}

// the center of the row of the navigator whose title starts with title
const rowOf = (page, title) =>
  page.evaluate(`(() => {
    const r = [...document.querySelectorAll('.beeson-edit-nav .row')].find((r) => r.querySelector('.title').textContent.startsWith(${JSON.stringify(title)}));
    r.scrollIntoView({ block: 'center' });
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  })()`);
const showSlide = (page, title) =>
  page.evaluate(`Reveal.slide(Reveal.getIndices([...document.querySelectorAll('.reveal section h2')].find((h) => h.textContent.startsWith(${JSON.stringify(title)})).closest('section')).h)`);

// the texts of the panel of the current slide that run past its bottom, and the texts marked by
// overflow.ts
const panelFit = (page) =>
  page.evaluate(`(() => {
    const panel = document.querySelector('.reveal section.present > .panel');
    if (!panel) return null;
    const p = panel.getBoundingClientRect();
    const out = [...panel.children].filter((el) => !el.matches('.foot, aside')).filter((el) => el.getBoundingClientRect().bottom > p.bottom + 1).map((el) => el.localName);
    return { out, marked: document.querySelectorAll('.reveal section.present .beeson-overflow').length };
  })()`);

// the text of the slide of a deck whose heading starts with title
const slideText = (text, title) => text.split('<section').find((t) => t.includes(`<h2>${title}`)) ?? null;

// four slides in a row selected with Shift, since a Ctrl click is a right click in Chrome on the
// Mac. the last is shown, and the first is more than two slides away from it, where reveal.js
// does not lay out a slide
const FOUR = ['Show your steps', 'Equations are first', 'Figures are first', 'Code boxes', 'Chapter two', 'Explain concepts', 'Color the terms'];

for (const platform of PLATFORMS) {
  test(`a change of layout to Split of slides selected in the navigator fits the panel text of each as on the slide shown on ${platform}`, async () => {
    // the text of each slide changed to Split alone, while it is shown
    const alone = {};
    for (const title of FOUR) {
      const page = await editor(platform, 0, 'index.html', { width: 1600, height: 1000 });
      await showSlide(page, title);
      await frames(page);
      await exec(page, 'slide.layout.split');
      await wait(page, 300);
      alone[title] = slideText(await render(page), title);
    }
    assert.ok(alone[FOUR[0]].includes('class="small"'), 'the text of the first slide is not shrunk in a panel');
    const page = await editor(platform, 0, 'index.html', { width: 1600, height: 1000 });
    await showSlide(page, FOUR.at(-1));
    await frames(page);
    assert.equal(await page.evaluate(`[...document.querySelectorAll('.reveal section h2')].find((h) => h.textContent.startsWith(${JSON.stringify(FOUR[0])})).getBoundingClientRect().height`), 0, 'the first slide is laid out');
    await click(page, await rowOf(page, FOUR.at(-1)));
    await click(page, await rowOf(page, FOUR[0]), { modifiers: 'Shift' });
    await frames(page);
    const picked = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-nav .row[aria-selected="true"] .title')].map((t) => t.textContent)`);
    assert.equal(picked.length, FOUR.length, `the navigator does not have the slides selected: ${JSON.stringify(picked)}`);
    const source = page.source;
    await exec(page, 'slide.layout.split');
    await wait(page, 300);
    const split = await render(page);
    for (const title of FOUR) assert.equal(slideText(split, title), alone[title], `the panel text of ${title} is not fit as on the slide shown`);
    await showSlide(page, FOUR[0]);
    await wait(page, 300);
    assert.deepEqual(await panelFit(page), { out: [], marked: 0 }, `a text runs past the bottom of the panel of ${FOUR[0]}`);
    // the fit is a part of the change of layout, undone and redone with it
    await undo(page);
    assert.equal(await render(page), source);
    await redo(page);
    assert.equal(await render(page), split);
    await saved(page);
    assert.deepEqual(errors(page), []);
  });
}
