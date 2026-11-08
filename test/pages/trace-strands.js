// two straight strands traced by test/pages/trace.html for test/backdrops.test.mjs, one plain and
// one with a glow, each of 241 points. at the 1080 px per unit of the page, each strand is centered
// on a row of pixels
const line = (y) => Array.from({ length: 241 }, (_, k) => [-0.8 + (1.6 * k) / 240, y]);
Beeson.strands({
  families: [
    { points: line(0.20046), tone: 'orange', alpha: 0.6 },
    { points: line(-0.19954), tone: 'violet', alpha: 0.6, glow: true },
  ],
});
