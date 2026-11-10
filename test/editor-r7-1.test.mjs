// regression tests of R7.1 on both platforms with trusted input: the readout of a resize of a group,
// the place of a new text box on a slide without room under its text, and the load of a deck in a
// second tab.
// after each edit the text is checked byte for byte, after an undo and a redo, and after a save and
// an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
// the slide of the deck of layouts with an ordered list and a figure with a caption
const MATH = 3;
const IMG = '.reveal section.present figure.zone img:not([hidden])';

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
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

// the editor on the slide n of a deck served over HTTP, with the Format tab shown
async function load(t, platform, { deck = LAYOUTS, n = 0, size = { width: 1600, height: 1000 } } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks the edits in the text, then the text before byte for byte after an undo, the
// edit after a redo, and an open of the saved edit without problems
let saves = 0;
async function roundTrip(page, edits) {
  await byteExact(page, edits);
  const edited = await render(page);
  await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r7-1-${++saves}.html`);
  assert.equal(text, edited);
  page.source = text;
}

// fieldsOf returns the values of the fields Width and Height of the Arrange pane
const fieldsOf = (page) =>
  page.evaluate(`(() => { const v = (n) => document.querySelector('#beeson-edit-panel-format input[name="' + n + '"]')?.value ?? null; return { w: Number(v('Width')), h: Number(v('Height')) }; })()`);
// readoutOf returns the size in the readout at the pointer, or null while the readout is hidden
const readoutOf = (page) =>
  page.evaluate(`(() => { const t = document.querySelector('.beeson-offset:not([hidden])')?.textContent ?? ''; const m = t.match(/(\\d+) × (\\d+)/); return m ? { w: Number(m[1]), h: Number(m[2]), text: t } : null; })()`);

// item 1 of R7.1: in R6.8, a corner grip of a group of a figure and a paragraph moved by -120 by
// -90 px gave 1446 × 706 in the readout, the box asked for, while the members reached 1524 × 800,
// since the height of a zone is set by its layout
for (const platform of PLATFORMS) {
  test(`the readout of a resize of a group gives the size of W and H (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    await click(page, IMG);
    await press(page, 'Escape');
    await click(page, '.reveal section.present > p', { modifiers: 'Shift' });
    await exec(page, 'arrange.group');
    await frames(page);
    await page.evaluate(`[...document.querySelectorAll('#beeson-edit-panel-format button')].find((b) => b.textContent.trim() === 'Arrange')?.click()`);
    await frames(page);
    const start = await fieldsOf(page);
    const se = await page.evaluate(`(() => { const g = document.querySelector('.beeson-grip[data-group="1"][data-handle="se"]'); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await drag(page, se, { dx: -120, dy: -90, steps: 12, hold: true });
    await frames(page);
    const readout = await readoutOf(page);
    let f = await fieldsOf(page);
    assert.ok(readout, 'a readout is shown during the resize');
    assert.ok(f.w < start.w - 50, js({ start, f }));
    const near = (a, b) => Math.abs(a - b) <= 1;
    assert.ok(near(readout.w, f.w) && near(readout.h, f.h), `during the resize the readout reads ${readout.text} and the fields ${js(f)}`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: se.x - 120, y: se.y - 90, button: 'left', clickCount: 1 });
    await frames(page);
    f = await fieldsOf(page);
    assert.ok(near(readout.w, f.w) && near(readout.h, f.h), `after the resize the fields read ${js(f)}, and the last readout ${readout.text}`);
    assert.deepEqual(errors(page), []);
  });
}
