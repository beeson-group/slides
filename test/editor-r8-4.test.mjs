// regression tests of R8.4 on both platforms with trusted input, from the laptop tests on Windows
// and Linux and the juror of round 3. a poster is captured at the time of the slider after a slow
// seek. after each edit the text is checked byte for byte, after an undo and a redo, and after a
// save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
// the slide "Embedding videos" of the demo deck
const VIDEOS = 10;

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
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let saves = 0;

// the editor on the slide n of a deck served over HTTP, in a window of size, with the Format tab
// shown unless format is false, and in the mode of the slides given, or else of the system
async function load(t, platform, { deck = 'index.html', n = 0, size = { width: 1440, height: 900 }, format = true, mode = null, query = '' } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  if (mode) await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }] });
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}${mode ? `&theme=${mode}` : ''}${query}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (format && !(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${n})`);
  await sleep(150);
  await frames(page);
  return page;
}

// roundTrip checks the text before byte for byte after undos undos, the edit after as many redos,
// and an open of the saved edit without problems, which is the text before the next check
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r8-4-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

const boxOf = (page, selector) => page.evaluate(`(() => {
  const el = [...document.querySelectorAll(${js(selector)})].find((e) => e.getClientRects().length);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
})()`);

// finding 1: the poster was captured 500 ms after the seek was asked, before a slow seek had ended,
// hence it was the first frame of the video. SLOW_SEEK starts the seek of a video that is not on
// the page, i.e. of the video of the capture, 900 ms after it is asked, as a slow machine does
const SLOW_SEEK = `(() => {
  const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    get() { return d.get.call(this); },
    set(v) { if (this.isConnected) d.set.call(this, v); else setTimeout(() => d.set.call(this, v), 900); },
  });
  return true;
})()`;
const SLIDER = `${PANEL} input[name="poster-frame"]`;
const posterBytes = (page, video) => page.evaluate(`fetch(document.querySelector(${js(video)}).poster).then((r) => r.arrayBuffer()).then((b) => [...new Uint8Array(b)].reduce((h, x) => (h * 31 + x) >>> 0, b.byteLength))`);

for (const platform of PLATFORMS) {
  test(`a poster is captured at the time of the slider after a seek slower than 500 ms (${platform})`, async (t) => {
    const page = await load(t, platform, { n: VIDEOS });
    const mode = await page.evaluate(`[...document.querySelectorAll('.reveal section.present video')].find((v) => v.getBoundingClientRect().width).classList.contains('for-dark') ? 'dark' : 'light'`);
    const video = `.reveal section.present video.for-${mode}`;
    const clip = `clip-${mode}`;
    await click(page, video);
    await frames(page);
    await page.waitFor(`!!document.querySelector(${js(SLIDER)}) && !document.querySelector(${js(SLIDER)}).disabled`);
    await page.evaluate(SLOW_SEEK);
    const r = await boxOf(page, SLIDER);
    await click(page, { x: r.left + 8 + (r.width - 16) * 0.5, y: r.top + r.height / 2 });
    await page.waitFor(`window.BeesonEditor.render().includes('poster="media/${clip}.png"')`, 10000);
    const half = await posterBytes(page, video);
    await page.evaluate(`document.querySelector(${js(SLIDER)}).focus()`);
    await press(page, 'Home');
    await page.waitFor(`window.BeesonEditor.render().includes('poster="media/${clip}-2.png"')`, 10000);
    const first = await posterBytes(page, video);
    assert.notEqual(half, first, 'the poster at the middle of the video is its first frame');
    await page.evaluate('window.showDirectoryPicker = () => navigator.storage.getDirectory()');
    await roundTrip(page, 2);
  });
}

// the rows of the menu opened last, each with its command, its label, and its keys as shown
const ROWS = `[...([...document.querySelectorAll('.beeson-edit-menu')].at(-1)?.querySelectorAll('.item') ?? [])].map((el) => ({
  command: el.dataset.command ?? null,
  label: el.querySelector('.label')?.firstChild?.textContent ?? '',
  keys: el.querySelector('.keys')?.textContent ?? '',
}))`;

// every command row of the menus of the menu bar and of their submenus, each menu opened by itself
const menuBarRows = (page) => page.evaluate(`(() => {
  const shell = window.BeesonEditorShell;
  const out = [];
  const walk = (items) => {
    shell.openMenu(items, { x: 40, y: 40 });
    out.push(...${ROWS}.filter((r) => r.command));
    shell.closeMenus();
    for (const it of items) if (it.items) walk(typeof it.items === 'function' ? it.items() : it.items);
  };
  for (const bar of ['File', 'Edit', 'Insert', 'Format', 'Arrange', 'Slide', 'View', 'Help']) walk(shell.menuItems(bar));
  return out;
})()`);

// the rows of a context menu whose keys differ from the keys of the same command, or else of a
// command of the same label, in the menu bar
function differences(bar, rows, where) {
  const out = [];
  for (const r of rows.filter((r) => r.command)) {
    const same = bar.filter((b) => b.command === r.command);
    const named = same.length ? same : bar.filter((b) => b.label === r.label);
    if (named.length && !named.some((b) => b.keys === r.keys)) out.push(`${where}: ${r.label} is listed with "${r.keys}" and in the menu bar with "${named.map((b) => b.keys).join('", "')}"`);
  }
  return out;
}

// finding 2: Unlock of the context menu of a locked element was listed without the keys that
// Arrange > Unlock lists
for (const platform of PLATFORMS) {
  test(`every item of every context menu is listed with the keys of the menu bar (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 4 });
    const bar = await menuBarRows(page);
    assert.ok(bar.some((b) => b.command === 'arrange.unlock' && b.keys), 'Arrange > Unlock is not listed with its keys');
    const found = [];
    const context = async (at, where) => {
      await click(page, at, { button: 'right' });
      await frames(page);
      const rows = await page.evaluate(ROWS);
      assert.ok(rows.length > 2, `the context menu of ${where} is not open`);
      found.push(...differences(bar, rows, where));
      await press(page, 'Escape');
      await frames(page);
      return rows;
    };
    const IMAGE = '.reveal section.present figure.zone > img';
    await context(IMAGE, 'an element');
    await click(page, IMAGE);
    await exec(page, 'arrange.lock');
    const locked = await context(IMAGE, 'a locked element');
    assert.ok(locked.some((r) => r.label === 'Unlock'), 'the menu of a locked element does not list Unlock');
    await context('.reveal section.present > p', 'a text');
    await context('.beeson-edit-nav .row', 'a slide of the navigator');
    const canvas = await boxOf(page, '.beeson-edit-canvas');
    await context({ x: canvas.left + 12, y: canvas.top + 12 }, 'the canvas');
    const nav = await boxOf(page, '.beeson-edit-nav');
    await page.evaluate(`window.BeesonEditorShell.context('navigator', ${nav.left + 20}, ${nav.bottom - 20})`);
    found.push(...differences(bar, await page.evaluate(ROWS), 'the navigator'));
    await press(page, 'Escape');
    assert.deepEqual(found, []);
    assert.deepEqual(errors(page), []);
  });
}

