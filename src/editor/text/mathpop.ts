import { HOST, type App, type MathPop } from '../app.ts';
import type { Entry } from '../history.ts';
import { completionText, completions, contentWithInline, contentWithTex, deckMacros, glyphOf, isName, mathLookup, previewTex, type Macro } from '../math.ts';
import { popoverBeside, type Side } from '../ui/dialog.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { isLabel } from './labels.ts';
import { showTex } from './shown-tex.ts';
import { placeCaret } from './typing.ts';

const CSS = `
.beeson-math { position: fixed; z-index: 70; display: flex; flex-direction: column; gap: 10px; width: min(440px, calc(100vw - 32px)); box-sizing: border-box; padding: 16px 18px 14px; border: 1px solid var(--ed-menu-line, #555); border-radius: 14px; background: var(--ed-panel, #222); color: var(--ed-text, #eee); font: 13px/1.4 var(--ed-font, system-ui, sans-serif); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.14); }
.beeson-math .title { color: var(--ed-muted, #999); font: 500 12px/1.2 var(--ed-font, system-ui, sans-serif); }
.beeson-math textarea { font: 13px/1.45 ui-monospace, Menlo, Consolas, monospace; min-height: 7.5em; padding: 8px 10px; border: 0; border-radius: 7px; background: var(--ed-control, #333); box-shadow: inset 0 0 0 1px var(--ed-control-line, #555); color: inherit; resize: vertical; outline: none; }
.beeson-math textarea:focus { box-shadow: inset 0 0 0 1px var(--ed-select, #96f), 0 0 0 2px var(--ed-focus, rgba(150, 100, 255, 0.5)); }
.beeson-math textarea::placeholder, .beeson-tex textarea::placeholder { color: var(--ed-faint, #777); }
.beeson-math .row { display: flex; gap: 8px; align-items: center; }
.beeson-math button { font: inherit; min-width: 72px; padding: 4px 14px; border: 1px solid var(--ed-control-line, #555); border-radius: 6px; background: var(--ed-control, #333); color: var(--ed-text, #eee); cursor: default; white-space: nowrap; box-shadow: 0 0.5px 1px rgba(0, 0, 0, 0.12); }
.beeson-math button.primary { border-color: transparent; background: var(--ed-select, #96f); color: var(--ed-on-select, #fff); }
.beeson-math button:focus-visible { outline: 3px solid var(--ed-focus, rgba(150, 100, 255, 0.5)); outline-offset: 1px; }
.beeson-math button:disabled { opacity: 0.45; }
.beeson-math .hint { margin-right: auto; color: var(--ed-muted, #636368); font-size: 11px; }
.beeson-tex .preview { display: flex; align-items: center; justify-content: center; min-height: 56px; max-height: 200px; overflow: auto; padding: 8px 12px; border-radius: 9px; background: var(--ed-hover, rgba(127, 127, 127, 0.1)); color: var(--ed-text, #eee); font-size: 26px; }
.beeson-tex .preview mjx-container { margin: 0 !important; max-width: 100%; }
.beeson-tex .preview svg { max-width: 100%; height: auto; }
.beeson-tex .preview .empty { color: var(--ed-muted, #636368); font: 12px/1.3 var(--ed-font, system-ui, sans-serif); }
.beeson-tex .error { color: var(--ed-error, #d70015); font: 12px/1.35 var(--ed-font, system-ui, sans-serif); }
.beeson-tex .error.prompt { color: var(--ed-muted, #999); }
.beeson-tex .error:empty { display: none; }
.beeson-complete { position: fixed; z-index: 90; min-width: 220px; max-width: 360px; margin: 0; padding: 4px; list-style: none; border: 1px solid var(--ed-menu-line, #555); border-radius: 8px; background: var(--ed-menu, #2c2c2e); color: var(--ed-text, #eee); font: 12px/1.3 var(--ed-font, system-ui, sans-serif); box-shadow: 0 10px 32px rgba(0, 0, 0, 0.28); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); }
.beeson-complete li { display: flex; align-items: baseline; gap: 10px; padding: 4px 8px; border-radius: 5px; cursor: default; white-space: nowrap; }
.beeson-complete li[aria-selected="true"] { background: var(--ed-select, #96f); color: var(--ed-on-select, #fff); }
.beeson-complete .glyph { flex: 0 0 30px; align-self: center; display: flex; align-items: center; justify-content: center; height: 22px; overflow: hidden; font-size: 13px; }
.beeson-complete .glyph svg { max-width: 30px; max-height: 22px; }
.beeson-complete .name { font: 12px/1.3 ui-monospace, Menlo, Consolas, monospace; }
.beeson-complete .args { color: var(--ed-faint, #888); }
.beeson-complete .what { margin-left: auto; overflow: hidden; text-overflow: ellipsis; color: var(--ed-muted, #999); font-size: 11px; }
.beeson-complete li[aria-selected="true"] .args, .beeson-complete li[aria-selected="true"] .what { color: inherit; opacity: 0.8; }
`;

