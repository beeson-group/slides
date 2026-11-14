// checks of the backdrops drawn from a file of polylines: the parse, the select and color
// attributes, and the fit under type stripping, and a missing or malformed file in Chrome

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';
import {
  COLORMAPS,
  CONTRAST,
  FILL,
  MAP_ALPHA,
  MAP_CONTRAST,
  bodiesOf,
  colormapAt,
  colormapColor,
  colormapEnds,
  colormapOf,
  fitView,
  mix,
  parse,
  select,
  shadeOf,
  trajectoriesOf,
} from '../src/trajectories.ts';

// the sample of the demo deck is a JSON object wrapped in Beeson.trajectories( and );
const text = readFileSync(new URL('../demo/broucke-sample.js', import.meta.url), 'utf8');
const sample = parse(JSON.parse(text.slice(text.indexOf('(') + 1, text.lastIndexOf(')'))));
// the trajectories of a selection by family and then by e, since the order of the sample is free, and
// a selection keeps the order of the file
const keys = (fileTrajectories) => {
  const all = sample.families;
  assert.ok(fileTrajectories.every((r, i) => i === 0 || all.indexOf(r) > all.indexOf(fileTrajectories[i - 1])), 'a selection is not in the order of the file');
  return [...fileTrajectories].sort((a, b) => a.family - b.family || a.e - b.e).map((r) => `${r.family} ${r.frame} ${r.e}`);
};
// the fraction of each trajectory along its ramp or shade, by family and then by e
const alongE = (trajectories, fileTrajectories) =>
  fileTrajectories.map((r, i) => [r.family, r.e, trajectories[i]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, , s]) => [s.ink.pair, +s.ink.at.toFixed(3), s.ink.shade]);

test('the sample is parsed into the members of families 7 and 11 in four frames, with a clock t and their bodies', () => {
  assert.equal(sample.families.length, 60);
  assert.deepEqual([...new Set(sample.families.map((r) => r.family))], [7, 11]);
  assert.deepEqual([...new Set(sample.families.map((r) => r.branch))], ['periapsis', 'apoapsis']);
  assert.deepEqual([...new Set(sample.families.map((r) => r.frame))], ['pulsating', 'inertial', 'inertial-m2', 'rotating']);
  const count = (spec) => select(sample.families, spec).length;
  assert.deepEqual(['family=7,branch=periapsis', 'family=7,branch=apoapsis,frame=rotating', 'family=7,branch=apoapsis,frame=inertial-m2', 'family=11'].map(count), [24, 10, 10, 16]);
  for (const r of sample.families) {
    assert.equal(r.points.length, r.t.length);
    assert.equal(r.theta, undefined);
  }
  // one entry per member, and the members of 7A at e = 0.975 in two frames are one member
  assert.equal(sample.bodies.length, 35);
});

test('a malformed file is rejected with the reason', () => {
  assert.throws(() => parse([]), /"families"/);
  assert.throws(() => parse({ families: [{ points: [[0, 0]] }] }), /trajectory 0 .* two \[x, y\] pairs/);
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
    /trajectory 0/,
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
    /"theta" of its trajectory 0/,
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
  assert.equal(select(all, undefined).length, 60);
  assert.equal(select(all, ' ').length, 60);
  assert.deepEqual(keys(select(all, 'family=7, frame=pulsating')), [
    '7 pulsating 0',
    '7 pulsating 0.07',
    '7 pulsating 0.145',
    '7 pulsating 0.215',
    '7 pulsating 0.285',
    '7 pulsating 0.355',
    '7 pulsating 0.43',
    '7 pulsating 0.5',
  ]);
  assert.equal(select(all, 'family=7|11,frame=inertial').length, 16);
  assert.deepEqual(keys(select(all, 'frame=pulsating,e>0.2,e<=0.453')), [
    '7 pulsating 0.215',
    '7 pulsating 0.285',
    '7 pulsating 0.355',
    '7 pulsating 0.43',
    '11 pulsating 0.26',
    '11 pulsating 0.325',
    '11 pulsating 0.39',
    '11 pulsating 0.453',
  ]);
  assert.deepEqual(keys(select(all, 'family=7,frame=pulsating,e<0.1; family=11,frame=pulsating,e>=0.45')), [
    '7 pulsating 0',
    '7 pulsating 0.07',
    '11 pulsating 0.453',
  ]);
  assert.deepEqual(keys(select(all, 'branch=apoapsis,frame=rotating,e>0.85')), ['7 rotating 0.8825', '7 rotating 0.93', '7 rotating 0.975']);
  assert.equal(select(all, 'family=8').length, 0);
  assert.equal(select(all, 'branch>1').length, 0);
  assert.throws(() => select(all, 'family'), /"family" is not a term/);
  assert.throws(() => select(all, 'e<small'), /"small" in "e<small" is not a number/);
});

