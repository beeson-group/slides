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
  const doc = document as Document & { startViewTransition?: (update: () => void) => { ready: Promise<void>; finished: Promise<void> } };
  if (!doc.startViewTransition || Orbits.reduced()) { apply(theme); return; }
  const b = button?.getBoundingClientRect();
  const x = at?.x ?? (b ? b.left + b.width / 2 : innerWidth), y = at?.y ?? (b ? b.top + b.height / 2 : 0);
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const toLight = theme === 'light';
  // on a flip to dark, the old light view is put on top and shrunk onto the point
  root.classList.toggle('to-dark', !toLight);
  const tr = doc.startViewTransition(() => apply(theme));
  tr.ready.then(() => {
    const clip = [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`];
    root.animate(
      { clipPath: toLight ? clip : [...clip].reverse() },
      { duration: 400, easing: 'ease-out', pseudoElement: toLight ? '::view-transition-new(root)' : '::view-transition-old(root)' },
    );
  }).catch(() => {});
  tr.finished.finally(() => root.classList.remove('to-dark')).catch(() => {});
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

// the stacking of the two views during the flip, which is required for the clip animation
const VIEW_TRANSITION_CSS = `
::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
::view-transition-old(root) { z-index: 1; }
::view-transition-new(root) { z-index: 9999; }
html.to-dark::view-transition-old(root) { z-index: 9999; }
html.to-dark::view-transition-new(root) { z-index: 1; }
`;

export function initSwitcher(): void {
  if (!document.querySelector('style[data-beeson="view-transition"]')) {
    const style = document.createElement('style');
    style.dataset.beeson = 'view-transition';
    style.textContent = VIEW_TRANSITION_CSS;
    document.head.append(style);
  }
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
