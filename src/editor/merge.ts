// a three-way merge of the edits of the page with a file changed since it was read, e.g. by an
// agent or by a git pull. the changes of the file are found with a line diff of the text that was
// read, base, and the text now in the file, theirs, and each change is narrowed to the characters
// that differ. an edit of the page is a conflict when it overlaps a change of the file. every
// range is in base

export type Edit = { start: number; end: number; text: string };
export type Merge = { text: string; conflicts: Edit[] };

// beyond MAX_LINES changed lines the diff is given up, and the texts are taken as two files
const MAX_LINES = 2000;

const linesOf = (text: string): string[] => text.match(/[^\n]*\n|[^\n]+$/g) ?? [];

function offsets(lines: string[]): number[] {
  const out = [0];
  for (const line of lines) out.push(out[out.length - 1] + line.length);
  return out;
}

type Hunk = { a0: number; a1: number; b0: number; b1: number };

// the hunks that turn the lines a into the lines b, each the range a0 to a1 of a replaced by the
// range b0 to b1 of b, found with the Myers algorithm. null when more than max lines differ
function diff(a: string[], b: string[], max: number): Hunk[] | null {
  const n = a.length, m = b.length;
  const limit = Math.min(n + m, max);
  const off = limit + 1;
  const v = new Int32Array(2 * limit + 3);
  const trace: Int32Array[] = [];
  let found = -1;
  for (let d = 0; d <= limit && found < 0; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[off + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
  }
  if (found < 0) return null;
  // the path is followed back from its end, with one deleted or inserted line at each step
  const steps: { x: number; y: number; del: boolean }[] = [];
  let x = n, y = m;
  for (let d = found; d > 0; d--) {
    const prev = trace[d];
    const k = x - y;
    const pk = k === -d || (k !== d && prev[off + k - 1] < prev[off + k + 1]) ? k + 1 : k - 1;
    const del = pk === k - 1;
    const px = prev[off + pk], py = px - pk;
    while (x > px + (del ? 1 : 0) && y > py + (del ? 0 : 1)) {
      x--;
      y--;
    }
    steps.push({ x: px, y: py, del });
    x = px;
    y = py;
  }
  steps.reverse();
  const hunks: Hunk[] = [];
  for (const s of steps) {
    const last = hunks[hunks.length - 1];
    const h = last && last.a1 === s.x && last.b1 === s.y ? last : { a0: s.x, a1: s.x, b0: s.y, b1: s.y };
    if (h !== last) hunks.push(h);
    if (s.del) h.a1 += 1;
    else h.b1 += 1;
  }
  return hunks;
}

// the changes that turn base into theirs, as edits of base in the order of the file. null when
// the texts are too far apart to be one file, i.e. when the diff is given up or the changes replace
// more than half of base, e.g. for an empty file or another deck
export function changes(base: string, theirs: string): Edit[] | null {
  if (base === theirs) return [];
  const a = linesOf(base), b = linesOf(theirs);
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const hunks = diff(a.slice(pre, a.length - suf), b.slice(pre, b.length - suf), MAX_LINES);
  if (!hunks) return null;
  const oa = offsets(a), ob = offsets(b);
  const out: Edit[] = [];
  let removed = 0;
  for (const h of hunks) {
    let start = oa[pre + h.a0], end = oa[pre + h.a1];
    let text = theirs.slice(ob[pre + h.b0], ob[pre + h.b1]);
    // each hunk is narrowed to the characters that differ, hence a change of one text on a line
    // does not overlap an edit of another text on the same line
    const old = base.slice(start, end);
    let p = 0;
    while (p < old.length && p < text.length && old[p] === text[p]) p++;
    let s = 0;
    while (s < old.length - p && s < text.length - p && old[old.length - 1 - s] === text[text.length - 1 - s]) s++;
    start += p;
    end -= s;
    text = text.slice(p, text.length - s);
    removed += end - start;
    out.push({ start, end, text });
  }
  return removed > base.length / 2 ? null : out;
}

// a and b overlap when they share a character, or when one of them is an insertion inside the
// other or at one of its ends
export function overlaps(a: Edit, b: Edit): boolean {
  if (a.start < b.end && b.start < a.end) return true;
  return (a.start === a.end || b.start === b.end) && a.start <= b.end && b.start <= a.end;
}

// base with edits that do not overlap
export function apply(base: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
  let text = base;
  for (const e of sorted) text = text.slice(0, e.start) + e.text + text.slice(e.end);
  return text;
}

const equal = (a: Edit, b: Edit) => a.start === b.start && a.end === b.end && a.text === b.text;

// the edits of the page, ours, written into theirs. a change of the file equal to an edit of the
// page is taken once. at a conflict, the edit of the page is kept with prefer set to ours, and the
// change of the file with prefer set to theirs, and every edit and change outside a conflict is
// kept. null when theirs is not the same file as base
export function merge(base: string, ours: Edit[], theirs: string, prefer: 'ours' | 'theirs'): Merge | null {
  const all = changes(base, theirs);
  if (!all) return null;
  const others = all.filter((h) => !ours.some((o) => equal(o, h)));
  const conflicts = ours.filter((o) => others.some((h) => overlaps(o, h)));
  const keptTheirs = prefer === 'theirs' ? all : all.filter((h) => !conflicts.some((o) => overlaps(o, h)));
  const keptOurs = (prefer === 'ours' ? ours : ours.filter((o) => !conflicts.includes(o))).filter((o) => !keptTheirs.some((h) => equal(o, h)));
  return { text: apply(base, [...keptOurs, ...keptTheirs]), conflicts };
}
