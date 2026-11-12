// tests of R20.8 on both platforms: a block centered with the class center, an element ghosted with
// the class ghost, the effect Dim of a step written as semi-fade-out and drawn at the opacity of a
// ghost, a line paired in Magic Move, a line as a step, the transition Push, and a picture clipped
// to an ellipse with the class oval. each edit is undone to the file byte for
// byte, redone, and saved and opened again without a problem. the opacities of the theme are read in
// the show and in the print view of the deck

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { deckSettled, launch, printView } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { editProblems, textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { tokenize } from '../src/editor/tokens.ts';
import { center, click, press, saveAndReopen, selectFigure, selectPicture } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test/pages/editor-r20-8.html';
const SOURCE = readFileSync(DECK, 'utf8');
// the figure of the first slide
const FIGURE = '<figure class="zone">\n    <img src="../../demo/figure-light.png" alt="A figure">';
const PANEL = '#beeson-edit-panel-format';
const GHOST = '0.25';

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
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const sleep = (ms) => new Promise((d) => setTimeout(d, ms));
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}, ${js(arg ?? null)} ?? undefined)).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const undoLabel = async (page) => (await state(page, 'edit.undo')).label;
const style = (page, selector, prop) => page.evaluate(`getComputedStyle(document.querySelector('.reveal section.present ' + ${js(selector)}))[${js(prop)}]`);
// without transitions, so that an opacity is read at its end
const still = (page) => page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

async function load(t, platform, slide = 0) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${DECK}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = SOURCE;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(SOURCE)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${slide})`);
  await frames(page);
  return page;
}

// the source with each pair [old, new] replaced once, each old text found once in it
function edited(edits) {
  let text = SOURCE;
  for (const [a, b] of edits) {
    assert.equal(text.split(a).length, 2, `${a} does not occur once in the deck`);
    text = text.replace(a, () => b);
  }
  return text;
}

// the edit checked after an undo, a redo, and a save and an open, with the label of its undo
async function roundTrip(page, expected, label) {
  assert.equal(await render(page), expected);
  if (label) assert.equal(await undoLabel(page), label);
  await undo(page);
  assert.equal(await render(page), SOURCE, 'the undo does not give the file back byte for byte');
  await redo(page);
  assert.equal(await render(page), expected, 'the redo does not give the edit back');
  const { text } = await saveAndReopen(page, `r20-8-${Math.random().toString(36).slice(2)}.html`);
  assert.equal(text, expected);
}

// the caret put into the block of selector by a click on its first characters
async function caretIn(page, selector) {
  const at = await page.evaluate(`(() => {
    const el = document.querySelector('.reveal section.present ' + ${js(selector)});
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n = w.nextNode();
    while (n && !n.data.trim()) n = w.nextNode();
    const i = n.data.search(/\\S/);
    const r = document.createRange();
    r.setStart(n, i + 1);
    r.setEnd(n, i + 2);
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  })()`);
  await click(page, at);
  await frames(page);
}

// the block of selector selected as an object, by a click into its text and Esc, or added to the
// selection by a click with Shift
async function selectBlock(page, selector, modifiers = '') {
  if (modifiers) await click(page, await center(page, `.reveal section.present ${selector}`), { modifiers });
  else {
    await caretIn(page, selector);
    await press(page, 'Escape');
  }
  await frames(page);
}

// the line of the svg of selector selected by a press 2 px under its middle
async function selectLine(page, selector) {
  const at = await page.evaluate(`(() => {
    const r = document.querySelector('.reveal section.present ' + ${js(selector)} + ' line').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 + 2 };
  })()`);
  await click(page, at);
  await frames(page);
}

async function showPane(page, name) {
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await frames(page);
  await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].find((b) => b.textContent === ${js(name)})?.click()`);
  await frames(page);
}

