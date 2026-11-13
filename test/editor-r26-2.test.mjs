// the list of backdrops of R26.2 on both platforms: one entry Broucke Families with the family
// chosen in a Family popup of the Backdrop pane, the names of the colormaps in title case, the labels
// of a built-in backdrop taken off when a drawing of a file is put in its place, and the Backdrop pane built
// again when the drawing changes between a built-in backdrop and a file

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen } from './helpers/editor.mjs';

const DEMO = 'test-deck.html';
const DECK = 'test/pages/editor-r22-5.html';
// a deck of the selections of demo/broucke-sample.js and of drawings with more attributes than an entry
const SELECTIONS = 'test/pages/editor-r26-2.html';
const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
const TILES = '.beeson-backdrop-gallery [data-tile]';
const MENU = '.beeson-edit-menu.select';
// the entries of the list on the demo deck
const LIST = ['Beeson Logo', 'Lyapunov Families', 'Cislunar Manifolds', 'Earth Manifolds', 'Broucke Families'];
// the families of demo/broucke-sample.js in the Family popup, before the drawings of the deck
const FAMILIES = ['Family 7', 'Family 7 (Inertial)', 'Family 11', 'Family 11 (Inertial)'];
const BROUCKE = '<div class="backdrop" data-trajectories="demo/broucke-sample.js" data-trajectories-select="frame=pulsating" data-trajectories-color="family" data-trajectories-ramp="e" data-trajectories-colormap="viridis" data-duration="3" data-stagger="0.6">';
const STEPS = '<h2>Show your steps one at a time';

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
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg ? `, ${js(arg)}` : ''})).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');

