// a `.surface`: the graph z = f(x, y) of a function of surfaces.ts over its rectangle, drawn with
// three.js under an orbit camera that turns slowly. its stage is set by the fragments of its slide
// with data-surface-stage, and a change of stage is animated. the heights are morphed. three.js is
// the global THREE of theme/vendor/three/three.js. one WebGL renderer is shared by every surface of
// the page, and its image is copied to a 2D canvas in each element. hence the page of each step in
// the print view does not hold a WebGL context of its own

import type * as Three from 'three';
import { FUNCTION_NAMES, sample, surfaceFunction } from './surfaces.ts';
import type { Stage, SurfaceFunction } from './surfaces.ts';

declare global {
  interface Window {
    THREE?: typeof Three;
  }
}

type RGB = [number, number, number];
// the color range of the heights drawn at a frame, in world units
type Shown = { lo: number; hi: number };

// cells along each side of the rectangle
const CELLS = 200;
// milliseconds of a change of stage
const MORPH = 1400;
// the default seconds per turn of the camera
const TURN = 90;

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
  private grids = new Map<string, Float64Array>();
  private normals = new WeakMap<Float64Array, Float32Array>();
  private ranges = new Map<string, [number, number]>();
  private zmin = 0;
  private zmax = 0;
  private THREE: typeof Three;
  private scene: Three.Scene;
  private camera: Three.PerspectiveCamera;
  private surface: Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>;
  private A: Float64Array;
  private B: Float64Array;
  private mix = 1;
  private stageName = '';
  private shown: Shown;
  private from: Shown;
  private to: Shown;
  private t0 = 0;
  private moving = false;
  private active = false;
  private raf = 0;
  private last = 0;
  private W = 0;
  private H = 0;

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

    for (const [name, f] of Object.entries(fn.layers)) {
      const g = sample(f, fn.x, fn.y, CELLS, CELLS, fn.floor);
      this.grids.set(name, g);
      this.ranges.set(name, this.range(g));
      for (const z of g) { if (z < this.zmin) this.zmin = z; if (z > this.zmax) this.zmax = z; }
    }
    this.A = this.B = this.grids.get(fn.initial) ?? new Float64Array((CELLS + 1) ** 2);
    const [lo, hi] = this.ranges.get(fn.initial) ?? [0, 1];
    this.shown = this.from = this.to = { lo, hi };

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    this.camera.up.set(0, 0, 1);
    this.surface = this.makeSurface();
    this.scene.add(this.surface);
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

  /** Reads the colors of the theme from the custom properties of the element, e.g. after a flip of the mode. */
  recolor(): void {
    const cs = getComputedStyle(this.el), css = (name: string, fallback: RGB) => rgb(cs.getPropertyValue(name), fallback);
    const bg = css('--bg', [0.02, 0.02, 0.02]), text = css('--text', [0.95, 0.95, 0.94]);
    const violet = css('--violet', [0.79, 0.31, 0.9]);
    const blue = css('--data-5', [0, 0.45, 0.7]);
    const u = this.surface.material.uniforms, set = (target: Three.Vector3, c: RGB) => target.set(c[0], c[1], c[2]);
    // in either mode, the deep part of the surface is shaded through blue into the background, and
    // its high part is shaded through violet up to the color of the text
    const ramp: RGB[] = [mix3(blue, bg, 0.7), mix3(blue, violet, 0.35), violet, mix3(violet, text, 0.55)];
    ramp.forEach((c, i) => set(u.uRamp.value[i], c));
    set(u.uGroove.value, bg);
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
    const to: Shown = { lo, hi };
    if (!animate || first) {
      this.A = this.B = grid;
      this.mix = 1;
      this.shown = this.from = this.to = to;
      this.moving = false;
    } else {
      this.A = this.current();
      this.B = grid;
      this.mix = 0;
      this.from = this.shown;
      this.to = to;
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

  /** Sizes the canvas from the box of the element on the screen, and draws. */
  fit(): void {
    // the slide is scaled with a transform in reveal.js, hence the canvas is sized from the screen
    // rectangle
    const r = this.el.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    if (!r.width || !r.height || !w || !h) return;
    this.W = Math.max(1, Math.round(r.width * dpr));
    this.H = Math.max(1, Math.round(r.height * dpr));
    this.canvas.width = this.W;
    this.canvas.height = this.H;
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

  /** Draws the surface at the stage and the camera of now. */
  draw(): void {
    if (!this.W) return;
    const r = renderer();
    if (!r) return;
    const shown = this.shown, u = this.surface.material.uniforms;
    u.uMix.value = this.mix;
    u.uRange.value.set(shown.lo, shown.hi);
    this.aim();
    if (r.domElement.width !== this.W || r.domElement.height !== this.H) r.setSize(this.W, this.H, false);
    r.render(this.scene, this.camera);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    // in the same task as the render, since the drawing buffer of WebGL is cleared after a frame
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.drawImage(r.domElement, 0, 0);
  }

  private kick(): void {
    if (this.active && !this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.raf = 0;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    if (this.moving) {
      const k = Math.min(1, (now - this.t0) / MORPH), e = ease(k), a = this.from, b = this.to;
      this.mix = e;
      this.shown = { lo: lerp(a.lo, b.lo, e), hi: lerp(a.hi, b.hi, e) };
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
