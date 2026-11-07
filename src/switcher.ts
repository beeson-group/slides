// the dark and light modes, kept on the dataset of the root element and flipped with the key d or
// the button .theme-switch. the flip is a circle grown from the click point (the transition of
// antfu.me)

import { Orbits } from './orbits.ts';

export type Theme = 'dark' | 'light';

const KEY = 'beeson-theme';
const root = document.documentElement;
// a theme given in the URL is not stored, so that the default is not changed when a link with
// ?theme= is opened
let pinned = false;
let button: HTMLButtonElement | null = null;
let flip: unknown = null;

const isTheme = (v: unknown): v is Theme => v === 'dark' || v === 'light';

export function get(): Theme {
  return root.dataset.theme === 'light' ? 'light' : 'dark';
}

function apply(theme: Theme): void {
  root.dataset.theme = theme;
  if (button) button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  // the event is dispatched inside the update of the view transition, thus the canvases redrawn
  // in its listeners are captured in the new view
  document.dispatchEvent(new CustomEvent('beeson:theme', { detail: { theme } }));
}

function store(theme: Theme): void {
  if (pinned) return;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // storage is blocked in some private windows
  }
}

// sets the theme, flipping from the client point at, or from the center of the button
export function set(theme: Theme, at?: { x: number; y: number }): void {
  if (!isTheme(theme) || theme === get()) return;
  store(theme);
  const doc = document as Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } };
  if (!doc.startViewTransition || Orbits.reduced()) { apply(theme); return; }
  const b = button?.getBoundingClientRect();
  const x = at?.x ?? (b ? b.left + b.width / 2 : innerWidth), y = at?.y ?? (b ? b.top + b.height / 2 : 0);
  // the flip itself is the animation of the views in theme/beeson.css, set off with these classes
  root.style.setProperty('--flip-x', `${x}px`);
  root.style.setProperty('--flip-y', `${y}px`);
  root.style.setProperty('--flip-r', `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
  root.classList.toggle('to-dark', theme === 'dark');
  root.classList.toggle('to-light', theme === 'light');
  const tr = doc.startViewTransition(() => apply(theme));
  flip = tr;
  // a flip started during this one ends it early, and its classes are then left in place
  tr.finished.finally(() => { if (flip === tr) root.classList.remove('to-dark', 'to-light'); }).catch(() => {});
}

export function toggle(at?: { x: number; y: number }): void {
  set(get() === 'dark' ? 'light' : 'dark', at);
}

// the theme at load: the URL parameter theme, then the stored choice, then dark
export function initTheme(): void {
  const asked = new URLSearchParams(location.search).get('theme');
  let theme: Theme = 'dark';
  if (isTheme(asked)) { theme = asked; pinned = true; }
  else {
    try {
      const saved = localStorage.getItem(KEY);
      if (isTheme(saved)) theme = saved;
    } catch {
      // as in store()
    }
  }
  root.dataset.theme = theme;
}

export function initSwitcher(): void {
  const deck = document.querySelector('.reveal');
  if (!deck || button) return;
  button = document.createElement('button');
  button.className = 'theme-switch';
  button.type = 'button';
  button.setAttribute('aria-label', get() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  button.addEventListener('click', (ev) => {
    // the click point is not defined for a keyboard click, hence the flip is started from the
    // button
    toggle(ev.detail > 0 ? { x: ev.clientX, y: ev.clientY } : undefined);
    // while the button is in focus, the space bar is not available to the slide navigation
    button?.blur();
  });
  deck.append(button);
}

// whether a key press is for the deck, rather than for a field or for a viewer
export function forDeck(ev: KeyboardEvent): boolean {
  if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) return false;
  const target = (ev.target instanceof Element ? ev.target : null) ?? document.activeElement;
  return !target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], tycho-viewer');
}
