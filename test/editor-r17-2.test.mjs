// regression tests of R17.2 on both platforms: a new text box after an undo of its first letter,
// Edit > Paste of the menu bar as its first input, and a new text box emptied and left

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// the editor on slide n of the demo deck, served over HTTP
async function load(t, platform, n = 0) {
  const text = readFileSync('test-deck.html', 'utf8');
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/test-deck.html?edit&still&theme=light&edit-platform=${platform}`;
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

// the new text box of the current slide, i.e. the empty box or the paragraph that starts with
// mark, with its text, its place on the screen, and whether it has the focus and the caret
const BOX = (mark) => `(() => {
  const s = Reveal.getCurrentSlide();
  const p = s.querySelector('p.beeson-pending') ?? [...s.querySelectorAll('p')].find((e) => e.textContent.startsWith(${js(mark)}));
  if (!p) return null;
  const r = p.getBoundingClientRect();
  const a = getSelection().anchorNode;
  return { text: p.textContent, left: r.left, top: r.top, pending: p.classList.contains('beeson-pending'), focused: document.activeElement === p, caret: !!a && p.contains(a) && getSelection().isCollapsed };
})()`;
const boxOf = (page, mark) => page.evaluate(BOX(mark));
const labels = (page) => page.evaluate(`({ undo: window.BeesonEditor.state('edit.undo').label, redo: window.BeesonEditor.state('edit.redo').label })`);
const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;
const kept = (a, b, what) => assert.ok(a && b && near(a.left, b.left) && near(a.top, b.top), `${what} moves the text box from ${js(a)} to ${js(b)}`);

async function newBox(page) {
  await click(page, '.beeson-edit-top [data-command="insert.text"]');
  await sleep(250);
  const empty = await boxOf(page, '\u0000');
  assert.equal(empty?.pending, true, 'Text does not add an empty text box');
  return empty;
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

// requirement 3h and N15 of round 7: an undo after the first letter of a new text box took the
// whole box away and left the focus on the body. in Keynote and PowerPoint this undo takes the
// letter and leaves the empty box with the caret in it, and a second undo takes the box
for (const platform of PLATFORMS) {
  test(`an undo of the first letter of a new text box leaves the empty box with the caret (${platform})`, async (t) => {
    for (const n of [4, 0, 11]) {
      const page = await load(t, platform, n);
      const empty = await newBox(page);
      await type(page, 'h');
      await sleep(1300);
      const written = await render(page);
      assert.notEqual(written, page.source, `the letter is not written on slide ${n + 1}`);
      await undo(page);
      const back = await boxOf(page, 'h');
      assert.deepEqual(back && { text: back.text, pending: back.pending, focused: back.focused, caret: back.caret }, { text: '', pending: true, focused: true, caret: true }, `an undo of the first letter on slide ${n + 1} does not leave the empty box with the caret`);
      kept(empty, back, `an undo of the first letter on slide ${n + 1}`);
      await byteExact(page);
      assert.equal((await labels(page)).undo, 'Undo Insert Text Box', `the entry under the letter on slide ${n + 1} is not the insert of the box`);
      await redo(page);
      assert.equal(await render(page), written);
      const again = await boxOf(page, 'h');
      assert.deepEqual(again && { text: again.text, pending: again.pending, caret: again.caret }, { text: 'h', pending: false, caret: true }, `a redo of the letter on slide ${n + 1} does not put the caret into the text`);
      kept(empty, again, `a redo of the letter on slide ${n + 1}`);
      // two undos take the letter and then the box, and two redos give both back
      await undo(page);
      await undo(page);
      assert.equal(await boxOf(page, 'h'), null, `a second undo on slide ${n + 1} does not take the box`);
      await byteExact(page);
      await redo(page);
      const box = await boxOf(page, 'h');
      assert.deepEqual(box && { text: box.text, pending: box.pending, caret: box.caret }, { text: '', pending: true, caret: true }, `a redo of the box on slide ${n + 1}`);
      await redo(page);
      assert.equal(await render(page), written);
      assert.equal((await boxOf(page, 'h'))?.caret, true);
      // a key typed after an undo of the first letter goes into the empty box
      await undo(page);
      await type(page, 'k');
      await sleep(300);
      assert.equal((await boxOf(page, 'k'))?.text, 'k', `the key after the undo on slide ${n + 1} is not typed into the box`);
      assert.match(await render(page), /<p[^>]*>k<\/p>/);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });
}

// a word typed into a new text box one key after the other is one entry with its first letter, as in
// Keynote, hence one undo leaves the empty box. a key after the pause of the typing of history.ts
// is an entry of its own
for (const platform of PLATFORMS) {
  test(`an undo of a word typed into a new text box leaves the empty box (${platform})`, async (t) => {
    const page = await load(t, platform, 4);
    await newBox(page);
    for (const key of 'Hello') {
      await type(page, key);
      await sleep(120);
    }
    await sleep(1200);
    await type(page, '!');
    await sleep(300);
    assert.equal((await boxOf(page, 'H'))?.text, 'Hello!');
    await undo(page);
    assert.equal((await boxOf(page, 'H'))?.text, 'Hello');
    await undo(page);
    const back = await boxOf(page, 'H');
    assert.deepEqual(back && { text: back.text, pending: back.pending, caret: back.caret }, { text: '', pending: true, caret: true }, 'an undo of the word does not leave the empty box');
    await byteExact(page);
    await redo(page);
    const again = await boxOf(page, 'H');
    assert.deepEqual(again && { text: again.text, caret: again.caret }, { text: 'Hello', caret: true }, 'a redo of the word');
    assert.deepEqual(errors(page), []);
  });
}

// requirement 3h and N14 of round 7: Edit > Paste of the menu bar as the first input of a new text
// box drew the words without writing them, and they were lost at the next click
for (const platform of PLATFORMS) {
  test(`Edit > Paste of the menu bar writes a new text box (${platform})`, async (t) => {
    const page = await load(t, platform, 4);
    await page.send('Browser.grantPermissions', { origin: server.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
    await page.evaluate(`navigator.clipboard.writeText('Pasted words')`);
    const empty = await newBox(page);
    await menu(page, 'Edit', 'Paste');
    const pasted = await boxOf(page, 'Pasted');
    assert.equal(pasted?.text, 'Pasted words');
    assert.equal(pasted?.pending, false, 'the paste of the menu is not written');
    kept(empty, pasted, 'the paste of the menu');
    const written = await render(page);
    assert.match(written, /<p[^>]*>Pasted words<\/p>/);
    await type(page, 'x');
    await sleep(300);
    assert.match(await render(page), /<p[^>]*>Pasted wordsx<\/p>/);
    await press(page, 'Escape');
    await press(page, 'Escape');
    await click(page, { x: 1580, y: 600 });
    await sleep(300);
    assert.match(await render(page), /<p[^>]*>Pasted wordsx<\/p>/, 'the words are lost after the box is left');
    await undo(page);
    assert.equal(await render(page), written);
    await undo(page);
    assert.equal((await boxOf(page, 'Pasted'))?.pending, true, 'an undo of the paste does not leave the empty box');
    await undo(page);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}

// N16 of round 7: a new text box emptied by Backspace and left with Esc was kept in the file as an
// empty paragraph, with a translate on some slides. a new text box left empty is taken out of the
// file, together with its entries while they are the last ones of the history
for (const platform of PLATFORMS) {
  test(`a new text box emptied by Backspace is taken out of the file when it is left (${platform})`, async (t) => {
    for (const n of [4, 11]) {
      const page = await load(t, platform, n);
      const undoBefore = (await labels(page)).undo;
      await newBox(page);
      await type(page, 'h');
      await sleep(300);
      await press(page, 'Backspace');
      await sleep(300);
      await press(page, 'Escape');
      await press(page, 'Escape');
      await sleep(300);
      await byteExact(page);
      assert.equal(await page.evaluate(`[...Reveal.getCurrentSlide().querySelectorAll('p')].filter((p) => !p.textContent.trim() && !p.closest('.foot, aside') && !p.hasAttribute('data-generated')).length`), 0, `an empty paragraph is left on slide ${n + 1}`);
      assert.equal((await labels(page)).undo, undoBefore, `the entries of the emptied box are left in the history on slide ${n + 1}`);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });

  test(`a new text box emptied by Backspace is taken out of the file at the click on Text, which adds a new box (${platform})`, async (t) => {
    const page = await load(t, platform, 4);
    await newBox(page);
    await type(page, 'h');
    await sleep(300);
    await press(page, 'Backspace');
    await sleep(300);
    await newBox(page);
    await sleep(300);
    assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelectorAll('p.beeson-pending').length`), 1, 'the new box is not kept');
    await byteExact(page);
    await type(page, 'k');
    await sleep(300);
    assert.match(await render(page), /<p[^>]*>k<\/p>/);
    assert.doesNotMatch(await render(page), /<p( style="[^"]*")?>(<br>)?<\/p>/, 'the emptied box is kept in the file');
    assert.deepEqual(errors(page), []);
  });

  test(`a new text box emptied after another change is taken out of the file in one entry (${platform})`, async (t) => {
    const page = await load(t, platform, 4);
    await newBox(page);
    await type(page, 'h');
    await sleep(300);
    // the heading is typed into, hence the entries of the box are no longer the last ones
    await click(page, 'section.present h2');
    await press(page, 'End');
    await type(page, 'Z');
    await sleep(1200);
    const typed = await render(page);
    await click(page, await page.evaluate(`(() => { const p = [...Reveal.getCurrentSlide().querySelectorAll('p')].find((e) => e.textContent === 'h'); const r = p.getBoundingClientRect(); return { x: r.left + 8, y: r.top + r.height / 2 }; })()`));
    await press(page, 'End');
    await press(page, 'Backspace');
    await sleep(300);
    await press(page, 'Escape');
    await press(page, 'Escape');
    await sleep(300);
    const left = await render(page);
    assert.doesNotMatch(left, /<p( style="[^"]*")?>(<br>)?<\/p>/, 'the emptied box is kept in the file');
    assert.equal(left, typed.replace(/\n[ \t]*<p( style="[^"]*")?>h<\/p>/, ''));
    // the removal is one entry, and the undo before it takes the Backspace
    await undo(page);
    assert.match(await render(page), /<p( style="[^"]*")?>(<br>)?<\/p>/, 'one undo does not give the emptied box back');
    await undo(page);
    assert.equal(await render(page), typed);
    assert.deepEqual(errors(page), []);
  });
}

// the boxes in slide px of the new text box of the current slide and of the drawn words and
// formulas of the other texts, i.e. the rectangles of their lines and of their MathJax containers
const INK = `(() => {
  const s = document.querySelector('.reveal .slides');
  const S = s.getBoundingClientRect(), k = S.width / s.offsetWidth;
  const box = (r) => ({ left: (r.left - S.left) / k, top: (r.top - S.top) / k, right: (r.right - S.left) / k, bottom: (r.bottom - S.top) / k });
  const c = Reveal.getCurrentSlide();
  const p = c.querySelector('p.beeson-pending') ?? [...c.querySelectorAll('p')].find((e) => e.textContent === 'Note');
  const ink = [];
  for (const e of c.querySelectorAll(':scope > h2, :scope > p, :scope > div.math')) {
    if (e === p || !e.getClientRects().length) continue;
    const r = document.createRange();
    r.selectNodeContents(e);
    for (const q of r.getClientRects()) if (q.width > 1 && q.height > 1) ink.push({ what: e.localName, ...box(q) });
  }
  return { box: p && box(p.getBoundingClientRect()), ink, surface: box(c.querySelector('.surface').getBoundingClientRect()) };
})()`;
const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// N17 of round 7: a new text box on slide 8 was put at the center of the slide, over the display of
// U_c and over the surface. its text column is full and the surface fills the right of the slide,
// hence a place off every text and figure does not exist, and the box is drawn narrower off the
// words and the formulas, over the surface, which a text box may lie over
for (const platform of PLATFORMS) {
  test(`a new text box on slide 8 is put off the words and the formulas (${platform})`, async (t) => {
    const page = await load(t, platform, 7);
    await sleep(500);
    await newBox(page);
    const { box, ink, surface } = await page.evaluate(INK);
    assert.ok(ink.length > 5, 'the words of slide 8 are not measured');
    const under = ink.filter((q) => meets(box, q));
    assert.deepEqual(under, [], `the text box ${js(box)} lies over words or formulas`);
    assert.ok(box.left >= 0 && box.top >= 0 && box.right <= 1920 && box.bottom <= 1080, `the text box ${js(box)} is not inside the slide`);
    assert.ok(box.right - box.left >= 500, `the text box ${js(box)} is narrower than a half`);
    assert.ok(meets(box, surface), 'the text box is not over the surface');
    await type(page, 'Note');
    await sleep(400);
    const written = await page.evaluate(INK);
    assert.ok(near(written.box.left, box.left, 1) && near(written.box.top, box.top, 1), `the first key moves the text box from ${js(box)} to ${js(written.box)}`);
    assert.match(await render(page), /<p style="translate: -?\d+px -?\d+px; width: \d+px">Note<\/p>|<p style="width: \d+px; translate: -?\d+px -?\d+px">Note<\/p>/);
    assert.deepEqual(errors(page), []);
  });
}