for (const platform of PLATFORMS) {
  test(`Center and Left set and take off the class center on a paragraph, keeping its style (${platform})`, async (t) => {
    const page = await load(t, platform);
    await caretIn(page, 'p');
    assert.equal((await state(page, 'text.align.left')).checked, true);
    await exec(page, 'text.align.center');
    await frames(page);
    const expected = edited([['<p>Alpha', '<p class="center">Alpha']]);
    assert.equal(await render(page), expected);
    assert.equal(await style(page, 'p', 'textAlign'), 'center');
    assert.equal((await state(page, 'text.align.center')).checked, true);
    assert.equal((await state(page, 'text.align.left')).checked, false);
    assert.equal((await state(page, 'text.style.body')).checked, true, 'a centered paragraph is not read as Body');
    await roundTrip(page, expected, 'Undo Alignment');
    await caretIn(page, 'p');
    await exec(page, 'text.align.left');
    assert.equal(await render(page), SOURCE);
    assert.deepEqual(errors(page), []);
  });

  test(`Center acts on a list and a display selected as objects, on a caption, and on a small paragraph, and draws the display centered (${platform})`, async (t) => {
    const page = await load(t, platform);
    await selectBlock(page, 'ul');
    await selectBlock(page, 'div.math', 'Shift');
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 2);
    await exec(page, 'text.align.center');
    await frames(page);
    const both = edited([['<ul>', '<ul class="center">'], ['<div class="math">', '<div class="math center">']]);
    assert.equal(await render(page), both);
    assert.equal(await style(page, 'div.math mjx-container', 'textAlign'), 'center');
    assert.equal(await style(page, 'ul', 'textAlign'), 'center');
    await roundTrip(page, both, 'Undo Alignment');
    await caretIn(page, '.caption');
    await exec(page, 'text.align.center');
    await caretIn(page, 'p.small');
    await exec(page, 'text.align.center');
    await frames(page);
    assert.equal(await render(page), edited([
      ['<p class="small">Beta', '<p class="small center">Beta'],
      ['<ul>', '<ul class="center">'],
      ['<div class="math">', '<div class="math center">'],
      ['<figcaption class="caption">', '<figcaption class="caption center">'],
    ]));
    assert.equal((await state(page, 'text.style.small')).checked, true, 'a centered small paragraph is not read as Small');
    assert.deepEqual(errors(page), []);
  });

  test(`the Text pane shows Left and Center, and the Format Painter carries the alignment (${platform})`, async (t) => {
    const page = await load(t, platform);
    await caretIn(page, 'p');
    await showPane(page, 'Text');
    assert.equal(await page.evaluate(`document.querySelectorAll('${PANEL} [data-command="text.align.left"], ${PANEL} [data-command="text.align.center"]').length`), 2);
    await click(page, `${PANEL} [data-command="text.align.center"]`);
    await frames(page);
    assert.equal(await render(page), edited([['<p>Alpha', '<p class="center">Alpha']]));
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} [data-command="text.align.center"]').getAttribute('aria-pressed')`), 'true');
    await caretIn(page, 'p');
    await exec(page, 'text.copyStyle');
    await caretIn(page, 'p.small');
    await exec(page, 'text.pasteStyle');
    await frames(page);
    assert.equal(await render(page), edited([['<p>Alpha', '<p class="center">Alpha'], ['<p class="small">Beta', '<p class="small center">Beta']]));
    assert.deepEqual(errors(page), []);
  });

  test(`Ghosted writes the class ghost on a figure, a block, and a line, and each is drawn at the ghost opacity (${platform})`, async (t) => {
    const page = await load(t, platform);
    await selectFigure(page, '.reveal section.present figure img');
    await selectBlock(page, 'p', 'Shift');
    await showPane(page, 'Arrange');
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} [data-command="arrange.ghost"]')?.checked`), false);
    await click(page, `${PANEL} label:has(> [data-command="arrange.ghost"])`);
    await frames(page);
    const expected = edited([['<p>Alpha', '<p class="ghost">Alpha'], [FIGURE, FIGURE.replace('zone', 'zone ghost')]]);
    assert.equal(await render(page), expected);
    assert.equal(await style(page, 'figure', 'opacity'), GHOST);
    assert.equal(await style(page, 'p', 'opacity'), GHOST);
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} [data-command="arrange.ghost"]')?.checked`), true);
    await roundTrip(page, expected, 'Undo Ghosted');
    // a line, and the command again takes the class off
    await exec(page, 'selection.clear');
    await selectLine(page, 'svg.line');
    await exec(page, 'arrange.ghost');
    const line = edited([['<p>Alpha', '<p class="ghost">Alpha'], [FIGURE, FIGURE.replace('zone', 'zone ghost')], ['<svg class="line tone-accent" width="200" height="1" style="translate: 200px 900px"><defs><marker id="line-1"', '<svg class="line tone-accent ghost" width="200" height="1" style="translate: 200px 900px"><defs><marker id="line-1"']]);
    assert.equal(await render(page), line);
    assert.equal(await style(page, 'svg.line', 'opacity'), GHOST);
    await exec(page, 'arrange.ghost');
    assert.equal(await render(page), expected);
    assert.deepEqual(errors(page), []);
  });

  test(`Reset Slide keeps the class ghost, and a ghosted step is drawn ghosted in the editor (${platform})`, async (t) => {
    const page = await load(t, platform);
    await selectBlock(page, 'p');
    await exec(page, 'arrange.ghost');
    await exec(page, 'slide.reset');
    await frames(page);
    assert.ok((await render(page)).includes('<p class="ghost">Alpha'), 'Reset Slide took ghost off');
    await page.evaluate('Reveal.slide(3)');
    await frames(page);
    assert.equal(await style(page, 'p.ghost', 'opacity'), GHOST);
    assert.deepEqual(errors(page), []);
  });

  test(`Dim of the Steps pane writes semi-fade-out, and Preview Steps draws the element dimmed from its step on (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await still(page);
    await selectBlock(page, 'p:nth-of-type(4)');
    await exec(page, 'steps.effect', { effect: 'dim' });
    await frames(page);
    const expected = edited([['<p class="fragment" data-fragment-index="3">Theta', '<p class="fragment semi-fade-out" data-fragment-index="3">Theta']]);
    assert.equal(await render(page), expected);
    await roundTrip(page, expected);
    // the element is drawn at full opacity while the slide is edited, since every step is shown
    assert.equal(await style(page, 'p:nth-of-type(2)', 'opacity'), '1');
    const run = page.evaluate(`Promise.resolve(window.BeesonEditor.exec('steps.preview')).then(() => true)`);
    const seen = [];
    for (let k = 0; k <= 3; k++) {
      await page.waitFor(`document.documentElement.dataset.previewStep === ${js(String(k))}`);
      await frames(page);
      seen.push(await page.evaluate(`[...document.querySelectorAll('.reveal section.present p')].map((p) => getComputedStyle(p).opacity)`));
    }
    await run;
    assert.deepEqual(seen.map((s) => s[1]), ['1', GHOST, GHOST, GHOST], 'the dimmed Zeta');
    assert.deepEqual(seen.map((s) => s[3]), ['1', '1', '1', GHOST], 'Theta, dimmed at its own step');
    assert.deepEqual(errors(page), []);
  });

  test(`Magic Move pairs a line by its tone and heads, and Magic Move to Copy gives a line a data-id (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'slide.transition.magic');
    const text = await render(page);
    const ids = [...text.matchAll(/<svg class="line[^"]*"[^>]*data-id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(ids.length, 2, 'the accent lines of the two slides are not both given a data-id');
    assert.equal(ids[0], ids[1]);
    assert.ok(text.includes('<svg class="line" width="300" height="1" style="translate: 200px 800px">'), 'the plain line without a match was given a data-id');
    await undo(page);
    assert.equal(await render(page), SOURCE);
    await exec(page, 'slide.magicMove');
    const copy = await render(page);
    const copies = [...copy.matchAll(/<svg class="line tone-accent"[^>]*data-id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(copies.length, 2, 'the line and its copy do not both have a data-id');
    assert.equal(copies[0], copies[1]);
    await undo(page);
    assert.equal(await render(page), SOURCE);
    assert.deepEqual(errors(page), []);
  });

  test(`a line is added as the last step and is listed as a Line in the Steps pane (${platform})`, async (t) => {
    const page = await load(t, platform);
    await selectLine(page, 'svg.line');
    assert.equal((await state(page, 'steps.add')).enabled, true);
    await exec(page, 'steps.add');
    await frames(page);
    const expected = edited([['<svg class="line tone-accent" width="200" height="1" style="translate: 200px 900px"><defs><marker id="line-1"', '<svg class="line tone-accent fragment" width="200" height="1" style="translate: 200px 900px" data-fragment-index="1"><defs><marker id="line-1"']]);
    assert.equal(await render(page), expected);
    if (!(await state(page, 'view.steps')).checked) await exec(page, 'view.steps');
    await frames(page);
    const kinds = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .rows .row .kind')].map((k) => k.textContent)`);
    assert.ok(kinds.includes('Line'), `the rows are ${kinds}`);
    await roundTrip(page, expected);
    assert.deepEqual(errors(page), []);
  });
}

for (const platform of PLATFORMS) {
  test(`Push writes slide-out on the slide and slide-in on the next one, is checked, and is played in the preview (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'slide.transition.push');
    await frames(page);
    const expected = edited([['<section>\n  <h2>Centered', '<section data-transition="fade-in slide-out">\n  <h2>Centered'], ['<section>\n  <h2>Two lines', '<section data-transition="slide-in fade-out">\n  <h2>Two lines']]);
    assert.equal(await render(page), expected);
    const checked = [];
    for (const k of ['none', 'fade', 'magic', 'push']) if ((await state(page, `slide.transition.${k}`)).checked) checked.push(k);
    assert.deepEqual(checked, ['push']);
    assert.equal(await page.evaluate(`!!document.querySelector('.beeson-edit-transition [data-command="slide.transition.push"]')`), true);
    await roundTrip(page, expected, 'Undo Transition');
    await exec(page, 'slide.previewTransition');
    await page.waitFor(`document.querySelector('.beeson-edit-preview')?.dataset.phase === 'play'`);
    const kind = await page.evaluate(`(() => { const l = document.querySelector('.beeson-edit-preview'); return [l.dataset.kind, [...l.querySelectorAll('.shot')].map((s) => s.getAnimations().length)]; })()`);
    assert.deepEqual(kind, ['push', [1, 1]]);
    await press(page, 'Escape');
    // Fade gives the file back
    await exec(page, 'slide.transition.fade');
    assert.equal(await render(page), SOURCE);
    assert.deepEqual(errors(page), []);
  });
}

for (const platform of PLATFORMS) {
  test(`Oval clips a picture to an ellipse from the Image pane, and Edit Mask keeps the ellipse (${platform})`, async (t) => {
    const page = await load(t, platform);
    const img = '.reveal section.present figure img';
    await selectPicture(page, img);
    await showPane(page, 'Image');
    assert.equal((await state(page, 'figure.oval')).checked, false);
    await click(page, `${PANEL} label:has(> [data-command="figure.oval"])`);
    await frames(page);
    // the picture is drawn letterboxed in its zone, hence Oval writes its width and keeps it in place
    const expected = edited([[FIGURE, '<figure class="zone" style="translate: 0px 40px">\n    <img src="../../demo/figure-light.png" alt="A figure" style="width: 600px" class="oval">']]);
    assert.equal(await render(page), expected);
    assert.equal(await style(page, 'figure img', 'clipPath'), 'inset(0px round 50%)');
    assert.equal((await state(page, 'figure.oval')).checked, true);
    await roundTrip(page, expected, 'Undo Oval');
    // a mask set on the oval picture is written with the ellipse
    await click(page, img, { count: 2 });
    await page.waitFor(`!!document.querySelector('dialog.beeson-mask-bar[open]')`);
    await page.evaluate(`(() => {
      const s = document.querySelector('dialog.beeson-mask-bar input[type=range]');
      const [lo, hi] = [Number(s.dataset.lo), Number(s.dataset.hi)];
      s.value = String(Math.round(Math.log(1.5 / lo) / Math.log(hi / lo) * 1000));
      s.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await frames(page);
    await press(page, 'Enter');
    await frames(page);
    assert.match(await render(page), /<img src="\.\.\/\.\.\/demo\/figure-light\.png" alt="A figure" style="width: 600px; scale: 1\.5; clip-path: inset\(16\.667% round 50%\)" class="oval">/);
    assert.equal(await style(page, 'figure img', 'clipPath'), 'inset(16.667% round 50%)');
    assert.deepEqual(errors(page), []);
  });

  test(`Oval on a cropped picture keeps its crop inside the ellipse, and taking it off gives the crop back (${platform})`, async (t) => {
    const page = await load(t, platform, 4);
    await selectPicture(page, '.reveal section.present figure img');
    await exec(page, 'figure.oval');
    await frames(page);
    const expected = edited([['<img src="../../demo/figure-light.png" alt="A cropped figure" style="scale: 2; clip-path: inset(25%)">', '<img src="../../demo/figure-light.png" alt="A cropped figure" style="scale: 2; clip-path: inset(25% round 50%)" class="oval">']]);
    assert.equal(await render(page), expected);
    assert.equal(await style(page, 'figure img', 'clipPath'), 'inset(25% round 50%)');
    assert.equal(await style(page, 'figure img', 'scale'), '2');
    await roundTrip(page, expected, 'Undo Oval');
    await selectPicture(page, '.reveal section.present figure img');
    await exec(page, 'figure.oval');
    assert.equal(await render(page), SOURCE);
    assert.deepEqual(errors(page), []);
  });

  test(`a ghosted picture replaced by a video stays ghosted (${platform})`, async (t) => {
    const page = await load(t, platform, 5);
    await page.send('Page.setInterceptFileChooserDialog', { enabled: true });
    await selectPicture(page, '.reveal section.present figure img');
    await page.evaluate(`window.__done = window.BeesonEditor.exec('media.replace').then(() => true); 0`);
    await page.waitFor(`!!document.querySelector('input.beeson-media-input')`);
    const { result } = await page.send('Runtime.evaluate', { expression: `document.querySelector('input.beeson-media-input')` });
    await page.send('DOM.setFileInputFiles', { files: [resolve('demo/clip-light.mp4')], objectId: result.objectId });
    await page.waitFor('window.__done', 20000);
    await frames(page);
    assert.match(await render(page), /<video class="ghost"[^>]*>/);
    assert.equal(await style(page, 'figure video', 'opacity'), GHOST);
    assert.deepEqual(errors(page), []);
  });
}

// the values of Push move the slide left out to the left while the next one comes in from the
// right, in the show of the theme
test('the slide left by Push is moved out while the next slide is moved in', { timeout: 60000 }, async (t) => {
  const page = await browser.newPage({ width: 1600, height: 900 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/${DECK}`);
  await page.waitFor(deckSettled);
  // the values are set a second before the move, as if they were in the file, so that the next
  // slide has ended its move to its place of a future slide
  await page.evaluate(`(() => { const [a, b] = document.querySelectorAll('.slides > section'); a.dataset.transition = 'fade-in slide-out'; b.dataset.transition = 'slide-in fade-out'; })()`);
  await sleep(1000);
  await page.evaluate('Reveal.next()');
  await sleep(250);
  const [a, b] = await page.evaluate(`[...document.querySelectorAll('.slides > section')].slice(0, 2).map((s) => s.getBoundingClientRect().left)`);
  const left = await page.evaluate(`document.querySelector('.reveal .slides').getBoundingClientRect().left`);
  assert.ok(a < left - 100, `the slide left is at ${a}, not moved out to the left of ${left}`);
  assert.ok(b > left + 100, `the next slide is at ${b}, not moving in from the right of ${left}`);
  assert.deepEqual(errors(page), []);
});

// the opacity of the dimmed Zeta in the show: full before its step, and the ghost opacity at its
// step, at the later steps, and on the complete slide
test('a semi-fade-out fragment is drawn at the ghost opacity from its step on, and on the complete slide', { timeout: 60000 }, async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close().catch(() => {}));
  await still(page);
  await page.goto(`${server.origin}/${DECK}?still`);
  await page.waitFor(deckSettled);
  await page.evaluate('Reveal.slide(2)');
  const seen = [];
  for (let i = 0; i < 5; i++) {
    if (i) await page.evaluate('Reveal.next()');
    await sleep(150);
    seen.push(await page.evaluate(`[getComputedStyle(Reveal.getCurrentSlide().querySelector('.semi-fade-out')).opacity, Reveal.getCurrentSlide().hasAttribute('data-complete')]`));
  }
  assert.deepEqual(seen, [['1', false], [GHOST, false], [GHOST, false], [GHOST, false], [GHOST, true]]);
  assert.deepEqual(errors(page), []);
});

// a ghosted step stays ghosted at its step, at the later step, on the complete slide, and on every
// page of the print view on which it is shown
test('a ghosted fragment is drawn at the ghost opacity at its step, after it, with data-complete, and in the print view', { timeout: 90000 }, async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close().catch(() => {}));
  await still(page);
  await page.goto(`${server.origin}/${DECK}?still`);
  await page.waitFor(deckSettled);
  await page.evaluate('Reveal.slide(3)');
  const seen = [];
  for (let i = 0; i < 4; i++) {
    if (i) await page.evaluate('Reveal.next()');
    await sleep(150);
    seen.push(await page.evaluate(`(() => { const s = Reveal.getCurrentSlide(), g = s.querySelector('.ghost'); return [g.classList.contains('visible') ? getComputedStyle(g).opacity : 'hidden', s.hasAttribute('data-complete')]; })()`));
  }
  assert.deepEqual(seen, [['hidden', false], [GHOST, false], [GHOST, false], [GHOST, true]]);
  const print = await browser.newPage();
  t.after(() => print.close().catch(() => {}));
  await printView(print, `${server.origin}/${DECK}?print-pdf`);
  const pages = await print.evaluate(`[...document.querySelectorAll('.pdf-page section')].filter((s) => s.querySelector('.ghost')).map((s) => {
    const g = s.querySelector('.ghost');
    return g.classList.contains('visible') ? getComputedStyle(g).opacity : 'hidden';
  })`);
  assert.ok(pages.length >= 3, `the print view has ${pages.length} pages of the slide`);
  assert.deepEqual(pages.filter((p) => p !== 'hidden'), Array(pages.filter((p) => p !== 'hidden').length).fill(GHOST));
  assert.ok(pages.filter((p) => p !== 'hidden').length >= 2);
});

// the class center is a class of the theme on a text block, and never on a slide, whose class
// center reveal.js reads in its print layout
test('the scope rule allows center, ghost, oval, and the crop of an oval picture, and refuses center on a section', () => {
  const theme = new Set(themeClasses(readFileSync(new URL('../theme/beeson.css', import.meta.url), 'utf8')));
  assert.ok(theme.has('center') && theme.has('ghost') && theme.has('oval'));
  const attrs = (html) => tokenize(html).find((x) => x.type === 'start').attrs;
  assert.deepEqual(editProblems('p', attrs('<p>'), { classes: { center: true, ghost: true } }, theme), []);
  assert.deepEqual(editProblems('section', attrs('<section>'), { classes: { center: true } }, theme), ['the class center on a section']);
  assert.deepEqual(editProblems('section', attrs('<section>'), { classes: { ghost: true } }, theme), []);
  assert.deepEqual(textProblems('<section class="center"><p class="center">A</p></section>', theme), ['the class center on a section']);
  // the crop of an oval picture is cut with the ellipse
  assert.deepEqual(editProblems('img', attrs('<img class="oval">'), { style: { scale: '2', 'clip-path': 'inset(25% round 50%)' } }, theme), []);
  assert.deepEqual(editProblems('img', attrs('<img>'), { style: { 'clip-path': 'inset(25% round 40%)' } }, theme), ['clip-path inset(25% round 40%) on a img']);
});
