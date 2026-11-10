// the dialog of a link, a popover beside the block of the linked words by the rule of the popovers
// of ui/dialog.ts, hence the block and the text around it stay in view: Link to Slide, Webpage,
// Email, or Phone, the list of the slides, the address, the address and the subject of an email,
// or the number, and the buttons Remove, Open Link, and Done. Enter or Done sets the link as one
// entry of the history, and Esc or a press outside closes the popover without a change. a link to
// a slide is written as the hash of reveal.js, e.g. href="#/7" for the slide at index 7 of the
// show, in which the hidden slides are left out. an email is written as a mailto: link, and a
// phone number as a tel: link

import type { App } from '../app.ts';
import { describe, isHidden, numbers } from '../navigator/navigator.ts';
import { popoverBeside } from '../ui/dialog.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { textTarget, type Target } from './blocks.ts';
import { canLink, linkAt, removeLink, setLink } from './inline.ts';

const CSS = `
.beeson-edit-link { --l-bg: var(--ed-panel, #fbfbfd); --l-text: var(--ed-text, #1d1d1f); --l-muted: var(--ed-muted, #6e6e73); --l-line: var(--ed-line, #d2d2d7); --l-select: var(--ed-select, #7a5af8); --l-field: #fff; }
@media (prefers-color-scheme: dark) {
  .beeson-edit-link { --l-bg: var(--ed-panel, #2c2c2e); --l-text: var(--ed-text, #f2f2f7); --l-muted: var(--ed-muted, #a1a1a6); --l-line: var(--ed-line, #48484a); --l-select: var(--ed-select, #9b82ff); --l-field: #1c1c1e; }
}
.beeson-edit-link { position: fixed; z-index: 80; margin: 0; padding: 14px 16px 12px; width: 372px; box-sizing: border-box; border: 1px solid var(--l-line); border-radius: 12px; background: var(--l-bg); color: var(--l-text); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28); font: 13px/1.35 system-ui, sans-serif; }
.beeson-edit-link .row { display: grid; grid-template-columns: 64px 1fr; align-items: center; gap: 8px; margin-bottom: 10px; }
.beeson-edit-link .row[hidden] { display: none; }
.beeson-edit-link .row > span { text-align: right; color: var(--l-muted); }
.beeson-edit-link .kinds { display: inline-flex; border: 1px solid var(--l-line); border-radius: 7px; overflow: hidden; justify-self: start; }
.beeson-edit-link .kinds button { padding: 3px 10px; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.beeson-edit-link .kinds button + button { border-left: 1px solid var(--l-line); }
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

export type LinkKind = 'slide' | 'webpage' | 'email' | 'phone';
type Kind = LinkKind;
const KINDS: [Kind, string][] = [['slide', 'Slide'], ['webpage', 'Webpage'], ['email', 'Email'], ['phone', 'Phone']];
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

const EMAIL = /^[^\s@,;?]+@[^\s@,;?]+\.[^\s@,;?]+$/;

// an email address and a subject made a mailto: link, or null for an address that is not one
export function mailtoHref(to: string, subject = ''): string | null {
  const address = to.trim();
  if (!EMAIL.test(address)) return null;
  const s = subject.trim();
  return `mailto:${address}${s ? `?subject=${encodeURIComponent(s)}` : ''}`;
}

// a phone number made a tel: link without its spaces, which a URI does not hold. the digits may be
// grouped with hyphens, periods, and parentheses, and a + may lead. null for a text that is not a
// number of at least three digits
export function telHref(number: string): string | null {
  const n = number.trim().replace(/\s+/g, '');
  return /^\+?[\d().-]+$/.test(n) && (n.match(/\d/g) ?? []).length >= 3 ? `tel:${n}` : null;
}

// the kind of an href, and the values of the fields of its kind
export function parseHref(href: string | null): { kind: Kind; slide?: number; url?: string; to?: string; subject?: string; number?: string } {
  if (href === null) return { kind: 'webpage', url: '' };
  const slide = /^#\/(\d+)$/.exec(href);
  if (slide) return { kind: 'slide', slide: Number(slide[1]) };
  const mail = /^mailto:([^?]*)(?:\?(.*))?$/i.exec(href);
  if (mail) {
    const subject = new URLSearchParams(mail[2] ?? '').get('subject') ?? '';
    return { kind: 'email', to: decodeURIComponent(mail[1]), subject };
  }
  const tel = /^tel:(.*)$/i.exec(href);
  if (tel) return { kind: 'phone', number: decodeURIComponent(tel[1]) };
  return { kind: 'webpage', url: href };
}

// the link set on the words of the selection as one entry of the history
export async function applyLink(app: App, href: string): Promise<void> {
  if (!canLink(app)) return;
  await app.history.transact('link', () => setLink(app, href));
}

let open: { dialog: HTMLDialogElement; close(apply: boolean): void } | null = null;
let unplace: (() => void) | null = null;

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

// the popover opens on the kind of the link at the caret, or on kind, or on Webpage
export function openLink(app: App, kind0?: Kind): void {
  open?.close(false);
  if (!canLink(app)) return;
  const t = textTarget(app);
  const saved: Target | null = t ? { host: t.host, range: t.range.cloneRange() } : null;
  const current = linkAt(app);
  const parsed = parseHref(current);
  const slides = slidesOf(app);

  const dialog = make('dialog', 'beeson-edit-link');
  dialog.setAttribute('aria-label', 'Link');
  const kinds = make('div', 'kinds');
  kinds.setAttribute('role', 'radiogroup');
  kinds.setAttribute('aria-label', 'Link to');
  for (const [k, text] of KINDS) {
    const b = make('button', '', text);
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.kind = k;
    b.addEventListener('click', () => show(k));
    kinds.append(b);
  }
  const head = make('label', 'row');
  head.append(make('span', '', 'Link to:'), kinds);

  // a text field in a row with its label, shown for the kinds of shown
  const rows: { row: HTMLElement; kinds: Kind[] }[] = [];
  const input = (name: string, label: string, placeholder: string, value: string, shown: Kind[]) => {
    const field = make('input');
    field.type = name === 'tel' ? 'tel' : 'text';
    field.name = name;
    field.placeholder = placeholder;
    field.spellcheck = false;
    field.autocomplete = 'off';
    field.value = value;
    const row = make('label', 'row');
    row.append(make('span', '', label), field);
    rows.push({ row, kinds: shown });
    return field;
  };
  const field = input('href', 'Link:', 'example.com', parsed.url ?? '', ['webpage']);
  const to = input('mailto', 'To:', 'name@example.com', parsed.to ?? '', ['email']);
  const subject = input('subject', 'Subject:', 'Optional', parsed.subject ?? '', ['email']);
  const number = input('tel', 'Number:', '+1 609 258 3000', parsed.number ?? '', ['phone']);

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
  const chosen = parsed.slide ?? here;
  list.value = chosen === null ? '' : String(chosen);
  const listRow = make('label', 'row');
  listRow.append(make('span', '', 'Slide:'), list);
  rows.push({ row: listRow, kinds: ['slide'] });

  const note = make('div', 'note');
  const buttons = make('div', 'buttons');
  const remove = make('button', 'remove', 'Remove');
  const visit = make('button', 'open', 'Open Link');
  const done = make('button', 'done', 'Done');
  for (const b of [remove, visit, done]) b.type = 'button';
  remove.disabled = current === null;
  buttons.append(remove, visit, done);
  dialog.append(head, ...rows.map((r) => r.row), note, buttons);

  let kind: Kind = current !== null ? parsed.kind : (kind0 ?? 'webpage');
  const href = (): string | null => {
    switch (kind) {
      case 'slide': return list.value ? `#/${list.value}` : null;
      case 'email': return mailtoHref(to.value, subject.value);
      case 'phone': return telHref(number.value);
      default: return normalizeHref(field.value);
    }
  };
  // a line under the fields: the address that a webpage is written as, or why a text is not a link
  const hint = (h: string | null): string => {
    if (kind === 'webpage') return field.value.trim() ? (h ? (h === field.value.trim() ? '' : h) : 'This address is not a link.') : '';
    if (kind === 'email') return to.value.trim() && !h ? 'This is not an email address.' : '';
    if (kind === 'phone') return number.value.trim() && !h ? 'This is not a phone number.' : '';
    return '';
  };
  const update = () => {
    const h = href();
    note.textContent = hint(h);
    done.disabled = h === null;
    visit.disabled = h === null;
  };
  const first: Record<Kind, HTMLElement> = { slide: list, webpage: field, email: to, phone: number };
  const show = (k: Kind) => {
    kind = k;
    for (const b of kinds.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.getAttribute('data-kind') === k));
    for (const r of rows) r.row.hidden = !r.kinds.includes(k);
    update();
    first[k].focus();
  };

  const close = (apply: boolean) => {
    if (open?.dialog !== dialog) return;
    open = null;
    document.removeEventListener('pointerdown', outside, true);
    unplace?.();
    unplace = null;
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

  for (const f of [field, to, subject, number]) f.addEventListener('input', update);
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
  show(kind);
  // beside the block, with its arrow at the linked words
  const words = saved && !saved.range.collapsed ? saved.range.getBoundingClientRect() : null;
  unplace = popoverBeside(app, dialog, saved?.host ?? app.selection.elements()[0] ?? document.body, { at: words?.width ? words : undefined });
  document.addEventListener('pointerdown', outside, true);
  if (kind === 'webpage') field.select();
}

export function install(_app: App): void {
  injectStyle('link', CSS);
}
