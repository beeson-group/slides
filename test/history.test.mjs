// the history of the editor without a page: an undo or a redo asked for while another one runs is
// queued, never dropped, and the changes made in a transaction are one entry with its label

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { History } from '../src/editor/history.ts';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function history() {
  return new History({ snapshot: () => '', restore: async () => {}, onChange: () => {} });
}

// an entry whose undo and redo take ms, as a formula that is typeset again
function slow(log, name, ms = 50) {
  return {
    label: name,
    undo: async () => {
      await sleep(ms);
      log.push(`undo ${name}`);
    },
    redo: async () => {
      await sleep(ms);
      log.push(`redo ${name}`);
    },
  };
}

test('an undo asked for while an undo runs is queued, not dropped', async () => {
  const h = history();
  const log = [];
  h.push(slow(log, 'a'));
  h.push(slow(log, 'b'));
  const first = h.undo();
  await sleep(10);
  const second = h.undo();
  await Promise.all([first, second]);
  assert.deepEqual(log, ['undo b', 'undo a']);
  assert.equal(h.canUndo, false);
  await Promise.all([h.redo(), h.redo()]);
  assert.deepEqual(log, ['undo b', 'undo a', 'redo a', 'redo b']);
  assert.equal(h.canRedo, false);
  assert.equal(h.canUndo, true);
});

// an entry that sets one key of state, and sets it back at an undo
function change(state, key, value, label = key) {
  const before = state[key];
  state[key] = value;
  return { label, undo: () => void (state[key] = before), redo: () => void (state[key] = value) };
}

test('the changes of a transaction are one entry with its label, undone in reverse order', async () => {
  const h = history();
  const state = { a: 0 };
  await h.transact('Two changes', () => {
    h.push(change(state, 'a', 1));
    h.push(change(state, 'a', 2));
  });
  assert.equal(h.undoLabel, 'Two changes');
  await h.undo();
  assert.deepEqual(state, { a: 0 });
  assert.equal(h.canUndo, false);
  assert.equal(h.redoLabel, 'Two changes');
  await h.redo();
  assert.deepEqual(state, { a: 2 });
});

test('a transaction inside another one is part of it, and one without a change is not an entry', async () => {
  const h = history();
  const state = { a: 0, b: 0 };
  await h.transact('Outer', async () => {
    h.push(change(state, 'a', 1));
    await h.transact('Inner', () => h.push(change(state, 'b', 1)));
  });
  await h.transact('Nothing', () => {});
  assert.equal(h.undoLabel, 'Outer');
  await h.undo();
  assert.deepEqual(state, { a: 0, b: 0 });
  assert.equal(h.canUndo, false);
});

test('the changes made before an error in a transaction are recorded, and the error is passed on', async () => {
  const h = history();
  const state = { a: 0 };
  await assert.rejects(
    h.transact('Failed', () => {
      h.push(change(state, 'a', 1));
      throw new Error('broken');
    }),
    /broken/,
  );
  assert.equal(h.undoLabel, 'Failed');
  await h.undo();
  assert.deepEqual(state, { a: 0 });
});