test('a trajectory is colored by the pair of its family and the ramp along e', () => {
  const plain = trajectoriesOf(sample, sample.families);
  assert.ok(plain.every((s) => s.ink === undefined && s.alpha === undefined));
  for (const s of plain) {
    assert.equal(s.times[0], 0);
    assert.equal(s.T, s.times[s.times.length - 1]);
  }
  // the pair of a family is set in the order of the file, hence family 11 keeps the second pair
  // when it is drawn alone
  const chosen = select(sample.families, 'family=11,frame=pulsating');
  const eleven = trajectoriesOf(sample, chosen, 'family', 'e');
  assert.deepEqual(
    alongE(eleven, chosen),
    [0, 0.143, 0.287, 0.43, 0.574, 0.717, 0.861, 1].map((at) => [1, at, undefined]),
  );
  assert.ok(eleven.every((s) => s.ink.shade === undefined));
  assert.ok(eleven.every((s) => s.alpha > 0 && s.alpha < 1));
  const both = trajectoriesOf(sample, select(sample.families, 'frame=inertial'), 'family');
  assert.deepEqual(
    both.map((s) => s.ink.pair),
    [...Array(8).fill(0), ...Array(8).fill(1)],
  );
  assert.ok(both.every((s) => s.ink.at === 0));
});

test('a trajectory is drawn in a shade of the first color of its pair along e, lighter at the smallest e', () => {
  const chosen = select(sample.families, 'frame=pulsating');
  const shaded = trajectoriesOf(sample, chosen, 'family', undefined, 'e');
  assert.deepEqual(
    alongE(shaded, chosen),
    [0, 0.14, 0.29, 0.43, 0.57, 0.71, 0.86, 1].map((at) => [0, at, true]).concat(
      [0, 0.143, 0.287, 0.43, 0.574, 0.717, 0.861, 1].map((at) => [1, at, true]),
    ),
  );
  // the middle shade is the color itself, and the ends differ in OKLCH lightness alone
  assert.equal(shadeOf('#3d8bff', 0.5), '#3d8bff');
  assert.equal(shadeOf('#3d8bff', 0), '#70bfff');
  assert.equal(shadeOf('#3d8bff', 1), '#0058c8');
  assert.equal(shadeOf('red', 0), null);
});

