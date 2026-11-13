// regression tests of R6.8 on both platforms with trusted input: the menus of a locked figure, the
// line steps of a code box after a line is typed or deleted, the fit of the slide in a narrow window,
// the size of a group in the Arrange pane during a resize, the place of a new text box, the keys of
// the keyboard sheet, the figure selected from its image, the tiles of the New Slide gallery, and the
// position in the readouts and in the Arrange pane.
// after each edit the text is checked byte for byte, after an undo and a redo, and after a save and
// an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen, selectPicture, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
// the slide of the deck of layouts with an ordered list and a figure with a caption
const MATH = 3;
const IMG = '.reveal section.present figure.zone img:not([hidden])';

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
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const wait = (page, ms) => page.evaluate(`new Promise((d) => setTimeout(() => d(true), ${ms}))`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

// the editor on the slide n of a deck served over HTTP, with the Format tab shown
async function load(t, platform, { deck = LAYOUTS, n = 0, size = { width: 1600, height: 1000 } } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  // an earlier test that keeps its page open 1 s after its last edit leaves a draft in the storage
  // of the origin, and the card of this draft then covers the slide of the next page of the deck
  await page.send('Storage.clearDataForOrigin', { origin: server.origin, storageTypes: 'local_storage' });
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks the edits in the text, then the text before byte for byte after an undo, the
// edit after a redo, and an open of the saved edit without problems
let saves = 0;
async function roundTrip(page, edits) {
  await byteExact(page, edits);
  const edited = await render(page);
  await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r6-8-${++saves}.html`);
  assert.equal(text, edited);
  page.source = text;
}

// menuItems returns the label of each item of the open menu, and whether the item is dimmed
const menuItems = (page) =>
  page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => ({ label: i.querySelector('.label')?.textContent ?? '', dimmed: i.getAttribute('aria-disabled') === 'true' }))`);

for (const platform of PLATFORMS) {
  test(`the menus of a locked figure offer Unlock and dim Delete (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    await click(page, IMG);
    await press(page, 'Mod+L');
    await frames(page);
    assert.ok(await page.evaluate(`!!document.querySelector('.reveal section.present [data-locked]')`), 'the lock key does not lock');
    await click(page, IMG, { button: 'right' });
    await frames(page);
    const items = await menuItems(page);
    const lock = items.find((i) => /^(Un)?[Ll]ock$/.test(i.label));
    assert.equal(lock?.label, 'Unlock', `the context menu of the locked figure reads ${js(items)}`);
    assert.equal(lock.dimmed, false);
    assert.equal(items.find((i) => i.label === 'Delete')?.dimmed, true, `Delete is enabled on the locked figure: ${js(items)}`);
    await press(page, 'Escape');
    await frames(page);
    assert.equal((await state(page, 'element.delete')).enabled, false, 'Delete of the Edit menu is enabled on the locked figure');
    assert.equal((await state(page, 'arrange.unlock')).enabled, true, 'Unlock of the Arrange menu is dimmed on the locked figure');
    assert.equal((await state(page, 'arrange.lock')).enabled, false, 'Lock of the Arrange menu is enabled on the locked figure');
    // Unlock of the context menu unlocks the image
    await click(page, IMG, { button: 'right' });
    await frames(page);
    await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label')?.textContent === 'Unlock')?.click()`);
    await frames(page);
    assert.ok(await page.evaluate(`!document.querySelector('.reveal section.present [data-locked]')`), 'Unlock does not unlock the image');
    assert.deepEqual(errors(page), []);
  });

  test(`the context menu of a figure locked as a whole offers Unlock (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    await click(page, IMG);
    await frames(page);
    assert.deepEqual(await page.evaluate(`window.BeesonEditor.selection().map((e) => e.tagName)`), ['FIGURE']);
    await press(page, 'Mod+L');
    await frames(page);
    const FIG = '<figure class="zone fragment" data-fragment-index="2">';
    await roundTrip(page, [[FIG, FIG.replace('>', ' data-locked>')]]);
    await click(page, IMG, { button: 'right' });
    await frames(page);
    const items = await menuItems(page);
    assert.equal(items.find((i) => /^(Un)?[Ll]ock$/.test(i.label))?.label, 'Unlock', js(items));
    assert.equal(items.find((i) => i.label === 'Delete')?.dimmed, true, js(items));
    assert.deepEqual(errors(page), []);
  });
}

const CODE = '<code class="language-python" data-line-numbers="1-3|4|5-7|8-9">def halo_family():';
const SEED = '    x0, vy0 = SEED\n';

// caretAt puts the caret at offset of the text of the code box of the current slide, focused
const caretAt = (page, offset) =>
  page.evaluate(`(() => {
    const code = document.querySelector('.reveal section.present pre > code');
    code.closest('[contenteditable="true"]').focus();
    const walk = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
    let left = ${offset};
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (left <= n.data.length) { getSelection().setBaseAndExtent(n, left, n, left); return true; }
      left -= n.data.length;
    }
    return false;
  })()`);

// a Return of a keyboard carries the text \r, which the browser types as a new line, as the press of
// test/helpers/editor.mjs does not
async function enter(page) {
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
}
// an edit of the code box writes its text again, with the > of line 5 as &gt;
const GT = ['if len(members) >= 2:', 'if len(members) &gt;= 2:'];

for (const platform of PLATFORMS) {
  test(`a line typed or deleted in a code box shifts its line steps in one entry (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: 'test-deck.html' });
    await page.evaluate(`Reveal.slide(Reveal.getIndices(document.querySelector('pre > code').closest('section')).h)`);
    await frames(page);
    const source = page.source;
    const text = await page.evaluate(`document.querySelector('.reveal section.present pre > code').textContent`);
    const end3 = text.indexOf(SEED) + SEED.length - 1;
    // Return at the end of line 3 starts line 4 with the indent of line 3, and the groups after it
    // are moved down by one line
    assert.ok(await caretAt(page, end3));
    await enter(page);
    await frames(page);
    const shifted = CODE.replace('1-3|4|5-7|8-9', '1-3|5|6-8|9-10');
    const typed = [[CODE, shifted], [SEED, `${SEED}    \n`], GT];
    await byteExact(page, typed);
    await type(page, 'pass');
    await frames(page);
    await byteExact(page, [[CODE, shifted], [SEED, `${SEED}    pass\n`], GT]);
    // the line steps go back with the undo of Return, in one entry with it
    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page, typed);
    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
    await page.evaluate('window.BeesonEditor.redo()');
    await byteExact(page, typed);
    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
    // Backspace at the start of line 4 joins it to line 3, and the groups after it are moved up
    assert.ok(await caretAt(page, end3 + 1));
    await press(page, 'Backspace');
    await frames(page);
    const joined = [[CODE, CODE.replace('1-3|4|5-7|8-9', '1-3|3|4-6|7-8')], [SEED + '    for', '    x0, vy0 = SEED    for'], GT];
    await roundTrip(page, joined);
    assert.notEqual(page.source, source);
    assert.deepEqual(errors(page), []);
  });

  test(`Return in a code box indents the new line as the line before (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: 'test-deck.html' });
    await page.evaluate(`Reveal.slide(Reveal.getIndices(document.querySelector('pre > code').closest('section')).h)`);
    await frames(page);
    const text = await page.evaluate(`document.querySelector('.reveal section.present pre > code').textContent`);
    // the line of the for is indented by 4, and the line after it by 8
    const FOR = '    for z0 in np.linspace(Z_START, Z_END, STEPS + 1) / DU:\n';
    assert.ok(await caretAt(page, text.indexOf(FOR) + FOR.length - 1));
    await enter(page);
    await type(page, 'pass');
    await frames(page);
    await byteExact(page, [[CODE, CODE.replace('1-3|4|5-7|8-9', '1-3|4|6-8|9-10')], [FOR, `${FOR}    pass\n`], GT]);
    // Return at the start of a line moves it down without an indent of the new line
    await page.evaluate('window.BeesonEditor.undo()');
    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
    assert.ok(await caretAt(page, text.indexOf(FOR)));
    await enter(page);
    await frames(page);
    await roundTrip(page, [[CODE, CODE.replace('1-3|4|5-7|8-9', '1-3|5|6-8|9-10')], [FOR, `\n${FOR}`], GT]);
    assert.deepEqual(errors(page), []);
  });
}

// fitOf returns the box of the canvas cell, the box of the slide, and the zoom of the status bar
const fitOf = (page) =>
  page.evaluate(`(() => {
    const c = document.querySelector('.beeson-edit-canvas');
    const r = c.getBoundingClientRect();
    const s = document.querySelector('.reveal:not(.beeson-peek)').getBoundingClientRect();
    const zoom = [...document.querySelectorAll('.beeson-edit-bottom *')].find((e) => !e.children.length && /^\\d+%$/.test(e.textContent.trim()))?.textContent.trim();
    return { cell: { x: r.left + c.clientLeft, y: r.top + c.clientTop, w: c.clientWidth, h: c.clientHeight }, slide: { x: s.left, y: s.top, w: s.width, h: s.height }, scale: Reveal.getScale(), zoom };
  })()`);

for (const platform of PLATFORMS) {
  for (const width of [760, 1000]) {
    test(`the slide fits a canvas of a window ${width} px wide at the largest zoom (${platform})`, async (t) => {
      const page = await load(t, platform, { n: MATH, size: { width, height: 700 } });
      await wait(page, 200);
      const f = await fitOf(page);
      // the slide is inside the cell, with a margin of at least 8 px on each side
      assert.ok(f.slide.x >= f.cell.x + 8 - 0.5 && f.slide.x + f.slide.w <= f.cell.x + f.cell.w - 8 + 0.5, js(f));
      assert.ok(f.slide.y >= f.cell.y + 8 - 0.5 && f.slide.y + f.slide.h <= f.cell.y + f.cell.h - 8 + 0.5, js(f));
      // in a canvas under 400 px, the zoom is the largest hundredth that leaves 8 px, and in a larger
      // one, a margin of at most 32 px
      const best = (m) => Math.floor(Math.min((f.cell.w - 2 * m) / 1920, (f.cell.h - 2 * m) / 1080) * 100 + 1e-6) / 100;
      if (f.cell.w < 400) assert.equal(f.scale, best(8), js(f));
      else assert.ok(f.scale >= best(32), js(f));
      assert.equal(f.zoom, `${Math.round(f.scale * 100)}%`);
      assert.deepEqual(errors(page), []);
    });
  }
}

// fieldsOf returns the values of the fields Width and Height of the Arrange pane
const fieldsOf = (page) =>
  page.evaluate(`(() => { const v = (n) => document.querySelector('#beeson-edit-panel-format input[name="' + n + '"]')?.value ?? null; return { w: v('Width'), h: v('Height') }; })()`);
// groupBoxOf returns the size of the box of the members of the group of the selection, in slide px:
// a figure is boxed by its drawn picture and its caption, which hangs under its zone, and another
// element by its box
const groupBoxOf = (page) =>
  page.evaluate(`(() => {
    const els = window.BeesonEditor.selection();
    const drawn = (el) => {
      const r = el.getBoundingClientRect();
      if (!(el instanceof HTMLImageElement) || getComputedStyle(el).objectFit !== 'contain') return r;
      const q = Math.min(r.width / el.naturalWidth, r.height / el.naturalHeight), w = el.naturalWidth * q, h = el.naturalHeight * q;
      return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, right: r.left + (r.width + w) / 2, bottom: r.top + (r.height + h) / 2 };
    };
    const rs = els.map((e) => {
      const r = drawn([...e.querySelectorAll('img')].find((i) => i.getBoundingClientRect().width) ?? e);
      const caps = e.matches('figure') ? [...e.querySelectorAll(':scope > figcaption, :scope > .caption')].map((c) => c.getBoundingClientRect()).filter((c) => c.width) : [];
      return { left: Math.min(r.left, ...caps.map((c) => c.left)), top: Math.min(r.top, ...caps.map((c) => c.top)), right: Math.max(r.right, ...caps.map((c) => c.right)), bottom: Math.max(r.bottom, ...caps.map((c) => c.bottom)) };
    });
    const s = Reveal.getScale();
    return { w: (Math.max(...rs.map((r) => r.right)) - Math.min(...rs.map((r) => r.left))) / s, h: (Math.max(...rs.map((r) => r.bottom)) - Math.min(...rs.map((r) => r.top))) / s };
  })()`);

for (const platform of PLATFORMS) {
  test(`the Arrange pane shows the size of a group, also during its resize (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    // the figure is selected with a click on its image, and the paragraph added with Shift
    await click(page, IMG);
    await click(page, '.reveal section.present > p', { modifiers: 'Shift' });
    await frames(page);
    assert.deepEqual(await page.evaluate(`window.BeesonEditor.selection().map((e) => e.tagName).sort()`), ['FIGURE', 'P']);
    await exec(page, 'arrange.group');
    await frames(page);
    await page.evaluate(`[...document.querySelectorAll('#beeson-edit-panel-format button')].find((b) => b.textContent.trim() === 'Arrange')?.click()`);
    await frames(page);
    const near = (field, value) => Math.abs(Number(field) - value) <= 1.5;
    const box = await groupBoxOf(page);
    let f = await fieldsOf(page);
    assert.ok(near(f.w, box.w) && near(f.h, box.h), `the fields read ${js(f)} for a group of ${js(box)}`);
    // the corner grip of the group is held after a move of 120 by 90 px
    const se = await page.evaluate(`(() => { const g = document.querySelector('.beeson-grip[data-group="1"][data-handle="se"]'); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const { drag } = await import('./helpers/editor.mjs');
    await drag(page, se, { dx: -120, dy: -90, steps: 12, hold: true });
    await frames(page);
    const held = await groupBoxOf(page);
    f = await fieldsOf(page);
    const readout = await page.evaluate(`document.querySelector('.beeson-offset:not([hidden])')?.textContent ?? ''`);
    assert.ok(held.w < box.w - 50, js({ box, held }));
    assert.ok(near(f.w, held.w) && near(f.h, held.h), `during the resize the fields read ${js(f)} for a group of ${js(held)}, and the readout ${readout}`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: se.x - 120, y: se.y - 90, button: 'left', clickCount: 1 });
    await frames(page);
    assert.deepEqual(errors(page), []);
  });
}

// boxesOf returns the box in slide px of the text of the last item of the list of the current
// slide, and the boxes of the new text box and of the element after the list
const boxesOf = (page) =>
  page.evaluate(`(() => {
    const s = Reveal.getScale();
    const top = document.querySelector('.reveal .slides').getBoundingClientRect();
    const box = (r) => ({ top: (r.top - top.top) / s, bottom: (r.bottom - top.top) / s, left: (r.left - top.left) / s, right: (r.right - top.left) / s });
    const ul = document.querySelector('.reveal section.present > ul');
    const r = document.createRange();
    r.selectNodeContents([...ul.children].at(-1));
    const next = ul.nextElementSibling;
    return { ink: box(r.getBoundingClientRect()), next: box(next.getBoundingClientRect()), tag: next.localName };
  })()`);

for (const platform of PLATFORMS) {
  test(`a new text box is put under a list moved down, without an overlap (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: 'test-deck.html', n: 4 });
    assert.match(await page.evaluate(`document.querySelector('.reveal section.present > ul').getAttribute('style') ?? ''`), /translate/);
    await exec(page, 'insert.text');
    await frames(page);
    let b = await boxesOf(page);
    assert.ok(b.next.top >= b.ink.bottom + 8, `the empty box at ${js(b.next)} overlaps the last line of the list at ${js(b.ink)}`);
    const empty = b.next;
    await type(page, 'Typed');
    await wait(page, 300);
    b = await boxesOf(page);
    assert.equal(b.tag, 'p');
    assert.ok(b.next.top >= b.ink.bottom + 8, `the written box at ${js(b.next)} overlaps the last line of the list at ${js(b.ink)}`);
    assert.ok(Math.abs(b.next.top - empty.top) < 1, `the box is moved from ${empty.top} to ${b.next.top} when it is written`);
    // the box is moved with the list, by the 20 px of its translate, and it is written where its
    // empty box was drawn, 10 px under its place in the flow after a list item
    const tag = (await render(page)).match(/<p[^>]*>Typed<\/p>/)?.[0];
    assert.equal(tag, '<p style="translate: 0px 30px">Typed</p>');
    assert.deepEqual(errors(page), []);
  });

  test(`a new text box under a list in its place is written without an offset (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    await exec(page, 'insert.text');
    await frames(page);
    await type(page, 'Typed');
    await wait(page, 300);
    assert.match(await render(page), /\n {2}<p>Typed<\/p>\n/);
    assert.deepEqual(errors(page), []);
  });
}

// item 6: in the trial, Insert listed ⌥⌘E at Formula and at Inline Formula, and View > Zoom listed
// ⌘= at Zoom In and at Bigger Notes Text. one key is listed at one item of a menu, enabled or not
for (const platform of PLATFORMS) {
  test(`no key is listed at two items of one menu or one context menu (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    assert.deepEqual(await page.evaluate('window.BeesonEditorShell.keyClashes(true)'), []);
    assert.deepEqual(await page.evaluate('window.BeesonEditorShell.keyClashes()'), []);
    assert.deepEqual(errors(page), []);
  });
}

