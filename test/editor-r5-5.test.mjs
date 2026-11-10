// the fixes of R5.5 on both platforms: the space after a smart dash at the end of a paragraph, the
// Text pane live in an empty text, the switch Number the lines of the Code pane, the menu of the
// delivery of a list in the Steps tab, a list in the panel after a change of layout to Split, and
// typeset math in the outline view and in the running head of the Slide pane. each edit of the
// file is checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { substitution } from '../src/editor/text/substitute.ts';
import { byteExact, click, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const PARAGRAPH = '<p>A paragraph with <strong>bold</strong>, <em>italic</em>, <code>code</code>, and \\(x^2\\) inline.</p>';

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

let last = null;

// the editor on the slide at index of the deck of layouts, served over HTTP, with the Format tab
async function editor(platform, index = 2) {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.send('Page.bringToFront');
  await page.goto(`${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(LAYOUTS, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${index})`);
  await frames(page);
  return page;
}

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

// the characters of a US layout typed as trusted keys, each with its code and Shift
const KEYS = { '"': ['Quote', 222, 8], "'": ['Quote', 222, 0], '-': ['Minus', 189, 0], ' ': ['Space', 32, 0], '.': ['Period', 190, 0] };
async function typeKeys(page, text) {
  for (const c of text) {
    const [code, keyCode, mods] = KEYS[c] ?? [`Key${c.toUpperCase()}`, c.toUpperCase().charCodeAt(0), 0];
    const base = { key: c, code, windowsVirtualKeyCode: keyCode, modifiers: mods };
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: c, unmodifiedText: c });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }
}

