// regression tests of R9.2 on both platforms with trusted input. a thumbnail of the navigator shows
// its slide at the load of the deck, after a click on it, after the arrow keys, after an edit of its
// slide, and after an undo, and it is never drawn with raw TeX. after each edit the text is checked
// byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];

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
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let saves = 0;

// every drawing of a thumbnail of the navigator with a shown formula in raw TeX, kept in
// window.rawThumbs from before the open of the deck on
const WATCH = `(() => {
  window.rawThumbs = [];
  const check = () => {
    document.querySelectorAll('.beeson-edit-nav .row .pic').forEach((h, i) => {
      const wrap = h.shadowRoot?.querySelector('.beeson-thumb');
      if (!wrap || wrap.dataset.checked) return;
      wrap.dataset.checked = '1';
      const walker = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        const up = t.parentElement;
        if (up.closest('pre, code, mjx-container') || getComputedStyle(up).visibility === 'hidden') continue;
        const m = /\\\\[(\\[].{0,16}/.exec(t.data);
        if (m) window.rawThumbs.push({ slide: i + 1, text: m[0] });
      }
    });
    requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
  return true;
})()`;

// the editor on the slide n of the demo deck served over HTTP, in a window of 1600 by 1000 px as in
// the shoot of the council, with the thumbnails watched for raw TeX from before the open. the deck
// is opened at once after the editor is ready, as the shoot opens it
async function load(t, platform, { n = 0, mode = 'light', width = 1600, height = 1000 } = {}) {
  const page = await browser.newPage({ width, height });
  t.after(() => page.close().catch(() => {}));
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }] });
  const url = `${server.origin}/index.html?edit&still&theme=${mode}&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  await page.evaluate(WATCH);
  page.source = readFileSync('index.html', 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks the text before byte for byte after undos undos, the edit after as many redos,
// and an open of the saved edit without problems, which is the text before the next check
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r9-2-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

// the thumbnails of the navigator in view, each with the heading of its slide and the heading
// drawn in its picture, which is null for a blank thumbnail
const PICTURES = `(() => {
  const list = document.querySelector('.beeson-edit-nav .rows') ?? document.querySelector('.beeson-edit-nav');
  const box = list.getBoundingClientRect();
  const slides = [...document.querySelectorAll('.reveal:not(.beeson-peek) .slides > section')];
  return [...document.querySelectorAll('.beeson-edit-nav .row .pic')].map((h, i) => {
    const r = h.getBoundingClientRect();
    const shown = r.width > 0 && r.bottom > box.top && r.top < box.bottom;
    const head = (s) => s?.querySelector('h1, h2')?.textContent.replace(/\\s+/g, ' ').trim() ?? '';
    const section = h.shadowRoot?.querySelector('.beeson-thumb .slides > section');
    return { slide: i + 1, shown, heading: head(slides[i]), drawn: section ? head(section) : null };
  }).filter((p) => p.shown);
})()`;

// allDrawn asserts that every thumbnail in view shows its slide, in the state named by what
async function allDrawn(page, what) {
  const pics = await page.evaluate(PICTURES);
  assert.ok(pics.length >= 3, `only ${pics.length} thumbnails are in view ${what}`);
  for (const p of pics) assert.equal(p.drawn, p.heading, `the thumbnail of slide ${p.slide} is drawn ${p.drawn === null ? 'blank' : `with the heading "${p.drawn}"`} ${what}`);
}

// the center of the thumbnail of slide n, counted from 1
const thumb = (page, n) =>
  page.evaluate(`(() => { const r = document.querySelectorAll('.beeson-edit-nav .row .pic')[${n - 1}].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

const noRawTex = async (page) => assert.deepEqual(await page.evaluate('window.rawThumbs'), [], 'a thumbnail is drawn with raw TeX');

// finding 1: the thumbnail of the selected slide was drawn blank, with only its row of step
// circles, while the formulas of the deck were not typeset yet, since a thumbnail without a picture
// waited for them
for (const platform of PLATFORMS) {
  test(`every thumbnail in view shows its slide at the load of the deck and after a click on it (${platform})`, async (t) => {
    const page = await load(t, platform);
    await allDrawn(page, 'at the load of the deck');
    // slide 3 has formulas in the labels of its backdrop, and slide 2 does not have a formula
    for (const n of [3, 2, 4]) {
      await click(page, await thumb(page, n));
      await frames(page);
      assert.equal(await page.evaluate('Reveal.getIndices().h'), n - 1);
      await allDrawn(page, `after a click on the thumbnail of slide ${n}`);
    }
    await sleep(800);
    await allDrawn(page, 'after the clicks settle');
    await noRawTex(page);
    assert.deepEqual(errors(page), []);
  });

  test(`every thumbnail in view shows its slide after the arrow keys in the navigator (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, await thumb(page, 1));
    for (const [key, n] of [['ArrowDown', 2], ['ArrowDown', 3], ['ArrowDown', 4], ['ArrowUp', 3]]) {
      await press(page, key);
      await frames(page);
      assert.equal(await page.evaluate('Reveal.getIndices().h'), n - 1, `${key} does not show slide ${n}`);
      await allDrawn(page, `after ${key} to slide ${n}`);
    }
    await sleep(800);
    await allDrawn(page, 'after the arrow keys settle');
    await noRawTex(page);
    assert.deepEqual(errors(page), []);
  });

  test(`the thumbnail of a slide with formulas shows the slide after an edit and an undo, never with raw TeX (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 3 });
    // the paragraph of slide 4 with the formula \(\tilde U\), whose TeX is shown while it is edited
    const para = '.reveal section.present p.fragment[data-fragment-index="2"]';
    await click(page, para);
    await press(page, 'End');
    await type(page, ' Edited');
    await sleep(900);
    await allDrawn(page, 'while a paragraph with a formula is edited');
    await press(page, 'Escape');
    await sleep(900);
    await allDrawn(page, 'after the edit');
    const drawnText = () => page.evaluate(`document.querySelectorAll('.beeson-edit-nav .row .pic')[3].shadowRoot.querySelector('.beeson-thumb').textContent`);
    assert.match(await drawnText(), /Edited/, 'the thumbnail of slide 4 does not show the edit');
    await press(page, 'Mod+Z');
    await frames(page);
    await allDrawn(page, 'right after the undo');
    await sleep(900);
    await allDrawn(page, 'after the undo');
    assert.doesNotMatch(await drawnText(), /Edited/, 'the thumbnail of slide 4 still shows the edit after the undo');
    await noRawTex(page);
    await press(page, 'Mod+Shift+Z');
    await roundTrip(page);
    await noRawTex(page);
  });
}

