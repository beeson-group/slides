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
async function load(t, platform, { deck = 'test-deck.html', n = FIGURE, size = { width: 1600, height: 1000 } } = {}) {
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

// the box inside the border of the frame of the selected cells
const frameInside = (page) => page.evaluate(`(() => {
  const el = document.querySelector('.beeson-table-bars .cell');
  const r = el.getBoundingClientRect();
  const w = parseFloat(getComputedStyle(el).borderLeftWidth);
  return { left: r.left + w, top: r.top + w, right: r.right - w, bottom: r.bottom - w };
})()`);
// the box of the ink of the text of an element, from the range of its content
const cellInk = (page, selector) => page.evaluate(`(() => {
  const r = document.createRange();
  r.selectNodeContents(document.querySelector(${js(selector)}));
  const b = r.getBoundingClientRect();
  return { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
})()`);

// finding 5 of R8.3: the frame of a merged cell was drawn over its first characters, and the
// placeholder of a new slide under the column bar of its table (state 96)
for (const platform of PLATFORMS) {
  test(`the frame of a selected cell is drawn outside its text, and the bars of a new table are kept off the placeholder (${platform})`, async (t) => {
    const page = await load(t, platform);
    await tableSlide(page);
    const holder = await rectOf(page, '.reveal section.present > p:empty');
    assert.ok(holder, 'the new slide does not have an empty paragraph');
    for (const sel of ['.beeson-table-bars .bar', '.beeson-table-bars .bar ~ .bar', '.beeson-table-bars .round', '.reveal section.present table']) {
      const r = await rectOf(page, sel);
      assert.ok(!meets(r, holder), `${sel} at ${js(r)} is drawn over the placeholder at ${js(holder)}`);
    }
    // the cells A2 to B3 merged, as in state 96
    const from = middle(await rectOf(page, cellAt(1, 0)));
    const to = middle(await rectOf(page, cellAt(2, 1)));
    await drag(page, from, { dx: to.x - from.x, dy: to.y - from.y });
    await frames(page);
    await exec(page, 'table.merge');
    await frames(page);
    const frame = await frameInside(page);
    const ink = await cellInk(page, cellAt(1, 0));
    assert.ok(inside(ink, frame), `the text of the merged cell at ${js(ink)} is drawn under its frame, whose inside is ${js(frame)}`);
    // one cell of the first column selected as a block, whose text starts at the left edge of the
    // cell
    await click(page, cellAt(3, 0));
    await press(page, 'Escape');
    await frames(page);
    // its frame is on the edges of the cell, on its padding at the right, the top, and the bottom,
    // hence the box of its text, without the padding, is inside the frame
    const one = await frameInside(page);
    const text = await page.evaluate(`(() => {
      const c = document.querySelector(${js(cellAt(3, 0))});
      const r = c.getBoundingClientRect();
      const k = r.width / c.offsetWidth;
      const p = (side) => parseFloat(getComputedStyle(c)['padding' + side]) * k;
      return { left: r.left + p('Left'), top: r.top + p('Top'), right: r.right - p('Right'), bottom: r.bottom - p('Bottom') };
    })()`);
    assert.ok(inside(text, one), `the box of the text of the cell at ${js(text)} is drawn under its frame, whose inside is ${js(one)}`);
    assert.deepEqual(errors(page), []);
  });
}

const sizeFields = (page) => page.evaluate(`Object.fromEntries([...document.querySelectorAll('dialog.beeson-table-size input')].map((i) => [i.name, i.value]))`);

// finding 6 of R8.3: Insert Table… opened with 6 rows after the pointer rested on 3 rows of the
// grid (states 196 and 205)
for (const platform of PLATFORMS) {
  test(`Insert Table… opens with the size that the pointer last rested on in the grid, and inserts every row (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'slide.new.content');
    await frames(page);
    await click(page, '.beeson-edit-top [data-command="insert.table"]');
    await page.waitFor(`!!document.querySelector('dialog.beeson-table-picker[open]')`);
    // the cell of 4 columns by 3 rows of the grid of 10 columns
    const { x, y } = middle(await rectOf(page, '.beeson-table-picker .grid > :nth-child(24)'));
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    assert.equal(await page.evaluate(`document.querySelector('.beeson-table-picker .size').textContent`), '4 × 3 Table');
    await click(page, '.beeson-table-picker .more');
    await page.waitFor(`!!document.querySelector('dialog.beeson-table-size[open]')`);
    assert.deepEqual(await sizeFields(page), { columns: '4', rows: '3' }, 'the dialog does not open with the size of the grid');
    await press(page, 'Tab');
    await type(page, '9');
    await press(page, 'Enter');
    await page.waitFor(`!!document.querySelector('.reveal section.present table')`);
    await frames(page);
    const shape = await page.evaluate(`[...document.querySelector('.reveal section.present table').rows].map((tr) => tr.cells.length)`);
    assert.deepEqual(shape, Array(9).fill(4), 'the table is not inserted with every row');
    await roundTrip(page, 2);
    // a later Insert Table… without a rest on the grid opens with the size typed last
    await click(page, '.beeson-edit-top [data-command="insert.table"]');
    await page.waitFor(`!!document.querySelector('dialog.beeson-table-picker[open]')`);
    await click(page, '.beeson-table-picker .more');
    await page.waitFor(`!!document.querySelector('dialog.beeson-table-size[open]')`);
    assert.deepEqual(await sizeFields(page), { columns: '4', rows: '9' });
    await press(page, 'Escape');
    assert.deepEqual(errors(page), []);
  });
}

// the commands of the Text pane that apply to a text selection, by their ids, apart from Bigger
const TEXT_PANE = ['text.style.body', 'text.formatPainter', 'text.bold', 'text.italic', 'text.strike', 'text.code', 'text.superscript', 'text.subscript', 'text.smaller', 'text.case.upper', 'text.tone.accent', 'text.link', 'text.clear'];
// the dimmed controls of the Text pane, each as its command or its text, and its tooltip
const dimmed = (page) => page.evaluate(`[...document.querySelectorAll('${PANEL} button:disabled')].map((b) => [b.dataset.command || b.textContent, b.title])`);
// the controls that are dimmed by design on a block of one level that does not have a link, and
// Start at, which is set only on a numbered list
const UNUSED = /^text\.(indent|outdent|removeLink|list\.start)$|^(Remove Link|Increase Indent Level|Decrease Indent Level)$/;

// finding 7 of R8.3: with a list selected as a block, the Text pane dimmed every control but the
// list buttons (state 190)
for (const platform of PLATFORMS) {
  test(`the Text pane applies its formats to a list selected as a block (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, P);
    await press(page, 'Escape');
    await frames(page);
    await click(page, `${PANEL} [data-command="text.list.ul"]`);
    await frames(page);
    const off = [];
    for (const id of TEXT_PANE) if (!(await state(page, id)).enabled) off.push(id);
    assert.deepEqual(off, [], 'a command of the Text pane is dimmed for the list selected as a block');
    // Bigger stays dimmed with its reason, since the theme does not have a class of an item larger
    // than Body
    for (const [id, title] of (await dimmed(page)).filter(([id]) => !UNUSED.test(id))) {
      assert.ok(id === 'text.bigger' && / (because|since|not|only) /.test(title), `the control ${id} is dimmed for the list selected as a block with the tooltip ${js(title)}`);
    }
    // Bold, the accent tone, and Smaller are set on the whole text of the item, with the class of
    // the style Small on the item
    await click(page, `${PANEL} [data-command="text.bold"]`);
    await frames(page);
    await click(page, `${PANEL} .ed-swatches [data-command="text.tone.accent"]`);
    await frames(page);
    await click(page, `${PANEL} [data-command="text.smaller"]`);
    await frames(page);
    const text = await roundTrip(page, 4);
    assert.match(text, /<ul>\s*<li class="small">(<span class="tone-accent"><strong>|<strong><span class="tone-accent">)Export your matplotlib figure with the styles of the template\. It will show frameless\.(<\/strong><\/span>|<\/span><\/strong>)<\/li>\s*<\/ul>/);
    assert.deepEqual(errors(page), []);
  });

  test(`a control of the Text pane dimmed for a selected block says why in its tooltip (${platform})`, async (t) => {
    const page = await load(t, platform);
    for (const sel of [P, `${LIST} > li:first-child`, '.reveal section.present h2']) {
      await click(page, sel);
      await press(page, 'Escape');
      await frames(page);
      for (const [id, title] of await dimmed(page)) {
        if (UNUSED.test(id)) continue;
        assert.match(title, / (because|since|not|only) /, `the control ${id} is dimmed for ${sel} with the tooltip ${js(title)}, which does not give a reason`);
      }
    }
    assert.deepEqual(errors(page), []);
  });
}
