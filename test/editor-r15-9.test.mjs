// regression tests of R15.9 on both platforms, by ruling 2 of the juror of round 6: a text over a
// figure is reported only after a change of the layout of its slide and after an insert that the
// editor placed, with a sentence that names what covers what. an overlap leaves the report once
// the user moves the text or the figure, and a text is tested by the lines of its words inside its
// box (gap 2 of the verdict, state 109)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press } from './helpers/editor.mjs';

const DECK = 'index.html';
const PLATFORMS = ['mac', 'other'];
// slide 5 of the demo deck, with a heading, a paragraph, a list of three items, and a figure
const FIGURES = 4;

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
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const status = (page) => page.evaluate('window.BeesonEditor.status()');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const settle = async (page) => {
  await frames(page);
  await frames(page);
};

// the editor on the demo deck with slide n shown
async function load(t, platform, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the texts of the current slide outside the shown elements of selector whose lines, clipped to the
// box of their text, meet the box of one of them, by tag name and the start of their text, and the
// texts outlined by the editor
const covered = (page, selector) => page.evaluate(`(() => {
  const slide = document.querySelector('.reveal .slides > section.present');
  const figs = [...slide.querySelectorAll(${js(selector)})].filter((f) => f.getClientRects().length).map((f) => ({ f, r: f.getBoundingClientRect() }));
  const meets = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const clip = (a, b) => ({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });
  const name = (el) => el.localName + ':' + el.textContent.trim().slice(0, 16);
  const texts = [...slide.querySelectorAll('[contenteditable="true"]')].filter((el) => !el.closest('aside.notes, .backdrop') && !figs.some(({ f }) => f.contains(el)));
  const under = texts.filter((el) => {
    const box = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    return [...range.getClientRects()].some((l) => l.width > 1 && figs.some(({ r }) => meets(clip(l, box), r)));
  });
  return { under: under.map(name), marked: [...slide.querySelectorAll('.beeson-overflow')].map(name) };
})()`);

// whether the first element of selector is drawn over the first text named in the list of covered
const onTop = (page, selector, text) => page.evaluate(`(() => {
  const slide = document.querySelector('.reveal .slides > section.present');
  const f = [...slide.querySelectorAll(${js(selector)})].find((e) => e.getClientRects().length);
  const el = [...slide.querySelectorAll('[contenteditable="true"]')].find((e) => e.localName + ':' + e.textContent.trim().slice(0, 16) === ${js(text)});
  const range = document.createRange();
  range.selectNodeContents(el);
  const a = f.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  for (const l of range.getClientRects()) {
    const x0 = Math.max(l.left, a.left, b.left), x1 = Math.min(l.right, a.right, b.right), y0 = Math.max(l.top, a.top, b.top), y1 = Math.min(l.bottom, a.bottom, b.bottom);
    if (x1 < x0 + 2 || y1 < y0 + 2) continue;
    const hit = document.elementsFromPoint((x0 + x1) / 2, (y0 + y1) / 2).find((e) => f.contains(e) || e === f || el.contains(e));
    return hit ? (f.contains(hit) || hit === f ? 'figure' : 'text') : null;
  }
  return null;
})()`);

// the scale of the slide on the screen, and the center of the move handle of the selected block
const scaleOf = (page) => page.evaluate(`document.querySelector('.reveal section.present').getBoundingClientRect().width / 1920`);
const handle = (page) => page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-handle')].find((d) => !d.hidden && d.getClientRects().length).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
// a point inside the first line of the first element of selector, 12 px from its left end
const lineStart = (page, selector) => page.evaluate(`(() => {
  const el = document.querySelector(${js(selector)});
  const range = document.createRange();
  range.selectNodeContents(el);
  const l = range.getClientRects()[0];
  return { x: l.left + 12, y: l.top + l.height / 2 };
})()`);

for (const platform of PLATFORMS) {
  // probe 13 of the verdict: the sentence named the wrong object and the wrong direction
  test(`a new table over a text is reported by name, and a drag of the table by 30 px takes the report away (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await settle(page);
    const c = await covered(page, ':scope > table');
    assert.ok(c.under.length > 0, 'the new table does not cover a text');
    const n = c.under.length;
    const s = await status(page);
    assert.ok(s.message.includes(`A table covers ${n} text${n === 1 ? '' : 's'}`), `the status reads ${js(s.message)} for ${js(c.under)}`);
    assert.ok(!/over a figure/.test(s.message), s.message);
    assert.deepEqual(c.marked, c.under, 'the outlined texts are not those under the table');
    assert.equal(await onTop(page, ':scope > table', c.under[0]), 'figure', 'the table is not drawn over the text');
    // an undo of the insert takes the report away, and a redo brings it back
    await undo(page);
    await settle(page);
    assert.equal((await status(page)).overflow, 0, 'the report stays after an undo of the insert');
    await redo(page);
    await settle(page);
    assert.ok((await status(page)).message.includes('A table covers'), 'the report is not back after a redo of the insert');
    // the table is moved by 30 slide px by its handle and still covers a text
    const k = await scaleOf(page);
    await drag(page, await handle(page), { dx: 30 * k, dy: 0, steps: 8 });
    await settle(page);
    const moved = await covered(page, ':scope > table');
    assert.ok(moved.under.length > 0, 'the table moved by 30 px does not cover a text');
    assert.notEqual(await render(page), page.source);
    const m = await status(page);
    assert.equal(m.overflow, 0, `the table moved by the user is reported: ${js(m.message)}`);
    assert.ok(!/cover/.test(m.message), m.message);
    assert.deepEqual(moved.marked, []);
    await undo(page);
    await undo(page);
    await settle(page);
    assert.equal(await render(page), page.source);
    const u = await status(page);
    assert.equal(u.overflow, 0, `after an undo of the drag and of the insert the status reads ${js(u.message)}`);
    assert.deepEqual((await covered(page, ':scope > figure img')).marked, []);
    assert.deepEqual(errors(page), []);
  });

  // probe 2 and gap 1 of the verdict
  test(`the figure of slide 5 dragged over the text column is not reported (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    const img = '.reveal section.present figure img';
    await click(page, img);
    await frames(page);
    const at = await page.evaluate(`(() => { const r = [...document.querySelectorAll(${js(img)})].find((i) => i.getClientRects().length).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const k = await scaleOf(page);
    await drag(page, at, { dx: -530 * k, dy: -40 * k, steps: 12 });
    await settle(page);
    assert.notEqual(await render(page), page.source);
    const c = await covered(page, ':scope > figure img');
    assert.ok(c.under.length >= 3, `the figure is not over the text column: ${js(c.under)}`);
    const s = await status(page);
    assert.equal(s.overflow, 0, `the status reads ${js(s.message)}`);
    assert.ok(!/cover|over a figure/.test(s.message), s.message);
    assert.deepEqual(c.marked, []);
    assert.deepEqual(errors(page), []);
  });

  // the texts left under the picture of slide 5 by the layout Wide. a text that the user moves
  // leaves the report, and the others stay until the picture is moved
  test(`a change of layout that leaves texts under a picture is reported, and a text or the picture moved leaves the report (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await exec(page, 'slide.layout.wide');
    await settle(page);
    const c = await covered(page, ':scope > figure img');
    assert.ok(c.under.length >= 2, `the layout Wide does not leave two texts under the picture: ${js(c.under)}`);
    assert.equal(await onTop(page, ':scope > figure img', c.under[0]), 'figure');
    const n = c.under.length;
    assert.ok((await status(page)).message.includes(`A picture covers ${n} texts`), (await status(page)).message);
    assert.deepEqual(c.marked, c.under);
    // the paragraph is nudged down by the keys
    await click(page, await lineStart(page, '.reveal section.present > p'));
    await press(page, 'Escape');
    await press(page, 'ArrowDown');
    await settle(page);
    const p = (await covered(page, ':scope > figure img'));
    const para = p.under.find((x) => x.startsWith('p:'));
    assert.ok(para, `the nudged paragraph is not under the picture: ${js(p.under)}`);
    assert.ok(!p.marked.includes(para), `the nudged paragraph is outlined: ${js(p.marked)}`);
    assert.deepEqual(p.marked, p.under.filter((x) => x !== para), 'the other texts left the report');
    const rest = p.under.length - 1;
    assert.ok((await status(page)).message.includes(`A picture covers ${rest} text${rest === 1 ? '' : 's'}`), (await status(page)).message);
    // the picture is nudged left
    await click(page, '.reveal section.present figure img');
    await press(page, 'ArrowLeft');
    await settle(page);
    const f = await covered(page, ':scope > figure img');
    assert.ok(f.under.length >= 2, `the nudged picture is not over the texts: ${js(f.under)}`);
    assert.deepEqual(f.marked, []);
    assert.ok(!/cover/.test((await status(page)).message), (await status(page)).message);
    assert.deepEqual(errors(page), []);
  });

  test(`a text drawn over a picture after a change of layout is named before the picture (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await click(page, await lineStart(page, '.reveal section.present > p'));
    await press(page, 'Escape');
    await exec(page, 'arrange.order.front');
    await settle(page);
    assert.notEqual(await render(page), page.source, 'Bring to Front did not act on the paragraph');
    await exec(page, 'slide.layout.wide');
    await settle(page);
    const c = await covered(page, ':scope > figure img');
    const para = c.under.find((x) => x.startsWith('p:'));
    assert.ok(para && c.under.length >= 2, `the layout Wide does not leave the paragraph and a list item under the picture: ${js(c.under)}`);
    assert.equal(await onTop(page, ':scope > figure img', para), 'text');
    const rest = c.under.length - 1;
    const s = await status(page);
    assert.ok(s.message.includes(`A picture covers ${rest} text${rest === 1 ? '' : 's'}. 1 text covers a picture`), s.message);
    assert.deepEqual(c.marked, c.under);
    assert.deepEqual(errors(page), []);
  });

  // item 3 of the brief: a picture and a QR code over texts after a change of layout are named in
  // one sentence. the QR code is put over the paragraph by a typed position, which is not reported
  test(`a picture and a QR code over texts after a change of layout are named in one sentence (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await exec(page, 'insert.qr');
    await settle(page);
    const p = await page.evaluate(`(() => {
      const slide = document.querySelector('.reveal .slides > section.present');
      const s = slide.getBoundingClientRect();
      const k = s.width / slide.offsetWidth;
      const r = slide.querySelector(':scope > p').getBoundingClientRect();
      return { x: Math.round((r.left - s.left) / k + 100), y: Math.round((r.top - s.top) / k) };
    })()`);
    await exec(page, 'arrange.setPosition', p);
    await settle(page);
    assert.ok((await covered(page, '.qr')).under.length > 0, 'the QR code is not over a text');
    assert.equal((await status(page)).overflow, 0, 'an overlap made by a typed position is reported');
    await exec(page, 'slide.layout.wide');
    await settle(page);
    const qr = await covered(page, '.qr');
    const both = await covered(page, ':scope > figure img, .qr');
    assert.ok(qr.under.length > 0, `the QR code is not over a text after Wide: ${js(qr.under)}`);
    const n = both.under.length;
    const s = await status(page);
    assert.match(s.message, new RegExp(`A (picture and a QR code|QR code and a picture) cover ${n} texts`), `the status reads ${js(s.message)} for ${js(both.under)}`);
    assert.deepEqual(both.marked, both.under);
    assert.deepEqual(errors(page), []);
  });
}

// the closing slide of the deck, with a second QR code that is selected
async function closing(t, platform) {
  const page = await load(t, platform, 0);
  await page.evaluate(`Reveal.slide([...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.matches('.closing')))`);
  await frames(page);
  await exec(page, 'insert.qr');
  await frames(page);
  return page;
}

// the boxes in slide px of the heading, of its one line of text, and of the last QR code
const boxes = (page) => page.evaluate(`(() => {
  const slide = document.querySelector('.reveal .slides > section.present');
  const s = slide.getBoundingClientRect();
  const k = s.width / slide.offsetWidth;
  const px = (r) => ({ left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k });
  const h1 = slide.querySelector('h1');
  const range = document.createRange();
  range.selectNodeContents(h1);
  const codes = slide.querySelectorAll('.qr');
  return { h1: px(h1.getBoundingClientRect()), line: px(range.getClientRects()[0]), qr: px(codes[codes.length - 1].getBoundingClientRect()), marked: h1.classList.contains('beeson-overflow') };
})()`);

// puts the new QR code over the first word of the heading by a typed position, with its lower edge
// dy px under the upper edge of the box of the heading. an overlap made by the user is not
// reported, hence the layout is then changed to Title, which keeps the place of the heading and
// asks for the report of the whole slide. typed is the count of the report after the typed position
async function put(page, dy) {
  const b = await boxes(page);
  await exec(page, 'arrange.setPosition', { x: Math.round(b.h1.left + 40), y: Math.round(b.h1.top - (b.qr.bottom - b.qr.top) + dy) });
  await frames(page);
  const typed = (await status(page)).overflow;
  await exec(page, 'slide.layout.title');
  await settle(page);
  return { ...(await boxes(page)), typed };
}

for (const platform of PLATFORMS) {
  // state 109 of round 6: a QR code snapped to the upper edge of the heading "Thank you" was
  // reported as "1 text lies over a figure", since the rect of the line starts 18 px over the box
  test(`a QR code that ends at the upper edge of a heading is not reported as under its text (${platform})`, async (t) => {
    const page = await closing(t, platform);
    const b = await put(page, 0);
    assert.ok(Math.abs(b.qr.bottom - b.h1.top) < 1, `the QR code does not end at the heading: ${js(b)}`);
    assert.ok(b.qr.right > b.line.left + 2 && b.qr.left < b.line.right - 2, `the QR code is not over the text of the heading: ${js(b)}`);
    // the content area of the font is taller than the box of the heading
    assert.ok(b.line.top < b.h1.top - 2, `the line of the heading is inside its box: ${js(b)}`);
    const s = await status(page);
    assert.equal(s.overflow, 0, `the heading is reported: ${js(s.message)}`);
    assert.equal(b.marked, false, 'the heading is outlined');
    assert.deepEqual(errors(page), []);
  });

  test(`a QR code that reaches 10 px into the box of a heading is reported after a change of layout (${platform})`, async (t) => {
    const page = await closing(t, platform);
    const b = await put(page, 10);
    assert.equal(b.typed, 0, 'an overlap made by a typed position is reported');
    assert.ok(Math.abs(b.qr.bottom - b.h1.top - 10) < 1, `the QR code does not reach into the heading: ${js(b)}`);
    const s = await status(page);
    assert.equal(s.overflow, 1, `the heading is not reported: ${js(s.message)}`);
    assert.match(s.message, /(A QR code covers 1 text|1 text covers a QR code)/);
    assert.equal(b.marked, true, 'the heading is not outlined');
    assert.deepEqual(errors(page), []);
  });
}