let completing: { field: HTMLTextAreaElement; key(ev: KeyboardEvent): boolean; close(): void } | null = null;

function caretPoint(field: HTMLTextAreaElement): { x: number; y: number } {
  const style = getComputedStyle(field);
  const mirror = document.createElement('div');
  for (const p of ['font', 'letterSpacing', 'padding', 'border', 'boxSizing', 'lineHeight', 'whiteSpace', 'wordWrap', 'tabSize'] as const) mirror.style[p] = style[p];
  Object.assign(mirror.style, { position: 'fixed', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', width: `${field.clientWidth}px`, left: '0', top: '0' });
  mirror.textContent = field.value.slice(0, field.selectionStart);
  const mark = document.createElement('span');
  mark.textContent = '​';
  mirror.append(mark);
  document.body.append(mirror);
  const r = field.getBoundingClientRect();
  const x = r.left + mark.offsetLeft - field.scrollLeft;
  const y = r.top + mark.offsetTop + mark.offsetHeight - field.scrollTop;
  mirror.remove();
  return { x, y };
}

export function attachCompletion(field: HTMLTextAreaElement): void {
  const list = make('ul', 'beeson-complete');
  list.id = `beeson-complete-${Math.random().toString(36).slice(2, 8)}`;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'TeX macros');
  field.setAttribute('aria-autocomplete', 'list');
  field.setAttribute('aria-controls', list.id);
  let items: Macro[] = [];
  let at = 0;
  let from = -1;
  const close = () => {
    list.remove();
    items = [];
    from = -1;
    field.removeAttribute('aria-activedescendant');
    field.setAttribute('aria-expanded', 'false');
    if (completing?.field === field) completing = null;
  };
  const choose = (i: number) => {
    at = i;
    [...list.children].forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
    if (i < 0) field.removeAttribute('aria-activedescendant');
    else field.setAttribute('aria-activedescendant', `${list.id}-${i}`);
    list.children[i]?.scrollIntoView({ block: 'nearest' });
  };
  const accept = () => {
    const m = items[at];
    if (!m || from < 0) return close();
    const { text, caret } = completionText(m);
    field.setRangeText(text, from, field.selectionStart, 'end');
    field.setSelectionRange(from + caret, from + caret);
    close();
    field.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const update = () => {
    const before = field.value.slice(0, field.selectionStart);
    const m = field.selectionStart === field.selectionEnd ? /\\([A-Za-z]*)$/.exec(before) : null;
    if (!m || document.activeElement !== field) return close();
    from = m.index;
    const macros = deckMacros();
    items = completions(m[1], macros);
    if (!items.length) return close();
    list.replaceChildren(...items.map((it, i) => {
      const li = make('li');
      li.id = `${list.id}-${i}`;
      li.setAttribute('role', 'option');
      const shown = make('span', 'glyph');
      shown.setAttribute('aria-hidden', 'true');
      void glyphOf(it).then((g) => {
        const svg = g?.querySelector('svg');
        if (svg && li.isConnected) shown.replaceChildren(svg.cloneNode(true));
      });
      li.append(shown, make('span', 'name', `\\${it.name}`));
      if (it.args) li.append(make('span', 'args', '{…}'.repeat(it.args)));
      li.append(make('span', 'what', it.deck ? `deck macro${it.body ? `, ${it.body}` : ''}` : 'TeX'));
      li.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        at = i;
        accept();
      });
      return li;
    }));
    if (!list.isConnected) document.body.append(list);
    const p = caretPoint(field);
    list.style.left = `${Math.max(8, Math.min(p.x - 8, window.innerWidth - list.offsetWidth - 8))}px`;
    list.style.top = `${p.y + list.offsetHeight + 4 > window.innerHeight ? Math.max(8, p.y - list.offsetHeight - 20) : p.y + 4}px`;
    field.setAttribute('aria-expanded', 'true');
    choose(isName(m[1], macros) ? -1 : 0);
    completing = { field, key, close };
  };
  const key = (ev: KeyboardEvent): boolean => {
    if (!items.length) return false;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') choose(at < 0 && ev.key === 'ArrowUp' ? items.length - 1 : (at + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length);
    else if ((ev.key === 'Enter' && !ev.metaKey && !ev.ctrlKey) || (ev.key === 'Tab' && !ev.shiftKey)) {
      if (at < 0) {
        close();
        return false;
      }
      accept();
    }
    else if (ev.key === 'Escape') close();
    else return false;
    return true;
  };
  field.addEventListener('input', update);
  field.addEventListener('blur', () => setTimeout(() => document.activeElement !== field && close(), 0));
  field.addEventListener('pointerdown', () => setTimeout(update, 0));
}

