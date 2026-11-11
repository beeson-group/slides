// regression tests of R9.7, the shell of the editor, on both platforms with trusted input: the
// overflow of the toolbar, the keys of the panes and of the chrome, the order of the menu bar, the
// keys of the dialogs, the tree of the accessibility checker, a typed zoom, and the details of the
// status bar and the View menu

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, center, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

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
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const run = (page, id) => page.evaluate(`window.BeesonEditor.exec(${js(id)}).then(() => true)`);
let saves = 0;

// the editor on the slide n of the demo deck served over HTTP, in a window of width by height px.
// the storage of the browser is cleared before the load, and then given the pairs of stored
async function load(t, platform, { n = 0, mode = 'light', width = 1600, height = 1000, stored = {} } = {}) {
  const page = await browser.newPage({ width, height });
  t.after(() => page.close().catch(() => {}));
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }] });
  const url = `${server.origin}/index.html?edit&still&theme=${mode}&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${js(stored)})) localStorage.setItem(k, v); true`);
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('index.html', 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks the text before byte for byte after an undo, the edit after a redo, and an
// open of the saved edit without problems
async function roundTrip(page) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r9-7-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

// the buttons of the toolbar in view: the command of each, its edges, and whether its label is
// shown, with the overflow of the toolbar in px and the buttons past the right edge of the window
const BAR = `(() => {
  const t = document.querySelector('.beeson-edit-top');
  const bs = [...t.querySelectorAll('button.tb')].filter((b) => b.getClientRects().length).map((b) => {
    const r = b.getBoundingClientRect();
    const l = b.querySelector('.label');
    return { id: b.dataset.command ?? (b.classList.contains('more-groups') ? 'more' : ''), left: Math.round(r.left), right: Math.round(r.right), label: !!l && getComputedStyle(l).display !== 'none' };
  });
  return { over: t.scrollWidth - t.clientWidth, buttons: bs, off: bs.filter((b) => b.right > innerWidth).map((b) => b.id) };
})()`;

const TOOLBAR_KEY = 'beeson-edit-toolbar:/index.html';

// the labels of the items of the open menu
const menuLabels = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item .label')].map((l) => l.textContent)`);

// shell-1 and shell-3: a toolbar wider than the window put its last buttons off screen, and the
// labels were hidden below 1100 px whatever the choice of Show
for (const platform of PLATFORMS) {
  test(`a customized toolbar wider than the window folds its last groups into » and keeps every button in view (${platform})`, async (t) => {
    for (const width of [1280, 1100]) {
      const page = await load(t, platform, { width, height: 900 });
      await run(page, 'view.customizeToolbar');
      for (const id of ['file.open', 'find.open', 'view.notes', 'view.accessibility', 'play.rehearse', 'arrange.group']) {
        await page.evaluate(`document.querySelector('.beeson-edit-customize .item[data-item="${id}"]').focus()`);
        await press(page, 'Enter');
      }
      await click(page, '.beeson-edit-customize .done');
      await frames(page);
      const bar = await page.evaluate(BAR);
      assert.deepEqual(bar.off, [], `${width}: buttons off screen`);
      assert.ok(bar.over <= 0, `${width}: the toolbar overflows by ${bar.over} px`);
      assert.ok(bar.buttons.some((b) => b.id === "more"), `${width}: no » menu ${js(bar)}`);
      assert.ok(bar.buttons.every((b) => b.label), `${width}: the labels are hidden`);
      // the folded buttons are items of the menu », and none of them is also in the toolbar
      await click(page, '.beeson-edit-top .more-groups');
      assert.ok((await menuLabels(page)).length > 0, `${width}: the menu » is empty`);
      for (const { id } of bar.buttons) if (id !== 'more') assert.ok(await page.evaluate(`!document.querySelector('.beeson-edit-menu .item[data-command="${id}"]')`), `${width}: ${id} is both in the toolbar and in »`);
      await press(page, 'Escape');
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });

  test(`the labels of the default toolbar are kept at every width at which they fit (${platform})`, async (t) => {
    for (const width of [1100, 1099, 1000]) {
      const page = await load(t, platform, { width, height: 800 });
      const bar = await page.evaluate(BAR);
      assert.ok(bar.buttons.every((b) => b.label), `${width}: the labels are hidden`);
      assert.ok(bar.over <= 0, `${width}: the toolbar overflows by ${bar.over} px`);
      assert.ok(!bar.buttons.some((b) => b.id === 'more'), `${width}: » is shown though every button fits`);
      await page.close();
    }
    // with Icon Only, the labels stay hidden at a width at which they fit
    const page = await load(t, platform, { width: 1600, height: 900, stored: { [TOOLBAR_KEY]: js({ items: null, show: 'icon' }) } });
    assert.ok((await page.evaluate(BAR)).buttons.every((b) => !b.label), 'a label is shown with Icon Only');
    assert.deepEqual(errors(page), []);
  });
}

// the slide of the demo deck with the figure and the paragraph that starts with Export, counted
// from 0
const FIGURES = 4;
const KEYS = {
  toolbar: { mac: ['Alt+Mod+T', '⌥⌘T'], other: ['Ctrl+F1', 'Ctrl+F1'] },
  format: { mac: ['Ctrl+Mod+1', '⌃⌘1'], other: ['Ctrl+Shift+1', 'Ctrl+Shift+1'] },
  steps: { mac: ['Ctrl+Mod+2', '⌃⌘2'], other: ['Ctrl+Shift+2', 'Ctrl+Shift+2'] },
  notes: { mac: ['Ctrl+Mod+3', '⌃⌘3'], other: ['Ctrl+Shift+3', 'Ctrl+Shift+3'] },
  deselect: { mac: ['Mod+Shift+A', '⇧⌘A'], other: ['Mod+Shift+A', 'Ctrl+Shift+A'] },
  useSelection: { mac: ['Mod+E', '⌘E'], other: ['Mod+E', 'Ctrl+E'] },
};

// the rows of the sheet of keyboard shortcuts, each as its label and its keys
async function sheetRows(page) {
  await run(page, 'help.keys');
  const rows = await page.evaluate(`Object.fromEntries([...document.querySelectorAll('.beeson-edit-keys .row')].map((r) => [r.children[0].textContent, r.children[1].textContent]))`);
  await press(page, 'Escape');
  return rows;
}

// the items of a menu of the menu bar, each as its label and its key
async function menuKeys(page, title) {
  await click(page, `.beeson-edit-menubar [role=menuitem]:nth-child(${(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].findIndex((b) => b.textContent === ${js(title)})`)) + 1})`);
  const items = await page.evaluate(`Object.fromEntries([...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => [i.querySelector('.label')?.textContent, i.querySelector('.keys, .key, kbd')?.textContent ?? '']))`);
  await press(page, 'Escape');
  return items;
}

const checked = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)}).checked`);