// the names of the keys and of the modifiers of Windows and Linux, as PowerPoint for Windows writes
// them, and the word drag of the rows of the mouse
const KEY_NAMES = new Set(['Ctrl', 'Shift', 'Alt', 'Meta', 'Esc', 'Enter', 'Tab', 'Backspace', 'Delete', 'Spacebar', 'Menu', 'Up Arrow', 'Down Arrow', 'Left Arrow', 'Right Arrow', 'Home', 'End', 'Page Up', 'Page Down', 'drag', ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`)]);
const ODD_PARTS = (label) => label.split(', ').flatMap((key) => key.split(/\+(?!$)/)).filter((part) => !(/^[\x21-\x7E]$/.test(part) || KEY_NAMES.has(part)));

// finding 5: Zoom Out was listed as Ctrl with a minus sign, where the key bears a hyphen-minus
test('every key of the keyboard sheet and the menus of Windows and Linux is written with ASCII characters and the names of the keys', async (t) => {
  const page = await load(t, 'other', { n: 1 });
  const menus = (await menuBarRows(page)).filter((r) => r.keys).map((r) => [r.label, r.keys]);
  await exec(page, 'help.keys');
  await page.waitFor(`!!document.querySelector('dialog.beeson-edit-keys[open] kbd')`);
  const sheet = await page.evaluate(`[...document.querySelectorAll('dialog.beeson-edit-keys[open] .row')].map((r) => [r.querySelector('span').textContent, r.querySelector('kbd').textContent])`);
  assert.ok(sheet.length > 40, 'the keyboard sheet is not filled');
  const odd = [...menus, ...sheet].filter(([, keys]) => ODD_PARTS(keys).length || !/^[\x20-\x7E]+$/.test(keys)).map(([label, keys]) => `${label}: ${keys}`);
  assert.deepEqual([...new Set(odd)], []);
  assert.ok(sheet.some(([label, keys]) => label === 'Zoom Out' && keys.split(', ').includes('Ctrl+-')), 'Zoom Out is not listed as Ctrl+-');
  assert.deepEqual(errors(page), []);
});

// the trusted key events of the key of Insert > Formula on the platform, followed by those of text,
// all sent before the first one is handled, as keys typed back to back
function formulaThenType(page, platform, text) {
  const key = (type, base, modifiers = 0) => page.send('Input.dispatchKeyEvent', { type, modifiers, ...base });
  const sent = [];
  const trigger = platform === 'mac'
    ? [{ key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69 }, 4 | 1]
    : [{ key: '=', code: 'Equal', windowsVirtualKeyCode: 187 }, 1];
  sent.push(key('rawKeyDown', ...trigger), key('keyUp', ...trigger));
  for (const c of text) {
    const base = { key: c, code: c === ' ' ? 'Space' : `Key${c.toUpperCase()}`, windowsVirtualKeyCode: c === ' ' ? 32 : c.toUpperCase().charCodeAt(0) };
    sent.push(key('keyDown', { ...base, text: c, unmodifiedText: c }), key('keyUp', base));
  }
  return Promise.all(sent);
}

// finding 7: the keys typed while Insert > Formula opens the TeX field of an inline formula in a
// text were typed into the text, and the TeX field was empty
for (const platform of PLATFORMS) {
  test(`every key typed back to back after Insert > Formula in a text reaches the TeX field of its inline formula (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 4, format: false });
    const PARA = '.reveal section.present > p';
    await click(page, PARA);
    await press(page, 'End');
    await frames(page);
    assert.ok(await page.evaluate(`document.activeElement.isContentEditable && !!document.activeElement.closest('.reveal')`), 'the caret is not in the paragraph');
    await formulaThenType(page, platform, 'abc d');
    await page.waitFor(`!!document.querySelector('.beeson-math textarea')`);
    await sleep(300);
    const field = await page.evaluate(`(() => { const f = document.querySelector('.beeson-math textarea'); return { value: f.value, focused: f === document.activeElement }; })()`);
    assert.deepEqual(field, { value: 'abc d', focused: true });
    await byteExact(page);
    await page.evaluate(`[...document.querySelectorAll('.beeson-math button')].find((b) => b.textContent === 'Insert').click()`);
    await page.waitFor(`!document.querySelector('.beeson-math')`);
    assert.match(await render(page), /\\\(abc d\\\)/);
    await roundTrip(page);
  });
}

