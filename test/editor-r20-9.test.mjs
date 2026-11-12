// regression tests of R20.9 on both platforms, for the findings F3, F9, F10, F20, F4, F5, F11,
// and F21 of the final review of round 7 on the text, the keys, and the fields of the editor

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { center, click, press, type } from './helpers/editor.mjs';

const DECK = 'index.html';
const PAGE = 'test/pages/editor-r20-9.html';
const PLATFORMS = ['mac', 'other'];
const SLIDE = '.reveal .slides > section.present';

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
const wait = (page, ms = 300) => page.evaluate(`new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), ${ms}))`);
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const labels = async (page) => [(await state(page, 'edit.undo')).label, (await state(page, 'edit.redo')).label];
const rect = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

async function load(t, platform, { deck = DECK, slide = 0 } = {}) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${slide})`);
  await wait(page);
  return page;
}

// selects the characters from to to of the first text node under within that holds needle
const select = (page, needle, from, to, within = SLIDE) => page.evaluate(`(() => {
  const w = document.createTreeWalker(document.querySelector(${js(within)}), NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const i = n.data.indexOf(${js(needle)});
    if (i < 0) continue;
    n.parentElement.closest('[contenteditable="true"]').focus();
    getSelection().setBaseAndExtent(n, i + ${from}, n, i + ${to});
    return getSelection().toString();
  }
  return null;
})()`);
const nested = (text) => (text.match(/<ol start="3">[\s\S]*?<\/ol>/) ?? ['?'])[0].replace(/\s+/g, ' ');

// F3: Return in a nested item, its undo, its redo, and a typed k. the k goes to the start of the
// second part, or into the second new empty item when the whole item was selected
for (const platform of PLATFORMS) {
  for (const [name, needle, from, to, want] of [
    ['a caret after Nes', 'Nested one', 3, 3, '<li>Nes</li> <li>kted one</li>'],
    ['ste selected', 'Nested one', 2, 5, '<li>Ne</li> <li>kd one</li>'],
    ['the whole of Nested two', 'Nested two', 0, 10, '<li>Nested one</li> <li></li> <li>k</li>'],
  ]) {
    test(`F3 ${platform}: a redo of Return in a nested item with ${name} puts the caret into the second part`, async (t) => {
      const page = await load(t, platform, { deck: PAGE });
      assert.notEqual(await select(page, needle, from, to), null);
      await press(page, 'Enter');
      await wait(page);
      const split = await render(page);
      await press(page, 'Mod+Z');
      await wait(page);
      await press(page, 'Mod+Shift+Z');
      await wait(page);
      assert.equal(await render(page), split, 'the redo does not give the file after Return');
      await press(page, 'k');
      await wait(page, 600);
      assert.ok(nested(await render(page)).includes(want), nested(await render(page)));
      assert.deepEqual(errors(page), []);
    });
  }
}

// slide 3 of the demo deck with View > Outline on and the caret at the start of its line 'Each step'
async function outlineLine(t, platform) {
  const page = await load(t, platform, { slide: 2 });
  await exec(page, 'view.outline');
  await wait(page);
  const at = await page.evaluate(`(() => { const t = [...document.querySelectorAll('.beeson-edit-outline .text')].find((e) => e.textContent.startsWith('Each step')); t.scrollIntoView({ block: 'center' }); const r = t.getBoundingClientRect(); return { x: r.left + 30, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await wait(page);
  await page.evaluate(`(() => { const r = document.createRange(); r.selectNodeContents(document.activeElement); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); return true; })()`);
  return page;
}
const slidesWith = (page, word) => page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].map((s, i) => s.textContent.includes(${js(word)}) ? i : -1).filter((i) => i >= 0)`);

// F9: Mod+D in a line of the outline writes the typed text first, as an entry of its own, and the
// copy of the slide holds it
for (const platform of PLATFORMS) {
  test(`F9 ${platform}: Mod+D in a line of the outline duplicates the slide with the text typed in the line`, async (t) => {
    const page = await outlineLine(t, platform);
    await type(page, 'XYZ ');
    await wait(page);
    await press(page, 'Mod+D');
    await wait(page, 500);
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal .slides > section').length`), 13);
    assert.deepEqual(await slidesWith(page, 'XYZ'), [2, 3]);
    assert.equal((await render(page)).match(/XYZ/g)?.length, 2);
    assert.deepEqual(await labels(page), ['Undo Duplicate Slide', 'Redo']);
    await undo(page);
    await wait(page, 300);
    assert.deepEqual(await slidesWith(page, 'XYZ'), [2]);
    assert.equal((await labels(page))[0], 'Undo Typing');
    await undo(page);
    await wait(page, 300);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}

