// regression tests of R8.6 on both platforms with trusted input, for three gaps that R8.3 and R8.4
// left. a new formula is one entry of the history, Insert Formula, from the command to the close
// of its TeX field, and an empty or cancelled one leaves no entry. a block converted by the Text
// pane or the Format menu is selected again after an undo and after a redo. the element of every
// insert is kept off the empty placeholders of a new slide. after each edit the text is checked
// byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
// the slide of the layouts deck with a paragraph, a list, and a small paragraph
const TEXT = 2;
const P = '.reveal section.present > p:not(.small)';

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
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const meets = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

// the editor on slide n of a deck, the layouts by default, opened from its file without problems,
// with the Format tab shown
async function load(t, platform, n = TEXT, deck = LAYOUTS) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  // without this, headless Chrome cancels the file chooser, and the cancel races the file of choose
  await page.send('Page.setInterceptFileChooserDialog', { enabled: true });
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
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

// the labels of the first two items of the Edit menu, i.e. Undo and Redo, read from the menu
// opened with a click on the menu bar
async function editLabels(page) {
  await click(page, await page.evaluate(`(() => {
    const r = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === 'Edit').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`));
  await frames(page);
  const labels = await page.evaluate(`[...[...document.querySelectorAll('.beeson-edit-menu')].at(-1).querySelectorAll('.item .label')].slice(0, 2).map((l) => l.textContent)`);
  await press(page, 'Escape');
  await frames(page);
  return labels;
}

let saves = 0;
// the edited text, the text before byte for byte after one undo, the labels of the Edit menu
// before and after the undo, the edit again after one redo, checked further by redone, and an
// open of the saved text
async function oneEntry(page, label, redone = async () => {}) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  assert.deepEqual(await editLabels(page), [`Undo ${label}`, 'Redo']);
  await undo(page);
  await frames(page);
  await byteExact(page);
  assert.equal((await state(page, 'edit.undo')).enabled, false, `one undo does not take ${label} off`);
  assert.deepEqual(await editLabels(page), ['Undo', `Redo ${label}`]);
  await redo(page);
  await frames(page);
  assert.equal(await render(page), edited);
  await redone();
  assert.deepEqual(await editLabels(page), [`Undo ${label}`, 'Redo']);
  const { text } = await saveAndReopen(page, `r8-6-${++saves}.html`);
  assert.equal(text, edited);
  page.source = text;
  return edited;
}

const sheetOpen = (page) => page.waitFor(`!!document.querySelector('.beeson-math textarea') && document.activeElement === document.querySelector('.beeson-math textarea')`);
const sheetClosed = (page) => page.waitFor(`!document.querySelector('.beeson-math')`);
// the file as it was, with nothing to undo or redo
async function noEntry(page) {
  await sleep(300);
  await byteExact(page);
  assert.equal((await state(page, 'edit.undo')).enabled, false, 'the formula left an entry to undo');
  assert.equal((await state(page, 'edit.redo')).enabled, false, 'the formula left an entry to redo');
}
// a point of the canvas under the slide, where a click selects nothing
const outside = (page) => page.evaluate(`(() => { const r = document.querySelector('.reveal .slides').getBoundingClientRect(); return { x: r.left + 6, y: r.bottom + 12 }; })()`);

// the key of Insert > Formula, ⌥⌘E on a Mac and Alt+= elsewhere, the second of which press() of
// the helpers does not type
async function formulaKey(page, platform) {
  if (platform === 'mac') return press(page, 'Mod+Alt+E');
  const key = { key: '=', code: 'Equal', windowsVirtualKeyCode: 187, modifiers: 1 };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...key });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
}

