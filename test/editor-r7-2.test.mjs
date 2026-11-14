// tests of R7.2 on both platforms with trusted input: Edit > Paste and Match Style in the Edit menu
// and in the menu of a text, File > Revert to Saved, File > Open Recent with the decks kept in
// IndexedDB and on the dialog of a deck that cannot read itself, and File > Export To with PDF… and
// HTML…. after each edit the text is checked byte for byte, after an undo and a redo, and after a
// save and an open. the system clipboard is shared with the other tests, hence readText is a stub

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch, printView } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
// the slide of the deck of layouts with a paragraph and a list
const TEXT = 2;
const P = '.reveal section.present > p:not(.small)';
const PARAGRAPH = '<p>A paragraph with <strong>bold</strong>, <em>italic</em>, <code>code</code>, and \\(x^2\\) inline.</p>';

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
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const status = (page) => page.evaluate('window.BeesonEditor.status()');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
// two frames, or a moment in a tab hidden by the tab of the print view, which does not get frames
const frames = (page) => page.evaluate('new Promise((d) => document.hidden ? setTimeout(() => d(true), 50) : requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const wait = (page, ms) => page.evaluate(`new Promise((d) => setTimeout(() => d(true), ${ms}))`);
// the names of the decks of Open Recent kept in the database of the editor, which the menus show
// before the write, hence a reload waits for them
const storedRecents = (page) => page.evaluate(`new Promise((done) => {
  const ask = indexedDB.open('beeson-editor', 1);
  ask.onsuccess = () => {
    const db = ask.result;
    const get = db.transaction('recent').objectStore('recent').get('decks');
    get.onsuccess = () => { db.close(); done((get.result ?? []).map((r) => r.name)); };
  };
})`);
async function written(page, names) {
  for (let i = 0; i < 100 && JSON.stringify(await storedRecents(page)) !== JSON.stringify(names); i++) await wait(page, 50);
  assert.deepEqual(await storedRecents(page), names);
}
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const ready = 'window.BeesonEditor && window.BeesonEditor.ready.then(() => true)';

// the editor on the slide n of a deck served over HTTP. with drafts, the page keeps its unsaved
// edits in the storage of the browser
async function load(t, platform, { deck = LAYOUTS, n = TEXT, open = true, drafts = false } = {}) {
  const page = await browser.newPage({ width: 1600, height: 1000, drafts });
  t.after(() => page.close().catch(() => {}));
  page.url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(page.url);
  await page.waitFor(deckSettled);
  await page.waitFor(ready);
  page.source = readFileSync(deck, 'utf8');
  if (open) assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`)).problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the edits applied to the text, then an undo gives the text before byte for byte, a redo gives
// the edit, and a save of the edit is opened again without problems
let saves = 0;
async function roundTrip(page, edits) {
  await byteExact(page, edits);
  const edited = await render(page);
  await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r7-2-${++saves}.html`);
  assert.equal(text, edited);
  page.source = text;
}

// the items of a menu of the menu bar as labels, with a submenu as its label in braces and a rule
// as a bar
const menuLabels = (page, bar, submenu) => page.evaluate(`(() => {
  const E = window.BeesonEditor;
  return window.BeesonEditorShell.menuItems(${js(bar)}${submenu ? `, ${js(submenu)}` : ''}).map((i) => i.rule ? '|' : i.command ? E.state(i.command).label : '{' + i.label + '}');
})()`);

// the rows of the open menus, the last opened last, each with its label, keys, and dimmed state
const rows = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu')].map((m) => [...m.querySelectorAll('.item')].map((i) => ({
  label: i.querySelector('.label')?.textContent ?? '',
  keys: i.querySelector('.keys')?.textContent ?? '',
  dimmed: i.getAttribute('aria-disabled') === 'true',
  submenu: i.getAttribute('aria-haspopup') === 'menu',
})))`);

// the center of the last item labeled label of the open menus, or null
const itemAt = (page, label) => page.evaluate(`(() => {
  const item = [...document.querySelectorAll('.beeson-edit-menu .item')].filter((i) => i.querySelector('.label')?.textContent === ${js(label)}).at(-1);
  if (!item) return null;
  const r = item.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);

async function openBar(page, bar) {
  await click(page, await page.evaluate(`(() => {
    const r = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)}).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`));
  await page.waitFor(`!!document.querySelector('.beeson-edit-menu .item')`, 3000);
}

// a trusted click on each label of a path of the menus, e.g. File, Export To, PDF…, with the
// pointer moved onto a submenu row so that it opens
async function choose(page, bar, ...path) {
  await openBar(page, bar);
  for (const [i, label] of path.entries()) {
    const at = await itemAt(page, label);
    assert.ok(at, `${label} is not in the open menu of ${bar}`);
    if (i < path.length - 1) {
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
      await page.waitFor(`document.querySelectorAll('.beeson-edit-menu').length > ${i + 1}`);
    } else await click(page, at);
  }
  await frames(page);
}

// a trusted click on the button labeled label of the open dialog with class name
async function cardButton(page, name, label) {
  const at = await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('dialog.beeson-edit-dialog.${name}:not([hidden]) button')].find((b) => b.textContent === ${js(label)});
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(at, `the card ${name} does not have a button ${label}`);
  await click(page, at);
  await frames(page);
}

