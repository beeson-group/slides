// the Code pane of the Format tab with trusted input on either platform: the language of a code
// box written as its class language-* and colored again at once, the numbers of its lines, and its
// line steps in data-line-numbers, typed into a field or edited in the list of the groups. after
// each edit an undo gives the file byte for byte, a redo gives the edit, and a save is opened again
// without problems. a new code box gets a language and is colored

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
const REDO = { mac: 'Mod+Shift+Z', other: 'Mod+Y' };
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const CODE = '<code class="language-python" data-line-numbers="1-3|4|5-7|8-9">def halo_family():';
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const rendered = (page) => page.evaluate('window.BeesonEditor.render()');

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

// the editor on index.html with the Format tab shown, on the slide of its code box
async function open(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close());
  await page.goto(`${server.origin}/test-deck.html?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('test-deck.html', 'utf8');
  await page.evaluate('localStorage.clear()');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`)).problems, []);
  if (!(await page.evaluate(`window.BeesonEditor.state('shell.format').checked`))) await page.evaluate(`window.BeesonEditor.exec('shell.format')`);
  await page.evaluate(`Reveal.slide(Reveal.getIndices(document.querySelector('pre > code').closest('section')).h)`);
  await frames(page);
  return page;
}

// a point in line n of the code box, counted from 1, at its start or at its end
const linePoint = (page, n, end = false) => page.evaluate(`(() => {
  const code = document.querySelector('.reveal section.present pre > code');
  const text = code.textContent;
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\\n') starts.push(i + 1);
  const a = starts[${n} - 1];
  const b = (starts[${n}] ?? text.length + 1) - 1;
  const walk = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  const node = walk.nextNode();
  const r = document.createRange();
  r.setStart(node, ${end} ? Math.max(a, b - 1) : a);
  r.setEnd(node, ${end} ? b : a + 1);
  const box = r.getBoundingClientRect();
  return { x: ${end} ? box.right - 1 : box.left + 1, y: box.top + box.height / 2 };
})()`);

// the count of the ranges of a highlight of the painter, e.g. keyword
const ranges = (page, name) => page.evaluate(`CSS.highlights.get(${JSON.stringify(`beeson-code-${name}`)})?.size ?? 0`);
const pane = (page) => page.evaluate(`document.querySelector('${PANEL} .ed-panes')?.dataset.pane ?? null`);
const language = (page) => page.evaluate(`document.querySelector('${PANEL} .ed-lang .value').textContent`);
const groups = (page) => page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-groups li')].map((li) => li.querySelector('.lines')?.textContent + ' · ' + li.querySelector('.at')?.textContent)`);

