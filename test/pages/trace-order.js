// three crossing strands traced by test/pages/trace.html for test/backdrops.test.mjs. without a
// clock, each strand is traced at one speed along its length, hence the shorter strands are
// finished first, in the reverse of the order of the file: the white one at 0.88 s, the orange one
// at 1.41 s, and the violet one at 2 s
const segment = (x0, y0, x1, y1) => Array.from({ length: 121 }, (_, k) => [x0 + ((x1 - x0) * k) / 120, y0 + ((y1 - y0) * k) / 120]);
Beeson.strands({
  families: [
    { points: segment(-0.8, 0, 0.8, 0), tone: 'violet', alpha: 0.6, glow: true },
    { points: segment(-0.4, -0.4, 0.4, 0.4), tone: 'orange', alpha: 0.6, glow: true },
    { points: segment(-0.25, 0.25, 0.25, -0.25), tone: 'text', alpha: 0.6 },
  ],
});
