// the fixes of a backdrop as an element of the editor, on both platforms: the turns, the flips,
// Align, Distribute, and the fields Position and Rotation leave a backdrop as it is, the row
// Backdrop of the object list and a click with Shift or the command modifier do not add a backdrop
// to other elements, Reset Slide and its undo draw a resized backdrop again at the size of its box,
// and Preview of a looping backdrop ends when the selection is left

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press } from './helpers/editor.mjs';

const DECK = 'test/pages/editor-r21-2.html';
const PLATFORMS = ['mac', 'other'];
const BACK = 'section.present .backdrop';
const NEST = '<div class="backdrop" data-scene="nest" data-cx="0.97" data-cy="0" data-half="0.5">';

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

let last = null;

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const wait = (page, ms) => page.evaluate(`new Promise((d) => setTimeout(() => d(true), ${ms}))`);
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => el.matches('.backdrop') ? 'backdrop' : el.localName)`);
const at = (page, u, v) => page.evaluate(`(() => { const r = document.querySelector('${BACK}').getBoundingClientRect(); return { x: r.left + r.width * ${u}, y: r.top + r.height * ${v} }; })()`);
const scale = (page) => page.evaluate(`document.querySelector('section.present').getBoundingClientRect().width / 1920`);
// the start tag of the backdrop of the first slide in a rendered text
const backTag = (text) => text.match(/<div class="backdrop" data-scene="nest"[^>]*>/)[0];

// the editor on the deck at slide n. with motion, the page does not ask for reduced motion and the
// URL is without still, so that a backdrop can be traced
async function backdropPage(platform, n, motion = false) {
  await last?.close().catch(() => {});
  const page = await browser.newPage(motion ? { motion: true } : undefined);
  last = page;
  await page.goto(`${server.origin}/${DECK}?edit${motion ? '' : '&still'}&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the selection left with a click into the heading of the slide and Escape twice
async function leave(page) {
  await click(page, 'section.present h2');
  await press(page, 'Escape');
  await press(page, 'Escape');
}

const ARRANGE = [
  'arrange.rotateLeft', 'arrange.rotateRight', 'arrange.setRotation', 'arrange.flipHorizontal', 'arrange.flipVertical',
  'arrange.align.left', 'arrange.align.center', 'arrange.align.right', 'arrange.align.top', 'arrange.align.middle', 'arrange.align.bottom',
  'arrange.distribute.horizontal', 'arrange.distribute.vertical', 'arrange.distribute.evenly',
  'arrange.setPosition', 'arrange.setSize', 'arrange.sizeAndPosition', 'arrange.resetPosition', 'arrange.resetSize',
];
const ARGS = { 'arrange.setRotation': { deg: 90 }, 'arrange.setPosition': { x: 100, y: 40 }, 'arrange.setSize': { w: 500 } };

