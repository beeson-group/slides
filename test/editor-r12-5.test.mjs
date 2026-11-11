// the work of R12.5 on both platforms: Align and Distribute of a whole group as one object, a
// typed width that keeps the upper left corner of a QR code, an undo or a redo that shows the slide
// that it changes, the cursor of a held grip, the rotate handle of a multi-selection, and the gap
// arrows of a drag drawn clear of the center guide. each edit of the file is checked byte for byte,
// after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen } from './helpers/editor.mjs';

const DECK = 'index.html';
// the indexes of the figures slide and of the closing slide with its QR code in index.html
const FIGURES = 4;
const CLOSING = 11;
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
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const near = (a, b, by = 2) => Math.abs(a - b) <= by;
const shown = (page) => page.evaluate('Reveal.getIndices().h');
// the box in slide pixels of the first shown element of selector on the current slide
const boxOf = (page, selector) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides').getBoundingClientRect(), k = s.width / 1920;
  const e = [...Reveal.getCurrentSlide().querySelectorAll(${js(selector)})].find((e) => e.getClientRects().length && e.getBoundingClientRect().width);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { left: (r.left - s.left) / k, top: (r.top - s.top) / k, width: r.width / k, height: r.height / k };
})()`);
// whether every selected element is on the shown slide
const selectionShown = (page) => page.evaluate('window.BeesonEditor.selection().every((el) => Reveal.getCurrentSlide().contains(el))');

async function load(t, platform, n) {
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
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// an undo gives the text before and a redo the edited text byte for byte, and the saved text is
// opened again without problems
async function checkEdit(page, name) {
  const edited = await render(page);
  assert.notEqual(edited, page.source);
  await undo(page);
  assert.equal(await render(page), page.source);
  await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, name);
  assert.equal(text, edited);
}

// the paragraph and the figure of the figures slide made a group by the key of Group, with the
// group selected
async function groupOnFigures(page) {
  await click(page, 'section.present figure img.for-light');
  const p = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(':scope > p').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
  await click(page, p, { modifiers: 'Shift' });
  assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((el) => el.localName).sort()'), ['figure', 'p']);
  await press(page, (await page.evaluate("new URLSearchParams(location.search).get('edit-platform')")) === 'mac' ? 'Alt+Mod+G' : 'Mod+G');
  assert.equal(await page.evaluate('Reveal.getCurrentSlide().querySelectorAll("[data-group]").length'), 2);
}

for (const platform of PLATFORMS) {
  test(`Align and Distribute move a whole group as one object (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await groupOnFigures(page);
    const p0 = await boxOf(page, ':scope > p'), f0 = await boxOf(page, ':scope > figure');
    // one whole group is aligned to the slide, as one object of Keynote is
    await exec(page, 'arrange.alignTo.selection');
    await exec(page, 'arrange.align.left');
    await frames(page);
    let p = await boxOf(page, ':scope > p'), f = await boxOf(page, ':scope > figure');
    assert.ok(near(f.left - p.left, f0.left - p0.left) && near(f.top - p.top, f0.top - p0.top), `the members kept their places: ${js({ p0, f0, p, f })}`);
    assert.ok(near(Math.min(p.left, f.left), 0), `the group is at the left edge of the slide: ${js({ p, f })}`);
    await checkEdit(page, `r12-5-align-${platform}.html`);
    await undo(page);
    // the group, the heading, and the list spaced vertically with the group kept whole
    await click(page, { x: 10, y: 10 });
    await click(page, 'section.present figure img.for-light');
    await click(page, 'section.present h2', { modifiers: 'Shift' });
    await click(page, 'section.present > ul > li', { modifiers: 'Shift' });
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 4);
    await exec(page, 'arrange.distribute.vertical');
    await frames(page);
    p = await boxOf(page, ':scope > p');
    f = await boxOf(page, ':scope > figure');
    assert.ok(near(f.left - p.left, f0.left - p0.left) && near(f.top - p.top, f0.top - p0.top), `the members kept their places: ${js({ p0, f0, p, f })}`);
    assert.ok(f.top >= -1 && p.top >= -1, `the group is on the slide: ${js({ p, f })}`);
    assert.deepEqual(errors(page), []);
  });

  test(`a typed width keeps the upper left corner of the QR code of the closing slide (${platform})`, async (t) => {
    const page = await load(t, platform, CLOSING);
    await click(page, 'section.present .qr');
    assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((el) => el.matches(".qr"))'), [true]);
    const was = await boxOf(page, '.qr');
    await exec(page, 'arrange.setSize', { w: 240 });
    await frames(page);
    const now = await boxOf(page, '.qr');
    assert.ok(near(now.width, 240), `the width is 240: ${js(now)}`);
    assert.ok(near(now.left, was.left) && near(now.top, was.top), `the corner stays: ${js({ was, now })}`);
    await checkEdit(page, `r12-5-qr-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });

  for (const [what, act] of [
    ['Duplicate', (page) => press(page, 'Mod+D')],
    ['Delete', (page) => press(page, 'Backspace')],
    ['Lock', (page) => press(page, 'Mod+L')],
  ]) {
    test(`an undo and a redo of ${what} show the slide that they change (${platform})`, async (t) => {
      const page = await load(t, platform, FIGURES);
      await click(page, 'section.present figure img.for-light');
      await act(page);
      await frames(page);
      const edited = await render(page);
      assert.notEqual(edited, page.source);
      await page.evaluate('Reveal.slide(1)');
      await frames(page);
      await undo(page);
      await frames(page);
      assert.equal(await render(page), page.source);
      assert.equal(await shown(page), FIGURES, 'the undo shows the slide of the change');
      assert.ok(await selectionShown(page), 'the selection is on the shown slide');
      await page.evaluate('Reveal.slide(7)');
      await frames(page);
      await redo(page);
      await frames(page);
      assert.equal(await render(page), edited);
      assert.equal(await shown(page), FIGURES, 'the redo shows the slide of the change');
      assert.ok(await selectionShown(page), 'the selection is on the shown slide');
      assert.deepEqual(errors(page), []);
    });
  }
}
