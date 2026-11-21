import type { App } from '../app.ts';
import { isRuntimeClass } from '../render.ts';
import { rangesOf, showRange } from '../shown-steps.ts';
import { whenLoaded } from '../../viewers.ts';

const CSS = `
:host { display: block; position: relative; overflow: hidden; contain: strict; }
.reveal.beeson-thumb { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; overflow: hidden; background: var(--bg); pointer-events: none; }
.reveal.beeson-thumb .slides { position: absolute; inset: 0 auto auto 0; margin: 0; transform-origin: 0 0; pointer-events: none; }
.reveal.beeson-thumb .slides > section { display: block !important; position: absolute; inset: 0; transform: none !important; }
.reveal.beeson-thumb :is(.fragment, .r-stack > *) { visibility: visible !important; opacity: 1 !important; transition: none !important; }
.reveal.beeson-thumb :is(.fragment, .r-stack > *).beeson-off { visibility: hidden !important; }
.reveal.beeson-thumb:not([data-theme="light"]) .for-light, .reveal.beeson-thumb[data-theme="light"] .for-dark { display: none !important; }
.reveal.beeson-thumb[data-theme="dark"] .invert { filter: invert(1) hue-rotate(180deg); }
.reveal.beeson-thumb[data-theme="light"] .slides section.title::before, .reveal.beeson-thumb[data-theme="light"] .slides section.closing::before { background-image: url("BRAND/lockup-light.png"); }
.reveal.beeson-thumb:not([data-theme="light"]) .slides section.split .text-column { box-shadow: 1px 0 0 var(--line); }
.reveal.beeson-thumb.no-logo .slides section::after { content: none; }
.reveal.beeson-thumb.no-lockup .slides section.title::before, .reveal.beeson-thumb.no-lockup .slides section.closing::before { content: none; }
`;

const SVG = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';

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

function brandUrl(links: HTMLLinkElement[]): string {
  const theme = links.find((l) => new URL(l.href, location.href).pathname.endsWith('/beeson.css'));
  return new URL('../brand', theme?.href ?? new URL('theme/beeson.css', location.href)).href;
}

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

function deckStyles(): { links: HTMLLinkElement[]; adopted: CSSStyleSheet[] } {
  const all = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')];
  const fromLinks = all.map((l) => linkSheet(l));
  const links = all.filter((_, i) => !fromLinks[i]);
  const styles = [...document.querySelectorAll('style')].filter((s) => !s.id.startsWith('beeson-edit-')).map((s) => sheetOf(s.textContent ?? ''));
  return { links, adopted: [...fromLinks.filter((x): x is CSSStyleSheet => !!x), ...styles, sheetOf(CSS.replaceAll('BRAND', brandUrl(all)))] };
}

export function laidOut<T>(slide: HTMLElement, measure: () => T): T {
  const style = slide.getAttribute('style');
  const hidden = slide.hidden;
  const present = slide.classList.contains('present');
  slide.hidden = false;
  slide.style.display = 'block';
  if (!present) {
    slide.style.visibility = 'hidden';
    slide.classList.add('present');
  }
  try {
    return measure();
  } finally {
    if (!present) slide.classList.remove('present');
    if (style === null) slide.removeAttribute('style');
    else slide.setAttribute('style', style);
    slide.hidden = hidden;
  }
}

type Viewer = HTMLElement & {
  renderer: object | null;
  canvas: HTMLCanvasElement | null;
  paintCanvas?: HTMLCanvasElement | null;
  panelAreaSize?: { w: number; h: number };
  measurePanelArea?(): void;
  draw(ratio?: number): void;
  store?: { readonly playing?: boolean; subscribe?(listener: (change: string) => void): unknown } | null;
};

