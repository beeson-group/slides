// the structure and the formats of the text of a slide, on both platforms: Return splits a block,
// Backspace and Delete join two, Tab and Shift+Tab change the level of a list item, the list
// switch, the links, the formats of the words, their tones, and the paragraph styles. each edit is
// checked byte for byte, after an undo and a redo, against the scope rule, and after a save and an
// open of the saved text

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { normalizeHref } from '../src/editor/text/link.ts';
import { byteExact, click, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));

const FIRST = '<li class="fragment" data-fragment-index="1">A first item</li>';
const PARAGRAPH = '<p>A paragraph with <strong>bold</strong>, <em>italic</em>, <code>code</code>, and \\(x^2\\) inline.</p>';
const LIST = `<ul>
    ${FIRST}
    <li class="fragment" data-fragment-index="2">A second item
      <ul>
        <li>A nested item</li>
      </ul>
    </li>
  </ul>`;

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

// the editor on the third slide of the deck of layouts, served over HTTP, where a save is written
// into the origin private file system
let last = null;

async function textPage(platform) {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.goto(`${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(LAYOUTS, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  await page.evaluate('Reveal.slide(2)');
  return page;
}

// selects the characters start to end of the text of the first element at selector whose text
// contains has, with its block focused
const select = (page, selector, has, start, end = start) =>
  page.evaluate(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.textContent.includes(${JSON.stringify(has)}));
    const at = (k) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let left = k;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (left <= n.length) return [n, left];
        left -= n.length;
      }
      return [el, el.childNodes.length];
    };
    el.closest('[contenteditable="true"]').focus();
    const r = document.createRange();
    r.setStart(...at(${start}));
    r.setEnd(...at(${end}));
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    return true;
  })()`);

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');

// a trusted key with its key, code, and Windows key code given, for a symbol that press() does not
// know. mods holds the bits Alt 1, Ctrl 2, Meta 4, and Shift 8
async function raw(page, key, code, keyCode, mods) {
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: keyCode, modifiers: mods });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, modifiers: mods });
}

// the problems of the scope rule in the rendered text that the file did not have before
async function inScope(page) {
  const now = textProblems(await page.evaluate('window.BeesonEditor.render()'), THEME);
  for (const p of textProblems(page.source, THEME)) {
    const i = now.indexOf(p);
    if (i >= 0) now.splice(i, 1);
  }
  assert.deepEqual(now, []);
}

// the edit checked byte for byte, then after an undo, which gives the file with the edits before,
// and again after a redo
async function roundTrip(page, edits, label, before = []) {
  await byteExact(page, edits);
  await inScope(page);
  if (label) assert.equal((await state(page, 'edit.undo')).label, `Undo ${label}`);
  await undo(page);
  await byteExact(page, before);
  await redo(page);
  await byteExact(page, edits);
}

// the errors of the page, apart from the request of a favicon, which the server does not have
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

let saves = 0;

async function saved(page, edits) {
  const { text } = await saveAndReopen(page, `text-${++saves}.html`);
  page.source = text;
  await byteExact(page);
  assert.ok(edits.every(([, after]) => text.includes(after)));
}

test('an address typed into the link dialog is made an href', () => {
  assert.equal(normalizeHref(' example.com/a '), 'https://example.com/a');
  assert.equal(normalizeHref('http://example.com'), 'http://example.com');
  assert.equal(normalizeHref('me@example.com'), 'mailto:me@example.com');
  assert.equal(normalizeHref('#/7'), '#/7');
  assert.equal(normalizeHref('javascript:alert(1)'), null);
  assert.equal(normalizeHref('  '), null);
});

