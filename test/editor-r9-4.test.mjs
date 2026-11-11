// regression tests of R9.4 on both platforms with trusted input. a formula is an object of the
// slide, with the element menu of the editor on a right-click, and every kind of selection has its
// context menu. after each edit the text is checked byte for byte, after an undo and a redo, and
// after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, center, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

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
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let saves = 0;

// the editor, or the deck alone without edit, on the slide n of the demo deck served over HTTP, in
// a window of 1600 by 1000 px
async function load(t, platform, { n = 0, edit = true } = {}) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/index.html?${edit ? 'edit&' : ''}still&theme=light&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  if (edit) {
    await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
    page.source = readFileSync('index.html', 'utf8');
    const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
    assert.deepEqual(s.problems, []);
  }
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks the text before byte for byte after undos undos, the edit after as many redos,
// and an open of the saved edit without problems, which is the text before the next check
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r9-4-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

// the context menu of the editor that is open, with its class and its items, each with its label
// and whether it is dimmed, or null
const MENU = `(() => {
  const m = [...document.querySelectorAll('.beeson-edit-menu')].filter((m) => m.getClientRects().length).at(-1);
  if (!m) return null;
  return { cls: m.className, items: [...m.querySelectorAll('.item')].map((e) => ({ label: e.querySelector('.label')?.textContent ?? '', off: e.getAttribute('aria-disabled') === 'true' })) };
})()`;
const menu = (page) => page.evaluate(MENU);
const mathJaxMenus = (page) => page.evaluate(`document.querySelectorAll('[class*=CtxtMenu_Menu]').length`);
// the selection of the editor, as the tag name of each element with its first class
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((e) => e.localName + (e.getAttribute('class') ? '.' + e.getAttribute('class').split(' ')[0] : ''))`);
const item = (m, label) => m?.items.find((i) => i.label === label);

async function closeMenu(page) {
  await press(page, 'Escape');
  await frames(page);
}

// findings menus-keys-1 and tables-equations-insert-1: a right-click on a formula opened the menu of
// MathJax and never the element menu of the editor, and on a formula of a caption the page was
// scrolled while this menu was open
for (const platform of PLATFORMS) {
  test(`a right-click on a formula opens the element menu of the editor (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 3 });
    const cases = [
      ['the display', 3, '.reveal section.present div.math mjx-container', 'div.math'],
      ['an inline formula', 3, '.reveal section.present p mjx-container', 'p.fragment'],
      ['the formula of a caption', 4, '.reveal section.present figcaption mjx-container', 'figure.zone'],
    ];
    for (const [what, n, sel, owner] of cases) {
      await page.evaluate(`Reveal.slide(${n})`);
      await frames(page);
      await click(page, sel, { button: 'right' });
      await sleep(300);
      assert.equal(await mathJaxMenus(page), 0, `a right-click on ${what} opens the menu of MathJax`);
      const m = await menu(page);
      assert.ok(m, `a right-click on ${what} does not open a menu of the editor`);
      assert.match(m.cls, /\belement\b/, `the menu of ${what} is not the element menu`);
      assert.equal(item(m, 'Edit Formula…')?.off, false, `Edit Formula… is not offered on ${what}`);
      assert.deepEqual(await selected(page), [owner], `a right-click on ${what} does not select its object`);
      assert.equal(await page.evaluate('document.body.scrollTop + document.documentElement.scrollTop'), 0, `the page is scrolled by a right-click on ${what}`);
      await closeMenu(page);
    }
    // Edit Formula… of the menu of an inline formula opens the sheet of this formula
    await page.evaluate('Reveal.slide(3)');
    await frames(page);
    await click(page, '.reveal section.present p mjx-container', { button: 'right' });
    await sleep(200);
    await click(page, await page.evaluate(`(() => { const i = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.textContent.includes('Edit Formula')); const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
    await sleep(300);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-math textarea')?.value`), '\\tilde U');
    await press(page, 'Escape');
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}

