// a backdrop as an element of the editor, on both platforms: a click selects it and a drag from
// it unselected draws a marquee, Delete, Copy, and Paste act on it, a drag and the arrow keys pan
// its window, the pane Backdrop writes its drawing, window, labels, and motion, Media > Backdrop…
// adds or replaces one from a gallery, a grip resizes its box with the drawing kept in place, and
// the Slide pane and the Format menu reach it. each edit is checked byte for byte, after an undo
// and a redo, against the scope rule, and after a save and an open of the saved text

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { declarationProblem, textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const DECK = 'test/pages/editor-r20-6.html';
const PLATFORMS = ['mac', 'other'];
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const PANEL = '#beeson-edit-panel-format';
const NEST = '<div class="backdrop" data-scene="nest" data-cx="0.97" data-cy="0" data-half="0.5">';
const NEST_UNIT = `\n  ${NEST}</div>`;
const BACK = 'section.present .backdrop';
const BARE = '<section>\n  <h2>A content slide without a backdrop</h2>';
const GROUND = `<section>\n  ${NEST}</div>\n  <h2>A content slide without a backdrop</h2>`;

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
const undoLabel = (page) => state(page, 'edit.undo').then((s) => s.label);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => el.matches('.backdrop') ? 'backdrop' : el.localName)`);
// the live drawing of the backdrop of the current slide, and the number of entries of
// Beeson.backdrops for its element
const live = (page) => page.evaluate(`(() => {
  const el = document.querySelector('${BACK}');
  const o = el && Beeson.backdrops.find((b) => b.el === el);
  return o ? { ...o.view, strands: o.strands.length, raf: o.raf, done: o.done, canvases: el.querySelectorAll(':scope > canvas').length, count: Beeson.backdrops.filter((b) => b.el === el).length } : null;
})()`);
// the point at fractions u, v of the box of the backdrop of the current slide, in CSS pixels
const at = (page, u, v) => page.evaluate(`(() => { const r = document.querySelector('${BACK}').getBoundingClientRect(); return { x: r.left + r.width * ${u}, y: r.top + r.height * ${v} }; })()`);
// the screen pixels per slide pixel
const scale = (page) => page.evaluate(`document.querySelector('section.present').getBoundingClientRect().width / 1920`);

// the editor on the deck at slide n. with motion, the page does not ask for reduced motion and the
// URL is without still, so that a backdrop can be traced
async function backdropPage(platform, n, motion = false) {
  await last?.close().catch(() => {});
  const page = await browser.newPage(motion ? { motion: true } : undefined);
  last = page;
  await page.goto(`${server.origin}/${DECK}?edit${motion ? '' : '&still'}&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  Object.assign(page, { platform, n, motion });
  const s = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// a trusted click on the button or checkbox of the inspector with a text, a title, or a label of name
async function tap(page, name) {
  const point = await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('${PANEL} button, ${PANEL} label.ed-check')].find((b) => b.textContent.trim() === ${JSON.stringify(name)} || b.title === ${JSON.stringify(name)} || b.getAttribute('aria-label') === ${JSON.stringify(name)});
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(point, `the inspector does not have a button ${name}`);
  await click(page, point);
  await frames(page);
}

async function showFormat(page) {
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await frames(page);
}

// the selection left with a click into the heading of the slide and Escape twice
async function leave(page) {
  await click(page, 'section.present h2');
  await press(page, 'Escape');
  await press(page, 'Escape');
}

function replaced(text, before, after) {
  assert.equal(text.split(before).length, 2, `${before} does not occur once`);
  return text.replace(before, () => after);
}

// a new page of the editor on the source at the same slide, since BeesonEditor.open pairs a text
// with the page as it is drawn
async function reopen(page) {
  const fresh = await backdropPage(page.platform, page.n, page.motion);
  await showFormat(fresh);
  return fresh;
}

async function checkEdit(page, edited) {
  assert.deepEqual(textProblems(edited, THEME), textProblems(page.source, THEME));
  await undo(page);
  assert.equal(await render(page), page.source);
  await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page);
  assert.equal(text, edited);
}

