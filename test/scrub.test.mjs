// checks of the scrubber of the progress line (src/scrub.ts) and of full screen
// (src/fullscreen.ts) on the demo deck, in Chrome

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';

async function openDeck(t, query = '') {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('index.html', query));
  await page.waitFor(deckSettled);
  const mouse = (type, x, y) => page.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });
  const key = (code, k) => page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: code, key: k })
    .then(() => page.send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: code, key: k }));
  return { page, mouse, key };
}

// the pacing of a talk is cleared, since the checks below are written for a deck without one
const unpaced = `Reveal.getSlides().forEach((s) => delete s.dataset.timing); Reveal.configure({ totalTime: null, defaultTiming: null })`;

const look = `(() => {
  const bar = getComputedStyle(document.querySelector('.reveal .progress'));
  const band = getComputedStyle(document.querySelector('.reveal .scrub'));
  return { height: bar.height, opacity: bar.opacity, color: getComputedStyle(document.querySelector('.reveal .progress span')).backgroundColor, band: band.visibility };
})()`;

test('the progress line is left as drawn until the mouse is near the bottom of the window', { timeout: 60000 }, async (t) => {
  const { page, mouse } = await openDeck(t);
  const before = await page.evaluate(look);
  assert.equal(before.height, '3px');
  assert.equal(before.band, 'hidden');

  await mouse('mouseMoved', 960, 500);
  assert.deepEqual(await page.evaluate(look), before);
  assert.equal(await page.evaluate(`document.querySelector('.reveal').classList.contains('scrubbing')`), false);

  await mouse('mouseMoved', 960, 1075);
  assert.equal(await page.evaluate(`document.querySelector('.reveal').classList.contains('scrubbing')`), true);
  assert.equal((await page.evaluate(look)).band, 'visible');

  await mouse('mouseMoved', 960, 700);
  assert.deepEqual(await page.evaluate(look), before);
});

// the controls of a tycho viewer at the bottom of a slide end about 100 px above the bottom of the
// window, inside the band. the band is opened 40 px above the bottom edge, before the pointer reaches
// the edge, where macOS shows a hidden Dock over the window
test('the band is opened near the bottom edge, and kept open over the band', { timeout: 60000 }, async (t) => {
  const { page, mouse } = await openDeck(t);
  const scrubbing = `document.querySelector('.reveal').classList.contains('scrubbing')`;
  await mouse('mouseMoved', 960, 1020);
  assert.equal(await page.evaluate(scrubbing), false);
  await mouse('mouseMoved', 960, 1040);
  assert.equal(await page.evaluate(scrubbing), true);
  await mouse('mouseMoved', 960, 1000);
  assert.equal(await page.evaluate(scrubbing), true);
});

test('the band has a tick labeled with the number of each numbered slide', { timeout: 60000 }, async (t) => {
  const { page, mouse } = await openDeck(t);
  await page.evaluate(unpaced);
  await mouse('mouseMoved', 960, 1075);
  const labels = await page.evaluate(`[...document.querySelectorAll('.scrub-tick')].map((t) => t.firstChild.textContent)`);
  const total = await page.evaluate('Reveal.getTotalSlides()');
  assert.deepEqual(labels, Array.from({ length: total }, (_, i) => String(i + 1)));
  assert.equal(await page.evaluate(`document.querySelectorAll('.scrub-time').length`), 0);
});

