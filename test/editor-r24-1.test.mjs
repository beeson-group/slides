// regression tests of R24.1 on both platforms: a word copied with the space after it, as a double
// click takes it on Windows, pasted with the spaces of PowerPoint, and Undo by the key in a number
// field of the inspector while a typed value is not entered. after each paste the text is checked
// byte for byte after an undo, the paste again after a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test-deck.html';
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
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const exec = (page, id) => page.evaluate(`window.BeesonEditor.exec(${js(id)})`);
let saves = 0;

// the editor on slide n of a deck, served over HTTP, with the storage of the origin emptied
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
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the shown element of selector whose text holds needle, as an expression
const blockOf = (selector, needle) => `[...document.querySelectorAll(${js(selector)})].find((el) => el.getBoundingClientRect().width && el.textContent.includes(${js(needle)}))`;

// the caret put at the mark | of at, e.g. 'steps.| Direct', into the block of selector, by a click
// into the block and a collapse of the selection there
async function caretAt(page, selector, at) {
  const needle = at.replace('|', '');
  const k = at.indexOf('|');
  const point = await page.evaluate(`(() => { const r = ${blockOf(selector, needle)}.getBoundingClientRect(); return { x: r.left + 4, y: r.top + r.height / 2 }; })()`);
  await click(page, point);
  await frames(page);
  await page.evaluate(`(() => {
    const el = ${blockOf(selector, needle)};
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const i = n.data.indexOf(${js(needle)});
      if (i < 0) continue;
      el.closest('[contenteditable="true"]')?.focus();
      getSelection().collapse(n, i + ${k});
      return;
    }
    throw new Error('the text ${needle} is not in the block');
  })()`);
}

// a paste of text at the caret as the browser sends it into a text, i.e. the event beforeinput with
// the clipboard text on its DataTransfer. the system clipboard is not used, since other tests share it
async function paste(page, text) {
  await page.evaluate(`(() => {
    const data = new DataTransfer();
    data.setData('text/plain', ${js(text)});
    const n = getSelection().anchorNode;
    const target = n instanceof Element ? n : n.parentElement;
    const ev = new InputEvent('beforeinput', { inputType: 'insertFromPaste', dataTransfer: data, bubbles: true, cancelable: true, composed: true });
    if (target.dispatchEvent(ev)) throw new Error('the editor left the paste to the browser');
  })()`);
  await frames(page);
}

// the paste checked against page.source after an undo, again after a redo, and after a save and an
// open. it returns the line of the edited text that holds probe. a paste into code is an entry
// Typing, as on the base
async function roundTrip(page, probe) {
  const edited = await render(page);
  const line = edited.split('\n').find((l) => l.includes(probe)) ?? '';
  assert.equal((await state(page, 'edit.undo')).label, probe === 'attention' ? 'Undo Paste' : 'Undo Typing', 'the paste is not one entry');
  await undo(page);
  assert.equal(await render(page), page.source, 'the undo does not give the file back byte for byte');
  await redo(page);
  assert.equal(await render(page), edited, 'the redo does not write the paste again');
  const { text } = await saveAndReopen(page, `r24-1-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  return line;
}

const P = '.reveal section.present > p';
const CODE = '.reveal section.present pre code';

// each case gives the slide, the block, the caret, the clipboard text, and the saved text of the
// block after the paste. on Windows a double click takes "break " with the space after it, and a
// cut puts this text on the clipboard
const CASES = [
  // the space after the word is dropped before a space, and a space is put after a full stop
  ['a word behind a full stop and before a space', 2, P, 'steps.| Direct', 'break ', 'then break it up into steps. break Direct'],
  // the space after the word is dropped at the end of the text
  ['a word at the end of the text', 2, P, 'attention.|', 'break ', 'the viewer\'s attention. break</p>'],
  // the space after the word is dropped before a closing mark, and a space is put after a letter
  ['a word behind a letter and before a full stop', 2, P, 'steps|.', 'break ', 'into steps break. Direct'],
  // the space after the word is kept before a letter, and a space is not put at the start
  ['a word at the start of the text', 2, P, '|Design the', 'break ', '<p>break Design the complete'],
  // a text without a space at its end, and a text of several words, are pasted as on the base
  ['a word without a space after it', 2, P, 'steps.| Direct', 'break', 'into steps.break Direct'],
  ['several words with a space after them', 2, P, 'steps.| Direct', 'break it ', 'into steps.break it  Direct'],
  // a part of a word pasted into a word does not gain a space
  ['a part of a word pasted into a word', 2, P, 'Des|ign the', 'ak ', '<p>Desak ign the'],
  ['a part of a word without a space pasted into a word', 2, P, 'Des|ign the', 'ak', '<p>Desakign the'],
  // a paste into code is kept as it is
  ['a word pasted into code', 5, CODE, 'def| halo', 'break ', 'defbreak  halo_family'],
];

for (const platform of PLATFORMS) {
  for (const [name, n, selector, at, clip, expected] of CASES) {
    test(`a paste of ${js(clip)} as ${name} gives ${js(expected)} (${platform})`, async (t) => {
      const page = await load(t, platform, DECK, n);
      await caretAt(page, selector, at);
      await paste(page, clip);
      const line = await roundTrip(page, selector === CODE ? 'halo_family' : 'attention');
      assert.ok(line.includes(expected), `the paste saved ${js(line.trim())}`);
    });
  }
}

// the tab name of the inspector shown, with the Format pane open
async function showTab(page, name) {
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await frames(page);
  const at = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-inspector .ed-tabs button')].find((b) => b.textContent.trim() === ${js(name)}); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (at) await click(page, at);
  await frames(page);
}

// a trusted key with the command modifier of the platform, carrying the edit command name that the
// key gives on Windows and Linux. the browser runs name unless the page prevents the key
async function command(page, platform, key, name) {
  const base = { key, code: `Key${key.toUpperCase()}`, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0), modifiers: platform === 'mac' ? 4 : 2 };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base, commands: [name] });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

const START = '.beeson-edit-inspector input[name="Start at"]';
const ITEM = '.reveal section.present ol > li';

for (const platform of PLATFORMS) {
  test(`one Undo by the key in Start at with 2.5 typed and not entered puts the shown 1 back, selected, without an entry of the history (${platform})`, async (t) => {
    const page = await load(t, platform, LISTS, 0);
    await click(page, await page.evaluate(`(() => { const r = ${blockOf(ITEM, 'Bravo')}.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`));
    await frames(page);
    await showTab(page, 'Text');
    const field = `document.querySelector(${js(START)})`;
    assert.equal(await page.evaluate(`${field}?.value`), '1', 'the Text pane does not have a field Start at that shows 1');
    await click(page, START, { count: 3 });
    const label = (await state(page, 'edit.undo')).label;
    for (const key of '2.5') await type(page, key);
    assert.equal(await page.evaluate(`${field}.value`), '2.5');
    await command(page, platform, 'z', 'undo');
    await frames(page);
    const now = await page.evaluate(`(() => { const f = ${field}; return { value: f.value, focused: document.activeElement === f, all: f.selectionStart === 0 && f.selectionEnd === f.value.length }; })()`);
    assert.deepEqual(now, { value: '1', focused: true, all: true }, 'one Undo does not put the shown value back, selected');
    assert.equal(await render(page), page.source, 'the Undo changes the file');
    assert.equal((await state(page, 'edit.undo')).label, label, 'the Undo changes the history');
    assert.deepEqual(errors(page), []);
  });
}
