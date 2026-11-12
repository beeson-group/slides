// the frame of the selection during a preview, R32.3, on both platforms. while Trace Backdrop, Play
// Slide, Play Steps, Preview Steps of the Steps pane, or Preview Transition plays, none of the
// frames, grips, rotate handle, handle of a block, ends of a line, outline under the pointer, guides,
// band of the selection on the rulers, and caret of a text is drawn, as Keynote and PowerPoint hide
// the handles of a selection during a preview. at the end of a preview, at Stop, and at Esc, the
// selection, the caret, and the focus are those from before the preview and are drawn again. a
// preview does not make an entry of the history or change the file, and a click on the slide during
// a preview stops it and selects as it does without one

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press } from './helpers/editor.mjs';

const DECK = 'test/pages/editor-r32-3.html';
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
const wait = (ms) => new Promise((d) => setTimeout(d, ms));
const centerOf = (page, selector) => page.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

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
    const px = g.getImageData(Math.round((r.left + r.width / 2 - t.left) * devicePixelRatio), 2, 1, 1).data;
    const bg = g.getImageData(1, 2, 1, 1).data;
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

// the kinds of selection, each made with trusted input as a user makes it
const SELECTIONS = {
  block: async (page) => { await click(page, 'section.present h2'); await press(page, 'Escape'); },
  caret: async (page) => { await click(page, 'section.present > p:not(.fragment)'); },
  figure: async (page) => { await click(page, 'section.present figure img'); },
  shape: async (page) => { await click(page, 'section.present .shape.tone-blue'); },
  line: async (page) => { await click(page, await centerOf(page, 'section.present svg.line line')); },
  group: async (page) => { await click(page, 'section.present .shape.tone-accent'); },
  backdrop: async (page) => { await page.evaluate(`window.BeesonEditor.exec('preview.selectBackdrop')`); },
  several: async (page) => {
    await click(page, 'section.present h2');
    await press(page, 'Escape');
    await click(page, 'section.present .shape.tone-blue', { modifiers: 'Shift' });
  },
};

// whether the preview started by id plays
const playingOf = (id) => (id.startsWith('preview.')
  ? `document.querySelector('${MAIN}').getAttribute('aria-pressed') === 'true'`
  : id === 'steps.preview' ? `document.documentElement.classList.contains('beeson-previewing')` : `!!document.querySelector('.beeson-edit-preview')`);

// the preview id started as a user starts it, without a wait for its end
async function start(page, id) {
  await page.evaluate(`(() => { void window.BeesonEditor.exec(${JSON.stringify(id)}); return true; })()`);
  await page.waitFor(playingOf(id), 3000);
  await frames(page);
}

// the selection is made fresh on the first slide, with the pointer moved off the slide
async function select(page, kind) {
  await page.evaluate('Reveal.slide(0)');
  await frames(page);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 995 });
  await SELECTIONS[kind](page);
  await frames(page);
  return measure(page);
}

for (const platform of PLATFORMS) {
  for (const id of PREVIEWS) {
    test(`nothing of the selection is drawn while ${id} plays, and Esc draws the same selection again (${platform})`, async () => {
      const page = await previewPage(platform);
      for (const kind of Object.keys(SELECTIONS)) {
        const before = await select(page, kind);
        assert.ok(Object.keys(before.drawn).length, `the ${kind} selection draws nothing before the preview`);
        await start(page, id);
        // the pointer over another element during the preview
        await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...(await centerOf(page, 'section.present .shape.tone-violet')) });
        await frames(page);
        const during = await measure(page);
        assert.ok(await page.evaluate(playingOf(id)), `${id} ended before the reading of the ${kind} selection`);
        assert.deepEqual(during.drawn, {}, `drawn over the slide during ${id} with the ${kind} selection`);
        await press(page, 'Escape');
        await frames(page);
        assert.equal(await page.evaluate(playingOf(id)), false, `Esc does not stop ${id}`);
        await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 995 });
        await frames(page);
        const after = await measure(page);
        assert.deepEqual(after, before, `the ${kind} selection after Esc that stops ${id}`);
      }
    });
  }

  test(`Esc that stops Preview Steps or Preview Transition keeps the selection, the caret, and the focus (${platform})`, async () => {
    const page = await previewPage(platform);
    for (const id of ['steps.preview', 'slide.previewTransition']) {
      for (const kind of ['block', 'caret', 'several']) {
        const before = await select(page, kind);
        await start(page, id);
        await press(page, 'Escape');
        await frames(page);
        assert.equal(await page.evaluate(playingOf(id)), false, `Esc does not stop ${id}`);
        const after = await measure(page);
        assert.deepEqual({ ...after, drawn: undefined }, { ...before, drawn: undefined }, `the ${kind} selection after Esc that stops ${id}`);
      }
    }
  });

  test(`the selection is drawn again at the end of each preview and at Stop (${platform})`, async () => {
    const page = await previewPage(platform);
    for (const id of PREVIEWS) {
      const before = await select(page, 'shape');
      await start(page, id);
      assert.deepEqual((await measure(page)).drawn, {}, `drawn during ${id}`);
      await page.waitFor(`!(${playingOf(id)})`, 15000);
      await frames(page);
      assert.deepEqual(await measure(page), before, `the selection at the end of ${id}`);
    }
    const before = await select(page, 'caret');
    await start(page, 'preview.slide');
    assert.deepEqual((await measure(page)).drawn, {}, 'drawn during Play Slide');
    await click(page, MAIN);
    await frames(page);
    assert.equal(await page.evaluate(playingOf('preview.slide')), false, 'Stop does not stop Play Slide');
    assert.deepEqual(await measure(page), before, 'the caret after Stop');
  });

  test(`a preview started with the Preview button or the Play button of the Steps pane hides the caret and gives it back at Esc (${platform})`, async () => {
    const page = await previewPage(platform);
    if (!(await page.evaluate(`window.BeesonEditor.state('view.steps').checked`))) await page.evaluate(`window.BeesonEditor.exec('view.steps')`);
    for (const [button, id] of [[MAIN, 'preview.slide'], ['.beeson-edit-side button.play', 'steps.preview']]) {
      const before = await select(page, 'caret');
      assert.equal(before.drawn.caret, 1);
      await click(page, button);
      await page.waitFor(playingOf(id), 3000);
      await frames(page);
      assert.deepEqual((await measure(page)).drawn, {}, `drawn during ${id}`);
      await press(page, 'Escape');
      await frames(page);
      assert.deepEqual(await measure(page), before, `the caret after Esc that stops ${id}`);
    }
  });

  test(`a preview does not make an entry of the history or change a byte of the file (${platform})`, async () => {
    const page = await previewPage(platform);
    await select(page, 'group');
    for (const id of PREVIEWS) {
      await start(page, id);
      await page.waitFor(`!(${playingOf(id)})`, 15000);
      await start(page, id);
      await press(page, 'Escape');
      await frames(page);
    }
    const s = await page.evaluate('window.BeesonEditor.status()');
    assert.equal(s.undo, false, 'a preview made an entry of the history');
    assert.equal(s.dirty, false, 'a preview marked the file changed');
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
  });

  test(`a click on the slide during a preview stops it and selects as it does without one (${platform})`, async () => {
    const page = await previewPage(platform);
    const shape = await select(page, 'shape');
    await select(page, 'block');
    await start(page, 'preview.backdrop');
    await click(page, 'section.present .shape.tone-blue');
    await frames(page);
    assert.equal(await page.evaluate(playingOf('preview.backdrop')), false, 'a click does not stop the preview');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 995 });
    await frames(page);
    assert.deepEqual(await measure(page), shape);
  });
}

