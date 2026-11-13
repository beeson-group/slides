// regression tests of R26.5 on both platforms, for texts, lists, and slides: the sheet of a formula
// closed by a click away drops an empty new box, a word pasted with its space next to a line break
// or a formula, an item emptied in the editor drawn without its mark, a data-id kept by a copy of
// a slide, the marks of centered and nested lists, and the gap after the number of an item

import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch, printView } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const SLIDE = '.reveal .slides > section.present';
const DECK = 'test/pages/editor-r26-5.html';

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
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}, ${js(arg ?? null)} ?? undefined)).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const status = (page) => page.evaluate('window.BeesonEditor.status()');

// the editor on slide n of a deck, served over HTTP, with the storage of the origin emptied, and
// opened with source, by default the file itself
async function load(t, platform, deck, n, source = readFileSync(deck, 'utf8'), query = 'edit&still') {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?${query}&edit-platform=${platform}`;
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

// the key of an inline formula: Cmd+Option+E on a Mac, and Alt+= elsewhere, sent as the browser
// sends it
async function formulaKey(page, platform) {
  if (platform === 'mac') return press(page, 'Mod+Alt+E');
  const base = { key: '=', code: 'Equal', windowsVirtualKeyCode: 187, modifiers: 1 };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: '=', unmodifiedText: '=' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

// a trusted click on an empty point of the canvas, near the lower right corner of the slide
async function clickAway(page) {
  const at = await page.evaluate(`(() => { const r = document.querySelector(${js(SLIDE)}).getBoundingClientRect(); return { x: r.right - 30, y: r.bottom - 30 }; })()`);
  await click(page, at);
  await sleep(300);
}

// 1. finding audit-fixes 2. the sheet of an inline formula opened in a new empty text box, or in
// the empty words of a shape, and closed by a click away without an insert, acts as a click away
// without the sheet. the words of the shape are dropped, and the file and the history are left as
// they were. the text box is kept, written as an empty paragraph in the entry of its insert
const ROUTES = [
  ['a new text box', 'test/pages/editor-r23-1.html', 2, async (page) => {
    await click(page, '.beeson-edit-top [data-command="insert.text"]');
    await sleep(300);
    assert.equal(await page.evaluate(`!!document.querySelector(${js(`${SLIDE} .beeson-pending`)})`), true, 'the box is not drawn');
  }, `${SLIDE} .beeson-pending`, true],
  ['the empty words of a shape', 'test/pages/editor-r23-2.html', 3, async (page) => {
    await click(page, `${SLIDE} > .shape`);
    await frames(page);
    await press(page, 'Enter');
    await frames(page);
    assert.equal(await page.evaluate(`!!document.activeElement?.matches(${js(`${SLIDE} > .shape > p`)})`), true, 'the caret is not in the words of the shape');
  }, `${SLIDE} > .shape > p[data-generated]`, false],
];

for (const platform of PLATFORMS) {
  for (const [name, deck, n, open, left, kept] of ROUTES) {
    test(`1: the sheet of a formula in ${name} closed by a click away ${kept ? 'keeps it empty' : 'drops it, and the file and the history are kept'} (${platform})`, async (t) => {
      const page = await load(t, platform, deck, n);
      const label = (await state(page, 'edit.undo')).label;
      await open(page);
      await formulaKey(page, platform);
      await page.waitFor(`!!document.querySelector('.beeson-math textarea')`);
      await type(page, 'x^2');
      await sleep(300);
      await clickAway(page);
      assert.equal(await page.evaluate(`!!document.querySelector('.beeson-math')`), false, 'the sheet is still open');
      for (const k of [1, 2]) {
        assert.equal(await page.evaluate(`document.querySelector(${js(left)})?.outerHTML ?? null`), null, `the box is left after click away ${k}`);
        if (kept) {
          assert.equal((await render(page)).match(/<p( [^>]*)?><\/p>/g)?.length, 1, 'the empty box is not written as an empty paragraph');
          assert.equal((await state(page, 'edit.undo')).label, 'Undo Insert Text Box');
        } else {
          assert.equal(await render(page), page.source, 'the file is changed');
          assert.equal((await state(page, 'edit.undo')).label, label, 'the history has an entry');
          assert.equal((await status(page)).dirty, false, 'the editor reports unsaved changes');
        }
        await clickAway(page);
      }
      assert.deepEqual(errors(page), []);
    });
  }
}

// the shown element of selector whose text holds needle, as an expression
const blockOf = (selector, needle) => `[...document.querySelectorAll(${js(selector)})].find((el) => el.getBoundingClientRect().width && el.textContent.includes(${js(needle)}))`;

// the caret put at the mark | of at, e.g. 'where |', into the block of selector, by a click into the
// block and a collapse of the selection in the first text node that holds the text around the mark
async function caretAt(page, selector, at) {
  const needle = at.replace('|', '');
  const k = at.indexOf('|');
  const point = await page.evaluate(`(() => { const r = ${blockOf(selector, needle)}.getBoundingClientRect(); return { x: r.left + 4, y: r.top + r.height / 2 }; })()`);
  await click(page, point);
  await frames(page);
  await page.evaluate(`(() => {
    const el = ${blockOf(selector, needle)};
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const i = n.data.indexOf(${js(needle)});
      if (i < 0) continue;
      el.closest('[contenteditable="true"]')?.focus();
      getSelection().collapse(n, i + ${k});
      return;
    }
    throw new Error(${js(`the text ${needle} is not in the block`)});
  })()`);
}

// a paste of text at the caret as the browser sends it into a text, i.e. the event beforeinput with
// the clipboard text on its DataTransfer. the system clipboard is not used, since other tests share it
async function paste(page, text) {
  await page.evaluate(`(() => {
    const data = new DataTransfer();
    data.setData('text/plain', ${js(text)});
    const n = getSelection().anchorNode;
    const target = n instanceof Element ? n : n.parentElement;
    const ev = new InputEvent('beforeinput', { inputType: 'insertFromPaste', dataTransfer: data, bubbles: true, cancelable: true, composed: true });
    if (target.dispatchEvent(ev)) throw new Error('the editor left the paste to the browser');
  })()`);
  await frames(page);
}

// the lines of text that differ from those of the file, for a short message of a failed assertion
const changed = (text, file) => {
  const was = file.split('\n');
  return text.split('\n').filter((l, i) => l !== was[i]).join('\n');
};

// the edit of entries entries of the history checked against page.source after as many undos,
// again after as many redos, and after a save and an open
let saves = 0;
async function roundTrip(page, entries = 1) {
  const edited = await render(page);
  for (let i = 0; i < entries; i++) await undo(page);
  const back = await render(page);
  assert.ok(back === page.source, `the undo does not give the file back byte for byte: ${changed(back, page.source)}`);
  for (let i = 0; i < entries; i++) await redo(page);
  assert.ok((await render(page)) === edited, 'the redo does not write the edit again');
  const { text } = await saveAndReopen(page, `r26-5-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  return edited;
}