// text typed key by key at the caret, as the shoot of the council types it, with a frame after
// each key so that the substitution of the key is made before the next one
async function typeKeys(page, text) {
  for (const ch of text) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
  }
  await frames(page);
}

// the caret put into the block of selector by a click, then moved after the first occurrence of
// mark in its text, or to its start or end for the marks 'start' and 'end'
async function caretAt(page, selector, mark) {
  // a click on a block selected after an open of the text may select it, and a second one edits it
  for (let i = 0; i < 2; i++) {
    await click(page, selector);
    await frames(page);
    if (await page.evaluate(`document.querySelector(${js(selector)}).contains(document.activeElement)`)) break;
  }
  const ok = await page.evaluate(`(() => {
    const host = document.querySelector(${js(selector)});
    const sel = getSelection();
    if (${js(mark)} === 'start' || ${js(mark)} === 'end') {
      const range = document.createRange();
      range.selectNodeContents(host);
      range.collapse(${js(mark)} === 'start');
      sel.removeAllRanges();
      sel.addRange(range);
      return document.activeElement === host || host.contains(document.activeElement);
    }
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const i = t.data.indexOf(${js(mark)});
      if (i >= 0) { sel.collapse(t, i + ${js(mark)}.length); return true; }
    }
    return false;
  })()`);
  assert.ok(ok, `the caret is not put at ${mark} of ${selector}`);
}

const PARA = '<p>Export your matplotlib figure with the styles of the template. It will show frameless.</p>';
const ITEM = '<li class="fragment" data-fragment-index="2">You might have noticed a toggle on the top right: try clicking it on this slide.</li>';
const DASHED = [
  ['paragraph', '.reveal section.present > p', PARA],
  ['list item', '.reveal section.present li:nth-child(2)', ITEM],
];

