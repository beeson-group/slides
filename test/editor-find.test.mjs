// find and replace: the pure search of find.ts, and the panel on the demo deck with trusted input
// on either platform. a search gives the count of its matches, Next shows the slide of each match
// and marks it, and Replace All writes each changed block as one entry of the history. after each
// edit an undo gives the file byte for byte, a redo gives the edit, and a save is opened again
// without problems

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { pattern, spans, splice } from '../src/editor/find.ts';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const KEYS = {
  mac: { find: 'Mod+F', next: 'Mod+G', previous: 'Mod+Shift+G', replace: 'Ctrl+H' },
  other: { find: 'Mod+F', next: 'F3', previous: 'Ctrl+Shift+F3', replace: 'Ctrl+H' },
};

const found = (text, query, options = {}) => spans(text, pattern(query, { matchCase: false, wholeWords: false, ...options })).map((s) => text.slice(s.start, s.end));

test('a query matches case, whole words, and white space as asked', () => {
  assert.equal(pattern('', {}), null);
  assert.deepEqual(found('Orbit, orbits, an ORBIT', 'orbit'), ['Orbit', 'orbit', 'ORBIT']);
  assert.deepEqual(found('Orbit, orbits, an ORBIT', 'orbit', { matchCase: true }), ['orbit']);
  assert.deepEqual(found('Orbit, orbits, an ORBIT', 'orbit', { wholeWords: true }), ['Orbit', 'ORBIT']);
  assert.deepEqual(found('the halo\n      orbit', 'halo orbit'), ['halo\n      orbit']);
  assert.deepEqual(found('a (b) [c] \\LL{1} 1.5', '\\LL{1}'), ['\\LL{1}']);
  assert.deepEqual(found('a (b) 1.5 105', '1.5'), ['1.5']);
  assert.deepEqual(found('Erdős erdős', 'ERDŐS', { wholeWords: true }), ['Erdős', 'erdős']);
  assert.deepEqual(found('café_au lait', 'café', { wholeWords: true }), []);
});

test('a replacement is spliced into the piece of a block where its match starts', () => {
  assert.equal(splice('an orbit and an orbit', 0, [{ start: 3, end: 8 }, { start: 16, end: 21 }], 'arc'), 'an arc and an arc');
  // a match that starts in the piece before is only cut from this piece
  assert.equal(splice('bit of', 10, [{ start: 7, end: 13 }], 'arc'), ' of');
  assert.equal(splice('an orb', 0, [{ start: 3, end: 13 }], 'arc'), 'an arc');
  assert.equal(splice('$1 and $&', 0, [{ start: 0, end: 2 }], '$&'), '$& and $&');
});

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

