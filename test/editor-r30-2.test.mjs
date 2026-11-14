// the window of a drawing chosen in the Drawing popup of the Backdrop pane, R30.2, on both
// platforms. between two built-in backdrops the window, the labels, and the motion are kept. where the old
// or the new drawing is drawn from a file, the window and the motion of the entry are written as the
// tile of the same entry in the gallery of Media > Backdrop… writes them, so that the drawing is
// whole in its box

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen } from './helpers/editor.mjs';

const DEMO = 'test-deck.html';
const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
const MENU = '.beeson-edit-menu.select';
const TITLE = '<section class="title">';
const SECTION = '<section class="section">';
const STEPS = '<h2>Show your steps one at a time';
const TUBES = '<div class="backdrop" data-backdrop="tubes" data-cx="0.97" data-cy="0" data-half="0.5">';

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

// the editor on the demo deck at slide n, counted from 0, with the storage of the origin emptied
async function load(t, platform, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${DEMO}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DEMO, 'utf8');
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

// the item called name of the popup label of the pane chosen by clicks. the file then differs from
// text
async function choosePopup(page, label, name, text) {
  await click(page, `${PANEL} [aria-label="${label}"]`);
  await page.waitFor(`!!document.querySelector('${MENU}')`);
  await page.evaluate(`[...document.querySelectorAll('${MENU} .item')].find((i) => (i.querySelector('.label')?.textContent ?? i.textContent) === ${js(name)}).setAttribute('data-pick', '')`);
  await click(page, `${MENU} .item[data-pick]`);
  await page.waitFor(`window.BeesonEditor.render() !== ${js(text)}`);
  await settle(page);
}
const chooseDrawing = (page, name, text) => choosePopup(page, 'Drawing', name, text);

// waits until the theme has read and drawn the new drawing of the selected backdrop. the cut marks
// are drawn again at a change of the selection, hence the backdrop is selected once more
async function settle(page) {
  await frames(page);
  await page.waitFor(`(() => {
    const el = window.BeesonEditor.selection()[0];
    const o = el && window.Beeson.backdrops.find((b) => b.el === el);
    return o ? o.ready.then(() => true) : false;
  })()`);
  await press(page, 'Escape');
  await frames(page);
  await exec(page, 'backdrop.select');
  await frames(page);
}

// the start tag of the first backdrop after heading in text, that backdrop with its children, and
// the value of the attribute name of a start tag
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tagOf = (text, heading) => text.match(new RegExp(`${esc(heading)}[\\s\\S]*?(<div class="backdrop"[^>]*>)`))[1];
const backdropOf = (text, heading) => text.match(new RegExp(`${esc(heading)}[\\s\\S]*?(<div class="backdrop"[\\s\\S]*?</div>)`))[1];
const attr = (tag, name) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1] ?? null;

// the edges at which the drawing of the selected backdrop is marked as cut
const cuts = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-backdrop-cuts .beeson-mask-cut')].map((m) => m.dataset.edge)`);

// the window that the theme fits to the box of the selected backdrop, and the window it draws
const fit = (page) => page.evaluate('window.Beeson.fitWindow(window.BeesonEditor.selection()[0])');
const drawnView = (page) => page.evaluate(`(() => {
  const el = window.BeesonEditor.selection()[0];
  const v = window.Beeson.backdrops.find((b) => b.el === el).view;
  return { cx: v.cx, cy: v.cy, half: v.half };
})()`);

// the values of the fields of the section Window of the pane, which are rounded to 0.01
const fields = (page) => page.evaluate(`Object.fromEntries(['Center X', 'Center Y', 'Half Height'].map((n) => [n, Number(document.querySelector('${PANEL} input[name="' + n + '"]').value)]))`);
function assertFields(shown, tag) {
  for (const [name, key] of [['Center X', 'data-cx'], ['Center Y', 'data-cy'], ['Half Height', 'data-half']]) {
    assert.ok(Math.abs(shown[name] - Number(attr(tag, key))) < 0.0051, `${name} reads ${shown[name]} for ${key}="${attr(tag, key)}"`);
  }
}

// asserts that the change is one entry Change Drawing, that an undo gives the file back byte for
// byte, that a redo gives text again, and that a save and an open keep text
async function checkHistory(page, text) {
  assert.equal((await state(page, 'edit.undo')).label, 'Undo Change Drawing');
  await undo(page);
  assert.equal(await render(page), page.source);
  await redo(page);
  assert.equal(await render(page), text);
  assert.equal((await saveAndReopen(page)).text, text);
}

