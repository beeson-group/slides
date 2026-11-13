// checks of the shapes of src/shapes.ts and theme/beeson.css: the path of each geometry drawn with
// an svg, under node, and the shapes of test/pages/shapes.html in Chrome, in both modes, after a
// change of their size and class, for a shape added after the start, and in the print view

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { DRAWN, shapePath } from '../src/shapes.ts';

const PAGE = 'test/pages/shapes.html';

// the points of a path as pairs of numbers, with the end point of an arc and without its radii, and
// with the control points of a cubic, which hold the cubic in their hull
function points(d) {
  const out = [];
  for (const m of d.matchAll(/([MLACZ])([^MLACZ]*)/g)) {
    const n = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (m[1] === 'A') out.push([n[5], n[6]]);
    else for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]);
  }
  return out;
}

test('the path of each geometry is drawn inside its box, inset by half the outline', () => {
  assert.deepEqual(DRAWN, ['triangle', 'arrow', 'arrow-both', 'brace', 'plus', 'equals']);
  assert.equal(shapePath('triangle', 200, 160, 3), 'M100 1.5L198.5 158.5L1.5 158.5Z');
  for (const kind of DRAWN) {
    const p = points(shapePath(kind, 300, 120, 6));
    assert.ok(p.length >= 3, kind);
    // the vertex of the cusp of a short brace, whose miter is cut to a bevel, is nearer to the edge
    for (const [x, y] of p) assert.ok(x >= 3 - 1e-9 && (x <= 297 + 1e-9 || (kind === 'brace' && y === 60 && x < 300)) && y >= 3 - 1e-9 && y <= 117 + 1e-9, `${kind}: ${x} ${y}`);
  }
  const xs = (d) => points(d).map(([x]) => x);
  assert.equal(Math.min(...xs(shapePath('arrow', 300, 120, 6))), 3);
  assert.equal(Math.max(...xs(shapePath('arrow', 300, 120, 6))), 297);
  // a brace is an open path, and an equals sign two closed ones
  assert.ok(!shapePath('brace', 80, 400, 3).includes('Z'));
  assert.equal((shapePath('equals', 140, 140, 3).match(/Z/g) ?? []).length, 2);
  // the head of an arrow is half the shorter side long, in a long and in a tall box
  const head = (w, h) => {
    const p = points(shapePath('arrow', w, h, 0));
    return Math.max(...p.map(([x]) => x)) - Math.max(...p.filter(([, y]) => Math.abs(y - h / 2) > 1e-6 && y > 0 && y < h).map(([x]) => x));
  };
  assert.equal(head(300, 120), 60);
  assert.equal(head(120, 300), 60);
  assert.equal(shapePath('rounded', 100, 100, 3), '');
});

// the segments of a path of M, L, and C as lists of points, from the end of the segment before
function segments(d) {
  const out = [];
  let at = null;
  for (const m of d.matchAll(/([MLC])([^MLC]*)/g)) {
    const n = m[2].trim().split(/[\s,]+/).map(Number);
    const ps = [];
    for (let i = 0; i < n.length; i += 2) ps.push([n[i], n[i + 1]]);
    if (m[1] !== 'M') out.push({ kind: m[1], ps: [at, ...ps] });
    at = ps.at(-1);
  }
  return out;
}
// the unit direction of a segment at its start and at its end
const unit = ([x, y]) => [x / Math.hypot(x, y), y / Math.hypot(x, y)];
const start = ({ ps }) => unit([ps[1][0] - ps[0][0], ps[1][1] - ps[0][1]]);
const end = ({ ps }) => unit([ps.at(-1)[0] - ps.at(-2)[0], ps.at(-1)[1] - ps.at(-2)[1]]);
const turn = (u, v) => Math.acos(Math.min(1, u[0] * v[0] + u[1] * v[1])) * 180 / Math.PI;
// the signs of the curvature of a cubic at 20 points, without the points where it is nearly straight
function bends({ ps: [a, b, c, e] }) {
  const out = [];
  for (let k = 1; k < 20; k++) {
    const t = k / 20, u = 1 - t;
    const d1 = [0, 1].map((i) => 3 * u * u * (b[i] - a[i]) + 6 * u * t * (c[i] - b[i]) + 3 * t * t * (e[i] - c[i]));
    const d2 = [0, 1].map((i) => 6 * u * (c[i] - 2 * b[i] + a[i]) + 6 * t * (e[i] - 2 * c[i] + b[i]));
    const cross = (d1[0] * d2[1] - d1[1] * d2[0]) / Math.hypot(...d1) ** 3;
    if (Math.abs(cross) > 1e-4) out.push(Math.sign(cross));
  }
  return out;
}