export type TexEditor = { field: HTMLTextAreaElement; preview: HTMLElement; message: HTMLElement; ok(): boolean; refresh(): Promise<void>; settle(): Promise<void> };

export function texEditor(options: { display(): boolean; label: string; placeholder?: string; shown?(ok: boolean): void }): TexEditor {
  const field = make('textarea');
  field.setAttribute('aria-label', options.label);
  field.spellcheck = false;
  field.autocapitalize = 'off';
  field.placeholder = options.placeholder ?? 'Type TeX, e.g. \\frac{a}{b} or \\sqrt{x}';
  const preview = make('div', 'preview');
  preview.setAttribute('aria-live', 'polite');
  const message = make('div', 'error');
  let seq = 0;
  let timer = 0;
  let ok = false;
  let shown: string | null = null;
  const key = () => `${options.display()}\n${field.value}`;
  const refresh = async () => {
    const n = ++seq;
    const typeset = key();
    const result = await previewTex(field.value, options.display()).catch((e: unknown) => ({ node: null, error: e instanceof Error ? e.message : String(e) }));
    if (n !== seq) return;
    shown = typeset;
    const empty = !field.value.trim();
    preview.replaceChildren(...(result.node && !result.error ? [result.node] : empty ? [make('span', 'empty', 'A preview of the formula appears here.')] : []));
    message.textContent = result.error ?? '';
    message.classList.toggle('prompt', empty);
    if (empty || !result.error) message.removeAttribute('role');
    else message.setAttribute('role', 'alert');
    ok = !result.error;
    options.shown?.(ok);
  };
  field.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void refresh(), 150);
  });
  attachCompletion(field);
  const settle = async () => {
    window.clearTimeout(timer);
    while (shown !== key()) await refresh();
  };
  return { field, preview, message, ok: () => ok, refresh, settle };
}

type Sheet = { title: string; tex: string; display: boolean; open: string; close: string; primary: string; textEl(): Element; commit(tex: string): Promise<void>; done?(): void; made?: Element; left?(): void; closed?(): void };

const SIDES: Side[] = ['right', 'left', 'below', 'above'];

const textElementOf = (el: Element): Element => el.closest(HOST) ?? el;

let openFor: Element | null = null;
export const sheetTarget = (): Element | null => openFor;

let sheetApi: { open(sheet: Sheet, target: Element | null): void } | null = null;

export function openInsert(app: App, host: Element, range: Range): void {
  const selected = range.collapsed ? '' : range.toString();
  const kept = range.cloneRange();
  sheetApi?.open({
    title: 'Insert Inline Formula',
    tex: selected,
    display: false,
    open: '\\(',
    close: '\\)',
    primary: 'Insert',
    textEl: () => textElementOf(host),
    commit: async (tex) => {
      if (host.hasAttribute('data-generated')) {
        host.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: `\\(${tex}\\)`, bubbles: true, cancelable: true }));
        return;
      }
      if (host.classList.contains('beeson-pending')) {
        placeCaret(host);
        document.execCommand('insertText', false, `\\(${tex}\\)`);
        return;
      }
      const { content, index } = contentWithInline(host, kept, tex);
      await app.history.transact('Insert Inline Formula', () => app.doc.setContent(host, content, 'Inline Formula'));
      const math = host.querySelectorAll('mjx-container')[index];
      if (!math) return;
      (host as HTMLElement).focus({ preventScroll: true });
      const after = document.createRange();
      after.setStartAfter(math);
      after.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(after);
    },
    left: host.matches('.beeson-pending, [data-generated]') ? () => host.dispatchEvent(new FocusEvent('focusout')) : undefined,
  }, null);
}