// the WCAG contrast against bg of a color drawn over it at the opacity alpha, by default the 0.6 of a
// trajectory colored from the palette, blended as on a canvas
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const linear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (c) => c.map(linear).reduce((sum, v, i) => sum + [0.2126, 0.7152, 0.0722][i] * v, 0);
const contrast = (color, bg, alpha = 0.6) => {
  const a = luminance(rgb(color).map((v, i) => alpha * v + (1 - alpha) * rgb(bg)[i])), b = luminance(rgb(bg));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
// the custom property name of a mode in theme/beeson.css, as #rrggbb
const css = readFileSync(new URL('../theme/beeson.css', import.meta.url), 'utf8');
const token = (mode, name) =>
  css
    .slice(css.indexOf(`html[data-theme="${mode}"] {`))
    .split('}')[0]
    .match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i'))[1];

test('each color of the palette, of its ramps, and of its shades keeps a contrast of 2.5:1 against the background in both modes', () => {
  for (const mode of ['dark', 'light']) {
    const bg = token(mode, 'bg'), palette = Array.from({ length: 8 }, (_, i) => token(mode, `trajectory-${i + 1}`));
    for (let p = 0; p < 8; p += 2) {
      const shades = [];
      for (let k = 0; k <= 20; k++) {
        const ramp = mix(palette[p], palette[p + 1], k / 20), shade = shadeOf(palette[p], k / 20, bg);
        assert.ok(contrast(ramp, bg) >= 2.5, `${mode}: the ramp of --trajectory-${p + 1} at ${k / 20} is ${ramp}, at ${contrast(ramp, bg).toFixed(2)}:1`);
        assert.ok(contrast(shade, bg) >= 2.5, `${mode}: the shade of --trajectory-${p + 1} at ${k / 20} is ${shade}, at ${contrast(shade, bg).toFixed(2)}:1`);
        shades.push(luminance(rgb(shade)));
      }
      // the shades are moved away from the background as a whole, hence they keep their order
      assert.ok(shades.every((v, k) => k === 0 || v < shades[k - 1]), `${mode}: the shades of --trajectory-${p + 1} are not ordered from lighter to darker`);
    }
  }
});

test('each color of a colormap between its ends keeps a contrast of 3:1 against the background as drawn, in both modes', () => {
  // a colormap trajectory is drawn opaque, as in the matplotlib figures, hence the 3:1 of its ends holds on the slide
  assert.equal(MAP_ALPHA, 1);
  for (const mode of ['dark', 'light']) {
    const bg = token(mode, 'bg');
    for (const name of Object.keys(COLORMAPS)) {
      for (let k = 0; k <= 100; k++) {
        const color = colormapColor(colormapOf(name), k / 100, bg);
        assert.ok(contrast(color, bg, MAP_ALPHA) >= MAP_CONTRAST, `${mode}: ${name} at ${k / 100} is ${color}, at ${contrast(color, bg, MAP_ALPHA).toFixed(2)}:1`);
      }
    }
  }
});

// the distance of two colors in OKLab times 100, by the matrices of Björn Ottosson, where 1 is about
// the smallest difference that is seen
const oklab = (h) => {
  const [r, g, b] = rgb(h).map(linear);
  const [l, m, s] = [
    0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
    0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
    0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
  ].map(Math.cbrt);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const distance = (a, b) => 100 * Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i]));

// colors of matplotlib's own colormaps, printed by matplotlib.colormaps[name](x)
const MATPLOTLIB = {
  viridis: { 0: '#440154', 0.25: '#3b528b', 0.29: '#365d8d', 0.5: '#21918c', 0.57: '#1fa188', 0.85: '#9bd93c', 1: '#fde725' },
  plasma: { 0: '#0d0887', 0.25: '#7e03a8', 0.35: '#a11b9b', 0.5: '#cc4778', 0.62: '#e56a5d', 0.85: '#feba2c', 1: '#f0f921' },
  Blues_r: { 0: '#08306b', 0.17: '#115ca5', 0.25: '#2171b5', 0.393: '#4896c8', 0.5: '#6caed6', 0.683: '#b0d2e7', 1: '#f7fbff' },
};

test('a colormap is drawn within 1 of matplotlib in OKLab distance times 100', () => {
  for (const [name, colors] of Object.entries(MATPLOTLIB)) {
    for (const [x, color] of Object.entries(colors)) {
      const d = distance(colormapAt(name, +x), color);
      assert.ok(d < 1, `${name} at ${x} is ${colormapAt(name, +x)}, at ${d.toFixed(2)} from ${color}`);
    }
  }
  assert.equal(colormapAt('viridis', -1), '#440154');
  assert.equal(colormapAt('viridis', 2), '#fde725');
});

