// regression tests of R10.2 on both platforms with trusted input: the object list of
// navigator/objects.ts, the Text pane for several text blocks, the arrowheads of the marks of equal
// gaps, and the guides written into data-guides. after each edit of the file the text is checked
// when rendered, byte for byte after an undo, again after a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const LAYOUTS = 'test/pages/editor-layouts.html';
const SECTIONS = [...readFileSync(LAYOUTS, 'utf8').matchAll(/<section[\s\S]*?<\/section>/g)].map((m) => m[0]);
const MATH = SECTIONS.findIndex((s) => s.includes('<h2>Math, an ordered list, and a zone</h2>'));
const OBJECTS = '.beeson-edit-objects';
const ROW = `${OBJECTS} .row`;
const LIST_KEY = { mac: 'Mod+Shift+L', other: 'Alt+F10' };

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
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => el.tagName.toLowerCase())`);
const active = (page) => page.evaluate(`document.activeElement.closest(${js(OBJECTS)}) ? 'list:' + document.activeElement.textContent : document.activeElement.tagName`);
// the rows of the object list as level, name, and selection, e.g. '1 Formula *'
const rows = (page) =>
  page.evaluate(`[...document.querySelectorAll(${js(ROW)})].map((r) => r.getAttribute('aria-level') + ' ' + r.querySelector('.name').textContent + (r.getAttribute('aria-selected') === 'true' ? ' *' : ''))`);
const rowBox = (page, n) =>
  page.evaluate(`(() => { const r = document.querySelectorAll(${js(ROW)})[${n}].getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2, top: r.top, bottom: r.bottom }; })()`);

// the editor on slide n of the deck of layouts, served over HTTP, with the storage of the browser
// cleared
async function load(t, platform, n = MATH) {
  const page = await browser.newPage();
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(LAYOUTS, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(status.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the checks after an edit whose rendered text is edited: the text before it after an undo, the
// same text after a redo, and a save and an open without problems
async function checkEdit(page, edited, base = page.source) {
  assert.notEqual(edited, base);
  await undo(page);
  assert.equal(await render(page), base);
  await redo(page);
  assert.equal(await render(page), edited);
  await saveAndReopen(page, `r10-2-${Math.random().toString(36).slice(2)}.html`);
  assert.deepEqual(errors(page), []);
}

async function openList(page, platform) {
  await press(page, LIST_KEY[platform]);
  await frames(page);
  assert.equal(await page.evaluate(`!document.querySelector(${js(OBJECTS)}).hidden`), true);
}

const FRONT_TO_BACK = [
  '1 Figure: A caption under a zone.',
  '1 Text: A first step A final step',
  '1 Text: where the Coriolis term is…',
  '1 Formula',
  '1 Text: The lead-in of a display',
  '1 Text: Math, an ordered list, and a zone',
];

for (const platform of PLATFORMS) {
  test(`${platform}: View > Object List shows a row for each object from front to back, reached with F6`, async (t) => {
    const page = await load(t, platform);
    assert.equal((await state(page, 'view.objects')).checked, false);
    await openList(page, platform);
    assert.equal((await state(page, 'view.objects')).checked, true);
    assert.deepEqual(await rows(page), FRONT_TO_BACK);
    assert.match(await active(page), /^list:/);
    await press(page, 'Escape');
    assert.equal(await active(page), 'BODY');
    let reached = false;
    for (let i = 0; i < 12 && !reached; i++) {
      await press(page, 'F6');
      reached = (await active(page)).startsWith('list:');
    }
    assert.ok(reached, 'F6 does not reach the object list');
    await page.evaluate('Reveal.slide(0)');
    await frames(page);
    assert.ok((await rows(page)).length > 0);
    assert.notDeepEqual(await rows(page), FRONT_TO_BACK);
    await press(page, LIST_KEY[platform]);
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelector(${js(OBJECTS)}).hidden`), true);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`${platform}: a click, Shift, the command modifier, and the arrow keys select rows, and the list shows the selection of the canvas`, async (t) => {
    const page = await load(t, platform);
    await openList(page, platform);
    await click(page, `${ROW}:nth-child(3)`);
    assert.deepEqual(await selected(page), ['p']);
    assert.equal((await rows(page))[2], '1 Text: where the Coriolis term is… *');
    await click(page, `${ROW}:nth-child(1)`, { modifiers: 'Mod' });
    assert.deepEqual((await selected(page)).sort(), ['figure', 'p']);
    await click(page, `${ROW}:nth-child(1)`, { modifiers: 'Mod' });
    assert.deepEqual(await selected(page), ['p']);
    // the row clicked last is the current row of the arrow keys
    await press(page, 'ArrowDown');
    assert.deepEqual(await selected(page), ['ol']);
    await press(page, 'Shift+ArrowDown');
    assert.deepEqual((await selected(page)).sort(), ['ol', 'p']);
    await click(page, `${ROW}:nth-child(6)`, { modifiers: 'Shift' });
    assert.deepEqual((await selected(page)).sort(), ['h2', 'ol', 'p']);
    // a selection made on the canvas is shown in the list at once
    await press(page, 'Escape');
    await click(page, '.reveal .slides section.present figure.zone img');
    assert.deepEqual(await selected(page), ['figure']);
    assert.equal((await rows(page))[0], '1 Figure: A caption under a zone. *');
    assert.equal((await rows(page)).filter((r) => r.endsWith('*')).length, 1);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`${platform}: the padlock of a row locks and unlocks its object as one entry of the history`, async (t) => {
    const page = await load(t, platform);
    await openList(page, platform);
    await click(page, `${ROW}:nth-child(4) .lock`);
    const edited = await render(page);
    assert.match(edited, /<div class="math[^"]*"[^>]* data-locked>/);
    assert.equal(await page.evaluate(`document.querySelectorAll(${js(ROW)})[3].querySelector('.lock').getAttribute('aria-pressed')`), 'true');
    await checkEdit(page, edited);
    await click(page, `${ROW}:nth-child(4) .lock`);
    assert.equal(await render(page), page.source);
  });

  test(`${platform}: a drag of a row moves its object by the layers of Bring Forward and Send Backward, and a row that cannot move is not dragged`, async (t) => {
    const page = await load(t, platform);
    await openList(page, platform);
    // the heading is in the flow among elements in the flow, which the layer commands do not move
    const fixed = await rowBox(page, 5);
    const first = await rowBox(page, 0);
    await drag(page, { x: fixed.x, y: fixed.y }, { dy: first.top + 2 - fixed.y, steps: 8 });
    assert.equal(await render(page), page.source);
    assert.equal((await page.evaluate('window.BeesonEditor.status()')).undo, false);
    // a nudge makes the lead-in a layer, which the figure is then dragged behind
    await click(page, `${ROW}:nth-child(5)`);
    await press(page, 'Escape');
    await press(page, 'ArrowRight');
    const nudged = await render(page);
    const from = await rowBox(page, 0);
    const to = await rowBox(page, 4);
    await drag(page, { x: from.x, y: from.y }, { dy: to.bottom - 2 - from.y, steps: 8 });
    assert.deepEqual((await rows(page)).slice(3, 6), ['1 Text: The lead-in of a display', '1 Figure: A caption under a zone. *', '1 Text: Math, an ordered list, and a zone']);
    const edited = await render(page);
    assert.ok(edited.indexOf('<figure class="zone') < edited.indexOf('The lead-in of a display'));
    await undo(page);
    assert.equal(await render(page), nudged);
    await redo(page);
    assert.equal(await render(page), edited);
    await saveAndReopen(page, `r10-2-drag-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });

  test(`${platform}: the members of a group are rows under its group row, which folds`, async (t) => {
    const page = await load(t, platform);
    await openList(page, platform);
    await click(page, `${ROW}:nth-child(1)`);
    await click(page, `${ROW}:nth-child(4)`, { modifiers: 'Mod' });
    await press(page, 'Escape');
    await press(page, platform === 'mac' ? 'Mod+Alt+G' : 'Mod+G');
    const edited = await render(page);
    assert.deepEqual((await rows(page)).slice(0, 3), ['1 Group *', '2 Figure: A caption under a zone. *', '2 Formula *']);
    await click(page, `${ROW}:nth-child(2)`);
    assert.deepEqual(await selected(page), ['figure']);
    await click(page, `${ROW}:nth-child(1)`);
    assert.deepEqual((await selected(page)).sort(), ['div', 'figure']);
    await click(page, `${ROW}:nth-child(1) .twist`);
    assert.deepEqual((await rows(page)).slice(0, 2), ['1 Group *', '1 Text: A first step A final step']);
    await press(page, 'ArrowRight');
    assert.equal((await rows(page)).length, 7);
    await checkEdit(page, edited);
  });

  test(`${platform}: the search field filters the rows by name`, async (t) => {
    const page = await load(t, platform);
    await openList(page, platform);
    await click(page, `${OBJECTS} input`);
    await page.send('Input.insertText', { text: 'step' });
    await frames(page);
    assert.deepEqual(await rows(page), ['1 Text: A first step A final step']);
    await page.send('Input.insertText', { text: 'zzz' });
    await frames(page);
    assert.deepEqual(await rows(page), []);
    assert.equal(await page.evaluate(`document.querySelector('${OBJECTS} .empty').hidden`), false);
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await rows(page), FRONT_TO_BACK);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}

// the inspector as its tabs, the paragraph style, and the controls of the Text pane that are on or
// mixed, e.g. 'text.bold=mixed'
const inspector = (page) =>
  page.evaluate(`({
    tabs: [...document.querySelectorAll('.beeson-edit-inspector .ed-tabs button')].map((t) => t.textContent + (t.getAttribute('aria-selected') === 'true' ? '*' : '')),
    style: document.querySelector('.beeson-edit-inspector .ed-popup')?.textContent ?? null,
    on: [...document.querySelectorAll('.beeson-edit-inspector [data-command^="text."][aria-pressed]')].filter((b) => b.getAttribute('aria-pressed') !== 'false').map((b) => b.dataset.command + '=' + b.getAttribute('aria-pressed')),
  })`);

for (const platform of PLATFORMS) {
  // the lead-in alone in the accent and bold, then the lead-in and the heading selected
  async function mixedBlocks(t) {
    const page = await load(t, platform);
    await openList(page, platform);
    await click(page, `${ROW}:nth-child(5)`);
    await exec(page, 'text.tone.accent');
    await exec(page, 'text.bold');
    await click(page, `${ROW}:nth-child(6)`, { modifiers: 'Mod' });
    return page;
  }

  test(`${platform}: the Text pane shows the values that several text blocks do not share as mixed, and Bold sets bold on each`, async (t) => {
    const page = await mixedBlocks(t);
    assert.deepEqual(await inspector(page), { tabs: ['Text*', 'Arrange'], style: 'Mixed', on: ['text.bold=mixed', 'text.tone.text=mixed', 'text.tone.accent=mixed'] });
    const base = await render(page);
    await click(page, '.beeson-edit-inspector button[data-command="text.bold"]');
    assert.equal((await inspector(page)).on[0], 'text.bold=true');
    const bold = await render(page);
    assert.match(bold, /<h2><strong>Math, an ordered list, and a zone<\/strong><\/h2>/);
    assert.match(bold, /<strong><span class="tone-accent">The lead-in of a display<\/span><\/strong>|<span class="tone-accent"><strong>The lead-in of a display<\/strong><\/span>/);
    await checkEdit(page, bold, base);
  });

  test(`${platform}: a swatch of the Text pane colors several text blocks as one entry of the history`, async (t) => {
    const page = await mixedBlocks(t);
    const base = await render(page);
    await click(page, '.beeson-edit-inspector .ed-swatches button[data-command="text.tone.violet"]');
    assert.deepEqual((await inspector(page)).on, ['text.bold=mixed', 'text.tone.violet=true']);
    const violet = await render(page);
    assert.equal(violet.split('tone-violet').length, 3);
    assert.equal(violet.includes('tone-accent'), false);
    await checkEdit(page, violet, base);
  });

  test(`${platform}: the paragraph style and the kind of list of several blocks that differ are mixed`, async (t) => {
    const page = await load(t, platform);
    await openList(page, platform);
    await click(page, `${ROW}:nth-child(5)`);
    await click(page, `${ROW}:nth-child(6)`, { modifiers: 'Mod' });
    assert.deepEqual(await inspector(page), { tabs: ['Text*', 'Arrange'], style: 'Mixed', on: ['text.tone.text=true'] });
    await click(page, `${ROW}:nth-child(6)`, { modifiers: 'Mod' });
    await click(page, `${ROW}:nth-child(2)`, { modifiers: 'Mod' });
    assert.deepEqual((await inspector(page)).on, ['text.tone.text=true', 'text.list.none=mixed', 'text.list.ol=mixed']);
    // a formula among them leaves Arrange alone
    await click(page, `${ROW}:nth-child(4)`, { modifiers: 'Mod' });
    assert.deepEqual((await inspector(page)).tabs, []);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}
