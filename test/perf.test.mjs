import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';

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
      await page.goto(deckUrl('test-deck.html'));
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

const normalCosts = `(async () => {
  const b = Beeson.backdrops[0];
  b.t0 = performance.now() - 4500;
  const out = [], raf = window.requestAnimationFrame;
  window.requestAnimationFrame = (callback) => raf((now) => {
    const t = performance.now();
    callback(now);
    out.push(performance.now() - t);
  });
  await new Promise((done) => setTimeout(done, 4000));
  window.requestAnimationFrame = raf;
  return { tracing: b.tracing, frames: out };
})()`;

test(
  'a frame of the normal form carried into the coordinates of its normal form costs at most 4 ms with the CPU throttled 4 times',
  { skip: process.env.CI ? 'the timing of a shared runner does not stand for a laptop' : false, timeout: 120000 },
  async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await browser.newPage({ motion: true, scale: 2 });
    await page.goto(deckUrl('test/pages/backdrops-normal-form.html'));
    await page.waitFor(deckSettled);
    await page.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const { tracing, frames } = await page.evaluate(normalCosts);
    frames.sort((a, b) => a - b);
    const p99 = frames[Math.ceil(0.99 * frames.length) - 1];
    t.diagnostic(`${p99.toFixed(2)} ms at the 99th percentile of ${frames.length} frames, ${frames.at(-1).toFixed(2)} ms at most`);
    assert.equal(tracing, true);
    assert.ok(frames.length > 100, `${frames.length} frames`);
    assert.ok(p99 <= 4, `a frame of the normal form costs ${p99.toFixed(2)} ms at the 99th percentile`);
  },
);
