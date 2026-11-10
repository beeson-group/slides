// resizing, lines, and guides of package R5.2 on both platforms, driven with trusted input: a
// picture sized in the editor is drawn at the size written into its tag, with or without the
// editor, the fields W and H give the drawn picture, a marquee selects a line, an element snaps to
// the ends and the middle of a line and a line to the other elements, the guides placed by hand
// follow their slide, a picture is stretched with Constrain Proportions off, and a text block is
// given a width by its grips. each edit is checked byte for byte after an undo, and after a save
// and an open of the saved text

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { byteExact, click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const PLATFORMS = ['mac', 'other'];
const LAYOUTS = 'test/pages/editor-layouts.html';
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const SECTIONS = [...readFileSync(LAYOUTS, 'utf8').matchAll(/<section[\s\S]*?<\/section>/g)].map((m) => m[0]);
const MATH = SECTIONS.findIndex((s) => s.includes('<h2>Math, an ordered list, and a zone</h2>'));
const PAPER = SECTIONS.findIndex((s) => s.includes('<h2>A figure slide with a paper image</h2>'));
const ZONE_IMG = '.reveal section.present .zone > img';
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

let last = null;
let saves = 0;

// the editor on slide n of the deck of layouts, served over HTTP, with the storage of the browser
// cleared first unless keep is set
async function editor(platform, n = MATH, { keep = false } = {}) {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.send('Page.bringToFront');
  const url = `${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  if (!keep) {
    await page.evaluate('localStorage.clear()');
    await page.goto(url);
  }
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(LAYOUTS, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const near = (a, b, by = 2) => Math.abs(a - b) <= by;

async function inScope(page) {
  const now = textProblems(await render(page), THEME);
  for (const p of textProblems(page.source, THEME)) {
    const i = now.indexOf(p);
    if (i >= 0) now.splice(i, 1);
  }
  assert.deepEqual(now, []);
}

// the edit, the file again after an undo, the edit again after a redo, and a save opened again
async function roundTrip(page, edited) {
  await undo(page);
  await frames(page);
  await byteExact(page);
  await redo(page);
  await frames(page);
  assert.equal(await render(page), edited, 'a redo does not write the edit again');
  await inScope(page);
  await saveAndReopen(page, `r5-2-${++saves}.html`);
}

// the screen point of a point in slide px, and the box of an element in slide px
const screen = (page, x, y) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides');
  const r = s.getBoundingClientRect(), k = r.width / s.offsetWidth;
  return { x: r.left + ${x} * k, y: r.top + ${y} * k };
})()`);
const slideBox = (page, selector) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides');
  const r = s.getBoundingClientRect(), k = r.width / s.offsetWidth;
  const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getBoundingClientRect().width);
  const b = el.getBoundingClientRect();
  return { left: (b.left - r.left) / k, top: (b.top - r.top) / k, width: b.width / k, height: b.height / k };
})()`);

// the box of the picture of the shown image or video of selector in slide px, fitted in its box
// with object-fit contain where its style sets that
const pictureBox = (page, selector) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides');
  const sr = s.getBoundingClientRect(), k = sr.width / s.offsetWidth;
  const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getBoundingClientRect().width);
  const r = el.getBoundingClientRect();
  const [w, h] = el instanceof HTMLImageElement ? [el.naturalWidth, el.naturalHeight] : [el.videoWidth, el.videoHeight];
  let b = { left: r.left, top: r.top, width: r.width, height: r.height };
  if (w && h && getComputedStyle(el).objectFit === 'contain') {
    const q = Math.min(r.width / w, r.height / h);
    b = { left: r.left + (r.width - w * q) / 2, top: r.top + (r.height - h * q) / 2, width: w * q, height: h * q };
  }
  return { left: (b.left - sr.left) / k, top: (b.top - sr.top) / k, width: b.width / k, height: b.height / k };
})()`);

