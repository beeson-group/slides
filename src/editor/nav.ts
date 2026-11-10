// the list of the slides at the left, as the thumbnails of PowerPoint and the navigator of
// Keynote: one row per slide with its number, its title, and its layout, the current slide marked,
// and a click or the arrow keys move to a slide. a row shows the title rather than a thumbnail,
// since a thumbnail would draw every backdrop and viewer of the deck a second time, and a preview
// of one slide is shown while the pointer rests on its row

import { layersOf, showLayer } from './layers.ts';
import { injectStyle } from './ui/dom.ts';

export type Ctx = {
  slides(): Element[];
  current(): Element | null;
  go(slide: Element): void;
  layout(): void;
};

const KEY = 'beeson-nav';
const LAYOUTS = ['title', 'section', 'closing', 'figure', 'split'];
const PEEK_WIDTH = 320;
const PEEK_DELAY = 300;

function describe(slide: Element): { title: string; kind: string } {
  const heading = [...slide.querySelectorAll('h1, h2, h3, p, .caption')].find((h) => !h.closest('aside.notes, .backdrop') && (h.textContent ?? '').trim());
  const title = (heading?.textContent ?? '').replace(/\s+/g, ' ').trim() || 'Untitled slide';
  const kind = LAYOUTS.find((c) => slide.classList.contains(c)) ?? 'content';
  return { title, kind };
}

const CSS = `
.beeson-edit-nav { position: fixed; left: 0; top: 44px; bottom: 36px; z-index: 50; width: 240px; box-sizing: border-box; display: none; flex-direction: column; background: var(--bg, #000); border-right: 1px solid var(--line, #555); color: var(--text, #eee); font: 13px/1.4 system-ui, sans-serif; }
html.beeson-nav .beeson-edit-nav { display: flex; }
.beeson-edit-nav .head { padding: 10px 12px; font-weight: 600; border-bottom: 1px solid var(--line, #555); }
.beeson-edit-nav .rows { flex: 1; overflow: auto; padding: 6px 0; }
.beeson-edit-nav .row { display: grid; grid-template-columns: 3ch 1fr; column-gap: 10px; width: 100%; box-sizing: border-box; padding: 6px 12px 6px 9px; border: 0; border-left: 3px solid transparent; border-radius: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.beeson-edit-nav .row:hover { background: color-mix(in srgb, var(--violet, #96f) 18%, transparent); }
.beeson-edit-nav .row:focus-visible { outline: 2px solid var(--violet, #96f); outline-offset: -2px; }
.beeson-edit-nav .row[aria-current="true"] { border-left-color: var(--accent, #f80); background: color-mix(in srgb, var(--violet, #96f) 28%, transparent); }
.beeson-edit-nav .row .num { color: var(--subtle, #bbb); text-align: right; }
.beeson-edit-nav .row .title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beeson-edit-nav .row .kind { grid-column: 2; color: var(--subtle, #bbb); font-size: 11px; }
.beeson-edit-peek { position: fixed; left: 248px; z-index: 57; width: 320px; overflow: hidden; border-radius: 6px; outline: 1px solid var(--line, #555); background: var(--bg, #000); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); pointer-events: none; }
.beeson-edit-peek[hidden] { display: none; }
.beeson-edit-peek .reveal { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; overflow: hidden; }
.beeson-edit-peek .fragment { visibility: visible !important; opacity: 1 !important; transition: none !important; }
.beeson-edit-peek .fragment.beeson-off { visibility: hidden !important; }
`;

export class Nav {
  readonly pane = document.createElement('div');
  readonly button = document.createElement('button');
  private readonly list = document.createElement('div');
  private readonly peek = document.createElement('div');
  private readonly ctx: Ctx;
  private on = true;
  private key = '';
  private timer = 0;

  constructor(ctx: Ctx) {
    injectStyle('nav', CSS);
    this.ctx = ctx;
    this.pane.className = 'beeson-edit-nav';
    this.pane.setAttribute('aria-label', 'Slides');
    this.button.textContent = 'Slides';
    this.button.title = 'Show the list of the slides at the left';
    const head = document.createElement('div');
    head.className = 'head';
    head.textContent = 'Slides';
    this.list.className = 'rows';
    this.list.setAttribute('role', 'listbox');
    this.list.setAttribute('aria-label', 'Slides');
    this.peek.className = 'beeson-edit-peek';
    this.peek.hidden = true;
    this.peek.setAttribute('aria-hidden', 'true');
    this.peek.setAttribute('inert', '');
    this.pane.append(head, this.list, this.peek);
    this.button.addEventListener('click', () => this.toggle());
    this.list.addEventListener('keydown', (ev) => this.onKey(ev));
    try {
      this.on = localStorage.getItem(KEY) !== '0';
    } catch {
      this.on = true;
    }
    this.show(this.on);
  }

  get shown(): boolean {
    return this.on;
  }

  toggle(): void {
    this.show(!this.on);
    try {
      localStorage.setItem(KEY, this.on ? '1' : '0');
    } catch {
      // a blocked storage forgets the choice
    }
    this.ctx.layout();
    this.refresh();
  }

