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
  const url = `${server.origin}/test-deck.html?edit&still&theme=${mode}&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${js(stored)})) localStorage.setItem(k, v); true`);
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('test-deck.html', 'utf8');
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

const TOOLBAR_KEY = 'beeson-edit-toolbar:/test-deck.html';

// the labels of the items of the open menu
const menuLabels = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item .label')].map((l) => l.textContent)`);

// shell-1 and shell-3: a toolbar wider than the window put its last buttons off screen, and the
// labels were hidden below 1100 px whatever the choice of Show
for (const platform of PLATFORMS) {
  test(`a customized toolbar wider than the window folds its last groups into » and keeps every button in view (${platform})`, async (t) => {
    for (const width of [1280, 1100]) {
      const page = await load(t, platform, { width, height: 900 });
      await run(page, 'view.customizeToolbar');
      for (const id of ['file.open', 'find.open', 'view.notes', 'arrange.ungroup', 'play.rehearse', 'arrange.group']) {
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
    // the default toolbar with its labels fits a window 948 px wide
    for (const width of [1100, 1099, 1024]) {
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
  // Rulers is switched by its key
  for (const [key, id] of [['Alt+Shift+R', 'view.rulers']]) {
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

// dialogs-undo-a11y-10: on the Mac, Return on the dialog of Present with unsaved changes pressed
// Cancel, the focused button, though Save and Present is drawn as the default
for (const [platform, answer] of [['mac', 'save'], ['other', 'cancel']]) {
  test(`Return on the card of Present with unsaved changes presses ${answer === 'save' ? 'the default button' : 'the focused button'} (${platform})`, async (t) => {
    const page = await load(t, platform, { n: FIGURES });
    await page.evaluate(`(async () => {
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
    // the show is played in place, in the frame of .beeson-edit-show over the editor
    const shown = () => page.evaluate(`!!document.querySelector('.beeson-edit-show')`);
    if (answer === 'save') {
      assert.equal(await shown(), true, 'the show is not opened');
      // the save is written to the file asynchronously, and it may end after 300 ms on a slow runner
      await page.waitFor('window.BeesonEditor.status().dirty === false').catch(() => {});
      assert.equal(await page.evaluate('window.BeesonEditor.status().dirty'), false, 'the deck is not saved');
    } else assert.equal(await shown(), false);
    assert.deepEqual(errors(page), []);
  });
}

// navigator-slides-canvas-8: the zoom was set only to the steps of the menu, the slider, or the
// wheel, without a field for a typed percentage as the Zoom dialog of PowerPoint has
async function clickItem(page, label) {
  const at = await page.evaluate(`(() => { const i = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label')?.textContent === ${js(label)}); if (!i) return null; const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  assert.ok(at, `the open menu does not have ${label}`);
  await click(page, at);
}
const percentText = (page) => page.evaluate(`document.querySelector('.beeson-edit-bottom .percent .value').textContent`);
for (const platform of PLATFORMS) {
  test(`a typed percentage sets the zoom from the status bar and from View > Zoom (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, '.beeson-edit-bottom .percent');
    await clickItem(page, 'Zoom…');
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-card[open] input[name="percent"]')`);
    assert.equal(await page.evaluate(`document.activeElement.name`), 'percent');
    await page.evaluate(`document.activeElement.select()`);
    await type(page, '140');
    await enter(page);
    await frames(page);
    assert.equal(await percentText(page), '140%', 'the typed percentage is not the zoom');
    // a percentage out of range is clamped to the range of the slider, 10 to 400 percent
    for (const [typed, shown] of [['1000', '400%'], ['5', '10%']]) {
      void run(page, 'zoom.custom');
      await page.waitFor(`!!document.querySelector('dialog.beeson-edit-card[open] input[name="percent"]')`);
      await page.evaluate(`document.activeElement.select()`);
      await type(page, typed);
      await enter(page);
      await frames(page);
      assert.equal(await percentText(page), shown, `${typed} is not clamped`);
    }
    // Esc leaves the zoom as it is
    void run(page, 'zoom.custom');
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-card[open] input[name="percent"]')`);
    assert.equal(await page.evaluate(`document.activeElement.value`), '10');
    await type(page, '7');
    await press(page, 'Escape');
    await frames(page);
    assert.equal(await percentText(page), '10%');
    assert.deepEqual(errors(page), []);
  });
}

// shell-4: the face of the Zoom popup of the toolbar read Fit while the status bar showed the
// percentage, and its item was Fit rather than Fit Slide as in Keynote
for (const platform of PLATFORMS) {
  test(`the face of the Zoom popup shows the percentage, and its item is Fit Slide (${platform})`, async (t) => {
    const page = await load(t, platform);
    const face = () => page.evaluate(`document.querySelector('.beeson-edit-top [data-command="toolbar.zoom"] .readout').textContent`);
    assert.match(await percentText(page), /^\d+%$/);
    assert.equal(await face(), await percentText(page), 'the face does not show the fitted percentage');
    await click(page, '.beeson-edit-top [data-command="toolbar.zoom"]');
    const items = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => [i.querySelector('.label').textContent, i.getAttribute('aria-checked')])`);
    assert.deepEqual(items[0], ['Fit Slide', 'true']);
    await clickItem(page, '200%');
    await frames(page);
    assert.equal(await face(), '200%');
    assert.deepEqual(errors(page), []);
  });
}

// shell-6: the status bar showed one sentence of help whatever the selection, cut with an ellipsis
for (const platform of PLATFORMS) {
  test(`the status bar does not show a fixed sentence of help (${platform})`, async (t) => {
    const page = await load(t, platform, { width: 1440 });
    const cut = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom *')].filter((e) => e.children.length === 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow === 'ellipsis').map((e) => e.textContent)`);
    assert.deepEqual(cut, [], 'a text of the status bar is cut');
    assert.ok(!(await page.evaluate(`document.querySelector('.beeson-edit-bottom').textContent`)).includes('Click a text'), 'the sentence of help is shown');
  });
}

// shell-8: Customize Toolbar did not dim the items already in the toolbar
for (const platform of PLATFORMS) {
  test(`Customize Toolbar dims the items that the toolbar holds (${platform})`, async (t) => {
    const page = await load(t, platform);
    await run(page, 'view.customizeToolbar');
    const item = (id) => page.evaluate(`(() => { const i = document.querySelector('.beeson-edit-customize .item[data-item="${id}"]'); return { disabled: i.getAttribute('aria-disabled'), opacity: Number(getComputedStyle(i).opacity) }; })()`);
    const undo = await item('edit.undo');
    assert.equal(undo.disabled, 'true', 'Undo is not dimmed though it is in the toolbar');
    assert.ok(undo.opacity < 1);
    assert.deepEqual(await item('file.open'), { disabled: null, opacity: 1 });
    await page.evaluate(`document.querySelector('.beeson-edit-customize .item[data-item="file.open"]').focus()`);
    await press(page, 'Enter');
    assert.equal((await item('file.open')).disabled, 'true', 'Open is not dimmed once added');
    await click(page, '.beeson-edit-customize .done');
    assert.deepEqual(errors(page), []);
  });
}

// shell-10: the View menu and the View popup listed the views in two orders, and the status bar
// called the navigator Slides. the View button of the toolbar is a split button since R22.1
const VIEWS = ['Navigator', 'Slide Only', 'Slide Sorter', 'Format', 'Steps', 'Notes'];
for (const platform of PLATFORMS) {
  test(`the View menu lists the views in the order of Keynote, with one name each (${platform})`, async (t) => {
    const page = await load(t, platform);
    const menu = Object.keys(await menuKeys(page, 'View')).filter((l) => VIEWS.includes(l));
    assert.deepEqual(menu, VIEWS, 'the View menu');
    assert.ok(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].some((b) => b.textContent === 'Navigator')`), 'the status bar does not name the navigator');
  });
}

// shell-11: the resize cursor was lost while the edge of the navigator was dragged past its limit
for (const platform of PLATFORMS) {
  test(`the resize cursor stays while the edge of the navigator is dragged past its limit (${platform})`, async (t) => {
    const page = await load(t, platform);
    const from = await center(page, '.beeson-edit-nav-edge');
    await drag(page, from, { dx: 500, hold: true });
    const at = { x: from.x + 500, y: from.y };
    const cursor = await page.evaluate(`getComputedStyle(document.elementFromPoint(${at.x}, ${at.y})).cursor`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', clickCount: 1 });
    assert.equal(cursor, 'ew-resize', 'the cursor past the limit');
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-nav').getBoundingClientRect().width`), 360);
    assert.equal(await page.evaluate(`getComputedStyle(document.body).cursor`), 'auto', 'the cursor is kept after the drag');
  });
}

// shell-12: the notes pane had a frame in the color of the focus while the caret was in it
for (const platform of PLATFORMS) {
  test(`the notes pane does not have a frame while it has the focus (${platform})`, async (t) => {
    const page = await load(t, platform);
    await run(page, 'view.notes');
    await frames(page);
    const outline = await page.evaluate(`(() => { const n = document.querySelector('.reveal .slides section.present > aside.notes'); return [document.activeElement === n, getComputedStyle(n).outlineColor]; })()`);
    assert.deepEqual(outline, [true, 'rgba(0, 0, 0, 0)']);
  });
}

// laptop round 4: on a German or an Italian layout, [, ], and \ are typed with AltGr, hence Ctrl+],
// Ctrl+[, and Ctrl+\ cannot be pressed there, and the menus showed Ctrl+] and Ctrl+[ first
const ALTGR = new Set(['[', ']', '\\', '{', '}', '|', '@', '~', '#', '`']);
const altGr = (key) => ALTGR.has(key.split('+').at(-1));
test('a command with a key that needs AltGr shows a key that every layout has, and no key of Windows and Linux takes Ctrl+Alt (other)', async (t) => {
  const page = await load(t, 'other');
  await page.evaluate(`window.BeesonEditorShell.define({ id: 'test.app', label: 'App', run: (a) => { window.app = a; } })`);
  await page.evaluate(`window.BeesonEditor.exec('test.app')`);
  const commands = await page.evaluate(`window.app.commands.list().filter((c) => c.keys?.other?.length).map((c) => ({ id: c.id, label: typeof c.label === 'string' ? c.label : c.id, keys: c.keys.other }))`);
  for (const c of commands) {
    for (const k of c.keys) assert.doesNotMatch(k, /(Ctrl|Mod)\+(.*\+)?Alt|Alt\+(.*\+)?(Ctrl|Mod)/, `${c.id} takes ${k}`);
    if (c.keys.some(altGr)) {
      assert.ok(c.keys.some((k) => !altGr(k)), `${c.id} has only keys that need AltGr`);
      assert.ok(!altGr(c.keys[0]), `${c.id} shows ${c.keys[0]} first`);
    }
  }
  // the menus show the first key, and the sheet lists the key with AltGr beside the other
  const sheet = await sheetRows(page);
  const labels = await page.evaluate(`Object.fromEntries(['text.indent', 'text.outdent', 'text.clear'].map((id) => [id, window.app.commands.get(id)?.label]))`);
  for (const [id, label] of Object.entries(labels)) {
    assert.ok(label, `${id} is not defined`);
    const keys = sheet[label].split(', ');
    assert.equal(keys.length, 2, `${label} is listed with ${sheet[label]}`);
    assert.ok(keys.some((k) => /[\]\[\\]$/.test(k)) && keys.some((k) => !/[\]\[\\]$/.test(k)), `${label} is listed with ${sheet[label]}`);
  }
  assert.deepEqual(errors(page), []);
});

// round 4 of the juror: in a window 760 px wide, the navigator is hidden beside the docked
// inspector. the whole slide is shown at Fit, the navigator comes back when the window is widened,
// and View > Navigator reads as on and shows the navigator in place of the inspector
const SHELL = `(() => {
  const box = (sel) => { const el = document.querySelector(sel); if (!el || !el.getClientRects().length) return null; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
  return { nav: box('.beeson-edit-nav'), inspector: box('.beeson-edit-inspector'), canvas: box('.beeson-edit-canvas'), slide: box('.reveal') };
})()`;
async function resizeTo(page, width, height = 700) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await sleep(250);
  await frames(page);
}
function whole(b, what) {
  const right = Math.min(b.canvas.right, b.inspector?.left ?? Infinity);
  const s = b.slide;
  assert.ok(s.left >= b.canvas.left - 1 && s.right <= right + 1 && s.top >= b.canvas.top - 1 && s.bottom <= b.canvas.bottom + 1, `the slide ${js(s)} is not whole on the canvas ${js(b.canvas)} ${what}`);
}
const stateOf = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
for (const platform of PLATFORMS) {
  test(`in a window 760 px wide the slide is whole at Fit beside the inspector, and the navigator is still on and shown when asked for (${platform})`, async (t) => {
    const page = await load(t, platform, { width: 760 });
    if (!(await stateOf(page, 'shell.format')).checked) await run(page, 'shell.format');
    await frames(page);
    let b = await page.evaluate(SHELL);
    assert.ok(b.inspector && !b.nav, `the inspector and the navigator at 760 px: ${js(b)}`);
    assert.equal(await page.evaluate('window.BeesonEditorShell.stage.zoom'), null, 'the zoom is not Fit');
    whole(b, 'at 760 px');
    // View > Navigator is checked only while the navigator is drawn, as Slide Only is not
    assert.equal((await stateOf(page, 'view.navigator')).checked, false, 'View > Navigator reads as on while the navigator is hidden');
    // widened again, the navigator is shown again
    await resizeTo(page, 1440);
    assert.ok((await page.evaluate(SHELL)).nav, 'the navigator is not shown again at 1440 px');
    assert.equal((await stateOf(page, 'view.navigator')).checked, true);
    await resizeTo(page, 760);
    // View > Navigator shows the navigator, with the inspector closed in its place
    await run(page, 'view.navigator');
    await frames(page);
    b = await page.evaluate(SHELL);
    assert.ok(b.nav, 'View > Navigator does not show the navigator at 760 px');
    assert.equal(b.inspector, null, 'the inspector is not closed for the navigator');
    assert.equal((await stateOf(page, 'view.navigator')).checked, true);
    whole(b, 'with the navigator at 760 px');
    // a second run hides the navigator, which is then not shown again at 1440 px
    await run(page, 'view.navigator');
    await resizeTo(page, 1440);
    assert.equal((await page.evaluate(SHELL)).nav, null, 'the navigator is shown though it was hidden');
    assert.equal((await stateOf(page, 'view.navigator')).checked, false);
    assert.deepEqual(errors(page), []);
  });
}

// round 4, picture 162: in the Code pane, the switch of the line numbers was dimmed while the code
// box had line steps, and the pane did not say why
const CODE = 5;
const numbersSwitch = `(() => {
  const input = document.querySelector('.beeson-edit-inspector input[data-command="code.numbers"]');
  const label = input?.closest('label');
  const next = label?.nextElementSibling;
  return { disabled: input?.disabled, title: label?.title ?? '', note: next?.matches('.ed-note') && !next.hidden ? next.textContent : '', warn: !!next?.classList.contains('warn') };
})()`;
for (const platform of PLATFORMS) {
  test(`the dimmed switch of the line numbers says that the line steps need them (${platform})`, async (t) => {
    const page = await load(t, platform, { n: CODE });
    if (!(await stateOf(page, 'shell.format')).checked) await run(page, 'shell.format');
    await click(page, '.reveal section.present pre');
    await page.waitFor(`!!document.querySelector('.beeson-edit-inspector input[data-command="code.numbers"]')`);
    const dim = await page.evaluate(numbersSwitch);
    assert.equal(dim.disabled, true);
    assert.match(dim.title, /line steps need the line numbers/, 'the dimmed switch does not have a tooltip');
    assert.match(dim.note, /line steps need the line numbers/, 'the pane does not say why the switch is dimmed');
    assert.equal(dim.warn, false, 'the note is not muted');
    // without line steps, the switch is not dimmed and the note is not shown
    await page.evaluate(`window.BeesonEditor.exec('code.lines', { el: document.querySelector('.reveal section.present pre code'), value: '' })`);
    await frames(page);
    assert.deepEqual(await page.evaluate(numbersSwitch), { disabled: false, title: '', note: '', warn: false });
    await roundTrip(page);
  });
}
