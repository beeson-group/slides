// regression tests of R8.5, the review of a picture with its caption, on both platforms and in both
// modes, with trusted input. the figures are a pair of images and one image, in a zone of a content
// slide and in the plate of a figure slide, whose caption is a block of the layout. after each
// command the text is checked, then byte for byte after an undo and the edit again after a redo,
// and in the scope rule

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { byteExact, click, drag, press, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const MODES = ['dark', 'light'];
const DECK = 'test/pages/editor-r8-5.html';
// the slides of the deck by what they hold
const ZONE_PAIR = 0, ZONE_ONE = 1, PLATE_PAIR = 2, PLATE_ONE = 3, EMPTY = 4, STEPPED = 5;
const NAMES = ['a pair in a zone', 'one image in a zone', 'a pair in a plate', 'one image in a plate', 'a slide without a figure', 'a stepped pair'];
const IMG = '.reveal section.present img';
const CAPTION = '.reveal section.present .caption';
const PANEL = '#beeson-edit-panel-format';
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const SOURCE = readFileSync(DECK, 'utf8');

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
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const near = (a, b, by = 2) => Math.abs(a - b) <= by;

// the selected elements, each named by its tag and its first class of the deck
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => [el.localName, ...[...el.classList].filter((c) => /^(zone|plate|caption|for-dark|for-light)$/.test(c))].join('.'))`);
const rectOf = (page, selector) => page.evaluate(`(() => {
  const r = [...document.querySelectorAll(${js(selector)})].map((e) => e.getBoundingClientRect()).find((r) => r.width);
  return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
})()`);

// the picture of the shown image of the slide on the screen: its center, about which it is turned,
// its size without its rotation, and its angle with that of the figure around it, in degrees. the
// picture of an image fitted with object-fit contain is smaller than the box of the image
const pictureOf = (page) => page.evaluate(`(() => {
  const img = [...document.querySelectorAll(${js(IMG)})].find((e) => e.getBoundingClientRect().width);
  const slides = document.querySelector('.reveal .slides');
  const k = slides.getBoundingClientRect().width / slides.offsetWidth;
  const r = img.getBoundingClientRect();
  const s = getComputedStyle(img);
  const deg = (el) => parseFloat(getComputedStyle(el).rotate) || 0;
  const angle = deg(img) + deg(img.parentElement);
  let w = img.offsetWidth, h = img.offsetHeight, dx = 0, dy = 0;
  if (s.objectFit === 'contain') {
    const f = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const pw = img.naturalWidth * f, ph = img.naturalHeight * f;
    const [px, py] = s.objectPosition.split(' ').map((v) => parseFloat(v) / 100);
    dx = px * (w - pw) + pw / 2 - w / 2;
    dy = py * (h - ph) + ph / 2 - h / 2;
    w = pw;
    h = ph;
  }
  const a = (angle * Math.PI) / 180;
  const flip = parseFloat(s.scale) < 0 ? -1 : 1;
  const x = r.left + r.width / 2 + (flip * dx * Math.cos(a) - dy * Math.sin(a)) * k;
  const y = r.top + r.height / 2 + (flip * dx * Math.sin(a) + dy * Math.cos(a)) * k;
  return { x, y, width: w * k, height: h * k, left: x - (w * k) / 2, top: y - (h * k) / 2, angle, own: deg(img), figure: deg(img.parentElement) };
})()`);

// the text of slide n
function slideOf(text, n) {
  const at = [...text.matchAll(/<section[ >]/g)][n].index;
  return text.slice(at, text.indexOf('</section>', at));
}

// the start tags of slide n of a text whose name is in names
const tagsOf = (text, n, names) => [...slideOf(text, n).matchAll(/<([a-z0-9-]+)\b[^>]*>/g)].filter((m) => names.includes(m[1])).map((m) => m[0]);

const showTab = async (page, name) => {
  await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].find((b) => b.textContent === ${js(name)})?.click()`);
  await frames(page);
};