// the deck with an image pair directly in a slide, and a slide with more words than a panel holds
const PAIR_DECK = 'test/pages/editor-r8-4.html';

// the start tags of the images of the slide in the text, by their mode
const imageTags = (text) => Object.fromEntries(['dark', 'light'].map((m) => [m, text.match(new RegExp(`<img class="for-${m}[^>]*>`))[0]]));
const indexOf = (tag) => tag.match(/data-fragment-index="(\d+)"/)?.[1] ?? null;

// finding 6: the images of a pair directly in a slide were two items of the Steps pane, and a plan
// that gave them two steps wrote each step on both images, one over the other
for (const platform of PLATFORMS) {
  for (const mode of ['dark', 'light']) {
    test(`an image pair in a slide is one item of the Steps pane, and its step is written on both images in ${mode} mode (${platform})`, async (t) => {
      const page = await load(t, platform, { deck: PAIR_DECK, n: 0, mode });
      await exec(page, 'view.steps');
      await frames(page);
      const rows = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-inspector .rows .row .chip')].map((c) => c.getAttribute('aria-label'))`);
      assert.equal(rows.filter((r) => /A figure/.test(r)).length, 1, `the pair is not one row: ${rows.join(' | ')}`);
      await exec(page, 'steps.oneByOne');
      const text = await render(page);
      const tags = imageTags(text);
      const para = text.match(/<p[^>]*>A paragraph before/)[0];
      assert.ok(indexOf(tags.dark) && indexOf(tags.dark) === indexOf(tags.light), `the images are not at one step: ${tags.dark} ${tags.light}`);
      assert.match(tags.dark, /class="for-dark fragment"/);
      assert.match(tags.light, /class="for-light fragment"/);
      assert.deepEqual([indexOf(para), indexOf(tags.dark), indexOf(tags.light)], ['1', '2', '2'], 'the paragraph is not at step 1 and the pair at step 2');
      const badges = await page.evaluate(`document.querySelectorAll('.beeson-badges .beeson-badge').length`);
      assert.equal(badges, 2, 'the paragraph and the pair do not each have one number on the slide');
      await roundTrip(page);
    });
  }
}

