// writes the data of the plot of the demo deck, the Floquet multipliers of the planar Lyapunov
// families about L1 and L2, into the JSON block between the two marker comments in a deck. the
// families are continued with src/orbits.ts, and the monodromy matrix of each member is found by
// integrating the variational equations of the circular restricted three-body problem over one
// period, with a fixed-step RK4. run it with Node 23 or later, which strips the types of the
// TypeScript import, as
//
//     node demo/multipliers.mjs index.html

import { readFileSync, writeFileSync } from 'node:fs';
import { MU, lagrange, lyapunovFamily, spaced } from '../src/orbits.ts';

const START = '<!-- plot data start, written by demo/multipliers.mjs -->';
const END = '<!-- plot data end -->';
const STEPS = 6000;
// the last distance of the families, where the pair is still in the window of the plane
const LAST = 0.13;

// y holds the state in its first 6 entries and the state transition matrix, row by row, in the
// next 36. the Jacobian is the Hessian of the effective potential with the Coriolis block
function rhs(y, out) {
  const x = y[0], yy = y[1], z = y[2];
  const dx1 = x + MU, dx2 = x - 1 + MU;
  const r1s = dx1 * dx1 + yy * yy + z * z, r2s = dx2 * dx2 + yy * yy + z * z;
  const r1 = Math.sqrt(r1s), r2 = Math.sqrt(r2s);
  const a = (1 - MU) / (r1s * r1), b = MU / (r2s * r2);
  const a5 = (3 * (1 - MU)) / (r1s * r1s * r1), b5 = (3 * MU) / (r2s * r2s * r2);
  out[0] = y[3];
  out[1] = y[4];
  out[2] = y[5];
  out[3] = 2 * y[4] + x - a * dx1 - b * dx2;
  out[4] = -2 * y[3] + yy - (a + b) * yy;
  out[5] = -(a + b) * z;
  const uxx = 1 - a - b + a5 * dx1 * dx1 + b5 * dx2 * dx2;
  const uyy = 1 - a - b + (a5 + b5) * yy * yy;
  const uzz = -a - b + (a5 + b5) * z * z;
  const uxy = (a5 * dx1 + b5 * dx2) * yy;
  const uxz = (a5 * dx1 + b5 * dx2) * z;
  const uyz = (a5 + b5) * yy * z;
  for (let j = 0; j < 6; j++) {
    const p = (i) => y[6 + 6 * i + j];
    out[6 + j] = p(3);
    out[12 + j] = p(4);
    out[18 + j] = p(5);
    out[24 + j] = uxx * p(0) + uxy * p(1) + uxz * p(2) + 2 * p(4);
    out[30 + j] = uxy * p(0) + uyy * p(1) + uyz * p(2) - 2 * p(3);
    out[36 + j] = uxz * p(0) + uyz * p(1) + uzz * p(2);
  }
}

