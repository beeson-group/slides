// the shell of the editor: the regions of the window, the menus and the context menus drawn from
// the registry of commands, the dialogs, the stage of the slide with its zoom, and the order of the
// focus. the commands that the packages of the plan have not defined yet are defined by the tests

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { launch } from '../scripts/chrome.mjs';
import { click, editorPage, press } from './helpers/editor.mjs';

const scheme = (page, value) => page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value }] });
const frames = (page) => page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true))))');

// a regression test of the edge of the slide, which was not seen since the page and the slide were
// both painted in --bg: the pasteboard around the slide must differ from the slide in both modes
test('the slide is set off from the pasteboard in both modes of the slide', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  for (const mode of ['dark', 'light']) {
    await page.evaluate(`document.documentElement.dataset.theme = ${JSON.stringify(mode)}`);
    await frames(page);
    const look = await page.evaluate(`(() => {
      const probe = document.createElement('div');
      probe.style.background = 'var(--bg)';
      document.querySelector('.reveal').append(probe);
      const slide = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { slide, pasteboard: getComputedStyle(document.body).backgroundColor, shadow: getComputedStyle(document.querySelector('.reveal')).boxShadow };
    })()`);
    assert.notEqual(look.pasteboard, look.slide, `${mode}: the pasteboard is the color of the slide`);
    assert.notEqual(look.shadow, 'none', `${mode}: the slide has no shadow`);
  }
  assert.deepEqual(page.errors, []);
});

// a regression test of the focus left on Slides and Steps after a pointer click, since nav.ts and
// steps.ts wire them without the blur of wire()
test('a pointer click on Slides or Steps leaves the focus off the button', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  for (const name of ['Slides', 'Steps']) {
    const at = await page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === ${JSON.stringify(name)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await click(page, at);
    await frames(page);
    assert.notEqual(await page.evaluate('document.activeElement.textContent'), name, `the focus is left on ${name}`);
  }
  assert.deepEqual(page.errors, []);
});

// a regression test of the order of Tab, in which the slide came before the toolbar, since the
// shell was appended after .reveal
test('Tab from the start of the page reaches the bars before the slide', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  // the focus is put on a mark at the start of the body, from which Tab goes on in the order of the DOM
  await page.evaluate(`{ const mark = document.createElement('span'); mark.id = 'start'; mark.tabIndex = -1; document.body.prepend(mark); mark.focus(); }`);
  await press(page, 'Tab');
  const first = await page.evaluate(`(() => { const a = document.activeElement; return { inSlide: !!a.closest('.reveal'), inBars: !!a.closest('.beeson-edit-header, .beeson-edit-top') }; })()`);
  assert.deepEqual(first, { inSlide: false, inBars: true });
  assert.deepEqual(page.errors, []);
});

