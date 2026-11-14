// the choices of the Family, Frame, and Drawing popups of the Backdrop pane, R32.1, on both platforms.
// a pick on the Broucke drawing of the demo deck and back gives back its bytes, a pick on one slide
// leaves the drawing of another as it is, and Broucke Families stays in the Drawing popup of a deck in
// another folder once its drawings of the file are replaced

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

// asserts that the Family popup shows checked, with checked alone checked
async function assertFamily(page, checked) {
  assert.equal(await popupText(page, 'Family'), checked);
  const items = await popupItems(page, 'Family');
  assert.deepEqual(items.map((i) => i[0]), ['7', '11', '7/11']);
  assert.deepEqual(items.filter((i) => i[1]).map((i) => i[0]), [checked]);
  await press(page, 'Escape');
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tagOf = (text, heading) => text.match(new RegExp(`${esc(heading)}[\\s\\S]*?(<div class="backdrop"[^>]*>)`))[1];

for (const platform of PLATFORMS) {
  // item 1, the flow of the tester on slide 2
  test(`Family 7 chosen on slide 2 writes 7P, and 7/11 gives back the bytes of the demo deck (${platform})`, async (t) => {
    const page = await load(t, platform, DEMO, 1);
    const seven = await pick(page, 'Family', '7', 'Undo Family');
    assert.equal(seven, page.source.replace('data-trajectories-select="frame=pulsating"', 'data-trajectories-select="family=7,branch=periapsis,frame=pulsating"'));
    await assertFamily(page, '7');
    const both = await pick(page, 'Family', '7/11', 'Undo Family');
    assert.equal(both, page.source);
    await assertFamily(page, '7/11');
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
  test(`Broucke Families chosen on slide 3 while slide 2 draws family 7 writes 7P, and Inertial writes 7P about m2 there alone (${platform})`, async (t) => {
    const page = await load(t, platform, DEMO, 1);
    const seven = await pick(page, 'Family', '7', 'Undo Family');
    await go(page, 2);
    const drawing = await pick(page, 'Drawing', 'Broucke Families', 'Undo Change Drawing');
    assert.match(tagOf(drawing, STEPS), /data-trajectories-select="family=7,branch=periapsis,frame=pulsating"/);
    await assertFamily(page, '7');
    const inertial = await pick(page, 'Frame', 'Inertial', 'Undo Frame');
    assert.equal(tagOf(inertial, STEPS), tagOf(drawing, STEPS).replace('frame=pulsating', 'frame=inertial-m2'));
    assert.equal(tagOf(inertial, SECTION), tagOf(seven, SECTION));
    assert.equal(await popupText(page, 'Frame'), 'Inertial');
    // slide 2 keeps its own pick
    await go(page, 1);
    await assertFamily(page, '7');
    assert.equal(await popupText(page, 'Frame'), 'Rotating');
    await go(page, 2);
    await undo(page);
    assert.equal(await render(page), drawing);
    await redo(page);
    assert.equal(await render(page), inertial);
    assert.equal((await saveAndReopen(page)).text, inertial);
  });

  // item 3, the Drawing popup
  test(`Broucke Families stays in the Drawing popup of a deck in another folder once every drawing of the file is replaced, and draws the file of the deck (${platform})`, async (t) => {
    const page = await load(t, platform, DECK, 1);
    for (const n of [1, 2, 3]) {
      await go(page, n);
      await pick(page, 'Drawing', 'Cislunar Manifolds', 'Undo Change Drawing');
    }
    const items = await popupItems(page, 'Drawing');
    assert.deepEqual(items.find((i) => i[0] === 'Broucke Families'), ['Broucke Families', false, false], js(items));
    await press(page, 'Escape');
    const text = await pick(page, 'Drawing', 'Broucke Families', 'Undo Change Drawing');
    assert.match(tagOf(text, '<h2>One family</h2>'), /data-trajectories="\.\.\/\.\.\/demo\/broucke-sample\.js" data-trajectories-select="family=7,branch=periapsis,frame=pulsating"/);
    assert.equal(await popupText(page, 'Drawing'), 'Broucke Families');
  });
}
