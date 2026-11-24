import { smooth, type Colors, type Frame, type Kind } from './dotkind.ts';
import { MAP_CONTRAST, colormapEnds } from './trajectories.ts';

const TRACE = 3.4;
const WAIT = 1.4;
const MORPH = 4.5;
const REST = 3.5;
const CYCLE = WAIT + 2 * MORPH + REST;
const LEVELS = 16;
const POINTS = 96;
const FRAMES = 8;
const REACH = 1.3;
const FAR = 1.2;
const GRID = 0.2;
const GRID_LINES = 6;
const GLOW: [number, number][] = [[24, 0.06], [13, 0.11], [6.5, 0.2]];
const ORBIT_WIDTH = 1.4;
const GRID_WIDTH = 1;
const MANIFOLD_WIDTH = 2.8;
const GRID_ALPHA = 0.2;
const FADE_FROM = 0.72;
const HALF_WIDTH = 0.8;

const GENERATOR: [number, number, number][] = [
  [0.4, 3, 0], [-0.34, 1, 2], [0.26, 2, 1], [0.18, 0, 3],
  [0.2, 4, 0], [-0.28, 2, 2], [0.14, 1, 3], [-0.12, 0, 4],
  [-0.08, 5, 0], [0.2, 3, 2], [0.12, 2, 3], [-0.14, 1, 4],
  [0.04, 6, 0], [-0.14, 4, 2], [0.12, 2, 4],
];
const POWERS = 7;

type Kinds = 'orbit' | 'stable' | 'unstable' | 'grid';
type Group = { kind: Kinds; level: number; lines: Float32Array[][] };
export type State = { groups: Group[] };

const xs = new Float64Array(POWERS), ys = new Float64Array(POWERS), flow = new Float64Array(2);

function field(x: number, y: number): Float64Array {
  xs[0] = ys[0] = 1;
  for (let k = 1; k < POWERS; k++) {
    xs[k] = xs[k - 1] * x;
    ys[k] = ys[k - 1] * y;
  }
  let G = 0, Gx = 0, Gy = 0;
  for (const [c, a, b] of GENERATOR) {
    G += c * xs[a] * ys[b];
    if (a) Gx += c * a * xs[a - 1] * ys[b];
    if (b) Gy += c * b * xs[a] * ys[b - 1];
  }
  const far2 = FAR * FAR;
  const E = Math.exp(-(x * x + y * y) / far2);
  flow[0] = (Gy - (2 * y * G) / far2) * E;
  flow[1] = -(Gx - (2 * x * G) / far2) * E;
  return flow;
}

function carry(points: Float32Array, sign: number): Float32Array[] {
  const stages = [points];
  const h = sign / (2 * FRAMES);
  for (let k = 0; k < FRAMES; k++) {
    const next = Float32Array.from(stages[k]);
    for (let i = 0; i < next.length; i += 2) {
      let x = next[i], y = next[i + 1];
      for (let step = 0; step < 2; step++) {
        const [ax, ay] = field(x, y);
        const [bx, by] = field(x + (h / 2) * ax, y + (h / 2) * ay);
        const [cx, cy] = field(x + (h / 2) * bx, y + (h / 2) * by);
        const [ex, ey] = field(x + h * cx, y + h * cy);
        x += (h / 6) * (ax + 2 * bx + 2 * cx + ex);
        y += (h / 6) * (ay + 2 * by + 2 * cy + ey);
      }
      next[i] = x;
      next[i + 1] = y;
    }
    stages.push(next);
  }
  return stages;
}

const turned = (q: number, p: number): [number, number] => [(q - p) / Math.SQRT2, (q + p) / Math.SQRT2];

function prepare(): State {
  const groups: Group[] = [];
  for (let k = 1; k <= LEVELS; k++) {
    const c = 0.5 * (k / LEVELS) ** 2, root = Math.sqrt(c), span = Math.log(REACH / root);
    const lines = [[1, 1], [-1, -1], [1, -1], [-1, 1]].map(([sq, sp]) => {
      const points = new Float32Array(2 * POINTS);
      for (let i = 0; i < POINTS; i++) {
        const e = Math.exp(span * ((2 * i) / (POINTS - 1) - 1));
        points.set(turned(sq * root * e, (sp * root) / e), 2 * i);
      }
      return carry(points, 1);
    });
    groups.push({ kind: 'orbit', level: k / LEVELS, lines });
  }
  for (const kind of ['stable', 'unstable'] as const) {
    const lines = (kind === 'stable' ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]]).map(([sq, sp]) => {
      const points = new Float32Array(2 * POINTS);
      for (let i = 0; i < POINTS; i++) {
        const r = (REACH * (kind === 'stable' ? POINTS - 1 - i : i)) / (POINTS - 1);
        points.set(turned(sq * r, sp * r), 2 * i);
      }
      return carry(points, 1);
    });
    groups.push({ kind, level: 0, lines });
  }
  const grid: Float32Array[][] = [];
  for (const across of [true, false]) {
    for (let k = -GRID_LINES; k <= GRID_LINES; k++) {
      const points = new Float32Array(2 * POINTS);
      for (let i = 0; i < POINTS; i++) {
        const along = REACH * ((2 * i) / (POINTS - 1) - 1);
        points.set(across ? [k * GRID, along] : [along, k * GRID], 2 * i);
      }
      grid.push(carry(points, -1).reverse());
    }
  }
  groups.unshift({ kind: 'grid', level: 0, lines: grid });
  return { groups };
}