const card = (page, name) => page.evaluate(`(() => {
  const c = document.querySelector('dialog.beeson-edit-dialog.${name}');
  return c && !c.hidden ? { title: c.querySelector('h3').textContent, text: c.querySelector('p')?.textContent ?? '', buttons: [...c.querySelectorAll('button')].map((b) => b.textContent) } : null;
})()`);

// the caret at the end of the paragraph of the slide, put there by a trusted click just past its
// last character, since a click on its formula opens the editor of the formula
async function caretInParagraph(page) {
  await click(page, await page.evaluate(`(() => {
    const p = document.querySelector(${js(P)});
    const r = document.createRange();
    r.setStart(p.lastChild, p.lastChild.length - 1);
    r.setEnd(p.lastChild, p.lastChild.length);
    const box = r.getBoundingClientRect();
    return { x: box.right - 1, y: box.top + box.height / 2 };
  })()`));
  await frames(page);
  assert.equal(await page.evaluate(`(() => { const s = getSelection(); const p = document.querySelector(${js(P)}); return s.isCollapsed && s.anchorNode === p.lastChild && s.anchorOffset === p.lastChild.length; })()`), true, 'the caret is not at the end of the paragraph');
}

const paragraph = (page) => page.evaluate(`document.querySelector(${js(P)}).textContent`);

// readText gives text, and writeText keeps the clipboard of the page
const clipboard = (page, text) => page.evaluate(`(() => {
  window.__clip = ${js(text)};
  navigator.clipboard.readText = async () => window.__clip;
  navigator.clipboard.writeText = async (t) => { window.__clip = t; };
  navigator.clipboard.read = async () => [];
})()`);

