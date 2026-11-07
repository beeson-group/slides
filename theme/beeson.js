/*! beeson.js 1.0.0, the reveal.js theme of the Beeson group. MIT license. The orbit engine is ported from src/lib/orbits.ts of https://github.com/ClouD-161803/ClouD-161803.github.io (MIT). */
"use strict";
(() => {
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
    const at = (i, j) => g[j * (nx + 1) + i];
    const links = /* @__PURE__ */ new Map(), where = /* @__PURE__ */ new Map();
    const edge = (i, j, h) => {
      const key = `${h ? "h" : "v"}${i},${j}`;
      if (!where.has(key)) {
        const a = at(i, j), b = h ? at(i + 1, j) : at(i, j + 1), t = a / (a - b);
        where.set(key, h ? [x0 + (i + t) * d, y0 + j * d] : [x0 + i * d, y0 + (j + t) * d]);
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
      const p = [], t = [];
      let cur = start2;
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        const [x, y] = where.get(cur) ?? [0, 0];
        p.push(x, y, 0);
        t.push(t.length * 4e-3);
        cur = links.get(cur)?.find((k) => !seen.has(k));
      }
      if (t.length > 8) out.push(toned(open(p, t), "line"));
    }
    return out;
  }
  function lap(orbit, ax, ay, bx, by) {
    const n = orbit.times.length - 1;
    const nearest2 = (x, y) => {
      let best = 0;
      for (let i = 1; i < n; i++) if (Math.hypot(orbit.pts[2 * i] - x, orbit.pts[2 * i + 1] - y) < Math.hypot(orbit.pts[2 * best] - x, orbit.pts[2 * best + 1] - y)) best = i;
      return best;
    };
    const from = nearest2(ax, ay), count = n + (nearest2(bx, by) - from + n) % n + 1;
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
  function toCrossing(s0, h, tmin, tmax, path, times, count = 1, axis2 = 1) {
    const s = Float64Array.from(s0);
    let t = 0;
    const record = () => {
      if (path) path.push(s[0], s[1], s[2]);
      if (times) times.push(t);
    };
    record();
    let prev = s[axis2], left = count;
    for (let n = 0; n < 1e5; n++) {
      t += step(s, h);
      if (t > tmin && (s[axis2] === 0 || s[axis2] > 0 !== prev > 0) && --left === 0) {
        const dtc = -s[axis2] / s[axis2 + 3];
        const a = new Float64Array(6);
        accel(s, a);
        for (let i = 0; i < 6; i++) s[i] += dtc * a[i];
        t += dtc;
        record();
        return { s, t, hit: true };
      }
      prev = s[axis2];
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
  function correct(s0, free, target, h, tmin, tmax, iters, count = 1, axis2 = 1) {
    const s = Float64Array.from(s0);
    let path = [], times = [];
    for (let it = 0; it < iters; it++) {
      path = [];
      times = [];
      const base = toCrossing(s, h, tmin, tmax, path, times, count, axis2);
      if (!base.hit) return null;
      const f = target.map((i) => base.s[i]);
      if (f.every((v) => Math.abs(v) < 1e-6)) return { s, path, times, t: base.t };
      const J = [];
      for (let j = 0; j < free.length; j++) {
        const d = 1e-6;
        const sp = Float64Array.from(s);
        sp[free[j]] += d;
        const r2 = toCrossing(sp, h, tmin, tmax, void 0, void 0, count, axis2);
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
    const r = toCrossing(s, h, tmin, tmax, path, times, count, axis2);
    return r.hit ? { s, path, times, t: r.t } : null;
  }
  function family(guess, p, values, free, target, h, tmin, tmax, skip, count = 1, axis2 = 1) {
    const out = [];
    let prev = null, prev2 = null;
    const accept = (r) => r && (!prev || Math.abs(r.t - prev.t) < prev.t / 3) ? r : null;
    for (const v of values) {
      let r = null;
      if (prev && prev2) {
        const s0 = Float64Array.from(prev.s);
        s0[p] = v;
        for (const i of free) s0[i] = prev.s[i] + (prev.s[i] - prev2.s[i]) / (prev.s[p] - prev2.s[p]) * (v - prev.s[p]);
        r = accept(correct(s0, free, target, h, tmin(v), tmax(v), 6, count, axis2));
      }
      if (!r) r = accept(correct(guess(v), free, target, h, tmin(v), tmax(v), 8, count, axis2));
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
  function lagrange(n) {
    let x = n === 1 ? 1 - MU - Math.cbrt(MU / 3) : n === 2 ? 1 - MU + Math.cbrt(MU / 3) : -1 - 5 * MU / 12;
    for (let i = 0; i < 30; i++) {
      const d1 = x + MU, d2 = x - 1 + MU;
      const f = x - (1 - MU) * Math.sign(d1) / (d1 * d1) - MU * Math.sign(d2) / (d2 * d2);
      const df = 1 + 2 * (1 - MU) / Math.abs(d1 * d1 * d1) + 2 * MU / Math.abs(d2 * d2 * d2);
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
    for (const list2 of document.querySelectorAll(".reveal ul.outline[data-auto]")) {
      const home = list2.closest("section");
      list2.replaceChildren(
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

  // src/plot.ts
  var KINDS = ["points", "trace", "label", "events"];
  function fail(path, what) {
    throw new Error(`${path}: ${what}`);
  }
  var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
  function num(v, path, fallback) {
    if (v === void 0 && fallback !== void 0) return fallback;
    if (typeof v !== "number" || !Number.isFinite(v)) fail(path, "a number is expected");
    return v;
  }
  function str(v, path, fallback) {
    if (v === void 0 && fallback !== void 0) return fallback;
    if (typeof v !== "string") fail(path, "a string is expected");
    return v;
  }
  function list(v, path, fallback) {
    if (v === void 0 && fallback !== void 0) return fallback;
    if (!Array.isArray(v)) fail(path, "a list is expected");
    return v;
  }
  function pair(v, path) {
    const a = list(v, path);
    if (a.length !== 2) fail(path, "a pair [x, y] is expected");
    return [num(a[0], `${path}[0]`), num(a[1], `${path}[1]`)];
  }
  var pairs = (v, path) => list(v, path).map((p, i) => pair(p, `${path}[${i}]`));
  function anchor(v, path) {
    const a = str(v, path, "middle");
    if (a !== "start" && a !== "middle" && a !== "end") fail(path, "start, middle, or end is expected");
    return a;
  }
  function item(o, path, tone) {
    const cls = str(o.class, `${path}.class`, "").split(/\s+/).filter(Boolean);
    return { id: o.id === void 0 ? null : str(o.id, `${path}.id`), tone: str(o.tone, `${path}.tone`, tone), cls };
  }
  function axis(v, path) {
    if (!isObject(v)) fail(path, "an axis { range, ticks, title } is expected");
    const range = pair(v.range, `${path}.range`);
    if (!(range[1] > range[0])) fail(`${path}.range`, "the second end must be larger than the first");
    return { range, ticks: list(v.ticks, `${path}.ticks`, []).map((t, i) => num(t, `${path}.ticks[${i}]`)), title: str(v.title, `${path}.title`, "") };
  }
  function panel(v, path) {
    if (!isObject(v)) fail(path, "a panel is expected");
    const regions = list(v.regions, `${path}.regions`, []).map((r, i) => {
      const p = `${path}.regions[${i}]`;
      if (!isObject(r)) fail(p, "a region is expected");
      return { ...item(r, p, "violet"), points: pairs(r.points, `${p}.points`), opacity: num(r.opacity, `${p}.opacity`, 0.12) };
    });
    const curves = list(v.curves, `${path}.curves`, []).map((c, i) => {
      const p = `${path}.curves[${i}]`;
      if (!isObject(c)) fail(p, "a curve is expected");
      let circle = null;
      if (c.circle !== void 0) {
        const a = list(c.circle, `${p}.circle`);
        if (a.length !== 3) fail(`${p}.circle`, "a circle [cx, cy, r] is expected");
        circle = [num(a[0], `${p}.circle[0]`), num(a[1], `${p}.circle[1]`), num(a[2], `${p}.circle[2]`)];
      } else if (c.points === void 0) fail(p, "points or circle is expected");
      const dash = c.dash === void 0 ? null : list(c.dash, `${p}.dash`).map((d, j) => num(d, `${p}.dash[${j}]`));
      return { ...item(c, p, "subtle"), points: circle ? null : pairs(c.points, `${p}.points`), circle, width: num(c.width, `${p}.width`, 2), dash };
    });
    const labels = list(v.labels, `${path}.labels`, []).map((l, i) => {
      const p = `${path}.labels[${i}]`;
      if (!isObject(l)) fail(p, "a label is expected");
      return { ...item(l, p, "subtle"), at: pair(l.at, `${p}.at`), text: str(l.text, `${p}.text`), anchor: anchor(l.anchor, `${p}.anchor`), dx: num(l.dx, `${p}.dx`, 0), dy: num(l.dy, `${p}.dy`, 0) };
    });
    return {
      id: str(v.id, `${path}.id`),
      x: axis(v.x, `${path}.x`),
      y: axis(v.y, `${path}.y`),
      equal: v.equal === true,
      axes: v.axes !== false,
      title: str(v.title, `${path}.title`, ""),
      regions,
      curves,
      labels
    };
  }
  function markData(m, v, frames, path) {
    const perFrame = (n) => n === 1 || n === frames || fail(path, `${n} frames are given, and the tab has ${frames} values`);
    if (m.kind === "points") {
      const a = list(v, path).map((f, i) => list(f, `${path}[${i}]`).map((x, j) => num(x, `${path}[${i}][${j}]`)));
      perFrame(a.length);
      a.forEach((f, i) => f.length % 2 === 0 || fail(`${path}[${i}]`, "pairs of x and y are expected"));
      return a;
    }
    if (m.kind === "trace") {
      const a = pairs(v, path);
      perFrame(a.length);
      return a;
    }
    if (m.kind === "label") {
      if (!isObject(v)) fail(path, "a label { at, text } is expected");
      const at = Array.isArray(v.at) && Array.isArray(v.at[0]) ? pairs(v.at, `${path}.at`) : [pair(v.at, `${path}.at`)];
      const text = Array.isArray(v.text) ? v.text.map((t, i) => str(t, `${path}.text[${i}]`)) : [str(v.text, `${path}.text`)];
      perFrame(at.length);
      perFrame(text.length);
      return { at, text };
    }
    return list(v, path).map((e, i) => {
      const p = `${path}[${i}]`;
      if (!isObject(e)) fail(p, "an event { frame, at, text } is expected");
      const frame = num(e.frame, `${p}.frame`);
      if (frame < 0 || frame > frames - 1) fail(`${p}.frame`, `a frame from 0 to ${frames - 1} is expected`);
      return { frame, at: pair(e.at, `${p}.at`), text: str(e.text, `${p}.text`, "") };
    });
  }
  function parsePlot(input) {
    const v = typeof input === "string" ? JSON.parse(input) : input;
    if (!isObject(v)) fail("plot", "an object is expected");
    const panels = list(v.panels, "panels").map((p, i) => panel(p, `panels[${i}]`));
    if (!panels.length) fail("panels", "at least one panel is expected");
    const ids = new Set(panels.map((p) => p.id));
    if (ids.size !== panels.length) fail("panels", "the ids of the panels must differ");
    const marks = list(v.marks, "marks", []).map((m, i) => {
      const p = `marks[${i}]`;
      if (!isObject(m)) fail(p, "a mark is expected");
      const kind = str(m.kind, `${p}.kind`);
      if (!KINDS.includes(kind)) fail(`${p}.kind`, `one of ${KINDS.join(", ")} is expected`);
      const at = str(m.panel, `${p}.panel`);
      if (!ids.has(at)) fail(`${p}.panel`, `the panel ${at} is not declared`);
      const base = item(m, p, "accent");
      return {
        ...base,
        id: str(m.id, `${p}.id`),
        panel: at,
        kind,
        tone: base.tone,
        size: num(m.size, `${p}.size`, kind === "events" ? 16 : 10),
        width: num(m.width, `${p}.width`, 3),
        hollow: m.hollow === true,
        anchor: anchor(m.anchor, `${p}.anchor`),
        dx: num(m.dx, `${p}.dx`, 0),
        dy: num(m.dy, `${p}.dy`, 0)
      };
    });
    const tabs = list(v.tabs, "tabs").map((t, i) => {
      const p = `tabs[${i}]`;
      if (!isObject(t)) fail(p, "a tab is expected");
      const name = str(t.name, `${p}.name`);
      const values = list(t.values, `${p}.values`).map((x, j) => num(x, `${p}.values[${j}]`));
      if (!values.length) fail(`${p}.values`, "at least one value is expected");
      const raw = t.data === void 0 ? {} : t.data;
      if (!isObject(raw)) fail(`${p}.data`, "an object of mark ids is expected");
      const data = {};
      for (const key of Object.keys(raw)) {
        const m = marks.find((mark) => mark.id === key) ?? fail(`${p}.data.${key}`, "the mark is not declared");
        data[key] = markData(m, raw[key], values.length, `${p}.data.${key}`);
      }
      let active = null;
      if (t.active !== void 0) {
        active = list(t.active, `${p}.active`).map((f, j) => typeof f === "string" ? [f] : list(f, `${p}.active[${j}]`).map((s, k) => str(s, `${p}.active[${j}][${k}]`)));
        if (active.length !== values.length) fail(`${p}.active`, `${active.length} frames are given, and the tab has ${values.length} values`);
      }
      return { name, label: str(t.label, `${p}.label`, name), values, data, active };
    });
    if (!tabs.length) fail("tabs", "at least one tab is expected");
    const parameter = isObject(v.parameter) ? v.parameter : {};
    const layout = v.layout === void 0 ? null : str(v.layout, "layout");
    if (layout !== null && layout !== "row" && layout !== "column") fail("layout", "row or column is expected");
    return {
      parameter: { label: str(parameter.label, "parameter.label", ""), digits: num(parameter.digits, "parameter.digits", 3) },
      duration: num(v.duration, "duration", 8),
      hold: num(v.hold, "hold", 1),
      layout,
      panels,
      marks,
      tabs
    };
  }
  var clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  function valueAt(values, u) {
    const n = values.length;
    if (n === 1) return values[0];
    const v = clamp(u, 0, n - 1), i = Math.min(n - 2, Math.floor(v)), f = v - i;
    return values[i] + f * (values[i + 1] - values[i]);
  }
  function nearest(frames, u) {
    return frames[clamp(Math.round(u), 0, frames.length - 1)];
  }
  function framesAt(frames, u) {
    const n = frames.length;
    if (n === 1) return frames[0];
    const v = clamp(u, 0, n - 1), i = Math.min(n - 2, Math.floor(v)), f = v - i;
    const a = frames[i], b = frames[i + 1];
    if (a.length !== b.length) return nearest(frames, v);
    return a.map((x, k) => x + f * (b[k] - x));
  }
  function traceTo(path, u) {
    const n = path.length, v = clamp(u, 0, n - 1), i = Math.floor(v), f = v - i;
    const out = path.slice(0, i + 1);
    if (f > 0 && i < n - 1) out.push([path[i][0] + f * (path[i + 1][0] - path[i][0]), path[i][1] + f * (path[i + 1][1] - path[i][1])]);
    return out;
  }
  function loopFrame(t, n, duration, hold) {
    if (n < 2) return 0;
    const tau = (t % (duration + hold) + duration + hold) % (duration + hold);
    return Math.min(1, tau / duration) * (n - 1);
  }
  var MINUS = "\u2212";
  function formatNumber(x, digits) {
    const s = digits === void 0 ? String(Number(x.toPrecision(6))) : x.toFixed(digits);
    return s.replace(/^-(?=.*[1-9])/, MINUS).replace(/^-/, "");
  }
  var SYMBOLS = {
    alpha: "\u03B1",
    beta: "\u03B2",
    gamma: "\u03B3",
    delta: "\u03B4",
    epsilon: "\u03B5",
    varepsilon: "\u03B5",
    zeta: "\u03B6",
    eta: "\u03B7",
    theta: "\u03B8",
    iota: "\u03B9",
    kappa: "\u03BA",
    lambda: "\u03BB",
    mu: "\u03BC",
    nu: "\u03BD",
    xi: "\u03BE",
    pi: "\u03C0",
    rho: "\u03C1",
    sigma: "\u03C3",
    tau: "\u03C4",
    upsilon: "\u03C5",
    phi: "\u03C6",
    varphi: "\u03C6",
    chi: "\u03C7",
    psi: "\u03C8",
    omega: "\u03C9",
    Gamma: "\u0393",
    Delta: "\u0394",
    Theta: "\u0398",
    Lambda: "\u039B",
    Xi: "\u039E",
    Pi: "\u03A0",
    Sigma: "\u03A3",
    Phi: "\u03A6",
    Psi: "\u03A8",
    Omega: "\u03A9",
    pm: "\xB1",
    mp: "\u2213",
    infty: "\u221E",
    cdot: "\xB7",
    times: "\xD7",
    approx: "\u2248",
    le: "\u2264",
    ge: "\u2265",
    ne: "\u2260",
    to: "\u2192",
    in: "\u2208"
  };
  function parseMarkup(src) {
    const runs = [];
    const push = (text, italic, shift) => {
      const last = runs.at(-1);
      if (last && last.italic === italic && last.shift === shift) last.text += text;
      else runs.push({ text, italic, shift });
    };
    const parts = src.split("$");
    parts.forEach((part, k) => {
      if (k % 2 === 0) {
        if (part) push(part, false, null);
        return;
      }
      math(part, false, null);
    });
    function group(s, i) {
      if (s[i] === "{") {
        let depth = 0, j = i;
        for (; j < s.length; j++) {
          if (s[j] === "{") depth++;
          else if (s[j] === "}" && --depth === 0) break;
        }
        return [s.slice(i + 1, j), j + 1];
      }
      if (s[i] === "\\") {
        const m = /^\\[A-Za-z]+/.exec(s.slice(i));
        if (m) return [m[0], i + m[0].length];
      }
      return [s[i] ?? "", i + 1];
    }
    function math(s, upright, shift) {
      let i = 0;
      while (i < s.length) {
        const c = s[i];
        if (c === "\\") {
          const m = /^\\([A-Za-z]+)/.exec(s.slice(i));
          if (!m) {
            push(s[i + 1] ?? "", false, shift);
            i += 2;
            continue;
          }
          i += m[0].length;
          if (m[1] === "mathrm" || m[1] === "text") {
            const [g, j] = group(s, i);
            i = j;
            math(g, true, shift);
          } else {
            const sym = SYMBOLS[m[1]] ?? m[0];
            push(sym, !upright && /^[a-z]+$/.test(m[1]) && /[α-ω]/.test(sym), shift);
          }
        } else if (c === "_" || c === "^") {
          const [g, j] = group(s, i + 1);
          i = j;
          math(g, upright, c === "_" ? "sub" : "sup");
        } else if (c === "{" || c === "}") {
          i++;
        } else {
          push(c === "-" ? MINUS : c, !upright && /[A-Za-zα-ω]/.test(c), shift);
          i++;
        }
      }
    }
    return runs;
  }
  function setMarkup(el, src) {
    el.replaceChildren(...parseMarkup(src).map((r) => {
      let node = document.createTextNode(r.text);
      if (r.italic) {
        const i = document.createElement("i");
        i.append(node);
        node = i;
      }
      if (r.shift) {
        const s = document.createElement(r.shift);
        s.append(node);
        node = s;
      }
      return node;
    }));
  }
  var SVG = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, parent) {
    const el = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    parent?.append(el);
    return el;
  }
  var toneColor = (tone) => /^[a-z][a-z0-9-]*$/.test(tone) ? `var(--${tone})` : tone;
  var words = (s) => (s ?? "").split(/\s+/).filter(Boolean);
  var MARGIN = { left: 76, right: 20, top: 52, bottom: 84 };
  var GAP = 56;
  var serial = 0;
  var reduced = () => typeof window === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CACHE2 = /* @__PURE__ */ new WeakMap();
  var PlotView = class {
    constructor(el) {
      this.spec = null;
      this.panels = [];
      this.tab = 0;
      this.u = 0;
      this.raf = 0;
      this.t0 = 0;
      this.W = 0;
      this.H = 0;
      this.uid = ++serial;
      this.tabButtons = [];
      this.boxes = /* @__PURE__ */ new Map();
      this.gated = [];
      this.emphasized = [];
      this.drawers = [];
      this.eventFrames = [];
      this.shown = /* @__PURE__ */ new Set();
      this.steps = /* @__PURE__ */ new Set();
      this.stepTab = null;
      this.el = el;
      CACHE2.set(el, this);
      for (const old of el.querySelectorAll(":scope > .plot-body, :scope > .plot-error")) old.remove();
      try {
        const id = el.dataset.plot ?? "";
        const block = id ? document.getElementById(id) : null;
        if (!block) throw new Error(`the JSON block with the id "${id}" is not found`);
        this.spec = parsePlot(block.textContent ?? "");
      } catch (error) {
        const message = `plot ${el.dataset.plot ?? ""}: ${error.message}`;
        const box = document.createElement("div");
        box.className = "plot-error";
        box.textContent = message;
        el.append(box);
        console.error(message);
        return;
      }
      const only = words(el.dataset.plotPanels);
      this.panels = only.length ? this.spec.panels.filter((p) => only.includes(p.id)) : this.spec.panels;
      const start2 = this.spec.tabs.findIndex((t) => t.name === el.dataset.plotTab);
      this.tab = Math.max(0, start2);
      this.build();
    }
    get plot() {
      return this.spec;
    }
    get frames() {
      return this.plot.tabs[this.tab].values.length;
    }
    build() {
      const plot = this.plot;
      this.body = document.createElement("div");
      this.body.className = "plot-body";
      if (plot.tabs.length > 1) {
        const bar = document.createElement("div");
        bar.className = "plot-tabs";
        bar.setAttribute("role", "tablist");
        this.tabButtons = plot.tabs.map((t, i) => {
          const b = document.createElement("button");
          b.type = "button";
          b.setAttribute("role", "tab");
          setMarkup(b, t.label);
          b.addEventListener("click", () => {
            b.blur();
            this.setTab(i);
          });
          bar.append(b);
          return b;
        });
        this.body.append(bar);
      }
      this.area = document.createElement("div");
      this.area.className = "plot-area";
      this.svgEl = svg("svg", { "aria-hidden": "true" });
      this.overlay = document.createElement("div");
      this.overlay.className = "plot-labels";
      this.area.append(this.svgEl, this.overlay);
      this.body.append(this.area);
      const controls = document.createElement("div");
      controls.className = "plot-bar";
      this.playButton = document.createElement("button");
      this.playButton.type = "button";
      this.playButton.className = "plot-play";
      this.playButton.addEventListener("click", () => {
        this.playButton.blur();
        if (this.raf) this.pause();
        else this.play();
      });
      this.scrub = document.createElement("div");
      this.scrub.className = "plot-scrub";
      this.scrub.setAttribute("data-prevent-swipe", "");
      this.fill = document.createElement("div");
      this.fill.className = "plot-fill";
      this.knob = document.createElement("div");
      this.knob.className = "plot-knob";
      this.ticks = document.createElement("div");
      this.ticks.className = "plot-ticks";
      this.scrub.append(this.ticks, this.fill, this.knob);
      const seek = (ev) => {
        const r = this.scrub.getBoundingClientRect();
        if (!r.width) return;
        this.u = clamp((ev.clientX - r.left) / r.width, 0, 1) * (this.frames - 1);
        this.draw();
      };
      this.scrub.addEventListener("pointerdown", (ev) => {
        this.pause();
        this.scrub.setPointerCapture(ev.pointerId);
        seek(ev);
      });
      this.scrub.addEventListener("pointermove", (ev) => {
        if (this.scrub.hasPointerCapture(ev.pointerId)) seek(ev);
      });
      const readout = document.createElement("div");
      readout.className = "plot-readout";
      if (plot.parameter.label) {
        const name = document.createElement("span");
        setMarkup(name, plot.parameter.label);
        readout.append(name, " = ");
      }
      this.value = document.createElement("span");
      this.value.className = "plot-value";
      readout.append(this.value);
      controls.append(this.playButton, this.scrub, readout);
      this.body.append(controls);
      this.el.append(this.body);
      this.setPlaying(false);
      this.markTabs();
    }
    setPlaying(on) {
      if (!this.spec) return;
      this.playButton.setAttribute("aria-label", on ? "Pause" : "Play");
      this.playButton.classList.toggle("playing", on);
    }
    markTabs() {
      this.tabButtons.forEach((b, i) => b.setAttribute("aria-selected", String(i === this.tab)));
    }
    /** Lays the panels out in the size of the element, which is measured in slide pixels. */
    fit() {
      if (!this.spec) return;
      const W = this.area.offsetWidth, H2 = this.area.offsetHeight;
      if (!W || !H2) return;
      if (W === this.W && H2 === this.H) return;
      this.W = W;
      this.H = H2;
      this.svgEl.setAttribute("viewBox", `0 0 ${W} ${H2}`);
      this.layout();
      this.drawStatic();
      this.buildMarks();
    }
    layout() {
      const n = this.panels.length, row = (this.plot.layout ?? (this.W >= this.H ? "row" : "column")) === "row";
      const cw = row ? (this.W - GAP * (n - 1)) / n : this.W, ch = row ? this.H : (this.H - GAP * (n - 1)) / n;
      this.boxes.clear();
      this.panels.forEach((p, i) => {
        const cx = row ? i * (cw + GAP) : 0, cy = row ? 0 : i * (ch + GAP);
        let x = cx + MARGIN.left, y = cy + MARGIN.top, w = cw - MARGIN.left - MARGIN.right, h = ch - MARGIN.top - MARGIN.bottom;
        const dx = p.x.range[1] - p.x.range[0], dy = p.y.range[1] - p.y.range[0];
        if (p.equal) {
          const s = Math.min(w / dx, h / dy);
          x += (w - s * dx) / 2;
          y += (h - s * dy) / 2;
          w = s * dx;
          h = s * dy;
        }
        this.boxes.set(p.id, { x, y, w, h, sx: w / dx, sy: h / dy, panel: p });
      });
    }
    X(b, x) {
      return b.x + (x - b.panel.x.range[0]) * b.sx;
    }
    Y(b, y) {
      return b.y + b.h - (y - b.panel.y.range[0]) * b.sy;
    }
    path(b, pts) {
      return pts.map(([x, y], i) => `${i ? "L" : "M"}${this.X(b, x).toFixed(1)} ${this.Y(b, y).toFixed(1)}`).join("");
    }
    label(text, left, top, a, cls, names, tone) {
      const el = document.createElement("div");
      el.className = `plot-label ${cls}`.trim();
      setMarkup(el, text);
      this.place(el, left, top, a);
      if (tone) el.style.color = toneColor(tone);
      this.overlay.append(el);
      this.gate(el, names);
      return el;
    }
    place(el, left, top, a) {
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.transform = `translate(${a === "start" ? 0 : a === "end" ? -100 : -50}%, -50%)`;
    }
    gate(node, names) {
      const n = names.filter((s) => !!s);
      if (n.length) this.gated.push({ node, names: n });
    }
    styleItem(node, it, names) {
      node.style.color = toneColor(it.tone);
      node.classList.add(...it.cls);
      this.gate(node, names);
      if (it.id) this.emphasized.push({ node, id: it.id });
    }
    drawStatic() {
      this.svgEl.replaceChildren();
      this.overlay.replaceChildren();
      this.gated = [];
      this.emphasized = [];
      const defs = svg("defs", {}, this.svgEl);
      for (const b of this.boxes.values()) {
        const p = b.panel;
        const g = svg("g", { class: "plot-panel" }, this.svgEl);
        this.gate(g, [p.id]);
        for (const [suffix, pad] of [["", 0], ["-marks", 14]]) {
          const clip = svg("clipPath", { id: `plot-${this.uid}-${p.id}${suffix}` }, defs);
          svg("rect", { x: b.x - pad, y: b.y - pad, width: b.w + 2 * pad, height: b.h + 2 * pad }, clip);
        }
        const statics = svg("g", { "clip-path": `url(#plot-${this.uid}-${p.id})` }, g);
        for (const r of p.regions) {
          const node = svg("path", { class: "plot-region", d: `${this.path(b, r.points)}Z`, "fill-opacity": r.opacity }, statics);
          this.styleItem(node, r, [p.id, r.id]);
        }
        for (const c of p.curves) {
          const attrs = { class: "plot-curve", "stroke-width": c.width };
          if (c.dash) attrs["stroke-dasharray"] = c.dash.join(" ");
          const node = c.circle ? svg("ellipse", { ...attrs, cx: this.X(b, c.circle[0]), cy: this.Y(b, c.circle[1]), rx: c.circle[2] * b.sx, ry: c.circle[2] * b.sy }, statics) : svg("path", { ...attrs, d: this.path(b, c.points ?? []) }, statics);
          this.styleItem(node, c, [p.id, c.id]);
        }
        if (p.axes) {
          const axes = svg("g", { class: "plot-axes" }, g);
          svg("path", { d: `M${b.x} ${b.y}V${b.y + b.h}H${b.x + b.w}` }, axes);
          for (const t of p.x.ticks) {
            const X = this.X(b, t);
            svg("path", { d: `M${X} ${b.y + b.h}v10` }, axes);
            this.label(formatNumber(t), X, b.y + b.h + 32, "middle", "plot-tick", [p.id]);
          }
          for (const t of p.y.ticks) {
            const Y = this.Y(b, t);
            svg("path", { d: `M${b.x} ${Y}h-10` }, axes);
            this.label(formatNumber(t), b.x - 18, Y, "end", "plot-tick", [p.id]);
          }
          if (p.x.title) this.label(p.x.title, b.x + b.w / 2, b.y + b.h + 70, "middle", "plot-title", [p.id]);
          if (p.y.title) this.label(p.y.title, b.x, b.y - 30, "middle", "plot-title", [p.id]);
        }
        if (p.title) this.label(p.title, b.x + b.w, b.y - 30, "end", "plot-title", [p.id]);
        for (const l of p.labels) {
          const node = this.label(l.text, this.X(b, l.at[0]) + l.dx, this.Y(b, l.at[1]) + l.dy, l.anchor, "", []);
          this.styleItem(node, l, [p.id, l.id]);
        }
        svg("g", { class: "plot-marks", "data-panel": p.id, "clip-path": `url(#plot-${this.uid}-${p.id}-marks)` }, g);
      }
    }
    // the nodes of the marks of the current tab, with one drawer per mark that sets them at a frame
    buildMarks() {
      for (const g of this.svgEl.querySelectorAll(".plot-marks")) g.replaceChildren();
      for (const old of this.overlay.querySelectorAll(".plot-mark")) old.remove();
      this.gated = this.gated.filter((e) => e.node.isConnected);
      this.drawers = [];
      this.eventFrames = [];
      const tab = this.plot.tabs[this.tab];
      for (const m of this.plot.marks) {
        const b = this.boxes.get(m.panel), data = tab.data[m.id];
        const g = this.svgEl.querySelector(`.plot-marks[data-panel="${m.panel}"]`);
        if (!b || !g || data === void 0) continue;
        const group = svg("g", {}, g);
        this.styleItem(group, m, [m.panel, m.id]);
        if (m.kind === "points") {
          const frames = data;
          const dots = [];
          this.drawers.push((u) => {
            const at = framesAt(frames, u);
            while (dots.length < at.length / 2) dots.push(svg("circle", { r: m.size / 2, class: m.hollow ? "plot-hollow" : "plot-dot", "stroke-width": m.width }, group));
            dots.forEach((d, k) => {
              const on = 2 * k < at.length;
              d.style.display = on ? "" : "none";
              if (on) {
                d.setAttribute("cx", this.X(b, at[2 * k]).toFixed(1));
                d.setAttribute("cy", this.Y(b, at[2 * k + 1]).toFixed(1));
              }
            });
          });
        } else if (m.kind === "trace") {
          const pts = data;
          svg("path", { class: "plot-ghost", d: this.path(b, pts), "stroke-width": m.width }, group);
          const done = svg("path", { class: "plot-trace", "stroke-width": m.width }, group);
          const head = svg("circle", { class: "plot-dot", r: m.size / 2 }, group);
          this.drawers.push((u) => {
            const p = traceTo(pts, u), [x, y] = p[p.length - 1];
            done.setAttribute("d", this.path(b, p));
            head.setAttribute("cx", this.X(b, x).toFixed(1));
            head.setAttribute("cy", this.Y(b, y).toFixed(1));
          });
        } else if (m.kind === "label") {
          const d = data;
          const el = this.label(d.text[0], 0, 0, m.anchor, "plot-mark", [m.panel, m.id], m.tone);
          el.classList.add(...m.cls);
          let shown = d.text[0];
          this.drawers.push((u) => {
            const [x, y] = d.at.length === 1 ? d.at[0] : framesAt(d.at, u);
            this.place(el, this.X(b, x) + m.dx, this.Y(b, y) + m.dy, m.anchor);
            const text = nearest(d.text, u);
            if (text !== shown) {
              setMarkup(el, text);
              shown = text;
            }
          });
        } else {
          const events = data;
          const nodes = events.map((e) => {
            const X = this.X(b, e.at[0]), Y = this.Y(b, e.at[1]);
            const ring = svg("circle", { class: "plot-ring", cx: X, cy: Y, r: m.size / 2, "stroke-width": m.width }, group);
            const text = e.text ? this.label(e.text, X + m.dx, Y + m.dy, m.anchor, "plot-mark", [m.panel, m.id], m.tone) : null;
            text?.classList.add(...m.cls);
            this.eventFrames.push({ frame: e.frame, names: [m.panel, m.id] });
            return { frame: e.frame, nodes: [ring, text].filter((n) => !!n) };
          });
          this.drawers.push((u) => {
            for (const e of nodes) for (const n of e.nodes) n.classList.toggle("plot-later", u < e.frame - 1e-6);
          });
        }
      }
      this.applyGates();
      this.draw();
    }
    draw() {
      if (!this.spec || !this.W) return;
      const tab = this.plot.tabs[this.tab], u = this.u, n = this.frames;
      for (const d of this.drawers) d(u);
      this.value.textContent = formatNumber(valueAt(tab.values, u), this.plot.parameter.digits);
      const at = `${(n > 1 ? u / (n - 1) : 0) * 100}%`;
      this.fill.style.width = at;
      this.knob.style.left = at;
      if (tab.active) {
        const on = nearest(tab.active, u), all = new Set(tab.active.flat());
        for (const { node, id } of this.emphasized) {
          node.classList.toggle("plot-on", on.includes(id));
          node.classList.toggle("plot-off", all.has(id) && !on.includes(id));
        }
      } else for (const { node } of this.emphasized) node.classList.remove("plot-on", "plot-off");
    }
    hidden(names) {
      return names.some((s) => this.steps.has(s) && !this.shown.has(s));
    }
    applyGates() {
      for (const { node, names } of this.gated) node.classList.toggle("plot-hidden", this.hidden(names));
      const n = this.frames;
      this.ticks.replaceChildren(...this.eventFrames.filter((e) => !this.hidden(e.names)).map((e) => {
        const t = document.createElement("div");
        t.className = "plot-tick-mark";
        t.style.left = `${(n > 1 ? e.frame / (n - 1) : 0) * 100}%`;
        return t;
      }));
    }
    /** Reads the fragments of the slide: the names of data-plot-show, and the tab of the last visible data-plot-tab. */
    syncSteps() {
      if (!this.spec) return;
      const slide = this.el.closest("section");
      const frags = slide ? [...slide.querySelectorAll(".fragment")] : [];
      this.steps = new Set(frags.flatMap((f) => words(f.dataset.plotShow)));
      const visible = frags.filter((f) => f.classList.contains("visible"));
      this.shown = new Set(visible.flatMap((f) => words(f.dataset.plotShow)));
      const tabbed = visible.filter((f) => f.dataset.plotTab).sort((a, b) => +(a.dataset.fragmentIndex ?? 0) - +(b.dataset.fragmentIndex ?? 0));
      const name = tabbed.at(-1)?.dataset.plotTab ?? this.el.dataset.plotTab ?? null;
      if (name !== this.stepTab) {
        this.stepTab = name;
        const i = this.plot.tabs.findIndex((t) => t.name === name);
        if (i >= 0 && i !== this.tab) {
          this.setTab(i);
          return;
        }
      }
      this.applyGates();
    }
    /** Shows the tab i, from its first frame while the plot is played, and at its still frame otherwise. */
    setTab(i) {
      if (!this.spec || i === this.tab) return;
      this.tab = i;
      this.markTabs();
      this.u = this.raf ? 0 : this.stillFrame();
      this.t0 = performance.now();
      if (this.W) this.buildMarks();
    }
    /** The frame of a still, from data-plot-frame, where a negative frame is counted from the end. The default is the last frame. */
    stillFrame() {
      const f = Number(this.el.dataset.plotFrame ?? -1), n = this.frames;
      return clamp(Number.isFinite(f) ? f < 0 ? n + f : f : n - 1, 0, n - 1);
    }
    /** Draws the still frame, without the animation. */
    still() {
      if (!this.spec) return;
      this.pause();
      this.u = this.stillFrame();
      this.draw();
    }
    /** Starts the loop from the first frame, unless data-plot-paused is set or the motion is reduced. */
    start() {
      if (!this.spec) return;
      if (this.el.hasAttribute("data-plot-paused") || reduced()) {
        this.still();
        return;
      }
      this.u = 0;
      this.play();
    }
    play() {
      if (!this.spec || this.raf) return;
      const { duration } = this.plot, n = this.frames;
      if (this.u >= n - 1) this.u = 0;
      this.t0 = performance.now() - (n > 1 ? this.u / (n - 1) : 0) * duration * 1e3;
      const tick = (now) => {
        this.u = loopFrame((now - this.t0) / 1e3, this.frames, this.plot.duration, this.plot.hold);
        this.draw();
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
      this.setPlaying(true);
    }
    pause() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.setPlaying(false);
    }
    get playing() {
      return this.raf !== 0;
    }
    /** The fractional frame shown. */
    get frame() {
      return this.u;
    }
  };
  function mountPlots(root2) {
    return [...root2.querySelectorAll(".plot")].map((el) => CACHE2.get(el) ?? new PlotView(el));
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
  function resolve(steps, current) {
    const indices = [...new Set(steps.map((s) => s.index))].sort((a, b) => a - b);
    const lit = /* @__PURE__ */ new Map();
    const order = steps.map((_, i) => i).sort((a, b) => steps[a].index - steps[b].index);
    for (const i of order) if (steps[i].visible) for (const name of steps[i].highlight) lit.set(name, steps[i].tone);
    const named = new Set(steps.filter((s) => s.visible && s.index === current).flatMap((s) => s.highlight));
    const held = steps.map((s) => {
      if (!s.visible || s.index === current) return false;
      const through = s.keep === "next" ? indices.find((k) => k > s.index) ?? s.index : s.keep;
      if (through !== null && current <= through) return true;
      return s.holds.some((name) => named.has(name));
    });
    return { held, lit };
  }
  var words2 = (s) => (s ?? "").split(/\s+/).filter(Boolean);
  function applySteps(slide) {
    const frags = [...slide.querySelectorAll(".fragment")];
    const names = [...new Set(frags.flatMap((f) => words2(f.dataset.highlight)))];
    if (!names.length && !frags.some((f) => f.hasAttribute("data-keep"))) return;
    const select = (name) => `.${CSS.escape(name)}`;
    const steps = frags.map((f) => {
      const keep = f.getAttribute("data-keep");
      return {
        index: Number(f.dataset.fragmentIndex ?? 0),
        visible: f.classList.contains("visible"),
        keep: keep === null ? null : keep.trim() === "" ? "next" : Number(keep),
        highlight: words2(f.dataset.highlight),
        tone: f.dataset.tone === "violet" ? "violet" : "accent",
        holds: names.filter((name) => f.matches(select(name)) || f.querySelector(select(name)))
      };
    });
    const current = Math.max(-1, ...steps.filter((s) => s.visible).map((s) => s.index));
    const { held, lit } = resolve(steps, current);
    frags.forEach((f, i) => f.toggleAttribute("data-held", held[i]));
    const tones = /* @__PURE__ */ new Map();
    for (const name of names) for (const el of slide.querySelectorAll(select(name))) tones.set(el, lit.get(name) ?? tones.get(el));
    for (const [el, tone] of tones) {
      el.classList.add("hl-target");
      el.classList.toggle("hl-accent", tone === "accent");
      el.classList.toggle("hl-violet", tone === "violet");
    }
  }
  function applyAll(root2) {
    for (const slide of root2.querySelectorAll(".reveal .slides section")) applySteps(slide);
  }
  var typeset = () => window.MathJax?.startup?.promise ?? Promise.resolve();
  function initSteps(deck) {
    const mark = () => {
      const slide = deck.getCurrentSlide();
      if (!slide) return;
      slide.toggleAttribute("data-complete", !deck.availableFragments().next);
      applySteps(slide);
    };
    for (const type of ["fragmentshown", "fragmenthidden", "slidechanged"]) deck.on(type, mark);
    mark();
    void typeset().then(mark);
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
  var plots = [];
  var still = () => Orbits.reduced() || window.Reveal.isPrintView() || /print-pdf/.test(location.search);
  function remount() {
    for (const o of mount(document)) if (!backdrops.includes(o)) backdrops.push(o);
    for (const p of mountPlots(document)) if (!plots.includes(p)) plots.push(p);
  }
  var within = (slide) => slide ? backdrops.filter((o) => slide.contains(o.el)) : [];
  var plotsIn = (slide) => slide ? plots.filter((p) => slide.contains(p.el)) : [];
  function stepPlots(slide) {
    const own = plotsIn(slide);
    for (const p of own) {
      p.fit();
      p.syncSteps();
    }
    if (own.length) applySteps(slide);
  }
  function show(slide) {
    stepPlots(slide);
    for (const p of plotsIn(slide)) if (still()) p.still();
    else p.start();
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
    for (const p of plots) {
      p.fit();
      p.syncSteps();
      p.still();
    }
    applyAll(document);
  }
  async function start(options = {}) {
    const deck = window.Reveal;
    const plugins = [...options.plugins ?? []];
    if (window.RevealNotes && !plugins.includes(window.RevealNotes)) plugins.push(window.RevealNotes);
    initSwitcher();
    deck.on("pdf-ready", () => {
      completeAll();
      void typeset().then(() => applyAll(document));
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
      for (const p of plotsIn(ev.previousSlide)) if (!ev.currentSlide.contains(p.el)) p.pause();
      show(ev.currentSlide);
    });
    for (const type of ["fragmentshown", "fragmenthidden"]) deck.on(type, () => stepPlots(deck.getCurrentSlide()));
    deck.on("resize", () => {
      for (const o of backdrops) o.fit();
      stepPlots(deck.getCurrentSlide());
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
    plots,
    version: "1.0.0"
  };
  window.Beeson = Beeson;
})();
