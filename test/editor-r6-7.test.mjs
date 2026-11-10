// package R6.7 on both platforms, driven with trusted input: a width written by a resize grip is
// the width drawn, for a picture, a video, a QR code, and a text block, also past the box of a zone

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const LAYOUTS = 'test/pages/editor-layouts.html';
const SECTIONS = [...readFileSync(LAYOUTS, 'utf8').matchAll(/<section[\s\S]*?<\/section>/g)].map((m) => m[0]);
const MATH = SECTIONS.findIndex((s) => s.includes('<h2>Math, an ordered list, and a zone</h2>'));
const SPLIT = SECTIONS.findIndex((s) => s.includes('<h2>A split slide</h2>'));
const NARROW = SECTIONS.findIndex((s) => s.includes('<h2>A narrow slide</h2>'));

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

let last = null;
let saves = 0;

// the editor on slide n of the deck of layouts, served over HTTP, with the storage cleared
async function editor(platform, n) {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.send('Page.bringToFront');
  const url = `${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(LAYOUTS, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

// the shown grips of the first selected element by their handle, as screen points
const gripsAt = (page) => page.evaluate(`Object.fromEntries([...document.querySelectorAll('.beeson-grip[data-member="0"]')].filter((g) => !g.hidden).map((g) => { const r = g.getBoundingClientRect(); return [g.dataset.handle, { x: r.left + r.width / 2, y: r.top + r.height / 2 }]; }))`);

// the width in the style of the shown element of selector, and the width of what is drawn, both in
// slide px: the picture of an image or a video fitted in its box, and else the box
const widths = (page, selector) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides');
  const k = s.getBoundingClientRect().width / s.offsetWidth;
  const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getBoundingClientRect().width);
  const r = el.getBoundingClientRect();
  let drawn = r.width;
  const [w, h] = el instanceof HTMLImageElement ? [el.naturalWidth, el.naturalHeight] : el instanceof HTMLVideoElement ? [el.videoWidth, el.videoHeight] : [0, 0];
  if (w && h && getComputedStyle(el).objectFit === 'contain') drawn = w * Math.min(r.width / w, r.height / h);
  return { written: parseFloat(el.style.width), drawn: drawn / k, scale: k };
})()`);

// each element, how it is selected, the grip that is dragged, and how far to the right in slide px
const CASES = [
  { name: 'an image of a zone', slide: MATH, selector: '.reveal section.present .zone > img', clicks: 1, grip: 'se', dx: 400 },
  { name: 'a video of a zone', slide: SPLIT, selector: '.reveal section.present .zone > video', clicks: 2, grip: 'se', dx: 400 },
  { name: 'a QR code', slide: 0, selector: '.reveal section.present .qr', clicks: 1, grip: 'se', dx: 300 },
  { name: 'a text block', slide: MATH, selector: '.reveal section.present p', text: 'The lead-in of a display', grip: 'e', dx: 500 },
  { name: 'the heading of a narrow slide', slide: NARROW, selector: '.reveal section.present h2', text: 'A narrow slide', grip: 'e', dx: 400 },
];

for (const platform of PLATFORMS) {
  for (const c of CASES) {
    test(`${platform}: the width that a grip writes on ${c.name} is the width drawn, also past the box of its zone`, async () => {
      const page = await editor(platform, c.slide);
      // a text block is selected by a click into its text and Esc
      const selector = c.text ? `${c.selector}[data-r67]` : c.selector;
      if (c.text) {
        await page.evaluate(`[...document.querySelectorAll(${JSON.stringify(c.selector)})].find((p) => p.textContent === ${JSON.stringify(c.text)}).setAttribute('data-r67', '')`);
        const at = await page.evaluate(`(() => { const b = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: b.left + 20, y: b.top + b.height / 2 }; })()`);
        await click(page, at);
        await press(page, 'Escape');
      } else for (let n = 0; n < c.clicks; n++) await click(page, c.selector);
      await frames(page);
      const before = await widths(page, selector);
      const grips = await gripsAt(page);
      assert.ok(grips[c.grip], `${c.name} does not show the grip ${c.grip}: ${Object.keys(grips).join(' ')}`);
      await drag(page, grips[c.grip], { dx: c.dx * before.scale, dy: c.grip === 'se' ? 10 * before.scale : 0 });
      await frames(page);
      const after = await widths(page, selector);
      assert.ok(after.written > before.drawn + 50, `the grip wrote a width of ${after.written} on ${c.name} drawn at ${Math.round(before.drawn)}`);
      assert.ok(Math.abs(after.written - after.drawn) <= 2, `the grip wrote width: ${after.written}px on ${c.name}, which is drawn at ${Math.round(after.drawn)} px`);
      const edited = await render(page);
      assert.ok(edited.includes(`width: ${after.written}px`), `the width ${after.written} is not written into the file`);
      await undo(page);
      await frames(page);
      await byteExact(page);
      await redo(page);
      await frames(page);
      assert.equal(await render(page), edited);
      await saveAndReopen(page, `r6-7-${++saves}.html`);
      assert.deepEqual(errors(page), []);
    });
  }
}

