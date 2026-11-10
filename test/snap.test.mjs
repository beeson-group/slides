// the snap engine of canvas/snap.ts, without the DOM: a dragged box snaps each of its edges and its
// center to the lines of the slide, the layouts, and the other elements within the threshold, and
// to equal gaps, the locked axis is not snapped, and a resize keeps the aspect and snaps the edge
// that its handle moves

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LAYOUT_GUIDES, lockedAxis, resizeBox, snapMove, snapResize } from '../src/editor/canvas/snap.ts';

const slide = { width: 1920, height: 1080 };
const box = (left, top, width, height) => ({ left, top, width, height });
// the threshold of 8 screen px at a scale of 0.5, in slide pixels
const T = 16;
// a box with each number rounded to 1e-9, against the rounding of floating point
const round = (b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v * 1e9) / 1e9]));

test('each edge and the center of a box snap to the edges and the center of another box', () => {
  const other = box(500, 600, 200, 100);
  const targets = { boxes: [other], slide };
  // the left edge 10 px right of the left edge of the other box
  assert.equal(snapMove(box(510, 100, 100, 50), targets, T).dx, -10);
  // the right edge 6 px left of its right edge
  assert.equal(snapMove(box(594, 100, 100, 50), targets, T).dx, 6);
  // the center 5 px right of its center
  assert.equal(snapMove(box(555, 100, 100, 50), targets, T).dx, -5);
  // the left edge 7 px right of its right edge, i.e. next to it
  assert.equal(snapMove(box(707, 100, 100, 50), targets, T).dx, -7);
  // the top edge 12 px under its top, the bottom edge 3 px over its bottom, and the middle
  assert.equal(snapMove(box(100, 612, 100, 50), targets, T).dy, -12);
  assert.equal(snapMove(box(100, 647, 100, 50), targets, T).dy, 3);
  assert.equal(snapMove(box(100, 621, 100, 50), targets, T).dy, 4);
  // beyond the threshold, a box does not snap
  assert.deepEqual(snapMove(box(480 - T - 1, 100, 10, 10), { boxes: [other], slide }, T), { dx: 0, dy: 0, guides: [], spacing: [] });
});

test('a box snaps to the edges and the center of the slide, and to the guides of the layouts', () => {
  const targets = { boxes: [], slide, layout: LAYOUT_GUIDES };
  const center = snapMove(box(905, 300, 100, 50), targets, T);
  assert.equal(center.dx, 5);
  assert.deepEqual(center.guides.filter((g) => g.axis === 'x'), [{ axis: 'x', at: 960, from: 0, to: 1080, kind: 'slide' }]);
  assert.equal(snapMove(box(1, 300, 100, 50), targets, T).dx, -1);
  assert.equal(snapMove(box(1813, 300, 100, 50), targets, T).dx, 7);
  for (const x of LAYOUT_GUIDES.x) {
    const s = snapMove(box(x + 6, 300, 30, 30), targets, T);
    assert.equal(s.dx, -6, `the guide at x = ${x}`);
    assert.ok(s.guides.some((g) => g.axis === 'x' && g.at === x && g.kind === 'layout'));
  }
  for (const y of LAYOUT_GUIDES.y) {
    const s = snapMove(box(300, y - 7, 30, 30), targets, T);
    assert.equal(s.dy, 7, `the guide at y = ${y}`);
  }
  // a dragged box snaps to x = 1200, the left edge of a zone
  assert.equal(snapMove(box(1192, 400, 300, 200), targets, T).dx, 8);
});

test('the nearest line wins, and the guide of an element is drawn across both boxes', () => {
  const a = box(500, 600, 200, 100);
  const b = box(503, 100, 60, 50);
  const s = snapMove(box(506, 300, 40, 40), { boxes: [a, b], slide }, T);
  assert.equal(s.dx, -3);
  assert.deepEqual(s.guides.filter((g) => g.axis === 'x'), [{ axis: 'x', at: 503, from: 100, to: 340, kind: 'element' }]);
});

test('an axis that is not snapped keeps its offset, as the locked axis of a drag with Shift', () => {
  const targets = { boxes: [box(500, 600, 200, 100)], slide };
  const s = snapMove(box(505, 605, 100, 50), targets, T, { x: false, y: true });
  assert.equal(s.dx, 0);
  assert.equal(s.dy, -5);
  assert.ok(s.guides.every((g) => g.axis === 'y'));
  assert.equal(lockedAxis(30, -10), 'x');
  assert.equal(lockedAxis(3, -10), 'y');
});

test('a box between two neighbors snaps to equal gaps, and after a pair to the gap of the pair', () => {
  const a = box(100, 400, 200, 100);
  const c = box(700, 400, 200, 100);
  // the middle with equal gaps of 150 is at x = 450, and the box is dragged to 446
  const between = snapMove(box(446, 420, 100, 60), { boxes: [a, c], slide }, T);
  assert.equal(between.dx, 4);
  assert.deepEqual(between.spacing, [{ axis: 'x', gaps: [{ from: 300, to: 450, at: 450 }, { from: 550, to: 700, at: 450 }] }]);
  // after a pair with a gap of 100, the box snaps 100 px after the second of them
  const b = box(400, 400, 200, 100);
  const after = snapMove(box(710, 410, 100, 60), { boxes: [a, b], slide }, T);
  assert.equal(after.dx, -10);
  assert.equal(after.spacing[0].gaps.length, 2);
  assert.ok(after.spacing[0].gaps.every((g) => g.to - g.from === 100));
  // a box that does not overlap the row on the other axis is not a neighbor
  assert.deepEqual(snapMove(box(446, 700, 100, 60), { boxes: [a, c], slide }, T).spacing, []);
});

