// regression tests of R9.3 on both platforms with trusted input: the slides of the navigator, the
// slide commands, and their undo. after an undo or a redo of a slide command the canvas, the
// selected thumbnails, the count of the status bar, the inspector, and the focus are on one slide,
// a change of layout forth and back gives the file byte for byte, and the navigator numbers the
// slides in show order

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];

let browser;
let server;
before(async () => {
  // the test of every slide changed to each layout is one read of 48 s on a runner, and of over the
  // 120 s in which Chrome must answer by default on two cores, hence the limit of an answer is 8 min
  browser = await launch({ offline: false, timeout: 480000 });
  server = await serve('.');
});
after(async () => {
  await browser?.close();
  server?.close();
});

const js = (v) => JSON.stringify(v);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let saves = 0;

// the editor on the demo deck served over HTTP, in a window of 1600 by 1000 px, with the Format
// pane of the inspector shown
async function load(t, platform, { n = 0, mode = 'light' } = {}) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }] });
  const url = `${server.origin}/index.html?edit&still&theme=${mode}&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('index.html', 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the row of slide n of the navigator, counted from 1, scrolled into view and clicked
async function row(page, n, modifiers = '') {
  const at = await page.evaluate(`(() => {
    const r = document.querySelectorAll('.beeson-edit-nav .row')[${n - 1}];
    r.scrollIntoView({ block: 'nearest' });
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  })()`);
  await click(page, at, { modifiers });
  await frames(page);
}

// a trusted key, then a wait for the history and the refresh that it starts
async function key(page, keys) {
  await press(page, keys);
  await sleep(150);
  await page.evaluate('window.BeesonEditor.status()');
  await frames(page);
}

const UNDO = 'Mod+Z';
const REDO = (platform) => (platform === 'mac' ? 'Mod+Shift+Z' : 'Mod+Y');

// the slide of each view, counted from 1: the slide of reveal.js, 0 when it is off the page, the
// slide drawn on the canvas, the current row, the count of the status bar, the selected rows, the
// focused row, and the layout in the card of the inspector with that of the current slide
const VIEWS = `(() => {
  window.BeesonEditor.status();
  const secs = [...document.querySelectorAll('.reveal:not(.beeson-peek) .slides > section')];
  const rows = [...document.querySelectorAll('.beeson-edit-nav .row')];
  const cur = Reveal.getCurrentSlide();
  const layout = (s) => ['title', 'section', 'closing', 'figure', 'split'].find((c) => s?.classList.contains(c)) ?? 'content';
  return {
    n: secs.length,
    reveal: secs.indexOf(cur) + 1,
    canvas: secs.findIndex((s) => s.classList.contains('present')) + 1,
    row: rows.findIndex((r) => r.getAttribute('aria-current') === 'true') + 1,
    status: document.querySelector('.beeson-edit-bottom .count')?.textContent ?? '',
    selected: rows.flatMap((r, i) => (r.getAttribute('aria-selected') === 'true' ? [i + 1] : [])),
    focus: rows.indexOf(document.activeElement) + 1,
    card: document.querySelector('.ed-chooser .what > span:last-child')?.textContent ?? '',
    layout: layout(cur),
    // the layouts of the selected slides, of which several read Multiple Layouts
    layouts: [...new Set(rows.flatMap((r, i) => (r.getAttribute('aria-selected') === 'true' ? [layout(secs[i]) + (secs[i].classList.contains('narrow') ? ' narrow' : secs[i].classList.contains('wide') ? ' wide' : '')] : [])))].length,
  };
})()`;

const NAMES = { content: 'Content', section: 'Section', title: 'Title', closing: 'Closing', figure: 'Figure', split: 'Split' };

// agree asserts that every view is on slide current, with the rows of selected selected, the focus
// on the current row when focus is set, and the layout of the slide in the card of the inspector
// when card is set, i.e. when the caret is not in a text, or Multiple Layouts for selected slides
// of several layouts
async function agree(page, what, { n, current, selected, focus = true, card = true }) {
  const v = await page.evaluate(VIEWS);
  const want = { n, reveal: current, canvas: current, row: current, status: `Slide ${current} of ${n}`, selected };
  const got = { n: v.n, reveal: v.reveal, canvas: v.canvas, row: v.row, status: v.status, selected: v.selected };
  assert.deepEqual(got, want, `the views disagree ${what}`);
  if (focus) assert.equal(v.focus, current, `the focus is not on the row of the current slide ${what}`);
  if (card) assert.ok(v.card.startsWith(v.layouts > 1 ? 'Multiple Layouts' : NAMES[v.layout]), `the inspector reads the layout "${v.card}" on a ${v.layout} slide ${what}`);
}

// finding 1 (navigator-slides-canvas-2, dialogs-undo-a11y-1 and 2): an undo puts back the current
// slide and the selected slides from before a slide command, a redo those from after it, and the
// canvas, the thumbnails, the status bar, the inspector, and the focus agree
for (const platform of PLATFORMS) {
  test(`after a slide command, its undo, and its redo every view is on one slide (${platform})`, async (t) => {
    const page = await load(t, platform);
    await row(page, 6);
    await row(page, 8, 'Shift');
    await key(page, 'Mod+D');
    await agree(page, 'after Duplicate', { n: 16, current: 11, selected: [7, 9, 11] });
    await key(page, UNDO);
    await agree(page, 'after the undo of Duplicate', { n: 13, current: 8, selected: [6, 7, 8] });
    await key(page, REDO(platform));
    await agree(page, 'after the redo of Duplicate', { n: 16, current: 11, selected: [7, 9, 11] });
    await key(page, UNDO);
    await byteExact(page);

    await row(page, 6);
    await row(page, 8, 'Shift');
    await key(page, 'Delete');
    await agree(page, 'after Delete', { n: 10, current: 6, selected: [6] });
    await key(page, UNDO);
    await agree(page, 'after the undo of Delete', { n: 13, current: 8, selected: [6, 7, 8] });
    await key(page, REDO(platform));
    await agree(page, 'after the redo of Delete', { n: 10, current: 6, selected: [6] });
    await key(page, UNDO);
    await byteExact(page);

    await row(page, 5);
    await key(page, 'Enter');
    await agree(page, 'after New Slide', { n: 14, current: 6, selected: [6], focus: false, card: false });
    await key(page, UNDO);
    await agree(page, 'after the undo of New Slide', { n: 13, current: 5, selected: [5] });
    await byteExact(page);

    await row(page, 5);
    await exec(page, 'slide.layout.split');
    await agree(page, 'after the change to Split', { n: 13, current: 5, selected: [5], focus: false });
    await key(page, UNDO);
    await agree(page, 'after the undo of the change to Split', { n: 13, current: 5, selected: [5], focus: false });
    await byteExact(page);

    await row(page, 5);
    await key(page, 'Alt+ArrowDown');
    await agree(page, 'after Move Slide Down', { n: 13, current: 6, selected: [6] });
    await key(page, UNDO);
    await agree(page, 'after the undo of Move Slide Down', { n: 13, current: 5, selected: [5] });
    await key(page, REDO(platform));
    await agree(page, 'after the redo of Move Slide Down', { n: 13, current: 6, selected: [6] });
    await key(page, UNDO);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}

// the parts of the current slide in slide px: the boxes of its heading, its running head, and its
// texts, the word blocks left as loose children of the section, the children of its plate, and
// the overflow count of the status
const PARTS = `(() => {
  const s = Reveal.getCurrentSlide();
  const stage = document.querySelector('.reveal:not(.beeson-peek) .slides').getBoundingClientRect();
  const k = stage.width / 1920;
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: (r.left - stage.left) / k, t: (r.top - stage.top) / k, r: (r.right - stage.left) / k, b: (r.bottom - stage.top) / k }; };
  const plate = s.querySelector(':scope > .plate');
  return {
    loose: [...s.querySelectorAll(':scope > p, :scope > ul, :scope > ol, :scope > .math')].map((e) => e.localName),
    heading: box(s.querySelector('h2')),
    run: s.querySelector(':scope > .run') ? box(s.querySelector(':scope > .run')) : null,
    words: [...s.querySelectorAll('[contenteditable="true"]')].filter((e) => !e.closest('aside, .backdrop, .run') && e.localName !== 'h2' && e.getBoundingClientRect().width > 0).map(box),
    plate: plate ? [...plate.children].filter((c) => !c.classList.contains('beeson-placeholder')).map((c) => c.localName) : null,
    overflow: window.BeesonEditor.status().overflow,
  };
})()`;

const meets = (a, b) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
const inside = (w) => w.l >= -1 && w.r <= 1921 && w.t >= -1 && w.b <= 1081;

// finding 2 (navigator-slides-canvas-1, and probes 13 and 14 of the juror of round 4): a content
// slide changed to Figure has its words in the caption at the lower left, clear of the heading and
// the running head, a text that runs past the slide is reported, a slide without a drawing gets the
// empty plate of the layout, which a new table fills, and a change back to Content gives the file
for (const platform of PLATFORMS) {
  test(`a content slide changed to Figure has its words in the caption and an empty plate, and a change back gives the file (${platform})`, async (t) => {
    const page = await load(t, platform);
    for (const n of [3, 4, 5, 6]) {
      await page.evaluate(`Reveal.slide(${n - 1})`);
      await frames(page);
      await exec(page, 'slide.layout.figure');
      await sleep(200);
      await frames(page);
      const p = await page.evaluate(PARTS);
      assert.deepEqual(p.loose, [], `slide ${n} keeps loose words in the Figure layout`);
      for (const w of p.words) {
        assert.ok(!meets(w, p.heading), `a text of slide ${n} is drawn over its heading: ${js(w)} ${js(p.heading)}`);
        if (p.run) assert.ok(!meets(w, p.run), `a text of slide ${n} is drawn over its running head: ${js(w)} ${js(p.run)}`);
      }
      const out = p.words.filter((w) => !inside(w)).length;
      assert.equal(p.overflow, out, `slide ${n} has ${out} texts past the slide, and the status reports ${p.overflow}`);
      // slide 3 has a backdrop and slide 5 a figure, which take the place of the plate
      if (n === 4 || n === 6) assert.deepEqual(p.plate, [], `slide ${n} does not get the empty plate of the layout`);
      const edited = await render(page);
      await page.evaluate('window.BeesonEditor.undo()');
      await byteExact(page);
      await page.evaluate('window.BeesonEditor.redo()');
      assert.equal(await render(page), edited);
      if (n === 6) {
        await exec(page, 'insert.table', { rows: 2, columns: 2 });
        assert.equal(await page.evaluate(`!!Reveal.getCurrentSlide().querySelector(':scope > .plate table')`), true, 'a new table does not fill the plate');
        await page.evaluate('window.BeesonEditor.undo()');
        assert.equal(await render(page), edited);
      }
      await exec(page, 'slide.layout.content');
      await byteExact(page);
    }
    const { text } = await saveAndReopen(page, `r9-3-${++saves}.html`);
    assert.equal(text, page.source);
    assert.deepEqual(errors(page), []);
  });
}

// finding 2, part 2: a text of the caption of a figure slide that reaches its heading or its
// running head is marked and counted in the status, as a text past the slide is
for (const platform of PLATFORMS) {
  test(`a long text changed to Figure that reaches the heading is reported in the status (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 3 });
    const at = await page.evaluate(`(() => {
      const r = Reveal.getCurrentSlide().querySelector(':scope > p').getBoundingClientRect();
      return { x: r.left + 20, y: r.top + r.height / 2 };
    })()`);
    await click(page, at);
    await press(page, 'End');
    await page.send('Input.insertText', { text: ' More words that make the caption run up the slide.'.repeat(6) });
    await press(page, 'Escape');
    await exec(page, 'slide.layout.figure');
    await sleep(200);
    await frames(page);
    const p = await page.evaluate(PARTS);
    const reached = p.words.filter((w) => !inside(w) || meets(w, p.heading) || (p.run && meets(w, p.run))).length;
    assert.ok(reached > 0, 'the probe text does not reach the heading');
    assert.equal(p.overflow, reached, `${reached} texts are past the slide or over its heading, and the status reports ${p.overflow}`);
  });
}

