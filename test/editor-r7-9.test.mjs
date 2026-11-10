// regression tests of R7.9 on both platforms with trusted input, for the places where round 3 of
// the council was worse than round 2. the caption of a figure is moved with its image and kept
// under it at a move or a resize of the image alone, and not at a rotation of the image. the four
// order commands act on the figure of a selected image. Esc on a selected image selects its
// figure, also with the focus on a button of the inspector, and the inspector then shows the pane
// of the figure. the formula sheets are kept beside their target inside the canvas, and a table
// is not rotated. after each edit the text is checked byte for byte, after an undo and a redo, and
// after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const TABLES = 'test/pages/editor-tables.html';
// the slides of the demo deck with the display formula and with the figure and its caption
const EQUATIONS = 3;
const FIGURE = 4;
const IMG = '.reveal section.present figure.zone > img';
const CAPTION = '.reveal section.present figure.zone > figcaption';
const PANEL = '#beeson-edit-panel-format';

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
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const inside = (a, b) => a.left >= b.left && a.top >= b.top && a.right <= b.right && a.bottom <= b.bottom;
let saves = 0;

// the selected elements, each named by its tag and its classes of the deck
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => [el.localName, ...el.classList].filter((c) => !c.startsWith('beeson-') && c !== 'visible' && c !== 'current-fragment').join('.'))`);
// the center of the first shown element of a selector, in CSS px of the window
const centerOf = (page, selector) => page.evaluate(`(() => {
  const r = [...document.querySelectorAll(${js(selector)})].map((e) => e.getBoundingClientRect()).find((r) => r.width);
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);
// the box of the first element of a selector, with its right and bottom edges
const rectOf = (page, selector) => page.evaluate(`(() => {
  const b = [...document.querySelectorAll(${js(selector)})].map((e) => e.getBoundingClientRect()).filter((r) => r.width).pop();
  return { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
})()`);
const canvasOf = (page) => page.evaluate('(() => { const v = window.BeesonEditorShell.stage.viewport; return { left: v.left, top: v.top, right: v.right, bottom: v.bottom }; })()');
const pane = (page) => page.evaluate(`document.querySelector('${PANEL} .ed-panes')?.dataset.pane`);
const tabs = (page) => page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].map((b) => b.textContent)`);
const showTab = async (page, name) => {
  await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].find((b) => b.textContent === ${js(name)})?.click()`);
  await frames(page);
};

// the editor on the slide n of a deck served over HTTP, in a window of 1600 by 1000 px as in the
// shoot of the council, with the Format tab shown
async function load(t, platform, { deck = 'index.html', n = FIGURE } = {}) {
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
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks the text before byte for byte after undos undos, the edit after as many redos,
// and an open of the saved edit without problems, which is the text before the next check
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r7-9-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

// the place of the caption from the lower left corner of the picture of the shown image, i.e. the
// image fitted into its box with object-fit contain, in screen px
const captionFromPicture = (page) => page.evaluate(`(() => {
  const img = [...document.querySelectorAll(${js(IMG)})].find((e) => e.getBoundingClientRect().width);
  const r = img.getBoundingClientRect();
  let w = r.width, h = r.height;
  if (getComputedStyle(img).objectFit === 'contain') {
    const k = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
    w = img.naturalWidth * k;
    h = img.naturalHeight * k;
  }
  const left = r.left + (r.width - w) / 2, bottom = r.top + (r.height + h) / 2;
  const c = document.querySelector(${js(CAPTION)}).getBoundingClientRect();
  return { dx: c.left - left, dy: c.top - bottom, left, bottom, caption: { left: c.left, top: c.top } };
})()`);

function sameOffset(now, before, what) {
  const ok = Math.abs(now.dx - before.dx) <= 1.5 && Math.abs(now.dy - before.dy) <= 1.5;
  assert.ok(ok, `${what}: the caption is at ${js([now.dx, now.dy])} from the lower left corner of the image, and not at ${js([before.dx, before.dy])} as before`);
}

const gripAt = (page, handle) => page.evaluate(`(() => {
  const g = [...document.querySelectorAll('.beeson-grip[data-handle="${handle}"]')].find((g) => !g.hidden && g.getBoundingClientRect().width);
  const r = g.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);
// the image selected again after an open of the saved text, which clears the selection
async function reselect(page) {
  await page.evaluate(`Reveal.slide(${FIGURE})`);
  await frames(page);
  await click(page, IMG);
  assert.deepEqual(await selected(page), ['img.for-dark']);
}
const release = (page, at) => page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', clickCount: 1 });

async function openBar(page, bar) {
  await click(page, await page.evaluate(`(() => {
    const r = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)}).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`));
  await frames(page);
}
const menuItems = (page) =>
  page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => ({ label: i.querySelector('.label')?.textContent ?? '', dimmed: i.getAttribute('aria-disabled') === 'true' }))`);

