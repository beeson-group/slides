// regression tests of R8.3 on both platforms with trusted input, for findings of round 3 of the
// council. every popover of the editor is put by one rule, beside its target, off the text of its
// slide, and inside the canvas. a key of the keyboard sheet is listed at one command only. Use
// Rehearsed Timings is checked only when the deck has timings. the fill handle of a table follows
// the pointer, and the Table pane counts the range while the handle is dragged. the frame of a
// cell is drawn outside its text, and a new table and its bars are kept off a placeholder. Insert
// Table… opens with the size of the grid. the Text pane applies its formats to a block selected on
// the canvas. after each edit the text is checked byte for byte, after an undo and a redo, and
// after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { themeClasses, textProblems } from '../src/editor/model/scope.ts';
import { byteExact, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const PANEL = '#beeson-edit-panel-format';
// the slides of the demo deck with the display formula and with the figure and its caption
const EQUATIONS = 3;
const FIGURE = 4;
const P = '.reveal section.present > p';
const LIST = '.reveal section.present > ul';

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
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(window.BeesonEditor.status()))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const meets = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
const inside = (a, b) => a.left >= b.left - 0.5 && a.top >= b.top - 0.5 && a.right <= b.right + 0.5 && a.bottom <= b.bottom + 0.5;
const middle = (r) => ({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 });
let saves = 0;

// the box of the first shown element of a selector, with its right and bottom edges
const rectOf = (page, selector) => page.evaluate(`(() => {
  const el = [...document.querySelectorAll(${js(selector)})].find((e) => e.getClientRects().length);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
})()`);
// the boxes of the lines of the text and of the formulas of the elements of a selector, i.e. the
// text that a popover is kept off, without the empty part of a block
const inkOf = (page, selector) => page.evaluate(`(() => {
  const out = [];
  const range = document.createRange();
  for (const el of document.querySelectorAll(${js(selector)})) {
    for (const svg of el.querySelectorAll('mjx-container > svg')) out.push(svg.getBoundingClientRect());
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.data.trim() || n.parentElement.closest('mjx-container')) continue;
      range.selectNodeContents(n);
      out.push(...range.getClientRects());
    }
  }
  return out.filter((r) => r.width && r.height).map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
})()`);
const covered = async (page, pop, selector) => (await inkOf(page, selector)).find((r) => meets(pop, r));
const canvasOf = (page) => page.evaluate('(() => { const v = window.BeesonEditorShell.stage.viewport; return { left: v.left, top: v.top, right: v.right, bottom: v.bottom }; })()');

// the editor on the slide n of a deck served over HTTP, in a window of 1600 by 1000 px as in the
// shoot of the council, with the Format tab shown
async function load(t, platform, { deck = 'index.html', n = FIGURE, size = { width: 1600, height: 1000 } } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks the text before byte for byte after undos undos, the edit after as many redos,
// an edit within the scope rule, and an open of the saved edit without problems. the saved text
// becomes page.source, the text before the next check
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  const added = textProblems(edited, THEME);
  for (const p of textProblems(page.source, THEME)) if (added.includes(p)) added.splice(added.indexOf(p), 1);
  assert.deepEqual(added, [], 'the edit is out of the scope rule');
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r8-3-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

// the words text selected in the first element at selector, with its block focused
const selectWords = (page, selector, text) => page.evaluate(`(() => {
  const el = document.querySelector(${js(selector)});
  el.closest('[contenteditable="true"]').focus();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const at = n.data.indexOf(${js(text)});
    if (at < 0) continue;
    const r = document.createRange();
    r.setStart(n, at);
    r.setEnd(n, at + ${text.length});
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    return true;
  }
  return false;
})()`);

// finding 1 of R8.3: the link editor covered the first two items of the list under its word
// (state 126). the formula sheets of states 45 and 79 are put by the same rule
for (const platform of PLATFORMS) {
  test(`the link editor of a word is put beside its paragraph, off the list under it and inside the canvas (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, P);
    assert.ok(await selectWords(page, P, 'matplotlib'));
    await frames(page);
    await exec(page, 'text.link', { kind: 'email' });
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-link[open]')`);
    await sleep(150);
    const pop = await rectOf(page, 'dialog.beeson-edit-link');
    const canvas = await canvasOf(page);
    assert.ok(inside(pop, canvas), `the link editor ${js(pop)} is not inside the canvas ${js(canvas)}`);
    for (const sel of [P, `${LIST} > li:nth-child(1)`, `${LIST} > li:nth-child(2)`, `${LIST} > li:nth-child(3)`, '.reveal section.present h2', '.reveal section.present figcaption']) {
      const line = await covered(page, pop, sel);
      assert.ok(!line, `the link editor ${js(pop)} covers a line of ${sel} at ${js(line)}`);
    }
    assert.ok(await page.evaluate(`!!document.querySelector('dialog.beeson-edit-link').dataset.beside`), 'the link editor does not have an arrow at its target');
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('dialog.beeson-edit-link[open]')`);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`the formula sheets are put by the same rule, beside their target inside the canvas and off the text (${platform})`, async (t) => {
    const page = await load(t, platform, { n: EQUATIONS });
    // state 45, the TeX sheet of the display formula
    await click(page, '.reveal section.present div.math mjx-container');
    await page.waitFor(`!!document.querySelector('.beeson-math')`);
    await sleep(300);
    let pop = await rectOf(page, '.beeson-math');
    const canvas = await canvasOf(page);
    assert.ok(inside(pop, canvas), `the TeX sheet ${js(pop)} is drawn past the canvas ${js(canvas)}`);
    for (const sel of ['div.math', 'h2', '> p']) {
      const line = await covered(page, pop, `.reveal section.present ${sel}`);
      assert.ok(!line, `the TeX sheet ${js(pop)} covers a line of ${sel} at ${js(line)}`);
    }
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('.beeson-math')`);
    await byteExact(page);
    // state 79, the sheet of a new formula under the list of the slide with the figure
    await page.evaluate(`Reveal.slide(${FIGURE})`);
    await frames(page);
    await click(page, `${LIST} > li:last-child`);
    await press(page, 'Escape');
    await exec(page, 'insert.formula');
    await page.waitFor(`!!document.querySelector('.beeson-math')`);
    await sleep(300);
    pop = await rectOf(page, '.beeson-math');
    assert.ok(inside(pop, canvas), `the sheet ${js(pop)} is not inside the canvas ${js(canvas)}`);
    for (const sel of ['div.math', 'figcaption', '> p', 'h2']) {
      const line = await covered(page, pop, `.reveal section.present ${sel}`);
      assert.ok(!line, `the sheet ${js(pop)} covers a line of ${sel} at ${js(line)}`);
    }
    assert.ok(!meets(pop, await rectOf(page, '.reveal section.present div.math')), `the sheet ${js(pop)} covers its new formula`);
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('.beeson-math')`);
    if ((await render(page)) !== page.source) await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}
