// regression tests of R33.1 on both platforms: a paste on the slide of its sources starts at the
// step of today, own.pasted + 1 steps where it covers its source and none where it does not, and is
// moved on in steps of 20 px to the first place that a source or a copy of the clipboard on this
// slide does not take now. two pastes after the source was moved, and a paste after a copy was moved
// onto the next place, do not land on an older copy. a duplicate of an element is moved on in the
// same way past the element and its older duplicates, also where it is a figure in the flow of the
// slide. each paste and each duplicate is one entry of the history, and an undo, a redo, and a save
// are byte for byte

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test/pages/editor-r31-1.html';
// the deck of a QR code in the flow of the slide, moved by a translate
const FLOW = 'test/pages/editor-r33-1.html';
const [FROM, TARGET] = [0, 1];
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
const undo = async (page) => {
  await page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
  await frames(page);
};
const redo = async (page) => {
  await page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
  await frames(page);
};
const undoLabel = (page) => page.evaluate('window.BeesonEditor.state("edit.undo").label');

// for each copied kind, the selector of its elements, the selector clicked to select it, a point in
// slide px of its first source that a copy 20 px further does not cover, and its offsets moved by d
// px diagonally and e px down, two of them for the two shapes of the group
const KINDS = {
  shape: { all: ':scope > .shape:not([data-group])', pick: ':scope > .shape:not([data-group]) p', at: [1205, 305], of: (d, e = 0) => [`${1200 + d}px ${300 + d + e}px`] },
  group: { all: ':scope > .shape[data-group]', pick: ':scope > .shape[data-group]', at: [205, 655], of: (d, e = 0) => [`${200 + d}px ${650 + d + e}px`, `${400 + d}px ${650 + d + e}px`] },
  line: { all: ':scope > svg.line', pick: ':scope > svg.line > line', at: [1205, 700], of: (d, e = 0) => [`${1200 + d}px ${700 + d + e}px`] },
  qr: { deck: FLOW, all: ':scope > .qr', at: [1430, 500], of: (d, e = 0) => [`${1300 + d}px ${160 + d + e}px`] },
};

async function load(t, platform, what) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const deck = KINDS[what].deck ?? DECK;
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(readFileSync(deck, 'utf8'))})`)).problems, []);
  await page.send('Page.bringToFront');
  await page.send('Browser.grantPermissions', { origin: server.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await page.evaluate(`Reveal.slide(${FROM})`);
  await sleep(150);
  const kind = KINDS[what];
  // copy and paste as trusted keys that carry the editing commands of the browser
  const key = async (k, code, kc, cmd) => {
    const e = { key: k, code, windowsVirtualKeyCode: kc, modifiers: MOD[platform] };
    await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...e, commands: [cmd] });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...e });
    await sleep(400);
    await frames(page);
  };
  // a click on the corner of the first source moved by d px diagonally, which selects the element
  // at this place
  const pick = async (d = 0) => {
    const at = await page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'); const r = s.getBoundingClientRect(); const k = r.width / s.offsetWidth; const [x, y] = ${js(kind.at)}; return { x: r.left + (x + ${d}) * k, y: r.top + (y + ${d}) * k }; })()`);
    await click(page, at);
    await frames(page);
    assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((e) => e.style.translate)'), kind.of(d), `the click at ${d} px does not select the element there`);
  };
  // the selection nudged by 10 px for each arrow key of keys
  const nudge = async (keys) => {
    for (const k of keys) await press(page, `Shift+${k}`);
    await sleep(1100);
    await frames(page);
  };
  return {
    page,
    copy: async () => {
      await pick(0);
      await key('c', 'KeyC', 67, 'copy');
    },
    paste: () => key('v', 'KeyV', 86, 'paste'),
    duplicate: async () => {
      await press(page, 'Mod+D');
      await sleep(300);
      await frames(page);
    },
    pick,
    go: async (n) => {
      await page.evaluate(`Reveal.slide(${n})`);
      await frames(page);
      await sleep(200);
    },
    // the offsets of the copied kind on the current slide, sorted, since each copy of a group
    // follows its own source in the file
    places: async () => (await page.evaluate(`[...Reveal.getCurrentSlide().querySelectorAll(${js(kind.all)})].map((e) => e.style.translate)`)).sort(),
    // the drawn places of the copied kind on the current slide in slide px, in the order of the file
    boxes: () => page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'); const r = s.getBoundingClientRect(); const k = r.width / s.offsetWidth; return [...Reveal.getCurrentSlide().querySelectorAll(${js(kind.all)})].map((e) => { const b = e.getBoundingClientRect(); return [b.left - r.left, b.top - r.top].map((v) => Math.round(v / k)); }); })()`),
    down: () => nudge(Array(5).fill('ArrowDown')),
    onto: () => nudge(['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown']),
    of: (...ds) => ds.flatMap((d) => (Array.isArray(d) ? kind.of(...d) : kind.of(d))).sort(),
  };
}