// the editor on deck at slide n, with the storage of the origin emptied
async function load(t, platform, deck, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the backdrop of the current slide selected, with the Format panel shown
async function selectBackdrop(page) {
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await exec(page, 'backdrop.select');
  await frames(page);
}

// the text of the popup of the pane named label, or null when the popup is not shown
const popupText = (page, label) => page.evaluate(`(() => {
  const b = document.querySelector('${PANEL} [aria-label="${label}"]');
  return b && b.getClientRects().length ? b.textContent : null;
})()`);

// the items of the popup of the pane named label, opened by a click, as [name, checked]
async function popupItems(page, label) {
  await click(page, `${PANEL} [aria-label="${label}"]`);
  await page.waitFor(`!!document.querySelector('${MENU}')`);
  return page.evaluate(`[...document.querySelectorAll('${MENU} .item')].map((i) => [i.querySelector('.label')?.textContent ?? i.textContent, i.getAttribute('aria-checked') === 'true'])`);
}

// a click on the item called name of the open popup, after which the file differs from text
async function choose(page, name, text) {
  await page.evaluate(`[...document.querySelectorAll('${MENU} .item')].find((i) => (i.querySelector('.label')?.textContent ?? i.textContent) === ${js(name)}).setAttribute('data-pick', '')`);
  await click(page, `${MENU} .item[data-pick]`);
  if (text !== undefined) await page.waitFor(`window.BeesonEditor.render() !== ${js(text)}`);
  await frames(page);
}

// the list of Media > Backdrop…, as [key, name] per entry, once count entries are drawn
async function openList(page, count) {
  await exec(page, 'insert.backdrop');
  await page.waitFor(`document.querySelectorAll('${TILES}').length >= ${count}`);
  await frames(page);
  return page.evaluate(`[...document.querySelectorAll('${TILES}')].map((b) => [b.dataset.tile, b.querySelector('.name').textContent])`);
}

// a click on the entry called name of the open list, after which the file differs from text
async function pick(page, name, text) {
  await page.evaluate(`[...document.querySelectorAll('${TILES}')].find((b) => b.querySelector('.name').textContent === ${js(name)}).setAttribute('data-pick', '')`);
  await click(page, `${TILES}[data-pick]`);
  await page.waitFor(`window.BeesonEditor.render() !== ${js(text)}`);
  await frames(page);
}

// the start tag of the first backdrop after heading in text, and that backdrop with its children
const tagOf = (text, heading) => text.match(new RegExp(`${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(<div class="backdrop"[^>]*>)`))[1];
const backdropOf = (text, heading) => text.match(new RegExp(`${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(<div class="backdrop"[\\s\\S]*?</div>)`))[1];

// the titles of the shown sections of the Backdrop pane, and whether its Colormap and Family popups
// and its note on the data-trajectories attributes are shown
const sections = (page) => page.evaluate(`(() => {
  const shown = (el) => !!el && el.getClientRects().length > 0;
  const secs = [...document.querySelectorAll('${PANEL} .ed-sec')].filter(shown).map((s) => s.querySelector(':scope > h5')?.textContent ?? '').filter(Boolean);
  const note = [...document.querySelectorAll('${PANEL} .ed-note')].some((n) => shown(n) && /data-trajectories/.test(n.textContent));
  return { secs, colormap: shown(document.querySelector('${PANEL} [aria-label="Colormap"]')), family: shown(document.querySelector('${PANEL} [aria-label="Family"]')), note };
})()`);

for (const platform of PLATFORMS) {
  // item 1
  test(`the list and the Drawing popup have one entry Broucke Families, checked for a backdrop of any family (${platform})`, async (t) => {
    const page = await load(t, platform, DEMO, 1);
    const list = await openList(page, LIST.length);
    assert.deepEqual(list.map((e) => e[1]), LIST);
    await press(page, 'Escape');
    await selectBackdrop(page);
    assert.equal(await popupText(page, 'Drawing'), 'Broucke Families');
    const items = await popupItems(page, 'Drawing');
    assert.deepEqual(items.map((i) => i[0]), LIST);
    assert.deepEqual(items.filter((i) => i[1]).map((i) => i[0]), ['Broucke Families']);
    await press(page, 'Escape');
    // a deck whose drawings select single families has the same one entry
    const deck = await load(t, platform, DECK, 6);
    const names = (await openList(deck, 6)).map((e) => e[1]);
    assert.deepEqual(names, ['Lyapunov Families', 'Cislunar Manifolds', 'Earth Manifolds', 'Broucke Families', 'Beeson Logo', 'missing']);
    await press(deck, 'Escape');
    await deck.evaluate('Reveal.slide(3)');
    await frames(deck);
    await selectBackdrop(deck);
    assert.equal(await popupText(deck, 'Drawing'), 'Broucke Families');
    assert.equal(await popupText(deck, 'Family'), 'Family 7');
    assert.deepEqual((await popupItems(deck, 'Drawing')).filter((i) => i[1]).map((i) => i[0]), ['Broucke Families']);
  });

  test(`the Family popup beside Colormap lists the families of the file with the family of the backdrop checked, and a choice is one entry of the history (${platform})`, async (t) => {
    const page = await load(t, platform, DEMO, 1);
    await selectBackdrop(page);
    assert.equal(await popupText(page, 'Family'), 'Families 7 and 11');
    const items = await popupItems(page, 'Family');
    assert.deepEqual(items.map((i) => i[0]), [...FAMILIES, 'Families 7 and 11', 'Families 7 and 11 (Inertial)']);
    assert.deepEqual(items.filter((i) => i[1]).map((i) => i[0]), ['Families 7 and 11']);
    await choose(page, 'Family 11 (Inertial)', page.source);
    const text = await render(page);
    assert.equal(tagOf(text, '<section class="section">'), BROUCKE.replace('frame=pulsating', 'frame=inertial,family=11'));
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Family');
    assert.equal(await popupText(page, 'Family'), 'Family 11 (Inertial)');
    assert.equal(await popupText(page, 'Drawing'), 'Broucke Families');
    assert.deepEqual((await popupItems(page, 'Family')).filter((i) => i[1]).map((i) => i[0]), ['Family 11 (Inertial)']);
    await press(page, 'Escape');
    await undo(page);
    assert.equal(await render(page), page.source);
    await redo(page);
    assert.equal(await render(page), text);
    assert.equal((await saveAndReopen(page)).text, text);
  });

  test(`Broucke Families put on a scene draws the first family, and on a backdrop of a family keeps its family (${platform})`, async (t) => {
    const page = await load(t, platform, DEMO, 2);
    await selectBackdrop(page);
    await popupItems(page, 'Drawing');
    await choose(page, 'Broucke Families', page.source);
    const text = await render(page);
    assert.match(tagOf(text, STEPS), /data-trajectories="demo\/broucke-sample\.js" data-trajectories-select="frame=pulsating,family=7"/);
    assert.doesNotMatch(backdropOf(text, STEPS), /class="label"/);
    assert.equal(await popupText(page, 'Family'), 'Family 7');
    assert.equal(await popupText(page, 'Colormap'), 'Viridis');
    await undo(page);
    assert.equal(await render(page), page.source);
    // from the list of Media > Backdrop…, the first family with the look of the demo deck
    await openList(page, LIST.length);
    await pick(page, 'Broucke Families', page.source);
    assert.equal(tagOf(await render(page), STEPS), BROUCKE.replace('frame=pulsating', 'frame=pulsating,family=7'));
    await undo(page);
    // on the backdrop of the demo deck, the entry that is checked already changes nothing
    await page.evaluate('Reveal.slide(1)');
    await frames(page);
    await selectBackdrop(page);
    await popupItems(page, 'Drawing');
    await choose(page, 'Broucke Families');
    assert.equal(await render(page), page.source);
  });

  // item 2
  test(`the Colormap popup names the colormaps in title case and writes their values (${platform})`, async (t) => {
    const page = await load(t, platform, DEMO, 1);
    await selectBackdrop(page);
    assert.equal(await popupText(page, 'Colormap'), 'Viridis');
    const items = await popupItems(page, 'Colormap');
    assert.deepEqual(items.map((i) => i[0]), ['Palette', 'Viridis', 'Plasma', 'Blues (Reversed)']);
    assert.deepEqual(items.filter((i) => i[1]).map((i) => i[0]), ['Viridis']);
    await choose(page, 'Blues (Reversed)', page.source);
    const text = await render(page);
    assert.equal(tagOf(text, '<section class="section">'), BROUCKE.replace('"viridis"', '"Blues_r"'));
    assert.equal(await popupText(page, 'Colormap'), 'Blues (Reversed)');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Colormap');
    await popupItems(page, 'Colormap');
    await choose(page, 'Palette', text);
    assert.ok(!tagOf(await render(page), '<section class="section">').includes('data-trajectories-colormap'));
    assert.equal(await popupText(page, 'Colormap'), 'Palette');
    await undo(page);
    await undo(page);
    assert.equal(await render(page), page.source);
  });

  // item 3
  test(`a drawing of a file put in place of a scene takes off the labels of the scene in the same entry (${platform})`, async (t) => {
    const page = await load(t, platform, DEMO, 2);
    const LOGO = /^<div class="backdrop"[^>]*data-trajectories="brand\/transfer\.js"[^>]*>\s*<\/div>$/;
    assert.match(backdropOf(page.source, STEPS), /class="label"/);
    // a built-in backdrop put in place of a built-in backdrop keeps the labels
    await selectBackdrop(page);
    await popupItems(page, 'Drawing');
    await choose(page, 'Cislunar Manifolds', page.source);
    assert.equal((backdropOf(await render(page), STEPS).match(/class="label"/g) ?? []).length, 3);
    await undo(page);
    assert.equal(await render(page), page.source);
    // from the Drawing popup
    await popupItems(page, 'Drawing');
    await choose(page, 'Beeson Logo', page.source);
    assert.match(backdropOf(await render(page), STEPS), LOGO);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Change Drawing');
    await undo(page);
    assert.equal(await render(page), page.source);
    // from the list of Media > Backdrop…
    await openList(page, LIST.length);
    await pick(page, 'Beeson Logo', page.source);
    const text = await render(page);
    assert.match(backdropOf(text, STEPS), LOGO);
    assert.equal(await page.evaluate(`document.querySelectorAll('section.present .backdrop .label').length`), 0);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Replace Backdrop');
    await undo(page);
    assert.equal(await render(page), page.source);
    await redo(page);
    assert.equal(await render(page), text);
    assert.equal((await saveAndReopen(page)).text, text);
  });

  // item 4
  test(`the Backdrop pane is built again when the drawing changes between a scene and a file (${platform})`, async (t) => {
    const page = await load(t, platform, DEMO, 2);
    await selectBackdrop(page);
    const builtIn = { secs: ['Drawing', 'Window', 'Labels', 'Motion'], colormap: false, family: false, note: false };
    const file = { secs: ['Drawing', 'Window', 'Motion'], colormap: true, family: false, note: true };
    assert.deepEqual(await sections(page), builtIn);
    await openList(page, LIST.length);
    await pick(page, 'Beeson Logo', page.source);
    assert.deepEqual(await sections(page), file);
    assert.equal(await popupText(page, 'Colormap'), 'Palette');
    await undo(page);
    await frames(page);
    assert.deepEqual(await sections(page), builtIn);
    await redo(page);
    await frames(page);
    assert.deepEqual(await sections(page), file);
    await undo(page);
    await frames(page);
    // the same through the Drawing popup
    await popupItems(page, 'Drawing');
    await choose(page, 'Beeson Logo', page.source);
    assert.deepEqual(await sections(page), file);
    await popupItems(page, 'Drawing');
    await choose(page, 'Lyapunov Families', await render(page));
    assert.deepEqual(await sections(page), builtIn);
    assert.deepEqual(page.errors.filter((e) => !e.includes('/favicon.ico')), []);
  });
}

for (const platform of PLATFORMS) {
  // item 1, the selections of the file in the deck
  test(`the Family popup lists each selection of the file once, with the family of the backdrop checked whatever the order of its terms (${platform})`, async (t) => {
    const page = await load(t, platform, SELECTIONS, 1);
    await selectBackdrop(page);
    assert.equal(await popupText(page, 'Family'), 'Family 7');
    const items = await popupItems(page, 'Family');
    const names = items.map((i) => i[0]);
    assert.equal(new Set(names).size, names.length, names.join(', '));
    assert.deepEqual(names, [...FAMILIES, 'Families 7 and 11', 'Families 7 and 11 (Inertial)', 'Families 7 and 11 (Both Frames)']);
    assert.deepEqual(items.filter((i) => i[1]).map((i) => i[0]), ['Family 7']);
    // the family of the backdrop chosen again changes nothing
    await choose(page, 'Family 7');
    assert.equal(await render(page), page.source);
    // every record draws both frames, and is not named as the rotating frame alone
    await page.evaluate('Reveal.slide(0)');
    await frames(page);
    await selectBackdrop(page);
    assert.equal(await popupText(page, 'Family'), 'Families 7 and 11 (Both Frames)');
    assert.deepEqual((await popupItems(page, 'Family')).filter((i) => i[1]).map((i) => i[0]), ['Families 7 and 11 (Both Frames)']);
    await choose(page, 'Families 7 and 11', page.source);
    assert.match(tagOf(await render(page), '<h2>Every record'), /data-trajectories-select="frame=pulsating"/);
    await undo(page);
    assert.equal(await render(page), page.source);
  });

  // item 1, the check of an entry in the Drawing popup
  test(`an entry of the Drawing popup chosen on a backdrop with more drawing attributes than the entry draws the entry (${platform})`, async (t) => {
    const page = await load(t, platform, SELECTIONS, 4);
    await selectBackdrop(page);
    await popupItems(page, 'Drawing');
    await choose(page, 'Beeson Logo', page.source);
    assert.equal(tagOf(await render(page), '<h2>A part of the logo'), '<div class="backdrop" data-trajectories="../../brand/transfer.js">');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Change Drawing');
    await undo(page);
    assert.equal(await render(page), page.source);
    await page.evaluate('Reveal.slide(5)');
    await frames(page);
    await selectBackdrop(page);
    await popupItems(page, 'Drawing');
    await choose(page, 'Earth Manifolds', page.source);
    const tag = tagOf(await render(page), '<h2>A scene with heads');
    assert.match(tag, /data-backdrop="wideRibbon"/);
    assert.doesNotMatch(tag, /data-heads/);
  });
}
