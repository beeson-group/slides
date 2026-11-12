// regression tests of R12.8 on both platforms with trusted input: the undo of Tab and Shift+Tab in
// the outline, the keys of the Arrange menu in the Object List, and the drop line of a row dragged
// in the Object List. after each edit of the
// file the text is checked byte for byte after an undo and again after a redo

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const DECK = 'index.html';
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
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg ? `, ${js(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const settle = async (page) => {
  await page.evaluate('new Promise((d) => setTimeout(() => d(true), 120))');
  await frames(page);
};

// the editor on slide n, counted from 0, of deck, served over HTTP with the storage cleared
async function load(t, platform, { deck = DECK, n = 0 } = {}) {
  const page = await browser.newPage();
  t.after(() => page.close().catch(() => {}));
  await page.send('Page.bringToFront');
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear(); true');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(status.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

const OUTLINE = '.beeson-edit-outline';
// each slide of the outline as its number, then the depth and the start of each of its lines
const outline = (page) => page.evaluate(`[...document.querySelectorAll('${OUTLINE} .slide')].map((g) => [g.querySelector('.no').textContent, ...[...g.querySelectorAll('.line')].map((l) => l.style.getPropertyValue('--depth') + ' ' + l.textContent.slice(0, 20))])`);
const count = (page) => page.evaluate(`document.querySelector('.beeson-edit-bottom').textContent.match(/Slide \\S+ of \\d+/)?.[0]`);
const undoKey = (page) => press(page, 'Mod+Z');
const redoKey = (page) => press(page, 'Mod+Shift+Z');

// the outline shown, with the caret in its line that starts with text, by a click
async function caretIn(page, text) {
  if (!(await state(page, 'view.outline')).checked) await exec(page, 'view.outline');
  await frames(page);
  const at = await page.evaluate(`(() => {
    const t = [...document.querySelectorAll('${OUTLINE} .text')].find((e) => e.textContent.startsWith(${js(text)}));
    t.scrollIntoView({ block: 'center' });
    const r = t.getBoundingClientRect();
    return { x: r.left + 30, y: r.top + r.height / 2 };
  })()`);
  await click(page, at);
  await frames(page);
}

for (const platform of PLATFORMS) {
  // plots-objects-outline-1: in Keynote and PowerPoint, Tab in the outline demotes an item, and
  // one undo restores the file. one undo of the indent of the outline left the item twice
  test(`one undo of Tab in the outline restores the file (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await caretIn(page, 'Two elements');
    await press(page, 'Tab');
    await settle(page);
    const indented = await render(page);
    assert.notEqual(indented, page.source);
    assert.equal(indented.split('Two elements with the same index').length, 2);
    assert.equal((await outline(page))[2][4], '2 Two elements with th');
    await undoKey(page);
    await settle(page);
    await byteExact(page);
    assert.equal((await state(page, 'edit.undo')).enabled, false);
    assert.deepEqual((await outline(page))[2].slice(3, 6), ['1 Each step is a revea', '1 Two elements with th', '1 When exporting to PD']);
    await redoKey(page);
    await settle(page);
    assert.equal(await render(page), indented);
    assert.equal((await outline(page))[2][4], '2 Two elements with th');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Increase Indent Level');
    // Shift+Tab on the nested item takes it out again in one entry
    await caretIn(page, 'Two elements');
    await press(page, 'Shift+Tab');
    await settle(page);
    await byteExact(page);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Decrease Indent Level');
    await undoKey(page);
    await settle(page);
    assert.equal(await render(page), indented);
    const { text } = await saveAndReopen(page, `r12-8-tab-${platform}.html`);
    assert.equal(text, indented);
    assert.deepEqual(errors(page), []);
  });

  // plots-objects-outline-2: after an undo of Promote to Slide, the outline and the slide count
  // follow the deck, as in Keynote and PowerPoint
  test(`an undo of Shift+Tab in the outline redraws the outline and the slide count (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await caretIn(page, 'Two elements');
    const before = await outline(page);
    const slides = before.length;
    await press(page, 'Shift+Tab');
    await settle(page);
    const promoted = await render(page);
    assert.equal((await outline(page)).length, slides + 1);
    assert.equal(await count(page), `Slide 4 of ${slides + 1}`);
    await undoKey(page);
    await settle(page);
    await byteExact(page);
    assert.deepEqual(await outline(page), before);
    assert.equal(await count(page), `Slide 3 of ${slides}`);
    // the caret is in the item put back
    assert.equal(await page.evaluate(`document.activeElement.closest('${OUTLINE} .line.item')?.textContent.slice(0, 12)`), 'Two elements');
    await redoKey(page);
    await settle(page);
    assert.equal(await render(page), promoted);
    assert.equal((await outline(page)).length, slides + 1);
    assert.equal(await count(page), `Slide 4 of ${slides + 1}`);
    await undoKey(page);
    await settle(page);
    await byteExact(page);
    assert.deepEqual(await outline(page), before);
    assert.deepEqual(errors(page), []);
  });
}

const OBJECTS = '.beeson-edit-objects';
const ROW = `${OBJECTS} .row`;
const LIST_KEY = { mac: 'Mod+Shift+L', other: 'Alt+F10' };
// the rows of the object list as level, name, and selection, e.g. '1 Group *'
const rows = (page) =>
  page.evaluate(`[...document.querySelectorAll(${js(ROW)})].map((r) => r.getAttribute('aria-level') + ' ' + r.querySelector('.name').textContent + (r.getAttribute('aria-selected') === 'true' ? ' *' : ''))`);
const rowBox = (page, n) =>
  page.evaluate(`(() => { const r = document.querySelectorAll(${js(ROW)})[${n}].getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2, top: r.top, bottom: r.bottom }; })()`);
const KEYS = {
  mac: { group: 'Mod+Alt+G', lock: 'Mod+L', backward: 'Mod+Alt+Shift+B' },
  other: { group: 'Mod+G', lock: 'Mod+L', backward: 'Mod+ArrowDown' },
};

for (const platform of PLATFORMS) {
  // plots-objects-outline-4: in Keynote's object list and PowerPoint's Selection Pane, the keys of
  // the Arrange menu act on the rows chosen. they did nothing while a row had the focus
  test(`the keys of Group, Lock, and Send Backward act on the rows chosen in the Object List (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 4 });
    await press(page, LIST_KEY[platform]);
    await frames(page);
    const start = await rows(page);
    assert.equal(start.length, 4);
    await click(page, await rowBox(page, 0));
    await click(page, await rowBox(page, 2), { modifiers: 'Mod' });
    await frames(page);
    assert.deepEqual((await rows(page)).filter((r) => r.endsWith('*')).length, 2);
    await press(page, KEYS[platform].group);
    await settle(page);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Group');
    assert.equal((await rows(page))[0], '1 Group *');
    assert.equal(await page.evaluate(`!!document.activeElement.closest('${ROW}')`), true, 'the focus left the Object List');
    const grouped = await render(page);
    await undoKey(page);
    await settle(page);
    await byteExact(page);
    await redoKey(page);
    await settle(page);
    assert.equal(await render(page), grouped);
    await undoKey(page);
    await settle(page);
    // the figure alone, locked, then sent backward, from its focused row
    await click(page, await rowBox(page, 0));
    await press(page, KEYS[platform].lock);
    await settle(page);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Lock');
    assert.match(await render(page), /<figure class="zone"[^>]* data-locked/);
    await undoKey(page);
    await settle(page);
    await byteExact(page);
    await click(page, await rowBox(page, 0));
    await press(page, KEYS[platform].backward);
    await settle(page);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Send Backward');
    assert.deepEqual((await rows(page)).map((r) => r.replace(' *', '')), [start[1], start[0], start[2], start[3]]);
    await undoKey(page);
    await settle(page);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}

