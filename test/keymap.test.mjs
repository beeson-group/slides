import test from 'node:test';
import assert from 'node:assert/strict';
import { allowed, display, fallback, matches, parseKey } from '../src/editor/keymap.ts';

const PLATFORMS = ['mac', 'other'];

// a keydown as a browser reports it, with every modifier up unless it is given
const event = (key, code, mods = {}, altGraph = false) => ({
  key, code, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false,
  getModifierState: (name) => name === 'AltGraph' && altGraph,
  ...mods,
});

// the modifiers of a chord as the flags of an event
const flags = (c) => ({ shiftKey: c.shift, altKey: c.alt, ctrlKey: c.ctrl, metaKey: c.meta });

test('parses key strings and resolves Mod per platform', () => {
  for (const platform of PLATFORMS) {
    assert.deepEqual(parseKey('Mod+Shift+Z', platform), { key: 'z', shift: true, alt: false, ctrl: platform === 'other', meta: platform === 'mac' });
    assert.deepEqual(parseKey('Alt+ArrowUp', platform), { key: 'ArrowUp', shift: false, alt: true, ctrl: false, meta: false });
    assert.deepEqual(parseKey('Shift+1', platform), { key: '1', shift: true, alt: false, ctrl: false, meta: false });
    assert.deepEqual(parseKey('Ctrl+M', platform), { key: 'm', shift: false, alt: false, ctrl: true, meta: false });
    assert.deepEqual(parseKey('Mod++', platform).key, '+');
    assert.equal(parseKey('?', platform).key, '?');
    assert.equal(parseKey('F6', platform).key, 'F6');
    assert.throws(() => parseKey('Cmd+S', platform), /modifier Cmd/);
    assert.throws(() => parseKey('Mod+Return', platform), /key of Mod\+Return/);
  }
});

// every key string is matched by the event that types it, and not by the same event with one
// modifier more or less, on both platforms
const KEYS = [
  ['Mod+Z', 'z', 'KeyZ'], ['Mod+Shift+Z', 'Z', 'KeyZ'], ['Mod+Y', 'y', 'KeyY'], ['Mod+S', 's', 'KeyS'],
  ['Alt+ArrowUp', 'ArrowUp', 'ArrowUp'], ['Shift+F6', 'F6', 'F6'], ['F6', 'F6', 'F6'], ['PageDown', 'PageDown', 'PageDown'],
  ['Mod+Enter', 'Enter', 'Enter'], ['Mod+Shift+Enter', 'Enter', 'Enter'], ['G', 'g', 'KeyG'], ['D', 'd', 'KeyD'],
  ['Shift+1', '!', 'Digit1'], ['Space', ' ', 'Space'], ['Home', 'Home', 'Home'],
];

test('matches each key with its modifiers, and not with Shift, Alt, Ctrl, or Meta added or taken away', () => {
  for (const platform of PLATFORMS) {
    for (const [value, key, code] of KEYS) {
      const chord = parseKey(value, platform);
      const ev = event(key, code, flags(chord));
      assert.equal(matches(ev, value, platform), true, `${value} on ${platform}`);
      for (const flag of ['shiftKey', 'altKey', 'ctrlKey', 'metaKey']) {
        assert.equal(matches({ ...ev, [flag]: !ev[flag] }, value, platform), false, `${value} with ${flag} flipped on ${platform}`);
      }
    }
  }
});

test('AltGraph is never a shortcut on Windows and Linux, and Ctrl+Alt is not allowed there', () => {
  assert.equal(matches(event('z', 'KeyZ', { ctrlKey: true }, true), 'Mod+Z', 'other'), false);
  assert.equal(matches(event('z', 'KeyZ', { ctrlKey: true }), 'Mod+Z', 'other'), true);
  // Firefox on a Mac may report Option as AltGraph
  assert.equal(matches(event('ArrowUp', 'ArrowUp', { altKey: true }, true), 'Alt+ArrowUp', 'mac'), true);
  assert.equal(allowed('Mod+Alt+G', 'other'), false);
  assert.equal(allowed('Ctrl+Alt+G', 'other'), false);
  assert.equal(allowed('Mod+Alt+G', 'mac'), true);
  assert.equal(allowed('Mod+Shift+G', 'other'), true);
});