test('without edit, a right-click on a formula opens the menu of MathJax as before', async (t) => {
  const page = await load(t, 'mac', { n: 3, edit: false });
  await page.evaluate('Reveal.slide(3, 0, 9)');
  await frames(page);
  await click(page, '.reveal section.present div.math mjx-container', { button: 'right' });
  await sleep(300);
  assert.ok((await mathJaxMenus(page)) > 0);
});

// the style of the selector, read in the page
const styleOf = (page, sel) => page.evaluate(`document.querySelector(${js(sel)}).getAttribute('style')`);
const sheetOpen = (page) => page.evaluate(`!!document.querySelector('.beeson-math')`);

// finding select-move-resize-2: a Shift-click or a command-click on a formula added it to the
// selection and opened its TeX sheet as well, which took the next keys, and Esc then dropped the
// whole selection
for (const platform of PLATFORMS) {
  for (const mod of platform === 'mac' ? ['Shift', 'Mod'] : ['Shift']) {
    test(`a ${mod}-click on a formula adds it to the selection or takes it out, without its sheet (${platform})`, async (t) => {
      const page = await load(t, platform, { n: 3 });
      const para = '.reveal section.present > p:first-of-type';
      const math = '.reveal section.present div.math';
      await click(page, para);
      await press(page, 'Escape');
      await frames(page);
      assert.deepEqual(await selected(page), ['p']);
      await click(page, math, { modifiers: mod });
      await sleep(300);
      assert.equal(await sheetOpen(page), false, `a ${mod}-click on a formula opens its sheet`);
      assert.deepEqual(await selected(page), ['p', 'div.math']);
      await click(page, math, { modifiers: mod });
      await sleep(300);
      assert.equal(await sheetOpen(page), false);
      assert.deepEqual(await selected(page), ['p'], `a second ${mod}-click on the formula does not take it out of the selection`);
      await click(page, math, { modifiers: mod });
      await sleep(300);
      assert.deepEqual(await selected(page), ['p', 'div.math']);
      await press(page, 'ArrowRight');
      await press(page, 'ArrowRight');
      await frames(page);
      assert.match((await styleOf(page, para)) ?? '', /translate/, 'the arrow keys do not nudge the selection');
      assert.match((await styleOf(page, math)) ?? '', /translate/, 'the arrow keys do not nudge the formula');
      await press(page, 'Escape');
      await frames(page);
      assert.deepEqual(await selected(page), []);
      await roundTrip(page, 2);
      assert.deepEqual(errors(page), []);
    });
  }
}

const framed = (page) => page.evaluate(`document.querySelectorAll('.beeson-frame.selected:not([hidden])').length`);

