// regression tests of R31.1 on both platforms: a paste on a slide without its sources is put at the
// place of the sources, moved in steps of 20 px to the first place that a copy of the clipboard on
// this slide does not take now. a paste after a paste on a third slide and back, and two pastes
// after the first copy was moved, do not land on an older copy, here or on the slide of the sources.
// each paste is one entry of the history, and an undo, a redo, and a save are byte for byte

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test/pages/editor-r31-1.html';
const SOURCE = readFileSync(DECK, 'utf8');
const [FROM, TARGET, THIRD] = [0, 1, 2];
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

// for each copied kind, the selector of its elements, the selector clicked to select it, and its
// offsets moved by d px diagonally and e px down, two of them for the two shapes of the group
const KINDS = {
  shape: { all: ':scope > .shape:not([data-group])', pick: ':scope > .shape:not([data-group]) p', of: (d, e = 0) => [`${1200 + d}px ${300 + d + e}px`] },
  group: { all: ':scope > .shape[data-group]', pick: ':scope > .shape[data-group]', of: (d, e = 0) => [`${200 + d}px ${650 + d + e}px`, `${400 + d}px ${650 + d + e}px`] },
  line: { all: ':scope > svg.line', pick: ':scope > svg.line > line', of: (d, e = 0) => [`${1200 + d}px ${700 + d + e}px`] },
};

