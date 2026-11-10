// the keys of the commands, without the DOM: the platform, the parse of a key string such as
// 'Mod+Shift+Z', the match of a key event, and the display of a key string per platform, e.g. ⇧⌘Z
// on a Mac and Ctrl+Shift+Z elsewhere. Mod is ⌘ on a Mac and Ctrl elsewhere, and app.platform is
// read from the browser or from the URL parameter edit-platform=mac or edit-platform=other

import type { App, Platform } from './app.ts';

export type { Platform };

// a key string of a command, e.g. 'Mod+Shift+Z', 'Alt+ArrowUp', or 'Shift+1'
export type KeyString = string;

// a key string parsed into its key and its modifiers, with Mod resolved for a platform
export type Chord = { key: string; shift: boolean; alt: boolean; ctrl: boolean; meta: boolean };

export function install(_app: App): void {
  // nothing yet
}
