// regression tests of R15.13 on both platforms with trusted input: the caret kept in a text after
// an undo or a redo of Return, and after an undo of typing in another item of the same list, the
// toolbar button Undo with a value typed into a field of the inspector, a paste of lines whose
// first line is blank into a list item, the start of a cut-off list after a change of the list
// before it, and the shown number entered into Start at. each edit is undone to the file byte for
// byte

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { center, click, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const LISTS = 'test/pages/editor-r13-3.html';

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
const wait = (page, ms = 300) => page.evaluate(`new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), ${ms}))`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const labels = async (page) => [(await state(page, 'edit.undo')).label, (await state(page, 'edit.redo')).label];
let saves = 0;

async function load(t, platform, deck, slide) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${slide})`);
  await wait(page);
  return page;
}

const SLIDE = '.reveal .slides section.present';
const find = (needle) => `[...document.querySelectorAll('${SLIDE} p, ${SLIDE} li')].find((el) => el.getBoundingClientRect().width && el.textContent.includes(${js(needle)}))`;

// the middle of the first line of the text that holds needle on the current slide
const pointOf = (page, needle) => page.evaluate(`(() => {
  const r = ${find(needle)}.getClientRects()[0];
  return { x: r.left + Math.min(r.width / 2, 80), y: r.top + r.height / 2 };
})()`);

// the selected elements by their tag, and whether the focus is in a text of the slide
const selected = (page) => page.evaluate(`(() => {
  const el = document.activeElement;
  return { els: window.BeesonEditor.selection().map((e) => e.localName), caret: !!el && !!el.closest('.reveal .slides') && el.isContentEditable };
})()`);

// one trusted key press of a lowercase letter with its text, as a keyboard types it
async function key(page, ch) {
  const base = { key: ch, code: `Key${ch.toUpperCase()}`, windowsVirtualKeyCode: ch.toUpperCase().charCodeAt(0), modifiers: 0 };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: ch, unmodifiedText: ch });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await wait(page);
}

// the key ch, typed after the file is base, must add one character to base inside the part of base
// that is the text needle
async function typedIn(page, base, needle, ch) {
  await key(page, ch);
  const text = await render(page);
  assert.equal(text.length, base.length + 1, `the key ${ch} is not typed`);
  let i = 0;
  while (text[i] === base[i]) i++;
  assert.equal(text[i], ch);
  assert.equal(text.slice(0, i) + text.slice(i + 1), base);
  const at = base.indexOf(needle);
  assert.ok(i >= at && i <= at + needle.length, `the key ${ch} is not typed into the text of ${needle}`);
}

const DESIGN = "Design the complete slide first, then break it up into steps. Direct the viewer's attention.";
const SAME = 'Two elements with the same index are shown together.';

for (const platform of PLATFORMS) {
  // F8: the undo of Return took the caret out of the text and selected the block
  for (const [where, needle] of [['a paragraph', DESIGN], ['a list item', SAME]]) {
    test(`after an undo and a redo of Return in ${where}, the caret stays in the text (${platform})`, async (t) => {
      const page = await load(t, platform, 'test-deck.html', 2);
      await click(page, await pointOf(page, needle));
      await caretIn(page, needle);
      await press(page, 'Enter');
      await wait(page);
      const split = await render(page);
      assert.notEqual(split, page.source, 'Return does not change the file');
      await press(page, 'Mod+Z');
      await wait(page);
      assert.equal(await render(page), page.source);
      assert.deepEqual(await selected(page), { els: [], caret: true }, 'the caret is not in the text after the undo');
      await press(page, 'Mod+Shift+Z');
      await wait(page);
      assert.equal(await render(page), split);
      assert.deepEqual(await selected(page), { els: [], caret: true }, 'the caret is not in the text after the redo');
      await press(page, 'Mod+Z');
      await wait(page);
      await typedIn(page, page.source, needle, 'q');
      assert.deepEqual(errors(page), []);
    });
  }

  // F9: the caret in another item of the same list counted as a caret outside the list
  test(`an undo of typing in one item of a list keeps the caret in the list when it is in another item (${platform})`, async (t) => {
    const page = await load(t, platform, 'test-deck.html', 2);
    await click(page, await pointOf(page, SAME));
    await caretIn(page, SAME);
    await type(page, ' XY');
    await wait(page, 1200);
    assert.ok((await render(page)).includes(`${SAME} XY</li>`));
    await click(page, await pointOf(page, 'When exporting'));
    await wait(page);
    await press(page, 'Mod+Z');
    await wait(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(await selected(page), { els: [], caret: true }, 'the caret is not in the list after the undo');
    const at = page.source.indexOf('<li class="fragment" data-fragment-index="1">Each step');
    await typedIn(page, page.source, page.source.slice(at, page.source.indexOf('</ul>', at)), 'q');
    assert.deepEqual(errors(page), []);
  });
}

const X = '#beeson-edit-num-x';

for (const platform of PLATFORMS) {
  // F10: the button undid the entry before the typed value, which Tab then entered over the redo
  test(`the toolbar button Undo enters a value typed into a field of the inspector, then undoes it (${platform})`, async (t) => {
    const page = await load(t, platform, 'test-deck.html', 4);
    await click(page, await center(page, `${SLIDE} figure.zone img.for-dark`));
    await press(page, 'ArrowRight');
    await wait(page, 1100);
    const moved = await render(page);
    assert.notEqual(moved, page.source);
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await wait(page);
    await exec(page, 'arrange.sizeAndPosition');
    await wait(page);
    await click(page, await center(page, X));
    await page.evaluate(`document.querySelector(${js(X)}).select()`);
    await type(page, '300');
    await wait(page);
    await click(page, await center(page, '[data-command="edit.undo"]'));
    await wait(page, 500);
    assert.equal(await render(page), moved, 'the toolbar Undo does not undo the typed value alone');
    assert.deepEqual(await labels(page), ['Undo Move', 'Redo Position']);
    // the field keeps the focus after the typed value is entered and undone, as in Keynote (N32 of R17.6)
    assert.equal(await page.evaluate(`document.activeElement === document.querySelector(${js(X)})`), true, 'the field does not keep the focus');
    await press(page, 'Tab');
    await wait(page, 500);
    assert.equal(await render(page), moved, 'Tab enters a value after the undo');
    assert.deepEqual(await labels(page), ['Undo Move', 'Redo Position']);
    await undo(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}

// the caret put at the end of the item of the deck of lists that holds needle, or with all true
// its text selected
const caretIn = (page, needle, all = false) => page.evaluate(`(() => {
  const li = ${find(needle)};
  const n = [...li.childNodes].find((c) => c.nodeType === 3 && c.data.trim());
  li.closest('[contenteditable="true"]').focus();
  if (${all}) getSelection().setBaseAndExtent(n, 0, n, n.length);
  else getSelection().collapse(n, n.length);
})()`);

// the part of the file of the first slide of the deck of lists from Alpha to Echo
const cutPart = (text) => text.slice(text.indexOf('<li>Alpha'), text.indexOf('<li>Echo'));
const starts = (page) => page.evaluate(`[...document.querySelectorAll('${SLIDE} > ol')].map((ol) => ol.start)`);

async function roundTrip(page, base) {
  const edited = await render(page);
  assert.notEqual(edited, base, 'the action does not change the file');
  await undo(page);
  assert.equal(await render(page), base, 'the undo does not give the file back byte for byte');
  await redo(page);
  assert.equal(await render(page), edited, 'the redo does not write the edit again');
  const { text } = await saveAndReopen(page, `r15-13-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
}

