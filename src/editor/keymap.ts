// the keys of the commands, as strings of modifiers and a key, e.g. 'Mod+Shift+Z', 'Alt+ArrowUp',
// 'Shift+1', '?', or 'F6'. Mod is Command on a Mac and Ctrl elsewhere. keymap.ts is pure, hence it
// is tested under node without a page. a letter is matched by its key, or by its code when the key
// is not ASCII, e.g. with Option held on a Mac or on a Cyrillic layout. a digit is matched
// by its key or its code. a symbol such as ? or > is typed with Shift on one layout and without it
// on another, hence the Shift of a symbol is not compared

import type { App, Platform } from './app.ts';

export type { Platform };
export type KeyString = string;
export type Chord = { key: string; shift: boolean; alt: boolean; ctrl: boolean; meta: boolean };

// the part of a KeyboardEvent read here, so that a plain object stands for one in the tests
export type KeyEvent = {
  key: string;
  code?: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  getModifierState?(name: string): boolean;
};

const MODIFIERS = ['Mod', 'Shift', 'Alt', 'Ctrl', 'Meta'];

const NAMED = new Set([
  'Enter', 'Escape', 'Tab', 'Backspace', 'Delete', 'Space', 'ContextMenu',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown',
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
]);

// the symbols of a US layout by code, unshifted and shifted, for a key typed with Option on a Mac,
// whose key is then another character
const SYMBOLS: Record<string, [string, string]> = {
  Minus: ['-', '_'], Equal: ['=', '+'], BracketLeft: ['[', '{'], BracketRight: [']', '}'],
  Backslash: ['\\', '|'], Semicolon: [';', ':'], Quote: ["'", '"'], Backquote: ['`', '~'],
  Comma: [',', '<'], Period: ['.', '>'], Slash: ['/', '?'],
};

const isLetter = (key: string) => /^[a-z]$/i.test(key);
const isDigit = (key: string) => /^[0-9]$/.test(key);
const isSymbol = (key: string) => key.length === 1 && !isLetter(key) && !isDigit(key);

export function parseKey(value: KeyString, platform: Platform): Chord {
  // the key + is written last, e.g. 'Mod++'
  const parts = value.endsWith('++') ? [...value.slice(0, -2).split('+'), '+'] : value.split('+');
  const raw = parts.pop() ?? '';
  for (const part of parts) if (!MODIFIERS.includes(part)) throw new Error(`the modifier ${part} of ${value} is not known`);
  const key = raw.length === 1 ? raw.toLowerCase() : raw;
  if (!key || (key.length > 1 && !NAMED.has(key))) throw new Error(`the key of ${value} is not known`);
  const mods = new Set(parts);
  return {
    key,
    shift: mods.has('Shift'),
    alt: mods.has('Alt'),
    ctrl: mods.has('Ctrl') || (mods.has('Mod') && platform === 'other'),
    meta: mods.has('Meta') || (mods.has('Mod') && platform === 'mac'),
  };
}

// AltGr is Ctrl+Alt on Windows and types a character on many layouts, hence a key of Windows and
// Linux is not allowed to hold both
export function allowed(value: KeyString, platform: Platform): boolean {
  const c = parseKey(value, platform);
  return platform === 'mac' || !(c.ctrl && c.alt);
}

function keyMatches(ev: KeyEvent, chord: Chord, platform: Platform): boolean {
  const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  const code = ev.code ?? '';
  if (isLetter(chord.key)) {
    // a dead key, an unidentified key, or a character beyond ASCII is matched by its code
    const ascii = key.length === 1 && key.charCodeAt(0) < 128;
    return ascii ? key === chord.key : code === `Key${chord.key.toUpperCase()}`;
  }
  if (isDigit(chord.key)) return key === chord.key || code === `Digit${chord.key}`;
  if (isSymbol(chord.key)) {
    if (key === chord.key) return true;
    const typed = platform === 'mac' && ev.altKey ? SYMBOLS[code] : undefined;
    return !!typed && typed[ev.shiftKey ? 1 : 0] === chord.key;
  }
  if (chord.key === 'Space') return ev.key === ' ';
  return ev.key === chord.key;
}

// AltGraph is checked only on Windows and Linux, since Firefox on a Mac may report Option as
// AltGraph, and a Mac does not have an AltGr key
export function matches(ev: KeyEvent, value: KeyString, platform: Platform): boolean {
  if (platform === 'other' && ev.getModifierState?.('AltGraph')) return false;
  const chord = parseKey(value, platform);
  if (!keyMatches(ev, chord, platform)) return false;
  if (!isSymbol(chord.key) && ev.shiftKey !== chord.shift) return false;
  return ev.altKey === chord.alt && ev.ctrlKey === chord.ctrl && ev.metaKey === chord.meta;
}

// the event as it is matched when no key takes it as pressed. on a Mac, Control with a key is
// taken as Command with it, and elsewhere Meta is taken as Ctrl, so that Meta+Z undoes on every
// platform
export function fallback(ev: KeyEvent, platform: Platform): KeyEvent | null {
  const get = (name: string) => ev.getModifierState?.(name) ?? false;
  const base = { key: ev.key, code: ev.code, shiftKey: ev.shiftKey, altKey: ev.altKey, getModifierState: get };
  if (platform === 'mac' && ev.ctrlKey && !ev.metaKey) return { ...base, ctrlKey: false, metaKey: true };
  if (platform === 'other' && ev.metaKey && !ev.ctrlKey) return { ...base, ctrlKey: true, metaKey: false };
  return null;
}

const MAC_KEYS: Record<string, string> = {
  Enter: '↩', Escape: '⎋', Tab: '⇥', Backspace: '⌫', Delete: '⌦', Space: 'Space', ContextMenu: 'Menu',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Home: '↖', End: '↘', PageUp: '⇞', PageDown: '⇟',
};

const OTHER_KEYS: Record<string, string> = {
  Escape: 'Esc', ContextMenu: 'Menu', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', PageUp: 'Page Up', PageDown: 'Page Down',
};

// a key as a menu shows it. on a Mac, the modifiers are written as symbols in the order Control,
// Option, Shift, and Command, and elsewhere as words joined by a plus, e.g. Ctrl+Shift+Z
export function display(value: KeyString, platform: Platform): string {
  const c = parseKey(value, platform);
  const key = c.key.length === 1 ? c.key.toUpperCase() : c.key;
  if (platform === 'mac') {
    const mods = (c.ctrl ? '⌃' : '') + (c.alt ? '⌥' : '') + (c.shift ? '⇧' : '') + (c.meta ? '⌘' : '');
    return mods + (MAC_KEYS[key] ?? key);
  }
  const mods = [c.ctrl && 'Ctrl', c.meta && 'Meta', c.alt && 'Alt', c.shift && 'Shift'].filter(Boolean);
  return [...mods, OTHER_KEYS[key] ?? key].join('+');
}

export function install(_app: App): void {}
