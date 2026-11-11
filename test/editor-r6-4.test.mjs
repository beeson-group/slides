// the canvas follow-ups of package R6.4 on both platforms, driven with trusted input. an undo and a
// redo of a resize, a move, or a rotation select what was selected for it, i.e. an image, a whole
// figure, or a group, and not the hidden image of a dark and light pair (finding 4 of opus in round
// 2 of the council). the readout of a move gives the upper left corner of the element in slide px.
// a page of the editor does not write back the guides that it read at its start. a first click on a
// text block of a group selects the group, a second click the block, and a third puts the caret
// in its text, as in Keynote and PowerPoint. in a multiple selection that is not a group, each
// member is drawn with its own frame and grips, without a frame around all of them, and a drag of
// the grip of one member resizes every member

import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, press, saveAndReopen, selectFigure, selectPicture } from './helpers/editor.mjs';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const PLATFORMS = ['mac', 'other'];
const LAYOUTS = 'test/pages/editor-layouts.html';
const MULTI = 'test/pages/editor-multi.html';
const SECTIONS = [...readFileSync(LAYOUTS, 'utf8').matchAll(/<section[\s\S]*?<\/section>/g)].map((m) => m[0]);
const MATH = SECTIONS.findIndex((s) => s.includes('<h2>Math, an ordered list, and a zone</h2>'));
const ZONE_IMG = '.reveal section.present .zone > img';
const FIG = '.reveal section.present figure.zone';
// the folder of the screenshots, which are taken only where it is given
const SHOTS = process.env.R64_SHOTS ?? null;

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