// the items of the open menus that run a command, as its id, label, and key text
const shownItems = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item[data-command]')].map((i) => ({ id: i.dataset.command, label: i.querySelector('.label').textContent, keys: i.querySelector('.keys').textContent }))`);

async function openBar(page, bar) {
  await click(page, await page.evaluate(`(() => {
    const r = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${JSON.stringify(bar)}).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`));
  await frames(page);
}

// the rows of the sheet of keyboard shortcuts by its group and label, opened from the Help menu
async function sheetRows(page) {
  await page.evaluate(`window.BeesonEditor.exec('help.keys')`);
  await frames(page);
  const rows = await page.evaluate(`Object.fromEntries([...document.querySelectorAll('dialog.beeson-edit-keys section')].flatMap((s) => [...s.querySelectorAll('.row')].map((r) => [s.querySelector('h3').textContent + ' > ' + r.firstChild.textContent, r.lastChild.textContent])))`);
  await press(page, 'Escape');
  return rows;
}

// the notation of each platform: the symbols of Keynote on a Mac, and the words of PowerPoint for
// Windows elsewhere, e.g. Ctrl+Shift+Up Arrow and Page Down
const NOTATION = {
  mac: { 'arrange.order.front': '⇧⌘F', 'navigate.next': '⇟', 'edit.redo': '⇧⌘Z', redoSheet: '⇧⌘Z, ⌘Y', nextSheet: '⇟, →, ↓' },
  other: { 'arrange.order.front': 'Ctrl+Shift+Up Arrow', 'navigate.next': 'Page Down', 'edit.redo': 'Ctrl+Y', redoSheet: 'Ctrl+Y, Ctrl+Shift+Z', nextSheet: 'Page Down, Right Arrow, Down Arrow' },
};

for (const platform of PLATFORMS) {
  test(`${platform}: a menu, a context menu, a tooltip, and the sheet write the keys of a command in one notation`, async () => {
    const page = await editor(platform, MATH);
    await click(page, '.reveal section.present .zone > img');
    await frames(page);
    const menus = new Map();
    for (const bar of ['File', 'Edit', 'Insert', 'Format', 'Arrange', 'Slide', 'View', 'Help']) {
      await openBar(page, bar);
      for (const item of await shownItems(page)) menus.set(item.id, { ...item, bar });
      await press(page, 'Escape');
      await frames(page);
    }
    const sheet = await sheetRows(page);
    let compared = 0;
    for (const item of menus.values()) {
      if (!item.keys) continue;
      const row = sheet[`${item.bar} > ${item.label}`];
      assert.ok(row, `the sheet does not list ${item.bar} > ${item.label}`);
      assert.equal(row.split(', ')[0], item.keys, `${item.bar} > ${item.label} reads ${item.keys} in its menu and ${row} in the sheet`);
      compared++;
    }
    assert.ok(compared > 20, `only ${compared} items of the menus have keys`);
    const want = NOTATION[platform];
    for (const id of ['arrange.order.front', 'navigate.next', 'edit.redo']) assert.equal(menus.get(id)?.keys, want[id], id);
    assert.equal(sheet['Edit > Redo'], want.redoSheet);
    assert.equal(sheet['View > Next Slide'], want.nextSheet);

    // the context menu of the image and the tooltips of the toolbar
    await click(page, '.reveal section.present .zone > img', { button: 'right' });
    await frames(page);
    const context = await shownItems(page);
    await press(page, 'Escape');
    assert.ok(context.some((i) => i.id === 'arrange.order.front'), 'the context menu of an image does not have Bring to Front');
    for (const item of context) if (menus.get(item.id)) assert.equal(item.keys, menus.get(item.id).keys, `${item.label} in the context menu`);
    const tips = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-top [data-command][title]')].map((b) => ({ id: b.dataset.command, title: b.title }))`);
    let tipped = 0;
    for (const tip of tips) {
      const keys = menus.get(tip.id)?.keys;
      if (!keys) continue;
      assert.ok(tip.title.endsWith(`(${keys})`), `the tooltip "${tip.title}" does not end with (${keys})`);
      tipped++;
    }
    assert.ok(tipped >= 2, `only ${tipped} tooltips have keys`);
    assert.deepEqual(errors(page), []);
  });
}