// 2. finding review-fixes 2. a word copied with the space after it, as a double click takes it on
// Windows, is pasted next to a formula as next to a word, and a space is not put at the start of a
// line after a line break. each case gives the slide of index.html, the block, the caret, and the
// saved text around the paste
const P = '.reveal section.present > p';
const LI = '.reveal section.present li';
const SPACES = [
  ['before an inline formula', 3, P, 'where |', 'where break \\(\\tilde U\\) is the effective'],
  ['after an inline formula', 3, P, '| and ', 'couple \\(x\\) break and \\(y\\).'],
  ['after an inline formula and before a space', 3, P, '| is the', '\\(\\tilde U\\) break is the effective'],
  ['at the start of a line after a line break', 9, LI, '|It\'s really', 'Then paste it in.<br>break It\'s really that simple.'],
  ['at the start of a line after two line breaks', 3, P, '|For instance', 'equations.<br><br>break For instance'],
];

for (const platform of PLATFORMS) {
  for (const [name, n, selector, at, expected] of SPACES) {
    test(`2: a paste of "break " ${name} gives ${js(expected)} (${platform})`, async (t) => {
      const page = await load(t, platform, 'test-deck.html', n);
      await caretAt(page, selector, at);
      await paste(page, 'break ');
      const edited = await roundTrip(page);
      const was = page.source.split('\n');
      assert.ok(edited.includes(expected), `the paste saved ${js(edited.split('\n').find((l, i) => l !== was[i])?.trim())}`);
    });
  }
}

