import type { App, Platform } from './app.ts';

export type { Platform };
export type KeyString = string;
export type Chord = { key: string; shift: boolean; alt: boolean; ctrl: boolean; meta: boolean };

export function parseKey(value: KeyString, platform: Platform): Chord {
  const parts = value.split('+');
  const key = parts.pop() ?? '';
  const mods = new Set(parts);
  return {
    key: normalizeKey(key),
    shift: mods.has('Shift'),
    alt: mods.has('Alt'),
    ctrl: mods.has('Ctrl') || (mods.has('Mod') && platform === 'other'),
    meta: mods.has('Meta') || (mods.has('Mod') && platform === 'mac'),
  };
}

function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

export function matches(ev: KeyboardEvent, value: KeyString, platform: Platform): boolean {
  const chord = parseKey(value, platform);
  return normalizeKey(ev.key) === chord.key && ev.shiftKey === chord.shift && ev.altKey === chord.alt &&
    ev.ctrlKey === chord.ctrl && ev.metaKey === chord.meta && !ev.getModifierState('AltGraph');
}

export function display(value: KeyString, platform: Platform): string {
  if (platform !== 'mac') return value.replaceAll('Mod', 'Ctrl').replaceAll('Arrow', '');
  const symbols: Record<string, string> = { Mod: '⌘', Meta: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧' };
  const parts = value.split('+');
  const key = parts.pop() ?? '';
  const modifiers = ['Ctrl', 'Alt', 'Shift', 'Meta', 'Mod'].filter((part) => parts.includes(part));
  return [...modifiers.map((part) => symbols[part]), key.replace('Arrow', '')].join('');
}

export function install(_app: App): void {}
