// the functions drawn by a `.surface`, selected with its data-function attribute and built from its
// data attributes. a function is given with its rectangle, its floor, its marked points, and its
// states, i.e. what is shown at each step of the slide. a state lists its sheets, each with the
// height it draws and the color ramp of this height

import { isolines } from './contour.ts';
import { lagrange } from './orbits.ts';

/** A height z = f(x, y), nondimensional. */
export type Height = (x: number, y: number) => number;

/** A marked point of a surface, drawn on the first sheet of the state that shows the points. */
export type Point = { name: string; x: number; y: number; kind: 'saddle' | 'maximum' | 'minimum' };

/** A height drawn at a state in the color ramp tone, raised by lift, nondimensional. */
export type Sheet = { height: Height; tone: Tone; lift: number };

/**
 * What a surface shows at one step: its sheets, the points on the first sheet or not, and the
 * height of a cutting plane through the first sheet, or null for no cut. A sheet after the first
 * that is not shown at the next state is merged into the first sheet when the first sheet is given
 * another height, and is flattened onto the first sheet and faded out otherwise. A sheet is split
 * from the first in the same way when it is added.
 */
export type State = { sheets: Sheet[]; points: boolean; level: number | null };

/**
 * The color ramp of a sheet: the name of a ramp of RAMPS, or theme for the ramp of the colors of
 * the mode of the deck, and the heights at its two ends, nondimensional. Without range, the ramp is
 * spread from the 5th percentile of the heights of the sheet to their maximum.
 */
export type Tone = { ramp: string; range?: [number, number] };

/**
 * The fixed color ramps, as sRGB colors at even steps from the lowest height of a range to the
 * highest. blues and reds are the sequential ColorBrewer scales Blues and Reds, as plotly 7 resolves
 * colorscale='Blues' and 'Reds' of a go.Surface. magma_r is the Magma of matplotlib from 0.3 to 1,
 * reversed, i.e. Magma_r without its darkest 30 %, hence the highest heights stay purple on a dark
 * slide. The ramp theme is made from the custom properties of the theme in surface.ts.
 */
export const RAMPS: Record<string, string[]> = {
  blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
  reds: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
  magma_r: ['#fcfdbf', '#fdda9c', '#feb67c', '#fc9065', '#f56b5c', '#e24d66', '#c43c75', '#a3307e', '#832681', '#641a80'],
};

/** The data attributes of the element and of the fragment that sets the state, by their dataset keys. */
export type Attributes = Record<string, string | undefined>;

/** A function of a surface. The heights of every sheet are clamped at floor, and initial is the state shown before a fragment sets one. */
export type SurfaceFunction = {
  x: [number, number];
  y: [number, number];
  floor: number;
  zscale: number;
  points: Point[];
  states: Record<string, (attributes: Attributes) => State>;
  initial: string;
};

const num = (value: string | undefined, fallback: number): number =>
  value !== undefined && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : fallback;

/**
 * The effective potential of the CR3BP at the mass ratio mu, nondimensional, and its two parts.
 * The frame is the rotating frame with the primary at (-mu, 0) and the secondary at (1 - mu, 0).
 * The parts are the gravitational wells of the primary and the secondary, and the centrifugal bowl.
 */
export function effectivePotential(mu: number): { wells: Height; bowl: Height; sum: Height } {
  const wells: Height = (x, y) => -(1 - mu) / Math.hypot(x + mu, y) - mu / Math.hypot(x - 1 + mu, y);
  const bowl: Height = (x, y) => -(x * x + y * y) / 2;
  return { wells, bowl, sum: (x, y) => wells(x, y) + bowl(x, y) };
}

/**
 * The libration points L1 to L5 at the mass ratio mu. The collinear points L1, L2, and L3 are the
 * saddles of the effective potential on the x axis, found by Newton's method in lagrange() of
 * orbits.ts. L4 and L5 are its maxima, at the third vertex of the equilateral triangles on the
 * primary and the secondary.
 */
