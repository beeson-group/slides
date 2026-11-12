// regression tests of R17.4 on both platforms with trusted input: the drop line of a drag by a bar
// drawn over the lifted copy, a range of body cells pasted onto a slide as body cells, by the key
// and by Paste of the Edit menu, a key pressed during a drag by a bar, Cut and Delete of the Edit
// menu on a range of numbers of the Plot Data window, and a move of rows in a table with a merged
// cell

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, contrast, press, saveAndReopen } from './helpers/editor.mjs';

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
let saves = 0;

// the editor on slide n of deck, served over HTTP, with the storage of the origin emptied
async function load(t, platform, deck, n, theme = '') {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?edit&still${theme ? `&theme=${theme}` : ''}&edit-platform=${platform}`;
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

// the edit checked against base after an undo, again after a redo, and after a save and an open
async function roundTrip(page, base) {
  const edited = await render(page);
  assert.notEqual(edited, base, 'the action does not change the file');
  await undo(page);
  assert.equal(await render(page), base, 'the undo does not give the file back byte for byte');
  await redo(page);
  assert.equal(await render(page), edited, 'the redo does not write the edit again');
  const { text } = await saveAndReopen(page, `r17-4-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  return edited;
}

const TABLE = `document.querySelector('.reveal section.present table')`;
const rowsOf = (page) => page.evaluate(`[...${TABLE}.rows].map((tr) => [...tr.cells].map((c) => c.textContent.trim()).join(' '))`);
const segment = (bar, i) => `.beeson-table-bars .bar.${bar} > [data-index="${i}"]`;
const middle = (page, selector) => page.evaluate(`(() => { const r = document.querySelector(${js(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })()`);
const LIFT = `document.querySelector('.beeson-table-bars .lift')`;
const liftText = (page) => page.evaluate(`[...${LIFT}.children].map((d) => d.textContent.trim()).join(' ')`);
const DROP = `document.querySelector('.beeson-table-bars .drop')`;
const shown = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; })()`);
const pointer = (page, type, x, y) => page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
const cellPoint = (page, text) => page.evaluate(`(() => {
  const td = [...document.querySelectorAll('.reveal section.present :is(td, th)')].find((c) => c.textContent.trim() === ${js(text)});
  const r = td.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);

// the row i selected by a click into the cell named cell and a click on its bar, and pressed on
// its bar and moved by k heights of the row with the button held. the point of the pointer is
// returned
async function pressRow(page, cell, i, k) {
  await click(page, await cellPoint(page, cell));
  await wait(page, 100);
  await click(page, await middle(page, segment('rows', i)));
  await wait(page, 100);
  const m = await middle(page, segment('rows', i));
  await pointer(page, 'mouseMoved', m.x, m.y);
  await pointer(page, 'mousePressed', m.x, m.y);
  for (let j = 1; j <= 10; j++) await pointer(page, 'mouseMoved', m.x, m.y + (k * m.h * j) / 10);
  await wait(page);
  return { x: m.x, y: m.y + k * m.h, h: m.h };
}

// the pixels of a screenshot at the points, read back in the page
async function pixels(page, points) {
  const png = await page.screenshot({ x: 0, y: 0, width: 1600, height: 1000, scale: 1 });
  return page.evaluate(`(async () => {
    const img = new Image();
    img.src = 'data:image/png;base64,${png.toString('base64')}';
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const s = img.width / innerWidth;
    return ${js(points)}.map(([x, y]) => 'rgb(' + [...g.getImageData(Math.round(x * s), Math.round(y * s), 1, 1).data].slice(0, 3).join(', ') + ')');
  })()`);
}

// N43: the drop line of a drag by a bar was drawn under the lifted copy at 85 percent opacity, at
// a contrast of about 1.1 to 1 in dark mode and 1.2 to 1 in light mode
for (const platform of PLATFORMS) {
  for (const theme of ['dark', 'light']) {
    test(`the drop line of a row dragged by its bar is drawn over the lifted copy, in ${theme} mode (${platform})`, async (t) => {
      const page = await load(t, platform, BARS, 1, theme);
      // 1.4 rows down, the gap is after row 3 and under the copy
      const m = await pressRow(page, 'A2', 1, 1.4);
      const drop = await shown(page, DROP);
      const lift = await shown(page, LIFT);
      assert.ok(drop && lift, `the drag does not show the copy and the line: ${js({ drop, lift })}`);
      assert.ok(drop.y > lift.y && drop.y + drop.h < lift.y + lift.h, `the line is not under the copy: ${js({ drop, lift })}`);
      const x = drop.x + drop.w * 0.25;
      const [line, above] = await pixels(page, [[x, drop.y + drop.h / 2], [x, drop.y - 6]]);
      const ratio = contrast(line, above);
      assert.ok(ratio >= 3, `the drop line reads ${line} against ${above} beside it, a contrast of ${ratio.toFixed(2)} to 1`);
      await press(page, 'Escape');
      await pointer(page, 'mouseReleased', m.x, m.y);
      await wait(page);
      assert.equal(await render(page), page.source);
      assert.deepEqual(errors(page), []);
    });
  }
}

// the cells of slide 2 of test/pages/editor-tables.html at row r and column c of its table
const at = (page, r, c) => page.evaluate(`(() => { const t = Reveal.getCurrentSlide().querySelector('table'); const b = t.rows[${r}].cells[${c}].getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);

// the body cells Moon to 2.53e-5 of slide 2 selected as a block and copied by a trusted Mod+C,
// with the data that the copy wrote
async function copyBody(page) {
  await click(page, await at(page, 1, 0));
  await wait(page);
  await click(page, await at(page, 2, 1), { modifiers: 'Shift' });
  await wait(page);
  assert.ok(await page.evaluate(`(() => { const o = document.querySelector('.beeson-table-bars .cell.block'); return !!o && !o.hidden; })()`), 'the range is not selected');
  await page.evaluate(`(() => { window.__w = []; const o = DataTransfer.prototype.setData; DataTransfer.prototype.setData = function (t, v) { window.__w.push([t, v]); return o.call(this, t, v); }; })()`);
  const base = { key: 'c', code: 'KeyC', windowsVirtualKeyCode: 67, modifiers: MOD[page.platform] };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base, commands: ['copy'] });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await wait(page);
  const w = await page.evaluate('window.__w');
  await press(page, 'Escape');
  await press(page, 'Escape');
  await page.evaluate('Reveal.slide(2)');
  await wait(page, 300);
  await page.evaluate('document.activeElement?.blur()');
  return { plain: w.find((x) => x[0] === 'text/plain')?.[1] ?? '', html: w.find((x) => x[0] === 'text/html')?.[1] ?? '' };
}

// the new table of a paste of the range Moon to 2.53e-5, whose cells are body cells as in the source
const BODY = '<tbody>\n      <tr><td>Moon</td><td style="text-align: right">\\(0.01215\\)</td></tr>\n      <tr><td>Europa</td><td style="text-align: right">2.53e-5</td></tr>\n    </tbody>';
const tables = (page) => page.evaluate(`Reveal.getCurrentSlide().querySelectorAll('table').length`);
const MENU_ITEM = (label) => `[...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.getClientRects().length && i.querySelector('.label')?.textContent === ${js(label)})`;
const rect = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const itemDimmed = (page, label) => page.evaluate(`${MENU_ITEM(label)}?.getAttribute('aria-disabled') === 'true'`);
const openEdit = async (page) => {
  await click(page, await rect(page, `[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === 'Edit')`));
  await wait(page);
};
const closeMenus = async (page) => {
  await page.evaluate('window.BeesonEditorShell?.closeMenus?.(); true');
  await wait(page);
};

// requirement 9i and N50: a range of body cells pasted onto a slide was written with th cells in
// its first row, drawn italic in the color of a header
for (const platform of PLATFORMS) {
  test(`a range of body cells pasted onto a slide by the key is a table of body cells (${platform})`, async (t) => {
    const page = await load(t, platform, TABLES, 1);
    const { plain, html } = await copyBody(page);
    assert.ok(html.includes('<td>Moon</td>'), html);
    const done = await page.evaluate(`(() => { const dt = new DataTransfer(); dt.setData('text/plain', ${js(plain)}); dt.setData('text/html', ${js(html)}); const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); (document.activeElement || document.body).dispatchEvent(ev); return ev.defaultPrevented; })()`);
    assert.ok(done, 'the paste is not taken by the editor');
    await wait(page, 300);
    assert.equal(await tables(page), 2, 'the paste does not make a table');
    const pasted = await render(page);
    assert.ok(pasted.includes(BODY), `the new table is not of body cells:\n${pasted.slice(pasted.lastIndexOf('<table>'), pasted.lastIndexOf('</table>'))}`);
    const look = await page.evaluate(`(() => { const c = Reveal.getCurrentSlide().querySelectorAll('table')[1].rows[0].cells[0]; const s = getComputedStyle(c); return { tag: c.localName, style: s.fontStyle }; })()`);
    assert.deepEqual(look, { tag: 'td', style: 'normal' });
    assert.equal(await undoLabel(page), 'Undo Paste Table');
    await roundTrip(page, page.source);
  });

  // N49: Paste of the Edit menu on the canvas with a range on the clipboard pasted nothing
  test(`Paste of the Edit menu on the canvas with a range of cells on the clipboard makes the table of the key (${platform})`, async (t) => {
    const page = await load(t, platform, TABLES, 1);
    await page.send('Page.bringToFront');
    await page.send('Browser.grantPermissions', { origin: server.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
    await copyBody(page);
    await click(page, await rect(page, `document.querySelector('.reveal section.present h2')`).then((p) => ({ x: p.x, y: p.y + 260 })));
    await wait(page);
    assert.equal(await tables(page), 1);
    await openEdit(page);
    assert.equal(await itemDimmed(page, 'Paste'), false, 'Paste is dimmed on the canvas');
    await click(page, await rect(page, MENU_ITEM('Paste')));
    await page.waitFor(`Reveal.getCurrentSlide().querySelectorAll('table').length === 2`).catch(() => {});
    await wait(page, 300);
    await closeMenus(page);
    assert.equal(await tables(page), 2, 'Paste of the Edit menu does not make a table');
    const pasted = await render(page);
    assert.ok(pasted.includes(BODY), `the new table is not the table of the key:\n${pasted.slice(pasted.lastIndexOf('<table>'), pasted.lastIndexOf('</table>'))}`);
    // the entry takes the name of the menu item, as in Keynote
    assert.equal(await undoLabel(page), 'Undo Paste');
    assert.deepEqual(await page.evaluate(`window.BeesonEditor.selection().map((el) => el.localName)`), ['table']);
    await roundTrip(page, page.source);
  });
}

// N44: a key pressed during a drag by a bar acted on the table, and the drag went on with a stale
// lifted copy
for (const platform of PLATFORMS) {
  test(`a key pressed during a drag of a row by its bar is without effect, and Esc ends the drag (${platform})`, async (t) => {
    const page = await load(t, platform, BARS, 1);
    // an earlier entry, which Mod+Z during the drag must not undo
    let p = await pressRow(page, 'A2', 1, 2.2);
    await pointer(page, 'mouseReleased', p.x, p.y);
    await wait(page);
    assert.deepEqual(await rowsOf(page), ['A1 B1 C1', 'A3 B3 C3', 'A4 B4 C4', 'A2 B2 C2']);
    assert.equal(await undoLabel(page), 'Undo Move Row');
    const moved = await render(page);
    p = await pressRow(page, 'A3', 1, 1.2);
    const lift = await liftText(page);
    assert.equal(lift, 'A3 B3 C3');
    for (const key of ['Mod+Z', 'Backspace', 'Delete', 'ArrowDown', 'Mod+X', 'PageDown']) {
      await press(page, key);
      await wait(page, 50);
      assert.equal(await page.evaluate('Reveal.getIndices().h'), 1, `${key} during the drag changes the slide`);
      assert.equal(await render(page), moved, `${key} during the drag changes the file`);
      assert.equal(await undoLabel(page), 'Undo Move Row', `${key} during the drag is an entry of the history`);
      assert.deepEqual(await rowsOf(page), ['A1 B1 C1', 'A3 B3 C3', 'A4 B4 C4', 'A2 B2 C2'], `${key} during the drag changes the table`);
      assert.ok(await shown(page, LIFT), `${key} during the drag takes the lifted row off`);
    }
    // the drag goes on, and the release moves the row
    await pointer(page, 'mouseReleased', p.x, p.y);
    await wait(page);
    assert.deepEqual(await rowsOf(page), ['A1 B1 C1', 'A4 B4 C4', 'A3 B3 C3', 'A2 B2 C2']);
    await roundTrip(page, moved);
    // Esc ends a drag, and its release writes nothing
    const now = await render(page);
    p = await pressRow(page, 'A1', 0, 1.2);
    await press(page, 'Escape');
    await wait(page);
    assert.equal(await shown(page, LIFT), null, 'Esc does not end the drag');
    await pointer(page, 'mouseReleased', p.x, p.y);
    await wait(page);
    assert.equal(await render(page), now);
    assert.deepEqual(errors(page), []);
  });
}

// the Plot Data window of test/pages/plot-loop.html on the sheet of its tab, whose columns 1 and 2
// are the x and the y of the mark dot
const cell = (r, c) => `${WINDOW} input[data-r="${r}"][data-c="${c}"]`;
const status = (page) => page.evaluate(`document.querySelector('${WINDOW} .state').textContent`);
async function dataWindow(t, platform) {
  const page = await load(t, platform, LOOP, 0);
  await click(page, '.reveal section.present .plot');
  await wait(page);
  await press(page, 'Mod+Shift+D');
  await page.waitFor(`!!document.querySelector('${WINDOW}:not([hidden])')`);
  await wait(page);
  return page;
}
async function cells(page, a, b) {
  await click(page, await rect(page, `document.querySelector(${js(cell(...a))})`));
  await wait(page, 100);
  await click(page, await rect(page, `document.querySelector(${js(cell(...b))})`), { modifiers: 'Shift' });
  await wait(page, 100);
}

// N46: Cut and Delete of the Edit menu on a range of numbers did nothing, without a message or an
// entry of the history. a plot does not draw a missing value, hence both are dimmed on such a
// range, and the window says why
for (const platform of PLATFORMS) {
  test(`Cut and Delete of the Edit menu are dimmed on a range of numbers of the Plot Data window, which says why (${platform})`, async (t) => {
    const page = await dataWindow(t, platform);
    await cells(page, [0, 1], [1, 2]);
    assert.equal(await page.evaluate(`document.querySelectorAll('${WINDOW} td.sel').length`), 4);
    assert.match(await status(page), /^2 × 2 cells selected\. .*cannot be left empty.*Cut and Delete/);
    await openEdit(page);
    assert.equal(await itemDimmed(page, 'Cut'), true, 'Cut is live on a range of numbers');
    assert.equal(await itemDimmed(page, 'Delete'), true, 'Delete is live on a range of numbers');
    assert.equal(await itemDimmed(page, 'Copy'), false, 'Copy is dimmed on a range of numbers');
    await closeMenus(page);
    // a range with a text keeps both items, which clear the text
    const page2 = await dataWindow(t, platform);
    await click(page2, await rect(page2, `[...document.querySelectorAll('${WINDOW} .sheets button')].find((b) => b.textContent.includes('event'))`));
    await wait(page2);
    await cells(page2, [0, 2], [0, 3]);
    assert.doesNotMatch(await status(page2), /cannot be left empty/);
    await openEdit(page2);
    assert.equal(await itemDimmed(page2, 'Cut'), false);
    assert.equal(await itemDimmed(page2, 'Delete'), false);
    await closeMenus(page2);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}

// N45: in a table with a merged cell, a move of rows that keeps every merged cell whole was refused
// without a sign, with a lifted copy and without a drop line
for (const platform of PLATFORMS) {
  test(`a row moved past a merged block and a merged block moved whole are moved, and a refused move is not lifted (${platform})`, async (t) => {
    let page = await load(t, platform, BARS, 3);
    const rows = await rowsOf(page);
    assert.deepEqual(rows, ['Family Period Jacobi', 'Halo 14.8 3.05', '6.6 3.04', 'Lyapunov 2.69 3.10']);
    // Lyapunov to the gap under the header row
    let p = await pressRow(page, 'Lyapunov', 3, -2);
    assert.ok(await shown(page, LIFT), 'the row is not lifted');
    assert.ok(await shown(page, DROP), 'the drop line is not drawn at the gap above the merged block');
    await pointer(page, 'mouseReleased', p.x, p.y);
    await wait(page);
    assert.deepEqual(await rowsOf(page), ['Family Period Jacobi', 'Lyapunov 2.69 3.10', 'Halo 14.8 3.05', '6.6 3.04']);
    assert.equal(await undoLabel(page), 'Undo Move Row');
    await roundTrip(page, page.source);
    // the two rows of Halo dragged below Lyapunov, on the file as it was opened
    page = await load(t, platform, BARS, 3);
    p = await pressRow(page, '14.8', 1, 2);
    assert.equal(await liftText(page), 'Halo 14.8 3.05 6.6 3.04');
    assert.ok(await shown(page, DROP), 'the drop line is not drawn after the last row');
    await pointer(page, 'mouseReleased', p.x, p.y);
    await wait(page);
    assert.deepEqual(await rowsOf(page), ['Family Period Jacobi', 'Lyapunov 2.69 3.10', 'Halo 14.8 3.05', '6.6 3.04']);
    await undo(page);
    await wait(page);
    assert.equal(await render(page), page.source);
    // Lyapunov into the merged block is refused, without a drop line
    p = await pressRow(page, 'Lyapunov', 3, -1);
    assert.equal(await shown(page, DROP), null, 'a drop line is drawn inside the merged block');
    await pointer(page, 'mouseReleased', p.x, p.y);
    await wait(page);
    assert.equal(await render(page), page.source);
    // the header row cannot be moved anywhere, hence it is not lifted
    p = await pressRow(page, 'Family', 0, 2);
    assert.equal(await shown(page, LIFT), null, 'the header row is lifted although it cannot be moved');
    assert.equal(await shown(page, DROP), null);
    await pointer(page, 'mouseReleased', p.x, p.y);
    await wait(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}
