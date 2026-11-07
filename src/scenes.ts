// the scenes selected with the data-scene attribute of a `.backdrop`, computed on first use and
// cached

import { MU, closed, correct, droFamily, family, lyapunovFamily, open, propagate, ramp, spaced, step } from './orbits.ts';
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

// a symmetric spatial orbit, closed by mirroring in the xz plane and viewed from tilt rad above the
// xy plane, about the x axis so that the Moon and the libration points stay on the axis
function viewed(m: Member, tilt: number, flip = 1): Strand {
  const n = m.times.length, N = 2 * n - 1, c = Math.cos(tilt), d = Math.sin(tilt);
  const pts = new Float64Array(2 * N), tt = new Float32Array(N);
  for (let i = 0; i < n; i++) {
    const x = m.path[3 * i], y = m.path[3 * i + 1], z = flip * m.path[3 * i + 2];
    pts[2 * i] = x; pts[2 * i + 1] = y * c + z * d; tt[i] = m.times[i];
    const k = N - 1 - i;
    pts[2 * k] = x; pts[2 * k + 1] = -y * c + z * d; tt[k] = 2 * m.t - m.times[i];
  }
  return { pts, times: tt, T: 2 * m.t };
}

// the northern L2 halo family, continued in z up to z = 0.09 and then in x to a near rectilinear
// orbit, with its southern mirror. the last member is drawn in the accent color
function halos(tilt: number): Strand[] {
  const seed = (z: number) => { const s = new Float64Array(6); s[0] = 1.18; s[2] = z; s[4] = -0.1568; return s; };
  const a = family(seed, 2, spaced(0.0139, 0.09, 18, 1), [0, 4], [3, 5], H / 2, () => 0.3, () => 6, 0);
  const last = a[a.length - 1];
  if (!last) return [];
  const again = (x: number) => { const s = Float64Array.from(last.s); s[0] = x; return s; };
  const f = [...a, ...family(again, 0, spaced(last.s[0], 1.015, 20, 1), [2, 4], [3, 5], H / 2, () => 0.3, () => 6, 1)];
  return f.flatMap((m, i) => [toned(viewed(m, tilt), i === f.length - 1 ? 'hero' : 'line'), toned(viewed(m, tilt, -1), 'line')]);
}

// resonant orbits of p revolutions in q lunar periods, from Keplerian seeds at the perigee on the
// far side of the Earth
function resonant(p: number, q: number, eccentricities: number[]): Strand[] {
  const a = Math.pow(q / p, 2 / 3), out: Strand[] = [];
  for (const e of eccentricities) {
    const r = a * (1 - e), v = Math.sqrt((1 - MU) * (2 / r - 1 / a));
    const s = new Float64Array(6);
    s[0] = -r - MU; s[4] = r - v;
    const m = correct(s, [4], [3], H, Math.PI * q * 0.85, Math.PI * q * 1.15, 12);
    if (m) out.push(toned(closed(m), 'line'));
  }
  return out;
}

const SCENES = {
  nest: () => [...lyapunovFamily(1, spaced(0.012, 0.12, 12, 1.5), H), ...lyapunovFamily(2, spaced(0.012, 0.14, 12, 1.5), H), ...droFamily(ramp(0.03, 0.09, 1.2), H)].map(closed),
  dro: () => droFamily(ramp(0.02, 0.32, 1.12), H).filter((_, i) => i % 3 === 0).map(closed),
  l1: () => lyapunovFamily(1, spaced(0.006, 0.17, 26, 1.35), H).map(closed),
  l2: () => lyapunovFamily(2, spaced(0.006, 0.17, 24, 1.35), H).map(closed),
  lyapunovs: () => [...lyapunovFamily(1, spaced(0.006, 0.1, 16, 1.3), H), ...lyapunovFamily(2, spaced(0.006, 0.11, 16, 1.3), H)].map(closed),
  mark: () => droFamily([0.1], H).map(closed),
  tubes: () => [...tubes(1, 0.0313, 14, 2.2), ...tubes(2, 0.0408, 14, 2.2)],
  halo: () => halos(1.2),
  rosette: () => resonant(7, 2, spaced(0.04, 0.7, 14, 1)),
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
