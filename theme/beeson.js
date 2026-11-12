/*! beeson.js 0.9.0-beta.1, the reveal.js theme of the Beeson group. MIT license. The orbit engine is ported from src/lib/orbits.ts of https://github.com/ClouD-161803/ClouD-161803.github.io (MIT). */
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
  function unstable(orbit, T) {
    const e = 1e-7;
    let offset = new Float64Array(6);
    offset[0] = 1;
    const states = [], dirs = [];
    for (let lap = 0; lap < 3; lap++) {
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
        if (lap === 2) {
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
  var SCENES = {
    nest: () => [...lyapunovFamily(1, spaced(0.012, 0.12, 12, 1.5), H), ...lyapunovFamily(2, spaced(0.012, 0.14, 12, 1.5), H), ...droFamily(ramp(0.03, 0.09, 1.2), H)].map(closed),
    tubes: () => [...tubes(1, 0.0313, 14, 2.2), ...tubes(2, 0.0408, 14, 2.2)],
    wideRibbon: () => ribbon(0.016, 120, 3, 0.12)
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

  // src/strands.ts
  var FILL = 0.93;
  var MARGIN = 40;
  var INK_ALPHA = 0.6;
  var isPair = (p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
  var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
  var isColorString = (v) => typeof v === "string" && v.trim() !== "";
  var isColor = (v) => isColorString(v) || Array.isArray(v) && v.length === 2 && v.every(isColorString);
  var TONES = ["orange", "violet", "text"];
  function parse(data) {
    const records = isObject(data) ? data.families : void 0;
    if (!Array.isArray(records)) throw new Error('it does not have a list "families"');
    records.forEach((r, i) => {
      if (!isObject(r) || !Array.isArray(r.points) || r.points.length < 2 || !r.points.every(isPair)) {
        throw new Error(`its record ${i} does not have a list "points" of at least two [x, y] pairs`);
      }
      for (const key of ["t", "theta"]) {
        const clock = r[key];
        if (clock !== void 0 && (!Array.isArray(clock) || clock.length !== r.points.length || !clock.every(Number.isFinite))) {
          throw new Error(`the list "${key}" of its record ${i} does not have one number per point`);
        }
      }
      if (r.tone !== void 0 && !TONES.includes(r.tone)) {
        throw new Error(`the "tone" of its record ${i} is not orange, violet, or text`);
      }
      if (r.color !== void 0 && !isColor(r.color)) {
        throw new Error(`the "color" of its record ${i} is not a CSS color or a pair of them for the dark and the light mode`);
      }
      if (r.alpha !== void 0 && !(typeof r.alpha === "number" && r.alpha > 0 && r.alpha <= 1)) {
        throw new Error(`the "alpha" of its record ${i} is not a number above 0 and up to 1`);
      }
      for (const key of ["weight", "head", "start", "fade"]) {
        const v = r[key];
        if (v !== void 0 && !(typeof v === "number" && Number.isFinite(v) && v >= 0)) {
          throw new Error(`the "${key}" of its record ${i} is not a number of zero or more`);
        }
      }
      if (r.glow !== void 0 && typeof r.glow !== "boolean") {
        throw new Error(`the "glow" of its record ${i} is not true or false`);
      }
    });
    const bodies = isObject(data) && Array.isArray(data.bodies) ? data.bodies.filter(isObject) : [];
    return { families: records, bodies };
  }
  var TERM = /^\s*([^=<>\s]+)\s*(<=|>=|=|<|>)\s*(.*?)\s*$/;
  function select(records, spec) {
    if (!spec?.trim()) return records;
    const groups = spec.split(";").map(group);
    return records.filter((r) => groups.some((tests) => tests.every((test) => test(r))));
  }
  function group(spec) {
    return spec.split(",").map((term) => {
      const m = TERM.exec(term);
      if (!m || m[3] === "") throw new Error(`"${term.trim()}" is not a term key=value, key<number, or key>number`);
      const [, key, op, value] = m;
      if (op === "=") {
        const values = value.split("|").map((v2) => v2.trim());
        return (r) => values.includes(String(r[key]));
      }
      const v = Number(value);
      if (!Number.isFinite(v)) throw new Error(`"${value}" in "${term.trim()}" is not a number`);
      return (r) => {
        const x = r[key];
        if (typeof x !== "number") return false;
        return op === "<" ? x < v : op === "<=" ? x <= v : op === ">" ? x > v : x >= v;
      };
    });
  }
  function strandsOf(file, chosen, color, ramp2, shade, map) {
    if (map) shade = void 0;
    const along = shade ?? ramp2;
    const order = color ? [...new Set(file.families.map((r) => String(r[color])))] : [];
    const pairOf = (r) => color ? order.indexOf(String(r[color])) : 0;
    const range = /* @__PURE__ */ new Map();
    if (along) {
      for (const r of chosen) {
        const v = r[along];
        if (typeof v !== "number") continue;
        const [lo, hi] = range.get(pairOf(r)) ?? [v, v];
        range.set(pairOf(r), [Math.min(lo, v), Math.max(hi, v)]);
      }
    }
    return chosen.map((r) => {
      const n = r.points.length, pts = new Float64Array(2 * n), times = new Float32Array(n);
      const clock = r.t ?? r.theta;
      let length = 0;
      for (let i = 0; i < n; i++) {
        pts[2 * i] = r.points[i][0];
        pts[2 * i + 1] = r.points[i][1];
        if (i > 0 && !clock) length += Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]);
        times[i] = (clock ? clock[i] - clock[0] : length) + (r.start ?? 0);
      }
      const strand = { pts, times, T: times[n - 1] };
      if (r.craft === true) strand.craft = true;
      if (color || along || map) {
        const pair2 = pairOf(r), [lo, hi] = range.get(pair2) ?? [0, 0], v = along ? r[along] : void 0;
        strand.ink = { pair: pair2, at: typeof v === "number" && hi > lo ? (v - lo) / (hi - lo) : 0 };
        if (shade) strand.ink.shade = true;
        if (map) strand.ink.map = map;
        strand.alpha = map ? MAP_ALPHA : INK_ALPHA;
      }
      if (r.tone) strand.tone = r.tone;
      if (r.color !== void 0) strand.color = r.color;
      if (r.alpha !== void 0) strand.alpha = r.alpha;
      if (r.weight !== void 0) strand.weight = r.weight;
      if (r.head !== void 0) strand.head = r.head;
      if (r.fade !== void 0) strand.fade = r.fade;
      if (r.glow) strand.glow = true;
      return strand;
    });
  }
  var SAME = 1e-4;
  function bodiesOf(file, chosen) {
    const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) > SAME;
    let first = null;
    for (const r of chosen) {
      const own = /* @__PURE__ */ new Map();
      for (const body of file.bodies) {
        const keys = Object.entries(body).filter(([, v]) => ["number", "string", "boolean"].includes(typeof v));
        if (!keys.every(([k, v]) => !(k in r) || r[k] === v)) continue;
        const at = r.frame === void 0 ? body : body[String(r.frame)];
        if (!isObject(at)) continue;
        const mu = typeof body.mu === "number" ? body.mu : typeof r.mu === "number" ? r.mu : void 0;
        for (const [name, p] of Object.entries(at)) {
          if (!isPair(p)) continue;
          const dot2 = { x: p[0], y: p[1], mass: mu === void 0 ? void 0 : name === "m1" ? 1 - mu : name === "m2" ? mu : void 0 };
          const was = own.get(name);
          if (was && apart(was, dot2)) return [];
          own.set(name, dot2);
        }
      }
      const seen = first ?? own;
      if (own.size !== seen.size || [...own].some(([name, d]) => !seen.has(name) || apart(seen.get(name), d))) return [];
      first = seen;
    }
    return first ? [...first.values()] : [];
  }
  function fitView(strands, box2, slide) {
    const xs = [], ys = [], ws = [];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const s of strands) {
      const p = s.pts, n = p.length / 2;
      let length = 0;
      for (let i = 1; i < n; i++) length += Math.hypot(p[2 * i] - p[2 * i - 2], p[2 * i + 1] - p[2 * i - 1]);
      for (let i = 0; i < n; i++) {
        x0 = Math.min(x0, p[2 * i]);
        x1 = Math.max(x1, p[2 * i]);
        y0 = Math.min(y0, p[2 * i + 1]);
        y1 = Math.max(y1, p[2 * i + 1]);
      }
      for (let i = 1; i < n; i++) {
        const d = Math.hypot(p[2 * i] - p[2 * i - 2], p[2 * i + 1] - p[2 * i - 1]);
        xs.push((p[2 * i] + p[2 * i - 2]) / 2);
        ys.push((p[2 * i + 1] + p[2 * i - 1]) / 2);
        ws.push(length > 0 ? d / length : 1 / (n - 1));
      }
    }
    if (!ws.length || !(box2.width > 0) || !(box2.height > 0)) return null;
    const total = ws.reduce((a2, b2) => a2 + b2, 0);
    const quantile = (v, q) => {
      const order = v.map((_, i) => i).sort((a2, b2) => v[a2] - v[b2]);
      let held2 = 0;
      for (const i of order) {
        held2 += ws[i];
        if (held2 >= q * total) return v[i];
      }
      return v[order[order.length - 1]];
    };
    const lo = (1 - FILL) / 2, hi = 1 - lo;
    const qx = [quantile(xs, lo), quantile(xs, hi)], qy = [quantile(ys, lo), quantile(ys, hi)];
    let cx = (qx[0] + qx[1]) / 2, cy = (qy[0] + qy[1]) / 2;
    const aspect = box2.width / box2.height;
    const held = (half2) => {
      let k = 0;
      for (let i = 0; i < ws.length; i++)
        if (Math.abs(xs[i] - cx) <= half2 * aspect && Math.abs(ys[i] - cy) <= half2) k += ws[i];
      return k / total;
    };
    let a = 0, b = Math.max(Math.max(cx - x0, x1 - cx) / aspect, Math.max(cy - y0, y1 - cy), 1e-9);
    for (let i = 0; i < 50; i++) {
      const m2 = (a + b) / 2;
      if (held(m2) >= FILL) b = m2;
      else a = m2;
    }
    let half = b;
    const inner = {
      left: box2.left > 0.5,
      right: box2.left + box2.width < slide.width - 0.5,
      top: box2.top > 0.5,
      bottom: box2.top + box2.height < slide.height - 0.5
    };
    const g = 2 * MARGIN / box2.height;
    const need = (span, sides, width) => span / Math.max(width - sides * g, 1e-9);
    half = Math.max(
      half,
      need((inner.right ? x1 : qx[1]) - (inner.left ? x0 : qx[0]), +inner.left + +inner.right, 2 * aspect),
      need((inner.top ? y1 : qy[1]) - (inner.bottom ? y0 : qy[0]), +inner.top + +inner.bottom, 2)
    );
    const m = half * g, w = half * aspect;
    const clamp3 = (v, low, high) => Math.min(Math.max(v, low), high);
    cx = clamp3(cx, inner.right ? x1 + m - w : -Infinity, inner.left ? x0 - m + w : Infinity);
    cy = clamp3(cy, inner.top ? y1 + m - half : -Infinity, inner.bottom ? y0 - m + half : Infinity);
    return { cx, cy, half };
  }
  function mix(from, to, at) {
    const a = rgbOf(from), b = rgbOf(to);
    if (!a || !b) return null;
    const [L1, C1, h1] = lch(a), [L2, C2, h2] = lch(b);
    let dh = h2 - h1;
    if (dh > Math.PI) dh -= 2 * Math.PI;
    if (dh < -Math.PI) dh += 2 * Math.PI;
    const L = L1 + (L2 - L1) * at, C = C1 + (C2 - C1) * at, h = h1 + dh * at;
    return hex(rgbFromLab([L, C * Math.cos(h), C * Math.sin(h)]));
  }
  var SHADES = 0.16;
  var CONTRAST = 2.5;
  function contrastOver(c, bg, alpha = INK_ALPHA) {
    const luminance = ([R, G, B]) => 0.2126 * linear(R) + 0.7152 * linear(G) + 0.0722 * linear(B);
    const a = luminance(c.map((v, i) => alpha * v + (1 - alpha) * bg[i])), b = luminance(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }
  function shadeOf(color, at, bg) {
    const c = rgbOf(color);
    if (!c) return null;
    const [L, C, h] = lch(c);
    const shade = (l) => hex(rgbFromLab([l, C * Math.cos(h), C * Math.sin(h)]));
    let light = Math.min(0.95, L + SHADES), dark = Math.max(0.2, L - SHADES);
    const back = bg ? rgbOf(bg) : null;
    if (back) {
      const below = lch(back)[0] < L, near = below ? dark : light, far = below ? 0.95 : 0.2;
      const keeps = (l) => contrastOver(rgbOf(shade(l)), back) >= CONTRAST;
      if (!keeps(near) && keeps(far)) {
        let a = near, b = far;
        for (let i = 0; i < 30; i++) {
          const m = (a + b) / 2;
          if (keeps(m)) b = m;
          else a = m;
        }
        if (below) [dark, light] = [b, Math.min(0.95, light + b - near)];
        else [light, dark] = [b, Math.max(0.2, dark + b - near)];
      }
    }
    return shade(light + (dark - light) * at);
  }
  var COLORMAPS = {
    viridis: {
      stops: ["#440154", "#48186a", "#472d7b", "#424086", "#3b528b", "#33638d", "#2c728e", "#26818e", "#21908c", "#1f9f88", "#28ae80", "#3ebc74", "#5dc963", "#82d34c", "#abdc32", "#d5e21a", "#fde725"],
      ends: [0, 0.85]
    },
    plasma: {
      stops: ["#0d0887", "#310596", "#4c02a1", "#6600a7", "#7e03a8", "#9511a2", "#a92396", "#bb3587", "#cb4778", "#d9596a", "#e66c5c", "#f07f4f", "#f89441", "#fdab33", "#fdc328", "#f9dd25", "#f0f921"],
      ends: [0, 0.85]
    },
    Blues_r: {
      stops: ["#08306b", "#084084", "#08519c", "#1461a9", "#2171b5", "#3282be", "#4292c6", "#56a0ce", "#6baed6", "#84bcdb", "#9ecae1", "#b2d2e8", "#c6dbef", "#d2e3f3", "#deebf7", "#eaf3fb", "#f7fbff"],
      ends: [0, 0.683]
    }
  };
  var MAP_CONTRAST = 3;
  var MAP_ALPHA = 1;
  function colormapOf(spec) {
    const [name, ...ends] = spec.trim().split(/\s+/);
    if (!Object.prototype.hasOwnProperty.call(COLORMAPS, name)) throw new Error(`"${name}" is not viridis, plasma, or Blues_r`);
    const map = COLORMAPS[name];
    if (!ends.length) return { name, lo: map.ends[0], hi: map.ends[1] };
    const [lo, hi] = ends.map(Number);
    if (ends.length !== 2 || !(lo >= 0 && lo < hi && hi <= 1)) {
      throw new Error(`"${ends.join(" ")}" is not a lower and an upper end with 0 <= lower < upper <= 1`);
    }
    return { name, lo, hi };
  }
  function colormapAt(name, x) {
    const stops = COLORMAPS[name].stops, n = stops.length - 1;
    const u = Math.min(Math.max(x, 0), 1) * n, k = Math.min(Math.floor(u), n - 1);
    const a = rgbOf(stops[k]), b = rgbOf(stops[k + 1]);
    return hex(a.map((v, i) => v + (b[i] - v) * (u - k)));
  }
  function colormapEnds(map, bg) {
    const back = bg ? rgbOf(bg) : null;
    if (!back) return [map.lo, map.hi];
    const keeps = (x) => contrastOver(rgbOf(colormapAt(map.name, x)), back, 1) >= MAP_CONTRAST;
    const round = (x) => Math.round(x * 1e9) / 1e9;
    let lo = map.lo, hi = map.hi;
    for (let k = 1; !keeps(lo) && lo < hi; k++) lo = round(map.lo + k / 100);
    for (let k = 1; !keeps(hi) && hi > lo; k++) hi = round(map.hi - k / 100);
    return [Math.min(lo, hi), hi];
  }
  function colormapColor(map, at, bg) {
    const [lo, hi] = colormapEnds(map, bg);
    return colormapAt(map.name, lo + (hi - lo) * at);
  }
  function rgbOf(color) {
    const c = color.trim();
    let m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
    if (m) return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
    m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
    if (m) return [parseInt(m[1], 16) / 15, parseInt(m[2], 16) / 15, parseInt(m[3], 16) / 15];
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(c);
    if (m) return [+m[1] / 255, +m[2] / 255, +m[3] / 255];
    return null;
  }
  var linear = (c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  var gamma = (c) => c <= 31308e-7 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  function lch([R, G, B]) {
    const r = linear(R), g = linear(G), b = linear(B);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [L, Math.hypot(A, Bb), Math.atan2(Bb, A)];
  }
  function rgbFromLab([L, A, B]) {
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    return [
      gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
    ];
  }
  var hex = (c) => `#${c.map(
    (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")
  ).join("")}`;
  var given = /* @__PURE__ */ new Map();
  var files = /* @__PURE__ */ new Map();
  function register(data) {
    const script2 = document.currentScript;
    if (script2 instanceof HTMLScriptElement && script2.src) given.set(script2.src, data);
  }
  function read(url, path) {
    if (!/\.js$/i.test(new URL(url).pathname)) {
      if (location.protocol === "file:") {
        return Promise.reject(
          new Error(
            `a JSON file cannot be read in a deck opened from the disk. Wrap it in Beeson.strands( and ); and name the .js file in data-strands`
          )
        );
      }
      return fetch(url).then((r) => {
        if (!r.ok) throw new Error(`it was answered with HTTP ${r.status}`);
        return r.json();
      });
    }
    if (given.has(url)) return Promise.resolve(given.get(url));
    return new Promise((done, fail2) => {
      const script2 = document.createElement("script");
      script2.src = url;
      script2.onload = () => given.has(url) ? done(given.get(url)) : fail2(new Error(`${path} does not call Beeson.strands`));
      script2.onerror = () => fail2(new Error("it was not found"));
      document.head.append(script2);
    });
  }
  function load(path) {
    const url = new URL(path, document.baseURI).href;
    let out = files.get(url);
    if (!out) {
      out = read(url, path).then(parse).catch((error) => {
        console.warn(`beeson: the backdrop file ${path} is not drawn, since ${error.message}`);
        return null;
      });
      files.set(url, out);
    }
    return out;
  }
  function colormapFor(el) {
    const spec = el.dataset.strandsColormap;
    if (!spec?.trim()) return void 0;
    let map;
    try {
      map = colormapOf(spec);
    } catch (error) {
      console.warn(`beeson: data-strands-colormap="${spec}" is not used, since ${error.message}. The strands are colored from the palette`);
      return void 0;
    }
    if (el.dataset.strandsShade)
      console.warn(`beeson: data-strands-shade="${el.dataset.strandsShade}" is ignored, since data-strands-colormap is given`);
    return map;
  }
  async function strandsFor(el) {
    const path = el.dataset.strands ?? "";
    const file = await load(path);
    if (!file) return { strands: [], dots: [] };
    try {
      const chosen = select(file.families, el.dataset.strandsSelect);
      if (!chosen.length)
        console.warn(`beeson: data-strands-select="${el.dataset.strandsSelect}" does not match a record of ${path}`);
      return {
        strands: strandsOf(
          file,
          chosen,
          el.dataset.strandsColor || void 0,
          el.dataset.strandsRamp || void 0,
          el.dataset.strandsShade || void 0,
          colormapFor(el)
        ),
        dots: bodiesOf(file, chosen)
      };
    } catch (error) {
      console.warn(`beeson: the backdrop of ${path} is not drawn, since ${error.message}`);
      return { strands: [], dots: [] };
    }
  }

  // src/orbits.ts
  var FADE_BANDS = 12;
  var alphaOf = (s) => s.alpha ?? (s.tone === "orange" || s.tone === "violet" ? 0.42 : s.tone === "text" ? 0.8 : s.tone === "line" ? 0.36 : 1);
  var widthOf = (s) => (s.tone === "hero" ? 2.2 : s.tone === "text" ? 1.3 : 1) * (s.weight ?? 1);
  var colorOf = (s) => s.color ? `color ${JSON.stringify(s.color)}` : s.ink ? `ink ${JSON.stringify(s.ink)}` : s.tone === "orange" || s.tone === "hero" ? "accent" : s.tone === "violet" ? "violet" : s.tone === "text" || s.tone === "line" ? "text" : "stroke";
  function bandsOf(s) {
    const n = s.times.length, fadeAt = s.times[0] + (s.fade ?? Infinity), span = s.T - fadeAt;
    if (!(span > 0)) return null;
    const out = new Uint32Array(FADE_BANDS);
    let a = 0;
    while (a < n - 1 && s.times[a + 1] <= fadeAt) a++;
    out[0] = a;
    for (let b = 1; b < FADE_BANDS; b++) {
      const until = fadeAt + b * span / FADE_BANDS;
      while (a < n - 1 && s.times[a + 1] <= until) a++;
      out[b] = a;
    }
    return out;
  }
  var MU = 0.01215;
  var NEAR = 0.15;
  var DURATION = 12;
  var LOOP = 9;
  var HEADS = { full: 2.2, small: 0.55, none: 0 };
  var PALETTE = 8;
  var TOLERANCE = 0.1;
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
  var curved = (ctl, j) => ctl !== null && !Number.isNaN(ctl[4 * j]);
  function pathOf(px, tolerance = TOLERANCE) {
    const n = px.length / 2;
    const closed2 = n > 3 && Math.hypot(px[0] - px[2 * n - 2], px[1] - px[2 * n - 1]) < 0.5;
    const mark = new Uint8Array(n);
    mark[0] = mark[n - 1] = 1;
    let ctl = null;
    for (let j = 0; j < n - 1; j++) {
      const x1 = px[2 * j], y1 = px[2 * j + 1], x2 = px[2 * j + 2], y2 = px[2 * j + 3];
      let x0 = 2 * x1 - x2, y0 = 2 * y1 - y2, x3 = 2 * x2 - x1, y3 = 2 * y2 - y1;
      if (j > 0) {
        x0 = px[2 * j - 2];
        y0 = px[2 * j - 1];
      } else if (closed2) {
        x0 = px[2 * n - 4];
        y0 = px[2 * n - 3];
      }
      if (j < n - 2) {
        x3 = px[2 * j + 4];
        y3 = px[2 * j + 5];
      } else if (closed2) {
        x3 = px[2];
        y3 = px[3];
      }
      const d1 = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2), d2 = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2), d3 = Math.sqrt((x3 - x2) ** 2 + (y3 - y2) ** 2);
      if (!(d1 > 1e-6 && d2 > 1e-6 && d3 > 1e-6)) continue;
      const s1 = Math.sqrt(d1), s2 = Math.sqrt(d2), s3 = Math.sqrt(d3);
      const a = 2 * d1 + 3 * s1 * s2 + d2, b = 3 * s1 * (s1 + s2);
      const e = 2 * d3 + 3 * s3 * s2 + d2, g = 3 * s3 * (s3 + s2);
      const c1x = (d1 * x2 - d2 * x0 + a * x1) / b, c1y = (d1 * y2 - d2 * y0 + a * y1) / b;
      const c2x = (d3 * x1 - d2 * x3 + e * x2) / g, c2y = (d3 * y1 - d2 * y3 + e * y2) / g;
      const off = Math.max(Math.abs((c1x - x1) * (y2 - y1) - (c1y - y1) * (x2 - x1)), Math.abs((c2x - x1) * (y2 - y1) - (c2y - y1) * (x2 - x1))) / d2;
      if (0.75 * off <= tolerance) continue;
      if (!ctl) ctl = new Float32Array(4 * (n - 1)).fill(NaN);
      ctl.set([c1x, c1y, c2x, c2y], 4 * j);
      mark[j] = mark[j + 1] = 1;
    }
    const stack = [];
    for (let a = 0, b = 1; b < n; b++) {
      if (!mark[b]) continue;
      if (b > a + 1) stack.push(a, b);
      a = b;
    }
    const t2 = tolerance * tolerance;
    while (stack.length) {
      const b = stack.pop(), a = stack.pop();
      const ax = px[2 * a], ay = px[2 * a + 1], dx = px[2 * b] - ax, dy = px[2 * b + 1] - ay, L = dx * dx + dy * dy;
      let worst = t2, at = -1;
      for (let k = a + 1; k < b; k++) {
        const qx = px[2 * k] - ax, qy = px[2 * k + 1] - ay;
        const u = L > 0 ? Math.min(1, Math.max(0, (qx * dx + qy * dy) / L)) : 0;
        const d = (qx - u * dx) ** 2 + (qy - u * dy) ** 2;
        if (d > worst) {
          worst = d;
          at = k;
        }
      }
      if (at < 0) continue;
      mark[at] = 1;
      if (at > a + 1) stack.push(a, at);
      if (b > at + 1) stack.push(at, b);
    }
    let count = 0;
    for (let k = 0; k < n; k++) count += mark[k];
    const keep = new Uint32Array(count);
    for (let k = 0, m = 0; k < n; k++) if (mark[k]) keep[m++] = k;
    return { px, keep, ctl };
  }
  function pointOn(path, j, f) {
    const p = path.px, n = p.length / 2;
    if (j >= n - 1) return [p[2 * n - 2], p[2 * n - 1]];
    const x1 = p[2 * j], y1 = p[2 * j + 1], x2 = p[2 * j + 2], y2 = p[2 * j + 3];
    if (!curved(path.ctl, j)) return [x1 + f * (x2 - x1), y1 + f * (y2 - y1)];
    const c = path.ctl, k = 4 * j, g = 1 - f;
    const w0 = g * g * g, w1 = 3 * g * g * f, w2 = 3 * g * f * f, w3 = f * f * f;
    return [w0 * x1 + w1 * c[k] + w2 * c[k + 2] + w3 * x2, w0 * y1 + w1 * c[k + 1] + w2 * c[k + 3] + w3 * y2];
  }
  function trace(pen, path, j, f, from = 0) {
    const { px: p, keep, ctl } = path, n = p.length / 2;
    pen.moveTo(p[2 * from], p[2 * from + 1]);
    let last = from, lo = 0, hi = keep.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (keep[mid] <= from) lo = mid + 1;
      else hi = mid;
    }
    for (let k = lo; k < keep.length && keep[k] <= j; k++) {
      const v = keep[k];
      if (v === last + 1 && curved(ctl, last)) pen.bezierCurveTo(ctl[4 * last], ctl[4 * last + 1], ctl[4 * last + 2], ctl[4 * last + 3], p[2 * v], p[2 * v + 1]);
      else pen.lineTo(p[2 * v], p[2 * v + 1]);
      last = v;
    }
    if (j >= n - 1 || !(f > 0)) return;
    if (last === j && curved(ctl, j)) {
      const x1 = p[2 * j], y1 = p[2 * j + 1], k = 4 * j;
      const ax = x1 + f * (ctl[k] - x1), ay = y1 + f * (ctl[k + 1] - y1);
      const mx = ctl[k] + f * (ctl[k + 2] - ctl[k]), my = ctl[k + 1] + f * (ctl[k + 3] - ctl[k + 1]);
      const [ex, ey] = pointOn(path, j, f);
      pen.bezierCurveTo(ax, ay, ax + f * (mx - ax), ay + f * (my - ay), ex, ey);
    } else {
      const [x, y] = pointOn(path, j, f);
      pen.lineTo(x, y);
    }
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
      this.paths = [];
      // the scale and window for which the paths were last computed
      this.pathsFor = "";
      // the pointer in canvas pixels, and the glow radius there
      this.pointer = null;
      // the box and the slide for which the window was last fitted, in slide pixels
      this.fittedFor = "";
      // true when start() was called before the strands of a file were loaded
      this.pending = false;
      // the colors of the strands with an ink, resolved in redraw() for the current mode
      this.inks = [];
      // copies of the canvases and of the trail, traced in the colors of the old mode during a flip, or
      // null
      this.ghosted = null;
      // during a trace, the strands before the index cached are drawn on the trail a piece per frame, and
      // the others are stroked whole at every frame, see order()
      this.cached = 0;
      // the point of each strand before cached up to which it is drawn on the trail, a point of its path
      this.upTo = [];
      // the first points of the bands of the fade of each strand, from bandsOf()
      this.bands = [];
      // a canvas outside the page with the bodies and the strands before cached up to upTo, copied onto
      // the base canvas at every frame of a trace, or null outside a trace
      this.trail = null;
      this.el = el;
      const file = el.dataset.strands !== void 0;
      this.strands = file ? [] : scene(el.dataset.scene ?? "");
      this.dots = file ? [] : null;
      this.loaded = !file;
      this.fitted = file && el.dataset.half === void 0;
      this.headSize = HEADS[el.dataset.heads ?? "full"] ?? HEADS.full;
      this.everyHead = el.dataset.heads !== void 0;
      const given2 = Number(el.dataset.duration);
      this.duration = given2 > 0 ? given2 : DURATION;
      this.stagger = Math.max(0, Number(el.dataset.stagger) || 0);
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
      this.order();
      CACHE.set(el, this);
      this.fit();
      this.ready = file ? strandsFor(el).then(({ strands, dots }) => this.install(strands, dots)) : Promise.resolve();
    }
    static of(el) {
      return CACHE.get(el);
    }
    static reduced() {
      if (typeof window === "undefined") return true;
      const q = location.search;
      return matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.hasAttribute("data-still") || /[?&]still\b/.test(q) || /print-pdf/.test(q);
    }
    install(strands, dots) {
      this.strands = strands;
      this.dots = dots;
      this.Tmax = Math.max(...strands.map((s) => s.T));
      this.idx = strands.map(() => 0);
      this.order();
      this.loaded = true;
      this.fittedFor = "";
      this.pathsFor = "";
      this.fit();
      if (this.pending) {
        this.pending = false;
        this.start();
      }
    }
    // sets cached, the number of strands at the start of the order of the strands that are drawn in
    // pieces during a trace. a strand is drawn in pieces where the seams of the pieces are too faint to
    // be seen, i.e. it is a hairline without a glow at an opacity of 0.5 or less, and where the pieces
    // keep the order of the strands, i.e. every earlier strand of another color is traced before it
    // begins. two strokes of one color give the same pixels in either order
    order() {
      const ends = /* @__PURE__ */ new Map();
      const seconds = (i, t) => t / this.Tmax * this.duration + i * this.stagger;
      let k = 0;
      for (; k < this.strands.length; k++) {
        const s = this.strands[k], color = colorOf(s), begin = seconds(k, s.times[0]);
        if (s.glow || alphaOf(s) > 0.5 || widthOf(s) > 1) break;
        if ([...ends].some(([other, end]) => other !== color && end > begin)) break;
        ends.set(color, Math.max(ends.get(color) ?? -Infinity, seconds(k, s.times[s.times.length - 1])));
      }
      this.cached = k;
      this.upTo = this.strands.map(() => 0);
      this.bands = this.strands.map(bandsOf);
      this.trail = null;
    }
    // the last point of the path of strand i at or before its point j
    lastKept(i, j) {
      const keep = this.paths[i].keep;
      let lo = 0, hi = keep.length - 1;
      while (lo < hi) {
        const mid = lo + hi + 1 >> 1;
        if (keep[mid] <= j) lo = mid;
        else hi = mid - 1;
      }
      return keep[lo];
    }
    // the window in the units of the strands: its center and its half height
    get view() {
      return { cx: this.cx, cy: this.cy, half: this.half };
    }
    get done() {
      return this.finished || this.loop;
    }
    // true while the backdrop is drawn again at every frame of the screen, i.e. during a trace or a
    // loop
    get tracing() {
      return this.raf !== 0;
    }
    get canvases() {
      return [this.base, this.head];
    }
    // copies the canvases into the element into, whose client box is at origin, over the boxes of the
    // canvases. until unghost() is called, the trace is continued on the copies in the colors of the
    // mode at the call, while the canvases are redrawn in the next mode
    ghost(into, origin) {
      this.unghost();
      if (!this.W) return;
      const r = this.el.getBoundingClientRect();
      const [base, head] = this.canvases.map((from) => {
        const to = document.createElement("canvas");
        to.width = this.W;
        to.height = this.H;
        Object.assign(to.style, { position: "absolute", left: `${r.left - origin.left}px`, top: `${r.top - origin.top}px`, width: `${r.width}px`, height: `${r.height}px` });
        to.getContext("2d")?.drawImage(from, 0, 0);
        into.append(to);
        return to;
      });
      let trail = null;
      if (this.trail) {
        trail = document.createElement("canvas");
        trail.width = this.W;
        trail.height = this.H;
        trail.getContext("2d")?.drawImage(this.trail, 0, 0);
      }
      this.ghosted = { base, head, trail, c: this.colors(), inks: [...this.inks] };
    }
    unghost() {
      this.ghosted?.base.remove();
      this.ghosted?.head.remove();
      this.ghosted = null;
    }
    colors() {
      const cs = getComputedStyle(this.el);
      return { stroke: cs.getPropertyValue("--stroke").trim(), body: cs.getPropertyValue("--body").trim(), accent: cs.getPropertyValue("--accent").trim(), violet: cs.getPropertyValue("--violet").trim(), text: cs.getPropertyValue("--text").trim(), light: this.el.ownerDocument.documentElement.dataset.theme === "light" };
    }
    // the colors of the strands with an ink in the current mode. a color of the palette is serialized
    // by the canvas as #rrggbb or rgba(), which mix() reads, and a strand is given the stroke color
    // when its colors are missing or of another form
    paint(ctx, c) {
      if (!this.strands.some((s) => s.ink)) {
        this.inks = [];
        return;
      }
      const cs = getComputedStyle(this.el);
      const color = (name) => {
        const value = cs.getPropertyValue(name).trim();
        if (!value) return "";
        ctx.fillStyle = "#000000";
        ctx.fillStyle = value;
        return String(ctx.fillStyle);
      };
      const palette = Array.from({ length: PALETTE }, (_, i) => color(`--strand-${i + 1}`));
      const bg = color("--bg") || void 0;
      this.inks = this.strands.map((s) => {
        if (!s.ink) return "";
        if (s.ink.map) return colormapColor(s.ink.map, s.ink.at, bg);
        const k = 2 * s.ink.pair % PALETTE;
        return (s.ink.shade ? shadeOf(palette[k], s.ink.at, bg) : mix(palette[k], palette[k + 1], s.ink.at)) ?? c.stroke;
      });
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
      this.unghost();
      if (this.fitted && this.strands.length) {
        const section = this.el.closest("section");
        const box2 = { left: this.el.offsetLeft, top: this.el.offsetTop, width: w, height: h };
        const slide = { width: section?.offsetWidth || w, height: section?.offsetHeight || h };
        const key2 = [box2.left, box2.top, w, h, slide.width, slide.height].join();
        if (key2 !== this.fittedFor) {
          const view = fitView(this.strands, box2, slide);
          if (view) ({ cx: this.cx, cy: this.cy, half: this.half } = view);
          this.fittedFor = key2;
        }
      }
      this.W = Math.max(1, Math.round(r.width * dpr));
      this.H = Math.max(1, Math.round(r.height * dpr));
      for (const c of [this.base, this.head]) {
        c.width = this.W;
        c.height = this.H;
      }
      this.scale = this.H / 2 / this.half;
      this.lw = Math.max(1, 0.7 * dpr * (r.height / h));
      const key = [this.W, this.H, this.cx, this.cy, this.half].join();
      if (key !== this.pathsFor) {
        this.paths = this.strands.map((s) => {
          const n = s.times.length, out = new Float32Array(2 * n);
          for (let i = 0; i < n; i++) {
            out[2 * i] = this.X(s.pts[2 * i]);
            out[2 * i + 1] = this.Y(s.pts[2 * i + 1]);
          }
          return pathOf(out);
        });
        this.pathsFor = key;
        this.upTo = this.upTo.map((j, i) => this.lastKept(i, j));
      }
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
      if (this.dots) {
        for (const d of this.dots) {
          const X = this.X(d.x), Y = this.Y(d.y);
          if (X < -10 || X > this.W + 10 || Y < -10 || Y > this.H + 10) continue;
          ctx.beginPath();
          ctx.arc(X, Y, (2.2 + 2.8 * Math.cbrt(d.mass ?? 0.1)) * this.lw, 0, 2 * Math.PI);
          ctx.fill();
        }
        return;
      }
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
    // the color, opacity, width, and glow of strand i: those of its tone, then its own ink, alpha,
    // weight, and glow where it has them
    pen(ctx, c, i, inks = this.inks) {
      const s = this.strands[i], tone = s.tone;
      ctx.strokeStyle = s.color ? typeof s.color === "string" ? s.color : s.color[c.light ? 1 : 0] : s.ink ? inks[i] : tone === "orange" || tone === "hero" ? c.accent : tone === "violet" ? c.violet : tone === "text" || tone === "line" ? c.text : c.stroke;
      ctx.globalAlpha = alphaOf(s);
      ctx.lineWidth = widthOf(s) * this.lw;
      ctx.lineJoin = "round";
      ctx.shadowBlur = s.glow ? 6 * this.lw : 0;
      if (s.glow) ctx.shadowColor = ctx.strokeStyle;
    }
    // strokes strand i from its point from, its first by default, up to the fraction f of its segment
    // from point j to j + 1. up to its fade, the strand is stroked in one path, since two strokes of one
    // strand at an opacity below 1 overlap or leave a gap at their joint. beyond its fade, it is stroked
    // in bands of equal time, which begin and end at its points, at an opacity that falls to zero at its
    // last point. a stroke from a later point draws the pixels of the same bands beyond this point
    stroke(ctx, i, j, f, from = 0) {
      const path = this.paths[i], ends = this.bands[i];
      const part = (a2, b, g) => {
        if (b < from || b === from && !(g > 0)) return;
        ctx.beginPath();
        trace(ctx, path, b, g, Math.max(a2, from));
        ctx.stroke();
      };
      let a = ends ? Math.min(ends[0], j) : j;
      if (!ends || a === j) return part(0, j, f);
      if (a > 0) part(0, a, 0);
      const base = ctx.globalAlpha;
      for (let b = 0; b < FADE_BANDS && a < j; b++) {
        const c = b === FADE_BANDS - 1 ? j : Math.min(ends[b + 1], j);
        if (c > a) {
          ctx.globalAlpha = base * (1 - (b + 0.5) / FADE_BANDS) ** 2;
          part(a, c, c === j ? f : 0);
        }
        a = c;
      }
      ctx.globalAlpha = base;
    }
    // the last point drawn of strand i
    drawn(i) {
      return this.done ? this.strands[i].times.length - 1 : this.idx[i];
    }
    // true between the start and the end of a trace that is not a loop
    get midTrace() {
      return !this.loop && this.t0 !== null && !this.finished;
    }
    // the fraction of the segment of strand i from point j to j + 1 reached at the flight time tau
    fraction(i, j, tau) {
      const t = this.strands[i].times, dt = t[j + 1] - t[j];
      return dt > 0 ? Math.min(1, Math.max(0, (tau - t[j]) / dt)) : 1;
    }
    // draws the bodies and the strands on the base canvas for the current mode
    redraw() {
      if (!this.W) return;
      const ctx = this.base.getContext("2d");
      if (!ctx) return;
      const c = this.colors(), now = performance.now();
      this.paint(ctx, c);
      this.trail = null;
      this.draw(ctx, c, now, this.inks, this.midTrace ? this.trailOf(c) : null);
      this.paintHead(now, c);
    }
    // draws the bodies and every strand, a finished strand whole and a strand in its trace up to its
    // head at the time now. the strands are stroked in the order of their file or scene at every
    // frame, the order of the still, hence the last frame of a trace is its still apart from the heads.
    // with a trail, the trail is copied in place of the bodies, and each strand before cached is
    // stroked from its point of upTo on
    draw(ctx, c, now, inks = this.inks, trail = null) {
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.clearRect(0, 0, this.W, this.H);
      if (trail) ctx.drawImage(trail, 0, 0);
      else this.bodies(ctx, c);
      const tracing = this.midTrace;
      this.strands.forEach((s, i) => {
        const n = s.times.length, j = this.drawn(i), from = trail && i < this.cached ? this.upTo[i] : 0;
        if (from > 0 && from >= n - 1) return;
        if (j < n - 1) {
          const tau = this.clock(i, now);
          if (!tracing || !(tau > s.times[0])) return;
          this.pen(ctx, c, i, inks);
          this.stroke(ctx, i, j, this.fraction(i, j, tau), from);
          return;
        }
        this.pen(ctx, c, i, inks);
        this.stroke(ctx, i, n - 1, 0, from);
      });
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
    // the trail of the trace, laid with the bodies and the strands before cached up to upTo when it
    // is missing, or null without a strand before cached
    trailOf(c) {
      if (!this.cached) return null;
      if (!this.trail) {
        const trail = document.createElement("canvas");
        trail.width = this.W;
        trail.height = this.H;
        const ctx = trail.getContext("2d");
        if (!ctx) return null;
        this.bodies(ctx, c);
        for (let i = 0; i < this.cached; i++) {
          if (!this.upTo[i]) continue;
          this.pen(ctx, c, i);
          this.stroke(ctx, i, this.upTo[i], 0);
        }
        this.trail = trail;
      }
      return this.trail;
    }
    // draws on the trails the pieces of the strands before cached that their heads have passed since
    // the last frame, i.e. from the point of upTo to the last point of the path passed, and moves upTo
    // there. a piece ends at a point of the path, since a stroke to a point left out of the path ends
    // at the point of the path before it
    extend(c) {
      const ctx = this.trailOf(c)?.getContext("2d"), ghost = this.ghosted, gtx = ghost?.trail?.getContext("2d");
      if (!ctx) return;
      for (let i = 0; i < this.cached; i++) {
        const to = this.lastKept(i, this.idx[i]), from = this.upTo[i];
        if (to <= from) continue;
        this.pen(ctx, c, i);
        this.stroke(ctx, i, to, 0, from);
        if (ghost && gtx) {
          this.pen(gtx, ghost.c, i, ghost.inks);
          this.stroke(gtx, i, to, 0, from);
        }
        this.upTo[i] = to;
      }
      for (const t of [ctx, gtx]) if (t) {
        t.globalAlpha = 1;
        t.shadowBlur = 0;
      }
    }
    reset() {
      this.unghost();
      this.stop();
      this.pending = false;
      this.t0 = null;
      this.finished = false;
      this.idx = this.strands.map(() => 0);
      this.upTo = this.strands.map(() => 0);
      this.redraw();
    }
    start() {
      if (_Orbits.reduced()) {
        this.complete();
        return;
      }
      if (!this.loaded) {
        this.pending = true;
        return;
      }
      if (this.raf || this.finished && !this.loop) return;
      this.t0 = performance.now();
      this.trail = null;
      const tick = (now) => {
        this.frame(now);
        this.raf = !this.finished || this.loop ? requestAnimationFrame(tick) : 0;
      };
      this.raf = requestAnimationFrame(tick);
    }
    complete() {
      this.unghost();
      this.stop();
      this.pending = false;
      this.finished = true;
      this.t0 = null;
      this.redraw();
    }
    destroy() {
      this.unghost();
      this.stop();
      this.pending = false;
      this.trail = null;
      this.base.remove();
      this.head.remove();
      CACHE.delete(this.el);
    }
    // tints the drawn strands within r slide pixels of the client point in the accent color, or
    // clears the tint when clientX is null
    glow(clientX, clientY = 0, r = 20) {
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
      this.headOn(this.head, now, c);
      if (this.ghosted) this.headOn(this.ghosted.head, now, this.ghosted.c);
    }
    headOn(canvas, now, c) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, this.W, this.H);
      if (this.loop) this.loopHead(ctx, c, now);
      else if (this.raf && this.t0 !== null && !this.finished) this.heads(ctx, c, now);
      if (this.pointer) this.glowing(ctx, c);
    }
    loopHead(ctx, c, now) {
      const s = this.strands[0], p = this.paths[0].px, n = s.times.length;
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
    // the flight time reached by strand i at the time now, which is negative before its start
    clock(i, now) {
      return ((now - (this.t0 ?? now)) / 1e3 - i * this.stagger) / this.duration * this.Tmax;
    }
    // the radius of the head of strand i in line widths: the one of its record, or the one of the
    // backdrop on the path of a spacecraft, or on every strand with data-heads set
    headOf(i) {
      const s = this.strands[i];
      return s.head ?? (this.everyHead || s.craft ? this.headSize : 0);
    }
    // true when a head is drawn on at least one strand during a trace
    get headed() {
      return this.strands.some((_, i) => this.headOf(i) > 0);
    }
    // the seconds into the trace at which its first head is drawn, e.g. at the start of a record of a file
    get headAfter() {
      if (!(this.Tmax > 0)) return 0;
      const first = Math.min(...this.strands.map((s, i) => this.headOf(i) > 0 ? s.times[0] / this.Tmax * this.duration + i * this.stagger : Infinity));
      return Number.isFinite(first) ? first : 0;
    }
    heads(ctx, c, now) {
      if (!this.headed) return;
      ctx.fillStyle = c.accent;
      this.strands.forEach((s, i) => {
        const j = this.idx[i], tau = this.clock(i, now), size = this.headOf(i);
        if (!size || j >= s.times.length - 1 || tau < s.times[0]) return;
        const [X, Y] = this.at(i, j, tau);
        ctx.beginPath();
        ctx.arc(X, Y, size * this.lw, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
    // tints the drawn strands within the radius of the pointer. a segment of a strand is stroked when its
    // box, with its control points where it is curved, meets the box of the disc, and the stroke is
    // clipped to the disc, since the points of a strand may lie far apart on either side of it
    glowing(ctx, c) {
      const g = this.pointer;
      if (!g) return;
      const reach = g.r + this.lw;
      ctx.save();
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, 2 * Math.PI);
      ctx.clip();
      ctx.strokeStyle = c.accent;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = this.lw;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      this.strands.forEach((_, i) => {
        const { px: p, ctl } = this.paths[i], last = this.drawn(i);
        let pen = false;
        for (let j = 1; j <= last; j++) {
          const bent = curved(ctl, j - 1);
          let lx = Math.min(p[2 * j - 2], p[2 * j]), hx = Math.max(p[2 * j - 2], p[2 * j]);
          let ly = Math.min(p[2 * j - 1], p[2 * j + 1]), hy = Math.max(p[2 * j - 1], p[2 * j + 1]);
          if (bent) {
            lx = Math.min(lx, ctl[4 * j - 4], ctl[4 * j - 2]);
            hx = Math.max(hx, ctl[4 * j - 4], ctl[4 * j - 2]);
            ly = Math.min(ly, ctl[4 * j - 3], ctl[4 * j - 1]);
            hy = Math.max(hy, ctl[4 * j - 3], ctl[4 * j - 1]);
          }
          if (lx > g.x + reach || hx < g.x - reach || ly > g.y + reach || hy < g.y - reach) {
            pen = false;
            continue;
          }
          if (!pen) ctx.moveTo(p[2 * j - 2], p[2 * j - 1]);
          if (bent) ctx.bezierCurveTo(ctl[4 * j - 4], ctl[4 * j - 3], ctl[4 * j - 2], ctl[4 * j - 1], p[2 * j], p[2 * j + 1]);
          else ctx.lineTo(p[2 * j], p[2 * j + 1]);
          pen = true;
        }
      });
      ctx.stroke();
      ctx.restore();
    }
    // the point of strand i at the flight time tau, on its segment from point j to j + 1
    at(i, j, tau) {
      return pointOn(this.paths[i], j, j < this.strands[i].times.length - 1 ? this.fraction(i, j, tau) : 0);
    }
    frame(now) {
      if (this.loop || !this.W) {
        this.paintHead(now);
        return;
      }
      const ctx = this.base.getContext("2d");
      if (!ctx) return;
      let flying = 0;
      this.strands.forEach((s, i) => {
        const n = s.times.length, tau = this.clock(i, now);
        let j = this.idx[i];
        while (j < n - 1 && s.times[j + 1] <= tau) j++;
        this.idx[i] = j;
        if (j < n - 1) flying++;
      });
      if (flying === 0) this.finished = true;
      const c = this.colors(), ghost = this.ghosted, gtx = ghost?.base.getContext("2d");
      if (this.finished) this.trail = null;
      else this.extend(c);
      this.draw(ctx, c, now, this.inks, this.trail);
      if (ghost && gtx) this.draw(gtx, ghost.c, now, ghost.inks, this.trail && ghost.trail);
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
  function sourceText(el) {
    const items = window.MathJax?.startup?.document?.getMathItemsWithin([el]) ?? [];
    if (!items.length) return el.textContent ?? "";
    const tex = new Map(items.filter((i) => i.typesetRoot).map((i) => [i.typesetRoot, `${i.start.delim ?? ""}${i.math}${i.end.delim ?? ""}`]));
    const copy = el.cloneNode(true);
    const roots = [...el.querySelectorAll("mjx-container")];
    [...copy.querySelectorAll("mjx-container")].forEach((m, k) => m.replaceWith(tex.get(roots[k]) ?? m.textContent ?? ""));
    return copy.textContent ?? "";
  }
  var heading = (slide) => {
    if (slide.dataset.run !== void 0) return slide.dataset.run;
    const h = slide.querySelector("h2") ?? slide.querySelector("h1");
    return h ? sourceText(h).trim() : "";
  };
  var APPENDIX = "Appendix slides";
  var made = /* @__PURE__ */ new WeakMap();
  function typeset(nodes) {
    const mj = window.MathJax;
    if (!nodes.length || !mj?.typesetPromise) return;
    void Promise.resolve(mj.startup?.promise).then(() => mj.typesetPromise(nodes.filter((n) => n.isConnected)));
  }
  function untypeset(nodes) {
    if (nodes.length) window.MathJax?.typesetClear?.(nodes);
  }
  function fill() {
    const slides = [...document.querySelectorAll(".reveal .slides section:not(:has(> section))")];
    const sections = slides.filter((s) => s.classList.contains("section"));
    const fresh = [];
    const gone = [];
    let text = "";
    for (const slide of slides) {
      if (slide.classList.contains("section")) text = heading(slide);
      if (slide.classList.contains("closing")) text = APPENDIX;
      const old = slide.querySelector(":scope > div.run[data-generated]");
      const wanted = !OWN.some((c) => slide.classList.contains(c)) && !slide.querySelector(".run:not([data-generated])") && !!text;
      if (old && wanted && made.get(old) === text) {
        if (old.nextElementSibling) slide.append(old);
        continue;
      }
      if (old) {
        gone.push(old);
        old.remove();
      }
      if (!wanted) continue;
      const run = document.createElement("div");
      run.className = "run";
      run.dataset.generated = "";
      run.textContent = text;
      made.set(run, text);
      slide.append(run);
      fresh.push(run);
    }
    for (const list2 of document.querySelectorAll(".reveal ul.outline[data-auto]")) {
      const home = list2.closest("section");
      const names = sections.map(heading);
      const items = [...list2.children];
      const same = items.length === names.length && items.every((li, k) => made.get(li) === names[k]);
      if (same) {
        items.forEach((li, k) => li.classList.toggle("now", sections[k] === home));
        continue;
      }
      gone.push(...items);
      const lis = sections.map((s, k) => {
        const li = document.createElement("li");
        li.textContent = names[k];
        made.set(li, names[k]);
        if (s === home) li.className = "now";
        return li;
      });
      list2.replaceChildren(...lis);
      fresh.push(...lis);
    }
    untypeset(gone);
    typeset(fresh);
  }
  function initChrome() {
    fill();
  }
  function refreshChrome() {
    fill();
  }

  // src/click.ts
  var OWN2 = [
    "a[href]",
    "button",
    "input",
    "select",
    "textarea",
    "label",
    "summary",
    "iframe",
    "video",
    "audio",
    '[contenteditable]:not([contenteditable="false"])',
    ".plot",
    ".surface",
    "tycho-viewer",
    ".qr",
    ".run",
    ".foot",
    ".slide-number",
    ".progress",
    ".scrub",
    ".theme-switch",
    ".r-overlay"
  ].join(", ");
  var SLOP = 4;
  var selected = () => String(window.getSelection() ?? "");
  function initClick(deck, cue, end) {
    const root2 = deck.getRevealElement();
    let down = null;
    document.addEventListener("pointerdown", (ev) => {
      down = ev.isPrimary && ev.button === 0 ? { x: ev.clientX, y: ev.clientY, text: selected() } : null;
    }, true);
    document.addEventListener("click", (ev) => {
      const from = down;
      down = null;
      if (!from || ev.button !== 0 || ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) return;
      if (Math.hypot(ev.clientX - from.x, ev.clientY - from.y) > SLOP) return;
      const text = selected();
      if (text && text !== from.text) return;
      const target = ev.target instanceof Element ? ev.target : null;
      if (!target || !root2.contains(target)) return;
      const own = target.closest(OWN2);
      if (own instanceof HTMLMediaElement && !own.controls) {
        if (own.paused) void own.play().catch(() => {
        });
        else own.pause();
      }
      if (own || deck.isOverview() || deck.isPaused()) return;
      if (end && deck.isLastSlide() && !deck.availableFragments().next) return end();
      deck.next();
      cue();
    });
  }

  // src/cursor.ts
  var REACH = 20;
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
  function initCursor(orbits, slide, tintOn = true) {
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
    const tint = tintOn && !Orbits.reduced();
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

  // src/fullscreen.ts
  var prefixed = document;
  var isFullscreen = () => !!(prefixed.fullscreenElement ?? prefixed.webkitFullscreenElement);
  function enter() {
    const root2 = document.documentElement;
    if (root2.requestFullscreen) root2.requestFullscreen().catch(() => {
    });
    else root2.webkitRequestFullscreen?.();
  }
  function toggleFullscreen() {
    if (!isFullscreen()) enter();
    else if (prefixed.exitFullscreen) prefixed.exitFullscreen().catch(() => {
    });
    else prefixed.webkitExitFullscreen?.();
  }
  function windowFull(w = window) {
    const near = (a, b) => Math.abs(a - b) <= 1;
    return near(w.outerWidth, w.screen.width) && near(w.outerHeight, w.screen.height) && w.innerHeight < w.screen.height - 1;
  }
  function initFullscreen() {
    let armed = false;
    let left = false;
    const check = () => {
      if (!windowFull()) {
        armed = false;
        left = false;
      } else if (!isFullscreen() && !left) armed = true;
    };
    const changed = () => {
      armed = false;
      if (!isFullscreen()) left = true;
    };
    const take = (ev) => {
      if (!armed || isFullscreen() || ev instanceof KeyboardEvent && (ev.key === "Escape" || ev.repeat)) return;
      armed = false;
      enter();
    };
    window.addEventListener("resize", check);
    document.addEventListener("fullscreenchange", changed);
    document.addEventListener("webkitfullscreenchange", changed);
    document.addEventListener("keydown", take, true);
    document.addEventListener("pointerdown", take, true);
    check();
  }

  // src/plot.ts
  var KINDS = ["points", "trace", "label", "events"];
  var PATCH = ["x", "y", "title", "regions", "curves", "labels"];
  var MARGIN2 = [52, 20, 84, 76];
  function fail(path, what) {
    throw new Error(`${path}: ${what}`);
  }
  var isObject2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
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
    if (!isObject2(v)) fail(path, "an axis { range, ticks, title } is expected");
    const range = pair(v.range, `${path}.range`);
    if (!(range[1] > range[0])) fail(`${path}.range`, "the second end must be larger than the first");
    const scale = str(v.scale, `${path}.scale`, "linear");
    if (scale !== "linear" && scale !== "asinh") fail(`${path}.scale`, "linear or asinh is expected");
    const unit = num(v.unit, `${path}.unit`, 1);
    if (!(unit > 0)) fail(`${path}.unit`, "a positive number is expected");
    const ticks = list(v.ticks, `${path}.ticks`, []).map((t, i) => {
      const p = `${path}.ticks[${i}]`;
      if (typeof t === "number") return { at: num(t, p), text: formatNumber(t) };
      if (!isObject2(t)) fail(p, "a number or a tick { at, text } is expected");
      const at = num(t.at, `${p}.at`);
      return { at, text: str(t.text, `${p}.text`, formatNumber(at)) };
    });
    return { range, ticks, title: str(v.title, `${path}.title`, ""), scale, unit };
  }
  function scaled(a, v) {
    return a.scale === "asinh" ? Math.asinh(v / a.unit) : v;
  }
  function regions(v, path) {
    return list(v, path, []).map((r, i) => {
      const p = `${path}[${i}]`;
      if (!isObject2(r)) fail(p, "a region is expected");
      return { ...item(r, p, "violet"), points: pairs(r.points, `${p}.points`), opacity: num(r.opacity, `${p}.opacity`, 0.12) };
    });
  }
  function curves(v, path) {
    return list(v, path, []).map((c, i) => {
      const p = `${path}[${i}]`;
      if (!isObject2(c)) fail(p, "a curve is expected");
      let circle = null;
      if (c.circle !== void 0) {
        const a = list(c.circle, `${p}.circle`);
        if (a.length !== 3) fail(`${p}.circle`, "a circle [cx, cy, r] is expected");
        circle = [num(a[0], `${p}.circle[0]`), num(a[1], `${p}.circle[1]`), num(a[2], `${p}.circle[2]`)];
      } else if (c.points === void 0) fail(p, "points or circle is expected");
      const dash = c.dash === void 0 ? null : list(c.dash, `${p}.dash`).map((d, j) => num(d, `${p}.dash[${j}]`));
      return { ...item(c, p, "subtle"), points: circle ? null : pairs(c.points, `${p}.points`), circle, width: num(c.width, `${p}.width`, 2), dash };
    });
  }
  function labels(v, path) {
    return list(v, path, []).map((l, i) => {
      const p = `${path}[${i}]`;
      if (!isObject2(l)) fail(p, "a label is expected");
      return { ...item(l, p, "subtle"), at: pair(l.at, `${p}.at`), text: str(l.text, `${p}.text`), anchor: anchor(l.anchor, `${p}.anchor`), dx: num(l.dx, `${p}.dx`, 0), dy: num(l.dy, `${p}.dy`, 0) };
    });
  }
  function panel(v, path) {
    if (!isObject2(v)) fail(path, "a panel is expected");
    let margin = [...MARGIN2];
    if (v.margin !== void 0) {
      const m = list(v.margin, `${path}.margin`).map((x, i) => num(x, `${path}.margin[${i}]`));
      if (m.length !== 4) fail(`${path}.margin`, "a margin [top, right, bottom, left] is expected");
      margin = [m[0], m[1], m[2], m[3]];
    }
    const size = num(v.size, `${path}.size`, 1);
    if (!(size > 0)) fail(`${path}.size`, "a positive number is expected");
    return {
      id: str(v.id, `${path}.id`),
      x: axis(v.x, `${path}.x`),
      y: axis(v.y, `${path}.y`),
      equal: v.equal === true,
      axes: v.axes !== false,
      title: str(v.title, `${path}.title`, ""),
      regions: regions(v.regions, `${path}.regions`),
      curves: curves(v.curves, `${path}.curves`),
      labels: labels(v.labels, `${path}.labels`),
      size,
      margin
    };
  }
  function patch(v, path) {
    if (!isObject2(v)) fail(path, "a panel is expected");
    for (const key of Object.keys(v)) if (!PATCH.includes(key)) fail(`${path}.${key}`, `one of ${PATCH.join(", ")} is expected`);
    const out = {};
    if (v.x !== void 0) out.x = axis(v.x, `${path}.x`);
    if (v.y !== void 0) out.y = axis(v.y, `${path}.y`);
    if (v.title !== void 0) out.title = str(v.title, `${path}.title`);
    if (v.regions !== void 0) out.regions = regions(v.regions, `${path}.regions`);
    if (v.curves !== void 0) out.curves = curves(v.curves, `${path}.curves`);
    if (v.labels !== void 0) out.labels = labels(v.labels, `${path}.labels`);
    return out;
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
      const given2 = isObject2(v) ? v : { points: v };
      const points = pairs(given2.points, isObject2(v) ? `${path}.points` : path);
      perFrame(points.length);
      const ghost = num(given2.ghost, `${path}.ghost`, points.length - 1);
      if (!Number.isInteger(ghost) || ghost < 0 || ghost > points.length - 1) fail(`${path}.ghost`, `a frame from 0 to ${points.length - 1} is expected`);
      return { points, ghost };
    }
    if (m.kind === "label") {
      if (!isObject2(v)) fail(path, "a label { at, text } is expected");
      const at = Array.isArray(v.at) && Array.isArray(v.at[0]) ? pairs(v.at, `${path}.at`) : [pair(v.at, `${path}.at`)];
      const text = Array.isArray(v.text) ? v.text.map((t, i) => str(t, `${path}.text[${i}]`)) : [str(v.text, `${path}.text`)];
      perFrame(at.length);
      perFrame(text.length);
      return { at, text };
    }
    return list(v, path).map((e, i) => {
      const p = `${path}[${i}]`;
      if (!isObject2(e)) fail(p, "an event { frame, at, text } is expected");
      const frame = num(e.frame, `${p}.frame`);
      if (frame < 0 || frame > frames - 1) fail(`${p}.frame`, `a frame from 0 to ${frames - 1} is expected`);
      return { frame, at: pair(e.at, `${p}.at`), text: str(e.text, `${p}.text`, "") };
    });
  }
  function parsePlot(input) {
    const v = typeof input === "string" ? JSON.parse(input) : input;
    if (!isObject2(v)) fail("plot", "an object is expected");
    const panels = list(v.panels, "panels").map((p, i) => panel(p, `panels[${i}]`));
    if (!panels.length) fail("panels", "at least one panel is expected");
    const ids = new Set(panels.map((p) => p.id));
    if (ids.size !== panels.length) fail("panels", "the ids of the panels must differ");
    const marks = list(v.marks, "marks", []).map((m, i) => {
      const p = `marks[${i}]`;
      if (!isObject2(m)) fail(p, "a mark is expected");
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
        ghost: m.ghost !== false,
        anchor: anchor(m.anchor, `${p}.anchor`),
        dx: num(m.dx, `${p}.dx`, 0),
        dy: num(m.dy, `${p}.dy`, 0)
      };
    });
    const tabs = list(v.tabs, "tabs").map((t, i) => {
      const p = `tabs[${i}]`;
      if (!isObject2(t)) fail(p, "a tab is expected");
      const name = str(t.name, `${p}.name`);
      const values = list(t.values, `${p}.values`).map((x, j) => num(x, `${p}.values[${j}]`));
      if (!values.length) fail(`${p}.values`, "at least one value is expected");
      const raw = t.data === void 0 ? {} : t.data;
      if (!isObject2(raw)) fail(`${p}.data`, "an object of mark ids is expected");
      const data = {};
      for (const key of Object.keys(raw)) {
        const m = marks.find((mark) => mark.id === key) ?? fail(`${p}.data.${key}`, "the mark is not declared");
        data[key] = markData(m, raw[key], values.length, `${p}.data.${key}`);
      }
      let times = null;
      if (t.times !== void 0) {
        const given3 = list(t.times, `${p}.times`).map((x, j) => num(x, `${p}.times[${j}]`));
        if (given3.length !== values.length) fail(`${p}.times`, `${given3.length} times are given, and the tab has ${values.length} values`);
        if (given3[0] !== 0 || given3.some((x, j) => j > 0 && !(x > given3[j - 1]))) fail(`${p}.times`, "times that increase from 0 are expected");
        times = given3;
      }
      let active = null;
      if (t.active !== void 0) {
        active = list(t.active, `${p}.active`).map((f, j) => typeof f === "string" ? [f] : list(f, `${p}.active[${j}]`).map((s, k) => str(s, `${p}.active[${j}][${k}]`)));
        if (active.length !== values.length) fail(`${p}.active`, `${active.length} frames are given, and the tab has ${values.length} values`);
      }
      const given2 = t.panels === void 0 ? {} : t.panels;
      if (!isObject2(given2)) fail(`${p}.panels`, "an object of panel ids is expected");
      const patches = {};
      for (const key of Object.keys(given2)) {
        if (!ids.has(key)) fail(`${p}.panels.${key}`, `the panel ${key} is not declared`);
        patches[key] = patch(given2[key], `${p}.panels.${key}`);
      }
      return { name, label: str(t.label, `${p}.label`, name), values, times, data, active, panels: patches };
    });
    if (!tabs.length) fail("tabs", "at least one tab is expected");
    const parameter = isObject2(v.parameter) ? v.parameter : {};
    const layout = v.layout === void 0 ? null : str(v.layout, "layout");
    if (layout !== null && layout !== "row" && layout !== "column") fail("layout", "row or column is expected");
    return {
      parameter: { label: str(parameter.label, "parameter.label", ""), digits: num(parameter.digits, "parameter.digits", 3) },
      duration: num(v.duration, "duration", 8),
      hold: num(v.hold, "hold", 1),
      fade: num(v.fade, "fade", 0.5),
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
  function passLength(n, duration, times) {
    return times ? times[n - 1] : duration;
  }
  function timeAt(u, n, duration, times) {
    if (n < 2) return 0;
    const v = clamp(u, 0, n - 1);
    if (!times) return v / (n - 1) * duration;
    const i = Math.min(n - 2, Math.floor(v));
    return times[i] + (v - i) * (times[i + 1] - times[i]);
  }
  function frameAt(tau, n, duration, times) {
    if (n < 2) return 0;
    if (!times) return clamp(tau / duration, 0, 1) * (n - 1);
    if (!(tau > 0)) return 0;
    if (tau >= times[n - 1]) return n - 1;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const m = lo + hi >> 1;
      if (times[m] <= tau) lo = m;
      else hi = m;
    }
    return lo + (tau - times[lo]) / (times[lo + 1] - times[lo]);
  }
  function loopFrame(t, n, duration, hold, times = null) {
    if (n < 2) return 0;
    const period = passLength(n, duration, times) + hold;
    const tau = (t % period + period) % period;
    return frameAt(tau, n, duration, times);
  }
  function loopFade(t, length, hold, fade) {
    const f = Math.min(fade, length), period = length + hold;
    if (!(f > 0) || !(period > 0) || t < 0) return 1;
    const pass = Math.floor(t / period), tau = t - pass * period;
    const a = pass > 0 && tau < f ? tau / f : 1;
    return a * a * (3 - 2 * a);
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
  var SCRIPT_GAPS = { B: "\u212C", E: "\u2130", F: "\u2131", H: "\u210B", I: "\u2110", L: "\u2112", M: "\u2133", R: "\u211B" };
  var script = (c) => SCRIPT_GAPS[c] ?? (/^[A-Z]$/.test(c) ? String.fromCodePoint(119964 + c.charCodeAt(0) - 65) : c);
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
    function group2(s, i) {
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
            const [g, j] = group2(s, i);
            i = j;
            math(g, true, shift);
          } else if (m[1] === "mathcal") {
            const [g, j] = group2(s, i);
            i = j;
            push([...g].map(script).join(""), false, shift);
          } else {
            const sym = SYMBOLS[m[1]] ?? m[0];
            push(sym, !upright && /^[a-z]+$/.test(m[1]) && /[α-ω]/.test(sym), shift);
          }
        } else if (c === "_" || c === "^") {
          const [g, j] = group2(s, i + 1);
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
  var circlePoints = ([cx, cy, r]) => Array.from({ length: 181 }, (_, i) => [cx + r * Math.cos(i * Math.PI / 90), cy + r * Math.sin(i * Math.PI / 90)]);
  var toneColor = (tone) => /^[a-z][a-z0-9-]*$/.test(tone) ? `var(--${tone})` : tone;
  var words = (s) => (s ?? "").split(/\s+/).filter(Boolean);
  var GAP = 56;
  function cells(sizes, total, gap) {
    const free = total - gap * (sizes.length - 1), sum = sizes.reduce((a, b) => a + b, 0);
    let at = 0;
    return sizes.map((size) => {
      const cell = [at, free * size / sum];
      at += cell[1] + gap;
      return cell;
    });
  }
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
      // the buttons of the tabs offered by data-plot-tabs, with the index of each tab
      this.tabButtons = [];
      this.offered = [];
      this.boxes = /* @__PURE__ */ new Map();
      this.gated = [];
      this.emphasized = [];
      this.drawers = [];
      // the opacity of the moving marks, below 1 while they are faded at the restart of the loop, and
      // the groups and labels of these marks
      this.fade = 1;
      this.faders = [];
      this.fadeLabels = [];
      // copies of the faders and of their labels at the last frame, faded out at 1 - fade while the next
      // pass is faded in, and the number of the pass of the loop drawn last
      this.held = [];
      this.pass = 0;
      this.eventFrames = [];
      // the ids named in the active list of any tab, which are dimmed while another id is active
      this.emphasis = /* @__PURE__ */ new Set();
      this.shown = /* @__PURE__ */ new Set();
      this.steps = /* @__PURE__ */ new Set();
      this.stepTab = null;
      // a plot whose slide has a fragment with data-plot-play is held until that fragment is shown
      this.cue = "none";
      // the slide of the plot is shown, and the plot may move
      this.live = false;
      this.el = el;
      CACHE2.set(el, this);
      this.load(null);
    }
    /** Draws the plot again from text, or from its block when text is null, e.g. while the editor changes its data. A fault is shown in place of the plot. */
    reload(text = null) {
      this.pause();
      this.spec = null;
      this.W = this.H = 0;
      this.tabButtons = [];
      this.stepTab = null;
      this.load(text);
    }
    load(text) {
      const el = this.el;
      for (const old of el.querySelectorAll(":scope > .plot-body, :scope > .plot-error")) old.remove();
      try {
        const id = el.dataset.plot ?? "";
        const block = id ? document.getElementById(id) : null;
        if (text === null && !block) throw new Error(`the JSON block with the id "${id}" is not found`);
        this.spec = parsePlot(text ?? block?.textContent ?? "");
      } catch (error) {
        const message = `plot ${el.dataset.plot ?? ""}: ${error.message}`;
        const box2 = document.createElement("div");
        box2.className = "plot-error";
        box2.textContent = message;
        el.append(box2);
        console.error(message);
        return;
      }
      const only = words(el.dataset.plotPanels);
      this.panels = only.length ? this.spec.panels.filter((p) => only.includes(p.id)) : this.spec.panels;
      const names = words(el.dataset.plotTabs);
      this.offered = this.spec.tabs.map((_, i) => i).filter((i) => !names.length || names.includes(this.spec.tabs[i].name));
      if (!this.offered.length) this.offered = [0];
      const start2 = this.spec.tabs.findIndex((t) => t.name === el.dataset.plotTab);
      this.tab = start2 >= 0 ? start2 : this.offered[0];
      this.emphasis = new Set(this.spec.tabs.flatMap((t) => t.active?.flat() ?? []));
      this.build();
    }
    get plot() {
      return this.spec;
    }
    get frames() {
      return this.plot.tabs[this.tab].values.length;
    }
    // the seconds of a pass over the frames of the tab shown
    get length() {
      return passLength(this.frames, this.plot.duration, this.plot.tabs[this.tab].times);
    }
    // the seconds into a pass at the fractional frame u of the tab shown, and the inverse
    timeOf(u) {
      return timeAt(u, this.frames, this.plot.duration, this.plot.tabs[this.tab].times);
    }
    frameOf(tau) {
      return frameAt(tau, this.frames, this.plot.duration, this.plot.tabs[this.tab].times);
    }
    build() {
      const plot = this.plot;
      this.body = document.createElement("div");
      this.body.className = "plot-body";
      if (this.offered.length > 1) {
        const bar = document.createElement("div");
        bar.className = "plot-tabs";
        bar.setAttribute("role", "tablist");
        this.tabButtons = this.offered.map((i) => {
          const b = document.createElement("button");
          b.type = "button";
          b.setAttribute("role", "tab");
          setMarkup(b, plot.tabs[i].label);
          b.addEventListener("click", () => {
            b.blur();
            this.setTab(i);
          });
          bar.append(b);
          return { b, i };
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
        this.u = this.frameOf(clamp((ev.clientX - r.left) / r.width, 0, 1) * this.length);
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
      for (const { b, i } of this.tabButtons) b.setAttribute("aria-selected", String(i === this.tab));
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
    // the panels of the tab shown, with the keys that the tab replaces
    panelsNow() {
      const patches = this.plot.tabs[this.tab].panels;
      return this.panels.map((p) => ({ ...p, ...patches[p.id] }));
    }
    layout() {
      const panels = this.panelsNow(), row = (this.plot.layout ?? (this.W >= this.H ? "row" : "column")) === "row";
      const along = cells(panels.map((p) => p.size), row ? this.W : this.H, GAP);
      this.boxes.clear();
      panels.forEach((p, i) => {
        const [at, share] = along[i];
        const cx = row ? at : 0, cy = row ? 0 : at, cw = row ? share : this.W, ch = row ? this.H : share;
        const [top, right, bottom, left] = p.margin;
        let x = cx + left, y = cy + top, w = cw - left - right, h = ch - top - bottom;
        const x0 = scaled(p.x, p.x.range[0]), y0 = scaled(p.y, p.y.range[0]);
        const dx = scaled(p.x, p.x.range[1]) - x0, dy = scaled(p.y, p.y.range[1]) - y0;
        if (p.equal) {
          const s = Math.min(w / dx, h / dy);
          x += (w - s * dx) / 2;
          y += (h - s * dy) / 2;
          w = s * dx;
          h = s * dy;
        }
        this.boxes.set(p.id, { x, y, w, h, x0, y0, sx: w / dx, sy: h / dy, panel: p });
      });
    }
    // the pixel of a coordinate along an axis, i.e. of a value after its scale
    XS(b, x) {
      return b.x + (x - b.x0) * b.sx;
    }
    YS(b, y) {
      return b.y + b.h - (y - b.y0) * b.sy;
    }
    X(b, x) {
      return this.XS(b, scaled(b.panel.x, x));
    }
    Y(b, y) {
      return this.YS(b, scaled(b.panel.y, y));
    }
    // the coordinates of a point of the data, in which the marks are interpolated between frames, so
    // that a mark between two frames is on the straight line drawn between them
    toAxes(b, [x, y]) {
      return [scaled(b.panel.x, x), scaled(b.panel.y, y)];
    }
    path(b, pts) {
      return this.pathS(b, pts.map((p) => this.toAxes(b, p)));
    }
    pathS(b, pts) {
      return pts.map(([x, y], i) => `${i ? "L" : "M"}${this.XS(b, x).toFixed(1)} ${this.YS(b, y).toFixed(1)}`).join("");
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
          const linear2 = p.x.scale === "linear" && p.y.scale === "linear";
          const node = c.circle && linear2 ? svg("ellipse", { ...attrs, cx: this.X(b, c.circle[0]), cy: this.Y(b, c.circle[1]), rx: c.circle[2] * b.sx, ry: c.circle[2] * b.sy }, statics) : svg("path", { ...attrs, d: this.path(b, c.circle ? circlePoints(c.circle) : c.points ?? []) }, statics);
          this.styleItem(node, c, [p.id, c.id]);
        }
        if (p.axes) {
          const axes = svg("g", { class: "plot-axes" }, g);
          svg("path", { d: `M${b.x} ${b.y}V${b.y + b.h}H${b.x + b.w}` }, axes);
          for (const t of p.x.ticks) {
            const X = this.X(b, t.at);
            svg("path", { d: `M${X} ${b.y + b.h}v10` }, axes);
            this.label(t.text, X, b.y + b.h + 32, "middle", "plot-tick", [p.id]);
          }
          for (const t of p.y.ticks) {
            const Y = this.Y(b, t.at);
            svg("path", { d: `M${b.x} ${Y}h-10` }, axes);
            this.label(t.text, b.x - 18, Y, "end", "plot-tick", [p.id]);
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
      this.faders = [];
      this.fadeLabels = [];
      this.held = [];
      const tab = this.plot.tabs[this.tab];
      for (const m of this.plot.marks) {
        const b = this.boxes.get(m.panel), data = tab.data[m.id];
        const g = this.svgEl.querySelector(`.plot-marks[data-panel="${m.panel}"]`);
        if (!b || !g || data === void 0) continue;
        const group2 = svg("g", {}, g);
        this.styleItem(group2, m, [m.panel, m.id]);
        const moving = m.kind === "events" || (m.kind === "label" ? data.at.length > 1 || data.text.length > 1 : (m.kind === "trace" ? data.points : data).length > 1);
        const fader = moving ? svg("g", {}, group2) : group2;
        if (moving) {
          fader.style.transition = "none";
          this.faders.push(fader);
        }
        if (m.kind === "points") {
          const frames = data.map((f) => f.map((v, k) => scaled(k % 2 ? b.panel.y : b.panel.x, v)));
          const dots = [];
          this.drawers.push((u) => {
            const at = framesAt(frames, u);
            while (dots.length < at.length / 2) dots.push(svg("circle", { r: m.size / 2, class: m.hollow ? "plot-hollow" : "plot-dot", "stroke-width": m.width }, fader));
            dots.forEach((d, k) => {
              const on = 2 * k < at.length;
              d.style.display = on ? "" : "none";
              if (on) {
                d.setAttribute("cx", this.XS(b, at[2 * k]).toFixed(1));
                d.setAttribute("cy", this.YS(b, at[2 * k + 1]).toFixed(1));
              }
            });
          });
        } else if (m.kind === "trace") {
          const { points, ghost } = data, pts = points.map((q) => this.toAxes(b, q));
          if (m.ghost && ghost > 0) svg("path", { class: "plot-ghost", d: this.pathS(b, pts.slice(0, ghost + 1)), "stroke-width": m.width }, group2);
          if (fader !== group2) group2.append(fader);
          const done = svg("path", { class: "plot-trace", "stroke-width": m.width }, fader);
          const head = svg("circle", { class: "plot-dot", r: m.size / 2 }, fader);
          this.drawers.push((u) => {
            const p = traceTo(pts, u), [x, y] = p[p.length - 1];
            done.setAttribute("d", this.pathS(b, p));
            head.setAttribute("cx", this.XS(b, x).toFixed(1));
            head.setAttribute("cy", this.YS(b, y).toFixed(1));
          });
        } else if (m.kind === "label") {
          const d = data, at = d.at.map((q) => this.toAxes(b, q));
          const el = this.label(d.text[0], 0, 0, m.anchor, "plot-mark", [m.panel, m.id], m.tone);
          el.classList.add(...m.cls);
          if (moving) this.fadeLabels.push(el);
          let shown = d.text[0];
          this.drawers.push((u) => {
            const [x, y] = at.length === 1 ? at[0] : framesAt(at, u);
            this.place(el, this.XS(b, x) + m.dx, this.YS(b, y) + m.dy, m.anchor);
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
            const ring = svg("circle", { class: "plot-ring", cx: X, cy: Y, r: m.size / 2, "stroke-width": m.width }, fader);
            const text = e.text ? this.label(e.text, X + m.dx, Y + m.dy, m.anchor, "plot-mark", [m.panel, m.id], m.tone) : null;
            text?.classList.add(...m.cls);
            if (text) this.fadeLabels.push(text);
            this.eventFrames.push({ frame: e.frame, names: [m.panel, m.id], tone: m.tone });
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
      for (const f of this.faders) f.style.opacity = this.fade < 1 ? String(this.fade) : "";
      for (const el of this.fadeLabels) el.style.filter = this.fade < 1 ? `opacity(${Math.max(0, 2 * this.fade - 1)})` : "";
      for (const node of this.held) {
        if (node instanceof HTMLElement) node.style.filter = `opacity(${Math.max(0, 1 - 2 * this.fade)})`;
        else node.style.opacity = String(1 - this.fade);
      }
      this.value.textContent = formatNumber(valueAt(tab.values, u), this.plot.parameter.digits);
      const length = this.length;
      const at = `${(length > 0 ? this.timeOf(u) / length : 0) * 100}%`;
      this.fill.style.width = at;
      this.knob.style.left = at;
      if (tab.active) {
        const on = nearest(tab.active, u);
        for (const { node, id } of this.emphasized) {
          node.classList.toggle("plot-on", on.includes(id));
          node.classList.toggle("plot-off", this.emphasis.has(id) && !on.includes(id));
        }
      } else for (const { node } of this.emphasized) node.classList.remove("plot-on", "plot-off");
    }
    // copies the moving marks at the last frame of the tab before the first frame of the next pass is
    // drawn, so that the held frame is faded out while the next pass is faded in
    holdLast() {
      this.release();
      for (const d of this.drawers) d(this.frames - 1);
      for (const node of [...this.faders, ...this.fadeLabels]) {
        const copy = node.cloneNode(true);
        node.before(copy);
        this.held.push(copy);
        const gate = this.gated.find((g) => g.node === node);
        if (gate) this.gated.push({ node: copy, names: gate.names });
      }
    }
    release() {
      if (!this.held.length) return;
      for (const node of this.held) node.remove();
      this.held = [];
      this.gated = this.gated.filter((g) => g.node.isConnected);
    }
    hidden(names) {
      return names.some((s) => this.steps.has(s) && !this.shown.has(s));
    }
    applyGates() {
      for (const { node, names } of this.gated) node.classList.toggle("plot-hidden", this.hidden(names));
      for (const { b, i } of this.tabButtons) {
        const off = this.hidden([this.plot.tabs[i].name]);
        b.classList.toggle("plot-hidden", off);
        b.disabled = off;
      }
      const length = this.length;
      this.ticks.replaceChildren(...this.eventFrames.filter((e) => !this.hidden(e.names)).map((e) => {
        const t = document.createElement("div");
        t.className = "plot-tick-mark";
        t.style.left = `${(length > 0 ? this.timeOf(e.frame) / length : 0) * 100}%`;
        t.style.background = toneColor(e.tone);
        return t;
      }));
    }
    /** Reads the fragments of the slide: the names of data-plot-show, the tab of the last visible data-plot-tab, and the cue of data-plot-play. */
    syncSteps() {
      if (!this.spec) return;
      const slide = this.el.closest("section");
      const frags = slide ? [...slide.querySelectorAll(".fragment")] : [];
      this.steps = new Set(frags.flatMap((f) => words(f.dataset.plotShow)));
      const visible = frags.filter((f) => f.classList.contains("visible"));
      this.shown = new Set(visible.flatMap((f) => words(f.dataset.plotShow)));
      const cues = frags.filter((f) => f.hasAttribute("data-plot-play"));
      const cue = !cues.length ? "none" : cues.some((f) => visible.includes(f)) ? "shown" : "held";
      const tabbed = visible.filter((f) => f.dataset.plotTab).sort((a, b) => +(a.dataset.fragmentIndex ?? 0) - +(b.dataset.fragmentIndex ?? 0));
      const name = tabbed.at(-1)?.dataset.plotTab ?? this.el.dataset.plotTab ?? null;
      let tab = this.tab;
      if (name !== this.stepTab) {
        this.stepTab = name;
        const i = this.plot.tabs.findIndex((t) => t.name === name);
        if (i >= 0) tab = i;
      }
      const cued = cue !== this.cue;
      this.cue = cue;
      if (tab !== this.tab) this.setTab(tab);
      else this.applyGates();
      if (cued && this.live) {
        if (cue === "shown" && this.moves()) {
          this.pause();
          this.u = 0;
          this.play();
        } else this.still();
      }
    }
    /** Shows the tab i, from its first frame while the plot is played, and at its still frame otherwise. */
    setTab(i) {
      if (!this.spec || i === this.tab) return;
      this.tab = i;
      this.markTabs();
      this.u = this.raf ? 0 : this.stillFrame();
      this.t0 = performance.now();
      this.fade = 1;
      this.pass = 0;
      this.release();
      if (!this.W) return;
      this.layout();
      this.drawStatic();
      this.buildMarks();
      this.el.dispatchEvent(new CustomEvent("beeson:plot-drawn", { bubbles: true }));
    }
    /** The frame of a still, from data-plot-frame, where a negative frame is counted from the end. The default is the last frame, which is also the still of a plot whose cue is shown. */
    stillFrame() {
      const f = Number(this.cue === "shown" ? -1 : this.el.dataset.plotFrame ?? -1), n = this.frames;
      return clamp(Number.isFinite(f) ? f < 0 ? n + f : f : n - 1, 0, n - 1);
    }
    /** Draws the still frame, without the animation. */
    still() {
      if (!this.spec) return;
      this.pause();
      this.u = this.stillFrame();
      this.draw();
    }
    moves() {
      return !this.el.hasAttribute("data-plot-paused") && !reduced();
    }
    /** Starts the loop from the first frame as the slide is shown, unless data-plot-paused is set, the motion is reduced, or the cue of the slide is not shown yet. */
    start() {
      if (!this.spec) return;
      this.live = true;
      if (!this.moves() || this.cue === "held") {
        this.still();
        return;
      }
      this.u = 0;
      this.play();
    }
    /** Stops the loop as the slide is left. */
    leave() {
      this.live = false;
      this.pause();
    }
    play() {
      if (!this.spec || this.raf) return;
      if (this.u >= this.frames - 1) this.u = 0;
      this.t0 = performance.now() - this.timeOf(this.u) * 1e3;
      this.pass = 0;
      const tick = (now) => {
        const t = (now - this.t0) / 1e3, { duration, hold, fade } = this.plot, length = this.length;
        const pass = length + hold > 0 ? Math.floor(t / (length + hold)) : 0;
        if (pass !== this.pass) {
          this.pass = pass;
          if (fade > 0) this.holdLast();
        }
        this.u = loopFrame(t, this.frames, duration, hold, this.plot.tabs[this.tab].times);
        this.fade = loopFade(t, length, hold, fade);
        if (this.fade >= 1) this.release();
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
      if (this.fade < 1 || this.held.length) {
        this.fade = 1;
        this.release();
        this.draw();
      }
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
  var written = /* @__PURE__ */ new WeakSet();
  function markViewers() {
    document.querySelectorAll("tycho-viewer").forEach((viewer, i) => {
      viewer.setAttribute("data-still", String(i));
      written.add(viewer);
    });
  }
  function box(viewer) {
    const still3 = document.createElement("div");
    still3.className = viewer.className;
    still3.style.cssText = viewer.style.cssText;
    viewer.replaceWith(still3);
    return still3;
  }
  async function still(viewer) {
    const failed = () => viewer.shadowRoot?.querySelector(".status.error");
    while (!viewer.renderer && !failed()) await sleep(50);
    if (!viewer.canvas || !viewer.renderer) return null;
    viewer.pause();
    viewer.draw();
    const image = new Image();
    image.src = viewer.canvas.toDataURL("image/png");
    image.alt = "A still of a tycho scene";
    const host = viewer.getBoundingClientRect();
    const canvas = viewer.canvas.getBoundingClientRect();
    const scale = host.width / (viewer.offsetWidth || 1);
    const px = (n) => `${Math.round(n / scale)}px`;
    image.style.cssText = `position: absolute; left: ${px(canvas.left - host.left)}; top: ${px(canvas.top - host.top)}; width: ${px(canvas.width)}; height: ${px(canvas.height)}; object-fit: fill`;
    return image;
  }
  async function stillViewers() {
    const viewers = [];
    const clones = /* @__PURE__ */ new Map();
    for (const viewer of document.querySelectorAll("tycho-viewer")) {
      const id = viewer.dataset.still;
      if (id === void 0 || written.has(viewer)) viewers.push(viewer);
      else clones.set(id, [...clones.get(id) ?? [], box(viewer)]);
    }
    for (const viewer of viewers) {
      const image = await still(viewer);
      if (image === null) continue;
      box(viewer).append(image);
      for (const clone of clones.get(viewer.dataset.still ?? "") ?? []) clone.append(image.cloneNode());
    }
  }

  // src/qr.ts
  var ECC = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
  var BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
  var LEVEL_BITS = 0;
  var QUIET = 4;
  function dataModules(version) {
    const size = 4 * version + 17;
    let n = size * size - 3 * 64 - 2 * (size - 16) - 31;
    if (version >= 2) {
      const k = Math.floor(version / 7) + 2;
      n -= 25 * (k * k - 3) - 10 * (k - 2);
    }
    if (version >= 7) n -= 36;
    return n;
  }
  var dataCodewords = (version) => Math.floor(dataModules(version) / 8) - ECC[version - 1] * BLOCKS[version - 1];
  var capacity = (version) => Math.floor((dataCodewords(version) * 8 - 4 - (version < 10 ? 8 : 16)) / 8);
  function alignment(version) {
    if (version === 1) return [];
    const k = Math.floor(version / 7) + 2;
    const last = 4 * version + 10;
    const step2 = version === 32 ? 26 : Math.ceil((last - 6) / (k - 1) / 2) * 2;
    const out = [6];
    for (let i = k - 2; i >= 0; i--) out.push(last - i * step2);
    return out;
  }
  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) {
    EXP[i] = EXP[i + 255] = x;
    LOG[x] = i;
    x = x << 1 ^ (x & 128 ? 285 : 0);
  }
  var mul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;
  function generator(n) {
    let g = new Uint8Array([1]);
    for (let i = 0; i < n; i++) {
      const next = new Uint8Array(g.length + 1);
      for (let j = 0; j < g.length; j++) {
        next[j] ^= g[j];
        next[j + 1] ^= mul(g[j], EXP[i]);
      }
      g = next;
    }
    return g.subarray(1);
  }
  function remainder(data, g) {
    const r = new Uint8Array(g.length);
    for (const byte of data) {
      const factor = byte ^ r[0];
      r.copyWithin(0, 1);
      r[r.length - 1] = 0;
      for (let i = 0; i < g.length; i++) r[i] ^= mul(g[i], factor);
    }
    return r;
  }
  function codewords(bytes, version) {
    const bits = [];
    const put = (value, n) => {
      for (let i = n - 1; i >= 0; i--) bits.push(value >>> i & 1);
    };
    put(4, 4);
    put(bytes.length, version < 10 ? 8 : 16);
    for (const b of bytes) put(b, 8);
    const total = dataCodewords(version) * 8;
    put(0, Math.min(4, total - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (let pad = 236; bits.length < total; pad ^= 236 ^ 17) put(pad, 8);
    const out = new Uint8Array(total / 8);
    for (let i = 0; i < bits.length; i++) out[i >>> 3] |= bits[i] << 7 - (i & 7);
    return out;
  }
  function interleave(data, version) {
    const n = BLOCKS[version - 1], ecc = ECC[version - 1];
    const total = Math.floor(dataModules(version) / 8);
    const short = Math.floor(total / n) - ecc;
    const shortBlocks = n - total % n;
    const g = generator(ecc);
    const blocks = [];
    const checks = [];
    for (let i = 0, at = 0; i < n; i++) {
      const len = short + (i < shortBlocks ? 0 : 1);
      blocks.push(data.subarray(at, at + len));
      checks.push(remainder(data.subarray(at, at + len), g));
      at += len;
    }
    const out = [];
    for (let i = 0; i <= short; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
    for (let i = 0; i < ecc; i++) for (const c of checks) out.push(c[i]);
    return new Uint8Array(out);
  }
  function bch(data, bits, poly) {
    const degree = 31 - Math.clz32(poly);
    let r = data << degree;
    for (let i = bits + degree - 1; i >= degree; i--) if (r >>> i & 1) r ^= poly << i - degree;
    return data << degree | r;
  }
  var MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (_, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => r * c % 2 + r * c % 3 === 0,
    (r, c) => (r * c % 2 + r * c % 3) % 2 === 0,
    (r, c) => ((r + c) % 2 + r * c % 3) % 2 === 0
  ];
  var Grid = class {
    constructor(size) {
      this.size = size;
      this.dark = Array.from({ length: size }, () => new Array(size).fill(false));
      this.fixed = Array.from({ length: size }, () => new Array(size).fill(false));
    }
    set(r, c, dark) {
      if (r < 0 || c < 0 || r >= this.size || c >= this.size) return;
      this.dark[r][c] = dark;
      this.fixed[r][c] = true;
    }
  };
  function functionPatterns(grid, version) {
    const n = grid.size;
    for (const [r0, c0] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const d = Math.max(Math.abs(r - 3), Math.abs(c - 3));
          grid.set(r0 + r, c0 + c, d !== 2 && d !== 4);
        }
      }
    }
    for (let i = 8; i < n - 8; i++) {
      grid.set(6, i, i % 2 === 0);
      grid.set(i, 6, i % 2 === 0);
    }
    const centers = alignment(version);
    const last = centers.length - 1;
    for (const [i, r] of centers.entries()) {
      for (const [j, c] of centers.entries()) {
        if (i === 0 && (j === 0 || j === last) || i === last && j === 0) continue;
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) grid.set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
      }
    }
    format(grid, 0);
    if (version >= 7) {
      const bits = bch(version, 6, 7973);
      for (let i = 0; i < 18; i++) {
        const on = (bits >>> i & 1) === 1;
        const a = n - 11 + i % 3, b = Math.floor(i / 3);
        grid.set(a, b, on);
        grid.set(b, a, on);
      }
    }
  }
  function format(grid, mask) {
    const n = grid.size;
    const bits = bch(LEVEL_BITS << 3 | mask, 5, 1335) ^ 21522;
    const bit = (i) => (bits >>> i & 1) === 1;
    for (let i = 0; i <= 5; i++) grid.set(i, 8, bit(i));
    grid.set(7, 8, bit(6));
    grid.set(8, 8, bit(7));
    grid.set(8, 7, bit(8));
    for (let i = 9; i < 15; i++) grid.set(8, 14 - i, bit(i));
    for (let i = 0; i < 8; i++) grid.set(8, n - 1 - i, bit(i));
    for (let i = 8; i < 15; i++) grid.set(n - 15 + i, 8, bit(i));
    grid.set(n - 8, 8, true);
  }
  function place(grid, data) {
    const n = grid.size;
    let i = 0;
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      const up = (right + 1 & 2) === 0;
      for (let k = 0; k < n; k++) {
        const r = up ? n - 1 - k : k;
        for (const c of [right, right - 1]) {
          if (grid.fixed[r][c]) continue;
          grid.dark[r][c] = i < data.length * 8 && (data[i >>> 3] >>> 7 - (i & 7) & 1) === 1;
          i++;
        }
      }
    }
  }
  function applyMask(grid, mask) {
    const m = MASKS[mask];
    for (let r = 0; r < grid.size; r++) for (let c = 0; c < grid.size; c++) if (!grid.fixed[r][c] && m(r, c)) grid.dark[r][c] = !grid.dark[r][c];
  }
  function penalty(dark) {
    const n = dark.length;
    let score = 0;
    const finder = [true, false, true, true, true, false, true];
    for (let pass = 0; pass < 2; pass++) {
      const at = (a, b) => pass === 0 ? dark[a][b] : dark[b][a];
      for (let a = 0; a < n; a++) {
        let run = 1;
        for (let b = 1; b <= n; b++) {
          if (b < n && at(a, b) === at(a, b - 1)) run++;
          else {
            if (run >= 5) score += run - 2;
            run = 1;
          }
        }
        for (let b = 0; b + 7 <= n; b++) {
          if (!finder.every((v, k) => at(a, b + k) === v)) continue;
          const light = (from) => {
            for (let k = from; k < from + 4; k++) if (k >= 0 && k < n && at(a, k)) return false;
            return true;
          };
          if (light(b - 4) || light(b + 7)) score += 40;
        }
      }
    }
    let count = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (dark[r][c]) count++;
        if (r + 1 < n && c + 1 < n && dark[r][c] === dark[r][c + 1] && dark[r][c] === dark[r + 1][c] && dark[r][c] === dark[r + 1][c + 1]) score += 3;
      }
    }
    score += 10 * Math.floor(Math.abs(count * 100 / (n * n) - 50) / 5);
    return score;
  }
  function encode(text) {
    const bytes = new TextEncoder().encode(text);
    let version = 1;
    while (version <= 40 && capacity(version) < bytes.length) version++;
    if (version > 40) throw new Error(`the text is ${bytes.length} bytes long, and a QR code at level M holds at most ${capacity(40)}`);
    const data = interleave(codewords(bytes, version), version);
    let best = null, bestMask = 0, bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const grid2 = new Grid(4 * version + 17);
      functionPatterns(grid2, version);
      place(grid2, data);
      applyMask(grid2, mask);
      format(grid2, mask);
      const score = penalty(grid2.dark);
      if (score < bestScore) {
        best = grid2;
        bestMask = mask;
        bestScore = score;
      }
    }
    const grid = best;
    return { version, size: grid.size, mask: bestMask, dark: grid.dark };
  }
  var SVG2 = "http://www.w3.org/2000/svg";
  function svgOf(code, label) {
    const side = code.size + 2 * QUIET;
    const svg2 = document.createElementNS(SVG2, "svg");
    svg2.setAttribute("viewBox", `0 0 ${side} ${side}`);
    svg2.setAttribute("shape-rendering", "crispEdges");
    svg2.setAttribute("role", "img");
    svg2.setAttribute("aria-label", label);
    const tile = document.createElementNS(SVG2, "rect");
    tile.setAttribute("class", "qr-tile");
    tile.setAttribute("width", String(side));
    tile.setAttribute("height", String(side));
    tile.setAttribute("rx", String(+(side * 0.03).toFixed(2)));
    tile.setAttribute("fill", "#fff");
    tile.setAttribute("shape-rendering", "geometricPrecision");
    let d = "";
    code.dark.forEach((row, r) => {
      for (let c = 0; c < code.size; c++) {
        if (!row[c]) continue;
        const start2 = c;
        while (c + 1 < code.size && row[c + 1]) c++;
        d += `M${start2 + QUIET} ${r + QUIET}h${c - start2 + 1}v1h${start2 - c - 1}z`;
      }
    });
    const ink = document.createElementNS(SVG2, "path");
    ink.setAttribute("class", "qr-ink");
    ink.setAttribute("d", d);
    ink.setAttribute("fill", "#000");
    svg2.append(tile, ink);
    return svg2;
  }
  function mountQr(root2) {
    const own = root2 instanceof HTMLElement && root2.matches(".qr[data-qr]") ? [root2] : [];
    for (const el of [...own, ...root2.querySelectorAll(".qr[data-qr]")]) {
      if (el.querySelector(":scope > svg, :scope > .qr-error")) continue;
      const text = el.dataset.qr ?? "";
      try {
        if (!text) throw new Error("data-qr is empty");
        el.append(svgOf(encode(text), `QR code of ${text}`));
      } catch (error) {
        const box2 = document.createElement("div");
        box2.className = "qr-error";
        box2.textContent = `QR code: ${error.message}`;
        el.append(box2);
      }
    }
  }

  // src/scrub.ts
  function minutes(seconds) {
    const s = Math.max(0, Math.round(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
  function starts(timings, config) {
    const { totalTime } = config;
    if (config.defaultTiming == null && totalTime == null) return null;
    const fallback = totalTime ? 0 : config.defaultTiming ?? 0;
    let own = timings.map((t2) => {
      const n = t2 === void 0 ? NaN : parseInt(t2, 10);
      return Number.isNaN(n) ? fallback : n;
    });
    if (totalTime) {
      const open2 = own.filter((x) => x === 0).length;
      const share = open2 ? Math.round((totalTime - own.reduce((a, b) => a + b, 0)) / open2) : 0;
      own = own.map((x) => x === 0 ? share : x);
    }
    let t = 0;
    return own.map((x) => {
      const at = t;
      t += x;
      return at;
    });
  }
  var GAP2 = 3.2;
  var REACH2 = 48;
  function initScrub(deck) {
    const reveal = deck.getRevealElement();
    const band = document.createElement("div");
    band.className = "scrub";
    band.setAttribute("aria-hidden", "true");
    const track = document.createElement("div");
    track.className = "scrub-track";
    const fill2 = document.createElement("span");
    track.append(fill2);
    const card = document.createElement("div");
    card.className = "scrub-card";
    band.append(track, card);
    reveal.append(band);
    let ticks = [];
    let hovered = null;
    let open2 = false;
    let zone = band.getBoundingClientRect();
    const build = () => {
      for (const t of ticks) t.el.remove();
      const slides = deck.getSlides();
      const last = Math.max(1, deck.getTotalSlides() - 1);
      const times = starts(slides.map((s) => s.dataset.timing), deck.getConfig());
      ticks = slides.map((slide, i) => {
        const at = Math.min(deck.getSlidePastCount(slide) / last, 1);
        const el = document.createElement("div");
        el.className = "scrub-tick";
        el.style.left = `${at * 100}%`;
        if (i === 0) el.classList.add("first");
        if (i === slides.length - 1 && slides.length > 1) el.classList.add("last");
        const number = document.createElement("span");
        number.textContent = String(deck.getSlidePastCount(slide) + 1);
        el.append(number);
        if (times) {
          const time = document.createElement("span");
          time.className = "scrub-time";
          time.textContent = minutes(times[i]);
          el.append(time);
        }
        band.append(el);
        return { slide, at, el };
      });
    };
    const thin = () => {
      zone = band.getBoundingClientRect();
      const em = parseFloat(getComputedStyle(band).fontSize) || 16;
      const spacing = zone.width / Math.max(1, ticks.length - 1);
      const k = Math.max(1, Math.ceil(GAP2 * em / spacing));
      ticks.forEach((t, i) => t.el.classList.toggle("quiet", i % k !== 0 && i !== ticks.length - 1));
    };
    const mark = () => {
      fill2.style.transform = `scaleX(${deck.getTotalSlides() < 2 ? 0 : deck.getProgress()})`;
      const current = deck.getCurrentSlide();
      for (const t of ticks) t.el.classList.toggle("now", t.slide === current);
    };
    const hover = (t) => {
      if (t === hovered) return;
      hovered?.el.classList.remove("hover");
      hovered = t;
      if (!t) {
        card.textContent = "";
        return;
      }
      t.el.classList.add("hover");
      card.textContent = heading(t.slide);
      const half = card.offsetWidth / 2;
      const x = Math.min(Math.max(t.at * zone.width, half), zone.width - half);
      card.style.left = `${x}px`;
    };
    const show2 = (on) => {
      if (on === open2) return;
      open2 = on;
      if (on) {
        build();
        thin();
        mark();
      } else hover(null);
      reveal.classList.toggle("scrubbing", on);
    };
    const nearest2 = (x) => {
      const at = (x - zone.left) / zone.width;
      let best = ticks[0] ?? null;
      for (const t of ticks) if (Math.abs(t.at - at) < Math.abs((best?.at ?? 0) - at)) best = t;
      return best;
    };
    document.addEventListener("pointermove", (ev) => {
      if (ev.pointerType !== "mouse" && ev.pointerType !== "pen") return;
      const top = open2 ? zone.top : zone.bottom - REACH2;
      const near = ev.clientY >= top && ev.clientY <= zone.bottom && ev.clientX >= zone.left && ev.clientX <= zone.right;
      show2(near);
      if (near) hover(nearest2(ev.clientX));
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => show2(false));
    document.addEventListener("keydown", () => show2(false), true);
    band.addEventListener("click", (ev) => {
      const t = nearest2(ev.clientX);
      if (!t) return;
      const { h, v } = deck.getIndices(t.slide);
      deck.slide(h, v, -1);
    });
    for (const event of ["slidechanged", "fragmentshown", "fragmenthidden"]) deck.on(event, () => {
      if (open2) mark();
    });
    deck.on("resize", () => {
      zone = band.getBoundingClientRect();
      if (open2) thin();
    });
  }

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

  // src/surfaces.ts
  var RAMPS = {
    blues: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c", "#08306b"],
    reds: ["#fff5f0", "#fee0d2", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#a50f15", "#67000d"],
    magma_r: ["#fcfdbf", "#fdda9c", "#feb67c", "#fc9065", "#f56b5c", "#e24d66", "#c43c75", "#a3307e", "#832681", "#641a80"]
  };
  var num2 = (value, fallback) => value !== void 0 && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : fallback;
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
  var GRAVITATIONAL = { ramp: "blues", range: [-3, -1.5] };
  var CENTRIFUGAL = { ramp: "reds", range: [-3, -1.5] };
  var EFFECTIVE = { ramp: "magma_r", range: [-3, -1.5] };
  var BOWL_LIFT = 4;
  var FUNCTIONS = {
    // the effective potential of the CR3BP at data-mu, assembled from its wells and its bowl, with the
    // libration points marked and a cut at the height -C/2 of the Jacobi constant C of data-C. the
    // bowl is shown above the wells, and the two are merged into their sum at the next stage. the
    // intersection of the plane with the surface is the zero-velocity curve, and Hill's region is
    // where the surface is under the plane. C is the value at L1 when data-C is not given
    "effective-potential": (attributes) => {
      const mu = num2(attributes.mu, 0.05);
      const { wells, bowl, sum } = effectivePotential(mu);
      const marks = librationPoints(mu);
      const C1 = -2 * sum(marks[0].x, 0);
      const one = (layer) => [{ layer, lift: 0 }];
      const plain = (layer) => () => ({ sheets: one(layer), marks: false, level: null });
      return {
        x: [-1.5, 1.5],
        y: [-1.5, 1.5],
        floor: -3.2,
        zscale: 1,
        layers: { flat: () => 0, wells, bowl, sum },
        tones: { flat: GRAVITATIONAL, wells: GRAVITATIONAL, bowl: CENTRIFUGAL, sum: EFFECTIVE },
        marks,
        initial: "flat",
        stages: {
          flat: plain("flat"),
          wells: plain("wells"),
          bowl: () => ({ sheets: [{ layer: "wells", lift: 0 }, { layer: "bowl", lift: BOWL_LIFT }], marks: false, level: null }),
          sum: plain("sum"),
          extrema: () => ({ sheets: one("sum"), marks: true, level: null }),
          cut: (a) => ({ sheets: one("sum"), marks: true, level: -num2(a.c, C1) / 2 })
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
  var CURVE_WIDTH = 3.5;
  var GLOW_WIDTH = 18;
  var MARK_SIZE = 22;
  var BEHIND = 0.3;
  var DIMMING = 0.12;
  var UNLIT = 0.18;
  var MARK_FADE = 0.15;
  var RAMP_TEXELS = 256;
  var ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  var lerp = (a, b, t) => a + (b - a) * t;
  var clamp2 = (v, a, b) => Math.min(b, Math.max(a, v));
  var num3 = (v, fallback) => v !== void 0 && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : fallback;
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
  function rampTexels(stops) {
    const out = new Uint8Array(4 * RAMP_TEXELS);
    for (let i = 0; i < RAMP_TEXELS; i++) {
      const p = i / (RAMP_TEXELS - 1) * (stops.length - 1), j = Math.min(stops.length - 2, Math.floor(p));
      const c = mix3(stops[j], stops[j + 1], p - j);
      out.set([...c.map((v) => Math.round(255 * v)), 255], 4 * i);
    }
    return out;
  }
  function heightAt(g, fn, x, y) {
    const n = CELLS + 1;
    const u = clamp2((x - fn.x[0]) / (fn.x[1] - fn.x[0]) * CELLS, 0, CELLS), v = clamp2((y - fn.y[0]) / (fn.y[1] - fn.y[0]) * CELLS, 0, CELLS);
    const i = Math.min(CELLS - 1, Math.floor(u)), j = Math.min(CELLS - 1, Math.floor(v)), s = u - i, t = v - j;
    const a = g[j * n + i], b = g[j * n + i + 1], c = g[(j + 1) * n + i], d = g[(j + 1) * n + i + 1];
    return s >= t ? a + s * (b - a) + t * (d - b) : a + t * (c - a) + s * (d - c);
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
uniform sampler2D uRampA;
uniform sampler2D uRampB;
uniform vec2 uRangeA;
uniform vec2 uRangeB;
uniform float uTone;
uniform float uAlpha;
uniform vec3 uGroove;
uniform vec3 uLight;
uniform vec2 uGrid;
varying vec3 vNormal;
varying vec2 vXY;
varying float vZ;
vec3 ramp(sampler2D r, vec2 range) {
  float t = clamp((vZ - range.x) / max(range.y - range.x, 1e-6), 0.0, 1.0);
  return texture2D(r, vec2((t * ${RAMP_TEXELS - 1}.0 + 0.5) / ${RAMP_TEXELS}.0, 0.5)).rgb;
}
void main() {
  vec3 c = mix(ramp(uRampA, uRangeA), ramp(uRampB, uRangeB), uTone);
  c *= 0.58 + 0.42 * abs(dot(normalize(vNormal), uLight));
  vec2 q = vXY / uGrid;
  vec2 a = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), vec2(1e-4));
  c = mix(c, uGroove, 0.45 * (1.0 - min(min(a.x, a.y), 1.0)));
  gl_FragColor = vec4(c, uAlpha);
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
attribute float seen;
attribute float lit;
attribute vec3 fill;
uniform float uRise;
uniform float uSize;
varying float vKind;
varying float vSeen;
varying vec3 vFill;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * (0.35 + 0.65 * uRise);
  vKind = kind;
  vSeen = seen * lit;
  vFill = fill;
}`
  );
  var MARK_FRAGMENT = (
    /* glsl */
    `
uniform vec3 uRing;
uniform float uRise;
uniform float uSize;
varying float vKind;
varying float vSeen;
varying vec3 vFill;
void main() {
  float r = length(gl_PointCoord * 2.0 - 1.0);
  float aa = 2.0 / uSize;
  float outer = 1.0 - smoothstep(1.0 - aa, 1.0, r);
  if (outer <= 0.0) discard;
  float fill = 1.0 - smoothstep(0.7 - aa, 0.7, r);
  if (vKind < 0.5) fill *= smoothstep(0.36 - aa, 0.36, r);
  gl_FragColor = vec4(mix(uRing, vFill, fill), outer * uRise * vSeen);
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
  var CACHE3 = /* @__PURE__ */ new WeakMap();
  var Surface = class {
    constructor(el, fn, THREE) {
      this.grids = /* @__PURE__ */ new Map();
      this.normals = /* @__PURE__ */ new WeakMap();
      this.ranges = /* @__PURE__ */ new Map();
      this.textures = /* @__PURE__ */ new Map();
      this.zeros = new Float64Array((CELLS + 1) ** 2);
      this.zmin = 0;
      this.zmax = 0;
      this.sheets = [];
      this.palette = { text: [0.95, 0.95, 0.94], accent: [0.94, 0.5, 0.31], violet: [0.79, 0.31, 0.9] };
      this.markKey = "";
      this.seenAt = 0;
      this.capacity = 0;
      this.drawn = "";
      this.mix = 1;
      this.stageName = "";
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
          const late = ease(clamp2((k - 0.35) / 0.65, 0, 1)), early = ease(clamp2(k / 0.65, 0, 1));
          this.mix = e;
          this.shown = { marks: lerp(a.marks, b.marks, b.marks > a.marks ? late : early), cut: lerp(a.cut, b.cut, e), level: lerp(a.level, b.level, e), low: lerp(a.low, b.low, e), high: lerp(a.high, b.high, e) };
          for (const s of this.sheets) {
            s.shown = { lift: lerp(s.from.lift, s.to.lift, e), alpha: lerp(s.from.alpha, s.to.alpha, s.to.alpha > s.from.alpha ? early : late) };
            s.tone = lerp(s.toneFrom, 1, e);
          }
          if (k >= 1) this.settle();
        }
        if (this.rate && !this.drag && now > this.resume) this.azimuth += dt * this.rate;
        this.draw();
        if (this.moving || this.rate || !this.marksSettled()) this.kick();
      };
      this.el = el;
      this.fn = fn;
      this.THREE = THREE;
      this.groove = new THREE.Vector3();
      this.zscale = num3(el.dataset.zscale, fn.zscale);
      const turn = num3(el.dataset.turn, TURN);
      this.rate = turn > 0 ? 2 * Math.PI / turn : 0;
      this.azimuth = num3(el.dataset.azimuth, -60) * Math.PI / 180;
      this.elevation = num3(el.dataset.elevation, 32) * Math.PI / 180;
      this.zoom = num3(el.dataset.zoom, 1);
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
      this.markA = new Float64Array(fn.marks.length);
      this.markB = new Float64Array(fn.marks.length);
      this.seen = new Float32Array(fn.marks.length).fill(1);
      this.lit = new Float32Array(fn.marks.length).fill(1);
      this.litTo = new Float32Array(fn.marks.length).fill(1);
      this.fill = new Float32Array(3 * fn.marks.length);
      this.fillTo = new Float32Array(3 * fn.marks.length);
      this.markTones = fn.marks.map(() => "text");
      const still3 = { marks: 0, cut: 0, level: fn.floor, low: this.zmin * this.zscale, high: this.zmax * this.zscale };
      this.shown = this.from = this.to = still3;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
      this.camera.up.set(0, 0, 1);
      this.plane = this.makePlane();
      this.curve = this.makeCurve(CURVE_WIDTH, 0);
      this.glow = this.makeCurve(GLOW_WIDTH, 1);
      this.glow.geometry = this.curve.geometry;
      this.glow.renderOrder = 1.5;
      this.points = this.makeMarks();
      this.scene.add(this.plane, this.glow, this.curve, this.points);
      this.recolor();
      this.bindDrag();
      CACHE3.set(el, this);
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
    // the texture of a ramp of RAMPS, or of the ramp theme, which is filled in recolor()
    texture(name) {
      const known = this.textures.get(name);
      if (known) return known;
      const THREE = this.THREE;
      const t = new THREE.DataTexture(new Uint8Array(4 * RAMP_TEXELS), RAMP_TEXELS, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
      t.magFilter = t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      const stops = RAMPS[name];
      if (stops) {
        t.image.data.set(rampTexels(stops.map((c) => rgb(c, [0.5, 0.5, 0.5]))));
        t.needsUpdate = true;
      }
      this.textures.set(name, t);
      return t;
    }
    // the ramp of a layer and its range in world units. an unknown ramp is reported, and the ramp
    // theme is drawn in its place
    paintOf(layer) {
      let { ramp: ramp2, range } = this.fn.tones[layer] ?? { ramp: "theme" };
      if (ramp2 !== "theme" && !(ramp2 in RAMPS)) {
        console.error(`beeson: unknown ramp "${ramp2}" of the layer ${layer} of ${this.el.dataset.function}, known: theme, ${Object.keys(RAMPS).join(", ")}`);
        ramp2 = "theme";
      }
      const world = range ? [range[0] * this.zscale, range[1] * this.zscale] : this.ranges.get(layer) ?? [-1, 1];
      return { key: `${ramp2}|${world.join("|")}`, texture: this.texture(ramp2), range: world };
    }
    // a sheet, made hidden on first use. the sheets are drawn in their order, before the plane
    sheet(i) {
      if (this.sheets[i]) return this.sheets[i];
      const THREE = this.THREE, n = CELLS + 1, fn = this.fn;
      const position = new Float32Array(3 * n * n);
      const dx = (fn.x[1] - fn.x[0]) / CELLS, dy = (fn.y[1] - fn.y[0]) / CELLS;
      for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
        position[3 * (j * n + k)] = fn.x[0] + k * dx;
        position[3 * (j * n + k) + 1] = fn.y[0] + j * dy;
      }
      const index = new Uint32Array(6 * CELLS * CELLS);
      let m = 0;
      for (let j = 0; j < CELLS; j++) for (let k = 0; k < CELLS; k++) {
        const a = j * n + k, b = a + 1, c = a + n, d = c + 1;
        index.set([a, b, d, a, d, c], m);
        m += 6;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
      for (const [name, size] of [["zA", 1], ["zB", 1], ["nA", 3], ["nB", 3]]) {
        geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(size * n * n), size).setUsage(THREE.DynamicDrawUsage));
      }
      geometry.setIndex(new THREE.BufferAttribute(index, 1));
      const cell = Math.max(fn.x[1] - fn.x[0], fn.y[1] - fn.y[0]) / 24;
      const paint = this.paintOf(fn.initial);
      const uniforms = {
        uMix: { value: 1 },
        uRampA: { value: paint.texture },
        uRampB: { value: paint.texture },
        uRangeA: { value: new THREE.Vector2(...paint.range) },
        uRangeB: { value: new THREE.Vector2(...paint.range) },
        uTone: { value: 1 },
        uAlpha: { value: 1 },
        uGroove: { value: this.groove },
        uLight: { value: new THREE.Vector3(-0.45, -0.35, 0.82).normalize() },
        uGrid: { value: new THREE.Vector2(cell, cell) }
      };
      const material = (colorWrite) => new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERTEX,
        fragmentShader: SURFACE_FRAGMENT,
        side: THREE.DoubleSide,
        transparent: true,
        colorWrite,
        uniforms
      });
      const mesh = new THREE.Mesh(geometry, material(true)), depth = new THREE.Mesh(geometry, material(false));
      const group2 = new THREE.Group();
      for (const [k, o] of [depth, mesh].entries()) {
        o.frustumCulled = false;
        o.renderOrder = i * 0.1 + k * 0.01;
        group2.add(o);
      }
      group2.visible = false;
      this.scene.add(group2);
      const hidden = { lift: 0, alpha: 0 };
      const s = { group: group2, mesh, depth, layer: "", A: this.zeros, B: this.zeros, from: hidden, to: hidden, shown: hidden, paintA: paint, paintB: paint, toneFrom: 1, tone: 1, now: null };
      this.sheets[i] = s;
      return s;
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
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3 * marks.length), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute("kind", new THREE.BufferAttribute(Float32Array.from(marks, (m) => m.kind === "saddle" ? 0 : 1), 1));
      geometry.setAttribute("seen", new THREE.BufferAttribute(new Float32Array(marks.length).fill(1), 1).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute("lit", new THREE.BufferAttribute(new Float32Array(marks.length).fill(1), 1).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute("fill", new THREE.BufferAttribute(new Float32Array(3 * marks.length), 3).setUsage(THREE.DynamicDrawUsage));
      const material = new THREE.ShaderMaterial({
        vertexShader: MARK_VERTEX,
        fragmentShader: MARK_FRAGMENT,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uRing: { value: new THREE.Vector3() },
          uRise: { value: 0 },
          uSize: { value: MARK_SIZE }
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
      const set2 = (target, c) => target.set(c[0], c[1], c[2]);
      const theme = this.texture("theme");
      theme.image.data.set(rampTexels([mix3(blue, bg, 0.7), mix3(blue, violet, 0.35), violet, mix3(violet, text, 0.55)]));
      theme.needsUpdate = true;
      set2(this.groove, bg);
      set2(this.plane.material.uniforms.uColor.value, accent);
      set2(this.curve.material.uniforms.uColor.value, mix3(accent, text, 0.35));
      set2(this.glow.material.uniforms.uColor.value, accent);
      set2(this.points.material.uniforms.uRing.value, bg);
      this.palette = { text, accent, violet };
      this.paintMarks();
      this.fill.set(this.fillTo);
    }
    // the stage set by the visible fragment of the slide with data-surface-stage and the highest
    // fragment index, or the data-stage of the element, or the initial stage of the function
    target() {
      let best = null, index = -Infinity;
      for (const f of this.el.closest("section")?.querySelectorAll(".fragment.visible[data-surface-stage]") ?? []) {
        const i = num3(f.dataset.fragmentIndex, 0);
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
      return { name, stage: this.fn.stages[name]({ ...this.el.dataset, ...best?.dataset }), step: best };
    }
    // the ramp p set as the end of a change of the sheet s. a ramp drawn at the start is kept, so
    // that the colors drawn now are not changed at once when a change is reversed or redirected
    repaint(s, p) {
      if (p.key === s.paintB.key) s.toneFrom = s.tone;
      else if (p.key === s.paintA.key) {
        s.paintA = s.paintB;
        s.toneFrom = 1 - s.tone;
        s.paintB = p;
      } else {
        s.paintA = s.tone < 0.5 ? s.paintA : s.paintB;
        s.paintB = p;
        s.toneFrom = 0;
      }
      const u = s.mesh.material.uniforms;
      u.uRampA.value = s.paintA.texture;
      u.uRampB.value = s.paintB.texture;
      u.uRangeA.value.set(...s.paintA.range);
      u.uRangeB.value.set(...s.paintB.range);
    }
    // the targets of the opacity and the color of the marks at the step: every mark is lit without
    // data-surface-marks, and a mark is filled in the color of the text unless it is named by
    // data-surface-accent or data-surface-violet
    markTargets(step2) {
      const names = (key) => (step2?.dataset[key] ?? "").split(/[\s,]+/).filter(Boolean);
      const lit = names("surfaceMarks"), accent = names("surfaceAccent"), violet = names("surfaceViolet");
      this.fn.marks.forEach((m, i) => {
        this.litTo[i] = !lit.length || lit.includes(m.name) ? 1 : UNLIT;
        this.markTones[i] = violet.includes(m.name) ? "violet" : accent.includes(m.name) ? "accent" : "text";
      });
      this.paintMarks();
      return JSON.stringify([lit, accent, violet]);
    }
    paintMarks() {
      this.markTones.forEach((tone, i) => this.fillTo.set(this.palette[tone], 3 * i));
    }
    marksSettled() {
      for (let i = 0; i < this.lit.length; i++) if (Math.abs(this.lit[i] - this.litTo[i]) > 1e-3) return false;
      for (let i = 0; i < this.fill.length; i++) if (Math.abs(this.fill[i] - this.fillTo[i]) > 1e-3) return false;
      return true;
    }
    /** Sets the stage from the fragments of the slide, animated or at once. */
    sync(animate) {
      const { name, stage, step: step2 } = this.target();
      const markKey = this.markTargets(step2);
      const jump = !animate || !this.stageName;
      if (jump) {
        this.lit.set(this.litTo);
        this.fill.set(this.fillTo);
      }
      if (name === this.stageName) {
        if (markKey !== this.markKey) {
          this.markKey = markKey;
          if (jump) this.draw();
          else {
            this.seenAt = performance.now();
            this.kick();
          }
        }
        return;
      }
      this.markKey = markKey;
      this.stageName = name;
      this.el.dataset.shown = name;
      const s = this.zscale, sheets = stage.sheets.length ? stage.sheets : [{ layer: this.fn.initial, lift: 0 }], main = sheets[0];
      const grid = (layer) => this.grids.get(layer) ?? this.zeros;
      const first = this.sheets[0];
      const merge = !first || first.layer !== main.layer;
      const was = first ? { heights: this.current(first), lift: first.shown.lift, paint: first.tone < 0.5 ? first.paintA : first.paintB } : null;
      const lifts = [];
      for (let i = 0; i < Math.max(this.sheets.length, sheets.length); i++) {
        const sheet = this.sheet(i), next = sheets[i], seen = sheet.shown.alpha > 0;
        if (!next && !seen) {
          sheet.layer = "";
          sheet.from = sheet.to = sheet.shown;
          continue;
        }
        const heights = this.current(sheet);
        if (next) {
          const paint = this.paintOf(next.layer);
          if (seen) {
            sheet.A = heights;
            sheet.from = sheet.shown;
          } else if (i > 0 && merge && was) {
            sheet.A = was.heights;
            sheet.from = { lift: was.lift, alpha: 0 };
            sheet.paintA = sheet.paintB = was.paint;
            sheet.tone = 1;
          } else {
            sheet.A = this.zeros;
            sheet.from = { lift: i > 0 && first ? first.shown.lift : next.lift * s, alpha: 0 };
            sheet.paintA = sheet.paintB = paint;
            sheet.tone = 1;
          }
          sheet.B = grid(next.layer);
          sheet.to = { lift: next.lift * s, alpha: 1 };
          sheet.layer = next.layer;
          this.repaint(sheet, paint);
          lifts.push(next.lift * s);
        } else {
          sheet.A = heights;
          sheet.from = sheet.shown;
          sheet.layer = "";
          sheet.B = merge ? grid(main.layer) : this.zeros;
          sheet.to = { lift: main.lift * s, alpha: 0 };
          this.repaint(sheet, merge ? this.paintOf(main.layer) : sheet.paintB);
        }
      }
      const to = {
        marks: stage.marks ? 1 : 0,
        cut: stage.level === null ? 0 : 1,
        level: stage.level ?? this.fn.floor,
        low: this.zmin * s + Math.min(...lifts),
        high: this.zmax * s + Math.max(...lifts)
      };
      const counted = (shown) => this.sheets.filter(shown).length;
      const regrouped = counted((sheet) => sheet.from.alpha > 0) !== counted((sheet) => sheet.to.alpha > 0);
      if (jump) {
        this.mix = 1;
        for (const sheet of this.sheets) {
          sheet.A = sheet.B;
          sheet.from = sheet.shown = sheet.to;
          sheet.toneFrom = sheet.tone = 1;
        }
        this.shown = this.from = this.to = to;
        this.moving = false;
      } else {
        this.mix = 0;
        for (const sheet of this.sheets) sheet.tone = sheet.toneFrom;
        this.from = { ...this.shown, level: this.shown.cut > 0 ? this.shown.level : this.fn.floor };
        this.to = to;
        this.duration = this.from.level !== to.level || regrouped ? SLIDE : MORPH;
        this.t0 = performance.now();
        this.moving = true;
      }
      const lead = this.sheet(0);
      this.fn.marks.forEach((m, i) => {
        this.markA[i] = heightAt(lead.A, this.fn, m.x, m.y);
        this.markB[i] = heightAt(lead.B, this.fn, m.x, m.y);
      });
      for (const sheet of this.sheets) this.upload(sheet);
      if (this.moving) this.kick();
      else this.draw();
    }
    // the heights of the sheet drawn now, nondimensional, kept for the frame
    current(sheet) {
      if (this.mix >= 1 || sheet.A === sheet.B) return sheet.B;
      const now = sheet.now, a = sheet.A, b = sheet.B, t = this.mix;
      if (now && now.a === a && now.b === b && now.mix === t) return now.grid;
      const grid = a.map((z, i) => z + (b[i] - z) * t);
      sheet.now = { a, b, mix: t, grid };
      return grid;
    }
    // the unit normals of the heights g in world units, by central differences
    normalsOf(g) {
      const cached = this.normals.get(g);
      if (cached) return cached;
      const n = CELLS + 1, out = new Float32Array(3 * n * n), s = this.zscale;
      const dx = (this.fn.x[1] - this.fn.x[0]) / CELLS, dy = (this.fn.y[1] - this.fn.y[0]) / CELLS;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const at = (a, b) => g[clamp2(b, 0, CELLS) * n + clamp2(a, 0, CELLS)];
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
    upload(sheet) {
      const geometry = sheet.mesh.geometry, s = this.zscale;
      const zA = geometry.getAttribute("zA"), zB = geometry.getAttribute("zB");
      for (let i = 0; i < sheet.A.length; i++) {
        zA.array[i] = sheet.A[i] * s;
        zB.array[i] = sheet.B[i] * s;
      }
      geometry.getAttribute("nA").set(this.normalsOf(sheet.A));
      geometry.getAttribute("nB").set(this.normalsOf(sheet.B));
      for (const name of ["zA", "zB", "nA", "nB"]) geometry.getAttribute(name).needsUpdate = true;
    }
    // the world position of the mark i, on the first sheet as drawn now
    markAt(i, p) {
      const m = this.fn.marks[i];
      return p.set(m.x, m.y, lerp(this.markA[i], this.markB[i], this.mix) * this.zscale + this.sheet(0).shown.lift);
    }
    /**
     * The marks as drawn now, read by the tests: for each mark, the height at which it is drawn and
     * the height of the drawn surface under it, both in world units, and its fade, from 0 when it is
     * hidden to 1, its opacity lit set by data-surface-marks, and its tone. With settled, the change
     * of stage has ended.
     */
    probe() {
      const position = this.points.geometry.getAttribute("position"), lead = this.sheet(0), g = this.current(lead);
      const fade = this.points.visible ? this.shown.marks : 0;
      const camera = this.camera.clone(), p = new this.THREE.Vector3();
      camera.updateMatrixWorld();
      const label = (i) => {
        const lab = this.labels.find((l) => l.dataset.at === this.fn.marks[i].name);
        if (!lab) return null;
        this.markAt(i, p).project(camera);
        const x = (p.x + 1) / 2 * this.w + num3(lab.dataset.dx, 0), y = (1 - p.y) / 2 * this.h + num3(lab.dataset.dy, -34);
        return Math.hypot(parseFloat(lab.style.left) - x, parseFloat(lab.style.top) - y);
      };
      return {
        stage: this.stageName,
        settled: !this.moving,
        marks: this.fn.marks.map((m, i) => ({ name: m.name, z: position.getZ(i), surface: heightAt(g, this.fn, m.x, m.y) * this.zscale + lead.shown.lift, fade, label: label(i), lit: this.lit[i], tone: this.markTones[i] }))
      };
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
    // the camera on a sphere about the middle of the box of the sheets shown, divided by data-zoom.
    // its distance is that at which the sphere around the box of one sheet overfills the narrower
    // field of view by a little, as the box does not fill its sphere, or, for sheets stacked taller
    // than one, that at which their box fits the height of the view at the elevation of the camera
    aim() {
      const fn = this.fn, { low, high } = this.shown;
      const cx = (fn.x[0] + fn.x[1]) / 2, cy = (fn.y[0] + fn.y[1]) / 2, cz = (low + high) / 2;
      const wide = Math.hypot(fn.x[1] - fn.x[0], fn.y[1] - fn.y[0]), R = 0.5 * Math.hypot(wide, high - low);
      const v = this.camera.fov * Math.PI / 360, half = Math.min(v, Math.atan(Math.tan(v) * this.camera.aspect));
      const one = 0.5 * Math.hypot(wide, (this.zmax - this.zmin) * this.zscale) / Math.sin(half);
      const tall = 0.5 * ((high - low) * Math.cos(this.elevation) + wide * Math.sin(this.elevation)) / Math.tan(v);
      const d = Math.max(0.86 * one, tall) / this.zoom;
      const c = Math.cos(this.elevation);
      this.camera.position.set(cx + d * c * Math.cos(this.azimuth), cy + d * c * Math.sin(this.azimuth), cz + d * Math.sin(this.elevation));
      this.camera.near = Math.max(0.01, d - 2 * R);
      this.camera.far = d + 2 * R;
      this.camera.lookAt(cx, cy, cz);
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld();
    }
    // the curve of intersection of the plane with the first sheet at the level shown, recomputed when
    // the level or the heights have changed
    trace() {
      const lead = this.sheet(0);
      const key = this.shown.cut > 0 ? `${this.shown.level}|${this.mix}|${lead.layer}` : "";
      if (key === this.drawn) return;
      this.drawn = key;
      const curves2 = key ? levelCurves(this.current(lead), this.fn.x, this.fn.y, CELLS, CELLS, this.shown.level) : [];
      const count = curves2.reduce((total, c) => total + Math.max(0, c.length / 2 - 1), 0);
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
      for (const c of curves2) {
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
      const shown = this.shown;
      for (const s of this.sheets) {
        const u = s.mesh.material.uniforms;
        u.uMix.value = this.mix;
        u.uTone.value = s.tone;
        u.uAlpha.value = s.shown.alpha;
        s.group.position.z = s.shown.lift;
        s.group.visible = s.shown.alpha > 0;
        s.depth.visible = s.shown.alpha < 1;
      }
      const lift = this.sheet(0).shown.lift;
      this.plane.position.z = shown.level * this.zscale + lift;
      this.plane.material.uniforms.uAlpha.value = 0.2 * shown.cut;
      this.plane.visible = shown.cut > 0;
      this.curve.position.z = this.glow.position.z = lift;
      this.curve.material.uniforms.uAlpha.value = Math.min(1, 2 * shown.cut);
      this.curve.visible = shown.cut > 0;
      this.glow.material.uniforms.uAlpha.value = 0.45 * Math.min(1, 2 * shown.cut);
      this.glow.visible = shown.cut > 0;
      this.points.material.uniforms.uRise.value = shown.marks;
      this.points.visible = shown.marks > 0;
      this.trace();
      this.aim();
      this.place();
      if (r.domElement.width !== this.W || r.domElement.height !== this.H) r.setSize(this.W, this.H, false);
      r.render(this.scene, this.camera);
      const ctx = this.canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, this.W, this.H);
      ctx.drawImage(r.domElement, 0, 0);
    }
    // the marks on the first sheet as drawn now, dimmed behind the surface, and the labels at their
    // marks in the pixels of the slide, faded with the marks. the dimming follows the surface over
    // DIMMING seconds, and at once after a pause between two frames
    place() {
      const THREE = this.THREE, p = new THREE.Vector3();
      const position = this.points.geometry.getAttribute("position");
      const seen = this.points.geometry.getAttribute("seen");
      const now = performance.now(), dt = (now - this.seenAt) / 1e3;
      this.seenAt = now;
      const lit = this.points.geometry.getAttribute("lit");
      const fill2 = this.points.geometry.getAttribute("fill");
      const k = dt > 0.25 ? 1 : 1 - Math.exp(-dt / DIMMING);
      const f = !this.active || dt > 0.25 ? 1 : 1 - Math.exp(-dt / MARK_FADE);
      this.fn.marks.forEach((m, i) => {
        this.markAt(i, p);
        position.setXYZ(i, p.x, p.y, p.z);
        this.seen[i] += ((this.behind(p) ? BEHIND : 1) - this.seen[i]) * k;
        seen.setX(i, this.seen[i]);
        this.lit[i] += (this.litTo[i] - this.lit[i]) * f;
        lit.setX(i, this.lit[i]);
        for (let c = 0; c < 3; c++) this.fill[3 * i + c] += (this.fillTo[3 * i + c] - this.fill[3 * i + c]) * f;
        fill2.setXYZ(i, this.fill[3 * i], this.fill[3 * i + 1], this.fill[3 * i + 2]);
      });
      position.needsUpdate = seen.needsUpdate = lit.needsUpdate = fill2.needsUpdate = true;
      for (const lab of this.labels) {
        const i = this.fn.marks.findIndex((m) => m.name === lab.dataset.at);
        if (i < 0) continue;
        this.markAt(i, p).project(this.camera);
        lab.style.left = `${(p.x + 1) / 2 * this.w + num3(lab.dataset.dx, 0)}px`;
        lab.style.top = `${(1 - p.y) / 2 * this.h + num3(lab.dataset.dy, -34)}px`;
        lab.style.opacity = String(this.shown.marks ** 2 * this.seen[i] * this.lit[i]);
      }
    }
    // whether the first sheet is between the world point p, a little above it, and the camera
    behind(p) {
      const fn = this.fn, lead = this.sheet(0), g = this.current(lead), cam = this.camera.position;
      for (let k = 1; k <= 80; k++) {
        const t = 0.01 + k / 80 * 0.99;
        const x = p.x + (cam.x - p.x) * t, y = p.y + (cam.y - p.y) * t, z = p.z + 0.03 + (cam.z - p.z) * t;
        if (x < fn.x[0] || x > fn.x[1] || y < fn.y[0] || y > fn.y[1]) return false;
        if (heightAt(g, fn, x, y) * this.zscale + lead.shown.lift > z) return true;
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
        const { x, y } = this.drag;
        this.drag = { x: ev.clientX, y: ev.clientY };
        this.turn(ev.clientX - x, ev.clientY - y);
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
      for (const s of this.sheets) {
        s.shown = s.to;
        s.tone = 1;
      }
    }
    /** Turns the camera as a drag by dx and dy screen pixels does. */
    turn(dx, dy) {
      const scale = this.el.getBoundingClientRect().width / (this.el.offsetWidth || 1) || 1;
      this.azimuth -= dx / scale * 5e-3;
      this.elevation = clamp2(this.elevation + dy / scale * 4e-3, 0.12, 1.45);
      if (!this.raf) this.draw();
    }
    /** The camera drawn now and the values read from the attributes of the element, with the angles in degrees, e.g. for the editor. */
    view() {
      const d = this.el.dataset, deg = 180 / Math.PI;
      return {
        azimuth: this.azimuth * deg,
        elevation: this.elevation * deg,
        zoom: this.zoom,
        written: { azimuth: num3(d.azimuth, -60), elevation: num3(d.elevation, 32), zoom: num3(d.zoom, 1), turn: num3(d.turn, TURN), zscale: num3(d.zscale, this.fn.zscale) }
      };
    }
    /** Reads the camera, the turn, and the scale of the heights from the attributes of the element again, e.g. after the editor changed them. */
    configure() {
      const w = this.view().written;
      this.rate = w.turn > 0 ? 2 * Math.PI / w.turn : 0;
      this.azimuth = w.azimuth * Math.PI / 180;
      this.elevation = w.elevation * Math.PI / 180;
      this.zoom = w.zoom;
      if (w.zscale !== this.zscale) {
        this.zscale = w.zscale;
        for (const [name, g] of this.grids) this.ranges.set(name, this.range(g));
        this.normals = /* @__PURE__ */ new WeakMap();
        this.drawn = "";
        this.stageName = "";
        this.sync(false);
      }
      this.draw();
    }
    /** Takes the azimuth, the elevation, and the pause after a drag of the camera of other. */
    follow(other) {
      this.azimuth = other.azimuth;
      this.elevation = other.elevation;
      this.resume = other.resume;
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
      const known = CACHE3.get(el);
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
  var TONES2 = ["accent", "violet", "blue", "red"];
  function resolve(steps, current) {
    const indices = [...new Set(steps.map((s) => s.index))].sort((a, b) => a - b);
    const lit = /* @__PURE__ */ new Map();
    const order = steps.map((_, i) => i).sort((a, b) => steps[a].index - steps[b].index);
    for (const i of order) {
      if (!steps[i].visible) continue;
      for (const name of steps[i].unhighlight) lit.delete(name);
      for (const name of steps[i].highlight) lit.set(name, steps[i].tone);
    }
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
  var MOVES_ON = "data-moves-on";
  var hasContent = (f) => f.children.length > 0 || (f.textContent ?? "").trim() !== "";
  var isCopy = (f) => f.matches("pre > code.fragment");
  function addRestoreSteps(root2) {
    for (const slide of root2.querySelectorAll(".reveal .slides section")) {
      if (slide.querySelector("section, .fragment[data-restore], .fragment[data-final]")) continue;
      const frags = [...slide.querySelectorAll(".fragment")];
      const unindexed = frags.filter((f) => !f.hasAttribute("data-fragment-index"));
      const last = unindexed.length ? [unindexed[unindexed.length - 1]] : frags.filter((f) => Number(f.dataset.fragmentIndex) === Math.max(...frags.map((g) => Number(g.dataset.fragmentIndex))));
      const boxes = new Set(frags.filter(isCopy).map((f) => f.parentElement));
      const dimsBox = [...boxes].some((box2) => !last.some((f) => f.parentElement === box2 && isCopy(f)));
      if (!dimsBox && !frags.some((f) => !last.includes(f) && hasContent(f) && !isCopy(f))) continue;
      if (last.some(delayed)) {
        slide.setAttribute(MOVES_ON, "");
        continue;
      }
      const restore = document.createElement("span");
      restore.className = "fragment";
      restore.setAttribute("data-restore", "");
      restore.setAttribute("aria-hidden", "true");
      slide.append(restore);
    }
  }
  function applySteps(slide) {
    const frags = [...slide.querySelectorAll(".fragment")];
    if (!slide.querySelector("section")) slide.toggleAttribute("data-complete", !slide.hasAttribute(MOVES_ON) && frags.every((f) => f.classList.contains("visible")));
    const names = [...new Set(frags.flatMap((f) => words2(f.dataset.highlight)))];
    if (!names.length && !frags.some((f) => f.hasAttribute("data-keep"))) return;
    const select2 = (name) => `.${CSS.escape(name)}`;
    const steps = frags.map((f) => {
      const keep = f.getAttribute("data-keep");
      return {
        index: Number(f.dataset.fragmentIndex ?? 0),
        visible: f.classList.contains("visible"),
        keep: keep === null ? null : keep.trim() === "" ? "next" : Number(keep),
        highlight: words2(f.dataset.highlight),
        unhighlight: words2(f.dataset.unhighlight),
        tone: TONES2.find((t) => t !== "accent" && t === f.dataset.tone) ?? "accent",
        holds: names.filter((name) => f.matches(select2(name)) || f.querySelector(select2(name)))
      };
    });
    const current = Math.max(-1, ...steps.filter((s) => s.visible).map((s) => s.index));
    const { held, lit } = resolve(steps, current);
    frags.forEach((f, i) => f.toggleAttribute("data-held", held[i]));
    const tones = /* @__PURE__ */ new Map();
    for (const name of names) for (const el of slide.querySelectorAll(select2(name))) tones.set(el, lit.get(name) ?? tones.get(el));
    for (const [el, tone] of tones) {
      el.classList.add("hl-target");
      for (const t of TONES2) el.classList.toggle(`hl-${t}`, tone === t);
    }
  }
  function applyAll(root2) {
    for (const slide of root2.querySelectorAll(".reveal .slides section")) applySteps(slide);
  }
  var typeset2 = () => window.MathJax?.startup?.promise ?? Promise.resolve();
  function initSteps(deck) {
    const mark = () => {
      const slide = deck.getCurrentSlide();
      if (slide) applySteps(slide);
    };
    for (const type of ["fragmentshown", "fragmenthidden", "slidechanged"]) deck.on(type, mark);
    mark();
    void typeset2().then(mark);
    deck.on("slidechanged", (event) => {
      const { previousSlide: from, currentSlide: to } = event;
      if (!from?.hasAttribute(MOVES_ON) || !to || deck.getSlides().indexOf(to) < deck.getSlides().indexOf(from)) return;
      const frags = [...from.querySelectorAll(".fragment")];
      const last = Math.max(...frags.map((f) => Number(f.dataset.fragmentIndex)).filter(Number.isFinite));
      for (const f of frags) if (Number(f.dataset.fragmentIndex) === last) f.classList.add("current-fragment");
    });
  }
  var AUTOSLIDE = "data-autoslide";
  var HELD = "data-autoslide-held";
  var stepsOf = (slide) => [-1, ...new Set([...slide.querySelectorAll(".fragment")].map((f) => Number(f.dataset.fragmentIndex)).filter(Number.isFinite))].sort((a, b) => a - b);
  var fragmentsAt = (slide, f) => [...slide.querySelectorAll(".fragment")].filter((el) => Number(el.dataset.fragmentIndex) === f);
  var delayed = (el) => (parseInt(el.getAttribute(AUTOSLIDE) ?? el.getAttribute(HELD) ?? "", 10) || 0) > 0;
  function initTimedSteps(deck, forDeck2, internal) {
    const config = deck.getConfig();
    const method = config.autoSlideMethod;
    let timer = false;
    config.autoSlideStoppable = false;
    config.autoSlideMethod = () => {
      timer = true;
      try {
        if (typeof method === "function") method();
        else deck.next();
      } finally {
        timer = false;
      }
    };
    deck.addKeyBinding({ keyCode: 65, key: "A", description: "Pause and resume the timed steps" }, (ev) => {
      if (forDeck2(ev)) deck.toggleAutoSlide(!deck.isAutoSliding());
    });
    const cue = internal.cueAutoSlide.bind(internal);
    const state = () => {
      const { h, v, f } = deck.getIndices();
      return `${h}/${v}/${f}/${deck.isOverview()}/${deck.isPaused()}`;
    };
    let keyFrom = null;
    internal.cueAutoSlide = () => {
      if (keyFrom === null || keyFrom !== state()) cue();
    };
    window.addEventListener("keydown", () => {
      keyFrom = state();
      setTimeout(() => keyFrom = null, 0);
    }, true);
    window.addEventListener("keydown", () => keyFrom = null);
    const slides = () => deck.getSlides();
    const here = () => {
      const slide = deck.getCurrentSlide();
      const shown = [...slide.querySelectorAll(".fragment.visible")].map((f) => Number(f.dataset.fragmentIndex)).filter(Number.isFinite);
      return { slide: slides().indexOf(slide), f: Math.max(-1, ...shown) };
    };
    const before = (at) => {
      const steps = stepsOf(slides()[at.slide]);
      const k = steps.indexOf(at.f);
      if (k > 0) return { slide: at.slide, f: steps[k - 1] };
      const prev = slides()[at.slide - 1];
      return prev ? { slide: at.slide - 1, f: stepsOf(prev).at(-1) } : null;
    };
    const delayedAt = (at) => !!at && at.f >= 0 && fragmentsAt(slides()[at.slide], at.f).some(delayed);
    const same = (a, b) => !!a && !!b && a.slide === b.slide && a.f === b.f;
    const reached = /* @__PURE__ */ new Map();
    const byDelay = (at) => reached.get(`${at.slide}:${at.f}`) ?? delayedAt(before(at));
    let last = here();
    let held = [];
    const change = () => {
      const now = here();
      if (same(now, last)) return;
      for (const el of held) {
        el.setAttribute(AUTOSLIDE, el.getAttribute(HELD) ?? "");
        el.removeAttribute(HELD);
      }
      held = [];
      const from = last;
      last = now;
      const back = now.slide < from.slide || now.slide === from.slide && now.f < from.f;
      if (!back) reached.set(`${now.slide}:${now.f}`, timer);
      if (!back || deck.isOverview()) return;
      if (delayedAt(now)) {
        held = fragmentsAt(slides()[now.slide], now.f).filter((el) => el.hasAttribute(AUTOSLIDE));
        for (const el of held) {
          el.setAttribute(HELD, el.getAttribute(AUTOSLIDE));
          el.removeAttribute(AUTOSLIDE);
        }
      }
      internal.cueAutoSlide();
      if (!delayedAt(now)) return;
      if (same(before(from), now) && byDelay(now)) setTimeout(() => deck.prev(), 0);
    };
    for (const type of ["fragmentshown", "fragmenthidden", "slidechanged"]) deck.on(type, change);
  }

  // src/switcher.ts
  var KEY = "beeson-theme";
  var root = document.documentElement;
  var pinned = false;
  var button = null;
  var flip = null;
  var undo = null;
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
  function ghosts(x, y) {
    const deck = document.querySelector(".reveal");
    const live = [...document.querySelectorAll(".backdrop")].map((el) => Orbits.of(el)).filter((o) => o?.tracing);
    if (!deck || !live.length || !CSS.supports("view-transition-class", "a") || !CSS.supports("selector(:active-view-transition)")) return null;
    const box2 = deck.getBoundingClientRect();
    root.style.setProperty("--flip-deck-x", `${x - box2.left}px`);
    root.style.setProperty("--flip-deck-y", `${y - box2.top}px`);
    deck.style.setProperty("view-transition-name", "flip-deck");
    const canvases = live.flatMap((o) => o.canvases);
    canvases.forEach((c, k) => {
      c.style.setProperty("view-transition-name", `flip-art-${k}`);
      c.style.setProperty("view-transition-class", "flip-art");
    });
    const unname = () => {
      for (const c of canvases) {
        c.style.removeProperty("view-transition-name");
        c.style.removeProperty("view-transition-class");
      }
    };
    const layer = document.createElement("div");
    layer.className = "flip-ghost";
    Object.assign(layer.style, { left: `${box2.left}px`, top: `${box2.top}px`, width: `${box2.width}px`, height: `${box2.height}px` });
    return {
      // called in the update of the view transition before the next mode is applied, hence the
      // canvases are redrawn after it in the new view of the deck
      lift() {
        for (const o of live) o.ghost(layer, box2);
        document.body.append(layer);
        unname();
      },
      undo() {
        unname();
        deck.style.removeProperty("view-transition-name");
        for (const o of live) o.unghost();
        layer.remove();
      }
    };
  }
  function set(theme, at) {
    if (!isTheme(theme) || theme === get()) return;
    store(theme);
    const doc = document;
    if (!doc.startViewTransition || Orbits.reduced()) {
      apply(theme);
      return;
    }
    undo?.();
    undo = null;
    const b = button?.getBoundingClientRect();
    const x = at?.x ?? (b ? b.left + b.width / 2 : innerWidth), y = at?.y ?? (b ? b.top + b.height / 2 : 0);
    root.style.setProperty("--flip-x", `${x}px`);
    root.style.setProperty("--flip-y", `${y}px`);
    root.style.setProperty("--flip-r", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
    root.classList.toggle("to-dark", theme === "dark");
    root.classList.toggle("to-light", theme === "light");
    const layers = ghosts(x, y);
    undo = layers?.undo ?? null;
    const tr = doc.startViewTransition(() => {
      layers?.lift();
      apply(theme);
    });
    flip = tr;
    tr.finished.finally(() => {
      if (flip !== tr) return;
      root.classList.remove("to-dark", "to-light");
      undo?.();
      undo = null;
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
  function numberOf(slide) {
    if (slide?.dataset.appendix) return [`A${slide.dataset.appendix}`, "", ""];
    if (!slide || slide.dataset.visibility === "uncounted") return ["", "", ""];
    return [String(window.Reveal.getSlidePastCount(slide) + 1), "/", window.Reveal.getTotalSlides()];
  }
  function markUncounted(scope) {
    let appendix = 0;
    for (const slide of scope.querySelectorAll(".reveal .slides > section")) {
      if (appendix) slide.dataset.appendix = String(appendix++);
      if ((appendix || slide.matches(".title, .section, .closing")) && !slide.dataset.visibility) slide.dataset.visibility = "uncounted";
      if (!appendix && slide.classList.contains("closing")) appendix = 1;
    }
  }
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
    slideNumber: (slide) => numberOf(slide),
    controls: false,
    center: false,
    pdfSeparateFragments: true,
    // one page per step, as in Keynote and PowerPoint, with what runs past the slide cut off in the
    // print styles of theme/beeson.css
    pdfMaxPagesPerSlide: 1,
    // off with 0, since the chrome, the mode button, and the viewer are lost in the scroll view that
    // reveal.js would start in a narrow window
    scrollActivationWidth: 0
  };
  var TRACED = ["title", "section", "closing"];
  var backdrops = [];
  var surfaces = [];
  var plots = [];
  var EDITING = new URLSearchParams(location.search).has("edit");
  var PLAYED = !EDITING && window.parent !== window && new URLSearchParams(location.search).has("from-editor");
  var RECEIVER = window.parent !== window && /receiver/i.test(location.search);
  var TAB = !EDITING && window.parent === window && !!window.opener && new URLSearchParams(location.search).has("from-editor");
  var ENDS = (PLAYED || TAB) && !/controls=false/.test(location.search);
  var toEditor = (eventName, state = window.Reveal.getState()) => (RECEIVER ? window.parent.opener : TAB ? window.opener : window.parent)?.postMessage(JSON.stringify({ namespace: "beeson", eventName, state }), "*");
  var speaker = null;
  function fromSpeaker(ev) {
    let m = null;
    try {
      const from = ev.source;
      if (from?.opener === window) speaker = from;
      if (from?.parent?.opener === window && typeof ev.data === "string") m = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (m?.namespace === "beeson" && m.eventName === "edit") PLAYED || TAB ? toEditor("edit", m.state ?? window.Reveal.getState()) : edit();
  }
  function edit() {
    speaker?.close();
    const params = new URLSearchParams(location.search);
    params.set("edit", "");
    location.href = `${location.href.split(/[?#]/)[0]}?${params.toString().replace(/=(?=&|$)/g, "")}${location.hash}`;
  }
  var still2 = () => EDITING || Orbits.reduced() || window.Reveal.isPrintView() || /print-pdf/.test(location.search);
  function remount() {
    for (const o of mount(document)) if (!backdrops.includes(o)) backdrops.push(o);
    if (document.querySelector(".surface")) {
      for (const s of mount2(document)) if (!surfaces.includes(s)) surfaces.push(s);
    }
    for (const p of mountPlots(document)) if (!plots.includes(p)) plots.push(p);
  }
  var within = (slide) => slide ? backdrops.filter((o) => slide.contains(o.el)) : [];
  var surfacesOf = (slide) => slide ? surfaces.filter((s) => slide.contains(s.el)) : [];
  var plotsIn = (slide) => slide ? plots.filter((p) => slide.contains(p.el)) : [];
  function stepPlots(slide) {
    const own = plotsIn(slide);
    for (const p of own) {
      p.fit();
      p.syncSteps();
    }
    if (own.length) applySteps(slide);
  }
  var waiting = (o) => o.el.classList.contains("fragment") && !o.el.classList.contains("visible");
  function playBackdrop(o, slide) {
    o.fit();
    if (still2()) {
      o.complete();
      return;
    }
    if (waiting(o)) {
      o.reset();
      return;
    }
    const loop = o.el.hasAttribute("data-loop");
    if (slide.hasAttribute("data-auto-animate")) {
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
  function show(slide) {
    stepPlots(slide);
    for (const p of plotsIn(slide)) if (still2()) p.still();
    else p.start();
    for (const o of within(slide)) playBackdrop(o, slide);
    for (const s of surfacesOf(slide)) {
      s.fit();
      s.sync(false);
      if (!still2()) s.start();
    }
  }
  function mountWithin(root2) {
    remount();
    mountQr(root2);
    for (const o of backdrops) if (root2.contains(o.el)) {
      o.fit();
      o.complete();
    }
    for (const s of surfaces) if (root2.contains(s.el)) {
      s.fit();
      s.sync(false);
      s.draw();
    }
    for (const p of plots) if (root2.contains(p.el)) {
      p.fit();
      p.syncSteps();
      p.still();
    }
    const slide = root2.closest(".reveal .slides section");
    if (slide) applySteps(slide);
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
    if (window.RevealHighlight && !EDITING && !plugins.includes(window.RevealHighlight)) plugins.push(window.RevealHighlight);
    initSwitcher();
    if (!EDITING) markUncounted(document);
    mountQr(document);
    markViewers();
    deck.on("pdf-ready", () => {
      completeAll();
      void typeset2().then(() => applyAll(document));
      syncViewers(get());
      void stillViewers();
    });
    const hooks = {};
    if (!EDITING) plugins.push({ id: "beeson-restore", init: (reveal) => {
      hooks.internal = reveal;
      addRestoreSteps(document);
    } });
    const editing = EDITING ? { showHiddenSlides: true } : PLAYED && !RECEIVER ? { postMessageEvents: true } : {};
    await deck.initialize({ ...DEFAULTS, ...editing, ...options, plugins });
    initChrome();
    initSteps(deck);
    const { internal } = hooks;
    if (internal) initTimedSteps(deck, forDeck, internal);
    remount();
    initCursor(() => backdrops, () => deck.getCurrentSlide(), !EDITING);
    deck.addKeyBinding({ keyCode: 68, key: "D", description: "Switch dark and light" }, (ev) => {
      if (forDeck(ev)) toggle();
    });
    deck.addKeyBinding({ keyCode: 80, key: "P", description: "Pointer" }, (ev) => {
      if (forDeck(ev)) togglePointer();
    });
    deck.addKeyBinding(70, (ev) => {
      if (forDeck(ev)) PLAYED ? toEditor("fullscreen") : toggleFullscreen();
    });
    deck.registerKeyboardShortcut("F", "Full screen on and off");
    if (!EDITING && !deck.isPrintView() && !/print-pdf/.test(location.search)) {
      if (!PLAYED) initFullscreen();
      initScrub(deck);
      if (internal) initClick(deck, () => internal.cueAutoSlide(), ENDS ? () => toEditor("edit") : void 0);
    }
    if (PLAYED || TAB) for (const keyCode of [27, 69]) deck.addKeyBinding(keyCode, (ev) => {
      if (forDeck(ev)) toEditor("edit", ENDS ? void 0 : null);
    });
    else if (!EDITING) deck.addKeyBinding({ keyCode: 69, key: "E", description: "Edit the deck" }, (ev) => {
      if (forDeck(ev)) RECEIVER ? toEditor("edit") : edit();
    });
    if (PLAYED) document.addEventListener("keydown", (ev) => {
      if (ev.keyCode === 83 && forDeck(ev)) toEditor("speaker");
    }, true);
    let typed = "";
    if (PLAYED && !RECEIVER) {
      document.addEventListener("keydown", (ev) => {
        if (!/^[0-9]$/.test(ev.key) && ev.key !== "Enter") typed = "";
      }, true);
      for (let d = 0; d < 10; d++) for (const keyCode of [48 + d, 96 + d]) deck.addKeyBinding(keyCode, (ev) => {
        if (forDeck(ev)) typed = (typed + d).slice(-4);
      });
      deck.addKeyBinding(13, (ev) => {
        if (deck.isOverview()) deck.toggleOverview(false);
        else if (forDeck(ev)) typed ? deck.slide(Number(typed) - 1, 0, -1) : deck.next();
        typed = "";
      });
      deck.addKeyBinding(8, (ev) => {
        if (forDeck(ev)) deck.prev();
      });
    }
    if (ENDS) document.addEventListener("keydown", (ev) => {
      if (!["ArrowRight", "ArrowDown", "PageDown", " ", "Enter", "n", "N"].includes(ev.key) || ev.key === "Enter" && typed) return;
      if (!forDeck(ev) || deck.isOverview() || !deck.isLastSlide() || deck.availableFragments().next) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      toEditor("edit");
    }, true);
    if (!EDITING && !RECEIVER) window.addEventListener("message", fromSpeaker);
    if (PLAYED || TAB) window.addEventListener("pagehide", () => speaker?.close());
    if (still2()) completeAll();
    else show(deck.getCurrentSlide());
    deck.on("slidechanged", (event) => {
      const ev = event;
      if (!still2()) {
        for (const o of within(ev.previousSlide)) if (!ev.currentSlide.contains(o.el)) o.reset();
      }
      const before = surfacesOf(ev.previousSlide);
      for (const s of before) s.stop();
      const key = (s) => JSON.stringify(Object.entries(s.el.dataset).filter(([k]) => k !== "stage" && k !== "shown").sort());
      for (const s of surfacesOf(ev.currentSlide)) {
        const from = before.find((b) => key(b) === key(s));
        if (from) s.follow(from);
      }
      for (const p of plotsIn(ev.previousSlide)) if (!ev.currentSlide.contains(p.el)) p.leave();
      show(ev.currentSlide);
    });
    const step2 = () => {
      for (const s of surfacesOf(deck.getCurrentSlide())) s.sync(!still2());
      stepPlots(deck.getCurrentSlide());
    };
    deck.on("fragmentshown", step2);
    deck.on("fragmenthidden", step2);
    const stepped = (event) => {
      const shown = event.fragments ?? [];
      for (const o of within(deck.getCurrentSlide())) if (shown.includes(o.el)) playBackdrop(o, deck.getCurrentSlide());
    };
    deck.on("fragmentshown", stepped);
    deck.on("fragmenthidden", stepped);
    deck.on("resize", () => {
      for (const o of backdrops) o.fit();
      for (const s of surfaces) s.fit();
      stepPlots(deck.getCurrentSlide());
    });
    document.addEventListener("beeson:plot-drawn", (ev) => {
      const slide = ev.target.closest(".reveal .slides section");
      if (slide) applySteps(slide);
    });
    syncViewers(get());
    document.addEventListener("beeson:theme", () => {
      const now = window.Reveal.isPrintView() ? backdrops : within(deck.getCurrentSlide());
      for (const o of now) o.redraw();
      const later = backdrops.filter((o) => !now.includes(o));
      if (later.length) setTimeout(() => {
        for (const o of later) o.redraw();
      }, 600);
      for (const s of surfaces) {
        s.recolor();
        s.draw();
      }
      syncViewers(get());
    });
  }
  function syncViewers(theme) {
    for (const viewer of document.querySelectorAll("tycho-viewer")) {
      if (!viewer.hasAttribute("data-keep-theme")) viewer.setAttribute("theme", theme);
      viewer.setAttribute("data-prevent-swipe", "");
    }
  }
  initTheme();
  var self = document.currentScript;
  if (EDITING) {
    const script2 = document.createElement("script");
    script2.src = self?.src ? new URL("editor.js", self.src).href : "theme/editor.js";
    document.head.append(script2);
  }
  var Beeson = {
    start,
    theme: { get, set: (theme) => set(theme), toggle: () => toggle() },
    backdrops,
    surfaces,
    plots,
    // called in a script file of polylines named in data-strands, see src/strands.ts
    strands: register,
    // called by the editor after a structural change of the slides
    mount: mountWithin,
    refreshChrome,
    version: "0.9.0-beta.1"
  };
  window.Beeson = Beeson;
})();
