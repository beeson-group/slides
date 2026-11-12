// regression tests of R32.2 on both platforms: a list made of a moved paragraph is moved as a whole,
// i.e. the translate and the width of the paragraph go on its ol or ul, and its items are written
// without them, also after Enter. the laptop test of round 10 saved a numbered list of twelve items
// typed into a new text box with style="translate: 0px 24px" on each item

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const SLIDE = '.reveal .slides > section.present';
const PANEL = '#beeson-edit-panel-format';
const DECK = 'index.html';
const MOVED = 'test/pages/editor-r32-2.html';

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
const sleep = (ms) => new Promise((d) => setTimeout(d, ms));
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const exec = (page, id) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)})).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);

// the editor on slide n of a deck, by default the demo deck, served over HTTP, with the storage of
// the origin emptied
async function load(t, platform, n, deck = DECK) {
  const source = readFileSync(deck, 'utf8');
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = source;
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(source)})`)).problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await sleep(150);
  return page;
}

// the boxes in slide px of the elements of the current slide that are drawn, by selector, keyed by
// their tag and first words, those of its first item for a list, rounded to 0.1 px
const boxes = (page, selector) => page.evaluate(`(() => {
  const slides = document.querySelector('.reveal .slides');
  const s = slides.getBoundingClientRect();
  const k = s.width / slides.offsetWidth;
  const r1 = (v) => Math.round(v * 10) / 10;
  const out = {};
  for (const el of document.querySelectorAll(${js(selector)})) {
    const r = el.getBoundingClientRect();
    if (!r.width || el.closest('[data-generated], .beeson-pending')) continue;
    const words = el.matches('ul, ol') ? el.querySelector('li')?.textContent ?? '' : el.textContent;
    out[el.localName + ' ' + words.trim().slice(0, 24)] = { left: r1((r.left - s.left) / k), top: r1((r.top - s.top) / k), width: r1(r.width / k) };
  }
  return out;
})()`);

// asserts that a list is drawn at the place of the paragraph that it is made of, i.e. with its left
// edge and its width, and with its top edge moved only by the margins of a list of the theme, which
// differ from those of a paragraph by 10 px
function samePlace(list, p, what) {
  assert.ok(list, `${what} is not drawn`);
  assert.deepEqual([list.left, list.width], [p.left, p.width], `${what} is not drawn at the left edge and with the width of the paragraph`);
  assert.ok(Math.abs(list.top - p.top) <= 10, `${what} is drawn ${list.top - p.top} px under the paragraph`);
}

// the lines of the rendered file that are not lines of the source
const added = (page, text) => {
  const old = new Set(page.source.split('\n'));
  return text.split('\n').filter((l) => !old.has(l));
};

// a new text box of the Text button on the current slide, with words typed into it
async function newBox(page, words) {
  await click(page, '.beeson-edit-top [data-command="insert.text"]');
  await sleep(300);
  await type(page, words);
  await sleep(250);
}

// the start tag of the new box, a p with the translate and the width of its place
async function boxTag(page) {
  const tags = added(page, await render(page)).filter((l) => l.includes('<p'));
  assert.equal(tags.length, 1, `the new box is not one paragraph: ${tags.join(' | ')}`);
  const tag = /<p[^>]*>/.exec(tags[0])[0];
  assert.match(tag, /^<p style="width: \d+px; translate: -?\d+px -?\d+px">$/, 'the new box is not written with a width and a translate');
  return tag;
}

// the lines of the rendered list of words, i.e. its start tag, its items, and its end tag
const listLines = (text, words) => {
  const lines = text.split('\n');
  const first = lines.findIndex((l) => l.includes(`>${words}`));
  let start = first;
  while (start > 0 && !/<(ol|ul)\b/.test(lines[start])) start--;
  let end = first;
  while (end < lines.length - 1 && !/<\/(ol|ul)>/.test(lines[end])) end++;
  return lines.slice(start, end + 1).map((l) => l.trim());
};

// items 1, 2, and 3 of the observation: the tester's flow, i.e. a new text box made a numbered list
// with Numbers of the Text pane, twelve items typed with Enter, and the last item emptied with
// Backspace. the list takes the place of the box, and its items are written without it
for (const platform of PLATFORMS) {
  test(`1: a new text box made a numbered list of twelve items by the Text pane is moved as a list, and its items are written without a translate (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    const others = await boxes(page, `${SLIDE} > *`);
    await newBox(page, 'item 1');
    const tag = await boxTag(page);
    const style = /style="([^"]*)"/.exec(tag)[1];
    const placed = (await boxes(page, `${SLIDE} > p`))['p item 1'];
    const typed = await render(page);
    await click(page, `${PANEL} [data-command="text.list.ol"]`);
    await frames(page);
    const listed = await render(page);
    assert.deepEqual(listLines(listed, 'item 1'), [`<ol style="${style}">`, '<li>item 1</li>', '</ol>'], 'the list does not take the place of the box');
    // the list is drawn where the box was, and the other elements of the slide keep their places
    const list = (await boxes(page, `${SLIDE} > ol`))['ol item 1'];
    samePlace(list, placed, 'the list');
    const kept = await boxes(page, `${SLIDE} > *`);
    for (const [k, v] of Object.entries(others)) assert.deepEqual(kept[k], v, `${k} is moved`);
    const headingBefore = await boxes(page, `${SLIDE} > h2`);
    // one undo gives the box back byte for byte, and a redo the list
    assert.equal((await state(page, 'edit.undo')).label, 'Undo List Style');
    await undo(page);
    await frames(page);
    assert.equal(await render(page), typed, 'the undo does not give the box back');
    await redo(page);
    await frames(page);
    assert.equal(await render(page), listed, 'the redo does not give the list back');
    // the caret is put back into the item for the typing that goes on
    await page.evaluate(`(() => { const li = document.querySelector(${js(`${SLIDE} > ol > li`)}); li.closest('[contenteditable="true"]')?.focus(); getSelection().collapse(li.firstChild, li.firstChild.data.length); })()`);
    for (let i = 2; i <= 12; i++) {
      await press(page, 'Enter');
      await type(page, `item ${i}`);
    }
    for (let i = 0; i < 'item 12'.length; i++) await press(page, 'Backspace');
    await sleep(300);
    const typedOut = await render(page);
    // the list keeps its left edge and its width, and its top edge moves with the heading of the
    // slide, whose column is centered by the theme
    const heading = await boxes(page, `${SLIDE} > h2`);
    const items = Array.from({ length: 11 }, (_, i) => `<li>item ${i + 1}</li>`);
    assert.deepEqual(listLines(typedOut, 'item 1'), [`<ol style="${style}">`, ...items, '<li></li>', '</ol>'], 'an item is written with a translate');
    const shift = Object.values(heading)[0].top - Object.values(headingBefore)[0].top;
    assert.deepEqual((await boxes(page, `${SLIDE} > ol`))['ol item 1'], { ...list, top: Math.round((list.top + shift) * 10) / 10 }, 'the list is moved by Enter');
    const { text } = await saveAndReopen(page, `r32-2-1-${platform}.html`);
    assert.equal(text, typedOut);
    assert.deepEqual(errors(page), []);
  });
}

