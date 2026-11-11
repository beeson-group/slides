// regression tests of R13.1 on both platforms with trusted input: the four layer commands of
// commands/order.ts for an element in the flow, e.g. a paragraph moved onto a figure, as Bring to
// Front of Keynote (K70). each edit of the file is checked byte for byte, after an undo and a redo,
// and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const DECK = 'index.html';
// the slide of the demo deck with a paragraph, a list, and a figure in a zone
const FIGURES = [...readFileSync(DECK, 'utf8').matchAll(/<section[\s\S]*?<\/section>/g)].findIndex((m) => m[0].includes('Figures are first class citizens'));
const PLATFORMS = ['mac', 'other'];
const KEYS = {
  mac: { front: 'Mod+Shift+F', forward: 'Mod+Alt+Shift+F', backward: 'Mod+Alt+Shift+B', back: 'Mod+Shift+B' },
  other: { front: 'Mod+Shift+ArrowUp', forward: 'Mod+ArrowUp', backward: 'Mod+ArrowDown', back: 'Mod+Shift+ArrowDown' },
};
const P = '.reveal section.present > p';

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
const orders = async (page) => Object.fromEntries(await Promise.all(['front', 'forward', 'backward', 'back'].map(async (o) => [o, (await state(page, `arrange.order.${o}`)).enabled])));
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((e) => e.localName)`);

// the editor on the demo deck served over HTTP, with the storage of the origin emptied first, and
// with slide n shown
async function load(t, platform, n = FIGURES) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the boxes of the children of the current slide, to compare their places before and after a command
const boxes = (page) => page.evaluate(`[...document.querySelector('.reveal section.present').children].map((e) => { const r = e.getBoundingClientRect(); return e.localName + ' ' + [r.left, r.top, r.width, r.height].map(Math.round).join(' '); })`);

// a point of the text of the paragraph over the shown picture of the figure, in CSS px
const textOverPicture = (page) => page.evaluate(`(() => {
  const p = document.querySelector(${js(P)});
  const img = [...document.querySelectorAll('.reveal section.present figure img')].find((i) => i.getClientRects().length);
  const b = img.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(p);
  for (const r of range.getClientRects()) {
    const x = Math.max(r.left, b.left + 20), y = r.top + r.height / 2;
    if (x + 10 < Math.min(r.right, b.right) && y > b.top && y < b.bottom) return { x: x + 10, y };
  }
  return null;
})()`);

// the element of the slide drawn at a point, past the frames and the chrome of the editor
const drawnAt = (page, at) => page.evaluate(`(() => {
  const hit = document.elementsFromPoint(${at.x}, ${at.y}).find((e) => e.closest('.reveal section.present'));
  return hit ? (hit.closest(${js(P)}) ? 'p' : hit.localName) : null;
})()`);

async function checkEdit(page, edited, base) {
  assert.notEqual(edited, base);
  await undo(page);
  await frames(page);
  assert.equal(await render(page), base);
  await redo(page);
  await frames(page);
  assert.equal(await render(page), edited);
  await saveAndReopen(page, `r13-1-${Math.random().toString(36).slice(2)}.html`);
  assert.deepEqual(errors(page), []);
}

for (const platform of PLATFORMS) {
  test(`${platform}: a paragraph dragged onto the figure is brought in front of its picture`, async (t) => {
    const page = await load(t, platform);
    const scale = await page.evaluate(`document.querySelector('.reveal section.present').getBoundingClientRect().width / 1920`);
    await click(page, P);
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await selected(page), ['p']);
    // the paragraph is moved by its handle by 700 by 100 slide px onto the picture
    const from = await page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-handle')].find((d) => !d.hidden && d.getClientRects().length).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await drag(page, from, { dx: 700 * scale, dy: 100 * scale, steps: 12 });
    await frames(page);
    const dragged = await render(page);
    assert.notEqual(dragged, page.source);
    const at = await textOverPicture(page);
    assert.ok(at, 'the text of the paragraph is not over the picture');
    assert.equal(await drawnAt(page, at), 'img', 'the paragraph is not under the picture before Bring to Front');
    const placed = await boxes(page);

    assert.deepEqual(await orders(page), { front: true, forward: true, backward: false, back: false }, 'the layer commands of the moved paragraph');
    await press(page, KEYS[platform].front);
    await frames(page);
    assert.equal(await drawnAt(page, at), 'p', 'the paragraph is not drawn over the picture after Bring to Front');
    assert.deepEqual(await boxes(page), placed, 'an element is moved on the slide by Bring to Front');
    assert.deepEqual(await orders(page), { front: false, forward: false, backward: true, back: true });
    const front = await render(page);
    await checkEdit(page, front, dragged);
    await frames(page);
    assert.equal(await drawnAt(page, at), 'p');

    // Send to Back puts it under the picture again, without a move on the slide
    if ((await selected(page))[0] !== 'p') {
      await click(page, at);
      await press(page, 'Escape');
      await frames(page);
    }
    await press(page, KEYS[platform].back);
    await frames(page);
    assert.equal(await drawnAt(page, at), 'img', 'the paragraph is not drawn under the picture after Send to Back');
    assert.deepEqual(await boxes(page), placed, 'an element is moved on the slide by Send to Back');
  });
}
