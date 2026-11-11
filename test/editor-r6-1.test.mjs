// regression tests of R6.1 on both platforms with trusted input: the Edit menu in the order of the
// Edit menu of Keynote, Delete of the selected words of a text, the list buttons on a selected
// block, a key that runs one command in each state, every row of the keyboard sheet in a window
// of 1280 by 800, and the context menu of the picture of a figure without Edit Text. after each
// edit the text is checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
// the slide of the deck of layouts with a paragraph and a list, and the slide with an ordered
// list and a figure with a caption
const TEXT = 2;
const MATH = 3;

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
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

// the editor on the slide n of a deck served over HTTP, with the Format tab shown
async function load(t, platform, { deck = LAYOUTS, n = 0, size = { width: 1600, height: 1000 } } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the edits applied to the text, then an undo gives the text before byte for byte, a redo gives
// the edit, and a save of the edit is opened again without problems
let saves = 0;
async function roundTrip(page, edits) {
  await byteExact(page, edits);
  const edited = await render(page);
  await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r6-1-${++saves}.html`);
  assert.equal(text, edited);
  page.source = text;
}

// the words text selected in the first element at selector, with its block focused
const selectWords = (page, selector, text) =>
  page.evaluate(`(() => {
    const el = document.querySelector(${js(selector)});
    el.closest('[contenteditable="true"]').focus();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const at = n.data.indexOf(${js(text)});
      if (at < 0) continue;
      const r = document.createRange();
      r.setStart(n, at);
      r.setEnd(n, at + ${text.length});
      getSelection().removeAllRanges();
      getSelection().addRange(r);
      return true;
    }
    return false;
  })()`);

// the items of a menu of the menu bar as labels, with a submenu as its label in braces and a rule
// as a bar
const menuLabels = (page, bar) => page.evaluate(`(() => {
  const E = window.BeesonEditor;
  return window.BeesonEditorShell.menuItems(${js(bar)}).map((i) => i.rule ? '|' : i.command ? E.state(i.command).label : '{' + i.label + '}');
})()`);

// the center of the item labeled label of the open menu, or null
const itemAt = (page, label) => page.evaluate(`(() => {
  const item = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label')?.textContent === ${js(label)});
  if (!item) return null;
  const r = item.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);

async function openBar(page, bar) {
  await click(page, await page.evaluate(`(() => {
    const r = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)}).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`));
  await frames(page);
}

// the Edit menu of Keynote 15.4 in references/keynote-menus.txt of the council: Undo and Redo, the
// clipboard and Delete, Duplicate Selection and the selection, then Find. the labels are those of
// the commands of the editor, e.g. Duplicate for Duplicate Selection and Select Figure for Select
// Parent
const EDIT = ['Undo', 'Redo', '|', 'Cut', 'Copy', 'Paste', 'Paste and Match Style', 'Delete', '|', 'Duplicate', 'Select All', 'Deselect', 'Select Figure', '|', 'Find…', 'Find Next', 'Find Previous', 'Use Selection for Find', 'Replace…', '|', '{Spelling and Grammar}', '{Substitutions}'];

for (const platform of PLATFORMS) {
  // finding opus 10 of round 2: Select All and Find were listed before Cut
  test(`the Edit menu reads Undo, the clipboard and Delete, Duplicate and Select All, then Find (${platform})`, async (t) => {
    const page = await load(t, platform);
    assert.deepEqual(await menuLabels(page, 'Edit'), EDIT);
    assert.deepEqual(errors(page), []);
  });

  // finding glm 29 of round 2: Edit > Delete was dimmed in a text. both apps delete the selected
  // words, and both dim Delete with a bare caret
  test(`Edit > Delete deletes the selected words of a text and is dimmed with a bare caret (${platform})`, async (t) => {
    const page = await load(t, platform, { n: TEXT });
    const p = '.reveal section.present > p:not(.small)';
    await click(page, p);
    await frames(page);
    assert.equal((await state(page, 'element.delete')).enabled, false, 'Delete is enabled with a bare caret');
    assert.ok(await selectWords(page, p, 'paragraph '));
    await frames(page);
    assert.equal((await state(page, 'element.delete')).enabled, true, 'Delete is dimmed over the selected words');
    await openBar(page, 'Edit');
    const at = await itemAt(page, 'Delete');
    assert.ok(at, 'Delete is not in the Edit menu');
    await click(page, at);
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelector(${js(p)}).textContent.startsWith('A with ')`), true);
    assert.equal((await state(page, 'element.delete')).enabled, false);
    await roundTrip(page, [['<p>A paragraph with', '<p>A with']]);
    assert.deepEqual(errors(page), []);
  });

  // findings opus 17, gemini 17, and qwen3 26 of round 2: the list buttons of the Text pane were
  // dimmed for a paragraph selected as a block
  test(`the list buttons of the Text pane make a selected paragraph a list and a selected list paragraphs (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    const p = '.reveal section.present > p:first-of-type';
    await click(page, p);
    await press(page, 'Escape');
    await frames(page);
    for (const kind of ['none', 'ul', 'ol']) assert.equal((await state(page, `text.list.${kind}`)).enabled, true, `text.list.${kind} is dimmed on a selected paragraph`);
    assert.equal((await state(page, 'text.list.none')).checked, true);
    await click(page, `${PANEL} [data-command="text.list.ul"]`);
    await frames(page);
    await roundTrip(page, [['<p>The lead-in of a display</p>', '<ul>\n    <li>The lead-in of a display</li>\n  </ul>']]);
    // the new list is selected as a block again, and Numbers makes it an ordered list
    await click(page, '.reveal section.present > ul > li');
    await press(page, 'Escape');
    await frames(page);
    assert.equal((await state(page, 'text.list.ul')).checked, true);
    await click(page, `${PANEL} [data-command="text.list.ol"]`);
    await frames(page);
    await roundTrip(page, [['<ul>\n    <li>The lead-in of a display</li>\n  </ul>', '<ol>\n    <li>The lead-in of a display</li>\n  </ol>']]);
    // Paragraphs on a selected list makes each item a paragraph with the attributes of the item
    await click(page, '.reveal section.present > ol:last-of-type > li');
    await press(page, 'Escape');
    await frames(page);
    assert.equal((await state(page, 'text.list.ol')).checked, true);
    await click(page, `${PANEL} [data-command="text.list.none"]`);
    await frames(page);
    await roundTrip(page, [[
      '<ol>\n    <li class="fragment" data-fragment-index="3">A first step</li>\n    <li class="fragment" data-final>A final step</li>\n  </ol>',
      '<p class="fragment" data-fragment-index="3">A first step</p>\n  <p class="fragment" data-final>A final step</p>',
    ]]);
    assert.deepEqual(errors(page), []);
  });

  // finding gemini 19 of round 2: Shift+F3 ran Find Previous and Change Case on Windows and
  // Linux. in each state below, every key of the sheet runs one enabled command at most
  test(`no key of the keyboard sheet runs two commands in one state of the editor (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    const clashes = async (where) => (await page.evaluate('window.BeesonEditorShell.keyClashes()')).map((c) => `${where}: ${c}`);
    const found = [];
    // a query of the find panel enables Find Next and Find Previous after the panel is closed
    await exec(page, 'find.open', 'step');
    await exec(page, 'find.close');
    await frames(page);
    found.push(...(await clashes('the canvas')));
    await click(page, '.reveal section.present figure.zone img:not([hidden])');
    await frames(page);
    found.push(...(await clashes('a figure')));
    await press(page, 'Escape');
    const p = '.reveal section.present > p:first-of-type';
    await click(page, p);
    await frames(page);
    found.push(...(await clashes('a caret in a text')));
    await selectWords(page, p, 'lead-in');
    await frames(page);
    found.push(...(await clashes('words of a text')));
    await click(page, '.reveal section.present > ol > li');
    await frames(page);
    found.push(...(await clashes('a list item')));
    await press(page, 'Escape');
    await frames(page);
    found.push(...(await clashes('a block')));
    await exec(page, 'find.open', 'step');
    await frames(page);
    found.push(...(await clashes('the find field')));
    await press(page, 'Escape');
    await page.evaluate(`document.querySelector('.beeson-edit-nav .row')?.focus()`);
    await frames(page);
    found.push(...(await clashes('the navigator')));
    assert.deepEqual(found, []);
    assert.deepEqual(errors(page), []);
  });

  // Find Previous keeps a key on every platform, Ctrl+Shift+F3 on Windows and Linux, and Shift+F3
  // is Change Case, as in PowerPoint
  test(`Find Previous and Change Case each have their key (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    await exec(page, 'find.open', 'step');
    await frames(page);
    await exec(page, 'find.next');
    await exec(page, 'find.next');
    const at = () => page.evaluate(`document.querySelector('.beeson-find .count')?.textContent.match(/(\\d+) of (\\d+)/)?.[1] ?? null`);
    const second = await at();
    assert.ok(second, 'the find panel does not count its matches');
    await press(page, platform === 'mac' ? 'Mod+Shift+G' : 'Ctrl+Shift+F3');
    await frames(page);
    assert.notEqual(await at(), second, 'the key of Find Previous does not step back in the find panel');
    await press(page, 'Escape');
    const p = '.reveal section.present > p:first-of-type';
    await click(page, p);
    assert.ok(await selectWords(page, p, 'lead-in'));
    await frames(page);
    await press(page, 'Shift+F3');
    await frames(page);
    const text = await page.evaluate(`document.querySelector(${js(p)}).textContent`);
    assert.notEqual(text, 'The lead-in of a display', 'Shift+F3 did not change the case of the words');
    assert.deepEqual(errors(page), []);
  });

  // finding gemini 19 of round 2: the group Other of the keyboard sheet was cut at the bottom of
  // the sheet on Windows and Linux. in a window of 768 px or more, every row is shown without a
  // scroll, and in a smaller window the sheet scrolls to its last row
  for (const [width, height] of [[1280, 800], [1366, 768], [1600, 1000], [1024, 700]]) {
    test(`every row of the keyboard sheet is shown in a window of ${width} by ${height} (${platform})`, async (t) => {
      const page = await load(t, platform, { size: { width, height } });
      await exec(page, 'help.keys');
      await frames(page);
      const sheet = () => page.evaluate(`(() => {
        const d = document.querySelector('dialog.beeson-edit-keys');
        const b = d.querySelector('.body');
        const body = b.getBoundingClientRect();
        const box = d.getBoundingClientRect();
        const rows = [...d.querySelectorAll('.row')].map((r) => ({ label: r.firstChild.textContent, box: r.getBoundingClientRect() }));
        const cut = rows.filter((r) => r.box.top < body.top - 0.5 || r.box.bottom > body.bottom + 0.5 || r.box.right > body.right + 0.5).map((r) => r.label);
        const lasts = [...d.querySelectorAll('.column')].map((c) => [...c.querySelectorAll('.row')].at(-1).getBoundingClientRect());
        return {
          open: d.open, rows: rows.length, cut, scrolls: b.scrollHeight > b.clientHeight + 1, overflow: getComputedStyle(b).overflowY,
          lastsShown: lasts.every((r) => r.bottom <= body.bottom + 0.5), inside: box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth,
        };
      })()`);
      const s = await sheet();
      assert.equal(s.open, true);
      assert.ok(s.rows > 90, `${s.rows} rows`);
      assert.equal(s.inside, true, 'the sheet is outside the window');
      if (height >= 768) {
        assert.deepEqual(s.cut, [], 'rows of the sheet are cut');
        assert.equal(s.scrolls, false, 'the sheet scrolls');
      } else {
        assert.equal(s.overflow, 'auto');
        await page.evaluate(`(() => { const b = document.querySelector('dialog.beeson-edit-keys .body'); b.scrollTop = b.scrollHeight; })()`);
        await frames(page);
        assert.equal((await sheet()).lastsShown, true, 'the last row of a column is not shown at the end of the scroll');
      }
      assert.deepEqual(errors(page), []);
    });
  }

  // finding glm 30 of round 2: the context menu of the image of a figure listed Edit Text, which
  // edits its caption, where the context menu of an image in Keynote does not have an item for text
  test(`the context menu of the picture of a figure has no Edit Text, and the caption is still edited (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    const img = '.reveal section.present figure.zone img:not([hidden])';
    await click(page, img, { button: 'right' });
    await frames(page);
    const labels = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item .label')].map((l) => l.textContent)`);
    assert.ok(labels.includes('Copy'), JSON.stringify(labels));
    assert.ok(!labels.includes('Edit Text'), `the context menu of the picture lists Edit Text: ${JSON.stringify(labels)}`);
    // Esc closes the menu. a click on the image selects it, and Esc selects its figure, on which
    // Return puts the caret into the caption
    await press(page, 'Escape');
    await frames(page);
    await click(page, img);
    await press(page, 'Escape');
    await frames(page);
    assert.equal(await page.evaluate(`window.BeesonEditor.selection().map((e) => e.localName).join()`), 'figure');
    await press(page, 'Enter');
    await frames(page);
    assert.equal(await page.evaluate(`document.activeElement?.closest('figcaption')?.textContent ?? null`), 'A caption under a zone.');
    await press(page, 'Escape');
    await press(page, 'Escape');
    // a click on the caption edits it too
    await click(page, '.reveal section.present figure.zone figcaption');
    await frames(page);
    assert.equal(await page.evaluate(`document.activeElement?.closest('figcaption')?.textContent ?? null`), 'A caption under a zone.');
    assert.deepEqual(errors(page), []);
  });
}
