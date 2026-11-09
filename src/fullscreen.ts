// full screen on and off with the key F, which hides the tabs and the address bar of the browser.
// a window that fills the screen with the toolbar still shown, e.g. a Safari window made full
// screen with the green button of macOS, is taken into full screen at the next key or click, since
// a page may enter full screen only in the handler of a key or a click

type Prefixed = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type Requestable = HTMLElement & { webkitRequestFullscreen?: () => void };

const prefixed = document as Prefixed;

export const isFullscreen = (): boolean => !!(prefixed.fullscreenElement ?? prefixed.webkitFullscreenElement);

function enter(): void {
  const root = document.documentElement as Requestable;
  if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
  else root.webkitRequestFullscreen?.();
}

export function toggleFullscreen(): void {
  if (!isFullscreen()) enter();
  else if (prefixed.exitFullscreen) prefixed.exitFullscreen().catch(() => {});
  else prefixed.webkitExitFullscreen?.();
}

// windowFull is true when the window covers the screen to the pixel while the page does not, i.e.
// the toolbar of the browser is shown. a maximized window on Windows is wider than the screen by
// its frame, and it is not taken for a full-screen one
export function windowFull(w: Window = window): boolean {
  const near = (a: number, b: number) => Math.abs(a - b) <= 1;
  return near(w.outerWidth, w.screen.width) && near(w.outerHeight, w.screen.height) && w.innerHeight < w.screen.height - 1;
}

// once the page leaves full screen, e.g. with Esc, the window is not taken into full screen again
// until it has left the full screen of the system. Esc and a held key do not count as the key
export function initFullscreen(): void {
  let armed = false;
  let left = false;
  const check = () => {
    if (!windowFull()) { armed = false; left = false; }
    else if (!isFullscreen() && !left) armed = true;
  };
  const changed = () => {
    armed = false;
    if (!isFullscreen()) left = true;
  };
  const take = (ev: Event) => {
    if (!armed || isFullscreen() || (ev instanceof KeyboardEvent && (ev.key === 'Escape' || ev.repeat))) return;
    armed = false;
    enter();
  };
  window.addEventListener('resize', check);
  document.addEventListener('fullscreenchange', changed);
  document.addEventListener('webkitfullscreenchange', changed);
  document.addEventListener('keydown', take, true);
  document.addEventListener('pointerdown', take, true);
  check();
}
