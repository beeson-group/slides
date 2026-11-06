// the scenes selected with the data-scene attribute of a `.backdrop`, computed on first use and
// cached

import { MU, closed, droFamily, lyapunovFamily, open, propagate, ramp, spaced, step } from './orbits.ts';
import type { Member, Strand } from './orbits.ts';

// the integration step, nondimensional
const H = 0.004;

// a trajectory is cut outside this window of the rotating frame or at the surface of a body. the
// radii of the Earth and the Moon are 6378 km and 1738 km over 384400 km
const outside = (s: Float64Array): boolean =>
  Math.abs(s[0] - 0.85) > 0.6 || Math.abs(s[1]) > 0.5 || Math.hypot(s[0] + MU, s[1]) < 0.0166 || Math.hypot(s[0] - 1 + MU, s[1]) < 0.0045;

// the unstable manifold of the L1 Lyapunov orbit of amplitude 0.05, in its two branches. each copy
// of the state of the orbit is kicked by plus or minus 1e-5 along its velocity at one of count
// phases spread over the period, and flown for 2.5 periods. times[0] of a strand is its phase,
// hence the head of the strand is first drawn on the head of the orbit. the orbit itself is the
// first strand
function manifold(count = 14): Strand[] {
  const orbit: Member | undefined = lyapunovFamily(1, [0.05], H)[0];
  if (!orbit) return [];
  const first = closed(orbit), T = first.T;
  const times: number[] = [], states: Float64Array[] = [];
  const s = Float64Array.from(orbit.s);
  for (let t = 0; t < T; t += step(s, H)) {
    states.push(Float64Array.from(s));
    times.push(t);
  }
  const strands = [first];
  const phases = count / 2;
  for (let k = 0; k < phases; k++) {
    const target = (k / phases) * T;
    let i = 0;
    while (i < times.length - 1 && times[i + 1] <= target) i++;
    const s0 = states[i], v = Math.hypot(s0[3], s0[4]);
    for (const sign of [1, -1]) {
      const kicked = Float64Array.from(s0);
      kicked[3] += (sign * 1e-5 * s0[3]) / v;
      kicked[4] += (sign * 1e-5 * s0[4]) / v;
      const p: number[] = [], q: number[] = [];
      propagate(kicked, H, 2.5 * T, p, q, outside, times[i]);
      strands.push(open(p, q));
    }
  }
  return strands;
}

const SCENES = {
  nest: () => [...lyapunovFamily(1, spaced(0.012, 0.12, 12, 1.5), H), ...lyapunovFamily(2, spaced(0.012, 0.14, 12, 1.5), H), ...droFamily(ramp(0.03, 0.09, 1.2), H)].map(closed),
  dro: () => droFamily(ramp(0.02, 0.32, 1.12), H).filter((_, i) => i % 3 === 0).map(closed),
  l1: () => lyapunovFamily(1, spaced(0.006, 0.17, 26, 1.35), H).map(closed),
  l2: () => lyapunovFamily(2, spaced(0.006, 0.17, 24, 1.35), H).map(closed),
  lyapunovs: () => [...lyapunovFamily(1, spaced(0.006, 0.1, 16, 1.3), H), ...lyapunovFamily(2, spaced(0.006, 0.11, 16, 1.3), H)].map(closed),
  mark: () => droFamily([0.1], H).map(closed),
  manifold: () => manifold(),
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
