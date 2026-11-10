// the thumbnails of the navigator, drawn from cached clones of the slides at the width of the
// pane. each clone is put into a shadow root, so that the queries of the theme and of the editor
// over .reveal .slides do not find it, and the stylesheets of the deck are adopted by the root. a thumbnail is drawn when its row comes into view, and again 300 ms after the last change
// of its slide

import type { App } from '../app.ts';
import { isRuntimeClass } from '../render.ts';
import { layersOf, showLayer } from '../layers.ts';

// the rules of theme/beeson.css that are written on html or body do not reach into a shadow root,
// hence they are given here on the wrapper of the clone. every step of the slide is shown
const CSS = `
:host { display: block; position: relative; overflow: hidden; contain: strict; }
.reveal.beeson-thumb { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; overflow: hidden; background: var(--bg); pointer-events: none; }
.reveal.beeson-thumb .slides { position: absolute; inset: 0 auto auto 0; margin: 0; transform-origin: 0 0; pointer-events: none; }
.reveal.beeson-thumb .slides > section { display: block !important; position: absolute; inset: 0; transform: none !important; }
.reveal.beeson-thumb .fragment { visibility: visible !important; opacity: 1 !important; transition: none !important; }
.reveal.beeson-thumb .fragment.beeson-off { visibility: hidden !important; }
.reveal.beeson-thumb:not([data-theme="light"]) .for-light, .reveal.beeson-thumb[data-theme="light"] .for-dark { display: none !important; }
.reveal.beeson-thumb[data-theme="dark"] .invert { filter: invert(1) hue-rotate(180deg); }
.reveal.beeson-thumb[data-theme="light"] .slides section.title::before, .reveal.beeson-thumb[data-theme="light"] .slides section.closing::before { background-image: url("BRAND/lockup-light.png"); }
.reveal.beeson-thumb:not([data-theme="light"]) .slides section.split .panel { box-shadow: 1px 0 0 var(--line); }
.reveal.beeson-thumb.no-logo .slides section::after { content: none; }
.reveal.beeson-thumb.no-lockup .slides section.title::before, .reveal.beeson-thumb.no-lockup .slides section.closing::before { content: none; }
`;

const SVG = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';

// the stylesheets of the deck, i.e. its links and its style elements other than those of the
// editor, e.g. the styles of MathJax. each style element is one sheet shared by every root, and a
// relative url in it is read against the address of the deck
const sheets = new Map<string, CSSStyleSheet>();
const sheetOf = (text: string): CSSStyleSheet => {
  let sheet = sheets.get(text);
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(text);
    sheets.set(text, sheet);
  }
  return sheet;
};

// the folder brand/ beside theme/, read from the link of theme/beeson.css as the theme reads
// ../brand/, since a deck may be in another folder than the template, e.g. test/pages/
function brandUrl(links: HTMLLinkElement[]): string {
  const theme = links.find((l) => new URL(l.href, location.href).pathname.endsWith('/beeson.css'));
  return new URL('../brand', theme?.href ?? new URL('theme/beeson.css', location.href)).href;
}

