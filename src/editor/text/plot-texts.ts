import type { App } from '../app.ts';
import { injectStyle } from '../ui/dom.ts';

type Range = { start: number; end: number };
type Drawn = { el: HTMLElement; reload(): void; pause(): void };
type Open = { el: HTMLElement; edit: HTMLElement; kept: Node[] };

const TEXT = '.plot [data-plot-text]';
const CHOSEN = 'beeson-plot-text-chosen';
const START = /^<script\b(?:[^>"']|"[^"]*"|'[^']*')*>/i;

const CSS = `
html.beeson-editing .reveal .plot .plot-label[data-plot-text] { pointer-events: auto; }
html.beeson-editing .reveal .plot .${CHOSEN} { outline: 2px solid var(--ed-select, #7048e8); outline-offset: 4px; border-radius: 2px; }
html.beeson-editing .reveal .plot .beeson-plot-edit { display: inline-block; min-width: 0.5em; outline: none; white-space: pre; color: var(--text); cursor: text; }
`;

function literals(json: string, offset: number): Map<string, Range> {
  const out = new Map<string, Range>();
  let i = 0;
  const space = () => {
    while (i < json.length && ' \t\n\r'.includes(json[i])) i++;
  };
  const string = (): Range => {
    const start = i++;
    while (i < json.length && json[i] !== '"') i += json[i] === '\\' ? 2 : 1;
    i++;
    return { start, end: i };
  };
  const value = (path: string): void => {
    space();
    const c = json[i];
    if (c === '"') {
      const r = string();
      out.set(path, { start: r.start + offset, end: r.end + offset });
    } else if (c === '{' || c === '[') {
      const close = c === '{' ? '}' : ']';
      i++;
      space();
      if (json[i] === close) {
        i++;
        return;
      }
      for (let k = 0; i < json.length; k++) {
        space();
        if (c === '{') {
          const key = string();
          const name = JSON.parse(json.slice(key.start, key.end)) as string;
          space();
          i++;
          value(path ? `${path}.${name}` : name);
        } else value(`${path}[${k}]`);
        space();
        if (json[i++] !== ',') return;
      }
    } else while (i < json.length && !' \t\n\r,]}'.includes(json[i])) i++;
  };
  value('');
  return out;
}

function literalAt(script: string, path: string): Range | null {
  const start = START.exec(script)?.[0].length ?? -1;
  const end = script.lastIndexOf('</');
  if (start < 0 || end < start) return null;
  try {
    return literals(script.slice(start, end), start).get(path) ?? null;
  } catch {
    return null;
  }
}

export function plotTextIn(script: string, path: string): string | null {
  const r = literalAt(script, path);
  return r ? (JSON.parse(script.slice(r.start, r.end)) as string) : null;
}

export function withPlotText(script: string, path: string, text: string): string | null {
  const r = literalAt(script, path);
  return r ? script.slice(0, r.start) + JSON.stringify(text).replaceAll('</', '<\\/') + script.slice(r.end) : null;
}

const plots = (): Drawn[] => (window as unknown as { Beeson?: { plots?: Drawn[] } }).Beeson?.plots ?? [];

export function install(app: App): void {
  injectStyle('plot-texts', CSS);
  let chosen: HTMLElement | null = null;
  let open: Open | null = null;

  const scriptOf = (el: Element): { script: Element; path: string; body: string } | null => {
    const plot = el.closest<HTMLElement>('.plot');
    const path = (el as HTMLElement).dataset.plotText;
    if (!plot || !path || !app.pairing?.elements.has(plot) || !app.current()?.contains(plot) || plot.closest('[data-locked]')) return null;
    const script = document.getElementById(plot.dataset.plot ?? '');
    if (!script || !app.pairing.elements.has(script)) return null;
    const body = app.doc.elementText(script);
    return plotTextIn(body, path) === null ? null : { script, path, body };
  };

  const choose = (el: HTMLElement | null) => {
    chosen?.classList.remove(CHOSEN);
    chosen = el;
    el?.classList.add(CHOSEN);
  };

  const redraw = (records: MutationRecord[]) => {
    const ids = new Set<string>();
    for (const r of records) for (const n of [...r.addedNodes, ...r.removedNodes]) if (n instanceof HTMLScriptElement && n.id) ids.add(n.id);
    if (!ids.size) return;
    for (const p of plots()) if (p.el.isConnected && ids.has(p.el.dataset.plot ?? '')) p.reload();
  };
  const watch = new MutationObserver(redraw);
  watch.observe(app.slides(), { childList: true, subtree: true });

  const begin = (el: HTMLElement) => {
    const at = scriptOf(el);
    if (!at) return;
    const plot = el.closest<HTMLElement>('.plot');
    plots().find((p) => p.el === plot)?.pause();
    choose(el);
    const edit = document.createElement('span');
    edit.className = 'beeson-plot-edit';
    edit.contentEditable = 'plaintext-only';
    edit.spellcheck = false;
    edit.textContent = plotTextIn(at.body, at.path);
    open = { el, edit, kept: [...el.childNodes] };
    el.replaceChildren(edit);
    edit.addEventListener('blur', () => void finish().catch((e) => app.fail(e)));
    edit.focus({ preventScroll: true });
    getSelection()?.selectAllChildren(edit);
    getSelection()?.collapseToEnd();
  };

  const finish = async () => {
    if (!open) return;
    const { el, edit, kept } = open;
    open = null;
    const text = (edit.textContent ?? '').replace(/\s*[\r\n]+\s*/g, ' ');
    el.replaceChildren(...kept);
    const at = scriptOf(el);
    const next = at && plotTextIn(at.body, at.path) !== text ? withPlotText(at.body, at.path, text) : null;
    if (!at || next === null) return;
    const plot = el.closest<HTMLElement>('.plot')!;
    await app.doc.rewrite(at.script, () => next, 'Plot Text');
    redraw(watch.takeRecords());
    if (chosen === el) choose([...plot.querySelectorAll<HTMLElement>('[data-plot-text]')].find((e) => e.dataset.plotText === at.path) ?? null);
  };

  window.addEventListener('pointerdown', (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (open && target && open.edit.contains(target)) {
      ev.stopImmediatePropagation();
      return;
    }
    const el = target?.closest<HTMLElement>(TEXT) ?? null;
    const plain = ev.button === 0 && !ev.shiftKey && !ev.metaKey && !ev.ctrlKey && !ev.altKey;
    if (!el || !plain || !scriptOf(el)) {
      choose(null);
      return;
    }
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest('.reveal')) active.blur();
    if (open) return;
    if (chosen === el) return begin(el);
    app.selection.clear();
    choose(el);
  }, true);

  app.commands.intercept((ev) => {
    if (open) {
      if (!open.edit.contains(document.activeElement)) return false;
      if (ev.key === 'Enter' || ev.key === 'Escape') {
        ev.preventDefault();
        (document.activeElement as HTMLElement).blur();
      }
      return true;
    }
    if (!chosen || ev.metaKey || ev.ctrlKey || ev.altKey || app.region() !== 'canvas') return false;
    if (!chosen.isConnected) {
      choose(null);
      return false;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      begin(chosen);
      return true;
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      choose(null);
      return true;
    }
    return false;
  });

  app.selection.listen(() => {
    if (app.selection.kind !== 'none') choose(null);
  });
  app.listen('slide', () => choose(null));
}