for (const platform of PLATFORMS) {
  // F3: a blank first line typed nothing, hence the next Return ended the list
  for (const [text, items] of [['\nA\nB', ['A', 'B']], ['\n\nA', ['A']], [' \r\nA\n', ['A']]]) {
    test(`a paste of ${js(text)} into an empty item makes an item for each line with text, in the same list (${platform})`, async (t) => {
      const page = await load(t, platform, LISTS, 0);
      await caretIn(page, 'Bravo');
      await press(page, 'Enter');
      await wait(page);
      const empty = await render(page);
      await exec(page, 'edit.paste', text);
      await wait(page);
      const part = cutPart(await render(page));
      assert.equal(part, `<li>Alpha</li>\n    <li>Bravo</li>\n    ${items.map((i) => `<li>${i}</li>\n    `).join('')}<li>Charlie</li>\n    <li>Delta</li>\n    `, `the paste does not make items of the list: ${part}`);
      assert.equal((await state(page, 'edit.undo')).label, 'Undo Paste');
      await roundTrip(page, empty);
    });
  }

  // F3: the selected text was deleted outside the entry of the paste, hence the undo lost it
  test(`a paste of lines with a blank first line over a selected text gives the text back at the undo (${platform})`, async (t) => {
    const page = await load(t, platform, LISTS, 0);
    await caretIn(page, 'Bravo', true);
    await exec(page, 'edit.paste', '\nA\nB');
    await wait(page);
    const part = cutPart(await render(page));
    assert.equal(part, '<li>Alpha</li>\n    <li>A</li>\n    <li>B</li>\n    <li>Charlie</li>\n    <li>Delta</li>\n    ', `the paste does not replace Bravo: ${part}`);
    await roundTrip(page, page.source);
  });
}