// the same with Numbers of the Format menu chosen before the first key, as a typing style, and with
// Paragraphs of the Format menu, after which the box is written with its start tag again
for (const platform of PLATFORMS) {
  test(`1: Numbers chosen in a new text box before the first key makes a list moved as a whole, and Paragraphs gives the box back (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await click(page, '.beeson-edit-top [data-command="insert.text"]');
    await sleep(300);
    await exec(page, 'text.list.ol');
    await type(page, 'first');
    await sleep(250);
    await press(page, 'Enter');
    await type(page, 'second');
    await sleep(250);
    const text = await render(page);
    const lines = listLines(text, 'first');
    assert.match(lines[0], /^<ol style="width: \d+px; translate: -?\d+px -?\d+px">$/, 'the list is not moved as a whole');
    assert.deepEqual(lines.slice(1), ['<li>first</li>', '<li>second</li>', '</ol>'], 'an item is written with a translate');
    const style = /style="([^"]*)"/.exec(lines[0])[1];
    // Paragraphs on the list selected as a block gives each item the place of the list
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((e) => e.localName)'), ['ol']);
    await exec(page, 'text.list.none');
    await frames(page);
    const paragraphs = added(page, await render(page)).map((l) => l.trim());
    assert.deepEqual(paragraphs, [`<p style="${style}">first</p>`, `<p style="${style}">second</p>`], 'the paragraphs do not get the place of the list');
    await undo(page);
    await frames(page);
    assert.equal(await render(page), text, 'the undo does not give the list back');
    assert.deepEqual(errors(page), []);
  });
}

// item 1 of the observation: a text box selected as a block and made a list, and made a paragraph
// again, is written with the bytes of the box
for (const platform of PLATFORMS) {
  test(`1: a text box selected as a block, made a list and a paragraph again, is written byte for byte (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await newBox(page, 'moved words');
    const tag = await boxTag(page);
    const typed = await render(page);
    const placed = (await boxes(page, `${SLIDE} > p`))['p moved words'];
    await press(page, 'Escape');
    await frames(page);
    await exec(page, 'text.list.ul');
    await frames(page);
    const style = /style="([^"]*)"/.exec(tag)[1];
    assert.deepEqual(listLines(await render(page), 'moved words'), [`<ul style="${style}">`, '<li>moved words</li>', '</ul>']);
    samePlace((await boxes(page, `${SLIDE} > ul`))['ul moved words'], placed, 'the list');
    await exec(page, 'text.list.none');
    await frames(page);
    assert.equal(await render(page), typed, 'the paragraph is not written with the bytes of the box');
    assert.deepEqual(errors(page), []);
  });
}

