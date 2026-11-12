// the Preview button of the toolbar and the icons of round 9, on both platforms. Preview is a split
// button before Present whose main part plays the slide and whose menu traces the backdrop, plays
// the steps, selects the backdrop, and adds one. a preview is drawn on the canvas, stops at a
// click on Stop, Esc, a press on the canvas, a change of slide, and an edit, and leaves the file,
// the history, and the selection as they were. Present is drawn as a screen on its stand, a new
// slide as a rounded rectangle with a plus, and each entry of the Shape menu with its shape

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press } from './helpers/editor.mjs';
import { DRAWN, shapePath } from '../src/shapes.ts';

const DECK = 'test/pages/editor-r22-2.html';
const PLATFORMS = ['mac', 'other'];
const MAIN = '.beeson-edit-top [data-command="preview.slide"]';
const LAYER = '.beeson-edit-play';
// the slides of the deck
const BOTH = 0, BACKDROP = 1, STEPS = 2, NEITHER = 3, STEPPED = 4;

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
const status = (page) => page.evaluate('window.BeesonEditor.status()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const wait = (page, ms) => page.evaluate(`new Promise((d) => setTimeout(() => d(true), ${ms}))`);
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => el.matches('.backdrop') ? 'backdrop' : el.localName)`);
const rafs = (page) => page.evaluate('Beeson.backdrops.filter((b) => b.raf).length');
const layer = (page) => page.evaluate(`!!document.querySelector('${LAYER}')`);
const centerOf = (page, selector) => page.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
// the label and the path data of the face of the main part of Preview, and whether it is pressed
const face = (page) => page.evaluate(`(() => {
  const b = document.querySelector('${MAIN}');
  return { label: b.querySelector('.label').textContent, d: [...b.querySelectorAll('svg path')].map((p) => p.getAttribute('d')), pressed: b.getAttribute('aria-pressed') === 'true' };
})()`);
const PLAY = ['M6.5 4.25v11.5L15.75 10z'];
const PAUSE = ['M5.5 4.5h3v11h-3z', 'M11.5 4.5h3v11h-3z'];
const REHEARSE = ['M3 4.5h14v9H3z', 'M8.75 7v4l3.25-2z', 'M7 16.5h6'];

// the editor on the deck at slide n, with a step delay of step ms. with motion, the page does not
// ask for reduced motion and the URL is without still, so that a backdrop is traced
async function previewPage(platform, n, { motion = false, step = 1000 } = {}) {
  await last?.close().catch(() => {});
  const page = await browser.newPage(motion ? { motion: true } : undefined);
  last = page;
  await page.goto(`${server.origin}/${DECK}?edit${motion ? '' : '&still'}&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`if (window.BeesonEditor.preview) window.BeesonEditor.preview.step = ${step}`);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the labels of the menu that the arrow beside the toolbar button of command opens, a rule as '-',
