// regression tests of R16.5 on both platforms: a second and a third new table on a section, title,
// closing, or split slide is put off the texts and the tables of its own block (G11), a check of
// an overlap on one slide is not dropped by the inserts on another slide (G10), and a turned
// figure is tested against the part of a line inside the box of its text (G9)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';

const DECK = 'test-deck.html';
const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
// slide 5 of the demo deck, with a heading, a paragraph, a list of three items, and a figure
const FIGURES = 4;
// the margin of the layouts at the left and the right of a slide, in slide px
const MARGIN = 120;

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
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const settle = async (page) => {
  await frames(page);
  await frames(page);
};
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const status = (page) => page.evaluate('window.BeesonEditor.status()');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const show = async (page, n) => {
  await page.evaluate(`Reveal.slide(${n})`);
  await settle(page);
};
// the index of the first slide of the deck that matches selector
const indexOf = (page, selector) => page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.matches(${js(selector)}))`);
const outlined = (page) => page.evaluate(`document.querySelectorAll('.reveal section.present .beeson-overflow').length`);

async function load(t, platform, deck = DECK) {
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
  return page;
}

// the boxes in slide px of the tables and the figures of the current slide, and of each line of
// the words of its headings, paragraphs, and list items outside a table
const pieces = (page) => page.evaluate(`(() => {
  const slide = document.querySelector('.reveal .slides > section.present');
  const s = slide.getBoundingClientRect();
  const k = s.width / slide.offsetWidth;
  const px = (r) => ({ left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k });
  const shown = (e) => e.getClientRects().length && !e.closest('aside.notes, .backdrop');
  const tables = [...slide.querySelectorAll('table')].filter(shown).map((e) => px(e.getBoundingClientRect()));
  const figures = [...slide.querySelectorAll('img, video, .qr, .plot, figure')].filter(shown).map((e) => px(e.getBoundingClientRect()));
  const texts = [...slide.querySelectorAll('h1, h2, p, li')].filter((e) => shown(e) && !e.closest('table')).flatMap((e) => {
    const range = document.createRange();
    range.selectNodeContents(e);
    return [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1).map((r) => ({ ...px(r), name: e.localName + ':' + e.textContent.trim().slice(0, 16) }));
  });
  return { tables, figures, texts };
})()`);
const meets = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
const round = (b) => [b.left, b.top, b.right - b.left, b.bottom - b.top].map(Math.round);
const inside = (b) => b.left >= MARGIN - 1 && b.right <= 1920 - MARGIN + 1 && b.top >= -1 && b.bottom <= 1081;

// count new tables of 3 by 3 on the first slide of deck that matches selector. each is put inside
// the margins and off the earlier tables, the figures, and the words of the slide, which are
// measured after the insert, since a new table in a block at the lower left pushes its words up.
// as many undos give the file byte for byte
async function newTables(t, platform, deck, selector, count = 3) {
  const page = await load(t, platform, deck);
  const n = await indexOf(page, selector);
  assert.ok(n >= 0, `${deck} does not have a slide ${selector}`);
  await show(page, n);
  const before = await render(page);
  for (let i = 0; i < count; i++) {
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await settle(page);
    const { tables, figures, texts } = await pieces(page);
    assert.equal(tables.length, i + 1, 'no table was inserted');
    // each new table is put after the earlier ones in the file
    const table = tables[i];
    const where = `table ${i + 1} on ${deck} ${selector} at ${js(round(table))}`;
    assert.ok(inside(table), `${where} is not inside the margins`);
    for (const o of tables.slice(0, i)) assert.ok(!meets(table, o), `${where} lies over a table at ${js(round(o))}`);
    for (const f of figures) assert.ok(!meets(table, f), `${where} lies over a figure at ${js(round(f))}`);
    for (const l of texts) assert.ok(!meets(table, l), `${where} lies over the words ${l.name} at ${js(round(l))}`);
  }
  for (let i = 0; i < count; i++) await undo(page);
  assert.equal(await render(page), before);
  assert.deepEqual(errors(page), []);
}

for (const platform of PLATFORMS) {
  // G11: the second table was put at 120, 808 over the lower 93 px of the first
  test(`three new tables on the section slide of the demo deck lie off each other and off the words (${platform})`, (t) => newTables(t, platform, DECK, '.section'));
  test(`three new tables on the section slide of the layouts page lie off each other and off the words (${platform})`, (t) => newTables(t, platform, LAYOUTS, '.section'));
  test(`three new tables on a title slide lie off each other and off the words (${platform})`, (t) => newTables(t, platform, DECK, '.title'));
  test(`three new tables on a closing slide lie off each other, the QR code, and the words (${platform})`, (t) => newTables(t, platform, DECK, '.closing'));
  // the text column of the split slide of the layouts page is full after two tables, hence a third one is
  // put by centerPlace of place.ts
  test(`two new tables on a split slide lie off each other, the zone, and the words (${platform})`, (t) => newTables(t, platform, LAYOUTS, '.split', 2));
}

for (const platform of PLATFORMS) {
  for (const kept of [false, true]) {
    // G10: the 64 later checks of slide 1 dropped the check of slide 5 under the cap
    test(`the report of a layout change on slide 5 stays after 70 inserts on slide 1${kept ? '' : ', each undone'} (${platform})`, async (t) => {
      const page = await load(t, platform);
      await show(page, FIGURES);
      await exec(page, 'slide.layout.wide');
      await settle(page);
      const s = await status(page);
      const m = s.message.match(/A picture covers (\d+) texts/);
      assert.ok(m, `the layout Wide is not reported: ${js(s.message)}`);
      const marked = await outlined(page);
      assert.equal(marked, Number(m[1]));
      await show(page, 0);
      for (let i = 0; i < 70; i++) {
        await exec(page, 'insert.qr');
        if (!kept) await undo(page);
      }
      await settle(page);
      assert.equal(await page.evaluate(`document.querySelectorAll('.reveal section.present .qr').length`), kept ? 70 : 0);
      await show(page, FIGURES);
      const later = await status(page);
      assert.ok(later.message.includes(`A picture covers ${m[1]} texts`), `the report of slide 5 is lost: ${js(later.message)}`);
      assert.equal(await outlined(page), marked);
      assert.deepEqual(errors(page), []);
    });
  }
}

// the boxes in slide px of the heading of the closing slide, of its one line of words, and of the
// last QR code, with the width of the QR code without its rotation
const heading = (page) => page.evaluate(`(() => {
  const slide = document.querySelector('.reveal .slides > section.present');
  const s = slide.getBoundingClientRect();
  const k = s.width / slide.offsetWidth;
  const px = (r) => ({ left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k });
  const h1 = slide.querySelector('h1');
  const range = document.createRange();
  range.selectNodeContents(h1);
  const codes = slide.querySelectorAll('.qr');
  const q = codes[codes.length - 1];
  return { h1: px(h1.getBoundingClientRect()), line: px(range.getClientRects()[0]), qr: px(q.getBoundingClientRect()), size: q.offsetWidth, marked: h1.classList.contains('beeson-overflow') };
})()`);

// a new QR code on the closing slide turned by 45 degrees, with its center put by a typed
// position at the point that at gives for the boxes of heading. a second move corrects the center
// by less than a px. the layout is then changed to Title, which keeps the place of the heading and
// asks for the report of the whole slide
async function turned(t, platform, at) {
  const page = await load(t, platform);
  await show(page, await indexOf(page, '.closing'));
  await exec(page, 'insert.qr');
  await settle(page);
  await exec(page, 'arrange.setRotation', { deg: 45 });
  await settle(page);
  const g = await heading(page);
  const c = at(g);
  let p = { x: Math.round(c.x - g.size / 2), y: Math.round(c.y - g.size / 2) };
  for (let i = 0; i < 2; i++) {
    await exec(page, 'arrange.setPosition', p);
    await settle(page);
    const m = await heading(page);
    p = { x: Math.round(p.x + c.x - (m.qr.left + m.qr.right) / 2), y: Math.round(p.y + c.y - (m.qr.top + m.qr.bottom) / 2) };
  }
  await exec(page, 'slide.layout.title');
  await settle(page);
  await settle(page);
  return { page, b: await heading(page), s: await status(page) };
}

for (const platform of PLATFORMS) {
  // G9: the lower corner of the turned QR code is 10 px inside the box of the heading and 20 px
  // right of the end of the words, hence it meets only the content area of the font above the box
  test(`a turned QR code that meets the line of a heading only above its box is not reported (${platform})`, async (t) => {
    const { page, b, s } = await turned(t, platform, (g) => ({ x: g.line.right + 20, y: g.h1.top + 10 - g.size / Math.SQRT2 }));
    assert.ok(Math.abs((b.qr.left + b.qr.right) / 2 - b.line.right - 20) < 1.5, `the QR code is not 20 px right of the words: ${js(b)}`);
    assert.ok(b.qr.bottom > b.h1.top + 8, `the QR code does not reach into the box of the heading: ${js(b)}`);
    assert.ok(b.line.top < b.h1.top - 2, `the line of the heading is inside its box: ${js(b)}`);
    assert.equal(s.overflow, 0, `the heading is reported: ${js(s.message)}`);
    assert.equal(b.marked, false, 'the heading is outlined');
    assert.deepEqual(errors(page), []);
  });

  // the lower corner of the turned QR code reaches 30 px into the box of the heading, 40 px left of
  // the end of the words, and it is still reported
  test(`a turned QR code whose corner reaches the words of a heading inside its box is reported (${platform})`, async (t) => {
    const { page, b, s } = await turned(t, platform, (g) => ({ x: g.line.right - 40, y: g.h1.top + 30 - g.size / Math.SQRT2 }));
    assert.ok(b.qr.bottom > b.h1.top + 28, `the QR code does not reach into the box of the heading: ${js(b)}`);
    assert.equal(s.overflow, 1, `the heading is not reported: ${js(s.message)}`);
    assert.match(s.message, /(A QR code covers 1 text|1 text covers a QR code)/);
    assert.equal(b.marked, true, 'the heading is not outlined');
    assert.deepEqual(errors(page), []);
  });
}