// shell-5 and menus-keys-10: the toolbar could not be hidden, the panes did not have keys, and
// Deselect All and Use Selection for Find of Keynote did nothing
for (const platform of PLATFORMS) {
  test(`View has Hide Toolbar, and the toolbar, the panes, Deselect All, and Use Selection for Find have keys in the menus and the sheet (${platform})`, async (t) => {
    const page = await load(t, platform, { n: FIGURES });
    const key = (name) => KEYS[name][platform][0];
    const shown = (name) => KEYS[name][platform][1];
    const view = await menuKeys(page, 'View');
    assert.equal(view['Hide Toolbar'], shown('toolbar'), 'View > Hide Toolbar');
    assert.equal(view.Format, shown('format'));
    assert.equal(view.Steps, shown('steps'));
    assert.equal(view.Notes, shown('notes'));
    const edit = await menuKeys(page, 'Edit');
    assert.match(edit.Deselect ?? edit['Deselect All'], new RegExp(shown('deselect').replace(/[+]/g, '\\+')));
    assert.equal(edit['Use Selection for Find'], shown('useSelection'));
    const sheet = await sheetRows(page);
    assert.equal(sheet['Hide Toolbar'], shown('toolbar'));
    assert.equal(sheet['Use Selection for Find'], shown('useSelection'));
    for (const name of ['format', 'steps', 'notes']) assert.ok(Object.values(sheet).includes(shown(name)), `the sheet does not list ${shown(name)}`);

    // the toolbar is hidden and shown again, and the slide gets its row
    const topShown = () => page.evaluate(`document.querySelector('.beeson-edit-top').getClientRects().length > 0`);
    await press(page, key('toolbar'));
    assert.equal(await topShown(), false, 'the key does not hide the toolbar');
    assert.equal((await menuKeys(page, 'View'))['Show Toolbar'], shown('toolbar'));
    await press(page, key('toolbar'));
    assert.equal(await topShown(), true, 'the key does not show the toolbar again');

    // the inspector, the steps, and the notes are switched by their keys
    assert.equal(await checked(page, 'shell.format'), true);
    await press(page, key('format'));
    assert.equal(await checked(page, 'shell.format'), false, 'the key of Format does not hide the inspector');
    await press(page, key('steps'));
    assert.equal(await checked(page, 'view.steps'), true, 'the key of Steps does not show the steps');
    await press(page, key('format'));
    assert.equal(await checked(page, 'shell.format'), true, 'the key of Format does not show the Format tab');
    const notes = await checked(page, 'view.notes');
    await press(page, key('notes'));
    assert.equal(await checked(page, 'view.notes'), !notes, 'the key of Notes does not switch the notes');
    await press(page, key('notes'));

    // Deselect All clears a selected figure
    await click(page, '.reveal section.present figure img');
    assert.ok((await page.evaluate('window.BeesonEditor.selection().length')) > 0, 'the figure is not selected');
    await press(page, key('deselect'));
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 0, 'Deselect All leaves the figure selected');

    // Use Selection for Find takes a word selected in a text as the query
    const word = await center(page, '.reveal section.present > p');
    await click(page, { x: word.x - 200, y: word.y });
    await click(page, { x: word.x - 200, y: word.y }, { count: 2 });
    const selected = await page.evaluate('getSelection().toString().trim()');
    assert.ok(selected.length > 1, 'no word is selected');
    await press(page, key('useSelection'));
    assert.equal(await page.evaluate(`document.querySelector('.beeson-find input')?.value`), selected, 'the selection is not the query of Find');
    assert.deepEqual(errors(page), []);
  });
}

