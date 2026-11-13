// the choices of the Family and Drawing popups of the Backdrop pane, R32.1, on both platforms. the
// Family popup always lists each family of demo/broucke-sample.js in each frame and the families of
// each frame together, so that a choice is not lost once no drawing of the deck has it, and Broucke
// Families stays in the Drawing popup of a deck in another folder once its drawings of the file are
// replaced

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen } from './helpers/editor.mjs';

const DEMO = 'test-deck.html';
// a deck in another folder whose drawings of demo/broucke-sample.js are on slides 1 to 3
const DECK = 'test/pages/editor-r22-5.html';
const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
const MENU = '.beeson-edit-menu.select';
const SECTION = '<section class="section">';
const STEPS = '<h2>Show your steps one at a time';
// the fixed choices of the Family popup, in their order
const FIXED = ['Family 7', 'Family 7 (Inertial)', 'Family 11', 'Family 11 (Inertial)', 'Families 7 and 11', 'Families 7 and 11 (Inertial)'];

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

// the editor on deck at slide n, counted from 0, with the storage of the origin emptied
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
  await go(page, n);
  return page;
}

// slide n shown with its backdrop selected and the Format panel shown
async function go(page, n) {
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await exec(page, 'backdrop.select');
  await frames(page);
}

// the text of the popup of the pane named label
const popupText = (page, label) => page.evaluate(`document.querySelector('${PANEL} [aria-label="${label}"]').textContent`);

// the items of the popup of the pane named label, opened by a click, as [name, checked, disabled]
async function popupItems(page, label) {
  await click(page, `${PANEL} [aria-label="${label}"]`);
  await page.waitFor(`!!document.querySelector('${MENU}')`);
  return page.evaluate(`[...document.querySelectorAll('${MENU} .item')].map((i) => [i.querySelector('.label')?.textContent ?? i.textContent, i.getAttribute('aria-checked') === 'true', i.getAttribute('aria-disabled') === 'true'])`);
}

// a click on the item called name of the open popup, after which the file differs from text
async function choose(page, name, text) {
  await page.evaluate(`[...document.querySelectorAll('${MENU} .item')].find((i) => (i.querySelector('.label')?.textContent ?? i.textContent) === ${js(name)}).setAttribute('data-pick', '')`);
  await click(page, `${MENU} .item[data-pick]`);
  if (text !== undefined) await page.waitFor(`window.BeesonEditor.render() !== ${js(text)}`);
  await frames(page);
}

// the item called name of the popup label chosen, as one entry of the history called undo
async function pick(page, label, name, undoLabel) {
  const text = await render(page);
  await popupItems(page, label);
  await choose(page, name, text);
  assert.equal((await state(page, 'edit.undo')).label, undoLabel);
  return render(page);
}

// asserts that the Family popup lists the fixed choices, then rest, with checked alone checked
async function assertFamilies(page, checked, rest = []) {
  assert.equal(await popupText(page, 'Family'), checked);
  const items = await popupItems(page, 'Family');
  assert.deepEqual(items.map((i) => i[0]), [...FIXED, ...rest]);
  assert.deepEqual(items.filter((i) => i[1]).map((i) => i[0]), [checked]);
  await press(page, 'Escape');
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tagOf = (text, heading) => text.match(new RegExp(`${esc(heading)}[\\s\\S]*?(<div class="backdrop"[^>]*>)`))[1];

for (const platform of PLATFORMS) {
  // item 1, the flow of the tester on slide 2
  test(`Family 7 chosen on slide 2 keeps Families 7 and 11 in the Family popup, and choosing it gives back the bytes of the demo deck (${platform})`, async (t) => {
    const page = await load(t, platform, DEMO, 1);
    const seven = await pick(page, 'Family', 'Family 7', 'Undo Family');
    assert.equal(seven, page.source.replace('data-trajectories-select="frame=pulsating"', 'data-trajectories-select="frame=pulsating,family=7"'));
    await assertFamilies(page, 'Family 7');
    const both = await pick(page, 'Family', 'Families 7 and 11', 'Undo Family');
    assert.equal(both, page.source);
    await assertFamilies(page, 'Families 7 and 11');
    await undo(page);
    assert.equal(await render(page), seven);
    await undo(page);
    assert.equal(await render(page), page.source);
    await redo(page);
    assert.equal(await render(page), seven);
    await redo(page);
    assert.equal(await render(page), page.source);
    assert.equal((await saveAndReopen(page)).text, page.source);
  });

  // item 1, the flow of the tester on another slide
  test(`Broucke Families chosen on slide 3 while slide 2 draws one family has the six fixed choices, and Families 7 and 11 (Inertial) writes frame=inertial (${platform})`, async (t) => {
    const page = await load(t, platform, DEMO, 1);
    const seven = await pick(page, 'Family', 'Family 7', 'Undo Family');
    await go(page, 2);
    const drawing = await pick(page, 'Drawing', 'Broucke Families', 'Undo Change Drawing');
    assert.match(tagOf(drawing, STEPS), /data-trajectories-select="frame=pulsating,family=7"/);
    await assertFamilies(page, 'Family 7');
    const inertial = await pick(page, 'Family', 'Families 7 and 11 (Inertial)', 'Undo Family');
    assert.equal(tagOf(inertial, STEPS), tagOf(drawing, STEPS).replace('frame=pulsating,family=7', 'frame=inertial'));
    assert.equal(tagOf(inertial, SECTION), tagOf(seven, SECTION));
    await assertFamilies(page, 'Families 7 and 11 (Inertial)');
    // slide 2 lists the same choices, with its own family checked
    await go(page, 1);
    await assertFamilies(page, 'Family 7');
    await go(page, 2);
    await undo(page);
    assert.equal(await render(page), drawing);
    await redo(page);
    assert.equal(await render(page), inertial);
    assert.equal((await saveAndReopen(page)).text, inertial);
  });

  // item 2, a fixed choice beside an equal selection of the deck
  test(`a fixed choice is listed once beside an equal selection of the deck, and writes the value of the demo deck once the selection is gone (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, 1);
    // family=7|11,frame=pulsating selects what frame=pulsating selects
    await pick(page, 'Family', 'Family 7', 'Undo Family');
    await assertFamilies(page, 'Family 7');
    const both = await pick(page, 'Family', 'Families 7 and 11', 'Undo Family');
    assert.equal(tagOf(both, '<h2>Two families'), tagOf(page.source, '<h2>Two families').replace('family=7|11,frame=pulsating', 'frame=pulsating'));
    await assertFamilies(page, 'Families 7 and 11');
  });

  // item 3, the Drawing popup
  test(`Broucke Families stays in the Drawing popup of a deck in another folder once every drawing of the file is replaced, and draws the file of the deck (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, 1);
    for (const n of [1, 2, 3]) {
      await go(page, n);
      await pick(page, 'Drawing', 'Lyapunov Families', 'Undo Change Drawing');
    }
    const items = await popupItems(page, 'Drawing');
    assert.deepEqual(items.find((i) => i[0] === 'Broucke Families'), ['Broucke Families', false, false], js(items));
    await press(page, 'Escape');
    const text = await pick(page, 'Drawing', 'Broucke Families', 'Undo Change Drawing');
    assert.match(tagOf(text, '<h2>One family</h2>'), /data-trajectories="\.\.\/\.\.\/demo\/broucke-sample\.js" data-trajectories-select="frame=pulsating,family=7"/);
    assert.equal(await popupText(page, 'Drawing'), 'Broucke Families');
  });
}
