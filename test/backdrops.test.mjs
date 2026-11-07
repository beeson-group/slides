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

// the number of painted pixels of the head canvas of the backdrop of the current slide, read during
// its trace
const headPixels = `(() => {
  const b = Beeson.backdrops.find((o) => Reveal.getCurrentSlide().contains(o.el));
  const { width, height } = b.head;
  const data = b.head.getContext('2d').getImageData(0, 0, width, height).data;
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]) n++;
  return [b.raf > 0, n];
})()`;

test('a head is drawn on the path of a spacecraft alone', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('index.html'));
  await page.waitFor(deckSettled);
  await new Promise((done) => setTimeout(done, 800));
  const [titleRunning, titlePixels] = await page.evaluate(headPixels);
  assert.ok(titleRunning, 'the backdrop of the title slide is traced');
  assert.equal(titlePixels, 0);

  await page.evaluate(`(() => {
    const { h, v } = Reveal.getIndices(document.querySelector('.backdrop[data-scene="transfer"]').closest('section'));
    Reveal.slide(h, v);
  })()`);
  await new Promise((done) => setTimeout(done, 1500));
  const [running, pixels] = await page.evaluate(headPixels);
  assert.ok(running, 'the transfer is traced');
  // a disk of 2.2 line widths of 1 px, and its antialiased rim
  assert.ok(pixels > 5 && pixels < 60, `${pixels} pixels`);
});

test('the strands of a backdrop with data-stagger are started one after another', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('index.html'));
  await page.waitFor(deckSettled);
  const stagger = await page.evaluate(`(() => {
    const el = document.querySelector('.backdrop[data-stagger]');
    const { h, v } = Reveal.getIndices(el.closest('section'));
    Reveal.slide(h, v);
    return +el.dataset.stagger;
  })()`);
  await new Promise((done) => setTimeout(done, 1300));
  const started = await page.evaluate(`Beeson.backdrops.find((b) => b.el.hasAttribute('data-stagger')).idx.map((j) => j > 0)`);
  const count = started.filter(Boolean).length;
  // the strands are started in the order of the file, hence the started ones come first
  assert.deepEqual(started, started.map((_, i) => i < count));
  assert.ok(count >= 2 && count <= Math.ceil(1.6 / stagger) + 1, `${count} of ${started.length} strands started`);
});
