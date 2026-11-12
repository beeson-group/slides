// regression tests of R15.6 on both platforms with trusted input: the element changed by an undo or
// a redo is selected as a block, as in Keynote, and a text keeps the caret that was in it (D24).
// the toolbar buttons Undo and Redo keep the caret in a line of the outline, and the line of a
// locked block is read only. after each edit the text is checked byte for byte after an undo, the
// edit again after a redo, and after a save and an open

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
const IMG = `${SLIDE} figure.zone img.for-dark`;
const PARA = `${SLIDE} > p`;

async function load(t, platform, slide) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/index.html?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('index.html', 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${slide})`);
  await wait(page);
  return page;
}

// selected gives the selected elements as their tag, with .zone for a zone, and the tag of the
// block of the slide with the caret, or null
const selected = (page) => page.evaluate(`(() => {
  const el = document.activeElement;
  const caret = el && el.closest('.reveal .slides') && el.isContentEditable ? el.localName : null;
  return { els: window.BeesonEditor.selection().map((e) => e.localName + (e.classList.contains('zone') ? '.zone' : '')), caret };
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
      assert.deepEqual(await selected(page), { els: ['figure.zone'], caret: null }, 'the figure is not selected after the undo');
      await press(page, 'Escape');
      await wait(page);
      await press(page, 'Mod+Shift+Z');
      await wait(page);
      assert.equal(await render(page), changed, 'the redo does not give back the change');
      assert.deepEqual(await selected(page), { els: ['figure.zone'], caret: null }, 'the figure is not selected after the redo');
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
    assert.deepEqual(await selected(page), { els: ['figure.zone'], caret: null });
    await press(page, 'Mod+Shift+Z');
    await wait(page);
    assert.deepEqual(await selected(page), { els: ['figure.zone'], caret: null });
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
    assert.deepEqual(await selected(page), { els: ['figure.zone'], caret: null });
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

// outlineAt shows the outline and puts the caret at the end of the line that starts with start
async function outlineAt(page, start) {
  if (!(await state(page, 'view.outline')).checked) await page.evaluate(`window.BeesonEditor.exec('view.outline')`);
  await wait(page);
  const at = await page.evaluate(`(() => {
    const t = [...document.querySelectorAll('.beeson-edit-outline .text')].find((e) => e.textContent.startsWith(${js(start)}));
    t.scrollIntoView({ block: 'center' });
    const r = t.getBoundingClientRect();
    return { x: r.right - 2, y: r.bottom - 6 };
  })()`);
  await click(page, at);
  await press(page, 'End');
  await wait(page);
  assert.ok(await page.evaluate(`document.activeElement.matches('.beeson-edit-outline .text') && document.activeElement.textContent.startsWith(${js(start)})`), 'the caret is not in the line of the outline');
}

const lineText = (page) => page.evaluate(`document.activeElement.matches('.beeson-edit-outline .text') ? document.activeElement.textContent : null`);

// button clicks the toolbar button of the command id
async function button(page, id) {
  await click(page, await page.evaluate(`(() => {
    const r = document.querySelector('[data-command=${js(id)}]').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`));
  await wait(page);
}

// keys sends one trusted key press with its text for each character, as a keyboard does
async function keys(page, text) {
  for (const ch of text) {
    const code = ch === ' ' ? 'Space' : `Key${ch.toUpperCase()}`;
    const base = { key: ch, code, windowsVirtualKeyCode: ch.toUpperCase().charCodeAt(0), modifiers: ch !== ch.toLowerCase() ? 8 : 0 };
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: ch, unmodifiedText: ch });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }
}

const SAME = 'Two elements with the same index are shown together.';
const DESIGN = "Design the complete slide first, then break it up into steps. Direct the viewer's attention.";