test('a corner keeps the aspect and follows the diagonal, and an edge changes the width alone', () => {
  const from = box(100, 100, 400, 200);
  // the lower right corner dragged by 40, 20 along the diagonal of 400 by 200
  assert.deepEqual(round(resizeBox(from, 'se', 40, 20, { aspect: 2, center: false })), box(100, 100, 440, 220));
  // the upper left corner dragged in by 40, 20, anchored at the lower right
  assert.deepEqual(round(resizeBox(from, 'nw', 40, 20, { aspect: 2, center: false })), box(140, 120, 360, 180));
  // the right edge with an aspect changes both, anchored at the left and at the middle
  assert.deepEqual(round(resizeBox(from, 'e', 100, 37, { aspect: 2, center: false })), box(100, 75, 500, 250));
  // the bottom edge with an aspect gives the width from the height
  assert.deepEqual(round(resizeBox(from, 's', 0, 100, { aspect: 2, center: false })), box(0, 100, 600, 300));
  // without an aspect, only the width changes, and the left edge is moved
  assert.deepEqual(round(resizeBox(from, 'w', -50, 30, { aspect: null, center: false })), box(50, 100, 450, 200));
  assert.deepEqual(round(resizeBox(from, 'n', 0, 30, { aspect: null, center: false })), from);
  // about the center, an edge moves both sides
  assert.deepEqual(round(resizeBox(from, 'e', 50, 0, { aspect: null, center: true })), box(50, 100, 500, 200));
  // a box is not made smaller than 16 px
  assert.equal(resizeBox(from, 'se', -1000, -1000, { aspect: 2, center: false }).height, 16);
});

test('a resize snaps the moved edge to a line and keeps the aspect, and the guides are drawn there', () => {
  const from = box(100, 100, 400, 200);
  const targets = { boxes: [], slide, layout: LAYOUT_GUIDES };
  // the right edge dragged to 1194 snaps to 1200, the left edge of a zone
  const raw = resizeBox(from, 'se', 694, 347, { aspect: 2, center: false });
  assert.equal(Math.round(raw.left + raw.width), 1194);
  const snapped = snapResize(from, 'se', raw, targets, T, { aspect: 2, center: false });
  assert.deepEqual(round(snapped.box), box(100, 100, 1100, 550));
  assert.ok(snapped.guides.some((g) => g.axis === 'x' && g.at === 1200));
  // the left handle snaps the left edge, and the right edge stays
  const left = snapResize(from, 'w', resizeBox(from, 'w', 26, 0, { aspect: null, center: false }), targets, T, { aspect: null, center: false });
  assert.deepEqual(left.box, box(120, 100, 380, 200));
  // beyond the threshold nothing snaps
  const free = resizeBox(from, 'e', 300, 0, { aspect: null, center: false });
  assert.deepEqual(snapResize(from, 'e', free, targets, T, { aspect: null, center: false }), { box: free, guides: [], sizes: [] });
});

test('a resize snaps the size to that of another box, and marks the boxes of equal size', () => {
  const from = box(100, 100, 400, 200);
  const other = box(800, 500, 450, 120);
  const targets = { boxes: [other], slide };
  // the width dragged to 446 is made 450, the width of the other box, with the left edge kept
  const raw = resizeBox(from, 'e', 46, 0, { aspect: null, center: false });
  const snapped = snapResize(from, 'e', raw, targets, T, { aspect: null, center: false });
  assert.deepEqual(snapped.box, box(100, 100, 450, 200));
  assert.equal(snapped.sizes.length, 1);
  const [mark] = snapped.sizes;
  assert.equal(mark.axis, 'x');
  assert.deepEqual(mark.gaps.map((g) => [g.from, g.to]), [[100, 550], [800, 1250]]);
  // each mark is drawn above its box
  assert.deepEqual(mark.gaps.map((g) => g.at), [86, 486]);
  // about the center, the width is matched with both edges moved
  const center = snapResize(from, 'e', resizeBox(from, 'e', 22, 0, { aspect: null, center: true }), targets, T, { aspect: null, center: true });
  assert.deepEqual(center.box, box(75, 100, 450, 200));
  // a height is matched only with an aspect, since the editor writes only a width
  const tall = box(800, 500, 300, 150);
  const withAspect = snapResize(from, 'se', resizeBox(from, 'se', -98, -49, { aspect: 2, center: false }), { boxes: [tall], slide }, T, { aspect: 2, center: false });
  assert.deepEqual(round(withAspect.box), box(100, 100, 300, 150));
  assert.deepEqual(withAspect.sizes.map((s) => s.axis).sort(), ['x', 'y']);
});