// finding 11 (check 7 of the laptop tests of round 4): a change of layout forth and back gives the
// file byte for byte, for every slide of the demo deck, each of which has a footnote, a backdrop,
// a zone, or notes
const LAYOUTS = ['title', 'section', 'content', 'narrow', 'wide', 'figure', 'split', 'closing'];
for (const platform of PLATFORMS) {
  test(`every slide of the demo deck changed to each layout and back gives the file byte for byte (${platform})`, async (t) => {
    const page = await load(t, platform);
    const failed = await page.evaluate(`(async () => {
      const E = window.BeesonEditor;
      const source = ${js(page.source)};
      const out = [];
      const n = document.querySelectorAll('.reveal .slides > section').length;
      const layout = (s) => ['title', 'section', 'closing', 'figure', 'split', 'narrow', 'wide'].find((c) => s.classList.contains(c)) ?? 'content';
      for (let i = 0; i < n; i++) {
        for (const to of ${js(LAYOUTS)}) {
          document.querySelectorAll('.beeson-edit-nav .row')[i].click();
          const from = layout(Reveal.getCurrentSlide());
          if (to === from) continue;
          await E.exec('slide.layout.' + to);
          await E.exec('slide.layout.' + from);
          if (E.render() !== source) {
            out.push((i + 1) + ': ' + from + ' to ' + to + ' and back');
            await E.undo();
            await E.undo();
          }
          if (E.render() !== source) return [...out, 'the undo does not give the file back'];
        }
      }
      return out;
    })()`);
    assert.deepEqual(failed, []);
    assert.deepEqual(errors(page), []);
  });
}

