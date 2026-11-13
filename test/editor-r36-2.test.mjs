// regression tests of R36.2 on both platforms with trusted input. finding 67 of the judge glm and
// finding 3 of the judge opus in round 10: a Width or Height typed into the Arrange pane and then
// typed back gives the figure back, in its fields, its boxes, its place, and the file. a typed
// value with the ratio kept scales the box of the figure as it is drawn, hence the letterboxed
// picture of slide 5 keeps its letterbox

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, saveAndReopen, press, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
// the index of the figures slide in index.html, i.e. slide 5
const FIGURES = 4;
const IMG = 'section.present figure img.for-light';
const DECK = 'test/pages/editor-r36-2.html';
const PANEL = '#beeson-edit-panel-format';

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
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

async function load(t, platform, { deck = 'test-deck.html', slide = FIGURES } = {}) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${deck}?edit&still&theme=light&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${slide})`);
  await frames(page);
  await page.waitFor(`[...document.querySelectorAll('.reveal section.present img')].every((i) => i.complete && i.naturalWidth)`);
  return page;
}

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
const fields = async (page) => ({ w: await fieldValue(page, 'width'), h: await fieldValue(page, 'height'), x: await fieldValue(page, 'x'), y: await fieldValue(page, 'y') });

// the boxes of the object at selector in slide px: its layout box, the box of its image, and the
// picture that object-fit contain draws in the image box. a box is given by its size before its
// turn and by its center on the slide, which a turn does not move
const boxes = (page, selector) => page.evaluate(`(() => {
  const el = document.querySelector(${js(`.reveal ${selector}`)});
  const s = document.querySelector('.reveal section.present').getBoundingClientRect();
  const k = Reveal.getScale();
  const place = (e) => {
    const r = e.getBoundingClientRect();
    return { cx: (r.left + r.width / 2 - s.left) / k, cy: (r.top + r.height / 2 - s.top) / k, w: e.offsetWidth, h: e.offsetHeight };
  };
  const img = el.matches('img') ? el : [...el.querySelectorAll('img')].find((i) => i.offsetWidth);
  const out = { box: place(el) };
  if (img) {
    out.img = place(img);
    const f = Math.min(img.offsetWidth / img.naturalWidth, img.offsetHeight / img.naturalHeight);
    out.picture = getComputedStyle(img).objectFit === 'contain' ? { w: img.naturalWidth * f, h: img.naturalHeight * f } : { w: img.offsetWidth, h: img.offsetHeight };
  }
  return out;
})()`);
function near(a, b, what) {
  for (const [part, box] of Object.entries(b)) {
    for (const [key, v] of Object.entries(box)) assert.ok(Math.abs(a[part][key] - v) <= 1, `${what}: ${part}.${key} is ${a[part][key]}, against ${v} before`);
  }
}

for (const platform of PLATFORMS) {
  // finding 67 of glm: a typed Width of 601 gave 601 by 836 with the picture at its own aspect, and
  // 600 then gave 600 by 835 with translate: 0px 40px written on the figure
  test(`a typed Width of 601 scales the box of the figure of slide 5 to 601 by 801, and 600 gives it back (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, `.reveal ${IMG}`);
    const start = await fields(page);
    assert.deepEqual(start, { w: 600, h: 875, x: 1200, y: 160 });
    const first = await boxes(page, 'section.present figure');
    assert.deepEqual([first.img.w, first.img.h], [600, 800]);
    await typeField(page, 'width', 601);
    const at601 = await boxes(page, 'section.present figure');
    assert.ok(Math.abs(at601.img.w - 601) <= 1 && Math.abs(at601.img.h - 801) <= 1, `a typed Width of 601 gives a box of ${at601.img.w} by ${at601.img.h}`);
    const read = await fields(page);
    assert.equal(read.w, 601);
    assert.ok(Math.abs(read.h - 876) <= 1, `a typed Width of 601 reads a Height of ${read.h}`);
    assert.deepEqual([read.x, read.y], [1200, 160], 'the typed Width moved the upper left corner of the figure');
    const edited = await render(page);
    assert.ok(!/<figure class="zone" style="[^"]*translate/.test(edited), 'a translate was written on the figure, whose corner did not move');
    await typeField(page, 'width', 600);
    assert.deepEqual(await fields(page), start);
    near(await boxes(page, 'section.present figure'), first, 'the Width typed back');
    await byteExact(page);
    await undo(page);
    assert.equal(await render(page), edited, 'the first undo did not take off the Width typed back');
    await undo(page);
    await byteExact(page);
    assert.equal((await state(page, 'edit.undo')).enabled, false, 'the values typed are more than two entries of the history');
    await redo(page);
    assert.equal(await render(page), edited);
    const { text } = await saveAndReopen(page, `r36-2-width-${platform}.html`);
    assert.equal(text, edited);
    assert.deepEqual(errors(page), []);
  });

  test(`a typed Height of the figure of slide 5 keeps its letterbox, and the old Height typed back gives the file back (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, `.reveal ${IMG}`);
    const start = await fields(page);
    const first = await boxes(page, 'section.present figure');
    await typeField(page, 'height', 951);
    assert.equal(await fieldValue(page, 'height'), 951);
    const at = await boxes(page, 'section.present figure');
    assert.ok(Math.abs(at.img.w / at.img.h - 0.75) < 0.005, `a typed Height gives a box of ${at.img.w} by ${at.img.h}`);
    const edited = await render(page);
    await typeField(page, 'height', 875);
    assert.deepEqual(await fields(page), start);
    near(await boxes(page, 'section.present figure'), first, 'the Height typed back');
    await byteExact(page);
    await undo(page);
    assert.equal(await render(page), edited);
    await undo(page);
    await byteExact(page);
    await redo(page);
    await redo(page);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  // the second residue of R27.2: a Height of 744 and back to 707 read 541 by 707, on slide 6 of
  // test/pages/editor-r8-5.html, whose images have a width of 500 px written
  test(`a figure of 500 by 707 typed to a Height of 744 and back to 707 reads 500 by 707 (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: 'test/pages/editor-r8-5.html', slide: 5 });
    await click(page, `.reveal ${IMG}`);
    const start = await fields(page);
    assert.deepEqual([start.w, start.h], [500, 707]);
    const first = await boxes(page, 'section.present figure');
    await typeField(page, 'height', 744);
    assert.equal(await fieldValue(page, 'height'), 744);
    const edited = await render(page);
    await typeField(page, 'height', 707);
    assert.deepEqual(await fields(page), start);
    near(await boxes(page, 'section.present figure'), first, 'the Height typed back');
    await byteExact(page);
    await undo(page);
    assert.equal(await render(page), edited);
    await undo(page);
    await byteExact(page);
    await redo(page);
    await redo(page);
    await byteExact(page);
    const { text } = await saveAndReopen(page, `r36-2-707-${platform}.html`);
    assert.equal(text, page.source);
    assert.deepEqual(errors(page), []);
  });

  // a Width and a Height, each typed and typed back, on each kind of object
  const KINDS = [
    ['a figure with a caption and a width written', 0, 'section.present figure'],
    ['a figure without a caption', 1, 'section.present figure'],
    ['a picture alone', 2, 'section.present > img'],
    ['a shape', 3, 'section.present .shape'],
    ['a turned figure with a caption', 4, 'section.present figure'],
  ];
  for (const [kind, slide, selector] of KINDS) {
    for (const [id, step] of [['width', 37], ['height', 41]]) {
      const key = id === 'width' ? 'w' : 'h';
      test(`a ${id === 'width' ? 'Width' : 'Height'} typed and typed back gives back ${kind} (${platform})`, async (t) => {
        const page = await load(t, platform, { deck: DECK, slide });
        await click(page, `.reveal ${selector}${selector.endsWith('figure') ? ' img' : ''}`);
        const start = await fields(page);
        const first = await boxes(page, selector);
        await typeField(page, id, start[key] + step);
        const typed = await fields(page);
        assert.equal(typed[key], start[key] + step, `the typed ${id} of ${kind} reads ${typed[key]}`);
        const edited = await render(page);
        assert.notEqual(edited, page.source);
        await typeField(page, id, start[key]);
        assert.deepEqual(await fields(page), start, `the ${id} typed back of ${kind}`);
        near(await boxes(page, selector), first, `the ${id} typed back of ${kind}`);
        await byteExact(page);
        await undo(page);
        assert.equal(await render(page), edited);
        await undo(page);
        await byteExact(page);
        assert.equal((await state(page, 'edit.undo')).enabled, false);
        await redo(page);
        assert.equal(await render(page), edited);
        const { text } = await saveAndReopen(page, `r36-2-${slide}-${id}-${platform}.html`);
        assert.equal(text, edited);
        assert.deepEqual(errors(page), []);
      });
    }
  }

  // the check of R36.2: on slide 6 of the deck, the picture is pillarboxed in its image box and the
  // caption spans this box, hence the field X reads the left edge of the caption. a typed Width of
  // 614 read X 890 with translate: 10px 0px written on the figure, and a Height of 933 read X 869
  for (const [id, value] of [['width', 614], ['height', 933]]) {
    test(`a typed ${id === 'width' ? 'Width' : 'Height'} of a pillarboxed figure with a caption keeps X and Y, and the old value gives it back (${platform})`, async (t) => {
      const page = await load(t, platform, { deck: DECK, slide: 5 });
      await click(page, `.reveal ${IMG}`);
      const start = await fields(page);
      assert.deepEqual(start, { w: 667, h: 866, x: 880, y: 120 });
      const first = await boxes(page, 'section.present figure');
      await typeField(page, id, value);
      const typed = await fields(page);
      assert.equal(typed[id === 'width' ? 'w' : 'h'], value);
      assert.deepEqual([typed.x, typed.y], [start.x, start.y], `a typed ${id} of ${value} reads X ${typed.x} and Y ${typed.y}`);
      const edited = await render(page);
      const tag = edited.match(/<figure class="zone"[^>]*>/g).at(-1);
      assert.ok(!/translate/.test(tag), `a translate was written on the figure, whose corner did not move: ${tag}`);
      await typeField(page, id, start[id === 'width' ? 'w' : 'h']);
      assert.deepEqual(await fields(page), start);
      near(await boxes(page, 'section.present figure'), first, `the ${id} typed back`);
      await byteExact(page);
      await undo(page);
      assert.equal(await render(page), edited);
      await undo(page);
      await byteExact(page);
      await redo(page);
      assert.equal(await render(page), edited);
      const { text } = await saveAndReopen(page, `r36-2-split-${id}-${platform}.html`);
      assert.equal(text, edited);
      assert.deepEqual(errors(page), []);
    });
  }
}
