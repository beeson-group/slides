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
  await page.goto(deckUrl('test-deck.html', 'still'));
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
  const page = await browser.newPage({ motion: true });
  await page.goto(deckUrl('test-deck.html'));
  await page.waitFor(deckSettled);
  // the title slide draws brand/transfer.js, whose spiral carries a head of its own from the start
  await new Promise((done) => setTimeout(done, 800));
  const [titleRunning, titlePixels] = await page.evaluate(headPixels);
  assert.ok(titleRunning, 'the backdrop of the title slide is traced');
  assert.ok(titlePixels > 5 && titlePixels < 60, `${titlePixels} pixels on the title slide`);

  const slideTo = (selector) => `(() => {
    const { h, v } = Reveal.getIndices(document.querySelector('${selector}').closest('section'));
    Reveal.slide(h, v);
  })()`;
  // the wide ribbon has neither a spacecraft nor data-heads, hence no head
  await page.evaluate(slideTo('.backdrop[data-scene="wideRibbon"]'));
  await new Promise((done) => setTimeout(done, 800));
  const [ribbonRunning, ribbonPixels] = await page.evaluate(headPixels);
  assert.ok(ribbonRunning, 'the wide ribbon is traced');
  assert.equal(ribbonPixels, 0);
});

// the alpha of the pixels of rows from to to of the backdrop of the current slide, with its head
// canvas over its base canvas, read in one task, i.e. without a frame drawn between the two reads
const alphas = (from, to) => `(() => {
  const b = Beeson.backdrops.find((o) => Reveal.getCurrentSlide().contains(o.el));
  const c = document.createElement('canvas');
  c.width = b.base.width;
  c.height = b.base.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(b.base, 0, 0);
  ctx.drawImage(b.head, 0, 0);
  const { data } = ctx.getImageData(0, ${from}, c.width, ${to - from});
  return Array.from({ length: ${to - from} }, (_, r) => Array.from({ length: c.width }, (_, x) => data[4 * (r * c.width + x) + 3]));
})()`;
// the pixels of values more than 3 off their most common value. a strand stroked in pieces is beaded
// at every joint, i.e. at dozens of pixels of a row, while the software rasterizer of Chrome, on the
// Linux and Windows runners, may leave a pixel of a long line lighter by up to about 25
const outliers = (values) => {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const mode = [...counts].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  return values.filter((v) => Math.abs(v - mode) > 3).length;
};
// the row of rows with the most ink, i.e. the center of a horizontal strand
const center = (rows) => rows.reduce((best, row, r) => (row.reduce((a, b) => a + b) > rows[best].reduce((a, b) => a + b) ? r : best), 0);

// the page traces two straight strands at an opacity of 0.6 in 2 s, the second with a glow, from
// x = 96 px to 1824 px on the rows y = 324 px and 756 px. a strand stroked in pieces, one per frame,
// is beaded at the joints of the pieces, and the glow of the pieces adds up
test('a strand is traced in one stroke, hence without beads, and its trace ends on its still', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ motion: true });
  await page.goto(deckUrl('test/pages/trace.html'));
  await page.waitFor(deckSettled);
  await page.evaluate('Reveal.slide(1)');
  await new Promise((done) => setTimeout(done, 900));
  const [plain, glowing] = await page.evaluate(`[${alphas(310, 340)}, ${alphas(735, 780)}]`);
  await page.waitFor('Beeson.backdrops[0].done', 10000);
  await new Promise((done) => setTimeout(done, 100));
  const [plainStill, glowingStill] = await page.evaluate(`[${alphas(310, 340)}, ${alphas(735, 780)}]`);

  const row = plain[center(plain)];
  const end = row.findLastIndex((a) => a > 0);
  assert.ok(end > 400 && end < 1600, `the trace has reached x = ${end} px after 0.9 s of 2 s`);
  assert.ok(outliers(row.slice(150, end - 20)) <= 2, `the alpha along the strand is off at ${outliers(row.slice(150, end - 20))} pixels`);
  const still = plainStill[center(plainStill)];
  assert.ok(outliers(still.slice(150, 1770)) <= 2, `the alpha along the still is off at ${outliers(still.slice(150, 1770))} pixels`);

  // a row of the glow 4 px off the strand, behind the head
  const r = center(glowing) + 4;
  const off = glowing[r].slice(150, glowing[center(glowing)].findLastIndex((a) => a > 0) - 40).map((a, x) => Math.abs(a - glowingStill[r][150 + x]));
  assert.ok(glowing[r][300] > 0, 'the glow is drawn 4 px off the strand');
  assert.ok(Math.max(...off) <= 3, `the glow during the trace is off its still by up to ${Math.max(...off)}`);

  // the drawing left by the trace is the still drawn after it
  const changed = await page.evaluate(`(() => {
    const b = Beeson.backdrops[0], ctx = b.base.getContext('2d');
    const before = ctx.getImageData(0, 0, b.base.width, b.base.height).data;
    b.redraw();
    const after = ctx.getImageData(0, 0, b.base.width, b.base.height).data;
    let n = 0;
    for (let i = 0; i < before.length; i++) if (Math.abs(before[i] - after[i]) > 1) n++;
    return n;
  })()`);
  assert.equal(changed, 0);
});

