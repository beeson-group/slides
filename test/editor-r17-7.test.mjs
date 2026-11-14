// regression tests of R17.7 on both platforms with trusted input: a paste into a list item with a
// blank first line or with blank lines alone, the caret after the undos and redos of Return and of
// typing, Backspace and Delete at a paragraph next to a list, and the shown number of Start at
// entered with Tab or a click, and a fraction refused there. each edit is undone to the file byte for
// byte

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

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
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
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

// the edit checked against base after an undo, again after a redo, and after a save and an open
async function roundTrip(page, base) {
  const edited = await render(page);
  assert.notEqual(edited, base, 'the action does not change the file');
  await undo(page);
  assert.equal(await render(page), base, 'the undo does not give the file back byte for byte');
  await redo(page);
  assert.equal(await render(page), edited, 'the redo does not write the edit again');
  const { text } = await saveAndReopen(page, `r17-7-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  return edited;
}

// every entry undone, which must give the file of the page back byte for byte
async function undoAll(page) {
  for (let n = 0; n < 20 && (await state(page)).enabled; n++) await undo(page);
  assert.equal(await render(page), page.source, 'the undo of every entry does not give the file back byte for byte');
}
const state = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo')`);

const SLIDE = '.reveal .slides section.present';
const find = (needle) => `[...document.querySelectorAll('${SLIDE} li')].find((el) => el.getBoundingClientRect().width && el.textContent.includes(${js(needle)}))`;

// the caret put at the end of the item that holds needle, or at the offset at of its first text,
// or with at true its first text selected
const caretIn = (page, needle, at = null) => page.evaluate(`(() => {
  const li = ${find(needle)};
  const n = [...li.childNodes].filter((c) => c.nodeType === 3 && c.data.trim()).at(${at === null ? -1 : 0});
  li.closest('[contenteditable="true"]').focus();
  if (${at === true}) getSelection().setBaseAndExtent(n, 0, n, n.length);
  else getSelection().collapse(n, ${at === null ? 'n.length' : Number(at)});
})()`);

// the caret put at the start of the paragraph of the current slide whose text is text
const caretInParagraph = (page, text) => page.evaluate(`(() => {
  const p = [...document.querySelectorAll('${SLIDE} > p')].find((p) => p.textContent.trim() === ${js(text)});
  p.closest('[contenteditable="true"]').focus();
  getSelection().collapse(p.firstChild ?? p, 0);
})()`);

const starts = (page) => page.evaluate(`[...document.querySelectorAll('${SLIDE} > ol')].map((ol) => ol.start)`);

// one trusted key press of a letter with its text, as a keyboard types it, with Shift for a
// capital
async function key(page, ch) {
  const base = { key: ch, code: `Key${ch.toUpperCase()}`, windowsVirtualKeyCode: ch.toUpperCase().charCodeAt(0), modifiers: ch === ch.toUpperCase() ? 8 : 0 };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: ch, unmodifiedText: ch });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await wait(page, 600);
}

// the key ch, typed after the file is base, must add one character to base at the bar of where,
// a part of base with a bar at the caret, e.g. '<p>|</p>'
async function typedAt(page, base, where, ch) {
  await key(page, ch);
  const text = await render(page);
  const at = base.indexOf(where.replace('|', ''));
  assert.ok(at >= 0, `${where} is not in the file`);
  const i = at + where.indexOf('|');
  let d = 0;
  while (d < text.length && text[d] === base[d]) d++;
  const got = text.length === base.length ? 'nowhere' : js(text.slice(Math.max(0, d - 30), d + 30));
  assert.ok(text === base.slice(0, i) + ch + base.slice(i), `the key ${ch} is not typed at ${js(where)} but ${got}`);
}


const SAME = 'Two elements with the same index are shown together.';
const FRAG2 = '<li class="fragment" data-fragment-index="2">';

