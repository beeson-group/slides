// Renders every slide of a deck in each theme, and fails on any page error.
//
//   node scripts/check.mjs [--deck index.html] [--themes dark,light] [--out check]
//
// For each theme, the deck is opened offline at ?theme=<theme>&still#/<h>/<v> once for each slide,
// at 1920 by 1080 px, and saved as <out>/<theme>-<nn>.png, where nn is the number of the slide from
// 01 in reading order. The list of slides is read from the page itself: each top-level section of
// .reveal .slides, or each child of one that is a vertical stack. The deck is then opened without
// `still`, i.e. with its animations, and stepped through to the last fragment of the last slide.
// A page error is an uncaught exception, a console.error, or a failed load, e.g. of a missing file
// or of anything on the network. Finally, the behaviors that a screenshot does not show are checked
// in pages of their own. The script prints a summary and exits nonzero on any error.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { deckSettled, deckUrl, launch } from './chrome.mjs';

const { values: options } = parseArgs({
  options: {
    deck: { type: 'string', default: 'index.html' },
    themes: { type: 'string', default: 'dark,light' },
    out: { type: 'string', default: 'check' },
  },
});
const themes = options.themes.split(',');
// delay between two steps of the animated run, in ms
const stepDelay = 250;

const listSlides = `[...document.querySelectorAll('.reveal .slides > section')].flatMap((s, h) => {
  const stack = s.querySelectorAll(':scope > section');
  return stack.length ? [...stack].map((_, v) => [h, v]) : [[h, 0]];
})`;

// what is wrong in a settled page, read from the page itself, hence in every browser
const deckProblems = `[
  ...performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => /^https?:/.test(name)).map((name) => 'network load: ' + name),
]`;

mkdirSync(options.out, { recursive: true });
const failures = [];
const browser = await launch();

async function checkPhone() {
  const page = await browser.newPage({ width: 390, height: 844, mobile: true });
  await page.goto(deckUrl(options.deck));
  await page.waitFor(deckSettled);
  if (await page.evaluate('Reveal.isScrollView()')) failures.push('phone: the scroll view of reveal.js is on');
  const reached = await page.evaluate(`(() => {
    const box = document.querySelector('.theme-switch').getBoundingClientRect();
    const at = document.elementFromPoint(box.x + box.width / 2 - 15, box.y + box.height / 2 + 15);
    return !!at?.closest('.theme-switch');
  })()`);
  if (!reached) failures.push('phone: a tap 15 px from the mode button does not reach it');
  const swiped = await page.evaluate(`(() => {
    const viewer = document.querySelector('tycho-viewer');
    if (!viewer) return false;
    const { h, v } = Reveal.getIndices(viewer.closest('section'));
    Reveal.slide(h, v);
    const drag = (type, clientX) => {
      viewer.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', clientX, clientY: 300, bubbles: true }));
    };
    drag('pointerdown', 300);
    drag('pointermove', 100);
    drag('pointerup', 100);
    return Reveal.getIndices().h !== h;
  })()`);
  if (swiped) failures.push('phone: a drag in the viewer changes the slide');
  for (const error of page.errors) failures.push(`phone: ${error}`);
  await page.close();
}

async function checkDesktop() {
  const page = await browser.newPage();
  await page.goto(deckUrl(options.deck, 'still'));
  await page.waitFor(deckSettled);
  const offset = await page.evaluate(`(() => {
    Reveal.triggerKey(80);
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 400, clientY: 300 }));
    const box = document.querySelector('.pointer-dot').getBoundingClientRect();
    return Math.hypot(box.x + box.width / 2 - 400, box.y + box.height / 2 - 300);
  })()`);
  if (offset > 1) failures.push(`pointer: the dot is ${offset.toFixed(1)} px from the pointer`);
  // a TeX package with a font of its own is loaded at its first macro, from outside
  // output.fontPath, and the formula is returned before this load is finished
  await page.evaluate(String.raw`window.MathJax?.tex2svgPromise('\\ce{H2O}').then(() => true)`);
  await new Promise((done) => setTimeout(done, 1000));
  for (const error of [...page.errors, ...(await page.evaluate(deckProblems))]) failures.push(`behaviors: ${error}`);
  await page.close();
}

// read during a trace, since the heads of a backdrop are cleared at its end
async function checkHeads() {
  const page = await browser.newPage();
  await page.goto(deckUrl(options.deck));
  await page.waitFor(deckSettled);
  await new Promise((done) => setTimeout(done, 1000));
  const blank = await page.evaluate(`(() => {
    const live = Beeson.backdrops.find((backdrop) => backdrop.raf);
    if (!live) return false;
    const { width, height } = live.head;
    return !live.head.getContext('2d').getImageData(0, 0, width, height).data.some(Boolean);
  })()`);
  if (blank) failures.push('backdrop: the heads are not painted during a trace');
  await page.close();
}

try {
  for (const theme of themes) {
    for (const file of readdirSync(options.out)) {
      if (file.startsWith(`${theme}-`) && file.endsWith('.png')) rmSync(join(options.out, file));
    }

    const first = await browser.newPage();
    await first.goto(deckUrl(options.deck, `theme=${theme}&still`));
    await first.waitFor(deckSettled);
    const slides = await first.evaluate(listSlides);
    await first.close();

    for (const [n, [h, v]] of slides.entries()) {
      const name = `${theme}-${String(n + 1).padStart(2, '0')}.png`;
      const page = await browser.newPage();
      await page.goto(deckUrl(options.deck, `theme=${theme}&still`, `/${h}/${v}`));
      await page.waitFor(deckSettled);
      const at = await page.evaluate('Reveal.getIndices()');
      if (at.h !== h || (at.v ?? 0) !== v) {
        page.errors.push(`opened at #/${at.h}/${at.v ?? 0}, set hash: true in Reveal.initialize`);
      }
      writeFileSync(join(options.out, name), await page.screenshot());
      for (const error of page.errors) failures.push(`${name} (#/${h}/${v}): ${error}`);
      await page.close();
    }
    console.log(`${theme}: ${slides.length} slides saved to ${options.out}/${theme}-*.png`);

    const animated = await browser.newPage();
    await animated.goto(deckUrl(options.deck, `theme=${theme}`));
    await animated.waitFor(deckSettled);
    let steps = 1;
    const atEnd = 'Reveal.isLastSlide() && !Reveal.availableFragments().next';
    // the run is ended at the cap in a deck with loop: true
    while (steps < 1000 && !(await animated.evaluate(atEnd))) {
      await animated.evaluate('Reveal.next()');
      await new Promise((done) => setTimeout(done, stepDelay));
      steps += 1;
    }
    await new Promise((done) => setTimeout(done, 1000));
    console.log(`${theme}: ${steps} steps run with animations`);
    for (const error of animated.errors) failures.push(`${theme} animated run: ${error}`);
    await animated.close();
  }
  await checkPhone();
  await checkDesktop();
  await checkHeads();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`${failures.length} page errors:`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log('no page errors');