for (const platform of PLATFORMS) {
  test(`Broucke Families chosen on the Cislunar Manifolds of slide 3 takes off the window, writes the motion of the entry, and is whole in its box (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await selectBackdrop(page);
    await chooseDrawing(page, 'Broucke Families', page.source);
    const text = await render(page);
    const tag = tagOf(text, STEPS);
    for (const name of ['data-cx', 'data-cy', 'data-half', 'data-backdrop']) assert.equal(attr(tag, name), null, `${name} is kept in ${tag}`);
    assert.equal(attr(tag, 'data-trajectories-select'), 'family=7,branch=periapsis,frame=pulsating');
    assert.equal(attr(tag, 'data-duration'), '3');
    assert.equal(attr(tag, 'data-stagger'), '0.6');
    assert.doesNotMatch(backdropOf(text, STEPS), /class="label"/);
    assert.deepEqual(await cuts(page), []);
    // without a window, the drawing is fitted to its box, and the fields show the fitted window
    const v = await fit(page);
    const drawn = await drawnView(page);
    for (const k of ['cx', 'cy', 'half']) assert.ok(Math.abs(drawn[k] - v[k]) < 1e-6, `${k} is drawn at ${drawn[k]}, not at the fitted ${v[k]}`);
    const shown = await fields(page);
    assert.ok(Math.abs(shown['Center X'] - v.cx) < 0.0051 && Math.abs(shown['Half Height'] - v.half) < 0.0051, `the fields read ${js(shown)} for ${js(v)}`);
    await checkHistory(page, text);
  });

  test(`Beeson Logo chosen on the Cislunar Manifolds of slide 3 writes the fitted window and the 20 s of the entry (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await selectBackdrop(page);
    await chooseDrawing(page, 'Beeson Logo', page.source);
    const text = await render(page);
    const tag = tagOf(text, STEPS);
    assert.equal(attr(tag, 'data-trajectories'), 'brand/transfer.js');
    assert.equal(attr(tag, 'data-duration'), '20');
    assert.equal(attr(tag, 'data-stagger'), null);
    const v = await fit(page);
    assert.ok(Math.abs(v.cx - 0.093) < 0.01 && Math.abs(v.half - 1.473) < 0.01, `the fitted window is ${js(v)}`);
    for (const [k, name] of [['cx', 'data-cx'], ['cy', 'data-cy'], ['half', 'data-half']]) {
      assert.ok(Math.abs(Number(attr(tag, name)) - v[k]) < 0.001, `${name}="${attr(tag, name)}" for the fitted ${v[k]}`);
    }
    assert.deepEqual(await cuts(page), []);
    assertFields(await fields(page), tag);
    await checkHistory(page, text);
  });

  test(`Cislunar Manifolds chosen on the Broucke backdrop of slide 2 writes the fitted window and takes off the motion of the file (${platform})`, async (t) => {
    const page = await load(t, platform, 1);
    await selectBackdrop(page);
    await chooseDrawing(page, 'Cislunar Manifolds', page.source);
    const text = await render(page);
    const tag = tagOf(text, SECTION);
    assert.equal(attr(tag, 'data-backdrop'), 'tubes');
    for (const name of ['data-trajectories', 'data-trajectories-select', 'data-duration', 'data-stagger']) assert.equal(attr(tag, name), null, `${name} is kept in ${tag}`);
    const v = await fit(page);
    assert.ok(Math.abs(v.cx - 0.276) < 0.01 && Math.abs(v.half - 1.418) < 0.01, `the fitted window is ${js(v)}`);
    for (const [k, name] of [['cx', 'data-cx'], ['cy', 'data-cy'], ['half', 'data-half']]) {
      assert.ok(Math.abs(Number(attr(tag, name)) - v[k]) < 0.001, `${name}="${attr(tag, name)}" for the fitted ${v[k]}`);
    }
    assert.deepEqual(await cuts(page), []);
    assertFields(await fields(page), tag);
    await checkHistory(page, text);
  });

  test(`a scene chosen on a drawing of a file in a box of the size of the box of its entry writes the window of the entry (${platform})`, async (t) => {
    const page = await load(t, platform, 0);
    await selectBackdrop(page);
    assert.deepEqual(await page.evaluate('[window.BeesonEditor.selection()[0].offsetWidth, window.BeesonEditor.selection()[0].offsetHeight]'), [1920, 1080]);
    await chooseDrawing(page, 'Cislunar Manifolds', page.source);
    const text = await render(page);
    const tag = tagOf(text, TITLE);
    // the window is written in place of the window of the logo, and the built-in backdrop after it
    assert.equal(tag, '<div class="backdrop" data-cx="0.42" data-cy="0" data-half="0.6" data-backdrop="tubes">');
    assertFields(await fields(page), tag);
    await checkHistory(page, text);
  });

  test(`after Broucke Families is chosen in the Drawing popup, the Family and Colormap popups write only their attribute (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await selectBackdrop(page);
    await chooseDrawing(page, 'Broucke Families', page.source);
    const drawing = await render(page);
    await choosePopup(page, 'Family', '11', drawing);
    const family = await render(page);
    assert.equal(tagOf(family, STEPS), tagOf(drawing, STEPS).replace('family=7,branch=periapsis,frame=pulsating', 'family=11,frame=pulsating'));
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Family');
    await choosePopup(page, 'Colormap', 'Plasma', family);
    const colormap = await render(page);
    assert.equal(tagOf(colormap, STEPS), tagOf(family, STEPS).replace('data-trajectories-colormap="viridis"', 'data-trajectories-colormap="plasma"'));
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Colormap');
    assert.deepEqual(await cuts(page), []);
    await undo(page);
    await undo(page);
    assert.equal(await render(page), drawing);
    await undo(page);
    assert.equal(await render(page), page.source);
  });

  test(`between two named scenes the Drawing popup keeps the window, the labels, and the motion (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await selectBackdrop(page);
    await chooseDrawing(page, 'Earth Manifolds', page.source);
    const text = await render(page);
    assert.equal(text, page.source.replace(TUBES, TUBES.replace('tubes', 'wideRibbon')));
    assertFields(await fields(page), tagOf(text, STEPS));
    await checkHistory(page, text);
  });
}