const dropLine = (page) => page.evaluate(`(() => { const d = document.querySelector('${OBJECTS} .drop'); return d && !d.hidden ? d.getBoundingClientRect().top + 1 : null; })()`);

for (const platform of PLATFORMS) {
  // plots-objects-outline-5: the drop line of a row drag marked a gap past the layers that the
  // figure can pass, and the figure stopped short of it. the line now stops at the last gap that
  // Send to Back reaches, and the row lands at the line
  test(`the drop line of a row drag in the Object List stops where the object can go (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 4 });
    await press(page, LIST_KEY[platform]);
    await frames(page);
    const start = (await rows(page)).map((r) => r.replace(' *', ''));
    assert.match(start[0], /Figure/);
    const from = await rowBox(page, 0);
    const last = await rowBox(page, 3);
    await drag(page, { x: from.x, y: from.y }, { dy: last.bottom + 10 - from.y, steps: 8, hold: true });
    // the figure passes the texts in the flow, hence Send to Back reaches the bottom of the list
    const line = await dropLine(page);
    assert.ok(line !== null && Math.abs(line - last.bottom) <= 2, `the drop line is at ${line}, not at the bottom of row 3 (${last.bottom})`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: from.x, y: last.bottom + 10, button: 'left', clickCount: 1 });
    await settle(page);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Reorder');
    const now = (await rows(page)).map((r) => r.replace(' *', ''));
    assert.deepEqual(now, [start[1], start[2], start[3], start[0]]);
    await undoKey(page);
    await settle(page);
    await byteExact(page);
    // the heading in the flow, which Bring to Front puts over the figure by a z-index since R13.1,
    // shows its drop line at the top of the list and lands there
    const h2 = await rowBox(page, 3);
    await drag(page, { x: h2.x, y: h2.y }, { dy: from.top + 2 - h2.y, steps: 8, hold: true });
    const top = await dropLine(page);
    assert.ok(top !== null && Math.abs(top - from.top) <= 2, `the drop line is at ${top}, not at the top of row 0 (${from.top})`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: h2.x, y: from.top + 2, button: 'left', clickCount: 1 });
    await settle(page);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Reorder');
    assert.deepEqual((await rows(page)).map((r) => r.replace(' *', '')), [start[3], start[0], start[1], start[2]]);
    await undoKey(page);
    await settle(page);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}
