// the work of R20.7 on both platforms: nested groups, a selection inside a group, Select All with
// the lines of a slide, Regroup, the Object List as a tree of groups, the turns by 90 degrees, and
// the arrange items of the context menu with the bracket keys of Windows. each edit of the file is
// checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const DECK = 'test/pages/editor-r20-7.html';
const SOURCE = readFileSync(DECK, 'utf8');
const PLATFORMS = ['mac', 'other'];
const OBJECTS = '.beeson-edit-objects';
const ROW = `${OBJECTS} .row`;
const LIST_KEY = { mac: 'Mod+Shift+L', other: 'Alt+F10' };
const GROUP_KEY = { mac: 'Mod+Alt+G', other: 'Mod+G' };
const UNGROUP_KEY = { mac: 'Mod+Alt+Shift+G', other: 'Mod+Shift+G' };
const REGROUP_KEY = { mac: 'Mod+Alt+J', other: 'Mod+Shift+J' };

const A = 'section.present img[alt="A first figure"]';
const B = 'section.present img[alt="A second figure"]';
const C = 'section.present img[alt="A third figure"]';
const FIG_A = '<figure class="zone" data-group="g1">';
const FIG_B = '<figure class="zone" data-group="g1" style="translate: -300px 100px">';
const PARA = '<p>A paragraph beside the figures</p>';
// the first slide with the figures A and B in g1 inside g2, and the paragraph in g2
const NESTED = SOURCE.replace(FIG_A, '<figure class="zone" data-group="g2 g1">')
  .replace(FIG_B, '<figure class="zone" data-group="g2 g1" style="translate: -300px 100px">')
  .replace(PARA, '<p data-group="g2">A paragraph beside the figures</p>');

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const near = (a, b, by = 2) => Math.abs(a - b) <= by;
// the selected elements, each as its tag with the alt text of its image, sorted
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => el.localName + (el.querySelector('img') ? ':' + el.querySelector('img').alt : '')).sort()`);
// the upper left corner in slide px of the element of selector
const boxOf = (page, selector) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides').getBoundingClientRect(), k = s.width / 1920;
  const r = document.querySelector(${js(selector)}).getBoundingClientRect();
  return { left: (r.left - s.left) / k, top: (r.top - s.top) / k };
})()`);
const shownFrames = (page, selector) => page.evaluate(`[...document.querySelectorAll(${js(selector)})].filter((f) => !f.hidden && f.getBoundingClientRect().width > 0).length`);

async function load(t, platform, text = SOURCE, n = 0) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${DECK}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear(); true');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = text;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(text)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// text opened again in the editor of page at slide n, e.g. the source after a save and an open,
// after which the history is empty
async function reopen(page, text, n) {
  const s = await page.evaluate(`window.BeesonEditor.open(${js(text)})`);
  assert.deepEqual(s.problems, []);
  page.source = text;
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
}

// the text is changed from before by an entry named label, one undo gives before and one redo
// the edit byte for byte, and the saved text is opened again as it was
async function checkEdit(page, label, before, name) {
  const edited = await render(page);
  assert.notEqual(edited, before, `${label} did not change the text`);
  assert.equal((await state(page, 'edit.undo')).label, `Undo ${label}`);
  await undo(page);
  assert.equal(await render(page), before);
  await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, name);
  assert.equal(text, edited);
  return edited;
}

// a click with Shift on the paragraph of the current slide
async function shiftParagraph(page) {
  const p = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(':scope > p').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
  await click(page, p, { modifiers: 'Shift' });
}

// the figures A and B in g1 inside g2 with the paragraph, made by Group as in NESTED, with the
// rendered text as the source of the page
async function nest(page, platform) {
  await click(page, A);
  await shiftParagraph(page);
  await press(page, GROUP_KEY[platform]);
  await frames(page);
  page.source = await render(page);
  assert.equal(page.source, NESTED);
  await empty(page);
}