async function load(t, platform, mode, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${DECK}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  if ((await page.evaluate('Beeson.theme.get()')) !== mode) await page.evaluate('Beeson.theme.toggle()');
  page.source = SOURCE;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  // the names of the figure and of its shown image in selected()
  const pair = n === ZONE_PAIR || n === PLATE_PAIR || n === STEPPED;
  page.parts = { figure: n === PLATE_PAIR || n === PLATE_ONE ? 'div.plate' : 'figure.zone', pic: pair ? `img.for-${mode}` : 'img', images: pair ? 2 : 1 };
  return page;
}

// nothing selected, with the focus off the chrome
async function deselect(page) {
  await page.evaluate('document.activeElement instanceof HTMLElement && document.activeElement.blur()');
  for (let i = 0; i < 3 && (await selected(page)).length; i++) await exec(page, 'selection.clear');
  assert.deepEqual(await selected(page), []);
}

// the figure selected by one click on its picture, or its picture by two
async function pick(page, from) {
  await deselect(page);
  for (let i = 0; i < (from === 'picture' ? 2 : 1); i++) {
    await click(page, IMG);
    await frames(page);
  }
  assert.deepEqual(await selected(page), [from === 'figure' ? page.parts.figure : page.parts.pic], `the ${from} is not selected by its clicks`);
}

// the text after an edit is in the scope rule wherever the text before it is
function inScope(edited, source) {
  const now = textProblems(edited, THEME);
  for (const p of textProblems(source, THEME)) {
    const i = now.indexOf(p);
    if (i >= 0) now.splice(i, 1);
  }
  assert.deepEqual(now, [], 'the edit writes outside the scope rule');
}

// the edit, the file byte for byte after an undo, the edit again after a redo, and the file again
// after a second undo, from which the next command starts
async function roundTrip(page, edited) {
  assert.notEqual(edited, page.source, 'the command does not change the file');
  inScope(edited, page.source);
  await undo(page);
  await frames(page);
  await byteExact(page);
  await redo(page);
  await frames(page);
  assert.equal(await render(page), edited, 'a redo does not write the edit again');
  await undo(page);
  await frames(page);
  await byteExact(page);
}

// a value typed into a number field of the Arrange pane, committed with Enter
async function typeField(page, id, value) {
  await showTab(page, 'Arrange');
  const input = `#beeson-edit-num-${id}`;
  assert.equal(await page.evaluate(`!!document.querySelector('${input}') && !document.querySelector('${input}').disabled`), true, `the field ${id} is not enabled`);
  await page.evaluate(`(() => { const i = document.querySelector('${input}'); i.focus(); i.select(); })()`);
  await type(page, String(value));
  await press(page, 'Enter');
  await frames(page);
}
async function fieldValue(page, id) {
  await showTab(page, 'Arrange');
  return Number(await page.evaluate(`document.querySelector('#beeson-edit-num-${id}')?.value`));
}

// the angles written on slide n of a text, by the name of the tag
const anglesOf = (text, n) => [...slideOf(text, n).matchAll(/<([a-z0-9-]+)\b[^>]*\brotate: (\d+)deg/g)].map((m) => `${m[1]} ${m[2]}`);

