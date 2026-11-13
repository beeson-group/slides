// regression tests of R19.6 on both platforms: a paste with a blank first line and Return over a
// selected text of a list item, each undone to the file byte for byte (D13), and the caret after a
// forward Delete in the empty paragraph between two lists and after its redo (D14)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press } from './helpers/editor.mjs';

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
async function undo1(page) { await press(page, 'Mod+Z'); await wait(page); }
async function redo1(page) { await press(page, 'Mod+Shift+Z'); await wait(page); }

// the text from offset from to offset to of the first text of the item that holds needle selected
const selectText = (page, needle, from, to) => page.evaluate(`(() => {
  const li = ${find(needle)};
  const n = [...li.childNodes].find((c) => c.nodeType === 3 && c.data.trim());
  li.closest('[contenteditable="true"]').focus();
  getSelection().setBaseAndExtent(n, ${from}, n, ${to});
})()`);

for (const platform of PLATFORMS) {
  // D13: the undo of the paste left <li>Bvo</li> and <li>Bra</li>, since the selected text was
  // taken off before the entry of the paste read the item
  const PASTES = [
    ['\nAone\nBtwo', 1, 3, '<li>B</li>\n    <li>Aone</li>\n    <li>Btwovo</li>'],
    ['\nAone', 3, 5, '<li>Bra</li>\n    <li>Aone</li>'],
  ];
  for (const [text, from, to, items] of PASTES) {
    test(`a paste of ${js(text)} over a selected text after other text of an item is undone byte for byte (${platform})`, async (t) => {
      const page = await load(t, platform, LISTS, 0);
      await selectText(page, 'Bravo', from, to);
      await exec(page, 'edit.paste', text);
      await wait(page);
      assert.equal(await render(page), page.source.replace('<li>Bravo</li>', items));
      assert.equal(await undoLabel(page), 'Undo Paste');
      await undo(page);
      assert.equal(await render(page), page.source, 'one undo does not give the file back byte for byte');
      await redo(page);
      assert.equal(await render(page), page.source.replace('<li>Bravo</li>', items));
      assert.deepEqual(errors(page), []);
    });
  }

  // D13: the undo of Return over 'ra' left <li>Bvo</li>
  test(`Return over a selected text of an item is undone byte for byte (${platform})`, async (t) => {
    const page = await load(t, platform, LISTS, 0);
    await selectText(page, 'Bravo', 1, 3);
    await press(page, 'Enter');
    await wait(page);
    assert.equal(await render(page), page.source.replace('<li>Bravo</li>', '<li>B</li>\n    <li>vo</li>'));
    await undo1(page);
    assert.equal(await render(page), page.source, 'one undo does not give the file back byte for byte');
    await redo1(page);
    assert.equal(await render(page), page.source.replace('<li>Bravo</li>', '<li>B</li>\n    <li>vo</li>'));
    await typedAt(page, await render(page), '<li>|vo</li>', 'w');
    assert.deepEqual(errors(page), []);
  });
}

const WHEN = '<li class="fragment" data-fragment-index="3">|When';

// the caret put into the empty paragraph between two lists: on slide 3 of the demo deck by Return
// twice at the end of an item, and in the deck of R16.4 directly
async function emptyBetween(page, deck) {
  if (deck === 'test-deck.html') {
    await caretIn(page, SAME);
    await press(page, 'Enter');
    await press(page, 'Enter');
  } else await caretInParagraph(page, '');
  await wait(page);
}

for (const platform of PLATFORMS) {
  // D14: after the Delete, the focus was on body, and the key was lost
  for (const [deck, slide, where] of [['test-deck.html', 2, WHEN], ['test/pages/editor-r16-4.html', 0, '<li>|Qtwo</li>']]) {
    test(`after a forward Delete in the empty paragraph between two lists of ${deck}, a key is typed at the start of the first item of the second list (${platform})`, async (t) => {
      const page = await load(t, platform, deck, slide);
      await emptyBetween(page, deck);
      await press(page, 'Delete');
      await wait(page);
      assert.equal(await undoLabel(page), 'Undo Join Paragraphs');
      await typedAt(page, await render(page), where, 'w');
    });
  }

  // D14: after the redo, the focus was on body, or in the heading where the caret was put
  for (const away of [false, true]) {
    test(`after a redo of a forward Delete between two lists${away ? ' with the caret in the heading' : ''}, a key is typed at the start of the first item of the second list (${platform})`, async (t) => {
      const page = await load(t, platform, 'test-deck.html', 2);
      await emptyBetween(page, 'test-deck.html');
      await press(page, 'Delete');
      await wait(page);
      const joined = await render(page);
      await undo1(page);
      if (away) {
        const at = await page.evaluate(`(() => { const r = document.querySelector('${SLIDE} h2').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
        await click(page, at);
        await click(page, at);
        await wait(page);
        assert.ok(await page.evaluate(`!!document.activeElement?.matches('${SLIDE} h2')`), 'the caret is not in the heading');
      }
      await redo1(page);
      assert.equal(await render(page), joined);
      await typedAt(page, joined, WHEN, 'w');
    });
  }
}
