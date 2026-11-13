// the Steps tab of the inspector with trusted input on either platform: a row dragged from step 3
// to step 1 writes the indexes of the slide and the data-keep that names the moved step, the menu
// of a chip sets the step, the start, the effect, and Show Last, a row selects its element and a
// selected element marks its row, Alt with an arrow moves a step, each row shows 30 characters of
// its text at 1440 by 900, and Preview plays the steps and ends on the last layer of the slide.
// after each edit an undo gives the file byte for byte, a redo gives the edit, and a save is
// opened again without problems

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, previewFrames, recordPreview, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const REDO = { mac: 'Mod+Shift+Z', other: 'Mod+Y' };
// the errors of a page, apart from the request of a favicon, which test/pages does not have
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

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

// the demo deck with the formula of the slide of stepped math held through step 3, since no deck
// has a data-keep of a number
const KEEP_BEFORE = '<div class="math fragment" data-fragment-index="1" data-keep>';
const KEEP_AFTER = '<div class="math fragment" data-fragment-index="1" data-keep="3">';
const demo = () => readFileSync('test-deck.html', 'utf8').replace(KEEP_BEFORE, KEEP_AFTER);

// the editor on a deck served over HTTP, opened with text, with the Steps tab shown
async function open(t, platform, { deck = 'test-deck.html', text = readFileSync(deck, 'utf8'), width = 1920, height = 1080 } = {}) {
  const page = await browser.newPage({ width, height });
  t.after(() => page.close());
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = text;
  // the drafts that an earlier test left in the shared browser are not offered
  await page.evaluate('localStorage.clear()');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(text)})`)).problems, []);
  await page.evaluate(`window.BeesonEditor.exec('view.steps')`);
  return page;
}

// the slide of the element matched by selector is shown
async function slideOf(page, selector) {
  await page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); Reveal.slide(Reveal.getIndices(el.closest('section')).h); })()`);
  await sleep(150);
}

const rendered = (page) => page.evaluate('window.BeesonEditor.render()');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);

