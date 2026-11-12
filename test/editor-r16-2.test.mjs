// regression tests of R16.2 on both platforms with trusted input. the layer commands of
// commands/order.ts move the selected element in the one order of the slide that the object list
// shows. Bring Forward and Send Backward pass one row, also past a backdrop, which the list does not
// show (finding G4). a z-index that a command writes gives the order that the list shows (G5). the
// commands and a drag of a row order the texts of the block of a closing slide among the other
// objects of the slide (G6). after each step, the order drawn, the order that a click hits, and the
// order of the list are the same

import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const DECK = 'index.html';
const slideOf = (text, has) => [...text.matchAll(/<section[\s\S]*?<\/section>/g)].findIndex((m) => has(m[0]));
const SOURCE = readFileSync(DECK, 'utf8');
const STEPS = slideOf(SOURCE, (s) => s.includes('Show your steps one at a time'));
const CLOSING = slideOf(SOURCE, (s) => s.startsWith('<section class="closing"'));
const PLATFORMS = ['mac', 'other'];
const KEYS = {
  mac: { front: 'Mod+Shift+F', forward: 'Mod+Alt+Shift+F', backward: 'Mod+Alt+Shift+B', back: 'Mod+Shift+B' },
  other: { front: 'Mod+Shift+ArrowUp', forward: 'Mod+ArrowUp', backward: 'Mod+ArrowDown', back: 'Mod+Shift+ArrowDown' },
};
const LABELS = { front: 'Bring to Front', forward: 'Bring Forward', backward: 'Send Backward', back: 'Send to Back' };
const S = '.reveal section.present';
const LIST_KEY = { mac: 'Mod+Shift+L', other: 'Alt+F10' };
const ROW = '.beeson-edit-objects .row';

// a copy of the demo deck in which the foot of slide 3 is moved up over the list, and the QR code
// of the closing slide over the heading and the subtitle
const FOOT = '<div class="foot">Slides can have backdrops';
const QR = '<div class="qr" data-qr="https://github.com/beeson-group/slides">';
const OVERLAPS = SOURCE.replace(FOOT, '<div class="foot" style="translate: 0px -150px">Slides can have backdrops')
  .replace(QR, '<div class="qr" data-qr="https://github.com/beeson-group/slides" style="translate: -1589px -245px">');

