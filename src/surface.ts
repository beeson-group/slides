import type * as Three from 'three';
import { typesetLabels } from './drawn-text.ts';
import { FUNCTION_NAMES, RAMPS, levelCurves, sample, surfaceFunction } from './surfaces.ts';
import type { Height, Sheet, State, SurfaceFunction } from './surfaces.ts';

declare global {
  interface Window {
    THREE?: typeof Three;
  }
}

export type RGB = [number, number, number];
type Shown = { points: number; cut: number; level: number; low: number; high: number };
type Pose = { lift: number; alpha: number };
type Paint = { key: string; texture: Three.DataTexture; range: [number, number] };

type SheetMesh = {
  group: Three.Group;
  mesh: Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>;
  depth: Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>;
  height: Height | null;
  A: Float64Array;
  B: Float64Array;
  from: Pose;
  to: Pose;
  shown: Pose;
  paintA: Paint;
  paintB: Paint;
  toneFrom: number;
  tone: number;
  now: { a: Float64Array; b: Float64Array; mix: number; grid: Float64Array } | null;
};

const CELLS = 200;
const MORPH = 1400;
const SLIDE = 2600;
const TURN = 90;
const CURVE_WIDTH = 3.5;
const GLOW_WIDTH = 18;
const POINT_SIZE = 22;
const BEHIND = 0.3;
const DIMMING = 0.12;
const UNLIT = 0.18;
const POINT_FADE = 0.15;
const RAMP_TEXELS = 256;

export const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
export const num = (v: string | undefined, fallback: number): number => (v !== undefined && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback);
export const mix3 = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function rgb(css: string, fallback: RGB): RGB {
  const s = css.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (short) return [1, 2, 3].map((i) => parseInt(short[i] + short[i], 16) / 255) as RGB;
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(s);
  if (long) return [1, 2, 3].map((i) => parseInt(long[i], 16) / 255) as RGB;
  const fn = /^rgba?\(([^)]*)\)/i.exec(s);
  if (fn) {
    const v = fn[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (v.length >= 3 && v.every(Number.isFinite)) return [v[0] / 255, v[1] / 255, v[2] / 255];
  }
  return fallback;
}

function rampTexels(stops: RGB[]): Uint8Array {
  const out = new Uint8Array(4 * RAMP_TEXELS);
  for (let i = 0; i < RAMP_TEXELS; i++) {
    const p = (i / (RAMP_TEXELS - 1)) * (stops.length - 1), j = Math.min(stops.length - 2, Math.floor(p));
    const c = mix3(stops[j], stops[j + 1], p - j);
    out.set([...c.map((v) => Math.round(255 * v)), 255], 4 * i);
  }
  return out;
}

function heightAt(g: Float64Array, fn: SurfaceFunction, x: number, y: number): number {
  const n = CELLS + 1;
  const u = clamp(((x - fn.x[0]) / (fn.x[1] - fn.x[0])) * CELLS, 0, CELLS), v = clamp(((y - fn.y[0]) / (fn.y[1] - fn.y[0])) * CELLS, 0, CELLS);
  const i = Math.min(CELLS - 1, Math.floor(u)), j = Math.min(CELLS - 1, Math.floor(v)), s = u - i, t = v - j;
  const a = g[j * n + i], b = g[j * n + i + 1], c = g[(j + 1) * n + i], d = g[(j + 1) * n + i + 1];
  return s >= t ? a + s * (b - a) + t * (d - b) : a + t * (c - a) + s * (d - c);
}

const SURFACE_VERTEX = `
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
}`;

const SURFACE_FRAGMENT = `
uniform sampler2D uRampA;
uniform sampler2D uRampB;
uniform vec2 uRangeA;
uniform vec2 uRangeB;
uniform float uTone;
uniform float uAlpha;
uniform vec3 uGroove;
uniform vec3 uLight;
uniform vec2 uGrid;
uniform float uLine;
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
  vec2 a = abs(fract(q - 0.5) - 0.5) / (max(fwidth(q), vec2(1e-4)) * uLine);
  c = mix(c, uGroove, 0.45 * (1.0 - min(min(a.x, a.y), 1.0)));
  gl_FragColor = vec4(c, uAlpha);
}`;