// finding 2: a space typed after an en dash at the end of a paragraph was reported lost, " - ok"
// written as "–ok". an en dash keeps the spaces typed around it at the start, in the middle, and at
// the end of a paragraph and of a list item, with a plain space between it and the next word
for (const platform of PLATFORMS) {
  for (const [what, selector, html] of DASHED) {
    test(`a hyphen typed between spaces becomes an en dash and keeps the space after it, at the start, the middle, and the end of a ${what} (${platform})`, async (t) => {
      const inner = /^<[^>]*>([^]*)<\/[a-z]+>$/.exec(html)[1];
      const words = inner.split(' ').slice(0, 3).join(' ');
      const cases = [
        ['start', 'ok - go ', `ok – go ${inner}`],
        [words, ' - ok', inner.replace(words, `${words} – ok`)],
        ['end', ' - ok', `${inner} – ok`],
        ['end', ' - ', `${inner} – `],
      ];
      for (const [mark, typed, now] of cases) {
        const page = await load(t, platform, { n: 4 });
        await caretAt(page, selector, mark);
        await typeKeys(page, typed);
        await press(page, 'Escape');
        await frames(page);
        const want = html.replace(inner, now);
        const lines = (await render(page)).split('\n').filter((l) => !page.source.split('\n').includes(l));
        assert.deepEqual(lines.map((l) => l.trim()), [want], `${js(typed)} typed at ${mark} of the ${what} is not written as in Keynote`);
        await byteExact(page, [[html, want]]);
        // the typing before the dash, the dash, and the typing after it are undone one at a time
        await roundTrip(page, 3);
        await page.close();
      }
    });
  }
}

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// the new table of the current slide with its bars, the boxes of the other elements of the slide
// that a table must not mix with, i.e. the ink of the text of each block and the box of each figure
// and drawing, and whether the table hides what is under it. a box is in CSS px of the window
const TABLE_STATE = `(() => {
  const slide = document.querySelector('.reveal section.present');
  const table = slide.querySelector('table');
  const box = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  const t = box(table.getBoundingClientRect());
  const all = { ...t };
  for (const el of document.querySelectorAll('.beeson-table-bars > *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || el.matches('.cell, .fill, .spread, .guide')) continue;
    all.left = Math.min(all.left, r.left); all.top = Math.min(all.top, r.top);
    all.right = Math.max(all.right, r.right); all.bottom = Math.max(all.bottom, r.bottom);
  }
  const ink = (el) => { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return b.width && b.height ? box(b) : null; };
  const others = [];
  for (const el of slide.querySelectorAll('h2, p, li, .math, pre, .foot, .caption, figcaption')) {
    if (table.contains(el) || el.closest('aside.notes') || !el.getClientRects().length) continue;
    const b = ink(el);
    if (b) others.push({ what: el.localName + ':' + el.textContent.trim().slice(0, 24), box: b });
  }
  for (const el of slide.querySelectorAll('.zone, .plate, .surface, figure img:not([hidden])')) {
    const r = el.getBoundingClientRect();
    if (r.width && r.height && getComputedStyle(el).display !== 'none') others.push({ what: el.localName + '.' + el.className, box: box(r) });
  }
  // a point of each cell is drawn by the table, and not by an element under it or over it
  const hidden = [...table.querySelectorAll('td, th')].every((c) => {
    const r = c.getBoundingClientRect();
    return [[0.25, 0.3], [0.5, 0.5], [0.75, 0.7]].every(([u, v]) => table.contains(document.elementFromPoint(r.left + u * r.width, r.top + v * r.height)));
  });
  const opaque = [table, ...table.querySelectorAll('td, th')].some((el) => { const c = getComputedStyle(el).backgroundColor; return c !== 'transparent' && !/rgba\\(.*, 0\\)$/.test(c); });
  return { table: t, all, slide: box(slide.getBoundingClientRect()), others, hidden, opaque, shape: [...table.rows].map((r) => r.cells.length) };
})()`;

// a new table of columns by rows inserted on the current slide by Insert Table, as from the grid of
// the button Table, after the last list item of the slide is selected as a block, as in state 93
async function insertTableOn(page, columns, rows) {
  const last = '.reveal section.present ul > li:last-child';
  if (await page.evaluate(`!!document.querySelector('${last}')`)) {
    await click(page, last);
    await press(page, 'Escape');
  }
  await exec(page, 'insert.table', { rows, columns });
  await frames(page);
  return page.evaluate(TABLE_STATE);
}