// menus-keys-5: eight commands had a key on the Mac only. each is listed in the sheet on Windows
// and Linux with a key that does not hold Ctrl and Alt together, i.e. AltGr
const OTHER_KEYS = {
  'Edit Mask': 'Ctrl+Shift+M',
  'Merge Cells': 'Alt+Shift+M',
  'Delete Row': 'Ctrl+Shift+Backspace',
  'Delete Column': 'Alt+Shift+Backspace',
  'Auto-Align': 'Alt+Shift+U',
  'Hide Slide': 'Ctrl+Shift+H',
  Rulers: 'Alt+Shift+R',
  'Show Guides': 'Alt+F9',
};

test('the commands with a key on the Mac have a key on Windows and Linux, listed in the sheet, and the keys run them (other)', async (t) => {
  const page = await load(t, 'other', { n: FIGURES });
  const sheet = await sheetRows(page);
  for (const [label, key] of Object.entries(OTHER_KEYS)) {
    assert.equal(sheet[label], key, `${label} is listed with ${sheet[label]}`);
    assert.doesNotMatch(key, /Ctrl\+Alt|Alt\+Ctrl/);
  }
  assert.deepEqual(await page.evaluate('window.BeesonEditorShell.sheetClashes()'), []);
  assert.deepEqual(await page.evaluate('window.BeesonEditorShell.keyClashes(true)'), []);
  // Rulers and Show Guides are switched by their keys
  for (const [key, id] of [['Alt+Shift+R', 'view.rulers'], ['Alt+F9', 'view.guides']]) {
    const was = await checked(page, id);
    await press(page, key);
    assert.equal(await checked(page, id), !was, `${key} does not switch ${id}`);
    await press(page, key);
  }
  // Edit Mask is opened on a picture
  await click(page, '.reveal section.present figure img');
  await press(page, 'Ctrl+Shift+M');
  assert.equal(await page.evaluate(`window.BeesonEditor.state('image.editMask').enabled`), false, 'Ctrl+Shift+M does not open the mask');
  await press(page, 'Escape');
  await press(page, 'Escape');
  await press(page, 'Escape');
  // Hide Slide hides the current slide, as one entry of the history
  await press(page, 'Ctrl+Shift+H');
  assert.equal(await page.evaluate(`document.querySelector('.reveal .slides > section.present').dataset.visibility`), 'hidden', 'Ctrl+Shift+H does not hide the slide');
  await roundTrip(page);
});

