// the scenes selected with the data-scene attribute of a `.backdrop`, computed on first use and
// cached

import { isolines } from './contour.ts';
import { MU, closed, correct, droFamily, family, lagrange, lyapunovFamily, open, propagate, ramp, spaced, step } from './orbits.ts';
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

// the zero-velocity curves of Jacobi constant C, traced with marching squares
function zeroVelocity(C: number): Strand[] {
  const x0 = -1.75, y0 = -1.45, d = 0.008, nx = 438, ny = 363;
  const f = (x: number, y: number) => {
    const r1 = Math.hypot(x + MU, y), r2 = Math.hypot(x - 1 + MU, y);
    return x * x + y * y + (2 * (1 - MU)) / r1 + (2 * MU) / r2 - C;
  };
  const g = new Float64Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) g[j * (nx + 1) + i] = f(x0 + i * d, y0 + j * d);
  return isolines(g, nx, ny, x0, y0, d).filter((c) => c.length > 16).map((c) => {
    const p: number[] = [], t: number[] = [];
    for (let k = 0; k < c.length; k += 2) { p.push(c[k], c[k + 1], 0); t.push(t.length * 0.004); }
    return toned(open(p, t), 'line');
  });
}

// the arc of a closed orbit from the point nearest a to the point nearest b, after one full lap
function lap(orbit: Strand, ax: number, ay: number, bx: number, by: number): Strand {
  const n = orbit.times.length - 1;
  const nearest = (x: number, y: number) => {
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.hypot(orbit.pts[2 * i] - x, orbit.pts[2 * i + 1] - y) < Math.hypot(orbit.pts[2 * best] - x, orbit.pts[2 * best + 1] - y)) best = i;
    return best;
  };
  const from = nearest(ax, ay), count = n + ((nearest(bx, by) - from + n) % n) + 1;
  const pts = new Float64Array(2 * count), times = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    const i = (from + k) % n;
    pts[2 * k] = orbit.pts[2 * i]; pts[2 * k + 1] = orbit.pts[2 * i + 1];
    if (k) times[k] = times[k - 1] + (orbit.times[(i || n)] - orbit.times[(i || n) - 1]);
  }
  return { pts, times, T: times[count - 1] };
}

// the strands joined end to end in time
function joined(parts: Strand[]): Strand {
  const pts: number[] = [], times: number[] = [];
  let t0 = 0;
  for (const part of parts) {
    pts.push(...part.pts);
    for (const t of part.times) times.push(t0 + t);
    t0 += part.T;
  }
  return { pts: Float64Array.from(pts), times: Float32Array.from(times), T: t0 };
}

// the points a to b of a strand, with times counted from a
function piece(s: Strand, a: number, b: number): Strand {
  const t0 = s.times[a], times = s.times.slice(a, b + 1).map((t) => t - t0);
  return { pts: s.pts.slice(2 * a, 2 * b + 2), times, T: times[times.length - 1] };
}

// the strand mirrored in the x axis and still drawn from its first point, i.e. a flight of the
// unstable manifold turned into one of the stable manifold traced backward in time
function reflected(s: Strand): Strand {
  const pts = Float64Array.from(s.pts);
  for (let i = 1; i < pts.length; i += 2) pts[i] = -pts[i];
  return { ...s, pts };
}

// the strand traced on the clock of the drawing from t0, at rate times its own clock
function retimed(s: Strand, t0: number, rate: number): Strand {
  const times = s.times.map((t) => t0 + rate * t);
  return { ...s, times, T: times[times.length - 1] };
}