// the editor on the demo deck served over HTTP, where a save is written into the origin private
// file system, with every block paired with the file
async function open(t, platform) {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(`${server.origin}/index.html?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('index.html', 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  return page;
}

// what the panel shows, and the marks of the matches with the slide of the current one
const panel = (page) => page.evaluate(`(() => {
  const p = document.querySelector('.beeson-find');
  const marks = CSS.highlights.get('beeson-find');
  const current = CSS.highlights.get('beeson-find-current');
  const range = current ? [...current][0] : null;
  const slide = Reveal.getCurrentSlide();
  return {
    shown: !p.hidden,
    replacing: p.classList.contains('replacing'),
    count: p.querySelector('.count').textContent,
    focus: document.activeElement?.getAttribute('aria-label') ?? null,
    marks: marks ? marks.size : 0,
    current: range ? range.toString() : null,
    onSlide: range ? slide.contains(range.startContainer) : null,
    inNotes: range ? !!range.startContainer.parentElement.closest('aside.notes') : null,
    slide: Reveal.getIndices().h,
  };
})()`);

const rendered = (page) => page.evaluate('window.BeesonEditor.render()');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);

for (const platform of PLATFORMS) {
  const keys = KEYS[platform];

  test(`a search for orbit gives its count and Next shows each match on ${platform}`, async (t) => {
    const page = await open(t, platform);
    assert.equal(page.source.match(/orbit/gi).length, 2);
    await press(page, keys.find);
    let p = await panel(page);
    assert.equal(p.shown, true);
    assert.equal(p.focus, 'Find');
    await type(page, 'orbit');
    p = await panel(page);
    // both matches are in the notes of the slide of the video, which is shown with its notes
    assert.equal(p.count, '1 of 2');
    assert.equal(p.current, 'orbit');
    assert.equal(p.onSlide, true);
    assert.equal(p.inNotes, true);
    assert.equal(p.marks, 1);
    assert.equal(p.focus, 'Find');
    const slide = p.slide;
    await press(page, 'Enter');
    assert.deepEqual([(await panel(page)).count, (await panel(page)).slide], ['2 of 2', slide]);
    await press(page, keys.next);
    assert.equal((await panel(page)).count, '1 of 2');
    await press(page, keys.previous);
    assert.equal((await panel(page)).count, '2 of 2');
    await press(page, 'Shift+Enter');
    p = await panel(page);
    assert.equal(p.count, '1 of 2');
    assert.equal(p.focus, 'Find');
    // Esc closes the panel and selects the match in its block, which takes the focus
    await press(page, 'Escape');
    p = await panel(page);
    assert.equal(p.shown, false);
    assert.equal(p.marks, 0);
    assert.equal(await page.evaluate('getSelection().toString()'), 'orbit');
    assert.equal(await page.evaluate(`document.activeElement.matches('aside.notes')`), true);
    // Find Next with the panel closed selects the next match
    const first = await page.evaluate('getSelection().anchorOffset');
    await press(page, keys.next);
    assert.equal(await page.evaluate('getSelection().toString()'), 'orbit');
    assert.ok((await page.evaluate('getSelection().anchorOffset')) > first);
    assert.equal(await rendered(page), page.source);
    assert.deepEqual(page.errors, []);
  });

  test(`Next shows the slide of every match across the deck on ${platform}`, async (t) => {
    const page = await open(t, platform);
    await page.evaluate(`window.BeesonEditor.exec('find.open', 'Slide')`);
    const total = Number((await panel(page)).count.split(' of ')[1]);
    assert.ok(total > 5, `only ${total} matches of slide`);
    const seen = new Set();
    for (let i = 0; i < total; i++) {
      await click(page, '.beeson-find [aria-label="Next"]');
      const p = await panel(page);
      assert.equal(p.count, `${((i + 1) % total) + 1} of ${total}`);
      assert.equal(p.current.toLowerCase(), 'slide');
      assert.equal(p.onSlide, true, `the match ${p.count} is not on the slide shown`);
      seen.add(p.slide);
    }
    assert.ok(seen.size > 3, `the matches were shown on ${seen.size} slides`);
    // Whole Words and Match Case are set in the gear menu, and each narrows the count
    await click(page, '.beeson-find .gear');
    await click(page, '.beeson-edit-menu.find-options [data-command="find.wholeWords"]');
    const words = Number((await panel(page)).count.split(' of ')[1]);
    assert.ok(words < total && words > 0, `${words} whole words of ${total}`);
    assert.equal((await page.evaluate(`window.BeesonEditor.state('find.wholeWords')`)).checked, true);
    await page.evaluate(`window.BeesonEditor.exec('find.matchCase')`);
    const cased = (await panel(page)).count;
    assert.ok(cased === 'Not found' || Number(cased.split(' of ')[1]) < words, cased);
    assert.deepEqual(page.errors, []);
  });

  test(`Replace All writes each changed block and is undone as one entry on ${platform}`, async (t) => {
    const page = await open(t, platform);
    await press(page, keys.replace);
    let p = await panel(page);
    assert.equal(p.replacing, true);
    assert.equal(p.focus, 'Find');
    await type(page, 'manifold');
    await click(page, '.beeson-find .replace input');
    await type(page, 'tube');
    const changed = page.source.replaceAll('manifold', 'tube');
    assert.equal((await panel(page)).count, '1 of 2');
    const shown = (await panel(page)).slide;
    await click(page, '.beeson-find .actions button:first-child');
    await page.waitFor(`window.BeesonEditor.render() !== ${JSON.stringify(page.source)}`);
    assert.equal(await rendered(page), changed);
    assert.equal((await panel(page)).count, '2 replaced');
    // the slide shown before Replace All stays shown, although the last block written is on another
    assert.equal((await panel(page)).slide, shown);
    assert.equal(await undoLabel(page), 'Undo Replace All');
    // the matches of the second search were written by the first, as one entry of the history
    await press(page, 'Mod+Z');
    await page.waitFor('!window.BeesonEditor.status().undo');
    assert.equal(await rendered(page), page.source);
    await press(page, platform === 'mac' ? 'Mod+Shift+Z' : 'Mod+Y');
    await page.waitFor('!window.BeesonEditor.status().redo');
    assert.equal(await rendered(page), changed);
    const { text } = await saveAndReopen(page, `find-all-${platform}.html`);
    assert.equal(text, changed);
    assert.deepEqual(page.errors, []);
  });

  test(`Replace and Replace & Find change one match each on ${platform}`, async (t) => {
    const page = await open(t, platform);
    await page.evaluate(`window.BeesonEditor.exec('find.replace', 'orbit')`);
    await page.evaluate(`document.querySelector('.beeson-find .replace input').focus()`);
    await type(page, 'path');
    assert.equal((await panel(page)).count, '1 of 2');
    await press(page, 'Enter');
    await page.waitFor(`window.BeesonEditor.render() !== ${JSON.stringify(page.source)}`);
    const one = page.source.replace('orbit', 'path');
    assert.equal(await rendered(page), one);
    assert.deepEqual([(await panel(page)).count, (await panel(page)).focus], ['1 of 1', 'Replace with']);
    assert.equal(await undoLabel(page), 'Undo Replace & Find');
    await page.evaluate(`window.BeesonEditor.exec('find.replaceOne')`);
    const both = one.replace('orbit', 'path');
    assert.equal(await rendered(page), both);
    assert.equal((await panel(page)).count, 'Not found');
    assert.equal(await undoLabel(page), 'Undo Replace');
    await page.evaluate('window.BeesonEditor.undo()');
    assert.equal(await rendered(page), one);
    await page.evaluate('window.BeesonEditor.undo()');
    assert.equal(await rendered(page), page.source);
    await page.evaluate('window.BeesonEditor.redo()');
    await page.evaluate('window.BeesonEditor.redo()');
    assert.equal(await rendered(page), both);
    await saveAndReopen(page, `find-one-${platform}.html`);
    assert.deepEqual(page.errors, []);
  });
}

test('the TeX of the formulas is searched and replaced only with its switch', async (t) => {
  const page = await open(t, 'mac');
  await page.evaluate(`window.BeesonEditor.exec('find.replace', '\\\\LL{1}')`);
  assert.equal((await panel(page)).count, 'Not found');
  await page.evaluate(`window.BeesonEditor.exec('find.tex')`);
  const p = await panel(page);
  assert.equal(p.count, `1 of ${page.source.split('\\LL{1}').length - 1}`);
  assert.equal(await page.evaluate(`document.querySelectorAll('mjx-container.beeson-find-math').length`), page.source.split('\\LL{1}').length - 1);
  assert.equal(await page.evaluate(`document.querySelectorAll('mjx-container.beeson-find-math.current').length`), 1);
  await page.evaluate(`document.querySelector('.beeson-find .replace input').focus()`);
  await type(page, '\\LL{2}');
  await page.evaluate(`window.BeesonEditor.exec('find.replaceAll')`);
  const changed = page.source.replaceAll('\\LL{1}', '\\LL{2}');
  assert.equal(await rendered(page), changed);
  await page.evaluate('window.BeesonEditor.undo()');
  assert.equal(await rendered(page), page.source);
  await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await rendered(page), changed);
  await saveAndReopen(page, 'find-tex.html');
  assert.deepEqual(page.errors, []);
});

test('the count follows the typing in a block and an undo while the panel is open', async (t) => {
  const page = await open(t, 'other');
  await page.evaluate(`window.BeesonEditor.exec('find.open', 'orbit')`);
  assert.equal((await panel(page)).count, '1 of 2');
  await click(page, '.reveal section.present > h2');
  await press(page, 'End');
  await type(page, ' orbit');
  await page.waitFor(`document.querySelector('.beeson-find .count').textContent.endsWith(' of 3')`);
  assert.equal((await panel(page)).marks, 2);
  await press(page, 'Mod+Z');
  await page.waitFor('!window.BeesonEditor.status().undo');
  await page.waitFor(`document.querySelector('.beeson-find .count').textContent.endsWith(' of 2')`);
  assert.equal(await rendered(page), page.source);
  assert.deepEqual(page.errors, []);
});
