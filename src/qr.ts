// the QR code of a div.qr: the text of its data-qr, encoded in byte mode after ISO/IEC 18004, at
// error correction level H with the logo in its middle and at level M without, and drawn as an
// inline SVG of dark modules on a light tile in both modes, since many scanners do not read an
// inverted code

// ECC holds the error correction codewords per block, and BLOCKS the number of blocks, of each
// level at versions 1 to 40, after table 9 of ISO/IEC 18004
const ECC = {
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};
const BLOCKS = {
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};
// LEVEL_BITS are the two bits of each level in the format information
const LEVEL_BITS = { M: 0, H: 2 };
// QUIET is the width of the light margin around the modules, in modules
export const QUIET = 4;

// LOGO is the diameter of the logo as a share of the width of the modules, and GAP the width of
// the light ring around it, in modules
const LOGO = 0.3;
const GAP = 0.8;

/** An error correction level: about 15 percent of a code is restored at M, and about 30 percent at H. */
export type Level = 'M' | 'H';
export type Code = { version: number; size: number; mask: number; level: Level; logo: boolean; dark: boolean[][] };

// dataModules counts the modules of a version outside the function patterns, i.e. those that hold
// data and error correction
function dataModules(version: number): number {
  const size = 4 * version + 17;
  let n = size * size - 3 * 64 - 2 * (size - 16) - 31;
  if (version >= 2) {
    const k = Math.floor(version / 7) + 2;
    n -= 25 * (k * k - 3) - 10 * (k - 2);
  }
  if (version >= 7) n -= 36;
  return n;
}

const dataCodewords = (version: number, level: Level) => Math.floor(dataModules(version) / 8) - ECC[level][version - 1] * BLOCKS[level][version - 1];

/** The number of bytes that a code of the version and the level holds in byte mode, after the mode indicator and the character count. */
export const capacity = (version: number, level: Level = 'M') => Math.floor((dataCodewords(version, level) * 8 - 4 - (version < 10 ? 8 : 16)) / 8);

// alignment returns the centers of the alignment patterns on each axis, spaced evenly from the
// last one inward, except for the uneven spacing of version 32
function alignment(version: number): number[] {
  if (version === 1) return [];
  const k = Math.floor(version / 7) + 2;
  const last = 4 * version + 10;
  const step = version === 32 ? 26 : Math.ceil((last - 6) / (k - 1) / 2) * 2;
  const out = [6];
  for (let i = k - 2; i >= 0; i--) out.push(last - i * step);
  return out;
}

// alignmentCenters returns the row and the column of the center of each alignment pattern. the
// three corners of the grid of centers fall on the finder patterns, and are left out
function alignmentCenters(version: number): [number, number][] {
  const centers = alignment(version);
  const last = centers.length - 1;
  const out: [number, number][] = [];
  for (const [i, r] of centers.entries()) {
    for (const [j, c] of centers.entries()) {
      if (!((i === 0 && (j === 0 || j === last)) || (i === last && j === 0))) out.push([r, c]);
    }
  }
  return out;
}

// covered is true for a module that the logo or the ring around it reaches, in a code of n modules
function covered(n: number, r: number, c: number): boolean {
  const dx = Math.max(Math.abs(c + 0.5 - n / 2) - 0.5, 0), dy = Math.max(Math.abs(r + 0.5 - n / 2) - 0.5, 0);
  return dx * dx + dy * dy < ((LOGO * n) / 2 + GAP) ** 2;
}

// reached returns the centers of the alignment patterns with a module under the logo
function reached(version: number): [number, number][] {
  const n = 4 * version + 17;
  return alignmentCenters(version).filter(([r, c]) => {
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (covered(n, r + dr, c + dc)) return true;
    return false;
  });
}

