// checks of the steps of src/steps.ts, i.e. the fragments held at full opacity with data-keep or by
// a highlight, and the classes colored with data-highlight

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from '../src/steps.ts';

const step = (index, visible, more = {}) => ({ index, visible, keep: null, highlight: [], tone: 'accent', holds: [], ...more });

test('a fragment with an empty data-keep is held through the next step of the slide', () => {
  const steps = [step(1, true, { keep: 'next' }), step(4, true), step(6, true)];
  assert.deepEqual(resolve(steps, 4).held, [true, false, false]);
  assert.deepEqual(resolve(steps, 6).held, [false, false, false]);
});

test('a fragment with a data-keep of a number is held through that step', () => {
  const steps = [step(1, true, { keep: 3 }), step(2, true), step(3, true), step(4, true)];
  assert.deepEqual(resolve(steps, 3).held, [true, false, false, false]);
  assert.deepEqual(resolve(steps, 4).held, [false, false, false, false]);
});

test('the current fragment and a hidden fragment are not held', () => {
  const steps = [step(1, true, { keep: 'next' }), step(2, false)];
  assert.deepEqual(resolve(steps, 1).held, [false, false]);
  assert.deepEqual(resolve([step(1, false, { keep: 'next' }), step(2, false)], -1).held, [false, false]);
});

test('a fragment is held while the current step highlights a class in it', () => {
  const steps = [step(1, true, { holds: ['a'] }), step(2, true), step(3, true, { highlight: ['a'] }), step(4, true)];
  assert.deepEqual(resolve(steps, 2).held, [false, false, false, false]);
  assert.deepEqual(resolve(steps, 3).held, [true, false, false, false]);
  assert.deepEqual(resolve(steps, 4).held, [false, false, false, false]);
});

test('a class is colored once its step is shown, in the tone of the last step that names it', () => {
  const steps = [step(1, true, { highlight: ['a'] }), step(2, true, { highlight: ['a', 'b'], tone: 'violet' }), step(3, false, { highlight: ['c'] })];
  assert.deepEqual([...resolve(steps, 2).lit], [['a', 'violet'], ['b', 'violet']]);
  assert.deepEqual([...resolve([step(1, true, { highlight: ['a'] }), step(2, false, { highlight: ['a'], tone: 'violet' })], 1).lit], [['a', 'accent']]);
  assert.deepEqual([...resolve([step(1, false, { highlight: ['a'] })], -1).lit], []);
});
