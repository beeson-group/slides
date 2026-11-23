import type * as Three from 'three';
import { typesetLabels } from './drawn-text.ts';
import { LINE_FRAGMENT, LINE_VERTEX, clamp, dragToTurn, ease, lerp, mix3, num, renderer, rgb } from './surface.ts';
import type { RGB, Surface } from './surface.ts';

type Vec = [number, number, number];

export type BundleData = {
  orbit: Vec[];
  libration_point?: Vec;
  strips: { id: string; tone: string; half_width: number; ribs: number[]; directions: Vec[] }[];
  arrows?: { id: string; toward: Vec }[];
  times?: number[];
};

const GROW = 3600;
const SHRINK = 1400;
const RIBS_END = 0.42;
const RIB_DELAY = 0.2;
const SHEET_START = 0.42;
const TURN = 90;
const ORBIT_WIDTH = 4;
const RIB_WIDTH = 2;
const DOT_SIZE = 18;
const START = 'start';
const NUDGE = 'nudge';
const FLOW = 'flow';
const LAP = 6000;
const FILL = 400;
const FADE = 300;
const PULSE = 210;
const RING = 17;
const RING_WIDTH = 3;
const NUDGE_LENGTH = 90;
const COMPASS_LEFT = 190;
const COMPASS_TOP = 170;
const COMPASS_RADIUS = 70;
const CIRCLE_WIDTH = 1.5;
const NEEDLE_WIDTH = 3;
const HEAD = 18;
const LABEL_GAP = 10;
const SHEET_ALPHA = 0.86;
const QUAD = [0, -1, 1, -1, 1, 1, 0, -1, 1, 1, 0, 1];

const SHEET_VERTEX = `
attribute vec3 aNormal;
attribute float aAcross;
varying vec3 vNormal;
varying float vAcross;
void main() {
  vNormal = aNormal;
  vAcross = aAcross;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SHEET_FRAGMENT = `
