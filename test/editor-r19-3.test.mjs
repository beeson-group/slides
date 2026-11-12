// regression tests of R19.3 on both platforms with trusted input: a range of cells pasted by Paste
// of the Edit menu after a reload (D5), Cut and Delete of the Plot Data window on emptied labels
// (D6), Move Row Up and Down of a row next to a merged block (D7), and the caret after an undo of
// an add of a row or a column

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const BARS = 'test/pages/editor-r13-3.html';
const TABLES = 'test/pages/editor-tables.html';
const LOOP = 'test/pages/plot-loop.html';
const WINDOW = '.beeson-plotdata';
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
const wait = (page, ms = 150) => page.evaluate(`new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), ${ms}))`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
const enabled = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)}).enabled`);
const rect = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
let saves = 0;

// the editor on slide n of deck, served over HTTP, with the storage of the origin emptied
async function load(t, platform, deck, n, page = null) {
  if (!page) {
    page = await browser.newPage({ width: 1600, height: 1000 });
    const p = page;
    t.after(() => p.close().catch(() => {}));
  }
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  page.platform = platform;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await wait(page, 300);
  return page;
}

// the edit checked after an undo, again after a redo, and after a save and an open
async function roundTrip(page, base) {
  const edited = await render(page);
  assert.notEqual(edited, base, 'the action does not change the file');
  await undo(page);
  assert.equal(await render(page), base, 'the undo does not give the file back byte for byte');
  await redo(page);
  assert.equal(await render(page), edited, 'the redo does not write the edit again');
  const { text } = await saveAndReopen(page, `r19-3-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  return edited;
}

const MENU_ITEM = (label) => `[...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.getClientRects().length && i.querySelector('.label')?.textContent === ${js(label)})`;
const itemDimmed = (page, label) => page.evaluate(`${MENU_ITEM(label)}?.getAttribute('aria-disabled') === 'true'`);
const openEdit = async (page) => {
  await click(page, await rect(page, `[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === 'Edit')`));
  await wait(page);
};
const closeMenus = async (page) => {
  await page.evaluate('window.BeesonEditorShell?.closeMenus?.(); true');
  await wait(page);
};
const menuRun = async (page, label) => {
  await openEdit(page);
  await click(page, await rect(page, MENU_ITEM(label)));
  await wait(page, 300);
  await closeMenus(page);
};

const TABLE = `document.querySelector('.reveal section.present table')`;
const at = (page, r, c) => rect(page, `${TABLE}.rows[${r}].cells[${c}]`);
const tables = (page) => page.evaluate(`Reveal.getCurrentSlide().querySelectorAll('table').length`);
const rowsOf = (page) => page.evaluate(`[...${TABLE}.rows].map((tr) => [...tr.cells].map((c) => c.textContent.trim()).join(' '))`);

// D5: Paste of the Edit menu read the table of a copied range only from the copy of the same page,
// hence after a reload, or in another tab, the first row of the range was written as th cells
const BODY = '<tbody>\n      <tr><td>Moon</td><td style="text-align: right">\\(0.01215\\)</td></tr>\n      <tr><td>Europa</td><td style="text-align: right">2.53e-5</td></tr>\n    </tbody>';
const HEAD = '<tbody>\n      <tr><th>Moon</th><th style="text-align: right">\\(0.01215\\)</th></tr>\n      <tr><td>Europa</td><td style="text-align: right">2.53e-5</td></tr>\n    </tbody>';
const lastTable = (text) => text.slice(text.lastIndexOf('<table'), text.lastIndexOf('</table>'));

