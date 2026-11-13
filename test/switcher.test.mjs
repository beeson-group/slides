// check of the mode flip on the built deck, in Chrome

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
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

// the flip is skipped under reduced motion, which is the setting of the macOS and Windows runners
// of GitHub
const motion = `{
  const query = window.matchMedia;
  window.matchMedia = (q) => (q.includes('reduced-motion') ? { matches: false } : query.call(window, q));
}`;

async function openDeck(t, theme) {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('test-deck.html', `theme=${theme}`));
  await page.waitFor(deckSettled);
  await page.evaluate(motion);
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

// a scene whose marks are drawn for one background keeps the theme written in the file
test('a viewer with data-keep-theme keeps its theme through a flip of the mode', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('test/pages/viewer-steps.html', 'theme=dark'));
  await page.waitFor(deckSettled);
  const themes = await page.evaluate(`(async () => {
    const viewer = document.querySelector('tycho-viewer');
    const flip = async (mode) => { Beeson.theme.set(mode); await new Promise((done) => setTimeout(done, 1500)); };
    viewer.setAttribute('data-keep-theme', '');
    await flip('light');
    const kept = [Beeson.theme.get(), viewer.getAttribute('theme')];
    viewer.removeAttribute('data-keep-theme');
    await flip('dark');
    await flip('light');
    return [kept, [Beeson.theme.get(), viewer.getAttribute('theme')]];
  })()`);
  assert.deepEqual(themes, [['light', 'dark'], ['light', 'light']]);
});

// the animations of the current slide, each with whether it plays and how far it is: the points
// traced by a backdrop, the azimuth of a surface, the frame of a plot, the time of a video, and the
// step of a tycho scene. a traced backdrop is counted as playing once every strand is traced to its
// end, and a backdrop shown complete at once is not
const animations = `(() => {
  const slide = Reveal.getCurrentSlide();
  const on = (list) => list.filter((x) => slide.contains(x.el));
  const ended = (o) => !o.loop && o.strands.every((s, k) => o.idx[k] >= s.times.length - 1);
  return [
    ...on(Beeson.backdrops).map((o) => ({ kind: 'backdrop', playing: !!o.raf || ended(o), at: o.loop ? performance.now() - o.t0 : o.idx.reduce((a, j) => a + j, 0), ended: ended(o) })),
    ...on(Beeson.surfaces).map((s) => ({ kind: 'surface', playing: !!s.raf, at: s.azimuth })),
    ...on(Beeson.plots).map((p) => ({ kind: 'plot', playing: p.playing, at: p.frame })),
    ...[...slide.querySelectorAll('video')].map((v) => ({ kind: 'video', playing: !v.paused, at: v.currentTime })),
    ...[...slide.querySelectorAll('tycho-viewer')].map((v) => ({ kind: 'scene', playing: !!v.store?.playing, at: v.store?.index })),
  ].filter((a) => a.playing);
})()`;

// a flip with the key d, or with a click on the button. the classes of the flip show that it runs
// as a view transition, and it is not skipped
const flips = {
  key: `(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', keyCode: 68, which: 68, bubbles: true }));
    return document.documentElement.matches('.to-dark, .to-light');
  })()`,
  click: `(() => {
    const button = document.querySelector('.theme-switch'), b = button.getBoundingClientRect();
    button.dispatchEvent(new MouseEvent('click', { detail: 1, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, bubbles: true }));
    return document.documentElement.matches('.to-dark, .to-light');
  })()`,
};

