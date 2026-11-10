// helpers that build the elements of the editor, and injectStyle, with which each module adds its
// stylesheet. a stylesheet takes its colors from the custom properties of theme/beeson.css, with a
// fallback for a deck on another theme

export function make<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

export function button(text: string, title = '', label = ''): HTMLButtonElement {
  const el = make('button', '', text);
  el.title = title;
  if (label) el.setAttribute('aria-label', label);
  return el;
}

// injectStyle adds css once to the head, as style#beeson-edit-<id>. the stylesheets are thus in the
// order in which main.ts installs the modules, and a rule that overrides a rule of another module
// must have a higher specificity
export function injectStyle(id: string, css: string): HTMLStyleElement {
  const key = `beeson-edit-${id}`;
  const found = document.getElementById(key);
  if (found instanceof HTMLStyleElement) return found;
  const style = make('style');
  style.id = key;
  style.textContent = css;
  document.head.append(style);
  return style;
}

// the storage of the browser may be blocked or full, and nothing is then kept
export function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function store(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // nothing is kept
  }
}

// a pointer click leaves the focus on the slide, and Enter or Space on a focused button keeps it.
// the action is run after the click, and its error is passed to fail
export function wire(el: HTMLButtonElement, action: () => unknown, fail: (e: unknown) => void): void {
  el.addEventListener('click', (ev) => {
    if (ev.detail > 0) el.blur();
    Promise.resolve().then(action).catch(fail);
  });
}