// finding 3 (shell-2): after a jump of three or more slides, the thumbnail of a far slide with a
// backdrop keeps its drawing at the size of the slide
const THUMB = `(() => {
  const c = document.querySelectorAll('.beeson-edit-nav .row .pic')[0]?.shadowRoot?.querySelector('canvas');
  return c ? c.style.width || String(c.getBoundingClientRect().width) : null;
})()`;
for (const platform of PLATFORMS) {
  test(`the thumbnail of the title slide keeps the size of its drawing after a jump to a far slide (${platform})`, async (t) => {
    const page = await load(t, platform);
    await sleep(2500);
    const first = await page.evaluate(THUMB);
    assert.ok(first, 'the thumbnail of slide 1 does not have a canvas');
    for (const n of [5, 6]) {
      await row(page, n);
      await sleep(2500);
      assert.equal(await page.evaluate(THUMB), first, `the drawing of the thumbnail of slide 1 changes size after a click on slide ${n}`);
    }
  });
}

// finding 4 (navigator-slides-canvas-3): a new slide by Return, the key of New Slide, or its menu
// item repeats the layout of a figure or a split slide, and the gallery focuses that layout
for (const platform of PLATFORMS) {
  test(`a new slide after a figure or a split slide repeats its layout (${platform})`, async (t) => {
    const page = await load(t, platform);
    for (const layout of ['figure', 'split']) {
      await row(page, 5);
      await exec(page, `slide.new.${layout}`);
      await row(page, 6);
      await key(page, 'Enter');
      assert.equal((await page.evaluate(VIEWS)).layout, layout, `Return after a ${layout} slide does not repeat its layout`);
      await row(page, 7);
      await key(page, 'Ctrl+M');
      assert.equal((await page.evaluate(VIEWS)).layout, layout, `Ctrl+M after a ${layout} slide does not repeat its layout`);
      await row(page, 8);
      await exec(page, 'slide.gallery');
      await frames(page);
      assert.equal(await page.evaluate('document.activeElement?.dataset?.layout ?? null'), layout, `the gallery does not focus ${layout}`);
      await key(page, 'Escape');
      for (let i = 0; i < 3; i++) await page.evaluate('window.BeesonEditor.undo()');
      await byteExact(page);
    }
    // a title slide is still followed by a content slide
    await row(page, 1);
    await key(page, 'Enter');
    assert.equal((await page.evaluate(VIEWS)).layout, 'content');
  });
}

