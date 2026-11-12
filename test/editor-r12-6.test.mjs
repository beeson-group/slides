// regression tests of R12.6 on both platforms with trusted input: the text and the lists of a slide,
// i.e. Italic after Tab over a whole list, the selection kept by a list style, the caret after an
// undo in a nested list, Tab on a new empty item, Tab in a paragraph or a heading, the entries of a
// paste and a cut, the paragraph that ends a moved list, Backspace at the start of a list, and the
// check of the paragraph style menu over mixed blocks. after each edit the text is checked byte for
// byte after an undo, the edit again after a redo, and after a save and an open

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
const exec = (page, id) => page.evaluate(`window.BeesonEditor.exec(${js(id)})`);
let saves = 0;

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
  page.platform = platform;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks page.source byte for byte after undos undos, the edit after as many redos, and
// an open of the saved edit without problems
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  for (let i = 0; i < undos; i++) await undo(page);
  await byteExact(page);
  for (let i = 0; i < undos; i++) await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r12-6-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  return edited;
}

const find = (selector, needle = '') => `[...document.querySelectorAll(${js(selector)})].find((el) => el.getBoundingClientRect().width && el.textContent.includes(${js(needle)}))`;

// the client point of the character at offset k of needle, 2 px inside its left edge with edge
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

const ITEM = '.reveal section.present ul > li, .reveal section.present ol > li';
const PARA = '.reveal section.present > p';
const HEAD = '.reveal section.present > h2';

// caretAtEnd puts the caret at the end of the own text of item i of the slide, counted in page
// order, i.e. before a nested list of the item
const caretAtEnd = (page, i) => page.evaluate(`(() => {
  const li = document.querySelectorAll(${js(ITEM)})[${i}];
  const w = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
  let last = null;
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.data.trim() && n.parentElement.closest('li') === li) last = n;
  li.closest('[contenteditable="true"]').focus();
  getSelection().collapse(last, last.length);
})()`);

// caretIn gives the tag and the text of the element of the focus of the window, the active element,
// and whether the window is collapsed
const caretIn = (page) => page.evaluate(`(() => {
  const s = getSelection();
  const n = s.focusNode;
  const el = n && (n.nodeType === 1 ? n : n.parentElement);
  return { tag: el?.localName ?? null, text: el?.textContent.trim().slice(0, 29) ?? null, editing: !!el?.closest('[contenteditable="true"]'), active: document.activeElement.localName, collapsed: s.isCollapsed };
})()`);

// the part of the file from the h2 of slide 5 to its figure
const listPart = (text) => {
  const at = text.indexOf('<h2>Figures are first');
  return text.slice(at, text.indexOf('<figure class="zone">', at));
};

// pressCommand sends a key with the editing command of the browser, which a key event of the
// DevTools protocol runs only when the command is named
async function pressCommand(page, keys, command) {
  const modifiers = page.platform === 'mac' ? 4 : 2;
  const key = keys.slice(-1);
  const base = { key, code: `Key${key.toUpperCase()}`, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0), modifiers };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base, commands: [command] });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