// F10: Mod+B and Mod+I in a line of the outline do not run the native bold or italic of the
// browser, since a line of the outline does not take a format
for (const platform of PLATFORMS) {
  for (const key of ['Mod+B', 'Mod+I']) {
    test(`F10 ${platform}: ${key} in a line of the outline does not write a tag into the file`, async (t) => {
      const page = await outlineLine(t, platform);
      await page.evaluate(`(() => { const w = document.createTreeWalker(document.activeElement, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { const i = n.data.indexOf(', with a'); if (i >= 0) { getSelection().collapse(n, i + 7); return true; } } return false; })()`);
      for (let i = 0; i < 4; i++) await press(page, 'Shift+ArrowRight');
      assert.equal(await page.evaluate('getSelection().toString()'), 'a da');
      await press(page, key);
      await wait(page);
      assert.equal(await page.evaluate(`document.activeElement.innerHTML.includes('<b>') || document.activeElement.innerHTML.includes('<i>')`), false);
      await press(page, 'Escape');
      await wait(page, 300);
      assert.equal(await render(page), page.source);
      assert.deepEqual(errors(page), []);
    });
  }
}

const FIGURES = 4;
const IMG = `${SLIDE} figure.zone img.for-dark`;
const focused = (page) => page.evaluate(`(() => { const a = document.activeElement; return a ? a.localName + (a.id ? '#' + a.id : '') : null; })()`);
const findItem = `(l) => [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.getClientRects().length && (i.querySelector('.label')?.firstChild?.textContent ?? '').startsWith(l))`;

// the item of the menu bar named bar whose label starts with label, chosen by trusted clicks
async function choose(page, bar, label) {
  await click(page, await rect(page, `[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)})`));
  await wait(page, 200);
  const at = await rect(page, `(${findItem})(${js(label)})`);
  assert.ok(at, `the ${bar} menu does not have ${label}`);
  await click(page, at);
}

// F20: Redo Duplicate with 300 typed into X redoes the duplicate, and the typed value gives way,
// since the redone entry selects the copy. the original figure is not moved
for (const platform of PLATFORMS) {
  for (const how of ['toolbar', 'menu']) {
    test(`F20 ${platform}: Redo Duplicate from the ${how} with a value typed into X does not move the original`, async (t) => {
      const page = await load(t, platform, { slide: FIGURES });
      await click(page, await center(page, IMG));
      await wait(page);
      await exec(page, 'edit.duplicate');
      await wait(page, 500);
      const done = await render(page);
      assert.notEqual(done, page.source);
      await undo(page);
      await wait(page, 500);
      assert.equal(await render(page), page.source);
      await exec(page, 'arrange.sizeAndPosition');
      await wait(page, 400);
      await click(page, await center(page, '#beeson-edit-num-x'));
      await page.evaluate(`document.querySelector('#beeson-edit-num-x').select()`);
      await type(page, '300');
      await wait(page);
      assert.equal(await focused(page), 'input#beeson-edit-num-x');
      assert.deepEqual(await labels(page), ['Undo', 'Redo Duplicate']);
      if (how === 'toolbar') await click(page, await center(page, '[data-command="edit.redo"]'));
      else await choose(page, 'Edit', 'Redo');
      await wait(page, 700);
      assert.ok((await render(page)) === done, 'the redo is not the file after the duplicate');
      assert.deepEqual(await labels(page), ['Undo Duplicate', 'Redo']);
      await undo(page);
      await wait(page, 500);
      assert.equal(await render(page), page.source);
      assert.deepEqual(await labels(page), ['Undo', 'Redo Duplicate']);
      assert.deepEqual(errors(page), []);
    });
  }
}

