// regression tests of R15.6 on both platforms with trusted input: the element changed by an undo or
// a redo is selected as a block, as in Keynote, and a text keeps the caret that was in it (D24).
// the toolbar button Undo keeps the caret in a text of the slide. after each edit the text is
// checked byte for byte after an undo, the edit again after a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, center, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];

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
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const wait = (page, ms = 300) => page.evaluate(`new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), ${ms}))`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
let saves = 0;

const SLIDE = '.reveal .slides section.present';
const IMG = `${SLIDE} figure.figure-box img.for-dark`;
const PARA = `${SLIDE} > p`;

async function load(t, platform, slide) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/test-deck.html?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('test-deck.html', 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${slide})`);
  await wait(page);
  return page;
}

// selected gives the selected elements as their tag, with .figure-box for a figure box, and the tag of the
// block of the slide with the caret, or null
const selected = (page) => page.evaluate(`(() => {
  const el = document.activeElement;
  const caret = el && el.closest('.reveal .slides') && el.isContentEditable ? el.localName : null;
  return { els: window.BeesonEditor.selection().map((e) => e.localName + (e.classList.contains('figure-box') ? '.figure-box' : '')), caret };
})()`);

// caretOffset gives the offset of the caret in the text of the focused element, or null
const caretOffset = (page) => page.evaluate(`(() => {
  const el = document.activeElement;
  const s = getSelection();
  if (!el || !s.rangeCount || !el.contains(s.anchorNode)) return null;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.setEnd(s.anchorNode, s.anchorOffset);
  return r.toString().length;
})()`);

// each change of the figure on slide 5 is followed by Esc, which leaves nothing selected, an undo,
// and a redo, and the figure is selected after each step
const FIGURE_CHANGES = {
  Lock: { act: (page) => press(page, 'Mod+L') },
  Unlock: {
    setup: async (page) => {
      await press(page, 'Mod+L');
      await wait(page);
    },
    act: (page, platform) => press(page, platform === 'mac' ? 'Mod+Alt+L' : 'Mod+Shift+L'),
  },
  move: { act: (page) => press(page, 'ArrowRight') },
  resize: {
    act: async (page) => {
      const at = await page.evaluate(`(() => { const g = [...document.querySelectorAll('.beeson-grip[data-handle="se"]')].find((g) => g.getClientRects().length && !g.hidden); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      await drag(page, at, { dx: -60, dy: -40 });
    },
  },
};

