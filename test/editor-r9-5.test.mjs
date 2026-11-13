// regression tests of R9.5, the tables, on both platforms with trusted input. a table is selected
// as an object by the Esc ladder of Keynote, by Select Table, and by its move handle, and is then
// moved, resized in width, and deleted as any element. after each edit the text is checked byte for
// byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

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
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const middle = (r) => ({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 });
let saves = 0;

// the editor on a deck served over HTTP in a window of 1600 by 1000 px, on the slide n
async function load(t, platform, { deck = 'test-deck.html', n = 0, mode = 'light' } = {}) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }] });
  const url = `${server.origin}/${deck}?edit&still&theme=${mode}&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks the text before byte for byte after undos undos, the edit after as many redos,
// and an open of the saved edit without problems, which is the text before the next check
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r9-5-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

// newTable adds a slide with a table of 3 by 3 cells and the caret in its first cell, as the audit
// makes it, and keeps the text of the file after it as the text before the next check
async function newTable(page) {
  await exec(page, 'slide.new');
  await frames(page);
  await exec(page, 'insert.table', { rows: 3, columns: 3 });
  await frames(page);
  page.source = await render(page);
}

const PANE_NOTE = `document.querySelector('#beeson-edit-panel-format .ed-note')?.textContent ?? ''`;
const cellOf = (r, c) => `.reveal section.present table tr:nth-child(${r + 1}) > :nth-child(${c + 1})`;

// what is selected of the table of the current slide: the table as an object, the cells as a
// block, or a text, with the frame, the grips, and the rotate handle drawn, and its box on the
// screen and its translate
const TABLE = `(() => {
  const table = document.querySelector('.reveal section.present table');
  const shown = (el) => !!el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
  const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
  const sel = window.BeesonEditor.selection();
  const bars = document.querySelector('.beeson-table-bars');
  const outline = bars?.querySelector('.cell');
  const frame = [...document.querySelectorAll('.beeson-overlay .beeson-frame.selected')].find(shown);
  const grips = {};
  for (const g of document.querySelectorAll('.beeson-grip')) if (shown(g)) grips[g.dataset.handle] = box(g);
  return {
    table: !!table,
    object: sel.length === 1 && sel[0] === table,
    none: sel.length === 0 && !document.activeElement?.closest('td, th'),
    block: shown(outline) && outline.classList.contains('block'),
    caret: !!document.activeElement?.closest('td, th'),
    frame: frame ? box(frame) : null,
    grips,
    rotor: shown(document.querySelector('.beeson-rotor')),
    box: table ? box(table) : null,
    translate: table ? (table.style.translate || '0px 0px').split(' ').map(parseFloat) : null,
  };
})()`;

// isObject asserts that the table is selected as an object, with its frame and without a cell
// selected, and returns what TABLE reads
async function isObject(page, what) {
  const s = await page.evaluate(TABLE);
  assert.ok(s.object, `the table is not the selection ${what}`);
  assert.ok(!s.block, `a cell of the table is still selected as a block ${what}`);
  assert.ok(!s.caret, `the caret is still in a cell ${what}`);
  assert.ok(s.frame, `the table is not framed ${what}`);
  assert.doesNotMatch(await page.evaluate(PANE_NOTE), /cells? [A-Z]/, `the Table pane names a cell ${what}`);
  return s;
}

// finding select-move-resize-3: Esc from a cell selected as a block cleared the selection, and
// Select Table and the move handle left the cell selected, hence an arrow key moved the cell
for (const platform of PLATFORMS) {
  test(`Esc goes from the text of a cell to the cell, to the table as an object, and to nothing (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await newTable(page);
    let s = await page.evaluate(TABLE);
    assert.ok(s.caret, 'the caret is not in the new table');
    await press(page, 'Escape');
    await frames(page);
    s = await page.evaluate(TABLE);
    assert.ok(s.block, 'the first Esc does not select the cell as a block');
    assert.match(await page.evaluate(PANE_NOTE), /cell A1$/);
    await press(page, 'Escape');
    await frames(page);
    s = await isObject(page, 'after the second Esc');
    assert.ok(!s.rotor, 'a table selected as an object has a rotate handle');
    await press(page, 'Escape');
    await frames(page);
    s = await page.evaluate(TABLE);
    assert.ok(s.none, 'the third Esc does not clear the selection');
    assert.deepEqual(errors(page), []);
  });

  test(`Select Table and the move handle select the table as an object, which the arrow keys move and Delete deletes (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await newTable(page);
    await press(page, 'Escape');
    await frames(page);
    await click(page, '.beeson-table-bars .round[title="Select Table"]');
    await frames(page);
    let s = await isObject(page, 'after a click on Select Table');
    const [x0, y0] = s.translate;
    await press(page, 'ArrowRight');
    await frames(page);
    s = await isObject(page, 'after ArrowRight');
    assert.deepEqual(s.translate, [x0 + 1, y0], 'ArrowRight does not move the table selected as an object');
    assert.match(await render(page), new RegExp(`<table style="translate: ${x0 + 1}px ${y0}px">`));
    await roundTrip(page);

    // the move handle, pressed while a cell is selected as a block
    await click(page, cellOf(1, 1));
    await press(page, 'Escape');
    await frames(page);
    assert.match(await page.evaluate(PANE_NOTE), /cell B2$/);
    await click(page, '.beeson-overlay .beeson-handle');
    await frames(page);
    await isObject(page, 'after a click on the move handle');
    await press(page, 'ArrowDown');
    await frames(page);
    s = await isObject(page, 'after ArrowDown');
    assert.deepEqual(s.translate, [x0 + 1, y0 + 1], 'ArrowDown does not move the table selected as an object');
    for (const id of ['edit.cut', 'edit.copy', 'edit.duplicate', 'arrange.lock', 'element.delete']) {
      assert.equal((await state(page, id)).enabled, true, `${id} is not enabled on the table selected as an object`);
    }
    await press(page, 'Delete');
    await frames(page);
    s = await page.evaluate(TABLE);
    assert.ok(!s.table, 'Delete does not delete the table selected as an object');
    // the nudge down and the delete
    await roundTrip(page, 2);
    assert.deepEqual(errors(page), []);
  });

  test(`the grips at the left and right edges of a table selected as an object set the widths of its columns (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await newTable(page);
    await press(page, 'Escape');
    await press(page, 'Escape');
    await frames(page);
    let s = await isObject(page, 'after two Esc');
    assert.deepEqual(Object.keys(s.grips).sort(), ['e', 'w'], 'a table selected as an object does not have grips at its left and right edges only');
    const right = middle(s.grips.e);
    const left = middle(s.grips.w);
    const mid = (s.box.top + s.box.bottom) / 2;
    assert.ok(Math.abs(right.x - s.box.right) < 4 && Math.abs(right.y - mid) < 4, 'the right grip is not at the middle of the right edge');
    assert.ok(Math.abs(left.x - s.box.left) < 4 && Math.abs(left.y - mid) < 4, 'the left grip is not at the middle of the left edge');
    const was = s.box;
    await drag(page, right, { dx: 90, steps: 12 });
    await frames(page);
    s = await isObject(page, 'after a drag of the right grip');
    assert.ok(Math.abs(s.box.right - was.right - 90) < 4, `the right edge is moved by ${s.box.right - was.right} px for a drag of 90 px`);
    assert.ok(Math.abs(s.box.left - was.left) < 2, 'the left edge is moved by a drag of the right grip');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Resize Table');
    const widths = [...(await render(page)).matchAll(/<th style="width: (\d+)px">/g)].map((m) => Number(m[1]));
    assert.equal(widths.length, 3, 'the widths are not written into the cells of the first row');
    assert.ok(Math.max(...widths) - Math.min(...widths) <= 1, `the columns are not widened alike: ${widths}`);
    await roundTrip(page);

    // the open of the saved text clears the selection
    await click(page, cellOf(0, 0));
    await press(page, 'Escape');
    await press(page, 'Escape');
    await frames(page);
    const wide = (await isObject(page, 'after the open of the saved text and two Esc')).box;
    await drag(page, middle((await page.evaluate(TABLE)).grips.w), { dx: -60, steps: 12 });
    await frames(page);
    s = await isObject(page, 'after a drag of the left grip');
    assert.ok(Math.abs(wide.left - s.box.left - 60) < 4, `the left edge is moved by ${s.box.left - wide.left} px for a drag of -60 px`);
    assert.ok(Math.abs(s.box.right - wide.right) < 3, 'the right edge is moved by a drag of the left grip');
    await roundTrip(page);
    assert.deepEqual(errors(page), []);
  });
}