for (const platform of PLATFORMS) {
  test(`the turns, the flips, Align, Distribute, and the fields of a position are disabled on a backdrop and leave it as it is (${platform})`, async () => {
    const page = await backdropPage(platform, 0);
    await click(page, await at(page, 0.7, 0.6));
    assert.deepEqual(await selected(page), ['backdrop']);
    for (const id of ARRANGE) assert.equal((await state(page, id)).enabled, false, `${id} is enabled on a backdrop`);
    for (const id of ARRANGE) {
      if (id === 'arrange.sizeAndPosition') continue;
      await exec(page, id, ARGS[id]);
      assert.equal(await render(page), page.source, `${id} changed the file`);
    }
    await click(page, await at(page, 0.7, 0.6), { button: 'right' });
    const items = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => [i.textContent.trim(), i.getAttribute('aria-disabled') === 'true'])`);
    for (const label of ['Rotate Left 90°', 'Rotate Right 90°', 'Align', 'Distribute', 'Size and Position…', 'Flip Horizontal', 'Flip Vertical']) {
      const item = items.find(([text]) => text.startsWith(label));
      assert.ok(!item || item[1], `the element menu offers ${label}`);
    }
    await press(page, 'Escape');
    // given a paragraph and a backdrop, the fields write the paragraph alone
    await click(page, 'section.present p');
    await press(page, 'Escape');
    assert.deepEqual(await selected(page), ['p']);
    for (const [id, arg] of [['arrange.setPosition', '{ x: 300, y: 600 }'], ['arrange.setRotation', '{ deg: 90 }']]) {
      await page.evaluate(`window.BeesonEditor.exec('${id}', { ...${arg}, els: [document.querySelector('section.present p'), document.querySelector('${BACK}')] })`);
      const text = await render(page);
      assert.notEqual(text, page.source, `${id} did not write the paragraph`);
      assert.equal(backTag(text), NEST, `${id} wrote the backdrop`);
      await undo(page);
      assert.equal(await render(page), page.source);
    }
  });

  test(`a backdrop does not join other elements in a selection, from the object list or the canvas (${platform})`, async () => {
    const page = await backdropPage(platform, 0);
    if (!(await state(page, 'view.objects')).checked) await exec(page, 'view.objects');
    await frames(page);
    const ROWS = '.beeson-edit-objects .row';
    const rowAt = (name) => page.evaluate(`(() => { const r = [...document.querySelectorAll('${ROWS}')].find((r) => r.querySelector('.name').textContent.startsWith(${JSON.stringify(name)})).getBoundingClientRect(); return { x: r.left + r.width / 3, y: r.top + r.height / 2 }; })()`);
    const P = 'Text: A paragraph';
    const B = 'Backdrop: Lyapunov Families';
    for (const modifiers of ['Mod', 'Shift']) {
      await click(page, await rowAt(P));
      assert.deepEqual(await selected(page), ['p']);
      await click(page, await rowAt(B), { modifiers });
      assert.deepEqual(await selected(page), ['backdrop'], `a ${modifiers}-click on the backdrop row`);
      assert.equal((await state(page, 'arrange.group')).enabled, false);
      await click(page, await rowAt(P), { modifiers });
      assert.deepEqual(await selected(page), ['p'], `a ${modifiers}-click on a row with the backdrop selected`);
    }
    // a range of rows by the keys that ends at the backdrop row selects the backdrop alone
    await click(page, await rowAt(P));
    await press(page, 'Shift+End');
    assert.deepEqual(await selected(page), ['backdrop']);
    // with the backdrop selected, a Shift-click on the canvas selects the paragraph alone
    await click(page, await at(page, 0.7, 0.6));
    assert.deepEqual(await selected(page), ['backdrop']);
    await click(page, 'section.present p', { modifiers: 'Shift' });
    assert.deepEqual(await selected(page), ['p']);
    await click(page, 'section.present h2', { modifiers: 'Shift' });
    assert.deepEqual(await selected(page), ['h2', 'p']);
    await drag(page, 'section.present p', { dx: 40 * (await scale(page)), dy: 0 });
    await frames(page);
    assert.equal(backTag(await render(page)), NEST);
  });

  test(`Reset Slide draws a resized backdrop again at the size of its box, and so do its undo and redo (${platform})`, async () => {
    const page = await backdropPage(platform, 0);
    await click(page, await at(page, 0.7, 0.6));
    // the width of the box of the backdrop and of its canvas, in device px
    const fit = () => page.evaluate(`(() => { const el = document.querySelector('${BACK}'); return { box: Math.round(el.getBoundingClientRect().width * devicePixelRatio), canvas: el.querySelector(':scope > canvas').width }; })()`);
    const grip = await page.evaluate(`(() => { const g = [...document.querySelectorAll('.beeson-grip[data-handle="w"]')].find((g) => !g.hidden); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const first = await fit();
    await drag(page, grip, { dx: -400 * (await scale(page)), dy: 0 });
    await frames(page);
    const wide = await fit();
    assert.ok(wide.box > first.box + 100, `the box was not resized: ${JSON.stringify([first, wide])}`);
    assert.equal(wide.canvas, wide.box);
    await leave(page);
    await exec(page, 'slide.reset');
    await frames(page);
    assert.doesNotMatch(backTag(await render(page)), /style=/);
    let now = await fit();
    assert.equal(now.box, first.box);
    assert.equal(now.canvas, now.box, 'the drawing is not fitted to the box put back by Reset Slide');
    await undo(page);
    await frames(page);
    now = await fit();
    assert.equal(now.box, wide.box);
    assert.equal(now.canvas, now.box, 'the drawing is not fitted to the box given back by the undo');
    await redo(page);
    await frames(page);
    now = await fit();
    assert.equal(now.canvas, first.box);
  });

  test(`Preview of a looping backdrop ends when the selection is left or the slide is changed (${platform})`, async () => {
    const page = await backdropPage(platform, 1, true);
    const rafs = () => page.evaluate('Beeson.backdrops.filter((b) => b.raf).length');
    await click(page, await at(page, 0.7, 0.6));
    assert.deepEqual(await selected(page), ['backdrop']);
    await exec(page, 'backdrop.preview');
    await frames(page);
    assert.ok((await rafs()) > 0, 'the backdrop is not traced');
    await leave(page);
    await wait(page, 300);
    assert.equal(await rafs(), 0, 'the loop is drawn after the selection is left');
    await click(page, await at(page, 0.7, 0.6));
    await exec(page, 'backdrop.preview');
    await frames(page);
    assert.ok((await rafs()) > 0);
    await page.evaluate('Reveal.slide(2)');
    await wait(page, 300);
    assert.equal(await rafs(), 0, 'the loop is drawn after the slide is changed');
    assert.equal(await render(page), page.source);
  });
}
