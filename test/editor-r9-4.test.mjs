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
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((e) => e.localName + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : ''))`);
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