uniform vec3 uColor;
uniform vec3 uEdge;
uniform vec3 uLight;
uniform float uAlpha;
varying vec3 vNormal;
varying float vAcross;
void main() {
  vec3 c = mix(uColor, uEdge, vAcross);
  c *= 0.62 + 0.38 * abs(dot(normalize(vNormal), uLight));
  gl_FragColor = vec4(c, uAlpha);
}`;

const DOT_VERTEX = `
uniform float uSize;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize;
}`;

const DOT_FRAGMENT = `
uniform vec3 uColor;
uniform vec3 uRing;
uniform float uSize;
void main() {
  float r = length(gl_PointCoord * 2.0 - 1.0);
  float aa = 2.0 / uSize;
  float outer = 1.0 - smoothstep(1.0 - aa, 1.0, r);
  if (outer <= 0.0) discard;
  float fill = 1.0 - smoothstep(0.62 - aa, 0.62, r);
  gl_FragColor = vec4(mix(uRing, uColor, fill), outer);
}`;

const add = (a: Vec, b: Vec, s: number): Vec => [a[0] + s * b[0], a[1] + s * b[1], a[2] + s * b[2]];

const ribGrowth = (g: number, k: number, count: number): number => {
  const start = count > 1 ? (RIB_DELAY * k) / (count - 1) : 0;
  return ease(clamp((g - start) / (RIBS_END - RIB_DELAY), 0, 1));
};
const sheetGrowth = (g: number): number => ease(clamp((g - SHEET_START) / (1 - SHEET_START), 0, 1));

export function parseBundle(text: string): BundleData | string {
  let data: BundleData;
  try { data = JSON.parse(text); } catch (error) { return `its JSON is malformed, ${String(error)}`; }
  const n = Array.isArray(data?.orbit) ? data.orbit.length : 0;
  if (n < 3) return 'its orbit has fewer than three points';
  const point = (p: unknown) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
  const bad = data.orbit.findIndex((p) => !point(p));
  if (bad >= 0) return `the point ${bad} of the orbit is not three numbers`;
  if (data.libration_point !== undefined && !point(data.libration_point)) return 'its libration_point is not three numbers';
  if (!Array.isArray(data.strips)) return 'it does not have a list of strips';
  for (const r of data.strips) {
    if (r?.directions?.length !== n) return `the strip ${r?.id} has ${r?.directions?.length ?? 0} directions for ${n} points of the orbit`;
    const d = r.directions.findIndex((p) => !point(p));
    if (d >= 0) return `the direction ${d} of the strip ${r.id} is not three numbers`;
    if (!(r.half_width > 0)) return `the strip ${r.id} does not have a positive half_width`;
    if (!Array.isArray(r.ribs)) return `the ribs of the strip ${r.id} are not a list`;
    if (r.ribs.some((i) => !(Number.isInteger(i) && i >= 0 && i < n))) return `a rib of the strip ${r.id} is not a point of the orbit`;
  }
  if (data.arrows !== undefined && !Array.isArray(data.arrows)) return 'its arrows are not a list';
  for (const a of data.arrows ?? []) {
    if (!point(a?.toward)) return `the arrow ${a?.id} does not have a point toward of three numbers`;
  }
  const t = data.times;
  if (t !== undefined && !(Array.isArray(t) && t.length === n && t.every((v, i) => Number.isFinite(v) && v >= 0 && v < 1 && (i === 0 || v > t[i - 1])))) return 'its times are not increasing fractions of the period, one for each point of the orbit';
  return data;
}

type Strip = {
  id: string;
  tone: string;
  half: number;
  ribs: number[];
  directions: Vec[];
  sheet: Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>;
  depth: Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>;
  segments: Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>;
  grow: number;
  from: number;
  to: number;
  drawn: string;
};

type Arrow = { id: string; u: Vec };

const CACHE = new WeakMap<HTMLElement, Bundle>();
const REPORTED = new WeakMap<HTMLElement, string | null>();

export class Bundle {
  readonly el: HTMLElement;
  private THREE: typeof Three;
  private orbit: Vec[];
  private point: Vec | null;
  private strips: Strip[];
  private arrows: Arrow[];
  private subtle = '';
  private canvas: HTMLCanvasElement;
  private labels: HTMLElement[];
  private scene: Three.Scene;
  private camera: Three.PerspectiveCamera;
  private line: Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>;
  private dot: Three.Points<Three.BufferGeometry, Three.ShaderMaterial>;
  private center: Vec;
  private radius: number;
  private rate = 0;
  private azimuth = 0;
  private elevation = 0;
  private zoom = 1;
  private stateName: string | null = null;
  private t0 = 0;
  private duration = GROW;
  private moving = false;
  private active = false;
  private raf = 0;
  private last = 0;
  private resume = 0;
  private dragging: () => boolean;
  private W = 0;
  private H = 0;
  private w = 0;
  private h = 0;
  private times: number[] | null;
  private laps: HTMLElement[];
  private colors = { accent: '', blue: '', bg: '' };
  private marked = false;
  private nudged = false;
  private flowing = false;
  private arrow = 0;
  private fill = 0;
  private lapStart = 0;
  private elapsed = 0;

  constructor(el: HTMLElement, data: BundleData, THREE: typeof Three) {
    this.el = el;
    this.THREE = THREE;
    this.orbit = data.orbit;
    this.point = data.libration_point ?? null;
    this.times = data.times ?? null;
    this.setCamera();
    for (const old of el.querySelectorAll(':scope > canvas.surface-image')) old.remove();
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'surface-image';
    this.canvas.setAttribute('aria-hidden', 'true');
    el.prepend(this.canvas);
    el.setAttribute('data-prevent-swipe', '');
    this.labels = [...el.querySelectorAll<HTMLElement>('.label')];
    typesetLabels(this.labels);
    this.laps = [...(el.closest('section')?.querySelectorAll<HTMLElement>('[data-surface-lap]') ?? [])];

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    this.camera.up.set(0, 0, 1);
    this.line = this.makeLine(this.orbit.length, ORBIT_WIDTH, 2);
    this.orbit.forEach((p, i) => this.setSegment(this.line.geometry, i, p, this.orbit[(i + 1) % this.orbit.length]));
    this.dot = this.makeDot();
    this.scene.add(this.line, this.dot);
    this.strips = data.strips.map((r, i) => this.makeStrip(r, i));
    const points: Vec[] = [...this.orbit];
    for (const r of this.strips) this.orbit.forEach((p, i) => points.push(add(p, r.directions[i], r.half), add(p, r.directions[i], -r.half)));
    const lo = [0, 1, 2].map((k) => Math.min(...points.map((p) => p[k])));
    const hi = [0, 1, 2].map((k) => Math.max(...points.map((p) => p[k])));
    this.center = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    this.radius = 0.5 * Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
    const from = this.point ?? this.center;
    this.arrows = (data.arrows ?? []).map((a) => {
      const d = add(a.toward, from, -1);
      return { id: a.id, u: add([0, 0, 0], d, 1 / (Math.hypot(...d) || 1)) };
    });

    this.dragging = dragToTurn(el, (dx, dy) => this.turn(dx, dy), () => { this.resume = performance.now() + 1500; });
    this.recolor();
    CACHE.set(el, this);
    this.sync(false);
    this.fit();
  }

  private makeLine(count: number, width: number, order: number): Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial> {
    const THREE = this.THREE, geometry = new THREE.BufferGeometry();
    const corner = new Float32Array(12 * count);
    for (let i = 0; i < count; i++) corner.set(QUAD, 12 * i);
    geometry.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
    geometry.setAttribute('start', new THREE.BufferAttribute(new Float32Array(18 * count), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('end', new THREE.BufferAttribute(new Float32Array(18 * count), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 6 * count);
    const material = new THREE.ShaderMaterial({
      vertexShader: LINE_VERTEX,
      fragmentShader: LINE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Vector3() },
        uAlpha: { value: 1 },
        uWidth: { value: width },
        uSoft: { value: 0 },
        uViewport: { value: new THREE.Vector2(1, 1) },
        uBias: { value: 0.003 },
      },
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    mesh.userData.width = width;
    return mesh;
  }

  private setSegment(geometry: Three.BufferGeometry, k: number, a: Vec, b: Vec): void {
    const start = geometry.getAttribute('start') as Three.BufferAttribute, end = geometry.getAttribute('end') as Three.BufferAttribute;
    for (let v = 0; v < 6; v++) {
      start.setXYZ(6 * k + v, a[0], a[1], a[2]);
      end.setXYZ(6 * k + v, b[0], b[1], b[2]);
    }
    start.needsUpdate = end.needsUpdate = true;
  }

  private makeDot(): Three.Points<Three.BufferGeometry, Three.ShaderMaterial> {
    const THREE = this.THREE, geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.point ?? [0, 0, 0]), 3));
    const material = new THREE.ShaderMaterial({
      vertexShader: DOT_VERTEX,
      fragmentShader: DOT_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: { uColor: { value: new THREE.Vector3() }, uRing: { value: new THREE.Vector3() }, uSize: { value: DOT_SIZE } },
    });
    const dot = new THREE.Points(geometry, material);
    dot.frustumCulled = false;
    dot.renderOrder = 4;
    dot.visible = this.point !== null;
    return dot;
  }

  private makeStrip(r: BundleData['strips'][number], i: number): Strip {
    const THREE = this.THREE, n = this.orbit.length, geometry = new THREE.BufferGeometry();
    const normal = new Float32Array(9 * n), across = new Float32Array(3 * n);
    for (let k = 0; k < n; k++) {
      const a = this.orbit[(k + n - 1) % n], b = this.orbit[(k + 1) % n], d = r.directions[k];
      const t: Vec = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const c: Vec = [t[1] * d[2] - t[2] * d[1], t[2] * d[0] - t[0] * d[2], t[0] * d[1] - t[1] * d[0]];
      const l = Math.hypot(...c) || 1;
      for (let j = 0; j < 3; j++) {
        normal.set([c[0] / l, c[1] / l, c[2] / l], 3 * (3 * k + j));
        across[3 * k + j] = j === 1 ? 0 : 1;
      }
    }
    const index: number[] = [];
    for (let k = 0; k < n; k++) {
      const m = (k + 1) % n;
      for (let j = 0; j < 2; j++) {
        const a = 3 * k + j, b = 3 * m + j;
        index.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * n), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aNormal', new THREE.BufferAttribute(normal, 3));
    geometry.setAttribute('aAcross', new THREE.BufferAttribute(across, 1));
    geometry.setIndex(index);
    const uniforms = {
      uColor: { value: new THREE.Vector3() },
      uEdge: { value: new THREE.Vector3() },
      uLight: { value: new THREE.Vector3(-0.45, -0.35, 0.82).normalize() },
      uAlpha: { value: SHEET_ALPHA },
    };
    const material = (colorWrite: boolean) => new THREE.ShaderMaterial({
      vertexShader: SHEET_VERTEX,
      fragmentShader: SHEET_FRAGMENT,
      side: THREE.DoubleSide,
      transparent: true,
      colorWrite,
      uniforms,
    });
    const sheet = new THREE.Mesh(geometry, material(true)), depth = new THREE.Mesh(geometry, material(false));
    depth.renderOrder = 0.1 * i;
    sheet.renderOrder = 1 + 0.1 * i;
    const segments = this.makeLine(r.ribs.length, RIB_WIDTH, 3 + 0.1 * i);
    for (const o of [sheet, depth, segments]) { o.frustumCulled = false; this.scene.add(o); }
    return { id: r.id, tone: r.tone, half: r.half_width, ribs: r.ribs, directions: r.directions, sheet, depth, segments, grow: 0, from: 0, to: 0, drawn: '' };
  }

  recolor(): void {
    const cs = getComputedStyle(this.el), css = (name: string, fallback: RGB) => rgb(cs.getPropertyValue(name), fallback);
    const bg = css('--bg', [0.02, 0.02, 0.02]), text = css('--text', [0.95, 0.95, 0.94]);
    const set = (target: Three.Vector3, c: RGB) => target.set(c[0], c[1], c[2]);
    this.subtle = cs.getPropertyValue('--subtle').trim() || '#a6a6a0';
    for (const k of ['accent', 'blue', 'bg'] as const) this.colors[k] = cs.getPropertyValue(`--${k}`).trim() || '#808080';
    set(this.line.material.uniforms.uColor.value, text);
    set(this.dot.material.uniforms.uColor.value, text);
    set(this.dot.material.uniforms.uRing.value, bg);
    for (const r of this.strips) {
      const tone = css(`--${r.tone}`, [0.94, 0.5, 0.31]);
      set(r.sheet.material.uniforms.uColor.value, tone);
      set(r.sheet.material.uniforms.uEdge.value, mix3(tone, bg, 0.35));
      set(r.segments.material.uniforms.uColor.value, mix3(tone, text, 0.4));
    }
  }

  private target(): string[] {
    let best: HTMLElement | null = null, index = -Infinity;
    for (const f of this.el.closest('section')?.querySelectorAll<HTMLElement>('.fragment.visible[data-surface-state]') ?? []) {
      const i = num(f.dataset.fragmentIndex, 0);
      if (i >= index) { best = f; index = i; }
    }
    const names = (best?.dataset.surfaceState ?? this.el.dataset.surfaceState ?? '').split(/\s+/).filter(Boolean);
    const unknown = names.filter((name) => !this.strips.some((r) => r.id === name) && !(this.times && [START, NUDGE, FLOW].includes(name)));
    if (unknown.length) console.error(`beeson: unknown strip "${unknown.join(' ')}" of the bundle ${this.el.dataset.bundle}, known: ${this.strips.map((r) => r.id).join(', ')}`);
    return names;
  }

  sync(animate: boolean): void {
    const names = this.target(), name = names.join(' ');
    if (name === this.stateName) return;
    const jump = !animate || this.stateName === null;
    this.stateName = name;
    this.el.dataset.shown = name;
    const has = (state: string) => this.times !== null && names.includes(state);
    const flowing = has(FLOW);
    if (flowing !== this.flowing) {
      this.flowing = flowing;
      this.elapsed = 0;
      this.lapStart = performance.now();
      this.fill = flowing && jump ? 1 : 0;
    }
    this.nudged = has(NUDGE);
    this.marked = flowing || this.nudged || has(START);
    if (jump) this.arrow = this.nudged ? 1 : 0;
    let longest = 0;
    for (const r of this.strips) {
      r.from = r.grow;
      r.to = names.includes(r.id) ? 1 : 0;
      longest = Math.max(longest, Math.abs(r.to - r.from) * (r.to > r.from ? GROW : SHRINK));
    }
    if (jump || longest === 0) {
      this.settle();
      this.draw();
      if (this.busy()) this.kick();
      return;
    }
    this.duration = longest;
    this.t0 = performance.now();
    this.moving = true;
    this.kick();
  }

  private settle(): void {
    this.moving = false;
    for (const r of this.strips) r.grow = r.from = r.to;
  }

  probe(): {
    state: string;
    settled: boolean;
    strips: { id: string; grow: number; sheet: number; ribs: number[] }[];
    arrows: { id: string; needle: [number, number][]; scene: [number, number][] }[];
  } {
    return {
      state: this.stateName ?? '',
      settled: !this.moving,
      strips: this.strips.map((r) => ({ id: r.id, grow: r.grow, sheet: sheetGrowth(r.grow), ribs: r.ribs.map((_, k) => ribGrowth(r.grow, k, r.ribs.length)) })),
      arrows: this.arrows.map((a, i) => {
        const from = this.point ?? this.center, { middle, tips } = this.compass();
        return { id: a.id, needle: [middle, tips[i]], scene: [this.screen(from), this.screen(add(from, a.u, 0.1))] };
      }),
    };
  }

  fit(): void {
    const r = this.el.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    if (!r.width || !r.height || !w || !h) return;
    this.W = Math.max(1, Math.round(r.width * dpr));
    this.H = Math.max(1, Math.round(r.height * dpr));
    this.w = w;
    this.h = h;
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    const px = (dpr * r.height) / h;
    for (const mesh of [this.line, ...this.strips.map((rb) => rb.segments)]) {
      mesh.material.uniforms.uViewport.value.set(this.W, this.H);
      mesh.material.uniforms.uWidth.value = mesh.userData.width * px;
    }
    this.dot.material.uniforms.uSize.value = DOT_SIZE * px;
    this.camera.aspect = this.W / this.H;
    this.draw();
  }

  private aim(): void {
    const [cx, cy, cz] = this.center, R = this.radius;
    const v = (this.camera.fov * Math.PI) / 360, half = Math.min(v, Math.atan(Math.tan(v) * this.camera.aspect));
    const d = R / Math.sin(half) / this.zoom, c = Math.cos(this.elevation);
    this.camera.position.set(cx + d * c * Math.cos(this.azimuth), cy + d * c * Math.sin(this.azimuth), cz + d * Math.sin(this.elevation));
    this.camera.near = Math.max(0.01, d - 2 * R);
    this.camera.far = d + 2 * R;
    this.camera.lookAt(cx, cy, cz);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  private place(): void {
    const n = this.orbit.length;
    for (const r of this.strips) {
      const key = String(r.grow);
      if (key === r.drawn) continue;
      r.drawn = key;
      const s = sheetGrowth(r.grow) * r.half;
      const position = r.sheet.geometry.getAttribute('position') as Three.BufferAttribute;
      for (let k = 0; k < n; k++) {
        const p = this.orbit[k], d = r.directions[k];
        position.setXYZ(3 * k, ...add(p, d, -s));
        position.setXYZ(3 * k + 1, ...p);
        position.setXYZ(3 * k + 2, ...add(p, d, s));
      }
      position.needsUpdate = true;
      r.sheet.visible = r.depth.visible = s > 0;
      r.ribs.forEach((i, k) => {
        const g = ribGrowth(r.grow, k, r.ribs.length) * r.half, p = this.orbit[i], d = r.directions[i];
        this.setSegment(r.segments.geometry, k, add(p, d, -g), add(p, d, g));
      });
      r.segments.visible = r.grow > 0;
    }
  }

  private screen(v: Vec): [number, number] {
    const p = new this.THREE.Vector3(...v).project(this.camera);
    return [((p.x + 1) / 2) * this.w, ((1 - p.y) / 2) * this.h];
  }

  private position(): Vec {
    const t = this.times;
    if (!this.flowing || !t) return this.orbit[0];
    const n = this.orbit.length, phase = (this.elapsed / LAP) % 1;
    let k = 0;
    while (k + 1 < n && t[k + 1] <= phase) k++;
    const next = k + 1 < n ? t[k + 1] : 1, f = (phase - t[k]) / (next - t[k] || 1);
    const a = this.orbit[k], b = this.orbit[(k + 1) % n];
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
  }

  private nudge(): { e: [number, number]; tip: [number, number] } {
    const [x, y] = this.screen(this.orbit[0]), [x1, y1] = this.screen(this.orbit[1]);
    const l = Math.hypot(x1 - x, y1 - y) || 1, e: [number, number] = [(x1 - x) / l, (y1 - y) / l];
    return { e, tip: [x + e[0] * NUDGE_LENGTH, y + e[1] * NUDGE_LENGTH] };
  }

  private drawPoint(ctx: CanvasRenderingContext2D): void {
    if (!this.marked) return;
    const [x, y] = this.screen(this.orbit[0]), c = this.colors;
    ctx.save();
    ctx.scale(this.W / this.w, this.H / this.h);
    if (this.arrow > 0) {
      const { e, tip } = this.nudge(), b = 0.4 * HEAD, base = [tip[0] - e[0] * HEAD, tip[1] - e[1] * HEAD];
      ctx.globalAlpha = this.arrow;
      ctx.strokeStyle = ctx.fillStyle = c.blue;
      ctx.lineWidth = NEEDLE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(base[0], base[1]);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(...tip);
      ctx.lineTo(base[0] - e[1] * b, base[1] + e[0] * b);
      ctx.lineTo(base[0] + e[1] * b, base[1] - e[0] * b);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, RING, 0, 2 * Math.PI);
    ctx.globalAlpha = this.fill;
    ctx.fillStyle = c.blue;
    if (this.fill > 0) ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c.blue;
    ctx.lineWidth = RING_WIDTH;
    ctx.stroke();
    const [px, py] = this.screen(this.position()), lap = Math.round(this.elapsed / LAP);
    const d = lap > 0 ? (this.elapsed - lap * LAP) / PULSE : Infinity;
    ctx.beginPath();
    ctx.arc(px, py, (DOT_SIZE / 2) * (1 + 0.7 * Math.exp(-d * d)), 0, 2 * Math.PI);
    ctx.fillStyle = c.accent;
    ctx.fill();
    ctx.strokeStyle = c.bg;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  private compass(): { middle: [number, number]; tips: [number, number][] } {
    const middle: [number, number] = [COMPASS_LEFT, COMPASS_TOP];
    const q = this.camera.quaternion.clone().invert(), v = new this.THREE.Vector3();
    const at = (d: Vec): [number, number] => {
      v.set(...d).applyQuaternion(q);
      return [middle[0] + COMPASS_RADIUS * v.x, middle[1] - COMPASS_RADIUS * v.y];
    };
    return { middle, tips: this.arrows.map((a) => at(a.u)) };
  }

  private drawCompass(ctx: CanvasRenderingContext2D): void {
    if (!this.arrows.length) return;
    const { middle, tips } = this.compass();
    const q = this.camera.quaternion.clone().invert(), v = new this.THREE.Vector3();
    ctx.save();
    ctx.scale(this.W / this.w, this.H / this.h);
    ctx.strokeStyle = ctx.fillStyle = this.subtle;
    ctx.lineWidth = CIRCLE_WIDTH;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      v.set(Math.cos((i * Math.PI) / 32), Math.sin((i * Math.PI) / 32), 0).applyQuaternion(q);
      ctx.lineTo(middle[0] + COMPASS_RADIUS * v.x, middle[1] - COMPASS_RADIUS * v.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = NEEDLE_WIDTH;
    for (const t of tips) {
      const l = Math.hypot(t[0] - middle[0], t[1] - middle[1]);
      if (l < 1) continue;
      const e = [(t[0] - middle[0]) / l, (t[1] - middle[1]) / l], head = Math.min(HEAD, l), b = 0.4 * head;
      const base = [t[0] - e[0] * head, t[1] - e[1] * head];
      ctx.beginPath();
      ctx.moveTo(...middle);
      ctx.lineTo(base[0], base[1]);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(t[0], t[1]);
      ctx.lineTo(base[0] - e[1] * b, base[1] + e[0] * b);
      ctx.lineTo(base[0] + e[1] * b, base[1] - e[0] * b);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private label(): void {
    const { middle, tips } = this.compass();
    if (this.times) for (const el of this.laps) el.style.opacity = String(this.fill);
    for (const lab of this.labels) {
      const at = lab.dataset.at ?? '';
      if (at === NUDGE && this.times) {
        const { e, tip } = this.nudge(), reach = LABEL_GAP + 0.5 * (Math.abs(e[0]) * lab.offsetWidth + Math.abs(e[1]) * lab.offsetHeight);
        lab.style.left = `${tip[0] + e[0] * reach + num(lab.dataset.dx, 0)}px`;
        lab.style.top = `${tip[1] + e[1] * reach + num(lab.dataset.dy, 0)}px`;
        lab.style.opacity = String(this.arrow);
        continue;
      }
      const i = this.arrows.findIndex((a) => a.id === at);
      if (i >= 0) {
        if (!lab.offsetWidth && !lab.offsetHeight) continue;
        const t = tips[i], l = Math.hypot(t[0] - middle[0], t[1] - middle[1]);
        const e = l < 1 ? [0, -1] : [(t[0] - middle[0]) / l, (t[1] - middle[1]) / l];
        const reach = LABEL_GAP + 0.5 * (Math.abs(e[0]) * lab.offsetWidth + Math.abs(e[1]) * lab.offsetHeight);
        lab.style.left = `${t[0] + e[0] * reach + num(lab.dataset.dx, 0)}px`;
        lab.style.top = `${t[1] + e[1] * reach + num(lab.dataset.dy, 0)}px`;
        lab.style.opacity = '1';
        continue;
      }
      let anchor: Vec | null = null, alpha = 1;
      const r = this.strips.find((rb) => rb.id === at);
      if (at === START && this.times) {
        anchor = this.orbit[0];
        alpha = this.marked ? 1 : 0;
      } else if (r) {
        const k = clamp(Math.round(num(lab.dataset.rib, 0)), 0, r.ribs.length - 1), i = r.ribs[k];
        anchor = add(this.orbit[i], r.directions[i], r.half * (num(lab.dataset.side, 1) < 0 ? -1 : 1));
        alpha = sheetGrowth(r.grow);
      } else if (this.point && /^L\d$/.test(at)) anchor = this.point;
      if (!anchor) continue;
      const [x, y] = this.screen(anchor);
      lab.style.left = `${x + num(lab.dataset.dx, 0)}px`;
      lab.style.top = `${y + num(lab.dataset.dy, -30)}px`;
      lab.style.opacity = String(alpha);
    }
  }

  draw(): void {
    if (!this.W) return;
    const r = renderer();
    if (!r) return;
    this.place();
    this.aim();
    this.label();
    if (r.domElement.width !== this.W || r.domElement.height !== this.H) r.setSize(this.W, this.H, false);
    r.render(this.scene, this.camera);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.drawImage(r.domElement, 0, 0);
    this.drawCompass(ctx);
    this.drawPoint(ctx);
  }

  private busy(): boolean {
    return this.moving || this.rate > 0 || this.flowing || this.arrow !== (this.nudged ? 1 : 0);
  }

  private kick(): void {
    if (this.active && !this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.raf = 0;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    if (this.moving) {
      const k = Math.min(1, (now - this.t0) / this.duration);
      for (const rb of this.strips) {
        const span = Math.abs(rb.to - rb.from) * (rb.to > rb.from ? GROW : SHRINK);
        rb.grow = span > 0 ? lerp(rb.from, rb.to, Math.min(1, (k * this.duration) / span)) : rb.to;
      }
      if (k >= 1) this.settle();
    }
    if (this.rate && !this.dragging() && now > this.resume) this.azimuth += dt * this.rate;
    if (this.flowing) {
      this.elapsed = Math.max(0, now - this.lapStart);
      if (this.elapsed > LAP) this.fill = Math.min(1, this.fill + (1000 * dt) / FILL);
    }
    const arrow = this.nudged ? 1 : 0, da = (1000 * dt) / FADE;
    this.arrow = arrow > this.arrow ? Math.min(arrow, this.arrow + da) : Math.max(arrow, this.arrow - da);
    this.draw();
    if (this.busy()) this.kick();
  };

  private setCamera(): void {
    const w = this.view().written;
    this.rate = w.turn > 0 ? (2 * Math.PI) / w.turn : 0;
    this.azimuth = (w.azimuth * Math.PI) / 180;
    this.elevation = (w.elevation * Math.PI) / 180;
    this.zoom = w.zoom;
  }

  turn(dx: number, dy: number): void {
    const scale = this.el.getBoundingClientRect().width / (this.el.offsetWidth || 1) || 1;
    this.azimuth -= (dx / scale) * 0.005;
    this.elevation = clamp(this.elevation + (dy / scale) * 0.004, -1.45, 1.45);
    if (!this.raf) this.draw();
  }

  view(): { azimuth: number; elevation: number; zoom: number; written: { azimuth: number; elevation: number; zoom: number; turn: number; zscale: number } } {
    const d = this.el.dataset, deg = 180 / Math.PI;
    return {
      azimuth: this.azimuth * deg,
      elevation: this.elevation * deg,
      zoom: this.zoom,
      written: { azimuth: num(d.azimuth, -60), elevation: num(d.elevation, 32), zoom: num(d.zoom, 1), turn: num(d.turn, TURN), zscale: 1 },
    };
  }

  configure(): void {
    this.setCamera();
    this.draw();
  }

  follow(other: Bundle | Surface): void {
    if (!(other instanceof Bundle)) return;
    this.azimuth = other.azimuth;
    this.elevation = other.elevation;
    this.resume = other.resume;
  }

  start(): void {
    this.active = true;
    this.last = 0;
    this.lapStart = performance.now() - this.elapsed;
    if (this.busy()) this.kick();
    else this.draw();
  }

  stop(): void {
    this.active = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.moving) this.settle();
  }
}

export function mount(root: ParentNode): Bundle[] {
  const out: Bundle[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('.surface[data-bundle]')) {
    const known = CACHE.get(el);
    if (known) { out.push(known); continue; }
    const id = el.dataset.bundle ?? '';
    const text = document.getElementById(id)?.textContent ?? null;
    if (REPORTED.has(el) && REPORTED.get(el) === text) continue;
    const report = (reason: string) => { REPORTED.set(el, text); console.error(`beeson: the bundle ${id} is not drawn, since ${reason}`); };
    const data = text === null ? `the JSON script with the id "${id}" is not found` : parseBundle(text);
    if (typeof data === 'string') { report(data); continue; }
    if (!renderer() || !window.THREE) continue;
    try { out.push(new Bundle(el, data, window.THREE)); } catch (error) { report(String(error)); }
  }
  return out;
}
