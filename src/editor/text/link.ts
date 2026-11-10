// the dialog of a link, a popover under the linked words as in Keynote: Link to Webpage or Slide,
// the address or the list of the slides, and the buttons Remove, Open Link, and Done. Enter or Done
// sets the link as one entry of the history, and Esc or a press outside closes the popover without
// a change. a link to a slide is written as the hash of reveal.js, e.g. href="#/7" for the slide at
// index 7 of the show, in which the hidden slides are left out

import type { App } from '../app.ts';
import { describe, isHidden, numbers } from '../navigator/navigator.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { textTarget, type Target } from './blocks.ts';
import { canLink, linkAt, removeLink, setLink } from './inline.ts';

const CSS = `
.beeson-edit-link { --l-bg: var(--ed-panel, #fbfbfd); --l-text: var(--ed-text, #1d1d1f); --l-muted: var(--ed-muted, #6e6e73); --l-line: var(--ed-line, #d2d2d7); --l-select: var(--ed-select, #7a5af8); --l-field: #fff; }
@media (prefers-color-scheme: dark) {
  .beeson-edit-link { --l-bg: var(--ed-panel, #2c2c2e); --l-text: var(--ed-text, #f2f2f7); --l-muted: var(--ed-muted, #a1a1a6); --l-line: var(--ed-line, #48484a); --l-select: var(--ed-select, #9b82ff); --l-field: #1c1c1e; }
}
.beeson-edit-link { position: fixed; z-index: 80; margin: 0; padding: 14px 16px 12px; width: 340px; box-sizing: border-box; border: 1px solid var(--l-line); border-radius: 12px; background: var(--l-bg); color: var(--l-text); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28); font: 13px/1.35 system-ui, sans-serif; }
.beeson-edit-link .row { display: grid; grid-template-columns: 64px 1fr; align-items: center; gap: 8px; margin-bottom: 10px; }
.beeson-edit-link .row[hidden] { display: none; }
.beeson-edit-link .row > span { text-align: right; color: var(--l-muted); }
.beeson-edit-link .kinds { display: inline-flex; border: 1px solid var(--l-line); border-radius: 7px; overflow: hidden; justify-self: start; }
.beeson-edit-link .kinds button { padding: 3px 12px; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.beeson-edit-link .kinds button[aria-checked="true"] { background: var(--l-select); color: #fff; }
.beeson-edit-link input, .beeson-edit-link select { box-sizing: border-box; width: 100%; padding: 4px 6px; border: 1px solid var(--l-line); border-radius: 6px; background: var(--l-field); color: var(--l-text); font: inherit; }
.beeson-edit-link input:focus-visible, .beeson-edit-link select:focus-visible { outline: 3px solid color-mix(in srgb, var(--l-select) 45%, transparent); outline-offset: 0; border-color: var(--l-select); }
.beeson-edit-link .note { min-height: 1.35em; margin: -4px 0 8px 72px; color: var(--l-muted); font-size: 12px; }
.beeson-edit-link .buttons { display: flex; gap: 8px; padding-top: 10px; border-top: 1px solid var(--l-line); }
.beeson-edit-link .buttons button { padding: 4px 12px; border: 1px solid var(--l-line); border-radius: 6px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.beeson-edit-link .buttons button:disabled { opacity: 0.45; cursor: default; }
.beeson-edit-link .buttons .done { margin-left: auto; border-color: var(--l-select); background: var(--l-select); color: #fff; }
::highlight(beeson-link) { background-color: color-mix(in srgb, #7a5af8 30%, transparent); }
`;

type Kind = 'webpage' | 'slide';
type Highlights = { set(name: string, h: unknown): void; delete(name: string): void };
type HighlightCtor = new (...ranges: Range[]) => unknown;

const highlights = (): Highlights | null => (globalThis.CSS as unknown as { highlights?: Highlights }).highlights ?? null;

// the slides of the show with their index in it, i.e. the hash of reveal.js, their number, and
// their title. a hidden slide is listed without an index
function slidesOf(app: App): { slide: Element; index: number | null; label: string }[] {
  const all = [...app.slides().querySelectorAll(':scope > section')];
  const nums = numbers(all, (s) => s.getAttribute('data-visibility'));
  let i = 0;
  return all.map((slide, k) => {
    const index = isHidden(slide) ? null : i++;
    const title = describe(slide).title;
    return { slide, index, label: `${nums[k] || (index === null ? '–' : '·')}  ${title}${index === null ? ' (hidden)' : ''}` };
  });
}

// an address as typed made an href: a scheme is kept, an email address is a mailto, and every
// other address is given https. a script is not a link, and gives null
export function normalizeHref(typed: string): string | null {
  const v = typed.trim();
  if (!v) return null;
  if (v.startsWith('#')) return v;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(v)?.[1].toLowerCase();
  if (scheme) return ['javascript', 'data', 'vbscript'].includes(scheme) ? null : v;
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(v)) return `mailto:${v}`;
  return `https://${v}`;
}

// the link set on the words of the selection as one entry of the history
export async function applyLink(app: App, href: string): Promise<void> {
  if (!canLink(app)) return;
  await app.history.transact('link', () => setLink(app, href));
}

let open: { dialog: HTMLDialogElement; close(apply: boolean): void } | null = null;

export function linkOpen(): boolean {
  return open !== null;
}

// the words of the selection selected again in their block, after the popover took the focus
function reselect(saved: Target | null): void {
  if (!saved || !saved.host.isConnected) return;
  (saved.host as HTMLElement).focus({ preventScroll: true });
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(saved.range);
}

