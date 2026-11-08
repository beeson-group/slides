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
  await page.goto(deckUrl('index.html', `theme=${theme}`));
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

test('every animation of a slide plays on after a flip of the mode, with the key d or the button', { timeout: 180000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ motion: true });
  await page.goto(deckUrl('index.html', 'theme=dark'));
  await page.waitFor(deckSettled);
  const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
  const count = await page.evaluate('Reveal.getTotalSlides()');
  const kinds = new Set();
  for (let i = 0; i < count; i++) {
    await page.evaluate(`Reveal.slide(${i}, 0, 99)`);
    await sleep(800);
    let before = await page.evaluate(animations);
    if (!before.length) continue;
    for (const [how, flip] of Object.entries(flips)) {
      const theme = await page.evaluate('Beeson.theme.get()');
      assert.ok(await page.evaluate(flip), `slide ${i + 1}: the flip with the ${how} is a view transition`);
      // the flip takes 450 ms, and an animation is read again after its end
      await sleep(1000);
      assert.notEqual(await page.evaluate('Beeson.theme.get()'), theme);
      const after = await page.evaluate(animations);
      const name = `slide ${i + 1}, after a flip with the ${how}`;
      assert.deepEqual(after.map((a) => a.kind), before.map((a) => a.kind), `${name}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
      after.forEach((a, k) => {
        if (!a.ended) assert.notEqual(a.at, before[k].at, `${name}: the ${a.kind} is not advanced`);
        kinds.add(a.kind);
      });
      before = after;
    }
  }
  // the demo deck has an animation of each kind
  assert.deepEqual([...kinds].sort(), ['backdrop', 'plot', 'scene', 'surface', 'video']);
  assert.deepEqual(page.errors, []);
});
