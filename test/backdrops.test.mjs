// check of the backdrops of the demo deck, in Chrome: a drawing may run off the slide, but it is not
// cut at an edge of its box inside the slide

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';
import { scene } from '../src/scenes.ts';

const SLIDE = { width: 1920, height: 1080 };

const boxes = `[...document.querySelectorAll('.backdrop')].map((b) => {
  const cs = getComputedStyle(b), px = (name) => parseFloat(cs[name]);
  return {
    name: b.closest('section').querySelector('h1, h2').textContent,
    scene: b.dataset.scene, cx: +b.dataset.cx, cy: +b.dataset.cy, half: +b.dataset.half,
    left: px('left'), top: px('top'), width: px('width'), height: px('height'),
  };
})`;

// the sides of the box crossed by the strands of its scene, in the projection of Orbits
function cuts(box) {
  const scale = box.height / 2 / box.half, found = new Set();
  for (const s of scene(box.scene)) {
    for (let i = 0; i < s.pts.length; i += 2) {
      const x = (s.pts[i] - box.cx) * scale + box.width / 2, y = -(s.pts[i + 1] - box.cy) * scale + box.height / 2;
      if (x < 0 && box.left > 0) found.add('left');
      if (x > box.width && box.left + box.width < SLIDE.width) found.add('right');
      if (y < 0 && box.top > 0) found.add('top');
      if (y > box.height && box.top + box.height < SLIDE.height) found.add('bottom');
    }
  }
  return [...found];
}

test('no backdrop is cut at an edge of its box inside the slide', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('index.html', 'still'));
  await page.waitFor(deckSettled);

  const cropped = (await page.evaluate(boxes)).map((b) => [b.name, b.scene, cuts(b).join(' ')]).filter((b) => b[2]);
  assert.deepEqual(cropped, []);
});
