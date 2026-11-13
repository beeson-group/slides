// regression tests of R20.12 on both platforms: a click on a figure that leaves an emptied new text
// box (F6), Paste of the Edit menu with the caret in a cell (F18), the place of a further new text
// box on a title slide and of a new table without a free place (F8, O1), the slide shown by the
// undo of Delete Text Box (F7), and Paste of the Edit menu with the read of the clipboard refused
// (F19)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test-deck.html';
const TABLES = 'test/pages/editor-tables.html';
const TITLE = 'test/pages/editor-r20-12.html';
const MOD = { mac: 4, other: 2 };

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
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const labels = (page) => page.evaluate(`({ undo: window.BeesonEditor.state('edit.undo').label, redo: window.BeesonEditor.state('edit.redo').label })`);
const rect = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

// the editor on slide n of deck, served over HTTP, with the storage of the origin emptied
async function load(t, platform, deck = DECK, n = 0) {
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
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  await sleep(200);
  return page;
}

// an item of a menu of the menu bar, chosen with the mouse. Paste comes before Paste and Match
// Style in the Edit menu, hence the first item that starts with the name is taken
async function menu(page, bar, item) {
  await click(page, await rect(page, `[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((e) => e.textContent.trim() === ${js(bar)})`));
  await sleep(250);
  const at = await page.evaluate(`(() => { const e = [...document.querySelectorAll('[role=menu] [role^=menuitem]')].find((x) => x.getClientRects().length && x.textContent.trim().startsWith(${js(item)})); const r = e.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await sleep(500);
  await frames(page);
}

// the boxes in slide px of the elements of the current slide that match selector, each with its
// text, its frame, and the ink of its words
const BOXES = (selector) => `(() => {
  const s = document.querySelector('.reveal .slides');
  const S = s.getBoundingClientRect(), k = S.width / s.offsetWidth;
  const px = (r) => ({ left: (r.left - S.left) / k, top: (r.top - S.top) / k, right: (r.right - S.left) / k, bottom: (r.bottom - S.top) / k });
  return [...Reveal.getCurrentSlide().querySelectorAll(${js(selector)})].map((e) => {
    const range = document.createRange();
    range.selectNodeContents(e);
    return { text: e.textContent.trim(), frame: px(e.getBoundingClientRect()), ink: px(range.getBoundingClientRect()) };
  });
})()`;
const boxes = (page, selector) => page.evaluate(BOXES(selector));

// F6: a click on a figure that left an emptied new text box took the box out, and the undo of the
// entries of the box put the caret into it again, which dropped the selection of the figure
for (const platform of PLATFORMS) {
  test(`a click on a figure that leaves an emptied text box selects the figure (${platform})`, async (t) => {
    for (const pause of [300, 1300]) {
      const page = await load(t, platform, DECK, 4);
      const at = `with a pause of ${pause} ms`;
      // an older entry, which stays undoable
      await click(page, 'section.present h2');
      await press(page, 'End');
      await type(page, 'Q');
      await sleep(1300);
      const older = await render(page);
      await click(page, '.beeson-edit-top [data-command="insert.text"]');
      await sleep(300);
      await type(page, 'h');
      await sleep(pause);
      await press(page, 'Backspace');
      await sleep(300);
      await click(page, 'section.present figure img.for-light');
      await sleep(700);
      assert.equal(await render(page), older, `the emptied box is kept ${at}`);
      const sel = await page.evaluate(`window.BeesonEditor.selection().map((e) => e.localName)`);
      assert.deepEqual(sel, ['figure'], `the click does not select the figure ${at}`);
      await press(page, 'ArrowRight');
      await sleep(300);
      assert.ok((await render(page)).includes('<figure class="figure-box" style="translate: 1px 0px">'), `ArrowRight does not nudge the figure ${at}`);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });
}

// the body cells Moon to 2.53e-5 of slide 2 of the tables deck copied by a trusted Mod+C, and the
// caret put into the cell Titan by a click
async function copyRange(t, platform) {
  const page = await load(t, platform, TABLES, 1);
  await page.send('Page.bringToFront');
  await page.send('Browser.grantPermissions', { origin: server.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  const cell = (r, c) => rect(page, `document.querySelector('.reveal section.present table').rows[${r}].cells[${c}]`);
  await click(page, await cell(1, 0));
  await sleep(150);
  await click(page, await cell(2, 1), { modifiers: 'Shift' });
  await sleep(150);
  const base = { key: 'c', code: 'KeyC', windowsVirtualKeyCode: 67, modifiers: MOD[platform] };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base, commands: ['copy'] });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await sleep(150);
  await click(page, await cell(3, 0));
  await sleep(300);
  return page;
}
const PASTED = '<tr><td>Moon</td><td>\\(0.01215\\)</td><td>Saturn</td></tr>\n      <tr><td>Europa</td><td>2.53e-5</td><td></td></tr>';

// F18: Paste of the Edit menu with the caret in a cell typed the whole range into this cell, while
// Mod+V filled the cells from it
for (const platform of PLATFORMS) {
  test(`Paste of the Edit menu and of the cell menu fill the cells from the caret as Mod+V does (${platform})`, async (t) => {
    for (const route of ['key', 'menu', 'cell menu']) {
      const page = await copyRange(t, platform);
      const base = await render(page);
      if (route === 'key') {
        const v = { key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, modifiers: MOD[platform] };
        await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...v, commands: ['paste'] });
        await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...v });
        await sleep(500);
      } else if (route === 'menu') await menu(page, 'Edit', 'Paste');
      else {
        await click(page, await rect(page, `document.querySelector('.reveal section.present table').rows[3].cells[0]`), { button: 'right' });
        await sleep(300);
        const item = await rect(page, `[...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.getClientRects().length && i.querySelector('.label')?.textContent === 'Paste')`);
        assert.ok(item, 'the cell menu does not have Paste');
        await click(page, item);
        await sleep(500);
      }
      const edited = await render(page);
      const table = edited.slice(edited.indexOf('A plain table'), edited.indexOf('</table>', edited.indexOf('A plain table')));
      assert.ok(edited.includes(PASTED), `${route} does not fill the cells from the caret: ${table}`);
      assert.equal((await labels(page)).undo, 'Undo Paste', `${route} is not one entry Paste`);
      await undo(page);
      assert.equal(await render(page), base, `the undo of ${route} does not give the file back`);
      await redo(page);
      assert.equal(await render(page), edited, `the redo of ${route} does not write the paste again`);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });
}

// F8: on a title slide, an earlier new text box counted only by the ink of its words, hence a
// second and a third box were put inside its frame, and its words ran under theirs once it grew
for (const platform of PLATFORMS) {
  test(`a second and a third new text box on a title slide are put off the frames of the earlier ones (${platform})`, async (t) => {
    const page = await load(t, platform, TITLE, 0);
    for (const words of ['First box', 'Second box', 'Third box']) {
      await click(page, '.beeson-edit-top [data-command="insert.text"]');
      await sleep(300);
      await type(page, words);
      await sleep(300);
      await press(page, 'Escape');
      await press(page, 'Escape');
      await sleep(300);
    }
    const made = await boxes(page, ':scope > p');
    assert.deepEqual(made.map((b) => b.text), ['First box', 'Second box', 'Third box']);
    const block = await boxes(page, '.title-text > *');
    for (const [i, a] of made.entries()) {
      for (const b of made.slice(i + 1)) assert.ok(!meets(a.frame, b.frame), `the box ${b.text} ${js(b.frame)} is put over the frame of ${a.text} ${js(a.frame)}`);
      assert.ok(a.frame.left >= 119.5 && a.frame.right <= 1800.5, `the box ${a.text} ${js(a.frame)} is outside the margins`);
      for (const w of block) assert.ok(!meets(a.ink, w.ink), `the box ${a.text} lies over the words ${w.text}`);
    }
    await click(page, await page.evaluate(`(() => { const r = document.createRange(); r.selectNodeContents(Reveal.getCurrentSlide().querySelector(':scope > p')); const b = r.getBoundingClientRect(); return { x: b.right - 2, y: b.top + b.height / 2 }; })()`));
    await press(page, 'End');
    await type(page, ' and a few more words');
    await sleep(300);
    const typed = await boxes(page, ':scope > p');
    assert.equal(typed[0].text, 'First box and a few more words');
    for (const b of typed.slice(1)) assert.ok(!meets(typed[0].ink, b.ink), `the words of the first box ${js(typed[0].ink)} run under ${b.text} ${js(b.ink)}`);
    await press(page, 'Escape');
    for (let i = 0; i < 20 && (await page.evaluate(`window.BeesonEditor.state('edit.undo').enabled`)); i++) await undo(page);
    assert.equal(await render(page), page.source, 'the undo of every insert does not give the file back');
    assert.deepEqual(errors(page), []);
  });
}

// F8: on a closing slide, a new table counted an earlier new text box only by the ink of its
// words, hence the table was put over the frame of the box
for (const platform of PLATFORMS) {
  test(`a new table on a closing slide is put off the frame of an earlier new text box (${platform})`, async (t) => {
    const n = (page) => page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.matches('.closing'))`);
    let page = await load(t, platform, DECK, 0);
    const closing = await n(page);
    await page.close();
    page = await load(t, platform, DECK, closing);
    await click(page, '.beeson-edit-top [data-command="insert.text"]');
    await sleep(300);
    await type(page, 'A box');
    await sleep(300);
    await press(page, 'Escape');
    await press(page, 'Escape');
    await sleep(300);
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await sleep(300);
    const [box] = await boxes(page, ':scope > p');
    const [table] = await boxes(page, 'table');
    assert.equal(box.text, 'A box');
    assert.ok(!meets(box.frame, table.frame), `the table ${js(table.frame)} lies over the frame of the text box ${js(box.frame)}`);
    assert.deepEqual(errors(page), []);
  });
}

