// regression tests of R15.5 on both platforms with trusted input: a row or a column dragged by its
// bar is lifted and follows the pointer along its axis while the button is held, the file changes
// only at the drop, and Esc puts it back. Cut, Copy, and Delete of the Edit menu act on a range of
// cells of the Plot Data window as their keys do, each with the name of the history entry that
// the key gives

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const TABLES = 'test/pages/editor-r13-3.html';
const PLAIN = 1;
const LOOP = 'test/pages/plot-loop.html';
const WINDOW = '.beeson-plotdata';
const PLATFORMS = ['mac', 'other'];
const MOD = { mac: 4, other: 2 };

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
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
let saves = 0;

// the editor on slide n of deck, served over HTTP, with the storage of the origin emptied
async function load(t, platform, deck, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
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
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the text after an edit checked against page.source after an undo, again after a redo, and after
// a save and an open of the saved text
async function roundTrip(page) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  await undo(page);
  assert.equal(await render(page), page.source, 'the undo does not give the file back byte for byte');
  await redo(page);
  assert.equal(await render(page), edited, 'the redo does not write the edit again');
  const { text } = await saveAndReopen(page, `r15-5-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
}

// the rows of the table of the current slide, as the texts of their cells
const rowsOf = (page) => page.evaluate(`[...document.querySelector('.reveal section.present table').rows].map((tr) => [...tr.cells].map((c) => c.textContent.trim()).join(' '))`);
const segment = (bar, i) => `.beeson-table-bars .bar.${bar} > [data-index="${i}"]`;
const middle = (page, selector) => page.evaluate(`(() => { const r = document.querySelector(${js(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })()`);
const lineShown = (page) => page.evaluate(`(() => { const l = document.querySelector('.beeson-table-bars .drop'); return !!l && !l.hidden && l.getBoundingClientRect().width > 0; })()`);
const box = (page, expr) => page.evaluate(`(() => { const r = (${expr}).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
const TABLE = `document.querySelector('.reveal section.present table')`;
const rowBox = (page, r) => box(page, `${TABLE}.rows[${r}]`);
const cellBox = (page, r, c) => box(page, `${TABLE}.rows[${r}].cells[${c}]`);
// the box, the words, and the look of the lifted copy of the rows or the columns dragged by their
// bar, which the editor draws over the table, or null while none is shown
const lifted = (page) => page.evaluate(`(() => {
  const l = document.querySelector('.beeson-table-bars .lift');
  if (!l || l.hidden) return null;
  const r = l.getBoundingClientRect();
  return r.width && r.height ? { x: r.left, y: r.top, w: r.width, h: r.height, text: [...l.children].map((c) => c.textContent.trim()).join(' '), opacity: Number(getComputedStyle(l).opacity), shadow: getComputedStyle(l).boxShadow } : null;
})()`);
const near = (a, b, what) => assert.ok(Math.abs(a - b) <= 2, `${what}: ${a} against ${b}`);
const cellPoint = (page, text) => page.evaluate(`(() => {
  const td = [...document.querySelectorAll('.reveal section.present td')].find((c) => c.textContent.trim() === ${js(text)});
  const r = td.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);

// the row or the column of segment i of a bar selected by a click on it, after a click into the cell
// of text, which shows the bars
async function selectLine(page, text, bar, i) {
  await click(page, await cellPoint(page, text));
  await frames(page);
  await click(page, await middle(page, segment(bar, i)));
  await frames(page);
}

const pointer = (page, type, x, y) => page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });

for (const platform of PLATFORMS) {
  test(`a row dragged by its bar is lifted and follows the pointer, and the file changes only at the drop (${platform})`, async (t) => {
    const page = await load(t, platform, TABLES, PLAIN);
    await selectLine(page, 'A2', 'rows', 1);
    const m = await middle(page, segment('rows', 1));
    const row = await rowBox(page, 1);
    const before = await undoLabel(page);
    await drag(page, m, { dy: m.h, steps: 12, hold: true });
    await frames(page);
    const l = await lifted(page);
    assert.ok(l, 'the dragged row is not lifted while the button is held');
    near(l.y, row.y + m.h, 'the top of the lifted row');
    near(l.x, row.x, 'the left of the lifted row');
    near(l.h, row.h, 'the height of the lifted row');
    near(l.w, row.w, 'the width of the lifted row');
    assert.equal(l.text, 'A2 B2 C2');
    assert.ok(l.opacity < 1 || l.shadow !== 'none', 'the lifted row is drawn neither lighter nor with a shadow');
    assert.equal(await lineShown(page), true, 'the gap where the row lands is not marked by a line');
    // the row in the table stays, and the file is not changed during the drag
    assert.deepEqual(await rowBox(page, 1), row);
    assert.equal(await page.evaluate(`getComputedStyle(${TABLE}.rows[1]).transform`), 'none');
    assert.equal(await render(page), page.source, 'the file changes during the drag');
    assert.equal(await undoLabel(page), before);
    // the lifted row follows the pointer further down
    await pointer(page, 'mouseMoved', m.x, m.y + 1.5 * m.h);
    await frames(page);
    near((await lifted(page)).y, row.y + 1.5 * m.h, 'the top of the lifted row after a further move');
    await pointer(page, 'mouseReleased', m.x, m.y + 1.5 * m.h);
    await page.waitFor(`window.BeesonEditor.state('edit.undo').label === 'Undo Move Row'`);
    await frames(page);
    assert.equal(await lifted(page), null, 'the lifted row is still shown after the drop');
    assert.deepEqual(await rowsOf(page), ['A1 B1 C1', 'A3 B3 C3', 'A2 B2 C2', 'A4 B4 C4']);
    await roundTrip(page);
  });

  test(`a column dragged by its bar is lifted and follows the pointer along its axis (${platform})`, async (t) => {
    const page = await load(t, platform, TABLES, PLAIN);
    await selectLine(page, 'B2', 'cols', 1);
    const m = await middle(page, segment('cols', 1));
    const top = await cellBox(page, 0, 1);
    const table = await box(page, TABLE);
    // the move of 40 px across the axis is not followed
    await drag(page, m, { dx: -m.w, dy: 40, steps: 12, hold: true });
    await frames(page);
    const l = await lifted(page);
    assert.ok(l, 'the dragged column is not lifted while the button is held');
    near(l.x, top.x - m.w, 'the left of the lifted column');
    near(l.w, top.w, 'the width of the lifted column');
    near(l.y, table.y, 'the top of the lifted column');
    near(l.h, table.h, 'the height of the lifted column');
    assert.equal(l.text, 'B1 B2 B3 B4');
    assert.equal(await lineShown(page), true);
    assert.equal(await render(page), page.source, 'the file changes during the drag');
    await pointer(page, 'mouseReleased', m.x - m.w, m.y + 40);
    await page.waitFor(`window.BeesonEditor.state('edit.undo').label === 'Undo Move Column'`);
    await frames(page);
    assert.equal(await lifted(page), null);
    assert.deepEqual(await rowsOf(page), ['B1 A1 C1', 'B2 A2 C2', 'B3 A3 C3', 'B4 A4 C4']);
    await roundTrip(page);
  });

  test(`Esc during a drag by a bar puts the lifted row back without an entry of the history (${platform})`, async (t) => {
    const page = await load(t, platform, TABLES, PLAIN);
    await selectLine(page, 'A2', 'rows', 1);
    const m = await middle(page, segment('rows', 1));
    const before = await undoLabel(page);
    await drag(page, m, { dy: m.h, steps: 12, hold: true });
    await frames(page);
    assert.ok(await lifted(page), 'the dragged row is not lifted while the button is held');
    await press(page, 'Escape');
    await frames(page);
    assert.equal(await lifted(page), null, 'Esc leaves the lifted row on the screen');
    assert.equal(await lineShown(page), false);
    await pointer(page, 'mouseMoved', m.x, m.y + 2 * m.h);
    await frames(page);
    assert.equal(await lifted(page), null, 'the lifted row comes back after Esc');
    await pointer(page, 'mouseReleased', m.x, m.y + 2 * m.h);
    await frames(page);
    assert.equal(await render(page), page.source, 'a drag canceled by Esc changes the file');
    assert.equal(await undoLabel(page), before, 'a drag canceled by Esc is an entry of the history');
    assert.deepEqual(errors(page), []);
  });
}

// the Plot Data window of the plot of test/pages/plot-loop.html, on the sheet of its events mark,
// whose one row holds the frame, x, y, and the text "end"
const cell = (r, c) => `${WINDOW} input[data-r="${r}"][data-c="${c}"]`;
const rect = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const MENU_ITEM = (label) => `[...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.getClientRects().length && i.querySelector('.label')?.textContent === ${js(label)})`;
const itemDimmed = (page, label) => page.evaluate(`${MENU_ITEM(label)}?.getAttribute('aria-disabled') === 'true'`);
const closeMenus = async (page) => {
  await page.evaluate('window.BeesonEditorShell?.closeMenus?.(); true');
  await frames(page);
};
const openEdit = async (page) => {
  await click(page, await rect(page, `[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === 'Edit')`));
  await frames(page);
};
const clipboard = (page) => page.evaluate('navigator.clipboard.readText()');
const setClipboard = (page, text) => page.evaluate(`navigator.clipboard.writeText(${js(text)}).then(() => true)`);
const focusName = (page) => page.evaluate(`(() => { const a = document.activeElement; return a?.closest('${WINDOW}') && a.dataset.r ? a.dataset.r + ',' + a.dataset.c : null; })()`);
const rangeSize = (page) => page.evaluate(`document.querySelectorAll('${WINDOW} td.sel').length`);
const caretAtStart = (page) => page.evaluate(`(() => { const i = document.querySelector(${js(cell(0, 2))}); i.focus(); i.setSelectionRange(0, 0); return true; })()`);

// a key with the modifier of the platform and with the editing command of a real keyboard
async function chord(page, platform, key, code, keyCode, command) {
  const base = { key, code, windowsVirtualKeyCode: keyCode, modifiers: MOD[platform], commands: [command] };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await frames(page);
}

// the range of the y and the text of the event, selected by Shift+Right from the y, with the caret
// at the start of the y, as after a click into its cell
async function plotRange(t, platform) {
  const page = await load(t, platform, LOOP, 0);
  await page.send('Page.bringToFront');
  await page.send('Browser.grantPermissions', { origin: server.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await click(page, '.reveal section.present .plot');
  await press(page, 'Mod+Shift+D');
  await page.waitFor(`!!document.querySelector('${WINDOW}:not([hidden])')`);
  await click(page, await rect(page, `[...document.querySelectorAll('${WINDOW} .sheets button')].find((b) => b.textContent.includes('event'))`));
  await frames(page);
  await page.evaluate(`(() => { const i = document.querySelector(${js(cell(0, 2))}); i.focus(); i.select(); return true; })()`);
  await press(page, 'Shift+ArrowRight');
  await caretAtStart(page);
  await frames(page);
  assert.equal(await rangeSize(page), 2, 'the range is not two cells');
  assert.equal(await focusName(page), '0,2');
  return page;
}

const cleared = (source) => source.replace('"text": "end"', '"text": ""');

for (const platform of PLATFORMS) {
  test(`Copy of the Edit menu on a range of cells of the Plot Data window copies the range as the key does (${platform})`, async (t) => {
    const page = await plotRange(t, platform);
    await setClipboard(page, 'nothing');
    await chord(page, platform, 'c', 'KeyC', 67, 'copy');
    const byKey = await clipboard(page);
    assert.equal(byKey, '-1\tend');
    await setClipboard(page, 'nothing');
    await openEdit(page);
    assert.equal(await itemDimmed(page, 'Copy'), false, 'Copy is dimmed on a range of cells');
    await click(page, await rect(page, MENU_ITEM('Copy')));
    await frames(page);
    await closeMenus(page);
    assert.equal(await clipboard(page), byKey, 'Copy of the Edit menu does not copy the range');
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  for (const [item, key] of [
    ['Cut', (page) => chord(page, platform, 'x', 'KeyX', 88, 'cut')],
    ['Delete', (page) => press(page, 'Delete')],
  ]) {
    test(`${item} of the Edit menu on a range of cells of the Plot Data window clears the range as the key does, as one entry with the name of the key (${platform})`, async (t) => {
      const page = await plotRange(t, platform);
      await setClipboard(page, 'nothing');
      // the key first, whose text and entry of the history are those that the menu must give
      await key(page);
      await page.waitFor(`window.BeesonEditor.render() !== ${js(page.source)}`);
      const byKey = { text: await render(page), label: await undoLabel(page), clip: await clipboard(page) };
      assert.equal(byKey.text, cleared(page.source));
      assert.equal(byKey.label, 'Undo Clear Cells');
      await undo(page);
      await byteExact(page);
      await caretAtStart(page);
      await frames(page);
      assert.equal(await rangeSize(page), 2, 'the undo does not keep the range');
      await setClipboard(page, 'nothing');
      await openEdit(page);
      assert.equal(await itemDimmed(page, item), false, `${item} is dimmed on a range of cells`);
      await click(page, await rect(page, MENU_ITEM(item)));
      await page.waitFor(`window.BeesonEditor.render() !== ${js(page.source)}`).catch(() => {});
      await frames(page);
      await closeMenus(page);
      assert.equal(await render(page), byKey.text, `${item} of the Edit menu does not clear the range as the key does`);
      assert.equal(await undoLabel(page), byKey.label);
      if (item === 'Cut') assert.equal(await clipboard(page), byKey.clip, 'Cut of the Edit menu does not copy the range');
      assert.equal(await page.evaluate(`document.querySelector(${js(cell(0, 2))}).value`), '-1', 'the number of the range is changed');
      // a single undo gives the file back, hence the menu item is one entry of the history
      await undo(page);
      await byteExact(page);
      await redo(page);
      assert.equal(await render(page), byKey.text, 'the redo does not clear the range again');
      const { text } = await saveAndReopen(page, `r15-5-${++saves}.html`);
      assert.equal(text, byKey.text);
      assert.deepEqual(errors(page), []);
    });
  }
}

for (const platform of PLATFORMS) {
  test(`Delete of the Edit menu with the text of the focused cell selected clears the range, and not the text of the one cell (${platform})`, async (t) => {
    const page = await plotRange(t, platform);
    await page.evaluate(`(() => { const i = document.querySelector(${js(cell(0, 2))}); i.focus(); i.select(); return true; })()`);
    await openEdit(page);
    await click(page, await rect(page, MENU_ITEM('Delete')));
    await page.waitFor(`window.BeesonEditor.render() !== ${js(page.source)}`).catch(() => {});
    await frames(page);
    await closeMenus(page);
    assert.equal(await page.evaluate(`document.querySelector(${js(cell(0, 2))}).value`), '-1', 'Delete of the Edit menu deletes the text of the focused cell');
    assert.equal(await render(page), cleared(page.source), 'Delete of the Edit menu does not clear the range');
    assert.equal(await undoLabel(page), 'Undo Clear Cells');
    assert.deepEqual(errors(page), []);
  });
}