// what is open of the menus: the labels of the items of the one menu shown, or null
const MENU = `(() => {
  const m = [...document.querySelectorAll('.beeson-edit-menu')].find((el) => el.getClientRects().length);
  return m ? [...m.querySelectorAll('[role^="menuitem"]')].map((i) => i.textContent.trim()) : null;
})()`;
const segment = (bar, i) => `.beeson-table-bars .bar.${bar} > [data-index="${i}"]`;

// finding tables-equations-insert-3: a click on a column letter or a row number opened the menu of
// the table and moved the caret, and did not select the column or the row
for (const platform of PLATFORMS) {
  test(`a click on a column letter or a row number selects the column or the row, Shift extends it, and the arrow and a right-click open its menu (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: 'test/pages/editor-tables.html', n: 1 });
    await click(page, cellOf(2, 2));
    await frames(page);
    assert.match(await page.evaluate(PANE_NOTE), /cell C3$/);
    for (const [bar, i, modifiers, range] of [['cols', 1, '', 'B1:B4'], ['cols', 2, 'Shift', 'B1:C4'], ['rows', 3, '', 'A4:C4'], ['rows', 1, 'Shift', 'A2:C4'], ['cols', 0, '', 'A1:A4']]) {
      const what = `after a ${modifiers ? 'Shift-' : ''}click on ${bar === 'cols' ? 'the letter' : 'the number'} ${bar === 'cols' ? 'ABC'[i] : i + 1}`;
      await click(page, segment(bar, i), { modifiers });
      await frames(page);
      assert.equal(await page.evaluate(MENU), null, `a menu is opened ${what}`);
      assert.match(await page.evaluate(PANE_NOTE), new RegExp(`cells ${range}$`), `the cells ${range} are not selected ${what}`);
      assert.ok((await page.evaluate(TABLE)).block, `the cells are not selected as a block ${what}`);
    }
    assert.equal(await render(page), page.source, 'a selection in the bars edits the file');

    // the menu of a column from a right-click and from the arrow of its letter, with the commands
    // of a column
    await click(page, segment('cols', 1), { button: 'right' });
    await frames(page);
    let items = await page.evaluate(MENU);
    assert.ok(items?.some((l) => l.startsWith('Add Column Before')), `a right-click on the letter B does not open the menu of the column: ${js(items)}`);
    assert.ok(!items.some((l) => l.startsWith('Delete Row')), 'the menu of a column offers Delete Row');
    assert.match(await page.evaluate(PANE_NOTE), /cells B1:B4$/);
    await press(page, 'Escape');
    await frames(page);
    await click(page, `${segment('cols', 2)} .more`);
    await frames(page);
    items = await page.evaluate(MENU);
    assert.ok(items?.some((l) => l.startsWith('Delete Column')), `the arrow of the letter C does not open the menu of the column: ${js(items)}`);
    await click(page, await page.evaluate(`(() => { const i = [...document.querySelectorAll('.beeson-edit-menu [role^="menuitem"]')].find((el) => el.textContent.trim().startsWith('Delete Column')); const r = i.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`));
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelector('.reveal section.present table tr').cells.length`), 2, 'Delete Column of the menu of the letter C does not delete the column C');
    await roundTrip(page);
    assert.deepEqual(errors(page), []);
  });
}

