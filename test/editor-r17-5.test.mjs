// regression tests of R17.5 on both platforms. a group selected with other objects keeps the grips
// of its frame, which resize it as they do with the group alone (N24). a Shift-click on a figure
// while the caret is in a text selects the block of the caret with the figure (N26). every grip of
// a turned figure at the edge of the slide can be pressed at the Fit zoom (requirement 1a, N1)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const DECK = 'index.html';
// the index of the figures slide in index.html
const FIGURES = 4;
const IMG = 'section.present figure img.for-light';
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
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const mouse = (page, type, x, y, extra = {}) => page.send('Input.dispatchMouseEvent', { type, x, y, ...extra });
const names = (page) => page.evaluate('window.BeesonEditor.selection().map((el) => el.localName)');

const PANEL = '#beeson-edit-panel-format';
async function typeField(page, id, value) {
  await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].find((b) => b.textContent === 'Arrange')?.click()`);
  await frames(page);
  await page.evaluate(`(() => { const i = document.querySelector('#beeson-edit-num-${id}'); i.focus(); i.select(); })()`);
  await type(page, String(value));
  await press(page, 'Enter');
  await frames(page);
}

async function load(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&theme=light&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${FIGURES})`);
  await frames(page);
  return page;
}

// a point inside the first line of a block of the current slide, in CSS px
const blockAt = (page, selector) => page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(${js(selector)}).getBoundingClientRect(); return { x: r.left + 20, y: r.top + 20 }; })()`);

// the shown grips, each with its handle, whether it is a grip of a group, and its center in CSS px
const grips = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-grip')].filter((g) => !g.hidden && g.getClientRects().length).map((g) => { const r = g.getBoundingClientRect(); return { handle: g.dataset.handle, group: !!g.dataset.group, x: r.left + r.width / 2, y: r.top + r.height / 2 }; })`);

async function groupOnFigures(page, platform) {
  await click(page, IMG);
  await click(page, await blockAt(page, ':scope > p'), { modifiers: 'Shift' });
  await press(page, platform === 'mac' ? 'Alt+Mod+G' : 'Mod+G');
  await frames(page);
}