// finding 3: a new table that did not fit under the text of its slide was moved up over the last
// lines of the text, with its column bar over the last line of the list, and the two texts mixed.
// a new table is put in the free space of its slide with its bars, and where it does not fit, at
// the center of the slide over the content, which it hides as a table with fills does
const TABLES = [
  // slide, columns, rows, and whether the slide has free space for the table with its bars
  [4, 3, 3, false, 'the slide with the figure, as in state 93'],
  [4, 4, 6, false, 'the slide with the figure, as in shot 10 of the opus report'],
  [8, 3, 3, false, 'the slide with the surface, as in shot 11 of the opus report'],
  [5, 3, 3, true, 'the slide with the code box'],
  [1, 3, 3, true, 'a section slide'],
];
for (const platform of PLATFORMS) {
  for (const [n, columns, rows, room, what] of TABLES) {
    test(`a new table of ${columns} by ${rows} cells on ${what} is put where it fits with its bars, or at the center over the content, readable (${platform})`, async (t) => {
      const page = await load(t, platform, { n });
      const s = await insertTableOn(page, columns, rows);
      assert.deepEqual(s.shape, Array(rows).fill(columns), 'the table is not inserted with every row chosen');
      const inside = s.all.left >= s.slide.left - 1 && s.all.right <= s.slide.right + 1 && s.all.top >= s.slide.top - 1;
      const hit = s.others.filter((o) => meets(s.all, o.box)).map((o) => o.what);
      if (room) {
        assert.deepEqual(hit, [], `the table with its bars at ${js(s.all)} is drawn over the content of the slide, where it has free space`);
        assert.ok(inside && s.table.bottom <= s.slide.bottom + 1, `the table with its bars at ${js(s.all)} runs past the slide at ${js(s.slide)}`);
      } else if (hit.length) {
        const cx = (s.table.left + s.table.right) / 2 - (s.slide.left + s.slide.right) / 2;
        const cy = (s.table.top + s.table.bottom) / 2 - (s.slide.top + s.slide.bottom) / 2;
        assert.ok(Math.abs(cx) < 3 && Math.abs(cy) < 3, `the table over ${js(hit)} is not at the center of the slide, but ${Math.round(cx)}, ${Math.round(cy)} px off it`);
        assert.ok(s.opaque, 'the table over the content of the slide does not have a fill, and its text mixes with the text under it');
        assert.ok(s.hidden, 'a cell of the table over the content of the slide is drawn under another element');
      }
      assert.ok(s.hidden, 'a cell of the table is drawn under another element');
      assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Insert Table');
      await roundTrip(page);
    });
  }
}

const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);

// the boxes of the navigator, the canvas, the inspector, the slide, and the Format button of the
// toolbar, each null while it is not shown
const shellBoxes = (page) => page.evaluate(`(() => {
  const box = (sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width } : null;
  };
  return { nav: box('body > .beeson-edit-nav'), canvas: box('.beeson-edit-canvas'), inspector: box('body > .beeson-edit-inspector'), slide: box('.reveal:not(.beeson-peek) .slides > section.present'), format: box('.beeson-edit-header [data-command="shell.format"]') };
})()`);

// the window resized to width by height px, as a drag of its edge does
async function resize(page, width, height = 800) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await sleep(250);
  await frames(page);
}

// asserts that the regions of b are docked side by side and that the slide is shown whole on the
// canvas, beside the inspector, at the window width named by what
function docked(b, what) {
  assert.ok(b.canvas && b.slide, `the canvas or the slide is not shown ${what}`);
  if (b.inspector) assert.ok(b.inspector.left >= b.canvas.right - 1, `the inspector at ${Math.round(b.inspector.left)} px is drawn over the canvas, which ends at ${Math.round(b.canvas.right)} px, ${what}`);
  if (b.nav) assert.ok(b.nav.right <= b.canvas.left + 1, `the navigator is drawn over the canvas ${what}`);
  const s = b.slide;
  const right = Math.min(b.canvas.right, b.inspector?.left ?? Infinity);
  assert.ok(s.left >= b.canvas.left - 1 && s.right <= right + 1 && s.top >= b.canvas.top - 1 && s.bottom <= b.canvas.bottom + 1, `the slide at ${js(s)} is not shown whole on the canvas at ${js(b.canvas)} ${what}`);
}