// the caret put at the end of the first element at selector, with its block focused
const caretAtEnd = (page, selector) =>
  page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    el.closest('[contenteditable="true"]').focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    return true;
  })()`);

let saves = 0;
async function saved(page) {
  const { text } = await saveAndReopen(page, `r5-5-${++saves}.html`);
  page.source = text;
  await byteExact(page);
  return text;
}

// a trailing space typed at the end of a block is a no-break space in Chrome, and the en dash put
// for the hyphen must keep it, since a plain trailing space is dropped by the next character
test('an en dash keeps the space typed after it, whatever space the browser typed', () => {
  const on = { quotes: true, dashes: true };
  assert.deepEqual(substitution('done -', ' ', on), { remove: 2, insert: '– ' });
  assert.deepEqual(substitution('done -', ' ', on), { remove: 2, insert: '– ' });
  assert.deepEqual(substitution('done -', ' ', on), { remove: 2, insert: '– ' });
  assert.equal(substitution('done-', ' ', on), null);
});

for (const platform of PLATFORMS) {
  test(`a hyphen between spaces at the end of a paragraph becomes an en dash and keeps both spaces on ${platform}`, async () => {
    const page = await editor(platform);
    await caretAtEnd(page, '.reveal section.present > p');
    await typeKeys(page, ' "Halo" -- it\'s done - ok');
    const typed = PARAGRAPH.replace('inline.', 'inline. “Halo” — it’s done – ok');
    await byteExact(page, [[PARAGRAPH, typed]]);
    await saved(page);
    assert.deepEqual(errors(page), []);
  });
}

// the controls of the Text pane that are not dimmed
const liveControls = (page) =>
  page.evaluate(`[...document.querySelectorAll('#beeson-edit-panel-format .ed-panes button')].filter((b) => !b.disabled && !b.closest('.ed-tabs')).map((b) => b.title || b.getAttribute('aria-label') || b.textContent)`);

// the button of the Format tab with the title, clicked as a user would
async function tap(page, title) {
  const at = await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('#beeson-edit-panel-format button')].find((b) => (b.title || b.getAttribute('aria-label') || b.textContent) === ${JSON.stringify(title)});
    if (!b || b.disabled) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(at, `the Format tab does not have a live ${title}`);
  await click(page, at);
  await frames(page);
}

for (const platform of PLATFORMS) {
  test(`the Text pane is live in a new text box, and a format chosen before typing is typed on ${platform}`, async () => {
    const page = await editor(platform);
    await exec(page, 'insert.text');
    await frames(page);
    const live = await liveControls(page);
    for (const title of ['Bold', 'Italic', 'Accent', 'Paragraph Style']) assert.ok(live.includes(title), `${title} is dimmed in a new text box`);
    await tap(page, 'Bold');
    assert.equal((await state(page, 'text.bold')).checked, true);
    await tap(page, 'Accent');
    await typeKeys(page, 'Hi there');
    const text = await page.evaluate('window.BeesonEditor.render()');
    assert.ok(text.includes('<p><strong><span class="tone-accent">Hi there</span></strong></p>'), 'the new text is not bold and orange');
    // the box with its first character is one entry, and the typing after it another
    await undo(page);
    await undo(page);
    await byteExact(page);
    await redo(page);
    await redo(page);
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), text);
    await saved(page);
    assert.deepEqual(errors(page), []);
  });

  test(`a format chosen at the end of a footnote is typed after it on ${platform}`, async () => {
    const page = await editor(platform);
    const FOOT = '<div class="foot">A footnote of a content slide.</div>';
    await caretAtEnd(page, '.reveal section.present .foot');
    await frames(page);
    const live = await liveControls(page);
    for (const title of ['Bold', 'Italic', 'Strikethrough', 'Paragraph Style']) assert.ok(live.includes(title), `${title} is dimmed in a footnote`);
    await tap(page, 'Italic');
    await typeKeys(page, ' ok');
    const edits = [[FOOT, '<div class="foot">A footnote of a content slide. <em>ok</em></div>']];
    await byteExact(page, edits);
    await undo(page);
    await byteExact(page);
    await redo(page);
    await byteExact(page, edits);
    await saved(page);
  });

  test(`the size of a code box is live in the Text pane, and the formats it cannot hold are dimmed on ${platform}`, async () => {
    const page = await editor(platform, 5);
    const PRE = '<pre><code class="language-python" data-line-numbers="1|2">';
    await caretAtEnd(page, '.reveal section.present pre code');
    await frames(page);
    await page.evaluate(`document.querySelector('#beeson-edit-panel-format .ed-tabs [role=tab]:nth-child(2)')?.click()`);
    await frames(page);
    const live = await liveControls(page);
    assert.ok(live.includes('Smaller'), 'the size of a code box is dimmed');
    assert.ok(!live.includes('Bold') && !live.includes('Accent'), 'a format that a code box cannot hold is live');
    await tap(page, 'Smaller');
    const edits = [[PRE, PRE.replace('<pre>', '<pre style="font-size: 18px">')]];
    await byteExact(page, edits);
    assert.equal((await state(page, 'text.smaller')).enabled, false);
    assert.equal((await state(page, 'text.bigger')).enabled, true);
    await undo(page);
    await byteExact(page);
    await redo(page);
    await byteExact(page, edits);
    await saved(page);
  });
}

for (const platform of PLATFORMS) {
  test(`a paragraph style and a list chosen in a new text box, and the size in a new code box, are typed on ${platform}`, async () => {
    const page = await editor(platform);
    await exec(page, 'insert.text');
    await frames(page);
    await exec(page, 'text.list.ul');
    assert.equal((await state(page, 'text.list.ul')).checked, true);
    await typeKeys(page, 'Item');
    assert.ok((await page.evaluate('window.BeesonEditor.render()')).includes('<li>Item</li>'), 'the new text is not a list item');
    const page2 = await editor(platform);
    await exec(page2, 'insert.text');
    await frames(page2);
    await exec(page2, 'text.style.subheading');
    await typeKeys(page2, 'Sub');
    assert.ok((await page2.evaluate('window.BeesonEditor.render()')).includes('<h3>Sub</h3>'), 'the new text is not a subheading');
    const page3 = await editor(platform, 5);
    await exec(page3, 'insert.code');
    await frames(page3);
    assert.equal((await state(page3, 'text.bold')).enabled, false);
    await exec(page3, 'text.smaller');
    await typeKeys(page3, 'x');
    const text = await page3.evaluate('window.BeesonEditor.render()');
    assert.ok(text.includes('<pre style="font-size: 18px"><code class="language-python">x</code></pre>'), 'the new code box is not small');
    await undo(page3);
    await byteExact(page3);
    await saved(page3);
    assert.deepEqual(errors(page3), []);
  });
}

// the numbers drawn at the left of the code box of the slide, and the gap between the left edge
// of the box and its first character, in CSS pixels
const drawnNumbers = (page) =>
  page.evaluate(`(() => {
    const pre = document.querySelector('.reveal section.present pre');
    const content = getComputedStyle(pre, '::before').content;
    const r = document.createRange();
    r.setStart(pre.querySelector('code').firstChild, 0);
    r.setEnd(pre.querySelector('code').firstChild, 1);
    return { numbers: content === 'none' ? '' : JSON.parse(content.replace(/\\\\a /g, '\\\\n')), indent: r.getBoundingClientRect().left - pre.getBoundingClientRect().left };
  })()`);

for (const platform of PLATFORMS) {
  test(`a code box is drawn with numbered lines while Number the lines is on, and the switch numbers them on ${platform}`, async () => {
    const page = await editor(platform, 5);
    await caretAtEnd(page, '.reveal section.present pre code');
    await frames(page);
    assert.equal((await state(page, 'code.numbers')).checked, true);
    const numbered = await drawnNumbers(page);
    assert.equal(numbered.numbers, '1\n2', 'the lines of the code box are not numbered on the canvas');
    // a new code box is drawn without numbers until the switch is turned on
    await exec(page, 'insert.code');
    await frames(page);
    await type(page, 'x\ny');
    await frames(page);
    const pre = '<pre><code class="language-python">x\ny</code></pre>';
    const before = await page.evaluate('window.BeesonEditor.render()');
    assert.ok(before.includes(pre), before.match(/<pre>.*\n?.*<\/pre>/g)?.join(" ; "));
    await page.evaluate(`(() => { const c = [...document.querySelectorAll('.reveal section.present pre code')].pop(); const r = document.createRange(); r.selectNodeContents(c); r.collapse(false); c.closest('[contenteditable="true"]').focus(); getSelection().removeAllRanges(); getSelection().addRange(r); })()`);
    await frames(page);
    assert.equal((await state(page, 'code.numbers')).checked, false);
    const plain = await page.evaluate(`getComputedStyle([...document.querySelectorAll('.reveal section.present pre')].pop(), '::before').content`);
    assert.ok(plain === 'none' || plain === 'normal', 'a code box without data-line-numbers is drawn with numbers');
    await exec(page, 'code.numbers');
    await frames(page);
    const after = await page.evaluate('window.BeesonEditor.render()');
    assert.equal(after, before.replace(pre, '<pre><code class="language-python" data-line-numbers>x\ny</code></pre>'));
    const content = await page.evaluate(`getComputedStyle([...document.querySelectorAll('.reveal section.present pre')].pop(), '::before').content`);
    assert.ok(content.includes('1') && content.includes('2'), 'the switch does not number the lines of the box on the canvas');
    assert.equal((await state(page, 'code.numbers')).checked, true);
    await undo(page);
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), before);
    await redo(page);
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), after);
    await saved(page);
    assert.deepEqual(errors(page), []);
  });
}

// the editor on the demo deck at a size of the window, with the Steps tab shown on the slide of a
// list delivered item by item
async function stepsPage(platform, width, height) {
  await last?.close().catch(() => {});
  const page = await browser.newPage({ width, height });
  last = page;
  await page.goto(`${server.origin}/index.html?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('index.html', 'utf8');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`)).problems, []);
  await exec(page, 'view.steps');
  await page.evaluate(`Reveal.slide(Reveal.getIndices(document.querySelector('li.fragment').closest('section')).h)`);
  await page.evaluate('new Promise((d) => setTimeout(d, 150))');
  return page;
}

for (const platform of PLATFORMS) {
  for (const [width, height] of [[1600, 1000], [1920, 1080], [1280, 800]]) {
    test(`the menu of the delivery of a list leaves every row of the Steps tab visible at ${width} by ${height} on ${platform}`, async () => {
      const page = await stepsPage(platform, width, height);
      const chip = await page.evaluate(`(() => { const r = document.querySelector('.beeson-edit-side .list-head .chip').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      await click(page, chip);
      await page.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
      const { menu, covered } = await page.evaluate(`(() => {
        const box = (el) => el.getBoundingClientRect();
        const m = box(document.querySelector('.beeson-edit-menu'));
        const rows = [...document.querySelectorAll('.beeson-edit-side .list-head, .beeson-edit-side .rows .row')].filter((r) => box(r).height);
        const hit = (r) => r.left < m.right && m.left < r.right && r.top < m.bottom && m.top < r.bottom;
        return { menu: { left: m.left, top: m.top, right: m.right, bottom: m.bottom }, covered: rows.filter((r) => hit(box(r))).map((r) => r.textContent.slice(0, 30)) };
      })()`);
      assert.deepEqual(covered, [], 'the menu is drawn over rows of the Steps tab');
      assert.ok(menu.left >= 0 && menu.top >= 0 && menu.right <= width && menu.bottom <= height, 'the menu runs out of the window');
      // the menu is level with the head row, at its side
      const head = await page.evaluate(`(() => { const r = document.querySelector('.beeson-edit-side .list-head').getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; })()`);
      assert.ok(menu.top <= head.bottom && menu.bottom >= head.top, 'the menu is not level with its row');
      await press(page, 'Escape');
      assert.deepEqual(errors(page), []);
    });
  }
}
