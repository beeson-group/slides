// regression tests of R9.6 on both platforms with trusted input: Bold and Italic at a caret, the
// items of a list as one text, the undo of a format, Bigger on a selected word, the focus after
// Replace, the popover of a clicked link, the keys in the tooltips of the Text pane, and the names
// of the entries of the history. after each edit the text is checked byte for byte, after an undo
// and a redo, and after a save and an open

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

// roundTrip checks the text before byte for byte after undos undos, the edit after as many redos,
// and an open of the saved edit without problems
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r9-6-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

// the shown element of selector that holds needle, as an expression
const find = (selector, needle = '') => `[...document.querySelectorAll(${js(selector)})].find((el) => el.getBoundingClientRect().width && el.textContent.includes(${js(needle)}))`;

// the client point of the character at offset k of needle in the text of the element
const pointOf = (page, selector, needle, k = 0) => page.evaluate(`(() => {
  const el = ${find(selector, needle)};
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const i = n.data.indexOf(${js(needle)});
    if (i < 0) continue;
    const r = document.createRange();
    r.setStart(n, i + ${k});
    r.setEnd(n, i + ${k} + 1);
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
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

// the selection of the window: its text, whether it is collapsed, and the text of its block before
// the caret
const selection = (page) => page.evaluate(`(() => {
  const s = getSelection();
  if (!s.rangeCount) return null;
  const r = s.getRangeAt(0);
  const host = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement).closest('[contenteditable="true"]');
  const head = document.createRange();
  if (host) { head.selectNodeContents(host); head.setEnd(r.startContainer, r.startOffset); }
  return { text: s.toString(), collapsed: s.isCollapsed, before: host ? head.toString() : null };
})()`);

const PARA = '.reveal section.present > p';

// finding text-lists-find-1: with the caret in a word or at its edge, Bold and Italic left the word
// selected, and the next character typed replaced it
for (const platform of PLATFORMS) {
  for (const [key, tag] of [['B', 'strong'], ['I', 'em']]) {
    for (const [where, k, after] of [
      ['inside', 3, `<p>Export your matplotlib <${tag}>figXure</${tag}> with`],
      ['at the end of', 6, `<p>Export your matplotlib figure<${tag}>X</${tag}> with`],
      ['at the start of', 0, `<p>Export your matplotlib <${tag}>X</${tag}>figure with`],
    ]) {
      test(`Mod+${key} with the caret ${where} a word keeps the caret where it was (${platform})`, async (t) => {
        const page = await load(t, platform);
        await click(page, await pointOf(page, PARA, 'figure', 2));
        await caretAt(page, PARA, 'figure', k);
        const before = await selection(page);
        await press(page, `Mod+${key}`);
        const now = await selection(page);
        assert.equal(now.collapsed, true, `Mod+${key} selects "${now.text}"`);
        assert.equal(now.before, before.before, 'the caret moved');
        await type(page, 'X');
        const text = await render(page);
        assert.ok(text.includes(after), `the paragraph is written as ${text.match(/<p>Export[^\n]*/)?.[0]}`);
        // inside a word, the format of the word and the typing are two entries of the history
        await roundTrip(page, k === 3 ? 2 : 1);
      });
    }
  }
}
