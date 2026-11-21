import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press } from './helpers/editor.mjs';

const DECK = 'test/pages/layers.html';

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

async function open(t, page = { width: 1440, height: 900 }) {
  const p = await browser.newPage(page);
  t.after(() => p.close());
  await p.goto(`${server.origin}/${DECK}?edit&still`);
  await p.waitFor(deckSettled);
  await p.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  await p.evaluate('localStorage.clear()');
  assert.deepEqual((await p.evaluate(`window.BeesonEditor.open(${JSON.stringify(readFileSync(DECK, 'utf8'))})`)).problems, []);
  return p;
}

const read = (box) => `(() => { const box = document.querySelector(${JSON.stringify(box)}); return !box || box.hidden || !box.getClientRects().length ? null : [...box.querySelectorAll('button[aria-pressed]')].map((b) => (b.getAttribute('aria-pressed') === 'true' ? '*' : '') + b.textContent); })()`;
const tabs = (page) => page.evaluate(read('.beeson-step-tabs'));
const shown = (page, ids) => page.evaluate(`${JSON.stringify(ids)}.filter((id) => getComputedStyle(document.getElementById(id)).visibility === 'visible')`);
const SWAP = ['old-lead', 'old-step', 'old-span', 'new-lead', 'new-step'];
const tab = (label) => `[...document.querySelectorAll('.beeson-step-tabs button')].find((b) => b.textContent === ${JSON.stringify(label)})`;
const centerOf = (page, el) => page.evaluate(`(() => { const r = ${el}.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

async function assertPlaced(page) {
  const boxes = await page.evaluate(`(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
    const slide = box(document.querySelector('.reveal'));
    const cell = box(document.querySelector('.beeson-edit-canvas'));
    return [...document.querySelectorAll('.beeson-step-tabs button')].map((b) => {
      const r = box(b);
      return { r, slide, cell, top: document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2) === b };
    });
  })()`);
  assert.ok(boxes.length > 1);
  for (const { r, slide, cell, top } of boxes) {
    const at = JSON.stringify({ r, slide, cell });
    assert.ok(r.right - r.left >= 24 && r.bottom - r.top >= 24, `a tab is smaller than 24 px: ${at}`);
    assert.ok(r.left >= cell.left && r.right <= cell.right && r.top >= cell.top && r.bottom <= cell.bottom, `a tab is outside the canvas: ${at}`);
    assert.ok(r.right <= slide.left || r.left >= slide.right || r.bottom <= slide.top || r.top >= slide.bottom, `a tab covers the slide: ${at}`);
    assert.ok(top, `a tab is covered: ${at}`);
  }
}

test('a slide whose steps are cut into ranges has tabs beside it, and no second copy of them in the status bar', { timeout: 120000 }, async (t) => {
  const page = await open(t);
  assert.deepEqual(await tabs(page), ['*Up to step 2', 'From step 3']);
  assert.equal(await page.evaluate(`document.querySelector('.beeson-shown-steps')`), null);
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].filter((b) => /step [0-9]/i.test(b.textContent)).map((b) => b.textContent)`), []);
  await assertPlaced(page);

  await click(page, await centerOf(page, tab('From step 3')));
  await page.waitFor(`${tab('From step 3')}.getAttribute('aria-pressed') === 'true'`);
  assert.deepEqual(await tabs(page), ['Up to step 2', '*From step 3']);
  assert.deepEqual(await shown(page, SWAP), ['new-lead', 'new-step']);

  await page.evaluate(`${tab('Up to step 2')}.click()`);
  assert.deepEqual(await tabs(page), ['*Up to step 2', 'From step 3']);

  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].at(-1).focus()`);
  await press(page, 'Tab');
  await press(page, 'Tab');
  assert.equal(await page.evaluate(`document.activeElement === ${tab('From step 3')}`), true);
  for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, ...(type === 'keyDown' ? { text: '\r' } : {}) });
  await page.waitFor(`${tab('From step 3')}?.getAttribute('aria-pressed') === 'true'`);
  await press(page, 'Shift+Tab');
  assert.equal(await page.evaluate(`document.activeElement === ${tab('Up to step 2')}`), true);
  await press(page, 'Space');
  await page.waitFor(`${tab('Up to step 2')}?.getAttribute('aria-pressed') === 'true'`);
  assert.deepEqual(await shown(page, SWAP), ['old-lead', 'old-step', 'old-span']);

  const first = `JSON.stringify(document.querySelector('.beeson-step-tabs button').getBoundingClientRect())`;
  const before = await page.evaluate(first);
  await page.evaluate(`window.BeesonEditor.exec('zoom.in')`);
  await page.waitFor(`${first} !== ${JSON.stringify(before)}`);
  await assertPlaced(page);

  await page.evaluate('Reveal.slide(2)');
  await page.waitFor(`${read('.beeson-step-tabs')} === null`);
  await page.evaluate('Reveal.slide(1)');
  await page.waitFor(`${read('.beeson-step-tabs')}?.length === 4`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), readFileSync(DECK, 'utf8'));
  assert.deepEqual(page.errors, []);
});

test('the tabs fit beside the slide on a phone held across', { timeout: 120000 }, async (t) => {
  const page = await open(t, { width: 844, height: 390, mobile: true });
  assert.deepEqual(await tabs(page), ['*Up to step 2', 'From step 3']);
  await assertPlaced(page);
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [await centerOf(page, tab('From step 3'))] });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitFor(`${tab('From step 3')}?.getAttribute('aria-pressed') === 'true'`);
  assert.deepEqual(await shown(page, SWAP), ['new-lead', 'new-step']);
  assert.deepEqual(page.errors, []);
});

const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => el.id || el.className)`);

