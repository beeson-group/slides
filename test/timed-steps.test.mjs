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
// numbers the steps again at its start
const step = (page) => page.evaluate(`Math.max(-1, ...[...Reveal.getCurrentSlide().querySelectorAll('.fragment.visible')].map((f) => Number(f.dataset.fragmentIndex)))`);

test('a delay on a last step that dims the step before moves on to the next slide, and Back lands on the last step', async (t) => {
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

test('a key during a delay shows the next step at once, the later delays still play, and Back lands on the step of the key', async (t) => {
  const page = await open(t);
  await press(page, 'ArrowRight');
  assert.deepEqual(await settled(page), { slide: 1, shown: [] });
  await press(page, 'ArrowRight');
  await press(page, 'ArrowRight');
  assert.deepEqual(await settled(page), { slide: 1, shown: ALL });
  // the second step was reached by the key, and its delay is not started again
  await press(page, 'ArrowLeft');
  assert.deepEqual(await settled(page), { slide: 1, shown: ['Click', 'Timed one'] });
  await press(page, 'ArrowLeft');
  assert.deepEqual(await settled(page), { slide: 1, shown: ['Click'] });
  assert.deepEqual(page.errors, []);
});

// a remote sends PageDown, and the space bar moves the talk on as well. reveal.js pauses every
// later delay of the talk at such a key by default
test('the keys of a remote during the delay of the last step go on to the next slide, whose delay still plays', async (t) => {
  const page = await open(t);
  await page.evaluate('Reveal.slide(4)');
  await press(page, 'PageDown');
  await press(page, 'PageDown');
  await press(page, 'Space');
  assert.deepEqual(await settled(page), { slide: 5, shown: [] });
  await press(page, 'PageDown');
  assert.deepEqual(await settled(page), { slide: 5, shown: ['Later', 'Later timed'] });
  assert.deepEqual(page.errors, []);
});

test('the key A pauses the delays, which stay paused through the steps of the keys, and A again plays them', async (t) => {
  const page = await open(t);
  await press(page, 'ArrowRight');
  await press(page, 'ArrowRight');
  await press(page, 'A');
  assert.deepEqual(await settled(page), { slide: 1, shown: ['Click'] });
  await press(page, 'ArrowRight');
  assert.deepEqual(await settled(page), { slide: 1, shown: ['Click', 'Timed one'] });
  await press(page, 'A');
  assert.deepEqual(await settled(page), { slide: 1, shown: ALL });
  assert.deepEqual(page.errors, []);
});

// as in PowerPoint, a slide that moves on by the delay of its last step keeps the look of that
// step through the transition, with the earlier steps dimmed. the fragments are drawn without
// their fade, hence each frame shows the opacity of the step
test('a slide whose last step moves on by a delay keeps the look of its last step until it has left the screen', async (t) => {
  const page = await open(t);
  await page.evaluate(`document.head.insertAdjacentHTML('beforeend', '<style>.reveal .slides section .fragment { transition: none !important; }</style>')`);
  await page.evaluate('Reveal.slide(4, 0, 0)');
  assert.deepEqual(await settled(page), { slide: 4, shown: ['Dims one'] });
  await page.evaluate(`(() => {
    const slide = Reveal.getSlides()[4];
    const [one, two] = ['Dims one', 'Dims two'].map((text) => [...slide.querySelectorAll('.fragment')].find((f) => f.textContent === text));
    window.samples = [];
    const end = performance.now() + 2000;
    const sample = () => {
      if (two.classList.contains('visible')) window.samples.push([one, two].map((f) => Number(getComputedStyle(f).opacity)).join(' '));
      if (performance.now() < end) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  })()`);
  await press(page, 'ArrowRight');
  await page.waitFor('Reveal.getIndices().h === 5', 5000);
  await sleep(1200);
  assert.deepEqual([...new Set(await page.evaluate('window.samples'))], ['0.45 1']);
  assert.deepEqual(page.errors, []);
});

// a key that does not move the deck, e.g. D for the mode, leaves the running delay alone, as a key
// that does nothing to the slideshow in PowerPoint and Keynote. the delay of the slide is 1 s
test('a key that does not move the deck leaves the running delay alone', async (t) => {
  const page = await open(t);
  await page.evaluate(`(() => {
    window.times = {};
    Reveal.on('fragmentshown', (ev) => { for (const f of ev.fragments) window.times[f.textContent] = performance.now(); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'd') window.times.key = performance.now(); }, true);
  })()`);
  await page.evaluate('Reveal.slide(6)');
  await settled(page);
  await press(page, 'ArrowRight');
  await sleep(500);
  await press(page, 'D');
  await page.waitFor(`'Slow timed' in window.times`, 5000);
  const times = await page.evaluate('window.times');
  const key = times.key - times.Slow;
  assert.ok(key > 200 && key < 1000, `the key is pressed during the delay, ${Math.round(key)} ms after its start`);
  // the delay ends 1 s after its start, and a restarted one 1 s after the key
  const shown = times['Slow timed'] - times.Slow;
  assert.ok(shown < 1000 + key / 2, `the timed step is shown ${Math.round(shown)} ms after the step before, with the key at ${Math.round(key)} ms`);
  assert.deepEqual(page.errors, []);
});
