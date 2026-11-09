// the QR code of a div.qr: the text of its data-qr, encoded in byte mode at error correction level
// M after ISO/IEC 18004, and drawn as an inline SVG of dark modules on a light tile in both modes,
// since many scanners do not read an inverted code

// ECC holds the error correction codewords per block, and BLOCKS the number of blocks, of level M
// at versions 1 to 40, after table 9 of ISO/IEC 18004
const ECC = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
// LEVEL_BITS are the two bits of level M in the format information
const LEVEL_BITS = 0;
// QUIET is the width of the light margin around the modules, in modules
export const QUIET = 4;

export type Code = { version: number; size: number; mask: number; dark: boolean[][] };

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

const dataCodewords = (version: number) => Math.floor(dataModules(version) / 8) - ECC[version - 1] * BLOCKS[version - 1];

/** The number of bytes that a code of the version holds in byte mode, after the mode indicator and the character count. */
export const capacity = (version: number) => Math.floor((dataCodewords(version) * 8 - 4 - (version < 10 ? 8 : 16)) / 8);

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
function codewords(bytes: Uint8Array, version: number): Uint8Array {
  const bits: number[] = [];
  const put = (value: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const total = dataCodewords(version) * 8;
  put(0, Math.min(4, total - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < total; pad ^= 0xec ^ 0x11) put(pad, 8);
  const out = new Uint8Array(total / 8);
  for (let i = 0; i < bits.length; i++) out[i >>> 3] |= bits[i] << (7 - (i & 7));
  return out;
}

// interleave splits data into the blocks of the version, the short blocks first, and returns the
// data codewords column by column across the blocks, then the error correction in the same order
function interleave(data: Uint8Array, version: number): Uint8Array {
  const n = BLOCKS[version - 1], ecc = ECC[version - 1];
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
  // the three corners of the grid of centers fall on the finder patterns, and the centers on row 6
  // and column 6 are drawn over the timing patterns
  const centers = alignment(version);
  const last = centers.length - 1;
  for (const [i, r] of centers.entries()) {
    for (const [j, c] of centers.entries()) {
      if ((i === 0 && (j === 0 || j === last)) || (i === last && j === 0)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) grid.set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  }
  // the modules of the format information are reserved here, and format() writes them again once
  // the mask is chosen
  format(grid, 0);
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

// format writes the two copies of the format information of level M and the mask, and the dark
// module beside the lower left finder
function format(grid: Grid, mask: number): void {
  const n = grid.size;
  const bits = bch((LEVEL_BITS << 3) | mask, 5, 0x537) ^ 0x5412;
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

// place writes the codewords in the zigzag of column pairs from the lower right, passing over the
// vertical timing pattern in column 6. the remainder bits are left light
function place(grid: Grid, data: Uint8Array): void {
  const n = grid.size;
  let i = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const up = ((right + 1) & 2) === 0;
    for (let k = 0; k < n; k++) {
      const r = up ? n - 1 - k : k;
      for (const c of [right, right - 1]) {
        if (grid.fixed[r][c]) continue;
        grid.dark[r][c] = i < data.length * 8 && ((data[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
        i++;
      }
    }
  }
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

/** Encodes text as UTF-8 in byte mode at level M, in the smallest version that holds it, and throws if no version does. */
export function encode(text: string): Code {
  const bytes = new TextEncoder().encode(text);
  let version = 1;
  while (version <= 40 && capacity(version) < bytes.length) version++;
  if (version > 40) throw new Error(`the text is ${bytes.length} bytes long, and a QR code at level M holds at most ${capacity(40)}`);
  const data = interleave(codewords(bytes, version), version);
  let best: Grid | null = null, bestMask = 0, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const grid = new Grid(4 * version + 17);
    functionPatterns(grid, version);
    place(grid, data);
    applyMask(grid, mask);
    format(grid, mask);
    const score = penalty(grid.dark);
    if (score < bestScore) { best = grid; bestMask = mask; bestScore = score; }
  }
  const grid = best as Grid;
  return { version, size: grid.size, mask: bestMask, dark: grid.dark };
}