// the keys that Arrange > Lock, Arrange > Unlock, and View > Rulers list, in the browser of the
// URL parameter edit-browser, or else in the headless Chrome of the tests
const LISTED = {
  mac: { chrome: { Lock: '⌘L', Unlock: '⌥⌘L', Rulers: '⌘R' }, safari: { Lock: '⌃⌘L', Unlock: '⌃⌥⌘L', Rulers: '⌃⌘R' } },
  other: { chrome: { Lock: 'Ctrl+L', Unlock: 'Ctrl+Shift+L', Rulers: '' }, safari: { Lock: 'Ctrl+L', Unlock: 'Ctrl+Shift+L', Rulers: '' } },
};

// finding 8: Lock was listed with the fallback of Safari, Ctrl+Cmd+L, in a browser that passes the
// Cmd+L of Keynote to the page, and so was Rulers with Ctrl+Cmd+R
for (const platform of PLATFORMS) {
  for (const browserName of ['chrome', 'safari']) {
    test(`Lock, Unlock, and Rulers list the key of Keynote first where the browser passes it to the page, in ${browserName} (${platform})`, async (t) => {
      const page = await load(t, platform, { n: 4, query: browserName === 'safari' ? '&edit-browser=safari' : '' });
      const rows = await menuBarRows(page);
      const keysOf = (id) => rows.find((r) => r.command === id)?.keys ?? '';
      const want = LISTED[platform][browserName];
      assert.deepEqual({ Lock: keysOf('arrange.lock'), Unlock: keysOf('arrange.unlock'), Rulers: keysOf('view.rulers') }, want);
      if (platform !== 'mac') return;
      // the keys of Keynote and the fallbacks of Safari both reach the page in the headless Chrome
      const IMAGE = '.reveal section.present figure.zone > img';
      const locks = browserName === 'safari' ? [['Ctrl+Mod+L', 'Ctrl+Mod+Alt+L'], ['Mod+L', 'Mod+Alt+L']] : [['Mod+L', 'Mod+Alt+L'], ['Ctrl+Mod+L', 'Ctrl+Mod+Alt+L']];
      for (const [lock, unlock] of locks) {
        await click(page, IMAGE);
        await press(page, lock);
        await frames(page);
        assert.equal((await state(page, 'edit.undo')).label, 'Undo Lock', `${lock} does not lock the picture`);
        await press(page, unlock);
        await frames(page);
        assert.equal((await state(page, 'edit.undo')).label, 'Undo Unlock', `${unlock} does not unlock the picture`);
        await byteExact(page);
      }
      for (const key of ['Mod+R', 'Ctrl+Mod+R']) {
        const shown = (await state(page, 'view.rulers')).checked;
        await press(page, key);
        await frames(page);
        assert.equal((await state(page, 'view.rulers')).checked, !shown, `${key} does not toggle the rulers`);
      }
      assert.deepEqual(errors(page), []);
    });
  }
}