// the box of the move handle, and the boxes of the bars and buttons of the table drawn
const HANDLE = `(() => {
  const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
  const h = document.querySelector('.beeson-overlay .beeson-handle');
  const parts = [...document.querySelectorAll('.beeson-table-bars > .bar, .beeson-table-bars > .round')].filter((el) => el.getClientRects().length).map((el) => ({ name: el.title || el.className, ...box(el) }));
  return { handle: h && !h.hidden ? box(h) : null, parts };
})()`;
const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// finding select-move-resize-6: the move handle of a selected table was drawn half under the bar of
// its row numbers
for (const platform of PLATFORMS) {
  test(`the move handle of a selected table is drawn clear of its bars, and its drag moves the table (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await newTable(page);
    for (const what of ['with the caret in a cell', 'with a cell selected as a block', 'with the table selected as an object']) {
      if (what !== 'with the caret in a cell') await press(page, 'Escape');
      await frames(page);
      const { handle, parts } = await page.evaluate(HANDLE);
      assert.ok(handle, `the move handle is not drawn ${what}`);
      for (const p of parts) assert.ok(!meets(handle, p), `the move handle at ${js(handle)} is drawn over ${p.name} at ${js(p)} ${what}`);
    }
    const { handle } = await page.evaluate(HANDLE);
    const was = (await page.evaluate(TABLE)).translate;
    await drag(page, middle(handle), { dx: 40, dy: 30, steps: 12 });
    await frames(page);
    const s = await isObject(page, 'after a drag of the move handle');
    assert.ok(s.translate[0] > was[0] + 20 && s.translate[1] > was[1] + 15, `a drag of the move handle does not move the table: ${js(was)} to ${js(s.translate)}`);
    await roundTrip(page);
  });
}

// the fields of the counts of rows and columns of the Table pane, with their values, or null
const COUNTS = `(() => {
  const f = (name) => document.querySelector('#beeson-edit-panel-format #beeson-edit-num-' + name);
  return f('rows') && f('columns') ? { rows: f('rows').value, columns: f('columns').value } : null;
})()`;
const shape = (page) => page.evaluate(`[...document.querySelector('.reveal section.present table').rows].map((r) => r.cells.length)`);

// finding tables-equations-insert-8: the Table pane did not have fields for the counts of rows and
// columns, as the Table tab of Keynote has
for (const platform of PLATFORMS) {
  test(`the Table pane has fields with steppers for the counts of rows and columns, each change one entry of the history (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: 'test/pages/editor-tables.html', n: 1 });
    await click(page, cellOf(2, 2));
    await frames(page);
    assert.deepEqual(await page.evaluate(COUNTS), { rows: '4', columns: '3' }, 'the Table pane does not show the counts of rows and columns in fields');
    await click(page, '#beeson-edit-panel-format button[aria-label="Increase Rows"]');
    await frames(page);
    assert.deepEqual(await shape(page), [3, 3, 3, 3, 3], 'the stepper of Rows does not add a row at the end');
    assert.deepEqual(await page.evaluate(COUNTS), { rows: '5', columns: '3' });
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Set Row Count');
    await roundTrip(page);

    await click(page, cellOf(1, 0));
    await frames(page);
    await click(page, '#beeson-edit-panel-format #beeson-edit-num-columns');
    // a key with the command modifier sent over the protocol does not run the editing commands of
    // macOS, hence the text of the field is selected by a script
    await page.evaluate(`document.querySelector('#beeson-edit-num-columns').select()`);
    await page.send('Input.insertText', { text: '1' });
    await press(page, 'Enter');
    await frames(page);
    assert.deepEqual(await shape(page), [1, 1, 1, 1, 1], 'a count of 1 typed into Columns does not take out the last two columns');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Set Column Count');
    await roundTrip(page);
    assert.deepEqual(errors(page), []);
  });
}

