// a table and a zoom key during a preview, R32.4, on both platforms. while a preview plays, the bars
// of the rows and columns, the grips, the fill handle, and the corners of a table selection are not
// drawn, as the frame of a selection is not (R32.3), and Esc stops the preview with a range of cells
// selected and draws the same selection again. with the caret in a text, a zoom key plays the
// preview on at the new zoom (R26.1), and a key that is written into the text still stops it

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press } from './helpers/editor.mjs';

const DECK = 'test/pages/editor-r32-4.html';
const PLATFORMS = ['mac', 'other'];
const MAIN = '.beeson-edit-top [data-command="preview.slide"]';
const PREVIEWS = ['preview.backdrop', 'preview.slide', 'preview.steps', 'steps.preview', 'slide.previewTransition'];

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

const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');

// the editor on the deck, without reduced motion so that a backdrop is traced
async function previewPage(platform) {
  await last?.close().catch(() => {});
  const page = await browser.newPage({ width: 1600, height: 1000, motion: true });
  last = page;
  await page.goto(`${server.origin}/${DECK}?edit&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate('window.BeesonEditor.preview.step = 3000');
  await page.waitFor(`window.BeesonEditor.state('preview.backdrop').enabled`);
  await frames(page);
  return page;
}

// what the editor draws over the slide for a table selection, each part with the count of its shown
// elements, whether a caret is drawn, the focus, and the selection
const DRAWN = `(() => {
  const shown = (el) => {
    if (el.hidden) return false;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  };
  const parts = {
    frame: '.beeson-overlay .beeson-frame.selected',
    handle: '.beeson-overlay .beeson-handle',
    bar: '.beeson-table-bars .bar',
    grip: '.beeson-table-bars .beeson-grip',
    fill: '.beeson-table-bars .fill',
    corner: '.beeson-table-bars .corner',
  };
  const drawn = {};
  for (const [name, sel] of Object.entries(parts)) {
    const n = [...document.querySelectorAll(sel)].filter(shown).length;
    if (n) drawn[name] = n;
  }
  const a = document.activeElement;
  const s = getSelection();
  const editing = !!(a && a.isContentEditable && s.rangeCount && s.isCollapsed);
  if (editing && !['transparent', 'rgba(0, 0, 0, 0)'].includes(getComputedStyle(a).caretColor)) drawn.caret = 1;
  return {
    drawn,
    focus: a ? a.localName + (a.isContentEditable ? ':' + a.textContent.slice(0, 12) : '') : null,
    selection: window.BeesonEditor.selection().map((el) => el.localName),
  };
})()`;
const measure = (page) => page.evaluate(DRAWN);

// the selections of a table, each made with trusted input as a user makes it
const SELECTIONS = {
  cell: async (page) => { await click(page, 'section.present tr:nth-child(2) td'); },
  range: async (page) => {
    await click(page, 'section.present tr:nth-child(2) td');
    await click(page, 'section.present tr:last-child td:last-child', { modifiers: 'Shift' });
  },
  table: async (page) => {
    await click(page, 'section.present tr:nth-child(2) td');
    await press(page, 'Escape');
    await press(page, 'Escape');
  },
};

const playingOf = (id) => (id.startsWith('preview.')
  ? `document.querySelector('${MAIN}').getAttribute('aria-pressed') === 'true'`
  : id === 'steps.preview' ? `document.documentElement.classList.contains('beeson-previewing')` : `!!document.querySelector('.beeson-edit-preview')`);

async function start(page, id) {
  await page.evaluate(`(() => { void window.BeesonEditor.exec(${JSON.stringify(id)}); return true; })()`);
  await page.waitFor(playingOf(id), 3000);
  await frames(page);
}

async function select(page, kind) {
  await page.evaluate('Reveal.slide(0)');
  await frames(page);
  await press(page, 'Escape');
  await press(page, 'Escape');
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 995 });
  await SELECTIONS[kind](page);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 995 });
  await frames(page);
  return measure(page);
}

// a zoom key, which press() of the helpers does not name
async function zoomKey(page, platform, out) {
  const modifiers = platform === 'mac' ? 4 : 2;
  const key = out ? { key: '-', code: 'Minus', windowsVirtualKeyCode: 189 } : { key: '=', code: 'Equal', windowsVirtualKeyCode: 187 };
  for (const type of ['rawKeyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, ...key, modifiers });
  await frames(page);
}
const zoomOf = (page) => page.evaluate(`document.querySelector('input[aria-label=Zoom]').value`);

for (const platform of PLATFORMS) {
  for (const id of PREVIEWS) {
    test(`nothing of a table selection is drawn while ${id} plays, and Esc draws the same selection again (${platform})`, async () => {
      const page = await previewPage(platform);
      for (const kind of Object.keys(SELECTIONS)) {
        const before = await select(page, kind);
        assert.ok(before.drawn.bar, `the ${kind} selection draws no bar of the table before the preview`);
        await start(page, id);
        const during = await measure(page);
        assert.ok(await page.evaluate(playingOf(id)), `${id} ended before the reading of the ${kind} selection`);
        assert.deepEqual(during.drawn, {}, `drawn over the slide during ${id} with the ${kind} selection`);
        await press(page, 'Escape');
        await frames(page);
        assert.equal(await page.evaluate(playingOf(id)), false, `Esc does not stop ${id} with the ${kind} selection`);
        await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 995 });
        await frames(page);
        assert.deepEqual(await measure(page), before, `the ${kind} selection after Esc that stops ${id}`);
      }
    });
  }

  test(`a zoom key in a text plays Play Slide on at the new zoom, and a key that is written stops it (${platform})`, async () => {
    const page = await previewPage(platform);
    for (const out of [false, true]) {
      await page.evaluate('Reveal.slide(0)');
      await frames(page);
      await click(page, 'section.present h2');
      await press(page, 'End');
      await click(page, MAIN);
      await page.waitFor(playingOf('preview.slide'), 3000);
      await frames(page);
      assert.equal(await page.evaluate('document.activeElement.localName'), 'h2', 'the caret is not kept in the heading');
      const zoom = Number(await zoomOf(page));
      await zoomKey(page, platform, out);
      const now = Number(await zoomOf(page));
      assert.ok(out ? now < zoom : now > zoom, `the zoom after the key is ${now}, from ${zoom}`);
      assert.ok(await page.evaluate(playingOf('preview.slide')), `a zoom ${out ? 'out' : 'in'} key in a text stops Play Slide`);
      assert.deepEqual((await measure(page)).drawn, {}, 'drawn over the slide after the zoom key');
      const text = await page.evaluate(`document.querySelector('section.present h2').textContent`);
      await press(page, 'q');
      await frames(page);
      assert.equal(await page.evaluate(playingOf('preview.slide')), false, 'a key written into the text does not stop Play Slide');
      assert.equal(await page.evaluate(`document.querySelector('section.present h2').textContent`), `${text}q`);
      await press(page, 'Escape');
      await press(page, 'Escape');
      await page.evaluate(`window.BeesonEditor.exec('edit.undo')`);
      await page.evaluate(`window.BeesonEditor.exec('zoom.fit')`);
      await frames(page);
      assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
    }
  });
}