/** True for a module that is not drawn in a code with the logo: a module under the logo or the ring around it, or in an alignment pattern with a module under the logo, which is left out as a whole. */
export function hidden(code: Code, r: number, c: number): boolean {
  if (!code.logo) return false;
  return covered(code.size, r, c) || reached(code.version).some(([ar, ac]) => Math.abs(ar - r) <= 2 && Math.abs(ac - c) <= 2);
}

// EXP and LOG are the tables of GF(256) with the polynomial x^8 + x^4 + x^3 + x^2 + 1
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = EXP[i + 255] = x;
  LOG[x] = i;
  x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
}
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

// generator returns the coefficients of (x - a^0)(x - a^1)...(x - a^(n-1)) after its leading 1,
// where a is the primitive element 2
function generator(n: number): Uint8Array {
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

// remainder returns the Reed-Solomon error correction of data, i.e. data times x^n modulo g
function remainder(data: Uint8Array, g: Uint8Array): Uint8Array {
  const r = new Uint8Array(g.length);
  for (const byte of data) {
    const factor = byte ^ r[0];
    r.copyWithin(0, 1);
    r[r.length - 1] = 0;
    for (let i = 0; i < g.length; i++) r[i] ^= mul(g[i], factor);
  }
  return r;
}

// codewords returns the data codewords: the mode indicator, the count, the bytes, the terminator,
// and the alternating pad bytes 0xec and 0x11
function codewords(bytes: Uint8Array, version: number, level: Level): Uint8Array {
  const bits: number[] = [];
  const put = (value: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const total = dataCodewords(version, level) * 8;
  put(0, Math.min(4, total - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < total; pad ^= 0xec ^ 0x11) put(pad, 8);
  const out = new Uint8Array(total / 8);
  for (let i = 0; i < bits.length; i++) out[i >>> 3] |= bits[i] << (7 - (i & 7));
  return out;
}

// interleave splits data into the blocks of the version, the short blocks first, and returns the
// data codewords column by column across the blocks, then the error correction in the same order
function interleave(data: Uint8Array, version: number, level: Level): Uint8Array {
  const n = BLOCKS[level][version - 1], ecc = ECC[level][version - 1];
  const total = Math.floor(dataModules(version) / 8);
  const short = Math.floor(total / n) - ecc;
  const shortBlocks = n - (total % n);
  const g = generator(ecc);
  const blocks: Uint8Array[] = [];
  const checks: Uint8Array[] = [];
  for (let i = 0, at = 0; i < n; i++) {
    const len = short + (i < shortBlocks ? 0 : 1);
    blocks.push(data.subarray(at, at + len));
    checks.push(remainder(data.subarray(at, at + len), g));
    at += len;
  }
  const out: number[] = [];
  for (let i = 0; i <= short; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecc; i++) for (const c of checks) out.push(c[i]);
  return new Uint8Array(out);
}

// bch returns the BCH code of the format or version information: the data of the given bits,
// followed by its remainder modulo poly
function bch(data: number, bits: number, poly: number): number {
  const degree = 31 - Math.clz32(poly);
  let r = data << degree;
  for (let i = bits + degree - 1; i >= degree; i--) if ((r >>> i) & 1) r ^= poly << (i - degree);
  return (data << degree) | r;
}

// MASKS are the eight data masks of the standard, as functions of the row and the column
const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

// a Grid holds the modules by row and column, and fixed marks the modules of the function
// patterns, which are not masked
class Grid {
  readonly size: number;
  readonly dark: boolean[][];
  readonly fixed: boolean[][];
  constructor(size: number) {
    this.size = size;
    this.dark = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }
  set(r: number, c: number, dark: boolean): void {
    if (r < 0 || c < 0 || r >= this.size || c >= this.size) return;
    this.dark[r][c] = dark;
    this.fixed[r][c] = true;
  }
}

// functionPatterns draws the finder patterns with their separators, the timing patterns, the
// alignment patterns, the dark module, and the version information
function functionPatterns(grid: Grid, version: number): void {
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
  // the centers on row 6 and column 6 are drawn over the timing patterns
  for (const [r, c] of alignmentCenters(version)) {
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) grid.set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  }
  // the modules of the format information are reserved here, and format() writes them again once
  // the mask is chosen
  format(grid, 'M', 0);
  if (version >= 7) {
    const bits = bch(version, 6, 0x1f25);
    for (let i = 0; i < 18; i++) {
      const on = ((bits >>> i) & 1) === 1;
      const a = n - 11 + (i % 3), b = Math.floor(i / 3);
      grid.set(a, b, on);
      grid.set(b, a, on);
    }
  }
}

// format writes the two copies of the format information of the level and the mask, and the dark
// module beside the lower left finder
function format(grid: Grid, level: Level, mask: number): void {
  const n = grid.size;
  const bits = bch((LEVEL_BITS[level] << 3) | mask, 5, 0x537) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) grid.set(i, 8, bit(i));
  grid.set(7, 8, bit(6));
  grid.set(8, 8, bit(7));
  grid.set(8, 7, bit(8));
  for (let i = 9; i < 15; i++) grid.set(8, 14 - i, bit(i));
  for (let i = 0; i < 8; i++) grid.set(8, n - 1 - i, bit(i));
  for (let i = 8; i < 15; i++) grid.set(n - 15 + i, 8, bit(i));
  grid.set(n - 8, 8, true);
}

// walk visits the modules outside the function patterns in the order of the bits of the
// codewords: the zigzag of column pairs from the lower right, passing over the vertical timing
// pattern in column 6
function walk(grid: Grid, visit: (r: number, c: number, bit: number) => void): void {
  const n = grid.size;
  let i = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const up = ((right + 1) & 2) === 0;
    for (let k = 0; k < n; k++) {
      const r = up ? n - 1 - k : k;
      for (const c of [right, right - 1]) if (!grid.fixed[r][c]) visit(r, c, i++);
    }
  }
}

