import test from 'node:test';
import assert from 'node:assert/strict';
import { display, matches, parseKey } from '../src/editor/keymap.ts';

test('parses key strings and resolves Mod per platform', () => {
  for (const key of ['Mod+Shift+Z', 'Mod+S', 'Alt+ArrowUp', 'Shift+1', 'F6', 'PageDown', 'ArrowLeft', 'Mod+Shift+ArrowRight']) {
    assert.equal(parseKey(key, 'mac').key.length > 0, true);
    assert.equal(parseKey(key, 'other').key.length > 0, true);
  }
  for (const platform of ['mac', 'other']) {
    assert.deepEqual(parseKey('Mod+Shift+Z', platform), { key: 'z', shift: true, alt: false, ctrl: platform === 'other', meta: platform === 'mac' });
  }
});

test('matches exact modifiers and rejects AltGraph', () => {
  const event = (overrides = {}) => ({ key: 'z', shiftKey: true, altKey: false, ctrlKey: false, metaKey: true, getModifierState: (name) => name === 'AltGraph' && false, ...overrides });
  assert.equal(matches(event(), 'Mod+Shift+Z', 'mac'), true);
  assert.equal(matches(event({ shiftKey: false }), 'Mod+Shift+Z', 'mac'), false);
  assert.equal(matches(event({ getModifierState: () => true }), 'Mod+Shift+Z', 'mac'), false);
  assert.equal(matches(event({ metaKey: false, ctrlKey: true }), 'Mod+Shift+Z', 'other'), true);
});

test('displays platform shortcuts', () => {
  assert.equal(display('Mod+Shift+Z', 'mac'), '⇧⌘Z');
  assert.equal(display('Mod+Shift+Z', 'other'), 'Ctrl+Shift+Z');
});