// the boxes in slide px of the tables, of the pictures of the figures, and of each line of the
// words of the current slide
const PIECES = `(() => {
  const slide = Reveal.getCurrentSlide();
  const s = document.querySelector('.reveal .slides');
  const S = s.getBoundingClientRect(), k = S.width / s.offsetWidth;
  const px = (r) => ({ left: (r.left - S.left) / k, top: (r.top - S.top) / k, right: (r.right - S.left) / k, bottom: (r.bottom - S.top) / k });
  const tables = [...slide.querySelectorAll('table')].map((e) => px(e.getBoundingClientRect()));
  const figures = [...slide.querySelectorAll('figure img')].filter((e) => e.getClientRects().length).map((e) => px(e.getBoundingClientRect()));
  const lines = [...slide.querySelectorAll('h2, p, li')].filter((e) => e.getClientRects().length && !e.closest('table, figure')).flatMap((e) => {
    const range = document.createRange();
    range.selectNodeContents(e);
    return [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1).map(px);
  });
  return { tables, figures, lines };
})()`;

// O1: a new table without a free place is put at the place off the figures nearest to the middle
// of the slide, as the juror of round 6 ruled (finding 64 of glm in round 9)
for (const platform of PLATFORMS) {
  test(`a new table without a free place is put at the middle of the slide, off the figure and the first table (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, 4);
    const base = await render(page);
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await sleep(300);
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await sleep(300);
    const { tables, figures } = await page.evaluate(PIECES);
    assert.equal(tables.length, 2);
    assert.ok(!meets(tables[0], tables[1]), `the tables lie over each other: ${js(tables)}`);
    for (const [i, b] of tables.entries()) {
      for (const f of figures) assert.ok(!meets(b, f), `table ${i + 1} ${js(b)} lies over the figure ${js(f)}`);
    }
    assert.ok(Math.abs((tables[0].top + tables[0].bottom) / 2 - 540) <= 1, `table 1 ${js(tables[0])} is not at the middle of the slide`);
    await undo(page);
    await undo(page);
    assert.equal(await render(page), base);
    assert.deepEqual(errors(page), []);
  });
}

// F7: the entry Delete Text Box of a box left by a click on a row of the navigator was opened on
// the clicked slide, hence its undo showed this slide and not the slide of the box
for (const platform of PLATFORMS) {
  test(`the undo of Delete Text Box shows the slide of the box (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, 4);
    await click(page, '.beeson-edit-top [data-command="insert.text"]');
    await sleep(300);
    await type(page, 'hello');
    await sleep(1300);
    await press(page, 'Shift+Home');
    await press(page, 'Mod+B');
    await press(page, 'Backspace');
    await sleep(300);
    const emptied = await render(page);
    await click(page, '.beeson-edit-nav .row:nth-child(3)');
    await sleep(700);
    assert.equal(await page.evaluate('Reveal.getIndices().h'), 1);
    assert.equal((await labels(page)).undo, 'Undo Delete Text Box');
    const left = await render(page);
    await press(page, 'Escape');
    await undo(page);
    await frames(page);
    assert.equal(await page.evaluate('Reveal.getIndices().h'), 4, 'the undo of Delete Text Box does not show the slide of the box');
    assert.equal(await render(page), emptied);
    await page.evaluate('Reveal.slide(1)');
    await frames(page);
    await redo(page);
    await frames(page);
    assert.equal(await page.evaluate('Reveal.getIndices().h'), 4, 'the redo of Delete Text Box does not show the slide of the box');
    assert.equal(await render(page), left);
    assert.deepEqual(errors(page), []);
  });
}