test('a click on a tick shows its slide at its first step', { timeout: 60000 }, async (t) => {
  const { page, mouse } = await openDeck(t);
  await mouse('mouseMoved', 960, 1075);
  const target = await page.evaluate(`(() => {
    const ticks = [...document.querySelectorAll('.scrub-tick')];
    const slides = Reveal.getSlides();
    const i = slides.findIndex((s, i) => i > 1 && s.querySelector('.fragment'));
    const box = document.querySelector('.scrub').getBoundingClientRect();
    return { i, h: Reveal.getIndices(slides[i]).h, x: box.left + box.width * parseFloat(ticks[i].style.left) / 100, title: document.querySelector('.scrub-card').textContent };
  })()`);
  assert.ok(target.i > 1, 'the demo deck has a slide with steps after the second');

  await mouse('mouseMoved', target.x, 1075);
  assert.ok(await page.evaluate(`document.querySelectorAll('.scrub-tick')[${target.i}].classList.contains('hover')`));
  assert.notEqual(await page.evaluate(`document.querySelector('.scrub-card').textContent`), '');
  await mouse('mousePressed', target.x, 1075);
  await mouse('mouseReleased', target.x, 1075);
  await page.waitFor(`Reveal.getIndices().h === ${target.h}`);
  assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelectorAll('.fragment.visible').length`), 0);
  assert.ok(await page.evaluate(`document.querySelectorAll('.scrub-tick')[${target.i}].classList.contains('now')`));
});

test('a key closes the band', { timeout: 60000 }, async (t) => {
  const { page, mouse, key } = await openDeck(t);
  await mouse('mouseMoved', 960, 1075);
  await key(39, 'ArrowRight');
  assert.equal(await page.evaluate(`document.querySelector('.reveal').classList.contains('scrubbing')`), false);
});

test('the start time of each slide is shown with totalTime, as in the speaker view', { timeout: 60000 }, async (t) => {
  const { page, mouse } = await openDeck(t);
  const total = await page.evaluate('Reveal.getTotalSlides()');
  await page.evaluate(unpaced);
  await page.evaluate(`Reveal.getSlides()[1].dataset.timing = '90'; Reveal.configure({ totalTime: ${90 + 60 * (total - 1)} })`);
  await mouse('mouseMoved', 960, 1075);
  const times = await page.evaluate(`[...document.querySelectorAll('.scrub-time')].map((t) => t.textContent)`);
  assert.deepEqual(times.slice(0, 4), ['0:00', '1:00', '2:30', '3:30']);
  assert.equal(times.length, total);
});

// requestFullscreen is replaced with a count, since the full screen of headless Chrome does not
// change the size of the window
const counted = `(() => {
  window.calls = { enter: 0, exit: 0 };
  let full = null;
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => full });
  document.documentElement.requestFullscreen = () => { calls.enter++; full = document.documentElement; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
  document.exitFullscreen = () => { calls.exit++; full = null; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
})()`;

test('F enters full screen and leaves it', { timeout: 60000 }, async (t) => {
  const { page, key } = await openDeck(t);
  await page.evaluate(counted);
  await key(70, 'f');
  assert.deepEqual(await page.evaluate('calls'), { enter: 1, exit: 0 });
  await key(70, 'f');
  assert.deepEqual(await page.evaluate('calls'), { enter: 1, exit: 1 });
});

// the window is made to cover the screen with the toolbar shown, as a Safari window in the full
// screen of macOS
const systemFull = (on) => `(() => {
  for (const [k, v] of Object.entries({ outerWidth: 1920, outerHeight: ${on ? 1080 : 1000}, innerHeight: 1000 })) Object.defineProperty(window, k, { configurable: true, value: v });
  for (const [k, v] of Object.entries({ width: 1920, height: 1080 })) Object.defineProperty(screen, k, { configurable: true, value: v });
  window.dispatchEvent(new Event('resize'));
})()`;

test('a window in the full screen of the system is taken into full screen at the next key', { timeout: 60000 }, async (t) => {
  const { page, key } = await openDeck(t);
  await page.evaluate(counted);
  await page.evaluate(systemFull(true));
  await key(39, 'ArrowRight');
  assert.deepEqual(await page.evaluate('calls'), { enter: 1, exit: 0 });

  // after the page leaves full screen, e.g. with Esc, the window is not taken back into it
  await page.evaluate('document.exitFullscreen()');
  await page.evaluate(systemFull(true));
  await key(39, 'ArrowRight');
  assert.deepEqual(await page.evaluate('calls'), { enter: 1, exit: 1 });

  // until the window has left the full screen of the system and entered it again
  await page.evaluate(systemFull(false));
  await page.evaluate(systemFull(true));
  await key(37, 'ArrowLeft');
  assert.deepEqual(await page.evaluate('calls'), { enter: 2, exit: 1 });
});

test('a window that does not cover the screen is not taken into full screen', { timeout: 60000 }, async (t) => {
  const { page, key } = await openDeck(t);
  await page.evaluate(counted);
  await page.evaluate(systemFull(false));
  await key(39, 'ArrowRight');
  assert.deepEqual(await page.evaluate('calls'), { enter: 0, exit: 0 });
});

test('the title, section, and closing slides are not numbered, and the slides after the closing slide are numbered A1, A2', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('test/pages/numbers.html'));
  await page.waitFor(deckSettled);
  const numbers = await page.evaluate(`(async () => {
    const out = [];
    for (let i = 0; i < document.querySelectorAll('.reveal .slides > section').length; i += 1) {
      Reveal.slide(i);
      await new Promise((done) => setTimeout(done, 50));
      out.push(document.querySelector('.reveal .slide-number').textContent.replace(/\\s+/g, ' ').trim());
    }
    return out;
  })()`);
  assert.deepEqual(numbers, ['', '', '1 / 3', '2 / 3', '', '3 / 3', '', 'A1', 'A2']);

  // the band has a tick for each numbered slide only
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 960, y: 1075, button: 'none' });
  const labels = await page.evaluate(`[...document.querySelectorAll('.scrub-tick')].map((t) => t.firstChild.textContent)`);
  assert.deepEqual(labels, ['1', '2', '3']);

  // the running head of a slide after the closing slide names the appendix
  const runs = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].map((s) => s.querySelector('.run')?.textContent ?? '')`);
  assert.deepEqual(runs, ['', '', 'Chapter one', 'Chapter one', '', 'Chapter two', '', 'Appendix slides', 'Appendix slides']);
});

// the title of the hovered slide is shown in full, with the descenders of g and y inside its box
test('the title over the band is not cut at its descenders', { timeout: 60000 }, async (t) => {
  const { page, mouse } = await openDeck(t);
  await mouse('mouseMoved', 960, 1075);
  const room = await page.evaluate(`(() => {
    const card = document.querySelector('.scrub-card');
    card.textContent = 'gyp';
    const mark = document.createElement('span');
    mark.style.cssText = 'display: inline-block; width: 0; height: 0';
    card.append(mark);
    const baseline = mark.getBoundingClientRect().top;
    const style = getComputedStyle(card);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = style.fontStyle + ' ' + style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
    const descent = ctx.measureText('gyp').actualBoundingBoxDescent;
    return card.getBoundingClientRect().bottom - (baseline + descent);
  })()`);
  assert.ok(room >= 0, `the descenders run ${-room} px past the bottom of the title`);
});