// the deck text written to a file of the root, served as a show at slide n, or as the print view
async function show(t, text, n, query = '') {
  const file = `test/pages/editor-r26-5-${process.pid}-${++saves}.html`;
  writeFileSync(file, text);
  t.after(() => rmSync(file, { force: true }));
  const page = await browser.newPage({ width: 1600, height: 900 });
  t.after(() => page.close().catch(() => {}));
  if (query === '?print-pdf') {
    await printView(page, `${server.origin}/${file}${query}`);
    return page;
  }
  await page.goto(`${server.origin}/${file}${query}#/${n}`);
  await page.waitFor(deckSettled);
  await sleep(200);
  return page;
}

// the text, the mark, and the height of each item and paragraph under root
const marks = (root) => `[...${root}.querySelectorAll('li, p')].map((el) => [el.localName, el.innerHTML, el.localName === 'li' ? getComputedStyle(el, '::before').content : '', Math.round(el.getBoundingClientRect().height) > 0])`;

// 3. finding audit-fixes 1. an item and a paragraph emptied by Backspace are saved empty, without
// the line break that the browser puts into an empty text, hence the theme draws the item without
// its dash in the show and in the print view, and both keep the height of a line
for (const platform of PLATFORMS) {
  test(`3: an item and a paragraph emptied in the editor are saved empty, and the item is drawn without its dash outside the editor (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, 0);
    for (const [selector, needle] of [[`${SLIDE} li`, 'Two'], [`${SLIDE} > p`, 'Gone soon']]) {
      const at = await page.evaluate(`(() => { const r = ${blockOf(selector, needle)}.getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2 }; })()`);
      await click(page, at);
      await frames(page);
      await press(page, 'End');
      for (const _ of needle) await press(page, 'Backspace');
      await press(page, 'Escape');
      await frames(page);
    }
    const edited = await roundTrip(page, 2);
    assert.equal(changed(edited, page.source), '    <li></li>\n  <p></p>', 'the emptied blocks are not saved empty');
    const expected = [['li', 'One', '""', true], ['li', '', 'none', true], ['p', '', '', true]];
    const shown = await show(t, edited, 0);
    assert.deepEqual(await shown.evaluate(marks(`document.querySelector(${js(SLIDE)})`)), expected, 'the show draws the emptied item with its dash');
    assert.deepEqual(errors(shown), []);
    const print = await show(t, edited, 0, '?print-pdf');
    const pages = await print.evaluate(`[...document.querySelectorAll('.pdf-page section')].filter((s) => s.querySelector('h2')?.textContent === 'Items').map((s) => ${marks('s')})`);
    assert.ok(pages.length >= 1, 'the print view does not have the slide Items');
    for (const p of pages) assert.deepEqual(p, expected, 'the print view draws the emptied item with its dash');
  });
}

// the block of selector with the text needle emptied by a click into it, End, a Backspace for each
// character, and Esc
async function empty(page, selector, needle) {
  const at = await page.evaluate(`(() => { const r = ${blockOf(selector, needle)}.getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await frames(page);
  await press(page, 'End');
  for (const _ of needle) await press(page, 'Backspace');
  await press(page, 'Escape');
  await frames(page);
}

// 3. a nested item is written inside the block of its outer item, and emptied it is saved empty and
// drawn without its dash as a top item is
for (const platform of PLATFORMS) {
  test(`3: a nested item emptied in the editor is saved empty, and it is drawn without its dash outside the editor (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, 5);
    await empty(page, `${SLIDE} li li`, 'Nested item');
    const edited = await roundTrip(page);
    assert.equal(changed(edited, page.source), '    <li>Top<ul><li></li></ul></li>', 'the emptied nested item is not saved empty');
    const expected = [['li', 'Top<ul><li></li></ul>', '""', true], ['li', '', 'none', true], ['p', 'Below', '', true]];
    const shown = await show(t, edited, 5);
    assert.deepEqual(await shown.evaluate(marks(`document.querySelector(${js(SLIDE)})`)), expected, 'the show draws the emptied nested item with its dash');
    assert.deepEqual(errors(shown), []);
    const print = await show(t, edited, 5, '?print-pdf');
    const pages = await print.evaluate(`[...document.querySelectorAll('.pdf-page section')].filter((s) => s.querySelector('h2')?.textContent === 'Nested').map((s) => ${marks('s')})`);
    assert.ok(pages.length >= 1, 'the print view does not have the slide Nested');
    for (const p of pages) assert.deepEqual(p, expected, 'the print view draws the emptied nested item with its dash');
  });
}

// 3. a heading emptied in the editor keeps the line break of the browser in the file, since the theme
// gives the height of a line only to an empty item or paragraph, hence the heading keeps its line in
// the show, and the list under it stays where the editor draws it
const heights = `(() => { const s = document.querySelector(${js(SLIDE)}); return { h2: s.querySelector('h2').offsetHeight, ul: s.querySelector('ul').offsetTop }; })()`;
for (const platform of PLATFORMS) {
  test(`3: a heading emptied in the editor keeps its line in the show (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, 5);
    const was = await page.evaluate(heights);
    await empty(page, `${SLIDE} h2`, 'Nested');
    const editor = await page.evaluate(heights);
    const edited = await roundTrip(page);
    assert.equal(changed(edited, page.source), '  <h2><br></h2>', 'the emptied heading is not saved with its line break');
    const shown = await show(t, edited, 5);
    const live = await shown.evaluate(heights);
    assert.ok(was.h2 > 0 && editor.h2 === was.h2, `the editor draws the emptied heading at ${js(editor)}, where it was ${js(was)}`);
    assert.deepEqual(live, editor, 'the show draws the emptied heading and the list under it elsewhere than the editor');
  });
}

// 4. finding audit-fixes 4. the slide Pair has a text whose data-id equals its id. a copy of the
// slide by each route gives the copy a fresh id and keeps its data-id, so that Magic Move pairs the
// copy with the text of the slide before it
for (const platform of PLATFORMS) {
  for (const route of ['Magic Move to Copy of Slide', 'Duplicate Slide', 'Copy and Paste of the slide']) {
    test(`4: ${route} keeps the data-id of a text whose data-id equals its id (${platform})`, async (t) => {
      const page = await load(t, platform, DECK, 1);
      if (route === 'Duplicate Slide') await exec(page, 'slide.duplicate');
      else if (route === 'Magic Move to Copy of Slide') await exec(page, 'slide.magicMove');
      else {
        await exec(page, 'slide.copy');
        await exec(page, 'slide.paste');
      }
      await sleep(300);
      const live = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section p')].filter((p) => p.textContent === 'Intro').map((p) => p.id + '|' + p.dataset.id)`);
      assert.deepEqual(live, ['intro|intro', 'intro-1|intro'], 'the copy does not keep the data-id');
      const edited = await roundTrip(page);
      assert.deepEqual([...edited.matchAll(/<p id="([^"]+)" data-id="([^"]+)"/g)].map((m) => `${m[1]}|${m[2]}`), ['intro|intro', 'intro-1|intro'], 'the file does not keep the data-id of the copy');
    });
  }
}

// the place of the mark and of the first words of each item shown under root, in slide px: the
// left and the right of the box of its ::before, read from the box model of the DevTools
// protocol, the left of its first letter, and the top of the mark under the top of the line of
// these words. root is an expression of the page, and the items are those of selector under it
async function placed(page, root, selector = 'li') {
  const words = await page.evaluate(`(() => {
    const scale = document.querySelector('.reveal .slides').getBoundingClientRect().width / Reveal.getConfig().width;
    return [...${root}.querySelectorAll(${js(selector)})].map((li) => {
      const text = [...li.childNodes].find((n) => n.nodeType === 3 && n.data.trim());
      const r = document.createRange();
      const k = text.data.search(/\\S/);
      r.setStart(text, k);
      r.setEnd(text, k + 1);
      const box = r.getBoundingClientRect();
      return { text: text.data.trim().slice(0, 12), left: box.left, top: box.top, scale };
    });
  })()`);
  await page.evaluate(`window.probed = [...${root}.querySelectorAll(${js(selector)})]`);
  // the protocol hands out the node of an object only after the document is requested
  await page.send('DOM.getDocument', { depth: -1 });
  const out = [];
  const { result } = await page.send('Runtime.evaluate', { expression: 'window.probed', returnByValue: false });
  const { result: list } = await page.send('Runtime.getProperties', { objectId: result.objectId, ownProperties: true });
  const items = list.filter((p) => /^\d+$/.test(p.name)).sort((a, b) => a.name - b.name);
  for (let i = 0; i < items.length; i++) {
    const { nodeId } = await page.send('DOM.requestNode', { objectId: items[i].value.objectId });
    const { node } = await page.send('DOM.describeNode', { nodeId, depth: 1 });
    const before = node.pseudoElements?.find((p) => p.pseudoType === 'before');
    const w = words[i];
    let mark = null;
    if (before) {
      const { model } = await page.send('DOM.getBoxModel', { backendNodeId: before.backendNodeId });
      const q = model.border;
      mark = { left: q[0], right: q[2], top: q[1] };
    }
    const s = w.scale;
    out.push({ text: w.text, gap: mark && Math.round((w.left - mark.left) / s), after: mark && Math.round((w.left - mark.right) / s), drop: mark && Math.round((mark.top - w.top) / s) });
  }
  return out;
}

// 5. finding review-fixes 3. the slide Centered has a centered list of chevrons whose first item
// holds a wider nested list, a centered numbered list with a nested numbered list, a centered list
// of rings with a nested list, and a list at the left. the slide Shaped has a list of chevrons in a
// shape, which centers its words. every chevron starts 45 px before its words as at the left, a
// number 54 px, and a ring 47 px, and each mark is drawn as far under the top of its line as at the
// left of the item. a nested item is 36 px high
const CENTERED = [['Short', 45, 28], ['A much longe', 45, 19], ['Bravo', 45, 28], ['A long outer', 54, 1], ['Inner', 54, 1], ['Ring', 47, 30], ['A much longe', 45, 19], ['Plain left', 45, 28]];
const SHAPED = [['Goal', 45, 28], ['A much longe', 45, 28]];

for (const platform of PLATFORMS) {
  for (const where of ['show', 'editor']) {
    test(`5: the mark of each item of a centered list, a nested list, and a list in a shape is drawn beside its words (${where}, ${platform})`, async (t) => {
      const page = where === 'editor' ? await load(t, platform, DECK, 2) : await show(t, readFileSync(DECK, 'utf8'), 2);
      const centered = await placed(page, `document.querySelector(${js(SLIDE)})`);
      assert.deepEqual(centered.map((m) => [m.text, m.gap, m.drop]), CENTERED, `a mark is not beside its words: ${js(centered)}`);
      await page.evaluate('Reveal.slide(3)');
      await sleep(300);
      const shaped = await placed(page, `document.querySelector(${js(SLIDE)})`);
      assert.deepEqual(shaped.map((m) => [m.text, m.gap, m.drop]), SHAPED, `a mark of the shape is not 54 px before its words: ${js(shaped)}`);
      assert.deepEqual(errors(page), []);
    });
  }
}

// 6. the slide Numbers has four numbered lists that start at 1, 9, 12, and 123. the number of each
// item ends 30 px before its words, the gap of one digit, and the words stay 54 px into the item
const NUMBERS = [['One', 30], ['Nine', 30], ['Twelve', 30], ['Many', 30]];

for (const platform of PLATFORMS) {
  for (const where of ['show', 'editor', 'print view']) {
    test(`6: the number of an item ends 30 px before its words for 1, 9, 12, and 123 (${where}, ${platform})`, async (t) => {
      let page;
      let root = `document.querySelector(${js(SLIDE)})`;
      if (where === 'editor') page = await load(t, platform, DECK, 4);
      else if (where === 'show') page = await show(t, readFileSync(DECK, 'utf8'), 4);
      else {
        page = await show(t, readFileSync(DECK, 'utf8'), 4, '?print-pdf');
        root = `[...document.querySelectorAll('.pdf-page section')].find((s) => s.querySelector('h2')?.textContent === 'Numbers')`;
      }
      const numbers = await placed(page, root);
      assert.deepEqual(numbers.map((m) => [m.text, m.after]), NUMBERS, `a number does not end 30 px before its words: ${js(numbers)}`);
      const indent = await page.evaluate(`[...${root}.querySelectorAll('li')].map((li) => getComputedStyle(li).paddingLeft)`);
      assert.deepEqual(indent, ['54px', '54px', '54px', '54px'], 'the words of an item are moved');
      assert.deepEqual(errors(page), []);
    });
  }
}
