// the TeX of a formula is edited in a field under it, with a live preview, and the block of the
// formula is typeset again on Apply. a click on a formula, or Enter on a focused one, opens the
// field, and a TeX with an error is refused before the slide is touched

import { HOST, type App, type MathPop } from '../app.ts';
import { contentWithTex, mathLookup, previewTex, retypeset } from '../math.ts';
import { injectStyle, make } from '../ui/dom.ts';

const CSS = `
.beeson-math { position: fixed; z-index: 70; display: flex; flex-direction: column; gap: 6px; width: min(640px, calc(100vw - 32px)); box-sizing: border-box; padding: 10px; border: 1px solid var(--line, #555); border-radius: 6px; background: var(--bg, #000); color: var(--text, #eee); font: 14px/1.4 system-ui, sans-serif; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); }
.beeson-math textarea { font: 14px/1.4 ui-monospace, Menlo, Consolas, monospace; min-height: 5em; padding: 6px; border: 1px solid var(--line, #555); border-radius: 4px; background: transparent; color: inherit; resize: vertical; }
.beeson-math .row { display: flex; gap: 8px; align-items: center; }
.beeson-math button { font: inherit; padding: 4px 12px; border: 1px solid var(--line, #555); border-radius: 6px; background: transparent; color: var(--text, #eee); cursor: pointer; white-space: nowrap; }
.beeson-math button:hover { border-color: var(--subtle, #bbb); }
.beeson-math .hint { margin-left: auto; color: var(--subtle, #bbb); }
.beeson-math .error { color: var(--accent, #f80); }
.beeson-math .error:empty { display: none; }
.beeson-math .preview { padding: 8px 12px; border: 1px solid var(--line, #444); background: var(--bg, #000); color: var(--text, #fff); font-size: 32px; max-height: 240px; overflow: auto; }
.beeson-math .preview mjx-container { margin: 0 !important; }
.beeson-math .preview:empty { display: none; }
.beeson-math button:disabled { opacity: 0.5; cursor: default; }
`;

export function install(app: App): void {
  injectStyle('mathpop', CSS);
  let popover: HTMLElement | null = null;
  // the formula that the field is open for, which gets the focus back when the field is closed
  let popoverFor: Element | null = null;

  function closeMath(back = true): void {
    popover?.remove();
    popover = null;
    const el = popoverFor;
    popoverFor = null;
    if (back && el?.isConnected) (el as HTMLElement).focus({ preventScroll: true });
  }

  // a TeX with an error is refused before the slide is touched, and the error is thrown to the
  // field, where it is shown under the TeX. the change is one entry of the history
  async function setMath(container: Element, tex: string): Promise<void> {
    const host = container.closest(HOST);
    if (!host) throw new Error('the formula is not in an editable block');
    const info = mathLookup()(container);
    const { error } = await previewTex(tex, info?.display ?? false);
    if (error) throw new Error(error);
    const before = contentWithTex(host);
    if (!(await retypeset(host, container, tex))) throw new Error('MathJax does not find the formula with this TeX, and the slide is kept as it was');
    app.typing.markMath(host);
    const after = contentWithTex(host);
    if (after !== before) app.history.push({ label: 'formula', undo: () => app.typing.restoreHost(host, before), redo: () => app.typing.restoreHost(host, after) });
    app.markDirty();
  }

  function openMath(container: Element): void {
    const info = mathLookup()(container);
    if (!info) return;
    closeMath();
    const box = make('div', 'beeson-math');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'The TeX of the formula');
    popoverFor = container;
    // the formula is typeset into a new container on Apply, found again by its place in the block
    const host = container.closest(HOST);
    const at = host ? [...host.querySelectorAll('mjx-container')].indexOf(container) : -1;
    const field = make('textarea');
    field.setAttribute('aria-label', 'TeX of the formula');
    field.value = info.tex;
    field.rows = Math.min(12, Math.max(3, info.tex.split('\n').length + 1));
    const row = make('div', 'row');
    const apply = make('button', '', 'Apply');
    const cancel = make('button', '', 'Cancel');
    const hint = make('span', 'hint', `${info.open} … ${info.close}, ⌘ or Ctrl+Enter applies, Esc cancels`);
    const preview = make('div', 'preview');
    const error = make('div', 'error');
    error.setAttribute('role', 'alert');
    row.append(apply, cancel, hint);
    box.append(field, preview, row, error);
    const rect = container.getBoundingClientRect();
    box.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - 656))}px`;
    box.style.top = `${Math.max(52, Math.min(rect.bottom + 8, window.innerHeight - 420))}px`;
    // the TeX is typeset under the field as it is typed, and Apply is off while it has an error.
    // a late result of an earlier TeX is dropped
    let shown = 0;
    let timer = 0;
    const show = async () => {
      const seq = ++shown;
      const result = await previewTex(field.value, info.display).catch((e: unknown) => ({ node: null, error: e instanceof Error ? e.message : String(e) }));
      if (seq !== shown) return;
      preview.replaceChildren(...(result.node ? [result.node] : []));
      error.textContent = result.error ?? '';
      apply.disabled = !!result.error;
    };
    void show();
    field.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(show, 150);
    });
    apply.addEventListener('click', async () => {
      try {
        await setMath(container, field.value);
        popoverFor = host?.querySelectorAll('mjx-container')[at] ?? null;
        closeMath();
      } catch (e) {
        error.textContent = e instanceof Error ? e.message : String(e);
      }
    });
    cancel.addEventListener('click', () => closeMath());
    field.addEventListener('keydown', (ev) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
        ev.preventDefault();
        apply.click();
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
    document.body.append(box);
    popover = box;
    field.focus();
    field.select();
  }

  const math: MathPop = { isOpen: () => !!popover, open: openMath, close: closeMath, setMath };
  app.math = math;
  document.addEventListener('click', (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    const container = target?.closest('mjx-container');
    if (container && app.hostOf(container)) {
      ev.preventDefault();
      openMath(container);
    } else if (popover && target && !popover.contains(target)) closeMath(false);
  });
  app.listen('slide', () => closeMath(false));
}
