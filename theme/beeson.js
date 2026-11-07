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
  var still = () => Orbits.reduced() || window.Reveal.isPrintView() || /print-pdf/.test(location.search);
  function remount() {
    for (const o of mount(document)) if (!backdrops.includes(o)) backdrops.push(o);
  }
  var within = (slide) => slide ? backdrops.filter((o) => slide.contains(o.el)) : [];
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
  }
  function completeAll() {
    remount();
    for (const o of backdrops) {
      o.fit();
      o.complete();
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
      show(ev.currentSlide);
    });
    deck.on("resize", () => {
      for (const o of backdrops) o.fit();
    });
    syncViewers(get());
    document.addEventListener("beeson:theme", () => {
      for (const o of backdrops) o.redraw();
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
    version: "1.0.0"
  };
  window.Beeson = Beeson;
})();