// findings select-move-resize-1 and tables-equations-insert-5: Esc from the sheet of a formula left
// nothing selected, with the focus on the formula, which the editor took for a text. Delete and the
// arrow keys did nothing until a second Esc
for (const platform of PLATFORMS) {
  test(`Esc from the sheet of a display selects it as an object for Delete and the arrow keys (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 3 });
    const math = '.reveal section.present div.math';
    for (const how of ['the key', 'Cancel']) {
      await click(page, math);
      await sleep(300);
      assert.equal(await sheetOpen(page), true, 'a click on a formula does not open its sheet');
      if (how === 'Cancel') await click(page, '.beeson-math button:not(.primary)');
      else await press(page, 'Escape');
      await frames(page);
      assert.equal(await sheetOpen(page), false);
      assert.deepEqual(await selected(page), ['div.math'], `the formula is not selected after ${how}`);
      assert.equal(await framed(page), 1);
      await press(page, 'ArrowRight');
      await frames(page);
      assert.match((await styleOf(page, math)) ?? '', /translate/, `an arrow key after ${how} does not nudge the formula`);
      await roundTrip(page);
      // one more Esc clears the selection
      await click(page, math);
      await sleep(300);
      await press(page, 'Escape');
      await frames(page);
      await press(page, 'Escape');
      await frames(page);
      assert.deepEqual(await selected(page), [], `a second Esc after ${how} does not clear the selection`);
      assert.equal(await framed(page), 0);
      assert.equal(await page.evaluate(`document.activeElement.closest('mjx-container') === null`), true, 'the formula keeps the focus after the selection is cleared');
    }
    // Backspace deletes the formula selected by Esc
    await click(page, math);
    await sleep(300);
    await press(page, 'Escape');
    await frames(page);
    await press(page, 'Backspace');
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelectorAll(${js(math)}).length`), 0, 'Backspace does not delete the formula');
    await roundTrip(page);
  });

  test(`Esc from the sheet of an inline formula selects its block as an object (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 3 });
    const para = '.reveal section.present p[data-fragment-index="2"]';
    await click(page, `${para} mjx-container`);
    await sleep(300);
    assert.equal(await sheetOpen(page), true);
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await selected(page), ['p.fragment']);
    await press(page, 'ArrowDown');
    await frames(page);
    assert.match((await styleOf(page, para)) ?? '', /translate/, 'an arrow key does not nudge the block of the formula');
    await roundTrip(page);
  });
}

// the center of the menu item named label in the open menu
const itemAt = (page, label) => page.evaluate(`(() => { const i = [...document.querySelectorAll('.beeson-edit-menu .item')].filter((i) => i.getClientRects().length).find((i) => i.querySelector('.label')?.textContent === ${js(label)}); const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

// asserts that a right-click at at keeps the selection sel and opens the element menu with Lock
async function objectMenu(page, at, sel, what) {
  await click(page, at, { button: 'right' });
  await sleep(250);
  assert.deepEqual(await selected(page), sel, `a right-click on ${what} drops the selection`);
  const m = await menu(page);
  assert.ok(m, `a right-click on ${what} does not open a menu of the editor`);
  assert.match(m.cls, /\belement\b/, `a right-click on ${what} opens the ${m.cls} menu`);
  assert.ok(item(m, 'Lock') || item(m, 'Unlock'), `the menu of ${what} does not offer Lock`);
  return m;
}

// finding menus-keys-2: a right-click on a text block selected as an object, a code box included,
// on one of several selected blocks, or on a member of a selected group dropped the selection and
// opened the text menu, and a right-click on the handle of a block opened no menu of the editor
for (const platform of PLATFORMS) {
  test(`a right-click on a selected block, several blocks, a group, or the handle opens the element menu (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 4 });
    const para = '.reveal section.present > p';
    const head = '.reveal section.present > h2';
    await click(page, para);
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await selected(page), ['p']);
    await objectMenu(page, para, ['p'], 'a selected block');
    await closeMenu(page);
    // the handle of the selected block
    const handle = await center(page, '.beeson-handle:not([hidden])');
    await objectMenu(page, handle, ['p'], 'the handle of a block');
    await closeMenu(page);
    // two blocks, then the two grouped
    await click(page, head);
    await press(page, 'Escape');
    await click(page, para, { modifiers: 'Shift' });
    await frames(page);
    assert.deepEqual(await selected(page), ['h2', 'p']);
    let m = await objectMenu(page, para, ['h2', 'p'], 'one of two selected blocks');
    assert.equal(item(m, 'Group')?.off, false);
    await closeMenu(page);
    await page.evaluate(`window.BeesonEditor.exec('arrange.group')`);
    await frames(page);
    m = await objectMenu(page, para, ['h2', 'p'], 'a member of a selected group');
    assert.equal(item(m, 'Ungroup')?.off, false);
    await closeMenu(page);
    await roundTrip(page);
    // Delete of the menu of a selected block
    await click(page, '.reveal section.present > ul', { button: 'left' });
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await selected(page), ['ul']);
    await objectMenu(page, '.reveal section.present > ul li', ['ul'], 'a selected list');
    await click(page, await itemAt(page, 'Delete'));
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal section.present > ul').length`), 0);
    await roundTrip(page);
  });

  test(`a right-click on a code box selected as an object opens the element menu (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 5 });
    await click(page, '.reveal section.present pre code');
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await selected(page), ['pre']);
    const m = await objectMenu(page, '.reveal section.present pre code', ['pre'], 'a selected code box');
    assert.equal(item(m, 'Delete')?.off, false);
    await closeMenu(page);
    assert.deepEqual(errors(page), []);
  });
}

// an arrow drawn by a drag of 300 px from x0 along the line at y on the current slide, with
// nothing selected after it, and the text with it as the source of the page
async function drawArrow(page, x0, y) {
  await page.evaluate(`window.BeesonEditor.exec('insert.arrow')`);
  await sleep(150);
  await drag(page, { x: x0, y }, { dx: 300, steps: 12 });
  await sleep(200);
  assert.equal(await page.evaluate(`document.querySelectorAll('.reveal section.present svg.line').length`), 1, 'the arrow is not drawn');
  await press(page, 'Escape');
  await press(page, 'Escape');
  await frames(page);
  assert.deepEqual(await selected(page), []);
  page.source = await render(page);
  const r = await page.evaluate(`(() => { const r = document.querySelector('.reveal section.present svg.line line').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  return r;
}

// finding menus-keys-3: a right-click on the stroke of a line opened the slide menu, or over a text
// the text menu with the line taken out of the selection
for (const platform of PLATFORMS) {
  test(`a right-click on the stroke of a line selects it and opens its element menu (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 6 });
    for (const [n, where] of [[6, 'an empty part of a slide'], [3, 'a text']]) {
      await page.evaluate(`Reveal.slide(${n})`);
      await frames(page);
      const s = await page.evaluate(`(() => { const r = document.querySelector('.reveal section.present').getBoundingClientRect(); const p = document.querySelector('.reveal section.present > p')?.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, py: p ? p.top + p.height / 2 : null }; })()`);
      const y = n === 3 ? s.py : s.t + s.h * 0.93;
      const at = await drawArrow(page, s.l + s.w * 0.15, y);
      for (const before of ['selected', 'not selected']) {
        if (before === 'selected') {
          await click(page, at);
          await frames(page);
          assert.deepEqual(await selected(page), ['svg.line']);
        }
        const m = await objectMenu(page, at, ['svg.line'], `a line ${before} over ${where}`);
        assert.equal(item(m, 'Delete')?.off, false);
        await closeMenu(page);
        await press(page, 'Escape');
        await frames(page);
      }
      await objectMenu(page, at, ['svg.line'], `a line over ${where}`);
      await click(page, await itemAt(page, 'Delete'));
      await frames(page);
      assert.equal(await page.evaluate(`document.querySelectorAll('.reveal section.present svg.line').length`), 0);
      await roundTrip(page);
    }
  });
}

// finding select-move-resize-4: an Option-drag of a line, a Ctrl-drag on Windows and Linux, moved
// the line without a copy, unlike a drag of every other kind
for (const platform of PLATFORMS) {
  test(`a copy drag of a line leaves it in place and moves a copy (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 6 });
    const s = await page.evaluate(`(() => { const r = document.querySelector('.reveal section.present').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; })()`);
    const at = await drawArrow(page, s.l + s.w * 0.15, s.t + s.h * 0.85);
    const lines = () => page.evaluate(`[...document.querySelectorAll('.reveal section.present svg.line')].map((l) => ({ style: l.style.translate, marker: l.querySelector('marker')?.id }))`);
    const [first] = await lines();
    await click(page, at);
    await drag(page, at, { dx: 0, dy: -200, steps: 10, modifiers: platform === 'mac' ? 'Alt' : 'Ctrl', hold: true });
    const readout = await page.evaluate(`[...document.querySelectorAll('.beeson-offset')].filter((r) => !r.hidden && r.getClientRects().length).map((r) => r.textContent).join(' ')`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y - 200, button: 'left', clickCount: 1, modifiers: platform === 'mac' ? 1 : 2 });
    await sleep(300);
    assert.match(readout, /Copy/, 'the readout of a copy drag of a line does not read Copy');
    const after = await lines();
    assert.equal(after.length, 2, 'a copy drag of a line does not copy it');
    assert.deepEqual(after[0], first, 'the line dragged with the copy key is moved');
    assert.notEqual(after[1].marker, first.marker, 'the copy has the id of the marker of its original');
    assert.notEqual(after[1].style, first.style, 'the copy is not put where it was dropped');
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Duplicate');
    assert.equal(await page.evaluate(`window.BeesonEditor.selection()[0] === document.querySelectorAll('.reveal section.present svg.line')[1]`), true, 'the copy is not selected');
    await roundTrip(page);
  });
}