test('every animation of a slide plays on after a flip of the mode, with the key d or the button', { timeout: 600000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ motion: true });
  const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
  const kinds = new Set();
  let longest = { ms: 0, at: '' };
  // the demo deck does not have a plot, hence a plot is taken from a test deck
  for (const deck of ['test-deck.html', 'test/pages/plot-reveals.html']) {
    await page.goto(deckUrl(deck, 'theme=dark'));
    await page.waitFor(deckSettled);
    const count = await page.evaluate(`document.querySelectorAll('.reveal .slides > section').length`);
    for (let i = 0; i < count; i++) {
      await page.evaluate(`Reveal.slide(${i}, 0, 99)`);
      await sleep(800);
      let before = await page.evaluate(animations);
      if (!before.length) continue;
      for (const [how, flip] of Object.entries(flips)) {
        const theme = await page.evaluate('Beeson.theme.get()');
        assert.ok(await page.evaluate(flip), `${deck}, slide ${i + 1}: the flip with the ${how} is a view transition`);
        // the flip takes 450 ms, but the mode is set only once the old view is captured, over a second
        // later on a slow runner. the end of the flip is thus waited for, and an animation is read
        // again after it. a slow runner may hold a video for a moment, hence the animations are read
        // until each has advanced, for up to 5 s
        const flipped = `Beeson.theme.get() !== '${theme}' && !document.documentElement.matches('.to-dark, .to-light')`;
        const started = Date.now();
        if (!(await page.waitFor(flipped, 60000).then(() => true, () => false))) {
          // on a Windows runner, a flip did not end in 15 s, and on two loaded cores a frame of a
          // surface in software took 2.4 s, hence a flip has 60 s. the state of the page is printed
          // for a flip that does not end, with the time until its next animation frame
          const state = await page.evaluate(`(async () => {
            const t0 = performance.now();
            const frame = await Promise.race([
              new Promise((done) => requestAnimationFrame(() => done(Math.round(performance.now() - t0)))),
              new Promise((done) => setTimeout(() => done('none in 3 s'), 3000)),
            ]);
            return { theme: Beeson.theme.get(), classes: document.documentElement.className, visibility: document.visibilityState, frame, transition: !!document.activeViewTransition };
          })()`);
          assert.fail(`${deck}, slide ${i + 1}: the flip with the ${how} did not end in 60 s: ${JSON.stringify(state)}, with ${JSON.stringify(before)}`);
        }
        if (Date.now() - started > longest.ms) longest = { ms: Date.now() - started, at: `${deck}, slide ${i + 1}, ${how}, ${before.map((a) => a.kind).join(' ')}` };
        let after = await page.evaluate(animations);
        for (let wait = 0; wait < 5000 && after.some((a, k) => !a.ended && a.at === before[k]?.at); wait += 250) {
          await sleep(250);
          after = await page.evaluate(animations);
        }
        const name = `${deck}, slide ${i + 1}, after a flip with the ${how}`;
        assert.deepEqual(after.map((a) => a.kind), before.map((a) => a.kind), `${name}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
        after.forEach((a, k) => {
          if (!a.ended) assert.notEqual(a.at, before[k].at, `${name}: the ${a.kind} is not advanced`);
          kinds.add(a.kind);
        });
        before = after;
      }
    }
  }
  t.diagnostic(`the longest flip took ${longest.ms} ms: ${longest.at}`);
  // the two decks have an animation of each kind
  assert.deepEqual([...kinds].sort(), ['backdrop', 'plot', 'scene', 'surface', 'video']);
  assert.deepEqual(page.errors, []);
});

// the rows of pixels of a PNG written by Chrome, with 8 bits per channel and without interlace
function decodePng(png) {
  let at = 8, width = 0, height = 0, channels = 4;
  const data = [];
  while (at < png.length) {
    const length = png.readUInt32BE(at), kind = png.toString('ascii', at + 4, at + 8), body = png.subarray(at + 8, at + 8 + length);
    if (kind === 'IHDR') ({ width, height, channels } = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), channels: body[9] === 6 ? 4 : 3 });
    if (kind === 'IDAT') data.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data)), stride = width * channels, px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[y * stride + x - channels] : 0, b = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= channels && y ? px[(y - 1) * stride + x - channels] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      px[y * stride + x] = raw[y * (stride + 1) + 1 + x] + [0, a, b, (a + b) >> 1, paeth][filter];
    }
  }
  return { width, channels, px };
}

// a flip with the key d, held at the given ms of its clock. the circle of the flip is read from the
// clip of the upper view of the root, and the box of the backdrop of the slide is returned with it
const heldFlip = (ms) => `(async () => {
  const root = document.documentElement;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', keyCode: 68, which: 68, bubbles: true }));
  let flip = [];
  while (!flip.length) {
    await new Promise(requestAnimationFrame);
    flip = root.getAnimations({ subtree: true }).filter((a) => a.effect?.pseudoElement?.startsWith('::view-transition'));
  }
  for (const a of flip) { a.pause(); a.currentTime = ${ms}; }
  await new Promise(requestAnimationFrame);
  const toLight = root.classList.contains('to-light');
  const [r, x, y] = getComputedStyle(root, toLight ? '::view-transition-new(root)' : '::view-transition-old(root)').clipPath.match(/[\\d.]+/g).map(Number);
  const box = Reveal.getCurrentSlide().querySelector('.backdrop').getBoundingClientRect();
  return { toLight, r, x, y, box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom } };
})()`;

// in a flip, the old view is shown inside the circle on a flip to dark and outside it on a flip to
// light. a traced backdrop is to be drawn on in both views, rather than held still under the old
// view for up to 450 ms. the backdrop is read in two screenshots 500 ms apart while the flip is held
// at 100 ms, when most of the slide is in the old view, and the pixels within 20 px of the circle
// are left out
test('a traced backdrop is drawn on under the old view of a flip, in both directions', { timeout: 120000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ motion: true });
  await page.goto(deckUrl('test-deck.html', 'theme=dark'));
  await page.waitFor(deckSettled);
  const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
  const index = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('.backdrop[data-strands="demo/broucke-sample.js"]'))`);
  assert.ok(index > 0, 'test-deck.html does not have a slide with the backdrop of demo/broucke-sample.js after its first slide');
  for (const to of ['light', 'dark']) {
    // the trace is begun again on the slide, and several strands are traced after 1.5 s
    await page.evaluate(`Reveal.slide(${index - 1})`);
    await sleep(300);
    await page.evaluate(`Reveal.slide(${index})`);
    await sleep(1500);
    const flip = await page.evaluate(heldFlip(100));
    assert.equal(flip.toLight, to === 'light');
    const before = decodePng(await page.screenshot());
    const { left, top, right, bottom } = flip.box;
    // the pixels of the backdrop that differ between two screenshots, under each view
    const count = (after) => {
      const changed = { old: 0, new: 0 };
      for (let y = Math.max(0, Math.ceil(top)); y < bottom; y++) {
        for (let x = Math.max(0, Math.ceil(left)); x < Math.min(right, before.width); x++) {
          const d = Math.hypot(x - flip.x, y - flip.y);
          if (Math.abs(d - flip.r) < 20) continue;
          const k = (y * before.width + x) * before.channels;
          const diff = Math.abs(before.px[k] - after.px[k]) + Math.abs(before.px[k + 1] - after.px[k + 1]) + Math.abs(before.px[k + 2] - after.px[k + 2]);
          if (diff > 12) changed[(d < flip.r) === flip.toLight ? 'new' : 'old']++;
        }
      }
      return changed;
    };
    // a screenshot is taken each 500 ms until the old view is changed, for 10 s at most, since a
    // loaded machine did not draw a frame of the trace in the first 500 ms
    let changed = { old: 0, new: 0 };
    for (let n = 0; n < 20 && !changed.old; n++) {
      await sleep(500);
      changed = count(decodePng(await page.screenshot()));
    }
    await page.evaluate(`document.documentElement.getAnimations({ subtree: true }).forEach((a) => a.effect?.pseudoElement && a.finish())`);
    assert.ok(changed.old > 0, `slide ${index + 1}, a flip to ${to}: of the pixels of the backdrop, ${changed.new} are changed in 10 s under the new view and ${changed.old} under the old view`);
  }
  assert.deepEqual(page.errors, []);
});