// the buttons of the insert group of the toolbar, by their command, with true where one is enabled
const INSERTS = `Object.fromEntries([...document.querySelectorAll('.beeson-edit-top button[data-command^="insert."]')]
  .filter((b) => b.getClientRects().length > 0).map((b) => [b.dataset.command, !b.disabled]))`;
const TABLE_BUTTON = '.beeson-edit-top button[data-command="insert.table"]';
const PICKER = `!!document.querySelector('dialog.beeson-table-picker[open]')`;
const pressed = (page) => page.evaluate(`(() => { const b = document.querySelector(${js(TABLE_BUTTON)}); return { pressed: b.getAttribute('aria-pressed'), expanded: b.getAttribute('aria-expanded') }; })()`);

// finding tables-equations-insert-10: while the grid of Insert > Table was open, the insert buttons
// were disabled, and the Table button under its grid was not drawn pressed
for (const [platform, mode] of [['mac', 'light'], ['other', 'dark']]) {
  test(`the Table button is drawn pressed under its open grid, and the other insert buttons stay enabled (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 6, mode });
    const was = await page.evaluate(INSERTS);
    assert.ok(Object.values(was).filter(Boolean).length >= 4, `the insert buttons are not enabled before the grid opens: ${js(was)}`);
    await click(page, TABLE_BUTTON);
    await page.waitFor(PICKER);
    await frames(page);
    assert.deepEqual(await page.evaluate(INSERTS), was, 'an insert button is disabled while the grid of the Table button is open');
    assert.deepEqual(await pressed(page), { pressed: 'true', expanded: 'true' }, 'the Table button is not drawn pressed under its open grid');

    await press(page, 'Escape');
    await frames(page);
    assert.equal(await page.evaluate(PICKER), false, 'Esc does not close the grid');
    assert.deepEqual(await pressed(page), { pressed: null, expanded: 'false' }, 'the Table button is still pressed after the grid is closed');

    // a second click on the pressed button closes its grid, as a click on another button does
    await click(page, TABLE_BUTTON);
    await page.waitFor(PICKER);
    await click(page, TABLE_BUTTON);
    await frames(page);
    assert.equal(await page.evaluate(PICKER), false, 'a click on the pressed Table button does not close its grid');
    await click(page, TABLE_BUTTON);
    await page.waitFor(PICKER);
    await frames(page);
    await click(page, '.beeson-edit-top button[data-command="insert.text"]');
    await frames(page);
    assert.equal(await page.evaluate(PICKER), false, 'a click on Text does not close the grid');
    await type(page, 'Gap');
    await frames(page);
    assert.match(await render(page), />Gap</, 'a click on Text with the grid open does not insert a text box');
    assert.deepEqual(errors(page), []);
  });
}

// finding tables-equations-insert-11: the header option of the Table pane was labeled with the
// element of HTML it writes, Header row, written as th
for (const platform of PLATFORMS) {
  test(`the header option of the Table pane reads Header Row, as in the menus (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: 'test/pages/editor-tables.html', n: 1 });
    await click(page, cellOf(2, 2));
    await frames(page);
    const label = await page.evaluate(`document.querySelector('#beeson-edit-panel-format input[data-command="table.header"]')?.parentElement.textContent ?? null`);
    assert.equal(label, 'Header Row', 'the header option of the Table pane is not labeled Header Row');
    assert.deepEqual(errors(page), []);
  });
}

