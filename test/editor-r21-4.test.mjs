// regression tests of R21.4 on both platforms, for the findings V14, V15 with V21, and V18 of the
// review of round 8, and for Edit > Duplicate of the menu in a line of the outline: a dimmed step
// in the presenter display and in Preview Transition, the marks of a centered list, the Control
// keys of a Mac in a line of the outline, and the typed text of a line kept by a copy of its slide

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const SLIDE = '.reveal .slides > section.present';
const GHOST = '0.25';

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
const wait = (page, ms = 300) => page.evaluate(`new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), ${ms}))`);
const exec = (page, id) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)})).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const labels = async (page) => [(await state(page, 'edit.undo')).label, (await state(page, 'edit.redo')).label];

async function load(t, platform, deck, slide = 0) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${slide})`);
  await wait(page);
  return page;
}

// the computed opacity of the paragraph that starts with each of words, in the clone drawn into
// the first element that matches host
const opacities = (page, host, words) => page.evaluate(`(() => {
  const root = document.querySelector(${js(host)})?.shadowRoot;
  if (!root) return null;
  return ${js(words)}.map((w) => { const p = [...root.querySelectorAll('p')].find((e) => e.textContent.startsWith(w)); return p ? getComputedStyle(p).opacity : null; });
})()`);

// V14. on slide 3 of the fixture of R20.8, Zeta is a step set to Dim at index 1, which the show
// draws at the ghost opacity from its step on. Eta and Theta are plain steps after it
for (const platform of PLATFORMS) {
  test(`V14 ${platform}: the presenter display draws a step set to Dim at the ghost opacity from its step on`, async (t) => {
    const page = await load(t, platform, 'test/pages/editor-r20-8.html', 2);
    await page.evaluate('(() => { window.open = () => null; return true; })()');
    await press(page, 'Alt+Enter');
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter[open] .shot.current .pic')`, 20000);
    const current = [];
    const next = [];
    for (let k = 0; k < 4; k++) {
      await wait(page, 400);
      current.push(await opacities(page, 'dialog.beeson-edit-presenter[open] .shot.current .pic', ['Zeta', 'Eta']));
      next.push(await opacities(page, 'dialog.beeson-edit-presenter[open] .shot.next .pic', ['Zeta']));
      await press(page, 'ArrowRight');
    }
    assert.deepEqual(current.map((s) => s[0]), ['1', GHOST, GHOST, GHOST], 'Zeta on the current slide');
    // a plain step before the last shown one is still dimmed to 0.45, as in the show
    assert.deepEqual(current.map((s) => s[1]), ['1', '1', '1', '0.45'], 'Eta on the current slide');
    assert.equal(next[0][0], GHOST, 'Zeta on the next step');
    assert.deepEqual(errors(page), []);
  });

  test(`V14 ${platform}: Preview Transition draws a step set to Dim at the ghost opacity on the slide it leaves`, async (t) => {
    const page = await load(t, platform, 'test/pages/editor-r20-8.html', 2);
    await exec(page, 'slide.previewTransition');
    await page.waitFor(`document.querySelector('.beeson-edit-preview')?.dataset.phase === 'play'`, 10000);
    assert.deepEqual(await opacities(page, '.beeson-edit-preview .shot', ['Zeta', 'Eta', 'Theta']), [GHOST, '1', '1']);
    await press(page, 'Escape');
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}

// the left of the mark, of the first words, and of the box of each item of the n-th list of the
// slide, the right of the box, and the width of the list, in slide px from the left of the list. the mark is the
// ::before of its item, placed from the left of the item
const marks = (page, n) => page.evaluate(`(() => {
  const list = document.querySelectorAll('${SLIDE} > :is(ul, ol)')[${n}];
  const box = list.getBoundingClientRect();
  const scale = box.width / list.offsetWidth;
  return [...list.children].map((li) => {
    const r = li.getBoundingClientRect();
    const node = li.firstChild;
    const range = document.createRange();
    range.setStart(node, node.data.length - node.data.trimStart().length);
    range.setEnd(node, node.data.trimEnd().length);
    const words = range.getBoundingClientRect();
    const at = (x) => Math.round((x - box.left) / scale);
    return { mark: at(r.left) + parseFloat(getComputedStyle(li, '::before').left), words: at(words.left), left: at(r.left), right: at(r.right), width: Math.round(box.width / scale) };
  });
})()`);

// V15 and V21. each mark of a centered list is drawn beside the words of its item, at the distance
// of an uncentered list, and the item with its mark is centered on the list. the four lists of
// slide 1 of the fixture of R20.4 are a list of dashes, of dots, of arrows, and of numbers
const KINDS = [['dashes', '<ul class="center">\n    <li>Alpha'], ['dots', '<ul class="dots center">'], ['arrows', '<ul class="arrows center">'], ['numbers', '<ol start="4" class="center">']];
for (const platform of PLATFORMS) {
  test(`V15 ${platform}: Center draws the mark of each item of a list of dashes, dots, arrows, or numbers beside its centered words`, async (t) => {
    const page = await load(t, platform, 'test/pages/editor-r20-4.html');
    for (const [n, [kind, written]] of KINDS.entries()) {
      const before = await marks(page, n);
      await page.evaluate(`(() => { const li = document.querySelectorAll('${SLIDE} > :is(ul, ol)')[${n}].querySelector('li'); li.focus(); getSelection().collapse(li.firstChild, 1); return true; })()`);
      await wait(page, 100);
      await exec(page, 'text.align.center');
      await wait(page);
      assert.ok((await render(page)).includes(written), `${kind}: the list is not written with the class center`);
      for (const [i, m] of (await marks(page, n)).entries()) {
        // an item that holds a nested list is as wide as the nested list, and its words are centered in it
        assert.ok(Math.abs(m.words - m.mark - (before[i].words - before[i].mark)) <= 2, `${kind}, item ${i + 1}: the mark at ${js(m)} is not beside its words`);
        assert.ok(Math.abs(m.left + m.right - m.width) <= 2 && m.left > 0, `${kind}, item ${i + 1}: the item at ${js(m)} is not centered on the list`);
      }
    }
    for (let i = 0; i < KINDS.length; i++) await undo(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}

// the caret after the fourth character of the line of the outline that starts with Each step, on
// slide 3 of the demo deck
async function outlineLine(t, platform) {
  const page = await load(t, platform, 'index.html', 2);
  await exec(page, 'view.outline');
  await wait(page);
  const at = await page.evaluate(`(() => { const t = [...document.querySelectorAll('.beeson-edit-outline .text')].find((e) => e.textContent.startsWith('Each step')); t.scrollIntoView({ block: 'center' }); const r = t.getBoundingClientRect(); return { x: r.left + 30, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await wait(page);
  await page.evaluate(`(() => { const w = document.createTreeWalker(document.activeElement, NodeFilter.SHOW_TEXT); getSelection().collapse(w.nextNode(), 4); return true; })()`);
  return page;
}

// a press of Control with letter as a keyboard of a Mac sends it, with the commands of the text
// system of macOS that Chrome runs when the key is not prevented
async function control(page, letter, commands) {
  const base = { key: letter, code: `Key${letter.toUpperCase()}`, windowsVirtualKeyCode: letter.toUpperCase().charCodeAt(0), modifiers: 2 };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base, commands });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await wait(page);
}
const line = (page) => page.evaluate(`(() => { const a = document.activeElement; const s = getSelection(); return { outline: !!a?.closest('.beeson-edit-outline'), text: a?.textContent.slice(0, 12), off: s.focusOffset, slides: document.querySelectorAll('.reveal .slides > section').length, undo: window.BeesonEditor.state('edit.undo').label }; })()`);

// V18. on a Mac, Control with a letter in a line of the outline is left to the text of the line
// Control-D deletes forward, which is typing, as in a text of a slide
for (const [letter, commands, text, off, undo] of [['d', ['deleteForward'], 'Eachstep is ', 4, 'Undo Typing'], ['b', ['moveBackward'], 'Each step is', 3, 'Undo'], ['f', ['moveForward'], 'Each step is', 5, 'Undo']]) {
  test(`V18 mac: Ctrl+${letter.toUpperCase()} in a line of the outline runs the key of the text and not a command`, async (t) => {
    const page = await outlineLine(t, 'mac');
    await control(page, letter, commands);
    assert.deepEqual(await line(page), { outline: true, text, off, slides: 12, undo });
    assert.deepEqual(errors(page), []);
  });
}

// elsewhere Control is the command modifier, and Ctrl+D in a line still duplicates the slide
test('V18 other: Ctrl+D in a line of the outline duplicates the slide', async (t) => {
  const page = await outlineLine(t, 'other');
  await control(page, 'd', []);
  await wait(page, 300);
  assert.equal((await line(page)).slides, 13);
  assert.equal((await labels(page))[0], 'Undo Duplicate Slide');
  assert.deepEqual(errors(page), []);
});

const slidesWith = (page, word) => page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].map((s, i) => s.textContent.includes(${js(word)}) ? i : -1).filter((i) => i >= 0)`);
const middle = (page, expr) => page.evaluate(`(() => { const r = (${expr}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

// Edit > Duplicate of the menu bar in a line of the outline writes the typed text of the line
// first, as Mod+D does there, and the copy of the slide holds the text
for (const platform of PLATFORMS) {
  test(`Duplicate ${platform}: Edit > Duplicate of the menu in a line of the outline copies the slide with the typed text`, async (t) => {
    const page = await outlineLine(t, platform);
    await type(page, 'XYZ ');
    await wait(page);
    await click(page, await middle(page, `[...document.querySelectorAll('.beeson-edit-menubar button')].find((x) => x.textContent === 'Edit')`));
    await wait(page, 100);
    await click(page, await middle(page, `[...document.querySelectorAll('.beeson-edit-menu .item')].find((x) => x.querySelector('.label')?.textContent === 'Duplicate')`));
    await wait(page, 500);
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal .slides > section').length`), 13);
    assert.deepEqual(await slidesWith(page, 'XYZ'), [2, 3]);
    assert.equal((await render(page)).match(/XYZ/g)?.length, 2);
    assert.deepEqual(await labels(page), ['Undo Duplicate Slide', 'Redo']);
    await undo(page);
    await wait(page, 300);
    assert.deepEqual(await slidesWith(page, 'XYZ'), [2]);
    assert.equal((await labels(page))[0], 'Undo Typing');
    await undo(page);
    await wait(page, 300);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}