const pressFormat = async (page) => {
  const b = await shellBoxes(page);
  await click(page, { x: (b.format.left + b.format.right) / 2, y: (b.format.top + b.format.bottom) / 2 });
  await sleep(200);
  await frames(page);
};

// finding 4: in a window 760 px wide, the inspector was drawn as a sheet over the right part of
// the canvas and hid the right half of the slide. the inspector is docked beside the canvas at every
// width, and the slide is scaled to the rest of the window. in a window too narrow for the
// navigator, the canvas, and the inspector, the navigator is narrowed to its smallest width first,
// and then hidden while the inspector is open, as View > Slide Only hides it
for (const platform of PLATFORMS) {
  test(`the inspector is docked beside the whole slide at 1440, 1024, 900, and 760 px, and the navigator is hidden only while both do not fit (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2, width: 1440, height: 800 });
    if (!(await state(page, 'shell.format')).checked) await page.evaluate(`window.BeesonEditor.exec('shell.format')`);
    for (const width of [1440, 1024, 900, 760]) {
      await resize(page, width);
      const open = await shellBoxes(page);
      assert.ok(open.inspector, `the inspector is not shown at ${width} px`);
      docked(open, `at ${width} px with the inspector open`);
      if (width >= 1024) assert.ok(open.nav && Math.abs(open.nav.width - 200) <= 1, `the navigator is narrowed at ${width} px`);
      else if (open.nav) assert.ok(open.nav.width < 200, `the navigator keeps its width of 200 px at ${width} px`);
      if (width === 760) assert.equal(open.nav, null, 'the navigator is shown with the inspector at 760 px, where the slide does not fit between them');
      await pressFormat(page);
      const closed = await shellBoxes(page);
      assert.equal(closed.inspector, null, `the Format button does not close the inspector at ${width} px`);
      docked(closed, `at ${width} px with the inspector closed`);
      assert.ok(closed.nav, `the navigator is not shown again when the inspector is closed at ${width} px`);
      assert.ok(closed.canvas.width > open.canvas.width + 100, `the canvas does not take the place of the inspector at ${width} px`);
      await pressFormat(page);
      assert.ok((await shellBoxes(page)).inspector, `the Format button does not open the inspector at ${width} px`);
    }
    // the navigator is shown again once the window is wide again
    await resize(page, 1440);
    const wide = await shellBoxes(page);
    docked(wide, 'at 1440 px after 760 px');
    assert.ok(wide.nav && Math.abs(wide.nav.width - 200) <= 1, 'the navigator is not shown again at its width when the window is wide again');
    assert.equal((await state(page, 'view.navigator'))?.checked ?? true, true);
    assert.deepEqual(errors(page), []);
  });
}

const PANE_NOTE = `document.querySelector('#beeson-edit-panel-format .ed-note')?.textContent`;
const cellOf = (r, c) => `.reveal section.present table tr:nth-child(${r + 1}) > :nth-child(${c + 1})`;
const middle = (r) => ({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 });

// the boxes of the frame of the selected cells, of its fill handle, and of each of its corner
// handles that is shown, keyed by the corner it is drawn at
const RANGE = `(() => {
  const box = (el) => {
    if (!el || !el.getClientRects().length) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  };
  const bars = document.querySelector('.beeson-table-bars');
  const corners = {};
  for (const el of bars?.querySelectorAll('[data-corner]') ?? []) if (box(el)) corners[el.dataset.corner] = box(el);
  return { frame: box(bars?.querySelector('.cell')), fill: box(bars?.querySelector('.fill')), corners };
})()`;

// asserts that the corner handles of the range are at the upper left, upper right, and lower left
// corners of its frame, and the fill handle at its lower right corner, without an overlap
async function handlesAtCorners(page, what) {
  const { frame, fill, corners } = await page.evaluate(RANGE);
  assert.ok(frame, `the range is not framed ${what}`);
  assert.deepEqual(Object.keys(corners).sort(), ['lower-left', 'upper-left', 'upper-right'], `the frame of the range does not have its corner handles ${what}`);
  const at = { 'upper-left': [frame.left, frame.top], 'upper-right': [frame.right, frame.top], 'lower-left': [frame.left, frame.bottom] };
  for (const [name, [x, y]] of Object.entries(at)) {
    const m = middle(corners[name]);
    assert.ok(Math.abs(m.x - x) < 6 && Math.abs(m.y - y) < 6, `the ${name} handle at ${js(m)} is not at the ${name} corner ${js({ x, y })} of the frame ${what}`);
    assert.ok(!meets(corners[name], fill), `the ${name} handle is drawn over the fill handle ${what}`);
  }
  const f = middle(fill);
  assert.ok(Math.abs(f.x - frame.right) < 6 && Math.abs(f.y - frame.bottom) < 6, `the fill handle is not at the lower right corner of the frame ${what}`);
  return corners;
}

// the corner handle name dragged to the middle of the cell r, c
async function dragCorner(page, name, r, c) {
  const { corners } = await page.evaluate(RANGE);
  const from = middle(corners[name]);
  const to = middle(await page.evaluate(`document.querySelector(${js(cellOf(r, c))}).getBoundingClientRect().toJSON()`));
  await drag(page, from, { dx: to.x - from.x, dy: to.y - from.y, steps: 12 });
  await frames(page);
}

// finding 5: the frame of a range of cells did not have handles at its corners to extend or
// contract the range by a drag, as Keynote draws them beside its yellow fill handle. a drag of a
// corner handle moves that corner of the range to the cell under the pointer, and the opposite
// corner stays, without an edit of the file
for (const platform of PLATFORMS) {
  test(`a range of cells is extended and contracted by a drag of the handles at the corners of its frame (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'slide.new.content');
    await frames(page);
    await exec(page, 'insert.table', { rows: 5, columns: 3 });
    await frames(page);
    for (const [r, c, text] of [[1, 0, '1'], [2, 0, '2'], [1, 1, 'orbit'], [2, 1, 'tube']]) {
      await click(page, cellOf(r, c));
      await type(page, text);
    }
    await frames(page);
    const source = await render(page);
    const undo = (await state(page, 'edit.undo')).label;
    const from = middle(await page.evaluate(`document.querySelector(${js(cellOf(1, 0))}).getBoundingClientRect().toJSON()`));
    const to = middle(await page.evaluate(`document.querySelector(${js(cellOf(2, 1))}).getBoundingClientRect().toJSON()`));
    await drag(page, from, { dx: to.x - from.x, dy: to.y - from.y });
    await frames(page);
    assert.match(await page.evaluate(PANE_NOTE), /cells A2:B3$/);
    await handlesAtCorners(page, 'after a drag over A2:B3');
    for (const [name, r, c, range] of [
      ['lower-left', 3, 0, 'A2:B4'],
      ['upper-right', 1, 2, 'A2:C4'],
      ['upper-left', 2, 1, 'B3:C4'],
      ['upper-left', 0, 0, 'A1:C4'],
      ['lower-left', 1, 0, 'A1:C2'],
    ]) {
      const what = `after a drag of the ${name} handle to ${'ABC'[c]}${r + 1}`;
      await dragCorner(page, name, r, c);
      assert.match(await page.evaluate(PANE_NOTE), new RegExp(`cells ${range}$`), `the range is not ${range} ${what}`);
      await handlesAtCorners(page, what);
      assert.equal(await render(page), source, `the file is edited ${what}`);
      assert.equal((await state(page, 'edit.undo')).label, undo, `a history entry is added ${what}`);
    }
    // the fill handle still fills from the range that the corner handles set
    const { fill } = await page.evaluate(RANGE);
    const handle = middle(fill);
    const end = middle(await page.evaluate(`document.querySelector(${js(cellOf(4, 2))}).getBoundingClientRect().toJSON()`));
    await drag(page, handle, { dy: end.y - handle.y, steps: 12 });
    await page.waitFor(`window.BeesonEditor.state('edit.undo').label === 'Undo Autofill'`);
    await frames(page);
    assert.match(await page.evaluate(PANE_NOTE), /cells A1:C5$/);
    await handlesAtCorners(page, 'after an autofill');
    assert.deepEqual(errors(page), []);
  });
}
