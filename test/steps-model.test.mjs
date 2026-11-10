// checks of the step model of layers.ts, which the Steps tab of the editor writes into the indexes
// of a slide: the plan read from the items, the indexes written for a plan, a move by a drag, the
// start and Show Last of a step, the arrows of a row, One by one, and the data-keep of a number,
// which follows its step to its new index

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { itemsOf, moveTo, oneByOne, planOf, remapKeep, setFinal, setStart, setStep, shift, startOf, stepAt } from '../src/editor/layers.ts';

const at = (index) => ({ fragment: true, index, final: false });
const loose = { fragment: true, index: null, final: false };
const last = { fragment: true, index: null, final: true };
const none = { fragment: false, index: null, final: false };

// the indexes written for a plan, '' for an element shown with the slide and 'last' for a final
const written = (items, plan) => itemsOf(items, plan).map((it) => (!it.fragment ? '' : it.final ? 'last' : it.index));

test('a plan orders the indexes, then the fragments without an index, and keeps the finals last', () => {
  const items = [none, at(3), loose, at(1), last, at(3), loose];
  const plan = planOf(items);
  assert.deepEqual(plan, { groups: [[3], [1, 5], [2], [6]], finals: [4] });
  assert.deepEqual(items.map((_, i) => stepAt(plan, i)), [-1, 1, 2, 0, 4, 1, 3]);
  assert.deepEqual(items.map((_, i) => startOf(plan, i)), [null, 'click', 'click', 'click', 'click', 'with', 'click']);
  // the indexes are written from the lowest given index, and a final is written without an index
  assert.deepEqual(written(items, plan), ['', 2, 3, 1, 'last', 2, 4]);
  assert.deepEqual(written([at(0), at(2)], planOf([at(0), at(2)])), [0, 1]);
  assert.deepEqual(written([at(5), none], planOf([at(5), none])), [1, '']);
});

test('a row dragged from step 3 to step 1 moves its step before the others', () => {
  const items = [none, at(1), at(2), at(3), at(4)];
  const plan = planOf(items);
  const moved = moveTo(plan, 3, 0);
  assert.deepEqual(written(items, moved), ['', 2, 3, 1, 4]);
  // a gap past the last step makes a new last step, and null puts the element back with the slide
  assert.deepEqual(written(items, moveTo(plan, 1, 4)), ['', 4, 1, 2, 3]);
  assert.deepEqual(written(items, moveTo(plan, 2, null)), ['', 1, '', 2, 3]);
  // a row of a step with others leaves its step for a step of its own
  const shared = [at(1), at(1), at(2)];
  assert.deepEqual(written(shared, moveTo(planOf(shared), 1, 1)), [1, 2, 3]);
  assert.deepEqual(written(shared, moveTo(planOf(shared), 1, 2)), [1, 3, 2]);
  // a drop into the gap beside its own step does not change the order
  assert.deepEqual(written(items, moveTo(plan, 2, 1)), written(items, plan));
  assert.deepEqual(written(items, moveTo(plan, 2, 2)), written(items, plan));
});

test('a step chosen in the menu joins that step, or makes a new first or last step', () => {
  const items = [none, at(1), at(2), at(3)];
  const plan = planOf(items);
  assert.deepEqual(written(items, setStep(plan, 3, 0)), ['', 1, 2, 1]);
  assert.deepEqual(written(items, setStep(plan, 0, 1)), [2, 1, 2, 3]);
  assert.deepEqual(written(items, setStep(plan, 0, 'first')), [1, 2, 3, 4]);
  assert.deepEqual(written(items, setStep(plan, 1, 'last')), ['', 3, 1, 2]);
  assert.deepEqual(written(items, setStep(plan, 2, null)), ['', 1, '', 2]);
});

test('With Previous joins the step before, and On Click splits a step at its row', () => {
  const items = [at(1), at(2), at(2), at(3)];
  const plan = planOf(items);
  assert.deepEqual(written(items, setStart(plan, 1, 'with')), [1, 1, 1, 2]);
  assert.deepEqual(written(items, setStart(plan, 2, 'click')), [1, 2, 3, 4]);
  // the first step cannot be shown with a step before it
  assert.deepEqual(setStart(plan, 0, 'with'), plan);
});

test('Show Last puts a row after every step, and off makes it the last step', () => {
  const items = [at(1), at(2), none];
  const plan = setFinal(planOf(items), 0, true);
  assert.deepEqual(written(items, plan), ['last', 1, '']);
  assert.deepEqual(written(items, setFinal(plan, 0, false)), [2, 1, '']);
  assert.deepEqual(written(items, setFinal(planOf(items), 2, true)), [1, 2, 'last']);
});

test('the arrows of a row swap its step with a neighbor, or give it a step of its own', () => {
  const items = [at(1), at(2), at(2), at(3)];
  const plan = planOf(items);
  assert.deepEqual(written(items, shift(plan, 3, -1)), [1, 3, 3, 2]);
  assert.deepEqual(written(items, shift(plan, 0, 1)), [2, 1, 1, 3]);
  assert.deepEqual(written(items, shift(plan, 2, -1)), [1, 3, 2, 4]);
  assert.deepEqual(written(items, shift(plan, 1, 1)), [1, 3, 2, 4]);
  assert.deepEqual(shift(plan, 0, -1), plan);
});

test('One by one gives each eligible element a step in reading order and keeps the finals', () => {
  const items = [none, at(2), none, last, loose];
  const plan = oneByOne(planOf(items), [false, true, true, true, true]);
  assert.deepEqual(written(items, plan), ['', 1, 2, 'last', 3]);
});

test('a data-keep of a number follows its step to the new index', () => {
  const before = [at(1), at(2), at(3), at(4)];
  const after = itemsOf(before, moveTo(planOf(before), 2, 0));
  assert.equal(remapKeep(3, before, after), 1);
  assert.equal(remapKeep(1, before, after), 2);
  assert.equal(remapKeep(4, before, after), 4);
  // an index that is no longer a step is kept
  const off = itemsOf(before, moveTo(planOf(before), 2, null));
  assert.equal(remapKeep(3, before, off), 3);
  assert.equal(remapKeep(9, before, after), 9);
});