// the frame of the cell or the range drawn on the table, and the boxes of the glyphs of the cells
// with the given texts, which are beside the range
const BESIDE = (texts) => `(() => {
  const frame = document.querySelector('.beeson-table-bars .cell:not([hidden])')?.getBoundingClientRect();
  const cells = [...document.querySelectorAll('.reveal section.present table :is(td,th)')].filter((c) => ${js(texts)}.includes(c.textContent.trim()));
  const glyphs = cells.flatMap((c) => {
    const r = document.createRange();
    r.selectNodeContents(c);
    return [...r.getClientRects()].filter((b) => b.width > 0).map((b) => ({ text: c.textContent.trim(), left: b.left, top: b.top, right: b.right, bottom: b.bottom }));
  });
  return { frame: frame && { left: frame.left, top: frame.top, right: frame.right, bottom: frame.bottom }, glyphs, cells: cells.length };
})()`;
const OUTSIDE = ['Body', 'Mass ratio', 'System', 'Earth and Moon', 'Jupiter', 'Titan', '2.37e-4', 'Saturn'];

async function clearOf(page, what) {
  const s = await page.evaluate(BESIDE(OUTSIDE));
  assert.equal(s.cells, OUTSIDE.length);
  assert.ok(s.frame, `the frame is not drawn ${what}`);
  const covered = s.glyphs.filter((g) => meets(g, s.frame)).map((g) => g.text);
  assert.deepEqual(covered, [], `the frame ${what} at ${js(s.frame)} covers the glyphs of ${covered.join(', ')} beside it`);
}

// the check of a round of the council: the frame of a range of cells and of a merged cell was drawn
// outside the cells, over the first glyph of the column after it
for (const platform of PLATFORMS) {
  test(`the frame of a range of cells and of a merged cell is drawn on their edges, clear of the text beside them (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: 'test/pages/editor-tables.html', n: 1 });
    await click(page, cellOf(1, 0));
    await click(page, cellOf(2, 1), { modifiers: 'Shift' });
    await frames(page);
    assert.match(await page.evaluate(PANE_NOTE), /cells A2:B3/);
    await clearOf(page, 'of the range A2:B3');
    await exec(page, 'table.merge');
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelector('.reveal section.present table tr:nth-child(2) > td').colSpan`), 2);
    await clearOf(page, 'of the merged cell A2:B3');
    assert.deepEqual(errors(page), []);
  });
}
