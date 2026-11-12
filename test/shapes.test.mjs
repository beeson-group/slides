// checks of the shapes of src/shapes.ts and theme/beeson.css: the path of each geometry drawn with
// an svg, under node, and the shapes of test/pages/shapes.html in Chrome, in both modes, after a
// change of their size and class, for a shape added after the start, and in the print view

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { DRAWN, shapePath } from '../src/shapes.ts';

const PAGE = 'test/pages/shapes.html';

// the points of a path as pairs of numbers, with the end point of an arc and without its radii
function points(d) {
  const out = [];
  for (const m of d.matchAll(/([MLAZ])([^MLAZ]*)/g)) {
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
    for (const [x, y] of p) assert.ok(x >= 3 - 1e-9 && x <= 297 + 1e-9 && y >= 3 - 1e-9 && y <= 117 + 1e-9, `${kind}: ${x} ${y}`);
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
    const [plain, rounded, ellipse, veil] = await looks(page);
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
    assert.equal(veil.border.split(' ')[0], '0px');
    assert.equal(veil.bg, await mixed(page, '--bg', 75, 'transparent'));
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