// the body cells Moon to 2.53e-5 of slide 2 copied by a trusted Mod+C onto the system clipboard,
// then the deck opened again on slide 3, which drops the copy of the page
async function copyAndReload(t, platform) {
  const page = await load(t, platform, TABLES, 1);
  await page.send('Page.bringToFront');
  await page.send('Browser.grantPermissions', { origin: server.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await click(page, await at(page, 1, 0));
  await wait(page);
  await click(page, await at(page, 2, 1), { modifiers: 'Shift' });
  await wait(page);
  const base = { key: 'c', code: 'KeyC', windowsVirtualKeyCode: 67, modifiers: MOD[platform] };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base, commands: ['copy'] });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await wait(page);
  const html = await page.evaluate(`navigator.clipboard.read().then(async (items) => { for (const i of items) if (i.types.includes('text/html')) return (await i.getType('text/html')).text(); return ''; })`);
  assert.ok(html.includes('<td>Moon</td>'), `the system clipboard does not hold the table of the range: ${html}`);
  await load(t, platform, TABLES, 2, page);
  await page.evaluate('document.activeElement?.blur()');
  await click(page, await rect(page, `document.querySelector('.reveal section.present h2')`).then((p) => ({ x: p.x, y: p.y + 260 })));
  await wait(page);
  return page;
}

for (const platform of PLATFORMS) {
  test(`Paste of the Edit menu after a reload writes the cells of a copied range as Mod+V does (${platform})`, async (t) => {
    const page = await copyAndReload(t, platform);
    assert.equal(await tables(page), 1);
    await menuRun(page, 'Paste');
    await page.waitFor(`Reveal.getCurrentSlide().querySelectorAll('table').length === 2`).catch(() => {});
    await wait(page, 300);
    assert.equal(await tables(page), 2, 'Paste of the Edit menu does not make a table');
    const pasted = await render(page);
    assert.ok(pasted.includes(BODY), `the new table is not of body cells:\n${lastTable(pasted)}`);
    assert.equal(await undoLabel(page), 'Undo Paste');
    await roundTrip(page, page.source);
  });

  test(`Paste of the Edit menu pastes the plain text where the browser refuses the read of the clipboard (${platform})`, async (t) => {
    const page = await copyAndReload(t, platform);
    await page.evaluate(`navigator.clipboard.read = () => Promise.reject(new DOMException('Read permission denied.', 'NotAllowedError')); true`);
    await menuRun(page, 'Paste');
    await page.waitFor(`Reveal.getCurrentSlide().querySelectorAll('table').length === 2`).catch(() => {});
    await wait(page, 300);
    assert.equal(await tables(page), 2, 'the plain text is not pasted as a table');
    const pasted = await render(page);
    assert.ok(pasted.includes(HEAD), `the plain text is not pasted as before:\n${lastTable(pasted)}`);
    assert.deepEqual(errors(page), []);
  });
}

// D6: on a range of emptied labels of the Plot Data window, Cut and Delete stayed live and did
// nothing, without a sentence in the status line
const cell = (r, c) => `${WINDOW} input[data-r="${r}"][data-c="${c}"]`;
const status = (page) => page.evaluate(`document.querySelector('${WINDOW} .state').textContent`);
const labels = (page) => page.evaluate(`[...document.querySelectorAll('${WINDOW} tbody tr')].map((tr) => tr.querySelector('input[data-c="3"]')?.value)`);
async function cells(page, a, b) {
  await click(page, await rect(page, `document.querySelector(${js(cell(...a))})`));
  await wait(page, 100);
  await click(page, await rect(page, `document.querySelector(${js(cell(...b))})`), { modifiers: 'Shift' });
  await wait(page, 100);
}
async function eventSheet(t, platform) {
  const page = await load(t, platform, LOOP, 0);
  await click(page, '.reveal section.present .plot');
  await wait(page);
  await press(page, 'Mod+Shift+D');
  await page.waitFor(`!!document.querySelector('${WINDOW}:not([hidden])')`);
  await wait(page);
  await click(page, await rect(page, `[...document.querySelectorAll('${WINDOW} .sheets button')].find((b) => b.textContent.includes('event'))`));
  await wait(page);
  return page;
}
async function menuState(page) {
  await openEdit(page);
  const s = { cut: await itemDimmed(page, 'Cut'), del: await itemDimmed(page, 'Delete'), copy: await itemDimmed(page, 'Copy') };
  await closeMenus(page);
  return s;
}