const viridisEnds = new WeakMap<Colors, [number, number]>();
function viridis(colors: Colors, at: number): string {
  let ends = viridisEnds.get(colors);
  if (!ends) viridisEnds.set(colors, (ends = colormapEnds({ name: 'viridis', lo: 0, hi: 1 }, colors.ground || undefined, MAP_CONTRAST)));
  return colors.map('viridis', at, ends);
}

function standardness(seconds: number): number {
  if (!Number.isFinite(seconds)) return 1;
  const u = Math.max(0, seconds - TRACE) % CYCLE;
  if (u < WAIT) return 1;
  if (u < WAIT + MORPH) return 1 - smooth((u - WAIT) / MORPH);
  if (u < WAIT + MORPH + REST) return 0;
  return smooth((u - WAIT - MORPH - REST) / MORPH);
}

function draw(frame: Frame<State>, seconds: number): void {
  const { g, state, colors, scale, x0, y0 } = frame;
  const done = !Number.isFinite(seconds);
  const s = standardness(seconds);
  const f = Math.min(FRAMES - 1, Math.floor(s * FRAMES));
  const w = s * FRAMES - f;
  const traced = done ? 1 : seconds / TRACE;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  for (const { kind, level, lines } of state.groups) {
    const part = kind === 'orbit' ? smooth(1.4 * traced - 0.4 * level) : kind === 'stable' ? smooth(2 * traced) : kind === 'unstable' ? smooth(2 * traced - 1) : 1;
    const n = Math.round(part * POINTS);
    if (n < 2) continue;
    g.beginPath();
    for (const stages of lines) {
      const a = stages[f], b = stages[f + 1];
      const X = (i: number) => x0 + scale * (a[2 * i] + (b[2 * i] - a[2 * i]) * w);
      const Y = (i: number) => y0 - scale * (a[2 * i + 1] + (b[2 * i + 1] - a[2 * i + 1]) * w);
      g.moveTo(X(0), Y(0));
      for (let i = 1; i < n - 1; i++) g.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
      g.lineTo(X(n - 1), Y(n - 1));
    }
    g.strokeStyle = kind === 'orbit' ? viridis(colors, 1 - level) : kind === 'grid' ? colors.text : colors.tone(kind === 'stable' ? '--violet' : '--accent');
    if (kind === 'stable' || kind === 'unstable') {
      g.lineCap = 'butt';
      for (const [width, alpha] of GLOW) {
        g.globalAlpha = alpha;
        g.lineWidth = width;
        g.stroke();
      }
      g.lineCap = 'round';
    }
    g.globalAlpha = kind === 'grid' ? GRID_ALPHA * smooth(traced * 3) : 1;
    g.lineWidth = kind === 'orbit' ? ORBIT_WIDTH : kind === 'grid' ? GRID_WIDTH : MANIFOLD_WIDTH;
    g.stroke();
  }
  const sharpness = g.getTransform().a;
  const width = g.canvas.width / sharpness, height = g.canvas.height / sharpness;
  g.globalAlpha = 1;
  g.save();
  g.globalCompositeOperation = 'destination-in';
  g.translate(x0, y0);
  g.scale(Math.min(width / 2, scale), Math.min(height / 2, scale));
  const fade = g.createRadialGradient(0, 0, FADE_FROM, 0, 0, 1);
  fade.addColorStop(0, 'rgba(0, 0, 0, 1)');
  fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = fade;
  g.fillRect(-1e4, -1e4, 2e4, 2e4);
  g.restore();
}

export const normalForm: Kind<null, State> = {
  margin: 0,
  endless: true,
  file: () => null,
  prepare,
  extent: () => ({ x0: -HALF_WIDTH, x1: HALF_WIDTH, y0: -1, y1: 1 }),
  span: () => TRACE + CYCLE,
  draw,
};
