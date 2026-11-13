// the level curves of a function sampled on a regular grid, traced with marching squares. used by the
// zero-velocity curves of the hill backdrop in backdrops.ts and by the cut of a surface in surface.ts

/**
 * Returns the curves on which the samples g change sign, each as a list of alternating x and y
 * values. The (nx + 1) by (ny + 1) samples of g are stored row by row, with the sample (i, j) at
 * x0 + i dx and y0 + j dy. A crossing is placed on a cell edge by linear interpolation. A cell
 * with four crossings, i.e. a cell at a saddle, is split into two pairs of crossings in a fixed
 * order. With close set, a closed curve is ended on its first point.
 */
export function isolines(g: Float64Array, nx: number, ny: number, x0: number, y0: number, dx: number, dy = dx, close = false): number[][] {
  const at = (i: number, j: number) => g[j * (nx + 1) + i];
  const links = new Map<string, string[]>(), where = new Map<string, [number, number]>();
  const edge = (i: number, j: number, h: boolean): string => {
    const key = `${h ? 'h' : 'v'}${i},${j}`;
    if (!where.has(key)) {
      const a = at(i, j), b = h ? at(i + 1, j) : at(i, j + 1), t = a / (a - b);
      where.set(key, h ? [x0 + (i + t) * dx, y0 + j * dy] : [x0 + i * dx, y0 + (j + t) * dy]);
    }
    return key;
  };
  const link = (a: string, b: string) => {
    if (!links.has(a)) links.set(a, []);
    if (!links.has(b)) links.set(b, []);
    links.get(a)?.push(b); links.get(b)?.push(a);
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const hits: string[] = [];
    if (at(i, j) > 0 !== at(i + 1, j) > 0) hits.push(edge(i, j, true));
    if (at(i + 1, j) > 0 !== at(i + 1, j + 1) > 0) hits.push(edge(i + 1, j, false));
    if (at(i, j + 1) > 0 !== at(i + 1, j + 1) > 0) hits.push(edge(i, j + 1, true));
    if (at(i, j) > 0 !== at(i, j + 1) > 0) hits.push(edge(i, j, false));
    if (hits.length === 2) link(hits[0], hits[1]);
    else if (hits.length === 4) { link(hits[0], hits[1]); link(hits[2], hits[3]); }
  }
  const out: number[][] = [], seen = new Set<string>();
  for (const start of links.keys()) {
    if (seen.has(start)) continue;
    const p: number[] = [];
    let cur: string | undefined = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const [x, y] = where.get(cur) ?? [0, 0];
      p.push(x, y);
      const next: string | undefined = links.get(cur)?.find((k) => !seen.has(k));
      // a curve of two crossings is open, since the second is linked back to the first anyway
      if (!next && close && p.length > 4 && links.get(cur)?.includes(start)) p.push(p[0], p[1]);
      cur = next;
    }
    out.push(p);
  }
  return out;
}
