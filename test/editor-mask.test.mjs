// the mask edit of an image and of the window of a backdrop, and the flip of an image, on both
// platforms: a double click on an image or the command starts the edit, a trusted drag moves the
// picture inside its box and the slider scales it, Done or Return writes the result and Esc leaves
// the element as it was. each edit is checked byte for byte, after an undo and a redo, against the
// scope rule, and after a save and an open of the saved text

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const PANEL = '#beeson-edit-panel-format';

const DARK = '<img class="for-dark" src="../../demo/figure-dark.png" alt="A figure, dark version">';
const LIGHT = '<img class="for-light" src="../../demo/figure-light.png" alt="A figure, light version">';
const WHITE_FIGURE = '<img class="white-figure" src="../../demo/figure-light.png" alt="A white raster figure">';
const NEST = '<div class="backdrop" data-backdrop="nest" data-cx="0.97" data-cy="0" data-half="0.5">';
const IMG = 'section.present figure.figure-box img.for-dark';
const BAR = 'dialog.beeson-mask-bar';

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
const url = (platform) => `${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`;
const editing = (page) => page.evaluate(`!!document.querySelector('${BAR}[open]')`);
// the style written into the tag of the dark image of the figure box, or null
const written = async (page) => (await render(page)).match(/<img class="for-dark"[^>]*?(?: style="([^"]*)")?>/)[1] ?? null;
const styleOf = (page, selector) => page.evaluate(`document.querySelector(${JSON.stringify(selector)}).getAttribute('style')`);