// the sheet of a link of the deck built again from its rules, with its urls made absolute against
// the address of the link, since Chrome reads a built sheet against the page, so that a root is styled on the frame in which it is drawn. a link that is
// cloned into a root loads its sheet after that frame. null for a link whose rules cannot be read,
// e.g. over file:// or before the link is loaded
const built = new WeakMap<CSSStyleSheet, CSSStyleSheet>();
function linkSheet(link: HTMLLinkElement): CSSStyleSheet | null {
  const from = link.sheet;
  if (!from) return null;
  let sheet = built.get(from);
  if (!sheet) {
    try {
      sheet = new CSSStyleSheet({ media: link.media || '' });
      const text = [...from.cssRules].map((r) => r.cssText).join('\n');
      sheet.replaceSync(text.replace(/url\("([^"]*)"\)/g, (_, u: string) => `url("${new URL(u, link.href).href}")`));
    } catch {
      return null;
    }
    built.set(from, sheet);
  }
  return sheet;
}

// the sheets adopted by a root, and the links that are cloned into it since their sheets cannot be
// built again
function deckStyles(): { links: HTMLLinkElement[]; adopted: CSSStyleSheet[] } {
  const all = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')];
  const fromLinks = all.map((l) => linkSheet(l));
  const links = all.filter((_, i) => !fromLinks[i]);
  const styles = [...document.querySelectorAll('style')].filter((s) => !s.id.startsWith('beeson-edit-')).map((s) => sheetOf(s.textContent ?? ''));
  return { links, adopted: [...fromLinks.filter((x): x is CSSStyleSheet => !!x), ...styles, sheetOf(CSS.replaceAll('BRAND', brandUrl(all)))] };
}

// a clone of slide for its thumbnail, with every step shown, or the first layer of a slide whose
// elements are hidden at a step. its canvases are painted from the originals at the scale of the
// thumbnail. a tycho viewer is replaced by an empty box, since its clone would start a second
// renderer, and a video shows its poster
export function cloneSlide(slide: Element, scale: number): HTMLElement {
  const clone = slide.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('aside.notes').forEach((n) => n.remove());
  const from = slide.querySelectorAll('canvas');
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  clone.querySelectorAll('canvas').forEach((canvas, i) => {
    const source = from[i];
    const w = source.offsetWidth || parseFloat(source.style.width) || source.width;
    const h = source.offsetHeight || parseFloat(source.style.height) || source.height;
    canvas.width = Math.max(1, Math.round(w * scale * ratio));
    canvas.height = Math.max(1, Math.round(h * scale * ratio));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    try {
      if (source.width && source.height) canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
    } catch {
      // a WebGL canvas without a kept buffer is left blank
    }
  });
  // a label of a backdrop that is not drawn yet is not placed
  clone.querySelectorAll<HTMLElement>('.backdrop .lab').forEach((l) => {
    if (!l.style.left) l.remove();
  });
  clone.querySelectorAll('tycho-viewer').forEach((v) => {
    const box = document.createElement('div');
    box.className = v.className;
    box.setAttribute('style', v.getAttribute('style') ?? '');
    v.replaceWith(box);
  });
  clone.querySelectorAll('video').forEach((v) => {
    v.removeAttribute('autoplay');
    v.removeAttribute('data-autoplay');
    v.preload = 'none';
  });
  for (const el of [clone, ...clone.querySelectorAll('*')]) {
    for (const name of ['contenteditable', 'tabindex', 'hidden', 'aria-hidden', 'role']) el.removeAttribute(name);
    // the classes of the marks of a plot are set at run time too, and the theme paints the marks by them
    for (const c of [...el.classList]) if (isRuntimeClass(c) && !c.startsWith('plot-')) el.classList.remove(c);
  }
  const layers = layersOf(clone);
  showLayer(clone, layers.length > 1 ? layers[0] : null);
  clone.classList.add('present');
  clone.style.display = 'block';
  clone.style.top = '0';
  return clone;
}

// MathJax keeps its glyphs in one cache of the page, named by use elements, and a use element does
// not reach out of a shadow root. the glyphs that clone names are thus copied next to it
function glyphsOf(clone: Element): SVGSVGElement | null {
  const ids = new Set<string>();
  for (const use of clone.querySelectorAll('use')) {
    const href = use.getAttribute('href') ?? use.getAttributeNS(XLINK, 'href') ?? '';
    if (href.startsWith('#')) ids.add(href.slice(1));
  }
  const glyphs = [...ids].map((id) => document.getElementById(id)).filter((g): g is HTMLElement => !!g && !clone.contains(g));
  if (!glyphs.length) return null;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('style', 'display: none');
  const defs = document.createElementNS(SVG, 'defs');
  defs.append(...glyphs.map((g) => g.cloneNode(true)));
  svg.append(defs);
  return svg;
}

export type Size = { width: number; height: number };

// draws slide into the shadow root of host, scaled from the size of the deck to width, in CSS px
export function drawInto(host: HTMLElement, slide: Element, deck: Size, width: number): void {
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const { links, adopted } = deckStyles();
  root.adoptedStyleSheets = adopted;
  const have = [...root.querySelectorAll('link')].map((l) => l.href).join('\n');
  if (have !== links.map((l) => l.href).join('\n')) {
    root.querySelectorAll('link').forEach((l) => l.remove());
    root.prepend(...links.map((l) => l.cloneNode(true)));
  }
  const wrap = document.createElement('div');
  wrap.className = 'reveal beeson-thumb';
  const theme = document.documentElement.dataset.theme;
  if (theme) wrap.dataset.theme = theme;
  for (const c of ['no-logo', 'no-lockup']) wrap.classList.toggle(c, document.body.classList.contains(c));
  wrap.setAttribute('inert', '');
  const slides = document.createElement('div');
  slides.className = 'slides';
  slides.style.cssText = `width: ${deck.width}px; height: ${deck.height}px; transform: scale(${width / deck.width});`;
  const clone = cloneSlide(slide, width / deck.width);
  slides.append(clone);
  wrap.append(slides);
  const glyphs = glyphsOf(clone);
  if (glyphs) wrap.append(glyphs);
  root.querySelector('.beeson-thumb')?.remove();
  root.append(wrap);
}

// the attributes that reveal.js, the theme, and the editor set at run time, which a thumbnail does
// not show
const QUIET = new Set(['contenteditable', 'tabindex', 'aria-hidden', 'hidden', 'role', 'aria-label', 'data-appendix', 'data-visibility']);

// true for a change of the page that a thumbnail shows. a class set at run time is left out, and so
// is the style of a section, in which reveal.js sets its place
function seen(m: MutationRecord): boolean {
  if (m.type !== 'attributes') return true;
  const el = m.target as Element;
  const name = m.attributeName ?? '';
  if (name === 'class') {
    const kept = (v: string | null) => (v ?? '').split(/\s+/).filter((c) => c && !isRuntimeClass(c)).sort().join(' ');
    return kept(m.oldValue) !== kept(el.getAttribute('class'));
  }
  if (name === 'style') return el.localName !== 'section';
  return !QUIET.has(name);
}

export const DELAY = 300;
// the times a thumbnail waits DELAY for the formulas of its slide to be typeset, after which it is
// drawn as it is, e.g. on a deck whose MathJax does not load
const WAITS = 20;

// true while a formula of slide is in raw TeX on a deck with MathJax, which is its configuration
// until MathJax is loaded, i.e. not typeset yet. a code box, the notes, and the text being edited,
// whose TeX is shown while it has the focus, are passed over
function rawTex(slide: Element): boolean {
  if (!window.MathJax) return false;
  const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
  const active = document.activeElement;
  const editing = active && slide.contains(active) ? active : null;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!/\\[([]/.test(t.nodeValue ?? '')) continue;
    const up = t.parentElement;
    if (!up || up.closest('mjx-container, pre, code, script, style, textarea, aside.notes') || editing?.contains(up)) continue;
    return true;
  }
  return false;
}

// the thumbnails of the slides, each drawn into the host that the navigator gives for its slide. a
// host is drawn while it is in view and its slide is dirty, and the other dirty hosts are drawn one
// at a time while the page is idle
export class Thumbs {
  private readonly app: App;
  private readonly hosts = new Map<Element, HTMLElement>();
  private readonly dirty = new Set<Element>();
  private readonly timers = new Map<Element, number>();
  private readonly inView = new Set<HTMLElement>();
  // the times each slide has waited for its formulas to be typeset
  private readonly waits = new Map<Element, number>();
  private readonly seenBy: IntersectionObserver;
  private idle = 0;
  private width = 0;

  constructor(app: App, scroller: HTMLElement) {
    this.app = app;
    this.seenBy = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const host = e.target as HTMLElement;
          if (e.isIntersecting) this.inView.add(host);
          else this.inView.delete(host);
        }
        this.drawDue();
      },
      { root: scroller, rootMargin: '200px 0px' },
    );
    const watch = new MutationObserver((records) => {
      const slides = new Set<Element>();
      for (const m of records) {
        if (!seen(m)) continue;
        const node = m.target instanceof Element ? m.target : m.target.parentElement;
        const slide = node?.closest('.reveal .slides > section');
        if (slide) slides.add(slide);
      }
      for (const s of slides) this.soon(s);
    });
    watch.observe(app.slides(), { subtree: true, childList: true, characterData: true, attributes: true, attributeOldValue: true });
  }

  // the host of each slide, kept while its slide is on the page. a new host is drawn once seen
  setHosts(next: Map<Element, HTMLElement>): void {
    for (const [slide, host] of this.hosts) {
      if (next.get(slide) === host) continue;
      this.seenBy.unobserve(host);
      this.inView.delete(host);
      this.hosts.delete(slide);
    }
    for (const [slide, host] of next) {
      if (this.hosts.get(slide) === host) continue;
      this.hosts.set(slide, host);
      this.dirty.add(slide);
      this.seenBy.observe(host);
    }
    this.drawDue();
  }

  // the width of the thumbnails in CSS px, set after a resize of the pane
  setWidth(width: number): void {
    if (Math.abs(width - this.width) < 0.5) return;
    this.width = width;
    for (const s of this.hosts.keys()) this.dirty.add(s);
    this.drawDue();
  }

  // the slide is drawn again 300 ms after its last change
  soon(slide: Element): void {
    clearTimeout(this.timers.get(slide));
    this.timers.set(
      slide,
      window.setTimeout(() => {
        this.timers.delete(slide);
        this.dirty.add(slide);
        this.drawDue();
      }, DELAY),
    );
  }

  // every slide drawn again soon, e.g. after the mode of the slides was flipped
  all(): void {
    for (const s of this.hosts.keys()) this.soon(s);
  }

  private deck(): Size {
    const s = this.app.slides() as HTMLElement;
    return { width: s.offsetWidth || 1920, height: s.offsetHeight || 1080 };
  }

  private draw(slide: Element): void {
    const host = this.hosts.get(slide);
    this.dirty.delete(slide);
    if (!host || !this.width || !slide.isConnected) return;
    // the last picture is kept until the formulas of the slide are typeset, since the thumbnail
    // would show their TeX in the meantime
    const waited = this.waits.get(slide) ?? 0;
    if (waited < WAITS && rawTex(slide)) {
      this.waits.set(slide, waited + 1);
      this.soon(slide);
      return;
    }
    this.waits.delete(slide);
    drawInto(host, slide, this.deck(), this.width);
    host.dataset.drawn = String(Number(host.dataset.drawn ?? 0) + 1);
  }

  private drawDue(): void {
    if (!this.width) return;
    for (const [slide, host] of this.hosts) if (this.dirty.has(slide) && this.inView.has(host)) this.draw(slide);
    if (this.idle || ![...this.dirty].some((s) => this.hosts.has(s))) return;
    const later = (fn: () => void): number => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 200 }) : setTimeout(fn, 16));
    const step = () => {
      this.idle = 0;
      const next = [...this.hosts.keys()].find((s) => this.dirty.has(s));
      if (!next) return;
      this.draw(next);
      this.idle = later(step);
    };
    this.idle = later(step);
  }
}

// the thumbnails of the navigator, drawn again after a flip of the mode of the slides
export function install(app: App): void {
  const nav = app.nav as unknown as { list: HTMLElement; useThumbs(t: Thumbs): void };
  const thumbs = new Thumbs(app, nav.list);
  nav.useThumbs(thumbs);
  new MutationObserver(() => thumbs.all()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