function stillBox(viewer: Viewer, scale: number, ratio: number): HTMLElement {
  const box = document.createElement('div');
  box.className = viewer.className;
  box.classList.add('viewer-still');
  box.setAttribute('style', viewer.getAttribute('style') ?? '');
  const position = getComputedStyle(viewer).position;
  box.style.position = position === 'static' ? 'relative' : position;
  if (!viewer.offsetWidth) return box;
  box.style.width = `${viewer.offsetWidth}px`;
  box.style.height = `${viewer.offsetHeight}px`;
  const { canvas, paintCanvas } = viewer;
  if (!viewer.renderer || !canvas) return box;
  const host = viewer.getBoundingClientRect();
  const k = host.width / viewer.offsetWidth;
  const r = canvas.getBoundingClientRect();
  const [w, h] = [r.width / k, r.height / k];
  if (w < 1 || h < 1) return box;
  const still = document.createElement('canvas');
  still.width = Math.max(1, Math.round(w * scale * ratio));
  still.height = Math.max(1, Math.round(h * scale * ratio));
  still.style.cssText = `position: absolute; left: ${(r.left - host.left) / k}px; top: ${(r.top - host.top) / k}px; width: ${w}px; height: ${h}px`;
  const size = viewer.panelAreaSize;
  try {
    if (size && size.w >= 1 && size.h >= 1) viewer.draw();
    else {
      viewer.measurePanelArea?.();
      const area = viewer.panelAreaSize?.w ?? 0;
      if (area < 1) return box;
      viewer.draw(Math.min(ratio, (2 * still.width) / area));
    }
    shrinkByHalves(still, [canvas, paintCanvas].filter((c): c is HTMLCanvasElement => !!c?.width && !!c.height));
    box.append(still);
  } catch {} finally {
    if (size) viewer.panelAreaSize = size;
  }
  return box;
}

function shrinkByHalves(still: HTMLCanvasElement, layers: HTMLCanvasElement[]): void {
  let from = layers;
  while (from.length) {
    const { width: w, height: h } = from[0];
    const last = w <= 2 * still.width || h <= 2 * still.height;
    const to = last ? still : document.createElement('canvas');
    if (!last) [to.width, to.height] = [Math.ceil(w / 2), Math.ceil(h / 2)];
    const pen = to.getContext('2d');
    if (!pen) return;
    pen.imageSmoothingQuality = 'high';
    for (const c of from) pen.drawImage(c, 0, 0, to.width, to.height);
    if (last) return;
    from = [to];
  }
}

export function stillViewers(slide: Element, clone: Element, scale: number): void {
  const viewers = [...slide.querySelectorAll<Viewer>('tycho-viewer')];
  if (!viewers.length) return;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const boxes = () => viewers.map((v) => stillBox(v, scale, ratio));
  const hidden = viewers.some((v) => v.renderer && !v.offsetWidth) && slide instanceof HTMLElement;
  const made = hidden ? laidOut(slide, boxes) : boxes();
  clone.querySelectorAll('tycho-viewer').forEach((v, i) => v.replaceWith(made[i]));
}

export function drawBackdrops(slide: Element, clone: Element): void {
  const preview = (window as unknown as { Beeson?: { preview?(el: HTMLElement): unknown } }).Beeson?.preview;
  const from = slide.querySelectorAll('.backdrop');
  clone.querySelectorAll<HTMLElement>('.backdrop').forEach((el, i) => {
    const canvas = from[i]?.querySelector(':scope > canvas.orbits-base');
    if (preview && canvas && !canvas.hasAttribute('width')) preview(el);
  });
  clone.querySelectorAll<HTMLElement>('.backdrop .label').forEach((l) => {
    if (!l.style.left) l.remove();
  });
}

function drawSurfaces(slide: Element): void {
  const all = (window as unknown as { Beeson?: { surfaces?: { el: HTMLElement; fit(): void }[] } }).Beeson?.surfaces ?? [];
  const due = all.filter((s) => slide.contains(s.el) && !s.el.querySelector(':scope > canvas.surface-image')?.hasAttribute('width'));
  if (due.length && slide instanceof HTMLElement) laidOut(slide, () => due.forEach((s) => s.fit()));
}