async function load(t, platform, what) {
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
  return {
    page,
    copy: async () => {
      const at = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(${js(kind.pick)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      await click(page, at);
      await frames(page);
      assert.equal((await page.evaluate('window.BeesonEditor.selection()')).length, what === 'group' ? 2 : 1);
      await key('c', 'KeyC', 67, 'copy');
    },
    paste: () => key('v', 'KeyV', 86, 'paste'),
    go: async (n) => {
      await page.evaluate(`Reveal.slide(${n})`);
      await frames(page);
      await sleep(200);
    },
    // the offsets of the copied kind on the current slide, in the order of the file
    places: () => page.evaluate(`[...Reveal.getCurrentSlide().querySelectorAll(${js(kind.all)})].map((e) => e.style.translate)`),
    // the selection moved 50 px down by five nudges of the arrow key
    nudge: async () => {
      for (let i = 0; i < 5; i++) await press(page, 'Shift+ArrowDown');
      await sleep(1100);
      await frames(page);
    },
    of: (...ds) => ds.flatMap((d) => (Array.isArray(d) ? kind.of(...d) : kind.of(d))),
  };
}

// a point in slide px of the first source of each kind that a copy 20 px further does not cover
const corner = (what) => ({ shape: [1205, 305], group: [205, 655], line: [1205, 700] })[what];

const twice = (list) => list.filter((x, i) => list.indexOf(x) !== i);
// the offsets in a fixed order, since on the slide of the sources each copy follows its own source
const sorted = (list) => [...list].sort();

for (const platform of PLATFORMS) {
  for (const what of ['shape', 'group', 'line']) {
    // item 1, the steps of the skeptic: three pastes on Target, one on Third, and one on Target
    // again, which is put at 60 px rather than on the first copy at the place of the source
    test(`1: a ${what} pasted after a paste on a third slide and back is put after the older copies (${platform})`, async (t) => {
      const { page, copy, paste, go, places, of } = await load(t, platform, what);
      await copy();
      await go(TARGET);
      await paste();
      await paste();
      await paste();
      assert.deepEqual(await places(), of(0, 20, 40), 'the three pastes of R28.1 are not at 0, 20, and 40 px');
      await go(THIRD);
      await paste();
      assert.deepEqual(await places(), of(0), 'the first paste on a third slide is not at the place of the source');
      await go(TARGET);
      const before = await render(page);
      await paste();
      const p = await places();
      assert.deepEqual(twice(p), [], `a paste after a paste on Third and back lands on an older copy: ${js(p)}`);
      assert.deepEqual(p, of(0, 20, 40, 60));
      const pasted = await render(page);
      assert.equal(await undoLabel(page), 'Undo Paste');
      await undo(page);
      assert.equal(await render(page), before, 'one undo does not give the file back before the paste');
      await redo(page);
      assert.equal(await render(page), pasted);
      // an undone copy does not take a place
      await undo(page);
      await paste();
      assert.equal(await render(page), pasted, 'a paste after an undo is not put where the undone copy was');
      const { text } = await saveAndReopen(page);
      assert.equal(text, pasted, 'the save differs from the text');
      assert.deepEqual(errors(page), []);
    });

    // item 2: the first copy on Target moved 50 px down, then two pastes, which are put at the place
    // of the source, now free, and 20 px further
    test(`2: a ${what} pasted twice after the first copy was moved is put on two places (${platform})`, async (t) => {
      const { page, copy, paste, go, places, nudge, of } = await load(t, platform, what);
      await copy();
      await go(TARGET);
      await paste();
      await nudge();
      assert.deepEqual(await places(), of([0, 50]));
      await paste();
      const one = await render(page);
      await paste();
      const p = await places();
      assert.deepEqual(twice(p), [], `two pastes after the first copy was moved land on one place: ${js(p)}`);
      assert.deepEqual(p, of([0, 50], 0, 20));
      const two = await render(page);
      assert.equal(await undoLabel(page), 'Undo Paste');
      await undo(page);
      assert.equal(await render(page), one, 'one undo does not give the file back before the paste');
      await redo(page);
      assert.equal(await render(page), two);
      // a deleted copy does not take a place, hence the paste after the delete is put where it was
      await press(page, 'Delete');
      await sleep(300);
      assert.deepEqual(await places(), of([0, 50], 0));
      await paste();
      assert.deepEqual(await places(), of([0, 50], 0, 20), 'a paste after a delete is not put where the deleted copy was');
      const last = await render(page);
      const { text } = await saveAndReopen(page);
      assert.equal(text, last, 'the save differs from the text');
      assert.deepEqual(errors(page), []);
    });

    // item 3, the case of the skeptic: a paste on the slide of the sources, then a delete of the
    // sources, which makes it a slide without them, and two pastes, which are put at 0 and 40 px
    // rather than on the copy at 20 px
    test(`3: a ${what} pasted twice after its sources were deleted is not put on the copy pasted before the delete (${platform})`, async (t) => {
      const { page, copy, paste, places, of } = await load(t, platform, what);
      await copy();
      await paste();
      assert.deepEqual(sorted(await places()), sorted(of(0, 20)));
      const at = await page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'); const r = s.getBoundingClientRect(); const k = r.width / s.offsetWidth; const [x, y] = ${js(corner(what))}; return { x: r.left + x * k, y: r.top + y * k }; })()`);
      await click(page, at);
      await frames(page);
      assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((e) => e.style.translate)'), of(0));
      await press(page, 'Delete');
      await sleep(300);
      assert.deepEqual(await places(), of(20));
      await paste();
      const one = await render(page);
      await paste();
      const p = await places();
      assert.deepEqual(twice(p), [], `two pastes after the sources were deleted land on an older copy: ${js(p)}`);
      assert.deepEqual(sorted(p), sorted(of(20, 0, 40)));
      const two = await render(page);
      assert.equal(await undoLabel(page), 'Undo Paste');
      await undo(page);
      assert.equal(await render(page), one, 'one undo does not give the file back before the paste');
      await redo(page);
      assert.equal(await render(page), two);
      const { text } = await saveAndReopen(page);
      assert.equal(text, two, 'the save differs from the text');
      assert.deepEqual(errors(page), []);
    });

    // item 4: the same two cases on the slide of the sources, where a paste is put 20 px further
    // than the paste before it
    test(`4: a ${what} pasted on its own slide after a paste on another slide, and after a copy was moved, is not put on an older copy (${platform})`, async (t) => {
      const { page, copy, paste, go, places, nudge, of } = await load(t, platform, what);
      await copy();
      await paste();
      assert.deepEqual(sorted(await places()), sorted(of(0, 20)));
      await go(TARGET);
      await paste();
      await go(FROM);
      await paste();
      let p = await places();
      assert.deepEqual(twice(p), [], `a paste on the slide of the source after a paste on Target and back lands on an older copy: ${js(p)}`);
      assert.deepEqual(sorted(p), sorted(of(0, 20, 40)));
      await nudge();
      await paste();
      await paste();
      p = await places();
      assert.deepEqual(twice(p), [], `two pastes on the slide of the source after a copy was moved land on one place: ${js(p)}`);
      assert.deepEqual(sorted(p), sorted(of(0, 20, [40, 50], 60, 80)));
      const last = await render(page);
      const { text } = await saveAndReopen(page);
      assert.equal(text, last, 'the save differs from the text');
      assert.deepEqual(errors(page), []);
    });
  }
}