// a paragraph with a translate in the file, made a list at the caret, and an item of a moved list
// made a paragraph at the caret, which takes the translate of the list
for (const platform of PLATFORMS) {
  test(`1: a paragraph with a translate in the file made a list at the caret gives its translate to the list, and an item made a paragraph takes it back (${platform})`, async (t) => {
    const page = await load(t, platform, 0, MOVED);
    const placed = (await boxes(page, `${SLIDE} > p`))['p A moved paragraph of wor'];
    const others = await boxes(page, `${SLIDE} > *`);
    await click(page, await page.evaluate(`(() => { const r = [...document.querySelectorAll(${js(`${SLIDE} > p`)})].find((p) => p.textContent.startsWith('A moved')).getBoundingClientRect(); return { x: r.right - 20, y: r.top + r.height / 2 }; })()`));
    await frames(page);
    await press(page, 'End');
    await exec(page, 'text.list.ol');
    await frames(page);
    const listed = await render(page);
    assert.deepEqual(listLines(listed, 'A moved paragraph of words.'), ['<ol style="translate: 0px 24px">', '<li>A moved paragraph of words.</li>', '</ol>']);
    const list = (await boxes(page, `${SLIDE} > ol`))['ol A moved paragraph of wor'];
    samePlace(list, placed, 'the list');
    // the paragraph after the list follows it by the margins of a list of the theme, and the
    // elements before it keep their places
    const kept = await boxes(page, `${SLIDE} > *`);
    for (const [k, v] of Object.entries(others)) {
      if (k.startsWith('p A moved')) continue;
      if (k.startsWith('p More words')) samePlace(kept[k], v, k);
      else assert.deepEqual(kept[k], v, `${k} is moved`);
    }
    await press(page, 'Enter');
    await type(page, 'Second');
    await sleep(250);
    assert.deepEqual(listLines(await render(page), 'A moved paragraph of words.'), ['<ol style="translate: 0px 24px">', '<li>A moved paragraph of words.</li>', '<li>Second</li>', '</ol>'], 'the new item is written with a translate');
    const second = (await boxes(page, `${SLIDE} li`))['li Second'];
    // Paragraphs at the caret in the second item takes it off the list, with the translate of the list
    await exec(page, 'text.list.none');
    await frames(page);
    const out = await render(page);
    assert.ok(out.includes('<p style="translate: 0px 24px">Second</p>'), 'the paragraph does not take the translate of the list');
    assert.equal((await boxes(page, `${SLIDE} > p`))['p Second'].top, second.top, 'the paragraph is not drawn at the height of the item');
    const { text } = await saveAndReopen(page, `r32-2-4-${platform}.html`);
    assert.equal(text, out);
    assert.deepEqual(errors(page), []);
  });
}

