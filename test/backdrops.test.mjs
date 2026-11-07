// check of the backdrops of the demo deck, in Chrome: a drawing may run off the slide, but it is not
// cut at an edge of its box inside the slide

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';
import { scene } from '../src/scenes.ts';

const boxes = `[...document.querySelectorAll('.backdrop[data-scene]')].map((b) => {
  const cs = getComputedStyle(b), px = (name) => parseFloat(cs[name]);
  return {
    name: b.closest('section').querySelector('h1, h2').textContent,
    scene: b.dataset.scene, cx: +b.dataset.cx, cy: +b.dataset.cy, half: +b.dataset.half,
    left: px('left'), top: px('top'), width: px('width'), height: px('height'),
  };
})`;

// the sides of the box crossed by the strands, in the projection of Orbits. the function is also
// run in the page, hence it does not use anything outside its body
function cuts(box, strands) {
  const slide = { width: 1920, height: 1080 };
  const scale = box.height / 2 / box.half,
    found = new Set();
  for (const s of strands) {
    for (let i = 0; i < s.pts.length; i += 2) {
      const x = (s.pts[i] - box.cx) * scale + box.width / 2,
        y = -(s.pts[i + 1] - box.cy) * scale + box.height / 2;
      if (x < 0 && box.left > 0) found.add('left');
      if (x > box.width && box.left + box.width < slide.width) found.add('right');
      if (y < 0 && box.top > 0) found.add('top');
      if (y > box.height && box.top + box.height < slide.height) found.add('bottom');
    }
  }
  return [...found].join(' ');
}

// a backdrop of a file is fitted when its slide is shown, hence each slide is shown before its
// window is read
const filed = `(async () => {
  const out = [];
  for (const b of Beeson.backdrops.filter((b) => b.el.dataset.strands !== undefined)) {
    const section = b.el.closest('section'), { h, v } = Reveal.getIndices(section);
    Reveal.slide(h, v);
    await b.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const cs = getComputedStyle(b.el), px = (name) => parseFloat(cs[name]);
    const box = { ...b.view, left: px('left'), top: px('top'), width: px('width'), height: px('height') };
    const name = section.querySelector('h1, h2, .foot').textContent;
    out.push([name, b.el.dataset.strands, b.strands.length, (${cuts})(box, b.strands)]);
  }
  return out;
})()`;

test('no backdrop is cut at an edge of its box inside the slide', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('index.html', 'still'));
  await page.waitFor(deckSettled);

  const cropped = (await page.evaluate(boxes))
    .map((b) => [b.name, b.scene, cuts(b, scene(b.scene))])
    .filter((b) => b[2]);
  assert.deepEqual(cropped, []);

  const files = await page.evaluate(filed);
  assert.ok(files.length > 0);
  assert.deepEqual(
    files.filter(([, , count, cut]) => !count || cut),
    [],
  );
});
