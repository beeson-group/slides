// the Family, Frame, and Branch popups of a drawing of demo/broucke-sample.js on both platforms: the
// eight picks, recognized by the records they draw, the selection each writes as one entry of the
// history, Custom for any other selection, and the entry Broucke Families taken from the first drawing
// of demo/broucke-sample.js in the deck whose file is found

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen } from './helpers/editor.mjs';

// a deck of the eight picks and of three Custom selections, and a deck whose first drawing of
// demo/broucke-sample.js is missing
const PICKS = 'test/pages/editor-r28-2.html';
const MISSING = 'test/pages/editor-r28-2-missing.html';
const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
const TILES = '.beeson-backdrop-gallery [data-tile]';
const MENU = '.beeson-edit-menu.select';
// the Family, Frame, and Branch popups of each slide of the deck PICKS, null for a popup not shown
const SHOWN = [
  ['7', 'Rotating', 'Periapsis'],
  ['7', 'Rotating', 'Apoapsis'],
  ['7', 'Inertial', 'Periapsis'],
  ['7', 'Inertial', 'Apoapsis'],
  ['11', 'Rotating', null],
  ['11', 'Inertial', null],
  ['7/11', 'Rotating', null],
  ['7/11', 'Inertial', null],
  ['Custom', 'Custom', null],
  ['Custom', 'Custom', null],
  ['Custom', 'Custom', null],
];
// the name of the drawing of each slide of the deck PICKS in the object list
const ROWS = [
  'Broucke 7 (Rotating, Periapsis)',
  'Broucke 7 (Rotating, Apoapsis)',
  'Broucke 7 (Inertial, Periapsis)',
  'Broucke 7 (Inertial, Apoapsis)',
  'Broucke 11 (Rotating)',
  'Broucke 11 (Inertial)',
  'Broucke 7/11 (Rotating)',
  'Broucke 7/11 (Inertial)',
  'Broucke (Custom)',
  'Broucke (Custom)',
  'Broucke (Custom)',
].map((name) => `Backdrop: ${name}`);
const ITEMS = { Family: ['7', '11', '7/11'], Frame: ['Rotating', 'Inertial'], Branch: ['Periapsis', 'Apoapsis'] };

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
const popupDisabled = (page, label) => page.evaluate(`document.querySelector('${PANEL} [aria-label="${label}"]').disabled`);

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