export function install(app: App): void {
  injectStyle('mathpop', CSS);
  let popover: HTMLElement | null = null;
  let back: (() => void) | null = null;
  let ended: (() => void) | null = null;
  let unplace: (() => void) | null = null;
  let away: (() => Promise<void>) | null = null;
  let leftOf: (() => void) | null = null;
  let leaving = false;
  let opened: { field: HTMLTextAreaElement; tex: string } | null = null;
  let bound: (() => Element) | null = null;

  window.addEventListener('keydown', (ev) => {
    if (completing && ev.target === completing.field && completing.key(ev)) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }
  }, true);

  let held: string | null = null;
  window.addEventListener('keydown', (ev) => {
    if (held === null || ev.isComposing || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key.length === 1) held += ev.key;
    else if (ev.key === 'Enter') held += '\n';
    else if (ev.key === 'Backspace') held = held.slice(0, -1);
    else return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
  }, true);
  const hold = () => {
    held = '';
    return () => void (held = null);
  };

  function closeMath(focus = true): void {
    completing?.close();
    unplace?.();
    unplace = null;
    popover?.remove();
    popover = null;
    away = null;
    leftOf = null;
    openFor = null;
    opened = null;
    bound = null;
    const restore = back;
    back = null;
    const end = ended;
    ended = null;
    if (focus) restore?.();
    app.invalidate('selection');
    end?.();
  }

  async function setMath(container: Element, tex: string): Promise<void> {
    const host = container.closest(HOST);
    if (!host) throw new Error('the formula is not in a text element');
    const info = mathLookup()(container);
    if (!info) throw new Error('MathJax does not know this formula');
    const { error } = await previewTex(tex, info.display);
    if (error) throw new Error(error);
    if ((info.close && tex.includes(info.close)) || (info.open && tex.includes(info.open))) throw new Error(`The TeX cannot hold ${info.open} or ${info.close}, which end the formula`);
    const before = contentWithTex(host);
    const after = contentWithTex(host, new Map([[container, tex]]));
    if (after === before) return;
    const count = host.querySelectorAll('mjx-container').length;
    const active = document.activeElement as HTMLElement | null;
    const kept = app.selection.elements();
    const write = async () => {
      await app.doc.setContent(host, after, 'Formula');
      if (kept.length && kept.every((el) => el.isConnected)) app.selection.set('elements', kept);
    };
    await (kept.length ? app.history.selecting('Formula', write) : write());
    if (host.querySelectorAll('mjx-container').length !== count) throw new Error('MathJax does not find the formula with this TeX. Choose Undo to put the slide back');
    if (active?.isConnected && !host.contains(active)) active.focus({ preventScroll: true });
  }

  function openSheet(sheet: Sheet, target: Element | null): void {
    const replaced = leftOf;
    closeMath(false);
    if (replaced) {
      leaving = true;
      replaced();
      setTimeout(() => (leaving = false), 0);
    }
    const box = make('div', 'beeson-math beeson-tex');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', sheet.title);
    const title = make('div', 'title', sheet.title);
    const apply = make('button', 'primary', sheet.primary);
    const ed = texEditor({ display: () => sheet.display, label: 'TeX of the formula', shown: (ok) => (apply.disabled = !ok) });
    const { field } = ed;
    field.value = sheet.tex;
    field.rows = Math.min(12, Math.max(4, sheet.tex.split('\n').length + 1));
    const row = make('div', 'row');
    const cancel = make('button', '', 'Cancel');
    const keys = app.platform === 'mac' ? '⌘↩' : 'Ctrl+Enter';
    const hint = make('span', 'hint', `${sheet.open} … ${sheet.close}, ${keys} to ${sheet.primary.toLowerCase()}, Esc to cancel`);
    row.append(hint, cancel, apply);
    box.append(title, field, ed.preview, ed.message, row);
    box.addEventListener('mousedown', (ev) => {
      if (!(ev.target as Element).closest('textarea, button')) ev.preventDefault();
    });
    document.body.append(box);
    unplace = popoverBeside(app, box, sheet.textEl(), { sides: SIDES });
    apply.disabled = !sheet.tex.trim();
    void ed.refresh();
    let committing = false;
    const submit = async (focus = !!target && !sheet.made) => {
      if (committing) return true;
      committing = true;
      try {
        await ed.settle();
        if (popover !== box || !ed.ok()) return true;
        await sheet.commit(field.value);
        closeMath(focus);
        sheet.done?.();
        return true;
      } catch (e) {
        ed.message.classList.remove('prompt');
        ed.message.textContent = e instanceof Error ? e.message : String(e);
        return false;
      } finally {
        committing = false;
      }
    };
    apply.addEventListener('click', () => void submit());
    cancel.addEventListener('click', () => closeMath());
    field.addEventListener('keydown', (ev) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
        ev.preventDefault();
        void submit();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        closeMath();
      }
    });
    box.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Tab') return;
      ev.preventDefault();
      const stops = [field, apply, cancel].filter((el) => !el.disabled);
      const at = stops.indexOf(document.activeElement as HTMLTextAreaElement);
      stops[(at + (ev.shiftKey ? -1 : 1) + stops.length) % stops.length].focus();
    });
    popover = box;
    away = sheet.made
      ? async () => {
          if (field.value.trim() && !(await submit(false))) return;
          if (popover === box) closeMath(false);
        }
      : sheet.left
        ? async () => {
            closeMath(false);
            sheet.left?.();
          }
        : null;
    leftOf = sheet.left ?? null;
    ended = sheet.closed ?? null;
    bound = sheet.textEl;
    openFor = target;
    opened = target ? { field, tex: sheet.tex } : null;
    const host = target?.closest(HOST);
    const at = host && target ? [...host.querySelectorAll('mjx-container')].indexOf(target) : -1;
    const sel = window.getSelection();
    const caret = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    const from = document.activeElement as HTMLElement | null;
    back = target
      ? () => {
          const now = target.isConnected ? target : host?.querySelectorAll('mjx-container')[at] ?? null;
          (now as HTMLElement | null)?.focus({ preventScroll: true });
          const el = now && app.move.movableOf(now);
          if (el) app.selection.set('elements', [el]);
        }
      : () => {
          if (!from?.isConnected) return;
          from.focus({ preventScroll: true });
          if (caret && from.contains(caret.startContainer)) {
            sel?.removeAllRanges();
            sel?.addRange(caret);
          }
        };
    field.focus();
    field.select();
    const typed = held;
    held = null;
    if (typed) document.execCommand('insertText', false, typed);
    app.invalidate('selection');
  }

  function openMath(container: Element, into?: Entry, closed?: () => void): void {
    const info = mathLookup()(container);
    if (!info) return;
    const fresh = !info.tex.trim();
    const textEl = textElementOf(container);
    const count = textEl.querySelectorAll('mjx-container').length;
    const at = [...textEl.querySelectorAll('mjx-container')].indexOf(container);
    const now = (): Element => {
      if (container.isConnected) return container;
      const all = textEl.isConnected ? textEl.querySelectorAll('mjx-container') : [];
      const candidate = all[at];
      if (candidate && all.length === count && mathLookup()(candidate)?.tex === info.tex) return candidate;
      throw new Error('Another person changed the formulas of this text. Copy your TeX, press Cancel, and open the formula again.');
    };
    openSheet({
      title: fresh ? 'Insert Formula' : 'Edit Formula',
      tex: info.tex,
      display: info.display,
      open: info.open,
      close: info.close,
      primary: fresh ? 'Insert' : 'Apply',
      textEl: () => textEl,
      commit: into
        ? (tex) => app.history.amend(into, async () => {
            await setMath(now(), tex);
            if (textEl.isConnected) app.selection.set('elements', [textEl]);
          })
        : (tex) => setMath(now(), tex),
      made: into ? textEl : undefined,
      closed,
    }, container);
  }

  sheetApi = { open: openSheet };
  const wholeTex = () => {
    const f = opened?.field;
    return f && document.activeElement === f && f.value.trim() && f.value === opened?.tex && f.selectionStart === 0 && f.selectionEnd === f.value.length ? openFor : null;
  };
  const math: MathPop = { isOpen: () => !!popover && !leaving, open: openMath, close: closeMath, setMath, hold, wholeTex };
  app.math = math;
  let sheetBeforeClick: HTMLElement | null = null;
  window.addEventListener('click', () => (sheetBeforeClick = popover), true);
  document.addEventListener('click', (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    const container = ev.defaultPrevented ? null : target?.closest('mjx-container');
    const host = container && app.hostOf(container);
    if (container && host && (!isLabel(host) || document.activeElement === host)) {
      ev.preventDefault();
      if (!ev.shiftKey && !(app.platform === 'mac' ? ev.metaKey : ev.ctrlKey) && (popover || !showTex(app, container, 'all'))) openMath(container);
    } else if (popover && popover === sheetBeforeClick && target && !popover.contains(target) && !target.closest('.beeson-complete, .beeson-edit-menu')) {
      if (away) void away();
      else closeMath(false);
    }
  });
  app.listen('slide', () => closeMath(false));
  const gone = () => {
    if (popover && bound && !bound().isConnected) closeMath(false);
  };
  app.listen('history', gone);
  app.onRefresh(['content', 'structure'], gone);
}
