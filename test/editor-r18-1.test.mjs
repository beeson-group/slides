// regression tests of R18.1 on both platforms with trusted input. a layer command of
// commands/order.ts changes the order drawn and not the order of the steps, and the file is back to
// the source once the rows are in their first order, by the same bytes for the same order whatever
// the route (finding C2). a list, whose items the theme positions, is drawn and listed in the order
// of the layers of z-index 0 (C3). the selection of a command stays over its undo and redo (C4)

import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const SOURCE = readFileSync('index.html', 'utf8');
const slideOf = (text, has) => [...text.matchAll(/<section[\s\S]*?<\/section>/g)].findIndex((m) => has(m[0]));
const STEPS = slideOf(SOURCE, (s) => s.includes('Show your steps one at a time'));
const FIGURES = slideOf(SOURCE, (s) => s.includes('Figures are first class citizens'));
const CLOSING = slideOf(SOURCE, (s) => s.startsWith('<section class="closing"'));
const LAYOUTS = 'test/pages/editor-layouts.html';
const LAYOUTS_SOURCE = readFileSync(LAYOUTS, 'utf8');
const BACKDROP = slideOf(LAYOUTS_SOURCE, (s) => s.includes('A figure slide with a backdrop'));
const PLATFORMS = ['mac', 'other'];
const KEYS = {
  mac: { front: 'Mod+Shift+F', forward: 'Mod+Alt+Shift+F', backward: 'Mod+Alt+Shift+B', back: 'Mod+Shift+B', undo: 'Mod+Z', redo: 'Mod+Shift+Z' },
  other: { front: 'Mod+Shift+ArrowUp', forward: 'Mod+ArrowUp', backward: 'Mod+ArrowDown', back: 'Mod+Shift+ArrowDown', undo: 'Mod+Z', redo: 'Mod+Shift+Z' },
};
const S = '.reveal section.present';
const LIST_KEY = { mac: 'Mod+Shift+L', other: 'Alt+F10' };
const ROW = '.beeson-edit-objects .row';

// copies of the demo deck. in each, the foot of slide 3 is moved over the list: written last, also
// as a step after the items, which have no index (FRAGFOOT), or written after the heading
// (FOOTFIRST). in OVERLAPS the QR code of the closing slide is over the heading, and in FIGOVER the
// figure of slide 5 is over the list
const FOOT = '<div class="foot">Slides can have backdrops';
const MOVED_FOOT = '<div class="foot" style="translate: 0px -150px">Slides can have backdrops';
const QR = '<div class="qr" data-qr="https://github.com/beeson-group/slides">';
const OVERLAPS = SOURCE.replace(FOOT, MOVED_FOOT).replace(QR, QR.replace('>', ' style="translate: -1589px -245px">'));
const FRAGFOOT = SOURCE.replace(/<section[\s\S]*?<\/section>/g, (s) => (s.includes('Show your steps one at a time') ? s.replace(/ data-fragment-index="\d"/g, '') : s))
  .replace(FOOT, '<div class="foot fragment" style="translate: 0px -150px">Slides can have backdrops');
const footLine = SOURCE.split('\n').find((l) => l.includes(FOOT));
const FOOTFIRST = SOURCE.replace(`${footLine}\n`, '').replace('<h2>Show your steps one at a time</h2>\n', `<h2>Show your steps one at a time</h2>\n${footLine.replace(FOOT, MOVED_FOOT)}\n`);
const FIGOVER = SOURCE.replace('<figure class="zone">', '<figure class="zone" style="translate: -530px -40px">');