// F19: with the read of the clipboard refused, Paste of the Edit menu pasted nothing and said
// nothing, while Mod+V pasted
for (const platform of PLATFORMS) {
  test(`Paste of the Edit menu with the read of the clipboard refused says that Mod+V pastes (${platform})`, async (t) => {
    const page = await load(t, platform, TABLES, 2);
    await page.send('Page.bringToFront');
    await page.send('Browser.setPermission', { origin: server.origin, permission: { name: 'clipboard-read' }, setting: 'denied' });
    assert.equal(await page.evaluate(`navigator.clipboard.readText().then(() => 'read', (e) => e.name)`), 'NotAllowedError');
    await click(page, await rect(page, `document.querySelector('.reveal section.present h2')`).then((p) => ({ x: p.x, y: p.y + 260 })));
    await sleep(200);
    const base = await render(page);
    await menu(page, 'Edit', 'Paste');
    assert.equal(await render(page), base);
    const state = await page.evaluate(`document.querySelector('.beeson-edit-titlebar .state').textContent`);
    const key = platform === 'mac' ? '⌘V' : 'Ctrl+V';
    assert.match(state, /browser/i, `the state does not say that the browser refused the read: ${state}`);
    assert.ok(state.includes(key), `the state does not name ${key}: ${state}`);
    assert.deepEqual(errors(page), []);
  });
}