// finding 5 (navigator-slides-canvas-4): with slides of several layouts selected, the Slide pane
// reads Multiple Layouts, the chooser marks no layout, the Hidden box is mixed, the Text Column is
// not shown, and the controls act on every selected slide
for (const platform of PLATFORMS) {
  test(`the Slide pane shows a mixed state for slides of several layouts and acts on all of them (${platform})`, async (t) => {
    const page = await load(t, platform);
    await row(page, 8);
    await exec(page, 'slide.hide');
    // a range by Shift, since Ctrl with a click is a click of the right button on macOS
    await row(page, 6);
    await row(page, 8, 'Shift');
    const pane = await page.evaluate(`(() => {
      const box = document.querySelector('.ed-check input[data-command="slide.hide"]');
      return { card: document.querySelector('.ed-chooser .what > span:last-child').textContent, mixed: box.indeterminate, column: !!document.querySelector('[aria-label="Width of the text column"]') };
    })()`);
    assert.deepEqual(pane, { card: 'Multiple Layouts', mixed: true, column: false });
    await click(page, '.ed-chooser');
    await page.waitFor(`!!document.querySelector('.beeson-edit-layouts')`);
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-layouts .tile[aria-selected="true"]')].map((t) => t.dataset.layout)`), []);
    const classes = `[5, 6, 7].map((i) => document.querySelectorAll('.reveal .slides > section')[i].className.replace(/\\b(present|past|future)\\b/g, '').trim())`;
    const first = await page.evaluate(classes);
    await click(page, '.beeson-edit-layouts .tile[data-layout="wide"]');
    await sleep(200);
    assert.deepEqual(await page.evaluate(classes), ['wide', 'wide', 'wide']);
    // the change of the three slides is one entry of the history
    await page.evaluate('window.BeesonEditor.undo()');
    await frames(page);
    assert.deepEqual(await page.evaluate(classes), first);
    await click(page, '.ed-check:has(input[data-command="slide.hide"])');
    await sleep(200);
    assert.deepEqual(await page.evaluate(`[5, 6, 7].map((i) => document.querySelectorAll('.reveal .slides > section')[i].getAttribute('data-visibility'))`), ['hidden', 'hidden', 'hidden']);
  });
}

