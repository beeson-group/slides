// regression tests of R19.5 on both platforms. Redo with a value typed into a field of the
// inspector redoes the entry that it names, and the redone value replaces the typed one (D10). an
// undo with the focus in Start at keeps the focus there (D11), and an undo refuses a Start at
// that is not whole, as Tab and Return do, and leaves the file unchanged (D12)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { center, click, drag, press, type } from './helpers/editor.mjs';

const DECK = 'test-deck.html';
const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
// slide 5 of the demo deck, with a heading, a paragraph, a list of three items, and a figure
const FIGURES = 4;
const SLIDE = '.reveal .slides > section.present';
const IMG = `${SLIDE} figure.zone img.for-dark`;

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
const wait = (page, ms = 300) => page.evaluate(`new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), ${ms}))`);
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const labels = async (page) => [(await state(page, 'edit.undo')).label, (await state(page, 'edit.redo')).label];
const focused = (page) => page.evaluate(`(() => { const a = document.activeElement; return a ? a.localName + (a.id ? '#' + a.id : '') : null; })()`);
const fieldValue = (page, id) => page.evaluate(`document.querySelector('#beeson-edit-num-${id}')?.value ?? null`);
const title = (page) => page.evaluate(`document.querySelector('.beeson-edit-menubar .state, .beeson-edit-header .state')?.textContent ?? null`);
const rect = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const findItem = `(l) => [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.getClientRects().length && (i.querySelector('.label')?.firstChild?.textContent ?? '') === l)`;

async function load(t, platform, { deck = DECK, slide = FIGURES } = {}) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${slide})`);
  await wait(page);
  return page;
}

// the item label of the menu bar named bar, chosen by trusted clicks
async function choose(page, bar, label) {
  await click(page, await rect(page, `[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)})`));
  await wait(page, 200);
  const at = await rect(page, `(${findItem})(${js(label)})`);
  assert.ok(at, `the ${bar} menu does not have ${label}`);
  await click(page, at);
  await wait(page, 400);
}

// the figure of slide 5 moved by one press of the right arrow key, with the Arrange pane open and
// the focus in W. text is the file after the move
async function moved(t, platform) {
  const page = await load(t, platform);
  await click(page, await center(page, IMG));
  await press(page, 'ArrowRight');
  await wait(page, 1100);
  const text = await render(page);
  assert.notEqual(text, page.source, 'the right arrow key did not move the figure');
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await wait(page);
  await exec(page, 'arrange.sizeAndPosition');
  await wait(page);
  return { page, text };
}

async function typeInto(page, id, value) {
  const sel = `#beeson-edit-num-${id}`;
  await click(page, await center(page, sel));
  await page.evaluate(`document.querySelector(${js(sel)}).select()`);
  await type(page, value);
  await wait(page);
}

const START = '.beeson-edit-inspector input[name="Start at"]';
const olTag = async (page) => (await render(page)).match(/<ol[^>]*>/)?.[0] ?? null;
const startFocused = (page) => page.evaluate(`document.activeElement === document.querySelector(${js(START)}) && document.activeElement.isConnected`);
const startValue = (page) => page.evaluate(`document.querySelector(${js(START)})?.value ?? null`);

// the Undo or the Redo of the toolbar, or the item of the Edit menu that reads label
async function step(page, how, label) {
  if (how === 'toolbar') {
    await click(page, await center(page, `[data-command="edit.${label.startsWith('Undo') ? 'undo' : 'redo'}"]`));
    await wait(page, 500);
  } else await choose(page, 'Edit', label);
}

// the first list item of slide 5 made a numbered list, with the Text tab of the inspector open.
// list is the file with this list
async function numbered(t, platform) {
  const page = await load(t, platform);
  const at = await rect(page, `(() => { const li = Reveal.getCurrentSlide().querySelector(':scope ul > li'); const n = [...li.childNodes].find((c) => c.nodeType === 3 && c.data.trim()); const r = document.createRange(); r.setStart(n, 2); r.setEnd(n, 3); return r; })()`);
  await click(page, at);
  await wait(page);
  await exec(page, 'text.list.ol');
  await wait(page, 400);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await wait(page);
  const tab = await rect(page, `[...document.querySelectorAll('.beeson-edit-inspector .ed-tabs button')].find((b) => b.textContent.trim() === 'Text')`);
  if (tab) await click(page, tab);
  await wait(page);
  const list = await render(page);
  assert.match(await olTag(page), /^<ol(?![^>]*start=)/);
  assert.equal(await startValue(page), '1');
  await click(page, await center(page, START), { count: 3 });
  await wait(page, 150);
  return { page, list };
}

for (const platform of PLATFORMS) {
  for (const how of ['menu', 'toolbar']) {
    // D10: the typed 300 was entered as Position, which cleared the redo, hence the Move was lost
    test(`Redo of the ${how} with 300 typed into X redoes the Move and keeps the focus in X (${platform})`, async (t) => {
      const { page, text } = await moved(t, platform);
      const x = await fieldValue(page, 'x');
      await undo(page);
      await wait(page);
      assert.equal(await render(page), page.source);
      await typeInto(page, 'x', '300');
      assert.deepEqual(await labels(page), ['Undo', 'Redo Move']);
      await step(page, how, 'Redo Move');
      assert.equal(await render(page), text, 'the file after the redo is not the moved one');
      assert.deepEqual(await labels(page), ['Undo Move', 'Redo']);
      assert.equal(await focused(page), 'input#beeson-edit-num-x', 'the focus left the field');
      assert.equal(await fieldValue(page, 'x'), x, 'the field does not show the redone place');
      await press(page, 'Tab');
      await wait(page, 400);
      assert.equal(await render(page), text, 'Tab wrote the typed value after the redo');
      assert.deepEqual(errors(page), []);
    });

    // D11: the undo selected the list, the pane was built again, and the focus fell to the body
    test(`Undo of the ${how} with the focus in Start at keeps the focus there (${platform})`, async (t) => {
      const { page, list } = await numbered(t, platform);
      await type(page, '4');
      if (how === 'toolbar') await press(page, 'Enter');
      await wait(page, 400);
      // without Return, the undo enters 4 first and undoes it
      if (how === 'toolbar') assert.match(await olTag(page), /start="4"/);
      await step(page, how, (await labels(page))[0]);
      assert.equal(await render(page), list);
      assert.deepEqual(await labels(page), ['Undo List Style', 'Redo Start At']);
      assert.equal(await startFocused(page), true, 'the focus left Start at');
      assert.equal(await startValue(page), '1');
      assert.deepEqual(errors(page), []);
    });

    // D12: the undo entered 2.5 as 3 and undid it, and the redo then wrote start="3"
    test(`Undo of the ${how} refuses 2.5 typed into Start at and leaves the file unchanged (${platform})`, async (t) => {
      const { page, list } = await numbered(t, platform);
      const before = await labels(page);
      await type(page, '2.5');
      await wait(page);
      await step(page, how, before[0]);
      assert.equal(await render(page), list, 'the undo changed the file');
      assert.deepEqual(await labels(page), before, 'the undo entered the value or undid the entry before it');
      assert.equal(await startFocused(page), true, 'the focus left Start at');
      assert.equal(await startValue(page), '1');
      assert.deepEqual(errors(page), []);
    });
  }
}