// item 3: a list whose items have a translate in the file is opened as it is, and Enter in it moves
// the translate of its items to the list, where every item keeps its place
for (const platform of PLATFORMS) {
  test(`3: items with a translate in the file are kept until the list is edited, and Enter writes it on the list (${platform})`, async (t) => {
    const page = await load(t, platform, 1, MOVED);
    assert.equal(await render(page), page.source, 'the list is changed by the open');
    const placed = await boxes(page, `${SLIDE} li`);
    await click(page, await page.evaluate(`(() => { const r = [...document.querySelectorAll(${js(`${SLIDE} li`)})].find((li) => li.textContent === 'Beta').getBoundingClientRect(); return { x: r.right - 10, y: r.top + r.height / 2 }; })()`));
    await frames(page);
    await press(page, 'End');
    await press(page, 'Enter');
    await type(page, 'Gamma');
    await sleep(250);
    const out = await render(page);
    assert.deepEqual(listLines(out, 'Alpha'), ['<ol style="translate: 0px 24px">', '<li>Alpha</li>', '<li>Beta</li>', '<li>Gamma</li>', '</ol>']);
    const now = await boxes(page, `${SLIDE} li`);
    for (const k of ['li Alpha', 'li Beta']) assert.deepEqual(now[k], placed[k], `${k} is moved`);
    assert.equal(now['li Gamma'].left, placed['li Beta'].left, 'the new item is not under the item before it');
    // the undo of the typing and of Enter gives the file back byte for byte, and the redo the list
    await undo(page);
    await undo(page);
    await frames(page);
    assert.equal(await render(page), page.source, 'the undo does not give the items their translate back');
    await redo(page);
    await redo(page);
    await frames(page);
    assert.equal(await render(page), out, 'the redo does not give the list back');
    const { text } = await saveAndReopen(page, `r32-2-5-${platform}.html`);
    assert.equal(text, out);
    assert.deepEqual(errors(page), []);
  });
}

// item 2: the moved list of slide 5 selected as a block and made paragraphs gives each paragraph
// its translate, and the paragraphs are one text, which Dashes over all of them makes the list
// again, byte for byte
for (const platform of PLATFORMS) {
  test(`2: a moved list made paragraphs gives each its translate, and Dashes over them gives the list back byte for byte (${platform})`, async (t) => {
    const page = await load(t, platform, 4);
    const tops = Object.values(await boxes(page, `${SLIDE} li`)).map((b) => b.top);
    await click(page, await page.evaluate(`(() => { const r = document.querySelector(${js(`${SLIDE} ul > li`)}).getBoundingClientRect(); return { x: r.left + 40, y: r.top + r.height / 2 }; })()`));
    await frames(page);
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((e) => e.localName)'), ['ul']);
    await exec(page, 'text.list.none');
    await frames(page);
    const paragraphs = added(page, await render(page)).map((l) => l.trim());
    assert.equal(paragraphs.length, 3);
    for (const p of paragraphs) assert.match(p, /^<p class="fragment" data-fragment-index="\d" style="translate: 0px 20px">/, 'a paragraph does not take the translate of the list');
    // the first paragraph is drawn where the first item was, and the others under it by the gap of
    // the theme between two paragraphs, which is wider than that between two items
    const now = Object.values(await boxes(page, `${SLIDE} > p.fragment`)).map((b) => b.top);
    assert.equal(now[0], tops[0], 'the first paragraph is not drawn where the first item was');
    await click(page, await page.evaluate(`(() => { const r = document.querySelector(${js(`${SLIDE} > p.fragment`)}).getBoundingClientRect(); return { x: r.left + 40, y: r.top + r.height / 2 }; })()`));
    await frames(page);
    await press(page, 'Mod+A');
    await exec(page, 'text.list.ul');
    await frames(page);
    assert.equal(await render(page), page.source, 'Dashes does not give the list back');
    assert.deepEqual(errors(page), []);
  });
}