// the rows in their order: the step written on the row, its text, its chip, and its marks
const rows = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .rows .row')].map((r) => ({
  step: r.dataset.step,
  text: r.querySelector('.text').textContent,
  chip: r.querySelector('.chip').textContent,
  meta: r.querySelector('.meta').textContent,
  selected: r.classList.contains('selected'),
}))`);

// the center of a part of the row whose text starts with text
async function rowPart(page, text, part = '.grip') {
  const at = await page.evaluate(`(() => {
    const row = [...document.querySelectorAll('.beeson-edit-side .rows .row')].find((r) => r.querySelector('.text').textContent.startsWith(${JSON.stringify(text)}));
    const r = (${JSON.stringify(part)} ? row.querySelector(${JSON.stringify(part)}) : row).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  return at;
}

// an item of the menu of the chip of the row with text, chosen with two trusted clicks
async function pick(page, text, label) {
  await click(page, await rowPart(page, text, '.chip'));
  await page.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
  const item = await page.evaluate(`(() => {
    const item = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label').textContent === ${JSON.stringify(label)});
    if (!item || item.getAttribute('aria-disabled') === 'true') return null;
    const r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(item, `the menu of the chip does not have an enabled item ${label}`);
  // an item is taken at a release 250 ms after the press that opened its menu
  await sleep(300);
  await click(page, item);
  await page.evaluate('window.BeesonEditor.status()');
}

// the edit is undone to the text before it byte for byte, and redone to the text after it
async function undoRedo(page, platform, before, after) {
  await press(page, 'Mod+Z');
  assert.equal(await rendered(page), before, 'an undo does not give the file before the edit');
  await press(page, REDO[platform]);
  assert.equal(await rendered(page), after, 'a redo does not give the edit again');
}

for (const platform of PLATFORMS) {
  test(`a row dragged from step 3 to step 1 writes the indexes and its data-keep on ${platform}`, async (t) => {
    const page = await open(t, platform, { text: demo() });
    await slideOf(page, 'div.math[data-keep]');
    assert.deepEqual((await rows(page)).map((r) => r.step), ['0', '1', '2', '3', '', '']);
    const grip = await rowPart(page, 'The Coriolis');
    const top = await page.evaluate(`document.querySelector('.beeson-edit-side .rows .step:not(.plain)').getBoundingClientRect().top`);

    // a drag shows a line where the row goes and a ghost of the row, and Esc cancels it
    await drag(page, grip, { dy: top - 3 - grip.y, steps: 12, hold: true });
    const during = await page.evaluate(`({ line: !document.querySelector('.beeson-edit-side .drop-line').hidden, ghost: !!document.querySelector('.beeson-steps-ghost'), dragging: !!document.querySelector('.beeson-edit-side .row.dragging') })`);
    assert.deepEqual(during, { line: true, ghost: true, dragging: true });
    await press(page, 'Escape');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: grip.x, y: top - 3, button: 'left', clickCount: 1 });
    assert.equal(await rendered(page), page.source);
    assert.equal(await page.evaluate(`!!document.querySelector('.beeson-steps-ghost')`), false);

    await drag(page, grip, { dy: top - 3 - grip.y, steps: 12 });
    await page.evaluate('window.BeesonEditor.status()');
    assert.deepEqual((await rows(page)).map((r) => [r.step, r.text.slice(0, 12)]), [
      ['0', 'The Coriolis'],
      ['1', '\\ddot x - \\c'],
      ['2', 'where \\tilde'],
      ['3', 'The effectiv'],
      ['', 'Equations ar'],
      ['', 'You can type'],
    ]);
    const edited = page.source
      .replace(KEEP_AFTER, '<div class="math fragment" data-fragment-index="2" data-keep="1">')
      .replace('<p class="fragment" data-fragment-index="2">where', '<p class="fragment" data-fragment-index="3">where')
      .replace('<p class="fragment" data-fragment-index="3" data-highlight="coriolis">', '<p class="fragment" data-fragment-index="1" data-highlight="coriolis">');
    assert.notEqual(edited, page.source);
    assert.equal(await rendered(page), edited);
    assert.equal(await undoLabel(page), 'Undo Move Step');
    await undoRedo(page, platform, page.source, edited);
    await saveAndReopen(page);
    assert.deepEqual(errors(page), []);
  });

  test(`the menu of a chip sets the step, the start, the effect, and Show Last on ${platform}`, async (t) => {
    const page = await open(t, platform);
    await slideOf(page, 'div.math[data-keep]');
    const source = page.source;
    const where = '<p class="fragment" data-fragment-index="2">where';
    const coriolis = '<p class="fragment" data-fragment-index="3" data-highlight="coriolis">';
    const effective = '<p class="fragment" data-fragment-index="4" data-highlight="potential" data-tone="violet">';

    await pick(page, 'where', 'Step 1');
    const joined = source
      .replace(where, '<p class="fragment" data-fragment-index="1">where')
      .replace(coriolis, '<p class="fragment" data-fragment-index="2" data-highlight="coriolis">')
      .replace(effective, '<p class="fragment" data-fragment-index="3" data-highlight="potential" data-tone="violet">');
    assert.equal(await rendered(page), joined);
    let r = await rows(page);
    assert.deepEqual(r.map((x) => x.step), ['0', '0', '1', '2', '', '']);
    assert.match(r[1].meta, /With Previous/);
    assert.equal(r[1].selected, true, 'the row of the chip is not selected');
    await undoRedo(page, platform, source, joined);

    // On Click puts the row back into a step of its own after the step it was shown with
    await pick(page, 'where', 'On Click');
    assert.equal(await rendered(page), source);
    await undoRedo(page, platform, joined, source);

    await pick(page, 'The Coriolis', 'Fade Out');
    const faded = source.replace(coriolis, '<p class="fragment fade-out" data-fragment-index="3" data-highlight="coriolis">');
    assert.equal(await rendered(page), faded);
    assert.match((await rows(page))[2].meta, /Fade Out/);
    await undoRedo(page, platform, source, faded);

    await pick(page, 'The Coriolis', 'Only at Its Step');
    const only = source.replace(coriolis, '<p class="fragment current-visible" data-fragment-index="3" data-highlight="coriolis">');
    assert.equal(await rendered(page), only);
    await undoRedo(page, platform, faded, only);

    await pick(page, 'The effective', 'Show Last');
    const last = only.replace(effective, '<p class="fragment" data-highlight="potential" data-tone="violet" data-final>');
    assert.equal(await rendered(page), last);
    r = await rows(page);
    assert.equal(r[3].chip, 'Last');
    await undoRedo(page, platform, only, last);

    // With the Slide takes the class fragment and the effect off the element
    await pick(page, 'The Coriolis', 'With the Slide');
    const plain = last.replace('<p class="fragment current-visible" data-fragment-index="3" data-highlight="coriolis">', '<p data-highlight="coriolis">');
    assert.equal(await rendered(page), plain);
    await undoRedo(page, platform, last, plain);
    await saveAndReopen(page);
    assert.deepEqual(errors(page), []);
  });

  test(`a row selects its element, a selected element marks its row, and Alt with an arrow moves a step on ${platform}`, async (t) => {
    const page = await open(t, platform);
    await slideOf(page, '.reveal .slides section .figure-box > img');
    await click(page, '.reveal section.present .figure-box > img');
    await page.evaluate('window.BeesonEditor.status()');
    let r = await rows(page);
    assert.deepEqual(r.filter((x) => x.selected).map((x) => x.meta.split(' · ')[0]), ['Figure']);
    assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-badge.on').length`), 0);

    await click(page, await rowPart(page, 'You might', '.body'));
    await page.evaluate('window.BeesonEditor.status()');
    r = await rows(page);
    assert.deepEqual(r.filter((x) => x.selected).map((x) => x.text.slice(0, 9)), ['You might']);
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-badge.on')].map((b) => b.textContent)`), ['2']);
    assert.equal(await page.evaluate(`document.activeElement.classList.contains('row')`), true);
    // the frame of the selection is drawn around the item of the row
    const framed = await page.evaluate(`(() => {
      const li = [...document.querySelectorAll('.reveal section.present li')].find((li) => li.textContent.startsWith('You might')).getBoundingClientRect();
      return [...document.querySelectorAll('.beeson-frame.selected')].some((f) => { const b = f.getBoundingClientRect(); return b.width && Math.abs(b.left - li.left) < 12 && Math.abs(b.top - li.top) < 12; });
    })()`);
    assert.equal(framed, true, 'a click on a row does not select its element');

    // the arrows move between the rows, and Alt with Up moves the step of the row earlier
    await press(page, 'ArrowDown');
    r = await rows(page);
    assert.deepEqual(r.filter((x) => x.selected).map((x) => x.text.slice(0, 8)), ['You shou']);
    const source = page.source;
    await press(page, 'Alt+ArrowUp');
    await page.evaluate('window.BeesonEditor.status()');
    const earlier = source
      .replace('<li class="fragment" data-fragment-index="2">You might', '<li class="fragment" data-fragment-index="3">You might')
      .replace('<li class="fragment" data-fragment-index="3">You should', '<li class="fragment" data-fragment-index="2">You should');
    assert.equal(await rendered(page), earlier);
    assert.equal(await undoLabel(page), 'Undo Move Step Earlier');
    await undoRedo(page, platform, source, earlier);
    assert.deepEqual(errors(page), []);
  });

  test(`Preview plays the steps of the slide and ends on its last layer on ${platform}`, async (t) => {
    const page = await open(t, platform, { deck: 'test/pages/layers.html' });
    const layers = () => page.evaluate(`[...document.querySelectorAll('.beeson-shown-steps button')].map((b) => (b.getAttribute('aria-pressed') === 'true' ? '*' : '') + b.textContent)`);
    assert.deepEqual(await layers(), ['*Up to step 2', 'From step 3']);
    // the span in the text of a paragraph is a step of its own, listed on a locked row
    assert.deepEqual((await rows(page)).filter((r) => r.step).map((r) => [r.step, r.text.slice(0, 12)]), [['0', 'The old step'], ['1', 'The old span'], ['2', 'The old lead'], ['2', 'The new lead'], ['3', 'The new step']]);
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .row.locked .chip')].map((c) => c.disabled)`), [true]);
    // each frame of the preview is recorded in the page as it is drawn, since the wait for its step
    // 2 timed out on a slow runner, where the preview was past this step at the first read
    await recordPreview(page, `({
      shown: ['old-lead', 'old-step', 'old-span', 'new-lead', 'new-step'].filter((id) => { const el = document.getElementById(id); return getComputedStyle(el).visibility === 'visible' && !el.closest('.beeson-pv-off'); }),
      label: document.querySelector('.beeson-edit-side .head .play').textContent,
    })`);
    await click(page, '.beeson-edit-side .head .play');
    const played = await previewFrames(page);
    const at = (step) => played.find((f) => f.step === step);
    // before the first step, only the lead-in of the old derivation is shown
    assert.deepEqual(played[0], { step: '0', playing: true, read: { shown: ['old-lead'], label: 'Stop' } });
    assert.deepEqual(at('2')?.read.shown, ['old-lead', 'old-step', 'old-span']);
    assert.deepEqual(at('4')?.read.shown, ['new-lead', 'new-step']);
    assert.deepEqual(await layers(), ['Up to step 2', '*From step 3']);
    assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-pv-off, .beeson-pv-dim').length`), 0);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-side .head .play').textContent`), 'Preview Steps');

    // Esc stops a preview, which also ends on the last layer
    await page.evaluate(`[...document.querySelectorAll('.beeson-shown-steps button')][0].click()`);
    await click(page, '.beeson-edit-side .head .play');
    await page.waitFor(`document.documentElement.classList.contains('beeson-previewing')`);
    await press(page, 'Escape');
    assert.equal(await page.evaluate(`document.documentElement.classList.contains('beeson-previewing')`), false);
    assert.deepEqual(await layers(), ['Up to step 2', '*From step 3']);
    assert.equal(await rendered(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  // reveal.js numbers the indexes of the page from 0, and an edit writes the indexes of the file,
  // hence the steps of a preview after an edit are read from the tags
  test(`a preview after an edit plays the steps of the edit on ${platform}`, async (t) => {
    const page = await open(t, platform);
    await slideOf(page, 'div.math[data-keep]');
    await pick(page, 'where', 'With Previous');
    assert.deepEqual((await rows(page)).map((r) => r.step), ['0', '0', '1', '2', '', '']);
    await recordPreview(page, `[...document.querySelectorAll('.reveal section.present .fragment')].filter((f) => f.classList.contains('beeson-pv-off')).map((f) => f.textContent.slice(0, 12))`);
    await click(page, '.beeson-edit-side .head .play');
    const played = await previewFrames(page);
    assert.deepEqual(played.find((f) => f.step === '2')?.read, ['The effectiv']);
    assert.deepEqual(errors(page), []);
  });

  // the sans of the system is wider on Linux, e.g. DejaVu Sans, hence a row shows fewer characters
  // there. a long text is cut with an ellipsis and shown whole in its tooltip, as in the Animation
  // Pane of PowerPoint, and at least 24 characters of it are shown in any font
  test(`each row shows its text, or at least 24 characters of it with an ellipsis and a tooltip, at 1440 by 900 on ${platform}`, async (t) => {
    const page = await open(t, platform, { width: 1440, height: 900 });
    const slides = await page.evaluate('Reveal.getTotalSlides()');
    let checked = 0;
    for (let h = 0; h < slides; h++) {
      await page.evaluate(`Reveal.slide(${h})`);
      await sleep(80);
      // the width of the first 24 characters of each cut text, in the font of its row, the width of
      // the box of the text, and its tooltip
      const short = await page.evaluate(`(() => {
        const ctx = document.createElement('canvas').getContext('2d');
        return [...document.querySelectorAll('.beeson-edit-side .rows .text')].filter((el) => el.scrollWidth > el.clientWidth).map((el) => {
          const s = getComputedStyle(el);
          ctx.font = s.fontWeight + ' ' + s.fontSize + ' ' + s.fontFamily;
          return { text: el.textContent, need: ctx.measureText(el.textContent.slice(0, 24) + '…').width, has: el.clientWidth, overflow: s.textOverflow, tip: el.title };
        });
      })()`);
      checked += short.length;
      for (const row of short) {
        assert.ok(row.need <= row.has, `only ${row.has} px of the ${Math.ceil(row.need)} px of "${row.text.slice(0, 24)}" are shown`);
        assert.equal(row.overflow, 'ellipsis', row.text);
        assert.equal(row.tip, row.text, `the cut text "${row.text.slice(0, 24)}…" is not shown whole in a tooltip`);
      }
    }
    assert.ok(checked > 5, `only ${checked} rows are cut`);
    assert.deepEqual(errors(page), []);
  });
}