test('a row of the Steps pane whose element is hidden at the steps shown shows the steps at which it is seen', { timeout: 120000 }, async (t) => {
  const page = await open(t);
  await page.evaluate(`window.BeesonEditor.exec('view.steps')`);
  const row = (text) => `[...document.querySelectorAll('.beeson-edit-side .rows .row')].find((r) => r.querySelector('.text').textContent.startsWith(${JSON.stringify(text)}))`;
  await page.waitFor(`!!${row('The new lead')}?.getBoundingClientRect().width`);
  await click(page, await centerOf(page, `${row('The new lead')}.querySelector('.text')`));
  await page.waitFor(`${read('.beeson-step-tabs')}?.[1] === '*From step 3'`);
  assert.deepEqual(await selected(page), ['new-lead']);
  assert.deepEqual(await tabs(page), ['Up to step 2', '*From step 3']);
  await click(page, await centerOf(page, `${row('The old step')}.querySelector('.text')`));
  await page.waitFor(`${read('.beeson-step-tabs')}?.[0] === '*Up to step 2'`);
  assert.deepEqual(await selected(page), ['old-step']);
  await click(page, await centerOf(page, `${row('The old lead')}.querySelector('.text')`));
  await page.waitFor(`window.BeesonEditor.selection()[0]?.matches('.fade-out')`);
  assert.deepEqual(await tabs(page), ['*Up to step 2', 'From step 3']);
  assert.deepEqual(page.errors, []);
});

test('a row of the Object List whose element is hidden at the steps shown shows the steps at which it is seen', { timeout: 120000 }, async (t) => {
  const page = await open(t);
  await page.evaluate(`window.BeesonEditor.exec('view.objects')`);
  const row = (text) => `[...document.querySelectorAll('.beeson-edit-objects .row')].find((r) => r.textContent.includes(${JSON.stringify(text)}))`;
  await page.waitFor(`!!${row('The new lead')}?.getBoundingClientRect().width`);
  await click(page, await centerOf(page, row('The new lead')));
  await page.waitFor(`${read('.beeson-step-tabs')}?.[1] === '*From step 3'`);
  assert.deepEqual(await selected(page), ['new-lead']);
  assert.deepEqual(page.errors, []);
});