for (const platform of PLATFORMS) {
  const mac = platform === 'mac';

  test(`Paste and Match Style follows Paste in the Edit menu, with ${mac ? '⌥⇧⌘V' : 'no key'}, and pastes plain words (${platform})`, async (t) => {
    const page = await load(t, platform);
    const edit = await menuLabels(page, 'Edit');
    assert.deepEqual(edit.slice(edit.indexOf('Cut'), edit.indexOf('Cut') + 5), ['Cut', 'Copy', 'Paste', 'Paste and Match Style', 'Delete']);
    await clipboard(page, ' and plain words');
    await caretInParagraph(page);
    await openBar(page, 'Edit');
    const row = (await rows(page))[0].find((r) => r.label === 'Paste and Match Style');
    assert.deepEqual(row, { label: 'Paste and Match Style', keys: mac ? '⌥⇧⌘V' : '', dimmed: false, submenu: false });
    await click(page, await itemAt(page, 'Paste and Match Style'));
    await frames(page);
    assert.equal(await paragraph(page), 'A paragraph with bold, italic, code, and  inline. and plain words');
    await roundTrip(page, [[PARAGRAPH, PARAGRAPH.replace('inline.</p>', 'inline. and plain words</p>')]]);
    // the key is not bound twice in a region, nor shared with a key of the browser outside a text
    assert.deepEqual(await page.evaluate('window.BeesonEditorShell.keyClashes()'), []);
    assert.deepEqual(await page.evaluate('window.BeesonEditorShell.keyClashes(true)'), []);
    assert.deepEqual(errors(page), []);
  });

  test(`the menu of a text has Paste and Match Style after Paste, and it pastes the words of copied elements (${platform})`, async (t) => {
    const page = await load(t, platform);
    // a list item copied in the editor is pasted into a text as its words, which Paste does not do
    await clipboard(page, '<!--beeson-->\n<ul>\n  <li class="fragment">Copied <strong>bold</strong> item</li>\n</ul>');
    // the menu of a right-click on the paragraph, and the same menu opened with Shift+F10 at the
    // caret, which a right-click moves
    await click(page, await page.evaluate(`(() => {
      const r = document.querySelector(${js(P)}).getBoundingClientRect();
      return { x: r.right - 4, y: r.top + r.height / 2 };
    })()`), { button: 'right' });
    await page.waitFor(`!!document.querySelector('.beeson-edit-menu .item')`);
    assert.deepEqual((await rows(page))[0].slice(0, 4), [
      { label: 'Cut', keys: mac ? '⌘X' : 'Ctrl+X', dimmed: true, submenu: false },
      { label: 'Copy', keys: mac ? '⌘C' : 'Ctrl+C', dimmed: true, submenu: false },
      { label: 'Paste', keys: mac ? '⌘V' : 'Ctrl+V', dimmed: false, submenu: false },
      { label: 'Paste and Match Style', keys: mac ? '⌥⇧⌘V' : '', dimmed: false, submenu: false },
    ]);
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('.beeson-edit-menu')`);
    await caretInParagraph(page);
    await press(page, 'Shift+F10');
    await page.waitFor(`!!document.querySelector('.beeson-edit-menu .item')`);
    await click(page, await itemAt(page, 'Paste and Match Style'));
    await frames(page);
    assert.equal(await paragraph(page), 'A paragraph with bold, italic, code, and  inline.Copied bold item');
    await roundTrip(page, [[PARAGRAPH, PARAGRAPH.replace('inline.</p>', 'inline.Copied bold item</p>')]]);
    // Paste leaves a text of elements out of a text
    await caretInParagraph(page);
    await openBar(page, 'Edit');
    await click(page, await itemAt(page, 'Paste'));
    await frames(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`Paste and Match Style on the slide pastes the copied block${mac ? ', and ⌥⇧⌘V is left to the browser in a text' : ''} (${platform})`, async (t) => {
    const page = await load(t, platform);
    await clipboard(page, '');
    await page.evaluate(`window.__keys = []; document.addEventListener('keydown', (ev) => window.__keys.push(ev.key + (ev.defaultPrevented ? ':prevented' : '')))`);
    if (mac) {
      // in a text, the browser pastes as its Paste and Match Style, which text/typing.ts makes plain
      await caretInParagraph(page);
      await press(page, 'Mod+Alt+Shift+V');
      await frames(page);
      assert.deepEqual(await page.evaluate('window.__keys'), ['V']);
      assert.equal(await render(page), page.source);
      await press(page, 'Escape');
    } else {
      await click(page, P);
      await press(page, 'Escape');
    }
    // the paragraph selected as a block is copied, and pasted on the slide after it, drawn 20 px off
    // it, while the list and the small paragraph after it are kept at their places
    await frames(page);
    assert.equal((await status(page)).dirty, false);
    await exec(page, 'edit.copy');
    if (mac) await press(page, 'Mod+Alt+Shift+V');
    else await choose(page, 'Edit', 'Paste and Match Style');
    await page.waitFor(`document.querySelectorAll(${js(P)}).length === 2`);
    const SMALL = '<p class="small fragment" data-fragment-index="3"';
    await roundTrip(page, [
      [`${PARAGRAPH}\n  <ul>`, `${PARAGRAPH}\n  ${PARAGRAPH.replace('<p>', '<p style="translate: 20px -141px">')}\n  <ul style="translate: 0px -161px">`],
      [`${SMALL}>`, `${SMALL} style="translate: 0px -161px">`],
    ]);
    assert.deepEqual(errors(page), []);
  });

  test(`File > Revert to Saved asks first, then shows the file again on the same slide without the draft (${platform})`, async (t) => {
    const page = await load(t, platform, { open: false, drafts: true });
    await exec(page, 'file.recent.clear');
    assert.deepEqual((await page.evaluate(`window.BeesonEditor.status()`)).problems, []);
    assert.equal(await render(page), page.source);
    assert.equal((await state(page, 'file.revert')).enabled, false);
    const file = await menuLabels(page, 'File');
    assert.deepEqual(file.slice(0, file.indexOf('Revert to Saved') + 1), ['Open…', 'Open Recent', '|', 'Save', 'Save As…', 'Autosave', 'Revert to Saved']);
    await caretInParagraph(page);
    await type(page, ' typed');
    await page.waitFor('window.BeesonEditor.status().draft', 5000);
    assert.equal((await state(page, 'file.revert')).enabled, true);

    // Cancel and Esc keep the edits
    await choose(page, 'File', 'Revert to Saved');
    assert.deepEqual(await card(page, 'revert'), {
      title: 'Do you want to revert to the most recently saved version?',
      text: 'Your current changes will be lost.',
      buttons: ['Revert', 'Cancel'],
    });
    assert.equal(await page.evaluate('document.activeElement.textContent'), 'Cancel');
    await cardButton(page, 'revert', 'Cancel');
    assert.equal(await card(page, 'revert'), null);
    await choose(page, 'File', 'Revert to Saved');
    await press(page, 'Escape');
    await frames(page);
    assert.equal(await card(page, 'revert'), null);
    assert.ok((await paragraph(page)).endsWith(' typed'));
    assert.equal((await status(page)).dirty, true);

    // Revert loads the page again from the file. a read that Chrome has not answered when the new
    // page is shown fails with this error, which is thus not a failure of the click on Revert
    await page.evaluate('window.__before = true');
    await choose(page, 'File', 'Revert to Saved');
    await cardButton(page, 'revert', 'Revert').catch((error) => {
      if (!/Inspected target navigated or closed/.test(error.message)) throw error;
    });
    await page.waitFor(`!window.__before && document.readyState === 'complete'`);
    await page.waitFor(deckSettled);
    await page.waitFor(ready);
    await page.waitFor(`window.BeesonEditor.status().state === 'loaded'`);
    const after = await status(page);
    assert.deepEqual({ dirty: after.dirty, draft: after.draft, recover: after.recover, undo: after.undo }, { dirty: false, draft: false, recover: false, undo: false });
    assert.equal(await page.evaluate('Reveal.getIndices().h'), TEXT);
    assert.equal(await paragraph(page), 'A paragraph with bold, italic, code, and  inline.');
    assert.equal(await render(page), page.source);
    assert.equal(await card(page, 'recover'), null);
    assert.deepEqual(errors(page), []);
  });

  test(`File > Open Recent lists the decks opened here by name, opens one without the picker, and ends with Clear Menu (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'file.recent.clear');
    await openBar(page, 'File');
    assert.deepEqual((await rows(page))[0].slice(0, 2), [
      { label: 'Open…', keys: mac ? '⌘O' : 'Ctrl+O', dimmed: false, submenu: false },
      { label: 'Open Recent', keys: '', dimmed: true, submenu: false },
    ]);
    await press(page, 'Escape');
    // two files of the deck in the origin private file system, chosen with the pickers
    const a = `recent-a-${platform}.html`;
    const b = `recent-b-${platform}.html`;
    await page.evaluate(`(async () => {
      const root = await navigator.storage.getDirectory();
      for (const name of [${js(a)}, ${js(b)}]) {
        const w = await (await root.getFileHandle(name, { create: true })).createWritable();
        await w.write(${js(page.source)});
        await w.close();
      }
      window.__picked = 0;
      window.showOpenFilePicker = async () => { window.__picked++; return [await root.getFileHandle(${js(a)})]; };
      window.showSaveFilePicker = async () => { window.__picked++; return root.getFileHandle(${js(b)}); };
    })()`);
    await choose(page, 'File', 'Open…');
    await page.waitFor('window.__picked === 1');
    await page.waitFor(`window.BeesonEditorShell.menuItems('File', 'Open Recent').length === 3`);
    await choose(page, 'File', 'Save As…');
    await page.waitFor(`window.__picked === 2 && window.BeesonEditorShell.menuItems('File', 'Open Recent').length === 4`);
    assert.deepEqual(await menuLabels(page, 'File', 'Open Recent'), [b, a, '|', 'Clear Menu']);
    const file = await menuLabels(page, 'File');
    assert.deepEqual(file.slice(0, 3), ['Open…', '{Open Recent}', '|']);

    // the deck kept in a, opened from the submenu, is the file of the next save
    await caretInParagraph(page);
    await type(page, '!');
    await choose(page, 'File', 'Open Recent', a);
    assert.deepEqual((await card(page, 'ask')).buttons, ['Save and open…', 'Open without saving', 'Cancel']);
    await cardButton(page, 'ask', 'Open without saving');
    await page.waitFor(`window.BeesonEditorShell.menuItems('File', 'Open Recent')[0]?.command === 'file.recent.1' && window.BeesonEditor.state('file.recent.1').label === ${js(a)}`);
    assert.equal(await page.evaluate('window.__picked'), 2);
    assert.equal((await status(page)).dirty, false);
    assert.equal(await render(page), page.source);
    await caretInParagraph(page);
    await type(page, '!');
    await press(page, 'Mod+S');
    await page.waitFor('!window.BeesonEditor.status().dirty');
    const saved = await page.evaluate(`(async () => (await (await (await navigator.storage.getDirectory()).getFileHandle(${js(a)})).getFile()).text())()`);
    assert.equal(saved, page.source.replace(PARAGRAPH, PARAGRAPH.replace('inline.</p>', 'inline.!</p>')));
    assert.equal(await page.evaluate('window.__picked'), 2);

    // the list is kept through a reload, and it is not offered without the open picker
    await written(page, [a, b]);
    await page.goto(page.url);
    await page.waitFor(ready);
    await page.waitFor(`window.BeesonEditorShell.menuItems('File', 'Open Recent').length === 4`);
    assert.deepEqual(await menuLabels(page, 'File', 'Open Recent'), [a, b, '|', 'Clear Menu']);
    await page.evaluate('window.showOpenFilePicker = undefined');
    assert.deepEqual((await menuLabels(page, 'File')).slice(0, 2), ['Open…', 'Open Recent']);
    assert.equal((await state(page, 'file.recent.none')).enabled, false);
    await page.goto(page.url);
    await page.waitFor(ready);
    await page.waitFor(`window.BeesonEditorShell.menuItems('File', 'Open Recent').length === 4`);

    // Clear Menu empties the list, also after a reload
    await choose(page, 'File', 'Open Recent', 'Clear Menu');
    assert.deepEqual((await menuLabels(page, 'File')).slice(0, 2), ['Open…', 'Open Recent']);
    await written(page, []);
    await page.goto(page.url);
    await page.waitFor(ready);
    await wait(page, 300);
    assert.deepEqual((await menuLabels(page, 'File')).slice(0, 2), ['Open…', 'Open Recent']);
    assert.deepEqual(errors(page), []);
  });

  test(`Clear Menu empties Open Recent at once, while its list is still being written to the database (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'file.recent.clear');
    const name = `recent-slow-${platform}.html`;
    await page.evaluate(`(async () => {
      const root = await navigator.storage.getDirectory();
      const w = await (await root.getFileHandle(${js(name)}, { create: true })).createWritable();
      await w.write(${js(page.source)});
      await w.close();
      window.showOpenFilePicker = async () => [await root.getFileHandle(${js(name)})];
    })()`);
    await choose(page, 'File', 'Open…');
    await page.waitFor(`window.BeesonEditorShell.menuItems('File', 'Open Recent').length === 3`);
    // a database that does not answer, as one under load answers late
    const labels = await page.evaluate(`(() => {
      indexedDB.open = () => ({});
      window.BeesonEditor.exec('file.recent.clear');
      const E = window.BeesonEditor;
      return window.BeesonEditorShell.menuItems('File').slice(0, 2).map((i) => i.command ? E.state(i.command).label : '{' + i.label + '}');
    })()`);
    assert.deepEqual(labels, ['Open…', 'Open Recent']);
    assert.deepEqual(errors(page), []);
  });

  test(`Clear Menu at the start of the editor is kept when the read of Open Recent answers after it (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'file.recent.clear');
    const name = `recent-late-${platform}.html`;
    await page.evaluate(`(async () => {
      const root = await navigator.storage.getDirectory();
      const w = await (await root.getFileHandle(${js(name)}, { create: true })).createWritable();
      await w.write(${js(page.source)});
      await w.close();
      window.showOpenFilePicker = async () => [await root.getFileHandle(${js(name)})];
    })()`);
    await choose(page, 'File', 'Open…');
    await written(page, [name]);
    // the database answers 1 s late, as on a slow runner, hence the menu is cleared while the
    // read of the start is in flight
    const { identifier } = await page.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `{
        const open = IDBFactory.prototype.open;
        IDBFactory.prototype.open = function (...args) {
          const ask = open.apply(this, args);
          let fn = null;
          Object.defineProperty(ask, 'onsuccess', { get: () => fn, set: (f) => { fn = f; } });
          ask.addEventListener('success', (ev) => setTimeout(() => fn?.call(ask, ev), 1000));
          return ask;
        };
      }`,
    });
    t.after(() => page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier }).catch(() => {}));
    await page.goto(page.url);
    await page.waitFor(ready);
    await exec(page, 'file.recent.clear');
    await wait(page, 3000);
    assert.deepEqual((await menuLabels(page, 'File')).slice(0, 2), ['Open…', 'Open Recent']);
    await written(page, []);
  });

  test(`the card of a deck that cannot read itself offers the file of the deck kept for Open Recent (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'file.recent.clear');
    const name = `recent-card-${platform}.html`;
    await page.evaluate(`(async () => {
      const root = await navigator.storage.getDirectory();
      const w = await (await root.getFileHandle(${js(name)}, { create: true })).createWritable();
      await w.write(${js(page.source)});
      await w.close();
      window.showOpenFilePicker = async () => [await root.getFileHandle(${js(name)})];
    })()`);
    await choose(page, 'File', 'Open…');
    await page.waitFor(`window.BeesonEditor.state('file.recent.1').label === ${js(name)}`);
    // a page whose fetch of itself fails asks for its file, as a deck opened from file: does
    const { identifier } = await page.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'window.fetch = () => Promise.reject(new TypeError("offline")); window.showOpenFilePicker = async () => { window.__picked = true; throw new DOMException("cancelled", "AbortError"); };',
    });
    t.after(() => page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier }).catch(() => {}));
    await written(page, [name]);
    await page.goto(page.url);
    await page.waitFor(ready);
    await page.waitFor(`(() => { const b = document.querySelector('dialog.beeson-edit-dialog:not([hidden]) button.primary'); return b?.textContent === ${js(`Open ${name}`)}; })()`);
    const shown = await page.evaluate(`(() => { const c = [...document.querySelectorAll('dialog.beeson-edit-dialog')].find((c) => !c.hidden); return { title: c.querySelector('h3').textContent, buttons: [...c.querySelectorAll('button')].map((b) => b.textContent), focused: document.activeElement.textContent, text: c.querySelector('p').textContent }; })()`);
    assert.equal(shown.title, 'Choose the file of this deck');
    assert.deepEqual(shown.buttons, [`Open ${name}`, 'Choose editor-layouts.html…']);
    assert.equal(shown.focused, `Open ${name}`);
    assert.match(shown.text, new RegExp(`Open ${name.replace(/\./g, '\\.')}, the file of this deck that you chose on `));
    const at = await page.evaluate(`(() => { const r = document.querySelector('dialog.beeson-edit-dialog:not([hidden]) button.primary').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await click(page, at);
    await page.waitFor(`window.BeesonEditor.status().state === 'loaded'`);
    assert.equal(await page.evaluate('window.__picked ?? false'), false);
    assert.deepEqual((await status(page)).problems, []);
    assert.equal(await page.evaluate(`[...document.querySelectorAll('dialog.beeson-edit-dialog')].some((c) => !c.hidden)`), false);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page).filter((e) => !e.includes('offline')), []);
  });

  // the deck of layers does not have a video, which the test server sends without ranges, hence
  // the videos of the deck of layouts hold every connection of the print view and its fonts do not load
  test(`File > Export To > PDF… prints the print view of the saved deck with a page per step (${platform})`, async (t) => {
    const deck = 'test/pages/layers.html';
    const page = await load(t, platform, { deck, n: 2 });
    assert.deepEqual((await menuLabels(page, 'File')).slice(-4), ['|', '{Export To}', '|', 'Print…']);
    assert.deepEqual(await menuLabels(page, 'File', 'Export To'), ['PDF…', 'HTML…', 'PowerPoint…']);
    // the tab of the print view is kept for the test, and its print is recorded
    await page.evaluate(`(() => {
      const real = window.open;
      window.__printed = 0;
      window.open = (...a) => {
        window.__url = a[0];
        const win = real.apply(window, a);
        if (!win) return win;
        window.__view = win;
        // a method of the window is bound to it, and the global Reveal, also a function, is not
        const native = (f) => typeof f === 'function' && Function.prototype.toString.call(f).includes('[native code]');
        return new Proxy(win, { get: (w, k) => k === 'print' ? () => { window.__printed++; } : native(w[k]) ? w[k].bind(w) : w[k] });
      };
    })()`);
    await choose(page, 'File', 'Export To', 'PDF…');
    await page.waitFor('window.__printed === 1', 60000);
    const url = new URL(await page.evaluate('window.__url'));
    assert.equal(url.pathname, `/${deck}`);
    assert.deepEqual([...url.searchParams.keys()].sort(), ['edit-platform', 'print-pdf', 'still']);
    const pages = await page.evaluate(`window.__view.document.querySelectorAll('.pdf-page').length`);
    assert.match((await status(page)).message, /^The print view of layers\.html is open in a new tab, with one page per step/);
    await page.evaluate('window.__view.close()');
    // npm run pdf prints the same pages, one per step of each slide
    const print = await browser.newPage();
    t.after(() => print.close().catch(() => {}));
    await printView(print, `${server.origin}/${deck}?print-pdf&still`);
    assert.equal(pages, await print.evaluate(`document.querySelectorAll('.pdf-page').length`));
    assert.ok(pages > 3, `${pages} pages for the 3 slides of the deck`);
    // the editor is shown again in front of the print view, since a hidden tab does not get frames
    await page.send('Page.bringToFront');

    // with unsaved changes, the saved file is printed, and the edits are kept
    const step = '<p id="plain-1" class="fragment" data-fragment-index="1">The first step.</p>';
    const edited = step.replace('step.</p>', 'step!</p>');
    await click(page, await page.evaluate(`(() => {
      const p = document.getElementById('plain-1');
      const r = document.createRange();
      r.setStart(p.firstChild, p.firstChild.length - 1);
      r.setEnd(p.firstChild, p.firstChild.length);
      const box = r.getBoundingClientRect();
      return { x: box.right - 1, y: box.top + box.height / 2 };
    })()`));
    await press(page, 'Backspace');
    await type(page, '!');
    await byteExact(page, [[step, edited]]);
    await choose(page, 'File', 'Export To', 'PDF…');
    assert.deepEqual(await card(page, 'ask'), {
      title: 'The deck has unsaved changes',
      text: 'The PDF is printed from the file. Save the edits into it first, export the saved file without them, or go on editing.',
      buttons: ['Save and export', 'Export the saved file', 'Cancel'],
    });
    await cardButton(page, 'ask', 'Export the saved file');
    await page.waitFor('window.__printed === 2', 60000);
    assert.equal(await page.evaluate(`[...window.__view.document.querySelectorAll('#plain-1')].every((p) => p.textContent === 'The first step.')`), true);
    await page.evaluate('window.__view.close()');
    await page.send('Page.bringToFront');
    assert.equal((await status(page)).dirty, true);
    await roundTrip(page, [[step, edited]]);
    assert.deepEqual(errors(page), []);
  });

  test(`File > Export To > HTML… writes a copy of the deck with its edits, and the deck keeps its file (${platform})`, async (t) => {
    const page = await load(t, platform);
    const name = `export-${platform}.html`;
    await page.evaluate(`(async () => {
      const root = await navigator.storage.getDirectory();
      window.showSaveFilePicker = async (o) => { window.__suggested = o.suggestedName; return root.getFileHandle(${js(name)}, { create: true }); };
    })()`);
    await caretInParagraph(page);
    await type(page, '!');
    await choose(page, 'File', 'Export To', 'HTML…');
    await page.waitFor(`(async () => { try { return (await (await (await navigator.storage.getDirectory()).getFileHandle(${js(name)})).getFile()).size > 0; } catch { return false; } })()`);
    const edited = page.source.replace(PARAGRAPH, PARAGRAPH.replace('inline.</p>', 'inline.!</p>'));
    const copy = await page.evaluate(`(async () => (await (await (await navigator.storage.getDirectory()).getFileHandle(${js(name)})).getFile()).text())()`);
    assert.equal(copy, edited);
    assert.equal(await page.evaluate('window.__suggested'), 'editor-layouts.html');
    assert.equal((await status(page)).dirty, true);
    assert.equal(readFileSync(LAYOUTS, 'utf8'), page.source);
    await roundTrip(page, [[PARAGRAPH, PARAGRAPH.replace('inline.</p>', 'inline.!</p>')]]);
    assert.deepEqual(errors(page), []);
  });
}
