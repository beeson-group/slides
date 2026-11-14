// the Surface pane on both platforms: a drag that turns a surface, its azimuth and elevation shown
// at the pointer, Use Current View, a drag from the edge of a surface that moves it, and a camera
// written to the surfaces that share it. each edit is checked byte for byte, after an undo and a
// redo, against the scope rule, and after a save and an open of the saved text

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { byteExact, center, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const PANEL = '#beeson-edit-panel-format';
const SURFACE_SLIDE = 11;

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

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

let last = null;

// the editor on a slide of a deck served over HTTP, where a save is written into the origin private
// file system, with the Format tab of the inspector shown
async function deckPage(platform, slide, deck = LAYOUTS) {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.send('Page.bringToFront');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${slide})`);
  await frames(page);
  return page;
}

async function inScope(page) {
  const now = textProblems(await render(page), THEME);
  for (const p of textProblems(page.source, THEME)) {
    const i = now.indexOf(p);
    if (i >= 0) now.splice(i, 1);
  }
  assert.deepEqual(now, []);
}

// the text rendered once it is the source with edits, e.g. after a command run by a key
async function until(page, edits) {
  let expected = page.source;
  for (const [a, b] of edits) expected = expected.replace(a, () => b);
  await page.waitFor(`window.BeesonEditor.render() === ${JSON.stringify(expected)}`).catch(() => {});
  await byteExact(page, edits);
}

// the edit checked byte for byte, then after an undo, which gives the file with the edits before,
// and again after a redo
async function roundTrip(page, edits, label, before = []) {
  await until(page, edits);
  await inScope(page);
  if (label) assert.equal((await state(page, 'edit.undo')).label, `Undo ${label}`);
  await undo(page);
  await byteExact(page, before);
  await redo(page);
  await byteExact(page, edits);
}

let saves = 0;
async function saved(page, edits) {
  const { text } = await saveAndReopen(page, `surface-${++saves}.html`);
  page.source = text;
  await byteExact(page);
  assert.ok(edits.every(([, b]) => text.includes(b)));
}

for (const platform of PLATFORMS) {
  test(`a drag turns a surface without moving it, and Use Current View writes its camera (${platform})`, async () => {
    const page = await deckPage(platform, SURFACE_SLIDE);
    const camera = () => page.evaluate(`Beeson.surfaces.find((s) => document.querySelector('.reveal section.present').contains(s.el)).view()`);
    assert.deepEqual((await camera()).written, { azimuth: -60, elevation: 32, zoom: 1, turn: 90, zscale: 1 });
    await drag(page, '.reveal section.present .surface', { dx: 80, dy: 30 });
    await frames(page);
    const turned = await camera();
    assert.ok(Math.abs(turned.azimuth + 60) > 10, `the azimuth is ${turned.azimuth}`);
    assert.ok(turned.elevation > 32);
    await byteExact(page);
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} .ed-panes').dataset.pane`), 'surface');
    // the field shows the azimuth of the drag, which is not written until Use Current View
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} input[name="azimuth"]').value`), String(Math.round(turned.azimuth)));
    await click(page, `${PANEL} button[data-command="surface.useView"]`);
    const az = Math.round(turned.azimuth), el = Math.round(turned.elevation);
    const tag = '<div class="surface" data-function="effective-potential" data-mu="0.05">';
    const edit = [tag, tag.replace('>', ` data-azimuth="${az}" data-elevation="${el}">`)];
    await roundTrip(page, [edit], 'Use Current View');
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} input[name="azimuth"]').value`), String(az));
    assert.equal(Math.round((await camera()).azimuth), az);
    // an undo puts the camera of the deck back
    await undo(page);
    await frames(page);
    assert.equal(Math.round((await camera()).azimuth), -60);
    await redo(page);
    // a field writes its attribute at Return, and Turn and Z Scale are written as numbers
    await click(page, `${PANEL} input[name="azimuth"]`);
    await page.evaluate(`document.querySelector('${PANEL} input[name="azimuth"]').select()`);
    await type(page, '200');
    await press(page, 'Enter');
    const field = [tag, tag.replace('>', ` data-azimuth="-160" data-elevation="${el}">`)];
    await roundTrip(page, [field], 'Surface Azimuth', [edit]);
    await exec(page, 'surface.zscale', { value: 0.5 });
    const scaled = [tag, tag.replace('>', ` data-azimuth="-160" data-elevation="${el}" data-zscale="0.5">`)];
    await roundTrip(page, [scaled], 'Surface Z Scale', [field]);
    assert.equal((await camera()).written.zscale, 0.5);
    // a right-click on the surface opens the menu of an element, with Use Current View
    const at = await center(page, '.reveal section.present .surface');
    await click(page, at, { button: 'right' });
    assert.ok(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu [role="menuitem"]')].some((i) => i.textContent.includes('Use Current View'))`));
    await press(page, 'Escape');
    await saved(page, [scaled]);
    assert.deepEqual(errors(page), []);
  });

  test(`a drag from the edge of a surface moves it (${platform})`, async () => {
    const page = await deckPage(platform, SURFACE_SLIDE);
    await click(page, '.reveal section.present .surface');
    const r = await page.evaluate(`(() => { const r = document.querySelector('.reveal section.present .surface').getBoundingClientRect(); return { left: r.left, top: r.top, height: r.height }; })()`);
    const before = await page.evaluate(`Beeson.surfaces.find((s) => document.querySelector('.reveal section.present').contains(s.el)).view().azimuth`);
    await drag(page, { x: r.left + 3, y: r.top + r.height / 2 }, { dx: -40 });
    await frames(page);
    const tag = '<div class="surface" data-function="effective-potential" data-mu="0.05">';
    const moved = (await render(page)).match(/<div class="surface" data-function="effective-potential" data-mu="0.05" style="translate: -(\d+)px 0px">/);
    assert.ok(moved && Number(moved[1]) > 20, 'the surface is not moved to the left');
    await roundTrip(page, [[tag, moved[0]]], 'Move');
    assert.equal(await page.evaluate(`Beeson.surfaces.find((s) => document.querySelector('.reveal section.present').contains(s.el)).view().azimuth`), before);
    assert.deepEqual(errors(page), []);
  });

  test(`Use Current View writes the camera to the surface of the next slide that shares it (${platform})`, async () => {
    const page = await deckPage(platform, 0, 'test-deck.html');
    const first = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('.surface'))`);
    await page.evaluate(`Reveal.slide(${first})`);
    await frames(page);
    await drag(page, '.reveal section.present .surface', { dx: -60, dy: 20 });
    await frames(page);
    assert.match(await page.evaluate(`document.querySelector('${PANEL}').textContent`), new RegExp(`The surface on slide ${first + 2} has the same attributes`));
    const v = await page.evaluate(`Beeson.surfaces.find((s) => document.querySelector('.reveal section.present').contains(s.el)).view()`);
    await exec(page, 'surface.useView');
    const az = Math.round(v.azimuth), el = Math.round(v.elevation);
    const one = '<div class="surface" data-function="effective-potential" data-mu="0.05">';
    const two = '<div class="surface" data-function="effective-potential" data-mu="0.05" data-surface-state="effective">';
    const edits = [[one, one.replace('>', ` data-azimuth="${az}" data-elevation="${el}">`)], [two, two.replace('>', ` data-azimuth="${az}" data-elevation="${el}">`)]];
    await roundTrip(page, edits, 'Use Current View');
    // the surface of the next slide is shown under the camera written
    await page.evaluate(`Reveal.slide(${first + 1})`);
    await frames(page);
    const next = await page.evaluate(`Beeson.surfaces.find((s) => document.querySelector('.reveal section.present').contains(s.el)).view()`);
    assert.deepEqual([Math.round(next.azimuth), Math.round(next.elevation)], [az, el]);
    await saved(page, edits);
    assert.deepEqual(errors(page), []);
  });

  test(`a drag on a surface shows its azimuth and elevation at the pointer, and the fields follow it (${platform})`, async () => {
    const page = await deckPage(platform, SURFACE_SLIDE);
    await click(page, '.reveal section.present .surface');
    await frames(page);
    const readout = () => page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-offset')].find((e) => !e.hidden); return r ? r.textContent : null; })()`);
    const fields = () => page.evaluate(`['azimuth', 'elevation'].map((n) => document.querySelector('${PANEL} input[name="' + n + '"]').value)`);
    assert.deepEqual(await fields(), ['-60', '32']);
    await drag(page, '.reveal section.present .surface', { dx: 80, dy: 30, hold: true });
    const shown = await readout();
    const m = /^(-?\d+)°  (\d+)°$/.exec(shown ?? '');
    assert.ok(m, `the readout is ${shown}`);
    assert.notEqual(m[1], '-60');
    assert.deepEqual(await fields(), [m[1], m[2]]);
    const at = await center(page, '.reveal section.present .surface');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x + 80, y: at.y + 30, button: 'left', clickCount: 1 });
    await frames(page);
    assert.equal(await readout(), null);
    // the fields keep the view of the drag, marked as not written, until Use Current View writes it
    assert.deepEqual(await fields(), [m[1], m[2]]);
    assert.ok(await page.evaluate(`document.querySelector('${PANEL} input[name="azimuth"]').closest('.ed-num').classList.contains('turned')`));
    await byteExact(page);
    await click(page, `${PANEL} button[data-command="surface.useView"]`);
    const tag = '<div class="surface" data-function="effective-potential" data-mu="0.05">';
    await roundTrip(page, [[tag, tag.replace('>', ` data-azimuth="${m[1]}" data-elevation="${m[2]}">`)]], 'Use Current View');
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} input[name="azimuth"]').closest('.ed-num').classList.contains('turned')`), false);
    assert.deepEqual(errors(page), []);
  });
}