test('a brace is the skeleton of the glyph }, with round hooks, S curves into the cusp, and a corner only at the cusp', () => {
  for (const [w, h] of [[60, 200], [80, 400], [160, 240]]) {
    const d = shapePath('brace', w, h, 3), segs = segments(d), size = `${w} by ${h}`;
    assert.ok(!/[AQSTZ]/.test(d), size);
    assert.deepEqual(segs[0].ps[0], [1.5, 1.5], size);
    assert.deepEqual(segs.at(-1).ps.at(-1), [1.5, h - 1.5], size);
    // the cusp is the end of a segment at the middle of the right side, drawn in by its miter, or
    // by the smaller reach of its bevel where the miter is cut
    const cusp = segs.findIndex((s) => s.ps.at(-1)[0] >= w - 4 * 1.5 && s.ps.at(-1)[0] < w && s.ps.at(-1)[1] === h / 2);
    assert.ok(cusp > 0, size);
    for (let i = 0; i + 1 < segs.length; i++) {
      const angle = turn(end(segs[i]), start(segs[i + 1]));
      if (i === cusp) assert.ok(angle > 45, `${size}: the cusp turns by ${angle}`);
      else assert.ok(angle < 0.5, `${size}: a corner of ${angle} deg after segment ${i}`);
    }
    // a hook leaves its tip nearly level, turning down into the stem, and not straight down
    const tip = start(segs[0]);
    assert.ok(tip[0] > 0.8 && tip[1] > 0.05, `${size}: the hook leaves its tip along ${tip}`);
    // the curvature of the upper half changes its sign once, from the hook to the curve of the cusp
    const signs = segs.slice(0, cusp + 1).filter((s) => s.kind === 'C').flatMap(bends);
    assert.equal(signs.filter((v, k) => k > 0 && v !== signs[k - 1]).length, 1, `${size}: ${signs}`);
    // the lower half is the upper half mirrored
    const ps = points(d), flipped = ps.map(([x, y]) => [x, h - y]).reverse();
    assert.ok(ps.every(([x, y], k) => Math.abs(x - flipped[k][0]) < 0.011 && Math.abs(y - flipped[k][1]) < 0.011), size);
  }
});

test('a tall brace is extensible, with hooks and a cusp sized by its width, and a brace keeps to its box', () => {
  const tall = (h) => segments(shapePath('brace', 80, h, 3));
  const at = (segs, dy) => segs.map(({ kind, ps }) => kind + ps.map(([x, y]) => `${x} ${Math.round((y + dy) * 100) / 100}`).join(' '));
  const [short, long] = [tall(700), tall(1000)];
  // the hooks keep their place, the curves of the cusp move with the middle, and only the stems grow
  assert.deepEqual(long.map((s) => s.kind), ['C', 'L', 'C', 'C', 'L', 'C']);
  assert.deepEqual(at(long, 0)[0], at(short, 0)[0]);
  assert.deepEqual(at(long, -150).slice(2, 4), at(short, 0).slice(2, 4));
  assert.deepEqual(at(long, -300)[5], at(short, 0)[5]);
  for (const segs of [short, long]) {
    const stem = segs[1].ps;
    assert.equal(stem[0][0], stem[1][0], 'a stem is vertical');
  }
  assert.equal(Math.round(long[1].ps[1][1] - long[1].ps[0][1]), Math.round(short[1].ps[1][1] - short[1].ps[0][1]) + 150);
  // the curves of the hook and of the cusp take the same share of the height at any height, i.e.
  // they are sized by the width alone
  const shares = (segs) => [segs[0].ps[3][1] - segs[0].ps[0][1], segs[2].ps[3][1] - segs[2].ps[0][1]];
  assert.deepEqual(shares(long).map(Math.round), shares(short).map(Math.round));
  for (const [w, h] of [[160, 240], [300, 60], [40, 40]]) {
    // the vertex of a cusp that is cut to a bevel is under half of the outline from the edge
    for (const [x, y] of points(shapePath('brace', w, h, 4))) assert.ok(x >= 2 && (x <= w - 2 || (y === h / 2 && x < w)) && y >= 2 && y <= h - 2, `${w} by ${h}: ${x} ${y}`);
  }
});