for (const platform of PLATFORMS) {
  // 9f and N47: the blank first line was dropped, hence the first line with text was attached onto
  // the item
  const CASES = [
    [LISTS, 0, 'Bravo', '<li>Bravo</li>\n    <li>Aone</li>\n    <li>Btwo</li>\n    <li>Cthree</li>\n    <li>Charlie</li>'],
    ['test-deck.html', 2, SAME, `${FRAG2}${SAME}</li>\n    ${FRAG2}Aone</li>\n    ${FRAG2}Btwo</li>\n    ${FRAG2}Cthree</li>\n    <li class="fragment" data-fragment-index="3">When`],
  ];
  for (const [deck, slide, needle, items] of CASES) {
    test(`a paste with a blank first line at the end of an item with text starts a new item in the same list in ${deck} (${platform})`, async (t) => {
      const page = await load(t, platform, deck, slide);
      await caretIn(page, needle);
      await exec(page, 'edit.paste', '\nAone\n\nBtwo\n\nCthree');
      await wait(page);
      const text = await render(page);
      assert.ok(text.includes(items), `the lines are not new items of the list: ${js(text.slice(text.indexOf(needle) - 10, text.indexOf(needle) + 260))}`);
      assert.equal(await undoLabel(page), 'Undo Paste');
      await roundTrip(page, page.source);
    });
  }

  // N48: a paste without a line of text did nothing, also over a selected text
  test(`a paste of blank lines over a selected text of an item takes the text off, in one entry (${platform})`, async (t) => {
    const page = await load(t, platform, LISTS, 0);
    await caretIn(page, 'Bravo', true);
    await exec(page, 'edit.paste', '\n\n');
    await wait(page);
    assert.equal(await render(page), page.source.replace('<li>Bravo</li>', '<li></li>'));
    assert.equal(await undoLabel(page), 'Undo Paste');
    await roundTrip(page, page.source);
  });
}

// the steps of 6d after Return twice at the end of an item, which ends the list, each with the
// place of the caret after it, given as a part of the file with a bar
const STEPS = [
  ['the first undo', [undo1], (n) => `<li>${n}</li>\n    <li>|</li>`],
  ['the second undo', [undo1, undo1], (n) => `<li>${n}|</li>`],
  ['the first redo', [undo1, undo1, redo1], (n) => `<li>${n}</li>\n    <li>|</li>`],
  ['the second redo', [undo1, undo1, redo1, redo1], (n) => `<li>${n}</li>\n  </ol>\n  <p>|</p>`],
];
async function undo1(page) { await press(page, 'Mod+Z'); await wait(page); }
async function redo1(page) { await press(page, 'Mod+Shift+Z'); await wait(page); }