// the state and the monodromy matrix after one period T from s0
function monodromy(s0, T) {
  const y = new Float64Array(42);
  for (let i = 0; i < 6; i++) { y[i] = s0[i]; y[6 + 7 * i] = 1; }
  const k1 = new Float64Array(42), k2 = new Float64Array(42), k3 = new Float64Array(42), k4 = new Float64Array(42), t = new Float64Array(42);
  const h = T / STEPS;
  for (let s = 0; s < STEPS; s++) {
    rhs(y, k1);
    for (let i = 0; i < 42; i++) t[i] = y[i] + 0.5 * h * k1[i];
    rhs(t, k2);
    for (let i = 0; i < 42; i++) t[i] = y[i] + 0.5 * h * k2[i];
    rhs(t, k3);
    for (let i = 0; i < 42; i++) t[i] = y[i] + h * k3[i];
    rhs(t, k4);
    for (let i = 0; i < 42; i++) y[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
  return y;
}

// the pair of multipliers with the stability index zeta = (lambda + 1/lambda)/2, as [re, im]
// twice. a complex pair is ordered with the positive imaginary part first, and a real pair with
// the larger magnitude first, so that the order is continuous where the pair leaves the unit circle
function pair(zeta) {
  const d = zeta * zeta - 1;
  if (d < 0) return [[zeta, Math.sqrt(-d)], [zeta, -Math.sqrt(-d)]];
  const big = zeta + Math.sign(zeta) * Math.sqrt(d);
  return [[big, 0], [1 / big, 0]];
}

const round = (x, digits = 4) => Number(x.toFixed(digits));

function tab(n) {
  const xL = lagrange(n);
  const members = lyapunovFamily(n, spaced(0.004, LAST, 90, 1.3), 0.004);
  const computed = members.map((m) => {
    const y = monodromy(m.s, 2 * m.t);
    const M = (i, j) => y[6 + 6 * i + j];
    const closure = Math.hypot(y[0] - m.s[0], y[1] - m.s[1], y[3] - m.s[3], y[4] - m.s[4]);
    const det = M(2, 2) * M(5, 5) - M(2, 5) * M(5, 2);
    if (closure > 1e-3 || Math.abs(det - 1) > 1e-6) throw new Error(`L${n}: a member does not close or keep its volume, closure ${closure}, determinant ${det}`);
    // the indices of the in-plane pair, from the in-plane block without the trivial pair, and of
    // the vertical pair, from the out-of-plane block
    const zh = (M(0, 0) + M(1, 1) + M(3, 3) + M(4, 4) - 2) / 2;
    const zv = (M(2, 2) + M(5, 5)) / 2;
    return { A: Math.abs(m.s[0] - xL), lh: pair(zh)[0][0], zv, level: 0 };
  });
  // a crossing of zeta = 1 or zeta = -1 is added as a frame, interpolated between two members, so
  // that the pair is drawn on the real axis there. a pair moves fast near a crossing, as the square
  // root of the distance in zeta, and it would cut a chord between two members
  const rows = [];
  computed.forEach((r, i) => {
    rows.push(r);
    const next = computed[i + 1];
    if (!next) return;
    for (const level of [1, -1]) {
      const f = (r.zv - level) / (r.zv - next.zv);
      if (f > 0 && f < 1) rows.push({ A: r.A + f * (next.A - r.A), lh: r.lh + f * (next.lh - r.lh), zv: level, level });
    }
  });
  const plus = [], minus = [], rings = [];
  rows.forEach((r, frame) => {
    if (!r.level) return;
    (r.level > 0 ? plus : minus).push({ frame, at: [round(r.A), r.level], text: '' });
    rings.push({ frame, at: [r.level, 0] });
  });
  if (plus.length !== 2 || minus.length !== 1) throw new Error(`L${n}: ${plus.length} crossings of zeta = 1 and ${minus.length} of zeta = -1 are found, and 2 and 1 are expected`);
  plus[0].text = 'halo';
  plus[1].text = 'axial';
  minus[0].text = 'period doubling';
  const v = rows.map((r) => pair(r.zv));
  return {
    name: `l${n}`,
    label: `$\\mathrm{L}_${n}$ family`,
    values: rows.map((r) => round(r.A)),
    data: {
      trivial: [[1, 0, 1, 0]],
      stable: rows.map((r) => [round(1 / r.lh, 5), 0]),
      first: v.map(([p]) => p.map((x) => round(x))),
      second: v.map(([, q]) => q.map((x) => round(x))),
      unstable: { at: [2.25, 0.3], text: rows.map((r) => `$\\lambda_{\\mathrm{h}} = ${Math.round(r.lh)} \\to$`) },
      index: rows.map((r) => [round(r.A), round(r.zv)]),
      plus,
      minus,
      rings,
    },
    active: rows.map((r) => (Math.abs(r.zv) < 1 ? ['on'] : ['off'])),
  };
}

const ticks = (a, b, s) => Array.from({ length: Math.round((b - a) / s) + 1 }, (_, i) => round(a + i * s));

const plot = {
  parameter: { label: '$A$', digits: 3 },
  duration: 10,
  hold: 1.5,
  panels: [
    {
      id: 'plane',
      x: { range: [-2.7, 2.3] },
      y: { range: [-1.25, 1.25] },
      equal: true,
      axes: false,
      curves: [
        { points: [[-2.7, 0], [2.3, 0]], tone: 'muted', width: 2 },
        { points: [[0, -1.25], [0, 1.25]], tone: 'muted', width: 2 },
        { circle: [0, 0, 1], tone: 'subtle', width: 2 },
      ],
      labels: [
        { at: [1, 0], text: '1', anchor: 'start', dx: 10, dy: 24, tone: 'muted' },
        { at: [-1, 0], text: '$-1$', anchor: 'end', dx: -10, dy: 24, tone: 'muted' },
        { at: [0, 0], text: '$\\lambda_{\\mathrm{s}}$', anchor: 'start', dx: 12, dy: -24, tone: 'subtle' },
        { at: [2.3, 1.25], text: 'Floquet multipliers', anchor: 'end', dy: -10, tone: 'subtle' },
      ],
    },
    {
      id: 'index',
      x: { range: [0, LAST], ticks: ticks(0, 0.1, 0.05), title: '$A$' },
      y: { range: [-1.5, 1.5], ticks: [-1, 0, 1], title: '$\\zeta$' },
      regions: [{ id: 'band', points: [[0, -1], [LAST, -1], [LAST, 1], [0, 1]], tone: 'violet', opacity: 0.1 }],
      curves: [
        { points: [[0, 1], [LAST, 1]], tone: 'violet', width: 2, dash: [8, 8] },
        { points: [[0, -1], [LAST, -1]], tone: 'violet', width: 2, dash: [8, 8] },
      ],
      labels: [
        { id: 'on', at: [LAST - 0.004, 0], text: 'on the circle', anchor: 'end', tone: 'text' },
        { id: 'off', at: [LAST - 0.004, 1.28], text: 'off the circle', anchor: 'end', tone: 'text' },
      ],
    },
  ],
  marks: [
    { id: 'trivial', panel: 'plane', kind: 'points', tone: 'subtle', hollow: true, size: 14, width: 2 },
    { id: 'stable', panel: 'plane', kind: 'points', tone: 'accent', size: 12 },
    { id: 'first', panel: 'plane', kind: 'trace', tone: 'accent', size: 14, width: 3 },
    { id: 'second', panel: 'plane', kind: 'trace', tone: 'accent', size: 14, width: 3 },
    { id: 'unstable', panel: 'plane', kind: 'label', tone: 'accent', anchor: 'end' },
    { id: 'rings', panel: 'plane', kind: 'events', tone: 'violet', size: 30, width: 2 },
    { id: 'index', panel: 'index', kind: 'trace', tone: 'accent', size: 14, width: 3 },
    { id: 'plus', panel: 'index', kind: 'events', tone: 'violet', size: 18, width: 2, dy: -34 },
    { id: 'minus', panel: 'index', kind: 'events', tone: 'violet', size: 18, width: 2, anchor: 'end', dx: 10, dy: 34 },
  ],
  tabs: [tab(1), tab(2)],
};

const file = process.argv[2];
if (!file) throw new Error('the path of a deck is expected, e.g. node demo/multipliers.mjs index.html');
const html = readFileSync(file, 'utf8');
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < a) throw new Error(`the markers ${START} and ${END} are not found in ${file}`);
const block = `<script type="application/json" id="multipliers">${JSON.stringify(plot)}</script>`;
writeFileSync(file, `${html.slice(0, a + START.length)}\n${block}\n${html.slice(b)}`);
for (const t of plot.tabs) {
  const crossings = [...t.data.plus, ...t.data.minus].map((e) => `${e.text} at A = ${e.at[0]}`).join(', ');
  console.log(`${t.name}: ${t.values.length} frames from A = ${t.values[0]} to ${t.values.at(-1)}, ${crossings}`);
}
