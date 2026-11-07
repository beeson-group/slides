// check of the mode flip on the built deck, in Chrome

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';

// the clip of the old view is read with the clock of the flip held at its end, since a sample of
// real frames would depend on the frame rate of the machine
const clipAtEnd = `(async () => {
  const root = document.documentElement;
  const view = '::view-transition-old(root)';
  Beeson.theme.set('dark');
  let flip;
  while (!flip) {
    await new Promise(requestAnimationFrame);
    flip = root.getAnimations({ subtree: true }).find((a) => a.effect?.pseudoElement === view);
  }
  flip.pause();
  flip.currentTime = flip.effect.getComputedTiming().endTime;
  const clip = getComputedStyle(root, view).clipPath;
  flip.finish();
  return clip;
})()`;

// the clip of the new view is read when the ready promise of the view transition resolves, before
// any script of the theme can run. in Firefox and Zen, a script animation started from this promise
// is not applied in the first frame, hence a clip set later leaves one frame of the whole new view
const clipAtReady = `(async () => {
  const start = document.startViewTransition.bind(document);
  let clip;
  document.startViewTransition = (update) => {
    const flip = start(update);
    clip = flip.ready.then(() => getComputedStyle(document.documentElement, '::view-transition-new(root)').clipPath);
    return flip;
  };
  Beeson.theme.set('light');
  return clip;
})()`;

async function openDeck(t, theme) {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('index.html', `theme=${theme}`));
  await page.waitFor(deckSettled);
  return page;
}

test('the old light view stays clipped at the end of a flip to dark', { timeout: 60000 }, async (t) => {
  const page = await openDeck(t, 'light');

  assert.match(await page.evaluate(clipAtEnd), /^circle\(0px/);
});

test('the new light view is clipped from the start of a flip to light', { timeout: 60000 }, async (t) => {
  const page = await openDeck(t, 'dark');

  assert.match(await page.evaluate(clipAtReady), /^circle\(0px/);
});