const INLINE = 1;
const MOD = { mac: 4, other: 2 };
const line = (text, start) => text.slice(text.indexOf(start), text.indexOf('</p>', text.indexOf(start)) + 4);

// a key with the modifier of the platform and with the editing command of a real keyboard, which
// press() does not send
async function chord(page, platform, key, command) {
  const base = { key, code: `Key${key.toUpperCase()}`, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0), modifiers: MOD[platform], commands: [command] };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await wait(page);
}

// F4: the italic taken off the whole text of <em>styles </em>, or off styles alone, does not leave
// an element around the space
for (const platform of PLATFORMS) {
  for (const [how, to] of [['Mod+I', 7], ['text.italic', 7], ['text.clear', 7], ['Mod+I', 6]]) {
    test(`F4 ${platform}: ${how} over ${to === 7 ? 'styles with its space' : 'styles'} in an em takes the italic off without an em around the space`, async (t) => {
      const page = await load(t, platform, { deck: PAGE, slide: INLINE });
      assert.equal(await select(page, 'styles ', 0, to), 'styles '.slice(0, to));
      if (how.startsWith('Mod+')) await press(page, how);
      else await exec(page, how);
      await wait(page);
      const text = await render(page);
      assert.equal(line(text, '<p>Some'), '<p>Some styles of it.</p>');
      await undo(page);
      await wait(page);
      assert.ok((await render(page)) === page.source, 'the undo does not give the file back');
      assert.deepEqual(errors(page), []);
    });
  }
}

// F5: a cut of a word that is the whole text of an em or a strong leaves one space between the
// words around it
for (const platform of PLATFORMS) {
  for (const how of ['Mod+X', 'menu']) {
    for (const [needle, start, want] of [['word', '<p>See', '<p>See the here.</p>'], ['big', '<p>Call', '<p>Call the fox, now.</p>']]) {
      test(`F5 ${platform}: a cut of ${needle} from ${how}, the whole text of an inline element, leaves one space`, async (t) => {
        const page = await load(t, platform, { deck: PAGE, slide: INLINE });
        assert.equal(await select(page, needle, 0, needle.length), needle);
        if (how === 'menu') {
          await choose(page, 'Edit', 'Cut');
          await page.waitFor(`window.BeesonEditor.render() !== ${js(page.source)}`).catch(() => {});
          await wait(page);
        } else await chord(page, platform, 'x', 'cut');
        await wait(page);
        assert.equal(line(await render(page), start), want);
        assert.equal((await labels(page))[0], 'Undo Cut');
        await undo(page);
        await wait(page);
        assert.ok((await render(page)) === page.source, 'the undo does not give the file back');
        assert.deepEqual(errors(page), []);
      });
    }
  }
}

const LI = `document.querySelector('${SLIDE} li')`;

// the caret after the fourth character of the first item of slide 3 of the demo deck
async function caretInItem(t, platform) {
  const page = await load(t, platform, { slide: 2 });
  await click(page, await page.evaluate(`(() => { const r = ${LI}.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`));
  await wait(page);
  await page.evaluate(`(() => { getSelection().collapse(${LI}.firstChild, 4); return true; })()`);
  return page;
}
const keyed = (page) => page.evaluate(`({ active: document.activeElement === ${LI}, undo: window.BeesonEditor.state('edit.undo').label, dialogs: [...document.querySelectorAll('dialog[open]')].length, find: !!document.querySelector('.beeson-find:not([hidden]), .beeson-edit-find:not([hidden])') })`);

