// checks of the backdrops drawn from a file of polylines: the parse, the select and color
// attributes, and the fit under type stripping, and a missing or malformed file in Chrome

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';
import { FILL, bodiesOf, fitView, mix, parse, select, shadeOf, strandsOf } from '../src/strands.ts';

// the sample of the demo deck is a JSON object wrapped in Beeson.strands( and );
const text = readFileSync(new URL('../demo/broucke-sample.js', import.meta.url), 'utf8');
const sample = parse(JSON.parse(text.slice(text.indexOf('(') + 1, text.lastIndexOf(')'))));
const keys = (records) => records.map((r) => `${r.family} ${r.frame} ${r.e}`);

test('the sample is parsed into eight members of each of families 7 and 11 in two frames, with their bodies', () => {
  assert.equal(sample.families.length, 32);
  assert.deepEqual([...new Set(sample.families.map((r) => r.family))], [7, 11]);
  assert.deepEqual([...new Set(sample.families.map((r) => r.frame))], ['pulsating', 'inertial']);
  for (const r of sample.families) assert.equal(r.points.length, r.theta.length);
  assert.equal(sample.bodies.length, 16);
});

test('a malformed file is rejected with the reason', () => {
  assert.throws(() => parse([]), /"families"/);
  assert.throws(() => parse({ families: [{ points: [[0, 0]] }] }), /record 0 .* two \[x, y\] pairs/);
  assert.throws(
    () =>
      parse({
        families: [
          {
            points: [
              [0, 0],
              [1, 'a'],
            ],
          },
        ],
      }),
    /record 0/,
  );
  assert.throws(
    () =>
      parse({
        families: [
          {
            points: [
              [0, 0],
              [1, 1],
            ],
            theta: [0],
          },
        ],
      }),
    /"theta" of its record 0/,
  );
  assert.deepEqual(
    parse({
      families: [
        {
          points: [
            [0, 0],
            [1, 1],
          ],
        },
      ],
    }).bodies,
    [],
  );
});

test('records are selected by equal values, alternatives, bounds, and groups', () => {
  const all = sample.families;
  assert.equal(select(all, undefined).length, 32);
  assert.equal(select(all, ' ').length, 32);
  assert.deepEqual(keys(select(all, 'family=7, frame=pulsating')), [
    '7 pulsating 0',
    '7 pulsating 0.09',
    '7 pulsating 0.135',
    '7 pulsating 0.225',
    '7 pulsating 0.275',
    '7 pulsating 0.365',
    '7 pulsating 0.41',
    '7 pulsating 0.5',
  ]);
  assert.equal(select(all, 'family=7|11,frame=inertial').length, 16);
  assert.deepEqual(keys(select(all, 'frame=pulsating,e>0.2,e<=0.453')), [
    '7 pulsating 0.225',
    '7 pulsating 0.275',
    '7 pulsating 0.365',
    '7 pulsating 0.41',
    '11 pulsating 0.205',
    '11 pulsating 0.245',
    '11 pulsating 0.33',
    '11 pulsating 0.37',
    '11 pulsating 0.453',
  ]);
  assert.deepEqual(keys(select(all, 'family=7,frame=pulsating,e<0.1; family=11,frame=pulsating,e>=0.45')), [
    '7 pulsating 0',
    '7 pulsating 0.09',
    '11 pulsating 0.453',
  ]);
  assert.equal(select(all, 'family=8').length, 0);
  assert.equal(select(all, 'branch>1').length, 0);
  assert.throws(() => select(all, 'family'), /"family" is not a term/);
  assert.throws(() => select(all, 'e<small'), /"small" in "e<small" is not a number/);
});

test('a strand is colored by the pair of its family and the ramp along e', () => {
  const plain = strandsOf(sample, sample.families);
  assert.ok(plain.every((s) => s.ink === undefined && s.alpha === undefined));
  for (const s of plain) {
    assert.equal(s.times[0], 0);
    assert.equal(s.T, s.times[s.times.length - 1]);
  }
  // the pair of a family is set in the order of the file, hence family 11 keeps the second pair
  // when it is drawn alone
  const eleven = strandsOf(sample, select(sample.families, 'family=11,frame=pulsating'), 'family', 'e');
  assert.deepEqual(
    eleven.map((s) => s.ink.pair),
    [1, 1, 1, 1, 1, 1, 1, 1],
  );
  assert.deepEqual(
    eleven.map((s) => +s.ink.at.toFixed(3)),
    [0, 0.177, 0.276, 0.453, 0.541, 0.728, 0.817, 1],
  );
  assert.ok(eleven.every((s) => s.ink.shade === undefined));
  assert.ok(eleven.every((s) => s.alpha > 0 && s.alpha < 1));
  const both = strandsOf(sample, select(sample.families, 'frame=inertial'), 'family');
  assert.deepEqual(
    both.map((s) => s.ink.pair),
    [...Array(8).fill(0), ...Array(8).fill(1)],
  );
  assert.ok(both.every((s) => s.ink.at === 0));
});

test('a strand is drawn in a shade of the first color of its pair along e, lighter at the smallest e', () => {
  const shaded = strandsOf(sample, select(sample.families, 'frame=pulsating'), 'family', undefined, 'e');
  assert.deepEqual(
    shaded.map((s) => [s.ink.pair, +s.ink.at.toFixed(3), s.ink.shade]),
    [0, 0.18, 0.27, 0.45, 0.55, 0.73, 0.82, 1].map((at) => [0, at, true]).concat(
      [0, 0.177, 0.276, 0.453, 0.541, 0.728, 0.817, 1].map((at) => [1, at, true]),
    ),
  );
  // the middle shade is the color itself, and the ends differ in OKLCH lightness alone
  assert.equal(shadeOf('#3d8bff', 0.5), '#3d8bff');
  assert.equal(shadeOf('#3d8bff', 0), '#70bfff');
  assert.equal(shadeOf('#3d8bff', 1), '#0058c8');
  assert.equal(shadeOf('red', 0), null);
});