// gap 1 of R8.6: Insert > Formula on a slide was two entries, the insert and its TeX
for (const platform of PLATFORMS) {
  test(`a new display formula is one entry Insert Formula up to its close with the commit key (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'insert.formula');
    await sheetOpen(page);
    await type(page, 'x^2 + y^2');
    await press(page, 'Mod+Enter');
    await sheetClosed(page);
    await frames(page);
    const edited = await oneEntry(page, 'Insert Formula', async () => {
      assert.deepEqual(await page.evaluate(`window.BeesonEditor.selection().map((e) => e.localName + '.' + e.classList[0])`), ['div.math'], 'the formula is not selected after the redo');
    });
    assert.match(edited, /<div class="math">\\\[x\^2 \+ y\^2\\\]<\/div>/);
    assert.deepEqual(errors(page), []);
  });

  test(`a new display formula closed with a click away keeps its TeX as one entry Insert Formula (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'insert.formula');
    await sheetOpen(page);
    await type(page, '\\alpha');
    await sleep(400);
    await click(page, await outside(page));
    await sheetClosed(page);
    await sleep(200);
    const edited = await oneEntry(page, 'Insert Formula');
    assert.match(edited, /<div class="math">\\\[\\alpha\\\]<\/div>/);
    assert.deepEqual(errors(page), []);
  });

  test(`a new display formula closed with Esc or left empty is taken off without an entry (${platform})`, async (t) => {
    const page = await load(t, platform);
    // Esc after a TeX is typed
    await exec(page, 'insert.formula');
    await sheetOpen(page);
    await type(page, 'x');
    await press(page, 'Escape');
    await sheetClosed(page);
    await noEntry(page);
    // a click away with the field empty
    await exec(page, 'insert.formula');
    await sheetOpen(page);
    await click(page, await outside(page));
    await sheetClosed(page);
    await noEntry(page);
    // the commit key with the field empty, which leaves the sheet open as Insert is dimmed
    await exec(page, 'insert.formula');
    await sheetOpen(page);
    await press(page, 'Mod+Enter');
    await sleep(300);
    if (await page.evaluate(`!!document.querySelector('.beeson-math')`)) await press(page, 'Escape');
    await sheetClosed(page);
    await noEntry(page);
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal section.present div.math').length`), 0);
    assert.deepEqual(errors(page), []);
  });

  test(`a new inline formula of Insert > Formula in a text is one entry, and none after Esc (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, P);
    await press(page, 'End');
    await frames(page);
    await formulaKey(page, platform);
    await sheetOpen(page);
    await press(page, 'Escape');
    await sheetClosed(page);
    await noEntry(page);
    await click(page, P);
    await press(page, 'End');
    await formulaKey(page, platform);
    await sheetOpen(page);
    await type(page, 'z');
    await press(page, 'Mod+Enter');
    await sheetClosed(page);
    await frames(page);
    // the entry is named for the inline formula, as its item of the Insert menu is
    const edited = await oneEntry(page, 'Insert Inline Formula');
    assert.match(edited, /<p>A paragraph with [^\n]*\\\(z\\\)[^\n]*<\/p>/);
    assert.deepEqual(errors(page), []);
  });
}

// the selection, each element as its tag, its style class, and its first words
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((e) => [e.localName, ...[...e.classList].filter((c) => ['small', 'caption', 'foot'].includes(c))].join('.') + ' ' + e.textContent.trim().slice(0, 18))`);

// gap 2 of R8.6: an undo and a redo dropped the selection of a list made with Dashes of the Text
// pane from a paragraph selected as a block. each conversion of the Text pane and of the Format
// menu is checked on the same paragraph, as [name, label of the entry, control, block made]. since
// R9.6, the entry of a list is named List Style and that of a paragraph style Paragraph Style
const CONVERSIONS = [
  ['Dashes of the Text pane', 'List Style', { pane: 'text.list.ul' }, 'ul'],
  ['Numbers of the Text pane', 'List Style', { pane: 'text.list.ol' }, 'ol'],
  ['Dashes of the Format menu', 'List Style', { exec: 'text.list.ul' }, 'ul'],
  ['Numbers of the Format menu', 'List Style', { exec: 'text.list.ol' }, 'ol'],
  ['Small of the Format menu', 'Paragraph Style', { exec: 'text.style.small' }, 'p.small'],
  ['Subheading of the Format menu', 'Paragraph Style', { exec: 'text.style.subheading' }, 'h3'],
  ['Caption of the Format menu', 'Paragraph Style', { exec: 'text.style.caption' }, 'p.caption'],
  ['Footnote of the Format menu', 'Paragraph Style', { exec: 'text.style.footnote' }, 'div.foot'],
  ['Smaller of the Text pane', 'Smaller', { pane: 'text.smaller' }, 'p.small'],
  ['Bigger of the Text pane', 'Bigger', { pane: 'text.bigger' }, 'h3'],
];
for (const platform of PLATFORMS) {
  for (const [name, label, how, tag] of CONVERSIONS) {
    test(`a paragraph made ${tag} with ${name} is selected after the command, an undo, and a redo (${platform})`, async (t) => {
      const page = await load(t, platform);
      await click(page, P);
      await press(page, 'Escape');
      await frames(page);
      const block = await selected(page);
      assert.deepEqual(block, ['p A paragraph with b']);
      if (how.pane) await click(page, `${PANEL} [data-command="${how.pane}"]`);
      else await exec(page, how.exec);
      await frames(page);
      const made = [`${tag} A paragraph with b`];
      assert.deepEqual(await selected(page), made, `the block made by ${label} is not selected`);
      assert.equal((await state(page, 'edit.undo')).label, `Undo ${label}`);
      const edited = await render(page);
      await undo(page);
      await frames(page);
      await byteExact(page);
      assert.deepEqual(await selected(page), block, `the paragraph is not selected after the undo of ${label}`);
      await redo(page);
      await frames(page);
      assert.equal(await render(page), edited);
      assert.deepEqual(await selected(page), made, `the block made by ${label} is not selected after the redo`);
      // the block selected again takes the next command, Paragraphs or Body
      await exec(page, tag === 'ul' || tag === 'ol' ? 'text.list.none' : 'text.style.body');
      await frames(page);
      assert.deepEqual(await selected(page), block, 'the block selected after the redo does not take the next command');
      const { text } = await saveAndReopen(page, `r8-6-${++saves}.html`);
      assert.equal(text, page.source);
      assert.deepEqual(errors(page), []);
    });
  }
}