// Return twice at the end of Bravo, which cuts the list of Alpha to Echo after Bravo
async function cutAfterBravo(page) {
  await caretIn(page, 'Bravo');
  await press(page, 'Enter');
  await press(page, 'Enter');
  await wait(page);
  const cut = await render(page);
  assert.match(cutPart(cut), /<li>Bravo<\/li>\n {2}<\/ol>\n {2}<p><\/p>\n {2}<ol start="3">\n {4}<li>Charlie<\/li>/);
  return cut;
}

const CHANGES = {
  // Alpha made a paragraph leaves one item, Bravo, in the numbered list before Charlie
  'Alpha made a paragraph': { act: async (page) => { await caretIn(page, 'Alpha'); await exec(page, 'text.list.none'); }, tag: '<ol start="2">', starts: [1, 2, 7] },
  'the first list made a dash list': { act: async (page) => { await caretIn(page, 'Bravo'); await exec(page, 'text.list.ul'); }, tag: '<ol>', starts: [1, 7] },
  'the first list deleted': {
    act: async (page) => {
      await caretIn(page, 'Alpha');
      await press(page, 'Escape');
      await wait(page);
      assert.deepEqual((await selected(page)).els, ['ol']);
      await press(page, 'Backspace');
    },
    tag: '<ol>',
    starts: [1, 7],
  },
};

for (const platform of PLATFORMS) {
  // F4: the link to the list before was lost with the element of this list, hence the start
  // written at the cut was kept
  for (const [name, change] of Object.entries(CHANGES)) {
    test(`the start of a list cut off by Return goes on with the numbered list before it after ${name} (${platform})`, async (t) => {
      const page = await load(t, platform, LISTS, 0);
      const cut = await cutAfterBravo(page);
      await change.act(page);
      await wait(page);
      const text = await render(page);
      assert.ok(text.includes(`${change.tag}\n    <li>Charlie</li>`), `the list of Charlie does not start with ${change.tag}: ${text.slice(text.indexOf('<h2>'), text.indexOf('<li>Charlie') + 16)}`);
      assert.deepEqual(await starts(page), change.starts);
      await roundTrip(page, cut);
    });
  }
}

const START = '.beeson-edit-inspector input[name="Start at"]';

