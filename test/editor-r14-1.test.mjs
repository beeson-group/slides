// the work of R14.1 on both platforms: the empty caption of a picture at the place of a caption,
// and the report of a new table that is drawn over a text

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';

const DECK = 'index.html';
// the slides of index.html with a list beside a backdrop, and with a figure in a zone
const STEPS = 2;
const FIGURES = 4;
const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const DARK_FILE = resolve('demo/figure-dark.png');

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
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const status = (page) => page.evaluate('window.BeesonEditor.status()');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

// the box in slide px of an element of the current slide
const box = (page, selector) => page.evaluate(`(() => {
  const slide = document.querySelector('.reveal .slides > section.present');
  const s = slide.getBoundingClientRect();
  const k = s.width / slide.offsetWidth;
  const e = slide.querySelector(${js(selector)});
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k };
})()`);

async function load(t, platform, n, query = '', deck = DECK) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}${query}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(readFileSync(deck, 'utf8'))})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(typeof n === 'number' ? `Reveal.slide(${n})` : `Reveal.slide([...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('h2')?.textContent === ${js(n)}))`);
  await frames(page);
  return page;
}

async function choose(page, paths) {
  await page.waitFor(`!!document.querySelector('input.beeson-media-input')`);
  const { result } = await page.send('Runtime.evaluate', { expression: `document.querySelector('input.beeson-media-input')` });
  await page.send('DOM.setFileInputFiles', { files: paths, objectId: result.objectId });
}