export function cloneSlide(slide: Element, scale: number): HTMLElement {
  drawSurfaces(slide);
  const clone = slide.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('aside.notes').forEach((n) => n.remove());
  const from = [...slide.querySelectorAll('canvas')];
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const size = () => from.map((c) => [c.offsetWidth, c.offsetHeight]);
  let sizes = size();
  if (sizes.some(([w]) => !w) && slide instanceof HTMLElement) sizes = laidOut(slide, size);
  clone.querySelectorAll('canvas').forEach((canvas, i) => {
    const source = from[i];
    const w = sizes[i][0] || parseFloat(source.style.width) || source.width;
    const h = sizes[i][1] || parseFloat(source.style.height) || source.height;
    canvas.width = Math.max(1, Math.round(w * scale * ratio));
    canvas.height = Math.max(1, Math.round(h * scale * ratio));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    try {
      if (source.width && source.height) canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
    } catch {}
  });
  stillViewers(slide, clone, scale);
  clone.querySelectorAll('video').forEach((v) => {
    v.removeAttribute('autoplay');
    v.removeAttribute('data-autoplay');
    v.preload = 'none';
  });
  for (const el of [clone, ...clone.querySelectorAll('*')]) {
    for (const name of ['contenteditable', 'tabindex', 'hidden', 'aria-hidden', 'role']) el.removeAttribute(name);
    for (const c of [...el.classList]) if (isRuntimeClass(c) && !c.startsWith('plot-')) el.classList.remove(c);
  }
  if (window.MathJax) hideTex(clone);
  const ranges = rangesOf(clone);
  showRange(clone, ranges.length > 1 ? ranges[0] : null);
  clone.classList.add('present');
  clone.style.display = 'block';
  clone.style.top = '0';
  return clone;
}