test('a brace under about 8 widths high is the brace of this height drawn lower, with a tight cusp', () => {
  // the hook and the curve into the cusp take half of each half of the brace at most, hence the
  // cusp is not drawn wider along the brace on a short brace than on a tall one
  for (const [w, h] of [[80, 160], [80, 240], [80, 400], [160, 240], [40, 200]]) {
    const segs = segments(shapePath('brace', w, h, 3)), size = `${w} by ${h}`, half = h / 2 - 1.5;
    assert.deepEqual(segs.map((s) => s.kind), ['C', 'L', 'C', 'C', 'L', 'C'], `${size}: a short brace has its stems`);
    const hook = segs[0].ps[3][1] - segs[0].ps[0][1], stem = segs[1].ps[1][1] - segs[1].ps[0][1], cusp = segs[2].ps[3][1] - segs[2].ps[0][1];
    assert.ok(Math.abs((hook + cusp) / half - 0.5) < 0.005, `${size}: the hook and the cusp take ${(hook + cusp) / half} of a half`);
    assert.ok(Math.abs(stem / half - 0.5) < 0.005, `${size}: a stem takes ${stem / half} of a half`);
    assert.ok(Math.abs(hook / cusp - 0.95) < 0.005, `${size}: ${hook} ${cusp}`);
  }
  // from this height on, the hooks and the cusp are sized by the width alone
  const tall = segments(shapePath('brace', 80, 700, 3));
  assert.ok(Math.abs(tall[2].ps[3][1] - tall[2].ps[0][1] - 77) < 0.02);
});

test('the ink of the cusp of a brace reaches the edge of its box, as a miter or as a bevel', () => {
  // a miter longer than 4 half widths of the outline is cut to a bevel in svg, i.e. to a flat tip
  // that reaches sin a of a half width past the vertex, where a is the angle of the curves to the level
  for (const [w, h, s] of [[160, 240, 3], [160, 240, 8], [300, 60, 4], [40, 40, 4], [80, 160, 3], [80, 400, 3]]) {
    const segs = segments(shapePath('brace', w, h, s)), miter = 1 / Math.abs(end(segs[2])[1]), size = `${w} by ${h} at ${s}`;
    const ink = segs[2].ps[3][0] + s / 2 * (miter <= 4 ? miter : 1 / miter);
    assert.ok(Math.abs(ink - w) < 0.1, `${size}: the ink of the cusp reaches ${ink} with a miter of ${miter} half widths`);
  }
});

// the look of each shape of the current slide: its border, its background, and its svg child
const looks = (page) => page.evaluate(`[...Reveal.getCurrentSlide().querySelectorAll('.shape')].map((el) => {
  const s = getComputedStyle(el);
  const svg = el.querySelector(':scope > svg');
  const path = svg?.querySelector('path');
  const ps = path ? getComputedStyle(path) : null;
  const p = el.querySelector('p');
  const r = el.getBoundingClientRect(), w = p?.getBoundingClientRect();
  return { border: s.borderTopWidth + ' ' + s.borderTopStyle + ' ' + s.borderTopColor, radius: s.borderTopLeftRadius, bg: s.backgroundColor,
    svg: !!svg, hidden: svg?.getAttribute('aria-hidden') ?? null, d: path?.getAttribute('d') ?? null, fill: ps?.fill ?? null, stroke: ps?.stroke ?? null, strokeWidth: ps?.strokeWidth ?? null,
    flip: svg ? getComputedStyle(svg).scale : null, words: p ? getComputedStyle(p).color : null, center: w ? Math.round(w.left + w.width / 2 - r.left - r.width / 2) : null, pointer: s.pointerEvents };
})`);
// the color of a token, or of a mix of two colors, as the current slide computes it
const token = (page, name) => page.evaluate(`(() => { const d = document.createElement('div'); d.style.color = 'var(${name})'; Reveal.getCurrentSlide().append(d); const c = getComputedStyle(d).color; d.remove(); return c; })()`);
const mixed = (page, tone, pct, over) => page.evaluate(`(() => { const d = document.createElement('div'); d.style.color = 'color-mix(in srgb, var(${tone}) ${pct}%, ${over})'; Reveal.getCurrentSlide().append(d); const c = getComputedStyle(d).color; d.remove(); return c; })()`);

