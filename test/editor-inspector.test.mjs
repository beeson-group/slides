// the Format tab of the inspector on both platforms, driven with trusted input: a click in the
// inspector keeps the selection on the canvas, X typed as 40 writes the translate of a figure, Align
// Left of two elements is one entry of the history, Narrow writes the class of the slide, and the
// description of an image is written into its alt. each edit is checked byte for byte, after an
// undo and a redo, against the scope rule, and after a save and an open of the saved text

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { byteExact, click, press, saveAndReopen, selectFigure, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));

const FIGURE = '<figure class="zone fragment" data-fragment-index="2">';
const LEAD = '<p>The lead-in of a display</p>';
const PAPER = '<img class="paper" src="../../demo/figure-light.png" alt="A white raster figure">';

const P = '.reveal section.present > p';
const ZONE = '.reveal section.present .zone';
const IMG = '.reveal section.present .zone > img';
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

// the editor on slide n of the deck of layouts, served over HTTP so that a save is written into the
// origin private file system, with the Format tab shown
async function inspectorPage(platform, n) {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.goto(`${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(LAYOUTS, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const pane = (page) => page.evaluate(`document.querySelector('${PANEL} .ed-panes')?.dataset.pane ?? null`);

// the index of the first slide of the deck that has an element at selector
const slideWith = (selector) => {
  const sections = readFileSync(LAYOUTS, 'utf8').split('<section').slice(1);
  return sections.findIndex((s) => s.includes(selector));
};

// a click on the tab or the button of the inspector whose text or title is name
async function tap(page, name) {
  const at = await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('${PANEL} button, ${PANEL} label.ed-check')].find((b) => b.textContent.trim() === ${JSON.stringify(name)} || b.title === ${JSON.stringify(name)} || b.getAttribute('aria-label') === ${JSON.stringify(name)});
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(at, `the inspector does not have a button ${name}`);
  await click(page, at);
  await frames(page);
}

// the boxes of the solid frames shown, and whether one is drawn around the element at selector
const shownFrames = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-frame.selected')].filter((f) => !f.hidden && f.getBoundingClientRect().width).map((f) => { const r = f.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; })`);
// the box of the first shown element matched by selector. a figure that holds a picture is framed at
// the picture, i.e. at the image or video fitted into it with object-fit contain
const boxOf = (page, selector) => page.evaluate(`(() => {
  let el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getBoundingClientRect().width);
  const pic = el.matches('figure, .zone, .plate') ? [...el.querySelectorAll(':scope > img, :scope > video')].find((m) => m.getBoundingClientRect().width) : null;
  el = pic ?? el;
  const r = el.getBoundingClientRect();
  const [w, h] = el instanceof HTMLImageElement ? [el.naturalWidth, el.naturalHeight] : el instanceof HTMLVideoElement ? [el.videoWidth, el.videoHeight] : [0, 0];
  const fit = getComputedStyle(el).objectFit;
  if (!w || !h || (fit !== 'contain' && fit !== 'scale-down')) return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  const s = Math.min(r.width / w, r.height / h, fit === 'scale-down' ? 1 : Infinity);
  const [px, py] = getComputedStyle(el).objectPosition.split(/\\s+/).map((v) => (v.endsWith('%') ? parseFloat(v) / 100 : 0.5));
  const left = r.left + (r.width - w * s) * px, top = r.top + (r.height - h * s) * py;
  return { left, top, right: left + w * s, bottom: top + h * s };
})()`);
const around = (frame, box) => ['left', 'top'].every((k) => box[k] - frame[k] >= -1 && box[k] - frame[k] <= 9) && ['right', 'bottom'].every((k) => frame[k] - box[k] >= -1 && frame[k] - box[k] <= 9);
async function framed(page, selectors) {
  const shown = await shownFrames(page);
  const out = [];
  for (const s of selectors) {
    const box = await boxOf(page, s);
    if (shown.some((f) => around(f, box))) out.push(s);
  }
  return out;
}

// the problems of the scope rule in the rendered text that the file did not have before
async function inScope(page) {
  const now = textProblems(await page.evaluate('window.BeesonEditor.render()'), THEME);
  for (const p of textProblems(page.source, THEME)) {
    const i = now.indexOf(p);
    if (i >= 0) now.splice(i, 1);
  }
  assert.deepEqual(now, []);
}

async function roundTrip(page, edits) {
  await byteExact(page, edits);
  await inScope(page);
  await undo(page);
  await byteExact(page);
  await redo(page);
  await byteExact(page, edits);
}

let saves = 0;
async function saved(page, edits) {
  const { text } = await saveAndReopen(page, `inspector-${++saves}.html`);
  page.source = text;
  await byteExact(page);
  assert.ok(edits.every(([, after]) => text.includes(after)));
}

const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

// the value typed into the field at selector of the inspector, after its old value is selected
async function typeInto(page, selector, text) {
  await click(page, `${PANEL} ${selector}`);
  await page.evaluate(`document.querySelector('${PANEL} ${selector}').select()`);
  await type(page, text);
  await press(page, 'Enter');
  await frames(page);
}

for (const platform of PLATFORMS) {
  test(`a click in the inspector keeps the selected figure, and X typed as 40 writes its translate on ${platform}`, async () => {
    const page = await inspectorPage(platform, slideWith(FIGURE));
    await selectFigure(page, IMG);
    assert.deepEqual(await framed(page, [ZONE]), [ZONE], 'the figure is not selected by a click on its image and Esc');
    assert.equal(await pane(page), 'image');
    await tap(page, 'Arrange');
    assert.equal(await pane(page), 'arrange');
    assert.deepEqual(await framed(page, [ZONE]), [ZONE], 'a click on the tab Arrange clears the selection');
    await tap(page, 'Slide');
    assert.deepEqual(await framed(page, [ZONE]), [ZONE], 'a click on Align to Slide clears the selection');
    await tap(page, 'Selection');
    await typeInto(page, '#beeson-edit-num-x', '40');
    assert.deepEqual(await framed(page, [ZONE]), [ZONE], 'a value typed into X clears the selection');
    const moved = [FIGURE, '<figure class="zone fragment" data-fragment-index="2" style="translate: 40px 0px">'];
    await roundTrip(page, [moved]);
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} #beeson-edit-num-x').value`), '40');
    // Y is written next to X, and Reset Position takes both off
    await typeInto(page, '#beeson-edit-num-y', '-12');
    const both = [FIGURE, '<figure class="zone fragment" data-fragment-index="2" style="translate: 40px -12px">'];
    await byteExact(page, [both]);
    await undo(page);
    await byteExact(page, [moved]);
    await tap(page, 'Reset Position');
    await byteExact(page);
    await undo(page);
    await byteExact(page, [moved]);
    await saved(page, [moved]);
    assert.deepEqual(errors(page), []);
  });

  test(`a click on Bold in the Text pane keeps the range of the text, and formats it on ${platform}`, async () => {
    const page = await inspectorPage(platform, 2);
    await page.evaluate(`(() => {
      const p = [...document.querySelectorAll('.reveal section.present > p')].find((e) => e.textContent.startsWith('A paragraph'));
      p.focus();
      const t = p.firstChild;
      const r = document.createRange();
      r.setStart(t, 2);
      r.setEnd(t, 11);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
    })()`);
    await frames(page);
    await frames(page);
    assert.equal(await pane(page), 'text');
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} [data-command="text.bold"]').disabled`), false);
    await tap(page, 'Bold');
    const bold = ['<p>A paragraph with', '<p>A <strong>paragraph</strong> with'];
    await byteExact(page, [bold]);
    assert.equal(await page.evaluate('getSelection().toString()'), 'paragraph', 'a click on Bold loses the range');
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} [data-command="text.bold"]').getAttribute('aria-pressed')`), 'true');
    await inScope(page);
    await undo(page);
    await byteExact(page);
    await redo(page);
    await byteExact(page, [bold]);
    await saved(page, [bold]);
    assert.deepEqual(errors(page), []);
  });

  test(`Align Left of two elements writes both offsets as one entry of the history on ${platform}`, async () => {
    const page = await inspectorPage(platform, slideWith(FIGURE));
    const p = await boxOf(page, P);
    await selectFigure(page, IMG);
    await click(page, { x: p.right + 3, y: (p.top + p.bottom) / 2 }, { modifiers: 'Shift' });
    assert.deepEqual(await framed(page, [P, ZONE]), [P, ZONE]);
    assert.equal(await pane(page), 'arrange');
    await tap(page, 'Slide');
    await tap(page, 'Align Left');
    assert.deepEqual(await framed(page, [P, ZONE]), [P, ZONE], 'Align Left clears the selection');
    const text = await page.evaluate('window.BeesonEditor.render()');
    const x = (tag) => Number(text.match(new RegExp(`${tag.slice(0, -1)} style="translate: (-?\\d+)px 0px">`))?.[1]);
    const [px, fx] = [x(LEAD.slice(0, 3)), x(FIGURE)];
    assert.ok(px < 0 && fx < px, `the offsets of the paragraph and the figure are ${px} and ${fx}`);
    const edits = [
      [LEAD, `<p style="translate: ${px}px 0px">The lead-in of a display</p>`],
      [FIGURE, `${FIGURE.slice(0, -1)} style="translate: ${fx}px 0px">`],
    ];
    await byteExact(page, edits);
    await inScope(page);
    // one undo takes both offsets off
    await undo(page);
    await byteExact(page);
    await redo(page);
    await byteExact(page, edits);
    // the two left edges are at the left edge of the slide
    const left = await page.evaluate(`document.querySelector('.reveal .slides').getBoundingClientRect().left`);
    for (const s of [P, ZONE]) assert.ok(Math.abs((await boxOf(page, s)).left - left) <= 1, `${s} is not at the left edge`);
    await saved(page, edits);
    assert.deepEqual(errors(page), []);
  });

  test(`Narrow in the Slide pane writes the class of the section on ${platform}`, async () => {
    const page = await inspectorPage(platform, 2);
    assert.equal(await pane(page), 'slide');
    await tap(page, 'Narrow');
    const narrow = ['<section data-timing="40">', '<section data-timing="40" class="narrow">'];
    await roundTrip(page, [narrow]);
    await tap(page, 'Wide');
    await byteExact(page, [['<section data-timing="40">', '<section data-timing="40" class="wide">']]);
    await tap(page, 'Normal');
    await byteExact(page);
    await undo(page);
    await undo(page);
    await byteExact(page, [narrow]);
    await saved(page, [narrow]);
    assert.deepEqual(errors(page), []);
  });

  test(`the description typed into the Image pane is written into the alt of the image on ${platform}`, async () => {
    const page = await inspectorPage(platform, slideWith(PAPER));
    await click(page, '.reveal section.present .plate > img');
    assert.equal(await pane(page), 'image');
    await typeInto(page, 'textarea[name="alt"]', 'Zero-velocity curves, with "quotes" & an ampersand');
    assert.deepEqual(await framed(page, ['.reveal section.present .plate']), ['.reveal section.present .plate'], 'a description typed clears the selection');
    const alt = [PAPER, '<img class="paper" src="../../demo/figure-light.png" alt="Zero-velocity curves, with &quot;quotes&quot; &amp; an ampersand">'];
    await roundTrip(page, [alt]);
    // Decorative writes the empty alt, and a second click takes the alt off
    await tap(page, 'Decorative');
    await byteExact(page, [[PAPER, '<img class="paper" src="../../demo/figure-light.png" alt>']]);
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} textarea[name="alt"]').disabled`), true);
    await undo(page);
    await byteExact(page, [alt]);
    await saved(page, [alt]);
    assert.deepEqual(errors(page), []);
  });
}