test('a colormap is named alone or with its lower and upper ends, and a malformed one is rejected with the reason', () => {
  assert.deepEqual(colormapOf(' viridis '), { name: 'viridis', lo: 0, hi: 0.85 });
  assert.deepEqual(colormapOf('plasma'), { name: 'plasma', lo: 0, hi: 0.85 });
  assert.deepEqual(colormapOf('Blues_r'), { name: 'Blues_r', lo: 0, hi: 0.683 });
  assert.deepEqual(colormapOf('viridis 0.1  0.9'), { name: 'viridis', lo: 0.1, hi: 0.9 });
  assert.throws(() => colormapOf('magma'), /"magma" is not viridis, plasma, or Blues_r/);
  assert.throws(() => colormapOf('toString'), /"toString" is not viridis/);
  assert.throws(() => colormapOf('viridis 0.5'), /"0.5" is not a lower and an upper end/);
  assert.throws(() => colormapOf('viridis 0.9 0.1'), /is not a lower and an upper end/);
  assert.throws(() => colormapOf('viridis 0 1.2'), /is not a lower and an upper end/);
});

test('an end of a colormap short of 3:1 against the background is moved toward the other end in steps of 0.01', () => {
  const ends = (spec, bg) => colormapEnds(colormapOf(spec), bg);
  // the lower ends on the dark background are those of matplotlib, which the figures of the slides use
  assert.deepEqual(ends('viridis', '#050505'), [0.29, 0.85]);
  assert.deepEqual(ends('plasma', '#050505'), [0.35, 0.85]);
  assert.deepEqual(ends('Blues_r', '#050505'), [0.17, 0.683]);
  assert.deepEqual(ends('viridis', '#faf8f3'), [0, 0.57]);
  assert.deepEqual(ends('plasma', '#faf8f3'), [0, 0.62]);
  assert.deepEqual(ends('Blues_r', '#faf8f3'), [0, 0.393]);
  // ends that keep 3:1 are kept, and without a background both are kept
  assert.deepEqual(ends('viridis 0.4 0.55', '#050505'), [0.4, 0.55]);
  assert.deepEqual(ends('viridis 0.4 0.55', '#faf8f3'), [0.4, 0.55]);
  assert.deepEqual(ends('viridis'), [0, 0.85]);
  assert.equal(colormapColor(colormapOf('viridis'), 0, '#050505'), colormapAt('viridis', 0.29));
  assert.equal(colormapColor(colormapOf('viridis'), 1, '#faf8f3'), colormapAt('viridis', 0.57));
});

test('a trajectory is colored from a colormap along e within the group of its family, or of the whole drawing', () => {
  const chosen = select(sample.families, 'frame=pulsating'),
    viridis = colormapOf('viridis');
  // a shade is ignored with a colormap
  const grouped = trajectoriesOf(sample, chosen, 'family', 'e', 'e', viridis);
  assert.deepEqual(
    alongE(grouped, chosen),
    [0, 0.14, 0.29, 0.43, 0.57, 0.71, 0.86, 1].map((at) => [0, at, undefined]).concat(
      [0, 0.143, 0.287, 0.43, 0.574, 0.717, 0.861, 1].map((at) => [1, at, undefined]),
    ),
  );
  assert.ok(grouped.every((s) => s.ink.map === viridis && s.alpha === MAP_ALPHA));
  // without data-trajectories-color, e is ranged over both families, from 0 to 0.5
  const whole = trajectoriesOf(sample, chosen, undefined, 'e', undefined, viridis);
  assert.deepEqual(
    alongE(whole, chosen),
    [0, 0.14, 0.29, 0.43, 0.57, 0.71, 0.86, 1].concat([0, 0.13, 0.26, 0.39, 0.52, 0.65, 0.78, 0.906]).map((at) => [0, at, undefined]),
  );
});

test('a record with craft set to true is the path of a spacecraft', () => {
  const file = parse({ families: [{ points: [[0, 0], [1, 0]], craft: true }, { points: [[0, 0], [1, 1]], craft: 'yes' }, { points: [[0, 0], [0, 1]] }] });
  assert.deepEqual(
    trajectoriesOf(file, file.families).map((s) => s.craft),
    [true, undefined, undefined],
  );
});

