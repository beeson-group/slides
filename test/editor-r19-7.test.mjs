// regression tests of R19.7 on both platforms, the findings D16, D17, and D18 of the fourth
// review of round 7: the keys that type a character in the speaker notes, Bold in the notes after
// a display was framed, and the inspector closed for the navigator in a narrow window, after the
// deck is opened again

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test-deck.html';
// the indices of the slides of index.html with the steps, the equations, and the figures
const STEPS = 2;
const EQUATIONS = 3;
const FIGURES = 4;

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
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const undoLabel = (page) => state(page, 'edit.undo').then((s) => s.label);
const exec = (page, id) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)})).then(() => true)`);
const rect = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

const urlOf = (platform) => `${server.origin}/${DECK}?edit&still&theme=light&edit-platform=${platform}`;

// opens the deck at url, with the storage of the browser as it is
async function open(page, url, n) {
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await wait(page, 300);
}

async function load(t, platform, n, size = { width: 1600, height: 1000 }) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  await page.goto(urlOf(platform));
  await page.evaluate('localStorage.clear()');
  await open(page, urlOf(platform), n);
  return page;
}

// the speaker notes of the slide shown, with the caret put by a click and then moved to their end
const NOTES = `Reveal.getCurrentSlide().querySelector('aside.notes')`;
async function notesCaret(page) {
  if (!(await state(page, 'view.notes')).checked) await exec(page, 'view.notes');
  await wait(page, 300);
  await click(page, await page.evaluate(`(() => { const r = ${NOTES}.getBoundingClientRect(); return { x: r.left + Math.min(40, r.width / 2), y: r.top + Math.min(10, r.height / 2) }; })()`));
  await wait(page);
  await page.evaluate(`(() => { const r = document.createRange(); r.selectNodeContents(${NOTES}); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r); return true; })()`);
  assert.equal(await page.evaluate(`!!document.activeElement.closest('aside.notes')`), true, 'the click does not put the caret into the notes');
}

// a key as a real keyboard sends it, e.g. Shift+0 with the key ) and the text )
const REAL = {
  ')': { code: 'Digit0', windowsVirtualKeyCode: 48, modifiers: 8 },
  '!': { code: 'Digit1', windowsVirtualKeyCode: 49, modifiers: 8 },
  '@': { code: 'Digit2', windowsVirtualKeyCode: 50, modifiers: 8 },
  '?': { code: 'Slash', windowsVirtualKeyCode: 191, modifiers: 8 },
  d: { code: 'KeyD', windowsVirtualKeyCode: 68, modifiers: 0 },
  g: { code: 'KeyG', windowsVirtualKeyCode: 71, modifiers: 0 },
};
async function real(page, key) {
  const base = { key, ...REAL[key] };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: key, unmodifiedText: key });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

for (const platform of PLATFORMS) {
  // D16: the notes take every bare key that types a character, also with Shift
  test(`the speaker notes take every key that types a character, also ) of Shift+0 (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await notesCaret(page);
    await exec(page, 'notes.zoomIn');
    await wait(page);
    const font = await page.evaluate(`getComputedStyle(${NOTES}).fontSize`);
    for (const key of Object.keys(REAL)) {
      const before = await page.evaluate(`${NOTES}.textContent`);
      await real(page, key);
      await wait(page, 100);
      assert.equal(await page.evaluate(`${NOTES}.textContent`), before + key, `the key ${key} is not typed into the notes`);
    }
    assert.equal(await page.evaluate(`getComputedStyle(${NOTES}).fontSize`), font, 'a key resets the zoom of the notes');
    assert.match(await render(page), /typeface of the slides\.\)!@\?dg<\/aside>/);
    assert.deepEqual(errors(page), []);
  });
}

for (const platform of PLATFORMS) {
  // D17: Bold and Italic act on a text of the notes, also after a display was framed
  test(`Bold and Italic are live in the notes after a display of math was framed (${platform})`, async (t) => {
    const page = await load(t, platform, EQUATIONS);
    await click(page, await rect(page, `Reveal.getCurrentSlide().querySelector('div.math mjx-container')`));
    await wait(page);
    assert.deepEqual(await page.evaluate(`window.BeesonEditor.selection().map((el) => el.localName)`), ['div']);
    await notesCaret(page);
    await page.evaluate(`(() => { const t = ${NOTES}.firstChild; getSelection().setBaseAndExtent(t, 0, t, 7); return true; })()`);
    assert.equal((await state(page, 'text.bold')).enabled, true, 'Bold is dimmed in the notes');
    assert.equal((await state(page, 'text.italic')).enabled, true, 'Italic is dimmed in the notes');
    await press(page, 'Mod+B');
    await wait(page);
    assert.equal(await undoLabel(page), 'Undo Bold');
    assert.match(await render(page), /<aside class="notes"><strong>The dis<\/strong>play is held/);
    assert.deepEqual(errors(page), []);
  });
}

// whether the navigator and the inspector are drawn, and whether Format is checked
const panes = (page) => page.evaluate(`(() => {
  const drawn = (s) => (document.querySelector(s)?.getBoundingClientRect().width ?? 0) > 0;
  return { nav: drawn('.beeson-edit-nav'), inspector: drawn('.beeson-edit-inspector'), format: window.BeesonEditor.state('shell.format').checked };
})()`);
async function resize(page, width, height) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await wait(page, 400);
}

for (const platform of PLATFORMS) {
  // D18: the inspector closed only to make room for the navigator comes back after a reopen
  test(`the inspector closed for the navigator in a narrow window is given back after the deck is opened again (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES, { width: 760, height: 900 });
    assert.deepEqual(await panes(page), { nav: false, inspector: true, format: true });
    await exec(page, 'view.navigator');
    await wait(page, 300);
    assert.deepEqual(await panes(page), { nav: true, inspector: false, format: false });
    await open(page, urlOf(platform), FIGURES);
    assert.equal((await panes(page)).inspector, true, 'the inspector is not shown after the deck is opened again at 760 px');
    await resize(page, 1600, 900);
    assert.deepEqual(await panes(page), { nav: true, inspector: true, format: true }, 'the inspector is not given back at 1600 px after the deck is opened again');
    // Format closed by hand stays closed after a reopen
    await exec(page, 'shell.format');
    await wait(page);
    await open(page, urlOf(platform), FIGURES);
    assert.deepEqual(await panes(page), { nav: true, inspector: false, format: false }, 'Format closed by hand is opened again');
    assert.deepEqual(errors(page), []);
  });
}
