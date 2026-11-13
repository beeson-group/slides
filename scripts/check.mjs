// Renders every slide of a deck in each theme, and fails on any page error.
//
//   node scripts/check.mjs [--browser chrome] [--deck index.html] [--themes dark,light] [--out check]
//
// For each theme, the deck is opened offline at ?theme=<theme>&still#/<h>/<v> once for each slide,
// at 1920 by 1080 px, and saved as <out>/<theme>-<nn>.png, where nn is the number of the slide from
// 01 in reading order. The list of slides is read from the page itself: each top-level section of
// .reveal .slides, or each child of one that is a vertical stack. The deck is then opened without
// `still`, i.e. with its animations, and stepped through to the last fragment of the last slide.
// A page error is an uncaught exception, a console.error, or a failed load, e.g. of a missing file
// or of anything on the network. Finally, the behaviors that a screenshot does not show are checked
// in pages of their own, among them that every video has a poster, which is the still of the video
// in a PDF. The script prints a summary and exits nonzero on any error.
//
// With --browser firefox or --browser safari, the deck is driven over WebDriver. The console is not
// read in these browsers, hence a page error is then what is found in the page, with deckProblems.
// A phone and a pixel ratio cannot be emulated in these browsers, thus they are checked only in Chrome.
// Automation in Safari refuses a page from file://, hence the deck is served from a local port there.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { deckSettled, deckUrl, launch } from './chrome.mjs';
import { figureProblems } from './figures.mjs';
import { launch as launchWebDriver, serve } from './webdriver.mjs';

const { values: options } = parseArgs({
  options: {
    browser: { type: 'string', default: 'chrome' },
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
  ...[...document.images].filter((image) => image.complete && !image.naturalWidth).map((image) => 'image not loaded: ' + image.src),
  ...[...document.fonts].filter((face) => face.status === 'error').map((face) => 'font not loaded: ' + face.family),
  ...[...document.querySelectorAll('[data-mjx-error], mjx-merror')].map((error) => 'formula not typeset: ' + (error.getAttribute('data-mjx-error') ?? error.textContent)),
  ...[...document.querySelectorAll('tycho-viewer')].map((viewer) => viewer.shadowRoot?.querySelector('.status.error')?.textContent).filter(Boolean),
  ...[...document.querySelectorAll('.plot-error')].map((error) => error.textContent),
  ...[...document.querySelectorAll('.qr-error')].map((error) => error.textContent),
  ...performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => /^https?:/.test(name) && !name.startsWith(location.origin)).map((name) => 'network load: ' + name),
]`;

const videosWithoutPoster = `[...document.querySelectorAll('video:not([poster])')]
  .map((video) => video.getAttribute('src') ?? video.querySelector('source')?.getAttribute('src'))`;

mkdirSync(options.out, { recursive: true });
const failures = figureProblems(options.deck);
const browser = await (options.browser === 'chrome' ? launch() : launchWebDriver(options.browser));
const server = options.browser === 'safari' ? await serve(dirname(options.deck)) : null;

function deckAt(query, hash) {
  const url = new URL(deckUrl(options.deck, query, hash));
  return server ? `${server.origin}/${basename(options.deck)}${url.search}${url.hash}` : url.href;
}

async function checkPhone() {
  const page = await browser.newPage({ width: 390, height: 844, mobile: true });
  await page.goto(deckAt());
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
  await page.goto(deckAt('still'));
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
  for (const video of await page.evaluate(videosWithoutPoster)) {
    failures.push(`video without a poster: ${video}, give it a poster attribute, since it is printed in the PDF`);
  }
  await page.close();
}

// a viewport of WebGL is rounded at a device pixel ratio such as 1.25, the display scaling of many
// Windows laptops, and a viewer that overruns its canvas in this way loses its static layers
async function checkScaled() {
  const page = await browser.newPage({ scale: 1.25 });
  await page.goto(deckAt('still'));
  await page.waitFor(deckSettled);
  await page.evaluate(`(() => {
    const viewer = document.querySelector('tycho-viewer');
    if (!viewer) return;
    const { h, v } = Reveal.getIndices(viewer.closest('section'));
    Reveal.slide(h, v);
  })()`);
  await new Promise((done) => setTimeout(done, 1000));
  for (const error of page.errors) failures.push(`scaled: ${error}`);
  await page.close();
}

// the in-place editor, loaded with ?edit: the deck is opened in it, every block of text must be
// paired with the file, and the text written back without an edit must be the file, in every
// browser. A save is written in place only in Chrome and Edge, and it is tested in test/editor.test.mjs
async function checkEditor() {
  const page = await browser.newPage();
  await page.goto(deckAt('edit&still'));
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  const text = readFileSync(options.deck, 'utf8');
  const opened = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(text)})`);
  for (const problem of opened.problems) failures.push(`editor: slide ${problem.slide}, ${problem.tag}: ${problem.reason}`);
  if (opened.blocks && (await page.evaluate('window.BeesonEditor.render()')) !== text) {
    failures.push('editor: the deck written back without an edit differs from the file');
  }
  // a save writes the file in place with the file pickers of Chrome and Edge, and elsewhere it is
  // a download of the file
  console.log(`editor: ${opened.blocks} texts on ${opened.sections} slides, saved ${opened.supported ? 'in place' : 'as a download'}`);
  for (const error of [...page.errors, ...(await page.evaluate(deckProblems))]) failures.push(`editor: ${error}`);
  await page.close();
}

