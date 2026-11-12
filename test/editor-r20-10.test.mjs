// regression tests of R20.10 on both platforms: the end of Present from the frame of the upcoming
// slide of the speaker view (F15), the speaker view of the tab of Presenter View at the end of the
// show (F16), and E in this tab (F17)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { press } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const LAST = 11;

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
  const url = `${server.origin}/index.html?edit&still&theme=light&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(readFileSync('index.html', 'utf8'))})`);
  assert.deepEqual(s.problems, []);
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await page.evaluate(`(() => { const real = window.open; window.__shows = []; window.open = function (...a) { const w = real.apply(window, a); window.__shows.push(w); return w; }; return true; })()`);
  await frames(page);
  return page;
}

const SHOW = `document.querySelector('.beeson-edit-show iframe')?.contentWindow`;
const TAB = 'window.__shows?.at(-1)';
const DISPLAY = `!!document.querySelector('dialog.beeson-edit-presenter[open]')`;
const ready = (w) => `(() => { try { const w = ${w}; return !!w?.Reveal?.isReady() && (!w.MathJax || (w.MathJax.startup?.promise?.then(() => true) ?? false)); } catch { return false; } })()`;
const stageGone = `!document.querySelector('.beeson-edit-show')`;

// the speaker view that the window w opens is kept in window.__speakerKept of the page
const SPEAKER = 'window.__speakerKept';
const CURRENT = `${SPEAKER}?.document.querySelector('#current-slide iframe')?.contentWindow`;
const UPCOMING = `${SPEAKER}?.document.querySelector('#upcoming-slide iframe')?.contentWindow`;
const keepSpeaker = (w) => `(() => { const w = ${w}; const real = w.open; w.open = function (...a) { const v = real.apply(w, a); window.__speakerKept = v; return v; }; return true; })()`;
const speakerClosed = `(() => { try { return ${SPEAKER}.closed; } catch { return true; } })()`;
const keyIn = (w, key, keyCode) => `(() => { const w = ${w}; w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: ${js(key)}, keyCode: ${keyCode}, bubbles: true, cancelable: true })); return true; })()`;
const KEYS = [['Escape', 27], ['e', 69]];

// F15: the frame of the upcoming slide of the speaker view is one step ahead of the show, and a key
// that ended Present there gave the editor the state of this frame in place of the state of the show
for (const platform of PLATFORMS) {
  test(`Esc or E in the frame of the upcoming slide of the speaker view ends Present on the slide shown (${platform})`, async (t) => {
    for (const [key, keyCode] of KEYS) {
      const page = await load(t, platform, 4);
      await press(page, 'Mod+Enter');
      await page.waitFor(ready(SHOW), 20000);
      await sleep(300);
      await page.evaluate(keepSpeaker(SHOW));
      await press(page, 's');
      await page.waitFor(`${ready(CURRENT)} && ${ready(UPCOMING)}`, 20000);
      await sleep(1200);
      await page.evaluate(`(() => { const R = ${SHOW}.Reveal; R.slide(4); while (R.availableFragments().next) R.nextFragment(); return true; })()`);
      assert.ok(await within(page, `(() => { try { return ${UPCOMING}.Reveal.getIndices().h === 5 && ${CURRENT}.Reveal.getIndices().h === 4; } catch { return false; } })()`, 5000), 'the speaker view does not show slide 6 as upcoming');
      await sleep(600);
      await page.evaluate(keyIn(UPCOMING, key, keyCode));
      assert.ok(await within(page, stageGone, 5000), `${key} in the upcoming frame does not end the show`);
      assert.equal(await page.evaluate('Reveal.getIndices().h'), 4, `${key} in the upcoming frame leaves the editor on another slide than the one shown`);
      assert.deepEqual(errors(page), []);
    }
  });
}

// presenterView opens the tab of Presenter View on slide n, with the presenter display open
async function presenterView(t, platform, n) {
  const page = await load(t, platform, n);
  await press(page, 'Alt+Enter');
  await page.waitFor(`${DISPLAY} && ${ready(TAB)}`, 20000);
  await sleep(1200);
  return page;
}

// F16: the speaker view opened by the tab of Presenter View stayed open with dead frames once the
// show was ended from it
for (const platform of PLATFORMS) {
  test(`Presenter View ended from the speaker view of its tab closes the speaker view too (${platform})`, async (t) => {
    for (const [key, keyCode] of KEYS) {
      const page = await presenterView(t, platform, LAST);
      await page.evaluate(keepSpeaker(TAB));
      // the notes plugin of reveal.js opens the speaker view only at a user gesture, which
      // page.evaluate does not give, hence the call is evaluated in the target of the tab
      const { targetInfos } = await page.send('Target.getTargets');
      const tab = targetInfos.find((x) => x.type === 'page' && x.url.includes('from-editor'));
      const { sessionId } = await page.send('Target.attachToTarget', { targetId: tab.targetId, flatten: false });
      await page.send('Target.sendMessageToTarget', { sessionId, message: js({ id: 1, method: 'Runtime.evaluate', params: { expression: "Reveal.getPlugin('notes').open(), 1", userGesture: true } }) });
      await page.waitFor(ready(CURRENT), 20000);
      await sleep(1200);
      await page.evaluate(keyIn(CURRENT, key, keyCode));
      assert.ok(await within(page, `!${DISPLAY} && ${TAB}.closed`, 5000), `${key} in the speaker view does not end Presenter View`);
      assert.ok(await within(page, speakerClosed, 3000), `${key} in the speaker view leaves the speaker view open`);
      assert.equal(await page.evaluate('Reveal.getIndices().h'), LAST);
      assert.deepEqual(errors(page), []);
    }
  });
}

// F17: E in the tab of Presenter View opened a second editor in the tab, and the presenter display
// stayed open. Esc is tested as the same end
for (const platform of PLATFORMS) {
  test(`E or Esc in the tab of Presenter View ends it as the display does, before the tab opens the editor (${platform})`, async (t) => {
    for (const [key, keyCode] of [...KEYS].reverse()) {
      const page = await presenterView(t, platform, 3);
      await page.evaluate(keyIn(TAB, key, keyCode));
      assert.ok(await within(page, `!${DISPLAY} && ${TAB}.closed`, 5000), `${key} in the tab does not end Presenter View`);
      assert.equal(await page.evaluate('Reveal.getIndices().h'), 3, `${key} in the tab leaves the editor on another slide`);
      assert.deepEqual(errors(page), []);
    }
  });
}
