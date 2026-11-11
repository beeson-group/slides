// regression tests of R11.2 on both platforms with trusted input: Return on an empty item in the
// middle of a list, Bigger, Smaller, and the paragraph style on several blocks, Shift+click and the
// column of the caret across the items of a list, and the delay of several steps. after each edit
// the text is checked byte for byte after an undo, the edit again after a redo, and after a save
// and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen, type } from './helpers/editor.mjs';

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
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
const exec = (page, id, arg = '') => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg ? `, ${arg}` : ''})`);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let saves = 0;

// the editor on slide n of the demo deck, counted from 0, served over HTTP
async function load(t, platform, n = 4) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/index.html?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('index.html', 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks the text in page.source byte for byte after undos undos, the edit after as many
// redos, and an open of the saved edit without problems, whose text becomes page.source
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  for (let i = 0; i < undos; i++) await undo(page);
  await byteExact(page);
  for (let i = 0; i < undos; i++) await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r11-2-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

// the shown element of selector that holds needle, as an expression
const find = (selector, needle = '') => `[...document.querySelectorAll(${js(selector)})].find((el) => el.getBoundingClientRect().width && el.textContent.includes(${js(needle)}))`;

// the client point of the character at offset k of needle, 2 px inside its left edge with edge,
// else at its center
const pointOf = (page, selector, needle, k = 0, edge = false) => page.evaluate(`(() => {
  const el = ${find(selector, needle)};
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const i = n.data.indexOf(${js(needle)});
    if (i < 0) continue;
    const r = document.createRange();
    r.setStart(n, i + ${k});
    r.setEnd(n, i + ${k} + 1);
    const b = r.getBoundingClientRect();
    return { x: ${edge} ? b.left + 2 : b.left + b.width / 2, y: b.top + b.height / 2 };
  }
})()`);

// the caret put after k characters of needle, in the text node that holds it
const caretAt = (page, selector, needle, k) => page.evaluate(`(() => {
  const el = ${find(selector, needle)};
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const i = n.data.indexOf(${js(needle)});
    if (i >= 0) return void getSelection().collapse(n, i + ${k});
  }
})()`);

const ITEM = '.reveal section.present ul > li, .reveal section.present ol > li';
const PARA = '.reveal section.present > p';
const ITEMS = [
  '<li class="fragment" data-fragment-index="1">Dark and light mode: export one file per mode, mark them <code>for-dark</code> and <code>for-light</code>.</li>',
  '<li class="fragment" data-fragment-index="2">You might have noticed a toggle on the top right: try clicking it on this slide.</li>',
  '<li class="fragment" data-fragment-index="3">You should give black-on-white plots the class <code>invert</code> to invert them in dark mode.</li>',
];
const SMALL_ITEMS = ITEMS.map((li) => li.replace('<li class="fragment"', '<li class="fragment small"'));

// the caret put at the end of the text of item i of the lists of the slide, counted in page order
const caretAtEnd = (page, i) => page.evaluate(`(() => {
  const li = document.querySelectorAll(${js(ITEM)})[${i}];
  const w = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
  let last = null;
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.data.trim()) last = n;
  li.closest('[contenteditable="true"]').focus();
  getSelection().collapse(last, last.length);
})()`);

// the tag and the text of the editing host of the caret
const caretBlock = (page) => page.evaluate(`(() => {
  const n = getSelection().focusNode;
  const host = (n.nodeType === 1 ? n : n.parentElement).closest('[contenteditable="true"]');
  return host ? { tag: host.localName, text: host.textContent.trim() } : null;
})()`);

// the line of the file that holds the start of the text head
const line = (text, head) => text.split('\n').find((l) => l.includes(`>${head}`))?.trim();

// difference 1 of R11.2: Return on an empty item in the middle of a list of the first level added
// one more empty item. in Keynote and PowerPoint it takes the bullet off the line, which becomes a
// paragraph between the items before it and the items after it
for (const platform of PLATFORMS) {
  for (const kind of ['ul', 'ol']) {
    test(`Return on an empty item in the middle of a list of kind ${kind} cuts the list at a new paragraph (${platform})`, async (t) => {
      const page = await load(t, platform);
      await click(page, await pointOf(page, ITEM, 'Dark and light', 2));
      if (kind === 'ol') {
        await exec(page, 'text.list.ol');
        page.source = await render(page);
      }
      const open = `<${kind} style="translate: 0px 20px">`;
      // the second part of a numbered list goes on with its count
      const second = kind === 'ol' ? open.replace('>', ' start="2">') : open;
      assert.ok(page.source.includes(open));
      await caretAtEnd(page, 0);
      await press(page, 'Enter');
      const added = await render(page);
      assert.ok(added.includes('<li class="fragment" data-fragment-index="1"></li>'), 'Return at the end of an item does not add an empty item');
      page.source = added;
      await press(page, 'Enter');
      const cut = await render(page);
      const shape = new RegExp(`${escape(ITEMS[0])}\\n  </${kind}>\\n  <p style="translate: 0px 20px"></p>\\n  ${escape(second)}\\n    ${escape(ITEMS[1])}\\n    ${escape(ITEMS[2])}\\n  </${kind}>`);
      assert.match(cut, shape, `the list is not cut at a paragraph: ${cut.match(/for-light<\/code>\.[\s\S]{0,220}/)?.[0]}`);
      assert.equal(await undoLabel(page), 'Undo New Paragraph');
      assert.deepEqual(await caretBlock(page), { tag: 'p', text: '' }, 'the caret is not in the new paragraph');
      await type(page, 'Z');
      const typed = await render(page);
      assert.ok(typed.includes(`</${kind}>\n  <p style="translate: 0px 20px">Z</p>\n  ${second}`), 'the typed text is not in the new paragraph');
      await undo(page);
      assert.equal(await render(page), cut);
      await undo(page);
      assert.equal(await render(page), added, 'the cut of the list is not one entry of the history');
      await redo(page);
      assert.equal(await render(page), cut);
      await redo(page);
      assert.equal(await render(page), typed);
      const { text } = await saveAndReopen(page, `r11-2-${++saves}.html`);
      assert.equal(text, typed);
      assert.deepEqual(errors(page), []);
    });
  }

  // an empty first item is taken off its list, which then starts at the item after it
  test(`Return on an empty first item of a list makes it a paragraph before the list (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await pointOf(page, ITEM, 'Dark and light', 2));
    await caretAt(page, ITEM, 'Dark and light', 0);
    await press(page, 'Enter');
    page.source = await render(page);
    await page.evaluate(`(() => { const li = document.querySelectorAll(${js(ITEM)})[0]; li.focus(); getSelection().collapse(li, 0); })()`);
    await press(page, 'Enter');
    const cut = await render(page);
    assert.ok(cut.includes(`<p></p>\n  <ul style="translate: 0px 20px">\n    ${ITEMS[0]}`), `the empty first item is not a paragraph before the list: ${cut.match(/frameless\.<\/p>[\s\S]{0,160}/)?.[0]}`);
    assert.deepEqual(await caretBlock(page), { tag: 'p', text: '' });
    await roundTrip(page);
  });

  // R9.6 moves an empty nested item out one level at the end of its list. in the middle of a list
  // it does the same, and the items after it go into a list at its end, as with Shift+Tab
  test(`Return on an empty nested item in the middle of its list moves it out one level (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await pointOf(page, ITEM, 'toggle', 2));
    await press(page, 'Tab');
    await caretAt(page, ITEM, 'You should', 2);
    await press(page, 'Tab');
    await caretAtEnd(page, 1);
    await press(page, 'Enter');
    const added = await render(page);
    assert.match(added, /this slide\.<\/li>\s*<li class="fragment" data-fragment-index="2"><\/li>\s*<li class="fragment" data-fragment-index="3">You should/, 'the empty item is not added between the two nested items');
    page.source = added;
    await press(page, 'Enter');
    const out = await render(page);
    assert.match(out, /for-light<\/code>\.\s*<ul>\s*<li class="fragment" data-fragment-index="2">You might[^\n]*<\/li>\s*<\/ul>\s*<\/li>\s*<li class="fragment" data-fragment-index="2">\s*<ul>\s*<li class="fragment" data-fragment-index="3">You should/, `the empty item is not moved out one level: ${out.match(/for-light<\/code>\.[\s\S]{0,300}/)?.[0]}`);
    assert.equal(await undoLabel(page), 'Undo New Paragraph');
    // the caret is in the outdented item. this item does not have a text of its own before its
    // nested list, hence the browser puts the caret at the start of the nested list
    assert.equal(await page.evaluate(`(() => { const n = getSelection().focusNode; const li = (n.nodeType === 1 ? n : n.parentElement).closest('[contenteditable="true"]'); return li.localName === 'li' && li.textContent.trim().startsWith('You should') && !li.parentElement.closest('li'); })()`), true, 'the caret is not in the outdented item');
    await roundTrip(page);
  });
}

// the trusted key Mod+Shift with key on a US layout, which press() does not know
async function modShift(page, platform, key, code, keyCode) {
  const base = { key, code, windowsVirtualKeyCode: keyCode, modifiers: (platform === 'mac' ? 4 : 2) | 8 };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}
const SMALLER = ['<', 'Comma', 188];
const BIGGER = ['>', 'Period', 190];

// the paragraph and the list of slide 5 selected as objects, by a click, Esc, and a Shift+click
async function selectBoth(page) {
  await click(page, await pointOf(page, PARA, 'figure', 2));
  await press(page, 'Escape');
  await frames(page);
  await click(page, await pointOf(page, ITEM, 'toggle', 2), { modifiers: 'Shift' });
  await frames(page);
}

// difference 2 of R11.2: Bigger, Smaller, and the paragraph style on several selected blocks and
// on a text selected over several items acted on one block
for (const platform of PLATFORMS) {
  test(`Smaller and Bigger on a paragraph and a list selected as objects act on every block, as one entry each (${platform})`, async (t) => {
    const page = await load(t, platform);
    await selectBoth(page);
    await modShift(page, platform, ...SMALLER);
    await frames(page);
    const text = await render(page);
    assert.ok(text.includes('<p class="small">Export your matplotlib figure'), 'Smaller does not set Small on the paragraph');
    for (const li of SMALL_ITEMS) assert.ok(text.includes(li), `Smaller does not set Small on ${li.slice(0, 70)}`);
    await roundTrip(page);
    await selectBoth(page);
    await modShift(page, platform, ...BIGGER);
    await frames(page);
    assert.equal(await render(page), readFileSync('index.html', 'utf8'), 'Bigger does not set Body on every block');
    await undo(page);
    assert.equal(await render(page), page.source);
  });

  test(`a paragraph style of the Text pane on a paragraph and a list selected as objects acts on every block (${platform})`, async (t) => {
    const page = await load(t, platform);
    await selectBoth(page);
    await exec(page, 'text.style.small');
    await frames(page);
    const text = await render(page);
    assert.ok(text.includes('<p class="small">Export your matplotlib figure'), 'Small is not set on the paragraph');
    for (const li of SMALL_ITEMS) assert.ok(text.includes(li), `Small is not set on ${li.slice(0, 70)}`);
    assert.equal(await undoLabel(page), 'Undo Paragraph Style');
    await roundTrip(page);
  });

  for (const [name, how] of [['Smaller', 'key'], ['Small', 'pane']]) {
    test(`${name} on a text selected over two items acts on both items and keeps the selection (${platform})`, async (t) => {
      const page = await load(t, platform);
      await click(page, await pointOf(page, ITEM, 'toggle', 2));
      await caretAt(page, ITEM, 'slide.', 2);
      for (let i = 0; i < 8; i++) await press(page, 'Shift+ArrowRight');
      if (how === 'key') await modShift(page, platform, ...SMALLER);
      else await exec(page, 'text.style.small');
      await frames(page);
      const text = await render(page);
      assert.equal(line(text, 'Dark and'), ITEMS[0], 'the item before the selection is changed');
      assert.equal(line(text, 'You might'), SMALL_ITEMS[1], 'the first item of the selection is not Small');
      assert.equal(line(text, 'You should'), SMALL_ITEMS[2], 'the last item of the selection is not Small');
      // Backspace deletes the same selection over the two items after the change
      await press(page, 'Backspace');
      assert.equal(line(await render(page), 'You might'), SMALL_ITEMS[1].replace('slide.</li>', 'sl should give black-on-white plots the class <code>invert</code> to invert them in dark mode.</li>'), 'the selection over the two items is not kept');
      await undo(page);
      await roundTrip(page);
    });
  }

  for (const [from, to, way] of [['toggle', 'plots', 'forward'], ['plots', 'toggle', 'backward']]) {
    test(`a Shift+click in another item extends the selection from the caret across the items, ${way} (${platform})`, async (t) => {
      const page = await load(t, platform);
      await click(page, await pointOf(page, ITEM, from, 2));
      await caretAt(page, ITEM, from, 0);
      await click(page, await pointOf(page, ITEM, to, 0, true), { modifiers: 'Shift' });
      await frames(page);
      await type(page, 'Z');
      const text = await render(page);
      assert.equal(line(text, 'You might'), '<li class="fragment" data-fragment-index="2">You might have noticed a Zplots the class <code>invert</code> to invert them in dark mode.</li>', `the Shift+click does not extend the selection: ${line(text, 'You might')}`);
      assert.equal(line(text, 'You should'), undefined);
      await roundTrip(page);
    });
  }
}

// the left of the caret in the window, in CSS pixels
const caretX = (page) => page.evaluate(`(() => {
  const r = getSelection().getRangeAt(0).cloneRange();
  const box = r.getClientRects()[0] ?? r.getBoundingClientRect();
  return box.left;
})()`);

// the caret put at the client x on the last or the first line of item i
const caretOnLine = (page, i, x, last) => page.evaluate(`(() => {
  const li = document.querySelectorAll(${js(ITEM)})[${i}];
  const r = document.createRange();
  r.selectNodeContents(li);
  const lines = [...r.getClientRects()].filter((b) => b.height > 0);
  const y = ${last} ? Math.max(...lines.map((b) => b.bottom)) - 6 : Math.min(...lines.map((b) => b.top)) + 6;
  const p = document.caretPositionFromPoint ? document.caretPositionFromPoint(${x}, y) : null;
  const q = p ? [p.offsetNode, p.offset] : (() => { const c = document.caretRangeFromPoint(${x}, y); return [c.startContainer, c.startOffset]; })();
  li.closest('[contenteditable="true"]').focus();
  getSelection().collapse(...q);
})()`);

// the right of the last line and of the first line of item i, in CSS pixels
const lineEnds = (page, i) => page.evaluate(`(() => {
  const li = document.querySelectorAll(${js(ITEM)})[${i}];
  const r = document.createRange();
  r.selectNodeContents(li);
  const lines = [...r.getClientRects()].filter((b) => b.height > 0 && b.width > 0);
  const bottom = Math.max(...lines.map((b) => b.bottom));
  const top = Math.min(...lines.map((b) => b.top));
  return { last: Math.max(...lines.filter((b) => b.bottom > bottom - 4).map((b) => b.right)), first: Math.max(...lines.filter((b) => b.top < top + 4).map((b) => b.right)) };
})()`);

// the caret keeps its column over a short item between two long ones: the short item takes the
// caret to its end, and the next arrow puts the caret back in its column, as in a text editor
for (const platform of PLATFORMS) {
  test(`ArrowDown and ArrowUp keep the column of the caret across a short item (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await pointOf(page, ITEM, 'Dark and light', 2));
    await caretAtEnd(page, 0);
    await press(page, 'Enter');
    await type(page, 'ab');
    const one = await lineEnds(page, 0);
    const three = await lineEnds(page, 2);
    const short = await lineEnds(page, 1);
    const x = Math.min(one.last, three.first) - 40;
    assert.ok(x > short.last + 60, `the column at ${x} is not right of the short item, which ends at ${short.last}`);
    await caretOnLine(page, 0, x, true);
    const x0 = await caretX(page);
    await press(page, 'ArrowDown');
    assert.equal((await caretBlock(page)).text, 'ab');
    await press(page, 'ArrowDown');
    assert.match((await caretBlock(page)).text, /^You might/);
    const x1 = await caretX(page);
    assert.ok(Math.abs(x1 - x0) < 20, `ArrowDown puts the caret at x ${x1}, away from its column at ${x0}`);
    await press(page, 'ArrowUp');
    assert.equal((await caretBlock(page)).text, 'ab');
    await press(page, 'ArrowUp');
    assert.match((await caretBlock(page)).text, /^Dark and light/);
    const x2 = await caretX(page);
    assert.ok(Math.abs(x2 - x0) < 20, `ArrowUp puts the caret at x ${x2}, away from its column at ${x0}`);
    // a caret moved by ArrowLeft takes a new column
    await press(page, 'ArrowLeft');
    await press(page, 'ArrowLeft');
    const x3 = await caretX(page);
    await press(page, 'ArrowDown');
    await press(page, 'ArrowDown');
    const x4 = await caretX(page);
    assert.ok(Math.abs(x4 - x3) < 20, `after ArrowLeft, ArrowDown puts the caret at x ${x4}, away from its new column at ${x3}`);
    assert.deepEqual(errors(page), []);
  });
}