// the editor on slide n of a deck served over HTTP in a color mode, with the storage of the browser
// cleared first unless keep is set. the page opened before is closed unless close is false
async function editor(platform, { deck = LAYOUTS, n = MATH, keep = false, close = true, mode = 'dark' } = {}) {
  if (close) await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.send('Page.bringToFront');
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  if (!keep) {
    await page.evaluate('localStorage.clear()');
    await page.goto(url);
  }
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  await page.evaluate(`document.documentElement.dataset.theme = '${mode}'`);
  page.source = readFileSync(deck, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const near = (a, b, by = 2) => Math.abs(a - b) <= by;

// the selected elements, each named by its tag and classes, e.g. 'img.for-dark' or 'figure.zone'
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => [el.localName, ...el.classList].filter((c) => !c.startsWith('beeson-') && c !== 'visible' && c !== 'current-fragment').join('.'))`);
// the shown selection and union frames, in screen px, and the number of shown grips
const drawn = (page) => page.evaluate(`(() => {
  const box = (el) => { const r = el.getBoundingClientRect(); return { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height), union: el.classList.contains('union') }; };
  const shown = (el) => !el.hidden && getComputedStyle(el).display !== 'none';
  return {
    frames: [...document.querySelectorAll('.beeson-overlay .beeson-frame.selected, .beeson-overlay .beeson-frame.union')].filter(shown).map(box),
    grips: [...document.querySelectorAll('.beeson-overlay .beeson-grip')].filter(shown).length,
  };
})()`);
// the box of the first shown element of a selector on the screen
const boxOf = (page, selector) => page.evaluate(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getBoundingClientRect().width);
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
})()`);
const gripAt = (page, handle, group = false) => page.evaluate(`(() => {
  const g = [...document.querySelectorAll('.beeson-grip${group ? '[data-group]' : ''}[data-handle="${handle}"]')].find((g) => !g.hidden);
  const r = g.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);
const readout = (page) => page.evaluate(`(() => { const o = document.querySelector('.beeson-offset:not(.beeson-guide-readout)'); return o && !o.hidden ? o.textContent : null; })()`);
const release = (page, at) => page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', clickCount: 1 });

// asserts one frame, drawn where the frame of the selection before the action was, and none at the
// corner of the window
async function framedOnce(page, ref, what) {
  const d = await drawn(page);
  assert.ok(!d.frames.some((f) => f.left <= 1 && f.top <= 1), `${what}: a frame is drawn at the corner of the window: ${JSON.stringify(d.frames)}`);
  assert.equal(d.frames.length, 1, `${what}: ${d.frames.length} frames are drawn: ${JSON.stringify(d.frames)}`);
  const [f, b] = [d.frames[0], ref.frames[0]];
  assert.ok(near(f.left, b.left) && near(f.top, b.top) && near(f.width, b.width) && near(f.height, b.height), `${what}: the frame ${JSON.stringify(f)} is not at ${JSON.stringify(b)}`);
  return d;
}

async function shot(page, name) {
  if (!SHOTS) return;
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(data, 'base64'));
}

for (const platform of PLATFORMS) {
  test(`${platform}: an undo and a redo of a resize of an image select the image alone`, async () => {
    for (const mode of ['dark', 'light']) {
      const page = await editor(platform, { mode });
      await selectPicture(page, ZONE_IMG);
      await frames(page);
      assert.deepEqual(await selected(page), [`img.for-${mode}`], 'a second click on the image of a figure does not select the image');
      const ref = await drawn(page);
      await drag(page, await gripAt(page, 'se'), { dx: -60, dy: -40 });
      await frames(page);
      const resized = await render(page);
      assert.notEqual(resized, page.source, 'the resize is not written');
      await undo(page);
      await frames(page);
      assert.deepEqual(await selected(page), [`img.for-${mode}`], 'the undo does not select the image alone');
      await framedOnce(page, ref, 'after the undo');
      await shot(page, `undo-resize-image-${mode}-${platform}`);
      await byteExact(page);
      await redo(page);
      await frames(page);
      assert.deepEqual(await selected(page), [`img.for-${mode}`], 'the redo does not select the image alone');
      const d = await drawn(page);
      assert.equal(d.frames.length, 1, `after the redo, ${d.frames.length} frames are drawn: ${JSON.stringify(d.frames)}`);
      assert.ok(!d.frames.some((f) => f.left <= 1 && f.top <= 1), `after the redo, a frame is drawn at the corner of the window`);
      assert.equal(await render(page), resized, 'the redo does not write the resize again');
      await saveAndReopen(page);
      assert.deepEqual(errors(page), []);
    }
  });

  test(`${platform}: an undo and a redo of a resize, a move, and a rotation of a figure select the figure`, async () => {
    const page = await editor(platform);
    await selectFigure(page, ZONE_IMG);
    await frames(page);
    assert.deepEqual(await selected(page), ['figure.zone.fragment'], 'Esc does not select the figure');
    const ref = await drawn(page);
    // a resize by the lower right grip
    await drag(page, await gripAt(page, 'se'), { dx: -60, dy: -40 });
    await frames(page);
    const resized = await render(page);
    for (const [step, what] of [[undo, 'undo'], [redo, 'redo']]) {
      await step(page);
      await frames(page);
      assert.deepEqual(await selected(page), ['figure.zone.fragment'], `the ${what} of the resize does not select the figure`);
      const d = await drawn(page);
      assert.equal(d.frames.length, 1, `after the ${what} of the resize, ${d.frames.length} frames are drawn: ${JSON.stringify(d.frames)}`);
      assert.ok(!d.frames.some((f) => f.left <= 1 && f.top <= 1), `after the ${what} of the resize, a frame is drawn at the corner of the window`);
      assert.equal(d.grips, ref.grips, `the figure is not drawn with its ${ref.grips} grips after the ${what}`);
      if (what === 'undo') await framedOnce(page, ref, 'after the undo of the resize');
      if (what === 'undo') {
        await shot(page, `undo-resize-figure-dark-${platform}`);
        await byteExact(page);
      } else assert.equal(await render(page), resized);
    }
    await undo(page);
    // a move
    const img = await boxOf(page, ZONE_IMG);
    await drag(page, { x: img.left + img.width / 2, y: img.top + img.height / 2 }, { dx: -80, dy: 30 });
    await frames(page);
    assert.match(await render(page), /<figure class="zone fragment" data-fragment-index="2" style="translate: -?\d+px -?\d+px">/);
    for (const [step, what] of [[undo, 'undo'], [redo, 'redo']]) {
      await step(page);
      await frames(page);
      assert.deepEqual(await selected(page), ['figure.zone.fragment'], `the ${what} of the move does not select the figure`);
      const d = await drawn(page);
      assert.equal(d.frames.length, 1, `after the ${what} of the move, ${d.frames.length} frames are drawn`);
      if (what === 'undo') await framedOnce(page, ref, 'after the undo of the move');
    }
    await undo(page);
    await byteExact(page);
    // a rotation by the rotor
    const rotor = await boxOf(page, '.beeson-rotor');
    const fig = await boxOf(page, FIG);
    await drag(page, { x: rotor.left + rotor.width / 2, y: rotor.top + rotor.height / 2 }, { dx: fig.width / 2, dy: fig.height / 3 });
    await frames(page);
    assert.match(await render(page), /rotate: \d+deg/, 'the rotation is not written');
    for (const [step, what] of [[undo, 'undo'], [redo, 'redo']]) {
      await step(page);
      await frames(page);
      assert.deepEqual(await selected(page), ['figure.zone.fragment'], `the ${what} of the rotation does not select the figure`);
      const d = await drawn(page);
      assert.equal(d.frames.length, 1, `after the ${what} of the rotation, ${d.frames.length} frames are drawn`);
    }
    await undo(page);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`${platform}: an undo and a redo of a resize of a group select the group`, async () => {
    const page = await editor(platform, { deck: MULTI, n: 0 });
    await selectFigure(page, ZONE_IMG);
    await click(page, '.reveal section.present .qr', { modifiers: 'Shift' });
    await frames(page);
    await exec(page, 'arrange.group');
    await frames(page);
    const group = ['div.qr', 'figure.zone'];
    assert.deepEqual((await selected(page)).sort(), group, 'the group is not selected');
    const grouped = await render(page);
    const before = await drawn(page);
    await drag(page, await gripAt(page, 'se', true), { dx: -60, dy: -40 });
    await frames(page);
    const resized = await render(page);
    assert.notEqual(resized, grouped, 'the resize of the group is not written');
    for (const [step, what] of [[undo, 'undo'], [redo, 'redo']]) {
      await step(page);
      await frames(page);
      assert.deepEqual((await selected(page)).sort(), group, `the ${what} does not select the group`);
      const d = await drawn(page);
      assert.ok(!d.frames.some((f) => f.left <= 1 && f.top <= 1), `after the ${what}, a frame is drawn at the corner of the window: ${JSON.stringify(d.frames)}`);
      assert.equal(d.frames.length, before.frames.length, `after the ${what}, ${d.frames.length} frames are drawn and not ${before.frames.length}: ${JSON.stringify(d.frames)}`);
      assert.equal(d.grips, before.grips, `after the ${what}, ${d.grips} grips are drawn and not ${before.grips}`);
      if (what === 'undo') assert.equal(await render(page), grouped);
    }
    assert.equal(await render(page), resized, 'the redo does not write the resize again');
    assert.deepEqual(errors(page), []);
  });

  test(`${platform}: the readout of a move gives the upper left corner of the element in slide px, and the readout of a resize its size`, async () => {
    for (const mode of ['dark', 'light']) {
      const page = await editor(platform, { mode });
      await selectFigure(page, ZONE_IMG);
      const img = await boxOf(page, ZONE_IMG);
      const from = { x: img.left + img.width / 2, y: img.top + img.height / 2 };
      await drag(page, from, { dx: -70, dy: 45, hold: true });
      await frames(page);
      const text = await readout(page);
      const corner = await page.evaluate(`(() => {
        const s = document.querySelector('.reveal .slides');
        const r = s.getBoundingClientRect();
        const scale = r.width / s.offsetWidth;
        // the frame of the figure, i.e. its picture with its caption, drawn 8 px outside it
        const f = document.querySelector('.beeson-overlay > .beeson-frame.selected:not([hidden])').getBoundingClientRect();
        return { x: Math.round((f.left + 8 - r.left) / scale), y: Math.round((f.top + 8 - r.top) / scale) };
      })()`);
      const m = /^x: (-?\d+) px\s+y: (-?\d+) px$/.exec(text ?? '');
      assert.ok(m, `the readout ${text} does not give x and y`);
      assert.ok(near(Number(m[1]), corner.x, 1) && near(Number(m[2]), corner.y, 1), `the readout ${text} is not the upper left corner ${corner.x}, ${corner.y} of the figure`);
      await shot(page, `move-readout-${mode}-${platform}`);
      await release(page, { x: from.x - 70, y: from.y + 45 });
      await frames(page);
      await undo(page);
      await byteExact(page);
      // the size of a resize
      const se = await gripAt(page, 'se');
      await drag(page, se, { dx: -60, dy: -40, hold: true });
      await frames(page);
      assert.match((await readout(page)) ?? '', /^w: \d+ px {2}h: \d+ px$/, 'the readout of a resize does not give the size');
      await shot(page, `resize-readout-${mode}-${platform}`);
      await release(page, { x: se.x - 60, y: se.y - 40 });
      await frames(page);
      await undo(page);
      await byteExact(page);
      assert.deepEqual(errors(page), []);
    }
  });

  test(`${platform}: a page that has not changed its guides does not write the guides it read at its start over those of a newer session`, async () => {
    const key = `beeson-edit-guides:/${LAYOUTS}`;
    const stored = (page) => page.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}) ?? '[]')`);
    // an older session stores a guide at x 640
    const older = await editor(platform);
    await exec(older, 'view.guides.add', { x: [640] });
    await frames(older);
    // a page opened after it reads the guide at its start
    const first = await editor(platform, { keep: true });
    // a newer session in another tab adds a guide at y 300
    const newer = await editor(platform, { keep: true, close: false });
    await exec(newer, 'view.guides.add', { y: [300] });
    await frames(newer);
    assert.deepEqual((await stored(newer))[MATH], { x: [640], y: [300] });
    // the first page opens the file again and inserts a text box, which change the page but not
    // its guides
    await first.send('Page.bringToFront');
    await first.evaluate(`window.BeesonEditor.open(${JSON.stringify(first.source)})`);
    await frames(first);
    await exec(first, 'insert.text');
    await frames(first);
    await sleep(100);
    assert.deepEqual((await stored(first))[MATH], { x: [640], y: [300] }, 'the first page writes over the guides of the newer session');
    // the first page is left, which does not write either
    await first.goto('about:blank');
    await sleep(100);
    assert.deepEqual((await stored(newer))[MATH], { x: [640], y: [300] }, 'a page that is left writes over the guides of the newer session');
    await first.close();
    assert.deepEqual(errors(newer), []);
  });
}