// the start tags of the long paragraph, the note in the style Small, and the list of the slide of
// the fixture deck with more words than a panel holds
const fitTags = (text) => ({
  para: text.match(/<p[^>]*>The stable and the unstable/)[0],
  note: text.match(/<p[^>]*>A note in the style Small/)[0],
  list: text.match(/<ul[^>]*>/)[0],
});

// finding 9: Change Layout to Split set the paragraphs and the lists of an overflowing panel in the
// style Small, and a change of layout away from Split left them small. the blocks shrunk by the
// fit are written without the class, also after an undo and a redo of the change to Split, and a
// block that was in the style Small before the change to Split keeps it
for (const platform of PLATFORMS) {
  test(`a change of layout away from Split takes the style Small off the blocks that the fit of the panel shrank (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: PAIR_DECK, n: 1 });
    await exec(page, 'slide.layout.split');
    await sleep(300);
    await frames(page);
    const split = fitTags(await render(page));
    assert.match(split.para, /class="small"/, 'the panel is not fitted, and the test does not show the finding');
    assert.match(split.list, /class="small"/, 'the list of the panel is not fitted');
    await page.evaluate('window.BeesonEditor.undo()');
    await page.evaluate('window.BeesonEditor.redo()');
    await exec(page, 'slide.layout.content');
    await sleep(300);
    await frames(page);
    const content = fitTags(await render(page));
    assert.doesNotMatch(content.para, /small/, `the paragraph fitted to the panel is still small after the change to Content: ${content.para}`);
    assert.doesNotMatch(content.list, /small/, `the list fitted to the panel is still small after the change to Content: ${content.list}`);
    assert.equal(content.note, '<p class="small">A note in the style Small', 'the note in the style Small before the change to Split lost its style');
    // Split and then Content give back the file byte for byte, and the undo gives back the fit
    await byteExact(page);
    await page.evaluate('window.BeesonEditor.undo()');
    assert.match(fitTags(await render(page)).para, /class="small"/, 'the undo of the change to Content does not give back the fit');
    await page.evaluate('window.BeesonEditor.redo()');
    await byteExact(page);
    const { text } = await saveAndReopen(page, `r8-4-${++saves}.html`);
    assert.equal(text, page.source);
    assert.deepEqual(errors(page), []);
  });
}

// the TeX fields shown in the window, by the popover or the pane that shows each, and their text
const texFields = (page) => page.evaluate(`[...document.querySelectorAll('textarea')]
  .filter((f) => f.getClientRects().length && (f.closest('.beeson-math') || f.name === 'tex'))
  .map((f) => [f.closest('.beeson-math') ? 'popover' : 'pane', f.value])`);

// finding 10: the TeX field of a new formula was shown twice, in its popover and in the Formula pane
// of the inspector. while the popover is open, its field is the only one, and once it is closed the
// Formula pane shows the TeX of a display. a display is written on a slide, and an inline formula
// in a text
for (const platform of PLATFORMS) {
  for (const where of ['slide', 'text']) {
    test(`one TeX field is shown while the popover of a new formula in a ${where} is open (${platform})`, async (t) => {
      const page = await load(t, platform, { n: where === 'slide' ? 5 : 4 });
      if (where === 'slide') await exec(page, 'insert.formula');
      else {
        await click(page, '.reveal section.present > p');
        await press(page, 'End');
        await frames(page);
        await formulaThenType(page, platform, '');
      }
      await page.waitFor(`!!document.querySelector('.beeson-math textarea')`);
      await sleep(300);
      await frames(page);
      assert.deepEqual(await texFields(page), [['popover', '']], 'the TeX field of the new formula is not shown once, in its popover');
      await page.evaluate(`(() => { const f = document.querySelector('.beeson-math textarea'); f.value = 'x^2'; f.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
      await sleep(200);
      await page.evaluate(`[...document.querySelectorAll('.beeson-math button')].find((b) => b.textContent === 'Insert').click()`);
      await page.waitFor(`!document.querySelector('.beeson-math')`);
      await sleep(300);
      await frames(page);
      // the display stays selected, while the caret of a text is put after its inline formula
      if (where === 'slide') assert.deepEqual(await texFields(page), [['pane', 'x^2']], 'the Formula pane does not show the TeX of the formula once the popover is closed');
      assert.match(await render(page), where === 'slide' ? /\\\[x\^2\\\]/ : /\\\(x\^2\\\)/);
      // a display is inserted empty and then given its TeX, two entries of the history
      await roundTrip(page, where === 'slide' ? 2 : 1);
    });
  }
}

