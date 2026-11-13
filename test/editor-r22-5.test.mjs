// the list of backdrops of Media > Backdrop…, on both platforms: the names of the owner for the
// built-in backdrops, the entry Beeson Logo with the backdrop of the title slide of the demo deck, the
// entry Broucke Families with the look of the demo deck and its families, the names of the drawings
// of a deck, an entry whose file is not next to the deck, and the list in one screen at 1280 by 720
// px

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen } from './helpers/editor.mjs';

const DEMO = 'test-deck.html';
const DECK = 'test/pages/editor-r22-5.html';
const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
const TILES = '.beeson-backdrop-gallery [data-tile]';
// the names of the list on the demo deck, whose Broucke drawing is one of the entry Broucke Families
const LIST = [
  'Beeson Logo',
  'Lyapunov Families',
  'Cislunar Manifolds',
  'Earth Manifolds',
  'Broucke Families',
];
const LOGO = '<div class="backdrop" data-trajectories="brand/transfer.js" data-duration="20" data-cx="-0.84" data-cy="0" data-half="1.128">';
const BROUCKE = '<div class="backdrop" data-trajectories="demo/broucke-sample.js" data-trajectories-select="frame=pulsating" data-trajectories-color="family" data-trajectories-ramp="e" data-trajectories-colormap="viridis" data-duration="3" data-stagger="0.6">';
const NEST = '<div class="backdrop" data-backdrop="nest" data-cx="0.97" data-cy="0" data-half="0.5">';

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

let last = null;

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
// the number of trajectories drawn by the backdrop of the current slide, once its file is read
const trajectories = (page) => page.evaluate(`(async () => {
  const el = document.querySelector('section.present .backdrop');
  const o = el && Beeson.backdrops.find((b) => b.el === el);
  if (!o) return -1;
  await o.ready;
  return o.trajectories.length;
})()`);