// a turn of the picture of slide n from the figure and from the picture: the angle is written on
// every image of the figure and on no other tag, the caption stays where it is, upright, and the
// picture turns about its own center. act returns the angle that it asks for, or null for the
// angle of a drag
async function turns(t, platform, mode, n, what, act) {
  for (const from of ['figure', 'picture']) {
    const page = await load(t, platform, mode, n);
    await pick(page, from);
    const was = await selected(page);
    const caption = await rectOf(page, CAPTION);
    const pic = await pictureOf(page);
    const asked = await act(page);
    await frames(page);
    const edited = await render(page);
    const angles = anglesOf(edited, n);
    const where = `${what} of ${NAMES[n]} from the ${from}`;
    assert.equal(angles.length, page.parts.images, `${where} writes the angle on ${angles.join(', ') || 'no tag'}`);
    assert.ok(angles.every((a) => a.startsWith('img ') && a === angles[0]), `${where} writes the angle on ${angles.join(', ')}`);
    if (asked !== null) assert.equal(angles[0], `img ${asked}`);
    const now = await rectOf(page, CAPTION);
    assert.ok(near(now.left, caption.left, 1) && near(now.top, caption.top, 1) && near(now.width, caption.width, 1) && near(now.height, caption.height, 1), `${where} moves or turns the caption`);
    const turned = await pictureOf(page);
    assert.equal(turned.figure, 0, `${where} turns the figure`);
    assert.ok(turned.own > 0, `${where} does not turn the picture`);
    assert.ok(near(turned.x, pic.x) && near(turned.y, pic.y), `${where} moves the center of the picture from ${Math.round(pic.x)}, ${Math.round(pic.y)} to ${Math.round(turned.x)}, ${Math.round(turned.y)}`);
    assert.deepEqual(await selected(page), was, `${where} changes the selection`);
    // the angle is shown in the field from both selections, and the image of the other mode has it
    assert.equal(await fieldValue(page, 'angle'), turned.own, `the Angle field after ${where}`);
    await page.evaluate('Beeson.theme.toggle()');
    await frames(page);
    const other = await pictureOf(page);
    assert.ok(other.own === turned.own && near(other.x, pic.x) && near(other.y, pic.y), `${where} is not kept in the other mode`);
    await page.evaluate('Beeson.theme.toggle()');
    await frames(page);
    // Reset Rotation puts the file back
    assert.equal((await state(page, 'arrange.resetRotation')).enabled, true, `Reset Rotation is dimmed after ${where}`);
    await exec(page, 'arrange.resetRotation');
    await frames(page);
    await byteExact(page);
    await undo(page);
    await frames(page);
    assert.equal(await render(page), edited);
    await roundTrip(page, edited);
    assert.deepEqual(errors(page), []);
  }
}

for (const platform of PLATFORMS) {
  for (const mode of MODES) {
    test(`the rotate handle turns the picture of a figure and leaves its caption, on ${platform} in ${mode} mode`, async (t) => {
      for (const n of [ZONE_PAIR, ZONE_ONE, PLATE_PAIR]) {
        await turns(t, platform, mode, n, 'a turn by the rotate handle', async (page) => {
          assert.equal(await page.evaluate(`!document.querySelector('.beeson-rotor').hidden`), true, 'the rotate handle is not drawn');
          await drag(page, '.beeson-rotor', { dx: 80, dy: 60 });
          return null;
        });
      }
    });

    test(`the Angle field turns the picture of a figure and leaves its caption, on ${platform} in ${mode} mode`, async (t) => {
      for (const n of [ZONE_PAIR, ZONE_ONE, PLATE_PAIR]) {
        await turns(t, platform, mode, n, 'a turn by the Angle field', async (page) => {
          await typeField(page, 'angle', 30);
          return 30;
        });
      }
    });
  }
}

// the heading of the slide added to the selection with a click and Shift
async function addHeading(page) {
  const r = await rectOf(page, '.reveal section.present > h2');
  await click(page, { x: r.left + 20, y: r.y }, { modifiers: 'Shift' });
  await frames(page);
}