// a low-energy transfer through the L2 Lyapunov orbit of amplitude A: from a perigee, through the
// neck at L1 and along the stable manifold of the orbit, once around it, and along its unstable
// manifold to a close pass of the Moon. the unstable branch toward the Moon is flown from phases
// points of the orbit and drawn up to its first perilune. its mirror image is the stable branch,
// whose flights that come from the Earth region by the shortest way are drawn back to their first
// perigee. a flight is taken from its first point 1e-3 off the orbit, and the joints of the path
// in the accent color are thus within 1e-3. this path is made of the flights with the lowest
// perigee and the closest perilune above 0.005, i.e. 200 km above the surface. on the clock of the
// drawing, the orbit is traced in the first tenth, the manifolds grow from it in the next three
// tenths, and the path is then flown on its own clock, with the only head of the scene
function transfer(A: number, phases: number): Strand[] {
  const orbit = lyapunovFamily(2, [A], H)[0];
  if (!orbit) return [];
  const first = closed(orbit), { states, dirs } = unstable(orbit, first.T), n = states.length;
  const xL1 = lagrange(1), xL2 = lagrange(2);
  const off = (i: number, sign: number) => {
    const u = Float64Array.from(states[i]);
    for (let j = 0; j < 6; j++) u[j] += sign * 1e-4 * dirs[i][j];
    return u;
  };
  // the branch toward the Moon is the one of the trial flight that comes closer to it. a flight of
  // the other branch may still turn back toward the Moon at a larger distance
  const nearest = (sign: number) => {
    const p: number[] = [];
    let d = 9;
    propagate(off(0, sign), H, first.T + 2, p, [], (v) => (d = Math.min(d, Math.hypot(v[0] - 1 + MU, v[1]))) < 0.05, 0);
    return d;
  };
  const sign = nearest(1) < nearest(-1) ? 1 : -1;
  // a perilune counts once the flight is closer to the Moon than the orbit ever is, since a flight
  // that leaves the orbit near its closest point to the Moon starts with a minimum of the distance
  let reach = 9;
  for (let i = 0; i < first.pts.length; i += 2) reach = Math.min(reach, Math.hypot(first.pts[i] - 1 + MU, first.pts[i + 1]));
  const flights: { s: Strand; perilune: number; transit: number; perigee: number }[] = [];
  for (let k = 0; k < phases; k++) {
    const i = Math.floor((k / phases) * n), p: number[] = [], q: number[] = [];
    propagate(off(i, sign), H, 12, p, q, stopped, 0);
    const m = q.length, x = (j: number) => p[3 * j], y = (j: number) => p[3 * j + 1];
    // the flight is stepped as the orbit was in unstable(), hence its point j is compared with the
    // points of the orbit from states[i + j] on
    let from = 0, c = i;
    const gap = (j: number, at: number) => Math.hypot(x(j) - states[at % n][0], y(j) - states[at % n][1]);
    for (; from < m - 1; from++) {
      while (gap(from, c + 1) < gap(from, c)) c++;
      if (gap(from, c) > 1e-3) break;
    }
    const r1 = (j: number) => Math.hypot(x(j) + MU, y(j)), r2 = (j: number) => Math.hypot(x(j) - 1 + MU, y(j));
    let perilune = -1, transit = -1, perigee = -1;
    for (let j = from + 1; j < m - 1; j++) {
      if (perilune < 0 && r2(j) < reach && r2(j) < r2(j - 1) && r2(j) <= r2(j + 1)) perilune = j;
      if (transit < 0 && x(j) < xL1) transit = j;
      if (transit >= 0 && r1(j) < r1(j - 1) && r1(j) <= r1(j + 1)) { perigee = j; break; }
    }
    // a flight that ends on the surface of the Moon is drawn up to it
    if (perilune < 0 && perigee < 0 && r2(m - 1) < 0.005) perilune = m - 1;
    const s = piece(open(p, q), from, m - 1);
    flights.push({ s, perilune: perilune - from, transit: transit - from, perigee: perigee - from });
  }
  // the flights through the neck within one unit of time of the earliest one form one bundle
  const through = flights.filter((f) => f.perigee >= 0);
  const earliest = Math.min(...through.map((f) => f.s.times[f.transit]));
  const bundle = through.filter((f) => f.s.times[f.transit] < earliest + 1);
  const r = (f: (typeof flights)[number], j: number, x0: number) => Math.hypot(f.s.pts[2 * j] - x0, f.s.pts[2 * j + 1]);
  const low = bundle.reduce<(typeof flights)[number] | null>((a, f) => (!a || r(f, f.perigee, -MU) < r(a, a.perigee, -MU) ? f : a), null);
  const passing = flights.filter((f) => f.perilune > 0);
  const close = passing.filter((f) => r(f, f.perilune, 1 - MU) > 0.005).reduce<(typeof flights)[number] | null>((a, f) => (!a || r(f, f.perilune, 1 - MU) < r(a, a.perilune, 1 - MU) ? f : a), null);
  if (!low || !close) return [];
  const unstableArcs = passing.map((f) => piece(f.s, 0, f.perilune)), stableArcs = bundle.map((f) => reflected(piece(f.s, 0, f.perigee)));
  const inbound = mirrored(piece(low.s, 0, low.perigee)), outbound = piece(close.s, 0, close.perilune), end = inbound.pts.length - 2;
  const path = joined([inbound, lap(first, inbound.pts[end], inbound.pts[end + 1], outbound.pts[0], outbound.pts[1]), outbound]);
  const longest = Math.max(...[...unstableArcs, ...stableArcs].map((s) => s.T)), unit = path.T / 6;
  return [
    { ...toned(retimed(first, 0, unit / first.T), 'text'), head: false },
    ...unstableArcs.map((s) => ({ ...toned(retimed(s, unit, (3 * unit) / longest), 'orange'), alpha: 0.2, head: false })),
    ...stableArcs.map((s) => ({ ...toned(retimed(s, unit, (3 * unit) / longest), 'violet'), alpha: 0.2, head: false })),
    { ...toned(retimed(path, 4 * unit, 1), 'hero'), head: true },
  ];
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

// the southern L2 near rectilinear halo orbit of period 1.53, flown for the given number of periods
// in the Earth-centered inertial frame, where the orbit about the Moon is drawn out into a band
function band(laps: number, tilt: number): Strand {
  const seed = new Float64Array(6);
  seed[0] = 1.0232; seed[2] = 0.1829; seed[4] = -0.1058;
  const m = correct(seed, [2, 4], [3, 5], H / 2, 0.3, 6, 12);
  if (!m) return { pts: new Float64Array(0), times: new Float32Array(0), T: 0 };
  const c = Math.cos(tilt), d = Math.sin(tilt), n = m.times.length, pts: number[] = [], times: number[] = [];
  const put = (i: number, sign: number, t: number) => {
    const x = m.path[3 * i] + MU, y = sign * m.path[3 * i + 1], z = -m.path[3 * i + 2];
    pts.push(x * Math.cos(t) - y * Math.sin(t) - MU, (x * Math.sin(t) + y * Math.cos(t)) * c + z * d);
    times.push(t);
  };
  for (let lap = 0; lap < laps; lap++) {
    const t0 = 2 * m.t * lap;
    for (let i = 0; i < n; i++) put(i, 1, t0 + m.times[i]);
    for (let i = n - 2; i > 0; i--) put(i, -1, t0 + 2 * m.t - m.times[i]);
  }
  return { pts: Float64Array.from(pts), times: Float32Array.from(times), T: times[times.length - 1] };
}

// a low-thrust flight from the Earth out to the Moon in the inertial frame, viewed from tilt rad above
// the plane of the Moon: a spiral with continuous tangential thrust up to the semimajor axis a1, then
// thrust on the perigee half of each revolution up to a2, then a coast until the flight falls back to
// the distance of the Moon. this flight is illustrative and is not an optimal transfer
function spiral(acc: number, r0: number, a1: number, a2: number, tilt: number, laps: number): Strand[] {
  const c = Math.cos(tilt), mu = 1 - MU;
  const s = [r0, 0, 0, Math.sqrt(mu / r0)];
  let t = 0, phase = 0, out = false, end = Infinity;
  const parts: { p: number[]; q: number[] }[] = [{ p: [], q: [] }, { p: [], q: [] }, { p: [], q: [] }];
  const f = (u: number[], tt: number, A: number): number[] => {
    const r = Math.hypot(u[0], u[1]), mx = Math.cos(tt), my = Math.sin(tt);
    const dx = u[0] - mx, dy = u[1] - my, d = Math.hypot(dx, dy), v = Math.hypot(u[2], u[3]);
    return [u[2], u[3], -mu * u[0] / r ** 3 - MU * dx / d ** 3 - MU * mx + A * u[2] / v, -mu * u[1] / r ** 3 - MU * dy / d ** 3 - MU * my + A * u[3] / v];
  };
  for (let n = 0; n < 300000; n++) {
    const r = Math.hypot(s[0], s[1]), d = Math.hypot(s[0] - Math.cos(t), s[1] - Math.sin(t));
    if (r < 0.0166 || d < 0.0045 || r > 2.6) break;
    if (phase === 2 && r > 1.15) out = true;
    if ((out && r < 1) || t > end) break;
    const E = (s[2] ** 2 + s[3] ** 2) / 2 - mu / r, sma = E < 0 ? -mu / (2 * E) : 9;
    if (phase === 0 && sma > a1) phase = 1;
    if (phase === 1 && sma > a2) { phase = 2; end = t + 14; }
    const A = phase === 0 || (phase === 1 && r < sma) ? acc : 0;
    const h = 0.05 * Math.min(r ** 1.5, 4 * d ** 1.5);
    parts[phase].p.push(s[0] - MU, s[1] * c, 0); parts[phase].q.push(t);
    const k1 = f(s, t, A), k2 = f(s.map((v, i) => v + 0.5 * h * k1[i]), t + h / 2, A);
    const k3 = f(s.map((v, i) => v + 0.5 * h * k2[i]), t + h / 2, A), k4 = f(s.map((v, i) => v + h * k3[i]), t + h, A);
    for (let i = 0; i < 4; i++) s[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    t += h;
  }
  const [p0, p1, p2] = parts;
  return [toned(band(laps, tilt), 'line'), { ...toned(open(p2.p, p2.q), 'violet'), alpha: 0.85 }, { ...toned(open(p1.p, p1.q), 'violet'), alpha: 0.85 }, { ...toned(open(p0.p, p0.q), 'orange'), alpha: 0.85 }].filter((x) => x.times.length > 1);
}

// the flight from the state s for the time T, as a strand seen from tilt rad above the xy plane
function flown(s: Float64Array, h: number, T: number, tilt = 0, stop?: (u: Float64Array) => boolean): Strand {
  const p: number[] = [], q: number[] = [], c = Math.cos(tilt), d = Math.sin(tilt);
  propagate(s, h, T, p, q, stop, 0);
  for (let i = 0; i < q.length; i++) p[3 * i + 1] = p[3 * i + 1] * c + p[3 * i + 2] * d;
  return open(p, q);
}

const fraction = (v: number): number => v - Math.floor(v);

// quasi-periodic strands hugging distant retrograde orbits: an orbit with a small perturbation in and
// out of the plane, flown for many revolutions, winds a narrow torus around itself
function tori(tilt: number): Strand[] {
  return droFamily(spaced(0.07, 0.42, 25, 1.2), H).filter((_, i) => i % 5 === 0).map((m, i) => {
    const s = Float64Array.from(m.s);
    s[4] *= 1.006; s[2] = i % 2 ? 0.014 : -0.014;
    return toned(flown(s, 0.01, 22 * m.t, tilt), i % 2 ? 'violet' : 'orange');
  });
}

// the unstable tube of an L1 orbit and the stable tube of an L2 orbit, interlaced about the Moon
function lace(A1: number, A2: number, phases: number, span: number): Strand[] {
  const out: Strand[] = [];
  for (const [n, A] of [[1, A1], [2, A2]] as const) {
    const orbit = lyapunovFamily(n, [A], H)[0];
    if (!orbit) continue;
    const first = closed(orbit), { states, dirs } = unstable(orbit, first.T), xL = lagrange(n);
    out.push(toned(first, 'text'));
    // the branch toward the Moon is chosen from a trial flight
    const toMoon = (sign: number) => {
      const u = Float64Array.from(states[0]);
      for (let i = 0; i < 6; i++) u[i] += sign * 1e-5 * dirs[0][i];
      const p: number[] = [], q: number[] = [];
      propagate(u, H, 12, p, q, (v) => Math.abs(v[0] - xL) > 0.1, 0);
      return Math.abs(p[p.length - 3] - (1 - MU)) < Math.abs(xL - (1 - MU));
    };
    const sign = toMoon(1) ? 1 : -1;
    for (let k = 0; k < phases; k++) {
      const i = Math.floor((k / phases) * states.length), u = Float64Array.from(states[i]);
      for (let j = 0; j < 6; j++) u[j] += sign * 1e-5 * dirs[i][j];
      const s = flown(u, H, span, 0, (v) => Math.hypot(v[0] - 1 + MU, v[1]) < 0.008 || Math.hypot(v[0] - 1 + MU, v[1]) > 0.5);
      out.push(n === 1 ? { ...toned(s, 'orange'), alpha: 0.3 } : { ...toned(mirrored(s), 'violet'), alpha: 0.3 });
    }
  }
  return out;
}

// a sheaf of lunar transfers from a low Earth orbit, with a spread of apogees and departure angles
function sheaf(count: number): Strand[] {
  const rp = 0.02, out: Strand[] = [];
  for (let i = 0; i < count; i++) {
    const ra = 0.92 + 0.2 * fraction(i * 0.618), a = (rp + ra) / 2, v = Math.sqrt((1 - MU) * (2 / rp - 1 / a));
    const al = -2 + 0.4 * (fraction(i * 0.382) - 0.5), s = new Float64Array(6);
    s[0] = -MU + rp * Math.cos(al); s[1] = rp * Math.sin(al);
    s[3] = -(v - rp) * Math.sin(al); s[4] = (v - rp) * Math.cos(al);
    out.push(toned(flown(s, 0.004, 3.5, 0, (q) => Math.hypot(q[0] + MU, q[1]) < 0.015 || Math.hypot(q[0] - 1 + MU, q[1]) < 0.005 || Math.hypot(q[0], q[1]) > 2), 'orange'));
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
  hill: () => [3.25, 3.2, 3.188, 3.172, 3.15, 3.12, 3.08, 3.05, 3.012, 2.99, 2.97, 2.95, 2.93, 2.91, 2.89].flatMap(zeroVelocity),
  transfer: () => transfer(0.045, 400),
  ribbon: () => ribbon(0.006, 90, 3, 0.16),
  wideRibbon: () => ribbon(0.016, 120, 3, 0.12),
  spiral: () => spiral(0.11, 0.07, 0.42, 0.92, 0.44, 60),
  torus: () => tori(1),
  lace: () => lace(0.05, 0.06, 40, 9),
  sheaf: () => sheaf(36),
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
