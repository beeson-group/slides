// a `.surface`: the graph z = f(x, y) of a function of surfaces.ts over its rectangle, drawn with
// three.js under an orbit camera that turns slowly. its stage is set by the fragments of its slide
// with data-surface-stage, and a change of stage is animated. the heights are morphed, the marks
// are raised into place, and the cutting plane is slid to its level, where the curve of
// intersection is drawn. three.js is the global THREE of theme/vendor/three/three.js. one WebGL
// renderer is shared by every surface of the page, and its image is copied to a 2D canvas in each
// element. hence the page of each step in the print view does not hold a WebGL context of its own

import type * as Three from 'three';
import { FUNCTION_NAMES, clamped, levelCurves, sample, surfaceFunction } from './surfaces.ts';
import type { Stage, SurfaceFunction } from './surfaces.ts';

declare global {
  interface Window {
    THREE?: typeof Three;
  }
}

type RGB = [number, number, number];
// the values drawn at a frame: the color range of the heights in world units, the progress of the
// marks and of the cut from 0 to 1, and the height of the cutting plane, nondimensional
type Shown = { lo: number; hi: number; marks: number; cut: number; level: number };

// cells along each side of the rectangle
const CELLS = 200;
// milliseconds of a change of stage, and of a change that slides the cutting plane
const MORPH = 1400;
const SLIDE = 2600;
// the default seconds per turn of the camera
const TURN = 90;
// world units by which a mark is raised into place
const RISE = 0.4;
// widths in slide pixels: the curve of intersection and the marks
const CURVE_WIDTH = 3.5;
const MARK_SIZE = 22;

const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const num = (v: string | undefined, fallback: number): number => (v !== undefined && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback);
const mix3 = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// a CSS color of the form #rgb, #rrggbb, or rgb(), as RGB in 0 to 1. the alpha of rgba() is dropped
function rgb(css: string, fallback: RGB): RGB {
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

const SURFACE_VERTEX = /* glsl */ `
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

// the color ramp of the heights through the four colors uRamp, a Lambert shade under a fixed light,
// and grid lines of constant x and y, antialiased over one pixel
const SURFACE_FRAGMENT = /* glsl */ `
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
}`;

const PLANE_VERTEX = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const PLANE_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
void main() {
  gl_FragColor = vec4(uColor, uAlpha);
}`;

// a segment from start to end drawn as a quad of uWidth pixels on the screen, lengthened by half
// its width at both ends so that the segments of a curve overlap at their joints. the depth is
// moved toward the camera by uBias, since the curve lies on the surface
const LINE_VERTEX = /* glsl */ `
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

const LINE_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uWidth;
varying float vSide;
void main() {
  float s = abs(vSide);
  float edge = 1.0 - smoothstep(1.0 - 2.0 / uWidth, 1.0, s);
  gl_FragColor = vec4(uColor, uAlpha * edge);
}`;

// a mark is raised into place by RISE world units, and is grown while it is faded in. a saddle is
// drawn as a ring, and a maximum or a minimum as a disc, each outlined in the background color
const MARK_VERTEX = /* glsl */ `
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
}`;

const MARK_FRAGMENT = /* glsl */ `
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
}`;

let shared: Three.WebGLRenderer | null | undefined;

// the renderer of every surface of the page, created on first use, or null without THREE or WebGL,
// which is reported once
function renderer(): Three.WebGLRenderer | null {
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
    // the colors of the shaders are the sRGB values of the theme, written without a conversion
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    shared = r;
  } catch (error) {
    console.warn(`beeson: WebGL is not available for the surfaces, ${String(error)}`);
  }
  return shared;
}

const CACHE = new WeakMap<HTMLElement, Surface>();