// the shown handles of a block with their cursor, and the cursor of the element at a point
const handles = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-handle')].filter((h) => !h.hidden && h.getClientRects().length).map((h) => getComputedStyle(h).cursor)`);
const cursorAt = (page, p) => page.evaluate(`getComputedStyle(document.elementFromPoint(${p.x}, ${p.y})).cursor`);

// finding select-move-resize-9: a locked block kept its handle with a move cursor, and a locked QR
// code showed a move cursor, although neither can be dragged
for (const platform of PLATFORMS) {
  test(`a locked block or QR code does not show a move cursor (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 11 });
    const qr = await center(page, '.reveal section.present .qr');
    assert.equal(await cursorAt(page, qr), 'move', 'the QR code does not show a move cursor before its lock');
    await click(page, qr);
    await page.evaluate(`window.BeesonEditor.exec('arrange.lock')`);
    await frames(page);
    await roundTrip(page);
    await click(page, qr);
    await frames(page);
    assert.notEqual(await cursorAt(page, qr), 'move', 'a locked QR code shows a move cursor');
    await page.evaluate('Reveal.slide(3)');
    await frames(page);
    const para = '.reveal section.present > p';
    await click(page, para);
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await handles(page), ['move']);
    await page.evaluate(`window.BeesonEditor.exec('arrange.lock')`);
    await frames(page);
    assert.ok((await page.evaluate(`document.querySelector(${js(para)}).hasAttribute('data-locked')`)));
    assert.deepEqual((await handles(page)).filter((c) => c === 'move'), [], 'a locked block shows its handle with a move cursor');
    await roundTrip(page);
  });
}

// finding tables-equations-insert-7: a TeX error was shown twice in the sheet of a formula, as the
// error box of MathJax in the preview and again as the red line under it
for (const platform of PLATFORMS) {
  test(`a TeX error is shown once in the sheet of a formula (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 5 });
    await page.evaluate(`window.BeesonEditor.exec('insert.formula')`);
    await page.waitFor(`!!document.querySelector('.beeson-math textarea')`);
    await page.evaluate(`(() => { const f = document.querySelector('.beeson-math textarea'); f.focus(); f.select(); })()`);
    await type(page, 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}{2a}');
    await page.waitFor(`!!document.querySelector('.beeson-math .error:not(.prompt)')?.textContent`);
    await sleep(300);
    const sheet = await page.evaluate(`(() => { const m = document.querySelector('.beeson-math'); return { boxes: m.querySelectorAll('.preview [data-mjx-error], .preview mjx-merror').length, message: m.querySelector('.error').textContent, insert: m.querySelector('button.primary').disabled }; })()`);
    assert.equal(sheet.boxes, 0, 'the preview shows the error box of MathJax beside the message under it');
    assert.match(sheet.message, /brace/i);
    assert.equal(sheet.insert, true);
    // a TeX without an error is previewed again
    await page.evaluate(`document.querySelector('.beeson-math textarea').select()`);
    await type(page, 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');
    await page.waitFor(`!document.querySelector('.beeson-math .error').textContent`);
    assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-math .preview svg').length`), 1);
    assert.deepEqual(errors(page), []);
  });
}