// pressKey sends Mod+], which press() does not know, and else passes keys to press()
async function pressKey(page, keys) {
  if (keys !== 'Mod+]') return press(page, keys);
  const base = { key: ']', code: 'BracketRight', windowsVirtualKeyCode: 221, modifiers: page.platform === 'mac' ? 4 : 2 };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

for (const platform of PLATFORMS) {
  // text-lists-find-1: Italic after Tab on the whole list wrote one more empty item with step 3
  test(`Italic after Tab on a whole list selected with the command A formats the items and adds no item (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await pointOf(page, ITEM, 'toggle', 2));
    await press(page, 'Mod+A');
    await press(page, 'Tab');
    const nested = await render(page);
    assert.match(listPart(nested), /<li class="fragment" data-fragment-index="1">Dark[\s\S]*<ul>[\s\S]*data-fragment-index="3"/);
    await press(page, 'Mod+I');
    const part = listPart(await render(page));
    assert.equal(part.match(/<li\b/g).length, 3, `the italic changes the number of items: ${part}`);
    assert.doesNotMatch(part, /<li[^>]*>\s*<\/li>/, 'the italic writes an empty item');
    assert.equal(part.match(/<em>/g)?.length, 3, `the italic does not format each item: ${part}`);
    await roundTrip(page, 2);
  });

  // text-lists-find-2: Numbers, Dashes, and Paragraphs collapsed the selection to a caret
  test(`Numbers and then Paragraphs act on every item of a list selected with the command A (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await pointOf(page, ITEM, 'toggle', 2));
    await press(page, 'Mod+A');
    await exec(page, 'text.list.ol');
    assert.equal((await caretIn(page)).collapsed, false, 'Numbers collapses the selection');
    await press(page, 'Mod+I');
    let part = listPart(await render(page));
    assert.equal(part.match(/<em>/g)?.length, 3, `Italic after Numbers does not format each item: ${part}`);
    await undo(page);
    await exec(page, 'text.list.none');
    part = listPart(await render(page));
    assert.doesNotMatch(part, /<ol|<ul|<li/, `Paragraphs after Numbers leaves a list: ${part}`);
    assert.equal(part.match(/<p class="fragment"/g)?.length, 3);
    await roundTrip(page, 2);
  });

  test(`Dashes on a word of a paragraph keeps the word selected for Italic (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await pointOf(page, PARA, 'styles', 2), { count: 2 });
    await exec(page, 'text.list.ul');
    assert.equal((await caretIn(page)).collapsed, false, 'Dashes collapses the selection');
    await press(page, 'Mod+I');
    assert.match(listPart(await render(page)), /<ul>\n {4}<li>Export your matplotlib figure with the <em>styles<\/em> of the template/);
    await roundTrip(page, 2);
  });

  // text-lists-find-3: the caret was left in the white space of a nested list after an undo
  test(`after the undo of an outdented empty nested item, Shift+Tab and Return act on the item of the caret (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await pointOf(page, ITEM, 'You should', 0, true));
    await press(page, 'Home');
    await press(page, 'Tab');
    await caretAtEnd(page, 2);
    await press(page, 'Enter');
    await press(page, 'Enter');
    await undo(page);
    await undo(page);
    const c = await caretIn(page);
    assert.ok(c.tag === 'li' || c.tag === 'code', `the caret is not in an item after the undo: ${js(c)}`);
    assert.match(c.text, /^You should|^invert/);
    const nested = await render(page);
    await press(page, 'Shift+Tab');
    assert.notEqual(listPart(await render(page)), listPart(nested), 'Shift+Tab does not move the item out');
    await press(page, 'Enter');
    const part = listPart(await render(page));
    assert.doesNotMatch(part, /<(ul|ol)>\s*<\/\1>/, `Return writes an empty list: ${part}`);
    assert.doesNotMatch(part, /<li[^>]*>\s*<(ul|ol)>/, `Return writes an item that starts with a list: ${part}`);
    await roundTrip(page, 3);
  });

  // feel-1: the text typed after Tab on a new empty item went to the item above
  for (const key of ['Tab', 'Mod+]']) {
    test(`text typed after ${key} on a new empty item goes into the nested item (${platform})`, async (t) => {
      const page = await load(t, platform, 2);
      await caretAtEnd(page, 0);
      await press(page, 'Enter');
      await pressKey(page, key);
      await type(page, 'Sub-point');
      const text = await render(page);
      const near = text.match(/of appearance[\s\S]{0,160}/)?.[0];
      assert.ok(/of appearance\s*<ul>\s*<li class="fragment" data-fragment-index="1">Sub-point<\/li>\s*<\/ul>/.test(text), `the text is not in the nested item: ${near}`);
      await roundTrip(page, 3);
    });
  }

  // feel-2 and text-lists-find-4: Tab outside a list moved the focus out of the text
  for (const [name, n, selector, needle] of [['the paragraph', 4, PARA, 'Export'], ['the heading', 4, HEAD, 'Figures'], ['the heading of a section slide', 1, '.reveal section.present h2', 'Chapter']]) {
    test(`Tab and Shift+Tab in ${name} keep the caret in its text (${platform})`, async (t) => {
      const page = await load(t, platform, n);
      await click(page, await pointOf(page, selector, needle, 1, true));
      const before = await caretIn(page);
      await press(page, 'Tab');
      assert.deepEqual(await caretIn(page), before, 'Tab moves the caret');
      await press(page, 'Shift+Tab');
      assert.deepEqual(await caretIn(page), before, 'Shift+Tab moves the caret');
      assert.equal(await render(page), page.source);
      await type(page, 'Q');
      assert.ok((await render(page)).includes(`${needle[0]}Q${needle.slice(1)}`), 'the typed text is lost');
    });
  }

  // text-lists-find-5: a paste and a cut were part of the entry of the typing
  test(`a paste after typing and a cut are entries of their own, named Paste and Cut (${platform})`, async (t) => {
    const page = await load(t, platform);
    await page.send('Browser.grantPermissions', { origin: server.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
    await click(page, await pointOf(page, PARA, 'matplotlib', 3), { count: 2 });
    await pressCommand(page, 'Mod+c', 'copy');
    await click(page, await pointOf(page, PARA, 'frameless.', 9));
    await press(page, 'End');
    await type(page, ' abc ');
    await pressCommand(page, 'Mod+v', 'paste');
    const pasted = await render(page);
    // a double-click on Windows selects the space after the word as well, and it is copied with it
    assert.match(pasted, /frameless\. abc matplotlib ?<\/p>/, `the paste is not in the text: ${pasted.match(/frameless\.[^<]*/)?.[0]}`);
    assert.equal(await undoLabel(page), 'Undo Paste');
    await undo(page);
    assert.ok((await render(page)).includes('frameless. abc </p>'), 'the undo of the paste takes back the typing too');
    await redo(page);
    assert.equal(await render(page), pasted);
    await click(page, await pointOf(page, PARA, 'template', 3), { count: 2 });
    await pressCommand(page, 'Mod+x', 'cut');
    assert.ok(listPart(await render(page)).includes('styles of the. It will'), 'the cut does not take the word out');
    assert.equal(await undoLabel(page), 'Undo Cut');
    await undo(page);
    assert.equal(await render(page), pasted);
    await undo(page);
    await undo(page);
    await byteExact(page);
  });

  // text-lists-find-6: the paragraph that ends a list with a translate was drawn over the list
  test(`the paragraph that Return makes after a moved list is moved with it (${platform})`, async (t) => {
    const page = await load(t, platform);
    await caretAtEnd(page, 2);
    await press(page, 'Enter');
    await press(page, 'Enter');
    await type(page, 'After');
    const text = await render(page);
    assert.match(listPart(text), /<\/ul>\n {2}<p style="translate: 0px 20px">After<\/p>/, `the paragraph is not moved with the list: ${listPart(text)}`);
    const gap = await page.evaluate(`(() => {
      const s = document.querySelector('.reveal section.present');
      const ul = s.querySelector(':scope > ul');
      const p = [...s.querySelectorAll(':scope > p')].pop();
      return p.getBoundingClientRect().top - ul.getBoundingClientRect().bottom;
    })()`);
    assert.ok(gap >= 0, `the paragraph overlaps the list by ${-gap} px`);
    await roundTrip(page, 3);
  });

  // text-lists-find-8: Backspace at the start of the first item did nothing
  test(`Backspace at the start of the first item of a list takes its dash off, and a second joins it to the paragraph (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await pointOf(page, ITEM, 'Dark and light', 0, true));
    await press(page, 'Home');
    await press(page, 'Backspace');
    const text = listPart(await render(page));
    assert.match(text, /frameless\.<\/p>\n {2}<p class="fragment" data-fragment-index="1" style="translate: 0px 20px">Dark and light mode: [^<]*<code>for-dark<\/code> and <code>for-light<\/code>\.<\/p>\n {2}<ul style="translate: 0px 20px">\n {4}<li class="fragment" data-fragment-index="2">/, text);
    assert.equal(await undoLabel(page), 'Undo Remove Bullet');
    assert.deepEqual(await caretIn(page), { tag: 'p', text: 'Dark and light mode: export o', editing: true, active: 'p', collapsed: true });
    await roundTrip(page);
    await click(page, await pointOf(page, PARA, 'Dark and light', 0, true));
    await press(page, 'Home');
    await press(page, 'Backspace');
    assert.match(listPart(await render(page)), /frameless\.Dark and light mode/);
  });

  // plots-objects-outline-6: the menu of the paragraph style checked Body over a heading and a paragraph
  test(`the paragraph style menu checks no style over a heading and a paragraph selected as blocks (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await pointOf(page, HEAD, 'Figures', 3));
    await press(page, 'Escape');
    await click(page, await pointOf(page, PARA, 'Export', 3), { modifiers: 'Shift' });
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 2);
    const checked = await page.evaluate(`['body', 'small', 'subheading', 'caption', 'footnote'].filter((s) => window.BeesonEditor.state('text.style.' + s).checked)`);
    assert.deepEqual(checked, []);
  });
}