test('a record with craft set to true is the path of a spacecraft', () => {
  const file = parse({ families: [{ points: [[0, 0], [1, 0]], craft: true }, { points: [[0, 0], [1, 1]], craft: 'yes' }, { points: [[0, 0], [0, 1]] }] });
  assert.deepEqual(
    strandsOf(file, file.families).map((s) => s.craft),
    [true, undefined, undefined],
  );
});

test('colors are mixed in OKLCH along the shorter arc of hue', () => {
  assert.equal(mix('#000000', '#ffffff', 0), '#000000');
  assert.equal(mix('#000', 'rgb(255, 255, 255)', 1), '#ffffff');
  assert.equal(mix('rgba(255, 0, 0, 0.5)', '#ff0000', 0.5), '#ff0000');
  assert.equal(mix('red', '#ff0000', 0.5), null);
  // from red to blue through magenta, not through green
  const [r, g, b] = mix('#ff0000', '#0000ff', 0.5)
    .match(/[0-9a-f]{2}/g)
    .map((v) => parseInt(v, 16));
  assert.ok(g < r && g < b, `${r} ${g} ${b}`);
});

// the share of the segments, weighted equally per strand, whose midpoints are in the window, and the
// smallest and largest x of the drawing in slide pixels
function measure(strands, box, view) {
  const scale = box.height / 2 / view.half;
  let held = 0,
    x0 = Infinity,
    x1 = -Infinity;
  for (const s of strands) {
    const p = s.pts,
      n = p.length / 2;
    for (let i = 1; i < n; i++) {
      const x = (p[2 * i] + p[2 * i - 2]) / 2,
        y = (p[2 * i + 1] + p[2 * i - 1]) / 2;
      if (Math.abs(x - view.cx) * scale <= box.width / 2 && Math.abs(y - view.cy) * scale <= box.height / 2)
        held += 1 / (n - 1);
    }
    for (let i = 0; i < n; i++) {
      const x = box.left + (p[2 * i] - view.cx) * scale + box.width / 2;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
    }
  }
  return { held: held / strands.length, x0, x1 };
}

test('a fitted window holds the fill of tubes, and keeps the drawing clear of an inner side', () => {
  const slide = { width: 1920, height: 1080 };
  const strands = strandsOf(sample, select(sample.families, 'frame=pulsating'));
  const plate = { left: 0, top: 0, width: 1920, height: 1080 };
  const full = measure(strands, plate, fitView(strands, plate, slide));
  assert.ok(Math.abs(full.held - FILL) < 0.01, `held ${full.held}`);

  // the box of a section slide has its left side inside the slide
  const section = { left: 1040, top: 0, width: 880, height: 1080 };
  const right = measure(strands, section, fitView(strands, section, slide));
  assert.ok(right.x0 >= section.left + 40 - 1e-6, `x0 ${right.x0}`);
  assert.ok(right.held >= FILL - 1e-9, `held ${right.held}`);

  assert.equal(fitView([], plate, slide), null);
});

test('the bodies are drawn only where they are fixed in the frame of the chosen members', () => {
  const at = (spec) => bodiesOf(sample, select(sample.families, spec)).map((d) => `${d.x} ${d.mass}`);
  assert.deepEqual(at('family=7,frame=pulsating'), ['-0.01215 0.987845', '0.98784 0.012155']);
  assert.deepEqual(at('frame=pulsating'), ['-0.01215 0.987845', '0.98784 0.012155', '-0.5 0.5', '0.5 0.5']);
  assert.deepEqual(at('frame=inertial'), []);
});

// a missing, malformed, or unreadable file and a selection without a match are each reported in one
// warning, and their backdrops are left empty without an exception
test('a backdrop of a missing or malformed file is left empty after one warning', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('test/pages/strands.html', 'still'));
  await page.waitFor(deckSettled);
  const seen = await page.evaluate(`({
    warnings: window.warnings,
    counts: Beeson.backdrops.map((b) => b.strands.length),
  })`);
  assert.deepEqual(
    seen.counts.map((n) => n > 0),
    [true, false, false, false, false, false],
  );
  // the files are read at once, hence the warnings come in any order
  const reasons = [
    /missing\.js is not drawn, since it was not found/,
    /strands-malformed\.js is not drawn, since it does not have a list "families"/,
    /broucke-sample\.json is not drawn, since a JSON file cannot be read in a deck opened from the disk/,
    /data-strands-select="family=99" does not match/,
  ];
  assert.equal(seen.warnings.length, reasons.length, seen.warnings.join('\n'));
  for (const reason of reasons) assert.equal(seen.warnings.filter((w) => reason.test(w)).length, 1, `${reason}`);
  const thrown = page.errors.filter((e) => !/Failed to load resource/.test(e));
  assert.deepEqual(thrown, []);

  // the backdrop of the sample is painted
  const painted = await page.evaluate(`(() => {
    const { base } = Beeson.backdrops[0];
    return base.getContext('2d').getImageData(0, 0, base.width, base.height).data.some(Boolean);
  })()`);
  assert.ok(painted);
});