// a command of a package that is not built yet, defined in the page through the shell
const define = (page, command) => page.evaluate(`window.BeesonEditorShell.define(${command})`);
const boxOf = (page, selector) => page.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; })()`);

test('the regions have the sizes of the plan at 1440 by 900, and the slide is fitted with its pasteboard', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser, { page: { width: 1440, height: 900 } });
  await page.evaluate(`window.BeesonEditor.exec('view.notes'); window.BeesonEditor.exec('view.steps'); window.BeesonEditor.setPane(160)`);
  await frames(page);
  assert.equal((await boxOf(page, '.beeson-edit-titlebar')).h, 28);
  assert.equal((await boxOf(page, '.beeson-edit-top')).h, 52);
  assert.equal((await boxOf(page, '.beeson-edit-bottom')).h, 28);
  assert.equal((await boxOf(page, '.beeson-edit-nav')).w, 200);
  assert.equal((await boxOf(page, '.beeson-edit-inspector')).w, 288);
  const cell = await boxOf(page, '.beeson-edit-canvas');
  assert.deepEqual([cell.w, cell.h], [952, 631]);
  const stage = await page.evaluate(`(() => { const s = window.BeesonEditorShell.stage; const r = document.querySelector('.reveal .slides').getBoundingClientRect(); return { scale: s.scale, reveal: Reveal.getScale(), zoom: s.zoom, origin: s.origin, left: r.left, top: r.top, width: r.width, viewport: s.viewport.toJSON() }; })()`);
  assert.equal(stage.scale, 0.46);
  assert.equal(stage.reveal, 0.46);
  assert.equal(stage.zoom, null);
  assert.ok(Math.abs(stage.origin.x - stage.left) < 0.5 && Math.abs(stage.origin.y - stage.top) < 0.5, JSON.stringify(stage));
  // a margin of at least 32 px of pasteboard is left around the slide
  assert.ok(stage.left - stage.viewport.left >= 32 && stage.viewport.right - stage.left - stage.width >= 32, JSON.stringify(stage));
  // the slide sits in the canvas cell, and the notes in the cell under it
  const notes = await boxOf(page, '.reveal section.present > aside.notes');
  const pane = await boxOf(page, '.beeson-edit-pane');
  assert.ok(Math.abs(notes.x - pane.x) <= 1 && Math.abs(notes.y - pane.y) <= 1 && Math.abs(notes.w - pane.w) <= 1, JSON.stringify({ notes, pane }));
  assert.deepEqual(page.errors, []);
});

test('the chrome follows the color scheme of the system, and D flips only the slide', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  const colors = () => page.evaluate(`(() => ({ header: getComputedStyle(document.querySelector('.beeson-edit-header')).backgroundColor, nav: getComputedStyle(document.querySelector('.beeson-edit-nav')).backgroundColor, text: getComputedStyle(document.querySelector('.beeson-edit-top .tb')).color, slide: getComputedStyle(document.querySelector('.reveal')).backgroundColor, thumb: getComputedStyle(document.querySelector('.beeson-edit-nav .row .pic')).backgroundColor }))()`);
  await scheme(page, 'light');
  await page.evaluate(`document.activeElement.blur()`);
  const before = await colors();
  await press(page, 'D');
  await page.waitFor(`document.documentElement.dataset.theme === 'light'`);
  await frames(page);
  const after = await colors();
  assert.deepEqual({ ...after, slide: null, thumb: null }, { ...before, slide: null, thumb: null });
  assert.notEqual(after.slide, before.slide);
  // a thumbnail of the navigator is drawn in the mode of the slide, not in the colors of the chrome
  assert.equal(before.thumb, before.slide);
  assert.equal(after.thumb, after.slide);
  await scheme(page, 'dark');
  const dark = await colors();
  assert.notEqual(dark.header, before.header);
  assert.notEqual(dark.text, before.text);
  assert.deepEqual(page.errors, []);
});

for (const platform of ['mac', 'other']) {
  test(`a menu of the menu bar is opened, walked, and run with the keys of the platform ${platform}`, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await editorPage(browser, { query: `edit&still&edit-platform=${platform}` });
    await define(page, `{ id: 'test.box', label: 'Text Box', keys: { mac: ['Mod+Shift+K'], other: ['Mod+Shift+K'] }, menu: { bar: 'Insert', group: 'text', order: 1 }, run: () => { window.ran = (window.ran ?? 0) + 1; } }`);
    await define(page, `{ id: 'test.off', label: 'Formula', enabled: () => false, menu: { bar: 'Insert', group: 'text', order: 2 }, run: () => {} }`);
    await define(page, `{ id: 'test.table', label: 'Table…', menu: { bar: 'Insert', group: 'more', order: 3 }, run: () => { window.table = true; } }`);
    const items = () => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => [i.querySelector('.label').textContent, i.querySelector('.keys').textContent, i.getAttribute('aria-disabled') === 'true', i.classList.contains('hi')])`);
    // a click on the title opens the menu without the focus, with the keys in the notation of the platform
    await click(page, await page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent === 'Insert').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
    const keys = platform === 'mac' ? '⇧⌘K' : 'Ctrl+Shift+K';
    assert.deepEqual((await items()).slice(0, 3), [['Text Box', keys, false, false], ['Formula', '', true, false], ['Table…', '', false, false]]);
    // a rule is drawn between two groups of a menu
    assert.equal(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.textContent.startsWith('Table…')).previousElementSibling.getAttribute('role')`), 'separator');
    // the arrows skip the disabled item, and Enter runs the highlighted one
    await press(page, 'ArrowDown');
    await press(page, 'ArrowDown');
    assert.deepEqual((await items()).slice(0, 3).map((i) => i[3]), [false, false, true]);
    await press(page, 'Enter');
    assert.equal(await page.evaluate('window.table'), true);
    assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-edit-menu').length`), 0);
    // from the keyboard: the focused title opens with Enter, Esc closes the menu, and the focus goes back
    await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent === 'Insert').focus()`);
    await press(page, 'Enter');
    assert.deepEqual((await items()).slice(0, 3).map((i) => i[3]), [true, false, false]);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-menubar [aria-expanded=true]').textContent`), 'Insert');
    await press(page, 'Escape');
    assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-edit-menu').length`), 0);
    assert.equal(await page.evaluate('document.activeElement.textContent'), 'Insert');
    // Left on a title moves to the title before it, and Down opens its menu
    await press(page, 'ArrowLeft');
    assert.equal(await page.evaluate('document.activeElement.textContent'), 'Edit');
    await press(page, 'ArrowDown');
    assert.deepEqual((await items()).slice(0, 2).map((i) => i[0]), ['Undo', 'Redo']);
    // the group find of the Edit menu is drawn as one run of items after a rule
    const edit = (await items()).map((i) => i[0]);
    const find = edit.indexOf('Find…');
    assert.deepEqual(edit.slice(find, find + 5), ['Find…', 'Find Next', 'Find Previous', 'Use Selection for Find', 'Replace…'], JSON.stringify(edit));
    // Right in an open menu opens the menu beside it
    await press(page, 'ArrowRight');
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-menubar [aria-expanded=true]').textContent`), 'Insert');
    await press(page, 'Escape');
    // a menu without an item is dimmed, and one with items is not
    const dimmed = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].map((b) => [b.getAttribute('aria-disabled'), String(window.BeesonEditorShell.menuItems(b.textContent).length === 0)])`);
    assert.ok(dimmed.every(([a, b]) => a === b), JSON.stringify(dimmed));
    assert.ok(dimmed.some(([a]) => a === 'false'));
    assert.deepEqual(page.errors, []);
  });
}

test('a right-click opens the context menu of a figure, of the slide, and of a slide row, and its command gets the place', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  await define(page, `{ id: 'test.front', label: 'Test Element Item', context: ['element'], menu: { bar: 'Arrange', group: 'order', order: 1 }, run: (app, arg) => { window.got = { kind: arg.kind, tag: arg.target.localName, selected: app.selection.has(arg.target) }; } }`);
  await define(page, `{ id: 'test.paste', label: 'Test Canvas Item', context: ['canvas', 'navigator'], run: (app, arg) => { window.got = { kind: arg.kind }; } }`);
  await define(page, `{ id: 'test.dup', label: 'Test Slide Item', context: ['slide'], run: (app, arg) => { window.got = { kind: arg.kind, index: [...app.slides().children].indexOf(arg.target) }; } }`);
  const labels = () => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu.context .item .label')].map((l) => l.textContent)`);
  const run = (label) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu.context .item')].find((i) => i.querySelector('.label').textContent === ${JSON.stringify(label)}).click()`);
  // a figure of the slide with the figure
  await page.evaluate(`Reveal.slide([...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('img.beeson-movable, .zone.beeson-movable, .qr.beeson-movable')))`);
  await frames(page);
  const figure = await page.evaluate(`(() => { const el = [...document.querySelectorAll('.reveal section.present :is(img, .zone, .qr).beeson-movable')].find((e) => e.getBoundingClientRect().width > 40); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, figure, { button: 'right' });
  assert.ok((await labels()).includes('Test Element Item'));
  assert.ok(!(await labels()).includes('Test Canvas Item'));
  await run('Test Element Item');
  const got = await page.evaluate('window.got');
  assert.equal(got.kind, 'element');
  assert.equal(got.selected, true);
  // the pasteboard around the slide
  const cell = await boxOf(page, '.beeson-edit-canvas');
  await click(page, { x: cell.x + 8, y: cell.y + 8 }, { button: 'right' });
  assert.ok(!(await labels()).includes('Test Element Item'));
  await run('Test Canvas Item');
  assert.deepEqual(await page.evaluate('window.got'), { kind: 'canvas' });
  // a row of the slide list
  await page.evaluate(`document.querySelectorAll('.beeson-edit-nav .row')[2].scrollIntoView()`);
  await click(page, await page.evaluate(`(() => { const r = document.querySelectorAll('.beeson-edit-nav .row')[2].getBoundingClientRect(); return { x: r.left + 40, y: r.top + r.height / 2 }; })()`), { button: 'right' });
  await run('Test Slide Item');
  assert.deepEqual(await page.evaluate('window.got'), { kind: 'slide', index: 2 });
  // Esc closes a context menu without running anything
  await click(page, { x: cell.x + 8, y: cell.y + 8 }, { button: 'right' });
  await press(page, 'Escape');
  assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-edit-menu').length`), 0);
  assert.deepEqual(page.errors, []);
});

