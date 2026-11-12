// regression tests of R13.3 on both platforms with trusted input: the start number of a numbered
// list, drawn by the theme from the attribute start and written with the field Start at of the Text
// pane and by Return on an empty item that cuts a numbered list, and a row or a column of a table
// moved by a drag of its bar and by the commands Move Row Up, Move Row Down, Move Column Left, and
// Move Column Right. after each edit the text is checked byte for byte after an undo, the edit
// again after a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { attributeProblem, editProblems, themeClasses } from '../src/editor/model/scope.ts';
import { click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const DECK = 'test/pages/editor-r13-3.html';
const PLATFORMS = ['mac', 'other'];
const LISTS = 0;
const PLAIN = 1;
const HEADER = 2;
const MERGED = 3;

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
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
let saves = 0;

// the editor on slide n of the deck, served over HTTP, with the storage of the origin emptied
async function load(t, platform, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${DECK}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the edit checked against base after an undo, again after a redo, and after a save and an open,
// whose text becomes page.source
async function roundTrip(page, base = page.source) {
  const edited = await render(page);
  assert.notEqual(edited, base, 'the action does not change the file');
  await undo(page);
  assert.equal(await render(page), base, 'the undo does not give the file back byte for byte');
  await redo(page);
  assert.equal(await render(page), edited, 'the redo does not write the edit again');
  const { text } = await saveAndReopen(page, `r13-3-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

// the numbers drawn before the items of selector, read from the tree of accessibility of Chrome,
// in which the counter of a pseudo-element is a text node of the item
async function drawnNumbers(page, selector) {
  await page.send('Accessibility.enable', {});
  const { root } = await page.send('DOM.getDocument', { depth: 0 });
  const { nodeIds } = await page.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector });
  const { nodes } = await page.send('Accessibility.getFullAXTree', {});
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const out = [];
  for (const nodeId of nodeIds) {
    const { node } = await page.send('DOM.describeNode', { nodeId });
    const li = nodes.find((n) => n.backendDOMNodeId === node.backendNodeId);
    const texts = [];
    const walk = (n) => {
      if (n.role?.value === 'StaticText') texts.push(n.name?.value ?? '');
      for (const id of n.childIds ?? []) if (byId.has(id)) walk(byId.get(id));
    };
    if (li) walk(li);
    out.push(texts[0]);
  }
  return out;
}

// the numbers drawn before the first items of selector once they are expected, since Chrome
// updates its tree of accessibility after a change of the page, within 3 s
async function numbersAre(page, selector, expected) {
  let now = [];
  for (const end = Date.now() + 3000; Date.now() < end; await new Promise((d) => setTimeout(d, 100))) {
    now = (await drawnNumbers(page, selector)).slice(0, expected.length);
    if (JSON.stringify(now) === JSON.stringify(expected)) return;
  }
  assert.deepEqual(now, expected);
}

// the shown element of selector that holds needle, as an expression
const find = (selector, needle = '') => `[...document.querySelectorAll(${js(selector)})].find((el) => el.getBoundingClientRect().width && el.textContent.includes(${js(needle)}))`;
const ITEM = '.reveal section.present ol > li';

// the client point of the middle of the text needle
const pointOf = (page, selector, needle) => page.evaluate(`(() => {
  const el = ${find(selector, needle)};
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const i = n.data.indexOf(${js(needle)});
    if (i < 0) continue;
    const r = document.createRange();
    r.setStart(n, i);
    r.setEnd(n, i + ${js(needle)}.length);
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }
})()`);

// the caret put at the end of the item that holds needle
const caretAtEnd = (page, needle) => page.evaluate(`(() => {
  const li = ${find(ITEM, needle)};
  const w = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
  let last = null;
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.data.trim()) last = n;
  li.closest('[contenteditable="true"]').focus();
  getSelection().collapse(last, last.length);
})()`);

// the tab of the inspector named name shown, with the Format pane open
async function showTab(page, name) {
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await frames(page);
  const at = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-inspector .ed-tabs button')].find((b) => b.textContent.trim() === ${js(name)}); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (at) await click(page, at);
  await frames(page);
}

const START = '.beeson-edit-inspector input[name="Start at"]';

test('the theme draws a numbered list from its attribute start, in the show and in the print view', async (t) => {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(deckUrl(DECK, 'still'));
  await page.waitFor(deckSettled);
  assert.deepEqual(await drawnNumbers(page, 'section ol > li'), ['1', '2', '3', '4', '5', '7', '8']);
  await printView(page, deckUrl(DECK, 'print-pdf&still'));
  const printed = await drawnNumbers(page, '.pdf-page ol > li');
  assert.deepEqual(printed.slice(0, 7), ['1', '2', '3', '4', '5', '7', '8']);
});

test('the attribute start is in the scope rule only on an ol and only as a whole number', () => {
  assert.equal(attributeProblem('start', false, 'ol', '3'), null);
  assert.equal(attributeProblem('start', false, 'ul', '3'), 'the attribute start');
  assert.equal(attributeProblem('start', false, 'ol', 'x'), 'the attribute start');
  assert.equal(attributeProblem('start', false, 'ol', '-2'), 'the attribute start');
  const theme = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
  assert.deepEqual(editProblems('ol', [], { attrs: { start: '4' } }, theme), []);
  assert.deepEqual(editProblems('li', [], { attrs: { start: '4' } }, theme), ['the attribute start']);
});

for (const platform of PLATFORMS) {
  test(`the field Start at of the Text pane writes start on a numbered list, and a 1 takes it off (${platform})`, async (t) => {
    const page = await load(t, platform, LISTS);
    await click(page, await pointOf(page, ITEM, 'Bravo'));
    await showTab(page, 'Text');
    assert.equal(await page.evaluate(`document.querySelector(${js(START)})?.value`), '1', 'the Text pane does not have a field Start at that shows 1');
    await click(page, START, { count: 3 });
    await type(page, '4');
    await press(page, 'Enter');
    await frames(page);
    const four = await render(page);
    assert.equal(four, page.source.replace('<ol>', '<ol start="4">'));
    assert.equal(await undoLabel(page), 'Undo Start At');
    await numbersAre(page, '.reveal section.present ol > li', ['4', '5', '6', '7', '8']);
    await roundTrip(page);
    // a typed 1 takes the attribute off, which gives the file back
    await click(page, await pointOf(page, ITEM, 'Charlie'));
    await showTab(page, 'Text');
    assert.equal(await page.evaluate(`document.querySelector(${js(START)}).value`), '4');
    await click(page, START, { count: 3 });
    await type(page, '1');
    await press(page, 'Enter');
    await frames(page);
    assert.equal(await render(page), readFileSync(DECK, 'utf8'));
    await roundTrip(page);
  });

  test(`the field Start at is dimmed outside a numbered list (${platform})`, async (t) => {
    const page = await load(t, platform, LISTS);
    await click(page, await pointOf(page, ITEM, 'Bravo'));
    await exec(page, 'text.list.ul');
    await frames(page);
    await showTab(page, 'Text');
    assert.equal(await page.evaluate(`document.querySelector(${js(START)})?.disabled`), true, 'Start at is not dimmed in a list of dashes');
    assert.equal((await state(page, 'text.list.start')).enabled, false);
  });

  test(`Return on an empty item cuts a numbered list, and the second list goes on with the count (${platform})`, async (t) => {
    const page = await load(t, platform, LISTS);
    await caretAtEnd(page, 'Bravo');
    await press(page, 'Enter');
    const added = await render(page);
    await press(page, 'Enter');
    const cut = await render(page);
    assert.match(cut, /<li>Bravo<\/li>\n {2}<\/ol>\n {2}<p><\/p>\n {2}<ol start="3">\n {4}<li>Charlie<\/li>/, `the second list does not start at 3: ${cut.match(/Bravo[\s\S]{0,120}/)?.[0]}`);
    await numbersAre(page, '.reveal section.present ol > li', ['1', '2', '3', '4', '5']);
    assert.equal(await undoLabel(page), 'Undo New Paragraph');
    await roundTrip(page, added);
    // a list with a start number goes on from it
    await caretAtEnd(page, 'Seventh');
    await press(page, 'Enter');
    await press(page, 'Enter');
    const again = await render(page);
    assert.match(again, /<li>Seventh<\/li>\n {2}<\/ol>\n {2}<p><\/p>\n {2}<ol start="8">\n {4}<li>Eighth<\/li>/, `the second list does not go on from 7: ${again.match(/Seventh[\s\S]{0,140}/)?.[0]}`);
  });

  test(`Dashes on a numbered list with a start number takes the attribute off (${platform})`, async (t) => {
    const page = await load(t, platform, LISTS);
    await click(page, await pointOf(page, ITEM, 'Seventh'));
    await exec(page, 'text.list.ul');
    await frames(page);
    assert.ok((await render(page)).includes('<ul>\n    <li>Seventh</li>'), 'the list of dashes keeps the attribute start');
    await roundTrip(page);
  });
}

// the rows of the table of the current slide, as the texts of their cells
const rowsOf = (page) => page.evaluate(`[...document.querySelector('.reveal section.present table').rows].map((tr) => [...tr.cells].map((c) => c.textContent.trim()).join(' '))`);
const onSegments = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-table-bars .bar > .on')].map((d) => d.textContent)`);
const segment = (bar, i) => `.beeson-table-bars .bar.${bar} > [data-index="${i}"]`;
const middle = async (page, selector) => page.evaluate(`(() => { const r = document.querySelector(${js(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })()`);
const lineShown = (page) => page.evaluate(`(() => { const l = document.querySelector('.beeson-table-bars .drop'); return !!l && !l.hidden && l.getBoundingClientRect().width > 0; })()`);
const menuLabels = (page) =>
  page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu [role^="menuitem"]')].map((m) => ({ label: m.querySelector('.label')?.textContent ?? m.textContent.trim(), disabled: m.getAttribute('aria-disabled') === 'true' }))`);
const cellPoint = (page, text) => pointOf(page, '.reveal section.present td, .reveal section.present th', text);

// the row or the column of segment i of a bar selected by a click on it, with the caret first put
// into the cell of text so that the bars are shown
async function selectLine(page, text, bar, i, shift = false) {
  if (!shift) await click(page, await cellPoint(page, text));
  await frames(page);
  await click(page, await middle(page, segment(bar, i)), { modifiers: shift ? 'Shift' : '' });
  await frames(page);
}

// a drag of segment i of a bar by d times the size of the segment, released, or held with hold
async function dragSegment(page, bar, i, d, hold = false) {
  const m = await middle(page, segment(bar, i));
  const step = bar === 'rows' ? { dy: d * m.h } : { dx: d * m.w };
  await drag(page, m, { ...step, steps: 12, hold });
  await frames(page);
}

for (const platform of PLATFORMS) {
  test(`a drag of a selected row bar moves the row down by one and by two, with a line at the gap (${platform})`, async (t) => {
    const page = await load(t, platform, PLAIN);
    await selectLine(page, 'A2', 'rows', 1);
    assert.deepEqual(await onSegments(page), ['A', 'B', 'C', '2']);
    await dragSegment(page, 'rows', 1, 1, true);
    assert.equal(await lineShown(page), true, 'the gap where the row lands is not marked by a line');
    const m = await middle(page, segment('rows', 1));
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: m.x, y: m.y + m.h, button: 'left', clickCount: 1 });
    await page.waitFor(`window.BeesonEditor.state('edit.undo').label === 'Undo Move Row'`);
    await frames(page);
    assert.deepEqual(await rowsOf(page), ['A1 B1 C1', 'A3 B3 C3', 'A2 B2 C2', 'A4 B4 C4']);
    assert.equal(await lineShown(page), false);
    assert.deepEqual(await onSegments(page), ['A', 'B', 'C', '3'], 'the moved row does not stay selected');
    await roundTrip(page);
    // the first row moved down by two takes the widths of the columns off it, which stay on the row
    // that is first now
    await selectLine(page, 'A1', 'rows', 0);
    await dragSegment(page, 'rows', 0, 2);
    assert.deepEqual(await rowsOf(page), ['A3 B3 C3', 'A2 B2 C2', 'A1 B1 C1', 'A4 B4 C4']);
    const moved = await render(page);
    assert.match(moved, /<tr><td style="width: 300px">A3<\/td><td style="width: 200px">B3<\/td><td>C3<\/td><\/tr>/);
    assert.match(moved, /<tr><td>A1<\/td><td>B1<\/td><td>C1<\/td><\/tr>/);
    assert.deepEqual(await onSegments(page), ['A', 'B', 'C', '3']);
    await roundTrip(page);
  });

  test(`a range of two rows is moved together, and Esc during a drag cancels it (${platform})`, async (t) => {
    const page = await load(t, platform, PLAIN);
    await selectLine(page, 'A2', 'rows', 1);
    await selectLine(page, 'A2', 'rows', 2, true);
    assert.deepEqual(await onSegments(page), ['A', 'B', 'C', '2', '3']);
    await dragSegment(page, 'rows', 2, 1, true);
    assert.equal(await lineShown(page), true);
    await press(page, 'Escape');
    await frames(page);
    assert.equal(await lineShown(page), false, 'Esc does not take the line off');
    const m = await middle(page, segment('rows', 2));
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: m.x, y: m.y + m.h, button: 'left', clickCount: 1 });
    await frames(page);
    assert.equal(await render(page), page.source, 'a drag canceled by Esc changes the file');
    assert.deepEqual(await onSegments(page), ['A', 'B', 'C', '2', '3']);
    await dragSegment(page, 'rows', 2, 1);
    assert.deepEqual(await rowsOf(page), ['A1 B1 C1', 'A4 B4 C4', 'A2 B2 C2', 'A3 B3 C3']);
    assert.equal(await undoLabel(page), 'Undo Move Row');
    assert.deepEqual(await onSegments(page), ['A', 'B', 'C', '3', '4']);
    await roundTrip(page);
  });

  test(`a press on a row bar that is not selected selects its row and does not move it (${platform})`, async (t) => {
    const page = await load(t, platform, PLAIN);
    await click(page, await cellPoint(page, 'A2'));
    await frames(page);
    await dragSegment(page, 'rows', 1, 1);
    assert.equal(await render(page), page.source);
  });

  test(`a drag of a selected column bar moves the column left with its width (${platform})`, async (t) => {
    const page = await load(t, platform, PLAIN);
    await selectLine(page, 'B2', 'cols', 1);
    assert.deepEqual(await onSegments(page), ['B', '1', '2', '3', '4']);
    await dragSegment(page, 'cols', 1, -1);
    assert.deepEqual(await rowsOf(page), ['B1 A1 C1', 'B2 A2 C2', 'B3 A3 C3', 'B4 A4 C4']);
    assert.equal(await undoLabel(page), 'Undo Move Column');
    assert.match(await render(page), /<tr><td style="width: 200px">B1<\/td><td style="width: 300px">A1<\/td><td>C1<\/td><\/tr>/);
    assert.deepEqual(await onSegments(page), ['A', '1', '2', '3', '4'], 'the moved column does not stay selected');
    await roundTrip(page);
  });

  test(`Move Row and Move Column are in the menus of the bars and of a cell, dimmed at the edge of the table (${platform})`, async (t) => {
    const page = await load(t, platform, PLAIN);
    await selectLine(page, 'A1', 'rows', 0);
    await click(page, await middle(page, segment('rows', 0)), { button: 'right' });
    await frames(page);
    const rowMenu = await menuLabels(page);
    assert.deepEqual(rowMenu.filter((m) => m.label.startsWith('Move')), [{ label: 'Move Row Up', disabled: true }, { label: 'Move Row Down', disabled: false }]);
    await press(page, 'Escape');
    await selectLine(page, 'C1', 'cols', 2);
    await click(page, await middle(page, segment('cols', 2)), { button: 'right' });
    await frames(page);
    const colMenu = await menuLabels(page);
    assert.deepEqual(colMenu.filter((m) => m.label.startsWith('Move')), [{ label: 'Move Column Left', disabled: false }, { label: 'Move Column Right', disabled: true }]);
    await press(page, 'Escape');
    await click(page, await cellPoint(page, 'B4'));
    await click(page, await cellPoint(page, 'B4'), { button: 'right' });
    await frames(page);
    const cellMenu = await menuLabels(page);
    assert.deepEqual(cellMenu.filter((m) => m.label.startsWith('Move')).map((m) => [m.label, m.disabled]), [['Move Row Up', false], ['Move Row Down', true], ['Move Column Left', false], ['Move Column Right', false]]);
    await press(page, 'Escape');
    // with the caret in a cell, the commands move its row or its column
    await click(page, await cellPoint(page, 'B2'));
    await exec(page, 'table.moveRowUp');
    await frames(page);
    assert.deepEqual(await rowsOf(page), ['A2 B2 C2', 'A1 B1 C1', 'A3 B3 C3', 'A4 B4 C4']);
    assert.match(await render(page), /<tr><td style="width: 300px">A2<\/td><td style="width: 200px">B2<\/td><td>C2<\/td><\/tr>\n\s*<tr><td>A1<\/td><td>B1<\/td><td>C1<\/td><\/tr>/);
    await roundTrip(page);
    await click(page, await cellPoint(page, 'B3'));
    await exec(page, 'table.moveColumnRight');
    await frames(page);
    assert.deepEqual(await rowsOf(page), ['A2 C2 B2', 'A1 C1 B1', 'A3 C3 B3', 'A4 C4 B4']);
    assert.equal(await undoLabel(page), 'Undo Move Column Right');
    await roundTrip(page);
  });

  test(`a header row and the body rows are not mixed, and a merged cell blocks a move across it (${platform})`, async (t) => {
    const page = await load(t, platform, HEADER);
    await selectLine(page, 'Moon', 'rows', 1);
    assert.equal((await state(page, 'table.moveRowUp')).enabled, false, 'the first body row moves into the header');
    await dragSegment(page, 'rows', 1, -1, true);
    assert.equal(await lineShown(page), false, 'a line is shown in the header');
    await press(page, 'Escape');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 0, y: 0, button: 'left', clickCount: 1 });
    assert.equal(await render(page), page.source);
    await exec(page, 'table.moveRowDown');
    await frames(page);
    assert.deepEqual(await rowsOf(page), ['Body Mass ratio System', 'Europa 2.53e-5 Jupiter', 'Moon 0.01215 Earth and Moon', 'Titan 2.37e-4 Saturn']);
    await roundTrip(page);

    await page.evaluate(`Reveal.slide(${MERGED})`);
    await frames(page);
    await selectLine(page, 'Lyapunov', 'rows', 3);
    // Move Row Up moves the row past the whole merged block, and a drag into the block is refused
    assert.equal((await state(page, 'table.moveRowUp')).enabled, true, 'Move Row Up of the row under a merged block is dimmed');
    await dragSegment(page, 'rows', 3, -1, true);
    assert.equal(await lineShown(page), false, 'a line is shown inside a merged cell');
    await press(page, 'Escape');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 0, y: 0, button: 'left', clickCount: 1 });
    // the column Period is not moved across the merged cell Halo, and the column Jacobi is moved
    await click(page, await cellPoint(page, '14.8'));
    assert.equal((await state(page, 'table.moveColumnLeft')).enabled, false, 'a column moves across a merged cell');
    assert.equal((await state(page, 'table.moveColumnRight')).enabled, true);
    assert.equal(await render(page), page.source);
  });
}