// the editor on deck at slide n, in a window of size
async function deckPage(platform, deck, n, size) {
  await last?.close().catch(() => {});
  const page = await browser.newPage(size);
  last = page;
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the list opened from Media > Backdrop…, as [key, name, disabled, title, text] per entry, once
// count entries are drawn
async function openList(page, count) {
  await exec(page, 'insert.backdrop');
  await page.waitFor(`document.querySelectorAll('${TILES}').length >= ${count}`);
  await frames(page);
  return page.evaluate(`[...document.querySelectorAll('${TILES}')].map((b) => [b.dataset.tile, b.querySelector('.name').textContent, b.disabled, b.title, b.textContent])`);
}

// a click on the entry key of the open list, after which the file differs from text
async function pick(page, key, text) {
  await click(page, `${TILES}[data-tile="${key}"]`);
  await page.waitFor(`window.BeesonEditor.render() !== ${JSON.stringify(text)}`);
  await frames(page);
}

// the names of the rows Backdrop of the object list on the slides ns
async function rowNames(page, ns) {
  if (!(await state(page, 'view.objects')).checked) await exec(page, 'view.objects');
  const out = [];
  for (const n of ns) {
    await page.evaluate(`Reveal.slide(${n})`);
    await frames(page);
    out.push(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-objects .row')].filter((r) => r.dataset.kind === 'Backdrop').map((r) => r.querySelector('.name').textContent).join()`));
  }
  return out;
}

// the name on the Drawing popup of the pane Backdrop of the backdrop of the current slide
async function paneName(page) {
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await exec(page, 'backdrop.select');
  await frames(page);
  return page.evaluate(`document.querySelector('${PANEL} [aria-label="Drawing"]').textContent`);
}

// the name on the Family popup of the pane Backdrop, once paneName has selected the backdrop
const familyName = (page) => page.evaluate(`document.querySelector('${PANEL} [aria-label="Family"]').textContent`);

// the start tag of the first backdrop after the text heading in text
const tagOf = (text, heading) => text.match(new RegExp(`${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(<div class="backdrop"[^>]*>)`))[1];

for (const platform of PLATFORMS) {
  test(`the list names the drawings as the owner asked, with Beeson Logo and one entry Broucke Families (${platform})`, async () => {
    const page = await deckPage(platform, DEMO, 1);
    const list = await openList(page, LIST.length);
    assert.deepEqual(list.map((e) => e[1]), LIST);
    for (const key of ['logo', 'nest', 'tubes', 'wideRibbon', 'broucke']) assert.ok(list.some((e) => e[0] === key), `the list does not have ${key}`);
    assert.ok(list.every((e) => !e[2]), 'an entry of the demo deck is dimmed');
    assert.ok(list.every((e) => !/broucke-sample|transfer|Nest|Tubes|Ribbon/.test(e[1] + e[3])), 'an entry is named after its file or by its old name');
    // each entry is drawn with its small picture
    await page.waitFor(`[...document.querySelectorAll('${TILES}')].every((b) => b.querySelector('.tile canvas'))`);
    await press(page, 'Escape');
    assert.deepEqual(await rowNames(page, [0, 1, 2, 6, 12]), [
      'Backdrop: Beeson Logo',
      'Backdrop: Broucke Families 7 and 11',
      'Backdrop: Lyapunov Families',
      'Backdrop: Earth Manifolds',
      'Backdrop: Cislunar Manifolds',
    ]);
    await page.evaluate('Reveal.slide(2)');
    assert.equal(await paneName(page), 'Lyapunov Families');
    // the values of data-backdrop stay
    assert.equal(await render(page), page.source);
  });

  test(`Beeson Logo adds the backdrop of the title slide with its attributes and its window (${platform})`, async () => {
    const page = await deckPage(platform, DEMO, 0);
    assert.ok(page.source.includes(`${LOGO}</div>`));
    await exec(page, 'backdrop.select');
    await exec(page, 'element.delete');
    const bare = await render(page);
    assert.ok(!bare.includes(LOGO));
    await openList(page, LIST.length - 1);
    await pick(page, 'logo', bare);
    // the slide is written back as it is in the demo deck
    assert.equal(await render(page), page.source);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Add Backdrop');
    assert.ok((await trajectories(page)) > 100, 'the logo is not drawn');
    await undo(page);
    assert.equal(await render(page), bare);
    await redo(page);
    assert.equal(await render(page), page.source);
  });

  test(`a Broucke entry puts the selection of its family with the frame, the colors, and the window of the demo deck (${platform})`, async () => {
    const page = await deckPage(platform, DEMO, 1);
    assert.equal(await paneName(page), 'Broucke Families');
    assert.equal(await familyName(page), 'Families 7 and 11');
    assert.equal(tagOf(page.source, '<section class="section">'), BROUCKE);
    await openList(page, LIST.length);
    await pick(page, 'broucke', page.source);
    assert.equal(tagOf(await render(page), '<section class="section">'), BROUCKE.replace('frame=pulsating', 'frame=pulsating,family=7'));
    assert.equal(await trajectories(page), 8);
    assert.equal(await paneName(page), 'Broucke Families');
    assert.equal(await familyName(page), 'Family 7');
    await undo(page);
    assert.equal(await render(page), page.source);
    // a family in the inertial frame is chosen in the Family popup of the pane
    await exec(page, 'backdrop.family', { value: 'frame=inertial,family=11' });
    await page.waitFor(`window.BeesonEditor.render() !== ${JSON.stringify(page.source)}`);
    assert.equal(tagOf(await render(page), '<section class="section">'), BROUCKE.replace('frame=pulsating', 'frame=inertial,family=11'));
    assert.equal(await trajectories(page), 8);
    assert.equal(await paneName(page), 'Broucke Families');
    assert.equal(await familyName(page), 'Family 11 (Inertial)');
    await undo(page);
    // in place of a built-in backdrop with a window of its own, the drawing is fitted to its box as in the
    // demo deck, and the labels of the built-in backdrop are taken off
    await page.evaluate('Reveal.slide(2)');
    await frames(page);
    const before = await render(page);
    assert.equal(before, page.source);
    assert.equal(tagOf(before, '<h2>Show your steps one at a time'), NEST);
    await openList(page, LIST.length);
    await pick(page, 'broucke', before);
    const text = await render(page);
    assert.equal(tagOf(text, '<h2>Show your steps one at a time'), '<div class="backdrop" data-trajectories="demo/broucke-sample.js" data-trajectories-select="frame=pulsating,family=7" data-trajectories-color="family" data-trajectories-ramp="e" data-trajectories-colormap="viridis" data-duration="3" data-stagger="0.6">');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Replace Backdrop');
    assert.equal(await trajectories(page), 8);
    await undo(page);
    assert.equal(await render(page), before);
    await redo(page);
    assert.equal(await render(page), text);
    assert.equal((await saveAndReopen(page)).text, text);
  });

  test(`a drawing of a deck is named by its scene, its file, and the families it selects (${platform})`, async () => {
    const page = await deckPage(platform, DECK, 0);
    assert.deepEqual(await rowNames(page, [0, 1, 2, 3, 4, 5]), [
      'Backdrop: Cislunar Manifolds',
      'Backdrop: Broucke Families 7 and 11',
      'Backdrop: Broucke Family 11 (Inertial)',
      'Backdrop: Broucke Family 7',
      'Backdrop: Beeson Logo',
      'Backdrop: missing',
    ]);
  });

  test(`an entry whose file is not next to the deck is left out, and a drawing of the deck with a missing file is dimmed with the reason (${platform})`, async () => {
    const page = await deckPage(platform, DECK, 6);
    const list = await openList(page, 6);
    assert.deepEqual(list.map((e) => e[1]), [
      'Lyapunov Families',
      'Cislunar Manifolds',
      'Earth Manifolds',
      'Broucke Families',
      'Beeson Logo',
      'missing',
    ]);
    assert.deepEqual(list.map((e) => e[2]), [false, false, false, false, false, true]);
    assert.match(list.at(-1)[3], /missing\.js is not found next to the deck/);
    assert.match(list.at(-1)[4], /File not found/);
    // a click on the dimmed entry does not add a backdrop
    await click(page, `${TILES}:disabled`);
    await frames(page);
    assert.equal(await render(page), page.source);
    await press(page, 'Escape');
    // the Drawing popup of the pane has the same entries, with the missing one dimmed
    await page.evaluate('Reveal.slide(1)');
    await frames(page);
    await paneName(page);
    await click(page, `${PANEL} [aria-label="Drawing"]`);
    await page.waitFor(`!!document.querySelector('.beeson-edit-menu.select')`);
    const items = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu.select .item')].map((i) => [i.querySelector('.label')?.textContent ?? i.textContent, i.getAttribute('aria-disabled') === 'true'])`);
    assert.deepEqual(items.map((i) => i[0]), list.map((e) => e[1]));
    assert.deepEqual(items.map((i) => i[1]), list.map((e) => e[2]));
  });

  test(`the list is read in one screen at 1280 by 720 px (${platform})`, async () => {
    const page = await deckPage(platform, DEMO, 1, { width: 1280, height: 720 });
    await openList(page, LIST.length);
    const box = await page.evaluate(`(() => {
      const g = document.querySelector('.beeson-backdrop-gallery');
      const r = g.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, scroll: g.scrollHeight - g.clientHeight };
    })()`);
    assert.ok(box.top >= 0 && box.bottom <= 720 && box.left >= 0 && box.right <= 1280, JSON.stringify(box));
    assert.ok(box.scroll <= 1, `the list scrolls by ${box.scroll} px`);
  });
}