// menus-keys-9: Slide came after Arrange, where Keynote puts it between Insert and Format
for (const platform of PLATFORMS) {
  test(`the menu bar has the order of Keynote (${platform})`, async (t) => {
    const page = await load(t, platform);
    const titles = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].map((b) => b.textContent)`);
    assert.deepEqual(titles, ['File', 'Edit', 'Insert', 'Slide', 'Format', 'Arrange', 'View', 'Play', 'Help']);
    // the sheet of shortcuts lists the menus in the same order
    await run(page, 'help.keys');
    const heads = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-keys h3')].map((h) => h.textContent).filter((h) => !['Other', 'Mouse'].includes(h))`);
    assert.deepEqual(heads, titles.filter((h) => heads.includes(h)));
    assert.deepEqual(errors(page), []);
  });
}

// a trusted Return with its character, which presses a focused button as a key of a user does
async function enter(page) {
  const base = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: '\r', unmodifiedText: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

// a trusted ?, typed with Shift on a US layout
async function question(page) {
  const base = { key: '?', code: 'Slash', windowsVirtualKeyCode: 191, modifiers: 8 };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: '?', unmodifiedText: '/' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

// whether the focus is inside the element of selector
const focusIn = (page, selector) => page.evaluate(`!!document.activeElement?.closest(${js(selector)})`);
const open = (page, selector) => page.evaluate(`!!document.querySelector(${js(selector)})?.open`);

// dialogs-undo-a11y-5: Tab left the Link popover, and Esc then did not close it
for (const platform of PLATFORMS) {
  test(`Tab stays inside the Link popover, and Esc closes it at the first press (${platform})`, async (t) => {
    const page = await load(t, platform, { n: FIGURES });
    const p = await center(page, '.reveal section.present > p');
    await click(page, { x: p.x - 200, y: p.y });
    await click(page, { x: p.x - 200, y: p.y }, { count: 2 });
    await press(page, 'Mod+K');
    assert.ok(await open(page, 'dialog.beeson-edit-link'), 'the Link popover is not open');
    for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Tab']) {
      await press(page, key);
      assert.ok(await focusIn(page, 'dialog.beeson-edit-link'), `the focus leaves the popover after ${key}`);
    }
    await press(page, 'Escape');
    assert.equal(await open(page, 'dialog.beeson-edit-link'), false, 'the first Esc does not close the popover');
    assert.ok(await focusIn(page, '.reveal section.present > p'), 'the focus does not go back to the paragraph');
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  // dialogs-undo-a11y-9: Tab left the sheet of shortcuts, and after Tab and Shift+Tab the first
  // Esc was ignored
  test(`Tab stays inside the sheet of keyboard shortcuts, and Esc closes it at the first press (${platform})`, async (t) => {
    const page = await load(t, platform);
    // the focus is on the thumbnail of the current slide, where ? is taken
    await click(page, '.beeson-edit-nav .row[aria-current="true"], .beeson-edit-nav [aria-current="true"]');
    const before = await page.evaluate(`document.activeElement.outerHTML.slice(0, 80)`);
    await question(page);
    assert.ok(await open(page, 'dialog.beeson-edit-keys'), '? does not open the sheet');
    for (const key of ['Tab', 'Shift+Tab', 'Tab']) {
      await press(page, key);
      assert.ok(await focusIn(page, 'dialog.beeson-edit-keys'), `the focus leaves the sheet after ${key}`);
    }
    await press(page, 'Escape');
    assert.equal(await open(page, 'dialog.beeson-edit-keys'), false, 'the first Esc does not close the sheet');
    assert.equal(await page.evaluate(`document.activeElement.outerHTML.slice(0, 80)`), before, 'the focus does not go back');
    assert.deepEqual(errors(page), []);
  });

  // dialogs-undo-a11y-6: Return in the field of Grid Settings did not press OK, and its field had
  // the ring of the browser
  test(`Return in the field of Grid Settings presses OK, and the field has the focus ring of the editor (${platform})`, async (t) => {
    const page = await load(t, platform);
    void run(page, 'view.grid.settings');
    await page.waitFor(`!!document.querySelector('dialog.beeson-grid-sheet[open] input[name="spacing"]')`);
    assert.equal(await page.evaluate(`document.activeElement.name`), 'spacing');
    await press(page, 'Tab');
    await press(page, 'Shift+Tab');
    const ring = await page.evaluate(`(() => { const s = getComputedStyle(document.activeElement); return { style: s.outlineStyle, color: s.outlineColor }; })()`);
    const focus = await page.evaluate(`(() => { const p = document.createElement('div'); p.style.color = 'var(--ed-focus)'; document.querySelector('dialog.beeson-grid-sheet').append(p); const c = getComputedStyle(p).color; p.remove(); return c; })()`);
    assert.deepEqual(ring, { style: 'solid', color: focus }, 'the field does not have the ring of the editor');
    await page.evaluate(`document.activeElement.select()`);
    await type(page, '60');
    await enter(page);
    assert.equal(await open(page, 'dialog.beeson-grid-sheet'), false, 'Return does not close the sheet');
    void run(page, 'view.grid.settings');
    await page.waitFor(`!!document.querySelector('dialog.beeson-grid-sheet[open] input[name="spacing"]')`);
    assert.equal(await page.evaluate(`document.activeElement.value`), '60', 'Return does not apply the spacing');
    await press(page, 'Escape');
    assert.deepEqual(errors(page), []);
  });
}

// dialogs-undo-a11y-10: on the Mac, Return on the card of Present with unsaved changes pressed
// Cancel, the focused button, though Save and Present is drawn as the default
for (const [platform, answer] of [['mac', 'save'], ['other', 'cancel']]) {
  test(`Return on the card of Present with unsaved changes presses ${answer === 'save' ? 'the default button' : 'the focused button'} (${platform})`, async (t) => {
    const page = await load(t, platform, { n: FIGURES });
    await page.evaluate(`(async () => {
      window.opened = 0;
      window.open = () => { window.opened++; return null; };
      const root = await navigator.storage.getDirectory();
      window.BeesonEditor.attach(await root.getFileHandle('r9-7-present.html', { create: true }));
      return true;
    })()`);
    const p = await center(page, '.reveal section.present > p');
    await click(page, { x: p.x, y: p.y });
    await click(page, { x: p.x, y: p.y });
    await press(page, 'End');
    await type(page, 'x');
    await press(page, 'Escape');
    void run(page, 'file.present');
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-card.ask[open]')`);
    await enter(page);
    await page.waitFor(`!document.querySelector('dialog.beeson-edit-card.ask[open]')`);
    await sleep(300);
    if (answer === 'save') {
      assert.equal(await page.evaluate('window.opened'), 1, 'the show is not opened');
      assert.equal(await page.evaluate('window.BeesonEditor.status().dirty'), false, 'the deck is not saved');
    } else assert.equal(await page.evaluate('window.opened'), 0);
    assert.deepEqual(errors(page), []);
  });
}