for (const platform of PLATFORMS) {
  for (const [name, change] of Object.entries(FIGURE_CHANGES)) {
    // D24: after an undo or a redo of Lock, nothing was selected, whereas Keynote selects the object
    test(`after an undo and a redo of ${name} on a figure that was deselected, the figure is selected (${platform})`, async (t) => {
      const page = await load(t, platform, 4);
      await click(page, await center(page, IMG));
      await wait(page);
      await change.setup?.(page);
      const start = await render(page);
      await change.act(page, platform);
      await wait(page, 1100);
      const changed = await render(page);
      assert.notEqual(changed, start, `${name} does not change the file`);
      await press(page, 'Escape');
      await wait(page);
      assert.deepEqual((await selected(page)).els, [], 'Esc does not deselect the figure');
      await press(page, 'Mod+Z');
      await wait(page);
      assert.equal(await render(page), start, 'the undo does not give back the file');
      assert.deepEqual(await selected(page), { els: ['figure.figure-box'], caret: null }, 'the figure is not selected after the undo');
      await press(page, 'Escape');
      await wait(page);
      await press(page, 'Mod+Shift+Z');
      await wait(page);
      assert.equal(await render(page), changed, 'the redo does not give back the change');
      assert.deepEqual(await selected(page), { els: ['figure.figure-box'], caret: null }, 'the figure is not selected after the redo');
      const { text } = await saveAndReopen(page, `r15-6-${++saves}.html`);
      assert.equal(text, changed);
      assert.deepEqual(errors(page), []);
    });
  }

  test(`after an undo and a redo of Lock, a figure that stayed selected is still selected (${platform})`, async (t) => {
    const page = await load(t, platform, 4);
    await click(page, await center(page, IMG));
    await press(page, 'Mod+L');
    await wait(page);
    await press(page, 'Mod+Z');
    await wait(page);
    await byteExact(page);
    assert.deepEqual(await selected(page), { els: ['figure.figure-box'], caret: null });
    await press(page, 'Mod+Shift+Z');
    await wait(page);
    assert.deepEqual(await selected(page), { els: ['figure.figure-box'], caret: null });
    assert.deepEqual(errors(page), []);
  });

  // D24: an undo of typing with the caret in the text keeps the caret there, at the end of the
  // change, as in Keynote
  test(`an undo and a redo of typing keep the caret in the text where it was (${platform})`, async (t) => {
    const page = await load(t, platform, 4);
    await click(page, await center(page, PARA));
    await press(page, 'End');
    await type(page, ' XY');
    await wait(page);
    const typed = await render(page);
    // End puts the caret at the end of the first line of the paragraph, which wraps
    const end = (await caretOffset(page)) - 3;
    await press(page, 'Mod+Z');
    await wait(page);
    await byteExact(page);
    assert.deepEqual(await selected(page), { els: [], caret: 'p' }, 'the caret is not kept in the paragraph after the undo');
    assert.equal(await caretOffset(page), end);
    await press(page, 'Mod+Shift+Z');
    await wait(page);
    assert.equal(await render(page), typed);
    assert.deepEqual(await selected(page), { els: [], caret: 'p' }, 'the caret is not kept in the paragraph after the redo');
    assert.equal(await caretOffset(page), end + 3);
    const { text } = await saveAndReopen(page, `r15-6-${++saves}.html`);
    assert.equal(text, typed);
    assert.deepEqual(errors(page), []);
  });

  // D24: after Esc, which selects the paragraph as a block, an undo of typing put the caret back in
  // the text, and selection() was empty
  test(`an undo and a redo of typing in a paragraph left with Esc select the paragraph as a block (${platform})`, async (t) => {
    const page = await load(t, platform, 4);
    await click(page, await center(page, PARA));
    await press(page, 'End');
    await type(page, ' XY');
    await wait(page);
    const typed = await render(page);
    await press(page, 'Escape');
    await wait(page);
    assert.deepEqual(await selected(page), { els: ['p'], caret: null });
    await press(page, 'Mod+Z');
    await wait(page);
    await byteExact(page);
    assert.deepEqual(await selected(page), { els: ['p'], caret: null }, 'the paragraph is not selected as a block after the undo');
    await press(page, 'Mod+Shift+Z');
    await wait(page);
    assert.equal(await render(page), typed);
    assert.deepEqual(await selected(page), { els: ['p'], caret: null }, 'the paragraph is not selected as a block after the redo');
    assert.deepEqual(errors(page), []);
  });

  // a typing undone after a click on the figure selects the paragraph, which the undo changes
  test(`an undo of typing with a figure selected selects the paragraph that it changes (${platform})`, async (t) => {
    const page = await load(t, platform, 4);
    await click(page, await center(page, PARA));
    await press(page, 'End');
    await type(page, ' XY');
    await wait(page);
    await click(page, await center(page, IMG));
    await wait(page);
    assert.deepEqual(await selected(page), { els: ['figure.figure-box'], caret: null });
    await press(page, 'Mod+Z');
    await wait(page);
    await byteExact(page);
    assert.deepEqual(await selected(page), { els: ['p'], caret: null });
    assert.deepEqual(errors(page), []);
  });

  // an undo of a color of the Format pane on a paragraph selected as a block put the caret in its text
  test(`an undo and a redo of a color from the Format pane select the paragraph as a block (${platform})`, async (t) => {
    const page = await load(t, platform, 4);
    await click(page, await center(page, PARA));
    await press(page, 'Escape');
    await wait(page);
    if (!(await state(page, 'shell.format')).checked) await page.evaluate(`window.BeesonEditor.exec('shell.format')`);
    await wait(page);
    const swatch = '.beeson-edit-inspector [data-command="text.tone.accent"]';
    await page.waitFor(`(() => { const b = document.querySelector(${js(swatch)}); return !!b && !b.disabled && b.getClientRects().length > 0; })()`);
    await click(page, await center(page, swatch));
    await wait(page);
    const toned = await render(page);
    assert.notEqual(toned, page.source, 'the swatch does not color the paragraph');
    await press(page, 'Escape');
    await wait(page);
    await press(page, 'Mod+Z');
    await wait(page);
    await byteExact(page);
    assert.deepEqual(await selected(page), { els: ['p'], caret: null }, 'the paragraph is not selected as a block after the undo');
    await press(page, 'Escape');
    await press(page, 'Mod+Shift+Z');
    await wait(page);
    assert.equal(await render(page), toned);
    assert.deepEqual(await selected(page), { els: ['p'], caret: null }, 'the paragraph is not selected as a block after the redo');
    const { text } = await saveAndReopen(page, `r15-6-${++saves}.html`);
    assert.equal(text, toned);
    assert.deepEqual(errors(page), []);
  });
}

// button clicks the toolbar button of the command id
async function button(page, id) {
  await click(page, await page.evaluate(`(() => {
    const r = document.querySelector('[data-command=${js(id)}]').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`));
  await wait(page);
}

for (const platform of PLATFORMS) {
  test(`Undo of the toolbar keeps the caret in a text of the slide (${platform})`, async (t) => {
    const page = await load(t, platform, 4);
    await click(page, await center(page, PARA));
    await press(page, 'End');
    await type(page, ' XY');
    await wait(page);
    await button(page, 'edit.undo');
    await byteExact(page);
    assert.deepEqual(await selected(page), { els: [], caret: 'p' });
    assert.deepEqual(errors(page), []);
  });
}