async function choose(page, label) {
  const at = await page.evaluate(`(() => {
    const items = [...document.querySelectorAll('.beeson-edit-menu .item')];
    const item = items.reverse().find((i) => i.querySelector('.label').textContent === ${JSON.stringify(label)});
    if (!item) return null;
    item.scrollIntoView({ block: 'nearest' });
    const r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(at, `the open menu does not have an item ${label}`);
  await sleep(250);
  await click(page, at);
  await frames(page);
}

async function undoRedo(page, platform, before, after) {
  await press(page, 'Mod+Z');
  await frames(page);
  assert.equal(await rendered(page), before, 'an undo does not give the file before the edit');
  await press(page, REDO[platform]);
  await frames(page);
  assert.equal(await rendered(page), after, 'a redo does not give the edit again');
}

const newProblems = (page, text) => {
  const old = new Set(textProblems(page.source, THEME));
  return textProblems(text, THEME).filter((p) => !old.has(p));
};

for (const platform of PLATFORMS) {
  test(`the language of a code box is chosen in the Code pane and colored again at once on ${platform}`, async (t) => {
    const page = await open(t, platform);
    const source = page.source;
    // the box is colored in the editor without a change of its DOM
    assert.ok((await ranges(page, 'keyword')) > 3, 'the keywords of the box are not colored');
    const dom = await page.evaluate(`document.querySelector('.reveal section.present pre').innerHTML`);
    await click(page, await linePoint(page, 2));
    await frames(page);
    assert.equal(await pane(page), 'code');
    assert.equal(await language(page), 'Python');
    await click(page, `${PANEL} .ed-lang`);
    await page.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
    const labels = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item .label')].map((l) => l.textContent)`);
    assert.deepEqual(labels.slice(0, 3), ['Automatic', 'Plain Text', 'Python']);
    assert.ok(labels.includes('All Languages'), 'the menu does not have the languages of highlight.js');
    await choose(page, 'Plain Text');
    const plain = source.replace(CODE, CODE.replace('language-python', 'language-plaintext'));
    assert.equal(await rendered(page), plain);
    assert.equal(await language(page), 'Plain Text');
    await frames(page);
    assert.equal(await ranges(page, 'keyword'), 0, 'a box of Plain Text is colored');
    await undoRedo(page, platform, source, plain);
    await press(page, 'Mod+Z');
    await frames(page);
    assert.ok((await ranges(page, 'keyword')) > 3, 'the box is not colored again after an undo');
    // a language of the submenu of every language
    await click(page, `${PANEL} .ed-lang`);
    await page.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
    const sub = await page.evaluate(`(() => { const item = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label').textContent === 'All Languages'); const r = item.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await click(page, sub);
    await page.waitFor(`document.querySelectorAll('.beeson-edit-menu').length === 2`);
    assert.ok((await page.evaluate(`document.querySelectorAll('.beeson-edit-menu')[1].querySelectorAll('.item').length`)) > 100);
    await choose(page, 'Julia');
    const julia = source.replace(CODE, CODE.replace('language-python', 'language-julia'));
    assert.equal(await rendered(page), julia);
    assert.ok((await ranges(page, 'keyword')) > 0);
    await undoRedo(page, platform, source, julia);
    assert.equal(await page.evaluate(`document.querySelector('.reveal section.present pre').innerHTML`), dom.replace('language-python', 'language-julia'), 'the painter changed the DOM of the box');
    assert.deepEqual(newProblems(page, julia), []);
    assert.deepEqual(errors(page), []);
  });

  test(`the line steps of a code box are typed, added from the selected lines, and removed on ${platform}`, async (t) => {
    const page = await open(t, platform);
    const source = page.source;
    await click(page, await linePoint(page, 1));
    await frames(page);
    assert.deepEqual(await groups(page), ['Lines 1–3 · With the slide', 'Line 4 · Step 1', 'Lines 5–7 · Step 2', 'Lines 8–9 · Step 3']);
    // the field takes the groups separated by bars
    await click(page, `${PANEL} input[name="line-steps"]`);
    await page.evaluate(`document.querySelector('${PANEL} input[name="line-steps"]').select()`);
    await type(page, '1-2 | 4');
    await press(page, 'Enter');
    await frames(page);
    const typed = source.replace(CODE, CODE.replace('1-3|4|5-7|8-9', '1-2|4'));
    assert.equal(await rendered(page), typed);
    assert.deepEqual(await groups(page), ['Lines 1–2 · With the slide', 'Line 4 · Step 1']);
    // a group that is not lines is refused, and the file is kept
    await page.evaluate(`document.querySelector('${PANEL} input[name="line-steps"]').select()`);
    await type(page, '1-|x');
    await press(page, 'Enter');
    await frames(page);
    assert.equal(await rendered(page), typed);
    assert.match((await page.evaluate('window.BeesonEditor.status()')).message, /not a group of lines/);
    await press(page, 'Escape');
    await undoRedo(page, platform, source, typed);
    // the lines selected in the box by a drag become the next group
    const from = await linePoint(page, 5);
    const to = await linePoint(page, 6, true);
    await drag(page, from, { dx: to.x - from.x, dy: to.y - from.y });
    await frames(page);
    assert.match(await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-note')].map((n) => n.textContent).join(' ')`), /Lines 5–6 are selected in the code/);
    await click(page, `${PANEL} button[data-command="code.addGroup"]`);
    await frames(page);
    const added = source.replace(CODE, CODE.replace('1-3|4|5-7|8-9', '1-2|4|5-6'));
    assert.equal(await rendered(page), added);
    assert.deepEqual(await groups(page), ['Lines 1–2 · With the slide', 'Line 4 · Step 1', 'Lines 5–6 · Step 2']);
    // a group pointed at dims the other lines, and its button removes it
    const row = await page.evaluate(`(() => { const r = document.querySelectorAll('${PANEL} .ed-groups li')[1].getBoundingClientRect(); return { x: r.left + 30, y: r.top + r.height / 2 }; })()`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: row.x, y: row.y });
    await frames(page);
    assert.equal(await ranges(page, 'dim'), 8, 'the 8 lines outside line 4 are not dimmed');
    await click(page, `${PANEL} .ed-groups li:nth-child(2) button`);
    await frames(page);
    const removed = source.replace(CODE, CODE.replace('1-3|4|5-7|8-9', '1-2|5-6'));
    assert.equal(await rendered(page), removed);
    await undoRedo(page, platform, added, removed);
    // without groups, the numbers of the lines are a switch
    await page.evaluate(`document.querySelector('${PANEL} input[name="line-steps"]').select()`);
    await type(page, '');
    await press(page, 'Backspace');
    await press(page, 'Enter');
    await frames(page);
    const numbered = source.replace(CODE, CODE.replace('="1-3|4|5-7|8-9"', ''));
    assert.equal(await rendered(page), numbered);
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} input[data-command="code.numbers"]').checked`), true);
    await click(page, `${PANEL} label.ed-check`);
    await frames(page);
    const bare = source.replace(CODE, CODE.replace(' data-line-numbers="1-3|4|5-7|8-9"', ''));
    assert.equal(await rendered(page), bare);
    // the focus is still in the field, as after Enter in any field of the inspector
    await press(page, 'Escape');
    await undoRedo(page, platform, numbered, bare);
    assert.deepEqual(newProblems(page, bare), []);
    await saveAndReopen(page);
    assert.deepEqual(errors(page), []);
  });
}

test('a new code box gets a language, is colored, and is shown in the Code pane', async (t) => {
  const page = await open(t, 'mac');
  await page.evaluate(`Reveal.slide(0)`);
  await page.evaluate(`Reveal.slide(Reveal.getIndices([...document.querySelectorAll('.reveal .slides > section')].find((s) => !s.className && !s.querySelector('pre'))).h)`);
  await frames(page);
  await page.evaluate(`window.BeesonEditor.exec('insert.code')`);
  await type(page, 'for x in range(3):');
  await sleep(200);
  await frames(page);
  assert.match(await rendered(page), /<pre><code class="language-python">for x in range\(3\):<\/code><\/pre>/);
  assert.ok((await ranges(page, 'keyword')) >= 2, 'the keywords of a new code box are not colored');
  assert.ok((await ranges(page, 'number')) >= 1, 'the number of a new code box is not colored');
  assert.equal(await pane(page), 'code');
  assert.equal(await language(page), 'Python');
  assert.deepEqual(errors(page), []);
});
