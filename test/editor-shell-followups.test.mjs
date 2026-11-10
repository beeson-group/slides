// follow-ups of the shell: Edit Text only on an element that holds a block, the scrim of a modal
// dialog seen in both modes of the chrome, and the inspector as a region of the keyboard

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inflateSync } from 'node:zlib';
import { launch } from '../scripts/chrome.mjs';
import { click, editorPage, press } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];

const scheme = (page, value) => page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value }] });
const frames = (page) => page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true))))');
const define = (page, command) => page.evaluate(`window.BeesonEditorShell.define(${command})`);
const centerOf = (page, selector) => page.evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getBoundingClientRect().width > 0); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const showSlideWith = async (page, selector) => {
  await page.evaluate(`Reveal.slide([...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector(${JSON.stringify(selector)})))`);
  await frames(page);
};
// whether the item of the open context menu with the label is enabled, or null when it is absent
const contextItem = (page, label) => page.evaluate(`(() => { const i = [...document.querySelectorAll('.beeson-edit-menu.context .item')].find((i) => i.querySelector('.label').textContent === ${JSON.stringify(label)}); return i ? i.getAttribute('aria-disabled') !== 'true' : null; })()`);
const editText = async (page) => (await page.evaluate(`window.BeesonEditor.state('selection.editText')`)).enabled;

// the rows of pixels of a PNG written by Chrome, with 8 bits per channel and without interlace
function decodePng(png) {
  let at = 8, width = 0, height = 0, channels = 4;
  const data = [];
  while (at < png.length) {
    const length = png.readUInt32BE(at), kind = png.toString('ascii', at + 4, at + 8), body = png.subarray(at + 8, at + 8 + length);
    if (kind === 'IHDR') ({ width, height, channels } = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), channels: body[9] === 6 ? 4 : 3 });
    if (kind === 'IDAT') data.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data)), stride = width * channels, px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[y * stride + x - channels] : 0, b = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= channels && y ? px[(y - 1) * stride + x - channels] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      px[y * stride + x] = raw[y * (stride + 1) + 1 + x] + [0, a, b, (a + b) >> 1, paeth][filter];
    }
  }
  return { width, channels, px };
}

// the mean of the three channels of the pixel at a point, given in CSS pixels of a screenshot
// taken at a device pixel ratio of 1
const gray = (image, { x, y }) => {
  const at = (Math.round(y) * image.width + Math.round(x)) * image.channels;
  return (image.px[at] + image.px[at + 1] + image.px[at + 2]) / 3;
};

// a regression test of Edit Text in the context menu of a figure without text: the command was
// enabled on a figure with a video and no text, and Keynote offers Edit Text only on an element with
// text
test('Edit Text is enabled on an element with a block and not on a figure without text', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  await showSlideWith(page, '.zone video');
  await click(page, await centerOf(page, '.reveal section.present .zone video'), { button: 'right' });
  // an item that a kind of element cannot run is left out of its menu
  assert.notEqual(await contextItem(page, 'Edit Text'), true, 'Edit Text is enabled on a figure of videos');
  await press(page, 'Escape');
  assert.equal(await editText(page), false);
  // Return into the figure still selects its video, with a command of its own
  assert.equal((await page.evaluate(`window.BeesonEditor.state('selection.selectMedia')`)).enabled, true);
  await showSlideWith(page, '.qr');
  await click(page, await centerOf(page, '.reveal section.present .qr'), { button: 'right' });
  assert.notEqual(await contextItem(page, 'Edit Text'), true, 'Edit Text is enabled on a QR code');
  await press(page, 'Escape');
  // a figure with its caption holds a block, which Return edits, and so does a heading selected as
  // an element. the menu of the image of the figure does not offer Edit Text, as in Keynote
  await showSlideWith(page, 'figure.zone');
  await click(page, await centerOf(page, '.reveal section.present figure.zone img'), { button: 'right' });
  assert.notEqual(await contextItem(page, 'Edit Text'), true, 'Edit Text is offered on the image of a figure');
  await press(page, 'Escape');
  assert.equal(await editText(page), true, 'Edit Text is disabled on a figure with a caption');
  await click(page, await centerOf(page, '.reveal section.present h2'));
  await press(page, 'Escape');
  assert.equal(await editText(page), true, 'Edit Text is disabled on a heading');
  await press(page, 'Enter');
  assert.equal(await page.evaluate(`document.activeElement.matches('.reveal section.present h2')`), true, 'Return does not put the caret into the heading');
  assert.deepEqual(page.errors, []);
});

// a regression test of the scrim of a modal dialog, which was a black of 22 percent: the window
// behind the dialog must be dimmed by at least 30 percent, and the dialog must be lighter than the
// window behind it, in both modes of the chrome
test('a modal dialog dims the window behind it in both modes', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  // an empty point of the toolbar, between the groups at the left and those at the right
  const spot = await page.evaluate(`(() => { const right = document.querySelector('.beeson-edit-top .group.right').getBoundingClientRect(); const top = document.querySelector('.beeson-edit-top').getBoundingClientRect(); return { x: right.left - 24, y: top.top + top.height / 2 }; })()`);
  for (const mode of ['light', 'dark']) {
    await scheme(page, mode);
    await frames(page);
    const before = decodePng(await page.screenshot());
    await page.evaluate(`window.answer = 'none'; window.BeesonEditorShell.ask({ title: 'Save the changes before you present?', text: 'The deck has edits that are not in index.html yet.', buttons: [{ label: 'Save', value: 'save', primary: true }, { label: 'Cancel', value: 'cancel' }] }).then((v) => { window.answer = v; }); 0`);
    await frames(page);
    await new Promise((done) => setTimeout(done, 400));
    const after = decodePng(await page.screenshot());
    const card = await page.evaluate(`(() => { const r = document.querySelector('dialog.beeson-edit-card[open]').getBoundingClientRect(); return { x: r.left + 12, y: r.top + 6 }; })()`);
    const was = gray(before, spot);
    const dimmed = gray(after, spot);
    assert.ok(dimmed <= 0.7 * was, `${mode}: the toolbar is ${dimmed.toFixed(0)} under the scrim and ${was.toFixed(0)} without it`);
    assert.ok(gray(after, card) >= dimmed + 16, `${mode}: the dialog is ${gray(after, card).toFixed(0)} over a window of ${dimmed.toFixed(0)}`);
    await press(page, 'Escape');
    await page.waitFor(`window.answer !== 'none'`);
  }
  assert.deepEqual(page.errors, []);
});

