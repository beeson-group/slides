// the inserts of the toolbar, the clipboard commands, and the keys, on both platforms: Cut and
// Copy on a collapsed caret, Paste in the menu of a text, the keys of every command in the menus
// and in the sheet of shortcuts, the error color of the formula sheet, the insert cluster of the
// toolbar with its split buttons, and the keys moved off the keys that a browser takes before the
// page. each edit is checked byte for byte, after an undo and a redo, and after a save and an open
// of the saved text

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { center, click, press, saveAndReopen } from './helpers/editor.mjs';

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

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

// the editor on a deck served over HTTP, with the storage of the origin emptied first
async function load(t, platform, { deck = 'index.html', size = { width: 1600, height: 1000 }, scheme } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  if (scheme) await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(s.problems, []);
  await frames(page);
  return page;
}

// window.app is set to the app of the editor by the run of a command that the test defines
async function grabApp(page) {
  await page.evaluate(`window.BeesonEditorShell.define({ id: 'test.app', label: 'App', run: (a) => { window.app = a; } })`);
  await page.evaluate(`window.BeesonEditor.exec('test.app')`);
}

// the command, label, keys, and enabled state of each item of the last open menu
const menuRows = (page) => page.evaluate(`(() => { const m = [...document.querySelectorAll('.beeson-edit-menu')].at(-1); return m ? [...m.querySelectorAll('.item')].map((i) => ({ id: i.dataset.command ?? '', label: i.querySelector('.label')?.textContent ?? '', keys: i.querySelector('.keys')?.textContent ?? '', enabled: i.getAttribute('aria-disabled') !== 'true' })) : []; })()`);

// barMenu opens the menu of a title of the menu bar with a click, and returns its rows
async function barMenu(page, title) {
  await page.evaluate('window.BeesonEditorShell.closeMenus()');
  await sleep(30);
  const at = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-menubar button')].find((x) => x.textContent === ${JSON.stringify(title)}); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await sleep(80);
  return menuRows(page);
}

// caretInTitle collapses the caret in the heading of the title slide after its first n characters
async function caretInTitle(page, n = 4) {
  await page.evaluate('Reveal.slide(0)');
  await sleep(200);
  await click(page, await center(page, '.reveal section.present h1'));
  await sleep(100);
  await page.evaluate(`(() => { const h = document.querySelector('.reveal section.present h1'); getSelection().collapse(h.firstChild, ${n}); })()`);
  await sleep(50);
}

const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);