// R6.6's test of the tiles of the layout chooser failed once under load, with the Split tile drawn
// unlike on the slide before. each tile is a shadow root, into which the links of the deck were
// cloned, and a tile was thus shown before their sheets were loaded. a tile is drawn in the type of
// the theme on the frame of the command that opens its gallery
for (const platform of PLATFORMS) {
  test(`the tiles of the layout chooser and of New Slide are styled when they are shown (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2 });
    for (const [id, dialog] of [['slide.layoutChooser', '.beeson-edit-layouts'], ['slide.gallery', '.beeson-edit-gallery:not(.beeson-edit-layouts)']]) {
      const fonts = await page.evaluate(`(() => {
        window.BeesonEditor.exec(${JSON.stringify(id)});
        return [...document.querySelectorAll('${dialog} .tile .pic')].map((p) => getComputedStyle(p.shadowRoot.querySelector('section h2, section h1')).fontFamily);
      })()`);
      // New Slide has a tile of Title Only after the eight layouts of the chooser
      assert.equal(fonts.length, id === 'slide.gallery' ? 9 : 8, `the gallery of ${id} is not open`);
      assert.deepEqual(fonts.filter((f) => !/Latin Modern/.test(f)), [], `tiles of ${id} are drawn before the sheets of the theme`);
      await press(page, 'Escape');
      await frames(page);
    }
    assert.deepEqual(errors(page), []);
  });
}

// item 8: the New Slide gallery drew samples of its own, and the layout chooser drew sampleText of
// model/templates.ts. the tile of a layout is the same in both, on a slide with a backdrop too
const tileSlides = (page, id, dialog) => page.evaluate(`(async () => {
  window.BeesonEditor.exec(${JSON.stringify(id)});
  await new Promise((r) => requestAnimationFrame(r));
  return [...document.querySelectorAll('${dialog} .tile')].map((t) => ({ layout: t.dataset.layout ?? null, name: t.textContent.trim(), slide: t.querySelector('.pic').shadowRoot.querySelector('.slides > section').outerHTML }));
})()`);

for (const platform of PLATFORMS) {
  test(`the tile of a layout is the same in New Slide and in the layout chooser (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 0 });
    const chooser = await tileSlides(page, 'slide.layoutChooser', '.beeson-edit-layouts');
    await press(page, 'Escape');
    await frames(page);
    const gallery = await tileSlides(page, 'slide.gallery', '.beeson-edit-gallery:not(.beeson-edit-layouts)');
    await press(page, 'Escape');
    assert.equal(chooser.length, 8);
    // New Slide has a tile of Title Only after the eight layouts of the chooser
    assert.deepEqual(gallery.map((g) => g.name), [...chooser.map((c) => c.name), 'Title Only']);
    for (const [i, c] of chooser.entries()) assert.equal(gallery[i].slide, c.slide, `the tile of ${c.layout} differs`);
    assert.deepEqual(errors(page), []);
  });
}