for (const platform of PLATFORMS) {
  // 6d and N28: the second undo selected the list as a block, and the caret was lost
  for (const [name, steps, where] of STEPS) {
    test(`after Return twice at the end of an item and ${name}, a typed key is written in the text of the step (${platform})`, async (t) => {
      const page = await load(t, platform, LISTS, 0);
      await caretIn(page, 'Echo');
      await press(page, 'Enter');
      await wait(page);
      const one = await render(page);
      await press(page, 'Enter');
      await wait(page);
      const two = await render(page);
      for (const step of steps) await step(page);
      const base = [one, page.source, one, two][steps.length - 1];
      assert.equal(await render(page), base);
      assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((el) => el.localName)'), [], 'a block is selected');
      await typedAt(page, base, where('Echo'), 'q');
      await undo(page);
      assert.equal(await render(page), base);
      await undoAll(page);
    });
  }

  // N31: the redo of Return left the caret at the end of the first half
  test(`after a redo of Return in the middle of an item, the caret is at the start of the new item (${platform})`, async (t) => {
    const page = await load(t, platform, LISTS, 0);
    await caretIn(page, 'Bravo', 2);
    await press(page, 'Enter');
    await wait(page);
    const split = await render(page);
    assert.ok(split.includes('<li>Br</li>\n    <li>avo</li>'));
    await undo1(page);
    assert.equal(await render(page), page.source);
    await redo1(page);
    assert.equal(await render(page), split);
    await typedAt(page, split, '<li>|avo</li>', 'q');
    await undo(page);
    await undoAll(page);
  });

  // N30: the undo of typing selected the list as a block, with the focus on the body
  test(`an undo of typing in an item after a click into the heading puts the caret into the item (${platform})`, async (t) => {
    const page = await load(t, platform, 'test-deck.html', 2);
    await caretIn(page, SAME);
    await type(page, ' XY');
    await wait(page, 1200);
    const typed = await render(page);
    assert.ok(typed.includes(`${SAME} XY</li>`));
    const h2 = await page.evaluate(`(() => { const r = document.querySelector('${SLIDE} h2').getClientRects()[0]; return { x: r.left + 40, y: r.top + r.height / 2 }; })()`);
    await click(page, h2);
    await wait(page);
    await press(page, 'Mod+Z');
    await wait(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((el) => el.localName)'), [], 'a block is selected');
    await typedAt(page, page.source, `${SAME}|</li>`, 'q');
    await undoAll(page);
  });
}

for (const platform of PLATFORMS) {
  // N52: Backspace at the start of a paragraph with text after a list did nothing
  test(`Backspace at the start of a paragraph after a list joins its text onto the last item, and the lists around it (${platform})`, async (t) => {
    const page = await load(t, platform, 'test-deck.html', 2);
    await caretIn(page, SAME);
    await press(page, 'Enter');
    await press(page, 'Enter');
    await type(page, 'Between');
    await wait(page, 1200);
    const between = await render(page);
    assert.ok(between.includes(`${SAME}</li>\n  </ul>\n  <p>Between</p>\n  <ul>`));
    await caretInParagraph(page, 'Between');
    await press(page, 'Backspace');
    await wait(page);
    assert.equal(await render(page), page.source.replace(`${SAME}</li>`, `${SAME}Between</li>`));
    assert.equal(await undoLabel(page), 'Undo Join Paragraphs');
    await typedAt(page, await render(page), `${SAME}|Between</li>`, 'q');
    await undo(page);
    await roundTrip(page, between);
  });

  // N51: a forward Delete in the empty paragraph between two lists did nothing
  test(`a forward Delete in the empty paragraph between two lists takes it off and joins the lists (${platform})`, async (t) => {
    const page = await load(t, platform, 'test-deck.html', 2);
    await caretIn(page, SAME);
    await press(page, 'Enter');
    await press(page, 'Enter');
    await wait(page);
    const empty = await render(page);
    assert.ok(empty.includes(`${SAME}</li>\n  </ul>\n  <p></p>\n  <ul>`));
    await press(page, 'Delete');
    await wait(page);
    assert.equal(await render(page), page.source);
    assert.equal(await undoLabel(page), 'Undo Join Paragraphs');
    await roundTrip(page, empty);
  });
}

const START = '.beeson-edit-inspector input[name="Start at"]';

// the tab of the inspector named name shown, with the Format pane open
async function showTab(page, name) {
  if (!(await page.evaluate(`window.BeesonEditor.state('shell.format').checked`))) await exec(page, 'shell.format');
  await wait(page);
  const at = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-inspector .ed-tabs button')].find((b) => b.textContent.trim() === ${js(name)}); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (at) await click(page, at);
  await wait(page);
}

// Return twice at the end of Bravo, which cuts the list of Alpha to Echo after Bravo, and the
// field Start at of the list of Charlie with the text 3 typed into it
async function typedStart(page, value) {
  await caretIn(page, 'Bravo');
  await press(page, 'Enter');
  await press(page, 'Enter');
  await wait(page);
  const cut = await render(page);
  assert.ok(cut.includes('<ol start="3">\n    <li>Charlie</li>'));
  await click(page, await page.evaluate(`(() => { const r = ${find('Charlie')}.getClientRects()[0]; return { x: r.left + 30, y: r.top + r.height / 2 }; })()`));
  await showTab(page, 'Text');
  assert.equal(await page.evaluate(`document.querySelector(${js(START)}).value`), '3');
  await click(page, await page.evaluate(`(() => { const r = document.querySelector(${js(START)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`), { count: 3 });
  await type(page, value);
  return cut;
}

for (const platform of PLATFORMS) {
  // N53: the shown number was kept only when it was entered with Return
  const LEAVES = {
    Tab: (page) => press(page, 'Tab'),
    'a click outside the field': async (page) => click(page, await page.evaluate(`(() => { const r = document.querySelector('${SLIDE} h2').getClientRects()[0]; return { x: r.left + 40, y: r.top + r.height / 2 }; })()`)),
  };
  for (const [name, leave] of Object.entries(LEAVES)) {
    test(`the shown number of a cut-off list typed into Start at and entered with ${name} is kept (${platform})`, async (t) => {
      const page = await load(t, platform, LISTS, 0);
      const cut = await typedStart(page, '3');
      await leave(page);
      await wait(page);
      assert.equal(await render(page), cut, 'the shown number changes the file');
      assert.equal(await undoLabel(page), 'Undo Start At');
      await caretIn(page, 'Alpha');
      await press(page, 'Enter');
      await wait(page);
      assert.deepEqual(await starts(page), [1, 3, 7], 'the start entered into Start at is changed');
      await undo(page);
      await undo(page);
      assert.equal(await render(page), cut);
      await undoAll(page);
    });
  }

  // N54: a typed 2.5 was rounded to 3 and written
  test(`a typed 2.5 in Start at is refused, and the field shows its value again (${platform})`, async (t) => {
    const page = await load(t, platform, LISTS, 0);
    const cut = await typedStart(page, '2.5');
    await press(page, 'Enter');
    await wait(page);
    assert.equal(await render(page), cut);
    assert.equal(await undoLabel(page), 'Undo New Paragraph');
    assert.equal(await page.evaluate(`document.querySelector(${js(START)}).value`), '3');
    await caretIn(page, 'Alpha');
    await press(page, 'Enter');
    await wait(page);
    assert.deepEqual(await starts(page), [1, 4, 7], 'the cut-off list does not go on with the list before');
    await undoAll(page);
  });
}
