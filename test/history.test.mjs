// the history of the editor without a page: an undo or a redo asked for while another one runs is
// queued, never dropped

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