for (const platform of PLATFORMS) {
  test(`Cut and Copy are disabled while the caret is collapsed in a text, and enabled on a range (${platform})`, async (t) => {
    const page = await load(t, platform);
    await caretInTitle(page);
    assert.equal((await state(page, 'edit.cut')).enabled, false, 'Cut is enabled on a collapsed caret');
    assert.equal((await state(page, 'edit.copy')).enabled, false, 'Copy is enabled on a collapsed caret');
    assert.equal((await state(page, 'edit.paste')).enabled, true);
    const rows = await barMenu(page, 'Edit');
    const enabled = Object.fromEntries(rows.map((r) => [r.id, r.enabled]));
    assert.deepEqual([enabled['edit.cut'], enabled['edit.copy'], enabled['edit.paste']], [false, false, true], 'the Edit menu offers Cut or Copy on a collapsed caret');
    await page.evaluate('window.BeesonEditorShell.closeMenus()');
    // Shift+F10 opens the menu of the text at the caret
    await press(page, 'Shift+F10');
    await sleep(150);
    const context = await menuRows(page);
    assert.deepEqual(context.slice(0, 3).map((r) => [r.id, r.enabled]), [['edit.cut', false], ['edit.copy', false], ['edit.paste', true]]);
    await press(page, 'Escape');
    await sleep(50);
    await page.evaluate(`(() => { const t = document.querySelector('.reveal section.present h1').firstChild; getSelection().setBaseAndExtent(t, 0, t, 4); })()`);
    await sleep(50);
    assert.equal((await state(page, 'edit.cut')).enabled, true, 'Cut is disabled on a range');
    assert.equal((await state(page, 'edit.copy')).enabled, true, 'Copy is disabled on a range');
    assert.deepEqual(errors(page), []);
  });

  test(`Paste is a command of the menu of a text, and pastes there as Edit > Paste does (${platform})`, async (t) => {
    const page = await load(t, platform);
    await grabApp(page);
    assert.ok((await page.evaluate(`window.app.commands.forContext('text').map((c) => c.id)`)).includes('edit.paste'), 'Paste is not declared for the menu of a text');
    // the clipboard of the system is shared with the other tests, hence readText is a stub
    await page.evaluate(`navigator.clipboard.readText = async () => ' pasted'`);
    await caretInTitle(page, 10);
    await press(page, 'Shift+F10');
    await sleep(150);
    // Cut and Copy are disabled, hence Paste is the first item highlighted
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-menu .item.hi')?.dataset.command`), 'edit.paste');
    await press(page, 'Enter');
    await sleep(300);
    const fromContext = await render(page);
    assert.equal(await page.evaluate(`document.querySelector('.reveal section.present h1').textContent`), 'Presenting pasted in HTML');
    await page.evaluate('window.BeesonEditor.undo()');
    await sleep(150);
    assert.equal(await render(page), page.source);
    // Edit > Paste at the same caret writes the same file
    await caretInTitle(page, 10);
    await barMenu(page, 'Edit');
    await click(page, await center(page, '.beeson-edit-menu .item[data-command="edit.paste"]'));
    await sleep(300);
    assert.equal(await render(page), fromContext, 'the menu of a text and the Edit menu paste differently');
    await page.evaluate('window.BeesonEditor.undo()');
    await sleep(150);
    assert.equal(await render(page), page.source);
    await page.evaluate('window.BeesonEditor.redo()');
    await sleep(150);
    assert.equal(await render(page), fromContext);
    const { text } = await saveAndReopen(page, `r5-3-paste-${platform}.html`);
    assert.equal(text, fromContext);
    assert.deepEqual(errors(page), []);
  });

  test(`every command shows the keys it runs on, in its menu and in the sheet of shortcuts, each key once (${platform})`, async (t) => {
    const page = await load(t, platform);
    const mac = platform === 'mac';
    const slide = Object.fromEntries((await barMenu(page, 'Slide')).map((r) => [r.label, r.keys]));
    assert.equal(slide['Duplicate Slide'], mac ? '⌘D' : 'Ctrl+D');
    assert.equal(slide['Delete Slide'], mac ? '⌫' : 'Delete');
    assert.equal(slide['Move Slide Up'], mac ? '⌥↑' : 'Alt+Up Arrow');
    assert.equal(slide['Move Slide Down'], mac ? '⌥↓' : 'Alt+Down Arrow');
    const edit = Object.fromEntries((await barMenu(page, 'Edit')).map((r) => [r.label, r.keys]));
    assert.equal(edit.Duplicate, mac ? '⌘D' : 'Ctrl+D');
    await page.evaluate('window.BeesonEditorShell.closeMenus()');
    await page.evaluate(`window.BeesonEditor.exec('help.keys')`);
    await sleep(100);
    const rows = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-keys .row')].map((r) => ({ label: r.firstElementChild.textContent, keys: r.querySelector('kbd').textContent.split(', ') }))`);
    const keysOf = (label) => rows.find((r) => r.label === label)?.keys ?? [];
    assert.ok(keysOf('Duplicate Slide').includes(mac ? '⌘D' : 'Ctrl+D'), JSON.stringify(keysOf('Duplicate Slide')));
    assert.ok(keysOf('Delete Slide').includes(mac ? '⌫' : 'Delete'), JSON.stringify(keysOf('Delete Slide')));
    assert.ok(keysOf('Move Slide Up').includes(mac ? '⌥↑' : 'Alt+Up Arrow'), JSON.stringify(keysOf('Move Slide Up')));
    assert.ok(keysOf('Move Slide Down').includes(mac ? '⌥↓' : 'Alt+Down Arrow'), JSON.stringify(keysOf('Move Slide Down')));
    assert.ok(keysOf('Add Row Above').includes(mac ? '⌥↑' : 'Alt+Up Arrow'), 'Add Row Above lost its key');
    for (const r of rows) assert.equal(new Set(r.keys).size, r.keys.length, `${r.label} lists a key twice: ${r.keys}`);
    assert.deepEqual(errors(page), []);
  });

  for (const scheme of ['light', 'dark']) {
    test(`the error of the formula sheet is drawn in a color of the chrome, not in the red of the deck (${platform}, ${scheme})`, async (t) => {
      const page = await load(t, platform, { scheme });
      await page.evaluate(`document.documentElement.style.setProperty('--red', 'rgb(1, 2, 3)')`);
      await page.evaluate(`Reveal.slide([...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('.math mjx-container')))`);
      await sleep(250);
      await click(page, await center(page, '.reveal section.present .math mjx-container'));
      await page.waitFor(`!!document.querySelector('.beeson-math textarea')`);
      await page.evaluate(`(() => { const f = document.querySelector('.beeson-math textarea'); f.focus(); f.value = '\\\\frac{'; f.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await page.waitFor(`!!document.querySelector('.beeson-math .error:not(.prompt)')?.textContent`);
      const colors = await page.evaluate(`(() => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--ed-error)';
        document.querySelector('.beeson-math').append(probe);
        const out = { error: getComputedStyle(document.querySelector('.beeson-math .error')).color, token: getComputedStyle(probe).color, defined: getComputedStyle(document.documentElement).getPropertyValue('--ed-error').trim() };
        probe.remove();
        return out;
      })()`);
      assert.notEqual(colors.error, 'rgb(1, 2, 3)', 'the error of the formula sheet is drawn in the --red of the deck');
      assert.ok(colors.defined, 'the chrome does not define --ed-error');
      assert.equal(colors.error, colors.token);
      await press(page, 'Escape');
      assert.deepEqual(errors(page), []);
    });
  }
}

// the buttons of the insert group of the toolbar, with the command, the text, the shown label, and
// whether each is the main part of a split button
const insertGroup = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-top .group[data-group="insert"] .tb')].map((b) => ({ id: b.dataset.command, text: b.textContent, label: getComputedStyle(b.querySelector('.label')).display !== 'none', split: !!b.closest('.beeson-edit-split') }))`);

const LAYOUTS = 'test/pages/editor-layouts.html';
const MATH = readFileSync(LAYOUTS, 'utf8').split(/<section\b/).slice(1).findIndex((s) => s.includes('<h2>Math, an ordered list, and a zone</h2>'));

// a point of the slide given in slide px, in CSS px of the viewport
const screen = (page, x, y) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides');
  const r = s.getBoundingClientRect(), k = r.width / s.offsetWidth;
  return { x: r.left + ${x} * k, y: r.top + ${y} * k };
})()`);

for (const platform of PLATFORMS) {
  test(`the insert group of the toolbar is Table, Text, Formula, Shape, and Media, with labels while they fit (${platform})`, async (t) => {
    for (const [width, labels] of [[1600, true], [1000, true]]) {
      const page = await load(t, platform, { size: { width, height: 800 } });
      const group = await insertGroup(page);
      assert.deepEqual(group.map((b) => [b.id, b.text, b.split]), [
        ['insert.table', 'Table', false],
        ['insert.text', 'Text', false],
        ['insert.formula', 'Formula', false],
        ['insert.line', 'Shape', true],
        ['insert.image', 'Media', true],
      ], `${width}: the insert group`);
      assert.ok(group.every((b) => b.label === labels), `${width}: the labels`);
      assert.equal(await page.evaluate(`!!document.querySelector('.beeson-edit-top .more-groups')`), false, `${width}: the menu More`);
      const top = await page.evaluate(`(() => { const t = document.querySelector('.beeson-edit-top'); return { scroll: t.scrollWidth - t.clientWidth, h: t.getBoundingClientRect().height }; })()`);
      assert.ok(top.scroll <= 0, `${width}: the toolbar overflows by ${top.scroll} px`);
      assert.equal(top.h, 52);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });

  test(`the arrow of Media lists the inserts of a picture, and QR Code from it is inserted and undone byte for byte (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: LAYOUTS });
    await page.evaluate(`Reveal.slide(${MATH})`);
    await sleep(200);
    assert.equal(await page.evaluate(`document.querySelector('[data-command="insert.image"]').title`), 'Image…');
    await click(page, await center(page, '.beeson-edit-split:has([data-command="insert.image"]) .more'));
    await sleep(100);
    const rows = await menuRows(page);
    assert.deepEqual(rows.map((r) => r.label), ['Image…', 'Video…', 'QR Code', 'Choose File…']);
    assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-edit-menu .rule').length`), 1, 'Choose File… is not set apart by a rule');
    await click(page, await center(page, '.beeson-edit-menu .item[data-command="insert.qr"]'));
    await sleep(300);
    const edited = await render(page);
    assert.ok(edited.length > page.source.length && edited.includes('class="qr"'), 'QR Code of the list of Media did not insert a QR code');
    await page.evaluate('window.BeesonEditor.undo()');
    await sleep(150);
    assert.equal(await render(page), page.source);
    await page.evaluate('window.BeesonEditor.redo()');
    await sleep(150);
    assert.equal(await render(page), edited);
    const { text } = await saveAndReopen(page, `r5-3-qr-${platform}.html`);
    assert.equal(text, edited);
    assert.deepEqual(errors(page), []);
  });

  test(`Shape draws a line from its main part and an arrow from its list, and is pressed while one is drawn (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: LAYOUTS });
    await page.evaluate(`Reveal.slide(${MATH})`);
    await sleep(200);
    const shape = '.beeson-edit-top [data-command="insert.line"]';
    const pressed = () => page.evaluate(`document.querySelector('${shape}').getAttribute('aria-pressed')`);
    await click(page, await center(page, shape));
    await sleep(50);
    assert.equal((await state(page, 'insert.line')).checked, true, 'the main part of Shape does not draw a line');
    assert.equal(await pressed(), 'true');
    await press(page, 'Escape');
    await sleep(50);
    assert.notEqual(await pressed(), 'true', 'Shape is still pressed');
    await click(page, await center(page, '.beeson-edit-split:has([data-command="insert.line"]) .more'));
    await sleep(100);
    assert.deepEqual((await menuRows(page)).map((r) => r.label), ['Line', 'Arrow']);
    await click(page, await center(page, '.beeson-edit-menu .item[data-command="insert.arrow"]'));
    await sleep(50);
    assert.equal((await state(page, 'insert.arrow')).checked, true);
    assert.equal(await pressed(), 'true', 'Shape is not pressed while an arrow is drawn');
    const a = await screen(page, 200, 300);
    const b = await screen(page, 600, 330);
    // the drag is made with the modifier of a move without the snap, Meta on a Mac and Alt elsewhere
    const bits = platform === 'mac' ? 4 : 1;
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a.x, y: a.y, modifiers: bits });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: a.x, y: a.y, button: 'left', buttons: 1, clickCount: 1, modifiers: bits });
    for (let i = 1; i <= 10; i++) await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a.x + ((b.x - a.x) * i) / 10, y: a.y + ((b.y - a.y) * i) / 10, button: 'left', buttons: 1, modifiers: bits });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1, modifiers: bits });
    await sleep(200);
    const edited = await render(page);
    assert.ok(edited.includes('<svg class="line'), 'the drag did not draw an arrow');
    assert.ok(edited.includes('marker-end'), 'the line drawn is not an arrow');
    assert.notEqual(await pressed(), 'true', 'Shape is still pressed');
    await page.evaluate('window.BeesonEditor.undo()');
    await sleep(150);
    assert.equal(await render(page), page.source);
    await page.evaluate('window.BeesonEditor.redo()');
    await sleep(150);
    assert.equal(await render(page), edited);
    const { text } = await saveAndReopen(page, `r5-3-arrow-${platform}.html`);
    assert.equal(text, edited);
    assert.deepEqual(errors(page), []);
  });
}

// keys that a browser on the platform takes before the page, from the table of keys.md of R5.3:
// the reserved commands of Chromium and the keys of Firefox marked reserved. Cmd+R and Cmd+L,
// which Safari alone keeps, are listed after their fallbacks in Safari only, as editor-r8-4 tests
const TAKEN = {
  mac: ['Mod+N', 'Mod+Shift+N', 'Mod+T', 'Mod+Shift+T', 'Mod+W', 'Mod+Shift+W', 'Mod+Q', 'Mod+Shift+P', 'Ctrl+Tab', 'Ctrl+Shift+Tab', 'Ctrl+PageUp', 'Ctrl+PageDown', 'Ctrl+Home', 'Mod+Alt+ArrowLeft', 'Mod+Alt+ArrowRight', 'Mod+Shift+[', 'Mod+Shift+]', 'Mod+Shift+{', 'Mod+Shift+}'],
  other: ['Mod+N', 'Mod+Shift+N', 'Mod+T', 'Mod+Shift+T', 'Mod+W', 'Mod+Shift+W', 'Mod+Shift+P', 'Mod+Shift+Q', 'Mod+F4', 'Alt+F4', 'F11', 'Ctrl+Tab', 'Ctrl+Shift+Tab', 'Ctrl+PageUp', 'Ctrl+PageDown'],
};

for (const platform of PLATFORMS) {
  test(`no menu shows a key that a browser takes before the page, and Rulers and Lock run on their new keys (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: LAYOUTS });
    const mac = platform === 'mac';
    await grabApp(page);
    const keys = await page.evaluate(`window.app.commands.list().filter((c) => c.keys?.${platform}).map((c) => ({ id: c.id, keys: c.keys.${platform} }))`);
    for (const c of keys) {
      // a key taken by Safari alone may stay behind the key shown, for Chrome and Firefox
      const shown = mac ? c.keys.slice(0, 1) : c.keys;
      for (const k of shown) assert.ok(!TAKEN[platform].includes(k), `${c.id} shows ${k}, which a browser takes before the page`);
    }
    const pinned = Object.fromEntries(keys.map((c) => [c.id, c.keys]));
    assert.deepEqual(pinned['view.rulers'], mac ? ['Mod+R', 'Ctrl+Mod+R'] : undefined);
    assert.deepEqual(pinned['arrange.lock'], mac ? ['Mod+L', 'Ctrl+Mod+L'] : ['Mod+L']);
    const view = Object.fromEntries((await barMenu(page, 'View')).map((r) => [r.label, r.keys]));
    assert.equal(view.Rulers, mac ? '⌘R' : '');
    const arrange = Object.fromEntries((await barMenu(page, 'Arrange')).map((r) => [r.label, r.keys]));
    assert.equal(arrange.Lock, mac ? '⌘L' : 'Ctrl+L');
    await page.evaluate('window.BeesonEditorShell.closeMenus()');
    await page.evaluate(`window.BeesonEditor.exec('help.keys')`);
    await sleep(100);
    const rows = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-keys .row')].map((r) => ({ label: r.firstElementChild.textContent, keys: r.querySelector('kbd').textContent.split(', ') }))`);
    assert.deepEqual(rows.find((r) => r.label === 'Lock')?.keys, mac ? ['⌘L', '⌃⌘L'] : ['Ctrl+L']);
    if (mac) assert.deepEqual(rows.find((r) => r.label === 'Rulers')?.keys, ['⌘R', '⌃⌘R']);
    await press(page, 'Escape');
    await sleep(50);
    if (mac) {
      const rulers = (await state(page, 'view.rulers')).checked;
      await press(page, 'Ctrl+Mod+R');
      await frames(page);
      assert.equal((await state(page, 'view.rulers')).checked, !rulers, 'Ctrl+Cmd+R does not toggle the rulers');
      await press(page, 'Ctrl+Mod+R');
      await frames(page);
      assert.equal((await state(page, 'view.rulers')).checked, rulers);
    }
    // Lock on its new key writes data-locked on the QR code of the title slide, byte for byte
    await page.evaluate('Reveal.slide(0)');
    await sleep(200);
    await click(page, await center(page, '.reveal section.present > .qr'));
    await sleep(50);
    await press(page, mac ? 'Ctrl+Mod+L' : 'Mod+L');
    await sleep(100);
    const edited = await render(page);
    const qr = page.source.match(/<div class="qr"[^>]*>/)[0];
    assert.equal(edited, page.source.replace(qr, qr.replace(/>$/, ' data-locked>')));
    await page.evaluate('window.BeesonEditor.undo()');
    await sleep(150);
    assert.equal(await render(page), page.source);
    await page.evaluate('window.BeesonEditor.redo()');
    await sleep(150);
    assert.equal(await render(page), edited);
    const { text } = await saveAndReopen(page, `r5-3-lock-${platform}.html`);
    assert.equal(text, edited);
    assert.deepEqual(errors(page), []);
  });
}