// place writes the codewords, and the remainder bits are left light
function place(grid: Grid, data: Uint8Array): void {
  walk(grid, (r, c, i) => { grid.dark[r][c] = i < data.length * 8 && ((data[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; });
}

// logoFits is true for a version of level H at which a code is read with the logo: the logo is
// drawn on function patterns other than alignment patterns at version 1, and elsewhere each
// codeword with a module under it is read wrong at worst. these may be two thirds of the codewords
// that are restored in a block, i.e. of half its error correction codewords, so that a third is
// left for the errors of a camera
function logoFits(version: number): boolean {
  const grid = new Grid(4 * version + 17);
  functionPatterns(grid, version);
  const n = BLOCKS.H[version - 1], ecc = ECC.H[version - 1];
  const patterns = reached(version);
  for (let r = 0; r < grid.size; r++) {
    for (let c = 0; c < grid.size; c++) {
      if (grid.fixed[r][c] && covered(grid.size, r, c) && !patterns.some(([ar, ac]) => Math.abs(ar - r) <= 2 && Math.abs(ac - c) <= 2)) return false;
    }
  }
  // the block of each codeword, in the order of interleave
  const total = Math.floor(dataModules(version) / 8);
  const short = Math.floor(total / n) - ecc, shortBlocks = n - (total % n);
  const blockOf: number[] = [];
  for (let i = 0; i <= short; i++) for (let b = 0; b < n; b++) if (i < short || b >= shortBlocks) blockOf.push(b);
  for (let i = 0; i < ecc; i++) for (let b = 0; b < n; b++) blockOf.push(b);
  const wrong = Array.from({ length: n }, () => new Set<number>());
  walk(grid, (r, c, i) => { if (i < total * 8 && covered(grid.size, r, c)) wrong[blockOf[i >>> 3]].add(i >>> 3); });
  return wrong.every((words) => 3 * words.size <= 2 * Math.floor(ecc / 2));
}

function applyMask(grid: Grid, mask: number): void {
  const m = MASKS[mask];
  for (let r = 0; r < grid.size; r++) for (let c = 0; c < grid.size; c++) if (!grid.fixed[r][c] && m(r, c)) grid.dark[r][c] = !grid.dark[r][c];
}

// penalty scores the four rules of the standard: runs of five or more modules of one color, 2 by 2
// squares, patterns like a finder next to four light modules, and a share of dark modules away
// from one half
function penalty(dark: boolean[][]): number {
  const n = dark.length;
  let score = 0;
  const finder = [true, false, true, true, true, false, true];
  for (let pass = 0; pass < 2; pass++) {
    const at = (a: number, b: number) => (pass === 0 ? dark[a][b] : dark[b][a]);
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
        const light = (from: number) => { for (let k = from; k < from + 4; k++) if (k >= 0 && k < n && at(a, k)) return false; return true; };
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
  score += 10 * Math.floor(Math.abs((count * 100) / (n * n) - 50) / 5);
  return score;
}

/**
 * Encodes text as UTF-8 in byte mode, in the smallest version that holds it, and throws if no version does.
 * A code without the logo is encoded at level M. With logo, it is encoded at level H in the smallest version at which it is
 * read with the modules under the logo lost, or at level M without the logo if the text is too long for such a version.
 */
export function encode(text: string, logo = false): Code {
  const bytes = new TextEncoder().encode(text);
  const level: Level = logo ? 'H' : 'M';
  let version = 1;
  while (version <= 40 && (capacity(version, level) < bytes.length || (logo && !logoFits(version)))) version++;
  if (version > 40 && logo) return encode(text);
  if (version > 40) throw new Error(`the text is ${bytes.length} bytes long, and a QR code at level M holds at most ${capacity(40)}`);
  const data = interleave(codewords(bytes, version, level), version, level);
  let best: Grid | null = null, bestMask = 0, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const grid = new Grid(4 * version + 17);
    functionPatterns(grid, version);
    place(grid, data);
    applyMask(grid, mask);
    format(grid, level, mask);
    const score = penalty(grid.dark);
    if (score < bestScore) { best = grid; bestMask = mask; bestScore = score; }
  }
  const grid = best as Grid;
  return { version, size: grid.size, mask: bestMask, level, logo, dark: grid.dark };
}

const SVG = 'http://www.w3.org/2000/svg';

const fixed3 = (x: number) => +x.toFixed(3);
// rounded returns the path of a square of side a centered at (x, y), with corners of radius r
function rounded(x: number, y: number, a: number, r: number): string {
  const s = fixed3(a - 2 * r);
  return `M${fixed3(x - a / 2 + r)} ${fixed3(y - a / 2)}h${s}a${r} ${r} 0 0 1 ${r} ${r}v${s}a${r} ${r} 0 0 1 ${-r} ${r}h${-s}a${r} ${r} 0 0 1 ${-r} ${-r}v${-s}a${r} ${r} 0 0 1 ${r} ${-r}z`;
}

/**
 * The SVG of a code: a tile as wide as the modules and the quiet zone, the modules as one path of runs along the rows, rounded
 * at each corner without a dark neighbor, with the rings of the finder and alignment patterns, and the eyes of these patterns
 * as a second path. The modules for which hidden is true are left light.
 */
export function svgOf(code: Code, label: string): SVGSVGElement {
  const n = code.size, side = n + 2 * QUIET;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${side} ${side}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  const tile = document.createElementNS(SVG, 'rect');
  tile.setAttribute('class', 'qr-tile');
  tile.setAttribute('width', String(side));
  tile.setAttribute('height', String(side));
  // the corners of the tile are rounded within the quiet zone. the fills are the fallback of the
  // colors set in theme/beeson.css
  tile.setAttribute('rx', String(fixed3(side * 0.05)));
  tile.setAttribute('fill', '#fff');
  // the finder and alignment patterns are drawn as a ring and an eye, of the sides 7, 5, and 3 and
  // 5, 3, and 1, and not as modules
  const patterns: [number, number, number][] = [[3, 3, 7], [3, n - 4, 7], [n - 4, 3, 7]];
  for (const [r, c] of alignmentCenters(code.version)) patterns.push([r, c, 5]);
  const lost = code.dark.map((row, r) => row.map((_, c) => hidden(code, r, c)));
  const on = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && code.dark[r][c] && !lost[r][c]
    && !patterns.some(([pr, pc, a]) => Math.abs(pr - r) < a / 2 && Math.abs(pc - c) < a / 2);
  let d = '', eyes = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!on(r, c)) continue;
      const start = c;
      while (on(r, c + 1)) c++;
      // a corner of the run is rounded where the module above or below its end is light
      const x0 = start + QUIET, x1 = c + 1 + QUIET, y = r + QUIET;
      const tl = on(r - 1, start) ? 0 : 0.5, tr = on(r - 1, c) ? 0 : 0.5, br = on(r + 1, c) ? 0 : 0.5, bl = on(r + 1, start) ? 0 : 0.5;
      d += `M${x0 + tl} ${y}H${x1 - tr}${tr ? 'a.5 .5 0 0 1 .5 .5' : ''}V${y + 1 - br}${br ? 'a.5 .5 0 0 1 -.5 .5' : ''}`
        + `H${x0 + bl}${bl ? 'a.5 .5 0 0 1 -.5 -.5' : ''}V${y + tl}${tl ? 'a.5 .5 0 0 1 .5 -.5' : ''}z`;
    }
  }
  for (const [r, c, a] of patterns) {
    if (lost[r][c]) continue;
    const x = c + QUIET + 0.5, y = r + QUIET + 0.5;
    d += rounded(x, y, a, fixed3(a * 0.3)) + rounded(x, y, a - 2, fixed3((a - 2) * 0.24));
    eyes += rounded(x, y, a - 4, fixed3((a - 4) * 0.22));
  }
  const ink = document.createElementNS(SVG, 'path');
  ink.setAttribute('class', 'qr-ink');
  ink.setAttribute('d', d);
  ink.setAttribute('fill', '#000');
  // the inner square of a ring is a hole
  ink.setAttribute('fill-rule', 'evenodd');
  const eye = document.createElementNS(SVG, 'path');
  eye.setAttribute('class', 'qr-eye');
  eye.setAttribute('d', eyes);
  eye.setAttribute('fill', '#000');
  svg.append(tile, ink, eye);
  return svg;
}