for (const platform of PLATFORMS) {
  for (const mode of MODES) {
    test(`a group turned by its rotate handle turns the picture of its figure and leaves the caption upright, on ${platform} in ${mode} mode`, async (t) => {
      for (const n of [ZONE_PAIR, PLATE_PAIR]) {
        const page = await load(t, platform, mode, n);
        await pick(page, 'figure');
        await addHeading(page);
        await exec(page, 'arrange.group');
        await frames(page);
        page.source = await render(page);
        const pic = await pictureOf(page);
        await drag(page, '.beeson-rotor', { dx: 60, dy: 40 });
        await frames(page);
        const edited = await render(page);
        const angles = anglesOf(edited, n);
        const where = `a turn of a group with ${NAMES[n]}`;
        assert.deepEqual(angles.map((a) => a.split(' ')[0]).sort(), ['h2', 'img', 'img'], `${where} writes the angle on ${angles.join(', ')}`);
        assert.equal(new Set(angles.map((a) => a.split(' ')[1])).size, 1, `${where} writes the angles ${angles.join(', ')}`);
        const turned = await pictureOf(page);
        assert.equal(turned.figure, 0, `${where} turns the figure`);
        assert.equal(await page.evaluate(`getComputedStyle(document.querySelector(${js(CAPTION)})).rotate`), 'none', `${where} turns the caption`);
        // the picture is carried about the center of the group
        assert.ok(!near(turned.x, pic.x, 4) || !near(turned.y, pic.y, 4), `${where} leaves the picture in place`);
        assert.equal(await fieldValue(page, 'angle'), turned.own, `the Angle field after ${where}`);
        await roundTrip(page, edited);
        assert.deepEqual(errors(page), []);
      }
    });
  }
}

// a trusted drag of the file at path from the Finder, dropped at the point at. the label of the
// outline drawn while the file is over the point is returned
async function dropFile(page, at, path) {
  const data = { items: [], files: [resolve(path)], dragOperationsMask: 1 };
  for (const type of ['dragEnter', 'dragOver']) await page.send('Input.dispatchDragEvent', { type, x: at.x, y: at.y, data });
  const outline = await page.evaluate(`(() => { const b = document.querySelector('.beeson-drop'); return b && !b.hidden ? b.textContent : null; })()`);
  await page.send('Input.dispatchDragEvent', { type: 'drop', x: at.x, y: at.y, data });
  return outline;
}
const waitText = (page, text) => page.waitFor(`window.BeesonEditor.render().includes(${js(text)})`, 30000);