// the look of a trajectory: its tone, color, opacity, weight, head, start, fade, and glow, as on the title slide
const looked = {
  families: [
    { piece: 'tube', tone: 'violet', color: ['#c184f0', '#7617bf'], alpha: 0.35, weight: 0.5, head: 0, start: 0, fade: 4, points: [[0, 0], [1, 0], [2, 0]], t: [0, 3, 6] },
    { piece: 'spiral', tone: 'orange', head: 2.2, start: 6, points: [[2, 0], [2, 1]], t: [10, 12] },
    { piece: 'arc', tone: 'violet', color: '#ee5cf4', weight: 1.4, glow: true, start: 8, points: [[2, 1], [3, 1]] },
  ],
};

test('the tone, color, opacity, weight, head, start, fade, and glow of a record are given to its trajectory', () => {
  const [tube, spiral, arc] = trajectoriesOf(parse(looked), looked.families);
  assert.deepEqual([tube.tone, tube.alpha, tube.weight, tube.head, tube.fade, tube.glow], ['violet', 0.35, 0.5, 0, 4, undefined]);
  assert.equal(spiral.fade, undefined);
  // a color is a CSS color or a pair of them for the dark and the light mode, kept as given
  assert.deepEqual([tube.color, spiral.color, arc.color], [['#c184f0', '#7617bf'], undefined, '#ee5cf4']);
  // a clock is moved by the start of its trajectory, and T is the clock of the last point
  assert.deepEqual([...tube.times], [0, 3, 6]);
  assert.deepEqual([...spiral.times], [6, 8]);
  assert.equal(spiral.T, 8);
  assert.deepEqual([spiral.tone, spiral.alpha, spiral.weight, spiral.head], ['orange', undefined, undefined, 2.2]);
  // without a clock, the trajectory is traced along its length from its start
  assert.deepEqual([...arc.times], [8, 9]);
  assert.deepEqual([arc.weight, arc.glow, arc.head], [1.4, true, undefined]);
  // the opacity of a trajectory wins over the one of its ink
  const inked = trajectoriesOf(parse(looked), looked.families, 'piece');
  assert.equal(inked[0].alpha, 0.35);
  assert.ok(inked[1].alpha > 0 && inked[1].alpha < 1);
});

