// a click on a slide of a deck shown without the editor, with trusted input. as in PowerPoint and
// Keynote, a click plays the next step, or shows the next slide after the last step. a click on an
// element that takes it, a click that ends a drag or a text selection, and a right-click do not
// move the deck. a click on the current slide of the presenter view of the editor moves it on too

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';
import { click, drag, editorPage, press } from './helpers/editor.mjs';

const PAGE = 'test/pages/slideshow-click.html';
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
// longer than every delay of the timed deck, which are 300 ms
const QUIET = 900;
// a point of the first slide without an element
const BLANK = { x: 700, y: 950 };

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser?.close();
});

async function open(t, deck = PAGE, query = '') {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(deckUrl(deck, query));
  await page.waitFor(deckSettled);
  // a link is not followed in the test, and the deck has handled its click before this listener
  await page.evaluate(`window.addEventListener('click', (ev) => { if (ev.target.closest('a')) ev.preventDefault(); })`);
  return page;
}

// the slide and the texts of the visible fragments
const state = (page) => page.evaluate(`({
  slide: Reveal.getIndices().h,
  shown: [...Reveal.getCurrentSlide().querySelectorAll('.fragment.visible')].map((f) => f.textContent).filter(Boolean),
})`);

// the state once nothing changes for QUIET ms
async function settled(page) {
  let now = await state(page);
  for (;;) {
    await sleep(QUIET);
    const next = await state(page);
    if (JSON.stringify(next) === JSON.stringify(now)) return now;
    now = next;
  }
}

test('a click on a slide plays its next step, and shows the next slide after its last step', async (t) => {
  const page = await open(t);
  await click(page, BLANK);
  assert.deepEqual(await state(page), { slide: 0, shown: ['One'] });
  await click(page, 'h2');
  assert.deepEqual(await state(page), { slide: 0, shown: ['One', 'Two'] });
  // the last step dims the step before, hence the theme adds the step that restores it
  await click(page, BLANK);
  assert.equal(await page.evaluate(`Reveal.getCurrentSlide().hasAttribute('data-complete')`), true);
  await click(page, BLANK);
  assert.deepEqual(await settled(page), { slide: 1, shown: [] });
  assert.deepEqual(page.errors, []);
});

test('a click on a link, a plot, a surface, a tycho viewer, a QR code, or the chrome does not move the deck', async (t) => {
  const page = await open(t);
  for (const at of ['#link', '.plot', '.plot button', '.surface', 'tycho-viewer', '.qr', '.foot', '.slide-number']) {
    await click(page, at);
    assert.deepEqual(await state(page), { slide: 0, shown: [] }, `a click on ${at} moves the deck`);
  }
  assert.deepEqual(page.errors, []);
});

test('a click on a video plays it and a second click pauses it, without moving the deck', async (t) => {
  const page = await open(t);
  await click(page, '#video');
  assert.equal(await page.evaluate(`document.querySelector('#video').paused`), false);
  await click(page, '#video');
  assert.equal(await page.evaluate(`document.querySelector('#video').paused`), true);
  assert.deepEqual(await state(page), { slide: 0, shown: [] });
  assert.deepEqual(page.errors, []);
});

test('a click on the scrubber shows the slide of its tick at the first step, without a step more', async (t) => {
  const page = await open(t);
  await page.evaluate('Reveal.slide(1)');
  // the band is opened by the mouse near the bottom of the window
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 960, y: 1075 });
  await page.waitFor(`document.querySelector('.scrub').getBoundingClientRect().height > 10`);
  const tick = await page.evaluate(`(() => {
    const r = document.querySelector('.scrub-tick.first').getBoundingClientRect();
    return { x: r.left + 2, y: document.querySelector('.scrub').getBoundingClientRect().bottom - 4 };
  })()`);
  await click(page, tick);
  assert.deepEqual(await settled(page), { slide: 0, shown: [] });
  assert.deepEqual(page.errors, []);
});

test('a drag, a text selection, a right-click, and a click with a modifier do not move the deck', async (t) => {
  const page = await open(t);
  await drag(page, BLANK, { dx: 120, dy: 40 });
  assert.deepEqual(await state(page), { slide: 0, shown: [] }, 'a drag moves the deck');
  await drag(page, { x: 110, y: 250 }, { dx: 300 });
  assert.ok((await page.evaluate('String(getSelection())')).length > 0, 'the drag selects text');
  assert.deepEqual(await state(page), { slide: 0, shown: [] }, 'a text selection moves the deck');
  await click(page, BLANK, { button: 'right' });
  assert.deepEqual(await state(page), { slide: 0, shown: [] }, 'a right-click moves the deck');
  await click(page, BLANK, { modifiers: 'Shift' });
  assert.deepEqual(await state(page), { slide: 0, shown: [] }, 'a click with Shift moves the deck');
  // a click after the selection moves the deck, since its press clears the selection
  await click(page, BLANK);
  assert.deepEqual(await state(page), { slide: 0, shown: ['One'] });
  assert.deepEqual(page.errors, []);
});

const ALL = ['Click', 'Timed one', 'Timed two'];

test('a click during a delay shows the next step at once, the later delays still play, and Back lands on the step of the click', async (t) => {
  const page = await open(t, 'test/pages/timed-steps.html');
  await page.evaluate('Reveal.slide(1)');
  // the two clicks are sent at once, since on a slow runner the second of two clicks sent one
  // after the other came after the delays of 300 ms
  const mouse = (type) => page.send('Input.dispatchMouseEvent', { type, ...BLANK, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...BLANK });
  await Promise.all(['mousePressed', 'mouseReleased', 'mousePressed', 'mouseReleased'].map(mouse));
  assert.deepEqual(await settled(page), { slide: 1, shown: ALL });
  await press(page, 'ArrowLeft');
  assert.deepEqual(await settled(page), { slide: 1, shown: ['Click', 'Timed one'] });
  await press(page, 'ArrowLeft');
  assert.deepEqual(await settled(page), { slide: 1, shown: ['Click'] });
  // a click on the last step of a slide with a delay moves on to the next slide
  await page.evaluate('Reveal.slide(2)');
  await click(page, BLANK);
  assert.deepEqual(await settled(page), { slide: 3, shown: [] });
  assert.deepEqual(page.errors, []);
});

test('with the editor, a click on a slide does not move the deck', async (t) => {
  const page = await open(t, PAGE, 'edit&still');
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  const before = await page.evaluate('JSON.stringify(Reveal.getIndices())');
  await click(page, BLANK);
  await sleep(300);
  assert.equal(await page.evaluate('JSON.stringify(Reveal.getIndices())'), before);
});

test('a click on the current slide of the presenter view moves it on, and a right-click does not', async () => {
  const page = await editorPage(browser, { deck: 'test/pages/editor-layouts.html' });
  try {
    await page.evaluate(`window.BeesonEditor.exec('play.rehearse')`);
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter[open]')`);
    const count = () => page.evaluate(`document.querySelector('dialog.beeson-edit-presenter .count').textContent`);
    const first = await count();
    await click(page, 'dialog.beeson-edit-presenter .shot.current', { button: 'right' });
    assert.equal(await count(), first);
    await click(page, 'dialog.beeson-edit-presenter .shot.current');
    assert.notEqual(await count(), first);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});