for (const platform of PLATFORMS) {
  // juror item 6b and D27. the empty caption of the Caption switch is drawn where the theme puts
  // the caption of a zone, 16 px under the picture, with its prompt and the caret in it, and it is
  // not reported as a text past the slide
  test(`the empty caption of the Caption switch is drawn under the picture with its prompt and the caret (${platform})`, async (t) => {
    const page = await load(t, platform, STEPS);
    const insert = page.evaluate(`window.BeesonEditor.exec('insert.image').then(() => true)`);
    await choose(page, [DARK_FILE]);
    await insert;
    await page.waitFor(`window.BeesonEditor.render().includes('media/figure-dark.png')`, 30000);
    await frames(page);
    await exec(page, 'figure.caption');
    await frames(page);
    const img = await box(page, 'figure img');
    const cap = await box(page, 'figure > figcaption');
    assert.ok(img && cap, `no caption: ${js({ img, cap })}`);
    assert.ok(cap.bottom <= 1080, `the empty caption is drawn past the slide: ${js(cap)}`);
    assert.ok(Math.abs(cap.top - img.bottom - 16) < 2, `the empty caption is not 16 px under the picture: ${js({ img, cap })}`);
    const shown = await page.evaluate(`(() => {
      const c = document.querySelector('.reveal section.present figure > figcaption');
      const p = getComputedStyle(c, '::before');
      const sel = getSelection();
      return { prompt: p.content, caret: !!sel.anchorNode && c.contains(sel.anchorNode) };
    })()`);
    assert.deepEqual(shown, { prompt: '"Click to add a caption"', caret: true });
    const s = await status(page);
    assert.equal(s.overflow, 0, `the empty caption is reported: ${s.message}`);
    assert.ok(!/past the slide|over a figure/.test(s.message), s.message);
    // the typed caption stays at the same place
    await page.send('Input.insertText', { text: 'A' });
    await frames(page);
    const typed = await box(page, 'figure > figcaption');
    assert.ok(Math.abs(typed.top - cap.top) < 2, `the caption moves at its first input: ${js({ cap, typed })}`);
    assert.deepEqual(errors(page), []);
  });

  // D28. a new table on a slide without a free place is reported as a figure that hides a text,
  // as a new plot is at the same place
  test(`a new table drawn over a text is reported, as a new plot is (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await frames(page);
    const s = await status(page);
    assert.ok(s.overflow > 0 && /over a figure/.test(s.message), `the table is not reported: ${js({ overflow: s.overflow, message: s.message })}`);
    const marked = await page.evaluate(`[...document.querySelectorAll('.reveal section.present .beeson-overflow')].map((e) => e.localName)`);
    assert.ok(marked.length > 0 && !marked.some((n) => n === 'th' || n === 'td'), `the cells of the table are marked: ${js(marked)}`);
    assert.deepEqual(errors(page), []);
  });

  // D30. after Dark on a picture in light mode, the button of the well of the Image pane adds the
  // twin for light mode, and it is named as the command, as the context menu names it
  test(`the button of the well names the choice of the twin of a picture hidden by its mode (${platform})`, async (t) => {
    const page = await load(t, platform, STEPS, '&theme=light');
    const insert = page.evaluate(`window.BeesonEditor.exec('insert.image').then(() => true)`);
    await choose(page, [DARK_FILE]);
    await insert;
    await page.waitFor(`window.BeesonEditor.render().includes('media/figure-dark.png')`, 30000);
    await frames(page);
    const label = () => page.evaluate(`(() => { const b = document.querySelector('.beeson-edit-inspector .ed-well .ed-btn'); return b ? { text: b.textContent.trim(), title: b.title } : null; })()`);
    assert.equal((await label())?.text, 'Replace…');
    await exec(page, 'figure.mode.dark');
    await frames(page);
    const state = await page.evaluate(`window.BeesonEditor.state('media.replace')`);
    assert.equal(state.label, 'Choose Image for Light Mode…');
    const b = await label();
    assert.equal(b?.text, 'Choose for Light Mode…', `the button reads ${js(b)}`);
    assert.equal(b.title, state.label);
    assert.deepEqual(errors(page), []);
  });

  // D19. a display formula is drawn as a block as wide as the text column, while its glyphs end at
  // the left of the picture. the formula is measured by the box of its glyphs
  test(`a display formula whose glyphs end left of the picture is not reported over it (${platform})`, async (t) => {
    for (const id of ['slide.layout.wide', 'slide.layout.title']) {
      const page = await load(t, platform, 'Math, an ordered list, and a zone', '', LAYOUTS);
      await exec(page, id);
      await frames(page);
      await frames(page);
      const m = await page.evaluate(`(() => {
        const slide = document.querySelector('.reveal .slides > section.present');
        const math = slide.querySelector('div.math');
        const glyphs = math.querySelector('mjx-container svg').getBoundingClientRect();
        const img = [...slide.querySelectorAll('figure img')].find((i) => i.getClientRects().length).getBoundingClientRect();
        return { marked: math.classList.contains('beeson-overflow'), clear: glyphs.right < img.left, wide: math.getBoundingClientRect().right > img.left };
      })()`);
      assert.deepEqual([m.clear, m.wide], [true, true], `the slide does not show the case of D19 after ${id}: ${js(m)}`);
      assert.equal(m.marked, false, `after ${id}, the formula is reported over the figure`);
      assert.deepEqual(errors(page), []);
    }
  });

  // D29. a typed caption under a new picture meets the box of the footnote but not its text, which
  // ends left of the caption, and it is not reported as running into the footnote
  test(`a caption beside the end of the footnote text is not reported as running into it (${platform})`, async (t) => {
    const page = await load(t, platform, STEPS);
    const insert = page.evaluate(`window.BeesonEditor.exec('insert.image').then(() => true)`);
    await choose(page, [DARK_FILE]);
    await insert;
    await page.waitFor(`window.BeesonEditor.render().includes('media/figure-dark.png')`, 30000);
    await frames(page);
    await exec(page, 'figure.caption');
    await frames(page);
    await page.send('Input.insertText', { text: 'A new caption' });
    await frames(page);
    const m = await page.evaluate(`(() => {
      const slide = document.querySelector('.reveal .slides > section.present');
      const foot = slide.querySelector(':scope > .foot');
      const cap = slide.querySelector('figure > figcaption').getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(foot);
      const text = Math.max(...[...range.getClientRects()].map((r) => r.right));
      const f = foot.getBoundingClientRect();
      return { boxMeets: cap.left < f.right && cap.bottom > f.top, textClear: text < cap.left };
    })()`);
    assert.deepEqual(m, { boxMeets: true, textClear: true }, 'the slide does not show the case of D29');
    const s = await status(page);
    assert.equal(s.overflow, 0, `the caption is reported: ${s.message}`);
    assert.deepEqual(errors(page), []);
  });

  // D20. after Section on the slide of the code box, the footnote is drawn over the code box, and
  // both are marked, as a text over a picture is
  test(`a footnote drawn over a code box is marked with the code box (${platform})`, async (t) => {
    const page = await load(t, platform, 'Code boxes, you guessed it...');
    await exec(page, 'slide.layout.section');
    await frames(page);
    await frames(page);
    const m = await page.evaluate(`(() => {
      const slide = document.querySelector('.reveal .slides > section.present');
      const a = slide.querySelector('pre').getBoundingClientRect();
      const foot = slide.querySelector('.foot');
      const b = foot.getBoundingClientRect();
      return { meets: a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right, foot: foot.classList.contains('beeson-overflow'), pre: slide.querySelector('pre').classList.contains('beeson-overflow') || !!slide.querySelector('pre .beeson-overflow, pre.beeson-overflow') };
    })()`);
    assert.equal(m.meets, true, 'the slide does not show the case of D20');
    assert.deepEqual([m.foot, m.pre], [true, true], `the marks are ${js(m)}`);
    const s = await status(page);
    assert.ok(s.overflow >= 2, `the status reads ${s.message}`);
    assert.deepEqual(errors(page), []);
  });
}
