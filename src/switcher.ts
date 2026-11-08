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
// the removal of the names and the layers set for the last flip in ghosts(), or null
let undo: (() => void) | null = null;

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

// the old view of a flip is a still, shown in the circle on a flip to dark and around it on a flip
// to light, hence a traced backdrop would be held still there for up to 450 ms. while a backdrop is
// traced, the deck is captured in a view of its own, flip-deck, without the canvases of the
// backdrop. in the update of the flip, copies of these canvases are made in the layer flip-ghost
// under the deck, and the trace is continued there in the old colors. the layer is shown only where
// the old view of the deck is, with the masks of theme/beeson.css
function ghosts(x: number, y: number): { lift: () => void; undo: () => void } | null {
  const deck = document.querySelector<HTMLElement>('.reveal');
  const live = [...document.querySelectorAll<HTMLElement>('.backdrop')].map((el) => Orbits.of(el)).filter((o) => o?.tracing) as Orbits[];
  if (!deck || !live.length || !CSS.supports('view-transition-class', 'a') || !CSS.supports('selector(:active-view-transition)')) return null;
  const box = deck.getBoundingClientRect();
  root.style.setProperty('--flip-deck-x', `${x - box.left}px`);
  root.style.setProperty('--flip-deck-y', `${y - box.top}px`);
  deck.style.setProperty('view-transition-name', 'flip-deck');
  // a canvas with a name is captured apart from the deck, and its old view is not shown
  const canvases = live.flatMap((o) => o.canvases);
  canvases.forEach((c, k) => {
    c.style.setProperty('view-transition-name', `flip-art-${k}`);
    c.style.setProperty('view-transition-class', 'flip-art');
  });
  const unname = () => {
    for (const c of canvases) { c.style.removeProperty('view-transition-name'); c.style.removeProperty('view-transition-class'); }
  };
  const layer = document.createElement('div');
  layer.className = 'flip-ghost';
  Object.assign(layer.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
  return {
    // called in the update of the view transition before the next mode is applied, hence the
    // canvases are redrawn after it in the new view of the deck
    lift() {
      for (const o of live) o.ghost(layer, box);
      document.body.append(layer);
      unname();
    },
    undo() {
      unname();
      deck.style.removeProperty('view-transition-name');
      for (const o of live) o.unghost();
      layer.remove();
    },
  };
}

// sets the theme, flipping from the client point at, or from the center of the button
export function set(theme: Theme, at?: { x: number; y: number }): void {
  if (!isTheme(theme) || theme === get()) return;
  store(theme);
  const doc = document as Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } };
  if (!doc.startViewTransition || Orbits.reduced()) { apply(theme); return; }
  undo?.();
  undo = null;
  const b = button?.getBoundingClientRect();
  const x = at?.x ?? (b ? b.left + b.width / 2 : innerWidth), y = at?.y ?? (b ? b.top + b.height / 2 : 0);
  // the flip itself is the animation of the views in theme/beeson.css, set off with these classes
  root.style.setProperty('--flip-x', `${x}px`);
  root.style.setProperty('--flip-y', `${y}px`);
  root.style.setProperty('--flip-r', `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
  root.classList.toggle('to-dark', theme === 'dark');
  root.classList.toggle('to-light', theme === 'light');
  const layers = ghosts(x, y);
  undo = layers?.undo ?? null;
  const tr = doc.startViewTransition(() => { layers?.lift(); apply(theme); });
  flip = tr;
  // when a flip is started during this one, this one is ended early, and its classes and layers
  // are taken down at the start of the later flip
  tr.finished.finally(() => {
    if (flip !== tr) return;
    root.classList.remove('to-dark', 'to-light');
    undo?.();
    undo = null;
  }).catch(() => {});
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
