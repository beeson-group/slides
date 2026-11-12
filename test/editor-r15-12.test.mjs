// regression tests of R15.12 on both platforms, the findings F1, F2, F6, F7, and F11 of the review
// of round 7: a new text box in the block of a title or a closing slide, Distribute of texts at one
// margin, and the lifted copy of a row at a zoom and at a change of slide

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const TABLES = 'test/pages/editor-r13-3.html';

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
const wait = (page, ms = 300) => page.evaluate(`new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), ${ms}))`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const undoLabel = (page) => state(page, 'edit.undo').then((s) => s.label);
const near = (a, b, what, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} against ${b}`);
let saves = 0;

// the editor on slide n of deck, served over HTTP, with the storage of the origin emptied
async function load(t, platform, n, deck = 'index.html') {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?edit&still&theme=light&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await wait(page);
  return page;
}

// the texts of the block of the current slide in slide px, and the new text box, a child of the
// section after them: the box of each and the boxes of its lines, with the box of an empty text as
// its one line
const TEXTS = `(() => {
  const s = document.querySelector('.reveal .slides'), S = s.getBoundingClientRect(), k = S.width / s.offsetWidth;
  const px = (r) => ({ top: (r.top - S.top) / k, bottom: (r.bottom - S.top) / k, left: (r.left - S.left) / k, right: (r.right - S.left) / k });
  const c = Reveal.getCurrentSlide();
  return [...c.querySelector('.block').children, ...c.querySelectorAll(':scope > p')].map((e) => {
    const range = document.createRange();
    range.selectNodeContents(e);
    const lines = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0).map(px);
    return { name: e.classList.contains('beeson-pending') ? 'box' : e.localName + (e.className ? '.' + e.className : ''), text: e.textContent, box: px(e.getBoundingClientRect()), lines: lines.length ? lines : [px(e.getBoundingClientRect())] };
  });
})()`;
const meets = (a, b) => a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5 && a.left < b.right && b.left < a.right;

// F1: on a title or a closing slide the block is anchored at its bottom. at the first key the
// texts of the block moved down by 48 px, and the box was held in its place over the last line
for (const platform of PLATFORMS) {
  test(`the first key in a new text box of a title or a closing slide moves no text, and the box does not lie over a text (${platform})`, async (t) => {
    for (const n of [0, 12]) {
      const page = await load(t, platform, n);
      await click(page, '.beeson-edit-top [data-command="insert.text"]');
      await wait(page, 200);
      const empty = await page.evaluate(TEXTS);
      assert.equal(empty.at(-1)?.name, 'box', `Text does not add an empty box after the texts of the block of slide ${n + 1}`);
      await type(page, 'Hq');
      await wait(page);
      const written = await page.evaluate(TEXTS);
      assert.equal(written.length, empty.length);
      const box = written.at(-1);
      assert.equal(box.text, 'Hq');
      for (let i = 0; i < empty.length - 1; i++) near(written[i].box.top, empty[i].box.top, `the first key on slide ${n + 1} moves the ${empty[i].name}`, 0.6);
      near(box.box.top, empty.at(-1).box.top, `the first key on slide ${n + 1} moves the box`, 0.6);
      // the distance of the box to the text before it is the distance that the empty box had
      near(box.box.top - written.at(-2).box.bottom, empty.at(-1).box.top - empty.at(-2).box.bottom, `the gap over the box on slide ${n + 1}`, 0.6);
      for (const other of written.slice(0, -1)) {
        for (const a of box.lines) for (const b of other.lines) assert.ok(!meets(a, b), `a line of the box on slide ${n + 1} lies over a line of the ${other.name}: ${js({ a, b })}`);
      }
      const text = await render(page);
      assert.match(text, /<\/div>\s*(<div class="qr"[^>]*><\/div>\s*)?<p style="(width: \d+px; )?translate: \d+px \d+px;?">Hq<\/p>/, `the box of slide ${n + 1} is not written as a paragraph with its translate after the block`);
      const { text: saved } = await saveAndReopen(page, `r15-12-${++saves}.html`);
      assert.equal(saved, text);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });
}

// the left and the right of the heading, the paragraph, and the list of slide 5, in slide px
const COLUMN = `(() => {
  const s = document.querySelector('.reveal .slides'), S = s.getBoundingClientRect(), k = S.width / s.offsetWidth;
  const c = Reveal.getCurrentSlide();
  return Object.fromEntries(['h2', 'p', 'ul'].map((n) => { const r = c.querySelector(':scope > ' + n).getBoundingClientRect(); return [n, [Math.round((r.left - S.left) / k), Math.round((r.right - S.left) / k)]]; }));
})()`;

// F2: Distribute Horizontally of three texts at the left margin spaced their centers where the gap
// is negative, and moved the list by 25 px
for (const platform of PLATFORMS) {
  test(`Distribute Horizontally of three texts at one left margin leaves them and the file as they are (${platform})`, async (t) => {
    const page = await load(t, platform, 4);
    await click(page, 'section.present figure img.for-light');
    await click(page, 'section.present h2', { modifiers: 'Shift' });
    await click(page, 'section.present > p', { modifiers: 'Shift' });
    await click(page, 'section.present > ul > li', { modifiers: 'Shift' });
    await click(page, 'section.present figure img.for-light', { modifiers: 'Shift' });
    await wait(page);
    assert.deepEqual((await page.evaluate('window.BeesonEditor.selection().map((e) => e.localName)')).sort(), ['h2', 'p', 'ul']);
    await page.evaluate(`window.BeesonEditor.exec('arrange.alignTo.selection')`);
    assert.equal((await state(page, 'arrange.distribute.horizontal')).enabled, true);
    const before = await page.evaluate(COLUMN);
    await page.evaluate(`window.BeesonEditor.exec('arrange.distribute.horizontal')`);
    await wait(page);
    assert.deepEqual(await page.evaluate(COLUMN), before, 'Distribute moves a text off the margin');
    assert.equal(await render(page), page.source, 'Distribute changes the file');
    assert.deepEqual(errors(page), []);
  });
}

// the rows of the table of the current slide, a segment of a bar, and the lifted copy of a row
const TABLE = `document.querySelector('.reveal section.present table')`;
const rowsOf = (page) => page.evaluate(`[...${TABLE}.rows].map((tr) => [...tr.cells].map((c) => c.textContent.trim()).join(' '))`);
const segment = (bar, i) => `.beeson-table-bars .bar.${bar} > [data-index="${i}"]`;
const middle = (page, selector) => page.evaluate(`(() => { const r = document.querySelector(${js(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })()`);
const boxOf = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; })()`);
const LIFT = `document.querySelector('.beeson-table-bars .lift')`;
const pointer = (page, type, x, y) => page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
const cellPoint = (page, text) => page.evaluate(`(() => {
  const td = [...document.querySelectorAll('.reveal section.present td')].find((c) => c.textContent.trim() === ${js(text)});
  const r = td.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);

// row 2 of the plain table selected by its bar and dragged down by one row with the button held
async function liftRow(page) {
  await click(page, await cellPoint(page, 'A2'));
  await wait(page, 100);
  await click(page, await middle(page, segment('rows', 1)));
  await wait(page, 100);
  const m = await middle(page, segment('rows', 1));
  await drag(page, m, { dy: m.h, steps: 10, hold: true });
  await wait(page, 100);
  assert.ok(await boxOf(page, LIFT), 'the dragged row is not lifted');
  return { x: m.x, y: m.y + m.h };
}

// F6: the lifted copy kept its size and its place from the start of the drag after a zoom
for (const platform of PLATFORMS) {
  test(`the lifted copy of a row is scaled and placed with the table at a zoom during the drag (${platform})`, async (t) => {
    const page = await load(t, platform, 1, TABLES);
    const at = await liftRow(page);
    const l0 = await boxOf(page, LIFT), r0 = await boxOf(page, `${TABLE}.rows[1]`);
    for (let i = 0; i < 3; i++) {
      await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: at.x + 60, y: at.y, deltaX: 0, deltaY: -100, modifiers: 2, buttons: 1 });
      await wait(page, 100);
    }
    await wait(page);
    const r1 = await boxOf(page, `${TABLE}.rows[1]`);
    assert.ok(r1.h > r0.h * 1.2, `the canvas is not zoomed: ${js({ r0, r1 })}`);
    const check = async (y, what) => {
      const l = await boxOf(page, LIFT), r = await boxOf(page, `${TABLE}.rows[1]`);
      assert.ok(l, `the lifted row is gone ${what}`);
      near(l.w, r.w, `the width of the lifted row ${what}`, 2);
      near(l.h, r.h, `the height of the lifted row ${what}`, 2);
      near(l.x, r.x, `the left of the lifted row ${what}`, 2);
      // the point of the copy under the pointer is the one pressed, at the scale of the zoom
      near(l.y - y, ((l0.y - at.y) * r.h) / r0.h, `the top of the lifted row against the pointer ${what}`, 2);
    };
    await check(at.y, 'after the zoom');
    await pointer(page, 'mouseMoved', at.x, at.y + 20);
    await wait(page, 100);
    await check(at.y + 20, 'after a move at the zoom');
    await press(page, 'Escape');
    await pointer(page, 'mouseReleased', at.x, at.y + 20);
    await wait(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}

// F7: a drag by a bar went on after a change of slide, and the release moved the row of the slide
// that was left, as an entry of the history. a key does not change the slide during the drag, as
// test/editor-r17-4.test.mjs checks for PageDown
for (const platform of PLATFORMS) {
  for (const [how, go] of [['Reveal.slide', (page) => page.evaluate('Reveal.slide(2)')]]) {
    test(`a change of slide by ${how} ends the drag of a row by its bar without a change of the file (${platform})`, async (t) => {
      const page = await load(t, platform, 1, TABLES);
      const before = await undoLabel(page);
      const rows = await rowsOf(page);
      const at = await liftRow(page);
      await go(page);
      await wait(page);
      assert.equal(await page.evaluate('Reveal.getIndices().h'), 2, 'the slide is not changed');
      assert.equal(await boxOf(page, LIFT), null, 'the lifted row stays after the change of slide');
      assert.equal(await page.evaluate(`document.querySelector('.beeson-table-bars .lift').children.length`), 0, 'the lifted cells stay in the page');
      await pointer(page, 'mouseMoved', at.x, at.y + 30);
      await pointer(page, 'mouseReleased', at.x, at.y + 30);
      await wait(page);
      assert.equal(await render(page), page.source, 'the release changes the file');
      assert.equal(await undoLabel(page), before, 'the release is an entry of the history');
      await page.evaluate('Reveal.slide(1)');
      await wait(page);
      assert.deepEqual(await rowsOf(page), rows);
      assert.deepEqual(errors(page), []);
    });
  }
}