for (const platform of PLATFORMS) {
  test(`Cut and Delete of the Plot Data window are dimmed on a range of emptied labels, which the window says (${platform})`, async (t) => {
    const page = await eventSheet(t, platform);
    // a second row with a label, then both labels emptied by Delete of the Edit menu
    await click(page, await rect(page, `document.querySelector(${js(cell(0, 3))})`));
    await wait(page, 100);
    await page.evaluate(`Promise.resolve(window.BeesonEditor.exec('plot.addRow')).then(() => true)`);
    await wait(page, 400);
    await click(page, await rect(page, `document.querySelector(${js(cell(1, 3))})`));
    await wait(page, 100);
    await type(page, 'go');
    await press(page, 'Tab');
    await wait(page, 400);
    assert.ok((await labels(page)).every((l) => l), 'a label is empty before the Delete');
    await cells(page, [0, 3], [1, 3]);
    assert.deepEqual(await menuState(page), { cut: false, del: false, copy: false }, 'on two labels');
    await menuRun(page, 'Delete');
    await wait(page, 300);
    assert.deepEqual(await labels(page), ['', '']);
    assert.equal(await undoLabel(page), 'Undo Clear Cells');
    // the emptied labels selected again
    await cells(page, [0, 3], [1, 3]);
    assert.deepEqual(await menuState(page), { cut: true, del: true, copy: false }, 'on two emptied labels');
    assert.match(await status(page), /^2 × 1 cells selected\. .*Cut and Delete are dimmed\.$/);
    // with a number, the range is the same
    await cells(page, [0, 2], [1, 3]);
    assert.deepEqual(await menuState(page), { cut: true, del: true, copy: false }, 'on numbers and emptied labels');
    assert.match(await status(page), /^2 × 2 cells selected\. .*Cut and Delete are dimmed\.$/);
    assert.deepEqual(errors(page), []);
  });
}

// D7: Move Row Up of a row under a merged block was dimmed, although a drag moves it past the
// whole block, as Move Row Down of the block does
const rowBar = (i) => `.beeson-table-bars .bar.rows > [data-index="${i}"]`;
const cellPoint = (page, text) => rect(page, `[...document.querySelectorAll('.reveal section.present :is(td, th)')].find((c) => c.textContent.trim() === ${js(text)})`);
async function selectRow(page, text, i) {
  await click(page, await cellPoint(page, text));
  await wait(page, 100);
  await click(page, await rect(page, `document.querySelector(${js(rowBar(i))})`));
  await wait(page, 100);
}
const SOURCE = ['Family Period Jacobi', 'Halo 14.8 3.05', '6.6 3.04', 'Lyapunov 2.69 3.10'];
const MOVED = ['Family Period Jacobi', 'Lyapunov 2.69 3.10', 'Halo 14.8 3.05', '6.6 3.04'];

