import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const DARK = '<img class="for-dark" src="../../demo/figure-dark.png" alt="A figure, dark version">';
const IMG = 'section.present figure.figure-box img.for-dark';

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

const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const typeset = (page) => page.evaluate('window.MathJax.startup.promise.then(() => true)');

const heads = (page) => page.evaluate(`(() => {
  const read = (el) => {
    const copy = el.cloneNode(true);
    for (const m of copy.querySelectorAll('mjx-container')) m.replaceWith('[math]');
    return copy.textContent.trim();
  };
  const run = Reveal.getCurrentSlide().querySelector(':scope > .run[data-generated]');
  const item = document.querySelector('section.section ul.outline li');
  return { run: read(run), outline: read(item) };
})()`);
const TYPESET = { run: 'Content [math]', outline: 'Content' };

async function settle(page) {
  await frames(page);
  await typeset(page);
  await frames(page);
}

async function open(t, platform) {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(`${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(LAYOUTS, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate('Reveal.slide(3)');
  await settle(page);
  return page;
}

for (const platform of PLATFORMS) {
  test(`the running head keeps its typeset title after an edit of a tag, its undo, and its redo (${platform})`, async (t) => {
    const page = await open(t, platform);
    assert.deepEqual(await heads(page), TYPESET);
    await click(page, 'section.present p');
    await click(page, IMG);
    await click(page, IMG);
    await page.evaluate(`window.BeesonEditor.exec('figure.whiteFigure')`);
    await settle(page);
    const edited = await render(page);
    assert.equal(edited, page.source.replace(DARK, () => DARK.replace('class="for-dark"', 'class="for-dark white-figure"')));
    assert.deepEqual(await heads(page), TYPESET);
    await page.evaluate('window.BeesonEditor.undo()');
    await settle(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(await heads(page), TYPESET);
    await page.evaluate('window.BeesonEditor.redo()');
    await settle(page);
    assert.equal(await render(page), edited);
    assert.deepEqual(await heads(page), TYPESET);
    const { text } = await saveAndReopen(page);
    assert.equal(text, edited);
    assert.deepEqual(await heads(page), TYPESET);
    assert.deepEqual(page.errors, []);
  });
}

const DECK = 'test-deck.html';

async function openDeck(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close());
  await page.goto(`${server.origin}/${DECK}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`)).problems, []);
  const at = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('.sec h2')?.textContent === 'Chapter one')`);
  assert.ok(at > 0, 'the section slide Chapter one is not found');
  await page.evaluate(`Reveal.slide(${at})`);
  await settle(page);
  return page;
}

const outlines = (page) => page.evaluate(`[...document.querySelectorAll('.reveal .outline')].map((l) => l.localName + ': ' + [...l.children].map((li) => li.textContent + (li.classList.contains('now') ? '*' : '')).join(' | '))`);
const marks = (page) => page.evaluate(`(() => {
  const tone = (v) => { const p = document.createElement('p'); p.style.color = 'var(' + v + ')'; document.querySelector('.reveal section.present').append(p); const c = getComputedStyle(p).color; p.remove(); return c; };
  return { text: tone('--text'), violet: tone('--violet'), items: [...document.querySelectorAll('.reveal section.present .outline > li')].map((li) => {
    const s = getComputedStyle(li, '::before');
    return { content: s.content, color: s.color, background: s.backgroundColor, clip: s.clipPath !== 'none', width: s.width, height: s.height };
  }) };
})()`);

for (const platform of PLATFORMS) {
  test(`an outline list is numbered in the color of the text as an ol and has violet bullets as a ul, and Numbers and Bullets switch every outline list of the deck (${platform})`, async (t) => {
    const page = await openDeck(t, platform);
    assert.deepEqual(await outlines(page), ['ul: Chapter one* | Chapter two', 'ul: Chapter one | Chapter two*']);
    const bullets = await marks(page);
    assert.equal(bullets.items.length, 2);
    for (const m of bullets.items) assert.deepEqual({ background: m.background, clip: m.clip, width: m.width, height: m.height }, { background: bullets.violet, clip: true, width: '12px', height: '18px' }, 'an item of a ul is not marked with a violet chevron');

    await click(page, 'section.present .outline li:nth-child(2)');
    assert.deepEqual(await page.evaluate(`window.BeesonEditor.selection().map((el) => el.className)`), ['outline']);
    assert.equal((await page.evaluate(`window.BeesonEditor.state('text.list.none')`)).enabled, false, 'Paragraphs would write the items of an outline list into the file');
    await page.evaluate(`window.BeesonEditor.exec('text.list.ol')`);
    await settle(page);
    const numbered = await render(page);
    assert.equal(numbered, page.source.replaceAll('<ul class="outline" data-auto></ul>', '<ol class="outline" data-auto></ol>'));
    assert.deepEqual(await outlines(page), ['ol: Chapter one* | Chapter two', 'ol: Chapter one | Chapter two*']);
    const numbers = await marks(page);
    assert.deepEqual(numbers.items.map((m) => [m.content, m.color]), [['counter(list-item)', numbers.text], ['counter(list-item)', numbers.text]]);

    await page.evaluate('window.BeesonEditor.undo()');
    await settle(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(await outlines(page), ['ul: Chapter one* | Chapter two', 'ul: Chapter one | Chapter two*']);
    await page.evaluate('window.BeesonEditor.redo()');
    await settle(page);
    assert.equal(await render(page), numbered);
    const { text } = await saveAndReopen(page);
    assert.equal(text, numbered);
    assert.deepEqual(page.errors, []);
  });

  test(`a click on an item of a selected outline list renames its section, and every outline list follows (${platform})`, async (t) => {
    const page = await openDeck(t, platform);
    await click(page, 'section.present .outline li:nth-child(2)');
    await click(page, 'section.present .outline li:nth-child(2)');
    await page.waitFor(`document.activeElement?.matches('input.beeson-outline-field')`);
    assert.equal(await page.evaluate('document.activeElement.value'), 'Chapter two');
    await page.evaluate('document.activeElement.select()');
    await type(page, 'Chapter 2 & more');
    await press(page, 'Enter');
    await settle(page);
    const renamed = await render(page);
    assert.equal(renamed, page.source.replace('<h2>Chapter two</h2>', '<h2>Chapter 2 &amp; more</h2>'));
    assert.deepEqual(await outlines(page), ['ul: Chapter one* | Chapter 2 & more', 'ul: Chapter one | Chapter 2 & more*']);
    assert.equal(await page.evaluate(`document.querySelector('input.beeson-outline-field')`), null);

    await click(page, 'section.present .outline li:nth-child(1)');
    await page.waitFor(`document.activeElement?.matches('input.beeson-outline-field')`);
    await type(page, 'ignored');
    await press(page, 'Escape');
    await settle(page);
    assert.equal(await render(page), renamed);

    await page.evaluate('window.BeesonEditor.undo()');
    await settle(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(await outlines(page), ['ul: Chapter one* | Chapter two', 'ul: Chapter one | Chapter two*']);
    assert.deepEqual(page.errors, []);
  });

  test(`the outline lists show the heading of a section with a running head, and follow its typing (${platform})`, async (t) => {
    const page = await open(t, platform);
    await page.evaluate('Reveal.slide(1)');
    await settle(page);
    await click(page, 'section.present .sec h2');
    await click(page, 'section.present .sec h2');
    await press(page, 'End');
    await type(page, 's');
    await settle(page);
    await page.evaluate('Reveal.slide(3)');
    await settle(page);
    assert.deepEqual(await heads(page), { run: 'Content [math]', outline: 'Contents' });
    assert.deepEqual(page.errors, []);
  });
}