test('the scope rule takes a width and a height in px on a backdrop', () => {
  assert.equal(declarationProblem('div', ['backdrop'], 'width', '920px'), null);
  assert.equal(declarationProblem('div', ['backdrop'], 'height', '1080px'), null);
  assert.match(declarationProblem('div', ['backdrop'], 'width', '50%'), /width/);
  assert.match(declarationProblem('div', ['zone'], 'height', '300px'), /height/);
});

for (const platform of PLATFORMS) {
  test(`a click selects a backdrop with a frame and grips, and a drag from it draws a marquee (${platform})`, async () => {
    const page = await backdropPage(platform, 1);
    await click(page, await at(page, 0.7, 0.6));
    assert.deepEqual(await selected(page), ['backdrop']);
    const shown = await page.evaluate(`(() => {
      const r = document.querySelector('${BACK}').getBoundingClientRect();
      const f = [...document.querySelectorAll('.beeson-frame.selected')].find((f) => !f.hidden).getBoundingClientRect();
      const grips = [...document.querySelectorAll('.beeson-grip')].filter((g) => !g.hidden).length;
      return { off: Math.abs(f.left - r.left) + Math.abs(f.width - r.width), grips, handle: !document.querySelector('.beeson-handle').hidden, rotor: !document.querySelector('.beeson-rotor').hidden };
    })()`);
    assert.ok(shown.off < 2, `the frame is ${shown.off} px off the box`);
    assert.equal(shown.grips, 8);
    assert.equal(shown.handle, false);
    assert.equal(shown.rotor, false);
    assert.equal((await state(page, 'element.delete')).enabled, true);
    // a click on the slide outside the backdrop clears the selection, and a drag from the
    // backdrop then draws a marquee over the text
    await click(page, await at(page, -0.3, 0.95));
    assert.deepEqual(await selected(page), []);
    const k = await scale(page);
    await drag(page, await at(page, 0.2, 0.3), { dx: -700 * k, dy: -200 * k });
    const marquee = await selected(page);
    assert.ok(marquee.length > 0 && !marquee.includes('backdrop'), `the marquee selected ${marquee}`);
    await click(page, await at(page, 0.7, 0.6), { button: 'right' });
    assert.deepEqual(await selected(page), ['backdrop']);
    const items = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu')].map((m) => m.textContent).join(' ')`);
    for (const label of ['Delete', 'Copy', 'Edit Window', 'Fit Window', 'Preview']) assert.ok(items.includes(label), `the menu does not have ${label}`);
    await press(page, 'Escape');
    assert.equal(await render(page), page.source);
  });

  test(`Delete removes a backdrop, an undo draws it again, and a lock turns Delete off (${platform})`, async () => {
    const page = await backdropPage(platform, 1);
    await click(page, await at(page, 0.7, 0.6));
    await exec(page, 'element.delete');
    const edited = await render(page);
    assert.equal(edited, replaced(page.source, NEST_UNIT, ''));
    await undo(page);
    await frames(page);
    assert.equal(await render(page), page.source);
    assert.equal((await live(page)).canvases, 2);
    await redo(page);
    assert.equal(await render(page), edited);
    await undo(page);
    await click(page, await at(page, 0.7, 0.6));
    await exec(page, 'arrange.lock');
    assert.equal((await state(page, 'element.delete')).enabled, false);
  });

  test(`a backdrop pasted onto a slide without one goes to the ground of the slide (${platform})`, async () => {
    const page = await backdropPage(platform, 1);
    await click(page, await at(page, 0.7, 0.6));
    // the commands of the keys, since headless Chrome does not fire a paste event at Mod+V
    await exec(page, 'edit.copy');
    await page.evaluate('Reveal.slide(2)');
    await frames(page);
    await leave(page);
    await exec(page, 'edit.paste');
    await frames(page);
    const edited = await render(page);
    assert.equal(edited, replaced(page.source, BARE, GROUND));
    assert.deepEqual(await selected(page), ['backdrop']);
    assert.equal((await live(page)).canvases, 2);
    await checkEdit(page, edited);
  });

  test(`a drag on a selected backdrop and the arrow keys pan its window as one entry (${platform})`, async () => {
    let page = await backdropPage(platform, 1);
    await click(page, await at(page, 0.7, 0.6));
    const k = await scale(page);
    await drag(page, await at(page, 0.5, 0.5), { dx: -108 * k, dy: 54 * k });
    assert.equal(await undoLabel(page), 'Undo Move Backdrop');
    let edited = await render(page);
    // the drawing is at 1080 slide px per unit, hence 108 px to the left shows 0.1 more of its right
    const panned = '<div class="backdrop" data-scene="nest" data-cx="1.07" data-cy="0.05" data-half="0.5">';
    assert.equal(edited, replaced(page.source, NEST, panned));
    assert.deepEqual(await selected(page), ['backdrop']);
    const v = await live(page);
    assert.ok(Math.abs(v.cx - 1.07) < 1e-9 && Math.abs(v.cy - 0.05) < 1e-9, JSON.stringify(v));
    await checkEdit(page, edited);
    page = await reopen(page);
    await click(page, await at(page, 0.7, 0.6));
    await press(page, 'ArrowLeft');
    await press(page, 'Shift+ArrowUp');
    await press(page, 'Shift+ArrowUp');
    edited = await render(page);
    assert.doesNotMatch(edited, /translate/);
    const tag = edited.match(/<div class="backdrop" data-scene="nest"[^>]*>/)[0];
    const cx = Number(tag.match(/data-cx="([^"]+)"/)[1]), cy = Number(tag.match(/data-cy="([^"]+)"/)[1]);
    assert.ok(Math.abs(cx - (0.97 + 1 / 1080)) < 2e-3 && Math.abs(cy + 20 / 1080) < 2e-3, tag);
    await undo(page);
    assert.equal(await render(page), page.source);
  });

  test(`the pane Backdrop writes the window, the drawing, the labels, and the motion (${platform})`, async () => {
    let page = await backdropPage(platform, 1);
    await showFormat(page);
    await click(page, await at(page, 0.7, 0.6));
    await frames(page);
    const tabs = await page.evaluate(`[...document.querySelectorAll('${PANEL} button')].map((b) => b.textContent.trim())`);
    assert.ok(!tabs.includes('Arrange'), `the pane has the tab Arrange`);
    const titles = await page.evaluate(`[...document.querySelectorAll('${PANEL} h5')].map((h) => h.textContent)`);
    for (const t of ['Drawing', 'Window', 'Labels', 'Motion']) assert.ok(titles.includes(t), `the pane does not have ${t}`);
    const field = await page.evaluate(`(() => { const i = document.querySelector('${PANEL} input[name="Half Height"]'); const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await click(page, field, { count: 3 });
    await type(page, '0.4');
    await press(page, 'Enter');
    await frames(page);
    let edited = await render(page);
    assert.equal(edited, replaced(page.source, NEST, NEST.replace('data-half="0.5"', 'data-half="0.4"')));
    assert.equal((await live(page)).half, 0.4);
    await checkEdit(page, edited);
    page = await reopen(page);
    await click(page, await at(page, 0.7, 0.6));
    // a new scene is drawn by a new Orbits of the theme, and an undo draws nest again
    await exec(page, 'backdrop.scene', { value: 'tubes' });
    await frames(page);
    edited = await render(page);
    assert.equal(edited, replaced(page.source, NEST, NEST.replace('nest', 'tubes')));
    const tubes = await live(page);
    assert.equal(tubes.count, 1);
    assert.equal(tubes.canvases, 2);
    await undo(page);
    await frames(page);
    const nest = await live(page);
    assert.ok(nest.strands < tubes.strands, `nest has ${nest.strands} strands and tubes ${tubes.strands}`);
    assert.equal(nest.count, 1);
    await redo(page);
    await checkEdit(page, edited);
    page = await reopen(page);
    await click(page, await at(page, 0.7, 0.6));
    await frames(page);
    await tap(page, 'L1');
    await tap(page, 'Moon');
    edited = await render(page);
    assert.equal(edited, replaced(page.source, NEST_UNIT, `\n  ${NEST}\n    <span class="lab" data-at="L1" data-dy="-34">\\(\\LL{1}\\)</span>\n    <span class="lab" data-at="moon" data-dy="36">Moon</span>\n  </div>`));
    const labs = await page.evaluate(`[...document.querySelectorAll('${BACK} .lab')].map((l) => l.style.left)`);
    assert.equal(labs.length, 2);
    assert.ok(labs.every((l) => l && l !== '0px'), `the labels are at ${labs}`);
    await tap(page, 'L1');
    await tap(page, 'Moon');
    assert.equal(await render(page), page.source);
    await tap(page, 'Live');
    assert.equal(await render(page), replaced(page.source, NEST, NEST.replace('>', ' data-live>')));
    await undo(page);
    await tap(page, 'Edit Window…');
    assert.equal(await page.evaluate(`!!document.querySelector('dialog.beeson-mask-bar[open]')`), true);
    await press(page, 'Escape');
    assert.equal(await render(page), page.source);
  });

  test(`Preview traces a backdrop, and an edit leaves it complete (${platform})`, async () => {
    const page = await backdropPage(platform, 1, true);
    await click(page, await at(page, 0.7, 0.6));
    await exec(page, 'backdrop.preview');
    await frames(page);
    let v = await live(page);
    assert.ok(v.raf > 0 && !v.done, 'the backdrop is not traced');
    await exec(page, 'backdrop.half', { value: 0.45 });
    await frames(page);
    v = await live(page);
    assert.equal(v.raf, 0);
    assert.equal(v.done, true);
    assert.equal(await page.evaluate('Beeson.backdrops.every((b) => !b.raf)'), true);
  });

  test(`Media > Backdrop… adds a backdrop from the gallery, or replaces the drawing in its start tag (${platform})`, async () => {
    let page = await backdropPage(platform, 2);
    await leave(page);
    assert.equal((await state(page, 'insert.backdrop')).label, 'Backdrop…');
    await exec(page, 'insert.backdrop');
    await page.waitFor(`document.querySelectorAll('.beeson-backdrop-gallery [data-tile]').length >= 3`);
    const tiles = await page.evaluate(`[...document.querySelectorAll('.beeson-backdrop-gallery [data-tile]')].map((t) => t.dataset.tile)`);
    for (const name of ['nest', 'tubes', 'wideRibbon']) assert.ok(tiles.includes(name), `the gallery does not have ${name}`);
    // each tile is drawn on two canvases of its own, outside Beeson.backdrops
    assert.ok((await page.evaluate(`document.querySelectorAll('.beeson-backdrop-gallery [data-tile] canvas').length`)) >= 6);
    const count = await page.evaluate('Beeson.backdrops.length');
    await click(page, '.beeson-backdrop-gallery [data-tile="nest"]');
    await frames(page);
    const edited = await render(page);
    assert.equal(edited, replaced(page.source, BARE, GROUND));
    assert.deepEqual(await selected(page), ['backdrop']);
    assert.equal(await page.evaluate('Beeson.backdrops.length'), count + 1);
    assert.equal(await undoLabel(page), 'Undo Add Backdrop');
    await checkEdit(page, edited);
    page = await reopen(page);
    await page.evaluate('Reveal.slide(1)');
    await frames(page);
    await click(page, await at(page, 0.7, 0.6));
    await exec(page, 'insert.backdrop');
    await page.waitFor(`!!document.querySelector('.beeson-backdrop-gallery [data-tile="tubes"]')`);
    await click(page, '.beeson-backdrop-gallery [data-tile="tubes"]');
    await frames(page);
    const tag = (await render(page)).match(/<h2>A content slide with a backdrop<\/h2>[\s\S]*?(<div class="backdrop"[^>]*>)/)[1];
    assert.match(tag, /^<div class="backdrop" data-scene="tubes" data-cx="[-\d.]+" data-cy="[-\d.]+" data-half="[\d.]+">$/);
    assert.equal(await undoLabel(page), 'Undo Replace Backdrop');
    assert.equal((await live(page)).count, 1);
  });

  test(`a grip resizes the box of a backdrop and keeps the drawing in place (${platform})`, async () => {
    const page = await backdropPage(platform, 1);
    await click(page, await at(page, 0.7, 0.6));
    // the place of the Moon of the drawing on the slide, in slide px
    const moon = `(() => {
      const el = document.querySelector('${BACK}'), o = Beeson.backdrops.find((b) => b.el === el);
      const s = document.querySelector('section.present').getBoundingClientRect(), r = el.getBoundingClientRect(), k = s.width / 1920;
      const per = r.height / 2 / o.view.half;
      return { x: (r.left - s.left + r.width / 2 + (0.98785 - o.view.cx) * per) / k, y: (r.top - s.top + r.height / 2 + o.view.cy * per) / k };
    })()`;
    const before = await page.evaluate(moon);
    const grip = await page.evaluate(`(() => { const g = [...document.querySelectorAll('.beeson-grip[data-handle="w"]')].find((g) => !g.hidden); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await drag(page, grip, { dx: -200 * (await scale(page)), dy: 0 });
    await frames(page);
    const edited = await render(page);
    const tag = edited.match(/<div class="backdrop" data-scene="nest"[^>]*>/)[0];
    assert.match(tag, /^<div class="backdrop" data-scene="nest" data-cx="[\d.]+" data-cy="0" data-half="0\.5" style="translate: -200px 0px; width: 920px; height: 1080px">$/);
    assert.ok(Math.abs(Number(tag.match(/data-cx="([^"]+)"/)[1]) - (0.97 - 100 / 1080)) < 1e-3, tag);
    assert.equal(edited, replaced(page.source, NEST, tag));
    const now = await page.evaluate(moon);
    assert.ok(Math.abs(now.x - before.x) < 1 && Math.abs(now.y - before.y) < 1, `the Moon moved from ${JSON.stringify(before)} to ${JSON.stringify(now)}`);
    assert.equal(await undoLabel(page), 'Undo Resize Backdrop');
    await checkEdit(page, edited);
    await exec(page, 'slide.reset');
    assert.doesNotMatch((await render(page)).match(/<div class="backdrop" data-scene="nest"[^>]*>/)[0], /style=/);
  });

  test(`the Slide pane and the Format menu reach the backdrop of a slide (${platform})`, async () => {
    const page = await backdropPage(platform, 1);
    await showFormat(page);
    await leave(page);
    await frames(page);
    const titles = await page.evaluate(`[...document.querySelectorAll('${PANEL} h5')].map((h) => h.textContent)`);
    assert.ok(titles.includes('Backdrop'), `the Slide pane has ${titles}`);
    assert.ok((await page.evaluate(`document.querySelector('${PANEL}').textContent`)).includes('Lyapunov Families'));
    await tap(page, 'Select');
    assert.deepEqual(await selected(page), ['backdrop']);
    for (const [id, label] of [['backdrop.edit', 'Edit Window'], ['backdrop.fitWindow', 'Fit Window'], ['backdrop.preview', 'Preview']]) {
      const s = await state(page, id);
      assert.ok(s.label.startsWith(label), `${id} is labeled ${s.label}`);
      assert.equal(s.enabled, true);
    }
    await page.evaluate('Reveal.slide(2)');
    await frames(page);
    await tap(page, 'Add Backdrop…');
    // the gallery is drawn once the files of its drawings are answered, e.g. brand/transfer.js
    await page.waitFor(`!!document.querySelector('.beeson-backdrop-gallery')`);
    await press(page, 'Escape');
    assert.equal(await render(page), page.source);
  });

  test(`the object list shows the backdrop as its last row, which selects and locks it and is not dragged (${platform})`, async () => {
    const page = await backdropPage(platform, 1);
    if (!(await state(page, 'view.objects')).checked) await exec(page, 'view.objects');
    await frames(page);
    const ROWS = '.beeson-edit-objects .row';
    const rowsOf = () => page.evaluate(`[...document.querySelectorAll('${ROWS}')].map((r) => [r.dataset.kind, r.querySelector('.name').textContent, r.getAttribute('aria-selected')])`);
    const names = await rowsOf();
    assert.deepEqual(names.at(-1).slice(0, 2), ['Backdrop', 'Backdrop: Lyapunov Families']);
    assert.equal(names.filter((r) => r[0] === 'Backdrop').length, 1);
    const rowAt = (i) => page.evaluate(`(() => { const r = [...document.querySelectorAll('${ROWS}')].at(${i}).getBoundingClientRect(); return { x: r.left + r.width / 3, y: r.top + r.height / 2 }; })()`);
    await click(page, await rowAt(-1));
    assert.deepEqual(await selected(page), ['backdrop']);
    assert.equal((await rowsOf()).at(-1)[2], 'true');
    // a drag of the row to the top of the list does not change a layer
    const top = await rowAt(0);
    const from = await rowAt(-1);
    await drag(page, from, { dy: top.y - from.y - 10 });
    await frames(page);
    assert.equal(await render(page), page.source);
    assert.equal((await rowsOf()).at(-1)[0], 'Backdrop');
    // a row dragged under the backdrop row stays in front of it
    await drag(page, await rowAt(0), { dy: from.y - top.y + 30 });
    await frames(page);
    assert.equal((await rowsOf()).at(-1)[0], 'Backdrop');
    assert.ok(!(await render(page)).includes(`${NEST}</div>\n  <h2>`), 'the heading was written behind the backdrop');
    // the padlock of the row locks the backdrop
    await page.evaluate(`[...document.querySelectorAll('${ROWS}')].at(-1).querySelector('.lock').click()`);
    await frames(page);
    const edited = await render(page);
    assert.equal(edited.match(/<div class="backdrop" data-scene="nest"[^>]*>/)[0], NEST.replace('>', ' data-locked>'));
    assert.equal(await undoLabel(page), 'Undo Lock');
  });

  test(`Zoom In, Zoom Out, Fit Window, the marks of a cut edge, and Duplicate act on a selected backdrop (${platform})`, async () => {
    const page = await backdropPage(platform, 1);
    await click(page, await at(page, 0.7, 0.6));
    const half = (h) => replaced(page.source, NEST, NEST.replace('data-half="0.5"', `data-half="${h}"`));
    await exec(page, 'backdrop.zoomIn');
    assert.equal(await render(page), half('0.4'));
    assert.equal(await undoLabel(page), 'Undo Zoom In');
    await undo(page);
    await exec(page, 'backdrop.zoomOut');
    assert.equal(await render(page), half('0.625'));
    await undo(page);
    assert.equal(await render(page), page.source);
    // a window zoomed in far cuts the drawing at the edges of the box inside the slide
    const marks = () => page.evaluate(`document.querySelectorAll('.beeson-backdrop-cuts .beeson-mask-cut').length`);
    await exec(page, 'backdrop.half', { value: 0.1 });
    await frames(page);
    assert.ok((await marks()) > 0, 'a cut edge is not marked');
    await leave(page);
    await frames(page);
    assert.equal(await marks(), 0, 'a cut edge is marked without the backdrop selected');
    await undo(page);
    await click(page, await at(page, 0.7, 0.6));
    await exec(page, 'backdrop.fitWindow');
    await frames(page);
    const fit = await render(page);
    const tag = fit.match(/<div class="backdrop" data-scene="nest"[^>]*>/)[0];
    assert.match(tag, /^<div class="backdrop" data-scene="nest" data-cx="[-\d.]+" data-cy="[-\d.]+" data-half="[\d.]+">$/);
    assert.notEqual(tag, NEST);
    assert.equal(fit, replaced(page.source, NEST, tag));
    assert.equal(await undoLabel(page), 'Undo Fit Window');
    await undo(page);
    assert.equal(await render(page), page.source);
    // a copy of a backdrop is written after it, at the ground, and is selected
    await exec(page, 'edit.duplicate');
    await frames(page);
    const dup = await render(page);
    assert.equal(dup, replaced(page.source, NEST_UNIT, NEST_UNIT + NEST_UNIT));
    assert.deepEqual(await selected(page), ['backdrop']);
    assert.equal(await page.evaluate(`document.querySelectorAll('${BACK}').length`), 2);
    await checkEdit(page, dup);
  });
}