// a stub of speechSynthesis that keeps the texts it is given in window.spoken and speaks until it
// is cancelled, or no speechSynthesis with off
const STUB = (off) => `(() => {
  window.spoken = [];
  const stub = { speaking: false, current: null,
    speak(u) { this.current = u; this.speaking = true; window.spoken.push(u.text); },
    cancel() { const u = this.current; this.current = null; if (this.speaking) { this.speaking = false; u?.onend?.(new Event('end')); } } };
  Object.defineProperty(window, 'speechSynthesis', { value: ${off ? 'undefined' : 'stub'}, configurable: true });
  return true;
})()`;
const cmd = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const labels = (items) => items.map((i) => (i.rule ? '-' : i.command ?? i.label));

// the submenu Speech of the Edit menu of Keynote, with Start Speaking and Stop Speaking, which read
// the selected text, the selected blocks, or the slide aloud
for (const platform of PLATFORMS) {
  test(`Edit > Speech reads the selection or the slide aloud (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 3 });
    await page.evaluate(STUB(false));
    // the submenu follows Substitutions in the Edit menu
    const edit = labels(await page.evaluate(`window.BeesonEditorShell.menuItems('Edit')`));
    assert.ok(edit.includes('Speech'), `the Edit menu does not have Speech: ${edit.join(', ')}`);
    assert.equal(edit.indexOf('Speech'), edit.indexOf('Substitutions') + 1, 'Speech does not follow Substitutions');
    assert.deepEqual(labels(await page.evaluate(`window.BeesonEditorShell.menuItems('Edit', 'Speech')`)), ['edit.startSpeaking', 'edit.stopSpeaking']);
    assert.equal((await cmd(page, 'edit.startSpeaking')).enabled, true);
    assert.equal((await cmd(page, 'edit.stopSpeaking')).enabled, false);
    // without a selection, the text of the slide in reading order, from its heading on
    await page.evaluate(`window.BeesonEditor.exec('edit.startSpeaking')`);
    let spoken = await page.evaluate('window.spoken');
    assert.equal(spoken.length, 1);
    assert.match(spoken[0], /^Equations are first class citizens\s+You can type LaTeX/);
    assert.doesNotMatch(spoken[0], /\\\\/, 'the TeX of a formula is spoken');
    assert.equal((await cmd(page, 'edit.stopSpeaking')).enabled, true, 'Stop Speaking is not enabled while a text is spoken');
    await page.evaluate(`window.BeesonEditor.exec('edit.stopSpeaking')`);
    assert.equal(await page.evaluate('window.speechSynthesis.speaking'), false);
    assert.equal((await cmd(page, 'edit.stopSpeaking')).enabled, false);
    // the selected text, with the key of Keynote on a Mac
    const para = '.reveal section.present > p:first-of-type';
    await click(page, para);
    await page.evaluate(`(() => { const t = document.querySelector(${js(para)}).firstChild; getSelection().setBaseAndExtent(t, 8, t, 16); })()`);
    if (platform === 'mac') await press(page, 'Mod+Alt+Shift+S');
    else await page.evaluate(`window.BeesonEditor.exec('edit.startSpeaking')`);
    spoken = await page.evaluate('window.spoken');
    assert.equal(spoken.at(-1), 'type LaT');
    // the text menu has the submenu Speech, as in Keynote
    await click(page, para, { button: 'right' });
    await sleep(250);
    const m = await menu(page);
    assert.match(m.cls, /\btext\b/);
    assert.ok(item(m, 'Speech'), 'the text menu does not have Speech');
    await closeMenu(page);
    // the selected blocks
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await selected(page), ['p']);
    await page.evaluate(`window.BeesonEditor.exec('edit.startSpeaking')`);
    spoken = await page.evaluate('window.spoken');
    assert.match(spoken.at(-1), /^You can type LaTeX in equation boxes\..*expressed as$/s);
    // nothing of the file or the history is changed
    await byteExact(page);
    assert.equal((await cmd(page, 'edit.undo')).enabled, false);
    assert.deepEqual(errors(page), []);
  });

  test(`Start Speaking and Stop Speaking are dimmed without speechSynthesis (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 3 });
    await page.evaluate(STUB(true));
    assert.equal((await cmd(page, 'edit.startSpeaking')).enabled, false);
    assert.equal((await cmd(page, 'edit.stopSpeaking')).enabled, false);
  });
}
