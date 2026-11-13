// regression tests of R29.1 on both platforms, three leftovers of the skeptics: the sheet of a
// formula in a new box replaced by the sheet of another formula drops the box, an emptied item or
// paragraph that had a line break is saved empty, and a line glued to an element pushed by typing
// follows it in the entry of the typing

import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch, printView } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const SLIDE = '.reveal .slides > section.present';
const DECK = 'test/pages/editor-r29-1.html';
const SOURCE = readFileSync(DECK, 'utf8');
const [FORMULA, BREAKS, FLOW] = [0, 1, 2];

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
const call = (page, fn, ...args) => page.evaluate(`(${fn})(${args.map(js).join(', ')})`);

// the editor on slide n of the deck, with the storage of the origin emptied
async function load(t, platform, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${DECK}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = SOURCE;
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(SOURCE)})`)).problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await sleep(150);
  return page;
}

// the lines of text that differ from those of the file, for a short message of a failed assertion
const changed = (text, file) => {
  const was = file.split('\n');
  return text.split('\n').filter((l, i) => l !== was[i]).join('\n');
};

// the key of an inline formula: Cmd+Option+E on a Mac, and Alt+= elsewhere, sent as the browser
// sends it
async function formulaKey(page, platform) {
  if (platform === 'mac') return press(page, 'Mod+Alt+E');
  const base = { key: '=', code: 'Equal', windowsVirtualKeyCode: 187, modifiers: 1 };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: '=', unmodifiedText: '=' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

// a trusted click on an empty point of the slide, near its lower left corner
async function clickAway(page) {
  const at = await page.evaluate(`(() => { const r = document.querySelector(${js(SLIDE)}).getBoundingClientRect(); return { x: r.left + 40, y: r.bottom - 30 }; })()`);
  await click(page, at);
  await sleep(300);
}

// 1. a new text box, or the empty words of a shape, with the sheet of a new inline formula open,
// and a click on the formula of the slide, which replaces the sheet with the sheet of this formula.
// the words are dropped as at a click away, and the file and the history are kept through two
// clicks away after it. the text box is kept as at a click away, written as an empty paragraph in
// the entry of its insert
const ROUTES = [
  ['a new text box', async (page) => {
    await click(page, '.beeson-edit-top [data-command="insert.text"]');
    await sleep(300);
    assert.equal(await page.evaluate(`!!document.querySelector(${js(`${SLIDE} .beeson-pending`)})`), true, 'the box is not drawn');
  }, `${SLIDE} .beeson-pending`, true],
  ['the empty words of a shape', async (page) => {
    await click(page, `${SLIDE} > .shape`);
    await frames(page);
    await press(page, 'Enter');
    await frames(page);
    assert.equal(await page.evaluate(`!!document.activeElement?.matches(${js(`${SLIDE} > .shape > p`)})`), true, 'the caret is not in the words of the shape');
  }, `${SLIDE} > .shape > p[data-generated]`, false],
];

for (const platform of PLATFORMS) {
  for (const [name, open, left, kept] of ROUTES) {
    test(`1: the sheet of a formula in ${name} replaced by the sheet of another formula ${kept ? 'keeps it empty' : 'drops it, and the file and the history are kept'} (${platform})`, async (t) => {
      const page = await load(t, platform, FORMULA);
      const label = (await state(page, 'edit.undo')).label;
      await open(page);
      await formulaKey(page, platform);
      await page.waitFor(`!!document.querySelector('.beeson-math textarea')`);
      await type(page, 'x^2');
      await sleep(300);
      await click(page, `${SLIDE} > p mjx-container`);
      await sleep(400);
      assert.equal(await page.evaluate(`document.querySelector('.beeson-math .title')?.textContent ?? null`), 'Edit Formula', 'the sheet of the formula of the slide is not open');
      assert.equal(await page.evaluate(`document.querySelector('.beeson-math textarea').value`), 'a', 'the sheet does not hold the TeX of the formula of the slide');
      assert.equal(await page.evaluate(`document.querySelector(${js(left)})?.outerHTML ?? null`), null, 'the box is left when its sheet is replaced');
      for (const k of [1, 2]) {
        await clickAway(page);
        assert.equal(await page.evaluate(`!!document.querySelector('.beeson-math')`), false, 'the sheet is still open');
        assert.equal(await page.evaluate(`document.querySelector(${js(left)})?.outerHTML ?? null`), null, `the box is left after click away ${k}`);
        if (kept) {
          assert.equal((await render(page)).match(/<p( [^>]*)?><\/p>/g)?.length, 1, 'the empty box is not written as an empty paragraph');
          assert.equal((await state(page, 'edit.undo')).label, 'Undo Insert Text Box');
        } else {
          assert.equal(await render(page), page.source, 'the file is changed');
          assert.equal((await state(page, 'edit.undo')).label, label, 'the history has an entry');
          assert.equal((await status(page)).dirty, false, 'the editor reports unsaved changes');
        }
      }
      assert.deepEqual(errors(page), []);
    });
  }
}

// 1. a new text box with a formula inserted into it is kept when the sheet of a second formula in
// it is replaced by the sheet of the formula of the slide, as at a click away
for (const platform of PLATFORMS) {
  test(`1: a new text box with a formula entered is kept when the sheet of a second formula is replaced (${platform})`, async (t) => {
    const page = await load(t, platform, FORMULA);
    await click(page, '.beeson-edit-top [data-command="insert.text"]');
    await sleep(300);
    await formulaKey(page, platform);
    await page.waitFor(`!!document.querySelector('.beeson-math textarea')`);
    await type(page, 'x^2');
    await sleep(400);
    await press(page, 'Mod+Enter');
    await page.waitFor(`!document.querySelector('.beeson-math')`);
    await sleep(300);
    const entered = await render(page);
    assert.ok(entered.includes('\\(x^2\\)'), 'the formula is not written into the box');
    const label = (await state(page, 'edit.undo')).label;
    await formulaKey(page, platform);
    await page.waitFor(`!!document.querySelector('.beeson-math textarea')`);
    await type(page, 'y');
    await sleep(300);
    await click(page, `${SLIDE} > p mjx-container`);
    await sleep(400);
    await clickAway(page);
    assert.equal(await render(page), entered, 'the box with its formula is not kept');
    assert.equal((await state(page, 'edit.undo')).label, label, 'the history is changed');
    assert.deepEqual(errors(page), []);
  });
}

// the deck text written to a file of the root, served as a show at slide n, or as the print view
let saves = 0;
async function show(t, text, n, query = '') {
  const file = `test/pages/editor-r29-1-${process.pid}-${++saves}.html`;
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

// the shown element of selector whose text holds needle, as an expression
const blockOf = (selector, needle) => `[...document.querySelectorAll(${js(selector)})].find((el) => el.getBoundingClientRect().width && el.textContent.includes(${js(needle)}))`;

// erase() presses Backspace count times from the end of the block of selector whose text holds
// needle, then Esc
async function erase(page, selector, needle, count) {
  const at = await page.evaluate(`(() => { const r = ${blockOf(selector, needle)}.getBoundingClientRect(); return { x: r.right - 4, y: r.bottom - 12 }; })()`);
  await click(page, at);
  await frames(page);
  await page.evaluate(`(() => { const el = ${blockOf(selector, needle)}; const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r); })()`);
  for (let i = 0; i < count; i++) await press(page, 'Backspace');
  await press(page, 'Escape');
  await frames(page);
}

// the text, the mark, and whether it has a height, of each item and paragraph under root
const marks = (root) => `[...${root}.querySelectorAll('li, p')].map((el) => [el.localName, el.innerHTML, el.localName === 'li' ? getComputedStyle(el, '::before').content : '', Math.round(el.getBoundingClientRect().height) > 0])`;

// 2. an item and a paragraph whose words have a line break, emptied by Backspace, are saved empty
// without the line breaks that the browser leaves, and the item is drawn without its dash in the
// show and in the print view. a line break between words that are kept is kept
for (const platform of PLATFORMS) {
  test(`2: an item and a paragraph with a line break, emptied in the editor, are saved empty (${platform})`, async (t) => {
    const page = await load(t, platform, BREAKS);
    await erase(page, `${SLIDE} li`, 'First line', 'First line'.length + 1 + 'second line'.length);
    await erase(page, `${SLIDE} li`, 'Words', ' here'.length);
    await erase(page, `${SLIDE} > p`, 'Para one', 'Para one'.length + 1 + 'Para two'.length);
    const edited = await render(page);
    assert.equal(changed(edited, page.source), '    <li></li>\n    <li>Words<br>kept</li>\n  <p></p>', 'the emptied blocks are not saved empty');
    for (let i = 0; i < 3; i++) await undo(page);
    assert.equal(await render(page), page.source, 'three undos do not give the file back');
    for (let i = 0; i < 3; i++) await redo(page);
    assert.equal(await render(page), edited, 'three redos do not write the edits again');
    const { text } = await saveAndReopen(page, 'r29-1-breaks.html');
    assert.equal(text, edited);
    assert.deepEqual(errors(page), []);
    const expected = [['li', '', 'none', true], ['li', 'Keep', '""', true], ['li', 'Words<br>kept', '""', true], ['p', '', '', true], ['p', 'Tail', '', true]];
    const shown = await show(t, edited, BREAKS);
    assert.deepEqual(await shown.evaluate(marks(`document.querySelector(${js(SLIDE)})`)), expected, 'the show draws the emptied item with its dash');
    assert.deepEqual(errors(shown), []);
    const print = await show(t, edited, BREAKS, '?print-pdf');
    const pages = await print.evaluate(`[...document.querySelectorAll('.pdf-page section')].filter((s) => s.querySelector('h2')?.textContent === 'Breaks').map((s) => ${marks('s')})`);
    assert.ok(pages.length >= 1, 'the print view does not have the slide Breaks');
    for (const p of pages) assert.deepEqual(p, expected, 'the print view draws the emptied item with its dash');
  });
}

// the point on the screen of a point in slide px, with the scale k of the slide
function screenOf(p) {
  const s = document.querySelector('.reveal .slides');
  const r = s.getBoundingClientRect();
  const k = r.width / s.offsetWidth;
  return { x: r.left + p.x * k, y: r.top + p.y * k, k };
}

// the box of the element of sel in slide px
function boxIn(sel) {
  const s = document.querySelector('.reveal .slides');
  const r = s.getBoundingClientRect();
  const k = r.width / s.offsetWidth;
  const b = document.querySelector(sel).getBoundingClientRect();
  return { left: (b.left - r.left) / k, top: (b.top - r.top) / k, width: b.width / k, height: b.height / k };
}

// the two ends of the straight line of sel in slide px, read from its translate and its line
function endsOf(sel) {
  const svg = document.querySelector(sel);
  const [tx, ty] = (svg.style.translate || '0px 0px').split(/\s+/).map((v) => parseFloat(v) || 0);
  const c = svg.querySelector(':scope > line');
  return [+c.getAttribute('x1') + tx, +c.getAttribute('y1') + (ty || 0), +c.getAttribute('x2') + tx, +c.getAttribute('y2') + (ty || 0)].map(Math.round);
}

// 3. a line drawn from a shape to the middle of the right edge of a table in the flow under a
// paragraph. words typed at the end of the paragraph wrap it onto more lines and push the table
// down, and the end of the line follows the table at once, in the entry of the typing, also in the
// text that a save writes
for (const platform of PLATFORMS) {
  test(`3: a line glued to a table pushed down by typing follows it in the entry of the typing (${platform})`, async (t) => {
    const page = await load(t, platform, FLOW);
    const table = await call(page, boxIn, `${SLIDE} table`);
    await exec(page, 'insert.line');
    const a = await call(page, screenOf, { x: 1400, y: 760 });
    await drag(page, a, { dx: (table.left + table.width - 1400) * a.k, dy: (table.top + table.height / 2 - 760) * a.k, steps: 12 });
    await sleep(150);
    const drawn = await render(page);
    const tag = /<svg class="line"[^>]*>/.exec(drawn)?.[0] ?? '';
    assert.ok(/data-from="a1 0\.5 0\.5"/.test(tag) && /data-to="a2 1 0\.5"/.test(tag), `the line is not glued to the shape and the table: ${tag}`);
    const line = `${SLIDE} > svg.line`;
    const end = (box) => [Math.round(box.left + box.width), Math.round(box.top + box.height / 2)];
    assert.deepEqual((await call(page, endsOf, line)).slice(2), end(table), 'the line is not drawn to the table');
    const p = await call(page, boxIn, `${SLIDE} > p`);
    await click(page, await call(page, screenOf, { x: p.left + p.width - 4, y: p.top + p.height / 2 }));
    await frames(page);
    await press(page, 'End');
    for (const word of ' and many more words that wrap the paragraph onto a second line and onto a third line of the column'.split(/(?= )/)) {
      await type(page, word);
      await sleep(20);
    }
    await sleep(150);
    await press(page, 'Escape');
    await frames(page);
    const pushed = await call(page, boxIn, `${SLIDE} table`);
    assert.ok(pushed.top - table.top > 60, `the typing does not push the table down: ${table.top} to ${pushed.top}`);
    assert.deepEqual((await call(page, endsOf, line)).slice(2), end(pushed), 'the line is left behind by the table');
    const typed = await render(page);
    const saved = /<svg class="line"[^>]*>/.exec(typed)?.[0] ?? '';
    assert.notEqual(saved, tag, 'the save writes the line off its glue');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Typing', 'the glue is not in the entry of the typing');
    await undo(page);
    await frames(page);
    assert.equal(await render(page), drawn, 'one undo of the typing does not put the line back');
    await redo(page);
    await frames(page);
    assert.equal(await render(page), typed, 'a redo of the typing does not move the line again');
    const { text } = await saveAndReopen(page, 'r29-1-flow.html');
    assert.equal(text, typed);
    assert.deepEqual(errors(page), []);
  });
}
