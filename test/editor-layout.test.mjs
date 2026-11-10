// the layout and the arrangement of the elements of a slide on both platforms, driven with trusted
// input: a content slide changed to split from the chooser of the Slide pane writes div.panel
// around its words and keeps its zone, Bring to Front and Send to Back of a QR code move its unit
// among the other figures, a grouped pair is selected, moved, and deleted together, a lock keeps
// an element from a drag, a rotation with Shift snaps to 15 degrees, and Reset Slide takes it
// off. each edit is checked byte for byte, after an undo and a redo, against the scope rule, and
// after a save and an open of the saved text. the tests do not use the system clipboard

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { arrange, kindOf, relayout, shift } from '../src/editor/commands/layout.ts';
import { byteExact, center, click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const PANEL = '#beeson-edit-panel-format';
const KEYS = {
  mac: { front: 'Mod+Shift+F', back: 'Mod+Shift+B', group: 'Mod+Alt+G', ungroup: 'Mod+Alt+Shift+G', lock: 'Mod+L', unlock: 'Mod+Alt+L' },
  other: { front: 'Mod+Shift+ArrowUp', back: 'Mod+Shift+ArrowDown', group: 'Mod+G', ungroup: 'Mod+Shift+G', lock: 'Mod+L', unlock: 'Mod+Shift+L' },
};

const SECTIONS = [...readFileSync(LAYOUTS, 'utf8').matchAll(/<section[\s\S]*?<\/section>/g)].map((m) => m[0]);
const MATH = SECTIONS.findIndex((s) => s.includes('<h2>Math, an ordered list, and a zone</h2>'));
const TITLE = 0;
const QR = '<div class="qr" data-qr="https://github.com/beeson-group/slides"></div>';
const BLOCK_END = '    <p class="who">The Beeson group<br>Princeton University</p>\n  </div>\n';
const BACKDROP = '  <div class="backdrop" data-scene="tubes" data-cx="0.42" data-cy="0" data-half="0.6"></div>\n';

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
// origin private file system
async function layoutPage(platform, n) {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.goto(`${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`);
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
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const shownFrames = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-frame.selected')].filter((f) => !f.hidden && f.getBoundingClientRect().width).length`);

// the problems of the scope rule in the rendered text that the file did not have before
async function inScope(page) {
  const now = textProblems(await render(page), THEME);
  for (const p of textProblems(page.source, THEME)) {
    const i = now.indexOf(p);
    if (i >= 0) now.splice(i, 1);
  }
  assert.deepEqual(now, []);
}

// before is the edits that the undo keeps, of an earlier entry of the history
async function roundTrip(page, edits, before = []) {
  await byteExact(page, edits);
  await inScope(page);
  await undo(page);
  await byteExact(page, before);
  await redo(page);
  await byteExact(page, edits);
}

let saves = 0;
async function saved(page, edits) {
  const { text } = await saveAndReopen(page, `layout-${++saves}.html`);
  page.source = text;
  await byteExact(page);
  assert.ok(edits.every(([, after]) => text.includes(after)));
}

// the math slide of the deck of layouts written as a split slide: its words in the panel, one step
// deeper, and its zone after the panel
function asSplit(section) {
  const lines = section.split('\n');
  const zone = lines.findIndex((l) => l.startsWith('  <figure class="zone'));
  const words = lines.slice(1, zone).map((l) => `  ${l}`);
  return ['<section class="split">', '  <div class="panel">', ...words, '  </div>', ...lines.slice(zone)].join('\n');
}

test('relayout writes each layout from the parts of a slide, and gives back a slide already in its layout', () => {
  for (const s of SECTIONS) {
    const layout = /<section class="(title|section|closing|figure|split|narrow|wide)\b/.exec(s)?.[1] ?? 'content';
    assert.equal(relayout(s, layout, '  '), s);
  }
  const math = SECTIONS[MATH];
  const split = relayout(math, 'split', '  ');
  assert.equal(split, asSplit(math));
  assert.equal(relayout(split, 'content', '  '), math);
  // the block of a title slide takes the heading, made an h1, and the words, and a figure stays out
  const title = relayout(math, 'title', '  ');
  assert.ok(title.startsWith('<section class="title">\n  <div class="block">\n    <h1>Math, an ordered list, and a zone</h1>\n'));
  assert.ok(title.includes('\n  </div>\n  <figure class="zone fragment"'));
  assert.equal(relayout(title, 'content', '  '), math);
  // a slide without a heading gets an empty one in a wrapper, and a class of another kind is kept
  assert.equal(relayout('<section class="x">\n  <div class="zone"></div>\n</section>', 'split', '\t'), '<section class="split x">\n\t<div class="panel">\n\t\t<h2></h2>\n\t</div>\n\t<div class="zone"></div>\n</section>');
  // the lines of a pre keep their white space
  assert.equal(shift('<pre>\n  a\n</pre>\n  <p>', '  ', '    '), '<pre>\n  a\n</pre>\n    <p>');
  assert.deepEqual(arrange([kindOf('h2', []), kindOf('p', []), kindOf('div', ['zone']), kindOf('div', ['foot'])], 'split'), [{ wrap: 'panel', parts: [0, 1, 3] }, 2]);
});

for (const platform of PLATFORMS) {
  test(`a content slide changed to split from the chooser writes div.panel around its words and keeps its zone on ${platform}`, async () => {
    const page = await layoutPage(platform, MATH);
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await frames(page);
    await click(page, `${PANEL} .ed-card.ed-chooser`);
    await page.waitFor(`!!document.querySelector('.beeson-edit-layouts')`);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-layouts .tile[aria-selected="true"]').dataset.layout`), 'content');
    assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-edit-layouts .tile .pic').length`), 8);
    await click(page, '.beeson-edit-layouts .tile[data-layout="split"]');
    await frames(page);
    assert.equal(await page.evaluate(`!!document.querySelector('.beeson-edit-layouts')`), false);
    const edit = [SECTIONS[MATH], asSplit(SECTIONS[MATH])];
    const lit = `[...Reveal.getCurrentSlide().querySelectorAll('.coriolis')].map((e) => e.classList.contains('hl-accent'))`;
    assert.deepEqual(await page.evaluate(lit), [true, true], 'the Coriolis term is not colored on the new slide');
    await roundTrip(page, [edit]);
    assert.deepEqual(await page.evaluate(lit), [true, true], 'the Coriolis term is not colored after a redo');
    assert.deepEqual(await page.evaluate(`(() => { const s = Reveal.getCurrentSlide(); return [s.className.includes('split'), !!s.querySelector(':scope > .panel > h2'), !!s.querySelector(':scope > figure.zone')]; })()`), [true, true, true]);
    assert.equal((await state(page, 'slide.layout.split')).checked, true);
    await saved(page, [edit]);
    // the Slide menu changes it back, and Reset Slide is then disabled
    await exec(page, 'slide.layout.content');
    assert.equal(await render(page), readFileSync(LAYOUTS, 'utf8'));
    assert.equal((await state(page, 'slide.reset')).enabled, false);
    assert.deepEqual(errors(page), []);
  });

  test(`Send to Back and Bring to Front of a QR code move its unit among the figures on ${platform}`, async () => {
    const page = await layoutPage(platform, TITLE);
    await click(page, '.reveal section.present > .qr');
    assert.equal((await state(page, 'arrange.order.front')).enabled, false, 'the QR code is already in front');
    await press(page, KEYS[platform].back);
    await frames(page);
    const back = [BACKDROP, `  ${QR}\n${BACKDROP}`];
    const out = [`${BLOCK_END}  ${QR}\n`, BLOCK_END];
    const edits = [back, out];
    await byteExact(page, edits);
    await inScope(page);
    await undo(page);
    await byteExact(page);
    await redo(page);
    await byteExact(page, edits);
    // Bring to Front puts it after the backdrop and the block again, and is one entry
    await press(page, KEYS[platform].front);
    await frames(page);
    await byteExact(page);
    await undo(page);
    await byteExact(page, edits);
    await redo(page);
    await byteExact(page);
    // Send Backward passes one figure, the block
    await exec(page, 'arrange.order.backward');
    const backward = [[`${BLOCK_END}  ${QR}\n`, BLOCK_END], ['  <div class="block">\n    <h1>Every layout', `  ${QR}\n  <div class="block">\n    <h1>Every layout`]];
    await byteExact(page, backward);
    await saved(page, backward);
    assert.deepEqual(errors(page), []);
  });

  test(`a grouped pair is selected, moved, and deleted together, and a locked element is not dragged on ${platform}`, async () => {
    const page = await layoutPage(platform, TITLE);
    await click(page, '.reveal section.present h1', { modifiers: 'Shift' });
    await click(page, '.reveal section.present > .qr', { modifiers: 'Shift' });
    assert.equal(await shownFrames(page), 2);
    await press(page, KEYS[platform].group);
    await frames(page);
    const grouped = [['<h1>Every layout</h1>', '<h1 data-group="g1">Every layout</h1>'], [QR, '<div class="qr" data-qr="https://github.com/beeson-group/slides" data-group="g1"></div>']];
    await roundTrip(page, grouped);
    // a click on one member selects both
    await exec(page, 'selection.clear');
    await click(page, '.reveal section.present > .qr');
    assert.equal(await shownFrames(page), 2, 'a click on a member does not select its group');
    const scale = await page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'); return s.getBoundingClientRect().width / s.offsetWidth; })()`);
    await drag(page, '.reveal section.present > .qr', { dx: -100 * scale, dy: -50 * scale, modifiers: platform === 'mac' ? 'Meta' : 'Alt' });
    await frames(page);
    const moved = [
      ['<h1>Every layout</h1>', '<h1 style="translate: -100px -50px" data-group="g1">Every layout</h1>'],
      [QR, '<div class="qr" data-qr="https://github.com/beeson-group/slides" style="translate: -100px -50px" data-group="g1"></div>'],
    ];
    await roundTrip(page, moved, grouped);
    await press(page, 'Delete');
    await frames(page);
    await byteExact(page, [['    <h1>Every layout</h1>\n', ''], [`  ${QR}\n`, '']]);
    await undo(page);
    await byteExact(page, moved);
    await saved(page, moved);
    // Ungroup takes data-group off both, and a lock keeps the QR code from a drag
    await click(page, '.reveal section.present > .qr');
    await press(page, KEYS[platform].ungroup);
    await exec(page, 'selection.clear');
    await click(page, '.reveal section.present > .qr');
    assert.equal(await shownFrames(page), 1);
    await press(page, KEYS[platform].lock);
    const qr = '<div class="qr" data-qr="https://github.com/beeson-group/slides" style="translate: -100px -50px" data-locked></div>';
    const locked = [['<h1 style="translate: -100px -50px" data-group="g1">', '<h1 style="translate: -100px -50px">'], ['<div class="qr" data-qr="https://github.com/beeson-group/slides" style="translate: -100px -50px" data-group="g1"></div>', qr]];
    await byteExact(page, locked);
    assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-grip.locked:not([hidden])').length`), 8, 'a locked element does not show crosses');
    await drag(page, '.reveal section.present > .qr', { dx: 80, dy: 40 });
    await press(page, 'ArrowLeft');
    await byteExact(page, locked);
    await press(page, KEYS[platform].unlock);
    await byteExact(page, [locked[0], [locked[1][0], locked[1][0].replace(' data-group="g1"', '')]]);
    assert.deepEqual(errors(page), []);
  });

  test(`a rotation by the rotate handle with Shift snaps to 15 degrees, and the angle is shown on ${platform}`, async () => {
    const page = await layoutPage(platform, TITLE);
    await click(page, '.reveal section.present > .qr');
    const c = await center(page, '.reveal section.present > .qr');
    const knob = await center(page, '.beeson-rotor');
    assert.ok(Math.abs(knob.x - c.x) < 1 && knob.y < c.y, 'the rotate handle is not above the middle of the QR code');
    // the pointer is turned by 37 degrees about the center, which Shift snaps to 30
    const r = c.y - knob.y;
    const a = (37 * Math.PI) / 180;
    await drag(page, knob, { dx: r * Math.sin(a), dy: r - r * Math.cos(a), modifiers: 'Shift', hold: true });
    assert.equal(await page.evaluate(`document.querySelector('.beeson-offset').textContent`), '30°');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: knob.x + r * Math.sin(a), y: knob.y + r - r * Math.cos(a), button: 'left', clickCount: 1, modifiers: 8 });
    await frames(page);
    const turned = [[QR, '<div class="qr" data-qr="https://github.com/beeson-group/slides" style="rotate: 30deg"></div>']];
    await roundTrip(page, turned);
    // without Shift, the angle is kept to the degree, and the field of the Arrange pane sets it
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await exec(page, 'arrange.setRotation', { deg: 37 });
    await byteExact(page, [[QR, '<div class="qr" data-qr="https://github.com/beeson-group/slides" style="rotate: 37deg"></div>']]);
    await undo(page);
    await byteExact(page, turned);
    await saved(page, turned);
    assert.deepEqual(errors(page), []);
  });

  test(`Reset Slide takes the rotation off a QR code and gives back its layout on ${platform}`, async () => {
    const page = await layoutPage(platform, TITLE);
    assert.equal((await state(page, 'slide.reset')).enabled, false, 'a slide in its layout can be reset');
    await click(page, '.reveal section.present > .qr');
    await exec(page, 'arrange.setRotation', { deg: 37 });
    const turned = [[QR, '<div class="qr" data-qr="https://github.com/beeson-group/slides" style="rotate: 37deg"></div>']];
    await byteExact(page, turned);
    assert.equal((await state(page, 'slide.reset')).enabled, true);
    await exec(page, 'slide.reset');
    await frames(page);
    await byteExact(page);
    await undo(page);
    await byteExact(page, turned);
    await redo(page);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}