for (const platform of PLATFORMS) {
  // Undo of the toolbar moved the caret out of a line of the outline into the block on the slide,
  // whereas Undo of the Edit menu and of the key kept it there
  test(`Undo and Redo of the toolbar keep the caret in a line of the outline (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await outlineAt(page, 'Two elements');
    await keys(page, ' XY');
    await wait(page);
    await button(page, 'edit.undo');
    await byteExact(page);
    assert.equal(await lineText(page), SAME, 'the caret is not in the line after the undo');
    await button(page, 'edit.redo');
    const text = await render(page);
    assert.ok(text.includes(`${SAME} XY</li>`), 'the redo does not give back the typing');
    assert.equal(await lineText(page), `${SAME} XY`, 'the caret is not in the line after the redo');
    const { text: saved } = await saveAndReopen(page, `r15-6-${++saves}.html`);
    assert.equal(saved, text);
    assert.deepEqual(errors(page), []);
  });

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

  // the lock was not checked in the outline, hence a locked block was changed through its line
  test(`the line of a locked paragraph in the outline is read only, and its text is selected and copied (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await click(page, await center(page, PARA));
    await press(page, 'Escape');
    await press(page, 'Mod+L');
    await wait(page);
    const locked = await render(page);
    assert.ok(locked.includes('<p data-locked>Design the complete'), 'the paragraph is not locked');
    await outlineAt(page, 'Design the complete');
    await keys(page, ' XY');
    await type(page, 'Z');
    await press(page, 'Backspace');
    await press(page, 'Enter');
    await press(page, 'Tab');
    await wait(page);
    assert.equal(await lineText(page), DESIGN, 'a key changes the line');
    assert.equal(await page.evaluate(`document.activeElement.getAttribute('aria-readonly')`), 'true');
    await page.evaluate('getSelection().selectAllChildren(document.activeElement)');
    await wait(page);
    assert.equal(await page.evaluate('getSelection().toString()'), DESIGN);
    assert.notEqual((await state(page, 'edit.copy')).enabled, false, 'Copy is dimmed');
    const copy = await page.evaluate(`(() => {
      const ev = new ClipboardEvent('copy', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true });
      document.activeElement.dispatchEvent(ev);
      return ev.defaultPrevented;
    })()`);
    assert.equal(copy, false, 'the copy is taken from the line');
    for (const id of ['edit.cut', 'edit.paste', 'element.delete']) assert.equal((await state(page, id)).enabled, false, `${id} is not dimmed in the line`);
    await press(page, 'Mod+X');
    await wait(page);
    const got = await page.evaluate(`(() => {
      const el = document.activeElement;
      const data = new DataTransfer();
      data.setData('text/plain', ' pasted');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
      return el.textContent;
    })()`);
    assert.equal(got, DESIGN, 'a cut or a paste changes the line');
    await click(page, await center(page, `${SLIDE} > h2`));
    await wait(page);
    assert.equal(await render(page), locked, 'the file is changed through the line');
    assert.deepEqual(errors(page), []);
  });

  test(`the line of an item inside a locked list in the outline is read only (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await click(page, await center(page, `${SLIDE} > ul > li:nth-child(2)`));
    await press(page, 'Escape');
    await wait(page);
    assert.deepEqual((await selected(page)).els, ['ul']);
    await press(page, 'Mod+L');
    await wait(page);
    const locked = await render(page);
    assert.ok(locked.includes('<ul data-locked>'), 'the list is not locked');
    await outlineAt(page, 'Two elements');
    await keys(page, ' XY');
    await press(page, 'Backspace');
    await press(page, 'Enter');
    await press(page, 'Tab');
    await wait(page);
    assert.equal(await lineText(page), SAME, 'a key changes the line');
    await page.evaluate('getSelection().selectAllChildren(document.activeElement)');
    for (const id of ['edit.cut', 'edit.paste', 'element.delete']) assert.equal((await state(page, id)).enabled, false, `${id} is not dimmed in the line`);
    await press(page, 'Escape');
    await wait(page);
    assert.equal(await render(page), locked, 'the file is changed through the line');
    // a line of an unlocked block on the same slide is still edited
    await outlineAt(page, 'Design the complete');
    await keys(page, ' XY');
    await press(page, 'Escape');
    await wait(page);
    assert.ok((await render(page)).includes("viewer's attention. XY</p>"), 'the line of an unlocked block is not edited');
    assert.deepEqual(errors(page), []);
  });
}

// startOf puts the caret at the start of the line of the outline that starts with start
async function startOf(page, start) {
  await outlineAt(page, start);
  await page.evaluate('getSelection().collapse(document.activeElement, 0)');
}

const EXPORTING = 'When exporting to PDF or PPTX, you will get one slide per step.';

for (const platform of PLATFORMS) {
  // Backspace at the start of a line of the outline did not join it to the line before
  test(`Backspace at the start of an item in the outline joins it to the item before, in one entry (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await startOf(page, 'When exporting');
    await press(page, 'Backspace');
    await wait(page);
    const joined = [`<li class="fragment" data-fragment-index="2">${SAME}</li>\n    <li class="fragment" data-fragment-index="3">${EXPORTING}</li>`, `<li class="fragment" data-fragment-index="2">${SAME}${EXPORTING}</li>`];
    await byteExact(page, [joined]);
    const text = await render(page);
    assert.equal(await lineText(page), `${SAME}${EXPORTING}`, 'the caret is not in the joined line');
    assert.equal(await page.evaluate(`(() => { const s = getSelection(); const r = document.createRange(); r.selectNodeContents(document.activeElement); r.setEnd(s.anchorNode, s.anchorOffset); return r.toString().length; })()`), SAME.length, 'the caret is not at the place of the join');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Join Paragraphs');
    await press(page, 'Mod+Z');
    await wait(page);
    await byteExact(page);
    await press(page, 'Mod+Shift+Z');
    await wait(page);
    assert.equal(await render(page), text);
    const { text: saved } = await saveAndReopen(page, `r15-6-${++saves}.html`);
    assert.equal(saved, text);
    assert.deepEqual(errors(page), []);
  });

  for (const [where, start] of [['the title of a slide', 'Show your steps'], ['a paragraph after the title', 'Design the complete'], ['the first item of a list after a paragraph', 'Each step is']]) {
    test(`Backspace at the start of ${where} in the outline does nothing (${platform})`, async (t) => {
      const page = await load(t, platform, 2);
      await startOf(page, start);
      const line = await lineText(page);
      await press(page, 'Backspace');
      await wait(page);
      await byteExact(page);
      assert.equal(await lineText(page), line, 'the line is changed');
      assert.equal((await state(page, 'edit.undo')).enabled, false, 'an entry is added to the history');
      assert.deepEqual(errors(page), []);
    });
  }

  test(`Backspace at the start of an item of a locked list in the outline does nothing (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await click(page, await center(page, `${SLIDE} > ul > li:nth-child(2)`));
    await press(page, 'Escape');
    await press(page, 'Mod+L');
    await wait(page);
    const locked = await render(page);
    await startOf(page, 'When exporting');
    await press(page, 'Backspace');
    await wait(page);
    assert.equal(await render(page), locked);
    assert.equal(await lineText(page), EXPORTING);
    assert.deepEqual(errors(page), []);
  });
}