// read during a trace on the first slide with a backdrop that draws a head, since the heads of a
// backdrop are cleared at its end. a head is drawn on the path of a spacecraft, on a record with a
// head of its own, or on every strand with data-heads set to full or small
async function checkHeads() {
  const page = await browser.newPage({ motion: true });
  await page.goto(deckAt());
  await page.waitFor(deckSettled);
  // Safari over WebDriver keeps the reduced motion of the macOS runners of GitHub, under which a
  // backdrop is drawn complete without a trace
  if (await page.evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches`)) {
    console.log('heads: not checked, since the browser prefers reduced motion');
    await page.close();
    return;
  }
  const after = await page.evaluate(`(() => {
    const headed = Beeson.backdrops.find((backdrop) => backdrop.headed);
    if (!headed) return null;
    const { h, v } = Reveal.getIndices(headed.el.closest('section'));
    // a backdrop that is a step is traced only from its step on
    const step = headed.el.closest('.fragment');
    Reveal.slide(h, v, step ? Number(step.dataset.fragmentIndex) : undefined);
    return headed.headAfter;
  })()`);
  if (after !== null) {
    // the first head may be due later in the trace, e.g. at the start of a record of a file,
    // hence the canvas is read every quarter second until 15 s after it is due
    let blank = true;
    for (let i = 0; blank && i < 60 + Math.ceil(4 * after); i++) {
      await new Promise((done) => setTimeout(done, 250));
      blank = await page.evaluate(`(() => {
        const live = Beeson.backdrops.find((backdrop) => backdrop.raf && backdrop.headed);
        if (!live) return true;
        const { width, height } = live.head;
        return !live.head.getContext('2d').getImageData(0, 0, width, height).data.some(Boolean);
      })()`);
    }
    if (blank) failures.push('backdrop: the heads are not painted during a trace');
  }
  await page.close();
}

try {
  for (const theme of themes) {
    for (const file of readdirSync(options.out)) {
      if (file.startsWith(`${theme}-`) && file.endsWith('.png')) rmSync(join(options.out, file));
    }

    const first = await browser.newPage();
    await first.goto(deckAt(`theme=${theme}&still`));
    await first.waitFor(deckSettled);
    const slides = await first.evaluate(listSlides);
    await first.close();

    for (const [n, [h, v]] of slides.entries()) {
      const name = `${theme}-${String(n + 1).padStart(2, '0')}.png`;
      const page = await browser.newPage();
      await page.goto(deckAt(`theme=${theme}&still`, `/${h}/${v}`));
      await page.waitFor(deckSettled);
      const at = await page.evaluate('Reveal.getIndices()');
      if (at.h !== h || (at.v ?? 0) !== v) {
        page.errors.push(`opened at #/${at.h}/${at.v ?? 0}, set hash: true in Reveal.initialize`);
      }
      writeFileSync(join(options.out, name), await page.screenshot());
      for (const error of [...page.errors, ...(await page.evaluate(deckProblems))]) {
        failures.push(`${name} (#/${h}/${v}): ${error}`);
      }
      await page.close();
    }
    console.log(`${theme}: ${slides.length} slides saved to ${options.out}/${theme}-*.png`);

    const animated = await browser.newPage();
    await animated.goto(deckAt(`theme=${theme}`));
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
  if (options.browser === 'chrome') {
    await checkPhone();
    await checkScaled();
  }
  await checkDesktop();
  await checkHeads();
  await checkEditor();
} finally {
  await browser.close();
  server?.close();
}

if (failures.length) {
  console.error(`${failures.length} page errors:`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log('no page errors');
