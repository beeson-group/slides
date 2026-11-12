// the show in place, as the slide show of Keynote and PowerPoint: Present plays the saved deck over
// the whole screen. the deck is loaded without edit into a frame over the window of the editor, and
// full screen is asked for on the stage of the frame while the key or click of Present still
// counts, as the Fullscreen API asks. where the browser refuses it, the show fills the window.
// reveal.js in the frame posts its events to the editor, also on file:, where the frame is of
// another origin, and the deck posts Esc, E, F, and S (from-editor in src/main.ts).
// the show ends at Esc and E, at a load of another page in the frame, and when it leaves full
// screen otherwise than at F or S, e.g. at an Esc that the browser keeps from the page. the editor
// is then at the slide shown last

import type { App } from './app.ts';
import { injectStyle, make } from './ui/dom.ts';

const CSS = `
.beeson-edit-show { position: fixed; inset: 0; z-index: 2147483647; background: #000; }
.beeson-edit-show iframe { display: block; width: 100%; height: 100%; border: 0; }
`;

type At = { h: number; v: number };
type Prefixed = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type Requestable = HTMLElement & { webkitRequestFullscreen?: () => void };

const hidden = (s: Element | null) => s?.getAttribute('data-visibility') === 'hidden';
const sections = (parent: Element) => [...parent.children].filter((s) => s.localName === 'section' && !hidden(s));

// the indices of slide in the show, where reveal.js removes the hidden slides that the editor
// keeps. a hidden slide is shown from the next shown slide, or from the last one
export function showIndices(app: App, slide: Element | null): At {
  const leaves = [...app.slides().querySelectorAll<Element>('section')].filter((s) => !s.querySelector('section'));
  const shown = leaves.filter((s) => !hidden(s) && !hidden(s.parentElement));
  const at = slide ? leaves.indexOf(slide) : 0;
  const to = shown.find((s) => leaves.indexOf(s) >= at) ?? shown.at(-1);
  if (!to) return { h: 0, v: 0 };
  const top = to.parentElement?.localName === 'section' ? to.parentElement : to;
  return { h: Math.max(0, sections(app.slides()).indexOf(top)), v: top === to ? 0 : Math.max(0, sections(top).indexOf(to)) };
}

// the slide of the editor at the indices of the show
export function slideAt(app: App, { h, v }: At): Element | null {
  const top = sections(app.slides())[h];
  if (!top) return null;
  const inner = sections(top);
  return inner.length ? (inner[v] ?? inner[0]) : top;
}

const fullscreen = () => (document as Prefixed).fullscreenElement ?? (document as Prefixed).webkitFullscreenElement ?? null;

export type Stage = { load(url: string): Window | null; end(): void };

// startShow puts the stage over the window and asks for full screen on it at once. the deck is
// loaded into it by load, and end takes it away
export function startShow(app: App): Stage {
  injectStyle('show', CSS);
  const el = make('div', 'beeson-edit-show') as Requestable;
  const frame = make('iframe');
  frame.title = 'Slide show';
  frame.setAttribute('allow', 'autoplay; fullscreen');
  el.append(frame);
  document.body.append(el);
  let at: At | null = null;
  let loads = 0;
  let full = false;
  // the time until which the show goes on out of full screen, set at F and at the speaker view of S,
  // which the browser opens out of full screen
  let keep = 0;

  const ours = () => !!fullscreen() && el.contains(fullscreen());
  const enter = () => {
    try {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else el.webkitRequestFullscreen?.();
    } catch {
      // the show fills the window
    }
  };
  const leave = () => {
    const d = document as Prefixed;
    if (d.exitFullscreen) d.exitFullscreen().catch(() => {});
    else d.webkitExitFullscreen?.();
  };
  const end = () => {
    if (!el.isConnected) return;
    window.removeEventListener('message', onMessage);
    window.removeEventListener('keydown', onKey, true);
    for (const type of ['fullscreenchange', 'webkitfullscreenchange']) document.removeEventListener(type, onChange);
    if (ours()) leave();
    el.remove();
    const slide = at && slideAt(app, at);
    if (slide) app.showSlide(slide);
    window.focus();
  };
  const onMessage = (ev: MessageEvent) => {
    if (ev.source !== frame.contentWindow || typeof ev.data !== 'string') return;
    let m: { namespace?: string; eventName?: string; state?: { indexh?: number; indexv?: number } };
    try {
      m = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (m?.namespace !== 'reveal' && m?.namespace !== 'beeson') return;
    if (typeof m.state?.indexh === 'number') at = { h: m.state.indexh, v: m.state.indexv ?? 0 };
    if (m.namespace !== 'beeson') return;
    if (m.eventName === 'edit') end();
    else if (m.eventName === 'speaker') keep = performance.now() + 2000;
    // the key in the frame lets the editor ask for full screen, in Chrome and Firefox
    else if (m.eventName === 'fullscreen' && !ours()) enter();
    else if (m.eventName === 'fullscreen') {
      keep = performance.now() + 1000;
      leave();
    }
  };
  // a show that leaves full screen while the window keeps the focus ends, unless F or S was pressed.
  // the frame posts them before the change, which is waited for a moment
  const onChange = () => {
    if (ours()) full = true;
    else if (full) setTimeout(() => {
      if (!ours() && performance.now() > keep && document.hasFocus()) end();
    }, 100);
  };
  // a key that reaches the editor while the show is up, e.g. after a click outside the frame
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') end();
    ev.preventDefault();
    ev.stopPropagation();
  };
  frame.addEventListener('load', () => {
    if (!frame.getAttribute('src')) return;
    if (++loads > 1) return end();
    frame.contentWindow?.focus();
  });
  window.addEventListener('message', onMessage);
  window.addEventListener('keydown', onKey, true);
  for (const type of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(type, onChange);
  enter();

  return {
    load(url: string) {
      if (!el.isConnected) return null;
      const u = new URL(url, location.href);
      u.searchParams.set('from-editor', '');
      frame.src = u.href.replace(/=(?=&|$|#)/g, '');
      frame.focus();
      return frame.contentWindow;
    },
    end,
  };
}