// F11: on a Mac, Control with a letter in a text is left to the text, as a key of macOS, e.g.
// Control-D deletes forward, and it does not run the command of Command with the letter
for (const key of ['Ctrl+D', 'Ctrl+K', 'Ctrl+F', 'Ctrl+B']) {
  test(`F11 mac: ${key} with the caret in a text does not run a command`, async (t) => {
    const page = await caretInItem(t, 'mac');
    await press(page, key);
    await wait(page);
    assert.deepEqual(await keyed(page), { active: true, undo: 'Undo', dialogs: 0, find: false });
    assert.ok((await render(page)) === page.source, 'the file changed');
    assert.deepEqual(errors(page), []);
  });
}

// Mod+D in a text still duplicates the block of the caret, i.e. Command-D on a Mac and Control-D
// elsewhere
for (const platform of PLATFORMS) {
  test(`F11 ${platform}: Mod+D with the caret in a text duplicates its block`, async (t) => {
    const page = await caretInItem(t, platform);
    await press(page, 'Mod+D');
    await wait(page, 500);
    assert.equal((await keyed(page)).undo, 'Undo Duplicate');
    assert.deepEqual(errors(page), []);
  });
}

const tab = (page, name) => rect(page, `[...document.querySelectorAll('.beeson-edit-inspector .ed-tabs button')].find((b) => b.textContent.trim() === ${js(name)})`);

// F21: Export of the paragraph of slide 5 made bold, X of the Arrange pane focused, and the bold
// undone from the toolbar or with Mod+Z. the Text pane then acts on the paragraph
for (const platform of PLATFORMS) {
  for (const how of ['toolbar', 'Mod+Z']) {
    test(`F21 ${platform}: an undo from ${how} with the focus in X leaves Bold and the tones enabled`, async (t) => {
      const page = await load(t, platform, { slide: FIGURES });
      const word = await rect(page, `(() => { const p = Reveal.getCurrentSlide().querySelector(':scope > p'); const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { const i = n.data.indexOf('Export'); if (i >= 0) { const r = document.createRange(); r.setStart(n, i + 1); r.setEnd(n, i + 2); return r; } } return null; })()`);
      await click(page, word, { count: 2 });
      await wait(page);
      assert.equal(await page.evaluate('getSelection().toString()'), 'Export');
      await press(page, 'Mod+B');
      await wait(page, 400);
      assert.equal((await labels(page))[0], 'Undo Bold');
      if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
      await wait(page);
      await click(page, await tab(page, 'Arrange'));
      await wait(page);
      await click(page, await center(page, '#beeson-edit-num-x'));
      await wait(page);
      if (how === 'toolbar') await click(page, await center(page, '[data-command="edit.undo"]'));
      else await press(page, 'Mod+Z');
      await wait(page, 600);
      assert.ok((await render(page)) === page.source, 'the undo does not give the file back');
      assert.equal((await state(page, 'text.bold')).enabled, true);
      await click(page, await tab(page, 'Text'));
      await wait(page);
      const red = await rect(page, `[...document.querySelectorAll('.beeson-edit-inspector .ed-swatches button')].find((b) => /red/i.test(b.title))`);
      assert.ok(red, 'the Text pane does not have a Red swatch');
      assert.equal(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-inspector .ed-swatches button')].filter((b) => b.disabled || b.getAttribute('aria-disabled') === 'true').length`), 0);
      await click(page, red);
      await wait(page, 500);
      assert.ok((await render(page)).includes('tone-red'), 'Red was not applied');
      assert.equal((await labels(page))[0], 'Undo Text Color');
      await undo(page);
      await wait(page, 300);
      assert.ok((await render(page)) === page.source, 'the undo of Red does not give the file back');
      assert.deepEqual(errors(page), []);
    });
  }
}