// the third slide of the page traces three crossing strands in 2 s, which are finished in the
// reverse of the order of their file. the frames are drawn by frame() at 60 per second on a clock
// of the test, up to 4 ms before the end of the trace, when the violet strand is 3.5 px short of
// its end, and then once after the end, when the still is drawn
test('the last frame of a trace is its still, with the strands overlapped in the order of the file', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ motion: true });
  await page.goto(deckUrl('test/pages/trace.html'));
  await page.waitFor(deckSettled);
  await page.evaluate('Reveal.slide(2)');
  await page.waitFor('Beeson.backdrops.some((o) => Reveal.getCurrentSlide().contains(o.el) && o.strands.length === 3 && o.W > 0)');
  const out = await page.evaluate(`(() => {
    const b = Beeson.backdrops.find((o) => Reveal.getCurrentSlide().contains(o.el));
    // the base canvas is read through a copy, since Chrome may move a canvas read with
    // getImageData from the GPU to the CPU, where its glows are blurred differently by one level
    const read = () => {
      const c = document.createElement('canvas');
      c.width = b.W;
      c.height = b.H;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(b.base, 0, 0);
      return ctx.getImageData(0, 0, b.W, b.H).data;
    };
    b.reset();
    b.t0 = 0;
    for (let k = 0; k < 120; k++) b.frame((1000 * k) / 60);
    b.frame(1996);
    const traced = b.finished, last = read();
    b.frame(2001);
    const still = read();
    // the head of the violet strand is at x = 1820.5 px, at the scale of 1080 px per unit. the
    // pixels are compared premultiplied, within 8 of 255. the software rasterizer of Chrome, on the
    // Linux and Windows runners, draws a line and its glow differently by up to 6 when its length
    // changes, while the two orders of two strands at their crossing differ by up to about 55
    const premultiplied = (d, i, c) => (c === 3 ? d[i + 3] : (d[i + c] * d[i + 3]) / 255);
    let changed = 0, near = 0;
    for (let i = 0; i < last.length; i += 4) {
      if ([0, 1, 2, 3].every((c) => Math.abs(premultiplied(last, i, c) - premultiplied(still, i, c)) <= 8)) continue;
      const x = (i / 4) % b.W, y = Math.floor(i / 4 / b.W);
      if (Math.hypot(x - 1824, y - 540) < 16) near++;
      else changed++;
    }
    return { traced, finished: b.finished, changed, near };
  })()`);
  assert.equal(out.traced, false, 'the trace is not finished 4 ms before its end');
  assert.equal(out.finished, true);
  assert.equal(out.changed, 0, `${out.changed} pixels away from the head are changed from the last frame to the still`);
  assert.ok(out.near > 0, 'the end of the violet strand is drawn in the still');
});

test('the strands of a backdrop with data-stagger are started one after another', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ motion: true });
  await page.goto(deckUrl('test-deck.html'));
  await page.waitFor(deckSettled);
  const stagger = await page.evaluate(`(() => {
    const el = document.querySelector('.backdrop[data-stagger]');
    const { h, v } = Reveal.getIndices(el.closest('section'));
    Reveal.slide(h, v);
    return +el.dataset.stagger;
  })()`);
  // the clock is taken from the start of the first strand, which a slow runner may delay
  const staggered = `Beeson.backdrops.find((b) => b.el.hasAttribute('data-stagger'))`;
  await page.waitFor(`${staggered}.idx[0] > 0`);
  await new Promise((done) => setTimeout(done, 1300));
  const started = await page.evaluate(`${staggered}.idx.map((j) => j > 0)`);
  const count = started.filter(Boolean).length;
  // the strands are started in the order of the file, hence the started ones come first
  assert.deepEqual(started, started.map((_, i) => i < count));
  assert.ok(count >= 2 && count <= Math.ceil(1.6 / stagger) + 1, `${count} of ${started.length} strands started`);
});

