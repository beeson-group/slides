// the menus of the editor, built of DOM elements, since the popup of a native select is not seen
// in a screenshot of the Chrome DevTools protocol: the menus of the menu bar with their submenus,
// the context menus, the split buttons of the toolbar, and a select of the chrome

import type { App } from '../app.ts';

// an item of a menu: a command of the registry by its id, a submenu, or a rule between groups
export type MenuItem = { command: string; arg?: unknown } | { label: string; items: MenuItem[] } | { rule: true };

export function install(_app: App): void {
  // nothing yet
}