const STEP_EL = { h2: `${S} > h2`, p: `${S} > p`, ul: `${S} > ul`, foot: `${S} > .foot` };
const STEP_ROWS = { h2: 'Text: Show your steps', p: 'Text: Design the complete', ul: 'Text: Each step is', foot: 'Text: Slides can have' };
const FIG_ROWS = { h2: 'Text: Figures are first', p: 'Text: Export your', ul: 'Text: Dark and light', fig: 'Figure' };
const CAP_EL = { cap: `${S} > .caption`, bd: `${S} > .backdrop` };
const CAP_ROWS = { h2: 'Text: A figure slide with', cap: 'Text: A backdrop over' };
const CLOSE_ROWS = { h1: 'Text: Thank you', sub: 'Text: Questions', who: 'Text: github.com', qr: 'QR Code' };

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
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const orders = async (page) => Object.fromEntries(await Promise.all(['front', 'forward', 'backward', 'back'].map(async (o) => [o, (await state(page, `arrange.order.${o}`)).enabled])));
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((e) => [e.localName, ...e.classList].filter((c) => !c.startsWith('beeson')).join('.'))`);
// the rows without the row of the backdrop, which is at the ground of the list
const rows = (page) => page.evaluate(`[...document.querySelectorAll(${js(ROW)})].filter((r) => r.dataset.kind !== 'Backdrop').map((r) => r.querySelector('.name').textContent)`);
// the rows of the object list from front to back, each by its key in names
const named = async (page, names) => (await rows(page)).map((r) => Object.keys(names).find((k) => r.startsWith(names[k])) ?? r);

// the deck text saved as file and opened with the editor at slide n, with the object list shown
async function load(t, platform, text, n, file = `.r18-1-${platform}-${n}.html`) {
  if (text !== LAYOUTS_SOURCE) {
    writeFileSync(file, text);
    t.after(() => rmSync(file, { force: true }));
  }
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${file}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = text;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(text)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  await press(page, LIST_KEY[platform]);
  await frames(page);
  return page;
}

const rowAt = (page, names, name) => page.evaluate(`(() => { const r = [...document.querySelectorAll(${js(ROW)})].find((x) => x.querySelector('.name').textContent.startsWith(${js(names[name])})).getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2 }; })()`);
// the element of the row of names[name] selected by a click on this row of the object list
async function pick(page, names, name) {
  await click(page, await rowAt(page, names, name));
  await frames(page);
  assert.equal((await selected(page)).length, 1);
}

// the command of order run by its key on the selection, with a check of its history entry
async function layer(page, platform, order) {
  const base = await render(page);
  await press(page, KEYS[platform][order]);
  await frames(page);
  const edited = await render(page);
  assert.notEqual(edited, base, `the command ${order} does not change the file`);
  return edited;
}

// the texts of the steps of slide n of text in the show without the editor, in the order shown
async function stepsOf(t, text, n, file) {
  writeFileSync(file, text);
  t.after(() => rmSync(file, { force: true }));
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/${file}`);
  await page.waitFor(deckSettled);
  await page.evaluate(`Reveal.slide(${n})`);
  return page.evaluate(`[...Reveal.getCurrentSlide().querySelectorAll('.fragment')]
    .sort((a, b) => a.dataset.fragmentIndex - b.dataset.fragmentIndex).map((f) => f.textContent.trim().slice(0, 14)).filter((s) => s)`);
}

// a point of the text of the element of selector a inside the box of the element of b, in CSS px
const overlap = (page, a, b) => page.evaluate(`(() => {
  const el = document.querySelector(${js(a)});
  const box = [...document.querySelectorAll(${js(b)})].find((e) => e.getClientRects().length).getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(el);
  for (const r of range.getClientRects()) {
    const x = Math.max(r.left, box.left) + 12, y = r.top + r.height / 2;
    if (x < Math.min(r.right, box.right) - 4 && y > box.top && y < box.bottom) return { x, y };
  }
  return null;
})()`);
// the key in els of the element drawn on top at a point, i.e. the one that a click there hits
const topAt = (page, at, els) => page.evaluate(`(() => {
  const els = ${js(els)};
  for (const hit of document.elementsFromPoint(${at.x}, ${at.y})) {
    const k = Object.keys(els).find((n) => document.querySelector(els[n]).contains(hit));
    if (k) return k;
  }
  return null;
})()`);

