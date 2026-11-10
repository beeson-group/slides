// the commands that move between the slides. today these are the previous and the next slide,
// run by the buttons of the status bar, while reveal.js takes the keys

import type { App } from '../app.ts';

export function install(app: App): void {
  const c = app.commands;
  c.define({ id: 'navigate.previous', label: 'Previous Slide', run: (a) => a.deck()?.left() });
  c.define({ id: 'navigate.next', label: 'Next Slide', run: (a) => a.deck()?.right() });
}