// the fourth slide of the page has a straight strand of three points, 864 px apart. the tint at the
// pointer is the disc of the strands within its radius, hence it reaches the radius on both sides of
// the pointer and does not run past it, with the pointer on a point of the strand and between points
test('the tint at the pointer is a disc of its radius', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('test/pages/trace.html'));
  await page.waitFor(deckSettled);
  await page.evaluate('Reveal.slide(3)');
  await page.waitFor('Beeson.backdrops.some((o) => Reveal.getCurrentSlide().contains(o.el) && o.W > 0)');
  for (const at of [0, 0.3]) {
    const tint = await page.evaluate(`(() => {
      const b = Beeson.backdrops.find((o) => Reveal.getCurrentSlide().contains(o.el));
      b.complete();
      const box = b.el.getBoundingClientRect();
      b.glow(box.left + (b.X(${at}) / b.W) * box.width, box.top + (b.Y(0) / b.H) * box.height, 30);
      const { x, y, r } = b.pointer;
      const c = document.createElement('canvas');
      c.width = b.W;
      c.height = b.H;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(b.head, 0, 0);
      const d = ctx.getImageData(0, 0, b.W, b.H).data;
      let far = 0, left = Infinity, right = -Infinity;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const px = (i / 4) % b.W, py = Math.floor(i / 4 / b.W);
        far = Math.max(far, Math.hypot(px + 0.5 - x, py + 0.5 - y));
        left = Math.min(left, px - x);
        right = Math.max(right, px + 1 - x);
      }
      return { r, far, left, right };
    })()`);
    const where = `with the pointer at x = ${at}, the tint of radius ${tint.r} px`;
    assert.ok(tint.far <= tint.r + 2, `${where} reaches ${tint.far.toFixed(1)} px from the pointer`);
    assert.ok(tint.left <= -tint.r + 2 && tint.right >= tint.r - 2, `${where} runs along the strand from ${tint.left} px to ${tint.right} px`);
  }
});

// a backdrop that is a step of its slide is hidden and left untraced until its step is shown, and it
// is reset when the step is hidden again
test('a backdrop that is a step is traced from its step on', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ motion: true });
  await page.goto(deckUrl('test/pages/title-step.html'));
  await page.waitFor(deckSettled);
  const state = `(() => {
    const b = Beeson.backdrops[0];
    return { tracing: b.tracing, done: b.done, opacity: getComputedStyle(b.el).opacity };
  })()`;
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  await wait(600);
  assert.deepEqual(await page.evaluate(state), { tracing: false, done: false, opacity: '0' });

  await page.evaluate('Reveal.next()');
  await wait(600);
  assert.deepEqual(await page.evaluate(state), { tracing: true, done: false, opacity: '1' });

  await page.evaluate('Reveal.prev()');
  await wait(600);
  assert.deepEqual(await page.evaluate(state), { tracing: false, done: false, opacity: '0' });
});

// the hooks of the editor: Beeson.remount draws a backdrop again from its attributes in place of
// its drawing, Beeson.preview draws a div outside the slides without taking it into
// Beeson.backdrops, and Beeson.fitWindow gives the window of a drawing fitted to the box
test('Beeson.remount, Beeson.preview, and Beeson.fitWindow draw a backdrop for the editor', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('test-deck.html', 'still'));
  await page.waitFor(deckSettled);
  const out = await page.evaluate(`(async () => {
    const el = document.querySelector('.backdrop[data-scene="nest"]');
    const { h, v } = Reveal.getIndices(el.closest('section'));
    Reveal.slide(h, v);
    const before = Beeson.backdrops.find((b) => b.el === el).strands.length;
    el.dataset.scene = 'tubes';
    const o = Beeson.remount(el);
    await o.ready;
    const after = Beeson.backdrops.filter((b) => b.el === el);
    const div = document.createElement('div');
    div.style.cssText = 'position: fixed; left: 0; top: 0; width: 192px; height: 108px';
    div.dataset.scene = 'nest';
    div.dataset.half = '0.5';
    div.dataset.cx = '0.97';
    document.body.append(div);
    const p = Beeson.preview(div);
    await p.ready;
    const count = Beeson.backdrops.length;
    const inked = (() => { const c = p.canvases[0], d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; })();
    const fitted = await Beeson.fitWindow(el);
    p.destroy();
    return { before, entries: after.length, same: after[0] === o, strands: o.strands.length, done: o.done, canvases: el.querySelectorAll(':scope > canvas').length, previewIn: Beeson.backdrops.includes(p), count, inked, fitted };
  })()`);
  assert.equal(out.entries, 1);
  assert.equal(out.same, true);
  assert.ok(out.strands > out.before, `${out.strands} strands of tubes, ${out.before} of nest`);
  assert.equal(out.done, true);
  assert.equal(out.canvases, 2);
  assert.equal(out.previewIn, false);
  assert.ok(out.inked > 100, `${out.inked} pixels of the preview are drawn`);
  assert.ok(out.fitted && out.fitted.half > 0 && Number.isFinite(out.fitted.cx), JSON.stringify(out.fitted));
});
