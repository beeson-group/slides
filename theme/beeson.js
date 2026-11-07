/*! beeson.js 1.0.0, the reveal.js theme of the Beeson group. MIT license. The orbit engine is ported from src/lib/orbits.ts of https://github.com/ClouD-161803/ClouD-161803.github.io (MIT). */
"use strict";
(() => {
  // src/contour.ts
  function isolines(g, nx, ny, x0, y0, dx, dy = dx, close = false) {
    const at = (i, j) => g[j * (nx + 1) + i];
    const links = /* @__PURE__ */ new Map(), where = /* @__PURE__ */ new Map();
    const edge = (i, j, h) => {
      const key = `${h ? "h" : "v"}${i},${j}`;
      if (!where.has(key)) {
        const a = at(i, j), b = h ? at(i + 1, j) : at(i, j + 1), t = a / (a - b);
        where.set(key, h ? [x0 + (i + t) * dx, y0 + j * dy] : [x0 + i * dx, y0 + (j + t) * dy]);
      }
      return key;
    };
    const link = (a, b) => {
      if (!links.has(a)) links.set(a, []);
      if (!links.has(b)) links.set(b, []);
      links.get(a)?.push(b);
      links.get(b)?.push(a);
    };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const hits = [];
      if (at(i, j) > 0 !== at(i + 1, j) > 0) hits.push(edge(i, j, true));
      if (at(i + 1, j) > 0 !== at(i + 1, j + 1) > 0) hits.push(edge(i + 1, j, false));
      if (at(i, j + 1) > 0 !== at(i + 1, j + 1) > 0) hits.push(edge(i, j + 1, true));
      if (at(i, j) > 0 !== at(i, j + 1) > 0) hits.push(edge(i, j, false));
      if (hits.length === 2) link(hits[0], hits[1]);
      else if (hits.length === 4) {
        link(hits[0], hits[1]);
        link(hits[2], hits[3]);
      }
    }
    const out = [], seen = /* @__PURE__ */ new Set();
    for (const start2 of links.keys()) {
      if (seen.has(start2)) continue;
      const p = [];
      let cur = start2;
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        const [x, y] = where.get(cur) ?? [0, 0];
        p.push(x, y);
        const next = links.get(cur)?.find((k) => !seen.has(k));
        if (!next && close && p.length > 4 && links.get(cur)?.includes(start2)) p.push(p[0], p[1]);
        cur = next;
      }
      out.push(p);
    }
    return out;
  }

  // src/scenes.ts
  var H = 4e-3;
  var stopped = (u) => Math.hypot(u[0] + MU, u[1]) < 0.0166 || Math.hypot(u[0] - 1 + MU, u[1]) < 45e-4 || Math.hypot(u[0] - 0.8, u[1]) > 2.4;
  var toned = (s, tone) => ({ ...s, tone });
  function mirrored(s) {
    const n = s.times.length, pts = new Float64Array(2 * n), times = new Float32Array(n);
    const end = s.times[n - 1];
    for (let i = 0; i < n; i++) {
      pts[2 * i] = s.pts[2 * (n - 1 - i)];
      pts[2 * i + 1] = -s.pts[2 * (n - 1 - i) + 1];
      times[i] = end - s.times[n - 1 - i];
    }
    return { pts, times, T: end };
  }
  function sampled(orbit, T) {
    const states = [], s = Float64Array.from(orbit.s);
    for (let t = 0; t < T; t += step(s, H)) states.push(Float64Array.from(s));
    return states;
  }
  function kicked(s0, sign) {
    const v = Math.hypot(s0[3], s0[4]), k = Float64Array.from(s0);
    k[3] += sign * 1e-5 * s0[3] / v;
    k[4] += sign * 1e-5 * s0[4] / v;
    return k;
  }
  function tubes(n, A, phases, span) {
    const orbit = lyapunovFamily(n, [A], H)[0];
    if (!orbit) return [];
    const first = closed(orbit), states = sampled(orbit, first.T);
    const out = [toned(first, "text")];
    for (let k = 0; k < phases; k++) {
      const i = Math.floor(k / phases * states.length);
      for (const sign of [1, -1]) {
        const p = [], q = [];
        propagate(kicked(states[i], sign), H, span * first.T, p, q, stopped, 0);
        const u = open(p, q);
        out.push(toned(u, "orange"), toned(mirrored(u), "violet"));
      }
    }
    return out;
  }
  function viewed(m, tilt, flip2 = 1) {
    const n = m.times.length, N = 2 * n - 1, c = Math.cos(tilt), d = Math.sin(tilt);
    const pts = new Float64Array(2 * N), tt = new Float32Array(N);
    for (let i = 0; i < n; i++) {
      const x = m.path[3 * i], y = m.path[3 * i + 1], z = flip2 * m.path[3 * i + 2];
      pts[2 * i] = x;
      pts[2 * i + 1] = y * c + z * d;
      tt[i] = m.times[i];
      const k = N - 1 - i;
      pts[2 * k] = x;
      pts[2 * k + 1] = -y * c + z * d;
      tt[k] = 2 * m.t - m.times[i];
    }
    return { pts, times: tt, T: 2 * m.t };
  }
  function halos(tilt) {
    const seed = (z) => {
      const s = new Float64Array(6);
      s[0] = 1.18;
      s[2] = z;
      s[4] = -0.1568;
      return s;
    };
    const a = family(seed, 2, spaced(0.0139, 0.09, 18, 1), [0, 4], [3, 5], H / 2, () => 0.3, () => 6, 0);
    const last = a[a.length - 1];
    if (!last) return [];
    const again = (x) => {
      const s = Float64Array.from(last.s);
      s[0] = x;
      return s;
    };
    const f = [...a, ...family(again, 0, spaced(last.s[0], 1.015, 20, 1), [2, 4], [3, 5], H / 2, () => 0.3, () => 6, 1)];
    return f.flatMap((m, i) => [toned(viewed(m, tilt), i === f.length - 1 ? "hero" : "line"), toned(viewed(m, tilt, -1), "line")]);
  }
  function resonant(p, q, eccentricities) {
    const a = Math.pow(q / p, 2 / 3), out = [];
    for (const e of eccentricities) {
      const r = a * (1 - e), v = Math.sqrt((1 - MU) * (2 / r - 1 / a));
      const s = new Float64Array(6);
      s[0] = -r - MU;
      s[4] = r - v;
      const m = correct(s, [4], [3], H, Math.PI * q * 0.85, Math.PI * q * 1.15, 12);
      if (m) out.push(toned(closed(m), "line"));
    }
    return out;
  }
  function zeroVelocity(C) {
    const x0 = -1.75, y0 = -1.45, d = 8e-3, nx = 438, ny = 363;
    const f = (x, y) => {
      const r1 = Math.hypot(x + MU, y), r2 = Math.hypot(x - 1 + MU, y);
      return x * x + y * y + 2 * (1 - MU) / r1 + 2 * MU / r2 - C;
    };
    const g = new Float64Array((nx + 1) * (ny + 1));
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) g[j * (nx + 1) + i] = f(x0 + i * d, y0 + j * d);
    return isolines(g, nx, ny, x0, y0, d).filter((c) => c.length > 16).map((c) => {
      const p = [], t = [];
      for (let k = 0; k < c.length; k += 2) {
        p.push(c[k], c[k + 1], 0);
        t.push(t.length * 4e-3);
      }
      return toned(open(p, t), "line");
    });
  }
  function lap(orbit, ax, ay, bx, by) {
    const n = orbit.times.length - 1;
    const nearest = (x, y) => {
      let best = 0;
      for (let i = 1; i < n; i++) if (Math.hypot(orbit.pts[2 * i] - x, orbit.pts[2 * i + 1] - y) < Math.hypot(orbit.pts[2 * best] - x, orbit.pts[2 * best + 1] - y)) best = i;
      return best;
    };
    const from = nearest(ax, ay), count = n + (nearest(bx, by) - from + n) % n + 1;
    const pts = new Float64Array(2 * count), times = new Float32Array(count);
    for (let k = 0; k < count; k++) {
      const i = (from + k) % n;
      pts[2 * k] = orbit.pts[2 * i];
      pts[2 * k + 1] = orbit.pts[2 * i + 1];
      if (k) times[k] = times[k - 1] + (orbit.times[i || n] - orbit.times[(i || n) - 1]);
    }
    return { pts, times, T: times[count - 1] };
  }
  function joined(parts) {
    const pts = [], times = [];
    let t0 = 0;
    for (const part of parts) {
      pts.push(...part.pts);
      for (const t of part.times) times.push(t0 + t);
      t0 += part.T;
    }
    return { pts: Float64Array.from(pts), times: Float32Array.from(times), T: t0 };
  }
  function transfer(A) {
    const orbit = lyapunovFamily(1, [A], H)[0];
    if (!orbit) return [];
    const first = closed(orbit), states = sampled(orbit, first.T), xL = lagrange(1);
    let inbound = null, outbound = null, perigee = 9, perilune = 9;
    const faint = [];
    for (let k = 0; k < 120; k++) {
      const i = Math.floor(k / 120 * states.length);
      for (const sign of [1, -1]) {
        const p = [], q = [];
        propagate(kicked(states[i], sign), H, 5 * first.T, p, q, stopped, 0);
        const n = q.length;
        let side = 0;
        for (let j = 0; j < n && !side; j++) if (Math.abs(p[3 * j] - xL) > 2 * A) side = Math.sign(p[3 * j] - xL);
        const body = side < 0 ? -MU : 1 - MU, reach = side < 0 ? 0.3 : 0.05;
        const r = (j) => Math.hypot(p[3 * j] - body, p[3 * j + 1]);
        let best = 9, cut = n - 1;
        for (let j = 1; j < n - 1; j++) {
          if (r(j) < r(j - 1) && r(j) < r(j + 1) && r(j) < reach) {
            best = r(j);
            cut = j;
            break;
          }
        }
        const piece = open(p.slice(0, 3 * (cut + 1)), q.slice(0, cut + 1));
        if (side < 0) {
          if (k % 10 === 0) faint.push(toned(mirrored(piece), "violet"));
          if (best < perigee) {
            perigee = best;
            inbound = mirrored(piece);
          }
        } else {
          if (k % 10 === 0) faint.push(toned(piece, "orange"));
          if (best < perilune) {
            perilune = best;
            outbound = piece;
          }
        }
      }
    }
    if (!inbound || !outbound) return [];
    const end = inbound.pts.length - 2;
    const around = lap(first, inbound.pts[end], inbound.pts[end + 1], outbound.pts[0], outbound.pts[1]);
    return [...faint, toned(joined([inbound, around, outbound]), "hero")];
  }
  function unstable(orbit, T) {
    const e = 1e-7;
    let offset = new Float64Array(6);
    offset[0] = 1;
    const states = [], dirs = [];
    for (let lap2 = 0; lap2 < 3; lap2++) {
      const a = Float64Array.from(orbit.s), b = Float64Array.from(orbit.s);
      for (let i = 0; i < 6; i++) b[i] += e * offset[i];
      for (let t = 0; t < T; ) {
        t += step(a, H);
        step(b, H);
        const d = new Float64Array(6);
        let n = 0;
        for (let i = 0; i < 6; i++) {
          d[i] = b[i] - a[i];
          n += d[i] * d[i];
        }
        n = Math.sqrt(n);
        for (let i = 0; i < 6; i++) {
          d[i] /= n;
          b[i] = a[i] + e * d[i];
        }
        offset = d;
        if (lap2 === 2) {
          states.push(Float64Array.from(a));
          dirs.push(d);
        }
      }
    }
    return { states, dirs };
  }
  function ribbon(A, phases, crossings, alpha, kick = 1e-5) {
    const orbit = lyapunovFamily(1, [A], H)[0];
    if (!orbit) return [];
    const first = closed(orbit), { states, dirs } = unstable(orbit, first.T), out = [];
    const xL = lagrange(1);
    let sign = 1;
    {
      const u = Float64Array.from(states[0]);
      for (let i = 0; i < 6; i++) u[i] += kick * dirs[0][i];
      const p = [], q = [];
      propagate(u, H, 12, p, q, (v) => Math.abs(v[0] - xL) > 0.1, 0);
      if (p[p.length - 3] > xL) sign = -1;
    }
    for (let k = 0; k < phases; k++) {
      const i = Math.floor(k / phases * states.length), u = Float64Array.from(states[i]);
      for (let j = 0; j < 6; j++) u[j] += sign * kick * dirs[i][j];
      let count = 0, y = u[1], left = false;
      const p = [], q = [];
      propagate(u, H, 40, p, q, (v) => {
        if (v[0] < xL - 0.2) left = true;
        if (left && y * v[1] < 0) count++;
        y = v[1];
        return count >= crossings || stopped(v);
      }, 0);
      const s = open(p, q);
      out.push({ ...toned(s, "orange"), alpha }, { ...toned(mirrored(s), "violet"), alpha });
    }
    return [toned(first, "text"), ...out];
  }
  function band(laps, tilt) {
    const seed = new Float64Array(6);
    seed[0] = 1.0232;
    seed[2] = 0.1829;
    seed[4] = -0.1058;
    const m = correct(seed, [2, 4], [3, 5], H / 2, 0.3, 6, 12);
    if (!m) return { pts: new Float64Array(0), times: new Float32Array(0), T: 0 };
    const c = Math.cos(tilt), d = Math.sin(tilt), n = m.times.length, pts = [], times = [];
    const put = (i, sign, t) => {
      const x = m.path[3 * i] + MU, y = sign * m.path[3 * i + 1], z = -m.path[3 * i + 2];
      pts.push(x * Math.cos(t) - y * Math.sin(t) - MU, (x * Math.sin(t) + y * Math.cos(t)) * c + z * d);
      times.push(t);
    };
    for (let lap2 = 0; lap2 < laps; lap2++) {
      const t0 = 2 * m.t * lap2;
      for (let i = 0; i < n; i++) put(i, 1, t0 + m.times[i]);
      for (let i = n - 2; i > 0; i--) put(i, -1, t0 + 2 * m.t - m.times[i]);
    }
    return { pts: Float64Array.from(pts), times: Float32Array.from(times), T: times[times.length - 1] };
  }
  function spiral(acc, r0, a1, a2, tilt, laps) {
    const c = Math.cos(tilt), mu = 1 - MU;
    const s = [r0, 0, 0, Math.sqrt(mu / r0)];
    let t = 0, phase = 0, out = false, end = Infinity;
    const parts = [{ p: [], q: [] }, { p: [], q: [] }, { p: [], q: [] }];
    const f = (u, tt, A) => {
      const r = Math.hypot(u[0], u[1]), mx = Math.cos(tt), my = Math.sin(tt);
      const dx = u[0] - mx, dy = u[1] - my, d = Math.hypot(dx, dy), v = Math.hypot(u[2], u[3]);
      return [u[2], u[3], -mu * u[0] / r ** 3 - MU * dx / d ** 3 - MU * mx + A * u[2] / v, -mu * u[1] / r ** 3 - MU * dy / d ** 3 - MU * my + A * u[3] / v];
    };
    for (let n = 0; n < 3e5; n++) {
      const r = Math.hypot(s[0], s[1]), d = Math.hypot(s[0] - Math.cos(t), s[1] - Math.sin(t));
      if (r < 0.0166 || d < 45e-4 || r > 2.6) break;
      if (phase === 2 && r > 1.15) out = true;
      if (out && r < 1 || t > end) break;
      const E = (s[2] ** 2 + s[3] ** 2) / 2 - mu / r, sma = E < 0 ? -mu / (2 * E) : 9;
      if (phase === 0 && sma > a1) phase = 1;
      if (phase === 1 && sma > a2) {
        phase = 2;
        end = t + 14;
      }
      const A = phase === 0 || phase === 1 && r < sma ? acc : 0;
      const h = 0.05 * Math.min(r ** 1.5, 4 * d ** 1.5);
      parts[phase].p.push(s[0] - MU, s[1] * c, 0);
      parts[phase].q.push(t);
      const k1 = f(s, t, A), k2 = f(s.map((v, i) => v + 0.5 * h * k1[i]), t + h / 2, A);
      const k3 = f(s.map((v, i) => v + 0.5 * h * k2[i]), t + h / 2, A), k4 = f(s.map((v, i) => v + h * k3[i]), t + h, A);
      for (let i = 0; i < 4; i++) s[i] += h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
      t += h;
    }
    const [p0, p1, p2] = parts;
    return [toned(band(laps, tilt), "line"), { ...toned(open(p2.p, p2.q), "violet"), alpha: 0.85 }, { ...toned(open(p1.p, p1.q), "violet"), alpha: 0.85 }, { ...toned(open(p0.p, p0.q), "orange"), alpha: 0.85 }].filter((x) => x.times.length > 1);
  }
  function flown(s, h, T, tilt = 0, stop) {
    const p = [], q = [], c = Math.cos(tilt), d = Math.sin(tilt);
    propagate(s, h, T, p, q, stop, 0);
    for (let i = 0; i < q.length; i++) p[3 * i + 1] = p[3 * i + 1] * c + p[3 * i + 2] * d;
    return open(p, q);
  }
  var fraction = (v) => v - Math.floor(v);
  function tori(tilt) {
    return droFamily(spaced(0.07, 0.42, 25, 1.2), H).filter((_, i) => i % 5 === 0).map((m, i) => {
      const s = Float64Array.from(m.s);
      s[4] *= 1.006;
      s[2] = i % 2 ? 0.014 : -0.014;
      return toned(flown(s, 0.01, 22 * m.t, tilt), i % 2 ? "violet" : "orange");
    });
  }
  function lace(A1, A2, phases, span) {
    const out = [];
    for (const [n, A] of [[1, A1], [2, A2]]) {
      const orbit = lyapunovFamily(n, [A], H)[0];
      if (!orbit) continue;
      const first = closed(orbit), { states, dirs } = unstable(orbit, first.T), xL = lagrange(n);
      out.push(toned(first, "text"));
      const toMoon = (sign2) => {
        const u = Float64Array.from(states[0]);
        for (let i = 0; i < 6; i++) u[i] += sign2 * 1e-5 * dirs[0][i];
        const p = [], q = [];
        propagate(u, H, 12, p, q, (v) => Math.abs(v[0] - xL) > 0.1, 0);
        return Math.abs(p[p.length - 3] - (1 - MU)) < Math.abs(xL - (1 - MU));
      };
      const sign = toMoon(1) ? 1 : -1;
      for (let k = 0; k < phases; k++) {
        const i = Math.floor(k / phases * states.length), u = Float64Array.from(states[i]);
        for (let j = 0; j < 6; j++) u[j] += sign * 1e-5 * dirs[i][j];
        const s = flown(u, H, span, 0, (v) => Math.hypot(v[0] - 1 + MU, v[1]) < 8e-3 || Math.hypot(v[0] - 1 + MU, v[1]) > 0.5);
        out.push(n === 1 ? { ...toned(s, "orange"), alpha: 0.3 } : { ...toned(mirrored(s), "violet"), alpha: 0.3 });
      }
    }
    return out;
  }
  function sheaf(count) {
    const rp = 0.02, out = [];
    for (let i = 0; i < count; i++) {
      const ra = 0.92 + 0.2 * fraction(i * 0.618), a = (rp + ra) / 2, v = Math.sqrt((1 - MU) * (2 / rp - 1 / a));
      const al = -2 + 0.4 * (fraction(i * 0.382) - 0.5), s = new Float64Array(6);
      s[0] = -MU + rp * Math.cos(al);
      s[1] = rp * Math.sin(al);
      s[3] = -(v - rp) * Math.sin(al);
      s[4] = (v - rp) * Math.cos(al);
      out.push(toned(flown(s, 4e-3, 3.5, 0, (q) => Math.hypot(q[0] + MU, q[1]) < 0.015 || Math.hypot(q[0] - 1 + MU, q[1]) < 5e-3 || Math.hypot(q[0], q[1]) > 2), "orange"));
    }
    return out;
  }
  var SCENES = {
    nest: () => [...lyapunovFamily(1, spaced(0.012, 0.12, 12, 1.5), H), ...lyapunovFamily(2, spaced(0.012, 0.14, 12, 1.5), H), ...droFamily(ramp(0.03, 0.09, 1.2), H)].map(closed),
    dro: () => droFamily(ramp(0.02, 0.32, 1.12), H).filter((_, i) => i % 3 === 0).map(closed),
    l1: () => lyapunovFamily(1, spaced(6e-3, 0.17, 26, 1.35), H).map(closed),
    l2: () => lyapunovFamily(2, spaced(6e-3, 0.17, 24, 1.35), H).map(closed),
    lyapunovs: () => [...lyapunovFamily(1, spaced(6e-3, 0.1, 16, 1.3), H), ...lyapunovFamily(2, spaced(6e-3, 0.11, 16, 1.3), H)].map(closed),
    mark: () => droFamily([0.1], H).map(closed),
    tubes: () => [...tubes(1, 0.0313, 14, 2.2), ...tubes(2, 0.0408, 14, 2.2)],
    halo: () => halos(1.2),
    rosette: () => resonant(7, 2, spaced(0.04, 0.7, 14, 1)),
    hill: () => [3.25, 3.2, 3.188, 3.172, 3.15, 3.12, 3.08, 3.05, 3.012, 2.99, 2.97, 2.95, 2.93, 2.91, 2.89].flatMap(zeroVelocity),
    transfer: () => transfer(0.03),
    ribbon: () => ribbon(6e-3, 90, 3, 0.16),
    wideRibbon: () => ribbon(0.016, 120, 3, 0.12),
    spiral: () => spiral(0.11, 0.07, 0.42, 0.92, 0.44, 60),
    torus: () => tori(1),
    lace: () => lace(0.05, 0.06, 40, 9),
    sheaf: () => sheaf(36)
  };
  var SCENE_NAMES = Object.keys(SCENES);
  var cache = /* @__PURE__ */ new Map();
  function scene(name) {
    let out = cache.get(name);
    if (!out) {
      out = name in SCENES ? SCENES[name]() : [];
      cache.set(name, out);
    }
    return out;
  }

  // src/orbits.ts
  var MU = 0.01215;
  var NEAR = 0.15;
  var DURATION = 12;
  var LOOP = 9;
  function accel(s, a) {
    const x = s[0], y = s[1], z = s[2];
    const dx1 = x + MU, dx2 = x - 1 + MU;
    const r1 = Math.sqrt(dx1 * dx1 + y * y + z * z), r2 = Math.sqrt(dx2 * dx2 + y * y + z * z);
    const k1 = (1 - MU) / (r1 * r1 * r1), k2 = MU / (r2 * r2 * r2);
    a[0] = s[3];
    a[1] = s[4];
    a[2] = s[5];
    a[3] = 2 * s[4] + x - k1 * dx1 - k2 * dx2;
    a[4] = -2 * s[3] + y - k1 * y - k2 * y;
    a[5] = -k1 * z - k2 * z;
    return r2 < r1 ? r2 : r1 * 0.4;
  }
  var K1 = new Float64Array(6);
  var K2 = new Float64Array(6);
  var K3 = new Float64Array(6);
  var K4 = new Float64Array(6);
  var MID = new Float64Array(6);
  function step(s, h) {
    const near = accel(s, K1);
    const dt = h * Math.min(1, near / NEAR);
    for (let i = 0; i < 6; i++) MID[i] = s[i] + 0.5 * dt * K1[i];
    accel(MID, K2);
    for (let i = 0; i < 6; i++) MID[i] = s[i] + 0.5 * dt * K2[i];
    accel(MID, K3);
    for (let i = 0; i < 6; i++) MID[i] = s[i] + dt * K3[i];
    accel(MID, K4);
    for (let i = 0; i < 6; i++) s[i] += dt / 6 * (K1[i] + 2 * K2[i] + 2 * K3[i] + K4[i]);
    return dt;
  }
  function toCrossing(s0, h, tmin, tmax, path, times, count = 1, axis = 1) {
    const s = Float64Array.from(s0);
    let t = 0;
    const record = () => {
      if (path) path.push(s[0], s[1], s[2]);
      if (times) times.push(t);
    };
    record();
    let prev = s[axis], left = count;
    for (let n = 0; n < 1e5; n++) {
      t += step(s, h);
      if (t > tmin && (s[axis] === 0 || s[axis] > 0 !== prev > 0) && --left === 0) {
        const dtc = -s[axis] / s[axis + 3];
        const a = new Float64Array(6);
        accel(s, a);
        for (let i = 0; i < 6; i++) s[i] += dtc * a[i];
        t += dtc;
        record();
        return { s, t, hit: true };
      }
      prev = s[axis];
      record();
      if (t > tmax) return { s, t, hit: false };
    }
    return { s, t, hit: false };
  }
  function propagate(s0, h, tmax, path, times, stop, t0 = 0) {
    const s = Float64Array.from(s0);
    let t = 0;
    path.push(s[0], s[1], s[2]);
    times.push(t0);
    while (t < tmax) {
      t += step(s, h);
      path.push(s[0], s[1], s[2]);
      times.push(t0 + t);
      if (stop && stop(s)) break;
    }
    return s;
  }
  function correct(s0, free, target, h, tmin, tmax, iters, count = 1, axis = 1) {
    const s = Float64Array.from(s0);
    let path = [], times = [];
    for (let it = 0; it < iters; it++) {
      path = [];
      times = [];
      const base = toCrossing(s, h, tmin, tmax, path, times, count, axis);
      if (!base.hit) return null;
      const f = target.map((i) => base.s[i]);
      if (f.every((v) => Math.abs(v) < 1e-6)) return { s, path, times, t: base.t };
      const J = [];
      for (let j = 0; j < free.length; j++) {
        const d = 1e-6;
        const sp = Float64Array.from(s);
        sp[free[j]] += d;
        const r2 = toCrossing(sp, h, tmin, tmax, void 0, void 0, count, axis);
        if (!r2.hit) return null;
        J.push(target.map((i, k) => (r2.s[i] - f[k]) / d));
      }
      const dx = [];
      if (free.length === 1) dx.push(f[0] / J[0][0]);
      else {
        const a = J[0][0], b = J[1][0], c = J[0][1], d = J[1][1], det = a * d - b * c;
        dx.push((d * f[0] - b * f[1]) / det, (-c * f[0] + a * f[1]) / det);
      }
      if (!dx.every((v) => Math.abs(v) < 0.1)) return null;
      for (let j = 0; j < free.length; j++) s[free[j]] -= dx[j];
    }
    path = [];
    times = [];
    const r = toCrossing(s, h, tmin, tmax, path, times, count, axis);
    return r.hit ? { s, path, times, t: r.t } : null;
  }
  function family(guess, p, values, free, target, h, tmin, tmax, skip, count = 1, axis = 1) {
    const out = [];
    let prev = null, prev2 = null;
    const accept = (r) => r && (!prev || Math.abs(r.t - prev.t) < prev.t / 3) ? r : null;
    for (const v of values) {
      let r = null;
      if (prev && prev2) {
        const s0 = Float64Array.from(prev.s);
        s0[p] = v;
        for (const i of free) s0[i] = prev.s[i] + (prev.s[i] - prev2.s[i]) / (prev.s[p] - prev2.s[p]) * (v - prev.s[p]);
        r = accept(correct(s0, free, target, h, tmin(v), tmax(v), 6, count, axis));
      }
      if (!r) r = accept(correct(guess(v), free, target, h, tmin(v), tmax(v), 8, count, axis));
      if (!r) break;
      out.push(r);
      prev2 = prev;
      prev = r;
    }
    return out.slice(skip);
  }
  function ramp(a, b, factor) {
    const out = [];
    for (let x = a; x < b; x *= factor) out.push(x);
    return out;
  }
  function spaced(a, b, count, p) {
    const out = [];
    for (let i = 0; i < count; i++) out.push(a + (b - a) * Math.pow(i / (count - 1), p));
    return out;
  }
  function lagrange(n, mu = MU) {
    let x = n === 1 ? 1 - mu - Math.cbrt(mu / 3) : n === 2 ? 1 - mu + Math.cbrt(mu / 3) : -1 - 5 * mu / 12;
    for (let i = 0; i < 30; i++) {
      const d1 = x + mu, d2 = x - 1 + mu;
      const f = x - (1 - mu) * Math.sign(d1) / (d1 * d1) - mu * Math.sign(d2) / (d2 * d2);
      const df = 1 + 2 * (1 - mu) / Math.abs(d1 * d1 * d1) + 2 * mu / Math.abs(d2 * d2 * d2);
      x -= f / df;
    }
    return x;
  }
  function lyapunovFamily(n, amplitudes, h, start2 = 3e-3) {
    const xL = lagrange(n);
    const d1 = Math.abs(xL + MU), d2 = Math.abs(xL - 1 + MU);
    const c2 = (1 - MU) / (d1 * d1 * d1) + MU / (d2 * d2 * d2);
    const w2 = (2 - c2 + Math.sqrt(9 * c2 * c2 - 8 * c2)) / 2;
    const guess = (x0) => {
      const s = new Float64Array(6);
      s[0] = x0;
      s[4] = (xL - x0) * (w2 + 1 + 2 * c2) / 2;
      return s;
    };
    const sign = n === 1 ? -1 : 1;
    const lead = ramp(start2, amplitudes[0], 1.2);
    const values = lead.concat(amplitudes).map((A) => xL + sign * A);
    return family(guess, 0, values, [4], [3], h, () => 0.3, () => 6, lead.length);
  }
  function droFamily(distances, h) {
    const guess = (x0) => {
      const d = 1 - MU - x0;
      const s = new Float64Array(6);
      s[0] = x0;
      s[4] = Math.sqrt(MU / d) + d;
      return s;
    };
    const tmin = (x0) => {
      const d = 1 - MU - x0;
      return 0.4 * Math.PI / (Math.sqrt(MU / (d * d * d)) + 1);
    };
    const lead = ramp(0.02, distances[0], 1.12);
    const values = lead.concat(distances).map((d) => 1 - MU - d);
    return family(guess, 0, values, [4], [3], h, tmin, (x0) => 10 * tmin(x0), lead.length);
  }
  function closed(m) {
    const n = m.times.length, T = m.t, N = 2 * n - 1;
    const pts = new Float64Array(2 * N), tt = new Float32Array(N);
    for (let i = 0; i < n; i++) {
      pts[2 * i] = m.path[3 * i];
      pts[2 * i + 1] = m.path[3 * i + 1];
      tt[i] = m.times[i];
    }
    let k = n;
    for (let i = n - 2; i >= 0; i--, k++) {
      pts[2 * k] = m.path[3 * i];
      pts[2 * k + 1] = -m.path[3 * i + 1];
      tt[k] = 2 * T - m.times[i];
    }
    return { pts, times: tt, T: 2 * T };
  }
  function open(path, times) {
    const n = times.length, pts = new Float64Array(2 * n);
    for (let i = 0; i < n; i++) {
      pts[2 * i] = path[3 * i];
      pts[2 * i + 1] = path[3 * i + 1];
    }
    return { pts, times: Float32Array.from(times), T: times[n - 1] };
  }
  var POINTS = {
    L1: () => [lagrange(1), 0],
    L2: () => [lagrange(2), 0],
    moon: () => [1 - MU, 0],
    earth: () => [-MU, 0]
  };
  var isPoint = (v) => v !== void 0 && v in POINTS;
  var CACHE = /* @__PURE__ */ new WeakMap();
  var Orbits = class _Orbits {
    constructor(el) {
      this.t0 = null;
      this.raf = 0;
      this.finished = false;
      this.W = 0;
      this.H = 0;
      this.scale = 1;
      this.lw = 1;
      this.px = [];
      // the pointer in canvas pixels, and the glow radius there
      this.pointer = null;
      this.el = el;
      this.strands = scene(el.dataset.scene ?? "");
      this.cx = +(el.dataset.cx ?? 0);
      this.cy = +(el.dataset.cy ?? 0);
      this.half = +(el.dataset.half ?? 0.5);
      this.loop = el.hasAttribute("data-loop");
      for (const old of el.querySelectorAll(":scope > canvas.orbits-base, :scope > canvas.orbits-head")) old.remove();
      this.base = document.createElement("canvas");
      this.head = document.createElement("canvas");
      this.base.className = "orbits-base";
      this.head.className = "orbits-head";
      for (const c of [this.base, this.head]) c.setAttribute("aria-hidden", "true");
      el.prepend(this.head);
      el.prepend(this.base);
      this.labels = [...el.querySelectorAll(".lab")];
      this.Tmax = Math.max(...this.strands.map((s) => s.T));
      this.idx = this.strands.map(() => 0);
      CACHE.set(el, this);
      this.fit();
    }
    static reduced() {
      if (typeof window === "undefined") return true;
      const q = location.search;
      return matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.hasAttribute("data-still") || /[?&]still\b/.test(q) || /print-pdf/.test(q);
    }
    get done() {
      return this.finished || this.loop;
    }
    colors() {
      const cs = getComputedStyle(this.el);
      return { stroke: cs.getPropertyValue("--stroke").trim(), body: cs.getPropertyValue("--body").trim(), accent: cs.getPropertyValue("--accent").trim(), violet: cs.getPropertyValue("--violet").trim(), text: cs.getPropertyValue("--text").trim() };
    }
    X(x) {
      return (x - this.cx) * this.scale + this.W / 2;
    }
    Y(y) {
      return -(y - this.cy) * this.scale + this.H / 2;
    }
    fit() {
      const r = this.el.getBoundingClientRect(), dpr = devicePixelRatio || 1;
      const w = this.el.offsetWidth, h = this.el.offsetHeight;
      if (r.width === 0 || r.height === 0 || w === 0 || h === 0) return;
      this.W = Math.max(1, Math.round(r.width * dpr));
      this.H = Math.max(1, Math.round(r.height * dpr));
      for (const c of [this.base, this.head]) {
        c.width = this.W;
        c.height = this.H;
      }
      this.scale = this.H / 2 / this.half;
      this.lw = Math.max(1, 0.7 * dpr * (r.height / h));
      this.px = this.strands.map((s) => {
        const n = s.times.length, out = new Float32Array(2 * n);
        for (let i = 0; i < n; i++) {
          out[2 * i] = this.X(s.pts[2 * i]);
          out[2 * i + 1] = this.Y(s.pts[2 * i + 1]);
        }
        return out;
      });
      const k = h / 2 / this.half;
      for (const lab of this.labels) {
        const at = lab.dataset.at;
        if (!isPoint(at)) continue;
        const [x, y] = POINTS[at]();
        lab.style.left = `${w / 2 + (x - this.cx) * k + (+(lab.dataset.dx ?? 0) || 0)}px`;
        lab.style.top = `${h / 2 - (y - this.cy) * k + (+(lab.dataset.dy ?? 0) || 0)}px`;
      }
      this.pointer = null;
      this.redraw();
    }
    bodies(ctx, c) {
      const shown = (name) => this.labels.some((l) => l.dataset.at === name);
      ctx.fillStyle = c.body;
      for (const name of ["moon", "earth"]) {
        if (name === "earth" && !shown(name)) continue;
        const [x, y] = POINTS[name]();
        const X = this.X(x), Y = this.Y(y);
        if (X < -10 || X > this.W + 10 || Y < -10 || Y > this.H + 10) continue;
        ctx.beginPath();
        ctx.arc(X, Y, (name === "moon" ? 2.6 : 5) * this.lw, 0, 2 * Math.PI);
        ctx.fill();
      }
      for (const name of ["L1", "L2"]) {
        if (!shown(name)) continue;
        const [x, y] = POINTS[name]();
        ctx.beginPath();
        ctx.arc(this.X(x), this.Y(y), 1.6 * this.lw, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    // the color, opacity, and width of a strand of the given tone
    pen(ctx, c, tone) {
      ctx.strokeStyle = tone === "orange" || tone === "hero" ? c.accent : tone === "violet" ? c.violet : tone === "text" || tone === "line" ? c.text : c.stroke;
      ctx.globalAlpha = tone === "orange" || tone === "violet" ? 0.42 : tone === "text" ? 0.8 : tone === "line" ? 0.36 : 1;
      ctx.lineWidth = tone === "hero" ? this.lw * 2.2 : tone === "text" ? this.lw * 1.3 : this.lw;
    }
    segments(ctx, i, from, to) {
      const p = this.px[i];
      if (to <= from) return;
      ctx.beginPath();
      ctx.moveTo(p[2 * from], p[2 * from + 1]);
      for (let j = from + 1; j <= to; j++) ctx.lineTo(p[2 * j], p[2 * j + 1]);
      ctx.stroke();
    }
    // the last point drawn of strand i
    drawn(i) {
      return this.done ? this.strands[i].times.length - 1 : this.idx[i];
    }
    redraw() {
      if (!this.W) return;
      const ctx = this.base.getContext("2d");
      if (!ctx) return;
      const c = this.colors();
      ctx.clearRect(0, 0, this.W, this.H);
      ctx.lineWidth = this.lw;
      ctx.lineJoin = "round";
      ctx.strokeStyle = c.stroke;
      this.bodies(ctx, c);
      this.strands.forEach((s, i) => {
        this.pen(ctx, c, s.tone);
        if (s.alpha) ctx.globalAlpha = s.alpha;
        this.segments(ctx, i, 0, this.drawn(i));
      });
      ctx.globalAlpha = 1;
      this.paintHead(performance.now(), c);
    }
    reset() {
      this.stop();
      this.t0 = null;
      this.finished = false;
      this.idx = this.strands.map(() => 0);
      this.redraw();
    }
    start() {
      if (_Orbits.reduced()) {
        this.complete();
        return;
      }
      if (this.raf || this.finished && !this.loop) return;
      this.t0 = performance.now();
      const tick = (now) => {
        this.frame(now);
        this.raf = !this.finished || this.loop ? requestAnimationFrame(tick) : 0;
      };
      this.raf = requestAnimationFrame(tick);
    }
    complete() {
      this.stop();
      this.finished = true;
      this.t0 = null;
      this.redraw();
    }
    destroy() {
      this.stop();
      this.base.remove();
      this.head.remove();
      CACHE.delete(this.el);
    }
    // tints the drawn strands within r slide pixels of the client point in the accent color, or
    // clears the tint when clientX is null
    glow(clientX, clientY = 0, r = 60) {
      if (clientX === null || !this.W) this.pointer = null;
      else {
        const b = this.el.getBoundingClientRect();
        if (!b.width || !this.el.offsetWidth) return;
        this.pointer = { x: (clientX - b.left) / b.width * this.W, y: (clientY - b.top) / b.height * this.H, r: r * this.W / this.el.offsetWidth };
      }
      if (!this.raf) this.paintHead(performance.now());
    }
    stop() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    paintHead(now, c = this.colors()) {
      if (!this.W) return;
      const ctx = this.head.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, this.W, this.H);
      if (this.loop) this.loopHead(ctx, c, now);
      else if (this.raf && this.t0 !== null && !this.finished) this.heads(ctx, c, now);
      if (this.pointer) this.glowing(ctx, c);
    }
    loopHead(ctx, c, now) {
      const s = this.strands[0], p = this.px[0], n = s.times.length;
      const tau = this.raf && this.t0 !== null ? (now - this.t0) / 1e3 % LOOP / LOOP * s.T : this.finished ? 0.37 * s.T : 0;
      let j = 0;
      while (j < n - 1 && s.times[j + 1] <= tau) j++;
      const back = 0.1 * s.T;
      ctx.lineWidth = this.lw * 1.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = c.accent;
      for (let k = j; k > 0 && s.times[k] > tau - back; k--) {
        const a = 1 - (tau - s.times[k]) / back;
        ctx.globalAlpha = 0.85 * a * a;
        ctx.beginPath();
        ctx.moveTo(p[2 * (k - 1)], p[2 * (k - 1) + 1]);
        ctx.lineTo(p[2 * k], p[2 * k + 1]);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const [X, Y] = this.at(0, j, tau);
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.arc(X, Y, 3 * this.lw, 0, 2 * Math.PI);
      ctx.fill();
    }
    heads(ctx, c, now) {
      const tau = (now - (this.t0 ?? now)) / 1e3 / DURATION * this.Tmax;
      ctx.fillStyle = c.accent;
      this.strands.forEach((s, i) => {
        const j = this.idx[i];
        if (j >= s.times.length - 1 || tau < s.times[0]) return;
        const [X, Y] = this.at(i, j, tau);
        ctx.beginPath();
        ctx.arc(X, Y, 2.2 * this.lw, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
    glowing(ctx, c) {
      const g = this.pointer;
      if (!g) return;
      const r2 = g.r * g.r;
      ctx.strokeStyle = c.accent;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = this.lw;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      this.strands.forEach((_, i) => {
        const p = this.px[i], last = this.drawn(i);
        let pen = false;
        for (let j = 0; j <= last; j++) {
          const dx = p[2 * j] - g.x, dy = p[2 * j + 1] - g.y;
          if (dx * dx + dy * dy <= r2) {
            if (pen) ctx.lineTo(p[2 * j], p[2 * j + 1]);
            else if (j > 0) {
              ctx.moveTo(p[2 * j - 2], p[2 * j - 1]);
              ctx.lineTo(p[2 * j], p[2 * j + 1]);
            } else ctx.moveTo(p[0], p[1]);
            pen = true;
          } else if (pen) {
            ctx.lineTo(p[2 * j], p[2 * j + 1]);
            pen = false;
          }
        }
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    at(i, j, tau) {
      const s = this.strands[i], p = this.px[i], n = s.times.length;
      if (j >= n - 1) return [p[2 * (n - 1)], p[2 * (n - 1) + 1]];
      const f = Math.min(1, Math.max(0, (tau - s.times[j]) / (s.times[j + 1] - s.times[j])));
      return [p[2 * j] + f * (p[2 * j + 2] - p[2 * j]), p[2 * j + 1] + f * (p[2 * j + 3] - p[2 * j + 1])];
    }
    frame(now) {
      if (this.loop || !this.W) {
        this.paintHead(now);
        return;
      }
      const tau = (now - (this.t0 ?? now)) / 1e3 / DURATION * this.Tmax;
      const ctx = this.base.getContext("2d");
      if (!ctx) return;
      const c = this.colors();
      ctx.lineWidth = this.lw;
      ctx.lineJoin = "round";
      ctx.strokeStyle = c.stroke;
      let flying = 0;
      this.strands.forEach((s, i) => {
        const n = s.times.length;
        let j = this.idx[i];
        while (j < n - 1 && s.times[j + 1] <= tau) j++;
        this.pen(ctx, c, s.tone);
        if (s.alpha) ctx.globalAlpha = s.alpha;
        this.segments(ctx, i, this.idx[i], j);
        this.idx[i] = j;
        if (j < n - 1) flying++;
      });
      ctx.globalAlpha = 1;
      if (flying === 0) this.finished = true;
      this.paintHead(now, c);
    }
  };
  function mount(root2) {
    const out = [];
    for (const el of root2.querySelectorAll(".backdrop")) out.push(CACHE.get(el) ?? new Orbits(el));
    return out;
  }

  // src/chrome.ts
  var OWN = ["title", "section", "closing"];
  var heading = (slide) => slide.dataset.run ?? (slide.querySelector("h2") ?? slide.querySelector("h1"))?.textContent?.trim() ?? "";
  function initChrome(deck) {
    const slides = deck.getSlides();
    const sections = slides.filter((s) => s.classList.contains("section"));
    let current = null;
    for (const slide of slides) {
      if (slide.classList.contains("section")) current = slide;
      if (OWN.some((c) => slide.classList.contains(c)) || slide.querySelector(".run") || !current) continue;
      const text = heading(current);
      if (!text) continue;
      const run = document.createElement("div");
      run.className = "run";
      run.textContent = text;
      slide.append(run);
    }
    for (const list of document.querySelectorAll(".reveal ul.outline[data-auto]")) {
      const home = list.closest("section");
      list.replaceChildren(
        ...sections.map((s) => {
          const li = document.createElement("li");
          li.textContent = heading(s);
          if (s === home) li.className = "now";
          return li;
        })
      );
    }
  }

  // src/cursor.ts
  var REACH = 60;
  var dot = null;
  function togglePointer() {
    if (dot) {
      dot.remove();
      dot = null;
      return;
    }
    dot = document.createElement("div");
    dot.className = "pointer-dot";
    dot.setAttribute("aria-hidden", "true");
    Object.assign(dot.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "14px",
      height: "14px",
      boxSizing: "border-box",
      border: "2px solid var(--accent, #e77500)",
      borderRadius: "50%",
      pointerEvents: "none",
      transform: "translate(-50%, -50%)",
      zIndex: "2147483000",
      display: "none"
    });
    document.body.append(dot);
  }
  function initCursor(orbits, slide) {
    let last = null, frame = 0;
    const lit = /* @__PURE__ */ new Set();
    const update = () => {
      frame = 0;
      const current = slide();
      for (const o of orbits()) {
        const r = o.el.getBoundingClientRect();
        const over = last && current?.contains(o.el) && last.x >= r.left && last.x <= r.right && last.y >= r.top && last.y <= r.bottom;
        if (over && last) {
          o.glow(last.x, last.y, REACH);
          lit.add(o);
        } else if (lit.has(o)) {
          o.glow(null);
          lit.delete(o);
        }
      }
    };
    const tint = !Orbits.reduced();
    document.addEventListener("pointermove", (ev) => {
      if (dot) {
        dot.style.display = "block";
        dot.style.left = `${ev.clientX}px`;
        dot.style.top = `${ev.clientY}px`;
      }
      if (!tint) return;
      last = { x: ev.clientX, y: ev.clientY };
      if (!frame) frame = requestAnimationFrame(update);
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => {
      if (dot) dot.style.display = "none";
      last = null;
      if (tint && !frame) frame = requestAnimationFrame(update);
    });
  }

  // src/print.ts
  var sleep = (ms) => new Promise((done) => setTimeout(done, ms));
  async function stillViewers() {
    for (const viewer of document.querySelectorAll("tycho-viewer")) {
      const failed = () => viewer.shadowRoot?.querySelector(".status.error");
      while (!viewer.renderer && !failed()) await sleep(50);
      if (!viewer.canvas || !viewer.renderer) continue;
      viewer.pause();
      viewer.draw();
      const image = new Image();
      image.src = viewer.canvas.toDataURL("image/png");
      image.alt = "A still of a tycho scene";
      const still2 = document.createElement("div");
      still2.className = viewer.className;
      still2.append(image);
      viewer.replaceWith(still2);
    }
  }

  // src/surfaces.ts
  var num = (value, fallback) => value !== void 0 && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : fallback;
  function effectivePotential(mu) {
    const wells = (x, y) => -(1 - mu) / Math.hypot(x + mu, y) - mu / Math.hypot(x - 1 + mu, y);
    const bowl = (x, y) => -(x * x + y * y) / 2;
    return { wells, bowl, sum: (x, y) => wells(x, y) + bowl(x, y) };
  }
  function librationPoints(mu) {
    const h = Math.sqrt(3) / 2;
    return [
      { name: "L1", x: lagrange(1, mu), y: 0, kind: "saddle" },
      { name: "L2", x: lagrange(2, mu), y: 0, kind: "saddle" },
      { name: "L3", x: lagrange(3, mu), y: 0, kind: "saddle" },
      { name: "L4", x: 0.5 - mu, y: h, kind: "maximum" },
      { name: "L5", x: 0.5 - mu, y: -h, kind: "maximum" }
    ];
  }
  function clamped(f, floor) {
    const w = 0.06;
    return (x, y) => {
      const s = (f(x, y) - floor) / w;
      return floor + w * (s > 0 ? s + Math.log1p(Math.exp(-s)) : Math.log1p(Math.exp(s)));
    };
  }
  function sample(f, x, y, nx, ny, floor) {
    const g = new Float64Array((nx + 1) * (ny + 1)), c = clamped(f, floor);
    const dx = (x[1] - x[0]) / nx, dy = (y[1] - y[0]) / ny;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) g[j * (nx + 1) + i] = c(x[0] + i * dx, y[0] + j * dy);
    return g;
  }
  function levelCurves(g, x, y, nx, ny, level) {
    const d = g.map((z) => z - level);
    return isolines(d, nx, ny, x[0], y[0], (x[1] - x[0]) / nx, (y[1] - y[0]) / ny, true);
  }
  var FUNCTIONS = {
    // the effective potential of the CR3BP at data-mu, assembled from its wells and its bowl, with the
    // libration points marked and a cut at the height -C/2 of the Jacobi constant C of data-C. the
    // intersection of this plane with the surface is the zero-velocity curve, and Hill's region is
    // where the surface is under the plane. C is the value at L1 when data-C is not given
    "effective-potential": (attributes) => {
      const mu = num(attributes.mu, 0.05);
      const { wells, bowl, sum } = effectivePotential(mu);
      const marks = librationPoints(mu);
      const C1 = -2 * sum(marks[0].x, 0);
      const plain = (layer) => () => ({ layer, marks: false, level: null });
      return {
        x: [-1.5, 1.5],
        y: [-1.5, 1.5],
        floor: -3.2,
        zscale: 1,
        layers: { flat: () => 0, wells, bowl, sum },
        marks,
        initial: "flat",
        stages: {
          flat: plain("flat"),
          wells: plain("wells"),
          bowl: plain("bowl"),
          sum: plain("sum"),
          extrema: () => ({ layer: "sum", marks: true, level: null }),
          cut: (a) => ({ layer: "sum", marks: true, level: -num(a.c, C1) / 2 })
        }
      };
    }
  };
  var FUNCTION_NAMES = Object.keys(FUNCTIONS);
  function surfaceFunction(name, attributes) {
    return name in FUNCTIONS ? FUNCTIONS[name](attributes) : null;
  }

  // src/surface.ts
  var CELLS = 200;
  var MORPH = 1400;
  var SLIDE = 2600;
  var TURN = 90;
  var RISE = 0.4;
  var CURVE_WIDTH = 3.5;
  var GLOW_WIDTH = 18;
  var MARK_SIZE = 22;
  var ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  var lerp = (a, b, t) => a + (b - a) * t;
  var clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  var num2 = (v, fallback) => v !== void 0 && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : fallback;
  var mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  function rgb(css, fallback) {
    const s = css.trim();
    const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
    if (short) return [1, 2, 3].map((i) => parseInt(short[i] + short[i], 16) / 255);
    const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(s);
    if (long) return [1, 2, 3].map((i) => parseInt(long[i], 16) / 255);
    const fn = /^rgba?\(([^)]*)\)/i.exec(s);
    if (fn) {
      const v = fn[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      if (v.length >= 3 && v.every(Number.isFinite)) return [v[0] / 255, v[1] / 255, v[2] / 255];
    }
    return fallback;
  }
  var SURFACE_VERTEX = (
    /* glsl */
    `
attribute float zA;
attribute float zB;
attribute vec3 nA;
attribute vec3 nB;
uniform float uMix;
varying vec3 vNormal;
varying vec2 vXY;
varying float vZ;
void main() {
  vZ = mix(zA, zB, uMix);
  vNormal = mix(nA, nB, uMix);
  vXY = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, vZ, 1.0);
}`
  );
  var SURFACE_FRAGMENT = (
    /* glsl */
    `
uniform vec3 uRamp[4];
uniform vec3 uGroove;
uniform vec2 uRange;
uniform vec3 uLight;
uniform vec2 uGrid;
varying vec3 vNormal;
varying vec2 vXY;
varying float vZ;
void main() {
  float t = clamp((vZ - uRange.x) / max(uRange.y - uRange.x, 1e-6), 0.0, 1.0);
  float k = t * 3.0;
  vec3 c = k < 1.0 ? mix(uRamp[0], uRamp[1], k) : k < 2.0 ? mix(uRamp[1], uRamp[2], k - 1.0) : mix(uRamp[2], uRamp[3], k - 2.0);
  c *= 0.58 + 0.42 * abs(dot(normalize(vNormal), uLight));
  vec2 q = vXY / uGrid;
  vec2 a = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), vec2(1e-4));
  c = mix(c, uGroove, 0.45 * (1.0 - min(min(a.x, a.y), 1.0)));
  gl_FragColor = vec4(c, 1.0);
}`
  );
  var PLANE_VERTEX = (
    /* glsl */
    `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
  );
  var PLANE_FRAGMENT = (
    /* glsl */
    `
uniform vec3 uColor;
uniform float uAlpha;
void main() {
  gl_FragColor = vec4(uColor, uAlpha);
}`
  );
  var LINE_VERTEX = (
    /* glsl */
    `
attribute vec3 start;
attribute vec3 end;
attribute vec2 corner;
uniform vec2 uViewport;
uniform float uWidth;
uniform float uBias;
varying float vSide;
void main() {
  vec4 a = projectionMatrix * modelViewMatrix * vec4(start, 1.0);
  vec4 b = projectionMatrix * modelViewMatrix * vec4(end, 1.0);
  vec2 half_ = 0.5 * uViewport;
  vec2 d = b.xy / b.w * half_ - a.xy / a.w * half_;
  float len = length(d);
  vec2 dir = len > 1e-6 ? d / len : vec2(1.0, 0.0);
  vec2 normal = vec2(-dir.y, dir.x);
  vec4 p = corner.x < 0.5 ? a : b;
  vec2 offset = 0.5 * uWidth * (normal * corner.y + dir * (corner.x < 0.5 ? -1.0 : 1.0));
  p.xy += offset / half_ * p.w;
  p.z -= uBias * p.w;
  vSide = corner.y;
  gl_Position = p;
}`
  );
  var LINE_FRAGMENT = (
    /* glsl */
    `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uWidth;
uniform float uSoft;
varying float vSide;
void main() {
  float s = abs(vSide);
  float edge = mix(1.0 - smoothstep(1.0 - 2.0 / uWidth, 1.0, s), (1.0 - s) * (1.0 - s), uSoft);
  gl_FragColor = vec4(uColor, uAlpha * edge);
}`
  );
  var MARK_VERTEX = (
    /* glsl */
    `
attribute float kind;
uniform float uRise;
uniform float uLift;
uniform float uSize;
uniform float uBias;
varying float vKind;
void main() {
  vec3 p = position;
  p.z -= (1.0 - uRise) * uLift;
  vec4 c = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  c.z -= uBias * c.w;
  gl_Position = c;
  gl_PointSize = uSize * (0.35 + 0.65 * uRise);
  vKind = kind;
}`
  );
  var MARK_FRAGMENT = (
    /* glsl */
    `
uniform vec3 uFill;
uniform vec3 uRing;
uniform float uRise;
uniform float uSize;
varying float vKind;
void main() {
  float r = length(gl_PointCoord * 2.0 - 1.0);
  float aa = 2.0 / uSize;
  float outer = 1.0 - smoothstep(1.0 - aa, 1.0, r);
  if (outer <= 0.0) discard;
  float fill = 1.0 - smoothstep(0.7 - aa, 0.7, r);
  if (vKind < 0.5) fill *= smoothstep(0.36 - aa, 0.36, r);
  gl_FragColor = vec4(mix(uRing, uFill, fill), outer * uRise);
}`
  );
  var shared;
  function renderer() {
    if (shared !== void 0) return shared;
    shared = null;
    const THREE = window.THREE;
    if (!THREE) {
      console.error('beeson: a .surface needs three.js, loaded with <script src="theme/vendor/three/three.js"> before beeson.js');
      return null;
    }
    try {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
      r.setPixelRatio(1);
      r.setClearColor(0, 0);
      r.outputColorSpace = THREE.LinearSRGBColorSpace;
      shared = r;
    } catch (error) {
      console.warn(`beeson: WebGL is not available for the surfaces, ${String(error)}`);
    }
    return shared;
  }
  var CACHE2 = /* @__PURE__ */ new WeakMap();
  var Surface = class {
    constructor(el, fn, THREE) {
      this.grids = /* @__PURE__ */ new Map();
      this.normals = /* @__PURE__ */ new WeakMap();
      this.ranges = /* @__PURE__ */ new Map();
      this.zmin = 0;
      this.zmax = 0;
      this.capacity = 0;
      this.drawn = "";
      this.mix = 1;
      this.stageName = "";
      this.markLayer = "";
      this.t0 = 0;
      this.duration = MORPH;
      this.moving = false;
      this.active = false;
      this.raf = 0;
      this.last = 0;
      this.resume = 0;
      this.drag = null;
      this.W = 0;
      this.H = 0;
      this.w = 0;
      this.h = 0;
      this.tick = (now) => {
        this.raf = 0;
        const dt = this.last ? Math.min(0.1, (now - this.last) / 1e3) : 0;
        this.last = now;
        if (this.moving) {
          const k = Math.min(1, (now - this.t0) / this.duration), e = ease(k), a = this.from, b = this.to;
          this.mix = e;
          const late = ease(clamp((k - 0.35) / 0.65, 0, 1));
          this.shown = { lo: lerp(a.lo, b.lo, e), hi: lerp(a.hi, b.hi, e), marks: lerp(a.marks, b.marks, b.marks > a.marks ? late : e), cut: lerp(a.cut, b.cut, e), level: lerp(a.level, b.level, e) };
          if (k >= 1) this.moving = false;
        }
        if (this.rate && !this.drag && now > this.resume) this.azimuth += dt * this.rate;
        this.draw();
        if (this.moving || this.rate) this.kick();
      };
      this.el = el;
      this.fn = fn;
      this.THREE = THREE;
      this.zscale = num2(el.dataset.zscale, fn.zscale);
      const turn = num2(el.dataset.turn, TURN);
      this.rate = turn > 0 ? 2 * Math.PI / turn : 0;
      this.azimuth = num2(el.dataset.azimuth, -60) * Math.PI / 180;
      this.elevation = num2(el.dataset.elevation, 32) * Math.PI / 180;
      this.zoom = num2(el.dataset.zoom, 1);
      for (const old of el.querySelectorAll(":scope > canvas.surface-image")) old.remove();
      this.canvas = document.createElement("canvas");
      this.canvas.className = "surface-image";
      this.canvas.setAttribute("aria-hidden", "true");
      el.prepend(this.canvas);
      el.setAttribute("data-prevent-swipe", "");
      this.labels = [...el.querySelectorAll(".lab")];
      for (const [name, f] of Object.entries(fn.layers)) {
        const g = sample(f, fn.x, fn.y, CELLS, CELLS, fn.floor);
        this.grids.set(name, g);
        this.ranges.set(name, this.range(g));
        for (const z of g) {
          if (z < this.zmin) this.zmin = z;
          if (z > this.zmax) this.zmax = z;
        }
      }
      this.A = this.B = this.grids.get(fn.initial) ?? new Float64Array((CELLS + 1) ** 2);
      const [lo, hi] = this.ranges.get(fn.initial) ?? [0, 1];
      this.shown = this.from = this.to = { lo, hi, marks: 0, cut: 0, level: fn.floor };
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
      this.camera.up.set(0, 0, 1);
      this.surface = this.makeSurface();
      this.plane = this.makePlane();
      this.curve = this.makeCurve(CURVE_WIDTH, 0);
      this.glow = this.makeCurve(GLOW_WIDTH, 1);
      this.glow.geometry = this.curve.geometry;
      this.glow.renderOrder = 1.5;
      this.points = this.makeMarks();
      this.scene.add(this.surface, this.plane, this.glow, this.curve, this.points);
      this.recolor();
      this.bindDrag();
      CACHE2.set(el, this);
      this.sync(false);
      this.fit();
    }
    // the color range of a layer: from its 5th percentile, so that the deep wells do not take the
    // whole ramp, to its maximum, in world units. a flat layer is drawn in the middle of the ramp
    range(g) {
      const sorted = Float64Array.from(g).sort();
      const lo = sorted[Math.floor(0.05 * (sorted.length - 1))] * this.zscale, hi = sorted[sorted.length - 1] * this.zscale;
      return hi - lo > 1e-9 ? [lo, hi] : [hi - 1, hi + 1];
    }
    makeSurface() {
      const THREE = this.THREE, n = CELLS + 1, fn = this.fn;
      const position = new Float32Array(3 * n * n);
      const dx = (fn.x[1] - fn.x[0]) / CELLS, dy = (fn.y[1] - fn.y[0]) / CELLS;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        position[3 * (j * n + i)] = fn.x[0] + i * dx;
        position[3 * (j * n + i) + 1] = fn.y[0] + j * dy;
      }
      const index = new Uint32Array(6 * CELLS * CELLS);
      let k = 0;
      for (let j = 0; j < CELLS; j++) for (let i = 0; i < CELLS; i++) {
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        index.set([a, b, d, a, d, c], k);
        k += 6;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
      for (const [name, size] of [["zA", 1], ["zB", 1], ["nA", 3], ["nB", 3]]) {
        geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(size * n * n), size).setUsage(THREE.DynamicDrawUsage));
      }
      geometry.setIndex(new THREE.BufferAttribute(index, 1));
      const light = new THREE.Vector3(-0.45, -0.35, 0.82).normalize();
      const cell = Math.max(fn.x[1] - fn.x[0], fn.y[1] - fn.y[0]) / 24;
      const material = new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERTEX,
        fragmentShader: SURFACE_FRAGMENT,
        side: THREE.DoubleSide,
        uniforms: {
          uMix: { value: 1 },
          uRamp: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
          uGroove: { value: new THREE.Vector3() },
          uRange: { value: new THREE.Vector2(0, 1) },
          uLight: { value: light },
          uGrid: { value: new THREE.Vector2(cell, cell) }
        }
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      return mesh;
    }
    makePlane() {
      const THREE = this.THREE, [x0, x1] = this.fn.x, [y0, y1] = this.fn.y;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0]), 3));
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      const material = new THREE.ShaderMaterial({
        vertexShader: PLANE_VERTEX,
        fragmentShader: PLANE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Vector3() }, uAlpha: { value: 0 } }
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = 1;
      return mesh;
    }
    // the segments of a curve as quads of width pixels, with a hard edge, or with soft set a falloff
    makeCurve(width, soft) {
      const THREE = this.THREE;
      const material = new THREE.ShaderMaterial({
        vertexShader: LINE_VERTEX,
        fragmentShader: LINE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uColor: { value: new THREE.Vector3() },
          uAlpha: { value: 0 },
          uWidth: { value: width },
          uSoft: { value: soft },
          uViewport: { value: new THREE.Vector2(1, 1) },
          uBias: { value: 4e-3 }
        }
      });
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      return mesh;
    }
    makeMarks() {
      const THREE = this.THREE, marks = this.fn.marks;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3 * marks.length), 3));
      geometry.setAttribute("kind", new THREE.BufferAttribute(Float32Array.from(marks, (m) => m.kind === "saddle" ? 0 : 1), 1));
      const material = new THREE.ShaderMaterial({
        vertexShader: MARK_VERTEX,
        fragmentShader: MARK_FRAGMENT,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uFill: { value: new THREE.Vector3() },
          uRing: { value: new THREE.Vector3() },
          uRise: { value: 0 },
          uLift: { value: RISE },
          uSize: { value: MARK_SIZE },
          uBias: { value: 6e-3 }
        }
      });
      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      points.renderOrder = 3;
      return points;
    }
    /** Reads the colors of the theme from the custom properties of the element, e.g. after a flip of the mode. */
    recolor() {
      const cs = getComputedStyle(this.el), css = (name, fallback) => rgb(cs.getPropertyValue(name), fallback);
      const bg = css("--bg", [0.02, 0.02, 0.02]), text = css("--text", [0.95, 0.95, 0.94]);
      const violet = css("--violet", [0.79, 0.31, 0.9]), accent = css("--accent", [0.94, 0.5, 0.31]);
      const blue = css("--data-5", [0, 0.45, 0.7]);
      const u = this.surface.material.uniforms, set2 = (target, c) => target.set(c[0], c[1], c[2]);
      const ramp2 = [mix3(blue, bg, 0.7), mix3(blue, violet, 0.35), violet, mix3(violet, text, 0.55)];
      ramp2.forEach((c, i) => set2(u.uRamp.value[i], c));
      set2(u.uGroove.value, bg);
      set2(this.plane.material.uniforms.uColor.value, accent);
      set2(this.curve.material.uniforms.uColor.value, mix3(accent, text, 0.35));
      set2(this.glow.material.uniforms.uColor.value, accent);
      set2(this.points.material.uniforms.uFill.value, text);
      set2(this.points.material.uniforms.uRing.value, bg);
    }
    // the stage set by the visible fragment of the slide with data-surface-stage and the highest
    // fragment index, or the data-stage of the element, or the initial stage of the function
    target() {
      let best = null, index = -Infinity;
      for (const f of this.el.closest("section")?.querySelectorAll(".fragment.visible[data-surface-stage]") ?? []) {
        const i = num2(f.dataset.fragmentIndex, 0);
        if (i >= index) {
          best = f;
          index = i;
        }
      }
      let name = best?.dataset.surfaceStage ?? this.el.dataset.stage ?? this.fn.initial;
      if (!(name in this.fn.stages)) {
        console.error(`beeson: unknown surface stage "${name}" of ${this.el.dataset.function}, known: ${Object.keys(this.fn.stages).join(", ")}`);
        name = this.fn.initial;
      }
      return { name, stage: this.fn.stages[name]({ ...this.el.dataset, ...best?.dataset }) };
    }
    /** Sets the stage from the fragments of the slide, animated or at once. */
    sync(animate) {
      const { name, stage } = this.target();
      if (name === this.stageName) return;
      const first = !this.stageName;
      this.stageName = name;
      this.el.dataset.shown = name;
      const grid = this.grids.get(stage.layer) ?? this.B;
      const [lo, hi] = this.ranges.get(stage.layer) ?? [this.shown.lo, this.shown.hi];
      const to = { lo, hi, marks: stage.marks ? 1 : 0, cut: stage.level === null ? 0 : 1, level: stage.level ?? this.fn.floor };
      this.placeMarks(stage.layer);
      if (!animate || first) {
        this.A = this.B = grid;
        this.mix = 1;
        this.shown = this.from = this.to = to;
        this.moving = false;
      } else {
        this.A = this.current();
        this.B = grid;
        this.mix = 0;
        this.from = { ...this.shown, level: this.shown.cut > 0 ? this.shown.level : this.fn.floor };
        this.to = to;
        this.duration = this.from.level !== to.level ? SLIDE : MORPH;
        this.t0 = performance.now();
        this.moving = true;
      }
      this.upload();
      if (this.moving) this.kick();
      else this.draw();
    }
    // the heights drawn now, nondimensional
    current() {
      if (this.mix >= 1 || this.A === this.B) return this.B;
      const a = this.A, b = this.B, t = this.mix;
      return a.map((z, i) => z + (b[i] - z) * t);
    }
    // the unit normals of the heights g in world units, by central differences
    normalsOf(g) {
      const cached = this.normals.get(g);
      if (cached) return cached;
      const n = CELLS + 1, out = new Float32Array(3 * n * n), s = this.zscale;
      const dx = (this.fn.x[1] - this.fn.x[0]) / CELLS, dy = (this.fn.y[1] - this.fn.y[0]) / CELLS;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const at = (a, b) => g[clamp(b, 0, CELLS) * n + clamp(a, 0, CELLS)];
        const gx = s * (at(i + 1, j) - at(i - 1, j)) / ((Math.min(i + 1, CELLS) - Math.max(i - 1, 0)) * dx);
        const gy = s * (at(i, j + 1) - at(i, j - 1)) / ((Math.min(j + 1, CELLS) - Math.max(j - 1, 0)) * dy);
        const r = Math.hypot(gx, gy, 1), k = 3 * (j * n + i);
        out[k] = -gx / r;
        out[k + 1] = -gy / r;
        out[k + 2] = 1 / r;
      }
      this.normals.set(g, out);
      return out;
    }
    upload() {
      const geometry = this.surface.geometry, s = this.zscale;
      const zA = geometry.getAttribute("zA"), zB = geometry.getAttribute("zB");
      for (let i = 0; i < this.A.length; i++) {
        zA.array[i] = this.A[i] * s;
        zB.array[i] = this.B[i] * s;
      }
      geometry.getAttribute("nA").set(this.normalsOf(this.A));
      geometry.getAttribute("nB").set(this.normalsOf(this.B));
      for (const name of ["zA", "zB", "nA", "nB"]) geometry.getAttribute(name).needsUpdate = true;
    }
    // the marks on the layer, in world units
    placeMarks(layer) {
      if (layer === this.markLayer) return;
      this.markLayer = layer;
      const f = clamped(this.fn.layers[layer] ?? (() => 0), this.fn.floor);
      const position = this.points.geometry.getAttribute("position");
      this.fn.marks.forEach((m, i) => position.setXYZ(i, m.x, m.y, f(m.x, m.y) * this.zscale));
      position.needsUpdate = true;
    }
    /** Sizes the canvas from the box of the element on the screen, and draws. */
    fit() {
      const r = this.el.getBoundingClientRect(), dpr = devicePixelRatio || 1;
      const w = this.el.offsetWidth, h = this.el.offsetHeight;
      if (!r.width || !r.height || !w || !h) return;
      this.W = Math.max(1, Math.round(r.width * dpr));
      this.H = Math.max(1, Math.round(r.height * dpr));
      this.w = w;
      this.h = h;
      this.canvas.width = this.W;
      this.canvas.height = this.H;
      const px = dpr * r.height / h;
      this.curve.material.uniforms.uViewport.value.set(this.W, this.H);
      this.curve.material.uniforms.uWidth.value = CURVE_WIDTH * px;
      this.glow.material.uniforms.uViewport.value.set(this.W, this.H);
      this.glow.material.uniforms.uWidth.value = GLOW_WIDTH * px;
      this.points.material.uniforms.uSize.value = MARK_SIZE * px;
      this.camera.aspect = this.W / this.H;
      this.draw();
    }
    // the camera on a sphere about the middle of the box of the surface, at a distance at which the
    // sphere around the box fits the narrower field of view, divided by data-zoom
    aim() {
      const fn = this.fn, s = this.zscale;
      const cx = (fn.x[0] + fn.x[1]) / 2, cy = (fn.y[0] + fn.y[1]) / 2, cz = (this.zmin + this.zmax) / 2 * s;
      const R = 0.5 * Math.hypot(fn.x[1] - fn.x[0], fn.y[1] - fn.y[0], (this.zmax - this.zmin) * s);
      const v = this.camera.fov * Math.PI / 360, half = Math.min(v, Math.atan(Math.tan(v) * this.camera.aspect));
      const d = R / Math.sin(half) * 0.86 / this.zoom;
      const c = Math.cos(this.elevation);
      this.camera.position.set(cx + d * c * Math.cos(this.azimuth), cy + d * c * Math.sin(this.azimuth), cz + d * Math.sin(this.elevation));
      this.camera.near = Math.max(0.01, d - 2 * R);
      this.camera.far = d + 2 * R;
      this.camera.lookAt(cx, cy, cz);
      this.camera.updateProjectionMatrix();
    }
    // the curve of intersection of the plane at the level shown, recomputed when the level or the
    // heights have changed
    trace() {
      const key = this.shown.cut > 0 ? `${this.shown.level}|${this.mix}|${this.markLayer}` : "";
      if (key === this.drawn) return;
      this.drawn = key;
      const curves = key ? levelCurves(this.current(), this.fn.x, this.fn.y, CELLS, CELLS, this.shown.level) : [];
      const count = curves.reduce((total, c) => total + Math.max(0, c.length / 2 - 1), 0);
      const geometry = this.curve.geometry, THREE = this.THREE;
      if (count > this.capacity) {
        this.capacity = Math.max(1024, 2 * count);
        const corner = new Float32Array(12 * this.capacity);
        const quad = [0, -1, 1, -1, 1, 1, 0, -1, 1, 1, 0, 1];
        for (let i = 0; i < this.capacity; i++) corner.set(quad, 12 * i);
        geometry.setAttribute("corner", new THREE.BufferAttribute(corner, 2));
        geometry.setAttribute("start", new THREE.BufferAttribute(new Float32Array(18 * this.capacity), 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute("end", new THREE.BufferAttribute(new Float32Array(18 * this.capacity), 3).setUsage(THREE.DynamicDrawUsage));
      }
      if (!this.capacity) return;
      const start2 = geometry.getAttribute("start"), end = geometry.getAttribute("end");
      const a = start2.array, b = end.array, z = this.shown.level * this.zscale;
      let k = 0;
      for (const c of curves) {
        for (let i = 0; i + 3 < c.length; i += 2) {
          for (let v = 0; v < 6; v++, k += 3) {
            a[k] = c[i];
            a[k + 1] = c[i + 1];
            a[k + 2] = z;
            b[k] = c[i + 2];
            b[k + 1] = c[i + 3];
            b[k + 2] = z;
          }
        }
      }
      for (const attribute of [start2, end]) {
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(0, k);
        attribute.needsUpdate = true;
      }
      geometry.setDrawRange(0, 6 * count);
    }
    /** Draws the surface at the stage and the camera of now, and places the labels. */
    draw() {
      if (!this.W) return;
      const r = renderer();
      if (!r) return;
      const shown = this.shown, u = this.surface.material.uniforms;
      u.uMix.value = this.mix;
      u.uRange.value.set(shown.lo, shown.hi);
      this.plane.position.z = shown.level * this.zscale;
      this.plane.material.uniforms.uAlpha.value = 0.2 * shown.cut;
      this.plane.visible = shown.cut > 0;
      this.curve.material.uniforms.uAlpha.value = Math.min(1, 2 * shown.cut);
      this.curve.visible = shown.cut > 0;
      this.glow.material.uniforms.uAlpha.value = 0.45 * Math.min(1, 2 * shown.cut);
      this.glow.visible = shown.cut > 0;
      this.points.material.uniforms.uRise.value = shown.marks;
      this.points.visible = shown.marks > 0;
      this.trace();
      this.aim();
      if (r.domElement.width !== this.W || r.domElement.height !== this.H) r.setSize(this.W, this.H, false);
      r.render(this.scene, this.camera);
      const ctx = this.canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, this.W, this.H);
      ctx.drawImage(r.domElement, 0, 0);
      this.place();
    }
    // the labels at their marks, in the pixels of the slide, faded with the marks and dimmed behind
    // the surface
    place() {
      const THREE = this.THREE, p = new THREE.Vector3(), lift = (1 - this.shown.marks) * RISE;
      const position = this.points.geometry.getAttribute("position");
      for (const lab of this.labels) {
        const i = this.fn.marks.findIndex((m) => m.name === lab.dataset.at);
        if (i < 0) continue;
        p.set(position.getX(i), position.getY(i), position.getZ(i) - lift);
        const hidden = this.behind(p);
        p.project(this.camera);
        lab.style.left = `${(p.x + 1) / 2 * this.w + num2(lab.dataset.dx, 0)}px`;
        lab.style.top = `${(1 - p.y) / 2 * this.h + num2(lab.dataset.dy, -34)}px`;
        lab.style.opacity = String(this.shown.marks ** 2 * (hidden ? 0.3 : 1));
      }
    }
    // whether the surface is between the world point p, a little above it, and the camera
    behind(p) {
      const fn = this.fn, g = this.current(), n = CELLS + 1, cam = this.camera.position;
      const height = (x, y) => {
        const u = (x - fn.x[0]) / (fn.x[1] - fn.x[0]) * CELLS, v = (y - fn.y[0]) / (fn.y[1] - fn.y[0]) * CELLS;
        if (u < 0 || v < 0 || u > CELLS || v > CELLS) return null;
        const i = Math.min(CELLS - 1, Math.floor(u)), j = Math.min(CELLS - 1, Math.floor(v)), s = u - i, t = v - j;
        const z = (1 - t) * ((1 - s) * g[j * n + i] + s * g[j * n + i + 1]) + t * ((1 - s) * g[(j + 1) * n + i] + s * g[(j + 1) * n + i + 1]);
        return z * this.zscale;
      };
      for (let k = 1; k <= 80; k++) {
        const t = 0.01 + k / 80 * 0.99;
        const x = p.x + (cam.x - p.x) * t, y = p.y + (cam.y - p.y) * t, z = p.z + 0.03 + (cam.z - p.z) * t;
        const zs = height(x, y);
        if (zs === null) return false;
        if (zs > z) return true;
      }
      return false;
    }
    bindDrag() {
      const el = this.el;
      el.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        this.drag = { x: ev.clientX, y: ev.clientY };
        try {
          el.setPointerCapture(ev.pointerId);
        } catch {
        }
        el.classList.add("dragging");
      });
      el.addEventListener("pointermove", (ev) => {
        if (!this.drag) return;
        const scale = el.getBoundingClientRect().width / (el.offsetWidth || 1) || 1;
        const dx = (ev.clientX - this.drag.x) / scale, dy = (ev.clientY - this.drag.y) / scale;
        this.drag = { x: ev.clientX, y: ev.clientY };
        this.azimuth -= dx * 5e-3;
        this.elevation = clamp(this.elevation + dy * 4e-3, 0.12, 1.45);
        if (!this.raf) this.draw();
      });
      const end = () => {
        if (!this.drag) return;
        this.drag = null;
        el.classList.remove("dragging");
        this.resume = performance.now() + 1500;
      };
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
    }
    kick() {
      if (this.active && !this.raf) this.raf = requestAnimationFrame(this.tick);
    }
    // the end of a change of stage, at once
    settle() {
      if (!this.moving) return;
      this.moving = false;
      this.mix = 1;
      this.shown = this.to;
    }
    /** Starts the turning of the camera and the animation of a change of stage, while the slide is shown. */
    start() {
      this.active = true;
      this.last = 0;
      if (this.moving || this.rate) this.kick();
      else this.draw();
    }
    /** Stops the animation, and ends a change of stage at once. */
    stop() {
      this.active = false;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.settle();
    }
  };
  function mount2(root2) {
    const out = [];
    for (const el of root2.querySelectorAll(".surface")) {
      const known = CACHE2.get(el);
      if (known) {
        out.push(known);
        continue;
      }
      const fn = surfaceFunction(el.dataset.function ?? "", el.dataset);
      if (!fn) {
        console.error(`beeson: unknown surface function "${el.dataset.function ?? ""}", known: ${FUNCTION_NAMES.join(", ")}`);
        continue;
      }
      if (!renderer() || !window.THREE) continue;
      out.push(new Surface(el, fn, window.THREE));
    }
    return out;
  }

  // src/steps.ts
  function initSteps(deck) {
    const mark = () => {
      const slide = deck.getCurrentSlide();
      if (!slide) return;
      slide.toggleAttribute("data-complete", !deck.availableFragments().next);
    };
    for (const type of ["fragmentshown", "fragmenthidden", "slidechanged"]) deck.on(type, mark);
    mark();
  }

  // src/switcher.ts
  var KEY = "beeson-theme";
  var root = document.documentElement;
  var pinned = false;
  var button = null;
  var flip = null;
  var isTheme = (v) => v === "dark" || v === "light";
  function get() {
    return root.dataset.theme === "light" ? "light" : "dark";
  }
  function apply(theme) {
    root.dataset.theme = theme;
    if (button) button.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    document.dispatchEvent(new CustomEvent("beeson:theme", { detail: { theme } }));
  }
  function store(theme) {
    if (pinned) return;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
    }
  }
  function set(theme, at) {
    if (!isTheme(theme) || theme === get()) return;
    store(theme);
    const doc = document;
    if (!doc.startViewTransition || Orbits.reduced()) {
      apply(theme);
      return;
    }
    const b = button?.getBoundingClientRect();
    const x = at?.x ?? (b ? b.left + b.width / 2 : innerWidth), y = at?.y ?? (b ? b.top + b.height / 2 : 0);
    root.style.setProperty("--flip-x", `${x}px`);
    root.style.setProperty("--flip-y", `${y}px`);
    root.style.setProperty("--flip-r", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
    root.classList.toggle("to-dark", theme === "dark");
    root.classList.toggle("to-light", theme === "light");
    const tr = doc.startViewTransition(() => apply(theme));
    flip = tr;
    tr.finished.finally(() => {
      if (flip === tr) root.classList.remove("to-dark", "to-light");
    }).catch(() => {
    });
  }
  function toggle(at) {
    set(get() === "dark" ? "light" : "dark", at);
  }
  function initTheme() {
    const asked = new URLSearchParams(location.search).get("theme");
    let theme = "dark";
    if (isTheme(asked)) {
      theme = asked;
      pinned = true;
    } else {
      try {
        const saved = localStorage.getItem(KEY);
        if (isTheme(saved)) theme = saved;
      } catch {
      }
    }
    root.dataset.theme = theme;
  }
  function initSwitcher() {
    const deck = document.querySelector(".reveal");
    if (!deck || button) return;
    button = document.createElement("button");
    button.className = "theme-switch";
    button.type = "button";
    button.setAttribute("aria-label", get() === "dark" ? "Switch to light mode" : "Switch to dark mode");
    button.addEventListener("click", (ev) => {
      toggle(ev.detail > 0 ? { x: ev.clientX, y: ev.clientY } : void 0);
      button?.blur();
    });
    deck.append(button);
  }
  function forDeck(ev) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) return false;
    const target = (ev.target instanceof Element ? ev.target : null) ?? document.activeElement;
    return !target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], tycho-viewer');
  }

  // src/main.ts
  var DEFAULTS = {
    width: 1920,
    height: 1080,
    margin: 0,
    minScale: 0.1,
    maxScale: 3,
    hash: true,
    transition: "fade",
    backgroundTransition: "none",
    autoAnimateDuration: 0.5,
    autoAnimateEasing: "ease-out",
    autoAnimateUnmatched: true,
    progress: true,
    slideNumber: "c/t",
    controls: false,
    center: false,
    pdfSeparateFragments: true,
    // off with 0, since the chrome, the mode button, and the viewer are lost in the scroll view that
    // reveal.js would start in a narrow window
    scrollActivationWidth: 0
  };
  var TRACED = ["title", "section", "closing"];
  var backdrops = [];
  var surfaces = [];
  var still = () => Orbits.reduced() || window.Reveal.isPrintView() || /print-pdf/.test(location.search);
  function remount() {
    for (const o of mount(document)) if (!backdrops.includes(o)) backdrops.push(o);
    if (document.querySelector(".surface")) {
      for (const s of mount2(document)) if (!surfaces.includes(s)) surfaces.push(s);
    }
  }
  var within = (slide) => slide ? backdrops.filter((o) => slide.contains(o.el)) : [];
  var surfacesOf = (slide) => slide ? surfaces.filter((s) => slide.contains(s.el)) : [];
  function show(slide) {
    const glide = slide.hasAttribute("data-auto-animate");
    for (const o of within(slide)) {
      o.fit();
      if (still()) {
        o.complete();
        continue;
      }
      const loop = o.el.hasAttribute("data-loop");
      if (glide) {
        o.complete();
        const seconds = Number(slide.dataset.autoAnimateDuration ?? window.Reveal.getConfig().autoAnimateDuration ?? 1);
        setTimeout(() => {
          if (window.Reveal.getCurrentSlide() !== slide) return;
          o.fit();
          if (loop) o.start();
        }, seconds * 1e3 + 50);
      } else if (loop || o.el.hasAttribute("data-live") || TRACED.some((c) => slide.classList.contains(c))) {
        o.reset();
        o.start();
      } else o.complete();
    }
    for (const s of surfacesOf(slide)) {
      s.fit();
      s.sync(false);
      if (!still()) s.start();
    }
  }
  function completeAll() {
    remount();
    for (const o of backdrops) {
      o.fit();
      o.complete();
    }
    for (const s of surfaces) {
      s.fit();
      s.sync(false);
      s.draw();
    }
  }
  async function start(options = {}) {
    const deck = window.Reveal;
    const plugins = [...options.plugins ?? []];
    if (window.RevealNotes && !plugins.includes(window.RevealNotes)) plugins.push(window.RevealNotes);
    initSwitcher();
    deck.on("pdf-ready", () => {
      completeAll();
      syncViewers(get());
      void stillViewers();
    });
    await deck.initialize({ ...DEFAULTS, ...options, plugins });
    initChrome(deck);
    initSteps(deck);
    remount();
    initCursor(() => backdrops, () => deck.getCurrentSlide());
    deck.addKeyBinding({ keyCode: 68, key: "D", description: "Switch dark and light" }, (ev) => {
      if (forDeck(ev)) toggle();
    });
    deck.addKeyBinding({ keyCode: 80, key: "P", description: "Pointer" }, (ev) => {
      if (forDeck(ev)) togglePointer();
    });
    if (still()) completeAll();
    else show(deck.getCurrentSlide());
    deck.on("slidechanged", (event) => {
      const ev = event;
      if (!still()) {
        for (const o of within(ev.previousSlide)) if (!ev.currentSlide.contains(o.el)) o.reset();
      }
      for (const s of surfacesOf(ev.previousSlide)) s.stop();
      show(ev.currentSlide);
    });
    const step2 = () => {
      for (const s of surfacesOf(deck.getCurrentSlide())) s.sync(!still());
    };
    deck.on("fragmentshown", step2);
    deck.on("fragmenthidden", step2);
    deck.on("resize", () => {
      for (const o of backdrops) o.fit();
      for (const s of surfaces) s.fit();
    });
    syncViewers(get());
    document.addEventListener("beeson:theme", () => {
      for (const o of backdrops) o.redraw();
      for (const s of surfaces) {
        s.recolor();
        s.draw();
      }
      syncViewers(get());
    });
  }
  function syncViewers(theme) {
    for (const viewer of document.querySelectorAll("tycho-viewer")) {
      viewer.setAttribute("theme", theme);
      viewer.setAttribute("data-prevent-swipe", "");
    }
  }
  initTheme();
  var Beeson = {
    start,
    theme: { get, set: (theme) => set(theme), toggle: () => toggle() },
    backdrops,
    surfaces,
    version: "1.0.0"
  };
  window.Beeson = Beeson;
})();