// the tab of the inspector named name shown, with the Format pane open
async function showTab(page, name) {
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await wait(page);
  const at = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-inspector .ed-tabs button')].find((b) => b.textContent.trim() === ${js(name)}); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (at) await click(page, at);
  await wait(page);
}

for (const platform of PLATFORMS) {
  // F5: the shown number was not entered, hence the start went on with the list before
  test(`Return in Start at with the shown number keeps the start of a cut-off list, in one entry (${platform})`, async (t) => {
    const page = await load(t, platform, LISTS, 0);
    const cut = await cutAfterBravo(page);
    await click(page, await pointOf(page, 'Charlie'));
    await showTab(page, 'Text');
    assert.equal(await page.evaluate(`document.querySelector(${js(START)}).value`), '3');
    await click(page, START, { count: 3 });
    await type(page, '3');
    await press(page, 'Enter');
    await wait(page);
    assert.equal(await render(page), cut, 'the shown number changes the file');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Start At');
    await caretIn(page, 'Alpha');
    await press(page, 'Enter');
    await wait(page);
    assert.deepEqual(await starts(page), [1, 3, 7], 'the start entered into Start at is changed');
    await undo(page);
    assert.equal(await render(page), cut);
    await undo(page);
    assert.equal(await render(page), cut);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo New Paragraph');
    // after the undo of Start at, the start goes on with the list before again
    await caretIn(page, 'Alpha');
    await press(page, 'Enter');
    await wait(page);
    assert.deepEqual(await starts(page), [1, 4, 7]);
    await undo(page);
    assert.equal(await render(page), cut);
    assert.deepEqual(errors(page), []);
  });
}

const POSTER = '#beeson-edit-panel-format input[name=poster-frame]';

// the selection by tag, the focused control, and whether the Poster Frame slider is the one of the
// last call, i.e. whether the pane was not drawn anew
const held = (page) => page.evaluate(`(() => {
  const a = document.activeElement;
  const slider = document.querySelector(${js(POSTER)});
  const same = slider === window.posterSlider;
  window.posterSlider = slider;
  return { els: window.BeesonEditor.selection().map((e) => e.localName), focus: a && a.localName + (a.type ? '.' + a.type : ''), same };
})()`);

for (const platform of PLATFORMS) {
  // the undo selected the figure around the selected video, which drew the pane anew and took the
  // focus off the slider
  test(`an undo and a redo of a change to the selected video keep the selection and the focus on the slider of the inspector (${platform})`, async (t) => {
    const page = await load(t, platform, 'test-deck.html', 10);
    const at = await center(page, ".reveal:not(.beeson-peek) .slides > section.present video");
    await click(page, at);
    await click(page, at);
    await wait(page);
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await page.waitFor(`!!document.querySelector('${POSTER}:not([disabled])')`, 10000);
    const r = await page.evaluate(`(() => { const r = document.querySelector(${js(POSTER)}).getBoundingClientRect(); return { x: r.left + r.width * 0.6, y: r.top + r.height / 2 }; })()`);
    await click(page, r);
    await page.waitFor(`window.BeesonEditor.render() !== ${js(page.source)}`, 20000);
    const poster = await render(page);
    assert.deepEqual(await held(page), { els: ['video'], focus: 'input.range', same: false });
    await press(page, 'Mod+Z');
    await wait(page, 600);
    assert.equal(await render(page), page.source);
    assert.deepEqual(await held(page), { els: ['video'], focus: 'input.range', same: true }, 'the undo changes the selection or the focus');
    await press(page, platform === 'mac' ? 'Mod+Shift+Z' : 'Mod+Y');
    await wait(page, 600);
    assert.equal(await render(page), poster);
    assert.deepEqual(await held(page), { els: ['video'], focus: 'input.range', same: true }, 'the redo changes the selection or the focus');
    assert.deepEqual(errors(page), []);
  });
}