// the box in slide px of the prompt of each empty block of the current slide that shows its
// placeholder, i.e. of the text of the placeholder as it is drawn
const promptBoxes = (page) => page.evaluate(`(() => {
  const slides = document.querySelector('.reveal .slides');
  const s = slides.getBoundingClientRect();
  const k = s.width / slides.offsetWidth;
  const ctx = document.createElement('canvas').getContext('2d');
  return [...document.querySelectorAll('.reveal section.present :is(h1, h2, h3, p)')].filter((el) => el.getClientRects().length && !['none', 'normal'].includes(getComputedStyle(el, '::before').content)).map((el) => {
    const before = getComputedStyle(el, '::before');
    ctx.font = before.font;
    const r = el.getBoundingClientRect();
    const left = (r.left - s.left) / k + parseFloat(getComputedStyle(el).paddingLeft);
    return { name: el.localName + (el.className ? '.' + el.classList[0] : ''), left, top: (r.top - s.top) / k, right: left + ctx.measureText(JSON.parse(before.content)).width, bottom: (r.bottom - s.top) / k };
  });
})()`);
// the box in slide px of the first shown element of selector
const slideRect = (page, selector) => page.evaluate(`(() => {
  const slides = document.querySelector('.reveal .slides');
  const s = slides.getBoundingClientRect();
  const k = s.width / slides.offsetWidth;
  const el = [...document.querySelectorAll(${js(selector)})].find((e) => e.getClientRects().length);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k };
})()`);

// the file chosen for an insert of a picture, given to the file chooser of the page
async function choose(page, id, file) {
  const chosen = exec(page, id);
  await page.waitFor(`!!document.querySelector('input.beeson-media-input')`);
  const { result } = await page.send('Runtime.evaluate', { expression: `document.querySelector('input.beeson-media-input')` });
  await page.send('DOM.setFileInputFiles', { files: [resolve(file)], objectId: result.objectId });
  await chosen;
}

// each insert as its name, its run on the current slide, and the selector of the element it makes
const NEW = '.reveal section.present';
const INSERTS = [
  ['a table', (page) => exec(page, 'insert.table', { rows: 3, columns: 3 }), `${NEW} table`],
  ['a QR code', (page) => exec(page, 'insert.qr'), `${NEW} .qr`],
  ['a text box', (page) => exec(page, 'insert.text'), `${NEW} .beeson-pending`],
  ['a code box', (page) => exec(page, 'insert.code'), `${NEW} pre.beeson-pending`],
  ['a formula', async (page) => {
    await exec(page, 'insert.formula');
    await sheetOpen(page);
    await type(page, 'x^2 + y^2 = r^2');
    await press(page, 'Mod+Enter');
    await sheetClosed(page);
  }, `${NEW} div.math`],
  ['an image', (page) => choose(page, 'insert.image', 'demo/figure-light.png'), `${NEW} img`],
  ['a video', (page) => choose(page, 'insert.video', 'demo/clip-dark.mp4'), `${NEW} video`],
];

// gap 3 of R8.6: an empty block that shows its placeholder counted as taken space for a new table
// only. each insert is run on a new slide of each layout with two placeholders, with nothing
// selected, and its element is kept off both placeholders and inside the slide
for (const platform of PLATFORMS) {
  for (const layout of ['content', 'split', 'figure']) {
    test(`every insert on a new ${layout} slide keeps its element off the two placeholders (${platform})`, async (t) => {
      const page = await load(t, platform, 0, 'index.html');
      for (const [what, run, selector] of INSERTS) {
        await exec(page, `slide.new.${layout}`);
        await frames(page);
        // the caret of the new slide is in its title, and the second Esc leaves its block
        await press(page, 'Escape');
        await press(page, 'Escape');
        await frames(page);
        const holders = await promptBoxes(page);
        assert.equal(holders.length, 2, `the new ${layout} slide does not show two placeholders`);
        await run(page);
        await sleep(300);
        await frames(page);
        const box = await slideRect(page, selector);
        assert.ok(box, `${what} is not on the new ${layout} slide`);
        for (const h of holders) assert.ok(!meets(box, h), `${what} at ${js(box)} is drawn over the placeholder ${h.name} at ${js(h)} of a new ${layout} slide`);
        assert.ok(box.left >= -0.5 && box.top >= -0.5 && box.right <= 1920.5 && box.bottom <= 1080.5, `${what} at ${js(box)} is not inside the new ${layout} slide`);
        await page.evaluate(`Reveal.slide(0)`);
        await frames(page);
      }
      assert.deepEqual(errors(page), []);
    });
  }
}