// the text of the figure of slide n, i.e. of its zone or plate
function figureOf(text, n) {
  const slide = slideOf(text, n);
  const at = slide.search(/<(figure|div) class="(zone|plate)/);
  const end = slide.indexOf(slide[at + 1] === 'f' ? '</figure>' : '</div>', at);
  return slide.slice(at, end);
}

for (const platform of PLATFORMS) {
  for (const mode of MODES) {
    test(`a file dropped onto the picture of a locked figure does not replace it, on ${platform} in ${mode} mode`, async (t) => {
      for (const n of [ZONE_PAIR, PLATE_PAIR]) {
        const page = await load(t, platform, mode, n);
        await pick(page, 'figure');
        await exec(page, 'arrange.lock');
        await frames(page);
        page.source = await render(page);
        const locked = figureOf(page.source, n);
        assert.match(locked, /^<(figure|div) class="(zone|plate)" data-locked>/);
        const pic = await pictureOf(page);
        // as in Keynote, the file is added to the slide beside the locked picture
        const outline = await dropFile(page, pic, 'demo/clip-dark.png');
        assert.equal(outline, 'Add Image', `the outline over the picture of a locked figure of ${NAMES[n]}`);
        await waitText(page, 'media/clip-dark.png');
        await frames(page);
        const edited = await render(page);
        assert.equal(figureOf(edited, n), locked, `a file dropped onto the locked picture of ${NAMES[n]} changes its figure`);
        assert.match(slideOf(edited, n), /<figure class="zone">\s*<img src="media\/clip-dark\.png">/, 'the file is not added in a zone of its own');
        await roundTrip(page, edited);
        assert.deepEqual(errors(page), []);
      }
    });

    test(`Replace with a video keeps the mode, the step, the id, and the place of an image, on ${platform} in ${mode} mode`, async (t) => {
      for (const from of ['figure', 'picture']) {
        const page = await load(t, platform, mode, STEPPED);
        await pick(page, from);
        const pic = await pictureOf(page);
        assert.equal(await dropFile(page, pic, 'demo/clip-dark.mp4'), 'Replace Image');
        await waitText(page, 'media/clip-dark.mp4');
        await frames(page);
        const edited = await render(page);
        const videos = tagsOf(edited, STEPPED, ['video']);
        assert.equal(videos.length, 1, 'the image of the mode is not replaced with one video');
        for (const part of [`class="for-${mode} fragment"`, 'data-fragment-index="1"', 'data-id="curves"', 'style="translate: 12px 8px; width: 500px"', 'src="media/clip-dark.mp4"', 'poster="media/clip-dark.png"']) {
          assert.ok(videos[0].includes(part), `the video ${videos[0]} of a Replace from the ${from} is written without ${part}`);
        }
        assert.ok(!videos[0].includes('alt='), `the video ${videos[0]} keeps the alt text of the image`);
        // the image of the other mode is left, and the selection is on the same object
        assert.equal(tagsOf(edited, STEPPED, ['img']).length, 1);
        assert.deepEqual(await selected(page), [from === 'figure' ? 'figure.zone' : `video.for-${mode}`], `the selection after a Replace from the ${from}`);
        await roundTrip(page, edited);
        assert.deepEqual(errors(page), []);
      }
    });
  }
}

// the widths written on the images of slide n of a text
const widthsOf = (text, n) => tagsOf(text, n, ['img']).map((tag) => /\bwidth: (\d+)px/.exec(tag)?.[1] ?? null);

for (const platform of PLATFORMS) {
  for (const mode of MODES) {
    test(`a width typed in the W field and Reset Size keep the upper left corner of the picture of a figure, on ${platform} in ${mode} mode`, async (t) => {
      for (const n of [ZONE_PAIR, ZONE_ONE, PLATE_PAIR, PLATE_ONE]) {
        for (const from of ['figure', 'picture']) {
          const page = await load(t, platform, mode, n);
          await pick(page, from);
          const pic = await pictureOf(page);
          const caption = await rectOf(page, CAPTION);
          await typeField(page, 'width', 400);
          const edited = await render(page);
          const where = `a width typed for ${NAMES[n]} from the ${from}`;
          assert.deepEqual(widthsOf(edited, n), new Array(page.parts.images).fill('400'), `${where} is not written on every image`);
          const sized = await pictureOf(page);
          assert.ok(near(sized.left, pic.left) && near(sized.top, pic.top), `${where} moves the corner of the picture from ${Math.round(pic.left)}, ${Math.round(pic.top)} to ${Math.round(sized.left)}, ${Math.round(sized.top)}`);
          // the caption of a zone stays under its picture, and the caption of a figure slide in its layout
          const under = await rectOf(page, CAPTION);
          if (n === ZONE_PAIR || n === ZONE_ONE) assert.ok(near(under.top - (sized.top + sized.height), caption.top - (pic.top + pic.height)), `${where} leaves the caption away from its picture`);
          else assert.ok(near(under.top, caption.top) && near(under.left, caption.left), `${where} moves the caption of the layout`);
          assert.equal(await fieldValue(page, 'width'), 400);
          // Reset Size keeps the corner as well
          assert.equal((await state(page, 'arrange.resetSize')).enabled, true);
          await exec(page, 'arrange.resetSize');
          await frames(page);
          const reset = await pictureOf(page);
          assert.ok(near(reset.left, pic.left) && near(reset.top, pic.top) && near(reset.width, pic.width), `Reset Size after ${where} moves the corner of the picture to ${Math.round(reset.left)}, ${Math.round(reset.top)}`);
          await byteExact(page);
          await undo(page);
          await frames(page);
          assert.equal(await render(page), edited);
          await roundTrip(page, edited);
          assert.deepEqual(errors(page), []);
        }
      }
    });
  }
}