async function maskPage(platform, n) {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.goto(url(platform));
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(LAYOUTS, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the dark image of the figure box selected, with a click on the figure box and a click into it
async function selectImage(page) {
  await click(page, 'section.present p');
  await click(page, IMG);
  await click(page, IMG);
}

// a trusted click on the button of the inspector with a text, a title, or a label of name
async function tap(page, name) {
  const at = await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('${PANEL} button')].find((b) => b.textContent.trim() === ${JSON.stringify(name)} || b.title === ${JSON.stringify(name)} || b.getAttribute('aria-label') === ${JSON.stringify(name)});
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(at, `the inspector does not have a button ${name}`);
  await click(page, at);
  await frames(page);
}

// the slider of the bar set to a zoom, as a drag of its thumb would set it
async function zoomTo(page, z) {
  await page.evaluate(`(() => {
    const s = document.querySelector('${BAR} input[type=range]');
    const [lo, hi] = [Number(s.dataset.lo), Number(s.dataset.hi)];
    s.value = String(Math.round(Math.log(${z} / lo) / Math.log(hi / lo) * 1000));
    s.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await frames(page);
}

// the text with the tag before replaced once by the tag after, which must occur once
function replaced(text, before, after) {
  assert.equal(text.split(before).length, 2, `${before} does not occur once`);
  return text.replace(before, () => after);
}

// the text with the style written on both images of the pair of a dark and a light figure
const onPair = (text, style) => replaced(replaced(text, DARK, DARK.replace('>', ` style="${style}">`)), LIGHT, LIGHT.replace('>', ` style="${style}">`));

// the checks of every edit: the scope rule, an undo byte for byte, a redo, and a save and an open
async function checkEdit(page, edited) {
  assert.deepEqual(textProblems(edited, THEME), textProblems(page.source, THEME));
  await undo(page);
  assert.equal(await render(page), page.source);
  await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page);
  assert.equal(text, edited);
}

for (const platform of PLATFORMS) {
  test(`a double click on an image, a drag, and the slider mask it, and Return applies (${platform})`, async () => {
    const page = await maskPage(platform, 3);
    await click(page, IMG, { count: 2 });
    await page.waitFor(`!!document.querySelector('${BAR}[open]')`);
    // the selection frame is hidden during the edit, and the box is marked
    assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('.beeson-mask-window')).display`), 'block');
    await zoomTo(page, 1.5);
    assert.equal(await page.evaluate(`document.querySelector('${BAR} output').textContent`), '150%');
    const box = await page.evaluate(`(() => { const r = document.querySelector('.beeson-mask-window').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await drag(page, box, { dx: 30, dy: 10 });
    await press(page, 'Enter');
    assert.equal(await editing(page), false);
    const style = await written(page);
    assert.match(style, /^scale: 1\.5; clip-path: inset\(16\.667%\); object-position: -?[\d.]+(%|px) -?[\d.]+(%|px)$/);
    const edited = await render(page);
    assert.equal(edited, onPair(page.source, `${style}`));
    // the picture seen in the box is the part of the scaled picture inside the clip
    const seen = await page.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(IMG)});
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, ow: el.offsetWidth };
    })()`);
    assert.ok(Math.abs(seen.w / seen.ow - 1.5 * (await page.evaluate('Reveal.getScale()'))) < 0.02);
    await checkEdit(page, edited);
  });

  test(`Edit Mask from its key, then Esc leaves the image as it was (${platform})`, async () => {
    const page = await maskPage(platform, 3);
    await click(page, IMG);
    await click(page, IMG);
    assert.equal((await state(page, 'image.editMask')).enabled, true);
    // the key of Edit Mask is Shift+Cmd+M on a Mac and Ctrl+Shift+M elsewhere
    await press(page, 'Mod+Shift+M');
    assert.equal(await editing(page), true);
    await page.waitFor(`!!document.querySelector('${BAR}[open]')`);
    await zoomTo(page, 2);
    assert.equal(await page.evaluate(`document.querySelector(${JSON.stringify(IMG)}).style.scale`), '2');
    await press(page, 'Escape');
    assert.equal(await editing(page), false);
    assert.equal(await styleOf(page, IMG), null);
    assert.equal(await render(page), page.source);
  });

  test(`Fill writes the mask as object-fit cover, and Reset Mask takes it off (${platform})`, async () => {
    const page = await maskPage(platform, 3);
    await click(page, IMG);
    await click(page, IMG);
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await tap(page, 'Edit Mask');
    await page.waitFor(`!!document.querySelector('${BAR}[open]')`);
    await click(page, `${BAR} button.fill`);
    assert.equal(await page.evaluate(`document.querySelector('${BAR} button.fill').getAttribute('aria-pressed')`), 'true');
    await click(page, `${BAR} button.done`);
    assert.equal(await editing(page), false);
    const edited = await render(page);
    assert.equal(edited, onPair(page.source, 'object-fit: cover'));
    await checkEdit(page, edited);
    await selectImage(page);
    assert.equal((await state(page, 'image.resetMask')).enabled, true);
    await exec(page, 'image.resetMask');
    assert.equal(await render(page), page.source);
    assert.equal((await state(page, 'image.resetMask')).enabled, false);
  });

  test(`a paper image keeps its class under a mask (${platform})`, async () => {
    const page = await maskPage(platform, 6);
    const img = 'section.present .plate img.white-figure';
    await click(page, img, { count: 2 });
    await page.waitFor(`!!document.querySelector('${BAR}[open]')`);
    await zoomTo(page, 1.25);
    await press(page, 'Enter');
    const edited = await render(page);
    assert.equal(edited, replaced(page.source, WHITE_FIGURE, WHITE_FIGURE.replace('>', ' style="scale: 1.25; clip-path: inset(10%)">')));
    await checkEdit(page, edited);
  });

  test(`the window of a backdrop is dragged and scaled with its labels, and a cut edge is marked (${platform})`, async () => {
    const page = await maskPage(platform, 2);
    const lab = `(() => { const r = document.querySelector('section.present .backdrop .label').getBoundingClientRect(); return { x: r.left, y: r.top }; })()`;
    const before = await page.evaluate(lab);
    assert.equal((await state(page, 'backdrop.editWindow')).enabled, true);
    await exec(page, 'backdrop.editWindow');
    await page.waitFor(`!!document.querySelector('${BAR}[open]')`);
    assert.equal(await page.evaluate(`document.querySelector('${BAR} .what').textContent`), 'Window');
    const box = await page.evaluate(`(() => { const r = document.querySelector('.beeson-mask-window').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await drag(page, box, { dx: -40, dy: 0 });
    const moved = await page.evaluate(lab);
    assert.ok(Math.abs(moved.x - before.x + 40) < 1.5 && Math.abs(moved.y - before.y) < 1.5, `the label moved from ${JSON.stringify(before)} to ${JSON.stringify(moved)}`);
    await zoomTo(page, 2);
    // the left edge of the box is inside the slide, and the drawing runs past it
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-mask-cut')].map((c) => c.dataset.edge)`), ['left']);
    await press(page, 'Enter');
    assert.equal(await editing(page), false);
    assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-mask-cut').length`), 0);
    const edited = await render(page);
    const tag = edited.match(/<div class="backdrop" data-backdrop="nest"[^>]*>/)[0];
    assert.match(tag, /^<div class="backdrop" data-backdrop="nest" data-cx="[\d.]+" data-cy="0" data-half="0\.25">$/);
    assert.notEqual(tag, NEST);
    assert.equal(edited, replaced(page.source, NEST, tag));
    const view = () => page.evaluate(`(() => { const o = Beeson.backdrops.find((b) => b.el.matches('section.present .backdrop')); return o.view; })()`);
    assert.equal((await view()).half, 0.25);
    // an undo draws the window of the file again, with its labels
    await undo(page);
    assert.deepEqual(await view(), { cx: 0.97, cy: 0, half: 0.5 });
    const back = await page.evaluate(lab);
    assert.ok(Math.abs(back.x - before.x) < 1 && Math.abs(back.y - before.y) < 1);
    await redo(page);
    assert.equal((await view()).half, 0.25);
    await checkEdit(page, edited);
  });

  test(`a double click on a backdrop edits its window, and Esc leaves it as it was (${platform})`, async () => {
    const page = await maskPage(platform, 9);
    const point = await page.evaluate(`(() => { const r = document.querySelector('section.present .backdrop').getBoundingClientRect(); return { x: r.left + r.width * 0.7, y: r.top + r.height * 0.45 }; })()`);
    await click(page, point, { count: 2 });
    await page.waitFor(`!!document.querySelector('${BAR}[open]')`);
    await zoomTo(page, 0.5);
    const half = await page.evaluate(`Beeson.backdrops.find((b) => b.el.matches('section.present .backdrop')).view.half`);
    assert.ok(Math.abs(half - 2.6) < 1e-6);
    // the backdrop of a figure slide fills the slide, hence none of its edges is marked
    assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-mask-cut').length`), 0);
    await press(page, 'Escape');
    assert.equal(await editing(page), false);
    assert.equal(await page.evaluate(`Beeson.backdrops.find((b) => b.el.matches('section.present .backdrop')).view.half`), 1.3);
    assert.equal(await render(page), page.source);
  });

  test(`Flip Horizontal and Flip Vertical write the sign of scale on an image only (${platform})`, async () => {
    const page = await maskPage(platform, 3);
    await click(page, 'section.present p');
    assert.equal((await state(page, 'arrange.flipHorizontal')).enabled, false);
    await click(page, IMG);
    await click(page, IMG);
    // the context menu and the Arrange pane offer the flips for an image
    await click(page, IMG, { button: 'right' });
    const items = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu')].map((m) => m.textContent).join(' ')`);
    for (const label of ['Flip Horizontal', 'Flip Vertical', 'Edit Mask', 'Reset Mask']) assert.ok(items.includes(label), `the context menu does not have ${label}`);
    await press(page, 'Escape');
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await tap(page, 'Arrange');
    await tap(page, 'Flip Horizontal');
    let edited = await render(page);
    assert.equal(edited, onPair(page.source, 'scale: -1 1'));
    await checkEdit(page, edited);
    await selectImage(page);
    await exec(page, 'arrange.flipVertical');
    edited = await render(page);
    assert.equal(edited, onPair(page.source, 'scale: -1 -1'));
    assert.deepEqual(textProblems(edited, THEME), textProblems(page.source, THEME));
    await exec(page, 'arrange.flipHorizontal');
    await exec(page, 'arrange.flipVertical');
    assert.equal(await render(page), page.source);
    // a flip keeps the zoom of a mask, and Reset Mask keeps the flip
    await exec(page, 'arrange.flipHorizontal');
    await exec(page, 'image.editMask');
    await zoomTo(page, 1.5);
    await press(page, 'Enter');
    assert.equal(await written(page), 'scale: -1.5 1.5; clip-path: inset(16.667%)');
    await exec(page, 'image.resetMask');
    assert.equal(await written(page), 'scale: -1 1');
  });
}
