// the TeX of a formula is edited in a sheet beside the line or the list item that holds it, as the
// Edit Equation popover of Keynote, flipped to the other side where the window ends: a title, a tall field of the TeX, a live preview, and Cancel with Apply, or Insert for a new
// formula. a click on a formula, or Enter on a focused one, opens the sheet, and a TeX with an
// error is refused before the slide is touched. an empty TeX is shown as a gray prompt and is not
// applied. the field completes the macros of theme/macros.js and the commands of TeX after a
// backslash, and texEditor gives the same field with its preview to the Formula pane of the
// inspector. openInsert opens the sheet for an inline formula at the caret of a text

import { HOST, type App, type MathPop } from '../app.ts';
import { completionText, completions, contentWithInline, contentWithTex, deckMacros, glyphOf, isName, mathLookup, previewTex, type Macro } from '../math.ts';
import { keepBeside, type Side } from '../ui/dialog.ts';
import { injectStyle, make } from '../ui/dom.ts';

const CSS = `
.beeson-math { position: fixed; z-index: 70; display: flex; flex-direction: column; gap: 10px; width: min(460px, calc(100vw - 32px)); box-sizing: border-box; padding: 16px 18px 14px; border: 1px solid var(--ed-menu-line, #555); border-radius: 14px; background: var(--ed-panel, #222); color: var(--ed-text, #eee); font: 13px/1.4 var(--ed-font, system-ui, sans-serif); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.14); }
.beeson-math .title { color: var(--ed-muted, #999); font: 500 12px/1.2 var(--ed-font, system-ui, sans-serif); }
.beeson-math textarea { font: 13px/1.45 ui-monospace, Menlo, Consolas, monospace; min-height: 7.5em; padding: 8px 10px; border: 0; border-radius: 7px; background: var(--ed-control, #333); box-shadow: inset 0 0 0 1px var(--ed-control-line, #555); color: inherit; resize: vertical; outline: none; }
.beeson-math textarea:focus { box-shadow: inset 0 0 0 1px var(--ed-select, #96f), 0 0 0 2px var(--ed-focus, rgba(150, 100, 255, 0.5)); }
.beeson-math textarea::placeholder, .beeson-tex textarea::placeholder { color: var(--ed-faint, #777); }
.beeson-math .row { display: flex; gap: 8px; align-items: center; }
.beeson-math button { font: inherit; min-width: 72px; padding: 4px 14px; border: 1px solid var(--ed-control-line, #555); border-radius: 6px; background: var(--ed-control, #333); color: var(--ed-text, #eee); cursor: default; white-space: nowrap; box-shadow: 0 0.5px 1px rgba(0, 0, 0, 0.12); }
.beeson-math button.primary { border-color: transparent; background: var(--ed-select, #96f); color: var(--ed-on-select, #fff); }
.beeson-math button:focus-visible { outline: 3px solid var(--ed-focus, rgba(150, 100, 255, 0.5)); outline-offset: 1px; }
.beeson-math button:disabled { opacity: 0.45; }
.beeson-math .hint { margin-right: auto; color: var(--ed-faint, #888); font-size: 11px; }
.beeson-tex .preview { display: flex; align-items: center; justify-content: center; min-height: 56px; max-height: 200px; overflow: auto; padding: 8px 12px; border-radius: 9px; background: var(--ed-hover, rgba(127, 127, 127, 0.1)); color: var(--ed-text, #eee); font-size: 26px; }
.beeson-tex .preview mjx-container { margin: 0 !important; max-width: 100%; }
.beeson-tex .preview svg { max-width: 100%; height: auto; }
.beeson-tex .preview .empty { color: var(--ed-faint, #888); font: 12px/1.3 var(--ed-font, system-ui, sans-serif); }
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

// the completion list that is open, which the keys of its field reach before the keys of the
// editor, since the keyboard handler of commands.ts is on window in the capture phase as well
let completing: { field: HTMLTextAreaElement; key(ev: KeyboardEvent): boolean; close(): void } | null = null;

// the place of the caret of field on the screen, read from a copy of the field with the same
// font and wrapping
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

// the completion of field: after a backslash and the letters typed after it, a list of the macros
// of the deck and of the commands of TeX that match. the arrows choose, Return or Tab writes the
// name with the braces of its arguments, and Esc closes the list
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
      // the glyph of the command, as in the math autocomplete list of PowerPoint, is filled in once
      // MathJax has typeset it, and from the cache of glyphOf in every later list
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
    // a name typed in full, e.g. \quad, is not replaced by Enter with a longer name, e.g. \qquad,
    // until an arrow chooses one
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

// a field of the TeX with its live preview and its message, which is the error of MathJax in red
// or the prompt of an empty TeX in gray. a late result of an earlier TeX is dropped, and shown is
// called with the result of each TeX that is typeset. settle resolves once the TeX of the field is
// typeset, after which ok() is true for that TeX
export type TexEditor = { field: HTMLTextAreaElement; preview: HTMLElement; message: HTMLElement; ok(): boolean; refresh(): Promise<void>; settle(): Promise<void> };

export function texEditor(options: { display(): boolean; label: string; placeholder?: string; shown?(ok: boolean): void }): TexEditor {
  const field = make('textarea');
  field.setAttribute('aria-label', options.label);
  field.spellcheck = false;
  field.autocapitalize = 'off';
  field.placeholder = options.placeholder ?? 'Type TeX, e.g. \\frac{a}{b} or \\LL{1}';
  const preview = make('div', 'preview');
  preview.setAttribute('aria-live', 'polite');
  const message = make('div', 'error');
  let seq = 0;
  let timer = 0;
  let ok = false;
  // the TeX and the mode of the last result shown
  let shown: string | null = null;
  const key = () => `${options.display()}\n${field.value}`;
  const refresh = async () => {
    const n = ++seq;
    const typeset = key();
    const result = await previewTex(field.value, options.display()).catch((e: unknown) => ({ node: null, error: e instanceof Error ? e.message : String(e) }));
    if (n !== seq) return;
    shown = typeset;
    const empty = !field.value.trim();
    preview.replaceChildren(...(result.node ? [result.node] : [make('span', 'empty', 'A preview of the formula appears here.')]));
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

// the sheet of a TeX: its title, its first TeX, whether it is a display, the label of its button,
// the box that it is put beside and kept clear of, and commit, which writes the TeX and throws an
// error to be shown at the field
type Sheet = { title: string; tex: string; display: boolean; open: string; close: string; primary: string; rect(): DOMRect; commit(tex: string): Promise<void>; done?(): void };

// the sheet is put at the right of the text column, over the figure of the slide, or at the left,
// and above or below a block that fills the slide
const SIDES: Side[] = ['right', 'left', 'below', 'above'];

// the box of the block that holds a formula or a caret, e.g. a list item, a paragraph, or a display
export const blockBox = (el: Element): DOMRect => (el.closest(HOST) ?? el).getBoundingClientRect();

// the formula that the sheet is open for, read by the Formula pane of the inspector
let openFor: Element | null = null;
export const sheetTarget = (): Element | null => openFor;

let sheetApi: { open(sheet: Sheet, target: Element | null): void } | null = null;

// the sheet of an inline formula at range in host, written at Insert as \(tex\) at the caret, as
// one entry of the history. a range that is not collapsed is the first TeX, as the conversion of
// a selection by Insert Equation in PowerPoint
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
    rect: () => blockBox(host),
    commit: async (tex) => {
      const { content, index } = contentWithInline(host, kept, tex);
      await app.history.transact('Inline Formula', () => app.doc.setContent(host, content, 'Inline Formula'));
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
  }, null);
}

export function install(app: App): void {
  injectStyle('mathpop', CSS);
  let popover: HTMLElement | null = null;
  let back: (() => void) | null = null;
  let unplace: (() => void) | null = null;

  // the keys of an open completion list are taken before the keys of the editor and of the sheet
  window.addEventListener('keydown', (ev) => {
    if (completing && ev.target === completing.field && completing.key(ev)) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }
  }, true);

  function closeMath(focus = true): void {
    completing?.close();
    unplace?.();
    unplace = null;
    popover?.remove();
    popover = null;
    openFor = null;
    const restore = back;
    back = null;
    if (focus) restore?.();
    app.invalidate('selection');
  }

  // a TeX with an error, or with a delimiter of a formula in it, is refused before the slide is
  // touched, and the error is thrown to the field, where it is shown under the TeX. the block is
  // written through app.doc as one entry of the history, and the focus is kept where it was
  async function setMath(container: Element, tex: string): Promise<void> {
    const host = container.closest(HOST);
    if (!host) throw new Error('the formula is not in an editable block');
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
    await app.doc.setContent(host, after, 'Formula');
    if (host.querySelectorAll('mjx-container').length !== count) throw new Error('MathJax does not find the formula with this TeX, and Undo puts the slide back');
    if (active?.isConnected && !host.contains(active)) active.focus({ preventScroll: true });
  }

  function openSheet(sheet: Sheet, target: Element | null): void {
    closeMath(false);
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
    document.body.append(box);
    // the box of the block is read once, since the block is typeset again at a commit
    const rect = sheet.rect();
    unplace = keepBeside(box, () => rect, SIDES);
    apply.disabled = !sheet.tex.trim();
    void ed.refresh();
    // the commit key is held until the TeX typed before it is typeset, since Apply is dimmed or
    // lit by the preview of an earlier TeX until then. a TeX with an error is not committed
    let committing = false;
    const submit = async () => {
      if (committing) return;
      committing = true;
      try {
        await ed.settle();
        if (popover !== box || !ed.ok()) return;
        await sheet.commit(field.value);
        closeMath(!!target);
        sheet.done?.();
      } catch (e) {
        ed.message.classList.remove('prompt');
        ed.message.textContent = e instanceof Error ? e.message : String(e);
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
    // Tab and Shift+Tab cycle between the field and the buttons, as in a modal dialog
    box.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Tab') return;
      ev.preventDefault();
      const stops = [field, apply, cancel].filter((el) => !el.disabled);
      const at = stops.indexOf(document.activeElement as HTMLTextAreaElement);
      stops[(at + (ev.shiftKey ? -1 : 1) + stops.length) % stops.length].focus();
    });
    popover = box;
    openFor = target;
    const host = target?.closest(HOST);
    const at = host && target ? [...host.querySelectorAll('mjx-container')].indexOf(target) : -1;
    // the focus goes back to the formula, or to the caret of the text of an inline formula
    const sel = window.getSelection();
    const caret = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    const from = document.activeElement as HTMLElement | null;
    back = target
      ? () => {
          const now = target.isConnected ? target : host?.querySelectorAll('mjx-container')[at] ?? null;
          (now as HTMLElement | null)?.focus({ preventScroll: true });
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
    app.invalidate('selection');
  }

  function openMath(container: Element): void {
    const info = mathLookup()(container);
    if (!info) return;
    const fresh = !info.tex.trim();
    openSheet({
      title: fresh ? 'Insert Formula' : 'Edit Formula',
      tex: info.tex,
      display: info.display,
      open: info.open,
      close: info.close,
      primary: fresh ? 'Insert' : 'Apply',
      rect: () => blockBox(container),
      commit: (tex) => setMath(container, tex),
    }, container);
  }

  sheetApi = { open: openSheet };
  const math: MathPop = { isOpen: () => !!popover, open: openMath, close: closeMath, setMath };
  app.math = math;
  document.addEventListener('click', (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    const container = target?.closest('mjx-container');
    if (container && app.hostOf(container)) {
      ev.preventDefault();
      openMath(container);
    } else if (popover && target && !popover.contains(target) && !target.closest('.beeson-complete')) closeMath(false);
  });
  app.listen('slide', () => closeMath(false));
}