const TEX = /\\\((?:[\s\S]*?\\\)|[\s\S]*$)|\\\[(?:[\s\S]*?\\\]|[\s\S]*$)/g;
function hideTex(clone: Element): void {
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  const raw: Text[] = [];
  for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) {
    if (/\\[([]/.test(t.data) && !t.parentElement?.closest('mjx-container, pre, code, script, style, textarea')) raw.push(t);
  }
  for (const t of raw) {
    const parts = document.createDocumentFragment();
    let at = 0;
    for (const m of t.data.matchAll(TEX)) {
      parts.append(t.data.slice(at, m.index));
      const hidden = document.createElement('span');
      hidden.style.visibility = 'hidden';
      hidden.textContent = m[0];
      parts.append(hidden);
      at = m.index + m[0].length;
    }
    parts.append(t.data.slice(at));
    t.replaceWith(parts);
  }
}

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

const settled = new WeakSet<HTMLLinkElement>();

export function drawInto(host: HTMLElement, slide: Element, deck: Size, width: number): void {
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const { links, adopted } = deckStyles();
  root.adoptedStyleSheets = adopted;
  const have = [...root.querySelectorAll('link')].map((l) => l.href).join('\n');
  if (have !== links.map((l) => l.href).join('\n')) {
    root.querySelectorAll('link').forEach((l) => l.remove());
    root.prepend(...links.map((l) => {
      const copy = l.cloneNode(true) as HTMLLinkElement;
      for (const type of ['load', 'error']) copy.addEventListener(type, () => settled.add(copy), { once: true });
      return copy;
    }));
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
  const loading = [...root.querySelectorAll('link')].filter((l) => !settled.has(l));
  const ended = (l: HTMLLinkElement) => new Promise((done) => ['load', 'error'].forEach((type) => l.addEventListener(type, done, { once: true })));
  if (loading.length) void Promise.all(loading.map(ended)).then(() => clone.isConnected && drawBackdrops(slide, clone));
  else drawBackdrops(slide, clone);
}

const QUIET = new Set(['contenteditable', 'tabindex', 'aria-hidden', 'hidden', 'role', 'aria-label', 'data-appendix', 'data-visibility']);

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
const redrawnLater = (slide: Element): boolean => !!slide.querySelector('.backdrop') && !slide.classList.contains('present');
const WAITS = 20;

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

export class Thumbs {
  private readonly app: App;
  private readonly hosts = new Map<Element, HTMLElement>();
  private readonly dirty = new Set<Element>();
  private readonly timers = new Map<Element, number>();
  private readonly inView = new Set<HTMLElement>();
  private readonly waits = new Map<Element, number>();
  private readonly scenes = new WeakSet<Element>();
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
    const moved = (e: Event) => {
      const slide = (e.target as Element | null)?.closest?.('tycho-viewer')?.closest('.reveal .slides > section');
      if (slide) this.soon(slide);
    };
    for (const type of ['pointerup', 'wheel', 'keyup']) app.slides().addEventListener(type, moved, { capture: true, passive: true });
  }

  private watch(viewer: Viewer): void {
    if (this.scenes.has(viewer)) return;
    this.scenes.add(viewer);
    const again = () => {
      const slide = viewer.closest('.reveal .slides > section');
      if (slide) this.soon(slide);
    };
    const subscribe = () => viewer.store?.subscribe?.((change) => {
      if (change !== 'frame' || !viewer.store?.playing) again();
    });
    if (viewer.renderer) subscribe();
    else {
      void whenLoaded(viewer).then(() => {
        subscribe();
        again();
      });
    }
  }

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
      this.markDue(slide);
      this.seenBy.observe(host);
    }
    this.drawDue();
  }

  setWidth(width: number): void {
    if (Math.abs(width - this.width) < 0.5) return;
    this.width = width;
    for (const s of this.hosts.keys()) this.markDue(s);
    this.drawDue();
  }

  soon(slide: Element, delay = DELAY): void {
    clearTimeout(this.timers.get(slide));
    this.timers.set(
      slide,
      window.setTimeout(() => {
        this.timers.delete(slide);
        this.markDue(slide);
        this.drawDue();
      }, delay),
    );
  }

  all(): void {
    for (const s of this.hosts.keys()) if (!redrawnLater(s)) this.soon(s);
  }

  redrawn(): void {
    for (const s of this.hosts.keys()) if (redrawnLater(s)) this.soon(s, 100);
  }

  private markDue(slide: Element): void {
    this.dirty.add(slide);
    this.hosts.get(slide)?.setAttribute('data-due', '');
  }

  private deck(): Size {
    const s = this.app.slides() as HTMLElement;
    return { width: s.offsetWidth || 1920, height: s.offsetHeight || 1080 };
  }

  private draw(slide: Element): void {
    const host = this.hosts.get(slide);
    this.dirty.delete(slide);
    host?.removeAttribute('data-due');
    if (!host || !this.width || !slide.isConnected) return;
    const waited = this.waits.get(slide) ?? 0;
    if (waited < WAITS && rawTex(slide)) {
      this.waits.set(slide, waited + 1);
      this.soon(slide);
      if (host.shadowRoot?.querySelector('.beeson-thumb')) return;
    } else this.waits.delete(slide);
    drawInto(host, slide, this.deck(), this.width);
    host.dataset.drawn = String(Number(host.dataset.drawn ?? 0) + 1);
    for (const v of slide.querySelectorAll<Viewer>('tycho-viewer')) this.watch(v);
  }

  private drawDue(): void {
    if (!this.width) return;
    const due = () => [...this.hosts].filter(([slide, host]) => this.dirty.has(slide) && host.getClientRects().length > 0);
    const now = due();
    for (const [slide, host] of now) if (this.inView.has(host)) this.draw(slide);
    if (this.idle || !now.some(([slide]) => this.dirty.has(slide))) return;
    const later = (fn: () => void): number => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 200 }) : setTimeout(fn, 16));
    const step = () => {
      this.idle = 0;
      const next = due()[0]?.[0];
      if (!next) return;
      this.draw(next);
      this.idle = later(step);
    };
    this.idle = later(step);
  }
}

export function install(app: App): void {
  const nav = app.nav as unknown as { list: HTMLElement; useThumbs(t: Thumbs): void };
  const thumbs = new Thumbs(app, nav.list);
  nav.useThumbs(thumbs);
  followTheme(thumbs);
}

export function followTheme(thumbs: Thumbs): void {
  document.addEventListener('beeson:redrawn', () => thumbs.redrawn());
  new MutationObserver(() => thumbs.all()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