for (const platform of PLATFORMS) {
  const mod = platform === 'mac' ? 4 : 2;

  test(`Return splits a list item at the caret, and Backspace at the start of the second joins them on ${platform}`, async () => {
    const page = await textPage(platform);
    const split = [FIRST, `<li class="fragment" data-fragment-index="1">A first</li>\n    <li class="fragment" data-fragment-index="1"> item</li>`];
    await select(page, '.reveal section.present li', 'A first item', 7);
    await press(page, 'Enter');
    await roundTrip(page, [split], 'New Paragraph');
    await select(page, '.reveal section.present li', ' item', 0);
    await press(page, 'Backspace');
    await byteExact(page);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Join Paragraphs');
    await undo(page);
    await byteExact(page, [split]);
    // Delete at the end of the first part joins them too
    await select(page, '.reveal section.present li', 'A first', 7);
    await press(page, 'Delete');
    await byteExact(page);
    await undo(page);
    await byteExact(page, [split]);
    await saved(page, [split]);
    assert.deepEqual(errors(page), []);
  });

  test(`Return in a nested item splits it, and Backspace at its start takes it out of its list on ${platform}`, async () => {
    const page = await textPage(platform);
    const nested = ['<li>A nested item</li>', '<li>A </li>\n        <li>nested item</li>'];
    await select(page, '.reveal section.present li li', 'A nested item', 2);
    await press(page, 'Enter');
    await roundTrip(page, [nested], 'New Paragraph');
    await select(page, '.reveal section.present li li', 'nested item', 0);
    await press(page, 'Backspace');
    const out = ['<li>A nested item</li>\n      </ul>\n    </li>', '<li>A </li>\n      </ul>\n    </li>\n    <li>nested item</li>'];
    await roundTrip(page, [out], 'Join Paragraphs', [nested]);
    await saved(page, [out]);
    assert.deepEqual(errors(page), []);
  });

  test(`Tab nests a list item in a ul of the item before, and Shift+Tab takes it out on ${platform}`, async () => {
    const page = await textPage(platform);
    // Tab in the first item is taken, and does not change its level
    await select(page, '.reveal section.present li', 'A first item', 3);
    await press(page, 'Tab');
    await byteExact(page);
    assert.equal(await page.evaluate('window.BeesonEditor.status().undo'), false);
    await select(page, '.reveal section.present li', 'A first item', 12);
    await press(page, 'Enter');
    await type(page, 'Another');
    const top = [FIRST, `${FIRST}\n    <li class="fragment" data-fragment-index="1">Another</li>`];
    await byteExact(page, [top]);
    await press(page, 'Tab');
    const nested = [FIRST, '<li class="fragment" data-fragment-index="1">A first item\n      <ul>\n        <li class="fragment" data-fragment-index="1">Another</li>\n      </ul>\n    </li>'];
    await roundTrip(page, [nested], 'Increase Indent Level', [top]);
    await select(page, '.reveal section.present li li', 'Another', 3);
    await press(page, 'Shift+Tab');
    await roundTrip(page, [top], 'Decrease Indent Level', [nested]);
    await undo(page);
    await byteExact(page, [nested]);
    await saved(page, [nested]);
    assert.deepEqual(errors(page), []);
  });

  test(`a list is switched between dashes, numbers, and paragraphs on ${platform}`, async () => {
    const page = await textPage(platform);
    await select(page, '.reveal section.present li', 'A first item', 3);
    assert.deepEqual(await state(page, 'text.list.ul'), { id: 'text.list.ul', label: 'Dashes', enabled: true, checked: true });
    await exec(page, 'text.list.ol');
    const ol = [LIST, LIST.replace(/^<ul>/, '<ol>').replace(/<\/ul>$/, '</ol>')];
    await roundTrip(page, [ol], 'List Style');
    await undo(page);
    await select(page, '.reveal section.present li', 'A first item', 3);
    await exec(page, 'text.list.none');
    const none = [`<ul>\n    ${FIRST}`, '<p class="fragment" data-fragment-index="1">A first item</p>\n  <ul>'];
    await roundTrip(page, [none], 'List Style');
    await undo(page);
    await select(page, '.reveal section.present > p', 'A paragraph', 3);
    await exec(page, 'text.list.ul');
    const ul = [PARAGRAPH, `<ul>\n    ${PARAGRAPH.replace(/^<p>/, '<li>').replace(/<\/p>$/, '</li>')}\n  </ul>`];
    await roundTrip(page, [ul], 'List Style');
    await saved(page, [ul]);
    assert.deepEqual(errors(page), []);
  });

  test(`a link to a slide is written as href="#/7", from the dialog of Mod+K and from exec on ${platform}`, async () => {
    const page = await textPage(platform);
    await select(page, '.reveal section.present > p', 'A paragraph', 2, 11);
    await press(page, 'Mod+K');
    await page.waitFor(`document.querySelector('dialog.beeson-edit-link[open]') !== null`);
    assert.equal(await page.evaluate('window.BeesonEditor.status().undo'), false);
    await click(page, 'dialog.beeson-edit-link [data-kind="slide"]');
    await page.evaluate(`(() => { const s = document.querySelector('dialog.beeson-edit-link select'); s.value = '7'; s.dispatchEvent(new Event('change')); s.focus(); })()`);
    await press(page, 'Enter');
    await page.waitFor(`window.BeesonEditor.render().includes('href="#/7"')`);
    const link = [PARAGRAPH, PARAGRAPH.replace('paragraph', '<a href="#/7">paragraph</a>')];
    await roundTrip(page, [link], 'Link');
    // the caret in the link opens the dialog on its slide, and Remove takes the link off
    await select(page, '.reveal section.present a', 'paragraph', 3);
    assert.equal((await state(page, 'text.link')).label, 'Edit Link…');
    await press(page, 'Mod+K');
    await page.waitFor(`document.querySelector('dialog.beeson-edit-link[open]') !== null`);
    assert.equal(await page.evaluate(`document.querySelector('dialog.beeson-edit-link select').value`), '7');
    await click(page, 'dialog.beeson-edit-link .remove');
    await page.waitFor(`!window.BeesonEditor.render().includes('href="#/7"')`);
    await byteExact(page);
    await undo(page);
    await byteExact(page, [link]);
    // a webpage typed without its scheme, and Esc, which closes the dialog without a change
    await select(page, '.reveal section.present > p', 'A paragraph', 17, 21);
    await press(page, 'Mod+K');
    await page.waitFor(`document.activeElement?.name === 'href'`);
    await press(page, 'Escape');
    await page.waitFor(`document.querySelector('dialog.beeson-edit-link') === null`);
    await byteExact(page, [link]);
    await press(page, 'Mod+K');
    await page.waitFor(`document.activeElement?.name === 'href'`);
    await type(page, 'example.com');
    await press(page, 'Enter');
    await page.waitFor(`window.BeesonEditor.render().includes('example.com')`);
    const web = [PARAGRAPH, link[1].replace('<strong>bold</strong>', '<a href="https://example.com"><strong>bold</strong></a>')];
    await byteExact(page, [web]);
    await inScope(page);
    await undo(page);
    await byteExact(page, [link]);
    await saved(page, [link]);
    assert.deepEqual(errors(page), []);
  });

  test(`superscript, subscript, code, the tones, and Clear Formatting on the words of a selection on ${platform}`, async () => {
    const page = await textPage(platform);
    const word = (html) => [PARAGRAPH, PARAGRAPH.replace('paragraph', html)];
    await select(page, '.reveal section.present > p', 'A paragraph', 2, 11);
    if (platform === 'mac') await raw(page, '=', 'Equal', 187, 2 | mod);
    else await raw(page, '.', 'Period', 190, mod);
    await roundTrip(page, [word('<sup>paragraph</sup>')], 'Superscript');
    await select(page, '.reveal section.present > p', 'A paragraph', 2, 11);
    assert.equal((await state(page, 'text.superscript')).checked, true);
    // subscript takes superscript off, and a second subscript takes itself off
    if (platform === 'mac') await raw(page, '-', 'Minus', 189, 2 | mod);
    else await raw(page, ',', 'Comma', 188, mod);
    await roundTrip(page, [word('<sub>paragraph</sub>')], 'Subscript', [word('<sup>paragraph</sup>')]);
    await select(page, '.reveal section.present > p', 'A paragraph', 2, 11);
    await exec(page, 'text.subscript');
    await byteExact(page);
    await exec(page, 'text.code');
    await roundTrip(page, [word('<code>paragraph</code>')], 'Code');
    await select(page, '.reveal section.present > p', 'A paragraph', 2, 11);
    await exec(page, 'text.code');
    for (const tone of ['accent', 'violet', 'blue', 'red', 'subtle', 'muted']) {
      await exec(page, `text.tone.${tone}`);
      await byteExact(page, [word(`<span class="tone-${tone}">paragraph</span>`)]);
      assert.equal((await state(page, `text.tone.${tone}`)).checked, true);
    }
    await inScope(page);
    await exec(page, 'text.tone.text');
    await byteExact(page);
    // the caret in a word sets the format on the word
    await select(page, '.reveal section.present > p', 'A paragraph', 5);
    await press(page, 'Mod+B');
    await roundTrip(page, [word('<strong>paragraph</strong>')], 'Bold');
    await select(page, '.reveal section.present > p', 'A paragraph', 5);
    await exec(page, 'text.tone.accent');
    await select(page, '.reveal section.present > p', 'A paragraph', 0, 35);
    if (platform === 'mac') await raw(page, '\\', 'Backslash', 220, mod);
    else await press(page, 'Mod+Space');
    const clear = [PARAGRAPH, '<p>A paragraph with bold, italic, code, and \\(x^2\\) inline.</p>'];
    await roundTrip(page, [clear], 'Clear Formatting', [word('<strong><span class="tone-accent">paragraph</span></strong>')]);
    await saved(page, [clear]);
    assert.deepEqual(errors(page), []);
  });

  test(`the paragraph styles, and Bigger and Smaller along them on ${platform}`, async () => {
    const page = await textPage(platform);
    const as = (open, close) => [PARAGRAPH, PARAGRAPH.replace(/^<p>/, open).replace(/<\/p>$/, close)];
    const block = () => select(page, '.reveal section.present > :is(p, h3, div)', 'A paragraph', 3);
    const smaller = () => raw(page, '<', 'Comma', 188, mod | 8);
    const bigger = () => raw(page, '>', 'Period', 190, mod | 8);
    // each style after the one before, with the caret kept in the retagged block
    const steps = [
      [() => exec(page, 'text.style.subheading'), as('<h3>', '</h3>'), 'Paragraph Style', 'h3'],
      [smaller, as('<p>', '</p>'), 'Smaller', 'p'],
      [smaller, as('<p class="small">', '</p>'), 'Smaller', 'p'],
      [smaller, as('<div class="foot">', '</div>'), 'Smaller', 'div'],
      [bigger, as('<p class="small">', '</p>'), 'Bigger', 'p'],
      [() => exec(page, 'text.style.caption'), as('<p class="caption">', '</p>'), 'Paragraph Style', 'p'],
    ];
    await block();
    assert.equal((await state(page, 'text.style.body')).checked, true);
    let before = [];
    for (const [run, edit, label, tag] of steps) {
      await run();
      assert.equal(await page.evaluate('document.activeElement.localName'), tag);
      await roundTrip(page, [edit], label, before);
      before = [edit];
      await block();
    }
    assert.equal((await state(page, 'text.style.caption')).checked, true);
    await smaller();
    await byteExact(page, [as('<div class="foot">', '</div>')]);
    await block();
    assert.equal((await state(page, 'text.smaller')).enabled, false);
    await exec(page, 'text.style.body');
    await byteExact(page);
    // a style is set on a block selected on the canvas too, after Esc leaves its text
    await press(page, 'Escape');
    assert.equal(await page.evaluate('document.activeElement.localName'), 'body');
    await exec(page, 'text.style.subheading');
    await byteExact(page, [as('<h3>', '</h3>')]);
    await saved(page, [as('<h3>', '</h3>')]);
    assert.deepEqual(errors(page), []);
  });
}