const PLANE_VERTEX = `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const PLANE_FRAGMENT = `
uniform vec3 uColor;
uniform float uAlpha;
void main() {
  gl_FragColor = vec4(uColor, uAlpha);
}`;

export const LINE_VERTEX = `
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
}`;

export const LINE_FRAGMENT = `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uWidth;
uniform float uSoft;
varying float vSide;
void main() {
  float s = abs(vSide);
  float edge = mix(1.0 - smoothstep(1.0 - 2.0 / uWidth, 1.0, s), (1.0 - s) * (1.0 - s), uSoft);
  gl_FragColor = vec4(uColor, uAlpha * edge);
}`;

const POINT_VERTEX = `
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
}`;

const POINT_FRAGMENT = `
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
}`;

let shared: Three.WebGLRenderer | null | undefined;
const restored: (() => void)[] = [];

export function onRestore(redraw: () => void): void {
  restored.push(redraw);
}

export function renderer(): Three.WebGLRenderer | null {
  if (shared !== undefined) return shared;
  shared = null;
  const THREE = window.THREE;
  if (!THREE) {
    console.error('beeson: a .surface needs three.js, loaded with <script src="theme/vendor/three/three.js"> before beeson.js');
    return null;
  }
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
    r.setPixelRatio(1);
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.domElement.addEventListener('webglcontextrestored', () => {
      r.dispose();
      shared = undefined;
      for (const redraw of restored) redraw();
    }, { once: true });
    shared = r;
  } catch (error) {
    console.warn(`beeson: WebGL is not available for the surfaces, ${String(error)}`);
  }
  return shared;
}

export function dragToTurn(el: HTMLElement, turn: (dx: number, dy: number) => void, end: () => void): () => boolean {
  let drag: { x: number; y: number } | null = null;
  el.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    drag = { x: ev.clientX, y: ev.clientY };
    try { el.setPointerCapture(ev.pointerId); } catch {}
    el.classList.add('dragging');
  });
  el.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const { x, y } = drag;
    drag = { x: ev.clientX, y: ev.clientY };
    turn(ev.clientX - x, ev.clientY - y);
  });
  const stop = () => {
    if (!drag) return;
    drag = null;
    el.classList.remove('dragging');
    end();
  };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  return () => drag !== null;
}

const CACHE = new WeakMap<HTMLElement, Surface>();

type PointTone = 'text' | 'accent' | 'violet';

export class Surface {
  readonly el: HTMLElement;
  private fn: SurfaceFunction;
  private zscale: number;
  private rate: number;
  private azimuth: number;
  private elevation: number;
  private zoom: number;
  private canvas: HTMLCanvasElement;
  private labels: HTMLElement[];
  private grids = new Map<Height, Float64Array>();
  private normals = new WeakMap<Float64Array, Float32Array>();
  private ranges = new Map<Height, [number, number]>();
  private textures = new Map<string, Three.DataTexture>();
  private zeros = new Float64Array((CELLS + 1) ** 2);
  private groove: Three.Vector3;
  private zmin = 0;
  private zmax = 0;
  private THREE: typeof Three;
  private scene: Three.Scene;
  private camera: Three.PerspectiveCamera;
  private sheets: SheetMesh[] = [];
  private plane: Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>;
  private curve: Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>;
  private glow: Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>;
  private points: Three.Points<Three.BufferGeometry, Three.ShaderMaterial>;
  private pointA: Float64Array;
  private pointB: Float64Array;
  private seen: Float32Array;
  private lit: Float32Array;
  private litTo: Float32Array;
  private fill: Float32Array;
  private fillTo: Float32Array;
  private pointTones: PointTone[];
  private palette: Record<PointTone, RGB> = { text: [0.95, 0.95, 0.94], accent: [0.94, 0.5, 0.31], violet: [0.79, 0.31, 0.9] };
  private pointKey = '';
  private seenAt = 0;
  private capacity = 0;
  private drawn = '';
  private mix = 1;
  private stateName = '';
  private shown: Shown;
  private from: Shown;
  private to: Shown;
  private t0 = 0;
  private duration = MORPH;
  private moving = false;
  private active = false;
  private raf = 0;
  private last = 0;
  private resume = 0;
  private dragging: () => boolean;
  private W = 0;
  private H = 0;
  private line = 1;
  private w = 0;
  private h = 0;

  constructor(el: HTMLElement, fn: SurfaceFunction, THREE: typeof Three) {
    this.el = el;
    this.fn = fn;
    this.THREE = THREE;
    this.groove = new THREE.Vector3();
    this.zscale = num(el.dataset.zscale, fn.zscale);
    const turn = num(el.dataset.turn, TURN);
    this.rate = turn > 0 ? (2 * Math.PI) / turn : 0;
    this.azimuth = (num(el.dataset.azimuth, -60) * Math.PI) / 180;
    this.elevation = (num(el.dataset.elevation, 32) * Math.PI) / 180;
    this.zoom = num(el.dataset.zoom, 1);
    for (const old of el.querySelectorAll(':scope > canvas.surface-image')) old.remove();
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'surface-image';
    this.canvas.setAttribute('aria-hidden', 'true');
    el.prepend(this.canvas);
    el.setAttribute('data-prevent-swipe', '');
    this.labels = [...el.querySelectorAll<HTMLElement>('.label')];
    typesetLabels(this.labels);

    for (const f of new Set(Object.values(fn.states).flatMap((state) => state({ ...el.dataset }).sheets.map((sheet) => sheet.height)))) {
      const g = sample(f, fn.x, fn.y, CELLS, CELLS, fn.floor);
      this.grids.set(f, g);
      this.ranges.set(f, this.range(g));
      for (const z of g) { if (z < this.zmin) this.zmin = z; if (z > this.zmax) this.zmax = z; }
    }
    this.pointA = new Float64Array(fn.points.length);
    this.pointB = new Float64Array(fn.points.length);
    this.seen = new Float32Array(fn.points.length).fill(1);
    this.lit = new Float32Array(fn.points.length).fill(1);
    this.litTo = new Float32Array(fn.points.length).fill(1);
    this.fill = new Float32Array(3 * fn.points.length);
    this.fillTo = new Float32Array(3 * fn.points.length);
    this.pointTones = fn.points.map(() => 'text');
    const still: Shown = { points: 0, cut: 0, level: fn.floor, low: this.zmin * this.zscale, high: this.zmax * this.zscale };
    this.shown = this.from = this.to = still;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    this.camera.up.set(0, 0, 1);
    this.plane = this.makePlane();
    this.curve = this.makeCurve(CURVE_WIDTH, 0);
    this.glow = this.makeCurve(GLOW_WIDTH, 1);
    this.glow.geometry = this.curve.geometry;
    this.glow.renderOrder = 1.5;
    this.points = this.makePoints();
    this.scene.add(this.plane, this.glow, this.curve, this.points);
    this.recolor();
    this.dragging = dragToTurn(el, (dx, dy) => this.turn(dx, dy), () => { this.resume = performance.now() + 1500; });
    CACHE.set(el, this);
    this.sync(false);
    this.fit();
  }

  private initialSheet(): Sheet {
    return this.fn.states[this.fn.initial]({ ...this.el.dataset }).sheets[0];
  }

  private range(g: Float64Array): [number, number] {
    const sorted = Float64Array.from(g).sort();
    const lo = sorted[Math.floor(0.05 * (sorted.length - 1))] * this.zscale, hi = sorted[sorted.length - 1] * this.zscale;
    return hi - lo > 1e-9 ? [lo, hi] : [hi - 1, hi + 1];
  }

  private texture(name: string): Three.DataTexture {
    const known = this.textures.get(name);
    if (known) return known;
    const THREE = this.THREE;
    const t = new THREE.DataTexture(new Uint8Array(4 * RAMP_TEXELS), RAMP_TEXELS, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.magFilter = t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    const stops = RAMPS[name];
    if (stops) {
      (t.image.data as Uint8Array).set(rampTexels(stops.map((c) => rgb(c, [0.5, 0.5, 0.5]))));
      t.needsUpdate = true;
    }
    this.textures.set(name, t);
    return t;
  }

  private paintOf(sheet: Sheet): Paint {
    let { ramp, range } = sheet.tone;
    if (ramp !== 'theme' && !(ramp in RAMPS)) {
      console.error(`beeson: unknown ramp "${ramp}" of ${this.el.dataset.function}, known: theme, ${Object.keys(RAMPS).join(', ')}`);
      ramp = 'theme';
    }
    const world: [number, number] = range ? [range[0] * this.zscale, range[1] * this.zscale] : (this.ranges.get(sheet.height) ?? [-1, 1]);
    return { key: `${ramp}|${world.join('|')}`, texture: this.texture(ramp), range: world };
  }

  private sheet(i: number): SheetMesh {
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
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    for (const [name, size] of [['zA', 1], ['zB', 1], ['nA', 3], ['nB', 3]] as const) {
      geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(size * n * n), size).setUsage(THREE.DynamicDrawUsage));
    }
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    const cell = Math.max(fn.x[1] - fn.x[0], fn.y[1] - fn.y[0]) / 24;
    const paint = this.paintOf(this.initialSheet());
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
      uGrid: { value: new THREE.Vector2(cell, cell) },
      uLine: { value: this.line },
    };
    const material = (colorWrite: boolean) => new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERTEX,
      fragmentShader: SURFACE_FRAGMENT,
      side: THREE.DoubleSide,
      transparent: true,
      colorWrite,
      uniforms,
    });
    const mesh = new THREE.Mesh(geometry, material(true)), depth = new THREE.Mesh(geometry, material(false));
    const group = new THREE.Group();
    for (const [k, o] of [depth, mesh].entries()) {
      o.frustumCulled = false;
      o.renderOrder = i * 0.1 + k * 0.01;
      group.add(o);
    }
    group.visible = false;
    this.scene.add(group);
    const hidden: Pose = { lift: 0, alpha: 0 };
    const s: SheetMesh = { group, mesh, depth, height: null, A: this.zeros, B: this.zeros, from: hidden, to: hidden, shown: hidden, paintA: paint, paintB: paint, toneFrom: 1, tone: 1, now: null };
    this.sheets[i] = s;
    return s;
  }

  private makePlane(): Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial> {
    const THREE = this.THREE, [x0, x1] = this.fn.x, [y0, y1] = this.fn.y;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0]), 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const material = new THREE.ShaderMaterial({
      vertexShader: PLANE_VERTEX,
      fragmentShader: PLANE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Vector3() }, uAlpha: { value: 0 } },
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    return mesh;
  }

  private makeCurve(width: number, soft: number): Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial> {
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
        uBias: { value: 0.004 },
      },
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    return mesh;
  }

  private makePoints(): Three.Points<Three.BufferGeometry, Three.ShaderMaterial> {
    const THREE = this.THREE, points = this.fn.points;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * points.length), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('kind', new THREE.BufferAttribute(Float32Array.from(points, (m) => (m.kind === 'saddle' ? 0 : 1)), 1));
    geometry.setAttribute('seen', new THREE.BufferAttribute(new Float32Array(points.length).fill(1), 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('lit', new THREE.BufferAttribute(new Float32Array(points.length).fill(1), 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('fill', new THREE.BufferAttribute(new Float32Array(3 * points.length), 3).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.ShaderMaterial({
      vertexShader: POINT_VERTEX,
      fragmentShader: POINT_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uRing: { value: new THREE.Vector3() },
        uRise: { value: 0 },
        uSize: { value: POINT_SIZE },
      },
    });
    const drawn = new THREE.Points(geometry, material);
    drawn.frustumCulled = false;
    drawn.renderOrder = 3;
    return drawn;
  }

  recolor(): void {
    const cs = getComputedStyle(this.el), css = (name: string, fallback: RGB) => rgb(cs.getPropertyValue(name), fallback);
    const bg = css('--bg', [0.02, 0.02, 0.02]), text = css('--text', [0.95, 0.95, 0.94]);
    const violet = css('--violet', [0.79, 0.31, 0.9]), accent = css('--accent', [0.94, 0.5, 0.31]);
    const blue = css('--data-5', [0, 0.45, 0.7]);
    const set = (target: Three.Vector3, c: RGB) => target.set(c[0], c[1], c[2]);
    const theme = this.texture('theme');
    (theme.image.data as Uint8Array).set(rampTexels([mix3(blue, bg, 0.7), mix3(blue, violet, 0.35), violet, mix3(violet, text, 0.55)]));
    theme.needsUpdate = true;
    set(this.groove, bg);
    set(this.plane.material.uniforms.uColor.value, accent);
    set(this.curve.material.uniforms.uColor.value, mix3(accent, text, 0.35));
    set(this.glow.material.uniforms.uColor.value, accent);
    set(this.points.material.uniforms.uRing.value, bg);
    this.palette = { text, accent, violet };
    this.paintPoints();
    this.fill.set(this.fillTo);
  }

  private target(): { name: string; state: State; step: HTMLElement | null } {
    let best: HTMLElement | null = null, index = -Infinity;
    for (const f of this.el.closest('section')?.querySelectorAll<HTMLElement>('.fragment.visible[data-surface-state]') ?? []) {
      const i = num(f.dataset.fragmentIndex, 0);
      if (i >= index) { best = f; index = i; }
    }
    let name = best?.dataset.surfaceState ?? this.el.dataset.surfaceState ?? this.fn.initial;
    if (!(name in this.fn.states)) {
      console.error(`beeson: unknown surface state "${name}" of ${this.el.dataset.function}, known: ${Object.keys(this.fn.states).join(', ')}`);
      name = this.fn.initial;
    }
    return { name, state: this.fn.states[name]({ ...this.el.dataset, ...best?.dataset }), step: best };
  }

  private repaint(s: SheetMesh, p: Paint): void {
    if (p.key === s.paintB.key) s.toneFrom = s.tone;
    else if (p.key === s.paintA.key) { s.paintA = s.paintB; s.toneFrom = 1 - s.tone; s.paintB = p; }
    else { s.paintA = s.tone < 0.5 ? s.paintA : s.paintB; s.paintB = p; s.toneFrom = 0; }
    const u = s.mesh.material.uniforms;
    u.uRampA.value = s.paintA.texture;
    u.uRampB.value = s.paintB.texture;
    u.uRangeA.value.set(...s.paintA.range);
    u.uRangeB.value.set(...s.paintB.range);
  }

  private pointTargets(step: HTMLElement | null): string {
    const names = (key: string) => (step?.dataset[key] ?? '').split(/[\s,]+/).filter(Boolean);
    const lit = names('surfacePoints'), accent = names('surfaceAccent'), violet = names('surfaceViolet');
    this.fn.points.forEach((m, i) => {
      this.litTo[i] = !lit.length || lit.includes(m.name) ? 1 : UNLIT;
      this.pointTones[i] = violet.includes(m.name) ? 'violet' : accent.includes(m.name) ? 'accent' : 'text';
    });
    this.paintPoints();
    return JSON.stringify([lit, accent, violet]);
  }

  private paintPoints(): void {
    this.pointTones.forEach((tone, i) => this.fillTo.set(this.palette[tone], 3 * i));
  }

  private pointsSettled(): boolean {
    for (let i = 0; i < this.lit.length; i++) if (Math.abs(this.lit[i] - this.litTo[i]) > 1e-3) return false;
    for (let i = 0; i < this.fill.length; i++) if (Math.abs(this.fill[i] - this.fillTo[i]) > 1e-3) return false;
    return true;
  }

  sync(animate: boolean): void {
    const { name, state, step } = this.target();
    const pointKey = this.pointTargets(step);
    const jump = !animate || !this.stateName;
    if (jump) {
      this.lit.set(this.litTo);
      this.fill.set(this.fillTo);
    }
    if (name === this.stateName) {
      if (pointKey !== this.pointKey) {
        this.pointKey = pointKey;
        if (jump) this.draw();
        else {
          this.seenAt = performance.now();
          this.kick();
        }
      }
      return;
    }
    this.pointKey = pointKey;
    this.stateName = name;
    this.el.dataset.shown = name;
    const s = this.zscale, sheets = state.sheets.length ? state.sheets : [this.initialSheet()], main = sheets[0];
    const grid = (height: Height) => this.grids.get(height) ?? this.zeros;
    const first = this.sheets[0];
    const merge = !first || first.height !== main.height;
    const was = first ? { heights: this.current(first), lift: first.shown.lift, paint: first.tone < 0.5 ? first.paintA : first.paintB } : null;
    const lifts: number[] = [];
    for (let i = 0; i < Math.max(this.sheets.length, sheets.length); i++) {
      const sheet = this.sheet(i), next = sheets[i], seen = sheet.shown.alpha > 0;
      if (!next && !seen) {
        sheet.height = null;
        sheet.from = sheet.to = sheet.shown;
        continue;
      }
      const heights = this.current(sheet);
      if (next) {
        const paint = this.paintOf(next);
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
          sheet.from = { lift: (i > 0 && first ? first.shown.lift : next.lift * s), alpha: 0 };
          sheet.paintA = sheet.paintB = paint;
          sheet.tone = 1;
        }
        sheet.B = grid(next.height);
        sheet.to = { lift: next.lift * s, alpha: 1 };
        sheet.height = next.height;
        this.repaint(sheet, paint);
        lifts.push(next.lift * s);
      } else {
        sheet.A = heights;
        sheet.from = sheet.shown;
        sheet.height = null;
        sheet.B = merge ? grid(main.height) : this.zeros;
        sheet.to = { lift: main.lift * s, alpha: 0 };
        this.repaint(sheet, merge ? this.paintOf(main) : sheet.paintB);
      }
    }
    const to: Shown = {
      points: state.points ? 1 : 0,
      cut: state.level === null ? 0 : 1,
      level: state.level ?? this.fn.floor,
      low: this.zmin * s + Math.min(...lifts),
      high: this.zmax * s + Math.max(...lifts),
    };
    const counted = (shown: (sheet: SheetMesh) => boolean) => this.sheets.filter(shown).length;
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
    this.fn.points.forEach((m, i) => {
      this.pointA[i] = heightAt(lead.A, this.fn, m.x, m.y);
      this.pointB[i] = heightAt(lead.B, this.fn, m.x, m.y);
    });
    for (const sheet of this.sheets) this.upload(sheet);
    if (this.moving) this.kick();
    else this.draw();
  }

  private current(sheet: SheetMesh): Float64Array {
    if (this.mix >= 1 || sheet.A === sheet.B) return sheet.B;
    const now = sheet.now, a = sheet.A, b = sheet.B, t = this.mix;
    if (now && now.a === a && now.b === b && now.mix === t) return now.grid;
    const grid = a.map((z, i) => z + (b[i] - z) * t);
    sheet.now = { a, b, mix: t, grid };
    return grid;
  }

  private normalsOf(g: Float64Array): Float32Array {
    const cached = this.normals.get(g);
    if (cached) return cached;
    const n = CELLS + 1, out = new Float32Array(3 * n * n), s = this.zscale;
    const dx = (this.fn.x[1] - this.fn.x[0]) / CELLS, dy = (this.fn.y[1] - this.fn.y[0]) / CELLS;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const at = (a: number, b: number) => g[clamp(b, 0, CELLS) * n + clamp(a, 0, CELLS)];
      const gx = (s * (at(i + 1, j) - at(i - 1, j))) / ((Math.min(i + 1, CELLS) - Math.max(i - 1, 0)) * dx);
      const gy = (s * (at(i, j + 1) - at(i, j - 1))) / ((Math.min(j + 1, CELLS) - Math.max(j - 1, 0)) * dy);
      const r = Math.hypot(gx, gy, 1), k = 3 * (j * n + i);
      out[k] = -gx / r; out[k + 1] = -gy / r; out[k + 2] = 1 / r;
    }
    this.normals.set(g, out);
    return out;
  }

  private upload(sheet: SheetMesh): void {
    const geometry = sheet.mesh.geometry, s = this.zscale;
    const zA = geometry.getAttribute('zA') as Three.BufferAttribute, zB = geometry.getAttribute('zB') as Three.BufferAttribute;
    for (let i = 0; i < sheet.A.length; i++) { zA.array[i] = sheet.A[i] * s; zB.array[i] = sheet.B[i] * s; }
    (geometry.getAttribute('nA') as Three.BufferAttribute).set(this.normalsOf(sheet.A));
    (geometry.getAttribute('nB') as Three.BufferAttribute).set(this.normalsOf(sheet.B));
    for (const name of ['zA', 'zB', 'nA', 'nB']) geometry.getAttribute(name).needsUpdate = true;
  }

  private pointAt(i: number, p: Three.Vector3): Three.Vector3 {
    const m = this.fn.points[i];
    return p.set(m.x, m.y, lerp(this.pointA[i], this.pointB[i], this.mix) * this.zscale + this.sheet(0).shown.lift);
  }

  probe(): { state: string; settled: boolean; points: { name: string; z: number; surface: number; fade: number; label: number | null; lit: number; tone: PointTone }[] } {
    const position = this.points.geometry.getAttribute('position') as Three.BufferAttribute, lead = this.sheet(0), g = this.current(lead);
    const fade = this.points.visible ? this.shown.points : 0;
    const camera = this.camera.clone(), p = new this.THREE.Vector3();
    camera.updateMatrixWorld();
    const label = (i: number) => {
      const lab = this.labels.find((l) => l.dataset.at === this.fn.points[i].name);
      if (!lab) return null;
      this.pointAt(i, p).project(camera);
      const x = ((p.x + 1) / 2) * this.w + num(lab.dataset.dx, 0), y = ((1 - p.y) / 2) * this.h + num(lab.dataset.dy, -34);
      return Math.hypot(parseFloat(lab.style.left) - x, parseFloat(lab.style.top) - y);
    };
    return {
      state: this.stateName,
      settled: !this.moving,
      points: this.fn.points.map((m, i) => ({ name: m.name, z: position.getZ(i), surface: heightAt(g, this.fn, m.x, m.y) * this.zscale + lead.shown.lift, fade, label: label(i), lit: this.lit[i], tone: this.pointTones[i] })),
    };
  }

  fit(dpr = devicePixelRatio || 1, lines = dpr): void {
    const r = this.el.getBoundingClientRect();
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    if (!r.width || !r.height || !w || !h) return;
    this.line = dpr / lines;
    this.W = Math.max(1, Math.round(r.width * dpr));
    this.H = Math.max(1, Math.round(r.height * dpr));
    this.w = w;
    this.h = h;
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    const px = (dpr * r.height) / h;
    this.curve.material.uniforms.uViewport.value.set(this.W, this.H);
    this.curve.material.uniforms.uWidth.value = CURVE_WIDTH * px;
    this.glow.material.uniforms.uViewport.value.set(this.W, this.H);
    this.glow.material.uniforms.uWidth.value = GLOW_WIDTH * px;
    this.points.material.uniforms.uSize.value = POINT_SIZE * px;
    this.camera.aspect = this.W / this.H;
    this.draw();
  }

  private aim(): void {
    const fn = this.fn, { low, high } = this.shown;
    const cx = (fn.x[0] + fn.x[1]) / 2, cy = (fn.y[0] + fn.y[1]) / 2, cz = (low + high) / 2;
    const wide = Math.hypot(fn.x[1] - fn.x[0], fn.y[1] - fn.y[0]), R = 0.5 * Math.hypot(wide, high - low);
    const v = (this.camera.fov * Math.PI) / 360, half = Math.min(v, Math.atan(Math.tan(v) * this.camera.aspect));
    const one = 0.5 * Math.hypot(wide, (this.zmax - this.zmin) * this.zscale) / Math.sin(half);
    const tall = (0.5 * ((high - low) * Math.cos(this.elevation) + wide * Math.sin(this.elevation))) / Math.tan(v);
    const d = Math.max(0.86 * one, tall) / this.zoom;
    const c = Math.cos(this.elevation);
    this.camera.position.set(cx + d * c * Math.cos(this.azimuth), cy + d * c * Math.sin(this.azimuth), cz + d * Math.sin(this.elevation));
    this.camera.near = Math.max(0.01, d - 2 * R);
    this.camera.far = d + 2 * R;
    this.camera.lookAt(cx, cy, cz);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  private trace(): void {
    const lead = this.sheet(0);
    const key = this.shown.cut > 0 ? `${this.shown.level}|${this.mix}|${lead.height ? [...this.grids.keys()].indexOf(lead.height) : -1}` : '';
    if (key === this.drawn) return;
    this.drawn = key;
    const curves = key ? levelCurves(this.current(lead), this.fn.x, this.fn.y, CELLS, CELLS, this.shown.level) : [];
    const count = curves.reduce((total, c) => total + Math.max(0, c.length / 2 - 1), 0);
    const geometry = this.curve.geometry, THREE = this.THREE;
    if (count > this.capacity) {
      this.capacity = Math.max(1024, 2 * count);
      const corner = new Float32Array(12 * this.capacity);
      const quad = [0, -1, 1, -1, 1, 1, 0, -1, 1, 1, 0, 1];
      for (let i = 0; i < this.capacity; i++) corner.set(quad, 12 * i);
      geometry.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
      geometry.setAttribute('start', new THREE.BufferAttribute(new Float32Array(18 * this.capacity), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('end', new THREE.BufferAttribute(new Float32Array(18 * this.capacity), 3).setUsage(THREE.DynamicDrawUsage));
    }
    if (!this.capacity) return;
    const start = geometry.getAttribute('start') as Three.BufferAttribute, end = geometry.getAttribute('end') as Three.BufferAttribute;
    const a = start.array, b = end.array, z = this.shown.level * this.zscale;
    let k = 0;
    for (const c of curves) {
      for (let i = 0; i + 3 < c.length; i += 2) {
        for (let v = 0; v < 6; v++, k += 3) {
          a[k] = c[i]; a[k + 1] = c[i + 1]; a[k + 2] = z;
          b[k] = c[i + 2]; b[k + 1] = c[i + 3]; b[k + 2] = z;
        }
      }
    }
    for (const attribute of [start, end]) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, k);
      attribute.needsUpdate = true;
    }
    geometry.setDrawRange(0, 6 * count);
  }

  draw(): void {
    if (!this.W) return;
    const r = renderer();
    if (!r) return;
    const shown = this.shown;
    for (const s of this.sheets) {
      const u = s.mesh.material.uniforms;
      u.uMix.value = this.mix;
      u.uTone.value = s.tone;
      u.uLine.value = this.line;
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
    this.points.material.uniforms.uRise.value = shown.points;
    this.points.visible = shown.points > 0;
    this.trace();
    this.aim();
    this.place();
    if (r.domElement.width !== this.W || r.domElement.height !== this.H) r.setSize(this.W, this.H, false);
    r.render(this.scene, this.camera);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.drawImage(r.domElement, 0, 0);
  }

  private place(): void {
    const THREE = this.THREE, p = new THREE.Vector3();
    const position = this.points.geometry.getAttribute('position') as Three.BufferAttribute;
    const seen = this.points.geometry.getAttribute('seen') as Three.BufferAttribute;
    const now = performance.now(), dt = (now - this.seenAt) / 1000;
    this.seenAt = now;
    const lit = this.points.geometry.getAttribute('lit') as Three.BufferAttribute;
    const fill = this.points.geometry.getAttribute('fill') as Three.BufferAttribute;
    const k = dt > 0.25 ? 1 : 1 - Math.exp(-dt / DIMMING);
    const f = !this.active || dt > 0.25 ? 1 : 1 - Math.exp(-dt / POINT_FADE);
    this.fn.points.forEach((m, i) => {
      this.pointAt(i, p);
      position.setXYZ(i, p.x, p.y, p.z);
      this.seen[i] += ((this.behind(p) ? BEHIND : 1) - this.seen[i]) * k;
      seen.setX(i, this.seen[i]);
      this.lit[i] += (this.litTo[i] - this.lit[i]) * f;
      lit.setX(i, this.lit[i]);
      for (let c = 0; c < 3; c++) this.fill[3 * i + c] += (this.fillTo[3 * i + c] - this.fill[3 * i + c]) * f;
      fill.setXYZ(i, this.fill[3 * i], this.fill[3 * i + 1], this.fill[3 * i + 2]);
    });
    position.needsUpdate = seen.needsUpdate = lit.needsUpdate = fill.needsUpdate = true;
    for (const lab of this.labels) {
      const i = this.fn.points.findIndex((m) => m.name === lab.dataset.at);
      if (i < 0) continue;
      this.pointAt(i, p).project(this.camera);
      lab.style.left = `${((p.x + 1) / 2) * this.w + num(lab.dataset.dx, 0)}px`;
      lab.style.top = `${((1 - p.y) / 2) * this.h + num(lab.dataset.dy, -34)}px`;
      lab.style.opacity = String(this.shown.points ** 2 * this.seen[i] * this.lit[i]);
    }
  }

  private behind(p: Three.Vector3): boolean {
    const fn = this.fn, lead = this.sheet(0), g = this.current(lead), cam = this.camera.position;
    for (let k = 1; k <= 80; k++) {
      const t = 0.01 + (k / 80) * 0.99;
      const x = p.x + (cam.x - p.x) * t, y = p.y + (cam.y - p.y) * t, z = p.z + 0.03 + (cam.z - p.z) * t;
      if (x < fn.x[0] || x > fn.x[1] || y < fn.y[0] || y > fn.y[1]) return false;
      if (heightAt(g, fn, x, y) * this.zscale + lead.shown.lift > z) return true;
    }
    return false;
  }

  private kick(): void {
    if (this.active && !this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.raf = 0;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    if (this.moving) {
      const k = Math.min(1, (now - this.t0) / this.duration), e = ease(k), a = this.from, b = this.to;
      const late = ease(clamp((k - 0.35) / 0.65, 0, 1)), early = ease(clamp(k / 0.65, 0, 1));
      this.mix = e;
      this.shown = { points: lerp(a.points, b.points, b.points > a.points ? late : early), cut: lerp(a.cut, b.cut, e), level: lerp(a.level, b.level, e), low: lerp(a.low, b.low, e), high: lerp(a.high, b.high, e) };
      for (const s of this.sheets) {
        s.shown = { lift: lerp(s.from.lift, s.to.lift, e), alpha: lerp(s.from.alpha, s.to.alpha, s.to.alpha > s.from.alpha ? early : late) };
        s.tone = lerp(s.toneFrom, 1, e);
      }
      if (k >= 1) this.settle();
    }
    if (this.rate && !this.dragging() && now > this.resume) this.azimuth += dt * this.rate;
    this.draw();
    if (this.moving || this.rate || !this.pointsSettled()) this.kick();
  };

  private settle(): void {
    if (!this.moving) return;
    this.moving = false;
    this.mix = 1;
    this.shown = this.to;
    for (const s of this.sheets) {
      s.shown = s.to;
      s.tone = 1;
    }
  }

  turn(dx: number, dy: number): void {
    const scale = this.el.getBoundingClientRect().width / (this.el.offsetWidth || 1) || 1;
    this.azimuth -= (dx / scale) * 0.005;
    this.elevation = clamp(this.elevation + (dy / scale) * 0.004, 0.12, 1.45);
    if (!this.raf) this.draw();
  }

  view(): { azimuth: number; elevation: number; zoom: number; written: { azimuth: number; elevation: number; zoom: number; turn: number; zscale: number } } {
    const d = this.el.dataset, deg = 180 / Math.PI;
    return {
      azimuth: this.azimuth * deg,
      elevation: this.elevation * deg,
      zoom: this.zoom,
      written: { azimuth: num(d.azimuth, -60), elevation: num(d.elevation, 32), zoom: num(d.zoom, 1), turn: num(d.turn, TURN), zscale: num(d.zscale, this.fn.zscale) },
    };
  }

  configure(): void {
    const w = this.view().written;
    this.rate = w.turn > 0 ? (2 * Math.PI) / w.turn : 0;
    this.azimuth = (w.azimuth * Math.PI) / 180;
    this.elevation = (w.elevation * Math.PI) / 180;
    this.zoom = w.zoom;
    if (w.zscale !== this.zscale) {
      this.zscale = w.zscale;
      for (const [name, g] of this.grids) this.ranges.set(name, this.range(g));
      this.normals = new WeakMap();
      this.drawn = '';
      this.stateName = '';
      this.sync(false);
    }
    this.draw();
  }

  follow(other: Surface): void {
    this.azimuth = other.azimuth;
    this.elevation = other.elevation;
    this.resume = other.resume;
  }

  start(): void {
    this.active = true;
    this.last = 0;
    if (this.moving || this.rate) this.kick();
    else this.draw();
  }

  stop(): void {
    this.active = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.settle();
  }
}

export function mount(root: ParentNode): Surface[] {
  const out: Surface[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('.surface:not([data-bundle])')) {
    const known = CACHE.get(el);
    if (known) { out.push(known); continue; }
    const fn = surfaceFunction(el.dataset.function ?? '', el.dataset);
    if (!fn) {
      console.error(`beeson: unknown surface function "${el.dataset.function ?? ''}", known: ${FUNCTION_NAMES.join(', ')}`);
      continue;
    }
    if (!renderer() || !window.THREE) continue;
    out.push(new Surface(el, fn, window.THREE));
  }
  return out;
}
