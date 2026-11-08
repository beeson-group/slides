// the cost of the frames of the trace of the title slide, in headless Chrome at a pixel ratio of 2.
// a frame at 120 Hz lasts 8.3 ms, of which the drawing is given 4 ms on a slow laptop, i.e. in
// Chrome with its CPU throttled four times, and 1 ms without the throttle. the cost of a frame is
// the time spent in the callbacks of requestAnimationFrame, and the budget holds at the 99th
// percentile of the frames of the 20 s trace. the timing of a shared runner of GitHub does not
// stand for a laptop, hence the test is skipped on CI

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';

// the cost of each frame of one trace of the title backdrop, in ms
const costs = `(async () => {
  const b = Beeson.backdrops.find((o) => o.el.closest('section.title'));
  const out = [], raf = window.requestAnimationFrame;
  window.requestAnimationFrame = (callback) => raf((now) => {
    const t = performance.now();
    callback(now);
    out.push(performance.now() - t);
  });
  b.reset();
  b.start();
  while (b.tracing) await new Promise((done) => setTimeout(done, 100));
  window.requestAnimationFrame = raf;
  return out;
})()`;

for (const [rate, budget] of [
  [1, 1],
  [4, 4],
]) {
  test(
    `a frame of the title trace costs at most ${budget} ms with the CPU throttled ${rate} times`,
    { skip: process.env.CI ? 'the timing of a shared runner does not stand for a laptop' : false, timeout: 120000 },
    async (t) => {
      const browser = await launch();
      t.after(() => browser.close());
      const page = await browser.newPage({ motion: true, scale: 2 });
      await page.goto(deckUrl('index.html'));
      await page.waitFor(deckSettled);
      if (rate > 1) await page.send('Emulation.setCPUThrottlingRate', { rate });

      const frames = (await page.evaluate(costs)).sort((a, b) => a - b);
      const p99 = frames[Math.ceil(0.99 * frames.length) - 1];
      const mean = frames.reduce((a, b) => a + b, 0) / frames.length;
      const found = `${p99.toFixed(2)} ms at the 99th percentile of ${frames.length} frames, ${mean.toFixed(2)} ms on average, and ${frames.at(-1).toFixed(2)} ms at most`;
      t.diagnostic(found);
      assert.ok(frames.length > 600, `${frames.length} frames in the trace`);
      assert.ok(p99 <= budget, `a frame of the title trace costs ${found}`);
    },
  );
}