  private show(on: boolean): void {
    this.on = on;
    if (!on) this.hidePeek();
    document.documentElement.classList.toggle('beeson-nav', on);
    this.button.classList.toggle('on', on);
    this.button.setAttribute('aria-pressed', String(on));
  }

  // the rows are built again when a title changes, and the current row is marked and kept in view
  refresh(): void {
    if (!this.on) return;
    const slides = this.ctx.slides();
    const rows = slides.map((s) => describe(s));
    const key = rows.map((r) => `${r.kind}|${r.title}`).join('\n');
    if (key !== this.key) {
      this.key = key;
      this.hidePeek();
      this.list.replaceChildren(...slides.map((slide, i) => {
        const row = document.createElement('button');
        row.className = 'row';
        row.type = 'button';
        row.setAttribute('role', 'option');
        const num = document.createElement('span');
        num.className = 'num';
        num.textContent = String(i + 1);
        const title = document.createElement('span');
        title.className = 'title';
        title.textContent = rows[i].title;
        const kind = document.createElement('span');
        kind.className = 'kind';
        kind.textContent = rows[i].kind;
        row.append(num, title, kind);
        row.title = `Slide ${i + 1}: ${rows[i].title}`;
        row.addEventListener('click', () => {
          this.hidePeek();
          this.ctx.go(slide);
        });
        row.addEventListener('pointerenter', () => {
          this.hidePeek();
          this.timer = window.setTimeout(() => this.showPeek(slide, row), PEEK_DELAY);
        });
        row.addEventListener('pointerleave', () => this.hidePeek());
        return row;
      }));
    }
    const current = this.ctx.current();
    const at = slides.indexOf(current as Element);
    [...this.list.children].forEach((row, i) => {
      const here = i === at;
      row.setAttribute('aria-current', here ? 'true' : 'false');
      row.setAttribute('aria-selected', here ? 'true' : 'false');
      row.setAttribute('tabindex', here || (at < 0 && i === 0) ? '0' : '-1');
      if (here) row.scrollIntoView({ block: 'nearest' });
    });
  }

  private hidePeek(): void {
    clearTimeout(this.timer);
    this.peek.hidden = true;
    this.peek.replaceChildren();
  }

  // a clone of the slide, scaled into the preview from its upper left, with every step shown. the
  // canvases of a backdrop are painted from the originals, since a cloned canvas is blank, and a
  // tycho viewer is left out, since its clone would start a second renderer
  private showPeek(slide: Element, row: HTMLElement): void {
    const stage = slide.parentElement as HTMLElement;
    const width = stage.offsetWidth || 1920;
    const height = stage.offsetHeight || 1080;
    const clone = slide.cloneNode(true) as HTMLElement;
    const from = slide.querySelectorAll('canvas');
    clone.querySelectorAll('canvas').forEach((canvas, i) => {
      try {
        canvas.getContext('2d')?.drawImage(from[i], 0, 0);
      } catch {
        // a canvas of zero size is left blank
      }
    });
    clone.querySelectorAll('aside.notes').forEach((n) => n.remove());
    // a backdrop of a slide not yet shown is not drawn, and its labels are not placed
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
      v.preload = 'none';
    });
    for (const el of [clone, ...clone.querySelectorAll('*')]) {
      for (const name of ['id', 'contenteditable', 'tabindex', 'hidden', 'aria-hidden']) el.removeAttribute(name);
      el.classList.remove('beeson-hover', 'beeson-overflow', 'current-fragment', 'past', 'future');
      if (el.classList.contains('fragment')) el.classList.add('visible');
    }
    // the preview shows the first layer of a slide whose elements are hidden at a step
    const layers = layersOf(clone);
    showLayer(clone, layers.length > 1 ? layers[0] : null);
    clone.classList.add('present');
    clone.style.display = 'block';
    const deck = document.createElement('div');
    deck.className = 'reveal beeson-peek';
    const slides = document.createElement('div');
    slides.className = 'slides';
    slides.style.cssText = `inset: 0 auto auto 0; margin: 0; width: ${width}px; height: ${height}px; transform: scale(${PEEK_WIDTH / width}); transform-origin: 0 0;`;
    slides.append(clone);
    deck.append(slides);
    const peekHeight = (PEEK_WIDTH * height) / width;
    const top = Math.max(52, Math.min(row.getBoundingClientRect().top, innerHeight - 44 - peekHeight));
    this.peek.style.top = `${top}px`;
    this.peek.style.height = `${peekHeight}px`;
    this.peek.replaceChildren(deck);
    this.peek.hidden = false;
  }

  // the arrows move to the previous or next slide while a row has the focus, and Home and End to
  // the first and the last
  private onKey(ev: KeyboardEvent): void {
    const slides = this.ctx.slides();
    const at = slides.indexOf(this.ctx.current() as Element);
    const to: Record<string, number> = { ArrowUp: at - 1, ArrowDown: at + 1, Home: 0, End: slides.length - 1 };
    const i = to[ev.key];
    if (i === undefined || i < 0 || i >= slides.length) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.ctx.go(slides[i]);
    this.refresh();
    (this.list.children[i] as HTMLElement | undefined)?.focus({ preventScroll: true });
  }
}