/** Draws the code of root, if it is a div.qr, and of each div.qr under it, that is not drawn yet, or a message in its place for a text that is empty or too long. */
export function mountQr(root: ParentNode): void {
  const own = root instanceof HTMLElement && root.matches('.qr[data-qr]') ? [root] : [];
  for (const el of [...own, ...root.querySelectorAll<HTMLElement>('.qr[data-qr]')]) {
    if (el.querySelector(':scope > svg, :scope > .qr-error')) continue;
    const text = el.dataset.qr ?? '';
    try {
      if (!text) throw new Error('data-qr is empty');
      // the logo is the image of --qr-logo of theme/beeson.css, drawn by a div over the middle of
      // the code, at a width in percent of the tile
      const image = getComputedStyle(el).getPropertyValue('--qr-logo').trim();
      const code = encode(text, image !== '' && image !== 'none');
      el.append(svgOf(code, `QR code of ${text}`));
      if (code.logo) {
        const logo = document.createElement('div');
        logo.className = 'qr-logo';
        logo.style.width = `${((100 * LOGO * code.size) / (code.size + 2 * QUIET)).toFixed(2)}%`;
        el.append(logo);
      }
    } catch (error) {
      const box = document.createElement('div');
      box.className = 'qr-error';
      box.textContent = `QR code: ${(error as Error).message}`;
      el.append(box);
    }
  }
}