// finding 6 (navigator-slides-canvas-5): the navigator and the light table number the slides in
// show order, and a hidden slide does not take a number of its own
for (const platform of PLATFORMS) {
  test(`a hidden slide does not take a number in the navigator and the light table (${platform})`, async (t) => {
    const page = await load(t, platform);
    await row(page, 4);
    await exec(page, 'slide.hide');
    await frames(page);
    const nav = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-nav .row .no')].slice(0, 6).map((n) => n.textContent)`);
    assert.deepEqual(nav, ['1', '2', '3', '', '4', '5']);
    await exec(page, 'view.lightTable');
    await sleep(300);
    const table = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-sorter .tile')].slice(0, 6).map((t) => t.querySelector('.no').textContent + (t.classList.contains('hidden-slide') ? ' hidden' : ''))`);
    assert.deepEqual(table, ['1', '2', '3', '4 hidden', '4', '5']);
  });
}

// finding 7 (menus-keys-6): Mod+A in the navigator selects every slide
for (const platform of PLATFORMS) {
  test(`Mod+A in the navigator selects every slide (${platform})`, async (t) => {
    const page = await load(t, platform);
    await row(page, 4);
    await key(page, 'Mod+A');
    const v = await page.evaluate(VIEWS);
    assert.deepEqual(v.selected, Array.from({ length: 13 }, (_, i) => i + 1));
    assert.equal(v.focus, 4);
  });
}

// finding 8 (menus-keys-12): Move Slide Up and Down are dimmed on the canvas, where their keys do
// nothing, since Alt with an arrow adds a row to a table there and the sheet of keys lists a key
// at one command of the slide, and they run by their keys in the navigator
for (const platform of PLATFORMS) {
  test(`Move Slide Up is dimmed on the canvas and runs by Alt+ArrowUp in the navigator (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 3 });
    const canvas = await page.evaluate(`(() => { const r = document.querySelector('.beeson-edit-canvas').getBoundingClientRect(); return { x: r.left + 12, y: r.top + 12 }; })()`);
    await click(page, canvas);
    assert.equal((await state(page, 'slide.moveUp')).enabled, false, 'Move Slide Up is enabled on the canvas');
    assert.equal((await state(page, 'slide.moveDown')).enabled, false, 'Move Slide Down is enabled on the canvas');
    await key(page, 'Alt+ArrowUp');
    await byteExact(page);
    await row(page, 4);
    assert.equal((await state(page, 'slide.moveUp')).enabled, true);
    await key(page, 'Alt+ArrowUp');
    await agree(page, 'after Alt+ArrowUp in the navigator', { n: 13, current: 3, selected: [3] });
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Move Slide Up');
    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
  });
}

// finding 9 (menus-keys-8): the context menu of the slide canvas offers Duplicate Slide and Delete
// Slide
for (const platform of PLATFORMS) {
  test(`the context menu of the canvas offers Duplicate Slide and Delete Slide (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 5 });
    const slide = await page.evaluate(`(() => { const r = document.querySelector('.reveal:not(.beeson-peek) .slides > section.present').getBoundingClientRect(); return { x: r.left + r.width * 0.9, y: r.top + r.height * 0.5 }; })()`);
    await click(page, slide, { button: 'right' });
    await frames(page);
    const items = await page.evaluate(`[...([...document.querySelectorAll('.beeson-edit-menu')].at(-1)?.querySelectorAll('.item') ?? [])].map((el) => el.dataset.command)`);
    assert.ok(items.includes('slide.duplicate'), `the canvas menu lists ${items.join(', ')}`);
    assert.ok(items.includes('slide.delete'), `the canvas menu lists ${items.join(', ')}`);
  });
}

