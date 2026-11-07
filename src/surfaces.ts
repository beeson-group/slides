// the functions drawn by a `.surface`, selected with its data-function attribute and built from its
// data attributes. a function is given with its rectangle, its floor, the layers drawn at its stages,
// its marked points, and its stages, i.e. what is shown at each step of the slide

import { isolines } from './contour.ts';
import { lagrange } from './orbits.ts';

/** A height z = f(x, y), nondimensional. */
export type Layer = (x: number, y: number) => number;

/** A marked point of a surface, drawn on the layer of the stage that shows the marks. */
export type Mark = { name: string; x: number; y: number; kind: 'saddle' | 'maximum' | 'minimum' };

/** What a surface shows at one step: a layer, the marks or not, and the height of a cutting plane, or null for no cut. */
export type Stage = { layer: string; marks: boolean; level: number | null };

/** The data attributes of the element and of the fragment that sets the stage, by their dataset keys. */
export type Attributes = Record<string, string | undefined>;

/** A function of a surface. The heights of every layer are clamped at floor, and initial is the stage shown before a fragment sets one. */
export type SurfaceFunction = {
  x: [number, number];
  y: [number, number];
  floor: number;
  zscale: number;
  layers: Record<string, Layer>;
  marks: Mark[];
  stages: Record<string, (attributes: Attributes) => Stage>;
  initial: string;
};

const num = (value: string | undefined, fallback: number): number =>
  value !== undefined && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : fallback;

/**
 * The effective potential of the CR3BP at the mass ratio mu, nondimensional, and its two parts.
 * The frame is the rotating frame with the primary at (-mu, 0) and the secondary at (1 - mu, 0).
 * The parts are the gravitational wells of the primary and the secondary, and the centrifugal bowl.
 */
export function effectivePotential(mu: number): { wells: Layer; bowl: Layer; sum: Layer } {
  const wells: Layer = (x, y) => -(1 - mu) / Math.hypot(x + mu, y) - mu / Math.hypot(x - 1 + mu, y);
  const bowl: Layer = (x, y) => -(x * x + y * y) / 2;
  return { wells, bowl, sum: (x, y) => wells(x, y) + bowl(x, y) };
}

/**
 * The libration points L1 to L5 at the mass ratio mu. The collinear points L1, L2, and L3 are the
 * saddles of the effective potential on the x axis, found by Newton's method in lagrange() of
 * orbits.ts. L4 and L5 are its maxima, at the third vertex of the equilateral triangles on the
 * primary and the secondary.
 */
export function librationPoints(mu: number): Mark[] {
  const h = Math.sqrt(3) / 2;
  return [
    { name: 'L1', x: lagrange(1, mu), y: 0, kind: 'saddle' },
    { name: 'L2', x: lagrange(2, mu), y: 0, kind: 'saddle' },
    { name: 'L3', x: lagrange(3, mu), y: 0, kind: 'saddle' },
    { name: 'L4', x: 0.5 - mu, y: h, kind: 'maximum' },
    { name: 'L5', x: 0.5 - mu, y: -h, kind: 'maximum' },
  ];
}

/**
 * The layer f clamped at floor. The wells of the effective potential go to minus infinity at the
 * primary and the secondary, hence a surface is drawn above a floor. The clamp is a softplus of
 * width 0.06, so that the bottom of a well is rounded rather than cut flat, and a height 0.3 above
 * the floor is moved by less than 0.001.
 */
export function clamped(f: Layer, floor: number): Layer {
  const w = 0.06;
  return (x, y) => {
    const s = (f(x, y) - floor) / w;
    return floor + w * (s > 0 ? s + Math.log1p(Math.exp(-s)) : Math.log1p(Math.exp(s)));
  };
}

/** The heights of the layer f, clamped at floor, at the (nx + 1) by (ny + 1) corners of the cells of the rectangle, row by row as isolines() of contour.ts reads them. */
export function sample(f: Layer, x: [number, number], y: [number, number], nx: number, ny: number, floor: number): Float64Array {
  const g = new Float64Array((nx + 1) * (ny + 1)), c = clamped(f, floor);
  const dx = (x[1] - x[0]) / nx, dy = (y[1] - y[0]) / ny;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) g[j * (nx + 1) + i] = c(x[0] + i * dx, y[0] + j * dy);
  return g;
}

/** The curves on which the sampled heights g of sample() cross the height level, each as alternating x and y values, with a closed curve ending on its first point. */
export function levelCurves(g: Float64Array, x: [number, number], y: [number, number], nx: number, ny: number, level: number): number[][] {
  const d = g.map((z) => z - level);
  return isolines(d, nx, ny, x[0], y[0], (x[1] - x[0]) / nx, (y[1] - y[0]) / ny, true);
}

const FUNCTIONS = {
  // the effective potential of the CR3BP at data-mu, assembled from its wells and its bowl, with the
  // libration points marked and a cut at the height -C/2 of the Jacobi constant C of data-C. the
  // intersection of this plane with the surface is the zero-velocity curve, and Hill's region is
  // where the surface is under the plane. C is the value at L1 when data-C is not given
  'effective-potential': (attributes: Attributes): SurfaceFunction => {
    const mu = num(attributes.mu, 0.05);
    const { wells, bowl, sum } = effectivePotential(mu);
    const marks = librationPoints(mu);
    const C1 = -2 * sum(marks[0].x, 0);
    const plain = (layer: string) => () => ({ layer, marks: false, level: null });
    return {
      x: [-1.5, 1.5],
      y: [-1.5, 1.5],
      floor: -3.2,
      zscale: 1,
      layers: { flat: () => 0, wells, bowl, sum },
      marks,
      initial: 'flat',
      stages: {
        flat: plain('flat'),
        wells: plain('wells'),
        bowl: plain('bowl'),
        sum: plain('sum'),
        extrema: () => ({ layer: 'sum', marks: true, level: null }),
        cut: (a) => ({ layer: 'sum', marks: true, level: -num(a.c, C1) / 2 }),
      },
    };
  },
} satisfies Record<string, (attributes: Attributes) => SurfaceFunction>;

export const FUNCTION_NAMES = Object.keys(FUNCTIONS);

/** The function name built from the attributes, or null for an unknown name. */
export function surfaceFunction(name: string, attributes: Attributes): SurfaceFunction | null {
  return name in FUNCTIONS ? FUNCTIONS[name as keyof typeof FUNCTIONS](attributes) : null;
}