// difference 3 of R11.2: with several rows of the Steps list selected, a delay typed into the field
// was written only into the first row
const ROW = (text) => `[...document.querySelectorAll('.beeson-edit-side .rows .row')].find((r) => r.querySelector('.text').textContent.startsWith(${js(text)}))`;
const pointIn = (page, el, fx = 0.5) => page.evaluate(`(() => { const el = ${el}; el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width * ${fx}, y: r.top + r.height / 2 }; })()`);
const openSteps = async (page) => {
  if (!(await page.evaluate(`window.BeesonEditor.state('view.steps').checked`))) await page.evaluate(`window.BeesonEditor.exec('view.steps')`);
  await frames(page);
};
const DELAY = '.beeson-edit-side input.delay';
const LI = (k) => `document.querySelectorAll('.reveal section.present ul > li')[${k}]`;
const field = (page) => page.evaluate(`(() => { const f = document.querySelector(${js(DELAY)}); return { value: f.value, placeholder: f.placeholder, disabled: f.disabled }; })()`);
const [TWO, LAST] = ['Two elements wi', 'When exporting '];

for (const platform of PLATFORMS) {
  test(`a delay typed with several rows selected is written into each row, as one entry, and a mixed delay shows Multiple (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await openSteps(page);
    // the second and the third item of the slide start after the step before, at 1 s and 2 s
    await exec(page, 'steps.start', `{ start: 'after', el: ${LI(1)} }`);
    await exec(page, 'steps.start', `{ start: 'after', el: ${LI(2)} }`);
    await exec(page, 'steps.delay', `{ delay: 1, el: ${LI(1)} }`);
    await exec(page, 'steps.delay', `{ delay: 2, el: ${LI(2)} }`);
    page.source = await render(page);
    assert.ok(page.source.includes('data-fragment-index="1" data-autoslide="1000"') && page.source.includes('data-fragment-index="2" data-autoslide="2000"'), 'the delays are not set up');
    await click(page, await pointIn(page, ROW(TWO), 0.7));
    await click(page, await pointIn(page, ROW(LAST), 0.7), { modifiers: 'Shift' });
    await frames(page);
    const mixed = await field(page);
    await click(page, DELAY);
    await page.evaluate(`document.querySelector(${js(DELAY)}).select()`);
    await type(page, '3');
    await press(page, 'Enter');
    await frames(page);
    const text = await render(page);
    assert.ok(text.includes('data-fragment-index="1" data-autoslide="3000"'), 'the delay is not written into the first selected row');
    assert.ok(text.includes('data-fragment-index="2" data-autoslide="3000"'), 'the delay is not written into the second selected row');
    assert.deepEqual(mixed, { value: '', placeholder: 'Multiple', disabled: false }, 'the field does not show a mixed delay');
    assert.deepEqual(await field(page), { value: '3', placeholder: '', disabled: false });
    await roundTrip(page);
  });
}