// item 7: in the trial (state 177), Esc and Edit > Select Figure selected figure.zone, but its frame
// stayed on the image, above the caption of the figure. the frame of the figure holds its caption
const FIGURE_IMG = '.reveal section.present .zone > img:not([hidden])';
const frameAndCaption = (page) => page.evaluate(`(() => {
  const box = (e) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
  const frames = [...document.querySelectorAll('.beeson-frame.selected')].filter((f) => !f.hidden && f.getClientRects().length);
  return { selected: window.BeesonEditor.selection().map((e) => e.tagName), frames: frames.map(box), caption: box(document.querySelector('.reveal section.present figure.zone figcaption')), image: box(document.querySelector('${FIGURE_IMG}')) };
})()`);

for (const platform of PLATFORMS) {
  test(`the frame of a figure selected from its image holds its caption (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: 'test-deck.html', n: 4 });
    // a second click on the image frames its picture alone
    await selectPicture(page, FIGURE_IMG);
    await frames(page);
    const [pic] = (await frameAndCaption(page)).frames;
    await press(page, 'Escape');
    await frames(page);
    await press(page, 'Escape');
    await frames(page);
    for (const how of ['Esc', 'Select Figure']) {
      await selectPicture(page, FIGURE_IMG);
      await frames(page);
      if (how === 'Esc') await press(page, 'Escape');
      else await exec(page, 'selection.container');
      await frames(page);
      const s = await frameAndCaption(page);
      assert.deepEqual(s.selected, ['FIGURE'], `${how} does not select the figure`);
      assert.equal(s.frames.length, 1);
      const [f] = s.frames;
      assert.ok(pic.bottom < s.caption.top, `the frame of the image at ${js(pic)} reaches the caption`);
      // the frame of a figure with a caption stands 8 px outside it
      assert.ok(Math.abs(f.top + 8 - pic.top) <= 1 && f.bottom >= s.caption.bottom - 1 && f.left <= Math.min(pic.left, s.caption.left) + 1 && f.right >= Math.max(pic.right, s.caption.right) - 1, `after ${how} the frame at ${js(f)} leaves out the caption at ${js(s.caption)}`);
      await press(page, 'Escape');
      await frames(page);
    }
    assert.deepEqual(errors(page), []);
  });
}

// item 10: the readout of a move gives the upper left corner of the element in slide px, and the
// fields X and Y of the Arrange pane, the readout of a nudge, and the readout of a line drag gave the
// translate. all four give the position on the slide, and a value typed into X or Y moves the
// element to that position
const positionOf = (page) => page.evaluate(`(() => { const v = (n) => document.querySelector('#beeson-edit-panel-format input[name="' + n + '"]')?.value ?? null; return { x: v('X'), y: v('Y') }; })()`);
const readoutOf = (page) => page.evaluate(`(() => { const o = document.querySelector('.beeson-offset:not(.beeson-guide-readout)'); return o && !o.hidden ? o.textContent : null; })()`);
// cornerOf returns the upper left corner of the box of the selected element in slide px
const cornerOf = (page) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides');
  const r = s.getBoundingClientRect(), k = r.width / s.offsetWidth;
  // the frame of the selected element, drawn 8 px outside the picture with its caption of a figure
  const f = document.querySelector('.beeson-overlay > .beeson-frame.selected:not([hidden])').getBoundingClientRect();
  return { x: Math.round((f.left + 8 - r.left) / k), y: Math.round((f.top + 8 - r.top) / k) };
})()`);
const xy = (text) => {
  const m = /^x: (-?\d+) px\s+y: (-?\d+) px$/.exec(text ?? '');
  assert.ok(m, `the readout ${text} does not give x and y`);
  return { x: m[1], y: m[2] };
};
const arrangeTab = (page) => page.evaluate(`[...document.querySelectorAll('#beeson-edit-panel-format button')].find((b) => b.textContent.trim() === 'Arrange')?.click()`);

for (const platform of PLATFORMS) {
  test(`a figure moved by a drag or a nudge shows the same x and y in its readout and in the fields, and a typed X moves it there (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    await click(page, IMG);
    await frames(page);
    assert.deepEqual(await page.evaluate(`window.BeesonEditor.selection().map((e) => e.tagName)`), ['FIGURE']);
    await arrangeTab(page);
    await frames(page);
    const start = await cornerOf(page);
    assert.deepEqual(await positionOf(page), { x: String(start.x), y: String(start.y) }, 'the fields do not give the position of the figure in place');
    const img = await page.evaluate(`(() => { const r = [...document.querySelectorAll(${js(IMG)})].map((e) => e.getBoundingClientRect()).find((b) => b.width); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const { drag } = await import('./helpers/editor.mjs');
    await drag(page, img, { dx: -70, dy: 45, hold: true });
    await frames(page);
    const held = xy(await readoutOf(page));
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: img.x - 70, y: img.y + 45, button: 'left', clickCount: 1 });
    await frames(page);
    assert.deepEqual(await positionOf(page), held, 'the fields do not give the x and y of the readout of the move');
    // a nudge to the right
    await press(page, 'ArrowRight');
    await frames(page);
    const nudged = { x: String(Number(held.x) + 1), y: held.y };
    assert.deepEqual(xy(await readoutOf(page)), nudged, 'the readout of a nudge does not give the position');
    assert.deepEqual(await positionOf(page), nudged);
    // a value typed into X
    const moved = await render(page);
    await click(page, '#beeson-edit-panel-format input[name="X"]');
    await page.evaluate(`document.querySelector('#beeson-edit-panel-format input[name="X"]').select()`);
    await type(page, '400');
    await press(page, 'Enter');
    await frames(page);
    assert.equal((await cornerOf(page)).x, 400, 'a typed X does not move the figure to x 400');
    assert.deepEqual(await positionOf(page), { x: '400', y: held.y });
    const typed = await render(page);
    await page.evaluate('window.BeesonEditor.undo()');
    assert.equal(await render(page), moved);
    await page.evaluate('window.BeesonEditor.redo()');
    assert.equal(await render(page), typed);
    const { text } = await saveAndReopen(page, `r6-8-${++saves}.html`);
    assert.equal(text, typed);
    await frames(page);
    assert.deepEqual(errors(page), []);
  });

  test(`a line moved by a drag shows the same x and y in its readout and in the fields (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    await exec(page, 'insert.line', { from: { x: 300, y: 900 }, to: { x: 800, y: 900 } });
    await exec(page, 'selection.clear');
    await frames(page);
    const m = await page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'); const r = s.getBoundingClientRect(), k = r.width / s.offsetWidth; return { x: r.left + 550 * k, y: r.top + 903 * k }; })()`);
    await click(page, m);
    await frames(page);
    await arrangeTab(page);
    await frames(page);
    const { drag } = await import('./helpers/editor.mjs');
    await drag(page, m, { dx: 60, dy: -40, hold: true });
    await frames(page);
    const held = xy(await readoutOf(page));
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: m.x + 60, y: m.y - 40, button: 'left', clickCount: 1 });
    await frames(page);
    assert.deepEqual(await page.evaluate(`window.BeesonEditor.selection().map((e) => e.localName)`), ['svg']);
    assert.deepEqual(await positionOf(page), held, 'the fields do not give the x and y of the readout of the line drag');
    assert.deepEqual(errors(page), []);
  });
}