// the item called name of the popup of the pane named label picked, after which the file differs from text
async function pickItem(page, label, name, text) {
  await popupItems(page, label);
  await choose(page, name, text);
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

// the names of the backdrops in the object list on the slides ns
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

const tagOf = (text, heading) => text.match(new RegExp(`${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(<div class="backdrop"[^>]*>)`))[1];

for (const platform of PLATFORMS) {
  test(`the Family, Frame, and Branch popups show the pick of each drawing by the records it draws, and Custom for any other selection (${platform})`, async (t) => {
    const page = await load(t, platform, PICKS, 0);
    for (const [n, shown] of SHOWN.entries()) {
      await page.evaluate(`Reveal.slide(${n})`);
      await frames(page);
      await selectBackdrop(page);
      for (const [i, label] of ['Family', 'Frame', 'Branch'].entries()) {
        assert.equal(await popupText(page, label), shown[i], `${label} on slide ${n}`);
        if (shown[i] === null) continue;
        if (shown[i] === 'Custom' && label === 'Frame') {
          assert.equal(await popupDisabled(page, label), true, `Frame on slide ${n}`);
          continue;
        }
        const items = await popupItems(page, label);
        assert.deepEqual(items.map((x) => x[0]), ITEMS[label], `${label} on slide ${n}`);
        assert.deepEqual(items.filter((x) => x[1]).map((x) => x[0]), shown[i] === 'Custom' ? [] : [shown[i]], `${label} on slide ${n}`);
        await press(page, 'Escape');
      }
    }
    assert.deepEqual(await rowNames(page, SHOWN.map((_, n) => n)), ROWS);
  });

  test(`each pick replaces the whole selection with one of the eight as one entry of the history, keeping the frame, and keeping the branch in Frame (${platform})`, async (t) => {
    const page = await load(t, platform, PICKS, 0);
    await selectBackdrop(page);
    const tag = (select) => `<div class="backdrop" data-trajectories="../../demo/broucke-sample.js" data-trajectories-select="${select}" data-trajectories-color="family" data-trajectories-ramp="e">`;
    // the family of the drawing picked again changes nothing
    await pickItem(page, 'Family', '7');
    assert.equal(await render(page), page.source);
    const steps = [
      ['Branch', 'Apoapsis', 'family=7,branch=apoapsis,frame=rotating', ['7', 'Rotating', 'Apoapsis']],
      ['Frame', 'Inertial', 'family=7,branch=apoapsis,frame=inertial-m2', ['7', 'Inertial', 'Apoapsis']],
      ['Branch', 'Periapsis', 'family=7,branch=periapsis,frame=inertial-m2', ['7', 'Inertial', 'Periapsis']],
      ['Family', '11', 'family=11,frame=inertial', ['11', 'Inertial', null]],
      ['Frame', 'Rotating', 'family=11,frame=pulsating', ['11', 'Rotating', null]],
      ['Family', '7/11', 'frame=pulsating', ['7/11', 'Rotating', null]],
      ['Frame', 'Inertial', 'frame=inertial', ['7/11', 'Inertial', null]],
      ['Family', '7', 'family=7,branch=periapsis,frame=inertial-m2', ['7', 'Inertial', 'Periapsis']],
      ['Branch', 'Apoapsis', 'family=7,branch=apoapsis,frame=inertial-m2', ['7', 'Inertial', 'Apoapsis']],
      // a family is picked on the periapsis branch
      ['Family', '7/11', 'frame=inertial', ['7/11', 'Inertial', null]],
      ['Frame', 'Rotating', 'frame=pulsating', ['7/11', 'Rotating', null]],
      ['Family', '7', 'family=7,branch=periapsis,frame=pulsating', ['7', 'Rotating', 'Periapsis']],
    ];
    const texts = [page.source];
    for (const [label, name, select, shown] of steps) {
      await pickItem(page, label, name, texts.at(-1));
      const text = await render(page);
      assert.equal(tagOf(text, '<h2>Seven rotating periapsis'), tag(select), `${label} ${name}`);
      assert.equal(text.replace(tag(select), ''), page.source.replace(tag('family=7,branch=periapsis,frame=pulsating'), ''), `${label} ${name}`);
      assert.equal((await state(page, 'edit.undo')).label, `Undo ${label}`);
      for (const [i, l] of ['Family', 'Frame', 'Branch'].entries()) assert.equal(await popupText(page, l), shown[i], `${l} after ${label} ${name}`);
      texts.push(text);
    }
    for (let i = texts.length - 2; i >= 0; i--) {
      await undo(page);
      assert.equal(await render(page), texts[i], `undo ${i}`);
    }
    await redo(page);
    assert.equal(await render(page), texts[1]);
    assert.equal((await saveAndReopen(page)).text, texts[1]);
  });

  test(`on a Custom selection Frame and Branch are not picked, and a family replaces the selection in the rotating frame (${platform})`, async (t) => {
    const page = await load(t, platform, PICKS, 9);
    await selectBackdrop(page);
    assert.equal(await popupText(page, 'Family'), 'Custom');
    assert.equal(await popupText(page, 'Branch'), null);
    await exec(page, 'backdrop.frame', { value: 'Rotating' });
    await exec(page, 'backdrop.branch', { value: 'Apoapsis' });
    assert.equal(await render(page), page.source);
    await pickItem(page, 'Family', '7', page.source);
    const text = await render(page);
    assert.equal(tagOf(text, '<h2>Seven about the barycenter'), '<div class="backdrop" data-trajectories="../../demo/broucke-sample.js" data-trajectories-select="family=7,branch=periapsis,frame=pulsating" data-trajectories-color="family" data-trajectories-ramp="e">');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Family');
    assert.deepEqual([await popupText(page, 'Family'), await popupText(page, 'Frame'), await popupText(page, 'Branch')], ['7', 'Rotating', 'Periapsis']);
    await undo(page);
    assert.equal(await render(page), page.source);
    assert.equal(await popupText(page, 'Frame'), 'Custom');
    // a selection of every record is replaced by a pick as well
    await page.evaluate('Reveal.slide(8)');
    await frames(page);
    await selectBackdrop(page);
    await pickItem(page, 'Family', '11', page.source);
    // a new attribute is written after the others
    assert.equal(tagOf(await render(page), '<h2>Every record'), '<div class="backdrop" data-trajectories="../../demo/broucke-sample.js" data-trajectories-color="family" data-trajectories-ramp="e" data-trajectories-select="family=11,frame=pulsating">');
  });

  // item 2
  test(`Broucke Families is listed when the first drawing of its file in the deck is missing and a later one is found (${platform})`, async (t) => {
    const page = await load(t, platform, MISSING, 2);
    await selectBackdrop(page);
    const items = (await popupItems(page, 'Drawing')).map((i) => i[0]);
    assert.ok(items.includes('Broucke Families'), items.join(', '));
    await press(page, 'Escape');
    const list = (await openList(page, 3)).map((e) => e[1]);
    assert.ok(list.includes('Broucke Families'), list.join(', '));
    await pick(page, 'Broucke Families', page.source);
    const tag = tagOf(await render(page), '<h2>A scene');
    assert.match(tag, /data-trajectories="\.\.\/\.\.\/demo\/broucke-sample\.js"/);
    assert.match(tag, /data-trajectories-select="family=7,branch=periapsis,frame=pulsating"/);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Replace Backdrop');
    await undo(page);
    assert.equal(await render(page), page.source);
  });
}