test('each geometry of the test deck is drawn in both modes, with the outline in the tone over its tint', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  for (const theme of ['dark', 'light']) {
    await page.goto(deckUrl(PAGE, `theme=${theme}&still`));
    await page.waitFor(deckSettled);
    const text = await token(page, '--text');
    const accent = await token(page, '--accent');
    const [plain, rounded, ellipse, translucent] = await looks(page);
    assert.equal(plain.border, `3px solid ${text}`, theme);
    assert.equal(plain.bg, await mixed(page, '--text', 20, 'var(--bg)'), theme);
    assert.equal(plain.radius, '0px');
    assert.equal(plain.words, text);
    assert.equal(plain.center, 0);
    assert.equal(plain.pointer, 'none');
    assert.equal(plain.svg, false);
    assert.equal(rounded.border, `6px solid ${accent}`, theme);
    assert.equal(rounded.radius, '24px');
    assert.equal(rounded.bg, await mixed(page, '--accent', 20, 'var(--bg)'), theme);
    assert.equal(rounded.words, text, 'the words keep the color of the text');
    assert.equal(ellipse.radius, '50%');
    assert.equal(ellipse.bg, 'rgba(0, 0, 0, 0)');
    assert.equal(ellipse.border, `3px solid ${await token(page, '--red')}`);
    assert.equal(translucent.border.split(' ')[0], '0px');
    assert.equal(translucent.bg, await mixed(page, '--bg', 75, 'transparent'));
    await page.evaluate('Reveal.slide(1)');
    await page.waitFor(deckSettled);
    const drawn = await looks(page);
    assert.deepEqual(drawn.map((s) => [s.svg, s.hidden, s.border.split(' ')[0], s.bg]), drawn.map(() => [true, 'true', '0px', 'rgba(0, 0, 0, 0)']), theme);
    const [triangle, arrow, , brace, , equals] = drawn;
    assert.equal(triangle.d, 'M100 1.5L198.5 158.5L1.5 158.5Z');
    assert.equal(triangle.stroke, text);
    assert.equal(triangle.strokeWidth, '3px');
    assert.equal(triangle.fill, await mixed(page, '--text', 20, 'var(--bg)'));
    assert.equal(arrow.stroke, await token(page, '--blue'));
    assert.equal(brace.fill, 'none');
    assert.equal(brace.flip, '-1 1');
    assert.equal(brace.d, shapePath('brace', 80, 400, 3));
    assert.equal(equals.strokeWidth, '0px');
    assert.deepEqual(page.errors, []);
  }
});

test('a shape is drawn again at a change of its size and class, and a shape added after the start by Beeson.mount', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl(PAGE, 'still'));
  await page.waitFor(deckSettled);
  await page.evaluate('Reveal.slide(1)');
  await page.waitFor(deckSettled);
  const frame = 'new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))';
  const slide = 'Reveal.getCurrentSlide()';
  await page.evaluate(`${slide}.querySelector('.triangle').style.width = '400px'`);
  await page.evaluate(frame);
  assert.equal(await page.evaluate(`${slide}.querySelector('.triangle > svg path').getAttribute('d')`), 'M200 1.5L398.5 158.5L1.5 158.5Z');
  // a class of a shape of CSS takes the svg off, and the class of a drawn geometry puts it back
  await page.evaluate(`${slide}.querySelector('.triangle').classList.replace('triangle', 'rounded')`);
  await page.evaluate(frame);
  assert.equal(await page.evaluate(`!!${slide}.querySelector('.rounded > svg')`), false);
  await page.evaluate(`${slide}.querySelector('.shape.rounded').classList.replace('rounded', 'plus')`);
  await page.evaluate(frame);
  assert.ok(await page.evaluate(`${slide}.querySelector('.shape.plus > svg path').getAttribute('d').startsWith('M')`));
  await page.evaluate(`${slide}.querySelector('.shape.plus').classList.add('weight-8')`);
  await page.evaluate(frame);
  assert.equal(await page.evaluate(`getComputedStyle(${slide}.querySelector('.shape.plus > svg path')).strokeWidth`), '8px');
  assert.ok(await page.evaluate(`${slide}.querySelector('.shape.plus > svg path').getAttribute('d').startsWith('M')`));
  const added = await page.evaluate(`(() => {
    const el = Object.assign(document.createElement('div'), { className: 'shape arrow-both' });
    el.style.cssText = 'width: 300px; height: 100px';
    ${slide}.append(el);
    window.Beeson.mount(el);
    return el.querySelectorAll(':scope > svg').length;
  })()`);
  assert.equal(added, 1);
  // a second mount does not draw a second svg
  await page.evaluate(`window.Beeson.mount(${slide})`);
  assert.deepEqual(await page.evaluate(`[...${slide}.querySelectorAll('.arrow-both')].map((el) => el.querySelectorAll(':scope > svg').length)`), [1, 1]);
  assert.deepEqual(page.errors, []);
});

test('every printed page carries the shapes of its slide, with the svg of each drawn geometry', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await printView(page, deckUrl(PAGE, 'print-pdf&still'));
  const printed = await page.evaluate(`[...document.querySelectorAll('.pdf-page')].map((p) => [...p.querySelectorAll('.shape')].map((el) => {
    const path = el.querySelector(':scope > svg path');
    const s = getComputedStyle(el);
    return [path ? path.getAttribute('d').length > 10 : null, s.opacity !== '0' && s.visibility !== 'hidden'];
  }))`);
  assert.deepEqual(printed.map((p) => p.length), [4, 6, 1, 1]);
  assert.deepEqual(printed[0].map((s) => s[0]), [null, null, null, null]);
  assert.deepEqual(printed[1].map((s) => s[0]), [true, true, true, true, true, true]);
  // the shape at a step is printed before and after its step
  assert.deepEqual([printed[2][0], printed[3][0]], [[true, false], [true, true]]);
});
