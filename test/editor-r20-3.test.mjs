// tests of R20.3, curved and elbow lines with weights and a dash, on both platforms with trusted
// input. a curve is a path M x1 y1 Q cx cy x2 y2 and an elbow a path of horizontal and vertical
// segments in an svg.line, drawn by Curved Arrow and Elbow Arrow of the Insert menu, selected and
// marqueed by their stroke, bent by a third grip, and switched with the segment Kind of the Line
// pane. the segment Weight writes weight-2, weight-6, or weight-8 on the svg, and the switch Dashed
// writes dashed. each edit is checked byte for byte after an undo and a redo, against the scope
// rule, and after a save and an open of the saved text. the geometry of canvas/stroke.ts is tested
// under node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { attributeProblem, textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { lineText } from '../src/editor/commands/line.ts';
// imported by itself, so that each test fails on its own without the module
const { bboxOf, bendTo, gripOf, parseStroke, pointsOf, rebend, strokeText, withKind } = await import('../src/editor/canvas/stroke.ts').catch(() => ({}));
import { byteExact, click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test/pages/editor-r20-3.html';
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const PANEL = '#beeson-edit-panel-format';
const ORIGINAL = readFileSync(DECK, 'utf8').match(/<svg class="line fragment"[^\n]*<\/svg>/)[0];
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
// a child element of a line, read by parseStroke as a DOM element is
const child = (localName, attrs) => ({ localName, getAttribute: (n) => attrs[n] ?? null });

test('the text, the box, the grip, and a moved end of a curve and an elbow in canvas/stroke.ts', () => {
  // a curve from 100,500 to 500,500 bulging up to its control point at 300,300
  const curve = { kind: 'curve', x1: 100, y1: 500, x2: 500, y2: 500, c: { x: 300, y: 300 } };
  const t = strokeText(curve);
  assert.equal(t.tag, 'path');
  // the apex is at y 400, halfway to the control point, hence the box is 100 px high
  assert.deepEqual(t.box, { left: 100, top: 400, width: 400, height: 100 });
  assert.equal(t.attrs.d, 'M0 100 Q200 -100 400 100');
  assert.deepEqual(parseStroke(child('path', t.attrs), { x: 100, y: 400 }), curve);
  assert.deepEqual(gripOf(curve), { x: 300, y: 400 });
  assert.deepEqual(bendTo(curve, { x: 300, y: 400 }), curve);
  assert.deepEqual(bendTo(curve, { x: 200, y: 450 }).c, { x: 100, y: 400 });
  const pts = pointsOf(curve);
  assert.equal(pts.length, 25);
  assert.deepEqual(pts[12], { x: 300, y: 400 });
  // a moved end keeps the control point in proportion to the chord: a chord twice as long and
  // turned by 90 degrees puts the control point 400 px to the right of its middle
  const turned = rebend(curve, { x1: 100, y1: 100, x2: 100, y2: 900 });
  assert.ok(near(turned.c.x, 500, 1e-9) && near(turned.c.y, 500, 1e-9), JSON.stringify(turned.c));
  // the default bend of a new curve is a quarter of the chord to the left of its direction
  assert.deepEqual(withKind({ x1: 100, y1: 500, x2: 500, y2: 500 }, 'curve').c, { x: 300, y: 400 });
  // a straight line is written as the line element of lineText
  const s = strokeText(withKind({ x1: 700, y1: 600, x2: 300, y2: 400 }, 'straight'));
  assert.deepEqual(s, { box: { left: 300, top: 400, width: 400, height: 200 }, tag: 'line', attrs: { x1: '400', y1: '200', x2: '0', y2: '0' } });
  // an elbow leaving horizontally, with its middle segment halfway
  const elbow = withKind({ x1: 100, y1: 200, x2: 500, y2: 400 }, 'elbow');
  assert.deepEqual(elbow, { kind: 'elbow', x1: 100, y1: 200, x2: 500, y2: 400, h: true, m: 300 });
  const e = strokeText(elbow);
  assert.deepEqual(e.box, { left: 100, top: 200, width: 400, height: 200 });
  assert.equal(e.attrs.d, 'M0 0 H200 V200 H400');
  assert.deepEqual(parseStroke(child('path', e.attrs), { x: 100, y: 200 }), elbow);
  assert.deepEqual(gripOf(elbow), { x: 300, y: 300 });
  assert.deepEqual(pointsOf(elbow), [{ x: 100, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 400 }, { x: 500, y: 400 }]);
  // the grip moves the middle segment along x only, and past an end the box grows
  const out = bendTo(elbow, { x: 600, y: 999 });
  assert.equal(out.m, 600);
  assert.deepEqual(strokeText(out).box, { left: 100, top: 200, width: 500, height: 200 });
  // within the tolerance the middle segment lands on the line of an end, written with one bend
  const one = bendTo(elbow, { x: 495, y: 300 }, 8);
  assert.equal(one.m, 500);
  assert.equal(strokeText(one).attrs.d, 'M0 0 H400 V200');
  assert.deepEqual(parseStroke(child('path', { d: 'M0 0 H400 V200' })), { kind: 'elbow', h: true, m: 400, x1: 0, y1: 0, x2: 400, y2: 200 });
  assert.equal(strokeText(bendTo(elbow, { x: 104, y: 0 }, 8)).attrs.d, 'M0 0 V200 H400');
  // an elbow leaving vertically, and a moved end that keeps the fraction of the middle segment
  const up = withKind({ x1: 100, y1: 100, x2: 200, y2: 500 }, 'elbow');
  assert.equal(strokeText(up).attrs.d, 'M0 0 V200 H100 V400');
  assert.equal(rebend(up, { x1: 100, y1: 100, x2: 200, y2: 900 }).m, 500);
  // a path that the editor does not write is not read
  assert.equal(parseStroke(child('path', { d: 'M0 0 C10 10 20 20 30 30' })), null);
  assert.equal(parseStroke(child('path', { d: 'M0 0 H10 H20' })), null);
  assert.deepEqual(bboxOf({ kind: 'straight', x1: 10, y1: 5, x2: 10, y2: 5 }), { left: 10, top: 5, width: 1, height: 1 });
});

test('the text of a curved and an elbow arrow follows the scope rule', () => {
  const curve = lineText(withKind({ x1: 100, y1: 500, x2: 500, y2: 500 }, 'curve'), { id: 'line-1', heads: 'end' });
  assert.equal(curve, '<svg class="line" width="400" height="50" style="translate: 100px 450px"><defs><marker id="line-1" orient="auto-start-reverse"><path d="M-4-2.5 1 0-4 2.5z"></path></marker></defs><path d="M0 50 Q200 -50 400 50" marker-end="url(#line-1)"></path></svg>');
  assert.deepEqual(textProblems(curve, THEME), []);
  const elbow = lineText(withKind({ x1: 100, y1: 200, x2: 500, y2: 400 }, 'elbow'), { id: 'line-2', heads: 'both' });
  assert.ok(elbow.includes('<path d="M0 0 H200 V200 H400" marker-start="url(#line-2)" marker-end="url(#line-2)"></path>'), elbow);
  assert.deepEqual(textProblems(elbow, THEME), []);
  for (const name of ['d', 'marker-start', 'marker-end']) assert.equal(attributeProblem(name, false, 'path'), null, name);
  assert.deepEqual(textProblems('<svg class="line weight-6 dashed" width="1" height="1"></svg><svg class="line weight-2"></svg><svg class="line weight-8"></svg>', THEME), []);
});

let browser;
let server;
before(async () => {
  browser = await launch({ offline: false });
  server = await serve('.');
});
after(async () => {
  await browser?.close();
  server?.close();
});

const js = (v) => JSON.stringify(v);
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg ? `, ${js(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((e) => e.localName + (e.getAttribute('class') ? '.' + e.getAttribute('class').split(' ')[0] : ''))`);
const grips = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-line-end')].filter((g) => !g.hidden).map((g) => { const r = g.getBoundingClientRect(); return { end: g.dataset.end, x: r.left + r.width / 2, y: r.top + r.height / 2, locked: g.classList.contains('locked') }; })`);
const free = (platform) => (platform === 'mac' ? 'Meta' : 'Alt');
let saves = 0;

