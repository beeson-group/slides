// regression tests of R11.3 on both platforms with trusted input: the drag of a group row of the
// object list, checked when rendered, after each undo and redo, and after a save and an open of the
// saved text

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, drag, press, saveAndReopen } from './helpers/editor.mjs';

const GROUPS = 'test/pages/editor-r11-3.html';
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
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

// the editor on slide n of deck, served over HTTP, with the storage of the browser cleared and the
// Format pane shown
async function load(t, platform, { deck = GROUPS, n = 0 } = {}) {
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
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

let saves = 0;
async function saved(page) {
  const { text } = await saveAndReopen(page, `r11-3-${++saves}.html`);
  page.source = text;
  await byteExact(page);
}

const OBJECTS = '.beeson-edit-objects';
const ROW = `${OBJECTS} .row`;
const LIST_KEY = { mac: 'Mod+Shift+L', other: 'Alt+F10' };
// the rows of the object list as level, name, and selection, e.g. '1 Group *'
const rows = (page) =>
  page.evaluate(`[...document.querySelectorAll(${js(ROW)})].map((r) => r.getAttribute('aria-level') + ' ' + r.querySelector('.name').textContent + (r.getAttribute('aria-selected') === 'true' ? ' *' : ''))`);
const rowBox = (page, n) =>
  page.evaluate(`(() => { const r = document.querySelectorAll(${js(ROW)})[${n}].getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2, top: r.top, bottom: r.bottom }; })()`);
const GROUPED = readFileSync(GROUPS, 'utf8');
const figure = (name) => {
  const end = GROUPED.indexOf(`<figcaption class="caption">${name}</figcaption>\n      </figure>`);
  return GROUPED.slice(GROUPED.lastIndexOf('      <figure', end), GROUPED.indexOf('</figure>', end) + '</figure>\n'.length);
};
// the deck of groups with its figures in the order of names, from back to front
const ordered = (...names) => {
  const first = GROUPED.indexOf(figure('A'));
  const last = GROUPED.indexOf(figure('C')) + figure('C').length;
  return GROUPED.slice(0, first) + names.map(figure).join('') + GROUPED.slice(last);
};

for (const platform of PLATFORMS) {
  // a group row could not be dragged. it now moves its members in the order of the layers as one
  // object, and they keep their order among themselves
  test(`a group row is dragged as one object, whose members keep their order, as one entry (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: GROUPS, n: 0 });
    await press(page, LIST_KEY[platform]);
    await frames(page);
    assert.deepEqual(await rows(page), ['1 Group', '2 Figure: C', '2 Figure: A', '1 Figure: B', '1 Text: A group around a figure']);
    // the group behind B: C passes B, and A stays behind C
    let from = await rowBox(page, 0);
    let to = await rowBox(page, 3);
    await drag(page, { x: from.x, y: from.y }, { dy: to.bottom - 2 - from.y, steps: 8 });
    await frames(page);
    assert.deepEqual(await rows(page), ['1 Figure: B', '1 Group *', '2 Figure: C *', '2 Figure: A *', '1 Text: A group around a figure']);
    const behind = ordered('A', 'C', 'B');
    assert.equal(await render(page), behind);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Reorder');
    // the group in front of B again: both members pass B, in their order
    from = await rowBox(page, 1);
    to = await rowBox(page, 0);
    await drag(page, { x: from.x, y: from.y }, { dy: to.top + 2 - from.y, steps: 8 });
    await frames(page);
    assert.deepEqual(await rows(page), ['1 Group *', '2 Figure: C *', '2 Figure: A *', '1 Figure: B', '1 Text: A group around a figure']);
    const front = ordered('B', 'A', 'C');
    assert.equal(await render(page), front);
    await undo(page);
    assert.equal(await render(page), behind);
    await undo(page);
    assert.equal(await render(page), page.source);
    await redo(page);
    assert.equal(await render(page), behind);
    await redo(page);
    assert.equal(await render(page), front);
    await saved(page);
    assert.deepEqual(errors(page), []);
  });
}
