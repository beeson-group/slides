// the scenes selected with the data-scene attribute of a `.backdrop`, computed on first use and
// cached

import { MU, closed, droFamily, lagrange, lyapunovFamily, open, propagate, ramp, spaced, step } from './orbits.ts';
import type { Member, Strand, Tone } from './orbits.ts';

// the integration step, nondimensional
const H = 0.004;

// a flight is stopped at the surface of a body or far from the system. the radii of the Earth and
// the Moon are 6378 km and 1738 km over 384400 km
const stopped = (u: Float64Array): boolean =>
  Math.hypot(u[0] + MU, u[1]) < 0.0166 || Math.hypot(u[0] - 1 + MU, u[1]) < 0.0045 || Math.hypot(u[0] - 0.8, u[1]) > 2.4;

const toned = (s: Strand, tone: Tone): Strand => ({ ...s, tone });

// the same flight mirrored in the x axis with time reversed, which is the symmetry of the CR3BP
// that turns an unstable manifold into a stable one
function mirrored(s: Strand): Strand {
  const n = s.times.length, pts = new Float64Array(2 * n), times = new Float32Array(n);
  const end = s.times[n - 1];
  for (let i = 0; i < n; i++) {
    pts[2 * i] = s.pts[2 * (n - 1 - i)];
    pts[2 * i + 1] = -s.pts[2 * (n - 1 - i) + 1];
    times[i] = end - s.times[n - 1 - i];
  }
  return { pts, times, T: end };
}

// states of a closed Lyapunov orbit, sampled over one period
function sampled(orbit: Member, T: number): Float64Array[] {
  const states: Float64Array[] = [], s = Float64Array.from(orbit.s);
  for (let t = 0; t < T; t += step(s, H)) states.push(Float64Array.from(s));
  return states;
}

// a copy of the state, kicked by plus or minus 1e-5 along its velocity
function kicked(s0: Float64Array, sign: number): Float64Array {
  const v = Math.hypot(s0[3], s0[4]), k = Float64Array.from(s0);
  k[3] += (sign * 1e-5 * s0[3]) / v;
  k[4] += (sign * 1e-5 * s0[4]) / v;
  return k;
}

// the stable and unstable manifold tubes of the Lyapunov orbit of amplitude A at Ln, from flights of
// span periods out of the given number of phases. the orbit itself is the first strand
function tubes(n: 1 | 2, A: number, phases: number, span: number): Strand[] {
  const orbit = lyapunovFamily(n, [A], H)[0];
  if (!orbit) return [];
  const first = closed(orbit), states = sampled(orbit, first.T);
  const out: Strand[] = [toned(first, 'text')];
  for (let k = 0; k < phases; k++) {
    const i = Math.floor((k / phases) * states.length);
    for (const sign of [1, -1]) {
      const p: number[] = [], q: number[] = [];
      propagate(kicked(states[i], sign), H, span * first.T, p, q, stopped, 0);
      const u = open(p, q);
      out.push(toned(u, 'orange'), toned(mirrored(u), 'violet'));
    }
  }
  return out;
}

// unit directions of the unstable manifold along a Lyapunov orbit, one per sampled state: a small
// offset is flown beside the orbit and rescaled at each step, hence after a period it is aligned
// with the most unstable direction, and its sign is continuous along the orbit
function unstable(orbit: Member, T: number): { states: Float64Array[]; dirs: Float64Array[] } {
  const e = 1e-7;
  let offset = new Float64Array(6);
  offset[0] = 1;
  const states: Float64Array[] = [], dirs: Float64Array[] = [];
  for (let lap = 0; lap < 3; lap++) {
    // the orbit is unstable, hence the reference is restarted on it at each lap
    const a = Float64Array.from(orbit.s), b = Float64Array.from(orbit.s);
    for (let i = 0; i < 6; i++) b[i] += e * offset[i];
    for (let t = 0; t < T;) {
      t += step(a, H);
      step(b, H);
      const d = new Float64Array(6);
      let n = 0;
      for (let i = 0; i < 6; i++) { d[i] = b[i] - a[i]; n += d[i] * d[i]; }
      n = Math.sqrt(n);
      for (let i = 0; i < 6; i++) { d[i] /= n; b[i] = a[i] + e * d[i]; }
      offset = d;
      if (lap === 2) { states.push(Float64Array.from(a)); dirs.push(d); }
    }
  }
  return { states, dirs };
}

// the tube of the L1 Lyapunov orbit of amplitude A toward the Earth, as a dense ribbon: one flight
// from each of the given number of phases, ended at a crossing of the x axis, with its stable mirror
function ribbon(A: number, phases: number, crossings: number, alpha: number, kick = 1e-5): Strand[] {
  const orbit = lyapunovFamily(1, [A], H)[0];
  if (!orbit) return [];
  const first = closed(orbit), { states, dirs } = unstable(orbit, first.T), out: Strand[] = [];
  const xL = lagrange(1);
  // the branch toward the Earth is chosen from a trial flight
  let sign = 1;
  {
    const u = Float64Array.from(states[0]);
    for (let i = 0; i < 6; i++) u[i] += kick * dirs[0][i];
    const p: number[] = [], q: number[] = [];
    propagate(u, H, 12, p, q, (v) => Math.abs(v[0] - xL) > 0.1, 0);
    if (p[p.length - 3] > xL) sign = -1;
  }
  for (let k = 0; k < phases; k++) {
    const i = Math.floor((k / phases) * states.length), u = Float64Array.from(states[i]);
    for (let j = 0; j < 6; j++) u[j] += sign * kick * dirs[i][j];
    let count = 0, y = u[1], left = false;
    const p: number[] = [], q: number[] = [];
    propagate(u, H, 40, p, q, (v) => {
      if (v[0] < xL - 0.2) left = true;
      if (left && y * v[1] < 0) count++;
      y = v[1];
      return count >= crossings || stopped(v);
    }, 0);
    const s = open(p, q);
    out.push({ ...toned(s, 'orange'), alpha }, { ...toned(mirrored(s), 'violet'), alpha });
  }
  return [toned(first, 'text'), ...out];
}

const SCENES = {
  nest: () => [...lyapunovFamily(1, spaced(0.012, 0.12, 12, 1.5), H), ...lyapunovFamily(2, spaced(0.012, 0.14, 12, 1.5), H), ...droFamily(ramp(0.03, 0.09, 1.2), H)].map(closed),
  tubes: () => [...tubes(1, 0.0313, 14, 2.2), ...tubes(2, 0.0408, 14, 2.2)],
  wideRibbon: () => ribbon(0.016, 120, 3, 0.12),
} satisfies Record<string, () => Strand[]>;

export type SceneName = keyof typeof SCENES;
export const SCENE_NAMES = Object.keys(SCENES) as SceneName[];

const cache = new Map<string, Strand[]>();

// the strands of the scene name, or an empty list for an unknown name
export function scene(name: string): Strand[] {
  let out = cache.get(name);
  if (!out) {
    out = name in SCENES ? SCENES[name as SceneName]() : [];
    cache.set(name, out);
  }
  return out;
}