// finding 10 (navigator-slides-canvas-7): Duplicate of several slides is named in the plural
for (const platform of PLATFORMS) {
  test(`the duplicate of several slides is named Duplicate Slides (${platform})`, async (t) => {
    const page = await load(t, platform);
    await row(page, 6);
    await row(page, 8, 'Shift');
    assert.equal((await state(page, 'slide.duplicate')).label, 'Duplicate Slides');
    await key(page, 'Mod+D');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Duplicate Slides');
  });
}

// finding 12 (state 54 of round 4, and Add Section of PowerPoint): the context menus of a thumbnail
// and of the empty part of the navigator list New Section after New Slide, which inserts a section
// slide after the slide under the pointer, or at the end of the deck, as one entry of the history
const MENU = `[...([...document.querySelectorAll('.beeson-edit-menu')].at(-1)?.querySelectorAll('.item') ?? [])].map((el) => el.dataset.command).filter(Boolean)`;
async function pick(page, id) {
  const at = await page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-edit-menu')].at(-1).querySelector('.item[data-command="${id}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await sleep(200);
  await frames(page);
}
const LAYOUT_AT = (i) => `(() => { const s = document.querySelectorAll('.reveal .slides > section')[${i}]; return ['title', 'section', 'closing', 'figure', 'split'].find((c) => s.classList.contains(c)) ?? 'content'; })()`;
for (const platform of PLATFORMS) {
  test(`New Section in the menus of the navigator inserts a section slide after the slide or at the end (${platform})`, async (t) => {
    const page = await load(t, platform);
    const at = await page.evaluate(`(() => { const r = document.querySelectorAll('.beeson-edit-nav .row')[2]; r.scrollIntoView({ block: 'nearest' }); const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    await click(page, at, { button: 'right' });
    await frames(page);
    const items = await page.evaluate(MENU);
    assert.equal(items[items.indexOf('slide.new') + 1], 'slide.newSection', `the menu of a thumbnail lists ${items.join(', ')}`);
    await pick(page, 'slide.newSection');
    assert.equal(await page.evaluate(LAYOUT_AT(3)), 'section', 'the new section slide is not after slide 3');
    await agree(page, 'after New Section on slide 3', { n: 14, current: 4, selected: [4], focus: false, card: false });
    assert.equal((await state(page, 'edit.undo')).label, 'Undo New Section');
    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
    const nav = await page.evaluate(`(() => { const r = document.querySelector('.beeson-edit-nav').getBoundingClientRect(); return { x: r.left + 20, y: r.bottom - 20 }; })()`);
    await page.evaluate(`window.BeesonEditorShell.context('navigator', ${nav.x}, ${nav.y})`);
    await frames(page);
    const empty = await page.evaluate(MENU);
    assert.equal(empty[empty.indexOf('slide.new') + 1], 'slide.newSection', `the menu of the navigator lists ${empty.join(', ')}`);
    await pick(page, 'slide.newSection');
    assert.equal(await page.evaluate(LAYOUT_AT(13)), 'section', 'the new section slide is not at the end');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo New Section');
    await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}

// the status bar counts in show order, as the navigator numbers the slides: a hidden slide is not
// numbered, and it is read by the shown slide before it
const COUNT = `(() => { const c = document.querySelector('.beeson-edit-bottom .count'); return { text: c.textContent, struck: c.querySelector('s')?.textContent ?? null, name: c.getAttribute('aria-label') }; })()`;
for (const platform of PLATFORMS) {
  test(`the status bar counts the slides in show order, and names a hidden slide (${platform})`, async (t) => {
    const page = await load(t, platform);
    await row(page, 5);
    assert.deepEqual(await page.evaluate(COUNT), { text: 'Slide 5 of 13', struck: null, name: null });
    await row(page, 4);
    await exec(page, 'slide.hide');
    await frames(page);
    assert.deepEqual(await page.evaluate(COUNT), { text: 'Hidden slide, after slide 3 of 12', struck: null, name: null });
    await row(page, 5);
    assert.deepEqual(await page.evaluate(COUNT), { text: 'Slide 4 of 12', struck: null, name: null });
    await page.evaluate('window.BeesonEditor.undo()');
    await frames(page);
    await byteExact(page);
    await row(page, 5);
    assert.deepEqual(await page.evaluate(COUNT), { text: 'Slide 5 of 13', struck: null, name: null });
  });
}