for (const platform of PLATFORMS) {
  test(`Move Row Up and Down of a row next to a merged block move it past the whole block, as a drag does (${platform})`, async (t) => {
    const page = await load(t, platform, BARS, 3);
    assert.deepEqual(await rowsOf(page), SOURCE);
    await selectRow(page, 'Lyapunov', 3);
    assert.equal(await enabled(page, 'table.moveRowUp'), true, 'Move Row Up of the row under the block is dimmed');
    assert.equal(await enabled(page, 'table.moveRowDown'), false, 'Move Row Down of the last row is live');
    await page.evaluate(`window.BeesonEditor.exec('table.moveRowUp')`);
    await wait(page);
    assert.deepEqual(await rowsOf(page), MOVED);
    assert.equal(await undoLabel(page), 'Undo Move Row Up');
    const moved = await roundTrip(page, page.source);
    // the moved row goes back down by its own command
    await selectRow(page, 'Lyapunov', 1);
    assert.equal(await enabled(page, 'table.moveRowUp'), false, 'Move Row Up of the row under the header row is live');
    assert.equal(await enabled(page, 'table.moveRowDown'), true, 'Move Row Down of the row above the block is dimmed');
    await page.evaluate(`window.BeesonEditor.exec('table.moveRowDown')`);
    await wait(page);
    assert.deepEqual(await rowsOf(page), SOURCE);
    assert.equal(await render(page), page.source);
    await undo(page);
    assert.equal(await render(page), moved);
    assert.deepEqual(errors(page), []);
  });

  // a column is moved only where no merged cell is in its way, by a drag as by a command, hence
  // the column Jacobi next to the merged cell Distant retrograde stays where it is
  test(`Move Column Left and Right of a column next to a merged block are dimmed, as its drag is refused (${platform})`, async (t) => {
    const page = await load(t, platform, TABLES, 0);
    await click(page, await cellPoint(page, '3.05'));
    await wait(page, 100);
    await click(page, await rect(page, `document.querySelector('.beeson-table-bars .bar.cols > [data-index="2"]')`));
    await wait(page, 100);
    assert.equal(await enabled(page, 'table.moveColumnLeft'), false);
    assert.equal(await enabled(page, 'table.moveColumnRight'), false);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}

// item 4: after an undo of an add of a row or a column made with the caret in a cell, the caret was
// not in any cell and the focus was on the page, hence the next key went to the deck
const CARET = `(() => {
  const s = getSelection();
  const c = document.activeElement?.closest?.('td, th');
  if (!c || !s.rangeCount || !s.isCollapsed) return null;
  const r = document.createRange();
  r.selectNodeContents(c);
  r.setEnd(s.anchorNode, s.anchorOffset);
  return { at: [[...${TABLE}.rows].indexOf(c.parentElement), [...c.parentElement.cells].indexOf(c)], offset: r.toString().length };
})()`;
const caret = (page) => page.evaluate(CARET);
const B2 = `[...${TABLE}.querySelectorAll('td')].find((c) => c.textContent.trim() === 'B2')`;
// the caret between the letters of the cell B2 of slide 2 of test/pages/editor-r13-3.html, after a
// click into it
async function caretInB2(page) {
  await click(page, await rect(page, B2));
  await wait(page);
  await page.evaluate(`(() => { const n = ${B2}.firstChild; getSelection().collapse(n, 1); return true; })()`);
  assert.deepEqual(await caret(page), { at: [1, 1], offset: 1 }, 'the caret is not in the cell B2');
}
// the commands, the cell of the caret after each, and their keys on Windows and Linux
const ADDS = [
  ['table.rowAbove', [1, 1], 'Alt+ArrowUp'],
  ['table.rowBelow', [2, 1], 'Alt+ArrowDown'],
  ['table.columnBefore', [1, 1], 'Alt+ArrowLeft'],
  ['table.columnAfter', [1, 2], 'Alt+ArrowRight'],
];
// the cell B2 after the undo of an add above or before it is at its place again
const typedB2 = (page) => page.source.replace('<td>B2</td>', '<td>Bx2</td>');

for (const platform of PLATFORMS) {
  test(`after an undo of an add made with the caret in a cell, the caret is back at its spot, and after a redo in the new cell (${platform})`, async (t) => {
    const page = await load(t, platform, BARS, 1);
    const routes = platform === 'other' ? ['menu', 'key'] : ['menu'];
    for (const route of routes) {
      for (const [id, added, key] of ADDS) {
        await caretInB2(page);
        if (route === 'key') await press(page, key);
        else await page.evaluate(`window.BeesonEditor.exec(${js(id)})`);
        await wait(page);
        assert.deepEqual(await caret(page), { at: added, offset: 0 }, `the caret after ${id} by the ${route}`);
        await undo(page);
        await wait(page);
        assert.equal(await render(page), page.source);
        assert.deepEqual(await caret(page), { at: [1, 1], offset: 1 }, `the caret after the undo of ${id} by the ${route}`);
        await redo(page);
        await wait(page);
        assert.deepEqual(await caret(page), { at: added, offset: 0 }, `the caret after the redo of ${id} by the ${route}`);
        await undo(page);
        await wait(page);
        // the next letter is written at the spot of the caret
        await type(page, 'x');
        await wait(page);
        assert.equal(await render(page), typedB2(page), `the letter after the undo of ${id} by the ${route}`);
        await undo(page);
        await wait(page);
        assert.equal(await render(page), page.source);
      }
    }
    assert.deepEqual(errors(page), []);
  });
}