test('a dialog keeps Tab inside, answers with the button pressed, and gives the focus back', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-top .tb')].find((b) => b.textContent === 'Present').focus()`);
  await page.evaluate(`window.answer = 'none'; window.BeesonEditorShell.ask({ title: 'Delete the slide?', text: 'It has notes.', buttons: [{ label: 'Delete', value: 'delete', primary: true }, { label: 'Cancel', value: 'cancel' }] }, 'cancel').then((v) => { window.answer = v; }); 0`);
  const focused = () => page.evaluate('document.activeElement.textContent');
  assert.equal(await focused(), 'Cancel');
  await press(page, 'Tab');
  assert.equal(await focused(), 'Delete');
  await press(page, 'Tab');
  assert.equal(await focused(), 'Cancel');
  await press(page, 'Shift+Tab');
  assert.equal(await focused(), 'Delete');
  await press(page, 'Escape');
  await page.waitFor(`window.answer !== 'none'`);
  assert.equal(await page.evaluate('window.answer'), null);
  assert.equal(await focused(), 'Present');
  await page.evaluate(`window.answer = 'none'; window.BeesonEditorShell.ask({ title: 'Delete the slide?', buttons: [{ label: 'Delete', value: 'delete' }, { label: 'Cancel', value: 'cancel' }] }).then((v) => { window.answer = v; }); 0`);
  // the first button has the focus, and a key that presses a button answers with its value
  assert.equal(await focused(), 'Delete');
  await press(page, 'Space');
  await page.waitFor(`window.answer !== 'none'`);
  assert.equal(await page.evaluate('window.answer'), 'delete');
  assert.equal(await page.evaluate(`document.querySelectorAll('dialog.beeson-edit-card[open]').length`), 0);
  assert.deepEqual(page.errors, []);
});

