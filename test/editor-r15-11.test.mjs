// regression tests of R15.11 on both platforms with trusted input: two lists of one kind joined
// when the paragraph between them is deleted, cut, or taken off by Backspace, a dash list and a
// numbered list left apart, and a range of cells pasted onto a slide as a new table with its bold
// and its formula. after each edit the text is checked byte for byte after an undo, the edit again
// after a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const LISTS = 'test/pages/editor-r13-3.html';
const TABLES = 'test/pages/editor-tables.html';
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
const settle = (page) => page.evaluate('new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), 100))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
const exec = (page, id) => page.evaluate(`window.BeesonEditor.exec(${js(id)})`);
let saves = 0;

// the editor on slide n of deck, served over HTTP, with the storage of the origin emptied
async function load(t, platform, deck, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  page.platform = platform;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await settle(page);
  return page;
}

// the edit checked against base after an undo, again after a redo, and after a save and an open
async function roundTrip(page, base) {
  const edited = await render(page);
  assert.notEqual(edited, base, 'the action does not change the file');
  await undo(page);
  assert.equal(await render(page), base, 'the undo does not give the file back byte for byte');
  await redo(page);
  assert.equal(await render(page), edited, 'the redo does not write the edit again');
  const { text } = await saveAndReopen(page, `r15-11-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  return edited;
}

const find = (selector, needle) => `[...document.querySelectorAll(${js(selector)})].find((el) => el.getBoundingClientRect().width && el.textContent.includes(${js(needle)}))`;
const ITEM = '.reveal section.present ol > li, .reveal section.present ul > li';

// the caret put at the end, or with end false at the start, of the item that holds needle
const caretIn = (page, needle, end = true) => page.evaluate(`(() => {
  const li = ${find(ITEM, needle)};
  const w = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
  const texts = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.data.trim()) texts.push(n);
  li.closest('[contenteditable="true"]').focus();
  const n = ${end} ? texts.at(-1) : texts[0];
  getSelection().collapse(n, ${end} ? n.length : 0);
})()`);

// the lists of the current slide, each as its tag, its start above 1, and the first word of each
// of its items
const lists = (page) => page.evaluate(`[...document.querySelectorAll('.reveal section.present > :is(ul, ol)')].map((l) => l.localName + (l.start > 1 ? ':' + l.start : '') + ' ' + [...l.children].filter((c) => c.localName === 'li').map((li) => li.textContent.trim().split(' ')[0]).join(','))`);

// a trusted Mod+X or Mod+C, which the browser turns into a cut or a copy event, and the data that
// it wrote
async function clip(page, command) {
  const [key, code, kc] = command === 'cut' ? ['x', 'KeyX', 88] : ['c', 'KeyC', 67];
  const modifiers = page.platform === 'mac' ? 4 : 2;
  await page.evaluate(`(() => { window.__w = []; const o = DataTransfer.prototype.setData; DataTransfer.prototype.setData = function (t, v) { window.__w.push([t, v]); return o.call(this, t, v); }; })()`);
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: kc, modifiers, commands: [command] });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: kc, modifiers });
  await settle(page);
  const w = await page.evaluate('window.__w');
  return { plain: w.find((x) => x[0] === 'text/plain')?.[1] ?? '', html: w.find((x) => x[0] === 'text/html')?.[1] ?? '' };
}

// the paragraph of the caret selected as an object by Esc
async function selectParagraph(page) {
  await press(page, 'Escape');
  await settle(page);
  assert.deepEqual(await page.evaluate(`window.BeesonEditor.selection().map((el) => el.localName)`), ['p'], 'the paragraph is not selected');
}

// the part of the file of slide 3 of the demo deck from its ul to its backdrop
const listPart = (text) => {
  const at = text.indexOf('<h2>Show your steps one at a time');
  return text.slice(text.indexOf('<ul>', at), text.indexOf('<div class="backdrop"', at));
};

// Return twice at the end of the second item of slide 3 of the demo deck, which cuts its list in
// two around an empty paragraph
async function cutDemoList(page) {
  await caretIn(page, 'Two elements with the same');
  await press(page, 'Enter');
  await press(page, 'Enter');
  await settle(page);
  assert.deepEqual(await lists(page), ['ul Each,Two', 'ul When']);
}

for (const platform of PLATFORMS) {
  test(`two dash lists are joined after Delete of the paragraph between them, and after Backspace in an empty one (${platform})`, async (t) => {
    const page = await load(t, platform, 'index.html', 2);
    await cutDemoList(page);
    const empty = await render(page);
    // Backspace in the empty paragraph takes it off, which gives the list of the file back
    await press(page, 'Backspace');
    await settle(page);
    assert.equal(await render(page), page.source, `Backspace does not give the one list back: ${listPart(await render(page))}`);
    assert.deepEqual(await lists(page), ['ul Each,Two,When']);
    assert.equal(await undoLabel(page), 'Undo Join Paragraphs');
    await roundTrip(page, empty);
    await undo(page);
    await undo(page);
    assert.equal(await render(page), page.source);
    // a paragraph with text, selected as an object and deleted
    await caretIn(page, 'Two elements with the same');
    await press(page, 'Enter');
    await press(page, 'Enter');
    await type(page, 'Between');
    await settle(page);
    const between = await render(page);
    assert.match(listPart(between), /together\.<\/li>\n {2}<\/ul>\n {2}<p>Between<\/p>\n {2}<ul>/);
    await selectParagraph(page);
    await press(page, 'Delete');
    await settle(page);
    assert.equal(await render(page), page.source, `Delete does not give the one list back: ${listPart(await render(page))}`);
    assert.deepEqual(await lists(page), ['ul Each,Two,When']);
    assert.equal(await undoLabel(page), 'Undo Delete');
    await roundTrip(page, between);
  });

  test(`two numbered lists are joined after Cut of the paragraph between them, with the count continued and the start of the second dropped (${platform})`, async (t) => {
    const page = await load(t, platform, LISTS, 0);
    // Backspace at the start of Seventh makes it a paragraph between the list of Alpha to Echo and
    // the list of Eighth, which keeps start="7"
    await caretIn(page, 'Seventh', false);
    await press(page, 'Backspace');
    await settle(page);
    const parted = await render(page);
    assert.ok(parted.includes('<li>Echo</li>\n  </ol>\n  <p>Seventh</p>\n  <ol start="7">\n    <li>Eighth</li>\n  </ol>'), parted);
    await selectParagraph(page);
    await clip(page, 'cut');
    await settle(page);
    const joined = await render(page);
    assert.ok(joined.includes('<li>Echo</li>\n    <li>Eighth</li>\n  </ol>\n</section>'), `the lists are not joined: ${joined.slice(joined.indexOf('<li>Echo'), joined.indexOf('</section>') + 10)}`);
    assert.ok(!joined.includes('start='), 'the start of the second list is kept');
    assert.deepEqual(await lists(page), ['ol Alpha,Bravo,Charlie,Delta,Echo,Eighth']);
    assert.equal(await undoLabel(page), 'Undo Cut');
    await roundTrip(page, parted);
  });

  test(`a dash list and a numbered list are left apart after Delete of the paragraph between them (${platform})`, async (t) => {
    const page = await load(t, platform, 'index.html', 2);
    await cutDemoList(page);
    await type(page, 'Between');
    await caretIn(page, 'When exporting');
    await exec(page, 'text.list.ol');
    await settle(page);
    assert.deepEqual(await lists(page), ['ul Each,Two', 'ol When']);
    const numbered = await render(page);
    await page.evaluate(`(() => { const p = ${find('.reveal section.present > p', 'Between')}; p.focus(); getSelection().collapse(p.firstChild, 3); })()`);
    await selectParagraph(page);
    await press(page, 'Delete');
    await settle(page);
    assert.deepEqual(await lists(page), ['ul Each,Two', 'ol When']);
    assert.match(listPart(await render(page)), /together\.<\/li>\n {2}<\/ul>\n {2}<ol>\n {4}<li class="fragment" data-fragment-index="3">When/);
    await roundTrip(page, numbered);
  });
}

const at = (page, r, c) => page.evaluate(`(() => { const t = Reveal.getCurrentSlide().querySelector('table'); const b = t.rows[${r}].cells[${c}].getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);

// the cells from a to b selected as a block, with a click and a Shift-click
async function range(page, a, b) {
  await click(page, await at(page, ...a));
  await settle(page);
  await click(page, await at(page, ...b), { modifiers: 'Shift' });
  await settle(page);
  assert.ok(await page.evaluate(`(() => { const o = document.querySelector('.beeson-table-bars .cell.block'); return !!o && !o.hidden; })()`), 'the range is not selected');
}


// a paste event with the data plain and html at the focus, as the browser sends it
async function paste(page, plain, html) {
  const done = await page.evaluate(`(() => { const dt = new DataTransfer(); dt.setData('text/plain', ${js(plain)}); dt.setData('text/html', ${js(html)}); const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); (document.activeElement || document.body).dispatchEvent(ev); return ev.defaultPrevented; })()`);
  assert.ok(done, 'the paste is not taken by the editor');
  await settle(page);
}

for (const platform of PLATFORMS) {
  test(`a range with a bold word and a formula pasted onto a slide is a new table with the bold and the formula (${platform})`, async (t) => {
    const page = await load(t, platform, TABLES, 1);
    const europa = await at(page, 2, 0);
    await click(page, europa);
    await settle(page);
    await click(page, europa, { count: 2 });
    await settle(page);
    await press(page, 'Mod+B');
    await settle(page);
    await press(page, 'Escape');
    await settle(page);
    const bold = await render(page);
    assert.ok(bold.includes('<tr><td><strong>Europa</strong></td><td>2.53e-5</td><td>Jupiter</td></tr>'));
    await range(page, [1, 0], [2, 1]);
    const { plain, html } = await clip(page, 'copy');
    assert.ok(html.includes('<td><strong>Europa</strong></td>') && html.includes('<td>\\(0.01215\\)</td>'), html);
    // the range is let go, and the paste is onto the first slide, whose table has merged cells
    await press(page, 'Escape');
    await press(page, 'Escape');
    await page.evaluate('Reveal.slide(0)');
    await settle(page);
    await page.evaluate('document.activeElement?.blur()');
    await paste(page, plain, html);
    const pasted = await render(page);
    // the place of the table is left to placeTable, the column of 2.53e-5 is one of numbers, and
    // the cells of the range keep their kind
    const right = '<td style="text-align: right">';
    const table = `<tbody>\n      <tr><td>Moon</td><td style="text-align: right">\\(0.01215\\)</td></tr>\n      <tr><td><strong>Europa</strong></td>${right}2.53e-5</td></tr>\n    </tbody>\n  </table>`;
    assert.ok(pasted.includes(table), `the new table is not written with its bold and its formula:\n${pasted.slice(pasted.indexOf('</table>') + 8, pasted.indexOf('A plain table'))}`);
    assert.equal(await undoLabel(page), 'Undo Paste Table');
    assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelectorAll('table')[1].querySelectorAll('strong').length`), 1);
    assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelectorAll('table')[1].querySelectorAll('mjx-container').length`), 1);
    await roundTrip(page, bold);
  });
}