// a regression test of the region of the inspector: the tabs of the inspector were reported as the
// canvas, and F6 skipped the inspector while its Format tab was shown
for (const platform of PLATFORMS) {
  test(`F6 reaches the inspector and a command of the inspector runs there on ${platform}`, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await editorPage(browser, { query: `edit&still&edit-platform=${platform}` });
    await define(page, `{ id: 'test.inspector', label: 'Test Inspector Key', keys: { mac: ['F9'], other: ['F9'] }, in: ['inspector'], run: () => { window.ran = (window.ran ?? 0) + 1; } }`);
    if (!(await page.evaluate(`window.BeesonEditor.state('shell.format').checked`))) await page.evaluate(`window.BeesonEditor.exec('shell.format')`);
    await frames(page);
    await page.evaluate(`document.activeElement?.blur()`);
    // F9 is not taken on the canvas
    await press(page, 'F9');
    assert.equal(await page.evaluate('window.ran ?? 0'), 0);
    let reached = false;
    for (let i = 0; i < 8 && !reached; i++) {
      await press(page, 'F6');
      reached = await page.evaluate(`!!document.activeElement?.closest('.beeson-edit-inspector')`);
    }
    assert.equal(reached, true, 'F6 does not reach the inspector with its Format tab shown');
    await press(page, 'F9');
    assert.equal(await page.evaluate('window.ran ?? 0'), 1, 'the command of the inspector does not run on its tab');
    assert.deepEqual(page.errors, []);
  });
}

// the label of a toolbar button is toolbar.label, which does not follow the menu label, e.g. Undo
// for Undo Typing, and toolbar.split draws the submenu named by it as a split button
test('a toolbar button takes its label and its split from the toolbar place of its command', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  await click(page, await centerOf(page, '.reveal section.present h1'));
  await page.send('Input.insertText', { text: 'x' });
  await page.waitFor(`window.BeesonEditor.state('edit.undo').label === 'Undo Typing'`);
  const undo = await page.evaluate(`(() => { const b = document.querySelector('.beeson-edit-top [data-command="edit.undo"]'); return { text: b.textContent, title: b.title }; })()`);
  assert.equal(undo.text, 'Undo');
  assert.match(undo.title, /^Undo Typing/);
  await define(page, `{ id: 'test.lead', label: 'Long Menu Label', toolbar: { group: 'test', order: 45, icon: 'square', label: 'Short', split: 'Test Choices' }, menu: { bar: 'Insert', group: 'test', order: 90 }, run: () => {} }`);
  await define(page, `{ id: 'test.choice', label: 'Test Choice', menu: { bar: 'Insert', group: 'test', order: 91, submenu: 'Test Choices' }, run: () => { window.chose = true; } }`);
  await frames(page);
  assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-top [data-command="test.lead"]').textContent`), 'Short');
  await click(page, await centerOf(page, '.beeson-edit-top .beeson-edit-split:has([data-command="test.lead"]) .more'));
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item .label')].map((l) => l.textContent)`), ['Test Choice']);
  await press(page, 'Escape');
  assert.deepEqual(page.errors, []);
});

// the gear menu of the find panel is a menu of ui/menu.ts: a check at the mode, Esc closes the
// menu and keeps the panel, and a mode chosen in it switches the panel
test('the gear menu of the find panel is a menu of the chrome', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  await page.evaluate(`window.BeesonEditor.exec('find.open', 'orbit')`);
  await click(page, await centerOf(page, '.beeson-find .gear'));
  const menu = () => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu.find-options .item')].map((i) => [i.querySelector('.label').textContent, i.getAttribute('aria-checked')])`);
  assert.deepEqual(await menu(), [['Find', 'true'], ['Find & Replace', 'false'], ['Whole Words', 'false'], ['Match Case', 'false'], ['Search TeX of Formulas', 'false']]);
  assert.equal(await page.evaluate(`document.querySelector('.beeson-find .gear').getAttribute('aria-expanded')`), 'true');
  await press(page, 'Escape');
  assert.deepEqual(await menu(), []);
  assert.equal(await page.evaluate(`!document.querySelector('.beeson-find').hidden`), true, 'Esc in the menu closes the panel');
  assert.equal(await page.evaluate(`document.activeElement.getAttribute('aria-label')`), 'Find');
  await click(page, await centerOf(page, '.beeson-find .gear'));
  await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu.find-options .item')].find((i) => i.textContent.includes('Find & Replace')).click()`);
  assert.equal(await page.evaluate(`document.querySelector('.beeson-find').classList.contains('replacing')`), true);
  assert.deepEqual(page.errors, []);
});
