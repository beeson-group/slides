// regression tests of R18.6 on both platforms with trusted keys: a format set on a word selected
// with the space after it, as a double-click selects a word on Windows, leaves the space out, and a
// cut of a word between a space and a space or a punctuation mark takes the space before it out, as
// Chrome does only on macOS, apart from a text of code. the selections are set with a Range, since a
// double-click on a Mac does not select the space and Chrome on a Mac takes the space off a cut of a
// double-clicked word by itself. each edit is undone to the file byte for byte and redone

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test/pages/editor-r18-6.html';
const MOD = { mac: 4, other: 2 };

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
let saves = 0;

async function load(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${DECK}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  page.platform = platform;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate('Reveal.slide(0)');
  await frames(page);
  await page.send('Browser.grantPermissions', { origin: server.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
  return page;
}

// the characters from of the text node that holds needle in the block of selector, up to to, are
// selected in the focused text, as a double-click or a drag selects them
const select = (page, selector, needle, from, to) => page.evaluate(`(() => {
  const el = document.querySelector('.reveal section.present ' + ${js(selector)});
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const i = n.data.indexOf(${js(needle)});
    if (i < 0) continue;
    el.closest('[contenteditable="true"]').focus();
    getSelection().setBaseAndExtent(n, i + ${from}, n, i + ${to});
    return getSelection().toString();
  }
  return null;
})()`);

// the edit checked against page.source after an undo, again after a redo, and after a save and an
// open
async function roundTrip(page, edited) {
  assert.equal(await render(page), edited);
  await undo(page);
  assert.equal(await render(page), page.source, 'the undo does not give the file back byte for byte');
  await redo(page);
  assert.equal(await render(page), edited, 'the redo does not give the edit back');
  const { text } = await saveAndReopen(page, `r18-6-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
}

// a key with the modifier of the platform and with the editing command of a real keyboard, which
// press() does not send
async function chord(page, key, command) {
  const base = { key, code: `Key${key.toUpperCase()}`, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0), modifiers: MOD[page.platform], commands: [command] };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await frames(page);
}

const rect = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const MENU_ITEM = (label) => `[...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.getClientRects().length && i.querySelector('.label')?.textContent === ${js(label)})`;

// Cut of the Edit menu of the menu bar, clicked
async function menuCut(page) {
  await click(page, await rect(page, `[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === 'Edit')`));
  await frames(page);
  await click(page, await rect(page, MENU_ITEM('Cut')));
  await page.waitFor(`window.BeesonEditor.render() !== ${js(page.source)}`).catch(() => {});
  await frames(page);
  await page.evaluate('window.BeesonEditorShell?.closeMenus?.(); true');
  await frames(page);
}

const CUTS = { 'Mod+X': (page) => chord(page, 'x', 'cut'), 'Cut of the Edit menu': menuCut };

const FORMATS = {
  Italic: [() => 'Mod+I', 'em'],
  Bold: [() => 'Mod+B', 'strong'],
  Strikethrough: [(platform) => (platform === 'mac' ? 'Mod+Shift+X' : 'Alt+Shift+5'), 's'],
};

for (const platform of PLATFORMS) {
  // item 2 of the laptop report: Windows wrote <em>styles </em>of
  for (const [name, [keys, tag]] of Object.entries(FORMATS)) {
    test(`${name} on a word selected with the space after it leaves the space out of the format (${platform})`, async (t) => {
      const page = await load(t, platform);
      assert.equal(await select(page, 'p', 'styles of', 0, 7), 'styles ');
      await press(page, keys(platform));
      await frames(page);
      const edited = page.source.replace('the styles of', `the <${tag}>styles</${tag}> of`);
      const text = await render(page);
      assert.equal(text, edited, `${name} formats the space: ${js(text.match(/Export[^\n]*/)?.[0])}`);
      assert.equal(await undoLabel(page), `Undo ${name}`);
      await roundTrip(page, edited);
    });
  }

  // item 3 of the laptop report: a cut on Windows and Linux left "of the . It will"
  for (const [name, cut] of Object.entries(CUTS)) {
    test(`${name} of a word before a full stop takes the space before it out (${platform})`, async (t) => {
      const page = await load(t, platform);
      assert.equal(await select(page, 'p', 'template.', 0, 8), 'template');
      await cut(page);
      const edited = page.source.replace('of the template. It', 'of the. It');
      const text = await render(page);
      assert.equal(text, edited, `${name} leaves the space: ${js(text.match(/Export[^\n]*/)?.[0])}`);
      assert.equal(await undoLabel(page), 'Undo Cut');
      await roundTrip(page, edited);
    });

    test(`${name} of a word between two spaces takes one space out (${platform})`, async (t) => {
      const page = await load(t, platform);
      assert.equal(await select(page, 'p', 'styles of', 0, 6), 'styles');
      await cut(page);
      await roundTrip(page, page.source.replace('the styles of', 'the of'));
    });

    // a space of code is a part of the code
    for (const [where, selector, before] of [['inline code', 'p code', 'f(a, b)'], ['a code box', 'pre code', 'g(a, b)']]) {
      test(`${name} of a word in ${where} keeps the space before it (${platform})`, async (t) => {
        const page = await load(t, platform);
        assert.equal(await select(page, selector, before, 5, 6), 'b');
        await cut(page);
        const edited = page.source.replace(before, before.replace('b', ''));
        const text = await render(page);
        assert.equal(text, edited, `${name} takes a space of the code out: ${js(text.match(/[fg]\(a,[^<]*/g))}`);
        await roundTrip(page, edited);
      });
    }
  }
}
