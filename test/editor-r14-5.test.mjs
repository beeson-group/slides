// regression tests of R14.5 on both platforms: a typed Width or Height of a turned group reads
// back as typed, and the same value typed again leaves the file as it is. the readout of a corner
// resize of a turned figure with a caption gives the size that the fields give after the release

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const DECK = 'index.html';
// the index of the figures slide in index.html
const FIGURES = 4;
const IMG = 'section.present figure img.for-light';
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
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const mouse = (page, type, x, y, extra = {}) => page.send('Input.dispatchMouseEvent', { type, x, y, ...extra });

const PANEL = '#beeson-edit-panel-format';
async function fieldValue(page, id) {
  await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].find((b) => b.textContent === 'Arrange')?.click()`);
  await frames(page);
  return Number(await page.evaluate(`document.querySelector('#beeson-edit-num-${id}')?.value`));
}
async function typeField(page, id, value) {
  await fieldValue(page, id);
  await page.evaluate(`(() => { const i = document.querySelector('#beeson-edit-num-${id}'); i.focus(); i.select(); })()`);
  await type(page, String(value));
  await press(page, 'Enter');
  await frames(page);
}
const sizeFields = async (page) => ({ w: await fieldValue(page, 'width'), h: await fieldValue(page, 'height') });

async function load(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&theme=light&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${FIGURES})`);
  await frames(page);
  return page;
}

// an undo gives the text before and a redo the edited text byte for byte, and the saved text is
// opened again without problems
async function checkEdit(page, name, before) {
  const edited = await render(page);
  assert.notEqual(edited, before);
  await undo(page);
  assert.equal(await render(page), before);
  await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, name);
  assert.equal(text, edited);
}

// the paragraph and the figure of the figures slide made one group with the key of Group
async function groupOnFigures(page, platform) {
  await click(page, IMG);
  const p = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(':scope > p').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
  await click(page, p, { modifiers: 'Shift' });
  await press(page, platform === 'mac' ? 'Alt+Mod+G' : 'Mod+G');
  await frames(page);
}

for (const platform of PLATFORMS) {
  for (const [field, value] of [['width', 1400], ['height', 700]]) {
    test(`a typed ${field} of a turned group reads back as typed, and the same value again leaves the file (${platform})`, async (t) => {
      const page = await load(t, platform);
      await groupOnFigures(page, platform);
      await typeField(page, 'angle', 30);
      const turned = await render(page);
      await typeField(page, field, value);
      const read = await sizeFields(page);
      assert.ok(Math.abs(read[field[0]] - value) <= 1, `a typed ${field} of ${value} reads ${js(read)}`);
      const typed = await render(page);
      await typeField(page, field, value);
      assert.equal(await render(page), typed, `a second ${field} of ${value} changes the file`);
      assert.deepEqual(await sizeFields(page), read);
      await checkEdit(page, `r14-5-group-${field}-${platform}.html`, turned);
      assert.deepEqual(errors(page), []);
    });
  }

  test(`the readout of a corner resize of a turned figure with a caption gives the size of the fields (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, IMG);
    await typeField(page, 'angle', 30);
    const turned = await render(page);
    const at = await page.evaluate(`(() => { const g = [...document.querySelectorAll('.beeson-grip[data-handle="se"]')].find((g) => g.getClientRects().length && !g.hidden); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await mouse(page, 'mouseMoved', at.x, at.y);
    await mouse(page, 'mousePressed', at.x, at.y, { button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 12; i++) await mouse(page, 'mouseMoved', at.x + 5 * i, at.y + 5 * i, { button: 'left', buttons: 1 });
    await frames(page);
    const readout = await page.evaluate(`(() => { const o = document.querySelector('.beeson-offset'); return o && !o.hidden ? o.textContent : ''; })()`);
    await mouse(page, 'mouseReleased', at.x + 60, at.y + 60, { button: 'left', buttons: 0, clickCount: 1 });
    await frames(page);
    const read = await sizeFields(page);
    const m = /w:\s*(\d+)\s*px\s*h:\s*(\d+)\s*px/.exec(readout);
    assert.ok(m, `the readout is ${js(readout)}`);
    assert.ok(Math.abs(Number(m[1]) - read.w) <= 1 && Math.abs(Number(m[2]) - read.h) <= 1, `the readout ${js(readout)} against the fields ${js(read)}`);
    await checkEdit(page, `r14-5-turned-resize-${platform}.html`, turned);
    assert.deepEqual(errors(page), []);
  });
}

for (const platform of PLATFORMS) {
  // D17 of round 6: a typed Height of 975 read back as 974, with the picture written 716 px wide
  test(`a typed Height of a figure with a caption reads back as typed (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, IMG);
    let last = page.source;
    for (const h of [975, 700, 775, 950]) {
      last = await render(page);
      await typeField(page, 'height', h);
      assert.equal(await fieldValue(page, 'height'), h, `a typed Height of ${h}`);
    }
    await checkEdit(page, `r14-5-height-${platform}.html`, last);
    assert.deepEqual(errors(page), []);
  });
  // the width 1 px either side of the written one is tried for the typed height, and not under 1 px
  test(`a typed Height of 1 of a figure with a caption does not write a width of 0 (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, IMG);
    await typeField(page, 'height', 1);
    const widths = await page.evaluate(`[...document.querySelector(${JSON.stringify(IMG)}).closest('figure').querySelectorAll('img')].map((i) => i.style.width)`);
    assert.ok(widths.length > 0 && widths.every((w) => parseFloat(w) >= 1), `the pictures are written ${JSON.stringify(widths)} wide`);
    assert.deepEqual(errors(page), []);
  });
}