test('a record with a look of another form is rejected with the reason', () => {
  const file = (look) => ({ families: [{ points: [[0, 0], [1, 1]], ...look }] });
  assert.throws(() => parse(file({ tone: 'hero' })), /"tone" of its trajectory 0/);
  assert.throws(() => parse(file({ color: 3 })), /"color" of its trajectory 0/);
  assert.throws(() => parse(file({ color: ['#fff'] })), /"color" of its trajectory 0/);
  assert.throws(() => parse(file({ color: '' })), /"color" of its trajectory 0/);
  assert.throws(() => parse(file({ alpha: 0 })), /"alpha" of its trajectory 0/);
  assert.throws(() => parse(file({ alpha: 1.5 })), /"alpha" of its trajectory 0/);
  assert.throws(() => parse(file({ weight: -1 })), /"weight" of its trajectory 0/);
  assert.throws(() => parse(file({ head: 'small' })), /"head" of its trajectory 0/);
  assert.throws(() => parse(file({ start: NaN })), /"start" of its trajectory 0/);
  assert.throws(() => parse(file({ fade: -2 })), /"fade" of its trajectory 0/);
  assert.throws(() => parse(file({ glow: 'yes' })), /"glow" of its trajectory 0/);
  assert.equal(parse(file({ tone: 'text', color: ['#fff', '#000'], alpha: 1, weight: 0, head: 0, start: 0, fade: 0, glow: false })).families.length, 1);
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

// the share of the segments, weighted equally per trajectory, whose midpoints are in the window, and the
// smallest and largest x of the drawing in slide pixels
function measure(trajectories, box, view) {
  const scale = box.height / 2 / view.half;
  let held = 0,
    x0 = Infinity,
    x1 = -Infinity;
  for (const s of trajectories) {
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
  return { held: held / trajectories.length, x0, x1 };
}

test('a fitted window holds the fill of tubes, and keeps the drawing clear of an inner side', () => {
  const slide = { width: 1920, height: 1080 };
  const trajectories = trajectoriesOf(sample, select(sample.families, 'frame=pulsating'));
  const plate = { left: 0, top: 0, width: 1920, height: 1080 };
  const full = measure(trajectories, plate, fitView(trajectories, plate, slide));
  assert.ok(Math.abs(full.held - FILL) < 0.01, `held ${full.held}`);

  // the box of a section slide has its left side inside the slide
  const section = { left: 1040, top: 0, width: 880, height: 1080 };
  const right = measure(trajectories, section, fitView(trajectories, section, slide));
  assert.ok(right.x0 >= section.left + 40 - 1e-6, `x0 ${right.x0}`);
  assert.ok(right.held >= FILL - 1e-9, `held ${right.held}`);

  assert.equal(fitView([], plate, slide), null);
});

test('the bodies are drawn only when every chosen member puts them at the same positions', () => {
  const at = (spec) => bodiesOf(sample, select(sample.families, spec)).map((d) => `${d.x} ${d.mass}`);
  assert.deepEqual(at('family=7,frame=pulsating'), ['-0.0122 0.987845', '0.9878 0.012155']);
  assert.deepEqual(at('family=11,frame=pulsating'), ['-0.5 0.5', '0.5 0.5']);
  // the members of two mass ratios disagree on the bodies, and the bodies move in the inertial frames
  assert.deepEqual(at('frame=pulsating'), []);
  assert.deepEqual(at('frame=inertial'), []);
  assert.deepEqual(at('family=7,frame=inertial-m2'), []);
  // in the rotating frame the separation of the bodies is set by the start of each member, hence one
  // member has its bodies and the members together do not
  assert.deepEqual(at('family=7,branch=apoapsis,frame=rotating,e=0.5575'), ['-0.0188 0.987845', '1.5284 0.012155']);
  assert.deepEqual(at('family=7,branch=apoapsis,frame=rotating'), []);
  // positions within 1e-4 are one position, and a member without bodies disagrees with one that has them
  const file = (bodies) => ({ families: [], bodies });
  const fileTrajectories = [{ points: [], family: 1 }, { points: [], family: 2 }];
  const near = file([{ family: 1, mu: 0.5, m1: [-0.5, 0], m2: [0.5, 0] }, { family: 2, mu: 0.5, m1: [-0.50005, 0], m2: [0.5, 0.00005] }]);
  assert.deepEqual(bodiesOf(near, fileTrajectories).map((d) => `${d.x} ${d.y} ${d.mass}`), ['-0.5 0 0.5', '0.5 0 0.5']);
  const far = file([{ family: 1, m1: [-0.5, 0] }, { family: 2, m1: [-0.5002, 0] }]);
  assert.deepEqual(bodiesOf(far, fileTrajectories), []);
  assert.deepEqual(bodiesOf(file([{ family: 1, m1: [-0.5, 0] }]), fileTrajectories), []);
  assert.deepEqual(bodiesOf(file([{ m1: [-0.5, 0] }]), fileTrajectories).map((d) => d.x), [-0.5]);
  assert.deepEqual(bodiesOf(file([]), fileTrajectories), []);
});

// a missing, malformed, or unreadable file and a selection without a match are each reported in one
// warning, and their backdrops are left empty without an exception. a colormap of another name and a
// shade beside a colormap are each reported in one warning, and their backdrops are drawn
test('a backdrop of a missing or malformed file is left empty after one warning', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('test/pages/trajectories.html', 'still'));
  await page.waitFor(deckSettled);
  const seen = await page.evaluate(`({
    warnings: window.warnings,
    counts: Beeson.backdrops.map((b) => b.trajectories.length),
  })`);
  assert.deepEqual(
    seen.counts.map((n) => n > 0),
    [true, false, false, false, false, false, true, true, true],
  );
  // the files are read at once, hence the warnings come in any order
  const reasons = [
    /missing\.js is not drawn, since it was not found/,
    /trajectories-malformed\.js is not drawn, since it does not have a list "families"/,
    /broucke-sample\.json is not drawn, since a JSON file cannot be read in a deck opened from the disk/,
    /data-trajectories-select="family=99" does not match/,
    /data-trajectories-colormap="magma" is not used, since "magma" is not viridis, plasma, or Blues_r\. The trajectories are colored from the palette/,
    /data-trajectories-shade="e" is ignored, since data-trajectories-colormap is given/,
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

// the colors given to the trajectories of a backdrop of the page by its colormap, read in the current mode
// and after a flip to the light mode, and the colormap and shade of each trajectory
const painted = (spec) => `(async () => {
  const b = Beeson.backdrops.find((o) => o.el.dataset.trajectoriesColormap === '${spec}');
  const { h, v } = Reveal.getIndices(b.el.closest('section'));
  Reveal.slide(h, v);
  await b.ready;
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const dark = [...b.inks];
  document.documentElement.dataset.theme = 'light';
  b.redraw();
  const light = [...b.inks];
  document.documentElement.dataset.theme = 'dark';
  b.redraw();
  return { dark, light, maps: b.trajectories.map((s) => s.ink.map?.name), shades: b.trajectories.map((s) => s.ink.shade) };
})()`;

test('a colormap is painted for the background of each mode, and a colormap of another name falls back to the palette', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('test/pages/trajectories.html', 'still'));
  await page.waitFor(deckSettled);
  const chosen = select(sample.families, 'frame=pulsating');
  const expected = (bg) => trajectoriesOf(sample, chosen, 'family', 'e', undefined, colormapOf('viridis')).map((s) => colormapColor(s.ink.map, s.ink.at, bg));
  const viridis = await page.evaluate(painted('viridis'));
  assert.deepEqual(viridis.dark, expected(token('dark', 'bg')));
  assert.deepEqual(viridis.light, expected(token('light', 'bg')));
  const magma = await page.evaluate(painted('magma'));
  // a value undefined in the page is returned as null
  assert.ok(magma.maps.every((name) => name === null));
  assert.ok(magma.dark.every((ink) => /^#[0-9a-f]{6}$/.test(ink)));
  const plasma = await page.evaluate(painted('plasma'));
  assert.ok(plasma.maps.every((name) => name === 'plasma') && plasma.shades.every((shade) => shade === null));
});

// the centers of the heads painted on the head canvas of the first backdrop at two frames, read from
// the calls of arc on its context
const loopHeads = `(async () => {
  const b = Beeson.backdrops[0];
  await b.ready;
  const [, head] = b.canvases;
  const ctx = head.getContext('2d');
  const arc = ctx.arc;
  let seen = [];
  ctx.arc = function (x, y, ...rest) { seen.push([x, y]); return arc.call(this, x, y, ...rest); };
  const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  await frame();
  seen = [];
  await frame();
  const first = seen;
  await new Promise((done) => setTimeout(done, 300));
  seen = [];
  await frame();
  ctx.arc = arc;
  return { trajectories: b.trajectories.length, tracing: b.tracing, first, later: seen };
})()`;

test('a backdrop of a file with data-loop loops a head on each of its trajectories', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  // without reduced motion, which is the setting of the Windows runner of GitHub, and under which
  // a backdrop is drawn complete
  const page = await browser.newPage({ motion: true });
  await page.goto(deckUrl('test/pages/trajectories-loop.html'));
  await page.waitFor('document.readyState === "complete"');
  await page.evaluate('new Promise((done) => setTimeout(done, 500))');
  assert.deepEqual(page.errors.filter((e) => !/Failed to load resource/.test(e)), []);
  await page.waitFor(deckSettled);
  const seen = await page.evaluate(loopHeads);
  assert.equal(seen.trajectories, 8);
  assert.ok(seen.tracing);
  // one head per trajectory at a frame, each drawn once
  const heads = (calls) => new Set(calls.slice(-seen.trajectories).map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`)).size;
  assert.ok(seen.first.length >= seen.trajectories && seen.first.length % seen.trajectories === 0, `${seen.first.length} heads`);
  assert.equal(heads(seen.first), seen.trajectories);
  // the heads move along their trajectories
  assert.notDeepEqual(seen.later.slice(-seen.trajectories), seen.first.slice(-seen.trajectories));
  assert.deepEqual(page.errors.filter((e) => !/Failed to load resource/.test(e)), []);
});