// a drag of the grip g by dx, dy in CSS px in eight steps, released
async function dragGrip(page, g, dx, dy) {
  await mouse(page, 'mouseMoved', g.x, g.y);
  await mouse(page, 'mousePressed', g.x, g.y, { button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 8; i++) await mouse(page, 'mouseMoved', g.x + (dx * i) / 8, g.y + (dy * i) / 8, { button: 'left', buttons: 1 });
  await frames(page);
  await mouse(page, 'mouseReleased', g.x + dx, g.y + dy, { button: 'left', clickCount: 1 });
  await frames(page);
}

for (const platform of PLATFORMS) {
  // N24: the group of the figure and the paragraph, Shift-clicked with the heading, was drawn as a
  // frame without grips, while the heading kept its own
  test(`a group selected with another object keeps the eight grips of its frame (${platform})`, async (t) => {
    const page = await load(t, platform);
    await groupOnFigures(page, platform);
    const alone = (await grips(page)).filter((g) => g.group);
    assert.equal(alone.length, 8, `the grips of the group alone are ${js(alone)}`);
    await click(page, await blockAt(page, ':scope > h2'), { modifiers: 'Shift' });
    await frames(page);
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 3);
    const all = await grips(page);
    const group = all.filter((g) => g.group);
    assert.equal(group.length, 8, `the grips of the group with the heading are ${js(all)}`);
    for (const g of group) {
      const was = alone.find((a) => a.handle === g.handle);
      assert.ok(Math.hypot(g.x - was.x, g.y - was.y) < 1.5, `the grip ${g.handle} is at ${js(g)}, and at ${js(was)} with the group alone`);
    }
    assert.ok(all.some((g) => !g.group), `the heading lost its grips: ${js(all)}`);
    assert.deepEqual(errors(page), []);
  });

  test(`a grip of a group selected with another object resizes the group as with the group alone (${platform})`, async (t) => {
    const page = await load(t, platform);
    await groupOnFigures(page, platform);
    const grouped = await render(page);
    const se = (await grips(page)).find((g) => g.group && g.handle === 'se');
    await dragGrip(page, se, -80, -60);
    const alone = await render(page);
    assert.notEqual(alone, grouped, 'the grip of the group alone did not resize it');
    await undo(page);
    assert.equal(await render(page), grouped);
    await click(page, await blockAt(page, ':scope > h2'), { modifiers: 'Shift' });
    await frames(page);
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 3);
    const h2 = await page.evaluate(`Reveal.getCurrentSlide().querySelector(':scope > h2').outerHTML`);
    const g = (await grips(page)).find((x) => x.group && x.handle === 'se');
    assert.ok(g, 'the group selected with the heading does not have a grip se');
    await dragGrip(page, g, -80, -60);
    const edited = await render(page);
    assert.equal(edited, alone, 'the group selected with the heading was resized otherwise than alone');
    assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelector(':scope > h2').outerHTML`), h2, 'the heading was changed');
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 3, 'the selection was changed by the resize');
    await undo(page);
    assert.equal(await render(page), grouped);
    await redo(page);
    assert.equal(await render(page), edited);
    const { text } = await saveAndReopen(page, `r17-5-group-grip-${platform}.html`);
    assert.equal(text, edited);
    assert.deepEqual(errors(page), []);
  });

  // N26: with the caret in the heading, a Shift-click on the figure selected the figure alone
  for (const modifiers of ['Shift', 'Mod']) {
    test(`a ${modifiers}-click on a figure with the caret in a text selects the block of the caret with the figure (${platform})`, async (t) => {
      const page = await load(t, platform);
      await click(page, await blockAt(page, ':scope > h2'));
      await frames(page);
      assert.equal(await page.evaluate(`document.activeElement === Reveal.getCurrentSlide().querySelector(':scope > h2')`), true, 'the caret is not in the heading');
      await click(page, IMG, { modifiers });
      await frames(page);
      assert.deepEqual((await names(page)).sort(), ['figure', 'h2'], 'the heading is not selected with the figure');
      assert.equal(await page.evaluate(`!!window.getSelection().rangeCount && Reveal.getCurrentSlide().querySelector(':scope > h2').contains(window.getSelection().anchorNode)`), false, 'the caret is left in the heading');
      assert.equal(await render(page), page.source);
      assert.deepEqual(errors(page), []);
    });
  }

  test(`a Shift-click on the text of the caret selects its block alone (${platform})`, async (t) => {
    const page = await load(t, platform);
    const at = await blockAt(page, ':scope > h2');
    await click(page, at);
    await click(page, at, { modifiers: 'Shift' });
    await frames(page);
    assert.deepEqual(await names(page), ['h2']);
    assert.deepEqual(errors(page), []);
  });

  // requirement 1a and N1: at 30 degrees the grip ne of the figure was drawn under the inspector,
  // past the edge of the canvas, which did not scroll at Fit
  test(`every grip of a figure turned by 30 degrees can be pressed at the Fit zoom (${platform})`, async (t) => {
    const page = await load(t, platform);
    const slideBox = () => page.evaluate(`(() => { const r = document.querySelector('.reveal .slides').getBoundingClientRect(); return [r.left, r.top, r.width]; })()`);
    const rest = await slideBox();
    await click(page, IMG);
    await typeField(page, 'angle', 30);
    assert.deepEqual(await slideBox(), rest, 'the slide moved when the canvas was given room for the grips');
    assert.equal(await page.evaluate('window.BeesonEditorShell.stage.zoom'), null, 'the zoom is not Fit');
    const first = await grips(page);
    assert.equal(first.length, 8);
    const covered = await page.evaluate(`(() => { const v = window.BeesonEditorShell.stage.viewport; return ${js(first)}.filter((g) => g.x > v.right || g.x < v.left || g.y > v.bottom || g.y < v.top).map((g) => g.handle); })()`);
    assert.ok(covered.length > 0, 'every grip lies inside the canvas, hence the case of N1 is not set up');
    // each grip is brought into the canvas by a scroll of the canvas, as a trackpad scrolls it,
    // and must then be the element under its center
    for (const handle of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
      await page.evaluate(`(() => {
        const el = window.BeesonEditorShell.stage.el;
        const g = document.querySelector('.beeson-grip[data-handle=${handle}]:not([hidden])');
        const v = window.BeesonEditorShell.stage.viewport;
        const r = g.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        el.scrollLeft += x > v.right - 12 ? x - v.right + 24 : x < v.left + 12 ? x - v.left - 24 : 0;
        el.scrollTop += y > v.bottom - 12 ? y - v.bottom + 24 : y < v.top + 12 ? y - v.top - 24 : 0;
      })()`);
      await frames(page);
      const hit = await page.evaluate(`(() => {
        const g = document.querySelector('.beeson-grip[data-handle=${handle}]:not([hidden])');
        const r = g.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        return { x, y, top: document.elementFromPoint(x, y) === g, under: document.elementFromPoint(x, y)?.className };
      })()`);
      assert.ok(hit.top, `the grip ${handle} at ${js(hit)} cannot be pressed`);
    }
    // a drag of the grip ne, which was under the inspector, resizes the figure
    const ne = (await grips(page)).find((g) => g.handle === 'ne');
    const last = await render(page);
    await dragGrip(page, ne, -30, 20);
    assert.notEqual(await render(page), last, 'the grip ne did not resize the figure');
    await undo(page);
    assert.equal(await render(page), last);
    // with the selection cleared, the room is taken off and the slide is drawn at Fit again
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await page.evaluate('window.BeesonEditor.selection()'), []);
    assert.deepEqual(await slideBox(), rest, 'the slide is not drawn at Fit after the selection is cleared');
    assert.equal(await page.evaluate('(() => { const el = window.BeesonEditorShell.stage.el; return el.scrollWidth - el.clientWidth; })()'), 0);
    assert.deepEqual(errors(page), []);
  });
}
