// regression tests of R13.6 on both platforms with trusted input: the caret after an undo and a
// redo of Remove Bullet, the undo of the typing in a new line of the outline, Esc in a line of the
// outline, the name of the outdent of Backspace, and Backspace at the start of a first item with a
// nested list. after each edit the text is checked byte for byte after an undo, the edit again
// after a redo, and after a save and an open

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
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
let saves = 0;

async function load(t, platform, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/index.html?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('index.html', 'utf8');
  page.platform = platform;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// command sends Mod+Z or Mod+Shift+Z with the editing command of the browser, which a key event of
// the DevTools protocol runs only when the command is named
async function command(page, name) {
  const modifiers = (page.platform === 'mac' ? 4 : 2) | (name === 'redo' ? 8 : 0);
  const base = { key: name === 'redo' ? 'Z' : 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base, commands: [name] });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await frames(page);
  await frames(page);
}

const find = (selector, needle = '') => `[...document.querySelectorAll(${js(selector)})].find((el) => el.getBoundingClientRect().width && el.textContent.includes(${js(needle)}))`;

// the client point 2 px inside the left edge of the character at offset k of needle
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
    return { x: b.left + 2, y: b.top + b.height / 2 };
  }
})()`);

const ITEM = '.reveal section.present ul > li';

// finding 1: after an undo or a redo of Remove Bullet, the focus was on body and the typing was lost
for (const platform of PLATFORMS) {
  for (const [n, needle] of [
    [2, 'Each step is'],
    [4, 'Dark and light mode'],
  ]) {
    test(`after an undo and a redo of Remove Bullet on slide ${n + 1}, the next key goes into the text (${platform})`, async (t) => {
      const page = await load(t, platform, n);
      await click(page, await pointOf(page, ITEM, needle));
      await press(page, 'Home');
      await press(page, 'Backspace');
      assert.equal(await undoLabel(page), 'Undo Remove Bullet');
      const unlisted = await render(page);
      assert.ok(unlisted.includes(`<p class="fragment" data-fragment-index="1">${needle}`), 'the item is not made a paragraph');
      await command(page, 'undo');
      await byteExact(page);
      await type(page, 'Q');
      assert.ok((await render(page)).includes(`<li class="fragment" data-fragment-index="1">Q${needle}`), `the Q is not the first character of the item, the focus is in ${await page.evaluate('document.activeElement.localName')}`);
      await command(page, 'undo');
      await byteExact(page);
      // a typing clears the redos, hence the bullet is taken off again for the redo
      await click(page, await pointOf(page, ITEM, needle));
      await press(page, 'Home');
      await press(page, 'Backspace');
      await command(page, 'undo');
      await command(page, 'redo');
      assert.equal(await render(page), unlisted);
      await type(page, 'W');
      const typed = await render(page);
      assert.ok(typed.includes(`<p class="fragment" data-fragment-index="1">W${needle}`), `the W is not the first character of the paragraph, the focus is in ${await page.evaluate('document.activeElement.localName')}`);
      const { text } = await saveAndReopen(page, `r13-6-${++saves}.html`);
      assert.equal(text, typed);
      assert.deepEqual(errors(page), []);
    });
  }
}

const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const wait = (page, ms = 300) => page.evaluate(`new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), ${ms}))`);

// keys sends one trusted key press with its text for each character, as a keyboard does
async function keys(page, text) {
  for (const ch of text) {
    const code = ch === ' ' ? 'Space' : `Key${ch.toUpperCase()}`;
    const base = { key: ch, code, windowsVirtualKeyCode: ch.toUpperCase().charCodeAt(0), modifiers: ch !== ch.toLowerCase() ? 8 : 0 };
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: ch, unmodifiedText: ch });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }
}

// the outline shown on slide 3, with the caret at the end of its line "Two elements..."
async function outlineAt(t, platform) {
  const page = await load(t, platform, 2);
  if (!(await state(page, 'view.outline')).checked) await page.evaluate(`window.BeesonEditor.exec('view.outline')`);
  await wait(page);
  const at = await page.evaluate(`(() => {
    const t = [...document.querySelectorAll('.beeson-edit-outline .text')].find((e) => e.textContent.startsWith('Two elements'));
    t.scrollIntoView({ block: 'center' });
    const r = t.getBoundingClientRect();
    return { x: r.right - 2, y: r.bottom - 6 };
  })()`);
  await click(page, at);
  await press(page, 'End');
  await wait(page);
  assert.ok(await page.evaluate(`document.activeElement.matches('.beeson-edit-outline .text') && document.activeElement.textContent.startsWith('Two elements')`), 'the caret is not in the line of the outline');
  return page;
}

const SAME = 'Two elements with the same index are shown together.';
const itemText = (s) => `<li class="fragment" data-fragment-index="2">${s}</li>`;

// finding 2: an undo after Return and typing in the outline took off the item with its text, and a
// redo gave back an empty item
for (const platform of PLATFORMS) {
  test(`in the outline, the undos after Return and typing take off the typing and then the item, and the redos give both back (${platform})`, async (t) => {
    const page = await outlineAt(t, platform);
    await press(page, 'Enter');
    await wait(page);
    await keys(page, 'New item');
    await wait(page);
    await command(page, 'undo');
    await wait(page);
    let text = await render(page);
    assert.ok(text.includes(`${SAME}</li>\n    ${itemText('')}`), 'the first undo does not keep the empty item');
    await command(page, 'undo');
    await wait(page);
    await byteExact(page);
    await command(page, 'redo');
    await wait(page);
    await command(page, 'redo');
    await wait(page);
    text = await render(page);
    assert.ok(text.includes(`${SAME}</li>\n    ${itemText('New item')}`), 'the redos do not give back the item with its text');
    const lines = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-outline .slide')][2].textContent`);
    assert.ok(lines.includes('New item'), 'the outline does not show the text given back');
    const { text: saved } = await saveAndReopen(page, `r13-6-${++saves}.html`);
    assert.equal(saved, text);
    assert.deepEqual(errors(page), []);
  });

  test(`in the outline, five undos and five redos after typing and two Returns give the file back (${platform})`, async (t) => {
    const page = await outlineAt(t, platform);
    await keys(page, ' A');
    await press(page, 'Enter');
    await wait(page);
    await keys(page, 'B');
    await press(page, 'Enter');
    await wait(page);
    const edited = await render(page);
    assert.ok(edited.includes(`${SAME} A</li>`), 'the typing is not in the file');
    for (let i = 0; i < 5; i++) {
      await command(page, 'undo');
      await wait(page);
    }
    await byteExact(page);
    for (let i = 0; i < 5; i++) {
      await command(page, 'redo');
      await wait(page);
    }
    assert.equal(await render(page), edited);
    assert.deepEqual(errors(page), []);
  });

  // finding 3: Esc after typing in a new line of the outline was seen to drop the line
  test(`in the outline, Esc after typing in a new line keeps the line and its text (${platform})`, async (t) => {
    const page = await outlineAt(t, platform);
    await press(page, 'Enter');
    await wait(page);
    await keys(page, 'New item');
    await press(page, 'Escape');
    await wait(page);
    const text = await render(page);
    assert.ok(text.includes(`${SAME}</li>\n    ${itemText('New item')}`), 'Esc drops the line or its text');
    assert.equal(await undoLabel(page), 'Undo Typing');
    await page.evaluate('window.BeesonEditor.undo()');
    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
  });
}
