// Preview of the Backdrop pane, R32.5, on both platforms. while it traces the selected backdrop,
// the frame, the grips, the marks of the window, the guides, and the band of the selection on the
// rulers are not drawn, as during the previews of the toolbar (R32.3). they are drawn again at the
// end of the trace, at Esc, which completes the trace and keeps the selection, and at a press on the
// slide. the preview does not make an entry of the history or change the file

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press } from './helpers/editor.mjs';

const DECK = 'test/pages/editor-r32-3.html';
const PLATFORMS = ['mac', 'other'];
const PANE = '.beeson-edit-inspector [data-command="backdrop.preview"]';

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

// the editor on the deck with the rulers shown, without reduced motion so that a backdrop is traced
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
  if (!(await page.evaluate(`window.BeesonEditor.state('view.rulers').checked`))) await page.evaluate(`window.BeesonEditor.exec('view.rulers')`);
  await page.waitFor(`window.BeesonEditor.state('preview.backdrop').enabled`);
  await frames(page);
  return page;
}

// what the editor draws over the slide, each part with the count of its shown elements, the band
// of the selection on the top ruler, whether a caret is drawn, the focus, the offset of the caret,
// and the selection
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
    group: '.beeson-overlay .beeson-frame.union',
    hover: '.beeson-overlay .beeson-frame:not(.selected):not(.union):not(.entered)',
    grip: '.beeson-overlay .beeson-grip',
    rotor: '.beeson-overlay .beeson-rotor',
    handle: '.beeson-overlay .beeson-handle',
    size: '.beeson-overlay .beeson-offset',
    snap: '.beeson-overlay .beeson-guide',
    end: '.beeson-line-layer .beeson-line-end',
    cut: '.beeson-backdrop-cuts > *',
    guide: '.beeson-guides .beeson-hand-guide',
  };
  const drawn = {};
  for (const [name, sel] of Object.entries(parts)) {
    const n = [...document.querySelectorAll(sel)].filter(shown).length;
    if (n) drawn[name] = n;
  }
  const sel = window.BeesonEditor.selection();
  const top = document.querySelector('.beeson-ruler[data-axis="x"]');
  if (top && !top.hidden && sel.length) {
    const r = sel[0].getBoundingClientRect(), t = top.getBoundingClientRect();
    const g = top.getContext('2d');
    // the first row, since the labels are drawn from the third row on, and the ticks from the fourth
    const px = g.getImageData(Math.round((r.left + r.width / 2 - t.left) * devicePixelRatio), 0, 1, 1).data;
    const bg = g.getImageData(1, 0, 1, 1).data;
    if (px[0] !== bg[0] || px[1] !== bg[1] || px[2] !== bg[2]) drawn.band = 1;
  }
  const a = document.activeElement;
  const s = getSelection();
  const editing = !!(a && a.isContentEditable && s.rangeCount && s.isCollapsed);
  // a caret in a color with an alpha of 0 is not seen
  if (editing && !['transparent', 'rgba(0, 0, 0, 0)'].includes(getComputedStyle(a).caretColor)) drawn.caret = 1;
  return {
    drawn,
    focus: a ? a.localName + (a.isContentEditable ? ':' + a.textContent.slice(0, 12) : '') : null,
    offset: editing ? s.anchorOffset : null,
    selection: sel.map((el) => el.matches('.backdrop') ? 'backdrop' : el.localName + (el.classList.contains('shape') ? '.shape' : '')),
  };
})()`;
const measure = (page) => page.evaluate(DRAWN);

const tracing = (page) => page.evaluate('Beeson.backdrops.filter((b) => b.raf).length > 0');

// the backdrop of the first slide selected, with the pointer off the slide, and the Backdrop pane shown
async function selectBackdrop(page) {
  await page.evaluate('Reveal.slide(0)');
  await frames(page);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 995 });
  await page.evaluate(`window.BeesonEditor.exec('preview.selectBackdrop')`);
  await page.waitFor(`!!document.querySelector(${JSON.stringify(PANE)})`, 3000);
  await frames(page);
  return measure(page);
}

async function startPane(page) {
  await click(page, PANE);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 995 });
  await frames(page);
}

for (const platform of PLATFORMS) {
  test(`nothing of the selection is drawn while Preview of the Backdrop pane traces, and Esc draws the same selection again (${platform})`, async () => {
    const page = await previewPage(platform);
    const before = await selectBackdrop(page);
    assert.deepEqual(before.selection, ['backdrop']);
    assert.ok(before.drawn.frame && before.drawn.grip, 'the selected backdrop draws no frame before the preview');
    await startPane(page);
    assert.ok(await tracing(page), 'the backdrop is not traced');
    const during = await measure(page);
    assert.deepEqual(during.drawn, {}, 'drawn over the slide during Preview of the pane');
    assert.deepEqual(during.selection, ['backdrop']);
    await press(page, 'Escape');
    await frames(page);
    assert.equal(await tracing(page), false, 'Esc does not complete the trace');
    assert.deepEqual(await measure(page), before, 'the selection after Esc');
    // the next Esc deselects, as without a preview
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual((await measure(page)).selection, []);
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
  });

  test(`the selection is drawn again at the end of the trace of Preview of the Backdrop pane (${platform})`, async () => {
    const page = await previewPage(platform);
    const before = await selectBackdrop(page);
    await startPane(page);
    assert.deepEqual((await measure(page)).drawn, {}, 'drawn over the slide during Preview of the pane');
    await page.waitFor(`!document.documentElement.classList.contains('beeson-playing')`, 15000);
    await frames(page);
    assert.deepEqual(await measure(page), before, 'the selection at the end of the trace');
    const s = await page.evaluate('window.BeesonEditor.status()');
    assert.equal(s.undo, false, 'the preview made an entry of the history');
    assert.equal(s.dirty, false, 'the preview marked the file changed');
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
  });

  test(`a press on the slide during Preview of the Backdrop pane draws the selection again (${platform})`, async () => {
    const page = await previewPage(platform);
    const before = await selectBackdrop(page);
    await startPane(page);
    assert.deepEqual((await measure(page)).drawn, {}, 'drawn over the slide during Preview of the pane');
    // a press on the backdrop, away from the other elements
    const box = await page.evaluate(`(() => { const r = document.querySelector('section.present .backdrop').getBoundingClientRect(); return { x: r.left + r.width * 0.9, y: r.top + r.height * 0.15 }; })()`);
    await click(page, box);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 995 });
    await frames(page);
    const after = await measure(page);
    assert.deepEqual(after.selection, ['backdrop']);
    assert.deepEqual(after.drawn, before.drawn, 'the selection after a press on the slide');
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
  });
}