// the three figures of the first slide made one group without nesting
async function three(page, platform) {
  await click(page, A);
  await press(page, UNGROUP_KEY[platform]);
  await empty(page);
  await click(page, A);
  await click(page, B, { modifiers: 'Shift' });
  await click(page, C, { modifiers: 'Shift' });
  await press(page, GROUP_KEY[platform]);
  await frames(page);
  page.source = await render(page);
  assert.equal(page.source.match(/data-group="g2"/g)?.length, 3);
  await empty(page);
}

// a copy event and a paste event of what it put on a clipboard of the page, as the browser sends
// them for the keys of the system, since the clipboard of the system is shared with the other tests
const copyPaste = (page) =>
  page.evaluate(`(() => {
    const data = new DataTransfer();
    const at = () => document.activeElement ?? document.body;
    at().dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true }));
    const back = new DataTransfer();
    for (const type of data.types) back.setData(type, data.getData(type));
    at().dispatchEvent(new ClipboardEvent('paste', { clipboardData: back, bubbles: true, cancelable: true }));
  })()`);

// a click at the lower left of the slide, where nothing is drawn
async function empty(page) {
  const at = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().getBoundingClientRect(); return { x: r.left + 30, y: r.bottom - 30 }; })()`);
  await click(page, at);
}

// Ctrl with ] or [, and Shift with shift, as Chrome sends the key on a US layout. press() of the
// helpers does not know the brackets
async function bracket(page, right, shift) {
  const key = right ? (shift ? '}' : ']') : shift ? '{' : '[';
  const base = { key, code: right ? 'BracketRight' : 'BracketLeft', windowsVirtualKeyCode: right ? 221 : 219, modifiers: 2 | (shift ? 8 : 0) };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await frames(page);
}

const menuRows = (page, level = 0) => page.evaluate(`[...([...document.querySelectorAll('.beeson-edit-menu')][${level}]?.querySelectorAll('.item') ?? [])].map((i) => i.querySelector('.label')?.textContent ?? '')`);
async function hover(page, label, level = 0) {
  const at = await page.evaluate(`(() => { const i = [...[...document.querySelectorAll('.beeson-edit-menu')][${level}].querySelectorAll('.item')].find((x) => x.querySelector('.label').textContent === ${js(label)}); const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
  await sleep(350);
}
// the rows of the Object List as their level and kind, e.g. '2 Group'
const rows = (page) => page.evaluate(`[...document.querySelectorAll(${js(ROW)})].map((r) => r.getAttribute('aria-level') + ' ' + r.querySelector('.name').textContent.split(':')[0])`);
// the values of data-group in the text that are not on the originals of NESTED, in their order
const copiedLists = async (page) => (await render(page)).match(/data-group="[^"]*"/g).filter((v) => v !== 'data-group="g2"' && v !== 'data-group="g2 g1"');

for (const platform of PLATFORMS) {
  test(`Group of a group and a paragraph nests the group, Ungroup gives it back, and Regroup puts it together again (${platform})`, async (t) => {
    const page = await load(t, platform);
    assert.equal((await state(page, 'arrange.regroup')).enabled, false, 'Regroup is offered with nothing ungrouped');
    await click(page, A);
    await shiftParagraph(page);
    assert.deepEqual(await selected(page), ['figure:A first figure', 'figure:A second figure', 'p']);
    await press(page, GROUP_KEY[platform]);
    await frames(page);
    assert.equal(await render(page), NESTED);
    await checkEdit(page, 'Group', SOURCE, `r20-7-group-${platform}.html`);

    await click(page, A);
    assert.deepEqual(await selected(page), ['figure:A first figure', 'figure:A second figure', 'p']);
    await press(page, UNGROUP_KEY[platform]);
    await frames(page);
    assert.equal(await render(page), SOURCE, 'Ungroup of the outer group does not give back the inner group');
    assert.deepEqual(await selected(page), ['figure:A first figure', 'figure:A second figure', 'p']);
    assert.equal(await shownFrames(page, '.beeson-frame.union.group'), 1, 'the inner group is not framed as one object');

    await empty(page);
    assert.equal((await state(page, 'arrange.regroup')).enabled, true);
    await press(page, REGROUP_KEY[platform]);
    await frames(page);
    assert.equal(await render(page), NESTED);
    assert.deepEqual(await selected(page), ['figure:A first figure', 'figure:A second figure', 'p']);
    await checkEdit(page, 'Regroup', SOURCE, `r20-7-regroup-${platform}.html`);
    assert.equal((await state(page, 'arrange.regroup')).enabled, false, 'Regroup is offered on a group that is whole');
    assert.deepEqual(errors(page), []);
  });

  test(`a click enters a nested group one level at a time, and Esc goes up again (${platform})`, async (t) => {
    const page = await load(t, platform);
    await nest(page, platform);
    await click(page, A);
    assert.deepEqual(await selected(page), ['figure:A first figure', 'figure:A second figure', 'p']);
    assert.equal(await shownFrames(page, '.beeson-frame.entered'), 0);
    await click(page, A);
    assert.deepEqual(await selected(page), ['figure:A first figure', 'figure:A second figure'], 'the second click does not select the inner group');
    assert.equal(await shownFrames(page, '.beeson-frame.entered'), 1, 'the entered group is not drawn');
    await click(page, A);
    assert.deepEqual(await selected(page), ['figure:A first figure'], 'the third click does not select the member');
    await press(page, 'Escape');
    assert.deepEqual(await selected(page), ['figure:A first figure', 'figure:A second figure']);
    await press(page, 'Escape');
    assert.deepEqual(await selected(page), ['figure:A first figure', 'figure:A second figure', 'p']);
    assert.equal(await shownFrames(page, '.beeson-frame.entered'), 0);
    await press(page, 'Escape');
    assert.deepEqual(await selected(page), []);
    assert.equal(await render(page), NESTED);
    assert.deepEqual(errors(page), []);
  });

  test(`a Shift-click inside an entered group selects two of its three members, which Align Left aligns to each other (${platform})`, async (t) => {
    const page = await load(t, platform);
    await three(page, platform);
    const a0 = await boxOf(page, A), b0 = await boxOf(page, B), c0 = await boxOf(page, C);
    await click(page, A);
    await click(page, A);
    assert.deepEqual(await selected(page), ['figure:A first figure']);
    await click(page, B, { modifiers: 'Shift' });
    assert.deepEqual(await selected(page), ['figure:A first figure', 'figure:A second figure'], 'the Shift-click selects the whole group');
    assert.equal(await shownFrames(page, '.beeson-frame.union.group'), 0, 'two members are framed as a group');
    await exec(page, 'arrange.alignTo.selection');
    await exec(page, 'arrange.align.left');
    await frames(page);
    const a = await boxOf(page, A), b = await boxOf(page, B), c = await boxOf(page, C);
    assert.ok(near(a.left, b0.left) && near(b.left, b0.left), `A and B are not at the left of their union: ${js({ a0, b0, a, b })}`);
    assert.ok(near(c.left, c0.left) && near(c.top, c0.top), 'the third member moved');
    assert.ok(near(a.top, a0.top) && near(b.top, b0.top));
    await checkEdit(page, 'Align Left', page.source, `r20-7-align-left-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });

  test(`a drag, Bring to Front, and Delete act on a member selected inside a nested group alone (${platform})`, async (t) => {
    const page = await load(t, platform);
    await nest(page, platform);
    const before = page.source;
    const b0 = await boxOf(page, B), c0 = await boxOf(page, C);
    await click(page, A);
    await click(page, A);
    await click(page, A);
    assert.deepEqual(await selected(page), ['figure:A first figure']);
    await drag(page, A, { dx: 40, dy: 30 });
    await frames(page);
    const dragged = await render(page);
    assert.notEqual(dragged, before, 'the drag does not move the member');
    const b = await boxOf(page, B), c = await boxOf(page, C);
    assert.ok(near(b.left, b0.left) && near(b.top, b0.top) && near(c.left, c0.left) && near(c.top, c0.top), 'the drag moves the other members');
    assert.deepEqual(await selected(page), ['figure:A first figure']);
    await undo(page);
    assert.equal(await render(page), before);

    // an undo keeps the member selected, and a click on it would select its picture
    assert.deepEqual(await selected(page), ['figure:A first figure']);
    await press(page, platform === 'mac' ? 'Mod+Shift+F' : 'Mod+Shift+ArrowUp');
    await frames(page);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Bring to Front');
    const front = await render(page);
    assert.ok(front.indexOf('A second figure') < front.indexOf('A third figure') && front.indexOf('A third figure') < front.indexOf('A first figure'), front);
    assert.equal(front.match(/data-group="g2 g1"/g)?.length, 2, front);
    await undo(page);
    assert.equal(await render(page), before);

    assert.deepEqual(await selected(page), ['figure:A first figure']);
    await press(page, 'Backspace');
    await frames(page);
    const deleted = await render(page);
    assert.doesNotMatch(deleted, /A first figure/);
    assert.match(deleted, /<figure class="zone" data-group="g2 g1" style="translate: -300px 100px">/);
    assert.match(deleted, /A third figure/);
    await undo(page);
    assert.equal(await render(page), before);
    assert.deepEqual(errors(page), []);
  });

  test(`in a group of two, Align Top aligns the members selected inside it to each other (${platform})`, async (t) => {
    const page = await load(t, platform);
    const a0 = await boxOf(page, A), b0 = await boxOf(page, B);
    await click(page, A);
    await click(page, A);
    await click(page, B, { modifiers: 'Shift' });
    assert.deepEqual(await selected(page), ['figure:A first figure', 'figure:A second figure']);
    await exec(page, 'arrange.alignTo.selection');
    await exec(page, 'arrange.align.top');
    await frames(page);
    const a = await boxOf(page, A), b = await boxOf(page, B);
    assert.ok(near(a.top, a0.top) && near(b.top, a0.top), `A and B are not at the top of their union: ${js({ a0, b0, a, b })}`);
    assert.ok(near(a.left, a0.left) && near(b.left, b0.left));
    // a Shift-click on a selected member takes it off alone, and a click outside leaves the group
    await click(page, B, { modifiers: 'Shift' });
    assert.deepEqual(await selected(page), ['figure:A first figure']);
    await click(page, C);
    await click(page, A);
    assert.deepEqual(await selected(page), ['figure:A first figure', 'figure:A second figure']);
    await checkEdit(page, 'Align Top', SOURCE, `r20-7-align-top-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });

  test(`Select All selects the lines of the slide, which Group, a drag, Delete, and Copy then take with the rest (${platform})`, async (t) => {
    const page = await load(t, platform, SOURCE, 2);
    await empty(page);
    await press(page, 'Mod+A');
    await frames(page);
    assert.deepEqual(await selected(page), ['figure:A figure at the arrow', 'h2', 'p', 'svg']);
    await press(page, GROUP_KEY[platform]);
    await frames(page);
    const grouped = await render(page);
    assert.equal((grouped.match(/data-group="g2"/g) ?? []).length, 4, 'the line is left out of the group');
    assert.match(grouped, /<svg class="line" width="300" height="1" style="translate: 600px 700px" data-group="g2">/);
    await checkEdit(page, 'Group', SOURCE, `r20-7-all-group-${platform}.html`);
    await reopen(page, SOURCE, 2);

    await empty(page);
    await press(page, 'Mod+A');
    const p = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(':scope > p').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
    await drag(page, p, { dx: 40, dy: 30 });
    await frames(page);
    assert.doesNotMatch(await render(page), /style="translate: 600px 700px"/, 'the drag left the line in place');
    await undo(page);
    assert.equal(await render(page), SOURCE);

    await empty(page);
    await press(page, 'Mod+A');
    await copyPaste(page);
    await frames(page);
    assert.equal((await render(page)).match(/<svg class="line"/g)?.length, 2, 'Copy and Paste leave the line out');
    await undo(page);
    assert.equal(await render(page), SOURCE);

    await empty(page);
    await press(page, 'Mod+A');
    await press(page, 'Backspace');
    await frames(page);
    assert.doesNotMatch(await render(page), /<svg class="line"/, 'Delete leaves the line');
    await undo(page);
    assert.equal(await render(page), SOURCE);
    assert.deepEqual(errors(page), []);
  });

  test(`Duplicate, Paste, and a copy by a drag give a nested group fresh names at every level (${platform})`, async (t) => {
    const page = await load(t, platform);
    await nest(page, platform);
    // the copies of the paragraph, A, and B, in this order: one outer name on all three, and one
    // inner name on A and B, each new
    const check = (lists, what) => {
      assert.equal(lists.length, 3, `${what}: ${lists}`);
      const [p, a, b] = lists.map((l) => l.slice(12, -1).split(' '));
      assert.equal(p.length, 1, `${what}: ${lists}`);
      assert.deepEqual(a, b, `${what}: ${lists}`);
      assert.equal(a.length, 2, `${what}: ${lists}`);
      assert.equal(a[0], p[0], `${what}: ${lists}`);
      assert.ok(!['g1', 'g2'].includes(a[0]) && !['g1', 'g2'].includes(a[1]) && a[0] !== a[1], `${what}: ${lists}`);
    };
    await click(page, A);
    await press(page, 'Mod+D');
    await frames(page);
    check(await copiedLists(page), 'Duplicate');
    await undo(page);
    assert.equal(await render(page), NESTED);
    // the undo selects the group again, and a click on it would enter it
    await empty(page);
    await click(page, A);
    await copyPaste(page);
    await frames(page);
    check(await copiedLists(page), 'Paste');
    await undo(page);
    assert.equal(await render(page), NESTED);
    await empty(page);
    await click(page, A);
    await drag(page, A, { dx: -40, dy: 200, modifiers: platform === 'mac' ? 'Alt' : 'Ctrl' });
    await frames(page);
    check(await copiedLists(page), 'a copy by a drag');
    assert.deepEqual(errors(page), []);
  });

  test(`the Object List shows a group inside a group as a row under its row, which folds (${platform})`, async (t) => {
    const page = await load(t, platform);
    await nest(page, platform);
    await press(page, LIST_KEY[platform]);
    await frames(page);
    const all = await rows(page);
    assert.deepEqual(all.filter((r) => !r.startsWith('1 ') || r === '1 Group'), ['1 Group', '2 Group', '3 Figure', '3 Figure', '2 Text'], `the rows: ${all}`);
    const inner = all.indexOf('2 Group');
    assert.equal(await page.evaluate(`!!document.querySelectorAll(${js(ROW)})[${inner}].querySelector('.twist svg')`), true, 'the inner group row does not have a chevron');
    await click(page, `${ROW}:nth-child(${inner + 1})`);
    assert.deepEqual(await selected(page), ['figure:A first figure', 'figure:A second figure']);
    await click(page, `${ROW}:nth-child(${inner + 1}) .twist`);
    assert.equal((await rows(page)).filter((r) => r.startsWith('3 ')).length, 0, 'the folded group shows its members');
    assert.equal(await render(page), NESTED);
    // the folded inner group is dragged as one row behind the paragraph, and its members keep their
    // order and their lists
    const box = (i) => page.evaluate(`(() => { const b = document.querySelectorAll(${js(ROW)})[${i}].getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, bottom: b.bottom }; })()`);
    const folded = await rows(page);
    const from = await box(folded.indexOf('2 Group')), under = await box(folded.indexOf('2 Text'));
    await drag(page, from, { dy: under.bottom + 4 - from.y, steps: 8 });
    await frames(page);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Reorder');
    const moved = await rows(page);
    assert.ok(moved.indexOf('2 Text') < moved.indexOf('2 Group'), `the rows after the drag: ${moved}`);
    const reordered = await render(page);
    assert.equal(reordered.match(/data-group="g2 g1"/g)?.length, 2, reordered);
    assert.ok(reordered.indexOf('A first figure') < reordered.indexOf('A second figure'), reordered);
    assert.deepEqual(errors(page), []);
  });

  test(`Rotate Right 90° and Rotate Left 90° turn a figure by a quarter turn as one entry each (${platform})`, async (t) => {
    const page = await load(t, platform, SOURCE, 1);
    await click(page, 'section.present img[alt="A turned figure"]');
    await exec(page, 'arrange.rotateRight');
    await frames(page);
    assert.equal(await render(page), SOURCE.replace('style="width: 200px; rotate: 30deg"', 'style="width: 200px; rotate: 120deg"'));
    await checkEdit(page, 'Rotate Right 90°', SOURCE, `r20-7-right-${platform}.html`);
    await reopen(page, SOURCE, 1);
    await click(page, 'section.present img[alt="A straight figure"]');
    await exec(page, 'arrange.rotateLeft');
    await frames(page);
    assert.match(await render(page), /<img style="width: 200px; rotate: 270deg" src="..\/..\/demo\/figure-dark.png" alt="A straight figure">/);
    await checkEdit(page, 'Rotate Left 90°', SOURCE, `r20-7-left-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });

  test(`the menu of an element holds the layer items, the turns, and the submenus Group, Align, and Distribute (${platform})`, async (t) => {
    const page = await load(t, platform, SOURCE, 1);
    await click(page, 'section.present img[alt="A turned figure"]');
    await click(page, 'section.present img[alt="A turned figure"]', { button: 'right' });
    await sleep(100);
    const labels = await menuRows(page);
    const at = (label) => {
      const i = labels.indexOf(label);
      assert.ok(i >= 0, `${label} is not in the menu: ${labels.join(', ')}`);
      return i;
    };
    assert.ok(at('Bring to Front') < at('Bring Forward') && at('Bring Forward') < at('Send Backward') && at('Send Backward') < at('Send to Back'), labels.join(', '));
    at('Rotate Left 90°');
    at('Rotate Right 90°');
    await hover(page, 'Group');
    assert.deepEqual(await menuRows(page, 1), ['Group', 'Ungroup', 'Regroup']);
    await hover(page, 'Align');
    assert.deepEqual((await menuRows(page, 1)).slice(0, 6), ['Align Left', 'Align Center', 'Align Right', 'Align Top', 'Align Middle', 'Align Bottom']);
    await hover(page, 'Distribute');
    assert.ok((await menuRows(page, 1)).includes('Distribute Horizontally'));
    await page.evaluate('window.BeesonEditorShell.closeMenus()');
    assert.deepEqual(errors(page), []);
  });
}

test('on Windows and Linux, Ctrl with ] or [ orders the selection on the canvas and still indents a list item (other)', async (t) => {
  const page = await load(t, 'other', SOURCE, 1);
  await click(page, 'section.present img[alt="A turned figure"]');
  for (const [shift, label] of [[false, 'Bring Forward'], [true, 'Bring to Front']]) {
    await bracket(page, true, shift);
    assert.equal((await state(page, 'edit.undo')).label, `Undo ${label}`);
    await undo(page);
    assert.equal(await render(page), SOURCE);
  }
  await click(page, 'section.present img[alt="A straight figure"]');
  for (const [shift, label] of [[false, 'Send Backward'], [true, 'Send to Back']]) {
    await bracket(page, false, shift);
    assert.equal((await state(page, 'edit.undo')).label, `Undo ${label}`);
    await undo(page);
    assert.equal(await render(page), SOURCE);
  }
  await empty(page);
  const two = await page.evaluate(`(() => { const r = [...Reveal.getCurrentSlide().querySelectorAll('li')][1].getBoundingClientRect(); return { x: r.left + 30, y: r.top + r.height / 2 }; })()`);
  await click(page, two);
  await bracket(page, true, false);
  assert.equal((await state(page, 'edit.undo')).label, 'Undo Increase Indent Level', 'Ctrl+] in a list item does not indent it');
  assert.deepEqual(errors(page), []);
});
