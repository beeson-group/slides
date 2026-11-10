// the keys of the editor, sent as trusted input on both platforms: one dispatch runs the command
// of a key in the region of the focus, the keys of reveal.js are off, and the sheet of the keys
// lists every command with a key

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { launch } from '../scripts/chrome.mjs';
import { byteExact, click, editorPage, press, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const HEADING = ['<h2>Text, a list, and a backdrop</h2>', '<h2>Text, a list, and a backdrop now</h2>'];

const keysPage = async (browser, platform) => {
  const page = await editorPage(browser, { deck: LAYOUTS, query: `edit&still&edit-platform=${platform}` });
  // the keys seen by a listener after the dispatch, with whether the default was prevented
  await page.evaluate(`(() => { window.__keys = []; window.addEventListener('keydown', (e) => window.__keys.push([e.key, e.defaultPrevented]), true); })()`);
  return page;
};

const slide = (page) => page.evaluate('Reveal.getIndices().h');
const prevented = (page) => page.evaluate('window.__keys.splice(0).map(([key, p]) => key + (p ? ":prevented" : ""))');
const blur = (page) => page.evaluate('document.activeElement.blur()');

// a trusted key with its key, code, and Windows key code given, for a key that press() does not
// know, e.g. ? or a key code of the pause of reveal.js
async function raw(page, key, code, keyCode, modifiers = 0) {
  const text = key.length === 1 && !(modifiers & 6) ? key : undefined;
  await page.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key, code, windowsVirtualKeyCode: keyCode, modifiers, ...(text ? { text, unmodifiedText: text } : {}) });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, modifiers });
}