test('Edit Alt Text… of the context menu shows the Image pane with its description focused', async () => {
  const page = await inspectorPage('other', slideWith(PAPER));
  await click(page, '.reveal section.present .plate > img');
  await tap(page, 'Arrange');
  await exec(page, 'figure.alt');
  await frames(page);
  assert.equal(await pane(page), 'image');
  assert.equal(await page.evaluate(`document.activeElement?.getAttribute('name')`), 'alt');
  // the keys typed into the field are not taken by the canvas, e.g. an arrow nudges nothing
  await press(page, 'ArrowLeft');
  await byteExact(page);
  assert.deepEqual(errors(page), []);
});

test('the text of a QR code is written into its data-qr and drawn again, also after an undo', async () => {
  const page = await inspectorPage('mac', 0);
  await click(page, '.reveal section.present .qr');
  assert.equal(await pane(page), 'qr');
  const modules = () => page.evaluate(`document.querySelector('.reveal section.present .qr svg')?.outerHTML.length ?? 0`);
  const before = await modules();
  await typeInto(page, 'textarea[name="qr"]', 'https://example.com/a/much/longer/address/for/a/larger/code');
  const qr = ['<div class="qr" data-qr="https://github.com/beeson-group/slides">', '<div class="qr" data-qr="https://example.com/a/much/longer/address/for/a/larger/code">'];
  await roundTrip(page, [qr]);
  const drawn = await modules();
  assert.ok(drawn > 0 && drawn !== before, 'the QR code is not drawn again from its new text');
  await undo(page);
  await frames(page);
  assert.equal(await modules(), before, 'the QR code is not drawn again after an undo');
  // an empty text is refused, and the file is kept
  await typeInto(page, 'textarea[name="qr"]', ' ');
  await byteExact(page);
  assert.deepEqual(errors(page), []);
});