/** One drawing per `.surface` element, made with mount(). */
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
  private grids = new Map<string, Float64Array>();
  private normals = new WeakMap<Float64Array, Float32Array>();
  private ranges = new Map<string, [number, number]>();
  private zmin = 0;
  private zmax = 0;
  private THREE: typeof Three;
  private scene: Three.Scene;
  private camera: Three.PerspectiveCamera;
  private surface: Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>;
  private plane: Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>;
  private curve: Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>;
  private points: Three.Points<Three.BufferGeometry, Three.ShaderMaterial>;
  private capacity = 0;
  private drawn = '';
  private A: Float64Array;
  private B: Float64Array;
  private mix = 1;
  private stageName = '';
  private markLayer = '';
  private shown: Shown;
  private from: Shown;
  private to: Shown;
  private t0 = 0;
  private duration = MORPH;
  private moving = false;
  private active = false;
  private raf = 0;
  private last = 0;
  private W = 0;
  private H = 0;
  private w = 0;
  private h = 0;

  constructor(el: HTMLElement, fn: SurfaceFunction, THREE: typeof Three) {
    this.el = el;
    this.fn = fn;
    this.THREE = THREE;
    this.zscale = num(el.dataset.zscale, fn.zscale);
    const turn = num(el.dataset.turn, TURN);
    this.rate = turn > 0 ? (2 * Math.PI) / turn : 0;
    this.azimuth = (num(el.dataset.azimuth, -60) * Math.PI) / 180;
    this.elevation = (num(el.dataset.elevation, 32) * Math.PI) / 180;
    this.zoom = num(el.dataset.zoom, 1);
    // a canvas cloned with a slide is blank, and a page per step is cloned in the print view of
    // reveal.js
    for (const old of el.querySelectorAll(':scope > canvas.surface-image')) old.remove();
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'surface-image';
    this.canvas.setAttribute('aria-hidden', 'true');
    el.prepend(this.canvas);
    this.labels = [...el.querySelectorAll<HTMLElement>('.lab')];

    for (const [name, f] of Object.entries(fn.layers)) {
      const g = sample(f, fn.x, fn.y, CELLS, CELLS, fn.floor);
      this.grids.set(name, g);
      this.ranges.set(name, this.range(g));
      for (const z of g) { if (z < this.zmin) this.zmin = z; if (z > this.zmax) this.zmax = z; }
    }
    this.A = this.B = this.grids.get(fn.initial) ?? new Float64Array((CELLS + 1) ** 2);
    const [lo, hi] = this.ranges.get(fn.initial) ?? [0, 1];
    this.shown = this.from = this.to = { lo, hi, marks: 0, cut: 0, level: fn.floor };

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    this.camera.up.set(0, 0, 1);
    this.surface = this.makeSurface();
    this.plane = this.makePlane();
    this.curve = this.makeCurve(CURVE_WIDTH);
    this.points = this.makeMarks();
    this.scene.add(this.surface, this.plane, this.curve, this.points);
    this.recolor();
    CACHE.set(el, this);
    this.sync(false);
    this.fit();
  }

  // the color range of a layer: from its 5th percentile, so that the deep wells do not take the
  // whole ramp, to its maximum, in world units. a flat layer is drawn in the middle of the ramp
  private range(g: Float64Array): [number, number] {
    const sorted = Float64Array.from(g).sort();
    const lo = sorted[Math.floor(0.05 * (sorted.length - 1))] * this.zscale, hi = sorted[sorted.length - 1] * this.zscale;
    return hi - lo > 1e-9 ? [lo, hi] : [hi - 1, hi + 1];
  }

  private makeSurface(): Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial> {
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
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    for (const [name, size] of [['zA', 1], ['zB', 1], ['nA', 3], ['nB', 3]] as const) {
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
        uGrid: { value: new THREE.Vector2(cell, cell) },
      },
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
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

  // the segments of a curve as quads of width pixels
  private makeCurve(width: number): Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial> {
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
        uViewport: { value: new THREE.Vector2(1, 1) },
        uBias: { value: 0.004 },
      },
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    return mesh;
  }

  private makeMarks(): Three.Points<Three.BufferGeometry, Three.ShaderMaterial> {
    const THREE = this.THREE, marks = this.fn.marks;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * marks.length), 3));
    geometry.setAttribute('kind', new THREE.BufferAttribute(Float32Array.from(marks, (m) => (m.kind === 'saddle' ? 0 : 1)), 1));
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
        uBias: { value: 0.006 },
      },
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = 3;
    return points;
  }

  /** Reads the colors of the theme from the custom properties of the element, e.g. after a flip of the mode. */
  recolor(): void {
    const cs = getComputedStyle(this.el), css = (name: string, fallback: RGB) => rgb(cs.getPropertyValue(name), fallback);
    const bg = css('--bg', [0.02, 0.02, 0.02]), text = css('--text', [0.95, 0.95, 0.94]);
    const violet = css('--violet', [0.79, 0.31, 0.9]), accent = css('--accent', [0.94, 0.5, 0.31]);
    const blue = css('--data-5', [0, 0.45, 0.7]);
    const u = this.surface.material.uniforms, set = (target: Three.Vector3, c: RGB) => target.set(c[0], c[1], c[2]);
    // in either mode, the deep part of the surface is shaded through blue into the background, and
    // its high part is shaded through violet up to the color of the text
    const ramp: RGB[] = [mix3(blue, bg, 0.7), mix3(blue, violet, 0.35), violet, mix3(violet, text, 0.55)];
    ramp.forEach((c, i) => set(u.uRamp.value[i], c));
    set(u.uGroove.value, bg);
    set(this.plane.material.uniforms.uColor.value, accent);
    set(this.curve.material.uniforms.uColor.value, mix3(accent, text, 0.35));
    set(this.points.material.uniforms.uFill.value, text);
    set(this.points.material.uniforms.uRing.value, bg);
  }

  // the stage set by the visible fragment of the slide with data-surface-stage and the highest
  // fragment index, or the data-stage of the element, or the initial stage of the function
  private target(): { name: string; stage: Stage } {
    let best: HTMLElement | null = null, index = -Infinity;
    for (const f of this.el.closest('section')?.querySelectorAll<HTMLElement>('.fragment.visible[data-surface-stage]') ?? []) {
      const i = num(f.dataset.fragmentIndex, 0);
      if (i >= index) { best = f; index = i; }
    }
    let name = best?.dataset.surfaceStage ?? this.el.dataset.stage ?? this.fn.initial;
    if (!(name in this.fn.stages)) {
      console.error(`beeson: unknown surface stage "${name}" of ${this.el.dataset.function}, known: ${Object.keys(this.fn.stages).join(', ')}`);
      name = this.fn.initial;
    }
    return { name, stage: this.fn.stages[name]({ ...this.el.dataset, ...best?.dataset }) };
  }

  /** Sets the stage from the fragments of the slide, animated or at once. */
  sync(animate: boolean): void {
    const { name, stage } = this.target();
    if (name === this.stageName) return;
    const first = !this.stageName;
    this.stageName = name;
    this.el.dataset.shown = name;
    const grid = this.grids.get(stage.layer) ?? this.B;
    const [lo, hi] = this.ranges.get(stage.layer) ?? [this.shown.lo, this.shown.hi];
    const to: Shown = { lo, hi, marks: stage.marks ? 1 : 0, cut: stage.level === null ? 0 : 1, level: stage.level ?? this.fn.floor };
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
      // a plane not shown before is slid up from the floor, and a plane that is removed is slid down
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
  private current(): Float64Array {
    if (this.mix >= 1 || this.A === this.B) return this.B;
    const a = this.A, b = this.B, t = this.mix;
    return a.map((z, i) => z + (b[i] - z) * t);
  }

  // the unit normals of the heights g in world units, by central differences
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

  private upload(): void {
    const geometry = this.surface.geometry, s = this.zscale;
    const zA = geometry.getAttribute('zA') as Three.BufferAttribute, zB = geometry.getAttribute('zB') as Three.BufferAttribute;
    for (let i = 0; i < this.A.length; i++) { zA.array[i] = this.A[i] * s; zB.array[i] = this.B[i] * s; }
    (geometry.getAttribute('nA') as Three.BufferAttribute).set(this.normalsOf(this.A));
    (geometry.getAttribute('nB') as Three.BufferAttribute).set(this.normalsOf(this.B));
    for (const name of ['zA', 'zB', 'nA', 'nB']) geometry.getAttribute(name).needsUpdate = true;
  }

  // the marks on the layer, in world units
  private placeMarks(layer: string): void {
    if (layer === this.markLayer) return;
    this.markLayer = layer;
    const f = clamped(this.fn.layers[layer] ?? (() => 0), this.fn.floor);
    const position = this.points.geometry.getAttribute('position') as Three.BufferAttribute;
    this.fn.marks.forEach((m, i) => position.setXYZ(i, m.x, m.y, f(m.x, m.y) * this.zscale));
    position.needsUpdate = true;
  }

  /** Sizes the canvas from the box of the element on the screen, and draws. */
  fit(): void {
    // the slide is scaled with a transform in reveal.js, hence the canvas is sized from the screen
    // rectangle and the labels are placed in the pixels of the slide
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
    this.curve.material.uniforms.uViewport.value.set(this.W, this.H);
    this.curve.material.uniforms.uWidth.value = CURVE_WIDTH * px;
    this.points.material.uniforms.uSize.value = MARK_SIZE * px;
    this.camera.aspect = this.W / this.H;
    this.draw();
  }

  // the camera on a sphere about the middle of the box of the surface, at a distance at which the
  // sphere around the box fits the narrower field of view, divided by data-zoom
  private aim(): void {
    const fn = this.fn, s = this.zscale;
    const cx = (fn.x[0] + fn.x[1]) / 2, cy = (fn.y[0] + fn.y[1]) / 2, cz = ((this.zmin + this.zmax) / 2) * s;
    const R = 0.5 * Math.hypot(fn.x[1] - fn.x[0], fn.y[1] - fn.y[0], (this.zmax - this.zmin) * s);
    const v = (this.camera.fov * Math.PI) / 360, half = Math.min(v, Math.atan(Math.tan(v) * this.camera.aspect));
    const d = (R / Math.sin(half)) * 0.86 / this.zoom;
    const c = Math.cos(this.elevation);
    this.camera.position.set(cx + d * c * Math.cos(this.azimuth), cy + d * c * Math.sin(this.azimuth), cz + d * Math.sin(this.elevation));
    this.camera.near = Math.max(0.01, d - 2 * R);
    this.camera.far = d + 2 * R;
    this.camera.lookAt(cx, cy, cz);
    this.camera.updateProjectionMatrix();
  }

  // the curve of intersection of the plane at the level shown, recomputed when the level or the
  // heights have changed
  private trace(): void {
    const key = this.shown.cut > 0 ? `${this.shown.level}|${this.mix}|${this.markLayer}` : '';
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

  /** Draws the surface at the stage and the camera of now, and places the labels. */
  draw(): void {
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
    this.points.material.uniforms.uRise.value = shown.marks;
    this.points.visible = shown.marks > 0;
    this.trace();
    this.aim();
    if (r.domElement.width !== this.W || r.domElement.height !== this.H) r.setSize(this.W, this.H, false);
    r.render(this.scene, this.camera);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    // in the same task as the render, since the drawing buffer of WebGL is cleared after a frame
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.drawImage(r.domElement, 0, 0);
    this.place();
  }

  // the labels at their marks, in the pixels of the slide, faded with the marks and dimmed behind
  // the surface
  private place(): void {
    const THREE = this.THREE, p = new THREE.Vector3(), lift = (1 - this.shown.marks) * RISE;
    const position = this.points.geometry.getAttribute('position') as Three.BufferAttribute;
    for (const lab of this.labels) {
      const i = this.fn.marks.findIndex((m) => m.name === lab.dataset.at);
      if (i < 0) continue;
      p.set(position.getX(i), position.getY(i), position.getZ(i) - lift);
      const hidden = this.behind(p);
      p.project(this.camera);
      lab.style.left = `${((p.x + 1) / 2) * this.w + num(lab.dataset.dx, 0)}px`;
      lab.style.top = `${((1 - p.y) / 2) * this.h + num(lab.dataset.dy, -34)}px`;
      lab.style.opacity = String(this.shown.marks ** 2 * (hidden ? 0.3 : 1));
    }
  }

  // whether the surface is between the world point p, a little above it, and the camera
  private behind(p: Three.Vector3): boolean {
    const fn = this.fn, g = this.current(), n = CELLS + 1, cam = this.camera.position;
    const height = (x: number, y: number): number | null => {
      const u = ((x - fn.x[0]) / (fn.x[1] - fn.x[0])) * CELLS, v = ((y - fn.y[0]) / (fn.y[1] - fn.y[0])) * CELLS;
      if (u < 0 || v < 0 || u > CELLS || v > CELLS) return null;
      const i = Math.min(CELLS - 1, Math.floor(u)), j = Math.min(CELLS - 1, Math.floor(v)), s = u - i, t = v - j;
      const z = (1 - t) * ((1 - s) * g[j * n + i] + s * g[j * n + i + 1]) + t * ((1 - s) * g[(j + 1) * n + i] + s * g[(j + 1) * n + i + 1]);
      return z * this.zscale;
    };
    for (let k = 1; k <= 80; k++) {
      const t = 0.01 + (k / 80) * 0.99;
      const x = p.x + (cam.x - p.x) * t, y = p.y + (cam.y - p.y) * t, z = p.z + 0.03 + (cam.z - p.z) * t;
      const zs = height(x, y);
      if (zs === null) return false;
      if (zs > z) return true;
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
      this.mix = e;
      // the marks are raised in the last part of a change, once the surface has nearly settled
      const late = ease(clamp((k - 0.35) / 0.65, 0, 1));
      this.shown = { lo: lerp(a.lo, b.lo, e), hi: lerp(a.hi, b.hi, e), marks: lerp(a.marks, b.marks, b.marks > a.marks ? late : e), cut: lerp(a.cut, b.cut, e), level: lerp(a.level, b.level, e) };
      if (k >= 1) this.moving = false;
    }
    if (this.rate) this.azimuth += dt * this.rate;
    this.draw();
    if (this.moving || this.rate) this.kick();
  };

  // the end of a change of stage, at once
  private settle(): void {
    if (!this.moving) return;
    this.moving = false;
    this.mix = 1;
    this.shown = this.to;
  }

  /** Starts the turning of the camera and the animation of a change of stage, while the slide is shown. */
  start(): void {
    this.active = true;
    this.last = 0;
    if (this.moving || this.rate) this.kick();
    else this.draw();
  }

  /** Stops the animation, and ends a change of stage at once. */
  stop(): void {
    this.active = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.settle();
  }
}

/** One Surface per `.surface` under root, reused when an element was mounted before. An element with an unknown function, or a page without three.js or WebGL, is reported and left blank. */
export function mount(root: ParentNode): Surface[] {
  const out: Surface[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('.surface')) {
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
