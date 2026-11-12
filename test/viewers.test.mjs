// checks of the tycho viewers of src/viewers.ts in Chrome, on the slides of test/pages/viewer-play.html:
// a kiosk viewer of the fragment style play, held at its first frame and started at its step, two
// viewers of a plate of the class row started together, and a viewer in a zone of the style play.
// The pages are shown without reduced motion, under which the runtime starts a kiosk viewer once
// its scene is loaded, so that the hold before the step is checked. After a step, each state is
// waited for rather than read after a fixed time. The tests share one Chrome, and each closes its
// page, as the tests of the videos do

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';

const DECK = 'test/pages/viewer-play.html';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

let browser;

before(async () => {
  browser = await launch();
});

after(async () => {
  await browser?.close();
});

async function open(t, hash) {
  const page = await browser.newPage({ motion: true });
  t.after(() => page.close());
  await page.goto(deckUrl(DECK, '', hash));
  await page.waitFor(deckSettled);
  await page.waitFor(`[...Reveal.getCurrentSlide().querySelectorAll('tycho-viewer')].every((viewer) => viewer.state)`);
  return page;
}

// the state of the viewer of an id: whether its clock runs, the time of its scene in s, and its opacity
const stateOf = (id) => `(() => {
  const viewer = document.getElementById('${id}');
  return { playing: viewer.playing, time: viewer.time, opacity: getComputedStyle(viewer).opacity };
})()`;

/** Waits until the viewer of the id has the given values of its state, and fails with the values it has after 15 s. */
async function until(page, id, expected) {
  const matches = `(() => { const state = ${stateOf(id)}; return Object.entries(${JSON.stringify(expected)}).every(([key, value]) => state[key] === value); })()`;
  await page.waitFor(matches).catch(() => {});
  const state = await page.evaluate(stateOf(id));
  const seen = Object.fromEntries(Object.keys(expected).map((key) => [key, state[key]]));
  if (JSON.stringify(seen) !== JSON.stringify(expected)) {
    assert.deepEqual(seen, expected, `${id}: ${JSON.stringify({ ...state, indices: await page.evaluate('Reveal.getIndices()') })}`);
  }
  return state;
}

test('a kiosk viewer of the style play holds the first frame of its scene until its step, and is played from its start at it', { timeout: 120000 }, async (t) => {
  const page = await open(t, '/0');
  const held = { playing: false, time: 0, opacity: '1' };
  // the runtime starts a kiosk viewer once its scene is loaded, and the viewer is held again
  await until(page, 'play', held);
  await sleep(500);
  await until(page, 'play', held);
  await page.evaluate('Reveal.next()');
  await until(page, 'play', held);
  await page.evaluate('Reveal.next()');
  await until(page, 'play', { playing: true });
  await page.waitFor('play.time > 0.2');
  const before = await page.evaluate('play.time');
  await page.evaluate('Reveal.next()');
  assert.ok(await page.evaluate('play.time') >= before, 'it is not restarted at a later step');
  await sleep(600);
  await until(page, 'play', { playing: true, opacity: '1' });
  await page.evaluate('Reveal.prev()');
  await page.evaluate('Reveal.prev()');
  await until(page, 'play', held);
  assert.deepEqual(page.errors, []);
});

test('two viewers of one step are started together, side by side in a plate of the class row', { timeout: 120000 }, async (t) => {
  const page = await open(t, '/1');
  await until(page, 'left', { playing: false, time: 0 });
  await until(page, 'right', { playing: false, time: 0 });
  await page.evaluate('Reveal.next()');
  await page.waitFor('left.playing && right.playing && left.time > 0.2');
  // within three frames at 60 frames per second
  const [left, right] = await page.evaluate('[left.time, right.time]');
  assert.ok(Math.abs(left - right) < 0.05, `the scenes are at ${left} s and ${right} s`);
  const [a, b] = await page.evaluate(`[left, right].map((viewer) => viewer.getBoundingClientRect().toJSON())`);
  assert.ok(a.right <= b.left && a.top === b.top && a.width === b.width && a.height === b.height && a.height > 300, JSON.stringify([a, b]));
  await page.evaluate('Reveal.prev()');
  await until(page, 'left', { playing: false, time: 0 });
  await until(page, 'right', { playing: false, time: 0 });
  assert.deepEqual(page.errors, []);
});

test('a viewer in a fragment of the style play is not dimmed at a later step, and it is held at its first frame when its slide is left', { timeout: 120000 }, async (t) => {
  const page = await open(t, '/2');
  assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelector('[data-restore]')`), null);
  await until(page, 'inside', { playing: false, time: 0 });
  await page.evaluate('Reveal.next()');
  await until(page, 'inside', { playing: true });
  await page.evaluate('Reveal.next()');
  await until(page, 'inside', { playing: true });
  await page.waitFor(`getComputedStyle(inside.parentElement).opacity === '1'`).catch(() => {});
  assert.equal(await page.evaluate(`getComputedStyle(inside.parentElement).opacity`), '1');
  await page.waitFor('inside.time > 0.2');
  // a viewer that is left would be resumed where it stopped when its slide is shown again
  await page.evaluate('Reveal.slide(1)');
  await until(page, 'inside', { playing: false, time: 0 });
  // the first step of the slide, which reveal.js numbers from 0
  await page.evaluate('Reveal.slide(2, 0, 0)');
  await until(page, 'inside', { playing: true });
  assert.ok(await page.evaluate('inside.time') < 1, 'it is played again from its start');
  assert.deepEqual(page.errors, []);
});

// the pages of the three slides: five with the step added to restore the dimmed paragraph, two, and three
test('the print view shows the still of each viewer of the style play on every step of its slide, in the box of its viewer', { timeout: 120000 }, async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await printView(page, deckUrl(DECK, 'print-pdf&still'));
  // a still is shown at full opacity when its box and every element up to its slide are, i.e. no fragment around it is dimmed
  const stills = await page.evaluate(`[...document.querySelectorAll('.pdf-page')].map((p) => [...p.querySelectorAll('img[alt="A still of a tycho scene"]')]
    .filter((image) => { for (let e = image.parentElement; e && e.localName !== 'section'; e = e.parentElement) {
      const style = getComputedStyle(e);
      if (style.opacity !== '1' || style.visibility === 'hidden') return false;
    } return true; })
    .map((image) => { const box = image.parentElement.getBoundingClientRect(), r = image.getBoundingClientRect();
      return r.width > 100 && r.height > 100 && r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1 ? Math.round(r.left) : -1; }))`);
  assert.deepEqual(stills.map((page) => page.length), [1, 1, 1, 1, 1, 2, 2, 1, 1, 1]);
  assert.ok(stills.flat().every((left) => left >= 0), `a still lies outside the box of its viewer: ${JSON.stringify(stills)}`);
  const [left, right] = stills[5];
  assert.ok(left < right, 'the two stills of the plate are side by side');
});
