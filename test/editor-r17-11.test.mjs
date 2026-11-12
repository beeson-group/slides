// regression tests of R17.11 on both platforms: a new text box on a title or closing slide is a
// child of the section, and the lines of the block keep their places. a box begun by a click on
// Text right after a box was emptied is undone by one undo

import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, type } from './helpers/editor.mjs';

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
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => press(page, 'Mod+Z').then(() => sleep(250));
const redo = (page) => press(page, 'Mod+Shift+Z').then(() => sleep(250));
const labels = (page) => page.evaluate(`({ undo: window.BeesonEditor.state('edit.undo').label, redo: window.BeesonEditor.state('edit.redo').label })`);

// the editor on slide n of the demo deck, served over HTTP
async function load(t, platform, n = 0) {
  const text = readFileSync('index.html', 'utf8');
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/index.html?edit&still&theme=light&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = text;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(text)})`);
  assert.deepEqual(s.problems, []);
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the boxes in slide px of the lines of the block of the current slide, and of the paragraphs of
// the new text box, i.e. the children of the section that start with mark or are pending
const PLACES = (mark) => `(() => {
  const s = document.querySelector('.reveal .slides');
  const S = s.getBoundingClientRect(), k = S.width / s.offsetWidth;
  const px = (e) => { const r = e.getBoundingClientRect(); return { left: (r.left - S.left) / k, top: (r.top - S.top) / k, right: (r.right - S.left) / k, bottom: (r.bottom - S.top) / k }; };
  const c = Reveal.getCurrentSlide();
  const lines = [];
  for (const e of c.querySelectorAll('.block > *')) for (const r of e.getClientRects()) lines.push({ left: (r.left - S.left) / k, top: (r.top - S.top) / k });
  const box = [...c.querySelectorAll(':scope > p')].filter((p) => p.classList.contains('beeson-pending') || (${js(mark)} && p.textContent.startsWith(${js(mark)})));
  return { lines, box: box.map(px), inBlock: !!c.querySelector('.block .beeson-pending') };
})()`;
const places = (page, mark = '') => page.evaluate(PLACES(mark));
const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;
function sameLines(a, b, what) {
  assert.equal(a.lines.length, b.lines.length, `${what} changes the number of lines of the block`);
  a.lines.forEach((l, i) => assert.ok(near(l.left, b.lines[i].left) && near(l.top, b.lines[i].top), `${what} moves a line of the block from ${js(l)} to ${js(b.lines[i])}`));
}
// an item of a menu of the menu bar, chosen with the mouse. Paste comes before Paste and Match
// Style in the Edit menu, hence the first item that starts with the name is taken
async function menu(page, bar, item) {
  await click(page, await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((e) => e.textContent.trim() === ${js(bar)}); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
  await sleep(250);
  const at = await page.evaluate(`(() => { const e = [...document.querySelectorAll('[role=menu] [role^=menuitem]')].find((x) => x.getClientRects().length && x.textContent.trim().startsWith(${js(item)})); const r = e.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await sleep(500);
  await frames(page);
}
const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// N19 of round 7: on a title or closing slide, Insert > Text Box put the paragraph into the block,
// which is held at its foot, hence each line of the box lifted the lines of the block by a line
for (const platform of PLATFORMS) {
  test(`a new text box on a title or closing slide keeps the lines of the block in place (${platform})`, async (t) => {
    for (const n of [0, 11]) {
      const page = await load(t, platform, n);
      const at = `on slide ${n + 1}`;
      const start = await places(page);
      await click(page, '.beeson-edit-top [data-command="insert.text"]');
      await sleep(300);
      const empty = await places(page);
      assert.equal(empty.box.length, 1, `Text does not add a text box as a child of the section ${at}`);
      assert.equal(empty.inBlock, false, `the text box is put into the block ${at}`);
      sameLines(start, empty, `the insert ${at}`);
      // the box is inside the margins of the slide, and off the words of the block and the lockup
      const b = empty.box[0];
      assert.ok(b.left >= 119.5 && b.right <= 1800.5 && b.top >= 0 && b.bottom <= 1080, `the text box ${js(b)} is outside the margins ${at}`);
      const words = await page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'); const S = s.getBoundingClientRect(), k = S.width / s.offsetWidth; return [...Reveal.getCurrentSlide().querySelectorAll('.block > *')].filter((e) => e.textContent.trim()).map((e) => { const r = e.getBoundingClientRect(); return { left: (r.left - S.left) / k, top: (r.top - S.top) / k, right: (r.right - S.left) / k, bottom: (r.bottom - S.top) / k }; }); })()`);
      for (const w of words) assert.ok(!meets(b, w), `the text box ${js(b)} lies over the words ${js(w)} ${at}`);
      if (n === 0) assert.ok(!meets(b, { left: 120, top: 60, right: 560, bottom: 132 }), `the text box ${js(b)} lies over the lockup ${at}`);
      await type(page, 'a');
      await sleep(300);
      const first = await places(page, 'a');
      sameLines(start, first, `the first key ${at}`);
      assert.ok(near(first.box[0].left, b.left) && near(first.box[0].top, b.top), `the first key moves the text box ${at}`);
      await press(page, 'Enter');
      await type(page, 'b');
      await press(page, 'Enter');
      await type(page, 'c');
      await sleep(1300);
      const three = await places(page);
      sameLines(start, three, `three lines typed into the box ${at}`);
      const written = await render(page);
      // the new paragraphs are children of the section, before the foot and the notes
      const slide = written.split(/<section/)[n + 1];
      assert.match(slide, /<p style="[^"]*translate: [\d.-]+px [\d.-]+px[^"]*">a<\/p>/, `the box is not written with its translate ${at}`);
      assert.ok(slide.indexOf('>a</p>') > slide.indexOf('</div>', slide.indexOf('class="block"')), `the box is written into the block ${at}`);
      if (slide.includes('aside class="notes"')) assert.ok(slide.indexOf('>c</p>') < slide.indexOf('aside class="notes"'), `the box is written after the notes ${at}`);
      await undo(page);
      sameLines(start, await places(page), `an undo ${at}`);
      await redo(page);
      sameLines(start, await places(page), `a redo ${at}`);
      assert.equal(await render(page), written);
      assert.deepEqual(errors(page), []);

      // the saved deck opened without edit draws the box at the place shown in the editor
      const shown = (await places(page, 'a')).box;
      const file = `.r17-11-${platform}-${n}.html`;
      writeFileSync(file, written);
      t.after(() => rmSync(file, { force: true }));
      for (const theme of ['light', 'dark']) {
        const show = await browser.newPage({ width: 1600, height: 1000 });
        await show.goto(`${server.origin}/${file}?still&theme=${theme}#/${n}`);
        await show.waitFor(deckSettled);
        await show.evaluate(`Reveal.slide(${n})`);
        await frames(show);
        const drawn = await show.evaluate(PLACES('a'));
        sameLines(start, drawn, `the show in ${theme} mode ${at}`);
        assert.equal(drawn.box.length, shown.length);
        drawn.box.forEach((d, i) => assert.ok(near(d.left, shown[i].left, 1) && near(d.top, shown[i].top, 1), `the show in ${theme} mode draws a line of the box at ${js(d)} in place of ${js(shown[i])} ${at}`));
        await show.close();
      }
      await page.close();
    }
  });
}

// the rules of R17.2 on a title slide: an undo of the first letter leaves the empty box, a box
// emptied and left is taken out of the file, and Edit > Paste as the first input is written
for (const platform of PLATFORMS) {
  test(`a new text box on a title slide follows the rules of a new text box (${platform})`, async (t) => {
    const page = await load(t, platform, 0);
    await click(page, '.beeson-edit-top [data-command="insert.text"]');
    await sleep(300);
    const empty = await places(page);
    await type(page, 'h');
    await sleep(1300);
    await undo(page);
    const back = await places(page);
    assert.equal(back.box.length, 1, 'an undo of the first letter does not leave the empty box');
    assert.ok(near(back.box[0].left, empty.box[0].left) && near(back.box[0].top, empty.box[0].top), 'an undo of the first letter moves the box');
    assert.equal(await page.evaluate(`document.activeElement?.classList.contains('beeson-pending')`), true, 'the caret is not in the empty box');
    await byteExact(page);
    await type(page, 'h');
    await sleep(300);
    await press(page, 'Backspace');
    await sleep(300);
    await press(page, 'Escape');
    await press(page, 'Escape');
    await sleep(300);
    await byteExact(page);
    await page.send('Browser.grantPermissions', { origin: server.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
    await page.evaluate(`navigator.clipboard.writeText('Pasted words')`);
    await click(page, '.beeson-edit-top [data-command="insert.text"]');
    await sleep(300);
    const box = (await places(page)).box[0];
    await menu(page, 'Edit', 'Paste');
    const pasted = await places(page, 'Pasted');
    sameLines(empty, pasted, 'the paste of the menu');
    assert.ok(near(pasted.box[0].left, box.left) && near(pasted.box[0].top, box.top), 'the paste of the menu moves the box');
    assert.match(await render(page), /<p style="[^"]*">Pasted words<\/p>/, 'the paste of the menu is not written');
    assert.deepEqual(errors(page), []);
  });
}

// the edge left by R17.2: after a click on Text right after a box was emptied, the history held an
// insert of the new box whose undo did nothing
for (const platform of PLATFORMS) {
  test(`one undo takes a box begun by a click on Text right after a box was emptied (${platform})`, async (t) => {
    for (const n of [4, 0]) {
      const page = await load(t, platform, n);
      await click(page, '.beeson-edit-top [data-command="insert.text"]');
      await sleep(300);
      await type(page, 'h');
      await sleep(300);
      await press(page, 'Backspace');
      await sleep(300);
      await click(page, '.beeson-edit-top [data-command="insert.text"]');
      await sleep(600);
      assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelectorAll('p.beeson-pending').length`), 1, `the new box is not kept on slide ${n + 1}`);
      await byteExact(page);
      assert.equal((await labels(page)).undo, 'Undo Insert Text Box', `the last entry is not the insert of the new box on slide ${n + 1}`);
      await undo(page);
      assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelectorAll('p.beeson-pending').length`), 0, `an undo does not take the new box on slide ${n + 1}`);
      await byteExact(page);
      // each entry left changes the file at its undo
      for (let i = 0; i < 6 && (await labels(page)).undo !== 'Undo'; i++) {
        const was = await render(page);
        await undo(page);
        assert.notEqual(await render(page), was, `the undo of an entry does not change the file on slide ${n + 1}`);
      }
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });
}