// each with whether it is dimmed
async function splitMenu(page, command) {
  await click(page, await page.evaluate(`(() => { const r = document.querySelector('.beeson-edit-top [data-command="${command}"]').parentElement.querySelector('.more').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
  await frames(page);
  return page.evaluate(`[...document.querySelector('.beeson-edit-menu').children].map((i) => i.matches('.rule') ? '-' : i.querySelector('.label')?.textContent.trim() + (i.getAttribute('aria-disabled') === 'true' ? ' (dimmed)' : ''))`);
}

// the labels of the menu of the menu bar title name
async function menuOf(page, name) {
  await click(page, await page.evaluate(`(() => {
    const t = [...document.querySelectorAll('.beeson-edit-header [aria-haspopup="menu"]')].find((b) => b.textContent === ${JSON.stringify(name)});
    const r = t.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`));
  await frames(page);
  const items = await page.evaluate(`[...document.querySelector('.beeson-edit-menu').children].map((i) => i.matches('.rule') ? '-' : i.querySelector('.label')?.textContent.trim())`);
  await press(page, 'Escape');
  return items;
}

// the file, the history, the dirty mark, and the selection are as they were
async function unchanged(page, selection = []) {
  assert.equal(await render(page), page.source, 'the preview changed the file');
  const s = await status(page);
  assert.equal(s.undo, false, 'the preview added an entry to the history');
  assert.equal(s.dirty, false, 'the preview marked the deck as changed');
  assert.deepEqual(await selected(page), selection, 'the preview changed the selection');
}

// the state of each paragraph and backdrop of the slide drawn by a preview, sampled at every frame
// from the start until the preview ends, with each run of one state once. a state is off, dim at
// the 0.45 of the earlier steps, or on, with + where the class key is colored
const SAMPLE = `(() => {
  const out = [];
  const sample = () => {
    const host = document.querySelector('${LAYER} .shot');
    const s = host?.shadowRoot?.querySelector('.slides > section');
    const sig = s ? [...s.querySelectorAll(':scope > p, :scope > .backdrop')].map((p) => (p.classList.contains('beeson-off') || getComputedStyle(p).visibility === 'hidden' ? 'off' : p.style.opacity === '0.45' ? 'dim' : 'on') + (p.querySelector('.key.hl-accent') ? '+' : '')).join(' ') : 'none';
    if (out[out.length - 1] !== sig) out.push(sig);
    if (sig !== 'none' || out.length === 1) requestAnimationFrame(sample);
  };
  window.__samples = out;
  sample();
})()`;

for (const platform of PLATFORMS) {
  test(`Preview is a split button before Present with the icon play, and its menu and the Play menu list its commands (${platform})`, async () => {
    const page = await previewPage(platform, BOTH);
    const ids = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-top .tb[data-command]')].map((b) => b.dataset.command)`);
    assert.equal(ids[ids.indexOf('file.present') - 1], 'preview.slide', 'Preview is not directly before Present');
    const f = await face(page);
    assert.equal(f.label, 'Preview');
    assert.deepEqual(f.d, PLAY);
    assert.equal(f.pressed, false);
    assert.equal(await page.evaluate(`!!document.querySelector('${MAIN}').parentElement.matches('.beeson-edit-split')`), true, 'Preview is not a split button');
    assert.deepEqual(await splitMenu(page, 'preview.slide'), ['Play Slide', 'Trace Backdrop', 'Play Steps', '-', 'Select Backdrop', 'Add Backdrop… (dimmed)']);
    await press(page, 'Escape');
    const play = await menuOf(page, 'Play');
    const at = play.indexOf('Play Slide');
    assert.ok(at > play.indexOf('Present') && at < play.indexOf('Rehearse Timings'), `the Play menu is ${play.join(', ')}`);
    assert.deepEqual(play.slice(at - 1, at + 4), ['-', 'Play Slide', 'Trace Backdrop', 'Play Steps', '-']);
    assert.ok(!play.includes('Select Backdrop') && !play.includes('Add Backdrop…'));
  });

  test(`the entries of Preview are dimmed by what the slide has (${platform})`, async () => {
    const page = await previewPage(platform, BOTH);
    const IDS = ['preview.slide', 'preview.backdrop', 'preview.steps', 'preview.selectBackdrop', 'preview.addBackdrop'];
    const expected = {
      [BOTH]: [true, true, true, true, false],
      [BACKDROP]: [true, true, false, true, false],
      [STEPS]: [true, false, true, false, true],
      [NEITHER]: [false, false, false, false, true],
      [STEPPED]: [true, true, true, true, false],
    };
    for (const [n, want] of Object.entries(expected)) {
      await page.evaluate(`Reveal.slide(${n})`);
      await frames(page);
      const got = [];
      for (const id of IDS) got.push((await state(page, id)).enabled);
      assert.deepEqual(got, want, `slide ${n}`);
    }
    await page.evaluate(`Reveal.slide(${NEITHER})`);
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelector('${MAIN}').disabled`), true, 'the main part of Preview is not dimmed on a slide without a backdrop and a step');
  });

  test(`Trace Backdrop traces the backdrop once on the canvas without selecting it, and leaves the file, the history, and the selection (${platform})`, async () => {
    const page = await previewPage(platform, BACKDROP, { motion: true });
    await exec(page, 'preview.backdrop');
    await frames(page);
    assert.ok((await rafs(page)) > 0, 'the backdrop is not traced');
    assert.equal(await layer(page), false, 'a trace is drawn on a layer');
    assert.equal((await face(page)).pressed, true);
    await unchanged(page);
    await page.waitFor(`Beeson.backdrops.every((b) => !b.raf)`, 4000);
    await wait(page, 200);
    assert.equal((await face(page)).pressed, false, 'Preview is pressed after the trace');
    assert.equal((await face(page)).label, 'Preview');
    await unchanged(page);
  });

  test(`Play Steps draws each step as the show draws it, one per step delay, and the slide complete after the last (${platform})`, async () => {
    const page = await previewPage(platform, STEPS, { step: 300 });
    const drawn = () => page.evaluate(`[...document.querySelectorAll('section.present > *')].map((el) => [el.className, el.getAttribute('style'), getComputedStyle(el).opacity])`);
    const before = await drawn();
    const started = Date.now();
    await page.evaluate(SAMPLE);
    await exec(page, 'preview.steps');
    await page.waitFor(`window.__samples.at(-1) === 'none' && window.__samples.length > 1`, 8000);
    const took = Date.now() - started;
    // the restore step of src/steps.ts is the fourth step, after which the slide is complete
    assert.deepEqual(await page.evaluate('window.__samples'), ['none', 'off on off', 'on on off', 'dim off off', 'dim off on+', 'on off on+', 'none']);
    assert.ok(took >= 1400 && took < 4000, `the steps took ${took} ms`);
    await unchanged(page);
    assert.deepEqual(await drawn(), before, 'the slide is not drawn as the editor draws it');
  });

  test(`Play Steps traces a backdrop that is a step at its step (${platform})`, async () => {
    const page = await previewPage(platform, STEPPED, { motion: true, step: 700 });
    await page.evaluate(SAMPLE);
    await exec(page, 'preview.steps');
    await page.waitFor(`window.__samples.includes('on on')`, 4000);
    // the pixels drawn on the base canvas of the backdrop in the layer grow while it is traced
    const ink = `(() => {
      const c = document.querySelector('${LAYER} .shot').shadowRoot.querySelector('.backdrop canvas.orbits-base');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 16) if (d[i]) n++;
      return n;
    })()`;
    await wait(page, 80);
    const early = await page.evaluate(ink);
    await wait(page, 400);
    const later = await page.evaluate(ink);
    assert.ok(later > early, `the backdrop is not traced at its step (${early}, then ${later})`);
    await page.waitFor(`window.__samples.at(-1) === 'none'`, 6000);
    assert.deepEqual(await page.evaluate('window.__samples'), ['none', 'on off', 'on on', 'none']);
    await unchanged(page);
  });

  test(`Play Slide traces the backdrop and then plays the steps, and Preview reads Stop with the icon pause while it plays (${platform})`, async () => {
    const page = await previewPage(platform, BOTH, { motion: true, step: 250 });
    await click(page, await centerOf(page, 'section.present h2'));
    await press(page, 'Escape');
    const selection = await selected(page);
    assert.deepEqual(selection, ['h2']);
    await page.evaluate(SAMPLE);
    await click(page, await centerOf(page, MAIN));
    await frames(page);
    assert.ok((await rafs(page)) > 0, 'the backdrop is not traced first');
    assert.equal(await layer(page), false, 'the steps are played before the trace ends');
    assert.deepEqual(await face(page), { label: 'Stop', d: PAUSE, pressed: true });
    await page.waitFor(`!!document.querySelector('${LAYER}')`, 4000);
    assert.equal(await rafs(page), 0, 'the trace runs during the steps');
    assert.deepEqual(await face(page), { label: 'Stop', d: PAUSE, pressed: true });
    await page.waitFor(`window.__samples.at(-1) === 'none' && window.__samples.length > 1`, 4000);
    assert.deepEqual(await page.evaluate('window.__samples'), ['none', 'off off on', 'on off on', 'dim on on', 'on on on', 'none']);
    await frames(page);
    assert.deepEqual(await face(page), { label: 'Preview', d: PLAY, pressed: false });
    await unchanged(page, selection);
  });

  test(`Play Slide runs the one part that a slide has (${platform})`, async () => {
    const page = await previewPage(platform, BACKDROP, { motion: true, step: 200 });
    await exec(page, 'preview.slide');
    await frames(page);
    assert.ok((await rafs(page)) > 0);
    await page.waitFor(`Beeson.backdrops.every((b) => !b.raf)`, 4000);
    await wait(page, 200);
    assert.equal(await layer(page), false, 'steps are played on a slide without a step');
    assert.equal((await face(page)).pressed, false);
    await page.evaluate(`Reveal.slide(${STEPS})`);
    await frames(page);
    await exec(page, 'preview.slide');
    await frames(page);
    assert.equal(await layer(page), true, 'the steps are not played at once on a slide without a backdrop');
    await page.waitFor(`!document.querySelector('${LAYER}')`, 4000);
    await unchanged(page);
  });

  test(`a click on Stop, Esc, a press on the canvas, a change of slide, and an edit each stop a preview at once (${platform})`, async () => {
    const page = await previewPage(platform, BOTH, { motion: true, step: 5000 });
    const playing = async (how) => {
      await exec(page, 'preview.steps');
      await frames(page);
      assert.equal(await layer(page), true, `the steps are not played before ${how}`);
    };
    const stopped = async (how) => {
      await frames(page);
      assert.equal(await layer(page), false, `${how} does not stop the steps`);
      assert.equal(await rafs(page), 0, `${how} does not stop the trace`);
      assert.deepEqual(await face(page), { label: 'Preview', d: PLAY, pressed: false }, `Preview after ${how}`);
    };
    await playing('the click on Stop');
    await click(page, await centerOf(page, MAIN));
    await stopped('a click on Stop');
    await unchanged(page);
    await playing('Esc');
    await press(page, 'Escape');
    await stopped('Esc');
    await exec(page, 'preview.backdrop');
    await frames(page);
    await press(page, 'Escape');
    await stopped('Esc during a trace');
    await playing('a press on the canvas');
    await click(page, await centerOf(page, 'section.present h2'));
    await stopped('a press on the canvas');
    await press(page, 'Escape');
    await press(page, 'Escape');
    await unchanged(page);
    await playing('a change of slide');
    await page.evaluate(`Reveal.slide(${BACKDROP})`);
    await stopped('a change of slide');
    await exec(page, 'preview.backdrop');
    await frames(page);
    await page.evaluate(`Reveal.slide(${BOTH})`);
    await stopped('a change of slide during a trace');
    await unchanged(page);
    await playing('an edit');
    await exec(page, 'slide.hide');
    await stopped('an edit');
    assert.notEqual(await render(page), page.source);
  });

  test(`Select Backdrop selects the backdrop and shows the Backdrop pane, and Add Backdrop… opens the gallery (${platform})`, async () => {
    const page = await previewPage(platform, BACKDROP);
    await splitMenu(page, 'preview.slide');
    await click(page, await page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.textContent.includes('Select Backdrop')).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
    await frames(page);
    assert.deepEqual(await selected(page), ['backdrop']);
    assert.equal((await state(page, 'shell.format')).checked, true, 'the inspector is not shown');
    assert.equal(await page.evaluate(`!!document.querySelector('#beeson-edit-panel-format:not([hidden]) [data-pane="backdrop"], #beeson-edit-panel-format:not([hidden]) .pane-backdrop')`), true, 'the Backdrop pane is not shown');
    await page.evaluate(`Reveal.slide(${STEPS})`);
    await frames(page);
    await exec(page, 'preview.addBackdrop');
    await frames(page);
    assert.equal(await page.evaluate(`!!document.querySelector('.beeson-backdrop-gallery')`), true, 'the gallery is not open');
    assert.equal(await render(page), page.source);
  });

  test(`the icon of Present is a board on a post and a foot, and the icon of a new slide is a rounded rectangle with a plus (${platform})`, async () => {
    const page = await previewPage(platform, BOTH);
    const paths = (command) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-top [data-command="${command}"] svg path')].map((p) => { const b = p.getBBox(); return { d: p.getAttribute('d'), x: b.x, y: b.y, w: b.width, h: b.height }; })`);
    const present = await paths('file.present');
    const ds = present.map((p) => p.d);
    assert.notDeepEqual(ds, PLAY);
    assert.notDeepEqual(ds, REHEARSE);
    const board = present.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
    assert.ok(board.w >= 12 && board.w > board.h, 'the board is not wide');
    const post = present.find((p) => p.w < 0.01 && p.h > 2 && Math.abs(p.x - 10) < 0.01);
    assert.ok(post && post.y >= board.y + board.h - 0.01, 'the post is not under the middle of the board');
    const foot = present.filter((p) => p.h < 0.01 && p.w > 3 && Math.abs(p.x + p.w / 2 - 10) < 0.01).sort((a, b) => b.y - a.y)[0];
    assert.ok(foot && foot.y >= post.y + post.h - 0.01, 'the foot is not under the post');
    const add = await paths('slide.gallery');
    const rect = add.find((p) => /a/.test(p.d) && /z$/i.test(p.d));
    assert.ok(rect, `the icon of a new slide has no rounded rectangle: ${add.map((p) => p.d).join(' ')}`);
    const plus = add.filter((p) => p !== rect);
    assert.equal(plus.length, 2);
    for (const p of plus) {
      assert.ok(Math.abs(p.x + p.w / 2 - (rect.x + rect.w / 2)) < 0.01 && Math.abs(p.y + p.h / 2 - (rect.y + rect.h / 2)) < 0.01, 'the plus is not centered in the rectangle');
    }
  });

  test(`each entry of the Shape menu has the icon of what it draws, drawn from the geometry of src/shapes.ts (${platform})`, async () => {
    const page = await previewPage(platform, NEITHER);
    const command = await page.evaluate(`document.querySelector('.beeson-edit-top [data-command^="insert.shape."]').dataset.command`);
    const labels = (await splitMenu(page, command)).filter((l) => l !== '-');
    assert.deepEqual(labels, ['Rounded Rectangle', 'Rectangle', 'Ellipse', 'Triangle', 'Block Arrow', 'Double Block Arrow', 'Brace', 'Plus', 'Equals', 'Line', 'Arrow', 'Curved Arrow', 'Elbow Arrow']);
    const icons = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => {
      const svg = i.querySelector('.label svg.beeson-icon');
      return svg && { command: i.dataset.command, view: svg.getAttribute('viewBox'), d: [...svg.querySelectorAll('path')].map((p) => p.getAttribute('d')), html: svg.innerHTML };
    })`);
    assert.equal(icons.length, 13);
    assert.ok(icons.every(Boolean), 'an entry has no icon');
    assert.equal(new Set(icons.map((i) => i.html)).size, 13, 'two entries have the same icon');
    for (const kind of DRAWN) {
      const i = icons.find((x) => x.command === `insert.shape.${kind}`);
      // the box of the shape is centered on the grid of 20 px by the origin of the view box
      const [x, y] = i.view.split(' ').map(Number);
      assert.deepEqual(i.d, [shapePath(kind, 20 + 2 * x, 20 + 2 * y, 1.5)], `the icon of ${kind}`);
    }
    // the label of an entry is its text alone
    assert.equal(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item .label')][3].textContent`), 'Triangle');
  });
}