const STEP_EL = { h2: `${S} > h2`, p: `${S} > p`, ul: `${S} > ul`, foot: `${S} > .foot` };
const STEP_ROWS = { h2: 'Text: Show your steps', p: 'Text: Design the complete', ul: 'Text: Each step is', foot: 'Text: Slides can have' };
const CLOSE_EL = { h1: `${S} .block > h1`, sub: `${S} .block > .sub`, who: `${S} .block > .who`, qr: `${S} > .qr` };
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
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const orders = async (page) => Object.fromEntries(await Promise.all(['front', 'forward', 'backward', 'back'].map(async (o) => [o, (await state(page, `arrange.order.${o}`)).enabled])));
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((e) => e.localName)`);
// the rows without the row of the backdrop, which is at the ground of the list
const rows = (page) => page.evaluate(`[...document.querySelectorAll(${js(ROW)})].filter((r) => r.dataset.kind !== 'Backdrop').map((r) => r.querySelector('.name').textContent)`);
// the rows of the object list from front to back, each by its key in names
const named = async (page, names) => (await rows(page)).map((r) => Object.keys(names).find((k) => r.startsWith(names[k])) ?? r);

async function load(t, platform, n) {
  const file = `.r16-2-${platform}-${n}.html`;
  writeFileSync(file, OVERLAPS);
  t.after(() => rmSync(file, { force: true }));
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${file}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = OVERLAPS;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  await press(page, LIST_KEY[platform]);
  await frames(page);
  return page;
}

// the element of the row of names[name] selected by a click on this row of the object list
async function pick(page, names, name) {
  const at = await page.evaluate(`(() => { const r = [...document.querySelectorAll(${js(ROW)})].find((x) => x.querySelector('.name').textContent.startsWith(${js(names[name])})).getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await frames(page);
  assert.equal((await selected(page)).length, 1);
}

// whether the row of names[name] is the one row selected in the object list
const rowSelected = (page, names, name) => page.evaluate(`[...document.querySelectorAll(${js(ROW)})]
  .filter((r) => r.getAttribute('aria-selected') === 'true').map((r) => r.querySelector('.name').textContent.startsWith(${js(names[name])})).join()`);

// the command of order run by its key on the element of the row of names[name], then undone and
// redone, which gives the text before and after the command byte for byte, with the row selected
// throughout
async function layer(page, platform, order, names, name) {
  await pick(page, names, name);
  const base = await render(page);
  await press(page, KEYS[platform][order]);
  await frames(page);
  const edited = await render(page);
  if (edited === base) return edited;
  assert.equal((await state(page, 'edit.undo')).label, `Undo ${LABELS[order]}`);
  await undo(page);
  await frames(page);
  assert.equal(await render(page), base, `the undo of ${LABELS[order]} does not give the text back byte for byte`);
  assert.equal(await rowSelected(page, names, name), 'true', `the undo of ${LABELS[order]} selects another row`);
  await redo(page);
  await frames(page);
  assert.equal(await render(page), edited);
  assert.equal(await rowSelected(page, names, name), 'true', `the redo of ${LABELS[order]} selects another row`);
  return edited;
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
// whether the rows of list show a in front of b
const listedOver = (list, a, b) => list.indexOf(a) < list.indexOf(b);

for (const platform of PLATFORMS) {
  test(`${platform}: Bring Forward and Send Backward of the list of slide 3 pass one row of the object list, past the backdrop (G4)`, async (t) => {
    const page = await load(t, platform, STEPS);
    const pair = { foot: STEP_EL.foot, ul: STEP_EL.ul };
    const at = await overlap(page, STEP_EL.foot, STEP_EL.ul);
    assert.ok(at, 'the foot is not over the list');
    assert.deepEqual(await named(page, STEP_ROWS), ['foot', 'ul', 'p', 'h2']);
    assert.equal(await topAt(page, at, pair), 'foot');
    await pick(page, STEP_ROWS, 'ul');
    assert.deepEqual(await orders(page), { front: true, forward: true, backward: true, back: true });

    await layer(page, platform, 'forward', STEP_ROWS, 'ul');
    assert.deepEqual(await named(page, STEP_ROWS), ['ul', 'foot', 'p', 'h2'], 'Bring Forward does not pass the foot');
    assert.equal(await topAt(page, at, pair), 'ul', 'the foot is drawn over the list brought forward');
    assert.deepEqual(await orders(page), { front: false, forward: false, backward: true, back: true }, 'Send Backward or Send to Back is dimmed');

    await layer(page, platform, 'backward', STEP_ROWS, 'ul');
    assert.deepEqual(await named(page, STEP_ROWS), ['foot', 'ul', 'p', 'h2']);
    assert.equal(await topAt(page, at, pair), 'foot');
    assert.equal(await render(page), page.source, 'a declaration is left once the list is back in the order of the file');
    assert.deepEqual(await orders(page), { front: true, forward: true, backward: true, back: true });

    await layer(page, platform, 'backward', STEP_ROWS, 'ul');
    assert.deepEqual(await named(page, STEP_ROWS), ['foot', 'p', 'ul', 'h2'], 'Send Backward does not pass one row');
    await layer(page, platform, 'back', STEP_ROWS, 'ul');
    assert.deepEqual(await named(page, STEP_ROWS), ['foot', 'p', 'h2', 'ul']);
    assert.deepEqual(await orders(page), { front: true, forward: true, backward: false, back: false });
    await layer(page, platform, 'front', STEP_ROWS, 'ul');
    assert.deepEqual(await named(page, STEP_ROWS), ['ul', 'foot', 'p', 'h2']);
    assert.equal(await topAt(page, at, pair), 'ul');
    await layer(page, platform, 'backward', STEP_ROWS, 'ul');
    assert.deepEqual(await named(page, STEP_ROWS), ['foot', 'ul', 'p', 'h2']);
    assert.equal(await render(page), page.source, 'a declaration is left once the list is back in the order of the file');
    const { text } = await saveAndReopen(page, `.r16-2-g4-${platform}.html`);
    assert.equal(text, page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`${platform}: the order of the heading of the closing slide and the QR code is drawn as the object list shows it (G5)`, async (t) => {
    const page = await load(t, platform, CLOSING);
    const pair = { h1: CLOSE_EL.h1, qr: CLOSE_EL.qr };
    const at = await overlap(page, CLOSE_EL.h1, CLOSE_EL.qr);
    assert.ok(at, 'the QR code is not over the heading');
    assert.deepEqual(await named(page, CLOSE_ROWS), ['qr', 'who', 'sub', 'h1']);
    assert.equal(await topAt(page, at, pair), 'qr');
    // the steps of the finding: Bring to Front of the heading, of the subtitle, and of the heading
    for (const name of ['h1', 'sub', 'h1']) {
      await layer(page, platform, 'front', CLOSE_ROWS, name);
      const list = await named(page, CLOSE_ROWS);
      assert.equal(await topAt(page, at, pair), listedOver(list, 'h1', 'qr') ? 'h1' : 'qr', `the object list ${list.join(' | ')} is not the order drawn`);
    }
    await pick(page, CLOSE_ROWS, 'qr');
    const list = await named(page, CLOSE_ROWS);
    const o = await orders(page);
    assert.equal(o.front, list[0] !== 'qr', 'Bring to Front of the QR code is not dimmed only at the front of the list');
    if (o.front) await layer(page, platform, 'front', CLOSE_ROWS, 'qr');
    assert.equal((await named(page, CLOSE_ROWS))[0], 'qr');
    assert.equal(await topAt(page, at, pair), 'qr', 'the QR code brought to the front is drawn under the heading');
    await saveAndReopen(page, `.r16-2-g5-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });

  test(`${platform}: the layer commands and a drag of a row order the texts of the block of the closing slide among the objects of the slide (G6)`, async (t) => {
    const page = await load(t, platform, CLOSING);
    const pair = { h1: CLOSE_EL.h1, qr: CLOSE_EL.qr };
    const subPair = { sub: CLOSE_EL.sub, qr: CLOSE_EL.qr };
    const at = await overlap(page, CLOSE_EL.h1, CLOSE_EL.qr);
    const atSub = await overlap(page, CLOSE_EL.sub, CLOSE_EL.qr);
    assert.ok(at && atSub, 'the QR code is not over the heading and the subtitle');

    // Bring to Front of the heading passes the QR code
    await pick(page, CLOSE_ROWS, 'h1');
    assert.deepEqual(await orders(page), { front: true, forward: true, backward: false, back: false });
    await layer(page, platform, 'front', CLOSE_ROWS, 'h1');
    assert.deepEqual(await named(page, CLOSE_ROWS), ['h1', 'qr', 'who', 'sub'], 'Bring to Front of the heading stops under the QR code');
    assert.equal(await topAt(page, at, pair), 'h1');
    assert.deepEqual(await orders(page), { front: false, forward: false, backward: true, back: true });
    await layer(page, platform, 'backward', CLOSE_ROWS, 'h1');
    assert.deepEqual(await named(page, CLOSE_ROWS), ['qr', 'h1', 'who', 'sub']);
    assert.equal(await topAt(page, at, pair), 'qr');
    await layer(page, platform, 'back', CLOSE_ROWS, 'h1');
    assert.deepEqual(await named(page, CLOSE_ROWS), ['qr', 'who', 'sub', 'h1']);
    assert.equal(await render(page), page.source, 'a declaration is left once the slide is in the order of the file');

    // Send to Back of the QR code, then Bring Forward passes one row at a time
    await pick(page, CLOSE_ROWS, 'qr');
    await layer(page, platform, 'back', CLOSE_ROWS, 'qr');
    assert.deepEqual(await named(page, CLOSE_ROWS), ['who', 'sub', 'h1', 'qr']);
    assert.equal(await topAt(page, at, pair), 'h1');
    assert.deepEqual(await orders(page), { front: true, forward: true, backward: false, back: false });
    await layer(page, platform, 'forward', CLOSE_ROWS, 'qr');
    assert.deepEqual(await named(page, CLOSE_ROWS), ['who', 'sub', 'qr', 'h1'], 'Bring Forward of the QR code does not pass one row');
    assert.equal(await topAt(page, at, pair), 'qr');
    assert.equal(await topAt(page, atSub, subPair), 'sub');
    await layer(page, platform, 'forward', CLOSE_ROWS, 'qr');
    assert.deepEqual(await named(page, CLOSE_ROWS), ['who', 'qr', 'sub', 'h1']);
    assert.equal(await topAt(page, atSub, subPair), 'qr');
    await layer(page, platform, 'forward', CLOSE_ROWS, 'qr');
    assert.deepEqual(await named(page, CLOSE_ROWS), ['qr', 'who', 'sub', 'h1']);
    assert.equal(await render(page), page.source, 'a declaration is left once the slide is in the order of the file');

    // a drag of the row of the heading to the top of the list
    const box = (name) => page.evaluate(`(() => { const r = [...document.querySelectorAll(${js(ROW)})].find((x) => x.querySelector('.name').textContent.startsWith(${js(CLOSE_ROWS[name])})).getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2, top: r.top }; })()`);
    const from = await box('h1');
    const top = await box('qr');
    await drag(page, from, { dy: top.top + 2 - from.y, steps: 8 });
    await frames(page);
    assert.deepEqual(await named(page, CLOSE_ROWS), ['h1', 'qr', 'who', 'sub'], 'the row of the heading is not dragged over the QR code');
    assert.equal(await topAt(page, at, pair), 'h1');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Reorder');
    const dragged = await render(page);
    await undo(page);
    await frames(page);
    assert.equal(await render(page), page.source, 'the undo of the drag does not give the file back byte for byte');
    await redo(page);
    await frames(page);
    assert.equal(await render(page), dragged);
    await saveAndReopen(page, `.r16-2-g6-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });
}
