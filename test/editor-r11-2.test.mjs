// regression tests of R11.2 on both platforms with trusted input: Return on an empty item in the
// middle of a list, Bigger, Smaller, and the paragraph style on several blocks, Shift+click and the
// column of the caret across the items of a list, and the delay of several steps. after each edit
// the text is checked byte for byte after an undo, the edit again after a redo, and after a save
// and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen, type } from './helpers/editor.mjs';

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

const js = (v) => JSON.stringify(v);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
const exec = (page, id, arg = '') => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg ? `, ${arg}` : ''})`);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let saves = 0;

// the editor on slide n of the demo deck, counted from 0, served over HTTP
async function load(t, platform, n = 4) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/index.html?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('index.html', 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks the text in page.source byte for byte after undos undos, the edit after as many
// redos, and an open of the saved edit without problems, whose text becomes page.source
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  for (let i = 0; i < undos; i++) await undo(page);
  await byteExact(page);
  for (let i = 0; i < undos; i++) await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r11-2-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

// the shown element of selector that holds needle, as an expression
const find = (selector, needle = '') => `[...document.querySelectorAll(${js(selector)})].find((el) => el.getBoundingClientRect().width && el.textContent.includes(${js(needle)}))`;

// the client point of the character at offset k of needle, 2 px inside its left edge with edge,
// else at its center
const pointOf = (page, selector, needle, k = 0, edge = false) => page.evaluate(`(() => {
  const el = ${find(selector, needle)};
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const i = n.data.indexOf(${js(needle)});
    if (i < 0) continue;
    const r = document.createRange();
    r.setStart(n, i + ${k});
    r.setEnd(n, i + ${k} + 1);
    const b = r.getBoundingClientRect();
    return { x: ${edge} ? b.left + 2 : b.left + b.width / 2, y: b.top + b.height / 2 };
  }
})()`);

// the caret put after k characters of needle, in the text node that holds it
const caretAt = (page, selector, needle, k) => page.evaluate(`(() => {
  const el = ${find(selector, needle)};
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const i = n.data.indexOf(${js(needle)});
    if (i >= 0) return void getSelection().collapse(n, i + ${k});
  }
})()`);

const ITEM = '.reveal section.present ul > li, .reveal section.present ol > li';
const PARA = '.reveal section.present > p';
const ITEMS = [
  '<li class="fragment" data-fragment-index="1">Dark and light mode: export one file per mode, mark them <code>for-dark</code> and <code>for-light</code>.</li>',
  '<li class="fragment" data-fragment-index="2">You might have noticed a toggle on the top right: try clicking it on this slide.</li>',
  '<li class="fragment" data-fragment-index="3">You should give black-on-white plots the class <code>invert</code> to invert them in dark mode.</li>',
];
const SMALL_ITEMS = ITEMS.map((li) => li.replace('<li class="fragment"', '<li class="fragment small"'));

// the caret put at the end of the text of item i of the lists of the slide, counted in page order
const caretAtEnd = (page, i) => page.evaluate(`(() => {
  const li = document.querySelectorAll(${js(ITEM)})[${i}];
  const w = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
  let last = null;
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.data.trim()) last = n;
  li.closest('[contenteditable="true"]').focus();
  getSelection().collapse(last, last.length);
})()`);

// the tag and the text of the editing host of the caret
const caretBlock = (page) => page.evaluate(`(() => {
  const n = getSelection().focusNode;
  const host = (n.nodeType === 1 ? n : n.parentElement).closest('[contenteditable="true"]');
  return host ? { tag: host.localName, text: host.textContent.trim() } : null;
})()`);

// the line of the file that holds the start of the text head
const line = (text, head) => text.split('\n').find((l) => l.includes(`>${head}`))?.trim();

// difference 1 of R11.2: Return on an empty item in the middle of a list of the first level added
// one more empty item. in Keynote and PowerPoint it takes the bullet off the line, which becomes a
// paragraph between the items before it and the items after it
for (const platform of PLATFORMS) {
  for (const kind of ['ul', 'ol']) {
    test(`Return on an empty item in the middle of a list of kind ${kind} cuts the list at a new paragraph (${platform})`, async (t) => {
      const page = await load(t, platform);
      await click(page, await pointOf(page, ITEM, 'Dark and light', 2));
      if (kind === 'ol') {
        await exec(page, 'text.list.ol');
        page.source = await render(page);
      }
      const open = `<${kind} style="translate: 0px 20px">`;
      assert.ok(page.source.includes(open));
      await caretAtEnd(page, 0);
      await press(page, 'Enter');
      const added = await render(page);
      assert.ok(added.includes('<li class="fragment" data-fragment-index="1"></li>'), 'Return at the end of an item does not add an empty item');
      page.source = added;
      await press(page, 'Enter');
      const cut = await render(page);
      const shape = new RegExp(`${escape(ITEMS[0])}\\n  </${kind}>\\n  <p></p>\\n  ${escape(open)}\\n    ${escape(ITEMS[1])}\\n    ${escape(ITEMS[2])}\\n  </${kind}>`);
      assert.match(cut, shape, `the list is not cut at a paragraph: ${cut.match(/for-light<\/code>\.[\s\S]{0,220}/)?.[0]}`);
      assert.equal(await undoLabel(page), 'Undo New Paragraph');
      assert.deepEqual(await caretBlock(page), { tag: 'p', text: '' }, 'the caret is not in the new paragraph');
      await type(page, 'Z');
      const typed = await render(page);
      assert.ok(typed.includes(`</${kind}>\n  <p>Z</p>\n  ${open}`), 'the typed text is not in the new paragraph');
      await undo(page);
      assert.equal(await render(page), cut);
      await undo(page);
      assert.equal(await render(page), added, 'the cut of the list is not one entry of the history');
      await redo(page);
      assert.equal(await render(page), cut);
      await redo(page);
      assert.equal(await render(page), typed);
      const { text } = await saveAndReopen(page, `r11-2-${++saves}.html`);
      assert.equal(text, typed);
      assert.deepEqual(errors(page), []);
    });
  }

  // an empty first item is taken off its list, which then starts at the item after it
  test(`Return on an empty first item of a list makes it a paragraph before the list (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await pointOf(page, ITEM, 'Dark and light', 2));
    await caretAt(page, ITEM, 'Dark and light', 0);
    await press(page, 'Enter');
    page.source = await render(page);
    await page.evaluate(`(() => { const li = document.querySelectorAll(${js(ITEM)})[0]; li.focus(); getSelection().collapse(li, 0); })()`);
    await press(page, 'Enter');
    const cut = await render(page);
    assert.ok(cut.includes(`<p></p>\n  <ul style="translate: 0px 20px">\n    ${ITEMS[0]}`), `the empty first item is not a paragraph before the list: ${cut.match(/frameless\.<\/p>[\s\S]{0,160}/)?.[0]}`);
    assert.deepEqual(await caretBlock(page), { tag: 'p', text: '' });
    await roundTrip(page);
  });

  // R9.6 moves an empty nested item out one level at the end of its list. in the middle of a list
  // it does the same, and the items after it go into a list at its end, as with Shift+Tab
  test(`Return on an empty nested item in the middle of its list moves it out one level (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await pointOf(page, ITEM, 'toggle', 2));
    await press(page, 'Tab');
    await caretAt(page, ITEM, 'You should', 2);
    await press(page, 'Tab');
    await caretAtEnd(page, 1);
    await press(page, 'Enter');
    const added = await render(page);
    assert.match(added, /this slide\.<\/li>\s*<li class="fragment" data-fragment-index="2"><\/li>\s*<li class="fragment" data-fragment-index="3">You should/, 'the empty item is not added between the two nested items');
    page.source = added;
    await press(page, 'Enter');
    const out = await render(page);
    assert.match(out, /for-light<\/code>\.\s*<ul>\s*<li class="fragment" data-fragment-index="2">You might[^\n]*<\/li>\s*<\/ul>\s*<\/li>\s*<li class="fragment" data-fragment-index="2">\s*<ul>\s*<li class="fragment" data-fragment-index="3">You should/, `the empty item is not moved out one level: ${out.match(/for-light<\/code>\.[\s\S]{0,300}/)?.[0]}`);
    assert.equal(await undoLabel(page), 'Undo New Paragraph');
    // the caret is in the outdented item. this item does not have a text of its own before its
    // nested list, hence the browser puts the caret at the start of the nested list
    assert.equal(await page.evaluate(`(() => { const n = getSelection().focusNode; const li = (n.nodeType === 1 ? n : n.parentElement).closest('[contenteditable="true"]'); return li.localName === 'li' && li.textContent.trim().startsWith('You should') && !li.parentElement.closest('li'); })()`), true, 'the caret is not in the outdented item');
    await roundTrip(page);
  });
}