async function load(t, platform, n = 0) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${DECK}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  await page.send('Browser.grantPermissions', { origin: server.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
  return page;
}

async function inScope(page) {
  const now = textProblems(await render(page), THEME);
  for (const p of textProblems(page.source, THEME)) {
    const i = now.indexOf(p);
    if (i >= 0) now.splice(i, 1);
  }
  assert.deepEqual(now, []);
}

// the edit undone to the file byte for byte, redone to the same text, and saved and opened again
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  await inScope(page);
  for (let i = 0; i < undos; i++) await undo(page);
  await byteExact(page);
  for (let i = 0; i < undos; i++) await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r20-3-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  return edited;
}

// the screen point of a point in slide px
const screen = (page, x, y) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides');
  const r = s.getBoundingClientRect(), k = r.width / s.offsetWidth;
  return { x: r.left + ${x} * k, y: r.top + ${y} * k };
})()`);

// the lines of the current slide: the tag and the attributes of the stroke, its translate, the
// classes, and the computed fill, stroke, width, and dash of the stroke
const lines = (page) => page.evaluate(`[...Reveal.getCurrentSlide().querySelectorAll('svg.line')].map((svg) => {
  const l = svg.querySelector(':scope > line, :scope > path');
  const cs = getComputedStyle(l);
  const [tx, ty] = (svg.style.translate || '0px 0px').split(' ').map((v) => parseFloat(v) || 0);
  return { tag: l.localName, d: l.getAttribute('d'), t: [tx, ty], w: Number(svg.getAttribute('width')), h: Number(svg.getAttribute('height')), cls: svg.getAttribute('class'),
    id: svg.querySelector('marker').id, start: l.getAttribute('marker-start'), end: l.getAttribute('marker-end'),
    fill: cs.fill, stroke: cs.stroke, weight: cs.strokeWidth, dash: cs.strokeDasharray, rotate: svg.style.rotate,
    head: svg.querySelector('marker path').getBoundingClientRect().width };
})`);

// the rendered text without the one line inserted into it, and that line
async function inserted(page) {
  const text = await render(page);
  const m = /\n[ \t]*(<svg class="line[^\n]*<\/svg>)/.exec(text);
  assert.ok(m, 'a line is not in the rendered text');
  assert.equal(text.slice(0, m.index) + text.slice(m.index + m[0].length), page.source);
  return m[1];
}

// the numbers of the d of a curve, M x1 y1 Q cx cy x2 y2, in slide px
const curveOf = (l) => l.d.match(/-?\d+/g).map((v, i) => Number(v) + l.t[i % 2]);
const closeTo = (a, b, tol = 2) => a.length === b.length && a.every((v, i) => near(v, b[i], tol));
// a click on the point x, y of the stroke of a line in slide px, which selects it again after an
// open of the saved text
const reselect = async (page, x, y) => {
  await click(page, await screen(page, x, y));
  await frames(page);
};

const curve = (page) => exec(page, 'insert.curve', { from: { x: 300, y: 600 }, to: { x: 1100, y: 600 } });

for (const platform of PLATFORMS) {
  test(`Curved Arrow and Elbow Arrow write a path before the notes, not filled, and follow Arrow in the menus, on ${platform}`, async (t) => {
    const page = await load(t, platform);
    assert.equal((await state(page, 'insert.curve')).enabled, true);
    await curve(page);
    await frames(page);
    const svg = await inserted(page);
    assert.equal(svg, lineText(withKind({ x1: 300, y1: 600, x2: 1100, y2: 600 }, 'curve'), { id: 'line-2', heads: 'end' }));
    assert.match(await render(page), /<svg class="line"[^\n]*<\/svg>\n  <aside class="notes">Notes\./);
    let [l] = await lines(page);
    assert.equal(l.tag, 'path');
    assert.equal(l.fill, 'none');
    const text = await page.evaluate(`(() => { const d = document.createElement('div'); d.style.color = 'var(--text)'; Reveal.getCurrentSlide().append(d); const c = getComputedStyle(d).color; d.remove(); return c; })()`);
    assert.equal(l.stroke, text);
    assert.equal(l.end, `url(#${l.id})`);
    assert.equal(await undoLabel(page), 'Undo Insert Curved Arrow');
    // the Line pane is shown with Curved checked in its segment Kind
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await frames(page);
    assert.ok(await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].some((b) => b.textContent === 'Line')`));
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} [data-command="line.kind.curve"]')?.getAttribute('aria-pressed')`), 'true');
    assert.equal((await state(page, 'line.kind.curve')).checked, true);
    await roundTrip(page);
    page.source = await render(page);
    // an elbow from a drag of 800 by 200 px leaves horizontally with its middle segment halfway
    await exec(page, 'insert.elbow', { from: { x: 300, y: 700 }, to: { x: 1100, y: 900 } });
    await frames(page);
    [, l] = await lines(page);
    assert.equal(l.d, 'M0 0 H400 V200 H800');
    assert.deepEqual(l.t, [300, 700]);
    assert.equal(await undoLabel(page), 'Undo Insert Elbow Arrow');
    await roundTrip(page);
    // the Shape button and the Insert menu list the two after Arrow
    const shape = await page.evaluate(`(() => { const r = document.querySelector('.beeson-edit-split:has([data-command="insert.shape.rounded"]) .more').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await click(page, shape);
    await frames(page);
    const listed = await page.evaluate(`[...[...document.querySelectorAll('.beeson-edit-menu')].filter((m) => m.getClientRects().length).at(-1).querySelectorAll('.item')].map((i) => i.dataset.command)`);
    assert.deepEqual(listed.slice(listed.indexOf('insert.arrow'), listed.indexOf('insert.arrow') + 3), ['insert.arrow', 'insert.curve', 'insert.elbow']);
    await press(page, 'Escape');
  });

  test(`a drag in the mode of Curved Arrow draws a curve with its bend, and of Elbow Arrow an elbow, on ${platform}`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'insert.curve');
    assert.equal((await state(page, 'insert.curve')).checked, true);
    const a = await screen(page, 300, 600);
    const b = await screen(page, 700, 600);
    await drag(page, a, { dx: b.x - a.x, dy: b.y - a.y, modifiers: free(platform) });
    await frames(page);
    let [l] = await lines(page);
    const m = /^M(\S+) (\S+) Q(\S+) (\S+) (\S+) (\S+)$/.exec(l.d);
    assert.ok(m, l.d);
    const [x1, y1, cx, cy, x2, y2] = m.slice(1).map(Number).map((v, i) => v + l.t[i % 2]);
    assert.ok(near(x1, 300, 2) && near(y1, 600, 2) && near(x2, 700, 2) && near(y2, 600, 2), l.d);
    assert.ok(near(cx, 500, 2) && near(cy, 500, 2), `${cx} ${cy}`);
    assert.equal((await state(page, 'insert.curve')).checked, null);
    await undo(page);
    await byteExact(page);
    await exec(page, 'insert.elbow');
    const c = await screen(page, 500, 900);
    await drag(page, a, { dx: c.x - a.x, dy: c.y - a.y, modifiers: free(platform) });
    await frames(page);
    [l] = await lines(page);
    assert.match(l.d, /^M0 0 V\d+ H\d+ V\d+$/);
    await undo(page);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`a press, a right-click, and a marquee find a curve by its stroke and not by its chord, on ${platform}`, async (t) => {
    const page = await load(t, platform);
    await curve(page);
    await exec(page, 'selection.clear');
    await frames(page);
    // the control point is at 700,400, hence the apex is 100 px above the chord, at y 500
    const chord = await screen(page, 700, 600);
    await click(page, chord);
    await frames(page);
    assert.deepEqual(await selected(page), [], 'a press on the chord, far from the curve, selects it');
    const apex = await screen(page, 700, 503);
    await click(page, apex);
    await frames(page);
    assert.deepEqual(await selected(page), ['svg.line'], 'a press near the apex does not select the curve');
    await exec(page, 'selection.clear');
    await click(page, apex, { button: 'right' });
    await frames(page);
    assert.deepEqual(await selected(page), ['svg.line'], 'a right-click near the apex does not select the curve');
    assert.ok(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu')].some((m) => m.getClientRects().length && [...m.querySelectorAll('.item')].some((i) => i.dataset.command === 'arrange.toggleLock'))`), 'the element menu is not open');
    await press(page, 'Escape');
    await exec(page, 'selection.clear');
    await frames(page);
    // a marquee around the apex, away from the chord and the ends
    const from = await screen(page, 650, 470);
    const to = await screen(page, 750, 520);
    await drag(page, from, { dx: to.x - from.x, dy: to.y - from.y });
    await frames(page);
    assert.deepEqual(await selected(page), ['svg.line'], 'a marquee across the bulge does not select the curve');
    await exec(page, 'selection.clear');
    // a marquee on the chord inside the bulge selects nothing
    const in1 = await screen(page, 650, 570);
    const in2 = await screen(page, 750, 630);
    await drag(page, in1, { dx: in2.x - in1.x, dy: in2.y - in1.y });
    await frames(page);
    assert.deepEqual(await selected(page), [], 'a marquee on the chord selects the curve');
    assert.deepEqual(errors(page), []);
  });

  test(`the grip of the bend moves the control point of a curve, Esc puts it back, and a moved end keeps the arc, on ${platform}`, async (t) => {
    const page = await load(t, platform);
    await curve(page);
    await frames(page);
    page.source = await render(page);
    let g = await grips(page);
    assert.deepEqual(g.map((x) => x.end), ['1', '2', 'bend']);
    const bend = g[2];
    const apex = await screen(page, 700, 500);
    assert.ok(near(bend.x, apex.x) && near(bend.y, apex.y), `the grip is at ${bend.x},${bend.y}, not on the apex ${apex.x},${apex.y}`);
    // a drag of the grip to 700,300 puts the control point at 700,0
    const to = await screen(page, 700, 300);
    await drag(page, bend, { dx: to.x - bend.x, dy: to.y - bend.y, modifiers: free(platform), hold: true });
    await press(page, 'Escape');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', clickCount: 1 });
    await frames(page);
    await byteExact(page);
    assert.equal((await grips(page)).length, 3, 'Esc in a drag of the bend leaves the curve');
    await drag(page, bend, { dx: to.x - bend.x, dy: to.y - bend.y, modifiers: free(platform) });
    await frames(page);
    let [l] = await lines(page);
    assert.ok(closeTo(curveOf(l), [300, 600, 700, 0, 1100, 600]), l.d);
    assert.ok(l.d.startsWith('M0 ') && /^M0 \d+ Q\d+ -\d+ 800 \d+$/.test(l.d), l.d);
    assert.equal(await undoLabel(page), 'Undo Bend Line');
    await roundTrip(page);
    page.source = await render(page);
    await reselect(page, 700, 302);
    // a drag of the second end to 700,600 halves the chord, and the apex is then 150 px above it
    g = await grips(page);
    const end = g.find((x) => x.end === '2');
    const at = await screen(page, 1100, 600);
    const mid = await screen(page, 700, 600);
    await drag(page, end, { dx: mid.x - at.x, dy: mid.y - at.y, modifiers: free(platform) });
    await frames(page);
    [l] = await lines(page);
    const [x1, y1, cx, cy, x2, y2] = curveOf(l);
    assert.ok(closeTo([x1, y1, x2, y2], [300, 600, 700, 600], 0), l.d);
    assert.ok(closeTo([cx, cy], [500, 300], 3), l.d);
    await roundTrip(page);
  });

  test(`a dragged end of a line snaps to the middle of a curve on its stroke, on ${platform}`, async (t) => {
    const page = await load(t, platform);
    await curve(page);
    await exec(page, 'insert.line', { from: { x: 200, y: 200 }, to: { x: 400, y: 200 } });
    await frames(page);
    page.source = await render(page);
    // the end is dropped 4 px off the apex of the curve at 700,500, far from its chord
    const end = (await grips(page)).find((x) => x.end === '2');
    const at = await screen(page, 400, 200);
    const to = await screen(page, 704, 497);
    await drag(page, end, { dx: to.x - at.x, dy: to.y - at.y });
    await frames(page);
    const [, l] = await lines(page);
    assert.equal(l.tag, 'line');
    const x2 = await page.evaluate(`Number(Reveal.getCurrentSlide().querySelectorAll('svg.line')[1].querySelector('line').getAttribute('x2'))`);
    const y2 = await page.evaluate(`Number(Reveal.getCurrentSlide().querySelectorAll('svg.line')[1].querySelector('line').getAttribute('y2'))`);
    assert.deepEqual([l.t[0] + x2, l.t[1] + y2], [700, 500]);
    await roundTrip(page);
  });

  test(`the grip of an elbow moves its middle segment, and onto the line of an end writes one bend, on ${platform}`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'insert.elbow', { from: { x: 300, y: 300 }, to: { x: 1100, y: 700 } });
    await frames(page);
    page.source = await render(page);
    const g = await grips(page);
    const bend = g.find((x) => x.end === 'bend');
    const was = await screen(page, 700, 500);
    assert.ok(near(bend.x, was.x) && near(bend.y, was.y));
    // a drag to the right and down moves only x of the middle segment
    const to = await screen(page, 900, 650);
    await drag(page, bend, { dx: to.x - bend.x, dy: to.y - bend.y, modifiers: free(platform) });
    await frames(page);
    let [l] = await lines(page);
    const m = /^M0 0 H(\d+) V400 H800$/.exec(l.d);
    assert.ok(m && near(Number(m[1]), 600, 2), l.d);
    await roundTrip(page);
    page.source = await render(page);
    await reselect(page, 300 + Number(m[1]), 400);
    // a drag to 5 px left of the second end lands the segment on its line
    const g2 = (await grips(page)).find((x) => x.end === 'bend');
    const onto = await screen(page, 1095, 500);
    await drag(page, g2, { dx: onto.x - g2.x, dy: onto.y - g2.y });
    await frames(page);
    [l] = await lines(page);
    assert.equal(l.d, 'M0 0 H800 V400');
    assert.deepEqual(l.t, [300, 300]);
    await roundTrip(page);
  });

  test(`the segment Kind takes a grouped arrow at a step to a curve, an elbow, and back to its bytes, on ${platform}`, async (t) => {
    const page = await load(t, platform, 1);
    // a click on the arrow selects its group, and the commands of Format > Line act on its line
    await click(page, await screen(page, 500, 500));
    await frames(page);
    assert.deepEqual(await selected(page), ['p', 'svg.line']);
    assert.equal((await state(page, 'line.kind.straight')).checked, true);
    await exec(page, 'line.kind.curve');
    await frames(page);
    let text = await render(page);
    const curved = text.match(/<svg class="line fragment"[^\n]*<\/svg>/)[0];
    assert.equal(curved, '<svg class="line fragment" width="400" height="50" style="translate: 300px 450px" data-group="g1" data-fragment-index="1"><defs><marker id="line-1" orient="auto-start-reverse"><path d="M-4-2.5 1 0-4 2.5z"></path></marker></defs><path d="M0 50 Q200 -50 400 50" marker-end="url(#line-1)"></path></svg>');
    assert.equal(text.replace(curved, ORIGINAL), page.source);
    assert.equal(await undoLabel(page), 'Undo Line Kind');
    assert.deepEqual(await selected(page), ['p', 'svg.line']);
    assert.equal((await state(page, 'line.kind.curve')).checked, true);
    await roundTrip(page);
    await reselect(page, 500, 452);
    await exec(page, 'line.kind.elbow');
    await frames(page);
    text = await render(page);
    assert.ok(text.includes('<svg class="line fragment" width="400" height="1" style="translate: 300px 500px" data-group="g1" data-fragment-index="1"><defs><marker id="line-1" orient="auto-start-reverse"><path d="M-4-2.5 1 0-4 2.5z"></path></marker></defs><path d="M0 0 H200 V0 H400" marker-end="url(#line-1)"></path></svg>'));
    await exec(page, 'line.kind.straight');
    await frames(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(await selected(page), ['p', 'svg.line']);
    // each change of kind is one entry, after the open of the saved curve
    await undo(page);
    assert.equal((await lines(page))[0].tag, 'path');
    await undo(page);
    assert.equal(await render(page), page.source.replace(ORIGINAL, curved));
    assert.deepEqual(errors(page), []);
  });

  test(`the segment Weight and the switch Dashed write a class on the svg, and the head grows with the weight, on ${platform}`, async (t) => {
    const page = await load(t, platform);
    await curve(page);
    await frames(page);
    page.source = await render(page);
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await frames(page);
    let [l] = await lines(page);
    assert.equal(l.weight, '3px');
    assert.equal(l.dash, 'none');
    assert.equal((await state(page, 'line.weight.3')).checked, true);
    const head = l.head;
    await click(page, `${PANEL} [data-command="line.weight.6"]`);
    await frames(page);
    [l] = await lines(page);
    assert.equal(l.cls, 'line weight-6');
    assert.equal(l.weight, '6px');
    assert.ok(near(l.head, head * 2, 1), `the head is ${l.head} px wide, not twice ${head}`);
    assert.equal(await undoLabel(page), 'Undo Line Weight');
    await roundTrip(page);
    await reselect(page, 700, 503);
    await click(page, `${PANEL} [data-command="line.weight.2"]`);
    await frames(page);
    [l] = await lines(page);
    assert.equal(l.cls, 'line weight-2');
    assert.equal(l.weight, '2px');
    await click(page, `${PANEL} [data-command="line.weight.8"]`);
    await frames(page);
    assert.equal((await lines(page))[0].weight, '8px');
    await click(page, `${PANEL} [data-command="line.weight.3"]`);
    await frames(page);
    await byteExact(page);
    await click(page, `${PANEL} input[data-command="line.dashed"]`);
    await frames(page);
    [l] = await lines(page);
    assert.equal(l.cls, 'line dashed');
    assert.notEqual(l.dash, 'none');
    assert.equal((await state(page, 'line.dashed')).checked, true);
    assert.equal(await undoLabel(page), 'Undo Dashed');
    await roundTrip(page);
  });

  test(`a nudge, a duplicate, a paste, a group, a lock, the order, a flip, and a turn act on a curve as on a line, on ${platform}`, async (t) => {
    const page = await load(t, platform);
    await curve(page);
    await frames(page);
    page.source = await render(page);
    const before = (await lines(page))[0];
    // the arrow keys move it by 1 and 10 px
    await press(page, 'ArrowRight');
    await press(page, 'Shift+ArrowDown');
    await frames(page);
    let [l] = await lines(page);
    assert.deepEqual(l.t, [before.t[0] + 1, before.t[1] + 10]);
    assert.equal(l.d, before.d);
    await undo(page);
    await byteExact(page);
    // a duplicate and a paste each get a marker of their own, named by their url()
    await press(page, 'Mod+D');
    await frames(page);
    await exec(page, 'edit.copy');
    await exec(page, 'edit.paste');
    await frames(page);
    const all = await lines(page);
    assert.equal(all.length, 3);
    assert.equal(new Set(all.map((x) => x.id)).size, 3);
    for (const one of all) {
      assert.equal(one.tag, 'path');
      assert.equal(one.end, `url(#${one.id})`);
    }
    await inScope(page);
    await undo(page);
    await undo(page);
    await byteExact(page);
    // a group of the curve and the heading is moved together by the arrow keys
    await click(page, await screen(page, 700, 503));
    await click(page, '.reveal section.present h2', { modifiers: 'Shift' });
    await exec(page, 'arrange.group');
    await frames(page);
    assert.match(await render(page), /<svg class="line" [^>]*data-group="[^"]+"/);
    await exec(page, 'selection.clear');
    await click(page, await screen(page, 700, 503));
    await press(page, 'ArrowLeft');
    await frames(page);
    assert.match(await render(page), /<h2 [^>]*style="translate: -1px 0px"|<h2 style="translate: -1px 0px"/);
    await undo(page);
    await undo(page);
    await byteExact(page);
    // a lock grays its three grips
    await exec(page, 'selection.clear');
    await click(page, await screen(page, 700, 503));
    await exec(page, 'arrange.lock');
    await frames(page);
    assert.deepEqual((await grips(page)).map((x) => [x.end, x.locked]), [['1', true], ['2', true], ['bend', true]]);
    await undo(page);
    await byteExact(page);
    // the layer order and a turn are offered, and a flip is not, as for a straight line
    for (const [id, on] of [['arrange.order.back', true], ['arrange.setRotation', true], ['arrange.flipHorizontal', false], ['arrange.flipVertical', false]]) {
      assert.equal((await state(page, id)).enabled, on, id);
    }
    await exec(page, 'arrange.order.back');
    await frames(page);
    assert.match(await render(page), /<svg class="line"[^>]*z-index: -1[^\n]*<path d="M0 /);
    await undo(page);
    await byteExact(page);
    await exec(page, 'arrange.setRotation', { deg: 30 });
    await frames(page);
    [l] = await lines(page);
    assert.equal(l.rotate, '30deg');
    await roundTrip(page);
  });
}