test('a letter typed with Option on a Mac, or on another script, is matched by its code', () => {
  assert.equal(matches(event('´', 'KeyE', { altKey: true, metaKey: true }), 'Mod+Alt+E', 'mac'), true);
  assert.equal(matches(event('Dead', 'KeyE', { altKey: true, metaKey: true }), 'Mod+Alt+E', 'mac'), true);
  assert.equal(matches(event('я', 'KeyZ', { ctrlKey: true }), 'Mod+Z', 'other'), true);
  // a Latin letter is matched by its key, as on a Dvorak layout
  assert.equal(matches(event('z', 'Slash', { metaKey: true }), 'Mod+Z', 'mac'), true);
  assert.equal(matches(event(';', 'KeyZ', { metaKey: true }), 'Mod+Z', 'mac'), false);
});

test('a digit is matched by its key or its code, and a symbol without its Shift', () => {
  assert.equal(matches(event('1', 'Digit1', { shiftKey: true }), 'Shift+1', 'other'), true);
  assert.equal(matches(event('&', 'Digit1'), '1', 'other'), true);
  assert.equal(matches(event('1', 'Digit1'), 'Shift+1', 'other'), false);
  assert.equal(matches(event('?', 'Slash', { shiftKey: true }), '?', 'mac'), true);
  assert.equal(matches(event('?', 'Comma', { shiftKey: true }), '?', 'other'), true);
  assert.equal(matches(event('?', 'Minus'), '?', 'other'), true);
  assert.equal(matches(event('/', 'Slash'), '?', 'other'), false);
  assert.equal(matches(event('?', 'Slash', { shiftKey: true, ctrlKey: true }), '?', 'other'), false);
  assert.equal(matches(event('≠', 'Equal', { altKey: true, metaKey: true }), 'Mod+Alt+=', 'mac'), true);
  assert.equal(matches(event('±', 'Equal', { altKey: true, shiftKey: true, metaKey: true }), 'Mod+Alt++', 'mac'), true);
});

test('Control falls back to Command on a Mac, and Meta to Ctrl elsewhere', () => {
  const ctrlZ = event('z', 'KeyZ', { ctrlKey: true });
  const metaZ = event('z', 'KeyZ', { metaKey: true });
  assert.equal(matches(ctrlZ, 'Mod+Z', 'mac'), false);
  assert.equal(matches(fallback(ctrlZ, 'mac'), 'Mod+Z', 'mac'), true);
  assert.equal(matches(metaZ, 'Mod+Z', 'other'), false);
  assert.equal(matches(fallback(metaZ, 'other'), 'Mod+Z', 'other'), true);
  assert.equal(fallback(metaZ, 'mac'), null);
  assert.equal(fallback(ctrlZ, 'other'), null);
  assert.equal(fallback(event('z', 'KeyZ', { ctrlKey: true, metaKey: true }), 'mac'), null);
  // the fallback keeps AltGraph, which is still refused
  assert.equal(matches(fallback(event('z', 'KeyZ', { metaKey: true }, true), 'other'), 'Mod+Z', 'other'), false);
});

test('displays platform shortcuts', () => {
  const cases = [
    ['Mod+Shift+Z', '⇧⌘Z', 'Ctrl+Shift+Z'],
    ['Mod+Y', '⌘Y', 'Ctrl+Y'],
    ['Alt+ArrowUp', '⌥↑', 'Alt+Up Arrow'],
    ['Mod+Shift+ArrowUp', '⇧⌘↑', 'Ctrl+Shift+Up Arrow'],
    ['Mod+-', '⌘−', 'Ctrl+-'],
    ['Mod+Space', '⌘Space', 'Ctrl+Spacebar'],
    ['Ctrl+Mod+G', '⌃⌘G', 'Ctrl+G'],
    ['Mod+Alt+Shift+G', '⌥⇧⌘G', 'Ctrl+Alt+Shift+G'],
    ['Mod+Enter', '⌘↩', 'Ctrl+Enter'],
    ['Shift+F6', '⇧F6', 'Shift+F6'],
    ['PageDown', '⇟', 'Page Down'],
    ['Escape', '⎋', 'Esc'],
    ['Shift+1', '⇧1', 'Shift+1'],
    ['?', '?', '?'],
    ['G', 'G', 'G'],
  ];
  for (const [value, mac, other] of cases) {
    assert.equal(display(value, 'mac'), mac, value);
    assert.equal(display(value, 'other'), other, value);
  }
});