// the Arrange pane of the Format tab shown, and the values of its fields W and H
async function arrange(page) {
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await sleep(50);
  const at = await page.evaluate(`(() => { const b = [...document.querySelectorAll('${PANEL} button')].find((b) => [b.textContent.trim(), b.title, b.getAttribute('aria-label')].includes('Arrange')); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await sleep(50);
  return sizeFields(page);
}
const sizeFields = (page) => page.evaluate(`(() => {
  const f = (n) => document.querySelector('${PANEL} #beeson-edit-num-' + n);
  return { w: f('width')?.value ?? null, h: f('height')?.value ?? null, wOff: !!f('width')?.disabled, hOff: !!f('height')?.disabled };
})()`);

// a value typed into a field of the inspector and committed with Return
async function setField(page, name, value) {
  const at = await page.evaluate(`(() => { const r = document.querySelector('${PANEL} #beeson-edit-num-${name}').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, at, { count: 3 });
  await press(page, 'Mod+A');
  await page.send('Input.insertText', { text: String(value) });
  await press(page, 'Enter');
  await sleep(80);
}

// the image of the zone of the math slide selected by itself, with a click on the figure and one
// more on the image
async function selectZoneImage(page) {
  await click(page, ZONE_IMG);
  await click(page, ZONE_IMG);
  await frames(page);
}

for (const platform of PLATFORMS) {
  test(`${platform}: a picture sized past the box of its zone or plate is drawn at the size in its tag, with and without the editor`, async () => {
    const page = await editor(platform);
    await selectZoneImage(page);
    await arrange(page);
    await setField(page, 'width', 1000);
    const pic = await pictureBox(page, ZONE_IMG);
    assert.ok(near(pic.width, 1000) && near(pic.height, 1200), `the image of width 1000 is drawn at ${Math.round(pic.width)} by ${Math.round(pic.height)}`);
    const edited = await render(page);
    assert.match(edited, /<img class="for-dark"[^>]* style="width: 1000px"/, 'the width is not written on the image');
    await roundTrip(page, edited);
    assert.deepEqual(errors(page), []);

    // a paper image of a plate, which the theme scales down to fit
    const plate = await editor(platform, PAPER);
    await click(plate, '.reveal section.present .plate > img');
    await click(plate, '.reveal section.present .plate > img');
    await arrange(plate);
    await setField(plate, 'width', 1800);
    // the paper of 24 px around the picture is inside the width of the image
    const paper = await slideBox(plate, '.reveal section.present .plate > img');
    assert.ok(near(paper.width, 1800) && near(paper.height, 1752 * 1.2 + 48), `the paper image of width 1800 is drawn at ${Math.round(paper.width)} by ${Math.round(paper.height)}`);
    assert.deepEqual(errors(plate), []);

    // the same tags in a deck without the editor
    const show = await browser.newPage();
    await show.goto(`${server.origin}/${LAYOUTS}?still`);
    await show.waitFor(deckSettled);
    await show.evaluate(`(() => { Reveal.slide(${MATH}); for (const img of document.querySelectorAll('.zone > img')) img.style.width = '1000px'; })()`);
    await frames(show);
    const shown = await pictureBox(show, ZONE_IMG);
    assert.ok(near(shown.width, 1000) && near(shown.height, 1200), `the deck draws the image of width 1000 at ${Math.round(shown.width)} by ${Math.round(shown.height)}`);
    await show.close();
  });
}

for (const platform of PLATFORMS) {
  test(`${platform}: W and H of the Arrange pane give the size of the drawn picture, not of the box of the image`, async () => {
    const page = await editor(platform);
    await selectZoneImage(page);
    const fields = await arrange(page);
    const pic = await pictureBox(page, ZONE_IMG);
    const box = await slideBox(page, ZONE_IMG);
    assert.ok(box.height - pic.height > 40, 'the picture fills the box of the image, which this test needs to tell them apart');
    assert.deepEqual([Number(fields.w), Number(fields.h)], [Math.round(pic.width), Math.round(pic.height)], `W and H are ${fields.w} and ${fields.h}, and the picture is ${Math.round(pic.width)} by ${Math.round(pic.height)}`);
    assert.equal(await render(page), page.source, 'the pane writes into the file');
    assert.deepEqual(errors(page), []);
  });
}

// the line of the current slide drawn from a to b in slide px with Insert > Line, then deselected
async function addLine(page, a, b) {
  await exec(page, 'insert.line', { from: a, to: b });
  await frames(page);
  await press(page, 'Escape');
  await frames(page);
}
const lineEnds = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-line-end')].filter((g) => !g.hidden).length`);

for (const platform of PLATFORMS) {
  test(`${platform}: a marquee that touches a line selects it, and one beside it does not`, async () => {
    const page = await editor(platform);
    await addLine(page, { x: 400, y: 960 }, { x: 900, y: 960 });
    assert.equal(await lineEnds(page), 0, 'the line is still selected');
    // a marquee from below the line up across its middle
    const from = await screen(page, 600, 1050);
    const to = await screen(page, 700, 940);
    await drag(page, from, { dx: to.x - from.x, dy: to.y - from.y });
    await frames(page);
    assert.equal(await lineEnds(page), 2, 'the marquee does not select the line');
    // a marquee beside the end of the line selects nothing
    await press(page, 'Escape');
    const off = await screen(page, 950, 1050);
    const offTo = await screen(page, 1000, 1000);
    await drag(page, off, { dx: offTo.x - off.x, dy: offTo.y - off.y });
    await frames(page);
    assert.equal(await lineEnds(page), 0, 'a marquee beside the line selects it');
    assert.deepEqual(errors(page), []);
  });
}

// the guides of a snap that are drawn, each as its axis and its place in slide px
const guidesShown = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-overlay .beeson-guide')].filter((g) => !g.hidden).map((g) => {
  const s = document.querySelector('.reveal .slides');
  const sr = s.getBoundingClientRect(), k = sr.width / s.offsetWidth, r = g.getBoundingClientRect();
  return g.classList.contains('v') ? ['x', Math.round((r.left - sr.left) / k)] : ['y', Math.round((r.top - sr.top) / k)];
})`);
const release = (page, at) => page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', clickCount: 1 });

for (const platform of PLATFORMS) {
  test(`${platform}: a dragged figure snaps to the end and the middle of a line, with the guide drawn`, async () => {
    const page = await editor(platform);
    // a vertical line at x 1100 from y 300 to 700, left of the zone, with its middle at y 500
    await addLine(page, { x: 1100, y: 300 }, { x: 1100, y: 700 });
    const drawn = await render(page);
    const zone = await slideBox(page, '.reveal section.present .zone');
    // the left edge of the zone is dragged to 5 px right of the line, and its top to 5 px under the
    // middle of the line
    const start = await screen(page, zone.left + zone.width / 2, zone.top + zone.height / 2);
    const k = (await screen(page, 1, 0)).x - (await screen(page, 0, 0)).x;
    const dx = (1105 - zone.left) * k, dy = (505 - zone.top) * k;
    await drag(page, start, { dx, dy, hold: true });
    const guides = await guidesShown(page);
    await release(page, { x: start.x + dx, y: start.y + dy });
    await frames(page);
    const moved = await slideBox(page, '.reveal section.present .zone');
    assert.ok(near(moved.left, 1100, 1), `the left edge of the zone is at ${moved.left.toFixed(1)}, not on the line at 1100`);
    assert.ok(near(moved.top, 500, 1), `the top of the zone is at ${moved.top.toFixed(1)}, not at the middle of the line at 500`);
    assert.ok(guides.some(([a, at]) => a === 'x' && near(at, 1100, 1)), `the guide of the line is not drawn: ${JSON.stringify(guides)}`);
    const edited = await render(page);
    await undo(page);
    await frames(page);
    assert.equal(await render(page), drawn, 'an undo does not put the zone back');
    await redo(page);
    assert.equal(await render(page), edited);
    await inScope(page);
    await saveAndReopen(page, `r5-2-${++saves}.html`);
    assert.deepEqual(errors(page), []);
  });

  test(`${platform}: a dragged line snaps by its end to the middle of a figure and to the end of another line, with the guides drawn`, async () => {
    const page = await editor(platform);
    // a horizontal line under the zone, whose right end is dragged to 3 px right of the middle of
    // the zone at x 1500, which is not on a line of the layout
    await addLine(page, { x: 1300, y: 1000 }, { x: 1450, y: 1000 });
    const k = (await screen(page, 1, 0)).x - (await screen(page, 0, 0)).x;
    const z = await slideBox(page, '.reveal section.present .zone');
    const middle = z.left + z.width / 2;
    const ends = () => page.evaluate(`[...Reveal.getCurrentSlide().querySelectorAll('svg.line')].map((svg) => { const [x, y] = (svg.style.translate || '0px 0px').split(' ').map(parseFloat); const l = svg.querySelector('line'); const n = (a) => Number(l.getAttribute(a)); return [x + n('x1'), y + n('y1'), x + n('x2'), y + n('y2')]; })`);
    let at = await screen(page, 1375, 1000);
    let dx = (middle + 3 - 1450) * k;
    await drag(page, at, { dx, dy: 0, hold: true });
    let guides = await guidesShown(page);
    await release(page, { x: at.x + dx, y: at.y });
    await frames(page);
    let [line] = await ends(page);
    assert.ok(near(line[2], middle, 1), `the right end of the line is at ${line[2]}, not on the middle of the zone at ${middle}`);
    assert.ok(guides.some(([a, p]) => a === 'x' && near(p, middle, 1)), `the guide of the zone is not drawn: ${JSON.stringify(guides)}`);
    let edited = await render(page);
    await undo(page);
    await frames(page);
    assert.ok((await render(page)).includes('translate: 1300px 1000px'), 'an undo does not put the line back');
    await redo(page);
    assert.equal(await render(page), edited);

    // a second line, whose left end is dragged to 3 px under the right end of the first
    await addLine(page, { x: 400, y: 700 }, { x: 600, y: 700 });
    [, line] = await ends(page);
    const [first] = await ends(page);
    at = await screen(page, 500, 700);
    dx = (first[2] - 400) * k;
    const dy = (first[3] + 3 - 700) * k;
    await drag(page, at, { dx, dy, hold: true });
    guides = await guidesShown(page);
    await release(page, { x: at.x + dx, y: at.y + dy });
    await frames(page);
    const [, second] = await ends(page);
    assert.ok(near(second[0], first[2], 1) && near(second[1], first[3], 1), `the left end of the second line is at ${second[0]}, ${second[1]}, not on the end of the first at ${first[2]}, ${first[3]}`);
    assert.ok(guides.some(([a, p]) => a === 'y' && near(p, first[3], 1)), `the guide of the first line is not drawn: ${JSON.stringify(guides)}`);
    edited = await render(page);
    await undo(page);
    await frames(page);
    assert.ok((await render(page)).includes('translate: 400px 700px'), 'an undo does not put the second line back');
    await redo(page);
    assert.equal(await render(page), edited);
    await inScope(page);
    await saveAndReopen(page, `r5-2-${++saves}.html`);
    assert.deepEqual(errors(page), []);
  });
}

// the guides of the current slide, as drawn, the title of the slide, the guides kept in the
// storage of the browser by the index of their slide, and the center of a row of the navigator
const handGuides = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-hand-guide')].filter((g) => !g.hidden && !g.classList.contains('off')).map((g) => [g.dataset.axis, Number(g.dataset.at)])`);
const goTo = async (page, n) => {
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
};
const titleOf = (page) => page.evaluate(`Reveal.getCurrentSlide().querySelector('h1, h2')?.textContent ?? ''`);
const stored = (page) => page.evaluate(`JSON.parse(localStorage.getItem('beeson-edit-guides:' + location.pathname) ?? '[]')`);
const navRow = (page, i) => page.evaluate(`(() => {
  const r = document.querySelectorAll('.beeson-edit-nav .row')[${i}];
  r.scrollIntoView({ block: 'center' });
  const b = r.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
})()`);