const LEAD = `[...document.querySelectorAll('.reveal section.present p')].find((p) => p.textContent === 'The lead-in of a display')`;
// a point inside the text of the lead paragraph of the math slide
const leadAt = (page) => page.evaluate(`(() => { const r = document.createRange(); r.selectNodeContents(${LEAD}.firstChild); const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
// whether the caret is in the lead paragraph
const caretInLead = (page) => page.evaluate(`(() => { const s = getSelection(); return document.activeElement === ${LEAD} && !!s.rangeCount && ${LEAD}.contains(s.anchorNode); })()`);

for (const platform of PLATFORMS) {
  test(`${platform}: a first click on a grouped text block selects its group, a second the block, and a third puts the caret in it`, async () => {
    const page = await editor(platform);
    // a click on a text block that is not grouped puts the caret in it
    await click(page, await leadAt(page));
    await frames(page);
    assert.ok(await caretInLead(page), 'a click on a text block that is not grouped does not put the caret in it');
    await press(page, 'Escape');
    // the paragraph and the figure as a group
    await selectFigure(page, ZONE_IMG);
    await click(page, await leadAt(page), { modifiers: 'Shift' });
    await exec(page, 'arrange.group');
    await frames(page);
    const group = ['figure.zone.fragment', 'p'];
    assert.deepEqual((await selected(page)).sort(), group, 'the paragraph and the figure are not grouped');
    await exec(page, 'selection.clear');
    await frames(page);
    await click(page, await leadAt(page));
    await frames(page);
    assert.ok(!(await caretInLead(page)), 'a first click on a grouped text block puts the caret in it');
    assert.deepEqual((await selected(page)).sort(), group, 'a first click on a grouped text block does not select its group');
    await click(page, await leadAt(page));
    await frames(page);
    assert.ok(!(await caretInLead(page)), 'a second click on a grouped text block puts the caret in it');
    assert.deepEqual(await selected(page), ['p'], 'a second click on a grouped text block does not select the block alone');
    await click(page, await leadAt(page));
    await frames(page);
    assert.ok(await caretInLead(page), 'a third click on a grouped text block does not put the caret in it');
    // a drag that starts on a grouped text block moves the group
    await press(page, 'Escape');
    await exec(page, 'selection.clear');
    await frames(page);
    const grouped = await render(page);
    await drag(page, await leadAt(page), { dx: 40, dy: 30 });
    await frames(page);
    const moved = await render(page);
    assert.match(moved, /<p style="translate: -?\d+px -?\d+px" data-group="g1">The lead-in of a display<\/p>/, 'the paragraph is not moved');
    assert.match(moved, /<figure class="zone fragment" data-fragment-index="2" style="translate: -?\d+px -?\d+px" data-group="g1">/, 'the figure is not moved with the paragraph');
    await undo(page);
    assert.equal(await render(page), grouped);
    await redo(page);
    assert.equal(await render(page), moved);
    await saveAndReopen(page);
    assert.deepEqual(errors(page), []);
  });
}

for (const platform of PLATFORMS) {
  test(`${platform}: each member of a multiple selection has its own grips, without a frame around all, and the grip of one resizes all`, async () => {
    for (const mode of ['dark', 'light']) {
      const page = await editor(platform, { mode });
      await selectFigure(page, ZONE_IMG);
      await click(page, await leadAt(page), { modifiers: 'Shift' });
      await frames(page);
      assert.deepEqual((await selected(page)).sort(), ['figure.zone.fragment', 'p'], 'the figure and the paragraph are not selected');
      const view = await page.evaluate(`(() => {
        const shown = (el) => !el.hidden && getComputedStyle(el).display !== 'none';
        const grips = [...document.querySelectorAll('.beeson-overlay .beeson-grip')].filter(shown);
        return {
          union: [...document.querySelectorAll('.beeson-overlay .beeson-frame.union')].filter(shown).length,
          frames: [...document.querySelectorAll('.beeson-overlay .beeson-frame.selected')].filter(shown).length,
          members: [...new Set(grips.map((g) => g.dataset.member))].map((m) => grips.filter((g) => g.dataset.member === m).map((g) => g.dataset.handle).sort()),
        };
      })()`);
      assert.equal(view.union, 0, 'a frame is drawn around the members of a multiple selection');
      assert.equal(view.frames, 2, `${view.frames} frames are drawn for two members`);
      assert.equal(view.members.length, 2, `the grips of ${view.members.length} members are drawn, not of both`);
      assert.ok(view.members.some((h) => h.length === 8), `the figure does not have eight grips: ${JSON.stringify(view.members)}`);
      assert.ok(view.members.some((h) => h.includes('e') && h.includes('w') && !h.includes('n')), `the paragraph does not have the grips of a text block: ${JSON.stringify(view.members)}`);
      await shot(page, `multiple-selection-${mode}-${platform}`);
      // a drag of the lower right grip of the figure resizes the figure and the paragraph
      const widths = () => page.evaluate(`[${LEAD}, [...document.querySelectorAll(${JSON.stringify(ZONE_IMG)})].find((i) => i.getBoundingClientRect().width)].map((el) => el.getBoundingClientRect().width)`);
      const before = await widths();
      const se = await page.evaluate(`(() => { const g = [...document.querySelectorAll('.beeson-grip[data-handle="se"]')].filter((g) => !g.hidden).map((g) => g.getBoundingClientRect()).sort((a, b) => b.left - a.left)[0]; return { x: g.left + g.width / 2, y: g.top + g.height / 2 }; })()`);
      await drag(page, se, { dx: -80, dy: -60 });
      await frames(page);
      const after = await widths();
      assert.ok(after[0] < before[0] - 5 && after[1] < before[1] - 5, `the widths ${JSON.stringify(before)} became ${JSON.stringify(after)}, not both smaller`);
      const resized = await render(page);
      assert.match(resized, /<p style="width: \d+px">The lead-in of a display<\/p>/, 'the width of the paragraph is not written');
      await undo(page);
      await byteExact(page);
      await redo(page);
      assert.equal(await render(page), resized);
      await saveAndReopen(page);
      assert.deepEqual(errors(page), []);
    }
  });
}

test('a page shows the guides that another tab stores', async () => {
  const page = await editor('mac');
  const other = await editor('mac', { keep: true, close: false });
  await exec(other, 'view.guides.add', { y: [300] });
  await frames(other);
  await page.send('Page.bringToFront');
  await sleep(100);
  await frames(page);
  const shown = await page.evaluate(`[...document.querySelectorAll('.beeson-hand-guide')].filter((g) => !g.hidden).map((g) => [g.dataset.axis, Number(g.dataset.at)])`);
  assert.deepEqual(shown, [['y', 300]], 'the guide stored by another tab is not shown');
  await other.close();
});