for (const platform of PLATFORMS) {
  const redo = platform === 'mac' ? 'Mod+Shift+Z' : 'Mod+Y';
  const other = platform === 'mac' ? 'Mod+Y' : 'Mod+Shift+Z';
  const fallback = platform === 'mac' ? 'Ctrl+Z' : 'Meta+Z';

  test(`undo and redo are named after the typing and run by every key of ${platform}`, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await keysPage(browser, platform);
    await page.evaluate('Reveal.slide(2)');
    await click(page, '.reveal section.present > h2');
    await press(page, 'End');
    await type(page, ' now');
    await byteExact(page, [HEADING]);
    assert.equal((await page.evaluate(`window.BeesonEditor.state('edit.undo')`)).label, 'Undo Typing');
    assert.equal((await page.evaluate(`window.BeesonEditor.state('edit.redo')`)).label, 'Redo');
    await press(page, 'Mod+Z');
    await page.waitFor('!window.BeesonEditor.status().undo');
    await byteExact(page);
    assert.deepEqual(await page.evaluate(`window.BeesonEditor.state('edit.redo')`), { id: 'edit.redo', label: 'Redo Typing', enabled: true, checked: null });
    await press(page, redo);
    await page.waitFor('!window.BeesonEditor.status().redo');
    await byteExact(page, [HEADING]);
    // the fallback modifier, Control on a Mac and Meta elsewhere, undoes too
    await press(page, fallback);
    await page.waitFor('!window.BeesonEditor.status().undo');
    await byteExact(page);
    await press(page, other);
    await page.waitFor('!window.BeesonEditor.status().redo');
    await byteExact(page, [HEADING]);
    assert.deepEqual(await prevented(page), ['End', 'z:prevented', redo.endsWith('Z') ? 'Z:prevented' : 'y:prevented', 'z:prevented', other.endsWith('Z') ? 'Z:prevented' : 'y:prevented']);
    assert.deepEqual(page.errors, []);
  });

  test(`in a text, Backspace, Select All, and the clipboard keys are left to the browser on ${platform}`, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await keysPage(browser, platform);
    await page.evaluate('Reveal.slide(2)');
    await click(page, '.reveal section.present > h2');
    await press(page, 'End');
    for (const key of ['Backspace', 'Mod+A', 'Mod+C', 'Mod+X', 'Mod+V', 'D', 'G', 'PageDown', 'Home']) await press(page, key);
    assert.deepEqual(await prevented(page), ['End', 'Backspace', 'a', 'c', 'x', 'v', 'd', 'g', 'PageDown', 'Home']);
    assert.equal(await slide(page), 2);
    assert.equal(await page.evaluate('window.BeesonEditor.status().undo'), true);
    assert.deepEqual(page.errors, []);
  });

  test(`the keys of reveal.js do nothing on ${platform}, and the slides are changed by the commands`, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await keysPage(browser, platform);
    await blur(page);
    for (const key of ['B', 'O', 'Escape', 'Space', 'N', 'P', 'F', 'V']) await press(page, key);
    // the colon and the semicolon, whose key codes 58 and 59 pause reveal.js in Firefox
    await raw(page, ':', 'Semicolon', 58, 8);
    await raw(page, ';', 'Semicolon', 59);
    await raw(page, '.', 'Period', 190);
    assert.deepEqual(await page.evaluate('({ h: Reveal.getIndices().h, paused: Reveal.isPaused(), overview: Reveal.isOverview(), keyboard: Reveal.getConfig().keyboard })'), { h: 0, paused: false, overview: false, keyboard: false });
    assert.deepEqual(await prevented(page), ['b', 'o', 'Escape', ' ', 'n', 'p', 'f', 'v', ':', ';', '.']);
    await press(page, 'PageDown');
    assert.equal(await slide(page), 1);
    await press(page, 'ArrowRight');
    await press(page, 'ArrowDown');
    assert.equal(await slide(page), 3);
    await press(page, 'PageUp');
    await press(page, 'ArrowLeft');
    assert.equal(await slide(page), 1);
    await press(page, 'End');
    assert.equal(await slide(page), 16);
    await press(page, 'PageDown');
    assert.equal(await slide(page), 16);
    await press(page, 'Home');
    assert.equal(await slide(page), 0);
    await press(page, 'ArrowUp');
    assert.equal(await slide(page), 0);
    // with a block selected, an arrow nudges it and the slide stays
    await page.evaluate('Reveal.slide(2)');
    await click(page, '.reveal section.present > h2');
    await press(page, 'Escape');
    await press(page, 'ArrowRight');
    assert.equal(await slide(page), 2);
    assert.equal(await page.evaluate(`document.querySelector('.reveal section.present > h2').style.translate`), '1px');
    assert.deepEqual(page.errors, []);
  });

  test(`G opens the field of the slide number on ${platform}, and D flips only the slide`, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await keysPage(browser, platform);
    await blur(page);
    await press(page, 'G');
    assert.equal(await page.evaluate('document.activeElement.className'), 'jump-to-slide-input');
    await type(page, '5');
    await press(page, 'Enter');
    assert.equal(await slide(page), 4);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-goto').hidden`), true);
    // Esc closes the field and gives the focus back
    const row = `document.querySelectorAll('.beeson-edit-nav .row')[4]`;
    await page.evaluate(`${row}.focus()`);
    await press(page, 'G');
    assert.equal(await page.evaluate('document.activeElement.className'), 'jump-to-slide-input');
    await press(page, 'Escape');
    assert.equal(await page.evaluate(`document.activeElement === ${row}`), true);
    // a plain key on a button of the bars is left to the button
    await page.evaluate(`document.querySelector('.beeson-edit-bottom button').focus()`);
    await press(page, 'G');
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-goto').hidden`), true);
    await blur(page);
    if (platform === 'mac') {
      await press(page, 'Ctrl+Mod+G');
      assert.equal(await page.evaluate('document.activeElement.className'), 'jump-to-slide-input');
      await type(page, '99');
      await press(page, 'Enter');
      assert.equal(await slide(page), 16);
    }
    const mode = () => page.evaluate(`({ theme: Beeson.theme.get(), checked: window.BeesonEditor.state('view.slideDark').checked })`);
    const before = await mode();
    assert.equal(before.checked, before.theme === 'dark');
    await press(page, 'D');
    const after = await mode();
    assert.notEqual(after.theme, before.theme);
    assert.equal(after.checked, after.theme === 'dark');
    await press(page, 'D');
    assert.deepEqual(await mode(), before);
    assert.deepEqual(page.errors, []);
  });

  test(`F6 moves the focus through the regions of the window on ${platform}`, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await keysPage(browser, platform);
    await page.evaluate(`(() => { for (const id of ['view.notes', 'view.steps']) if (!window.BeesonEditor.state(id).checked) window.BeesonEditor.exec(id); if (!window.BeesonEditor.state('view.navigator').checked) window.BeesonEditor.exec('view.navigator'); })()`);
    await blur(page);
    const where = () => page.evaluate(`(() => {
      const a = document.activeElement;
      if (a === document.body) return 'canvas';
      if (a.closest('aside.notes')) return 'notes';
      for (const [name, sel] of [['menubar', '.beeson-edit-menubar'], ['toolbar', '.beeson-edit-top'], ['navigator', '.beeson-edit-nav'], ['inspector', '.beeson-edit-side'], ['status', '.beeson-edit-bottom']]) if (a.closest(sel)) return name;
      return a.tagName;
    })()`);
    const seen = [];
    for (let i = 0; i < 7; i++) {
      await press(page, 'F6');
      seen.push(await where());
    }
    assert.deepEqual(seen, ['notes', 'inspector', 'status', 'menubar', 'toolbar', 'navigator', 'canvas']);
    const back = [];
    for (let i = 0; i < 7; i++) {
      await press(page, 'Shift+F6');
      back.push(await where());
    }
    assert.deepEqual(back, ['navigator', 'toolbar', 'menubar', 'status', 'inspector', 'notes', 'canvas']);
    // F6 is taken in a text too
    await click(page, '.reveal section.present h1');
    await press(page, 'F6');
    assert.equal(await where(), 'notes');
    assert.deepEqual(page.errors, []);
  });

  test(`? opens the sheet of every command with a key on ${platform}`, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await keysPage(browser, platform);
    await blur(page);
    await raw(page, '?', 'Slash', 191, 8);
    const sheet = await page.evaluate(`(() => {
      const d = document.querySelector('dialog.beeson-edit-keys');
      return { open: d.open, focused: d.contains(document.activeElement), bars: [...d.querySelectorAll('h3')].map((h) => h.textContent), rows: Object.fromEntries([...d.querySelectorAll('.row')].map((r) => [r.firstChild.textContent, r.lastChild.textContent])) };
    })()`);
    assert.equal(sheet.open, true);
    assert.equal(sheet.focused, true);
    assert.deepEqual(sheet.bars.slice(0, 2), ['File', 'Edit']);
    const mac = platform === 'mac';
    const expected = {
      'Open…': mac ? '⌘O' : 'Ctrl+O',
      Save: mac ? '⌘S' : 'Ctrl+S',
      'Save As…': mac ? '⇧⌘S' : 'Ctrl+Shift+S',
      Present: mac ? '⌘↩' : 'Ctrl+Enter',
      'Present from Start': mac ? '⇧⌘↩' : 'Ctrl+Shift+Enter',
      Undo: mac ? '⌘Z' : 'Ctrl+Z',
      Redo: mac ? '⇧⌘Z, ⌘Y' : 'Ctrl+Y, Ctrl+Shift+Z',
      'Slide in Dark Mode': 'D',
      'Next Slide': mac ? '⇟, →, ↓' : 'Page Down, →, ↓',
      'Previous Slide': mac ? '⇞, ←, ↑' : 'Page Up, ←, ↑',
      'First Slide': mac ? '↖' : 'Home',
      'Last Slide': mac ? '↘' : 'End',
      'Go to Slide…': mac ? 'G, ⌃⌘G' : 'G',
      'Next Pane': 'F6',
      'Previous Pane': mac ? '⇧F6' : 'Shift+F6',
      'Keyboard Shortcuts': '?',
    };
    for (const [label, keys] of Object.entries(expected)) assert.equal(sheet.rows[label], keys, label);
    // every key of Windows and Linux is free of Ctrl+Alt, which AltGr sends
    if (!mac) for (const keys of Object.values(sheet.rows)) assert.doesNotMatch(keys, /Ctrl\+Alt/);
    // only the keys of the sheet are live while it is open, and Esc closes it
    await press(page, 'D');
    await press(page, 'PageDown');
    assert.equal(await slide(page), 0);
    await press(page, 'Escape');
    assert.equal(await page.evaluate(`document.querySelector('dialog.beeson-edit-keys').open`), false);
    await page.waitFor('document.activeElement === document.body', 2000);
    assert.deepEqual(page.errors, []);
  });

  test(`Save, Save As, Open, and Present are run by their keys on ${platform}`, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await keysPage(browser, platform);
    await page.evaluate(`(() => {
      window.__written = [];
      window.BeesonEditor.attach({ name: 'deck.html', createWritable: async () => ({ write: async (text) => window.__written.push(text), close: async () => {} }) });
      window.showSaveFilePicker = async () => { window.__picker = 'save'; throw new DOMException('cancelled', 'AbortError'); };
      window.showOpenFilePicker = async () => { window.__picker = 'open'; throw new DOMException('cancelled', 'AbortError'); };
      window.open = (url) => { window.__opened = url; return null; };
    })()`);
    await page.evaluate('Reveal.slide(2)');
    await click(page, '.reveal section.present > h2');
    await press(page, 'End');
    await type(page, ' now');
    // Save is taken in a text
    await press(page, 'Mod+S');
    await page.waitFor('window.__written.length === 1 && !window.BeesonEditor.status().dirty');
    assert.ok((await page.evaluate('window.__written[0]')).includes(HEADING[1]));
    await press(page, 'Mod+Shift+S');
    await page.waitFor(`window.__picker === 'save'`);
    await blur(page);
    await press(page, 'Mod+O');
    await page.waitFor(`window.__picker === 'open'`);
    const hash = await page.evaluate('location.hash');
    await press(page, 'Mod+Enter');
    await page.waitFor('!!window.__opened');
    assert.ok((await page.evaluate('window.__opened')).endsWith(`?still&edit-platform=${platform}#/2`));
    await page.evaluate('window.__opened = null');
    await press(page, 'Mod+Shift+Enter');
    await page.waitFor('!!window.__opened');
    assert.ok((await page.evaluate('window.__opened')).endsWith(`?still&edit-platform=${platform}`));
    assert.equal(await page.evaluate('location.hash'), hash);
    assert.equal(await slide(page), 2);
    assert.deepEqual(page.errors, []);
  });
}
