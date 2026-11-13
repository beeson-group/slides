// regression tests of R36.1 on both platforms. a duplicate of a block in the flow of a slide, and a
// paste of such a block on the slide of its source, is drawn 20 px down and to the right of its
// source, and moved on in steps of 20 px past the source and every older copy at this place now, as
// a copy of a shape is. the copy stays after its source in the file, and every other element of the
// slide is drawn where it was. each duplicate and each paste is one entry of the history, and an
// undo, a redo, and a save are byte for byte

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const MOD = { mac: 4, other: 2 };
const INDEX = 'test-deck.html';
// a paragraph and a QR code of 320 px in the flow of slide 1, a paragraph in the panel of slide 2, a
// closing slide, and a heading, a paragraph, a list, and a paragraph without offsets on slide 4
const FLOW = 'test/pages/editor-r36-1.html';

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
const sleep = (ms) => new Promise((d) => setTimeout(d, ms));
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undoLabel = (page) => page.evaluate('window.BeesonEditor.state("edit.undo").label');
const undo = async (page) => {
  await page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
  await frames(page);
};
const redo = async (page) => {
  await page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
  await frames(page);
};

async function load(t, platform, deck, slide) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(readFileSync(deck, 'utf8'))})`)).problems, []);
  await page.send('Page.bringToFront');
  await page.send('Browser.grantPermissions', { origin: server.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await page.evaluate(`Reveal.slide(${slide})`);
  await sleep(200);
  await frames(page);
  // copy and paste as trusted keys that carry the editing commands of the browser
  const key = async (k, code, kc, cmd) => {
    const e = { key: k, code, windowsVirtualKeyCode: kc, modifiers: MOD[platform] };
    await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...e, commands: [cmd] });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...e });
    await sleep(400);
    await frames(page);
  };
  // the drawn boxes [x, y, w, h] in slide px of the elements of selector on the current slide, in
  // the order of the file
  const boxes = (selector) =>
    page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'); const r = s.getBoundingClientRect(); const k = r.width / s.offsetWidth; return [...Reveal.getCurrentSlide().querySelectorAll(${js(selector)})].map((e) => { const b = e.getBoundingClientRect(); return [b.left - r.left, b.top - r.top, b.width, b.height].map((v) => Math.round(v / k)); }); })()`);
  return {
    page,
    boxes,
    // the first element of selector selected as an object: a click into its words and Esc for a
    // block of text, and a click for a figure, with Shift to add it to the selection
    select: async (selector, { text = true, add = false } = {}) => {
      const [[x, y, w, h]] = await boxes(selector);
      const at = await page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'); const r = s.getBoundingClientRect(); const k = r.width / s.offsetWidth; return { x: r.left + ${x + Math.min(20, w / 2)} * k, y: r.top + ${y + h / 2} * k }; })()`);
      await click(page, at, { modifiers: add ? 'Shift' : '' });
      await frames(page);
      if (text) {
        await press(page, 'Escape');
        await frames(page);
      }
    },
    selection: () => page.evaluate('window.BeesonEditor.selection().map((e) => e.localName + (e.classList.contains("qr") ? ".qr" : ""))'),
    duplicate: async () => {
      await press(page, 'Mod+D');
      await sleep(300);
      await frames(page);
    },
    copy: () => key('c', 'KeyC', 67, 'copy'),
    paste: () => key('v', 'KeyV', 86, 'paste'),
    cut: () => key('x', 'KeyX', 88, 'cut'),
  };
}

// the box b moved by d px down and to the right
const off = ([x, y, w, h], d) => [x + d, y + d, w, h];

// asserts that the boxes p are the boxes q within a slide px
function near(p, q, what) {
  assert.equal(p.length, q.length, `${what}: ${js(p)} in place of ${js(q)}`);
  p.forEach((b, i) => b.forEach((v, j) => assert.ok(Math.abs(v - q[i][j]) <= 1, `${what}: ${js(p)} in place of ${js(q)}`)));
}

// asserts that the last action, labeled label, is one entry of the history from the text before,
// that an undo and a redo and a save and a reopen are byte for byte, and that the page logged no error
async function entry(page, before, label) {
  const done = await render(page);
  assert.equal(await undoLabel(page), `Undo ${label}`);
  await undo(page);
  assert.equal(await render(page), before, `one undo does not give the file back before the ${label}`);
  await redo(page);
  assert.equal(await render(page), done);
  const { text } = await saveAndReopen(page);
  assert.equal(text, done, 'the save differs from the text');
  assert.deepEqual(errors(page), []);
}

const P = ':scope > p';
const QR = ':scope > .qr';
const UL = ':scope > ul';