test('the labels of the toolbar are kept while they fit, and the late groups go into a menu while they do not', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  for (const [width, labels, more] of [[1440, true, false], [1000, true, false], [900, true, true]]) {
    const page = await editorPage(browser, { page: { width, height: 700 } });
    const bar = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-top .tb')]; return { texts: b.filter((e) => !e.classList.contains('more-groups')).map((e) => e.textContent), label: getComputedStyle(b[0].querySelector('.label')).display !== 'none', more: !!document.querySelector('.beeson-edit-top .more-groups') }; })()`);
    assert.equal(bar.label, labels, `${width}: labels`);
    assert.equal(bar.more, more, `${width}: the menu More`);
    // Format and Steps stay after More, since Format opens and closes the inspector, beside which
    // the navigator is hidden in a narrow window
    assert.deepEqual(bar.texts, more ? ['View', 'FitZoom', 'Undo', 'Redo', 'Add Slide', 'Table', 'Text', 'Formula', 'Shape', 'Media', 'Format', 'Steps'] : ['View', 'FitZoom', 'Undo', 'Redo', 'Add Slide', 'Table', 'Text', 'Formula', 'Shape', 'Media', 'Present', 'Save', 'Format', 'Steps']);
    const cell = await boxOf(page, '.beeson-edit-canvas');
    assert.ok(cell.w > 0 && cell.h > 0);
    assert.deepEqual(page.errors, []);
    await page.close();
  }
});

test('the zoom of the status bar scales the slide past Fit, the canvas scrolls, and Fit comes back', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser, { page: { width: 1440, height: 900 } });
  const state = () => page.evaluate(`(() => { const s = window.BeesonEditorShell.stage; const c = document.querySelector('.beeson-edit-canvas'); return { zoom: s.zoom, scale: Reveal.getScale(), percent: document.querySelector('.beeson-edit-bottom .percent').textContent, scroll: c.scrollWidth > c.clientWidth }; })()`);
  const fit = await state();
  assert.equal(fit.zoom, null);
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.getAttribute('aria-label') === 'Zoom in').click()`);
  const zoomed = await state();
  assert.ok(zoomed.zoom > fit.scale, JSON.stringify(zoomed));
  assert.equal(zoomed.scale, zoomed.zoom);
  assert.equal(zoomed.percent, `${Math.round(zoomed.zoom * 100)}%`);
  await page.evaluate(`window.BeesonEditorShell.stage.setZoom(2)`);
  assert.equal((await state()).scroll, true);
  // the slide is clipped to the cell, and the canvas is scrolled
  const clip = await page.evaluate(`getComputedStyle(document.querySelector('.reveal')).clipPath`);
  assert.match(clip, /^inset\(/);
  const before = await page.evaluate(`window.BeesonEditorShell.stage.origin`);
  await page.evaluate(`document.querySelector('.beeson-edit-canvas').scrollBy(200, 100)`);
  await frames(page);
  const after = await page.evaluate(`window.BeesonEditorShell.stage.origin`);
  assert.ok(Math.abs(before.x - after.x - 200) < 1 && Math.abs(before.y - after.y - 100) < 1, JSON.stringify({ before, after }));
  // a figure selected at the zoom is framed at its box
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === 'Fit').click()`);
  assert.deepEqual(await state(), fit);
  assert.deepEqual(page.errors, []);
});
