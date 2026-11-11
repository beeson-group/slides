// checks of the videos of src/video.ts in Chrome, on the slides of test/pages/video-play.html: a
// clip of the fragment style play, shown with its poster and started at its step, two clips of a
// plate of the class row started together, two clips in one place, the second shown over the first,
// and a clip in a fragment that appears at its step. Each step is read 600 ms after it is shown,
// after the fades of 400 ms

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';

const DECK = 'test/pages/video-play.html';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// the state of each video of the current slide, by its id
const videos = `Object.fromEntries([...Reveal.getCurrentSlide().querySelectorAll('video')].map((video) => {
  const style = getComputedStyle(video);
  return [video.id, {
    playing: !video.paused,
    time: video.currentTime,
    opacity: style.opacity,
    visibility: style.visibility,
    covered: video.hasAttribute('data-covered'),
  }];
}))`;

async function open(t, hash) {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl(DECK, '', hash));
  await page.waitFor(deckSettled);
  return {
    page,
    // moves by one step, next or prev, and reads the videos after the fades
    async move(where) {
      await page.evaluate(`Reveal.${where}()`);
      await sleep(600);
      return page.evaluate(videos);
    },
  };
}

test('a video of the style play shows its poster until its step, and it is played from its step on without being dimmed', { timeout: 60000 }, async (t) => {
  const { page, move } = await open(t, '/0');
  const before = await page.evaluate(videos);
  assert.deepEqual(before.play, { playing: false, time: 0, opacity: '1', visibility: 'visible', covered: false });
  assert.equal((await move('next')).play.playing, false, 'the step before its own');
  const own = await move('next');
  assert.equal(own.play.playing, true, 'its step');
  const later = await move('next');
  assert.ok(later.play.playing && later.play.time > own.play.time, 'it is not restarted at a later step');
  assert.equal(later.play.opacity, '1');
  await move('prev');
  const undone = await move('prev');
  assert.deepEqual(undone.play, { playing: false, time: 0, opacity: '1', visibility: 'visible', covered: false });
  assert.deepEqual(page.errors, []);
});

// the second clip is held back on a local port, and the first one is held at its first frame until
// the second one can be played. Both are then started in one task
test('two videos of one step are started together, also when one of them is loaded later', { timeout: 60000 }, async (t) => {
  const server = await serve('.', { delay: (path) => (path.endsWith('clip-light.mp4') ? 3000 : 0) });
  const browser = await launch({ offline: false });
  t.after(async () => {
    await browser.close();
    server.close();
  });
  const page = await browser.newPage();
  // the load event of a page waits for its videos, hence the step is made before it
  await page.send('Page.navigate', { url: `${server.origin}/${DECK}#/1` });
  await page.waitFor('!!window.Reveal?.isReady?.()');
  await page.evaluate('Reveal.next()');
  await sleep(1000);
  const held = await page.evaluate(`[left, right].map((video) => [video.readyState, video.paused, video.currentTime])`);
  // HAVE_FUTURE_DATA is 3
  if (held[1][0] < 3) assert.deepEqual(held[0].slice(1), [true, 0], 'the first clip waits for the second');
  await page.waitFor('!left.paused && !right.paused', 15000);
  await sleep(500);
  const [left, right] = await page.evaluate('[left.currentTime, right.currentTime]');
  assert.ok(left > 0.2 && Math.abs(left - right) < 0.05, `the clips are at ${left} s and ${right} s`);
  // the plate of the class row puts the clips side by side, in two equal shares
  const [a, b] = await page.evaluate(`[left, right].map((video) => video.getBoundingClientRect().toJSON())`);
  assert.ok(a.right <= b.left && a.top === b.top && a.width === b.width && a.height === b.height, JSON.stringify([a, b]));
  assert.deepEqual(page.errors, []);
});

test('a video shown in the place of another covers it, and the one under it is paused until the step is undone', { timeout: 60000 }, async (t) => {
  const { page, move } = await open(t, '/2');
  const boxes = await page.evaluate(`[first, second].map((video) => JSON.stringify(video.getBoundingClientRect()))`);
  assert.equal(boxes[0], boxes[1], 'the clips are stacked in one place');
  let seen = await move('next');
  assert.equal(seen.first.playing, true);
  assert.equal(seen.second.visibility, 'hidden');
  seen = await move('next');
  assert.deepEqual(seen.first, { playing: false, time: 0, opacity: '1', visibility: 'hidden', covered: true });
  assert.equal(seen.second.playing, true);
  assert.equal(seen.second.visibility, 'visible');
  seen = await move('prev');
  assert.deepEqual(seen.second, { playing: false, time: 0, opacity: '0', visibility: 'hidden', covered: false });
  assert.ok(seen.first.playing && !seen.first.covered && seen.first.visibility === 'visible' && seen.first.time < 1, 'the first clip is started again');
  seen = await move('prev');
  assert.deepEqual(seen.first, { playing: false, time: 0, opacity: '1', visibility: 'visible', covered: false });
  assert.deepEqual(page.errors, []);
});

test('a video in a fragment is played from its step on, and it does not call for the step that restores the dimmed fragments', { timeout: 60000 }, async (t) => {
  const { page, move } = await open(t, '/3');
  assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelector('[data-restore]')`), null);
  assert.equal((await page.evaluate(videos)).inside.playing, false);
  assert.equal((await move('next')).inside.playing, true);
  const later = await move('next');
  assert.equal(later.inside.playing, true);
  assert.equal(await page.evaluate(`getComputedStyle(inside.parentElement).opacity`), '1');
  await move('prev');
  const undone = await move('prev');
  assert.equal(undone.inside.playing, false);
  assert.equal(undone.inside.time, 0);
  assert.deepEqual(page.errors, []);
});

// the pages of the four slides: five with the step added to restore the dimmed paragraph, two, three, and three
test('the print view shows each video of a step, with the video under a later one hidden', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await printView(page, deckUrl(DECK, 'print-pdf'));
  const shown = await page.evaluate(`[...document.querySelectorAll('.pdf-page')].map((page) => [...page.querySelectorAll('video')]
    .filter((video) => getComputedStyle(video).visibility !== 'hidden').map((video) => video.id).join(' '))`);
  assert.deepEqual(shown, [
    'play', 'play', 'play', 'play', 'play',
    'left right', 'left right',
    'first', 'first', 'second',
    '', 'inside', 'inside',
  ]);
});