// a key typed in a text while a preview plays stops the preview before the key is written, hence
// the key is not written into a text that the preview hides, under a caret that is not drawn
for (const platform of PLATFORMS) {
  test(`a key typed in a text during a preview stops the preview before it is written (${platform})`, async () => {
    const page = await previewPage(platform);
    if (!(await page.evaluate(`window.BeesonEditor.state('view.steps').checked`))) await page.evaluate(`window.BeesonEditor.exec('view.steps')`);
    await page.evaluate(`(() => {
      window.__inputs = [];
      for (const type of ['beforeinput', 'input']) document.addEventListener(type, (ev) => {
        const t = ev.target instanceof Element ? ev.target : null;
        window.__inputs.push({ type, playing: document.documentElement.classList.contains('beeson-playing'), off: !!t?.closest('.beeson-pv-off') });
      }, true);
      // a paragraph that the command of Enter adds to the slide
      new MutationObserver((records) => {
        if (records.some((r) => [...r.addedNodes].some((n) => n.localName === 'p'))) window.__inputs.push({ type: 'paragraph', playing: document.documentElement.classList.contains('beeson-playing'), off: false });
      }).observe(document.querySelector('.reveal .slides'), { childList: true, subtree: true });
      return true;
    })()`);
    // Preview Steps started by the Play button of the Steps pane first, as the report reproduces it
    for (const id of ['steps.preview', ...PREVIEWS.filter((p) => p !== 'steps.preview')]) {
      // Enter runs the command of a new paragraph rather than an input of the browser
      for (const key of ['q', 'Backspace', 'Enter']) {
        await page.evaluate('Reveal.slide(0)');
        await frames(page);
        await click(page, 'section.present p.fragment');
        await press(page, 'End');
        await frames(page);
        const text = await page.evaluate(`document.querySelector('section.present p.fragment').textContent`);
        const count = () => page.evaluate(`document.querySelectorAll('section.present p').length`);
        const paragraphs = await count();
        if (id === 'steps.preview') {
          await click(page, '.beeson-edit-side button.play');
          await page.waitFor(playingOf(id), 3000);
          await frames(page);
        } else await start(page, id);
        assert.ok(await page.evaluate(playingOf(id)), `${id} does not play`);
        await page.evaluate('window.__inputs.length = 0');
        await press(page, key);
        await frames(page);
        const inputs = await page.evaluate('window.__inputs');
        if (key !== 'Enter') assert.ok(inputs.length, `${key} typed during ${id} is not written`);
        assert.deepEqual(inputs.filter((i) => i.playing || i.off), [], `${key} written into the text while ${id} plays`);
        assert.equal(await page.evaluate(playingOf(id)), false, `${key} typed in a text does not stop ${id}`);
        const now = await page.evaluate(`document.querySelector('section.present p.fragment').textContent`);
        if (key === 'Enter') assert.equal(await count(), paragraphs + 1, `Enter typed during ${id} does not make a paragraph`);
        else assert.equal(now, key === 'q' ? `${text}q` : text.slice(0, -1), `the text after ${key} typed during ${id}`);
        assert.equal(await page.evaluate(`document.activeElement.isContentEditable`), true, `the focus after ${key} typed during ${id}`);
        await press(page, 'Escape');
        await press(page, 'Escape');
        await page.evaluate(`window.BeesonEditor.exec('edit.undo')`);
        await frames(page);
        assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source, `the undo of ${key} typed during ${id}`);
      }
    }
  });
}