for (const platform of PLATFORMS) {
  // item 1, the probe of the finding: the paragraph of slide 5 of index.html duplicated twice. the
  // copies are drawn 20 and 40 px off the paragraph rather than a whole height under it, over the
  // list, which is drawn where it was
  test(`1: a paragraph in the flow duplicated twice is put 20 px and 40 px off its source (${platform})`, async (t) => {
    const { page, boxes, select, selection, duplicate } = await load(t, platform, INDEX, 4);
    const [p] = await boxes(P);
    const list = await boxes(UL);
    await select(P);
    assert.deepEqual(await selection(), ['p']);
    await duplicate();
    near(await boxes(P), [p, off(p, 20)], 'the duplicate of the paragraph is not 20 px off it');
    near(await boxes(UL), list, 'the list is not drawn where it was');
    const before = await render(page);
    await duplicate();
    near(await boxes(P), [p, off(p, 20), off(p, 40)], 'the second duplicate is not 20 px past the first');
    near(await boxes(UL), list, 'the list is not drawn where it was');
    await entry(page, before, 'Duplicate');
  });

  // item 1: the QR code of 320 px of the finding duplicated twice stays inside the slide
  test(`1: a QR code in the flow duplicated twice is put 20 px and 40 px off its source inside the slide (${platform})`, async (t) => {
    const { page, boxes, select, selection, duplicate } = await load(t, platform, FLOW, 0);
    const [q] = await boxes(QR);
    assert.equal(q[2], 320);
    await select(QR, { text: false });
    assert.deepEqual(await selection(), ['div.qr']);
    await duplicate();
    near(await boxes(QR), [q, off(q, 20)], 'the duplicate of the QR code is not 20 px off it');
    const before = await render(page);
    await duplicate();
    const p = await boxes(QR);
    near(p, [q, off(q, 20), off(q, 40)], 'the second duplicate of the QR code is not 20 px past the first');
    assert.ok(p.every(([, y, , h]) => y + h <= 1080), `a duplicate of the QR code is below the slide: ${js(p)}`);
    await entry(page, before, 'Duplicate');
  });

  // item 1: a paragraph in the panel of a split slide, i.e. the container of its text column
  test(`1: a paragraph in the panel of a split slide duplicated is put 20 px off its source (${platform})`, async (t) => {
    const { page, boxes, select, selection, duplicate } = await load(t, platform, FLOW, 1);
    const PANEL = ':scope > .panel > p';
    const [p] = await boxes(PANEL);
    await select(PANEL);
    assert.deepEqual(await selection(), ['p']);
    const before = await render(page);
    await duplicate();
    near(await boxes(PANEL), [p, off(p, 20)], 'the duplicate of the paragraph in the panel is not 20 px off it');
    await entry(page, before, 'Duplicate');
  });

  // item 1: the heading of the title slide of index.html, in a block anchored at its bottom, which
  // the copy makes taller. the copy is put 20 px off the heading, and the words of the block are
  // drawn where they were
  test(`1: a heading in the block of a title slide duplicated is put 20 px off its source (${platform})`, async (t) => {
    const { page, boxes, select, selection, duplicate } = await load(t, platform, INDEX, 0);
    const H1 = ':scope > .block > h1';
    const [h] = await boxes(H1);
    const rest = await boxes(':scope > .block > :not(h1)');
    await select(H1);
    assert.deepEqual(await selection(), ['h1']);
    const before = await render(page);
    await duplicate();
    near(await boxes(H1), [h, off(h, 20)], 'the duplicate of the heading is not 20 px off it');
    near(await boxes(':scope > .block > :not(h1)'), rest, 'the words of the block are not drawn where they were');
    await entry(page, before, 'Duplicate');
  });

  // item 1: the same on the closing slide of the deck, whose block has no offsets
  test(`1: a heading in the block of a closing slide without offsets duplicated is put 20 px off its source (${platform})`, async (t) => {
    const { page, boxes, select, selection, duplicate } = await load(t, platform, FLOW, 2);
    const H1 = ':scope > .block > h1';
    const [h] = await boxes(H1);
    const rest = await boxes(':scope > .block > :not(h1)');
    await select(H1);
    assert.deepEqual(await selection(), ['h1']);
    const before = await render(page);
    await duplicate();
    near(await boxes(H1), [h, off(h, 20)], 'the duplicate of the heading is not 20 px off it');
    near(await boxes(':scope > .block > :not(h1)'), rest, 'the words of the block are not drawn where they were');
    await entry(page, before, 'Duplicate');
  });

  // item 3: with the paragraph and the QR code selected, each copy is put 20 px off its own source
  test(`3: a paragraph and a QR code duplicated together are each put 20 px off their own source (${platform})`, async (t) => {
    const { page, boxes, select, selection, duplicate } = await load(t, platform, FLOW, 0);
    const [p] = await boxes(P);
    const [q] = await boxes(QR);
    await select(P);
    await select(QR, { text: false, add: true });
    assert.deepEqual((await selection()).sort(), ['div.qr', 'p']);
    const before = await render(page);
    await duplicate();
    near(await boxes(P), [p, off(p, 20)], 'the duplicate of the paragraph is not 20 px off it');
    near(await boxes(QR), [q, off(q, 20)], 'the duplicate of the QR code is not 20 px off it');
    await entry(page, before, 'Duplicate');
  });

  // item 2: the paragraph of slide 5 of index.html copied and pasted twice on its slide
  test(`2: a paragraph in the flow pasted twice on its slide is put 20 px and 40 px off its source (${platform})`, async (t) => {
    const { page, boxes, select, copy, paste } = await load(t, platform, INDEX, 4);
    const [p] = await boxes(P);
    const list = await boxes(UL);
    await select(P);
    await copy();
    await paste();
    near(await boxes(P), [p, off(p, 20)], 'the paste of the paragraph is not 20 px off it');
    near(await boxes(UL), list, 'the list is not drawn where it was');
    const before = await render(page);
    await paste();
    near(await boxes(P), [p, off(p, 20), off(p, 40)], 'the second paste is not 20 px past the first');
    near(await boxes(UL), list, 'the list is not drawn where it was');
    await entry(page, before, 'Paste');
  });

  // items 2 and 4: a paste of the QR code after an undone paste takes the place that it freed
  test(`4: a QR code in the flow pasted after an undone paste takes the place that it freed (${platform})`, async (t) => {
    const { page, boxes, select, copy, paste } = await load(t, platform, FLOW, 0);
    const [q] = await boxes(QR);
    await select(QR, { text: false });
    await copy();
    await paste();
    await paste();
    near(await boxes(QR), [q, off(q, 20), off(q, 40)], 'two pastes of the QR code are not 20 px and 40 px off it');
    await undo(page);
    const before = await render(page);
    await paste();
    near(await boxes(QR), [q, off(q, 20), off(q, 40)], 'a paste after an undone paste is not at the place that it freed');
    await entry(page, before, 'Paste');
  });

  // item 4: a duplicate of the paragraph in the panel after a deleted duplicate takes the place
  // that it freed
  test(`4: a paragraph in the flow duplicated after a deleted duplicate takes the place that it freed (${platform})`, async (t) => {
    const { page, boxes, select, duplicate } = await load(t, platform, FLOW, 1);
    const PANEL = ':scope > .panel > p';
    const [p] = await boxes(PANEL);
    await select(PANEL);
    await duplicate();
    await press(page, 'Delete');
    await frames(page);
    near(await boxes(PANEL), [p], 'the duplicate is not deleted');
    await select(PANEL);
    const before = await render(page);
    await duplicate();
    near(await boxes(PANEL), [p, off(p, 20)], 'a duplicate after a deleted duplicate is not 20 px off the paragraph');
    await entry(page, before, 'Duplicate');
  });

  // repair of item 4: a Delete or a Cut of a duplicate on a slide whose blocks have no offsets gives
  // the slide back, with the list and the last paragraph drawn where they were and without offsets
  for (const how of ['Delete', 'Cut']) {
    test(`4: a duplicate of a paragraph in the flow taken off by ${how} gives the slide back (${platform})`, async (t) => {
      const { page, boxes, select, duplicate, cut } = await load(t, platform, FLOW, 3);
      const ALL = ':scope > :is(h2, p, ul)';
      const start = await boxes(ALL);
      const text = await render(page);
      await select(P);
      await duplicate();
      const p = start[1];
      near(await boxes(P), [p, off(p, 20), start[3]], 'the duplicate of the paragraph is not 20 px off it');
      const before = await render(page);
      if (how === 'Cut') await cut();
      else await press(page, 'Backspace');
      await sleep(300);
      await frames(page);
      near(await boxes(ALL), start, `the slide is not drawn as before the duplicate after the ${how}`);
      assert.equal(await render(page), text, `the file is not given back by the ${how} of the duplicate`);
      assert.equal(await undoLabel(page), `Undo ${how}`);
      await undo(page);
      assert.equal(await render(page), before, `one undo does not give the duplicate back after the ${how}`);
      assert.deepEqual(errors(page), []);
    });
  }

  // repair of item 4: a Cut of a paste of the paragraph of slide 5 of index.html gives the list its
  // offset back
  test(`4: a paste of a paragraph in the flow taken off by Cut gives the slide back (${platform})`, async (t) => {
    const { page, boxes, select, copy, paste, cut } = await load(t, platform, INDEX, 4);
    const ALL = ':scope > :is(h2, p, ul)';
    const start = await boxes(ALL);
    const text = await render(page);
    await select(P);
    await copy();
    await paste();
    near(await boxes(P), [start[1], off(start[1], 20)], 'the paste of the paragraph is not 20 px off it');
    await cut();
    near(await boxes(ALL), start, 'the slide is not drawn as before the paste after the Cut');
    assert.equal(await render(page), text, 'the file is not given back by the Cut of the paste');
    assert.deepEqual(errors(page), []);
  });
}
