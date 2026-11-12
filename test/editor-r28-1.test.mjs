// regression tests of R28.1 on both platforms: a new text box is given a layer only when a shape
// drawn over it meets its box, a new shape and a new line are put in front of their slide in the
// entry of their insert, and copies pasted again on a slide without their sources are 20 px apart.
// after each edit an undo gives the file back byte for byte

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test/pages/editor-r28-1.html';
const SOURCE = readFileSync(DECK, 'utf8');
const [FAR, NEAR, FROM, TARGET, THIRD] = [0, 1, 2, 3, 4];
const MOD = { mac: 4, other: 2 };

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
const sleep = (ms) => new Promise((d) => setTimeout(d, ms));
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}, ${js(arg ?? null)} ?? undefined)).then(() => true)`);
// the section of the file whose heading is title
const section = (text, title) => [...text.matchAll(/<section>[\s\S]*?<\/section>/g)].map((m) => m[0]).find((s) => s.includes(`<h2>${title}</h2>`));

async function load(t, platform, slide) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${DECK}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(SOURCE)})`)).problems, []);
  await page.send('Page.bringToFront');
  await page.send('Browser.grantPermissions', { origin: server.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await page.evaluate(`Reveal.slide(${slide})`);
  await sleep(150);
  return page;
}

// a new text box with a word, typed and left with Esc twice, and the box of its word in slide px
async function textBox(page) {
  await click(page, '.beeson-edit-top [data-command="insert.text"]');
  await sleep(300);
  await type(page, 'words');
  await sleep(300);
  await press(page, 'Escape');
  await press(page, 'Escape');
  await sleep(300);
  return page.evaluate(`(() => {
    const sl = document.querySelector('.reveal .slides'), S = sl.getBoundingClientRect(), k = S.width / sl.offsetWidth;
    const e = [...Reveal.getCurrentSlide().querySelectorAll(':scope > p')].find((p) => p.textContent === 'words');
    const r = document.createRange();
    r.selectNodeContents(e);
    const q = r.getBoundingClientRect();
    return { left: Math.round((q.left - S.left) / k), top: Math.round((q.top - S.top) / k), width: Math.round(q.width / k), height: Math.round(q.height / k) };
  })()`);
}

// the element drawn on top at the middle of the word of the text box, or at the middle of the
// stroke of the last line of the slide: the word, the last shape, the last line, or another one
const topAt = (page, what) => page.evaluate(`(() => {
  const sl = Reveal.getCurrentSlide();
  const word = [...sl.querySelectorAll(':scope > p')].find((p) => p.textContent === 'words');
  const shape = [...sl.querySelectorAll(':scope > .shape')].at(-1), line = [...sl.querySelectorAll(':scope > svg.line')].at(-1);
  let q;
  if (${js(what)} === 'line') q = line.querySelector(':scope > line, :scope > path').getBoundingClientRect();
  else { const r = document.createRange(); r.selectNodeContents(word); q = r.getBoundingClientRect(); }
  const st = document.createElement('style');
  st.textContent = '.reveal .slides section .shape, .reveal .slides section .shape *, .reveal .slides section svg.line * { pointer-events: auto !important }';
  document.head.append(st);
  const all = document.elementsFromPoint(q.left + q.width / 2, q.top + q.height / 2).filter((x) => sl.contains(x));
  st.remove();
  const at = all.find((x) => word.contains(x) || x.closest('.shape, svg.line'));
  return !at ? 'nothing' : word.contains(at) ? 'word' : at.closest('.shape') === shape ? 'new shape' : at.closest('svg.line') === line ? 'new line' : 'other';
})()`);

for (const platform of PLATFORMS) {
  // the steps of the reviewer: a shape far from the column, a new text box, and a rectangle drawn
  // 20 px around its word. the text box is newer than the shape, hence layered over it wherever it
  // is dragged later, and the rectangle is newer still, hence drawn over the word
  test(`1: a text box far from a shape is layered over it, and a rectangle drawn over it is in front (${platform})`, async (t) => {
    const page = await load(t, platform, FAR);
    const b = await textBox(page);
    const typed = await render(page);
    assert.match(section(typed, 'Far'), /\n {2}<p style="[^"]*z-index: \d+[^"]*">words<\/p>\n/, 'the text box is not layered over the older shape');
    await exec(page, 'insert.shape.rectangle', { box: { left: b.left - 20, top: b.top - 20, width: b.width + 40, height: b.height + 40 } });
    await sleep(300);
    const drawn = await render(page);
    assert.equal(await topAt(page, 'word'), 'new shape', 'the new rectangle is drawn under the word');
    await undo(page);
    assert.equal(await render(page), typed, 'the undo does not give the file back');
    await redo(page);
    assert.equal(await render(page), drawn);
    await saveAndReopen(page);
    assert.deepEqual(errors(page), []);
  });

  // a text box under a shape is put over it, and a shape and a line drawn over the text box later
  // are put in front of it, each in the entry of its insert
  test(`1: a text box under a shape is layered, and a new shape and a new line are put in front (${platform})`, async (t) => {
    const page = await load(t, platform, NEAR);
    const b = await textBox(page);
    const typed = await render(page);
    assert.match(section(typed, 'Near'), /<p style="position: relative; z-index: 1[^"]*">words<\/p>/, 'the text box under the shape is not put over it');
    assert.equal(await topAt(page, 'word'), 'word');
    await exec(page, 'insert.shape.rectangle', { box: { left: b.left - 20, top: b.top - 20, width: b.width + 40, height: b.height + 40 } });
    await sleep(300);
    const shaped = await render(page);
    assert.equal(await topAt(page, 'word'), 'new shape', 'the new rectangle is drawn under the word');
    assert.equal((await page.evaluate('window.BeesonEditor.state("edit.undo")')).label, 'Undo Insert Shape');
    await undo(page);
    assert.equal(await render(page), typed, 'the undo does not take the layer of the new shape off');
    await redo(page);
    assert.equal(await render(page), shaped);
    assert.equal(await topAt(page, 'word'), 'new shape');
    const y = b.top + b.height / 2;
    await exec(page, 'insert.arrow', { from: { x: b.left - 40, y }, to: { x: b.left + b.width + 40, y } });
    await sleep(300);
    const lined = await render(page);
    assert.equal(await topAt(page, 'line'), 'new line', 'the new arrow is drawn under the words or the shape');
    await undo(page);
    assert.equal(await render(page), shaped, 'the undo does not take the layer of the new line off');
    await redo(page);
    assert.equal(await render(page), lined);
    await saveAndReopen(page);
    assert.equal(await topAt(page, 'line'), 'new line');
    assert.deepEqual(errors(page), []);
  });

  // the copies of a shape, of a line, and of both, pasted three times on a slide without their
  // sources by the key and by the Edit menu: the first at the place of its source, and each later
  // one 20 px further. the count starts again on a third slide and at a new copy
  for (const what of ['shape', 'line', 'both']) {
    test(`2: a ${what} pasted again on another slide is put 20 px from the copy before it, by the key and the menu (${platform})`, async (t) => {
      for (const route of ['key', 'menu']) {
        const page = await load(t, platform, FROM);
        const at = (sel) => page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(${js(sel)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        const pick = async () => {
          if (what !== 'line') await click(page, await at('.shape p'));
          if (what !== 'shape') await click(page, await at('svg.line line'), what === 'both' ? { modifiers: 'Shift' } : {});
          await frames(page);
          assert.equal((await page.evaluate('window.BeesonEditor.selection()')).length, what === 'both' ? 2 : 1);
        };
        const key = async (k, code, kc, cmd) => {
          const e = { key: k, code, windowsVirtualKeyCode: kc, modifiers: MOD[platform] };
          await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...e, commands: [cmd] });
          await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...e });
          await sleep(400);
        };
        const menu = async (item) => {
          await click(page, await page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((e) => e.textContent.trim() === 'Edit').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
          await sleep(250);
          await click(page, await page.evaluate(`(() => { const e = [...document.querySelectorAll('[role=menu] [role^=menuitem]')].find((x) => x.getClientRects().length && x.textContent.trim().startsWith(${js(item)})); const r = e.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`));
          await sleep(400);
        };
        const copy = () => (route === 'key' ? key('c', 'KeyC', 67, 'copy') : menu('Copy'));
        const paste = async () => {
          await (route === 'key' ? key('v', 'KeyV', 86, 'paste') : menu('Paste'));
          await frames(page);
        };
        const go = async (n) => {
          await page.evaluate(`Reveal.slide(${n})`);
          await frames(page);
          await sleep(200);
        };
        // the offsets of the shapes and the lines of the current slide
        const places = () => page.evaluate(`[...Reveal.getCurrentSlide().querySelectorAll(':scope > .shape, :scope > svg.line')].map((e) => (e.localName === 'svg' ? 'L ' : 'S ') + e.style.translate)`);
        const S = (d) => `S ${1200 + d}px ${300 + d}px`, L = (d) => `L ${1200 + d}px ${700 + d}px`;
        const of = (d) => (what === 'shape' ? [S(d)] : what === 'line' ? [L(d)] : [S(d), L(d)]);
        const why = `${what} by the ${route}`;
        await pick();
        await copy();
        await go(TARGET);
        await paste();
        assert.deepEqual(await places(), of(0), `the first paste on another slide is not at the place of its source, ${why}`);
        const one = await render(page);
        await paste();
        const two = await render(page);
        await paste();
        assert.deepEqual(await places(), [...of(0), ...of(20), ...of(40)], `a later paste covers the copy before it, ${why}`);
        const three = await render(page);
        await undo(page);
        assert.equal(await render(page), two, `the undo of the third paste does not give the file back, ${why}`);
        await undo(page);
        assert.equal(await render(page), one);
        await redo(page);
        await redo(page);
        assert.equal(await render(page), three);
        // a third slide starts the count again
        await go(THIRD);
        await paste();
        await paste();
        assert.deepEqual(await places(), [...of(0), ...of(20)], `the count does not start again on a third slide, ${why}`);
        // and once the first paste on a slide is undone
        await undo(page);
        await undo(page);
        await paste();
        assert.deepEqual(await places(), of(0), `the count does not start again after an undo of the first paste, ${why}`);
        // and so does a new copy
        await go(FROM);
        await pick();
        await copy();
        await go(TARGET);
        await paste();
        assert.deepEqual(await places(), [...of(0), ...of(20), ...of(40), ...of(0)], `the count does not start again at a new copy, ${why}`);
        await paste();
        assert.deepEqual((await places()).slice(-of(0).length), of(20), why);
        const { text } = await saveAndReopen(page);
        const saved = [...section(text, 'Target').matchAll(/translate: [^;"]+/g)].map((m) => m[0]);
        assert.deepEqual(saved, [0, 20, 40, 0, 20].flatMap(of).map((p) => `translate: ${p.slice(2)}`), `the saved offsets differ, ${why}`);
        assert.deepEqual(errors(page), []);
        await page.close();
      }
    });
  }
}