// the row of Layout in the menu opened last, and the layout chooser with its box, its marked tile,
// and its focused tile
const layoutRow = (page) => page.evaluate(`(() => {
  const menu = [...document.querySelectorAll('.beeson-edit-menu')].at(-1);
  const el = menu && [...menu.querySelectorAll('.item')].find((i) => i.querySelector('.label')?.firstChild?.textContent === 'Layout');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { command: el.dataset.command ?? null, submenu: el.getAttribute('aria-haspopup') === 'menu', left: r.left, right: r.right, top: r.top, bottom: r.bottom, x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);
const chooserOf = (page) => page.evaluate(`(() => {
  const d = document.querySelector('dialog.beeson-edit-layouts[open]');
  if (!d) return null;
  const r = d.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, marked: [...d.querySelectorAll('.tile[aria-selected="true"]')].map((t) => t.dataset.layout), focused: document.activeElement?.dataset?.layout ?? null };
})()`);

// opens the menu of from, i.e. Slide of the menu bar or the menu of the current thumbnail of the
// navigator, and clicks its item Layout, which is returned
async function openLayouts(page, from) {
  if (from === 'menu bar') await click(page, await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((x) => x.textContent === 'Slide'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
  else await click(page, '.beeson-edit-nav .row[aria-current="true"]', { button: 'right' });
  await frames(page);
  const row = await layoutRow(page);
  assert.ok(row, `the menu of the ${from} does not have an item Layout`);
  assert.ok(!row.submenu, `Layout in the menu of the ${from} is a submenu of text items`);
  await click(page, row);
  await sleep(100);
  await frames(page);
  return row;
}

// finding 3: Slide > Layout was a submenu of text items, and the tile chooser was opened only from
// the Format pane. Layout of Slide in the menu bar and of the menu of a thumbnail opens the tiles
// beside its item, with the layout of the slide marked, and the arrows, Enter, and Esc work in it
for (const platform of PLATFORMS) {
  for (const from of ['menu bar', 'thumbnail']) {
    test(`Layout in the menu of the ${from} opens the layout tiles beside it (${platform})`, async (t) => {
      const page = await load(t, platform, { n: 2 });
      let row = await openLayouts(page, from);
      let chooser = await chooserOf(page);
      assert.ok(chooser, `Layout of the menu of the ${from} does not open the layout tiles`);
      assert.deepEqual([chooser.marked, chooser.focused], [['content'], 'content'], 'the layout of the slide is not marked and focused');
      assert.ok(chooser.left >= row.right - 4 || chooser.right <= row.left + 4, `the tiles are not beside the item: ${js(chooser)} ${js(row)}`);
      assert.ok(chooser.top <= row.bottom && chooser.bottom >= row.top, `the tiles are not at the height of the item: ${js(chooser)} ${js(row)}`);
      await press(page, 'ArrowRight');
      assert.equal((await chooserOf(page)).focused, 'narrow');
      await press(page, 'Escape');
      await frames(page);
      assert.equal(await chooserOf(page), null, 'Esc does not close the tiles');
      await byteExact(page);
      row = await openLayouts(page, from);
      await press(page, 'ArrowRight');
      await press(page, 'ArrowRight');
      await press(page, 'Enter');
      await sleep(300);
      await frames(page);
      assert.equal(await chooserOf(page), null, 'Enter does not close the tiles');
      assert.equal((await state(page, 'slide.layout.wide')).checked, true, 'Enter on the tile Content, Wide does not change the layout');
      await roundTrip(page);
    });
  }
}
