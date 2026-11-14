// regression tests of R19.2 on both platforms: the slide of the editor after a show that is ended
// from the tab of Presenter View or from the speaker view by keys or clicks in quick succession

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { press } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const LAST = 12;

let browser;
let server;
before(async () => {
  browser = await launch({ offline: false });
  server = await serve('.');
});
after(async () => {
  await browser?.close();
  server?.close();
});

const js = (v) => JSON.stringify(v);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const within = (page, expression, timeout) => page.waitFor(expression, timeout).then(() => true, () => false);

// the editor on slide n of the demo deck, served over HTTP, with every window that it opens kept
// in window.__shows
async function load(t, platform, n = 0) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/test-deck.html?edit&still&theme=light&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(readFileSync('test-deck.html', 'utf8'))})`);
  assert.deepEqual(s.problems, []);
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await page.evaluate(`(() => { const real = window.open; window.__shows = []; window.open = function (...a) { const w = real.apply(window, a); window.__shows.push(w); return w; }; return true; })()`);
  await frames(page);
  return page;
}

const SHOW = `document.querySelector('.beeson-edit-show iframe')?.contentWindow`;
const TAB = 'window.__shows?.at(-1)';
const ready = (w) => `(() => { try { const w = ${w}; return !!w?.Reveal?.isReady() && (!w.MathJax || (w.MathJax.startup?.promise?.then(() => true) ?? false)); } catch { return false; } })()`;
const stageGone = `!document.querySelector('.beeson-edit-show')`;

async function present(t, platform, n) {
  const page = await load(t, platform, n);
  await press(page, 'Mod+Enter');
  await page.waitFor(ready(SHOW), 20000);
  await sleep(300);
  return page;
}

// the speaker view that s opens in the window w is kept in window.__speakerKept of the page
const SPEAKER = 'window.__speakerKept';
const CURRENT = `${SPEAKER}?.document.querySelector('#current-slide iframe')?.contentWindow`;
const keepSpeaker = (w) => `(() => { const w = ${w}; const real = w.open; w.open = function (...a) { const v = real.apply(w, a); window.__speakerKept = v; return v; }; return true; })()`;

// clickIn clicks the primary button on the heading of the current slide of the deck in the window
// w. scripts/chrome.mjs does not send input to the speaker view or to a tab, hence the events of
// the click are dispatched in them
const clickIn = (w) => `(() => {
  const w = ${w};
  const el = w.Reveal.getCurrentSlide().querySelector('h1, h2') ?? w.Reveal.getCurrentSlide();
  const r = el.getBoundingClientRect();
  const o = { bubbles: true, cancelable: true, composed: true, clientX: r.left + 8, clientY: r.top + r.height / 2, button: 0, isPrimary: true, pointerId: 1 };
  el.dispatchEvent(new w.PointerEvent('pointerdown', o));
  el.dispatchEvent(new w.PointerEvent('pointerup', o));
  el.dispatchEvent(new w.MouseEvent('click', o));
  return true;
})()`;
const keyIn = (w, key, keyCode) => `(${w}.document.dispatchEvent(new KeyboardEvent('keydown', { key: ${js(key)}, keyCode: ${keyCode}, bubbles: true, cancelable: true })), true)`;

async function openSpeaker(page, w) {
  await page.evaluate(keepSpeaker(w));
  await press(page, 's');
  await page.waitFor(ready(CURRENT), 20000);
  await sleep(1200);
}

// toStepEnd moves the deck in the window w to the last step of slide n
const toStepEnd = (w, n) => `(() => { const R = ${w}.Reveal; R.slide(${n}); while (R.availableFragments().next) R.nextFragment(); return R.availableFragments().next === false; })()`;
// twice gives the window w two forward keys or two clicks at once, the first onto the last slide
// and the second past its last step
const twice = (w, how) => `(() => { for (let i = 0; i < 2; i++) ${how === 'click' ? clickIn(w) : keyIn(w, 'ArrowRight', 39)}; return true; })()`;

// D3: Presenter View ended from its tab left the editor on the slide before the last one when the
// last two keys or clicks came before the next poll of the display, which ignored the state that
// the tab posts with its end
const DISPLAY = `!!document.querySelector('dialog.beeson-edit-presenter[open]')`;
for (const platform of PLATFORMS) {
  test(`Presenter View ended by two quick keys or clicks in its tab leaves the editor on the last slide (${platform})`, async (t) => {
    for (const how of ['key', 'click']) {
      const page = await load(t, platform, LAST - 1);
      await press(page, 'Alt+Enter');
      await page.waitFor(`${DISPLAY} && ${ready(TAB)}`, 20000);
      await sleep(1200);
      assert.equal(await page.evaluate(toStepEnd(TAB, LAST - 1)), true);
      await page.waitFor(`/Slide 12 of/.test(document.querySelector('dialog.beeson-edit-presenter').textContent)`, 5000);
      await sleep(1200);
      assert.equal(await page.evaluate('Reveal.getIndices().h'), LAST - 1);
      await page.evaluate(twice(TAB, how));
      assert.ok(await within(page, `!${DISPLAY}`, 5000), `two ${how}s in the tab do not end the show`);
      assert.equal(await page.evaluate('Reveal.getIndices().h'), LAST, `two quick ${how}s leave the editor on another slide than the last`);
      assert.deepEqual(errors(page), []);
    }
  });
}

// D4: Present ended from the speaker view left the editor on an earlier slide when the keys came
// less than 500 ms apart, since the show posted its own state, which the speaker view updates
// after a delay, in place of the state of the speaker view
for (const platform of PLATFORMS) {
  test(`Present ended by two quick keys or clicks in the speaker view leaves the editor on the slide that the speaker view showed last (${platform})`, async (t) => {
    for (const how of ['key', 'click']) {
      const page = await present(t, platform, LAST - 1);
      // the speaker view sets the show to the state of its frame when it connects
      await openSpeaker(page, SHOW);
      assert.equal(await page.evaluate(toStepEnd(SHOW, LAST - 1)), true);
      assert.ok(await within(page, `(() => { try { const R = ${CURRENT}.Reveal; return R.getIndices().h === ${LAST - 1} && !R.availableFragments().next; } catch { return false; } })()`, 3000), 'the speaker view is not at the last step of slide 12');
      await page.evaluate(twice(CURRENT, how));
      assert.ok(await within(page, stageGone, 5000), `two ${how}s in the speaker view do not end the show`);
      assert.equal(await page.evaluate('Reveal.getIndices().h'), LAST, `two quick ${how}s leave the editor on another slide than the last`);
      assert.deepEqual(errors(page), []);
    }
  });
}
