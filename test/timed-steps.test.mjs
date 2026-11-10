// the steps that start After Previous in a deck shown without the editor, with trusted keys. going
// forward, a timed step is shown by itself a delay after the step before. going back, as in
// PowerPoint and Keynote, a timed step does not play again by itself: Back skips the timed steps
// to the last step reached by a click, and its delay is not started again

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';
import { press } from './helpers/editor.mjs';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
// longer than every delay of the deck, which are 300 ms
const QUIET = 900;

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser?.close();
});

async function open(t) {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(deckUrl('test/pages/timed-steps.html'));
  await page.waitFor(deckSettled);
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

const ALL = ['Click', 'Timed one', 'Timed two'];

test('a click plays the timed steps after it, and Back goes to the step of the click without playing them again', async (t) => {
  const page = await open(t);
  await press(page, 'ArrowRight');
  assert.deepEqual(await settled(page), { slide: 1, shown: [] });
  await press(page, 'ArrowRight');
  assert.deepEqual(await settled(page), { slide: 1, shown: ALL });
  await press(page, 'ArrowLeft');
  assert.deepEqual(await settled(page), { slide: 1, shown: ['Click'] });
  await press(page, 'ArrowLeft');
  assert.deepEqual(await settled(page), { slide: 1, shown: [] });
  // forward again, the timed steps are played as before
  await press(page, 'ArrowRight');
  assert.deepEqual(await settled(page), { slide: 1, shown: ALL });
  // a step reached by a click goes back one step, to the last timed step
  await press(page, 'ArrowRight');
  assert.deepEqual(await settled(page), { slide: 1, shown: [...ALL, 'Click again'] });
  await press(page, 'ArrowLeft');
  assert.deepEqual(await settled(page), { slide: 1, shown: ALL });
  assert.deepEqual(page.errors, []);
});

test('Back while a timed step is still to come stops it, and PageUp goes back as the left arrow does', async (t) => {
  const page = await open(t);
  await press(page, 'ArrowRight');
  await press(page, 'ArrowRight');
  await press(page, 'ArrowLeft');
  assert.deepEqual(await settled(page), { slide: 1, shown: [] });
  await press(page, 'ArrowRight');
  assert.deepEqual(await settled(page), { slide: 1, shown: ALL });
  await press(page, 'PageUp');
  assert.deepEqual(await settled(page), { slide: 1, shown: ['Click'] });
  assert.deepEqual(page.errors, []);
});

test('a delay on the last step moves on to the next slide, and Back from there stays on the last step', async (t) => {
  const page = await open(t);
  await page.evaluate('Reveal.slide(2)');
  await press(page, 'ArrowRight');
  assert.deepEqual(await settled(page), { slide: 3, shown: [] });
  await press(page, 'ArrowLeft');
  assert.deepEqual(await settled(page), { slide: 2, shown: ['Moves on'] });
  await press(page, 'ArrowLeft');
  assert.deepEqual(await settled(page), { slide: 2, shown: [] });
  assert.deepEqual(page.errors, []);
});

// the step of the current slide: the highest fragment index shown, counted from 0 as reveal.js
// numbers the steps again at its start, hence the restore step is the last index once it is shown
const step = (page) => page.evaluate(`Math.max(-1, ...[...Reveal.getCurrentSlide().querySelectorAll('.fragment.visible')].map((f) => Number(f.dataset.fragmentIndex)))`);

test('a delay on the last step goes on through the restore step to the next slide, and Back lands on the last step', async (t) => {
  const page = await open(t);
  await page.evaluate('Reveal.slide(4)');
  await press(page, 'ArrowRight');
  assert.deepEqual(await settled(page), { slide: 4, shown: ['Dims one'] });
  await press(page, 'ArrowRight');
  assert.deepEqual(await settled(page), { slide: 5, shown: [] });
  await press(page, 'ArrowLeft');
  assert.deepEqual(await settled(page), { slide: 4, shown: ['Dims one', 'Dims two'] });
  assert.equal(await step(page), 1);
  await press(page, 'ArrowLeft');
  assert.deepEqual(await settled(page), { slide: 4, shown: ['Dims one'] });
  assert.deepEqual(page.errors, []);
});

test('the restore step of a slide without a delay on its last step waits for a key', async (t) => {
  const page = await open(t);
  await page.evaluate('Reveal.slide(1, 0, 3)');
  assert.deepEqual(await settled(page), { slide: 1, shown: [...ALL, 'Click again'] });
  await press(page, 'ArrowRight');
  assert.deepEqual(await settled(page), { slide: 1, shown: [...ALL, 'Click again'] });
  assert.equal(await step(page), 4);
  await press(page, 'ArrowRight');
  assert.deepEqual(await settled(page), { slide: 2, shown: [] });
  assert.deepEqual(page.errors, []);
});