// the caption of a figure, kept under its image
for (const platform of PLATFORMS) {
  test(`a drag of the image of a figure moves its caption with it (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, IMG);
    assert.deepEqual(await selected(page), ['img.for-dark'], 'a click on the image does not select the image alone');
    const rest = await captionFromPicture(page);
    const from = await centerOf(page, IMG);
    await drag(page, from, { dx: -80, dy: 20, hold: true });
    const held = await captionFromPicture(page);
    assert.ok(Math.abs(held.left - rest.left) > 40, 'the image is not moved by the drag');
    sameOffset(held, rest, 'while the image is dragged');
    await release(page, { x: from.x - 80, y: from.y + 20 });
    await frames(page);
    sameOffset(await captionFromPicture(page), rest, 'after the drag');
    assert.match(await render(page), /<figcaption class="caption" style="translate: -?\d+px -?\d+px">/);
    await roundTrip(page);
  });

  test(`a resize of the image of a figure keeps its caption under it (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, IMG);
    const rest = await captionFromPicture(page);
    const at = await gripAt(page, 'se');
    await drag(page, at, { dx: -90, dy: -60, hold: true });
    const held = await captionFromPicture(page);
    assert.ok(held.bottom < rest.bottom - 30, 'the image is not shrunk by the drag of its grip');
    sameOffset(held, rest, 'while the image is resized');
    await release(page, { x: at.x - 90, y: at.y - 60 });
    await frames(page);
    sameOffset(await captionFromPicture(page), rest, 'after the resize');
    await roundTrip(page);
  });

  test(`the keys, the fields, and Reset Position move the caption with the image, and a rotation does not (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, IMG);
    const rest = await captionFromPicture(page);
    // three nudges in a row are one entry of the history
    for (let i = 0; i < 3; i++) await press(page, 'Shift+ArrowLeft');
    await frames(page);
    const nudged = await captionFromPicture(page);
    assert.ok(nudged.left < rest.left - 5, 'the image is not nudged');
    sameOffset(nudged, rest, 'after three nudges');
    await roundTrip(page);
    await reselect(page);

    await exec(page, 'arrange.setPosition', { y: 100 });
    await frames(page);
    sameOffset(await captionFromPicture(page), rest, 'after a position typed in Y');
    await roundTrip(page);
    await reselect(page);

    await exec(page, 'arrange.setSize', { w: 420 });
    await frames(page);
    sameOffset(await captionFromPicture(page), rest, 'after a width typed in W');
    await roundTrip(page);
    await reselect(page);

    await exec(page, 'arrange.resetPosition');
    await frames(page);
    sameOffset(await captionFromPicture(page), rest, 'after Reset Position');
    await roundTrip(page);
    await reselect(page);

    // a turn of the image alone leaves its caption where it is, and the start tag of the caption
    // as it was
    const before = await captionFromPicture(page);
    const text = await render(page);
    await exec(page, 'arrange.setRotation', { deg: 30 });
    await frames(page);
    const turned = await captionFromPicture(page);
    assert.ok(Math.abs(turned.caption.left - before.caption.left) <= 1 && Math.abs(turned.caption.top - before.caption.top) <= 1, 'the caption is moved by a rotation of the image');
    const captionTag = (s) => s.match(/<figcaption[^>]*>/g);
    assert.deepEqual(captionTag(await render(page)), captionTag(text));
    await roundTrip(page);
  });

}

// the order of the figure of a selected image
for (const platform of PLATFORMS) {
  test(`the order commands act on the figure of a selected image (${platform})`, async (t) => {
    const page = await load(t, platform);
    const orders = ['front', 'forward', 'backward', 'back'];
    const states = async () => Object.fromEntries(await Promise.all(orders.map(async (o) => [o, (await state(page, `arrange.order.${o}`)).enabled])));
    // the states with the figure selected, which the states with its image must match
    await click(page, IMG);
    await exec(page, 'selection.container');
    assert.deepEqual(await selected(page), ['figure.zone']);
    const figure = await states();
    assert.equal(figure.backward && figure.back, true, `Send Backward and Send to Back are dimmed for the figure: ${js(figure)}`);
    await exec(page, 'arrange.order.back');
    const byFigure = await render(page);
    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);

    await click(page, '.reveal section.present h2');
    await press(page, 'Escape');
    await click(page, IMG);
    assert.deepEqual(await selected(page), ['img.for-dark']);
    assert.deepEqual(await states(), figure, 'the order commands of the image are not those of its figure');
    await showTab(page, 'Arrange');
    const buttons = await page.evaluate(`Object.fromEntries(${js(orders)}.map((o) => [o, !document.querySelector('${PANEL} button[data-command="arrange.order.' + o + '"]')?.disabled]))`);
    assert.deepEqual(buttons, figure, 'the order buttons of the Arrange pane are not live as for the figure');
    await openBar(page, 'Arrange');
    const items = await menuItems(page);
    for (const label of ['Send Backward', 'Send to Back']) assert.equal(items.find((i) => i.label === label)?.dimmed, false, `${label} is dimmed in the Arrange menu: ${js(items)}`);
    await press(page, 'Escape');
    await frames(page);
    // Send to Back of the pane moves the figure as with the figure selected, and keeps the image
    // selected
    await click(page, `${PANEL} button[data-command="arrange.order.back"]`);
    await frames(page);
    assert.equal(await render(page), byFigure, 'Send to Back of the image does not move its figure');
    assert.deepEqual(await selected(page), ['img.for-dark'], 'the image is not selected after Send to Back');
    await roundTrip(page);
  });

}

// Esc on a selected image, and the pane of its figure
for (const platform of PLATFORMS) {
  test(`Esc on a selected image selects its figure, with the pane of the figure, after a click on the inspector (${platform})`, async (t) => {
    const page = await load(t, platform);
    // the focus on the tab Format of the inspector, as the photographer of the council left it
    const format = await page.evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Format' && b.getBoundingClientRect().left > innerWidth * 0.75 && b.getBoundingClientRect().top > 80);
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await click(page, format);
    await frames(page);
    await click(page, IMG);
    await frames(page);
    assert.deepEqual(await selected(page), ['img.for-dark']);
    assert.equal(await pane(page), 'image');
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await selected(page), ['figure.zone'], 'Esc on the selected image does not select its figure');
    assert.equal(await pane(page), 'arrange', `the inspector shows the pane ${await pane(page)} for the figure`);
    assert.ok(!(await tabs(page)).includes('Image'), `the inspector offers the Image pane for the figure: ${js(await tabs(page))}`);
    // Select Figure shows the same pane, and Esc on the selected figure clears the selection
    await click(page, '.reveal section.present h2');
    await press(page, 'Escape');
    await click(page, IMG);
    await exec(page, 'selection.container');
    await frames(page);
    assert.deepEqual(await selected(page), ['figure.zone']);
    assert.equal(await pane(page), 'arrange');
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await selected(page), []);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

}

// the formula sheets, kept inside the canvas
for (const platform of PLATFORMS) {
  test(`the sheet of a new formula is kept beside it inside the canvas, off the figure and its caption (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, '.reveal section.present ul > li:last-child');
    await press(page, 'Escape');
    await exec(page, 'insert.formula');
    await page.waitFor(`!!document.querySelector('.beeson-math')`);
    await sleep(300);
    const pop = await rectOf(page, '.beeson-math');
    const target = await rectOf(page, '.reveal section.present div.math');
    const caption = await rectOf(page, CAPTION);
    const canvas = await canvasOf(page);
    assert.ok(inside(pop, canvas), `the sheet ${js(pop)} is not inside the canvas ${js(canvas)}`);
    assert.ok(!meets(pop, target), `the sheet ${js(pop)} is put over its formula ${js(target)}`);
    assert.ok(!meets(pop, caption), `the sheet ${js(pop)} is put over the caption ${js(caption)}`);
    assert.ok(pop.bottom <= target.top, `the sheet ${js(pop)} is not flipped above its formula ${js(target)}`);
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('.beeson-math')`);
    if ((await render(page)) !== page.source) await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
  });

  test(`the TeX sheet of a display formula is kept inside the canvas (${platform})`, async (t) => {
    const page = await load(t, platform, { n: EQUATIONS });
    await click(page, '.reveal section.present div.math mjx-container');
    await page.waitFor(`!!document.querySelector('.beeson-math')`);
    await sleep(300);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-math .title').textContent`), 'Edit Formula');
    const pop = await rectOf(page, '.beeson-math');
    const canvas = await canvasOf(page);
    assert.ok(inside(pop, canvas), `the sheet ${js(pop)} is drawn past the canvas ${js(canvas)}`);
    assert.ok(!meets(pop, await rectOf(page, '.reveal section.present div.math')), 'the sheet is put over its formula');
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('.beeson-math')`);
    await byteExact(page);
  });

}

// a table, which is not rotated
for (const platform of PLATFORMS) {
  test(`a table is drawn without a rotate handle, and no rotation acts on it (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: TABLES, n: 1 });
    const rotor = () => page.evaluate(`(() => { const r = document.querySelector('.beeson-rotor'); return !!r && !r.hidden && getComputedStyle(r).display !== 'none'; })()`);
    const cell = (r, c) => `.reveal section.present table tr:nth-child(${r + 1}) > :nth-child(${c + 1})`;
    // a range of cells selected by a drag, as in the state of the council
    const a = await centerOf(page, cell(1, 0));
    const b = await centerOf(page, cell(2, 1));
    await drag(page, a, { dx: b.x - a.x, dy: b.y - a.y });
    await frames(page);
    assert.equal(await rotor(), false, 'a rotate handle is drawn on a range of cells');
    // the table selected as an element
    await click(page, cell(0, 0));
    await press(page, 'Escape');
    await frames(page);
    if ((await selected(page))[0] !== 'table') await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await selected(page), ['table']);
    assert.equal(await rotor(), false, 'a rotate handle is drawn on a selected table');
    assert.equal((await state(page, 'arrange.setRotation')).enabled, false, 'Rotate is enabled on a table');
    await exec(page, 'arrange.setRotation', { deg: 30 });
    await byteExact(page);
    await showTab(page, 'Arrange');
    const angle = await page.evaluate(`[...document.querySelectorAll('${PANEL} input')].some((i) => i.closest('label, .ed-field, .ed-row')?.textContent?.includes('Angle') && !i.disabled)`);
    assert.equal(angle, false, 'the Angle field of the Arrange pane is live for a table');
    assert.deepEqual(errors(page), []);
  });
}