for (const platform of PLATFORMS) {
  test(`${platform}: Send Backward of a foot that is a step after the items of the list keeps the order of the steps of slide 3 (C2)`, async (t) => {
    const page = await load(t, platform, FRAGFOOT, STEPS);
    assert.deepEqual(await named(page, STEP_ROWS), ['foot', 'ul', 'p', 'h2']);
    await pick(page, STEP_ROWS, 'foot');
    await layer(page, platform, 'backward');
    assert.deepEqual(await named(page, STEP_ROWS), ['ul', 'foot', 'p', 'h2']);
    const at = await overlap(page, STEP_EL.foot, STEP_EL.ul);
    assert.equal(await topAt(page, at, { foot: STEP_EL.foot, ul: STEP_EL.ul }), 'ul');
    const { text } = await saveAndReopen(page, `.r18-1-c2a-${platform}.html`);
    assert.deepEqual(errors(page), []);
    // a page of the show is opened last, since the page of the editor is then in the background
    const source = await stepsOf(t, FRAGFOOT, STEPS, `.r18-1-${platform}-show-a.html`);
    assert.deepEqual(source, ['Each step is a', 'Two elements w', 'When exporting', 'Slides can hav']);
    assert.deepEqual(await stepsOf(t, text, STEPS, `.r18-1-${platform}-show-b.html`), source, 'Send Backward changes the order of the steps in the show');
  });

  test(`${platform}: three Send Backward and three Bring Forward of the foot of slide 3 give the file back, drawn as listed at each step (C2, C3)`, async (t) => {
    const page = await load(t, platform, OVERLAPS, STEPS);
    const pair = { foot: STEP_EL.foot, ul: STEP_EL.ul };
    const at = await overlap(page, STEP_EL.foot, STEP_EL.ul);
    await pick(page, STEP_ROWS, 'foot');
    const expect = [['ul', 'foot', 'p', 'h2'], ['ul', 'p', 'foot', 'h2'], ['ul', 'p', 'h2', 'foot'], ['ul', 'p', 'foot', 'h2'], ['ul', 'foot', 'p', 'h2'], ['foot', 'ul', 'p', 'h2']];
    for (const [i, order] of ['backward', 'backward', 'backward', 'forward', 'forward', 'forward'].entries()) {
      await layer(page, platform, order);
      const list = await named(page, STEP_ROWS);
      assert.deepEqual(list, expect[i], `step ${i + 1}`);
      assert.equal(await topAt(page, at, pair), list.indexOf('foot') < list.indexOf('ul') ? 'foot' : 'ul', `the order drawn at step ${i + 1} is not the order listed`);
    }
    assert.equal(await render(page), OVERLAPS, 'the file is not the source once the rows are in their first order');
    assert.deepEqual(errors(page), []);
  });

  test(`${platform}: Send Backward three times, a drag of the row to the bottom, and Send to Back of the figure of slide 5 write the same bytes (C2)`, async (t) => {
    const page = await load(t, platform, FIGOVER, FIGURES);
    assert.deepEqual(await named(page, FIG_ROWS), ['fig', 'ul', 'p', 'h2']);
    await pick(page, FIG_ROWS, 'fig');
    for (let i = 0; i < 3; i++) await layer(page, platform, 'backward');
    const stepped = await render(page);
    assert.deepEqual(await named(page, FIG_ROWS), ['ul', 'p', 'h2', 'fig']);
    for (let i = 0; i < 3; i++) await undo(page);
    await frames(page);
    assert.equal(await render(page), FIGOVER);
    await pick(page, FIG_ROWS, 'fig');
    const back = await layer(page, platform, 'back');
    assert.deepEqual(await named(page, FIG_ROWS), ['ul', 'p', 'h2', 'fig']);
    assert.equal(stepped, back, 'Send Backward three times and Send to Back write different bytes for the same order');
    await undo(page);
    await frames(page);
    assert.equal(await render(page), FIGOVER);
    const from = await rowAt(page, FIG_ROWS, 'fig');
    const last = await page.evaluate(`[...document.querySelectorAll(${js(ROW)})].at(-1).getBoundingClientRect().bottom`);
    await drag(page, from, { dy: last - 3 - from.y, steps: 12 });
    await frames(page);
    assert.deepEqual(await named(page, FIG_ROWS), ['ul', 'p', 'h2', 'fig']);
    assert.equal(await render(page), back, 'a drag of the row and Send to Back write different bytes for the same order');
    assert.deepEqual(errors(page), []);
  });

  // the heading is drawn under the backdrop over the whole slide, hence Send Backward of the caption,
  // which would put it under the backdrop, is dimmed and does not change the file (R21.3, V20)
  test(`${platform}: Send Backward and Send to Back of the caption of a figure slide with a backdrop do not put it under the backdrop (C2)`, async (t) => {
    const page = await load(t, platform, LAYOUTS_SOURCE, BACKDROP, LAYOUTS);
    const list = await named(page, CAP_ROWS);
    await pick(page, CAP_ROWS, 'cap');
    assert.deepEqual(await orders(page), { front: false, forward: false, backward: false, back: false });
    await press(page, KEYS[platform].backward);
    await press(page, KEYS[platform].back);
    await frames(page);
    assert.deepEqual(await named(page, CAP_ROWS), list);
    assert.equal(await render(page), LAYOUTS_SOURCE, 'the caption is moved in the file');
    const at = await page.evaluate(`(() => { const r = document.querySelector(${js(CAP_EL.cap)}).getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
    assert.equal(await topAt(page, at, CAP_EL), 'cap', 'the backdrop is drawn over the caption');
    assert.deepEqual(errors(page), []);
  });

  test(`${platform}: the object list shows a foot written before the list under it, and Bring to Front brings it over the list (C3)`, async (t) => {
    const page = await load(t, platform, FOOTFIRST, STEPS);
    const pair = { foot: STEP_EL.foot, ul: STEP_EL.ul };
    const at = await overlap(page, STEP_EL.foot, STEP_EL.ul);
    assert.ok(at, 'the foot is not over the list');
    assert.equal(await topAt(page, at, pair), 'ul');
    assert.deepEqual(await named(page, STEP_ROWS), ['ul', 'foot', 'p', 'h2'], 'the object list shows the foot over the list drawn over it');
    await pick(page, STEP_ROWS, 'foot');
    assert.deepEqual(await orders(page), { front: true, forward: true, backward: true, back: true });
    await layer(page, platform, 'front');
    assert.deepEqual(await named(page, STEP_ROWS), ['foot', 'ul', 'p', 'h2']);
    assert.equal(await topAt(page, at, pair), 'foot', 'Bring to Front does not draw the foot over the list');
    const { text } = await saveAndReopen(page, `.r18-1-c3-${platform}.html`);
    assert.deepEqual(errors(page), []);
    assert.deepEqual(await stepsOf(t, text, STEPS, `.r18-1-${platform}-show-c.html`), await stepsOf(t, FOOTFIRST, STEPS, `.r18-1-${platform}-show-d.html`));
  });

  test(`${platform}: the QR code stays selected over the undo and the redo of Send Backward, and a second Send Backward moves it (C4)`, async (t) => {
    const page = await load(t, platform, OVERLAPS, CLOSING);
    assert.deepEqual(await named(page, CLOSE_ROWS), ['qr', 'who', 'sub', 'h1']);
    await pick(page, CLOSE_ROWS, 'qr');
    await layer(page, platform, 'backward');
    assert.deepEqual(await named(page, CLOSE_ROWS), ['who', 'qr', 'sub', 'h1']);
    await press(page, KEYS[platform].undo);
    await frames(page);
    assert.deepEqual(await selected(page), ['div.qr'], 'the undo selects another element');
    await press(page, KEYS[platform].redo);
    await frames(page);
    assert.deepEqual(await selected(page), ['div.qr'], 'the redo selects another element');
    await layer(page, platform, 'backward');
    assert.deepEqual(await named(page, CLOSE_ROWS), ['who', 'sub', 'qr', 'h1'], 'the second Send Backward does not move the QR code');
    assert.deepEqual(await selected(page), ['div.qr']);
    assert.deepEqual(errors(page), []);
  });
}
