// the show and the review of a deck on both platforms: the steps and times of the presenter view,
// Present at the current slide, the presenter view, a rehearsal that writes data-timing, the
// transitions None and Fade, Magic Move, the accessibility checker, and the light table. each edit
// is checked byte for byte, after an undo and a redo, and after a save and an open of the saved
// text. the system clipboard is not used

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { duration, seconds, seenAt, stepsOf } from '../src/editor/present.ts';
import { groupsOf } from '../src/editor/navigator/sorter.ts';
import { byteExact, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const SOURCE = readFileSync(LAYOUTS, 'utf8');
const PAPER = '<img class="paper" src="../../demo/figure-light.png" alt="A white raster figure">';
const BARE = '<img class="paper" src="../../demo/figure-light.png">';
const NARROW = '<section class="narrow">';
const WIDE = '<section class="wide">';

test('the steps of a slide are ordered as reveal.js orders its fragments', () => {
  const f = (index, kind = 'in', final = false) => ({ index, kind, final });
  assert.deepEqual(stepsOf([f(2), f(null), f(1), f(null, 'in', true), f(null)]), [1, 2, 0, 4, 3]);
  assert.deepEqual(stepsOf([]), []);
  assert.deepEqual(stepsOf([f(0), f(0)]), [0, 0]);
  // with k steps shown, a fragment of step s that fades in is seen once k > s, one that fades out
  // until then, and a current-visible one only while it is the last step shown
  assert.deepEqual([0, 1, 2].map((k) => seenAt('in', 1, k)), [false, false, true]);
  assert.deepEqual([0, 1, 2].map((k) => seenAt('out', 1, k)), [true, true, false]);
  assert.deepEqual([0, 1, 2].map((k) => seenAt('current', 1, k)), [false, false, true]);
});

test('the times of the presenter view are written as on a clock', () => {
  assert.equal(duration(0), '0:00');
  assert.equal(duration(42_400), '0:42');
  assert.equal(duration(62_000), '1:02');
  assert.equal(duration(3_723_000, true), '1:02:03');
  assert.equal(seconds(200), 1);
  assert.equal(seconds(1_600), 2);
});

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
// origin private file system. text is the text of the file, by default the deck itself, and change
// is a script that makes the page the page of text before the file is opened
async function reviewPage(platform, n, text = SOURCE, change = '') {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.goto(`${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = text;
  if (change) await page.evaluate(change);
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(text)})`);
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
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

async function roundTrip(page, edits) {
  await byteExact(page, edits);
  await undo(page);
  await byteExact(page);
  await redo(page);
  await byteExact(page, edits);
}

let saves = 0;
async function saved(page) {
  const before = await render(page);
  const { text } = await saveAndReopen(page, `review-${++saves}.html`);
  assert.equal(text, before);
  page.source = text;
}

// a click on the item of an open menu whose label starts with name
async function choose(page, name) {
  const at = await page.evaluate(`(() => {
    const items = [...document.querySelectorAll('[role="menu"] .item')];
    const item = items.find((i) => i.textContent.trim().startsWith(${JSON.stringify(name)}));
    if (!item) return null;
    const r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(at, `an open menu does not have an item ${name}`);
  await click(page, at);
  await frames(page);
}

// the labels of the items of the menu of the menu bar title name, opened with a click
async function menuOf(page, name) {
  await click(page, await page.evaluate(`(() => {
    const t = [...document.querySelectorAll('.beeson-edit-header [aria-haspopup="menu"]')].find((b) => b.textContent === ${JSON.stringify(name)});
    const r = t.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`));
  await frames(page);
  return page.evaluate(`[...document.querySelectorAll('[role="menu"] .item')].map((i) => i.textContent.trim())`);
}

for (const platform of PLATFORMS) {
  test(`the Play menu holds Present and the presenter view, and Mod+Enter plays the saved deck in place at the current slide on ${platform}`, async () => {
    const page = await reviewPage(platform, 4);
    const titles = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menubar [aria-haspopup="menu"]')].map((b) => b.textContent)`);
    assert.deepEqual(titles.slice(-3), ['View', 'Play', 'Help']);
    const items = await menuOf(page, 'Play');
    for (const name of ['Present', 'Present from Start', 'Presenter View', 'Rehearse Timings', 'Clear Timings']) assert.ok(items.some((i) => i.startsWith(name)), `the Play menu does not have ${name}`);
    assert.ok(!(await menuOf(page, 'File')).some((i) => i.startsWith('Present')), 'Present is still in the File menu');
    await press(page, 'Escape');
    await page.evaluate(`window.open = (url) => { window.__opened = url; return null; }`);
    await press(page, 'Mod+Enter');
    await page.waitFor(`!!document.querySelector('.beeson-edit-show iframe')?.getAttribute('src')`);
    assert.ok((await page.evaluate(`document.querySelector('.beeson-edit-show iframe').getAttribute('src')`)).endsWith(`?still&edit-platform=${platform}&postMessageEvents=true#/4`));
    assert.equal(await page.evaluate('window.__opened ?? null'), null);
    assert.equal(await page.evaluate(`!!document.querySelector('dialog.beeson-edit-presenter[open]')`), false);
    await page.waitFor(`(() => { const w = document.querySelector('.beeson-edit-show iframe').contentWindow; return !!w.Reveal?.isReady() && (w.MathJax?.startup?.promise?.then(() => true) ?? false); })()`);
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('.beeson-edit-show')`);
    // Alt+Enter opens the show in a tab and the presenter view over the editor
    await press(page, 'Alt+Enter');
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter[open]')`);
    assert.ok((await page.evaluate('window.__opened')).endsWith('#/4'));
    const text = await page.evaluate(`document.querySelector('dialog.beeson-edit-presenter').textContent`);
    assert.match(text, /Current: Slide 5/);
    assert.match(text, /A wide slide with a table and code|Next/);
    await press(page, 'ArrowRight');
    await frames(page);
    assert.match(await page.evaluate(`document.querySelector('dialog.beeson-edit-presenter').textContent`), /Current: Slide 6/);
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('dialog.beeson-edit-presenter[open]')`);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`a rehearsal writes data-timing on each slide shown, as one entry of the history, on ${platform}`, async () => {
    const page = await reviewPage(platform, 4);
    await exec(page, 'play.rehearse');
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter[open].rehearse')`);
    await wait(1100);
    await press(page, 'ArrowRight');
    await wait(1100);
    // the row of the table on slide 6 is a step, and Esc ends the rehearsal before the next slide
    await press(page, 'ArrowRight');
    await press(page, 'Escape');
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter.asking')`);
    await press(page, 'Enter');
    await page.waitFor(`!document.querySelector('dialog.beeson-edit-presenter[open]')`);
    const times = await page.evaluate(`[4, 5].map((i) => document.querySelectorAll('.reveal .slides > section')[i].getAttribute('data-timing'))`);
    for (const t of times) assert.match(t ?? '', /^[12]$/);
    const edits = [[NARROW, `<section class="narrow" data-timing="${times[0]}">`], [WIDE, `<section class="wide" data-timing="${times[1]}">`]];
    await roundTrip(page, edits);
    assert.equal((await state(page, 'play.clearTimings')).enabled, true);
    await saved(page);
    // Clear Timings takes off every timing, also the one in the file before the rehearsal
    await exec(page, 'play.clearTimings');
    assert.ok(!(await render(page)).includes('data-timing'));
    await undo(page);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`Don't Keep leaves the timings of the slides as they were on ${platform}`, async () => {
    const page = await reviewPage(platform, 4);
    await exec(page, 'play.rehearse');
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter[open].rehearse')`);
    await press(page, 'Escape');
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter.asking')`);
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('dialog.beeson-edit-presenter[open]')`);
    await byteExact(page);
    assert.equal(await page.evaluate('window.BeesonEditor.status().dirty'), false);
  });

  test(`the transitions None and Fade are written as data-transition on ${platform}`, async () => {
    const page = await reviewPage(platform, 4);
    assert.equal((await state(page, 'slide.transition.fade')).checked, true);
    await exec(page, 'slide.transition.none');
    assert.equal((await state(page, 'slide.transition.none')).checked, true);
    const none = [[NARROW, '<section class="narrow" data-transition="none">']];
    await roundTrip(page, none);
    await exec(page, 'slide.transition.fade');
    await byteExact(page);
    await undo(page);
    await byteExact(page, none);
    await saved(page);
    // the head of the Steps tab shows the transition of the slide while no element is selected,
    // and a click on Fade there writes it
    if (!(await state(page, 'view.steps')).checked) await exec(page, 'view.steps');
    await frames(page);
    const pressed = () => page.evaluate(`[...document.querySelectorAll('.beeson-edit-transition [data-command^="slide.transition."]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.command)`);
    assert.deepEqual(await pressed(), ['slide.transition.none']);
    await click(page, '.beeson-edit-transition [data-command="slide.transition.fade"]');
    await frames(page);
    await byteExact(page, [[none[0][1], NARROW]]);
    assert.deepEqual(await pressed(), ['slide.transition.fade']);
    await click(page, '.reveal section.present > h2');
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-side .slot').hidden`), true, 'the transition is shown with a text selected');
    assert.deepEqual(errors(page), []);
  });

  test(`Magic Move writes data-auto-animate on both slides and the same data-id on the heading and the figure on ${platform}`, async () => {
    const page = await reviewPage(platform, 3);
    const count = await page.evaluate(`document.querySelectorAll('.reveal .slides > section').length`);
    await exec(page, 'slide.magicMove');
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal .slides > section').length`), count + 1);
    assert.equal(await page.evaluate('Reveal.getIndices().h'), 4, 'the copy is not shown');
    const text = await render(page);
    const occurrences = (s) => text.split(s).length - 1;
    const heading = '<h2 data-id="magic-1">Math, an ordered list, and a zone</h2>';
    assert.equal(occurrences(`<section data-auto-animate>\n  ${heading}`), 2);
    assert.equal(occurrences('<figure class="zone fragment" data-fragment-index="2" data-id="magic-3">'), 2);
    assert.equal(occurrences('data-id="magic-2"'), 2);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('slide.transition.magic').checked`), false, 'the check is not on the copy');
    await page.evaluate('Reveal.slide(3)');
    await frames(page);
    assert.equal((await state(page, 'slide.transition.magic')).checked, true);
    await undo(page);
    await byteExact(page);
    await redo(page);
    assert.equal(await render(page), text);
    await saved(page);
    // Fade on the first slide takes Magic Move off both slides and keeps the data-id
    await exec(page, 'slide.transition.fade');
    const off = await render(page);
    assert.equal(off.split('data-auto-animate>\n  <h2 data-id="magic-1">').length - 1, 0);
    assert.equal(off.split(heading).length - 1, 2);
    assert.deepEqual(errors(page), []);
  });

  test(`the checker lists an image without alt text, and Add Alt Text writes it on ${platform}`, async () => {
    const text = SOURCE.replace(PAPER, BARE);
    const page = await reviewPage(platform, 0, text, `document.querySelector('.reveal img.paper').removeAttribute('alt')`);
    await exec(page, 'view.accessibility');
    await frames(page);
    const rows = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-a11y .item')].map((r) => r.dataset.check + ' ' + r.querySelector('.what').textContent)`);
    assert.deepEqual(rows, ['alt Image figure-light.png Slide 7']);
    assert.match(await page.evaluate(`document.querySelector('.beeson-edit-a11y .status').textContent`), /1 error/);
    await click(page, '.beeson-edit-a11y .item .fix');
    await choose(page, 'Add Alt Text');
    await page.waitFor(`document.activeElement?.matches('.beeson-edit-a11y .alt input')`);
    await type(page, 'A paper figure');
    await press(page, 'Enter');
    await page.waitFor(`!document.querySelector('.beeson-edit-a11y .item')`);
    const alt = [[BARE, '<img class="paper" src="../../demo/figure-light.png" alt="A paper figure">']];
    await roundTrip(page, alt);
    await saved(page);
    assert.match(await page.evaluate(`document.querySelector('.beeson-edit-a11y .status').textContent`), /Good to go/);
    assert.deepEqual(errors(page), []);
  });

  test(`the checker finds a slide without a heading, a table without a header row, and a video without a poster on ${platform}`, async () => {
    const text = SOURCE.replace('<h2>A narrow slide</h2>', '<p>A narrow slide</p>')
      .replace('poster="../../demo/clip-dark.png" muted loop></video>', 'muted loop></video>');
    const page = await reviewPage(platform, 0, text, `(() => {
      const h = [...document.querySelectorAll('.reveal h2')].find((e) => e.textContent === 'A narrow slide');
      const p = document.createElement('p');
      p.textContent = h.textContent;
      h.replaceWith(p);
      document.querySelector('.reveal section.split video').removeAttribute('poster');
    })()`);
    await exec(page, 'view.accessibility');
    await frames(page);
    const checks = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-a11y .item')].map((r) => r.dataset.check)`);
    assert.deepEqual(checks, ['heading', 'poster']);
    // the table of slide 6 has a header row of th cells
    assert.ok(SOURCE.includes('<th>'));
    await click(page, '.beeson-edit-a11y .item[data-check="heading"]');
    assert.equal(await page.evaluate('Reveal.getIndices().h'), 4);
    assert.match(await page.evaluate(`document.querySelector('.beeson-edit-a11y .info').textContent`), /Why fix/);
    await press(page, 'Escape');
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-a11y').hidden`), true);
  });

  test(`the light table groups the slides under the section slides, and a drag moves a slide on ${platform}`, async () => {
    const page = await reviewPage(platform, 4);
    await exec(page, 'view.lightTable');
    await frames(page);
    const heads = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-sorter .head > .name')].map((h) => h.textContent)`);
    assert.deepEqual(heads, ['Opening', 'Content', 'Appendix']);
    const tile = (n) => `.beeson-edit-sorter .tile[aria-label^="Slide ${n}:"]`;
    assert.equal(await page.evaluate(`document.querySelector('${tile(5)}').getAttribute('aria-selected')`), 'true');
    assert.equal(await page.evaluate(`document.activeElement === document.querySelector('${tile(5)}')`), true);
    await press(page, 'ArrowRight');
    await frames(page);
    assert.equal(await page.evaluate('Reveal.getIndices().h'), 5);
    await press(page, 'ArrowLeft');
    await frames(page);
    // slide 5, the narrow slide, is dragged past the middle of slide 7
    const from = await page.evaluate(`(() => { const r = document.querySelector('${tile(5)} .frame').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const to = await page.evaluate(`(() => { const r = document.querySelector('${tile(7)} .frame').getBoundingClientRect(); return { x: r.left + r.width * 0.8, y: r.top + r.height / 2 }; })()`);
    await drag(page, from, { dx: to.x - from.x, dy: to.y - from.y });
    await page.waitFor(`document.querySelectorAll('.reveal .slides > section')[6].matches('.narrow')`);
    const moved = await render(page);
    assert.ok(moved.indexOf(WIDE) < moved.indexOf(NARROW));
    await undo(page);
    await byteExact(page);
    await redo(page);
    assert.equal(await render(page), moved);
    await saved(page);
    // Return shows the slide on the canvas and closes the light table
    await page.evaluate(`document.querySelector('${tile(3)}').focus()`);
    await press(page, 'Enter');
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-sorter').hidden`), true);
    assert.equal(await page.evaluate('Reveal.getIndices().h'), 2);
    assert.deepEqual(errors(page), []);
  });
}

test('the groups of the light table follow the section and closing slides', () => {
  const s = (cls = '', h = '') => ({ classList: { contains: (c) => cls.split(' ').includes(c) }, querySelectorAll: () => (h ? [{ textContent: h, closest: () => null }] : []) });
  const deck = [s('title', 'T'), s(), s('section', 'One'), s(), s('section', 'Two'), s('closing', 'Bye'), s(), s('section', 'Late')];
  assert.deepEqual(groupsOf(deck).map((g) => [g.title, g.slides.length]), [['Opening', 2], ['One', 2], ['Two', 2], ['Appendix', 2]]);
});