for (const platform of PLATFORMS) {
  test(`${platform}: a guide follows its slide when slides are moved, added, duplicated, and deleted, and through an undo of each`, async () => {
    const page = await editor(platform);
    const title = await titleOf(page);
    await exec(page, 'view.guides.add', { x: [640], y: [300] });
    await frames(page);
    assert.deepEqual(await handGuides(page), [['x', 640], ['y', 300]]);
    const check = async (n, what) => {
      await goTo(page, n);
      assert.equal(await titleOf(page), title, `the slide is not at ${n} after ${what}`);
      assert.deepEqual(await handGuides(page), [['x', 640], ['y', 300]], `the guides do not follow the slide after ${what}`);
      const saved = await stored(page);
      assert.deepEqual(saved[n], { x: [640], y: [300] }, `the stored guides are not at index ${n} after ${what}: ${JSON.stringify(saved)}`);
      assert.ok(saved.every((g, i) => i === n || (!g.x.length && !g.y.length)), `another slide is stored with guides after ${what}`);
    };
    // moved up with the navigator, and back with an undo
    await click(page, await navRow(page, MATH));
    await exec(page, 'slide.moveUp');
    await frames(page);
    await check(MATH - 1, 'a move up');
    await undo(page);
    await check(MATH, 'an undo of the move');
    // a slide added before it
    await click(page, await navRow(page, 1));
    await exec(page, 'slide.new');
    await frames(page);
    await check(MATH + 1, 'a new slide before it');
    await undo(page);
    await check(MATH, 'an undo of the new slide');
    // a slide before it deleted
    await click(page, await navRow(page, 1));
    await exec(page, 'slide.delete');
    await frames(page);
    await check(MATH - 1, 'a delete of a slide before it');
    await undo(page);
    await check(MATH, 'an undo of the delete');
    // duplicated: the copy after it gets a copy of its guides, as in Keynote
    await click(page, await navRow(page, MATH));
    await exec(page, 'slide.duplicate');
    await frames(page);
    await goTo(page, MATH + 1);
    assert.deepEqual(await handGuides(page), [['x', 640], ['y', 300]], 'the duplicated slide does not get the guides of its source');
    const both = await stored(page);
    assert.deepEqual([both[MATH], both[MATH + 1]], [{ x: [640], y: [300] }, { x: [640], y: [300] }], `the guides of the copy are not stored: ${JSON.stringify(both)}`);
    await undo(page);
    await check(MATH, 'an undo of the duplicate');
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`${platform}: a guide stored in an earlier session is read at its slide after a slide is added before it`, async () => {
    const first = await editor(platform);
    await exec(first, 'view.guides.add', { x: [640] });
    await frames(first);
    // the next session adds a slide at the start before it shows the slide of the guide
    const page = await editor(platform, 0, { keep: true });
    await click(page, await navRow(page, 0));
    await exec(page, 'slide.new');
    await frames(page);
    await goTo(page, MATH + 1);
    assert.equal(await titleOf(page), 'Math, an ordered list, and a zone');
    assert.deepEqual(await handGuides(page), [['x', 640]], 'the stored guide is not read at its slide after a slide is added before it');
    await goTo(page, MATH);
    assert.deepEqual(await handGuides(page), [], 'the slide now at the index of the stored guide shows it');
    assert.deepEqual(errors(page), []);
  });
}

// the shown grips of the first selected element by their handle, as screen points, the switch
// Constrain Proportions of the Arrange pane, and the scale from slide px to screen px
const gripsAt = (page) => page.evaluate(`Object.fromEntries([...document.querySelectorAll('.beeson-grip[data-member="0"]')].filter((g) => !g.hidden).map((g) => { const r = g.getBoundingClientRect(); return [g.dataset.handle, { x: r.left + r.width / 2, y: r.top + r.height / 2 }]; }))`);
const constrainSwitch = (page) => page.evaluate(`(() => {
  const l = [...document.querySelectorAll('${PANEL} label.ed-check')].find((l) => l.textContent.trim() === 'Constrain Proportions');
  const i = l?.querySelector('input');
  return i ? { checked: i.checked, disabled: i.disabled } : null;
})()`);
const toggleConstrain = async (page) => {
  const at = await page.evaluate(`(() => { const l = [...document.querySelectorAll('${PANEL} label.ed-check')].find((l) => l.textContent.trim() === 'Constrain Proportions'); const r = l.querySelector('input').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await frames(page);
};
const scaleOf = async (page) => (await screen(page, 1, 0)).x - (await screen(page, 0, 0)).x;
const fitOf = (page, selector) => page.evaluate(`getComputedStyle([...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getBoundingClientRect().width)).objectFit`);
const SPLIT = SECTIONS.findIndex((s) => s.includes('<h2>A split slide</h2>'));
const IMG_STYLE = (style) => new RegExp(`<img class="for-dark"[^>]* style="${style}">`);

for (const platform of PLATFORMS) {
  test(`${platform}: with Constrain Proportions off, a side grip and the field H stretch an image, whose height is written`, async () => {
    let page = await editor(platform);
    await selectZoneImage(page);
    await arrange(page);
    assert.deepEqual(await constrainSwitch(page), { checked: true, disabled: false }, 'the switch of an image is not on and free');
    await toggleConstrain(page);
    assert.deepEqual(await constrainSwitch(page), { checked: false, disabled: false }, 'a click does not turn the switch off');
    assert.equal(await render(page), page.source, 'the switch writes into the file');
    const k = await scaleOf(page);
    // the picture of 600 by 720 is narrowed by 100 with its grip e, and keeps its height
    await drag(page, (await gripsAt(page)).e, { dx: -100 * k });
    await frames(page);
    let box = await slideBox(page, ZONE_IMG);
    assert.ok(near(box.width, 500) && near(box.height, 720), `the image stretched by its grip e is drawn at ${Math.round(box.width)} by ${Math.round(box.height)}`);
    assert.equal(await fitOf(page, ZONE_IMG), 'fill', 'the stretched picture is fitted in its box, not stretched to it');
    let edited = await render(page);
    assert.match(edited, IMG_STYLE('width: 500px; height: 720px(; translate: [^"]+)?'), 'the width and the height are not written on the image');
    assert.deepEqual(await sizeFields(page), { w: '500', h: '720', wOff: false, hOff: false });
    await roundTrip(page, edited);

    // the field H with the switch off sets the height alone
    page = await editor(platform);
    await selectZoneImage(page);
    await arrange(page);
    await toggleConstrain(page);
    await setField(page, 'height', 400);
    box = await slideBox(page, ZONE_IMG);
    assert.ok(near(box.width, 600) && near(box.height, 400), `the image of height 400 is drawn at ${Math.round(box.width)} by ${Math.round(box.height)}`);
    edited = await render(page);
    assert.match(edited, IMG_STYLE('width: 600px; height: 400px(; translate: [^"]+)?'));
    await roundTrip(page, edited);
    assert.deepEqual(errors(page), []);
  });

  test(`${platform}: with Constrain Proportions on, a corner grip and W and H keep the aspect, and Shift on a corner frees it`, async () => {
    let page = await editor(platform);
    await selectZoneImage(page);
    await arrange(page);
    const k = await scaleOf(page);
    await drag(page, (await gripsAt(page)).se, { dx: -100 * k, dy: -20 * k });
    await frames(page);
    let box = await slideBox(page, ZONE_IMG);
    assert.ok(near(box.width / box.height, 600 / 720, 0.01), `the corner grip changes the aspect to ${Math.round(box.width)} by ${Math.round(box.height)}`);
    let edited = await render(page);
    assert.match(edited, IMG_STYLE('width: \\d+px; translate: [^"]+'), 'a height is written by a resize that keeps the aspect');
    await roundTrip(page, edited);

    // Shift on a corner frees the aspect, and then the side grip e and the field W keep the aspect
    // that the stretched image has
    page = await editor(platform);
    await selectZoneImage(page);
    await arrange(page);
    await drag(page, (await gripsAt(page)).se, { dx: -100 * k, dy: -120 * k, modifiers: 'Shift' });
    await frames(page);
    box = await slideBox(page, ZONE_IMG);
    assert.ok(near(box.width, 500, 3) && near(box.height, 600, 3), `the corner grip with Shift draws the image at ${Math.round(box.width)} by ${Math.round(box.height)}, not at 500 by 600`);
    edited = await render(page);
    assert.match(edited, IMG_STYLE('width: \\d+px; height: \\d+px; translate: [^"]+'), 'the height of an image stretched with Shift is not written');
    const aspect = box.width / box.height;
    await drag(page, (await gripsAt(page)).e, { dx: -100 * k });
    await frames(page);
    box = await slideBox(page, ZONE_IMG);
    assert.ok(near(box.width / box.height, aspect, 0.01), `the grip e of a stretched image changes its aspect from ${aspect.toFixed(3)} to ${(box.width / box.height).toFixed(3)}`);
    await setField(page, 'width', 200);
    box = await slideBox(page, ZONE_IMG);
    assert.ok(near(box.width, 200) && near(box.height, 200 / aspect), `the field W of a stretched image draws it at ${Math.round(box.width)} by ${Math.round(box.height)}`);
    await setField(page, 'height', 300);
    box = await slideBox(page, ZONE_IMG);
    assert.ok(near(box.width, 300 * aspect) && near(box.height, 300), `the field H of a stretched image draws it at ${Math.round(box.width)} by ${Math.round(box.height)}`);
    edited = await render(page);
    for (let n = 0; n < 3; n++) await undo(page);
    await frames(page);
    assert.match(await render(page), IMG_STYLE('width: \\d+px; height: \\d+px; translate: [^"]+'), 'the undo of the field W and the grip e does not give the stretched image back');
    await undo(page);
    await frames(page);
    await byteExact(page);
    for (let n = 0; n < 4; n++) await redo(page);
    assert.equal(await render(page), edited);
    await inScope(page);
    await saveAndReopen(page, `r5-2-${++saves}.html`);
    assert.deepEqual(errors(page), []);
  });

  test(`${platform}: a video is stretched with its switch off, and a QR code keeps its square with its switch held on`, async () => {
    let page = await editor(platform, SPLIT);
    const VIDEO = '.reveal section.present .zone > video';
    // the zone is selected with a first click, and its video with a second
    await click(page, VIDEO);
    await click(page, VIDEO);
    await frames(page);
    await arrange(page);
    assert.deepEqual(await constrainSwitch(page), { checked: true, disabled: false }, 'the switch of a video is not on and free');
    await toggleConstrain(page);
    const before = await pictureBox(page, VIDEO);
    await setField(page, 'height', 300);
    const box = await slideBox(page, VIDEO);
    assert.ok(near(box.width, before.width) && near(box.height, 300), `the video of height 300 is drawn at ${Math.round(box.width)} by ${Math.round(box.height)}`);
    assert.equal(await fitOf(page, VIDEO), 'fill', 'the stretched video is letterboxed');
    const edited = await render(page);
    assert.match(edited, /<video src="..\/..\/demo\/clip-dark.mp4" [^>]*style="width: \d+px; height: 300px(; translate: [^"]+)?">/);
    await roundTrip(page, edited);

    page = await editor(platform, 0);
    await page.evaluate(`localStorage.setItem('beeson-edit-constrain-qr', 'off')`);
    await click(page, '.reveal section.present .qr');
    await arrange(page);
    assert.deepEqual(await constrainSwitch(page), { checked: true, disabled: true }, 'the switch of a QR code is not held on');
    await setField(page, 'height', 260);
    const qr = await slideBox(page, '.reveal section.present .qr');
    assert.ok(near(qr.width, 260) && near(qr.height, 260), `the QR code of height 260 is drawn at ${Math.round(qr.width)} by ${Math.round(qr.height)}`);
    assert.match(await render(page), /<div class="qr" [^>]*style="width: 260px[^"]*"/);
    assert.deepEqual(errors(page), []);
  });
}

// the lead-in paragraph of the math slide, as a point inside its text
const LEAD = `[...document.querySelectorAll('.reveal section.present p')].find((p) => p.textContent === 'The lead-in of a display')`;
const leadBox = (page) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides');
  const sr = s.getBoundingClientRect(), k = sr.width / s.offsetWidth, b = ${LEAD}.getBoundingClientRect();
  return { left: (b.left - sr.left) / k, top: (b.top - sr.top) / k, width: b.width / k, height: b.height / k, x: b.left + 20, y: b.top + b.height / 2 };
})()`);

for (const platform of PLATFORMS) {
  test(`${platform}: the side and corner grips of a text block set its width, which W shows, and its height follows its text`, async () => {
    const page = await editor(platform);
    const lead = await leadBox(page);
    await click(page, lead);
    await press(page, 'Escape');
    await frames(page);
    const grips = await gripsAt(page);
    assert.deepEqual(Object.keys(grips).sort(), ['e', 'ne', 'nw', 'se', 'sw', 'w'], `a text block shows the grips ${Object.keys(grips).join(' ')}`);
    const k = await scaleOf(page);
    await drag(page, grips.e, { dx: -400 * k });
    await frames(page);
    let box = await leadBox(page);
    assert.ok(near(box.width, lead.width - 400, 9), `the paragraph narrowed by 400 from ${Math.round(lead.width)} is ${Math.round(box.width)} wide`);
    assert.ok(near(box.left, lead.left, 1), 'the grip e moves the left edge of the paragraph');
    let edited = await render(page);
    assert.match(edited, new RegExp(`<p style="width: ${Math.round(box.width)}px">The lead-in of a display</p>`), 'the width of the paragraph is not written in px');
    const fields = await arrange(page);
    assert.deepEqual([fields.w, fields.wOff, fields.hOff], [String(Math.round(box.width)), false, true], `W and H of a text block are ${JSON.stringify(fields)}`);
    await setField(page, 'width', 200);
    box = await leadBox(page);
    assert.ok(near(box.width, 200) && box.height > lead.height * 1.5, `the paragraph of width 200 is ${Math.round(box.width)} by ${Math.round(box.height)}, and its text does not wrap`);
    edited = await render(page);
    assert.match(edited, /<p style="width: 200px">The lead-in of a display<\/p>/);
    await undo(page);
    await undo(page);
    await frames(page);
    await byteExact(page);
    await redo(page);
    await redo(page);
    assert.equal(await render(page), edited);
    await inScope(page);
    await saveAndReopen(page, `r5-2-${++saves}.html`);
    assert.deepEqual(errors(page), []);
  });
}
