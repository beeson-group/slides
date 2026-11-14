// regression tests of R16.4 on both platforms with trusted input: the start of a list numbered by
// hand kept after its first item is taken off, the caret after an undo and a redo of Backspace in
// an empty paragraph after a list and of Return on an empty list item, and two lists left apart
// when they are locked or when the element deleted between them is a figure of the figure box. each edit
// is undone to the file byte for byte

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { center, click, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const LISTS = 'test/pages/editor-r13-3.html';
const DECK = 'test/pages/editor-r16-4.html';

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
const exec = (page, id) => page.evaluate(`window.BeesonEditor.exec(${js(id)})`);
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
  const { text } = await saveAndReopen(page, `r16-4-${++saves}.html`);
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

// the caret put at the end of the item that holds needle, or with all true its text selected
const caretIn = (page, needle, all = false) => page.evaluate(`(() => {
  const li = ${find(needle)};
  const n = [...li.childNodes].find((c) => c.nodeType === 3 && c.data.trim());
  li.closest('[contenteditable="true"]').focus();
  if (${all}) getSelection().setBaseAndExtent(n, 0, n, n.length);
  else getSelection().collapse(n, n.length);
})()`);

// the caret put into the empty paragraph of the current slide
const caretInEmpty = (page) => page.evaluate(`(() => {
  const p = [...document.querySelectorAll('${SLIDE} > p')].find((p) => !p.textContent.trim());
  p.closest('[contenteditable="true"]').focus();
  getSelection().collapse(p, 0);
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

const SEVENTH = '<ol start="7">\n    <li>Seventh</li>\n    <li>Eighth</li>\n  </ol>';

for (const platform of PLATFORMS) {
  // G16: the list of Eighth was marked as cut off, hence it went on with the list of Alpha to Echo
  const ROUTES = {
    'made a paragraph': { act: async (page) => { await caretIn(page, 'Seventh'); await exec(page, 'text.list.none'); } },
    'emptied and taken off by Return': {
      prep: async (page) => { await caretIn(page, 'Seventh', true); await press(page, 'Backspace'); },
      act: (page) => press(page, 'Enter'),
    },
  };
  for (const [route, { prep, act }] of Object.entries(ROUTES)) {
    test(`a list numbered by hand keeps its start after its first item is ${route} (${platform})`, async (t) => {
      const page = await load(t, platform, LISTS, 0);
      assert.ok(page.source.includes(SEVENTH));
      if (prep) await prep(page);
      await wait(page);
      const base = await render(page);
      await act(page);
      await wait(page);
      const text = await render(page);
      assert.ok(/<\/ol>\n {2}<p>(Seventh)?<\/p>\n {2}<ol start="7">\n {4}<li>Eighth<\/li>/.test(text), `the list of Eighth does not keep start="7": ${js(text.slice(text.indexOf('<li>Echo'), text.indexOf('</section>')))}`);
      assert.deepEqual(await starts(page), [1, 7]);
      // a new item of the list before leaves the start as it is
      await caretIn(page, 'Alpha');
      await press(page, 'Enter');
      await wait(page);
      assert.deepEqual(await starts(page), [1, 7], 'a new item of the list before renumbers the list of Eighth');
      await undo(page);
      assert.equal(await render(page), text);
      await undo(page);
      assert.equal(await render(page), base);
      // the save and the open of roundTrip() clear the history, hence every entry is undone first
      if (prep) {
        await undoAll(page);
        await redo(page);
        assert.equal(await render(page), base);
      }
      await redo(page);
      await roundTrip(page, base);
    });
  }
}

for (const platform of PLATFORMS) {
  // G12: the caret was put back by its count of characters, which an empty paragraph does not
  // change, hence it went into the item after the paragraph or to the end of the list before it
  const CASES = [
    [0, '<p>|</p>\n  <ol start="2">', '<li>Pone|</li>', ['  </ol>\n  <p></p>\n  <ol start="2">\n', '']],
    [1, '</ul>\n  <p>|</p>', '<li>Btwo|</li>', ['</ul>\n  <p></p>\n', '</ul>\n']],
  ];
  for (const [slide, empty, last, [from, to]] of CASES) {
    test(`after an undo of Backspace in an empty paragraph after a list on slide ${slide}, the caret is in the paragraph, and after the redo at the end of the list (${platform})`, async (t) => {
      const page = await load(t, platform, DECK, slide);
      await caretInEmpty(page);
      await press(page, 'Backspace');
      await wait(page);
      const dropped = await render(page);
      assert.equal(dropped, page.source.replace(from, to), 'Backspace does not take the paragraph off');
      assert.equal(await undoLabel(page), 'Undo Join Paragraphs');
      await press(page, 'Mod+Z');
      await wait(page);
      assert.equal(await render(page), page.source);
      await typedAt(page, page.source, empty, 'Y');
      await undo(page);
      assert.equal(await render(page), page.source);
      // the redo puts the caret at the end of the last item of the list
      await caretInEmpty(page);
      await press(page, 'Backspace');
      await wait(page);
      await press(page, 'Mod+Z');
      await wait(page);
      await press(page, 'Mod+Shift+Z');
      await wait(page);
      assert.equal(await render(page), dropped);
      await typedAt(page, dropped, last, 'q');
      await undo(page);
      assert.equal(await render(page), dropped);
      await undoAll(page);
      assert.deepEqual(errors(page), []);
    });
  }
}

for (const platform of PLATFORMS) {
  // G17: the text of the caret was taken off by the step, and the caret was not put back
  for (const [needle, what] of [['Echo', 'ends the list'], ['Bravo', 'cuts the list']]) {
    test(`after an undo of Return on an empty item that ${what}, the caret is in the item, and after the redo in the new paragraph (${platform})`, async (t) => {
      const page = await load(t, platform, LISTS, 0);
      await caretIn(page, needle);
      await press(page, 'Enter');
      await wait(page);
      const item = await render(page);
      await press(page, 'Enter');
      await wait(page);
      const ended = await render(page);
      assert.ok(ended.includes(`<li>${needle}</li>\n  </ol>\n  <p></p>`), `Return does not take the empty item off: ${ended.slice(ended.indexOf('<li>Alpha'), ended.indexOf('</section>'))}`);
      assert.equal(await undoLabel(page), 'Undo New Paragraph');
      await press(page, 'Mod+Z');
      await wait(page);
      assert.equal(await render(page), item);
      await typedAt(page, item, `<li>${needle}</li>\n    <li>|</li>`, 'q');
      await undo(page);
      assert.equal(await render(page), item);
      // the typed key took the redo of Return away, hence Return is pressed again in the item
      await page.evaluate(`(() => { const li = ${find(needle)}.nextElementSibling; li.closest('[contenteditable="true"]').focus(); getSelection().collapse(li, 0); })()`);
      await press(page, 'Enter');
      await wait(page);
      assert.equal(await render(page), ended);
      await press(page, 'Mod+Z');
      await wait(page);
      await press(page, 'Mod+Shift+Z');
      await wait(page);
      assert.equal(await render(page), ended);
      await typedAt(page, ended, `<li>${needle}</li>\n  </ol>\n  <p>|</p>`, 'q');
      await undo(page);
      assert.equal(await render(page), ended);
      await undoAll(page);
      assert.deepEqual(errors(page), []);
    });
  }
}

for (const platform of PLATFORMS) {
  // G14: two locked lists compared equal, hence the second was taken off and its items moved
  for (const k of ['Delete', 'Backspace']) {
    test(`${k} of the paragraph between two locked lists leaves both lists as they are (${platform})`, async (t) => {
      const page = await load(t, platform, DECK, 2);
      await page.evaluate(`(() => { const p = [...document.querySelectorAll('${SLIDE} > p')].find((p) => p.textContent.includes('Middle')); p.closest('[contenteditable="true"]').focus(); getSelection().collapse(p.firstChild, 3); })()`);
      await press(page, 'Escape');
      await wait(page);
      assert.deepEqual(await page.evaluate(`window.BeesonEditor.selection().map((el) => el.localName)`), ['p']);
      await press(page, k);
      await wait(page);
      const text = await render(page);
      const part = text.slice(text.indexOf('<h2>Locked'), text.indexOf('</section>', text.indexOf('<h2>Locked')));
      assert.equal(text, page.source.replace('  <p>Middle three</p>\n', ''), `the locked lists are changed: ${js(part)}`);
      await roundTrip(page, page.source);
    });
  }

  // G13: every element taken from between two lists of the file joined them, also one drawn
  // outside the flow of their column
  test(`Delete of a figure of the zone between two lists in the file leaves both lists as they are (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, 3);
    await click(page, await center(page, `${SLIDE} figure.figure-box img`));
    await wait(page);
    assert.deepEqual(await page.evaluate(`window.BeesonEditor.selection().map((el) => el.localName)`), ['figure']);
    await press(page, 'Delete');
    await wait(page);
    const text = await render(page);
    const figure = page.source.slice(page.source.indexOf('  <figure class="figure-box">'), page.source.indexOf('</figure>') + 10);
    const part = text.slice(text.indexOf('<h2>A figure'), text.indexOf('</section>', text.indexOf('<h2>A figure')));
    assert.equal(text, page.source.replace(figure, ''), `the lists are changed: ${js(part)}`);
    assert.equal(await page.evaluate(`document.querySelectorAll('${SLIDE} > ul').length`), 2);
    await roundTrip(page, page.source);
  });
}