const twice = (list) => list.filter((x, i) => list.indexOf(x) !== i);

// asserts that the last action, labeled label, is one entry of the history from the text before,
// that an undo and a redo and a save and a reopen are byte for byte, and that the page logged no error
async function entry(page, before, label) {
  const done = await render(page);
  assert.equal(await undoLabel(page), `Undo ${label}`);
  await undo(page);
  assert.equal(await render(page), before, `one undo does not give the file back before the ${label}`);
  await redo(page);
  assert.equal(await render(page), done);
  const { text } = await saveAndReopen(page);
  assert.equal(text, done, 'the save differs from the text');
  assert.deepEqual(errors(page), []);
}

for (const platform of PLATFORMS) {
  for (const what of ['shape', 'group', 'line']) {
    // item 1, the case sourceMoved of the first skeptic: the source moved 50 px down after the
    // copy, then two pastes, which do not cover it. the first is at the place of the copy, and the
    // second 20 px further rather than on the first
    test(`1: a ${what} pasted twice on its own slide after the source was moved is put on two places (${platform})`, async (t) => {
      const { page, copy, paste, places, down, of } = await load(t, platform, what);
      await copy();
      await down();
      assert.deepEqual(await places(), of([0, 50]));
      await paste();
      const one = await render(page);
      await paste();
      const p = await places();
      assert.deepEqual(twice(p), [], `two pastes after the source was moved land on one place: ${js(p)}`);
      assert.deepEqual(p, of([0, 50], 0, 20));
      await entry(page, one, 'Paste');
    });

    // item 2, the case ownCopyMovedOnto of the second skeptic: the copy at 20 px moved onto 40 px,
    // then two pastes, which start at 40 and 60 px as today and are moved on past the moved copy
    test(`2: a ${what} pasted on its own slide after the copy was moved onto the next place is not put on it (${platform})`, async (t) => {
      const { page, copy, paste, places, onto, of } = await load(t, platform, what);
      await copy();
      await paste();
      assert.deepEqual(await places(), of(0, 20));
      await onto();
      assert.deepEqual(await places(), of(0, 40));
      await paste();
      let p = await places();
      assert.deepEqual(twice(p), [], `a paste after the copy was moved onto 40 px lands on it: ${js(p)}`);
      assert.deepEqual(p, of(0, 40, 60));
      const one = await render(page);
      await paste();
      p = await places();
      assert.deepEqual(twice(p), [], `a second paste after the copy was moved onto 40 px lands on an older copy: ${js(p)}`);
      assert.deepEqual(p, of(0, 40, 60, 80));
      await entry(page, one, 'Paste');
    });

    // item 2, the case ownAwayAndMoved of the second skeptic: two pastes, the copy at 40 px moved
    // onto 60 px, a paste on Target, and a paste back on the slide of the sources
    test(`2: a ${what} pasted on its own slide after a paste on another slide and a copy moved onto the next place is not put on it (${platform})`, async (t) => {
      const { page, copy, paste, go, places, onto, of } = await load(t, platform, what);
      await copy();
      await paste();
      await paste();
      await onto();
      assert.deepEqual(await places(), of(0, 20, 60));
      await go(TARGET);
      await paste();
      await go(FROM);
      const before = await render(page);
      await paste();
      const p = await places();
      assert.deepEqual(twice(p), [], `a paste after Target and back lands on the copy moved onto 60 px: ${js(p)}`);
      assert.deepEqual(p, of(0, 20, 60, 80));
      await entry(page, before, 'Paste');
    });

    // item 3: the places of today stay, i.e. 20, 40, and 60 px for three pastes, and the gap of
    // 20 px after an undone paste
    test(`3: a ${what} pasted on its own slide keeps the places of today (${platform})`, async (t) => {
      const { page, copy, paste, places, of } = await load(t, platform, what);
      await copy();
      await paste();
      await paste();
      await paste();
      assert.deepEqual(await places(), of(0, 20, 40, 60));
      await undo(page);
      const before = await render(page);
      await paste();
      assert.deepEqual(await places(), of(0, 20, 40, 80), 'the gap of 20 px after an undone paste is not kept');
      await entry(page, before, 'Paste');
    });

    // item 4: the element duplicated, selected again, and duplicated, which puts the second
    // duplicate past the first rather than on it
    test(`4: a ${what} duplicated twice from the same element is put on two places (${platform})`, async (t) => {
      const { page, pick, duplicate, places, of } = await load(t, platform, what);
      await pick(0);
      await duplicate();
      assert.deepEqual(await places(), of(0, 20));
      await pick(0);
      const before = await render(page);
      await duplicate();
      const p = await places();
      assert.deepEqual(twice(p), [], `a second duplicate of the element lands on the first: ${js(p)}`);
      assert.deepEqual(p, of(0, 20, 40));
      await entry(page, before, 'Duplicate');
    });

    // item 4: the older duplicate moved onto 40 px, then the element duplicated twice, which takes
    // 20 px and then moves past the moved duplicate to 60 px
    test(`4: a ${what} duplicated after its older duplicate was moved onto the next place is not put on it (${platform})`, async (t) => {
      const { page, pick, duplicate, places, onto, of } = await load(t, platform, what);
      await pick(0);
      await duplicate();
      await onto();
      assert.deepEqual(await places(), of(0, 40));
      await pick(0);
      await duplicate();
      assert.deepEqual(await places(), of(0, 20, 40));
      await pick(0);
      const before = await render(page);
      await duplicate();
      const p = await places();
      assert.deepEqual(twice(p), [], `a duplicate after the older one was moved onto 40 px lands on an older duplicate: ${js(p)}`);
      assert.deepEqual(p, of(0, 20, 40, 60));
      await entry(page, before, 'Duplicate');
    });

    // item 4: the first duplicate duplicated onto 40 px, then the first duplicate duplicated again,
    // which is put past the duplicate at 40 px
    test(`4: a ${what} duplicated from an older duplicate is not put on the duplicate of it (${platform})`, async (t) => {
      const { page, pick, duplicate, places, of } = await load(t, platform, what);
      await pick(0);
      await duplicate();
      await duplicate();
      assert.deepEqual(await places(), of(0, 20, 40));
      await pick(20);
      const before = await render(page);
      await duplicate();
      const p = await places();
      assert.deepEqual(twice(p), [], `a duplicate of the first duplicate lands on the duplicate of it: ${js(p)}`);
      assert.deepEqual(p, of(0, 20, 40, 60));
      await entry(page, before, 'Duplicate');
    });

    // item 4: two duplicates after the element was moved, which follow the moved element
    test(`4: a ${what} duplicated twice after it was moved is put on two places (${platform})`, async (t) => {
      const { page, pick, duplicate, places, down, of } = await load(t, platform, what);
      await pick(0);
      await down();
      await duplicate();
      const before = await render(page);
      await duplicate();
      const p = await places();
      assert.deepEqual(twice(p), [], `two duplicates after the element was moved land on one place: ${js(p)}`);
      assert.deepEqual(p, of([0, 50], [20, 50], [40, 50]));
      await entry(page, before, 'Duplicate');
    });
  }

  // item 4, the case dupQrTwice of the skeptic of R33.1: a duplicate of a QR code in the flow goes
  // under it, and a second duplicate goes between the two, while the offset of the first is
  // rewritten to keep its place. the second is thus moved on 20 px past the first rather than on it
  test(`4: a QR code in the flow duplicated twice from the same element is put on two places (${platform})`, async (t) => {
    const { page, pick, duplicate, boxes } = await load(t, platform, 'qr');
    const [[x, y]] = await boxes();
    await pick(0);
    await duplicate();
    assert.deepEqual(await boxes(), [[x, y], [x, y + 160]]);
    await pick(0);
    const before = await render(page);
    await duplicate();
    const p = await boxes();
    assert.deepEqual(twice(p.map(js)), [], `a second duplicate of the QR code lands on the first: ${js(p)}`);
    assert.deepEqual(p, [[x, y], [x + 20, y + 180], [x, y + 160]]);
    await entry(page, before, 'Duplicate');
  });

  // item 4, the case dupQrMoved of the same skeptic: the duplicate moved onto 20 px past the place
  // of a duplicate, then the QR code duplicated twice, which takes the free place under it and then
  // moves past both older duplicates
  test(`4: a QR code in the flow duplicated after its older duplicate was moved onto the next place is not put on it (${platform})`, async (t) => {
    const { page, pick, duplicate, boxes, onto } = await load(t, platform, 'qr');
    const [[x, y]] = await boxes();
    await pick(0);
    await duplicate();
    await onto();
    await pick(0);
    await duplicate();
    assert.deepEqual(await boxes(), [[x, y], [x, y + 160], [x + 20, y + 180]]);
    await pick(0);
    const before = await render(page);
    await duplicate();
    const p = await boxes();
    assert.deepEqual(twice(p.map(js)), [], `a duplicate of the QR code after the older one was moved lands on an older duplicate: ${js(p)}`);
    assert.deepEqual(p, [[x, y], [x + 40, y + 200], [x, y + 160], [x + 20, y + 180]]);
    await entry(page, before, 'Duplicate');
  });
}