export function librationPoints(mu: number): Point[] {
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
 * The height f clamped at floor. The wells of the effective potential go to minus infinity at the
 * primary and the secondary, hence a surface is drawn above a floor. The clamp is a softplus of
 * width 0.06, so that the bottom of a well is rounded rather than cut flat, and a height 0.3 above
 * the floor is moved by less than 0.001.
 */
export function clamped(f: Height, floor: number): Height {
  const w = 0.06;
  return (x, y) => {
    const s = (f(x, y) - floor) / w;
    return floor + w * (s > 0 ? s + Math.log1p(Math.exp(-s)) : Math.log1p(Math.exp(s)));
  };
}

/** The values of the height f, clamped at floor, at the (nx + 1) by (ny + 1) corners of the cells of the rectangle, row by row as isolines() of contour.ts reads them. */
export function sample(f: Height, x: [number, number], y: [number, number], nx: number, ny: number, floor: number): Float64Array {
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

// the ramps and ranges of the gravitational and the centrifugal parts and of their sum in
// plot_potentials_decomposed.py of Claudio Vestini's MAE 541 project, a plotly figure of the three
// surfaces at mu = 0.05 with cmin = -3 and cmax = -1.5
const GRAVITATIONAL: Tone = { ramp: 'blues', range: [-3, -1.5] };
const CENTRIFUGAL: Tone = { ramp: 'reds', range: [-3, -1.5] };
const EFFECTIVE: Tone = { ramp: 'magma_r', range: [-3, -1.5] };
// the height by which the bowl is raised above the wells at the state centrifugal, nondimensional
const BOWL_LIFT = 4;

const FUNCTIONS = {
  // the effective potential of the CR3BP at data-mu, assembled from its wells and its bowl, with the
  // libration points marked and a cut at the height -C/2 of the Jacobi constant C of data-C. the
  // bowl is shown above the wells, and the two are merged into their sum at the next state. the
  // intersection of the plane with the surface is the zero-velocity curve, and Hill's region is
  // where the surface is under the plane. C is the value at L1 when data-C is not given
  'effective-potential': (attributes: Attributes): SurfaceFunction => {
    const mu = num(attributes.mu, 0.05);
    const { wells, bowl, sum } = effectivePotential(mu);
    const points = librationPoints(mu);
    const C1 = -2 * sum(points[0].x, 0);
    const zero: Height = () => 0;
    const one = (height: Height, tone: Tone): Sheet[] => [{ height, tone, lift: 0 }];
    return {
      x: [-1.5, 1.5],
      y: [-1.5, 1.5],
      floor: -3.2,
      zscale: 1,
      points,
      initial: 'zero',
      states: {
        zero: () => ({ sheets: one(zero, GRAVITATIONAL), points: false, level: null }),
        gravitational: () => ({ sheets: one(wells, GRAVITATIONAL), points: false, level: null }),
        centrifugal: () => ({ sheets: [...one(wells, GRAVITATIONAL), { height: bowl, tone: CENTRIFUGAL, lift: BOWL_LIFT }], points: false, level: null }),
        effective: () => ({ sheets: one(sum, EFFECTIVE), points: false, level: null }),
        extrema: () => ({ sheets: one(sum, EFFECTIVE), points: true, level: null }),
        cut: (a) => ({ sheets: one(sum, EFFECTIVE), points: true, level: -num(a.c, C1) / 2 }),
      },
    };
  },
} satisfies Record<string, (attributes: Attributes) => SurfaceFunction>;

export const FUNCTION_NAMES = Object.keys(FUNCTIONS);

/** The function name built from the attributes, or null for an unknown name. */
export function surfaceFunction(name: string, attributes: Attributes): SurfaceFunction | null {
  return name in FUNCTIONS ? FUNCTIONS[name as keyof typeof FUNCTIONS](attributes) : null;
}
