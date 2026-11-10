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

// the rows of the sheet of keyboard shortcuts, each as its group, its label, and its keys, read
// from the sheet opened from the Help menu
async function sheet(page) {
  await exec(page, 'help.keys');
  await frames(page);
  const rows = await page.evaluate(`[...document.querySelectorAll('dialog.beeson-edit-keys section')].flatMap((s) => [...s.querySelectorAll('.row')].map((r) => ({ group: s.querySelector('h3').textContent, label: r.firstChild.textContent, keys: r.lastChild.textContent })))`);
  await press(page, 'Escape');
  await frames(page);
  return rows;
}

// finding 2 of R8.3: Shift+F3 was listed at Find Previous and at Change Case on Windows and Linux
// (states 175 and 209). a key may be listed at two rows of the menus only when one of its commands
// is taken in the navigator alone, e.g. Delete at Delete and at Delete Slide, as in both apps
for (const platform of PLATFORMS) {
  test(`each key of the keyboard sheet is listed at one command of a pane, which the key runs (${platform})`, async (t) => {
    const page = await load(t, platform);
    const rows = await sheet(page);
    assert.ok(rows.length > 90, `the sheet lists ${rows.length} rows`);
    const caseKey = platform === 'mac' ? '⇧F3' : 'Shift+F3';
    const listed = rows.filter((r) => r.keys.split(', ').includes(caseKey)).map((r) => `${r.group} > ${r.label}`);
    assert.deepEqual(listed, ['Format > Change Case'], `${caseKey} is not listed at Change Case alone`);
    assert.deepEqual(await page.evaluate('window.BeesonEditorShell.sheetClashes()'), [], 'a key is listed at two commands of one pane of the sheet');
    const previous = rows.find((r) => r.label === 'Find Previous').keys;
    // the key of Change Case changes the case of the words selected in a text
    await click(page, P);
    assert.ok(await selectWords(page, P, 'matplotlib'));
    await frames(page);
    await press(page, 'Shift+F3');
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelector(${js(P)}).textContent.includes('MATPLOTLIB')`), true, 'Shift+F3 does not change the case of the words');
    await roundTrip(page);
    // the key of Find Previous selects a match of the query, also from the caret in a text
    await exec(page, 'find.open', 'styles');
    await frames(page);
    await press(page, 'Escape');
    await click(page, `${LIST} > li:first-child`);
    await frames(page);
    await press(page, platform === 'mac' ? 'Mod+Shift+G' : 'Ctrl+Shift+F3');
    await frames(page);
    assert.equal(await page.evaluate('getSelection().toString()'), 'styles', `${previous} does not select the match before the caret in a text`);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}

// finding 3 of R8.3: Use Rehearsed Timings was checked while no timings were recorded (state 193)
for (const platform of PLATFORMS) {
  test(`Use Rehearsed Timings is checked and enabled only when the deck has timings (${platform})`, async (t) => {
    const page = await load(t, platform);
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal .slides section[data-timing]').length`), 0);
    assert.equal((await state(page, 'play.clearTimings')).enabled, false);
    let s = await state(page, 'play.useTimings');
    assert.equal(s.enabled, false, 'Use Rehearsed Timings is enabled without timings');
    // a switch turned on in the storage is not shown checked while the deck has no timings
    await page.evaluate(`localStorage.setItem('beeson-use-timings', '1')`);
    s = await state(page, 'play.useTimings');
    assert.equal(s.checked, false, 'Use Rehearsed Timings is checked without timings');
    // a timing of the current slide, as a rehearsal writes it
    await page.evaluate(`window.BeesonEditor.doc.setTag(document.querySelector('.reveal section.present'), { attrs: { 'data-timing': '12' } }, 'timing')`);
    await frames(page);
    s = await state(page, 'play.useTimings');
    assert.equal(s.enabled, true, 'Use Rehearsed Timings is dimmed with timings');
    assert.equal(s.checked, true, 'Use Rehearsed Timings is not checked with timings and the switch on');
    assert.equal((await state(page, 'play.clearTimings')).enabled, true);
    await exec(page, 'play.clearTimings');
    await frames(page);
    s = await state(page, 'play.useTimings');
    assert.deepEqual([s.enabled, s.checked], [false, false], 'Use Rehearsed Timings is live after Clear Timings');
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}

const cellAt = (r, c) => `.reveal section.present table tr:nth-child(${r + 1}) > :nth-child(${c + 1})`;
const paneNote = (page) => page.evaluate(`document.querySelector('${PANEL} .ed-note')?.textContent`);

// a new Content slide after the slide with the figure with a table of 3 columns by 5 rows from the
// grid of the button Table, with rows 2 and 3 typed, as in states 197 and 198
async function tableSlide(page) {
  await exec(page, 'slide.new.content');
  await frames(page);
  await exec(page, 'insert.table', { rows: 5, columns: 3 });
  await frames(page);
  for (const [r, c, text] of [[1, 0, '1'], [2, 0, '2'], [1, 1, 'Step 1'], [2, 1, 'Step 2'], [1, 2, 'orbit'], [2, 2, 'tube']]) {
    await click(page, cellAt(r, c));
    await type(page, text);
  }
  await frames(page);
}

// finding 4 of R8.3: the fill handle stood at the corner of the range during its own drag, and
// the Table pane read the range from before the drag (state 198)
for (const platform of PLATFORMS) {
  test(`the fill handle of a range follows the pointer, and the Table pane counts the range during the drag (${platform})`, async (t) => {
    const page = await load(t, platform);
    await tableSlide(page);
    const from = middle(await rectOf(page, cellAt(1, 0)));
    const to = middle(await rectOf(page, cellAt(2, 2)));
    await drag(page, from, { dx: to.x - from.x, dy: to.y - from.y });
    await frames(page);
    assert.match(await paneNote(page), /cells A2:C3$/);
    const handle = middle(await rectOf(page, '.beeson-table-bars .fill'));
    const end = middle(await rectOf(page, cellAt(4, 2)));
    await drag(page, handle, { dy: end.y - handle.y, steps: 12, hold: true });
    await frames(page);
    const moved = middle(await rectOf(page, '.beeson-table-bars .fill'));
    assert.ok(Math.abs(moved.x - handle.x) < 3 && Math.abs(moved.y - end.y) < 3, `the fill handle at ${js(moved)} is not under the pointer at ${js({ x: handle.x, y: end.y })}`);
    assert.match(await paneNote(page), /cells A2:C5$/, 'the Table pane does not count the range during the drag');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: handle.x, y: end.y, button: 'left', clickCount: 1 });
    await page.waitFor(`window.BeesonEditor.state('edit.undo').label === 'Undo Autofill'`);
    await frames(page);
    assert.match(await paneNote(page), /cells A2:C5$/);
    const corner = await rectOf(page, '.beeson-table-bars .cell');
    const back = middle(await rectOf(page, '.beeson-table-bars .fill'));
    assert.ok(Math.abs(back.x - corner.right) < 6 && Math.abs(back.y - corner.bottom) < 6, 'the fill handle is not back at the corner of the range after the drag');
    assert.deepEqual(errors(page), []);
  });
}