// puts the caret at the start of the item of the current slide whose text starts with words
const caretAtStart = (page, words) => page.evaluate(`(() => {
  const li = [...document.querySelectorAll(${js(`${SLIDE} li`)})].find((el) => el.textContent.startsWith(${js(words)}));
  li.closest('[contenteditable="true"]')?.focus();
  getSelection().collapse(li.firstChild, 0);
  return true;
})()`);

// item 2, the repair: Backspace at the start of the first item of a text box made a list takes the
// dash off, and the paragraph gets the place of the list back. a list of one item is thus written
// with the bytes of the box, and the first of two items is written before the list with its place
for (const platform of PLATFORMS) {
  test(`2: Backspace at the start of the first item of a text box made a list gives the paragraph the place of the list (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await newBox(page, 'alpha');
    const style = /style="([^"]*)"/.exec(await boxTag(page))[1];
    const typed = await render(page);
    const placed = (await boxes(page, `${SLIDE} > p`))['p alpha'];
    await click(page, `${PANEL} [data-command="text.list.ol"]`);
    await frames(page);
    const listed = await render(page);
    await caretAtStart(page, 'alpha');
    await press(page, 'Backspace');
    await sleep(250);
    const back = await render(page);
    assert.deepEqual(added(page, back).map((l) => l.trim()), [`<p style="${style}">alpha</p>`], 'the paragraph does not take the place of the list');
    assert.equal(back, typed, 'the paragraph is not written with the bytes of the box');
    assert.deepEqual((await boxes(page, `${SLIDE} > p`))['p alpha'], placed, 'the paragraph is not drawn where the box was');
    await undo(page);
    await frames(page);
    assert.equal(await render(page), listed, 'the undo does not give the list back');
    await redo(page);
    await frames(page);
    assert.equal(await render(page), typed, 'the redo does not give the box back');
    // with two items, the first is written before the list, with the place of the list
    await undo(page);
    await frames(page);
    await caretAtStart(page, 'alpha');
    await press(page, 'End');
    await press(page, 'Enter');
    await type(page, 'beta');
    await sleep(250);
    const list = (await boxes(page, `${SLIDE} > ol`))['ol alpha'];
    await caretAtStart(page, 'alpha');
    await press(page, 'Backspace');
    await sleep(250);
    const out = await render(page);
    assert.deepEqual(added(page, out).map((l) => l.trim()), [`<p style="${style}">alpha</p>`, `<ol style="${style}">`, '<li>beta</li>', '</ol>'], 'the paragraph does not take the place of the list');
    samePlace((await boxes(page, `${SLIDE} > p`))['p alpha'], list, 'the paragraph');
    const { text } = await saveAndReopen(page, `r32-2-6-${platform}.html`);
    assert.equal(text, out);
    assert.deepEqual(errors(page), []);
  });
}

// item 2, the repair: Enter on the empty last item of a text box made a list ends the list with a
// paragraph that takes the width of the list together with its translate
for (const platform of PLATFORMS) {
  test(`2: Enter on the empty last item of a text box made a list writes the paragraph with the width and the translate of the list (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await newBox(page, 'alpha');
    const style = /style="([^"]*)"/.exec(await boxTag(page))[1];
    await click(page, `${PANEL} [data-command="text.list.ol"]`);
    await frames(page);
    await caretAtStart(page, 'alpha');
    await press(page, 'End');
    await press(page, 'Enter');
    await type(page, 'beta');
    await press(page, 'Enter');
    await sleep(150);
    await press(page, 'Enter');
    await type(page, 'gamma');
    await sleep(250);
    const out = await render(page);
    assert.deepEqual(added(page, out).map((l) => l.trim()), [`<ol style="${style}">`, '<li>alpha</li>', '<li>beta</li>', '</ol>', `<p style="${style}">gamma</p>`], 'the paragraph does not take the place of the list');
    const drawn = await boxes(page, `${SLIDE} > *`);
    assert.deepEqual([drawn['p gamma'].left, drawn['p gamma'].width], [drawn['ol alpha'].left, drawn['ol alpha'].width], 'the paragraph is not drawn at the left edge and with the width of the list');
    const { text } = await saveAndReopen(page, `r32-2-7-${platform}.html`);
    assert.equal(text, out);
    assert.deepEqual(errors(page), []);
  });
}
