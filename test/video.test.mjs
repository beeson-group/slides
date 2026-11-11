// checks of the videos of src/video.ts in Chrome, on the slides of test/pages/video-play.html: a
// clip of the fragment style play, shown with its poster and started at its step, two clips of a
// plate of the class row started together, two clips in one place, the second shown over the first,
// and a clip in a fragment that appears at its step. After a step, each state is waited for rather
// than read after a fixed time, since the fades of 400 ms and the rewinds after them are late on a
// busy runner

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';

const DECK = 'test/pages/video-play.html';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// the state of the video of an id
const stateOf = (id) => `(() => {
  const video = document.getElementById('${id}'), style = getComputedStyle(video);
  return {
    playing: !video.paused,
    time: video.currentTime,
    opacity: style.opacity,
    visibility: style.visibility,
    covered: video.hasAttribute('data-covered'),
  };
})()`;

/** Waits until the video of the id has the given values of its state, and fails with the values it has after 15 s. */
async function until(page, id, expected) {
  const matches = `(() => { const state = ${stateOf(id)}; return Object.entries(${JSON.stringify(expected)}).every(([key, value]) => state[key] === value); })()`;
  await page.waitFor(matches).catch(() => {});
  const state = await page.evaluate(stateOf(id));
  assert.deepEqual(Object.fromEntries(Object.keys(expected).map((key) => [key, state[key]])), expected, id);
  return state;
}

async function open(t, hash) {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl(DECK, '', hash));
  await page.waitFor(deckSettled);
  return page;
}

// a page served from a local port asks for its icon, which the folder does not have
const errorsOf = (page) => page.errors.filter((error) => !error.includes('/favicon.ico'));

test('a video of the style play shows its poster until its step, and it is played from its step on without being dimmed', { timeout: 120000 }, async (t) => {
  const page = await open(t, '/0');
  const poster = { playing: false, time: 0, opacity: '1', visibility: 'visible', covered: false };
  await until(page, 'play', poster);
  // a video that can be played is started in the task of its step, hence it is read at once
  await page.evaluate('Reveal.next()');
  await until(page, 'play', { playing: false, time: 0 });
  await page.evaluate('Reveal.next()');
  await until(page, 'play', { playing: true });
  await page.waitFor(`play.currentTime > 0.2`);
  const before = await page.evaluate('play.currentTime');
  await page.evaluate('Reveal.next()');
  assert.ok(await page.evaluate('play.currentTime') >= before, 'it is not restarted at a later step');
  await sleep(600);
  await until(page, 'play', { playing: true, opacity: '1' });
  await page.evaluate('Reveal.prev()');
  await page.evaluate('Reveal.prev()');
  await until(page, 'play', poster);
  assert.deepEqual(page.errors, []);
});

// the second clip is held back on a local port, and the first one is held at its first frame until
// the second one can be played. Both are then started in one task
test('two videos of one step are started together, also when one of them is loaded later', { timeout: 120000 }, async (t) => {
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
  await page.waitFor('!left.paused && !right.paused && left.currentTime > 0.2', 30000);
  // within three frames of the clips at 30 frames per second
  const [left, right] = await page.evaluate('[left.currentTime, right.currentTime]');
  assert.ok(Math.abs(left - right) < 0.1, `the clips are at ${left} s and ${right} s`);
  // the plate of the class row puts the clips side by side, in two equal shares
  const [a, b] = await page.evaluate(`[left, right].map((video) => video.getBoundingClientRect().toJSON())`);
  assert.ok(a.right <= b.left && a.top === b.top && a.width === b.width && a.height === b.height, JSON.stringify([a, b]));
  assert.deepEqual(errorsOf(page), []);
});

test('a video shown in the place of another covers it, and the one under it is paused until the step is undone', { timeout: 120000 }, async (t) => {
  const page = await open(t, '/2');
  const boxes = await page.evaluate(`[first, second].map((video) => JSON.stringify(video.getBoundingClientRect()))`);
  assert.equal(boxes[0], boxes[1], 'the clips are stacked in one place');
  await page.evaluate('Reveal.next()');
  await until(page, 'first', { playing: true });
  await until(page, 'second', { playing: false, visibility: 'hidden' });
  await page.evaluate('Reveal.next()');
  await until(page, 'second', { playing: true, visibility: 'visible', covered: false });
  await until(page, 'first', { playing: false, time: 0, visibility: 'hidden', covered: true });
  await page.evaluate('Reveal.prev()');
  await until(page, 'second', { playing: false, time: 0, opacity: '0', visibility: 'hidden' });
  const again = await until(page, 'first', { playing: true, visibility: 'visible', covered: false });
  assert.ok(again.time < 1, `the first clip is started again from its start, at ${again.time} s`);
  await page.evaluate('Reveal.prev()');
  await until(page, 'first', { playing: false, time: 0, opacity: '1', visibility: 'visible', covered: false });
  assert.deepEqual(page.errors, []);
});

test('a video in a fragment is played from its step on, and it does not call for the step that restores the dimmed fragments', { timeout: 120000 }, async (t) => {
  const page = await open(t, '/3');
  assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelector('[data-restore]')`), null);
  await until(page, 'inside', { playing: false });
  await page.evaluate('Reveal.next()');
  await until(page, 'inside', { playing: true });
  await page.evaluate('Reveal.next()');
  await until(page, 'inside', { playing: true });
  // a dimmed zone would not come back to full opacity
  await page.waitFor(`getComputedStyle(inside.parentElement).opacity === '1'`).catch(() => {});
  assert.equal(await page.evaluate(`getComputedStyle(inside.parentElement).opacity`), '1');
  await page.evaluate('Reveal.prev()');
  await page.evaluate('Reveal.prev()');
  await until(page, 'inside', { playing: false, time: 0 });
  assert.deepEqual(page.errors, []);
});

// the pages of the four slides: five with the step added to restore the dimmed paragraph, two, three, and three
test('the print view shows each video of a step, with the video under a later one hidden', { timeout: 120000 }, async (t) => {
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