export function openLink(app: App): void {
  open?.close(false);
  if (!canLink(app)) return;
  const t = textTarget(app);
  const saved: Target | null = t ? { host: t.host, range: t.range.cloneRange() } : null;
  const current = linkAt(app);
  const slides = slidesOf(app);
  const hash = /^#\/(\d+)$/.exec(current ?? '');

  const dialog = make('dialog', 'beeson-edit-link');
  dialog.setAttribute('aria-label', 'Link');
  const kinds = make('div', 'kinds');
  kinds.setAttribute('role', 'radiogroup');
  kinds.setAttribute('aria-label', 'Link to');
  const kindButton = (kind: Kind, text: string) => {
    const b = make('button', '', text);
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.kind = kind;
    b.addEventListener('click', () => show(kind));
    kinds.append(b);
    return b;
  };
  kindButton('webpage', 'Webpage');
  kindButton('slide', 'Slide');
  const head = make('label', 'row');
  head.append(make('span', '', 'Link to:'), kinds);

  const field = make('input');
  field.type = 'text';
  field.name = 'href';
  field.placeholder = 'example.com';
  field.spellcheck = false;
  field.value = current && !hash ? current : '';
  const fieldRow = make('label', 'row');
  fieldRow.append(make('span', '', 'Link:'), field);

  const list = make('select');
  list.name = 'slide';
  list.size = Math.min(8, Math.max(3, slides.length));
  for (const s of slides) {
    const o = make('option', '', s.label);
    o.value = s.index === null ? '' : String(s.index);
    o.disabled = s.index === null;
    list.append(o);
  }
  const here = slides.find((s) => s.slide === app.current())?.index ?? null;
  const chosen = hash ? Number(hash[1]) : here;
  list.value = chosen === null ? '' : String(chosen);
  const listRow = make('label', 'row');
  listRow.append(make('span', '', 'Slide:'), list);

  const note = make('div', 'note');
  const buttons = make('div', 'buttons');
  const remove = make('button', 'remove', 'Remove');
  const visit = make('button', 'open', 'Open Link');
  const done = make('button', 'done', 'Done');
  for (const b of [remove, visit, done]) b.type = 'button';
  remove.disabled = current === null;
  buttons.append(remove, visit, done);
  dialog.append(head, fieldRow, listRow, note, buttons);

  let kind: Kind = hash ? 'slide' : 'webpage';
  const href = (): string | null => (kind === 'slide' ? (list.value ? `#/${list.value}` : null) : normalizeHref(field.value));
  const update = () => {
    const h = href();
    note.textContent = kind === 'webpage' && field.value.trim() && h ? (h === field.value.trim() ? '' : h) : kind === 'webpage' && field.value.trim() ? 'This address is not a link.' : '';
    done.disabled = h === null;
    visit.disabled = h === null;
  };
  const show = (k: Kind) => {
    kind = k;
    for (const b of kinds.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.getAttribute('data-kind') === k));
    fieldRow.hidden = k !== 'webpage';
    listRow.hidden = k !== 'slide';
    update();
    (k === 'webpage' ? field : list).focus();
  };

  const close = (apply: boolean) => {
    if (open?.dialog !== dialog) return;
    open = null;
    document.removeEventListener('pointerdown', outside, true);
    highlights()?.delete('beeson-link');
    const h = href();
    dialog.close();
    dialog.remove();
    reselect(saved);
    if (apply && h) void applyLink(app, h).catch((e) => app.fail(e));
  };
  const outside = (ev: PointerEvent) => {
    if (!dialog.contains(ev.target as Node)) close(false);
  };

  field.addEventListener('input', update);
  list.addEventListener('change', update);
  list.addEventListener('dblclick', () => close(true));
  done.addEventListener('click', () => close(true));
  remove.addEventListener('click', () => {
    close(false);
    void app.history.transact('remove link', () => removeLink(app)).catch((e) => app.fail(e));
  });
  visit.addEventListener('click', () => {
    const h = href();
    if (!h) return;
    if (kind === 'slide') {
      const s = slides.find((x) => x.index === Number(list.value));
      close(false);
      if (s) app.showSlide(s.slide);
    } else window.open(h, '_blank', 'noopener');
  });
  dialog.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') close(false);
    else if (ev.key === 'Enter' && !(ev.target instanceof HTMLButtonElement)) close(true);
    else return;
    ev.preventDefault();
    ev.stopPropagation();
  });

  document.body.append(dialog);
  dialog.show();
  open = { dialog, close };
  const H = (globalThis as unknown as { Highlight?: HighlightCtor }).Highlight;
  if (saved && !saved.range.collapsed && H) highlights()?.set('beeson-link', new H(saved.range));
  place(dialog, saved ? saved.range : null, saved?.host ?? app.selection.elements()[0] ?? null);
  document.addEventListener('pointerdown', outside, true);
  show(kind);
  if (kind === 'webpage') field.select();
}

// the popover under the words, or over them where the window ends below them
function place(dialog: HTMLElement, range: Range | null, host: Element | null): void {
  const r = range && !range.collapsed ? range.getBoundingClientRect() : (host ?? document.body).getBoundingClientRect();
  const w = dialog.offsetWidth;
  const h = dialog.offsetHeight;
  const below = r.bottom + 10;
  const y = below + h <= innerHeight - 8 ? below : r.top - h - 10;
  const x = r.left + r.width / 2 - w / 2;
  dialog.style.left = `${Math.max(8, Math.min(x, innerWidth - w - 8))}px`;
  dialog.style.top = `${Math.max(8, Math.min(y, innerHeight - h - 8))}px`;
}

export function install(_app: App): void {
  injectStyle('link', CSS);
}
